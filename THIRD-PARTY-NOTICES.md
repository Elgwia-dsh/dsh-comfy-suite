# 第三方代码与修改声明

本仓库是一个**个人整合项目**，不是任何上游项目的官方版本。仓库里的大部分运行代码来自三个
MIT 许可的 DSH 插件，本项目的增量是「合并成一个插件 + 一组修复 + 本地功能」。三个上游才是
各自能力的维护方；只想用其中一个功能时，请直接安装上游。

## 1. dsh-comfyui 0.5.5

- 上游：<https://github.com/fandc520/dsh-comfyui>
- 许可：MIT，全文见 `vendor/comfyui/LICENSE`
- 本仓库位置：`vendor/comfyui/`，客户端副本在 `client/_parts/vendor_comfyui_client_client.js`
- 修改：
  - `lib/index.js` 顶部引入 `suiteBridge`，`runtime.updateConfig` 改为经聚合层转发；
  - `lib/tools.js` 改为逐个注册工具并上报结果（单个工具失败不连坐整批）；
  - `lib/store.js` 改为 temp+rename 原子写、按文件串行、坏文件转存；
  - `lib/progress.js`、`lib/comfyui.js`、`lib/params.js`、`lib/http.js`、`lib/routes.js`
    的修复见 README「1.6.0：…一批真 bug」一节，每条都写了触发条件；
  - `client/client.js` 是与另外两个插件的客户端 bundle 拼接后的产物。
- 逐条说明与可复核的触发条件见本仓库 README 对应章节。

## 2. dsh-qwen-paint 0.17.13

- 优化版上游：<https://github.com/yanfei0725/dsh-qwen-paint>
- 原始作者：<https://github.com/wonderandyou/dsh-qwen-paint>（@奇迹与你）
- 许可：MIT，全文见 `vendor/qwen-paint/LICENSE`
- 本仓库位置：`vendor/qwen-paint/`，客户端副本在 `client/_parts/vendor_qwen-paint_lib_client.js`
- 修改：
  - `lib/comfy-accel.js` 的 `SAGE_READY` 赋值改为 `setSageReady()`；
  - `lib/index.js` 的闸门参数、`log?.()` 引用、`execution_interrupted` 处理、节点 schema 缓存；
  - 采样链路换成显式 9 步 sigma 表（`ManualSigmas` + `SamplerCustomAdvanced`），新增扩图；
  - 主模型支持 turbo 蒸馏 GGUF（`UnetLoaderGGUF`）；
  - 新增 `character_image` 与本地素材库索引。
- 以上修改点同时列在 README 的「9 步采样与扩图」「turbo GGUF 主模型」
  「从上游 dsh-qwen-paint 移植」等章节。

## 3. dsh-comfyui-launcher 1.0.0

- 来源：本仓库作者自行编写，未单独发布，按 MIT 随本仓库分发
- 位置：`vendor/launcher/`
- 说明：它只是「启动/停止/看日志」的薄封装，默认路径指向一个便携版 ComfyUI 安装目录，
  需要按自己的环境改 `cordis.patch.yml` 里的 `launcher.comfyuiDir` 与 `launcher.pythonPath`。

## 4. 随包依赖（vendored 在 `node_modules/`）

| 包 | 版本 | 许可 |
| --- | --- | --- |
| `@deepseek-ai/schemastery` | ^3.18.4 | MIT |
| `@deepseek-ai/cosmokit` | schemastery 的运行时依赖 | MIT |
| `fflate` | ^0.8.2 | MIT |

这三份依赖是**故意提交进仓库**的：安装脚本支持 link 与物理复制两种形态，物理复制时
Node 不会再去 profile 前缀里查找它们（详见 README「自带依赖」）。

## 5. 关于许可与署名

- 本仓库没有删除或替换任何上游的 LICENSE 文件。
- 如果你要基于本仓库再发布，请同时保留根目录的 `LICENSE`、本文件、以及
  `vendor/comfyui/LICENSE` 与 `vendor/qwen-paint/LICENSE`。
- 本仓库的增量修复如果对上游有用，欢迎由你转成对应的 PR 提交给上游仓库——那比维护
  一份整合快照更有价值。