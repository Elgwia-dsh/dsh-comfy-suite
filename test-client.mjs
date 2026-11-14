/**
 * 离线冒烟测试：在 Node 里给 client/client.js 造一个假的浏览器壳，
 * 验证三件事 ——
 *   1. 三个子 bundle 的 factory 都进了私有表（没有向 DSH 注册多余 id）；
 *   2. suite 的 factory 能物化三者；
 *   3. apply() 之后 slots.register 的条目符合预期（一个 settings.section + 子插件各自的槽）。
 */
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

// 读本包内的产物；client/_parts 是它的源，scripts/build-client.mjs --check 校验一致性。
const code = fs.readFileSync(fileURLToPath(new URL('./client/client.js', import.meta.url)), 'utf8');

const registrations = new Map();
const slots = [];
const disposed = [];

const makeEl = (tag) => ({
    tagName: tag,
    style: {},
    dataset: {},
    children: [],
    setAttribute() { },
    appendChild(child) { this.children.push(child); return child; },
    append(...nodes) { this.children.push(...nodes); },
    prepend(...nodes) { this.children.unshift(...nodes); },
    insertBefore(child) { this.children.push(child); return child; },
    replaceChildren(...nodes) { this.children = nodes; },
    contains() { return false; },
    removeChild() { },
    remove() { },
    addEventListener() { },
    removeEventListener() { },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    classList: { add() { }, remove() { }, contains() { return false; } },
});

const documentStub = {
    head: makeEl('head'),
    body: makeEl('body'),
    documentElement: makeEl('html'),
    createElement: makeEl,
    createTextNode: (text) => ({ textContent: text }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() { },
    removeEventListener() { },
};

const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval: () => { },
    queueMicrotask,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    AbortController,
    Blob: class Blob { },
    Promise,
    fetch: async () => { throw new Error('offline test'); },
    localStorage: {
        store: new Map(),
        getItem(k) { return this.store.has(k) ? this.store.get(k) : null; },
        setItem(k, v) { this.store.set(k, String(v)); },
        removeItem(k) { this.store.delete(k); },
    },
    navigator: { language: 'zh-CN', userAgent: 'node-test' },
    document: documentStub,
    MutationObserver: class { observe() { } disconnect() { } },
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    cancelAnimationFrame: () => { },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
};
// 浏览器本来就有的全局类：bundles 顶层可能 `class X extends HTMLElement`。
class DomNodeStub { }
for (const name of [
    'HTMLElement', 'HTMLMediaElement', 'HTMLVideoElement', 'HTMLAudioElement',
    'HTMLImageElement', 'HTMLCanvasElement', 'HTMLDivElement', 'Element', 'Node',
    'Event', 'CustomEvent', 'EventTarget', 'DocumentFragment', 'NodeList',
]) {
    sandbox[name] = DomNodeStub;
}
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.__ModuleLoader__ = {
    load(registration) { registrations.set(registration.id, registration.factory); },
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'suite-client.js' });

console.log('registered ids:', [...registrations.keys()]);
const suiteFactory = registrations.get('dsh-comfy-suite');
if (typeof suiteFactory !== 'function') throw new Error('suite factory missing');

const React = {
    Component: class Component { constructor(props) { this.props = props; this.state = {}; } setState() { } forceUpdate() { } render() { return null; } },
    PureComponent: class PureComponent { constructor(props) { this.props = props; this.state = {}; } setState() { } render() { return null; } },
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => { }],
    useEffect: () => { },
    useMemo: (fn) => fn(),
    useRef: (v) => ({ current: v }),
    useSyncExternalStore: (_sub, getSnapshot) => getSnapshot(),
    Fragment: 'Fragment',
    createContext: (v) => ({ Provider: 'P', Consumer: 'C', _v: v }),
    useContext: (c) => c?._v,
    createRoot: () => ({ render() { }, unmount() { } }),
    memo: (c) => c,
    forwardRef: (c) => c,
    useCallback: (fn) => fn,
    useLayoutEffect: () => { },
    useDeferredValue: (v) => v,
    startTransition: (fn) => fn(),
};
React.default = React;

const exportsObj = suiteFactory((spec) => {
    if (spec === 'react') return React;
    throw new Error('unknown require: ' + spec);
});
console.log('exports:', exportsObj.name, exportsObj.inject);

const ctx = {
    slots: {
        inject(_name, callback) { return callback(); },
        register(meta, component) {
            slots.push({ meta, component });
            return () => { };
        },
    },
    effect(fn) { const d = fn(); return typeof d === 'function' ? d : () => { }; },
    on() { },
    get() { return undefined; },
    inject(_deps, callback) { return callback(this); },
    locale: {
        register() { return () => { }; },
        subscribe() { return () => { }; },
        getSnapshot() { return { language: 'zh' }; },
        bind() { return (key) => key; },
    },
};

try {
    exportsObj.apply(ctx);
} catch (error) {
    console.log('apply threw:', error.message);
}
console.log('slots registered:', slots.map((s) => s.meta.name + ':' + (s.meta.id || s.meta.key)));
console.log('settings sections:', slots.filter((s) => s.meta.name === 'settings.section').map((s) => s.meta.id));
console.log('suite ui handles:', Object.keys(sandbox.__DSH_SUITE_UI__ || {}));
const comp = slots.find((s) => s.meta.name === 'settings.section');
if (!comp) throw new Error('NO settings.section registered');
const tree = comp.component({});
console.log('settings tree tag:', tree && tree.type);

// 设置页必须把五个 tab 都渲染出来（工作流与生成 / 作品库 / 风格库 / 提示词衣柜 / 服务启停）。
// 这里是「结构断言」而不是「外观断言」：只验证 tab 存在且顺序稳定 —— 外观归人眼看。
const tabBar = tree && Array.isArray(tree.children) ? tree.children[0] : undefined;
const tabButtons = tabBar && Array.isArray(tabBar.children) ? tabBar.children[0] : undefined;
if (!Array.isArray(tabButtons)) throw new Error('settings tab bar missing');
const labels = tabButtons.map((button) => (button.children || [])[0]);
console.log('settings tabs:', labels);
const wanted = ['工作流与生成', '作品库', '风格库', '提示词衣柜', '服务启停'];
for (const label of wanted) {
    if (!labels.includes(label)) throw new Error(`settings tab missing: ${label}`);
}
if (labels.length !== wanted.length) throw new Error(`unexpected tab count: ${labels.length}`);

// 作品库/风格库两个组件必须真的物化出来了，而不是只有 tab 没有内容。
const galleryUi = (sandbox.__DSH_SUITE_UI__ || {}).gallery;
if (!galleryUi || typeof galleryUi.Gallery !== 'function'
    || typeof galleryUi.Presets !== 'function' || typeof galleryUi.Wardrobe !== 'function') {
    throw new Error('gallery components were not exposed on __DSH_SUITE_UI__');
}
console.log('gallery components:', Object.keys(galleryUi));

// 真正渲染一遍两个面板（假 React 的 useEffect 不跑，所以这里只走"首屏"分支）。
// 目的不是看外观，而是抓 render 里的崩溃：未定义函数、拼错的状态名、坏 props。
for (const [name, Component] of [['Gallery', galleryUi.Gallery], ['Presets', galleryUi.Presets], ['Wardrobe', galleryUi.Wardrobe]]) {
    const rendered = Component({});
    if (!rendered || rendered.type !== 'section') throw new Error(`${name} did not render a section`);
    console.log(`rendered ${name}: <${rendered.type}> with ${rendered.children.length} child blocks`);
}

// ── ComfyUI 面板：实时进度条与任务行 ──────────────────────────────────────
// 这些组件只在面板打开时才有渲染路径，上面的槽位冒烟测试覆盖不到。
// 用夹具数据直接调用，抓的是"渲染期崩溃"（引用未定义变量、状态名写错）。
const comfyUi = (sandbox.__DSH_SUITE_UI__ || {}).comfyui;
if (!comfyUi || typeof comfyUi.makeT !== 'function') throw new Error('comfyui handle missing');
const t = comfyUi.makeT('zh');
const internals = comfyUi.__internal;
if (!internals) throw new Error('comfyui internal surface missing');
const { Panel, JobRow, RunningCard, LiveStrip, panelStore } = internals;

internals.panelStore.open();
/** Expand function components so nested class names/text become assertable. */
function renderTree(node) {
    if (node === null || node === undefined || typeof node !== 'object') return node;
    // Class components (TabBoundary) need `new`; keep them opaque — their children
    // are the tab body only, which the individual component calls cover.
    if (typeof node.type === 'function') {
        if (/^class[\s{]/.test(Function.prototype.toString.call(node.type))) return { ...node, children: [] };
        return renderTree(node.type(node.props ?? {}));
    }
    return {
        ...node,
        children: (node.children ?? []).map((child) => (child !== null && typeof child === 'object' && 'type' in child ? renderTree(child) : child)),
    };
}
const panel = renderTree(Panel({ t }));
if (!panel || panel.type !== 'div') throw new Error('panel did not render an opened shell');
const panelClasses = [];
const collectClasses = (node) => {
    if (node === null || typeof node !== 'object') return;
    const cls = node.props?.className;
    if (typeof cls === 'string') panelClasses.push(cls);
    for (const child of node.children ?? []) collectClasses(child);
};
collectClasses(panel);
if (!panelClasses.includes('dsc-live')) throw new Error('panel is missing the live status strip');
if (!panelClasses.includes('dsc-tabs')) throw new Error('panel is missing its tab bar');
console.log('rendered panel shell:', panelClasses.filter((cls) => cls.startsWith('dsc-panel') || cls === 'dsc-live' || cls === 'dsc-tabs').join(' | '));

const liveFixture = {
    socket: { connected: true, queueRemaining: 2, lastEventAt: new Date().toISOString() },
    tasks: [{
        promptId: 'p-1',
        workflowName: 'MiniMax H3 文生视频',
        state: 'running',
        value: 3,
        max: 9,
        node: 12,
        startedAt: Date.now() - 42_000,
        endedAt: null,
        elapsedMs: 42_000,
        etaMs: 65_000,
        error: null,
    }],
};
const strip = LiveStrip({ t, live: liveFixture });
if (!strip || strip.type !== 'div') throw new Error('LiveStrip did not render');
const stripText = JSON.stringify(strip);
for (const needle of ['正在生成', 'MiniMax H3 文生视频', '3/9']) {
    if (!stripText.includes(needle)) throw new Error(`LiveStrip lost "${needle}" — progress text regressed`);
}
console.log('rendered live strip with running task + queue depth');

const running = RunningCard({ t, task: liveFixture.tasks[0], now: Date.now(), busy: false, act() { } });
if (!running || running.type !== 'div') throw new Error('RunningCard did not render');
const runningText = JSON.stringify(running);
if (!runningText.includes('33%')) throw new Error('RunningCard lost the percentage');
if (!runningText.includes('已用 42s')) throw new Error('RunningCard lost the elapsed clock');
console.log('rendered running card: 3/9 · 33% · 已用 42s');

const job = {
    id: 'p-1',
    status: 'in_progress',
    createTime: Date.now() - 50_000,
    executionStartTime: Date.now() - 42_000,
    executionEndTime: null,
    executionError: null,
    outputsCount: 0,
    previewOutput: null,
    workflowId: null,
    workflowName: 'MiniMax H3 文生视频',
    ours: true,
    progress: null,
    live: null,
};
const row = JobRow({ job, t, busy: false, act() { }, now: Date.now(), live: liveFixture.tasks[0] });
if (!row || row.type !== 'div') throw new Error('JobRow did not render');
const rowText = JSON.stringify(row);
if (!rowText.includes('正在生成') && !rowText.includes('已用')) throw new Error('JobRow lost the running clock');
console.log('rendered job row for a running task');

// 关掉面板，避免影响其它断言。
internals.panelStore.close();

// 设置页顶部的插件介绍：必须是可折叠的 <details>，且中文条目齐全
// （这段是用户唯一会读到的"这个插件能做什么"）。
const about = internals.About({ t });
if (!about || about.type !== 'details') throw new Error('plugin introduction did not render a <details>');
const aboutItems = (about.children ?? []).find((child) => child?.type === 'ul');
// 组件的 ul 一整个是 `points.map(...)` 的数组（真 React 会展开，假 React 不会），
// 所以这里摊平一层再数条目。
const aboutList = (aboutItems?.children ?? []).flat();
if (aboutList.length < 5) {
    throw new Error('plugin introduction is missing its bullet list');
}
const aboutText = JSON.stringify(about);
for (const needle of ['实时进度', '工作流', '作品库']) {
    if (!aboutText.includes(needle)) throw new Error(`plugin introduction lost "${needle}"`);
}
console.log(`rendered plugin introduction: ${aboutList.length} bullets`);

void disposed;