/**
 * dsh-comfy-suite — 作品库 / 风格库（客户端）
 * ============================================================================
 * 借鉴 dsh-image-gen 的两个界面：**图库**与**灵感库**。这里按本套件的实际
 * 情况做了收敛：
 *
 *   · 作品库 = 扫描出图目录得到的文件列表（真相在磁盘上，见 lib/gallery.js），
 *     不是一个独立的数据库。所以"插件装之前画的图"也会出现。
 *   · 风格库 = lib/presets/qwen-presets.json，62 条提示词积木，可检索、可拼句。
 *
 * 两个面板都挂在设置页的 tab 里（不新开侧栏、不抢对话槽位），因为本套件已经
 * 有一个设置入口；多一条导航只会让入口更难找。
 *
 * 取数全部走相对路径 `/api/comfy-suite/…`：与 launcher 面板同一套路，
 * 浏览器按 document.baseURI 解析，DSH 换端口/换域名都不用改这里。
 */
__dshSuiteRegister({
    id: 'dsh-comfy-suite/gallery',
    factory(require) {
        const React = require('react');
        const h = React.createElement;

        /* ------------------------------------------------------------ 文案 ---- */

        const DICT = {
            zh: {
                gallery: '作品库',
                gallerySub: '出过的图都在这里：检索、收藏、复用参数、清理。文件本身仍在出图目录里，这里只是入口。',
                searchPlaceholder: '搜索提示词 / 文件名 / 种子…',
                all: '全部',
                favorites: '收藏',
                newest: '最新在前',
                oldest: '最早在前',
                includeWorkflow: '包含工作流产物',
                refresh: '刷新',
                empty: '还没有作品。让助手画一张，或换个搜索词。',
                emptyFavorites: '还没有收藏。在图里点一下星标就行。',
                loading: '读取中…',
                failed: '读取失败',
                count: (n, mb) => `${n} 张 · ${mb}`,
                favorite: '收藏',
                unfavorite: '取消收藏',
                copyPrompt: '复制提示词',
                copyPath: '复制路径',
                again: '换一颗种子再画',
                sameSeed: '同种子复现',
                remove: '删除',
                removeConfirm: '删除会把文件移到 data/dsh-comfy-suite/trash（可手动捞回），确定吗？',
                close: '关闭',
                copied: '已复制',
                copyFailed: '复制失败，请手动选中文本',
                regenerating: '正在重画…',
                regenDone: '新图已出：',
                regenFailed: '重画失败',
                deleteDone: '已移到回收站',
                deleteFailed: '删除失败',
                noPrompt: '这张图没有出图记录，无法复现参数。',
                seed: '种子',
                steps: '步数',
                size: '尺寸',
                elapsed: '耗时',
                path: '路径',
                unknown: '未知',
                presets: '风格库',
                presetsSub: '直接能用的提示词积木。挑 2–4 条（画风 + 光效 + 构图最常见），拼到画面描述后面。',
                presetSearch: '搜索风格 / 光效 / 构图 / 海报…',
                allKinds: '全部',
                composeTitle: '拼一句',
                composeBase: '画面主体（可选）：例如 一只橘猫坐在窗台上',
                composeGo: '生成提示词',
                composeEmpty: '先在上面选几条（点条目右边的 ＋）。',
                selected: '已选',
                clear: '清空',
                positive: '正向提示词',
                negative: '负面词',
                kinds: { style: '画风', lighting: '光效', composition: '构图', quality: '画质', negative: '负面词', poster: '版式' },
            },
            en: {
                gallery: 'Gallery',
                gallerySub: 'Everything you generated: search, favourite, reuse the same settings, clean up. The files stay in the output folder — this is just the entrance.',
                searchPlaceholder: 'Search prompt / file name / seed…',
                all: 'All',
                favorites: 'Favourites',
                newest: 'Newest first',
                oldest: 'Oldest first',
                includeWorkflow: 'Include workflow outputs',
                refresh: 'Refresh',
                empty: 'No images yet. Ask the assistant to draw one, or try another search.',
                emptyFavorites: 'Nothing favourited yet — click the star on an image.',
                loading: 'Loading…',
                failed: 'Failed to load',
                count: (n, mb) => `${n} images · ${mb}`,
                favorite: 'Favourite',
                unfavorite: 'Unfavourite',
                copyPrompt: 'Copy prompt',
                copyPath: 'Copy path',
                again: 'Draw again (new seed)',
                sameSeed: 'Reproduce (same seed)',
                remove: 'Delete',
                removeConfirm: 'This moves the file to data/dsh-comfy-suite/trash (recoverable). Continue?',
                close: 'Close',
                copied: 'Copied',
                copyFailed: 'Copy failed — select the text manually',
                regenerating: 'Generating…',
                regenDone: 'New image: ',
                regenFailed: 'Generation failed',
                deleteDone: 'Moved to trash',
                deleteFailed: 'Delete failed',
                noPrompt: 'No generation record for this file, so the settings cannot be replayed.',
                seed: 'Seed',
                steps: 'Steps',
                size: 'Size',
                elapsed: 'Took',
                path: 'Path',
                unknown: 'unknown',
                presets: 'Style library',
                presetsSub: 'Ready-to-paste prompt fragments. Pick 2–4 (style + light + framing works best) and append them to your subject.',
                presetSearch: 'Search style / light / framing / poster…',
                allKinds: 'All',
                composeTitle: 'Compose',
                composeBase: 'Subject (optional), e.g. an orange cat sitting on a windowsill',
                composeGo: 'Build prompt',
                composeEmpty: 'Pick a few entries first (the ＋ on the right).',
                selected: 'Selected',
                clear: 'Clear',
                positive: 'Prompt',
                negative: 'Negative',
                kinds: { style: 'Style', lighting: 'Light', composition: 'Framing', quality: 'Quality', negative: 'Negative', poster: 'Layout' },
            },
        };

        /** 当前语言由合并层的 comfyui 面板提供（它认得平台的 locale）。 */
        function lang() {
            try {
                const ui = window.__DSH_SUITE_UI__ || {};
                if (ui.comfyui && typeof ui.comfyui.getLang === 'function') return ui.comfyui.getLang();
            } catch (error) {
                /* 拿不到就退中文 */
            }
            return 'zh';
        }

        const t = () => DICT[lang() === 'en' ? 'en' : 'zh'];

        /* ------------------------------------------------------------ 请求 ---- */

        async function call(path, init) {
            const response = await fetch(path, Object.assign({ cache: 'no-store' }, init || {}));
            let data = {};
            try {
                data = await response.json();
            } catch (error) {
                data = {};
            }
            if (!response.ok || data.ok === false) {
                const message = typeof data.error === 'string' && data.error !== ''
                    ? data.error
                    : `HTTP ${response.status}`;
                throw new Error(message);
            }
            return data;
        }

        const post = (path, body) => call(path, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body || {}),
        });

        /** 剪贴板：优先 navigator.clipboard，失败退回 textarea + execCommand。 */
        async function copyText(text) {
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                    return true;
                }
            } catch (error) {
                /* 落到下面的兜底 */
            }
            try {
                const area = document.createElement('textarea');
                area.value = text;
                area.setAttribute('readonly', '');
                area.style.position = 'fixed';
                area.style.opacity = '0';
                document.body.appendChild(area);
                area.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(area);
                return ok;
            } catch (error) {
                return false;
            }
        }

        function formatBytes(bytes) {
            if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
            const mb = bytes / (1024 * 1024);
            return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)} MB`;
        }

        function formatTime(ms) {
            if (!Number.isFinite(ms)) return '';
            const date = new Date(ms);
            const pad = (n) => String(n).padStart(2, '0');
            return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
        }

        /* ------------------------------------------------------------ 样式 ---- */

        const S = {
            wrap: { display: 'flex', flexDirection: 'column', gap: '14px', padding: '8px 0 24px', minWidth: 0 },
            title: { fontSize: '15px', lineHeight: '22px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
            sub: { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)', marginTop: '2px' },
            bar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' },
            input: {
                flex: '1 1 240px', minWidth: '160px', boxSizing: 'border-box',
                padding: '7px 10px', fontSize: '13px', lineHeight: '18px',
                color: 'var(--dsw-alias-label-primary)',
                background: 'var(--dsw-alias-bg-layer-1)',
                border: '1px solid var(--dsw-alias-border-l1)',
                borderRadius: '8px', outline: 'none',
            },
            select: {
                padding: '7px 8px', fontSize: '12px', lineHeight: '18px',
                color: 'var(--dsw-alias-label-primary)',
                background: 'var(--dsw-alias-bg-layer-1)',
                border: '1px solid var(--dsw-alias-border-l1)',
                borderRadius: '8px',
            },
            chip: (active) => ({
                padding: '5px 12px', fontSize: '12px', lineHeight: '18px', cursor: 'pointer',
                borderRadius: '999px',
                border: `1px solid ${active ? 'transparent' : 'var(--dsw-alias-border-l1)'}`,
                background: active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-bg-layer-1)',
                color: active ? '#fff' : 'var(--dsw-alias-label-secondary)',
            }),
            button: (primary) => ({
                padding: '6px 12px', fontSize: '12px', lineHeight: '18px', cursor: 'pointer',
                borderRadius: '8px',
                border: primary ? '1px solid transparent' : '1px solid var(--dsw-alias-border-l1)',
                background: primary ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-bg-layer-1)',
                color: primary ? '#fff' : 'var(--dsw-alias-label-primary)',
            }),
            stats: { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)' },
            error: { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-state-error-primary)' },
            grid: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '10px',
            },
            card: {
                position: 'relative', padding: 0, margin: 0, cursor: 'pointer',
                borderRadius: '10px', overflow: 'hidden',
                border: '1px solid var(--dsw-alias-border-l1)',
                background: 'var(--dsw-alias-bg-layer-1)',
            },
            thumb: { display: 'block', width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', background: 'var(--dsw-alias-bg-layer-2)' },
            caption: {
                padding: '6px 8px', fontSize: '11px', lineHeight: '15px', textAlign: 'left',
                color: 'var(--dsw-alias-label-secondary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            },
            star: (on) => ({
                position: 'absolute', top: '6px', right: '6px',
                width: '24px', height: '24px', padding: 0, cursor: 'pointer',
                borderRadius: '999px', border: 'none',
                background: on ? 'rgba(250, 204, 21, 0.92)' : 'rgba(0, 0, 0, 0.45)',
                color: on ? '#422006' : '#fff',
                fontSize: '13px', lineHeight: '24px', textAlign: 'center',
            }),
            overlay: {
                position: 'fixed', inset: 0, zIndex: 60,
                background: 'rgba(0, 0, 0, 0.62)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '24px',
            },
            dialog: {
                display: 'flex', flexDirection: 'column', gap: '12px',
                maxWidth: '900px', maxHeight: '90vh', width: '100%',
                background: 'var(--dsw-alias-bg-layer-1)',
                borderRadius: '14px', padding: '16px', overflow: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
            },
            meta: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: '12px', lineHeight: '18px' },
            metaKey: { color: 'var(--dsw-alias-label-secondary)' },
            metaVal: { color: 'var(--dsw-alias-label-primary)', wordBreak: 'break-all' },
            presetCard: {
                display: 'flex', flexDirection: 'column', gap: '6px',
                padding: '10px 12px', borderRadius: '10px',
                border: '1px solid var(--dsw-alias-border-l1)',
                background: 'var(--dsw-alias-bg-layer-1)',
            },
            tag: {
                display: 'inline-block', padding: '1px 6px', marginRight: '4px',
                fontSize: '10px', lineHeight: '15px', borderRadius: '4px',
                background: 'var(--dsw-alias-bg-layer-2)',
                color: 'var(--dsw-alias-label-secondary)',
            },
        };

        /* ---------------------------------------------------------- 作品库 ---- */

        function Gallery() {
            const L = t();
            const [state, setState] = React.useState({ items: [], total: 0, stats: null });
            const [query, setQuery] = React.useState('');
            const [scope, setScope] = React.useState('all');
            const [sort, setSort] = React.useState('newest');
            const [withWorkflow, setWithWorkflow] = React.useState(false);
            const [loading, setLoading] = React.useState(true);
            const [error, setError] = React.useState('');
            const [selected, setSelected] = React.useState(null);
            const [notice, setNotice] = React.useState('');
            const [busy, setBusy] = React.useState('');

            const load = React.useCallback(async (signal) => {
                setLoading(true);
                setError('');
                try {
                    const params = new URLSearchParams({
                        q: query,
                        scope,
                        sort,
                        limit: '200',
                        workflow: withWorkflow ? '1' : '0',
                    });
                    const data = await call(`/api/comfy-suite/gallery?${params.toString()}`);
                    if (signal && signal.aborted) return;
                    setState({ items: data.items || [], total: data.total || 0, stats: data.stats || null });
                } catch (err) {
                    if (!signal || !signal.aborted) setError(err && err.message ? err.message : String(err));
                } finally {
                    if (!signal || !signal.aborted) setLoading(false);
                }
            }, [query, scope, sort, withWorkflow]);

            React.useEffect(() => {
                const controller = new AbortController();
                const timer = window.setTimeout(() => { void load(controller.signal); }, 180);
                return () => {
                    controller.abort();
                    window.clearTimeout(timer);
                };
            }, [load]);

            const refresh = async () => {
                await load();
            };

            const toggleFavorite = async (item, event) => {
                if (event) event.stopPropagation();
                try {
                    await post('/api/comfy-suite/gallery/favorite', { id: item.id, favorite: item.favorite !== true });
                    setState((prev) => ({
                        ...prev,
                        items: prev.items.map((entry) => (entry.id === item.id ? { ...entry, favorite: entry.favorite !== true } : entry)),
                    }));
                    if (selected && selected.id === item.id) setSelected({ ...selected, favorite: selected.favorite !== true });
                } catch (err) {
                    setError(err.message || String(err));
                }
            };

            const copy = async (text, label) => {
                const ok = await copyText(text);
                setNotice(ok ? `${label}：${L.copied}` : L.copyFailed);
                window.setTimeout(() => setNotice(''), 2400);
            };

            const regenerate = async (item, sameSeed) => {
                if (busy !== '') return;
                setBusy(item.id);
                setNotice('');
                try {
                    const data = await post('/api/comfy-suite/gallery/regenerate', {
                        id: item.id,
                        seed: sameSeed ? 'same' : 'random',
                    });
                    setNotice(`${L.regenDone}${data.path || ''}`);
                    await refresh();
                } catch (err) {
                    setNotice(`${L.regenFailed}：${err.message || String(err)}`);
                } finally {
                    setBusy('');
                }
            };

            const remove = async (item) => {
                if (!window.confirm(L.removeConfirm)) return;
                try {
                    await post('/api/comfy-suite/gallery/delete', { id: item.id });
                    setNotice(L.deleteDone);
                    setSelected(null);
                    await refresh();
                } catch (err) {
                    setNotice(`${L.deleteFailed}：${err.message || String(err)}`);
                }
            };

            const stats = state.stats || { count: 0, bytes: 0 };

            const header = h('div', null,
                h('div', { style: S.title }, L.gallery),
                h('div', { style: S.sub }, L.gallerySub));

            const bar = h('div', { style: S.bar },
                h('input', {
                    style: S.input,
                    value: query,
                    placeholder: L.searchPlaceholder,
                    onChange: (event) => setQuery(event.target.value),
                }),
                h('div', { style: { display: 'flex', gap: '6px' } },
                    h('button', { type: 'button', style: S.chip(scope === 'all'), onClick: () => setScope('all') }, L.all),
                    h('button', { type: 'button', style: S.chip(scope === 'favorite'), onClick: () => setScope('favorite') }, L.favorites)),
                h('select', { style: S.select, value: sort, onChange: (event) => setSort(event.target.value) },
                    h('option', { value: 'newest' }, L.newest),
                    h('option', { value: 'oldest' }, L.oldest)),
                h('label', { style: { ...S.stats, display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' } },
                    h('input', {
                        type: 'checkbox',
                        checked: withWorkflow,
                        onChange: (event) => setWithWorkflow(event.target.checked),
                    }),
                    L.includeWorkflow),
                h('button', { type: 'button', style: S.button(false), onClick: () => { void refresh(); } }, L.refresh));

            const summary = h('div', { style: S.stats },
                `${L.count(state.total, formatBytes(stats.bytes))}${stats.favorites ? ` · ★ ${stats.favorites}` : ''}`
                + (loading ? ` · ${L.loading}` : ''));

            const grid = state.items.length === 0
                ? h('div', { style: { ...S.sub, padding: '24px 0' } }, loading ? L.loading : (scope === 'favorite' ? L.emptyFavorites : L.empty))
                : h('div', { style: S.grid }, state.items.map((item) => h('button', {
                    key: item.id,
                    type: 'button',
                    style: S.card,
                    title: item.prompt || item.name,
                    onClick: () => setSelected(item),
                },
                h('img', {
                    style: S.thumb,
                    src: `/api/comfy-suite/gallery/file?id=${encodeURIComponent(item.id)}`,
                    alt: item.prompt || item.name,
                    loading: 'lazy',
                }),
                h('span', { style: S.star(item.favorite === true), role: 'button', title: item.favorite ? L.unfavorite : L.favorite, onClick: (event) => { void toggleFavorite(item, event); } }, '★'),
                h('div', { style: S.caption }, item.prompt || item.name))));

            const detail = selected === null ? null : h('div', {
                style: S.overlay,
                onClick: (event) => { if (event.target === event.currentTarget) setSelected(null); },
            }, h('div', { style: S.dialog },
                h('img', {
                    style: { display: 'block', width: '100%', maxHeight: '52vh', objectFit: 'contain', background: '#000', borderRadius: '10px' },
                    src: `/api/comfy-suite/gallery/file?id=${encodeURIComponent(selected.id)}`,
                    alt: selected.prompt || selected.name,
                }),
                h('div', { style: S.meta },
                    h('span', { style: S.metaKey }, L.size),
                    h('span', { style: S.metaVal }, selected.width && selected.height ? `${selected.width} × ${selected.height}` : L.unknown),
                    h('span', { style: S.metaKey }, L.seed),
                    h('span', { style: S.metaVal }, selected.seed === undefined ? L.unknown : String(selected.seed)),
                    h('span', { style: S.metaKey }, L.steps),
                    h('span', { style: S.metaVal }, selected.steps === undefined ? L.unknown : String(selected.steps)),
                    h('span', { style: S.metaKey }, L.elapsed),
                    h('span', { style: S.metaVal }, selected.seconds === undefined ? L.unknown : `${selected.seconds}s`),
                    h('span', { style: S.metaKey }, L.path),
                    h('span', { style: S.metaVal }, selected.file)),
                h('div', {
                    style: {
                        fontSize: '13px', lineHeight: '20px', color: 'var(--dsw-alias-label-primary)',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        padding: '10px 12px', borderRadius: '10px',
                        background: 'var(--dsw-alias-bg-layer-2)',
                    },
                }, selected.prompt || L.noPrompt),
                h('div', { style: S.bar },
                    h('button', { type: 'button', style: S.button(true), onClick: () => setSelected(null) }, L.close),
                    selected.prompt ? h('button', { type: 'button', style: S.button(false), onClick: () => { void copy(selected.prompt, L.copyPrompt); } }, L.copyPrompt) : null,
                    h('button', { type: 'button', style: S.button(false), onClick: () => { void copy(selected.file, L.copyPath); } }, L.copyPath),
                    selected.prompt ? h('button', {
                        type: 'button',
                        style: S.button(false),
                        disabled: busy !== '',
                        onClick: () => { void regenerate(selected, false); },
                    }, busy === selected.id ? L.regenerating : L.again) : null,
                    selected.prompt && selected.seed !== undefined ? h('button', {
                        type: 'button',
                        style: S.button(false),
                        disabled: busy !== '',
                        onClick: () => { void regenerate(selected, true); },
                    }, L.sameSeed) : null,
                    h('button', {
                        type: 'button',
                        style: { ...S.button(false), color: 'var(--dsw-alias-state-error-primary)' },
                        onClick: () => { void remove(selected); },
                    }, L.remove))));

            return h('section', { style: S.wrap },
                header,
                bar,
                summary,
                error === '' ? null : h('div', { style: S.error }, `${L.failed}: ${error}`),
                notice === '' ? null : h('div', { style: S.stats }, notice),
                grid,
                detail);
        }

        /* ---------------------------------------------------------- 风格库 ---- */

        function Presets() {
            const L = t();
            const [items, setItems] = React.useState([]);
            const [kinds, setKinds] = React.useState({});
            const [query, setQuery] = React.useState('');
            const [kind, setKind] = React.useState('');
            const [selected, setSelected] = React.useState([]);
            const [base, setBase] = React.useState('');
            const [composed, setComposed] = React.useState(null);
            const [error, setError] = React.useState('');
            const [loading, setLoading] = React.useState(true);
            const [notice, setNotice] = React.useState('');

            React.useEffect(() => {
                let alive = true;
                setLoading(true);
                call('/api/comfy-suite/presets')
                    .then((data) => {
                        if (!alive) return;
                        setItems(data.items || []);
                        setKinds(data.kinds || {});
                        setError('');
                    })
                    .catch((err) => {
                        if (alive) setError(err && err.message ? err.message : String(err));
                    })
                    .finally(() => { if (alive) setLoading(false); });
                return () => { alive = false; };
            }, []);

            const filtered = React.useMemo(() => {
                const terms = query.trim().toLowerCase().split(/\s+/u).filter(Boolean);
                return items.filter((item) => {
                    if (kind !== '' && item.kind !== kind) return false;
                    if (terms.length === 0) return true;
                    const hay = [item.name, item.prompt, item.note, (item.tags || []).join(' ')].join(' ').toLowerCase();
                    return terms.every((term) => hay.includes(term));
                });
            }, [items, query, kind]);

            const toggle = (id) => {
                setSelected((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
            };

            const compose = async () => {
                if (selected.length === 0) {
                    setNotice(L.composeEmpty);
                    return;
                }
                try {
                    const data = await post('/api/comfy-suite/presets/compose', { ids: selected, base });
                    setComposed(data);
                    setNotice('');
                } catch (err) {
                    setError(err.message || String(err));
                }
            };

            const copy = async (text, label) => {
                const ok = await copyText(text);
                setNotice(ok ? `${label}：${L.copied}` : L.copyFailed);
                window.setTimeout(() => setNotice(''), 2400);
            };

            const header = h('div', null,
                h('div', { style: S.title }, L.presets),
                h('div', { style: S.sub }, L.presetsSub));

            const chips = h('div', { style: S.bar },
                h('button', { type: 'button', style: S.chip(kind === ''), onClick: () => setKind('') }, L.allKinds),
                Object.keys(kinds).map((key) => h('button', {
                    key,
                    type: 'button',
                    style: S.chip(kind === key),
                    onClick: () => setKind(key),
                }, kinds[key])));

            const list = filtered.length === 0
                ? h('div', { style: S.sub }, loading ? L.loading : '—')
                : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, filtered.map((item) => {
                    const picked = selected.includes(item.id);
                    return h('div', { key: item.id, style: { ...S.presetCard, borderColor: picked ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l1)' } },
                        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                            h('span', { style: { fontSize: '13px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, item.name),
                            h('span', { style: S.tag }, kinds[item.kind] || item.kind),
                            (item.tags || []).map((tag) => h('span', { key: tag, style: S.tag }, tag)),
                            h('span', { style: { flex: 1 } }),
                            h('button', {
                                type: 'button',
                                style: S.button(picked),
                                onClick: () => toggle(item.id),
                            }, picked ? '✓' : '＋'),
                            h('button', {
                                type: 'button',
                                style: S.button(false),
                                onClick: () => { void copy(item.prompt, L.copyPrompt); },
                            }, L.copyPrompt)),
                        h('div', { style: { fontSize: '12px', lineHeight: '19px', color: 'var(--dsw-alias-label-primary)', wordBreak: 'break-word' } }, item.prompt),
                        item.note ? h('div', { style: { fontSize: '11px', lineHeight: '17px', color: 'var(--dsw-alias-label-secondary)' } }, item.note) : null);
                }));

            const composer = h('div', { style: { ...S.presetCard, gap: '10px' } },
                h('div', { style: { fontSize: '13px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } },
                    `${L.composeTitle}${selected.length > 0 ? ` · ${L.selected} ${selected.length}` : ''}`),
                h('input', {
                    style: S.input,
                    value: base,
                    placeholder: L.composeBase,
                    onChange: (event) => setBase(event.target.value),
                }),
                h('div', { style: S.bar },
                    h('button', { type: 'button', style: S.button(true), onClick: () => { void compose(); } }, L.composeGo),
                    h('button', { type: 'button', style: S.button(false), onClick: () => { setSelected([]); setComposed(null); } }, L.clear)),
                composed === null ? null : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                    h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, L.positive),
                    h('div', { style: { fontSize: '12px', lineHeight: '19px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--dsw-alias-label-primary)' } }, composed.prompt),
                    composed.negative ? h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, L.negative) : null,
                    composed.negative ? h('div', { style: { fontSize: '12px', lineHeight: '19px', color: 'var(--dsw-alias-label-primary)' } }, composed.negative) : null,
                    h('div', { style: S.bar },
                        h('button', { type: 'button', style: S.button(false), onClick: () => { void copy(composed.prompt, L.copyPrompt); } }, L.copyPrompt))));

            return h('section', { style: S.wrap },
                header,
                h('input', {
                    style: S.input,
                    value: query,
                    placeholder: L.presetSearch,
                    onChange: (event) => setQuery(event.target.value),
                }),
                chips,
                error === '' ? null : h('div', { style: S.error }, error),
                notice === '' ? null : h('div', { style: S.stats }, notice),
                list,
                composer);
        }

        /* -------------------------------------------------------- 提示词衣柜 ---- */

        /**
         * 衣柜的文案单独一份，不塞进上面那个 DICT。
         *
         * 原因很实在：DICT 是"作品库/风格库"两屏共用的，衣柜有自己一整套
         * 档位/模式/场景的措辞，混进去两边都会变难读。
         */
        const W = {
            zh: {
                title: '提示词衣柜',
                sub: '按内容档位抽一整段 prompt：低档位先从候选池排除高档词，同种子逐字可复现。抽完可以直接画，也可以复制给助手。',
                level: '档位',
                mode: '模式',
                subject: '主体（可选）',
                subjectPlaceholder: '例如 一位坐在窗边的女性、一只橘猫',
                scene: '场景搭配',
                sceneOff: '不套场景',
                sceneAuto: '随机套一条',
                seed: '种子',
                seedPlaceholder: '留空=每次重抽；填数字=复现',
                roll: '抽一段',
                rolling: '抽取中…',
                empty: '还没有结果。选好档位，点「抽一段」。',
                prompt: '正向提示词',
                negative: '负面词',
                report: '自检报告',
                copyPrompt: '复制提示词',
                copyNegative: '复制负面词',
                draw: '画一张',
                drawing: '正在出图（可能要一分钟）…',
                drawn: '已出图：',
                drawFailed: '出图失败',
                copied: '已复制',
                copyFailed: '复制失败，请手动选中',
                loadFailed: '衣柜数据读取失败',
                levelHint: { 0: '全年龄', 1: '轻度暗示', 2: '明确', 3: '露骨', 4: '极端' },
            },
            en: {
                title: 'Prompt wardrobe',
                sub: 'Roll a whole prompt at a content level: out-of-level words are excluded before sampling, and the same seed reproduces it word for word. Draw it right here or copy it.',
                level: 'Level',
                mode: 'Mode',
                subject: 'Subject (optional)',
                subjectPlaceholder: 'e.g. a woman sitting by the window, an orange cat',
                scene: 'Scene preset',
                sceneOff: 'No scene',
                sceneAuto: 'Random scene',
                seed: 'Seed',
                seedPlaceholder: 'blank = new roll; a number = reproduce',
                roll: 'Roll',
                rolling: 'Rolling…',
                empty: 'Nothing yet. Pick a level and hit Roll.',
                prompt: 'Prompt',
                negative: 'Negative',
                report: 'Self-check',
                copyPrompt: 'Copy prompt',
                copyNegative: 'Copy negative',
                draw: 'Draw it',
                drawing: 'Generating (may take a minute)…',
                drawn: 'Saved: ',
                drawFailed: 'Generation failed',
                copied: 'Copied',
                copyFailed: 'Copy failed — select the text manually',
                loadFailed: 'Could not load the wardrobe data',
                levelHint: { 0: 'all ages', 1: 'mild', 2: 'explicit', 3: 'graphic', 4: 'extreme' },
            },
        };

        function Wardrobe() {
            const L = W[lang() === 'en' ? 'en' : 'zh'];
            const [meta, setMeta] = React.useState(null);
            const [level, setLevel] = React.useState(0);
            const [mode, setMode] = React.useState('person');
            const [subject, setSubject] = React.useState('');
            const [scene, setScene] = React.useState('off');
            const [seedText, setSeedText] = React.useState('');
            const [variants, setVariants] = React.useState([]);
            const [busy, setBusy] = React.useState(false);
            const [error, setError] = React.useState('');
            const [notice, setNotice] = React.useState('');

            React.useEffect(() => {
                let alive = true;
                call('/api/comfy-suite/wardrobe')
                    .then((data) => {
                        if (!alive) return;
                        setMeta(data);
                        setError('');
                    })
                    .catch((err) => {
                        if (alive) setError(`${L.loadFailed}：${err.message || String(err)}`);
                    });
                return () => { alive = false; };
            }, []);

            // 档位调低后，原本选中的场景可能已经超档 —— 直接退回"不套场景"，
            // 不然一点抽取就会收到"高于当前档位"的忽略说明。
            React.useEffect(() => {
                if (scene === 'off' || scene === 'auto' || meta === null) return;
                const hit = (meta.scenes || []).find((entry) => entry.id === scene);
                if (hit !== undefined && hit.level > level) setScene('off');
            }, [level, scene, meta]);

            const levels = (meta && meta.levels) || [
                { num: 0, label: 'L0' }, { num: 1, label: 'L1' }, { num: 2, label: 'L2' },
                { num: 3, label: 'L3' }, { num: 4, label: 'L4' },
            ];
            const modes = (meta && meta.modes) || { person: { label: '人物' }, object: { label: '静物' }, scene: { label: '空镜' } };
            const scenes = ((meta && meta.scenes) || []).filter((entry) => entry.level <= level);

            const roll = async () => {
                setBusy(true);
                setNotice('');
                try {
                    const body = { level, mode, subject, scene };
                    const trimmed = seedText.trim();
                    const parsed = Number(trimmed);
                    if (trimmed !== '' && Number.isFinite(parsed)) body.seed = Math.trunc(parsed);
                    const data = await post('/api/comfy-suite/wardrobe/roll', body);
                    setVariants(data.variants || []);
                    setError('');
                } catch (err) {
                    setError(err.message || String(err));
                } finally {
                    setBusy(false);
                }
            };

            const copy = async (text, label) => {
                const ok = await copyText(text);
                setNotice(ok ? `${label}：${L.copied}` : L.copyFailed);
                window.setTimeout(() => setNotice(''), 2400);
            };

            const drawOne = async (variant) => {
                setBusy(true);
                setNotice(L.drawing);
                try {
                    const data = await post('/api/comfy-suite/wardrobe/draw', {
                        prompt: variant.prompt,
                        negative: variant.negative,
                    });
                    setNotice(`${L.drawn}${data.path || ''}`);
                    setError('');
                } catch (err) {
                    setError(`${L.drawFailed}：${err.message || String(err)}`);
                    setNotice('');
                } finally {
                    setBusy(false);
                }
            };

            const header = h('div', null,
                h('div', { style: S.title }, L.title),
                h('div', { style: S.sub }, L.sub));

            const levelRow = h('div', { style: S.bar },
                h('span', { style: S.stats }, L.level),
                levels.map((entry) => h('button', {
                    key: entry.num,
                    type: 'button',
                    style: S.chip(entry.num === level),
                    title: entry.hint || L.levelHint[entry.num] || '',
                    onClick: () => setLevel(entry.num),
                }, `${entry.label}${entry.hint ? '' : ''}`)),
                h('span', { style: S.stats }, (levels.find((entry) => entry.num === level) || {}).hint || L.levelHint[level] || ''));

            const modeRow = h('div', { style: S.bar },
                h('span', { style: S.stats }, L.mode),
                Object.keys(modes).map((key) => h('button', {
                    key,
                    type: 'button',
                    style: S.chip(key === mode),
                    title: (modes[key] || {}).hint || '',
                    onClick: () => setMode(key),
                }, (modes[key] || {}).label || key)));

            const form = h('div', { style: { ...S.presetCard, gap: '10px' } },
                levelRow,
                modeRow,
                h('input', {
                    style: S.input,
                    value: subject,
                    placeholder: L.subjectPlaceholder,
                    onChange: (event) => setSubject(event.target.value),
                }),
                h('div', { style: S.bar },
                    h('span', { style: S.stats }, L.scene),
                    h('select', {
                        style: S.select,
                        value: scene,
                        onChange: (event) => setScene(event.target.value),
                    },
                    h('option', { value: 'off' }, L.sceneOff),
                    h('option', { value: 'auto' }, L.sceneAuto),
                    scenes.map((entry) => h('option', { key: entry.id, value: entry.id }, `${entry.zh}（L${entry.level}）`))),
                    h('span', { style: S.stats }, L.seed),
                    h('input', {
                        style: { ...S.input, flex: '0 1 220px' },
                        value: seedText,
                        placeholder: L.seedPlaceholder,
                        onChange: (event) => setSeedText(event.target.value),
                    }),
                    h('button', {
                        type: 'button',
                        style: S.button(true),
                        disabled: busy,
                        onClick: () => { void roll(); },
                    }, busy ? L.rolling : L.roll)));

            const cards = variants.map((variant, index) => h('div', {
                key: index,
                style: { ...S.presetCard, gap: '8px' },
            },
            h('div', { style: S.bar },
                h('span', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } },
                    `#${index + 1} · seed ${variant.seed} · L${variant.level} ${variant.levelLabel || ''}`
                    + (variant.scene ? ` · ${variant.scene.zh}` : '')),
                h('span', { style: { flex: 1 } }),
                h('button', { type: 'button', style: S.button(false), onClick: () => { void copy(variant.prompt, L.copyPrompt); } }, L.copyPrompt),
                h('button', { type: 'button', style: S.button(false), onClick: () => { void copy(variant.negative, L.copyNegative); } }, L.copyNegative),
                h('button', { type: 'button', style: S.button(true), disabled: busy, onClick: () => { void drawOne(variant); } }, L.draw)),
            h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, L.prompt),
            h('div', {
                style: {
                    fontSize: '13px', lineHeight: '20px', color: 'var(--dsw-alias-label-primary)',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    padding: '10px 12px', borderRadius: '10px', background: 'var(--dsw-alias-bg-layer-2)',
                },
            }, variant.prompt),
            variant.negative ? h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, `${L.negative}：${variant.negative}`) : null,
            h('details', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } },
                h('summary', { style: { cursor: 'pointer' } }, L.report),
                h('pre', {
                    style: {
                        margin: '6px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        font: 'inherit', lineHeight: '17px',
                    },
                }, variant.report))));

            return h('section', { style: S.wrap },
                header,
                error === '' ? null : h('div', { style: S.error }, error),
                notice === '' ? null : h('div', { style: S.stats }, notice),
                form,
                variants.length === 0 ? h('div', { style: S.sub }, L.empty) : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, cards));
        }

        return { Gallery, Presets, Wardrobe };
    },
});