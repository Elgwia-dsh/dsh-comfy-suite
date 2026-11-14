/**
 * dsh-comfy-suite — 局部重绘的蒙版链回归（2026-11-12 新增）
 *
 * ## 为什么要有这个测试
 *   2026-11-12 真机踩到一个**只在第二次调用时出现**的崩：
 *   `--gpu-only` 的 ComfyUI 把蒙版留在显存上，第二次用同一张蒙版时 `LoadImageMask`
 *   命中缓存，下游 `GrowMask` 抛
 *     can't convert cuda:0 device type tensor to numpy…
 *   修法是换成纯 torch 的 `GrowMaskWithBlur`（或 MaskToImage→ImageBlur→ImageToMask）。
 *
 *   这个崩**静态就能挡**：只要工作流里不再出现 GrowMask / FeatherMask，
 *   就不可能回到那条路上。所以这里直接盯源码，比跑一次真机便宜得多。
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { __internal } from './vendor/qwen-paint/lib/index.js'

const indexSrc = await readFile(new URL('./vendor/qwen-paint/lib/index.js', import.meta.url), 'utf8')
const configSrc = await readFile(new URL('./vendor/qwen-paint/lib/config.js', import.meta.url), 'utf8')
const { turboBakedOrLora } = __internal
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

test('工作流里不再出现 GrowMask（--gpu-only 下必崩的那个节点）', () => {
    assert.ok(!/class_type: 'GrowMask'/.test(indexSrc), '又出现了 class_type: GrowMask')
})

test('工作流里不再出现 FeatherMask', () => {
    assert.ok(!/class_type: 'FeatherMask'/.test(indexSrc), '又出现了 class_type: FeatherMask')
})

test('首选软化节点是 GrowMaskWithBlur，且参数齐全', () => {
    assert.ok(/class_type: 'GrowMaskWithBlur'/.test(indexSrc), '缺 GrowMaskWithBlur')
    for (const field of ['expand', 'blur_radius', 'lerp_alpha', 'decay_factor', 'fill_holes', 'tapered_corners']) {
        assert.ok(indexSrc.includes(`${field}:`), `GrowMaskWithBlur 缺参数 ${field}`)
    }
})

test('备用链是 MaskToImage → ImageBlur → ImageToMask（纯 torch）', () => {
    for (const type of ['MaskToImage', 'ImageBlur', 'ImageToMask']) {
        assert.ok(indexSrc.includes(`class_type: '${type}'`), `缺备份节点 ${type}`)
    }
})

test('能力探测也换成了新节点（wizard 不再报 GrowMask 缺失）', () => {
    assert.ok(configSrc.includes("probe('GrowMaskWithBlur')"))
    assert.ok(!configSrc.includes("probe('GrowMask')"), '探测里还留着 GrowMask')
    assert.ok(!configSrc.includes("probe('FeatherMask')"), '探测里还留着 FeatherMask')
    assert.ok(configSrc.includes('softenNode:'), 'aux.inpaint 该给出 softenNode')
    assert.ok(configSrc.includes('blurNode:'), 'aux.inpaint 该给出 blurNode')
})

test('turboBakedModel=true 时不接 LoRA，模型链末端回到 UNET(1)', () => {
    const wf = {}
    const ref = turboBakedOrLora({ turboBakedModel: true }, wf, 'turbo8.safetensors')
    assert.equal(ref, '1')
    assert.equal(wf[11], undefined, '不该出现 LoRA 节点')
})

test('普通底模仍然接 LoRA，末端是 11', () => {
    const wf = {}
    const ref = turboBakedOrLora({ turbo8Strength: 0.8 }, wf, 'turbo8.safetensors')
    assert.equal(ref, '11')
    assert.equal(wf[11].class_type, 'LoraLoaderModelOnly')
    assert.equal(wf[11].inputs.strength_model, 0.8)
})

test('三个辅助工具都走同一个 helper（不再各写一份 LoRA 判断）', () => {
    const hits = (indexSrc.match(/const afterLora = turboBakedOrLora\(/gu) ?? []).length
    assert.equal(hits, 3, `应有三处（重绘/扩图/捏人），实际 ${hits}`)
})

const failed = cases.filter((line) => line.includes('FAIL')).length
console.log('局部重绘蒙版链回归：')
console.log(cases.join('\n'))
console.log(`\n${cases.length - failed}/${cases.length} 通过`)