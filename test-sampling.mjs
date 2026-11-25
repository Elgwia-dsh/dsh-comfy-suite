/**
 * dsh-comfy-suite — 采样引擎回归（2026-11-12 引入 9 步 sigma 表时新增）
 *
 * 断言的都是"能一眼看出错"的结构事实：
 *   · sigma 字符串的形状（9 步原表 / denoise 截档 / 任意步数重采样）
 *   · turbo9 档到底接了哪些节点（该有的有、不该有的没有）
 *   · ksimple 档没有被顺手改坏（老链路仍在）
 *   · 原生链路（没有 turbo LoRA）不会被 9 步表污染
 */
import assert from 'node:assert/strict'
import { DEFAULTS, FULL_CAPS, PARAMETERS, buildWorkflow, drawParameters, manualSigmasString, pickWrapperSet, TURBO9_SIGMAS } from './vendor/qwen-paint/lib/config.js'

const cfg = () => ({ ...DEFAULTS })
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

const baseArgs = { prompt: 'a cat', width: 1024, height: 1024, seed: 42, count: 1 }
const wf = (patch, args) => buildWorkflow({ ...cfg(), ...(patch ?? {}) }, { ...baseArgs, ...(args ?? {}) }, undefined)

/* ---------------------------------------------------------------- sigma 表 ---- */
test('9 步原表按 ComfyUI 的字符串形状输出', () => {
    assert.equal(manualSigmasString(), '1, 0.978453, 0.95418, 0.926626, 0.89508, 0.845148, 0.704534, 0.414568, 0.15, 0')
    assert.equal(TURBO9_SIGMAS.length, 10)
})

test('denoise 截掉表头档数（0.5 → 从第 5 档起）', () => {
    assert.equal(manualSigmasString({ denoise: 0.5 }), '0.845148, 0.704534, 0.414568, 0.15, 0')
    assert.equal(manualSigmasString({ denoise: 1 }), manualSigmasString())
    // denoise 极小也要留至少两步（否则 ComfyUI 采不出东西）
    assert.equal(manualSigmasString({ denoise: 0.05 }).split(', ').length, 2)
})

test('任意步数按线性插值重采样，末尾恒为 0', () => {
    const four = manualSigmasString({ steps: 4 })
    assert.equal(four.split(', ').length, 5)
    assert.ok(four.endsWith(', 0'), four)
    const twelve = manualSigmasString({ steps: 12 })
    assert.equal(twelve.split(', ').length, 13)
    assert.ok(Number(twelve.split(', ')[0]) === 1)
})

test('手写 sigma 表优先于内置表', () => {
    assert.equal(manualSigmasString({ override: '0.9, 0.4, 0' }), '0.9, 0.4, 0')
    // 写坏了（不足两项 / 非数字）就退回内置表，绝不产出空 sigmas
    assert.equal(manualSigmasString({ override: 'oops' }), manualSigmasString())
})

/* ------------------------------------------------------------- turbo9 链路 ---- */
test('默认走 turbo9：ManualSigmas + SamplerCustomAdvanced，且不接 flux 位移', () => {
    const w = wf()
    const types = Object.values(w).map((n) => n.class_type)
    assert.ok(types.includes('ManualSigmas'), '缺 ManualSigmas')
    assert.ok(types.includes('SamplerCustomAdvanced'), '缺 SamplerCustomAdvanced')
    assert.ok(types.includes('CFGGuider'), '缺 CFGGuider')
    assert.ok(types.includes('KSamplerSelect'), '缺 KSamplerSelect')
    assert.ok(types.includes('RandomNoise'), '缺 RandomNoise')
    assert.ok(!types.includes('KSampler'), 'turbo9 不该再出现 KSampler')
    assert.ok(!types.includes('ModelSamplingFlux'), 'turbo9 不该接 ModelSamplingFlux')
    assert.equal(w[31].class_type, 'CFGGuider')
    assert.equal(w[31].inputs.cfg, 1, '有 turbo LoRA 时 CFG 必须是 1')
    assert.equal(w[33].inputs.sigmas, manualSigmasString({ steps: 9 }))
    assert.deepEqual(w[35].inputs.guider, ['31', 0])
    assert.deepEqual(w[35].inputs.sigmas, ['33', 0])
    assert.deepEqual(w[9].inputs.samples, ['35', 0], 'VAEDecode 必须接在新采样末端')
    assert.deepEqual(w[35].inputs.latent_image, ['6', 0], '文生图用空 latent')
})

test('turbo9 档仍保留 LoRA 与前缀缓存（这两件与采样器无关）', () => {
    const w = wf()
    const types = Object.values(w).map((n) => n.class_type)
    assert.ok(types.includes('LoraLoaderModelOnly'))
    assert.ok(types.includes('QwenImage21Cache'))
    assert.equal(w[34].inputs.noise_seed, 42, '种子必须落到 RandomNoise 上')
})

test('turbo9 + 参考图：走编码器的 latent（不是空 latent）', () => {
    const w = wf({}, { reference: 'ref.png' })
    const types = Object.values(w).map((n) => n.class_type)
    assert.ok(types.includes('LoadImage'))
    // ★ 2026-11-12：多参考图改造后 LoadImage 从 4 挪到 40（40..45 给 1–6 张）
    assert.deepEqual(w[5].inputs['images.image_1'], ['40', 0])
    assert.deepEqual(w[5].inputs.vae, ['3', 0])
    assert.deepEqual(w[35].inputs.latent_image, ['5', 2], '图生图的 latent 来自编码器 slot 2')
    assert.ok(!w[6], '图生图不该再留空 latent 节点')
})

test('工具传 steps 时重采样同一张表（9 → 4）', () => {
    const w = wf({}, { steps: 4 })
    assert.equal(w[33].inputs.sigmas, manualSigmasString({ steps: 4 }))
})

test('manualSigmasSteps 可改默认步数', () => {
    const w = wf({ manualSigmasSteps: 12 })
    assert.equal(w[33].inputs.sigmas, manualSigmasString({ steps: 12 }))
})

/* --------------------------------------------------------------- ksimple 档 ---- */
test('samplingProfile=ksimple 回到老链路（KSampler + simple + flux）', () => {
    const w = wf({ samplingProfile: 'ksimple' })
    const types = Object.values(w).map((n) => n.class_type)
    assert.ok(types.includes('KSampler'))
    assert.ok(types.includes('ModelSamplingFlux'))
    assert.ok(!types.includes('SamplerCustomAdvanced'))
    assert.ok(!w[31] && !w[33] && !w[35], 'ksimple 不该留 turbo9 的节点')
    assert.equal(w[8].inputs.scheduler, 'simple')
    assert.equal(w[8].inputs.steps, 8)
    assert.deepEqual(w[9].inputs.samples, ['8', 0])
})

/* --------------------------------------------------------------- 原生链路 ---- */
test('没有 turbo LoRA 时 turbo9 被忽略，回到原生步数/CFG', () => {
    const basicCaps = { ...FULL_CAPS, level: 'basic', nodes: { ...FULL_CAPS.nodes } }
    const w = buildWorkflow({ ...cfg() }, { ...baseArgs }, basicCaps)
    const types = Object.values(w).map((n) => n.class_type)
    assert.ok(types.includes('KSampler'), '原生链路仍用 KSampler')
    assert.ok(!types.includes('ManualSigmas'), '原生链路不该套 9 步表')
    assert.equal(w[8].inputs.steps, DEFAULTS.baseSteps)
    assert.equal(w[8].inputs.cfg, DEFAULTS.baseCfg)
})

test('turbo8Enabled=false 同样不套 9 步表', () => {
    const w = wf({ turbo8Enabled: false })
    const types = Object.values(w).map((n) => n.class_type)
    assert.ok(types.includes('KSampler'))
    assert.ok(!types.includes('ManualSigmas'))
})

/* --------------------------------------------------- 加速包装器不许乱叠 ---- */
// ★ 2026-11-12：蒸馏 GGUF 上 TE-Speed 与 Speedup 同开会把高光打爆（0.11%→5.97%），
//   而且并不更快。预设必须保证「蒸馏模型最多接一个」。
const wrap = (cfg) => pickWrapperSet(cfg, { useTurbo: true }, 1024, 1024, null)

test('蒸馏模型（turboBakedModel）只接 Speedup，不接 TE-Speed', () => {
    const p = wrap({ ...DEFAULTS, turboBakedModel: true })
    assert.equal(p.te, false, '不该接 TE-Speed')
    assert.equal(p.speedup, true, '应该接 Speedup')
    assert.ok(p.reason.includes('Speedup'))
})

test('老链（非蒸馏）保持可叠，行为不变', () => {
    const p = wrap({ ...DEFAULTS })
    assert.equal(p.te, true)
    assert.equal(p.speedup, true)
})

test('wrapperStacking=single 时一律只接一个', () => {
    const p = wrap({ ...DEFAULTS, wrapperStacking: 'single' })
    assert.equal(p.te, false)
    assert.equal(p.speedup, true)
})

test('wrapperStacking=stack 才是老行为（两个都接）', () => {
    const p = wrap({ ...DEFAULTS, wrapperStacking: 'stack', turboBakedModel: true })
    assert.equal(p.te, true)
    assert.equal(p.speedup, true)
})

/* ---------------------------------------- 自带蒸馏的模型不许退回 25 步原生档 ---- */
// ★ 2026-11-12 真机 bug：删掉 turbo8 LoRA 后，probeCapabilities 把档位判成 basic，
//   useTurbo 变 false → 整条链退回 25 步 / CFG 2.5（对蒸馏模型过冲，且慢 5 倍，
//   实测 126 s）。修法是 turboBakedModel=true 时无条件具备 turbo 能力。
const bakedBasicCaps = {
    level: 'basic',
    nodes: { qwen21: true, prefixCache: true, teSpeed: true, speedup: true, loraOnly: true, ggufUnet: true, vaeTiled: true },
    models: {
        unet: 'Qwen-Image-2.1-Turbo-AD-Q6_K.gguf',
        turbo8Lora: null,
        clip: 'qwen3vl_8b_w4a8.safetensors',
        vae: 'qwen_image_2.1_vae_bf16.safetensors',
    },
    notes: [],
}
const wfBasic = (patch) => buildWorkflow(
    { ...cfg(), unet: 'Qwen-Image-2.1-Turbo-AD-Q6_K.gguf', ...(patch ?? {}) },
    { ...baseArgs },
    bakedBasicCaps,
)

test('自带蒸馏的模型在 basic 档仍走 turbo9（9 步 / cfg 1 / ManualSigmas）', () => {
    const w = wfBasic({ turboBakedModel: true })
    const types = Object.values(w).map((n) => n.class_type)
    assert.ok(types.includes('ManualSigmas'), '必须还是 9 步表')
    assert.ok(!types.includes('KSampler'), '不该退回 KSampler 25 步')
    assert.equal(w[33].inputs.sigmas.split(', ').length, 10, '9 步表 = 10 个 sigma 值')
    assert.equal(w[31].inputs.cfg, 1, 'cfg 必须 1')
})

test('非蒸馏模型在 basic 档仍走原生 25 步 / cfg 2.5（行为不变）', () => {
    const w = buildWorkflow({ ...cfg(), unet: 'some_base.safetensors' }, { ...baseArgs }, bakedBasicCaps)
    const types = Object.values(w).map((n) => n.class_type)
    assert.ok(types.includes('KSampler'))
    assert.ok(!types.includes('ManualSigmas'))
    assert.equal(w[8].inputs.steps, DEFAULTS.baseSteps)
    assert.equal(w[8].inputs.cfg, DEFAULTS.baseCfg)
})

/* ------------------------------------------- draw_image 参数说明跟着链路走 ---- */
// 2026-11-25：主模型换成完整版 int8 后，写死的旧文案还在说
// "steps 会被忽略、强制 8 步""负面词基本不生效"，模型照做就白白放弃两个旋钮。
// 断言的是"说明里的链路事实与配置一致"，不是文案措辞。
test('draw_image 的 steps 说明随 forceTurbo8Steps 反转', () => {
    const locked = drawParameters({ baseSteps: 25, baseCfg: 3, forceTurbo8Steps: true })
    assert.match(locked.properties.steps.description, /会被忽略/)
    const open = drawParameters({ baseSteps: 25, baseCfg: 3, forceTurbo8Steps: false })
    assert.doesNotMatch(open.properties.steps.description, /会被忽略/)
    assert.match(open.properties.steps.description, /都生效/)
    assert.match(open.properties.steps.description, /25 步/, '原生链路默认步数要写进说明')
})

test('draw_image 的 negative 说明写明当前 CFG（原生链路的负面词有效）', () => {
    const params = drawParameters({ baseSteps: 25, baseCfg: 3 })
    assert.match(params.properties.negative.description, /CFG=3/)
    assert.match(params.properties.negative.description, /负面词有用/)
})

test('drawParameters 不改动原参数表，schema 形状保持一致', () => {
    assert.notEqual(PARAMETERS.properties.steps.description, drawParameters({ forceTurbo8Steps: false }).properties.steps.description)
    assert.deepEqual(PARAMETERS.required, ['prompt'])
    const params = drawParameters({})
    assert.equal(params.additionalProperties, false)
    assert.deepEqual(params.required, ['prompt'])
    assert.deepEqual(Object.keys(params.properties).sort(), Object.keys(PARAMETERS.properties).sort())
    assert.equal(params.properties.steps.type, 'integer')
})

const failed = cases.filter((line) => line.includes('FAIL')).length
console.log('采样引擎回归：')
console.log(cases.join('\n'))
console.log(`\n${cases.length - failed}/${cases.length} 通过`)