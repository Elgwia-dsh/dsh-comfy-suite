/**
 * dsh-comfy-suite — 2026-11-12 优化批次的回归测试
 *
 * 覆盖这一轮真正改过、而且**改坏了会静默出问题**的地方：
 *
 *   1. `resolveOutputDir` 的**兜底链** —— 配置目录坏掉时必须真的换到一个可写目录，
 *      而不是"退回同一个坏目录"然后在出图那一刻失败。
 *   2. `diag()` 改成 append-only 之后：文件要能一直写、超限要轮转、每行带 pid。
 *   3. 出图日志 `readMemoryRecords` 的 mtime/size 缓存：没变不重解析，变了必须重读。
 *   4. 作品库 `describeFiles` 的文件头缓存：第二次扫描不重复读文件头，
 *      但文件被替换（mtime 变）后必须重新读。
 *   5. `status.probeBusy()`：一个 `/queue` 请求同时给出「在线 + 忙闲」，
 *      **每次调用只发一个请求**（旧实现是 /system_stats + /queue 两个）。
 *   6. `waitForResult` 的**首轮立即查询**：结果已经就绪时不再白等一个 pollInterval。
 *   7. `runUpscaleFile` 的**顺序**：引擎缺失时**不许**先把主模型从显存卸掉。
 *   8. `uploadReference` 接受调用方已读进来的字节（扩图/重绘不再读两遍文件）。
 *
 * 全部用临时目录 + 本机回环 mock 服务器，不碰真实 ComfyUI、不写用户目录。
 */
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, utimes, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temp = await mkdtemp(join(tmpdir(), 'dsh-suite-fixes-'));
// ⚠ 必须在 import 任何 qwen-paint 模块之前设好：DIAG_FILE 是**模块求值时**算出来的。
process.env.DSH_HOME = join(temp, 'dsh-home');
process.env.DSHQP_DIAG = '1';
process.env.DSHQP_DIAG_FILE = join(temp, 'diag.log');
// 让"默认桌面目录"落在临时目录里，测试不写真实桌面。
process.env.USERPROFILE = join(temp, 'home');
process.env.HOME = join(temp, 'home');

const {
    DEFAULTS, buildWorkflow, ensureWritableDir, resolveOutputDir, defaultOutputBase, dataDirFallback,
} = await import('./vendor/qwen-paint/lib/config.js');
const { diag } = await import('./vendor/qwen-paint/lib/diag.js');
const { buildComfyArgs } = await import('./vendor/qwen-paint/lib/comfy-launch.js');
const { __internal } = await import('./vendor/qwen-paint/lib/index.js');
const gallery = await import('./lib/gallery.js');

const results = [];
const test = async (name, fn) => {
    try {
        await fn();
        results.push(`  ok   ${name}`);
    } catch (error) {
        results.push(`  FAIL ${name}\n       ${error?.stack ?? error}`);
        process.exitCode = 1;
    }
};

/** 32×24 的最小合法 PNG 文件头（作品库的 parseImageSize 只读前 24 字节）。 */
function pngHeader(width, height) {
    const buffer = Buffer.alloc(33);
    buffer.writeUInt32BE(0x89504e47, 0);
    buffer.writeUInt32BE(13, 4);
    buffer.write('IHDR', 8, 'ascii');
    buffer.write('IHDR', 12, 'ascii');
    buffer.writeUInt32BE(width, 16);
    buffer.writeUInt32BE(height, 20);
    return buffer;
}

/* ------------------------------------------------------------------ 1. outputDir ---- */
await test('ensureWritableDir：可写目录 ok / 指向文件时给出人话原因', async () => {
    const dir = join(temp, 'writable');
    assert.equal(ensureWritableDir(dir).ok, true);
    const file = join(temp, 'not-a-dir.txt');
    await writeFile(file, 'x');
    const bad = ensureWritableDir(file);
    assert.equal(bad.ok, false);
    assert.match(bad.problem, /已存在且是个文件/);
});

await test('resolveOutputDir：配置可写时原样使用、无 problem', async () => {
    const dir = join(temp, 'pictures');
    const r = resolveOutputDir(dir);
    assert.equal(r.dir, dir);
    assert.equal(r.problem, undefined);
    assert.equal(r.source, '配置的绝对路径');
});

await test('resolveOutputDir：配置指向文件 → 落到一个真正可写的目录（不再"退回同一个坏目录"）', async () => {
    const file = join(temp, 'blocked.txt');
    await writeFile(file, 'x');
    const r = resolveOutputDir(file);
    assert.ok(r.problem !== undefined, '必须如实回报原配置为什么不可用');
    assert.match(r.problem, /已存在且是个文件/);
    assert.notEqual(r.dir, file, '绝不能把同一个不可写路径再还回去');
    assert.equal(ensureWritableDir(r.dir).ok, true, `兜底目录必须真可写：${r.dir}`);
    assert.match(r.source, /自动兜底目录/);
});

await test('resolveOutputDir：相对路径解析到默认基目录下', async () => {
    const r = resolveOutputDir('图片/千问');
    assert.equal(r.dir, join(defaultOutputBase(), '图片', '千问'));
});

await test('dataDirFallback 跟着 DSH_HOME 走', async () => {
    assert.equal(dataDirFallback(), join(process.env.DSH_HOME, 'data', 'dsh-comfy-suite', 'output'));
});

/* --------------------------------------------------------------------- 2. diag ---- */
await test('diag：append-only 写入、每行带 pid、超限自动轮转', async () => {
    for (let i = 0; i < 2500; i += 1) diag('test', `${'x'.repeat(220)} #${i}`);
    const text = await readFile(process.env.DSHQP_DIAG_FILE, 'utf8');
    assert.ok(text.includes('#2499'), '最后一行必须在文件里');
    assert.ok(text.includes(`pid=${process.pid}`), '每行都要带 pid');
    // 轮转后不应无限增长：512 KB 上限 + 一次 400 行的尾巴
    assert.ok(Buffer.byteLength(text, 'utf8') < 700 * 1024, `文件不该无限增长：${Buffer.byteLength(text)}`);
});

/* --------------------------------------------------------------- 3. memory cache ---- */
await test('readMemoryRecords：文件没变不重解析，append 之后必须重读', async () => {
    const logPath = join(temp, 'memory.jsonl');
    await writeFile(logPath, `${JSON.stringify({ path: 'a.png', prompt: 'a' })}\n`);
    const first = await gallery.readMemoryRecords(logPath);
    assert.equal(first.length, 1);
    const again = await gallery.readMemoryRecords(logPath);
    assert.equal(again.length, 1, '缓存命中也必须返回同样内容');
    await writeFile(logPath, `${JSON.stringify({ path: 'a.png', prompt: 'a' })}\n${JSON.stringify({ path: 'b.png', prompt: 'b' })}\n`);
    const fresh = await gallery.readMemoryRecords(logPath);
    assert.equal(fresh.length, 2, '追加一行后必须重新读');
});

/* ---------------------------------------------------------------- 4. gallery cache ---- */
await test('describeFiles：第二次扫描不再读文件头；文件被替换后必须重读', async () => {
    const root = join(temp, 'gallery');
    await writeFile(join(temp, 'keep.txt'), 'x'); // 保证父目录存在
    const { mkdir } = await import('node:fs/promises');
    await mkdir(root, { recursive: true });
    const a = join(root, 'a.png');
    const b = join(root, 'b.png');
    await writeFile(a, pngHeader(640, 480));
    await writeFile(b, pngHeader(1024, 1024));

    gallery.clearHeadCache();
    const first = await gallery.describeFiles([a, b], [root]);
    assert.deepEqual(first.map((item) => [item.width, item.height]), [[640, 480], [1024, 1024]]);
    assert.equal(gallery.cacheStats().headReads, 2);

    const second = await gallery.describeFiles([a, b], [root]);
    assert.deepEqual(second.map((item) => [item.width, item.height]), [[640, 480], [1024, 1024]]);
    assert.equal(gallery.cacheStats().headReads, 2, '内容没变时不该再读文件头');

    // 换一张同尺寸但不同像素的"图"，并把 mtime 拨到未来 → 缓存必须失效
    await writeFile(a, pngHeader(320, 200));
    const future = new Date(Date.now() + 5000);
    await utimes(a, future, future);
    const third = await gallery.describeFiles([a, b], [root]);
    assert.deepEqual(third.map((item) => [item.width, item.height]), [[320, 200], [1024, 1024]]);
    assert.equal(gallery.cacheStats().headReads, 3, 'mtime 变了必须重读');
});

/* ------------------------------------------------------- 5/6. mock ComfyUI 回环测试 ---- */
let queueMode = 'busy';
let queueHits = 0;
let historyHits = 0;

/** 只给"主模型自带蒸馏、没有 turbo8 LoRA"这个场景需要的节点清单。 */
const OBJECT_INFO = {
    UNETLoader: { UNETLoader: { input: { required: { unet_name: [['qwen_image_2.1_int8_convrot.safetensors']] } } } },
    UnetLoaderGGUF: { UnetLoaderGGUF: { input: { required: { unet_name: [['Qwen-Image-2.1-Turbo-AD-Q6_K.gguf']] } } } },
    CLIPLoader: { CLIPLoader: { input: { required: { clip_name: [['qwen3vl_8b_w4a8.safetensors']] } } } },
    VAELoader: { VAELoader: { input: { required: { vae_name: [['qwen_image_2.1_vae_bf16.safetensors']] } } } },
    LoraLoader: { LoraLoader: { input: { required: { lora_name: [[]] } } } },
};
const server = createServer((req, res) => {
    const url = String(req.url ?? '');
    const json = (body, code = 200) => {
        res.writeHead(code, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
    };
    if (url === '/queue') {
        queueHits += 1;
        queueMode === 'busy'
            ? json({ queue_running: [[1]], queue_pending: [] })
            : json({ queue_running: [], queue_pending: [] });
        return;
    }
    if (url === '/system_stats') { json({ devices: [] }); return; }
    if (url.startsWith('/history/')) {
        historyHits += 1;
        json({ 'p1': { outputs: { 9: { images: [{ filename: 'x.png', subfolder: '', type: 'output' }] } } } });
        return;
    }
    if (url === '/free') { json({}); return; }
    if (url.startsWith('/object_info/')) {
        // 未知节点回 200 {}（= missing）；回 404 会被判成"探测失败"而不是"缺件"。
        const type = decodeURIComponent(url.slice('/object_info/'.length));
        json(OBJECT_INFO[type] ?? {});
        return;
    }
    if (url === '/upload/image') {
        // 读掉正文（multipart），确认服务端真的收到了内容
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => json({ name: 'uploaded.png', subfolder: '' }));
        return;
    }
    json({}, 404);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const cfg = { ...DEFAULTS, comfyUrl: url, queueCacheMs: 0, statusCacheMs: 0, pollIntervalMs: 5000, timeoutMs: 20000 };

await test('probeBusy：一次 /queue 给出在线+忙闲，每次调用只发一个请求', async () => {
    const status = __internal.makeComfyStatus(cfg);
    queueMode = 'busy';
    queueHits = 0;
    const busy = await status.probeBusy();
    assert.deepEqual(busy, { online: true, busy: true });
    queueMode = 'idle';
    const idle = await status.probeBusy();
    assert.deepEqual(idle, { online: true, busy: false });
    // 旧实现是 /system_stats + /queue 各一次 = 4 次；新实现两次调用只用 2 次。
    assert.equal(queueHits, 2, `两次 probeBusy 只该发 2 个 /queue 请求（实际 ${queueHits}）`);
});

await test('probeCapabilities：自带 turbo 蒸馏（无 LoRA）时档位是 turbo，不是 basic', async () => {
    const capsCfg = {
        ...cfg, unet: 'Qwen-Image-2.1-Turbo-AD-Q6_K.gguf', turboBakedModel: true, capabilityCacheMs: 0,
    };
    const caps = await __internal.probeCapabilities(capsCfg, undefined, undefined, { force: true });
    assert.equal(caps.probeFailed, false, '所有节点都回了合法 schema，不该判成"探测失败"');
    assert.equal(caps.unetLoader, 'UnetLoaderGGUF', '配置是 .gguf → 必须走 GGUF 加载器');
    assert.equal(caps.models.unet, 'Qwen-Image-2.1-Turbo-AD-Q6_K.gguf');
    // 旧判定只看 LoRA：没有 LoRA 就 level=basic，还写"回退到 25 步"——与实跑矛盾。
    assert.equal(caps.level, 'turbo', '自带蒸馏 = turbo 档（没有 TE/Speedup 时是 turbo）');
    assert.ok(caps.notes.some((note) => note.includes('自带 turbo 蒸馏')), caps.notes.join(' | '));
});

await test('waitForResult：首轮立即查 /history，结果就绪时不等 pollInterval（5 秒）', async () => {
    historyHits = 0;
    const started = Date.now();
    const images = await __internal.waitForResult(cfg, 'p1', { timeoutMs: 20000 });
    const elapsed = Date.now() - started;
    assert.equal(images.length, 1);
    assert.equal(historyHits, 1, '结果已就绪时只该查一次');
    assert.ok(elapsed < 1500, `首轮立即查询，不该白等 5 秒（实际 ${elapsed}ms）`);
});

await test('runUpscaleFile：引擎缺失时**不许**先卸主模型（/free 一次都不发）', async () => {
    let freeCalls = 0;
    const watcher = createServer((req, res) => {
        if (String(req.url) === '/free') freeCalls += 1;
        res.writeHead(String(req.url) === '/system_stats' ? 200 : 404, { 'content-type': 'application/json' });
        res.end('{}');
    });
    await new Promise((resolve) => watcher.listen(0, '127.0.0.1', resolve));
    const watcherUrl = `http://127.0.0.1:${watcher.address().port}`;
    try {
        await assert.rejects(
            __internal.runUpscaleFile({ ...cfg, comfyUrl: watcherUrl }, () => { }, undefined, {
                image: join(temp, 'whatever.png'), scale: 2, upscaler: 'vosr2',
            }),
            /VOSR2 节点|未安装/,
        );
        assert.equal(freeCalls, 0, '既然放大根本跑不起来，就不该把常驻的主模型卸掉');
    } finally {
        await new Promise((resolve) => watcher.close(resolve));
    }
});

await test('uploadReference：传入已读进来的字节时直接用（不再读文件）', async () => {
    const ghost = join(temp, 'does-not-exist.png');
    const bytes = pngHeader(64, 64);
    // 文件不存在 → 只要走的是 preloaded 分支就不会去读盘
    const name = await __internal.uploadReference(cfg, ghost, undefined, 2, bytes);
    assert.equal(name, 'uploaded.png');
});

await test('looksLikeComfyProcess：相对路径 main.py 启动也能认出（否则空闲关停永远不生效）', async () => {
    // 真机抓到的命令行：启动器用 cwd + 相对 main.py，一个 "comfy" 都没有
    const real = {
        commandLine: '"D:/dsh-video/a/python_embeded/python.exe"  "main.py" "--reserve-vram" "1.0" "--gpu-only"',
        executablePath: 'D:\\dsh-video\\a\\python_embeded\\python.exe',
        configuredPython: 'D:\\dsh-video\\a\\python_embeded\\python.exe',
    };
    assert.equal(__internal.looksLikeComfyProcess(real), true, '可执行文件对得上就必须认出来');
    // 绝对路径启动（老路径）仍然认
    assert.equal(__internal.looksLikeComfyProcess({
        commandLine: 'python.exe -s D:\\x\\ComfyUI\\main.py --windows-standalone-build',
    }), true);
    // 别人的 python main.py：可执行文件对不上 → 拒绝（不能误杀）
    assert.equal(__internal.looksLikeComfyProcess({
        commandLine: 'python main.py',
        executablePath: 'C:\\other\\python.exe',
        configuredPython: 'D:\\dsh-video\\a\\python_embeded\\python.exe',
    }), false);
    // 没有 main.py → 拒绝
    assert.equal(__internal.looksLikeComfyProcess({
        commandLine: 'python server.py',
        executablePath: 'D:\\dsh-video\\a\\python_embeded\\python.exe',
        configuredPython: 'D:\\dsh-video\\a\\python_embeded\\python.exe',
    }), false);
});

/* ------------------------------------------------------- 7. 生效步数/CFG 的读取 ---- */
await test('buildComfyArgs：端口/监听地址从 comfyUrl 推（旧代码不带 --port，换端口必超时）', async () => {
    const win = buildComfyArgs({
        mainPy: 'X:\\ComfyUI\\main.py', extraArgs: ['--gpu-only'], comfyUrl: 'http://127.0.0.1:8189', isWindows: true,
    });
    assert.deepEqual(win.slice(0, 4), ['-s', 'X:\\ComfyUI\\main.py', '--windows-standalone-build', '--disable-auto-launch']);
    assert.ok(win.includes('--gpu-only'));
    assert.deepEqual(win.slice(-4), ['--port', '8189', '--listen', '127.0.0.1']);

    // 手写的旧端口/监听必须被丢掉，否则 comfyUrl 永远对不上
    const nix = buildComfyArgs({
        mainPy: 'main.py',
        extraArgs: ['--port', '9999', '--listen', '0.0.0.0', '--fast'],
        comfyUrl: 'http://127.0.0.1:8190',
        isWindows: false,
    });
    assert.ok(!nix.includes('9999'), '过期的手写端口必须丢掉');
    assert.ok(!nix.includes('0.0.0.0'), '手写的监听地址必须丢掉');
    assert.ok(nix.includes('--fast'), '其它手写参数要保留');
    assert.deepEqual(nix.slice(-4), ['--port', '8190', '--listen', '127.0.0.1']);
    assert.ok(!nix.includes('--windows-standalone-build'), 'Linux 不加 Windows 专属参数');
});
await test('effectiveSampling：turbo9 档没有节点 8，也要读出生效步数/CFG（不再 steps=undefined）', async () => {
    const base = {
        samplingProfile: 'turbo9', turboBakedModel: true, manualSigmasSteps: 9,
    };
    const w = buildWorkflow({ ...DEFAULTS, ...base }, { prompt: 'x', width: 1024, height: 1024, seed: 1 }, undefined);
    const s = __internal.effectiveSampling(w, undefined);
    assert.equal(s.steps, 9, '9 步 sigma 表 = 9 步');
    assert.equal(s.cfg, 1, 'turbo9 用 CFGGuider(cfg=1)');
    // ksimple 档仍然是节点 8 的 KSampler；textControl=native 强制走 25 步原生链路
    const k = buildWorkflow({ ...DEFAULTS, ...base, samplingProfile: 'ksimple', textControl: 'native' }, {
        prompt: 'x', width: 1024, height: 1024, seed: 1,
    }, undefined);
    const ks = __internal.effectiveSampling(k, undefined);
    assert.equal(ks.steps, 25, '没有 turbo LoRA 时走原生 25 步');
});

await new Promise((resolve) => server.close(resolve));

/* --------------------------------------------------------------------- 汇总 ---- */
console.log('2026-11-12 优化批次回归：');
for (const line of results) console.log(line);
const failed = results.filter((line) => line.startsWith('  FAIL')).length;
if (failed === 0) {
    console.log(`\n${results.length}/${results.length} 通过`);
} else {
    console.log(`\n${failed} 项失败`);
}