/**
 * Client half of dsh-comfyui-launcher: one Settings page that shows the local
 * ComfyUI process, starts/stops it and prints the tail of its log.
 *
 * Plain-JS module (no build step): the loader hands us React from the browser
 * module table, so nothing is bundled here.
 */
window.__ModuleLoader__.load({
    id: 'dsh-comfyui-launcher',
    factory(require) {
        const React = require('react');
        const h = React.createElement;
        const NS = 'comfyui-launcher';

        const DICTS = {
            zh: {
                title: 'ComfyUI 服务',
                subtitle: '管理配置里那套便携版 ComfyUI 的后台进程；生成内容请在对话里用 ComfyUI 工作流完成。',
                running: '运行中',
                stopped: '已停止',
                unknown: '检测中…',
                start: '启动',
                stop: '停止',
                starting: '启动中…',
                stopping: '停止中…',
                showLogs: '显示日志',
                hideLogs: '收起日志',
                address: '地址',
                pid: '进程',
                uptime: '已运行',
                version: '版本',
                device: '显卡',
                logPath: '日志文件',
                emptyLog: '暂无日志',
                foreign: '这个服务不是启动器启动的（比如 DSH 重启前留下的）。点“停止”会结束监听该端口的 ComfyUI 进程。',
                autoRefresh: '状态每 5 秒自动刷新',
                requestFailed: '请求失败',
            },
            en: {
                title: 'ComfyUI Service',
                subtitle: 'Controls the portable ComfyUI configured in the suite settings. Generate content through the ComfyUI workflows in chat.',
                running: 'Running',
                stopped: 'Stopped',
                unknown: 'Checking…',
                start: 'Start',
                stop: 'Stop',
                starting: 'Starting…',
                stopping: 'Stopping…',
                showLogs: 'Show log',
                hideLogs: 'Hide log',
                address: 'Address',
                pid: 'Process',
                uptime: 'Uptime',
                version: 'Version',
                device: 'GPU',
                logPath: 'Log file',
                emptyLog: 'No log yet',
                foreign: 'This server was not started by the launcher (for example it survived a DSH restart). Stop ends the ComfyUI process listening on the port.',
                autoRefresh: 'Refreshes every 5 seconds',
                requestFailed: 'Request failed',
            },
        };

        function formatDuration(ms) {
            if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0)
                return '';
            const totalSeconds = Math.floor(ms / 1000);
            if (totalSeconds < 60)
                return `${totalSeconds}s`;
            const minutes = Math.floor(totalSeconds / 60);
            if (minutes < 60)
                return `${minutes}m${totalSeconds % 60 > 0 ? ` ${totalSeconds % 60}s` : ''}`;
            const hours = Math.floor(minutes / 60);
            return `${hours}h ${minutes % 60}m`;
        }

        function formatBytes(bytes) {
            if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0)
                return '';
            const gib = bytes / (1024 ** 3);
            return gib >= 1 ? `${gib.toFixed(1)} GiB` : `${Math.round(bytes / (1024 ** 2))} MiB`;
        }

        function metaRow(label, value) {
            const labelStyle = {
                flex: '0 0 72px',
                width: '72px',
                color: 'var(--dsw-alias-label-secondary)',
            };
            const valueStyle = {
                color: 'var(--dsw-alias-label-primary)',
                wordBreak: 'break-all',
            };
            return h('div', {
                key: label,
                style: { display: 'flex', gap: '12px', fontSize: '12px', lineHeight: '18px' },
            }, h('span', { style: labelStyle }, label), h('span', { style: valueStyle }, value));
        }

        function buttonStyle(primary, disabled) {
            return {
                appearance: 'none',
                border: primary ? '1px solid transparent' : '1px solid var(--dsw-alias-border-l1)',
                background: primary ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-bg-layer-1)',
                color: primary ? 'var(--dsw-alias-label-primary-foreground)' : 'var(--dsw-alias-label-primary)',
                borderRadius: '8px',
                padding: '6px 14px',
                font: 'inherit',
                fontSize: '13px',
                lineHeight: '18px',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.55 : 1,
            };
        }

        return {
            inject: ['slots', 'locale'],
            apply(ctx) {
                ctx.effect(() => {
                    const disposeZh = ctx.locale.register(NS, 'zh', DICTS.zh);
                    const disposeEn = ctx.locale.register(NS, 'en', DICTS.en);
                    return () => {
                        disposeZh();
                        disposeEn();
                    };
                }, 'dsh-comfyui-launcher: locale');

                function useT() {
                    React.useSyncExternalStore(
                        (callback) => ctx.locale.subscribe(callback),
                        () => ctx.locale.getSnapshot(),
                        () => ctx.locale.getSnapshot(),
                    );
                    return ctx.locale.bind(NS);
                }

                async function call(path, init) {
                    const response = await fetch(path, { cache: 'no-store', ...(init || {}) });
                    let data = {};
                    try {
                        data = await response.json();
                    }
                    catch {
                        data = {};
                    }
                    if (!response.ok) {
                        const message = typeof data.error === 'string' && data.error !== ''
                            ? data.error
                            : `HTTP ${response.status}`;
                        throw new Error(message);
                    }
                    return data;
                }

                function Panel() {
                    const t = useT();
                    const [state, setState] = React.useState(null);
                    const [busy, setBusy] = React.useState('');
                    const [error, setError] = React.useState('');
                    const [log, setLog] = React.useState(null);
                    const [showLog, setShowLog] = React.useState(false);

                    React.useEffect(() => {
                        let alive = true;
                        let timer = 0;
                        const tick = async () => {
                            try {
                                const data = await call('/comfyui-launcher/status');
                                if (!alive)
                                    return;
                                setState(data);
                                setError('');
                            }
                            catch (err) {
                                if (alive)
                                    setError(err && err.message ? err.message : String(err));
                            }
                            if (alive)
                                timer = window.setTimeout(tick, 5000);
                        };
                        tick();
                        return () => {
                            alive = false;
                            window.clearTimeout(timer);
                        };
                    }, []);

                    const act = async (kind) => {
                        if (busy !== '')
                            return;
                        setBusy(kind);
                        setError('');
                        try {
                            const data = await call(`/comfyui-launcher/${kind}`, { method: 'POST' });
                            if (kind === 'start' && data && data.ok === true) {
                                setState((prev) => Object.assign({}, prev || {}, {
                                    ok: true,
                                    running: true,
                                    managed: true,
                                    foreign: false,
                                    pid: data.pid,
                                    uptimeMs: 0,
                                    url: data.url,
                                    logPath: data.logPath,
                                    device: data.device,
                                    comfyuiVersion: data.comfyuiVersion,
                                }));
                            }
                            if (kind === 'stop' && data && data.ok === true) {
                                setState((prev) => Object.assign({}, prev || {}, {
                                    ok: true,
                                    running: false,
                                    managed: false,
                                    foreign: false,
                                    pid: undefined,
                                    uptimeMs: undefined,
                                    latencyMs: undefined,
                                }));
                            }
                        }
                        catch (err) {
                            setError(err && err.message ? err.message : String(err));
                        }
                        finally {
                            setBusy('');
                        }
                    };

                    const toggleLog = async () => {
                        if (showLog) {
                            setShowLog(false);
                            return;
                        }
                        setShowLog(true);
                        try {
                            const data = await call('/comfyui-launcher/logs?lines=60');
                            setLog(data);
                        }
                        catch (err) {
                            const message = err && err.message ? err.message : String(err);
                            setLog({ ok: false, lines: [], error: message });
                        }
                    };

                    const running = state !== null && state.running === true;
                    const busyLifecycle = busy === 'start' || busy === 'stop';
                    const statusLabel = state === null
                        ? t('unknown')
                        : running ? t('running') : t('stopped');
                    const statusColor = running
                        ? 'var(--dsw-alias-state-success-primary)'
                        : state === null
                            ? 'var(--dsw-alias-state-warn-primary)'
                            : 'var(--dsw-alias-state-idle-primary)';

                    const rows = [];
                    if (running) {
                        if (typeof state.url === 'string' && state.url !== '')
                            rows.push(metaRow(t('address'), state.url));
                        if (typeof state.pid === 'number')
                            rows.push(metaRow(t('pid'), `#${state.pid}`));
                        if (typeof state.uptimeMs === 'number' && state.uptimeMs > 0)
                            rows.push(metaRow(t('uptime'), formatDuration(state.uptimeMs)));
                        if (typeof state.comfyuiVersion === 'string' && state.comfyuiVersion !== '')
                            rows.push(metaRow(t('version'), state.comfyuiVersion));
                        if (state.device && typeof state.device === 'object') {
                            const vram = formatBytes(state.device.vramTotalBytes);
                            const gpu = `${state.device.name || 'GPU'}${vram !== '' ? ` · ${vram}` : ''}`;
                            rows.push(metaRow(t('device'), gpu));
                        }
                    }
                    if (state !== null && typeof state.logPath === 'string' && state.logPath !== '')
                        rows.push(metaRow(t('logPath'), state.logPath));

                    const dot = h('span', {
                        style: {
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: statusColor,
                            display: 'inline-block',
                        },
                    });
                    const statusText = h('span', {
                        style: { fontSize: '13px', lineHeight: '18px', fontWeight: 600 },
                    }, statusLabel);
                    const refreshHint = h('span', {
                        style: {
                            marginLeft: 'auto',
                            fontSize: '11px',
                            color: 'var(--dsw-alias-label-secondary)',
                        },
                    }, t('autoRefresh'));
                    const statusRow = h('div', {
                        style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
                    }, dot, statusText, refreshHint);

                    const metaBlock = rows.length > 0
                        ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, rows)
                        : null;
                    const errorBlock = error !== ''
                        ? h('p', {
                            role: 'alert',
                            style: {
                                margin: 0,
                                fontSize: '12px',
                                lineHeight: '18px',
                                color: 'var(--dsw-alias-state-error-primary)',
                            },
                        }, `${t('requestFailed')}：${error}`)
                        : null;
                    const foreignBlock = state !== null && state.foreign === true
                        ? h('p', {
                            style: {
                                margin: 0,
                                fontSize: '12px',
                                lineHeight: '18px',
                                color: 'var(--dsw-alias-state-warn-primary)',
                            },
                        }, t('foreign'))
                        : null;

                    const startButton = h('button', {
                        type: 'button',
                        disabled: busyLifecycle || running,
                        onClick: () => { void act('start'); },
                        style: buttonStyle(true, busyLifecycle || running),
                    }, busy === 'start' ? t('starting') : t('start'));
                    const stopButton = h('button', {
                        type: 'button',
                        disabled: busyLifecycle || !running,
                        onClick: () => { void act('stop'); },
                        style: buttonStyle(false, busyLifecycle || !running),
                    }, busy === 'stop' ? t('stopping') : t('stop'));
                    const logButton = h('button', {
                        type: 'button',
                        onClick: () => { void toggleLog(); },
                        style: buttonStyle(false, false),
                    }, showLog ? t('hideLogs') : t('showLogs'));
                    const buttonRow = h('div', {
                        style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
                    }, startButton, stopButton, logButton);

                    const card = h('div', {
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            padding: '14px 16px',
                            border: '1px solid var(--dsw-alias-border-l1)',
                            borderRadius: '10px',
                            background: 'var(--dsw-alias-bg-layer-1)',
                        },
                    }, statusRow, metaBlock, errorBlock, foreignBlock, buttonRow);

                    const header = h('header', null,
                        h('h2', {
                            style: { margin: 0, fontSize: '16px', lineHeight: '24px', fontWeight: 600 },
                        }, t('title')),
                        h('p', {
                            style: {
                                margin: '4px 0 0',
                                fontSize: '12px',
                                lineHeight: '18px',
                                color: 'var(--dsw-alias-label-secondary)',
                            },
                        }, t('subtitle')));

                    const logLines = log !== null && Array.isArray(log.lines) ? log.lines : [];
                    const logText = logLines.length > 0 ? logLines.join('\n') : t('emptyLog');
                    const logCaption = log !== null && typeof log.logPath === 'string' && log.logPath !== ''
                        ? log.logPath
                        : t('logPath');
                    const logPanel = showLog
                        ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                            h('div', {
                                style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '12px',
                                    color: 'var(--dsw-alias-label-secondary)',
                                    wordBreak: 'break-all',
                                },
                            }, logCaption),
                            h('pre', {
                                style: {
                                    margin: 0,
                                    maxHeight: '260px',
                                    overflow: 'auto',
                                    padding: '10px 12px',
                                    border: '1px solid var(--dsw-alias-border-l1)',
                                    borderRadius: '8px',
                                    background: 'var(--dsw-alias-bg-layer-2)',
                                    color: 'var(--dsw-alias-label-secondary)',
                                    fontSize: '11px',
                                    lineHeight: '16px',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all',
                                },
                            }, logText))
                        : null;

                    return h('section', {
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '14px',
                            padding: '8px 0 24px',
                            maxWidth: '760px',
                            color: 'var(--dsw-alias-label-primary)',
                        },
                    }, header, card, logPanel);
                }

                if (window.__DSH_COMFY_SUITE__) {
                    // dsh-comfy-suite: the suite renders this panel inside its
                    // single settings page, so only hand it over.
                    (window.__DSH_SUITE_UI__ = window.__DSH_SUITE_UI__ || {}).launcher = { Panel };
                } else {
                    ctx.slots.inject('settings.section', () => ctx.slots.register({
                        name: 'settings.section',
                        id: 'comfyui-launcher',
                        order: 60,
                        label: () => ctx.locale.bind(NS)('title'),
                    }, Panel));
                }
            },
        };
    },
});