/**
 * lib/output-dir.js —— 出图目录的解析与**可写性兜底**（2026-11-12 从 config.js 拆出）。
 *
 * ## 为什么单独一个文件
 *   `config.js` 已经贴着 DSH STORE 的**单文件 262144 字节**上限（拆前 261999，只剩 145
 *   字节余量）—— 再往它里面加任何一段逻辑，下一步就会顶爆。这里收拢的正好是一组
 *   **纯路径逻辑**（不碰 GPU / ComfyUI / 网络），拆出来既降体积，也更好单测。
 *
 * ## 行为（与拆出前逐字一致，另加 2026-11-12 的兜底链）
 *   · 绝对路径照用；相对路径挂到"默认基目录（桌面）"下；空值走默认桌面目录。
 *   · 每个候选目录都做**两步校验**：`mkdir -p` 能建成 + 真写一个临时文件能成功。
 *   · 配置的目录不可写时，按顺序找第一个真可写的：
 *       ① 配置目录 ② 桌面默认 ③ `<DSH_HOME>/data/dsh-comfy-suite/output` ④ 系统临时目录
 *     旧实现"退回默认目录"其实退的是同一个默认目录 —— 默认目录也不可写时，
 *     每次出图都会在写盘那一步失败，等于没有兜底。
 */
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

/** 默认输出位置的**基目录**（桌面；没有桌面就退主目录，绝不硬造 Desktop）。 */
export function defaultOutputBase() {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '.'
  if (process.env.XDG_DESKTOP_DIR && existsSync(process.env.XDG_DESKTOP_DIR)) {
    return process.env.XDG_DESKTOP_DIR
  }
  for (const dir of [path.join(home, 'Desktop'), path.join(home, '桌面')]) {
    if (existsSync(dir)) return dir
  }
  return home
}

/** 成品落盘目录的**默认值**（`<桌面或主目录>/千问1生图`）。 */
export function defaultOutputDir() {
  return path.join(defaultOutputBase(), '千问1生图')
}

/** 试写文件名的序号：同一毫秒里连续探测两个目录时也不会撞名。 */
let probeSeq = 0

/** 目录是否**真的**可写（存在 + 能建 + 能写一个临时文件再删掉）。 */
export function ensureWritableDir(target) {
  const dir = String(target ?? '').trim()
  if (dir === '') return { ok: false, problem: '路径为空' }
  let existed = false
  try {
    existed = existsSync(dir)
    if (existed && !statSync(dir).isDirectory()) {
      return { ok: false, problem: `${dir} 已存在且是个文件` }
    }
    mkdirSync(dir, { recursive: true })
  } catch (error) {
    const why = String(error?.message ?? error).split('\n')[0]
    return { ok: false, problem: `${existed ? '无法创建/写入' : '无法创建'}：${why}` }
  }
  // 真正试写一次（目录存在 ≠ 有写权限）
  const probe = path.join(dir, `.dshqp-write-test-${process.pid}-${probeSeq++}.tmp`)
  try {
    writeFileSync(probe, 'ok', 'utf8')
    rmSync(probe, { force: true })
  } catch (error) {
    const why = String(error?.message ?? error).split('\n')[0]
    return { ok: false, problem: `没有写权限（${why}）` }
  }
  return { ok: true }
}

/** DSH 数据目录下的兜底出图目录（跟着 DSH_HOME 走，换机器也成立）。 */
export function dataDirFallback() {
  const home = process.env.DSH_HOME
    ?? path.join(process.env.USERPROFILE ?? process.env.HOME ?? '.', '.dsh')
  return path.join(home, 'data', 'dsh-comfy-suite', 'output')
}

/**
 * 把配置里的 `outputDir` 解析成一个**真正可用**的绝对路径。
 *
 * @returns {{ dir: string, source: string, problem?: string }}
 *   `problem` 非空即表示"配置的那个路径没用上"，值是原因；调用方应如实展示。
 */
export function resolveOutputDir(rawDir, log) {
  const fallback = defaultOutputDir()
  const raw = String(rawDir ?? '').trim()

  const target = raw === ''
    ? fallback
    : (path.isAbsolute(raw) ? path.normalize(raw) : path.join(defaultOutputBase(), raw))

  const primary = ensureWritableDir(target)
  if (primary.ok) {
    return {
      dir: target,
      source: raw === '' ? '默认桌面目录' : (path.isAbsolute(raw) ? '配置的绝对路径' : '相对路径（解析到默认位置下）'),
    }
  }

  // ---- 兜底链（配置 / 默认目录都不可写时）--------------------------------
  const candidates = raw === '' ? [] : [fallback]
  candidates.push(dataDirFallback(), path.join(os.tmpdir(), 'dsh-comfy-suite-output'))
  const seen = new Set([path.resolve(target).toLowerCase()])
  let tried = 0
  for (const candidate of candidates) {
    const key = path.resolve(candidate).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tried += 1
    const probe = ensureWritableDir(candidate)
    if (!probe.ok) continue
    log?.('warn', `出图目录不可用（${primary.problem}）→ 本次改用 ${candidate}`
      + '。想固定到别处，请在设置里把 outputDir 改成可写的路径。')
    return {
      dir: candidate,
      source: raw === '' ? '自动兜底目录（默认桌面目录不可写）' : '自动兜底目录（配置的路径不可写）',
      problem: primary.problem,
    }
  }

  // 全都不行：如实回配置值 + 原因（调用方会显示出来，出图时才失败）
  log?.('warn', `出图目录全部不可写（${primary.problem}；已尝试 ${tried} 个兜底位置）`
    + '—— 出图会在写盘那一步失败，请先修好目录权限。')
  return {
    dir: target,
    source: raw === '' ? '默认桌面目录（不可写）' : '配置的路径（不可写）',
    problem: primary.problem,
  }
}