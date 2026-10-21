# 🔍 安全审计报告：pm-agile-workflow

## 📊 执行摘要
- **审计对象**: `pm-agile-workflow`（来源 https://github.com/arcsin1/pm-agile-workflow）
- **审计时间**: 2026-09-14 16:21
- **审计范围**: 仓库全部文件共 2 个（`README.md` 227 行、`pm-agile-workflow/SKILL.md` 456 行），无脚本、无二进制、无隐藏文件
- **发现问题总数**: 1 个（均为提示级，无阻断项）
  - 🔴 P0 阻断级: 0 个
  - ⚠️ P1 需关注: 0 个
  - ℹ️ 提示级: 1 个（自动打开浏览器行为）
- **安全评分**: 95 / 100
- **审计结论**: ✅ **P2 — 可以安全使用**

---

## 🔴 P0 阻断级风险发现
✅ 未发现 P0 风险

---

## ⚠️ P1 需关注风险发现
✅ 未发现 P1 风险

---

## ℹ️ 提示级发现（不构成投毒风险）

### 1. 自动打开浏览器（本地命令，非破坏性）
- **位置**: `SKILL.md:198`、`SKILL.md:321`、`SKILL.md:369-378`
- **内容**: `open <文件路径>`（macOS）/ `start`（Windows）/ `xdg-open`（Linux）
- **判定**: skill 会主动执行本地命令，但**目标仅为自身产出的本地 HTML 文件**，不含网络下载、不含敏感信息读取、不可逆操作，**不满足 P0 判定条件**。属于该 skill 的既定产品行为（产出即预览）。
- **建议**: 已知悉即可。若希望改为由宿主工具统一预览，可在本地副本中改写这三处。

### 2. 产出物依赖外部 CDN（不落盘、不执行）
- **URL**: `SKILL.md:441` `https://cdn.tailwindcss.com`、`SKILL.md:444` `https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js`
- **判定**: 这两条出现在"产出 HTML 的模板示例"里，是**产物**引用的 CDN，skill 本身不请求、不下载、不执行。
- **提示**: 离线或 CDN 不可达时，生成的原型样式/流程图会渲染失败。

---

## 📋 详细检查结果

| 检查项 | 关键词 | 命中 |
|---|---|---|
| 命令执行 | curl, wget, bash, sh, eval, exec, system, subprocess, popen | 0 次 |
| 隐蔽执行 | silently, hidden, --quiet, nohup, disown, /dev/null | 0 次 |
| 敏感路径/凭证 | ~/.ssh, /etc/passwd, .env, credentials, token, api_key, password | 0 次 |
| 文件删除/移动 | rm -rf, unlink, rmtree, mv, rmdir | 0 次（"不覆盖"为正向约束） |
| 权限提升 | sudo, chmod, chown | 0 次 |
| 依赖安装 | pip install, npm install -g, yarn global, brew install, pipx | 0 次 |
| Base64 可疑串 | `[A-Za-z0-9+/]{40,}` | 0 次 |
| 元数据 | description 长度 203 字符（<500，无异常）；`name`/`version` 规范 | 正常 |
| 网络请求 | 仅 2 个 CDN URL，均为产物模板 | 见提示级 2 |

**技能描述与实际行为一致性**: ✅ 一致。描述为"PM 敏捷工作流：需求澄清 → PRD → HTML 原型 → Mermaid 流程图 → 版本迭代"，与正文七步流程完全对应，无隐藏行为、无越权动作。

**版本信息**: version 1.0.0 | 作者 arcsin1 | 最后提交 2026-03-31

**元数据补充建议**: 缺少 `license` 字段（非占位符，仅为缺失），如需二次分发建议向作者确认授权。

---

## 📦 安装记录

| 项目 | 内容 |
|---|---|
| 安装位置 | `/Users/yummy/.workbuddy/skills/pm-agile-workflow/SKILL.md` |
| 安装级别 | 用户级（跨项目可用） |
| 安装方式 | 原样安装，未修改内容 |
| 完整性校验 | MD5 `424c68e22c4671cea4c026c0e80a8fdf`，与上游一致 ✅ |
| 文件规模 | 456 行 / 16,556 字节 |

---

## ✅ 审计结论

**风险等级**: P2 — 无投毒风险

**使用建议**: 可以安全使用。该 skill 为纯 Markdown 指令集，不含任何可执行代码，不安装依赖，不访问网络，不触碰凭证与系统目录。唯一需知悉的是它会在产出 HTML 后自动调用系统命令打开浏览器（属既定功能）。

**触发方式**: 直接描述产品需求即可自动触发（如"我想做一个积分兑换功能"）。

**审计原则提醒**: 本报告仅评估该 skill 本身的供应链投毒风险，不评估其教学/内容质量；产出的 PRD 与原型内容质量由使用者自行判断。
