/**
 * 作品库端点的集成测试：不启动 DSH，但**真的**把请求喂进路由处理函数。
 *
 * 覆盖的是"接线"这一层 —— 这类代码最容易在类型/签名上悄悄错：
 *   1. `GET /api/comfy-suite/gallery` 返回扫描结果与统计；
 *   2. `GET …/file?id=` 吐出正确的字节与 content-type，根外的 id 一律 403；
 *   3. `POST …/favorite` 落盘、`POST …/delete` 真的把文件移走；
 *   4. `POST …/regenerate` 把出图日志里的 prompt/seed 原样交给 draw_image；
 *   5. `GET /api/comfy-suite/presets` 与 `/presets/compose` 可用；
 *   6. 跨站请求（Origin 不匹配）被 403 挡掉。
 *
 * 用的是内存里的假 ctx / 假 webServer / 假 req-res，全程读临时目录。
 */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const home = await mkdtemp(join(tmpdir(), 'suite-routes-test-'));
const outDir = join(home, '千问1生图');
const workflowDir = join(home, 'comfy-output');
await mkdir(outDir, { recursive: true });
await mkdir(join(workflowDir, 'portrait'), { recursive: true });

process.env.DSH_HOME = home;

const suite = await import(new URL('./lib/index.js', import.meta.url));

/* ---------------------------------------------------------- 测试用图片 ---- */

function png(width, height) {
    const buffer = Buffer.alloc(64);
    buffer.writeUInt32BE(0x89504e47, 0);
    buffer.writeUInt32BE(0x0d0a1a0a, 4);
    buffer.writeUInt32BE(13, 8);
    buffer.write('IHDR', 12, 'ascii');
    buffer.writeUInt32BE(width, 16);
    buffer.writeUInt32BE(height, 20);
    return buffer;
}

const catFile = join(outDir, '一只橘猫_Qwen2.1_864x1152_01.png');
const seaFile = join(outDir, '海边日落_Qwen2.1_1504x992_01.png');
const workflowFile = join(workflowDir, 'portrait', 'portrait_00001_.png');
await writeFile(catFile, png(864, 1152));
await writeFile(seaFile, png(1504, 992));
// 排序测试要确定：把两张图的 mtime 显式拉开（同一毫秒写入时顺序是不确定的）。
await utimes(catFile, new Date('2026-11-04T09:00:00Z'), new Date('2026-11-04T09:00:00Z'));
await utimes(seaFile, new Date('2026-11-04T12:00:00Z'), new Date('2026-11-04T12:00:00Z'));
await writeFile(workflowFile, png(1024, 1024));
await writeFile(join(outDir, '.qwen-paint-memory.jsonl'), [
    JSON.stringify({ ts: '2026-11-04T10:00:00.000Z', prompt: '一只橘猫坐在窗台上', negative: '', seed: 123456, width: 864, height: 1152, steps: 8, path: catFile, seconds: 21.5 }),
    JSON.stringify({ ts: '2026-11-04T11:00:00.000Z', prompt: '海边日落', negative: '低分辨率', seed: 654321, width: 1504, height: 992, steps: 8, path: seaFile, seconds: 33 }),
    '',
].join('\n'));

/* ------------------------------------------------------------ 假宿主 ---- */

const handlers = new Map();
const tools = new Map();

function makeCtx(label) {
    const ctx = {
        fiber: { id: label },
        get(name) {
            if (name === 'settings') return { writable: true, configure() { return () => { }; }, async update() { } };
            if (name === 'webServer') {
                return {
                    register({ path, handler }) {
                        handlers.set(path, handler);
                        return () => handlers.delete(path);
                    },
                };
            }
            return undefined;
        },
        on() { return () => { }; },
        effect(fn) { const dispose = fn(); return typeof dispose === 'function' ? dispose : () => { }; },
        inject(_deps, callback) { return callback(ctx); },
        plugin(plugin, config) {
            plugin.apply(makeCtx(`${label}/${plugin.name ?? '?'}`), config);
            return { then() { } };
        },
        tools: {
            register(definition) {
                tools.set(definition.name, definition);
                return () => tools.delete(definition.name);
            },
            get(name) {
                return tools.get(name);
            },
        },
    };
    // 真实 cordis 里注入后的 ctx 既能 ctx.get(name) 也能直接 ctx.settings。
    Object.defineProperty(ctx, 'settings', { get: () => ctx.get('settings') });
    Object.defineProperty(ctx, 'webServer', { get: () => ctx.get('webServer') });
    return ctx;
}

suite.apply(makeCtx('suite'), {
    comfyui: { baseUrl: 'http://127.0.0.1:8188', outputDir: workflowDir, dataDir: join(home, 'comfyui-data') },
    launcher: { port: 8188 },
    qwenPaint: { outputDir: outDir },
});

// 子插件挂载可能是异步的；等一小会儿让工具与路由都就位。
await new Promise((resolve) => setTimeout(resolve, 1200));
assert.ok(handlers.has('/api/comfy-suite/gallery'), 'gallery route was not registered');
assert.ok(tools.has('image_presets'), 'presets tool was not registered');

/** 一个够用的 IncomingMessage：method/url/headers + 可选的 JSON 正文。 */
function makeRequest({ method = 'GET', url = '/', headers = {}, body } = {}) {
    const payload = body === undefined ? [] : [Buffer.from(JSON.stringify(body), 'utf8')];
    return {
        method,
        url,
        headers: { host: '127.0.0.1:10157', origin: 'http://127.0.0.1:10157', ...headers },
        async *[Symbol.asyncIterator]() {
            for (const chunk of payload) yield chunk;
        },
    };
}

/** 一个够用的 ServerResponse：收集 writeHead / end。 */
function makeResponse() {
    const chunks = [];
    return {
        statusCode: 0,
        headers: {},
        writeHead(status, headers) {
            this.statusCode = status;
            this.headers = headers ?? {};
        },
        end(buffer) {
            if (buffer !== undefined) chunks.push(Buffer.from(buffer));
        },
        get bytes() {
            return Buffer.concat(chunks);
        },
        get text() {
            return this.bytes.toString('utf8');
        },
        get json() {
            return JSON.parse(this.text);
        },
    };
}

async function invoke(path, options) {
    // 处理器按**路径**注册（查询串由处理函数自己解析）。
    const handler = handlers.get(path.split('?')[0]);
    assert.ok(handler, `route ${path} is not registered`);
    const response = makeResponse();
    await handler(makeRequest({ ...(options || {}), url: path }), response);
    return response;
}

const json = (body, extraHeaders) => ({ 'content-type': 'application/json', ...(extraHeaders || {}) });

/* ------------------------------------------------------------ 1. 列表 ---- */
const listResponse = await invoke('/api/comfy-suite/gallery');
assert.equal(listResponse.statusCode, 200);
const list = listResponse.json;
assert.equal(list.ok, true);
assert.equal(list.total, 2, '默认只扫千问出图目录');
assert.equal(list.items[0].prompt, '海边日落', '按时间倒序，最新的在前');
assert.equal(list.items[1].prompt, '一只橘猫坐在窗台上');
assert.equal(list.items[1].width, 864);
assert.equal(list.items[1].height, 1152);
assert.ok(list.stats.bytes > 0);
console.log('ok - GET /gallery lists the output dir with metadata joined from the generation log');

/* -------------------------------------------------- 2. 工作流产物开关 ---- */
const withWorkflow = (await invoke('/api/comfy-suite/gallery?workflow=1')).json;
assert.equal(withWorkflow.total, 3, '勾选后才包含 ComfyUI 的输出目录');
assert.ok(withWorkflow.items.some((item) => item.name === 'portrait_00001_.png'));
console.log('ok - workflow outputs appear only when explicitly requested');

/* ------------------------------------------------------------ 3. 检索 ---- */
const searched = (await invoke('/api/comfy-suite/gallery?q=' + encodeURIComponent('橘猫'))).json;
assert.equal(searched.total, 1);
assert.equal(searched.items[0].name, '一只橘猫_Qwen2.1_864x1152_01.png');
console.log('ok - search filters by prompt text');

/* ------------------------------------------------------------ 4. 原图 ---- */
const catItem = list.items.find((item) => item.name.startsWith('一只橘猫'));
const fileResponse = await invoke('/api/comfy-suite/gallery/file?id=' + encodeURIComponent(catItem.id));
assert.equal(fileResponse.statusCode, 200);
assert.equal(fileResponse.headers['content-type'], 'image/png');
assert.equal(fileResponse.bytes.length, 64);
console.log('ok - GET /gallery/file serves the original bytes with the right content type');

// 根外的路径（伪造 id）必须被拒绝
const outsideId = Buffer.from(join(home, 'secret.png'), 'utf8').toString('base64url');
const outsideResponse = await invoke('/api/comfy-suite/gallery/file?id=' + encodeURIComponent(outsideId));
assert.equal(outsideResponse.statusCode, 403);
console.log('ok - a forged id pointing outside the roots is refused with 403');

/* ------------------------------------------------------------ 5. 收藏 ---- */
const favorite = await invoke('/api/comfy-suite/gallery/favorite', {
    method: 'POST',
    headers: json(),
    body: { id: catItem.id, favorite: true },
});
assert.equal(favorite.statusCode, 200);
assert.equal(favorite.json.favorite, true);

const favorites = (await invoke('/api/comfy-suite/gallery?scope=favorite')).json;
assert.equal(favorites.total, 1);
assert.equal(favorites.items[0].id, catItem.id);
console.log('ok - POST /gallery/favorite persists and the favourites filter reflects it');

/* ------------------------------------------------------------ 6. 重画 ---- */
let regenerateArgs;
tools.set('draw_image', {
    name: 'draw_image',
    async execute(args) {
        regenerateArgs = args;
        return { path: join(outDir, 'new.png'), files: [join(outDir, 'new.png')], seed: 999, seconds: 12.5 };
    },
});

const regenerated = await invoke('/api/comfy-suite/gallery/regenerate', {
    method: 'POST',
    headers: json(),
    body: { id: catItem.id, seed: 'same' },
});
assert.equal(regenerated.statusCode, 200);
assert.equal(regenerated.json.ok, true);
assert.equal(regenerateArgs.prompt, '一只橘猫坐在窗台上');
assert.equal(regenerateArgs.seed, 123456, 'same 模式必须复用原种子');
assert.equal(regenerateArgs.size, '3:4');
assert.ok(Math.abs(regenerateArgs.megapixels - 0.995) < 0.01);
console.log('ok - POST /gallery/regenerate replays the logged prompt/seed/size through draw_image');

/* ------------------------------------------------------------ 7. 删除 ---- */
const removed = await invoke('/api/comfy-suite/gallery/delete', {
    method: 'POST',
    headers: json(),
    body: { id: catItem.id },
});
assert.equal(removed.statusCode, 200);
assert.equal(removed.json.ok, true);
await assert.rejects(stat(catFile), 'file should have been moved out of the output dir');
await stat(removed.json.moved); // 回收站里确实有
const afterDelete = (await invoke('/api/comfy-suite/gallery')).json;
assert.equal(afterDelete.total, 1, 'deleted item disappears from the listing');
console.log('ok - POST /gallery/delete moves the file to trash and hides the record');

/* --------------------------------------------------------- 8. 风格库 ---- */
const presets = await invoke('/api/comfy-suite/presets');
assert.equal(presets.statusCode, 200);
assert.ok(presets.json.total >= 50);
assert.ok(presets.json.items.some((item) => item.id === 'illu-watercolor'));

/* -------------------------------------------------------- 9. 衣柜 ---- */
const wardrobe = await invoke('/api/comfy-suite/wardrobe');
assert.equal(wardrobe.statusCode, 200);
assert.ok(wardrobe.json.layers.length >= 10, '衣柜图层缺失');
assert.ok(wardrobe.json.scenes.length >= 12, '场景搭配缺失');
assert.equal(wardrobe.json.levels.length, 5, '五级档位');
assert.deepEqual(wardrobe.json.issues, [], '数据校验不该有问题');
console.log('ok - GET /wardrobe exposes layers, scenes and five levels');

const rolled = await invoke('/api/comfy-suite/wardrobe/roll', {
    method: 'POST',
    headers: json(),
    body: { level: 0, seed: 777, count: 2 },
});
assert.equal(rolled.statusCode, 200);
assert.equal(rolled.json.variants.length, 2);
assert.deepEqual(rolled.json.variants.map((entry) => entry.seed), [777, 778]);
assert.ok(rolled.json.variants[0].prompt.length > 10);
assert.ok(rolled.json.variants[0].negative.length > 0);
const replay = await invoke('/api/comfy-suite/wardrobe/roll', {
    method: 'POST',
    headers: json(),
    body: { level: 0, seed: 777, count: 1 },
});
assert.equal(replay.json.variants[0].prompt, rolled.json.variants[0].prompt, '同 seed 的端点结果必须一致');
console.log('ok - POST /wardrobe/roll is deterministic and returns prompt + negative');

const wardrobeDrawn = await invoke('/api/comfy-suite/wardrobe/draw', {
    method: 'POST',
    headers: json(),
    body: { prompt: rolled.json.variants[0].prompt, negative: rolled.json.variants[0].negative },
});
assert.equal(wardrobeDrawn.statusCode, 200);
assert.equal(wardrobeDrawn.json.ok, true);
assert.equal(regenerateArgs.prompt, rolled.json.variants[0].prompt, '面板出图必须走 draw_image');
assert.equal(regenerateArgs.negative, rolled.json.variants[0].negative);
console.log('ok - POST /wardrobe/draw hands the prompt to draw_image');

const composed = await invoke('/api/comfy-suite/presets/compose', {
    method: 'POST',
    headers: json(),
    body: { ids: ['illu-watercolor', 'neg-common'], base: '一只橘猫' },
});
assert.equal(composed.statusCode, 200);
assert.ok(composed.json.prompt.startsWith('一只橘猫'));
assert.ok(composed.json.negative.length > 0);
assert.equal(composed.json.prompt.includes('低分辨率'), false);
console.log('ok - GET /presets and POST /presets/compose work end to end');

/* --------------------------------------------------------- 9. 同源守卫 ---- */
const crossSite = await invoke('/api/comfy-suite/gallery/favorite', {
    method: 'POST',
    headers: { ...json(), origin: 'http://evil.example.com' },
    body: { id: catItem.id, favorite: true },
});
assert.equal(crossSite.statusCode, 403);

const wrongMethod = await invoke('/api/comfy-suite/gallery/favorite', { method: 'GET' });
assert.equal(wrongMethod.statusCode, 405);

const wrongType = await invoke('/api/comfy-suite/gallery/favorite', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: { id: catItem.id },
});
assert.equal(wrongType.statusCode, 415);
console.log('ok - cross-origin / wrong-method / wrong-content-type requests are all refused');

console.log('OK gallery route integration test passed');
process.exit(0);