/**
 * dsh-comfy-suite — 提示词衣柜（Prompt Wardrobe）
 * ============================================================================
 * 借自 `Comfyui-Anima-Wardrobe-V5`（灵冻不冻，GPL-3.0）的**引擎设计**，不是它的
 * 词库：那份语料是 danbooru 英文标签，服务 Anima 底模；本套件的出图后端是
 * Qwen-Image，吃的是中文自然语言。所以这里移植的是「怎么做」，词条按 Qwen 重写。
 *
 * 移植过来的四件事（也是原项目 README 里点明的四个缺口）：
 *
 *   ① **先按档位收窄候选池，再抽** —— 低档绝不越界，不是抽完再筛。
 *      实现上只有 `candidatesOf()` 一个准入点，权重再大也拉不回超档项。
 *   ② **三层权重** —— 段 / 字段 / 选项。0 = 关闭，1 = 常态，3 = 必现。
 *      段权重乘在该段所有字段的概率上；字段权重 3 直接短路成必抽（不乘概率），
 *      否则"必现"会被基准概率和密度整体压掉，权重面板就成了骗人的东西。
 *   ③ **可复现** —— 同 seed 同设置逐字相同。种子用 crc32/整数，**不用**
 *      `Math.random` 或任何按进程加盐的东西；`seed < 0` 才每次重抽。
 *   ④ **自检报告** —— 越界、让路、互斥、上限裁剪逐条写明，而不是"抽出来就这样"。
 *
 * 另外两条原项目的工程契约也被照搬：
 *   · 数据文件是**人写内容**，加载时做完整校验；坏条目只废自己，不炸整库。
 *   · 场景搭配是一份**跨槽位固定组合**（锁字段），不是一段固定文案 ——
 *     锁住的字段不参与随机，其余字段照常抽，所以同一场景每次细节都不同。
 *
 * ⚠️ 与 Anima 的一处刻意不同：它的词库进进程级缓存、改 JSON 要重启后端；
 *    这里 `loadWardrobe()` 缓存的是**解析结果**，但 `reloadWardrobe()` 可随时
 *    丢弃缓存，宿主热重载与测试都用得上。
 */
import { readFile } from 'node:fs/promises';
import { randomInt } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPresets } from './presets.js';

const DATA_FILE = join(dirname(fileURLToPath(import.meta.url)), 'presets', 'qwen-wardrobe.json');

/** 权重上限：与原项目一致，3.0 = 必现。 */
export const WEIGHT_MAX = 3;
export const WEIGHT_DEFAULT = 1;

/** 默认值；数据文件里的 `defaults` 会覆盖它。 */
const FALLBACK = {
    level: 0,
    mode: 'person',
    baseProb: 0.65,
    tagCap: 14,
    sceneChance: 0.35,
};

/* ============================================================================
 * 一、档位
 * ========================================================================== */

/** 档位中文别名 → 数字。用户可能传 "L2" / "2" / "明确"，都认。 */
const LEVEL_ALIASES = new Map([
    ['sfw', 0], ['safe', 0], ['全年龄', 0], ['安全', 0], ['0', 0],
    ['l1', 1], ['1', 1], ['轻度', 1], ['轻度暗示', 1],
    ['l2', 2], ['2', 2], ['明确', 2],
    ['l3', 3], ['3', 3], ['露骨', 3],
    ['l4', 4], ['4', 4], ['极端', 4], ['any', 4], ['不限', 4],
]);

/**
 * 把任意写法折算成 0–4 的档位数字。
 *
 * 认不出来时**退回 fallback 而不是报错**：档位错了顶多抽得不合口味，
 * 让整次调用失败才是真损失（与 `resolveLevel` 在原项目里的处理一致）。
 */
export function resolveLevel(value, fallback = 0) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, Math.min(4, Math.round(value)));
    }
    const key = String(value ?? '').trim().toLowerCase();
    if (key === '') return fallback;
    if (LEVEL_ALIASES.has(key)) return LEVEL_ALIASES.get(key);
    return fallback;
}

/** 档位元信息（key / 中文标签 / 一句话解释）。 */
export function levelMeta(level, levels) {
    const num = resolveLevel(level);
    const hit = (levels ?? []).find((entry) => entry.num === num);
    return hit ?? { key: `L${num}`, num, label: `L${num}`, hint: '' };
}

/* ============================================================================
 * 二、确定性随机
 * ========================================================================== */

/**
 * 32 位 CRC32 —— 用于从字符串派生种子。
 *
 * 为什么不用 `Math.random` / 时间戳派生：那两样都不可复现。原项目在
 * `derive_seed` 里特别写明「不用内置 hash()，它每进程加盐」，同一个道理。
 */
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
        let c = i;
        for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[i] = c >>> 0;
    }
    return table;
})();

export function crc32(text) {
    let crc = 0xFFFFFFFF;
    const bytes = Buffer.from(String(text), 'utf8');
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** 从任意几段字符串派生一个稳定种子。 */
export function deriveSeed(...parts) {
    return crc32(parts.map((part) => String(part)).join('|'));
}

/**
 * mulberry32：一个 32 位状态、几行就能写完、跨进程逐位一致的 PRNG。
 *
 * 不用 `Math.random()`：它是宿主实现，没法保证"同 seed 同结果"，
 * 而可复现正是这个模块的卖点之一。
 */
export function makeRng(seed) {
    let state = (Number.isFinite(seed) ? Math.trunc(seed) : 0) >>> 0;
    return function next() {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** 随机种子（只在 `seed < 0` 时用；用 crypto 而不是 Math.random）。 */
function newSeed() {
    return randomInt(0, 0x7FFFFFFF);
}

/* ============================================================================
 * 三、加载与校验
 * ========================================================================== */

/** 一条选项：`[标签, 正文, 档位?, 压掉的字段?]` → 对象。 */
function normalizeOption(raw, fieldKey) {
    if (!Array.isArray(raw) || raw.length < 2) return undefined;
    const label = String(raw[0] ?? '').trim();
    const phrase = String(raw[1] ?? '').trim();
    if (label === '') return undefined;
    const level = Number.isFinite(raw[2]) ? Math.max(0, Math.min(4, Math.trunc(raw[2]))) : 0;
    // 连体款（长裙/浴衣/床单）选中后下装就不该再抽 —— 原项目里这叫 drop_fields，
    // 是场景与固定组合共用的机制，这里下放到选项级。
    const omit = Array.isArray(raw[3]) ? raw[3].map((entry) => String(entry)) : [];
    return { label, phrase, level, field: fieldKey, omit };
}

/**
 * 把「数据文件 + 风格库」合成一个可直接跑的模型。
 *
 * `from.presets = kind` 的段（画风/光线/构图/画质/负面）不重复维护词条：
 * 直接取风格库里同类条目，段落名沿用 kind。这样加一条风格只需要改一处。
 */
export function buildModel(data, presetLibrary) {
    const issues = [];
    const levels = Array.isArray(data?.levels) ? data.levels.filter((entry) => Number.isFinite(entry?.num)) : [];
    const presets = Array.isArray(presetLibrary?.items) ? presetLibrary.items : [];
    const layers = [];

    for (const rawLayer of Array.isArray(data?.layers) ? data.layers : []) {
        const id = String(rawLayer?.id ?? '').trim();
        if (id === '') {
            issues.push('有一层没有 id，已跳过');
            continue;
        }
        const kind = rawLayer?.from?.presets;
        // 字段没写自己的优先级时**继承段**：否则裁剪阶段会把所有字段当同优先级，
        // 按数据顺序误删（第一次实测就把人物特征与服装先删光了）。
        const layerPriority = Number.isFinite(rawLayer?.priority) ? rawLayer.priority : 50;
        const fields = [];
        const rawFields = Array.isArray(rawLayer?.fields) ? rawLayer.fields : [];

        for (const rawField of rawFields) {
            const key = String(rawField?.key ?? '').trim();
            if (key === '') {
                issues.push(`${id}: 有字段没有 key，已跳过`);
                continue;
            }
            let options;
            if (kind !== undefined) {
                // 预设段：选项 = 风格库里该 kind 的全部条目。
                options = presets
                    .filter((item) => String(item?.kind ?? '') === String(kind))
                    .map((item) => ({
                        label: String(item.name ?? item.id),
                        phrase: String(item.prompt ?? ''),
                        level: Number.isFinite(item.level) ? Math.max(0, Math.min(4, item.level)) : 0,
                        field: `${id}.${key}`,
                        presetId: String(item.id ?? ''),
                        omit: [],
                    }))
                    .filter((option) => option.phrase !== '');
                if (options.length === 0) {
                    issues.push(`${id}: 风格库里没有 kind=${kind} 的条目，该段不可用`);
                }
            } else {
                options = (Array.isArray(rawField?.opts) ? rawField.opts : [])
                    .map((option) => normalizeOption(option, `${id}.${key}`))
                    .filter(Boolean);
            }
            if (options.length === 0) {
                issues.push(`${id}.${key}: 没有可用选项，该字段不可用`);
                continue;
            }
            // 字段内部按档位排序，保证不同 setup 下的迭代顺序稳定（可复现的前提）。
            options.sort((a, b) => a.level - b.level);
            fields.push({
                key,
                label: String(rawField?.label ?? key),
                req: rawField?.req === true,
                prob: Number.isFinite(rawField?.prob) ? Math.max(0, Math.min(1, rawField.prob)) : undefined,
                priority: Number.isFinite(rawField?.priority) ? rawField.priority : layerPriority,
                level: `${id}.${key}`,
                options,
            });
        }

        if (fields.length === 0) {
            issues.push(`${id}: 没有可用字段，该段不可用`);
            continue;
        }
        layers.push({
            id,
            title: String(rawLayer?.title ?? id),
            order: Number.isFinite(rawLayer?.order) ? rawLayer.order : 999,
            floor: Number.isFinite(rawLayer?.floor) ? rawLayer.floor : 0,
            priority: Number.isFinite(rawLayer?.priority) ? rawLayer.priority : 50,
            mode: Array.isArray(rawLayer?.mode) && rawLayer.mode.length > 0
                ? rawLayer.mode.map((entry) => String(entry))
                : ['person', 'object', 'scene'],
            fields,
        });
    }

    layers.sort((a, b) => a.order - b.order);

    // 字段索引：场景锁定 / 强制指定 / 权重都按 `layer.field` 寻址。
    const byField = new Map();
    for (const layer of layers) for (const field of layer.fields) byField.set(field.level, { layer, field });

    const scenes = [];
    for (const raw of Array.isArray(data?.scenes) ? data.scenes : []) {
        const scene = normalizeScene(raw, byField, issues);
        if (scene !== undefined) scenes.push(scene);
    }

    const mutex = [];
    for (const raw of Array.isArray(data?.mutex) ? data.mutex : []) {
        const a = parseRef(raw?.a, byField);
        const b = parseRef(raw?.b, byField);
        if (a === undefined || b === undefined) {
            issues.push(`互斥组引用了不存在的字段/选项：${JSON.stringify(raw?.a)} × ${JSON.stringify(raw?.b)}`);
            continue;
        }
        mutex.push({ a, b, note: String(raw?.note ?? '') });
    }

    return {
        schema: String(data?.schema ?? ''),
        title: String(data?.title ?? '提示词衣柜'),
        levels,
        modes: data?.modes ?? {},
        defaults: { ...FALLBACK, ...(data?.defaults ?? {}) },
        layers,
        scenes,
        mutex,
        // 选项级约束：性别 / 适用模式。键是 `layer.field=选项标签`，值是
        // `{gender}` 或 `{modes}`。放在独立表里而不是塞进元组，是为了让
        // 词条本身仍然只有「标签 + 正文 + 档位」三件事，读起来不费劲。
        optionScopes: new Map(Object.entries(data?.optionScopes ?? {})),
        requiredByMode: data?.requiredByMode ?? {},
        defaultNegative: String(data?.defaultNegative ?? ''),
        issues,
    };
}

/** `["layer.field", "选项标签"]` → `{field, option}`；任何一段对不上就返回 undefined。 */
function parseRef(raw, byField) {
    if (!Array.isArray(raw) || raw.length < 2) return undefined;
    const field = byField.get(String(raw[0]));
    if (field === undefined) return undefined;
    const option = field.field.options.find((entry) => entry.label === String(raw[1]));
    if (option === undefined) return undefined;
    return { layer: field.layer.id, field: field.field.key, label: option.label, option };
}

/**
 * 场景：跨槽位固定组合。
 *
 * 两条硬约束（原项目踩过，这里直接钉住）：
 *   · 锁定的值必须是**真实存在的选项**，否则场景静默缺一块；
 *   · 场景自己的档位必须 ≥ 它锁定的每个选项的档位，否则「低档场景夹带高档词」
 *     会绕过闸门 —— 这是唯一能让超档内容进画面的漏洞。
 */
function normalizeScene(raw, byField, issues) {
    const id = String(raw?.id ?? '').trim();
    if (id === '') {
        issues.push('有一条场景没有 id，已跳过');
        return undefined;
    }
    const level = Number.isFinite(raw?.level) ? Math.max(0, Math.min(4, raw.level)) : 0;
    const locks = [];
    let maxLockLevel = 0;
    for (const [key, label] of Object.entries(raw?.locks ?? {})) {
        const hit = byField.get(String(key));
        if (hit === undefined) {
            issues.push(`${id}: 锁定了不存在的字段 ${key}，该场景已停用`);
            return undefined;
        }
        const option = hit.field.options.find((entry) => entry.label === String(label));
        if (option === undefined) {
            issues.push(`${id}: 字段 ${key} 没有选项「${label}」，该场景已停用`);
            return undefined;
        }
        maxLockLevel = Math.max(maxLockLevel, option.level);
        locks.push({ key: String(key), layer: hit.layer.id, field: hit.field.key, option });
    }
    if (maxLockLevel > level) {
        issues.push(`${id}: 声明档位 L${level} 低于它锁定的选项 L${maxLockLevel}，该场景已停用`);
        return undefined;
    }
    return {
        id,
        zh: String(raw?.zh ?? id),
        desc: String(raw?.desc ?? ''),
        level,
        locks,
        extra: String(raw?.extra ?? ''),
        note: String(raw?.note ?? ''),
    };
}

let cache;

/**
 * 读数据 + 风格库并建模型。
 *
 * 读失败返回一个空模型而不是抛错：衣柜坏了不该让整个套件（和它的出图能力）
 * 一起挂掉 —— 与 `loadPresets()` 的失败策略一致。
 */
export async function loadWardrobe() {
    if (cache !== undefined) return cache;
    const library = await loadPresets();
    let data = {};
    try {
        data = JSON.parse(await readFile(DATA_FILE, 'utf8'));
    } catch (error) {
        // 读失败**不写缓存**：一次瞬时读盘错误不该让衣柜空到下次重启
        // （5 个段落全空，用户只会觉得"衣柜少了东西"）。下次调用会重试。
        const model = buildModel({}, library);
        model.issues.push(`衣柜数据读取失败：${error instanceof Error ? error.message : String(error)}`);
        return model;
    }
    // 风格库本身没读到时也一样：空库烘进模型会让 style/lighting/composition
    // 三段永远为空，即使文件只是那一刻被锁住了。
    if (library.items.length === 0) {
        const model = buildModel(data, library);
        model.issues.push('风格库为空（可能是瞬时读取失败），本次不缓存衣柜模型，下次调用会重试');
        return model;
    }
    cache = buildModel(data, library);
    return cache;
}

/** 丢弃缓存（热重载 / 测试用）。 */
export function reloadWardrobe() {
    cache = undefined;
}

/* ============================================================================
 * 四、三层权重
 * ========================================================================== */

/**
 * 解析权重输入。认两种写法：
 *
 *   { layers: { outfit: 0.5 }, fields: { 'outfit.top': 3 }, options: { 'outfit.top=比基尼上衣': 0 } }
 *   { 'outfit': 0.5, 'outfit.top': 3, 'outfit.top=比基尼上衣': 0 }   // 扁平写法
 *
 * 认不出来的键**进报告**而不是静默忽略 —— 用户以为自己在调权重、实际没生效，
 * 是最难查的一类"功能没坏但不对"。
 */
export function parseWeights(raw) {
    const out = { layers: new Map(), fields: new Map(), options: new Map(), unknown: [] };
    if (raw === null || typeof raw !== 'object') return out;

    const put = (key, value) => {
        const weight = Number(value);
        if (!Number.isFinite(weight)) {
            out.unknown.push(`${key}=${String(value)}（不是数字）`);
            return;
        }
        const clamped = Math.max(0, Math.min(WEIGHT_MAX, weight));
        const text = String(key).trim();
        if (text === '') return;
        const eq = text.indexOf('=');
        if (eq > 0) {
            // 键就是 `layer.field=选项标签` 整串 —— 别在这里切掉 "=标签"，
            // 否则选项权重永远匹配不上任何选项（静默失效，最难查）。
            out.options.set(text, clamped);
            return;
        }
        const dot = text.lastIndexOf('.');
        if (dot > 0) {
            out.fields.set(text, clamped);
            return;
        }
        out.layers.set(text, clamped);
    };

    const nested = raw.layers !== undefined || raw.fields !== undefined || raw.options !== undefined;
    if (nested) {
        for (const [key, value] of Object.entries(raw.layers ?? {})) put(key, value);
        for (const [key, value] of Object.entries(raw.fields ?? {})) put(key, value);
        for (const [key, value] of Object.entries(raw.options ?? {})) put(key, value);
    } else {
        for (const [key, value] of Object.entries(raw)) put(key, value);
    }
    return out;
}

const weightOf = (map, key) => (map.has(key) ? map.get(key) : WEIGHT_DEFAULT);

/* ============================================================================
 * 五、抽取
 * ========================================================================== */

const clamp01 = (value) => Math.max(0, Math.min(1, value));

/**
 * 加权取一项。**这是选项层的唯一随机点**：权重 0 的项在 `candidatesOf` 里
 * 已经被剔除，所以这里不需要再判一次。
 */
function weightedPick(rng, options, weightOfOption) {
    if (options.length === 0) return undefined;
    const weights = options.map((option) => Math.max(0, weightOfOption(option)));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) return undefined;
    let point = rng() * total;
    for (let index = 0; index < options.length; index += 1) {
        point -= weights[index];
        if (point <= 0) return options[index];
    }
    return options[options.length - 1];
}

/**
 * 候选池：**唯一的准入判定点**。
 *
 * ⚠️ 档位闸门在这里、且只在这里。权重只影响池内的相对概率，永远不能把
 *    超档选项拉回来——这是「低档绝不越界」的硬保证（原项目同一处注释）。
 */
function candidatesOf(field, level, weights, context) {
    const out = [];
    for (const option of field.options) {
        if (option.level > level) continue;
        const weight = weightOf(weights.options, `${field.level}=${option.label}`);
        if (weight <= 0) continue;
        if (context !== undefined) {
            const scope = context.scopes?.get(`${field.level}=${option.label}`);
            if (scope !== undefined) {
                if (Array.isArray(scope.modes) && !scope.modes.includes(context.mode)) continue;
                // gender 为空（用户自带主体、没说性别）时**不过滤**：
                // 猜错性别比不猜更糟。
                if (typeof scope.gender === 'string' && scope.gender !== 'mixed'
                    && context.gender !== '' && scope.gender !== context.gender) continue;
            }
        }
        out.push(option);
    }
    return out;
}

/** 段是否参与：模式匹配 + 段下限 + 段内至少有一条合格候选。 */
function layerAllowed(layer, level, mode, weights, enabled, context) {
    if (enabled !== undefined && !enabled.has(layer.id)) return false;
    if (!layer.mode.includes(mode)) return false;
    if (layer.floor > level) return false;
    if (weightOf(weights.layers, layer.id) <= 0) return false;
    return layer.fields.some((field) => candidatesOf(field, level, weights, context).length > 0);
}

/**
 * 跑一次抽取。
 *
 * @returns {{
 *   text: string, prompt: string, negative: string, seed: number,
 *   level: number, levelKey: string, levelLabel: string, mode: string,
 *   picks: Array<{layer: string, field: string, label: string, phrase: string, source: string}>,
 *   scene?: object, report: string, notes: string[], capped: number
 * }}
 */
export function draw(model, options = {}) {
    const defaults = model.defaults ?? FALLBACK;
    const notes = [];

    const requestedLevel = resolveLevel(options.level, defaults.level);
    const mode = String(options.mode ?? defaults.mode);
    if (!Object.prototype.hasOwnProperty.call(model.modes ?? {}, mode)) {
        notes.push(`未知模式「${mode}」，已按 ${defaults.mode} 处理`);
    }
    const effectiveMode = Object.prototype.hasOwnProperty.call(model.modes ?? {}, mode) ? mode : defaults.mode;

    // 权重可以传解析好的（三张 Map），也可以直接传用户那份扁平 JSON。
    const weights = options.weights !== undefined && options.weights.layers instanceof Map
        ? options.weights
        : parseWeights(options.weights);
    const baseProb = Number.isFinite(options.baseProb) && options.baseProb > 0
        ? clamp01(options.baseProb)
        : defaults.baseProb;
    const tagCap = Number.isFinite(options.tagCap) ? Math.max(0, Math.trunc(options.tagCap)) : defaults.tagCap;
    const sceneChance = Number.isFinite(options.sceneChance) ? clamp01(options.sceneChance) : defaults.sceneChance;
    const enabled = Array.isArray(options.layers) && options.layers.length > 0
        ? new Set(options.layers.map((entry) => String(entry)))
        : undefined;
    // 用户自己给了主体时，`subject` 段整段不抽：再抽一个"一位年轻女性"只会
    // 放进池子里占名额，最后还会被组装阶段丢掉。
    const suppliedSubject = String(options.subject ?? '').trim();

    // ── 先定种子，再抽场景 ──────────────────────────────────────────────
    // 顺序很重要：场景是从**同一串随机数**里抽的。如果先抽场景再定种子
    // （或场景用另一路种子），"同 seed 同结果"在带场景的调用里就不成立了。
    const seeded = Number.isFinite(options.seed) && Number(options.seed) >= 0;
    const seed = seeded ? Math.trunc(Number(options.seed)) : newSeed();
    const rng = makeRng(seed);

    const scene = pickScene(model, options.scene, requestedLevel, sceneChance, rng);
    if (scene.error !== undefined) notes.push(scene.error);

    // ── 强制项：用户显式指定 > 场景锁定 > 随机 ─────────────────────────
    const forced = new Map();
    for (const [key, label] of Object.entries(options.forced ?? {})) {
        const hit = findField(model, String(key));
        if (hit === undefined) {
            notes.push(`强制项 ${key} 找不到对应字段，已忽略`);
            continue;
        }
        const option = hit.field.options.find((entry) => entry.label === String(label));
        if (option === undefined) {
            notes.push(`强制项 ${key} 没有选项「${label}」，已忽略`);
            continue;
        }
        forced.set(hit.levelKey, option);
    }

    // 有效档位：显式指定/场景可能把整张图抬到更高档（原项目 v4.3.0 的口径）。
    // 随机抽样**永不**抬档；被动抬档一律写进报告。
    let level = requestedLevel;
    for (const option of forced.values()) level = Math.max(level, option.level);
    if (scene.scene !== undefined) level = Math.max(level, scene.scene.level);
    if (level > requestedLevel) {
        notes.push(`档位按显式指定自动上调：L${requestedLevel} → L${level}`);
    }

    // 场景锁定的字段 → 直接写死，不参与随机。
    const lockedByScene = new Map();
    if (scene.scene !== undefined) {
        for (const lock of scene.scene.locks) lockedByScene.set(lock.key, lock.option);
    }

    const picks = [];
    const skipped = [];
    const gated = [];
    // 被连体款/裹身款压掉的字段：`fieldKey → 压掉它的那一条`（报告里要写清）。
    const suppressed = new Map();
    // 选项级约束的上下文：模式 + 性别。性别可能等 `who` 抽完才知道，
    // 所以是个可变对象，而不是一个参数值。
    const scopeContext = {
        mode: effectiveMode,
        gender: String(options.gender ?? ''),
        scopes: model.optionScopes,
    };
    const modeRequired = new Set(model.requiredByMode?.[effectiveMode] ?? []);

    for (const layer of model.layers) {
        if (layer.id === 'subject' && suppliedSubject !== '') continue;
        if (!layerAllowed(layer, level, effectiveMode, weights, enabled, scopeContext)) {
            if (layer.mode.includes(effectiveMode) && weightOf(weights.layers, layer.id) <= 0) {
                skipped.push(`${layer.title}（段权重 0）`);
            }
            continue;
        }
        const layerWeight = weightOf(weights.layers, layer.id);

        for (const field of layer.fields) {
            const fieldKey = field.level;
            const fieldWeight = weightOf(weights.fields, fieldKey);

            const fixed = forced.get(fieldKey) ?? lockedByScene.get(fieldKey);
            if (fixed !== undefined) {
                picks.push({
                    layer: layer.id,
                    field: field.key,
                    label: fixed.label,
                    phrase: fixed.phrase,
                    source: forced.has(fieldKey) ? 'forced' : 'scene',
                    priority: field.priority,
                    required: field.req === true || modeRequired.has(fieldKey),
                    // 显式锁定（场景 / forced）的项不参与上限裁剪：
                    // 场景写死的东西被裁掉，等于场景没生效。
                    protected: true,
                });
                for (const key of fixed.omit ?? []) suppressed.set(key, `${field.label}「${fixed.label}」`);
                continue;
            }
            if (suppressed.has(fieldKey)) {
                skipped.push(`${field.label}（被 ${suppressed.get(fieldKey)} 取代）`);
                continue;
            }
            if (fieldWeight <= 0) {
                skipped.push(`${field.label}（字段权重 0）`);
                continue;
            }

            const candidates = candidatesOf(field, level, weights, scopeContext);
            if (candidates.length === 0) {
                gated.push(`${field.label}（无 ≤L${level} 候选）`);
                continue;
            }

            // 选项权重 3 = 必现：先把它们找出来 —— 它同时把这个**字段**也变成必抽，
            // 否则"必现的选项"会因为字段整体没被抽中而消失，用户只会觉得权重没生效。
            const forcedOption = candidates.filter(
                (option) => weightOf(weights.options, `${fieldKey}=${option.label}`) >= WEIGHT_MAX,
            );

            // 字段权重 3 = 必现：短路成必抽，不乘概率（否则会被正式概率压掉）。
            const must = fieldWeight >= WEIGHT_MAX || field.req === true
                || modeRequired.has(fieldKey) || forcedOption.length > 0;
            const probability = must ? 1 : clamp01(baseProb * (field.prob ?? 1) * layerWeight * fieldWeight);
            if (!must && rng() >= probability) continue;

            const picked = forcedOption.length > 0
                ? forcedOption[0]
                : weightedPick(rng, candidates, (option) => weightOf(weights.options, `${fieldKey}=${option.label}`));
            if (picked === undefined) continue;

            picks.push({
                layer: layer.id,
                field: field.key,
                label: picked.label,
                phrase: picked.phrase,
                source: forcedOption.length > 0 ? 'weight' : 'random',
                priority: field.priority,
                required: field.req === true || modeRequired.has(fieldKey),
                // 被权重点成"必现"的字段同样不参与裁剪：用户明确要求它出现，
                // 再被上限裁掉就等于权重面板在说假话。
                protected: forcedOption.length > 0 || fieldWeight >= WEIGHT_MAX,
            });
            for (const key of picked.omit ?? []) suppressed.set(key, `${field.label}「${picked.label}」`);
            // 抽到主体后才知道性别：后面的发型/服装按它收窄候选池。
            if (layer.id === 'subject') {
                const scope = model.optionScopes.get(`${fieldKey}=${picked.label}`);
                if (scope?.gender !== undefined && scope.gender !== 'mixed') scopeContext.gender = scope.gender;
            }
        }
    }

    // ── 互斥：显式 > 随机；同类冲突保留 priority 高的一侧 ────────────────
    const conflicts = applyMutex(model, picks);

    // ── 上限：先按优先级排序再裁，绝不裁掉主体 / 场景 / 负面 ────────────
    const cap = tagCap > 0 ? tagCap : 0;
    let capped = 0;
    const trimmed = [];
    // 负面词单独一条，不进正文，也不占正文的名额。
    const bodyPicks = picks.filter((entry) => entry.layer !== 'negative');
    if (cap > 0 && bodyPicks.length > cap) {
        const droppable = [...bodyPicks].sort((a, b) => a.priority - b.priority);
        const keep = new Set(picks);
        let remaining = bodyPicks.length;
        while (remaining > cap) {
            // `required`（主体/服装/画风/画质）与优先级 100 的项永不裁掉：
            // 裁掉它们等于把"必现"变成"通常出现"，那是另一种骗人。
            const victim = droppable.find((entry) => keep.has(entry)
                && entry.required !== true && entry.protected !== true && entry.priority < 100);
            if (victim === undefined) break;
            keep.delete(victim);
            trimmed.push(`${victim.layer}.${victim.field}「${victim.label}」`);
            capped += 1;
            remaining -= 1;
        }
        for (let index = picks.length - 1; index >= 0; index -= 1) {
            if (!keep.has(picks[index])) picks.splice(index, 1);
        }
    }

    // ── 组装正文 ────────────────────────────────────────────────────────
    // 顺序按段序（主体 → 特征 → 服装 → 动作 → 场景 → 镜头 → 光线 → 画风 →
    // 画质）。场景的 `extra` 排在场景段之后、镜头之前 —— 它是场景的一部分，
    // 甩到句尾会读成"另外加了一句"。
    const head = suppliedSubject !== ''
        ? suppliedSubject
        : (picks.find((entry) => entry.layer === 'subject')?.phrase ?? '');
    const ordered = picks
        .filter((entry) => entry.layer !== 'subject' && entry.layer !== 'negative')
        .map((entry, index) => ({ order: orderOfLayer(model, entry.layer), index, clause: entry.phrase }));
    if (scene.scene?.extra !== undefined && scene.scene.extra !== '') {
        ordered.push({ order: orderOfLayer(model, 'scene') + 0.5, index: 1e6, clause: scene.scene.extra });
    }
    ordered.sort((a, b) => a.order - b.order || a.index - b.index);

    const seen = new Set();
    const clauses = [];
    for (const entry of ordered) {
        if (entry.clause === '' || seen.has(entry.clause)) continue;
        seen.add(entry.clause);
        clauses.push(entry.clause);
    }

    const text = [head, ...clauses].filter((part) => part !== '').join('，');
    const prompt = text === '' ? '' : `${text}。`;

    // ── 负面词：抽到的 + 数据里的兜底，去重后给 draw_image 的 negative ────
    const negativeParts = picks
        .filter((entry) => entry.layer === 'negative')
        .map((entry) => entry.phrase)
        .filter((phrase) => phrase !== '');
    if (negativeParts.length === 0 && model.defaultNegative !== '') negativeParts.push(model.defaultNegative);
    const negative = dedupeJoin(negativeParts);

    const report = renderReport({
        model,
        requestedLevel,
        level,
        seed,
        seeded,
        mode: effectiveMode,
        scene: scene.scene,
        picks,
        skipped,
        gated,
        conflicts,
        capped,
        trimmed,
        notes,
        baseProb,
        tagCap,
        weights,
    });

    return {
        text,
        prompt,
        negative,
        seed,
        seeded,
        level,
        levelKey: levelMeta(level, model.levels).key,
        levelLabel: levelMeta(level, model.levels).label,
        mode: effectiveMode,
        subject: head,
        picks,
        scene: scene.scene,
        report,
        notes,
        capped,
    };
}

function findField(model, key) {
    for (const layer of model.layers) {
        const field = layer.fields.find((entry) => entry.level === key || entry.key === key);
        if (field !== undefined) return { layer, field, levelKey: field.level };
    }
    return undefined;
}

/** 段序（用于把选中的片段按"主体→…→画质"排成一句话）。 */
function orderOfLayer(model, id) {
    const layer = model.layers.find((entry) => entry.id === id);
    return layer === undefined ? 999 : layer.order;
}

/** 抽场景：`off` / `auto` / 具体 id。`rng` 是主随机流（保证可复现）。 */
function pickScene(model, request, level, sceneChance, rng) {
    const wanted = String(request ?? 'off').trim();
    if (wanted === '' || wanted === 'off' || wanted === 'none') return { scene: undefined };
    if (wanted !== 'auto') {
        const hit = model.scenes.find((entry) => entry.id === wanted || entry.zh === wanted);
        if (hit === undefined) return { scene: undefined, error: `没有场景「${wanted}」，已忽略` };
        if (hit.level > level) {
            return { scene: undefined, error: `场景「${hit.zh}」是 L${hit.level}，高于当前档位 L${level}，已跳过` };
        }
        return { scene: hit };
    }
    const pool = model.scenes.filter((entry) => entry.level <= level);
    if (pool.length === 0) return { scene: undefined };
    if (rng() >= sceneChance) return { scene: undefined };
    return { scene: pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] };
}

/**
 * 互斥消解：两边都出现时删掉 priority 低的一侧；同优先级删后出现的那条。
 * 被删的写进报告，不静默处理。
 */
function applyMutex(model, picks) {
    const conflicts = [];
    if (model.mutex.length === 0) return conflicts;
    for (const group of model.mutex) {
        const hitA = picks.find((entry) => entry.layer === group.a.layer
            && entry.field === group.a.field && entry.label === group.a.label);
        const hitB = picks.find((entry) => entry.layer === group.b.layer
            && entry.field === group.b.field && entry.label === group.b.label);
        if (hitA === undefined || hitB === undefined) continue;
        // 先看"必现/锁定"：随机项永远给显式项让路。两个都是随机时，
        // 再按优先级（低的先删）。
        let victim;
        if (hitA.required !== true && hitB.required === true) victim = hitA;
        else if (hitB.required !== true && hitA.required === true) victim = hitB;
        else victim = (hitA.priority ?? 50) >= (hitB.priority ?? 50) ? hitB : hitA;
        const index = picks.indexOf(victim);
        if (index >= 0) picks.splice(index, 1);
        conflicts.push(`${victim.layer}.${victim.field}「${victim.label}」`
            + `（与 ${victim === hitA ? `${hitB.layer}.${hitB.field}「${hitB.label}」` : `${hitA.layer}.${hitA.field}「${hitA.label}」`} 互斥）`);
    }
    return conflicts;
}

function dedupeJoin(parts) {
    const seen = new Set();
    const out = [];
    for (const part of parts) {
        for (const piece of String(part).split(/[，,]/u).map((entry) => entry.trim()).filter(Boolean)) {
            if (seen.has(piece)) continue;
            seen.add(piece);
            out.push(piece);
        }
    }
    return out.join('，');
}

/* ============================================================================
 * 六、报告与元信息
 * ========================================================================== */

/**
 * 自检报告。原则：**只写影响解读的事实**，不写"成功/失败"这种废话。
 * 原项目的 report 之所以有用，是因为它逐条回答"为什么少了/多了这一项"。
 */
function renderReport(ctx) {
    const {
        model, requestedLevel, level, seed, seeded, mode, scene, picks,
        skipped, gated, conflicts, capped, trimmed, notes, baseProb, tagCap, weights,
    } = ctx;
    const meta = levelMeta(level, model.levels);
    const lines = [];

    const levelLine = level === requestedLevel
        ? `档位：L${level} ${meta.label}（上限 ${level}）`
        : `档位：L${requestedLevel} → L${level} ${meta.label}（按显式指定上调）`;
    lines.push(levelLine);
    lines.push(`种子：${seed}${seeded ? '（固定，可复现）' : '（随机，记下来可复现）'}`);
    lines.push(`模式：${model.modes?.[mode]?.label ?? mode}｜基准概率 ${baseProb.toFixed(2)}｜上限 ${tagCap > 0 ? `${tagCap} 条` : '不限'}`);

    const layerIds = new Set(picks.map((entry) => entry.layer));
    lines.push(`参与图层：${layerIds.size}/${model.layers.length}｜入选 ${picks.length} 条`
        + (capped > 0 ? `（裁剪 ${capped} 条）` : ''));
    // 必现项 + 场景锁定如果已经超过上限，裁剪会停下来 —— 说清楚为什么没裁到 cap，
    // 否则报告上的"上限 14"和实际 16 条对不上。
    const bodyCount = picks.filter((entry) => entry.layer !== 'negative').length;
    if (tagCap > 0 && bodyCount > tagCap) {
        lines.push(`说明：必现与锁定项共 ${bodyCount} 条，超出上限 ${tagCap}；显式项不参与裁剪`);
    }

    if (scene !== undefined) {
        lines.push(`场景：${scene.zh}（L${scene.level}，锁定 ${scene.locks.length} 个字段）`);
    }

    const tuned = [...weights.layers.entries()].map(([key, value]) => `段 ${key}=${value}`)
        .concat([...weights.fields.entries()].map(([key, value]) => `${key}=${value}`))
        .concat([...weights.options.entries()].slice(0, 6).map(([key, value]) => `${key}=${value}`));
    if (tuned.length > 0) lines.push(`权重：${tuned.join(' · ')}`);
    if (weights.unknown.length > 0) lines.push(`⚠️ 认不出的权重键：${weights.unknown.join('、')}`);

    if (gated.length > 0) lines.push(`闸门让路：${gated.join('、')}`);
    if (skipped.length > 0) lines.push(`权重关闭：${skipped.join('、')}`);
    if (trimmed.length > 0) lines.push(`上限裁剪：${trimmed.slice(0, 8).join('、')}${trimmed.length > 8 ? ` 等 ${trimmed.length} 条` : ''}`);
    if (conflicts.length > 0) lines.push(`互斥剔除：${conflicts.join('、')}`);
    for (const note of notes) lines.push(`说明：${note}`);

    return lines.join('\n');
}

/** 给工具 `meta` 动作：层级清单 + 场景清单（紧凑文本，不输出全部词条）。 */
export function formatMeta(model) {
    const lines = [`${model.title}（${model.schema || '未标注 schema'}）`];
    lines.push('档位：' + model.levels.map((entry) => `L${entry.num} ${entry.label}`).join(' / '));
    lines.push('模式：' + Object.entries(model.modes ?? {}).map(([key, value]) => `${key}（${value.label}）`).join(' / '));
    lines.push('');
    for (const layer of model.layers) {
        const total = layer.fields.reduce((sum, field) => sum + field.options.length, 0);
        const lv = layer.fields.flatMap((field) => field.options.map((option) => option.level));
        const maxLevel = lv.length > 0 ? Math.max(...lv) : 0;
        const req = layer.fields.filter((field) => field.req).map((field) => field.label);
        lines.push(`- ${layer.id}｜${layer.title}：${layer.fields.length} 字段 / ${total} 选项 / 最高 L${maxLevel}`
            + (req.length > 0 ? `｜必现：${req.join('、')}` : '')
            + `｜字段：${layer.fields.map((field) => `${field.key}(${field.options.length})`).join(' ')}`);
    }
    lines.push('');
    lines.push(`场景搭配 ${model.scenes.length} 条（跨字段固定组合，未锁的字段照常随机）：`);
    for (const scene of model.scenes) {
        lines.push(`- ${scene.id}｜${scene.zh}（L${scene.level}）：${scene.desc}`);
    }
    if (model.defaultNegative !== '') lines.push('', `兜底负面词：${model.defaultNegative}`);
    if (model.issues.length > 0) {
        lines.push('', `⚠️ 数据校验：${model.issues.length} 条`);
        for (const issue of model.issues.slice(0, 12)) lines.push(`- ${issue}`);
    }
    return lines.join('\n');
}

export { DATA_FILE as WARDROBE_FILE };