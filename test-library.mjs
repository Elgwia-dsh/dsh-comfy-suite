/**
 * dsh-comfy-suite — GHIL 图库回归（2026-11-12 新增）
 *
 * 测的是「捏人」的地基：图库索引读得对、检索命中、id 能解析成真实文件、
 * 引用写法容错。这些错了不会报错，只会悄悄给错图或给空图 —— 最难查的那一类。
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { __internal } from './vendor/qwen-paint/lib/index.js'
import { libraryRoot, normalizeKind, searchLibrary, resolveReference } from './vendor/qwen-paint/lib/library.js'

const { aspectToSize, defaultCharacterPrompt } = __internal
const root = libraryRoot({ comfyMainPy: 'D:\\dsh-video\\a\\ComfyUI\\main.py' })
const cases = []
const test = async (name, fn) => {
    try {
        await fn()
        cases.push(`  ok   ${name}`)
    } catch (error) {
        cases.push(`  FAIL ${name}\n       ${error?.message ?? error}`)
        process.exitCode = 1
    }
}

/* --------------------------------------------------------------- 类型归一 ---- */
await test('中文 / 英文 / 大小写 都归一成目录名', () => {
    assert.equal(normalizeKind('人像'), 'portrait')
    assert.equal(normalizeKind('portrait'), 'portrait')
    assert.equal(normalizeKind('Portrait'), 'portrait')
    assert.equal(normalizeKind('服装'), 'costume')
    assert.equal(normalizeKind('姿势'), 'pose')
    assert.equal(normalizeKind('发型'), 'hair')
    assert.equal(normalizeKind('随便什么'), null)
    assert.equal(normalizeKind(''), null)
})

await test('图库根目录：显式配置 > 从 comfyMainPy 推 > 默认', () => {
    assert.equal(libraryRoot({ ghilRoot: 'E:\\x\\GHIL' }), 'E:\\x\\GHIL')
    assert.ok(libraryRoot({ comfyMainPy: 'D:\\dsh-video\\a\\ComfyUI\\main.py' }).endsWith('models\\GHIL'))
    assert.ok(libraryRoot({}).includes('GHIL'))
})

/* ----------------------------------------------------------------- 检索 ---- */
const portrait = await searchLibrary(root, { kind: '人像', query: '', limit: 5 })
await test('人像图库读得到（1499 条）', () => {
    assert.equal(portrait.error, undefined, portrait.error)
    assert.ok(portrait.total > 1000, `total=${portrait.total}`)
    assert.ok(portrait.items.length === 5)
    assert.ok(portrait.items.every((entry) => entry.id !== '' && entry.path !== ''))
})

await test('关键词检索：短发能命中人像', async () => {
    const hit = await searchLibrary(root, { kind: '人像', query: '短发', limit: 10 })
    assert.ok(hit.matched > 0, '短发 0 命中')
    assert.ok(hit.items.every((entry) => `${entry.title} ${entry.tags}`.includes('短发') || entry.raw.hair === 'ショート'))
})

await test('多关键词是"都要命中"', async () => {
    const both = await searchLibrary(root, { kind: '人像', query: '短发 正脸', limit: 10 })
    const one = await searchLibrary(root, { kind: '人像', query: '短发', limit: 10 })
    assert.ok(both.matched <= one.matched, `两个词命中 ${both.matched} > 一个词 ${one.matched}`)
})

await test('四类都能读，且都非空', async () => {
    for (const kind of ['人像', '服装', '姿势', '发型']) {
        const result = await searchLibrary(root, { kind, limit: 1 })
        assert.equal(result.error, undefined, `${kind}: ${result.error}`)
        assert.ok(result.total > 0, `${kind} 是空的`)
    }
})

await test('类型写错给明确提示，不静默返回空', async () => {
    const bad = await searchLibrary(root, { kind: '鞋子' })
    assert.ok(String(bad.error ?? '').includes('人像'), '提示里应列出可选类型')
})

/* --------------------------------------------------------------- 引用解析 ---- */
await test('纯 id（带类型提示）能解析成真实文件', async () => {
    const first = portrait.items[0]
    const resolved = await resolveReference(root, first.id, '人像')
    assert.equal(resolved.id, first.id)
    assert.equal(resolved.kind, 'portrait')
    assert.ok(existsSync(resolved.path), `文件不存在：${resolved.path}`)
})

await test('ghil:人像/<id> 写法', async () => {
    const first = portrait.items[0]
    const resolved = await resolveReference(root, `ghil:人像/${first.id}`)
    assert.equal(resolved.id, first.id)
    assert.ok(existsSync(resolved.path))
})

await test('本地绝对路径原样放行（不当图库引用）', async () => {
    const resolved = await resolveReference(root, 'C:\\tmp\\a.png', '人像')
    assert.equal(resolved.path, 'C:\\tmp\\a.png')
    assert.equal(resolved.kind, '')
})

await test('不存在的 id 报错并指路', async () => {
    await assert.rejects(
        () => resolveReference(root, 'ghil:人像/no_such_id'),
        (error) => String(error.message).includes('action=list'),
    )
})

/* ------------------------------------------------------------ 尺寸 / 提示词 ---- */
await test('aspectToSize：3:4 + 1MP ≈ 864x1152，且 32 对齐', () => {
    const [w, h] = aspectToSize('3:4', 1)
    assert.equal(w % 32, 0)
    assert.equal(h % 32, 0)
    assert.ok(Math.abs(h / w - 4 / 3) < 0.02, `${w}x${h}`)
    assert.ok(Math.abs((w * h) / 1e6 - 1) < 0.15, `像素 ${w * h}`)
})

await test('aspectToSize：未知画幅回落 3:4，像素有上下限', () => {
    const [w1] = aspectToSize('7:5', 1)
    const [w2] = aspectToSize('3:4', 1)
    assert.equal(w1, w2)
    const [wBig] = aspectToSize('1:1', 99)
    assert.ok(wBig <= 2048)
})

await test('默认提示词按给了哪些参考图逐条点名', () => {
    const two = defaultCharacterPrompt([
        { kind: 'portrait', id: 'a', title: 'x' },
        { kind: 'costume', id: 'b', title: 'y' },
    ])
    assert.ok(two.includes('图1') && two.includes('图2'))
    assert.ok(two.includes('面部特征'))
    assert.ok(two.includes('服装'))
    const one = defaultCharacterPrompt([{ kind: 'portrait', id: 'a', title: 'x' }])
    assert.ok(!one.includes('图2'), '只有一张图时不该提图2')
})

const failed = cases.filter((line) => line.includes('FAIL')).length
console.log('GHIL 图库回归：')
console.log(cases.join('\n'))
console.log(`\n${cases.length - failed}/${cases.length} 通过`)