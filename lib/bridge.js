/**
 * The one wire between the suite shell and the vendored child plugins.
 *
 * The child plugins were written as standalone Loader entries, so each of them
 * persisted settings through the Loader's settings service keyed by its own
 * entry id (`comfyui`, `comfyui-launcher`, `qwen-paint`). After the merge there
 * is exactly one entry (`comfy-suite`), so a child that still called
 * `settings.update('comfyui', …)` would fail with "No configurable plugin
 * entry". The shell installs `update` here and the children call through it.
 *
 * `register` / `refresh` close the other loop: the Loader commits a volatile
 * change into the running references but emits `loader/volatile-update` on the
 * entry fiber only, which a child fiber never sees. Children register a refresh
 * callback; the shell fans the event out.
 */
const listeners = new Map();

/** Installed by the shell so children can write into the boot receipt. */
let reporter = () => { };

export const suiteBridge = {
    /** Install the shell's receipt writer; returns a disposer. */
    onReport(fn) {
        reporter = typeof fn === 'function' ? fn : () => { };
        return () => {
            if (reporter === fn) reporter = () => { };
        };
    },

    /** Append one line to the suite's boot receipt (never throws). */
    report(message) {
        try {
            reporter(String(message));
        } catch {
            // A receipt must never break a plugin's own apply().
        }
    },

    /** Installed by the shell once the settings service is available. */
    update: async () => ({ ok: false, error: '设置服务尚未就绪（headless 或启动中），请改用 cordis.patch.yml 修改配置' }),

    /** Register a child's "re-resolve my config" callback. */
    register(key, fn) {
        listeners.set(key, fn);
        return () => {
            if (listeners.get(key) === fn) listeners.delete(key);
        };
    },

    /** Ask one child to re-read its config references. */
    refresh(key) {
        const fn = listeners.get(key);
        if (typeof fn !== 'function') return;
        // A child that throws while re-resolving must not make an already
        // committed settings write look rejected, nor stop the other children.
        try {
            fn();
        } catch (error) {
            suiteBridge.report(`refresh ${key} failed: ${error?.message ?? error}`);
        }
    },

    /** Ask every child to re-read its config references. */
    refreshAll() {
        for (const [key, fn] of [...listeners.entries()]) {
            try {
                fn();
            } catch (error) {
                suiteBridge.report(`refresh ${key} failed: ${error?.message ?? error}`);
            }
        }
    },
};