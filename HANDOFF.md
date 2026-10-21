# HANDOFF — 组学数据智能挖掘系统 · 交互原型交接文档

> 交接时间：**2026-10-21 09:20 (GMT+8)**
> 项目根：`~/WorkBuddy/天中医`
> 原型根：`~/WorkBuddy/天中医/prototype`
> 公网链接：**https://omics-mining-prototype.app.workbuddy.host/**
> 当前版本：**v60**（线上与本地一致）
>
> 本文件是**跨机器、跨会话、跨人**接手这个原型的唯一入口。目标是：新接手的人（或未来的你）
> 不需要翻聊天记录、不需要问人，读完这一份就能改、能验、能发。

---

## 0. 这是什么

一个**纯前端的高保真交互原型**（单文件 HTML，无后端、无数据库）。模拟一套组学数据挖掘平台：
从「建项目 → 导数据 → 配参数 → 跑流程 → 看结果」的完整链路，共 **17 个页面**。

| 项 | 值 |
|---|---|
| 技术形态 | 静态单文件 HTML + 内联 CSS/JS，Tailwind 编译期内联，FontAwesome SVG 内联 |
| 源码 | `prototype/src/app.html`（2,398 行）· `app.css`（2,318 行）· `app.js`（12,382 行） |
| 产物 | `prototype/index.html` 5,251,186 字节（零外部依赖，断网可开） |
| 标注 | 34 条交互说明，注入后显示为页面上的圆点（右上角开关） |
| 截图 | 93 张，`prototype/.shots/` |
| 回归 | **603/603 全绿**（CDP 直连驱动真实浏览器） |
| 需求源 | `~/Desktop/天中医需求梳理-组学.xlsx`；设计方案 `组学数据智能挖掘系统-Demo设计方案.md` |

**一句话定位**：这是给甲方演示与内部对齐用的**可交互 Demo**，不是生产系统。数据是虚构的，
后端是留白的接口位（`build()` 里只换实现）。改它时按「演示可信度」而非「工程完备度」权衡。

---

## 1. 接手前必须知道的 5 件事

1. **产物是构建出来的，不是手改的。** 改 `prototype/src/` 三个文件 → 跑 build → 跑注入 → 才得到
   `index.html`。**直接改 `index.html` 会被下一次 build 覆盖。**
2. **build 之后必须重跑标注注入**，否则产物只有 1.5MB（正常 5.2MB），标注全部消失。
3. **项目没有 git。** 版本靠 `prototype/_backup-v1/vNN-名字/` 还原点（已有 v3→v60 共 40+ 个）。
   改动前先建还原点，这是本项目唯一的回滚手段。
4. **改动必须配断言。** 这个项目的价值在于「每个设计决策都有回归断着」。新增功能要同时在
   `verify.py` 加断言，否则下次改动会静默改坏已有能力而无人知晓。
5. **注释分两套，写反代价极大。** `verify.py` 里 `DRIVE = r"""…"""` 串**内是 JS**（注释 `//` / `/* */`），
   串**外的 Python 只能用 `#`**。写反 → 4 秒 SyntaxError，白等 4 分半回归。

---

## 2. 环境与工具链

### 2.1 运行时（已装好，别换）

| 用途 | 路径 | 说明 |
|---|---|---|
| Python（跑验证） | `/Users/yummy/.workbuddy/binaries/python/envs/default/bin/python` | **只有这个 venv 有 `websocket-client`**，用系统 python 会挂 |
| Node（构建/语法检查） | `/Users/yummy/.workbuddy/binaries/node/versions/22.22.2-6/bin/node` | |
| Chrome | `/Applications/Google Chrome.app/…/Google Chrome` | 验证靠它；`CHROME_BIN` 可覆盖 |
| node_modules | `~/.workbuddy/binaries/node/workspace/node_modules` | Tailwind + FontAwesome；`prototype/node_modules` 是指向它的软链 |

### 2.2 换机器 / 换目录时怎么办

`build.js` 与 `verify.py` 已**改为路径可移植**（v61）：目录从脚本自身位置推导，
node_modules 按 `NODE_MODULES_DIR` → 向上逐级查找 → WorkBuddy 共享工作区 顺序解析，
Chrome 按 `CHROME_BIN` → 常见安装位置 顺序探测。

所以**整个 `prototype/` 目录可以整体拷走**，在新位置直接跑：

```bash
cd /新路径/prototype
node build.js          # 需要 node_modules；缺了就 NODE_MODULES_DIR=... 指定
```

若 `node_modules` 不在共享工作区，先装一次：

```bash
npm i @fortawesome/fontawesome-free tailwindcss
# 然后 NODE_MODULES_DIR=$(pwd)/node_modules node build.js
```

### 2.3 外部依赖（项目内不存在，需单独获取）

| 依赖 | 用途 | 缺失后果 |
|---|---|---|
| `~/.workbuddy/skills/prototype-annotation/` | 标注注入脚本 | 产物少 3.7MB、标注全丢 |
| Chrome | 回归验证 | 跑不了 verify |
| `websocket-client`（Python 包） | CDP 通信 | 跑不了 verify |

---

## 3. 日常操作：四条命令

### 3.1 改完代码 → 出新产物

```bash
cd ~/WorkBuddy/天中医

# ① 语法预检（必做，能省掉 4 分半的等待）
node --check prototype/src/app.js
python3 -c "import ast; ast.parse(open('prototype/verify.py',encoding='utf-8').read())"

# ② 构建（产出 index.html + index-cdn.html，并跑自检）
node prototype/build.js

# ③ 注入标注（漏了 → 产物只有 1.5MB）
node ~/.workbuddy/skills/prototype-annotation/scripts/inject-web-annotations.mjs \
     prototype/index.html prototype/annotations.json
```

**build.js 自检会拦下的问题**（不必自己查）：缺页面、缺图标、页面 id 非法、
`window.IMG_URI` 键名被替换、加载即发起的外部请求、注释掉的内容残留。

### 3.2 跑回归（4 分半）

```bash
cd ~/WorkBuddy/天中医
CFFIXED_USER_HOME=/tmp/_cdp_home \
  /Users/yummy/.workbuddy/binaries/python/envs/default/bin/python prototype/verify.py
```

**完成判据只看最后一行的 `Z_DONE = ok (N/N)`**，不看退出码。
Chrome 的 GoogleUpdater 会删家目录文件被沙箱拦 → 退出码显示 failed 但判定是 ok，这是常态。

`CFFIXED_USER_HOME` 必钉：Chrome 启动时派 `GoogleUpdater --wake` 子进程，
它删 `~/Library/…/RLZStore.plist` 和 `~/Downloads/.com.google.Chrome.*`，
**这些路径不看 `$HOME`，只认 `CFFIXED_USER_HOME`**。不钉住的表现是「跑到 2 分半整棵进程树被杀、
日志里连判定行都没有」。短探针不会中招，所以容易误判成「代码问题」。

### 3.3 建还原点（改代码前必做）

```bash
cd ~/WorkBuddy/天中医/prototype
mkdir -p _backup-v1/v61-你的改动名
cp src/app.js src/app.css src/app.html build.js verify.py annotations.json _backup-v1/v61-你的改动名/
```

### 3.4 发布到公网

```bash
cd ~/WorkBuddy/天中医
cp prototype/index.html deploy-static/index.html     # ← 漏这步就发旧文件（v58 漏发两轮的根因）
```

然后调用发布工具（`workbuddy_sites_deploy`，参数见 §8）。发布后**必须**重新 `curl` 校验：

```bash
curl -s -o /tmp/live.html https://omics-mining-prototype.app.workbuddy.host/
md5 -q /tmp/live.html prototype/index.html          # 双向一致
wc -c < /tmp/live.html                                # 应等于本地产物体积
grep -c "data-orchextel" /tmp/live.html              # 关键钩子命中数
```

**体积对但钩子为 0** = 发的是旧文件或 CDN 未刷新。
**线上是单文件、没有 `assets/` 目录** → 验封面要 grep `window.IMG_URI` 的键名是否完好，只对体积发现不了图裂。

---

## 4. 目录地图

```
~/WorkBuddy/天中医/
├── HANDOFF.md                        ← 本文件
├── prototype/                        ★ 原型根（改这里）
│   ├── src/
│   │   ├── app.html    2,398 行   页面结构（17 个 #page-* 区块）
│   │   ├── app.css     2,318 行   样式（Tailwind 源 + 自定义层）
│   │   └── app.js     12,382 行   ★ 全部逻辑与数据（单文件巨石）
│   ├── build.js                     构建脚本（5 步 + 自检）
│   ├── verify.py                    回归验证（603 条断言 + 93 张截图）
│   ├── annotations.json             标注数据（34 条）
│   ├── index.html                   ★ 产物（构建生成，勿手改）
│   ├── index-cdn.html               在线分享版（CDN 版）
│   ├── assets/                      6 张图片（封面/头像/hero）
│   ├── .build/tw.css                Tailwind 中间产物
│   ├── .shots/                      93 张截图
│   ├── _backup-v1/                  还原点（v3 → v60，40+ 个）
│   └── 原型设计说明.md               ★ 239KB，逐版本 §NN 的设计决策全记录
├── deploy-static/index.html         公网发布目录（与 prototype/index.html 同步）
├── .workbuddy/
│   ├── memory/                      ★ 长期记忆与参考资料
│   │   ├── MEMORY.md                必守结论（改前必读）
│   │   ├── 2026-10-*.md             按日工作日志
│   │   ├── REF-背景.md              已办先例的追溯
│   │   ├── REF-踩坑.md              35KB 踩坑详版
│   │   ├── REF-构建验证.md          21KB 构建与断言守卫生章
│   │   ├── REF-界面定稿.md          32KB 浮层/导航/样本档案定稿
│   │   └── REF-工具链.md            跨项目工具链约定
│   └── applications.yaml            公网应用登记
├── 组学数据智能挖掘系统-Demo设计方案.md   需求澄清与设计方案
├── AI组学数据智能挖掘系统/            历史交付包（**刻意保留旧名**）
└── AI组学数据智能挖掘系统-原型.zip     历史交付包
```

**`prototype/原型设计说明.md` 是理解「为什么这么设计」的第一手材料**（239KB，245 个标题）。
每个版本一节（`§NN vNN：标题`），从 v13 到 v60 逐版记录动机、方案取舍、被否决的做法。

---

## 5. 硬不变式（改这些必须四处一起改）

### 5.1 结构性

| 不变式 | 值 | 违反后果 |
|---|---|---|
| 页面总数 | **17** | 数量断言红 |
| 左栏 | **4 组 10 项**（工作台顶级叶子 + 数据资产 2 + 项目空间 1 + 知识赋能 3 + 系统管理 3） | 数量断言红 |
| 菜单外页 | **7**（p02·p04·p05·p06·p07·projdetail·sample） | 同上 |
| `STEPS` | **5 步** | 向导断言红 |
| 左栏徽标 | **0 枚**（数量徽标已整块撤销） | 视觉回归红 |

> ⚠️ **禁止写「页数 = 菜单项数 + N」这类魔数**。正确判据是：
> 「每个页要么在菜单里、要么落进 `offMenu`」。

### 5.2 页面清单硬编码四处（动结构必须一起改）

1. `build.js` 的 `pages` 数组
2. `verify.py` 的逐页循环
3. `verify.py` 的 `SHOT_PAGE` 登记表
4. 截图脚本的 setup

「菜单项数」另有三处：`ia.navItems`、`v37align.navItems`、`projRailRestore.globalItems`。

### 5.3 命名

系统名全站统一「**组学数据智能挖掘系统**」，出现在**四处**：
`app.html` 的 `<title>` + `<meta description>` + 顶栏 `.tnav-name`；`app.js` 头注释；
`annotations.json` 的 `globalMeta.name` + overview 正文。

改名必须**实测**顶栏品牌位宽度（固定 `calc(var(--rail-w) - 16px)` = 236px 且 nowrap）——
`scrollWidth <= clientWidth` 且 `box <= brandW`，**不许按字数乘字号估算**。
`verify.py` 里 `SYS_NAME` 从产物 `<title>` 真读 + `EXPECT_SYS_NAME` 钉死 + 启动 assert
（防「改名后断言按旧名判、永远绿」）。

> 历史交付包（`AI组学数据智能挖掘系统/` 与 `-原型.zip`）**刻意保留旧名**，不要去「修正」。

### 5.4 视觉 token

青色系：主 `#106376` / 深 `#0A4655` / 浅底 `#E3F0F3`。
**两套 token 必须同改**：CSS 的 `--color-brand*` + app.js 的 `C.*`。
改完跑 theme / legacyBlue / contrast / chartInkMin 四条回归。
有色底上的文字一律走 `onFill()`；状态色 ok `#0A6B49` / warn `#8A5200`。

---

## 6. 核心架构：数据在哪里

`app.js` 是单文件巨石，但**数据是集中的**。改内容先找对应常量。

| 常量 | 位置 | 内容 |
|---|---|---|
| `PUB_DS` | app.js:867 | 公开数据集 6 条（人/鼠各 3） |
| `DEMO_DS` | app.js:904 | 示例数据集（`PUB_DS` + `SAMPLE_DS` 派生），出厂快照在 `DEMO_DS_DEF` |
| `REF_GENOMES` | app.js:910 | 参考基因组 hg38 / hg19 / mm10（**物种守卫不能删**） |
| `RUN_STAGES` | app.js:1659 | 任务流水线阶段（p06 横向 `.pipe` 唯一来源） |
| `STEPS` | app.js:3116 | 5 步向导 |
| `ANALYSIS_FLOW` | app.js:4742 | 流程变体 → 画布映射 |
| `PROJECTS` | app.js:4823 | 13 条项目，新建自增 `P-2026-014` |
| `PROJ_GROUPS` | app.js:4898 | 7 条项目组，全站唯一名单来源 |
| `ROLES` | app.js:4961 | **三档角色** super / admin / user |
| `KB_EXT_BASE` | app.js:5213 | 知识库外部系统地址唯一来源 |
| `PDTABS` | app.js:5590 | 项目概况 7 个页签 |
| `PROJ_LINE` | app.js:5618 | 血缘行（**用可读正则匹配，别退回按 id 哈希**） |
| `PNEW_MODES` | app.js:6671 | 新建项目分流屏 |
| `CANVAS` | app.js:8276 | 流程画布唯一事实来源 |
| `ORCH_EXT_URL` | app.js:8661 | 外部编排系统地址唯一来源 |
| `MISS_PROT` | app.js:9116 | 缺蛋白组 4 例（同时是质控不合格的 4 例） |
| `SAMP_ARCHIVE` | app.js:9220 | 样本档案 75 例（4 手写 + 71 生成） |
| `LIN_AXIS` | app.js:9686 | 血缘方向 col / row |
| `DL` | app.js:11240 | 下载注册表（所有导出走这里） |
| `NAVGROUPS` | app.js:5156 | **左栏结构唯一来源** |
| `PAGES` | app.js:3082 | 路由表 |
| `ICON_REGISTRY` | app.js 头部 | 数据驱动的图标名登记 |

### 6.1 数据口径（勿凭空改）

- 三组学 **75 例**：75·75/75/71，共同 71 —— 两页现算 vs 静态对照断言
- `PUB_DS` 6 数据集 ｜ `PROJECTS` 13 条 ｜ `SAMP_ARCHIVE` 75 例 ｜ `PROJ_GROUPS` 7 条
- `MISS_PROT` 4 例补登用**队列外 ID**（S076）

### 6.2 权限模型（三档，一套到底）

```js
canManage()  → super || admin     // 可管理项目组
canConfig()  → super               // 可配置平台公共资产（系统文件、示例数据集）
isBasic()    → user                // 只读视角
```

- **身份入口全站只有顶栏 `#userSw`**，`setRole()` 一处改四处（顶栏 / `body[data-role]` / 三个受影响页 / 菜单高亮）
- 旧「临床医生 ⇄ 生信工程师」切换器与项目组页页头开关**已撤**，
  差异改由 `body[data-role="user"] .eng-only{display:none}` 表达
- **权限不足不隐藏控件，只禁用 + 说明原因**，事件委托里有第二道同样判断
- 系统文件写权限用 `fmCanWrite()` = `canConfig()`（**不是** `canManage()`，它是平台公共资产）

### 6.3 外部系统接入（两处 iframe）

| 位置 | 地址来源 | 路径 |
|---|---|---|
| 知识库三页 | `KB_EXT_BASE` | `/ke`（医学）· `/kb`（自有）· `/kg`（图谱），**无 `menu` 参数** |
| 流程编排全屏 | `ORCH_EXT_URL` | `http://aizx.jwzcloud.com:1888/` |

两处都是**运行时 `setAttribute('src', url)` 挂载** → **产物 HTML 里没有 `src` 属性**，
只能靠运行时探针断（`__kbView(id, view)` / `__orchExt(view)`）。

**iframe 的两条硬约束**（前端绕不过）：
1. 能否嵌套由对方的 `X-Frame-Options` / CSP `frame-ancestors` 决定 → **动手前先 `curl -D`**
2. `load` 事件在被拒/超时时**根本不触发** → 必须 `setTimeout` 兜底，否则用户只看到白板

> **断言里不要断「iframe 加载成功」**：跨域读不到，成败取决于跑回归的机器有没有接那个网络 ——
> 那是环境不是缺陷，写进断言等于埋一颗「换台机器就红」的雷。

### 6.4 流程编排的两视图共存（v60，改这块前必读）

```
点「外部编排」→ #orch 铺满视口 → .orchext 接管画布
   bar 上「返回站内画布」→ 同一全屏壳换回画布（仍保持放大，v21 那条能力没撤）
再点「收起」/ Esc / 跳页 → 整体退出
```

`setOrchExt(on)` 管**内容**，`toggleOrchFull(force)` 管**尺寸**，两者正交，
**退出时必须一起复位**（否则下次进编排页是块白板）。

> 「全屏」按钮原本的职责是放大站内画布（DAG 缩放太小，节点文字压到 ~7px），
> 这条能力有 13 条断言正断着。**改按钮语义 ≠ 撤该按钮原有能力** → 做成两视图共存。

---

## 7. 改东西的固定动作

### 7.1 增删一个模块落 6 处（漏 ④ 最隐蔽）

① 数据层 → ② 渲染函数 → ③ 事件分支 → ④ **`init()` 调用** → ⑤ 页面区块 → ⑥ 样式

漏 ④ 的症状：页面正常、静态看着对，但区块永远空且不报错。

新增列表类模块还要落：筛选下拉选项**从数据现算**（写死则新值筛不到）、
列表状态归零接口、渲染函数接入主渲染与选中函数。

### 7.2 重命名 / 重组左栏同改 8 处

`NAVGROUPS` / `PAGES` / `STEPS` / 各页 `phead__eye`·`h1`·`d` /
**跨页文案**（toast·note·alert·弹窗·智能体话术·导出文件名）/ `data-go` /
`build.js` 的 `pages` / `verify.py` 逐页循环 + 面包屑断言 + 截图。

改完**全文件 grep 旧名（含注释）**。

### 7.3 删除前先列「牵连清单」

① `#page-xx` 区块 ② 左栏入口 ③ **其它页面指向它的入口** ④ `PAGES` 路由表 ⑤ 描述它的文案。
删完**补守卫防复活**（`build.js` 里有 `id="page-p09"` 不得复活这类检查）。

### 7.4 断言写法（判据必须可测）

- 数字**现算**或「两处对同一个数」，不写死当前数据量（样本档案段会补登一例，其后 `== 75` 全挂）
- `need(label, cond, got)` 的 `got` **必须含全部参与判定的字段**（漏写的那一个就是唯一会红的那一个）
- 新读数的**取值路径必须与采集段完全一致**
- 探针三坑：① 会切页的段**收尾必须回位** ② **段首起点必须显式设定** ③ `<g>` 等 SVGElement 没有 `.click()`
- **「有 `<img>` 元素」≠「有图」**：图片类断言必须读运行时 `naturalWidth > 0`
- **「数量相等」≠「一一对应」**：比个数一律改成按名字比双向差集
- 隐藏元素几何恒为 0 → 判「是否展开」用 `getComputedStyle().display`，读几何前先滚进视口

### 7.5 截图

- `shot()` 按文件名查 `SHOT_PAGE`，**未登记判不合格**，另有反向守卫「登记的都必须产出」
- 改名/作废后必须清 `.shots/` 的旧文件
- setup 选错选择器是**静默失败**（md5 相同 = setup 没执行）
- 站内有 `svg.spin` 无限动画 → **截图 md5 天然不可复现**，别拿它当「零外溢」证据
- `scrollIntoView` 会把要展示的东西顶出视口 → 改设 `#content.scrollTop = 0`
- 浮层状态会残留 → 每张 setup 开头先关掉上一张的浮层

---

## 8. 公网发布

| 项 | 值 |
|---|---|
| 链接 | `https://omics-mining-prototype.app.workbuddy.host/` |
| 应用名 | 组学数据挖掘系统 |
| 应用 id | `wbapp_L6Oh0bcvmyU2tHTybo118G`（登记在 `.workbuddy/applications.yaml`） |
| 发布目录 | `~/WorkBuddy/天中医/deploy-static/`（**只含 `index.html`，无 `assets/`**） |
| 发布工具 | `workbuddy_sites_deploy`，参数 `action=deploy` / `appName=组学数据挖掘系统` / `directory=…/deploy-static` / `domainPrefix=omics-mining-prototype` / `entryHtml=index.html` / `language=static` / `userAskedToPublish=true` |

**两条硬规则**：
1. **发布前必做** `cp prototype/index.html deploy-static/index.html` ——
   部署目录**不会**自动跟随本地产物。2026-10-17 的 v58 就是这样漏发了两轮。
2. **发布授权不跨轮** —— 每轮都要用户在**最新消息**里明确说「更新/发布」，
   否则工具返回 `sites_deploy_needs_confirmation`。

发布后必验：重新 `curl` → 体积等于本地产物 → md5 双向一致 → grep 关键钩子命中数。
**别只看工具返回的 `verified: true`**。

---

## 9. 踩过的坑（最要命的 12 条）

> 全量见 `.workbuddy/memory/REF-踩坑.md`（35KB）。

### 会直接让人跑偏的
1. **改/删 DOM 钩子或探针名，先 grep 全仓**。漏掉 verify 里一处 `q('[data-…]').click()` 就是
   `null.click()` → 抛错打断整段驱动，其后读数全成 `<缺失>`（已犯七次）。
2. **Bash 里的 `grep` 不可靠**（BSD grep 不支持 `\|`、`\b`）→ 一律用内置 Grep 工具。
3. **批量替换前必须确认作用域**。v58 为 iframe 把 `data-kbopen` 全局 replace 成
   `data-kbframeopen`，把站内知识库原有两处渲染 + 一处事件委托一起改了。
   修法：**只动自己新加的那几处、逐个 Edit**；替换后 grep 新旧两个名字，
   确认**旧名的原有处数没变**。
4. **拆分/搬位 DOM 后，grep 出的每处引用都要重看**。另一半更隐蔽：click 后 `renderNav()`
   重画整条左栏，旧节点全失效 → 必须「拿到就点 / 每步重取」，存变量跨一步 = 握 null。
5. **改断言前先分清红的是实现还是判据**。v60 首跑 601/603，两条 FAIL 性质完全不同：
   一条是真实现 bug（初始态没落属性），一条是判据写错。**别一律往实现上归因去改代码。**
6. **注释分两套**。`DRIVE` 串内是 JS，串外是 Python。写反 → `SyntaxError: invalid character '：'`
   （4 秒就挂）或 `Uncaught SyntaxError`（行号是 DRIVE 内偏移，极难定位）。

### 构建与静默降级
7. **「查表失败就静默降级」的故障必须断查表本身，不能断降级后的产物**（最高价值）。
   `assetAbs()` = `IMG_URI['assets/'+p] || 'assets/'+p` —— 查不到就退回相对路径；
   build 的「路径→base64 替换」把**映射表键名**也换成了 base64 → 查表永远落空。
   **本地有 `assets/` 照样出图、回归全绿；`deploy-static/` 单文件无 `assets/` → 整片图裂。**
   修法：① 注入处只埋占位符，**所有替换做完再回填**（顺序是硬约束）；
   ② 自检改为解析 `window.IMG_URI` 断「键名完好 + 条目数 + 值前缀」。
8. **全文档 `split-join` 替换会把任何刚注入的、键名等于该路径的结构一起改掉** ——
   注入必须放在替换**之后**，或先埋占位符最后回填。
9. **「数量相等」≠「一一对应」**；**「量到 0」先分清是「没有」还是「量错样本」**。
   折叠态列表只有文件夹行，量文件行恒为 0 —— 探针里先展开、量完**按快照还原**。
10. **`A == B 且 > 0` 里的 `> 0` 不能省** —— 少了就是 `0 == 0` 假绿。

### 布局与状态
11. **「不渲染」改「常驻 + `hidden`」要三处同步**：CSS 兜底（`.btn` 是 inline-flex、
    `.orch__b` 是 grid，UA 规则压不住类选择器 → **grid/flex 布局类一律要单独声明 `[hidden]`**）、
    探针量 `hidden` + 实际宽度 > 0、生成后补一次；另配一条反向断言。
12. **判据属性（`data-*` / 类名）必须有初始值**，不能只在状态切换时写。
    v60 的 `data-orchview` 只在 `setOrchExt()` 里赋值，没进过全屏的编排页上是 `null` ——
    「默认是站内画布」在 DOM 上零证据。初始化末尾显式调一次落默认。

**另外三条高频**：
- **并列 flex 子项之间不能直接比父子高度**（iframe 与顶栏是兄弟，iframe 天然矮一个顶栏高度）
- **共用页面状态用完要还原**（借某个上下文测试要在 `finally` 里还回去）
- **删一段前问「谁在借它」**：撤入口 ≠ 撤能力，检查项一条不减，另补「文案残影」断言

---

## 10. 接手建议（照这个顺序做）

1. 读 `.workbuddy/memory/MEMORY.md`（必守结论，约 20KB）
2. 读 `prototype/原型设计说明.md` 的 §51、§52（最近两版的设计取舍）
3. 跑一遍 §3.2 的回归，确认基线是 **603/603**（对不上先查环境，别改代码）
4. 明确要改什么 → 建还原点（§3.3）→ 改 `src/` → §3.1 出产物 → §3.2 回归
5. 补断言 → 全绿 → 更新 `原型设计说明.md` 追加一节 `§NN` → 更新 `MEMORY.md` 与当日日志
6. 要发布 → §3.4 + §8

**改动完成的判据**（四条同时满足）：
- `Z_DONE = ok (N/N)`，N ≥ 603
- 新增功能有对应断言
- `原型设计说明.md` 追加了本版章节
- `MEMORY.md` 的「基线」行已更新

---

## 11. 后续可做的事（未排序，按价值）

| # | 事项 | 说明 |
|---|---|---|
| 1 | **建 git 仓库** | 目前只有还原点做版本控制，是最大的单点风险 |
| 2 | 补 `prototype/_backup-v1` 的索引文档 | 40+ 个还原点，只有目录名，看不出改了什么 |
| 3 | 拆 `app.js` | 12,382 行单文件巨石；建议先按「数据层 / 渲染层 / 交互层」三段切，**不要一次重构** |
| 4 | 需求表里的 P0（组学分析收口样本 ID 对齐） | 需求源表里的 P0 项，尚未在原型落地 |
| 5 | 阈值与口径待院方确认 | `原型设计说明.md` §2 列了 3 项 |
| 6 | 外部系统的可达性兜底 | 两个 iframe 在不同网络环境下表现不同，考虑做「检测到不可达时给更明确的指引」 |

---

## 12. 联系方式与语境

- **用户**：Yamei（产品经理）。偏好：中文、结构化输出、可验证数字（说「603/603」比说「已验证」有用）、
  蓝色系主题、响应式、表格操作列字号别太小。
- **沟通偏好**：涉及方案取舍时希望给选项再拍板，不希望直接替他做产品决策。
- **本文件维护**：每轮实质改动后更新 §0 基线行、§8 状态行；新增大版本时追加 `原型设计说明.md` 章节。
