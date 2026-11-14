/**
 * dsh-qwen-paint —— **显式 sigma 表**（2026-11-12 从 config.js 拆出）
 *
 * ## 为什么单独一个文件
 *   `lib/config.js` 已经 252 KB，而 DSH STORE 的自动检查要求**单文件 ≤ 262144 字节**
 *   （上游当初把 index.js 拆成 config.js 就是因为这个）。这张表 + 它的重采样函数
 *   有 7 KB 左右，正好够把它顶到悬崖边 —— 所以单独放一个文件，给后面留余量。
 *
 * ## 表从哪来
 *   借鉴作者的「▶▷Qwen2.1-Turbo-9步-编辑&扩图&移除&重绘&生图（整合）」画布：
 *   那 5 个流程都用 `ManualSigmas` + `SamplerCustomAdvanced` 代替 `KSampler`，
 *   sigma 表就是这 10 个数字（9 步的噪声水平，末尾 0 = 干净终点）：
 *
 *     1.0, 0.978453, 0.954180, 0.926626, 0.895080,
 *     0.845148, 0.704534, 0.414568, 0.150000, 0
 *
 *   与 `scheduler: simple` 的区别：simple 是按 sigma 分布现算的通用调度；这张表是
 *   **针对 turbo 蒸馏模型调过的工作点**（前 5 步几乎等高、后半段陡降），
 *   也就是"第几步该在什么噪声水平上跑"已经替你定好了。
 *
 * ## 本机实测（2026-11-12，RX 9060 XT 16 GB，1024²，同 prompt / 同 seed）
 *   ┌ 链路                                      ┌ 耗时        ┌ 锐度(拉普拉斯方差)
 *   │ 旧：KSampler 8 步 simple + TE-Speed/Speedup│ 20.9 s      │ 135.9
 *   │ 新：ManualSigmas 9 步                      │ 20.9~24.1 s │ **140.6**
 *   │ 画布的 8 步变体（表尾截到 0.414568）       │ 21.1 s      │ 106.5 ← 明显发糊
 *   └───────────────────────────────────────────┴─────────────┴────────────────────
 *   局部重绘（同图同蒙版，denoise 1.0）：旧链路（无 turbo LoRA、4 步）蒙版区留一条
 *   发白的雾带；新链路干净、与周围光影自然融合。
 */

/** 9 步 turbo 工作点（10 个值 = 9 步 + 终止 0）。 */
export const TURBO9_SIGMAS = Object.freeze([
  1.0, 0.978453, 0.954180, 0.926626, 0.895080, 0.845148, 0.704534, 0.414568, 0.150000, 0,
])

/**
 * 把 9 步表重采样成任意步数（线性插值），再按 denoise 截掉开头几档。
 *
 * @param {object} opts
 * @param {number} [opts.steps]    目标步数（默认 = 原表 9 步，原样返回）
 * @param {number} [opts.denoise]  0.05–1.0；1.0 = 从头跑（默认）
 * @param {string} [opts.override] 配置里手写的 sigma 表（逗号分隔）；给了就优先用它
 * @returns {string} ComfyUI `ManualSigmas` 的 sigmas 字符串
 */
export function manualSigmasString({ steps, denoise, override } = {}) {
  let table
  const custom = typeof override === 'string' ? override.trim() : ''
  if (custom !== '') {
    const parsed = custom.split(/[,\s]+/u).map((entry) => Number(entry)).filter((n) => Number.isFinite(n) && n >= 0)
    table = parsed.length >= 2 ? parsed : [...TURBO9_SIGMAS]
  } else {
    table = [...TURBO9_SIGMAS]
  }
  const fullSteps = Math.max(1, table.length - 1)
  const want = Number.isFinite(steps) ? Math.max(1, Math.min(60, Math.trunc(steps))) : fullSteps
  let values
  if (want === fullSteps) {
    values = table
  } else {
    // 重采样：第 i 步取 pos = i/want*(len-1) 处的线性插值，最后补一个 0 收尾
    values = []
    for (let i = 0; i < want; i += 1) {
      const pos = (i / want) * (table.length - 1)
      const lo = Math.floor(pos)
      const hi = Math.min(table.length - 1, lo + 1)
      const t = pos - lo
      values.push(table[lo] * (1 - t) + table[hi] * t)
    }
    values.push(0)
  }
  // denoise < 1：从表头切掉一段，等价于 KSampler 的 denoise（起点更低、少跑几步）
  const d = Number.isFinite(denoise) ? Math.min(1, Math.max(0.05, denoise)) : 1
  const span = values.length - 1
  const start = d >= 0.999 ? 0 : Math.min(span - 1, Math.max(0, Math.round((1 - d) * span)))
  return values.slice(start).map((n) => Number(n.toFixed(6)).toString()).join(', ')
}