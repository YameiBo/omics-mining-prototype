# 天中医项目 · 工具链参考

> 从 `MEMORY.md` 拆出：这些是「换任何一个项目都要遵守」的工具链约定，与天中医原型本身无关。
> 用法就一条：**生成 .docx 或解析 xlsx 之前先看这里**。

## tencent-docx 生成 .docx 的三条硬约束

否则 html-review 门禁首轮必挂：

1. **全部 padding / margin 必须引用 `var()`**。含单位字面值（`0.5em`）一律违规 —— 先在 `:root` 预置间距令牌；字面量 `0` 不违规。
2. **每个 `<table>` 都要有 `<thead>` / `<tbody>`**，摘要指标条也不例外。
3. **每个 `h2` 后必须先有章节导语 `<p>` 再进 `h3`**，否则判 TQ-03 标题跳级。

其它禁用项：`display:grid`、`<dl>/<dt>/<dd>`、装饰性 `<hr>`、用 `<span>` 模拟 badge。结构化内容统一用 `<table>`；左边框块文字开头加 `&nbsp;&nbsp;`；块级元素的关键 CSS 须显式声明。

## sheet 需求表解析

本地 xlsx 一律委派 `tencent-docs-sheetagent` 子代理，**不自行读表**。

该表的模块归属靠 **A 列纵向合并单元格**表达（天中医需求表里是 10 处），按行读会丢模块归属 —— 必须按合并区间还原。

## macOS 环境坑（钥匙串 / 日志）

- **钥匙串弹框**「找不到用于储存"Chrome"的钥匙串」先验健康再动手：`security add-generic-password`
  → `find-generic-password` → `delete-generic-password` 三步走通 = 没坏，**不要点「还原为默认」**
  （会把自建钥匙串从搜索列表里摘掉）。本项目的成因是 Chrome「已更新待重启」的版本错位态
  → 它反复重启重试 → 每次重启索要 `Chrome Safe Storage` → `SecurityAgent` 弹框。处置：⌘Q 重开 Chrome。
- `security list-keychains -s <path>` 是**设置**搜索列表，不是查看；查看用 `security list-keychains`。
- `security show-keychain-info` 对**锁定中的自建钥匙串**会永久挂起，属正常现象；要加超时保护：
  `perl -e 'alarm 15; exec("security","show-keychain-info",$ENV{HOME}."/Library/Keychains/x.keychain-db")'`。
- zsh 里 **`log` 是内建命令**，查系统日志必须写全路径 `/usr/bin/log`，否则报 `too many arguments`。
