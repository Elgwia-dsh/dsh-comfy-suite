/**
 * dsh-comfy-suite — 客户端半边（合并包）
 * ============================================================================
 * 把三个插件的 client bundle 收进同一个文档：它们的 factory 不再各自向
 * `window.__ModuleLoader__` 注册一个新的包 id，而是先收集到本文件的私有表里，
 * 由本包唯一的 factory 按需物化。这样 DSH 的启动图里只有 `dsh-comfy-suite`
 * 一个 row —— 与宿主侧「一个 Loader 条目」对齐，也避开了同一包多 row 时
 * 「duplicate factory registration」的硬错误。
 *
 * 收编的三份：
 *   · dsh-comfyui          —— 工作流面板、生成卡片、ComfyUI 设置页
 *   · dsh-comfyui-launcher —— 「ComfyUI 服务」设置页（启停/日志）
 *   · dsh-qwen-paint       —— draw_image 卡片、composer 状态点
 *
 * 设置页合并：两个子 bundle 在 `__DSH_COMFY_SUITE__` 为真时不再各自注册
 * `settings.section`，而是把面板挂到 `__DSH_SUITE_UI__` 上；本文件末尾用一个
 * 带两个 tab 的 section 渲染它们。
 */
window.__DSH_COMFY_SUITE__ = true;
window.__DSH_SUITE_MODULES__ = window.__DSH_SUITE_MODULES__ || {};
window.__DSH_SUITE_UI__ = window.__DSH_SUITE_UI__ || {};

/** 收集一个 bundle 的 factory（取代 `window.__ModuleLoader__.load`）。 */
function __dshSuiteRegister(registration) {
    window.__DSH_SUITE_MODULES__[registration.id] = registration.factory;
}