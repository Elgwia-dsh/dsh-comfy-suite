/**
 * lib/diag.js —— 同步落盘诊断（2026-10-19 从 index.js 拆出）。
 * 被 index.js 与 comfy-launch.js 共用；只依赖 config.js 的 DIAG_ON / DIAG_FILE。
 */
import { appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { DIAG_FILE, DIAG_ON } from './config.js'

/** 文件超过这个体积就只保留最后 400 行（诊断是排查用的，不是账本）。 */
const MAX_BYTES = 512 * 1024

/** 上一次确认过的大小；-1 = 还没 stat 过。 */
let knownSize = -1
/** 目录是否已经确保存在（省掉每次调用都 mkdir）。 */
let dirReady = false

/**
 * ★★★ 2026-10-09 **同步落盘诊断**（DSH/Electron 环境下唯一可靠的取证手段）。
 *
 * ## 为什么必须用它
 *   插件跑在 DSH（Electron）主进程里，它的 stdout/stderr 我们**拿不到** ——
 *   `console.log`／宿主 logger 全都看不到。所以"插件到底加载到哪一步、
 *   每次轮询看到什么值"就只能靠它自己写文件。
 *
 * ## 为什么用 `appendFileSync`（★ 2026-11-12 改）
 *   旧实现每次都是"读全文件 → 截断 → 写全文件"，而状态端点**每 5 秒**
 *   就会 `diag('poll', …)` 一次：
 *     · 每次 20+ KB 的读 + 写，一天约 17 万次；
 *     · 写的是**用户出图目录**里的文件，会跟图库扫描、OneDrive 同步抢 I/O；
 *     · 最糟的是它**不是原子追加**，两个进程同时写会互相覆盖/缝在一起。
 *   现在只做一次 append（1 个 syscall），体积检查命中时才做一次轮转（读尾 400 行）。
 *   仍然同步 —— 排查"某个 await 之后的代码到底有没有执行"时，异步写会丢证据。
 *
 * ## 日志放在哪
 *   `DSH_HOME/data/dsh-comfy-suite/qwen-paint-diag.log`（见 config.js 的 DIAG_FILE）。
 *   不再丢进 `桌面/千问1生图` —— 那是放成品图的，不是放调试日志的。
 */
export function diag(tag, detail) {
  if (!DIAG_ON || DIAG_FILE === '') return
  try {
    // ★ 每行都带 pid：DIAG_FILE 是固定路径，双开 DSH / 测试进程会写同一个文件，
    //   光看行内容分不清谁写的（实际踩过：把测试进程起的端口当成了本机 comfyUrl）。
    const line = `${new Date().toISOString()} [${tag}] pid=${process.pid} ${detail ?? ''}\n`
    if (!dirReady) {
      mkdirSync(dirname(DIAG_FILE), { recursive: true })
      dirReady = true
    }
    if (knownSize < 0) {
      try { knownSize = statSync(DIAG_FILE).size } catch { knownSize = 0 }
    }
    if (knownSize > MAX_BYTES) {
      // 轮转：只保留最后 400 行（失败也不影响本次 append）
      try {
        const kept = readFileSync(DIAG_FILE, 'utf8').split('\n').slice(-400).join('\n')
        writeFileSync(DIAG_FILE, kept.endsWith('\n') || kept === '' ? kept : `${kept}\n`, 'utf8')
        knownSize = Buffer.byteLength(kept, 'utf8')
      } catch {
        knownSize = 0
      }
    }
    appendFileSync(DIAG_FILE, line, 'utf8')
    knownSize += Buffer.byteLength(line, 'utf8')
  } catch {
    /* 诊断永远不该成为故障源 */
  }
}