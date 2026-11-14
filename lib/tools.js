/**
 * dsh-comfy-suite — 面向模型的风格库工具
 * ============================================================================
 * 借鉴 dsh-image-gen 的一件事：**让 Agent 自己去找灵感**，而不是让用户
 * 每次手打"水彩、逆光、16:9"。
 *
 * 这里只注册一个工具 `image_presets`，四种动作：
 *   · search  —— 按关键词/类别检索（"水彩"、"海报"、"夜景"）
 *   · get     —— 取某几条的完整描述（含使用注意）
 *   · compose —— 把主题 + 若干片段拼成最终 prompt（顺带给出负面词）
 *   · kinds   —— 列出类别与数量（模型不知道该找什么时先看一眼）
 *
 * 返回**纯文本**：这类"查表"结果读起来比 JSON 省 token，也更容易被模型
 * 直接拷进 draw_image 的参数里。
 */
import { KIND_LABELS, composePrompt, formatPreset, formatPresetList, loadPresets, searchPresets } from './presets.js';
import { draw, formatMeta, levelMeta, loadWardrobe, parseWeights, resolveLevel } from './wardrobe.js';

/** 风格库工具的名字；lib/index.js 的工具审计表里也用它。 */
export const PRESETS_TOOL = 'image_presets';

/** 提示词衣柜工具的名字。 */
export const WARDROBE_TOOL = 'prompt_wardrobe';

/**
 * 建工具定义（不注册，交给调用方 `ctx.tools.register`）。
 *
 * @param {object} deps
 * @param {(level: string, message: string) => void} [deps.log]
 */
export function makePresetsTool({ log } = {}) {
    return {
        name: PRESETS_TOOL,
        description:
            '查本机的「千问风格库」：62 条可直接拼接的提示词积木，覆盖画风（水彩/国风/像素/赛博朋克…）、'
            + '光效（体积光/伦勃朗光/霓虹…）、构图（三分法/对称/俯拍…）、画质、负面词、海报版式。'
            + '★ 什么时候用：用户点名某种风格（"画成水彩""要吉卜力那种""做个极简海报"），或说"不知道要什么风格"，'
            + '或你想让画面更具体时 —— 先搜一下，再把返回的中文片段接进 draw_image 的 prompt。'
            + '★ 不要用它代替出图：这个工具只返回文字，不出图；出图仍然用 draw_image。'
            + '★ 负面词条目（kind=negative）请放进 draw_image 的 negative 参数，不要混进 prompt。'
            + '★ 要「随机组合一整段 prompt」「按内容档位收窄」「同 seed 复现」→ 改用 prompt_wardrobe。',
        parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
                action: {
                    type: 'string',
                    enum: ['search', 'get', 'compose', 'kinds'],
                    description: 'search=检索；get=按 id 取详情；compose=把主题和片段拼成 prompt；kinds=列出类别与数量。',
                },
                query: {
                    type: 'string',
                    description: 'search 用的关键词（空格分隔表示"都要命中"），例如"水彩 风景"、"海报"、"夜景"。',
                },
                kind: {
                    type: 'string',
                    description: '可选类别过滤：style / lighting / composition / quality / negative / poster。',
                },
                ids: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'get / compose 用的条目 id 列表，例如 ["illu-watercolor","light-golden"]。',
                },
                prompt: {
                    type: 'string',
                    description: 'compose 时可选：画面主体描述，会拼在最前面。',
                },
            },
            required: ['action'],
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    text: { type: 'string', description: '给人/给模型读的纯文本结果。' },
                    prompt: { type: 'string', description: 'compose 得到的完整正向提示词。' },
                    negative: { type: 'string', description: 'compose 得到的负面词（可能为空串）。' },
                },
                required: ['text'],
            },
            render(_args, value) {
                return [{ type: 'text', text: String(value?.text ?? '') }];
            },
        },
        timeoutMs: 15_000,
        async execute(args) {
            const action = String(args?.action ?? 'search');
            const library = await loadPresets();

            if (action === 'kinds') {
                const counts = new Map();
                for (const item of library.items) {
                    const kind = String(item.kind ?? 'other');
                    counts.set(kind, (counts.get(kind) ?? 0) + 1);
                }
                const lines = [`${library.title}共 ${library.items.length} 条：`];
                for (const [kind, count] of counts) lines.push(`- ${kind}（${KIND_LABELS[kind] ?? kind}）：${count} 条`);
                lines.push('', '用法：先用 action=search 找条目，再把条目的 prompt 接进出图描述；或 action=compose 直接拼。');
                return { text: lines.join('\n') };
            }

            if (action === 'get') {
                const ids = Array.isArray(args?.ids) ? args.ids : [];
                const picked = ids.length === 0
                    ? []
                    : library.items.filter((item) => ids.includes(item.id));
                if (picked.length === 0) {
                    return { text: '没有匹配的 id。先用 action=search 或 action=kinds 查一下真实 id。' };
                }
                return { text: formatPresetList('选中的条目', picked) };
            }

            if (action === 'compose') {
                const ids = Array.isArray(args?.ids) ? args.ids.filter((id) => typeof id === 'string') : [];
                const composed = composePrompt(library.items, { ids, base: String(args?.prompt ?? '') });
                if (composed.used.length === 0) {
                    return { text: '没有可用的 id —— 先用 action=search 找到条目，再把这些 id 放进 compose。' };
                }
                const lines = [
                    `已拼好（用到 ${composed.used.length} 条：${composed.used.join(', ')}）：`,
                    '',
                    `prompt: ${composed.prompt}`,
                ];
                if (composed.negative !== '') lines.push(`negative: ${composed.negative}`);
                lines.push('', '下一步：把上面的 prompt 原样传给 draw_image（negative 可选）。');
                return { text: lines.join('\n'), prompt: composed.prompt, negative: composed.negative };
            }

            // 默认：search
            const items = searchPresets(library.items, {
                query: String(args?.query ?? ''),
                kind: String(args?.kind ?? ''),
            });
            const title = String(args?.query ?? '').trim() === ''
                ? `${library.title}（按类别 ${args?.kind ?? '全部'}）`
                : `「${String(args.query).trim()}」的检索结果`;
            if (log !== undefined) log('info', `风格库检索 ${title}：${items.length} 条`);
            return { text: formatPresetList(title, items) };
        },
    };
}

/** 供测试/诊断：把一条记录格式化成一行（复用 presets 的实现）。 */
export { formatPreset };
/* ============================================================================
 * 提示词衣柜（prompt_wardrobe）
 * ========================================================================== */

/**
 * 把一次抽取渲染成模型可读的文本。
 *
 * 刻意不返回 JSON：这类结果最终要**原样塞进 draw_image 的参数**，
 * 纯文本里 `PROMPT:` / `NEGATIVE:` 两行最好复制，也最不容易被误解。
 */
function renderVariant(result, index, total) {
    const head = total > 1 ? `#${index + 1} 种子 ${result.seed}（复现用这个）` : `种子 ${result.seed}（复现用这个）`;
    const lines = [
        head,
        `PROMPT: ${result.prompt}`,
    ];
    if (result.negative !== '') lines.push(`NEGATIVE: ${result.negative}`);
    lines.push('', '—— 自检 ——', result.report);
    return lines.join('\n');
}

/**
 * 建「提示词衣柜」工具定义（不注册，交给调用方 `ctx.tools.register`）。
 *
 * 它和 `image_presets` 的分工：presets 是**查表**（我自己挑几条来拼），
 * wardrobe 是**抽签**（按档位/权重/种子给我一整段，可复现）。两者共用同一份
 * 风格库数据 —— 衣柜里的画风/光线/构图/画质/负面五段就是 presets 的条目。
 */
export function makeWardrobeTool({ log } = {}) {
    return {
        name: WARDROBE_TOOL,
        description:
            '提示词衣柜：按内容档位随机组合一整段可直接出图的中文 prompt。'
            + '三段式词库（段 / 字段 / 选项）+ 三层权重（0=关闭、1=常态、3=必现），'
            + '低档位先从候选池里排除高档词（不是抽完再筛），同 seed 逐字可复现，并附自检报告说明哪些项让路、为什么。'
            + '★ 什么时候用：用户说"随便画一张""来个抓拍""随机抽个场景"，或你要批量试不同构图/光线/服装时。'
            + '★ 典型用法：action=roll 拿到 PROMPT / NEGATIVE / 种子 → 原样交给 draw_image（prompt + negative）。'
            + '★ 复现：把返回的种子填回 seed，同样的档位/权重/场景会得到逐字相同的 prompt。'
            + '注意：这里的种子只决定**提示词**，与 draw_image 的扩散种子是两回事。'
            + '★ 档位 0–4：0 全年龄、1 轻度暗示、2 明确、3 露骨、4 极端；低档位下高档词进不来。'
            + '★ 传了 subject 就用你的主体，不再随机"一位女性"；mode=object/scene 时人物段落整体不参与。'
            + '★ scenes 列出跨字段固定组合（锁场景/服装/镜头，其余字段照常随机）；meta 看完整图层与字段清单。',
        parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
                action: {
                    type: 'string',
                    enum: ['roll', 'scenes', 'meta'],
                    description: 'roll=抽一整段；scenes=列场景搭配；meta=看图层/字段/档位清单。',
                },
                level: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 4,
                    description: '内容档位 0–4（默认 0）。显式 forced 项若高于档位，整张图会被抬到该档并在报告里写明。',
                },
                mode: {
                    type: 'string',
                    enum: ['person', 'object', 'scene'],
                    description: 'person=人物（默认）；object=静物/主体（不抽人物）；scene=空镜（只要环境）。',
                },
                subject: {
                    type: 'string',
                    description: '画面主体，可选。给了就替代随机主体，例如"一只橘猫坐在窗台上"。',
                },
                seed: {
                    type: 'integer',
                    description: '固定种子（>=0）→ 逐字复现；不填或 -1 → 每次重抽。',
                },
                count: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 4,
                    description: '一次抽几版（默认 1，最多 4）。多版共用一个起始种子，便于连着画一套。',
                },
                scene: {
                    type: 'string',
                    description: "场景搭配：'off'（默认）/ 'auto'（按档位随机抽一条）/ 具体 id 或中文名（见 action=scenes）。",
                },
                sceneChance: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1,
                    description: 'scene=auto 时出场景的概率（默认 0.35）。',
                },
                layers: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '只启用这些段，例如 ["identity","outfit","camera"]。不填=按模式全开。',
                },
                weights: {
                    type: 'object',
                    additionalProperties: { type: 'number' },
                    description: '三层权重，扁平写法："outfit": 0.5（段）、"outfit.top": 3（字段=必现）、"outfit.top=蕾丝内衣": 0（选项=禁用）。',
                },
                forced: {
                    type: 'object',
                    additionalProperties: { type: 'string' },
                    description: '强制指定某字段的选项："identity.hair": "高马尾"，或 "style.preset": "水彩晕染"。',
                },
                baseProb: {
                    type: 'number',
                    minimum: 0.05,
                    maximum: 1,
                    description: '可选字段的基准出现概率（默认 0.6）。想更精简就调小。',
                },
                tagCap: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 40,
                    description: '正文片段上限（默认 14，0=不限）。必现项与场景锁定项不裁。',
                },
                query: {
                    type: 'string',
                    description: 'scenes 用的关键词过滤（场景名/描述/主题）。',
                },
            },
            required: ['action'],
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    text: { type: 'string', description: '给人/给模型读的纯文本结果。' },
                    prompt: { type: 'string', description: '抽到的正向提示词（多版时是第一版）。' },
                    negative: { type: 'string', description: '负面词，交给 draw_image 的 negative。' },
                    seed: { type: 'integer', description: '第一版的种子。' },
                    seeds: { type: 'array', items: { type: 'integer' }, description: '每一版的种子。' },
                },
                required: ['text'],
            },
            render(_args, value) {
                return [{ type: 'text', text: String(value?.text ?? '') }];
            },
        },
        timeoutMs: 20_000,
        async execute(args) {
            const action = String(args?.action ?? 'roll');
            const model = await loadWardrobe();
            if (model.issues.length > 0 && log !== undefined) {
                log('warn', `衣柜数据 ${model.issues.length} 条校验问题：${model.issues.slice(0, 3).join('；')}`);
            }

            if (action === 'meta') return { text: formatMeta(model) };

            if (action === 'scenes') {
                const level = resolveLevel(args?.level, 4);
                const query = String(args?.query ?? '').trim().toLowerCase();
                const list = model.scenes.filter((scene) => {
                    if (scene.level > level) return false;
                    if (query === '') return true;
                    return `${scene.id} ${scene.zh} ${scene.desc} ${scene.note}`.toLowerCase().includes(query);
                });
                if (list.length === 0) {
                    return { text: `当前档位 L${level} 下没有匹配的场景。试试放宽 level，或清空 query。` };
                }
                const lines = [`场景搭配（≤L${level}，共 ${list.length} 条）：`];
                for (const scene of list) {
                    lines.push(`- ${scene.id}｜${scene.zh}（L${scene.level}）：${scene.desc}`
                        + (scene.note !== '' ? `｜${scene.note}` : ''));
                }
                lines.push('', '用法：prompt_wardrobe action=roll scene="<id>" —— 场景锁定其中列出的字段，其余照常随机。');
                return { text: lines.join('\n') };
            }

            const count = Math.max(1, Math.min(4, Number.isFinite(args?.count) ? Math.trunc(args.count) : 1));
            const weights = parseWeights(args?.weights);
            const forced = args?.forced !== null && typeof args?.forced === 'object' ? args.forced : {};
            const startSeed = Number.isFinite(args?.seed) && Number(args.seed) >= 0 ? Math.trunc(args.seed) : undefined;

            const results = [];
            for (let index = 0; index < count; index += 1) {
                results.push(draw(model, {
                    level: resolveLevel(args?.level, 0),
                    mode: args?.mode,
                    subject: args?.subject,
                    seed: startSeed === undefined ? undefined : startSeed + index,
                    scene: args?.scene,
                    sceneChance: args?.sceneChance,
                    layers: args?.layers,
                    weights,
                    forced,
                    baseProb: args?.baseProb,
                    tagCap: args?.tagCap,
                }));
            }

            if (log !== undefined) {
                log('info', `衣柜抽取 ×${count}：L${results[0].level} ${levelMeta(results[0].level, model.levels).label}，种子 ${results.map((entry) => entry.seed).join(',')}`);
            }

            const blocks = results.map((result, index) => renderVariant(result, index, results.length));
            if (count > 1) {
                blocks.push('', '下一步：把每一版的 PROMPT / NEGATIVE 分别交给 draw_image；想微调就改 weights 或 forced，别改 prompt 本身。');
            } else {
                blocks.push('', '下一步：draw_image({ prompt, negative })。想复现这段提示词就把 seed 填回下一次 roll。');
            }

            return {
                text: blocks.join('\n'),
                prompt: results[0].prompt,
                negative: results[0].negative,
                seed: results[0].seed,
                seeds: results.map((entry) => entry.seed),
            };
        },
    };
}
