/**
 * dsh-comfy-suite — 作品库 / 风格库的 HTTP 端点
 * ============================================================================
 * 六个端点，全部只服务本机界面（同源 + 回环），不做任何外网回调：
 *
 *   GET  /api/comfy-suite/gallery               列表（关键词 / 收藏 / 排序 / 分页）
 *   GET  /api/comfy-suite/gallery/file?id=…     原图字节（仅限扫描根内）
 *   GET  /api/comfy-suite/presets               风格库（可选 q / kind 过滤）
 *   POST /api/comfy-suite/gallery/favorite      收藏 / 取消收藏
 *   POST /api/comfy-suite/gallery/delete        删除（移进回收站，不是 unlink）
 *   POST /api/comfy-suite/gallery/regenerate    用记录里的参数再画一张
 *
 * ## 为什么删除是「移进回收站」
 *
 * 图库是本机文件的入口，误点一下不该让一张抽了十几次才出的图彻底消失。
 * 文件被 rename 到 `data/dsh-comfy-suite/trash/`，用户随时能捞回来。
 *
 * ## 为什么 regenerate 走 tool.execute
 *
 * dsh-qwen-paint 自己的「面板圈选重绘」端点已经是这么干的（直接调
 * `editToolRef.execute()`），说明工具对象确实带 execute。这里沿用同一条路：
 * 只有出图工具已注册时才可用，否则如实返回 503，绝不假装成功。
 */
import { readFile } from 'node:fs/promises';
import { errorMessage, sameOrigin, sendJson } from '../vendor/comfyui/lib/http.js';
import {
    buildGallery,
    contentTypeOf,
    decodeId,
    encodeId,
    invalidateScanCache,
    isInside,
    moveToTrash,
    readImageBytes,
    readMemoryRecords,
    readState,
    writeState,
} from './gallery.js';
import { KIND_LABELS, composePrompt, formatPreset, loadPresets, searchPresets } from './presets.js';
import { draw, loadWardrobe, parseWeights, resolveLevel } from './wardrobe.js';

/** POST 正文上限：这里只收 id 和几个布尔/数字，64 KB 绰绰有余。 */
const MAX_BODY_BYTES = 64 * 1024;

/** 关键词长度上限（防止有人把整篇文章塞进查询串）。 */
const MAX_QUERY_LENGTH = 200;

/* ------------------------------------------------------------------ 小工具 ---- */

const methodIs = (request, method) => String(request.method ?? 'GET').toUpperCase() === method;

/** 读有上限的 JSON 正文；超限或不是 JSON 都返回 undefined。 */
async function readBoundedJson(request) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) return undefined;
        chunks.push(chunk);
    }
    if (size === 0) return {};
    try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        return parsed !== null && typeof parsed === 'object' ? parsed : undefined;
    } catch {
        return undefined;
    }
}

/** 写操作的前置守卫：同源 + JSON content-type。失败时已经写好响应。 */
function guardWrite(request, response) {
    if (!sameOrigin(request)) {
        sendJson(response, 403, { ok: false, error: '仅接受同源请求' });
        return false;
    }
    const type = String(request.headers['content-type'] ?? '');
    if (!type.toLowerCase().includes('application/json')) {
        sendJson(response, 415, { ok: false, error: '需要 application/json' });
        return false;
    }
    return true;
}

/** 把 URL 里的查询串解成普通对象（只取出现的键）。 */
function queryOf(request) {
    try {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');
        const params = {};
        for (const [key, value] of url.searchParams) params[key] = value;
        return params;
    } catch {
        return {};
    }
}

/**
 * 读当前状态（收藏 / 墓碑）并返回。
 *
 * 每次请求都读一遍是有意的：用户可能手动改 JSON、或者另一个标签页刚写过 ——
 * 图库这种低频面板，几十 KB 的读取代价远小于"显示的状态和磁盘不一致"。
 */
async function currentState(runtime) {
    return readState(runtime.statePath);
}
/**
 * Serialize read-modify-write cycles on the gallery state file.
 *
 * Favourite and delete both do "read state → change one field → write state".
 * Left unserialized, a double-clicked star or a delete landing next to a
 * favourite toggle loses one of the two edits (and the fixed temp name used to
 * make the loser throw ENOENT as well).
 */
let stateQueue = Promise.resolve();
function withStateLock(work) {
    const run = stateQueue.then(work, work);
    stateQueue = run.then(() => undefined, () => undefined);
    return run;
}

/** 读所有记忆日志并合并（可能有出图目录 + 历史目录两份）。 */
async function currentMemory(runtime) {
    const records = [];
    for (const path of runtime.memoryPaths()) {
        records.push(...await readMemoryRecords(path));
    }
    return records;
}

/* ------------------------------------------------------------------ 挂载 ---- */

/**
 * 注册全部端点；返回一个 dispose 函数（也通过 ctx.effect 自动清理）。
 *
 * @param {object} ctx     cordis 上下文
 * @param {object} runtime 见文件头
 */
export function mountSuiteRoutes(ctx, runtime) {
    // webServer 在注入回调里既可能是 `ctx.get('webServer')`，也可能直接是
    // `ctx.webServer` 属性（cordis 会把注入的服务同时挂成属性）。两个都认。
    const webServer = ctx.get?.('webServer') ?? ctx.webServer;
    if (webServer === undefined) {
        runtime.log('info', '这个 profile 没有 webServer：作品库界面不可用（工具与出图不受影响）');
        return () => {};
    }

    const disposers = [];

    /** DSH 路由准入：Host/Origin fence + 浏览器认证；服务缺失时降级放行。 */
    const rejected = (request, response) => {
        const connection = ctx.get?.('connection') ?? ctx.connection;
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
            handler: (request, response) => {
                if (rejected(request, response))
                    return;
                return handler(request, response);
            },
        }));
    };

    /* ---------------------------------------------------------- 列表 ---- */
    register('/api/comfy-suite/gallery', async (request, response) => {
        if (!methodIs(request, 'GET')) {
            sendJson(response, 405, { ok: false, error: 'GET only' });
            return;
        }
        if (!sameOrigin(request)) {
            sendJson(response, 403, { ok: false, error: '仅接受同源请求' });
            return;
        }
        try {
            const query = queryOf(request);
            const state = await currentState(runtime);
            const result = await buildGallery({
                roots: runtime.roots(query.workflow === '1'),
                memory: await currentMemory(runtime),
                state,
                query: String(query.q ?? '').slice(0, MAX_QUERY_LENGTH),
                scope: query.scope === 'favorite' ? 'favorite' : 'all',
                sort: query.sort === 'oldest' ? 'oldest' : 'newest',
                offset: Number(query.offset ?? 0),
                limit: Number(query.limit ?? 120),
            });
            sendJson(response, 200, { ok: true, ...result });
        } catch (error) {
            sendJson(response, 500, { ok: false, error: errorMessage(error) });
        }
    });

    /* ---------------------------------------------------------- 原图 ---- */
    register('/api/comfy-suite/gallery/file', async (request, response) => {
        if (!methodIs(request, 'GET') && !methodIs(request, 'HEAD')) {
            sendJson(response, 405, { ok: false, error: 'GET only' });
            return;
        }
        if (!sameOrigin(request)) {
            sendJson(response, 403, { ok: false, error: '仅接受同源请求' });
            return;
        }
        const file = decodeId(queryOf(request).id);
        if (file === '') {
            sendJson(response, 400, { ok: false, error: 'id 无效' });
            return;
        }
        const result = await readImageBytes(file, runtime.roots(true));
        if (result.ok !== true) {
            sendJson(response, result.status ?? 404, { ok: false, error: result.error });
            return;
        }
        response.writeHead(200, {
            'content-type': contentTypeOf(file),
            'content-length': result.bytes.length,
            // 图会变（同一路径被覆盖/重画），一律不缓存，避免面板显示旧图。
            'cache-control': 'no-store',
        });
        response.end(methodIs(request, 'HEAD') ? undefined : result.bytes);
    });

    /* ---------------------------------------------------------- 收藏 ---- */
    register('/api/comfy-suite/gallery/favorite', async (request, response) => {
        if (!methodIs(request, 'POST')) {
            sendJson(response, 405, { ok: false, error: 'POST only' });
            return;
        }
        if (!guardWrite(request, response)) return;
        const body = await readBoundedJson(request);
        if (body === undefined) {
            sendJson(response, 400, { ok: false, error: '正文必须是 JSON 对象' });
            return;
        }
        const file = decodeId(body.id);
        if (file === '') {
            sendJson(response, 400, { ok: false, error: 'id 无效' });
            return;
        }
        const id = encodeId(file);
        const favorite = body.favorite === true;
        try {
            await withStateLock(async () => {
                const state = await currentState(runtime);
                const next = new Set(state.favorites);
                if (favorite) next.add(id);
                else next.delete(id);
                const written = { ...state, favorites: [...next] };
                await writeState(runtime.statePath, written);
            });
            // Favourites are applied per call, so the snapshot itself is still
            // valid; bumping it keeps the panel's next read consistent anyway.
            sendJson(response, 200, { ok: true, favorite });
        } catch (error) {
            sendJson(response, 500, { ok: false, error: errorMessage(error) });
        }
    });

    /* ---------------------------------------------------------- 删除 ---- */
    register('/api/comfy-suite/gallery/delete', async (request, response) => {
        if (!methodIs(request, 'POST')) {
            sendJson(response, 405, { ok: false, error: 'POST only' });
            return;
        }
        if (!guardWrite(request, response)) return;
        const body = await readBoundedJson(request);
        if (body === undefined) {
            sendJson(response, 400, { ok: false, error: '正文必须是 JSON 对象' });
            return;
        }
        const file = decodeId(body.id);
        if (file === '') {
            sendJson(response, 400, { ok: false, error: 'id 无效' });
            return;
        }
        const id = encodeId(file);
        try {
            const moved = await moveToTrash(runtime.trashDir, file, runtime.roots(true));
            if (moved.ok !== true) {
                sendJson(response, 409, { ok: false, error: moved.error });
                return;
            }
            // The file is gone from the scanned roots: the next gallery read must
            // not serve a snapshot that still lists it.
            invalidateScanCache();
            // 墓碑：文件已经不在目录里了，但用户可能从回收站放回去 ——
            // 那时的 id 与路径都没变，墓碑会让它重新出现；所以墓碑只记
            // "这次删除动作"，用户把文件放回来就等于撤销。
            await withStateLock(async () => {
                const state = await currentState(runtime);
                const written = {
                    ...state,
                    hidden: [...new Set([...state.hidden, id])],
                    favorites: state.favorites.filter((entry) => entry !== id),
                };
                await writeState(runtime.statePath, written);
            });
            sendJson(response, 200, { ok: true, moved: moved.moved });
        } catch (error) {
            sendJson(response, 500, { ok: false, error: errorMessage(error) });
        }
    });

    /* ------------------------------------------------------- 再画一张 ---- */
    register('/api/comfy-suite/gallery/regenerate', async (request, response) => {
        if (!methodIs(request, 'POST')) {
            sendJson(response, 405, { ok: false, error: 'POST only' });
            return;
        }
        if (!guardWrite(request, response)) return;
        const body = await readBoundedJson(request);
        if (body === undefined) {
            sendJson(response, 400, { ok: false, error: '正文必须是 JSON 对象' });
            return;
        }
        const file = decodeId(body.id);
        if (file === '' || !runtime.roots(true).some((root) => isInside(root, file))) {
            sendJson(response, 400, { ok: false, error: 'id 无效或不在作品库范围内' });
            return;
        }
        const tool = runtime.getTool('draw_image');
        if (tool === undefined || typeof tool.execute !== 'function') {
            sendJson(response, 503, { ok: false, error: 'draw_image 还没注册好（插件仍在加载？）' });
            return;
        }
        // 参数从出图日志里取：日志里有 prompt / negative / seed / 宽高。
        const record = (await currentMemory(runtime))
            .filter((entry) => typeof entry?.path === 'string')
            .find((entry) => entry.path.replace(/\\/g, '/').toLowerCase() === file.replace(/\\/g, '/').toLowerCase());
        if (record === undefined || typeof record.prompt !== 'string' || record.prompt === '') {
            sendJson(response, 409, {
                ok: false,
                error: '这张图没有出图记录（不是本插件生成的，或日志已被清理），无法复现参数',
            });
            return;
        }
        const args = { prompt: record.prompt };
        if (typeof record.negative === 'string' && record.negative !== '') args.negative = record.negative;
        if (Number.isFinite(record.width) && Number.isFinite(record.height)) {
            args.size = aspectOf(record.width, record.height);
            args.megapixels = Math.max(0.25, Math.min(4, (record.width * record.height) / 1_000_000));
        }
        // 种子：same = 完全复现；random = 同参数抽下一张（默认）。
        if (body.seed === 'same' && Number.isFinite(record.seed)) args.seed = record.seed;
        try {
            runtime.log('info', `作品库重画：${file}（seed=${args.seed ?? '随机'}）`);
            const controller = new AbortController();
            const value = await tool.execute(args, {
                signal: controller.signal,
                callId: `gallery-regenerate-${Date.now()}`,
            });
            // The new file lands in the same scanned folder; the next read must
            // see it instead of a snapshot taken seconds ago.
            invalidateScanCache();
            sendJson(response, 200, {
                ok: true,
                path: value?.path ?? '',
                files: Array.isArray(value?.files) ? value.files : [],
                seed: value?.seed,
                seconds: value?.seconds,
            });
        } catch (error) {
            sendJson(response, 500, { ok: false, error: errorMessage(error) });
        }
    });

    /* -------------------------------------------------------- 风格库 ---- */
    register('/api/comfy-suite/presets', async (request, response) => {
        if (!methodIs(request, 'GET')) {
            sendJson(response, 405, { ok: false, error: 'GET only' });
            return;
        }
        if (!sameOrigin(request)) {
            sendJson(response, 403, { ok: false, error: '仅接受同源请求' });
            return;
        }
        try {
            const query = queryOf(request);
            const library = await loadPresets();
            const items = searchPresets(library.items, {
                query: String(query.q ?? '').slice(0, MAX_QUERY_LENGTH),
                kind: String(query.kind ?? ''),
                // 面板要能一次翻完，所以默认给全量（工具侧另有 12 条的小限额）。
                limit: Number(query.limit ?? library.items.length),
            });
            sendJson(response, 200, {
                ok: true,
                title: library.title,
                total: library.items.length,
                kinds: KIND_LABELS,
                items: items.map((item) => ({
                    id: item.id,
                    name: item.name,
                    kind: item.kind,
                    tags: item.tags ?? [],
                    prompt: item.prompt,
                    note: item.note ?? '',
                    line: formatPreset(item),
                })),
            });
        } catch (error) {
            sendJson(response, 500, { ok: false, error: errorMessage(error) });
        }
    });

    /* ---------------------------------------------------------- 组装 ---- */
    // 给界面「拼一句」用：选几条 → 直接得到可复制的完整 prompt。
    register('/api/comfy-suite/presets/compose', async (request, response) => {
        if (!methodIs(request, 'POST')) {
            sendJson(response, 405, { ok: false, error: 'POST only' });
            return;
        }
        if (!guardWrite(request, response)) return;
        const body = await readBoundedJson(request);
        if (body === undefined) {
            sendJson(response, 400, { ok: false, error: '正文必须是 JSON 对象' });
            return;
        }
        const library = await loadPresets();
        const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === 'string') : [];
        const composed = composePrompt(library.items, { ids, base: String(body.base ?? '') });
        sendJson(response, 200, { ok: true, ...composed });
    });

    /* ------------------------------------------------------- 提示词衣柜 ---- */

    // 面板要的是**完整词库**（含每个选项的档位），不是工具侧那种 12 条限额：
    // 衣柜的界面必须能显示"这一层有哪些选项、哪几条在本档可用"。
    register('/api/comfy-suite/wardrobe', async (request, response) => {
        if (!methodIs(request, 'GET')) {
            sendJson(response, 405, { ok: false, error: 'GET only' });
            return;
        }
        if (!sameOrigin(request)) {
            sendJson(response, 403, { ok: false, error: '仅接受同源请求' });
            return;
        }
        try {
            const model = await loadWardrobe();
            sendJson(response, 200, {
                ok: true,
                schema: model.schema,
                title: model.title,
                levels: model.levels,
                modes: model.modes,
                defaults: model.defaults,
                issues: model.issues,
                layers: model.layers.map((layer) => ({
                    id: layer.id,
                    title: layer.title,
                    mode: layer.mode,
                    fields: layer.fields.map((field) => ({
                        key: field.key,
                        label: field.label,
                        req: field.req === true,
                        options: field.options.map((option) => ({
                            label: option.label,
                            phrase: option.phrase,
                            level: option.level,
                        })),
                    })),
                })),
                scenes: model.scenes.map((scene) => ({
                    id: scene.id,
                    zh: scene.zh,
                    desc: scene.desc,
                    level: scene.level,
                    note: scene.note,
                    locks: scene.locks.map((lock) => `${lock.key}=${lock.option.label}`),
                })),
            });
        } catch (error) {
            sendJson(response, 500, { ok: false, error: errorMessage(error) });
        }
    });

    // 抽取：与工具 `prompt_wardrobe` 共用同一个引擎，界面只是另一个入口。
    register('/api/comfy-suite/wardrobe/roll', async (request, response) => {
        if (!methodIs(request, 'POST')) {
            sendJson(response, 405, { ok: false, error: 'POST only' });
            return;
        }
        if (!guardWrite(request, response)) return;
        const body = await readBoundedJson(request);
        if (body === undefined) {
            sendJson(response, 400, { ok: false, error: '正文必须是 JSON 对象' });
            return;
        }
        try {
            const model = await loadWardrobe();
            const count = Math.max(1, Math.min(4, Number.isFinite(body.count) ? Math.trunc(body.count) : 1));
            const start = Number.isFinite(body.seed) && Number(body.seed) >= 0 ? Math.trunc(body.seed) : undefined;
            const weights = parseWeights(body.weights);
            const variants = [];
            for (let index = 0; index < count; index += 1) {
                const result = draw(model, {
                    level: resolveLevel(body.level, 0),
                    mode: body.mode,
                    subject: body.subject,
                    seed: start === undefined ? undefined : start + index,
                    scene: body.scene,
                    sceneChance: body.sceneChance,
                    layers: body.layers,
                    weights,
                    forced: body.forced,
                    baseProb: body.baseProb,
                    tagCap: body.tagCap,
                });
                variants.push({
                    prompt: result.prompt,
                    negative: result.negative,
                    seed: result.seed,
                    level: result.level,
                    levelLabel: result.levelLabel,
                    scene: result.scene === undefined ? null : { id: result.scene.id, zh: result.scene.zh },
                    report: result.report,
                    picks: result.picks.map((entry) => `${entry.layer}.${entry.field}=${entry.label}`),
                });
            }
            runtime.log('info', `衣柜面板抽取 ×${count}：L${variants[0].level}，种子 ${variants.map((entry) => entry.seed).join(',')}`);
            sendJson(response, 200, { ok: true, variants });
        } catch (error) {
            sendJson(response, 500, { ok: false, error: errorMessage(error) });
        }
    });

    // 「画一张」：把面板抽到的 prompt 直接交给已注册的 draw_image。
    // 与作品库的 regenerate 同一条路 —— 面板不该自己拼参数、发另一套请求。
    register('/api/comfy-suite/wardrobe/draw', async (request, response) => {
        if (!methodIs(request, 'POST')) {
            sendJson(response, 405, { ok: false, error: 'POST only' });
            return;
        }
        if (!guardWrite(request, response)) return;
        const body = await readBoundedJson(request);
        if (body === undefined) {
            sendJson(response, 400, { ok: false, error: '正文必须是 JSON 对象' });
            return;
        }
        const prompt = String(body.prompt ?? '').trim();
        if (prompt === '') {
            sendJson(response, 400, { ok: false, error: 'prompt 不能为空' });
            return;
        }
        const tool = runtime.getTool('draw_image');
        if (tool === undefined || typeof tool.execute !== 'function') {
            sendJson(response, 503, { ok: false, error: 'draw_image 还没注册好（插件仍在加载？）' });
            return;
        }
        const args = { prompt };
        const negative = String(body.negative ?? '').trim();
        if (negative !== '') args.negative = negative;
        if (Number.isFinite(body.seed)) args.seed = Math.trunc(body.seed);
        if (typeof body.size === 'string' && body.size !== '') args.size = body.size;
        if (Number.isFinite(body.megapixels)) args.megapixels = body.megapixels;
        try {
            runtime.log('info', `衣柜面板出图：seed=${args.seed ?? '随机'}`);
            const controller = new AbortController();
            const value = await tool.execute(args, {
                signal: controller.signal,
                callId: `wardrobe-draw-${Date.now()}`,
            });
            sendJson(response, 200, {
                ok: true,
                path: value?.path ?? '',
                files: Array.isArray(value?.files) ? value.files : [],
                seed: value?.seed,
                seconds: value?.seconds,
            });
        } catch (error) {
            sendJson(response, 500, { ok: false, error: errorMessage(error) });
        }
    });

    const dispose = () => {
        for (const disposer of disposers) {
            try {
                disposer();
            } catch {
                // 卸载阶段的异常没有意义，吞掉。
            }
        }
    };
    ctx.effect(() => dispose, 'dsh-comfy-suite: gallery routes');
    runtime.log('info', `作品库端点已注册（${disposers.length} 个）`);
    return dispose;
}

/**
 * 把像素尺寸折算成 draw_image 认的画幅字符串。
 *
 * 只认 1:1 / 3:4 / 4:3 / 2:3 / 3:2 / 16:9 / 9:16 七种；取长宽比最接近的一个，
 * 这样"再画一张"得到的是同一比例，而不是被迫退回 1:1。
 */
export function aspectOf(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return '1:1';
    const ratio = width / height;
    const candidates = [
        ['1:1', 1],
        ['3:4', 3 / 4],
        ['4:3', 4 / 3],
        ['2:3', 2 / 3],
        ['3:2', 3 / 2],
        ['16:9', 16 / 9],
        ['9:16', 9 / 16],
    ];
    let best = candidates[0];
    for (const candidate of candidates) {
        if (Math.abs(Math.log(ratio / candidate[1])) < Math.abs(Math.log(ratio / best[1]))) best = candidate;
    }
    return best[0];
}