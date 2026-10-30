#!/usr/bin/env node
/* 构建两个交付版本：
   index.html      —— 零外部依赖，离线可用（Tailwind 本地编译内联 + FontAwesome SVG 内联 + 本地图片）
   index-cdn.html  —— 在线分享版（Tailwind CDN + FontAwesome CDN + Unsplash 远程图片）
*/
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const BUILD = path.join(ROOT, '.build');

/* ---------- 0. 定位 node_modules（Tailwind / FontAwesome） ----------
   硬编码绝对路径会让整个项目「换台机器就构建不了」。
   解析顺序：环境变量 NODE_MODULES_DIR → 项目内 node_modules → 向上逐级查找
   → WorkBuddy 托管的共享工作区。任一命中即用。 */
function resolveNodeModules() {
  const cands = [];
  if (process.env.NODE_MODULES_DIR) cands.push(process.env.NODE_MODULES_DIR);
  let dir = ROOT;
  for (let i = 0; i < 5; i++) {
    cands.push(path.join(dir, 'node_modules'));
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  cands.push(path.join(process.env.HOME || '', '.workbuddy/binaries/node/workspace/node_modules'));
  for (const c of cands) {
    if (c && fs.existsSync(path.join(c, '@fortawesome/fontawesome-free'))) return c;
  }
  return null;
}
const NM_TARGET = resolveNodeModules();
const FA = NM_TARGET ? path.join(NM_TARGET, '@fortawesome/fontawesome-free') : null;
const TW_BIN = NM_TARGET ? path.join(NM_TARGET, '.bin/tailwindcss') : null;
if (!NM_TARGET) {
  console.error('✗ 找不到 node_modules（需含 @fortawesome/fontawesome-free）。');
  console.error('  装一次：npm i -g @fortawesome/fontawesome-free tailwindcss');
  console.error('  或指定：NODE_MODULES_DIR=/path/to/node_modules node build.js');
  process.exit(1);
}

if (!fs.existsSync(BUILD)) fs.mkdirSync(BUILD, { recursive: true });

/* ---------- 0b. 让 Tailwind 能从 prototype/ 解析到 node_modules ---------- */
const NM = path.join(ROOT, 'node_modules');
if (!fs.existsSync(NM)) {
  try { fs.symlinkSync(NM_TARGET, NM, 'dir'); console.log('[0/5] 已建立 node_modules 软链 → ' + NM_TARGET); }
  catch (e) { console.log('[0/5] 软链建立失败：' + e.message); }
}

/* ---------- 1. Tailwind 编译 ---------- */
console.log('[1/5] 编译 Tailwind …');
execFileSync(TW_BIN, ['-i', path.join(SRC, 'app.css'), '-o', path.join(BUILD, 'tw.css'), '--minify'], { stdio: 'inherit' });
const twCss = fs.readFileSync(path.join(BUILD, 'tw.css'), 'utf8');
console.log('      tw.css', (twCss.length / 1024).toFixed(1), 'KB');

/* ---------- 2. 收集用到的图标 ---------- */
console.log('[2/5] 收集 FontAwesome 图标 …');
const htmlRaw = fs.readFileSync(path.join(SRC, 'app.html'), 'utf8');
const jsRaw = fs.readFileSync(path.join(SRC, 'app.js'), 'utf8');

const names = new Set();
for (const m of htmlRaw.matchAll(/fa-solid fa-([a-z0-9-]+)/g)) names.add(m[1]);
for (const m of jsRaw.matchAll(/ico\('([a-z0-9-]+)'/g)) names.add(m[1]);
/* 还用到图标但名字来自变量的地方，显式补一份 */
for (const n of ['circle-check', 'triangle-exclamation', 'circle-info', 'hourglass-half', 'spinner', 'ban', 'file-csv', 'table-cells', 'arrow-trend-up', 'arrow-trend-down', 'chevron-right', 'circle-question', 'lock']) names.add(n);

/* 数据表里存的图标名（TOOLCATS.ic / TABMETA.i / HIST.ic / icon:）不经过任何字面量，
   上面两条扫不到 —— 曾导致 6 个图标没被内联、ico() 返回空串、界面上静默消失。
   统一登记到 src/app.js 的 ICON_REGISTRY，这里把它读进来。 */
const regM = jsRaw.match(/var ICON_REGISTRY = \[([\s\S]*?)\];/);
if (!regM) {
  console.log('      ✗ 缺少 ICON_REGISTRY，数据驱动的图标不会被内联');
  process.exitCode = 1;
} else {
  const before = names.size;
  for (const m of regM[1].matchAll(/'([a-z0-9-]+)'/g)) names.add(m[1]);
  console.log('      ICON_REGISTRY 补入', names.size - before, '个图标名');
}

const FAI = {};
let iconTotal = 0;
for (const n of [...names].sort()) {
  const f = path.join(FA, 'svgs', 'solid', n + '.svg');
  if (!fs.existsSync(f)) { console.log('      ✗ 缺少图标', n); continue; }
  const svg = fs.readFileSync(f, 'utf8');
  const vb = (svg.match(/viewBox="([^"]+)"/) || [, '0 0 512 512'])[1];
  let inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '');
  inner = inner.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
  FAI[n] = { v: vb, p: inner };
  iconTotal += inner.length;
}
console.log('      图标', Object.keys(FAI).length, '个 · 路径数据', (iconTotal / 1024).toFixed(1), 'KB');

/* ---------- 3. 图片映射（离线本地 / 在线 Unsplash） ---------- */
const IMG = {
  'assets/hero-genomics.jpg': 'https://images.unsplash.com/photo-1628595351029-c2bf17511435?w=1600&h=560&fit=crop&q=76&fm=jpg&auto=format',
  'assets/dataset-rnaseq.jpg': 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=640&h=400&fit=crop&q=82&fm=jpg&auto=format',
  'assets/dataset-singlecell.jpg': 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=640&h=640&fit=crop&q=82&fm=jpg&auto=format',
  'assets/dataset-wgs.jpg': 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=640&h=400&fit=crop&q=82&fm=jpg&auto=format',
  'assets/avatar-clinician.jpg': 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=192&h=192&fit=crop&crop=faces&q=86&fm=jpg&auto=format',
  'assets/avatar-engineer.jpg': 'https://images.unsplash.com/photo-1615109398623-88346a601842?w=192&h=192&fit=crop&crop=faces&q=86&fm=jpg&auto=format',
  /* 结果全景「查看报告详情」的内嵌分析报告（PDF）：CDN 版同样内联，避免外链 */
  'assets/analysis-report.pdf': ''
};

/* ---------- 4. 离线版 ---------- */
console.log('[3/5] 生成 index.html（零外部依赖）…');
/* 匹配整个 <i class="...">…</i>，再从 class 里取图标名。
   旧写法要求 class 紧挨着就是结束引号，一旦写成
   <i class="fa-solid fa-x ico" aria-hidden="true"></i> 就整条漏匹配，
   图标既不内联也不报错 —— 离线版里直接少一个图标，且构建自检才发现。 */
const RE_ICON = /<i class="([^"]*)"([^>]*)><\/i>/g;
const inlineIcons = (s) => s.replace(RE_ICON, (m, cls, attrs) => {
  const hit = /(?:^|\s)fa-solid\s+fa-([a-z0-9-]+)/.exec(cls);
  if (!hit) return m;
  const d = FAI[hit[1]];
  /* 未登记的图标原样留着，让下面的自检报出来；返回空串会让「图标丢了」看起来像「本来没设计图标」 */
  if (!d) return m;
  /* 占位符本身写成 <i class="fa-solid fa-x ico">，若不剔除就会拼出
     "ico ico crumb__sep" 这种重复类名 —— 无害但会误导读选择器的人 */
  const rest = cls.replace(/^fa-solid\s+fa-[a-z0-9-]+/, '')
    .split(/\s+/).filter(c => c && c !== 'ico').join(' ');
  /* <i> 上除 class 外的属性必须原样带过去：id / data-* / aria-* 都在这里。
     丢掉会让后续 JS 拿不到元素 —— 曾真实踩到：给面包屑箭头加 id 后
     q('#crumbSep') 返回 null、整个验证脚本中断，而构建自检一路绿灯。
     aria-hidden 由本函数统一输出，先去重避免同一属性出现两次。 */
  const extra = (attrs || '').replace(/\s*aria-hidden="[^"]*"/g, '').trim();
  return `<svg class="ico${rest ? ' ' + rest : ''}"${extra ? ' ' + extra : ''}`
    + ` viewBox="${d.v}" fill="currentColor" aria-hidden="true">${d.p}</svg>`;
});

let offline = htmlRaw;
/* 注意：注入内容必须用「函数式替换」。String.replace 的字符串替换会把
   $$ / $& / $` / $' 当成替换模式，app.js 里的 $$ 选择器会被压成 $ —— 曾真实踩坑。 */
/* 图片 URI 表（v40）：示例数据集的封面是 JS 动态拼出来的（还得支持改封面），
   所以把映射表注入成全局变量，由 app.js 的 assetAbs() 运行时查表。
   键一律是 'assets/xxx'（app.js 用 'assets/' + 文件名 查）。

   ⚠ 注入时机是硬约束（v59 实测踩到）：映射表必须在「路径 → base64 / 远程 URL」
   的替换**之后**注入。否则替换会把映射表的**键名**也一起换掉 —— 键变成
   data URI 后，assetAbs('dataset-wgs.jpg') 永远查不到，静默退回相对路径
   'assets/dataset-wgs.jpg'。本地 prototype/ 旁边正好有 assets/ 目录，看起来
   完全正常；一旦作为单文件分发（deploy-static/ 里没有 assets/）就整片图裂。
   所以这里只埋 <!--INJECT_IMG_URI--> 占位，替换完再回填。 */
/* 构建期就致命的问题要立刻报出来 —— 第 5 步的 problems 数组那时才创建 */
const problemsEarly = [];
const imgMime = (k) => /\.pdf$/i.test(k) ? 'application/pdf'
  : /\.png$/i.test(k) ? 'image/png' : 'image/jpeg';
const IMG_DATA = {};
for (const k of Object.keys(IMG)) {
  const abs = path.join(ROOT, k);
  if (fs.existsSync(abs)) IMG_DATA[k] = 'data:' + imgMime(k) + ';base64,' + fs.readFileSync(abs).toString('base64');
}
/* 在线版：键同样保留本地路径，值指向远程图源 —— **不能留空**。
   留空时 assetAbs() 退回 assets/xxx 相对路径，而远程 URL 是构建期才拼出来的，
   运行时那串相对路径没有任何东西会替换它 → CDN 版封面同样图裂。 */
const IMG_REMOTE = {};
for (const [local, remote] of Object.entries(IMG)) IMG_REMOTE[local] = remote;
/* 本地 PDF 没有远程源：CDN 版也直接用内联数据，保证预览可用 */
if (IMG_DATA['assets/analysis-report.pdf']) IMG_REMOTE['assets/analysis-report.pdf'] = IMG_DATA['assets/analysis-report.pdf'];
const injectImgUri = (map) => '<script>window.IMG_URI=' + JSON.stringify(map) + ';</script>';

offline = offline.replace('<!--INJECT_CSS-->', () => '<style>\n' + twCss + '\n</style>');
offline = offline.replace('<!--INJECT_JS-->', () =>
  '<!--INJECT_IMG_URI-->\n<script>window.FAI=' + JSON.stringify(FAI) + ';</script>\n<script>\n' + jsRaw + '\n</script>');
offline = inlineIcons(offline);
/* 离线版：把本地图片内联成 base64，使 index.html 成为可单独拷贝分发的单文件
   （否则一旦脱离 prototype/ 目录，assets/ 找不到就会图裂）。
   映射表此刻还只是 <!--INJECT_IMG_URI--> 占位，所以这一步不会碰到它的键名。 */
let inlined = 0;
for (const k of Object.keys(IMG)) {
  const uri = IMG_DATA[k];
  if (!uri) continue;
  if (offline.includes(k)) { offline = offline.split(k).join(uri); inlined++; }
}
/* 替换全部做完，最后才回填映射表（见上面关于注入时机的说明） */
offline = offline.replace('<!--INJECT_IMG_URI-->', () => injectImgUri(IMG_DATA));
if (offline.includes('<!--INJECT_IMG_URI-->')) problemsEarly.push('IMG_URI 占位符未被回填');
console.log('      内联图片', inlined, '张 · 映射表', Object.keys(IMG_DATA).length, '条');
fs.writeFileSync(path.join(ROOT, 'index.html'), offline);
console.log('      index.html', (Buffer.byteLength(offline) / 1024).toFixed(1), 'KB');

/* ---------- 5. CDN 版 ---------- */
console.log('[4/5] 生成 index-cdn.html（在线分享）…');
/* 浏览器端 Tailwind 自带 tailwindcss，去掉 import/source 声明，保留 @theme 与自定义层 */
let cssForCdn = fs.readFileSync(path.join(SRC, 'app.css'), 'utf8')
  .replace(/@import\s+"tailwindcss"[^;]*;/g, '')
  .replace(/@source\s+[^;]*;/g, '');

let cdn = htmlRaw;
cdn = cdn.replace('<!--INJECT_CSS-->', () =>
  '<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>\n'
  + '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css">\n'
  + '<style type="text/tailwindcss">\n' + cssForCdn + '\n</style>');
/* 同离线版：先埋占位，最后再回填映射表 —— 第 170 行的 split-join 同样会把
   映射表的键名换成远程 URL，键一变 assetAbs() 就查不到。 */
cdn = cdn.replace('<!--INJECT_JS-->', () =>
  '<!--INJECT_IMG_URI-->\n'
  + '<script>window.FAI=' + JSON.stringify(FAI) + ';</script>\n<script>\n' + jsRaw + '\n</script>');
for (const [local, remote] of Object.entries(IMG)) cdn = cdn.split(local).join(remote);
/* 在线版的值直接给远程图源 URL（v59 修：原来留空，导致 CDN 版封面也图裂） */
cdn = cdn.replace('<!--INJECT_IMG_URI-->', () => injectImgUri(IMG_REMOTE));
if (cdn.includes('<!--INJECT_IMG_URI-->')) problemsEarly.push('CDN 版 IMG_URI 占位符未被回填');
fs.writeFileSync(path.join(ROOT, 'index-cdn.html'), cdn);
console.log('      index-cdn.html', (Buffer.byteLength(cdn) / 1024).toFixed(1), 'KB');

/* ---------- 校验 ---------- */
console.log('[5/5] 自检 …');
const problems = [];
const off = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
if (/fa-solid fa-/.test(off)) problems.push('离线版仍残留 <i class="fa-solid …"> 图标占位');
if (/<!--INJECT_(CSS|JS|IMG_URI)-->/.test(off)) problems.push('离线版仍有未替换的注入点');
/* 去掉 CSS 注释与 SVG 命名空间后，离线版不应再有任何「加载即发起」的外部请求。
   判据按**发起时机**分类 —— 这是精度修正，不是放宽。
     ① 加载即发起（src= / url() / @import / link href …）必须为 0：
        离线单文件的价值就在这。
     ② 有意为之的站外接入可以有，但必须有白名单：
        - v57：知识赋能组标题跳外链（a[href]）
        - v58：知识赋能三页在页内挂载外部系统（iframe 的 src）
        - v60：流程编排区全屏挂载外部编排系统（iframe 的 src）
   v57 之前用「文本里出现任何 http://」一刀切，那是把导航当成了加载请求，
   会把有意为之的站外接入报成缺陷 —— 假告警必须消除，不能靠放宽断言凑数。
   折中判据不是「再补几条正则」（那只会漏得更隐蔽），而是**按语义定位**：
   站外地址只允许登记在 KB_EXT_BASE 与 ORCH_EXT_URL 这两个常量里，
   其余任何 http:// 才是真问题。

   v58/v60 注意 iframe 是**动态赋值**的（el.setAttribute('src', url)），
   产物 HTML 里没有 src 属性 —— 所以「加载即发起」那条判据依然成立，
   外部请求只从 mountKbFrame() / mountOrchExt() 那两个入口发出。 */
const offNoComment = off.replace(/\/\*[\s\S]*?\*\//g, '');
/* 摘掉白名单常量本身（它们是唯一允许的站外地址来源，不该被自己举报） */
const offNoKbBase = offNoComment
  .replace(/(KB_EXT_BASE\s*=\s*)['"][^'"]*['"]/g, "$1''")
  .replace(/(ORCH_EXT_URL\s*=\s*)['"][^'"]*['"]/g, "$1''");
const ext = (offNoKbBase.match(/https?:\/\/[^"')\s]+/g) || [])
  .map(u => u.replace(/[),;]+$/, ''))
  .filter(u => !/w3\.org/.test(u));
if (ext.length) problems.push('离线版存在加载即发起的外部请求：' + [...new Set(ext)].slice(0, 5).join(', '));
/* 反向检查：站外接入地址必须集中登记（白名单要有边界，
   否则「允许有外链」就成了「以后随便塞外链都行」）。
   「页面上真的渲染出来了」由 verify.py 的运行时探针断 —— 产物文本只能
   证明「地址与模板都在」。 */
const kbBase = (offNoComment.match(/KB_EXT_BASE\s*=\s*['"]([^'"]+)['"]/) || [])[1];
const EXT_OK_HOST = 'http://192.168.77.144:20080/package2';
if (!kbBase) {
  problems.push('未找到 KB_EXT_BASE：外部知识系统的地址必须登记在这一个常量里');
} else if (kbBase !== EXT_OK_HOST) {
  problems.push('外部知识系统地址变更未同步 build.js 白名单：' + kbBase);
}
/* 三个路径都要在产物里：少了任何一个，对应的子页就是一张白板 */
for (const p of ['/ke', '/kb', '/kg']) {
  if (!offNoComment.includes("path: '" + p + "'")) problems.push('外部路径未登记在 KB_EXT：' + p);
}
/* 渲染模板必须一起在：只有地址没有模板 = 改了配置但页面上不会出现 iframe */
for (const t of ['data-kbframe', 'data-kbframeel', 'initKbFrames']) {
  if (!offNoComment.includes(t)) problems.push('外部挂载缺少实现片段：' + t);
}
/* v60：外部编排系统同一套登记（地址常量 + 承载模板 + 挂载入口）。
   同样断「改了配置但页面上不会出现 iframe」这一层。 */
const orchUrl = (offNoComment.match(/ORCH_EXT_URL\s*=\s*['"]([^'"]+)['"]/) || [])[1];
const ORCH_OK_URL = 'http://aizx.jwzcloud.com:1888/';
if (!orchUrl) {
  problems.push('未找到 ORCH_EXT_URL：外部编排系统的地址必须登记在这一个常量里');
} else if (orchUrl !== ORCH_OK_URL) {
  problems.push('外部编排系统地址变更未同步 build.js 白名单：' + orchUrl);
}
for (const t of ['data-orchext', 'data-orchextel', 'mountOrchExt', 'setOrchExt']) {
  if (!offNoComment.includes(t)) problems.push('外部编排挂载缺少实现片段：' + t);
}
for (const k of Object.keys(IMG)) {
  if (!fs.existsSync(path.join(ROOT, k))) problems.push('缺少本地图片 ' + k);
}
/* v59：封面图裂的根因防线。
   上面那版检查是 `off.includes('"' + k + '"')` —— 只看 HTML 里有没有相对路径，
   **抓不到映射表键名被吃**这件事：键名被替换后，产物里 assets/xxx 一个都不剩，
   那条检查反而全绿（它以为已经内联干净了）。真正要断的是「键名完好、值是 data URI」。
   这类「查表命中 0 就退回相对路径」的故障在本地看不出来（prototype/ 旁边有 assets/），
   只有作为单文件分发时才暴露 —— 所以必须在构建期就断死。 */
const grabImgUri = (html) => {
  const m = html.match(/window\.IMG_URI=(\{[\s\S]*?\});<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return null; }
};
for (const [tag, html, wantData] of [['离线版', off, true], ['CDN 版', fs.readFileSync(path.join(ROOT, 'index-cdn.html'), 'utf8'), false]]) {
  const map = grabImgUri(html);
  if (!map) { problems.push(tag + '未能解析出 window.IMG_URI 映射表'); continue; }
  for (const k of Object.keys(IMG)) {
    if (!(k in map)) { problems.push(tag + '映射表缺少条目：' + k); continue; }
    /* 键名必须是原始相对路径 —— 被替换成 data: 就说明注入时机错了 */
    const isPdfAsset = /\.pdf$/i.test(k);
    const valOk = isPdfAsset
      ? String(map[k]).startsWith('data:application/pdf')
      : String(map[k]).startsWith(wantData ? 'data:image/' : 'http');
    if (map[k] && !valOk) {
      problems.push(tag + '映射表值异常（' + k + '）：' + String(map[k]).slice(0, 40));
    }
  }
  /* 反向：任何以 assets/ 开头的「键」都必须存在（键被吃时这里会少条目） */
  const keys = Object.keys(map);
  if (keys.length !== Object.keys(IMG).length) {
    problems.push(tag + '映射表条目数不符：' + keys.length + ' / ' + Object.keys(IMG).length);
  }
  /* 键名被替换的典型症状：键自己长得像 data URI */
  if (keys.some(k => k.startsWith('data:'))) {
    problems.push(tag + '映射表键名被替换成了 data URI（注入时机错误，封面会图裂）');
  }
}
if ((off.match(/data:image\/jpeg;base64,/g) || []).length < 5) problems.push('离线版内联图片少于 5 张');
/* 图标尺寸规则必须存在：缺了会让内联 <svg> 默认 width:100% 撑满容器 */
if (!/svg\.ico\s*\{/.test(twCss)) problems.push('tw.css 缺少 svg.ico 尺寸规则，图标会撑满容器');
/* 页面清单按 DOM 顺序列出（含不在左栏菜单里的 sample —— 它保留着，
   少一个页面说明有人误删；多一个说明新增页面没登记进左栏） */
/* v37：p03（样本对齐）已按需求 3 整页删除，清单同步去掉 —— 这份清单是
   「少一个说明有人误删」，留着 p03 就一直报「缺少页面 p03」的假告警。
   v39：projdetail（项目概况）加进来 —— 它不在左栏菜单里（从项目列表钻进去），
   但仍然是一个真页面，漏登记它就会「页面被误删了没人发现」。
   v47：projgroup（项目组管理）加进来 —— 系统管理组的新页面。 */
const pages = ['p01', 'gene', 'files', 'p02', 'p04', 'p05', 'p06', 'p07',
  'kbmed', 'kbown', 'kbgraph', 'proj', 'projdetail', 'sample', 'pubds', 'projgroup', 'log'];
for (const p of pages) if (!off.includes('id="page-' + p + '"')) problems.push('缺少页面 ' + p);
/* 旧 id 不得复活：p09 已被拆成 kbmed / kbown / kbgraph 三页 */
if (off.includes('id="page-p09"')) problems.push('已删除的 page-p09 又回来了');
if (!/window\.FAI=/.test(off)) problems.push('未注入 FAI 图标数据');
/* inlineIcons 只重写 class，<i> 上的额外类名必须原样带到 <svg>。
   用一处真实用例做守卫：加载动画的 .spin（原先用面包屑箭头的 .crumb__sep，
   但面包屑已改为由 renderCrumb() 在运行时生成，源码里不再有静态占位符）。
   这类丢失不会报错 —— 图标照常渲染，只是少了动画、或选择器拿到 null，
   构建自检是唯一能拦住它的地方。 */
if (!/class="ico spin"/.test(off)) {
  problems.push('图标占位符的额外类名没有带到产物 <svg> 上（class="ico spin" 缺失）');
}
/* 上一条盯的是「额外类名」，这条盯「额外属性」：源码里凡带 id 的图标占位符，
   产物 <svg> 上必须留着同一个 id。曾真实踩到：给面包屑箭头加 id 后
   q('#crumbSep') 返回 null、整个验证脚本中断，而构建自检一路绿灯。
   当前源码没有这样的用例，所以它在下一个「带 id 的图标」出现时才生效。 */
for (const m of htmlRaw.matchAll(/<i class="fa-solid fa-([a-z0-9-]+)[^"]*"([^>]*)><\/i>/g)) {
  const idM = /id="([^"]+)"/.exec(m[2] || '');
  if (idM && !off.includes('id="' + idM[1] + '"')) {
    problems.push('图标 ' + m[1] + ' 的 id 没有带到产物 <svg> 上（' + idM[1] + '）');
  }
}
/* ICON_REGISTRY 里的每个名字都必须真的内联成功，否则数据里会出现空图标 */
if (regM) {
  const regNames = [...regM[1].matchAll(/'([a-z0-9-]+)'/g)].map(x => x[1]);
  const miss = regNames.filter(n => !FAI[n]);
  if (miss.length) problems.push('ICON_REGISTRY 中这些图标未内联：' + miss.join(', '));
}

/* 静态检查：JS 源码里不能出现字面量图标占位符 <i class="fa-solid fa-x">。
   inlineIcons 在 JS 注入之后才执行，会把这些占位符改成内联 SVG —— 于是「离线版 JS」
   与「源码」不再逐字节一致，而 CDN 版保留 <i> 交给 FontAwesome CDN。
   两版从此分叉（曾真实踩坑）。JS 生成 HTML 时请一律用 ico('name')。 */
if (/fa-solid fa-/.test(jsRaw)) {
  problems.push('src/app.js 含字面量 <i class="fa-solid …">，会让离线版与在线版产物分叉；请改用 ico(\'name\')');
}

/* 阈值口径：JS 里是 THRESHOLDS 常量，HTML 里写死了三个展示值。
   两边必须一致 —— 不一致时界面会自己跟自己打架（同类坑：#projCount 写死 12 而真值 13）。 */
const thrM = /var THRESHOLDS = \{\s*missing:\s*(\d+),[\s\S]*?nsample:\s*(\d+),[\s\S]*?qpos:\s*(\d+)/.exec(jsRaw);
if (!thrM) {
  problems.push('找不到 THRESHOLDS 常量定义，无法校验静态 HTML 里的阈值展示值');
} else {
  /* 展示值那格后来加了 id 供验证脚本读数，所以这里用正则放行额外属性 ——
     写死字符串会在「只是加了个 id」这种无害改动上误报。 */
  for (const [label, want] of [['缺失率告警阈值', thrM[1] + '%'], ['最小样本量', thrM[2]], ['队列告警位次', thrM[3]]]) {
    const re = new RegExp(label + '</span><span class="num"[^>]*>' + want + '</span>');
    if (!re.test(htmlRaw)) {
      problems.push('阈值「' + label + '」的静态展示值应为 ' + want + '，与 THRESHOLDS 不一致');
    }
  }
}

/* 高保真原型：界面文案里不再出现「演示」这类原型脚手架措辞。
   代码注释里可以留（对开发有参考价值），所以先把注释剥掉再查。 */
const htmlText = htmlRaw.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ');
if (/演示/.test(htmlText)) {
  problems.push('app.html 界面文案仍含「演示」字样，高保真原型里不该出现');
}
const jsNoComment = jsRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
if (/演示/.test(jsNoComment)) {
  problems.push('src/app.js 的界面文案（非注释）仍含「演示」字样');
}

/* 关键回归检查：注入的 JS 必须与源码逐字节一致（防 String.replace 替换模式吃字符） */
const nSrc = (jsRaw.match(/\$\$\(/g) || []).length;
for (const [f, txt] of [['index.html', off], ['index-cdn.html', fs.readFileSync(path.join(ROOT, 'index-cdn.html'), 'utf8')]]) {
  if (!txt.includes(jsRaw)) problems.push(f + '：内联 JS 与 src/app.js 不一致（可能被替换模式改写）');
  if (!txt.includes('var $$ = function')) problems.push(f + '：$$ 选择器定义丢失');
  /* 必须与源码计数一致；写死阈值会误报（源码真实只有 13 处） */
  const n = (txt.match(/\$\$\(/g) || []).length;
  if (n !== nSrc) problems.push(f + '：$$( 调用数为 ' + n + '，与源码 ' + nSrc + ' 不一致，疑似被替换模式压缩');
}

/* 关键回归检查：事件委托里 closest('[data-x]') 不能命中 body / html 自身属性。
   否则该分支会匹配到祖先 body 并提前 return，导致其后所有处理器静默失效。
   （曾真实踩坑：body[data-role] 吞掉了上传、异常演示、结果视图切换等全部交互） */
const rootAttrs = new Set();
for (const tag of [htmlRaw.match(/<html[^>]*>/i), htmlRaw.match(/<body[^>]*>/i)]) {
  if (!tag) continue;
  for (const m of tag[0].matchAll(/\s(data-[a-z0-9-]+)=/g)) rootAttrs.add(m[1]);
}
if (rootAttrs.size) {
  for (const m of jsRaw.matchAll(/closest\(\s*'\[(data-[a-z0-9-]+)\]/g)) {
    if (rootAttrs.has(m[1])) {
      problems.push('事件委托用 closest(\'[' + m[1] + ']\')，但 body/html 自身带 ' + m[1]
        + '，会吞掉其后所有处理器；请改用具体元素选择器');
    }
  }
}
/* 关键回归检查：所有 id 必须是合法 CSS 标识符。
   动态工具页曾用 'tool-' + encodeURIComponent(name) 拼 id，中文工具名会把 '%'
   写进 id，而 '%' 在 CSS 标识符里非法 —— document.querySelector('#page-tool-…')
   直接抛 SyntaxError，goto() 中断，工具页永远切不过去（页面静态看着正常、点了没反应）。
   可读名请另存 data-* 或注册表，id 只放 ASCII 短哈希。 */
const badIds = [];
/* 必须先剥掉 <script> 块：内联的 JS 源码里存在 id="' + x + '" 这类拼串文本，
   直接扫全文会把源码当标记，报出一堆假问题。 */
const offMarkup = off.replace(/<script[\s\S]*?<\/script>/g, '');
for (const m of offMarkup.matchAll(/\sid="([^"]*)"/g)) {
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(m[1])) badIds.push(m[1]);
}
if (badIds.length) problems.push('以下 id 不是合法 CSS 标识符，$(\'#…\') 会抛 SyntaxError：' + badIds.slice(0, 5).join(' / '));
if (/'page-' \+ encodeURIComponent|encodeURIComponent\(\s*name/.test(jsRaw)) {
  problems.push('src/app.js 用 encodeURIComponent 拼 id：中文名会引入 %，$() 会抛 SyntaxError；请改用 ASCII 短哈希');
}
/* 关键回归检查：静态 HTML 里的「派生数字」不能与数据层漂移。
   <span id="projCount"> 的初始文本写死在 app.html（首屏渲染前的一瞬间可见，
   也是评审直接读源码时的依据），真正的值由 renderProj 用 PROJECTS.length 现算。
   两边不一致时静态检查、源码阅读都会看到错误的项目数。
   本轮新增 P-2026-013 就漏改了这里 —— 数据层 13、静态 HTML 12，构建照样全绿。
   同一事实只讲一遍做不到时，至少让构建把漂移拦下来。 */
const projIds = (jsRaw.match(/id:\s*'P-\d{4}-\d{3}'/g) || []).length;
const projCountM = /<span id="projCount">共 ([\d,]+) 个项目<\/span>/.exec(htmlRaw);
if (!projCountM) {
  problems.push('app.html 找不到 <span id="projCount">共 N 个项目</span>，没法核对静态项目数');
} else if (parseInt(projCountM[1].replace(/,/g, ''), 10) !== projIds) {
  problems.push('app.html 的 #projCount 写死 ' + projCountM[1] + ' 个项目，'
    + '而 app.js 的 PROJECTS 有 ' + projIds + ' 条，请同步（其余派生数字同理）');
}

if (problemsEarly.length) problems.push(...problemsEarly);
if (problems.length) { console.log('\n  ⚠ 发现问题：'); problems.forEach(p => console.log('    - ' + p)); }
else console.log('      ✓ 全部检查通过');

console.log('\n完成：prototype/index.html（离线）、prototype/index-cdn.html（在线）');
