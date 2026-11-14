/**
 * dsh-qwen-paint —— **Goohai Image Library（GHIL）图库层**（2026-11-12 新增）
 *
 * ## 它是什么
 *   作者的「换装、发型、姿势、捏人」画布背后是一个本地素材库：
 *   `models/GHIL/{portrait,costume,pose,hair}`，共 5238 条，每条带 id + 原图 + 缩略图 + 中文标签。
 *   画布用 `GoohaiImageLibrary` 节点在界面里挑；**这里是给模型/工具用的那一层** ——
 *   读同一批 json 索引，做「按关键词查找」「按 id 解析成文件路径」。
 *
 * ## 为什么不用 ComfyUI 的节点接口
 *   节点接口是给画布上的下拉框用的（动态 COMBO + 前端 JS），从工具里调它没有意义；
 *   索引文件本身就是最好的数据源，纯读盘、零依赖、可单测。
 *
 * ## 数据结构（2026-11-12 实测）
 *   portrait / hair：`{id, section, hair, full, thumb, title, search, hair_zh, section_zh …}`
 *   costume        ：`{id, 分类, 关键词, 英文关键词, 缩略图, 原图, 检索}`
 *   pose           ：`{id, 体系, 姿势编号, 分类, 姿势名称, 角度, 缩略图, 原图, 检索}`
 *   四类的可取图字段不同（`full` vs `原图`），检索字段也不同，所以这里统一成
 *   `{ id, path, title, tags }` 再交给上层，别让调用方去记两套字段名。
 */
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';

/** 中文类型名 → 目录名（与 ComfyUI 节点里的下拉一致）。 */
export const GHIL_KINDS = Object.freeze({
    人像: 'portrait',
    服装: 'costume',
    姿势: 'pose',
    发型: 'hair',
})

/** 目录名 → 索引文件名。 */
const INDEX_FILES = Object.freeze({
    portrait: 'portrait-zh.json',
    costume: 'costume-zh.json',
    pose: 'pose-zh.json',
    hair: 'hairstyle-zh.json',
})

/** 每类里「原图」字段的实际名字（画布里就是这样，别统一成 full 会读空）。 */
const IMAGE_FIELDS = Object.freeze({
    portrait: ['full'],
    hair: ['full'],
    costume: ['原图', 'full'],
    pose: ['原图', 'full'],
})

/** 检索时拼接的字段（中文标签优先，英文/日文名也收进来）。 */
const TEXT_FIELDS = Object.freeze({
    portrait: ['title', 'search', 'section_zh', 'hair_zh', 'style_zh', 'section', 'hair'],
    hair: ['title', 'search', 'section_zh', 'hair_zh', 'style_zh', 'name_zh', 'name_ja'],
    costume: ['分类', '关键词', '英文关键词', '检索'],
    pose: ['体系', '姿势编号', '分类', '姿势名称', '角度', '检索'],
})

const CACHE = new Map()

/**
 * 把用户给的类型写法统一成目录名：人像 / portrait / portrait-zh / GHIL 人像 都认。
 * 认不出返回 null（由调用方报错，别猜）。
 */
export function normalizeKind(input) {
    const raw = String(input ?? '').trim()
    if (raw === '') return null
    if (GHIL_KINDS[raw]) return GHIL_KINDS[raw]
    const lower = raw.toLowerCase()
    for (const [zh, dir] of Object.entries(GHIL_KINDS)) {
        if (lower === dir || lower === zh) return dir
    }
    return null
}

/**
 * 图库根目录。
 *
 * 优先 `cfg.ghilRoot`；否则从 `cfg.comfyMainPy`（…/ComfyUI/main.py）推 `…/models/GHIL`；
 * 再不行用本机默认路径。**不做磁盘探测**（探测会把工具变慢，而配错路径的报错已经够明确）。
 */
export function libraryRoot(cfg) {
    const explicit = String(cfg?.ghilRoot ?? '').trim()
    if (explicit !== '') return isAbsolute(explicit) ? explicit : resolve(explicit)
    const mainPy = String(cfg?.comfyMainPy ?? '').trim()
    if (mainPy !== '') return join(dirname(mainPy), 'models', 'GHIL')
    return join('D:/dsh-video/a/ComfyUI/models/GHIL')
}

/** 读一类索引并**统一成 {id, path, title, tags, raw}**；失败返回空数组（图库缺失不该让工具挂）。 */
async function loadKind(root, kind) {
    const key = `${root}|${kind}`
    const hit = CACHE.get(key)
    if (hit !== undefined) return hit
    let rows = []
    try {
        const file = join(root, kind, 'data', INDEX_FILES[kind])
        const parsed = JSON.parse(await readFile(file, 'utf8'))
        if (Array.isArray(parsed)) rows = parsed
    } catch {
        rows = []
    }
    const imageFields = IMAGE_FIELDS[kind] ?? ['full', '原图']
    const textFields = TEXT_FIELDS[kind] ?? ['title']
    const entries = rows.map((row) => {
        let path = ''
        for (const field of imageFields) {
            const value = row?.[field]
            if (typeof value === 'string' && value !== '') { path = value; break }
        }
        const title = row?.title ?? row?.['姿势名称'] ?? row?.['分类'] ?? row?.hair_zh ?? row?.id ?? ''
        const tags = textFields.map((field) => row?.[field]).filter((v) => typeof v === 'string' && v !== '')
        return {
            id: String(row?.id ?? ''),
            path,
            title: String(title),
            tags: [...new Set(tags)].join(' '),
            raw: row,
        }
    }).filter((entry) => entry.id !== '' && entry.path !== '')
    CACHE.set(key, entries)
    return entries
}

/** 四类的条目数（面板/工具用它判断图库在不在）。 */
export async function libraryStats(root) {
    const out = {}
    for (const [zh, dir] of Object.entries(GHIL_KINDS)) {
        const entries = await loadKind(root, dir)
        out[zh] = { kind: dir, count: entries.length }
    }
    return out
}

/**
 * 检索：关键词按空白切分后**全部命中**才算（"短发 正脸" 不会只命中一个就算）。
 * query 为空 = 全部。
 */
export async function searchLibrary(root, { kind, query = '', limit = 12 } = {}) {
    const dir = normalizeKind(kind)
    if (dir === null) {
        return { error: `类型不认识：${kind}（可选：人像 / 服装 / 姿势 / 发型）` }
    }
    const entries = await loadKind(root, dir)
    const terms = String(query ?? '').toLowerCase().split(/\s+/u).filter((t) => t !== '')
    const matched = terms.length === 0
        ? entries
        : entries.filter((entry) => {
            const hay = `${entry.id} ${entry.title} ${entry.tags}`.toLowerCase()
            return terms.every((term) => hay.includes(term))
        })
    const cap = Math.max(1, Math.min(50, Math.trunc(limit) || 12))
    return { kind: dir, total: entries.length, matched: matched.length, items: matched.slice(0, cap) }
}

/**
 * 解析一个引用：
 *   · `ghil:人像/f71f980dde3` / `人像:f71f980dde3` / 纯 id（按 kind 提示找）
 *   · 绝对路径（本地图，原样返回）
 * 返回 `{ path, kind, id, title }` 或抛错（给模型的错误要能直接照做）。
 */
export async function resolveReference(root, ref, hintKind) {
    const text = String(ref ?? '').trim()
    if (text === '') throw new Error('参考图不能为空')
    if (isAbsolute(text) || /^[A-Za-z]:[\\/]/u.test(text)) {
        return { path: text, kind: '', id: '', title: '' }
    }
    let kindText = ''
    let body = text
    const colon = text.indexOf(':')
    if (colon > 0) {
        kindText = text.slice(0, colon).trim()
        body = text.slice(colon + 1).trim()
    }
    const slash = body.indexOf('/')
    if (slash > 0 && kindText === 'ghil') {
        kindText = body.slice(0, slash)
        body = body.slice(slash + 1)
    }
    const dir = normalizeKind(kindText !== '' ? kindText : hintKind)
    if (dir === null) {
        throw new Error(`认不出图库引用「${text}」。写成 ghil:人像/<id> 或直接给本地图片路径。`)
    }
    const entries = await loadKind(root, dir)
    const entry = entries.find((row) => row.id === body)
    if (entry === undefined) {
        throw new Error(`图库里没有这个 id：${body}（类型 ${dir}）。先用 character_image 的 action=list 查一下。`)
    }
    return { path: join(root, dir, entry.path), kind: dir, id: entry.id, title: entry.title }
}

/** 一行紧凑描述，供工具输出。 */
export function formatEntry(entry) {
    const tags = entry.tags === '' ? '' : `｜${entry.tags.split(' ').slice(0, 6).join(' ')}`
    return `${entry.id}　${entry.title}${tags}`
}