/**
 * dsh-comfyui-launcher — lifecycle companion for the portable ComfyUI that lives
 * under D:\dsh-video.
 *
 * dsh-comfyui already owns generation (workflow library, comfyui_workflow, the
 * media proxy). What it cannot do is start the server: the portable build needs
 * its embedded Python, the ROCm flags and the right working directory. This
 * plugin adds that missing half — one `comfyui_server` tool, a small REST
 * surface for the settings page, and a bundle patch that points dsh-comfyui's
 * `comfyuiDirs` at the same install.
 */
import { execFile, spawn } from 'node:child_process';
import { access, mkdir, open } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
// 2026-11-05: Windows 上改用套件的零窗口、脱离宿主启动（详见 lib/hidden-launch.js）。
// 旧实现用 spawn(windowsHide) —— 虽然也没有窗口，但子进程在 DSH 的作业对象里，
// 宿主一重启就被带走，于是每次都要再等一轮约 45 秒的冷启动。
import { launchComfyHidden, isProcessAlive, readRecordedPid } from '../../lib/hidden-launch.js';
import { suiteBridge } from '../../lib/bridge.js';

/** One-line receipt into the suite's boot.log; never allowed to break a start. */
function report(line) {
    try {
        suiteBridge.report(line);
    }
    catch {
        // ignore
    }
}

export const name = 'dsh-comfyui-launcher';

/** `tools` is the model-facing registry the fiber writes into. */
export const inject = ['tools'];

const DEFAULT_LOG_NAME = 'comfyui.log';

const DEFAULTS = {
    comfyuiDir: 'D:/dsh-video/a/ComfyUI',
    pythonPath: 'D:/dsh-video/a/python_embeded/python.exe',
    host: '127.0.0.1',
    port: 8188,
    // Same flags as D:\dsh-video\a\AutoLaunch_ComfyUI.bat, minus --auto-launch
    // (the launcher must not pop a browser tab) and minus --port/--listen.
    extraArgs: ['--reserve-vram', '1.0', '--gpu-only', '--enable-dynamic-vram', '--disable-pinned-memory'],
    hipVisibleDevices: '0',
    startupTimeoutMs: 180_000,
    stopTimeoutMs: 20_000,
    logPath: '',
    autoStart: false,
};

/** One managed child process, shared by every tool call and route in this fiber. */
let child = null;
/** Windows: the detached python pid (spawn() is not used there any more). */
let managedPid = 0;
let startedAt = 0;
let lastExit = null;
let startPromise = null;
let logHandle = null;

function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value, fallback) {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

function num(value, fallback, min, max) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max)
        return fallback;
    return Math.round(parsed);
}

function strList(value, fallback) {
    if (!Array.isArray(value))
        return fallback;
    const out = value.filter((item) => typeof item === 'string' && item !== '');
    return out.length > 0 ? out : fallback;
}

function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}

function delay(ms) {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
}

function defaultLogPath() {
    const home = str(process.env.DSH_HOME, join(homedir(), '.dsh'));
    return join(home, 'logs', 'comfyui-launcher', DEFAULT_LOG_NAME);
}

function resolveConfig(config) {
    const raw = isRecord(config) ? config : {};
    return {
        comfyuiDir: str(raw.comfyuiDir, DEFAULTS.comfyuiDir),
        pythonPath: str(raw.pythonPath, DEFAULTS.pythonPath),
        host: str(raw.host, DEFAULTS.host),
        port: num(raw.port, DEFAULTS.port, 1, 65_535),
        extraArgs: strList(raw.extraArgs, DEFAULTS.extraArgs),
        hipVisibleDevices: str(raw.hipVisibleDevices, DEFAULTS.hipVisibleDevices),
        startupTimeoutMs: num(raw.startupTimeoutMs, DEFAULTS.startupTimeoutMs, 5_000, 900_000),
        stopTimeoutMs: num(raw.stopTimeoutMs, DEFAULTS.stopTimeoutMs, 2_000, 120_000),
        logPath: str(raw.logPath, '') !== '' ? str(raw.logPath, '') : defaultLogPath(),
        autoStart: raw.autoStart === true,
    };
}

function baseUrl(cfg) {
    return `http://${cfg.host}:${cfg.port}`;
}

/** Ask /system_stats. Short by design: callers use it as a heartbeat. */
async function probe(cfg, timeoutMs = 1_500) {
    const startedProbe = Date.now();
    try {
        const response = await fetch(`${baseUrl(cfg)}/system_stats`, {
            signal: AbortSignal.timeout(timeoutMs),
            headers: { accept: 'application/json' },
        });
        if (!response.ok) {
            return { up: false, error: `HTTP ${response.status}`, latencyMs: Date.now() - startedProbe };
        }
        const data = await response.json();
        return { up: true, data, latencyMs: Date.now() - startedProbe };
    }
    catch (error) {
        return { up: false, error: errorMessage(error), latencyMs: Date.now() - startedProbe };
    }
}

function deviceInfo(data) {
    const devices = isRecord(data) && Array.isArray(data.devices) ? data.devices : [];
    const first = devices[0];
    if (!isRecord(first))
        return null;
    const info = {};
    if (typeof first.name === 'string' && first.name !== '')
        info.name = first.name;
    if (Number.isFinite(first.vram_total))
        info.vramTotalBytes = first.vram_total;
    if (Number.isFinite(first.vram_free))
        info.vramFreeBytes = first.vram_free;
    return Object.keys(info).length > 0 ? info : null;
}

function comfyVersion(data) {
    const system = isRecord(data) && isRecord(data.system) ? data.system : undefined;
    if (system === undefined)
        return undefined;
    for (const key of ['comfyui_version', 'comfy_version', 'version']) {
        const value = system[key];
        if (typeof value === 'string' && value !== '')
            return value;
    }
    return undefined;
}

async function status(cfg) {
    const heartbeat = await probe(cfg);
    const running = heartbeat.up;
    const spawnedManaged = child !== null && child.exitCode === null;
    const pidManaged = isProcessAlive(managedPid);
    // 2026-11-05: 预热（draw_image 路径）或上一轮 DSH 会话拉起的后端，同样属于本套件。
    // 只有"pid 回执里的进程确实是 8188 的监听者"才算认领 —— 否则 pid 可能已被复用。
    let adopted = 0;
    if (running && !spawnedManaged && !pidManaged) {
        const recorded = await readRecordedPid(cfg.comfyuiDir);
        if (recorded > 0 && isProcessAlive(recorded)) {
            const listener = await listenerPid(cfg.port);
            if (listener === recorded)
                adopted = recorded;
        }
    }
    const managed = spawnedManaged || pidManaged || adopted > 0;
    const value = {
        ok: true,
        running,
        managed,
        url: baseUrl(cfg),
        logPath: cfg.logPath,
    };
    if (managed) {
        value.pid = spawnedManaged ? child.pid ?? null : (adopted > 0 ? adopted : managedPid);
        if (adopted > 0)
            value.adopted = true;
        if (startedAt > 0)
            value.uptimeMs = Date.now() - startedAt;
    }
    if (running) {
        value.latencyMs = heartbeat.latencyMs;
        const version = comfyVersion(heartbeat.data);
        if (version !== undefined)
            value.comfyuiVersion = version;
        const device = deviceInfo(heartbeat.data);
        if (device !== null)
            value.device = device;
        if (!managed)
            value.foreign = true;
    }
    else if (heartbeat.error !== undefined) {
        value.error = heartbeat.error;
    }
    if (lastExit !== null)
        value.lastExit = lastExit;
    return value;
}

/** Read the last `maxLines` lines without loading a multi-megabyte log. */
async function readTail(path, maxLines, maxBytes = 64 * 1024) {
    let handle;
    try {
        handle = await open(path, 'r');
        const info = await handle.stat();
        const start = Math.max(0, info.size - maxBytes);
        const buffer = Buffer.alloc(info.size - start);
        await handle.read(buffer, 0, buffer.length, start);
        // ComfyUI writes ANSI-colored log lines; the escapes are noise in a
        // tool result and in the settings page's <pre>.
        const text = buffer.toString('utf8').replace(/\u001b\[[0-9;]*m/g, '');
        const lines = text.split(/\r?\n/);
        if (lines.length > 0 && lines[lines.length - 1] === '')
            lines.pop();
        return {
            lines: lines.slice(-maxLines),
            truncated: start > 0 || lines.length > maxLines,
        };
    }
    catch (error) {
        return { lines: [], truncated: false, error: errorMessage(error) };
    }
    finally {
        if (handle !== undefined)
            await handle.close().catch(() => { });
    }
}

function closeLogHandle() {
    if (logHandle !== null) {
        const handle = logHandle;
        logHandle = null;
        void handle.close().catch(() => { });
    }
}

async function fileExists(path) {
    try {
        await access(path);
        return true;
    }
    catch {
        return false;
    }
}

async function launch(cfg) {
    const mainPy = join(cfg.comfyuiDir, 'main.py');
    if (!(await fileExists(cfg.pythonPath))) {
        return { ok: false, action: 'start', error: `找不到便携版 Python：${cfg.pythonPath}` };
    }
    if (!(await fileExists(mainPy))) {
        return { ok: false, action: 'start', error: `找不到 ComfyUI 入口：${mainPy}` };
    }
    try {
        await mkdir(dirname(cfg.logPath), { recursive: true });
        // 2026-11-05: Windows 上**不要**自己持有日志句柄 —— 批处理用 `>` 重定向
        // 打开同一个文件，实测（00:0x 复现）宿主先以 'a' 打开会让 cmd 的重定向
        // 失败，批处理当场退出，python 根本起不来，而现象只是"180 秒没就绪"。
        // 这里只建目录；POSIX 的 spawn 仍需要 fd 接收 stdout/stderr。
        logHandle = process.platform === 'win32' ? null : await open(cfg.logPath, 'a');
    }
    catch {
        logHandle = null;
    }
    const extra = [];
    for (let index = 0; index < cfg.extraArgs.length; index += 1) {
        const token = cfg.extraArgs[index];
        if (token === '--port' || token === '--listen') {
            index += 1;
            continue;
        }
        extra.push(token);
    }
    const args = ['main.py', ...extra, '--port', String(cfg.port), '--listen', cfg.host];
    const env = {
        ...process.env,
        HIP_VISIBLE_DEVICES: cfg.hipVisibleDevices,
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8',
    };
    let spawned = null;
    let pid = null;
    let detached = false;
    try {
        if (process.platform === 'win32') {
            // 2026-11-05: 零窗口 + 脱离宿主启动。改完这一步，DSH 重启不会再带走
            // ComfyUI —— 下次宿主启动时 status 直接看到在线，省掉一轮冷启动。
            const launched = await launchComfyHidden({
                python: cfg.pythonPath,
                args,
                workdir: cfg.comfyuiDir,
                logPath: cfg.logPath,
                baseDir: cfg.comfyuiDir,
                env: [
                    ['HIP_VISIBLE_DEVICES', cfg.hipVisibleDevices],
                    ['PYTHONUNBUFFERED', '1'],
                    ['PYTHONIOENCODING', 'utf-8'],
                ],
            });
            if (!launched.ok)
                throw new Error(launched.error ?? '无法启动 ComfyUI');
            // 启动回执：跟套件的 boot.log 放在一起，出问题不必靠猜。
            report(`launcher: hidden via=${launched.via} pid=${launched.pid} launcher=${launched.launcherPid}`);
            managedPid = launched.pid;
            pid = launched.pid > 0 ? launched.pid : launched.launcherPid;
            detached = true;
            // 批处理自己做了输出重定向；这个 fd 不再需要。
            closeLogHandle();
        }
        else {
            spawned = spawn(cfg.pythonPath, args, {
                cwd: cfg.comfyuiDir,
                env,
                windowsHide: true,
                stdio: logHandle !== null ? ['ignore', logHandle.fd, logHandle.fd] : 'ignore',
            });
            child = spawned;
            pid = spawned.pid ?? null;
            spawned.once('error', (error) => {
                lastExit = { at: new Date().toISOString(), error: errorMessage(error) };
                if (child === spawned) {
                    child = null;
                    startedAt = 0;
                }
                closeLogHandle();
            });
            spawned.once('exit', (code, signal) => {
                lastExit = { at: new Date().toISOString(), code, signal };
                if (child === spawned) {
                    child = null;
                    startedAt = 0;
                }
                closeLogHandle();
            });
        }
    }
    catch (error) {
        closeLogHandle();
        report(`launcher: 启动失败 — ${errorMessage(error)}`);
        return { ok: false, action: 'start', error: `无法启动 Python：${errorMessage(error)}` };
    }
    startedAt = Date.now();
    lastExit = null;
    const deadline = Date.now() + cfg.startupTimeoutMs;
    while (Date.now() < deadline) {
        await delay(1_000);
        if (spawned !== null && (spawned.exitCode !== null || spawned.signalCode !== null)) {
            const tail = await readTail(cfg.logPath, 15);
            return {
                ok: false,
                action: 'start',
                error: 'ComfyUI 进程启动后立即退出，检查日志',
                lines: tail.lines,
                logPath: cfg.logPath,
            };
        }
        if (detached && managedPid > 0 && !isProcessAlive(managedPid)) {
            // One probe decides: a stale pid next to a live server is a resolution
            // race, not a crash. Only a dead pid + dead port counts as an exit.
            const after = await probe(cfg, 1_500);
            if (!after.up) {
                const tail = await readTail(cfg.logPath, 15);
                return {
                    ok: false,
                    action: 'start',
                    error: 'ComfyUI 进程启动后立即退出，检查日志',
                    lines: tail.lines,
                    logPath: cfg.logPath,
                };
            }
        }
        const heartbeat = await probe(cfg, 1_500);
        if (heartbeat.up) {
            const value = {
                ok: true,
                action: 'start',
                running: true,
                managed: true,
                url: baseUrl(cfg),
                pid,
                readyMs: Date.now() - startedAt,
                logPath: cfg.logPath,
            };
            const version = comfyVersion(heartbeat.data);
            if (version !== undefined)
                value.comfyuiVersion = version;
            const device = deviceInfo(heartbeat.data);
            if (device !== null)
                value.device = device;
            return value;
        }
    }
    const tail = await readTail(cfg.logPath, 15);
    return {
        ok: false,
        action: 'start',
        pending: true,
        error: `等待 ${Math.round(cfg.startupTimeoutMs / 1_000)} 秒仍未就绪；进程可能还在加载模型，稍后用 status 复查`,
        url: baseUrl(cfg),
        pid,
        logPath: cfg.logPath,
        lines: tail.lines,
    };
}

async function start(cfg) {
    const heartbeat = await probe(cfg, 1_200);
    if (heartbeat.up) {
        const current = await status(cfg);
        return { ...current, action: 'start', alreadyRunning: true };
    }
    if (startPromise !== null)
        return startPromise;
    startPromise = launch(cfg).finally(() => {
        startPromise = null;
    });
    return startPromise;
}

function waitExit(proc, timeoutMs) {
    if (proc.exitCode !== null || proc.signalCode !== null)
        return Promise.resolve(true);
    return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                resolve(false);
            }
        }, timeoutMs);
        proc.once('exit', () => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                resolve(true);
            }
        });
    });
}

async function killTree(pid) {
    if (process.platform === 'win32') {
        await new Promise((resolve) => {
            const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
                windowsHide: true,
                stdio: 'ignore',
            });
            killer.once('close', () => resolve());
            killer.once('error', () => resolve());
        });
        return;
    }
    try {
        process.kill(pid, 'SIGTERM');
    }
    catch {
        // The process already left; the probe below reports the truth.
    }
}

/** Run a short command and return its stdout; null when the command failed. */
function capture(command, args, timeoutMs = 5_000) {
    return new Promise((resolve) => {
        execFile(command, args, { windowsHide: true, timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error, stdout) => {
            resolve(error !== null ? null : String(stdout));
        });
    });
}

/** PID of the process LISTENING on a local TCP port, from `netstat -ano`. */
async function listenerPid(port) {
    if (process.platform !== 'win32')
        return null;
    const output = await capture('netstat', ['-ano', '-p', 'tcp']);
    if (output === null)
        return null;
    const suffix = `:${port}`;
    for (const line of output.split(/\r?\n/)) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5 || parts[0].toUpperCase() !== 'TCP')
            continue;
        if (!parts[1].endsWith(suffix) || parts[3].toUpperCase() !== 'LISTENING')
            continue;
        const pid = Number(parts[4]);
        if (Number.isInteger(pid) && pid > 0)
            return pid;
    }
    return null;
}

async function stop(cfg) {
    const proc = child !== null && child.exitCode === null ? child : null;
    // 2026-11-05: Windows 走的是脱离式启动，没有 child 句柄 —— 按维护的 python
    // pid 结束整棵树。这也覆盖"还在启动、端口尚未应答"的状态。
    if (proc === null && isProcessAlive(managedPid)) {
        const pid = managedPid;
        await killTree(pid);
        managedPid = 0;
        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
            const after = await probe(cfg, 800);
            if (!after.up)
                return { ok: true, action: 'stop', stopped: true, pid, url: baseUrl(cfg) };
            await delay(500);
        }
        return { ok: false, action: 'stop', error: '停止请求已发出，但端口仍有响应', pid, url: baseUrl(cfg) };
    }
    if (proc === null) {
        const heartbeat = await probe(cfg, 1_500);
        if (!heartbeat.up)
            return { ok: true, action: 'stop', alreadyStopped: true, url: baseUrl(cfg) };
        // The port answers ComfyUI's /system_stats but this fiber owns no child:
        // the server was started elsewhere, or it outlived a DSH restart. Stop
        // it by its listening PID — /system_stats answering is the proof that
        // the listener really is ComfyUI, not some unrelated process.
        const pid = await listenerPid(cfg.port);
        if (pid === null) {
            return {
                ok: false,
                action: 'stop',
                error: '端口有响应，但 netstat 没有给出监听 PID，无法停止',
                url: baseUrl(cfg),
            };
        }
        await killTree(pid);
        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
            const after = await probe(cfg, 800);
            if (!after.up)
                return { ok: true, action: 'stop', stopped: true, pid, external: true, url: baseUrl(cfg) };
            await delay(500);
        }
        return { ok: false, action: 'stop', error: '停止请求已发出，但端口仍有响应', pid, url: baseUrl(cfg) };
    }
    const pid = proc.pid ?? 0;
    await killTree(pid);
    await waitExit(proc, cfg.stopTimeoutMs);
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
        const heartbeat = await probe(cfg, 800);
        if (!heartbeat.up) {
            return { ok: true, action: 'stop', stopped: true, pid, url: baseUrl(cfg) };
        }
        await delay(500);
    }
    return { ok: false, action: 'stop', error: '停止请求已发出，但端口仍有响应', pid, url: baseUrl(cfg) };
}

function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms < 0)
        return '';
    const seconds = Math.floor(ms / 1_000);
    if (seconds < 60)
        return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)
        return `${minutes}m${seconds % 60 > 0 ? ` ${seconds % 60}s` : ''}`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0)
        return '';
    const gib = bytes / (1024 ** 3);
    return gib >= 1 ? `${gib.toFixed(1)} GiB` : `${(bytes / (1024 ** 2)).toFixed(0)} MiB`;
}

function renderText(value) {
    if (!isRecord(value))
        return 'ComfyUI: 无结果';
    const lines = [];
    const action = typeof value.action === 'string' ? value.action : 'status';
    if (action === 'logs') {
        lines.push(`ComfyUI 日志 · ${value.logPath ?? ''}${value.truncated === true ? '（尾部，已截断）' : ''}`);
        if (typeof value.note === 'string')
            lines.push(value.note);
        const entries = Array.isArray(value.lines) ? value.lines : [];
        lines.push(...(entries.length > 0 ? entries : ['（空）']));
        return lines.join('\n');
    }
    if (value.ok !== true) {
        lines.push(`${action === 'start' ? '启动' : action === 'stop' ? '停止' : '状态'}失败：${value.error ?? '未知错误'}`);
        if (typeof value.logPath === 'string' && value.logPath !== '')
            lines.push(`日志：${value.logPath}`);
        const entries = Array.isArray(value.lines) ? value.lines : [];
        if (entries.length > 0) {
            lines.push('日志尾部：');
            lines.push(...entries);
        }
        return lines.join('\n');
    }
    const running = value.running === true;
    if (action === 'start' && value.alreadyRunning === true) {
        lines.push(`ComfyUI 已经在运行：${value.url ?? ''}${typeof value.pid === 'number' ? ` · PID ${value.pid}` : ''}`);
    }
    else if (action === 'start') {
        lines.push(`ComfyUI 已启动：${value.url ?? ''}${typeof value.pid === 'number' ? ` · PID ${value.pid}` : ''}${Number.isFinite(value.readyMs) ? ` · 用时 ${formatDuration(value.readyMs)}` : ''}`);
    }
    else if (action === 'stop') {
        lines.push(value.alreadyStopped === true
            ? 'ComfyUI 本来就未运行'
            : `ComfyUI 已停止${typeof value.pid === 'number' ? ` · PID ${value.pid}` : ''}${value.external === true ? '（外部进程）' : ''}`);
    }
    else {
        const state = running ? '运行中' : '未运行';
        const managed = value.managed === true ? '启动器持有进程' : running ? '外部进程' : '启动器未持有进程';
        lines.push(`ComfyUI：${state} · ${managed}`);
        if (running)
            lines.push(`地址：${value.url ?? ''}${Number.isFinite(value.latencyMs) ? ` · 响应 ${value.latencyMs}ms` : ''}`);
        if (typeof value.pid === 'number')
            lines.push(`PID：${value.pid}`);
        if (Number.isFinite(value.uptimeMs))
            lines.push(`已运行：${formatDuration(value.uptimeMs)}`);
        if (typeof value.comfyuiVersion === 'string')
            lines.push(`版本：${value.comfyuiVersion}`);
        if (isRecord(value.device)) {
            const vram = formatBytes(value.device.vramTotalBytes);
            lines.push(`显卡：${value.device.name ?? '未知'}${vram !== '' ? ` · 显存 ${vram}` : ''}`);
        }
        if (!running && typeof value.error === 'string')
            lines.push(`未连通原因：${value.error}`);
    }
    if (typeof value.logPath === 'string' && value.logPath !== '')
        lines.push(`日志：${value.logPath}`);
    return lines.join('\n');
}

function serverTool(runtime) {
    return {
        name: 'comfyui_server',
        description: 'SECONDARY tool: lifecycle only. `status` reports whether the local ComfyUI answers, its address, PID and GPU; `start` launches the portable install (D:\\dsh-video\\a) in the background and waits until it answers; `stop` ends the process it started, and when the port answers without a managed child (for example a server that outlived a DSH restart) it ends the process listening on that port; `logs` returns the tail of its log file. Generating content stays with comfyui_workflow — this tool never queues prompts.',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['status', 'start', 'stop', 'logs'],
                    description: 'status (default) · start · stop · logs',
                },
                lines: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 200,
                    description: 'Log lines for action "logs" (default 40).',
                },
            },
            required: ['action'],
            additionalProperties: false,
        },
        output: {
            schema: { type: 'object' },
            render(_args, value) {
                return [{ type: 'text', text: renderText(value) }];
            },
        },
        timeoutMs: 300_000,
        isConcurrencySafe: () => false,
        async execute(args) {
            const input = isRecord(args) ? args : {};
            const action = typeof input.action === 'string' ? input.action : 'status';
            const cfg = runtime.getConfig();
            if (action === 'start') {
                return await start(cfg);
            }
            if (action === 'stop') {
                return await stop(cfg);
            }
            if (action === 'logs') {
                const count = num(input.lines, 40, 1, 200);
                const tail = await readTail(cfg.logPath, count);
                const value = {
                    ok: true,
                    action: 'logs',
                    logPath: cfg.logPath,
                    lines: tail.lines,
                    truncated: tail.truncated === true,
                };
                if (typeof tail.error === 'string')
                    value.note = `（读取失败：${tail.error}）`;
                return value;
            }
            return await status(cfg);
        },
    };
}

function sendJson(response, statusCode, body) {
    response.writeHead(statusCode, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
    });
    response.end(JSON.stringify(body));
}

async function readBody(request) {
    const chunks = [];
    for await (const chunk of request)
        chunks.push(chunk);
    const text = Buffer.concat(chunks).toString('utf8');
    if (text === '')
        return {};
    try {
        const parsed = JSON.parse(text);
        return isRecord(parsed) ? parsed : {};
    }
    catch {
        return {};
    }
}

function sameOrigin(request) {
    const origin = request.headers.origin;
    const host = request.headers.host;
    if (origin === undefined)
        return true;
    if (host === undefined)
        return false;
    return origin === `http://${host}` || origin === `https://${host}`;
}

function mountRoutes(webCtx, runtime) {
    const webServer = webCtx.get('webServer');
    if (webServer === undefined)
        return () => { };
    const disposers = [];
    /** DSH 路由准入：Host/Origin fence + 浏览器认证；服务缺失时降级放行。 */
    const rejected = (request, response) => {
        const connection = webCtx.get?.('connection') ?? webCtx.connection;
        const rejection = connection?.requestRejection?.(request);
        if (rejection === undefined)
            return false;
        response.statusCode = rejection;
        response.end();
        return true;
    };

    const register = (path, handler) => {
        disposers.push(webServer.register({
            kind: 'exact',
            path,
            handler: async (request, response) => {
                if (rejected(request, response))
                    return;
                try {
                    await handler(request, response);
                }
                catch (error) {
                    sendJson(response, 500, { ok: false, error: errorMessage(error) });
                }
            },
        }));
    };
    const guard = (request, response) => {
        if (sameOrigin(request))
            return true;
        sendJson(response, 403, { ok: false, error: 'forbidden: same-origin requests only' });
        return false;
    };
    register('/comfyui-launcher/status', async (request, response) => {
        if (request.method !== 'GET') {
            sendJson(response, 405, { ok: false, error: 'method not allowed' });
            return;
        }
        sendJson(response, 200, await status(runtime.getConfig()));
    });
    register('/comfyui-launcher/start', async (request, response) => {
        if (request.method !== 'POST') {
            sendJson(response, 405, { ok: false, error: 'method not allowed' });
            return;
        }
        if (!guard(request, response))
            return;
        await readBody(request);
        const result = await start(runtime.getConfig());
        sendJson(response, result.ok === true ? 200 : 409, result);
    });
    register('/comfyui-launcher/stop', async (request, response) => {
        if (request.method !== 'POST') {
            sendJson(response, 405, { ok: false, error: 'method not allowed' });
            return;
        }
        if (!guard(request, response))
            return;
        await readBody(request);
        const result = await stop(runtime.getConfig());
        sendJson(response, result.ok === true ? 200 : 409, result);
    });
    register('/comfyui-launcher/logs', async (request, response) => {
        if (request.method !== 'GET') {
            sendJson(response, 405, { ok: false, error: 'method not allowed' });
            return;
        }
        const cfg = runtime.getConfig();
        const url = new URL(request.url ?? '/', 'http://localhost');
        const count = num(url.searchParams.get('lines'), 40, 1, 200);
        const tail = await readTail(cfg.logPath, count);
        const value = { ok: true, logPath: cfg.logPath, lines: tail.lines, truncated: tail.truncated === true };
        if (typeof tail.error === 'string')
            value.note = tail.error;
        sendJson(response, 200, value);
    });
    return () => {
        for (const dispose of disposers)
            dispose();
    };
}

export function apply(ctx, config) {
    const resolved = resolveConfig(config);
    const runtime = { getConfig: () => resolved };
    ctx.effect(() => {
        const dispose = ctx.tools.register(serverTool(runtime));
        return () => dispose();
    }, 'dsh-comfyui-launcher: comfyui_server');
    // Routes ride a `webServer` sub-fiber: loader rows settle concurrently, so a
    // one-shot ctx.get at apply time would skip the mount whenever the web
    // server activates later. A headless host simply never activates it.
    ctx.inject(['webServer'], (webCtx) => {
        webCtx.effect(() => mountRoutes(webCtx, runtime), 'dsh-comfyui-launcher: routes');
    });
    if (resolved.autoStart) {
        void start(resolved).catch(() => { });
    }
}