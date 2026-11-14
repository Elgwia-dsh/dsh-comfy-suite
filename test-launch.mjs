/**
 * test-launch.mjs — 零窗口启动的纯函数测试。
 *
 * 这里不真的拉起 ComfyUI（那要 45 秒，还会占显存）；只把**生成物**钉住：
 * 批处理的编码/引号/环境变量、VBS 的 SW_HIDE 语义、以及 pid 存活判断。
 * 真机启动路径由 README 的「启动行为」小节描述，人工用 `draw_image` 复核。
 */
import assert from 'node:assert/strict'
import {
    HIDDEN_VBS,
    buildWindowsBatch,
    findComfyPid,
    isProcessAlive,
} from './lib/hidden-launch.js'

let passed = 0
function check(name, fn) {
    try {
        fn()
        passed += 1
        console.log(`ok   ${name}`)
    } catch (error) {
        console.error(`FAIL ${name}\n     ${error.message}`)
        process.exitCode = 1
    }
}

check('batch: CRLF + chcp 65001 + UTF-8 中文路径', () => {
    const text = buildWindowsBatch({
        python: 'D:/dsh-video/a/python_embeded/python.exe',
        args: ['D:/dsh-video/a/ComfyUI/main.py', '--listen', '127.0.0.1'],
        workdir: 'D:/dsh-video/a/ComfyUI',
        logPath: 'D:/dsh-video/a/ComfyUI/.dshqp-launch.log',
    })
    assert.ok(text.includes('\r\n'), 'must use CRLF (cmd mis-parses LF-only batches)')
    assert.ok(!/[^\r]\n/.test(text), 'no bare LF allowed')
    assert.ok(text.startsWith('@echo off\r\nchcp 65001 >nul\r\n'), 'UTF-8 code page first')
    assert.ok(text.includes('cd /d "D:/dsh-video/a/ComfyUI"'), 'changes into the install dir')
    assert.ok(
        text.includes('"D:/dsh-video/a/python_embeded/python.exe" "D:/dsh-video/a/ComfyUI/main.py" "--listen" "127.0.0.1"'),
        'python + every argument quoted individually',
    )
    assert.ok(text.includes('> "D:/dsh-video/a/ComfyUI/.dshqp-launch.log" 2>&1'), 'redirects both streams')
})

check('batch: 中文/空格路径与 env 注入', () => {
    const text = buildWindowsBatch({
        python: 'C:/工具 目录/python.exe',
        args: ['C:/工具 目录/main 脚本.py'],
        workdir: 'C:/工具 目录',
        logPath: 'C:/工具 目录/日志.log',
        env: [
            ['HIP_VISIBLE_DEVICES', '0'],
            ['PYTHONIOENCODING', 'utf-8'],
        ],
    })
    assert.ok(text.includes('set "HIP_VISIBLE_DEVICES=0"'))
    assert.ok(text.includes('set "PYTHONIOENCODING=utf-8"'))
    assert.ok(text.includes('"C:/工具 目录/python.exe"'))
    // 引号不能被路径/环境值带进批处理（会破坏解析）
    assert.ok(!text.includes('""C:/'), 'no doubled quotes around paths')
})

check('vbs: ASCII 源 + SW_HIDE + 参数化路径', () => {
    assert.ok(/^[\x00-\x7F]*$/.test(HIDDEN_VBS), 'VBS must stay pure ASCII')
    assert.ok(HIDDEN_VBS.includes('WScript.Arguments(0)'), 'batch path travels as an argument')
    assert.ok(HIDDEN_VBS.includes('sh.Run "cmd.exe /c """ & cmdPath & """", 0, False'), 'SW_HIDE (0) + no wait')
    assert.ok(HIDDEN_VBS.includes('Option Explicit'))
})

check('pid: 0/负数不算存活，本进程算存活', () => {
    assert.equal(isProcessAlive(0), false)
    assert.equal(isProcessAlive(-1), false)
    assert.equal(isProcessAlive(process.pid), true)
})

const detectedPid = await findComfyPid()
check('findComfyPid: 非 Windows 返回 0，Windows 返回安全整数', () => {
    assert.equal(typeof detectedPid, 'number')
    assert.ok(Number.isSafeInteger(detectedPid) && detectedPid >= 0, 'pid must be a safe non-negative integer')
})

console.log(`\n${passed} checks passed${process.exitCode ? ' — WITH FAILURES' : ''}`)