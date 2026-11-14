/**
 * dsh-comfy-suite — 把三个插件合成一个 Loader 条目。
 *
 *   · dsh-comfyui          → 工作流库、comfyui_* 工具、媒体代理、技能包
 *   · dsh-comfyui-launcher → comfyui_server 工具（启停配置里指定的便携版）
 *   · dsh-qwen-paint       → draw_image / inpaint_image / upscale_image 等
 *
 * 三个子插件仍以各自原本的形态运行（各自的 fiber、各自的 inject、各自的
 * 工具注册与 REST 路由），只是不再各自成为 Loader 条目：本包是唯一入口，
 * 由它 `ctx.plugin()` 挂起三个子插件，并把配置写入收敛到同一个条目。
 *
 * 合并层只做三件事：挂子插件、转发配置写入、记录启动回执。子插件内部逻辑
 * 一律不在这里重写——那样升级 vendor 时就没法用 diff 复核了。
 */
import { Config } from './config.js';
import { suiteBridge } from './bridge.js';
import { mountSuiteRoutes } from './gallery-routes.js';
import { resolveQwenOutputDir } from './gallery.js';
import { loadWardrobe } from './wardrobe.js';
import { PRESETS_TOOL, WARDROBE_TOOL, makePresetsTool, makeWardrobeTool } from './tools.js';
import * as comfyui from '../vendor/comfyui/lib/index.js';
import * as launcher from '../vendor/launcher/index.js';
import * as qwenPaint from '../vendor/qwen-paint/lib/index.js';
import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export const name = 'dsh-comfy-suite';

/** `tools` is the model-facing registry every child writes into. */
export const inject = ['tools'];

export { Config };

/** The Loader entry id this package occupies; settings writes land here. */
const ENTRY_ID = 'comfy-suite';

/**
 * Every model-facing tool this suite must contribute.
 *
 * The list exists because a child can mount, settle, and still lose its tools
 * (a duplicate name during a hot reload, a throw inside one registration, a
 * fiber disposed between effects). That failure used to be completely silent:
 * `boot.log` said "children mounted" while four tools were missing from the
 * catalog. The audit below turns that into one line naming what is absent.
 */
const EXPECTED_TOOLS = [
    'comfyui_workflow',
    'comfyui_skill',
    'comfyui_object_info',
    'comfyui_run',
    'comfyui_server',
    'draw_image',
    'inpaint_image',
    // ★ 2026-11-12（借鉴 9 步整合画布的「图像扩展」支路）：扩图。
    'outpaint_image',
    // ★ 2026-11-12（作者提供 GHIL 素材库）：捏人 / 换装。
    'character_image',
    'upscale_image',
    'list_available_models',
    'check_acceleration',
    // 套件自己注册的（不来自任何子插件）：风格库检索 + 提示词衣柜。
    PRESETS_TOOL,
    WARDROBE_TOOL,
];

/** Boot receipt rotation: this file is appended on every reload. */
const BOOT_LOG_MAX_BYTES = 256 * 1024;
const BOOT_LOG_KEEP_LINES = 300;

function bootDir() {
    const home = process.env.DSH_HOME ?? join(homedir(), '.dsh');
    return join(home, 'data', 'dsh-comfy-suite');
}

/**
 * One-line boot receipt: proves from disk that this entry actually activated,
 * with which config blocks, so a broken merge is diagnosable without a debugger.
 * Fire-and-forget on purpose: a receipt must never fail plugin activation.
 *
 * Writes are serialized through one promise chain. `apply` itself emits several
 * lines at once, and the rotation below rewrites the file — two rotations
 * running concurrently each read the old content and the later write discards
 * the other's lines.
 */
let bootQueue = Promise.resolve();
function noteBoot(line) {
    const dir = bootDir();
    const path = join(dir, 'boot.log');
    const entry = `${new Date().toISOString()} ${line}\n`;
    bootQueue = bootQueue.then(async () => {
        await mkdir(dir, { recursive: true });
        try {
            const info = await stat(path);
            if (info.size > BOOT_LOG_MAX_BYTES) {
                const text = await readFile(path, 'utf8');
                const kept = text.split('\n').filter(Boolean).slice(-BOOT_LOG_KEEP_LINES);
                await writeFile(path, `${kept.join('\n')}\n`);
            }
        }
        catch {
            // Missing file or a concurrent rotation: appending is still fine.
        }
        await appendFile(path, entry);
    }).catch(() => { });
    return bootQueue;
}

/**
 * The plugin body. The Loader validates `Config` (defaults applied) and hands
 * the resolved object to apply; each child gets its own block.
 */
export function apply(ctx, config) {
    const cfg = config ?? {};
    const comfyuiConfig = cfg.comfyui ?? {};
    const launcherConfig = cfg.launcher ?? {};
    const qwenPaintConfig = cfg.qwenPaint ?? {};
    const blocks = ['comfyui', 'launcher', 'qwenPaint'].filter((key) => cfg[key] !== undefined);
    noteBoot(`apply pid=${process.pid} blocks=${blocks.join(',') || 'none'}`);

    // Children report their own registration outcome through this hook, so a
    // partial tool set is written next to the mount receipt instead of only
    // reaching a console nobody reads.
    suiteBridge.onReport(noteBoot);

    // ---------------------------------------------------------------------
    // Settings wiring
    // ---------------------------------------------------------------------
    // The suite ships its own settings page (one section, three tabs), so opt
    // out of the auto-generated form. `ctx.fiber` is the entry fiber, which is
    // exactly the owner the settings service keys presentations by.
    ctx.inject(['settings'], (settingsCtx) => {
        const settings = settingsCtx.settings;

        if (typeof settings.configure === 'function') {
            settingsCtx.effect(
                () => settings.configure({ auto: false }, ctx.fiber),
                'dsh-comfy-suite: settings page policy',
            );
        }

        // Children persist through this instead of their own entry id.
        suiteBridge.update = async (key, patch) => {
            if (typeof settings.update !== 'function') {
                return { ok: false, error: 'settings service is read-only in this host' };
            }
            try {
                await settings.update(ENTRY_ID, { [key]: patch });
                // The Loader commits volatile fields into the running
                // references synchronously with the write; ask children to
                // re-resolve them now so the change is visible immediately.
                suiteBridge.refresh(key);
                return { ok: true };
            } catch (error) {
                return { ok: false, error: error instanceof Error ? error.message : String(error) };
            }
        };
    });

    // A settings save from the Loader side (another surface, or the inherited
    // patch layer) reaches this fiber; fan it out to the children.
    ctx.on('loader/volatile-update', () => {
        suiteBridge.refreshAll();
    });

    // ---------------------------------------------------------------------
    // The three children
    // ---------------------------------------------------------------------
    // Each `ctx.plugin` creates its own fiber, so a child's `inject` list and
    // `ctx.effect` disposers behave exactly as they did standalone.
    try {
        mountChild(ctx, 'comfyui', comfyui, comfyuiConfig);
        mountChild(ctx, 'launcher', launcher, launcherConfig);
        mountChild(ctx, 'qwenPaint', qwenPaint, qwenPaintConfig);
        noteBoot('children mounted');
    } catch (error) {
        noteBoot(`children mount failed: ${describeError(error)}`);
        throw error;
    }

    // ---------------------------------------------------------------------
    // 套件自己的东西：风格库工具 + 作品库端点（2026-11-05 借鉴 dsh-image-gen）
    // ---------------------------------------------------------------------
    // 两样都不属于任何子插件：风格库是纯数据，作品库是"扫出图目录"的视图。
    // 放在合并层而不是 vendor 里，是为了升级 vendor 时能整段替换、不用重放补丁。
    registerPresetsTool(ctx);
    registerWardrobeTool(ctx);
    mountGallery(ctx, cfg);

    auditTools(ctx);
}

/**
 * 注册风格库工具（模型侧）。
 *
 * 单独包一层而不是直接写进 apply：工具注册失败**不能**把整个套件带走
 * —— 这与子插件"逐个注册、失败隔离"的处理保持一致。
 */
function registerPresetsTool(ctx) {
    try {
        const tool = makePresetsTool({
            log: (level, message) => noteBoot(`image_presets: ${message}`),
        });
        const dispose = ctx.tools.register(tool);
        noteBoot(`suite: ${PRESETS_TOOL} registered`);
        if (typeof dispose === 'function') {
            ctx.effect(() => dispose, 'dsh-comfy-suite: presets tool');
        }
    } catch (error) {
        noteBoot(`suite: ${PRESETS_TOOL} registration failed — ${describeError(error)}`);
    }
}

/**
 * 注册提示词衣柜工具（模型侧）。
 *
 * 与 presets 工具同样的失败隔离：衣柜注册失败不能把整个套件带走。
 * 数据校验问题在这里落一次 boot.log —— 词条写错（场景锁定引用了不存在的
 * 选项之类）最容易表现为"抽出来的东西少一块"，不写下来根本查不到。
 */
function registerWardrobeTool(ctx) {
    try {
        const tool = makeWardrobeTool({
            log: (level, message) => noteBoot(`prompt_wardrobe: ${message}`),
        });
        const dispose = ctx.tools.register(tool);
        noteBoot(`suite: ${WARDROBE_TOOL} registered`);
        if (typeof dispose === 'function') {
            ctx.effect(() => dispose, 'dsh-comfy-suite: wardrobe tool');
        }
        // 首次加载就把数据体检结果写进回执（异步，不阻塞激活）。
        void loadWardrobe()
            .then((model) => {
                if (model.issues.length === 0) {
                    noteBoot(`prompt_wardrobe: data ok（${model.layers.length} 段 / ${model.scenes.length} 场景）`);
                    return;
                }
                for (const issue of model.issues.slice(0, 8)) noteBoot(`prompt_wardrobe: data issue — ${issue}`);
                if (model.issues.length > 8) noteBoot(`prompt_wardrobe: …还有 ${model.issues.length - 8} 条校验问题`);
            })
            .catch((error) => noteBoot(`prompt_wardrobe: data load failed — ${describeError(error)}`));
    } catch (error) {
        noteBoot(`suite: ${WARDROBE_TOOL} registration failed — ${describeError(error)}`);
    }
}

/**
 * 挂作品库端点。
 *
 * 扫描根：千问出图目录**永远**在；ComfyUI 的 output 目录是**可选**的
 * （面板上勾"包含工作流产物"才扫）—— 因为 qwen-paint 每次出图都会在
 * ComfyUI 的 output 里留一份中间文件，默认扫进来会把同一张图显示两遍。
 */
function mountGallery(ctx, cfg) {
    const qwenOutput = () => resolveQwenOutputDir(cfg.qwenPaint?.outputDir);
    const comfyOutput = String(cfg.comfyui?.outputDir ?? '').trim();
    // ★ 2026-11-12：qwen-paint 在"配置的目录不可写"时会自动兜底到 DSH 数据目录
    //   （见 vendor/qwen-paint/lib/config.js 的 resolveOutputDir）。作品库也要认这个位置，
    //   否则兜底期间出的图在图库/记忆里完全看不到。目录不存在时扫描自然是空，无副作用。
    const fallbackOutput = () => join(process.env.DSH_HOME ?? join(homedir(), '.dsh'),
        'data', 'dsh-comfy-suite', 'output');

    const roots = (includeWorkflow) => {
        const list = [resolve(qwenOutput())];
        const fallback = resolve(fallbackOutput());
        if (!list.some((entry) => entry.toLowerCase() === fallback.toLowerCase())) list.push(fallback);
        if (includeWorkflow === true && comfyOutput !== '') {
            const dir = resolve(comfyOutput);
            if (!list.some((entry) => entry.toLowerCase() === dir.toLowerCase())) list.push(dir);
        }
        return list;
    };

    try {
        // 用 inject 而不是 `ctx.get('webServer')`：webServer 服务可能比本插件
        // 后激活（comfyui 子插件也是这么等的），直接 get 拿到 undefined 的话
        // 端点会静默地永不存在 —— 界面表现为"读取失败"，很难查。
        ctx.inject(['webServer'], (webCtx) => {
            try {
                mountSuiteRoutes(webCtx, {
                    roots,
                    statePath: join(bootDir(), 'gallery-state.json'),
                    trashDir: join(bootDir(), 'trash'),
                    memoryPaths: () => [
                        join(qwenOutput(), '.qwen-paint-memory.jsonl'),
                        join(fallbackOutput(), '.qwen-paint-memory.jsonl'),
                    ],
                    getTool(toolName) {
                        try {
                            return ctx.tools.get(toolName);
                        } catch {
                            return undefined;
                        }
                    },
                    log(level, message) {
                        noteBoot(`suite: ${message}`);
                        if (level === 'warn' && typeof console !== 'undefined') {
                            console.warn(`[dsh-comfy-suite] ${message}`);
                        }
                    },
                });
            } catch (error) {
                noteBoot(`suite: gallery routes failed — ${describeError(error)}`);
            }
        });
    } catch (error) {
        noteBoot(`suite: gallery mount failed — ${describeError(error)}`);
    }
}

/**
 * Mount one child and record how its `apply` settles.
 *
 * A child whose `apply` rejects used to disappear without a trace: the boot
 * receipt said "children mounted" even though, for example, the workflow
 * tools never registered. The wrapper keeps the child's own name/inject and
 * only observes the promise, so the fiber behaves exactly as before.
 */
function mountChild(ctx, label, plugin, config) {
    const started = Date.now();
    noteBoot(`${label}: apply start`);
    const wrapped = {
        name: plugin.name,
        inject: plugin.inject,
        apply(childCtx, childConfig) {
            let result;
            try {
                result = plugin.apply(childCtx, childConfig);
            } catch (error) {
                noteBoot(`${label}: apply threw after ${Date.now() - started}ms — ${describeError(error)}`);
                throw error;
            }
            const settled = Promise.resolve(result).then(
                () => noteBoot(`${label}: apply settled in ${Date.now() - started}ms`),
                (error) => noteBoot(`${label}: apply rejected after ${Date.now() - started}ms — ${describeError(error)}`),
            );
            // A never-settling apply is the failure mode that looks like "no
            // tools" with no error anywhere: say so instead of hanging mute.
            const watchdog = setTimeout(() => {
                noteBoot(`${label}: apply still pending after ${Date.now() - started}ms`);
            }, 15_000);
            if (typeof watchdog.unref === 'function') watchdog.unref();
            void settled.finally(() => clearTimeout(watchdog));
            return result;
        },
    };
    return ctx.plugin(wrapped, config);
}

/**
 * After the children have had time to register, compare the live registry
 * against EXPECTED_TOOLS and write the result to the boot receipt.
 *
 * `tools.get(name)` is the same lookup the model-facing catalog uses, so a
 * missing tool here is exactly a tool the agent cannot call.
 *
 * The check repeats: on a cold DSH boot a child's `apply` can take several
 * seconds (measured 7.5 s for comfyui on 2026-11-04 22:02), and a single early
 * snapshot reported four tools missing that appeared a moment later. A complete
 * set is reported as soon as it is seen; only a set that is still incomplete on
 * the last attempt is called MISSING.
 */
function auditTools(ctx) {
    const delays = [2_500, 4_000, 6_000, 8_000];
    const timers = [];
    let attempt = 0;
    const check = () => {
        attempt += 1;
        try {
            const tools = ctx.tools;
            if (tools === undefined) {
                noteBoot('tools audit: the tools service is not available');
                return;
            }
            const missing = EXPECTED_TOOLS.filter((toolName) => {
                try {
                    return tools.get(toolName) === undefined;
                } catch {
                    return true;
                }
            });
            const present = EXPECTED_TOOLS.length - missing.length;
            if (missing.length === 0) {
                noteBoot(`tools audit: ${present}/${EXPECTED_TOOLS.length} present`);
                return;
            }
            if (attempt >= delays.length) {
                noteBoot(`tools audit: ${present}/${EXPECTED_TOOLS.length} — MISSING ${missing.join(',')}`);
                return;
            }
            const next = setTimeout(check, delays[attempt]);
            if (typeof next.unref === 'function') next.unref();
            timers.push(next);
        } catch (error) {
            noteBoot(`tools audit failed: ${describeError(error)}`);
        }
    };
    const first = setTimeout(check, delays[0]);
    if (typeof first.unref === 'function') first.unref();
    timers.push(first);
    ctx.effect(() => () => {
        for (const timer of timers) clearTimeout(timer);
    }, 'dsh-comfy-suite: tools audit');
}

/** One-line error text with the first stack frame that points at plugin code. */
function describeError(error) {
    if (!(error instanceof Error)) return String(error);
    const frame = (error.stack ?? '').split('\n').find((line) => line.includes('/vendor/') || line.includes('/lib/'));
    return frame === undefined ? error.message : `${error.message} @${frame.trim()}`;
}