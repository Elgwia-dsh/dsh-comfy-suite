/* ==========================================================================
 * 合并后的唯一入口
 * ======================================================================= */
window.__ModuleLoader__.load({
    id: 'dsh-comfy-suite',
    factory(require) {
        var React = require('react');
        var table = window.__DSH_SUITE_MODULES__ || {};
        var cache = {};

        /** 物化一个被收编的 client bundle（它们只依赖 react）。 */
        function materialize(id) {
            if (Object.prototype.hasOwnProperty.call(cache, id)) return cache[id];
            var factory = table[id];
            if (typeof factory !== 'function') {
                throw new Error('dsh-comfy-suite: client module "' + id + '" was not registered');
            }
            var module = { exports: {} };
            var result = factory(function childRequire(spec) {
                if (spec === 'react') return React;
                throw new Error('dsh-comfy-suite: module "' + id + '" requires unsupported dependency "' + spec + '"');
            });
            var exports = result === undefined ? module.exports : result;
            cache[id] = exports;
            return exports;
        }

        var PLATFORM_LANG = 'zh';

        function uiLang() {
            var ui = window.__DSH_SUITE_UI__ || {};
            var comfy = ui.comfyui;
            try {
                if (comfy && typeof comfy.getLang === 'function') return comfy.getLang();
            } catch (error) {
                /* fall through */
            }
            return PLATFORM_LANG;
        }

        function suiteLabel() {
            return uiLang() === 'en' ? 'ComfyUI Suite' : 'ComfyUI 套件';
        }

        /** 五个 tab 的设置页：工作流与生成 / 作品库 / 风格库 / 提示词衣柜 / 服务启停。 */
        function SuiteSettings(props) {
            var ui = window.__DSH_SUITE_UI__ || {};
            var comfyUi = ui.comfyui;
            var launcherUi = ui.launcher;
            var galleryUi = ui.gallery;
            var lang = uiLang();

            var tabs = [];
            if (comfyUi) tabs.push({ id: 'comfyui', label: lang === 'en' ? 'Workflows & generation' : '工作流与生成' });
            if (galleryUi) tabs.push({ id: 'gallery', label: lang === 'en' ? 'Gallery' : '作品库' });
            if (galleryUi) tabs.push({ id: 'presets', label: lang === 'en' ? 'Style library' : '风格库' });
            if (galleryUi && typeof galleryUi.Wardrobe === 'function') {
                tabs.push({ id: 'wardrobe', label: lang === 'en' ? 'Prompt wardrobe' : '提示词衣柜' });
            }
            if (launcherUi) tabs.push({ id: 'launcher', label: lang === 'en' ? 'Server' : '服务启停' });

            var first = tabs.length > 0 ? tabs[0].id : '';
            var state = React.useState(first);
            var active = state[0];
            var setActive = state[1];
            var known = false;
            for (var i = 0; i < tabs.length; i += 1) if (tabs[i].id === active) known = true;
            if (!known) active = first;

            var body;
            if (active === 'comfyui' && comfyUi) {
                var t = typeof comfyUi.makeT === 'function' ? comfyUi.makeT(lang) : function (key) { return key; };
                body = React.createElement(comfyUi.Settings, Object.assign({}, props, { t: t }));
            } else if (active === 'gallery' && galleryUi && typeof galleryUi.Gallery === 'function') {
                body = React.createElement(galleryUi.Gallery, props);
            } else if (active === 'presets' && galleryUi && typeof galleryUi.Presets === 'function') {
                body = React.createElement(galleryUi.Presets, props);
            } else if (active === 'wardrobe' && galleryUi && typeof galleryUi.Wardrobe === 'function') {
                body = React.createElement(galleryUi.Wardrobe, props);
            } else if (active === 'launcher' && launcherUi) {
                body = React.createElement(launcherUi.Panel, props);
            } else {
                body = React.createElement('div', {
                    style: { padding: '16px 0', color: 'var(--dsw-alias-label-secondary)', fontSize: '13px' },
                }, lang === 'en' ? 'No settings available yet.' : '设置项还没就绪（插件可能仍在加载）。');
            }

            var bar = React.createElement('div', {
                role: 'tablist',
                style: {
                    display: 'flex',
                    gap: '2px',
                    borderBottom: '1px solid var(--dsw-alias-border-l1)',
                    marginBottom: '18px',
                },
            }, tabs.map(function (tab) {
                var selected = tab.id === active;
                return React.createElement('button', {
                    key: tab.id,
                    type: 'button',
                    role: 'tab',
                    'aria-selected': selected,
                    onClick: function () { setActive(tab.id); },
                    style: {
                        appearance: 'none',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        padding: '8px 14px',
                        font: 'inherit',
                        fontSize: '13px',
                        lineHeight: '18px',
                        color: selected ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
                        borderBottom: selected ? '2px solid var(--dsw-alias-brand-primary)' : '2px solid transparent',
                        marginBottom: '-1px',
                    },
                }, tab.label);
            }));

            return React.createElement('div', {
                style: { display: 'flex', flexDirection: 'column', minWidth: 0 },
            }, bar, body);
        }

        function apply(ctx) {
            var comfyui = materialize('dsh-comfyui');
            var launcher = materialize('dsh-comfyui-launcher');
            var qwenPaint = materialize('dsh-qwen-paint');
            var gallery = materialize('dsh-comfy-suite/gallery');

            if (comfyui && typeof comfyui.apply === 'function') comfyui.apply(ctx);
            if (launcher && typeof launcher.apply === 'function') launcher.apply(ctx);
            if (qwenPaint && typeof qwenPaint.apply === 'function') qwenPaint.apply(ctx);

            // 作品库/风格库没有自己的 cordis 插件：它们只是两个 React 组件，
            // 由本文件的设置页直接渲染。挂到 __DSH_SUITE_UI__ 上供 tab 判断可用性。
            if (gallery && typeof gallery === 'object') {
                (window.__DSH_SUITE_UI__ = window.__DSH_SUITE_UI__ || {}).gallery = gallery;
            }

            ctx.slots.inject('settings.section', function () {
                return ctx.slots.register({
                    name: 'settings.section',
                    id: 'comfy-suite',
                    order: 30,
                    label: suiteLabel,
                }, SuiteSettings);
            });
        }

        var exports = {};
        exports.name = 'dsh-comfy-suite';
        exports.inject = ['slots', 'locale'];
        exports.apply = apply;
        return exports;
    },
});