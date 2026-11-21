/**
 * test-launch.mjs — 零窗口启动与端口体检的纯函数测试。
 *
 * 这里不真的拉起 ComfyUI（那要 45 秒，还会占显存）；只把**生成物**钉住：
 * 批处理的编码/引号/环境变量、VBS 的 SW_HIDE 语义、pid 存活判断，以及
 * 2026-11-21 那次事故的复盘产物 —— 端口体检（lib/ports.js）与启动前预检。
 * 真机启动路径由 README 的「启动行为」小节描述，人工用 `draw_image` 复核。
 */
import assert from 'node:assert/strict'
import {
    HIDDEN_VBS,
    buildWindowsBatch,
    findComfyPid,
    isProcessAlive,
    parseListenTarget,
    preflightTarget,
} from './lib/hidden-launch.js'
import {
    alignSuiteConfig,
    bindTest,
    describeBindFailure,
    endpointOfUrl,
    explainBindLog,
    isLocalHost,
    planComfyEndpoint,
    resolveEndpoint,
} from './lib/ports.js'

let passed = 0
function check(name, fn) {
    try {
        fn()
        passed += 1
        console.log(`ok   ${name}`)
    } catch (error) {
        console.error(`FAIL ${name}\n     ${error.message}`)
        process.exitCode = 1
    }
}

async function checkAsync(name, fn) {
    try {
        await fn()
        passed += 1
        console.log(`ok   ${name}`)
    } catch (error) {
        console.error(`FAIL ${name}\n     ${error.message}`)
        process.exitCode = 1
    }
}

/** 假的 bind：指定 port 上给出固定错误码，其余端口视为可用。 */
function fakeBind(failures) {
    return async (_host, port) => failures[port] ?? { ok: true }
}

check('batch: CRLF + chcp 65001 + UTF-8 中文路径', () => {
    const text = buildWindowsBatch({
        python: 'D:/dsh-video/a/python_embeded/python.exe',
        args: ['D:/dsh-video/a/ComfyUI/main.py', '--listen', '127.0.0.1'],
        workdir: 'D:/dsh-video/a/ComfyUI',
        logPath: 'D:/dsh-video/a/ComfyUI/.dshqp-launch.log',
    })
    assert.ok(text.includes('\r\n'), 'must use CRLF (cmd mis-parses LF-only batches)')
    assert.ok(!/[^\r]\n/.test(text), 'no bare LF allowed')
    assert.ok(text.startsWith('@echo off\r\nchcp 65001 >nul\r\n'), 'UTF-8 code page first')
    assert.ok(text.includes('cd /d "D:/dsh-video/a/ComfyUI"'), 'changes into the install dir')
    assert.ok(
        text.includes('"D:/dsh-video/a/python_embeded/python.exe" "D:/dsh-video/a/ComfyUI/main.py" "--listen" "127.0.0.1"'),
        'python + every argument quoted individually',
    )
    assert.ok(text.includes('> "D:/dsh-video/a/ComfyUI/.dshqp-launch.log" 2>&1'), 'redirects both streams')
})

check('batch: 中文/空格路径与 env 注入', () => {
    const text = buildWindowsBatch({
        python: 'C:/工具 目录/python.exe',
        args: ['C:/工具 目录/main 脚本.py'],
        workdir: 'C:/工具 目录',
        logPath: 'C:/工具 目录/日志.log',
        env: [
            ['HIP_VISIBLE_DEVICES', '0'],
            ['PYTHONIOENCODING', 'utf-8'],
        ],
    })
    assert.ok(text.includes('set "HIP_VISIBLE_DEVICES=0"'))
    assert.ok(text.includes('set "PYTHONIOENCODING=utf-8"'))
    assert.ok(text.includes('"C:/工具 目录/python.exe"'))
    // 引号不能被路径/环境值带进批处理（会破坏解析）
    assert.ok(!text.includes('""C:/'), 'no doubled quotes around paths')
})

check('vbs: ASCII 源 + SW_HIDE + 参数化路径', () => {
    assert.ok(/^[\x00-\x7F]*$/.test(HIDDEN_VBS), 'VBS must stay pure ASCII')
    assert.ok(HIDDEN_VBS.includes('WScript.Arguments(0)'), 'batch path travels as an argument')
    assert.ok(HIDDEN_VBS.includes('sh.Run "cmd.exe /c """ & cmdPath & """", 0, False'), 'SW_HIDE (0) + no wait')
    assert.ok(HIDDEN_VBS.includes('Option Explicit'))
})

check('pid: 0/负数不算存活，本进程算存活', () => {
    assert.equal(isProcessAlive(0), false)
    assert.equal(isProcessAlive(-1), false)
    assert.equal(isProcessAlive(process.pid), true)
})

const detectedPid = await findComfyPid()
check('findComfyPid: 非 Windows 返回 0，Windows 返回安全整数', () => {
    assert.equal(typeof detectedPid, 'number')
    assert.ok(Number.isSafeInteger(detectedPid) && detectedPid >= 0, 'pid must be a safe non-negative integer')
})

/* ───────────────────── 端口体检（lib/ports.js，2026-11-22）───────────────── */

check('ports: 只有本机地址才体检', () => {
    for (const host of ['127.0.0.1', 'localhost', '::1', '0.0.0.0']) assert.equal(isLocalHost(host), true, host)
    for (const host of ['192.168.1.9', 'comfy.example.com', '']) assert.equal(isLocalHost(host), false, host)
})

check('ports: endpointOfUrl 取 host/port，坏输入返回 null', () => {
    assert.deepEqual(endpointOfUrl('http://127.0.0.1:18088'), { host: '127.0.0.1', port: 18088 })
    assert.deepEqual(endpointOfUrl('http://localhost'), { host: 'localhost', port: 80 })
    assert.equal(endpointOfUrl('not a url'), null)
    assert.equal(endpointOfUrl(''), null)
})

check('ports: 失败原因带 Windows 错误号（10013 / 10048）', () => {
    assert.match(describeBindFailure('EACCES', 8188), /10013/)
    assert.match(describeBindFailure('EADDRINUSE', 8188), /10048/)
    assert.match(describeBindFailure('EACCES', 8188), /8188/)
})

await checkAsync('ports: bindTest 拒绝非法端口（不抛、不开 socket）', async () => {
    assert.equal((await bindTest('127.0.0.1', 0)).code, 'EINVALIDPORT')
    assert.equal((await bindTest('127.0.0.1', 70_000)).code, 'EINVALIDPORT')
})

await checkAsync('ports: 被系统保留（EACCES）时自动换到下一个可用端口', async () => {
    const plan = await resolveEndpoint({
        host: '127.0.0.1',
        port: 8188,
        bind: fakeBind({ 8188: { ok: false, code: 'EACCES' } }),
        probe: async () => ({ up: false }),
    })
    assert.equal(plan.requestedPort, 8188)
    assert.equal(plan.port, 8189)
    assert.equal(plan.changed, true)
    assert.equal(plan.code, 'EACCES')
    assert.match(plan.reason, /10013/)
})

await checkAsync('ports: 端口被占但应答的是 ComfyUI —— 不换端口', async () => {
    const plan = await resolveEndpoint({
        host: '127.0.0.1',
        port: 18088,
        bind: fakeBind({ 18088: { ok: false, code: 'EADDRINUSE' } }),
        probe: async () => ({ up: true, version: '0.42.3' }),
    })
    assert.equal(plan.port, 18088)
    assert.equal(plan.changed, false)
    assert.match(plan.reason, /ComfyUI/)
})

await checkAsync('ports: 端口被别的程序占着 —— 换端口', async () => {
    const plan = await resolveEndpoint({
        host: '127.0.0.1',
        port: 18088,
        bind: fakeBind({ 18088: { ok: false, code: 'EADDRINUSE' } }),
        probe: async () => ({ up: false }),
    })
    assert.equal(plan.port, 18089)
    assert.equal(plan.changed, true)
})

await checkAsync('ports: 往后一整段都被保留时如实报告，不静默失败', async () => {
    const failures = {}
    for (let port = 8188; port < 8192; port += 1) failures[port] = { ok: false, code: 'EACCES' }
    const plan = await resolveEndpoint({
        host: '127.0.0.1',
        port: 8188,
        scan: 3,
        bind: fakeBind(failures),
        probe: async () => ({ up: false }),
    })
    assert.equal(plan.changed, false)
    assert.equal(plan.port, 8188)
    assert.match(plan.reason, /都不可用/)
})

await checkAsync('ports: 默认扫描能跳出一整段 100 个被保留的端口（8188 → 8228）', async () => {
    // 真机就是这样：WinNAT 保留 8128–8227，配置在 8188，得往后跳过 40 个才到 8228。
    const failures = {}
    for (let port = 8188; port <= 8227; port += 1) failures[port] = { ok: false, code: 'EACCES' }
    const plan = await resolveEndpoint({
        host: '127.0.0.1',
        port: 8188,
        bind: fakeBind(failures),
        probe: async () => ({ up: false }),
    })
    assert.equal(plan.changed, true)
    assert.equal(plan.port, 8228)
})

check('ports: explainBindLog 从 traceback 尾部认出 10013 / 10048', () => {
    const traceback = [
        'Starting server',
        'Traceback (most recent call last):',
        "  File \"D:\\ComfyUI\\main.py\", line 671, in <module>",
        'PermissionError: [Errno 13] error while attempting to bind on address',
        "('127.0.0.1', 8188): [winerror 10013] 以一种访问权限不允许的方式做了一个访问套接字的尝试。",
    ]
    const denied = explainBindLog(traceback, 8188)
    assert.equal(denied.code, 'EACCES')
    assert.match(denied.message, /10013/)
    assert.ok(denied.advice.includes('excludedportrange'), 'advice must name the netsh command')

    const busy = explainBindLog(['OSError: [WinError 10048] address already in use'], 18088)
    assert.equal(busy.code, 'EADDRINUSE')
    assert.equal(explainBindLog(['All models loaded, starting server...'], 8188), null)
    assert.equal(explainBindLog([], 8188), null)
})

check('ports: 三块配置「本来就是同一个地址」才一起改', () => {
    const plan = { host: '127.0.0.1', requestedPort: 8188, port: 8189, changed: true, reason: 'x' }
    const aligned = alignSuiteConfig({
        comfyui: { baseUrl: 'http://127.0.0.1:8188', outputDir: 'out' },
        launcher: { port: 8188, host: '127.0.0.1' },
        qwenPaint: { comfyUrl: 'http://127.0.0.1:8188', steps: 8 },
        plan,
    })
    assert.equal(aligned.comfyui.baseUrl, 'http://127.0.0.1:8189')
    assert.equal(aligned.launcher.port, 8189)
    assert.equal(aligned.qwenPaint.comfyUrl, 'http://127.0.0.1:8189')
    // 与端口无关的字段必须原样保留
    assert.equal(aligned.comfyui.outputDir, 'out')
    assert.equal(aligned.qwenPaint.steps, 8)
    // 指到别处的块不许被"顺手改正"
    const split = alignSuiteConfig({
        comfyui: { baseUrl: 'http://192.168.1.9:8188' },
        launcher: { port: 8188 },
        qwenPaint: { comfyUrl: 'http://127.0.0.1:19000' },
        plan,
    })
    assert.equal(split.comfyui.baseUrl, 'http://192.168.1.9:8188', 'remote endpoint must stay untouched')
    assert.equal(split.qwenPaint.comfyUrl, 'http://127.0.0.1:19000', 'split endpoint must stay untouched')
    assert.equal(split.launcher.port, 8189, 'launcher always follows the plan')
    // 没换端口时一个字都不改（对象同一引用）
    const unchanged = alignSuiteConfig({
        comfyui: { baseUrl: 'http://127.0.0.1:8188' },
        launcher: { port: 8188 },
        qwenPaint: { comfyUrl: 'http://127.0.0.1:8188' },
        plan: { ...plan, changed: false },
    })
    assert.equal(unchanged.comfyui.baseUrl, 'http://127.0.0.1:8188')
})

await checkAsync('ports: planComfyEndpoint 一次算好「用哪个端口 + 三块长什么样」', async () => {
    const planned = await planComfyEndpoint(
        {
            comfyui: { baseUrl: 'http://127.0.0.1:8188' },
            launcher: { host: '127.0.0.1', port: 8188 },
            qwenPaint: { comfyUrl: 'http://127.0.0.1:8188' },
        },
        { bind: fakeBind({ 8188: { ok: false, code: 'EACCES' } }), probe: async () => ({ up: false }) },
    )
    assert.equal(planned.plan.changed, true)
    assert.equal(planned.plan.port, 8189)
    assert.equal(planned.launcher.port, 8189)
    assert.equal(planned.comfyui.baseUrl, 'http://127.0.0.1:8189')
    assert.equal(planned.qwenPaint.comfyUrl, 'http://127.0.0.1:8189')
})

/* ───────────────────── 启动前预检（hidden-launch）──────────────────────── */

check('launch: parseListenTarget 认得 --port/--listen 的两种写法', () => {
    assert.deepEqual(
        parseListenTarget(['main.py', '--port', '18088', '--listen', '127.0.0.1']),
        { host: '127.0.0.1', port: 18088 },
    )
    assert.deepEqual(parseListenTarget(['main.py', '--port=18099', '--listen=0.0.0.0']), { host: '0.0.0.0', port: 18099 })
    assert.equal(parseListenTarget(['main.py']).port, 0, 'no --port means "nothing to preflight"')
})

await checkAsync('launch: 预检把 EACCES 翻成一条能照做的错误', async () => {
    const result = await preflightTarget(['main.py', '--port', '8188', '--listen', '127.0.0.1'], {
        bind: async () => ({ ok: false, code: 'EACCES' }),
        probe: async () => ({ up: false }),
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'EACCES')
    assert.match(result.error, /10013/)
    assert.match(result.error, /启动已取消/)
})

await checkAsync('launch: 端口上已经有 ComfyUI 时判 EALREADYUP（不是失败）', async () => {
    const result = await preflightTarget(['main.py', '--port', '18088'], {
        bind: async () => ({ ok: false, code: 'EADDRINUSE' }),
        probe: async () => ({ up: true }),
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'EALREADYUP')
    assert.match(result.error, /已经在/)
})

console.log(`\n${passed} checks passed${process.exitCode ? ' — WITH FAILURES' : ''}`)