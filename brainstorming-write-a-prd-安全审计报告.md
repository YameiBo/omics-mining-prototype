# 🔍 安全审计报告（brainstorming + write-a-prd）

## 📊 执行摘要

| 项目 | brainstorming | write-a-prd |
|---|---|---|
| 来源仓库 | github.com/obra/superpowers（v6.3.0，MIT，作者 Jesse Vincent） | github.com/mattpocock/skills（历史版本，2026-04-17 前） |
| 安装位置 | `~/.workbuddy/skills/brainstorming/` | `~/.workbuddy/skills/write-a-prd/` |
| 文件构成 | 3 个 md + 4 个脚本（server.cjs / helper.js / start-server.sh / stop-server.sh / frame-template.html） | 1 个 SKILL.md（74 行纯 Markdown） |
| 完整性 | MD5 `b8da79a0…`（SKILL.md）、`8a3f2a62…`（server.cjs）与上游一致 | MD5 `e02173d7…` 与提取源一致 |
| 发现问题 | 0 个 P0，0 个 P1，3 条加固/隐私提示 | 0 个 P0，0 个 P1 |
| 安全评分 | 90 / 100 | 98 / 100 |

**审计时间**：2026-09-14
**结论**：✅ 两者均为 **P2 — 可安全使用**，无供应链投毒风险。

---

## 🔴 P0 阻断级风险发现

✅ 未发现 P0 风险。

## ⚠️ P1 需关注风险发现

✅ 未发现 P1 风险（无全局依赖安装、无非官方源安装、元数据无异常）。

---

## 📋 详细检查结果：brainstorming

### 命令执行检查
关键词：curl / wget / eval / exec / subprocess / popen

| 位置 | 内容 | 判定 |
|---|---|---|
| server.cjs:540 | `cp.exec(process.env.BRAINSTORM_OPEN_CMD + ' ' + JSON.stringify(url), ...)` | 执行**运维方自行提供**的环境变量；未设置该变量时走 `execFile`（无 shell）。默认路径安全 |
| server.cjs:547 | `cp.execFile(launcher.bin, launcher.args)` | 无 shell 调用 `open`/`xdg-open` 打开本地页面，安全 |
| start-server.sh:180 | `nohup env ... node server.cjs > LOG 2>&1 &` | 启动自身服务，本地行为 |
| stop-server.sh:86,98 | `kill "$pid"` / `kill -9 "$pid"` | **先校验进程身份**（见下），非盲杀 |

### 隐蔽执行检查
关键词：silently / --quiet / nohup / disown / /dev/null / hidden

- 命中 `nohup`、`disown`、`2>&1`：均为**常驻本地服务**的标准后台化写法，日志写入 `$STATE_DIR/server.log`，非隐蔽执行。
- 未发现输出重定向至 `/dev/null`。

### 敏感路径与凭证检查
关键词：`~/.ssh` / `/etc/passwd` / `.env` / credentials / token / password / api_key

- **0 命中**。全仓不读取任何系统凭证文件或用户配置目录。
- 自主生成的会话密钥（`crypto.randomBytes(32)`）仅写入自有会话目录，且 `chmod 0600`。

### 网络请求检查
- 出站请求目标（仅 1 个）：`https://primeradiant.com/brand/superpowers-visual-brainstorming-logo.png`（server.cjs:106）
- 本地监听：`http://127.0.0.1:<随机高位端口>`，**仅回环地址**
- Base64 可疑编码：未发现

### 文件操作检查
- 写入范围：`/tmp/brainstorm-<sessionId>/`（默认）或 `<project>/.superpowers/brainstorm/`（`--project-dir` 时）
- 删除操作：仅 `stop-server.sh:114` 的 `rm -rf "$SESSION_DIR"`，且前置守卫为 `[[ "$SESSION_DIR" == /tmp/* ]]`
- **无 rm -rf 通配符、无用户目录递归删除**

### 权限提升检查
- `sudo` / `chown` / `chmod 777`：**0 命中**
- 出现的 `chmod` 为收紧权限：`umask 077`、`chmod 600`（降权而非提权）

### 依赖安装风险
- `pip install` / `npm install` / `brew install`：**0 命中**，零依赖（纯 Node 内置模块实现 WebSocket）
- 无全局安装、无非官方源、无 `git+https://` 安装

### 元数据检查
- `name: brainstorming`、`description` 87 字符，无重复字符、无超长
- `license`：仓库根有 MIT LICENSE（Copyright 2025 Jesse Vincent）
- 无可执行 frontmatter 字段

### 技能描述与实际行为一致性
✅ 一致。SKILL.md 声明的能力（对话式需求澄清 + 可选可视化伴生页面）与脚本行为完全对应，无隐藏动作。

---

## 📋 详细检查结果：write-a-prd

- 全文 74 行纯 Markdown，**无脚本、无依赖、无网络请求、无文件删除**
- 唯一外部动作是第 5 步「将 PRD 作为 GitHub Issue 提交」——属正常工具调用指令，非脚本行为
- 命令执行 / 敏感路径 / 凭证 / Base64：**全部 0 命中**
- 元数据：`name: write-a-prd`，`description` 195 字符，正常
- 描述与行为一致性：✅ 一致

---

## 💡 需知悉的 3 条提示（不构成风险）

### 提示 1｜可视化伴生页面会向第三方域名发起一次图片请求（隐私）
- **位置**：server.cjs:106、249
- **现象**：伴生页面 HTML 内嵌 `primeradiant.com` 的 logo 图片。用户浏览器打开该页面时会向该域名发起请求，暴露本机公网 IP 与「使用了该技能」这一事实。
- **缓解**：该请求带 `referrerpolicy="no-referrer"`，不含页面地址；且设置环境变量 `SUPERPOWERS_DISABLE_TELEMETRY=1` 后 logo 与外链均不再注入。仅在用户**主动同意**开启可视化伴生页面时才可能发生。
- **建议**：如需完全离线，开启伴生页面前设置该环境变量。

### 提示 2｜stop-server.sh 的目录守卫是字符串前缀匹配（低危加固）
- **位置**：stop-server.sh:113 `if [[ "$SESSION_DIR" == /tmp/* ]]`
- **现象**：未做路径规范化，理论上 `/tmp/../...` 这类含 `..` 的入参也能通过前缀判断。实际调用方只会传入服务自身回报的会话目录，属理论风险。
- **建议**：改为 `realpath` 后再比较；或维持现状并知悉。

### 提示 3｜`BRAINSTORM_OPEN_CMD` 可执行任意命令（自设即自担）
- **位置**：server.cjs:540
- **现象**：该环境变量由运维方（你/agent）设置，一旦被设置就会以 shell 形式拼接执行，且代码注释明确声明「trusted operator input」。
- **建议**：不要从外部输入透传该变量。默认不设置时走安全的 `execFile` 路径。

---

## ✅ 审计结论

**风险等级**：**P2 — 可以安全使用**

**判定依据**：
1. 两者均未被发现「下载并执行」「读取敏感信息并外发」「破坏性命令」「隐蔽执行危险操作」「权限提升配合危险操作」的 P0 组合。
2. brainstorming 的脚本虽然会启动本地 HTTP/WS 服务并打开浏览器，但**需要用户明确同意**（SKILL.md 第 240 行硬性要求「该提议必须单独成一条消息」），且监听回环地址、带随机 token 鉴权、Origin 校验、符号链接拒绝、常量时间比较、CSP 与 `X-Frame-Options: DENY`——安全设计质量高于同类项目平均水平。
3. write-a-prd 无任何可执行代码。

**安装后改动记录**（已如实记录，便于日后比对上游）：
- `brainstorming/SKILL.md` 末行跨文件引用由仓库相对路径 `skills/brainstorming/visual-companion.md` 改为同目录相对路径 `visual-companion.md`。原因：安装后仓库层级不存在，原路径无法解析。除此外全文逐字节与上游一致（MD5 校验见执行摘要）。
