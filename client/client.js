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
__dshSuiteRegister({
	id: "dsh-comfyui",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		//#region src/client/i18n.ts
		/** zh/en dictionaries for dsh-comfyui UI (settings page, tool card, panel). */
		const zh = {
			settingsTitle: "ComfyUI",
			settingsDesc: "连接你的 ComfyUI 服务器，让 Agent 直接生成与处理图像、视频。",
			baseUrl: "服务器地址",
			baseUrlHint: "ComfyUI 的 HTTP 地址（默认 http://127.0.0.1:8188）。",
			apiKeyEnv: "API Key 环境变量名",
			apiKeyEnvHint: "密钥名：环境变量或凭据存储（默认 COMFYUI_API_KEY）。",
			hasApiKey: "已配置 API Key",
			noApiKey: "未配置 API Key（本地服务通常不需要）",
			save: "保存",
			saved: "已保存",
			saveFailed: "保存失败",
			test: "测试连接",
			testing: "正在测试…",
			testOk: "连接成功 · ComfyUI {version} · {ms} ms",
			testFail: "连接失败：{message}",
			configNotWritable: "设置服务不可用，请通过 cordis.yml 修改配置。",
			mediaHost: "媒体访问地址",
			mediaHostHint: "媒体在聊天中显示的完整地址（如 http://192.168.1.5:3080）。留空自动检测；图片不显示时填你访问本页的地址。",
			comfyuiDirs: "ComfyUI 目录",
			comfyuiDirsHint: "本机 ComfyUI 安装目录（可多个，支持映射/多实例/便携版）。Agent 据此定位 models、工作流、音色库等文件。",
			comfyuiDirAdd: "＋ 添加目录",
			comfyuiDirRemove: "移除该目录",
			comfyuiDirPlaceholder: "如 D:\\ComfyUI",
			skillsDir: "技能包目录",
			skillsDirHint: "工作流技能包（SKILL.md 与参考文档）目录。留空 = 数据目录下 skills/；填绝对路径可放到别的盘或同步盘。改后需手动搬移已有目录。当前实际使用：{current}",
			language: "界面语言",
			languageHint: "界面语言，切换后页面自动刷新。",
			cardGenerating: "ComfyUI 生成中…",
			cardBackground: "后台任务",
			cardBackgroundDone: "已完成",
			cardPrompt: "任务 ID",
			cardElapsed: "耗时",
			cardMedia: "结果",
			cardEmpty: "无媒体输出",
			cardFailed: "执行失败",
			cardInterrupted: "已中断",
			cardCollect: "使用 job_output 收集后台任务结果",
			cardRecovered: "已从资产索引恢复（ComfyUI 历史已失效）",
			cardPollStalled: "后台任务状态收集失败（已重试 {n} 次）：{message}",
			cardLoadFailed: "加载失败，点下方下载",
			cardDownload: "下载",
			cardWorkflow: "工作流",
			cardMode: "模式",
			cardListed: "已列出 {runs} 个运行工作流，{graphs} 个图工作流",
			cardHandWritten: "手写工作流",
			cardWaiting: "等待 ComfyUI…",
			cardQueued: "排队中（前面还有 {n} 个）",
			cardStep: "步数 {value}/{max}",
			cardEta: "约 {s}s 后完成",
			cardInReply: "结果图见对话回复，文件：",
			panelTitle: "ComfyUI 面板",
			panelReset: "复位位置与大小",
			close: "关闭",
			lbPrev: "上一张",
			lbNext: "下一张",
			tabWorkflows: "工作流",
			tabAssets: "资产",
			tabQueue: "队列",
			error: "出错",
			refresh: "刷新",
			ours: "本插件",
			connChecking: "正在检测 ComfyUI 连接…",
			connOk: "连接正常 · ComfyUI {version} · {ms} ms",
			connFailTitle: "无法连接 ComfyUI",
			connFailBody: "后端未能连上 ComfyUI（{message}）。请先启动本机 ComfyUI，确保后端能检测到其端口；若使用远程服务器，请到设置页检查服务器地址并点「测试连接」。",
			wfAdd: "新建工作流",
			wfName: "名称",
			wfDesc: "概述",
			wfDescPlaceholder: "告诉 Agent 这个工作流做什么",
			wfNameCopyHint: "点击复制工作流名称",
			wfNameCopied: "已复制工作流名称",
			wfParams: "可调参数",
			wfTags: "标签",
			wfTagAll: "全部",
			wfTagAdd: "自定义标签，回车添加",
			wfTagRemove: "点击移除标签",
			wfParamsEmpty: "未定义参数。点击\"识别参数\"自动提取提示词/分辨率/步数/种子，或\"高级参数\"手动指定任意节点输入。",
			wfParamsDrop: "拖拽/点击/粘贴上传",
			wfPasteHint: "悬停此处后按 Ctrl+V 粘贴剪贴板里的图片/文件",
			wfUploadSection: "加载区",
			wfUploadHint: "点击大图选择图像，或粘贴/上传新图像；选中后图生图默认使用该图像",
			wfUploadZone: "拖拽 / 点击 / 粘贴上传到 ComfyUI input 目录",
			wfUploaded: "已上传",
			wfCopyName: "复制文件名",
			wfLoadArea: "加载区",
			wfLoadHint: "点击放入素材（加载区的素材按顺序填入工作流未指定的加载参数）",
			wfLoadEmpty: "加载区为空，点击下方“添加加载区”放入素材",
			wfLoadPicked: "已加载",
			wfLoadAddSlot: "＋ 添加加载区",
			wfLoadAddMedia: "添加素材",
			wfLoadRemoveSlot: "删除加载区",
			wfLoadNone: "空",
			wfLoadNoneHint: "清空该加载位（保留加载位，不放素材）",
			wfLoadSlotLabel: "加载位",
			wfLoadSummary: "加载位 {slots} 个 · 已放入 {loaded} 个素材，未指定的加载参数按顺序取用",
			wfTabAll: "全部",
			wfTabImported: "已导入",
			wfTabGenerated: "已生成",
			wfTypeAll: "全部类型",
			wfUploadedToast: "文件已上传",
			wfPickerUpload: "粘贴 / 点击上传",
			wfLoadNoFiles: "没有可用的图像",
			wfParamsUploading: "上传中…",
			uploadKind_image: "图片",
			uploadKind_video: "视频",
			uploadKind_audio: "音频",
			wfMediaClear: "清空",
			wfMediaEmpty: "文件名（留空=移除该参考位）",
			wfRefSlot: "参考",
			wfParamsRecognize: "识别参数",
			wfParamsRecognizing: "识别中…",
			wfParamsRecognizeFailed: "识别失败：无法连接 ComfyUI 或工作流无效",
			wfParamsAdd: "高级参数",
			wfParamAdd: "添加",
			wfParamLabel: "名称",
			wfParamCustomLabel: "自定义名称",
			wfParamCustomHint: "仅用于展示与 Agent 描述，传参键由系统自动生成；留空使用默认",
			wfParamDefault: "默认值",
			wfParamRandom: "随机",
			wfParamDelete: "删除",
			wfParamNode: "节点",
			wfParamInput: "输入",
			wfJson: "工作流 JSON（ComfyUI UI 导出的 API 格式）",
			wfSave: "保存",
			wfSaveRun: "保存并运行",
			wfCancel: "取消",
			wfEdit: "编辑",
			wfRun: "运行",
			wfDelete: "删除",
			wfQueued: "已入队：",
			wfJsonError: "工作流 JSON 解析失败",
			wfUpdated: "更新于",
			wfEmpty: "没有检测到任何工作流，请通过新建、导入或提取来创建执行流程。",
			wfLibrarySection: "API 工作流",
			wfRefresh: "刷新",
			wfImportFile: "导入 JSON",
			exportPresets: "导出预设",
			importPresets: "导入预设",
			transferExportTitle: "导出工作流预设",
			transferImportTitle: "导入工作流预设",
			transferExportHint: "共 {total} 个可导出工作流，已选 {selected} 个。运行参数与技能包会一并导出。",
			transferSelectAll: "全选",
			transferSelectNone: "全不选",
			transferExportRun: "导出 ({n})",
			transferImportRun: "导入 ({n})",
			transferExporting: "正在导出…",
			transferImporting: "正在导入…",
			transferExportDone: "已导出 {n} 个工作流：{names}（浏览器正在下载预设包）",
			transferExportFile: "文件 {file}（{size} KB）",
			transferExportWarnings: "导出警告：{warnings}",
			transferSelectedList: "将导出：{names}",
			transferExportEmpty: "没有可导出的工作流",
			transferPickFile: "点击选择或拖入 .zip 预设包",
			transferPickHint: "导入会创建为新工作流，不会覆盖库中已有的工作流",
			transferPackageInfo: "包内共 {n} 个工作流 · 导出于 {date}",
			transferParamBadge: "参数 {n}",
			transferSkillBadge: "技能包 · {n} 个文件",
			transferSkillRequired: "技能包 · {n} 个文件 · 必读",
			transferImportDone: "已导入 {n} 个工作流",
			transferImportedItem: "✓ {src} → {dst}",
			transferImportFailedItem: "✗ {src}：{reason}",
			transferImportNote: "重名工作流自动追加（导入）后缀",
			transferFinish: "完成",
			wfComfyuiSection: "ComfyUI 工作流",
			wfComfyuiHint: "面板自动检测 ComfyUI 中保存的工作流。\n注：非 API 流程，无法直接执行，需经过提取转化为 API 工作流，或自行导入 API 工作流即可执行。",
			wfComfyuiEmpty: "ComfyUI 端没有检测到保存的工作流",
			wfExtracted: "已提取",
			wfNotExtracted: "未提取",
			wfView: "查看",
			wfExtract: "提取",
			wfExtractedNotice: "已提取并加入插件库",
			wfExtractTitle: "提取执行流",
			wfExtractModeAll: "整体提取",
			wfExtractModeAllHint: "所有分量合成一个执行流（运行时全部执行）",
			wfExtractModeSplit: "按分量提取",
			wfExtractModeSplitHint: "每个独立流程一个执行流（推荐）",
			wfExtractModeMain: "只提取主流程",
			wfExtractModeMainHint: "只提取最大分量（通常是当前测试区块）",
			wfExtractRun: "提取",
			wfExtractEmpty: "图里没有可提取的分量",
			wfComponents: "分量",
			wfComponentLabel: "分量",
			wfNodes: "节点",
			wfBypassed: "已绕过节点",
			wfIsolated: "悬空节点",
			wfViewBack: "返回",
			wfViewNodes: "节点清单",
			wfViewJson: "JSON 预览",
			wfViewEmpty: "图中没有可执行的节点",
			assetAll: "全部工作流",
			assetBack: "返回",
			assetEmpty: "还没有生成记录。运行工作流后，结果会出现在这里。",
			assetGone: "源文件已被 ComfyUI 清理",
			assetDelete: "删除资产",
			assetDeleteTitle: "删除该资产？",
			assetDeleteBody: "将从资产库移除这条记录，并删除 ComfyUI 输出目录里的 {count} 个文件。此操作不可恢复。",
			assetDeleteNoDir: "未能定位 ComfyUI 输出目录，只会移除资产记录，磁盘文件保留（可在 cordis.yml 的 outputDir 里指定输出目录）。",
			assetDeleteDone: "已删除记录，磁盘文件删除 {deleted} 个",
			assetDeleteFailed: "删除失败：{message}",
			confirmDelete: "确定删除",
			cancel: "取消",
			skillButton: "技能包",
			skillBadge: "技能包",
			skillBadgeRequired: "技能包·必读",
			skillBadgeHint: "该工作流挂了技能包：Agent 运行前会读它。",
			skillTitle: "技能包",
			skillIntro: "点击「启用技能包」后，可为这个工作流添加给 Agent 看的额外 skills 说明：什么时候用、参数怎么填、有哪些坑。",
			skillEnable: "启用技能包",
			skillDetach: "停用（保留文件）",
			skillDestroy: "销毁技能包",
			skillDestroyConfirm: "⚠ 永久删除整个技能包（{count} 个文件），不可恢复",
			skillDestroyConfirmButton: "确认销毁",
			skillDropHint: "可把文件拖到这里导入",
			skillRequired: "运行前必读",
			skillDir: "目录",
			skillSummary: "摘要",
			skillSummaryPlaceholder: "一句话说明这个工作流适合做什么",
			skillSummaryHint: "Agent 靠它决定要不要读正文，等同 skills 里的 description 字段。",
			skillSave: "保存",
			skillSaved: "已保存",
			skillDirty: "未保存",
			skillDirtyPrompt: "当前文件有未保存的修改。",
			skillSaveAndSwitch: "保存并切换",
			skillDiscard: "丢弃修改",
			skillImport: "↑ 导入文件",
			skillImportHint: "导入本地文件到技能包：md/txt/json/yaml 进 references，脚本进 scripts，图片/csv 进 assets（也可直接拖进左栏）。",
			skillImported: "已导入",
			skillImageHint: "图片只能预览，不能在此编辑；Agent 会在正文点名它时才去读取。",
			skillNewFile: "＋ 新建文件",
			skillNewDir: "＋ 新建目录",
			skillReveal: "📂 打开目录",
			skillRevealHint: "在文件管理器中打开这个技能包的文件夹，方便直接拷贝文件进去。打开的是运行 DSH 那台机器上的目录；若你正从另一台机器访问本页面，请按下方显示的路径自行前往。",
			skillRevealed: "已打开",
			skillRefresh: "刷新",
			skillRefreshHint: "重新读取技能包目录，显示 Agent 写入或文件管理器里新增/替换的文件。",
			skillRefreshed: "已刷新",
			skillNewDirPlaceholder: "目录名，如 templates",
			skillNewDirHint: "技能包可以有任意一层子目录。常用：{presets}；也可以自己起名（字母/数字/汉字/下划线/连字符）。",
			skillDirCreated: "已创建目录",
			skillNewPlaceholder: "文件名（默认 .md）",
			skillCreate: "创建",
			skillRename: "重命名",
			skillDeleteFile: "删除文件",
			skillDeleteConfirm: "删除文件",
			skillReadFailed: "读取失败",
			skillFailed: "操作失败",
			skillDeleteWithWorkflow: "该工作流有技能包，要一起删除吗？",
			skillDeleteBoth: "一起删除",
			skillKeepPack: "只删工作流",
			queueEmpty: "当前没有任务",
			queueError: "无法读取队列（ComfyUI 未运行？）",
			jobFilterLabel: "历史",
			jobFilterAll: "全部",
			jobFilterPending: "待生成",
			jobFilterInProgress: "生成中",
			jobFilterCompleted: "已完成",
			jobFilterFailed: "失败",
			jobFilterCancelled: "已取消",
			jobActive: "进行中",
			jobDelete: "删除",
			jobInterrupt: "中断",
			jobRerun: "重跑",
			jobViewAssets: "查看资产",
			jobMore: "更多操作",
			jobClearQueue: "清空队列",
			jobClearHistory: "清空历史",
			jobFree: "释放内存",
			jobDuration: "耗时",
			jobOurs: "本插件",
			// 实时进度条（面板标题栏 + 任务页）—— 数据来自宿主 /comfyui/live，
			// 由 ComfyUI 的 WebSocket 事件驱动，不额外打 ComfyUI。
			liveIdle: "空闲",
			liveRunning: "正在生成",
			liveQueued: "队列 {n}",
			liveSteps: "{value}/{max} 步",
			liveEta: "约 {s}s 后完成",
			liveElapsed: "已用 {s}s",
			liveNode: "节点 {node}",
			liveOffline: "进度通道未连接",
			liveWaiting: "等待 ComfyUI 开始…",
			runningNow: "正在生成",
			jobRunningElapsed: "已用 {s}s",
			jobCopyId: "复制任务 ID",
			jobCopied: "已复制",
			queueRefresh: "刷新",
			queueLiveHint: "进度来自 ComfyUI 的 WebSocket 事件，实时刷新；任务列表 3 秒刷新一次。",
			panelHint: "拖动标题栏移动，右下角缩放，Esc 关闭",
			aboutTitle: "这个插件能做什么",
			aboutHint: "以上是概览；下面的连接设置才是必改项。工作流、任务、作品库、风格库与衣柜分别在设置页的五个 tab 里。"
		};
		const en = {
			settingsTitle: "ComfyUI",
			settingsDesc: "Connect your ComfyUI server so the agent can generate and process images and videos directly.",
			baseUrl: "Server URL",
			baseUrlHint: "ComfyUI HTTP address (default http://127.0.0.1:8188).",
			apiKeyEnv: "API key env var",
			apiKeyEnvHint: "Name of the key: env var or credential store (default COMFYUI_API_KEY).",
			hasApiKey: "API key configured",
			noApiKey: "No API key configured (usually not needed for local servers)",
			save: "Save",
			saved: "Saved",
			saveFailed: "Save failed",
			test: "Test connection",
			testing: "Testing…",
			testOk: "Connected · ComfyUI {version} · {ms} ms",
			testFail: "Connection failed: {message}",
			configNotWritable: "Settings service unavailable — edit cordis.yml instead.",
			mediaHost: "Media base URL",
			mediaHostHint: "Base URL for media shown in chat (e.g. http://192.168.1.5:3080). Auto-detected when empty; set it if images do not load over LAN or a reverse proxy.",
			comfyuiDirs: "ComfyUI directories",
			comfyuiDirsHint: "ComfyUI install roots on this machine (multiple allowed: mapped/multiple/portable installs). The agent uses them to locate models, workflows and voice libraries.",
			comfyuiDirAdd: "+ Add directory",
			comfyuiDirRemove: "Remove this directory",
			comfyuiDirPlaceholder: "e.g. D:\\ComfyUI",
			skillsDir: "Skill pack directory",
			skillsDirHint: "Directory for workflow skill packs (SKILL.md + reference files). Empty = skills/ under the plugin data dir; an absolute path may target another drive or a synced folder. Existing packs are not moved automatically. Currently in use: {current}",
			language: "Language",
			languageHint: "UI language; the page reloads after switching.",
			cardGenerating: "ComfyUI generating…",
			cardBackground: "Background job",
			cardBackgroundDone: "Completed",
			cardPrompt: "Prompt ID",
			cardElapsed: "Elapsed",
			cardMedia: "Results",
			cardEmpty: "No media outputs",
			cardFailed: "Execution failed",
			cardInterrupted: "Interrupted",
			cardCollect: "Collect the background job result with job_output",
			cardRecovered: "Recovered from the asset index (ComfyUI history was evicted)",
			cardPollStalled: "Failed to collect the background job status after {n} retries: {message}",
			cardLoadFailed: "failed to load, use the download link below",
			cardDownload: "Download",
			cardWorkflow: "Workflow",
			cardMode: "Mode",
			cardListed: "Listed {runs} runnable workflows, {graphs} graph workflows",
			cardHandWritten: "Hand-written workflow",
			cardWaiting: "Waiting for ComfyUI…",
			cardQueued: "Queued ({n} ahead)",
			cardStep: "Step {value}/{max}",
			cardEta: "~{s}s left",
			cardInReply: "Results are shown in the reply. Files:",
			panelTitle: "ComfyUI Panel",
			panelReset: "Reset position & size",
			close: "Close",
			lbPrev: "Previous image",
			lbNext: "Next image",
			tabWorkflows: "Workflows",
			tabAssets: "Assets",
			tabQueue: "Queue",
			error: "Error",
			refresh: "Refresh",
			ours: "ours",
			connChecking: "Checking the ComfyUI connection…",
			connOk: "Connected · ComfyUI {version} · {ms} ms",
			connFailTitle: "Cannot reach ComfyUI",
			connFailBody: "The backend could not reach ComfyUI ({message}). Start the local ComfyUI and make sure the backend can see its port; for a remote server, check the URL in settings and run \"Test connection\".",
			wfAdd: "New workflow",
			wfName: "Name",
			wfDesc: "Overview",
			wfDescPlaceholder: "Tells the agent what this workflow does",
			wfNameCopyHint: "Click to copy the workflow name",
			wfNameCopied: "Workflow name copied",
			wfParams: "Parameters",
			wfTags: "Tags",
			wfTagAll: "All",
			wfTagAdd: "Custom tag, press Enter to add",
			wfTagRemove: "Click to remove tag",
			wfParamsEmpty: "No parameters yet. Click \"Detect\" to auto-extract prompt / resolution / steps / seed, or \"Advanced\" to expose any node input manually.",
			wfParamsDrop: "Drop / Click / Paste to upload",
			wfPasteHint: "Hover here and press Ctrl+V to paste an image/file",
			wfUploadSection: "Load area",
			wfUploadHint: "Click the preview to pick an image, or paste/upload a new one; the selection becomes the default source for image-to-image",
			wfUploadZone: "Drag / Click / Paste to upload into the ComfyUI input dir",
			wfUploaded: "Uploaded",
			wfCopyName: "Copy file name",
			wfLoadArea: "Load area",
			wfLoadHint: "Click to put media in this slot (slots fill the workflow unset loader parameters in order)",
			wfLoadEmpty: "Load area is empty — use \"Add slot\" below to put media in it",
			wfLoadPicked: "Loaded",
			wfLoadAddSlot: "+ Add slot",
			wfLoadAddMedia: "Add media",
			wfLoadRemoveSlot: "Delete slot",
			wfLoadNone: "None",
			wfLoadNoneHint: "Empty this slot (the slot stays, with no media)",
			wfLoadSlotLabel: "Slot",
			wfLoadSummary: "{slots} slot(s) · {loaded} loaded; unset loader parameters take them in order",
			wfTabAll: "All",
			wfTabImported: "Imported",
			wfTabGenerated: "Generated",
			wfTypeAll: "All types",
			wfUploadedToast: "File uploaded",
			wfPickerUpload: "Paste / Click to upload",
			wfLoadNoFiles: "No images available",
			wfParamsUploading: "Uploading…",
			uploadKind_image: "image",
			uploadKind_video: "video",
			uploadKind_audio: "audio",
			wfMediaClear: "Clear",
			wfMediaEmpty: "filename (empty = drop this slot)",
			wfRefSlot: "Ref ",
			wfParamsRecognize: "Detect",
			wfParamsRecognizing: "Detecting…",
			wfParamsRecognizeFailed: "Detection failed: ComfyUI unreachable or invalid workflow",
			wfParamsAdd: "Advanced",
			wfParamAdd: "Add",
			wfParamLabel: "Name",
			wfParamCustomLabel: "Custom name",
			wfParamCustomHint: "Shown to the user and the agent only; the parameter key is generated automatically. Leave empty for the default",
			wfParamDefault: "Default",
			wfParamRandom: "Random",
			wfParamDelete: "Delete",
			wfParamNode: "Node",
			wfParamInput: "Input",
			wfJson: "Workflow JSON (API format exported from the ComfyUI UI)",
			wfSave: "Save",
			wfSaveRun: "Save & Run",
			wfCancel: "Cancel",
			wfEdit: "Edit",
			wfRun: "Run",
			wfDelete: "Delete",
			wfQueued: "Queued: ",
			wfJsonError: "Workflow JSON could not be parsed",
			wfUpdated: "updated",
			wfEmpty: "No workflows detected — create one via New, Import, or Extract.",
			wfLibrarySection: "API workflows",
			wfRefresh: "Refresh",
			wfImportFile: "Import JSON",
			exportPresets: "Export presets",
			importPresets: "Import presets",
			transferExportTitle: "Export workflow presets",
			transferImportTitle: "Import workflow presets",
			transferExportHint: "{total} exportable workflows, {selected} selected. Parameters and skill packs are included.",
			transferSelectAll: "Select all",
			transferSelectNone: "Select none",
			transferExportRun: "Export ({n})",
			transferImportRun: "Import ({n})",
			transferExporting: "Exporting…",
			transferImporting: "Importing…",
			transferExportDone: "Exported {n} workflows: {names} (the browser is downloading the package)",
			transferExportFile: "File {file} ({size} KB)",
			transferExportWarnings: "Export warnings: {warnings}",
			transferSelectedList: "Will export: {names}",
			transferExportEmpty: "No exportable workflows",
			transferPickFile: "Click to choose, or drop a .zip preset package here",
			transferPickHint: "Import creates new workflows — nothing in your library is overwritten",
			transferPackageInfo: "{n} workflows in package · exported {date}",
			transferParamBadge: "{n} params",
			transferSkillBadge: "Skill pack · {n} files",
			transferSkillRequired: "Skill pack · {n} files · required",
			transferImportDone: "Imported {n} workflows",
			transferImportedItem: "✓ {src} → {dst}",
			transferImportFailedItem: "✗ {src}: {reason}",
			transferImportNote: "Name clashes get an \"(imported)\" suffix",
			transferFinish: "Done",
			wfComfyuiSection: "ComfyUI workflows",
			wfComfyuiHint: "Auto-detects workflows saved in ComfyUI.\nNote: these are UI graphs, not directly runnable — extract them into API workflows, or import an API workflow instead.",
			wfComfyuiEmpty: "No workflows detected on the ComfyUI server",
			wfExtracted: "extracted",
			wfNotExtracted: "not extracted",
			wfView: "View",
			wfExtract: "Extract",
			wfExtractedNotice: "extracted into the library",
			wfExtractTitle: "Extract runnable workflows",
			wfExtractModeAll: "All as one",
			wfExtractModeAllHint: "Merge every component into one runnable workflow (everything executes)",
			wfExtractModeSplit: "Per component",
			wfExtractModeSplitHint: "One runnable workflow per independent flow (recommended)",
			wfExtractModeMain: "Main flow only",
			wfExtractModeMainHint: "Only the largest component (usually the flow under test)",
			wfExtractRun: "Extract",
			wfExtractEmpty: "No extractable components in this graph",
			wfComponents: "components",
			wfComponentLabel: "Component",
			wfNodes: "nodes",
			wfBypassed: "bypassed nodes",
			wfIsolated: "dangling nodes",
			wfViewBack: "Back",
			wfViewNodes: "Nodes",
			wfViewJson: "JSON preview",
			wfViewEmpty: "No executable nodes in this graph",
			assetAll: "All workflows",
			assetBack: "Back",
			assetEmpty: "Nothing generated yet. Results appear here after workflows run.",
			assetGone: "Source file evicted by ComfyUI",
			assetDelete: "Delete asset",
			assetDeleteTitle: "Delete this asset?",
			assetDeleteBody: "Removes the record from the asset library and deletes {count} file(s) from the ComfyUI output directory. This cannot be undone.",
			assetDeleteNoDir: "The ComfyUI output directory could not be located, so only the record is removed and the files stay on disk (set outputDir in cordis.yml to enable file deletion).",
			assetDeleteDone: "Record removed, {deleted} file(s) deleted",
			assetDeleteFailed: "Delete failed: {message}",
			confirmDelete: "Delete",
			cancel: "Cancel",
			skillButton: "Skill pack",
			skillBadge: "Skill pack",
			skillBadgeRequired: "Skill pack (required)",
			skillBadgeHint: "This workflow has a skill pack: the agent reads it before running.",
			skillTitle: "Skill pack",
			skillIntro: "Click \"Create skill pack\" to add extra skill instructions for this workflow: when to use it, how to fill its parameters, and which pitfalls to avoid.",
			skillEnable: "Create skill pack",
			skillDetach: "Detach (keep files)",
			skillDestroy: "Destroy pack",
			skillDestroyConfirm: "⚠ Permanently delete the whole pack ({count} files) — cannot be undone",
			skillDestroyConfirmButton: "Destroy",
			skillDropHint: "Drop files here to import",
			skillRequired: "Required before running",
			skillDir: "Directory",
			skillSummary: "Summary",
			skillSummaryPlaceholder: "One line on what this workflow is for",
			skillSummaryHint: "The agent uses it to decide whether to read the body — like the description field of a skill.",
			skillSave: "Save",
			skillSaved: "Saved",
			skillDirty: "Unsaved",
			skillDirtyPrompt: "The current file has unsaved changes.",
			skillSaveAndSwitch: "Save and switch",
			skillDiscard: "Discard changes",
			skillImport: "Import files",
			skillImportHint: "Import local files into the pack: md/txt/json/yaml go to references, scripts to scripts, images/csv to assets (drag onto the list works too).",
			skillImported: "Imported",
			skillImageHint: "Images are preview-only here; the agent reads one only when the body points at it.",
			skillNewFile: "+ New file",
			skillNewDir: "+ New folder",
			skillReveal: "📂 Open folder",
			skillRevealHint: "Open this pack folder in the file manager so you can copy files straight in. It opens on the machine running DSH; if you are viewing this page from another machine, use the path shown below instead.",
			skillRevealed: "Opened",
			skillRefresh: "Refresh",
			skillRefreshHint: "Re-read the pack directory to show files added or replaced by the agent or the file manager.",
			skillRefreshed: "Refreshed",
			skillNewDirPlaceholder: "Folder name, e.g. templates",
			skillNewDirHint: "A pack may hold any one-level sub-directory. Common ones: {presets}; custom names work too (letters, digits, CJK, underscore, dash).",
			skillDirCreated: "Folder created",
			skillNewPlaceholder: "File name (.md by default)",
			skillCreate: "Create",
			skillRename: "Rename",
			skillDeleteFile: "Delete file",
			skillDeleteConfirm: "Delete file",
			skillReadFailed: "Read failed",
			skillFailed: "Operation failed",
			skillDeleteWithWorkflow: "This workflow has a skill pack. Delete it too?",
			skillDeleteBoth: "Delete both",
			skillKeepPack: "Workflow only",
			queueEmpty: "No tasks right now",
			queueError: "Cannot read the queue (ComfyUI not running?)",
			jobFilterLabel: "History",
			jobFilterAll: "All",
			jobFilterPending: "Pending",
			jobFilterInProgress: "Running",
			jobFilterCompleted: "Completed",
			jobFilterFailed: "Failed",
			jobFilterCancelled: "Cancelled",
			jobActive: "Active",
			jobDelete: "Delete",
			jobInterrupt: "Interrupt",
			jobRerun: "Rerun",
			jobViewAssets: "View assets",
			jobMore: "More actions",
			jobClearQueue: "Clear queue",
			jobClearHistory: "Clear history",
			jobFree: "Free memory",
			jobDuration: "Took",
			jobOurs: "ours",
			liveIdle: "Idle",
			liveRunning: "Generating",
			liveQueued: "{n} queued",
			liveSteps: "step {value}/{max}",
			liveEta: "~{s}s left",
			liveElapsed: "{s}s elapsed",
			liveNode: "node {node}",
			liveOffline: "progress channel offline",
			liveWaiting: "waiting for ComfyUI…",
			runningNow: "Running now",
			jobRunningElapsed: "{s}s elapsed",
			jobCopyId: "Copy task id",
			jobCopied: "Copied",
			queueRefresh: "Refresh",
			queueLiveHint: "Progress comes from ComfyUI's WebSocket events; the task list refreshes every 3 s.",
			panelHint: "Drag the header to move, corner to resize, Esc to close",
			aboutTitle: "What this plugin does",
			aboutHint: "That is the overview; the connection settings below are the part you normally need. Workflows, tasks, gallery, style library and the wardrobe live in the five settings tabs."
		};
		const LANG_KEY = "dsh-comfyui.lang";
		/** Current plugin UI language, read from localStorage (default zh). */
		function getLang() {
			try {
				return localStorage.getItem(LANG_KEY) === "en" ? "en" : "zh";
			} catch {
				return "zh";
			}
		}
		/** Persist the plugin UI language choice. */
		function setLang(lang) {
			try {
				localStorage.setItem(LANG_KEY, lang);
			} catch {}
		}
		const DICTS = {
			zh,
			en
		};
		/** Build a plugin-local translator for one language. Resolves {name}
		* placeholders from the first rest argument (same contract as the DSH
		* locale bind), falling back to the key itself when untranslated. */
		function makeT(lang) {
			const dict = DICTS[lang];
			return (key, ...rest) => {
				const template = dict[key] ?? key;
				const params = rest[0] ?? {};
				if (params !== null && typeof params === "object") return template.replace(/\{(\w+)\}/g, (match, name) => {
					const value = params[name];
					return value === void 0 ? match : String(value);
				});
				return template;
			};
		}
		//#endregion
		//#region src/client/card.tsx
		/**
		* Tool cards for comfyui_run and comfyui_workflow (tool.call.toolview, keys
		* 'comfyui_run' / 'comfyui_workflow'). Running calls show the workflow name
		* and live progress (polled from /comfyui/queue); settled calls show status
		* and the output files as links. The media itself is NOT rendered here: the
		* model pastes it into its reply (see CLAUDE.md contract 18) — dsh 0.2
		* collapses finished tool rows and PTC mode shows no card at all, so an image
		* wall here was either invisible or a duplicate of the reply.
		*/
		/** Discriminate the settled result node from a running call. */
		function isResultNode(block) {
			return block.kind === "tool-result";
		}
		function parseArgs(raw) {
			try {
				const parsed = JSON.parse(raw);
				return typeof parsed === "object" && parsed !== null ? parsed : {};
			} catch {
				return {};
			}
		}
		/** The output files as links (the images themselves are in the model's reply). */
		function MediaLinks({ media, t }) {
			if (media.length === 0) return (0, react.createElement)("div", { className: "dsc-meta" }, t("cardEmpty"));
			return (0, react.createElement)("div", { className: "dsc-files" }, (0, react.createElement)("span", { className: "dsc-meta" }, t("cardInReply")), media.map((item) => (0, react.createElement)("a", {
				key: `${item.node}-${item.index}-${item.filename}`,
				className: "dsc-file",
				href: item.url,
				target: "_blank",
				rel: "noreferrer",
				title: item.filename
			}, item.filename)));
		}
		/**
		* Follow one prompt's live state while a call is in flight.
		*
		* Polls `/comfyui/live`, which the host answers from ComfyUI's WebSocket
		* feed — no upstream request, no queue scan, and it carries the step
		* counter plus an ETA. A running sync call does not know its prompt id yet,
		* so without one this follows the running task (sync calls block, so that
		* is the call's own).
		*/
		function useQueueState(promptId, active) {
			const [state, setState] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (!active) return void 0;
				let stopped = false;
				let timer;
				const poll = async () => {
					try {
						const data = await (await fetch("/comfyui/live", { headers: { accept: "application/json" } })).json();
						if (stopped) return;
						if (data.ok !== true) {
							if (!stopped) timer = window.setTimeout(() => { poll(); }, 2e3);
							return;
						}
						const tasks = Array.isArray(data.tasks) ? data.tasks : [];
						const mine = promptId !== void 0
							? tasks.find((task) => task.promptId === promptId)
							: tasks.find((task) => task.state === "running");
						if (mine !== void 0 && mine.state === "running") {
							setState({
								phase: "running",
								value: typeof mine.value === "number" ? mine.value : 0,
								max: typeof mine.max === "number" ? mine.max : 0,
								etaMs: typeof mine.etaMs === "number" ? mine.etaMs : null
							});
						} else if (mine !== void 0 && mine.state === "pending") {
							setState({ phase: "pending", ahead: 0 });
						} else {
							const remaining = typeof data.socket?.queueRemaining === "number" ? data.socket.queueRemaining : 0;
							setState(remaining > 0 ? { phase: "pending", ahead: Math.max(0, remaining - 1) } : null);
						}
					} catch {}
					if (!stopped) timer = window.setTimeout(() => {
						poll();
					}, 1500);
				};
				poll();
				return () => {
					stopped = true;
					if (timer !== void 0) window.clearTimeout(timer);
				};
			}, [promptId, active]);
			return state;
		}
		function ProgressLine({ state, t }) {
			if (state === null) return (0, react.createElement)("div", { className: "dsc-meta" }, t("cardWaiting"));
			if (state.phase === "pending") return (0, react.createElement)("div", { className: "dsc-meta" }, t("cardQueued", { n: state.ahead }));
			const percent = state.max > 0 ? Math.min(100, Math.round(state.value / state.max * 100)) : 0;
			const eta = typeof state.etaMs === "number" && state.etaMs > 0 ? ` · ${t("cardEta", { s: Math.max(1, Math.ceil(state.etaMs / 1000)) })}` : "";
			return (0, react.createElement)("div", { className: "dsc-progress" }, (0, react.createElement)("div", { className: "dsc-progress-track" }, (0, react.createElement)("div", {
				className: state.max > 0 ? "dsc-progress-fill" : "dsc-progress-fill dsc-progress-fill--busy",
				style: state.max > 0 ? { width: `${percent}%` } : void 0
			})), (0, react.createElement)("span", { className: "dsc-meta" }, state.max > 0 ? `${t("cardStep", {
				value: state.value,
				max: state.max
			})}${eta}` : t("cardWaiting")));
		}
		/** A saved workflow's name by id, for the running card of comfyui_workflow run. */
		function useWorkflowName(id) {
			const [name, setName] = (0, react.useState)(void 0);
			(0, react.useEffect)(() => {
				if (id === void 0) return void 0;
				let stopped = false;
				fetch("/comfyui/workflows", { headers: { accept: "application/json" } }).then(async (response) => await response.json()).then((data) => {
					const found = data.workflows?.find((workflow) => workflow.id === id);
					if (!stopped && found !== void 0) setName(found.name);
				}).catch(() => void 0);
				return () => {
					stopped = true;
				};
			}, [id]);
			return name;
		}
		function ResultCard({ title, result, t }) {
			const failed = result.status === "interrupted";
			return (0, react.createElement)("div", { className: "dsc-card" }, (0, react.createElement)("div", { className: "dsc-card-head" }, title !== "" ? (0, react.createElement)("span", { className: "dsc-badge" }, title) : null, (0, react.createElement)("span", { className: failed ? "dsc-badge dsc-badge--err" : "dsc-badge dsc-badge--ok" }, failed ? t("cardInterrupted") : result.status), (0, react.createElement)("span", { className: "dsc-meta" }, `${t("cardPrompt")} ${result.promptId}`), (0, react.createElement)("span", { className: "dsc-meta" }, `${t("cardElapsed")} ${result.elapsedMs} ms`)), (0, react.createElement)("div", { className: "dsc-meta" }, result.summary), (0, react.createElement)(MediaLinks, {
				media: result.media,
				t
			}));
		}
		/** Transient-failure retry budget for the jobs/media poll (backoff steps). */
		const POLL_MAX_FAILURES = 20;
		/** 'unknown' grace polls (~5 min at 3 s) before treating history as evicted.
		* The route answers 'queued' while ComfyUI still holds the prompt, so this
		* only counts polls where the job is in neither history nor the queue. */
		const POLL_UNKNOWN_GRACE = 100;
		function BackgroundCard({ label, promptId, t }) {
			const [result, setResult] = (0, react.useState)(null);
			const queue = useQueueState(promptId, result === null);
			(0, react.useEffect)(() => {
				let stopped = false;
				let timer;
				let failures = 0;
				let unknowns = 0;
				const schedule = (delay, fn) => {
					timer = window.setTimeout(fn, delay);
				};
				const recoverFromAssets = async () => {
					try {
						const data = await (await fetch("/comfyui/assets", { headers: { accept: "application/json" } })).json();
						if (stopped || data.ok !== true || !Array.isArray(data.assets)) return null;
						const media = data.assets.find((entry) => entry.promptId === promptId)?.media ?? [];
						return media.length > 0 ? media : null;
					} catch {
						return null;
					}
				};
				const poll = async () => {
					try {
						const data = await (await fetch(`/comfyui/jobs/media?promptId=${encodeURIComponent(promptId)}`, { headers: { accept: "application/json" } })).json();
						if (stopped) return;
						if (data.ok !== true || data.status === void 0) throw new Error(data.error ?? "invalid jobs/media response");
						failures = 0;
						if (data.status === "completed" || data.status === "failed") {
							setResult({
								status: data.status,
								media: data.media,
								error: data.error
							});
							return;
						}
						if (data.status === "unknown") {
							unknowns += 1;
							const recovered = await recoverFromAssets();
							if (stopped) return;
							if (recovered !== null) {
								setResult({
									status: "completed",
									media: recovered,
									recovered: true
								});
								return;
							}
							if (unknowns > POLL_UNKNOWN_GRACE) {
								setResult({
									status: "completed",
									media: []
								});
								return;
							}
							schedule(3e3, () => {
								poll();
							});
							return;
						}
						unknowns = 0;
						schedule(3e3, () => {
							poll();
						});
					} catch (error) {
						if (stopped) return;
						failures += 1;
						if (failures > POLL_MAX_FAILURES) {
							const message = error instanceof Error ? error.message : String(error);
							setResult({
								status: "failed",
								error: t("cardPollStalled", {
									n: POLL_MAX_FAILURES,
									message
								})
							});
							return;
						}
						schedule(Math.min(3e3 * failures, 3e4), () => {
							poll();
						});
					}
				};
				poll();
				return () => {
					stopped = true;
					if (timer !== void 0) window.clearTimeout(timer);
				};
			}, [promptId, t]);
			if (result !== null && (result.status === "completed" || result.status === "failed")) {
				const media = result.media ?? [];
				return (0, react.createElement)("div", { className: "dsc-card" }, (0, react.createElement)("div", { className: "dsc-card-head" }, (0, react.createElement)("span", { className: result.status === "failed" ? "dsc-badge dsc-badge--err" : "dsc-badge dsc-badge--ok" }, result.status === "failed" ? t("cardFailed") : t("cardBackgroundDone")), (0, react.createElement)("span", { className: "dsc-meta" }, `${label} · ${promptId}`)), result.status !== "failed" && result.recovered === true ? (0, react.createElement)("div", { className: "dsc-meta" }, t("cardRecovered")) : null, result.status === "failed" ? (0, react.createElement)("div", { className: "dsc-meta dsc-job-error" }, result.error ?? t("cardFailed")) : (0, react.createElement)(MediaLinks, {
					media,
					t
				}));
			}
			return (0, react.createElement)("div", { className: "dsc-card" }, (0, react.createElement)("div", { className: "dsc-card-head" }, (0, react.createElement)("span", { className: "dsc-badge" }, t("cardBackground")), (0, react.createElement)("span", { className: "dsc-meta" }, `${label} · ${promptId}`)), (0, react.createElement)(ProgressLine, {
				state: queue,
				t
			}));
		}
		function SettledCard({ block, t }) {
			if (block.isError === true) return (0, react.createElement)("div", { className: "dsc-card" }, (0, react.createElement)("div", { className: "dsc-card-head" }, (0, react.createElement)("span", { className: "dsc-badge dsc-badge--err" }, t("cardFailed"))), (0, react.createElement)("div", { className: "dsc-meta" }, block.error?.name ?? "error"));
			const meta = block.meta;
			if (meta === void 0 || typeof meta !== "object") return (0, react.createElement)("div", { className: "dsc-card" }, (0, react.createElement)("span", { className: "dsc-badge" }, block.call?.name ?? "comfyui"));
			if ("action" in meta) {
				if (meta.action === "run") {
					if (meta.background !== void 0) return (0, react.createElement)(BackgroundCard, {
						label: meta.workflowName ?? "",
						promptId: meta.background.promptId,
						t
					});
					if (meta.result !== void 0) return (0, react.createElement)(ResultCard, {
						title: meta.workflowName ?? "",
						result: meta.result,
						t
					});
				}
				if (meta.action === "list") {
					const runs = meta.workflows?.length ?? 0;
					const graphs = meta.comfyuiWorkflows?.length ?? 0;
					return (0, react.createElement)("div", { className: "dsc-card" }, (0, react.createElement)("div", { className: "dsc-card-head" }, (0, react.createElement)("span", { className: "dsc-badge" }, "comfyui_workflow")), (0, react.createElement)("div", { className: "dsc-meta" }, t("cardListed", {
						runs,
						graphs
					})));
				}
				if (meta.action === "get") return (0, react.createElement)("div", { className: "dsc-card" }, (0, react.createElement)("div", { className: "dsc-card-head" }, (0, react.createElement)("span", { className: "dsc-badge" }, "comfyui_workflow")), (0, react.createElement)("div", { className: "dsc-meta" }, meta.name ?? meta.id ?? "get"));
				return (0, react.createElement)("div", { className: "dsc-card" }, (0, react.createElement)("span", { className: "dsc-badge" }, "comfyui_workflow"));
			}
			if (meta.kind === "background") return (0, react.createElement)(BackgroundCard, {
				label: meta.label,
				promptId: meta.promptId,
				t
			});
			return (0, react.createElement)(ResultCard, {
				title: "",
				result: meta,
				t
			});
		}
		/** A call still running: what is generating, and how far along it is. */
		function RunningCard({ block, t }) {
			const args = parseArgs(block.argsRaw);
			const isRun = block.name === "comfyui_run" || args.action === "run";
			const workflowId = block.name === "comfyui_workflow" && typeof args.id === "string" ? args.id : void 0;
			const savedName = useWorkflowName(isRun ? workflowId : void 0);
			const queue = useQueueState(void 0, isRun && args.mode !== "async");
			if (!isRun) return (0, react.createElement)("div", { className: "dsc-card" }, (0, react.createElement)("div", { className: "dsc-card-head" }, (0, react.createElement)("span", { className: "dsc-badge" }, block.name), typeof args.action === "string" ? (0, react.createElement)("span", { className: "dsc-meta" }, args.action) : null));
			const title = block.name === "comfyui_run" ? t("cardHandWritten") : savedName ?? workflowId ?? "";
			return (0, react.createElement)("div", { className: "dsc-card" }, (0, react.createElement)("div", { className: "dsc-card-head" }, (0, react.createElement)("span", { className: "dsc-badge" }, t("cardGenerating")), title !== "" ? (0, react.createElement)("span", { className: "dsc-meta" }, `${t("cardWorkflow")} ${title}`) : null, (0, react.createElement)("span", { className: "dsc-meta" }, `${t("cardMode")} ${String(args.mode ?? "sync")}`)), args.mode === "async" ? null : (0, react.createElement)(ProgressLine, {
				state: queue,
				t
			}));
		}
		/** The card component: picks running vs settled rendering from the block. */
		function ComfyUICard({ t, block }) {
			if (isResultNode(block)) return (0, react.createElement)(SettledCard, {
				block,
				t
			});
			return (0, react.createElement)(RunningCard, {
				block,
				t
			});
		}
		//#endregion
		//#region src/client/api.ts
		/** Same-origin JSON helpers shared by the settings page and the panel. */
		async function getJson(url) {
			const response = await fetch(url, { headers: { accept: "application/json" } });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			return await response.json();
		}
		/**
		* GET a list endpoint and return the array under `key`. Routes report failure
		* as HTTP 200 `{ ok: false, error }`, so a plain getJson hands the caller
		* `undefined` for the list — which crashed the whole panel on `.length` inside
		* the slot error boundary, i.e. "click does nothing" (Issue #5). Throwing the
		* route's error instead lets the caller show it next to the section.
		*/
		async function getList(url, key) {
			const data = await getJson(url);
			const list = data[key];
			if (Array.isArray(list)) return list;
			throw new Error(typeof data.error === "string" ? data.error : `unexpected response from ${url}`);
		}
		async function postJson(url, body) {
			const response = await fetch(url, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body)
			});
			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				throw new Error(payload.error ?? `HTTP ${response.status}`);
			}
			return response.json();
		}
		/** POST raw bytes (an imported file) and read the JSON reply. */
		async function postRaw(url, bytes) {
			const response = await fetch(url, {
				method: "POST",
				headers: { "content-type": "application/octet-stream" },
				body: bytes
			});
			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				throw new Error(payload.error ?? `HTTP ${response.status}`);
			}
			return response.json();
		}
		//#endregion
		//#region src/client/settings.tsx
		/**
		* The ComfyUI settings page (settings.section, id 'comfyui'). Reads the
		* redacted host config over /comfyui/config, persists edits through the same
		* route, and probes the server over /comfyui/test.
		*/
		/**
		* What this plugin is and what it can do — the introduction shown at the top
		* of the first settings tab. Collapsed by default so the connection form
		* stays the first thing a returning user sees.
		*/
		const ABOUT_POINTS = {
			zh: [
				"一个入口管全部：ComfyUI 工作流库 + 本地出图/修图/放大/扩图/捏人 + 服务启停 + 作品库/风格库/提示词衣柜，模型侧共 14 个工具。",
				"实时进度：面板标题栏那行是实时的「正在生成 · 步数 · 预计剩余 · 队列深度」，数据来自 ComfyUI 的 WebSocket 事件；「任务」页有整条进度卡，工具卡片也会显示步数与 ETA。",
				"工作流：ComfyUI 画布保存的「图工作流」可以提取成可运行的 API 工作流（整体 / 按分量 / 只取主流程），面板底部「加载区」会把素材按顺序喂给未显式传值的加载参数。",
				"出图：draw_image / inpaint_image / outpaint_image / character_image / upscale_image，9 步 sigma 表（turbo9），大画布自动加步；视频工作流走 async 后台任务，等预算用完也不丢结果。",
				"作品库直接扫出图目录，记 prompt/seed，支持检索、收藏、复用参数与回收站；风格库 62 条提示词积木；衣柜按档位随机组合整段提示词。",
				"面板：拖动标题栏移动、右下角缩放、Esc 关闭；工作流与资产存在 DSH 数据目录，作品库本身以磁盘为准。",
			],
			en: [
				"One entry point for everything: the ComfyUI workflow library, local generate/edit/upscale/outpaint/character, server start-stop, plus gallery, style library and prompt wardrobe — 14 tools for the model in total.",
				"Live progress: the line under the panel title shows what is generating, the step counter, an ETA and the queue depth straight from ComfyUI's WebSocket events; the Tasks tab has a full progress card and tool cards show steps plus ETA.",
				"Workflows: graphs saved in ComfyUI can be extracted into runnable API workflows (whole / per component / main flow only), and the load area at the bottom of the panel feeds media into loader parameters you did not pass explicitly.",
				"Generation: draw_image / inpaint_image / outpaint_image / character_image / upscale_image run on a 9-step sigma table (turbo9) that adds steps for large canvases; video workflows run as async background jobs and no longer lose their result when the wait budget ends.",
				"Gallery: scans the output folder directly, remembers prompt/seed, supports search, favourites, parameter replay and a trash can. 62 style blocks plus a level-gated wardrobe that composes whole prompts.",
				"Panel: drag the header to move, the corner to resize, Esc to close. Workflows and assets live in the DSH data directory; the gallery always reflects what is on disk.",
			],
		};
		function SuiteAbout({ t }) {
			const points = ABOUT_POINTS[getLang() === "en" ? "en" : "zh"];
			return (0, react.createElement)("details", { className: "dsc-about" }, (0, react.createElement)("summary", null, t("aboutTitle")), (0, react.createElement)("ul", { className: "dsc-about-list" }, points.map((point, index) => (0, react.createElement)("li", { key: index }, point))), (0, react.createElement)("div", { className: "dsc-hint" }, t("aboutHint")));
		}
		/** The ComfyUI settings page component. */
		function ComfyUISettings({ t }) {
			const [config, setConfig] = (0, react.useState)(null);
			const [baseUrl, setBaseUrl] = (0, react.useState)("");
			const [apiKeyEnv, setApiKeyEnv] = (0, react.useState)("");
			const [mediaHost, setMediaHost] = (0, react.useState)("");
			const [comfyuiDirs, setComfyuiDirs] = (0, react.useState)([]);
			const [skillsDir, setSkillsDir] = (0, react.useState)("");
			const [loadError, setLoadError] = (0, react.useState)(null);
			const [saving, setSaving] = (0, react.useState)(false);
			const [saveState, setSaveState] = (0, react.useState)("idle");
			const [testing, setTesting] = (0, react.useState)(false);
			const [testResult, setTestResult] = (0, react.useState)(null);
			const [lang, setLangState] = (0, react.useState)(getLang());
			(0, react.useEffect)(() => {
				let cancelled = false;
				getJson("/comfyui/config").then((view) => {
					if (cancelled) return;
					setConfig(view);
					setBaseUrl(view.baseUrl);
					setApiKeyEnv(view.apiKeyEnv);
					setMediaHost(view.mediaHost ?? "");
					setComfyuiDirs(Array.isArray(view.comfyuiDirs) ? view.comfyuiDirs : []);
					setSkillsDir(view.skillsDir ?? "");
				}).catch((error) => {
					if (cancelled) return;
					setLoadError(error instanceof Error ? error.message : String(error));
				});
				return () => {
					cancelled = true;
				};
			}, []);
			const save = async () => {
				setSaving(true);
				setSaveState("idle");
				try {
					const dirs = comfyuiDirs.map((dir) => dir.trim()).filter((dir) => dir !== "");
					const payload = await postJson("/comfyui/config", { patch: {
						baseUrl,
						apiKeyEnv,
						mediaHost,
						comfyuiDirs: dirs,
						skillsDir: skillsDir.trim()
					} });
					if (payload.config !== void 0) {
						setConfig(payload.config);
						setBaseUrl(payload.config.baseUrl);
						setApiKeyEnv(payload.config.apiKeyEnv);
						setMediaHost(payload.config.mediaHost ?? "");
						setComfyuiDirs(payload.config.comfyuiDirs ?? []);
						setSkillsDir(payload.config.skillsDir ?? "");
					}
					setSaveState("saved");
				} catch (error) {
					setSaveState("failed");
					setTestResult({
						ok: false,
						text: error instanceof Error ? error.message : String(error)
					});
				} finally {
					setSaving(false);
				}
			};
			const test = async () => {
				setTesting(true);
				setTestResult(null);
				try {
					const payload = await postJson("/comfyui/test", {});
					if (payload.ok === true) setTestResult({
						ok: true,
						text: t("testOk", {
							version: payload.version ?? "unknown",
							ms: payload.latencyMs ?? 0
						})
					});
					else setTestResult({
						ok: false,
						text: t("testFail", { message: payload.error ?? "unknown error" })
					});
				} catch (error) {
					setTestResult({
						ok: false,
						text: t("testFail", { message: error instanceof Error ? error.message : String(error) })
					});
				} finally {
					setTesting(false);
				}
			};
			if (loadError !== null) return (0, react.createElement)("div", { className: "dsc-card" }, (0, react.createElement)("div", { className: "dsc-meta" }, `${t("saveFailed")}: ${loadError}`));
			if (config === null) return (0, react.createElement)("div", { className: "dsc-card" }, (0, react.createElement)("div", { className: "dsc-meta" }, "…"));
			return (0, react.createElement)("div", { className: "dsc-form" }, (0, react.createElement)("div", { className: "dsc-meta" }, t("settingsDesc")), (0, react.createElement)(SuiteAbout, { t }), (0, react.createElement)("div", { className: "dsc-field" }, (0, react.createElement)("label", null, t("language")), (0, react.createElement)("select", {
				className: "dsc-input",
				value: lang,
				onChange: (event) => {
					const next = event.target.value === "en" ? "en" : "zh";
					setLangState(next);
					setLang(next);
					window.location.reload();
				}
			}, (0, react.createElement)("option", { value: "zh" }, "中文"), (0, react.createElement)("option", { value: "en" }, "English")), (0, react.createElement)("div", { className: "dsc-hint" }, t("languageHint"))), (0, react.createElement)("div", { className: "dsc-field" }, (0, react.createElement)("label", null, t("baseUrl")), (0, react.createElement)("input", {
				value: baseUrl,
				placeholder: "http://127.0.0.1:8188",
				onChange: (event) => {
					setBaseUrl(event.target.value);
					setSaveState("idle");
				}
			}), (0, react.createElement)("div", { className: "dsc-hint" }, t("baseUrlHint"))), (0, react.createElement)("div", { className: "dsc-field" }, (0, react.createElement)("label", null, t("apiKeyEnv")), (0, react.createElement)("input", {
				value: apiKeyEnv,
				placeholder: "COMFYUI_API_KEY",
				onChange: (event) => {
					setApiKeyEnv(event.target.value);
					setSaveState("idle");
				}
			}), (0, react.createElement)("div", { className: "dsc-hint" }, `${t("apiKeyEnvHint")} — ${config.hasApiKey ? t("hasApiKey") : t("noApiKey")}`)), (0, react.createElement)("div", { className: "dsc-field" }, (0, react.createElement)("label", null, t("mediaHost")), (0, react.createElement)("input", {
				value: mediaHost,
				placeholder: "http://192.168.1.5:3080",
				onChange: (event) => {
					setMediaHost(event.target.value);
					setSaveState("idle");
				}
			}), (0, react.createElement)("div", { className: "dsc-hint" }, t("mediaHostHint"))), (0, react.createElement)("div", { className: "dsc-field" }, (0, react.createElement)("label", null, t("comfyuiDirs")), comfyuiDirs.map((dir, index) => (0, react.createElement)("div", {
				key: `dsc-dir-${index}`,
				style: {
					display: "flex",
					gap: "8px",
					marginBottom: "8px",
					alignItems: "center"
				}
			}, (0, react.createElement)("input", {
				className: "dsc-input",
				value: dir,
				placeholder: t("comfyuiDirPlaceholder"),
				style: { flex: "1" },
				onChange: (event) => {
					const next = comfyuiDirs.slice();
					next[index] = event.target.value;
					setComfyuiDirs(next);
					setSaveState("idle");
				}
			}), (0, react.createElement)("button", {
				className: "dsc-btn",
				title: t("comfyuiDirRemove"),
				disabled: !config.writable,
				onClick: () => {
					const next = comfyuiDirs.slice();
					next.splice(index, 1);
					setComfyuiDirs(next);
					setSaveState("idle");
				}
			}, "×"))), (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: !config.writable,
				onClick: () => {
					setComfyuiDirs([...comfyuiDirs, ""]);
					setSaveState("idle");
				}
			}, t("comfyuiDirAdd")), (0, react.createElement)("div", { className: "dsc-hint" }, t("comfyuiDirsHint"))), (0, react.createElement)("div", { className: "dsc-field" }, (0, react.createElement)("label", null, t("skillsDir")), (0, react.createElement)("input", {
				className: "dsc-input",
				value: skillsDir,
				placeholder: config.skillsRoot,
				onChange: (event) => {
					setSkillsDir(event.target.value);
					setSaveState("idle");
				}
			}), (0, react.createElement)("div", { className: "dsc-hint" }, t("skillsDirHint", { current: config.skillsRoot }))), (0, react.createElement)("div", { className: "dsc-row" }, (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: saving || !config.writable,
				onClick: () => void save()
			}, t("save")), (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: testing,
				onClick: () => void test()
			}, testing ? t("testing") : t("test")), saveState === "saved" ? (0, react.createElement)("span", { className: "dsc-note" }, t("saved")) : null, saveState === "failed" ? (0, react.createElement)("span", { className: "dsc-note" }, t("saveFailed")) : null), testResult !== null ? (0, react.createElement)("div", {
				className: testResult.ok ? "dsc-note" : "dsc-note",
				style: testResult.ok ? { color: "#22c55e" } : { color: "#ef4444" }
			}, testResult.text) : null, config.writable ? null : (0, react.createElement)("div", { className: "dsc-hint" }, t("configNotWritable")));
		}
		//#endregion
		//#region src/client/panel-store.ts
		/**
		* Shared open/close/tab state for the ComfyUI panel. The overlay occupant
		* and the session-header trigger are separate registrations in one bundle,
		* so they coordinate through this module-level store plus useSyncExternalStore.
		*/
		const listeners$1 = /* @__PURE__ */ new Set();
		let open = false;
		let tab = "workflows";
		let assetFilter = "";
		function emit$1() {
			for (const listener of listeners$1) listener();
		}
		const panelStore = {
			isOpen: () => open,
			toggle: () => {
				open = !open;
				emit$1();
			},
			open: () => {
				if (!open) {
					open = true;
					emit$1();
				}
			},
			close: () => {
				if (open) {
					open = false;
					emit$1();
				}
			},
			getTab: () => tab,
			setTab: (next) => {
				if (tab !== next) {
					tab = next;
					emit$1();
				}
			},
			getAssetFilter: () => assetFilter,
			setAssetFilter: (name) => {
				if (assetFilter !== name) {
					assetFilter = name;
					emit$1();
				}
			},
			subscribe(listener) {
				listeners$1.add(listener);
				return () => {
					listeners$1.delete(listener);
				};
			}
		};
		/** React hook reading the panel open state. */
		function usePanelOpen() {
			return (0, react.useSyncExternalStore)(panelStore.subscribe, panelStore.isOpen, panelStore.isOpen);
		}
		/** React hook reading the active panel tab. */
		function usePanelTab() {
			return (0, react.useSyncExternalStore)(panelStore.subscribe, panelStore.getTab, panelStore.getTab);
		}
		//#endregion
		//#region src/client/connection.tsx
		/**
		* Connection probe + reminder toast. Opening the panel used to give zero
		* feedback when ComfyUI was down: the workflows/queue tabs just stayed empty
		* with no explanation. The header trigger now fires a real backend probe
		* (POST /comfyui/test → the host connects to the configured ComfyUI server —
		* local port or remote URL alike); when it fails, the panel closes again —
		* the trigger must not stay highlighted against a dead backend — and a fixed
		* toast at the top of the page tells the user to start ComfyUI or fix the
		* server address. The probe never blocks the panel: it opens immediately,
		* the toast settles whenever the probe answers.
		*/
		const listeners = /* @__PURE__ */ new Set();
		let state = { status: "hidden" };
		/** Dedupe concurrent probes (rapid trigger clicks). */
		let inFlight = null;
		/** Skip re-probing while a "connected" verdict is still fresh. */
		let lastOkAt = 0;
		/** The ok toast only shows on fail→ok transitions, never on healthy opens. */
		let hadFailure = false;
		let okHideTimer = null;
		function emit() {
			for (const listener of listeners) listener();
		}
		function setState(next) {
			state = next;
			emit();
		}
		function clearOkTimer() {
			if (okHideTimer !== null) {
				clearTimeout(okHideTimer);
				okHideTimer = null;
			}
		}
		/** Close button on the toast; also ends the transient ok feedback early. */
		function dismissConnectionToast() {
			clearOkTimer();
			if (state.status !== "hidden") setState({ status: "hidden" });
		}
		/**
		* Probe the ComfyUI server through the host and surface the result as toast
		* state. A success within the last 30s skips the round-trip entirely, so
		* healthy repeated panel opens do not hammer the server; failures always
		* re-probe on the next open (the user may have just started ComfyUI).
		*/
		function probeConnection() {
			if (inFlight !== null) return inFlight;
			if (Date.now() - lastOkAt < 3e4) return Promise.resolve();
			if (state.status !== "fail") {
				clearOkTimer();
				setState({ status: "probing" });
			}
			inFlight = (async () => {
				try {
					const payload = await postJson("/comfyui/test", {});
					if (payload.ok === true) {
						lastOkAt = Date.now();
						const recovered = hadFailure;
						hadFailure = false;
						if (recovered) {
							setState({
								status: "ok",
								version: payload.version,
								latencyMs: payload.latencyMs
							});
							clearOkTimer();
							okHideTimer = setTimeout(dismissConnectionToast, 4e3);
						} else setState({ status: "hidden" });
					} else {
						hadFailure = true;
						setState({
							status: "fail",
							message: payload.error ?? "unknown error"
						});
						panelStore.close();
					}
				} catch (error) {
					hadFailure = true;
					setState({
						status: "fail",
						message: error instanceof Error ? error.message : String(error)
					});
					panelStore.close();
				} finally {
					inFlight = null;
				}
			})();
			return inFlight;
		}
		function getConnState() {
			return state;
		}
		function subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
		/** Fixed top-center status toast; mounted next to the header trigger so it
		* renders (and can be dismissed) even when the panel is closed again. The
		* probing variant fades in after a short CSS delay, so a fast successful
		* probe never paints anything. */
		function ConnectionToast({ t }) {
			const conn = (0, react.useSyncExternalStore)(subscribe, getConnState, getConnState);
			if (conn.status === "hidden") return null;
			return (0, react.createElement)("div", {
				className: `dsc-conn-toast dsc-conn-toast--${conn.status}`,
				role: "status"
			}, (0, react.createElement)("span", {
				className: "dsc-conn-toast-dot",
				"aria-hidden": true
			}), (0, react.createElement)("div", { className: "dsc-conn-toast-body" }, conn.status === "fail" ? (0, react.createElement)("div", { className: "dsc-conn-toast-body-inner" }, (0, react.createElement)("div", { className: "dsc-conn-toast-title" }, t("connFailTitle")), (0, react.createElement)("div", { className: "dsc-conn-toast-text" }, t("connFailBody", { message: conn.message ?? "" }))) : (0, react.createElement)("div", { className: "dsc-conn-toast-title" }, conn.status === "probing" ? t("connChecking") : t("connOk", {
				version: conn.version ?? "unknown",
				ms: conn.latencyMs ?? 0
			}))), (0, react.createElement)("button", {
				className: "dsc-conn-toast-close",
				"aria-label": t("close"),
				onClick: dismissConnectionToast
			}, "✕"));
		}
		//#endregion
		//#region src/client/trigger.tsx
		/**
		* The session-header trigger (conversation.session.header.actions, id
		* 'comfyui'): a labelled button that toggles the ComfyUI panel, plus the
		* connection reminder toast shown when the backend cannot reach ComfyUI.
		*/
		/**
		* ComfyUI brand glyph (mono), inlined from @lobehub/icons-static-svg
		* (lobehub.com/icons). currentColor fill keeps it theme-aware.
		*/
		function ComfyUIIcon() {
			return (0, react.createElement)("svg", {
				viewBox: "0 0 24 24",
				width: "1em",
				height: "1em",
				fill: "currentColor",
				fillRule: "evenodd",
				style: {
					flex: "none",
					lineHeight: 1
				},
				"aria-hidden": true
			}, (0, react.createElement)("path", { d: "M5.485 23.76c-.568 0-1.026-.207-1.325-.598-.307-.402-.387-.964-.22-1.54l.672-2.315a.605.605 0 00-.1-.536.622.622 0 00-.494-.243H2.085c-.568 0-1.026-.207-1.325-.598-.307-.403-.387-.964-.22-1.54l2.31-7.917.255-.87c.343-1.18 1.592-2.14 2.786-2.14h2.313c.276 0 .519-.18.595-.442l.764-2.633C9.906 1.208 11.155.249 12.35.249l4.945-.008h3.62c.568 0 1.027.206 1.325.597.307.402.387.964.22 1.54l-1.035 3.566c-.343 1.178-1.593 2.137-2.787 2.137l-4.956.01H11.37a.618.618 0 00-.594.441l-1.928 6.604a.605.605 0 00.1.537c.118.153.3.243.495.243l3.275-.006h3.61c.568 0 1.026.206 1.325.598.307.402.387.964.22 1.54l-1.036 3.565c-.342 1.179-1.592 2.138-2.786 2.138l-4.957.01h-3.61z" }));
		}
		/** Header-action button toggling the ComfyUI panel. Opening it also fires a
		* backend connectivity probe: when ComfyUI is down, a reminder toast explains
		* why the panel stays empty instead of the click appearing to do nothing. */
		function ComfyUITrigger({ t }) {
			const open = usePanelOpen();
			return (0, react.createElement)(react.Fragment, null, (0, react.createElement)("button", {
				className: "dsc-trigger",
				title: t("panelTitle"),
				"aria-label": t("panelTitle"),
				"aria-pressed": open,
				onClick: () => {
					const opening = !panelStore.isOpen();
					panelStore.toggle();
					if (opening) probeConnection();
				}
			}, (0, react.createElement)("span", { className: "dsc-trigger-glyph" }, (0, react.createElement)(ComfyUIIcon)), (0, react.createElement)("span", null, t("panelTitle"))), (0, react.createElement)(ConnectionToast, { t }));
		}
		//#endregion
		//#region src/client/lightbox.tsx
		/**
		* Shared lightbox: opens a generated image full-screen with prev/next
		* navigation, keyboard support, and a download pill. Used by both the panel
		* (assets/queue previews) and the tool card (result images).
		*/
		/** Full-screen media overlay with prev/next navigation. */
		function Lightbox({ t, images, kinds, index, onClose, onIndex }) {
			const count = images.length;
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key === "Escape") onClose();
					else if (event.key === "ArrowLeft") onIndex((index - 1 + count) % count);
					else if (event.key === "ArrowRight") onIndex((index + 1) % count);
				};
				document.addEventListener("keydown", onKey);
				return () => document.removeEventListener("keydown", onKey);
			}, [
				index,
				count,
				onClose,
				onIndex
			]);
			const src = images[index];
			if (src === void 0) return null;
			const kind = kinds?.[index] ?? "image";
			const media = kind === "video" ? (0, react.createElement)("video", {
				className: "dsc-lightbox-media",
				src,
				controls: true,
				autoPlay: true
			}) : kind === "audio" ? (0, react.createElement)("audio", {
				className: "dsc-lightbox-media",
				src,
				controls: true,
				autoPlay: true
			}) : kind === "image" ? (0, react.createElement)("img", {
				className: "dsc-lightbox-img",
				src,
				alt: ""
			}) : (0, react.createElement)("div", { className: "dsc-lightbox-media" }, src);
			return (0, react.createElement)("div", {
				className: "dsc-lightbox",
				onClick: onClose
			}, (0, react.createElement)("div", {
				className: "dsc-lightbox-body",
				onClick: (event) => event.stopPropagation()
			}, (0, react.createElement)("button", {
				className: "dsc-lightbox-close",
				"aria-label": t("close"),
				onClick: (event) => {
					event.stopPropagation();
					onClose();
				}
			}, "✕"), count > 1 ? (0, react.createElement)("button", {
				className: "dsc-lightbox-nav dsc-lightbox-nav--prev",
				"aria-label": t("lbPrev"),
				onClick: (event) => {
					event.stopPropagation();
					onIndex((index - 1 + count) % count);
				}
			}, "‹") : null, media, (0, react.createElement)("div", { className: "dsc-lightbox-meta" }, (0, react.createElement)("span", null, `${index + 1} / ${count}`), (0, react.createElement)("a", {
				className: "dsc-lightbox-download",
				href: src,
				download: "",
				target: "_blank",
				rel: "noreferrer"
			}, t("cardDownload"))), count > 1 ? (0, react.createElement)("button", {
				className: "dsc-lightbox-nav dsc-lightbox-nav--next",
				"aria-label": t("lbNext"),
				onClick: (event) => {
					event.stopPropagation();
					onIndex((index + 1) % count);
				}
			}, "›") : null));
		}
		//#endregion
		//#region src/client/panel.tsx
		/**
		* The ComfyUI panel (shell.overlay, id 'comfyui.panel'): a floating panel
		* with three tabs — workflow library management, generated asset preview,
		* and the live ComfyUI queue. Draggable by its header and resizable via the
		* corner handle; geometry persists in localStorage. Renders null while closed
		* (the overlay layer is click-through, so nothing blocks the app underneath).
		*/
		const GEOM_KEY = "dsh-comfyui-panel-geom";
		function loadGeom() {
			try {
				const raw = localStorage.getItem(GEOM_KEY);
				if (raw === null) return {};
				const parsed = JSON.parse(raw);
				const geom = {};
				if (typeof parsed.x === "number") geom.x = parsed.x;
				if (typeof parsed.y === "number") geom.y = parsed.y;
				if (typeof parsed.width === "number" && parsed.width >= 300) geom.width = parsed.width;
				if (typeof parsed.height === "number" && parsed.height >= 200) geom.height = parsed.height;
				return geom;
			} catch {
				return {};
			}
		}
		function saveGeom(geom) {
			try {
				localStorage.setItem(GEOM_KEY, JSON.stringify(geom));
			} catch {}
		}
		/** Default panel width from styles.ts (`.dsc-panel` width var), used only to
		* estimate the panel extent while clamping a saved position. */
		const PANEL_WIDTH_FALLBACK = 400;
		/** Approx. height of the drag-handle band (`.dsc-panel-head`). */
		const HEAD_BAND = 48;
		/** Minimum margin kept between the panel and the viewport edge. */
		const EDGE = 8;
		/**
		* Clamp a top-left corner so the drag-handle band always stays inside the
		* viewport. The failure this prevents: once the header is pushed past the top
		* edge (or a saved position from a larger monitor no longer fits), there is no
		* grab surface left and the panel cannot be moved back at all.
		*/
		function clampPos(x, y, width, vw, vh) {
			const maxX = Math.max(EDGE, vw - width - EDGE);
			const maxY = Math.max(EDGE, vh - HEAD_BAND - EDGE);
			return {
				x: Math.min(Math.max(x, EDGE), maxX),
				y: Math.min(Math.max(y, EDGE), maxY)
			};
		}
		/** Snap persisted geometry back within reach of the cursor. Geometry that
		* never carried an explicit position (the CSS-anchored default) is returned
		* unchanged; geometry already inside the safe area keeps its object identity
		* so callers can skip pointless re-renders. */
		function healGeom(geom, vw, vh) {
			if (geom.x === void 0 || geom.y === void 0) return geom;
			const pos = clampPos(geom.x, geom.y, geom.width ?? PANEL_WIDTH_FALLBACK, vw, vh);
			if (pos.x === geom.x && pos.y === geom.y) return geom;
			return {
				...geom,
				x: pos.x,
				y: pos.y
			};
		}
		/** Fallback suggestions when the config route has not answered yet; the
		* authoritative list comes from the host (`presetDirs`). */
		const SKILL_FALLBACK_DIRS = [
			"references",
			"scripts",
			"assets"
		];
		/** Imported binaries land in assets/; the editor previews these instead of
		* trying to read them as text. */
		const SKILL_IMAGE_EXTENSIONS = [
			".png",
			".jpg",
			".jpeg",
			".webp",
			".gif",
			".svg"
		];
		function isSkillImage(path) {
			const dot = path.lastIndexOf(".");
			return dot !== -1 && SKILL_IMAGE_EXTENSIONS.includes(path.slice(dot).toLowerCase());
		}
		/** Preset workflow classification tags (users can add custom ones). Stored as
		* plain text, so the tag identity is the label itself. */
		const PRESET_TAGS = [
			"图生图",
			"文生图",
			"文生视频",
			"图生视频",
			"参考生视频",
			"文生音频",
			"参考生音频"
		];
		const JOB_FILTERS = [
			{
				key: "all",
				label: "jobFilterAll"
			},
			{
				key: "completed",
				label: "jobFilterCompleted"
			},
			{
				key: "failed",
				label: "jobFilterFailed"
			},
			{
				key: "cancelled",
				label: "jobFilterCancelled"
			}
		];
		function shortId(promptId) {
			return promptId.length > 10 ? `${promptId.slice(0, 10)}…` : promptId;
		}
		/** Open a job's preview image URL (via the media proxy) when it has one. */
		function previewUrlOf(job) {
			const preview = job.previewOutput;
			if (preview === void 0 || preview === null || preview.filename === void 0 || preview.filename === null) return null;
			return `/comfyui/media?file=${encodeURIComponent(preview.filename)}&subfolder=${encodeURIComponent(preview.subfolder ?? "")}&type=${encodeURIComponent(preview.type ?? "output")}`;
		}
		/** Opens a generated image in a large overlay with prev/next navigation. */
		/** Whether a node input is fed by a link ([nodeId, slot]) rather than a widget value. */
		function isLinkValue(value) {
			return Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && typeof value[1] === "number";
		}
		/** Short description of a node input's current value, for the advanced
		* picker's dropdown. */
		function inputValueKind(value) {
			if (value === null) return "null";
			if (Array.isArray(value)) return "array";
			if (typeof value === "object") return "object";
			return typeof value;
		}
		/** Read a parameter default as a boolean. Defaults saved before the editor
		* had a checkbox are strings ("true"/"false"), so they are coerced here rather
		* than silently reading as `true` for every non-empty string. */
		function asBool(value) {
			if (typeof value === "boolean") return value;
			if (typeof value === "number") return value !== 0;
			return /^(true|1|yes|on)$/i.test(value.trim());
		}
		/** Tooltip for a number field: the declared type and bounds, when known. */
		function numberRangeHint(param) {
			const parts = [param.numberKind ?? "number"];
			if (param.min !== void 0 || param.max !== void 0) parts.push(`${param.min ?? "-∞"} ~ ${param.max ?? "∞"}`);
			if (param.step !== void 0) parts.push(`step ${param.step}`);
			return parts.join(" · ");
		}
		function newParamId() {
			if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
			return `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
		}
		/** Parse the draft workflow into a plain object (empty on invalid JSON). */
		function parseDraftWorkflow(workflow) {
			if (typeof workflow !== "string") return workflow;
			try {
				const parsed = JSON.parse(workflow);
				return typeof parsed === "object" && parsed !== null ? parsed : {};
			} catch {
				return {};
			}
		}
		/**
		* Custom dropdown for loader-node file lists: each option shows a small
		* server-side thumbnail (images only; <select> cannot render images).
		*/
		function UploadSelect(props) {
			const [open, setOpen] = (0, react.useState)(false);
			const [live, setLive] = (0, react.useState)(null);
			const ref = (0, react.useRef)(null);
			const refreshRef = (0, react.useRef)(props.onRefresh);
			refreshRef.current = props.onRefresh;
			(0, react.useEffect)(() => {
				if (!open) return;
				const onDoc = (event) => {
					if (ref.current !== null && !ref.current.contains(event.target)) setOpen(false);
				};
				document.addEventListener("mousedown", onDoc);
				return () => document.removeEventListener("mousedown", onDoc);
			}, [open]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const fn = refreshRef.current;
				if (fn === void 0) return;
				let cancelled = false;
				fn().then((latest) => {
					if (!cancelled && latest !== void 0) setLive(latest);
				});
				return () => {
					cancelled = true;
				};
			}, [open]);
			const options = live ?? props.options;
			const thumbUrl = (name) => props.kind === "image" ? `/comfyui/media?file=${encodeURIComponent(String(name))}&type=input` : null;
			const current = options.some((option) => String(option) === props.value) ? props.value : String(props.value);
			return (0, react.createElement)("div", {
				ref,
				className: "dsc-upload-select"
			}, (0, react.createElement)("button", {
				className: "dsc-upload-select-btn",
				onClick: () => setOpen(!open),
				title: String(current)
			}, thumbUrl(props.value) !== null ? (0, react.createElement)("img", {
				className: "dsc-upload-select-thumb",
				src: thumbUrl(props.value) ?? "",
				alt: "",
				loading: "lazy"
			}) : null, (0, react.createElement)("span", { className: "dsc-upload-select-name" }, String(current))), open ? (0, react.createElement)("div", { className: "dsc-upload-select-pop" }, options.map((option) => {
				const name = String(option);
				return (0, react.createElement)("div", {
					key: name,
					className: `dsc-upload-select-item${name === props.value ? " dsc-upload-select-item--active" : ""}`,
					onClick: () => {
						props.onChange(name);
						setOpen(false);
					}
				}, thumbUrl(option) !== null ? (0, react.createElement)("img", {
					className: "dsc-upload-select-thumb",
					src: thumbUrl(option) ?? "",
					alt: "",
					loading: "lazy"
				}) : null, (0, react.createElement)("span", { className: "dsc-upload-select-name" }, name));
			})) : null);
		}
		/** Merge a freshly fetched option list with the previous one (latest first,
		* deduped) so the dropdown never drops options mid-session. */
		function mergeOptions(prev, latest) {
			const seen = /* @__PURE__ */ new Set();
			const out = [];
			for (const item of [...latest, ...prev]) {
				const key = String(item);
				if (!seen.has(key)) {
					seen.add(key);
					out.push(item);
				}
			}
			return out;
		}
		/** Copy text to the clipboard; falls back to a hidden textarea when the
		* clipboard API is unavailable (non-secure LAN http). */
		function copyText(text) {
			if (navigator.clipboard !== void 0) return navigator.clipboard.writeText(text).then(() => true).catch(() => copyViaTextarea(text));
			return Promise.resolve(copyViaTextarea(text));
		}
		function copyViaTextarea(text) {
			const textarea = document.createElement("textarea");
			textarea.value = text;
			textarea.style.position = "fixed";
			textarea.style.opacity = "0";
			document.body.appendChild(textarea);
			textarea.select();
			let ok = false;
			try {
				ok = document.execCommand("copy");
			} catch {
				ok = false;
			}
			document.body.removeChild(textarea);
			return ok;
		}
		/** Read a file's pixel size in the browser (image only) and report it to the
		* plugin so the workflow output size can default to the source image. Returns
		* the size text for display, or undefined when unreadable. */
		async function recordMediaSize(file, name) {
			try {
				const bitmap = await createImageBitmap(file);
				const width = bitmap.width;
				const height = bitmap.height;
				bitmap.close();
				await fetch("/comfyui/media-size", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name,
						width,
						height
					})
				}).catch(() => void 0);
				return `${width}×${height}`;
			} catch {
				return;
			}
		}
		/** SHA-256 hex digest (pure JS — crypto.subtle needs a secure context, which a
		* LAN http origin is not). Uses the standard padding/compression; the input is
		* any byte array. */
		function sha256Hex(data) {
			const K = new Uint32Array([
				1116352408,
				1899447441,
				3049323471,
				3921009573,
				961987163,
				1508970993,
				2453635748,
				2870763221,
				3624381080,
				310598401,
				607225278,
				1426881987,
				1925078388,
				2162078206,
				2614888103,
				3248222580,
				3835390401,
				4022224774,
				264347078,
				604807628,
				770255983,
				1249150122,
				1555081692,
				1996064986,
				2554220882,
				2821834349,
				2952996808,
				3210313671,
				3336571891,
				3584528711,
				113926993,
				338241895,
				666307205,
				773529912,
				1294757372,
				1396182291,
				1695183700,
				1986661051,
				2177026350,
				2456956037,
				2730485921,
				2820302411,
				3259730800,
				3345764771,
				3516065817,
				3600352804,
				4094571909,
				275423344,
				430227734,
				506948616,
				659060556,
				883997877,
				958139571,
				1322822218,
				1537002063,
				1747873779,
				1955562222,
				2024104815,
				2227730452,
				2361852424,
				2428436474,
				2756734187,
				3204031479,
				3329325298
			]);
			const H = new Uint32Array([
				1779033703,
				3144134277,
				1013904242,
				2773480762,
				1359893119,
				2600822924,
				528734635,
				1541459225
			]);
			const len = data.length;
			const total = len + 1 + (56 - (len + 1) % 64 + 64) % 64 + 8;
			const msg = new Uint8Array(total);
			msg.set(data);
			msg[len] = 128;
			const bitLenLo = len * 8 >>> 0;
			const bitLenHi = Math.floor(len / 536870912);
			const dv = new DataView(msg.buffer);
			dv.setUint32(total - 8, bitLenHi);
			dv.setUint32(total - 4, bitLenLo);
			const w = /* @__PURE__ */ new Uint32Array(64);
			for (let offset = 0; offset < total; offset += 64) {
				for (let i = 0; i < 16; i++) w[i] = dv.getUint32(offset + i * 4);
				for (let i = 16; i < 64; i++) {
					const s0 = (w[i - 15] >>> 7 | w[i - 15] << 25) ^ (w[i - 15] >>> 18 | w[i - 15] << 14) ^ w[i - 15] >>> 3;
					const s1 = (w[i - 2] >>> 17 | w[i - 2] << 15) ^ (w[i - 2] >>> 19 | w[i - 2] << 13) ^ w[i - 2] >>> 10;
					w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
				}
				let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
				for (let i = 0; i < 64; i++) {
					const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
					const ch = e & f ^ ~e & g;
					const temp1 = h + S1 + ch + K[i] + w[i] >>> 0;
					const temp2 = ((a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10)) + (a & b ^ a & c ^ b & c) >>> 0;
					h = g;
					g = f;
					f = e;
					e = d + temp1 >>> 0;
					d = c;
					c = b;
					b = a;
					a = temp1 + temp2 >>> 0;
				}
				H[0] = H[0] + a >>> 0;
				H[1] = H[1] + b >>> 0;
				H[2] = H[2] + c >>> 0;
				H[3] = H[3] + d >>> 0;
				H[4] = H[4] + e >>> 0;
				H[5] = H[5] + f >>> 0;
				H[6] = H[6] + g >>> 0;
				H[7] = H[7] + h >>> 0;
			}
			let out = "";
			for (let i = 0; i < 8; i++) out += H[i].toString(16).padStart(8, "0");
			return out;
		}
		/** `image.png` + hash → `image_3f9a2b1c0d.png`: keeps the name readable while
		* making it content-unique, so re-uploading the same file reuses the name. */
		function renameWithHash(original, hash) {
			const short = hash.slice(0, 10);
			const dot = original.lastIndexOf(".");
			return `${dot > 0 ? original.slice(0, dot) : original}_${short}${dot > 0 ? original.slice(dot) : ""}`;
		}
		/** Upload a file with content-hash naming and dedup: same bytes → same file
		* name, and (for root uploads) the existing file is reused instead of creating
		* a duplicate. Returns the file name on the ComfyUI server. */
		async function uploadDedup(file, subfolder) {
			const hash = sha256Hex(new Uint8Array(await file.arrayBuffer()));
			const dedup = subfolder === void 0 || subfolder === "";
			if (dedup) {
				const lookup = await fetch("/comfyui/media-lookup", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ hash })
				}).then((response) => response.json()).catch(() => void 0);
				if (lookup !== void 0 && lookup.ok === true && lookup.found === true && typeof lookup.name === "string") return lookup.name;
			}
			const renamed = new File([file], renameWithHash(file.name, hash), { type: file.type });
			const form = new FormData();
			form.append("image", renamed);
			if (!dedup) form.append("subfolder", subfolder);
			const data = await (await fetch("/comfyui/upload", {
				method: "POST",
				body: form
			})).json();
			if (data.ok !== true || typeof data.name !== "string") throw new Error(data.error ?? "upload failed");
			if (dedup) await fetch("/comfyui/media-hash", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					hash,
					name: data.name
				})
			}).catch(() => void 0);
			return data.name;
		}
		/**
		* Parameter editor: lists the workflow's adjustable parameters (auto-detected
		* prompt/size/steps/seed) with editable name/label/default and a random
		* toggle for number parameters, plus an "advanced" picker that exposes any
		* node input as a custom parameter.
		*/
		function ParameterEditor(props) {
			const { t, params, workflow, onChange } = props;
			const [advanced, setAdvanced] = (0, react.useState)(false);
			const [advNode, setAdvNode] = (0, react.useState)("");
			const [advInput, setAdvInput] = (0, react.useState)("");
			const [advLabel, setAdvLabel] = (0, react.useState)("");
			const [recognizing, setRecognizing] = (0, react.useState)(false);
			const [recognizeError, setRecognizeError] = (0, react.useState)(null);
			const [uploading, setUploading] = (0, react.useState)({});
			const [numDraft, setNumDraft] = (0, react.useState)({});
			const [hovered, setHovered] = (0, react.useState)(null);
			const hoverRef = (0, react.useRef)(null);
			const latestRef = (0, react.useRef)({
				params,
				uploadFile: async () => void 0
			});
			/** Re-fetch a parameter's live option list (ComfyUI input dir files) and
			* merge it into the stored options, so uploads made anywhere show up in the
			* dropdown without reloading the workflow editor. */
			const refreshOptions = async (param) => {
				const rawNode = workflow[param.nodeId];
				const classType = typeof rawNode?.class_type === "string" ? rawNode.class_type : "";
				if (classType === "") return void 0;
				const result = await postJson("/comfyui/workflows/input-options", {
					classType,
					inputKey: param.inputKey
				});
				if (result.ok !== true || !Array.isArray(result.options)) return void 0;
				const latest = result.options;
				const index = params.findIndex((entry) => entry.id === param.id);
				if (index !== -1 && params[index]?.options !== void 0) update(index, { options: mergeOptions(params[index].options, latest) });
				return latest;
			};
			/** Upload a dropped file through the plugin proxy into ComfyUI's input dir. */
			const uploadFile = async (param, file) => {
				setUploading((prev) => ({
					...prev,
					[param.id]: true
				}));
				try {
					const name = await uploadDedup(file, param.subfolder);
					recordMediaSize(file, name);
					const index = params.findIndex((entry) => entry.id === param.id);
					if (index !== -1) update(index, { default: name });
					refreshOptions(param);
				} finally {
					setUploading((prev) => ({
						...prev,
						[param.id]: false
					}));
				}
			};
			latestRef.current = {
				params,
				uploadFile
			};
			/** Global paste: Ctrl+V with the mouse hovering an upload parameter routes
			* the clipboard file (e.g. a screenshot) to that parameter — same mental
			* model as pasting an image into a chat input. */
			(0, react.useEffect)(() => {
				const onPaste = (event) => {
					const targetId = hoverRef.current;
					if (targetId === null) return;
					const file = event.clipboardData?.files?.[0];
					if (file === void 0) return;
					const param = latestRef.current.params.find((entry) => entry.id === targetId);
					if (param === void 0 || param.upload === void 0) return;
					event.preventDefault();
					latestRef.current.uploadFile(param, file);
				};
				document.addEventListener("paste", onPaste);
				return () => document.removeEventListener("paste", onPaste);
			}, []);
			/** Auto-generate the internal parameter name from the input key, deduped against existing params. */
			const genParamName = (base) => {
				let name = base;
				let index = 2;
				while (params.some((param) => param.name === name)) name = `${base}_${index++}`;
				return name;
			};
			const nodeEntries = Object.entries(workflow).map(([id, raw]) => [id, raw]);
			const advNodeInfo = nodeEntries.find(([id]) => id === advNode)?.[1];
			const advInputs = advNodeInfo !== void 0 && advNodeInfo.inputs !== void 0 ? Object.entries(advNodeInfo.inputs).filter(([, value]) => !isLinkValue(value)) : [];
			const selectedInput = advInputs.find(([key]) => key === advInput);
			/** Server-side auto-detection: prompt/size/steps/seed + dropdown options (object_info). */
			const recognize = async () => {
				if (recognizing) return;
				setRecognizing(true);
				setRecognizeError(null);
				try {
					const result = await postJson("/comfyui/workflows/recognize", { workflow });
					if (result.ok === true && Array.isArray(result.parameters)) {
						onChange(result.parameters);
						setAdvanced(false);
					} else setRecognizeError(result.error ?? t("wfParamsRecognizeFailed"));
				} catch {
					setRecognizeError(t("wfParamsRecognizeFailed"));
				} finally {
					setRecognizing(false);
				}
			};
			const update = (index, patch) => {
				onChange(params.map((param, i) => i === index ? {
					...param,
					...patch
				} : param));
			};
			const addAdvanced = async () => {
				if (advNode === "" || advInput === "" || selectedInput === void 0 || advNodeInfo === void 0) return;
				const [, value] = selectedInput;
				const type = typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string";
				if (!params.some((param) => param.nodeId === advNode && param.inputKey === advInput && param.upload === "media") && typeof value === "string") {
					let parsed;
					try {
						parsed = JSON.parse(value);
					} catch {
						parsed = void 0;
					}
					if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((item) => typeof item === "object" && item !== null && typeof item.file === "string")) {
						const items = parsed;
						const firstFile = items[0]?.file;
						const slash = typeof firstFile === "string" ? firstFile.indexOf("/") : -1;
						const subfolder = typeof firstFile === "string" && slash > 0 ? firstFile.slice(0, slash) : void 0;
						const added = items.map((item, i) => ({
							id: newParamId(),
							name: genParamName(`media_${i + 1}`),
							label: `${t("wfRefSlot")}${i + 1}`,
							type: "string",
							nodeId: advNode,
							inputKey: advInput,
							default: typeof item.name === "string" ? item.name : "",
							upload: "media",
							subfolder
						}));
						onChange([...params, ...added]);
						setAdvanced(false);
						setAdvNode("");
						setAdvInput("");
						setAdvLabel("");
						return;
					}
				}
				let options;
				let upload;
				let numberSpec;
				if (typeof advNodeInfo.class_type === "string") try {
					const result = await postJson("/comfyui/workflows/input-options", {
						classType: advNodeInfo.class_type,
						inputKey: advInput
					});
					if (result.ok === true && Array.isArray(result.options) && result.options.length > 0) options = result.options;
					upload = result.upload;
					numberSpec = result.number;
				} catch {}
				onChange([...params, {
					id: newParamId(),
					name: genParamName(advInput),
					label: advLabel !== "" ? advLabel : `${advNode} · ${advInput}`,
					type,
					nodeId: advNode,
					inputKey: advInput,
					default: typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : "",
					numberKind: type === "number" ? numberSpec?.kind : void 0,
					min: type === "number" ? numberSpec?.min : void 0,
					max: type === "number" ? numberSpec?.max : void 0,
					step: type === "number" ? numberSpec?.step : void 0,
					options,
					upload
				}]);
				setAdvanced(false);
				setAdvNode("");
				setAdvInput("");
				setAdvLabel("");
			};
			/** Update a parameter's default; DynamicCombo parents refresh their child (size) parameter. */
			const updateDefault = (index, value) => {
				update(index, { default: value });
				const param = params[index];
				if (param === void 0 || typeof value !== "string") return;
				if (param.options === void 0 || param.options.length === 0) return;
				const childIndex = params.findIndex((entry) => entry.nodeId === param.nodeId && entry.inputKey.startsWith(`${param.inputKey}.`));
				if (childIndex === -1) return;
				const child = params[childIndex];
				if (child === void 0) return;
				const rawNode = workflow[child.nodeId];
				postJson("/comfyui/workflows/input-options", {
					classType: typeof rawNode?.class_type === "string" ? rawNode.class_type : "",
					inputKey: param.inputKey,
					parentValue: value
				}).then((result) => {
					const data = result;
					if (data.ok === true && data.child !== void 0 && childIndex < params.length) update(childIndex, {
						options: data.child.options,
						default: data.child.default
					});
				}).catch(() => void 0);
			};
			return (0, react.createElement)("div", { className: "dsc-params" }, params.length === 0 ? (0, react.createElement)("div", { className: "dsc-hint" }, t("wfParamsEmpty")) : (0, react.createElement)("div", { className: "dsc-list" }, params.map((param, index) => (0, react.createElement)("div", {
				key: param.id,
				className: "dsc-param-row"
			}, (0, react.createElement)("div", { className: "dsc-param-fields" }, (0, react.createElement)("input", {
				className: "dsc-input dsc-input--sm",
				value: param.label,
				placeholder: t("wfParamLabel"),
				onChange: (event) => update(index, { label: event.target.value })
			})), param.upload === "media" ? (0, react.createElement)("div", {
				className: "dsc-param-upload-wrap",
				onMouseEnter: () => {
					hoverRef.current = param.id;
					setHovered(param.id);
				},
				onMouseLeave: () => {
					hoverRef.current = null;
					setHovered(null);
				}
			}, (0, react.createElement)("input", {
				className: "dsc-input dsc-input--sm dsc-param-default",
				value: String(param.default),
				placeholder: t("wfMediaEmpty"),
				title: `${param.subfolder ?? ""}/`,
				onChange: (event) => updateDefault(index, event.target.value)
			}), (0, react.createElement)("label", {
				className: hovered === param.id ? "dsc-dropzone dsc-dropzone--over" : "dsc-dropzone",
				title: t("wfPasteHint"),
				tabIndex: 0,
				onDragOver: (event) => event.preventDefault(),
				onDrop: (event) => {
					event.preventDefault();
					const file = event.dataTransfer?.files?.[0];
					if (file !== void 0) uploadFile(param, file);
				},
				onPaste: (event) => {
					const file = event.clipboardData?.files?.[0];
					if (file !== void 0) uploadFile(param, file);
				}
			}, (0, react.createElement)("input", {
				type: "file",
				style: { display: "none" },
				onChange: (event) => {
					const file = event.target.files?.[0];
					if (file !== void 0) uploadFile(param, file);
					event.target.value = "";
				}
			}), uploading[param.id] === true ? t("wfParamsUploading") : t("wfParamsDrop")), (0, react.createElement)("button", {
				className: "dsc-btn",
				onClick: () => updateDefault(index, "")
			}, t("wfMediaClear"))) : param.upload !== void 0 ? (0, react.createElement)("div", {
				className: "dsc-param-upload-wrap",
				onMouseEnter: () => {
					hoverRef.current = param.id;
					setHovered(param.id);
				},
				onMouseLeave: () => {
					hoverRef.current = null;
					setHovered(null);
				}
			}, param.options !== void 0 && param.options.length > 0 ? (0, react.createElement)(UploadSelect, {
				value: String(param.default),
				options: param.options,
				kind: param.upload,
				onChange: (value) => updateDefault(index, value),
				onRefresh: () => refreshOptions(param)
			}) : null, (0, react.createElement)("label", {
				className: hovered === param.id ? "dsc-dropzone dsc-dropzone--over" : "dsc-dropzone",
				title: t("wfPasteHint"),
				tabIndex: 0,
				onDragOver: (event) => event.preventDefault(),
				onDrop: (event) => {
					event.preventDefault();
					const file = event.dataTransfer?.files?.[0];
					if (file !== void 0) uploadFile(param, file);
				},
				onPaste: (event) => {
					const file = event.clipboardData?.files?.[0];
					if (file !== void 0) uploadFile(param, file);
				}
			}, (0, react.createElement)("input", {
				type: "file",
				style: { display: "none" },
				onChange: (event) => {
					const file = event.target.files?.[0];
					if (file !== void 0) uploadFile(param, file);
					event.target.value = "";
				}
			}), uploading[param.id] === true ? t("wfParamsUploading") : `${t("wfParamsDrop")} ${t(`uploadKind_${param.upload}`)}`)) : param.options !== void 0 && param.options.length > 0 ? (0, react.createElement)("select", {
				className: "dsc-input dsc-input--sm dsc-param-default",
				value: String(param.default),
				onChange: (event) => updateDefault(index, event.target.value)
			}, param.options.map((option) => (0, react.createElement)("option", {
				key: String(option),
				value: String(option)
			}, String(option)))) : param.type === "string" ? (0, react.createElement)("textarea", {
				className: "dsc-input dsc-param-default",
				rows: 2,
				value: String(param.default),
				placeholder: t("wfParamDefault"),
				onChange: (event) => updateDefault(index, event.target.value)
			}) : param.type === "boolean" ? (0, react.createElement)("label", { className: "dsc-param-bool dsc-param-default" }, (0, react.createElement)("input", {
				type: "checkbox",
				checked: asBool(param.default),
				onChange: (event) => updateDefault(index, event.target.checked)
			}), (0, react.createElement)("span", null, asBool(param.default) ? "true" : "false")) : param.type === "number" ? (0, react.createElement)("input", {
				className: "dsc-input dsc-input--sm dsc-param-default",
				inputMode: param.numberKind === "int" ? "numeric" : "decimal",
				value: numDraft[param.id] ?? String(param.default),
				placeholder: t("wfParamDefault"),
				title: numberRangeHint(param),
				onChange: (event) => {
					const raw = event.target.value;
					setNumDraft((prev) => ({
						...prev,
						[param.id]: raw
					}));
					const parsed = Number(raw);
					if (raw.trim() !== "" && Number.isFinite(parsed)) updateDefault(index, parsed);
				},
				onBlur: () => {
					const raw = numDraft[param.id];
					setNumDraft((prev) => {
						const next = { ...prev };
						delete next[param.id];
						return next;
					});
					if (raw === void 0) return;
					const parsed = Number(raw);
					const value = raw.trim() === "" || !Number.isFinite(parsed) ? 0 : parsed;
					updateDefault(index, param.numberKind === "int" ? Math.round(value) : value);
				}
			}) : (0, react.createElement)("input", {
				className: "dsc-input dsc-input--sm dsc-param-default",
				value: String(param.default),
				placeholder: t("wfParamDefault"),
				onChange: (event) => updateDefault(index, event.target.value)
			}), (0, react.createElement)("div", { className: "dsc-param-meta" }, (0, react.createElement)("span", { className: "dsc-meta" }, `${param.type}${param.type === "number" ? `/${param.numberKind ?? "?"}` : ""} · #${param.nodeId}.${param.inputKey}`), param.type === "number" ? (0, react.createElement)("label", { className: "dsc-param-random" }, (0, react.createElement)("input", {
				type: "checkbox",
				checked: param.random === true,
				onChange: (event) => update(index, { random: event.target.checked })
			}), (0, react.createElement)("span", null, t("wfParamRandom"))) : null, (0, react.createElement)("button", {
				className: "dsc-btn",
				onClick: () => onChange(params.filter((_, i) => i !== index))
			}, t("wfParamDelete")))))), (0, react.createElement)("div", { className: "dsc-toolbar" }, (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: recognizing,
				onClick: () => {
					recognize();
				}
			}, recognizing ? t("wfParamsRecognizing") : t("wfParamsRecognize")), (0, react.createElement)("button", {
				className: "dsc-btn",
				onClick: () => setAdvanced(!advanced)
			}, t("wfParamsAdd"))), recognizeError !== null ? (0, react.createElement)("div", { className: "dsc-hint dsc-hint--error" }, recognizeError) : null, advanced ? (0, react.createElement)("div", { className: "dsc-param-advanced" }, (0, react.createElement)("div", { className: "dsc-param-fields" }, (0, react.createElement)("select", {
				className: "dsc-input dsc-input--sm",
				value: advNode,
				onChange: (event) => {
					setAdvNode(event.target.value);
					setAdvInput("");
				}
			}, (0, react.createElement)("option", { value: "" }, "—"), nodeEntries.map(([id, node]) => (0, react.createElement)("option", {
				key: id,
				value: id
			}, `#${id} ${node.class_type ?? ""}`))), advNodeInfo !== void 0 ? (0, react.createElement)("select", {
				className: "dsc-input dsc-input--sm",
				value: advInput,
				onChange: (event) => setAdvInput(event.target.value)
			}, (0, react.createElement)("option", { value: "" }, "—"), advInputs.map(([key, value]) => (0, react.createElement)("option", {
				key,
				value: key
			}, `${key} (${inputValueKind(value)})`))) : null, (0, react.createElement)("input", {
				className: "dsc-input dsc-input--sm",
				value: advLabel,
				placeholder: t("wfParamCustomLabel"),
				onChange: (event) => setAdvLabel(event.target.value)
			}), (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: advNode === "" || advInput === "",
				onClick: () => {
					addAdvanced();
				}
			}, t("wfParamAdd"))), (0, react.createElement)("div", { className: "dsc-hint" }, t("wfParamCustomHint"))) : null);
		}
		function formatTs(ts) {
			const date = new Date(ts);
			return Number.isNaN(date.getTime()) ? ts : date.toLocaleString();
		}
		function formatBytes(bytes) {
			if (bytes === void 0) return "";
			if (bytes < 1024) return `${bytes} B`;
			if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
			return `${(bytes / 1048576).toFixed(2)} MB`;
		}
		/**
		* Live generation telemetry, polled from the host's `/comfyui/live`.
		*
		* That endpoint answers purely from the ComfyUI WebSocket feed the host
		* already holds, so this poll never touches ComfyUI and never queues behind
		* a generation. The cadence adapts: ~1 Hz while something runs, ~2.5 s when
		* idle, 4 s while the tab is in the background (no work for nobody to see).
		*/
		function useLiveStatus(active) {
			const [live, setLive] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (!active) return;
				let cancelled = false;
				let timer = null;
				const schedule = (ms) => {
					if (cancelled) return;
					timer = setTimeout(poll, ms);
				};
				const poll = async () => {
					if (cancelled) return;
					if (typeof document !== "undefined" && document.visibilityState === "hidden") {
						schedule(4000);
						return;
					}
					let delay = 2500;
					try {
						const data = await getJson("/comfyui/live");
						if (cancelled) return;
						if (data.ok === true) {
							setLive(data);
							setError(null);
							const busy = (data.tasks ?? []).some((task) => task.state === "running");
							const queued = typeof data.socket?.queueRemaining === "number" && data.socket.queueRemaining > 0;
							delay = busy || queued ? 900 : 2500;
						} else {
							setError(typeof data.error === "string" ? data.error : "live unavailable");
							delay = 5000;
						}
					} catch (cause) {
						if (cancelled) return;
						setError(cause instanceof Error ? cause.message : String(cause));
						delay = 5000;
					}
					schedule(delay);
				};
				poll();
				return () => {
					cancelled = true;
					if (timer !== null) clearTimeout(timer);
				};
			}, [active]);
			return {
				live,
				error
			};
		}
		/** The task the header should talk about: the running one, else the newest pending. */
		function primaryTask(live) {
			const tasks = Array.isArray(live?.tasks) ? live.tasks : [];
			return tasks.find((task) => task.state === "running") ?? tasks.find((task) => task.state === "pending") ?? null;
		}
		/**
		* One-line status strip under the panel title: connection, what is running,
		* step progress, ETA, queue depth — plus a thin progress bar. Idle shows a
		* quiet "空闲" instead of an empty gap, and a missing progress socket is
		* named explicitly (generation still works; only the live numbers are gone).
		*/
		function LiveStrip({ t, live }) {
			const task = primaryTask(live);
			const socket = live?.socket ?? null;
			const connected = socket?.connected === true;
			const queueRemaining = typeof socket?.queueRemaining === "number" ? socket.queueRemaining : null;
			const parts = [];
			let dotClass = "dsc-live-dot";
			if (task !== null) {
				dotClass += " dsc-live-dot--busy";
				parts.push(t("liveRunning"));
				const name = typeof task.workflowName === "string" && task.workflowName !== "" ? task.workflowName : task.promptId;
				parts.push(name);
				if (typeof task.max === "number" && task.max > 0) {
					parts.push(t("liveSteps", {
						value: task.value ?? 0,
						max: task.max
					}));
					if (typeof task.etaMs === "number" && task.etaMs > 0) {
						parts.push(t("liveEta", { s: Math.max(1, Math.ceil(task.etaMs / 1000)) }));
					}
				} else if (typeof task.elapsedMs === "number" && task.elapsedMs > 1000) {
					parts.push(t("liveElapsed", { s: Math.round(task.elapsedMs / 1000) }));
				}
				if (queueRemaining !== null && queueRemaining > 1) parts.push(t("liveQueued", { n: queueRemaining - 1 }));
			} else if (queueRemaining !== null && queueRemaining > 0) {
				dotClass += " dsc-live-dot--busy";
				parts.push(t("liveQueued", { n: queueRemaining }));
			} else if (!connected) {
				dotClass += " dsc-live-dot--off";
				parts.push(t("liveOffline"));
			} else {
				parts.push(t("liveIdle"));
			}
			const pct = task !== null && typeof task.max === "number" && task.max > 0
				? Math.min(100, Math.round(((task.value ?? 0) / task.max) * 100))
				: null;
			const fillClass = pct === null ? "dsc-live-fill dsc-live-fill--busy" : "dsc-live-fill";
			const fillStyle = pct === null ? void 0 : { width: `${pct}%` };
			return (0, react.createElement)("div", { className: "dsc-live" }, (0, react.createElement)("div", { className: "dsc-live-row" }, (0, react.createElement)("span", { className: dotClass }), (0, react.createElement)("span", {
				className: "dsc-live-text",
				title: parts.join(" · ")
			}, parts.join(" · ")), pct !== null ? (0, react.createElement)("span", { className: "dsc-live-pct" }, `${pct}%`) : null), (0, react.createElement)("div", { className: "dsc-live-track" }, (0, react.createElement)("div", {
				className: fillClass,
				style: fillStyle
			})));
		}
		/** The panel shell: header (drag handle), tabs, and the active tab body. */
		function ComfyUIPanel({ t }) {
			const open = usePanelOpen();
			const tab = usePanelTab();
			// One poller for the whole panel: the status strip and the task tab read
			// the same snapshot instead of hitting the endpoint twice.
			const { live } = useLiveStatus(open);
			const [geom, setGeom] = (0, react.useState)(() => healGeom(loadGeom(), window.innerWidth, window.innerHeight));
			const [dragging, setDragging] = (0, react.useState)(null);
			const [lightbox, setLightbox] = (0, react.useState)(null);
			const panelRef = (0, react.useRef)(null);
			const dragRef = (0, react.useRef)(null);
			const openPreview = (images, kinds, index) => setLightbox({
				images,
				kinds,
				index
			});
			(0, react.useEffect)(() => {
				if (open) {
					setGeom((prev) => healGeom(prev, window.innerWidth, window.innerHeight));
					return;
				}
				saveGeom(geom);
			}, [open]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onResize = () => setGeom((prev) => healGeom(prev, window.innerWidth, window.innerHeight));
				window.addEventListener("resize", onResize);
				return () => window.removeEventListener("resize", onResize);
			}, [open]);
			// Esc closes the panel — unless the user is typing in a field (Esc there
			// means "cancel this edit") or an image lightbox is on top of it.
			(0, react.useEffect)(() => {
				if (!open) return;
				const onKey = (event) => {
					if (event.key !== "Escape" || lightbox !== null) return;
					const target = event.target;
					if (target !== null && typeof target.closest === "function" && target.closest("input, textarea, select, [contenteditable='true']") !== null) return;
					panelStore.close();
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [open, lightbox]);
			const startDrag = (event, mode) => {
				if (event.button !== 0) return;
				if (mode === "move") {
					const target = event.target;
					if (target !== null && target.closest("button, input, textarea, select, a, label")) return;
				}
				const rect = panelRef.current?.getBoundingClientRect();
				if (rect === void 0) return;
				dragRef.current = {
					startX: event.clientX,
					startY: event.clientY,
					origX: rect.left,
					origY: rect.top,
					width: rect.width,
					height: rect.height
				};
				setDragging(mode);
				const el = event.currentTarget;
				if (el !== null && typeof el.setPointerCapture === "function") el.setPointerCapture(event.pointerId);
			};
			const moveDrag = (event) => {
				const d = dragRef.current;
				if (d === null) return;
				if (dragging === "move") {
					const pos = clampPos(Math.round(d.origX + event.clientX - d.startX), Math.round(d.origY + event.clientY - d.startY), d.width, window.innerWidth, window.innerHeight);
					setGeom((prev) => ({
						...prev,
						x: pos.x,
						y: pos.y
					}));
				} else if (dragging === "resize") {
					const width = Math.max(300, Math.min(720, d.width + event.clientX - d.startX));
					const height = Math.max(200, Math.min(Math.max(300, window.innerHeight - 40), d.height + event.clientY - d.startY));
					setGeom((prev) => ({
						...prev,
						width,
						height
					}));
				}
			};
			const endDrag = () => {
				if (dragRef.current === null) return;
				dragRef.current = null;
				setDragging(null);
				setGeom((prev) => {
					saveGeom(prev);
					return prev;
				});
			};
			if (!open) return null;
			const panelStyle = {};
			if (geom.x !== void 0 && geom.y !== void 0) {
				panelStyle.left = `${geom.x}px`;
				panelStyle.top = `${geom.y}px`;
				panelStyle.right = "auto";
				panelStyle.bottom = "auto";
			}
			if (geom.width !== void 0) panelStyle.width = `${geom.width}px`;
			if (geom.height !== void 0) panelStyle.height = `${geom.height}px`;
			// Once the panel is pinned by a drag (right/bottom cleared), an unspecified
			// height becomes "as tall as the content": the body loses its scroll box
			// and a long tab runs off the screen. Derive the height from the pinned top
			// instead, so the body keeps scrolling and the panel stays on screen.
			else if (geom.x !== void 0 && geom.y !== void 0) panelStyle.height = `${Math.max(240, (typeof window !== "undefined" ? window.innerHeight : 800) - geom.y - 16)}px`;
			return (0, react.createElement)("div", {
				ref: panelRef,
				className: `dsc-panel${dragging !== null ? " dsc-panel--dragging" : ""}`,
				style: panelStyle
			}, (0, react.createElement)("div", {
				className: "dsc-panel-head",
				title: t("panelHint"),
				onPointerDown: (event) => startDrag(event, "move"),
				onPointerMove: (event) => moveDrag(event),
				onPointerUp: () => endDrag(),
				onPointerCancel: () => endDrag()
			}, (0, react.createElement)("span", { className: "dsc-panel-title" }, (0, react.createElement)("span", { className: "dsc-trigger-glyph" }, (0, react.createElement)(ComfyUIIcon)), (0, react.createElement)("span", null, t("panelTitle"))), (0, react.createElement)("span", { className: "dsc-panel-head-actions" }, (0, react.createElement)("button", {
				className: "dsc-panel-reset",
				type: "button",
				title: t("panelReset"),
				"aria-label": t("panelReset"),
				onClick: () => {
					setGeom({});
					try {
						localStorage.removeItem(GEOM_KEY);
					} catch {}
				}
			}, "↺"), (0, react.createElement)("button", {
				className: "dsc-panel-close",
				"aria-label": t("close"),
				onClick: () => panelStore.close()
			}, "✕"))), (0, react.createElement)(LiveStrip, {
				t,
				live
			}), (0, react.createElement)("div", { className: "dsc-tabs" }, (0, react.createElement)(TabButton, {
				t,
				active: tab === "workflows",
				label: t("tabWorkflows"),
				onClick: () => panelStore.setTab("workflows")
			}), (0, react.createElement)(TabButton, {
				t,
				active: tab === "assets",
				label: t("tabAssets"),
				onClick: () => panelStore.setTab("assets")
			}), (0, react.createElement)(TabButton, {
				t,
				active: tab === "queue",
				label: t("tabQueue"),
				badge: primaryTask(live) !== null,
				onClick: () => panelStore.setTab("queue")
			})), (0, react.createElement)("div", { className: "dsc-panel-body" }, (0, react.createElement)(TabBoundary, {
				key: tab,
				t
			}, tab === "workflows" ? (0, react.createElement)(WorkflowsTab, { t }) : tab === "assets" ? (0, react.createElement)(AssetsTab, {
				t,
				onPreview: openPreview
			}) : (0, react.createElement)(QueueTab, {
				t,
				live,
				onPreview: openPreview
			}))), lightbox !== null ? (0, react.createElement)(Lightbox, {
				t,
				images: lightbox.images,
				kinds: lightbox.kinds,
				index: lightbox.index,
				onClose: () => setLightbox(null),
				onIndex: (index) => setLightbox({
					images: lightbox.images,
					kinds: lightbox.kinds,
					index
				})
			}) : null, (0, react.createElement)("div", {
				className: "dsc-panel-resize",
				onPointerDown: (event) => startDrag(event, "resize"),
				onPointerMove: (event) => moveDrag(event),
				onPointerUp: () => endDrag(),
				onPointerCancel: () => endDrag()
			}));
		}
		function TabButton(props) {
			return (0, react.createElement)("button", {
				className: props.active ? "dsc-tab dsc-tab--active" : "dsc-tab",
				onClick: props.onClick
			}, props.label, props.badge === true ? (0, react.createElement)("span", { className: "dsc-tab-dot", "aria-hidden": "true" }) : null);
		}
		function ErrorNote({ t, message }) {
			return (0, react.createElement)("div", { className: "dsc-err" }, `${t("error")}: ${message}`);
		}
		/**
		* Catches a tab's render error and shows it in place. Without this the host's
		* slot error boundary swallows the whole overlay silently, so a tab crash
		* reads as "clicking the button does nothing" with a clean console (Issue #5).
		*/
		var TabBoundary = class extends react.Component {
			state = { error: null };
			static getDerivedStateFromError(error) {
				return { error: error instanceof Error ? error : new Error(String(error)) };
			}
			componentDidCatch(error) {
				console.error("[dsh-comfyui] panel tab render error", error);
			}
			render() {
				if (this.state.error !== null) return (0, react.createElement)(ErrorNote, {
					t: this.props.t,
					message: this.state.error.message
				});
				return this.props.children;
			}
		};
		/** Load area at the bottom of the workflow library, modeled on the ComfyUI
		* LoadImage node — a list of **slots** rather than a single image.
		*
		* A lone slot stretches across the panel; from two slots on they share a
		* fixed width and wrap into rows. A slot is either filled with a file or
		* empty (added but not yet picked, or emptied through the picker's "空"
		* tile); the whole card is the pick button, and hovering reveals an × in the
		* corner that removes the slot. Filled slots feed the workflow's loader
		* parameters in order, so a run that takes two reference images picks up
		* slots 1 and 2 without the agent naming files. */
		function LoadArea(props) {
			const { t } = props;
			const [slots, setSlots] = (0, react.useState)([]);
			const [files, setFiles] = (0, react.useState)([]);
			/** Slot index the picker is currently filling; null = picker closed. */
			const [pickerFor, setPickerFor] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			/** Host-side warning (e.g. the node table could not be read). */
			const [warning, setWarning] = (0, react.useState)(null);
			const refresh = (0, react.useCallback)(async () => {
				const data = await fetch("/comfyui/loadarea").then((response) => response.json()).catch(() => void 0);
				if (data === void 0) {
					setWarning(t("queueError"));
					return;
				}
				// `ok:false` / `degraded` used to be swallowed here, so a dead server
				// looked exactly like an empty load area.
				if (data.ok !== true) {
					setWarning(typeof data.error === "string" ? data.error : t("queueError"));
					return;
				}
				setWarning(typeof data.warning === "string" && data.warning !== "" ? data.warning : null);
				setSlots(data.slots ?? (data.current !== null && data.current !== void 0 ? [data.current] : []));
				setFiles(data.files ?? []);
			}, [t]);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			const post = async (body) => {
				setBusy(true);
				setError(null);
				try {
					const response = await fetch("/comfyui/current-image", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(body)
					});
					const data = await response.json().catch(() => ({}));
					if (data.ok !== true) throw new Error(data.error ?? `HTTP ${response.status}`);
					await refresh();
					return true;
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
					return false;
				} finally {
					setBusy(false);
				}
			};
			const upload = async (file) => {
				setBusy(true);
				setError(null);
				try {
					const name = await uploadDedup(file);
					const sizeText = await recordMediaSize(file, name);
					await refresh();
					props.onNotice(`${props.t("wfUploaded")}：${name}${sizeText !== void 0 ? `（${sizeText}）` : ""}`);
					return name;
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
					throw cause;
				} finally {
					setBusy(false);
				}
			};
			const pick = async (file) => {
				const index = pickerFor;
				setPickerFor(null);
				if (await post({
					name: file.name,
					kind: file.kind,
					source: file.source,
					...index !== null ? { index } : {}
				})) props.onNotice(`${props.t("wfLoadPicked")}：${file.name}`);
			};
			/** "＋ 添加加载区": opens a slot and goes straight to the picker for it, so
			* adding material is one gesture; closing the picker leaves the empty slot. */
			const addSlot = async () => {
				const index = slots.length;
				if (await post({ action: "addSlot" })) setPickerFor(index);
			};
			const loaded = slots.filter((slot) => slot !== null).length;
			return (0, react.createElement)("div", { className: "dsc-loadarea" }, (0, react.createElement)("div", { className: "dsc-loadarea-head" }, (0, react.createElement)("span", { className: "dsc-loadarea-title" }, props.t("wfLoadArea")), (0, react.createElement)("span", { className: "dsc-meta" }, slots.length === 0 ? props.t("wfLoadEmpty") : props.t("wfLoadSummary", {
				slots: slots.length,
				loaded
			}))), warning !== null ? (0, react.createElement)("div", { className: "dsc-warn" }, warning) : null, error !== null ? (0, react.createElement)("div", { className: "dsc-err" }, error) : null, (0, react.createElement)("div", { className: "dsc-loadslots" }, slots.map((slot, index) => (0, react.createElement)(LoadSlot, {
				key: index,
				t: props.t,
				slot,
				index,
				busy,
				wide: slots.length === 1,
				onPick: () => setPickerFor(index),
				onRemove: () => {
					post({
						action: "removeSlot",
						index
					});
				}
			}))), (0, react.createElement)("div", { className: "dsc-toolbar" }, (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: () => {
					addSlot();
				}
			}, props.t("wfLoadAddSlot"))), pickerFor !== null ? (0, react.createElement)(LoadPicker, {
				t: props.t,
				files,
				current: (pickerFor < slots.length ? slots[pickerFor]?.name : void 0) ?? null,
				onUpload: upload,
				onPick: pick,
				onClear: () => {
					const index = pickerFor;
					setPickerFor(null);
					post({
						action: "clear",
						index
					});
				},
				onClose: () => setPickerFor(null)
			}) : null, error !== null ? (0, react.createElement)("div", { className: "dsc-hint dsc-hint--error" }, error) : null);
		}
		/** One load-area slot card. The card is the pick button (empty slots show
		* "加载位 N / 添加素材"); the × in the corner, revealed on hover, removes the
		* slot. Emptying a slot without removing it is done from the picker's "空"
		* tile, so the card carries no button row of its own. */
		function LoadSlot(props) {
			const { t, slot, index } = props;
			const size = slot?.width !== void 0 && slot.height !== void 0 ? `（${slot.width}×${slot.height}）` : "";
			return (0, react.createElement)("div", { className: props.wide ? "dsc-loadslot dsc-loadslot--wide" : "dsc-loadslot" }, (0, react.createElement)("button", {
				className: "dsc-loadslot-pick",
				onClick: props.onPick,
				disabled: props.busy,
				title: slot !== null ? slot.name : t("wfLoadHint")
			}, slot === null ? (0, react.createElement)("span", { className: "dsc-loadslot-empty" }, (0, react.createElement)("span", { className: "dsc-loadslot-index" }, `${t("wfLoadSlotLabel")} ${index + 1}`), (0, react.createElement)("span", { className: "dsc-loadslot-add" }, t("wfLoadAddMedia"))) : slot.kind === "video" ? (0, react.createElement)("video", {
				className: "dsc-loadslot-media",
				src: slot.url,
				preload: "metadata",
				muted: true
			}) : slot.kind === "audio" ? (0, react.createElement)("span", { className: "dsc-loadslot-empty" }, "♪") : (0, react.createElement)("img", {
				className: "dsc-loadslot-media",
				src: slot.url,
				alt: "",
				loading: "lazy"
			}), slot !== null ? (0, react.createElement)("span", { className: "dsc-loadslot-name" }, `${slot.name}${size}`) : null), (0, react.createElement)("button", {
				className: "dsc-loadslot-x",
				disabled: props.busy,
				title: t("wfLoadRemoveSlot"),
				"aria-label": t("wfLoadRemoveSlot"),
				onClick: props.onRemove
			}, "×"));
		}
		/** The load-area picker dialog: tab bar (全部/已导入/已生成) with a
		* paste/click upload zone on the right, and a masonry image grid below. */
		function LoadPicker(props) {
			const [tab, setTab] = (0, react.useState)("all");
			const [type, setType] = (0, react.useState)("all");
			const hoverRef = (0, react.useRef)(false);
			const [uploadFlash, setUploadFlash] = (0, react.useState)(null);
			const [scrollTo, setScrollTo] = (0, react.useState)(null);
			const cardRefs = (0, react.useRef)(/* @__PURE__ */ new Map());
			const flashTimer = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => () => {
				if (flashTimer.current !== void 0) window.clearTimeout(flashTimer.current);
			}, []);
			(0, react.useEffect)(() => {
				const onPaste = (event) => {
					if (!hoverRef.current) return;
					const file = event.clipboardData?.files?.[0];
					if (file === void 0) return;
					event.preventDefault();
					handleUpload(file);
				};
				document.addEventListener("paste", onPaste);
				return () => document.removeEventListener("paste", onPaste);
			});
			/** Upload, then flash a confirmation and scroll the grid to the new file. */
			const handleUpload = async (file) => {
				try {
					const name = await props.onUpload(file);
					setScrollTo(name);
					setUploadFlash(`${props.t("wfUploadedToast")}：${name}`);
					if (flashTimer.current !== void 0) window.clearTimeout(flashTimer.current);
					flashTimer.current = window.setTimeout(() => setUploadFlash(null), 2500);
				} catch {}
			};
			const bySource = tab === "all" ? props.files : props.files.filter((file) => file.source === tab);
			const filtered = type === "all" ? bySource : bySource.filter((file) => file.kind === type);
			(0, react.useEffect)(() => {
				if (scrollTo === null) return;
				let found;
				for (const [key, el] of cardRefs.current) if (key.endsWith(`:${scrollTo}`)) {
					found = el;
					break;
				}
				if (found !== void 0) {
					found.scrollIntoView({
						block: "center",
						behavior: "smooth"
					});
					setScrollTo(null);
				}
			}, [scrollTo, filtered]);
			const columns = [
				[],
				[],
				[]
			];
			filtered.forEach((file, index) => {
				columns[index % 3].push(file);
			});
			const tabs = [
				{
					id: "all",
					label: props.t("wfTabAll")
				},
				{
					id: "imported",
					label: props.t("wfTabImported")
				},
				{
					id: "generated",
					label: props.t("wfTabGenerated")
				}
			];
			const typeOptions = [
				{
					id: "all",
					label: props.t("wfTypeAll")
				},
				{
					id: "image",
					label: props.t("uploadKind_image")
				},
				{
					id: "video",
					label: props.t("uploadKind_video")
				},
				{
					id: "audio",
					label: props.t("uploadKind_audio")
				}
			];
			return (0, react.createElement)("div", {
				className: "dsc-picker-overlay",
				onClick: props.onClose
			}, (0, react.createElement)("div", {
				className: "dsc-picker",
				onClick: (event) => event.stopPropagation()
			}, (0, react.createElement)("div", { className: "dsc-picker-bar" }, (0, react.createElement)("div", { className: "dsc-picker-tabs" }, tabs.map((entry) => (0, react.createElement)("button", {
				key: entry.id,
				className: `dsc-picker-tab${tab === entry.id ? " dsc-picker-tab--active" : ""}`,
				onClick: () => setTab(entry.id)
			}, entry.label))), (0, react.createElement)("label", {
				className: "dsc-dropzone dsc-picker-upload",
				title: props.t("wfPasteHint"),
				onMouseEnter: () => {
					hoverRef.current = true;
				},
				onMouseLeave: () => {
					hoverRef.current = false;
				},
				onDragOver: (event) => event.preventDefault(),
				onDrop: (event) => {
					event.preventDefault();
					const file = event.dataTransfer?.files?.[0];
					if (file !== void 0) handleUpload(file);
				}
			}, (0, react.createElement)("input", {
				type: "file",
				style: { display: "none" },
				onChange: (event) => {
					const file = event.target.files?.[0];
					if (file !== void 0) handleUpload(file);
					event.target.value = "";
				}
			}), props.t("wfPickerUpload")), (0, react.createElement)("select", {
				className: "dsc-picker-type",
				value: type,
				onChange: (event) => setType(event.target.value)
			}, typeOptions.map((option) => (0, react.createElement)("option", {
				key: option.id,
				value: option.id
			}, option.label)))), filtered.length === 0 && props.onClear === void 0 ? (0, react.createElement)("div", { className: "dsc-picker-empty" }, props.t("wfLoadNoFiles")) : (0, react.createElement)("div", { className: "dsc-picker-grid" }, columns.map((column, columnIndex) => (0, react.createElement)("div", {
				key: columnIndex,
				className: "dsc-picker-col"
			}, columnIndex === 0 && props.onClear !== void 0 ? (0, react.createElement)("div", {
				className: `dsc-picker-card dsc-picker-card--none${props.current === null ? " dsc-picker-card--active" : ""}`,
				role: "button",
				tabIndex: 0,
				onClick: () => props.onClear?.(),
				onKeyDown: (event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						props.onClear?.();
					}
				},
				title: props.t("wfLoadNoneHint")
			}, (0, react.createElement)("span", { className: "dsc-picker-thumb dsc-picker-thumb--media" }, "∅"), (0, react.createElement)("span", { className: "dsc-picker-name" }, props.t("wfLoadNone"))) : null, column.map((file) => (0, react.createElement)("div", {
				key: `${file.source}:${file.name}`,
				className: `dsc-picker-card${file.name === props.current ? " dsc-picker-card--active" : ""}`,
				role: "button",
				tabIndex: 0,
				onClick: () => {
					props.onPick(file);
				},
				onKeyDown: (event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						props.onPick(file);
					}
				},
				title: file.name,
				ref: (el) => {
					if (el !== null) cardRefs.current.set(`${file.source}:${file.name}`, el);
					else cardRefs.current.delete(`${file.source}:${file.name}`);
				}
			}, file.kind === "image" ? (0, react.createElement)("img", {
				className: "dsc-picker-thumb",
				src: file.url,
				alt: "",
				loading: "lazy"
			}) : file.kind === "video" ? (0, react.createElement)("video", {
				className: "dsc-picker-thumb dsc-picker-player",
				src: file.url,
				controls: true,
				preload: "metadata",
				onClick: (event) => event.stopPropagation()
			}) : (0, react.createElement)("audio", {
				className: "dsc-picker-player dsc-picker-player--audio",
				src: file.url,
				controls: true,
				preload: "metadata",
				onClick: (event) => event.stopPropagation()
			}), (0, react.createElement)("span", { className: "dsc-picker-name" }, file.name), file.width !== void 0 && file.height !== void 0 ? (0, react.createElement)("span", { className: "dsc-meta" }, `${file.width}×${file.height}`) : null))))), uploadFlash !== null ? (0, react.createElement)("div", { className: "dsc-picker-toast" }, uploadFlash) : null));
		}
		/** Tag editor: preset classification chips (图生图 etc.) toggle on/off, plus
		* free-form custom tags added with Enter and removed by clicking. */
		function TagEditor(props) {
			const [custom, setCustom] = (0, react.useState)("");
			const toggle = (tag) => {
				props.onChange(props.tags.includes(tag) ? props.tags.filter((entry) => entry !== tag) : [...props.tags, tag]);
			};
			const addCustom = () => {
				const tag = custom.trim();
				if (tag === "" || props.tags.includes(tag)) return;
				props.onChange([...props.tags, tag]);
				setCustom("");
			};
			const customTags = props.tags.filter((tag) => !PRESET_TAGS.includes(tag));
			return (0, react.createElement)("div", { className: "dsc-tag-editor" }, (0, react.createElement)("div", { className: "dsc-tag-row" }, PRESET_TAGS.map((tag) => (0, react.createElement)("button", {
				key: tag,
				className: `dsc-tag-chip${props.tags.includes(tag) ? " dsc-tag-chip--active" : ""}`,
				onClick: () => toggle(tag)
			}, tag))), customTags.length > 0 ? (0, react.createElement)("div", { className: "dsc-tag-row" }, customTags.map((tag) => (0, react.createElement)("button", {
				key: tag,
				className: "dsc-tag-chip dsc-tag-chip--active",
				title: props.t("wfTagRemove"),
				onClick: () => toggle(tag)
			}, `✕ ${tag}`))) : null, (0, react.createElement)("input", {
				className: "dsc-input dsc-input--sm dsc-tag-input",
				value: custom,
				placeholder: props.t("wfTagAdd"),
				onChange: (event) => setCustom(event.target.value),
				onKeyDown: (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						addCustom();
					}
				}
			}));
		}
		/**
		* The skill-pack editor for one workflow: attach/detach the pack, toggle the
		* run-time gate, and manage its files (SKILL.md plus references/ and scripts/).
		*
		* The pack is what `comfyui_workflow action: skill` hands the agent, so this
		* view is the only place its content is authored. Each file saves explicitly —
		* no autosave — because the model reads whatever is on disk the moment it asks.
		* SKILL.md is edited as a summary field plus a body: the `---` frontmatter that
		* carries the summary is composed on the host, never typed here.
		*/
		function SkillPackEditor(props) {
			const { t } = props;
			const [pack, setPack] = (0, react.useState)(null);
			const [enabled, setEnabled] = (0, react.useState)(props.workflow.skillDir !== void 0);
			const [active, setActive] = (0, react.useState)("SKILL.md");
			const [summary, setSummary] = (0, react.useState)("");
			const [text, setText] = (0, react.useState)("");
			const [dirty, setDirty] = (0, react.useState)(false);
			const [pendingOpen, setPendingOpen] = (0, react.useState)(null);
			const [creating, setCreating] = (0, react.useState)(null);
			const [creatingDir, setCreatingDir] = (0, react.useState)(null);
			const [presetDirs, setPresetDirs] = (0, react.useState)(SKILL_FALLBACK_DIRS);
			const [renaming, setRenaming] = (0, react.useState)(null);
			const [confirming, setConfirming] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [notice, setNotice] = (0, react.useState)(null);
			/** Load one file into the editor; SKILL.md arrives pre-split into summary + body. */
			const openFile = (0, react.useCallback)(async (path) => {
				if (isSkillImage(path)) {
					setActive(path);
					setSummary("");
					setText("");
					setDirty(false);
					setError(null);
					return;
				}
				try {
					const data = await getJson(`/comfyui/workflows/skill?id=${encodeURIComponent(props.workflow.id)}&path=${encodeURIComponent(path)}`);
					if (data.ok !== true) {
						setError(data.error ?? t("skillReadFailed"));
						return;
					}
					setActive(path);
					if (path === "SKILL.md") {
						setSummary(data.summary ?? "");
						setText(data.body ?? "");
					} else {
						setSummary("");
						setText(data.content ?? "");
					}
					setDirty(false);
					setError(null);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				}
			}, [props.workflow.id, t]);
			/** Re-read the pack listing, then the requested file. */
			const refresh = (0, react.useCallback)(async (path) => {
				try {
					const data = await getJson(`/comfyui/workflows/skill?id=${encodeURIComponent(props.workflow.id)}`);
					setEnabled(data.enabled === true);
					setPack(data.pack ?? null);
					if (Array.isArray(data.presetDirs) && data.presetDirs.length > 0) setPresetDirs(data.presetDirs);
					if (data.enabled === true) await openFile(path ?? "SKILL.md");
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				}
			}, [props.workflow.id, openFile]);
			/** Re-read the pack listing and — only when nothing is unsaved — the file
			* currently open, so files added or replaced outside this panel (the agent
			* writing via comfyui_skill, or the file manager after `打开目录`) show up
			* without leaving and re-entering the view. */
			const refreshFiles = async () => {
				setBusy(true);
				setNotice(null);
				try {
					const data = await getJson(`/comfyui/workflows/skill?id=${encodeURIComponent(props.workflow.id)}`);
					setEnabled(data.enabled === true);
					setPack(data.pack ?? null);
					if (Array.isArray(data.presetDirs) && data.presetDirs.length > 0) setPresetDirs(data.presetDirs);
					setError(null);
					props.onChanged();
					if (data.enabled === true && !dirty) await openFile(active);
					setNotice(t("skillRefreshed"));
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			};
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			/** Every mutation goes through here so the listing and the flags stay in sync. */
			const mutate = async (body, after) => {
				setBusy(true);
				setNotice(null);
				try {
					const data = await postJson("/comfyui/workflows/skill", {
						id: props.workflow.id,
						...body
					});
					if (data.ok !== true) {
						setError(data.error ?? t("skillFailed"));
						return false;
					}
					setEnabled(data.enabled === true);
					setPack(data.pack ?? null);
					setError(null);
					props.onChanged();
					if (after !== void 0 && data.enabled === true) await openFile(after);
					return true;
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
					return false;
				} finally {
					setBusy(false);
				}
			};
			const saveFile = async () => {
				const body = {
					action: "write",
					path: active,
					content: text
				};
				if (active === "SKILL.md") body.summary = summary;
				const ok = await mutate(body);
				if (ok) {
					setDirty(false);
					setNotice(`${t("skillSaved")} ${active}`);
				}
				return ok;
			};
			/** Switching files with unsaved edits parks the request until the user decides. */
			const selectFile = (path) => {
				if (path === active) return;
				if (dirty) {
					setPendingOpen(path);
					return;
				}
				openFile(path);
			};
			const createFile = async () => {
				if (creating === null) return;
				const name = creating.name.trim();
				if (name === "") return;
				const path = `${creating.bucket}/${name.includes(".") ? name : `${name}.md`}`;
				if (await mutate({
					action: "write",
					path,
					content: ""
				}, path)) setCreating(null);
			};
			/** Open the pack directory in the desktop file manager (on the machine
			* running DSH — the hint says so, and the path stays visible below). */
			const revealDir = async () => {
				setNotice(null);
				try {
					const data = await postJson("/comfyui/workflows/skill/reveal", { id: props.workflow.id });
					if (data.ok !== true) {
						setError(data.error ?? t("skillFailed"));
						return;
					}
					setError(null);
					setNotice(`${t("skillRevealed")} ${data.dir ?? ""}`);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				}
			};
			const createDir = async () => {
				if (creatingDir === null) return;
				const name = creatingDir.trim();
				if (name === "") return;
				if (await mutate({
					action: "mkdir",
					name
				})) {
					setCreatingDir(null);
					setNotice(`${t("skillDirCreated")} ${name}/`);
				}
			};
			const applyRename = async () => {
				if (renaming === null) return;
				const to = renaming.to.trim();
				if (to === "") return;
				const bucket = renaming.from.includes("/") ? `${renaming.from.split("/")[0] ?? ""}/` : "";
				const target = to.includes("/") ? to : `${bucket}${to}`;
				if (await mutate({
					action: "rename",
					path: renaming.from,
					to: target
				}, target)) setRenaming(null);
			};
			/** Import local files into the pack. The destination bucket comes from the
			* host (one extension rule, shared with the agent-facing listing), so the
			* panel only sends the name and the bytes. */
			const importFiles = async (files) => {
				if (files.length === 0) return;
				setBusy(true);
				setNotice(null);
				let imported = null;
				let failed = 0;
				for (const file of files) try {
					const bytes = await file.arrayBuffer();
					const data = await postRaw(`/comfyui/workflows/skill/import?id=${encodeURIComponent(props.workflow.id)}&name=${encodeURIComponent(file.name)}`, bytes);
					if (data.ok !== true) {
						failed += 1;
						setError(data.error ?? t("skillFailed"));
						continue;
					}
					setPack(data.pack ?? null);
					imported = data.path ?? null;
				} catch (cause) {
					failed += 1;
					setError(cause instanceof Error ? cause.message : String(cause));
				}
				setBusy(false);
				props.onChanged();
				if (imported !== null) {
					if (failed === 0) {
						setError(null);
						setNotice(`${t("skillImported")} ${imported}`);
					}
					await openFile(imported);
				}
			};
			const head = (0, react.createElement)("div", { className: "dsc-view-head" }, (0, react.createElement)("button", {
				className: "dsc-btn",
				onClick: props.onBack
			}, t("wfViewBack")), (0, react.createElement)("div", {
				className: "dsc-wf-name",
				title: props.workflow.name
			}, `${t("skillTitle")} · ${props.workflow.name}`));
			if (!enabled) return (0, react.createElement)("div", null, head, (0, react.createElement)("div", { className: "dsc-hint" }, t("skillIntro")), error !== null ? (0, react.createElement)(ErrorNote, {
				t,
				message: error
			}) : null, (0, react.createElement)("div", { className: "dsc-row" }, (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: () => void mutate({ action: "enable" }, "SKILL.md")
			}, t("skillEnable"))));
			const files = pack?.files ?? [];
			const impliedDirs = files.filter((file) => file.path.includes("/")).map((file) => file.path.split("/")[0] ?? "").filter((dir) => dir !== "");
			const packDirs = [.../* @__PURE__ */ new Set([...pack?.dirs ?? [], ...impliedDirs])].sort((a, b) => a.localeCompare(b));
			const buckets = [{
				label: "",
				items: files.filter((file) => !file.path.includes("/"))
			}, ...packDirs.map((bucket) => ({
				label: bucket,
				items: files.filter((file) => file.path.startsWith(`${bucket}/`))
			}))];
			/** Where a new file may go: the pack's own directories first, then the
			* presets it has not used yet. */
			const targetDirs = [...packDirs, ...presetDirs.filter((dir) => !packDirs.includes(dir))];
			/** One row in the pack file list; clicking opens it for editing. */
			const fileButton = (file) => (0, react.createElement)("button", {
				key: file.path,
				className: `dsc-skill-file${file.path === active ? " dsc-skill-file--active" : ""}`,
				onClick: () => selectFile(file.path)
			}, (0, react.createElement)("span", { className: "dsc-skill-file-name" }, file.path.includes("/") ? file.path.split("/")[1] : file.path), (0, react.createElement)("span", { className: "dsc-skill-file-size" }, formatBytes(file.size)));
			const fileList = (0, react.createElement)("div", {
				className: "dsc-skill-files",
				onDragOver: (event) => event.preventDefault(),
				onDrop: (event) => {
					event.preventDefault();
					const dropped = Array.from(event.dataTransfer?.files ?? []);
					if (dropped.length > 0) importFiles(dropped);
				}
			}, (0, react.createElement)("div", { className: "dsc-skill-actions" }, (0, react.createElement)("label", {
				className: "dsc-btn dsc-btn--sm",
				title: t("skillImportHint")
			}, t("skillImport"), (0, react.createElement)("input", {
				type: "file",
				multiple: true,
				style: { display: "none" },
				disabled: busy,
				onChange: (event) => {
					const picked = Array.from(event.target.files ?? []);
					event.target.value = "";
					if (picked.length > 0) importFiles(picked);
				}
			})), creating === null ? (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--sm",
				disabled: busy,
				onClick: () => {
					setCreatingDir(null);
					setCreating({
						bucket: targetDirs[0] ?? "references",
						name: ""
					});
				}
			}, t("skillNewFile")) : null, creatingDir === null ? (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--sm",
				disabled: busy,
				onClick: () => {
					setCreating(null);
					setCreatingDir("");
				}
			}, t("skillNewDir")) : null, (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--sm",
				disabled: busy,
				title: t("skillRevealHint"),
				onClick: () => void revealDir()
			}, t("skillReveal")), (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--sm",
				disabled: busy,
				title: t("skillRefreshHint"),
				onClick: () => void refreshFiles()
			}, t("skillRefresh"))), creatingDir === null ? null : (0, react.createElement)("div", { className: "dsc-skill-create" }, (0, react.createElement)("input", {
				className: "dsc-input dsc-input--sm",
				value: creatingDir,
				placeholder: t("skillNewDirPlaceholder"),
				onChange: (event) => setCreatingDir(event.target.value),
				onKeyDown: (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						createDir();
					}
				}
			}), (0, react.createElement)("div", { className: "dsc-hint" }, t("skillNewDirHint", { presets: presetDirs.join(" / ") })), (0, react.createElement)("div", { className: "dsc-row" }, (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--sm",
				disabled: busy,
				onClick: () => void createDir()
			}, t("skillCreate")), (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--sm",
				onClick: () => setCreatingDir(null)
			}, t("cancel")))), (0, react.createElement)("div", { className: "dsc-skill-drop-hint" }, t("skillDropHint")), buckets.map((bucket) => bucket.items.length === 0 && bucket.label !== "" ? null : bucket.label === "" ? (0, react.createElement)("div", {
				key: ".",
				className: "dsc-skill-bucket"
			}, bucket.items.map(fileButton)) : (0, react.createElement)("details", {
				key: bucket.label,
				className: "dsc-fold dsc-skill-fold",
				open: true
			}, (0, react.createElement)("summary", null, `${bucket.label}/`), (0, react.createElement)("div", { className: "dsc-skill-bucket" }, bucket.items.map(fileButton)))), creating === null ? null : (0, react.createElement)("div", { className: "dsc-skill-create" }, (0, react.createElement)("select", {
				className: "dsc-input dsc-input--sm",
				value: creating.bucket,
				onChange: (event) => setCreating({
					...creating,
					bucket: event.target.value
				})
			}, targetDirs.map((bucket) => (0, react.createElement)("option", {
				key: bucket,
				value: bucket
			}, `${bucket}/`))), (0, react.createElement)("input", {
				className: "dsc-input dsc-input--sm",
				value: creating.name,
				placeholder: t("skillNewPlaceholder"),
				onChange: (event) => setCreating({
					...creating,
					name: event.target.value
				}),
				onKeyDown: (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						createFile();
					}
				}
			}), (0, react.createElement)("div", { className: "dsc-row" }, (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--sm",
				disabled: busy,
				onClick: () => void createFile()
			}, t("skillCreate")), (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--sm",
				onClick: () => setCreating(null)
			}, t("cancel")))));
			const editor = (0, react.createElement)("div", { className: "dsc-skill-main" }, (0, react.createElement)("div", { className: "dsc-skill-editor-head" }, (0, react.createElement)("span", { className: "dsc-skill-path" }, active), dirty ? (0, react.createElement)("span", { className: "dsc-badge dsc-badge--warn" }, t("skillDirty")) : null), active === "SKILL.md" ? (0, react.createElement)("div", { className: "dsc-field" }, (0, react.createElement)("label", null, t("skillSummary")), (0, react.createElement)("input", {
				className: "dsc-input",
				value: summary,
				placeholder: t("skillSummaryPlaceholder"),
				onChange: (event) => {
					setSummary(event.target.value);
					setDirty(true);
				}
			}), (0, react.createElement)("div", { className: "dsc-hint" }, t("skillSummaryHint"))) : null, isSkillImage(active) ? (0, react.createElement)("div", { className: "dsc-skill-preview" }, (0, react.createElement)("img", {
				src: `/comfyui/workflows/skill/raw?id=${encodeURIComponent(props.workflow.id)}&path=${encodeURIComponent(active)}`,
				alt: active
			}), (0, react.createElement)("div", { className: "dsc-hint" }, t("skillImageHint"))) : (0, react.createElement)("textarea", {
				className: "dsc-textarea dsc-textarea--skill",
				value: text,
				spellCheck: false,
				onChange: (event) => {
					setText(event.target.value);
					setDirty(true);
				},
				onKeyDown: (event) => {
					if (event.key !== "Tab") return;
					event.preventDefault();
					const area = event.target;
					const start = area.selectionStart;
					const end = area.selectionEnd;
					setText(`${text.slice(0, start)}  ${text.slice(end)}`);
					setDirty(true);
					window.requestAnimationFrame(() => {
						area.selectionStart = start + 2;
						area.selectionEnd = start + 2;
					});
				}
			}), (0, react.createElement)("div", { className: "dsc-row" }, isSkillImage(active) ? null : (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy || !dirty,
				onClick: () => void saveFile()
			}, t("skillSave")), active !== "SKILL.md" ? (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: () => setRenaming({
					from: active,
					to: active.includes("/") ? active.split("/")[1] ?? "" : active
				})
			}, t("skillRename")) : null, active !== "SKILL.md" ? (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: () => setConfirming(active)
			}, t("skillDeleteFile")) : null), confirming !== null && confirming !== "*pack*" ? (0, react.createElement)("div", { className: "dsc-dialog dsc-dialog--danger" }, (0, react.createElement)("div", { className: "dsc-dialog-head dsc-danger-text" }, `${t("skillDeleteConfirm")} ${confirming}`), (0, react.createElement)("div", { className: "dsc-row" }, (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--danger",
				disabled: busy,
				onClick: () => {
					const target = confirming;
					setConfirming(null);
					mutate({
						action: "delete",
						path: target
					}, "SKILL.md");
				}
			}, t("confirmDelete")), (0, react.createElement)("button", {
				className: "dsc-btn",
				onClick: () => setConfirming(null)
			}, t("cancel")))) : null, renaming !== null ? (0, react.createElement)("div", { className: "dsc-skill-create" }, (0, react.createElement)("input", {
				className: "dsc-input dsc-input--sm",
				value: renaming.to,
				onChange: (event) => setRenaming({
					...renaming,
					to: event.target.value
				})
			}), (0, react.createElement)("div", { className: "dsc-row" }, (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--sm",
				disabled: busy,
				onClick: () => void applyRename()
			}, t("skillRename")), (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--sm",
				onClick: () => setRenaming(null)
			}, t("cancel")))) : null);
			return (0, react.createElement)("div", null, head, (0, react.createElement)("div", { className: "dsc-row dsc-skill-flags" }, (0, react.createElement)("label", { className: "dsc-check" }, (0, react.createElement)("input", {
				type: "checkbox",
				checked: pack?.required === true,
				disabled: busy,
				onChange: (event) => void mutate({
					action: "require",
					required: event.target.checked
				})
			}), t("skillRequired"))), pack !== null ? (0, react.createElement)("div", {
				className: "dsc-skill-dir",
				title: pack.dir
			}, `${t("skillDir")}: ${pack.dir}`) : null, pendingOpen !== null ? (0, react.createElement)("div", { className: "dsc-dialog" }, (0, react.createElement)("div", { className: "dsc-dialog-head" }, t("skillDirtyPrompt")), (0, react.createElement)("div", { className: "dsc-row" }, (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: () => {
					const target = pendingOpen;
					setPendingOpen(null);
					saveFile().then((ok) => {
						if (ok) openFile(target);
					});
				}
			}, t("skillSaveAndSwitch")), (0, react.createElement)("button", {
				className: "dsc-btn",
				onClick: () => {
					const target = pendingOpen;
					setPendingOpen(null);
					setDirty(false);
					openFile(target);
				}
			}, t("skillDiscard")), (0, react.createElement)("button", {
				className: "dsc-btn",
				onClick: () => setPendingOpen(null)
			}, t("cancel")))) : null, notice !== null ? (0, react.createElement)("div", { className: "dsc-ok" }, notice) : null, error !== null ? (0, react.createElement)(ErrorNote, {
				t,
				message: error
			}) : null, (0, react.createElement)("div", { className: "dsc-skill" }, fileList, editor), (0, react.createElement)("div", { className: "dsc-skill-footer" }, (0, react.createElement)("div", { className: "dsc-row" }, (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: () => void mutate({ action: "disable" }).then(() => props.onBack())
			}, t("skillDetach")), (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--danger",
				disabled: busy,
				onClick: () => setConfirming("*pack*")
			}, t("skillDestroy"))), confirming === "*pack*" ? (0, react.createElement)("div", { className: "dsc-dialog dsc-dialog--danger" }, (0, react.createElement)("div", { className: "dsc-dialog-head dsc-danger-text" }, t("skillDestroyConfirm", { count: pack?.files.length ?? 0 })), (0, react.createElement)("div", { className: "dsc-row" }, (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--danger",
				disabled: busy,
				onClick: () => {
					setConfirming(null);
					mutate({ action: "destroy" }).then(() => props.onBack());
				}
			}, t("skillDestroyConfirmButton")), (0, react.createElement)("button", {
				className: "dsc-btn",
				onClick: () => setConfirming(null)
			}, t("cancel")))) : null));
		}
		function WorkflowsTab({ t }) {
			const [list, setList] = (0, react.useState)(null);
			const [comfyui, setComfyui] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [comfyuiError, setComfyuiError] = (0, react.useState)(null);
			const [notice, setNotice] = (0, react.useState)(null);
			const [editing, setEditing] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [viewing, setViewing] = (0, react.useState)(null);
			const [extract, setExtract] = (0, react.useState)(null);
			/** Open transfer dialog: 'export' | 'import', null = closed. */
			const [transfer, setTransfer] = (0, react.useState)(null);
			const [tagFilter, setTagFilter] = (0, react.useState)(null);
			const [skillFor, setSkillFor] = (0, react.useState)(null);
			/** A delete waiting on the user's answer about the workflow's skill pack. */
			const [deleting, setDeleting] = (0, react.useState)(null);
			const load = async () => {
				try {
					setList(await getList("/comfyui/workflows", "workflows"));
					setError(null);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				}
				try {
					setComfyui(await getList("/comfyui/comfy-workflows", "workflows"));
					setComfyuiError(null);
				} catch (cause) {
					setComfyuiError(cause instanceof Error ? cause.message : String(cause));
				}
			};
			(0, react.useEffect)(() => {
				let cancelled = false;
				getList("/comfyui/workflows", "workflows").then((workflows) => {
					if (!cancelled) setList(workflows);
				}).catch((cause) => {
					if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
				});
				getList("/comfyui/comfy-workflows", "workflows").then((workflows) => {
					if (!cancelled) setComfyui(workflows);
				}).catch((cause) => {
					if (!cancelled) setComfyuiError(cause instanceof Error ? cause.message : String(cause));
				});
				return () => {
					cancelled = true;
				};
			}, []);
			/** Persist the current draft; returns the saved workflow id, or null on failure (error already set). */
			const persist = async () => {
				if (editing === null) return null;
				setBusy(true);
				setError(null);
				setNotice(null);
				let workflow;
				if (typeof editing.workflow === "string") try {
					workflow = JSON.parse(editing.workflow);
				} catch {
					setError(t("wfJsonError"));
					setBusy(false);
					return null;
				}
				else workflow = editing.workflow;
				try {
					const body = {
						name: String(editing.name ?? ""),
						description: String(editing.description ?? ""),
						workflow,
						parameters: editing.parameters ?? [],
						tags: editing.tags ?? []
					};
					if (editing.id !== void 0) body.id = editing.id;
					return (await postJson("/comfyui/workflows", body)).workflow?.id ?? (typeof editing.id === "string" ? editing.id : null);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
					return null;
				} finally {
					setBusy(false);
				}
			};
			const save = async () => {
				if (await persist() === null) return;
				setEditing(null);
				await load();
			};
			/** Save the draft, then immediately queue it with the saved parameters. */
			const saveAndRun = async () => {
				const id = await persist();
				if (id === null) return;
				setEditing(null);
				await load();
				await run(id);
			};
			const run = async (id) => {
				setBusy(true);
				setError(null);
				setNotice(null);
				try {
					const result = await postJson("/comfyui/workflows/run", { id });
					setNotice(`${t("wfQueued")} ${shortId(result.promptId)}`);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			};
			/** Delete a workflow. A workflow carrying a skill pack asks first: the pack
			* holds hand-written notes that nothing else can restore. */
			const remove = async (id, deleteSkill = false) => {
				setBusy(true);
				setError(null);
				try {
					await postJson("/comfyui/workflows/delete", {
						id,
						deleteSkill
					});
					await load();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			};
			const requestRemove = (workflow) => {
				if (workflow.skillDir !== void 0) {
					setDeleting(workflow);
					return;
				}
				remove(workflow.id);
			};
			const openExtract = (file) => {
				setError(null);
				setExtract({
					file,
					analysis: null,
					error: null,
					mode: "split"
				});
			};
			const runExtract = async (state) => {
				setBusy(true);
				try {
					const data = await postJson("/comfyui/comfy-workflows/extract", {
						file: state.file,
						mode: state.mode
					});
					if (data.ok !== true) throw new Error(data.error ?? "failed to extract");
					setNotice(`${state.file} → ${t("wfExtractedNotice")}${data.warnings.length > 0 ? `（${t("error")}: ${data.warnings.join("；")}）` : ""}`);
					setExtract(null);
					await load();
				} catch (cause) {
					setExtract({
						...state,
						error: cause instanceof Error ? cause.message : String(cause)
					});
				} finally {
					setBusy(false);
				}
			};
			const importFile = (file) => {
				const reader = new FileReader();
				reader.onload = () => {
					try {
						const parsed = JSON.parse(String(reader.result));
						setEditing({
							name: file.name.replace(/\.json$/i, ""),
							workflow: parsed
						});
						setError(null);
					} catch {
						setError(t("wfJsonError"));
					}
				};
				reader.readAsText(file);
			};
			const view = async (file) => {
				setBusy(true);
				setError(null);
				try {
					const data = await getJson(`/comfyui/comfy-workflows?file=${encodeURIComponent(file)}`);
					if (data.ok !== true || data.workflow === void 0) throw new Error(data.error ?? "failed to read workflow");
					setViewing({
						file,
						graph: data.workflow
					});
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			};
			if (skillFor !== null) return (0, react.createElement)(SkillPackEditor, {
				t,
				workflow: skillFor,
				onBack: () => {
					setSkillFor(null);
					load();
				},
				onChanged: () => {
					load();
				}
			});
			if (viewing !== null) return (0, react.createElement)(WorkflowView, {
				t,
				file: viewing.file,
				graph: viewing.graph,
				onBack: () => setViewing(null)
			});
			if (extract !== null) return (0, react.createElement)(ExtractDialog, {
				t,
				state: extract,
				onUpdate: setExtract,
				onRun: (state) => runExtract(state),
				onClose: () => setExtract(null)
			});
			if (transfer === "export") return (0, react.createElement)(ExportDialog, {
				t,
				workflows: list ?? [],
				onClose: () => setTransfer(null),
				onDone: (notice) => {
					setTransfer(null);
					setNotice(notice);
					load();
				}
			});
			if (transfer === "import") return (0, react.createElement)(ImportDialog, {
				t,
				onClose: () => setTransfer(null),
				onDone: (notice) => {
					setTransfer(null);
					setNotice(notice);
					load();
				}
			});
			if (error !== null) return (0, react.createElement)("div", null, (0, react.createElement)(ErrorNote, {
				t,
				message: error
			}));
			if (list === null) return (0, react.createElement)("div", { className: "dsc-meta" }, "…");
			if (editing !== null) return (0, react.createElement)("div", { className: "dsc-form" }, (0, react.createElement)("div", { className: "dsc-field" }, (0, react.createElement)("label", null, t("wfName")), (0, react.createElement)("input", {
				className: "dsc-input",
				value: editing.name ?? "",
				onChange: (event) => setEditing({
					...editing,
					name: event.target.value
				})
			})), (0, react.createElement)("div", { className: "dsc-field" }, (0, react.createElement)("label", null, t("wfDesc")), (0, react.createElement)("textarea", {
				className: "dsc-textarea",
				placeholder: t("wfDescPlaceholder"),
				value: editing.description ?? "",
				onChange: (event) => setEditing({
					...editing,
					description: event.target.value
				})
			})), (0, react.createElement)("div", { className: "dsc-field" }, (0, react.createElement)("label", null, t("wfTags")), (0, react.createElement)(TagEditor, {
				t,
				tags: editing.tags ?? [],
				onChange: (tags) => setEditing({
					...editing,
					tags
				})
			})), (0, react.createElement)("div", { className: "dsc-field" }, (0, react.createElement)("label", null, t("wfParams")), (0, react.createElement)(ParameterEditor, {
				t,
				params: editing.parameters ?? [],
				workflow: parseDraftWorkflow(editing.workflow),
				onChange: (parameters) => setEditing({
					...editing,
					parameters
				})
			})), (0, react.createElement)("div", { className: "dsc-field" }, (0, react.createElement)("label", null, t("wfJson")), (0, react.createElement)("textarea", {
				className: "dsc-textarea dsc-textarea--json",
				value: typeof editing.workflow === "string" ? editing.workflow : JSON.stringify(editing.workflow ?? {}, null, 2),
				onChange: (event) => setEditing({
					...editing,
					workflow: event.target.value
				})
			})), notice !== null ? (0, react.createElement)("div", { className: "dsc-ok" }, notice) : null, error !== null ? (0, react.createElement)(ErrorNote, {
				t,
				message: error
			}) : null, (0, react.createElement)("div", { className: "dsc-row" }, (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: () => void save()
			}, t("wfSave")), (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: () => void saveAndRun()
			}, t("wfSaveRun")), (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: () => {
					setEditing(null);
					setError(null);
				}
			}, t("wfCancel"))));
			const comfyuiFold = (0, react.createElement)("details", { className: "dsc-fold" }, (0, react.createElement)("summary", null, `${t("wfComfyuiSection")} (${comfyui?.length ?? 0})`), (0, react.createElement)("div", { className: "dsc-fold-body" }, (0, react.createElement)("div", { className: "dsc-hint" }, t("wfComfyuiHint")), comfyuiError !== null ? (0, react.createElement)(ErrorNote, {
				t,
				message: comfyuiError
			}) : null, comfyui === null ? (0, react.createElement)("div", { className: "dsc-meta" }, "…") : comfyui.length === 0 ? (0, react.createElement)("div", { className: "dsc-meta" }, t("wfComfyuiEmpty")) : (0, react.createElement)("div", { className: "dsc-list" }, comfyui.map((workflow) => (0, react.createElement)("div", {
				key: workflow.name,
				className: "dsc-wf dsc-wf--comfyui",
				title: t("wfNameCopyHint"),
				onClick: () => {
					copyText(workflow.name).then((ok) => {
						if (ok) setNotice(`${t("wfNameCopied")}：${workflow.name}`);
					});
				}
			}, (0, react.createElement)("div", { className: "dsc-wf-col" }, (0, react.createElement)("div", {
				className: "dsc-wf-name",
				title: workflow.name
			}, workflow.name), (0, react.createElement)("div", { className: "dsc-wf-actions" }, (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: (event) => {
					event.stopPropagation();
					view(workflow.name);
				}
			}, t("wfView")), (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: (event) => {
					event.stopPropagation();
					openExtract(workflow.name);
				}
			}, t("wfExtract"))), (0, react.createElement)("div", { className: "dsc-meta" }, [formatBytes(workflow.size), workflow.modified !== void 0 ? formatTs(new Date(workflow.modified).toISOString()) : ""].filter(Boolean).join(" · "))), (0, react.createElement)("span", { className: workflow.extracted ? "dsc-badge dsc-badge--ok" : "dsc-badge dsc-badge--warn" }, workflow.extracted ? `${t("wfExtracted")} ${workflow.derived.length}` : t("wfNotExtracted")))))));
			const tagCounts = /* @__PURE__ */ new Map();
			for (const workflow of list) for (const tag of workflow.tags ?? []) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
			const visibleTags = [...tagCounts.entries()].sort((a, b) => {
				const pa = PRESET_TAGS.indexOf(a[0]);
				const pb = PRESET_TAGS.indexOf(b[0]);
				if (pa !== -1 && pb !== -1) return pa - pb;
				if (pa !== -1) return -1;
				if (pb !== -1) return 1;
				return b[1] - a[1];
			}).map(([tag]) => tag);
			const visibleList = tagFilter === null ? list : list.filter((workflow) => (workflow.tags ?? []).includes(tagFilter));
			const apiFold = (0, react.createElement)("details", {
				className: "dsc-fold",
				open: true
			}, (0, react.createElement)("summary", null, `${t("wfLibrarySection")} (${visibleList.length})`), (0, react.createElement)("div", { className: "dsc-fold-body" }, visibleTags.length > 0 || tagFilter !== null ? (0, react.createElement)("div", { className: "dsc-tag-filter" }, (0, react.createElement)("select", {
				className: "dsc-input dsc-input--inline",
				title: t("wfTags"),
				value: tagFilter ?? "",
				onChange: (event) => setTagFilter(event.target.value === "" ? null : event.target.value)
			}, (0, react.createElement)("option", { value: "" }, `${t("wfTagAll")} (${list.length})`), visibleTags.map((tag) => (0, react.createElement)("option", {
				key: tag,
				value: tag
			}, `${tag} (${tagCounts.get(tag) ?? 0})`)))) : null, visibleList.length === 0 ? (0, react.createElement)("div", { className: "dsc-meta" }, t("wfEmpty")) : (0, react.createElement)("div", { className: "dsc-list" }, visibleList.map((workflow) => (0, react.createElement)("div", {
				key: workflow.id,
				className: "dsc-wf",
				title: t("wfNameCopyHint"),
				onClick: () => {
					copyText(workflow.name).then((ok) => {
						if (ok) setNotice(`${t("wfNameCopied")}：${workflow.name}`);
					});
				}
			}, (0, react.createElement)("div", { className: "dsc-wf-top" }, (0, react.createElement)("div", {
				className: "dsc-wf-name",
				title: workflow.name
			}, workflow.name), (workflow.tags ?? []).length > 0 ? (0, react.createElement)("div", { className: "dsc-wf-tags" }, (workflow.tags ?? []).map((tag) => (0, react.createElement)("span", {
				key: tag,
				className: "dsc-tag-chip dsc-tag-chip--mini"
			}, tag))) : null, workflow.skillDir !== void 0 ? (0, react.createElement)("span", {
				className: "dsc-badge dsc-badge--ok",
				title: t("skillBadgeHint")
			}, workflow.requireSkill === true ? t("skillBadgeRequired") : t("skillBadge")) : null), workflow.description !== "" ? (0, react.createElement)("div", { className: "dsc-wf-desc" }, workflow.description) : null, (0, react.createElement)("div", { className: "dsc-wf-updated" }, `${t("wfUpdated")} ${formatTs(workflow.updatedAt)}`), (0, react.createElement)("div", { className: "dsc-wf-actions" }, (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: (event) => {
					event.stopPropagation();
					run(workflow.id);
				}
			}, t("wfRun")), (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: (event) => {
					event.stopPropagation();
					setEditing({
						...workflow,
						workflow: JSON.stringify(workflow.workflow, null, 2),
						parameters: workflow.parameters ?? [],
						tags: workflow.tags ?? []
					});
					setError(null);
				}
			}, t("wfEdit")), (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: (event) => {
					event.stopPropagation();
					setSkillFor(workflow);
					setError(null);
				}
			}, t("skillButton")), (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: (event) => {
					event.stopPropagation();
					requestRemove(workflow);
				}
			}, t("wfDelete"))), deleting?.id === workflow.id ? (0, react.createElement)("div", {
				className: "dsc-dialog dsc-dialog--danger",
				onClick: (event) => event.stopPropagation()
			}, (0, react.createElement)("div", { className: "dsc-dialog-head dsc-danger-text" }, t("skillDeleteWithWorkflow")), (0, react.createElement)("div", { className: "dsc-row" }, (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--danger",
				disabled: busy,
				onClick: () => {
					setDeleting(null);
					remove(workflow.id, true);
				}
			}, t("skillDeleteBoth")), (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: () => {
					setDeleting(null);
					remove(workflow.id, false);
				}
			}, t("skillKeepPack")), (0, react.createElement)("button", {
				className: "dsc-btn",
				onClick: () => setDeleting(null)
			}, t("cancel")))) : null)))));
			return (0, react.createElement)("div", null, (0, react.createElement)("div", { className: "dsc-toolbar" }, (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: () => {
					setEditing({
						workflow: {},
						parameters: [],
						tags: []
					});
					setError(null);
				}
			}, t("wfAdd")), (0, react.createElement)("label", { className: "dsc-btn" }, t("wfImportFile"), (0, react.createElement)("input", {
				type: "file",
				accept: ".json,application/json",
				style: { display: "none" },
				onChange: (event) => {
					const file = event.target.files?.[0];
					if (file !== void 0) importFile(file);
					event.target.value = "";
				}
			})), (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: () => {
					setError(null);
					setTransfer("export");
				}
			}, t("exportPresets")), (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: () => {
					setError(null);
					setTransfer("import");
				}
			}, t("importPresets")), (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: () => void load()
			}, t("wfRefresh"))), notice !== null ? (0, react.createElement)("div", { className: "dsc-ok" }, notice) : null, comfyuiFold, apiFold, (0, react.createElement)(LoadArea, {
				t,
				onNotice: setNotice
			}));
		}
		/** Extract-mode chooser: shows the canvas analysis and lets the user pick how
		* to extract runnable API workflows from a ComfyUI-side graph. */
		function ExtractDialog(props) {
			const { t, state, onUpdate, onRun, onClose } = props;
			(0, react.useEffect)(() => {
				if (state.analysis === null && state.error === null) {
					let cancelled = false;
					getJson(`/comfyui/comfy-workflows/analyze?file=${encodeURIComponent(state.file)}`).then((data) => {
						if (cancelled) return;
						if (data.ok !== true || data.analysis === void 0) onUpdate({
							...state,
							error: data.error ?? "failed to analyze"
						});
						else if (data.analysis.ok !== true) onUpdate({
							...state,
							error: data.analysis.error
						});
						else onUpdate({
							...state,
							analysis: data.analysis,
							mode: data.analysis.mode === "single" ? "all" : "split"
						});
					}).catch((cause) => {
						if (!cancelled) onUpdate({
							...state,
							error: cause instanceof Error ? cause.message : String(cause)
						});
					});
					return () => {
						cancelled = true;
					};
				}
			});
			const modes = [
				{
					mode: "all",
					label: t("wfExtractModeAll"),
					hint: t("wfExtractModeAllHint")
				},
				{
					mode: "split",
					label: t("wfExtractModeSplit"),
					hint: t("wfExtractModeSplitHint")
				},
				{
					mode: "main",
					label: t("wfExtractModeMain"),
					hint: t("wfExtractModeMainHint")
				}
			];
			const analysis = state.analysis;
			return (0, react.createElement)("div", { className: "dsc-dialog" }, (0, react.createElement)("div", { className: "dsc-dialog-head" }, (0, react.createElement)("span", { className: "dsc-wf-name" }, `${t("wfExtractTitle")}: ${state.file}`), (0, react.createElement)("button", {
				className: "dsc-panel-close",
				"aria-label": t("close"),
				onClick: onClose
			}, "✕")), analysis === null ? (0, react.createElement)("div", { className: "dsc-meta" }, "…") : (0, react.createElement)("div", null, (0, react.createElement)("div", { className: "dsc-hint" }, `${t("wfComponents")}: ${analysis.components.length} · ${t("wfBypassed")}: ${analysis.bypassedCount} · ${t("wfIsolated")}: ${analysis.isolated.length}`), analysis.components.length > 0 ? (0, react.createElement)("ul", { className: "dsc-node-list" }, analysis.components.map((component) => (0, react.createElement)("li", { key: String(component.index) }, `${t("wfComponentLabel")} ${component.index}（${component.size} ${t("wfNodes")}）${component.groups.length > 0 ? `[${component.groups.slice(0, 3).join("+")}]` : ""}`))) : (0, react.createElement)("div", { className: "dsc-meta" }, t("wfExtractEmpty")), (0, react.createElement)("div", { className: "dsc-extract-modes" }, modes.map((entry) => (0, react.createElement)("label", {
				key: entry.mode,
				className: "dsc-mode"
			}, (0, react.createElement)("input", {
				type: "radio",
				name: "extract-mode",
				checked: state.mode === entry.mode,
				onChange: () => onUpdate({
					...state,
					mode: entry.mode
				})
			}), (0, react.createElement)("span", { className: "dsc-mode-label" }, entry.label), (0, react.createElement)("span", { className: "dsc-hint" }, entry.hint)))), state.error !== null ? (0, react.createElement)(ErrorNote, {
				t,
				message: state.error
			}) : null, (0, react.createElement)("div", { className: "dsc-row" }, (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: analysis.components.length === 0,
				onClick: () => void onRun(state)
			}, t("wfExtractRun")), (0, react.createElement)("button", {
				className: "dsc-btn",
				onClick: onClose
			}, t("wfCancel")))));
		}
		/** Shared checkbox row for the transfer dialogs: name, badges, description. */
		function TransferItem(props) {
			return (0, react.createElement)("label", { className: "dsc-transfer-item" }, (0, react.createElement)("input", {
				type: "checkbox",
				checked: props.checked,
				onChange: props.onToggle
			}), (0, react.createElement)("span", {
				className: "dsc-transfer-item-name",
				title: props.name
			}, props.name), props.paramBadge !== null ? (0, react.createElement)("span", { className: "dsc-badge" }, props.paramBadge) : null, props.skillBadge !== null ? (0, react.createElement)("span", { className: "dsc-badge dsc-badge--ok" }, props.skillBadge) : null, props.description !== "" ? (0, react.createElement)("span", {
				className: "dsc-transfer-item-desc",
				title: props.description
			}, props.description) : null, props.warnings.length > 0 ? (0, react.createElement)("span", {
				className: "dsc-transfer-item-desc dsc-danger-text",
				title: props.warnings.join("；")
			}, props.warnings.join("；")) : null);
		}
		/** While a transfer dialog is open, swallow drag events aimed at the host
		* page. The conversation shell attaches dropped files to the chat with
		* document-level bubble listeners, so dragging a preset toward the dialog
		* also dropped it into the conversation. Window-capture listeners run before
		* any document-bubble handler and shield everything OUTSIDE the dialog;
		* events landing inside the dialog pass through — the dialog box itself must
		* stopPropagation() them at React's dispatch root, or they bubble on to the
		* document and the shell attaches the file anyway. */
		function DragGuard() {
			(0, react.useEffect)(() => {
				const guard = (event) => {
					if (event.target instanceof Element && event.target.closest(".dsc-transfer") !== null) return;
					event.preventDefault();
					event.stopPropagation();
				};
				for (const type of [
					"dragenter",
					"dragover",
					"drop"
				]) window.addEventListener(type, guard, true);
				return () => {
					for (const type of [
						"dragenter",
						"dragover",
						"drop"
					]) window.removeEventListener(type, guard, true);
				};
			}, []);
			return null;
		}
		/** Export dialog: pick library workflows (checkboxes + select-all, all
		* pre-selected) and download one preset package. Packaging happens host-side;
		* the dialog lists, selects, and submits a native form download. */
		function ExportDialog(props) {
			const { t, workflows } = props;
			const [selected, setSelected] = (0, react.useState)(() => new Set(workflows.map((workflow) => workflow.id)));
			const [busy, setBusy] = (0, react.useState)(false);
			const toggle = (id) => {
				setSelected((prev) => {
					const next = new Set(prev);
					if (next.has(id)) next.delete(id);
					else next.add(id);
					return next;
				});
			};
			const allSelected = workflows.length > 0 && selected.size === workflows.length;
			const toggleAll = () => {
				setSelected(allSelected ? /* @__PURE__ */ new Set() : new Set(workflows.map((workflow) => workflow.id)));
			};
			/** Download natively: a hidden form GETs `/comfyui/workflows/export/<file
			* name>?ids=…` and the server answers with `content-disposition:
			* attachment`, so the browser — not JS blob plumbing (fetch → blob →
			* objectURL → revoke, which one environment turned into a 0-byte file) —
			* owns the transfer. The page never navigates because the response is an
			* attachment.
			*
			* GET with the name in the path is deliberate: this setup's download
			* manager mangles POST downloads (renames them, or re-fetches the URL on
			* its own), which is where the phantom "skills sometimes missing" zips
			* came from. A GET is the one verb every manager handles correctly — and
			* since the name rides in the URL, saved name == receipt name even under
			* interception, and a manager's own re-fetch still gets a genuine export
			* of the same ids (the route is a pure read).
			*
			* The form response is invisible to JS, so the notice is fed from
			* `export/last` — the server's record of what it ACTUALLY packaged — not
			* from the checkboxes. */
			const exportSelected = () => {
				if (busy) return;
				setBusy(true);
				(async () => {
					let previousAt = null;
					try {
						previousAt = (await getJson("/comfyui/workflows/export/last")).last?.at ?? null;
					} catch {}
					const now = /* @__PURE__ */ new Date();
					const p = (n, width = 2) => String(n).padStart(width, "0");
					const filename = `dsh-comfyui-presets-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}-${p(now.getMilliseconds(), 3)}-${Math.random().toString(36).slice(2, 8)}.zip`;
					const form = document.createElement("form");
					form.method = "GET";
					form.action = `/comfyui/workflows/export/${filename}`;
					form.style.display = "none";
					for (const id of selected) {
						const input = document.createElement("input");
						input.type = "hidden";
						input.name = "ids";
						input.value = id;
						form.append(input);
					}
					document.body.append(form);
					form.submit();
					form.remove();
					let last = null;
					for (let attempt = 0; attempt < 10 && last === null; attempt++) {
						await new Promise((resolve) => window.setTimeout(resolve, 350));
						try {
							const payload = await getJson("/comfyui/workflows/export/last");
							if (payload.last !== null && payload.last.at !== previousAt) last = payload.last;
						} catch {}
					}
					const names = (last?.names ?? selectedNames()).join("、");
					let notice = t("transferExportDone", {
						n: last?.count ?? selected.size,
						names
					});
					if (last !== null) notice += " " + t("transferExportFile", {
						file: last.filename,
						size: Math.max(1, Math.round(last.size / 1024))
					});
					if (last !== null && last.warnings.length > 0) notice += " " + t("transferExportWarnings", { warnings: last.warnings.join("；") });
					props.onDone(notice);
				})();
			};
			/** Names behind the current selection, dialog order, with pack-bearing
			* entries annotated. Shown next to the submit button so "what will be
			* packaged — and will it carry skills" is readable at the decision point:
			* a selection that happens to exclude the one pack-bearing workflow looks
			* exactly like "skills export unreliably" from the zip alone. */
			const selectedNames = () => workflows.filter((workflow) => selected.has(workflow.id)).map((workflow) => workflow.skillDir !== void 0 ? `${workflow.name} (${t("skillBadge")})` : workflow.name);
			return (0, react.createElement)("div", {
				className: "dsc-picker-overlay",
				onClick: props.onClose
			}, (0, react.createElement)(DragGuard), (0, react.createElement)("div", {
				className: "dsc-transfer",
				onClick: (event) => event.stopPropagation(),
				onDragEnter: (event) => {
					event.preventDefault();
					event.stopPropagation();
				},
				onDragOver: (event) => {
					event.preventDefault();
					event.stopPropagation();
				},
				onDrop: (event) => {
					event.preventDefault();
					event.stopPropagation();
				}
			}, (0, react.createElement)("div", { className: "dsc-transfer-head" }, (0, react.createElement)("span", { className: "dsc-transfer-title" }, t("transferExportTitle")), (0, react.createElement)("button", {
				className: "dsc-panel-close",
				"aria-label": t("close"),
				onClick: props.onClose
			}, "✕")), workflows.length === 0 ? (0, react.createElement)("div", { className: "dsc-transfer-empty" }, t("transferExportEmpty")) : (0, react.createElement)("div", { className: "dsc-transfer-body" }, (0, react.createElement)("div", { className: "dsc-transfer-bar" }, (0, react.createElement)("span", { className: "dsc-hint" }, t("transferExportHint", {
				total: workflows.length,
				selected: selected.size
			})), (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--sm",
				onClick: toggleAll
			}, allSelected ? t("transferSelectNone") : t("transferSelectAll"))), (0, react.createElement)("div", { className: "dsc-transfer-list" }, workflows.map((workflow) => (0, react.createElement)(TransferItem, {
				key: workflow.id,
				name: workflow.name,
				description: workflow.description,
				paramBadge: (workflow.parameters ?? []).length > 0 ? t("transferParamBadge", { n: (workflow.parameters ?? []).length }) : null,
				skillBadge: workflow.skillDir !== void 0 ? t("skillBadge") : null,
				warnings: [],
				checked: selected.has(workflow.id),
				onToggle: () => toggle(workflow.id)
			})))), selected.size > 0 ? (0, react.createElement)("div", { className: "dsc-transfer-note" }, (0, react.createElement)("span", {
				className: "dsc-hint",
				title: selectedNames().join("、")
			}, t("transferSelectedList", { names: selectedNames().join("、") }))) : null, (0, react.createElement)("div", { className: "dsc-transfer-actions" }, workflows.length === 0 ? null : (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--primary",
				disabled: busy || selected.size === 0,
				onClick: () => exportSelected()
			}, busy ? t("transferExporting") : t("transferExportRun", { n: selected.size })), (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: props.onClose
			}, t("cancel")))));
		}
		/** Import dialog: choose a preset package (file picker or drag-drop), see
		* what it offers, then import the selection as NEW workflows. The file is
		* POSTed twice by design — analyze and apply parse the same bytes, so the
		* host needs no temp-file staging or cleanup. */
		function ImportDialog(props) {
			const { t } = props;
			const [file, setFile] = (0, react.useState)(null);
			const [analysis, setAnalysis] = (0, react.useState)(null);
			const [selected, setSelected] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [results, setResults] = (0, react.useState)(null);
			const [imported, setImported] = (0, react.useState)(0);
			const [dragOver, setDragOver] = (0, react.useState)(false);
			/** Phase 1: upload the package for analysis (no server-side writes). */
			const analyze = async (picked) => {
				setBusy(true);
				setError(null);
				try {
					const data = await postRaw("/comfyui/workflows/import/analyze", await picked.arrayBuffer());
					if (data.ok !== true || data.analysis === void 0) throw new Error(data.error ?? "failed to analyze");
					setFile(picked);
					setAnalysis(data.analysis);
					setSelected(new Set(data.analysis.workflows.map((entry) => entry.index)));
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			};
			const toggle = (index) => {
				setSelected((prev) => {
					const next = new Set(prev);
					if (next.has(index)) next.delete(index);
					else next.add(index);
					return next;
				});
			};
			const allSelected = analysis !== null && analysis.workflows.length > 0 && selected.size === analysis.workflows.length;
			const toggleAll = () => {
				if (analysis === null) return;
				setSelected(allSelected ? /* @__PURE__ */ new Set() : new Set(analysis.workflows.map((entry) => entry.index)));
			};
			/** Phase 2: re-upload the same bytes with the selection as manifest indexes. */
			const importSelected = async () => {
				if (file === null) return;
				setBusy(true);
				setError(null);
				try {
					const bytes = await file.arrayBuffer();
					const data = await postRaw(`/comfyui/workflows/import/apply?select=${[...selected].join(",")}`, bytes);
					if (data.ok !== true || data.results === void 0) throw new Error(data.error ?? "failed to import");
					setResults(data.results);
					setImported(data.imported ?? 0);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			};
			const finish = () => {
				if (imported > 0) props.onDone(t("transferImportDone", { n: imported }));
				else props.onClose();
			};
			return (0, react.createElement)("div", {
				className: "dsc-picker-overlay",
				onClick: props.onClose
			}, (0, react.createElement)(DragGuard), (0, react.createElement)("div", {
				className: "dsc-transfer",
				onClick: (event) => event.stopPropagation(),
				onDragEnter: (event) => {
					event.preventDefault();
					event.stopPropagation();
				},
				onDragOver: (event) => {
					event.preventDefault();
					event.stopPropagation();
				},
				onDrop: (event) => {
					event.preventDefault();
					event.stopPropagation();
				}
			}, (0, react.createElement)("div", { className: "dsc-transfer-head" }, (0, react.createElement)("span", { className: "dsc-transfer-title" }, t("transferImportTitle")), (0, react.createElement)("button", {
				className: "dsc-panel-close",
				"aria-label": t("close"),
				onClick: props.onClose
			}, "✕")), (0, react.createElement)("div", { className: "dsc-transfer-body" }, results !== null ? (0, react.createElement)("div", { className: "dsc-transfer-list" }, results.map((outcome) => (0, react.createElement)("div", {
				key: outcome.index,
				className: `dsc-transfer-item dsc-transfer-item--static${outcome.ok ? " dsc-transfer-item--ok" : " dsc-transfer-item--fail"}`
			}, (0, react.createElement)("span", {
				className: "dsc-transfer-item-name",
				title: outcome.name
			}, outcome.ok ? t("transferImportedItem", {
				src: outcome.name,
				dst: outcome.newName ?? ""
			}) : t("transferImportFailedItem", {
				src: outcome.name,
				reason: outcome.error ?? ""
			})), outcome.warnings.length > 0 ? (0, react.createElement)("span", {
				className: "dsc-transfer-item-desc",
				title: outcome.warnings.join("；")
			}, outcome.warnings.join("；")) : null))) : analysis === null ? (0, react.createElement)("label", {
				className: `dsc-transfer-drop${dragOver ? " dsc-transfer-drop--over" : ""}`,
				onDragOver: (event) => {
					event.preventDefault();
					setDragOver(true);
				},
				onDragLeave: () => setDragOver(false),
				onDrop: (event) => {
					event.preventDefault();
					setDragOver(false);
					const dropped = event.dataTransfer?.files?.[0];
					if (dropped !== void 0) analyze(dropped);
				}
			}, (0, react.createElement)("input", {
				type: "file",
				accept: ".zip,application/zip,application/x-zip-compressed",
				style: { display: "none" },
				onChange: (event) => {
					const picked = event.target.files?.[0];
					if (picked !== void 0) analyze(picked);
					event.target.value = "";
				}
			}), busy ? t("transferImporting") : t("transferPickFile")) : (0, react.createElement)("div", { className: "dsc-transfer-body" }, (0, react.createElement)("div", { className: "dsc-transfer-bar" }, (0, react.createElement)("span", { className: "dsc-hint" }, t("transferPackageInfo", {
				n: analysis.workflows.length,
				date: formatTs(analysis.exportedAt)
			})), (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--sm",
				onClick: toggleAll
			}, allSelected ? t("transferSelectNone") : t("transferSelectAll"))), (0, react.createElement)("div", { className: "dsc-transfer-list" }, analysis.workflows.map((entry) => (0, react.createElement)(TransferItem, {
				key: entry.index,
				name: entry.name,
				description: entry.description,
				paramBadge: entry.paramCount > 0 ? t("transferParamBadge", { n: entry.paramCount }) : null,
				skillBadge: entry.skill !== null ? entry.skill.required ? t("transferSkillRequired", { n: entry.skill.fileCount }) : t("transferSkillBadge", { n: entry.skill.fileCount }) : null,
				warnings: entry.warnings,
				checked: selected.has(entry.index),
				onToggle: () => toggle(entry.index)
			})))), error !== null ? (0, react.createElement)(ErrorNote, {
				t,
				message: error
			}) : null, analysis !== null && results === null ? (0, react.createElement)("div", { className: "dsc-hint" }, t("transferImportNote")) : null, analysis === null && results === null ? (0, react.createElement)("div", { className: "dsc-hint" }, t("transferPickHint")) : null), (0, react.createElement)("div", { className: "dsc-transfer-actions" }, results !== null ? (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--primary",
				onClick: finish
			}, t("transferFinish")) : analysis !== null ? (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--primary",
				disabled: busy || selected.size === 0,
				onClick: () => {
					importSelected();
				}
			}, busy ? t("transferImporting") : t("transferImportRun", { n: selected.size })) : null, (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: busy,
				onClick: results !== null ? finish : props.onClose
			}, t("cancel")))));
		}
		/** Read-only inspection of a ComfyUI-side saved workflow: node list + JSON. */
		function WorkflowView(props) {
			const nodes = Array.isArray(props.graph.nodes) ? props.graph.nodes.filter((node) => node.mode !== 4 && typeof node.type === "string" && node.type !== "") : [];
			const json = JSON.stringify(props.graph, null, 2);
			return (0, react.createElement)("div", { className: "dsc-view" }, (0, react.createElement)("div", { className: "dsc-view-head" }, (0, react.createElement)("span", { className: "dsc-wf-name" }, props.file), (0, react.createElement)("button", {
				className: "dsc-btn",
				onClick: props.onBack
			}, props.t("wfViewBack"))), (0, react.createElement)("div", { className: "dsc-view-label" }, `${props.t("wfViewNodes")} (${nodes.length})`), nodes.length === 0 ? (0, react.createElement)("div", { className: "dsc-meta" }, props.t("wfViewEmpty")) : (0, react.createElement)("ul", { className: "dsc-node-list" }, nodes.map((node) => (0, react.createElement)("li", { key: String(node.id) }, `${String(node.id)} · ${String(node.type)}`))), (0, react.createElement)("div", { className: "dsc-view-label" }, props.t("wfViewJson")), (0, react.createElement)("textarea", {
				className: "dsc-textarea dsc-textarea--json dsc-textarea--view",
				readOnly: true,
				value: json
			}));
		}
		/** Tab 2: asset preview — thumbnails of everything the plugin generated. */
		function AssetsTab({ t, onPreview }) {
			const [assets, setAssets] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [filter, setFilter] = (0, react.useState)(() => panelStore.getAssetFilter());
			/** Asset awaiting the delete confirmation, if any. */
			const [pendingDelete, setPendingDelete] = (0, react.useState)(null);
			const [deleting, setDeleting] = (0, react.useState)(false);
			const [notice, setNotice] = (0, react.useState)(null);
			const load = async () => {
				try {
					setAssets(await getList("/comfyui/assets", "assets"));
					setError(null);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				}
			};
			(0, react.useEffect)(() => {
				let cancelled = false;
				getList("/comfyui/assets", "assets").then((items) => {
					if (!cancelled) setAssets(items);
				}).catch((cause) => {
					if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
				});
				// A run that finishes while this tab is open should appear without a
				// manual refresh (the server archives completed runs on read).
				const timer = setInterval(() => {
					if (cancelled) return;
					if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
					void load();
				}, 8e3);
				return () => {
					cancelled = true;
					clearInterval(timer);
				};
			}, []);
			/** Delete the record and (when the output directory is known) its files. */
			const confirmDelete = async (asset) => {
				setDeleting(true);
				try {
					const result = await postJson("/comfyui/assets/delete", { promptId: asset.promptId });
					if (result.ok !== true) throw new Error(result.error ?? "delete failed");
					setPendingDelete(null);
					setNotice(t("assetDeleteDone", { deleted: result.deleted ?? 0 }));
					if (Array.isArray(result.failures) && result.failures.length > 0) setError(result.failures.join("; "));
					await load();
				} catch (cause) {
					setError(t("assetDeleteFailed", { message: cause instanceof Error ? cause.message : String(cause) }));
					setPendingDelete(null);
				} finally {
					setDeleting(false);
				}
			};
			if (error !== null && assets === null) return (0, react.createElement)("div", null, (0, react.createElement)(ErrorNote, {
				t,
				message: error
			}));
			if (assets === null) return (0, react.createElement)("div", { className: "dsc-meta" }, "…");
			const names = [...new Set(assets.map((asset) => asset.workflowName ?? ""))];
			const visible = filter === "" ? assets : assets.filter((asset) => (asset.workflowName ?? "") === filter);
			const previewItems = visible.flatMap((asset) => asset.media.map((item) => ({
				url: item.url,
				kind: item.kind
			})));
			const openAsset = (asset) => {
				const first = asset.media[0];
				const index = first !== void 0 ? previewItems.findIndex((item) => item.url === first.url) : 0;
				onPreview(previewItems.map((item) => item.url), previewItems.map((item) => item.kind), index < 0 ? 0 : index);
			};
			return (0, react.createElement)("div", null, (0, react.createElement)("div", { className: "dsc-toolbar" }, (0, react.createElement)("select", {
				className: "dsc-input dsc-input--inline",
				value: filter,
				onChange: (event) => setFilter(event.target.value)
			}, (0, react.createElement)("option", { value: "" }, t("assetAll")), names.map((name) => (0, react.createElement)("option", {
				key: name,
				value: name
			}, name === "" ? "—" : name))), (0, react.createElement)("button", {
				className: "dsc-btn",
				onClick: () => void load()
			}, t("refresh"))), error !== null ? (0, react.createElement)(ErrorNote, {
				t,
				message: error
			}) : null, notice !== null ? (0, react.createElement)("div", { className: "dsc-ok" }, notice) : null, visible.length === 0 ? (0, react.createElement)("div", { className: "dsc-meta" }, t("assetEmpty")) : (0, react.createElement)("div", { className: "dsc-assets-grid" }, visible.map((asset) => (0, react.createElement)(AssetThumb, {
				key: asset.promptId,
				asset,
				t,
				onClick: () => openAsset(asset),
				onDelete: () => {
					setNotice(null);
					setPendingDelete(asset);
				}
			}))), pendingDelete !== null ? (0, react.createElement)(ConfirmDialog, {
				t,
				title: t("assetDeleteTitle"),
				body: t("assetDeleteBody", { count: pendingDelete.media.length }),
				detail: pendingDelete.media.map((item) => item.filename).join("、"),
				busy: deleting,
				onConfirm: () => {
					confirmDelete(pendingDelete);
				},
				onCancel: () => setPendingDelete(null)
			}) : null);
		}
		/** Modal confirmation for a destructive action (asset deletion). */
		function ConfirmDialog(props) {
			return (0, react.createElement)("div", {
				className: "dsc-picker-overlay",
				onClick: props.onCancel
			}, (0, react.createElement)("div", {
				className: "dsc-confirm",
				onClick: (event) => event.stopPropagation()
			}, (0, react.createElement)("div", { className: "dsc-confirm-title" }, props.title), (0, react.createElement)("div", { className: "dsc-confirm-body" }, props.body), props.detail !== void 0 && props.detail !== "" ? (0, react.createElement)("div", { className: "dsc-confirm-detail" }, props.detail) : null, (0, react.createElement)("div", { className: "dsc-confirm-actions" }, (0, react.createElement)("button", {
				className: "dsc-btn",
				disabled: props.busy,
				onClick: props.onCancel
			}, props.t("cancel")), (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--danger",
				disabled: props.busy,
				onClick: props.onConfirm
			}, props.t("confirmDelete")))));
		}
		function AssetThumb(props) {
			const first = props.asset.media[0];
			const [broken, setBroken] = (0, react.useState)(false);
			const trash = (0, react.createElement)("button", {
				className: "dsc-asset-trash",
				title: props.t("assetDelete"),
				"aria-label": props.t("assetDelete"),
				onClick: (event) => {
					event.stopPropagation();
					props.onDelete();
				}
			}, "🗑");
			if (first === void 0 || broken) return (0, react.createElement)("div", {
				className: "dsc-asset dsc-asset--empty",
				onClick: props.onClick
			}, (0, react.createElement)("div", null, props.t("assetGone")), (0, react.createElement)("div", { className: "dsc-meta" }, props.asset.workflowName ?? "—"), first !== void 0 ? (0, react.createElement)("div", {
				className: "dsc-meta dsc-asset-file",
				title: first.filename
			}, first.filename) : null, trash);
			return (0, react.createElement)("div", {
				className: "dsc-asset",
				onClick: props.onClick
			}, first.kind === "video" ? (0, react.createElement)("video", {
				src: first.url,
				controls: true,
				preload: "metadata",
				onClick: (event) => event.stopPropagation()
			}) : first.kind === "audio" ? (0, react.createElement)("div", { className: "dsc-asset-audio-icon" }, (0, react.createElement)("svg", {
				className: "dsc-asset-audio-icon-wave",
				"aria-hidden": "true"
			}, (0, react.createElement)("defs", null, (0, react.createElement)("pattern", {
				id: "dsc-wave-pattern",
				width: 64,
				height: 110,
				patternUnits: "userSpaceOnUse"
			}, (0, react.createElement)("g", { fill: "rgba(255,255,255,0.15)" }, (0, react.createElement)("rect", {
				x: 0,
				y: 50,
				width: 2,
				height: 10,
				rx: 1
			}), (0, react.createElement)("rect", {
				x: 4,
				y: 44,
				width: 2,
				height: 22,
				rx: 1
			}), (0, react.createElement)("rect", {
				x: 8,
				y: 48,
				width: 2,
				height: 14,
				rx: 1
			}), (0, react.createElement)("rect", {
				x: 12,
				y: 38,
				width: 2,
				height: 34,
				rx: 1
			}), (0, react.createElement)("rect", {
				x: 16,
				y: 46,
				width: 2,
				height: 18,
				rx: 1
			}), (0, react.createElement)("rect", {
				x: 20,
				y: 52,
				width: 2,
				height: 6,
				rx: 1
			}), (0, react.createElement)("rect", {
				x: 24,
				y: 40,
				width: 2,
				height: 30,
				rx: 1
			}), (0, react.createElement)("rect", {
				x: 28,
				y: 48,
				width: 2,
				height: 14,
				rx: 1
			}), (0, react.createElement)("rect", {
				x: 32,
				y: 42,
				width: 2,
				height: 26,
				rx: 1
			}), (0, react.createElement)("rect", {
				x: 36,
				y: 36,
				width: 2,
				height: 38,
				rx: 1
			}), (0, react.createElement)("rect", {
				x: 40,
				y: 47,
				width: 2,
				height: 16,
				rx: 1
			}), (0, react.createElement)("rect", {
				x: 44,
				y: 51,
				width: 2,
				height: 8,
				rx: 1
			}), (0, react.createElement)("rect", {
				x: 48,
				y: 40,
				width: 2,
				height: 30,
				rx: 1
			}), (0, react.createElement)("rect", {
				x: 52,
				y: 45,
				width: 2,
				height: 20,
				rx: 1
			}), (0, react.createElement)("rect", {
				x: 56,
				y: 38,
				width: 2,
				height: 34,
				rx: 1
			}), (0, react.createElement)("rect", {
				x: 60,
				y: 49,
				width: 2,
				height: 12,
				rx: 1
			})))), (0, react.createElement)("rect", {
				width: "100%",
				height: "100%",
				fill: "url(#dsc-wave-pattern)"
			})), (0, react.createElement)("svg", {
				className: "dsc-asset-audio-icon-sym",
				viewBox: "0 0 24 24",
				"aria-hidden": "true",
				dangerouslySetInnerHTML: { __html: "<path fill=\"currentColor\" d=\"M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z\"/>" }
			}), (0, react.createElement)("span", {
				className: "dsc-asset-audio-icon-name",
				title: first.filename
			}, first.filename)) : (0, react.createElement)("img", {
				src: first.url,
				alt: first.filename,
				loading: "lazy",
				onError: () => setBroken(true)
			}), (0, react.createElement)("div", { className: "dsc-asset-meta" }, props.asset.workflowName ?? "—"), (0, react.createElement)("div", {
				className: "dsc-asset-meta dsc-asset-file",
				title: first.filename
			}, first.filename), trash);
		}
		/**
		* Tab 3: the task center — active tasks (pending / generating) shown as
		* cards with id, status and progress, plus history filtered by the
		* completed / failed / cancelled chips. Polled every 3 seconds.
		*/
		function QueueTab({ t, onPreview, live }) {
			const [filter, setFilter] = (0, react.useState)("all");
			const [active, setActive] = (0, react.useState)(null);
			const [history, setHistory] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			// A 1 s clock drives the running timers between the 3 s job refreshes;
			// it never fetches anything.
			const [now, setNow] = (0, react.useState)(() => Date.now());
			(0, react.useEffect)(() => {
				const timer = setInterval(() => setNow(Date.now()), 1e3);
				return () => clearInterval(timer);
			}, []);
			const load = async (current) => {
				try {
					const historyStatus = current === "all" ? "completed,failed,cancelled" : current;
					const [activeData, historyData] = await Promise.all([getJson("/comfyui/jobs?status=pending,in_progress&limit=100"), getJson(`/comfyui/jobs?status=${historyStatus}&limit=100`)]);
					if (activeData.ok !== true) throw new Error(activeData.error ?? t("queueError"));
					if (historyData.ok !== true) throw new Error(historyData.error ?? t("queueError"));
					setActive([...activeData.jobs ?? []].sort((a, b) => (a.createTime ?? 0) - (b.createTime ?? 0)));
					setHistory(historyData.jobs);
					setError(null);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				}
			};
			(0, react.useEffect)(() => {
				load(filter);
				// The list refreshes for as long as the tab is on screen; a hidden tab
				// has no reader, so it stops asking.
				const timer = setInterval(() => {
					if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
					void load(filter);
				}, 3e3);
				return () => clearInterval(timer);
			}, [filter]);
			const act = async (payload) => {
				setBusy(true);
				try {
					const data = await postJson("/comfyui/jobs/actions", payload);
					if (data.ok !== true) throw new Error(data.error ?? "action failed");
					await load(filter);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			};
			if (error !== null) return (0, react.createElement)("div", null, (0, react.createElement)(ErrorNote, {
				t,
				message: error
			}));
			if (active === null || history === null) return (0, react.createElement)("div", { className: "dsc-meta" }, "…");
			const historyPreviewUrls = history.map(previewUrlOf);
			const previewImages = historyPreviewUrls.filter((url) => url !== null);
			const previewPrefix = [];
			{
				let acc = 0;
				for (const url of historyPreviewUrls) {
					previewPrefix.push(acc);
					if (url !== null) acc += 1;
				}
			}
			// Whatever is executing right now: the socket knows the step, the node
			// and the elapsed time even before ComfyUI's job list catches up.
			const liveById = new Map((Array.isArray(live?.tasks) ? live.tasks : []).map((task) => [task.promptId, task]));
			const running = (Array.isArray(live?.tasks) ? live.tasks : []).filter((task) => task.state === "running" || task.state === "pending");
			const queueRemaining = typeof live?.socket?.queueRemaining === "number" ? live.socket.queueRemaining : null;
			return (0, react.createElement)("div", { className: "dsc-list" }, (0, react.createElement)("div", { className: "dsc-queue-actions" }, (0, react.createElement)("button", {
				className: "dsc-btn",
				onClick: () => void load(filter),
				disabled: busy
			}, t("queueRefresh")), (0, react.createElement)("button", {
				className: "dsc-btn",
				onClick: () => void act({ action: "clear" }),
				disabled: busy
			}, t("jobClearQueue")), (0, react.createElement)("button", {
				className: "dsc-btn",
				onClick: () => void act({ action: "clearHistory" }),
				disabled: busy
			}, t("jobClearHistory")), (0, react.createElement)("button", {
				className: "dsc-btn",
				onClick: () => void act({
					action: "free",
					unloadModels: true,
					freeMemory: true
				}),
				disabled: busy
			}, t("jobFree"))), running.length > 0 ? (0, react.createElement)("div", { className: "dsc-section" }, (0, react.createElement)("div", { className: "dsc-section-head" }, (0, react.createElement)("span", { className: "dsc-section-title" }, t("runningNow")), queueRemaining !== null && queueRemaining > 1 ? (0, react.createElement)("span", { className: "dsc-meta" }, t("liveQueued", { n: queueRemaining - 1 })) : null), (0, react.createElement)("div", { className: "dsc-list" }, running.map((task) => (0, react.createElement)(RunningCard, {
				key: task.promptId,
				t,
				task,
				now,
				busy,
				act
			})))) : null, (0, react.createElement)("div", { className: "dsc-section" }, (0, react.createElement)("div", { className: "dsc-section-head" }, (0, react.createElement)("span", { className: "dsc-section-title" }, `${t("jobActive")} (${active.length})`)), active.length === 0 ? (0, react.createElement)("div", { className: "dsc-meta" }, t("queueEmpty")) : (0, react.createElement)("div", { className: "dsc-list" }, active.map((job) => (0, react.createElement)(JobRow, {
				key: job.id,
				job,
				t,
				busy,
				act,
				now,
				live: liveById.get(job.id) ?? job.live ?? null
			})))), (0, react.createElement)("div", { className: "dsc-section" }, (0, react.createElement)("div", { className: "dsc-section-head" }, (0, react.createElement)("span", { className: "dsc-section-title" }, `${t("jobFilterLabel")} (${history.length})`), (0, react.createElement)("div", { className: "dsc-queue-head" }, JOB_FILTERS.map((item) => (0, react.createElement)("button", {
				key: item.key,
				className: `dsc-chip${filter === item.key ? " dsc-chip--active" : ""}`,
				onClick: () => setFilter(item.key),
				disabled: busy
			}, t(item.label))))), history.length === 0 ? (0, react.createElement)("div", { className: "dsc-meta" }, t("queueEmpty")) : (0, react.createElement)("div", { className: "dsc-list" }, history.map((job, index) => (0, react.createElement)(JobRow, {
				key: job.id,
				job,
				t,
				busy,
				act,
				now,
				live: liveById.get(job.id) ?? job.live ?? null,
				onPreview: historyPreviewUrls[index] !== null && previewImages.length > 0 ? () => onPreview(previewImages, previewImages.map(() => "image"), previewPrefix[index]) : void 0
			})))), (0, react.createElement)("div", { className: "dsc-hint dsc-queue-livehint" }, t("queueLiveHint")));
		}
		/** Seconds between two timestamps, floored at 0. */
		function secondsBetween(from, to) {
			if (typeof from !== "number" || !Number.isFinite(from)) return null;
			return Math.max(0, Math.round(((to ?? Date.now()) - from) / 1e3));
		}
		/**
		* The "running now" card: the one place with a big, live progress bar —
		* step counter, ETA, elapsed time, node and queue position, all from the
		* WebSocket snapshot (falling back to "waiting" before the first step).
		*/
		function RunningCard({ t, task, now, busy, act }) {
			const value = typeof task.value === "number" ? task.value : null;
			const max = typeof task.max === "number" && task.max > 0 ? task.max : null;
			const pct = value !== null && max !== null ? Math.min(100, Math.round((value / max) * 100)) : null;
			const elapsed = typeof task.elapsedMs === "number" ? Math.round(task.elapsedMs / 1e3) : null;
			const eta = typeof task.etaMs === "number" && task.etaMs > 0 ? Math.max(1, Math.ceil(task.etaMs / 1e3)) : null;
			const name = typeof task.workflowName === "string" && task.workflowName !== "" ? task.workflowName : task.promptId;
			const detail = [];
			if (max !== null) detail.push(t("liveSteps", { value: value ?? 0, max }));
			if (task.node !== null && task.node !== void 0) detail.push(t("liveNode", { node: task.node }));
			if (elapsed !== null) detail.push(t("liveElapsed", { s: elapsed }));
			if (eta !== null) detail.push(t("liveEta", { s: eta }));
			return (0, react.createElement)("div", { className: "dsc-running" }, (0, react.createElement)("div", { className: "dsc-running-head" }, (0, react.createElement)("span", { className: "dsc-running-name", title: name }, name), (0, react.createElement)("span", { className: "dsc-running-pct" }, pct === null ? "…" : `${pct}%`)), (0, react.createElement)("div", { className: "dsc-progress-track dsc-progress-track--lg" }, (0, react.createElement)("div", {
				className: pct === null ? "dsc-progress-fill dsc-progress-fill--busy" : "dsc-progress-fill",
				style: pct === null ? void 0 : { width: `${pct}%` }
			})), (0, react.createElement)("div", { className: "dsc-running-meta" }, (0, react.createElement)("span", { className: "dsc-running-detail" }, detail.length > 0 ? detail.join(" · ") : t("liveWaiting")), (0, react.createElement)("button", {
				className: "dsc-btn dsc-btn--sm",
				disabled: busy,
				onClick: () => void act({
					action: "interrupt",
					promptId: task.promptId
				})
			}, t("jobInterrupt"))));
		}
		function jobBadge(status) {
			switch (status) {
				case "in_progress": return "dsc-badge--info";
				case "completed": return "dsc-badge--ok";
				case "failed": return "dsc-badge--danger";
				default: return "";
			}
		}
		const STATUS_LABELS = {
			pending: "jobFilterPending",
			in_progress: "jobFilterInProgress",
			completed: "jobFilterCompleted",
			failed: "jobFilterFailed",
			cancelled: "jobFilterCancelled"
		};
		/**
		* One task card: a compact row with a status badge, task name + short id,
		* duration (and error/progress for in-flight tasks), and a ⋯ menu with
		* per-state actions. Hover highlights the row. Rendered as a component
		* instance (h(JobRow, ...)) so its hooks stay per-card.
		*/
		function JobRow(props) {
			const { job, t, busy, act, onPreview } = props;
			const live = props.live ?? null;
			const now = typeof props.now === "number" ? props.now : Date.now();
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const [copied, setCopied] = (0, react.useState)(false);
			const menuRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (!menuOpen) return;
				const onDoc = (event) => {
					if (menuRef.current !== null && !menuRef.current.contains(event.target)) setMenuOpen(false);
				};
				document.addEventListener("mousedown", onDoc);
				return () => document.removeEventListener("mousedown", onDoc);
			}, [menuOpen]);
			const running = job.status === "in_progress";
			const terminal = job.status === "completed" || job.status === "failed" || job.status === "cancelled";
			// The socket's snapshot is fresher than the job list (which is polled every
			// 3 s), so it wins whenever both describe the same prompt.
			const value = typeof live?.value === "number" ? live.value : job.progress?.value;
			const max = typeof live?.max === "number" && live.max > 0 ? live.max : job.progress?.max;
			const pct = typeof value === "number" && typeof max === "number" && max > 0 ? Math.min(100, Math.round(value / max * 100)) : null;
			const duration = job.executionStartTime !== null && job.executionEndTime !== null ? Math.max(0, Math.round(((job.executionEndTime ?? 0) - (job.executionStartTime ?? 0)) / 1e3)) : null;
			// A running task has no end time yet: show the live clock instead of "0s".
			const elapsed = running ? secondsBetween(job.executionStartTime ?? live?.startedAt ?? null, now) : duration;
			const eta = running && typeof live?.etaMs === "number" && live.etaMs > 0 ? Math.max(1, Math.ceil(live.etaMs / 1e3)) : null;
			const errMsg = job.executionError?.exception_message ?? job.executionError?.message ?? live?.error;
			const name = job.workflowName ?? job.workflowId;
			const preview = previewUrlOf(job);
			const close = () => setMenuOpen(false);
			const statusClass = job.status === "failed" ? " dsc-job-item--failed" : job.status === "cancelled" ? " dsc-job-item--cancelled" : "";
			return (0, react.createElement)("div", { className: `dsc-job-item${statusClass}` }, preview !== null ? (0, react.createElement)("img", {
				src: preview,
				alt: "",
				loading: "lazy",
				className: onPreview !== void 0 ? "dsc-job-preview dsc-job-preview--clickable" : "dsc-job-preview",
				onClick: onPreview
			}) : null, (0, react.createElement)("div", { className: "dsc-job-main" }, (0, react.createElement)("div", {
				className: "dsc-job-name",
				title: name ?? void 0
			}, name !== null && name !== void 0 && name !== "" ? name : "—"), (0, react.createElement)("div", { className: "dsc-job-mid" }, running ? (0, react.createElement)("div", { className: "dsc-progress" }, (0, react.createElement)("div", { className: "dsc-progress-track" }, (0, react.createElement)("div", {
				className: "dsc-progress-fill",
				style: { width: `${pct ?? 0}%` }
			})), (0, react.createElement)("span", { className: "dsc-job-progress" }, pct === null ? "…" : `${value ?? 0}/${max ?? 0} · ${pct}%`)) : null, (0, react.createElement)("div", { className: "dsc-job-mid-right" }, (0, react.createElement)("span", { className: `dsc-badge dsc-badge--status ${jobBadge(job.status)}` }, t(STATUS_LABELS[job.status] ?? job.status)), (0, react.createElement)("div", {
				ref: menuRef,
				className: "dsc-job-menu"
			}, (0, react.createElement)("button", {
				className: "dsc-job-menu-btn",
				"aria-label": t("jobMore"),
				onClick: () => setMenuOpen(!menuOpen)
			}, "⋯"), menuOpen ? (0, react.createElement)("div", { className: "dsc-job-menu-pop" }, (0, react.createElement)("button", { onClick: () => {
				void copyText(job.id).then(() => {
					setCopied(true);
					setTimeout(() => setCopied(false), 1200);
				});
				close();
			} }, copied ? t("jobCopied") : t("jobCopyId")), job.status === "pending" ? (0, react.createElement)("button", { onClick: () => {
				act({
					action: "delete",
					ids: [job.id]
				});
				close();
			} }, t("jobDelete")) : null, running ? (0, react.createElement)("button", { onClick: () => {
				act({
					action: "interrupt",
					promptId: job.id
				});
				close();
			} }, t("jobInterrupt")) : null, terminal ? (0, react.createElement)("button", { onClick: () => {
				act({
					action: "deleteHistory",
					ids: [job.id]
				});
				close();
			} }, t("jobDelete")) : null, terminal ? (0, react.createElement)("button", { onClick: () => {
				act({
					action: "rerun",
					jobId: job.id
				});
				close();
			} }, t("jobRerun")) : null, terminal ? (0, react.createElement)("button", { onClick: () => {
				panelStore.setAssetFilter(name ?? "");
				panelStore.setTab("assets");
				close();
			} }, t("jobViewAssets")) : null) : null))), (0, react.createElement)("div", { className: "dsc-job-bottom" }, (0, react.createElement)("span", { className: "dsc-job-duration" }, running
				? t("jobRunningElapsed", { s: elapsed ?? 0 })
				: `${t("jobDuration")} ${elapsed ?? 0}s`, eta !== null ? ` · ${t("liveEta", { s: eta })}` : ""), errMsg !== void 0 && errMsg !== null ? (0, react.createElement)("span", {
				className: "dsc-job-error",
				title: errMsg
			}, errMsg) : null)));
		}
		//#endregion
		//#region src/client/styles.ts
		/**
		* dsh-comfyui stylesheet, injected once with plugin ownership. Colors come
		* from the host theme tokens (--dsw-alias-*), so the UI follows light/dark.
		*/
		const CSS = `
/* --- shared primitives --- */
.dsc-card {
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  padding: 10px 12px;
  margin: 4px 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--dsw-alias-label-primary);
}
.dsc-card-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.dsc-badge {
  border-radius: 999px; padding: 1px 8px; font-size: 11px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
}
.dsc-badge--ok { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 16%, transparent); }
.dsc-badge--err { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 16%, transparent); }
/* Inline players inserted after video/audio links in chat replies (inline-media.ts). */
.dsc-inline-player { display: block; margin: 6px 0; }
.dsc-inline-player video { display: block; max-width: 100%; max-height: 360px; border-radius: 8px; background: transparent; }
.dsc-inline-player audio { display: block; width: min(100%, 480px); height: 40px; }
.dsc-files { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin-top: 4px; }
.dsc-file { font-size: 12px; color: var(--dsw-alias-label-secondary); text-decoration: none; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsc-file:hover { color: var(--dsw-alias-label-primary); text-decoration: underline; }
.dsc-meta { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dsc-err { color: var(--dsw-alias-state-error-primary); font-size: 12px; margin: 4px 0; }
.dsc-ok { color: var(--dsw-alias-state-success-primary); font-size: 12px; margin: 4px 0; }
.dsc-form { display: flex; flex-direction: column; gap: 12px; max-width: 460px; }
.dsc-field label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--dsw-alias-label-primary); }
.dsc-input, .dsc-textarea {
  width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: transparent; color: inherit; font-size: 13px;
}
select.dsc-input { background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); color-scheme: inherit; }
select.dsc-input option { background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); }
.dsc-textarea { min-height: 90px; resize: vertical; font-family: ui-monospace, monospace; }
.dsc-hint { font-size: 12px; color: var(--dsw-alias-label-secondary); margin-top: 2px; }
.dsc-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dsc-btn {
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px;
  background: transparent; color: inherit; padding: 5px 12px; font-size: 13px; cursor: pointer;
}
.dsc-btn:disabled { opacity: 0.5; cursor: default; }
.dsc-btn--link { display: inline-block; text-decoration: none; }
/* --- header action trigger --- */
.dsc-trigger {
  display: inline-flex; align-items: center; gap: 5px;
  border: 1px solid transparent; background: transparent; color: var(--dsw-alias-label-secondary);
  cursor: pointer; font-size: 13px; padding: 3px 8px; border-radius: 6px;
  white-space: nowrap;
}
.dsc-trigger:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-1); border-color: var(--dsw-alias-border-l1); }
.dsc-trigger[aria-pressed='true'] { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
.dsc-trigger-glyph { font-size: 13px; line-height: 1; }
/* --- connection reminder toast: fixed at the top of the page, mounted by the
   header trigger when the backend probe cannot reach ComfyUI. The probing
   state fades in after a short delay so a fast successful probe never paints;
   the fail state is sticky until dismissed or a later probe recovers. --- */
.dsc-conn-toast {
  position: fixed; top: 14px; left: 50%;
  z-index: 980;
  display: flex; align-items: flex-start; gap: 10px;
  max-width: min(560px, 92vw);
  padding: 10px 12px;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.3);
  color: var(--dsw-alias-label-primary);
  font-size: 12px; line-height: 1.5;
  animation: dsc-conn-toast-in 0.16s ease-out both;
}
.dsc-conn-toast--probing { animation-delay: 0.45s; }
.dsc-conn-toast--ok { border-color: var(--dsw-alias-state-success-primary); }
.dsc-conn-toast--fail { border-color: var(--dsw-alias-state-error-primary); }
.dsc-conn-toast-dot { flex: none; width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; }
.dsc-conn-toast--probing .dsc-conn-toast-dot { background: var(--dsw-alias-state-warn-primary); animation: dsc-conn-dot 1s ease-in-out infinite; }
.dsc-conn-toast--ok .dsc-conn-toast-dot { background: var(--dsw-alias-state-success-primary); }
.dsc-conn-toast--fail .dsc-conn-toast-dot { background: var(--dsw-alias-state-error-primary); }
.dsc-conn-toast-body { min-width: 0; }
.dsc-conn-toast-title { font-weight: 600; }
.dsc-conn-toast--fail .dsc-conn-toast-title { color: var(--dsw-alias-state-error-primary); }
.dsc-conn-toast--ok .dsc-conn-toast-title { color: var(--dsw-alias-state-success-primary); }
.dsc-conn-toast-text { color: var(--dsw-alias-label-secondary); margin-top: 2px; overflow-wrap: anywhere; }
.dsc-conn-toast-close { flex: none; border: none; background: transparent; color: var(--dsw-alias-label-tertiary); cursor: pointer; font-size: 13px; padding: 2px 4px; line-height: 1; }
.dsc-conn-toast-close:hover { color: var(--dsw-alias-label-primary); }
@keyframes dsc-conn-toast-in { from { opacity: 0; transform: translate(-50%, -6px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes dsc-conn-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
/* --- panel shell: floating window, percentage-anchored to the page header
   (top) and the composer (bottom), draggable by the header and resizable via
   the corner handle. Follows the host light/dark theme. --- */
.dsc-panel {
  position: fixed;
  top: var(--dsc-panel-top, 9%);
  right: var(--dsc-panel-right, 1.5%);
  bottom: var(--dsc-panel-bottom, 2%);
  width: var(--dsc-panel-width, 400px);
  max-width: min(92vw, 560px); min-width: 300px;
  z-index: 900;
  display: flex; flex-direction: column;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(0, 0, 0, 0.12);
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  user-select: none;
}
.dsc-panel--dragging { cursor: grabbing; }
.dsc-panel-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); cursor: grab; touch-action: none; }
.dsc-panel--dragging .dsc-panel-head { cursor: grabbing; }
.dsc-panel-resize {
  position: absolute; right: 0; bottom: 0; width: 16px; height: 16px;
  cursor: nwse-resize; touch-action: none;
  background: linear-gradient(135deg, transparent 50%, var(--dsw-alias-label-tertiary) 50%);
  border-bottom-right-radius: 14px;
  opacity: 0.55;
}
.dsc-panel-resize:hover { opacity: 1; }
.dsc-panel-title { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-size: 14px; }
.dsc-panel-head-actions { display: inline-flex; align-items: center; gap: 2px; }
.dsc-panel-reset { border: none; background: transparent; color: var(--dsw-alias-label-tertiary); cursor: pointer; font-size: 13px; padding: 4px 6px; line-height: 1; }
.dsc-panel-reset:hover { color: var(--dsw-alias-label-primary); }
.dsc-panel-close { border: none; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; font-size: 14px; padding: 4px 8px; }
.dsc-panel-close:hover { color: var(--dsw-alias-label-primary); }
.dsc-tabs { display: flex; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.dsc-tab {
  flex: 1; padding: 8px 4px; background: transparent; border: none;
  border-bottom: 2px solid transparent; color: var(--dsw-alias-label-secondary);
  cursor: pointer; font-size: 13px;
}
.dsc-tab--active { color: var(--dsw-alias-label-primary); border-bottom-color: var(--dsw-alias-brand-primary); }
.dsc-panel-body { flex: 1; overflow-y: auto; padding: 10px 12px; }
.dsc-toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
.dsc-list { display: flex; flex-direction: column; gap: 8px; }
/* --- workflows tab --- */
.dsc-wf { border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 8px 10px; background: var(--dsw-alias-bg-layer-1); transition: background 0.12s, border-color 0.12s; cursor: pointer; }
.dsc-wf:hover { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-border-l2); }
.dsc-wf-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.dsc-wf--comfyui { display: flex; align-items: center; gap: 10px; }
.dsc-wf-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.dsc-wf-name { font-weight: 600; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsc-wf-desc { color: var(--dsw-alias-label-secondary); font-size: 12px; margin: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dsc-wf-updated { color: var(--dsw-alias-label-tertiary); font-size: 11px; margin-top: 4px; }
.dsc-wf-actions { display: flex; gap: 6px; margin-top: 6px; }
.dsc-section { margin-top: 14px; }
.dsc-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.dsc-section-title { font-weight: 600; font-size: 13px; }
.dsc-fold { border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; margin-top: 10px; overflow: hidden; background: var(--dsw-alias-bg-layer-1); }
.dsc-fold summary { list-style: none; display: flex; align-items: center; gap: 6px; padding: 8px 10px; cursor: pointer; user-select: none; font-weight: 600; font-size: 13px; }
.dsc-fold summary::-webkit-details-marker { display: none; }
.dsc-fold summary::before { content: '▸'; font-size: 11px; color: var(--dsw-alias-label-secondary); transition: transform 0.15s; }
.dsc-fold[open] summary::before { transform: rotate(90deg); }
.dsc-fold summary:hover { background: var(--dsw-alias-bg-layer-2); }
.dsc-fold-body { padding: 0 10px 10px; }
.dsc-hint { color: var(--dsw-alias-label-secondary); font-size: 11px; margin: 2px 0 6px; white-space: pre-line; }
.dsc-badge { font-size: 11px; padding: 1px 8px; border-radius: 999px; }
.dsc-badge--ok { color: var(--dsw-alias-state-success-primary); border: 1px solid var(--dsw-alias-state-success-primary); }
.dsc-badge--warn { color: var(--dsw-alias-state-warn-primary); border: 1px solid var(--dsw-alias-state-warn-primary); }
.dsc-view-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.dsc-view-label { font-weight: 600; font-size: 12px; margin: 8px 0 4px; }
.dsc-node-list { margin: 0; padding-left: 18px; font-size: 12px; color: var(--dsw-alias-label-secondary); max-height: 180px; overflow-y: auto; }
.dsc-node-list li { margin: 2px 0; }
.dsc-textarea--view { min-height: 220px; resize: vertical; }
.dsc-derived { margin: 6px 0; display: flex; flex-direction: column; gap: 4px; }
.dsc-derived-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; }
.dsc-derived-name { color: var(--dsw-alias-label-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsc-dialog { border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 10px; }
/* --- skill pack editor: file list beside a plain-text editor --- */
.dsc-skill { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; margin-top: 8px; }
.dsc-skill-files { flex: 0 0 190px; min-width: 160px; display: flex; flex-direction: column; gap: 6px; }
.dsc-skill-main { flex: 1 1 300px; min-width: 260px; display: flex; flex-direction: column; gap: 6px; }
.dsc-skill-bucket { display: flex; flex-direction: column; gap: 2px; }
/* Foldable pack directories: each folder renders as a <details> whose header
   stays put while its files collapse, keeping crowded packs scannable. */
.dsc-skill-fold { border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; margin: 2px 0; }
.dsc-skill-fold summary { padding: 5px 10px; font-size: 12px; color: var(--dsw-alias-label-secondary); border-radius: 8px; }
.dsc-skill-fold[open] summary { color: var(--dsw-alias-label-primary); border-bottom: 1px solid var(--dsw-alias-border-l1); border-radius: 8px 8px 0 0; }
.dsc-skill-fold .dsc-skill-bucket { padding: 4px 6px 6px; }
.dsc-skill-file {
  display: flex; align-items: center; justify-content: space-between; gap: 6px;
  border: 1px solid transparent; border-radius: 6px; background: transparent;
  color: inherit; font-size: 12px; padding: 4px 6px; cursor: pointer; text-align: left;
}
.dsc-skill-file:hover { background: var(--dsw-alias-bg-layer-2); }
.dsc-skill-file--active { border-color: var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); }
.dsc-skill-file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsc-skill-file-size { color: var(--dsw-alias-label-secondary); font-size: 11px; flex: none; }
.dsc-skill-create { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
.dsc-skill-editor-head { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; }
.dsc-skill-path { color: var(--dsw-alias-label-primary); }
.dsc-textarea--skill { min-height: 260px; font-size: 12px; line-height: 1.5; }
.dsc-skill-preview { border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; align-items: center; }
.dsc-skill-preview img { max-width: 100%; max-height: 320px; object-fit: contain; border-radius: 6px; }
.dsc-skill-dir { font-size: 11px; color: var(--dsw-alias-label-secondary); margin: 4px 0; word-break: break-all; }
.dsc-skill-flags { margin-top: 6px; }
.dsc-skill-footer { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.dsc-skill-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.dsc-skill-drop-hint { font-size: 11px; color: var(--dsw-alias-label-secondary); border: 1px dashed var(--dsw-alias-border-l1); border-radius: 6px; padding: 4px 6px; text-align: center; }
.dsc-dialog--danger { border-color: var(--dsw-alias-state-error-primary); }
.dsc-danger-text { color: var(--dsw-alias-state-error-primary); font-weight: 600; font-size: 12px; line-height: 1.5; }
.dsc-check { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.dsc-dialog-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.dsc-extract-modes { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; }
.dsc-mode { display: flex; flex-direction: column; gap: 2px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 8px 10px; cursor: pointer; }
.dsc-mode input { accent-color: var(--dsw-alias-brand-primary); }
.dsc-mode-label { font-size: 13px; }
/* --- assets tab --- */
.dsc-assets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
.dsc-asset { position: relative; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; overflow: hidden; cursor: pointer; background: var(--dsw-alias-bg-layer-1); }
/* Destructive, so it only appears while the pointer is on the card. */
.dsc-asset-trash {
  position: absolute; top: 4px; right: 4px; width: 26px; height: 26px; padding: 0; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--dsw-alias-state-error-primary); border-radius: 6px;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-state-error-primary);
  font-size: 14px; cursor: pointer; opacity: 0; transition: opacity 0.12s;
}
.dsc-asset:hover .dsc-asset-trash, .dsc-asset-trash:focus-visible { opacity: 1; }
.dsc-asset-trash:hover { background: var(--dsw-alias-state-error-primary); color: #fff; }
.dsc-asset img, .dsc-asset video { width: 100%; height: 110px; object-fit: cover; display: block; background: #000; }
.dsc-asset-audio-icon { position: relative; width: 100%; height: 110px; box-sizing: border-box; padding: 0 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; background: #26702b; overflow: hidden; }
.dsc-asset-audio-icon-wave { position: absolute; inset: 0; width: 100%; height: 100%; }
.dsc-asset-audio-icon-sym { position: relative; width: 42px; height: 42px; color: #fff; }
.dsc-asset-audio-icon-name { position: relative; max-width: 100%; font-size: 11px; color: rgba(255, 255, 255, 0.9); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dsc-asset--empty {
  height: 110px; padding: 8px; box-sizing: border-box;
  display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 4px;
  font-size: 11px; color: var(--dsw-alias-label-secondary); text-align: center;
}
.dsc-asset-meta { padding: 3px 6px; font-size: 11px; color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* Second meta line: the output filename, under the workflow name. */
.dsc-asset-file { padding-top: 0; font-size: 10px; opacity: 0.8; }
.dsc-asset--empty .dsc-asset-file { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
/* confirmation modal (asset deletion) */
.dsc-confirm { width: min(360px, 88vw); display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; border-radius: 12px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.32); }
.dsc-confirm-title { font-weight: 600; font-size: 14px; }
.dsc-confirm-body { font-size: 13px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }
.dsc-confirm-detail { font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); word-break: break-all; max-height: 96px; overflow-y: auto; }
.dsc-confirm-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }
.dsc-btn--danger { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.dsc-btn--danger:hover:not(:disabled) { background: var(--dsw-alias-state-error-primary); color: #fff; }
.dsc-asset-detail-media { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
.dsc-asset-detail-media img, .dsc-asset-detail-media video { width: 100%; max-height: 320px; object-fit: contain; background: #000; border-radius: 8px; }
.dsc-asset-detail-file { display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 6px 8px; }
.dsc-input--inline { width: auto; }
/* --- queue tab --- */
.dsc-queue-head { display: flex; gap: 8px; flex-wrap: wrap; }
.dsc-queue-item { display: flex; gap: 8px; align-items: center; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 6px 8px; font-size: 12px; flex-wrap: wrap; }
.dsc-queue-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
.dsc-queue-meta { color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dsc-queue-tracked { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
.dsc-progress { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 90px; }
.dsc-progress-track { flex: 1; height: 6px; border-radius: 3px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
.dsc-progress-fill { height: 100%; background: #3b82f6; transition: width 0.4s; }
.dsc-progress:hover .dsc-progress-fill { background: #2563eb; }
.dsc-param-upload-wrap { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
.dsc-param-upload-wrap select { flex: 1; min-width: 0; }
.dsc-dropzone { flex: 1; min-width: 120px; border: 1px dashed var(--dsw-alias-border-l2); border-radius: 6px; padding: 5px 10px; font-size: 11px; color: var(--dsw-alias-label-secondary); text-align: center; cursor: pointer; transition: border-color 0.12s, color 0.12s; }
.dsc-dropzone:hover, .dsc-dropzone--over { border-color: #3b82f6; color: #3b82f6; }
.dsc-upload-select { position: relative; flex: 1; min-width: 0; }
.dsc-upload-select-btn { display: flex; align-items: center; gap: 6px; width: 100%; border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; padding: 3px 8px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); cursor: pointer; font-size: 12px; text-align: left; }
.dsc-upload-select-btn:hover { border-color: var(--dsw-alias-border-l2); }
.dsc-upload-select-thumb { width: 36px; height: 24px; object-fit: cover; border-radius: 3px; background: var(--dsw-alias-bg-layer-2); flex: none; }
.dsc-upload-select-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.dsc-upload-select-pop { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 30; max-height: 220px; overflow-y: auto; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35); padding: 4px; }
.dsc-upload-select-item { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 6px; cursor: pointer; font-size: 12px; color: var(--dsw-alias-label-primary); }
.dsc-upload-select-item:hover { background: var(--dsw-alias-bg-layer-3); }
.dsc-upload-dock { margin-top: 14px; border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.dsc-upload-dock-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.dsc-upload-dock-title { font-weight: 600; font-size: 12px; color: var(--dsw-alias-label-primary); }
.dsc-upload-dock-zone { min-height: 44px; display: flex; align-items: center; justify-content: center; }
.dsc-upload-list { display: flex; flex-direction: column; gap: 4px; }
.dsc-upload-item { display: flex; align-items: center; gap: 8px; }
.dsc-upload-thumb { width: 40px; height: 28px; object-fit: cover; border-radius: 4px; background: var(--dsw-alias-bg-layer-2); flex: none; }
.dsc-upload-thumb--media { display: inline-flex; align-items: center; justify-content: center; font-size: 14px; }
.dsc-upload-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--dsw-alias-label-primary); }
.dsc-upload-select-item--active { background: var(--dsw-alias-bg-layer-3); }
/* --- load area: big preview + picker dialog (ComfyUI LoadImage-like) --- */
.dsc-loadarea { margin-top: 14px; border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.dsc-loadarea-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.dsc-loadarea-title { font-weight: 600; font-size: 12px; color: var(--dsw-alias-label-primary); }
/* load-area slots: slot 0 is the primary (big) source, the rest are thumbs.
   Each slot carries its own actions (add / clear media / delete slot). */
.dsc-loadslots { display: flex; flex-wrap: wrap; gap: 8px; }
/* One slot stretches across the panel; from two on they share a fixed width
   and wrap into rows. The × sits in the corner and appears on hover. */
.dsc-loadslot { position: relative; display: flex; flex-direction: column; gap: 4px; width: 128px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; padding: 6px; background: var(--dsw-alias-bg-layer-1); }
.dsc-loadslot--wide { width: 100%; }
.dsc-loadslot-pick { display: flex; flex-direction: column; align-items: center; gap: 4px; border: none; border-radius: 8px; padding: 0; background: transparent; color: inherit; cursor: pointer; width: 100%; }
.dsc-loadslot-media { width: 100%; height: 104px; object-fit: contain; border-radius: 6px; background: var(--dsw-alias-bg-layer-2); }
.dsc-loadslot--wide .dsc-loadslot-media { height: 220px; }
.dsc-loadslot-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; width: 100%; height: 104px; border-radius: 6px; border: 1px dashed var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); font-size: 12px; }
.dsc-loadslot--wide .dsc-loadslot-empty { height: 120px; font-size: 13px; }
.dsc-loadslot-name { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: var(--dsw-alias-label-primary); text-align: center; }
.dsc-loadslot-index { color: var(--dsw-alias-label-tertiary); }
.dsc-loadslot-add { color: var(--dsw-alias-label-secondary); }
.dsc-loadslot-pick:hover .dsc-loadslot-add { color: var(--dsw-alias-brand-primary); }
.dsc-loadslot-x {
  position: absolute; top: 3px; right: 3px; width: 26px; height: 26px; padding: 0; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 50%;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary);
  font-size: 18px; cursor: pointer; opacity: 0; transition: opacity 0.12s;
}
.dsc-loadslot:hover .dsc-loadslot-x, .dsc-loadslot-x:focus-visible { opacity: 1; }
.dsc-loadslot-x:hover { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }
.dsc-picker-player { width: 100%; border-radius: 6px; background: var(--dsw-alias-bg-layer-1); }
video.dsc-picker-player { max-height: 180px; }
.dsc-picker-player--audio { height: 34px; }
.dsc-loadslot-x:disabled { opacity: 0; cursor: default; }
.dsc-picker-card--none .dsc-picker-thumb--media { font-size: 26px; color: var(--dsw-alias-label-tertiary); }
/* picker overlay: dims the page, dialog floats in the center */
.dsc-picker-overlay { position: fixed; inset: 0; z-index: 9990; background: rgba(6, 8, 12, 0.6); display: flex; align-items: center; justify-content: center; padding: 24px; }
.dsc-picker { position: relative; display: flex; flex-direction: column; width: min(860px, 92vw); height: min(560px, 84vh); background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; box-shadow: 0 16px 56px rgba(0, 0, 0, 0.5); overflow: hidden; }
.dsc-picker-toast { position: absolute; top: 54px; left: 50%; transform: translateX(-50%); z-index: 5; background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-layer-1); padding: 6px 14px; border-radius: 8px; font-size: 12px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3); pointer-events: none; max-width: 80%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsc-picker-bar { display: flex; align-items: center; gap: 4px; padding: 8px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1); flex-wrap: wrap; }
.dsc-picker-tab { border: 1px solid transparent; border-radius: 6px; padding: 4px 12px; font-size: 12px; cursor: pointer; background: transparent; color: var(--dsw-alias-label-primary); }
.dsc-picker-tab--active { background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-layer-1); }
.dsc-picker-tabs { display: flex; gap: 4px; }
.dsc-picker-type { flex: none; border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; padding: 3px 8px; font-size: 12px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); }
.dsc-picker-upload { margin: 0 auto; flex: none; max-width: 200px; min-height: 32px; display: flex; align-items: center; justify-content: center; padding: 0 12px; font-size: 12px; white-space: nowrap; }
.dsc-picker-empty { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; color: var(--dsw-alias-label-tertiary); font-size: 13px; }
.dsc-picker-grid { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 12px; display: flex; gap: 10px; align-items: flex-start; }
.dsc-picker-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.dsc-picker-card { display: flex; flex-direction: column; gap: 4px; min-width: 0; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 6px; background: var(--dsw-alias-bg-layer-2); cursor: pointer; text-align: left; }
.dsc-picker-card:hover { border-color: #3b82f6; }
.dsc-picker-card--active { border-color: var(--dsw-alias-brand-primary); box-shadow: 0 0 0 1px var(--dsw-alias-brand-primary); }
.dsc-picker-thumb { width: 100%; height: auto; object-fit: contain; border-radius: 6px; background: var(--dsw-alias-bg-layer-1); }
.dsc-picker-thumb--media { display: flex; align-items: center; justify-content: center; height: 100px; font-size: 22px; }
.dsc-picker-name { font-size: 13px; line-height: 1.5; padding: 2px 0; color: var(--dsw-alias-label-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsc-picker-card:hover .dsc-picker-name { color: var(--dsw-alias-brand-primary); }
/* --- workflow tags: filter bar, chips, editor --- */
.dsc-tag-filter { display: flex; justify-content: flex-end; padding: 6px 0 2px; }
.dsc-tag-chip { border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px; padding: 2px 10px; font-size: 12px; cursor: pointer; background: transparent; color: var(--dsw-alias-label-primary); }
.dsc-tag-chip--active { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-layer-1); }
.dsc-tag-chip--mini { font-size: 11px; padding: 1px 8px; cursor: default; border: 1px solid var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }
.dsc-wf-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }
.dsc-wf-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; min-width: 0; }
.dsc-wf-top .dsc-wf-tags { margin-top: 0; flex: none; justify-content: flex-end; }
.dsc-tag-editor { display: flex; flex-direction: column; gap: 6px; }
.dsc-tag-row { display: flex; flex-wrap: wrap; gap: 6px; }
.dsc-tag-input { max-width: 260px; }
.dsc-chip { border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px; padding: 2px 10px; font-size: 12px; cursor: pointer; background: transparent; color: var(--dsw-alias-label-primary); }
.dsc-chip--active { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-layer-1); }
.dsc-badge--info { background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-layer-1); }
.dsc-badge--danger { background: var(--dsw-alias-state-error-primary); color: #fff; }
.dsc-queue-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.dsc-btn { border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; padding: 2px 8px; font-size: 12px; cursor: pointer; background: transparent; color: var(--dsw-alias-label-primary); }
.dsc-btn--sm { padding: 1px 6px; font-size: 11px; }
.dsc-input--sm { padding: 3px 6px; font-size: 12px; }
.dsc-btn:disabled { opacity: 0.5; cursor: default; }
.dsc-job-item { display: flex; align-items: center; gap: 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 7px 10px; background: var(--dsw-alias-bg-layer-1); transition: background 0.12s, border-color 0.12s; }
.dsc-job-item:hover { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-border-l2); }
.dsc-job-item--failed { border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 55%, transparent); }
.dsc-job-item--cancelled { border-color: var(--dsw-alias-border-l2); opacity: 0.85; }
.dsc-badge--status { flex: none; font-weight: 600; }
.dsc-job-preview { width: 56px; height: 56px; flex: none; border-radius: 6px; object-fit: cover; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); }
.dsc-job-preview--clickable { cursor: zoom-in; }
/* --- lightbox: floating local panel, no full-screen dim --- */
.dsc-lightbox { position: fixed; inset: 0; z-index: 9999; background: transparent; display: flex; align-items: center; justify-content: center; }
.dsc-lightbox-body { position: relative; display: flex; flex-direction: column; align-items: center; gap: 10px; width: 90vw; padding: 12px 12px 10px; background: rgba(12, 14, 18, 0.88); border: 1px solid var(--dsw-alias-border-l2); border-radius: 14px; box-shadow: 0 12px 48px rgba(0, 0, 0, 0.45); }
.dsc-lightbox-img { width: 100%; height: 80vh; object-fit: contain; border-radius: 8px; }
.dsc-lightbox-media { max-width: 100%; max-height: 80vh; border-radius: 8px; }
.dsc-lightbox-meta { display: flex; align-items: center; gap: 14px; color: rgba(255, 255, 255, 0.75); font-size: 12px; }
.dsc-lightbox-download { border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 999px; padding: 5px 16px; color: #fff; font-size: 12px; text-decoration: none; display: inline-block; }
.dsc-lightbox-download:hover { background: rgba(255, 255, 255, 0.12); }
.dsc-lightbox-close { position: absolute; top: clamp(4px, 0.6vw, 14px); right: clamp(4px, 0.6vw, 14px); z-index: 3; width: clamp(28px, 2.2vw, 48px); height: clamp(28px, 2.2vw, 48px); border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.35); background: transparent; color: #fff; font-size: clamp(13px, 1.1vw, 22px); line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.dsc-lightbox-close:hover { background: rgba(255, 255, 255, 0.12); }
.dsc-lightbox-nav { position: absolute; top: 0; bottom: 0; z-index: 2; width: clamp(64px, 7vw, 128px); display: flex; align-items: center; background: transparent; border: none; color: #fff; font-size: clamp(38px, 3.4vw, 84px); line-height: 1; cursor: pointer; opacity: 0.6; padding: 0; }
.dsc-lightbox-nav:hover { opacity: 1; color: var(--dsw-alias-brand-primary); background: rgba(255, 255, 255, 0.06); }
.dsc-lightbox-nav--prev { left: 0; justify-content: flex-start; padding-left: clamp(14px, 1.8vw, 36px); }
.dsc-lightbox-nav--next { right: 0; justify-content: flex-end; padding-right: clamp(14px, 1.8vw, 36px); }
.dsc-job-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.dsc-job-name { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-primary); }
.dsc-job-mid { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
.dsc-job-mid-right { display: flex; align-items: center; gap: 6px; flex: none; margin-left: auto; }
.dsc-job-bottom { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--dsw-alias-label-secondary); min-width: 0; }
.dsc-job-duration { flex: none; }
.dsc-job-progress { color: #3b82f6; font-variant-numeric: tabular-nums; }
.dsc-job-menu { position: relative; flex: none; }
.dsc-job-menu-btn { border: none; background: transparent; color: var(--dsw-alias-label-secondary); font-size: 15px; line-height: 1; padding: 3px 7px; border-radius: 6px; cursor: pointer; }
.dsc-job-menu-btn:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
.dsc-job-menu-pop { position: absolute; right: 0; top: calc(100% + 4px); z-index: 950; min-width: 128px; padding: 4px; display: flex; flex-direction: column; gap: 2px; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25); }
.dsc-job-menu-pop button { border: none; background: transparent; color: var(--dsw-alias-label-primary); text-align: left; font-size: 13px; padding: 6px 10px; border-radius: 6px; cursor: pointer; }
.dsc-job-menu-pop button:hover { background: var(--dsw-alias-bg-layer-3); }
.dsc-job-error { color: var(--dsw-alias-state-error-primary); font-size: 11px; margin-left: auto; flex: 1; min-width: 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* --- parameter editor --- */
.dsc-params { display: flex; flex-direction: column; gap: 8px; }
.dsc-param-row { display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 6px 8px; }
.dsc-param-fields { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.dsc-param-default { min-width: 0; }
.dsc-param-meta { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.dsc-param-random { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.dsc-param-bool { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--dsw-alias-label-primary); cursor: pointer; }
.dsc-param-advanced { display: flex; flex-direction: column; gap: 8px; border: 1px dashed var(--dsw-alias-border-l2); border-radius: 8px; padding: 8px; }
/* --- workflow preset transfer dialogs (export / import) --- */
.dsc-transfer { position: relative; display: flex; flex-direction: column; width: min(580px, 92vw); max-height: min(640px, 86vh); background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; box-shadow: 0 16px 56px rgba(0, 0, 0, 0.5); overflow: hidden; }
.dsc-transfer-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.dsc-transfer-title { font-weight: 600; font-size: 13px; color: var(--dsw-alias-label-primary); }
.dsc-transfer-body { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; overflow-y: auto; min-height: 0; }
.dsc-transfer-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.dsc-transfer-list { display: flex; flex-direction: column; gap: 4px; }
.dsc-transfer-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; cursor: pointer; font-size: 12px; color: var(--dsw-alias-label-primary); }
.dsc-transfer-item:hover { border-color: var(--dsw-alias-brand-primary); }
.dsc-transfer-item--static, .dsc-transfer-item--static:hover { cursor: default; border-color: var(--dsw-alias-border-l1); }
.dsc-transfer-item--ok { border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 45%, transparent); }
.dsc-transfer-item--fail { border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 45%, transparent); }
.dsc-transfer-item-name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px; }
.dsc-transfer-item-desc { color: var(--dsw-alias-label-tertiary); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 40px; text-align: right; }
.dsc-transfer-actions { display: flex; gap: 8px; justify-content: flex-end; padding: 10px 12px; border-top: 1px solid var(--dsw-alias-border-l1); }
.dsc-transfer-note { padding: 6px 12px 0; }
.dsc-transfer-note .dsc-hint { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dsc-transfer-drop { display: flex; align-items: center; justify-content: center; min-height: 150px; border: 1px dashed var(--dsw-alias-border-l2); border-radius: 10px; color: var(--dsw-alias-label-secondary); font-size: 13px; cursor: pointer; text-align: center; padding: 12px; transition: border-color 0.12s, color 0.12s; }
.dsc-transfer-drop:hover, .dsc-transfer-drop--over { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.dsc-transfer-empty { padding: 40px 12px; text-align: center; color: var(--dsw-alias-label-tertiary); font-size: 13px; }
.dsc-btn--primary { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-layer-1); }
.dsc-btn--primary:disabled { opacity: 0.5; cursor: default; }
/* --- live generation strip + running card (2026-11-13) -------------------
   Fed by /comfyui/live, which the host computes from ComfyUI's WebSocket
   events. The strip lives under the panel title so the answer to "is it
   working?" is visible from every tab, not only the task tab. --- */
.dsc-live { padding: 0 12px 8px; display: flex; flex-direction: column; gap: 5px; }
.dsc-live-row { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--dsw-alias-label-secondary); min-width: 0; }
.dsc-live-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--dsw-alias-state-success-primary); }
.dsc-live-dot--busy { background: var(--dsw-alias-brand-primary); animation: dsc-live-pulse 1.2s ease-in-out infinite; }
.dsc-live-dot--off { background: var(--dsw-alias-label-tertiary); }
.dsc-live-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.dsc-live-pct { margin-left: auto; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary); font-weight: 600; flex: none; }
.dsc-live-track { height: 3px; border-radius: 2px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
.dsc-live-fill { height: 100%; background: var(--dsw-alias-brand-primary); transition: width 0.45s ease; }
.dsc-live-fill--busy { width: 40%; animation: dsc-live-slide 1.4s ease-in-out infinite; }
@keyframes dsc-live-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes dsc-live-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(260%); } }
/* Tab labels carry a dot while something is running, so the task tab is
   discoverable without opening it. */
.dsc-tab { display: inline-flex; align-items: center; justify-content: center; gap: 5px; }
.dsc-tab-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--dsw-alias-brand-primary); animation: dsc-live-pulse 1.2s ease-in-out infinite; flex: none; }
/* The one big progress card in the task tab. */
.dsc-running { border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent); border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; background: color-mix(in srgb, var(--dsw-alias-brand-primary) 6%, transparent); }
.dsc-running-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; min-width: 0; }
.dsc-running-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.dsc-running-pct { font-variant-numeric: tabular-nums; color: var(--dsw-alias-brand-primary); font-weight: 600; flex: none; }
.dsc-progress-track--lg { height: 8px; border-radius: 4px; }
.dsc-progress-fill--busy { width: 35%; animation: dsc-live-slide 1.4s ease-in-out infinite; }
.dsc-running-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.dsc-running-detail { font-size: 11px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.dsc-warn { color: var(--dsw-alias-state-warn-primary); font-size: 12px; margin: 2px 0 6px; }
.dsc-queue-livehint { margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--dsw-alias-border-l1); }
/* Plugin introduction: a collapsed <details> so the form stays primary. */
.dsc-about { border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); }
.dsc-about summary { list-style: none; cursor: pointer; padding: 8px 10px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.dsc-about summary::-webkit-details-marker { display: none; }
.dsc-about summary::before { content: '▸'; font-size: 11px; color: var(--dsw-alias-label-secondary); transition: transform 0.15s; }
.dsc-about[open] summary::before { transform: rotate(90deg); }
.dsc-about-list { margin: 0; padding: 0 14px 0 26px; display: flex; flex-direction: column; gap: 5px; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }
.dsc-about-list li { list-style: disc; }
.dsc-about .dsc-hint { padding: 6px 12px 10px; }
/* Panel shell refresh: a little wider by default, tighter header, and the
   body keeps its own scroll without bouncing the page behind it. */
.dsc-panel { width: var(--dsc-panel-width, 420px); min-width: 320px; max-width: min(92vw, 720px); }
.dsc-panel-head { padding: 9px 12px 6px; }
.dsc-panel-body { overscroll-behavior: contain; }
`;
		/** Inject the stylesheet once (idempotent), owned by this plugin for HMR. */
		function injectStyles() {
			if (typeof document === "undefined") return;
			if (document.getElementById("dsh-comfyui-styles") !== null) return;
			const style = document.createElement("style");
			style.id = "dsh-comfyui-styles";
			style.setAttribute("data-plugin", "dsh-comfyui");
			style.textContent = CSS;
			document.head.append(style);
		}
		//#endregion
		//#region src/client/inline-media.ts
		/**
		* Inline players for generated video/audio in chat replies.
		*
		* The model shows results by pasting Markdown into its reply (CLAUDE.md
		* contract 18). Images embed natively, but dsh's chat Markdown has no video or
		* audio syntax and renders raw HTML as literal text, so a video/audio result
		* can only be a link there. This module watches the page and, after every
		* link to this plugin's own `/comfyui/media` route whose file is a video or
		* audio file, inserts a native <video>/<audio> player.
		*
		* It only ever ADDS sibling nodes next to dsh-rendered links — it never moves
		* or removes dsh's own nodes — so React's reconciliation of the message keeps
		* working. Streaming re-renders and dsh updates simply trigger a re-scan: a
		* player is added only when the link is not already followed by its player,
		* and players whose link has gone are removed. The plugin's own UI (card file
		* links, panel) is skipped. Everything is undone when the plugin unloads.
		*/
		const VIDEO_EXTENSIONS = /* @__PURE__ */ new Set([
			"mp4",
			"webm",
			"mov",
			"m4v",
			"mkv"
		]);
		const AUDIO_EXTENSIONS = /* @__PURE__ */ new Set([
			"mp3",
			"wav",
			"flac",
			"ogg",
			"oga",
			"opus",
			"m4a",
			"aac"
		]);
		const PLAYER_CLASS = "dsc-inline-player";
		/** The player kind for a /comfyui/media link, or undefined for anything else. */
		function mediaKind(href) {
			let url;
			try {
				url = new URL(href, window.location.href);
			} catch {
				return;
			}
			if (!url.pathname.endsWith("/comfyui/media")) return void 0;
			const file = url.searchParams.get("file") ?? "";
			const dot = file.lastIndexOf(".");
			if (dot < 0) return void 0;
			const ext = file.slice(dot + 1).toLowerCase();
			if (VIDEO_EXTENSIONS.has(ext)) return "video";
			if (AUDIO_EXTENSIONS.has(ext)) return "audio";
		}
		function isPlayerFor(node, href) {
			return node !== null && node.classList.contains(PLAYER_CLASS) && node.getAttribute("data-src") === href;
		}
		function makePlayer(kind, href) {
			const wrap = document.createElement("span");
			wrap.className = `${PLAYER_CLASS} ${PLAYER_CLASS}--${kind}`;
			wrap.setAttribute("data-src", href);
			const player = document.createElement(kind);
			player.src = href;
			player.controls = true;
			player.preload = "metadata";
			wrap.appendChild(player);
			return wrap;
		}
		function scan() {
			for (const player of Array.from(document.querySelectorAll(`.${PLAYER_CLASS}`))) {
				const prev = player.previousElementSibling;
				const src = player.getAttribute("data-src");
				if (!(prev instanceof HTMLAnchorElement) || src === null || prev.href !== src) player.remove();
			}
			for (const link of Array.from(document.querySelectorAll("a[href*=\"/comfyui/media\"]"))) {
				if (link.closest("[class^=\"dsc-\"], [class*=\" dsc-\"]") !== null) continue;
				const kind = mediaKind(link.href);
				if (kind === void 0) continue;
				if (isPlayerFor(link.nextElementSibling, link.href)) continue;
				link.after(makePlayer(kind, link.href));
			}
		}
		/** Start watching the page; returns the disposer that stops and cleans up. */
		function installInlineMedia() {
			let frame;
			const schedule = () => {
				if (frame !== void 0) return;
				frame = window.requestAnimationFrame(() => {
					frame = void 0;
					scan();
				});
			};
			const observer = new MutationObserver((mutations) => {
				if (mutations.some((mutation) => [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)].some((node) => !(node instanceof HTMLElement && node.classList.contains(PLAYER_CLASS))))) schedule();
			});
			observer.observe(document.body, {
				childList: true,
				subtree: true
			});
			schedule();
			return () => {
				observer.disconnect();
				if (frame !== void 0) window.cancelAnimationFrame(frame);
				for (const player of Array.from(document.querySelectorAll(`.${PLAYER_CLASS}`))) player.remove();
			};
		}
		//#endregion
		//#region src/client/index.ts
		/**
		* dsh-comfyui client half: registers the comfyui_run tool card and the
		* ComfyUI settings page. Registered through slots.inject so contributions
		* wait on the real slot declarations and unwind with this plugin's fiber.
		*/
		const name = "dsh-comfyui";
		const inject = ["slots"];
		function apply(ctx) {
			const t = makeT(getLang());
			ctx.effect(() => injectStyles(), "dsh-comfyui: styles");
			ctx.effect(() => installInlineMedia(), "dsh-comfyui: inline video/audio players");
			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: "comfyui_run"
			}, (props) => (0, react.createElement)(ComfyUICard, {
				t,
				...props ?? {}
			})));
			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: "comfyui_workflow"
			}, (props) => (0, react.createElement)(ComfyUICard, {
				t,
				...props ?? {}
			})));
			// dsh-comfy-suite: the suite shell renders one settings page and owns
			// this section there; standalone use keeps registering it.
			if (!window.__DSH_COMFY_SUITE__) {
				ctx.slots.inject("settings.section", () => ctx.slots.register({
					name: "settings.section",
					id: "comfyui",
					order: 30,
					label: () => t("settingsTitle")
				}, (props) => (0, react.createElement)(ComfyUISettings, {
					t,
					...props ?? {}
				})));
			}
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "comfyui.panel",
				order: 20,
				label: () => t("panelTitle")
			}, (props) => (0, react.createElement)(ComfyUIPanel, {
				t,
				...props ?? {}
			})));
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "comfyui",
				order: 100,
				label: () => t("panelTitle")
			}, (props) => (0, react.createElement)(ComfyUITrigger, {
				t,
				...props ?? {}
			})));
		}
		//#endregion
		// dsh-comfy-suite: expose the settings panel (and its translator) so the
		// suite can render it inside its single settings page.
		(window.__DSH_SUITE_UI__ = window.__DSH_SUITE_UI__ || {}).comfyui = {
			Settings: ComfyUISettings,
			makeT,
			getLang,
			// Diagnostic/test surface. The suite's offline client smoke test renders
			// these with fixture props, which catches render-path crashes (a typo, a
			// state name that no longer exists) without needing a browser. Not part
			// of any documented contract; nothing in production reads it.
			__internal: {
				Panel: ComfyUIPanel,
				QueueTab,
				JobRow,
				RunningCard,
				LiveStrip,
				About: SuiteAbout,
				panelStore,
			},
		};
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
/**
 * Client half of dsh-comfyui-launcher: one Settings page that shows the local
 * ComfyUI process, starts/stops it and prints the tail of its log.
 *
 * Plain-JS module (no build step): the loader hands us React from the browser
 * module table, so nothing is bundled here.
 */
__dshSuiteRegister({
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
                color: primary ? '#ffffff' : 'var(--dsw-alias-label-primary)',
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
/**
 * dsh-qwen-paint — 客户端半边
 * ============================================================================
 * 做两件事：
 *   ① 给 `draw_image` 这个工具调用注册一张**自己的卡片**，在聊天框里直接
 *      `<img>` 显示刚生成的图。运行中显示「正在画图…」，失败显示错误原文。
 *   ② 在 **composer 下方的环境条目槽**（`conversation.composer.dock`）放一个
 *      ComfyUI 后端状态指示器：绿点=在线、黄点=出图中、灰点=未启动，
 *      并提示「空闲 N 分后自动关闭」。每 5 秒问一次 host 的只读状态端点。
 *
 * ★ 为什么图非要走自定义 toolview（2026-10-07 查内核源码定案）：
 *   · 非 `read_image` 的工具往结果里返回 image block —— **没用**。客户端
 *     `imageCardModel()` 开头就是 `if (call?.name !== "read_image") return null`，
 *     然后 generic 卡片把 image block 用 `JSON.stringify` 打成文本。
 *   · `presentCall` / `presentResult` —— 客户端**完全不消费**。
 *   · `presentationMeta` —— 只有 `read_image` 那张卡片会读 `meta.path` 当标签。
 *   · `present` 的交付卡片 —— 里面**根本没有 `<img>`**。
 *   所以确定能让图显示在聊天框里的只有两条：**正文 Markdown 图片**（host 侧
 *   已用 systemPrompt 段落保证）和**这条自定义 toolview**。两条都做，互不依赖。
 *
 * ★ 契约（都是 asar 内 dsh-cordis-client-runner/lib/client.js 里查到的）：
 *   · `tool.call.toolview`（:5967）keyed/scope=session，`key` 由工具名派发，
 *     文档原文 "Any name is allowed, including tools registered by your package."
 *     本 key 未占用 → 不遮蔽任何自带 UI。owner props 带 `{phase, block, toolName, ...}`。
 *   · `conversation.composer.dock`（:2704）**list** 槽、scope=session，summary 原文
 *     "Ambient entries below the composer card."，replaceRisk: none；
 *     注册要 `id`（自定义 id 与自带 `stats` pill 并存，不替换它）。
 *
 * ★ 状态端点走**相对路径**（`api/qwen-paint/status.json`，回退 `qwen-paint/status.json`），
 *   由浏览器相对 `document.baseURI` 解析 —— 与图片用的 `api/file?...` 同一套路。
 *
 * ★ React 用法照抄 dsh-reasoning-glow：**React 只渲染"座位"，内容与轮询全在纯 DOM 里**
 *   挂（useRef + useEffect），并且注册前检查 hooks 是否存在；拿不到就安静跳过。
 *
 * 本文件是**非 ESM** 的浏览器脚本（走 window.__ModuleLoader__），与 lib/index.js 相反。
 * ============================================================================
 */

if (typeof window !== 'undefined' && window.__ModuleLoader__ && typeof window.__ModuleLoader__.load === 'function') {
  __dshSuiteRegister({
    id: 'dsh-qwen-paint',
    factory: (require) => {
      var module = { exports: {} }
      var exports = module.exports
      Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

      /* React 从平台模块表拿；拿不到就**不注册**（注册了组件一渲染就 TypeError，
         会污染 dsh 自己的渲染树）。见 MEMO：宁可安静降级。 */
      let React = null
      try {
        const seed = require('react')
        React = seed && seed.default ? seed.default : seed
      } catch (err) {
        React = null
      }

      const PLUGIN_ID = 'dsh-qwen-paint'
      const SLOT_KEY = 'tool.call.toolview'
      const TOOL_KEY = 'draw_image'
      const STYLE_ID = 'dsh-qwen-paint-style'
      /**
       * ★ 状态点的落点：composer **工具行右侧**（内核原文 "Compact controls before the
       * composer submit action" —— 即发送按钮前面）。list 槽、replaceRisk: none。
       *
       * 为什么不用另外两个（全是实测结论，别再改回去）：
       *  · `conversation.composer.dock`（卡片下方）—— 注册成功但界面上**看不见**：
       *    那个槽平时是空的（内核唯一住户是"文件改动统计"，多数时候不渲染），容器零高度。
       *  · `conversation.input.left`（工具行左侧）—— 能看见，但它和右侧自带图标之间
       *    隔着一大片空白（主人反馈"两物隔太远"）。右侧这个槽紧挨发送按钮，正合适。
       */
      const STATUS_SLOT = 'conversation.input.right'
      const STATUS_ID = 'qwen-paint-status'
      /**
       * 状态端点。先试 `/api/` 下的（与内核 `/api/file` 同族，桌面端的 IPC 桥接最可能
       * 覆盖它），不通再回退到根路径。第一次成功后会记住用哪条，不再每条都试。
       */
      const STATUS_PATHS = ['api/qwen-paint/status.json', 'qwen-paint/status.json']
      const POLL_MS = 5000

      /**
       * ★★★ 2026-10-16（DSH STORE AUTH001 整改）：**写状态一律走 POST + JSON body**。
       *
       * 服务端的状态 GET 已改为**只读** —— 带任何写参数会返回 405。客户端必须同步，
       * 否则就是"点了开关没反应"。这正是审核要求消灭的"有副作用的 GET"。
       *
       * ⚠ 顺手修掉一个**真 bug**：原先"改目录"那处写的是 `` `${API}/status.json` ``，
       *   而 **`API` 这个标识符在本文件里从未定义** ⇒ 拼出来是 `undefined/status.json`，
       *   请求必然失败。那个按钮当时还靠 `window.prompt` 收输入（被桌面端拦掉就直接
       *   `return` 了），所以这个坏 URL 一直没暴露出来。现在统一走本函数。
       *
       * 两条候选路径都试（与读状态一致：桌面端 IPC 桥接可能只覆盖 `/api/` 那条）。
       * POST 是幂等的"设值"语义，重试安全。
       */
      async function postStatus(params) {
        const body = JSON.stringify(params ?? {})
        let lastError = null
        for (const path of STATUS_PATHS) {
          try {
            const res = await fetch(path, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', accept: 'application/json' },
              body,
            })
            if (res.ok) return res
            lastError = new Error(`HTTP ${res.status}`)
          } catch (error) {
            lastError = error
          }
        }
        throw lastError ?? new Error('POST 状态端点失败')
      }

      /* ══════════ 出图期间的「聊天流呼吸灯」+ 隐藏思考块（DOM 手术）══════════
       * ★ 主人 2026-10-07 的需求原文：「那个生图时的彩色 RGB 呼吸灯流光是放在
       *   你的输出里的，一个 16:9 的手机壁纸大小，就像你发图片出来一样，
       *   图片一开始生成就把这个放在你输出的地方，生成完毕就立马平滑替换这个动画」。
       * 底线（照 MEMO 的教训）：① 只往聊天容器里 **insertBefore 自己的节点**，
       *   绝不删改内核节点；② 全部包 try/catch；③ 找不到容器就安静跳过。
       */
      const FLOW_ID = 'dshqp-flow'
      const DRAWING_ATTR = 'data-dshqp-drawing'
      const REASONING_ATTR = 'data-dshqp-reasoning'
      const GRAD_STYLE_ID = 'dshqp-flowgrad-css'
      let flowHideTimer = null

      /* ══════════ 生图动画方案（主人 2026-10-08：界面里可自选）══════════
       * 主人原话：「这几种流光文字的流光 css 直接填充成 9:16 手机壁纸（和之前的动画
       *   大小一样）不添加文字，只做流光，使用户生图时可以自选动画」。
       *
       * · 色值**原样照搬**主人「小肥鱼挂件」里那套跑马灯流光
       *   （whale-widget.js 的 FISH_GRAD_LIB），一个色标都没改。
       * · 每条渐变**首尾色标相同**（墨韵/靛蓝是镜像对称），所以背景位置从 0% 跑到
       *   200% 回头时**接缝无跳变** —— 这是原版就有的设计，别当冗余"优化"掉。
       * · 流光方案**只铺渐变、不加任何文字**；"感知世界中"只留在流星方案里。
       * · 这里只存 id / 名字 / 渐变串，**样式表由 flowGradCss() 生成**（单一数据源），
       *   不手写第二份 CSS —— 也就不会再踩 CARD_CSS 的反引号 / 转义那些坑。
       * ⚠ ids 必须和 host 端 lib/index.js 的 FLOW_STYLES 完全一致（自测里有一条比对）。 */
      const FLOW_GRADS = [
        { id: 'macaron', name: '马卡龙', css: 'linear-gradient(135deg,rgb(255,180,200),rgb(255,205,170),rgb(255,225,165),rgb(245,240,180),rgb(190,240,210),rgb(180,230,245),rgb(190,215,250),rgb(220,200,245),rgb(240,200,230),rgb(255,180,200))' },
        { id: 'candy', name: '糖果', css: 'linear-gradient(135deg,rgb(255,145,170),rgb(255,170,130),rgb(255,195,110),rgb(240,220,115),rgb(140,220,175),rgb(115,210,205),rgb(130,195,240),rgb(160,170,235),rgb(210,155,230),rgb(235,135,190),rgb(255,145,170))' },
        { id: 'rouge', name: '酒红', css: 'linear-gradient(135deg,rgb(140,25,45),rgb(175,35,60),rgb(120,20,55),rgb(160,40,75),rgb(190,55,80),rgb(130,30,65),rgb(140,25,45))' },
        { id: 'bamboo', name: '翠青', css: 'linear-gradient(135deg,rgb(70,180,85),rgb(95,200,105),rgb(55,165,70),rgb(110,215,120),rgb(80,190,95),rgb(60,172,78),rgb(70,180,85))' },
        { id: 'aurora', name: '极光幻彩', css: 'linear-gradient(135deg,rgb(70,240,200),rgb(90,200,255),rgb(120,140,255),rgb(180,120,255),rgb(240,140,255),rgb(70,240,200))' },
        { id: 'deepsea', name: '深海蓝调', css: 'linear-gradient(135deg,rgb(20,90,180),rgb(30,140,210),rgb(40,180,220),rgb(20,120,190),rgb(50,160,230),rgb(25,100,200),rgb(20,90,180))' },
        { id: 'sunset', name: '落日熔金', css: 'linear-gradient(135deg,rgb(255,180,80),rgb(255,130,90),rgb(255,90,110),rgb(220,90,150),rgb(160,90,190),rgb(255,180,80))' },
        { id: 'forest', name: '森林秘语', css: 'linear-gradient(135deg,rgb(30,100,60),rgb(60,140,80),rgb(90,180,90),rgb(140,200,80),rgb(180,210,90),rgb(30,100,60))' },
        { id: 'champagne', name: '香槟鎏金', css: 'linear-gradient(135deg,rgb(220,180,100),rgb(240,205,130),rgb(255,225,160),rgb(230,190,110),rgb(245,210,140),rgb(220,180,100))' },
        { id: 'lavender', name: '薰衣草梦境', css: 'linear-gradient(135deg,rgb(180,150,255),rgb(200,170,255),rgb(230,180,240),rgb(255,190,220),rgb(240,160,200),rgb(180,150,255))' },
        { id: 'mint', name: '薄荷汽水', css: 'linear-gradient(135deg,rgb(120,230,180),rgb(150,240,200),rgb(170,240,230),rgb(140,220,240),rgb(120,200,220),rgb(120,230,180))' },
        { id: 'lava', name: '岩浆熔岩', css: 'linear-gradient(135deg,rgb(255,60,40),rgb(255,110,30),rgb(255,170,40),rgb(255,210,70),rgb(255,140,50),rgb(255,60,40))' },
        { id: 'galaxy', name: '银河星紫', css: 'linear-gradient(135deg,rgb(40,30,90),rgb(70,50,130),rgb(110,70,170),rgb(160,90,190),rgb(220,120,180),rgb(40,30,90))' },
        { id: 'ink', name: '墨韵黑白', css: 'linear-gradient(135deg,rgb(20,20,20),rgb(80,80,80),rgb(140,140,140),rgb(200,200,200),rgb(250,250,250),rgb(250,250,250),rgb(200,200,200),rgb(140,140,140),rgb(80,80,80),rgb(20,20,20))' },
        { id: 'indigo', name: '靛蓝夜曲', css: 'linear-gradient(135deg,rgb(32,49,112),rgb(52,76,146),rgb(74,102,180),rgb(100,126,210),rgb(130,132,224),rgb(130,132,224),rgb(100,126,210),rgb(74,102,180),rgb(52,76,146),rgb(32,49,112))' },
      ]

      const FLOW_IDS = FLOW_GRADS.map((grad) => grad.id)

      /** 当前选中的动画 id（由状态轮询写入；null = 还没拿到 → 按默认的流星走）。 */
      let flowStyleNow = null

      /** 本轮该用哪个动画：只认白名单 —— host 已经校验过一次，这里再兜一次，
       *  因为这个值会被拼进 class 名（宁可退回流星，也不许拼出奇怪的类）。 */
      function currentFlowStyle() {
        if (flowStyleNow === 'meteor') return 'meteor'
        return FLOW_IDS.includes(flowStyleNow) ? flowStyleNow : 'meteor'
      }

      /** 流光动画的样式表（含菜单里的小色块）—— 由 FLOW_GRADS 生成，单一数据源。 */
      function flowGradCss() {
        const lines = [
          // ★★★ 流光本体 = 一个**放大 5 倍**的渐变层，沿对角线来回平移。
          //
          // 为什么不用 background-repeat 平铺（第一版就是那么写的，被主人截图打回）：
          //   **135deg 的斜纹平铺时在拼接处必然错位** —— 斜线和矩形网格对不齐，
          //   截图里那道紫/蓝竖条就是接缝。平铺只有在"渐变轴与平铺方向一致"时才无缝
          //   （原来的 90deg 可以，斜的绝对不行，这是几何问题，调参救不回来）。
          // ✓ 现在：渐变只铺一层（no-repeat）铺满一个放大层，靠 transform 平移它、
          //   露出渐变的不同段落 —— 层比容器大 5 倍，平移 38% 也露不出边，
          //   所以**结构上不可能再出现任何接缝或色块断面**。
          '.dshqp-flow-grad {',
          '  position: absolute; inset: 0; z-index: 1; pointer-events: none; overflow: hidden;',
          '}',
          '.dshqp-flow-grad::before {',
          '  content: ""; position: absolute; inset: -200%;',
          '  background-size: 100% 100%; background-repeat: no-repeat;',
          // 主人 2026-10-08：「流光从左上扫到右下，衔接处…可以做一个循环，倒放回去」——
          //   ease-in-out + alternate：在两个端点自然减速、折返，全程没有"跳回起点"那一下。
          //   平移 38% × 层尺寸 ≈ 沿渐变轴走 40% 的长度（≈ 3~4 个色标的色差），
          //   所以颜色是"缓慢流过"，不是一闪而过。7s 是单程时长。
          '  animation: dshqp-flowgrad-run 7s ease-in-out infinite alternate;',
          '}',
          '@keyframes dshqp-flowgrad-run {',
          '  from { transform: translate3d(-38%, -38%, 0); }',
          '  to   { transform: translate3d(38%, 38%, 0); }',
          '}',
          /* ★ 2026-10-09 优化（主人要求「将用户选择颜色这个功能也优化一下」）：
             原来色块只有 10x10、圆角 3px —— 这些是**多色标渐变**
             （多数有 7~11 个色标），缩到 10px 后相邻色标糊成一片，
             根本看不出"这档到底是什么颜色"，等于选色靠猜。
             现在放大到 16x14（略扁更贴近 9:16 动画的观感）、圆角 4px、
             边框加深一档，并在右侧留出固定宽度让色块对齐。
             ⚠ 尺寸用 px 而非百分比：菜单是固定宽度的弹层，px 在这里反而更可控。 */
          '.dshqp-menu-swatch {',
          '  width: 16px; height: 14px; border-radius: 4px; flex: none;',
          '  border: 1px solid rgba(128,128,128,.45);',
          '  box-shadow: inset 0 0 0 1px rgba(255,255,255,.06);',
          '}',
        ]
        for (const grad of FLOW_GRADS) {
          // 渐变落在 ::before 上（真正的动画层）；菜单小色块静态铺满即可。
          lines.push(`.dshqp-flow-grad-${grad.id}::before { background-image: ${grad.css}; }`)
          lines.push(`.dshqp-menu-swatch-${grad.id} { background-image: ${grad.css}; }`)
        }
        return lines.join('\n')
      }

      /** composer 卡片及其父级（兜底用）。 */
      function flowHost() {
        const card = document.querySelector('[data-composer-card]')
        return card !== null && card.parentElement !== null ? { card, host: card.parentElement } : null
      }

      /**
       * ★★ 2026-10-08：**消息列表容器**。
       * 主人 F12 诊断给出的真实结构（关键在于这个）：
       *   Dc7zOa_root
       *     ├─ …→ Dc7zOa_viewArea → xz4KEq_frame → xz4KEq_scroll → xz4KEq_column(13933px)
       *     │                                                      └─ xz4KEq_flowItem ← 每条消息
       *     └─ Dc7zOa_body → Dc7zOa_scrollBody → Dc7zOa_composerSeat ← composer
       * 即：**消息列表和 composer 是两棵独立子树**，共同祖先下只有 composer 座位 ——
       * 所以之前插进 composer 那一侧，周围注定是一片空白（主人截图正是如此）。
       * 定位方式：消息条目的类名是 `<hash>_flowItem` —— 哈希前缀会变，**本地名 flowItem 不会**
       * （MEMO 里记的锚点法）。取它的父级就是消息列表。
       */
      function messageHost() {
        try {
          const item = document.querySelector('[class*="flowItem"]')
          if (item !== null && item.parentElement !== null) return item.parentElement
        } catch (error) { /* 选择器不被支持就算了，走兜底 */ }
        return null
      }

      /** 往上找最近的"真滚动容器"（保存/恢复滚动位置要用它，消息列表本身不一定滚）。 */
      function scrollAncestor(el) {
        let node = el
        for (let depth = 0; depth < 6 && node !== null; depth += 1) {
          try {
            if (node.scrollHeight > node.clientHeight + 20) return node
          } catch (error) { /* 拿不到尺寸就继续往上 */ }
          node = node.parentElement
        }
        return el
      }

      /**
       * ★★★ 2026-10-08 六次修正 —— **重新启用"往消息列表末尾插动画"**，
       * 并且这次把上次失败的原因彻底查清了。
       *
       * 上一版把它整个删掉，理由是"主人界面整片空白、消息全没了"。
       * **但那个归因是错的**：主人重启后说"能翻看消息了"，167 条消息一条没少，
       * 证明**消息从未被删**。真正的元凶是同一段代码里的
       *     scroller.scrollTop = top
       * —— top 取到了 0，把视图设到了列表顶部那片空白上，看起来就像消息全没了。
       *
       * 所以结论**反转**：往消息列表里 append 自己的节点是**安全**的，只要做到三件事：
       *   ① **绝不碰 scrollTop / scrollIntoView**（上次唯一的错就在这一行）；
       *   ② 只 **append 到列表末尾**，绝不 insertBefore 到内核节点之间；
       *   ③ 挂 observer 守护自己的节点，被重渲染删掉就补回来。
       *
       * 位置上它是消息列表的最后一个子节点 =「我那条回复的下方」，
       * 因此**随消息流一起滚动** —— 往上翻历史时它像聊天记录一样跟着下去。
       */
      /** 出图标记的兜底定时器：到点无条件撤销标记（正常情况下永远用不到）。 */
      let drawingSafetyTimer = null

      function flowStart() {
        try {
          if (document.body) document.body.setAttribute(DRAWING_ATTR, '1')

          // ★★★ 三十次修正 —— **出图一开始就立刻隐藏一次，不等轮询那一拍**。
          //   主人明确要求「生图过程中不要思考过程」—— 连那 1.5 秒的轮询间隔也算"过程中"，
          //   所以这里立即执行一次，把此刻已存在的思考块 / 工具调用条目**当场藏掉**。
          //   （隐藏方式见 markReasoningBlocks：直接设内联 `display:none`，不走 CSS 规则。）
          // ★★★ 三十五次修正（配套）—— **先把"出图前就存在的条目"全部标记为旧**，
          //   之后 markReasoningBlocks 只处理"出图开始后新出现的"。
          //   为什么必须这样：在**上面**隐藏历史思考块会让**页面总高度骤减**，
          //   新对话里可滚动高度本就不多，一藏就**滚不动、翻不了聊天记录**
          //   （主人 2026-10-08 在新对话里复现的正是这个）。
          try {
            for (const it of document.querySelectorAll('[class*="flowItem"]')) it.__dshqpOld = true
          } catch (error) { /* 标记失败最多是多藏几条，不影响出图 */ }

          try { markReasoningBlocks() } catch (error) { /* 藏不了不影响出图 */ }

          // ★★★ 2026-10-08 二十三次修正（配套）—— **出图标记加超时兜底**。
          //   主人要求：「生图时才隐藏思考和调用工具过程，正常工程和对话不隐藏」。
          //   而这个标记只是 body 上的一个属性 —— 只要 flowFinish 没被调用就会一直留着，
          //   而 flowFinish 依赖"卡片确实渲染出了结果"，会话切走、工具被中断、
          //   进程卡住等情况都可能让它跑不到，标记于是永久生效 → 平时也隐藏思考。
          //   ✓ 兜底：**到点无条件撤销**（12 分钟，比后端的 10 分钟超时更宽裕）。
          //     正常情况下 flowFinish 早就撤掉了，这个定时器只是"永远用不到的保险"。
          if (drawingSafetyTimer !== null) clearTimeout(drawingSafetyTimer)
          drawingSafetyTimer = setTimeout(() => {
            drawingSafetyTimer = null
            try {
              if (document.body) document.body.removeAttribute(DRAWING_ATTR)
              stopReasoningWatch()
              const stale = document.getElementById(FLOW_ID)
              if (stale !== null) stale.remove()
            } catch (error) { /* 忽略 */ }
          }, 12 * 60 * 1000)

          const host = messageHost()
          if (host === null) return

          // ★★★ 三十九次修正
          //   （主人：「那个动画会播放两次，第一次稍微大一些播完马上又跳到小的去」）——
          //   **已经有健康节点就直接复用，绝不删了重建。**
          //
          //   旧写法是"先全局清干净、再插一个新的"，本意是防重复；但它带出一个新问题：
          //   `flowStart` 会被调用不止一次（卡片重渲染会重跑），于是节点被**删掉又新建**，
          //   **呼吸动画随之从头开始** —— 看起来就是"播了两次"。
          //   ✓ 现在：只要页面上已经存在一个 `#FLOW_ID` 节点，就**原样留着**，
          //     只确保它挂在正确的 host 里。重复调用变成"什么都不做"，动画不会被重置。
          let reused = null
          try { reused = document.getElementById(FLOW_ID) } catch (error) { reused = null }
          if (reused !== null) {
            if (reused.parentElement !== host) {
              try { host.appendChild(reused) } catch (error) { /* 挂不过去就当没有，下面会重建 */ }
            }
            if (reused.parentElement === host) {
              watchFlowNode(host)
              watchReasoning()
              return
            }
          }

          // 真没有节点时，才清理残留（正常情况这里已经没有东西可删）并新建
          try {
            for (const stale of document.querySelectorAll(`#${FLOW_ID}`)) {
              try { stale.remove() } catch (error) { /* 已经被移走 */ }
            }
          } catch (error) { /* 清理失败不影响后面的插入 */ }

          // ★★★ 2026-10-08 十一次修正 —— **一次都不碰滚动条**（这是最终结论）。
          //   四版滚动处理全错：① `scrollTop = 旧值` → 视图钉死 → 假空白；
          //   ② 什么都不做 → 视图停原处 → 也像空白；③ `if (atBottom) 跟到底部`
          //   → 出图后正常但**生成中滚不动**；④ 把 ③ 补到移除时 → 同样卡住。
          //   主人一句话定案：「往上滚有消息，但是生图时往上滚不了」——
          //   **DSH 在生成中本来就会跟随底部**，我的主动滚动与它叠加，
          //   破坏了"用户上滚则暂停跟随"的正常机制。
          //   ✓ 最终做法：**只 append 一个节点，滚动完全交给 DSH**（插件第一原则：最小侵入）。
          host.appendChild(makeFlowNode())
          watchFlowNode(host)
          // ★ 思考块观察器**只在这段时间挂着**（出图结束由 flowFinish 摘掉）
          watchReasoning()
        } catch (error) {
          warn(`出图动画插入失败（不影响出图）：${error && error.message ? error.message : error}`)
        }
      }

      /**
       * 造出图动画节点：9:16 金属块 + 流星 canvas + 文字。
       * 样式全在 CARD_CSS 里；流星粒子在这里启动，**只在出图期间跑**。
       */
      /**
       * ★★ 判断 DSH 当前是深色还是浅色主题
       *   （主人 2026-10-08：「我现在是深色背景啊，你识别错了」）。
       *
       *   **DSH 有自己的主题开关，不跟随系统** —— 所以 `prefers-color-scheme` 会判断错。
       *   最可靠的判据是**读实际背景色的亮度**：暗 → 深色主题，亮 → 浅色主题。
       *   读不到就退回问系统；再读不到就当深色（默认那块是银白金属，在深色界面上更醒目）。
       */
      function detectDarkTheme() {
        try {
          const el = document.body || document.documentElement
          const bg = getComputedStyle(el).backgroundColor || ''
          const m = bg.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/)
          if (m !== null) {
            const lum = 0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3])
            return lum < 140
          }
        } catch (error) { /* 读不到就走兜底 */ }
        try {
          if (typeof matchMedia === 'function') return !matchMedia('(prefers-color-scheme: light)').matches
        } catch (error) { /* 忽略 */ }
        return true
      }

      function makeFlowNode() {
        const box = document.createElement('div')
        box.id = FLOW_ID
        box.className = 'dshqp-flow'
        const style = currentFlowStyle()
        // ★ 把"当前主题"写进属性，CSS 据此在「银白金属 / 黑金属」之间切换
        try { box.setAttribute('data-dshqp-theme', detectDarkTheme() ? 'dark' : 'light') } catch (error) { /* 忽略 */ }

        if (style === 'meteor') {
          // ★ 流星画布（马卡龙流星从中心爆开、带拖尾、撞边反弹）
          try {
            const cv = document.createElement('canvas')
            cv.className = 'dshqp-flow-canvas'
            box.appendChild(cv)
            startMacaronBurst(cv)
          } catch (error) { /* 画布起不来就只显示金属底 + 高光，不影响出图 */ }

          const tip = document.createElement('div')
          tip.className = 'dshqp-flow-tip'
          tip.textContent = '感知世界中'
          box.appendChild(tip)
          return box
        }

        // ★★ 流光方案：**只做流光、一个字都不加**（主人 2026-10-08 明确要求）。
        //   尺寸和流星方案**完全一致**（9:16、320 高，由 .dshqp-flow 统一给），
        //   呼吸缩放照旧 —— 那是父元素上的 transform，与这里的背景流动互不干扰。
        //   data-dshqp-grad 这个属性是给 CSS 的开关：流光块**不要**再叠那道白色高光扫过，
        //   否则就成了两层光效，不是主人要的"只做流光"。
        try { box.setAttribute('data-dshqp-grad', style) } catch (error) { /* 忽略 */ }
        try {
          const layer = document.createElement('div')
          layer.className = `dshqp-flow-grad dshqp-flow-grad-${style}`
          box.appendChild(layer)
        } catch (error) { /* 流光层起不来就只剩底色，不影响出图 */ }
        return box
      }

      /**
       * ★★★ 马卡龙流星爆发（主人 2026-10-08 指定）：
       *   生图开始时，一堆马卡龙配色的流星**带浅色拖尾**从中心爆开、飞向四面八方，
       *   **撞到边缘反弹回来**。
       *
       *   性能自律（这里踩过卡死的坑，必须守）：
       *     · **只在出图期间跑** —— 节点一从文档移除，下一帧就自己停（见 isConnected 判断）
       *     · 粒子 24 个、速度逐帧衰减，**约 4 秒后自然结束**（不是全程跑粒子）
       *     · 画布固定 270×480（9:16）由 CSS 拉伸 —— 不按 devicePixelRatio 放大，省一半开销
       */
      function startMacaronBurst(canvas) {
        const MACARON = ['#FFB3BA', '#FFDFBA', '#FFF5BA', '#BAFFC9', '#BAE1FF', '#E0BBE4', '#FFC8DD', '#C7CEEA']
        const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null
        if (raf === null) return undefined

        const W = 270
        const H = 480
        let ctx = null
        try {
          canvas.width = W
          canvas.height = H
          ctx = canvas.getContext('2d')
        } catch (error) { return undefined }
        if (ctx === null) return undefined

        const N = 24
        const parts = []
        for (let i = 0; i < N; i += 1) {
          const a = (Math.PI * 2 * i) / N + (Math.random() - 0.5) * 0.35
          const sp = 2.6 + Math.random() * 2.2
          parts.push({
            x: W / 2,
            y: H / 2,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            c: MACARON[i % MACARON.length],
            trail: [],
          })
        }

        // ★ 主人 2026-10-08：「流星保持弹性碰撞，撞到边缘原速度返回」+
        //   「不要淡出啊，要一直存在，直到图片生成完毕」
        //   → **无衰减、无淡出、无寿命上限**：一直匀速弹下去，
        //     直到 canvas 被移出文档（出图结束那一刻）才停。
        const step = () => {
          // ★ 节点已被移出文档（出图结束）→ 自己收工，不留常驻 rAF
          if (typeof canvas.isConnected === 'boolean' && !canvas.isConnected) return
          try { ctx.clearRect(0, 0, W, H) } catch (error) { return }

          for (const p of parts) {
            p.x += p.vx
            p.y += p.vy
            // ★ 无衰减 —— 弹性碰撞，撞到边缘原速度返回
            if (p.x < 0) { p.x = 0; p.vx = -p.vx }
            if (p.x > W) { p.x = W; p.vx = -p.vx }
            if (p.y < 0) { p.y = 0; p.vy = -p.vy }
            if (p.y > H) { p.y = H; p.vy = -p.vy }

            // 拖尾：★ 主人要求"再长一些" —— 从 6 个残影增到 12 个（长度大约翻倍）
            p.trail.push({ x: p.x, y: p.y })
            if (p.trail.length > 12) p.trail.shift()

            // 浅色拖尾（越靠后越淡越细；★ 不乘 life —— 流星全程存在）
            for (let t = 0; t < p.trail.length; t += 1) {
              const q = p.trail[t]
              const k = (t + 1) / p.trail.length
              ctx.globalAlpha = k * 0.34
              ctx.fillStyle = p.c
              ctx.beginPath()
              ctx.arc(q.x, q.y, 1 + k * 2.6, 0, Math.PI * 2)
              ctx.fill()
            }
            // 流星本体（马卡龙色 + 白色小核）
            ctx.globalAlpha = 0.95
            ctx.fillStyle = p.c
            ctx.beginPath()
            ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2)
            ctx.fill()
            ctx.globalAlpha = 0.85
            ctx.fillStyle = '#ffffff'
            ctx.beginPath()
            ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.globalAlpha = 1
          raf(step)
        }
        raf(step)
        return undefined
      }

      /**
       * 守护动画节点：DSH 用 React 渲染这棵树，重渲染时有可能把我们的节点清掉，
       * 删了就补回列表末尾 —— 这正是"只 append、不改别人"能安全共存的原因。
       *
       * ★★★ 2026-10-08 二十二次修正 —— **这里也从观察器改成低频轮询**。
       *   原因和思考块那处完全一样：`MutationObserver` 会被**任何 DOM 变化唤醒**，
       *   而 (UI)MOSS 里有 21 个常驻观察器、它们自己也在改 DOM ——
       *   "它改 → 唤醒我 → 我也改 → 再唤醒它"就是主人遇到的卡死。**这是最后一个环，现在断掉。**
       *   ✓ `setInterval` 不会因 DOM 变化被唤醒，**不可能参与任何反馈环**。
       */
      let flowGuard = null
      function watchFlowNode(host) {
        try {
          if (flowGuard !== null) { clearInterval(flowGuard); flowGuard = null }
          flowGuard = setInterval(() => {
            try {
              // 出图结束或列表已卸载 → 自己收工，不留常驻定时器
              if (!document.body || !document.body.hasAttribute(DRAWING_ATTR)) {
                if (flowGuard !== null) { clearInterval(flowGuard); flowGuard = null }
                return
              }
              if (host.parentElement === null) {
                if (flowGuard !== null) { clearInterval(flowGuard); flowGuard = null }
                return
              }
              // 节点还好端端待在列表里 → **什么都不做**（绝不能删了重建，那会让动画从头播）
              const existing = document.getElementById(FLOW_ID)
              if (existing !== null && existing.parentElement === host) return
              // 确实丢了才补：先清掉可能残留的同类节点，保证页面上**永远只有一个**
              for (const stale of document.querySelectorAll(`#${FLOW_ID}`)) {
                try { stale.remove() } catch (error) { /* 已经被移走 */ }
              }
              host.appendChild(makeFlowNode())
            } catch (error) { /* 单拍失败不影响下一拍 */ }
          }, 1000)
        } catch (error) { /* 定时器装不上只意味着"节点被删后不会自动补"，不影响出图 */ }
      }

      /** 出图完成（或失败）：撤掉标记，让动画平滑淡出后移除，把位置让给正文里的图片。 */
      function flowFinish() {
        try {
          if (document.body) document.body.removeAttribute(DRAWING_ATTR)

          // ★★★ 三十一次修正（主人：「现在生好图都有了，给我回调回去」）——
          //   **恢复"出图结束就停轮询"**。上一轮我把它改成常驻，导致出图后它还在藏、
          //   思考块一直不回来。这里**第一件事就是停掉它**，然后再还原隐藏。
          stopReasoningWatch()

          // ★★★ 三十次修正（关键）—— **把被内联隐藏的条目全部还原**。
          //   从这一版起，隐藏不再依赖 CSS 规则，而是**直接设 `element.style.display = 'none'`**
          //   （内联样式优先级最高、立刻生效，不受 CSS/选择器影响）。
          //   因此这里必须**逐一把 display 恢复回原值**，否则它们会永远消失。
          //   原值在隐藏时记在 `__dshqpPrevDisplay` 上（通常是空串，即交还给 CSS），这里精确还原。
          try {
            for (const el of document.querySelectorAll(`[${REASONING_ATTR}]`)) {
              try {
                el.style.display = el.__dshqpPrevDisplay || ''
                delete el.__dshqpPrevDisplay
              } catch (error) { /* 单个还原失败不影响其它 */ }
              el.removeAttribute(REASONING_ATTR)
            }
          } catch (error) { /* 还原失败最坏是它们一直藏着；下次出图不会更糟 */ }
          // ★ 标记已撤销，兜底定时器就没必要了（不清掉它 12 分钟后会白跑一次）
          if (drawingSafetyTimer !== null) { clearTimeout(drawingSafetyTimer); drawingSafetyTimer = null }
          if (flowHideTimer !== null) clearTimeout(flowHideTimer)
          // ★ 上一版把变量从 flowObserver（观察器）改成了 flowGuard（轮询定时器），
          //   这里必须同步改 —— 否则出图结束时会因引用未定义变量而抛错。
          if (flowGuard !== null) { clearInterval(flowGuard); flowGuard = null }
          const box = document.getElementById(FLOW_ID)
          if (box === null) return
          // ★ 同样**不碰滚动**（理由见 flowStart 的十一次修正说明）：
          //   移除后由 DSH 自己跟随底部，我插手只会破坏它的正常机制。
          box.setAttribute('data-done', '1')          // CSS 里做淡出
          flowHideTimer = setTimeout(() => {
            flowHideTimer = null
            try { box.remove() } catch (error) { /* 已被移除 */ }
          }, 460)
        } catch (error) {
          /* 清理失败无所谓，下次出图会重建 */
        }
      }

      /**
       * 给"正在思考"的块打标记，供 CSS 在出图期间隐藏它。
       * ★ 用**文案**而不是哈希类名定位：类名随构建变，界面上那句「深度求索中」不会。
       *   只认"元素自己的直接文本"（长度 < 60），避免把整棵祖先树都标上。
       */
      // ★★ 2026-10-07 修正：内核实际用的文案是「已完成分析 / 正在分析」——
      //    我最初猜的「深度求索」匹配不上，所以思考块一直没被隐藏（主人截图里给了答案）。
      //    同时保留 Thinking/Reasoning 以兼容英文界面。
      // ★★ 2026-10-08 再修正（主人截图给了准确文案）：
      //    实际是「**正在分析请求**」，而且那行后面还跟着大段思考内容。
      //    所以匹配改成**行首匹配**（思考块的文案必然在开头），并补齐所有见过的写法。
      // ★★ 2026-10-08 再扩（主人要求：「所有有关你思考的内容及其图标全部隐藏」）：
      //    把「正在调用工具」那一行也纳入匹配 —— 它是工具调用的摘要行，
      //    左边那个 ⚡ 图标是同一块内的元素，隐藏整块时会跟着一起走。
      const REASONING_TEXT_RE = /^\s*(正在分析请求|正在分析|已完成分析|分析中|正在调用工具|调用工具|深度求索|正在思考|思考中|Thinking|Reasoning|Calling)/u
      function markReasoningBlocks() {
        try {
          // ★★★ 2026-10-08 十八次修正 —— **性能修复：不在出图期间就直接退出**。
          //   事故：主人开着录屏在另一个会话生图，**整个界面卡死、什么都点不了**，
          //   而性能面板显示占用并不高。
          //   根因就在这里：这套扫描原来**从 DSH 启动起就一直在跑**，而且 observer
          //   用了 `subtree: true` —— 流式输出时 DOM 每秒变化几十上百次，每次都触发
          //   一遍"全页 querySelectorAll + 逐元素遍历 childNodes"，把**渲染主线程**占满。
          //   主线程是单线程，所以界面冻住但 CPU 总量不高 —— 性能条自然看不出来
          //   （叠加录屏抓屏后，卡得更彻底）。
          //   ✓ 修法：**只有出图期间才扫描**（body 上的 DRAWING_ATTR 就是出图标记）。
          //     平时这个函数被调用也会在第一行立刻返回，开销可以忽略。
          if (!document.body || !document.body.hasAttribute(DRAWING_ATTR)) return

          const spot = flowHost()
          // ★★ 2026-10-08：扫描范围直接用 document.body —— 主人 F12 诊断显示
          //    "被标记的思考块数量 = 0"，证明之前那个"往上爬 4 层"的范围**根本扫不到消息列表里的思考块**。
          //    性能可接受：只在 DOM 变化后节流 400ms 跑一次，且只读属性。
          const root = document.body
          if (!root || typeof root.querySelectorAll !== 'function') return
          // ★★ 性能护栏（十八次修正的配套）：**全页元素上限**。
          //   消息多的会话（主人这个已有 195 条）全页上万元素，即便 400ms 一次
          //   也不该无上限遍历。超过上限就**只扫消息列表那一块**，够用且便宜。
          let all
          try {
            all = root.querySelectorAll('div,span,button,p')
          } catch (error) { all = [] }
          if (all.length > 4000) {
            const list = messageHost()
            if (list !== null) {
              try { all = list.querySelectorAll('div,span,button,p') } catch (error) { all = [] }
            }
          }
          // ★★★ 2026-10-08 二十六次修正 —— **换方向：不往上爬，直接在"条目层"判断**。
          //
          //   主人要求：「思考过程可以有，但是思考结束时的生图动画只能有一句话和一个动画」。
          //   之前几版都在做同一件事：**从"文案所在的内层元素往上爬"去找整块** ——
          //   反复失败（主人实测：被标记的 14 个**全是** `SPAN.WW4l1q_label`，只藏住一行字、
          //   图标照旧）。根因是"文字"和"图标"虽然属于同一条消息，却**在两棵很远的子树里**，
          //   爬多少层、在哪里 break，**都是在赌 DOM 嵌套**。
          //
          //   ✓ 正解：**不爬了**。直接遍历"条目"这一层（`flowItem`，实测确认存在），
          //     用**条目自身的文本**判断 —— 图标、标题、内容都在条目里，
          //     命中就整条隐藏，图标自然一起消失。**只依赖一个层级，不依赖任何嵌套细节。**
          //
          //   ★★ 二十七次修正（主人反馈「越来越严重了」—— 新版什么都没藏住）：
          //     原因是我上一版加的两条限制**自相矛盾地严**：
          //       · `txt.length >= 800 → skip`：**思考块内容往往远超 800 字**，整条被跳过；
          //       · `REASONING_TEXT_RE` 是**行首匹配**（`^\s*(…)`）：而条目的 textContent
          //         开头可能是图标字符或别的文字，**根本匹配不上**。
          //     两条叠加 → "思考块""工具调用"全都不符合条件 → **一个都没藏**。
          //
          //   ✓ 现在改成：
          //     · **只看前 200 字**（不限制总长度）—— 标题/摘要必然在这一段里；
          //     · **用"包含"匹配**（不要求出现在开头）；
          //     · 高度上限放宽到 2000 —— 文本匹配本身已经够精确
          //       （实测长正文开头是「你说得对，我该定位…」，不会误中）。
          //   ★★ 匹配自测（本地用真实文案跑过）抓到一条漏洞：
          //     思考块的条目文本开头是「**思考**⚠️ 主人说：…」——
          //     而原来的正则里只有 `正在思考` / `思考中`，**没有单独的「思考」**，
          //     所以这一条**永远匹配不上**。已补上。
          //     其余用例（"已完成分析"✓ / "正在调用工具…"✓ / "好——一只猫。"✗ /
          //     "你说得对，我该定位…"✗ / "画好了。"✗）全部符合预期。
          const ITEM_TEXT_RE = /(思考|正在分析请求|正在分析|已完成分析|分析中|正在调用工具|调用工具|深度求索|Thinking|Reasoning|Calling)/u
          const items = (() => {
            try { return document.querySelectorAll('[class*="flowItem"]') } catch (error) { return [] }
          })()
          // ★★★ 三十二次修正 —— **三个以前没试过的做法**
          //   （主人：「这两个东西真的没办法隐藏吗，能不能最后想一个以前没试过的办法」）。
          //
          //   以前反复失败的根源很清楚：**我一直在"手写循环往上爬"找条目** ——
          //   爬几层、在哪里 break 全靠猜，于是反复够不到
          //   （实测标记总是落在内层的 `SPAN.WW4l1q_label` 上，带图标的那行死活进不了范围）。
          //
          //   这次换三样**以前没用过**的：
          //     ① **`TreeWalker`（原生）** —— 只遍历**文本节点**，找到**直接含关键词的那一行**。
          //        比 `querySelectorAll('div,span,…')` 精确得多，也不会误伤正文
          //        （正文的文本节点长，一眼排除）。
          //     ② **`el.closest('[class*="flowItem"]')`（原生）** —— 浏览器自己往上找祖先。
          //        它**不存在"爬不到"**：要么返回元素、要么返回 null。
          //        **若返回 null，就证明那一行真的不在 flowItem 里** —— 那是确定结论，
          //        不是又一次"猜错了"。
          //     ③ **内联 `display:none`** —— 一环生效，不走 CSS 规则。
          //
          //   并把结果**打到 Console**：一次就能看出成没成，不用再截图猜。
          const KW = ['已完成分析', '正在分析请求', '正在分析', '正在调用工具', '调用工具', '深度求索', '思考']
          let hitText = 0
          let hitItem = 0
          let missItem = 0
          try {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null)
            const parents = new Set()
            let tn = walker.nextNode()
            while (tn !== null) {
              const raw = (tn.nodeValue || '').trim()
              if (raw !== '' && raw.length <= 120 && KW.some((k) => raw.indexOf(k) !== -1)) {
                if (tn.parentElement !== null) parents.add(tn.parentElement)
              }
              tn = walker.nextNode()
            }
            hitText = parents.size
            //   ★★★ 三十三次修正 —— 按主人贴出的 Console 日志改，两点都定案了：
            //     日志原文：`有 23 处关键词所在元素 closest('flowItem') 返回 null`
            //       → **`closest()` 是原生 API，返回 null 就代表"往上直到 body 都没有 flowItem"**，
            //         这是**确定结论**：那两行（「已完成分析」「正在调用工具」）**根本不在条目里**。
            //         所以我之前所有"找条目"的努力注定失败 —— 方向从一开始就错了。
            //     日志还显示：**被藏掉的 30 多条全是"思考…"开头的历史条目** ——
            //         那不是主人要的（他要的是**当前这次**出图里的），说明离屏的历史节点也被动了。
            //   ✓ 两条修法：
            //     A. **只处理真正可见的元素** —— 离屏/已卸载子树的 `offsetParent` 是 null，
            //        一眼排除，**不会再动历史消息**；
            //     B. **`closest` 失败时退回"最近的合理祖先"** —— 往上找第一个
            //        "高度 0~300px 且有宽度"的容器并藏掉。不管那两行在什么结构里，都能命中。
            for (const el of parents) {
              // A. 可见性过滤：离屏节点一律不碰
              let visible = true
              try { visible = el.offsetParent !== null } catch (error) { visible = true }
              if (!visible) continue

              // ★★★ 三十五次修正
              //   （主人：「我在新对话里让画图时复现了无法翻看聊天记录的bug」）——
              //   **只处理"本次出图"产生的条目；出图之前就存在的一律不碰。**
              //
              //   根因：在**上面**把历史思考块 display:none 掉，会让**页面总高度骤减**；
              //   新对话历史本来就短，一藏就把可滚动高度吃光 → **滚不动、翻不了记录**。
              //
              //   ⚠ 注意这**不是**昨天那个 scrollTop 的 bug ——
              //     代码里已经没有任何 scrollTop 写入（昨天是因为我亲自写 scrollTop 把视图钉死）；
              //     这次是我"改了内容高度"，机制完全不同。
              //   旧条目在 flowStart 时统一打了 __dshqpOld 标记，这里直接跳过。
              let oldNode = el
              let isOld = false
              for (let d = 0; d < 8 && oldNode !== null && oldNode !== document.body; d += 1) {
                if (oldNode.__dshqpOld === true) { isOld = true; break }
                oldNode = oldNode.parentElement
              }
              if (isOld) continue

              let item = typeof el.closest === 'function' ? el.closest('[class*="flowItem"]') : null
              // ★★★ 三十六次修正 —— **删掉"退回最近合理祖先"这条退路**。
              //   事故（主人截图：聊天区整片空白，连「好 —— 一只狗」都没了）：
              //   那条退路是"往上找一个高度 <= 300px 的容器就当目标" ——
              //   而**新对话内容少，消息列表本身就不足 300px 高**，于是它被选中、
              //   **整块被藏掉**，界面看起来和昨晚那次"空白"一模一样
              //   （但机制完全不同：那次是我写 scrollTop 把视图钉死，这次是我把消息列表
              //     本身设成了 display:none）。
              //   ✓ 现在：找不到条目就**直接跳过**，绝不退而求其次。
              //     `closest` 本来就能成功（日志已证明），这条退路是纯粹的风险源。
              if (item === null) { missItem += 1; continue }

              // ★★ 硬保护：**要藏的元素里若含 2 个以上条目，它必定是消息容器** —— 放弃。
              //    这比任何"层数 / 高度"判据都可靠，直接卡死"藏掉整个聊天区"这类事故。
              let innerItems = 0
              try {
                if (typeof item.querySelectorAll === 'function') innerItems = item.querySelectorAll('[class*="flowItem"]').length
              } catch (error) { innerItems = 0 }
              if (innerItems > 1) { missItem += 1; continue }

              // ★★★ 三十八次修正 —— **最后一道保险：只对"很矮"的元素动手**。
              //   要藏的条目本来就很矮（思考块标题行、工具调用摘要行都是一行文字）；
              //   而**消息列表在任何情况下都高于 120px**（哪怕刚开的新对话也有一句话 + 输入区）。
              //   所以这条一加上，"误藏聊天区"在原理上就不可能发生。
              let itemH = 0
              try { itemH = item.getBoundingClientRect().height } catch (error) { itemH = 0 }
              if (itemH > 120) { missItem += 1; continue }

              if (item.__dshqpHidden === true) continue
              item.__dshqpHidden = true
              item.__dshqpPrevDisplay = item.style.display || ''
              item.style.display = 'none'          // ★ 内联样式，立刻生效
              item.setAttribute(REASONING_ATTR, '1')
              hitItem += 1
              if (item.__dshqpLogged !== true) {
                item.__dshqpLogged = true
                const tag = (item.className || '').toString().slice(0, 34)
                console.log(`[qwen-paint] 已隐藏: ${tag}  「${(item.textContent || '').trim().slice(0, 24)}」`)
              }
            }

            // ★★★ 三十四次修正 —— **处理"没有文本的图标"**。
            //   主人反馈：「文字都没了这是好消息，但是想想有没有办法定位并隐藏这两个图标」。
            //   根因：那两个图标是 **`<svg>`** —— **没有文本节点**，
            //   而上面的 `TreeWalker` 只遍历文本节点，**根本扫不到它们**。
            //
            //   ✓ 反过来走：**遍历可见的小图标，看它"往上几层的祖先里有没有含关键词的文本"**。
            //     关键：`display:none` **不会清掉 `textContent`** ——
            //     所以刚刚被藏起来的「已完成分析」那层，**文本仍然读得到**，
            //     于是能顺着它找到"同时罩住图标和文字"的那个祖先并藏掉。
            //   两道保护：祖先高度必须 0~300px（别藏成大容器）、必须可见。
            let hiddenIcons = 0
            const svgs = document.querySelectorAll('svg')
            for (const s of svgs) {
              let sVisible = true
              try { sVisible = s.offsetParent !== null } catch (error) { sVisible = true }
              if (!sVisible) continue
              let su = s.parentElement
              for (let d = 0; d < 6 && su !== null && su !== document.body; d += 1) {
                // ★★ 三十七次修正 —— 与上面同理的**硬保护**：
                //   候选祖先里若含 2 个以上条目，它一定是消息容器（或更外层），**放弃**。
                //   这直接卡死"藏掉整个聊天区"的事故（主人截图那次就是退路选错了层）。
                let innerItems = 0
                try {
                  if (typeof su.querySelectorAll === 'function') innerItems = su.querySelectorAll('[class*="flowItem"]').length
                } catch (error) { innerItems = 0 }
                if (innerItems > 1) break

                let st = ''
                try { st = (su.textContent || '').trim().slice(0, 60) } catch (error) { st = '' }
                if (st !== '' && KW.some((k) => st.indexOf(k) !== -1)) {
                  let r = null
                  try { r = su.getBoundingClientRect() } catch (error) { r = null }
                  // ★ 高度上限收紧到 200px —— 图标那一行本来就很矮，别给它机会选到大容器
                  const fits = r !== null && r.height >= 0 && r.height <= 200 && r.width > 0
                  if (fits && su.__dshqpHidden !== true) {
                    su.__dshqpHidden = true
                    su.__dshqpPrevDisplay = su.style.display || ''
                    su.style.display = 'none'
                    su.setAttribute(REASONING_ATTR, '1')
                    hiddenIcons += 1
                    if (su.__dshqpLogged !== true) {
                      su.__dshqpLogged = true
                      console.log(`[qwen-paint] 已隐藏图标容器: ${(su.className || '').toString().slice(0, 30)}`)
                    }
                  }
                  break
                }
                su = su.parentElement
              }
            }
            if (hiddenIcons > 0) {
              console.log(`[qwen-paint] 本轮清掉图标容器 ${hiddenIcons} 个`)
            }
          } catch (error) {
            warn(`思考块隐藏（TreeWalker 法）出错：${error && error.message ? error.message : error}`)
          }
          if (missItem > 0) {
            console.log(`[qwen-paint] 有 ${missItem} 处关键词所在元素 closest('flowItem') 返回 null —— 说明它们不在条目里`)
          }
        } catch (error) {
          /* 标记失败只是"思考块不会被隐藏"，不影响任何功能 */
        }
      }

      /**
       * ★★★ 2026-10-08 二十一次修正 —— **用低频轮询取代 MutationObserver**。
       *
       *   这是"两个插件互相触发"的断环点。关键区别：
       *     · `MutationObserver` 会被**任何 DOM 变化唤醒**。而 (UI)MOSS 里有 21 个
       *       常驻观察器、并且它们自己也在改 DOM —— 于是形成**反馈环**：
       *         MOSS 改 DOM → 唤醒我 → 我也改 DOM → 再唤醒 MOSS → …
       *       这正是"单独用都没事、两个一起就卡"的典型特征。
       *     · `setInterval` **不会因为 DOM 变化而被唤醒**，所以**根本不参与这个环**。
       *
       *   ✓ 做法：**只在出图期间**每 800ms 看一次（低频、开销可忽略），
       *     出图一结束立刻 clearInterval —— 平时界面**零常驻、零监听**。
       *     即便某一拍变慢，也只是那一拍，不可能累积成雪崩。
       */
      let reasoningTimer = null
      let reasoningPoll = null

      /**
       * ★★★ 2026-10-08 二十九次修正 —— **改成常驻低频轮询（不再"出图结束就收工"）**。
       *
       *   主人一针见血：「我说的是**生图过程中**不要思考过程，你**生完图**倒是没有图标了」。
       *   原因：我把"打标记"和"隐藏"绑在了同一个时机 —— 只在出图期间才扫描，
       *   于是出图时它还没标记上，等标好了出图的窗口已经过去。
       *
       *   ✓ 现在的分工：
       *     · **打标记**：常驻、每 1500ms 一次 —— 思考块一出现就标好，
       *       出图一开始就能**瞬间**隐藏，不用等扫描跑到；
       *     · **隐藏**：仍由 CSS 的 `body[data-dshqp-drawing]` 条件控制，
       *       **只在出图那 40 秒生效**，平时照常显示。
       *
       *   ⚠ 性能：上一轮卡死是 **MutationObserver 被 DOM 变化唤醒**造成的（会互相激励成环）。
       *     这里用的是 **setInterval 固定节拍**（1.5 秒一次），与 DOM 变化无关、
       *     **不可能成环**；扫描另有 4000 元素上限。**所以常驻是安全的。**
       */
      function watchReasoning() {
        try {
          if (reasoningPoll !== null) return              // 已经在轮询，别重复挂
          markReasoningBlocks()
          reasoningPoll = setInterval(() => {
            try {
              // ★★★ 三十一次修正（主人：「现在生好图都有了，给我回调回去」）——
              //   **轮询必须只在出图期间跑，出图一结束立刻收工**。
              //   上一轮我把它改成了"常驻"，于是出图结束后它**还在继续藏**，
              //   结果"生好图"之后思考块也一直不出来 —— 这就是那句反馈的成因。
              //   ✓ 现在：出图标记一消失（flowFinish 撤掉它），下一拍就自己停；
              //     同时由 flowFinish 负责把**所有已隐藏的条目全部还原**。
              if (!document.body || !document.body.hasAttribute(DRAWING_ATTR)) {
                stopReasoningWatch()
                return
              }
              markReasoningBlocks()
            } catch (error) { /* 单拍失败不影响下一拍 */ }
          }, 1500)
        } catch (error) {
          /* 定时器装不上就退化成"不隐藏思考块"，不影响出图 */
        }
      }

      /** 出图结束：停掉轮询，界面回到"零常驻、零监听"状态。 */
      function stopReasoningWatch() {
        try {
          if (reasoningPoll !== null) { clearInterval(reasoningPoll); reasoningPoll = null }
          if (reasoningTimer !== null) { clearTimeout(reasoningTimer); reasoningTimer = null }
        } catch (error) { /* 忽略 */ }
      }

      /** 只用中性色，不猜 --dsw-alias-* 的名字；明暗主题都不会坏。 */
      const CARD_CSS = `
.dshqp-card { display: flex; flex-direction: column; gap: 6px; max-width: min(380px, 100%); }
/* ★ 2026-10-19（用户要求）：多图并排（开了「用户自选」且一次出了多张时） */
.dshqp-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.dshqp-cell { position: relative; }
.dshqp-idx { position: absolute; top: 6px; left: 6px; min-width: 18px; height: 18px; padding: 0 4px;
  border-radius: 9px; background: rgba(0,0,0,.62); color: #fff; font-size: 11px; line-height: 18px;
  text-align: center; pointer-events: none; }
.dshqp-img { display: block; width: 100%; height: auto; border-radius: 10px; border: 1px solid rgba(128,128,128,.30); }
/* ★ 呼吸灯 → 图片的平滑过渡（主人 2026-10-07 指定："图片出来后立刻平滑转换为生成的图片"）。
   做法：图片入场时淡入 + 从略小放大，配合呼吸灯消失，读起来就是那只灯"展开"成了图。
   为什么不做呼吸灯的退场动画：它在 React 里是**被直接卸载**的、没有退场时机；
   靠"图片随即淡入"视觉上已经连贯，不值得为它加延迟卸载的复杂度。 */
.dshqp-img { animation: dshqp-reveal .45s cubic-bezier(.22,.8,.28,1) both; }
/* ★★★ 2026-10-19（用户要求）：圈选重绘弹窗。**独立浮层**，不碰消息树。 */
.dshqp-mask-overlay { position: fixed; inset: 0; z-index: 2147483000; background: rgba(0,0,0,.62);
  display: flex; align-items: center; justify-content: center; padding: 16px; }
.dshqp-mask-card { background: #1b1b1f; color: #eee; border-radius: 14px; padding: 14px;
  width: min(920px, 96vw); max-height: 94vh; overflow: auto; box-shadow: 0 18px 60px rgba(0,0,0,.55);
  font: 13px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
.dshqp-mask-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.dshqp-mask-hint { font-size: 12px; opacity: .72; margin-bottom: 10px; }
.dshqp-mask-stage { position: relative; display: inline-block; max-width: 100%; }
.dshqp-mask-stage img, .dshqp-mask-stage canvas { display: block; max-width: 100%; height: auto; border-radius: 8px; }
.dshqp-mask-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; cursor: crosshair; touch-action: none; }
.dshqp-mask-tools { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 10px 0; }
.dshqp-mask-btn { border: 1px solid rgba(255,255,255,.22); background: rgba(255,255,255,.08); color: #eee;
  border-radius: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer; }
.dshqp-mask-btn[data-on="1"] { background: rgba(120,180,255,.30); border-color: rgba(120,180,255,.75); }
.dshqp-mask-btn:disabled { opacity: .45; cursor: default; }
.dshqp-mask-prompt { width: 100%; box-sizing: border-box; min-height: 54px; resize: vertical;
  border-radius: 8px; border: 1px solid rgba(255,255,255,.22); background: rgba(255,255,255,.06);
  color: #eee; padding: 8px 10px; font: inherit; }
.dshqp-mask-foot { display: flex; gap: 10px; justify-content: flex-end; align-items: center; margin-top: 10px; }
.dshqp-mask-state { margin-right: auto; font-size: 12px; opacity: .8; }
/* ★ 2026-10-20（0.17.13）：结果图容器 —— 空的时候不占位，免得把"开始重绘"按钮顶下去 */
.dshqp-mask-result:empty { display: none; }
@keyframes dshqp-reveal {
  from { opacity: 0; transform: scale(.94) translateY(4px); }
  to   { opacity: 1; transform: none; }
}
.dshqp-name { font-size: 12px; line-height: 1.4; opacity: .62; word-break: break-all; }
.dshqp-pending { font-size: 13px; line-height: 1.5; opacity: .72; }
/* ★ 生成中的「RGB 呼吸灯」（主人 2026-10-07 指定）：
   正方形 + 白色流光从左上扫到右下 + 下方小字「正在生成图片」。
   纯 CSS 动画，不占 JS、不依赖 React 重渲染，卸载时随 style 一起摘掉。 */
.dshqp-loading { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 8px 0; }
.dshqp-lamp {
  position: relative; width: 96px; height: 96px; border-radius: 14px; overflow: hidden;
  background: conic-gradient(from 0deg, #ff5f6d, #ffc371, #46e891, #38bdf8, #a855f7, #ff5f6d);
  animation: dshqp-breathe 2.6s ease-in-out infinite;
}
@keyframes dshqp-breathe {
  0%, 100% { opacity: .55; filter: saturate(.85); }
  50%      { opacity: 1;   filter: saturate(1.3); }
}
.dshqp-lamp::after {
  content: ""; position: absolute; inset: -45%;
  background: linear-gradient(115deg, transparent 40%, rgba(255,255,255,.95) 50%, transparent 60%);
  animation: dshqp-sweep 1.8s linear infinite;
}
@keyframes dshqp-sweep {
  from { transform: translate(-58%, -58%); }
  to   { transform: translate(58%, 58%); }
}
.dshqp-loading-text { font-size: 12px; line-height: 1.3; opacity: .82; }
.dshqp-error { font-size: 13px; line-height: 1.5; color: #e5484d; white-space: pre-wrap; word-break: break-word; }
.dshqp-seat { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; line-height: 1; opacity: .8; white-space: nowrap; min-width: 0; }
/* ★★★ 2026-10-09（主人要求：「✨ 这个星星太丑了，改掉。换成一个更好看的星星」）：
   状态点原先是个 8px 的**纯圆点**，主人觉得难看。现在改成**四角星**（就是 ✨ 那种闪光形）。
   做法：clip-path 抠出星形，不引入任何图片资源。
   ⚠ 光晕必须从 box-shadow 换成 **drop-shadow** —— box-shadow 画的是**元素盒子**的阴影，
     会被 clip-path 一起裁掉、等于消失；drop-shadow 是按**裁剪后的可见形状**投影，才跟得住星形。
   内凹点取 35%/65%（而不是更尖的 38%/62%）：10px 这个尺寸下太尖会糊成一团小刺。 */
/* ★★★ 2026-10-09 重新设计（主人反馈「这个星星太丑了」）。
   改了三处：
     ① 尺寸 10px → 12px：小尺寸下 8 角星的尖角会糊成一团小刺，放大一点才看得出形状；
     ② 内凹 35%/65% → 43%/57%：原来是"胖八角"，现在收成**修长的四角星（sparkle）**，
        四个主角更长、四个次角更短，视觉上更精致、更有"星"的感觉；
     ③ 光晕从单层改成**双层 drop-shadow**（近处一层紧实、远处一层柔和），
        比原来单层 3px 更通透，不再是硬邦邦一圈边。
   ⚠ 仍然不用任何图片资源；光晕必须用 drop-shadow（box-shadow 会被 clip-path 一起裁掉）。 */
.dshqp-dot {
  width: 12px; height: 12px; flex: none;
  background: rgba(128, 128, 128, .55);
  clip-path: polygon(
    50% 0%, 57% 43%, 100% 50%, 57% 57%,
    50% 100%, 43% 57%, 0% 50%, 43% 43%
  );
  transition: background .25s ease, filter .25s ease;
}
.dshqp-dot[data-state="on"] {
  background: #30a46c;
  filter: drop-shadow(0 0 2px rgba(48, 164, 108, .7))
          drop-shadow(0 0 5px rgba(48, 164, 108, .45));
}
.dshqp-dot[data-state="busy"] {
  background: #f5a623;
  filter: drop-shadow(0 0 2px rgba(245, 166, 35, .7))
          drop-shadow(0 0 5px rgba(245, 166, 35, .45));
}
/* ★ 点状态点弹出的「自动关闭时长」菜单（主人 2026-10-07 新增需求：可以选择多久后关后端）。
   向上弹出，避免被 composer 下边缘裁掉。 */
.dshqp-seat[data-clickable="1"] { cursor: pointer; position: relative; }
.dshqp-menu {
  /* ★★★ 主人 2026-10-08 两次反馈后的定案：**挂到 body 上 + fixed 定位**。
     原来是 seat 的子元素 + absolute 定位，会被 composer 那一串祖先的 overflow **裁掉** ——
     新会话里 composer 被抬到屏幕顶部，菜单直接被切头，而且**滚动也救不了**
     （裁的是元素的可见区域，不是它自己的滚动内容）。
     挂到 body 就跟祖先裁剪彻底无关了；坐标由 placeMenu() 每次打开时现算。 */
  position: fixed; top: 0; left: 0; z-index: 2147483000;
  /* ★ 2026-10-09：字放大之后菜单也要跟着宽一点，否则最长那几项（「5 分钟后关闭（默认）」）
     会贴着边框。150 → 176。 */
  display: flex; flex-direction: column; min-width: 176px; padding: 5px;
  border-radius: 10px; background: rgba(30,30,34,.97);
  border: 1px solid rgba(128,128,128,.38); box-shadow: 0 10px 28px rgba(0,0,0,.45);
  /* ★ 主人 2026-10-08：「把这个选择界面稍微调小一点试试」——
     上限 560 → 400，字号/行距也各收一档（配合 max-height 一起看）。 */
  max-height: min(70vh, 400px); overflow-y: auto; overscroll-behavior: contain;
  /* ★ 2026-10-09 通用性：不许超出视口宽度。
     窄屏/分屏/手机横屏时，菜单原来的"按内容自适应"可能顶出去被截掉。 */
  max-width: calc(100vw - 16px);
}
/* ★★★ 2026-10-09 新增（主人要求）：**功能区 vs 外观区**的分隔线。
   主人原话：「这些你和下面的颜色选择要区分出来啊，这是给用户调整功能的」
   —— 原先"后端 / 自动关闭 / 生图判断"（功能设置）和"生图动画 / 流光"
   （纯外观）是**平铺**在一起的，五组标题一个样式，看不出前三个是一类。
   这条线比普通分组线更明显（渐隐，两侧淡出），一眼就能分出上下两块。
   ⚠ 本段注释里不许出现反引号：CARD_CSS 是 JS 模板字符串，反引号会提前截断它。 */
.dshqp-menu-divider {
  height: 1px; flex: none; margin: 9px 3px 7px;
  background: linear-gradient(90deg,
    transparent 0%, rgba(128, 128, 128, .5) 50%, transparent 100%);
}
/* 分组小标题（「自动关闭」/「生图动画」） */
.dshqp-menu-head {
  font-size: 11px; font-weight: 700; letter-spacing: .04em; opacity: .55;
  padding: 7px 11px 3px; text-align: left; white-space: nowrap;
}
/* 非第一组的分组标题上方加一条分隔线，视觉上分得清两组 */
.dshqp-menu-head + .dshqp-menu-item { margin-top: 1px; }
.dshqp-menu-head:not(:first-child) {
  margin-top: 4px; border-top: 1px solid rgba(128,128,128,.26); padding-top: 6px;
}
/* ★ 子标题（「流光 · 抄自月匠」）：比组标题更轻，**不带**上面那条分隔线 ——
   它紧跟在「流星」那一项后面，画一条线会把"流星属于生图动画"这层关系切断。
   ⚠ 这条必须写在 .dshqp-menu-head:not(:first-child) 之后（两者特异性相同，靠顺序取胜）。 */
.dshqp-menu-head.dshqp-menu-sub {
  border-top: 0; margin-top: 1px; padding-top: 4px;
  opacity: .45; font-size: 10px;
}
/* 「流星」名字前面的小圆点（主人要求：给自制那个标个点） */
.dshqp-menu-bullet {
  width: 6px; height: 6px; border-radius: 50%; flex: none;
  background: linear-gradient(135deg, #ffd7a1, #ff8fb1 48%, #8fa9ff);
}
/* 名字后面的来源小标签（自制） */
.dshqp-menu-tag {
  font-size: 9.5px; line-height: 1; padding: 1px 5px; border-radius: 999px; flex: none;
  border: 1px solid rgba(128,128,128,.45); opacity: .75;
}
.dshqp-menu-item {
  display: flex; align-items: center; gap: 7px;
  /* ★★★ 2026-10-09（主人要求：「这几个选项的字有点挤在一起了，你稍微隔开一丢丢，
     并且把字放大一点」）：
       字号 11.5 → **13px**、行高 1.2 → 1.4、内边距 5/9 → **8/11**、条目间距 5 → 7。
       原来是长期"为了不撑宽菜单"一路压下来的，压到后来确实太挤了。 */
  text-align: left; font-size: 13px; line-height: 1.4; padding: 8px 11px; border: 0;
  border-radius: 7px; background: transparent; color: #e8e8ea; cursor: pointer; white-space: nowrap;
  max-width: 100%; overflow: hidden;
}
/* ★ 2026-10-09（主人要求）：**外观区**（生图动画 / 流光配色）字号收一档、间距也小一点，
   和上面的功能区拉开层次 —— 一眼能看出"上面是调功能、下面是选样子"。
   配合 menu-divider，两组在视觉上彻底分开。 */
/* ★ 2026-10-09（主人要求：功能区与外观区要分得开，且「下面的颜色选择也太在一起了，
   稍微隔开一点点」）：外观区（生图动画 / 流光配色）字号收一档、间距反而**加大** ——
   色块本来就只有 16px 高，条目挤在一起时整排看起来是一道色带，分不清哪块是哪块。
   内边距 6→9、图标与文字间隔 7→10，让每条色块各自独立成行。 */
.dshqp-menu-item[data-kind="flow"] { font-size: 12px; padding: 9px 11px; gap: 10px; }
/* ★ 2026-10-09：菜单里的**提示条**（目前用于"启动失败原因"）。
   比条目更淡、允许换行 —— 错误信息往往是一长句，绝不能让它撑破菜单。 */
.dshqp-menu-note {
  margin: 2px 6px 6px; padding: 7px 9px; border-radius: 7px;
  font-size: 11px; line-height: 1.45;
  color: #f0a8a2; background: rgba(229, 72, 77, .12);
  border: 1px solid rgba(229, 72, 77, .3);
  white-space: normal; word-break: break-word; overflow-wrap: anywhere;
}
.dshqp-menu-item:hover { background: rgba(128,128,128,.24); }
/* ★ 2026-10-08 主人要求：把「当前选中的档位」高亮出来。
   ★★★ 2026-10-09（主人要求：「这个选择的勾你改成圆圈，选哪个就在左边把这个勾改成空心圆圈」）：
   选中标记由 **勾（✓）** 改成**空心圆圈**：
   · 未选中 —— 一个低调的灰色空心圆，当作占位（保证各条目文字左边缘对齐、切换时不左右跳）；
   · 已选中 —— 圆圈变高亮色并加粗，圆心再点一个实心点。
   这就是标准单选（radio）的样子，比原来那个勾轻，也和外观区那排彩色色块明显不是一类。
   圆心点用 **inset box-shadow** 画，省掉再挂一个伪元素。
   ⚠ 尺寸必须写死 13px（原来是 width: 11px + 文字内容撑高），否则空圆在 flex 里会被压扁。 */
.dshqp-menu-item::before {
  content: ""; flex: none; width: 13px; height: 13px; box-sizing: border-box;
  border-radius: 50%; border: 1.5px solid rgba(128, 128, 128, .42);
  transition: border-color .16s ease;
}
.dshqp-menu-item[data-current="1"] { background: rgba(90,160,255,.20); color: #cfe3ff; font-weight: 600; }
.dshqp-menu-item[data-current="1"]:hover { background: rgba(90,160,255,.30); }
.dshqp-menu-item[data-current="1"]::before {
  border-color: #7fb3ff;
  box-shadow: inset 0 0 0 3px #7fb3ff;
}

/* ══════════ 优化状态徽标（★ 2026-10-09）══════════
   ⚠ 尺寸刻意克制：主人两次反馈状态行文字过长会把"推理流光条"挤到第二排，
     所以徽标只放 4~6 个字，详细原因走点击弹出的面板。 */
/* 徽标所在的座位需要定位上下文 —— 否则下面那个绝对定位的详情面板会
   相对更外层（甚至整个页面）定位，弹到莫名其妙的位置去。 */
#qwen-paint-status { position: relative; }
.qwen-paint-opt {
  font-size: 10.5px; line-height: 1; padding: 2px 6px; border-radius: 999px;
  border: 1px solid transparent; cursor: default; flex: none;
  white-space: nowrap; font-variant-numeric: tabular-nums;
}
/* ✓ 已启用：低调（默认状态，不该抢注意力） */
.qwen-paint-opt-on {
  color: #6fcf97; border-color: rgba(111,207,151,.32); background: rgba(111,207,151,.10);
}
/* ⚠ 未启用 / 部分启用：橙色 + 可点击看原因 */
.qwen-paint-opt-warn {
  color: #f5b759; border-color: rgba(245,183,89,.38); background: rgba(245,183,89,.12);
  cursor: pointer; text-decoration: underline dotted rgba(245,183,89,.6);
}
.qwen-paint-opt-warn:hover { background: rgba(245,183,89,.22); }
/* ⏸ 插件已停用：灰 */
.qwen-paint-opt-off {
  color: #9aa0a6; border-color: rgba(154,160,166,.32); background: rgba(154,160,166,.10);
  cursor: pointer;
}
/* 未知：中性 */
.qwen-paint-opt-unknown {
  color: #9aa0a6; border-color: rgba(154,160,166,.26);
}
/* ★ 2026-10-09：ComfyUI 未启动 = **正常状态**（不是故障），用中性外观。
   刻意不用橙色 —— 橙色会让人以为出了问题，可这里其实什么都不用做。 */
.qwen-paint-opt-idle {
  color: #9aa0a6; border-color: rgba(154,160,166,.28); background: rgba(154,160,166,.08);
  cursor: pointer;
}
.qwen-paint-opt-idle:hover { background: rgba(154,160,166,.18); }

/* 优化详情面板（点徽标弹出）。
   ★★★ 2026-10-09 修正：从 absolute 改成 **fixed + 挂 body** —— 跟菜单当初踩的是同一个坑。
     徽标在 composer 里，而 composer 的祖先链上有 overflow 裁剪，
     absolute 面板会被**切掉一半**（主人报的正是"只显示了一半"）。
     挂在 body 上就与祖先裁剪彻底无关，坐标每次打开现算（见 openPanel）。
   ★ 通用性（笔记本 / 台式 / Win / Linux / 任意系统字号都要能用）：
     · 宽高都用 min() 跟着视口收缩，绝不写死像素；
     · 字号 12px 起，不再往下压（小屏 + Linux 字体偏大时不至于糊成一团）；
     · 文字一律允许换行（word-break + overflow-wrap），长英文/长路径不会撑破容器；
     · overscroll-behavior 防止滚到底后把整页带着滚。 */
.qwen-paint-opt-panel {
  position: fixed; top: 0; left: 0; z-index: 2147483000;
  width: min(360px, calc(100vw - 24px));
  max-height: min(62vh, 460px); overflow-y: auto; overscroll-behavior: contain;
  padding: 12px 14px; border-radius: 10px; text-align: left;
  background: #23242a; border: 1px solid rgba(128,128,128,.38);
  box-shadow: 0 8px 26px rgba(0,0,0,.42); color: #e8e8ea;
  font-size: 12px; line-height: 1.6;
  word-break: break-word; overflow-wrap: anywhere;
}
.qwen-paint-opt-panel h4 {
  margin: 0 0 6px; font-size: 12px; font-weight: 600; color: #f2f2f4;
}
.qwen-paint-opt-panel .qwen-paint-opt-reason {
  margin: 0 0 7px; padding-left: 15px; position: relative; color: #d6d8dc;
}
.qwen-paint-opt-panel .qwen-paint-opt-reason::before {
  content: "\\2022"; position: absolute; left: 4px; opacity: .6;
}
/* ★ 2026-10-11：关键能力缺口（如缺 UnetLoaderGGUF 节点）。
   与 reasons 分开 —— reasons 只在"没全部启用"时出现，这个**任何时候都要提醒**。 */
.qwen-paint-opt-panel .qwen-paint-opt-warning {
  margin: 0 0 7px; padding: 4px 7px; border-radius: 6px;
  background: rgba(230,160,60,.16); color: #e8b96a;
  word-break: break-word; overflow-wrap: anywhere;
}
.qwen-paint-opt-panel .qwen-paint-opt-row {
  display: flex; align-items: baseline; gap: 6px; margin: 3px 0;
}
.qwen-paint-opt-panel .qwen-paint-opt-yes { color: #6fcf97; flex: none; }
.qwen-paint-opt-panel .qwen-paint-opt-no { color: #f0918a; flex: none; }
.qwen-paint-opt-panel .qwen-paint-opt-name { flex: 1; }
/* ★★★ 2026-10-09 四态渲染新增样式 ──────────────────────────────────
   状态词与标记用**同一套颜色**，四行竖排时一眼能比出分布。
   · 已启用  绿 → 无需动作
   · 可启用  黄 → 有动作可做（装节点 / 改配置）
   · 不可启用 红 → 当前做什么都没用，先解决上游
   · 未确认  灰 → 探测没成功，重试即可
   颜色之外还各有**不同的字形**（✓ / ✕ / ?），
   色觉障碍用户也能区分 —— 不能只靠颜色传达状态。 */
.qwen-paint-opt-panel .qwen-paint-opt-can { color: #f5b759; flex: none; }
.qwen-paint-opt-panel .qwen-paint-opt-unk { color: #9aa0a6; flex: none; }
/* ★ 2026-10-09 二次修正新增「让位（按尺寸）」蓝 ——
   host 的 superseded 态：与 BlockCache 争抢同一组 wrapper，按出图尺寸让位，
   **不是故障也不用修**。没有这一档时它会兜底成 unknown（? 未确认），
   而 blockCacheEnabled 默认改为 true 后，TE-Speed / Speedup 默认就是这个态
   ⇒ 缺档等于把"已知且正常"显示成"未确认"，是假报告。
   ⚠ 这段 CSS 在 JS 模板字符串里，注释内**禁止出现反引号**（会提前闭合模板串）。 */
.qwen-paint-opt-panel .qwen-paint-opt-sup { color: #7aa7f0; flex: none; }
.qwen-paint-opt-panel .qwen-paint-opt-mark {
  width: 12px; text-align: center; font-weight: 700;
}
.qwen-paint-opt-panel .qwen-paint-opt-tag {
  flex: none; font-size: 10.5px; padding: 1px 5px; border-radius: 4px;
  border: 1px solid currentColor; opacity: .92;
}
.qwen-paint-opt-panel .qwen-paint-opt-tally {
  margin: 2px 0 8px; padding: 4px 7px; border-radius: 6px;
  background: rgba(128,128,128,.14); font-size: 11px; color: #cfd2d6;
}
/* ★ 2026-10-11：按显卡过滤掉不适用优化时的提示（藏了哪几项、按哪张卡判定的） */
.qwen-paint-opt-panel .qwen-paint-opt-filtered {
  margin: 2px 0 8px; padding: 4px 7px; border-radius: 6px;
  background: rgba(128,128,128,.10); font-size: 11px; color: #a8adb4;
  word-break: break-word; overflow-wrap: anywhere;
}
.qwen-paint-opt-panel .qwen-paint-opt-rows { margin-top: 2px; }
/* "该做什么" 缩进在名称之下，与名称左对齐（28px = 标记宽 + 两处 gap） */
.qwen-paint-opt-panel .qwen-paint-opt-action {
  margin: 0 0 6px 28px; font-size: 11px; color: #a8adb4;
  word-break: break-word; overflow-wrap: anywhere;
}
.qwen-paint-opt-panel .qwen-paint-opt-row-on .qwen-paint-opt-name { color: #e8e8ea; }
.qwen-paint-opt-panel .qwen-paint-opt-row-available .qwen-paint-opt-name,
.qwen-paint-opt-panel .qwen-paint-opt-row-off .qwen-paint-opt-name { color: #f2d8a8; }
.qwen-paint-opt-panel .qwen-paint-opt-row-blocked .qwen-paint-opt-name { color: #c9cdd2; }
/* ★ 2026-10-09 二次修正：补 superseded / unknown 两档的名称色 ——
   原先只覆盖 on/available/off/blocked，新状态会落到默认色，与同行的蓝色状态词不一致。 */
.qwen-paint-opt-panel .qwen-paint-opt-row-superseded .qwen-paint-opt-name { color: #a9c6f5; }
.qwen-paint-opt-panel .qwen-paint-opt-row-unknown .qwen-paint-opt-name { color: #c9cdd2; }
/* ★★★ 2026-10-09 新增：**逐项开关**（主人要求「BlockCache T8 没提供开关」）。
   与上面"动作提示"同缩进（28px），视觉上属于同一个条目的附属信息。
   开关本体用标准 role=switch 造型：胶囊 + 滑块，开=绿、关=灰。 */
.qwen-paint-opt-panel .qwen-paint-opt-toggle {
  margin: 0 0 8px 28px; display: flex; align-items: center;
  gap: 7px; flex-wrap: wrap;
}
.qwen-paint-opt-panel .qwen-paint-opt-switch {
  position: relative; flex: none;
  width: 32px; height: 17px; padding: 0; border-radius: 9px;
  border: 1px solid rgba(128,128,128,.5);
  background: rgba(128,128,128,.3);
  cursor: pointer; transition: background .18s, border-color .18s;
  /* 去掉浏览器默认外观，否则各平台长得完全不一样 */
  -webkit-appearance: none; appearance: none;
}
.qwen-paint-opt-panel .qwen-paint-opt-switch .qwen-paint-opt-knob {
  position: absolute; top: 1.5px; left: 1.5px;
  width: 12px; height: 12px; border-radius: 50%;
  background: #f2f3f5; box-shadow: 0 1px 3px rgba(0,0,0,.45);
  transition: transform .18s;
}
.qwen-paint-opt-panel .qwen-paint-opt-switch.is-on {
  background: #3f9d63; border-color: #4fb577;
}
.qwen-paint-opt-panel .qwen-paint-opt-switch.is-on .qwen-paint-opt-knob {
  transform: translateX(15px);
}
.qwen-paint-opt-panel .qwen-paint-opt-switch.is-disabled {
  opacity: .42; cursor: not-allowed;
}
.qwen-paint-opt-panel .qwen-paint-opt-switch-text {
  flex: none; font-size: 11px; color: #d6d8dc;
}
/* ★ 2026-10-14（专业卡版）：多选一档位的下拉控件（显存档 / 精度档 / 文本控制档） */
.qwen-paint-opt-panel .qwen-paint-opt-select {
  flex: 0 1 auto; max-width: 100%;
  padding: 3px 8px; border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, .18);
  background: rgba(255, 255, 255, .06);
  color: #e8eaee; font-size: 11.5px; line-height: 1.4;
  cursor: pointer; outline: none;
}
.qwen-paint-opt-panel .qwen-paint-opt-select:hover { border-color: rgba(255, 255, 255, .3); }
.qwen-paint-opt-panel .qwen-paint-opt-select:disabled { opacity: .42; cursor: not-allowed; }
.qwen-paint-opt-panel .qwen-paint-opt-select option { color: #1b1d21; background: #f3f4f6; }
/* ★ 2026-10-14（专业卡版）：档位选择器整栏（与优化明细分开） */
.qwen-paint-opt-panel .qwen-paint-opt-tiers {
  margin-top: 8px; padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, .1);
  display: flex; flex-direction: column; gap: 6px;
}
.qwen-paint-opt-panel .qwen-paint-opt-tiers-title {
  font-size: 11.5px; font-weight: 600; color: #cfd3d9;
}
.qwen-paint-opt-panel .qwen-paint-opt-tiers-note {
  font-size: 10.5px; line-height: 1.45; color: #a8adb4;
  word-break: break-word; overflow-wrap: anywhere;
}
.qwen-paint-opt-panel .qwen-paint-opt-tiers-label {
  flex: 0 1 auto; font-size: 11.5px; color: #d6d8dc; margin-right: 8px;
}
.qwen-paint-opt-panel .qwen-paint-opt-toggle-hint {
  flex-basis: 100%; font-size: 10.5px; color: #a8adb4; line-height: 1.45;
  word-break: break-word; overflow-wrap: anywhere;
}
/* "即时生效 / 永久保存怎么做" —— 必须显眼一点，否则用户会以为改了就一劳永逸 */
.qwen-paint-opt-panel .qwen-paint-opt-toggle-persist {
  flex-basis: 100%; margin-top: 1px; font-size: 10.5px; line-height: 1.45;
  color: #f2d8a8; opacity: .9;
  word-break: break-word; overflow-wrap: anywhere;
}
/* ★ 一句轻量提示（点了「优化」但数据没到时的兜底）。与详情面板同色系，但更薄更小。 */
.qwen-paint-opt-notice {
  position: fixed; top: 0; left: 0; z-index: 2147483000;
  max-width: min(280px, calc(100vw - 24px));
  padding: 6px 10px; border-radius: 8px;
  background: #23242a; border: 1px solid rgba(128,128,128,.38);
  box-shadow: 0 6px 20px rgba(0,0,0,.4); color: #d6d8dc;
  font-size: 11px; line-height: 1.5;
  word-break: break-word; overflow-wrap: anywhere;
}
.qwen-paint-opt-panel .qwen-paint-opt-hint {
  margin-top: 8px; padding-top: 7px; border-top: 1px solid rgba(128,128,128,.26);
  opacity: .72; font-size: 10.5px;
}
/* ★★ 出图时**不再**换成"迷你流光灯" —— 主人 2026-10-08 要求改回**小黄点**，
   好和 README 里那张颜色表（🟡 黄 = 正在出图）对上。
   原来的 .dshqp-dot.dshqp-dot-lamp 规则、它用的 dshqp-flow-color 关键帧，
   以及 dshqp-sweep 的引用都已一并清掉 —— 那三样只有它俩互相引用，删干净不留死代码。
   现在出图就是 .dshqp-dot[data-state="busy"] 那条黄底 + 光晕，和在线/未启动同尺寸。 */
/* ★★★ 出图动画（2026-10-08 全面重做，主人指定）：
   ① 比例改成 **9:16**（手机壁纸）
   ② **跟随系统主题**：浅色系统 = 黑金属；深色系统 = 银白金属
   ③ 金属质感：多段斜向渐变 + 一道高光从左上扫到右下
   ④ 中心爆发马卡龙流星（canvas 层，见 makeFlowNode）
   位置仍是"我那条回复的下方"，随消息流滚动。
   ⚠ flex: none 必须保留 —— 消息列表是 flex 纵向容器，不加它这块会撑满剩余空间、
     把上面的消息全部挤出视口（踩过两次，界面看起来像"全空了"）。
   ⚠ 高度用 min(480px, 62vh)：竖屏比例在高窗口里也不至于顶掉半边界面。
   ⚠⚠ 本段注释里**绝对不许出现反引号** —— CARD_CSS 是 JS 模板字符串，
      反引号会把它提前截断（这个坑 MEMO 里记过两次，我这次又踩了第三次）。 */
.dshqp-flow {
  flex: none;
  position: relative; z-index: 1;
  /* ★ 主人 2026-10-08：小一些（320 高）、靠左。
     ⚠ 高度用**固定 320px**，不用 vh ——
       主人反馈「第一次稍微大一些播完马上又跳到小的去」：
       min(320px, 44vh) 那种写法里的 vh 会随**视口高度**变化（composer 展开、布局稳定后都会变），
       于是块在插入后**尺寸跳变**。固定像素值就完全不会跳。
     ⚠ align-self: flex-start 是**必须的** —— 消息列表是纵向 flex 容器，
       交叉轴默认 stretch 会把这块**横向拉满**，aspect-ratio 9/16 就失效了
       （主人截图里它变成横的，就是这个原因）。 */
  align-self: flex-start;
  height: 320px; aspect-ratio: 9 / 16;
  width: auto; max-width: 100%; margin: 10px 0 14px;
  border-radius: 16px; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  /* ★★ 深色主题（默认）= 黑金属。
     主人 2026-10-08 第二次确认：「我现在是黑色主题**应该用黑色金属**」。 */
  background: linear-gradient(135deg,
    #16171b 0%, #33363f 18%, #4a4e59 34%, #1b1d22 52%,
    #2c2f37 68%, #0e0f12 84%, #23252b 100%);
  transition: opacity .42s ease, transform .42s ease;
  /* ★ 主人 2026-10-08：整块"呼吸"——缓慢放大缩小（幅度 2.2%、周期 4 秒）。
     transform 不改变布局，所以不会挤到消息、也不影响滚动位置。 */
  animation: dshqp-flow-breathe 4s ease-in-out infinite;
}
@keyframes dshqp-flow-breathe {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.022); }
}
/* ★ 出图结束：淡出 + 轻微缩小，把位置让给正文里的图片。
   ⚠ 必须 animation: none —— 否则上面"呼吸"里的 transform 会盖住这里的 scale(.97)，
     淡出看起来就"没有缩放"。（属性选择器的权重不如 animation 内的 transform，踩过。） */
.dshqp-flow[data-done="1"] {
  animation: none;
  opacity: 0;
  transform: scale(.97);
}
/* ★★ 浅色主题 = 银白金属（与上面正好相反）。
   主题由 JS 读**实际背景色的亮度**判定后写成 data-dshqp-theme（见 detectDarkTheme），
   CSS 只认这个属性 —— DSH 有自己的主题开关、不跟随系统，所以不能用 prefers-color-scheme。
   ⚠⚠ 本段注释里绝对不许出现反引号（CARD_CSS 是 JS 模板字符串，会被提前截断 —— 已踩四次）。 */
.dshqp-flow[data-dshqp-theme="light"] {
  background: linear-gradient(135deg,
    #f2f3f7 0%, #c9ccd6 18%, #ffffff 34%, #b9bdc9 52%,
    #eef0f5 68%, #a8acb8 84%, #d8dbe3 100%);
}
/* 高光带：从左上扫到右下
   ★ 主人 2026-10-08：「流光再柔和一些」——
     峰值透明度 .90 → .38，过渡从 ±12% 拉宽到 ±20%，周期 2.4s → 3.4s。 */
.dshqp-flow::after {
  content: ""; position: absolute; inset: -60%;
  background: linear-gradient(115deg,
    transparent 30%,
    rgba(255, 255, 255, .06) 42%,
    rgba(255, 255, 255, .38) 50%,
    rgba(255, 255, 255, .06) 58%,
    transparent 70%);
  animation: dshqp-sweep 3.4s linear infinite;
}
/* ★★ 流光方案（带 data-dshqp-grad）**不再叠这道白光扫过** ——
   主人 2026-10-08 要的是"只做流光"，两层光效叠一起就花了。流星方案照旧保留。 */
.dshqp-flow[data-dshqp-grad]::after { display: none; }
/* 流星画布：铺满整块，叠在金属底色之上、文字之下 */
.dshqp-flow-canvas {
  position: absolute; inset: 0; width: 100%; height: 100%;
  z-index: 1; pointer-events: none;
}
/* 文字：银白金属底 → 深字；黑金属底 → 浅字（用媒体查询切）
   ★ 主人 2026-10-08 指定：文案改「感知世界中」、**加粗**，
     并且**放到流星和流光图层之下**（z-index 从 2 降到 0）——
     canvas 是 z-index:1、高光伪元素排在最后，所以文字会在两者之下。 */
.dshqp-flow-tip {
  position: relative; z-index: 0; font-size: 15px; letter-spacing: .1em;
  font-weight: 700;
  /* ★ 默认 = 深色主题（黑金属底）→ 用**浅色字** */
  color: #e8eaf0; text-shadow: 0 1px 6px rgba(0, 0, 0, .65);
}
/* ★ 浅色主题（银白金属底）→ 用**深色字**，与上面正好相反。
   主题由 data-dshqp-theme 驱动，不再用 prefers-color-scheme。 */
.dshqp-flow[data-dshqp-theme="light"] .dshqp-flow-tip {
  color: #2a2d34;
  text-shadow: 0 1px 2px rgba(255, 255, 255, .55);
}
/* （dshqp-flow-color 关键帧已删 —— 它只被状态点的"迷你流光灯"用，
   那个灯在 2026-10-08 按主人要求改回小黄点了，所以它成了死代码。） */
/* 出图期间把"思考中"的块收起来 —— 主人要求这时候用户要看的是图，不是分析。
   ⚠ 标记用的是**文案匹配**（见 markReasoningBlocks），不是哈希类名：类名随构建变，
   界面上那句「深度求索中」不会。平时不动它，只有 body 带出图标记时才隐藏。 */
body[data-dshqp-drawing] [data-dshqp-reasoning] { display: none !important; }
/* ★ 压缩 composer 卡片内部的多余留白（主人反馈"输入框和下方选项中间空白太大"）。
   经查内核样式，可安全压缩的是纯间距：卡片 padding-top 8px + 卡片内 gap 12px。
   输入框自身的 min-height 只是**下限**，设为 0 不影响它随内容自动增高。
   ⚠ 这是**覆盖内核样式**：DSH 升级后若属性名变了，这几条会**静默失效**
   （不报错、也不会弄坏界面，只是留白回来）。要撤销就把本段整块删掉。
   [data-composer-card] 是内核声明的稳定属性（见 MEMO），不依赖 CSS Modules 哈希类名。
   ⚠ 本段注释里**不许出现反引号**：CARD_CSS 是 JS 模板字符串，反引号会提前把它截断。
   （2026-10-07 同类问题踩过两次：glow.css 那次被 build.mjs 拦住，这次被自测拦住。） */
[data-composer-card] { padding-top: 6px !important; gap: 8px !important; }
[data-composer-card] textarea { min-height: 0 !important; }
/* ★★ 输入区的真实元素是 Lexical 的 contenteditable div（**不是 textarea**），
   所以上面那条 textarea 规则其实打空了 —— 2026-10-07 查源码确认：
   composer 的输入宿主绑定一个 shell 自有的 Lexical 编辑器，根元素带稳定属性
   data-lexical-editor="true"。用它精确命中；外层容器类名是哈希的（随版本变），
   只能用"含有编辑器"这个关系去够，并把上下内边距一起压掉。
   工具行是卡片的最后一个子级，它的上内边距也顺手压到 2px。 */
[data-composer-card] [data-lexical-editor="true"] {
  min-height: 0 !important;
  padding-top: 4px !important;
  padding-bottom: 4px !important;
}
[data-composer-card] *:has(> [data-lexical-editor="true"]) {
  min-height: 0 !important;
  padding-top: 2px !important;
  padding-bottom: 2px !important;
}
[data-composer-card] > *:last-child { padding-top: 4px !important; }
/* ★ 输入区的滚动条：内核默认给它一条细滑块（还专门定制了轨道间距）。
   我把内边距压掉之后内容刚好溢出，那条滑块就冒出来了（主人反馈"右边多出来的滑动条"）。
   这里把它隐藏 —— 滚轮与键盘滚动照常，只是不再画那条滑块。
   定位用 class 含 _scroll：CSS Modules 的名字部分是稳定的，前缀哈希才会随版本变。 */
[data-composer-card] [class*="_scroll"] { scrollbar-width: none; }
[data-composer-card] [class*="_scroll"]::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
  display: none !important;
}
/* ★ 空会话（hero）：内核默认把内容垂直居中（height:100% + justify-content:center），
   所以上下各留一大片。这里改成靠上、顶部留一小段空。
   定位刻意选得**窄**：class 含 _root，且**直接子元素**是 class 含 _stack 的容器、
   该容器里再含 composer 卡片。正常对话的容器不是这个结构（它的 root 下是 header /
   消息区 / composer 并列），所以匹配不到 —— 避免弄坏已经满意的正常布局。
   ⚠ 同样属于覆盖内核样式：类名是哈希的，DSH 升级后可能静默失效（不会弄坏界面）。
   ⚠ 本段注释不许出现反引号（CARD_CSS 是 JS 模板字符串，反引号会截断它）。 */
[class*="_root"]:has(> [class*="_stack"] [data-composer-card]) {
  justify-content: flex-start !important;
  padding-top: min(10vh, 96px) !important;
}
`.trim()


      /** 只走 console.warn，且它自己也不许抛错。 */
      function warn(message) {
        try {
          console.warn(`[qwen-paint] ${message}`)
        } catch (err) {
          /* 连 console 都没有就彻底安静 */
        }
      }

      /** 把结果块里的文本拼起来（失败时用来显示原因）。 */
      function textOf(block) {
        const parts = []
        const content = block && block.content
        if (Array.isArray(content)) {
          for (const b of content) {
            if (b && b.type === 'text' && typeof b.text === 'string') parts.push(b.text)
          }
        }
        return parts.join('\n').trim()
      }

      /**
       * 取图片绝对路径：优先用 host 侧 presentationMeta 落下的 `meta.path`
       * （最可靠，不依赖文案），退而解析结果文本里的「已出图：<path>」。
       */
      function imagePathOf(block) {
        const meta = block && block.meta
        if (meta && typeof meta.path === 'string' && meta.path.trim() !== '') return meta.path.trim()
        const text = textOf(block)
        const match = /已出图[：:]\s*([^\n（(]+)/u.exec(text)
        return match ? match[1].trim() : null
      }

      /**
       * ★★★ 2026-10-19（用户要求）：**把一次出的多张都取出来**。
       * 优先用 host 经 presentationMeta 传来的 `files`（完整且可靠）；
       * 拿不到就退回单张（老版本后端只有 path）—— 绝不因为字段缺失就不显示图。
       */
      function imagePathsOf(block) {
        const meta = block && block.meta
        const list = meta && Array.isArray(meta.files) ? meta.files.filter((p) => typeof p === 'string' && p !== '') : []
        if (list.length > 0) return list
        const one = imagePathOf(block)
        return one === null ? [] : [one]
      }

      /** ★ 渲染兜底：卡片里任何异常都不许冒出去 —— 冒出去会崩掉 dsh 的那块界面。 */
      function DrawImageCard(props) {
        try {
          return renderCard(props)
        } catch (error) {
          return React.createElement(
            'div',
            { className: 'dshqp-error' },
            `绘图卡片渲染出错：${error && error.message ? error.message : String(error)}`,
          )
        }
      }

      /** 画图卡片：有结果就渲染图，出错显示原文，运行中显示提示。 */
      function renderCard(props) {
        const phase = props && props.phase
        const block = props && props.block

        // ★ 不把 `phase` 当唯一开关：自带 toolview（如 WebRow）压根不看 phase，
        //   只吃 `block`。所以这里只要拿到 block 且能解析出图片路径就直接渲染图，
        //   万一 phase 的取值/传递方式与预期不同，图也不会被"正在画图"遮住。
        if (block !== undefined && block !== null) {
          if (block.isError) {
            const detail = textOf(block) || '未知错误'
            // ★★★ 2026-10-08 二十三次修正：**失败路径也必须收工**。
            //   主人要求「生图时才隐藏思考和调用工具过程，正常工程和对话不隐藏」。
            //   而原来 `flowFinish()` 只在"拿到图片路径"那条分支里被调用 ——
            //   一旦出图**失败 / 超时 / 被中断**，它就跑不到，
            //   `body[data-dshqp-drawing]` 标记会**一直留在 body 上**，
            //   于是"出图期间隐藏思考块"那条 CSS **永久生效** ——
            //   表现出来就是"平时也把思考隐藏了"。
            if (phase === 'result') flowFinish()
            return React.createElement('div', { className: 'dshqp-error' }, `画图失败：${detail}`)
          }
          const paths = imagePathsOf(block)
          const filePath = paths.length > 0 ? paths[0] : null
          // ★ 2026-10-19（用户要求）：开了「用户自选」且确实有多张 → 并排全部显示，
          //   让用户自己比较哪张最好（每张都可点开圈选/放大）。
          if (uiUserPickBest === 'on' && paths.length > 1) {
            if (phase === 'result') flowFinish()
            return React.createElement(
              'div',
              { className: 'dshqp-card' },
              React.createElement(
                'div',
                { className: 'dshqp-grid' },
                ...paths.map((p, i) => React.createElement(
                  'div',
                  { className: 'dshqp-cell', key: `${p}-${i}` },
                  React.createElement('img', {
                    className: 'dshqp-img',
                    src: `api/file?path=${encodeURIComponent(p)}`,
                    alt: `第 ${i + 1} 张`,
                    loading: 'lazy',
                    title: '点一下可以圈选局部重绘',
                    style: { cursor: 'zoom-in' },
                    onClick: () => openInpaintDialog(p),
                  }),
                  React.createElement('div', { className: 'dshqp-idx' }, `${i + 1}`),
                )),
              ),
              React.createElement('div', { className: 'dshqp-name' }, `共 ${paths.length} 张 · 点任意一张可放大/圈选`),
            )
          }
          if (filePath !== null) {
            // ★★★ 2026-10-08 十四次修正：**只在真正拿到结果时才收动画**。
            //   事故：新会话里动画"一闪而过"随即消失 —— 因为 preparing 阶段的
            //   工具参数里**可能已经带着目标路径**，imagePathOf 提前返回了非空值，
            //   flowFinish() 就被立刻调用，动画刚出来就被收掉了。
            //   ✓ 判据改为：phase 明确等于 result 才收；其余阶段（preparing/start）
            //     一律视作"还在生成"，动画继续留着。
            if (phase === 'result') flowFinish()
            const name = filePath.split(/[\\/]/u).pop() || filePath
            return React.createElement(
              'div',
              { className: 'dshqp-card' },
              React.createElement('img', {
                className: 'dshqp-img',
                // 相对 baseURI 解析 → 桌面端 dsh-app://app/api/file?...，Web 端 http://…/api/file?...
                src: `api/file?path=${encodeURIComponent(filePath)}`,
                alt: name,
                loading: 'lazy',
                // ★ 2026-10-19（用户要求）：点图 → 独立浮层里圈选局部重绘。
                //   浮层是**自己的 DOM**，不碰消息树（见 openInpaintDialog 顶部的说明）。
                title: '点一下可以圈选局部重绘',
                style: { cursor: 'zoom-in' },
                onClick: () => openInpaintDialog(filePath),
              }),
              React.createElement('div', { className: 'dshqp-name' }, name),
            )
          }
          // 有 block 但没路径：结果阶段就把文本显示出来，别让这条调用变成空白
          const fallback = textOf(block)
          if (phase === 'result' || fallback !== '') {
            return fallback === ''
              ? null
              : React.createElement('div', { className: 'dshqp-pending' }, fallback)
          }
        }

        // preparing / start：出图要一两分钟，这段时间必须让用户看见「在动」
        // ★ 同时在**聊天流里**放一个 16:9 的大呼吸灯（主人指定：位置就像我发图片出来那样）
        flowStart()
        // ★ 生成中的 RGB 呼吸灯（主人指定）：正方形色块呼吸 + 白色流光从左上扫到右下 + 小字
        return React.createElement(
          'div',
          { className: 'dshqp-loading' },
          React.createElement('div', { className: 'dshqp-lamp' }),
          React.createElement('div', { className: 'dshqp-loading-text' }, '正在生成图片'),
        )
      }

      /* ------------------------------------------- composer 下方的在线状态 ---- */

      /* ══════════ 优化状态徽标（★ 2026-10-09）══════════
       * 主人原话：「在插件界面在用户安装完毕之后自动显示是否已启用优化，
       *   如果没启用请告诉用户原因，比如说出现 bug 或者不通用崩溃了」。
       *
       * 设计：挂在 ComfyUI 状态点**右边**的一个小徽标，三态：
       *   ✓ 优化已启用   → 低调的绿字（默认状态，不该抢注意力）
       *   ⚠ 未启用优化   → 橙色，带下划线，**可点开看原因**
       *   ⏸ 插件已停用   → 灰色
       *
       * ⚠ 为什么不直接常驻一段文字：主人此前**两次**反馈状态行文字太长会把
       *   "推理流光条"挤到第二排（见 describeStatus 的注释）。所以这里：
       *   默认只显示**极短**的徽标，详细原因放在**点击弹出的面板**里。
       */
      const OPT_ID = 'qwen-paint-opt'

      /** 把 host 的 optimization 诊断翻成徽标外观。
       *  ★ 2026-10-09：新增 idle 档 —— ComfyUI 没启动时**不再说"未知"**（见 host 侧说明）。
       *    clickable 直接由 host 的语义决定，不在样式类名里猜。
       *
       *  ★★★ 2026-10-09 修正（主人反馈「你点进去怎么还是那个界面」）：
       *    **`full` 态原先写的是 `clickable: false` —— 那是个逻辑错误。**
       *    优化全启用时恰恰是用户最想确认"到底启用了哪些"的时候，
       *    结果徽标偏偏点不开，只能看到"优化已启用"五个字。
       *    现在统一 `clickable: true`：**任何状态都能点开看明细**，
       *    区别只在面板里显示什么（`full` 时是"四项全绿"，不是"待处理事项"）。
       *
       *    ⚠ `detail` 为 null 时才不可点（那表示 host 真的没给数据，
       *      点了也没内容可显示，还会让人以为界面坏了）。 */
      function describeOptimizationBadge(opt) {
        if (opt === null || typeof opt !== 'object') {
          return { cls: 'qwen-paint-opt-unknown', text: '优化状态未知', detail: null, clickable: false }
        }
        switch (opt.level) {
          case 'disabled':
            return { cls: 'qwen-paint-opt-off', text: '插件已停用', detail: opt, clickable: true }
          case 'full':
            // ★ 改了：可点。文字仍保持低调，不抢注意力。
            return { cls: 'qwen-paint-opt-on', text: '优化已启用', detail: opt, clickable: true }
          case 'turbo':
            return { cls: 'qwen-paint-opt-warn', text: '优化部分启用', detail: opt, clickable: true }
          case 'basic':
            return { cls: 'qwen-paint-opt-warn', text: '未启用优化', detail: opt, clickable: true }
          case 'probe-failed':
            return { cls: 'qwen-paint-opt-warn', text: '优化未确认', detail: opt, clickable: true }
          case 'idle':
            // ComfyUI 没启动 = 正常状态：中性外观 + 可点开说明"待会儿自动就绪"
            return { cls: 'qwen-paint-opt-idle', text: '待启动检测', detail: opt, clickable: true }
          default:
            return { cls: 'qwen-paint-opt-unknown', text: '优化状态未知', detail: opt, clickable: true }
        }
      }

      /* ══════════ 四态渲染表（★ 2026-10-09）══════════
         主人要求：「你点进去就应该是告诉你启用了哪些优化，
           哪些可以启用哪些没启用，哪些不能启用」。
         host 已经把每项标好 `state`，这里只负责**翻译成人话 + 上色**。
         表里五档对应 host 的 state 取值，多一个 `unknown`（探测失败时用）。 */
      const OPT_STATE_VIEW = {
        on: { mark: '\u2713', cls: 'qwen-paint-opt-yes', label: '已启用' },
        available: { mark: '\u2713', cls: 'qwen-paint-opt-can', label: '可启用' },
        off: { mark: '\u2713', cls: 'qwen-paint-opt-can', label: '可启用' },
        blocked: { mark: '\u2715', cls: 'qwen-paint-opt-no', label: '不可启用' },
        unknown: { mark: '?', cls: 'qwen-paint-opt-unk', label: '未确认' },
        // ★ 2026-10-09 二次修正新增：host 的 `superseded`（按尺寸让位）。
        //   它既不是"可启用"（没什么可开的），也不是"不可启用"（小尺寸它真的在生效），
        //   更不是"未确认"（我们完全清楚它在干什么）——必须自成一档。
        //   ⇄ 与 ✓/✕/? 都不同，保证色觉障碍用户也能区分。
        superseded: { mark: '\u21C4', cls: 'qwen-paint-opt-sup', label: '让位（按尺寸）' },
      }

      /** 取某一项该显示的状态视图；state 缺失时按老的 on 布尔兜底。 */
      function optStateView(item) {
        const key = typeof item?.state === 'string'
          ? item.state
          : (item?.on ? 'on' : 'available')
        return OPT_STATE_VIEW[key] ?? OPT_STATE_VIEW.unknown
      }

      /** 记住第一条能用的状态端点，之后不再每条都试。 */
      let statusPath = null

      /** 取 host 的 ComfyUI 状态。失败返回 null（显示"未知"而不是崩）。 */
      async function fetchStatus() {
        const candidates = statusPath === null ? STATUS_PATHS : [statusPath]
        for (const candidate of candidates) {
          try {
            const response = await fetch(candidate, { headers: { accept: 'application/json' } })
            if (!response.ok) continue
            const data = await response.json()
            statusPath = candidate
            return data
          } catch (error) {
            /* 换下一条候选路径 */
          }
        }
        return null
      }

      /**
       * 把 host 的状态翻译成圆点状态 + 一句话。
       *  ★ 2026-10-07 缩短文案：原来「ComfyUI 在线 · 空闲 2 分后自动关闭」约 22 字、200px 宽，
       *    会把同排的推理流光条挤到下一排（主人反馈）。现在压到 9 字以内。
       *
       *  ★★★ 2026-10-09 修正（主人反馈「这个 ComfyUI 未知，说明它的判断太傻了」）：
       *    原先只要拿不到数据就报「ComfyUI 未知」—— 那是**把两种毫不相干的情况
       *    混成了一句废话**：
       *      ① 插件自己的状态端点还没就绪（页面刚加载，host 还没注册完）→ 等一会儿就好；
       *      ② 端点持续不通 → 那是**插件后端**的问题，跟 ComfyUI 一点关系都没有。
       *    两种情况都挂在"ComfyUI 未知"名下，用户当然看不懂。
       *    现在按**连续失败次数**区分，并且只说**能确定的事实**。
       *
       *  ⚠ 另外要强调：**ComfyUI 没在运行是明确状态、不是"未知"** ——
       *    host 侧会正常回 online:false，走下面那条分支显示「未启动」，
       *    本来就不该掉进这个兜底里。
       *
       * @param data host 返回的状态对象；null = **端点没取到**（注意不是"ComfyUI 状态未知"）
       * @param fails 连续取不到的次数
       */
      function describeStatus(data, fails) {
        if (data === null || typeof data !== 'object') {
          return fails >= 3
            ? { state: 'off', label: '插件后端未就绪' }
            : { state: 'off', label: '检测中…' }
        }
        // ★★★ 2026-10-09：**启动失败要优先、明确地报出来**。
        //   主人报的问题：「一直都卡在正在启动」。根因是后端没有任何失败/超时判定（已修），
        //   前端也必须把新状态显示出来 —— 否则修了后端，界面看起来还是老样子。
        //   判定顺序很重要：**失败 > 启动中 > 未启动**。
        if (data.online !== true && data.launchFailed === true) {
          // ★★★ 2026-10-09（主人要求）：**区分两种失败**。
          //   · 有报错原因 → 「ComfyUI 启动失败」+ 原因
          //   · 没有任何报错、纯超时 → 「ComfyUI 启动超时」
          //   （进程活着、没崩、就是 45 秒还没就绪 —— 那是"慢"，不是"坏"；
          //    混为一谈会让用户以为非要去修点什么不可。）
          const isTimeout = data.launchTimedOut === true
          return {
            state: 'off',
            label: isTimeout ? 'ComfyUI 启动超时' : 'ComfyUI 启动失败',
            // 具体原因走 title 提示（状态行本身必须短，见上面的宽度约束）
            error: typeof data.launchError === 'string' ? data.launchError : '',
          }
        }
        if (data.online !== true && data.starting === true) {
          // 带上已等秒数：让用户看得出"它在动"，而不是卡死了
          const sec = Math.round((Number(data.launchElapsedMs) || 0) / 1000)
          return {
            state: 'busy',
            label: sec >= 1 ? `ComfyUI 启动中 ${sec}s` : 'ComfyUI 启动中…',
            error: '',
          }
        }
        // host 说得清清楚楚：ComfyUI 没起来。
        // 插件有能力按需把它拉起来（出图时自动），所以这里用"未启动"而不是"未知"。
        if (data.online !== true) {
          return { state: 'off', label: 'ComfyUI 未启动', error: '' }
        }
        if (data.busy === true) {
          return { state: 'busy', label: 'ComfyUI 出图中' }
        }
        const left = typeof data.idleShutdownInMs === 'number' ? data.idleShutdownInMs : 0
        if (left > 0) {
          return { state: 'on', label: `ComfyUI 空闲${Math.max(1, Math.ceil(left / 60000))}分` }
        }
        // idleShutdownMs <= 0 = 选了"不自动关闭"，这时只显示在线
        return { state: 'on', label: 'ComfyUI 在线' }
      }

      /**
       * 把面板摆到徽标旁边（**fixed 坐标，现算**）。
       *
       * ★ 2026-10-09：面板改成挂 body + fixed 之后，位置不再由 CSS 的 bottom/right
       *   决定，必须自己算 —— 规则与 placeMenu 一致：
       *   · 优先**向上**弹（徽标在 composer 底部，下面通常没空间）；
       *   · 上面塞不下、且下面更宽敞 → 翻到下面；
       *   · 两边都不够就用可用空间 + 面板内部滚动；
       *   · 水平贴徽标左缘，但不许越出视口；
       *   · 量不到尺寸就退到"贴着视口边"，能看永远比位置完美重要。
       */
      function placePanel(panel, el) {
        try {
          if (typeof el.getBoundingClientRect !== 'function') return
          const rect = el.getBoundingClientRect()
          const viewport = Number(window.innerHeight) || 0
          const viewportW = Number(window.innerWidth) || 0
          if (viewport <= 0 || viewportW <= 0) return

          const GAP = 8
          const CEIL = Math.floor(viewport * 0.62) // 最多占屏幕 62%，避免整屏都是面板
          const need = Math.min(Number(panel.scrollHeight) || 0, CEIL)
          const above = rect.top - GAP
          const below = viewport - rect.bottom - GAP
          const down = above < need && below > above
          const room = Math.max(120, down ? below : above)

          panel.style.maxHeight = `${Math.min(room, CEIL, 460)}px`
          const box = typeof panel.getBoundingClientRect === 'function' ? panel.getBoundingClientRect() : null
          const shown = Math.min(box && box.height ? box.height : room, room)
          const width = box && box.width ? box.width : Math.min(360, viewportW - 24)

          panel.style.top = down
            ? `${Math.max(GAP, Math.min(viewport - GAP - shown, rect.bottom + 6))}px`
            : `${Math.max(GAP, rect.top - shown - 6)}px`
          panel.style.left = `${Math.max(GAP, Math.min(rect.left, viewportW - width - GAP))}px`
        } catch (error) {
          /* 摆不对也照样能用 —— 位置永远不该成为打不开面板的理由 */
        }
      }

      /**
       * 渲染「优化状态」徽标 + 点击弹出的原因面板。
       *
       * ★ 2026-10-09 新增（主人要求）：装完插件就该一眼看到优化有没有生效；
       *   没生效必须**能查到原因**，而不是只显示一句"未启用"。
       *
       * @param opt host 状态端点里的 optimization 字段
       * @returns {{el:HTMLElement, update:Function, dispose:Function}}
       */
      function createOptimizationBadge() {
        const el = document.createElement('span')
        el.className = 'qwen-paint-opt qwen-paint-opt-unknown'
        el.textContent = '优化检测中'

        let panel = null
        let outsideHandler = null
        let panelScroll = 0
        // ★ 只在**内容真的变了**时才碰 DOM。状态每 5 秒轮询一次，
        //   每轮都重设 className/textContent 会让浏览器白白重排重绘。
        let lastCls = null
        let lastText = null
        // ★ 最近一次的优化诊断对象（含 detail/stats）—— 供 openDetail 复用。
        //   不用 openPanel 时的临时变量，因为菜单可能在任意时刻来取。
        let lastDetail = null
        // ★ 2026-10-09 新增：面板里"切换某项优化"成功后，通知外层**立刻拉一次状态**，
        //   而不是干等下一次 5 秒轮询 —— 用户点了开关，界面应该马上给反馈。
        //   外层注册（见 createOptimizationBadge 的调用点）；没注册就退回轮询，不报错。
        let onToggleDone = null
        /** 供外层注入"切换完成后立即刷新"的回调。 */
        const setToggleDoneHandler = (fn) => { onToggleDone = typeof fn === 'function' ? fn : null }

        const closePanel = () => {
          // 记住滚动位置，下次打开还原（长内容时体验差别很大）
          if (panel) {
            try { panelScroll = Number(panel.scrollTop) || 0 } catch (error) { panelScroll = 0 }
          }
          if (panel && panel.parentNode) panel.parentNode.removeChild(panel)
          panel = null
          if (outsideHandler) {
            document.removeEventListener('click', outsideHandler, true)
            outsideHandler = null
          }
        }

        /** 组装原因面板：先给"为什么"，再给逐项明细。 */
        /**
         * ★ 2026-10-12：**最近一次状态接口的完整 payload**。
         *
         * 为什么需要它：面板里的「出图存到」那一行要读 `outputDir` / `outputDirSource`，
         * 而这两个字段在**顶层**（`data.outputDir`），**不在** `data.optimization` 里。
         * `openPanel(opt)` 拿到的是 optimization 对象 ⇒ `opt.outputDir` 恒为 undefined，
         * 那一行**永远不会渲染**（这是「自定义输出目录」功能的第二处 bug，
         * 第一处是把 `opt` 误写成 `data` 直接抛 ReferenceError）。
         *
         * 声明在 openPanel **之前**：避免 `let` 的 TDZ（openPanel 可能被更早的路径调用）。
         */
        let payloadNow = null

        const openPanel = (opt) => {
          closePanel()
          panel = document.createElement('div')
          panel.className = 'qwen-paint-opt-panel'

          const h = document.createElement('h4')
          h.textContent = String(opt?.summary ?? '优化状态')
          panel.appendChild(h)

          const reasons = Array.isArray(opt?.reasons) ? opt.reasons : []
          for (const reason of reasons) {
            const p = document.createElement('p')
            p.className = 'qwen-paint-opt-reason'
            p.textContent = String(reason)
            panel.appendChild(p)
          }

          // ★★★ 2026-10-11 新增：**关键能力缺口**（如"缺 UnetLoaderGGUF 节点"）。
          //   这些以前**只写日志、面板上看不到** —— 用户会以为一切正常，直到出图被 ComfyUI 拒收。
          //   与 `reasons` **分开渲染**：reasons 只在"没全部启用"时出现，
          //   而 warnings 是**任何时候都要提醒**的硬缺口（机器明明知道，就该告诉用户）。
          const warnings = Array.isArray(opt?.warnings) ? opt.warnings : []
          for (const w of warnings) {
            const p = document.createElement('p')
            p.className = 'qwen-paint-opt-warning'
            p.textContent = String(w)
            panel.appendChild(p)
          }

          // ★★★ 2026-10-12（用户要求）：**出图存到哪，能看、能改**。
          //   原来 outputDir 只能在 cordis.patch.yml 里改，很多人不知道；现在面板直接给。
          //
          //   ⚠⚠ 2026-10-12 修 bug：这里原先写的是 `data.outputDir` / `data.outputDirSource`
          //     —— **本函数里根本没有 `data`**（参数名是 `opt`，`data` 只存在于
          //     `describeStatus(data, …)` 和轮询回调里）。于是每次打开面板都抛
          //     `ReferenceError: data is not defined`，而面板是**最后才 appendChild** 的
          //     ⇒ **整个优化面板永远打不开**（用户看到的就是"点了没反应"）。
          //     崩溃日志：`client.js:1813 Uncaught ReferenceError: data is not defined`。
          //     教训：`node --check` 查不出这种错（语法合法、只有运行才炸），
          //     所以本文件新增了「面板作用域未声明标识符」的静态回归（见 selftest）。
          const outDir = typeof payloadNow?.outputDir === 'string' ? payloadNow.outputDir : ''
          if (outDir) {
            const box = document.createElement('div')
            box.className = 'qwen-paint-opt-row'
            box.style.cssText = 'flex-wrap:wrap;row-gap:4px;margin:6px 0 8px'
            const lab = document.createElement('span')
            lab.className = 'qwen-paint-opt-yes'
            lab.style.color = 'var(--color-text-secondary)'
            lab.textContent = '出图存到'
            const val = document.createElement('span')
            val.style.cssText = 'flex:1;min-width:220px;word-break:break-all;color:var(--color-text-primary)'
            val.textContent = `${outDir}（${payloadNow?.outputDirSource ?? ''}）`
            const btn = document.createElement('button')
            btn.type = 'button'
            btn.textContent = '改目录'
            btn.title = '换个位置存图。留空 = 恢复默认（桌面/千问1生图）'
            // ★★★ 2026-10-16 修 bug（真实用户反馈原话："改目录这个按钮点了没反馈"）：
            //   原先这里用 `window.prompt` 收输入、`window.alert` 回执 —— 而
            //   **DSH 桌面端会拦这两个**（本文件早先的注释里我自己就写过
            //   "`window.alert` 在某些宿主里会被拦，那时连回执都没有"）。
            //   更糟的是 `window.prompt` 写在 `try` **外面**：它一抛错就冒泡出去，
            //   连 `catch` 都进不去 ⇒ 用户看到的就是"点了完全没反应"。
            //   ⇒ 改为**面板内联输入**：点一下就地长出输入框，回车/点确定提交，
            //     回执显示在同一行内。**全程不依赖任何原生弹窗。**
            btn.addEventListener('click', () => {
              if (box.querySelector('.qwen-paint-outdir-edit')) return // 已在编辑态，别叠第二个
              const edit = document.createElement('span')
              edit.className = 'qwen-paint-outdir-edit'
              edit.style.cssText = 'display:flex;flex-basis:100%;gap:6px;align-items:center;flex-wrap:wrap'
              const inp = document.createElement('input')
              inp.type = 'text'
              inp.value = outDir
              inp.style.cssText = 'flex:1;min-width:180px;padding:2px 6px'
              const ok = document.createElement('button')
              ok.type = 'button'
              ok.textContent = '确定'
              const cancel = document.createElement('button')
              cancel.type = 'button'
              cancel.textContent = '取消'
              const hint = document.createElement('span')
              hint.style.cssText = 'flex-basis:100%;font-size:12px;color:var(--color-text-secondary)'
              hint.textContent = '绝对路径如 D:\\我的图\\千问；或只写文件夹名（放到默认位置下）；留空 = 恢复默认'

              const close = () => {
                try { edit.remove() } catch { /* 已被移除 */ }
                btn.disabled = false
              }
              cancel.addEventListener('click', close)

              const submit = async () => {
                ok.disabled = true
                hint.textContent = '正在应用…'
                hint.style.color = 'var(--color-text-secondary)'
                try {
                  const res = await postStatus({ outputDir: inp.value.trim() })
                  const j = await res.json()
                  const got = j.outputDir ?? outDir
                  const bad = String(j.outputDirSource ?? '').includes('不可用')
                  // ★ 回执**写在行内**，不再用 window.alert（会被宿主拦掉）
                  hint.textContent = bad ? `⚠ 这个目录不可用，仍使用：${got}` : `✓ 已改成：${got}`
                  hint.style.color = bad ? 'var(--color-text-warning, #d97706)' : 'var(--color-text-secondary)'
                  const fresh = await fetch(STATUS_PATHS[0], { cache: 'no-store' })
                    .then((r) => r.json()).catch(() => null)
                  if (fresh && fresh.optimization) {
                    payloadNow = fresh
                    // 稍等一下让用户看清回执，再原地刷新面板（不再 hidePanel，免得像"没反应"）
                    window.setTimeout(() => { try { openPanel(fresh.optimization) } catch { /* 忽略 */ } }, 700)
                  }
                  refreshSoon()
                } catch (e) {
                  hint.textContent = `✗ 修改失败：${String(e?.message ?? e)}`
                  hint.style.color = 'var(--color-text-warning, #d97706)'
                } finally {
                  ok.disabled = false
                }
              }
              ok.addEventListener('click', submit)
              inp.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') { ev.preventDefault(); submit() }
                else if (ev.key === 'Escape') { ev.preventDefault(); close() }
              })

              edit.appendChild(inp)
              edit.appendChild(ok)
              edit.appendChild(cancel)
              edit.appendChild(hint)
              btn.disabled = true
              box.appendChild(edit)
              try { inp.focus(); inp.select() } catch { /* 聚焦失败无所谓 */ }
            })
            box.appendChild(lab)
            box.appendChild(val)
            box.appendChild(btn)
            panel.appendChild(box)
          }

          const detail = Array.isArray(opt?.detail) ? opt.detail : []
          if (detail.length > 0) {
            // ★★★ 2026-10-09：先出一行**总账**（4 项里几项已启用 / 几项能补 / 几项补不了）。
            //   主人要的就是"一眼看清分布"，而不是逐个读四行才知道全貌。
            const stats = opt?.stats
            if (stats && Number(stats.total) > 0) {
              const tally = document.createElement('div')
              tally.className = 'qwen-paint-opt-tally'
              const parts = []
              if (stats.on) parts.push(`${stats.on} 项已启用`)
              const fixable = (Number(stats.available) || 0) + (Number(stats.off) || 0)
              if (fixable) parts.push(`${fixable} 项可启用`)
              if (stats.blocked) parts.push(`${stats.blocked} 项当前不可启用`)
              // ★ 2026-10-09 二次修正：`superseded`（按尺寸让位）必须进总账。
              //   否则默认配置下（blockCacheEnabled=true）total=7 而只报"5 项已启用"，
              //   剩下 2 项被无声吞掉 —— 用户会以为坏了 2 项。
              if (stats.superseded) parts.push(`${stats.superseded} 项按尺寸让位`)
              // ★ 2026-10-11：**可选档**（如 A 卡专属内核/异步卸载，默认关）单独报 ——
              //   不混进"可启用"，否则用户会以为"还差 2 项没配好"。
              //   ★ 再修：必须反映**真实状态** —— 全都关着才说"默认关"；
              //     已经打开了就如实说"已开 N 项"，否则用户开完还看到"默认关"，自相矛盾。
              if (stats.optional) {
                const onN = Number(stats.optionalOn) || 0
                parts.push(onN > 0
                  ? `${stats.optional} 项可选（已开 ${onN} 项）`
                  : `${stats.optional} 项可选（默认关）`)
              }
              if (stats.unknown) parts.push(`${stats.unknown} 项未确认`)
              tally.textContent = `共 ${stats.total} 项：${parts.join(' · ')}`
              panel.appendChild(tally)
            }

            // ★★★ 2026-10-11 新增（主人要求）：「识别是哪个显卡，就把不能用的优化直接隐藏掉」。
            //   藏掉是对的，但**不能静默消失** —— 否则用户会以为"少了一项 = 插件坏了"，
            //   或者压根不知道插件其实认出了他的卡。所以这里如实报：按哪张卡、藏了哪几项。
            const filtered = Array.isArray(opt?.filtered) ? opt.filtered : []
            if (filtered.length > 0) {
              const note = document.createElement('div')
              note.className = 'qwen-paint-opt-filtered'
              const gpuLabel = opt?.gpu?.name ? String(opt.gpu.name) : '当前显卡'
              note.textContent = `已按显卡识别隐藏 ${filtered.length} 项不适用的优化`
                + `（${gpuLabel}）：${filtered.join('、')}`
              panel.appendChild(note)
            }

            const rows = document.createElement('div')
            rows.className = 'qwen-paint-opt-rows'
            for (const item of detail) {
              const view = optStateView(item)

              // 一行 = 状态标记 + 名称 + 状态词。三列固定，
              // 这样四行竖着看下来状态词是对齐的，扫一眼就能比。
              const row = document.createElement('div')
              row.className = `qwen-paint-opt-row qwen-paint-opt-row-${typeof item?.state === 'string' ? item.state : 'unknown'}`

              const mark = document.createElement('span')
              mark.className = `qwen-paint-opt-mark ${view.cls}`
              mark.textContent = view.mark

              const name = document.createElement('span')
              name.className = 'qwen-paint-opt-name'
              name.textContent = String(item?.name ?? '(未命名)')

              const tag = document.createElement('span')
              tag.className = `qwen-paint-opt-tag ${view.cls}`
              tag.textContent = view.label

              row.appendChild(mark)
              row.appendChild(name)
              row.appendChild(tag)
              rows.appendChild(row)

              // ★ "该做什么"单独一行、缩进在名称之下。
              //   这是主人那句「哪些可以启用哪些不能启用」的落点 ——
              //   只说状态不给动作，用户还是不知道下一步；给了动作才是真的能自助修好。
              if (typeof item?.action === 'string' && item.action !== '') {
                const act = document.createElement('div')
                act.className = 'qwen-paint-opt-action'
                act.textContent = `→ ${item.action}`
                rows.appendChild(act)
              }

              // ★★★ 2026-10-09 新增（主人要求）：**可点的开关**。
              //   原话：「BlockCache T8 只显示怎么调，但没提供开关……
              //     请把 BlockCache T8 也改成可以让用户自行开启或关闭的选项。」
              //
              //   注意这里做的**不是**假开关：
              //     · 点下去 → 调 host 的 `?blockcache=on|off` → host 立刻改内存里的
              //       `cfg.blockCacheEnabled` → **下一次出图**就走新链路（当场生效）；
              //     · 但它是内存态，DSH 重载后会回到配置文件的值。
              //       所以按钮下方**必须**同时给出"怎么永久保存"，否则用户会遇到
              //       "我调了、重启又变回去" —— 那正是主人最反感的那种假开关。
              const toggle = item?.toggle
              if (toggle && typeof toggle.key === 'string' && toggle.key !== '') {
                const wrap = document.createElement('div')
                wrap.className = 'qwen-paint-opt-toggle'

                const btn = document.createElement('button')
                btn.type = 'button'
                btn.className = 'qwen-paint-opt-switch'
                  + (toggle.on ? ' is-on' : ' is-off')
                  + (toggle.canToggle === true ? '' : ' is-disabled')
                btn.setAttribute('role', 'switch')
                btn.setAttribute('aria-checked', toggle.on ? 'true' : 'false')
                btn.setAttribute('aria-label', `${item?.name ?? '该项'} 开关`)
                // 缺节点时置灰：切了也没用，不如不给点
                if (toggle.canToggle !== true) btn.disabled = true

                const knob = document.createElement('span')
                knob.className = 'qwen-paint-opt-knob'
                btn.appendChild(knob)

                const txt = document.createElement('span')
                txt.className = 'qwen-paint-opt-switch-text'
                txt.textContent = toggle.on ? '已开启' : '已关闭'

                btn.addEventListener('click', async (event) => {
                  // ⚠ 必须 stopPropagation：面板外面有「点空白处关闭」的 capture 监听，
                  //   不拦的话点开关会顺手把整个面板关掉，用户以为"点了就没了"。
                  event.stopPropagation()
                  if (toggle.canToggle !== true) return
                  const next = !toggle.on
                  btn.disabled = true
                  txt.textContent = '切换中…'
                  try {
                    await postStatus({ [toggle.key]: next ? 'on' : 'off' })
                    // 不本地改状态 —— 由 host 的**权威**新状态决定按钮外观。
                    if (typeof onToggleDone === 'function') onToggleDone()
                    // ★ 2026-10-10 修 bug：原先只调 onToggleDone()，而 `update()` **只改徽标那一行、
                    //   从不重建已打开的面板** ⇒ 按钮永远停在 disabled 的"切换中…"。
                    //
                    // ★★★ 2026-10-12（用户反馈）：「一点它就自动把界面关了」。
                    //   上一版为了绕开"按钮卡在切换中"直接 `closePanel()` —— 结果是
                    //   **用户点一下面板就消失，看不到开关到底变成什么状态**，
                    //   于是以为开关是坏的（主人原话："还是打不开，一点它就自动把界面关了"）。
                    //   现在改成：**重新拉一次权威状态、原地刷新面板** ——
                    //   开关状态当场可见，不用"关了再开"。（`openPanel` 内部会先 closePanel。）
                    const fresh = await fetch('api/qwen-paint/status.json', { cache: 'no-store' })
                      .then((r) => r.json()).catch(() => null)
                    if (fresh && fresh.optimization) {
                      payloadNow = fresh   // 「出图存到」读顶层字段，必须同步更新
                      openPanel(fresh.optimization)
                    } else {
                      closePanel()   // 拉不到就退回老行为，至少不留一个过期面板
                    }
                  } catch (error) {
                    txt.textContent = '切换失败'
                    btn.disabled = false
                  }
                })

                wrap.appendChild(btn)
                wrap.appendChild(txt)

                // 鼠标悬停看详细说明（长文案不进正文，避免把面板撑得很长）
                if (typeof toggle.hint === 'string' && toggle.hint !== '') {
                  wrap.title = toggle.hint
                  const hint = document.createElement('div')
                  hint.className = 'qwen-paint-opt-toggle-hint'
                  hint.textContent = toggle.hint
                  wrap.appendChild(hint)
                }

                // ★ 如实告知"这是运行时开关、重启会还原"—— 并给出永久保存的做法。
                //   宁可多说一句，也不让用户以为改了就一劳永逸。
                if (toggle.canToggle === true) {
                  const persist = document.createElement('div')
                  persist.className = 'qwen-paint-opt-toggle-persist'
                  // ★ 2026-10-12：配置键**从 toggle 里取**，不再写死 blockCacheEnabled
                  //   （原先写死，加第二个开关时会给出错误的"怎么永久保存"指引）。
                  const persistKey = typeof toggle.persistKey === 'string' && toggle.persistKey !== ''
                    ? toggle.persistKey : 'blockCacheEnabled'
                  persist.textContent = '即时生效；要永久保存：在测试机的 cordis.patch.yml 里'
                    + `把 ${persistKey} 写成 ${toggle.on ? 'true' : 'false'}，重启 DSH 后依然保留。`
                  wrap.appendChild(persist)
                }

                rows.appendChild(wrap)
              }
            }
            panel.appendChild(rows)

            // ★★★ 2026-10-14（「专业卡版」）：**档位 + 权重**两组"配置选择"控件。
            //   单独一栏 —— 它们不是"优化点开关"（没有开/关，永远有一个当前值），
            //   而是**配置选择**，所以与上面的优化明细分开渲染，也不进总账。
            //   两组共用同一套渲染（只是标题不同）。
            const configSections = [
              { title: '档位（性能 / 精度 / 文本控制）', note: opt?.tierNote, items: opt?.tiers },
              { title: '权重（主模型 / LoRA / ControlNet）', note: '', items: opt?.weights },
            ]
            // ★ 2026-10-14（C3）：**动态下拉**的选项来自 `/api/qwen-paint/capabilities`
            //   （状态体有"不含模型名"的底线，所以文件清单走 caps 端点）。
            //   只在真有动态项时才拉，且**整个面板只拉一次**。
            const allConfigItems = configSections.flatMap((s) => (Array.isArray(s.items) ? s.items : []))
            const capsPromise = allConfigItems.some((t) => t.dynamic === true)
              ? fetch('api/qwen-paint/capabilities', { cache: 'no-store' })
                .then((r) => r.json()).then((j) => j?.caps ?? null).catch(() => null)
              : Promise.resolve(null)
            /** 动态下拉的填充任务（caps 回来后统一填）。 */
            const dynamicFills = []

            for (const sec of configSections) {
              const list = Array.isArray(sec.items) ? sec.items : []
              if (list.length === 0) continue
              const tsec = document.createElement('div')
              tsec.className = 'qwen-paint-opt-tiers'
              const th = document.createElement('div')
              th.className = 'qwen-paint-opt-tiers-title'
              th.textContent = sec.title
              tsec.appendChild(th)
              if (typeof sec.note === 'string' && sec.note !== '') {
                const tn = document.createElement('div')
                tn.className = 'qwen-paint-opt-tiers-note'
                tn.textContent = sec.note
                tsec.appendChild(tn)
              }
              for (const t of list) {
                const wrap = document.createElement('div')
                wrap.className = 'qwen-paint-opt-toggle'
                const label = document.createElement('div')
                label.className = 'qwen-paint-opt-tiers-label'
                label.textContent = String(t.name ?? t.key ?? '')
                wrap.appendChild(label)

                // 组装选项：静态项用自带的 options；动态项**先占位**，
                // 等 caps 拉回来后异步填充（openPanel 不是 async，不能用 await）。
                let options = Array.isArray(t.options) ? t.options.slice() : []
                let current = t.value
                let nowText = typeof t.now === 'string' ? t.now : ''

                const sel = document.createElement('select')
                sel.className = 'qwen-paint-opt-select'
                sel.setAttribute('aria-label', `${t.name ?? '该项'} 档位`)
                if (t.canToggle !== true) sel.disabled = true
                for (const o of options) {
                  const op = document.createElement('option')
                  op.value = String(o.value)
                  op.textContent = String(o.label ?? o.value)
                  if (String(o.value) === String(current)) op.selected = true
                  sel.appendChild(op)
                }
                const nowEl = document.createElement('div')
                nowEl.className = 'qwen-paint-opt-toggle-hint'
                nowEl.textContent = nowText

                if (t.dynamic === true) {
                  const ph = document.createElement('option')
                  ph.value = ''
                  ph.textContent = '（载入中…）'
                  sel.appendChild(ph)
                  sel.value = ''
                  dynamicFills.push({ t, sel, nowEl })
                }
                sel.addEventListener('click', (event) => event.stopPropagation())
                sel.addEventListener('change', async (event) => {
                  event.stopPropagation()
                  if (t.canToggle !== true) return
                  sel.disabled = true
                  try {
                    await postStatus({ [t.key]: sel.value })
                    // 不本地猜状态 —— 拉权威状态原地刷新（与开关同一套做法）
                    const fresh = await fetch('api/qwen-paint/status.json', { cache: 'no-store' })
                      .then((r) => r.json()).catch(() => null)
                    if (fresh && fresh.optimization) {
                      payloadNow = fresh
                      openPanel(fresh.optimization)
                    } else {
                      closePanel()
                    }
                  } catch (error) {
                    sel.disabled = false
                  }
                })
                wrap.appendChild(sel)

                if (nowText !== '') nowEl.textContent = nowText
                wrap.appendChild(nowEl)
                if (typeof t.hint === 'string' && t.hint !== '') wrap.title = t.hint
                tsec.appendChild(wrap)
              }
              panel.appendChild(tsec)
            }

            // ★ 2026-10-14（C3）：caps 回来后填充动态下拉（选项 = 真实文件；当前值 = 覆写值）。
            if (dynamicFills.length > 0) {
              capsPromise.then((caps) => {
                const keyMap = { main: ['unet', 'unetGguf'], lora: ['lora'], controlnet: ['controlnet'] }
                for (const { t, sel, nowEl } of dynamicFills) {
                  const keys = keyMap[t.sourceKey] ?? [t.sourceKey]
                  const files = []
                  for (const k of keys) {
                    for (const f of (caps?.files?.[k] ?? [])) files.push(String(f))
                  }
                  const over = String(caps?.overrides?.[t.sourceKey] ?? '')
                  const NONE = { value: '', label: '（不指定，用插件自动挑的）' }
                  const opts = [NONE, ...files.map((f) => ({ value: f, label: f }))]
                  // 覆写值不在清单里时**也要列出来**，否则下拉会静默跳到别的值（= 骗人）
                  if (over !== '' && !files.includes(over)) opts.push({ value: over, label: `${over}（已失效）` })
                  sel.textContent = ''
                  for (const o of opts) {
                    const op = document.createElement('option')
                    op.value = String(o.value)
                    op.textContent = String(o.label ?? o.value)
                    sel.appendChild(op)
                  }
                  sel.value = over
                  if (over !== '' && files.length > 0 && !files.includes(over)) {
                    nowEl.textContent = `⚠ 你选了「${over}」，但它**不在 ComfyUI 的清单里** → 本次**未采纳**（用的是自动挑的那个）。`
                  } else if (files.length === 0) {
                    nowEl.textContent = '⚠ 没探测到可选文件（请确认 ComfyUI 在运行、且 models 目录里有对应权重）。'
                  } else {
                    nowEl.textContent = `可选 ${files.length} 个文件`
                  }
                }
              })
            }
          }

          const hint = document.createElement('div')
          hint.className = 'qwen-paint-opt-hint'
          // ★ 2026-10-09：措辞跟着状态走。全绿时提示"还能装什么"，
          //   有缺口时提示"想细查就走工具" —— 别让全绿的用户收到一条故障向的提示。
          const statsForHint = opt?.stats
          hint.textContent = (opt?.ok === true && statsForHint && statsForHint.on === statsForHint.total)
            ? '四项优化全部生效。想进一步压时间可考虑「厂商专用加速包」，'
              + '可在对话里让助手调用 check_acceleration 工具查看。'
            : '想了解完整细节，可在对话里让助手调用 check_acceleration 工具。'
          panel.appendChild(hint)

          // ★★★ 2026-10-09 修正：**挂到 body**（不再挂座位）。
          //   原来挂在座位里，面板会被 composer 祖先的 overflow 裁掉一半 ——
          //   主人报的"只显示了一半"就是这个。挂 body 后与祖先裁剪彻底无关。
          //   ⚠ 必须先挂进 DOM 再量尺寸，否则 getBoundingClientRect 全零、定位会算错。
          const host = document.body ?? document.documentElement
          host.appendChild(panel)
          placePanel(panel, el)

          // 恢复上次的滚动位置：面板内容较长时，每次点开都跳回顶部很烦人
          try { panel.scrollTop = panelScroll } catch (error) { /* 忽略 */ }

          // 点面板外面就关掉（capture 阶段，避免被别的处理器吞掉）
          outsideHandler = (event) => {
            if (panel && !panel.contains(event.target) && event.target !== el) closePanel()
          }
          setTimeout(() => {
            if (outsideHandler) document.addEventListener('click', outsideHandler, true)
          }, 0)
        }

        const update = (opt) => {
          const view = describeOptimizationBadge(opt)
          // ★ 值没变就**直接返回**，一个 DOM 属性都不碰。
          //   状态是 5 秒一次轮询的，若每轮都重设 className/textContent，
          //   浏览器会持续做无谓的样式重算 + 重绘（纯浪费，尤其在笔记本上）。
          if (view.cls === lastCls && view.text === lastText) return
          lastCls = view.cls
          lastText = view.text
          // ★★★ 2026-10-09：把最近一次 detail 存下来 —— 菜单里点「优化」时要复用
          //   （见下方 openDetail）。**不重新算**，避免两处渲染算出不同结果。
          lastDetail = view.detail
          el.className = `qwen-paint-opt ${view.cls}`
          el.textContent = view.text
          // 能不能点，由 host 给的语义字段决定 —— 不再靠样式类名去猜
          const clickable = Boolean(view.detail) && view.clickable === true
          el.style.cursor = clickable ? 'pointer' : 'default'
          if (clickable) {
            el.onclick = (event) => {
              event.stopPropagation()
              if (panel) closePanel()
              else openPanel(view.detail)
            }
          } else {
            el.onclick = null
          }
          el.setAttribute('title', view.detail?.summary ?? view.text)
        }

        /** ★★★ 2026-10-09 新增：供**外部入口**（设置菜单里的「优化」项）打开同一个详情面板。
         *
         *  为什么不让菜单自己去造面板：两套渲染必然逐渐走样，
         *  用户会看到"徽标点开"和"菜单点开"不一样 —— 那是最糟的一类 bug。
         *  这里直接复用 `openPanel` + `lastDetail`，**单一数据源、单一渲染路径**。
         *
         *  @returns {boolean} 是否成功打开（false = 还没拿到数据，调用方据此给提示）
         */
        const openDetail = () => {
          if (!lastDetail) return false
          closePanel()
          openPanel(lastDetail)
          return true
        }

        /** ★★★ 2026-10-09 新增：一句轻量提示（挂在座位旁边，2.6 秒自动消失）。
         *
         *  用途：菜单里点了「优化」但数据还没拉回来 —— 总得让用户知道为什么没反应。
         *  ⚠ 刻意**不复用 openPanel**：那面板是给"有内容"用的，
         *    拿它显示一句"请稍候"会撑出一个空壳面板，看着像坏了。
         */
        const setNotice = (message) => {
          try {
            const note = document.createElement('div')
            note.className = 'qwen-paint-opt-notice'
            note.textContent = String(message)
            const host = document.body ?? document.documentElement
            host.appendChild(note)
            // 定位到徽标下方（与详情面板同一套定位思路，不依赖祖先 overflow）
            placePanel(note, el)
            setTimeout(() => {
              try { if (note.parentNode) note.parentNode.removeChild(note) } catch (error) { /* 忽略 */ }
            }, 2600)
          } catch (error) {
            /* 提示失败不影响任何功能 —— 绝不让它把点击流程带崩 */
          }
        }

        return {
          el,
          update,
          dispose: closePanel,
          openDetail,
          setNotice,
          setToggleDoneHandler,
          // ★ 2026-10-10 修 bug：原有一行 `get current() { return current }`，
          //   而本作用域内**根本没有 `current` 这个变量** —— 是个延迟抛错的 getter
          //   （谁读它谁炸 ReferenceError）。当前无人读，属潜伏缺陷，直接删掉。
          /** 最近一次的诊断详情（供外部只读取用；等价于内部 lastDetail）。 */
          get current() { return lastDetail },
        }
      }


      /**
       * 把状态指示器挂进座位。**纯 DOM** —— 与 dsh-reasoning-glow 同一套路：
       * React 只负责渲染座位，内容与轮询都在这里，不依赖 React 的重渲染。
       * @returns 清理函数（卸载时停轮询、清空座位）
       */
      function mountStatus(seat) {
        const dot = document.createElement('span')
        dot.className = 'dshqp-dot'
        const label = document.createElement('span')
        label.textContent = 'ComfyUI 检测中…'
        seat.appendChild(dot)
        seat.appendChild(label)
        // ★ 2026-10-09：优化状态徽标，紧跟在 ComfyUI 状态后面
        const optBadge = createOptimizationBadge()
        seat.appendChild(optBadge.el)

        // ★ 2026-10-09：面板里切换某项优化成功后 → **立刻**重拉一次状态，
        //   不等下一次 5 秒轮询。用户点了开关，界面要马上给反馈。
        //   （`poll` 定义在下面，用函数声明提升不行 —— 它是 const，
        //     所以这里包一层箭头函数，等真正被调用时才解析 `poll`。
        //     这个回调只在用户点击后触发，那时 `poll` 一定已经初始化完毕。）
        if (typeof optBadge.setToggleDoneHandler === 'function') {
          optBadge.setToggleDoneHandler(() => {
            try { poll() } catch (error) { /* 刷新失败不影响开关本身 */ }
          })
        }

        let stopped = false
        let timer = null

        // ★★ 主人 2026-10-08：「画图时 ComfyUI 生图中旁边不是一个小黄点，而你发布页说的小黄点，
        //   把插件改成小黄点」。
        //   原来出图时会把圆点换成"迷你流光灯"（18px 彩色呼吸块），和 README 里写的
        //   「🟡 黄 = 正在出图」对不上 —— 现在**就是那个黄点**：
        //   圆点始终 8px，出图时 data-state="busy" 走上面的黄底 + 光晕规则，不再换类。
        /**
         * 画状态点。
         * ★ 2026-10-09：值没变就**不碰 DOM** —— 状态是 5 秒一轮询的，
         *   每轮都重设 attribute/textContent 会让浏览器持续做无谓的样式重算与重绘。
         *   这类"每 5 秒一次的小浪费"累积起来，正是笔记本上白掉的电。
         */
        let lastPaint = null
        const paint = (view) => {
          if (stopped) return
          const err = typeof view.error === 'string' ? view.error : ''
          const key = `${view.state}|${view.label}|${err}`
          if (key === lastPaint) return
          lastPaint = key
          dot.setAttribute('data-state', view.state)
          label.textContent = view.label
          // ★ 启动失败时把**具体原因**挂到 title 上 —— 鼠标悬停即可看到 exit code 与错误原文。
          //   状态行本身必须保持简短（宽度约束见 describeStatus 说明），所以原因走这里。
          seat.setAttribute('title', err !== '' ? `${view.label}：${err}` : view.label)
        }

        // ★★ 2026-10-07 新增：点状态点弹出「多久没出图就自动关掉后端」的选项。
        //   调 host 的 `?idleMinutes=N`（N = 0 表示不自动关闭），选完立刻重新拉一次状态。
        const IDLE_CHOICES = [
          { minutes: 0, text: '不自动关闭' },
          { minutes: 1, text: '1 分钟后关闭' },
          { minutes: 5, text: '5 分钟后关闭（默认）' },
          { minutes: 10, text: '10 分钟后关闭' },
          { minutes: 30, text: '30 分钟后关闭' },
        ]

        /**
         * ★★★ 2026-10-09 新增（主人要求）：「生图判断」四档。
         *
         * 主人原话：「不是你这个档位写是写进去的，但是你倒是给人家在界面上一个选择的按键呀」
         * —— 四档策略此前只存在于配置文件和提示词里，用户在界面上根本够不着。
         *
         * ⚠ ids 必须和 host 的 DRAW_INTENT_MODES 键**完全一致**
         *   （包内自测里有一条专门比对两边集合，改名时两边一起改）。
         */
        const TRIGGER_CHOICES = [
          { id: 'off', text: '只在点名时画' },
          { id: 'strict', text: '明确要求才画' },
          { id: 'auto', text: '自动判断（默认）' },
          { id: 'eager', text: '沾边就画' },
        ]
        // ★★★ 2026-10-12（预设工作流）：出图风格预设选项。
        //   只影响画幅（在用户没显式传尺寸时）；壁纸 16:9、人像/动漫 3:4、默认 1:1。
        const PRESET_CHOICES = [
          { id: 'default', text: '默认（1:1）' },
          { id: 'portrait', text: '人像（3:4）' },
          { id: 'anime', text: '动漫插画（3:4）' },
          { id: 'wallpaper', text: '壁纸（16:9）' },
        ]
        let menu = null

        /* ★ 2026-10-08：当前生效的档位（分钟）。菜单里的高亮就是拿它比对出来的。
           null = 还没拉到状态，这时菜单先不点亮，等轮询回来由 syncMenuHighlight 补上。 */
        let idleNow = null
        // ★★★ 2026-10-12：当前出图预设（界面菜单设的，经 ?preset= 下发给后端）。
        let presetNow = 'default'
        /* ★★★ 2026-10-19（用户要求）：抽卡「挑图」两个开关 —— **由用户自己决定是否启用**。
           ① `aibest`  AI 挑图：AI 用 read_image 逐张看，挑一张推荐（描述由 host 按开关拼）；
           ② `userbest` 用户自选：面板把多张并排显示，用户自己点开看哪张最好。
           两者可同时开；默认都关 ⇒ 与升级前行为完全一致。 */
        const PICK_CHOICES = [
          { id: 'off', text: '关闭（默认）' },
          { id: 'on', text: '开启' },
        ]
        let aiBestNow = 'off'
        let userBestNow = 'off'

        /* ★★★ 2026-10-09：最新一次拿到的优化诊断（与徽标同源）。
           菜单里那栏「优化」靠它显示状态文字；点开时也把**同一个对象**喂给详情面板，
           保证菜单与徽标永远说的是同一件事。null = 还没拉到状态。 */
        let optNow = null

        /** 菜单里「优化」那一项的文字 —— 直接报分布，省得用户非点进去才知道。
         *  ★ 没拿到状态时说"查看优化状态"而不是硬编一个状态词：
         *    编一个"未启用"会让人误以为真的没启用，而那只是"还没拉回来"。 */
        const optMenuText = () => {
          const s = optNow?.stats
          if (!optNow || !s || !Number(s.total)) return `查看优化状态（${optNow?.summary ?? '检测中'}）`
          const bits = [`${s.on}/${s.total} 已启用`]
          // ★ 2026-10-09 二次修正：`superseded`（按尺寸让位）必须报出来 ——
          //   否则默认配置下（blockCacheEnabled=true）菜单只显示"5/7 已启用"，
          //   用户会以为缺了 2 项，其实那 2 项在小尺寸是生效的。
          if (s.superseded) bits.push(`${s.superseded} 让位`)
          const fixable = (Number(s.available) || 0) + (Number(s.off) || 0)
          if (fixable) bits.push(`${fixable} 可启用`)
          if (s.blocked) bits.push(`${s.blocked} 不可启用`)
          if (s.unknown) bits.push(`${s.unknown} 未确认`)
          return `优化状态：${bits.join(' · ')}`
        }

        /* ★★★ 2026-10-09：后端在线状态 + 是否正在启动。
           菜单里的「启动 ComfyUI」按这两个值决定文案与可用性：
           已经在线就置灰（写"已在运行"），点过启动还没起来就写"正在启动…"。 */
        let onlineNow = false
        let startingNow = false
        /* ★★★ 2026-10-09 补：本地"启动中"的**兜底收口**。
           为什么必须加：后端状态端点在某些环境里根本注册不上（例如插件装在
           desktop profile 时，宿主不提供 webServer 服务 → 路由永不注册）。
           这时轮询永远拿不到有效 data，`startingNow` 就再也没人更新 ——
           于是按钮**永远显示"正在启动…"**，正是主人反复看到的"一直卡在启动中"。
           解法：点启动时记下时间，超过 START_GIVEUP_MS 还没确认在线，
           就**自行收口**（不再假装还在启动），让按钮回到可点的"启动 ComfyUI"。 */
        let startRequestedAt = 0
        /** 本地"启动中"最多撑多久就自行放弃（毫秒）。比后端 45 秒超时略长，留足余量。 */
        const START_GIVEUP_MS = 60000
        /* ★ 2026-10-09：启动失败状态 + 失败原因 —— 菜单里要据此显示「重试」和错误详情。 */
        let launchFailed = false
        let launchError = ''
        /** ★ 2026-10-09：纯超时（无报错）vs 报错退出 —— 菜单文案据此区分。 */
        let launchTimedOut = false
        /** 当前已等待的启动秒数（显示在"启动中 Ns"里）。 */
        let launchElapsedMs = 0
        /* ★ 2026-10-09：当前生效的「生图判断」档位（null = 还没拉到状态）。 */
        let triggerNow = null

        /* ★ 2026-10-08 主人要求：配置菜单打开后，点界面任意空白处就消失。
           为什么用**捕获阶段**：打开菜单的那一次点击同样会走到 document，
           冒泡阶段的监听会"刚打开就被自己关掉"；捕获阶段跑在 seat 的 toggleMenu 之前，
           那一刻 menu 还是 null，天然不会误关。
           为什么整个 seat 区域都放行：点状态点本身要能"再点一次收起"，
           这件事交给 toggleMenu 自己管，否则会出现"关掉又立刻打开"。 */
        const onDocClick = (event) => {
          if (menu === null) return
          const target = event.target
          // 座位区域放行（"点状态点自己 = 再点一次收起"交给 toggleMenu 管，否则会关了又立刻打开）
          if (target && seat.contains && seat.contains(target)) return
          // ★ 菜单现在挂在 body 上、**不再是座位的子元素**，所以要单独放行 ——
          //   不然点菜单项会被当成"点外面"：捕获阶段先把菜单关掉，手感就是"点一下没反应"。
          if (target && menu.contains && menu.contains(target)) return
          closeMenu()
        }
        const closeMenu = () => {
          if (menu === null) return
          try { menu.remove() } catch (error) { /* 已被移除 */ }
          menu = null
          // 菜单没了就把"点空白处消失"的监听摘掉 —— 它只在菜单活着的时候挂着。
          document.removeEventListener('click', onDocClick, true)
        }

        /** 按当前选择刷新勾选高亮（菜单没开就什么都不做）。
         *  两组各按自己的"当前值"比对：自动关闭比分钟数，生图动画比 id。 */
        const syncMenuHighlight = () => {
          if (menu === null) return
          for (const item of menu.children) {
            const kind = typeof item.getAttribute === 'function' ? item.getAttribute('data-kind') : null
            if (kind === null) continue // 分组标题没有 data-kind
            const value = item.getAttribute('data-value')
            // ★ 2026-10-09：新增 trigger 类型（生图判断档位）的高亮比对
            const on = kind === 'idle'
              ? Number(value) === idleNow
              : kind === 'trigger' ? value === triggerNow
              : kind === 'preset' ? value === presetNow
              : kind === 'aibest' ? value === aiBestNow
              : kind === 'userbest' ? value === userBestNow
              : value === flowStyleNow
            if (on) item.setAttribute('data-current', '1')
            else item.removeAttribute('data-current')
          }
        }

        const pickIdle = (minutes) => {
          const base = statusPath === null ? STATUS_PATHS[0] : statusPath
          postStatus({ idleMinutes: minutes })
            // ★ 只在这时才认下新档位：请求失败就保持原值，不让高亮说谎。
            .then(() => { if (!stopped) { idleNow = minutes; poll() } })
            .catch(() => { /* 失败就保持原样，下次轮询会纠正显示 */ })
        }

        /** 点「生图动画」里的一项：写进 host（host 会落盘，重启后记得住），
         *  同样只在请求成功后才认新值，并立刻重画菜单高亮。 */
        const pickFlow = (id) => {
          const base = statusPath === null ? STATUS_PATHS[0] : statusPath
          postStatus({ flowStyle: id })
            .then(() => { if (!stopped) { flowStyleNow = id; poll() } })
            .catch(() => { /* 失败就保持原样，下次轮询会纠正显示 */ })
        }

        /**
         * ★★★ 2026-10-09 新增：切换「生图判断」档位。
         *
         * host 会把选择**立刻落盘**（重启也记得住），但真正影响模型的是
         * systemPrompt 段落 —— 那是插件**加载时**注册的静态文本，
         * 所以提示词要重载插件才换。这不是偷懒，是注册机制的固有约束；
         * 界面上那组标题已写明"重载后生效"，免得用户以为选了个坏的。
         */
        const pickTrigger = (id) => {
          const base = statusPath === null ? STATUS_PATHS[0] : statusPath
          postStatus({ drawTrigger: id })
            .then(() => { if (!stopped) { triggerNow = id; poll() } })
            .catch(() => { /* 失败就保持原样，下次轮询会纠正显示 */ })
        }

        /** ★ 2026-10-19：抽卡「AI 挑图」开关 —— 与 flowStyle 同一套（成功才认新值）。 */
        const pickAiBest = (id) => {
          postStatus({ aiPickBest: id })
            .then(() => { if (!stopped) { aiBestNow = id; poll() } })
            .catch(() => { /* 失败就保持原样，下次轮询会纠正显示 */ })
        }

        /** ★ 2026-10-19：抽卡「用户自选」开关。 */
        const pickUserBest = (id) => {
          postStatus({ userPickBest: id })
            .then(() => { if (!stopped) { userBestNow = id; poll() } })
            .catch(() => { /* 失败就保持原样，下次轮询会纠正显示 */ })
        }

        /**
         * ★★★ 2026-10-12（预设工作流）：点预设 → 经 ?preset= 下发给后端。
         *   与 flowStyle 同一套：请求成功才认新值并刷新高亮；不覆盖用户显式尺寸。
         */
        const setPreset = (id) => {
          const base = statusPath === null ? STATUS_PATHS[0] : statusPath
          postStatus({ preset: id })
            .then(() => { if (!stopped) { presetNow = id; poll() } })
            .catch(() => { /* 失败就保持原样，下次轮询会纠正显示 */ })
        }

        /**
         * ★★★ 2026-10-12（首次使用向导）：弹一个清单面板，逐项报告就绪状态。
         *   数据来自独立端点 /api/qwen-paint/wizard（host 基于 ComfyUI 真实返回现算，
         *   **不**塞进每 5 秒轮询的状态体 —— 状态体硬底线是"不含本地路径/模型名"）。
         *   清单里每一项都带"缺失时怎么修"，非阻塞、可关。
         */
        const runWizard = () => {
          const base = statusPath === null ? STATUS_PATHS[0] : statusPath
          const wizardUrl = base.replace(/status\.json$/u, 'wizard')
          const lines = ['首次使用向导 · 就绪清单', '（正在获取…）']
          if (typeof showNotice === 'function') showNotice(lines.join('\n'))
          else if (typeof alert === 'function') alert(lines.join('\n'))
          fetch(wizardUrl, { headers: { accept: 'application/json' } })
            .then((r) => r.json())
            .then((w) => {
              const out = ['首次使用向导 · 就绪清单']
              if (!w || w.ok !== true) out.push('（清单获取失败，稍后再点一次）')
              else {
                if (!w.online) out.push('① ComfyUI 后端：未在线 —— 先点「启动 ComfyUI」或手动启动。')
                else out.push('① ComfyUI 后端：✓ 已在线')
                for (const s of (w.steps || [])) {
                  if (s.id === 'comfy') continue
                  out.push(`${s.ok ? '✓' : '✗'} ${s.label} —— ${s.detail}`)
                }
                if (w.allReady) out.push('\n全部就绪，直接让我画一张试试吧。')
                else out.push('\n按上面的指引补齐后，重开本菜单点「首次使用向导」复查。')
              }
              if (typeof showNotice === 'function') showNotice(out.join('\n'))
              else if (typeof alert === 'function') alert(out.join('\n'))
            })
            .catch((err) => {
              const msg = `首次使用向导获取失败：${err?.message ?? err}`
              if (typeof showNotice === 'function') showNotice(msg)
              else if (typeof alert === 'function') alert(msg)
            })
        }

        /**
         * ★★★ 2026-10-12（确认式一键修复）：先预览、再确认执行。
         *   这里直接带 confirm=true 调后端修复端点（只做可逆/无害动作）。
         */
        const runRepairNow = () => {
          const base = statusPath === null ? STATUS_PATHS[0] : statusPath
          fetch(`${base.replace(/status\.json$/u, 'repair')}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ confirm: true }),
          })
            .then((r) => r.json())
            .then((data) => {
              const ok = data && data.ok === true
              const done = (data && data.done) || []
              const lines = ['一键修复 · 结果', ok ? (data.summary || '') : (data.reason || '失败')]
              for (const d of done) lines.push(`${d.ok ? '✓' : '✗'} ${d.id}${d.error ? `：${d.error}` : ''}`)
              if (typeof showNotice === 'function') showNotice(lines.join('\n'))
              else if (typeof alert === 'function') alert(lines.join('\n'))
            })
            .catch((err) => {
              const msg = `一键修复请求失败：${err?.message ?? err}`
              if (typeof showNotice === 'function') showNotice(msg)
              else if (typeof alert === 'function') alert(msg)
            })
        }

        /**
         * ★★★ 2026-10-09 新增：点「启动 ComfyUI」—— 让 host 立刻把后端拉起来。
         *
         * 为什么要这个按钮（主人原话）：「你没有这个按钮，人家难不成还要跑去手动打开吗？」
         * 是的 —— 在那之前，用户想立刻用只能干等到下次出图，或者自己跑去手动开。
         *
         * host 那边**不阻塞响应**（拉起要几十秒），所以这里：
         *   ① 立刻把本地状态显示成"启动中…"，给用户即时反馈；
         *   ② 稍后主动 poll 一次，之后交给常规的 5 秒轮询。
         */
        const startComfy = () => {
          const base = statusPath === null ? STATUS_PATHS[0] : statusPath
          // 重试 = 把上一次的失败痕迹清掉，否则界面会一直挂着旧错误
          startingNow = true
          startRequestedAt = Date.now()   // ← 兜底收口的计时起点（见上方注释）
          launchFailed = false
          launchTimedOut = false
          launchError = ''
          launchElapsedMs = 0
          paint({ state: 'busy', label: 'ComfyUI 启动中…', error: '' })
          postStatus({ start: 1 })
            .then(() => {
              if (stopped) return
              // 拉起通常十几秒到几十秒：先等一会儿再问，避免问到"还没起来"就误判成失败
              setTimeout(() => { if (!stopped) poll() }, 3000)
            })
            .catch(() => {
              if (stopped) return
              startingNow = false
              paint(describeStatus(null, statusFails))
            })
        }

        /** 往菜单里添一组：一个标题 + 若干条目。
         *  sub = true 时是**子标题**（更小更淡、不带上面的分隔线，用在「流光 · 抄自月匠」）。 */
        const addGroup = (title, entries, sub) => {          const head = document.createElement('div')
          head.className = sub === true ? 'dshqp-menu-head dshqp-menu-sub' : 'dshqp-menu-head'
          head.textContent = title
          menu.appendChild(head)
          for (const entry of entries) {
            const item = document.createElement('button')
            item.type = 'button'
            item.className = 'dshqp-menu-item'
            item.setAttribute('data-kind', entry.kind)
            item.setAttribute('data-value', String(entry.value))
            // 流光给一个预览小色块：不用真去生一张图，就能看出自己选的是什么颜色
            if (entry.swatch !== undefined) {
              const dot = document.createElement('span')
              dot.className = `dshqp-menu-swatch dshqp-menu-swatch-${entry.swatch}`
              item.appendChild(dot)
            }
            // 名字前面的小圆点（主人要求：给"流星"标一个点，表示它是自制的那个）
            if (entry.bullet === true) {
              const mark = document.createElement('span')
              mark.className = 'dshqp-menu-bullet'
              item.appendChild(mark)
            }
            const label = document.createElement('span')
            label.textContent = entry.text
            item.appendChild(label)
            // 名字后面的来源小标签（自制 / …）
            if (entry.tag !== undefined) {
              const tag = document.createElement('span')
              tag.className = 'dshqp-menu-tag'
              tag.textContent = entry.tag
              item.appendChild(tag)
            }
            // ★ 2026-10-09：不可用的条目（例如已经在线时的「启动 ComfyUI」）
            //   置灰且不响应点击 —— 让人能看出"这一项现在没意义"，
            //   而不是点了没反应、以为坏了。
            if (entry.muted === true) {
              item.disabled = true
              item.style.opacity = '.45'
              item.style.cursor = 'default'
            } else {
              item.addEventListener('click', (event) => {
                event.stopPropagation()
                closeMenu()
                if (entry.kind === 'idle') pickIdle(entry.value)
                else if (entry.kind === 'start') startComfy()
                else if (entry.kind === 'trigger') pickTrigger(entry.value)
                else if (entry.kind === 'opt') openOptDetail()
                else if (entry.kind === 'preset') setPreset(entry.value)
                else if (entry.kind === 'aibest') pickAiBest(entry.value)
                else if (entry.kind === 'userbest') pickUserBest(entry.value)
                else if (entry.kind === 'wizard') runWizard()
                else if (entry.kind === 'repair') runRepairNow()
                else pickFlow(entry.value)
              })
            }
            menu.appendChild(item)
          }
        }

        /**
         * ★★★ 2026-10-09 新增（主人要求）：加一条**区块分隔线**。
         *
         * 主人原话：「这些你和下面的颜色选择要区分出来啊，这是给用户调整功能的」
         * —— 菜单里其实是**两类东西**混在一起平铺：
         *   · 功能区：后端 / 自动关闭 / 生图判断（改行为）
         *   · 外观区：生图动画 / 流光配色（改长相，纯审美）
         * 五组标题同一个样式，用户看不出前后是两回事。
         * 一条更明显的分隔线把两块分开，比给标题加图标更轻、也更不容易在窄屏出错。
         */
        const addDivider = () => {
          const line = document.createElement('div')
          line.className = 'dshqp-menu-divider'
          menu.appendChild(line)
        }

        /**
         * ★★★ 2026-10-09 新增：菜单里点「优化」→ 弹**同一个**详情面板。
         *
         * 复用徽标那套 openDetail（单一数据源），不再自己拼一份 DOM。
         * 还没拿到状态时给一句明确提示 —— 点了没反应会让人以为坏了。
         */
        const openOptDetail = () => {
          if (optBadge.openDetail()) return
          if (typeof optBadge.setNotice === 'function') optBadge.setNotice('优化状态还在获取中，稍等几秒再点。')
        }

        /**
         * ★★★ 给菜单算位置与高度（每次打开都算一遍）。
         *
         * 主人 2026-10-08 两次反馈的最终定案：
         *   第一次「新会话里被上面的 UI 挡住」→ 我先改成"翻方向 + 限高"，**没用**。
         *   原因：菜单原本是**座位的子元素 + absolute**，会被 composer 那一串祖先的
         *   `overflow` **裁掉** —— 裁在祖先层，翻方向、限高、滚动**统统救不了**
         *   （裁的是元素的可见区域，不是它自己的滚动内容）。
         *   ✓ 所以现在菜单**挂在 body 上 + fixed 定位**，跟祖先裁剪彻底无关，
         *     坐标和高度全部在这里现算。
         *
         * 规则：
         *   · 上面塞不下、**或** composer 落在屏幕上半区（新会话的 hero 布局）→ 往下弹
         *   · 高度取那一侧的实际空间（上限 400、保底 140），溢出的部分靠菜单内部滚动
         *   · 水平方向和座位右边缘对齐，但不许出界
         *   · 量不到尺寸就保持默认（top/left 都是 0 会被 CSS 兜住）—— 能打开比位置完美重要
         */
        const placeMenu = () => {
          try {
            if (typeof seat.getBoundingClientRect !== 'function') return
            const rect = seat.getBoundingClientRect()
            const viewport = Number(window.innerHeight) || 0
            const viewportW = Number(window.innerWidth) || 0
            if (viewport <= 0) return
            const GAP = 8
            const LIMIT = 400
            menu.style.maxHeight = `${LIMIT}px`
            // scrollHeight 是**内容总高**，不受 max-height 影响 —— 正好用来判断"需要多高"
            const need = Math.min(Number(menu.scrollHeight) || 0, LIMIT)
            const above = rect.top - GAP
            const below = viewport - rect.bottom - GAP
            const wantDown = above < need || rect.top < viewport * 0.45
            const down = wantDown && below > 140
            const room = down ? below : above
            const height = Math.max(140, Math.min(LIMIT, room))
            menu.style.maxHeight = `${height}px`
            const box = typeof menu.getBoundingClientRect === 'function' ? menu.getBoundingClientRect() : null
            const shown = Math.min(box && box.height ? box.height : height, height)
            const width = box && box.width ? box.width : 0
            menu.style.top = down
              ? `${Math.min(Math.max(GAP, viewport - GAP - height), rect.bottom + 6)}px`
              : `${Math.max(GAP, rect.top - shown - 6)}px`
            // 右对齐座位右边缘，同时不许越出视口
            const rightAligned = rect.right - width
            const maxLeft = viewportW > 0 ? viewportW - width - GAP : rightAligned
            menu.style.left = `${Math.max(GAP, Math.min(rightAligned, maxLeft))}px`
          } catch (error) {
            /* 量不到就不动它 —— 菜单能用比"位置完美"重要得多 */
          }
        }

        const toggleMenu = () => {
          if (menu !== null) { closeMenu(); return }
          menu = document.createElement('div')
          menu.className = 'dshqp-menu'
          // ★★★ 2026-10-09 新增（主人要求）：「是不是你上面也应该设置一个自动拉起啊，
          //   自动打开就点一下打开的按钮，你没有这个按钮，人家难不成还要跑去手动打开吗？」
          //   —— 完全正确。原先这个菜单里只有"自动关闭"的档位（5 分钟后关、10 分钟后关…），
          //   却**没有任何"现在就打开"的入口**：用户想立刻用，只能干等着下次出图，
          //   或者自己跑去命令行/快捷方式手动启动。
          //   所以最上面加一组「后端」，第一项就是「启动 ComfyUI」。
          addGroup('后端', [
            onlineNow
              ? { kind: 'start', text: 'ComfyUI 已在运行', muted: true }
              : launchFailed
                ? { kind: 'start', text: launchTimedOut ? '启动超时，点此重试' : '启动失败，点此重试' }
                : { kind: 'start', text: startingNow ? '正在启动…' : '启动 ComfyUI' },
          ])
          // ★ 2026-10-09：启动失败/超时时把**原因**直接摆进菜单 —— 用户不用去猜、也不用翻日志。
          //   这是主人明确要求「直接报错」的落点。
          if (!onlineNow && launchFailed && launchError !== '') {
            const why = document.createElement('div')
            why.className = 'dshqp-menu-note'
            why.textContent = `${launchTimedOut ? '超时' : '失败'}原因：${launchError}`
            menu.appendChild(why)
          }
          addGroup('自动关闭', IDLE_CHOICES.map((choice) => (
            { kind: 'idle', value: choice.minutes, text: choice.text }
          )))
          // ★★★ 2026-10-09 新增（主人要求）：四档「生图判断」终于有了界面入口。
          //   ⚠ 标题里写明"重载后生效"是**必须的**：档位最终写进 systemPrompt，
          //     而那是插件加载时注册的静态文本，改配置不会当场替换提示词。
          //     藏着不说，用户选完发现没变化，只会认定"这功能是坏的"。
          addGroup('生图判断（重载后生效）', TRIGGER_CHOICES.map((choice) => (
            { kind: 'trigger', value: choice.id, text: choice.text }
          )))

          // ★★★ 2026-10-09 新增（主人要求）：「启用优化」也该从这里进得去。
          //
          //   主人原话：「还有这里那个启用优化的，你点进去怎么还是那个界面选择的界面，
          //     你启用优化就应该是启用了哪些优化」。
          //
          //   症结在于：优化状态此前**只有一个入口** —— 状态行右边那个小徽标。
          //   设置菜单里却只有「后端 / 自动关闭 / 生图判断 / 外观」，
          //   用户想找"优化"自然会去菜单里翻，翻不到就以为没这功能，
          //   或者点了别的东西（于是看到的是"选择界面"，跟他想看的不是一回事）。
          //
          //   现在菜单里也有一项，点它直接弹**同一个优化详情面板** ——
          //   单一数据源、单一渲染逻辑，不会出现"两处显示不一致"。
          addGroup('优化', [
            {
              kind: 'opt',
              value: 'detail',
              // 条目文字直接报当前状态，用户在菜单里就能看到分布，不必先点进去
              text: optMenuText(),
            },
          ])

          // ★★★ 2026-10-12（用户要求「预设工作流」）：出图风格预设。
          //   只有用户**没显式传 size** 时才接管画幅；megapixels 永远尊重显式值。
          //   选中写进 uiState + 经 ?preset= 下发给后端，作为下次出图的默认预设。
          addGroup('预设（出图风格）', PRESET_CHOICES.map((choice) => (
            { kind: 'preset', value: choice.id, text: choice.text }
          )))

          // ★★★ 2026-10-12（用户要求「首次使用向导 / 确认式一键修复」）：工具区。
          addGroup('抽卡挑图（重载后生效）', [
            ...PICK_CHOICES.map((c) => ({ kind: 'aibest', value: c.id, text: `AI 挑图：${c.text}` })),
            ...PICK_CHOICES.map((c) => ({ kind: 'userbest', value: c.id, text: `用户自选：${c.text}` })),
          ])
          addGroup('工具', [
            { kind: 'wizard', text: '首次使用向导' },
            { kind: 'repair', text: '一键修复（可逆）' },
          ])

          // ★★★ 2026-10-09：**功能区到此为止，下面是外观区**。
          //   上面三项改的是"怎么工作"，下面两项改的是"长什么样"，
          //   用一条明显分隔线划开（主人要求区分这两类）。
          addDivider()

          // ★ 主人 2026-10-08：「把现在的三个字去掉，在流星前加个点，后面写上自制，
          //   下面的流光统一做一个大标题，标注抄自月匠」。
          //   所以：流星 = 前面一个点 + 后面「自制」标签；15 种流光收进一个子标题下。
          addGroup('生图动画', [
            { kind: 'flow', value: 'meteor', text: '流星', bullet: true, tag: '自制' },
          ])
          // ⚠ 有了这个大标题，条目名就**不再重复带「流光·」前缀**（原来是每项都带）。
          addGroup('流光 · 抄自月匠', FLOW_GRADS.map((grad) => (
            { kind: 'flow', value: grad.id, text: grad.name, swatch: grad.id }
          )), true)
          // ★★ 挂到 **body**（不是座位）—— 摆脱 composer 祖先的 overflow 裁剪。
          //   踩过：挂在座位里时，新会话的菜单会被祖先裁掉头，翻方向/限高都救不了。
          const host = document.body ?? document.documentElement
          host.appendChild(menu)
          // 必须**挂进 DOM 之后**才量得到尺寸（见 placeMenu 的说明）
          placeMenu()
          syncMenuHighlight()
          document.addEventListener('click', onDocClick, true)
        }
        seat.setAttribute('data-clickable', '1')
        // ⚠ 防御：自测用的假座位对象可能没有 addEventListener（真实 DOM 一定有）。
        //   不加这层判断会在这里抛错，把后面的 paint/poll 全带断 —— 自测抓到过一次。
        if (typeof seat.addEventListener === 'function') seat.addEventListener('click', toggleMenu)

        // ★ 2026-10-09：连续取不到状态端点的次数。
        //   用来区分"页面刚加载、host 还没就绪"（一两次，属于正常）和
        //   "端点真的不通"（持续失败，那才值得报出来）。见 describeStatus 的说明。
        let statusFails = 0

        const poll = () => {
          fetchStatus()
            .then((data) => {
              if (stopped) return
              if (data === null) statusFails += 1
              else statusFails = 0
              // ★ 2026-10-09：同步"在线 / 正在启动" —— 菜单里那个「启动 ComfyUI」
              //   的文案和可用性都靠它俩；在线了就把 startingNow 清掉。
              if (data && typeof data === 'object') {
                onlineNow = data.online === true
                if (onlineNow) startingNow = false
                else if (typeof data.starting === 'boolean') startingNow = data.starting
                // ★ 2026-10-09：同步启动失败状态与原因（菜单里要用来显示"重试"+错误详情）
                launchFailed = data.online !== true && data.launchFailed === true
                launchTimedOut = launchFailed && data.launchTimedOut === true
                launchError = typeof data.launchError === 'string' ? data.launchError : ''
                launchElapsedMs = Number(data.launchElapsedMs) || 0
              }
              // ★★★ 2026-10-09 修：**兜底收口必须覆盖"所有来源"**。
              //
              //   上一版的漏洞：只在"点启动按钮"时记时（startRequestedAt 由 startComfy 设），
              //   而 `startingNow` 还会被**后端**设为 true（`data.starting`）——
              //   那种情况下 startRequestedAt 一直是 0，收口条件永不成立 ⇒ **照样卡死**。
              //   这正是"重启后仍然卡在正在启动…"的原因之一。
              //
              //   现在：只要 `startingNow` 为 true（不管谁设的），就从它**变 true 的那一刻**开始计时，
              //   到点一律收口；一旦不在启动态就把计时清零。
              if (startingNow && startRequestedAt === 0) startRequestedAt = Date.now()
              if (!startingNow) startRequestedAt = 0
              if (startingNow && Date.now() - startRequestedAt > START_GIVEUP_MS) {
                startingNow = false
                startRequestedAt = 0
              }
              paint(describeStatus(data, statusFails))
              // ★ 2026-10-09：同步"优化是否已启用"徽标（含未启用原因）。
              // ★ 2026-10-09：同步"生图判断"档位（菜单高亮用）
              if (data && typeof data.drawTrigger === 'string') {
                if (TRIGGER_CHOICES.some((c) => c.id === data.drawTrigger)) {
                  triggerNow = data.drawTrigger
                }
              }
              // ★★★ 2026-10-09：拿不到 optimization 时**别再说"未知"** ——
              //   那正是主人两次指出的那类"傻判断"：把可以确定的事实
              //   （端点没通 / 后端是旧版）盖成一句含糊的"未知"。
              //   现在按**能查明的具体原因**分两种说法。
              let optView
              // ★ 两个兜底分支都补 `stats: null`：这里**没有** stats 可报（还没探测），
              //   显式给 null 而不是留 undefined —— 面板那行"共 N 项"据此跳过，
              //   菜单文字也据此走"检测中"。留 undefined 容易被后续代码误当成"有值"。
              if (data === null || typeof data !== 'object') {
                optView = {
                  level: 'unknown',
                  summary: '状态接口未就绪',
                  reasons: ['还没拿到插件后端的响应 —— 页面刚加载时很常见，稍后会自动重试。'],
                  detail: [],
                  stats: null,
                }
              } else if (data.optimization === undefined || data.optimization === null) {
                // 接口有响应、却没有这个字段 ⇒ **正在跑的是旧版后端**（插件是符号链接，
                // 但 DSH 进程仍在用加载时缓存的那份模块）。这句能直接告诉用户该做什么。
                optView = {
                  level: 'unknown',
                  summary: '插件后端是旧版，需重载',
                  reasons: [
                    '状态接口能通，但没带回"优化状态"字段 —— 说明当前运行的是旧版后端。',
                    '重载插件或重启 DSH 之后，这里就会显示真实的优化状态。',
                  ],
                  detail: [],
                  stats: null,
                }
              } else {
                optView = data.optimization
              }
              optBadge.update(optView)
              // ★ 2026-10-12：完整 payload 也存一份 —— 面板里的「出图存到」要读顶层的
              //   `outputDir` / `outputDirSource`（它们**不在** optimization 里）。
              payloadNow = data
              // ★★★ 2026-10-09：把最新优化数据也存一份 —— 菜单里那项要据此显示文字，
              //   点开时也要用它喂给详情面板（与徽标**同源**，绝不各算一套）。
              optNow = optView
              // ★ 记住当前档位供菜单高亮用 —— host 的 snapshot 里本来就带 idleShutdownMs。
              //   注意它是"设定的档位"，不是 idleShutdownInMs 那个"还剩多久"。
              if (data && typeof data.idleShutdownMs === 'number') {
                idleNow = Math.round(data.idleShutdownMs / 60000)
                syncMenuHighlight()
              }
              // ★ 生图动画同理：记住当前选择 —— 菜单高亮和 makeFlowNode 都用它。
              //   只认白名单值，别的一律当没看见（默认照旧走流星）。
              if (data && typeof data.flowStyle === 'string') {
                if (data.flowStyle === 'meteor' || FLOW_IDS.includes(data.flowStyle)) {
                  flowStyleNow = data.flowStyle
                  syncMenuHighlight()
                }
              }
              // ★★★ 2026-10-12：当前出图预设同步（菜单高亮用）。
              // ★ 2026-10-19：抽卡挑图两个开关的当前值（host 的 snapshot 里带）
              if (data && typeof data.aiPickBest === 'string') {
                aiBestNow = data.aiPickBest === 'on' ? 'on' : 'off'
                syncMenuHighlight()
              }
              if (data && typeof data.userPickBest === 'string') {
                userBestNow = data.userPickBest === 'on' ? 'on' : 'off'
                uiUserPickBest = userBestNow
                syncMenuHighlight()
              }
              if (data && typeof data.preset === 'string' && PRESET_CHOICES.some((c) => c.id === data.preset)) {
                presetNow = data.preset
                syncMenuHighlight()
              }
            })
            .catch(() => {
              // 请求本身抛错同样算一次失败（不是"状态未知"，见 describeStatus）
              if (!stopped) {
                statusFails += 1
                paint(describeStatus(null, statusFails))
              }
            })
        }

        paint(describeStatus(null, 0))
        poll()
        timer = setInterval(poll, POLL_MS)

        return () => {
          stopped = true
          if (timer !== null) clearInterval(timer)
          // ★ 卸载时顺手收掉菜单 —— 同时把挂在 document 上的"点空白处消失"监听摘掉，
          //   否则它会一直留在页面上（座位已经没了，菜单却还挂着监听）。
          closeMenu()
          // ★ 2026-10-09：优化面板同理 —— 它挂在 seat 外面（用绝对定位浮起来），
          //   清空 seat 带不走它，必须显式销毁，否则会留一个孤立的浮层在页面上。
          optBadge.dispose()
          try { seat.textContent = '' } catch (error) { /* 座位已被移除 */ }
        }
      }

      /** React 座位：只在 useEffect 里挂纯 DOM，绝不把异常抛进 dsh 的渲染树。 */
      function ComfyStatusSeat() {
        const hostRef = React.useRef(null)
        React.useEffect(() => {
          const seat = hostRef.current
          if (!seat) return undefined
          try {
            return mountStatus(seat)
          } catch (error) {
            warn(`状态指示器挂载失败：${error && error.message ? error.message : error}`)
            return undefined
          }
        }, [])
        return React.createElement('span', { className: 'dshqp-seat', ref: hostRef })
      }

      /**
       * 极轻量的「加载自报」：往 host 的状态端点打一发带理由的请求。
       * ★ 为什么需要它：`apply` 里那几处 `return` 是**安静失败**——不报错、不记日志，
       *   从外面看和"客户端代码根本没加载"完全一样。把理由写进查询串，
       *   host 端记下来，就能精确区分到底是哪一环断的。
       * 失败一律吞掉，绝不影响插件本身。
       */
      function pingHost(reason) {
        try {
          fetch(`api/qwen-paint/status.json?ping=${encodeURIComponent(reason)}`, { cache: 'no-store' }).catch(() => {})
        } catch (error) {
          /* 自报失败无所谓 */
        }
      }

      /**
       * ★★★ 2026-10-19（用户要求）：**圈选局部重绘**。
       *
       * ## 为什么是独立浮层
       *   用户原话是"打开预览的时候在右边侧边栏手动圈选"。但预览图在 **DSH 的消息树**里，
       *   那棵树由 React 管理 —— 本文件顶部记着一条红线：**插自己的 DOM 会被下次渲染重排/清空**
       *   （曾经三次把界面搞成整片空白）。所以这里改成**自己的浮层**（position:fixed），
       *   与消息树完全隔离，随便画、随便重排都不影响宿主。
       *
       * ## 流程
       *   点结果图 → 浮层里用画笔圈（白=要改）→ 写一句"这一块要改成什么" → 提交
       *   → POST `api/qwen-paint/inpaint`（host 存蒙版 + 调**同一个** inpaint_image 工具）→ 回显新图。
       *
       * ## 两个容易踩的细节
       *   ① **canvas 污染**：图片走 `api/file?…`，直接画进 canvas 再 toDataURL 会因跨协议被标脏、
       *      抛 SecurityError。所以先用 `fetch` 取 blob、再用 blob: URL 喂 <img>（同源）。
       *   ② **坐标换算**：canvas 内部尺寸 = 图片原始像素，但显示时被 CSS 缩放，
       *      必须按 `canvas.width / rect.width` 折算，否则大图上的笔迹会跑偏。
       */
      /* ★ 2026-10-19：`userPickBest` 的当前值 —— **跨两个作用域共享**：
         状态轮询在 mountStatus 里写它，结果卡片（renderCard）要读它决定"单图还是并排"。
         放在模块层是刻意的：卡片渲染和状态挂载是两个闭包，只有这一层两边都看得见。 */
      let uiUserPickBest = 'off'

      function openInpaintDialog(imagePath) {
        if (typeof document === 'undefined' || document.body === null) return
        if (typeof imagePath !== 'string' || imagePath === '') return

        // ★★★ 2026-10-20（0.17.13 修 bug）：同一时刻只允许一个圈选弹窗。
        //   改版前重复点图片会把浮层一层层盖上 —— 视觉上只看得到最上面那层，
        //   底下的层还各自挂着 pointer / keydown 监听，等于悄悄漏监听器。
        //   ✓ 开新的之前把残留的全清掉。
        if (typeof document.querySelectorAll === 'function') {
          for (const el of Array.from(document.querySelectorAll('.dshqp-mask-overlay'))) {
            try { el.remove() } catch (error) { /* 已被移除 */ }
          }
        }

        // ★ 2026-10-20（0.17.13）：弹窗内的图片一律走**插件自己的**图片路由。
        //   内核的 `api/file?path=` 只服务"已登记"的文件（draw_image 产物走登记）；
        //   而圈选重绘的结果是直接 execute() 出来的、没登记 —— 用 api/file 大概率裂图。
        //   `api/qwen-paint/file` 由 host 端直接吐 outputDir 内的字节，不依赖登记。
        const fileUrl = (p) => `api/qwen-paint/file?path=${encodeURIComponent(p)}`

        const overlay = document.createElement('div')
        overlay.className = 'dshqp-mask-overlay'

        const card = document.createElement('div')
        card.className = 'dshqp-mask-card'
        overlay.appendChild(card)

        const title = document.createElement('div')
        title.className = 'dshqp-mask-title'
        title.textContent = '圈选局部重绘'
        card.appendChild(title)

        const hint = document.createElement('div')
        hint.className = 'dshqp-mask-hint'
        hint.textContent = '用画笔把要改的地方涂出来（白色=重绘），再写一句要改成什么。没涂的地方保持原样。'
        card.appendChild(hint)

        const stage = document.createElement('div')
        stage.className = 'dshqp-mask-stage'
        card.appendChild(stage)

        const base = document.createElement('img')
        base.alt = '待重绘的图'
        stage.appendChild(base)

        const view = document.createElement('canvas')
        stage.appendChild(view)

        const tools = document.createElement('div')
        tools.className = 'dshqp-mask-tools'
        card.appendChild(tools)

        const mkBtn = (text, on) => {
          const b = document.createElement('button')
          b.type = 'button'
          b.className = 'dshqp-mask-btn'
          b.textContent = text
          if (on === true) b.setAttribute('data-on', '1')
          tools.appendChild(b)
          return b
        }

        const btnBrush = mkBtn('画笔', true)
        const btnEraser = mkBtn('橡皮', false)
        const btnClear = mkBtn('清空', false)
        const sizeWrap = document.createElement('span')
        sizeWrap.style.cssText = 'font-size:12px;opacity:.8;display:flex;gap:6px;align-items:center'
        sizeWrap.textContent = '笔刷'
        const size = document.createElement('input')
        size.type = 'range'
        size.min = '4'
        size.max = '120'
        size.value = '28'
        size.style.width = '110px'
        sizeWrap.appendChild(size)
        tools.appendChild(sizeWrap)

        const prompt = document.createElement('textarea')
        prompt.className = 'dshqp-mask-prompt'
        prompt.placeholder = '这一块要改成什么？例如：把帽子换成红色针织帽，其它地方不要动'
        card.appendChild(prompt)

        const foot = document.createElement('div')
        foot.className = 'dshqp-mask-foot'
        card.appendChild(foot)

        const state = document.createElement('div')
        state.className = 'dshqp-mask-state'
        state.textContent = '正在载入图片…'
        foot.appendChild(state)

        const btnCancel = document.createElement('button')
        btnCancel.type = 'button'
        btnCancel.className = 'dshqp-mask-btn'
        btnCancel.textContent = '取消'
        foot.appendChild(btnCancel)

        const btnGo = document.createElement('button')
        btnGo.type = 'button'
        btnGo.className = 'dshqp-mask-btn'
        btnGo.textContent = '开始重绘'
        btnGo.disabled = true
        foot.appendChild(btnGo)

        // ★★★ 2026-10-20（0.17.13 修 bug）：结果图容器**只造一次**。
        //   改版前每次成功都往 card 里 append 一个新 <img> —— 连点几次「再改一次」
        //   就在弹窗里叠一排结果图，越叠越长还把上面的顶出视野。
        //   ✓ 改成固定容器 + replaceChildren：永远只展示最新一张。
        const resultSlot = document.createElement('div')
        resultSlot.className = 'dshqp-mask-result'
        card.appendChild(resultSlot)

        let drawing = false
        let erasing = false
        let ready = false
        let last = null
        /** 离屏蒙版：黑底 + 白笔迹（ComfyUI 认的就是这个） */
        let maskCanvas = null
        let maskCtx = null

        const close = () => {
          try { if (overlay.parentNode) overlay.parentNode.removeChild(overlay) } catch (error) { /* 已被移除 */ }
          if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
            window.removeEventListener('keydown', onKey)
          }
        }
        const onKey = (e) => { if (e.key === 'Escape') close() }

        const paintStroke = (from, to, erase) => {
          if (maskCtx === null) return
          const r = (Number(size.value) || 28) / 2
          for (const ctx of [view.getContext('2d'), maskCtx]) {
            ctx.save()
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.lineWidth = r * 2
            if (ctx === maskCtx) {
              ctx.strokeStyle = erase ? '#000000' : '#ffffff'
            } else {
              ctx.strokeStyle = erase ? 'rgba(0,0,0,0)' : 'rgba(255,80,120,0.55)'
              ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over'
            }
            ctx.beginPath()
            ctx.moveTo(from.x, from.y)
            ctx.lineTo(to.x, to.y)
            ctx.stroke()
            ctx.restore()
          }
        }

        const pointOf = (e) => {
          const rect = view.getBoundingClientRect()
          if (rect.width === 0 || rect.height === 0) return null
          return {
            x: (e.clientX - rect.left) * (view.width / rect.width),
            y: (e.clientY - rect.top) * (view.height / rect.height),
          }
        }

        view.addEventListener('pointerdown', (e) => {
          if (!ready) return
          const p = pointOf(e)
          if (p === null) return
          drawing = true
          last = p
          try { view.setPointerCapture(e.pointerId) } catch (error) { /* 老浏览器 */ }
          paintStroke(p, { x: p.x + 0.01, y: p.y + 0.01 }, erasing) // 点一下也留一个点
          e.preventDefault()
        })
        view.addEventListener('pointermove', (e) => {
          if (!drawing || last === null) return
          const p = pointOf(e)
          if (p === null) return
          paintStroke(last, p, erasing)
          last = p
          e.preventDefault()
        })
        const endStroke = () => { drawing = false; last = null }
        view.addEventListener('pointerup', endStroke)
        view.addEventListener('pointercancel', endStroke)
        view.addEventListener('pointerleave', endStroke)

        btnBrush.addEventListener('click', () => {
          erasing = false
          btnBrush.setAttribute('data-on', '1')
          btnEraser.removeAttribute('data-on')
        })
        btnEraser.addEventListener('click', () => {
          erasing = true
          btnEraser.setAttribute('data-on', '1')
          btnBrush.removeAttribute('data-on')
        })
        btnClear.addEventListener('click', () => {
          if (maskCtx === null) return
          maskCtx.fillStyle = '#000000'
          maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)
          const vctx = view.getContext('2d')
          vctx.clearRect(0, 0, view.width, view.height)
        })
        btnCancel.addEventListener('click', close)
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
          window.addEventListener('keydown', onKey)
        }

        btnGo.addEventListener('click', () => {
          const text = String(prompt.value || '').trim()
          if (text === '') { state.textContent = '先写一句"要改成什么"'; prompt.focus(); return }
          if (maskCanvas === null) { state.textContent = '图片还没载入好'; return }
          btnGo.disabled = true
          btnCancel.disabled = true
          state.textContent = '重绘中…（要几十秒，别关这个窗口）'
          let maskPng = ''
          try {
            maskPng = maskCanvas.toDataURL('image/png')
          } catch (error) {
            state.textContent = `蒙版导出失败：${error?.message ?? error}`
            btnGo.disabled = false
            btnCancel.disabled = false
            return
          }
          fetch('api/qwen-paint/inpaint', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ image: imagePath, prompt: text, maskPng }),
          })
            .then((r) => r.json())
            .then((data) => {
              if (!data || data.ok !== true) {
                state.textContent = `失败：${data?.reason ?? '未知原因'}`
                btnGo.disabled = false
                btnCancel.disabled = false
                return
              }
              const out = String(data.path ?? '')
              state.textContent = `完成（${data.seconds ?? '?'}s）：${out}`
              if (out !== '') {
                // 直接把结果图换到弹窗里 —— 用户能立刻看到改得对不对
                const next = document.createElement('img')
                next.alt = '重绘结果'
                next.style.cssText = 'margin-top:10px;max-width:100%;border-radius:8px'
                next.src = `${fileUrl(out)}&t=${Date.now()}`
                // ★ 2026-10-20（0.17.13）：替换而不是追加 —— 只留最新一张（见 resultSlot 注释）
                resultSlot.replaceChildren(next)
                // 换完图后允许再改一次：清空蒙版，保留输入
                btnClear.click()
              }
              btnGo.disabled = false
              btnCancel.disabled = false
              btnGo.textContent = '再改一次'
            })
            .catch((error) => {
              state.textContent = `请求失败：${error?.message ?? error}`
              btnGo.disabled = false
              btnCancel.disabled = false
            })
        })

        // 用 fetch 取 blob 再喂 <img>：避免跨协议把 canvas 标脏（toDataURL 会抛 SecurityError）
        // ★ 2026-10-20（0.17.13）：同样走插件自有路由 fileUrl，不依赖 api/file 的登记机制
        fetch(fileUrl(imagePath))
          .then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            return r.blob()
          })
          .then((blob) => {
            const url = URL.createObjectURL(blob)
            base.onload = () => {
              const w = base.naturalWidth || base.width
              const h = base.naturalHeight || base.height
              if (!w || !h) { state.textContent = '图片尺寸读不到，无法圈选'; return }
              view.width = w
              view.height = h
              maskCanvas = document.createElement('canvas')
              maskCanvas.width = w
              maskCanvas.height = h
              maskCtx = maskCanvas.getContext('2d')
              maskCtx.fillStyle = '#000000'
              maskCtx.fillRect(0, 0, w, h)
              ready = true
              state.textContent = `已载入 ${w}×${h}，可以开始圈选`
              btnGo.disabled = false
              try { URL.revokeObjectURL(url) } catch (error) { /* 无所谓 */ }
            }
            base.onerror = () => { state.textContent = '图片载入失败' }
            base.src = url
          })
          .catch((error) => {
            state.textContent = `图片载入失败：${error?.message ?? error}`
          })

        document.body.appendChild(overlay)
        try { prompt.focus() } catch (error) { /* 无所谓 */ }
      }

      function apply(ctx) {
        // ★ 必须用 `!React` 而不是 `React === null`：require('react') 返回 undefined
        //（不抛错）时 React 会是 undefined，`=== null` 拦不住，槽照注册，
        // 组件一渲染就 TypeError 污染 dsh 自己的渲染树（MEMO 里记过这个坑）。
        pingHost('apply')
        if (!React || typeof React.createElement !== 'function') {
          pingHost('no-react')
          return
        }
        if (ctx === undefined || ctx.slots === undefined) {
          pingHost('no-slots')
          return
        }

        // ★★★ 2026-10-08 十九次修正：**这里不再启动思考块观察器**。
        //   它原来是常驻的（从 DSH 启动起就 observe 整棵聊天树），流式输出时
        //   每秒被唤醒几十上百次，叠加录屏就把渲染主线程拖垮（主人「整个界面卡住」）。
        //   ✓ 现在改成：**flowStart 时挂上、flowFinish 时摘下**（见那两个函数）。
        //     平时界面处于"零常驻监听"状态，不可能因为插件而卡。

        // 样式挂在 apply 的 effect 里，卸载时自动摘掉（不往 body 写 DOM）
        try {
          ctx.effect(() => {
            const el = document.createElement('style')
            el.id = STYLE_ID
            el.textContent = CARD_CSS
            document.head.appendChild(el)
            return () => {
              try { el.remove() } catch (err) { /* 卸载时文件已被移除也无所谓 */ }
            }
          }, 'qwen-paint:style')
        } catch (err) {
          /* 样式失败不影响卡片本身 */
        }

        // ★ 流光动画的样式表：**单独一个 style 节点**，内容由 FLOW_GRADS 生成
        //   （单一数据源 —— 不手写第二份 CSS，也就不会再踩 CARD_CSS 那种反引号 / 转义坑）。
        //   即使这一段失败，也只是"流光没有颜色"，不影响出图，也不影响流星动画。
        try {
          ctx.effect(() => {
            const el = document.createElement('style')
            el.id = GRAD_STYLE_ID
            el.textContent = flowGradCss()
            document.head.appendChild(el)
            return () => {
              try { el.remove() } catch (err) { /* 卸载时文件已被移除也无所谓 */ }
            }
          }, 'qwen-paint:grad-style')
        } catch (err) {
          /* 样式失败不影响卡片本身 */
        }

        // 只注册 key=toolName 这一个格子；key 未占用 → 不遮蔽任何自带 UI。
        // ★ 整段包 try/catch：槽不存在 / 注册冲突 / 版本差异都**不许**把 dsh 的启动拖垮
        //   （MEMO 记过：自写客户端插件挂槽把界面搞崩过）。失败只 warn，绝不外抛。
        try {
          ctx.slots.inject(SLOT_KEY, () =>
            ctx.slots.register({ name: SLOT_KEY, key: TOOL_KEY }, DrawImageCard),
          )
        } catch (error) {
          warn(`注册 ${SLOT_KEY}[${TOOL_KEY}] 失败，图片卡片不会出现（不影响 dsh 其它功能）：${error && error.message ? error.message : error}`)
        }

        // ComfyUI 在线状态点：挂在 composer **工具行右侧**（发送按钮前面），
        // 避免和左侧控件之间出现大片空白。单个 list 槽，用自定义 id，不抢自带位置。
        try {
          if (typeof React.useRef === 'function' && typeof React.useEffect === 'function') {
            ctx.slots.inject(STATUS_SLOT, () =>
              ctx.slots.register({ name: STATUS_SLOT, id: STATUS_ID, order: 40 }, ComfyStatusSeat),
            )
          } else {
            warn('React 种子缺 useRef/useEffect，跳过 ComfyUI 状态指示器')
          }
        } catch (error) {
          warn(`注册状态指示器失败，状态点不会出现（不影响 dsh 其它功能）：${error && error.message ? error.message : error}`)
        }

        // 走到这里说明两条槽都尝试注册过了 —— 自报一次，便于和上面那些提前 return 区分
        pingHost('registered')
      }

      // ★★ 必须声明 inject：客户端插件的 apply 只在依赖服务就绪后才被调用
      //（照 dsh-reasoning-glow 的写法 `exports.inject = ["slots"]`）。
      // 漏了这句的话 apply 可能在 slots 就绪前就跑，ctx.slots 还是 undefined，
      // apply 里那句守卫会**安静 return** —— 症状是"重启后图永远不显示"，而且不报错。
      exports.inject = ['slots']
      exports.name = PLUGIN_ID
      exports.apply = apply
      return module.exports
    },
  })
}

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
