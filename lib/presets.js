/**
 * dsh-comfy-suite — 风格库（Preset library）
 * ============================================================================
 * 借鉴 dsh-image-gen 的「Prompt 灵感库」：把常用画风/光效/构图/画质/负面词
 * 做成**可直接拼接的短语积木**，让模型在出图前先检索再套用，而不是每次从零
 * 编提示词。
 *
 * 数据在 `lib/presets/qwen-presets.json`（纯数据，改文案不用碰代码）。
 * 这里只负责：加载（带缓存）、检索、组装、格式化。
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRESET_FILE = join(dirname(fileURLToPath(import.meta.url)), 'presets', 'qwen-presets.json');

/** kind → 人类可读标签（工具输出和 UI 共用）。 */
export const KIND_LABELS = {
    style: '画风',
    lighting: '光效',
    composition: '构图',
    quality: '画质',
    negative: '负面词',
    poster: '版式',
};

/** 一次检索默认返回多少条（工具侧用；太多会把工具输出撑爆）。 */
const MAX_RESULTS = 12;
/** 检索结果的硬上限：HTTP 路由要「全量」时传的就是条目总数。 */
const HARD_CAP = 500;

let cached;

/** 读风格库；读失败返回空表而不是抛错（风格库缺失不该让工具挂掉）。
 *
 * 失败**不写缓存**：一次瞬时读盘错误（安装未完成、杀软锁文件）不该让风格库
 * 空到下次重启 —— 那 5 个段落会全空，用户只会觉得"衣柜/风格库少了东西"。
 */
export async function loadPresets() {
    if (cached !== undefined) return cached;
    try {
        const parsed = JSON.parse(await readFile(PRESET_FILE, 'utf8'));
        cached = {
            title: typeof parsed?.title === 'string' ? parsed.title : '千问风格库',
            items: Array.isArray(parsed?.items) ? parsed.items.filter(isPreset) : [],
        };
        return cached;
    } catch {
        return { title: '千问风格库', items: [] };
    }
}

function isPreset(item) {
    return item !== null && typeof item === 'object'
        && typeof item.id === 'string' && item.id !== ''
        && typeof item.prompt === 'string' && item.prompt !== '';
}

/**
 * 检索：关键词同时匹配 id / 名称 / 标签 / 提示词正文。
 *
 * 关键词按空白切分后**全部命中**才算匹配（AND），这样"水墨 风景"不会因为
 * 只命中一个词就把不相关的条目翻出来。
 */
export function searchPresets(items, { query = '', kind = '', limit = MAX_RESULTS } = {}) {
    const terms = String(query ?? '').toLowerCase().split(/\s+/u).filter((term) => term !== '');
    const kindFilter = String(kind ?? '').trim().toLowerCase();
    const matched = (items ?? []).filter((item) => {
        if (kindFilter !== '' && String(item.kind ?? '').toLowerCase() !== kindFilter) return false;
        if (terms.length === 0) return true;
        const haystack = [
            item.id,
            item.name,
            item.prompt,
            item.note,
            ...(Array.isArray(item.tags) ? item.tags : []),
        ].join(' ').toLowerCase();
        return terms.every((term) => haystack.includes(term));
    });
    // 上限由调用方决定（默认工具侧的 12 条），不再硬夹到 50：
    // 风格库面板要的是全量，夹 50 会让第 51–62 条永远没有入口，而响应里的
    // total 仍写着 62。
    const cap = Math.max(1, Math.min(HARD_CAP, Math.trunc(limit) || MAX_RESULTS));
    return matched.slice(0, cap);
}

/** 按 id 取条目（保留传入顺序，忽略不存在的 id）。 */
export function pickPresets(items, ids) {
    const byId = new Map((items ?? []).map((item) => [item.id, item]));
    return (ids ?? []).map((id) => byId.get(String(id))).filter(Boolean);
}

/**
 * 组装：可选的用户主题 + 若干风格片段。
 *
 * 顺序是"主体 → 画风 → 光效 → 构图 → 画质"，负面词单独返回 —— 它要进
 * `negative` 字段而不是 prompt，混进去反而会污染画面描述。
 */
export function composePrompt(items, { ids = [], base = '' } = {}) {
    const picked = pickPresets(items, ids);
    const positives = picked.filter((item) => item.kind !== 'negative').map((item) => item.prompt);
    const negatives = picked.filter((item) => item.kind === 'negative').map((item) => item.prompt);
    const head = String(base ?? '').trim().replace(/[，,。.\s]+$/u, '');
    const prompt = [head, ...positives].filter((part) => part !== '').join('，');
    return { prompt, negative: negatives.join('，'), used: picked.map((item) => item.id) };
}

/** 一行紧凑描述，供工具输出与列表使用。 */
export function formatPreset(item) {
    const label = KIND_LABELS[item.kind] ?? item.kind ?? '其他';
    const tags = Array.isArray(item.tags) && item.tags.length > 0 ? ` [${item.tags.join('/')}]` : '';
    return `${item.id}　${item.name}（${label}）${tags}\n  ${item.prompt}`;
}

/** 工具输出：标题 + 若干行 + 一句用法提示。 */
export function formatPresetList(title, items) {
    if (items.length === 0) return `${title}：没有匹配的条目。换一个更短的关键词，或去掉 kind 过滤。`;
    const lines = items.map((item) => formatPreset(item));
    return [
        `${title}（${items.length} 条）：`,
        ...lines,
        '',
        '用法：挑 2–4 条（画风 + 光效 + 构图最常见），把它们的中文描述接在画面主体后面当 prompt；',
        '带「负面词」的那条请放进 draw_image 的 negative 参数，不要混进 prompt。',
    ].join('\n');
}