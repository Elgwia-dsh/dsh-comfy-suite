/**
 * dsh-comfy-suite — 作品库（Gallery）
 * ============================================================================
 * 借鉴 dsh-image-gen 的「图库」：把**已经出过的图**变成可浏览、可检索、
 * 可复用、可清理的资产，而不是散落在桌面文件夹里的一次性文件。
 *
 * ## 为什么是"扫目录"而不是"记数据库"
 *
 * dsh-image-gen 的图库索引是浏览器 localStorage + 消息树合并出来的，因为它
 * 的图来自云端、没有本地根目录。本套件的图**一直就在磁盘上**：
 *
 *   · draw_image / inpaint_image / upscale_image → `<outputDir>/…png`
 *   · comfyui_run 的工作流产物                     → ComfyUI 的 output 目录
 *
 * 所以这里的**真相是文件系统**，索引只做三件事：
 *   ① 扫出图片并读尺寸（PNG / JPEG / WebP 文件头，不依赖任何图像库）；
 *   ② 用已有的 `.qwen-paint-memory.jsonl` 把 prompt / seed / 步数贴回去
 *      （那份日志是 qwen-paint 早就写好给 dsh-auto-memory 用的，这里只是复用）；
 *   ③ 存**用户状态**（收藏、已删除的墓碑）。
 *
 * 好处：插件装之前生成的图、在别的工具里丢进目录的图，一样会出现；
 * 坏处：没有"生成批次"这种概念 —— 用文件名前缀和 mtime 兜底（够用）。
 *
 * ## 安全边界
 *
 * 所有对外条目都带 `id`（绝对路径的 base64url）。读文件 / 删除前一律
 * **反解 id → 路径 → 必须在扫描根之内**，`..` 穿越在解析后就被挡掉。
 * 删除不是 unlink，而是**移进 trash 目录**：误删可恢复。
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, open, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

/** 作品库认的图片后缀。 */
export const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

/** 扫描上限：一次最多列这么多张，防止误指到超大目录把面板拖死。 */
export const MAX_FILES = 4000;

/** 扫描深度上限。 */
const MAX_DEPTH = 3;

/** 目录级的忽略名单（ComfyUI 的 output 里会有 input/temp 之类的兄弟目录）。 */
const SKIP_DIRS = new Set(['node_modules', '.git', '.cache']);

/* ------------------------------------------------------------------ 目录解析 ---- */

/**
 * 出图目录的**基目录**（桌面优先），与 qwen-paint 的 defaultOutputBase 同源。
 *
 * 这里不 import 对方的私有函数：它没导出，而且换了实现也不该让图库跟着崩。
 * 判据保持完全一致 —— `Desktop` 与中文 `桌面` 都试，都没有就退主目录。
 */
export function defaultOutputBase(home = process.env.HOME ?? process.env.USERPROFILE ?? homedir()) {
    if (process.env.XDG_DESKTOP_DIR !== undefined && existsSync(process.env.XDG_DESKTOP_DIR)) {
        return process.env.XDG_DESKTOP_DIR;
    }
    for (const dir of [join(home, 'Desktop'), join(home, '桌面')]) {
        if (existsSync(dir)) return dir;
    }
    return home;
}

/**
 * 把配置里的 `outputDir` 解析成绝对路径。
 *
 * 与 qwen-paint 的 resolveOutputDir 行为对齐（绝对路径照用、相对路径挂到桌面下、
 * 空值走默认），但**不**做写权限探测 —— 图库只读，写权限是出图那边的事。
 */
export function resolveQwenOutputDir(raw, home) {
    const text = String(raw ?? '').trim();
    if (text === '') return join(defaultOutputBase(home), '千问1生图');
    return isAbsolute(text) ? resolve(text) : resolve(defaultOutputBase(home), text);
}

/* ------------------------------------------------------------------ 尺寸解析 ---- */

/**
 * 从图片文件头读出像素尺寸。零依赖：PNG / JPEG / WebP 三种够覆盖本套件的产物。
 *
 * 读不出来就返回 undefined（不是错误）：作品库里显示"未知尺寸"好过整行消失。
 */
export function parseImageSize(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 16) return undefined;
    // PNG：8 字节签名 + 4 字节长度 + "IHDR" + 宽高（大端 32 位）
    if (buffer.length >= 24
        && buffer.readUInt32BE(0) === 0x89504e47
        && buffer.toString('ascii', 12, 16) === 'IHDR') {
        return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    // WebP：RIFF....WEBP
    if (buffer.length >= 30
        && buffer.toString('ascii', 0, 4) === 'RIFF'
        && buffer.toString('ascii', 8, 12) === 'WEBP') {
        const kind = buffer.toString('ascii', 12, 16);
        if (kind === 'VP8X') {
            // 24 位小端，值是"宽-1 / 高-1"
            const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
            const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
            return { width, height };
        }
        if (kind === 'VP8 ') {
            // 关键帧起始码 9d 01 2a 之后的 14 位宽高
            const start = 26;
            if (buffer.length < start + 4) return undefined;
            return { width: buffer.readUInt16LE(start) & 0x3fff, height: buffer.readUInt16LE(start + 2) & 0x3fff };
        }
        if (kind === 'VP8L') {
            const bits = buffer.readUInt32LE(21);
            return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
        }
    }
    // JPEG：扫段找 SOFn（0xC0–0xCF，剔除 C4/C8/CC），段里第 5/7 字节是高/宽
    if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
        let offset = 2;
        while (offset + 9 < buffer.length) {
            if (buffer[offset] !== 0xff) { offset += 1; continue; }
            const marker = buffer[offset + 1];
            if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
            const length = buffer.readUInt16BE(offset + 2);
            if (length < 2) return undefined;
            const isSof = marker >= 0xc0 && marker <= 0xcf
                && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
            if (isSof && offset + 9 <= buffer.length) {
                return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
            }
            offset += 2 + length;
        }
    }
    return undefined;
}

/* ------------------------------------------------------------------ id 编解码 ---- */

/** 文件绝对路径 → 稳定 id（base64url，URL 安全、可反解）。 */
export function encodeId(file) {
    return Buffer.from(String(file), 'utf8').toString('base64url');
}

/** id → 绝对路径；解不开返回空串（调用方按 404 处理）。 */
export function decodeId(id) {
    const text = String(id ?? '');
    // Node 的 base64 解码器会**静默跳过**非法字符，所以必须先卡字符集，
    // 再用"重新编码是否一致"确认解出来的确实是一个原样编码的路径。
    if (text === '' || !/^[A-Za-z0-9_-]+$/u.test(text)) return '';
    try {
        const file = Buffer.from(text, 'base64url').toString('utf8');
        return encodeId(file) === text ? file : '';
    } catch {
        return '';
    }
}

/**
 * 路径是否落在某个扫描根之内（含根本身）。
 *
 * 这是所有读/删操作的**唯一**准入判据：先 `resolve` 再比较，`../` 之类在
 * 解析阶段就被折叠掉，不会出现"看着在根里、其实在外面"的情况。
 */
export function isInside(root, file) {
    const base = resolve(root);
    const target = resolve(file);
    if (target === base) return true;
    return target.startsWith(base + sep);
}

/* ------------------------------------------------------------------ 扫描 ---- */

/** 文件名是否该出现在作品库里（跳过隐藏文件与 `_` 前缀的临时/动画资源）。 */
export function isGalleryFile(name) {
    if (name.startsWith('.') || name.startsWith('_')) return false;
    return IMAGE_EXT.test(name);
}

async function readHead(file) {
    const handle = await open(file, 'r');
    try {
        const buffer = Buffer.alloc(64 * 1024);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        return buffer.subarray(0, bytesRead);
    } finally {
        await handle.close();
    }
}

async function walk(root, out, depth) {
    if (out.length >= MAX_FILES || depth > MAX_DEPTH) return;
    let entries;
    try {
        entries = await readdir(root, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        if (out.length >= MAX_FILES) return;
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
            await walk(join(root, entry.name), out, depth + 1);
            continue;
        }
        if (!entry.isFile() || !isGalleryFile(entry.name)) continue;
        out.push(join(root, entry.name));
    }
}

/**
 * 扫一个根目录下的所有图片（最多 3 层）。返回轻量条目，不含尺寸。
 * 目录不存在时安静地返回空数组 —— 作品库不该因为某个根没建好就整体报错。
 */
export async function listImageFiles(root) {
    const files = [];
    await walk(resolve(root), files, 0);
    return files;
}

/**
 * 文件头解析结果的**进程内缓存**（★ 2026-11-12 性能修复）。
 *
 * 为什么需要：`describeFiles` 以前对**每张图**都 `open → read 64 KB → close`，
 * 而作品库面板每次刷新都会重新扫一遍整个目录。4000 张图就是 4000 次打开 +
 * 256 MB 的临时缓冲分配（还都是顺序 await 的）—— 面板一卡就是几秒，SSD 也在白转。
 *
 * 缓存键是**绝对路径**，命中条件是 `mtimeMs + size` 都没变 —— 图被重画/替换后
 * 会自然失效，不会显示旧尺寸。只缓存"文件头解析结果"这几十字节，不缓存图片本体。
 */
const HEAD_CACHE = new Map();
const HEAD_CACHE_MAX = 6000;

/** 实际发生过多少次"读文件头"（缓存命中不计）。只给回归断言用。 */
let headReads = 0;

/** 清空缓存 / 读计数（测试用；生产不会调用）。 */
export function clearHeadCache() {
    HEAD_CACHE.clear();
    headReads = 0;
}

/** 缓存统计（测试用）。 */
export function cacheStats() {
    return { entries: HEAD_CACHE.size, headReads };
}

/** 小并发池：文件多时别一个个串着等（磁盘 IO 本来就并行更快）。 */
async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    const worker = async () => {
        for (;;) {
            const index = next;
            next += 1;
            if (index >= items.length) return;
            out[index] = await fn(items[index], index);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
}

/** 把一批文件变成条目（stat + 头像 + 尺寸），单个文件失败不影响其余。 */
export async function describeFiles(files, roots) {
    const items = await mapLimit(files, 8, async (file) => {
        try {
            const info = await stat(file);
            if (!info.isFile()) return undefined;
            const cached = HEAD_CACHE.get(file);
            let width;
            let height;
            if (cached !== undefined && cached.mtimeMs === info.mtimeMs && cached.size === info.size) {
                width = cached.width;
                height = cached.height;
            } else {
                let size;
                try {
                    headReads += 1;
                    size = parseImageSize(await readHead(file));
                } catch {
                    size = undefined;
                }
                width = size?.width;
                height = size?.height;
                if (HEAD_CACHE.size >= HEAD_CACHE_MAX) {
                    // 简单的 FIFO 淘汰：Map 按插入顺序迭代，删最早那一条。
                    const oldest = HEAD_CACHE.keys().next();
                    if (!oldest.done) HEAD_CACHE.delete(oldest.value);
                }
                HEAD_CACHE.set(file, { mtimeMs: info.mtimeMs, size: info.size, width, height });
            }
            const root = roots.find((candidate) => isInside(candidate, file)) ?? '';
            const relPath = root === '' ? basename(file) : relative(root, file).split(sep).join('/');
            return {
                id: encodeId(file),
                file,
                name: basename(file),
                relPath,
                root,
                mtime: info.mtimeMs,
                size: info.size,
                width,
                height,
            };
        } catch {
            // 扫描期间被删/被占用：跳过这张，不影响整批。
            return undefined;
        }
    });
    return items.filter((item) => item !== undefined);
}

/* ------------------------------------------------------------------ 记忆与状态 ---- */

/** 出图日志的解析缓存：文件没变就不再逐行 JSON.parse 一遍（★ 2026-11-12）。 */
const MEMORY_CACHE = new Map();

/**
 * 读 qwen-paint 的出图日志（每行一条 JSON）。
 *
 * 那份文件是出图成功后才 append 的，可能很大也可能被用户删掉 ——
 * 读不到就返回空数组，图库退化为"只有文件名"。
 *
 * ★ 2026-11-12：按 `mtime + size` 缓存解析结果。作者机器上这份日志 29 KB、
 *   每条图 200 字左右，几百张之后就是几百 KB；面板每换一次筛选/排序都会再读一次、
 *   再逐行 parse 一遍，纯属重复劳动。日志一 append，mtime/size 必变 → 自动重读。
 */
export async function readMemoryRecords(path) {
    try {
        const info = await stat(path);
        if (!info.isFile()) return [];
        const hit = MEMORY_CACHE.get(path);
        if (hit !== undefined && hit.mtimeMs === info.mtimeMs && hit.size === info.size) return hit.records;
        const text = await readFile(path, 'utf8');
        const records = [];
        for (const line of text.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (trimmed === '') continue;
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed !== null && typeof parsed === 'object') records.push(parsed);
            } catch {
                // 半行/损坏行：跳过。
            }
        }
        MEMORY_CACHE.set(path, { mtimeMs: info.mtimeMs, size: info.size, records });
        return records;
    } catch {
        return [];
    }
}

const normalizeKey = (path) => String(path ?? '').replace(/\\/g, '/').toLowerCase();

/**
 * 把出图日志里的 prompt / seed / 步数贴回条目。
 *
 * 先按**完整路径**匹配，失败再按**文件名**匹配：日志里的 path 是写入当时的
 * 绝对路径，用户把图挪进子目录、或换盘符之后，文件名仍然对得上。
 */
export function enrichFromMemory(items, records) {
    if (!Array.isArray(records) || records.length === 0) return items;
    const byPath = new Map();
    const byName = new Map();
    for (const record of records) {
        if (typeof record?.path !== 'string' || record.path === '') continue;
        byPath.set(normalizeKey(record.path), record);
        byName.set(normalizeKey(basename(record.path.replace(/\\/g, '/'))), record);
    }
    return items.map((item) => {
        const hit = byPath.get(normalizeKey(item.file)) ?? byName.get(normalizeKey(item.name));
        if (hit === undefined) return item;
        return {
            ...item,
            prompt: typeof hit.prompt === 'string' ? hit.prompt : '',
            negative: typeof hit.negative === 'string' ? hit.negative : '',
            seed: Number.isFinite(hit.seed) ? hit.seed : undefined,
            steps: Number.isFinite(hit.steps) ? hit.steps : undefined,
            seconds: Number.isFinite(hit.seconds) ? hit.seconds : undefined,
            ts: typeof hit.ts === 'string' ? hit.ts : undefined,
            backend: typeof hit.backend === 'string' ? hit.backend : undefined,
        };
    });
}

/** 读用户状态（收藏 / 墓碑）；文件缺失或损坏都返回空状态。 */
export async function readState(path) {
    try {
        const parsed = JSON.parse(await readFile(path, 'utf8'));
        return {
            version: 1,
            favorites: Array.isArray(parsed?.favorites) ? parsed.favorites.filter((x) => typeof x === 'string') : [],
            hidden: Array.isArray(parsed?.hidden) ? parsed.hidden.filter((x) => typeof x === 'string') : [],
        };
    } catch {
        return { version: 1, favorites: [], hidden: [] };
    }
}

/** 原子写状态：先写临时文件再 rename，避免半截 JSON 把收藏清空。
 *
 * 临时名带随机后缀：固定成 `.tmp-<pid>` 时，同进程两个并发请求（双击收藏、
 * 两个标签页）共用同一个临时文件，一个 rename 成功后另一个必 ENOENT 或互相覆盖。
 */
export async function writeState(path, state) {
    await mkdir(dirname(path), { recursive: true });
    const payload = `${JSON.stringify({ version: 1, favorites: state.favorites ?? [], hidden: state.hidden ?? [] }, null, 2)}\n`;
    const temp = `${path}.tmp-${process.pid}-${randomUUID()}`;
    try {
        await writeFile(temp, payload, 'utf8');
        await rename(temp, path);
    }
    catch (error) {
        await unlink(temp).catch(() => undefined);
        throw error;
    }
}

/* ------------------------------------------------------------------ 组装 ---- */

const SCAN_TTL_MS = 3_000;
const SCAN_CACHE = new Map();

/** 丢弃扫描快照（删除/收藏/重画之后调用，下一次请求立刻重扫）。 */
export function invalidateScanCache() {
    SCAN_CACHE.clear();
}

/**
 * Scan + describe every root, with a short TTL snapshot.
 *
 * The panel asks for the gallery on every keystroke (debounced), on scope/sort
 * changes, and after each favourite/delete. A full recursive readdir plus one
 * stat per file costs real time once a folder holds thousands of images, and
 * the answers cannot change within a few seconds of each other. The snapshot
 * holds only file facts (path/size/mtime/pixels); favourites and tombstones are
 * applied per call, so toggling them never shows stale state.
 */
async function scanRoots(roots) {
    const key = roots.join('|');
    const hit = SCAN_CACHE.get(key);
    if (hit !== undefined && Date.now() - hit.at < SCAN_TTL_MS) return hit.items;
    const files = [];
    for (const root of roots) {
        const found = await listImageFiles(root);
        files.push(...found);
    }
    // 同一张图被两个根都覆盖时（比如把出图目录指到了 ComfyUI 的 output 里）只留一份。
    const unique = [...new Map(files.map((file) => [resolve(file).toLowerCase(), file])).values()];
    const described = await describeFiles(unique, roots);
    if (SCAN_CACHE.size > 4) SCAN_CACHE.clear();
    SCAN_CACHE.set(key, { at: Date.now(), items: described });
    return described;
}

/**
 * 组装作品库条目：扫描 → 贴记忆 → 贴用户状态 → 过滤 → 排序。
 *
 * @param {object} options
 * @param {string[]} options.roots        要扫的根目录（去重后按序）
 * @param {object[]} [options.memory]     出图日志记录
 * @param {object} [options.state]        收藏 / 墓碑
 * @param {string} [options.query]        关键词（prompt / 文件名 / seed）
 * @param {'all'|'favorite'} [options.scope]
 * @param {'newest'|'oldest'} [options.sort]
 * @param {number} [options.offset]
 * @param {number} [options.limit]
 */
export async function buildGallery(options) {
    const roots = [...new Set((options.roots ?? []).filter((root) => typeof root === 'string' && root !== '').map((root) => resolve(root)))];
    const state = options.state ?? { favorites: [], hidden: [] };
    const favorites = new Set(state.favorites ?? []);
    // 墓碑（hidden）只描述"这次删除"，不是永久拉黑：文件一旦又在扫描根里出现
    // （用户从回收站放回来、或同名重出），就应该重新显示。旧实现按 id 永久过滤，
    // 与"放回来就等于撤销"的注释正好相反。
    const hidden = new Set(state.hidden ?? []);

    const described = await scanRoots(roots);
    // 扫描结果里重新出现的文件，其墓碑立刻失效。
    for (const item of described) hidden.delete(item.id);
    const enriched = enrichFromMemory(described, options.memory ?? [])
        .filter((item) => !hidden.has(item.id))
        .map((item) => ({ ...item, favorite: favorites.has(item.id) }));

    const query = String(options.query ?? '').trim().toLowerCase();
    const scope = options.scope === 'favorite' ? 'favorite' : 'all';
    const matched = enriched.filter((item) => {
        if (scope === 'favorite' && item.favorite !== true) return false;
        if (query === '') return true;
        return [
            item.prompt,
            item.name,
            item.relPath,
            item.seed === undefined ? '' : String(item.seed),
        ].some((text) => typeof text === 'string' && text.toLowerCase().includes(query));
    });

    // 同 mtime 的条目（批量拷贝/解压出来的图经常毫秒相同）按文件名兜底，
    // 否则每次刷新顺序都可能变 —— 面板看起来会"跳"。
    matched.sort((a, b) => {
        const delta = options.sort === 'oldest' ? a.mtime - b.mtime : b.mtime - a.mtime;
        return delta !== 0 ? delta : a.name.localeCompare(b.name);
    });

    const total = matched.length;
    const offset = Math.max(0, Math.trunc(options.offset ?? 0) || 0);
    const limit = Math.max(1, Math.min(500, Math.trunc(options.limit ?? 120) || 120));
    const items = matched.slice(offset, offset + limit);

    return {
        items,
        total,
        offset,
        limit,
        // ★ 2026-11-12：一遍扫完（旧写法对每个根都 filter 一次，O(条目数 × 根数)）。
        stats: (() => {
            const byRoot = new Map(roots.map((root) => [root, { count: 0, bytes: 0 }]));
            let bytes = 0;
            let favoriteCount = 0;
            for (const item of enriched) {
                const size = Number.isFinite(item.size) ? item.size : 0;
                bytes += size;
                if (item.favorite) favoriteCount += 1;
                const bucket = byRoot.get(resolve(item.root));
                if (bucket !== undefined) {
                    bucket.count += 1;
                    bucket.bytes += size;
                }
            }
            return {
                count: enriched.length,
                favorites: favoriteCount,
                bytes,
                roots: roots.map((root) => ({ root, ...byRoot.get(root) })),
            };
        })(),
    };
}

/* ------------------------------------------------------------------ 写操作 ---- */

/**
 * 删除 = **移进回收站**（不是 unlink）。
 *
 * 图库是本机文件的门面，误点一下不该让一张抽了十几次才出的图彻底消失。
 * 回收站目录在 `stateDir/trash` 下（调用方传的是数据目录下的 trash 目录本身，
 * 这里**不再**二次拼 `trash` —— 旧写法把文件放进 `trash/trash/`），文件能手动捞回来。
 *
 * 跨卷时必须复制再删：回收站在 DSH 数据目录（可能在 E:），出图目录在 C: 桌面上，
 * 而 rename 跨卷一律 EXDEV —— 那样"删除"在测试机上**从来没成功过**。
 *
 * @returns {{ok: true, moved: string} | {ok: false, error: string}}
 */
export async function moveToTrash(stateDir, file, roots) {
    if (!roots.some((root) => isInside(root, file))) {
        return { ok: false, error: '这个文件不在任何被扫描的目录里，拒绝删除' };
    }
    try {
        if (!existsSync(file)) return { ok: false, error: '文件已经不存在（可能刚被别的程序删掉）' };
        await mkdir(stateDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const target = join(stateDir, `${stamp}__${basename(file)}`);
        try {
            await rename(file, target);
        }
        catch (error) {
            if (error?.code !== 'EXDEV') throw error;
            await copyFile(file, target);
            await unlink(file);
        }
        return { ok: true, moved: target };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}

/** 读一张图的内容（供 `/api/comfy-suite/gallery/file` 用）；拒绝根之外、非图片与超限文件。 */
export async function readImageBytes(file, roots, maxBytes = 48 * 1024 * 1024) {
    if (!roots.some((root) => isInside(root, file))) {
        return { ok: false, status: 403, error: '路径不在作品库的扫描根内' };
    }
    // The scanned roots are user-configurable and could be as wide as a drive;
    // without this check any file under them (a .env, a key file) is readable
    // through the gallery's byte endpoint.
    if (!IMAGE_EXT.test(file)) {
        return { ok: false, status: 403, error: '只能读取图片文件' };
    }
    try {
        const info = await stat(file);
        if (!info.isFile()) return { ok: false, status: 404, error: '不是文件' };
        if (info.size > maxBytes) return { ok: false, status: 413, error: '图片太大，请直接在本地打开' };
        return { ok: true, bytes: await readFile(file) };
    } catch {
        return { ok: false, status: 404, error: '文件不存在' };
    }
}

/** 由后缀推断 content-type（作品库只认三种图）。 */
export function contentTypeOf(file) {
    const ext = extname(file).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.webp') return 'image/webp';
    return 'application/octet-stream';
}

/**
 * 内容指纹：文件名里那串 `<prompt前12字>_<模型>_<宽x高>_01` 对同一次抽卡的多张图
 * 是一样的，所以"同组"用目录 + mtime 相邻来近似，不靠 hash 遍历整个目录。
 */
export function groupKey(item) {
    return createHash('sha1')
        .update(`${item.root}|${item.name.replace(/_\d+(\.[a-z]+)$/i, '')}`)
        .digest('hex')
        .slice(0, 12);
}