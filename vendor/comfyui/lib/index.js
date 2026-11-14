import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { Config, resolveConfig } from './config.js';
// dsh-comfy-suite: this copy runs inside the suite's single Loader entry, so
// settings writes go through the suite bridge instead of the old `comfyui` id.
import { suiteBridge } from '../../../lib/bridge.js';
import { ComfyUIClient, CLIENT_ID } from './comfyui.js';
import { ComfyUIStore } from './store.js';
import { QueueTracker } from './queue.js';
import { convertGraphToApi, flattenDynamicCombos } from './convert.js';
import { analyzeGraph } from './analyze.js';
import { ProgressTracker } from './progress.js';
import { COMFYUI_SKILL } from './skill.js';
import { analyzeWorkflowParameters, applyWorkflowParameters } from './params.js';
import { createWorkflowSkillPacks } from './skillpack.js';
import { registerComfyUITools } from './tools.js';
import { mountComfyUIRoutes } from './routes.js';
import { mountComfyUIProxy } from './proxy.js';
import { createHostHint, detectLanOrigin } from './host-hint.js';
export const name = 'dsh-comfyui';
export { Config };
/**
 * Required services. `tools` is the model-facing registry the plugin writes
 * into, so the fiber must wait for it: reading `ctx.tools` without declaring
 * it here is what cordis rejects with `cannot get property "tools" without
 * inject`. `webServer`, `settings`, and `credentials` stay OUT of this list —
 * they are optional, and the plugin degrades gracefully without them (see
 * apply).
 */
export const inject = ['tools'];
const COMFYUI_NS = 'comfyui';
/**
 * object_info is large (5–20 MB with a few custom-node packs) and changes only
 * when nodes are installed, removed, or a dropdown's file list moves. The old
 * 60-second TTL meant "the first generation after a quiet minute pays for the
 * whole table again, serially, before the prompt is even submitted". Cached
 * value is reused for half an hour and invalidated explicitly (settings-page
 * server switch, `action: refresh`, node-pack changes).
 */
const OBJECT_INFO_TTL_MS = 30 * 60_000;
// Keyed by base URL: this cache lives at module scope, so a settings-page switch
// from one ComfyUI server to another must not answer with the old server's node
// table (and its COMBO options).
let objectInfoCache;
/** In-flight fetch, so two callers cannot download the table twice. */
let objectInfoPending;
async function objectInfoCached(client) {
    const key = client.baseUrl;
    const now = Date.now();
    if (objectInfoCache !== undefined && objectInfoCache.key === key && now - objectInfoCache.ts < OBJECT_INFO_TTL_MS)
        return objectInfoCache.value;
    if (objectInfoPending !== undefined && objectInfoPending.key === key)
        return objectInfoPending.promise;
    const promise = (async () => {
        try {
            const value = await client.objectInfo();
            objectInfoCache = { key, ts: Date.now(), value };
            return value;
        }
        catch {
            return undefined;
        }
        finally {
            objectInfoPending = undefined;
        }
    })();
    objectInfoPending = { key, promise };
    return promise;
}
/** Drop the cached node table (after a settings change or an explicit refresh). */
function invalidateObjectInfo() {
    objectInfoCache = undefined;
    objectInfoPending = undefined;
}
async function resolveApiKey(ctx, envName) {
    const credentials = ctx.get('credentials');
    if (credentials !== undefined) {
        try {
            const resolved = await credentials.resolve(envName);
            if (resolved !== undefined)
                return resolved.value;
        }
        catch {
            // Fall through to the process environment below.
        }
    }
    return process.env[envName];
}
/** Default plugin data directory under the harness home. */
function defaultDataDir() {
    const base = process.env.DSH_HOME ?? join(homedir(), '.dsh');
    return join(base, 'data', 'dsh-comfyui');
}
/**
 * The plugin body. The loader validates the entry config against `Config`
 * (defaults applied), then hands the resolved object to apply.
 */
export async function apply(ctx, entryConfig) {
    // Volatile fields arrive as references on dsh 0.1.7+ (plain values on older
    // hosts); `resolved` is the one plain object every consumer reads, refreshed
    // in place when the Loader commits a settings-page change.
    const resolved = resolveConfig(entryConfig, defaultDataDir());
    // Data-integrity problems (a quarantined corrupt file, a pruned aux map) go
    // to the suite's boot receipt: silent data loss is the one failure mode a
    // user cannot discover from the UI.
    const store = new ComfyUIStore(resolved.dataDir, resolved.maxAssets, (message) => suiteBridge.report(`comfyui: ${message}`));
    await store.init();
    // Per-workflow skill packs default to `<dataDir>/skills`; `skillsDir` moves
    // them anywhere absolute (another drive, a synced folder, a repo) without
    // dragging the JSON state along. The root is a getter, not a snapshot, so a
    // settings-page change applies to the next call rather than the next restart.
    // Directories are created lazily when a user attaches a pack, so nothing is
    // written for a library that never uses them.
    const skillPacks = createWorkflowSkillPacks({
        skillsRoot: () => {
            const configured = resolved.skillsDir.trim();
            // A relative path would resolve against the process cwd, which is not
            // something a user typing into the settings page can predict.
            return configured !== '' && isAbsolute(configured) ? configured : store.skillsRoot;
        },
        getWorkflow: (id) => store.getWorkflow(id),
        updateWorkflowSkill: (id, patch) => store.updateWorkflowSkill(id, patch),
    });
    const tracker = new QueueTracker({
        load: () => store.loadTracked(),
        save: (state) => store.saveTracked(state),
    });
    await tracker.init();
    const progress = new ProgressTracker();
    // Best-effort progress feed: listen on the server's WebSocket for `progress`
    // events. The socket uses the same client id as queued prompts (CLIENT_ID),
    // so progress events for prompts this plugin submits arrive here; the server
    // only broadcasts them to the submitting client. Node's global WebSocket
    // (undici) cannot set auth headers, so a remote server behind an
    // authenticating proxy simply shows no progress.
    const progressUrl = () => resolved.baseUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:').replace(/\/$/, '') + `/ws?clientId=${CLIENT_ID}`;
    let attachedUrl = progressUrl();
    ctx.effect(() => {
        progress.attach(attachedUrl);
        return () => progress.dispose();
    }, 'dsh-comfyui: progress');
    /** Pick up a new config in place; a new baseUrl re-points the progress socket. */
    const refreshConfig = (next) => {
        const previousBase = resolved.baseUrl;
        Object.assign(resolved, next);
        if (resolved.baseUrl !== previousBase)
            invalidateObjectInfo();
        const url = progressUrl();
        if (url !== attachedUrl) {
            attachedUrl = url;
            progress.dispose();
            progress.attach(url);
        }
    };
    // dsh 0.1.7+: a settings-page save commits volatile values into the same
    // references without restarting the plugin, then notifies this fiber.
    ctx.on('loader/volatile-update', (() => {
        refreshConfig(resolveConfig(entryConfig, defaultDataDir()));
    }));
    // The suite entry owns that event; a child fiber never sees it. Register the
    // same re-resolve with the bridge so the shell can fan the update out.
    ctx.effect(() => suiteBridge.register('comfyui', () => {
        refreshConfig(resolveConfig(entryConfig, defaultDataDir()));
    }), 'dsh-comfyui: suite config bridge');
    const hostHint = createHostHint();
    const runtime = {
        getConfig: () => resolved,
        getApiKey: () => resolveApiKey(ctx, resolved.apiKeyEnv),
        createClient: (apiKey) => new ComfyUIClient(resolved.baseUrl, apiKey, resolved.connectTimeoutMs, resolved.maxMediaBytes),
        hostHint,
        proxyBase: () => {
            // Explicit external media host wins (LAN/domain/reverse-proxy config);
            // otherwise use the origin browsers actually reached this server with;
            // then the server's own LAN origin (reachable from remote browsers);
            // finally fall back to loopback. The result is always an absolute
            // http(s) URL, which the chat markdown renderer requires.
            const explicit = (resolved.mediaHost ?? '').trim().replace(/\/+$/, '');
            if (explicit !== '')
                return explicit;
            const hinted = hostHint.origin();
            if (hinted !== undefined)
                return hinted;
            const ws = ctx.get('webServer');
            if (ws === undefined || ws.port === undefined)
                return undefined;
            const lan = detectLanOrigin(ws.port);
            if (lan !== undefined)
                return lan;
            const host = ws.host === '0.0.0.0' ? '127.0.0.1' : ws.host ?? '127.0.0.1';
            return `http://${host}:${ws.port}`;
        },
        settingsWritable: () => {
            const settings = ctx.get('settings');
            return settings?.writable === true;
        },
        updateConfig: async (patch) => {
            // dsh-comfy-suite: the entry id is now `comfy-suite`, and this block
            // is its `comfyui` field. The bridge writes there and re-resolves.
            if (typeof suiteBridge.update !== 'function') {
                return { ok: false, error: 'settings service unavailable — edit cordis.patch.yml instead' };
            }
            const result = await suiteBridge.update('comfyui', patch);
            if (result?.ok) {
                refreshConfig(resolveConfig(entryConfig, defaultDataDir()));
            }
            return result;
        },
        queue: async (workflow, meta) => {
            const client = runtime.createClient(await resolveApiKey(ctx, resolved.apiKeyEnv));
            // Heals library entries saved with the pre-0.5.2 wrapped DynamicCombo shape (Issue #10).
            let prompt = flattenDynamicCombos(workflow);
            if (meta.parameters !== undefined && meta.parameters.length > 0) {
                // These three reads used to run one after another, and the first
                // one could mean a full object_info download: the submit path paid
                // for all of them before the prompt existed. They are independent.
                const [objectInfo, slots, mediaSizes] = await Promise.all([
                    objectInfoCached(client),
                    store.loadSlots(),
                    store.loadMediaSizes(),
                ]);
                const loaded = slots.filter((slot) => slot !== null);
                prompt = applyWorkflowParameters(prompt, meta.parameters, meta.values ?? {}, objectInfo, mediaSizes, loaded);
            }
            const extraData = {};
            if (meta.workflowId !== undefined && meta.workflowId !== null && meta.workflowName !== null) {
                // ComfyUI's job metadata derives workflow_id from extra_pnginfo.workflow.id.
                extraData['extra_pnginfo'] = { workflow: { id: meta.workflowId, name: meta.workflowName } };
            }
            const promptId = await client.queuePrompt(prompt, { extraData });
            tracker.track({ promptId, ts: new Date().toISOString(), workflowName: meta.workflowName, source: meta.source });
            return promptId;
        },
        /**
         * The shared, cached node table. Every caller that used to hit
         * `/object_info` directly pays a whole table download each time; this
         * one is reused across generate / extract / refresh / panel reads.
         */
        objectInfo: (client) => objectInfoCached(client),
        invalidateObjectInfo,
        untrack: (promptId) => tracker.untrack(promptId),
        trackedRuns: () => tracker.list(),
        queueProgress: (promptId) => progress.get(promptId),
        /** Live telemetry for one prompt: state, step progress, node, ETA. */
        queueLive: (promptId) => progress.snapshot(promptId),
        /** The socket feed itself, so a run can wait for the real end event. */
        progressFeed: () => progress,
        /**
         * The panel's real-time view, computed entirely from the WebSocket feed
         * and the in-memory run list — no ComfyUI round-trip, so it can be
         * polled at ~1 Hz while the panel is open.
         */
        liveSnapshot: () => {
            const tasks = tracker.list().slice(-20).reverse().map((run) => ({
                promptId: run.promptId,
                workflowName: run.workflowName ?? null,
                source: run.source ?? null,
                ts: run.ts ?? null,
                settled: run.settled === true,
                ...progress.snapshot(run.promptId),
            }));
            return {
                socket: {
                    connected: progress.socket !== null,
                    url: progress.url,
                    queueRemaining: progress.queueRemaining,
                    lastEventAt: progress.lastEventAt > 0 ? new Date(progress.lastEventAt).toISOString() : null,
                },
                tasks,
                updatedAt: new Date().toISOString(),
            };
        },
        listWorkflows: () => store.listWorkflows(),
        getWorkflow: (id) => store.getWorkflow(id),
        saveWorkflow: (input) => store.saveWorkflow(input),
        /** Batch save: one library read + one atomic write for an import. */
        saveWorkflowsBatch: (inputs) => store.saveWorkflowsBatch(inputs),
        refreshVoiceLibrary: async () => {
            // TTS-Audio-Suite keeps a process-level voice-discovery cache behind the
            // object_info COMBO that does not self-heal: a voice added to disk stays
            // invisible until the cache is invalidated once. Hitting the custom-node
            // endpoint with refresh=1 performs the rescan and invalidates the cache,
            // so the object_info read that follows (refresh-params / action: refresh)
            // reports the current library. Servers without TTS-Audio-Suite answer
            // 404; the failure is swallowed and callers proceed with the object_info
            // snapshot they get anyway.
            const client = runtime.createClient(await resolveApiKey(ctx, resolved.apiKeyEnv));
            return client.getOk('/api/tts-audio-suite/voice-library?refresh=1', 20_000);
        },
        deleteWorkflow: (id) => store.deleteWorkflow(id),
        skillPacks,
        listMediaSizes: () => store.loadMediaSizes(),
        saveMediaSize: (name, size) => store.saveMediaSize(name, size),
        lookupMediaHash: (hash) => store.lookupMediaHash(hash),
        saveMediaHash: (hash, name) => store.saveMediaHash(hash, name),
        loadSlots: () => store.loadSlots(),
        saveSlots: (slots) => store.saveSlots(slots),
        listAssets: () => store.listAssets(),
        assetNameMap: () => store.assetNameMap(),
        deleteAsset: (promptId) => store.deleteAsset(promptId),
        sweep: async () => {
            const client = runtime.createClient(await resolveApiKey(ctx, resolved.apiKeyEnv));
            return tracker.sweep({ client, store, maxItems: resolved.maxMediaItems, proxyBase: runtime.proxyBase() });
        },
        listComfyWorkflows: async () => {
            const client = runtime.createClient(await resolveApiKey(ctx, resolved.apiKeyEnv));
            const entries = await client.listUserData('workflows');
            const library = await store.listWorkflows();
            return entries
                // Dot entries are ComfyUI bookkeeping (e.g. `.index.json`), not graphs.
                .filter((entry) => entry.type === 'file' && entry.name.endsWith('.json')
                && entry.name.split(/[\\/]/).every((segment) => !segment.startsWith('.')))
                .map((entry) => {
                // Graphs are stored in per-collection sub-folders, so the bare name is
                // not fetchable: keep the workflows/-relative path next to it.
                const file = (entry.path ?? `workflows/${entry.name}`).replace(/^workflows\//, '');
                const derived = library.filter((workflow) => workflow.comfyuiFile === file || workflow.comfyuiFile === entry.name);
                return {
                    name: entry.name,
                    file,
                    size: entry.size,
                    modified: entry.modified,
                    extracted: derived.length > 0,
                    derived: derived.map((workflow) => ({ libraryId: workflow.id, name: workflow.name })),
                };
            });
        },
        resolveComfyGraphFile: async (file) => {
            // Panels and tools only know the bare file name, while saved graphs live in
            // per-collection sub-folders. A bare name is resolved to its unique
            // workflows/-relative path before any userdata fetch.
            const relative = String(file ?? '').replace(/^workflows\//, '');
            if (relative === '' || relative.includes('/')) {
                return relative;
            }
            try {
                const entries = await runtime.listComfyWorkflows();
                const matches = entries.filter((entry) => entry.name === relative);
                if (matches.length === 1) {
                    return matches[0].file;
                }
            }
            catch {
            }
            return relative;
        },
        getComfyWorkflow: async (file) => {
            const client = runtime.createClient(await resolveApiKey(ctx, resolved.apiKeyEnv));
            return client.getUserDataFile(`workflows/${await runtime.resolveComfyGraphFile(file)}`);
        },
        analyzeComfyWorkflow: async (file) => {
            const client = runtime.createClient(await resolveApiKey(ctx, resolved.apiKeyEnv));
            const graph = await client.getUserDataFile(`workflows/${await runtime.resolveComfyGraphFile(file)}`);
            return analyzeGraph(graph);
        },
        extractComfyWorkflow: async ({ file, mode }) => {
            const client = runtime.createClient(await resolveApiKey(ctx, resolved.apiKeyEnv));
            const resolvedFile = await runtime.resolveComfyGraphFile(file);
            const [graph, objectInfo] = await Promise.all([
                client.getUserDataFile(`workflows/${resolvedFile}`),
                runtime.objectInfo(client),
            ]);
            if (objectInfo === undefined) {
                return { ok: false, error: '读不到 ComfyUI 的节点定义（/object_info 请求失败），无法把图转换成 API 工作流；请确认服务器在线后重试' };
            }
            const analysis = analyzeGraph(graph);
            if (!analysis.ok)
                return { ok: false, error: analysis.error };
            if (analysis.components.length === 0) {
                return { ok: false, error: '图里没有可执行的分量（所有节点都被绕过或悬空）' };
            }
            const base = resolvedFile.split('/').pop().replace(/\.json$/i, '').slice(0, 40);
            const groupLabel = (component) => component.groups.length > 0 ? `（${component.groups.slice(0, 3).join('+')}）` : '';
            const jobs = [];
            if (mode === 'all') {
                jobs.push({
                    name: base,
                    description: `从 ComfyUI 图工作流 ${file} 整体提取：${analysis.components.length} 个分量合成一个运行工作流。`,
                    includeNodeIds: new Set(analysis.components.flatMap((component) => component.nodeIds)),
                });
            }
            else if (mode === 'main') {
                const main = analysis.components[0];
                if (main === undefined) {
                    return { ok: false, error: '图里没有可提取的分量' };
                }
                jobs.push({
                    name: `${base} · 主流程`,
                    description: `从 ComfyUI 图工作流 ${file} 提取主流程（${main.size} 节点）${groupLabel(main)}。`,
                    includeNodeIds: new Set(main.nodeIds),
                });
            }
            else {
                for (const component of analysis.components) {
                    jobs.push({
                        name: `${base} · 分量${component.index}${groupLabel(component)}`,
                        description: `从 ComfyUI 图工作流 ${file} 提取第 ${component.index} 个分量（${component.size} 节点）${groupLabel(component)}。`,
                        includeNodeIds: new Set(component.nodeIds),
                    });
                }
            }
            const saved = [];
            const warnings = [];
            for (const job of jobs) {
                const converted = convertGraphToApi(graph, objectInfo, { includeNodeIds: job.includeNodeIds });
                if (!converted.ok)
                    return { ok: false, error: `${job.name}：${converted.error}` };
                for (const warning of converted.warnings)
                    warnings.push(`${job.name}：${warning}`);
                const hasOutput = Object.values(converted.workflow).some((node) => {
                    const def = objectInfo[node.class_type];
                    return def?.output_node === true;
                });
                if (!hasOutput) {
                    warnings.push(`${job.name}：分量没有任何输出节点（ComfyUI 无法排队），已跳过`);
                    continue;
                }
                const parameters = analyzeWorkflowParameters(converted.workflow, objectInfo);
                const result = await store.saveWorkflow({
                    name: job.name.slice(0, 80),
                    description: job.description,
                    workflow: converted.workflow,
                    parameters,
                    source: 'comfyui',
                    comfyuiFile: resolvedFile,
                });
                if (!result.ok)
                    return result;
                saved.push(result.workflow);
            }
            if (saved.length === 0) {
                return { ok: false, error: '没有可提取的分量：所有分量都无输出节点或被跳过' };
            }
            return { ok: true, saved, analysis, warnings };
        },
    };
    // The settings section rides the plugin fiber: a host without a settings
    // service simply never registers it, and the entry config stands as composed.
    let source = () => resolved;
    ctx.inject(['settings'], (settingsCtx) => {
        const settings = settingsCtx.settings;
        if (typeof settings.installSection === 'function') {
            // dsh 0.1.2–0.1.5: the section registry keeps its own copy of the values.
            settings.installSection(ctx, COMFYUI_NS, Config, resolved, {
                setSource: (current) => {
                    source = current;
                },
                onChange: () => {
                    refreshConfig(resolveConfig(source(), defaultDataDir()));
                },
            });
            return;
        }
        // dsh 0.1.7+: forms are projected from the volatile Config fields and a
        // save arrives through loader/volatile-update above. This plugin ships its
        // own settings page, so opt out of any auto-generated one.
        if (typeof settings.configure === 'function') {
            const configure = settings.configure.bind(settings);
            settingsCtx.effect(() => configure({ auto: false }, ctx.fiber), 'dsh-comfyui: settings page policy');
        }
    });
    ctx.effect(() => {
        const disposers = registerComfyUITools(ctx, runtime);
        return () => {
            for (const dispose of disposers)
                dispose();
        };
    }, 'dsh-comfyui: tools');
    // The companion skill rides the same optional-services pattern: headless
    // hosts without a skills service simply skip it. Runtime skills register at
    // rank 250, so project/user skills can override the shipped guidance.
    ctx.effect(() => {
        const skills = ctx.get('skills');
        if (skills === undefined)
            return () => { };
        return skills.register({
            ...COMFYUI_SKILL,
            content: COMFYUI_SKILL.content,
        });
    }, 'dsh-comfyui: skill');
    // Routes and the media proxy ride a `webServer` sub-fiber rather than a
    // one-shot `ctx.get` at apply time: loader entries settle concurrently, so
    // reading the service here would silently skip both mounts whenever the web
    // server happens to activate after this plugin. A headless host never
    // activates this fiber and keeps the tools alone.
    ctx.inject(['webServer'], (webCtx) => {
        webCtx.effect(() => {
            const disposers = [];
            const routesDisposer = mountComfyUIRoutes(webCtx, runtime);
            if (routesDisposer !== undefined)
                disposers.push(routesDisposer);
            const proxyDisposer = mountComfyUIProxy(webCtx, runtime);
            if (proxyDisposer !== undefined)
                disposers.push(proxyDisposer);
            // Inject a one-line self-report into the served index.html: on every
            // page load the browser pings /comfyui/ping, which records the origin
            // the browser actually uses, so generated media URLs match the user's
            // address (LAN IP, domain, reverse proxy) without any configuration.
            const webServer = webCtx.get('webServer');
            if (webServer !== undefined) {
                disposers.push(webServer.tapIndex((html) => {
                    if (html.includes('dsh-comfyui-ping'))
                        return html;
                    return html.replace('</head>', '<script>/* dsh-comfyui-ping */try{fetch("/comfyui/ping",{cache:"no-store"})}catch(e){}</script></head>');
                }));
            }
            return () => {
                for (const dispose of disposers)
                    dispose();
            };
        }, 'dsh-comfyui: routes and media proxy');
    });
}
