# 天中医项目 · 长期记忆（精简版）

> 只留**必须遵守的结论**。细节全量在：`prototype/原型设计说明.md`（逐版本 §NN）、
> `REF-踩坑.md`（35k）、`REF-构建验证.md`（21k）、`REF-界面定稿.md`（32k）、`REF-工具链.md`。

## 1. 概况与不变式

- **主题**：组学数据智能挖掘系统（高保真原型，纯前端单文件）；需求源
  `~/Desktop/天中医需求梳理-组学.xlsx`；用户 Yamei（PM）。P0 = 组学分析收口样本 ID 对齐。
- **不变式**：页 **17** / 左栏 **4 组 10 项** / 菜单外页 `offMenu` **7**
  （p02·p04·p05·p06·p07·projdetail·sample）/ `STEPS` **5 步** / 左栏徽标 **0 枚**。
  **禁止写「页数 = 菜单项数 + N」这类魔数** → 判据是「每个页要么在菜单里、要么落进 `offMenu`」。
- **页面清单硬编码四处**（动结构必须一起改）：`build.js` 的 `pages`、`verify.py` 逐页循环、
  `SHOT_PAGE`、截图脚本。「菜单项数」另有三处：`ia.navItems`、`v37align.navItems`、
  `projRailRestore.globalItems`。
- **系统名**（v55 起）全站统一「组学数据智能挖掘系统」，出现在**四处**：`app.html` 的
  `<title>` + `<meta description>` + 顶栏 `.tnav-name`、`app.js` 头注释、
  `annotations.json` 的 `globalMeta.name` + overview 正文。顶栏品牌位宽度是固定值
  `calc(var(--rail-w) - 16px)` = 236px 且 nowrap —— 改名必须**实测** `scrollWidth <= clientWidth`
  且 `box <= brandW`，不许按字数乘字号估算。verify 里 `SYS_NAME` 从产物 `<title>` 真读 +
  `EXPECT_SYS_NAME` 钉死 + 启动 assert（防「改名后断言按旧名判、永远绿」）。
  历史交付包（`AI组学数据智能挖掘系统/` 目录与 `-原型.zip`）**刻意保留旧名**。

## 2. 冻结决策（按主题）

| 主题 | 结论 |
|---|---|
| 角色 v54 | **三档，一套到底**：`ROLES` = super/admin/user。权限只走 `canManage()`·`canConfig()`(仅super)·`isBasic()`，`pgCanWrite()` 转调 `canManage()`。**身份入口全站只有顶栏 `#userSw`**（`setRole()` 一处改四处）。旧「临床医生⇄生信工程师」切换器与项目组页页头开关**已撤**，差异改由 `body[data-role="user"] .eng-only{display:none}`。**权限不足不隐藏控件，只禁用 + 说明原因**，事件委托里有第二道判断 |
| 视觉 | 青 `#106376` / 深 `#0A4655` / 浅底 `#E3F0F3`；中文；响应式；WCAG AA。两套 token 同改：CSS `--color-brand*` + app.js `C.*`，改完跑 theme/legacyBlue/contrast/chartInkMin 四回归。有色底文字用 `onFill()`；状态色 ok `#0A6B49` / warn `#8A5200` |
| 定位 v13 | 界面无「演示」字样（`hifiNoDemo` 守 body textContent，**含 hidden 元素**）、无 `.note` 条、告警状态驱动、无假交互 |
| 导航 v17/v41/v49 | 返回**只有面包屑一条路**（verify 有全站无返回条断言）；钻进项目后全局菜单让位换项目菜单，出层唯一路也是面包屑，换套必重画 `NAV_MODE`；**菜单里有的页不自动收左栏**，名单只剩 `sample` |
| 左栏 v18/v50 | 深色外壳，底 = `--color-brand-deep`，顶栏左段 `::before` 拼 L 形，宽度唯一来源 `--rail-w`；二级**数量**徽标整块撤（`navCount()` 删），但类 `.snav__n` 保留（项目层 `✓ ! ·` 在用）—— 数量有两个消费方，只撤左栏那个 |
| 下载 v17 | 入口统一「点击→确认弹窗→真文件」，收在 `DL` 注册表；接后端只换 `build()` |
| 列表 v20 | 表头与内容一律居中；必填三件套 `.req`+`.frmlegend`+`aria-required`；p06 横向 `.pipe`，`RUN_STAGES` 唯一来源 |
| 画布/血缘 v21·v24 | `CANVAS` 唯一事实来源 + `ANALYSIS_FLOW` 映射；`LIN_AXIS` col/row；边数 = 节点数 − 1 |
| **流程编排 v60** | p04 「自编排」区**两视图共存**：点按钮（文案 `外部编排`）→ `#orch` 铺满视口、`.orchext` 接管画布；bar 上「返回站内画布」→ 同壳换回画布（**仍保持放大**，v21 那条能力没撤）；再点「收起」/Esc/跳页整体退出。`setOrchExt(on)` 管内容、`toggleOrchFull(force)` 管尺寸，**正交且退出时必须一起复位**（否则下次进编排页是白板）。`ORCH_EXT_URL` 地址唯一来源、`src` 运行时挂 → 产物无 `src` 属性，靠 `__orchExt(view)` 断 |
| 抽屉 v26 | 五块详情住 `#drawerSamp`，无遮罩；「开着」= `!hidden && .is-open`。z 序：58 全屏画布 < 60 遮罩 < 61 抽屉 < 62 二级 < 70 弹窗 |
| 文件管理 v33/v56 | 独立页 `#page-files`；可见范围三档 = 权限模型（mine/team/sys）；团队上传必选项目组；FM 段结束 `__goto('gene')`。**v56 系统文件从「整卡隐藏」改为「按身份判」**：唯一来源 `fmCanWrite()`=`canConfig()`（**不是** `canManage()`，它是平台公共资产）+ `fmWriteWhy()`；只读时上传卡不隐藏、换 `.alert--warn` 说明，行内删改用 `<span class="iconbtn is-off">`；读权限三档全开；页头 `#fmScopeHint` |
| 知识赋能 v58 | **三页各自页内挂载外部系统**（v57 的组标题跳外链已整段撤销）。`KB_EXT_BASE` + `KB_EXT{kbmed:/ke, kbown:/kb, kbgraph:/kg}` 是地址唯一来源（**无 `menu` 参数**）。每页页头 `.seg` 切「外部系统 / 站内版本」，默认 `ext`；站内内容包在 `[data-kblocal]` 用 `hidden` 收放（**不换页**：换页丢滚动位置 + 面包屑多一级）。iframe 由 `mountKbFrame()` 运行时 `setAttribute('src')` → **产物里没有 src 属性**，只能靠运行时探针断；失败态靠 `setTimeout(8000)` 兜底（`load` 被拒时不触发）。探针 `__kbView(id, view)`。`data-kbframeopen`（iframe 外链）≠ `data-kbopen`（站内知识条）——撞过一次名 |
| 医学知识库 v35/v40 | 三模式 + 四域（临床★/样本/组学/文献 58 词条）+ 状态机 draft→review→pub→arch；采集弹窗两段式（`KBC`）；**verify 知识库段首切 `local`、段末复原 `ext`**；用例数据禁含「演示」 |
| 智能体 v53 | 浮窗/浮球**整体撤除**；会话本体不动，**唯一宿主 = 主页问答卡 `#wbAgentCard`**（全屏 `is-full` = fixed+inset 22px + z 58）；类名 `.agentwin__*/.msg/.qchip/.confirmbox` 保留 |
| 项目管理 v37/v47 | 详情带 `data-proj-pano`；`__rail()` 解 `RAIL_LOCK`；列表有「项目状态」、**无**「设为当前」；新建 = **6 步向导**（项目信息/数据文件/分组与比较方案/流程模版/参数配置/创建完成，末段「任务运行」不进向导），进最后一步即 `pnewCreate()` 落库 |
| 项目概况 v39–v45 | 独立页 `#page-projdetail`；页签 `PDTABS` **7 个**；标题三处同源 `PROJ_EYE`/`projHeadName()`/`renderProjTitle()`；页头操作条 = 状态+分享+结果全景（**已在全景那格时自动隐去**，判据取位置不取名字，常驻 DOM + 切 `hidden`，CSS 需 `.pd__act .btn[hidden]`） |
| 分析结果 v41 | 模块清单现算（`pdtModules`）；`projFlows` 用 `PROJ_LINE` 正则可读匹配（**别退回按 id 哈希**）；跳转只挂 `data-pdt` |
| 结果全景 v42/v51 | `#panoTpl` **一份内容两个宿主**（`#panoMount`/`#resMount`），统一 `mountPano(slotId,view)`，挂载前清空另一宿主、必须在 `is-on` 之后；`#btnResult` 落点 `data-res="de"`，**「任务没结束就拦住」的闸每搬一次家都要整体平移** |
| 智能分析 v50–v52 | 整组 `off: true`（不画左栏，页面/`data-go`/面包屑照旧）；新建项目先出 `PNEW_MODES` 分流屏（探针 `__projNew` 必须直达）；`#btnRunAna` 走 `data-runmeta` 先弹「完善项目信息」确认后才开跑，p06 用 `#runMetaBar` 复述 |
| 数据汇集 v50 | 两栏文件选择器；树唯一来源 `fmTreeGroups/fmTreeRows`，**向导 key=`pn` / 数据汇集 key=`p02` 必须分开**；四铁律：三处同步勾选、勾选不整块重画（保 `scrollTop`）、搜索只换 `.pntree` innerHTML（不换输入框=不丢焦点）、切档不丢已选 |
| 建向导 v48 | 样本ID 表头三态全选（`indeterminate` 只能在渲染末尾补设）；`d.manual` 与 `d.sids` 分开存；子编辑器底栏 = 返回 + 创建/确定 |
| 示例数据集 v40/v54/v59 | `#page-pubds`；展示侧与设置侧读同一个 `DEMO_DS`，`DEMO_DS_DEF` 存出厂快照；封面短键经 `resolveImg→assetAbs→window.IMG_URI`（**别写 `assets/...` 字面量**）；v54 起本页 `canConfig()` 可写。**v59：`IMG_URI` 键名必须是相对路径**（见 §5「静默降级」） |
| 项目组管理 v47/v54 | `#page-projgroup`；`PROJ_GROUPS` 7 条 = 全站唯一名单来源（`pgPickNames()` 供向导第1步与团队上传）；`on` 与 `st` 正交，**只有 reject 可删**，新建一律 `pending`；页头身份开关撤为只读徽标 `#pgWho` |
| 已撤（别再找） | 基因档案 tab（v46，`#page-gene` id 保留）、`#page-sample` 不上菜单、`#page-dataset`、阈值待确认徽标、`data-dl="alignmatrix"` 死按钮 |

## 3. 数据口径（勿凭空改）

`PUB_DS` 6 数据集（人/鼠各 3）｜`REF_GENOMES` hg38 v44 / hg19 v34 / mm10 M25（物种守卫不能删）｜
三组学 75 例（75·75/75/71·共同 71，两页现算 vs 静态对照断言）｜`PROJECTS` 13 条，新建自增 P-2026-014｜
`SAMP_ARCHIVE` 75 例（4 手写 + 71 生成）｜`MISS_PROT` 4 例（缺蛋白组且同为质控不合格），补登用队列外 ID（S076）。

## 4. 构建与验证（硬规则）

- 源码 `src/app.{html,css,js}` → `node prototype/build.js` → `prototype/index.html`；
  **build 之后必须重跑标注注入**
  `node ~/.workbuddy/skills/prototype-annotation/scripts/inject-web-annotations.mjs prototype/index.html prototype/annotations.json`
  （漏了 → 产物只 1.77MB 的异常体积）。
- **路径已可移植（v61 改造，2026-10-21）**：`build.js` 的 node_modules 按
  `NODE_MODULES_DIR` → 向上逐级 → `~/.workbuddy/binaries/node/workspace/node_modules` 解析；
  `verify.py` 的 `ROOT` 从 `__file__` 推导（`PROTOTYPE_ROOT` 可覆盖）、
  Chrome 按 `CHROME_BIN` → 常见安装位置探测（`CDP_PORT` / `CDP_DL_DIR` 可覆盖）。
  **整个 `prototype/` 目录可整体拷走到任意位置继续开发** —— 原来写死
  `/Users/yummy/...` 是「换机器就断」的第一道拦路石。
- 验证：`~/.workbuddy/binaries/python/envs/default/bin/python prototype/verify.py`
  —— **只有这个 venv 有 `websocket-client`**，用系统 python 会挂。
- **基线：v60 = 603/603 全绿**（v59=591、v58=588、v56=578、v55=571……）；截图 **93** 张
  （v60 把 `23-orch-full` 拆成 `23-orch-ext` + `23b-orch-full`，旧的残留文件已删；
  v59 加 `12a-home-ds-own`，**只有院内队列那 3 条配了封面**，看封面必须切到该组）；
  标注 **34** 条；产物 **5,251,186** 字节（md5 `9015a282…`）。
- 完成判据只看 `Z_DONE = ok (N/N)`，**不看退出码**（Chrome GoogleUpdater 删家目录文件常被沙箱拦，
  退出码 failed 而判定 ok）。Chrome 需 `dangerouslyDisableSandbox` +
  `--use-mock-keychain --password-store=basic`；长回归钉 `CFFIXED_USER_HOME=/tmp/_cdp_home`
  （没出判定就断线 = 先怀疑环境）。
- 还原点 `_backup-v1/vNN-name/`（src ×3 + verify.py）；文档每轮追加 §NN。
- **注释分三套，写反代价极大**：`DRIVE = r"""…"""` **串内是 JS**，注释只能 `//` / `/* */`；
  `DRIVE` **外的 Python 只能用 `#`** —— 包括**截图 setup 区**（`shot()` 调用附近也在 DRIVE 之外，
  v59 又踩了一次，写 `/* */` 直接 `SyntaxError: invalid character '：'`，4 秒就挂）。
  JS 区写 `#` → `Uncaught SyntaxError` 且**行号是 DRIVE 内偏移**，极难定位还白等 4 分半。
  已在 `DRIVE` 后加 node `--check` 预检。
- **断言里的数字一律现算或「两处对同一个数」**；`need(label, cond, got)` 的 got **必须含全部参与
  判定的字段**（漏写的那一个就是唯一会红的那一个）。`d['x']` 取不存在的键返回 `_Miss` 哨兵：
  JS 侧能活（让断言红），Python 侧参与 `set()`/字符串拼接会真抛 `TypeError: unhashable` 并崩在断言处。
  新读数的**取值路径必须与采集段完全一致**。

## 5. 反复踩过的坑（高价值，全量见 `REF-踩坑.md`）

- **改/删 DOM 钩子或探针名，先 grep 全仓**：漏掉 verify 里一处 `q('[data-…]').click()` 就是
  `null.click()` → 抛错打断整段驱动，其后读数全成 `<缺失>`（已犯七次）。探针取不到报 **-1**。
- **Bash 里的 `grep` 不可靠**（BSD grep 不支持 `\|`、`\b`）→ 一律用内置 Grep 工具。
- **批量替换前必须确认作用域**（v58 踩）：为 iframe 把 `data-kbopen` 全局 replace 成
  `data-kbframeopen`，把站内知识库原有两处渲染 + 一处事件委托一起改了。修法：**只动自己新加的
  那几处、逐个 Edit**；替换后 grep 新旧两个名字，确认**旧名的原有处数没变**。
- **拆分/搬位 DOM 后，grep 出的每处引用都要重看**（v57）：**另一半更隐蔽：click 后
  `renderNav()` 重画整条左栏，旧节点全失效** → 必须「拿到就点 / 每步重取」，存变量跨一步 = 握 null。
  截图 setup 写错选择器是**静默失败**。
- **iframe 挂外部系统的硬约束**：能否嵌套由外部系统响应的 `X-Frame-Options` / CSP
  `frame-ancestors` 决定，**前端绕不过** → 动手前先 `curl -D`（v58/v60 实测都没下发，可挂载）。
  且 `load` 在被拒时**根本不触发** → 必须 `setTimeout` 兜底，否则用户只看到白板。
  **断言里不要断「iframe 加载成功」**：跨域读不到，成败取决于跑回归的机器有没有接那个网络
  —— 那是环境不是缺陷，写进断言等于埋「换台机器就红」的雷。
- **产物文本里证明不了运行时渲染出来的 `a[href]`** → 只能靠运行时探针。build 自检「文本里有
  http:// 即外部请求」判据太粗：**按发起时机分** —— 加载即发起（`src=`/`url()`/`@import`/`link href`）
  必须 0；点击才发起（`a[href]`）可豁免但要**白名单**，且豁免要**按语义定位**（摘掉 `a[href]`
  与数据字段再看）。
- **「查表失败就静默降级」的故障必须断查表本身，不能断降级后的产物**（v59 踩，最高价值，全量见
  `REF-踩坑.md`）：`assetAbs()` = `IMG_URI['assets/'+p] || 'assets/'+p`，查不到退回相对路径；
  而 build 的「路径→base64 替换」把**映射表键名**也换成了 base64 → 查表永远落空。
  **本地有 `assets/` 照样出图、回归全绿；`deploy-static/` 单文件无 `assets/` → 整片图裂。**
  修法：① 注入处只埋占位符，**所有替换做完再回填**（顺序是硬约束，全文档 `split-join` 会改键名）；
  ② 自检改为解析 `window.IMG_URI` 断「键名完好 + 条目数 + 值前缀」；verify 侧断 `naturalWidth > 0`。
  **「有 `<img>` 元素」≠「有图」，元素数对 ≠ 图能显示** —— 必须读运行时真实解码结果。
- **「数量相等」≠「一一对应」** → 比个数一律改成按名字比双向差集。
- **「量到 0」先分清是「没有」还是「量错样本」**（v56）：折叠态列表只有文件夹行，量文件行恒为 0。
  修法：探针里先展开、量完**按快照还原**（展开态是共享页内状态，留残展会毁掉下一段断言的起点），
  或把该读数交给专门探针。**`A == B 且 > 0` 里的 `> 0` 不能省** —— 少了就是 `0 == 0` 假绿。
- **「不渲染」改「常驻 + `hidden`」要三处同步**：CSS 兜底（`.btn` 是 inline-flex，UA 规则压不住
  类选择器）、探针量 `hidden` + 实际宽度 > 0、生成后补一次；另配一条反向断言。
  v60 又踩：`.orch__b` 是 `display:grid`，**grid/flex 这类布局类一律要单独声明 `[hidden]`**。
- **判据属性（`data-*` / 类名）必须有初始值**，不能只在状态切换时写 —— v60 的
  `data-orchview` 只在 `setOrchExt()` 里赋值，没进过全屏的编排页上是 `null`，
  「默认是站内画布」在 DOM 上零证据。初始化末尾显式调一次落默认。
- **并列 flex 子项之间不能直接比父子高度**：v60 断言写成「iframe 高 == 容器高」，
  但 bar 与 iframe 是兄弟，iframe 天然矮一个 bar 的高度（实测 955 vs 1000）。
  判据该是「子高 ≈ 父高 − 兄弟高 ± 2」且紧贴兄弟（gap ≤ 2）+ 兄弟外无余量（slack ≤ 2）。
- **改断言前先分清红的是实现还是判据** —— v60 首跑 601/603，两条 FAIL 性质完全不同：
  一条是真实现 bug（初始态没落属性），一条是我判据写错。**别一律往实现上归因去改代码。**
  同理，**布局改到「某块被收起」后原有量它的断言要挪时机**（v60 全屏后 `.orch__b` 收起，
  量画布宽必然 0）—— 判据一个字不用改，把「先切回画布再量」加进采集段即可。
- **给探针加字段前先 grep 那个键**（撞名会静默覆盖，比 `<缺失>` 毒）；**新断言的读数必须同时
  补进采集段**（同名键散在多个探针字典里）。
- **图标名只剩 `ico(变量)` 出处时必须登记 `ICON_REGISTRY`**，否则 build 扫不到、会把路径数据
  当文本塞进 `<svg>`（表象像内容乱码）。修法是补登记，不是改断言。
- **删一段前问「谁在借它」**：撤入口 ≠ 撤能力（检查项一条不减，并补「文案残影」断言）。
  v60 又用上：**「全屏」按钮要改成进外部系统，但站内画布全屏放大另有 13 条断言断着**，
  于是做成两视图共存而不是替换 —— **改按钮语义 ≠ 撤该按钮原有能力**。
- **模板内容搬进 `<template>` 后 `init()` 的全站遍历会漏掉它** → 挂载后补 `fillTables()` +
  `renderChart` + `setView`。
- **搬静态内容/换导航形态，harness 要跟着换**：项目层里没有 `[data-go]` → 用
  `window.__navFallback`（先面包屑退回再点左栏）。**断言的分母要跟「当前渲染了哪一栏」走**。
- **共用的页面状态用完要还原**（v54：探针在知识库切到「管理」模式没复位，污染后面两条断言）；
  「借某个上下文测试」要在 `finally` 里还回去。
- **断言不碰运气**：段首显式设起点、切页段回位、数字现算；调试钩子「不传参 = 纯读」。
- **截图**：setup 选择器写错只静默落空（md5 相同 = setup 没执行）；`md5 相同是强证据，不同只是
  弱证据`（动画途中捕获会偶发不同，先复跑一次）；`scrollIntoView` 会把要展示的东西顶出视口 →
  改设 `#content.scrollTop = 0`；截前先 `__xxxReset()` 恢复出厂，**快照必须深拷贝**。
  站内有 `svg.spin` 无限动画 → **截图 md5 天然不可复现**，别拿它当「零外溢」证据。
- **脚本里的 `$('#X')` 必须与 HTML 里的 `id="X"` 对一遍差集**（曾写 `#pgDel` 而 HTML 只有
  `data-pg-del`，等于没写）。
- **文案/命名要跟产品概念同步**：撤掉的功能留下的旧词（「医生视图」「演示身份」）会撞上既有守卫。

## 6. 部署

- 公网链接 `https://omics-mining-prototype.app.workbuddy.host/`；目录
  `~/WorkBuddy/天中医/deploy-static/index.html`（与 `prototype/index.html` 同步，md5 一致）。
- 应用登记：`.workbuddy/applications.yaml` → `wbapp_L6Oh0bcvmyU2tHTybo118G`（名称「组学数据挖掘系统」）。
- **发布前必做**：`cp prototype/index.html deploy-static/index.html` —— 部署目录**不会**自动跟随
  本地产物，漏同步就会把旧文件发上去（2026-10-17 的 v58 就是这样漏发了两轮）。
- **发布后必验**（别只看工具返回的 verified）：重新 `curl` 落盘 → 体积应等于本地产物
  （v60 = 5,251,186，md5 `9015a282…`）→ md5 双向一致 → 再 grep 关键钩子命中数
  （`data-orchextel` / `mountOrchExt` / `data-kbframeopen` / `KB_EXT_BASE` / `fmCanWrite`）。
  **体积对但钩子为 0** = 发的是旧文件或 CDN 未刷新。有些 id 运行时才拼出来
  （如知识库页头切换器），产物里命中 0 属正常。**线上是单文件、无 `assets/`** ——
  验封面要 grep `window.IMG_URI` 键名是否完好，只对体积发现不了图裂。
- **发布授权不跨轮**：每轮都要用户在最新消息里明确说「更新/发布」，否则工具返回
  `sites_deploy_needs_confirmation`。
- **状态：线上 = 本地 = v60**（2026-10-19 13:32 发布 v60；2026-10-21 路径可移植改造后
  产物 md5 不变，回归 603/603，仍是 v60 内容）。
- **★ 交接文档**：`~/WorkBuddy/天中医/HANDOFF.md`（2026-10-21 新建，跨机器/跨会话接手入口）。
  另注意 `天中医体系管理智能体/HANDOFF.md` 是**另一个子项目**（CNAS 迎检 Demo）的，别混。