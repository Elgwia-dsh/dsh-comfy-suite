/**
 * dsh-comfy-suite host configuration.
 *
 * Three blocks, one entry:
 *   · `comfyui`    — the real dsh-comfyui schema. Kept as the original
 *                    Schemastery object so its `.volatile()` fields keep working:
 *                    a settings-page save is committed straight into the running
 *                    references by the Loader, without restarting the plugin.
 *   · `launcher`   — passed through verbatim; the launcher merges its own
 *                    DEFAULTS, so restating every field here would only drift.
 *   · `qwenPaint`  — passed through verbatim; dsh-qwen-paint merges DEFAULTS and
 *                    persists its own UI preferences, so it needs no schema here.
 */
import z from '@deepseek-ai/schemastery';
import { Config as ComfyUIConfig } from '../vendor/comfyui/lib/config.js';

export const Config = z.object({
    comfyui: ComfyUIConfig,
    launcher: z.any().default({}),
    qwenPaint: z.any().default({}),
});