/**
 * dsh-comfy-suite — 从上游 dsh-qwen-paint 0.18/0.19 移植的三项（2026-11-12）
 *
 * 来源：https://github.com/yanfei0725/dsh-qwen-paint
 *   ① 参考图上传按序号加前缀（防同名覆盖）
 *   ② 主模型自带蒸馏自动跳过 turbo8 LoRA（配置只是"强行指定"）
 *   ③ 多参考图 1–6 张（第 N 张 → images.image_N）
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { DEFAULTS, FULL_CAPS, buildWorkflow, isTurboBakedModel } from './vendor/qwen-paint/lib/config.js'

const indexSrc = await readFile(new URL('./vendor/qwen-paint/lib/index.js', import.meta.url), 'utf8')
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

const wf = (args) => buildWorkflow(
    { ...DEFAULTS, unet: 'Qwen-Image-2.1-Turbo-AD-Q6_K.gguf' },
    { prompt: 'a cat', width: 1024, height: 1024, seed: 42, count: 1, ...args },
    FULL_CAPS,
)

/* ------------------------------------------------------------ ③ 多参考图 ---- */
test('三张参考图 → LoadImage 40/41/42，分别接 image_1..3', () => {
    const w = wf({ references: ['a.png', 'b.png', 'c.png'] })
    assert.equal(w[40].inputs.image, 'a.png')
    assert.equal(w[41].inputs.image, 'b.png')
    assert.equal(w[42].inputs.image, 'c.png')
    assert.deepEqual(w[5].inputs['images.image_1'], ['40', 0])
    assert.deepEqual(w[5].inputs['images.image_2'], ['41', 0])
    assert.deepEqual(w[5].inputs['images.image_3'], ['42', 0])
    assert.deepEqual(w[5].inputs.vae, ['3', 0], '多参考图必须给编码器 VAE')
})

test('多参考图时 latent 来自编码器（不是空 latent）', () => {
    const w = wf({ references: ['a.png', 'b.png'] })
    const sampler = Object.values(w).find((n) => n.class_type === 'SamplerCustomAdvanced' || n.class_type === 'KSampler')
    assert.deepEqual(sampler.inputs.latent_image, ['5', 2])
    assert.equal(w[6], undefined, '不该再留空 latent 节点')
})

test('老写法 reference 单张仍然有效（向后兼容）', () => {
    const w = wf({ reference: 'only.png' })
    assert.equal(w[40].inputs.image, 'only.png')
    assert.deepEqual(w[5].inputs['images.image_1'], ['40', 0])
    assert.equal(w[5].inputs['images.image_2'], undefined)
})

test('同时给 references 和 reference 时以 references 为准（runDraw 已先行合并）', () => {
    const w = wf({ references: ['a.png', 'b.png'], reference: 'c.png' })
    assert.equal(w[40].inputs.image, 'a.png')
    assert.equal(w[41].inputs.image, 'b.png')
    assert.equal(w[42], undefined, 'references 优先，不再追加单张（合并发生在工具层）')
})

/* -------------------------------------------------- ② turbo 自动判定 ---- */
test('文件名带 turbo → 视为自带蒸馏', () => {
    assert.equal(isTurboBakedModel({}, 'Qwen-Image-2.1-Turbo-AD-Q6_K.gguf'), true)
    assert.equal(isTurboBakedModel({}, 'qwen_image_2.1_TURBO_bf16.safetensors'), true)
})

test('普通底模 → 不是自带蒸馏', () => {
    assert.equal(isTurboBakedModel({}, 'qwen_image_2.1_int8_convrot.safetensors'), false)
})

test('配置强制 turboBakedModel 优先（文件名不像 turbo 也算）', () => {
    assert.equal(isTurboBakedModel({ turboBakedModel: true }, 'whatever.safetensors'), true)
})

test('自动判定的模型不再叠 turbo8 LoRA', () => {
    const w = wf({})
    const types = Object.values(w).map((n) => n.class_type)
    assert.ok(!types.includes('LoraLoaderModelOnly'), 'turbo 文件名不该再挂 turbo8 LoRA')
    assert.ok(types.includes('ManualSigmas'), '应仍走 9 步表')
})

/* -------------------------------------------------- ① 上传命名 ---- */
test('上传参考图带序号前缀（防同名互相覆盖）', () => {
    assert.ok(indexSrc.includes('dshqp-ref-'), '缺上传前缀逻辑')
    assert.ok(indexSrc.includes('dshqp-ref-${ordinal}-${baseName}'), '前缀格式应为 dshqp-ref-<序号>-<原名>')
})

test('多参考图逐张带序号上传', () => {
    assert.ok(indexSrc.includes('refList.map((file, index) => uploadReference(cfg, file, signal, index + 1))'),
        '多参考图应逐张带 ordinal 上传')
})

const failed = cases.filter((line) => line.includes('FAIL')).length
console.log('上游移植回归：')
console.log(cases.join('\n'))
console.log(`\n${cases.length - failed}/${cases.length} 通过`)