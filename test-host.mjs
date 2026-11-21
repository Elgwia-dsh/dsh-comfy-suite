/**
 * 宿主侧冒烟测试（不启动 DSH）。
 *
 * 覆盖四件事，都是这个合并包真正会出错的地方：
 *   1. 三个子插件各挂一次，合计注册 14 个工具；
 *   2. 某个工具注册失败时，其余工具照常注册，失败原因进启动回执
 *      （2026-11-04 事故：热重载时 4 个 comfyui_* 静默消失）；
 *   3. 启动回执里的 tools audit 能看出缺了哪个工具；
 *   4. 设置写入走 `update('comfy-suite', {块: patch})` 并把刷新扇出给子插件。
 *
 * 全程用临时 DSH_HOME，不碰真实数据目录。
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const home = await mkdtemp(join(tmpdir(), 'dsh-suite-test-'));
process.env.DSH_HOME = home;

const suite = await import(new URL('./lib/index.js', import.meta.url));
const { suiteBridge } = await import(new URL('./lib/bridge.js', import.meta.url));
const { getPortPlan } = await import(new URL('./lib/ports.js', import.meta.url));

const EXPECTED = [
    'comfyui_workflow', 'comfyui_skill', 'comfyui_object_info', 'comfyui_run',
    'comfyui_server', 'draw_image', 'inpaint_image', 'upscale_image',
    // ★ 2026-11-12：扩图（借鉴 9 步整合画布的「图像扩展」支路）
    'outpaint_image',
    // ★ 2026-11-12：捏人 / 换装（GHIL 素材库）
    'character_image',
    'list_available_models', 'check_acceleration',
    // 套件自己注册的：风格库检索 + 提示词衣柜
    'image_presets',
    'prompt_wardrobe',
];

/**
 * Mount the suite once against a registry that may refuse selected names.
 * @param {object} options
 * @param {Set<string>} [options.refuse] tool names whose register() throws
 * @param {number} [options.port] launcher port (and the port both URLs point at)
 */
function mount({ refuse = new Set(), port = 8188 } = {}) {
    const registered = new Map();
    const childConfigs = new Map();
    const effects = [];
    const events = [];
    const writes = [];
    const refreshes = [];

    const fakeSettings = {
        writable: true,
        configure(policy, owner) {
            effects.push(['configure', policy, owner !== undefined]);
            return () => { };
        },
        async update(ns, patch) {
            writes.push([ns, patch]);
        },
    };

    function makeTools(label) {
        return {
            register(definition) {
                if (refuse.has(definition.name)) {
                    throw new Error(`duplicate tool name "${definition.name}"`);
                }
                registered.set(definition.name, label);
                return () => registered.delete(definition.name);
            },
            get(name) {
                return registered.has(name) ? { name } : undefined;
            },
        };
    }

    function makeCtx(label) {
        const ctx = {
            fiber: { id: label },
            get(name) {
                return name === 'settings' ? fakeSettings : undefined;
            },
            on(name, handler) {
                events.push([label, name, handler]);
                return () => { };
            },
            effect(fn, effectLabel) {
                effects.push([label, effectLabel, fn()]);
                return () => { };
            },
            inject(deps, callback) {
                if (deps.includes('settings')) {
                    callback({
                        settings: fakeSettings,
                        effect: (fn, effectLabel) => effects.push([label, effectLabel, fn()]),
                    });
                }
                return { then() { } };
            },
            plugin(plugin, config) {
                const child = `${label}/${plugin.name ?? '?'}`;
                childConfigs.set(plugin.name ?? child, config);
                const result = plugin.apply(makeCtx(child), config);
                return result !== null && typeof result === 'object' && typeof result.then === 'function'
                    ? { then() { } }
                    : { then() { } };
            },
        };
        Object.defineProperty(ctx, 'tools', { get: () => makeTools(label) });
        return ctx;
    }

    const config = {
        comfyui: { baseUrl: `http://127.0.0.1:${port}`, dataDir: join(home, 'comfyui-data') },
        launcher: { host: '127.0.0.1', port },
        qwenPaint: { comfyUrl: `http://127.0.0.1:${port}`, steps: 8 },
    };

    const ctx = makeCtx('suite');
    suite.apply(ctx, config);
    return { registered, childConfigs, effects, events, writes, refreshes, ctx };
}

// ── 1. 正常挂载：10 个工具全在 ──────────────────────────────────────────
{
    const { registered } = mount();
    await new Promise((resolve) => setTimeout(resolve, 4_000));
    const names = [...registered.keys()].sort();
    assert.deepEqual(names, [...EXPECTED].sort(), `tool set mismatch: ${names.join(', ')}`);
    console.log(`ok - ${names.length}/${EXPECTED.length} tools registered`);
}

// ── 2. 一个工具注册失败：其余 9 个照常，回执点名失败项 ─────────────────
{
    const { registered } = mount({ refuse: new Set(['comfyui_workflow']) });
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(registered.has('comfyui_workflow'), false);
    for (const name of EXPECTED.filter((n) => n !== 'comfyui_workflow')) {
        assert.equal(registered.has(name), true, `${name} should survive a sibling failure`);
    }
    // comfyui 的注册回执：tools 3/4, failed — comfyui_workflow: duplicate ...
    const boot = await readFile(join(home, 'data', 'dsh-comfy-suite', 'boot.log'), 'utf8');
    assert.match(boot, /comfyui: tools 3\/4/, 'boot receipt must name the partial tool set');
    assert.match(boot, /comfyui_workflow/, 'boot receipt must name the failed tool');
    console.log('ok - one failed registration leaves the other nine alive and is reported');
}

// ── 3. 启动回执的 tools audit ───────────────────────────────────────────
{
    const boot = await readFile(join(home, 'data', 'dsh-comfy-suite', 'boot.log'), 'utf8');
    assert.match(boot, /tools audit: 14\/14 present/, `audit line missing:\n${boot}`);
    assert.match(boot, /comfyui: tools 4\/4/, 'per-child tool receipt missing');
    console.log('ok - boot receipt reports the live tool audit');
}

// ── 4. 设置写入：命名空间、patch 形状、刷新扇出 ─────────────────────────
{
    const { ctx } = mount();
    await new Promise((resolve) => setTimeout(resolve, 50));

    let fannedOut = 0;
    suiteBridge.register('comfyui', () => { fannedOut += 1; });

    const result = await suiteBridge.update('comfyui', { baseUrl: 'http://127.0.0.1:9999' });
    assert.deepEqual(result, { ok: true });
    assert.equal(fannedOut, 1, 'a settings write must refresh the written block');

    // 失败路径：settings.update 抛错时返回 {ok:false,error}，不抛出。
    const restore = suiteBridge.update;
    suiteBridge.update = async () => ({ ok: false, error: 'x' });
    assert.deepEqual(await suiteBridge.update('comfyui', {}), { ok: false, error: 'x' });
    suiteBridge.update = restore;
    void ctx;
    console.log('ok - settings writes target comfy-suite and fan out a refresh');
}

// ── 5. 端口体检：配置端口被占（且不是 ComfyUI）时，三块一起换端口 ──────
// 2026-11-21 事故的回归测试：8188 落在 WinNAT 保留区间，三块配置各说各的，
// 结果是 14 个工具全废、报错只有"进程启动后立即退出"。
{
    // 一个只会回 404 的 HTTP 服务：探测会立刻判定"不是 ComfyUI"，测试不必等超时。
    // `connection: close` + 主动 destroy 是必须的 —— 否则 fetch 留下的 keep-alive
    // 连接会让 server.close() 永远等不到回调，测试进程卡在 top-level await 上。
    const sockets = new Set();
    const blocker = createServer((socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
        socket.on('error', () => { });
        socket.end('HTTP/1.1 404 Not Found\r\ncontent-length: 0\r\nconnection: close\r\n\r\n');
    });
    await new Promise((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    const blocked = blocker.address().port;
    try {
        const { childConfigs } = mount({ port: blocked });
        await new Promise((resolve) => setTimeout(resolve, 800));

        const launcherCfg = childConfigs.get('dsh-comfyui-launcher');
        const comfyuiCfg = childConfigs.get('dsh-comfyui');
        const paintCfg = childConfigs.get('qwen-paint');
        assert.ok(launcherCfg !== undefined, 'launcher child must mount');
        assert.ok(comfyuiCfg !== undefined, 'comfyui child must mount');
        assert.ok(paintCfg !== undefined, 'qwen-paint child must mount');

        assert.notEqual(launcherCfg.port, blocked, 'a blocked port must be replaced');
        assert.ok(launcherCfg.port > blocked, `expected a port after ${blocked}, got ${launcherCfg.port}`);
        assert.equal(comfyuiCfg.baseUrl, `http://127.0.0.1:${launcherCfg.port}`, 'comfyui.baseUrl must follow');
        assert.equal(paintCfg.comfyUrl, `http://127.0.0.1:${launcherCfg.port}`, 'qwenPaint.comfyUrl must follow');

        const plan = getPortPlan();
        assert.equal(plan.requestedPort, blocked, 'the plan must remember what the config asked for');
        assert.equal(plan.port, launcherCfg.port);
        assert.equal(plan.changed, true);
        console.log(`ok - blocked port ${blocked} replaced by ${plan.port} across all three blocks`);
    }
    finally {
        for (const socket of sockets) socket.destroy();
        await new Promise((resolve) => blocker.close(() => resolve()));
    }
}

console.log('OK host smoke test passed');
// 子插件会留下空闲关停定时器与进度 WebSocket；测试进程显式退出。
process.exit(0);
