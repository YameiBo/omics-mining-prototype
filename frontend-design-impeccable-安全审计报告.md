# 🔍 安全审计报告（frontend-design + impeccable）

**审计时间**：2026-09-14
**审计依据**：skills 安全审计流程（供应链投毒风险，11 步）

---

## 📊 执行摘要

| 项目 | frontend-design | impeccable |
|---|---|---|
| 来源仓库 | github.com/anthropics/skills | github.com/pbakaus/impeccable |
| 版本 / 许可 | 无版本号 / SKILL.md 内 Apache 2.0 声明 | v4.3.1（引擎 0.1.5）/ Apache 2.0 |
| 文件构成 | 2 个文件（SKILL.md 71 行 + LICENSE.txt） | 1 个 SKILL.md + 30+ 个 reference/*.md + 7 个脚本 + 1.1MB 字体索引 |
| 发现问题 | 0 个 P0，0 个 P1 | **1 个 P0**，0 个 P1 |
| 安全评分 | 98 / 100 | **40 / 100** |
| 处置 | ✅ 已安装 | 🚫 **暂缓安装，待用户明确确认** |

---

## 🚫 impeccable — P0 阻断级风险

### P0-1｜首次运行会自动下载并执行远程二进制（下载 + 执行）

**位置**

| 文件 | 行号 | 内容 |
|---|---|---|
| `SKILL.md` | 19 | “The launcher runs a self-contained binary that ships next to it or **is downloaded once on first run**” |
| `scripts/impeccable` | 87–89 | `# Last resort: fetch this version's binary for the current platform from the public release channel into the user cache. Needs network…` |
| `scripts/impeccable` | 121–126 | 拼接下载地址：`https://github.com/pbakaus/impeccable/releases/download/engine-v0.1.5/impeccable-darwin-arm64` |
| `scripts/impeccable` | 140, 196 | `fetch_url "$url"` → 校验通过后 `exec "$cached" "$@"` |
| `scripts/impeccable.cmd` | 64–72 | Windows 版同一逻辑（`curl.exe` 下载后执行） |

**触发条件**：调用任何一次 `"${CLAUDE_SKILL_DIR}/scripts/impeccable" <verb>`（SKILL.md 要求每次会话开始就跑 `impeccable context`）。由于本机不存在预装引擎（见下方证据），**第一次使用该技能就会触发下载并执行**。

**已验证的事实（本次实测，非推测）**

| 证据项 | 实测结果 |
|---|---|
| 仓库是否自带二进制 | ❌ 无。`skill/scripts/bin/` 与 `**/skills/impeccable/scripts/bin/` 均被 `.gitignore` 第 95–96 行忽略 |
| 下载源 | `github.com/pbakaus/impeccable/releases/download`（作者官方仓库 release） |
| 本机将命中的资产 | `impeccable-darwin-arm64`（本机 `uname -s -m` = `Darwin arm64`） |
| 资产实际大小 | **12,762,240 字节（约 12.2 MB）**，`content-type: application/octet-stream` |
| 校验文件 `.sha256` | ✅ 存在（HTTP 200），脚本会比对 |

**为什么仍判 P0**：审计标准中「skill 自动从远程下载内容并执行」属阻断级组合。是否恶意不在审计能力范围内——判定依据是**行为本身**：未经你逐个确认，一个 12 MB 的原生二进制会被下载、`chmod +x` 并**以你的用户权限执行**。

**存在的缓解措施（客观陈述，可降低但不消除风险）**

1. **校验和验证 + 失败即拒（fail closed）**：`.sha256` sidecar 无法获取、或本机无 `shasum`/`sha256sum` 工具时，**拒绝执行**而非放行（第 149–180 行）。
2. **空文件/被删除文件检查**：第 104–116 行，`check_download` 在下载、授权、移动、执行前反复校验。
3. **只在无本地引擎时才下载**：优先使用 `sibling bin/` → `~/.impeccable/bin/` → 版本化缓存 → PATH，均在下载之前。
4. **可用 `IMPECCABLE_BIN` 完全绕开下载**：指向自备引擎即可，脚本第 41–43 行优先取用。
5. `umask 077` 收紧缓存目录权限。

**残余风险**

- 校验文件与二进制**同源**（同一 GitHub release），只能防传输损坏，无法防「上游 release 被替换/重新打包」。
- 二进制无 Apple 签名/公证环节的说明；macOS 首次运行可能触发 Gatekeeper 拦截。
- 12 MB 原生引擎的实际行为**无法审计**（未下载，故其网络访问、文件操作均不可见）。这是本次审计的能力边界，必须如实告知。
- 该引擎还支持 `/impeccable hooks on` 安装**项目级 hook**（`.cursor/hooks.json` 显示为 `preToolUse` 钩子，每次编辑 UI 文件后自动运行检测器）。该操作需用户显式调用，非自动。

**修复/规避建议（按推荐度排序）**

1. **不安装**（本报告默认建议）：该技能的核心命令都依赖引擎，缺引擎时技能价值有限。
2. **先隔离验证再决定**：手动下载 release 资产，核对 `.sha256`，用 `codesign -dv` / `spctl -a -vv` 检查签名，或在独立目录/沙箱内试跑。
3. **自行从源码构建**：仓库含 `Cargo.toml` + `crates/`，可 `cargo build --release` 后通过 `IMPECCABLE_BIN` 指向自建产物，完全避开下载。
4. **若安装**：至少设 `IMPECCABLE_BIN` 固定二进制来源，不使用 `/impeccable hooks on`，并知悉后续 `impeccable update` 会再次拉取新版本二进制。

---

## ✅ frontend-design — P2 安全

### 命令执行检查
关键词：curl / wget / bash / sh / eval / exec / subprocess / popen → **0 命中**（唯一含 `sh` 的匹配是英文单词内字母组合）

### 敏感路径与凭证检查
`~/.ssh` / `.env` / credential / secret / api_key / password / `.aws` → **0 命中**
（`token` 有 2 处命中，均为设计术语 “token system / design tokens”，非凭证）

### 网络请求检查
唯一 URL 为 `http://www.apache.org/licenses/`，出现在 LICENSE.txt 的许可证正文中 → 非运行时请求

### 文件操作检查
`rm -rf` / unlink / rmtree / writeFile → **0 命中**（纯 Markdown，无文件操作指令）

### 权限提升 / 依赖安装检查
`sudo` / `chmod` / `chown` / `pip install` / `npm install` / `brew install` → **全部 0 命中**

### 元数据检查
`name: frontend-design`，`description` 217 字符，`license: Complete terms in LICENSE.txt`，无异常字段

### 描述与行为一致性
✅ 一致。SKILL.md 内容为设计方向、排版、避免模板化默认值的指导性内容，与声明能力完全对应，无隐藏动作。

---

## ✅ 审计结论

- **frontend-design**：**P2 — 可安全使用**。已安装至 `~/.workbuddy/skills/frontend-design/`，MD5 与上游逐字节一致（`7d6df6b2…` / LICENSE `2ee41112…`）。无任何改动。
- **impeccable**：**🚫 P0 — 未安装**。存在自动下载并执行远程原生二进制的行为组合，需你显式确认后方可继续。

---

## 📌 审计能力边界声明

1. 本审计**只覆盖仓库内的静态内容**（Markdown、shell/cmd 启动器、JS 文件），不覆盖被下载的 12 MB 原生二进制的实际行为。
2. `scripts/live-browser.js`（523 KB）与 `scripts/modern-screenshot.umd.js`（29 KB）已扫描：`eval(` / `new Function` **0 命中**，外部域名仅 `www.w3.org`（SVG 命名空间常量）与 `localhost`（本地开发服务器），未见遥测或数据外发端点。
3. `scripts/data/font-index.json`（1.1 MB）为 Google Fonts 索引数据，非可执行代码。

---

# 附：writing-plans + to-spec 安全审计（同批次补装）

**审计时间**：2026-09-14

## 📊 执行摘要

| 项目 | writing-plans | to-spec |
|---|---|---|
| 来源仓库 | github.com/obra/superpowers | github.com/mattpocock/skills |
| 获取方式 | raw.githubusercontent（GitHub API 直连，clone 通道当时 502） | git clone |
| 文件构成 | SKILL.md（171 行）+ plan-document-reviewer-prompt.md（49 行） | SKILL.md（75 行）+ agents/openai.yaml（6 行） |
| 完整性 | SKILL.md MD5 `fb54b593…`（与远端二次下载交叉验证一致） | MD5 `e3dfdcab…` / `886d06b1…` |
| 发现问题 | 0 个 P0，0 个 P1 | 0 个 P0，0 个 P1 |
| 安全评分 | 98 / 100 | 98 / 100 |
| 处置 | ✅ 已安装 | ✅ 已安装 |

## 📋 详细检查结果

下列 6 类关键词对 **4 个文件逐个扫描，全部 0 命中**：

| 检查项 | 关键词 | 命中数 |
|---|---|---|
| 命令执行 | curl / wget / eval( / exec( / os.system / subprocess / popen / shell_exec | 0 |
| 敏感路径与凭证 | `~/.ssh` / `/etc/passwd` / `.env` / credential / secret / api_key / password / private_key | 0 |
| 删除与权限 | rm -rf / unlink / rmtree / sudo / chmod / chown | 0 |
| 依赖安装 | pip install / npm install / npm i -g / brew install / go install | 0 |
| 网络外链 | http(s):// 任意 URL | 0 |
| 隐蔽执行 | nohup / disown / /dev/null / --quiet / hidden | 0 |

两个技能均为**纯 Markdown 指令文档**，无可执行代码，元数据正常，描述与内容一致。

## ⚠️ 功能依赖提示（非安全风险）

1. **writing-plans**：正文第 61、166 行把 `superpowers:subagent-driven-development` 与 `superpowers:executing-plans` 标为 **REQUIRED SUB-SKILL**。这两个技能**未安装**，且 `superpowers:` 命名空间前缀在当前环境下不解析。实际使用时计划文档能正常产出，但「按计划执行」环节会缺失，需人工接手。
2. **to-spec**：frontmatter 含 `disable-model-invocation: true`，只能由用户显式调用（不能自动触发）。正文第 9 行要求先运行 `/setup-matt-pocock-skills` 注入 issue tracker 配置，**该技能未安装**；未配置时它会提示你去跑 setup，无法独立完成「发布到 issue tracker」这一步。

## ✅ 审计结论

**风险等级**：两者均为 **P2 — 可以安全使用**，已安装至 `~/.workbuddy/skills/`，未做任何内容改动。

