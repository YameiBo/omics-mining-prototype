#!/usr/bin/env node
/* 把 prd.md 转成自包含 HTML（查看用）。用 marked 渲染 + 青色主题样式。 */
const fs = require("fs");
const path = require("path");
const { marked } = require("/Users/yummy/.workbuddy/skills/prototype-annotation/assets/web-annotation/marked.umd.js");

const src = process.argv[2] || path.join(__dirname, "prd.md");
const out = process.argv[3] || path.join(__dirname, "prd.html");
const md = fs.readFileSync(src, "utf8");
const body = marked.parse(md);

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI 组学数据智能挖掘系统 · 产品需求文档（PRD）V2.0</title>
<style>
  :root { --brand:#106376; --deep:#0A4655; --paper:#f7fafb; --ink:#1f2a33; --ink3:#5b6b76; --line:#e3ecef; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--paper); color:var(--ink);
    font-family:"Microsoft YaHei","PingFang SC",-apple-system,sans-serif; font-size:15px; line-height:1.75; }
  .wrap { max-width:860px; margin:0 auto; padding:48px 40px 80px; background:#fff; }
  h1 { font-size:26px; color:var(--brand); border-bottom:3px solid var(--brand); padding-bottom:12px; }
  h2 { font-size:20px; color:var(--deep); margin-top:2em; padding-left:10px; border-left:4px solid var(--brand); }
  h3 { font-size:17px; color:var(--deep); margin-top:1.5em; }
  h4 { font-size:15px; color:var(--ink); margin-top:1.2em; }
  table { border-collapse:collapse; width:100%; margin:1em 0; font-size:13.5px; }
  th,td { border:1px solid var(--line); padding:8px 12px; text-align:left; vertical-align:top; }
  th { background:var(--brand); color:#fff; font-weight:600; }
  tr:nth-child(even) td { background:#fbfdfd; }
  code { background:#eef4f6; color:var(--deep); padding:1px 6px; border-radius:4px; font-size:13px; font-family:"Menlo",monospace; }
  pre { background:#f2f6f8; border:1px solid var(--line); border-radius:8px; padding:14px 16px; overflow:auto; }
  pre code { background:none; padding:0; }
  blockquote { margin:1em 0; padding:8px 16px; border-left:4px solid var(--brand); background:#f2f8f9; color:#4a5a63; }
  hr { border:none; border-top:1px solid var(--line); margin:2em 0; }
  strong { color:var(--deep); }
  a { color:var(--brand); }
</style>
</head>
<body>
<div class="wrap">
${body}
</div>
</body>
</html>
`;

fs.writeFileSync(out, html, "utf8");
console.log("saved", out, fs.statSync(out).size, "bytes");
