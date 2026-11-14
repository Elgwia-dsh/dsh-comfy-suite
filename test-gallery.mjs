/**
 * 作品库 / 风格库的单元测试（不启动 DSH、不联网、不碰真实出图目录）。
 *
 * 覆盖的是这次改动里**最容易悄悄坏掉**的地方：
 *   1. 文件头解析（PNG / JPEG / WebP）—— 坏了只是尺寸显示为空，很难发现；
 *   2. 路径包含判定 —— 坏了就是任意文件读取；
 *   3. 记忆日志的两种匹配（整路径 / 文件名）；
 *   4. 检索、收藏过滤、排序、分页；
 *   5. 删除必须进回收站、且拒绝根目录之外的文件；
 *   6. 风格库的检索/拼句（含负面词必须单独给出）。
 *
 * 全程用系统临时目录。
 */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
    buildGallery,
    decodeId,
    encodeId,
    enrichFromMemory,
    isInside,
    listImageFiles,
    moveToTrash,
    parseImageSize,
    readImageBytes,
    readState,
    resolveQwenOutputDir,
    writeState,
} from './lib/gallery.js';
import { composePrompt, loadPresets, searchPresets } from './lib/presets.js';
import { makePresetsTool } from './lib/tools.js';
import { aspectOf } from './lib/gallery-routes.js';

const root = await mkdtemp(join(tmpdir(), 'suite-gallery-test-'));

/* ---------------------------------------------------------- 构造测试图片 ---- */

/** 最小 PNG 头（8 字节签名 + IHDR 段头 + 宽高），足够让解析器读出尺寸。 */
function png(width, height) {
    const buffer = Buffer.alloc(33);
    buffer.writeUInt32BE(0x89504e47, 0);
    buffer.writeUInt32BE(0x0d0a1a0a, 4);
    buffer.writeUInt32BE(13, 8);
    buffer.write('IHDR', 12, 'ascii');
    buffer.writeUInt32BE(width, 16);
    buffer.writeUInt32BE(height, 20);
    return buffer;
}

/** 最小 JPEG 头：SOI + APP0 段 + SOF0 段。 */
function jpeg(width, height) {
    const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
    const sof = Buffer.alloc(19);
    sof[0] = 0xff;
    sof[1] = 0xc0;
    sof.writeUInt16BE(17, 2);
    sof[4] = 8;
    sof.writeUInt16BE(height, 5);
    sof.writeUInt16BE(width, 7);
    sof[9] = 3;
    return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.from([0xff, 0xd9])]);
}

/** 最小 WebP（VP8X）头。 */
function webp(width, height) {
    const buffer = Buffer.alloc(40);
    buffer.write('RIFF', 0, 'ascii');
    buffer.writeUInt32LE(32, 4);
    buffer.write('WEBP', 8, 'ascii');
    buffer.write('VP8X', 12, 'ascii');
    buffer.writeUInt32LE(10, 16);
    buffer[24] = (width - 1) & 0xff;
    buffer[25] = ((width - 1) >> 8) & 0xff;
    buffer[26] = ((width - 1) >> 16) & 0xff;
    buffer[27] = (height - 1) & 0xff;
    buffer[28] = ((height - 1) >> 8) & 0xff;
    buffer[29] = ((height - 1) >> 16) & 0xff;
    return buffer;
}

// ── 1. 文件头解析 ───────────────────────────────────────────────────────
{
    assert.deepEqual(parseImageSize(png(864, 1152)), { width: 864, height: 1152 });
    assert.deepEqual(parseImageSize(jpeg(1504, 992)), { width: 1504, height: 992 });
    assert.deepEqual(parseImageSize(webp(512, 768)), { width: 512, height: 768 });
    assert.equal(parseImageSize(Buffer.from('not an image at all........')), undefined);
    assert.equal(parseImageSize(Buffer.alloc(4)), undefined);
    console.log('ok - PNG / JPEG / WebP headers parse to the right pixel size');
}

// ── 2. id 编解码与路径包含 ──────────────────────────────────────────────
{
    const file = join(root, '千问1生图', '一只猫_Qwen2.1_864x1152_01.png');
    assert.equal(decodeId(encodeId(file)), file);
    assert.equal(decodeId(''), '');
    assert.equal(decodeId('!!!not base64!!!'), '');

    const base = join(root, 'out');
    assert.equal(isInside(base, join(base, 'a.png')), true);
    assert.equal(isInside(base, join(base, 'sub', 'a.png')), true);
    assert.equal(isInside(base, base), true);
    assert.equal(isInside(base, join(base, '..', 'evil.png')), false);
    assert.equal(isInside(base, join(root, 'other', 'a.png')), false);
    // 前缀相同的兄弟目录不能被当成"在根内"
    assert.equal(isInside(join(root, 'out'), join(root, 'output2', 'a.png')), false);
    console.log('ok - ids round-trip and traversal is refused');
}

// ── 3. 扫描：只收图片、跳过隐藏与下划线文件 ─────────────────────────────
{
    const out = join(root, 'out');
    await mkdir(join(out, 'sub'), { recursive: true });
    await writeFile(join(out, 'a.png'), png(640, 480));
    await writeFile(join(out, 'b.webp'), webp(320, 200));
    await writeFile(join(out, '_正在生成图片.webp'), webp(10, 10));
    await writeFile(join(out, '.hidden.png'), png(1, 1));
    await writeFile(join(out, 'notes.txt'), 'not an image');
    await writeFile(join(out, 'sub', 'c.png'), png(1024, 1024));

    const files = await listImageFiles(out);
    const names = files.map((file) => file.replace(/\\/g, '/').split('/').pop()).sort();
    assert.deepEqual(names, ['a.png', 'b.webp', 'c.png']);
    console.log('ok - scanning keeps images and drops temp/hidden/other files');
}

// ── 4. 记忆日志：整路径优先、文件名兜底 ─────────────────────────────────
{
    const out = join(root, 'out');
    const items = [
        { id: encodeId(join(out, 'a.png')), file: join(out, 'a.png'), name: 'a.png' },
        { id: encodeId(join(out, 'moved', 'c.png')), file: join(out, 'moved', 'c.png'), name: 'c.png' },
        { id: encodeId(join(out, 'unknown.png')), file: join(out, 'unknown.png'), name: 'unknown.png' },
    ];
    const records = [
        { path: join(out, 'a.png'), prompt: '整路径命中', seed: 1, steps: 8, seconds: 12.5, ts: '2026-11-04T00:00:00.000Z' },
        // 文件被挪进子目录，日志里还是老路径 → 按文件名兜底
        { path: join(out, 'c.png'), prompt: '文件名命中', seed: 2 },
    ];
    const enriched = enrichFromMemory(items, records);
    assert.equal(enriched[0].prompt, '整路径命中');
    assert.equal(enriched[0].seed, 1);
    assert.equal(enriched[1].prompt, '文件名命中');
    assert.equal(enriched[2].prompt, undefined);
    console.log('ok - memory joins by full path first, then by file name');
}

// ── 5. 列表：检索、收藏、排序、分页、统计 ───────────────────────────────
{
    const out = join(root, 'out');
    const records = [
        { path: join(out, 'a.png'), prompt: '橘猫坐在窗台上' },
        { path: join(out, 'b.webp'), prompt: '海边日落' },
        { path: join(out, 'sub', 'c.png'), prompt: '水墨山水' },
    ];
    const aId = encodeId(join(out, 'a.png'));
    const state = { version: 1, favorites: [aId], hidden: [] };

    const all = await buildGallery({ roots: [out], memory: records, state });
    assert.equal(all.total, 3);
    assert.equal(all.stats.count, 3);
    assert.equal(all.stats.favorites, 1);
    assert.ok(all.stats.bytes > 0);

    const byQuery = await buildGallery({ roots: [out], memory: records, state, query: '水墨' });
    assert.equal(byQuery.total, 1);
    assert.equal(byQuery.items[0].name, 'c.png');

    const bySeedLike = await buildGallery({ roots: [out], memory: records, state, query: '橘猫' });
    assert.equal(bySeedLike.total, 1);

    const favOnly = await buildGallery({ roots: [out], memory: records, state, scope: 'favorite' });
    assert.equal(favOnly.total, 1);
    assert.equal(favOnly.items[0].favorite, true);

    const paged = await buildGallery({ roots: [out], memory: records, state, limit: 2 });
    assert.equal(paged.items.length, 2);
    assert.equal(paged.total, 3);

    // 墓碑的语义是「这次删除」，不是永久拉黑：文件仍在扫描根里（例如从回收站
// 放回原位）就应该重新出现 —— 旧实现按 id 永久过滤，与注释承诺的
//「放回来就等于撤销」相反，文件只能靠手改 gallery-state.json 才回得来。
const restored = await buildGallery({ roots: [out], memory: records, state: { version: 1, favorites: [], hidden: [aId] } });
assert.equal(restored.total, 3);
console.log('ok - search / favourites / paging / tombstones all behave');
}

// ── 6. 删除：进回收站、越界拒绝 ─────────────────────────────────────────
{
    const out = join(root, 'out');
    const target = join(out, 'a.png');
    const trash = join(root, 'data', 'trash');
    const moved = await moveToTrash(trash, target, [out]);
    assert.equal(moved.ok, true);
    await stat(moved.moved); // 回收站里真的存在
    await assert.rejects(stat(target)); // 原位置已经不在了

    const outside = join(root, 'elsewhere.png');
    await writeFile(outside, png(10, 10));
    const refused = await moveToTrash(trash, outside, [out]);
    assert.equal(refused.ok, false);
    await stat(outside); // 越界文件必须原样还在
    console.log('ok - delete moves into trash and refuses paths outside the roots');
}

// ── 7. 读字节：根外拒绝 ─────────────────────────────────────────────────
{
    const out = join(root, 'out');
    const inside = await readImageBytes(join(out, 'b.webp'), [out]);
    assert.equal(inside.ok, true);
    assert.ok(inside.bytes.length > 0);

    const outside = await readImageBytes(join(root, 'elsewhere.png'), [out]);
    assert.equal(outside.ok, false);
    assert.equal(outside.status, 403);
    console.log('ok - byte serving is limited to the scanned roots');
}

// ── 8. 收藏状态：原子写、坏文件不炸 ─────────────────────────────────────
{
    const path = join(root, 'state', 'gallery-state.json');
    await writeState(path, { favorites: ['x', 'y'], hidden: ['z'] });
    const loaded = await readState(path);
    assert.deepEqual(loaded.favorites, ['x', 'y']);
    assert.deepEqual(loaded.hidden, ['z']);

    await writeFile(path, '{ broken json');
    const fallback = await readState(path);
    assert.deepEqual(fallback, { version: 1, favorites: [], hidden: [] });
    console.log('ok - favourites persist atomically and survive a corrupt file');
}

// ── 9. 出图目录解析 ─────────────────────────────────────────────────────
{
    const home = join(root, 'home');
    await mkdir(join(home, 'Desktop'), { recursive: true });
    assert.equal(resolveQwenOutputDir('', home), join(home, 'Desktop', '千问1生图'));
    assert.equal(resolveQwenOutputDir('我的图', home), join(home, 'Desktop', '我的图'));
    assert.equal(resolveQwenOutputDir('D:/pics/qwen', home), 'D:\\pics\\qwen');
    console.log('ok - output dir resolution matches qwen-paint (default / relative / absolute)');
}

// ── 10. 风格库：检索与拼句 ──────────────────────────────────────────────
{
    const library = await loadPresets();
    assert.ok(library.items.length >= 50, `预设太少：${library.items.length}`);

    const watercolor = searchPresets(library.items, { query: '水彩' });
    assert.ok(watercolor.some((item) => item.id === 'illu-watercolor'));

    const empty = searchPresets(library.items, { query: '这个词一定不存在' });
    assert.equal(empty.length, 0);

    const kindOnly = searchPresets(library.items, { kind: 'negative' });
    assert.ok(kindOnly.length >= 2);
    assert.ok(kindOnly.every((item) => item.kind === 'negative'));

    const composed = composePrompt(library.items, {
        ids: ['illu-watercolor', 'light-golden', 'neg-common'],
        base: '一只橘猫坐在窗台上，',
    });
    assert.ok(composed.prompt.startsWith('一只橘猫坐在窗台上'));
    assert.ok(composed.prompt.includes('水彩'));
    assert.ok(composed.prompt.includes('黄金时刻'));
    // 负面词绝不能混进正向提示词
    assert.equal(composed.prompt.includes('低分辨率'), false);
    assert.ok(composed.negative.includes('低分辨率'));
    console.log('ok - style library searches and composes without leaking negatives into the prompt');
}

// ── 11. 风格库工具：四种动作都能跑 ──────────────────────────────────────
{
    const tool = makePresetsTool({});
    const kinds = await tool.execute({ action: 'kinds' });
    assert.ok(kinds.text.includes('style'));

    const search = await tool.execute({ action: 'search', query: '海报' });
    assert.ok(search.text.includes('poster-') || search.text.includes('海报'));

    const got = await tool.execute({ action: 'get', ids: ['illu-ink'] });
    assert.ok(got.text.includes('水墨'));

    const composed = await tool.execute({ action: 'compose', ids: ['illu-ink', 'neg-common'], prompt: '远山' });
    assert.ok(composed.prompt.startsWith('远山'));
    assert.ok(composed.negative.length > 0);

    const missing = await tool.execute({ action: 'compose', ids: ['no-such-id'] });
    assert.ok(missing.text.includes('没有可用的 id'));

    // 工具声明必须自洽：render 能把 execute 的返回值变成 text block
    const rendered = tool.output.render({}, composed);
    assert.equal(rendered[0].type, 'text');
    console.log('ok - image_presets tool answers kinds/search/get/compose and renders text');
}

// ── 12. 画幅折算 ────────────────────────────────────────────────────────
{
    assert.equal(aspectOf(864, 1152), '3:4');
    assert.equal(aspectOf(1152, 864), '4:3');
    assert.equal(aspectOf(992, 992), '1:1');
    assert.equal(aspectOf(1504, 992), '3:2');
    assert.equal(aspectOf(1280, 720), '16:9');
    assert.equal(aspectOf(720, 1280), '9:16');
    assert.equal(aspectOf(0, 0), '1:1');
    console.log('ok - pixel size maps back to the closest supported aspect');
}

await rm(root, { recursive: true, force: true });
console.log('OK gallery + presets tests passed');