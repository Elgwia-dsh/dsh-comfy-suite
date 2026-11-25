# 更新说明（Changelog）

这个文件只放 **更新记录**。插件是什么、怎么装、怎么用，看 [README.md](README.md)。

- 版本号以 `package.json` 为准，日期是发布日。
- 每条只写「用户能感知的变化 / 修掉的 bug / 回归测试」；纯内部重构合并成一条。
- 1.6.4 起执行「README 只写说明与效果图，更新一律写在这里」的约定；更早的记录从当时的 README 原样搬来。

---

## 1.6.4 — 2026-11-25：工具说明书跟着配置走，默认配置跟着模型走

主线是 2026-11-24 把主模型换成完整版 int8 之后留下的一批「说明书比系统旧」的问题 ——
代码没崩，但模型照着旧文案办事，出图能力和默认配置都没跟上。

### draw_image 的 steps / negative 说明改为按配置生成

`steps` 的说明一直是 10 月蒸馏链路写的：「turbo8 八步蒸馏下本参数**会被忽略**、强制 8 步」。
主模型换成完整版、`forceTurbo8Steps: false` 之后这句话**不成立** —— `steps` 是真正生效的旋钮。
`negative` 同理（旧文案说"cfg=1，负面词基本不生效"，而原生链路 CFG=3，负面词有效）。
模型读到旧文案会主动不用这两个参数：配置升级了，出图能力却没跟上。

- 新增 `drawParameters(cfg)`：按当前配置生成 `steps` / `negative` 的说明（原生链路默认步数、
  `forceTurbo8Steps` 的实际状态、当前 CFG）；`PARAMETERS` 本身不动，schema 形状与既有断言不受影响。
- 捏人工具的 `negative` 说明同步改成「原生链路 CFG>1 有效 / turbo 链路 CFG=1 基本无效」。

### 捏人：能力探测失败时不再默认按 turbo 跑

`character_image` 旧写法 `useTurbo = plan === null || plan.useTurbo !== false`：`object_info`
超时（网络抖动）时 `plan` 为 null，于是**完整版模型被按 9 步 sigma 表 + CFG 1 采样** —— 画面发糊、
而且没有任何提示。现在退回配置里的静态事实：只有 `turboBakedModel: true` 且没关 turbo，才在探测失败时
按 turbo 跑；其余情况走原生链路（慢一点但对），并记一条 warn。原生分支的 `steps / cfg` 也从写死的
`25 / 2.5` 改成 `plan.steps / plan.cfgScale`（与 draw_image 同源），探测不到才退回 `baseSteps / baseCfg`。

### 默认 patch 不再指向已删除的 turbo GGUF

包内 `cordis.patch.yml` 的默认主模型还写着 `Qwen-Image-2.1-Turbo-AD-Q6_K.gguf` + `turboBakedModel: true`
+ 8 步锁。那个文件 2026-11-24 已从磁盘删除，新装（或配置被重置）会直接「模型不存在」。现在默认改为
完整版 `qwen_image_2.1_int8_convrot.safetensors` + `baseSteps 25 / baseCfg 3`，并显式
`turbo8Enabled: false`（默认部署里没有 Qwen 的 turbo LoRA，开着只会在探测出错时误判）。
示例路径同时改成中性的 `D:/ComfyUI` 布局 —— 原来那份带着作者机器的实际安装路径。

### 工作流列表：过滤命中数与目录聚合

- 带 `filter` 时列表头原来报的是**全库条数**（"共 224 个，列出 5 个"），实际命中只有 33 个 ——
  模型会误判"还有一百多个能翻"。现在写成「全库 224 个，命中 33 个」。
- 图工作流一大（测试机 224 个、多层目录）逐条扫不现实：列表多一行**按顶层目录聚合的条数**，
  模型据此用 `filter: "目录名"` 收窄，比反复加大 `limit` 省 token。

### 诊断日志轮转

`qwen-paint-status.log` 按「状态变化 / 每 60 秒」追加一行，但一直没有上限：挂机两天就 1.1 MB。
现在超过 512 KB 只保留最后 300 行再追加（与 `boot.log` 同一口径），诊断不会被几万行同质记录淹没。

**回归**：`test-sampling.mjs` +3（drawParameters 两条链路口径、schema 形状不变），
`test-comfyui.mjs` +2（目录聚合、列表渲染的命中数 / 目录行 / 预检行）。宿主侧改动需重启 DSH 生效。

---

## 1.6.3 — 2026-11-22：ComfyUI 拉不起来时，先问一句"这个端口能不能绑"

**症状**（2026-11-21 真机）：点「启动服务」或 `draw_image` 冷启动，ComfyUI 每次都"启动 → 立刻退出"，
面板只报「ComfyUI 进程启动后立即退出，检查日志」；真因藏在日志最底下：

```
PermissionError: [Errno 13] error while attempting to bind on address ('127.0.0.1', 8188)
  : [winerror 10013] 以一种访问权限不允许的方式做了一个访问套接字的尝试
```

三个子插件（`comfyui.baseUrl` / `launcher.port` / `qwenPaint.comfyUrl`）各自拿着配置里的 8188，
于是一处端口不可用，14 个工具全废。

**根因**：`10013` 不是"端口被占"（那是 `10048`），而是**端口被系统保留** —— WinNAT / Hyper-V 会在
动态端口区间里预留成段端口（测试机上 8188 正好落在 8128–8227 这段里）。这类预留要管理员改、
还要重启；普通权限唯一的出路是换一个区间外的端口。

**修复**（新增 `lib/ports.js`，三条调用点一起用）：

- **启动前预检**（`lib/hidden-launch.js`）：拉起进程前先真的 bind 一次。绑不上就直接返回
  「端口 N 被系统保留或拒绝绑定（Windows WinError 10013）」+ 一条能照做的建议，不再空等
  180 秒、也不再让 ComfyUI 白崩一次。端口上已经有 ComfyUI 应答时判为 `EALREADYUP`（"已经在运行"），
  不算失败。
- **失败归因**（`vendor/launcher/index.js`）：进程"起来又立刻没了"时，从日志尾部认出 `10013` / `10048`，
  把原因写进工具结果（面板与 `comfyui_server` 都能看到），而不是只丢一句"检查日志"。
- **端口体检**（`lib/index.js`）：激活时先算一次"这次到底用哪个端口" —— 可用就原样下发（零行为变化）；
  被系统保留或被别的程序占用就往后找一个能绑的，并把**同一个结论写进三块配置**（只改一块会留下
  "一半工具能用"这种最难查的状态）。指到别处的块（另一台机器 / 另一套部署）不碰。体检本身出错时
  退回原配置、只记一行 `boot.log`：一个体检不该比被体检的东西更脆。

**如实说明代价**：换端口是**运行期**决定，不写回配置 —— 配置表达的仍是"我想用哪个端口"。
换端口后 `boot.log` 会有一行 `ports: 8188 → 8189 — …`，`comfyui_server status` 也会给出
`换端口：配置写的是 8188，实际用 http://127.0.0.1:8189`；要用浏览器直连 ComfyUI 时按这一行改地址。

**回归**：`test-launch.mjs` 新增 15 条端口 / 预检纯函数断言（EACCES 换端口、EADDRINUSE 但应答的是
ComfyUI 时不换、整段被保留时如实报告、traceback 归因、三块对齐、`EALREADYUP`）；`test-host.mjs`
新增一条端到端断言：占住配置端口后，三个子插件拿到的必须是同一个新端口。

---

## 1.6.2 — 2026-11-17：ComfyUI 没启动时，点开面板不再报错

**症状**：ComfyUI 没运行（最常见的情况）时点标题栏的「ComfyUI 面板」，整个面板刚打开就被关掉，
页面顶部弹出一条通栏错误：「后端未能连上 ComfyUI（fetch failed（探测地址 http://127.0.0.1:8188））……」。
用户看到的是"插件坏了"，而不是"服务没开"。

**根因**：`connection` 探测把"连不上"当成致命错误处理——`panelStore.close()` 关面板，
再渲染一条页面级 toast；`fetch failed` 是 Node `fetch` 的传输层文案，被原样搬上了界面。
可面板里的工作流库、作品库、设置页都是本地数据，后端离线完全不影响它们。

**修复**：

- **面板不再关**：探测失败只改状态，不碰 `panelStore`。离线时面板照常打开、照常能看能导工作流。
- **错误条换成面板内提示**：标题栏下面多一条 `ComfyUI 未启动` 的横幅（工作流/资产/队列哪一页都在），
  带 **启动服务**（POST `/comfyui-launcher/start`，就绪后横幅自动消失）和 **重新检测** 两个按钮；
  不再是页面顶部那条通栏报错，也不再出现 `fetch failed` 字样。
- **宿主侧分级**（`vendor/comfyui/lib/routes.js`）：`POST /comfyui/test` 现在一并返回
  `offline`（`ECONNREFUSED`/`ETIMEDOUT` 等套接字层判定）、`code`、`reason`、`baseUrl`；
  客户端据此把"没启动"和"地址/鉴权配错"分开说。老客户端/老宿主都兼容（客户端也会自己识别 `fetch failed`）。
- **面板块里的原始报错一起收口**：工作流页的「ComfyUI 工作流」、队列页、标题栏状态条在离线时
  分别显示「ComfyUI 未启动，启动后这里会列出服务端保存的工作流」「ComfyUI 未启动，队列里还没有任务」
  「ComfyUI 未启动」，不再把 `fetch failed` 当下发给用户。设置页的「测试连接」同样改成
  「连接失败：<地址> 没有响应（ComfyUI 可能未启动）」。

**回归**：`test-client.mjs` 新增离线场景（探测失败后面板必须仍打开、横幅文案正确、不外泄 `fetch failed`）；
`test-routes.mjs` 新增 `/comfyui/test` 的离线分类断言（把 baseUrl 指到必然关闭的 65530 端口）。

---

## 1.6.1 — 2026-11-17：所有 HTTP 路由先过 Host / Origin 守卫

本次把插件注册的每个 `webServer.register` 端点都先问一遍组合里 `connection` 服务的
`requestRejection(request)`（与 `dsh-host-open-in-app` 同一口径）：

- 不带会话 cookie 的跨站请求拿到 401 / 403，而不是端点正文；
- 浏览器同源请求带会话 cookie，行为不变；
- 没有挂 `connection` 服务时退回旧行为（不因缺服务而整体不可用）。

改动覆盖 `lib/gallery-routes.js`、`vendor/comfyui/lib/proxy.js`、`vendor/comfyui/lib/routes.js`、
`vendor/launcher/index.js`、`vendor/qwen-paint/lib/index.js`。

---

## 1.6.0 — 2026-11-13：实时进度、效率与一批真 bug

### 面板：任务实时进度监测

- **标题栏状态条**（新增）：面板标题下面那行常驻显示 `正在生成 · 工作流名 · 3/9 步 · 约 42s 后完成 · 队列 1`，
  空闲时显示「空闲」，进度通道没连上时明确写「进度通道未连接」（生成照常，只是没有实时数字）。
  右侧是百分比，下面是 3px 进度条；还没拿到第一步时走不确定态动画。
- **「任务」页大进度卡**：正在生成的任务单独一张卡，显示步数 / 节点号 / 已用 / 预计剩余，
  带中断按钮；列表里的运行中任务也有秒级走时（不再是「耗时 0s」）。
- **工具卡片**：`comfyui_workflow run` / `comfyui_run` 的卡片改为读 `/comfyui/live`，
  带步数与 ETA，且不再每 2 秒往 ComfyUI 打一次 `/queue`。
- **数据来源**：宿主新增 `GET /comfyui/live`，完全由已连接的 ComfyUI WebSocket 事件
  （`status` / `execution_start` / `executing` / `progress` / `execution_error` /
  `execution_success` / `execution_interrupted`）与内存里的运行表算出，**不产生任何上游请求**，
  所以可以按 0.9 秒轮询；页面不可见时自动降频，空闲时 2.5 秒一次。
- **布局与渲染**：面板默认宽度 420（可拉到 720），标题栏更紧凑；标签页带「运行中」圆点；
  拖动固定位置后**自动补高度**（旧实现会把面板变成内容高度、正文不再滚动）；
  Esc 关闭面板（输入框内不抢）；资产页每 8 秒自刷新；加载区失败/降级现在会显示原因，
  不再把「服务器离线」显示成「一个素材都没有」。

### 出图 / 出视频效率

- **`/object_info` 缓存从 60 秒提到 30 分钟**，并补到 6 个此前绕过缓存的调用点
  （识别参数、下拉选项、刷新参数、加载区、`comfyui_object_info`、图→API 提取）。
  装了自定义节点的机器上这张表是 5–20 MB，过去「隔一分钟再出图」就要先整份下载+解析，
  而且串在提交之前。
- **提交前三次读盘并行化**（object_info / 加载区槽位 / 素材尺寸）。
- **完成检测改为事件驱动**：WebSocket 在就绪时是权威信号，`/history` 轮询从每秒一次降到每 5 秒一次
  （10 分钟的视频约 600 次请求 → 120 次），任务结束那一刻立即收图；单次轮询抖动不再判整次生成失败。
- **超时不再丢结果**：等待预算用完时任务仍在 ComfyUI 里跑，现在保持 tracked，
  媒体落地后照样进资产索引/作品库，工具返回「仍在运行」而不是「失败」。
- **队列扫描**：历史读取并发 4 路（过去串行，资产页有 N 个待归档任务就 N 个来回），
  归档后立刻从跟踪表移除，永不出现的 run 连续 10 次拉不到就丢弃（过去会永远重拉）。
- qwen-paint：节点 schema 加 120 秒缓存（局部重绘每次少 3–7 次 `/object_info`），
  每 5 秒一条的诊断日志不再无条件写（与已节流的状态日志重复），
  加速自检定时器并入 `ctx.effect`（热重载不再叠加多份并发）。

**测试机实测（2026-11-13，ComfyUI 0.42.3 / RX 9060 XT）**

| 项 | 数字 |
| --- | --- |
| `/object_info` 体积 | 4.62 MB（这就是过去"隔一分钟再出图"要先下载解析的那份） |
| `/comfyui/live` 响应 | 1–2 ms（冷启 59 ms） |
| `/comfyui/loadarea` | 冷 529 ms（含一次 object_info 下载）→ 热 **2 ms** |
| `/comfyui/jobs` | **3 ms**（资产名改成内存映射，过去每次重解析整份 assets.json） |
| 视频实测 | MiniMax-H3 int4、56 帧、4 步：**438 s** 出片（含约 150 s 权重装载，每步 ≈87 s），进度条与 ETA 全程跟随 |
| 图片实测 | 544²、9 步、seed 固定：**51.7 s** |

### 修掉的真 bug（每条都有触发条件）

| # | 位置 | 症状 |
| --- | --- | --- |
| 1 | `comfy-ui/store.js` | 所有 JSON 都是**就地整文件重写**且无串行化：崩溃/断电留下半截文件，下次读取当成「没有」返回空列表，再保存一次就把整个工作流库清空；面板保存与 Agent 刷新并发时后写覆盖前写。现在 temp+rename 原子写、按文件串行、坏文件转存 `.corrupt-<ts>` 并写回执 |
| 2 | `vendor/qwen-paint/comfy-accel.js` | 跨模块给 `export let SAGE_READY` 赋值 → ESM 抛 `TypeError`，加速自检**每次都在装包前中止**，`--use-sage-attention` 永不生效。改为 `setSageReady()` |
| 3 | `vendor/qwen-paint/index.js` | 权重下拉的闸门参数写成 `unet/lora/controlnet`，面板发的是 `mainmodel/lorapick/cnetpick` → 三个下拉**静默无效**（端点照回 ok） |
| 4 | `vendor/qwen-paint/index.js` | `freeComfyModels` 里 `log?.()` 引用未声明标识符，**照样抛 ReferenceError**，把「卸载失败不影响后续」变成 upsell/修复流程整体失败 |
| 5 | `vendor/qwen-paint/index.js` | 中断的任务不认识 `execution_interrupted`，对已结束的任务按 400ms 轮询满 300 秒，最后报「超时」 |
| 6 | `vendor/comfyui/progress.js` | WebSocket 只处理 `progress`：Map 无界增长、终态事件全丢、attach 不幂等、重连固定 3 秒无退避 |
| 7 | `vendor/comfyui/comfyui.js` | 路由前缀靠「404 再发一次」学习：合法 404（已删的预览/被清的历史）**永远双倍请求**，POST 还可能被执行两次 |
| 8 | `vendor/comfyui/params.js` | 选项校验把「调用方没传、用的保存默认值」也当非法：音色/模型文件一变，工作流**完全跑不了**，错误还把整份选项列表塞进上下文 |
| 9 | `vendor/comfyui/params.js` | 宽高参数按节点 id 先到先得，可能被缩放节点抢走 → 面板设 1920×1080 实际改的是 resize 节点 |
| 10 | `lib/gallery.js` | 删除用 `rename` 到 E: 的回收站，图在 C: → **EXDEV，删除从来没成功过**；且回收站目录被拼两次（`trash/trash/`） |
| 11 | `lib/gallery.js` | 墓碑永不失效：从回收站放回来的图仍然隐形，与「放回来就等于撤销」的注释相反 |
| 12 | `lib/presets.js` | 检索上限硬夹到 50：62 条风格里最后 12 条在面板里永远没有入口，`total` 却写 62 |
| 13 | `lib/hidden-launch.js` | `void runPowerShell(...)` 没挂 catch：一次隐藏窗口失败 = 未处理 rejection = **Node 直接终止 DSH 主进程** |
| 14 | `vendor/comfyui/http.js` | 请求体无上限，`/comfyui/upload` 与预设导入都是先全量缓冲再检查 → 一个大文件打爆宿主堆 |
| 15 | `vendor/comfyui/routes.js` | `object_info` 失败被吞成 `ok:true`，面板拿到「成功」的降级参数并保存进库；加载区选「已生成」找不到文件时静默成功 |

---

## 2026-11-24 — 默认主模型换成完整版（未单独发版）

- 主模型从蒸馏 GGUF 换成完整版 `qwen_image_2.1_int8_convrot.safetensors`，
  默认工作点 `baseSteps 25 / baseCfg 3`，`turboBakedModel: false`、`turbo8Enabled: false`、
  `forceTurbo8Steps: false`。
- 量化格式只影响速度不影响画质：GGUF Q6_K 与 int8_convrot 的噪声/细节指标几乎相同，
  但 int8_convrot 走 ROCm 原生 convrot 内核，快约 4 倍（26 s vs 110 s）。能用 safetensors 就别用 GGUF。
- 蒸馏模型不能加步数：同一 turbo 主模型按 25 步跑，暗部噪声反而 +44%。
- 完整版更干净但要用纹理换：暗部噪声 −37%、平坦区 −15%，细节能量 −33%。
- 配套要求：`turboBakedModel` / `turbo8Enabled` 必须同步关掉；改完**必须重启 DSH**
  （qwen-paint 的 cfg 在 `apply()` 时合并并被工具闭包捕获，热重载不会重建）。

---

## 1.5.0 — 2026-11-12：修 7 个真 bug + 一轮效率清理

这一轮**不改采样链路、不改模型、不换节点**，只做三件事：把会**静默失败**的地方修好、
把**白干的活**去掉、把**重复 IO** 收敛。全部改动都有 `test-fixes.mjs` 的 16 条回归盯着。

### 修掉的 bug

| # | 症状 | 根因 | 修法 |
| --- | --- | --- | --- |
| 1 | 空闲关停后第一次**图生图**必失败（原生 `fetch failed`），而且不会自动拉起后端 | 只要传了 `reference` 就整段跳过探活（旧假设"要上传图说明后端在跑"）；而本套件默认 5 分钟就关后端 | `runDraw` 先用一次 `/queue` 判活，离线才 `ensureComfyUp`；图生图 / 多参考图 / ControlNet 全走同一条路 |
| 2 | **"空闲 5 分钟自动关停"从来没生效**（后端一直在线，`shutdowns:0`），显存白占 | 进程识别要求命令行同时含 `comfy` 与 `main.py`；但启动器用 `cwd + 相对路径 main.py` 拉起，命令行里**一个 comfy 都没有** | 身份判定改成"命令行含 `main.py`" **且**（含 `comfy` **或** 可执行文件 == 配置的 `comfyPython`）；端口监听 + `/system_stats` 已有两道前置闸，不会误杀 |
| 3 | 配置的 `outputDir` 不可写时，日志说"已退回默认目录"，但默认目录同样不可写 → 每次出图都在写盘那一步失败 | 兜底目标恒等于 `defaultOutputDir()`，等于没有第二选择 | 兜底链：配置目录 → 桌面默认 → `<DSH_HOME>/data/dsh-comfy-suite/output` → 系统临时目录，每个都做**真写测试**；原配置为什么不可用会如实回报 |
| 4 | `character_image` 的参考图同名时，后传的覆盖先传的 —— 提示词里的「图1/图2」指向同一张 | 上传没带序号前缀（`draw_image` 早就带了） | 统一成 `dshqp-ref-<序号>-<原名>`，并改成并发上传 |
| 5 | 日志/记忆里 `steps=undefined cfg=undefined`；turbo9 的步数一直没写进 `.qwen-paint-memory.jsonl` | turbo9 档把 KSampler 换成了 `ManualSigmas`，**节点 8 不存在**，旧代码却只从 `workflow[8]` 读步数 | 新增 `effectiveSampling()`：按节点类型读（KSampler 读 inputs；turbo9 用 sigma 个数 - 1） |
| 6 | 容量探测把"自带蒸馏"的主模型判成 `basic`，面板写"回退到 25 步 / CFG 2.5"，与实跑的 9 步 turbo9 **矛盾** | 档位只看"有没有 turbo8 LoRA"，没看 `isTurboBakedModel` | 探测阶段就认 `bakedTurbo`：档位记为 turbo（有 TE/Speedup 时 full），并写一条说明 |
| 7 | `comfyUrl` 配成非默认端口（如 8189）时，**自动拉起后端会等满 240 秒后报"没就绪"** | `ensureComfyUp` 的启动参数里**不带 `--port`**，ComfyUI 永远只听默认 8188；启动器那条路径却一直传 | 抽出纯函数 `buildComfyArgs()`：端口/监听地址从 `comfyUrl` 推、并剥掉手写参数里过期的 `--port/--listen` |

顺带修的文档/小项：`check_acceleration` 的 `action=repair` 与 `confirm` 补进工具描述；
7 处被误写成制表符的 `t`（`turboBakedModel`、`test-inpaint.mjs` …）修回。

### 效率（每条都能从代码里看出省了什么）

- **状态轮询 2 个请求 → 1 个**：`/system_stats` + `/queue` 合并成一次 `/queue`
  （`status.probeBusy()`）。面板每 5 秒轮询一次，约合每天少发 1.7 万个请求。
- **诊断/状态日志不再"读全文件 → 写全文件"**：`diag()` 改 append-only + 512 KB 轮转；
  状态日志从"每 5 秒重写 200 行"改成"状态变化或每 60 秒追加一行"。
  旧写法在默认路径下每分钟约 34 KB 写放大，而且落在**用户的出图目录**里。
- **调试日志移出出图目录**：`qwen-paint-diag.log` / `qwen-paint-status.log` 落到
  `<DSH_HOME>/data/dsh-comfy-suite/`，不再混进成品图。需要改位置用 `DSHQP_DIAG_FILE`。
- **作品库扫描**：图片尺寸（文件头）按 `mtime+size` 缓存、`stat`/读头改成 8 路并发；
  第二次打开面板不再对每张图重读 64 KB。出图日志的 JSON 解析同样按 `mtime+size` 缓存。
- **放大不白卸主模型**：`upscale_image` 以前一进门就 `/free` 卸主模型、再去探引擎 ——
  引擎缺失或图读不到时，6.5 GB 的主模型白卸一次，下次出图要重新加载。
  现在**先探引擎、先上传，最后才卸**（`test-fixes.mjs` 断言"引擎缺失时 `/free` 一次都不发"）。
- **一次多张不再逐张取图**：N 张改为并行 `/view` + 落盘（`Promise.all` 保序）。
- **首轮轮询立即查**：`waitForResult` 不再固定先睡 `pollIntervalMs`（默认 1.2 s）；
  同 prompt+seed 命中 ComfyUI 缓存时可以立即返回。
- **参考图不再读两遍**：扩图/重绘本来就要读整张图算尺寸，现在把字节直接交给上传函数。
- **`config.js` 拆出 `output-dir.js`**：改完兜底链之后它到了 261999 字节 —— 离 DSH STORE 的
  单文件 262144 上限只剩 **145 字节**，下一次改动必顶爆。把出图目录解析拆走后是 256608，
  留出约 5.4 KB 余量；`index.js`（255 KB）也接近上限，后续再加功能要同样先拆文件。

### 实测：为什么同一张 992² 有时 16 秒、有时 140 秒

这不是插件参数变了，是**硬件资源被挤**。同一次 ComfyUI 会话（日志 `user/comfyui_8188.log`）：

| 时间 | 尺寸 | 采样 | 每步 | 说明 |
| --- | --- | --- | --- | --- |
| 22:08 | 992² | 9 步 **16 s** | 1.86 s/it | 刚启动，CLIP + UNET 都在显存里 |
| 22:26 | 992² | 9 步 34 s | 3.84 s/it | 常驻后一般水平 |
| 22:37 | 992² | 9 步 **120 s** | 13.35 s/it | 同一台机器、同一模型，单步慢 7 倍 |

原因是测试机 **16 GB 显存要和桌面（dwm ≈2.1 GB）+ Edge GPU 进程（≈0.8 GB）分**，
系统内存也只有 16 GB：

- 16.3 GB 显存里 ComfyUI 实际能用约 13 GB，装不下 CLIP(6 GB) + UNET(6.5 GB) + 激活，
  于是每个 prompt 前都要卸掉 CLIP、再重载 UNET（日志里的 `Unloaded partially` / `loaded completely`，约 8–20 s）；
- 显存一紧，Windows 会把权重换页到系统内存/页面文件；GGUF Q6_K 每步都要读权重，
  单步就从 1.9 s 掉到 13 s。

**插件侧能做的**：已经做了（不重复卸模型、不重复探测、不重复读文件、轮询减半）。
**需要人做的**：出图时关掉占显存的程序（浏览器硬件加速、播放器、别的 AI 工具），
或把 `--reserve-vram` 调小给模型让位。这不是改代码能绕开的。

---

## 1.3.2 / 1.3.1 — 2026-11-12：真机修复

**① 局部重绘第二次必崩。** --gpu-only 的 ComfyUI 会把蒙版留在显存；同一张蒙版第二次使用时
LoadImageMask 命中缓存，下游 GrowMask 抛
`can't convert cuda:0 device type tensor to numpy`。现改为纯 torch 的 GrowMaskWithBlur
（外扩+羽化一体），备用链 MaskToImage → ImageBlur → ImageToMask，**绝不**再回 GrowMask。
test-inpaint.mjs 直接盯源码，防止有人把它加回来。

**② 三个辅助工具在叠 turbo LoRA。** 主模型已是蒸馏版（turboBakedModel: true）时，
inpaint_image / outpaint_image / character_image 仍在挂 turbo8 LoRA —— 双重蒸馏，
既压暗又慢。统一收敛到一个 turboBakedOrLora(cfg, workflow, loraName)，三处调用点共用。
实测同一张图同一蒙版：**120 s → 27 s**。

---

## 2026-11-12（未编号）：9 步采样、扩图、提示词衣柜、捏人、上游移植

- **`lib/sampling.js` 9 步 sigma 表**：把 `scheduler:simple` 换成 `ManualSigmas` +
  `SamplerCustomAdvanced`，重绘/扩图接到同一条链上。做法与实测见 README「9 步采样与扩图」。
- **`outpaint_image`**：用 ComfyUI 自带的 `ImagePadForOutpaint` 出「补好的图 + 新增区域蒙版」，
  蒙版挂到 latent 的 `noise_mask`，原图像素一个不动。见 README。
- **`prompt_wardrobe`**：移植 `Comfyui-Anima-Wardrobe-V5` 的引擎设计（不是词库），
  按档位收窄候选池 + 三层权重 + 同 seed 可复现 + 自检报告。见 README。
- **`character_image`**：接 `Goohaitools-comfyui` 的 `TextEncodeQwenImage21GH`（10 图槽）
  与 GHIL 素材库（人像 1499 / 服装 1407 / 姿势 1439 / 发型 893）。见 README。
- **上游 dsh-qwen-paint 0.18/0.19 三处移植**：
  - 0.19.0 §3：参考图上传按序号加前缀 `dshqp-ref-<序号>-<原名>`（否则 `refs/1/ref.png`
    与 `refs/2/ref.png` 会**静默**变成同一张）；
  - 0.18.0 §1：主模型文件名带 turbo 就自动跳过 turbo8 LoRA（配置一丢就退回 25 步 / CFG 2.5，
    实测 126 s 且画面过冲）；
  - 0.19.0 §1：`draw_image` 多参考图 1–6 张（第 N 张 → `images.image_N`），上游上限 16，这里取 6。
  判定统一收敛到 `isTurboBakedModel(cfg, unetName)`（配置 > 文件名兜底），`test-upstream.mjs` 10 条回归盯着。
- **turbo GGUF 主模型的两个坑**（2026-11-24 起默认已弃用，保留给要走 GGUF 路线的人）：
  ① 那个 GGUF 文件 `metadata_kv_count` 是 0（没有 `general.architecture`），ComfyUI-GGUF 会猜架构失败并抛
  `This model is not currently supported - (Unknown model architecture!)`；修法是往表头插一条
  `general.architecture = qwen_image`（数据区整体后移 64 字节，张量 offset 不变）。
  ② 反量化精度决定速度：`UnetLoaderGGUF`（fp32 反量化）82–155 s，`UnetLoaderGGUFAdvanced(target)`
  **37.6 s**、`bfloat16` 38.7 s。所以插件默认 `ggufLoader: advanced` + `ggufDequantDtype: target`。
  **别叠 turbo8 LoRA**：拿它去叠蒸馏模型会压暗压黑（暗部占比 0.2%→1.3%），
  `turboBakedModel: true` 就是干这个的——保留 turbo9 采样，但跳过 LoRA 节点。
- **和 9 步整合画布的差距（如实记）**：

  | 画布里的东西 | 测试机状况 |
  | --- | --- |
  | `qwen_image_2.1_turbo_int8_convrot`（已蒸馏主模型） | 没有；用 `qwen_image_2.1_int8_convrot` + `turbo8_lora_step2500` 等效替代 |
  | `qwen3vl_8b_int8_convrot`（CLIP） | 没有；用 `qwen3vl_8b_w4a8` |
  | 扩图 / 万物移除 / 一致性 三个功能 LoRA | **都没有** —— 所以移除只能走"蒙版 + 指令"的通用重绘，没有专用权重 |
  | `QwenImagePromptOptimizer` + `Qwen-Image-2.1-PE-*.gguf`（LLM 改写提示词） | 没有权重；`TextGenerate` 节点在，但没有对应的 PE 模型，暂不接 |
  | `孤海` / `GH` / `Goohai` 节点包（裁切-还原、绿幕蒙版、画板） | 未安装；扩图/重绘改用自带节点实现同一效果 |
  | 3 张参考图的编辑（`<image1>/<image2>/<image3>`） | `draw_image` 支持 1–6 张参考图（编码器支持到 4 张） |

---

## 2026-11-06 — 适配 DSH 0.2.2-rc.1

本包的外部依赖只有 `@deepseek-ai/schemastery` 与 `fflate`（都随包 vendored），**没有** import
任何宿主的 `@deepseek-ai/dsh-*` 包——这一点在 0.2.2 里变成了硬要求：profile 不再装宿主的那套
`@deepseek-ai/*`，link: 安装的插件按 Node 语义向上查找会 `MODULE_NOT_FOUND`。核对过的接口面：

| 用到的宿主接口 | 0.2.2 现状 |
| --- | --- |
| `ctx.tools.register(definition)` | 要求 `output { schema, render }`，参数即 JSON Schema；本包的 14 个工具全部满足 |
| `ctx.slots.inject/register` | `settings.section` / `tool.call.toolview` / `shell.overlay` / `conversation.session.header.actions` / `conversation.input.right` 均仍在 |
| `ctx.locale.register(ns, dict)` / `bind(ns)` | 签名未变 |
| `settings.update(entryId, patch)` | 0.2.2 多了可选的 `expectedRevision`，两参调用兼容 |
| `window.__ModuleLoader__.load({id, factory})` | 契约未变，单 row 注册仍然正确 |

新增声明：`engines.dsh = ">=0.2.1-rc.5 <0.3.0-0"`、`dsh.manifestVersion = 1`
（0.2.2 起启动和安装都会按 `semver.satisfies(..., {includePrerelease:true})` 校验）。

---

## 2026-11-05 — 作品库、风格库、零窗口启动

- **作品库 / 风格库**（借鉴 [`dsh-image-gen`](https://github.com/shanliuling/dsh-image-gen)）：
  图库检索/收藏/复用参数/回收站 + 62 条提示词积木 + `image_presets` 工具。做法见 README。
- **零窗口启动**：Windows 上由 `wscript.exe` 执行 `.dshqp-hidden.vbs`，再以 `SW_HIDE` 拉起
  `.dshqp-launch.cmd` → python，控制台从创建那一刻就是隐藏的。见 README「启动行为」。
- **`boot.log` 回执**：子插件逐个注册工具并上报结果，失败不再连坐；`tools audit` 行逐次核对
  14 个工具是否都在。见 README「诊断」。

---

## 2026-11-04 — 三个插件合并成一个包

- 一个 Loader 条目（`comfy-suite`）、一个设置入口、一份代码，模型侧 14 个工具。
- 合并只发生在三个边界上：Loader 条目、配置（三块 `comfyui` / `launcher` / `qwenPaint`）、
  客户端（四份 bundle 收进私有模块表，由唯一 factory 物化）。
- 子插件仍是独立的 cordis fiber，各自的 `inject`、`ctx.effect`、工具注册、REST 路由保持原样。
- 当时**默认走 9 步 turbo 链路**；2026-11-24 起默认改为完整版主模型的原生 25 步链路。