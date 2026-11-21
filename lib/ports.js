/**
 * lib/ports.js —— ComfyUI 监听端口的体检、换端口与失败归因。
 *
 * ## 为什么要有这一层（2026-11-21 真机事故）
 * ComfyUI 冷启动，`main.py` 走到 `asyncio.create_server` 抛：
 *
 *   PermissionError: [Errno 13] error while attempting to bind on address
 *   ('127.0.0.1', 8188): [winerror 10013] 以一种访问权限不允许的方式做了一个访问套接字的尝试
 *
 * 10013 = WSAEACCES，不是"端口被占"（那是 10048），而是**端口被系统保留**：
 * WinNAT / Hyper-V 会在动态端口区间里预留成段端口（本机实测保留
 * 7728–8362 好几段，8188 正好落在 8128–8227 里）。保留区间要管理员改、
 * 还要重启，普通权限只能换端口。
 *
 * 当时的体验很差：启动器只看到"进程启动后立即退出"，面板给的唯一线索是
 * "检查日志"，得自己翻到日志最底下才看见 10013 —— 而三条启动链路
 * （comfyui_server、draw_image 预热、套件壳层下发地址）各自失败，谁都没说是
 * 端口的事。这一层把"这个端口现在能不能绑"变成一个可以问出口的问题：
 *
 *   · bindTest()      —— 真的 bind 一次，拿到 EACCES / EADDRINUSE 这种硬证据；
 *   · probeComfy()    —— 端口上是不是已经有一个活着的 ComfyUI（EADDRINUSE 的好情况）；
 *   · resolveEndpoint() —— 绑不上就 +1 往后找，并给出人能读的原因；
 *   · alignSuiteConfig() —— 把同一个结论写进三个子插件的配置块；
 *   · explainBindLog() —— 从 ComfyUI 自己的日志尾部认出 10013 / 10048。
 *
 * 所有探测都只碰本机回环：远端地址不做体检，也不改写（那是另一套部署）。
 */
import { createServer } from 'node:net'

/** 回环监听地址（`0.0.0.0` 也是本机监听，但对外连接要用 127.0.0.1）。 */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '0.0.0.0'])

/**
 * 换端口时往后试多少个（默认 160）。
 *
 * 160 不是随手写的：WinNAT / Hyper-V 的一段预留通常是 100 个端口，而配置的端口
 * 可能落在这一段靠前的位置 —— 实测 8188 落在 8128–8227 里，往后要跳过 40 个才到
 * 能用的 8228。scan 小于这个数就会出现"明明旁边就有空端口却说没有"。失败一次
 * 是即时返回（EACCES 不会等超时），所以扫 160 个也就几毫秒。
 */
const DEFAULT_SCAN = 160

/** @returns {boolean} 这个 host 是不是"本机上绑"的地址。 */
export function isLocalHost(host) {
    return LOOPBACK_HOSTS.has(String(host ?? '').trim().toLowerCase())
}

/** `0.0.0.0` / `::` 这类通配地址换成可连接的 127.0.0.1，其它原样返回。 */
export function connectHost(host) {
    const text = String(host ?? '').trim()
    const lower = text.toLowerCase()
    return lower === '0.0.0.0' || lower === '[::]' || lower === '::' ? '127.0.0.1' : text
}

function hostForUrl(host) {
    return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
}

/**
 * 真的尝试 bind 一次。
 *
 * 这是唯一能区分"端口被系统保留"和"端口被别的程序占着"的办法 —— 两个
 * 症状在 ComfyUI 的日志里长得不一样，但对调用方来说都只是"起不来"。
 *
 * @returns {Promise<{ok: boolean, code?: string, message?: string}>}
 */
export function bindTest(host, port, timeoutMs = 800) {
    const target = Number.parseInt(String(port), 10)
    if (!Number.isSafeInteger(target) || target < 1 || target > 65_535) {
        return Promise.resolve({ ok: false, code: 'EINVALIDPORT', message: `端口号不合法：${port}` })
    }
    return new Promise((resolve) => {
        const server = createServer()
        let settled = false
        const finish = (result) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            try {
                server.close(() => { })
            }
            catch {
                // 已经关过：忽略
            }
            resolve(result)
        }
        const timer = setTimeout(
            () => finish({ ok: false, code: 'ETIMEDOUT', message: `绑定 ${host}:${target} 超时` }),
            timeoutMs,
        )
        if (typeof timer.unref === 'function') timer.unref()
        server.once('error', (error) => {
            finish({
                ok: false,
                code: typeof error?.code === 'string' ? error.code : 'EUNKNOWN',
                message: error instanceof Error ? error.message : String(error),
            })
        })
        try {
            server.listen({ host: connectHost(host), port: target, exclusive: true }, () => finish({ ok: true }))
        }
        catch (error) {
            finish({
                ok: false,
                code: typeof error?.code === 'string' ? error.code : 'EUNKNOWN',
                message: error instanceof Error ? error.message : String(error),
            })
        }
    })
}

/**
 * 这个端口上是不是已经有一个 ComfyUI 在应答？
 *
 * EADDRINUSE 有两种完全不同的含义：ComfyUI 自己在跑（好消息，直接用），或者
 * 别的程序占着（坏消息，只能换端口）。`/system_stats` 是 ComfyUI 的接口，
 * 能应答就证明监听者真的是它。
 */
export async function probeComfy(host, port, timeoutMs = 1_200) {
    const target = Number.parseInt(String(port), 10)
    if (!Number.isSafeInteger(target) || target < 1 || target > 65_535) return { up: false, error: '端口号不合法' }
    try {
        const response = await fetch(`http://${hostForUrl(connectHost(host))}:${target}/system_stats`, {
            signal: AbortSignal.timeout(timeoutMs),
            headers: { accept: 'application/json' },
        })
        if (!response.ok) return { up: false, status: response.status }
        const data = await response.json().catch(() => undefined)
        const version = data?.system?.comfyui_version
        return { up: true, version: typeof version === 'string' ? version : undefined }
    }
    catch (error) {
        return { up: false, error: error instanceof Error ? error.message : String(error) }
    }
}

/** 一句人能读的失败原因（带上 Windows 的错误号，方便照着搜）。 */
export function describeBindFailure(code, port) {
    switch (code) {
        case 'EACCES':
            return `端口 ${port} 被系统保留或拒绝绑定（Windows WinError 10013）`
        case 'EADDRINUSE':
            return `端口 ${port} 已被其它程序占用（Windows WinError 10048）`
        case 'EINVALIDPORT':
            return `端口 ${port} 不合法`
        case 'ETIMEDOUT':
            return `端口 ${port} 探测超时`
        default:
            return `端口 ${port} 无法绑定（${code === undefined || code === '' ? '未知错误' : code}）`
    }
}

/** 接下来该怎么做（空字符串表示没有特别建议）。 */
export function bindAdvice(code) {
    switch (code) {
        case 'EACCES':
            return 'WinNAT / Hyper-V 会预留成段端口，普通权限改不掉；'
                + '用 `netsh interface ipv4 show excludedportrange protocol=tcp` 查保留区间，'
                + '换一个区间外的端口（套件在启动时会自动往后挑）'
        case 'EADDRINUSE':
            return '先停掉占用这个端口的程序，或在设置里换一个端口'
        default:
            return ''
    }
}

/**
 * 选一个能真正 bind 的端口。
 *
 * 顺序很重要：**先保住配置里的端口**。只有三种情况才换：
 *   ① 绑不上（EACCES，保留区间）；
 *   ② 绑不上且端口上不是 ComfyUI（被别的程序占了）；
 *   ③ 探测本身超时/未知错误。
 * 而"端口被占但应答的是 ComfyUI"**不换** —— 那说明后端已经在跑，换端口只会
 * 让 draw_image 去连一个没人监听的地址。
 *
 * @returns {Promise<{host: string, requestedPort: number, port: number, changed: boolean,
 *   code: string, reason: string, checkedAt: string}>}
 */
export async function resolveEndpoint({
    host = '127.0.0.1',
    port = 8188,
    scan = DEFAULT_SCAN,
    bind = bindTest,
    probe = probeComfy,
} = {}) {
    const requested = Number.parseInt(String(port), 10)
    const base = {
        host,
        requestedPort: Number.isSafeInteger(requested) ? requested : 0,
        port: Number.isSafeInteger(requested) ? requested : 0,
        changed: false,
        code: '',
        reason: '可用',
        checkedAt: new Date().toISOString(),
    }
    if (!Number.isSafeInteger(requested) || requested < 1 || requested > 65_535) {
        return { ...base, reason: `端口配置不合法（${port}），保持原样` }
    }
    if (!isLocalHost(host)) return { ...base, reason: '非本机地址，不做端口体检' }

    const first = await bind(host, requested)
    if (first.ok === true) return base

    const code = typeof first.code === 'string' ? first.code : 'EUNKNOWN'
    if (code === 'EADDRINUSE') {
        const live = await probe(host, requested)
        if (live?.up === true) {
            return { ...base, code, reason: '已有 ComfyUI 在这个端口上运行' }
        }
    }

    const attempts = Math.max(1, Math.min(200, Number.parseInt(String(scan), 10) || DEFAULT_SCAN))
    for (let offset = 1; offset <= attempts; offset += 1) {
        const candidate = requested + offset
        if (candidate > 65_535) break
        const test = await bind(host, candidate)
        if (test.ok === true) {
            return {
                ...base,
                port: candidate,
                changed: true,
                code,
                reason: `${describeBindFailure(code, requested)}，改用 ${candidate}`,
            }
        }
    }
    return {
        ...base,
        code,
        reason: `${describeBindFailure(code, requested)}，且往后 ${attempts} 个端口都不可用`,
    }
}

/** 从 URL 里取 host/port；取不到返回 null。 */
export function endpointOfUrl(value) {
    try {
        const url = new URL(String(value))
        const portText = url.port
        const port = portText === '' ? (url.protocol === 'https:' ? 443 : 80) : Number.parseInt(portText, 10)
        if (!Number.isSafeInteger(port) || port < 1) return null
        return { host: url.hostname, port }
    }
    catch {
        return null
    }
}

function sameHost(a, b) {
    const norm = (value) => {
        const text = String(value ?? '').trim().toLowerCase()
        return text === 'localhost' || text === '0.0.0.0' || text === '::1' || text === '[::1]' ? '127.0.0.1' : text
    }
    return norm(a) === norm(b)
}

/**
 * 把端口结论写进三个配置块，让 14 个工具说的是同一个地址。
 *
 * 为什么必须三块一起改：`comfyui.baseUrl` 决定 comfyui_* 工具与技能包连哪里，
 * `launcher.port` 决定 comfyui_server 拉起谁，`qwenPaint.comfyUrl` 决定
 * draw_image / inpaint / outpaint / character / upscale 连哪里。只改一块就是
 * "一半工具能用"这种最难查的状态。
 *
 * 但**只改本来就说同一个地址的块**：如果某一块被显式指到别处（另一台机器、
 * 另一套部署），那不是笔误，动它等于改坏用户的部署。
 */
export function alignSuiteConfig({ comfyui, launcher, qwenPaint, plan }) {
    const blocks = {
        comfyui: comfyui !== null && typeof comfyui === 'object' ? comfyui : undefined,
        launcher: launcher !== null && typeof launcher === 'object' ? launcher : undefined,
        qwenPaint: qwenPaint !== null && typeof qwenPaint === 'object' ? qwenPaint : undefined,
    }
    if (plan?.changed !== true) return blocks

    const url = `http://${connectHost(plan.host)}:${plan.port}`
    const align = (block, key) => {
        if (block === undefined) return undefined
        const current = endpointOfUrl(block[key])
        if (current === null) return block
        if (current.port !== plan.requestedPort || !sameHost(current.host, plan.host)) return block
        return { ...block, [key]: url }
    }
    return {
        comfyui: align(blocks.comfyui, 'baseUrl'),
        // 启动器只认数字端口；host 保持用户写的那个（监听地址）。
        launcher: blocks.launcher === undefined ? undefined : { ...blocks.launcher, port: plan.port },
        qwenPaint: align(blocks.qwenPaint, 'comfyUrl'),
    }
}

/**
 * 一次把"这次到底用哪个端口、三个块长什么样"算出来。
 *
 * 套件壳层在 apply 里调用一次，三个子插件拿到的就是同一个结论 —— 不需要运行
 * 期再互相通知（子插件在 apply 时各自把配置拷进自己的对象，事后通知反而不可靠）。
 */
export async function planComfyEndpoint(config, options = {}) {
    const raw = config !== null && typeof config === 'object' ? config : {}
    const launcher = raw.launcher !== null && typeof raw.launcher === 'object' ? raw.launcher : {}
    const comfyui = raw.comfyui !== null && typeof raw.comfyui === 'object' ? raw.comfyui : {}
    const qwenPaint = raw.qwenPaint !== null && typeof raw.qwenPaint === 'object' ? raw.qwenPaint : {}

    const fromLauncher = Number.parseInt(String(launcher.port ?? ''), 10)
    const fallback = endpointOfUrl(comfyui.baseUrl) ?? endpointOfUrl(qwenPaint.comfyUrl) ?? { host: '127.0.0.1', port: 8188 }
    const host = typeof launcher.host === 'string' && launcher.host.trim() !== '' ? launcher.host.trim() : fallback.host
    const port = Number.isSafeInteger(fromLauncher) && fromLauncher > 0 ? fromLauncher : fallback.port

    const plan = options.skip === true
        ? {
            host,
            requestedPort: port,
            port,
            changed: false,
            code: '',
            reason: '跳过端口体检',
            checkedAt: new Date().toISOString(),
        }
        : await resolveEndpoint({
            host,
            port,
            scan: options.scan,
            bind: options.bind,
            probe: options.probe,
        })

    return { plan, ...alignSuiteConfig({ comfyui, launcher, qwenPaint, plan }) }
}

/**
 * 从 ComfyUI 的日志尾部认出绑定失败的真正原因。
 *
 * 用日志而不是只用退出码：ComfyUI 起不来时退出码是 1，什么都说明不了；但它在
 * 崩之前会把 traceback 完整写进日志，最后一行永远带着 WinError 号。
 *
 * @param {string | string[]} text 日志尾部（行数组或整段文本）
 * @returns {{code: string, message: string, advice: string} | null}
 */
export function explainBindLog(text, port) {
    const source = Array.isArray(text) ? text.join('\n') : String(text ?? '')
    if (source === '') return null
    const rules = [
        { code: 'EACCES', test: /winerror\s*10013|\[errno\s*13\][^\n]*bind|EACCES[^\n]*bind/i },
        { code: 'EADDRINUSE', test: /winerror\s*10048|\[errno\s*(?:48|98|100)\][^\n]*bind|address already in use/i },
    ]
    for (const rule of rules) {
        if (rule.test.test(source)) {
            return {
                code: rule.code,
                message: describeBindFailure(rule.code, port),
                advice: bindAdvice(rule.code),
            }
        }
    }
    return null
}

/* --------------------------------------------------------------- 端口回执 ---- */

/**
 * 本次激活用的端口结论。挂在模块上而不是配置文件里：它描述的是"这一次运行
 * 挑了哪个端口"，写回配置会让下次启动失去"配置是意图、探测是现实"的区分。
 */
let currentPlan = {
    host: '',
    requestedPort: 0,
    port: 0,
    changed: false,
    code: '',
    reason: '',
    checkedAt: '',
}

export function setPortPlan(plan) {
    if (plan === null || typeof plan !== 'object') return
    currentPlan = { ...currentPlan, ...plan }
}

export function getPortPlan() {
    return { ...currentPlan }
}