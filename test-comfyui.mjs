/**
 * 宿主侧纯函数回归：ComfyUI 客户端里那些"决定错误长什么样"的小函数。
 *
 * 为什么单独一个文件：这些函数是**用户唯一能看到的东西**——一次 400 的
 * `node_errors` 如果渲染成整段 JSON，模型与用户都读不出该改什么。
 */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
    formatValidationFailure,
    guessContentType,
    hasMedia,
} from './vendor/comfyui/lib/comfyui.js';

const cases = [];
async function check(name, fn) {
    await fn();
    cases.push(name);
    console.log(`  ok   ${name}`);
}

await check('formatValidationFailure: 把 node_errors 拆成「节点 / 类名 / 细节」', () => {
    const error = {
        payload: {
            error: { type: 'prompt_outputs_failed_validation' },
            node_errors: {
                1: {
                    class_type: 'UNETLoader',
                    errors: [
                        { type: 'value_not_in_list', message: 'Value not in list', details: "unet_name: 'Z-Image\\x.safetensors' not in []" },
                    ],
                },
                7: {
                    class_type: 'KSampler',
                    errors: [{ type: 'value_smaller_than_min', message: 'Value 0 smaller than min of 1' }],
                },
            },
        },
    };
    const text = formatValidationFailure(error);
    assert.equal(typeof text, 'string');
    assert.match(text, /节点 1 \(UNETLoader\)/);
    assert.match(text, /unet_name/);
    assert.match(text, /节点 7 \(KSampler\)/);
    assert.match(text, /2 处需要修正/);
    assert.match(text, /comfyui_object_info/);
});

await check('formatValidationFailure: 非校验类错误返回 undefined（保留原始错误）', () => {
    assert.equal(formatValidationFailure(new Error('boom')), undefined);
    assert.equal(formatValidationFailure({ payload: { error: 'x' } }), undefined);
    assert.equal(formatValidationFailure({ payload: { node_errors: {} } }), undefined);
});

await check('formatValidationFailure: 条目错误过多时截断，不把整页 JSON 塞进上下文', () => {
    const nodeErrors = {};
    for (let i = 0; i < 30; i += 1) {
        nodeErrors[i] = { class_type: 'X', errors: [{ message: 'bad' }] };
    }
    const text = formatValidationFailure({ payload: { node_errors: nodeErrors } });
    assert.match(text, /30 处需要修正/);
    assert.match(text, /还有 18 处/);
});

await check('hasMedia: 认图片/视频/GIF/音频，空输出不算', () => {
    assert.equal(hasMedia({ outputs: {} }), false);
    assert.equal(hasMedia({ outputs: { 9: { images: [{ filename: 'a.png' }] } } }), true);
    assert.equal(hasMedia({ outputs: { 9: { videos: [{ filename: 'a.mp4' }] } } }), true);
    assert.equal(hasMedia({ outputs: { 9: { gifs: [{ filename: 'a.gif' }] } } }), true);
    assert.equal(hasMedia({ outputs: { 9: { audio: [{ filename: 'a.wav' }] } } }), true);
    assert.equal(hasMedia({ outputs: { 9: { text: ['hi'] } } }), false);
});

await check('guessContentType: 常见媒体后缀', () => {
    assert.equal(guessContentType('a.PNG'), 'image/png');
    assert.equal(guessContentType('a.webp'), 'image/webp');
    assert.equal(guessContentType('a.mp4'), 'video/mp4');
    assert.equal(guessContentType('a.wav'), 'audio/wav');
    assert.equal(guessContentType('a.bin'), 'application/octet-stream');
});

// ── 实时进度：WebSocket 事件 → snapshot ────────────────────────────────
// 这是面板标题栏与任务页的数据源，纯内存、可完全用假事件驱动。
const { ProgressTracker } = await import('./vendor/comfyui/lib/progress.js');

await check('ProgressTracker: executing/progress 事件组成运行视图', () => {
    const tracker = new ProgressTracker();
    const prompt = 'p-1';
    tracker.onMessage(JSON.stringify({ type: 'status', data: { status: { exec_info: { queue_remaining: 2 } } } }));
    tracker.onMessage(JSON.stringify({ type: 'execution_start', data: { prompt_id: prompt } }));
    tracker.onMessage(JSON.stringify({ type: 'executing', data: { prompt_id: prompt, node: '12' } }));
    tracker.onMessage(JSON.stringify({ type: 'progress', data: { prompt_id: prompt, node: '12', value: 1, max: 4 } }));
    const first = tracker.snapshot(prompt);
    assert.equal(first.state, 'running');
    assert.equal(first.value, 1);
    assert.equal(first.max, 4);
    assert.equal(first.node, '12');
    assert.equal(tracker.queueRemaining, 2);
    // 第一步刚完成，还测不出速度 —— 不瞎猜 ETA。
    assert.equal(first.etaMs, null);
    // 第二步：速度 = (t2-t1)/1 ≈ 4 s/步，ETA = 速度 × 剩余 2 步 ≈ 8 s。
    tracker.progress.get(prompt).firstStepAt = Date.now() - 4000;
    tracker.onMessage(JSON.stringify({ type: 'progress', data: { prompt_id: prompt, node: '12', value: 2, max: 4 } }));
    const second = tracker.snapshot(prompt);
    assert.equal(second.value, 2);
    assert.ok(second.etaMs !== null && second.etaMs > 7_000 && second.etaMs < 9_000, `eta was ${second.etaMs}`);
});

await check('ProgressTracker: 换节点会清掉上一步的步数，不会串档', () => {
    const tracker = new ProgressTracker();
    const prompt = 'p-2';
    tracker.onMessage(JSON.stringify({ type: 'executing', data: { prompt_id: prompt, node: '12' } }));
    tracker.onMessage(JSON.stringify({ type: 'progress', data: { prompt_id: prompt, node: '12', value: 9, max: 9 } }));
    assert.equal(tracker.snapshot(prompt).value, 9);
    tracker.onMessage(JSON.stringify({ type: 'executing', data: { prompt_id: prompt, node: '16' } }));
    assert.equal(tracker.snapshot(prompt).value, null);
    assert.equal(tracker.snapshot(prompt).state, 'running');
});

await check('ProgressTracker: 终态事件收敛（成功/失败/中断），并清掉进度条', () => {
    const tracker = new ProgressTracker();
    const fail = 'p-fail';
    tracker.onMessage(JSON.stringify({ type: 'execution_start', data: { prompt_id: fail } }));
    tracker.onMessage(JSON.stringify({ type: 'progress', data: { prompt_id: fail, value: 1, max: 4 } }));
    tracker.onMessage(JSON.stringify({ type: 'execution_error', data: { prompt_id: fail, exception_message: 'CUDA out of memory' } }));
    const failed = tracker.snapshot(fail);
    assert.equal(failed.state, 'failed');
    assert.match(failed.error ?? '', /CUDA out of memory/);
    assert.equal(tracker.settlement(fail)?.state, 'failed');

    const ok = 'p-ok';
    tracker.onMessage(JSON.stringify({ type: 'execution_start', data: { prompt_id: ok } }));
    tracker.onMessage(JSON.stringify({ type: 'execution_success', data: { prompt_id: ok } }));
    assert.equal(tracker.snapshot(ok).state, 'completed');
    assert.ok(tracker.snapshot(ok).endedAt !== null);

    const stopped = 'p-stop';
    tracker.onMessage(JSON.stringify({ type: 'execution_interrupted', data: { prompt_id: stopped } }));
    assert.equal(tracker.snapshot(stopped).state, 'interrupted');
    // 未知 prompt 不编造状态。
    assert.equal(tracker.snapshot('nope').state, null);
});

await check('ProgressTracker: 非 progress 文本/坏 JSON/二进制帧都不会抛错', () => {
    const tracker = new ProgressTracker();
    tracker.onMessage('not json');
    tracker.onMessage(JSON.stringify({ type: 'whatever', data: {} }));
    tracker.onMessage(new Uint8Array([1, 2, 3]));
    tracker.onMessage(JSON.stringify({ type: 'progress', data: { prompt_id: 'x', value: 'a', max: 2 } }));
    assert.equal(tracker.snapshot('x').state, null);
});

console.log(`\n${cases.length}/${cases.length} 通过`);
void fileURLToPath;