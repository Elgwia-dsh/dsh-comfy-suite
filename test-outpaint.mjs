/**
 * dsh-comfy-suite — 扩图回归（2026-11-12 新增）
 *
 * 只测**纯函数**（留白计算 / 尺寸读取 / 工具定义形状）：这些是最容易悄悄算错、
 * 又最难在真机出图时看出来的一环 —— 留白算错 8 px，出的图就歪一条边。
 */
import assert from 'node:assert/strict'
import { __internal } from './vendor/qwen-paint/lib/index.js'

const { outpaintPadding, readImageSize, makeOutpaintTool, turbo9StepsForPixels } = __internal
const cases = []
const test = (name, fn) => {
    try {
        fn()
        cases.push(`  ok   ${name}`)
    } catch (error) {
        cases.push(`  FAIL ${name}\n       ${error?.message ?? error}`)
        process.exitCode = 1
    }
}

/* --------------------------------------------------------------- 留白计算 ---- */
test('expand=0.25 → 四边各 25%，且对齐到 8', () => {
    const p = outpaintPadding({ width: 1024, height: 1024 }, { expand: 0.25 })
    assert.deepEqual([p.left, p.top, p.right, p.bottom], [256, 256, 256, 256])
    assert.equal(p.width, 1536)
    assert.equal(p.height, 1536)
    assert.equal(p.mode, 'expand')
})

test('expand 不给时默认 25%', () => {
    const a = outpaintPadding({ width: 800, height: 600 })
    assert.equal(a.left, Math.round((800 * 0.25) / 8) * 8)
})

test('expand > 4 当像素用（256 = 每边 256px）', () => {
    const p = outpaintPadding({ width: 1000, height: 1000 }, { expand: 256 })
    assert.equal(p.left, 256)
    assert.equal(p.width, 1512)
})

test('sides 单独指定：只往右扩', () => {
    const p = outpaintPadding({ width: 1024, height: 1024 }, { sides: { right: 0.5 } })
    assert.deepEqual([p.left, p.top, p.right, p.bottom], [0, 0, 512, 0])
    assert.equal(p.width, 1536)
    assert.equal(p.height, 1024)
})

test('aspect 16:9 把方图扩成宽幅（只补左右）', () => {
    const p = outpaintPadding({ width: 1024, height: 1024 }, { aspect: '16:9' })
    assert.equal(p.mode, 'aspect')
    assert.ok(p.left > 0 && p.right === p.left, '左右对称')
    assert.equal(p.top, 0)
    assert.equal(p.bottom, 0)
    // 1024x1024 → 目标宽 = 1024*16/9 = 1820.4 → 每边 ~398 → 对齐 8 后成图宽 ≈ 1824
    assert.ok(Math.abs(p.width - 1820.4) < 24, `width=${p.width}`)
    assert.ok(p.width > p.height)
})

test('aspect 3:4 把方图扩成竖幅（只补上下）', () => {
    const p = outpaintPadding({ width: 1024, height: 1024 }, { aspect: '3:4' })
    assert.equal(p.left, 0)
    assert.equal(p.right, 0)
    assert.ok(p.top > 0 && p.top === p.bottom)
    assert.ok(p.height > p.width)
})

test('已经是目标比例 → 四边都是 0（由工具层报错，不硬扩）', () => {
    const p = outpaintPadding({ width: 1600, height: 900 }, { aspect: '16:9' })
    assert.equal(p.left + p.right + p.top + p.bottom, 0)
})

test('超过上限时收敛留白（不是缩原图），并标记 clamped', () => {
    const p = outpaintPadding({ width: 2000, height: 2000 }, { expand: 1 }, { maxEdge: 2048 })
    assert.equal(p.clamped, true)
    // 上限 = max(2048, 2000*1.5=3000)；留白对齐 8 之后成图可能是 3008
    assert.ok(Math.abs(p.width - 3000) <= 16, `成图 ${p.width}x${p.height}`)
    assert.equal(p.width % 8, 0, '四边必须对齐到 8')
    assert.equal(p.height, p.width)
    assert.ok(p.left > 0, '仍然要往外扩，只是少扩一点')
})

test('原图比 maxEdge 大时仍可按比例扩', () => {
    const p = outpaintPadding({ width: 3000, height: 3000 }, { expand: 0.1, maxEdge: 2048 })
    assert.equal(p.clamped, false, '上限是原图 1.5 倍，10% 远没到')
    assert.ok(p.width > 3000)
})

test('尺寸非法直接抛错（不猜）', () => {
    assert.throws(() => outpaintPadding({ width: 0, height: 0 }, { expand: 0.2 }))
})

/* --------------------------------------------------------------- 尺寸读取 ---- */
// 最小 PNG：8x4 的 IHDR 就够了（readImageSize 只读头部）
function pngBytes(w, h) {
    const buf = Buffer.alloc(33)
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0)
    buf.writeUInt32BE(w, 16)
    buf.writeUInt32BE(h, 20)
    return buf
}

test('PNG 尺寸', () => {
    assert.deepEqual(readImageSize(pngBytes(1232, 928)), { width: 1232, height: 928 })
})

test('JPEG 尺寸（SOF0 段）', () => {
    // FFD8 + SOI，然后一个假的 APP0 段 + SOF0 段
    const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01])
    const head = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
    const app0 = Buffer.alloc(14, 0)
    const jpg = Buffer.concat([head, app0, sof])
    // SOF0: height=0x0258=600, width=0x0320=800
    assert.deepEqual(readImageSize(jpg), { width: 800, height: 600 })
})

test('认不出的格式返回 null（由工具报错，不瞎猜）', () => {
    assert.equal(readImageSize(Buffer.from('GIF89a................')), null)
    assert.equal(readImageSize(Buffer.alloc(4)), null)
})

/* ------------------------------------------------------------ 大画布加步数 ---- */
test('≤1.15 MP 用基准步数（9 步，模型甜点）', () => {
    assert.equal(turbo9StepsForPixels(1024 * 1024), 9)
    assert.equal(turbo9StepsForPixels(1024 * 1100), 9)
})

test('>1.15 MP 自动加到 16 步（实测新增区锐度高约 50%）', () => {
    assert.equal(turbo9StepsForPixels(1024 * 1360), 16)
    assert.equal(turbo9StepsForPixels(1760 * 992), 16)
})

test('基准步数自己配大了就尊重它，不硬压回 16', () => {
    assert.equal(turbo9StepsForPixels(1760 * 992, 20), 20)
    assert.equal(turbo9StepsForPixels(1024 * 1024, 20), 20)
})

test('步数上限 24（再多 turbo 蒸馏也吃不下）', () => {
    assert.ok(turbo9StepsForPixels(4000 * 4000, 30) <= 30)
    assert.equal(turbo9StepsForPixels(4000 * 4000, 9), 16)
})

/* ------------------------------------------------------------- 工具定义形状 ---- */
test('工具声明确实注册并声明了必需参数', () => {
    const tool = makeOutpaintTool({ timeoutMs: 1000, filePrefix: 'x' }, () => {})
    assert.equal(tool.name, 'outpaint_image')
    assert.deepEqual(tool.parameters.required, ['image'])
    assert.ok(typeof tool.output.render === 'function', 'DSH 强制要求 output.render')
    assert.ok(typeof tool.execute === 'function')
    for (const field of ['image', 'prompt', 'aspect', 'expand', 'sides', 'feather', 'seed']) {
        assert.ok(tool.parameters.properties[field], `缺参数 ${field}`)
    }
})

const failed = cases.filter((line) => line.includes('FAIL')).length
console.log('扩图回归：')
console.log(cases.join('\n'))
console.log(`\n${cases.length - failed}/${cases.length} 通过`)