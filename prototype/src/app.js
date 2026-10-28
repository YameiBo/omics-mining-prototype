/* ============================================================
   组学数据智能挖掘系统 · 交互原型
   全部数据由前端模拟；接口契约见 PRD 第 6 章（7 个端点）
   ============================================================ */
(function () {
'use strict';

var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

/* ---------- 图标：由构建脚本注入 FontAwesome Free SVG 数据 ---------- */
/* 数据表里用到的图标名清单。
   build.js 只扫两种字面量：HTML 里的图标占位元素，以及 ico('X') 调用。
   而 TOOLCATS.ic / NAVGROUPS.i / HIST.ic / icon: 这些字段里的名字是「数据」，
   扫描器看不到 —— 曾导致 6 个图标没被内联、ico() 返回空串、图标静默消失。
   凡新增「存在变量/数据里的图标名」，都要登记到这里。 */
var ICON_REGISTRY = [
  /* v54 用户切换器：三个角色的身份图标（名字存在 ROLES 数据里，扫描器看不到，
     不登记就会渲染成问号占位） */
  'shield-halved', 'user-gear', 'user',
  /* v56：文件管理「系统文件只读」的锁形提示 */
  'lock',
  /* v57：知识赋能组标题的外链标记（箭头出框小图标） */
  'arrow-up-right-from-square',
  /* TOOLCATS.ic —— 左栏 9 个分类 */
  'filter', 'dna', 'chart-column', 'chart-line', 'flask-vial',
  'file-lines', 'microscope', 'bacteria', 'atom',
  /* NAVGROUPS.i —— 左栏分组导航（含折叠箭头）。二级条目当前不渲染图标，
     但**数据字段仍在**（TOOLCATS.ic 等地方也读同一批名字），所以这里不做删减，
     只补一级分组新用到的 gears。 */
  'folder-tree', 'database', 'clipboard-list', 'book-open', 'gears',
  'table-cells', 'play', 'screwdriver-wrench', 'diagram-project',
  'dna', 'file-circle-plus', 'diagram-successor', 'chevron-down',
  /* HIST.ic —— 运行历史抽屉 */
  'gear',
  /* 数据集方向 */
  'file-arrow-up', 'file-arrow-down',
  /* 编排区全屏开关 */
  'expand', 'compress',
  /* 自编排画布：卡头「重置」与底部「保存为自定义流程」两个按钮 */
  'rotate-left', 'floppy-disk',
  /* 血缘谱系的方向切换按钮：文案随方向变，图标由 syncLinAxis() 用 ico() 生成，
     两个名字都不出现在 HTML 字面量里，只有登记在这才会被内联。 */
  'sitemap', 'arrows-left-right',
  /* 新建项目五步向导（v37）：步骤条对勾、前后步按钮箭头、空态与引导图标。
     这些名字只在 JS 的 ico() 里出现，扫描器猜不出来，必须显式登记。 */
  'check', 'arrow-left', 'arrow-right', 'inbox', 'file-circle-plus',

  /* 样本档案本轮新增：信息分组图标 / 资料类型图标 / 弹窗按钮图标。
     ⚠ 这张表**只追加不删**。同一个名字可能同时被 HTML 的 inlineIcons 与 JS 的
     ico() 两处消费（vial / download / xmark 就是），删掉看着「重复」的一个，
     就会在离线版与在线版之间分叉出问号占位。删之前先 grep 出全部调用点。 */
  'fingerprint', 'stethoscope', 'box-archive', 'clipboard-check', 'file-shield',
  'file-pdf', 'file-excel', 'file-word', 'file-image', 'trash-can',
  'folder-open', 'user-plus', 'pen-to-square',
  /* RUN_STAGES.ic —— 任务流水线节点图标。名字同样存在数据里，
     扫描器猜不出来；这五个与上面「左栏分类」重名，但**不能因为看着重复就删**。 */
  'file-arrow-down', 'diagram-project', 'table-cells', 'chart-column', 'chart-line',

  /* KBC_MOD.clin.i —— 知识采集弹窗里「标准化临床实践规则」那个模块头的图标。
     v46 补：这个名字原先**只靠一个巧合**才被内联 —— 它另有一处字面量
     `ico('list-check')` 写在「基因档案 › 重建范围」那里，扫描器扫到的是那一处；
     本系统压根没有人手写 `ico('list-check')`。v46 撤掉基因档案整块后，
     那处字面量随之消失 → 名字只剩 `ico(m.i)` 这种**变量**引用，
     构建扫不到 → ico() 返回占位符，而占位符是把路径数据当**文本**塞进 <svg>，
     于是模块头文字变成「M256 8a248…标准化临床实践规则」。
     ⚠ 教训：一个图标名在源码里**还有没有字面量出处**，会随别处的删改而变。
     凡 `ico(变量)` 的数据源（KBC_MOD.i / TOOLCATS.ic / RUN_STAGES.ic …）都必须落在本表里。 */
  'list-check',

  /* v47 项目组管理页：
     · 'user-group' 是 NAVGROUPS 里新条目的 i 字段 —— 数据里的名字，扫描器看不到；
     · 'sort' 是表头排序按钮（由 ico() 变量生成，不在 HTML 字面量里）；
     · 'circle-xmark' 是「已驳回」那颗状态图标（状态→图标存在 PG_ST 数据里，
       同样只有 `ico(st.ic)` 这种变量引用）。
     ⚠ 按 v46 那条教训：凡 `ico(变量)` 的数据源都必须登记在这里。
     顺带把状态图标里另两个也补上（circle-check / hourglass-half 目前另有 HTML
     字面量出处，但那份出处随时可能被删 —— 登记一次的成本远低于再踩一次）。
     'sort-up' / 'sort-down' 同理：它们由 `ico(sIc)` 生成，sIc 是变量，
     字面量里一个字都扫不到（构建报「图标 106」时不会提示少了谁 ——
     少的那两个只会在表头变成占位符）。 */
  'user-group', 'sort', 'sort-up', 'sort-down', 'circle-xmark', 'circle-check', 'hourglass-half',
  /* v50：新建项目两条入口的图标由 PNEW_MODES 的 i 字段驱动（`ico(m.i)`），
     字面量里扫不到 —— 不登记就会渲染成占位符，而「两块入口左边各缺一个图标」
     看起来像设计如此。 */
  'list-check', 'wand-magic-sparkles'
];

/* 未内联的图标名绝不能静默返回空串：那会让「图标丢了」看起来像「本来就没设计图标」。
   这里给一个显眼的占位，verify.py 断言 .ico--miss == 0 把它变成硬失败。 */
var ICO_MISS_PATH = 'M256 8a248 248 0 1 0 0 496 248 248 0 0 0 0-496zm0 56a192 192 0 1 1 0 384 '
  + '192 192 0 0 1 0-384zM256 368a32 32 0 1 0 0 64 32 32 0 0 0 0-64zM256 160a28 28 0 0 1 28 28v132a28 '
  + '28 0 0 1-56 0V188a28 28 0 0 1 28-28z';

function ico(name, extra) {
  var d = (window.FAI || {})[name];
  if (!d) {
    return '<svg class="ico ico--miss ' + (extra || '') + '" data-miss="' + esc(name) + '" '
      + 'viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">' + ICO_MISS_PATH + '</svg>';
  }
  return '<svg class="ico ' + (extra || '') + '" viewBox="' + d.v + '" fill="currentColor" aria-hidden="true">' + d.p + '</svg>';
}

/* ---------- 图表配色（色觉障碍友好：青 / 红 / 灰三档）
   主题色 #106376 偏深，原来的「亮蓝 / 深蓝」两档在青色系里会挤在一起，
   因此拆成 brand（深）/ brandLite（浅）明确两档，色阶与文字另用 brandDeep / brandSoft ---------- */
var C = {
  ink: '#0B1B2B', ink2: '#3D5068', ink3: '#7A8CA3',
  hair: '#E2E9F2', hair2: '#CBD7E6',
  brand: '#106376', brandDeep: '#0A4655', brandLite: '#3E9DB6',
  brandSoft: '#E3F0F3', brandLine: '#A6C9D2',
  up: '#C0392B', down: '#106376', ns: '#B8C4D4',
  ok: '#0E8A5F', warn: '#B26A00',
  grid: '#EDF2F8'
};

/* 相对亮度与「自动前景色」：图表内有底色的文字必须达到 WCAG 2.1 AA 的 4.5:1
   接受 #rrggbb 与 rgb(r,g,b) 两种写法（图表里的渐变色算出来是后者） */
function lum(c) {
  var v;
  if (c.charAt(0) === '#') { v = hex2rgb(c); }
  else { var m = c.match(/[\d.]+/g) || [255, 255, 255]; v = [+m[0], +m[1], +m[2]]; }
  v = v.map(function (x) {
    x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
/* 对比度（WCAG 2.1 相对亮度公式），用于给有底色的文字选前景 */
function contrastOn(fg, bg) {
  var a = lum(fg), b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
/* 直接取对比度更高的那个前景色。
   注意：连续色阶（如热图）中间地带无论选白字还是深字都可能低于 4.5:1，
   此处只保证「尽可能高」；这类图表另配「数据表替代视图」满足 WCAG 的文本等价要求。
   节点标签这类不可替代的文字，底色都是深色实填，实际可稳定 ≥ 5.8:1 */
function onFill(c) {
  return contrastOn('#0B1B2B', c) >= contrastOn('#FFFFFF', c) ? '#0B1B2B' : '#FFFFFF';
}

/* ---------- 确定性伪随机（保证每次打开图形一致） ---------- */
function rng(seed) {
  var s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function hex2rgb(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
function mix(a, b, t) {
  var A = hex2rgb(a), B = hex2rgb(b);
  return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')';
}
function fmt(n) { return n.toLocaleString('en-US'); }

/* ---------- SVG 小工具 ---------- */
function txt(x, y, s, o) {
  o = o || {};
  return '<text x="' + x + '" y="' + y + '" font-size="' + (o.fs || 11) + '"'
    + ' fill="' + (o.fill || C.ink3) + '"'
    + (o.anchor ? ' text-anchor="' + o.anchor + '"' : '')
    + (o.mono ? ' font-family="ui-monospace,Menlo,monospace"' : '')
    + (o.w ? ' font-weight="' + o.w + '"' : '')
    + '>' + s + '</text>';
}
function rect(x, y, w, h, fill, extra) {
  return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '"' + (extra || '') + '/>';
}
function line(x1, y1, x2, y2, st, extra) {
  return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + st + '"' + (extra || '') + '/>';
}
function circle(cx, cy, r, fill, o) {
  o = o || {};
  return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + fill + '"'
    + (o.op ? ' fill-opacity="' + o.op + '"' : '')
    + (o.stroke ? ' stroke="' + o.stroke + '" stroke-width="' + (o.sw || 1) + '"' : '') + '/>';
}
/* maxW = 这张图的「自然显示宽度」上限，不传则铺满容器（width:100%）。
   为什么需要它：SVG 铺满容器 = 按容器宽等比放大，放大倍率 = 容器宽 / viewBox 宽。
   宽 viewBox（640）在 772px 容器里只放大 1.2 倍，字号 11 → 13.2，尚在设计内；
   但小 viewBox 会被放大得离谱 —— 3×3 对齐矩阵 viewBox 仅 416 宽，
   铺满后放大到 1.86 倍，格子里的数字 19px 变 35px（正文 14px 的 2.5 倍），
   整张图从 366px 撑到 666px 高，把同页的「未匹配样本」表顶出首屏。
   传 maxW = viewBox 宽即「绝不放大」，多余宽度交给 margin:auto 居中。 */
function wrap(w, h, label, inner, maxW) {
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%"'
    + (maxW ? ' style="max-width:' + maxW + 'px;margin:0 auto"' : '')
    + ' class="chart" role="img" aria-label="' + label + '">' + inner + '</svg>';
}

/* ============================================================
   图表注册表
   ============================================================ */
var CHARTS = {};

/* ---- 曼哈顿图 ---- */
CHARTS.manhattan = {
  title: '曼哈顿图 · -log10(p)',
  draw: function () {
    var W = 640, H = 250, m = { t: 20, r: 12, b: 32, l: 42 };
    var pw = W - m.l - m.r, ph = H - m.t - m.b, maxY = 10.5;
    var lens = [248, 242, 198, 190, 182, 171, 159, 146, 135, 134, 135, 133, 114, 107, 102, 90, 83, 80, 59, 64, 47, 51, 156];
    var total = lens.reduce(function (a, b) { return a + b; }, 0);
    var rand = rng(240914), pts = [], cum = 0, bands = [];
    lens.forEach(function (L, i) {
      var x0 = m.l + cum / total * pw, x1 = m.l + (cum + L) / total * pw;
      bands.push([x0, x1, i]);
      var k = Math.max(7, Math.round(L / 8));
      for (var j = 0; j < k; j++) {
        var v = 1.0 + Math.pow(rand(), 1.7) * 5.2;
        pts.push([x0 + (j + rand() * .9) / k * (x1 - x0), v, i]);
      }
      cum += L;
    });
    [[16, 9.6], [16, 8.1], [10, 8.7], [2, 8.2], [21, 7.9], [13, 7.7], [10, 7.5], [4, 7.4], [17, 7.35]].forEach(function (s) {
      var b = bands[s[0]];
      pts.push([b[0] + rand() * (b[1] - b[0]), s[1], s[0]]);
    });
    var yOf = function (v) { return m.t + ph - Math.min(v, maxY) / maxY * ph; };
    var out = '';
    [0, 2, 4, 6, 8, 10].forEach(function (t) {
      out += line(m.l, yOf(t), m.l + pw, yOf(t), C.grid, ' stroke-width="1"');
      out += txt(m.l - 7, yOf(t) + 3.5, t, { anchor: 'end', fs: 10, mono: true });
    });
    out += txt(m.l, m.t - 8, '-log10(p)', { fs: 10.5, mono: true, fill: C.ink3 });
    pts.forEach(function (p) {
      var b = bands[p[2]];
      var isSpike = p[1] >= 7.3;
      out += circle(p[0], yOf(p[1]), isSpike ? 2.6 : 1.7, isSpike ? C.up : (p[2] % 2 ? C.brand : C.brandLite), { op: isSpike ? .95 : .62 });
    });
    var yT = yOf(7.3);
    out += line(m.l, yT, m.l + pw, yT, C.up, ' stroke-width="1.2" stroke-dasharray="5 4"');
    out += txt(m.l + pw - 2, yT - 5, '全基因组显著线 p<5e-8', { anchor: 'end', fs: 10, fill: C.up });
    bands.forEach(function (b, i) { if (i % 2 === 0) out += txt((b[0] + b[1]) / 2, H - 14, i + 1 === 23 ? 'X' : i + 1, { anchor: 'middle', fs: 9, mono: true }); });
    out += line(m.l, m.t + ph, m.l + pw, m.t + ph, C.hair2, ' stroke-width="1"');
    return {
      w: W, h: H, inner: out,
      legend: [[C.up, '达到全基因组显著'], [C.brand, '未达显著阈值']],
      table: {
        head: ['染色体', '达到显著的位点数', '最强位点 -log10(p)'],
        rows: [['17', '2', '9.60'], ['11', '2', '8.70'], ['3', '1', '8.20'], ['22', '1', '7.90'], ['14', '1', '7.70'], ['5', '1', '7.40']]
      }
    };
  }
};

/* ---- ACMG 分级 ---- */
CHARTS.acmg = {
  title: 'ACMG 致病性分级分布',
  draw: function () {
    var rows = [['良性', 8419, C.ok], ['可能良性', 3116, '#5AA98A'], ['意义未明', 1942, C.ink3], ['可能致病', 87, '#D8834A'], ['致病', 24, C.up]];
    var W = 640, H = 232, m = { t: 14, r: 62, b: 14, l: 78 };
    var pw = W - m.l - m.r, max = rows[0][1], bh = 26, gap = 10;
    var out = '';
    rows.forEach(function (r, i) {
      var y = m.t + i * (bh + gap), w = Math.max(2, r[1] / max * pw);
      out += txt(m.l - 9, y + bh / 2 + 4, r[0], { anchor: 'end', fs: 12, fill: C.ink2 });
      out += rect(m.l, y, w, bh, r[2], ' rx="3"');
      out += txt(m.l + w + 8, y + bh / 2 + 4, fmt(r[1]), { fs: 12, mono: true, fill: C.ink, w: 500 });
    });
    return {
      w: W, h: H, inner: out,
      table: { head: ['ACMG 等级', '变异数', '占比'], rows: rows.map(function (r) { return [r[0], fmt(r[1]), (r[1] / 13588 * 100).toFixed(2) + '%']; }) }
    };
  }
};

/* ---- 火山图 ---- */
CHARTS.volcano = {
  title: '火山图 · log2FC vs -log10(padj)',
  draw: function () {
    var W = 640, H = 262, m = { t: 18, r: 12, b: 34, l: 44 };
    var pw = W - m.l - m.r, ph = H - m.t - m.b, xMax = 6, yMax = 10.2;
    var rand = rng(7781), pts = [];
    for (var i = 0; i < 260; i++) {
      var lfc = (rand() * 2 - 1) * (rand() * rand()) * 6.4;
      var y = Math.pow(rand(), 2.1) * 9.4;
      var dir = lfc > 0 ? 'up' : 'down';
      var sig = Math.abs(lfc) >= 1 && y >= 1.301;
      pts.push([lfc, y, sig ? dir : 'ns']);
    }
    var xs = function (v) { return m.l + (v + xMax) / (xMax * 2) * pw; };
    var ys = function (v) { return m.t + ph - Math.min(v, yMax) / yMax * ph; };
    var out = '';
    [0, 2, 4, 6, 8, 10].forEach(function (t) {
      out += line(m.l, ys(t), m.l + pw, ys(t), C.grid, ' stroke-width="1"');
      out += txt(m.l - 7, ys(t) + 3.5, t, { anchor: 'end', fs: 10, mono: true });
    });
    out += txt(m.l, m.t - 7, '-log10(padj)', { fs: 10.5, mono: true });
    [-4, -2, 0, 2, 4].forEach(function (t) {
      out += txt(xs(t), H - 14, t, { anchor: 'middle', fs: 10, mono: true });
    });
    out += txt(W - 12, H - 14, 'log2FC', { anchor: 'end', fs: 10.5, mono: true });
    pts.forEach(function (p) {
      out += circle(xs(p[0]), ys(p[1]), p[2] === 'ns' ? 1.9 : 2.4, p[2] === 'up' ? C.up : p[2] === 'down' ? C.down : C.ns, { op: p[2] === 'ns' ? .5 : .74 });
    });
    [-1, 1].forEach(function (t) { out += line(xs(t), m.t, xs(t), m.t + ph, C.ink3, ' stroke-width="1" stroke-dasharray="4 4" opacity=".55"'); });
    out += line(m.l, ys(1.301), m.l + pw, ys(1.301), C.ink3, ' stroke-width="1" stroke-dasharray="4 4" opacity=".55"');
    out += txt(xs(1) + 5, m.t + 12, '|log2FC| = 1', { fs: 9.5, fill: C.ink3 });
    out += txt(m.l + 5, ys(1.301) - 5, 'padj = 0.05', { fs: 9.5, fill: C.ink3 });
    out += rect(m.l + 10, m.t + 6, 118, 20, '#FFFFFF', ' rx="4" opacity=".9"');
    out += txt(m.l + 18, m.t + 20, '上调 612 · 下调 635', { fs: 10.5, mono: true, fill: C.ink2 });
    return {
      w: W, h: H, inner: out,
      legend: [[C.up, '显著上调'], [C.down, '显著下调'], [C.ns, '未达显著']],
      table: {
        head: ['方向', '基因数', 'log2FC 范围', 'padj 范围'],
        rows: [['上调', '612', '1.02 – 4.87', '3.2e-09 – 4.9e-02'], ['下调', '635', '-1.01 – -3.21', '8.7e-09 – 5.0e-02']]
      }
    };
  }
};

/* ---- 聚类热图 ---- */
CHARTS.heatmap = {
  title: '聚类热图 · 16 基因 × 12 样本',
  draw: function () {
    var genes = ['CYP3A4', 'TNF', 'IL6', 'NFKB1', 'CXCL8', 'STAT3', 'ALB', 'APOA1', 'SLC22A1', 'GSTM1', 'CYP2C19', 'UGT1A1', 'ABCG2', 'NR1I2', 'HNF4A', 'PPARA'];
    var W = 640, m = { t: 30, r: 14, b: 16, l: 76 };
    var cw = 30, chh = 15, pw = cw * 12, H = m.t + chh * genes.length + m.b;
    var rand = rng(5150), out = '';
    genes.forEach(function (g, r) {
      var group = r < 8 ? 1 : -1;
      out += txt(m.l - 8, m.t + r * chh + chh / 2 + 3.5, g, { anchor: 'end', fs: 10, mono: true, fill: C.ink2 });
      for (var c = 0; c < 12; c++) {
        var grp = c < 6 ? 1 : -1;
        var v = group * grp * (0.6 + rand() * 1.1) + (rand() - .5) * 0.7;
        var t = Math.max(-1, Math.min(1, v / 2.1));
        var fill = t >= 0 ? mix('#FFFFFF', C.up, t) : mix('#FFFFFF', C.down, -t);
        out += rect(m.l + c * cw, m.t + r * chh, cw - 1.5, chh - 1.5, fill, ' rx="1.5"');
      }
    });
    for (var c = 0; c < 12; c++) out += txt(m.l + c * cw + cw / 2, m.t - 9, 'S' + (c + 1 < 10 ? '0' + (c + 1) : c + 1), { anchor: 'middle', fs: 9.5, mono: true });
    var barX = m.l + pw + 22, barW = 12, barH = 92;
    for (var i = 0; i < barH; i++) {
      var t2 = 1 - i / barH;
      var f = t2 >= 0 ? mix('#FFFFFF', C.up, t2) : mix('#FFFFFF', C.down, -t2);
      out += rect(barX, m.t + 20 + i, barW, 1.2, f);
    }
    out += txt(barX + barW + 6, m.t + 26, '高', { fs: 10, fill: C.ink3 });
    out += txt(barX + barW + 6, m.t + 112, '低', { fs: 10, fill: C.ink3 });
    out += txt(m.l + pw / 2, H - 4, '前 6 列 = 处理组 · 后 6 列 = 对照组', { anchor: 'middle', fs: 10, fill: C.ink3 });
    return {
      w: W, h: H, inner: out,
      table: {
        head: ['基因', '处理组平均', '对照组平均', 'log2FC', 'padj'],
        rows: [['CYP3A4', '3,912', '268', '3.84', '3.2e-09'], ['TNF', '1,842', '281', '2.71', '2.9e-08'], ['IL6', '2,204', '377', '2.55', '5.1e-08'], ['ALB', '8,204', '71,338', '-3.21', '8.7e-09'], ['APOA1', '3,106', '24,489', '-2.96', '1.4e-08'], ['SLC22A1', '612', '2,804', '-2.18', '7.6e-08']]
      }
    };
  }
};

/* ---- 样本相关性矩阵 ---- */
CHARTS.corr = {
  title: '样本相关性矩阵',
  draw: function () {
    var n = 10, cell = 34, m = { t: 44, r: 14, b: 14, l: 44 };
    var W = 640, H = m.t + n * cell + m.b;
    var rand = rng(3312), M = [];
    for (var i = 0; i < n; i++) { M[i] = []; for (var j = 0; j < n; j++) M[i][j] = i === j ? 1 : 0; }
    for (var i2 = 0; i2 < n; i2++) for (var j2 = i2 + 1; j2 < n; j2++) {
      var same = (i2 < 5) === (j2 < 5);
      var base = i2 === 8 || j2 === 8 ? 0.82 : (same ? 0.965 : 0.912);
      var v = base + (rand() - .5) * 0.035;
      M[i2][j2] = M[j2][i2] = Math.max(0.72, Math.min(0.998, v));
    }
    var gx = m.l + (W - m.l - m.r - n * cell) / 2;
    var out = '';
    for (var a = 0; a < n; a++) {
      out += txt(gx + a * cell + cell / 2, m.t - 10, 'S' + (a + 1 < 10 ? '0' + (a + 1) : a + 1), { anchor: 'middle', fs: 10, mono: true });
      out += txt(gx - 8, m.t + a * cell + cell / 2 + 3.5, 'S' + (a + 1 < 10 ? '0' + (a + 1) : a + 1), { anchor: 'end', fs: 10, mono: true });
    }
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      var v = M[r][c], t = Math.max(0, (v - 0.75) / 0.25);
      var fill = r === c ? C.brandDeep : mix('#F2F7FF', C.brand, t);
      var label = v.toFixed(2).replace('1.00', '1');
      out += rect(gx + c * cell, m.t + r * cell, cell - 2, cell - 2, fill, ' rx="3"');
      out += txt(gx + c * cell + (cell - 2) / 2, m.t + r * cell + cell / 2 + 3.4, label, { anchor: 'middle', fs: 9.5, mono: true, fill: onFill(fill) });
    }
    return {
      w: W, h: H, inner: out,
      table: {
        head: ['样本', '组内中位相关性', '与全队列中位相关性', '判定'],
        rows: [['S01–S05（处理组）', '0.962', '0.941', '正常'], ['S06–S10（对照组）', '0.958', '0.938', '正常'], ['S09', '0.836', '0.824', '偏低，建议复核']]
      }
    };
  }
};

/* ---- 富集气泡图 ---- */
CHARTS.bubble = {
  title: '富集气泡图',
  draw: function () {
    var rows = [
      ['药物代谢 - 细胞色素 P450', 0.58, 62, 8.1e-14],
      ['细胞因子受体互作', 0.54, 71, 4.3e-11],
      ['胆汁酸生物合成', 0.62, 31, 2.7e-09],
      ['亚油酸代谢', 0.49, 28, 1.1e-07],
      ['类固醇激素生物合成', 0.66, 22, 8.4e-07],
      ['IL-17 信号通路', 0.42, 38, 3.9e-06],
      ['谷胱甘肽代谢', 0.55, 19, 2.2e-05],
      ['补体与凝血级联', 0.61, 24, 7.6e-05],
      ['PPAR 信号通路', 0.45, 26, 4.1e-04],
      ['外源物质代谢', 0.71, 15, 9.8e-04]
    ];
    var W = 640, H = 330, m = { t: 20, r: 76, b: 34, l: 210 };
    var pw = W - m.l - m.r, ph = H - m.t - m.b;
    var out = '', xs = function (v) { return m.l + (v - 0.3) / 0.5 * pw; };
    [0.3, 0.4, 0.5, 0.6, 0.7, 0.8].forEach(function (t) {
      out += line(xs(t), m.t, xs(t), m.t + ph, C.grid, ' stroke-width="1"');
      out += txt(xs(t), H - 14, t.toFixed(1), { anchor: 'middle', fs: 10, mono: true });
    });
    out += txt(m.l + pw / 2, H - 2, '基因比率（GeneRatio）', { anchor: 'middle', fs: 10 });
    rows.forEach(function (r, i) {
      var y = m.t + ph - (i + 1) * (ph / rows.length) + ph / rows.length / 2;
      var rad = 3 + Math.sqrt(r[2]) * 1.25;
      var t = Math.min(1, Math.log10(1 / r[3]) / 14);
      out += rect(m.l, y - 13, pw, 26, i % 2 ? '#FBFDFF' : '#FFFFFF');
      out += txt(m.l - 10, y + 4, r[0], { anchor: 'end', fs: 10.5, fill: C.ink2 });
      out += circle(xs(r[1]), y, rad, mix(C.brandLine, C.brandDeep, t), { op: .88 });
    });
    out += txt(W - 12, m.t + 6, '气泡 = 基因数', { anchor: 'end', fs: 10, fill: C.ink3 });
    out += txt(W - 12, m.t + 22, '颜色 = padj', { anchor: 'end', fs: 10, fill: C.ink3 });
    return {
      w: W, h: H, inner: out,
      table: { head: ['通路', '基因比率', '基因数', 'padj'], rows: rows.map(function (r) { return [r[0], r[1].toFixed(2), r[2], r[3].toExponential(1)]; }) }
    };
  }
};

/* ---- 通路层级网络 ---- */
CHARTS.pathway = {
  title: '通路层级网络',
  draw: function () {
    var W = 640, H = 300, cx = 320, cy = 152;
    var nodes = [
      ['细胞色素 P450', 0, -0.86, 22, 1],
      ['外源物质代谢', 0.78, -0.42, 18, 1],
      ['谷胱甘肽代谢', 0.72, 0.55, 15, 1],
      ['胆汁酸合成', 0.06, 0.92, 16, 1],
      ['亚油酸代谢', -0.72, 0.62, 14, 1],
      ['类固醇合成', -0.84, -0.34, 13, 1],
      ['炎症反应', -0.2, -0.5, 20, 0],
      ['IL-17 信号', 0.36, -0.14, 17, 0],
      ['补体凝血', -0.34, 0.2, 14, 0]
    ];
    var R = 104;
    var pos = nodes.map(function (n) { return [cx + n[1] * R * 1.7, cy + n[2] * R, n[2], n[3], n[4], n[0]]; });
    var edges = [[0, 1], [0, 5], [0, 6], [0, 7], [1, 2], [1, 7], [2, 4], [2, 7], [3, 4], [3, 5], [3, 8], [4, 5], [6, 7], [6, 8], [7, 8]];
    var out = '';
    edges.forEach(function (e) {
      var a = pos[e[0]], b = pos[e[1]];
      out += line(a[0], a[1], b[0], b[1], C.hair2, ' stroke-width="1.4" opacity=".8"');
    });
    pos.forEach(function (p) {
      var r = 11 + p[3] * 0.34;
      var fill = p[4] ? C.brand : C.ns;
      out += circle(p[0], p[1], r, fill, { op: p[4] ? .92 : .55 });
      out += txt(p[0], p[1] + 3.5, p[3], { anchor: 'middle', fs: 10, mono: true, fill: onFill(fill), w: 500 });
      out += txt(p[0], p[1] + r + 13, p[5], { anchor: 'middle', fs: 10, fill: C.ink2 });
    });
    out += txt(12, 18, '节点大小 = 涉及基因数', { fs: 10, fill: C.ink3 });
    return {
      w: W, h: H, inner: out,
      legend: [[C.brand, '代谢 / 解毒类通路'], [C.ns, '炎症 / 免疫类通路']],
      table: {
        head: ['通路', '涉及基因数', '类别'],
        rows: [['药物代谢 - 细胞色素 P450', '62', '代谢 / 解毒'], ['外源物质代谢', '54', '代谢 / 解毒'], ['谷胱甘肽代谢', '41', '代谢 / 解毒'], ['胆汁酸生物合成', '36', '代谢 / 解毒'], ['亚油酸代谢', '28', '代谢 / 解毒'], ['类固醇激素生物合成', '24', '代谢 / 解毒'], ['细胞因子受体互作', '71', '炎症 / 免疫'], ['IL-17 信号通路', '38', '炎症 / 免疫'], ['补体与凝血级联', '24', '炎症 / 免疫']]
      }
    };
  }
};

/* ---- 通用横向条形图 ---- */
function hbarChart(rows, opts) {
  opts = opts || {};
  var W = 640, m = { t: opts.top || 16, r: 92, b: 18, l: opts.left || 150 };
  var pw = W - m.l - m.r, bh = 24, gap = 11;
  var H = m.t + rows.length * (bh + gap) + m.b;
  var max = Math.max.apply(null, rows.map(function (r) { return r[1]; })) * 1.04;
  var out = '';
  rows.forEach(function (r, i) {
    var y = m.t + i * (bh + gap), w = Math.max(3, r[1] / max * pw);
    var fill = r[2] || C.brand;
    out += txt(m.l - 9, y + bh / 2 + 4, r[0], { anchor: 'end', fs: 11, fill: C.ink2 });
    out += rect(m.l, y, pw, bh, '#F4F8FD', ' rx="3"');
    out += rect(m.l, y, w, bh, fill, ' rx="3"');
    out += txt(m.l + w + 8, y + bh / 2 + 4, (opts.fmt ? opts.fmt(r[1]) : fmt(r[1])) + (opts.unit || ''), { fs: 11.5, mono: true, fill: C.ink, w: 500 });
  });
  return { w: W, h: H, inner: out };
}

CHARTS.protbar = {
  title: '差异蛋白倍数分布',
  draw: function () {
    var rows = [
      ['C3 补体 C3', 3.42], ['SERPINA1 α1-抗胰蛋白酶', 3.06], ['FGA 纤维蛋白原 α', 2.84],
      ['APOB 载脂蛋白 B', 2.51], ['HP 触珠蛋白', 2.28],
      ['ALB 白蛋白', -3.18], ['APOA1 载脂蛋白 A1', -2.92], ['TF 转铁蛋白', -2.44],
      ['ORM1 酸性糖蛋白', -2.06], ['GC 维生素 D 结合蛋白', -1.87]
    ];
    var c = hbarChart(rows.map(function (r) {
      return [r[0], Math.abs(r[1]), r[1] > 0 ? C.up : C.down];
    }), { left: 172, fmt: function (v) { return v.toFixed(2); }, unit: '×' });
    return {
      w: c.w, h: c.h, inner: c.inner,
      legend: [[C.up, '上调'], [C.down, '下调']],
      table: { head: ['蛋白', '差异倍数', '方向', 'padj'], rows: [['C3', '3.42', '上调', '2.1e-06'], ['SERPINA1', '3.06', '上调', '4.8e-06'], ['FGA', '2.84', '上调', '1.2e-05'], ['ALB', '0.22 倍（-3.18）', '下调', '3.4e-07'], ['APOA1', '0.13 倍（-2.92）', '下调', '9.1e-07'], ['TF', '0.18 倍（-2.44）', '下调', '5.6e-06']] }
    };
  }
};

CHARTS.metabpath = {
  title: '代谢通路映射结果',
  draw: function () {
    var rows = [['胆汁酸生物合成', 34], ['亚油酸代谢', 25], ['花生四烯酸代谢', 21], ['色氨酸代谢', 18], ['嘌呤代谢', 16], ['甘油磷脂代谢', 13], ['精氨酸与脯氨酸代谢', 11], ['类固醇激素生物合成', 9]];
    var c = hbarChart(rows, { left: 168, unit: ' 个' });
    return {
      w: c.w, h: c.h, inner: c.inner,
      table: { head: ['通路', '差异代谢物数', 'KEGG ID'], rows: [['胆汁酸生物合成', '34', 'hsa00120'], ['亚油酸代谢', '25', 'hsa00591'], ['花生四烯酸代谢', '21', 'hsa00590'], ['色氨酸代谢', '18', 'hsa00380'], ['嘌呤代谢', '16', 'hsa00230'], ['甘油磷脂代谢', '13', 'hsa00564']] }
    };
  }
};

CHARTS.metabclass = {
  title: '代谢物分类构成',
  draw: function () {
    var rows = [['脂质与类脂分子', 342], ['有机酸及其衍生物', 268], ['有机杂环化合物', 176], ['苯环型化合物', 142], ['核苷与核苷酸', 96], ['其他', 82]];
    var c = hbarChart(rows, { left: 168, unit: ' 个' });
    return {
      w: c.w, h: c.h, inner: c.inner,
      table: { head: ['化学类别', '代谢物数', '占比', 'HMDB 收录'], rows: [['脂质与类脂分子', '342', '30.9%', '318'], ['有机酸及其衍生物', '268', '24.2%', '251'], ['有机杂环化合物', '176', '15.9%', '164'], ['苯环型化合物', '142', '12.8%', '135'], ['核苷与核苷酸', '96', '8.7%', '92'], ['其他', '82', '7.4%', '44']] }
    };
  }
};

CHARTS.ppi = {
  title: '蛋白互作网络',
  draw: function () {
    var W = 640, H = 300, cx = 320, cy = 150;
    var nodes = [
      ['ALB', 0, 0, 24, 1], ['APOA1', 0.62, -0.24, 19, 1], ['C3', 0.34, 0.5, 18, 1], ['SERPINA1', -0.42, 0.46, 17, 1],
      ['FGA', -0.28, -0.55, 14, 1], ['HP', 0.74, 0.42, 12, 0], ['TF', -0.78, -0.06, 15, 0], ['APOB', 0.16, -0.86, 13, 0], ['ORM1', 0.88, -0.5, 10, 0], ['GC', -0.86, 0.6, 11, 0]
    ];
    var R = 108, pos = nodes.map(function (n) { return [cx + n[1] * R * 1.66, cy + n[2] * R, n[3], n[4], n[0]]; });
    var edges = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 6], [1, 2], [1, 5], [1, 8], [2, 3], [2, 5], [3, 4], [3, 9], [4, 6], [6, 9], [0, 7], [2, 7]];
    var out = '';
    edges.forEach(function (e) {
      var a = pos[e[0]], b = pos[e[1]];
      out += line(a[0], a[1], b[0], b[1], C.hair2, ' stroke-width="1.5"');
    });
    pos.forEach(function (p) {
      var r = 10 + p[2] * 0.36;
      var fill = p[3] ? (p[4] === 'ALB' || p[4] === 'APOA1' ? C.brand : C.brandLite) : C.ns;
      out += circle(p[0], p[1], r, fill, { op: p[3] ? .93 : .58 });
      out += txt(p[0], p[1] + 3.5, p[4], { anchor: 'middle', fs: p[4].length > 4 ? 7.5 : 9, mono: true, fill: onFill(fill) });
    });
    out += txt(12, 18, '节点大小 = 连接度 · 聚集模块 = 协同变化', { fs: 10, fill: C.ink3 });
    return {
      w: W, h: H, inner: out,
      legend: [[C.brand, '核心模块（ALB / APOA1）'], [C.brandLite, '差异蛋白'], [C.ns, '背景蛋白']],
      table: { head: ['蛋白', '连接度', '差异倍数', '互作证据'], rows: [['ALB', '12', '0.11', '实验 + 数据库'], ['APOA1', '9', '0.13', '实验 + 数据库'], ['C3', '7', '10.7', '数据库'], ['SERPINA1', '5', '8.3', '实验 + 数据库'], ['FGA', '3', '7.1', '数据库'], ['TF', '3', '0.18', '数据库']] }
    };
  }
};

CHARTS.cover = {
  title: '组学覆盖分布',
  draw: function () {
    var W = 640, m = { t: 26, r: 60, b: 30, l: 84 }, pw = W - m.l - m.r;
    var rows = [['基因组', 75, 75], ['转录组', 75, 75], ['蛋白组', 71, 75]];
    var H = m.t + rows.length * 54 + m.b, out = '';
    out += txt(m.l, m.t - 8, '实心 = 可用于联合分析的样本', { fs: 10 });
    rows.forEach(function (r, i) {
      var y = m.t + i * 54, full = r[2] / 75 * pw, used = r[1] / 75 * pw;
      out += txt(m.l - 10, y + 17, r[0], { anchor: 'end', fs: 12, fill: C.ink2 });
      out += rect(m.l, y, full, 26, '#F4F8FD', ' rx="4"');
      out += rect(m.l, y, used, 26, i === 2 ? C.brand : C.brand, ' rx="4" opacity="' + (i === 2 ? .92 : 1) + '"');
      out += txt(m.l + full + 9, y + 17, r[1] + ' / 75', { fs: 11.5, mono: true, fill: C.ink, w: 500 });
      if (r[1] < r[2]) out += txt(m.l + used - 6, y + 17, '缺 4', { anchor: 'end', fs: 10, fill: '#FFFFFF' });
    });
    return {
      w: W, h: H, inner: out,
      table: { head: ['组学', '样本数', '可联合分析', '缺失'], rows: [['基因组', '75', '71', '4'], ['转录组', '75', '71', '4'], ['蛋白组', '71', '71', '4']] }
    };
  }
};

CHARTS.missing = {
  title: '缺失矩阵',
  draw: function () {
    var groups = ['S004', 'S037', 'S052', 'S068', 'S001–S003', 'S005–S036', 'S038–S051', 'S053–S067', 'S069–S075'];
    var omics = ['基因组', '转录组', '蛋白组'];
    var data = [
      [0, 0, 0.78, 0, 0, 0, 0, 0, 0.04],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0.62, 0.44, 0.71, 0.35, 0, 0, 0, 0, 0.03]
    ];
    var W = 640, m = { t: 40, r: 18, b: 16, l: 76 };
    var cw = (W - m.l - m.r) / groups.length, chh = 46, H = m.t + chh * 3 + m.b;
    var out = '';
    groups.forEach(function (g, c) {
      out += txt(m.l + c * cw + cw / 2, m.t - 12, g, { anchor: 'middle', fs: 9.5, mono: true });
    });
    omics.forEach(function (o, r) {
      out += txt(m.l - 9, m.t + r * chh + chh / 2 + 4, o, { anchor: 'end', fs: 11.5, fill: C.ink2 });
      for (var c = 0; c < groups.length; c++) {
        var v = data[r][c];
        var fill = v === 0 ? '#F1F6FC' : mix(C.brandSoft, C.up, Math.min(1, v));
        out += rect(m.l + c * cw + 1, m.t + r * chh + 1, cw - 2, chh - 2, fill, ' rx="4"');
        out += txt(m.l + c * cw + cw / 2, m.t + r * chh + chh / 2 + 3.5, v === 0 ? '完整' : (v * 100).toFixed(0) + '%', { anchor: 'middle', fs: 9.5, mono: true, fill: onFill(fill) });
      }
    });
    return {
      w: W, h: H, inner: out,
      legend: [['#F1F6FC', '完整'], [C.brandSoft, '缺失较少'], [C.up, '缺失较多']],
      table: { head: ['样本', '基因组', '转录组', '蛋白组', '处理'], rows: [['S004', '完整', '完整', '缺失 78%', '排除'], ['S037', '完整', '完整', '缺失 44%', '保留并标注'], ['S052', '完整', '缺失', '缺失 71%', '排除'], ['S068', '完整', '完整', '缺失 35%', '一键映射'], ['其余 71 例', '完整', '完整', '完整', '纳入分析']] }
    };
  }
};

/* ============================================================
   扩展图表：知识图谱（知识图谱页 kbgraph）
   ============================================================ */

/* ---- 知识图谱网络（以样本为核心节点） ---- */
var GRAPH = {
  center: { id: 'S037', r: 27, fill: C.brand, label: '样本 S037' },
  ring1: [
    { id: '肝细胞癌', r: 20, fill: '#C0392B', a: -90, label: '肝细胞癌' },
    { id: '牛磺胆酸', r: 20, fill: '#0E8A5F', a: -18, label: '牛磺胆酸' },
    { id: 'CYP3A4', r: 20, fill: C.brandLite, a: 54, label: 'CYP3A4' },
    { id: 'APOA1', r: 20, fill: '#B26A00', a: 126, label: 'APOA1' },
    { id: '胆汁酸生物合成', r: 20, fill: '#0E8A5F', a: 198, label: '胆汁酸生物合成' }
  ],
  ring2: [
    { id: '索拉非尼', p: '肝细胞癌', a: -116, label: '索拉非尼（药物）' },
    { id: '队列 TJ-TCM-2026', p: 'S037', a: -68, label: '队列 TJ-TCM-2026' },
    { id: 'PMID:31284061', p: '牛磺胆酸', a: -40, label: 'PMID:31284061' },
    { id: 'HMDB0000036', p: '牛磺胆酸', a: 8, label: 'HMDB0000036' },
    { id: '饮酒史', p: 'CYP3A4', a: 30, label: '饮酒史' },
    { id: '临床结局：复发', p: 'APOA1', a: 104, label: '临床结局：复发' },
    { id: 'KEGG hsa00120', p: '胆汁酸生物合成', a: 176, label: 'KEGG hsa00120' },
    { id: 'GO:0006954', p: '胆汁酸生物合成', a: 222, label: 'GO:0006954' }
  ],
  cross: [['牛磺胆酸', '胆汁酸生物合成']]
};
var KB_NODES = {
  'S037': ['样本', '主题样本。来自队列 TJ-TCM-2026，已完成基因组 / 转录组 / 蛋白组三组学对齐，纳入联合分析。', 6],
  '肝细胞癌': ['疾病', '本样本的临床诊断。知识库中与该诊断关联的实体共 14 个，其中 5 个经由本样本建立联系。', 14],
  '牛磺胆酸': ['代谢物', '血清代谢物，HMDB0000036。本样本中偏高 2.84 倍（padj = 3.2e-04），是胆汁酸通路变化最显著的一项。', 9],
  'CYP3A4': ['基因', '表达上调 3.1 倍（padj = 2.1e-11），是饮酒史的已知代谢酶，也是索拉非尼的主要代谢酶 —— 三条证据在此交汇。', 11],
  'APOA1': ['蛋白', '血清浓度偏低 0.42 倍，且与临床结局「复发」在队列内呈负相关 —— 分子层面与结局层面在此呼应。', 7],
  '胆汁酸生物合成': ['通路', 'KEGG hsa00120。本样本富集到 34 个差异代谢物，为该通路在本队列中的最大聚集。', 8],
  '索拉非尼': ['药物', '肝细胞癌一线靶向药。知识库记录 CYP3A4 为其主要代谢酶，CYP3A4 上调可能影响药物暴露。', 5],
  '队列 TJ-TCM-2026': ['队列', '本样本所属研究队列，共 75 例，跨三组学共同样本 71 例。', 12],
  'PMID:31284061': ['文献', '血清胆汁酸谱与肝细胞癌预后相关性的多中心研究（n = 412），支持牛磺胆酸作为候选标志物。', 3],
  'HMDB0000036': ['数据库条目', '牛磺胆酸在 HMDB 代谢物数据库中的标准条目，含 12 条关联通路。', 4],
  '饮酒史': ['临床变量', '本样本记录为「长期饮酒」。已知饮酒诱导 CYP3A4 表达，与 CYP3A4 上调互为解释。', 6],
  '临床结局：复发': ['结局', '随访 24 个月内的复发记录。与 APOA1 偏低在队列内呈负相关（r = −0.31）。', 5],
  'KEGG hsa00120': ['数据库条目', '胆汁酸生物合成在 KEGG 中的通路编号，涵盖 47 个已知酶与代谢物。', 4],
  'GO:0006954': ['数据库条目', 'GO 生物过程「炎症反应」，本队列富集到 76 个差异基因，padj = 3.5e-09。', 6]
};
CHARTS.graphnet = {
  title: '知识图谱 · 以样本 S037 为核心节点（点节点查看关联）',
  draw: function () {
    var W = 640, cx = 320, cy = 190, r1 = 82, r2 = 150;
    var H = 380, out = '', pos = {};
    var P = function (r, a) { var t = a * Math.PI / 180; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; };
    pos['S037'] = [cx, cy];
    GRAPH.ring1.forEach(function (n) { pos[n.id] = P(r1, n.a); });
    GRAPH.ring2.forEach(function (n) { pos[n.id] = P(r2, n.a); });
    /* 边 */
    var edges = GRAPH.ring1.map(function (n) { return ['S037', n.id]; })
      .concat(GRAPH.ring2.map(function (n) { return [n.p, n.id]; }))
      .concat(GRAPH.cross);
    edges.forEach(function (e) {
      var a = pos[e[0]], b = pos[e[1]];
      if (!a || !b) return;
      var cross = GRAPH.cross.some(function (c) { return c[0] === e[0] && c[1] === e[1]; });
      out += line(a[0], a[1], b[0], b[1], cross ? '#0E8A5F' : C.hair2, ' stroke-width="' + (cross ? 1.6 : 1.2) + '"' + (cross ? ' stroke-dasharray="4 3"' : ''));
    });
    /* 环 2 节点 */
    GRAPH.ring2.forEach(function (n) {
      var p = pos[n.id], lp = P(r2 + 24, n.a);
      var anchor = Math.cos(n.a * Math.PI / 180) > .25 ? 'start' : (Math.cos(n.a * Math.PI / 180) < -.25 ? 'end' : 'middle');
      out += '<g class="gnode" data-kbnode="' + n.id + '" role="button" tabindex="0" aria-label="' + n.label + '">';
      out += circle(p[0], p[1], 15, '#FFFFFF', { stroke: C.ink3, sw: 2 });
      out += txt(p[0], p[1] + 4, '●', { anchor: 'middle', fs: 9, fill: C.ink3 });
      out += '</g>';
      out += txt(lp[0], lp[1] + 4, n.label, { anchor: anchor, fs: 10.5, fill: C.ink2 });
    });
    /* 环 1 节点 */
    GRAPH.ring1.forEach(function (n) {
      var p = pos[n.id], lp = P(r1 + 26, n.a);
      var anchor = Math.cos(n.a * Math.PI / 180) > .25 ? 'start' : (Math.cos(n.a * Math.PI / 180) < -.25 ? 'end' : 'middle');
      out += '<g class="gnode" data-kbnode="' + n.id + '" role="button" tabindex="0" aria-label="' + n.label + '">';
      out += circle(p[0], p[1], n.r, n.fill, { op: .92 });
      out += '</g>';
      out += txt(lp[0], lp[1] + 4, n.label, { anchor: anchor, fs: 11.5, fill: C.ink, w: 500 });
    });
    /* 中心节点 */
    out += '<g class="gnode is-on" data-kbnode="S037" role="button" tabindex="0" aria-label="样本 S037">';
    out += circle(cx, cy, 34, C.brandSoft);
    out += circle(cx, cy, GRAPH.center.r, C.brand);
    out += txt(cx, cy - 2, 'S037', { anchor: 'middle', fs: 13, fill: '#FFFFFF', mono: true, w: 500 });
    out += txt(cx, cy + 13, '样本', { anchor: 'middle', fs: 10, fill: '#CBE4EA' });
    out += '</g>';
    return {
      w: W, h: H, inner: out,
      legend: [[C.brand, '样本'], [C.up, '疾病'], [C.brandLite, '基因'], [C.warn, '蛋白'], [C.ok, '代谢物 / 通路'], [C.ink3, '证据与数据库条目']],
      table: {
        head: ['实体', '类型', '与样本 S037 的关系', '证据条数'],
        rows: GRAPH.ring1.concat(GRAPH.ring2).map(function (n) {
          var k = KB_NODES[n.id];
          return [n.label, k[0], k[1], String(k[2])];
        })
      }
    };
  }
};

/* ---- 渲染一个图表块（图 + 图例 + 注解带 + 数据表替代视图） ---- */
var chartSeq = 0;
/* 单张图渲染失败不能连坐整页：捕获后只在原地显示错误，并记账供验证脚本读取 */
var CHART_ERR = [];
function renderChart(host) {
  var key = host.getAttribute('data-chart');
  var cfg = CHARTS[key];
  if (!cfg) return;
  var r;
  try {
    r = cfg.draw();
  } catch (err) {
    CHART_ERR.push(key + ' → ' + (err && err.message));
    host.innerHTML = '<div class="alert alert--danger"><span class="alert__ico">' + ico('triangle-exclamation') + '</span>'
      + '<div class="alert__bd"><div class="alert__t">图表「' + key + '」渲染失败</div>'
      + '<p class="alert__p">' + ((err && err.message) || '未知错误') + '</p></div></div>';
    return;
  }
  var id = 'ct' + (++chartSeq);
  var h = '';
  /* v62：每张图右上角的「设置」入口 —— 打开右侧图表设置面板（尺寸/配色/网格/标题）。
     面板与逻辑都由 CHART_CFG 驱动，不改各图自己的 draw()，也就不会把 14 张图的
     坐标与数据重写一遍。 */
  h += '<div class="chart-tools"><button type="button" class="chart-tool" data-chart-set="' + key
    + '" title="图表设置" aria-label="图表设置">⚙ 设置</button></div>';
  /* title 同时兼职无障碍名（传给 wrap 的 aria-label）。多数图的卡片头是另一个
     说法（「染色体分布（曼哈顿图）」↔「曼哈顿图 · -log10(p)」），两者并存互补；
     但当卡片头与图名完全同名时（对齐矩阵）会重复，用 showTitle:false 只留无障碍名。 */
  if (cfg.title && cfg.showTitle !== false) h += '<div class="chart-title text-[12px] text-ink3 mb-2">' + cfg.title + '</div>';
  h += wrap(r.w, r.h, cfg.title || key, r.inner, r.maxW);
  if (r.legend) {
    h += '<div class="chart__lg">' + r.legend.map(function (l) {
      return '<span><i style="background:' + l[0] + '"></i>' + l[1] + '</span>';
    }).join('') + '</div>';
  }
  if (r.table) {
    h += '<div class="mt-3 chart-tbl-bar"><button class="chart-alt" data-alt="' + id + '">'
      + ico('table-cells') + ' 查看数据表（无障碍替代视图）</button>'
      + '<button class="chart-alt chart-dl" data-tbl-dl="' + id + '" data-tbl-name="' + key + '">'
      + ico('download') + ' 下载表格</button>';
    h += '<div class="chart-tbl mt-3" id="' + id + '" hidden><div class="tblwrap"><table class="tbl"><thead><tr>'
      + r.table.head.map(function (k) { return '<th>' + k + '</th>'; }).join('')
      + '</tr></thead><tbody>'
      + r.table.rows.map(function (row) {
        return '<tr>' + row.map(function (c, i) { return '<td class="' + (i > 0 ? 'num' : '') + '">' + c + '</td>'; }).join('') + '</tr>';
      }).join('')
      + '</tbody></table></div><p class="text-[11.5px] text-ink3 mt-2">'
      + (r.table.note || '完整数据请使用卡片右上角的「导出」按钮获取。') + '</p></div></div>';
  }
  host.innerHTML = h;
  applyChartCfg(host);
}

/* ============================================================
   v62 · 图表设置（每图一套，内存内保存）
   ============================================================
   需求：分析步骤里的图表要能设置/编辑。实现走「后处理 SVG」而不是给 14 个
   draw() 各加一套参数 —— 图的绘制逻辑与配色都写死在 draw 里，逐图改等于把
   坐标系重写一遍；而设置面板要调的（尺寸、背景、网格、点色、标题）都是
   **已经画出来的元素**，在 DOM 上按「原始绘制色」做映射重着色就能通用覆盖。 */
var CHART_CFG = {};
var CHART_SET_HOST = null;

function chartCfgOf(key) {
  if (!CHART_CFG[key]) CHART_CFG[key] = {
    wPct: 100, hPx: 0, bg: '', grid: 1, lineW: 1,
    up: C.up, down: C.down, ns: C.ns,
    legend: 1, title: '', titleSize: 12, titleColor: ''
  };
  return CHART_CFG[key];
}

function applyChartCfg(host) {
  if (!host) return;
  var key = host.getAttribute('data-chart'); if (!key) return;
  var cf = chartCfgOf(key);
  var svg = host.querySelector('svg.chart');
  host.style.background = cf.bg || '';
  if (svg) {
    svg.style.width = cf.wPct ? cf.wPct + '%' : '';
    svg.style.height = cf.hPx ? cf.hPx + 'px' : '';
  }
  var t = host.querySelector('.chart-title');
  if (t) {
    var def = (CHARTS[key] && CHARTS[key].title) || '';
    t.textContent = cf.title || def;
    t.style.fontSize = cf.titleSize + 'px';
    t.style.color = cf.titleColor || '';
  }
  if (!svg) return;
  /* 首个元素记下「原始色」，之后每次应用都从原始色重新映射 ——
     否则改第二次时拿到的已经是上一次改过的色，再也回不去。 */
  Array.prototype.slice.call(svg.querySelectorAll('circle,line')).forEach(function (el) {
    if (!el.hasAttribute('data-oc')) {
      el.setAttribute('data-oc', el.getAttribute('fill') || el.getAttribute('stroke') || '');
    }
    var oc = (el.getAttribute('data-oc') || '').toLowerCase();
    var isFill = el.hasAttribute('fill');
    var cur = el.getAttribute('data-oc');
    if (oc === C.up.toLowerCase()) cur = cf.up;
    else if (oc === C.down.toLowerCase()) cur = cf.down;
    else if (oc === C.ns.toLowerCase()) cur = cf.ns;
    el.setAttribute(isFill ? 'fill' : 'stroke', cur);
    if (oc === C.grid.toLowerCase()) {
      el.style.display = cf.grid ? '' : 'none';
      if (!el.hasAttribute('data-ow')) el.setAttribute('data-ow', el.getAttribute('stroke-width') || '1');
      el.setAttribute('stroke-width', cf.lineW || 1);
    }
  });
  var lg = host.querySelector('.chart__lg');
  if (lg) {
    lg.hidden = !cf.legend;
    Array.prototype.slice.call(lg.querySelectorAll('i')).forEach(function (i) {
      if (!i.hasAttribute('data-oc')) i.setAttribute('data-oc', i.style.background || '');
      var oc = (i.getAttribute('data-oc') || '').toLowerCase();
      var cur = i.getAttribute('data-oc');
      if (oc === C.up.toLowerCase()) cur = cf.up;
      else if (oc === C.down.toLowerCase()) cur = cf.down;
      else if (oc === C.ns.toLowerCase()) cur = cf.ns;
      i.style.background = cur;
    });
  }
}

/* 右侧图表设置面板：JS 建一次，之后只切「当前作用于哪张图」。 */
function ensureChartSetPanel() {
  if ($('#chartSet')) return;
  var h = '<aside class="chart-set" id="chartSet" aria-label="图表设置">'
    + '<header class="chart-set__hd"><span class="chart-set__t">图表设置</span>'
    + '<span class="chart-set__n" id="csName"></span>'
    + '<button type="button" class="iconbtn" id="csClose" aria-label="关闭图表设置">' + ico('xmark') + '</button></header>'
    + '<div class="chart-set__bd">'
    + '<div class="chart-set__grp"><div class="chart-set__gt">尺寸</div>'
    + '<label class="chart-set__row"><span>宽度</span><input type="number" id="csW" min="20" max="100" step="5" value="100"><i>%</i></label>'
    + '<label class="chart-set__row"><span>高度</span><input type="number" id="csH" min="0" step="20" value="0"><i>px（0=自适应）</i></label>'
    + '</div>'
    + '<div class="chart-set__grp"><div class="chart-set__gt">外观</div>'
    + '<label class="chart-set__row"><span>背景色</span><input type="color" id="csBg" value="#ffffff"></label>'
    + '<label class="chart-set__row"><span>显示网格线</span><input type="checkbox" id="csGrid" checked></label>'
    + '<label class="chart-set__row"><span>线条宽度</span><input type="number" id="csLineW" min="0.5" max="4" step="0.5" value="1"></label>'
    + '<label class="chart-set__row"><span>显示图例</span><input type="checkbox" id="csLegend" checked></label>'
    + '</div>'
    + '<div class="chart-set__grp"><div class="chart-set__gt">颜色</div>'
    + '<label class="chart-set__row"><span>上调</span><input type="color" id="csUp" value="' + C.up + '"></label>'
    + '<label class="chart-set__row"><span>下调</span><input type="color" id="csDown" value="' + C.down + '"></label>'
    + '<label class="chart-set__row"><span>点 / 未显著</span><input type="color" id="csNs" value="' + C.ns + '"></label>'
    + '</div>'
    + '<div class="chart-set__grp"><div class="chart-set__gt">主标题</div>'
    + '<label class="chart-set__col"><span>标题文字（留空用默认）</span><input type="text" id="csTitle" placeholder="默认标题"></label>'
    + '<label class="chart-set__row"><span>字号</span><input type="number" id="csTitleSize" min="8" max="28" value="12"></label>'
    + '<label class="chart-set__row"><span>颜色</span><input type="color" id="csTitleColor" value="#7a8ca3"></label>'
    + '</div>'
    + '</div>'
    + '<footer class="chart-set__ft"><button type="button" class="btn btn--sm" id="csReset">恢复默认</button>'
    + '<button type="button" class="btn btn--sm btn--primary" id="csDone">完成</button></footer>'
    + '</aside>';
  document.body.insertAdjacentHTML('beforeend', h);
  var box = $('#chartSet');
  box.addEventListener('input', syncChartSet);
  box.addEventListener('change', syncChartSet);
  $('#csClose').addEventListener('click', closeChartSet);
  $('#csDone').addEventListener('click', closeChartSet);
  $('#csReset').addEventListener('click', function () {
    if (!CHART_SET_HOST) return;
    var key = CHART_SET_HOST.getAttribute('data-chart');
    CHART_CFG[key] = null;
    fillChartSet(); applyChartCfg(CHART_SET_HOST);
  });
}

function fillChartSet() {
  if (!CHART_SET_HOST) return;
  var key = CHART_SET_HOST.getAttribute('data-chart');
  var cf = chartCfgOf(key);
  $('#csName').textContent = (CHARTS[key] && CHARTS[key].title) || key;
  $('#csW').value = cf.wPct; $('#csH').value = cf.hPx;
  $('#csBg').value = cf.bg || '#ffffff'; $('#csGrid').checked = !!cf.grid;
  $('#csLineW').value = cf.lineW; $('#csLegend').checked = !!cf.legend;
  $('#csUp').value = cf.up; $('#csDown').value = cf.down; $('#csNs').value = cf.ns;
  $('#csTitle').value = cf.title || ''; $('#csTitleSize').value = cf.titleSize;
  $('#csTitleColor').value = cf.titleColor || '#7a8ca3';
}

function syncChartSet() {
  if (!CHART_SET_HOST) return;
  var key = CHART_SET_HOST.getAttribute('data-chart');
  var cf = chartCfgOf(key);
  cf.wPct = Math.max(20, Math.min(100, Number($('#csW').value) || 100));
  cf.hPx = Math.max(0, Number($('#csH').value) || 0);
  cf.bg = $('#csBg').value === '#ffffff' ? '' : $('#csBg').value;
  cf.grid = $('#csGrid').checked ? 1 : 0;
  cf.lineW = Number($('#csLineW').value) || 1;
  cf.legend = $('#csLegend').checked ? 1 : 0;
  cf.up = $('#csUp').value; cf.down = $('#csDown').value; cf.ns = $('#csNs').value;
  cf.title = $('#csTitle').value.trim();
  cf.titleSize = Number($('#csTitleSize').value) || 12;
  cf.titleColor = $('#csTitleColor').value === '#7a8ca3' ? '' : $('#csTitleColor').value;
  applyChartCfg(CHART_SET_HOST);
}

function openChartSet(btn) {
  ensureChartSetPanel();
  var host = btn.closest('.chartbox');
  if (!host) return;
  CHART_SET_HOST = host;
  fillChartSet();
  $('#chartSet').classList.add('is-open');
}
function closeChartSet() {
  var p = $('#chartSet'); if (p) p.classList.remove('is-open');
  CHART_SET_HOST = null;
}

/* 表格下载：任意 <table> → TSV，走与其它下载一致的「确认框 → 落地文件」链路。 */
function tblDownload(btn) {
  var id = btn.getAttribute('data-tbl-dl');
  var tbl = id ? document.getElementById(id)
    : (btn.closest('.chartbox') ? btn.closest('.chartbox').querySelector('table') : null);
  if (!tbl) { toast('这张表暂时没有可导出的数据', 'warn'); return; }
  var rows = dlTableRows(tbl);
  if (rows.length < 2) { toast('这张表暂时没有可导出的数据', 'warn'); return; }
  var nm = (btn.getAttribute('data-tbl-name') || 'data_table');
  var spec = {
    name: dlSafeName(nm) + '.tsv', fmt: 'TSV',
    src: '分析结果 › 图表数据表',
    text: dlTsv(rows), lines: rows.length - 1,
    note: rows[0].join(' / ') + ' · 共 ' + (rows.length - 1) + ' 行'
  };
  DL_PEND = spec;
  showModal('下载确认', dlModalBody(spec),
    '<button type="button" class="btn" data-close="modal">取消</button>'
    + '<button type="button" class="btn btn--primary" data-dl-go="1">' + ico('download') + '确认下载</button>');
}

/* ============================================================
   结果页其余表格
   ============================================================ */
var ENRICH = [
  ['hsa00982', '药物代谢 - 细胞色素 P450', 'KEGG', 62, '8.1e-14'],
  ['hsa04060', '细胞因子与受体互作', 'KEGG', 71, '4.3e-11'],
  ['hsa00120', '胆汁酸生物合成', 'KEGG', 31, '2.7e-09'],
  ['hsa00591', '亚油酸代谢', 'KEGG', 28, '1.1e-07'],
  ['hsa00140', '类固醇激素生物合成', 'KEGG', 22, '8.4e-07'],
  ['GO:0098542', '对其它生物体的防御反应', 'GO-BP', 88, '6.2e-10'],
  ['GO:0006954', '炎症反应', 'GO-BP', 76, '3.5e-09'],
  ['GO:0017144', '药物代谢过程', 'GO-BP', 41, '1.8e-08']
];
var PROT = [
  ['C3', '补体 C3', '3.42', '2.1e-06', 'up'],
  ['SERPINA1', 'α1-抗胰蛋白酶', '3.06', '4.8e-06', 'up'],
  ['FGA', '纤维蛋白原 α 链', '2.84', '1.2e-05', 'up'],
  ['ALB', '白蛋白', '-3.18', '3.4e-07', 'down'],
  ['APOA1', '载脂蛋白 A1', '-2.92', '9.1e-07', 'down'],
  ['TF', '转铁蛋白', '-2.44', '5.6e-06', 'down']
];
var METAB = [
  ['牛磺胆酸', 'HMDB0000036', '2.84', '3.21', '高'],
  ['甘氨胆酸', 'HMDB0000138', '2.51', '2.88', '高'],
  ['亚油酸', 'HMDB0000673', '2.36', '2.42', '高'],
  ['花生四烯酸', 'HMDB0001043', '2.12', '1.94', '中'],
  ['L-色氨酸', 'HMDB0000929', '1.94', '0.41', '高'],
  ['次黄嘌呤', 'HMDB0000157', '1.87', '1.72', '中']
];

function fillTables() {
  var t;
  if ((t = $('#enrichTable'))) {
    t.innerHTML = ENRICH.map(function (r) {
      return '<tr><td class="num">' + r[0] + '</td><td>' + r[1] + '</td><td class="text-ink3">' + r[2] + '</td><td class="num">' + r[3] + '</td><td class="num">' + r[4] + '</td></tr>';
    }).join('');
  }
  if ((t = $('#protTable'))) {
    t.innerHTML = PROT.map(function (r) {
      var tag = r[4] === 'up'
        ? '<span class="tag tag--danger">' + ico('arrow-trend-up') + '上调</span>'
        : '<span class="tag tag--brand">' + ico('arrow-trend-down') + '下调</span>';
      return '<tr><td class="num">' + r[0] + '</td><td class="text-ink3">' + r[1] + '</td><td class="num">' + r[2] + '</td><td class="num">' + r[3] + '</td><td>' + tag + '</td></tr>';
    }).join('');
  }
  if ((t = $('#metabTable'))) {
    t.innerHTML = METAB.map(function (r) {
      return '<tr><td>' + r[0] + '</td><td class="num text-ink3">' + r[1] + '</td><td class="num">' + r[2] + '</td><td class="num">' + r[3] + '</td><td><span class="tag ' + (r[4] === '高' ? 'tag--ok' : 'tag--warn') + '">' + r[4] + '</span></td></tr>';
    }).join('');
  }
}

/* ============================================================
   内置公开数据集与参考基因组
   样本量与 accession 取自各项目公开口径（见每条 src / acc）
   ============================================================ */
var KIND = { bulk: 'bulk 表达', sc: '单细胞', vari: '变异' };
var SPECIES = { human: '人类', mouse: '小鼠' };

/* v40：内置示例数据集分两组，凑成一个「同一份设置表里逐条可改」的清单。
     SAMPLE_DS  —— 院内队列（点选 = 直接开一条分析流程），原先硬编码在 HTML 里；
     PUB_DS     —— 人类 / 小鼠公开数据集，点选后载入数据汇集页。
   两条都挂 show / intro / img：这三项在系统管理 › 示例数据集里逐条编辑，
   改完立刻作用到这里 —— 设置如果只改了个寂寞，那页而言等于是不存在的。 */
/* 封面取值三种：''（不配封面）/ 'img:xxx'（内置第 N 张）/ 'data:image/…'（本地上传）。
   为什么不直接存 assets 路径：build 会把 HTML 里的 assets/xxx 路径替换成 base64
   （单文件分发要用），源码里写死这个串就让「产物里的 JS」与「源码」不再一致。
   运行时查表既躲开这一步，改封面时也不用关心版本号。 */
function assetAbs(p) {
  var k = 'assets/' + p;
  return (window.IMG_URI || {})[k] || k;
}
function resolveImg(v) {
  if (!v) return '';
  if (v.indexOf('data:image/') === 0) return v;
  if (v.indexOf('img:') === 0) {
    var hit = DEMO_IMGS.filter(function (im) { return im.v === v; })[0];
    return hit ? assetAbs(hit.f) : '';
  }
  return v;
}
/* v 是选项值（短键），f 是文件名，由 assetAbs() 拼成真实地址 */
var DEMO_IMGS = [
  { v: 'img:wgs', f: 'dataset-wgs.jpg', n: '测序仪 · 全基因组' },
  { v: 'img:rnaseq', f: 'dataset-rnaseq.jpg', n: '实验台 · 转录组' },
  { v: 'img:sc', f: 'dataset-singlecell.jpg', n: '显微视野 · 单细胞' }
];
var SAMPLE_DS = [
  { id: 'own-wgs', sp: 'own', n: 'TJ-TCM 全基因组测序', pick: 'WGS 全基因组测序',
    meta: '75 样本 · 36.2 GB', tags: ['VCF / BCF', 'GRCh38'], ref: 'hg38',
    intro: '本院 2026 年入组的 75 例肝病队列全基因组测序，用于胚系变异与体细胞突变分析。',
    img: 'img:wgs', show: true },
  { id: 'own-rna', sp: 'own', n: 'TJ-TCM 转录组表达矩阵', pick: '转录组表达矩阵',
    meta: '75 样本 · 61,842 基因', tags: ['TSV', 'FPKM'], ref: 'hg38',
    intro: '同队列的转录组表达矩阵，与蛋白组、代谢组共同覆盖 71 例样本。',
    img: 'img:rnaseq', show: true },
  { id: 'own-sc', sp: 'own', n: '单细胞转录组 · 肺腺癌', pick: '单细胞转录组',
    meta: '12 样本 · 84,210 细胞', tags: ['h5ad', '10x'], ref: 'hg38',
    intro: '12 例肺腺癌单细胞转录组，用于细胞类型注释与微环境分析。',
    img: 'img:sc', show: true }
];

var PUB_DS = [
  { id: 'tcga-lihc', sp: 'human', n: 'TCGA-LIHC 肝细胞癌', src: 'TCGA / GDC', acc: 'TCGA-LIHC',
    meta: '371 肿瘤 + 50 正常（共 421 例）', cnt: 421, size: '38.6 GB',
    kind: 'bulk', fmt: 'STAR counts', ref: 'hg38', icon: 'dna',
    tags: ['肿瘤 vs 正常', '肝病'], note: '与院内队列同为肝病主题，可直接做跨队列验证',
    intro: '与院内队列同为肝病主题，可直接做跨队列验证。', img: '', show: true },
  { id: 'gtex-liver', sp: 'human', n: 'GTEx v8 肝组织', src: 'GTEx Portal', acc: 'GTEx v8',
    meta: '184 例肝组织（全库 17,382 例 / 948 供体）', cnt: 184, size: '12.4 GB',
    kind: 'bulk', fmt: 'TPM', ref: 'hg38', icon: 'chart-simple',
    tags: ['正常对照', '表达基线'], note: '正常肝表达基线，可作肿瘤组的对照来源' },
  { id: 'kgp3', sp: 'human', n: '1000 Genomes Phase 3', src: 'IGSR / EBI', acc: 'Phase 3',
    meta: '2,504 人 · 26 个群体', cnt: 2504, size: '1.2 TB',
    kind: 'vari', fmt: 'VCF / BCF', ref: 'hg19', icon: 'users',
    tags: ['变异', '群体频率'], note: '做变异过滤与人群频率注释时的背景集合' },
  { id: 'tabula-muris', sp: 'mouse', n: 'Tabula Muris 小鼠细胞图谱', src: 'GEO / CZ Biohub', acc: 'GSE109774',
    meta: '100,605 个细胞 · 20 个器官', cnt: 100605, cntLabel: '个细胞', size: '46.2 GB',
    kind: 'sc', fmt: 'h5ad / 10x', ref: 'mm10', icon: 'circle-nodes',
    tags: ['单细胞', '含肝脏'], note: '含 3 月龄 C57BL/6JN 小鼠肝脏细胞，可验证单细胞流程' },
  { id: 'gse137385', sp: 'mouse', n: '小鼠肝脏禁食-进食代谢', src: 'GEO', acc: 'GSE137385',
    meta: '40 例 · 8 组 × 5 只（C57BL/6J / BALB/c）', cnt: 40, size: '9.8 GB',
    kind: 'bulk', fmt: 'FPKM', ref: 'mm10', icon: 'clock-rotate-left',
    tags: ['代谢', '时间序列'], note: '给药前后代谢通路变化的建模底本' },
  { id: 'gse36838', sp: 'mouse', n: '小鼠肝脏饮食干预模型', src: 'GEO', acc: 'GSE36838',
    meta: '18 例 · 6 组 × 3 只（高脂 / 低脂 / 热量限制 / 运动）', cnt: 18, size: '4.6 GB',
    kind: 'bulk', fmt: '表达矩阵', ref: 'mm10', icon: 'utensils',
    tags: ['NAFLD 模型', '分组比较'], note: '代谢性肝病模型，适合分组比较与富集' }
];

/* 三条可编辑字段的兜底：intro 沿用 note（一句话说清「为什么值得用」），
   img 默认不配封面（公开数据集原本就没有配图），show 默认全显示。
   写在这儿而不是逐条补的原因是 —— 少一条就会漏成半截状态。 */
function demoDsFix(d) {
  if (d.intro == null) d.intro = d.note || '';
  if (d.img == null) d.img = '';
  if (d.show == null) d.show = true;
  return d;
}
var DEMO_DS = SAMPLE_DS.concat(PUB_DS).map(demoDsFix);
/* 出厂值快照（「恢复默认」按钮复原到这里 —— 没有它，「默认」就只是个说法） */
var DEMO_DS_DEF = DEMO_DS.map(function (d) { return { intro: d.intro, img: d.img, show: d.show }; });
function pubDsById(id) { return DEMO_DS.filter(function (d) { return d.id === id; })[0]; }
function shownDemo(sp) { return DEMO_DS.filter(function (d) { return d.show && (!sp || d.sp === sp); }); }

var REF_GENOMES = [
  { id: 'hg38', sp: 'human', n: 'GRCh38', alias: 'hg38', build: '2013 年 12 月（patch 14）',
    seq: '3.10 GB', anno: 'GENCODE v44', src: 'UCSC / GENCODE', built: '2026-08-12', jobs: 18,
    idx: [{ t: 'BWA-MEM', s: '4.3 GB' }, { t: 'STAR', s: '26.7 GB' }, { t: 'HISAT2', s: '4.1 GB' }] },
  { id: 'hg19', sp: 'human', n: 'GRCh37', alias: 'hg19', build: '2009 年 2 月（patch 13）',
    seq: '3.10 GB', anno: 'GENCODE v34', src: 'UCSC / GENCODE', built: '2026-05-20', jobs: 4,
    idx: [{ t: 'BWA-MEM', s: '4.1 GB' }, { t: 'HISAT2', s: '3.9 GB' }] },
  { id: 'mm10', sp: 'mouse', n: 'GRCm38', alias: 'mm10', build: '2011 年 12 月',
    seq: '2.72 GB', anno: 'GENCODE M25', src: 'UCSC / GENCODE', built: '2026-08-12', jobs: 3,
    idx: [{ t: 'BWA-MEM', s: '3.6 GB' }, { t: 'STAR', s: '24.5 GB' }, { t: 'HISAT2', s: '3.5 GB' }] }
];

/* 本次分析的选择状态：manual = 用户手动指定过参考基因组，此后不再随数据集自动跟随 */
var SEL = { ds: null, ref: 'hg38', manual: false };

function kindLabel(k) { return KIND[k] || k; }
function fmtNum(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function spLabel(sp) { return SPECIES[sp] || sp; }
function refById(id) { return REF_GENOMES.filter(function (x) { return x.id === id; })[0]; }

/* ---------- 卡片模板（首页与数据汇集页共用同一份内容） ----------
   封面与简介都取自可编辑字段：没有封面就不渲染 <img>（而不是留一个碎图占位），
   简介留空则退回 acc / 来源那一行 —— 空着反倒比放一句「暂无简介」体面。 */
function demoCoverHTML(d) {
  var u = resolveImg(d.img);
  if (!u) return '';
  return '<img class="dcard__im" src="' + esc(u) + '" alt="' + esc(d.n) + ' 封面">';
}
function ownCardHTML(d) {
  return '<button class="dcard" data-pick="' + esc(d.pick) + '">'
    + demoCoverHTML(d)
    + '<div class="dcard__b">'
    + '<div class="dcard__n">' + esc(d.n) + '</div>'
    + '<div class="dcard__m">' + esc(d.meta) + '</div>'
    + '<div class="row mt-2">' + d.tags.map(function (x) { return '<span class="tag">' + esc(x) + '</span>'; }).join('') + '</div>'
    + (d.intro ? '<div class="dcard__h">' + esc(d.intro) + '</div>' : '')
    + '</div></button>';
}
function pubCardHTML(d) {
  return '<button class="dcard dcard--flat" data-pubds="' + d.id + '">'
    /* 封面与院内队列共用同一份可编辑字段。v40 之前这里没接 —— 于是设置页
       给公开数据集配的封面只在设置页预览里看得见，前台卡片上永远不出现：
       一个「能设但没用」的设置项比没有这个设置项更糟。 */
    + demoCoverHTML(d)
    + '<div class="dcard__b">'
    + '<div class="row"><span class="sp sp--' + d.sp + '">' + spLabel(d.sp) + '</span>'
    + '<span class="tag">' + kindLabel(d.kind) + '</span>'
    + '<span class="tag tag--brand">' + d.ref + '</span></div>'
    + '<div class="dcard__n mt-2">' + d.n + '</div>'
    + '<div class="dcard__m">' + d.meta + '</div>'
    + '<div class="dcard__m">' + d.acc + ' · ' + d.size + '</div>'
    + '<div class="row mt-2">' + d.tags.map(function (x) { return '<span class="tag">' + x + '</span>'; }).join('') + '</div>'
    + (d.intro ? '<div class="dcard__h">' + esc(d.intro) + '</div>' : '')
    + '</div></button>';
}

function refCardHTML(g) {
  var on = g.id === SEL.ref;
  return '<button class="refcard' + (on ? ' is-on' : '') + '" data-refg="' + g.id + '" aria-pressed="' + (on ? 'true' : 'false') + '">'
    + '<div class="refcard__h"><span class="sp sp--' + g.sp + '">' + spLabel(g.sp) + '</span>'
    + '<span class="refcard__n">' + g.n + '</span>'
    + '<span class="refcard__a num">' + g.alias + '</span>'
    + (on ? '<span class="refcard__on">' + ico('circle-check') + '已选用</span>' : '')
    + '</div>'
    + '<div class="refcard__rows">'
    + '<div class="refcard__r"><span>参考序列</span><span class="num">' + g.seq + '</span></div>'
    + '<div class="refcard__r"><span>基因注释</span><span>' + g.anno + '</span></div>'
    + '<div class="refcard__r"><span>装配版本</span><span>' + g.build + '</span></div>'
    + '<div class="refcard__r"><span>来源</span><span>' + g.src + '</span></div>'
    + '</div>'
    + '<div class="refcard__idx">'
    + g.idx.map(function (x) { return '<span class="refcard__ix"><span>' + x.t + '</span><b class="num">' + x.s + '</b></span>'; }).join('')
    + '</div>'
    + '<div class="refcard__f"><span class="tag tag--ok">' + ico('circle-check') + '索引就绪</span>'
    + '<span class="refcard__jobs">构建于 ' + g.built + ' · 在用 ' + g.jobs + ' 个任务</span></div>'
    + '</button>';
}

/* ---------- 渲染 ----------
   过滤掉 show=false 的条目，是「设置」这一页存在的前提：开关只在系统管理里，
   展示侧不认它的话，那一屏开关就只是一排装饰灯。 */
function renderPubGroups() {
  ['own', 'human', 'mouse'].forEach(function (sp) {
    var html = DEMO_DS.filter(function (d) { return d.sp === sp && d.show; })
      .map(function (d) { return sp === 'own' ? ownCardHTML(d) : pubCardHTML(d); }).join('');
    var a = $('#dsGroup-' + sp); if (a) a.innerHTML = html;
    var b = $('#pubGrid-' + sp); if (b) b.innerHTML = html;
  });
  var hidden = DEMO_DS.length - DEMO_DS.filter(function (d) { return d.show; }).length;
  var cnt = $('#pubCount');
  if (cnt) {
    cnt.textContent = DEMO_DS.length + ' 个内置数据集（院内队列 '
      + DEMO_DS.filter(function (d) { return d.sp === 'own'; }).length + ' · 人类 '
      + DEMO_DS.filter(function (d) { return d.sp === 'human'; }).length + ' · 小鼠 '
      + DEMO_DS.filter(function (d) { return d.sp === 'mouse'; }).length + '）'
      + (hidden ? ' · 已隐藏 ' + hidden + ' 个' : '');
  }
}

/* ============================================================
   系统管理 › 示例数据集（v40 需求 2）
   三条可编辑项：是否显示 / 简介 / 封面。
   展示侧与设置侧读的是同一个 DEMO_DS 对象数组 —— 不是「设置里改一份、
   渲染时抄另一份」。抄一份就会在某一版里改走偏，且没有任何断言看得见。
   ============================================================ */
function demoCoverPreview(d) {
  var u = resolveImg(d.img);
  return u
    ? '<img class="pubdsr__im" src="' + esc(u) + '" alt="' + esc(d.n) + ' 封面">'
    : '<div class="pubdsr__no">' + ico('image') + '<span>无封面</span></div>';
}

function renderDemoSet() {
  var box = $('#pubdsList'); if (!box) return;
  /* v54：本页是**平台级配置**，只有超级管理员能改；其他身份进来看得到现状、
     改不动（控件真 disabled + title 说明原因）。不是把整页藏起来 ——
     藏起来人就不知道有这件事、也不知道该找谁开通。 */
  var canSet = canConfig();
  var dis = canSet ? '' : ' disabled';
  var why = canSet ? '' : ' title="当前身份（' + roleName() + '）不能修改示例数据集配置：需「超级管理员」"';
  box.innerHTML = DEMO_DS.map(function (d) {
    var opts = '<option value=""' + (d.img ? '' : ' selected') + '>不使用封面</option>'
      + DEMO_IMGS.map(function (im) {
          return '<option value="' + esc(im.v) + '"'
            + (d.img === im.v ? ' selected' : '') + '>' + esc(im.n) + '</option>';
        }).join('');
    return '<div class="card pubdsr' + (canSet ? '' : ' is-ro') + '" data-pdsrow="' + esc(d.id) + '">'
      + '<div class="card__bd row align-start gap-4">'
      +   '<div class="pubdsr__pv">' + demoCoverPreview(d) + '</div>'
      +   '<div class="pubdsr__bd">'
      +     '<div class="pubdsr__hd">'
      +       '<span class="pubdsr__n">' + esc(d.n) + '</span>'
      +       '<span class="tag">' + (d.sp === 'own' ? '院内队列' : spLabel(d.sp)) + '</span>'
      +       '<span class="text-[11.5px] text-ink3 num">' + esc(d.meta) + '</span>'
      +       '<label class="sw ml-auto"' + why + '><input type="checkbox" data-pds-toggle="' + esc(d.id) + '"'
      +         (d.show ? ' checked' : '') + dis + '><span class="sw__t"></span><span class="sw__l">'
      +         (d.show ? '显示中' : '已隐藏') + '</span></label>'
      +     '</div>'
      +     '<div class="fld mt-3"><label class="fld__l" for="intro-' + esc(d.id) + '">简介（显示在卡片底部）</label>'
      +       '<textarea class="inp inp--ta" id="intro-' + esc(d.id) + '" rows="2"'
      +       ' data-pds-intro="' + esc(d.id) + '" placeholder="一句话说明这个数据集能用来做什么"' + dis + why + '>'
      +       esc(d.intro) + '</textarea></div>'
      +     '<div class="fld"><label class="fld__l" for="img-' + esc(d.id) + '">封面</label>'
      +       '<div class="row">'
      +         '<select class="sel" id="img-' + esc(d.id) + '" data-pds-img="' + esc(d.id) + '"' + dis + why + '>' + opts + '</select>'
      +         '<button type="button" class="btn btn--sm" data-pds-up="' + esc(d.id) + '"' + dis + why + '>'
      +           ico('upload') + '上传本地图片</button>'
      +         '<button type="button" class="btn btn--sm btn--quiet" data-pds-clr="' + esc(d.id) + '"'
      +           (d.img ? '' : ' aria-disabled="true"') + dis + why + '>' + ico('xmark') + '清除封面</button>'
      +       '</div>'
      +       '<input type="file" class="sr" accept="image/*" data-pds-file="' + esc(d.id) + '"' + dis + '>'
      +     '</div>'
      +   '</div>'
      + '</div></div>';
  }).join('');

  var shown = DEMO_DS.filter(function (d) { return d.show; }).length;
  var c = $('#pubdsCount'), h = $('#pubdsHidden'), cur = $('#pubdsCur');
  if (c) c.textContent = '显示 ' + shown + ' / ' + DEMO_DS.length + ' 条';
  if (cur) cur.textContent = '院内队列 ' + DEMO_DS.filter(function (d) { return d.sp === 'own'; }).length
    + ' · 人类公开 ' + DEMO_DS.filter(function (d) { return d.sp === 'human'; }).length
    + ' · 小鼠公开 ' + DEMO_DS.filter(function (d) { return d.sp === 'mouse'; }).length;
  if (h) {
    var hid = DEMO_DS.length - shown;
    h.className = 'tag' + (hid ? ' tag--warn' : '');
    h.textContent = hid ? hid + ' 条已隐藏' : '全部显示中';
  }
  /* v54：页头徽标 + 只读提示条 + 工具条三颗按钮，都跟着当前身份刷新。
     工具条那三颗在 HTML 里是静态的，重画列表管不到它们 —— 漏了就会出现
     「卡片全灰、顶上按钮还能点」这种半截权限态。 */
  var pw = $('#pubdsWho');
  if (pw) {
    pw.className = 'tag' + (canSet ? ' tag--ok' : '');
    pw.textContent = '当前身份：' + roleName();
  }
  var ph = $('#pubdsPerm'), pr = $('#pubdsPermRole');
  if (ph) ph.hidden = canSet;
  if (pr) pr.textContent = roleName();
  $$('[data-pds-all], [data-pds-reset]').forEach(function (b) {
    b.disabled = !canSet;
    b.title = canSet ? '' : '当前身份（' + roleName() + '）不能修改示例数据集配置：需「超级管理员」';
  });
  /* 前台同步：开关 / 简介 / 封面改了，工作台与数据汇集页必须立刻看得见 */
  renderPubGroups();
  var sum = $('#demoDsSum');
  if (sum) sum.textContent = DEMO_DS.length + ' 条 · 显示 ' + shown + ' 条';
}

/* 改动落到数据上，再由页面自己重画 —— 不手动改 DOM。
   手动改 DOM 的做法（把 <img src> 直接赋新值）一旦哪天多一处渲染就漏了。 */
function demoSet(id, patch, msg) {
  var d = pubDsById(id);
  if (!d) return;
  Object.keys(patch).forEach(function (k) { d[k] = patch[k]; });
  renderDemoSet();
  if (msg) toast(msg, 'ok');
}

/* ============================================================
   系统管理 › 项目组管理（v47 需求 3）
   ============================================================
   数据与权限判断全在 app.js 顶部的 PROJ_GROUPS / CUR_USER 那一段，
   这里只管画与改。三条与别处不同的做法，各有理由：

   ① 勾选态（PG_SEL）挂模块级变量而**不是**塞进 PROJ_GROUPS 的条目里 ——
      「被勾上」是这一刻的界面状态，不是项目组的属性；混进数据里，
      下次从别处进这一页会看到上次遗留的勾选。
   ② 启停开关直接改数据再整表重画（不是手改 DOM）—— 开关旁边的文字、
      页头的「启用 N」、以及「可选名单」三处都要跟着变，手改 DOM 必然漏两处。
   ③ 权限不足时**不把按钮藏掉、只把结果挡掉**是不行的（点了没反应像坏了）；
      也不留一颗点不动的按钮。做法是：换成一行「只读」说明 + 控件 disabled，
      并在页头显式写出当前身份，让「为什么不能点」一眼可见。 */
var PG_SEL = {};      /* 勾选的行 id */
var PG_Q = '';        /* 搜索词 */
var PG_SORT = 0;      /* 0 = 原序（新在前）；1 = 创建时间升序；-1 = 降序 */
var PG_EDIT = null;   /* 编辑弹窗的草稿 */

function pgRows() {
  var q = (PG_Q || '').trim().toLowerCase();
  var list = PROJ_GROUPS.filter(function (g) {
    return !q || g.n.toLowerCase().indexOf(q) >= 0
      || g.members.join(' ').toLowerCase().indexOf(q) >= 0;
  });
  if (PG_SORT) {
    list = list.slice().sort(function (a, b) {
      if (a.created === b.created) return 0;
      return (a.created < b.created ? -1 : 1) * PG_SORT;
    });
  }
  return list;
}
/* 已勾选的行（按**当前可见列表**过滤）：搜索把它筛没了，它就不该再算进
   「已选 N」—— 否则会出现「屏幕上一行没勾，却显示已选 2 行」的怪状。 */
function pgSelRows() {
  return pgRows().filter(function (g) { return PG_SEL[g.id]; });
}

/* 成员列：参考截图是「头像 + 名字」上下堆叠两行、多的折成省略号。
   用绝对定位逐行落位（top 由序号算），高度也由条数定 ——
   flex 换行做不到「第二行只露一半」那种被压住的观感，而截图里正是那样。 */
function pgMembersHTML(g) {
  var head = g.members.slice(0, 2), rest = g.members.length - head.length;
  var h = Math.min(g.members.length, 2) * 26 + (rest > 0 ? 12 : 0);
  return '<div class="pgmem" style="height:' + Math.max(h, 26) + 'px">'
    + head.map(function (m, i) {
        return '<span class="pgmem__r" style="top:' + (i * 26) + 'px">'
          + '<span class="pgmem__av" aria-hidden="true">' + esc(m.slice(0, 1)) + '</span>'
          + '<span class="pgmem__n">' + esc(m) + '</span></span>';
      }).join('')
    + (rest > 0 ? '<span class="pgmem__more" style="top:' + (head.length * 26) + 'px">…</span>' : '')
    + '</div>';
}

function renderProjGroups() {
  var box = $('#pgBody');
  if (!box) return;
  var can = pgCanWrite();
  var rows = pgRows();
  box.innerHTML = rows.map(function (g) {
    var st = PG_ST[g.st] || { t: g.st, cls: '', ic: 'circle-info' };
    var on = !!PG_SEL[g.id];
    return '<tr' + (on ? ' class="is-on"' : '') + ' data-pgrow="' + esc(g.id) + '">'
      + '<td class="wid"><input type="checkbox" data-pg-check="' + esc(g.id) + '"'
      + (on ? ' checked' : '') + (can ? '' : ' disabled')
      + ' aria-label="选择项目组 ' + esc(g.n) + '"></td>'
      + '<td>' + esc(g.n) + '</td>'
      + '<td>' + pgMembersHTML(g) + '</td>'
      + '<td class="num">' + g.members.length + '</td>'
      + '<td><label class="sw"><input type="checkbox" data-pg-on="' + esc(g.id) + '"'
      + (g.on ? ' checked' : '') + (can ? '' : ' disabled') + '>'
      + '<span class="sw__t"></span><span class="sw__l">' + (g.on ? '启用' : '禁用') + '</span></label></td>'
      + '<td class="num">' + esc(g.created) + '</td>'
      + '<td><span class="tag ' + st.cls + '">' + ico(st.ic) + esc(st.t) + '</span></td>'
      + '<td>' + esc(g.own) + '</td>'
      + '<td class="wid">'
      + (can
          ? '<span class="ops">'
            + '<button type="button" class="pgop" data-pg-edit="' + esc(g.id) + '">'
            + ico('pen-to-square') + '编辑</button>'
            + (pgDeletable(g)
              ? '<button type="button" class="pgop pgop--del" data-pg-rowdel="' + esc(g.id) + '">'
                + ico('trash-can') + '删除</button>'
              : '')
            + '</span>'
          : '<span class="text-[11.5px] text-ink3">只读</span>')
      + '</td></tr>';
  }).join('')
    || '<tr><td colspan="9" class="pgempty">' + ico('inbox') + '没有匹配「' + esc(PG_Q) + '」的项目组</td></tr>';

  /* 排序按钮由这里重画：图标是内联 SVG，**换 class 是换不动路径的**（那些
     fa-sort-up / fa-sort-down 是字体类名，产物里只剩 <svg>）——
     想改图标只能重画节点。这也顺带让「箭头方向 = PG_SORT」只有一个出口。 */
  var sb = $('#pgSortBtn');
  if (sb) {
    var sIc = PG_SORT === 1 ? 'sort-up' : (PG_SORT === -1 ? 'sort-down' : 'sort');
    sb.innerHTML = '<button type="button" class="pgop" data-pg-sort="1" aria-label="按创建时间排序'
      + (PG_SORT === 1 ? '（当前升序）' : PG_SORT === -1 ? '（当前降序）' : '') + '">'
      + ico(sIc) + '</button>';
  }

  /* ---- 页头与实际勾选态同步（四处一起，不手改其中一处） ---- */
  var sel = pgSelRows();
  var canDel = can && sel.length > 0 && sel.every(pgDeletable);
  var c = $('#pgCount'), o = $('#pgOn'), s = $('#pgSel'), d = $('#pgDel'), a = $('#pgAll');
  if (c) c.textContent = '共 ' + PROJ_GROUPS.length + ' 个项目组';
  if (o) {
    var onN = PROJ_GROUPS.filter(function (g) { return g.on; }).length;
    o.textContent = '启用 ' + onN + ' · 禁用 ' + (PROJ_GROUPS.length - onN)
      + ' · 可选 ' + pgPickNames().length + '（新建项目下拉的条数）';
  }
  if (s) {
    s.className = 'tag' + (sel.length ? ' tag--brand' : '');
    s.textContent = sel.length ? '已选 ' + sel.length + ' 行' : '未选择';
  }
  if (d) {
    /* 按钮不藏：藏起来用户不知道「有没有这个能力」；用 aria-disabled + 灰态，
       点它时由动作分发给出原因（而不是毫无反应）。 */
    d.setAttribute('aria-disabled', canDel ? 'false' : 'true');
    d.title = canDel ? '删除选中的项目组'
      : (can ? '只有「已驳回」的项目组可以删除' : '当前身份（' + pgRoleTxt() + '）没有删除权限');
  }
  if (a) {
    a.checked = rows.length > 0 && rows.every(function (g) { return !!PG_SEL[g.id]; });
    a.disabled = !can || !rows.length;
  }
  /* 「创建项目组」在只读身份下不是藏起来、也不是只灰个色 —— 真 disabled。
     藏起来用户不知道有没有这个能力（与下面那颗「删除」同一条理由），
     但只灰个色等于还能点进去再被弹回来，白跑一趟。
     委托分支里那道 pgCanWrite() 仍然保留：键盘、脚本、别处冒出来的入口
     都会绕过视觉态，只有分支里挡一次是可信的。 */
  var nb = $('#page-projgroup [data-pg-new]');
  if (nb) {
    nb.disabled = !can;
    nb.title = can ? '创建项目组'
      : '当前身份（' + pgRoleTxt() + '）没有创建项目组的权限';
  }
  var f = $('#pgFoot');
  if (f) {
    f.textContent = can
      ? '当前身份：' + pgRoleTxt() + ' · 可创建 / 编辑 / 启停'
        + (canDel ? ' / 删除选中的已驳回项目组' : '')
      : '当前身份：' + pgRoleTxt() + ' · 项目组的创建、编辑、启停与删除仅对「超级管理员」与「普通管理员」开放';
  }
  /* 页头徽标（v54）：这里原来是个三档身份开关，撤掉后只回答「我现在是谁」——
     能做什么写在页脚那一行。身份的唯一入口在顶栏当前用户菜单。 */
  var who = $('#pgWho');
  if (who) {
    who.className = 'tag' + (can ? ' tag--ok' : '');
    who.textContent = '当前身份：' + pgRoleTxt();
  }
}

/* 新建 / 编辑共用一个弹窗：字段与校验完全一样，两套必然走偏。
   PG_EDIT 为 null 表示不在编辑态 —— 关窗必须置回 null，否则下次点「创建」
   会带着上次的草稿（这个坑在向导那边用 PNEW = null 处理过一次）。 */
function pgEditOpen(id) {
  if (!pgCanWrite()) { toast('当前身份（' + pgRoleTxt() + '）没有编辑项目组的权限', 'warn'); return; }
  var g = id ? pgById(id) : null;
  PG_EDIT = {
    id: g ? g.id : '',
    n: g ? g.n : '',
    members: g ? g.members.slice() : [],
    on: g ? !!g.on : true,
    draft: ''
  };
  showModal(g ? '编辑项目组' : '新建项目组',
    '<div class="stack">'
    + '<div class="fld"><label class="fld__l" for="pgName">项目组名称：' + reqMark() + '</label>'
    + '<input class="inp" id="pgName" autocomplete="off" aria-required="true"'
    + ' placeholder="请输入项目组名称" value="' + esc(PG_EDIT.n) + '"></div>'
    + '<div class="fld" role="group" aria-required="true"><div class="fld__l">'
    + '<span>项目组成员：' + reqMark() + '</span><span class="fld__h ml-auto">至少 1 人</span></div>'
    + '<div class="row"><input class="inp" id="pgMem" autocomplete="off"'
    + ' placeholder="输入成员姓名后点「添加」"><button type="button" class="btn" data-pg-memadd>'
    + ico('user-plus') + '添加</button></div>'
    + '<div class="pgmemsel" id="pgMemList"></div></div>'
    + '<label class="chk"><input type="checkbox" id="pgOnChk"' + (PG_EDIT.on ? ' checked' : '')
    + '>创建后即启用（禁用不影响历史项目，只影响它出现在选择项里）</label>'
    + frmLegend()
    + '</div>',
    '<button type="button" class="btn" data-pg-cancel>取消</button>'
    + '<button type="button" class="btn btn--primary" data-pg-save>'
    + (g ? '保存' : '创建') + '</button>');
  renderPgMemList();
}
function renderPgMemList() {
  var box = $('#pgMemList'); if (!box || !PG_EDIT) return;
  box.innerHTML = PG_EDIT.members.length
    ? PG_EDIT.members.map(function (m) {
        return '<span class="pgchip">' + esc(m)
          + '<button type="button" class="pgchip__x" data-pg-memdel="' + esc(m) + '"'
          + ' aria-label="移除成员 ' + esc(m) + '">' + ico('xmark') + '</button></span>';
      }).join('')
    : '<span class="fld__h">还没有成员，用上面的输入框添加</span>';
}
function pgSave() {
  if (!PG_EDIT) return;
  var n = ($('#pgName') ? $('#pgName').value : '').trim();
  PG_EDIT.on = !!($('#pgOnChk') && $('#pgOnChk').checked);
  if (!n) { toast('请先补全：项目组名称', 'warn'); return; }
  if (!PG_EDIT.members.length) { toast('请先补全：项目组成员（至少 1 人）', 'warn'); return; }
  /* 重名守卫：同名两个组会让「所属项目组」下拉里出现两条一模一样的选项，
     之后就再也说不清哪个项目属于哪个（改名的编辑路径同样要守）。 */
  var dup = PROJ_GROUPS.filter(function (g) {
    return g.n === n && g.id !== PG_EDIT.id;
  });
  if (dup.length) { toast('已存在同名项目组「' + n + '」，请换一个名称', 'warn'); return; }
  if (PG_EDIT.id) {
    var g = pgById(PG_EDIT.id);
    if (g) { g.n = n; g.members = PG_EDIT.members.slice(); g.on = PG_EDIT.on; }
    toast('已保存项目组「' + n + '」', 'ok');
  } else {
    PROJ_GROUPS.unshift({
      id: pgNextId(), n: n, members: PG_EDIT.members.slice(), on: PG_EDIT.on,
      /* 新建的组一律「待审核」：自己说自己通过等于没有审核这一环。
         本页不能改状态，它要去审核那一侧过一道。 */
      st: 'pending', created: nowStr(), own: CUR_USER.n
    });
    toast('已创建项目组「' + n + '」，状态为「待审核」', 'ok');
  }
  PG_EDIT = null;
  $('#modal').hidden = true;
  renderProjGroups();
  renderNav();          /* 左栏徽章与「新建项目」下拉都跟着这张表走 */
}

function pgMemAdd() {
  if (!PG_EDIT) return;
  var el = $('#pgMem');
  var nm = (el ? el.value : '').trim();
  if (!nm) { toast('请先输入成员姓名', 'warn'); return; }
  if (PG_EDIT.members.indexOf(nm) >= 0) { toast('「' + nm + '」已经在成员列表里了', 'warn'); return; }
  PG_EDIT.members.push(nm);
  if (el) el.value = '';
  renderPgMemList();
}

/* 删除确认：与文件管理同一套做法（先模态确认、再真删）。
   一次可以删多行，所以文案要能说清「删哪几个」——只写「确定删除吗」
   会让人不确定刚才勾的到底是不是那几个。 */
var PG_DEL_IDS = [];
function openPgDel(ids) {
  if (!pgCanWrite()) { toast('当前身份（' + pgRoleTxt() + '）没有删除权限', 'warn'); return; }
  var list = ids.map(pgById).filter(Boolean);
  if (!list.length) return;
  PG_DEL_IDS = ids.slice();
  showModal('删除确认',
    '<p>确定删除以下 <b>' + list.length + '</b> 个项目组吗？</p>'
    + '<ul class="pgdelist">' + list.map(function (g) {
        return '<li><b>' + esc(g.n) + '</b><span class="text-ink3">（'
          + esc(PG_ST[g.st] ? PG_ST[g.st].t : g.st) + ' · ' + g.members.length + ' 名成员）</span></li>';
      }).join('') + '</ul>'
    + '<p class="fld__h mb-0">只有「已驳回」的项目组允许删除。删除只影响这个名单，'
    + '已建项目与已上传文件上的项目组标签是建档时记下的，不受影响。</p>',
    '<button type="button" class="btn" data-close="modal">取消</button>'
    + '<button type="button" class="btn btn--danger" data-pg-del-ok>' + ico('trash-can') + '删除</button>');
}
function pgDelCommit() {
  var ids = PG_DEL_IDS.slice();
  PG_DEL_IDS = [];
  $('#modal').hidden = true;
  var gone = [];
  ids.forEach(function (id) {
    var g = pgById(id);
    if (!g || !pgDeletable(g)) return;      /* 兜底：非驳回态一律不删 */
    gone.push(g.n);
    PROJ_GROUPS.splice(PROJ_GROUPS.indexOf(g), 1);
    delete PG_SEL[id];
  });
  renderProjGroups();
  renderNav();
  toast(gone.length ? '已删除项目组：' + gone.join('、') : '没有可删除的项目组', gone.length ? 'ok' : 'warn');
}

function renderRefGrid() {
  var host = $('#refGrid');
  if (!host) return;
  host.innerHTML = REF_GENOMES.map(refCardHTML).join('');
  var tag = $('#refAllTag');
  if (tag) tag.textContent = REF_GENOMES.length + ' / ' + REF_GENOMES.length + ' 索引就绪';
  updateRefSum();
}

/* 配置摘要 + 物种不匹配守卫（Nielsen 防错：提示原因并给出可执行动作） */
function updateRefSum() {
  var g = refById(SEL.ref), sum = $('#refSum');
  if (!g || !sum) return;
  var d = SEL.ds, mis = !!(d && d.sp !== g.sp), none = !d;
  sum.className = 'refsum' + (mis ? ' is-bad' : '');
  sum.innerHTML = '<div class="refsum__t">' + ico(none ? 'circle-info' : (mis ? 'triangle-exclamation' : 'circle-check'))
    + '<b>' + (none ? '请先选择数据' : (mis ? '数据与参考基因组物种不一致' : '本次分析配置已就绪')) + '</b>'
    + '<span class="refsum__tag">' + (none ? '待选择' : (mis ? '需处理' : '可提交')) + '</span></div>'
    + '<div class="refsum__b">数据 '
    + (d ? '「' + d.n + '」· ' + spLabel(d.sp) + ' · ' + d.acc + ' · ' + fmtNum(d.cnt) + ' ' + (d.cntLabel || '例样本')
       : '尚未选择（可选用上方内置数据集，或上传自有文件）')
    + ' &nbsp;→&nbsp; 参考基因组 <b class="num">' + g.n + ' (' + g.alias + ')</b> · ' + g.anno + '</div>'
    + '<div class="refsum__f">'
    + (none ? '选定数据后会自动匹配对应物种的参考基因组，也可以直接点上方卡片自行指定。'
            : '索引 ' + g.idx.map(function (x) { return x.t; }).join(' / ')
              + (mis ? ' 已就绪，但物种不匹配 —— 需按下方提示处理后才能提交。' : ' 已就绪，可直接提交任务。'))
    + '</div>';

  var w = $('#refWarn');
  if (w) {
    w.hidden = !mis;
    if (mis) {
      var body = $('#refWarnBody');
      if (body) {
        body.innerHTML = '所选数据集「' + d.n + '」来自' + spLabel(d.sp) + '（'
          + (d.sp === 'human' ? 'Homo sapiens' : 'Mus musculus') + '），而当前参考基因组 <b class="num">'
          + g.alias + '</b> 属于' + spLabel(g.sp) + '。用' + spLabel(g.sp) + '基因组比对'
          + spLabel(d.sp) + '读长，绝大多数读长无法定位，结果不可用。';
      }
      var fix = $('#refWarnFix');
      if (fix) {
        fix.setAttribute('data-refg', d.ref);
        fix.textContent = '改用 ' + d.ref + '（按数据集物种推荐）';
      }
    }
  }
}

/* ---------- 交互 ---------- */
function loadPubDs(id, jump) {
  var d = pubDsById(id);
  if (!d) return;
  var prevRef = SEL.ref;
  SEL.ds = d;
  if (!SEL.manual) SEL.ref = d.ref;   /* 用户未手动指定过 → 随数据集物种自动跟随 */
  renderRefGrid();

  var host = $('#fileCard');
  if (host) {
    host.hidden = false;
    $('#fileList').innerHTML = fileCardHTML({
      name: d.n + '（内置公开数据集）',
      detected_format: d.fmt + ' · ' + kindLabel(d.kind),
      size: d.size, count: fmtNum(d.cnt) + ' ' + (d.cntLabel || '例样本'),
      src: d.src, acc: d.acc, icon: d.icon || 'file-csv'
    });
    var ft = $('#fileTag');
    if (ft) { ft.className = 'tag tag--ok'; ft.textContent = '校验通过'; }
  }
  var msg = '已载入公开数据集：' + d.n + '（' + fmtNum(d.cnt) + ' ' + (d.cntLabel || '例样本') + '，' + spLabel(d.sp) + '）';
  if (!SEL.manual && prevRef !== SEL.ref) msg += ' · 参考基因组已自动切换为 ' + SEL.ref;
  toast(msg, 'ok');
  if (jump) goto('p02');
}

function pickRef(id, manual) {
  var g = refById(id);
  if (!g) return;
  SEL.ref = id;
  if (manual) SEL.manual = true;
  renderRefGrid();
  if (manual && SEL.ds && SEL.ds.sp !== g.sp) {
    toast('已切换为 ' + g.alias + '，但与所选数据集的物种不一致，请见下方提示', 'warn');
  } else if (manual) {
    toast('已选用参考基因组：' + g.n + ' (' + g.alias + ')', 'ok');
  }
}

/* ============================================================
   模拟接口层（对应 PRD 第 6 章的 7 个端点）
   ============================================================ */
var MOCK = {
  upload: function (kind) {
    if (kind === 'vcf') return { file_id: 'f_vcf_01', name: 'TJ-TCM-2026_WGS.vcf.gz', detected_format: 'VCF 4.3', data_type: '基因组变异', sample_count: 75, size: '2.1 GB', quality: { missing_rate: 8.4, outlier_count: 312 } };
    /* 这一份的价值在质控：缺失率 27.3% 超过阈值，用来走通「缺失过多 → 修复」这条链 */
    if (kind === 'miss') return { file_id: 'f_miss_01', name: 'TJ-TCM-2026_RNA_counts_raw.tsv', detected_format: 'TSV（表达矩阵）', data_type: '转录组表达', sample_count: 75, size: '241 MB', quality: { missing_rate: 27.3, outlier_count: 518 } };
    return { file_id: 'f_expr_01', name: 'TJ-TCM-2026_RNA_counts.tsv', detected_format: 'TSV（表达矩阵）', data_type: '转录组表达', sample_count: 75, size: '186 MB', quality: { missing_rate: 6.1, outlier_count: 204 } };
  },
  pipelines: function () {
    return [
      { id: 'variant', name: '基因变异分析', est_duration: '4:12' },
      { id: 'de', name: '差异表达分析', est_duration: '3:05' },
      { id: 'enrich', name: '功能富集分析', est_duration: '1:40' }
    ];
  },
  /* 模拟向量检索 + 重排：返回命中的条目 ID 与本次检索的召回口径 */
  suggest: function (q) {
    var key = (q || '').trim();
    var s = KB_QUERY_SUGGEST.filter(function (x) { return key && x.q.indexOf(key) > -1; })[0];
    if (s) return { ids: s.hit, mode: s.mode };
    /* 注意：这里不能用 /g 正则 + test()，lastIndex 会在 filter 迭代间残留，结果不稳定 */
    var HIT = /CYP3A4|基因|表达/, BILE = /胆汁酸|胆酸|代谢/, SORA = /索拉非尼|药|耐药/, SAMP = /样本|队列|随访|SOP/, LIT = /文献|综述|指南/;
    var ids = KB_STORE.filter(function (it) {
      var blob = it.t + it.s + it.tags.join('');
      return (HIT.test(key) && (/CYP3A4/.test(blob) || /表达/.test(blob)))
          || (BILE.test(key) && /胆酸|胆汁酸/.test(blob))
          || (SORA.test(key) && /索拉非尼/.test(blob))
          || (SAMP.test(key) && /样本|队列/.test(blob))
          || (LIT.test(key) && (it.cat === 'lit' || it.cat === 'clinical'));
    }).map(function (it) { return it.id; });
    return { ids: ids, mode: ids.length ? '按相关度排序' : '无匹配' };
  }
};

/* ============================================================
   引导式异常修复（G-03 / F-14）
   ============================================================ */
/* ============================================================
   判定阈值（全站唯一来源）
   ------------------------------------------------------------
   这三个值是业务口径，尚未与院方确认正式值。任何一处展示或判定都必须
   引用这里，不另写字面量 —— 口径确认后只改这三个数，全站同步生效。
   v47：原先顶栏长期挂着一颗「阈值待确认」徽标，已撤。那句话属于**参数配置页**
   的说法（p05 的「阈值依据」卡上写着同一件事），挂在全局顶栏上等于把一个
   局部待办说成全站常态，而且用户走到哪它跟到哪。待确认这件事改由本注释与
   《原型设计说明》第 2 节承载 —— 值本身一个没动。
   ============================================================ */
var THRESHOLDS = {
  missing: 20,   /* 缺失率告警阈值（%）：超过即提示修复 */
  nsample: 30,   /* 最小样本量：低于即在统计功效上给低置信提示 */
  qpos:    5     /* 队列告警位次：排到该位次以后即提示等待 */
};

/* ============================================================
   分析上下文：所有告警的唯一来源
   ------------------------------------------------------------
   界面上没有「演示某个异常」的按钮。看到什么提示，取决于
   载入的是哪份数据、纳入了多少样本、任务排在第几位——
   和真实系统一样，告警是操作的结果，不是一个开关。
   ============================================================ */
var CTX = {
  miss:    8.4,  /* 当前数据的整体缺失率（%） */
  n:       75,   /* 纳入分析的样本数 */
  queued:  0,    /* 排队位次；0 = 未排队 */
  load:    96    /* 集群资源占用（%） */
};

var QUEUE_JOBS = 3;   /* 队列中已有的任务数：为 0 时提交即直接运行 */

/* 异常面板三选一：缺失去阈值优先于样本量，两者都正常就不显示 */
/* 异常面板只剩两处触发点：格式不支持（数据汇集页，上传时判定）与算力排队
   （任务运行页，队列非空）。v37 删掉样本对齐页后，缺失率与样本量两条告警
   随该页一起退场 —— 留着一个没有宿主的告警状态只会变成死代码。 */
function syncAnoms() {
  /* v63：任务运行页不再展示「算力队列」与「系统检测到的问题」——
     排队态只保留一句「请等待」。数据汇集页的格式告警仍由 showAnom 直接触发。 */
}

function hideAnom(sel) {
  var h = $(sel);
  if (!h) return;
  h.hidden = true;
  var bd = h.querySelector('.card__bd');
  if (bd) bd.innerHTML = '';
}

var ANOMS = {
  format: {
    lv: 'danger', tag: '阻断', icon: 'triangle-exclamation',
    title: '检测到不支持的格式：.xlsx',
    body: '你上传的 <span class="num">sample_pheno.xlsx</span> 是 Excel 工作簿。系统需要的是纯文本表格，直接解析会丢失单元格结构。',
    detail: '<div class="fmtgrid mt-3">'
      + '<div class="fmt fmt--bad"><span class="fmt__c">.xlsx</span>检测到的格式</div>'
      + '<div class="fmt"><span class="fmt__c">.csv</span>系统支持</div>'
      + '<div class="fmt"><span class="fmt__c">.tsv</span>系统支持</div>'
      + '</div>',
    acts: [
      { t: '把 .xlsx 自动转成 .csv', k: 'primary', msg: '已转换 sample_pheno.xlsx → sample_pheno.csv（保留第一个工作表，共 75 行 × 8 列）' },
      { t: '下载格式模板', dl: 'template' },
      { t: '重新上传', go: 'p02' }
    ]
  },
  queue: {
    lv: 'warn', tag: '警告', icon: 'hourglass-half',
    title: '当前队列位置 3，预计等待 26 分钟',
    body: '前方还有 <span class="num">2</span> 个任务，当前集群资源占用 <span class="num">96%</span>。你的任务预计 <span class="num">16:58</span> 开始执行。等待期间可以离开本页，任务不会中断。',
    acts: [
      { t: '提升优先级', disabled: true, note: '需要「算力调度」权限。当前账号为普通用户，请联系信息科（分机 8623）开通。' },
      { t: '降级快速模式', run: true, k: 'primary', msg: '已切换快速模式：抽样 30% reads，预计耗时降至 1:40，定量精度会有下降' },
      { t: '完成后通知我', msg: '已开启完成通知，任务结束时将通过站内消息提醒' }
    ]
  }
};

function showAnom(kind, opt) {
  var page = currentPage();
  var host = page === 'p02' ? $('#anomP02') : (page === 'p06' ? $('#anomP06') : null);
  if (!host) return;
  anomHost = host;
  host.querySelector('.card__bd').innerHTML = alertHTML(anomFor(kind, opt));
  host.hidden = false;
  host.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* 按当前上下文生成告警内容：文件名与样本量都来自实际操作，不写死 */
function anomFor(kind, opt) {
  var a = ANOMS[kind];
  if (!a) return { lv: 'warn', tag: '提示', icon: 'circle-info', title: kind, body: '', acts: [] };

  if (kind === 'format' && opt) {
    var base = opt.name.replace(/\.[^.]+$/, '');
    return {
      lv: a.lv, tag: a.tag, icon: a.icon,
      title: '检测到不支持的格式：.' + esc(opt.ext),
      body: '你上传的 <span class="num">' + esc(opt.name) + '</span> 不在支持清单内。'
          + '系统需要的是纯文本表格或标准组学格式，直接解析会丢结构。',
      detail: '<div class="fmtgrid mt-3">'
        + '<div class="fmt fmt--bad"><span class="fmt__c">.' + esc(opt.ext) + '</span>检测到的格式</div>'
        + '<div class="fmt"><span class="fmt__c">.csv</span>系统支持</div>'
        + '<div class="fmt"><span class="fmt__c">.tsv</span>系统支持</div>'
        + '</div>',
      acts: [
        { t: '把 .' + esc(opt.ext) + ' 自动转成 .csv', k: 'primary',
          msg: '已转换 ' + esc(opt.name) + ' → ' + esc(base) + '.csv（保留第一个工作表）' },
        { t: '下载格式模板', dl: 'template' },
        { t: '重新上传', go: 'p02' }
      ]
    };
  }

  return a;
}

function alertHTML(a, extraCls) {
  var acts = (a.acts || []).map(function (x, i) {
    if (x.disabled) {
      return '<div><button class="btn btn--sm" aria-disabled="true" style="cursor:not-allowed">' + x.t + '</button>'
        + (x.note ? '<div class="text-[11.5px] mt-1" style="color:#8A6A32;max-width:340px">' + x.note + '</div>' : '') + '</div>';
    }
    if (x.go) return '<button class="btn btn--sm' + (x.k === 'primary' ? ' btn--primary' : '') + '" data-go="' + x.go + '">' + x.t + '</button>';
    if (x.dl) return '<button class="btn btn--sm' + (x.k === 'primary' ? ' btn--primary' : '') + '" data-dl="' + x.dl + '">' + x.t + '</button>';
    return '<button class="btn btn--sm' + (x.k === 'primary' ? ' btn--primary' : '') + '" data-fix="' + i + '">' + x.t + '</button>';
  }).join('');
  return '<div class="alert alert--' + a.lv + ' ' + (extraCls || '') + '">'
    + '<span class="alert__ico">' + ico(a.icon) + '</span>'
    + '<div class="alert__bd">'
    + '<div class="alert__t"><span class="alert__tag">' + a.tag + '</span>' + a.title + '</div>'
    + '<p class="alert__p">' + a.body + '</p>'
    + (a.detail || '')
    + '<div class="alert__act">' + acts + '</div>'
    + '</div></div>';
}

/* 记录当前异常面板与上下文，供修复按钮回调 */
var anomCtx = null, anomHost = null;

/* ============================================================
   任务运行模拟（P-06）
   ============================================================ */
/* 任务流水线的**唯一来源**：节点名、工具版本、进度区间、计划耗时都从这里来。
   页面上不再有一份手写的阶段列表可以跟它走偏（原纵排列表就是第二份）。
   进度区间 from/to 决定「跑到哪一步」；sec 计划耗时合计 192s = 3:12，
   与日志末行「任务结束 耗时 3:12」对齐 —— 两处数字必须能对上。
   ic 是图标名，属于「存在数据里的图标名」，必须同时登记进 ICON_REGISTRY。 */
var RUN_STAGES = [
  { name: '载入数据与格式校验', short: '数据载入', tool: '对齐表 · 71 例', ic: 'file-arrow-down', from: 0, to: 10, sec: 19 },
  { name: '序列比对', short: '序列比对', tool: 'HISAT2 2.2.1', ic: 'diagram-project', from: 10, to: 34, sec: 46 },
  { name: '表达定量', short: '表达定量', tool: 'featureCounts 2.0.6', ic: 'table-cells', from: 34, to: 50, sec: 31 },
  { name: '差异分析', short: '差异分析', tool: 'DESeq2 1.42.0', ic: 'chart-column', from: 50, to: 82, sec: 61 },
  { name: '图表渲染与结果汇总', short: '结果汇总', tool: '火山图 / 热图', ic: 'chart-line', from: 82, to: 100, sec: 35 }
];

/* 秒 → 人类可读：46s / 1m01s。计划耗时既用在节点上，也用在卡片副标题上，
   所以只写一份 —— 写两处必然会有一天对不上。 */
function fmtSec(s) {
  s = Math.max(0, Math.round(s));
  return s < 60 ? s + 's' : Math.floor(s / 60) + 'm' + String(s % 60).padStart(2, '0') + 's';
}

function renderPipe() {
  var host = $('#pipeFlow'); if (!host) return;
  host.innerHTML = RUN_STAGES.map(function (st, i) {
    /* 连线是独立元素而不是节点的伪元素：节点会换行/滚动，伪元素跟着节点跑，
       连线就压在卡片边缘上。独立元素只负责「两节点之间」这一段。 */
    var arrow = i ? '<span class="pipe__arw" aria-hidden="true" data-pipe-arw="' + (i - 1) + '"></span>' : '';
    return arrow
      + '<div class="pipe__n" role="listitem" data-stage="' + i + '" data-pipe-state="wait">'
      + '<span class="pipe__ic">' + ico(st.ic) + '</span>'
      + '<span class="pipe__b">'
      + '<span class="pipe__t">' + esc(st.short) + '</span>'
      + '<span class="pipe__m">' + esc(st.tool) + '</span>'
      + '<span class="pipe__s" data-stage-t>等待</span>'
      + '</span>'
      + '<span class="pipe__p" data-stage-p></span>'
      + '</div>';
  }).join('');
  var meta = $('#pipeMeta');
  if (meta) {
    meta.textContent = 'T-2409-018 · ' + RUN_STAGES.length + ' 个阶段 · 计划耗时 '
      + fmtSec(RUN_STAGES.reduce(function (a, s) { return a + s.sec; }, 0));
  }
}

/* 节点与连线一起置回「未开始」。开始运行、取消任务、重跑都要回到同一个起点。 */
function resetPipe() {
  $$('#pipeFlow [data-stage]').forEach(function (r) {
    r.setAttribute('data-pipe-state', 'wait');
    r.style.removeProperty('--pipe-p');
    var t = r.querySelector('[data-stage-t]'); if (t) t.textContent = '等待';
  });
  $$('#pipeFlow [data-pipe-arw]').forEach(function (a) { a.classList.remove('is-done'); });
}

/* 把当前进度 p 映射到每个节点：已过的 = 完成，当前 = 运行中（带本阶段百分比与剩余），
   未到的 = 等待。stage 百分比是**本阶段**的比例，不是任务总进度 ——
   总进度在上面的总条与「当前进度」指标里看，两处口径必须分开。 */
function syncPipe(p, si) {
  var finished = p >= 100;
  $$('#pipeFlow [data-stage]').forEach(function (r, i) {
    var s = RUN_STAGES[i]; if (!s) return;
    var done = finished || i < si, now = i === si && !finished;
    r.setAttribute('data-pipe-state', done ? 'done' : now ? 'run' : 'wait');
    var t = r.querySelector('[data-stage-t]'), sp = 0;
    if (done) t.textContent = '完成 · ' + fmtSec(s.sec);
    else if (now) {
      sp = Math.max(0, Math.min(1, (p - s.from) / (s.to - s.from)));
      t.textContent = Math.round(sp * 100) + '% · 剩 ' + fmtSec(s.sec * (1 - sp));
      r.style.setProperty('--pipe-p', (sp * 100).toFixed(1) + '%');
    } else { t.textContent = '等待'; r.style.removeProperty('--pipe-p'); }
  });
  $$('#pipeFlow [data-pipe-arw]').forEach(function (a) {
    a.classList.toggle('is-done', finished || parseInt(a.getAttribute('data-pipe-arw'), 10) < si);
  });
}

/* 取消后不能留着「运行中」的节点：任务标签已经写着「已取消」，
   节点还亮着 32% 就成了同一屏上的两句矛盾话。已完成的阶段保留（它们确实跑完了），
   被打断的那个回到「等待」。连线不动 —— 连线只跟着「上游是否完成」，与取消无关。 */
function abortPipe() {
  $$('#pipeFlow [data-stage]').forEach(function (r) {
    if (r.getAttribute('data-pipe-state') !== 'run') return;
    r.setAttribute('data-pipe-state', 'wait');
    r.style.removeProperty('--pipe-p');
    var t = r.querySelector('[data-stage-t]'); if (t) t.textContent = '等待';
  });
}

var RUN_LOGS = [
  [2, 'INFO', '载入样本对齐表 TJ-TCM-2026.align.tsv  (75 samples)'],
  [5, 'INFO', '参考基因组 GRCh38.p14  索引命中'],
  [8, 'INFO', 'fastp v0.23.4  adapter trimming ...'],
  [16, 'INFO', 'HISAT2 v2.2.1  比对中  已处理 24/75 样本'],
  [27, 'INFO', 'HISAT2 v2.2.1  比对完成  总体比对率 96.4%'],
  [36, 'INFO', 'featureCounts v2.0.6  定量 61,842 个转录本'],
  [44, 'WARN', '样本 S037 文库大小偏低 (2.1M reads)  已纳入低置信标注'],
  [56, 'INFO', 'DESeq2 v1.42.0  差异分析  |log2FC|>=1.0  padj<0.05'],
  [68, 'INFO', '检出差异基因 1,247  (上调 612 / 下调 635)'],
  [78, 'INFO', '火山图 / 聚类热图 / 相关性矩阵 渲染完成'],
  [88, 'INFO', '富集分析  GO 186 条  KEGG 47 条'],
  [95, 'INFO', '结果文件已写入  中间产物 4 个'],
  [100, 'OK', '任务结束  退出码 0  耗时 3:12']
];
var runTimer = null, logIdx = 0;

function logLine(p, lv, msg) {
  var box = $('#logBox');
  if (!box) return;
  var t = '16:4' + Math.min(9, Math.floor(p / 12)) + ':' + String(Math.floor(p * 0.6) % 60).padStart(2, '0');
  var cls = lv === 'WARN' ? ' log__lv--warn' : lv === 'OK' ? ' log__lv--ok' : '';
  var el = document.createElement('div');
  el.className = 'log__l';
  el.innerHTML = '<span class="log__t">[' + t + ']</span> <span class="log__lv' + cls + '">' + lv.padEnd(4, ' ') + '</span> ' + msg.replace(/</g, '&lt;');
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

/* 提交即入队：队列里还有任务就得等。这是提交的结果，不是一个开关。
   队列为空（QUEUE_JOBS === 0）时才直接开跑。 */
function submitRun() {
  CTX.queued = QUEUE_JOBS + 1;
  var tag = $('#runTag');
  if (tag) { tag.className = 'tag tag--warn'; tag.innerHTML = ico('hourglass-half') + '排队中'; }
  /* 排队态只显示「请等待」——不再展示队列位次、预计耗时等细节（v63）。 */
  var stageT = $('#runStageText'); if (stageT) stageT.textContent = '请等待';
  var stageV = $('#stageV'); if (stageV) stageV.textContent = '请等待';
  var b = $('#btnRun');
  if (b) { b.removeAttribute('aria-disabled'); b.innerHTML = ico('play') + '开始执行'; }
  var c = $('#btnCancel'); if (c) c.setAttribute('aria-disabled', 'true');
  var r = $('#btnResult'); if (r) r.setAttribute('aria-disabled', 'true');
  syncAnoms();
  toast('任务已提交，请等待', 'warn');
}

function startRun() {
  if (runTimer) return;
  var bar = $('#runBar'), pctV = $('#pctV'), pctT = $('#runPctText'), stageT = $('#runStageText'), stageV = $('#stageV'), tag = $('#runTag');
  if (!bar) return;
  logIdx = 0;
  $('#logBox').innerHTML = '';
  $('#btnRun').setAttribute('aria-disabled', 'true');
  $('#btnCancel').removeAttribute('aria-disabled');
  $('#btnResult').setAttribute('aria-disabled', 'true');
  toast('任务 T-2409-018 已提交，正在排队调度', 'ok');
  resetPipe();

  var p = 0;
  runTimer = setInterval(function () {
    p = Math.min(100, p + (p < 12 ? 1.4 : 1.9));
    bar.style.width = p + '%';
    pctV.innerHTML = Math.round(p) + '<span class="mcell__u">%</span>';
    pctT.textContent = Math.round(p) + '%';
    var si = 0;
    for (var i = 0; i < RUN_STAGES.length; i++) if (p <= RUN_STAGES[i].to) { si = i; break; }
    if (p >= 100) si = RUN_STAGES.length - 1;
    var finished = p >= 100;
    var st = RUN_STAGES[si];
    stageT.textContent = finished ? '全部阶段已完成' : ('正在' + st.name + '…');
    stageV.textContent = st.short;
    syncPipe(p, si);
    while (logIdx < RUN_LOGS.length && p >= RUN_LOGS[logIdx][0]) { logLine(RUN_LOGS[logIdx][0], RUN_LOGS[logIdx][1], RUN_LOGS[logIdx][2]); logIdx++; }

    if (p >= 100) {
      clearInterval(runTimer); runTimer = null;
      tag.className = 'tag tag--ok'; tag.innerHTML = ico('circle-check') + '已完成';
      $('#btnResult').removeAttribute('aria-disabled');
      $('#btnCancel').setAttribute('aria-disabled', 'true');
      $('#btnRun').removeAttribute('aria-disabled');
      $('#runBar').className = 'bar__f';
      toast('任务完成，用时 3 分 12 秒。可查看结果', 'ok');
    } else if (p > 82) {
      tag.className = 'tag tag--brand'; tag.innerHTML = ico('spinner', 'spin') + '收尾中';
    } else {
      tag.className = 'tag tag--brand'; tag.innerHTML = ico('spinner', 'spin') + '运行中';
    }
  }, 70);
}

/* ============================================================
   完善项目信息（v52）
   ------------------------------------------------------------
   智能分析这条线**不建项目**（v50：它自带一条「数据汇集 → … → 查看分析结果」
   的线），于是走到「运行分析」那一刻，这批数据属于谁、用来做什么，
   系统里一个字都没有 —— 结果跑出来没人认得它是谁的。这一屏补的就是这个。

   七项里**两项自动回填**（样本ID / 参考基因组）：它们在前面几步已经定过了
   （数据汇集页选的数据决定样本ID，选的数据集与物种决定参考基因组）。
   再让人手填一遍，就是给同一件事开两个来源，两个来源迟早不一致 ——
   所以这两项在这里是**只读的回填行**，并写明它来自哪一步、要改去哪儿改。
   ============================================================ */
var RUNMETA = { name: '', desc: '', grp: '', sampDesc: '', cond: '', ok: false };

/* 本次分析纳入的样本ID：队列规模减去「缺蛋白组被排除」的那几例，**现算**。
   与分析线别处那句「71 例共同样本」是同一个口径 —— 不在两处各写一个 71，
   否则改队列时总有一处忘改，弹窗说 71、任务条说 75。 */
function anaSampIds() {
  return sampIds().filter(function (id) { return MISS_PROT.indexOf(id) < 0; });
}
function anaRef() { return refById(SEL.ref) || REF_GENOMES[0]; }

/* 回填行：**不是禁用的输入框**。disabled 的 .inp 会让读屏跳过它，
   也会让「这里为什么不能改」变成一个默认的灰 —— 而这一行恰恰需要被读到。
   v52 复审：行尾那枚「自动回填」标签与下面的来源说明**撤掉**（用户要求）——
   「值已经带过来了」这件事由**灰底虚线框本身**和顶部导语最后一句交代，
   行内不再重复；同一句话写三遍，弹窗就成了说明书。 */
function fillRow(label, key, val, note) {
  return '<div class="fld" data-rmfill="' + key + '">'
    + '<span class="fld__l">' + label + '：</span>'
    + '<div class="rbfill"><span class="rbfill__v">' + val + '</span>'
    + (note ? '<span class="rbfill__n">' + note + '</span>' : '') + '</div></div>';
}

function runMetaBody() {
  var ids = anaSampIds(), r = anaRef(), grps = pgPickNames(), head = ids.slice(0, 8);
  return '<div class="stack">'
    + '<p class="pbody">这条线不建项目就直接跑。跑之前把「这批数据属于谁、用来做什么」'
    + '记下来 —— 否则结果出来了没人认得它是谁的。标 <span class="req" aria-hidden="true">*</span> 的'
    + '四项需要你补；样本ID 与参考基因组已在前面几步定过，这里自动带出来。</p>'
    + '<div class="fld"><label class="fld__l" for="rmName">项目名称：' + reqMark() + '</label>'
    + '<input class="inp" id="rmName" autocomplete="off" aria-required="true"'
    + ' placeholder="请输入项目名称" value="' + esc(RUNMETA.name) + '"></div>'
    + '<div class="fld"><label class="fld__l" for="rmDesc">项目描述：' + reqMark() + '</label>'
    + '<input class="inp" id="rmDesc" autocomplete="off" aria-required="true"'
    + ' placeholder="请输入项目描述" value="' + esc(RUNMETA.desc) + '"></div>'
    + '<div class="fld"><label class="fld__l" for="rmGrp">所属项目组：' + reqMark() + '</label>'
    + '<select class="sel" id="rmGrp" aria-required="true"><option value="">请选择项目组</option>'
    /* 选项与新建项目向导第 1 步**同源**（pgPickNames：已通过 + 启用的组）。
       两处各写一张名单，迟早出现「向导里有、这里没有」这种分叉。 */
    + grps.map(function (g) {
        return '<option' + (g === RUNMETA.grp ? ' selected' : '') + '>' + esc(g) + '</option>';
      }).join('') + '</select>'
    + (grps.length ? ''
        : '<span class="fld__h">当前没有可选的项目组 —— 到「系统管理 › 项目组管理」创建，'
          + '或把已有的组启用（只有 已通过 + 启用 的组会出现在这里）</span>')
    + '</div>'
    + fillRow('样本ID', 'sid',
        head.map(esc).join(' · ') + (ids.length > head.length ? ' …' : ''),
        /* 例数**现算**（sampIds 而非 QUEUE_N）：补登的队列外样本会让 75 变 76，
           写死常量的那行提示就会跟旁边「共 N 例」打架。 */
        '共 ' + ids.length + ' 例')
    + '<div class="fld"><label class="fld__l" for="rmSampDesc">样本描述信息：' + reqMark() + '</label>'
    + '<input class="inp" id="rmSampDesc" autocomplete="off" aria-required="true"'
    + ' placeholder="请输入内容" value="' + esc(RUNMETA.sampDesc) + '"></div>'
    + fillRow('参考基因组', 'ref', esc(r.n + '（' + r.alias + '）'), esc(r.anno))
    + '<div class="fld"><label class="fld__l" for="rmCond">实验条件：</label>'
    + '<input class="inp" id="rmCond" autocomplete="off"'
    + ' placeholder="请输入实验条件描述" value="' + esc(RUNMETA.cond) + '"></div>'
    + frmLegend()
    + '</div>';
}

function runMetaFoot() {
  return '<button type="button" class="btn" data-close="modal">取消</button>'
    + '<button type="button" class="btn btn--primary" data-rmok>'
    + ico('play') + '确认并开始分析</button>';
}

function runMetaOpen() {
  showModal('完善项目信息', runMetaBody(), runMetaFoot());
  /* 选择屏 / 向导留下的宽版不能带进来：这一屏是纵向表单，宽版会把它拉成两条横带 */
  var b = $('#modal .modal__b');
  if (b) b.classList.remove('modal__b--wide');
}

/* 缺项提示：与向导同一副口径（toast 说缺哪一项 + 焦点落到第一格）——
   两处表单用两种拦法，用户会以为哪一处坏了。 */
function runMetaMiss(field, id) {
  toast('请先补全：' + field, 'warn');
  var e = $('#' + id);
  if (e) { e.classList.add('is-err'); if (e.focus) e.focus(); }
  return false;
}
function runMetaCheck() {
  if (!RUNMETA.name) return runMetaMiss('项目名称', 'rmName');
  if (!RUNMETA.desc) return runMetaMiss('项目描述', 'rmDesc');
  if (!RUNMETA.grp) return runMetaMiss('所属项目组', 'rmGrp');
  if (!RUNMETA.sampDesc) return runMetaMiss('样本描述信息', 'rmSampDesc');
  return true;
}

/* 确认：先收值、再校验、都过了才关弹窗并开跑。
   顺序是刻意的 —— 校验不过就不关，人还站在原地，改完直接再点一次；
   先关再弹一遍会把他刚填的那几项一起丢掉。 */
function runMetaConfirm() {
  var v = function (id) {
    var e = $('#' + id);
    return e ? String(e.value || '').replace(/^\s+|\s+$/g, '') : '';
  };
  RUNMETA.name = v('rmName');
  RUNMETA.desc = v('rmDesc');
  RUNMETA.grp = v('rmGrp');
  RUNMETA.sampDesc = v('rmSampDesc');
  RUNMETA.cond = v('rmCond');
  if (!runMetaCheck()) return;
  RUNMETA.ok = true;
  $('#modal').hidden = true;
  goto('p06');
  /* 与 [data-run] 那条路同一拍：先进页、再开跑 —— 进度、流水线、队列都在这一页上，
     顺序反了就会对着还没显示出来的页面去改它的宽度。 */
  setTimeout(function () {
    if (QUEUE_JOBS > 0) submitRun(); else startRun();
  }, 260);
  toast('已完善项目信息「' + RUNMETA.name + '」· ' + RUNMETA.grp + '，开始分析', 'ok');
}

/* 「本次分析信息」条：弹窗里填的东西必须有个落点，否则填完就没了 ——
   那是假交互。四项（项目 / 项目组 / 样本描述 / 实验条件）在这里复述一遍，
   另外两项回填项（样本ID / 参考基因组）也一并写明，好与页上别处的数字对账。 */
function renderRunMetaBar() {
  var bar = $('#runMetaBar');
  if (!bar) return;
  bar.hidden = !RUNMETA.ok;
  if (!RUNMETA.ok) return;
  var ids = anaSampIds(), r = anaRef();
  var T = $('#runMetaT'), P = $('#runMetaP');
  if (T) T.textContent = '项目「' + RUNMETA.name + '」· ' + RUNMETA.grp;
  if (P) {
    P.textContent = '项目描述：' + RUNMETA.desc
      + ' · 样本ID ' + ids.length + ' 例（自动回填）'
      + ' · 样本描述信息：' + RUNMETA.sampDesc
      + ' · 参考基因组 ' + r.n + '（' + r.alias + '，自动回填）'
      + (RUNMETA.cond ? ' · 实验条件：' + RUNMETA.cond : '');
  }
}

/* ============================================================
   参数 → 预期输出
   ============================================================ */
/* 同一份参数被多处控件读写（推荐配置卡 / 自定义卡 / 完整参数面板），
   统一走 PSTATE —— 各写各的必然"各说各话"。 */
var PSTATE = { lfc: 1.0, padj: 0.05 };
var PSIB = { lfc: ['lfc', 'lfcPlain'], padj: ['padj', 'padjPlain'] };

function syncParams(key, num, srcEl) {
  PSTATE[key] = num;
  PSIB[key].forEach(function (n) {
    $$('[data-param="' + n + '"]').forEach(function (el) {
      if (el === srcEl) return;                 /* 不回写来源控件，避免输入光标跳动 */
      if (el.tagName === 'SELECT') {
        var best = el.options.length ? el.options[0].value : '', bd = Infinity;
        Array.prototype.forEach.call(el.options, function (o) {
          var d = Math.abs(parseFloat(o.value) - num);
          if (d < bd) { bd = d; best = o.value; }
        });
        el.value = best;
      } else {
        el.value = num;
      }
    });
  });
}

function paramKey(el) {
  var n = el.getAttribute && el.getAttribute('data-param');
  if (n === 'lfc' || n === 'lfcPlain') return { key: 'lfc', num: parseFloat(el.value) };
  if (n === 'padj' || n === 'padjPlain') return { key: 'padj', num: parseFloat(el.value) };
  return null;
}

function readParams() {
  function v(n) { var e = $('[data-param="' + n + '"]'); return e ? e.value : null; }
  function c(n) { var e = $('[data-param="' + n + '"]'); return e ? e.checked : null; }
  return {
    ref: v('ref') || 'GRCh38.p14',
    aligner: v('aligner') || 'HISAT2 2.2.1',
    quant: v('quant') || 'featureCounts 2.0.6',
    de: v('de') || 'DESeq2 1.42.0',
    lfc: PSTATE.lfc.toFixed(1),
    padj: PSTATE.padj.toFixed(2),
    adj: v('adj') || 'Benjamini-Hochberg',
    mincount: v('mincount') || '10',
    filterLow: c('filterLow'),
    threads: v('threads') || '12',
    mem: v('mem') || '48'
  };
}

function updateExpect() {
  var p = readParams();
  var lfc = parseFloat(p.lfc) || 1, padj = parseFloat(p.padj) || 0.05;
  var n = Math.round(1247 * Math.pow(1 / lfc, 0.9) * Math.pow(padj / 0.05, 0.35));
  n = Math.max(18, Math.min(4200, n));
  var up = Math.round(n * 0.49), down = n - up;
  var ge = $('#expGenes'), ue = $('#expUp'), de = $('#expDown');
  if (!ge) return;
  ge.textContent = fmt(n); ue.textContent = fmt(up); de.textContent = fmt(down);
  $('#expSay').textContent = n > 2000
    ? '按当前较宽松的阈值，约 ' + fmt(n) + ' 个基因会被判定为显著差异。结果数量偏多，其中可能包含较多假阳性，建议仅在探索阶段使用。'
    : n < 400
      ? '按当前严格阈值，只剩约 ' + fmt(n) + ' 个基因达显著。结果少但可信度高，适合验证性研究；如果预期信号更多，可以适当放宽。'
      : '按当前阈值，约 ' + fmt(n) + ' 个基因会被判定为显著差异，与同队列规模研究的常见量级一致。';

  var sb = $('#sumBody');
  if (sb) {
    sb.innerHTML = [
      ['参考基因组', p.ref, '推荐值'],
      ['比对工具', p.aligner, '推荐值'],
      ['定量方法', p.quant, '推荐值'],
      ['差异分析算法', p.de, '推荐值'],
      ['|log2FC| 阈值', p.lfc, '按严格程度推导'],
      ['padj 阈值', p.padj, '按严格程度推导'],
      ['多重检验校正', p.adj, '推荐值'],
      ['低表达过滤', p.filterLow === false ? '不启用' : '低于 ' + p.mincount + ' 的基因剔除', '推荐值'],
      ['线程 / 内存', p.threads + ' 核 / ' + p.mem + ' GB', '按当前集群余量']
    ].map(function (r) {
      return '<tr><td>' + r[0] + '</td><td class="num">' + r[1] + '</td><td class="text-ink3">' + r[2] + '</td></tr>';
    }).join('');
  }
}

/* ============================================================
   知识赋能数据与渲染：医学知识库 / 自有知识库 / 知识图谱
   ============================================================ */

/* ---------- 医学知识库（kbmed）---------- */
var KB_CATS = {
  clinical: { n: '临床诊疗', ico: 'hospital', d: '指南、诊疗路径、用药与预后' },
  sample: { n: '生物样本', ico: 'microscope', d: '样本处理、质控、伦理与随访' },
  omics: { n: '多组学', ico: 'dna', d: '基因 / 转录 / 蛋白 / 代谢数据与通路' },
  lit: { n: '权威文献', ico: 'file-lines', d: '已收录并向量化的期刊与综述' }
};
var KB_STORE = [
  { id: 'K-1007', cat: 'omics', t: 'CYP3A4 表达上调与肝细胞癌风险的关联', s: '自有知识库 · TJ-TCM-2026 · 2026-08-12', src: '本机构队列 n=75', ev: 11, conf: '高', tags: ['CYP3A4', '差异表达', 'p=2.1e-11'] },
  { id: 'K-1011', cat: 'omics', t: '血清牛磺胆酸作为肝细胞癌候选标志物的队列内证据', s: '自有知识库 · TJ-TCM-2026 · 2026-08-12', src: '本机构队列 n=75', ev: 9, conf: '高', tags: ['牛磺胆酸', '代谢组', 'HMDB0000036'] },
  { id: 'K-1014', cat: 'omics', t: 'APOA1 血清浓度偏低与术后复发风险的关联', s: '自有知识库 · TJ-TCM-2026 · 2026-08-12', src: '本机构队列 n=71', ev: 7, conf: '中', tags: ['APOA1', '蛋白组', '预后'] },
  { id: 'K-1019', cat: 'omics', t: '胆汁酸生物合成通路（KEGG hsa00120）在本队列的富集结果', s: '自有知识库 · TJ-TCM-2026 · 2026-08-12', src: '本机构队列 n=71', ev: 8, conf: '高', tags: ['KEGG hsa00120', '富集分析'] },
  { id: 'K-1031', cat: 'lit', t: '血清胆汁酸谱与肝细胞癌预后：多中心队列研究', s: 'PMID:31284061 · 2023 · 已向量化', src: '外部文献 · 影响因子 12.4', ev: 3, conf: '中', tags: ['胆汁酸', '预后', '多中心'] },
  { id: 'K-1036', cat: 'lit', t: 'CYP3A4 多态性与索拉非尼药代动力学的系统综述', s: 'PMID:28451002 · 2021 · 已向量化', src: '外部文献 · 影响因子 6.8', ev: 3, conf: '中', tags: ['CYP3A4', '索拉非尼', '药代'] },
  { id: 'K-1042', cat: 'clinical', t: '原发性肝癌诊疗指南（2024 年版）· 血清标志物相关条目', s: '国家卫健委指南 · 2024 · 已抽取 18 条要点', src: '外部指南 · 权威一级', ev: 5, conf: '高', tags: ['诊疗指南', '标志物', 'AFP'] },
  { id: 'K-1048', cat: 'clinical', t: '索拉非尼用药与 CYP3A4 代谢酶相互作用的临床提示', s: '自有知识库 · 药学部 · 2026-05-02', src: '本机构药学部', ev: 5, conf: '高', tags: ['索拉非尼', '药物相互作用'] },
  { id: 'K-1053', cat: 'sample', t: '本院生物样本库血清样本采集与冻存标准操作规程', s: '自有知识库 · 样本库 · 2026-03-18 · v3.2', src: '本机构样本库 SOP', ev: 6, conf: '高', tags: ['SOP', '血清', '冻存'] },
  { id: 'K-1058', cat: 'sample', t: '多组学样本 ID 编码规则与跨组学对齐要求', s: '自有知识库 · 生信平台 · 2026-04-06 · v1.4', src: '本机构生信平台', ev: 12, conf: '高', tags: ['样本 ID', '对齐', '质控'] },
  { id: 'K-1063', cat: 'sample', t: '长期饮酒史采集口径与随访记录规范', s: '自有知识库 · 临床研究办 · 2026-02-11', src: '本机构临床研究办', ev: 6, conf: '中', tags: ['饮酒史', '随访', '变量口径'] },
  { id: 'K-1071', cat: 'lit', t: '炎症反应（GO:0006954）在肝细胞癌微环境中的作用综述', s: 'PMID:34091288 · 2022 · 已向量化', src: '外部文献 · 影响因子 9.1', ev: 3, conf: '中', tags: ['GO:0006954', '炎症', '微环境'] }
];
/* ============================================================
   临床知识词条（v35 按参考系统「临床知识库」改版；v36 升级为四域知识库）
   v36 知识域：★临床诊疗（病历/路径/指南→标准化实践规则）、生物样本（溯源）、
   多组学（跨组学关联网络）、权威文献（结构化提炼）。
   状态机（知识全生命周期）：draft 采集 → review 待审核 → pub 已发布 → arch 已归档；
   已发布可「修订」回到待审核（更新），已归档可「恢复」。
   f 数组按 KB2_FIELDS 的标签顺序取值。新增的词条 unshift 进来，
   「最近更新」与「浏览」列表都按数组顺序取，天然置顶。
   ============================================================ */
var KB2_DOMS = [
  { id: 'clin', n: '临床诊疗', star: true, cats: ['疾病', '症状', '检查', '药品'], d: '病历 · 诊疗路径 · 疾病指南' },
  { id: 'samp', n: '生物样本', cats: ['组织样本', '检测指标', '实验结果'], d: '样本溯源 · 检测指标 · 实验结果' },
  { id: 'omics', n: '多组学', cats: ['基因组', '蛋白组', '代谢组'], d: '基因 · 蛋白 · 代谢关联网络' },
  { id: 'lit', n: '权威文献', cats: ['指南', '期刊文献', '专家共识'], d: '指南 · 期刊 · 专家共识' }
];
function kb2DomDef(id) { return KB2_DOMS.filter(function (d) { return d.id === id; })[0] || KB2_DOMS[0]; }
var KB2_CATS = ['疾病', '症状', '检查', '药品'];
var KB2_FIELDS = {
  '疾病': { sec: [['病因与表现', '主要病因', '常见症状'], ['诊治与预防', '治疗原则', '预防措施']] },
  '症状': { sec: [['成因与关联', '可能病因', '常见伴随'], ['就医与处理', '处理建议', '就诊科室']] },
  '检查': { sec: [['临床应用', '检查类型', '临床意义'], ['标本与注意', '样本要求', '注意事项']] },
  '药品': { sec: [['临床应用', '适应症', '药品类别'], ['安全用药', '用药注意', '禁用提示']] },
  /* ---- v36 三域新分类模板 ---- */
  '组织样本': { sec: [['样本信息', '样本类型', '采集与保存'], ['质控与溯源', '质控要求', '溯源去向']] },
  '检测指标': { sec: [['指标定义', '检测方法', '参考区间'], ['临床解读', '异常意义', '关联样本']] },
  '实验结果': { sec: [['结果描述', '数据来源', '关键发现'], ['结果解读', '结论', '关联样本']] },
  '基因组': { sec: [['知识描述', '数据类型', '检测平台'], ['关联与解读', '相关疾病/表型', '跨组学关联']] },
  '蛋白组': { sec: [['知识描述', '数据类型', '检测平台'], ['关联与解读', '相关疾病/表型', '跨组学关联']] },
  '代谢组': { sec: [['知识描述', '数据类型', '检测平台'], ['关联与解读', '相关疾病/表型', '跨组学关联']] },
  '指南': { sec: [['来源信息', '发布机构', '发布年份'], ['结构化要点', '核心推荐', '证据等级']] },
  '期刊文献': { sec: [['来源信息', '期刊与年份', '研究对象'], ['结构化要点', '核心发现', '证据等级']] },
  '专家共识': { sec: [['来源信息', '共识机构', '发布年份'], ['结构化要点', '共识要点', '推荐强度']] }
};
var KB2_TERMS = [
  /* ---- 疾病 ---- */
  { n: '肝细胞癌', en: 'hepatocellular carcinoma, HCC', alias: '原发性肝癌', cat: '疾病',
    f: ['多因素协同：慢性乙肝/丙肝感染、黄曲霉毒素暴露、长期饮酒、代谢相关脂肪性肝病', '肝区疼痛、腹胀、乏力、消瘦、黄疸；早期常无症状', '手术切除、TACE、靶向与免疫治疗，按 CNLC 分期选择', '乙肝疫苗接种、抗病毒治疗、戒酒、高危人群每 6 个月超声+AFP 筛查'] },
  { n: '肝硬化', en: 'hepatic cirrhosis', alias: '肝硬变', cat: '疾病',
    f: ['慢性肝炎、长期饮酒、胆汁淤积、代谢与免疫性肝病进展的共同终末阶段', '乏力、食欲减退、腹水、食管胃底静脉曲张破裂出血、肝性脑病', '病因治疗、抗纤维化、并发症处理，失代偿期评估移植', '戒酒、规范抗病毒、避免肝毒性药物、定期胃镜与影像随访'] },
  { n: '慢性乙型病毒性肝炎', en: 'chronic hepatitis B', alias: '乙肝', cat: '疾病',
    f: ['HBV 持续感染＞6 个月，感染年龄越小慢性化风险越高', '乏力、纳差、尿黄；多数起病隐匿，可长期无症状', '恩替卡韦/替诺福韦长期抗病毒，定期评估肝功能与 HBV DNA', '接种疫苗、阻断母婴传播、避免共用注射器'] },
  { n: '非酒精性脂肪性肝病', en: 'NAFLD / MAFLD', alias: '脂肪肝', cat: '疾病',
    f: ['能量过剩、胰岛素抵抗相关的肝细胞脂肪变，与代谢综合征互为因果', '多无症状，可有乏力、肝区隐痛；部分进展为脂肪性肝炎', '减重与运动为核心，改善胰岛素抵抗，监测肝纤维化', '控制体重与腰围、限制果糖与酒精、规律有氧运动'] },
  { n: '药物性肝损伤', en: 'drug-induced liver injury, DILI', alias: '药肝', cat: '疾病',
    f: ['药物或其代谢产物的肝毒性或特异质反应，RUCAM 量表辅助因果评估', 'ALT/ALP 升高、黄疸、皮疹或嗜酸性粒细胞增多（过敏型）', '立即停用可疑药物，必要时 N-乙酰半胱氨酸或糖皮质激素', '避免叠加肝毒性药物、用药期间监测肝功能'] },
  { n: '自身免疫性肝炎', en: 'autoimmune hepatitis, AIH', alias: '自免肝', cat: '疾病',
    f: ['免疫耐受破坏导致的肝细胞炎症，女多于男，常合并其他自身免疫病', '慢性肝衰竭表现，球蛋白显著升高，ANA/SMA 阳性', '糖皮质激素 ± 硫唑嘌呤免疫抑制，多数应答良好', '规律服药不自行停药、定期复查免疫指标'] },
  { n: '原发性胆汁性胆管炎', en: 'primary biliary cholangitis, PBC', alias: 'PBC', cat: '疾病',
    f: ['针对小叶间胆管的自身免疫性破坏，中年女性多见', '皮肤瘙痒、乏力、ALP/GGT 升高，AMA-M2 阳性', '熊去氧胆酸长期治疗，应答不佳者加用奥贝胆酸', '避免胆汁淤积加重的药物，脂溶性维生素补充'] },
  { n: '肝豆状核变性', en: 'Wilson disease', alias: 'Wilson 病', cat: '疾病',
    f: ['ATP7B 基因突变致铜蓝蛋白合成障碍、铜蓄积，常染色体隐性遗传', '角膜 K-F 环、锥体外系症状、肝硬化；青少年起病', '低铜饮食 + 青霉胺/锌剂驱铜，重者肝移植', '避免贝类坚果等高铜食物，家系筛查'] },
  { n: '2型糖尿病', en: 'type 2 diabetes mellitus, T2DM', alias: '非胰岛素依赖型糖尿病、成人发病型糖尿病', cat: '疾病',
    f: ['遗传与环境因素共同作用导致的胰岛素抵抗伴进行性分泌不足', '多饮、多尿、多食、体重减轻；随病程出现慢性并发症', '生活方式干预为基础，二甲双胍一线，按心肾指征联用', '饮食控制、规律运动、定期监测血糖与并发症'] },
  { n: '高血压', en: 'hypertension', alias: '高血压病', cat: '疾病',
    f: ['遗传与高盐、肥胖、精神应激等环境因素共同作用', '多数无症状，可有头晕头痛；靶器官损害决定危险分层', '五类一线药物个体化选择，多数需联合用药', '限盐＜5g/日、减重、戒烟限酒、家庭自测血压'] },
  /* ---- 症状 ---- */
  { n: '黄疸', en: 'jaundice', alias: '黄染', cat: '症状',
    f: ['胆红素生成增多、摄取结合障碍或排泄受阻（溶血/肝细胞性/梗阻性）', '尿色加深、皮肤瘙痒、陶土样便（梗阻性）', '先定位（溶血/肝/胆道）再对因治疗，梗阻性需解除梗阻', '消化内科或肝胆外科'] },
  { n: '呕血', en: 'hematemesis', alias: '吐血', cat: '症状',
    f: ['上消化道出血：静脉曲张破裂、消化性溃疡、门脉高压性胃病等', '黑便、心悸、头晕，量大时可致失血性休克', '禁食、扩容、内镜下止血与药物降门脉压，危重时介入/外科', '急诊科'] },
  { n: '肝掌', en: 'liver palm', alias: '掌红斑', cat: '症状',
    f: ['雌激素灭活减少致毛细血管扩张，大小鱼际片状充血', '常与蜘蛛痣伴随，压之褪色', '本身无需处理，按慢性肝病病因随访治疗', '消化内科'] },
  { n: '蜘蛛痣', en: 'spider angioma', alias: '蜘蛛状毛细血管扩张', cat: '症状',
    f: ['中心小动脉放射状分支扩张，与雌激素水平升高相关', '分布于上腔静脉引流区，压之褪色', '数量变化有助于判断肝病活动性，对因治疗', '消化内科或皮肤科'] },
  { n: '腹水', en: 'ascites', alias: '腹腔积液', cat: '症状',
    f: ['门脉高压、低白蛋白、肾钠水潴留（肝硬化最常见）', '腹胀、移动性浊音阳性，可合并自发性腹膜炎', '限钠 + 利尿（螺内酯±呋塞米），顽固性者穿刺放液或 TIPS', '消化内科'] },
  { n: '乏力', en: 'fatigue', alias: '疲乏、倦怠', cat: '症状',
    f: ['可见于慢性肝病、贫血、甲状腺与精神心理等多种情况', '注意伴随的体重变化、睡眠与情绪状态', '先查因后对因，慢性肝病者评估肝功能与营养状态', '全科或相应专科'] },
  { n: '恶心与呕吐', en: 'nausea and vomiting', alias: '恶心呕吐', cat: '症状',
    f: ['胃肠疾病、药物、代谢与中枢因素均可引起', '脱水与电解质紊乱是主要风险，注意报警症状', '止吐对症 + 纠正水电解质，持续呕吐须查因', '消化内科'] },
  { n: '皮肤瘙痒', en: 'pruritus', alias: '瘙痒症', cat: '症状',
    f: ['胆汁淤积性肝病常见表现，也见于皮肤与系统性疾病', '抓痕、睡眠受扰，黄疸者提示胆汁淤积', '考来烯胺、利福平等止痒，积极治疗原发病', '消化内科或皮肤科'] },
  { n: '发绀', en: 'cyanosis', alias: '紫绀', cat: '症状',
    f: ['血中还原血红蛋白增多或异常血红蛋白，分中心性与周围性', '口唇与肢端青紫，伴呼吸困难的为中心性', '立即评估氧合与心肺功能，对因处理', '急诊科或呼吸内科'] },
  { n: '复视', en: 'diplopia', alias: '视物重影', cat: '症状',
    f: ['眼外肌麻痹、神经或颅内病变；单眼复视多为屈光问题', '遮盖一眼后消失提示双眼复视', '神经科定位诊断，影像排查颅内病变', '神经内科或眼科'] },
  /* ---- 检查 ---- */
  { n: '肝功能检查', en: 'liver function tests, LFTs', alias: '肝功能', cat: '检查',
    f: ['血液生化检验（酶学、胆红素、蛋白）', '反映肝细胞损伤、胆汁淤积与合成功能', '空腹 8 小时以上静脉血，避免剧烈运动与饮酒后采血', '检查前勿服可能干扰结果的药物（告知医生）'] },
  { n: '甲胎蛋白测定', en: 'alpha-fetoprotein, AFP', alias: 'AFP', cat: '检查',
    f: ['血清肿瘤标志物检测', '肝细胞癌筛查与疗效监测；妊娠期生理性升高', '空腹静脉血 2-3 mL，无需特殊准备', '单独升高不等于肝癌，需结合影像（区别于假阳性）'] },
  { n: '腹部超声', en: 'abdominal ultrasound', alias: '肝胆胰脾超声', cat: '检查',
    f: ['实时灰阶超声成像', '肝胆胰脾肾形态、占位、积液的一线筛查', '检查前禁食 8 小时（胆囊充盈）', '腹腔胀气明显者图像质量下降'] },
  { n: '上腹部增强MRI', en: 'upper abdominal enhanced MRI', alias: '上腹部磁共振增强', cat: '检查',
    f: ['MRI 平扫+钆对比剂增强（必要时肝胆特异期）', '肝脏占位定性诊断（如 HCC 的「快进快出」强化）', '需去除金属物品；钆剂过敏与严重肾功能不全者禁忌', '检查前 4 小时禁食，预约时告知植入物史'] },
  { n: 'CT增强扫描', en: 'contrast-enhanced CT', alias: '增强CT', cat: '检查',
    f: ['碘对比剂多期增强成像', '占位血供评估、分期与介入术后随访', '碘剂过敏与甲亢未控者禁忌；检查前评估肾功能', '检查前禁食 4 小时，术后多饮水促排造影剂'] },
  { n: '血浆胆固醇测定', en: 'plasma cholesterol', alias: '总胆固醇', cat: '检查',
    f: ['血脂谱生化检测', '心血管风险分层与降脂疗效监测', '空腹 12 小时静脉血，检查前 3 天保持平日饮食', '急性感染、妊娠可影响结果'] },
  { n: '24小时尿蛋白定量', en: '24-hour urinary protein', alias: '24h 尿蛋白', cat: '检查',
    f: ['尿液生化定量检测', '肾脏损伤程度评估与随访（如糖尿病肾病）', '留取 24 小时全部尿液并记录总量', '留尿期间避免剧烈运动，标本冷藏'] },
  { n: 'EB病毒DNA检测', en: 'EBV DNA quantification', alias: 'EBV-DNA', cat: '检查',
    f: ['实时荧光定量 PCR', 'EB 病毒感染活动性与移植后淋巴增殖疾病监测', '外周血 2 mL（EDTA 抗凝）', '采样污染可致假阳性，动态观察更有意义'] },
  { n: 'C反应蛋白', en: 'C-reactive protein, CRP', alias: 'CRP', cat: '检查',
    f: ['血清炎症标志物检测', '感染与炎症活动性的敏感指标，用于鉴别与随访', '静脉血 2 mL，无需空腹', '结果需结合临床解读，动态观察更有意义'] },
  { n: '肝纤维化无创评估', en: 'transient elastography, FibroScan', alias: '肝脏弹性检测', cat: '检查',
    f: ['振动控制的瞬时弹性成像', '肝纤维化分期与脂肪含量定量，替代部分肝穿刺', '检查前禁食 2-3 小时，右肋间测量 10 次取中位值', '腹水、肋间隙过窄或重度肥胖者可靠性下降'] },
  /* ---- 药品 ---- */
  { n: '索拉非尼', en: 'sorafenib', alias: '多吉美', cat: '药品',
    f: ['不可手术肝细胞癌的既往标准靶向治疗', '多激酶抑制剂（口服靶向药）', '手足综合征、腹泻、高血压；注意 CYP3A4 相关药物相互作用', '活动性出血、近期手术者慎用'] },
  { n: '仑伐替尼', en: 'lenvatinib', alias: '乐卫玛', cat: '药品',
    f: ['不可切除肝细胞癌的一线靶向治疗', '多受体酪氨酸激酶抑制剂', '高血压、蛋白尿、乏力、甲状腺功能异常；按体重给药', '未控高血压与重度肝功能不全者慎用'] },
  { n: '恩替卡韦片', en: 'entecavir tablets', alias: '博路定', cat: '药品',
    f: ['慢性乙型肝炎抗病毒治疗一线用药', '核苷（酸）类似物', '空腹服用（餐前餐后 2 小时）；长期服药不自行停药', '拉米夫定耐药者需调整剂量'] },
  { n: '多烯磷脂酰胆碱胶囊', en: 'polyene phosphatidylcholine', alias: '易善复', cat: '药品',
    f: ['辅助改善中毒性、代谢性肝损伤', '肝细胞膜保护剂', '餐中整粒吞服；少数人胃肠道不适', '对大豆蛋白过敏者禁用'] },
  { n: '谷胱甘肽片', en: 'glutathione tablets', alias: '阿拓莫兰', cat: '药品',
    f: ['药物性、酒精性肝损伤的辅助治疗', '解毒与抗氧化剂', '偶见皮疹恶心；避免与强氧化性药物配伍', '对本品过敏者禁用'] },
  { n: '呋塞米片', en: 'furosemide tablets', alias: '速尿', cat: '药品',
    f: ['水肿性疾病与腹水的利尿治疗', '袢利尿剂', '低钾血症监测；晨起服用减少夜尿', '无尿或严重电解质紊乱者禁用'] },
  { n: '螺内酯片', en: 'spironolactone tablets', alias: '安体舒通', cat: '药品',
    f: ['肝硬化腹水的一线利尿药，常与袢利尿剂联用', '醛固酮受体拮抗剂', '高钾血症风险；监测血钾与肾功能', '高钾血症与 Addison 病者禁用'] },
  { n: '二甲双胍片', en: 'metformin tablets', alias: '格华止', cat: '药品',
    f: ['2型糖尿病一线用药，合并 NAFLD 者亦有获益证据', '双胍类胰岛素增敏剂', '餐中或餐后服减少胃肠道反应；eGFR 下降时减量或停用', '碘造影检查当日停药，缺氧性疾病者慎用'] },
  { n: '阿托伐他汀钙片', en: 'atorvastatin calcium tablets', alias: '立普妥', cat: '药品',
    f: ['血脂异常与动脉粥样硬化性心血管疾病防治', 'HMG-CoA 还原酶抑制剂（他汀类）', '晚间服用；肌痛伴 CK 升高需及时就诊；经 CYP3A4 代谢', '活动性肝病与不明原因转氨酶持续升高者禁用'] },
  { n: '熊去氧胆酸胶囊', en: 'ursodeoxycholic acid capsules', alias: '优思弗', cat: '药品',
    f: ['原发性胆汁性胆管炎的标准治疗，胆固醇性结石溶解', '亲水性胆汁酸', '餐中整粒吞服；腹泻为常见不良反应', '胆道完全梗阻者禁用'] },
  /* ---- v36 生物样本域（样本溯源） ---- */
  { n: '肝癌组织 FFPE 样本', en: 'FFPE tumor tissue', alias: '石蜡包埋样本', cat: '组织样本', dom: 'samp',
    f: ['手术切除肝癌组织的福尔马林固定石蜡包埋样本', '本机构样本库 · 4℃ 恒温柜存放', 'H&E 染色复核肿瘤含量 ≥ 30%，核酸质量 QC 达标', '样本库编号 S037-L，已用于 WGS 与转录组测序'],
    trace: ['S037-L · 肝癌组织 FFPE', 'H&E 病理 · 肿瘤含量 42%', '实验结果 · 已入组 WGS 测序'], upd: '2026-09-12' },
  { n: '外周血 EDTA 血浆样本', en: 'peripheral blood plasma (EDTA)', alias: '血浆样本', cat: '组织样本', dom: 'samp',
    f: ['EDTA 抗凝管采集外周血，两步离心分离血浆', '本机构样本库 · -80℃ 超低温冰箱', '冻融次数 ≤ 2，血红蛋白溶血指数 QC', '样本库编号 S037-P，用于 ctDNA 与代谢组检测'],
    trace: ['S037-P · EDTA 血浆', '血红蛋白溶血指数 · 合格', '实验结果 · 已用于代谢组学检测'], upd: '2026-09-12' },
  { n: '血清 AFP 定量检测', en: 'serum AFP quantification', alias: 'AFP 血清学', cat: '检测指标', dom: 'samp', status: 'review',
    f: ['电化学发光免疫分析法定量检测血清甲胎蛋白', '参考区间 ＜ 7 ng/mL（非妊娠成人）', '≥ 400 ng/mL 结合影像提示 HCC；单独升高需排除假阳性', '关联样本 S037 血清 · 检测值 812 ng/mL（↑）'], upd: '2026-09-20' },
  { n: '血清白蛋白 ALB', en: 'serum albumin', alias: '白蛋白', cat: '检测指标', dom: 'samp',
    f: ['溴甲酚绿法血清生化定量', '参考区间 40-55 g/L', '低于 35 g/L 提示合成功能受损，计入 Child-Pugh 评分', '关联样本 S037-L 配对血清 · 检测值 43.2 g/L（正常）'],
    trace: ['S037-L 配对血清', '白蛋白 ALB · 43.2 g/L', '实验结果 · 低于队列中位数 ↓'], upd: '2026-09-15' },
  { n: 'WGS 全基因组测序结果', en: 'whole-genome sequencing result', alias: 'WGS 结果', cat: '实验结果', dom: 'samp',
    f: ['肿瘤-配对 WGS，平均覆盖度 100×，SNV/Indel/CNV 全检出', '本机构生信平台 · GATK 最佳实践流程', '检出 TP53 p.R249S 体细胞突变，14q 缺失', '结论：基因组不稳定表型；原始数据见文件管理 TJ-TCM-2026_WGS.vcf.gz'], upd: '2026-09-22' },
  { n: '免疫组化结果', en: 'immunohistochemistry result', alias: 'IHC 结果', cat: '实验结果', dom: 'samp', status: 'review',
    f: ['肝癌组织芯片 IHC 染色（p53 / GS / HSP70 三联）', '本机构病理科 · 自动染色平台', 'p53 弥漫强阳性、GS 灶性阳性，符合 HCC 表型', '结论：支持肝细胞癌病理诊断；与蛋白组 p53 低表达互证'], upd: '2026-09-24' },
  /* ---- v36 多组学域（跨组学关联网络） ---- */
  { n: 'TP53 突变', en: 'TP53 mutation', alias: 'TP53 p.R249S', cat: '基因组', dom: 'omics',
    f: ['体细胞点突变 · WGS VCF 变异记录', 'Illumina NovaSeq 6000', '与肝癌发生、分期进展相关', '蛋白组层面表现为 p53 蛋白低表达（蛋白降解）'],
    net: { '基因组': [], '蛋白组': ['p53 蛋白低表达'], '代谢组': [] }, upd: '2026-09-18' },
  { n: '14q 拷贝数缺失', en: 'chromosome 14q loss', alias: '14q 缺失', cat: '基因组', dom: 'omics',
    f: ['体细胞拷贝数变异（CNV）· WGS CNV 片段记录', 'Illumina NovaSeq 6000 + GATK CNV', '涉及多个肿瘤抑制基因位点，与 HCC 预后相关', '与代谢组胆汁酸通路紊乱共现（本队列）'], upd: '2026-09-18' },
  { n: 'p53 蛋白低表达', en: 'p53 protein downregulation', alias: 'p53 低表达', cat: '蛋白组', dom: 'omics',
    f: ['肿瘤组织蛋白定量下调 · label-free DIA 蛋白组定量', 'Thermo Orbitrap Exploris 480', '与免疫组化 p53 弥漫强阳性形成亚克隆异质性提示', '基因组层面来源：TP53 突变；代谢层面与糖酵解上调共现'],
    net: { '基因组': ['TP53 突变'], '蛋白组': [], '代谢组': ['糖酵解通路上调'] }, upd: '2026-09-19' },
  { n: 'APOA1 蛋白下调', en: 'APOA1 protein downregulation', alias: '载脂蛋白 A1 下调', cat: '蛋白组', dom: 'omics',
    f: ['血清与组织蛋白组显著下调 · DIA 定量（队列 n=71）', 'Thermo Orbitrap Exploris 480', '与术后复发风险升高相关（本队列 HR 2.3）', '代谢组层面伴随 HDL 相关脂质谱改变'], upd: '2026-09-19' },
  { n: '牛磺胆酸升高', en: 'taurocholic acid elevation', alias: 'TCA 升高', cat: '代谢组', dom: 'omics',
    f: ['差异代谢物（HMDB0000036）· LC-MS 非靶向代谢组', 'Waters Xevo G2-S QTof', '与 HCC 诊断与预后分层相关，队列内 AUC 0.87', '基因组/蛋白组层面与胆汁酸合成通路（CYP8A1 相关）上调衔接'],
    net: { '基因组': ['14q 拷贝数缺失'], '蛋白组': [], '代谢组': [] }, upd: '2026-09-21' },
  { n: '糖酵解通路上调', en: 'glycolysis pathway upregulation', alias: 'Warburg 效应', cat: '代谢组', dom: 'omics',
    f: ['代谢通路富集：糖酵解/糖异生（KEGG hsa00010）', 'Waters Xevo G2-S QTof', '乳酸与糖酵解中间产物同步升高，提示 Warburg 效应', '蛋白组层面 p53 低表达与该表型互证（本队列）'],
    net: { '基因组': [], '蛋白组': ['p53 蛋白低表达'], '代谢组': [] }, upd: '2026-09-21' },
  /* ---- v36 权威文献域（结构化提炼） ---- */
  { n: '原发性肝癌诊疗指南（2024 年版）', en: 'Guideline for diagnosis and treatment of primary liver cancer (2024)', alias: '卫健委肝癌指南 2024', cat: '指南', dom: 'lit',
    f: ['国家卫生健康委员会医政司', '2024 年 1 月', 'CNLC 分期系统指导治疗路径选择；高危人群每 6 个月超声 + AFP 筛查', '证据等级：一级推荐（1A 类证据）'],
    refs: [['指南', '原发性肝癌诊疗指南（2024 年版）', '国家卫健委 · 2024', '一级推荐'], ['指南', 'CSCO 原发性肝癌诊疗指南 2024', '中国临床肿瘤学会 · 2024', '一级推荐']], upd: '2026-09-08' },
  { n: 'CSCO 原发性肝癌诊疗指南 2024', en: 'CSCO guidelines for HCC 2024', alias: 'CSCO 肝癌指南', cat: '指南', dom: 'lit',
    f: ['中国临床肿瘤学会（CSCO）', '2024 年 4 月', '按 Child-Pugh 与 PS 评分分层给出系统治疗推荐；一线推荐阿替利珠单抗+贝伐珠单抗等', '证据等级：Ⅰ 级推荐（1A/1B 类证据）'], upd: '2026-09-08' },
  { n: 'EASL 肝细胞癌管理实践指南', en: 'EASL Clinical Practice Guidelines: HCC management', alias: 'EASL 指南', cat: '指南', dom: 'lit',
    f: ['欧洲肝脏研究学会（EASL）', '2024 年更新', 'BCLC 分期治疗策略；系统治疗与局部治疗顺序建议', '证据等级：一级证据，弱/强推荐分级'], upd: '2026-09-10' },
  { n: '肝癌蛋白组学多中心队列研究', en: 'proteomics cohort study of HCC', alias: 'HCC 蛋白组研究', cat: '期刊文献', dom: 'lit', status: 'draft',
    f: ['Hepatology · 2023 · 多中心', '队列 n=412，DIA 蛋白组 + 临床随访', '蛋白组分层可预测早期复发，独立于常规临床指标', '证据等级：前瞻队列 · 中高质量'], upd: '2026-09-25' },
  { n: '血清胆汁酸谱与 HCC 预后研究', en: 'serum bile acid profile and HCC prognosis', alias: '胆汁酸预后研究', cat: '期刊文献', dom: 'lit',
    f: ['Journal of Hepatology · 2023 · 多中心队列', '血清胆汁酸谱非靶向代谢组', '牛磺胆酸等 6 种胆汁酸与总生存相关，验证集 AUC 0.85', '证据等级：多中心验证 · 中高质量'], upd: '2026-09-20' },
  { n: '肝癌多学科诊疗专家共识', en: 'expert consensus on MDT for liver cancer', alias: '肝癌 MDT 共识', cat: '专家共识', dom: 'lit', status: 'arch',
    f: ['中国医师协会肝癌专业委员会等', '2023 年修订', '确诊肝癌应经 MDT 评估后再定治疗方案；TACE 与靶免联合的衔接时机', '推荐强度：强推荐（专家意见，证据级别 2B）'], upd: '2026-08-30' }
];
/* v35 之前的临床词条统一归入 ★临床诊疗域；其余词条补默认状态与更新时间 */
KB2_TERMS.forEach(function (t) {
  if (!t.dom) t.dom = 'clin';
  if (!t.status) t.status = 'pub';
  if (!t.upd) t.upd = '2026-09-05';
});
/* 临床实践规则（★核心域：病历/诊疗路径/疾病指南沉淀的标准化规则，按需挂载） */
[{ n: '肝细胞癌', rules: [
    ['R-C01', '高危人群（慢性乙肝/肝硬化/肝癌家族史）每 6 个月行腹部超声 + 血清 AFP 筛查', '卫健委指南 2024'],
    ['R-C02', 'CNLC Ⅰa 期首选手术切除；Ⅰb-Ⅱb 期按 TACE / 消融路径评估', 'CNLC 诊疗路径'],
    ['R-C03', '确诊肝细胞癌须经 MDT 多学科会诊评估后再定治疗方案', '院内 MDT 共识']] },
  { n: '肝硬化', rules: [
    ['R-C04', '代偿期每 6 个月胃镜 + 超声随访静脉曲张与 HCC', 'EASL 指南'],
    ['R-C05', '腹水一线治疗：限钠 2 g/日 + 螺内酯 ± 呋塞米，按血钾调整比例', '院内临床路径']] }
].forEach(function (r) {
  var t0 = KB2_TERMS.filter(function (t) { return t.n === r.n; })[0];
  if (t0) t0.rules = r.rules;
});
/* 生命周期状态机 */
var KB2_ST = { draft: '采集', review: '待审核', pub: '已发布', arch: '已归档' };
var KB2_STCLS = { draft: 'tag--hint', review: 'tag--warn', pub: 'tag--ok', arch: '' };
var KB2_FLOW = { draft: ['review', '提交审核'], review: ['pub', '审核发布'], pub: ['arch', '归档'], arch: ['pub', '恢复'] };
var KB2 = { mode: 'search', dom: 'clin', cat: '全部', q: '', bcat: '疾病', letter: 'all', afilt: 'all', cur: null, from: 'browse' };
var KB_CUR = { cat: 'all', q: '', ids: null, node: 'S037' };
/* 图谱点击后的实体说明：随构建注入（见文件末尾的 DOMContentLoaded 监听） */

/* ---- v35 渲染器：词云 / 最近更新 / 浏览词条表 / 详情 ---- */

function kb2Letter(n) {
  var c = (n || '').charAt(0).toUpperCase();
  if (c >= 'A' && c <= 'G') return 'A-G';
  if (c >= 'H' && c <= 'N') return 'H-N';
  if (c >= 'O' && c <= 'T') return 'O-T';
  if (c >= 'U' && c <= 'Z') return 'U-Z';
  return '#';
}
function kb2ByCat(cat) { return KB2_TERMS.filter(function (t) { return t.cat === cat; }); }
/* 当前知识域的词条 */
function kb2OfDom(id) { return KB2_TERMS.filter(function (t) { return t.dom === (id || KB2.dom); }); }
function kb2Hits(t, q) {
  var s = (t.n + ' ' + (t.en || '') + ' ' + (t.alias || '')).toLowerCase();
  return s.indexOf(q.toLowerCase()) > -1;
}
/* 词条按钮（词云 / 词条表 / 检索结果通用）。size: 2 大 / 1 中 / 0 小 */
function kb2CellHTML(t, size, withCat) {
  var tiers = ['kbm-w--s', 'kbm-w--m', 'kbm-w--l', 'kbm-w--xl'];
  return '<button type="button" class="kbm-cell ' + tiers[size || 0] + '" data-kb2term="' + esc(t.n) + '" title="' + esc(t.n) + '">'
    + '<span class="kbm-cell__n">' + esc(t.n) + '</span>'
    + (t.isNew ? '<span class="tag tag--ok kbm-cell__new">新增</span>' : '')
    + (withCat ? '<span class="kbm-cell__c">' + esc(t.cat) + '</span>' : '')
    + (t.status && t.status !== 'pub' ? '<span class="tag ' + KB2_STCLS[t.status] + ' kbm-cell__st">' + KB2_ST[t.status] + '</span>' : '')
    + '</button>';
}

/* 知识域胶囊（检索/浏览/管理三态共享；★ 临床诊疗为核心域） */
function renderKb2Dom() {
  var host = $('#kbmDom'); if (!host) return;
  host.innerHTML = KB2_DOMS.map(function (d) {
    var on = d.id === KB2.dom;
    return '<button type="button" class="kbm-dom__i' + (on ? ' is-on' : '') + '" role="tab"'
      + ' aria-selected="' + on + '" data-kb2dom="' + d.id + '" title="' + esc(d.d) + '">'
      + (d.star ? '<span class="kbm-dom__star">' + ico('star') + '</span>' : '')
      + esc(d.n)
      + '<span class="kbm-dom__n">' + kb2OfDom(d.id).length + '</span></button>';
  }).join('');
  /* 检索分类下拉与域同源：切域即重建（保留仍有效的当前值） */
  var sel = $('#kb2Cat');
  if (sel) {
    var cur = sel.value, cats = kb2DomDef(KB2.dom).cats;
    sel.innerHTML = '<option>全部</option>' + cats.map(function (c) { return '<option>' + c + '</option>'; }).join('');
    sel.value = (cur === '全部' || cats.indexOf(cur) > -1) ? cur : '全部';
  }
}

function renderKb2Cloud() {
  var host = $('#kbmCloud'); if (!host) return;
  /* 词云：当前域四类已发布词条轮转取样，分四行中心排布 —— 行密度中间高、字号中排最大，
     形成云状；全程确定性轮换，不引入随机。 */
  var cats = kb2DomDef(KB2.dom).cats;
  var pools = cats.map(function (c) { return kb2ByCat(c).filter(function (t) { return t.status === 'pub'; }); });
  var pool = [];
  for (var k = 0; pool.length < 22 && k < 40; k++) {
    for (var ci = 0; ci < pools.length && pool.length < 22; ci++) {
      if (pools[ci][k]) pool.push(pools[ci][k]);
    }
  }
  if (!pool.length) { host.innerHTML = '<div class="kbm-empty">该知识域暂无已发布词条</div>'; return; }
  /* 每行词条数与字号节奏（顶部/底部小、中排最大），颜色三轮换 */
  var ROWS = [4, 6, 7, 5];
  var SZ = [
    ['s', 's', 'm', 's'],
    ['m', 's', 'l', 'm', 's', 'm'],
    ['xl', 'l', 'xl', 'm', 'l', 's', 'm'],
    ['m', 's', 'm', 's', 's']
  ];
  var html = '', p = 0;
  for (var r = 0; r < ROWS.length; r++) {
    html += '<div class="kbm-cloud__r">';
    for (var j = 0; j < ROWS[r] && p < pool.length; j++, p++) {
      html += '<button type="button" class="kbm-w kbm-w--' + SZ[r][j] + ' kbm-c' + (p % 3) + '"'
        + ' data-kb2term="' + esc(pool[p].n) + '">' + esc(pool[p].n) + '</button>';
    }
    html += '</div>';
  }
  host.innerHTML = html;
}

function renderKb2Recent() {
  var host = $('#kbmRecent'); if (!host) return;
  var cats = kb2DomDef(KB2.dom).cats;
  host.innerHTML = cats.map(function (c) {
    var list = kb2ByCat(c).slice(0, 8);
    return '<div class="kbm-row"><div class="kbm-row__k">' + c + '</div>'
      + '<div class="kbm-row__v">' + list.map(function (t) { return kb2CellHTML(t, 0); }).join('') + '</div></div>';
  }).join('');
}

function renderKb2Menu() {
  var host = $('#kbmMenu'); if (!host) return;
  var cats = kb2DomDef(KB2.dom).cats;
  if (cats.indexOf(KB2.bcat) < 0) KB2.bcat = cats[0];
  host.innerHTML = cats.map(function (c) {
    return '<button type="button" class="kbm-menu__i' + (c === KB2.bcat ? ' is-on' : '') + '"'
      + ' data-kb2menu="' + c + '" aria-pressed="' + (c === KB2.bcat) + '">' + c
      + '<span class="kbm-menu__n">' + kb2ByCat(c).length + '</span></button>';
  }).join('');
}

var KB2_LETTERS = ['all', '#', 'A-G', 'H-N', 'O-T', 'U-Z'];
function renderKb2Flt() {
  var host = $('#kbmFlt'); if (!host) return;
  var lbl = { all: '全部' };
  host.innerHTML = '<button type="button" class="kbm-tag' + (KB2.letter === 'all' ? ' is-on' : '') + '" data-kb2letter="all">全部</button>'
    + '<span class="kbm-flt__sp"></span>'
    + KB2_LETTERS.slice(1).map(function (L) {
      return '<button type="button" class="kbm-tag' + (KB2.letter === L ? ' is-on' : '') + '" data-kb2letter="' + L + '">' + L + '</button>';
    }).join('');
}

function renderKb2Words() {
  var host = $('#kbmWordList'); if (!host) return;
  var list = kb2ByCat(KB2.bcat).filter(function (t) { return KB2.letter === 'all' || kb2Letter(t.n) === KB2.letter; });
  host.innerHTML = list.length
    ? list.map(function (t) { return kb2CellHTML(t, 0); }).join('')
    : '<div class="kbm-empty">该分类暂无此字母区间的词条</div>';
}

function renderKb2Detail() {
  var t = KB2.cur, host = $('#kbmDetail');
  if (!t || !host) return;
  $('#kbmDetailT').textContent = t.n;
  var cm = $('#kbmCrumbMode');
  if (cm) cm.textContent = KB2.from === 'search' ? '检索' : '浏览';
  var secs, fi = 0;
  if (t.brief) {
    secs = [['简介', [['简介', t.brief]]]];
  } else {
    /* f 数组按分组顺序连续取值：跨组累加下标，不能每组都从 0 起 */
    secs = (KB2_FIELDS[t.cat] ? KB2_FIELDS[t.cat].sec : []).map(function (g) {
      var rows = g.slice(1).map(function (lab) { return [lab, (t.f || [])[fi++] || '暂无补充']; });
      return [g[0], rows];
    });
  }
  var html = '<div class="kbm-dsec"><div class="kbm-dsec__t">基本信息</div>'
    + '<div class="kbm-drow"><span>中文名称</span><div>' + esc(t.n) + (t.isNew ? ' <span class="tag tag--ok">新增</span>' : '') + '</div></div>'
    + '<div class="kbm-drow"><span>英文名称</span><div>' + esc(t.en || '—') + '</div></div>'
    + '<div class="kbm-drow"><span>其它名称</span><div>' + esc(t.alias || '—') + '</div></div>'
    + '<div class="kbm-drow"><span>所属知识域</span><div>' + esc(kb2DomDef(t.dom).n) + '</div></div>'
    + '<div class="kbm-drow"><span>所属分类</span><div>' + esc(t.cat) + '</div></div>'
    + '<div class="kbm-drow"><span>知识状态</span><div><span class="tag ' + (KB2_STCLS[t.status] || '') + '">' + (KB2_ST[t.status] || '已发布') + '</span>'
    + ' <span class="text-ink3">更新于 ' + esc(t.upd || '—') + '</span></div></div></div>';
  (secs || []).forEach(function (g) {
    html += '<div class="kbm-dsec"><div class="kbm-dsec__t">' + esc(g[0]) + '</div>'
      + g[1].map(function (p) { return '<div class="kbm-drow"><span>' + esc(p[0]) + '</span><div>' + esc(p[1]) + '</div></div>'; }).join('')
      + '</div>';
  });
  /* ---- v36 四域差异化区块 ---- */
  /* ★临床诊疗：病历/诊疗路径/疾病指南沉淀的标准化临床实践规则 */
  if (t.rules) {
    html += '<div class="kbm-dsec"><div class="kbm-dsec__t">标准化临床实践规则</div>'
      + t.rules.map(function (r) {
        return '<div class="kbm-rule"><span class="tag tag--brand">' + esc(r[0]) + '</span>'
          + '<div class="kbm-rule__bd">' + esc(r[1]) + '</div>'
          + '<span class="kbm-rule__src">来源：' + esc(r[2]) + '</span></div>';
      }).join('') + '</div>';
  }
  /* 生物样本：组织样本 → 检测指标 → 实验结果 的样本溯源链 */
  if (t.trace) {
    html += '<div class="kbm-dsec"><div class="kbm-dsec__t">样本溯源链</div>'
      + '<div class="kbm-trace">'
      + t.trace.map(function (s, i) {
          return (i ? '<span class="kbm-trace__a">' + ico('arrow-right') + '</span>' : '')
            + '<span class="kbm-trace__n"><span class="kbm-trace__i">' + (i + 1) + '</span>' + esc(s) + '</span>';
        }).join('')
      + '</div>'
      + '<div class="mt-2"><button type="button" class="btn btn--sm" data-go="gene">'
      + ico('dna') + '在样本档案中查看原始数据</button></div></div>';
  }
  /* 多组学：基因组 / 蛋白组 / 代谢组 关联网络（点击关联词条互相跳转） */
  if (t.net) {
    html += '<div class="kbm-dsec"><div class="kbm-dsec__t">跨组学关联网络</div><div class="kbm-net">'
      + ['基因组', '蛋白组', '代谢组'].map(function (k) {
          var arr = t.net[k] || [];
          return '<div class="kbm-net__col"><div class="kbm-net__k">' + k + '</div>'
            + (arr.length
              ? arr.map(function (n) { return '<button type="button" class="kbm-net__i" data-kb2term="' + esc(n) + '">' + esc(n) + '</button>'; }).join('')
              : '<span class="text-ink3">本队列暂无直接关联</span>')
            + '</div>';
        }).join('')
      + '</div></div>';
  }
  /* 权威文献：指南 / 期刊 / 共识的结构化提炼 */
  if (t.refs) {
    html += '<div class="kbm-dsec"><div class="kbm-dsec__t">文献结构化提炼</div>'
      + t.refs.map(function (r) {
          return '<div class="kbm-rule"><span class="tag tag--hint">' + esc(r[0]) + '</span>'
            + '<div class="kbm-rule__bd"><div>' + esc(r[1]) + '</div>'
            + '<div class="kbm-rule__src">' + esc(r[2]) + '</div></div>'
            + '<span class="tag ' + (r[3] && r[3].indexOf('一级') > -1 ? 'tag--ok' : 'tag--warn') + '">' + esc(r[3] || '—') + '</span></div>';
        }).join('') + '</div>';
  }
  /* 与既有知识条目（KB_STORE）的关联：按标题/标签命中，复用「查看原文要点」弹窗 */
  var kbl = KB_STORE.filter(function (it) {
    return it.t.indexOf(t.n) > -1 || (it.tags || []).some(function (x) { return t.n.indexOf(x) > -1 && x.length > 1; });
  });
  html += '<div class="kbm-dsec"><div class="kbm-dsec__t">关联知识条目</div>'
    + (kbl.length
      ? '<div class="stack">' + kbl.map(function (it) {
          return '<button type="button" class="kbrow kbrow--mini" data-kbopen="' + it.id + '">'
            + '<span class="kbrow__t">' + esc(it.t) + '</span>'
            + '<span class="kbrow__s">' + it.id + ' · ' + (KB_CATS[it.cat] ? KB_CATS[it.cat].n : '') + ' · 证据 ' + it.ev + ' 条</span></button>';
        }).join('') + '</div>'
      : '<p class="text-[12.5px] text-ink3">暂无直接关联的知识条目。</p>')
    + '</div>';
  host.innerHTML = html;
}

function renderKb2() {
  var page = $('#page-kbmed'); if (!page) return;
  /* 详情视图盖过一切；否则按模式三选一 */
  var inDetail = !!KB2.cur;
  $('#kbmDetailView').hidden = !inDetail;
  $('#kbmSearchView').hidden = inDetail || KB2.mode !== 'search';
  $('#kbmBrowseView').hidden = inDetail || KB2.mode !== 'browse';
  var admView = $('#kbmAdminView');
  if (admView) admView.hidden = inDetail || KB2.mode !== 'admin';
  var domBar = $('#kbmDom');
  if (domBar) domBar.hidden = inDetail;
  $$('#page-kbmed .seg__b[data-kb2mode]').forEach(function (b) {
    var on = b.getAttribute('data-kb2mode') === KB2.mode;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  if (inDetail) { renderKb2Detail(); return; }
  renderKb2Dom();
  if (KB2.mode === 'browse') { renderKb2Menu(); renderKb2Flt(); renderKb2Words(); return; }
  if (KB2.mode === 'admin') { renderKb2Admin(); return; }
  /* 检索模式：有未关闭的检索结果就保住结果态，回位清空 */
  var hasRes = !$('#kbmSearchRes').hidden;
  if (!hasRes) { renderKb2Cloud(); renderKb2Recent(); }
}

/* ---- v36 管理视图：知识全生命周期（采集 → 审核 → 发布 → 更新 → 归档） ---- */
function kb2Counts() {
  var c = { draft: 0, review: 0, pub: 0, arch: 0 };
  KB2_TERMS.forEach(function (t) { c[t.status] = (c[t.status] || 0) + 1; });
  return c;
}
function renderKb2Admin() {
  var pipe = $('#kbmPipe'), tbody = $('#kbmAdmTbl tbody'), flt = $('#kbmAFlt');
  if (!pipe || !tbody) return;
  var c = kb2Counts();
  pipe.innerHTML = [['draft', '采集', 'inbox'], ['review', '待审核', 'hourglass-half'], ['pub', '已发布', 'circle-check'], ['arch', '已归档', 'box-archive']]
    .map(function (s, i) {
      return (i ? '<span class="kbm-pipe__a">' + ico('arrow-right') + '</span>' : '')
        + '<div class="kbm-pipe__n' + (i === 2 ? ' is-pub' : '') + '"><span class="kbm-pipe__v">' + c[s[0]] + '</span>'
        + '<span class="kbm-pipe__k">' + s[1] + '</span>'
        + '<span class="kbm-pipe__d">' + ico(s[2]) + '知识' + (i === 0 ? '采集入库' : i === 3 ? '沉淀归档' : '流转') + '</span></div>';
    }).join('');
  /* 状态筛选 */
  if (flt) {
    var AF = [['all', '全部'], ['draft', '采集'], ['review', '待审核'], ['pub', '已发布'], ['arch', '已归档']];
    flt.innerHTML = AF.map(function (f) {
      return '<button type="button" class="kbm-tag' + (KB2.afilt === f[0] ? ' is-on' : '') + '" data-kb2afilt="' + f[0] + '">' + f[1] + '</button>';
    }).join('');
  }
  var list = KB2_TERMS.filter(function (t) { return KB2.afilt === 'all' || t.status === KB2.afilt; });
  /* v54 权限：流转动作分两类 ——「提交审核」（draft→review，动作码 review）是新增
     流程的一环，普通用户也能做；其余（审核发布 / 归档 / 修订 / 恢复）都是审批动作，
     只有超级管理员与普通管理员能做。不能做时**不隐藏按钮**，只 disabled + 说明原因：
     隐藏会让人以为功能没做或页面坏了。 */
  var canApr = canManage();
  tbody.innerHTML = list.length ? list.map(function (t) {
    var act = KB2_FLOW[t.status];
    var lcBtn = function (lc, label, ic) {
      var dis = lc !== 'review' && !canApr;
      return '<button type="button" class="btn btn--sm btn--quiet"'
        + ' data-kb2lc="' + lc + '" data-kb2id="' + esc(t.n) + '"'
        + (dis ? ' disabled title="当前身份（' + roleName() + '）不能审批：审核发布、归档与恢复需「普通管理员」及以上"' : '')
        + '>' + ico(ic) + label + '</button>';
    };
    var opCell = t.status === 'pub'
      ? lcBtn('upd', '修订', 'pen') + lcBtn('arch', '归档', 'box-archive')
      : lcBtn(act[0], act[1], 'arrow-right');
    return '<tr>'
      + '<td class="text-left"><span class="sampid">' + esc(t.n) + '</span>' + (t.isNew ? ' <span class="tag tag--ok">新增</span>' : '') + '</td>'
      + '<td>' + esc(kb2DomDef(t.dom).n) + '</td>'
      + '<td>' + esc(t.cat) + '</td>'
      + '<td><span class="tag ' + (KB2_STCLS[t.status] || '') + '">' + (KB2_ST[t.status] || '已发布') + '</span></td>'
      + '<td>' + esc(t.upd || '—') + '</td>'
      + '<td>' + opCell + '</td></tr>';
  }).join('') : '<tr><td colspan="6" class="text-ink3">该状态下暂无词条</td></tr>';
  /* 提示条跟着身份走：能审批时整条收起（不留一句无用的警告） */
  var ah = $('#kbmAprHint'), ar = $('#kbmAprRole');
  if (ah) ah.hidden = canApr;
  if (ar) ar.textContent = roleName();
}

function runKb2Search() {
  var q = ($('#kb2Q') && $('#kb2Q').value || '').replace(/^\s+|\s+$/g, '');
  if (!q) { toast('请先输入要检索的内容', 'warn'); return; }
  var cat = $('#kb2Cat') ? $('#kb2Cat').value : '全部';
  KB2.q = q; KB2.cat = cat;
  var hits = KB2_TERMS.filter(function (t) {
    return t.dom === KB2.dom && (cat === '全部' || t.cat === cat) && kb2Hits(t, q);
  });
  $('#kbmSearchHome').hidden = true;
  $('#kbmSearchRes').hidden = false;
  $('#kb2Count').textContent = String(hits.length);
  $('#kbmResList').innerHTML = hits.length
    ? hits.map(function (t) { return kb2CellHTML(t, 1, true); }).join('')
    : '<div class="alert alert--info" style="grid-column:1/-1"><span class="alert__ico">' + ico('circle-info') + '</span><div class="alert__bd">'
      + '<div class="alert__t">没有匹配「' + esc(q) + '」的词条</div>'
      + '<p class="alert__p">换个更宽的关键词，或点「返回」回知识库首页浏览。</p>'
      + '<div class="alert__act"><button type="button" class="btn btn--sm btn--primary" data-kb2clear>返回</button></div>'
      + '</div></div>';
  toast(hits.length ? '检索「' + q + '」命中 ' + hits.length + ' 个词条' : '检索「' + q + '」没有命中', hits.length ? 'ok' : 'warn');
}

/* 新增知识：附件上传约束（纯前端模拟：只记录文件名与大小，不做真实上传） */
var KB2_NEW_FILES = [];      /* 已选附件 {name, size} */
var KB2_DRAFT = null;        /* 提交审核提醒期间的表单暂存（返回修改时还原） */
var KB2_FILE_MAX = 100 * 1024 * 1024;   /* 单个附件 ≤100MB */
var KB2_FILE_NMAX = 20;                 /* 最多 20 个附件 */
function kb2RenderFiles() {
  var host = $('#kb2NewFileList'); if (!host) return;
  host.innerHTML = KB2_NEW_FILES.length
    ? KB2_NEW_FILES.map(function (f, i) {
        return '<div class="kbm-up__f">' + ico('paperclip')
          + '<span class="kbm-up__n">' + esc(f.name) + '</span>'
          + '<span class="kbm-up__s">' + fmtSize(f.size) + '</span>'
          + '<button type="button" class="kbm-up__x" data-kb2fdel="' + i + '" aria-label="移除 ' + esc(f.name) + '">&times;</button></div>';
      }).join('')
    : '<div class="kbm-up__empty">尚未选择附件，可直接提交文字信息</div>';
  var cnt = $('#kb2NewFileCnt');
  if (cnt) cnt.textContent = KB2_NEW_FILES.length + ' / ' + KB2_FILE_NMAX + ' 个';
}
/* ============================================================
   知识采集（v40）：① 选知识域 → ② 选采集方式 → ③ 表单按域生长
   为什么必须分两段：四个知识域在「基本信息」之外挂的模块完全不同 ——
   临床诊疗是一组实践规则、生物样本是一条溯源链、多组学是一张关联网络、
   权威文献是一份结构化提炼。四套模板摞在同一张表单里，用户每次都得先判断
   哪一半跟他无关；而先定域，屏上就只剩跟他有关的字段。
   为什么「手动填写 / 上传」互斥：它们不是两个开关，而是两条路径。
   走了上传，绝大部分手填字段就退化成「补充说明」；两者同时出现时，
   用户没法判断该填哪一份 —— 于是干脆都不填。
   采集到的差异字段推进 KB2_TERMS 后，详情页那份「四域差异化区块」
   （renderKb2Detail）照原样渲染 —— 采什么就能看到什么，不用另写一版展示。
   ============================================================ */
var KBC = null;      /* 采集会话：null 表示没在采 */
var KBC_WAY = [
  { id: 'manual', n: '手动填写', i: 'pen',
    d: '逐项填结构化字段，适合单条结论或已整理好的内容', tip: '填完即入库为「采集」状态' },
  { id: 'upload', n: '上传文件', i: 'file-arrow-up',
    d: '上传病历 / 检测记录 / 文献，由审核环节逐条确认', tip: '入库后先在附件里留痕' }
];
/* 每域采自此表中的那一段：key 与词条字段同名，序列化的地方只认这一个表，
   加一个新域就改这一处 —— 详情页的渲染lain*读的是同一个 key。 */
var KBC_MOD = {
  clin:  { t: '标准化临床实践规则', i: 'list-check', key: 'rules',
           hint: '按编号、规则内容、依据来源逐条登记；留至少要有一条。' },
  samp:  { t: '样本溯源链', i: 'diagram-successor', key: 'trace',
           hint: '按「组织样本 → 检测指标 → 实验结果」的次序填环节，留空会在详情页显示为链断。' },
  omics: { t: '跨组学关联网络', i: 'circle-nodes', key: 'net',
           hint: '三个层面各填关联词条名，逗号分隔；详情页面馍專avigation可在词条之间跳转。' },
  lit:   { t: '文献结构化提炼', i: 'file-lines', key: 'refs',
           hint: '登记发布机构、年份、核心推荐与证据等级，用于详情页的「文献结构化提炼」区块。' }
};
/* 上传方式下每个域该传什么：accept 与提示都按域定制 ——
   给做劃组学的人看「请上传病历」和给临床医生看「请上传表达矩阵」一样离谱。 */
var KBC_UP = {
  clin:  { acc: '.pdf,.doc,.docx,.txt', fmts: '诊疗路径 / 病历模板 DOC、指南 PDF',
           d: '系统从文中抽取候选实践规则（编号 · 内容 · 依据），由审核环节逐条定责。' },
  samp:  { acc: '.xlsx,.xls,.csv,.tsv', fmts: '检测记录 XLSX / CSV',
           d: '系统按样本编号对齐检测指标与实验结果，生成溯源链草稿。' },
  omics: { acc: '.csv,.tsv,.h5ad,.vcf,.vcf.gz', fmts: '表达矩阵 / 变异 VCF / 单细胞 h5ad',
           d: '系统按注释库匹配基因、蛋白、代谢物，生成跨组学关联草稿。' },
  lit:   { acc: '.pdf,.doc,.docx', fmts: '文献 PDF、指南 DOC',
           d: '系统抽取标题、机构、年份与推荐条目，证据等级由审核人确认。' }
};

function kbcInit(domId) {
  KBC = {
    step: 1, dom: domId || null, way: '', files: [],
    base: { cat: '', nm: '', en: '', alias: '', brief: '' },
    rules: [['', '', '']],            /* clin：编号 / 内容 / 依据 */
    trace: ['', '', ''],              /* samp：三个环节 */
    net: { '基因组': '', '蛋白组': '', '代谢组': '' },   /* omics */
    refs: ['', '', '', '']            /* lit：类型 / 标题 / 来源 / 等级 */
  };
  KB2_NEW_FILES = [];
  return KBC;
}
/* 收值：DOM 是唯一现场，重画前必须先把当前屏上的输入收回来。
   少收一次就表现为「换个选项回来，刚才填的没了」 —— 这类 bug 很难联想去重画逻辑。 */
function kbcHarvest() {
  if (!KBC) return;
  var b = KBC.base;
  if ($('#kbcCat')) b.cat = fv('#kbcCat');
  if ($('#kbcName')) b.nm = fv('#kbcName');
  if ($('#kbcEn')) b.en = fv('#kbcEn');
  if ($('#kbcAlias')) b.alias = fv('#kbcAlias');
  if ($('#kbcBrief')) b.brief = fv('#kbcBrief');
  if (KBC.dom === 'clin') {
    KBC.rules = $$('#kbcRules .kbc-row').map(function (r) {
      var i = [].slice.call(r.querySelectorAll('.kbc-in'));
      return [String(i[0].value || '').trim(), String(i[1].value || '').trim(), String(i[2].value || '').trim()];
    });
    if (!KBC.rules.length) KBC.rules = [['', '', '']];
  }
  if (KBC.dom === 'samp') {
    KBC.trace = $$('#kbcTrace .kbc-in').map(function (i) { return String(i.value || '').trim(); });
  }
  if (KBC.dom === 'omics') {
    ['基因组', '蛋白组', '代谢组'].forEach(function (k) {
      var el = $('[data-kbcnet="' + k + '"]');
      if (el) KBC.net[k] = String(el.value || '').trim();
    });
  }
  if (KBC.dom === 'lit') {
    KBC.refs = $$('#kbcLit .kbc-in').map(function (i) { return String(i.value || '').trim(); });
  }
}
function kbcModBody() {
  if (!KBC || !KBC.dom || KBC.way !== 'manual') return '';
  var m = KBC_MOD[KBC.dom];
  var h = '<div class="kbc-mod"><div class="kbc-mod__hd">' + ico(m.i) + '<span>' + m.t + '</span></div>'
    + '<p class="text-[12px] text-ink3 mt-2 mb-3">' + esc(m.hint) + '</p>';
  if (KBC.dom === 'clin') {
    h += '<div id="kbcRules" class="stack">' + KBC.rules.map(function (r, i) {
      return '<div class="kbc-row" data-kbcrule="' + i + '">'
        + '<input class="inp kbc-in kbc-in--no" value="' + esc(r[0]) + '" placeholder="编号 如 R-C01">'
        + '<input class="inp kbc-in" value="' + esc(r[1]) + '" placeholder="规则内容">'
        + '<input class="inp kbc-in" value="' + esc(r[2]) + '" placeholder="依据来源">'
        + '<button type="button" class="kbc-del" data-kbcrule-del="' + i + '" aria-label="删除这条规则">&times;</button>'
        + '</div>';
    }).join('') + '</div>'
      + '<div class="mt-2"><button type="button" class="btn btn--sm btn--quiet" data-kbcrule-add>'
      + ico('plus') + '再加一条规则</button></div>';
  }
  if (KBC.dom === 'samp') {
    var L = ['① 组织样本', '② 检测指标', '③ 实验结果'];
    h += '<div id="kbcTrace" class="grid3">' + L.map(function (x, i) {
      return '<div class="fld"><label class="fld__l">' + x + '</label>'
        + '<input class="inp kbc-in" value="' + esc(KBC.trace[i] || '') + '"'
        + ' placeholder="' + (i === 0 ? '如：肝穿刺组织' : i === 1 ? '如：AFP 血清学检测' : '如：AFP 412 ng/mL') + '"></div>';
    }).join('') + '</div>';
  }
  if (KBC.dom === 'omics') {
    h += '<div class="grid3">' + ['基因组', '蛋白组', '代谢组'].map(function (k) {
      return '<div class="fld"><label class="fld__l">' + k + '关联</label>'
        + '<input class="inp kbc-in" data-kbcnet="' + k + '" value="' + esc(KBC.net[k] || '') + '"'
        + ' placeholder="关联词条，逗号分隔"></div>';
    }).join('') + '</div>';
  }
  if (KBC.dom === 'lit') {
    var LP = ['文献类型', '标题 / 核心推荐', '发布机构与年份', '证据等级'];
    h += '<div id="kbcLit" class="grid2">' + LP.map(function (x, i) {
      return '<div class="fld"><label class="fld__l">' + x + '</label>'
        + '<input class="inp kbc-in" value="' + esc(KBC.refs[i] || '') + '"'
        + ' placeholder="' + (i === 0 ? '指南 / 期刊文献 / 专家共识' : i === 3 ? '一级推荐 / 强推荐' : '') + '"></div>';
    }).join('') + '</div>';
  }
  return h + '</div>';
}
function kbcUpBody() {
  if (!KBC || !KBC.dom || KBC.way !== 'upload') return '';
  var u = KBC_UP[KBC.dom];
  return '<div class="kbc-mod"><div class="kbc-mod__hd">' + ico('file-arrow-up') + '<span>上传与解析</span></div>'
    + '<div class="kbm-up mt-3">'
    +   '<input type="file" id="kb2NewFiles" class="sr" multiple accept="' + u.acc + '">'
    +   '<button type="button" class="btn btn--sm" data-kb2fpick>' + ico('upload') + '选择文件</button>'
    +   '<span class="kbm-up__hint">' + esc(u.fmts) + ' · 单个不超过 100MB，最多 20 个</span>'
    +   '<span class="kbm-up__cnt" id="kb2NewFileCnt"></span>'
    + '</div><div id="kb2NewFileList" class="kbm-up__list"></div>'
    + '<p class="text-[12px] text-ink3 mt-2 mb-0">' + esc(u.d) + '</p></div>';
}
function kbcBody() {
  if (!KBC) return '';
  var stepDom = '<div class="kbc-steps">'
    + '<span class="kbc-step' + (KBC.step === 1 ? ' is-on' : '') + '"><b>1</b>选择知识域</span>'
    + '<span class="kbc-step__a">' + ico('arrow-right') + '</span>'
    + '<span class="kbc-step' + (KBC.step === 2 ? ' is-on' : '') + '"><b>2</b>选择方式并填写</span>'
    + '</div>';
  if (KBC.step === 1) {
    return stepDom + '<div class="gd__opts kbc-doms">'
      + KB2_DOMS.map(function (d) {
          var n = KB2_TERMS.filter(function (t) { return t.dom === d.id; }).length;
          return '<button type="button" class="gd__opt" data-kbc-dom="' + d.id + '">'
            + '<span class="gd__opt-n">' + (d.star ? '★ ' : '') + esc(d.n) + '</span>'
            + '<span class="gd__opt-m">已有 ' + n + ' 个词条 · 分类：' + esc(d.cats.join(' / ')) + '</span>'
            + '<span class="gd__opt-d">' + esc(d.d) + '</span></button>';
        }).join('') + '</div>';
  }
  /* 第 2 步：先选方式（互斥），再按「域 + 方式」长出剩下的模块 */
  var m = KBC_MOD[KBC.dom], u = KBC_UP[KBC.dom];
  return stepDom
    + '<div class="kbc-way"><span class="kbc-way__l">已选知识域</span>'
    + '<span class="tag tag--brand">' + esc(kb2DomDef(KBC.dom).n) + '</span>'
    + '<button type="button" class="btn btn--sm btn--quiet ml-auto" data-kbc-reset>'
    + ico('rotate-left') + '重选知识域</button></div>'
    + '<div class="gd__opts kbc-ways">'
    + KBC_WAY.map(function (w) {
        return '<button type="button" class="gd__opt' + (KBC.way === w.id ? ' is-on' : '') + '"'
          + ' data-kbc-way="' + w.id + '" aria-pressed="' + (KBC.way === w.id) + '">'
          + '<span class="gd__opt-n">' + ico(w.i) + w.n + '</span>'
          + '<span class="gd__opt-m">' + esc(w.tip) + '</span>'
          + '<span class="gd__opt-d">' + esc(w.d) + '</span></button>';
      }).join('')
    + '</div>'
    + (KBC.way
        ? '<div class="kbc-base mt-4">'
          + fldSel('kbcCat', '所属分类', optHTML(kb2DomDef(KBC.dom).cats, KBC.base.cat || kb2DomDef(KBC.dom).cats[0]))
          + fldInp('kbcName', '中文名称', KBC.base.nm, '例如：肝细胞癌', true)
          + fldInp('kbcEn', '英文名称', KBC.base.en, '选填')
          + fldInp('kbcAlias', '其它名称', KBC.base.alias, '选填，逗号分隔')
          + fldInp('kbcBrief', '简介', KBC.base.brief, '一句话说明该词条的核心内容')
          + '</div>'
          + kbcModBody() + kbcUpBody()
          + frmLegend()
        : '<div class="pd__empty mt-4">' + ico('hand-pointer')
          + '<span>先选一种采集方式：「手动填写」会展开「' + esc(m.t) + '」的结构化字段，'
          + '「上传文件」则按 ' + esc(u.fmts) + ' 走解析入库 —— 两者不会同时出现。</span></div>');
}
function kbcRender(keep) {
  if (!KBC) return;
  if (keep !== false) kbcHarvest();
  showModal('新增知识采集', kbcBody(),
    '<button type="button" class="btn" data-close="modal">取消</button>'
    + (KBC.step === 2 && KBC.way
        ? '<button type="button" class="btn" data-kbc-step="1">上一步</button>'
          + '<button type="button" class="btn btn--primary" data-kbc-ok>' + ico('circle-check') + '确认采集</button>'
        : ''));
  var fi = $('#kb2NewFiles');
  if (fi) fi.addEventListener('change', function () {
    var over = [], skip = 0;
    [].slice.call(this.files || []).forEach(function (f) {
      if (f.size > KB2_FILE_MAX) { over.push(f.name); return; }
      if (KB2_NEW_FILES.length >= KB2_FILE_NMAX) { skip++; return; }
      KB2_NEW_FILES.push({ name: f.name, size: f.size });
    });
    if (over.length) toast('以下文件超过 100MB 上限，已跳过：' + over.join('、'), 'warn');
    if (skip) toast('附件最多 ' + KB2_FILE_NMAX + ' 个，超出的 ' + skip + ' 个未加入', 'warn');
    this.value = '';
    kb2RenderFiles();
  });
  kb2RenderFiles();
}
function openKb2Add() { kbcInit(null); kbcRender(false); }

/* 采集口径的守卫：缺什么报什么，且报的是屏上那个模块的名字 ——
   「请填写」这种提示等于让用户自己去猜屏上哪一块还没填。 */
function kbcGuard() {
  if (!KBC || !KBC.dom) return '请先选择知识域';
  if (!KBC.way) return '请先选择采集方式：手动填写或上传文件';
  if (!KBC.base.nm) return '中文名称不能为空';
  if (KB2_TERMS.some(function (t) { return t.n === KBC.base.nm; })) return '已有同名词条「' + KBC.base.nm + '」';
  if (KBC.way === 'upload' && !KB2_NEW_FILES.length) return '「上传文件」方式下至少要传一个文件';
  if (KBC.way === 'manual' && KBC.dom === 'clin' && !KBC.rules.some(function (r) { return r[1]; })) {
    return '「' + KBC_MOD.clin.t + '」至少要有一条写出了内容的规则';
  }
  return '';
}
function commitKb2Add() {
  if (!KBC) return;
  kbcHarvest();
  var bad = kbcGuard();
  if (bad) { toast(bad, 'warn'); return; }
  var catsD = kb2DomDef(KBC.dom).cats;
  KB2_DRAFT = {
    dom: KBC.dom, way: KBC.way, cat: catsD.indexOf(KBC.base.cat) > -1 ? KBC.base.cat : catsD[0],
    nm: KBC.base.nm, en: KBC.base.en, alias: KBC.base.alias, brief: KBC.base.brief,
    files: KB2_NEW_FILES.slice(), mod: null
  };
  /* 差异模块打包成词条字段：key 写在 KBC_MOD 里（key 与详情页渲染读的字段名同名），
     这一段才不用为一域写一版 —— 换了 key 两边会一起坏，而不是悄悄各说一套。 */
  if (KBC.way === 'manual') {
    var key = KBC_MOD[KBC.dom].key;
    if (KBC.dom === 'clin') {
      KB2_DRAFT.mod = KBC.rules.filter(function (r) { return r[1]; })
        .map(function (r) { return [r[0] || '待编号', r[1], r[2] || '未注明来源']; });
    } else if (KBC.dom === 'samp') {
      KB2_DRAFT.mod = KBC.trace.filter(Boolean);
    } else if (KBC.dom === 'omics') {
      var net = {};
      ['基因组', '蛋白组', '代谢组'].forEach(function (k) {
        net[k] = (KBC.net[k] || '').split(/[,，、]/).map(function (s) { return s.trim(); }).filter(Boolean);
      });
      KB2_DRAFT.mod = net;
    } else if (KBC.dom === 'lit') {
      KB2_DRAFT.mod = [KBC.refs[0] || '未分类', KBC.refs[1] || KB2_DRAFT.nm,
                       KBC.refs[2] || '来源未注明', KBC.refs[3] || '—'];
    }
    KB2_DRAFT.modKey = key;
  }
  var wayN = (KBC_WAY.filter(function (w) { return w.id === KBC.way; })[0] || {}).n;
  showModal('进入审核提醒',
    '<div class="kbm-remind">'
    + '<div class="kbm-remind__t">' + ico('circle-info') + '采集信息已就绪</div>'
    + '<p class="kbm-remind__p">词条「' + esc(KBC.base.nm) + '」确认后将进入知识审核流程：'
    + '<b>采集入库 → 提交审核 → 审核发布</b>。</p>'
    + '<p class="kbm-remind__p">所属知识域 <b>' + esc(kb2DomDef(KBC.dom).n) + '</b> · 采集方式 <b>' + esc(wayN) + '</b>'
    + (KB2_DRAFT.mod ? ' · 已登记「' + esc(KBC_MOD[KBC.dom].t) + '」' : '')
    + ' · 随词条归档附件 ' + KB2_DRAFT.files.length + ' 个。</p>'
    + '</div>',
    '<button type="button" class="btn" data-kb2add-back>返回修改</button>'
    + '<button type="button" class="btn btn--primary" data-kb2add-final>' + ico('paper-plane') + '确认并进入审核</button>');
}
function commitKb2Final() {
  var d = KB2_DRAFT || {};
  var rec = {
    n: d.nm, en: d.en, alias: d.alias, dom: d.dom, cat: d.cat, isNew: true, status: 'draft', upd: '2026-09-28',
    brief: d.brief || (d.way === 'upload'
      ? '本词条由「上传文件」方式采集，内容将在审核环节从附件解析后补全。'
      : '本词条由「新增」入口创建，内容待完善。'),
    files: (d.files || []).map(function (f) { return f.name; })
  };
  /* 差异模块直接落成词条字段 —— 详情页读的就是这几个键，不需要中间层转译 */
  if (d.modKey) rec[d.modKey] = d.mod;
  KB2_TERMS.unshift(rec);
  KB2_DRAFT = null; KB2_NEW_FILES = []; KBC = null;
  $('#modal').hidden = true;
  KB2.mode = 'search'; KB2.dom = d.dom; KB2.cur = null;
  $('#kbmSearchRes').hidden = true; $('#kbmSearchHome').hidden = false;
  renderKb2();
  toast('「' + d.nm + '」已采集入库并进入审核流程，可在「管理」中提交审核', 'ok');
}
/* 验证探针：词条总数（新增用例的前后差值断言用，不写死契约数） */
window.__kb2Count = function () { return KB2_TERMS.length; };
/* 验证清场：撤掉新增用例产生的词条、回到默认态（截图与文案守卫不受残留影响） */
window.__kb2Reset = function () {
  for (var i = KB2_TERMS.length - 1; i >= 0; i--) if (KB2_TERMS[i].isNew) KB2_TERMS.splice(i, 1);
  KB2.mode = 'search'; KB2.dom = 'clin'; KB2.cat = '全部'; KB2.q = ''; KB2.bcat = '疾病'; KB2.letter = 'all'; KB2.afilt = 'all'; KB2.cur = null; KB2.from = 'browse';
  KB2_DRAFT = null; KB2_NEW_FILES = []; KBC = null;
  /* 封面 / 简介 / 显示状态的三种修改也是用例产生的副作用，一并复原 ——
     截图用例拍到「隐藏了 3 条」的公开数据集卡，下一条用例会平白无故变红。 */
  DEMO_DS.forEach(function (d, ix) {
    var def = DEMO_DS_DEF[ix] || {};
    d.intro = def.intro == null ? '' : def.intro;
    d.img = def.img || '';
    d.show = def.show !== false;
  });
  renderPubGroups();
  if ($('#kb2Q')) $('#kb2Q').value = '';
  $('#kbmSearchRes').hidden = true; $('#kbmSearchHome').hidden = false;
  renderKb2();
};
/* 验证探针：生命周期四态计数（不写死契约数用） */
window.__kb2St = function () { return kb2Counts(); };

/* v58 验证探针：知识赋能三页的「外部系统 / 站内版本」视图。
   不传 view = 纯读当前视图；传了就切过去并返回切完后的状态。
   verify 的知识库采集段要在站内视图下量内容（默认态是外部视图），
   段首段尾各调一次 —— 这是共享页内状态，漏还原会污染后面几十条断言。 */
window.__kbView = function (id, view) {
  if (view) setKbView(id, view);
  var page = $('#page-' + id);
  var frame = page ? page.querySelector('.kbframe') : null;
  var local = page ? page.querySelector('[data-kblocal]') : null;
  var el = frame ? frame.querySelector('[data-kbframeel]') : null;
  return {
    id: id,
    mode: page ? page.getAttribute('data-kbview') : '(none)',
    frameShown: !!(frame && !frame.hidden),
    localHidden: !!(local && local.hidden),
    src: el ? (el.getAttribute('src') || '') : ''
  };
};

/* 验证探针：知识采集会话的状态（不传参 = 纯读，不会推动流程）。
   返回的不只是状态位，还有「屏上此刻有哪些模块」——「两种采集方式不同时出现」
   这条要求的断言就长在这几个数字上：手动=1 且上传=0，反过来也一样。 */
window.__kbc = function (act, arg) {
  if (act === 'dom' && arg) { if (!KBC) kbcInit(arg); else KBC.dom = arg; KBC.step = 2; kbcRender(false); return true; }
  if (act === 'way' && arg) { kbcHarvest(); KBC.way = arg; kbcRender(false); return true; }
  if (act === 'step' && arg) { kbcHarvest(); KBC.step = parseInt(arg, 10) || 1; kbcRender(false); return true; }
  if (act === 'fill') {
    kbcHarvest();
    if (arg && arg.name) KBC.base.nm = arg.name;
    if (arg && arg.cat) KBC.base.cat = arg.cat;
    if (arg && arg.rules) KBC.rules = arg.rules;
    if (arg && arg.trace) KBC.trace = arg.trace;
    if (arg && arg.net) ['基因组', '蛋白组', '代谢组'].forEach(function (k) { KBC.net[k] = arg.net[k] || ''; });
    if (arg && arg.refs) KBC.refs = arg.refs;
    kbcRender(false);
    return true;
  }
  if (act === 'file') { KB2_NEW_FILES.push({ name: arg, size: 1024 }); kbcRender(false); return true; }
  if (act === 'submit') { commitKb2Add(); return !$('#modal').hidden; }
  if (!KBC) return { open: false };
  var mOpen = !$('#modal').hidden;
  var step1OfPrompt = $$('#modalB .pd__empty').length;
  return {
    open: mOpen, step: KBC.step, dom: KBC.dom, way: KBC.way, wayPicked: !!KBC.way,
    /* 屏上到底几种采集形式、几个差异模块 —— 互斥性就靠这两个数 */
    ways: $$('#modalB [data-kbc-way]').length,
    waysOn: $$('#modalB [data-kbc-way].is-on').length,
    manualBox: $$('#modalB .kbc-mod').filter(function (e) { return /手动|填写/.test(e.textContent); }).length,
    upBox: $$('#modalB input[type=file]').length,
    baseN: $$('#modalB .kbc-base .fld').length,
    modN: $$('#modalB .kbc-mod').length,
    modKey: KBC.dom && KBC.way === 'manual' ? KBC_MOD[KBC.dom].key : null,
    modTitle: ($$('#modalB .kbc-mod__hd')[0] || {}).textContent || '',
    ruleN: $$('#modalB .kbc-row').length,
    files: KB2_NEW_FILES.length,
    beforePick: step1OfPrompt,
    title: ($('#modalT') || {}).textContent || '',
    foot: $$('#modalF button').map(function (b) { return b.textContent.trim(); })
  };
};

function renderKbNodes() {
  var host = $('#kbNodes');
  if (host) host.textContent = JSON.stringify(KB_NODES);
  renderKbPanel(KB_CUR.node);
}

function renderKbPanel(node) {
  var host = $('#kbPanel'); if (!host) return;
  var k = KB_NODES[node] || KB_NODES['S037'];
  KB_CUR.node = node;
  /* 该实体关联的知识条目：按标签命中 */
  var hits = KB_STORE.filter(function (it) {
    return it.tags.some(function (t) { return t.indexOf(node) > -1 || node.indexOf(t) > -1; }) || it.t.indexOf(node) > -1;
  });
  host.innerHTML = ''
    + '<div class="row"><span class="tag tag--brand">' + k[0] + '</span><span class="card__t">' + node + '</span></div>'
    + '<p class="pbody mt-3">' + k[1] + '</p>'
    + '<div class="krrow mt-3"><span>关联证据条数</span><span class="num">' + k[2] + '</span></div>'
    + '<div class="hr"></div>'
    + '<div class="card__t mb-2">知识库中的引用</div>'
    + (hits.length
      ? '<div class="stack">' + hits.map(function (it) {
          return '<button class="kbrow kbrow--mini" data-kbopen="' + it.id + '">'
            + '<span class="kbrow__t">' + it.t + '</span>'
            + '<span class="kbrow__s">' + it.id + ' · ' + (KB_CATS[it.cat] ? KB_CATS[it.cat].n : '') + ' · 证据 ' + it.ev + ' 条</span>'
            + '</button>';
        }).join('') + '</div>'
      : '<p class="text-[12.5px] text-ink3">该实体暂无直接引用的知识条目。</p>')
    + '<div class="hr"></div>'
    + '<div class="row"><button class="btn btn--sm btn--primary btn--block" data-toast="已把「' + node + '」加入本次科研线索清单（共 1 个实体）">'
    + ico('lightbulb') + ' 加入科研线索</button></div>';
}

function selectKbNode(node) {
  $$('#kbGraph .gnode').forEach(function (g) { g.classList.toggle('is-on', g.getAttribute('data-kbnode') === node); });
  renderKbPanel(node);
}

/* 与知识图谱页 #nodeSteps 的显示文本逐字对应；这里只用来算进度动画的时长与步数。
   曾经沿用的是「机器学习建模」的步骤名（数据接入 / 特征工程 / 模型选择 / 超参调优），
   属于已删除的建模口径残留 —— 知识图谱重建不该跑建模步骤。 */
var NODE_STEPS = ['文献解析', '实体识别', '关系抽取', '一致性校验', '图嵌入', '索引生效'];
var stageTimers = [];
function playNodeBuild() {
  var sw = $('#graphBuild'); if (!sw) return;
  stageTimers.forEach(clearTimeout); stageTimers = [];
  $$('#nodeSteps .qrow').forEach(function (r, i) {
    var n = r.querySelector('.qpos');
    n.className = 'qpos'; n.textContent = String(i + 1);
    r.querySelector('[data-ns]').textContent = '等待中';
  });
  sw.setAttribute('aria-checked', 'true');
  NODE_STEPS.forEach(function (_, i) {
    stageTimers.push(setTimeout(function () {
      $$('#nodeSteps .qrow').forEach(function (r, k) {
        var n = r.querySelector('.qpos'), t = r.querySelector('[data-ns]');
        if (k < i) { n.className = 'qpos is-ok'; n.textContent = '✓'; t.textContent = '完成'; }
        else if (k === i) { n.className = 'qpos qpos--me'; n.textContent = String(k + 1); t.textContent = '进行中…'; }
      });
    }, i * 420));
  });
  stageTimers.push(setTimeout(function () {
    $$('#nodeSteps .qrow').forEach(function (r) {
      var n = r.querySelector('.qpos'), t = r.querySelector('[data-ns]');
      n.className = 'qpos is-ok'; n.textContent = '✓'; t.textContent = '完成';
    });
    sw.setAttribute('aria-checked', 'false');
    toast('已按最新入库知识重建图谱：实体节点 14 个 · 关系边 14 条', 'ok');
  }, NODE_STEPS.length * 420 + 200));
}

/* ============================================================
   路由 / 侧栏 / 面包屑
   ============================================================ */
/* 页面标题的唯一来源：与各页 <h1 class="phead__h1"> 逐字一致。
   左栏导航与顶栏面包屑都读这里 —— 免得出现「导航写流程选择、标题写流程模板」两套叫法。 */
var PAGES = {
  p01: '工作台', gene: '样本档案', files: '文件管理',
  p02: '数据汇集', p04: '流程模板',
  p05: '参数配置', p06: '任务运行', p07: '查看分析结果',
  proj: '项目管理',
  /* v40：dataset 从菜单里撤了。它不是第 14 项而是项目的一层：见 PDTABS 里的
     ['dataset', '数据集', 'database']。PAGES 里也不再留它 —— 留着就等于留一个
     谁也点不到、又没人负责同步的死页面。 */
  /* v39：项目详情从右侧抽屉升为独立页面（对齐参考系统的「项目概况」）。
     它不进左栏菜单 —— 它是从项目列表钻进去的一层，左栏那一格仍然指回列表。 */
  projdetail: '项目概况',
  kbmed: '医学知识库', kbown: '自有知识库', kbgraph: '知识图谱',
  log: '运行日志',
  /* v47 需求 3：项目组管理（系统管理组）。它管的是新建项目那个「所属项目组」
     下拉里的名单，与「示例数据集」同属管理员才碰的一层。 */
  projgroup: '项目组管理',
  /* v40：内置示例数据集的设置页（需求 2）。放在系统管理组下，与运行日志同级 ——
     它们都是「管理员才看」的一层，不是业务流程上的一步。 */
  pubds: '示例数据集',
  /* 样本管理保留页面与数据，但本轮不进左栏菜单（用户回复「另安排」）。
     留在 PAGES 里，hash 直达与面包屑才不会断。 */
  sample: '样本管理'
};
/* stepper 是窄条进度指示，用短名；与 PAGES 同指一步，不是两套概念。
   v37：删掉「样本对齐」这一步 —— 样本 ID 对齐是数据汇集后的自动动作，
   不该占用户一个点头的节点（需求 3）。
   v42：删掉「结果全景」这一步 —— 它已经不是这条线上的一个步骤，而是项目详情的
   一层（需求 1）。删掉后 p06 恰好仍是第 4 步（原来是 4/5），所以各页
   data-stepper 的值一个都不用动。
   v51：把结果那一步以「查看分析结果」的名字请回来当第 5 步。v42 那个判断
   （一条分析线到「任务运行」就算走完）在真实使用里站不住：任务跑完，人接下来要做的
   恰恰是**看这批数据算出了什么**，而不是先退出这条线、回项目列表、再钻进去找。
   做法不是复制一份结果全景，而是把同一个 #panoTpl 挂到第二个宿主上（见 mountPano）——
   这条线的第 5 步与项目详情那一层从此是同一份内容，改一处两边都变。 */
var STEPS = [
  ['数据汇集', 'p02'], ['流程模板', 'p04'],
  ['参数配置', 'p05'], ['任务运行', 'p06'],
  ['查看分析结果', 'p07']
];

function currentPage() {
  var on = $('.page.is-on');
  return on ? on.id.replace('page-', '') : 'p01';
}

function renderStepper() {
  $$('[data-stepper]').forEach(function (host) {
    var cur = parseInt(host.getAttribute('data-stepper'), 10);
    host.innerHTML = STEPS.map(function (s, i) {
      var n = i + 1;
      var cls = 'stepper__i' + (n === cur ? '' : n < cur ? ' is-done' : '');
      var attrs = n === cur ? ' aria-current="step"' : '';
      return '<button class="' + cls + '"' + attrs + ' data-go="' + s[1] + '">'
        + '<span class="stepper__n">' + (n < cur ? '✓' : n) + '</span>' + s[0] + '</button>'
        + (n < STEPS.length ? '<span class="stepper__sep">' + ico('chevron-right') + '</span>' : '');
    }).join('');
  });
}

/* 左栏（工具库 / 工作流）的显示开关。
   RAIL_LOCK：用户手动点过切换按钮后置 true，此后不再自动改，避免与用户选择打架。 */
var RAIL_LOCK = false;

function setRail(on) {
  var sh = $('.shell');
  if (!sh) return;
  sh.classList.toggle('is-railoff', !on);
  /* 同一个状态类也挂到 .app 上：顶栏左段的深色块与 logo 配色靠它切换
     （见 app.css 的 .app.is-railoff）。不用 :has(.shell.is-railoff) —— 
     少一层浏览器能力依赖，选择器也更好读。 */
  var ap = $('.app');
  if (ap) ap.classList.toggle('is-railoff', !on);
  var sv = $('#snav');
  if (sv) sv.setAttribute('aria-hidden', on ? 'false' : 'true');
  var b = $('[data-rail-toggle]');
  if (b) b.setAttribute('aria-expanded', on ? 'true' : 'false');
}

function stepIndexOf(id) {
  for (var i = 0; i < STEPS.length; i++) { if (STEPS[i][1] === id) return i; }
  return -1;
}

/* ---------- 页面导航：面包屑（界面唯一的返回入口）+ 来路栈（状态内省） ---------- */
/* 界面上已无「返回上一步」按钮 —— 回上级一律走面包屑，跨菜单靠左栏。
   来路栈仍然维护：goto() 压栈、goBack() 出栈、goHome() 清栈，
   面包屑的「工作台」段刻意不清栈。它现在只供 __navState 内省与自动化归零用，
   不再有对应的界面控件（见 REF-界面定稿.md「返回导航」）。 */
var NAVHIST = [], NAVCUR = '', NAVSILENT = false;
var NAVMAX = 40;

/* 分组本身不是一个页面（点它没有落点），所以退到该组第一项。
   「智能分析 → 数据汇集」「知识赋能 → 医学知识库」都符合直觉。 */
function navGroupFirst(g) {
  for (var i = 0; i < NAVGROUPS.length; i++) {
    if (NAVGROUPS[i].g === g && NAVGROUPS[i].items.length) return NAVGROUPS[i].items[0].id;
  }
  return '';
}

/* 面包屑：变长生成。祖先段（工作台 / 所属分组）可点，当前页不可点。
   段数随页面变化 —— 「工作台」是根，它自己就是页面，所以只有站在别的页面上时
   它才作为祖先段出现；此前用「空组名 + CSS :empty 收起箭头」表达同一件事，
   要绕两圈才能读懂，改成不生成那一段后 DOM 即真相。 */
function navGroupOf(name) {
  for (var i = 0; i < NAVGROUPS.length; i++) {
    if (NAVGROUPS[i].g === name) return NAVGROUPS[i];
  }
  return null;
}

/* 面包屑上**真实存在**的可点段，以及各段的落点。
   renderCrumb 按它生成；验证脚本也直接读它（__crumbSegs），
   这样「面包屑能到哪」可以从外部独立算一遍，而不是把产品里的判据照抄一遍。 */
/* v39：「钻进去的一层」页面（不在左栏菜单里，只能从某一页点进去）。
   它们的祖宗不是某个分组，而是**进去的那一页**，面包屑要如实这么写：
   工作台 › 项目管理 › 项目概况。
   不写成「工作台 › 项目空间 › 项目概况」——分组的落点就是项目管理页，
   两个可点段指向同一个地方，用户点哪个都一样，等于摆一个假选项。 */
var DRILL = { projdetail: { t: '项目管理', id: 'proj' } };

function crumbSegs(id) {
  var segs = [];
  /* 起点自己是根、上面没有可回的地方 → 不生成这一段 */
  if (id !== 'p01') segs.push({ k: 'home', t: '工作台', id: 'p01' });
  var dr = DRILL[id];
  if (dr) {
    segs.push({ k: 'pg', t: dr.t, id: dr.id });
    return segs;
  }
  var hit = navItemOf(id);
  if (hit && hit.g) {
    var g = navGroupOf(hit.g);
    /* 两种「死段」不生成（点下去就是当前页，等于一个点了没反应的按钮）：
       ① 该分组只有一个页面；② 当前页就是该组首项。
       「哪一段不该出现」靠不生成来表达 —— 骨架里留个死段比没有它更糟。 */
    if (g && g.items.length > 1 && g.items[0].id !== id) {
      segs.push({ k: 'grp', t: hit.g, id: g.items[0].id });
    }
  }
  return segs;
}

function renderCrumb(id) {
  var bar = $('#crumbBar');
  if (!bar) return;
  var si = stepIndexOf(id), atHome = (id === 'p01'), h = [];

  crumbSegs(id).forEach(function (s) {
    if (s.k === 'home') {
      h.push('<button type="button" class="crumb__l" id="crumbHome" data-go="' + s.id + '"'
        + ' title="返回' + esc(s.t) + '">' + esc(s.t) + '</button>');
    } else if (s.k === 'pg') {
      h.push('<button type="button" class="crumb__l" id="crumbParent" data-go="' + s.id + '"'
        + ' title="返回' + esc(s.t) + '">' + esc(s.t) + '</button>');
    } else {
      h.push('<button type="button" class="crumb__l crumb__g" id="crumbGrp" data-crumbgrp="'
        + esc(s.t) + '" title="返回「' + esc(s.t) + '」首页">' + esc(s.t) + '</button>');
    }
    h.push(ico('chevron-right', 'crumb__sep'));
  });

  h.push('<span class="crumb__c" id="crumb" aria-current="page">' + esc(PAGES[id] || '') + '</span>');

  /* 主流程页给「步骤 n/6」，工作台给「总览」，其余页面（管理页 / 知识页）不给 ——
     它们不在流程上，硬凑一个步骤号反而误导。 */
  var st = (si >= 0) ? ('步骤 ' + (si + 1) + ' / ' + STEPS.length) : (atHome ? '总览' : '');
  h.push('<span class="crumb__step" id="crumbStep"' + (st ? '' : ' hidden') + '>'
    + (st || '') + '</span>');

  bar.innerHTML = h.join('');
}

function goBack() {
  if (!NAVHIST.length) return;
  var prev = NAVHIST.pop();
  /* 出栈后再 goto：此时 NAVSILENT 阻止 goto 把当前页重新压回去 */
  NAVSILENT = true;
  goto(prev);
  NAVSILENT = false;
}

/* 「回到起点」= 回工作台**并清空来路**。界面上没有入口（回工作台走面包屑那一段，
   而它刻意不清栈）。保留下来给验证脚本把状态归零 —— 每条导航用例都从确定的
   {cur:'p01', hist:[]} 开始，否则断言时好时坏、失败原因还看着像产品缺陷。 */
function goHome() {
  NAVHIST.length = 0;
  NAVSILENT = true;
  goto('p01');
  NAVSILENT = false;
}

function goto(id, opts) {
  var page = $('#page-' + id);
  if (!page) return;
  /* 来路入栈必须在切换之前：压的是「离开的那一页」 */
  if (!NAVSILENT && NAVCUR && NAVCUR !== id) {
    NAVHIST.push(NAVCUR);
    if (NAVHIST.length > NAVMAX) NAVHIST.shift();
  }
  NAVCUR = id;

  $$('.page').forEach(function (p) { p.classList.remove('is-on'); });
  page.classList.add('is-on');

  /* 面包屑由当前页重算 —— 它是界面上唯一的「我在哪、能从哪回」呈现 */
  renderCrumb(id);
  renderNavOn(id);
  /* 全屏是「就地放大」：一旦跳去别的页面就必须收起，否则它会盖住新页面。
     样本详情抽屉同理 —— 它是某一页的浮层，跳走了还挂在右侧就成了幽灵面板。 */
  toggleOrchFull(false);
  toggleWbFull(false);
  closeSampDrawer();

  /* 左栏是**每个页面都该在**的导航外壳 —— 它同时回答「我在哪」与「我能去哪」，
     所以一个页面不该在到达时把自己的导航藏起来；想收，由用户点收起按钮决定。
     名单里只剩一个例外：样本管理（sample）。它不在左栏菜单里（用户回复「另安排」），
     主内容又是宽表，收起来不影响任何一格的高亮。
     v49：运行日志从这个名单里摘掉。它是「系统管理」组里的**菜单项之一** ——
     到了就自动收起左栏，等于把「你正站着的这一格」也一起藏了，
     看上去就是整页进了全屏、左栏不见了。
     v28：项目管理出于同一条理由先摘掉过。
     v40：dataset 从名单里撤了 —— 但它已不是页面，宽表改在项目概况页签里。
     于是得到一条规则：**菜单里有的页，不自动收左栏。**
     样本管理哪天进菜单，它也要从这一行里摘掉。
     用户手动切过（RAIL_LOCK）之后就不再自动改，避免与用户选择打架。 */
  if (!RAIL_LOCK) {
    setRail(id !== 'sample');
  }
  if (opts && opts.view) setView(opts.view);
  /* 智能分析第 5 步（v51）：进页面时把结果全景挂上。
     与项目详情那一层是**同一个动作、同一份内容** —— mountPano 保证两个宿主里
     同时只有一个有东西，所以来回切不会出现两份。
     必须放在页面拿到 is-on 之后：图表按 .chartbox 的实际宽度画，
     藏在 display:none 的页里量到 0 宽，画出来是挤成一条线的图。 */
  if (id === 'p07') mountPano('#resMount', PANO_VIEW);
  /* 任务运行页（v52）：把「运行分析」时补的项目信息复述出来。
     直接进这一页（没走过那一步）时 renderRunMetaBar 会把这条收起来 ——
     条上那些字段本来就还没有值。 */
  if (id === 'p06') renderRunMetaBar();
  /* 项目概况（v39）：进页面时按「要看哪个项目」重画一次。
     没带项目号（比如从 hash 直达 / 面包屑回来的路上）就沿用上一次看的那一个，
     实在没有则退到当前项目 —— 页面不能出现「空白的项目概况」。 */
  if (id === 'projdetail') {
    if (opts && opts.proj && projById(opts.proj)) PROJ_DETAIL_ID = opts.proj;
    PDTAB = (opts && opts.pdt) || 'info';
    /* 三个入口各带各的参数：页签（pdt）、左栏分栏（psec）、模块下标（pmod）。
       pmod 优先 —— 它同时决定了要停在「分析结果」那一栏上。 */
    PDSEC = (opts && opts.pdt) ? pdtHostOfTab(opts.pdt) : ((opts && opts.psec) || 'info');
    if (opts && opts.pmod !== undefined && opts.pmod !== null) {
      PDSEC = 'result';
      PDMOD = Math.max(0, parseInt(opts.pmod, 10) || 0);
    }
    renderProjDetail(PROJ_DETAIL_ID || (curProj() || PROJECTS[0] || {}).id);
  }
  /* 项目组管理（v47）：进页面按当前数据重画一次 —— 别处（向导 / 审核）改过名单时，
     这一页不该停在上一次的快照上。 */
  if (id === 'projgroup') renderProjGroups();
  var snav = $('#snav'); if (snav) snav.classList.remove('is-open');
  /* 正文现在有自己的滚动容器（.content），重置它而不是窗口 */
  var pane = $('#content'); if (pane) pane.scrollTop = 0; else window.scrollTo({ top: 0, behavior: 'auto' });
  /* file:// 下 history.replaceState 可能抛 SecurityError，不能让它中断导航 */
  try { if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id); } catch (err) { /* 忽略 */ }

  /* 进页面时按当前上下文重算告警：告警是「队列非空」这类事实的结果，
     不是谁点出来的。 */
  syncAnoms();
}

function setView(v) {
  $$('.rview').forEach(function (p) { p.classList.toggle('is-on', p.getAttribute('data-view') === v); });
  $$('#viewSeg .seg__b').forEach(function (b) {
    var on = b.getAttribute('data-view') === v;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

/* ============================================================
   提示条
   ============================================================ */
function toast(msg, kind) {
  var box = $('#toasts');
  if (!box) return;
  var el = document.createElement('div');
  el.className = 'toast' + (kind ? ' toast--' + kind : '');
  var icon = kind === 'ok' ? 'circle-check' : kind === 'warn' ? 'triangle-exclamation' : 'circle-info';
  el.innerHTML = '<span class="toast__i">' + ico(icon) + '</span><span>' + msg + '</span>';
  box.appendChild(el);
  setTimeout(function () {
    el.style.transition = 'opacity .25s';
    el.style.opacity = '0';
    setTimeout(function () { el.remove(); }, 260);
  }, 3200);
}

/* ============================================================
   弹窗
   ============================================================ */
/* 底栏可替换：纯说明类弹窗给「知道了」，表单/分享类给「取消 + 提交」。
   写死「知道了」的话新建项目没地方放提交按钮。 */
function showModal(t, b, f) {
  var T = $('#modalT'), B = $('#modalB'), F = $('#modalF');
  if (!T || !B || !F) return;
  T.textContent = t;
  B.innerHTML = b;
  F.innerHTML = f || '<button type="button" class="btn btn--primary" data-close="modal">知道了</button>';
  $('#modal').hidden = false;
}

/* ============================================================
   事件绑定
   ============================================================ */
document.addEventListener('click', function (e) {
  var t;

  /* 通用：页面内滚动定位 */
  if ((t = e.target.closest('[data-scroll]'))) {
    var a0 = document.querySelector('[data-anchor="' + t.getAttribute('data-scroll') + '"]');
    if (a0) a0.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  /* 通用：前往页面 */
  /* 左栏分组折叠（必须先于 [data-go]，两者互斥但顺序更稳） */
  if ((t = e.target.closest('[data-navgrp]'))) {
    toggleNavGrp(t.getAttribute('data-navgrp'));
    return;
  }

  /* 面包屑的分组段：分组没有落点，退到该组第一项 */
  if ((t = e.target.closest('[data-crumbgrp]'))) {
    var ngG = t.getAttribute('data-crumbgrp'), ngTo = navGroupFirst(ngG);
    if (ngTo) goto(ngTo);
    return;
  }

  if ((t = e.target.closest('[data-go]'))) {
    var id = t.getAttribute('data-go');
    if (t.id === 'btnResult' && t.getAttribute('aria-disabled') === 'true') { toast('任务还没结束，稍等一下', 'warn'); return; }
    goto(id, { view: t.getAttribute('data-view') });
    /* 携带实体名时，跳转后滚动到知识图谱并同步选中该节点 */
    var nd = t.getAttribute('data-kbnode');
    if (nd) setTimeout(function () {
      selectKbNode(nd);
      var g = $('#kbGraph'); if (g) g.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    return;
  }

  /* 知识赋能：医学知识库分类筛选与检索 / 图谱节点 / 原文要点 / 自有知识库上传解析 */
  /* 知识赋能 · 医学知识库（v36：检索/浏览/管理三模式 + 四知识域 + 生命周期） */
  if ((t = e.target.closest('[data-kb2mode]'))) {
    var m0 = t.getAttribute('data-kb2mode');
    if (KB2.mode !== m0) {
      KB2.mode = m0; KB2.cur = null; KB2.q = '';
      if ($('#kb2Q')) $('#kb2Q').value = '';
      $('#kbmSearchRes').hidden = true; $('#kbmSearchHome').hidden = false;
      renderKb2();
    }
    return;
  }
  if ((t = e.target.closest('[data-kb2dom]'))) {
    var d0 = t.getAttribute('data-kb2dom');
    if (KB2.dom !== d0) {
      KB2.dom = d0;
      var cats0 = kb2DomDef(d0).cats;
      KB2.cat = '全部'; KB2.letter = 'all'; KB2.afilt = 'all';
      if (cats0.indexOf(KB2.bcat) < 0) KB2.bcat = cats0[0];
      if ($('#kb2Q')) $('#kb2Q').value = '';
      $('#kbmSearchRes').hidden = true; $('#kbmSearchHome').hidden = false;
      KB2.cur = null;
      renderKb2();
      toast('已切换到「' + kb2DomDef(d0).n + '」知识域', 'ok');
    }
    return;
  }
  if ((t = e.target.closest('[data-kb2afilt]'))) {
    KB2.afilt = t.getAttribute('data-kb2afilt');
    renderKb2Admin();
    return;
  }
  /* 生命周期流转：提交审核 / 审核发布 / 归档 / 修订（pub→review）/ 恢复（arch→pub）。
     v54：审批类动作在这里也要挡一次 —— 视觉态只是 disabled，脚本与键盘仍点得进来，
     只有委托里挡是可信的。「提交审核」（review）不算审批，放行。 */
  if ((t = e.target.closest('[data-kb2lc]'))) {
    var t1 = KB2_TERMS.filter(function (x) { return x.n === t.getAttribute('data-kb2id'); })[0];
    if (!t1) return;
    var lc = t.getAttribute('data-kb2lc');
    if (lc !== 'review' && !canManage()) {
      toast('当前身份（' + roleName() + '）没有审批权限：审核发布、归档与恢复需「普通管理员」及以上', 'warn');
      return;
    }
    var msgs = {
      review: '「' + t1.n + '」已提交审核，进入待审核清单',
      pub: '「' + t1.n + '」审核通过并发布，已进入检索与浏览视图',
      arch: '「' + t1.n + '」已归档沉淀，可在已归档状态下恢复',
      upd: '「' + t1.n + '」已提交修订，回到待审核；审核发布后完成知识更新'
    };
    var wasArch = t1.status === 'arch';
    if (lc === 'pub') t1.status = 'pub';        /* 审核发布 或 归档恢复 */
    else if (lc === 'upd') t1.status = 'review';
    else t1.status = lc;                         /* draft→review / pub→arch */
    t1.upd = '2026-09-26';
    renderKb2();
    toast(lc === 'pub' && wasArch ? '「' + t1.n + '」已恢复发布' : (msgs[lc] || '状态已更新'), lc === 'arch' ? 'warn' : 'ok');
    return;
  }
  if ((t = e.target.closest('[data-kb2search]'))) { runKb2Search(); return; }
  if ((t = e.target.closest('[data-kb2clear]'))) {
    KB2.q = '';
    if ($('#kb2Q')) $('#kb2Q').value = '';
    $('#kbmSearchRes').hidden = true; $('#kbmSearchHome').hidden = false;
    renderKb2();
    return;
  }
  if ((t = e.target.closest('[data-kb2menu]'))) {
    KB2.bcat = t.getAttribute('data-kb2menu'); KB2.letter = 'all';
    renderKb2();
    return;
  }
  if ((t = e.target.closest('[data-kb2letter]'))) {
    KB2.letter = t.getAttribute('data-kb2letter');
    renderKb2();
    return;
  }
  if ((t = e.target.closest('[data-kb2term]'))) {
    var t0 = KB2_TERMS.filter(function (x) { return x.n === t.getAttribute('data-kb2term'); })[0];
    if (t0) {
      KB2.cur = t0; KB2.from = KB2.mode;
      renderKb2();
      $('#page-kbmed').scrollIntoView({ block: 'start' });
    }
    return;
  }
  if (e.target.closest('[data-kb2back]')) {
    KB2.cur = null;
    renderKb2();
    return;
  }
  if (e.target.closest('[data-kb2add]')) { openKb2Add(); return; }
  /* ---- v40 知识采集：先定域、再定方式、表单按域生长 ---- */
  if ((t = e.target.closest('[data-kbc-dom]'))) {
    if (!KBC) kbcInit(t.getAttribute('data-kbc-dom'));
    else KBC.dom = t.getAttribute('data-kbc-dom');
    KBC.step = 2;
    kbcRender(false);
    toast('已选知识域「' + kb2DomDef(KBC.dom).n + '」，接下来选一种采集方式', 'ok');
    return;
  }
  if ((t = e.target.closest('[data-kbc-way]'))) {
    kbcHarvest();
    KBC.way = t.getAttribute('data-kbc-way');
    kbcRender(false);
    return;
  }
  if (e.target.closest('[data-kbc-reset]')) {
    kbcHarvest();
    KBC.step = 1; KBC.way = '';
    kbcRender(false);
    return;
  }
  if ((t = e.target.closest('[data-kbc-step]'))) {
    kbcHarvest();
    KBC.step = parseInt(t.getAttribute('data-kbc-step'), 10) || 1;
    kbcRender(false);
    return;
  }
  if (e.target.closest('[data-kbcrule-add]')) {
    kbcHarvest();
    KBC.rules.push(['', '', '']);
    kbcRender(false);
    return;
  }
  if ((t = e.target.closest('[data-kbcrule-del]'))) {
    kbcHarvest();
    KBC.rules.splice(parseInt(t.getAttribute('data-kbcrule-del'), 10), 1);
    if (!KBC.rules.length) KBC.rules = [['', '', '']];
    kbcRender(false);
    return;
  }
  if (e.target.closest('[data-kb2fpick]')) { var f0 = $('#kb2NewFiles'); if (f0) f0.click(); return; }
  if ((t = e.target.closest('[data-kb2fdel]'))) {
    var fi2 = parseInt(t.getAttribute('data-kb2fdel'), 10);
    if (fi2 > -1 && fi2 < KB2_NEW_FILES.length) { KB2_NEW_FILES.splice(fi2, 1); kb2RenderFiles(); }
    return;
  }
  /* 返回修改：KBC 会话还活着（审核提醒那一步没清它），直接回到第 2 步。
     换成「重新 new 一个会话」的话，用户发现分类选错得从头再选一遍域。 */
  if (e.target.closest('[data-kb2add-back]')) { if (KBC) { KBC.step = 2; kbcRender(false); } return; }
  if (e.target.closest('[data-kb2add-final]')) { commitKb2Final(); return; }
  if (e.target.closest('[data-kbc-ok]')) { commitKb2Add(); return; }
  if ((t = e.target.closest('[data-kbnode]'))) { selectKbNode(t.getAttribute('data-kbnode')); return; }
  if ((t = e.target.closest('[data-kbopen]'))) {
    var it0 = KB_STORE.filter(function (x) { return x.id === t.getAttribute('data-kbopen'); })[0];
    if (it0) {
      showModal(it0.t, '<p class="pbody">' + it0.s + '</p>'
        + '<div class="row mt-3"><span class="tag tag--brand">' + (KB_CATS[it0.cat] ? KB_CATS[it0.cat].n : '知识') + '</span>'
        + '<span class="tag">来源：' + it0.src + '</span>'
        + '<span class="tag ' + (it0.conf === '高' ? 'tag--ok' : 'tag--warn') + '">证据强度 ' + it0.conf + '</span>'
        + '<span class="tag tag--hint ml-auto">' + it0.id + '</span></div>'
        + '');
    }
    return;
  }
  if ((t = e.target.closest('[data-kbupload]'))) { kbParse(t); return; }

  /* 规划中模块 */
  if ((t = e.target.closest('[data-soon]'))) {
    toast(t.getAttribute('data-soon') + '：本期范围外，已在 PRD 第 8 章列为后续阶段', 'warn');
    return;
  }

  /* 切换身份（v54）：顶栏当前用户菜单里那三个选项。
     匹配属性是 data-user-role —— **不能**用 [data-role]：body 自身也带
     data-role，那样会连 body 一起匹配、在这里提前 return，其后的处理器
     全部失效（v53 之前 .rolesw__b 分支的注释就记着这个坑）。 */
  if ((t = e.target.closest('[data-user-role]'))) {
    var k0 = t.getAttribute('data-user-role');
    var pu0 = $('#popUser'); if (pu0) pu0.hidden = true;
    var ua = $('#userSw'); if (ua) ua.setAttribute('aria-expanded', 'false');
    setRole(k0);
    return;
  }

  /* 异常演示 */
  if ((t = e.target.closest('[data-anom]'))) { showAnom(t.getAttribute('data-anom')); return; }

  /* 异常修复动作 */
  if ((t = e.target.closest('[data-fix]'))) {
    var idx = parseInt(t.getAttribute('data-fix'), 10);
    var a = anomCtx; if (!a) return;
    var act = a.acts[idx];
    if (act.note) return;
    /* 「降级快速模式」这类动作要真的把任务跑起来：点了没动静就是假按钮 */
    if (act.run) {
      CTX.queued = 0;
      hideAnom('#anomP06');
      toast(act.msg || act.t, 'ok');
      startRun();
      return;
    }
    var lv = 'ok', body;
    if (act.preview) {
      body = '<div class="alert alert--ok"><span class="alert__ico">' + ico('circle-check') + '</span><div class="alert__bd">'
        + '<div class="alert__t"><span class="alert__tag">已处理</span>' + act.t + ' — 填充前后对比</div>'
        + '<div class="tblwrap mt-3"><table class="tbl"><thead><tr><th>指标</th><th>处理前</th><th>处理后</th></tr></thead><tbody>'
        + act.preview.map(function (x, i) {
            var p = x.split('→');
            var before = i === 0 ? '27.3%' : i === 1 ? '61,842 个' : '—';
            return '<tr><td>' + (i === 0 ? '缺失率' : i === 1 ? '基因数' : '说明') + '</td><td class="num">' + before + '</td><td class="num">' + (p[1] || '').trim() + '</td></tr>';
          }).join('')
        + '</tbody></table></div>'
        + '<ul class="mt-3 text-[12.5px] text-ink2" style="padding-left:18px">' + act.preview.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'
        + '<div class="alert__act"><button class="btn btn--sm btn--primary" data-toast="已按所选方案处理，可以继续下一步" data-continue="1">用这个方案继续</button>'
        + '<button class="btn btn--sm btn--quiet" data-anom="missing">换个方案</button></div>'
        + '</div></div>';
    } else {
      body = '<div class="alert alert--ok"><span class="alert__ico">' + ico('circle-check') + '</span><div class="alert__bd">'
        + '<div class="alert__t"><span class="alert__tag">已处理</span>' + (act.msg || act.t) + '</div>'
        + '<div class="alert__act"><button class="btn btn--sm" data-toast="已记录本次操作到运行溯源">查看溯源记录</button></div>'
        + '</div></div>';
    }
    var host = anomHost;
    if (host) host.querySelector('.card__bd').innerHTML = body;
    toast(act.msg || act.t, 'ok');
    return;
  }

  /* 表格内动作 */
  if ((t = e.target.closest('[data-tbl-act]'))) { toast(t.getAttribute('data-tbl-act'), 'ok'); return; }

  /* 抽屉 */
  if ((t = e.target.closest('[data-drawer]'))) { openDrawer(); return; }
  if ((t = e.target.closest('[data-close="trace"]')) || e.target.id === 'backTrace') { closeDrawer(); return; }

  /* 弹窗 */
  if ((t = e.target.closest('[data-modal]'))) {
    var m = MODALS[t.getAttribute('data-modal')];
    if (m) showModal(m.t, m.b);
    return;
  }
  if ((t = e.target.closest('[data-close="modal"]'))) {
    $('#modal').hidden = true;
    PNEW = null;                      /* 关掉即丢弃向导草稿，下次打开是干净的一屏 */
    KBC = null;                       /* v40：知识采集会话同理 —— 半个会话留在内存里，下次开是新域却是旧方式 */
    return;
  }

  /* 弹出层（任务中心 / 当前用户菜单） */
  if ((t = e.target.closest('[data-pop]'))) {
    var p = document.getElementById(t.getAttribute('data-pop'));
    p.hidden = !p.hidden;
    if (t.hasAttribute('aria-expanded')) t.setAttribute('aria-expanded', p.hidden ? 'false' : 'true');
    e.stopPropagation();
    return;
  }
  if (!e.target.closest('.pop')) {
    var pp = $('#popTask'); if (pp) pp.hidden = true;
    var pu = $('#popUser'); if (pu) pu.hidden = true;
    var ua0 = $('#userSw'); if (ua0) ua0.setAttribute('aria-expanded', 'false');
  }

  /* 提示条 -->
  /* 数据表替代视图 */
  if ((t = e.target.closest('[data-alt]'))) {
    var box = document.getElementById(t.getAttribute('data-alt'));
    if (box) box.hidden = !box.hidden;
    return;
  }
  /* v62：图表设置面板 / 图表数据表下载 */
  if ((t = e.target.closest('[data-chart-set]'))) { openChartSet(t); return; }
  if ((t = e.target.closest('[data-tbl-dl]'))) { tblDownload(t); return; }
  /* 下载入口：先弹确认框，确认后才真的产出文件 */
  if ((t = e.target.closest('[data-dl]'))) { dlOpen(t.getAttribute('data-dl'), t); return; }
  if (e.target.closest('[data-dl-go]')) {
    $('#modal').hidden = true;
    if (DL_PEND) { var dbo = DL_PEND; DL_PEND = null; dlSave(dbo); toast('已开始下载「' + dbo.name + '」', 'ok'); }
    return;
  }

  /* 工具抽屉：运行前先过一遍必填项。
     标了「*」就要真的拦得住 —— 否则「必填」只是句装饰：把参考基因组索引进度清空
     一样能点「运行此工具」。拦下来时把焦点送回第一个没填的字段，用户不用自己找。 */
  if (e.target.closest('[data-tool-run]')) {
    var REQ_TOOL = [['tp-r1', 'FASTA/Q file #1'], ['tp-ref', '参考基因组索引前缀']];
    var miss = REQ_TOOL.filter(function (p) {
      var el = $('#' + p[0]); return el && !String(el.value || '').trim();
    });
    if (miss.length) {
      var f0 = $('#' + miss[0][0]);
      toast('还有 ' + miss.length + ' 个必填项没填：' + miss.map(function (p) { return p[1]; }).join('、'), 'warn');
      if (f0) f0.focus();
      return;
    }
  }

  if ((t = e.target.closest('[data-toast]'))) {
    if (t.hasAttribute('data-continue')) { goto('p04'); return; }
    toast(t.getAttribute('data-toast'), 'ok');
    return;
  }

  /* 分析类型卡片：选中它的同时把画布换成对应的流程 ——
     原先这里只换个高亮，画布却固定停在某一条上，同屏两个「已选流程」互相打架。 */
  if ((t = e.target.closest('[data-pipe]'))) {
    if (t.getAttribute('aria-disabled') === 'true') {
      toast('代谢组流程不可用：当前数据集缺少 .mzML 质谱文件，可先加载示例质谱数据', 'warn');
      return;
    }
    $$('#pipelineGrid .pcard').forEach(function (c) { c.classList.remove('is-on'); });
    t.classList.add('is-on');
    var _k = t.getAttribute('data-pipe');
    var nm = ANALYSIS_NAME[_k] || t.querySelector('.pcard__n').textContent.trim();
    var _fid = ANALYSIS_FLOW[_k];
    if (_fid && orchFlowById(_fid)) {
      loadFlow(_fid);
      renderOrch();
      toast('已选择分析类型：' + nm + '，画布已载入「' + orchFlowById(_fid).n + '」', 'ok');
    } else {
      toast('已选择分析类型：' + nm, 'ok');
    }
    return;
  }

  /* 首页数据集分组切换 */
  if ((t = e.target.closest('#dsSeg .seg__b'))) {
    var grp = t.getAttribute('data-dsgrp');
    $$('#dsSeg .seg__b').forEach(function (b) {
      var on = b === t;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    ['own', 'human', 'mouse'].forEach(function (k) {
      var el = $('#dsGroup-' + k);
      if (el) el.hidden = k !== grp;
    });
    return;
  }

  /* 内置公开数据集：首页点选后直接进入数据汇集页确认 */
  if ((t = e.target.closest('[data-pubds]'))) {
    loadPubDs(t.getAttribute('data-pubds'), !!t.closest('#page-p01'));
    return;
  }

  /* 参考基因组选用 / 不匹配提示的处置 */
  if ((t = e.target.closest('[data-refg]'))) { pickRef(t.getAttribute('data-refg'), true); return; }
  if (e.target.closest('[data-refkeep]')) {
    var rw = $('#refWarn'); if (rw) rw.hidden = true;
    toast('已保持当前参考基因组；提交任务时仍会二次确认物种一致性', 'warn');
    return;
  }

  /* 示例数据集（院内队列）：在工作台点选 = 默认开始分析项目流程，
     数据集载入数据汇集（p02）后直接落到流程模板（p04）；在 p02 内点选仍只就地载入。
     v37 删掉样本对齐这一步后，落点顺延到流水线的下一步 —— 中间那步已经不存在了。 */
  if ((t = e.target.closest('[data-pick]'))) {
    var name = t.getAttribute('data-pick');
    var fromHome = !!t.closest('#page-p01');
    var host = $('#fileCard');
    if (host) {
      host.hidden = false;
      $('#fileList').innerHTML = fileCardHTML({ name: 'TJ-TCM-2026_' + name.split(' ')[0] + '.tsv', detected_format: name, data_type: '示例数据集', sample_count: 75, size: '186 MB', quality: { missing_rate: 8.4, outlier_count: 312 } });
      $('#fileTag').className = 'tag tag--ok';
      $('#fileTag').textContent = '校验通过';
    }
    if (fromHome) {
      goto('p04');
      toast('已载入示例数据集：' + name + '（75 例样本）· 分析流程已开始，当前在流程模板', 'ok');
    } else {
      toast('已载入示例数据集：' + name + '（75 例样本）', 'ok');
    }
    return;
  }

  /* 数据汇集页 · 选数据（v50 需求 2）。整块交给 p02Act，
     分支名写在那一个函数里 —— 三个动作都在同一屏内，散开写没人能一眼看全。 */
  if ((t = e.target.closest('[data-p02]'))) { p02Act(t.getAttribute('data-p02'), t); return; }

  /* 模拟上传 */
  if ((t = e.target.closest('[data-upload]'))) {
    var kind = t.getAttribute('data-upload');
    var d = MOCK.upload(kind), host2 = $('#fileCard');
    if (host2) {
      host2.hidden = false;
      $('#fileList').innerHTML = fileCardHTML(d);
      $('#fileTag').className = 'tag tag--ok';
      $('#fileTag').textContent = '校验通过';
    }
    CTX.miss = d.quality.missing_rate;
    toast('已载入：' + d.detected_format + ' · ' + d.sample_count + ' 例样本 · 缺失率 ' + d.quality.missing_rate + '%', 'ok');
    return;
  }
  /* 拖拽区就是真的选本机文件：格式对不对，由你选的文件决定。
     v50：**点击整块不再打开文件选择框** —— 落点从「空空的拖拽区」变成了
     一个里面全是可点东西的选择区，点文件夹名 / 点空白处都弹系统文件框
     是很烦人的一种坏。本机文件改由「选择本机文件」那颗按钮负责，
     拖放仍然整块可用（见下面的 dragover / drop）。 */

  /* 配置模式 */
  if ((t = e.target.closest('[data-cfgmode]'))) {
    var mode = t.getAttribute('data-cfgmode');
    $$('[data-cfg]').forEach(function (c) { c.hidden = c.getAttribute('data-cfg') !== mode; });
    $$('[data-cfgmode]').forEach(function (b) {
      var on = b.getAttribute('data-cfgmode') === mode;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    return;
  }

  /* 左栏显示 / 隐藏 */
  if ((t = e.target.closest('[data-rail-toggle]'))) {
    var sh = $('.shell');
    var nowOff = sh && sh.classList.contains('is-railoff');
    RAIL_LOCK = true;
    setRail(nowOff);
    toast(nowOff ? '已展开左侧导航' : '已收起左侧导航，表格获得更多宽度', 'ok');
    return;
  }

  /* 结果视图切换 */
  if ((t = e.target.closest('#viewSeg .seg__b'))) { setView(t.getAttribute('data-view')); return; }

  /* 工具配置抽屉里的 paired / single 分段控件（只认抽屉，避免误吞编排区那组 seg） */
  if ((t = e.target.closest('.seg__b')) && t.closest('#drawerTool')) {
    Array.prototype.forEach.call(t.parentNode.children, function (b) {
      b.classList.toggle('is-on', b === t);
      b.setAttribute('aria-selected', b === t ? 'true' : 'false');
    });
    toolSummary($('#drawerTool'));
    return;
  }

  /* 运行分析（v52）：这条线不建项目就直接跑，所以先补一张「这批数据属于谁」的
     项目信息，确认之后才进任务运行页。
     **顺序是刻意的** —— 信息先落、再开跑；反过来（先跑起来再补）跑出结果那一刻
     系统里还是没归属。挂点从 [data-run] 换成 [data-runmeta]：留在原地的话，
     它会和任务运行页那颗「开始运行」共用一条分支，而两者要做的事已经不同了。
     注意 [data-run] 只剩 #btnRun 一个（任务页上的重跑），别把两者一起改。 */
  if ((t = e.target.closest('[data-runmeta]'))) { runMetaOpen(); return; }
  if (e.target.closest('[data-rmok]')) { runMetaConfirm(); return; }

  /* 运行 */
  if ((t = e.target.closest('[data-run]'))) {
    /* v63：排队态再点一次「开始执行」就直接开跑（排队提示只剩「请等待」）。 */
    if (CTX.queued > 0) { CTX.queued = 0; startRun(); return; }
    goto('p06');
    setTimeout(function () {
      /* 队列里还有任务就先排队：排队是提交的结果，不是一个开关 */
      if (QUEUE_JOBS > 0) submitRun(); else startRun();
    }, 260);
    return;
  }

  /* 分析范围：纳入多少样本由这里决定，样本量不足的告警也由此而来 */

  /* 取消任务 */
  if (e.target.closest('#btnCancel')) {
    var cb = $('#btnCancel');
    if (cb.getAttribute('aria-disabled') === 'true') return;
    if (runTimer) { clearInterval(runTimer); runTimer = null; }
    abortPipe();
    /* 取消之后「开始运行」要重新可点：提示语写的是「可随时重新提交」，
       按钮却还灰着，就成了同一件事的两种说法。 */
    $('#btnRun').removeAttribute('aria-disabled');
    $('#runTag').className = 'tag'; $('#runTag').innerHTML = ico('ban') + '已取消';
    toast('任务已取消。已输入的参数与已上传的数据都保留，可随时重新提交', 'warn');
    return;
  }

  /* 知识图谱页：重建图谱（必须在通用 .switch 之前，否则会被 toggle 逻辑吞掉） */
  if (e.target.closest('#graphBuild')) {
    if ($('#graphBuild').getAttribute('aria-checked') === 'true') return;
    playNodeBuild();
    return;
  }

  /* 角色/通知开关 */
  if ((t = e.target.closest('.switch'))) {
    var on2 = t.getAttribute('aria-checked') !== 'true';
    t.setAttribute('aria-checked', on2 ? 'true' : 'false');
    toast(on2 ? '任务完成后会通知你' : '已关闭完成通知');
    return;
  }
  if (e.target.closest('#logToggle')) {
    var lb = $('#logBox');
    if (lb.style.display === 'none') { lb.style.display = ''; $('#logToggle').textContent = '收起'; }
    else { lb.style.display = 'none'; $('#logToggle').textContent = '展开'; }
    return;
  }
  if (e.target.closest('[data-mobnav]')) { $('#snav').classList.toggle('is-open'); return; }

  /* ============ 外壳：抽屉 / 流程编排 / 工具与流程 ============ */
  /* 运行历史抽屉 */
  if (e.target.closest('[data-hist-toggle]')) { toggleHist(); return; }
  if (e.target.closest('[data-close="hist"]') || e.target.id === 'backHist') { toggleHist(false); return; }
  /* 工具配置抽屉 */
  if (e.target.closest('[data-close="tool"]') || e.target.id === 'backTool') { closeToolDrawer(); return; }
  /* 流程编排：来源切换（流程模板 / 工具库） */
  if ((t = e.target.closest('[data-orchseg]'))) { setOrchMode(t.getAttribute('data-orchseg')); return; }
  /* 编排区全屏放大 / 收起（v60：进入的是外部编排系统，站内画布在 bar 上换回来） */
  if (e.target.closest('[data-orch-full]')) {
    toggleOrchFull();
    var ofb = $('#orch');
    toast(ofb && ofb.classList.contains('is-full')
      ? '已全屏：外部编排系统已打开，可点「返回站内画布」换回流程画布'
      : '已退出全屏');
    return;
  }
  /* 外部编排系统：返回站内画布（同在全屏壳内，只换视图）/ 重新加载 */
  if (e.target.closest('[data-orchext-back]')) {
    setOrchExt(false);
    toast('已切回站内流程画布，仍在全屏状态；再点「收起」回到页面');
    return;
  }
  if (e.target.closest('[data-orchext-reload]')) { reloadOrchExt(); return; }
  /* 节点列表（DAG 的数据表替代视图） */
  if ((t = e.target.closest('[data-orch-alt]'))) {
    var ot = $('#orchTable');
    if (ot) {
      ot.hidden = !ot.hidden;
      t.setAttribute('aria-expanded', ot.hidden ? 'false' : 'true');
    }
    return;
  }
  /* 卡头「重置」：丢掉自编排的节点，回到模板原样 */
  if (e.target.closest('[data-orch-reset]')) {
    var _base = orchFlowById(CANVAS.base);
    var _cut = _base ? CANVAS.nodes.length - _base.nodes.length : 0;
    resetCanvas();
    toast(_cut > 0
      ? '已重置：撤掉自编排的 ' + _cut + ' 个节点，回到「' + (_base ? _base.n : '模板') + '」'
      : '当前画布就是「' + (_base ? _base.n : '模板') + '」原样，没有需要撤的改动');
    return;
  }
  /* 底部「另存为新模板」：填名称 → 固化进 FLOWS，左侧列表随即多一条 */
  if (e.target.closest('[data-orch-save]')) { openSaveFlowModal(false); return; }
  if (e.target.closest('[data-orch-save-run]')) { openSaveFlowModal(true); return; }
  if (e.target.closest('[data-flow-save-ok]')) { commitSaveFlow(); return; }
  if (e.target.closest('[data-node-ins-ok]')) { commitNodeInsert(); return; }
  if ((t = e.target.closest('[data-node-ins]'))) {
    openNodeInsert(Number(t.getAttribute('data-node-ins'))); return;
  }
  if ((t = e.target.closest('[data-node-del]'))) {
    var _di = Number(t.getAttribute('data-node-del'));
    var _gone = deleteNode(_di);
    if (_gone) toast('已删除节点「' + _gone + '」，下游连线已重新接上', 'ok');
    return;
  }
  /* 「运行此流程」：有未保存改动时先提醒另存为新模板 */
  if (e.target.closest('[data-orch-run]')) { runOrchFlow(); return; }
  /* 工具分类折叠 */
  if ((t = e.target.closest('[data-tcat]'))) {
    var cl = $('[data-tcatl="' + t.getAttribute('data-tcat') + '"]');
    if (cl) {
      cl.hidden = !cl.hidden;
      t.setAttribute('aria-expanded', cl.hidden ? 'false' : 'true');
      var cc = t.querySelector('.tcat__c'); if (cc) cc.textContent = cl.hidden ? '▸' : '▾';
    }
    return;
  }
  /* 工具库点工具 = 往画布末尾接一个节点，同时打开它的参数配置 ——
     新节点默认就是要配参数的，分两步点反而多一次点击。 */
  if ((t = e.target.closest('[data-tool]'))) {
    var _tn = t.getAttribute('data-tool');
    var _n = appendNode(_tn);
    openToolDrawer(_tn);
    toast('已加入画布：' + _tn + '（第 ' + (_n + 1) + ' 个节点）', 'ok');
    return;
  }
  if ((t = e.target.closest('[data-flow]'))) { pickFlow(t.getAttribute('data-flow')); return; }
  if (e.target.closest('[data-netgraph]')) {
    openToolDrawer('Circos 圈图可视化');
    toast('已打开网络图模块');
    return;
  }
  /* 项目管理。
     顺序要紧：[data-proj-open] 比外层 [data-proj] 更内层，事件委托取第一个
     命中的 closest，谁写在前面谁赢 —— 卡内「详情」按钮必须先判，否则点它
     会顺带把外层卡片也走一遍。 */
  if ((t = e.target.closest('[data-proj-open]'))) {
    openProjDetail(t.getAttribute('data-proj-open'));
    return;
  }
  if ((t = e.target.closest('[data-proj-share]'))) {
    openProjShare(t.getAttribute('data-proj-share') || (curProj() || {}).id);
    return;
  }
  if (e.target.closest('[data-proj-new]')) { openProjNew(); return; }
  /* 新建项目的两条入口（v50 需求 3）。必须先于通用 [data-go] 判断吗？
     不必 —— 这两颗按钮上没有 data-go，各走各的。 */
  if ((t = e.target.closest('[data-pns]'))) { pnewChoose(t.getAttribute('data-pns')); return; }

  /* 样本档案：页内 tab、样本选中、血缘节点筛选、跳项目详情。
     同样写在通用分支之前 —— 血缘节点按钮在 SVG 里，通用分支会先命中别的。 */
  /* ---- 样本档案：登记 / 编辑 / 归档资料 ----
     #docDz 那一支必须排除 docFile 自己：视觉隐藏的 input 被 .click() 之后，
     派发出的 click 的 target 就是它，closest 又命中同一个容器 —— 不设这道
     闸门就是一个死循环。 */
  if (e.target.closest('[data-samp-new]')) { openSampNew(); return; }
  if (e.target.closest('[data-samp-new-submit]')) { createSamp(); return; }
  if (e.target.closest('[data-samp-edit]')) { openSampEdit(); return; }
  if (e.target.closest('[data-samp-edit-submit]')) { saveSampEdit(); return; }
  if (e.target.closest('[data-samp-doc-add]')) { openSampDocAdd(); return; }
  if (e.target.closest('[data-doc-submit]')) { commitSampDocs(); return; }
  if (e.target.id !== 'docFile' && e.target.closest('[data-doc-drop]')) {
    var df = $('#docFile'); if (df) df.click(); return;
  }
  if ((t = e.target.closest('[data-pend-del]'))) {
    SAMP_PEND.splice(Number(t.getAttribute('data-pend-del')), 1); renderSampPend(); return;
  }
  if ((t = e.target.closest('[data-doc-del]'))) { delSampDoc(Number(t.getAttribute('data-doc-del'))); return; }
  if ((t = e.target.closest('[data-doc-dl]'))) { dlSampDoc(Number(t.getAttribute('data-doc-dl'))); return; }
  /* v46：原有一条「切 tab 时收起样本详情抽屉」（`#page-gene [data-atab]`）——
     页面里只剩样本档案一个面板，没有可切的 tab 了，分支一并删。 */
  if (e.target.closest('[data-close="samp"]')) { closeSampDrawer(); return; }
  if ((t = e.target.closest('[data-samp-sort]'))) { sampSort(t.getAttribute('data-samp-sort')); return; }
  if ((t = e.target.closest('[data-samp-page]'))) { sampPage(t.getAttribute('data-samp-page')); return; }
  if (e.target.closest('[data-samp-fltreset]')) { sampFltReset(); return; }
  if ((t = e.target.closest('[data-samp-pick]'))) { sampPick(t.getAttribute('data-samp-pick')); return; }
  if (e.target.closest('[data-samp-go]')) { sampPick(sampMatch(SAMP_Q)[0] || ''); return; }
  if ((t = e.target.closest('[data-linnode]'))) { linFocus(t.getAttribute('data-linnode')); return; }
  /* 节点列表（血缘图的数据表替代视图）：与编排区画布的 [data-orch-alt] 同构。
     图的元素是 <g role="button">，读屏只能一个个念 aria-label；这张表把
     「哪一层、上游是谁、贡献几路组学」一次性摊平。 */
  if ((t = e.target.closest('[data-lin-alt]'))) {
    var lt = $('#linTbl');
    if (lt) {
      lt.hidden = !lt.hidden;
      t.setAttribute('aria-expanded', lt.hidden ? 'false' : 'true');
    }
    return;
  }
  if (e.target.closest('[data-lin-fold]')) { toggleLinFold(); return; }
  if (e.target.closest('[data-lin-axis]')) { toggleLinAxis(); return; }
  if (e.target.closest('[data-lin-clear]')) { linFocus(''); return; }
  /* v40：「查看数据」落在项目概况的「数据集」页签上 ——
     用户在样本档案那一屏问的是「这份数据是什么」，答案是一批数据集，
     不是项目信息那一行 11 个字段。把页签和滚动锚点一起给出去。 */
  if ((t = e.target.closest('[data-om-open]'))) {
    openProjDetail(t.getAttribute('data-om-open'), 'dataset', 'ds-detail');
    return;
  }

  /* ---- 文件管理（独立页 #page-files，v33 自样本档案第三个 tab 升格）----
     属性名带 fm- 前缀，不会与上面 samp-/lin- 分支互相命中。 */
  if ((t = e.target.closest('[data-fmscope]'))) {
    FM_SCOPE = t.getAttribute('data-fmscope'); renderFM(); return;
  }
  if (e.target.closest('[data-fm-pick]')) {
    var fmf = $('#fmFile'); if (fmf) fmf.click(); return;
  }
  /* 与 docFile 同一条闸门：input 自己的 click 冒泡回来不能再次触发 input。 */
  if (e.target.id !== 'fmFile' && e.target.closest('[data-fm-drop]')) {
    var fmf2 = $('#fmFile'); if (fmf2) fmf2.click(); return;
  }
  if (e.target.closest('[data-fm-upload]')) { commitFMUpload(); return; }
  if ((t = e.target.closest('[data-fm-pend-del]'))) {
    FM_PEND.splice(Number(t.getAttribute('data-fm-pend-del')), 1); renderFMPend(); return;
  }
  if (e.target.closest('[data-fm-loc]')) { openFMLoc(); return; }
  if ((t = e.target.closest('[data-fm-locpick]'))) { pickFMLoc(t.getAttribute('data-fm-locpick')); return; }
  if (e.target.closest('[data-fm-newdir]')) { openFMNewDir(); return; }
  if (e.target.closest('[data-fm-newdir-ok]')) { commitFMNewDir(); return; }
  if ((t = e.target.closest('[data-fm-dirtoggle]'))) {
    var dn = t.getAttribute('data-fm-dirtoggle');
    FM_EXP[dn] = !FM_EXP[dn]; renderFMRows(); return;
  }
  if ((t = e.target.closest('[data-fm-view]'))) { viewFMFile(t.getAttribute('data-fm-view')); return; }
  if ((t = e.target.closest('[data-fm-dl]'))) { dlFMFile(t.getAttribute('data-fm-dl')); return; }
  if ((t = e.target.closest('[data-fm-rename]'))) { openFMRename(t.getAttribute('data-fm-rename')); return; }
  if (e.target.closest('[data-fm-rename-ok]')) { commitFMRename(); return; }
  if ((t = e.target.closest('[data-fm-del]'))) { openFMDel(t.getAttribute('data-fm-del')); return; }
  if (e.target.closest('[data-fm-del-ok]')) { commitFMDel(); return; }

  /* v46：这里原有 5 条「基因档案 / 重建档案抽屉」的分支
     （data-gene-rebuild / data-close="gene" / #backGene / data-grb-scope /
     data-grb-run / data-grb-again）—— 抽屉里的控件全靠委托进来。
     那个 tab 与抽屉一起撤了，钩子再没人发，分支一并删。
     本文件顶部那条「撤一个钩子前先 grep 谁在借它」的规矩在这里是**反例**：
     grep 过 data-grb-* 与 data-close="gene"，全仓只有抽屉自己在用，所以撤得掉。 */
  if ((t = e.target.closest('#projViewSeg [data-projview]'))) {
    PROJ_VIEW = t.getAttribute('data-projview');
    renderProj();
    toast(PROJ_VIEW === 'list' ? '已切换为列表视图' : '已切换为卡片视图');
    return;
  }
  /* v42：操作条上那颗「运行记录」撤了，但这条分支**不能跟着删** ——
     「分析执行 › 运行记录」面板里还有一颗同样挂 data-proj-golog 的
     「去「运行日志」看全站记录」（pdtRunPanel），它才是这条分支真正的用户。
     撤按钮前 grep 一遍钩子名，就是为了别把别人的路一起铲了。 */
  if (e.target.closest('[data-proj-golog]')) { goto('log'); return; }
  /* v51：智能分析线第 5 步「查看分析结果」。
     任务运行页那颗「查看结果」原先挂 data-pano —— 那时这条线上没有结果这一步，
     只能把人送去项目详情里的结果全景。现在本线自己有第 5 步了，落点回到本线内：
     跑完任务的人要看结果，不该先退出这条线、回项目列表、再钻进去找。
     视图号先记进 PANO_VIEW 再跳（挂载时读的就是它），与项目详情那条同一套。
     「任务还没结束」这道闸跟着按钮搬过来 —— 它原先挂在 [data-go] 分支上，
     v42 改挂 data-pano 时搬过一次，本轮改挂 data-res 再搬一次：闸认的是
     按钮 id 与 aria-disabled 这对事实，而不是它挂在哪个属性上。 */
  if ((t = e.target.closest('[data-res]'))) {
    if (t.id === 'btnResult' && t.getAttribute('aria-disabled') === 'true') { toast('任务还没结束，稍等一下', 'warn'); return; }
    PANO_VIEW = t.getAttribute('data-res') || 'variant';
    goto('p07');
    return;
  }
  /* v42：两处「查看结果」（项目详情 › 任务结果表两处）原先都跳「智能分析 › 结果全景」
     那个独立页。v51 该页回来了，但这两颗按钮**仍然留在项目详情里** ——
     它们在「任务结果表」的每一行上，用户此刻站在项目层的语境里看待这份结果，
     点一下又跳去智能分析线是两套语境串台。所以它们继续走 data-pano。 */
  if ((t = e.target.closest('[data-pano]'))) {
    PANO_VIEW = t.getAttribute('data-pano') || 'variant';
    var pc = curProj() || PROJECTS[0];
    if (pc) {
      var pms = pdtModules(projById(pc.id));
      openProjDetail(pc.id, null, null, pms.length ? pms.length - 1 : null);
    }
    return;
  }
  /* 查看项目结果全景（v28；v42 改落点；v44 恢复）：不跳「智能分析 › 结果全景」那个独立页
     （已撤），而是在**本页内**换到「分析结果 › 结果全景」那一格 —— 不把人送出项目层。 */
  if ((t = e.target.closest('[data-proj-pano]'))) {
    var pp = projById(t.getAttribute('data-proj-pano'));
    if (pp) {
      if (!pp.on) { setCurProj(pp.id); toast('已切换到「' + pp.n + '」，正在查看其结果全景', 'ok'); }
      var pmo = pdtModules(pp);
      if (pmo.length) setProjMod(pmo.length - 1);
    }
    return;
  }

  /* 项目概况的页签（v39）：点页签只换面板，不重画页头 ——
     页头里那排状态徽章是「这个项目的结论」，跟着面板一起重画只会闪。 */
  /* v40：选择器从 #projTabs 放宽到全站 ——「项目信息」页签里那颗
     「去『数据集』页签」按钮也挂 data-pdt，写死在页签条里它点不动。 */
  /* 项目层左栏与流程条共用的三个入口。左栏与流程条走同一组函数 ——
     它们是同一件事（我在这一层的哪一格）的两个呈现，各写一套必然走偏。 */
  if (e.target.closest('[data-pdgrp]')) {
    NAV_OPEN['分析结果'] = !navGrpOpen('分析结果');
    renderProjNav(); markProjNav(); return;
  }
  if ((t = e.target.closest('[data-pds]'))) { setProjSec(t.getAttribute('data-pds')); return; }
  if ((t = e.target.closest('[data-pdmod]'))) { setProjMod(parseInt(t.getAttribute('data-pdmod'), 10)); return; }
  if ((t = e.target.closest('[data-pdt]'))) { setProjTab(t.getAttribute('data-pdt')); return; }
  /* 新建 / 分享：改设置只重渲染弹窗正文，不动弹窗本身（滚动位置不会跳） */
  /* 新建项目向导（v37）：整块事件收在一个分发函数里。
     为什么不在各处零散处理：切步要先「把当前步输入框的值收回 PNEW」再重画，
     散着写必然有一步忘了收，表现为「上一步填的内容下一步就没了」。 */
  if (PNEW && (t = e.target.closest('[data-pn]'))) { pnewAction(t); return; }
  if (e.target.closest('[data-share-copy]')) { copyShareUrl(); return; }
  if (e.target.closest('[data-share-done]')) { copyShareUrl(); $('#modal').hidden = true; return; }
  if ((t = e.target.closest('[data-share-days]'))) { SHARE_DAYS = t.getAttribute('data-share-days'); openProjShare(SHARE_PID); return; }
  if ((t = e.target.closest('[data-share-role]'))) { SHARE_ROLE = t.getAttribute('data-share-role'); openProjShare(SHARE_PID); return; }
  /* 日志筛选 */
  /* ---------- 系统管理 › 项目组管理（v47 需求 3） ----------
     增删改三条都要过 pgCanWrite()：权限不足时按钮虽然已 disabled / 缺省，
     但委托分支仍要自己再挡一次 —— 键盘、脚本、或将来别处冒出来的入口
     都会绕过视觉态，只有这里挡是可信的。
     v54：页头的三档身份开关已撤（身份只有顶栏一处入口），这里不再有
     页面内的身份切换分支 —— 换身份走 setRole()，它会把本页重画一遍。 */
  if ((t = e.target.closest('[data-pg-check]'))) {
    var ck = t.getAttribute('data-pg-check');
    if (PG_SEL[ck]) delete PG_SEL[ck]; else PG_SEL[ck] = true;
    renderProjGroups();
    return;
  }
  if (e.target.id === 'pgAll') {
    var allOn = e.target.checked;
    PG_SEL = {};
    if (allOn) pgRows().forEach(function (g) { PG_SEL[g.id] = true; });
    renderProjGroups();
    return;
  }
  if ((t = e.target.closest('[data-pg-on]'))) {
    if (!pgCanWrite()) { toast('当前身份（' + pgRoleTxt() + '）没有修改项目组的权限', 'warn'); renderProjGroups(); return; }
    var gg = pgById(t.getAttribute('data-pg-on'));
    if (gg) {
      gg.on = !gg.on;
      renderProjGroups();
      renderNav();
      toast('「' + gg.n + '」已' + (gg.on ? '启用' : '禁用')
        + (gg.on ? '，重新出现在新建项目的下拉里' : '，不再出现在新建项目的下拉里'), 'ok');
    }
    return;
  }
  if (e.target.closest('[data-pg-new]')) { pgEditOpen(''); return; }
  if ((t = e.target.closest('[data-pg-edit]'))) { pgEditOpen(t.getAttribute('data-pg-edit')); return; }
  if ((t = e.target.closest('[data-pg-rowdel]'))) {
    openPgDel([t.getAttribute('data-pg-rowdel')]);
    return;
  }
  if (e.target.closest('[data-pg-del]')) {
    if (!pgCanWrite()) { toast('当前身份（' + pgRoleTxt() + '）没有删除权限', 'warn'); return; }
    var sel = pgSelRows();
    if (!sel.length) { toast('请先勾选要删除的项目组', 'warn'); return; }
    var bad = sel.filter(function (g) { return !pgDeletable(g); });
    if (bad.length) {
      toast('「' + bad[0].n + '」不是已驳回状态，不能删除 —— 待审核的可能马上通过，'
        + '已通过的已被项目引用', 'warn');
      return;
    }
    openPgDel(sel.map(function (g) { return g.id; }));
    return;
  }
  if (e.target.closest('[data-pg-del-ok]')) { pgDelCommit(); return; }
  if (e.target.closest('[data-pg-cancel]')) { PG_EDIT = null; $('#modal').hidden = true; return; }
  if (e.target.closest('[data-pg-save]')) { pgSave(); return; }
  if (e.target.closest('[data-pg-memadd]')) { pgMemAdd(); return; }
  if ((t = e.target.closest('[data-pg-memdel]'))) {
    if (!PG_EDIT) return;
    var mi = PG_EDIT.members.indexOf(t.getAttribute('data-pg-memdel'));
    if (mi >= 0) PG_EDIT.members.splice(mi, 1);
    renderPgMemList();
    return;
  }
  if (e.target.closest('[data-pg-refresh]')) {
    PG_Q = ''; var qi = $('#pgQ'); if (qi) qi.value = '';
    PG_SEL = {};
    renderProjGroups();
    toast('已刷新项目组列表（清空搜索与勾选）', 'ok');
    return;
  }
  if ((t = e.target.closest('[data-pg-sort]'))) {
    /* 三态循环：原序（新在前）→ 升 → 降。箭头方向由 renderProjGroups 重画，
       这里只改状态 —— 手改图标类名的做法对**内联 SVG** 无效（见那里的注释）。 */
    PG_SORT = PG_SORT === 0 ? 1 : (PG_SORT === 1 ? -1 : 0);
    renderProjGroups();
    toast('创建时间' + (PG_SORT === 1 ? '升序' : PG_SORT === -1 ? '降序' : '恢复默认顺序'));
    return;
  }
  /* ---------- 系统管理 › 示例数据集（v40 需求 2） ----------
     三条设置都是「改完立刻前台可见」；任何一处不做同步，这一页就沦为装饰。 */
  /* v54：示例数据集展示配置是**平台级权限**（只有超级管理员）。委托里统一挡一次 ——
     视觉态只是 disabled，脚本、键盘与将来别处冒出来的入口都会绕过它。
     这五类动作共用一道：开关 / 全部显示隐藏 / 恢复默认 / 上传封面 / 清除封面。 */
  if ((t = e.target.closest('[data-pds-toggle], [data-pds-all], [data-pds-reset], [data-pds-up], [data-pds-clr]'))
      && !canConfig()) {
    toast('当前身份（' + roleName() + '）不能修改示例数据集配置：需「超级管理员」', 'warn');
    return;
  }
  if ((t = e.target.closest('[data-pds-toggle]'))) {
    var pid0 = t.getAttribute('data-pds-toggle');
    var dd0 = pubDsById(pid0);
    demoSet(pid0, { show: !dd0.show }, '「' + dd0.n + '」已' + (dd0.show ? '隐藏' : '显示'));
    return;
  }
  if ((t = e.target.closest('[data-pds-all]'))) {
    var on0 = t.getAttribute('data-pds-all') === '1';
    DEMO_DS.forEach(function (d) { d.show = on0; });
    renderDemoSet();
    toast(on0 ? '9 条示例数据集已全部显示' : '9 条示例数据集已全部隐藏，前台卡片同步收起', 'ok');
    return;
  }
  if (e.target.closest('[data-pds-reset]')) {
    DEMO_DS.forEach(function (d, i) {
      var def = DEMO_DS_DEF[i] || {};
      d.intro = def.intro == null ? '' : def.intro;
      d.img = def.img || '';
      d.show = def.show !== false;
    });
    renderDemoSet();
    toast('已恢复出厂设置：简介、封面与显示状态全部复原', 'ok');
    return;
  }
  if ((t = e.target.closest('[data-pds-up]'))) {
    var fid = t.getAttribute('data-pds-up');
    var fi0 = $('[data-pds-file="' + fid + '"]');
    if (fi0) fi0.click();
    return;
  }
  if ((t = e.target.closest('[data-pds-clr]'))) {
    var cid = t.getAttribute('data-pds-clr');
    var cd = pubDsById(cid);
    if (cd.img) demoSet(cid, { img: '' }, '「' + cd.n + '」封面已清除');
    return;
  }
  if ((t = e.target.closest('[data-pds-img]'))) {
    demoSet(t.getAttribute('data-pds-img'), { img: t.value }, t.value ? '封面已更新' : '已改为不使用封面');
    return;
  }
  if (e.target.closest('[data-logq]')) { toast('已按条件查询：命中 ' + LOGS.length + ' 条', 'ok'); return; }
  if (e.target.closest('[data-logreset]')) {
    ['logType', 'logState'].forEach(function (k) { var el = $('#' + k); if (el) el.selectedIndex = 0; });
    ['logUser', 'logUid', 'logPid'].forEach(function (k) { var el = $('#' + k); if (el) el.value = ''; });
    renderLog();
    toast('筛选条件已重置');
    return;
  }
  if (e.target.closest('[data-hist-refresh]')) { renderHist(); toast('运行历史已刷新'); return; }
  /* 画布节点列表（数据表替代视图） */
  /* 主页「问答交互」卡的全屏键（v53 起智能体没有第二个宿主，
     不存在「两套全屏状态」了 —— 但它仍是页面流里的卡片，不是浮层，注释留着防止误并） */
  if (e.target.closest('[data-wb-full]')) { toggleWbFull(); return; }
  if ((t = e.target.closest('[data-agent-send]'))) { agentSend(t.getAttribute('data-agent-send') || 'wbAgentIn'); return; }
  if ((t = e.target.closest('[data-ask]'))) { agentAsk(t.getAttribute('data-ask')); return; }
  if (e.target.closest('[data-agent-ok]')) { agentConfirm(AGENT_PENDING); return; }
  if (e.target.closest('[data-agent-no]')) {
    AGENT_LOG.push({ r: 'a', t: '已取消，未提交任何写操作。需要时随时叫我。', tm: agentTime() });
    renderAgent();
    return;
  }
});

/* ============================================================
   知识赋能交互实现（kbmed / kbown / kbgraph）
   （医学知识库的渲染器与检索/新增逻辑已上移至 KB2 模块，v35）
   ============================================================ */

/* ---- 自有知识库解析（F-17） ---- */
function kbParse(btn) {
  var box = $('#kbParse'); if (!box) return;
  if (btn.getAttribute('aria-disabled') === 'true') return;
  btn.setAttribute('aria-disabled', 'true');
  box.hidden = false;
  var steps = ['上传 PDF（3.4 MB）', '版面还原与文本抽取', '分段与向量化（412 个片段）', '关键信息标注（实体 28 个）', '写入知识库 · 版本 v1.1'];
  var i = 0;
  box.innerHTML = '<div class="row mb-3"><span class="card__t">解析中</span>'
    + '<span class="tag tag--brand">院内心衰随访表.pdf</span>'
    + '</div>'
    + '<div class="stack" id="kbParseSteps"></div>';
  var host = $('#kbParseSteps');
  var tick = function () {
    host.innerHTML = steps.map(function (s, k) {
      var cls = k < i ? 'qpos is-ok' : k === i ? 'qpos qpos--me' : 'qpos';
      return '<div class="qrow"><span class="' + cls + '">' + (k < i ? '✓' : k + 1) + '</span>'
        + '<div class="flex-1">' + s + '</div>'
        + '<span class="tag' + (k < i ? ' tag--ok' : '') + '">' + (k < i ? '完成' : k === i ? '进行中…' : '等待中') + '</span></div>';
    }).join('');
    if (i++ < steps.length) { setTimeout(tick, 420); return; }
    var vt = $('#kbVerTbl');
    if (vt) vt.insertAdjacentHTML('afterbegin',
      '<tr><td>院内心衰随访表.pdf</td><td class="num">3.4 MB</td><td class="num">412</td><td>v1.1</td><td class="num">2026-09-14 17:38</td><td class="num">新增</td></tr>');
    toast('解析完成：院内心衰随访表.pdf · 412 个片段已向量化并写入知识库 v1.1', 'ok');
    btn.removeAttribute('aria-disabled');
  };
  tick();
}

/* 输入变化 → 同步两套控件 + 更新预期输出 */
function onParam(e) {
  var k = paramKey(e.target);
  if (k && !isNaN(k.num) && k.num > 0) syncParams(k.key, k.num, e.target);
  updateExpect();
}
document.addEventListener('input', function (e) {
  if (e.target.id === 'fmQ') { FM_Q = e.target.value; renderFMRows(); return; }
  /* 数据汇集页选数据的搜索框：**只重画文件树**。
     整块重画会把输入框本身换掉，敲第二个字时焦点就丢了。 */
  if (e.target.id === 'p02FileQ') {
    P02_PICK.q = e.target.value;
    var p02tr = $('#p02Pick .pntree');
    if (p02tr) p02tr.innerHTML = p02FileRows();
    return;
  }
  /* 项目组搜索：只重画表格本体，不整块重画 —— 整块重画会把输入框换掉，
     光标和焦点一起丢，打第二个字就断了（与 pnFileQ 同一条理由）。 */
  if (e.target.id === 'pgQ') { PG_Q = e.target.value; renderProjGroups(); return; }
  /* 向导内两个即时筛选框：只重画列表本体，不做整块重画 ——
     整块重画会把输入框本身换掉，光标和焦点一起丢，打第二个字就断了。 */
  if (PNEW && e.target.id === 'pnFileQ' && PNEW.step === 1) {
    PNEW.fq = e.target.value;
    var tw = $('.wiz__bd .pntree');
    if (tw) tw.innerHTML = pnewFileRows();
    return;
  }
  if (PNEW && e.target.id === 'pnGSampQ' && PNEW.view === 'group') {
    PNEW.g.q = e.target.value;
    var sp = $('#pnSampPool');
    if (sp) { sp.innerHTML = pnewSampPoolHTML(); }
    return;
  }
  /* 第 4 步的流程搜索：同一条理由，只重画列表本体。
     `.wiz__bd .pnlist` 在向导里唯一 —— 一次只渲染一步（第 3 步那个 .pnlist
     是分组方案列表，与这一步不会同屏）。 */
  if (PNEW && e.target.id === 'pnFlowQ' && PNEW.step === 3) {
    PNEW.flowQ = e.target.value;
    var lw = $('.wiz__bd .pnlist');
    if (lw) lw.innerHTML = pnewFlowList();
    return;
  }
  /* 第 5 步的参数表单：改动即时反映到右侧「参数确认摘要」。
     只换摘要那一块（outerHTML），不动表单本身 —— 整块重画会把正在输入的数字框
     换掉、焦点与光标一起丢（pnFileQ / pnGSampQ 同一类坑的第三次）。 */
  if (PNEW && PNEW.step === 4 && pnewParamLive(e.target)) return;
  /* 分组名 / 方案名是重画时才读的，输入过程只回写进草稿即可 */
  if (PNEW && PNEW.view === 'group' && e.target.id === 'pnGNew') { PNEW.g.draft = e.target.value; return; }
  if (paramKey(e.target)) onParam(e);
});
/* 所属项目组（团队上传的必选项）：选了就记下，切 scope 不丢 */
document.addEventListener('change', function (e) {
  if (e.target.id === 'fmProjSel') { FM_PJ_UPLOAD = e.target.value; return; }
  /* 向导第 5 步的参数表单：下拉与勾选框只保证发 change（不一定发 input），
     所以同一件事在两条通道各接一次，靠 pnewParamLive() 内部的判重收敛。 */
  if (PNEW && e.target && PNEW.step === 4) pnewParamLive(e.target);
});
/* 向导里的下拉只在 change 时才拿得到最终值：点开 select 那一下派发的是 click，
   此时读到的还是旧值，所以比较组的对照组 / 处理组必须单独接一条 change。 */
document.addEventListener('change', function (e) {
  var t2 = e.target.closest && e.target.closest('[data-pn="p-pair"]');
  if (!t2 || !PNEW || !PNEW.pl) return;
  var kk = t2.getAttribute('data-k'), ix = parseInt(kk.slice(1), 10);
  if (PNEW.pl.pairs[ix]) PNEW.pl.pairs[ix][kk.charAt(0)] = t2.value;
});
document.addEventListener('change', function (e) {
  /* 归档弹窗选文件。input 视觉隐藏没关系，change 照样从它冒上来；
     读完必须清空 value —— 否则同一个文件连选两次不会再触发 change。 */
  if (e.target.id === 'docFile') {
    pushSampFiles(e.target.files);
    e.target.value = '';
    return;
  }
  /* 上传区选中的真实文件：格式对不对由文件本身决定 */
  if (e.target.id === 'realFile') {
    onRealFile(e.target.files);
    e.target.value = '';
    return;
  }
  /* 文件管理（样本档案 › 文件管理）：不限格式，accept 留空 */
  if (e.target.id === 'fmFile') {
    pushFMFiles(e.target.files);
    e.target.value = '';
    return;
  }
  /* 团队列表的项目组筛选 */
  if (e.target.id === 'fmPjFlt') {
    FM_PJ = e.target.value; renderFMRows(); return;
  }
  /* 样本列表四个筛选下拉。改筛选必须回到第 1 页 ——
     停在第 4 页再筛，结果只剩 3 条时那一页是空的，看着像功能坏了。 */
  if (e.target.getAttribute && e.target.getAttribute('data-samp-flt')) {
    SAMP_FLT[e.target.getAttribute('data-samp-flt')] = e.target.value;
    SAMP_PAGE = 1;
    renderSampList();
    return;
  }
  if (e.target.closest && e.target.closest('#drawerTool')) { toolSummary($('#drawerTool')); return; }
  /* v46：原有一条「重建依据勾选」（data-grb-src）在这里 —— 勾选态存 GRB.src、
     重绘后不丢。勾选框随抽屉一起撤了，分支一并删。 */
  /* 示例数据集（v40）：简介用 change 而不是 input ——
     input 每敲一个字就整页重画一次，输入框会被重建成新节点，光标直接飞走。
     change 在失焦那一刻才提交，正好是「这句话写完了」的时机。 */
  var pi = e.target.getAttribute && e.target.getAttribute('data-pds-intro');
  if (pi) { demoSet(pi, { intro: e.target.value }, '简介已更新'); return; }
  /* 本地封面：FileReader 读成 dataURL。原型没有后端，这是让「上传」这件事
     真的看得到结果的唯一办法 —— 只显示文件名的话，封面预览永远是空的。 */
  var pf = e.target.getAttribute && e.target.getAttribute('data-pds-file');
  if (pf) {
    var f0 = (e.target.files || [])[0];
    if (!f0) return;
    if (!/^image\//.test(f0.type)) { toast('封面必须是图片文件', 'warn'); e.target.value = ''; return; }
    if (f0.size > 8 * 1024 * 1024) { toast('封面不能超过 8MB', 'warn'); e.target.value = ''; return; }
    var rd = new FileReader();
    rd.onload = function () { demoSet(pf, { img: String(rd.result) }, '封面已上传：' + f0.name); };
    rd.onerror = function () { toast('读取图片失败，换一张试试', 'warn'); };
    rd.readAsDataURL(f0);
    e.target.value = '';
    return;
  }
  if (paramKey(e.target)) onParam(e);
});

/* 拖拽归档。dragover 必须 preventDefault —— 不拦的话浏览器会拿这个文件去导航，
   当前页面直接被替换掉；dragleave 在子元素之间移动时也会冒出来，所以要先确认
   指针真的离开了整个容器，再取消高亮。 */
document.addEventListener('dragover', function (e) {
  var dz = e.target.closest && e.target.closest('[data-doc-drop]');
  if (!dz) return;
  e.preventDefault();
  dz.classList.add('is-ov');
});
document.addEventListener('dragleave', function (e) {
  var dz = e.target.closest && e.target.closest('[data-doc-drop]');
  if (!dz || dz.contains(e.relatedTarget)) return;
  dz.classList.remove('is-ov');
});
document.addEventListener('drop', function (e) {
  var dz = e.target.closest && e.target.closest('[data-doc-drop]');
  if (!dz) return;
  e.preventDefault();
  dz.classList.remove('is-ov');
  pushSampFiles(e.dataTransfer && e.dataTransfer.files);
});

/* 上传区也支持拖放：卡片上写了「也可以把本机文件直接拖到上方区域」，
   写了就得真的能拖 —— 与归档区同一套处理，只是落点不同。
   v50：落点从 .dz 换成数据汇集页整个选择区（#p02Pick），
   所以高亮不再用 .dz 那圈虚线，见 .p02drop.is-ov。 */
document.addEventListener('dragover', function (e) {
  var dz = e.target.closest && e.target.closest('[data-dz]');
  if (!dz) return;
  e.preventDefault();
  dz.classList.add('is-ov');
});
document.addEventListener('dragleave', function (e) {
  var dz = e.target.closest && e.target.closest('[data-dz]');
  if (!dz || dz.contains(e.relatedTarget)) return;
  dz.classList.remove('is-ov');
});
document.addEventListener('drop', function (e) {
  var dz = e.target.closest && e.target.closest('[data-dz]');
  if (!dz) return;
  e.preventDefault();
  dz.classList.remove('is-ov');
  onRealFile(e.dataTransfer && e.dataTransfer.files);
});

/* 文件管理的拖拽上传：与归档区同一套处理，落点是 FM 待上传清单。 */
document.addEventListener('dragover', function (e) {
  var dz = e.target.closest && e.target.closest('[data-fm-drop]');
  if (!dz) return;
  e.preventDefault();
  dz.classList.add('is-ov');
});
document.addEventListener('dragleave', function (e) {
  var dz = e.target.closest && e.target.closest('[data-fm-drop]');
  if (!dz || dz.contains(e.relatedTarget)) return;
  dz.classList.remove('is-ov');
});
document.addEventListener('drop', function (e) {
  var dz = e.target.closest && e.target.closest('[data-fm-drop]');
  if (!dz) return;
  e.preventDefault();
  dz.classList.remove('is-ov');
  pushFMFiles(e.dataTransfer && e.dataTransfer.files);
});

/* 上传区选中的真实文件：扩展名决定走「已识别」还是走格式告警。
   格式错误是选错了文件的结果，不是一个专门的触发按钮。 */
var FMT_OK = ['vcf', 'bcf', 'fastq', 'fq', 'bam', 'csv', 'tsv', 'txt', 'mzml', 'h5ad'];

function fmtSize(n) {
  if (!n && n !== 0) return '—';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / 1048576).toFixed(1) + ' MB';
  return (n / 1073741824).toFixed(2) + ' GB';
}

function onRealFile(files) {
  if (!files || !files.length) return;
  var f = files[0], parts = f.name.split('.');
  var ext = (parts.pop() || '').toLowerCase();
  /* .vcf.gz 这类复合后缀取倒数第二段 */
  if (ext === 'gz' || ext === 'zip' || ext === 'bz2') ext = (parts.pop() || '').toLowerCase();

  if (FMT_OK.indexOf(ext) < 0) {
    showAnom('format', { name: f.name, ext: ext });
    toast('「' + f.name + '」不在支持清单内，已给出可执行的下一步', 'warn');
    return;
  }
  var host = $('#fileCard');
  if (host) {
    host.hidden = false;
    $('#fileList').innerHTML = fileCardHTML({
      name: f.name, detected_format: ext.toUpperCase(),
      data_type: '待解析', count: fmtSize(f.size) + ' · 待解析'
    });
    $('#fileTag').className = 'tag tag--ok';
    $('#fileTag').textContent = '校验通过';
  }
  toast('已接收：' + f.name + ' · ' + fmtSize(f.size), 'ok');
}

function fileCardHTML(d) {
  /* 公开数据集没有「缺失率」（未做质控统计），因此三项元信息都可缺省 */
  var m = [];
  if (d.detected_format) m.push(d.detected_format);
  if (d.size) m.push(d.size);
  if (d.count) m.push(d.count);
  else if (d.sample_count != null) m.push(d.sample_count + ' 例样本');
  if (d.quality) m.push('缺失率 ' + d.quality.missing_rate + '%');
  return '<div class="fcard"><span class="fcard__ico">' + ico(d.icon || 'file-csv') + '</span>'
    + '<div class="min-w-0 flex-1"><div class="fcard__n">' + d.name + '</div>'
    + '<div class="fcard__m">' + m.join(' · ') + '</div>'
    + (d.src ? '<div class="fcard__m">来源 ' + d.src + (d.acc ? ' · ' + d.acc : '') + '</div>' : '')
    + '</div><span class="tag tag--ok">' + ico('circle-check') + '已识别</span></div>';
}

function openDrawer() { $('#backTrace').hidden = false; $('#drawerTrace').hidden = false; }
function closeDrawer() { $('#backTrace').hidden = true; $('#drawerTrace').hidden = true; }

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    /* v62：图表设置面板是最上层的浮层，先收它 */
    var _cs = $('#chartSet');
    if (_cs && _cs.classList.contains('is-open')) { closeChartSet(); return; }
    /* 主页问答卡全屏：Esc 先缩回原来那一格，而不是把这一整张卡「收掉」
       —— 卡片在页面流里，没有「收掉」这个动作，能做的只有缩回。 */
    var _wc = $('#wbAgentCard');
    if (_wc && _wc.classList.contains('is-full')) { toggleWbFull(false); return; }
    /* 先收「浮层」，本轮没开过任何浮层时才退全屏 ——
       否则在全屏里点开工具配置后按一次 Esc 会连退两层。 */
    var hadOverlay = !$('#modal').hidden || !$('#popTask').hidden
      || !$('#backTrace').hidden || !$('#backTool').hidden
      || ($('#drawerSamp') && !$('#drawerSamp').hidden)
      || ($('#histDrawer') && !$('#histDrawer').hidden)
      || ($('#snav') && $('#snav').classList.contains('is-open'));
    /* 更上层的东西（弹窗 / 左栏）开着时，Esc 只退那一层，样本抽屉留着 ——
       从抽屉里点「编辑信息」开出的弹窗，按 Esc 应该是关弹窗回到抽屉，
       而不是连抽屉一起收掉（那等于把用户刚做的事全抹了）。 */
    var hadTop = !$('#modal').hidden || !$('#popTask').hidden
      || ($('#snav') && $('#snav').classList.contains('is-open'));
    /* v46：这里原有第三个变量 hadSecond（v39 起二级抽屉只剩「重建档案」一个）——
       它随「基因档案」那整块一起撤了，现在**没有二级抽屉**了，
       样本抽屉只由 hadTop 决定收不收，判断少一层。
       v53：智能体浮窗那两项（全屏先缩回 / hadOverlay·hadTop 各含一项）随之撤除。 */
    closeDrawer();
    closeToolDrawer();
    if (!hadTop) closeSampDrawer();
    toggleHist(false);
    $('#modal').hidden = true;
    $('#popTask').hidden = true;
    var sn = $('#snav'); if (sn) sn.classList.remove('is-open');
    if (!hadOverlay) toggleOrchFull(false);
  }
  if (e.key === 'Enter' && e.target && e.target.id === 'kb2Q') { e.preventDefault(); runKb2Search(); }
});

/* 让异常面板的修复动作能拿到上下文 */
var _showAnom = showAnom;
showAnom = function (kind, opt) { anomCtx = anomFor(kind, opt); _showAnom(kind, opt); };

/* ---------- 工具库：9 大类 / 54 个工具（BioAgent Studio 实测抓取） ---------- */
var TOOLCATS = [
  { c: "数据预处理", ic: "filter", n: 4, t: [
    ["Cutadapt 去接头", "Cutadapt: 从高通量测序 reads 中去除接头序列、引物、poly-A 尾等, 支持双端联动修剪(--pair-filter / -A), 是标准去接头工具", "🔧"],
    ["Trimmomatic 读段修剪", "", "🔧"],
    ["fastp 快速质控", "fastp 一站式质控: 接头去除、低质量修剪、N 碱基过滤、质量报告(可单独运行, 不必走 Step1 流程)", "🔧"],
    ["FastQC 质量报告", "FastQC 对测序文件生成质量报告(碱基质量、GC含量、接头污染等可视化 HTML)", "🧪"],
  ]},
  { c: "序列比对", ic: "dna", n: 2, t: [
    ["TopHat 转录组比对", "", "🔧"],
    ["HISAT2 序列比对", "HISAT2 将质控后 reads 比对到参考基因组, 输出 SAM/`-S` 可指定输出文件", "🧬"],
  ]},
  { c: "基因定量", ic: "chart-column", n: 2, t: [
    ["featureCounts 基因定量", "featureCounts 对比对结果做 read 计数, 生成基因表达矩阵(-a GTF -o 输出, 位置参数为 BAM 列表)", "📊"],
    ["Samtools 工具", "samtools 子命令(flagstat/sort/index/idxstats/view)处理 BAM/SAM, 输出到标准输出或 -o 指定文件", "🛠️"],
  ]},
  { c: "统计分析", ic: "chart-line", n: 5, t: [
    ["差异表达分析(DESeq2/edgeR/limma)", "整合 DESeq2、edgeR、limma 三大主流差异表达分析方法的工具镜像(基于 R/Bioconductor)", "📊"],
    ["rMATS 可变剪切 Sashimi 可视化", "rmats2sashimiplot: 将 rMATS 可变剪切分析结果与 BAM 比对数据可视化为 Sashimi plot(剪接连接读取配对图),直观展示不同处理组在可变剪切…", "📊"],
    ["R 热图绘制", "基于 R/pheatmap 的基因表达热图: 输入表达矩阵 CSV(行为基因,列为样本), 输出 PDF 热图, 支持行/列聚类、行标准化与配色。", "🔧"],
    ["ggplot2 火山图绘制", "基于 R/ggplot2 的差异表达火山图: 输入差异表达 CSV(基因列/log2FC 列/p 值列), 输出 PDF 火山图, 显著上调/下调着色并标注 top 基因。", "🔧"],
    ["Rscript 脚本运行", "在镜像环境(DESeq2/clusterProfiler/KEGG 等 R 包)中运行任意 R 脚本, 参数每行一个", "📈"],
  ]},
  { c: "功能与高级分析", ic: "flask-vial", n: 8, t: [
    ["Bracken 物种丰度估计", "Bracken(Bayesian Reestimation of Abundance with KrakEN):基于 Kraken 分类结果重新估计物种/属级丰度的宏基因组工具…", "🧬"],
    ["seqkit", "", "🔧"],
    ["Circos 圈图可视化", "Circos: 生物信息学经典圈图(circular)可视化工具,用于基因融合、结构变异、染色体交互等环形图绘制", "🎯"],
    ["bcftools", "从 conda 构建的 bcftools(查看/过滤/统计 VCF/BCF 变异)", "🔧"],
    ["bedtools 基因组区间操作", "bedtools:用于基因组区间(interval)运算的瑞士军刀,支持 intersect/merge/subtract/complement/window/closest/…", "🧬"],
    ["ggplot2 箱线图", "基于 R ggplot2 绘制箱线图的工具:输入数据表,指定分组列和数值列,输出箱线图 PDF。", "📊"],
    ["rMATS 可变剪切", "rMATS 检测组间可变剪切事件(--b1/--b2 为样本列表文件, 每行一个样本)", "✂️"],
    ["STAR-Fusion 融合基因", "STAR-Fusion 检测融合基因(--left/--right 为双端 FASTQ, --genome_dir 为 CTAT 基因组库)", "⭐"],
  ]},
  { c: "转录组分析", ic: "file-lines", n: 0, t: [
  ]},
  { c: "16S 扩增子", ic: "microscope", n: 4, t: [
    ["qiime2 数据导入", "将 PairedEnd 双端 FASTQ manifest 清单导入为 qiime2 的 demux 工件(PairedEndSequencesWithQuality)", "🧬"],
    ["DADA2 降噪", "DADA2 denoise-paired: 去噪/去嵌合体, 输出特征表与代表序列", "🧬"],
    ["VSEARCH 物种分类", "classify-consensus-vsearch: 用 SILVA 138 参考库对代表序列做一致性物种注释", "🧬"],
    ["物种丰度柱状图", "taxa barplot: 生成各分类层级物种丰度柱状图可视化(.qzv)", "🧬"],
  ]},
  { c: "宏基因组", ic: "bacteria", n: 27, t: [
    ["dRep 基因组去冗余", "基因组去冗余(ANI + Mash)", "🔧"],
    ["FastQC 原始质量报告", "对原始 FASTQ 做碱基质量/GC/接头等质控报告", "🔧"],
    ["MultiQC 报告汇总", "汇总多个 FastQC/fastp 报告为单一 HTML", "🔧"],
    ["Bowtie2 宿主序列去除", "将 reads 比对宿主 GRCh38, --un-conc-gz 直接输出未比对(去宿主)的干净 reads 对", "🔧"],
    ["Samtools SAM/BAM 处理", "SAM/BAM 查看/排序/flagstat/fastq 提取(宿主去除第二步)", "🔧"],
    ["MetaPhlAn 物种组成", "基于 marker gene 的物种组成/相对丰度", "🔧"],
    ["Kraken2 物种分类", "基于 k-mer 的宏基因组物种分类(MiniKraken2 库), 双端输入", "🔧"],
    ["QUAST 组装质量评估", "组装 contigs 质量评估(N50/GC/覆盖度)", "🔧"],
    ["Prodigal 基因预测", "原核基因预测(默认密码子表=11)", "🔧"],
    ["MetaBAT2 MAG 分箱", "基于覆盖度+组成的宏基因组分箱", "🔧"],
    ["SemiBin2 半监督分箱", "半监督深度分箱(基于 contig 覆盖度)", "🔧"],
    ["VAMB 深度分箱", "深度学习分箱(torch)", "🔧"],
    ["CheckM2 MAG 完整度/污染", "MAG 完整性/污染度预测(torch 后端)", "🔧"],
    ["GUNC 嵌合/污染检测", "MAG 嵌合/污染检测", "🔧"],
    ["GTDB-Tk 物种注释", "MAG GTDB 物种注释", "🔧"],
    ["HUMAnN 功能注释", "宏基因组功能定量(UniRef90 基因家族 + MetaCyc 通路); --bypass-nucleotide-search 跳过 MetaPhlAn 预筛, 直接翻译搜索…", "🔧"],
    ["eggNOG-mapper 功能注释", "直系同源功能注释(emapper.py)", "🔧"],
    ["RGI CARD 耐药注释", "CARD 数据库耐药基因注释", "🔧"],
    ["ABRicate 毒力/耐药扫描", "批量小数据库扫描(VFDB 毒力等)", "🔧"],
    ["dbCAN CAZyme 注释", "CAZyme 碳水化合物活性酶注释", "🔧"],
    ["VirSorter2 病毒识别", "从 contigs 识别病毒序列", "🔧"],
    ["CheckV 病毒 QC", "病毒序列 QC/完整性", "🔧"],
    ["R 统计分析与绘图", "完整 R 统计栈(phyloseq/vegan/DESeq2/MaAsLin2/ggplot2), 须显式用 rstats 环境 Rscript", "🔧"],
    ["Bracken 丰度估计", "基于 Kraken2 kreport 的物种丰度重估计(reads 级 -> 属/种级丰度); 依赖 Kraken2 数据库的 kmer_distrib 文件", "🔧"],
    ["宏基因组可视化", "从 fastp/bowtie2/kraken2/humann 输出生成全套出版级图(质控/物种组成/多样性/功能通路/差异分析), 调 metagenome_viz R 脚本", "🔧"],
    ["fastp 双端质控/去接头", "双端测序质控/去接头/去低质量, 输出 clean reads", "🔧"],
    ["MEGAHIT 宏基因组组装", "快速短读 de novo 组装为 contigs", "🔧"],
  ]},
  { c: "代谢组", ic: "atom", n: 2, t: [
    ["质谱格式转换", "ProteoWizard msconvert(Wine): 将厂商质谱格式转换为 mzML/mzXML/MGF", "⚗️"],
    ["XCMS 峰检测", "XCMS 代谢组学预处理: CentWave 峰检测 + PeakDensity 分组 → 特征矩阵 CSV", "⚗️"],
  ]},
];

/* ---------- 工作流：9 条（节点数与连线数由 steps / links 自洽推导） ---------- */
var FLOWS = [
  /* 蛋白组（f12）与代谢组（f07）置顶（v22）：这两条是本院重点线，在 12 条列表里
     原来排在末尾，得滚过一屏宏基因组 / 转录组流程才找得到。置顶只改列表顺序 ——
     orchFlowById 按 id 查，模板加载、徽章、断言全都不受影响。 */
  { id: 'f12', n: "蛋白组定量分析流程（MaxQuant + STRING）", d: "蛋白组：质谱 .mzML → MaxQuant 定量 → 缺失值过滤 → 差异倍数计算 → STRING 互作网络", s: "质谱 .mzML → MaxQuant 定量 → 缺失值过滤 → 差异倍数计算 → STRING 互作网络", nodes: ["质谱 .mzML 输入", "MaxQuant 定量", "缺失值过滤", "差异倍数计算", "STRING 互作网络"], links: [[0,1], [1,2], [2,3], [3,4]] },
  { id: 'f07', n: "代谢组学分析流程", d: "代谢组：质谱原始数据 → msconvert 格式转换 → XCMS 峰检测/分组 → 特征矩阵", s: "质谱原始数据 → 质谱格式转换 → XCMS 峰检测", nodes: ["质谱原始数据", "质谱格式转换(msconvert)", "XCMS 峰检测"], links: [[0,1], [1,2]] },
  { id: 'f01', n: "E2E-画布调参-临时", d: "点击打开画布", s: "输入集合 → FastQC 质控 → fastp 过滤", nodes: ["输入集合", "FastQC 质控", "fastp 过滤"], links: [[0,1], [1,2]] },
  { id: 'f02', n: "宏基因组·简化流程（fastp→去宿主→kraken2→bracken→humann+可视化）", d: "metagenome_v4 简化版：质控→宿主去除(GRCh38)→物种分类(Kraken2)→丰度估计(Bracken)→功能注释(HUMAnN)→全套可视化出图", s: "宏基因组 FASTQ 输入 → fastp 质控去接头 → bowtie2 去宿主 → kraken2 物种分类 → bracken 丰度估计 / humann 功能注释 → 可视化", nodes: ["空集合", "fastp 质控", "bowtie2 去宿主", "kraken2 物种分类", "bracken 丰度估计", "humann 功能注释", "可视化出图"], links: [[0,1], [1,2], [2,3], [3,4], [4,6], [2,5], [5,6]] },
  { id: 'f03', n: "宏基因组·深度宏基因组研究流程（metagenome_v4）", d: "FASTQ→fastp→宿主去除→MEGAHIT→Prodigal→MetaBAT2/SemiBin2/VAMB→CheckM2→GUNC→GTDB-Tk→dRep→eggNOG→CARD→VFDB→dbCAN3→VirSorter2→CheckV", s: "宏基因组 FASTQ 输入 → fastp 去接头质控 → 宿主序列比对(bowtie2) → MEGAHIT 组装 → Prodigal 基因预测 → 分箱(3 法) → MAG 质控 → 物种注释 → 去冗余 → 功能/耐药/毒力/病毒注释", nodes: ["FASTQ 输入", "fastp 质控", "bowtie2 去宿主", "MEGAHIT 组装", "Prodigal 基因预测", "MetaBAT2 分箱", "SemiBin2 分箱", "VAMB 分箱", "CheckM2 质控", "GUNC 污染检测", "GTDB-Tk 注释", "dRep 去冗余", "eggNOG 注释", "CARD 耐药", "VFDB 毒力", "dbCAN3 CAZyme", "VirSorter2 病毒", "CheckV 病毒 QC"], links: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,6], [6,7], [7,8], [8,9], [9,10], [10,11], [11,12], [12,13], [13,14], [14,15], [15,16], [16,17]] },
  { id: 'f04', n: "宏基因组·常规临床科研流程（metagenome_v4）", d: "FASTQ→FastQC→fastp→宿主去除→MetaPhlAn→HUMAnN→phyloseq/vegan/MaAsLin2→ggplot2（最低计算成本）", s: "宏基因组 FASTQ 输入 → FastQC 原始质控 → fastp 去接头质控 → 宿主序列比对(bowtie2) → MetaPhlAn 物种组成 → HUMAnN 功能注释 → R 统计与出图", nodes: ["FASTQ 输入", "FastQC 原始质控", "fastp 去接头质控", "bowtie2 去宿主", "MetaPhlAn 物种组成", "HUMAnN 功能注释", "R 统计与出图"], links: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,6]] },
  { id: 'f05', n: "宏基因组·标准生产级流程（metagenome_v4）", d: "QC→fastp→宿主去除→Read-based/组装→MAG QC→功能/AMR/毒力/CAZyme/病毒→统计", s: "宏基因组 FASTQ 输入 → FastQC → fastp → bowtie2 去宿主 → samtools → MetaPhlAn → HUMAnN → MEGAHIT 组装 → QUAST 评估 → Prodigal 预测 → MetaBAT2/SemiBin2/VAMB 分箱 → CheckM2 → GUNC → GTDB-Tk → dRep → eggNOG → CARD → VirSorter2 → R 统计", nodes: ["FASTQ 输入", "FastQC", "fastp", "bowtie2 去宿主", "samtools", "MetaPhlAn", "HUMAnN", "MEGAHIT 组装", "QUAST 评估", "Prodigal 预测", "MetaBAT2", "SemiBin2", "VAMB", "CheckM2", "GUNC", "GTDB-Tk", "dRep 去冗余", "eggNOG", "CARD 耐药", "VirSorter2", "R 统计出图"], links: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,6], [6,7], [7,8], [8,9], [9,10], [10,11], [11,12], [12,13], [13,14], [14,15], [15,16], [16,17], [17,18], [18,19], [19,20]] },
  { id: 'f06', n: "RNA-seq 完整分析流程", d: "RNA-seq 完整流水线：质控(fastp+FastQC) → 比对(HISAT2) → 定量(featureCounts) → PCA(聚类/批次评估) → 差异表达(DESeq2) → GO/KEGG 富集，链式 DAG 逐级注入上游 jobId", s: "Step1 质控 → Step2 比对 → Step3 定量 → Step4 PCA → Step5 差异表达 → Step6 GO/KEGG 富集", nodes: ["fastp 质控", "FastQC 报告", "HISAT2 比对", "featureCounts 定量", "PCA 聚类评估", "DESeq2 差异表达", "GO/KEGG 富集"], links: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,6]] },
  { id: 'f08', n: "16S 扩增子分析流程", d: "16S：manifest 清单 → qiime2 导入 → DADA2 降噪 → VSEARCH 分类(SILVA 138) → 物种丰度柱状图", s: "16S manifest 输入 → qiime2 数据导入 → DADA2 降噪 → VSEARCH 物种分类 → 物种丰度柱状图", nodes: ["16S manifest 输入", "qiime2 数据导入", "DADA2 降噪", "VSEARCH 物种分类", "物种丰度柱状图"], links: [[0,1], [1,2], [2,3], [3,4]] },
  { id: 'f09', n: "转录组 RNA-seq 分析流程", d: "转录组：输入双端 reads → fastp 质控 → HISAT2 比对 → samtools 排序 → featureCounts 定量", s: "输入 reads → fastp 快速质控 → HISAT2 序列比对 → Samtools 工具 → featureCounts 定量", nodes: ["输入 reads", "fastp 快速质控", "HISAT2 序列比对", "Samtools 排序", "featureCounts 定量"], links: [[0,1], [1,2], [2,3], [3,4]] },
  /* f10–f12 是「选分析类型」那四张可用卡片里原先没有对应流程的三张。
     没有它们，卡片高亮与画布就对不上号 —— 点「基因变异分析」时画布还停在
     转录组流程上，同屏自相矛盾。节点与卡片上写的软件（GATK/VEP、
     clusterProfiler、MaxQuant/STRING）一一对应。 */
  { id: 'f10', n: "基因变异分析流程（GATK + VEP）", d: "变异：VCF 输入 → bcftools 规范化 → GATK 变异过滤 → VEP 功能注释 → ACMG 致病性分级 → ClinVar/OMIM 比对", s: "VCF 输入 → bcftools 规范化 → GATK 变异过滤 → VEP 功能注释 → ACMG 致病性分级 → ClinVar/OMIM 比对", nodes: ["VCF 输入", "bcftools 规范化", "GATK 变异过滤", "VEP 功能注释", "ACMG 致病性分级", "ClinVar/OMIM 比对"], links: [[0,1], [1,2], [2,3], [3,4], [4,5]] },
  { id: 'f11', n: "功能富集分析流程（clusterProfiler）", d: "富集：差异基因列表 → 背景基因集构建 → GO 富集 → KEGG 通路富集 → 富集气泡图与通路网络", s: "差异基因列表 → 背景基因集构建 → GO 富集 → KEGG 通路富集 → 富集气泡图", nodes: ["差异基因列表", "背景基因集构建", "GO 富集分析", "KEGG 通路富集", "富集气泡图"], links: [[0,1], [1,2], [2,3], [3,4]] },
];

/* 「选分析类型」那 5 张卡片 → 内置流程。画布默认跟随被选中的那张卡片，
   两者永远指同一条流程；metab 的卡是灰的（缺 .mzML），流程本身仍在库里。 */
var ANALYSIS_FLOW = { variant: 'f10', de: 'f06', enrich: 'f11', prot: 'f12', metab: 'f07' };
var DEFAULT_ANALYSIS = 'de';                          /* §1 里带 is-on 的那张卡 */
var DEFAULT_FLOW = ANALYSIS_FLOW[DEFAULT_ANALYSIS];   /* f06 */

/* 卡片 key 与中文名的对应，回到画布名与 toast 都要用 */
var ANALYSIS_NAME = {
  variant: '基因变异分析', de: '差异表达分析', enrich: '功能富集分析',
  prot: '蛋白组定量分析', metab: '代谢组分析'
};


/* ---------- 工具 → 镜像内可执行命令（命令预览用，实测抓取 + 同类补全） ---------- */
var TOOLBIN = {
  "Cutadapt 去接头": "cutadapt",
  "Trimmomatic 读段修剪": "trimmomatic",
  "fastp 快速质控": "fastp",
  "FastQC 质量报告": "fastqc",
  "TopHat 转录组比对": "tophat2",
  "HISAT2 序列比对": "hisat2",
  "featureCounts 基因定量": "featureCounts",
  "Samtools 工具": "samtools",
  "差异表达分析(DESeq2/edgeR/limma)": "Rscript deseq2.R",
  "rMATS 可变剪切 Sashimi 可视化": "rmats2sashimiplot",
  "R 热图绘制": "Rscript pheatmap.R",
  "ggplot2 火山图绘制": "Rscript volcano.R",
  "Rscript 脚本运行": "Rscript",
  "Bracken 物种丰度估计": "bracken",
  "seqkit": "seqkit",
  "Circos 圈图可视化": "circos",
  "bcftools": "bcftools",
  "bedtools 基因组区间操作": "bedtools",
  "ggplot2 箱线图": "Rscript boxplot.R",
  "rMATS 可变剪切": "rmats.py",
  "STAR-Fusion 融合基因": "STAR-Fusion",
  "qiime2 数据导入": "qiime tools import",
  "DADA2 降噪": "qiime dada2 denoise-paired",
  "VSEARCH 物种分类": "qiime feature-classifier",
  "物种丰度柱状图": "qiime taxa barplot",
  "dRep 基因组去冗余": "dRep",
  "FastQC 原始质量报告": "fastqc",
  "MultiQC 报告汇总": "multiqc",
  "Bowtie2 宿主序列去除": "bowtie2",
  "Samtools SAM/BAM 处理": "samtools",
  "MetaPhlAn 物种组成": "metaphlan",
  "Kraken2 物种分类": "kraken2",
  "QUAST 组装质量评估": "quast.py",
  "Prodigal 基因预测": "prodigal",
  "MetaBAT2 MAG 分箱": "metabat2",
  "SemiBin2 半监督分箱": "SemiBin2",
  "VAMB 深度分箱": "vamb",
  "CheckM2 MAG 完整度/污染": "checkm2",
  "GUNC 嵌合/污染检测": "gunc",
  "GTDB-Tk 物种注释": "gtdbtk",
  "HUMAnN 功能注释": "humann",
  "eggNOG-mapper 功能注释": "emapper.py",
  "RGI CARD 耐药注释": "rgi",
  "ABRicate 毒力/耐药扫描": "abricate",
  "dbCAN CAZyme 注释": "run_dbcan",
  "VirSorter2 病毒识别": "virsorter",
  "CheckV 病毒 QC": "checkv",
  "R 统计分析与绘图": "Rscript rstats.R",
  "Bracken 丰度估计": "bracken",
  "宏基因组可视化": "Rscript metagenome_viz.R",
  "fastp 双端质控/去接头": "fastp",
  "MEGAHIT 宏基因组组装": "megahit",
  "质谱格式转换": "msconvert",
  "XCMS 峰检测": "Rscript xcms.R",
};


/* ============================================================
   整体移植层：工作区外壳
   （信息架构对齐 BioAgent Studio；数据来自 2026-09-20 实测抓取，名称已局部脱敏）
   ============================================================ */

/* ---------- 项目 ----------
   规模数字（sm / u / rn）是唯一数据源：卡片上那行「71 例共同样本 · 9 条流程」
   与详情抽屉里的四个指标都从它现算。以前这行是手写在 m 字段里的，详情页再列
   一遍就成了两份数字，早晚会漂。
   u（单位）随数据走、不写死「例样本」：本项目里出现过「例样本 / 例共同样本 / 细胞」
   三种口径，统一成一种就是把 100,605 个细胞说成 100,605 例样本。 */
var PROJECTS = [
  { id: 'P-2026-001', n: '原发性肝癌转录组示范项目', kind: '课题项目', sp: '人类', ref: 'hg38', vis: '空间内公开',
    own: '王工', sm: 71, u: '例共同样本', rn: 9, tags: ['转录组', 'TCGA-LIHC', '差异表达'],
    st: '成功', created: '2026-08-20 09:30', t: '2026-09-18 10:24', on: true,
    d: 'TCGA-LIHC 371 例肿瘤 + 50 例正常；流程：质控 → 比对 → 定量 → 差异表达 → 富集' },
  { id: 'P-2026-002', n: '肠道微生物宏基因组探索计划', kind: '课题项目', sp: '微生物', ref: '—', vis: '空间内公开',
    own: '陈博士', sm: 38, u: '例样本', rn: 21, tags: ['宏基因组', '物种注释', '功能通路'],
    st: '分析中', created: '2026-08-18 14:12', t: '2026-09-12 16:40', on: false,
    d: '粪便宏基因组测序、物种注释与功能通路分析，覆盖 5 条 metagenome_v4 流程' },
  { id: 'P-2026-003', n: '小鼠肝脏禁食-进食代谢', kind: '数据复现', sp: '小鼠', ref: 'mm10', vis: '空间内公开',
    own: '王工', sm: 40, u: '例样本', rn: 4, tags: ['转录组', 'GEO', '代谢'],
    st: '成功', created: '2026-08-16 11:05', t: '2026-09-05 09:15', on: false,
    d: 'GEO GSE137385 · 40 例（8 组 × 5 只，C57BL/6J / BALB/c）' },
  { id: 'P-2026-004', n: '小鼠肝脏饮食干预模型', kind: '数据复现', sp: '小鼠', ref: 'mm10', vis: '仅项目成员',
    own: '陈博士', sm: 18, u: '例样本', rn: 3, tags: ['转录组', 'GEO', '饮食干预'],
    st: '失败', created: '2026-08-14 16:40', t: '2026-08-30 14:02', on: false,
    d: 'GEO GSE36838 · 18 例（6 组 × 3 只，高脂 / 低脂 / 热量限制 / 运动）' },
  { id: 'P-2026-005', n: '1000 Genomes 群体结构分析', kind: '数据复现', sp: '人类', ref: 'hg38', vis: '空间内公开',
    own: '赵工', sm: 2504, u: '例样本', rn: 2, tags: ['群体遗传', 'IGSR', '变异位点'],
    st: '成功', created: '2026-08-12 09:50', t: '2026-08-28 11:30', on: false,
    d: 'IGSR Phase 3 · 2,504 人 · 26 群体，用于变异位点与群体分层基线校验' },
  { id: 'P-2026-006', n: 'Tabula Muris 单细胞图谱复现', kind: '数据复现', sp: '小鼠', ref: 'mm10', vis: '空间内公开',
    own: '陈博士', sm: 100605, u: '细胞', rn: 2, tags: ['单细胞', 'GEO', '细胞注释'],
    st: '成功', created: '2026-08-10 15:20', t: '2026-08-25 17:48', on: false,
    d: 'GEO GSE109774 · 100,605 细胞 · 20 器官，用于细胞类型注释方法比对' },
  { id: 'P-2026-007', n: '16S 扩增子方法学验证', kind: '方法学验证', sp: '微生物', ref: '—', vis: '空间内公开',
    own: '孙医生', sm: 24, u: '例样本', rn: 1, tags: ['16S', 'qiime2', '方法学'],
    st: '失败', created: '2026-08-08 10:35', t: '2026-08-22 10:05', on: false,
    d: 'qiime2 + DADA2 + VSEARCH(SILVA 138) 全流程方法学比对与重复性评估' },
  { id: 'P-2026-008', n: '代谢组质控流程验证', kind: '方法学验证', sp: '不限定', ref: '—', vis: '仅项目成员',
    own: '孙医生', sm: 32, u: '例样本', rn: 1, tags: ['代谢组', 'XCMS', '质控'],
    st: '成功', created: '2026-08-06 14:05', t: '2026-08-21 15:22', on: false,
    d: 'msconvert → XCMS CentWave 峰检测 + PeakDensity 分组 → 特征矩阵' },
  { id: 'P-2026-009', n: 'RNA-seq 标准流程验证', kind: '方法学验证', sp: '人类', ref: 'hg38', vis: '空间内公开',
    own: '王工', sm: 12, u: '例样本', rn: 2, tags: ['转录组', '镜像基线', '回归'],
    st: '分析中', created: '2026-08-05 17:20', t: '2026-08-21 17:01', on: false,
    d: 'fastp → HISAT2 → samtools → featureCounts，索引与镜像版本基线固化' },
  { id: 'P-2026-010', n: '宏基因组标准生产级流程验证', kind: '方法学验证', sp: '微生物', ref: '—', vis: '仅项目成员',
    own: '赵工', sm: 16, u: '例样本', rn: 1, tags: ['宏基因组', '生产级', 'MAG'],
    st: '成功', created: '2026-08-04 09:15', t: '2026-08-20 09:40', on: false,
    d: '21 步 metagenome_v4 生产级流水线，含 MAG 质控与 AMR / 毒力 / CAZyme / 病毒注释' },
  { id: 'P-2026-011', n: '冠心病转录组分析（横向课题）', kind: '横向课题', sp: '人类', ref: 'hg38', vis: '私有',
    own: '周研究员', sm: 48, u: '例样本', rn: 3, tags: ['转录组', '横向课题', '脱敏'],
    st: '成功', created: '2026-08-02 15:45', t: '2026-08-15 15:45', on: false,
    d: '院内横向课题，样本已脱敏，仅保留分组标签' },
  { id: 'P-2026-012', n: '教学沙箱', kind: '教学沙箱', sp: '多物种', ref: 'hg38', vis: '空间内公开',
    own: '吴工', sm: 6, u: '例样本', rn: 9, tags: ['教学', '沙箱', '可重跑'],
    st: '失败', created: '2026-08-01 10:00', t: '2026-08-15 15:45', on: false,
    d: '用于培训与流程试跑，产物不进入正式归档' },
  { id: 'P-2026-013', n: '血清蛋白组 DIA 定量方法学验证', kind: '方法学验证', sp: '人类', ref: '—', vis: '仅项目成员',
    own: '孙医生', sm: 24, u: '例样本', rn: 2, tags: ['蛋白组', 'DIA', '方法学'],
    st: '成功', created: '2026-08-03 10:20', t: '2026-09-11 15:20', on: false,
    d: 'DIA 数据非依赖采集 + 谱图库匹配，评估血清蛋白组定量的重复性与缺失率，为三组学联合分析补齐蛋白组一路' }
];

/* 卡片 / 列表 / 详情三处共用的一行摘要，避免三份数字各自演化 */
function projMeta(p) { return fmtNum(p.sm) + ' ' + p.u + ' · ' + p.rn + ' 条流程'; }
function projById(id) { return PROJECTS.filter(function (p) { return p.id === id; })[0]; }
function curProj() { return PROJECTS.filter(function (p) { return p.on; })[0]; }

/* ============================================================
   项目组（v47 需求 3）
   ============================================================
   「项目组」原先不是一个概念，而是**同一份名单被抄在三个地方**：
     ① 新建项目第 1 步「所属项目组」下拉 —— 一张写死的名字数组 PNEW_GROUPS
     ② 文件管理 › 团队上传的「所属项目组」—— 另写了两个名字的字面量数组
     ③ 建项目时把组名塞进项目的 tags
   三份名单各自演化，而且**没有任何地方能回答「这个组是谁在管、审没审过」**。
   合并成这一张表之后，三处都读它，系统管理里多一页专门管它。

   两个状态轴，含义不同，不要混在一起：
     · on   启用 / 禁用：控制它**出不出现**在选择项里（新建项目、团队上传）
     · st   审核状态（通过 / 待审核 / 驳回）：由审核决定，本页只读、不能改
   「禁用」是管理动作，「驳回」是审核结论 —— 一个组完全可以是
   「已通过但被停用」（历史上在用，现在不再接收新项目）。 */
var PROJ_GROUPS = [
  { n: '肝癌免疫队列',   members: ['王工', '陈铭', '李倩'],           on: true,  st: 'pass',    created: '2026-06-04 15:25:56', own: '管理员' },
  { n: '血清蛋白组 DIA', members: ['孙医生', '李倩'],                 on: true,  st: 'pass',    created: '2026-06-05 11:44:04', own: '管理员' },
  { n: '肝脏疾病队列',   members: ['陈博士', '王工', '赵工', '吴工'], on: true,  st: 'pass',    created: '2026-06-08 11:20:06', own: '王工' },
  { n: '肠道微生物组',   members: ['陈博士', '周研究员'],             on: true,  st: 'pending', created: '2026-08-18 11:21:24', own: '陈博士' },
  { n: '方法学验证组',   members: ['孙医生', '赵工', '吴工'],         on: true,  st: 'pass',    created: '2026-08-18 14:05:07', own: '孙医生' },
  { n: '教学沙箱',       members: ['吴工', '周研究员'],               on: false, st: 'pass',    created: '2026-06-04 15:34:26', own: '吴工' },
  { n: '横向课题协作组', members: ['周研究员', '陈铭', '李倩'],       on: false, st: 'reject',  created: '2026-09-20 14:03:36', own: '管理员' }
];

/* 新增项目的自增号：与项目编号同一套做法（看现有最大号往后排），
   不写死一个「下一个是 G-008」—— 那种常量删一条就撞号。 */
function pgNextId() {
  var mx = 0;
  PROJ_GROUPS.forEach(function (g) {
    var m = /^PG-(\d+)$/.exec(g.id || '');
    if (m && +m[1] > mx) mx = +m[1];
  });
  return 'PG-' + String(mx + 1).padStart(3, '0');
}
PROJ_GROUPS.forEach(function (g, i) { if (!g.id) g.id = 'PG-' + String(i + 1).padStart(3, '0'); });

function pgById(id) { return PROJ_GROUPS.filter(function (g) { return g.id === id; })[0] || null; }
function pgByName(n) { return PROJ_GROUPS.filter(function (g) { return g.n === n; })[0] || null; }

/* 「可选的项目组」= 已通过 且 启用。**新建项目与团队上传必须取同一份** ——
   两处各写一套口径，迟早出现「上传时能选、建项目时选不到」这种自相矛盾。
   待审核的组不能选（还没批），驳回的不能选（没通过），禁用的不能选（停了）。 */
function pgPickable() {
  return PROJ_GROUPS.filter(function (g) { return g.on && g.st === 'pass'; });
}
function pgPickNames() { return pgPickable().map(function (g) { return g.n; }); }

var PG_ST = {
  pass:    { t: '通过',   cls: 'tag--ok',     ic: 'circle-check' },
  pending: { t: '待审核', cls: 'tag--warn',   ic: 'hourglass-half' },
  reject:  { t: '驳回',   cls: 'tag--danger', ic: 'circle-xmark' }
};

/* 哪些行允许删：只有**已驳回**的组。
   理由：待审核的组可能马上通过（删早了要重走一遍申请），已通过的组很可能
   已经被项目 / 文件引用（删掉会让那些东西的归属悬空）；只有已驳回的组
   确定不会被采用，删掉不影响任何历史数据。 */
function pgDeletable(g) { return g.st === 'reject'; }

/* ---------- 当前登录用户与角色（v54：三档，一套到底） ----------
   在此之前原型里有**两套**并存的角色，混着用会出岔子：
     ① 顶栏「视图角色」：临床医生 / PI ⇄ 生信工程师 —— 只切界面上露哪些控件
        （.cli-only / .eng-only），**不改变任何权限**；
     ② 项目组页「组织身份」：管理员 / 项目负责人 / 普通成员 —— 管权限。
   并存的问题是：切了①却改不了任何权限，人分不清哪个才是自己的身份；
   而且同一件事有两个入口，改了一个另一个不同步。
   v54 合并成一档。名单就在下面，**全站唯一来源**：

     超级管理员  超级管理员 / 信息科 / 样本库负责人  → 所有权限
     普通管理员  主管 / 知识库管理员 / 项目负责人    → 增删改查 / 审批
     普通用户    普通用户                            → 查看 / 新增

   权限判定一律走这三个函数，别在渲染里写 `role === 'xxx'` 字面量：
     canManage()  增删改查与审批（项目组治理、知识库审核发布与归档）
     canConfig()  系统级配置（示例数据集展示设置）—— 只有超级管理员
     isBasic()    普通用户（查看 / 新增；工程细节不可见）
   视图差异由角色顺带决定，见 app.css 里 body[data-role="user"] .eng-only。 */
var ROLES = [
  { k: 'super', n: '超级管理员', who: '超级管理员 / 信息科 / 样本库负责人', ico: 'shield-halved', p: '所有权限' },
  { k: 'admin', n: '普通管理员', who: '主管 / 知识库管理员 / 项目负责人', ico: 'user-gear', p: '增删改查 / 审批' },
  { k: 'user',  n: '普通用户',   who: '普通用户',                         ico: 'user', p: '查看 / 新增' }
];
var CUR_USER = { n: '陈明远', role: 'super' };
function roleDef() { return ROLES.filter(function (r) { return r.k === CUR_USER.role; })[0] || ROLES[0]; }
function roleName() { return roleDef().n; }
function pgRoleTxt() { return roleName(); }
function canManage() { return CUR_USER.role === 'super' || CUR_USER.role === 'admin'; }
function canConfig() { return CUR_USER.role === 'super'; }
function isBasic() { return CUR_USER.role === 'user'; }
function pgCanWrite() { return canManage(); }

/* v56 需求：系统文件也要能上传，通常由系统管理员上传。
   系统文件是**平台公共参考数据** —— 全体用户都读它，所以「谁能写」不能跟
   个人 / 团队文件同档（那两个是自己的数据，写了只影响自己）。这里取
   canConfig()（仅超级管理员），与「示例数据集设置」同一口径：那也是平台级
   配置、也是只有超级管理员能改。
   读（预览 / 下载）对所有人开放 —— 权限管的是写，不是看。 */
function fmCanWrite() { return canConfig(); }
function fmWriteWhy() {
  return fmCanWrite() ? '' : '系统文件由平台统一维护，仅「超级管理员」可上传或修改：当前身份（'
    + roleName() + '）可以查看与下载，但不能改动。';
}

/* 顶栏当前用户（v54）：一个按钮 + 一个三选项菜单，是**全站唯一**的身份入口
   （项目组页那个身份开关已撤 —— 同一件事两个入口，改了一个另一个不同步）。
   菜单里每个角色都写清「它是谁 + 能做什么」，因为界面上人只看得到角色名。 */
function renderUserSw() {
  var d = roleDef();
  var av = $('#userSwAv'), nm = $('#userSwName'), wh = $('#userSwWho'), list = $('#popUserList');
  if (av) av.innerHTML = ico(d.ico);
  if (nm) nm.textContent = d.n;
  if (wh) wh.textContent = d.who;
  if (list) {
    list.innerHTML = ROLES.map(function (r) {
      var on = r.k === CUR_USER.role;
      return '<button type="button" class="useropt' + (on ? ' is-on' : '') + '"'
        + ' data-user-role="' + r.k + '" aria-pressed="' + (on ? 'true' : 'false') + '">'
        + '<span class="useropt__av">' + ico(r.ico) + '</span>'
        + '<span class="useropt__bd">'
        +   '<span class="useropt__n">' + esc(r.n) + (on ? ' · 当前' : '') + '</span>'
        +   '<span class="useropt__d">' + esc(r.who) + '</span>'
        +   '<span class="useropt__p">' + esc(r.p) + '</span>'
        + '</span></button>';
    }).join('');
  }
}

/* 切换身份：一处改，到处跟着变 —— 顶栏、body 的 data-role、三个受权限影响的页面。
   data-role 挂在 body 上（不是按钮上）：CSS 靠它决定普通用户看不看得到
   .eng-only 那批工程细节。少刷任何一处，都会留下面貌与权限不一致的残影。 */
function setRole(k) {
  var ok = ROLES.some(function (r) { return r.k === k; });
  if (!ok || k === CUR_USER.role) return false;
  CUR_USER.role = k;
  /* 换身份先清勾选与编辑态：上一档勾中的行在新档可能已不可操作，
     留着会让「删除」拿着一个当前身份动不了的选择。 */
  PG_SEL = {}; PG_EDIT = null;
  document.body.setAttribute('data-role', k);
  renderUserSw();
  renderProjGroups();     /* 项目组治理：增删改查 / 审批 */
  renderKb2Admin();       /* 知识库审批：审核发布 / 归档 */
  renderDemoSet();        /* 系统级配置：示例数据集展示设置 */
  renderFM();             /* v56 文件管理：系统文件的上传 / 删改权限随身份变 */
  toast('已切换到「' + roleName() + '」：' + roleDef().p, 'ok');
  return true;
}

/* ---------- 样本（双端转录组，两组各 3 例） ---------- */
/* 第 7 列是所属项目：详情抽屉里「本项目关联样本」按它过滤。
   这 6 例 DRR 就是 P-2026-001 的转录组数据，不是为了凑数新编的。 */
var SAMPLES = [
  ['DRR091867', '测序', '/data/transcriptome/DRR091867_1.fastq.gz', '/data/transcriptome/DRR091867_2.fastq.gz', 'group_2', '', 'P-2026-001'],
  ['DRR091869', '测序', '/data/transcriptome/DRR091869_1.fastq.gz', '/data/transcriptome/DRR091869_2.fastq.gz', 'group_2', '', 'P-2026-001'],
  ['DRR091871', '测序', '/data/transcriptome/DRR091871_1.fastq.gz', '/data/transcriptome/DRR091871_2.fastq.gz', 'group_1', '', 'P-2026-001'],
  ['DRR091873', '测序', '/data/transcriptome/DRR091873_1.fastq.gz', '/data/transcriptome/DRR091873_2.fastq.gz', 'group_1', '', 'P-2026-001'],
  ['DRR091875', '测序', '/data/transcriptome/DRR091875_1.fastq.gz', '/data/transcriptome/DRR091875_2.fastq.gz', 'group_1', '', 'P-2026-001'],
  ['DRR091877', '测序', '/data/transcriptome/DRR091877_1.fastq.gz', '/data/transcriptome/DRR091877_2.fastq.gz', 'group_2', '', 'P-2026-001']
];

/* ---------- 数据集（对齐 Galaxy Collection） ---------- */
/* pj = 所属项目。归属不是随便挂的：前两条的时间戳 2026-08-21 17:01 / 17:05
   正是 P-2026-009「RNA-seq 标准流程验证」的更新时间；后两条 2026-09-18 与
   P-2026-001 的更新时间同一天。 */
/* 每个集合都挂着 pj（产出它的项目）：v40 起数据集唯一的露出地点就是
   「项目概况 › 数据集」页签，没有 pj 的集合将没有去处 —— 所以这一列不能空。
   dir：in = 从外部读入项目的材料，out = 流程跑出来的成果（同一份成果可以
   在下一条流程里当 input 用，那时它是另一个项目/另一次运行的 in）。 */
var COLLECTIONS = [
  /* P-2026-001 原发性肝癌转录组示范项目：一条 RNA-seq 流程从头到尾的产物 */
  { id: '2090744108823310337', n: 'TCGA-LIHC 表达矩阵', kind: '单文件', dir: 'in', el: 421, job: '—', t: '2026-09-18 10:12', pj: 'P-2026-001' },
  { id: '2090743551027761154', n: 'hg38 HISAT2 索引', kind: '单文件', dir: 'in', el: 1, job: '—', t: '2026-09-18 10:10', pj: 'P-2026-001' },
  { id: '2090743551027761198', n: 'fastp 质控后双端 reads', kind: '配对(双端)', dir: 'out', el: 71, job: '628', t: '2026-09-18 11:02', pj: 'P-2026-001' },
  { id: '2090743551027761203', n: 'HISAT2 比对结果（BAM）', kind: '配对(双端)', dir: 'out', el: 71, job: '631', t: '2026-09-18 12:40', pj: 'P-2026-001' },
  { id: '2090743551027761211', n: 'featureCounts 基因表达矩阵', kind: '单文件', dir: 'out', el: 71, job: '634', t: '2026-09-18 14:15', pj: 'P-2026-001' },
  { id: '2090743551027761226', n: 'DESeq2 差异表达结果表', kind: '单文件', dir: 'out', el: 1, job: '639', t: '2026-09-18 16:08', pj: 'P-2026-001' },
  /* P-2026-009 RNA-seq 标准流程验证 */
  { id: '2090726050477199361', n: 'test1', kind: '配对(双端)', dir: 'in', el: 6, job: '—', t: '2026-08-21 17:01', pj: 'P-2026-009' },
  { id: '2090726914172473346', n: 'fastp 快速质控（输出）', kind: '配对(双端)', dir: 'out', el: 6, job: '626', t: '2026-08-21 17:05', pj: 'P-2026-009' },
  /* P-2026-002 肠道微生物宏基因组探索计划（分析中：组装已出、注释在跑） */
  { id: '2090745107730044112', n: '粪便宏基因组原始双端数据', kind: '配对(双端)', dir: 'in', el: 38, job: '—', t: '2026-09-12 10:26', pj: 'P-2026-002' },
  { id: '2090745107730044178', n: 'MEGAHIT 组装 contigs', kind: '单文件', dir: 'out', el: 1, job: '651', t: '2026-09-12 15:44', pj: 'P-2026-002' },
  { id: '2090745107730044195', n: 'Kraken2 物种注释结果', kind: '单文件', dir: 'out', el: 38, job: '653', t: '2026-09-12 16:38', pj: 'P-2026-002' },
  /* P-2026-003 小鼠肝脏禁食-进食代谢 */
  { id: '2090733158810742274', n: 'GSE137385 表达矩阵', kind: '单文件', dir: 'in', el: 40, job: '—', t: '2026-09-05 08:50', pj: 'P-2026-003' },
  { id: '2090733158810742296', n: '时间序列差异表达结果', kind: '集合', dir: 'out', el: 8, job: '612', t: '2026-09-05 09:12', pj: 'P-2026-003' },
  /* P-2026-005 1000 Genomes 群体结构分析 */
  { id: '2090721005533810662', n: '1000G Phase3 chr1-22 VCF', kind: '单文件', dir: 'in', el: 2504, job: '—', t: '2026-08-28 09:04', pj: 'P-2026-005' },
  { id: '2090721005533810689', n: 'PCA 群体结构坐标', kind: '单文件', dir: 'out', el: 1, job: '590', t: '2026-08-28 11:26', pj: 'P-2026-005' },
  /* P-2026-006 Tabula Muris 单细胞图谱复现 */
  { id: '2090718449900128507', n: 'Tabula Muris 肝脏子集', kind: '单文件', dir: 'in', el: 1, job: '—', t: '2026-08-24 14:20', pj: 'P-2026-006' },
  { id: '2090718449900128543', n: 'Seurat 细胞注释结果', kind: '单文件', dir: 'out', el: 12, job: '578', t: '2026-08-25 10:08', pj: 'P-2026-006' }
];

/* ---------- 运行日志（超管视图样本） ---------- */
var LOGS = [
  ['2026-09-20 17:06:19', '管理员', '工具执行', '成功', '原发性肝癌转录组示范项目', 'fastp 快速质控 · 6/6 样本完成 · 耗时 26s'],
  ['2026-09-20 17:06:15', '管理员', '流程运行', '运行中', '原发性肝癌转录组示范项目', '转录组 RNA-seq 分析流程 #068290 · 4/4 节点'],
  ['2026-09-20 17:03:31', '管理员', '数据上传', '成功', '原发性肝癌转录组示范项目', 'metadata.tsv · 3.1 KB'],
  ['2026-09-20 17:03:29', '管理员', '数据上传', '成功', '原发性肝癌转录组示范项目', 'DRR091877_1.fastq.gz / DRR091877_2.fastq.gz · 1.8 GB'],
  ['2026-09-20 16:41:20', '管理员', '工具执行', '成功', 'RNA-seq 标准流程验证', 'featureCounts 基因定量 · 生成 counts.tsv'],
  ['2026-09-20 16:22:07', '管理员', '流程运行', '成功', 'RNA-seq 标准流程验证', 'RNA-seq 完整分析流程 #068287 · 7/7 节点 · 耗时 42m18s'],
  ['2026-09-20 15:10:44', '管理员', '工具执行', '失败', '宏基因组标准生产级流程验证', 'MEGAHIT 宏基因组组装 · 内存超限（申请 128 GB，可用 96 GB）'],
  ['2026-09-20 14:33:18', '管理员', '流程运行', '运行中', '肠道微生物宏基因组探索计划', '宏基因组·标准生产级流程 #068284 · 11/21 节点'],
  ['2026-09-20 11:20:33', '管理员', '数据上传', '成功', '代谢组质控流程验证', 'QC_POOL_01.mzML · 246 MB'],
  ['2026-09-20 10:05:12', '管理员', '工具执行', '成功', '代谢组质控流程验证', '质谱格式转换(msconvert) · raw → mzML · 32 文件']
];


/* ---------- 运行历史（右栏） ---------- */
var HIST = [
  { ic: 'screwdriver-wrench', n: 'fastp 快速质控', m: '单工具 · 输出 6/7 样本', s: 'run', p: 62, e: '剩余 107s', t: '2026-09-20 17:06:02', k: 'job 626' },
  { ic: 'gear', n: '运行 #068290', m: '工作流 · 转录组 RNA-seq 分析流程 · 4/4 节点', s: 'ok', e: '耗时 2m26s', t: '2026-09-20 17:03:36', k: '' },
  { ic: 'screwdriver-wrench', n: 'fastp 快速质控', m: '单工具 · 上传完成', s: 'ok', e: '耗时 26s', t: '2026-09-20 17:03:31', k: '' },
  { ic: 'file-lines', n: 'metadata.tsv', m: '上传', s: 'ok', e: '3.1 KB', t: '2026-09-20 17:03:31', k: '' },
  { ic: 'file-lines', n: 'DRR091877_1.fastq.gz', m: '上传', s: 'ok', e: '912 MB', t: '2026-09-20 16:33:57', k: '' },
  { ic: 'file-lines', n: 'DRR091877_2.fastq.gz', m: '上传', s: 'ok', e: '905 MB', t: '2026-09-20 16:33:57', k: '' },
  { ic: 'file-lines', n: 'DRR091875_1.fastq.gz', m: '上传', s: 'ok', e: '898 MB', t: '2026-09-20 16:33:56', k: '' },
  { ic: 'file-lines', n: 'DRR091875_2.fastq.gz', m: '上传', s: 'ok', e: '902 MB', t: '2026-09-20 16:33:56', k: '' },
  { ic: 'file-lines', n: 'DRR091873_1.fastq.gz', m: '上传', s: 'ok', e: '921 MB', t: '2026-09-20 16:33:55', k: '' },
  { ic: 'file-lines', n: 'DRR091873_2.fastq.gz', m: '上传', s: 'ok', e: '917 MB', t: '2026-09-20 16:33:55', k: '' }
];

/* ---------- 智能体 ---------- */
var AGENT_QA = {
  /* 项目这两条不能写死数字。上一版把「12 个项目」和「数据集 4 个」写死在字符串里，
     本轮项目可以新建、数据集有了项目归属之后，同一个屏上就会出现
     「详情抽屉说 2 个数据集、智能体说 4 个」的矛盾。
     存函数、由 agentAsk 在提问时求值（值是函数就现场调用）。 */
  '查看项目': projQaText,
  '查看流程': '当前项目下共 <b>9 条流程</b>。与转录组最匹配的两条：\n\n'
    + '· <b>转录组 RNA-seq 分析流程</b>（5 节点）：fastp 质控 → HISAT2 比对 → samtools 排序 → featureCounts 定量\n'
    + '· <b>RNA-seq 完整分析流程</b>（7 节点）：质控 → 比对 → 定量 → PCA 聚类评估 → DESeq2 差异表达 → GO/KEGG 富集，链式 DAG 逐级注入上游 jobId\n\n'
    + '宏基因组方向另有 4 条 metagenome_v4 流程（3 / 7 / 18 / 21 步）。',
  '查看最近任务': '当前项目最近 3 条运行记录（右栏可看完整 10 条）：\n\n'
    + '· fastp 快速质控 · 运行中 62% · 剩余 107s\n'
    + '· 运行 #068290 · 转录组 RNA-seq 分析流程 · 4/4 节点 · 成功 · 2m26s\n'
    + '· fastp 快速质控 · 成功 · 26s\n\n'
    + '有一条 <b>MEGAHIT 宏基因组组装</b>今天 15:10 因内存超限失败——申请 128 GB，当时可用 96 GB。',
  '查看项目统计': projQaStatsText,
  '有哪些工具': '工具库共 <b>54 个工具 / 9 大类</b>：\n\n'
    + '· 数据预处理 4 · 序列比对 2 · 基因定量 2 · 统计分析 5\n'
    + '· 功能与高级分析 8 · 16S 扩增子 4 · 宏基因组 27 · 代谢组 2\n'
    + '· 转录组分析当前为组合视图，无独立工具'
};

var AGENT_CONFIRM = {
  '跑 RNA-seq 流程': {
    ask: '运行流程「<b>转录组 RNA-seq 分析流程</b>」\n'
      + '· 项目：原发性肝癌转录组示范项目\n'
      + '· 输入集合：test1（6 元素 · 配对双端）\n'
      + '· 参考基因组：GRCh38 / HISAT2 索引（已内置）\n'
      + '· 预计占用：8 核 / 32 GB · 约 42 分钟',
    done: '✅ 流程已提交运行（#2090726494893XXX），已挂到「原发性肝癌转录组示范项目」下。可在右下角右栏运行历史里看进度，第一个节点 fastp 质控开始后会滚动输出日志。'
  }
};

var AGENT_FALLBACK = '我还没完全理解。可以试试这些：\n\n· 查看项目\n· 查看流程\n· 查看最近任务\n· 查看项目统计\n· 有哪些工具\n· 跑 RNA-seq 流程\n\n也可以直接问我某个工具的用法，例如「HISAT2 怎么配参考基因组索引」。';

/* ============================================================
   左栏：分组导航
   ============================================================
   顶栏原本平铺 7 个一级工作区，其中 5 个是纯 CRUD 管理页，
   结果「这是一条从数据到结论的分析流水线」这个最重要的事实被挤没了。
   现在的主流程还给左栏，管理类能力降级成第二个分组。 */
/* 两级树的「形状」全在这张表里：一级带图标（grp.i），二级是纯文字缩进。
   二级的 i 字段保留但**当前不渲染** —— 图标让给一级之后，层级差靠
   「图标 / 缩进 / 字重」三样表达，比上下都挂图标清楚得多。
   s 字段（数量徽标）整条退场（v50 需求 1）：见下面 navCount 位置留的说明。

   off: true = **这一组不上菜单**（v50 需求 4）。页面、数据、面包屑组名、
   分组落点全部照旧，只是不画在左栏里 —— 与 #page-sample「保留不上菜单」
   是同一种表达，理由也一样：入口改了地方，不等于这个页面消失了。 */
var NAVGROUPS = [
  /* g 为 '' 的组是「顶级叶子项」：没有可折叠的父级，直接渲染成一条加粗入口。
     目前只有「工作台」——它和其它五个分组同级，但本身不是一个分组。 */
  { g: '', items: [
    { id: 'p01', i: 'flask-vial' }
  ] },
  { g: '数据资产', i: 'database', items: [
    { id: 'gene', i: 'dna' },
    { id: 'files', i: 'folder-tree' }   /* v33：文件管理从样本档案第三个 tab 升为独立二级菜单，紧贴样本档案之下 */
  ] },
  /* v39 需求 1：「项目空间」提到「智能分析」上方 ——
     项目是数据的归属方（建项目 → 导数据 → 跑分析），排在被它约束的分析流程前面
     才符合因果；原先把它排在智能分析之后，读起来像是「先分析再建项目」。 */
  { g: '项目空间', i: 'folder-tree', items: [
    { id: 'proj', i: 'folder-tree' }
  ] },
  /* v50 需求 4：整组不上菜单。它是**一次性把数据跑到结论**的那条线，
     入口本该是「新建项目 › 智能分析」——两个入口并存时，用户会在
     「先建项目还是先跑分析」上先卡一次，而那正是这个产品要消掉的问题。
     五个页面全部保留、data-go 全部有效、面包屑的组名段依旧可点。
     v51：这条线补上第 5 步「查看分析结果」—— 它同时是 #panoTpl 的第二个宿主，
     但**不影响**左栏：整组 off，所以这里多一格不会让菜单长出东西来。
     留在 NAVGROUPS 里的价值是面包屑：navItemOf 扫的是这张表，不看 off，
     所以 p07 照样能得到「工作台 › 智能分析 › 查看分析结果」这条路，与 p02–p06 同形。 */
  { g: '智能分析', i: 'chart-line', off: true, items: [
    { id: 'p02', i: 'file-arrow-up' },
    { id: 'p04', i: 'diagram-project' },
    { id: 'p05', i: 'screwdriver-wrench' },
    { id: 'p06', i: 'play' },
    { id: 'p07', i: 'chart-column' }
  ] },
  /* v58：组标题不再跳外链。改为「三个子页各自在右侧工作区挂载外部页面」。
     需求：「在右侧工作区展示外部页面（保持左侧菜单布局）」——
     跳外链会把整站布局丢掉，那不是「一个整体」。 */
  { g: '知识赋能', i: 'book-open', items: [
    { id: 'kbmed', i: 'book-open' },
    { id: 'kbown', i: 'file-circle-plus' },
    { id: 'kbgraph', i: 'diagram-successor' }
  ] },
  { g: '系统管理', i: 'gears', items: [
    { id: 'log', i: 'clipboard-list' },
    /* v47 需求 3：项目组管理放在运行日志与示例数据集之间 ——
       它管的是「人和归属」，示例数据集管的是「内容」，两者都是管理员才碰的一层。 */
    { id: 'projgroup', i: 'user-group' },
    { id: 'pubds', i: 'database' }
  ] }
];

/* v58：知识赋能三页各自对接外部系统的独立路径，在**右侧工作区**以 iframe 挂载。
     需求原文：「把原先的『医学知识库』『自有知识库』和『知识图谱』直接对接到77.144
     的三个独立路径，分别是ke、kb 和 kg。把menu 参数去掉」。
     —— 注意这里说的是**三个**路径分别对应三页，不再是 v57 那条统一的
     `?menu=1` 单入口；`menu` 参数按要求去掉（外部 SPA 靠路径区分视图）。

     KB_EXT_BASE 是唯一事实来源：换服务器只改这一处，三页地址都由它拼出来，
     不散落在模板字符串里。三页的对应关系：
       医学知识库 kbmed  → /ke   自有知识库 kbown → /kb   知识图谱 kbgraph → /kg */
var KB_EXT_BASE = 'http://192.168.77.144:20080/package2';
var KB_EXT = {
  kbmed:   { path: '/ke', name: '医学知识库' },
  kbown:   { path: '/kb', name: '自有知识库' },
  kbgraph: { path: '/kg', name: '知识图谱' }
};
function kbExtUrl(id) {
  var m = KB_EXT[id];
  return m ? (KB_EXT_BASE + m.path) : '';
}
/* 每页的「当前视图」：'ext' = 看外部系统（默认），'local' = 看站内那份。
   站内内容不撤 —— 内网地址在别人机器上未必通，全撤掉就只剩三张白页。 */
var KBMODE = { kbmed: 'ext', kbown: 'ext', kbgraph: 'ext' };

function navItemOf(id) {
  for (var i = 0; i < NAVGROUPS.length; i++) {
    var g = NAVGROUPS[i];
    for (var j = 0; j < g.items.length; j++) {
      if (g.items[j].id === id) return { g: g.g, it: g.items[j] };
    }
  }
  return null;
}

/* ── v50 需求 1：二级条目右侧的数字徽标整块撤掉 ──
   撤掉的是「文件管理 25 / 项目管理 13 / 项目组管理 7」这三枚计数。
   理由不是「不好看」，而是**它们和页面里的数字不是一回事**：
   徽章是「库存」（含已归档、已禁用、未通过的），而用户看到这个数字
   第一反应是「我能用的有多少」—— 两个口径共用同一个位置，读的人只能猜。
   这一条在 v47 就埋下了：项目组管理的徽章被迫在页面里另写一行
   「可选条数」来补，那行字本身就是「徽章口径不对」的证据。

   页面的计数没撤：项目列表头「共 13 个项目」、文件管理的计数、项目组页的
   「所属项目组可选 N 个」都还在 —— 数字回到它自己的上下文里说话。
   原来那个 navCount() 因此整体删除，别再往这里加回来。 */

/* 分组展开态。默认全展开；用户点过标题后按用户选择。
   只存内存不落 localStorage —— 演示场合刷新后回到「全部展开」更可预期。 */
var NAV_OPEN = {};

function navGrpOpen(g) { return NAV_OPEN[g] !== false; }

function toggleNavGrp(g) {
  NAV_OPEN[g] = !navGrpOpen(g);
  renderNav();
}

function renderNav() {
  var box = $('#navBody');
  if (!box) return;
  /* 项目概况这一层的左栏是「项目自己的菜单」——对齐参考系统的做法：进了项目详情层，
     左栏整条换掉（那边是「项目详情 / 转录组分析 ▸ 各模块」，全局菜单整条让位）。
     判断放在这里而不是 goto() 里：renderNav 也被「展开/收起分组」调用，
     用户在手风琴时左栏不能跳回全局菜单。 */
  if (NAVCUR === 'projdetail') { renderProjNav(); return; }
  NAV_MODE = '';
  var html = '';
  NAVGROUPS.forEach(function (grp, gi) {
    /* v50 需求 4：off 的组不画出来（页面与路由照旧）。放在最前，
       分组折叠态、aria-controls 这些都不必为它生成一遍。 */
    if (grp.off) return;
    /* 顶级叶子项：不成组、不可折叠 */
    if (!grp.g) {
      grp.items.forEach(function (it) {
        html += '<button class="snav__i snav__i--top" data-go="' + it.id + '" data-proto-route="page:' + it.id + '">'
          + ico(it.i)
          + '<span class="snav__t">' + esc(PAGES[it.id] || it.id) + '</span>'
          + '</button>';
      });
      return;
    }
    /* list 的 id 用序号而非组名：中文虽属合法 CSS 标识符，但写进选择器
       容易在脚本里被漏转义，序号更稳，也免了同名组相互覆盖 */
    var open = navGrpOpen(grp.g), gid = esc(grp.g), lid = 'navlist-g' + gi;
    /* v58：组标题一律是「整行按钮 = 展开/收起」。
       v57 曾在有 ext 的组上把标题拆成「外链 + 折叠箭头」，那是「跳外链」方案；
       需求改为「在右侧工作区展示外部页面（保持左侧菜单布局）」后，跳外链会把
       整站布局丢掉，所以那个分支整段撤除 —— 三页改为页内 iframe 挂载（见 initKbFrames）。
       .snav__grp 类在 split 变体上仍保留：verify 的 R.ia.navGroups 靠它数4 组。 */
    html += '<div class="snav__sec">';
    html += '<button class="snav__grp" data-navgrp="' + gid + '" aria-expanded="'
      + (open ? 'true' : 'false') + '" aria-controls="' + lid + '">'
      + ico(grp.i, 'snav__gi')
      + '<span class="snav__gt">' + gid + '</span>'
      + ico('chevron-down', 'snav__chev')
      + '</button>'
      + '<div class="snav__list" id="' + lid + '"' + (open ? '' : ' hidden') + '>';
    grp.items.forEach(function (it) {
      /* 二级条目**不渲染图标**：层级靠缩进与字重表达（见 NAVGROUPS 注释）。
         it.i 仍留着，将来若要恢复「二级也带图标」只需在这里加回 ico(it.i)。
         数量徽标（v50 起）不再渲染 —— 理由见 NAVGROUPS 上方那段。 */
      html += '<button class="snav__i" data-go="' + it.id + '" data-proto-route="page:' + it.id + '">'
        + '<span class="snav__t">' + esc(PAGES[it.id] || it.id) + '</span>'
        + '</button>';
    });
    html += '</div></div>';
  });
  box.innerHTML = html;
}

/* ---------- 项目层的左栏菜单（v41） ----------
   三项：「项目详情」「分析执行」是叶子，「分析结果」是可折叠分组，
   子项由 pdtModules() 现算 —— 所以不同项目进来看到的左栏不一样，
   这才是「项目自己的菜单」。

   为什么复用全局左栏那套类名（.snav__i / .snav__grp / .snav__sec）：
   深色外壳、宽度 --rail-w、键盘可达、折叠态这些都已经在那一套里落实过，
   另起一套类名等于把同样的样式再写一遍，且必然有一天两边走偏。 */
function renderProjNav() {
  var box = $('#navBody');
  if (!box) return;
  NAV_MODE = 'proj';
  var p = projById(PROJ_DETAIL_ID);
  var html = '';
  PDT_HOSTS.forEach(function (h) {
    if (h.k !== 'result') {
      html += '<button class="snav__i snav__i--top" data-pds="' + h.k + '">'
        + ico(h.ic) + '<span class="snav__t">' + h.n + '</span></button>';
      return;
    }
    var mods = pdtModules(p), open = navGrpOpen(h.n);
    html += '<div class="snav__sec">'
      + '<button class="snav__grp" data-pdgrp="1" aria-expanded="' + (open ? 'true' : 'false')
      + '" aria-controls="pdModList">'
      + ico(h.ic, 'snav__gi') + '<span class="snav__gt">' + h.n + '</span>'
      + ico('chevron-down', 'snav__chev') + '</button>'
      + '<div class="snav__list" id="pdModList"' + (open ? '' : ' hidden') + '>';
    if (!mods.length) {
      /* 没绑流程的项目左栏不能只剩一个空分组头 —— 那看起来像加载失败 */
      html += '<div class="snav__none">未绑定分析流程</div>';
    } else {
      mods.forEach(function (nm, i) {
        var d = pdtModData(p, nm);
        html += '<button class="snav__i" data-pdmod="' + i + '" title="' + esc(nm) + '">'
          + '<span class="snav__t">' + esc(nm) + '</span>'
          + '<span class="snav__n snav__n--' + d.st + '">' + pdtStMark(d.st) + '</span>'
          + '</button>';
      });
    }
    html += '</div></div>';
  });
  box.innerHTML = html;
}

/* 模块状态的记号：一个字符，不用文字。左栏宽度只有 --rail-w，
   「完成/失败」三个字进去就把模块名挤没了。 */
function pdtStMark(s) {
  return { ok: '✓', run: '…', bad: '!', none: '·' }[s] || '·';
}

function markProjNav() {
  $$('#navBody [data-pds]').forEach(function (b) {
    if (b.getAttribute('data-pds') === PDSEC) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  $$('#navBody [data-pdmod]').forEach(function (b) {
    var on = (PDSEC === 'result') && String(PDMOD) === b.getAttribute('data-pdmod');
    if (on) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  /* 停在某个模块上时那个分组必须是展开的 —— 否则高亮项藏在 hidden 里，
     用户看到的是「左栏一格都没选中」。 */
  if (PDSEC === 'result' && !navGrpOpen('分析结果')) {
    NAV_OPEN['分析结果'] = true;
    renderProjNav();
    markProjNav();
  }
}

/* 左栏此刻渲染的是哪一套：'' = 全局菜单，'proj' = 项目层的项目菜单。
   为什么需要它：renderNavOn 只改高亮、不重建 DOM，而**换页面往往要换整套左栏**。
   少了这个标记，「从项目详情退回样本档案」之后左栏还挂着上一个项目的模块清单 ——
   人站在样本档案上，左边却是「项目详情 / 分析执行 / 分析结果」，看起来像串页了。 */
var NAV_MODE = '';

function renderNavOn(id) {
  /* 项目概况这一层有它自己的左栏（见 renderProjNav），高亮不走全局那一套；
     直接落到「项目详情 / 分析执行 / 某个模块」上。 */
  var want = (id === 'projdetail') ? 'proj' : '';
  if (want !== NAV_MODE) {                 /* 换了一套左栏 → 必须重画，不能只改高亮 */
    if (want === 'proj') renderProjNav();
    else renderNav();
  }
  if (id === 'projdetail') { markProjNav(); return; }
  var on = id;
  /* 目标页在某个被收起的组里时先展开它 —— 否则高亮项藏在 hidden 里，
     用户会以为「点了没反应」。 */
  var hit = navItemOf(on);
  if (hit && hit.g && !navGrpOpen(hit.g)) { NAV_OPEN[hit.g] = true; renderNav(); }
  $$('.snav__i').forEach(function (b) {
    if (b.getAttribute('data-go') === on) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ============================================================
   运行历史（抽屉内容）
   ============================================================ */
function renderHist() {
  var box = $('#histBody');
  if (!box) return;
  var html = '', lastDay = '';
  HIST.forEach(function (h) {
    /* 「今天 / 更早」分组：列表长了也能一眼看出时间分布 */
    var day = h.t.slice(0, 10);
    if (day !== lastDay) {
      html += '<div class="hgrp">' + (lastDay === '' ? '今天 · ' + esc(day) : '更早 · ' + esc(day)) + '</div>';
      lastDay = day;
    }
    var tag = h.s === 'run'
      ? '<span class="tag tag--brand">运行中</span>'
      : '<span class="tag tag--ok">成功</span>';
    html += '<div class="hitem">'
      + '<div class="hitem__h"><span class="hitem__ico' + (h.s === 'run' ? ' hitem__ico--run' : '') + '" aria-hidden="true">' + ico(h.ic) + '</span><span class="min-w-0 truncate">' + esc(h.n) + '</span>'
      + '<span class="ml-auto mono text-[10.5px] text-ink3">' + h.t.slice(11) + '</span></div>'
      + '<div class="hitem__m">' + esc(h.m) + '</div>'
      + (h.s === 'run' ? '<div class="hitem__f"><div class="bar bar--thin flex-1"><div class="bar__f" style="width:' + h.p + '%"></div></div><span>' + h.p + '%</span></div>' : '')
      + '<div class="hitem__f">' + tag + '<span>' + h.e + '</span>'
      + (h.k ? '<span>· ' + esc(h.k) + '</span>' : '')
      + '</div>'
      + '</div>';
  });
  box.innerHTML = html;
  var foot = $('#histFoot');
  if (foot) {
    var okN = HIST.filter(function (h) { return h.s !== 'run'; }).length;
    var runN = HIST.length - okN;
    foot.textContent = '共 ' + HIST.length + ' 条记录 · ' + okN + ' 成功'
      + (runN ? ' · ' + runN + ' 运行中' : '');
  }
}

/* ============================================================
   各工作区页面
   ============================================================ */
/* 卡片 / 列表是同一批项目的两种呈现。卡片用来「读描述」，列表用来「横向对比」
   （负责人、可见范围、更新时间排成列才好扫）。状态存在 PROJ_VIEW 而不是 DOM 上，
   这样从别的页面切回来、或切完项目重渲染，视图选择都还在。 */
var PROJ_VIEW = 'card';

function renderProj() {
  var box = $('#projGrid');
  if (!box) return;
  /* 整体重写 class，不做 toggle：toggle 两次之后会把上一个视图的类留下 */
  box.className = (PROJ_VIEW === 'list') ? 'card' : 'grid2';
  box.innerHTML = (PROJ_VIEW === 'list')
    ? projListHTML()
    : PROJECTS.map(projCardHTML).join('');

  $$('#projViewSeg .seg__b').forEach(function (b) {
    var on = b.getAttribute('data-projview') === PROJ_VIEW;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  var c = $('#projCount'); if (c) c.textContent = '共 ' + PROJECTS.length + ' 个项目';
  var cu = $('#projCur'); var cp = curProj();
  if (cu) cu.textContent = '当前：' + (cp ? cp.n : '—');
}

/* 项目状态（v37 需求 7）：成功 / 分析中 / 失败 三档。
   状态色复用全站语义 —— 成功=ok、分析中=warn、失败=danger，
   与「运行日志」里的成功/失败同色，同一个词在站内不出现第二种颜色。 */
var PROJ_ST = { '成功': 'ok', '分析中': 'warn', '失败': 'danger' };
function projStTag(st) {
  var k = PROJ_ST[st] || 'warn';
  return '<span class="tag tag--' + k + '">' + esc(st || '—') + '</span>';
}

/* 卡片主体是一个真按钮（不是给 div 挂 role="button"）：
   卡内还有「设为当前 / 详情」两个按钮，外层再挂 role=button 会让屏幕阅读器
   把整张卡当成一个按钮、把里面两个按钮压平。 */
function projCardHTML(p) {
  return '<div class="projcard" data-proj="' + p.id + '" aria-current="' + (p.on ? 'true' : 'false') + '">'
    + '<button type="button" class="projcard__main" data-proj-open="' + p.id + '" aria-label="查看项目详情：' + esc(p.n) + '">'
    + '<span class="projcard__n">' + esc(p.n) + '</span>'
    + '<span class="projcard__d">' + esc(p.d) + '</span>'
    + '</button>'
    + '<div class="projcard__f"><span>' + p.id + '</span><span class="pf-meta">' + projMeta(p) + '</span>'
    + projStTag(p.st)
    + (p.on ? '<span class="tag tag--brand">当前</span>' : '')
    + '</div>'
    /* v37：操作行不再放「设为当前」。切当前项目是个低频且容易误点的动作，
       参考系统把它整个去掉，项目状态升到卡片正面承担「一眼看进展」的职责。 */
    + '<div class="projcard__act">'
    + '<span class="projcard__t">最近更新 ' + p.t.slice(0, 16) + '</span>'
    + '<button type="button" class="btn btn--sm btn--quiet ml-auto" data-proj-open="' + p.id + '">详情</button>'
    + '</div>'
    + '</div>';
}

function projListHTML() {
  var rows = PROJECTS.map(function (p) {
    return '<tr data-proj="' + p.id + '" aria-current="' + (p.on ? 'true' : 'false') + '">'
      + '<td>' + p.id + '</td>'
      + '<td><button type="button" class="projrow" data-proj-open="' + p.id + '">' + esc(p.n) + '</button></td>'
      + '<td>' + esc(p.own) + '</td>'
      + '<td class="num">' + fmtNum(p.sm) + '</td>'
      + '<td class="num">' + p.rn + '</td>'
      + '<td>' + projStTag(p.st) + '</td>'
      + '<td class="num nw">' + p.t.slice(0, 16) + '</td>'
      + '<td class="wid"><span class="ops">'
      + '<button type="button" class="btn btn--sm btn--quiet" data-proj-open="' + p.id + '">查看</button>'
      + '</span></td></tr>';
  }).join('');
  return '<div class="card__hd"><span class="card__t">项目列表</span>'
    + '<span class="card__d">共 ' + PROJECTS.length + ' 个项目 · 列出负责人、样本与分析步骤，便于横向比较</span></div>'
    + '<div class="card__bd"><div class="tblwrap"><table class="tbl">'
    + '<thead><tr><th>项目编号</th><th>项目名称</th><th>负责人</th>'
    + '<th class="num">样本</th><th class="num">分析步骤</th><th>项目状态</th><th class="num">最近更新</th><th>操作</th></tr></thead>'
    + '<tbody>' + rows + '</tbody></table></div></div>';
}

/* 切换当前项目。之所以单独抽出来：卡片、列表行、项目概况页三处都能读到它，
   而「切换后要同步什么」是一份清单（卡片高亮 + 顶部当前项 + 运行历史标题 +
   正开着的项目概况页），分散三份必然漏。 */
function setCurProj(pid) {
  var p = projById(pid);
  if (!p) return null;
  PROJECTS.forEach(function (x) { x.on = (x.id === pid); });
  renderProj();
  var hp = $('#histProj'); if (hp) hp.textContent = '· ' + p.n;
  /* 正站在这个项目的概况页上就地重画：徽章里的「当前项目」标记要立刻跟着变，
     而不是等用户退出去再进来。 */
  var pd = $('#page-projdetail');
  if (pd && pd.classList.contains('is-on') && PROJ_DETAIL_ID === pid) renderProjHead(pid);
  return p;
}

/* ============================================================
   项目概况页（v39：项目详情由右侧抽屉升为独立页面）
   ============================================================ */
/* 为什么从抽屉改成页面：
   ① 抽屉里塞不下这么多块 —— 一屏放不下就得在一个浮层里滚完整个项目的横切面，
      而抽屉的语义是「就地看一眼」。参考系统这一层也是一张独立页面。
   ② 顺带消掉一处叠层：它原先是 z 61 的二级抽屉，与样本抽屉（z 61）压在
      一起要靠 DOM 顺序决胜（见踩坑速查第 1 条）；升成页面后这层关系不存在了。
   ③ 返回只有面包屑一条路（v17）：工作台 › 项目管理 › 项目概况。 */
var PROJ_DETAIL_ID = null;   /* 当前看的是哪个项目；进页面时由 goto(opts.proj) 决定 */
/* 这一层有三件事，所以状态也是两维的：
     PDSEC  = 左栏停在哪一项（info 项目详情 / exec 分析执行 / result 分析结果）
     PDTAB  = PDSEC 是 info|exec 时，页内停在哪一页签
     PDMOD  = PDSEC 是 result 时，看第几个模块（下标）
   三者分开而不是合成一个字符串：切页签不该把「刚才看的是哪个模块」弄丢，
   「运行记录」这个页签更是从项目详情与模块页两处都要跳得进来。 */
var PDSEC = 'info';
var PDMOD = 0;
var PDTAB = 'info';

/* 左栏在这一层是「项目自己的菜单」，不是全局菜单 —— 对齐参考系统的做法：
   进了项目详情，左栏整条换成该项目的分析线（项目详情 / 转录组分析 ▸ 各模块）。
   tabs 指向 PDTABS 里的键：点左栏某一项，页内的页签条也跟着换成它那几条。 */
var PDT_HOSTS = [
  { k: 'info',   n: '项目详情', ic: 'circle-info',        tabs: ['info', 'sample', 'dataset', 'param', 'ref'] },
  { k: 'exec',   n: '分析执行', ic: 'screwdriver-wrench', tabs: ['flow', 'run'] },
  { k: 'result', n: '分析结果', ic: 'chart-column' }
];

function pdtHost(k) { return PDT_HOSTS.filter(function (h) { return h.k === k; })[0] || PDT_HOSTS[0]; }
function pdtHostOfTab(t) {
  for (var i = 0; i < PDT_HOSTS.length; i++) {
    if ((PDT_HOSTS[i].tabs || []).indexOf(t) >= 0) return PDT_HOSTS[i].k;
  }
  return 'info';
}

/* 页签清单是唯一来源：渲染页签条、渲染面板、切换、断言都读它。
   前六块的顺序与参考系统的「项目概况」一致（项目信息打头），内容按本系统的
   数据来 —— 没有的数据源（例如湿实验记录）不硬凑一块空表，改成如实说明为什么空。
   v40：插进「数据集」在样本信息之后 —— 数据集是分析项目的产物，
   它左边是「用了哪些样本」、右边是「按什么参数跑」，读下来是一条流水：
   样本 → 数据 → 参数 → 参考基因组 → 流程 → 运行记录。 */
var PDTABS = [
  ['info',    '项目信息',   'circle-info'],
  ['sample',  '样本信息',   'vial'],
  ['dataset', '数据集',     'database'],
  ['param',   '分析参数',   'sliders'],
  ['ref',     '参考基因组', 'dna'],
  ['flow',    '实验流程',   'diagram-project'],
  ['run',     '分析流程',   'play']
];

function ownStats(p) {
  var pid = p.id;
  return {
    ds:  COLLECTIONS.filter(function (c) { return c.pj === pid; }),
    smp: SAMPLES.filter(function (s) { return s[6] === pid; }),
    log: LOGS.filter(function (l) { return l[4] === p.n; })
  };
}

/* ---------- 项目 → 分析流程线 ----------
   一个项目实际跑的是哪条线，由它的组学定，不由项目编号的哈希定。
   原先按 p.id 哈希取模板，把「原发性肝癌转录组示范项目」的主流程算成了
   「16S 扩增子分析流程」—— 分析参数、实验流程、「分析结果」菜单三处会一起错，
   而且错得看不出来（都是一串同样专业的流程名）。

   表的顺序就是优先级：越专的名越靠前，'转录组' 的兜底不能吃掉 '16S' / '代谢组'。
   注意 '代谢组' 与 P-2026-003 的标签 '代谢' 不是一回事 —— 正则写的是全词
   '代谢组'，所以那个小鼠代谢项目仍然落回转录组线，这是对的。 */
var PROJ_LINE = [
  { re: /16S/i,             fx: ['f08'] },
  { re: /单细胞/,            fx: ['f06', 'f11'] },
  { re: /代谢组/,            fx: ['f07'] },
  { re: /蛋白组/,            fx: ['f12', 'f11'] },
  { re: /宏基因组/,          fx: ['f05', 'f03', 'f04', 'f02'] },
  { re: /变异位点|群体遗传/,  fx: ['f10', 'f11'] },
  { re: /沙箱/,              fx: ['f01', 'f06', 'f02'] },
  { re: /转录组/,            fx: ['f06', 'f09', 'f11', 'f12'] },
  { re: /./,                fx: ['f06', 'f09'] }
];

/* 判据用「标签 + 名称 + 描述」三处合起来。只看标签不够 ——
   P-2026-007 的 16S 标签写作 '16S'，靠大小写不敏感兜住；
   P-2026-013 的蛋白组只写在标签与描述里。 */
function projLine(p) {
  if (!p) return [];
  var hay = (p.tags || []).join(' ') + ' ' + (p.n || '') + ' ' + (p.d || '');
  for (var i = 0; i < PROJ_LINE.length; i++) {
    if (PROJ_LINE[i].re.test(hay)) return PROJ_LINE[i].fx;
  }
  return [];
}

function flowById(id) { return FLOWS.filter(function (f) { return f.id === id; })[0] || null; }

/* 该项目的流程模板清单。条数有唯一出口 —— 卡片 / 列表上那个「分析流程 N 条」的
   rn，所以条数永远是 min(rn, FLOWS.length)，不因为改了取法而变。
   顺序分两段：
     ① 本项目那条线里的流程（顺序即线内先后）—— 主流程必须是它，
        不能是别的组学的流程；
     ② 线内取完还没到 N 条时，按 id 哈希补齐。
   ② 是「同一条线上重复跑了几次」的语义，不是往列表里塞别的组学 ——
   它只影响列表后段；主流程（fl[0]）与「分析结果」菜单都只看 ①。
   模板库只有 FLOWS.length 条，rn 比它大时（如 rn=21）如实只列能列的那些。 */
function projFlows(p) {
  if (!p) return [];
  /* v47：**向导里显式选的流程优先**。p.flow 是新建项目第 4 步点的那一条 ——
     它比「按物种 / 类型推出来的线」权威得多（推线是给库里那批没有 flow 字段的
     历史项目兜底用的）。不先判它的话，用户刚选的流程会被 projLine() 顶掉，
     详情页上出现的是另一条流程，而回执上写的是他选的那条 —— 自相矛盾。 */
  if (p.flow) {
    var f0 = flowById(p.flow);
    if (f0) return [f0];
  }
  if (!p.rn || !FLOWS.length) return [];
  var n = Math.min(p.rn, FLOWS.length), out = [];
  projLine(p).forEach(function (fid) {
    var f = flowById(fid);
    if (f && out.indexOf(f) < 0) out.push(f);
  });
  if (out.length < n) {
    var seed = 0, s = String(p.id);
    for (var i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) % 9973;
    for (var k = 0; out.length < n && k < FLOWS.length; k++) {
      var f2 = FLOWS[(seed + k) % FLOWS.length];
      if (out.indexOf(f2) < 0) out.push(f2);
    }
  }
  return out.slice(0, n);
}

/* ---------- 「分析结果」的模块清单 ----------
   参考系统这一层是「转录组分析 ▸ 数据质控 / 序列比对 / 基因表达定量 / ……」——
   子菜单就是这条分析线的步骤，每个步骤一页。本系统同理：模块 = 本项目主流程的节点。

   三条规则，每条都有理由：
     ① 只取主流程（projFlows(p)[0]）。取全部流程的并集的话，P-2026-002 有 21 条流程、
        节点并集 81 个，左栏会变成一本字典；主流程才是「这个项目实际跑的那条线」，
        而节点的先后本身就是分析的先后。
     ② 输入类节点不是分析模块，剔掉（'…输入' / '空集合'）。它们是数据来源，
        不属于「结果」这一栏 —— 参考系统那一列里也没有「FASTQ 输入」。
     ③ 末尾收一个「结果全景」：流程节点写到出图那一步就停了，而结果菜单最后得有一个
        把全部结果收口的总览视图。末节点本身就是出图/报告类的不重复补
        （如 '物种丰度柱状图' / 'R 统计出图'）。

   v42：末项「结果全景」不再套通用模块骨架 —— 它的正文是**外一层那份结果全景**
   （6 个视图 + 视图切换条），由 mountPano() 从 #panoTpl 克隆进来。
   v51：同一个 mountPano() 也给智能分析第 5 步用（宿主 #resMount），
   所以「克隆进当前这一屏」这句话对两个宿主都成立、且只会有一个在文档里。 */
var PANO_MOD = '结果全景';
/* 全景页此刻是哪个视图（variant / de / enrich / prot / metab / align）。
   入口可以带视图进来 —— 在「差异表达」那一行点「查看结果」，进去就该是差异表达视图。
   它必须活在模块页之外：模块页每次都整块重画，状态挂在自己身上会丢。 */
var PANO_VIEW = 'variant';

function pdtModules(p) {
  var fl = projFlows(p), f = fl[0];
  if (!f) return [];
  var out = [];
  f.nodes.forEach(function (nm) {
    if (/输入|集合/.test(nm)) return;
    if (out.indexOf(nm) < 0) out.push(nm);
  });
  var last = out[out.length - 1] || '';
  if (out.length && !/图|报告|可视化/.test(last)) out.push(PANO_MOD);
  return out;
}

/* 这个模块是不是「结果全景」那一页。用常数比,不写字面量 ——
   名字要改的时候只改 PANO_MOD 一处,判断不会跟着漏。 */
function pdtIsPano(nm) { return nm === PANO_MOD; }

/* 模块页要回答「这一步产出了什么」。产出两边靠**词元**对齐，不靠序号：
   产出数据集与运行日志的名字本来就是按流程步骤起的 ——
   'HISAT2 比对结果（BAM）' 对 'HISAT2 比对'、'MEGAHIT 宏基因组组装' 对 'MEGAHIT 组装'、
   'fastp 快速质控' 对 'fastp 质控'，都是同一个工具名。对不上就是这一步没留产物，
   如实给空态，不硬凑一行「暂无」以外的假数据。 */
function pdtTokens(nm) {
  return String(nm).split(/[\s·（）()、，,/+]+/).filter(function (w) {
    /* 纯 ASCII 词元要 3 个字符以上才算有辨识度：'GO' 这种两字母缩写在英文串里
       到处都是，会误命中；中文词元 2 字就够（'质控' / '比对' / '定量'）。 */
    return /[\u4e00-\u9fa5]/.test(w) ? w.length >= 2 : w.length >= 3;
  });
}
function pdtHit(nm, text) {
  var t = String(text).toLowerCase();
  return pdtTokens(nm).some(function (w) { return t.indexOf(w.toLowerCase()) >= 0; });
}

/* 某模块在本项目里的真实产出：命中的输出数据集 + 命中的运行记录。
   状态也由此现算（有失败记录→失败，有运行中→运行中，只有成功→完成，没有→未运行），
   不另写一份状态表 —— 两份状态必然有一天对不上。 */
function pdtModData(p, nm) {
  var st = ownStats(p);
  var ds = st.ds.filter(function (c) { return c.dir === 'out' && pdtHit(nm, c.n); });
  var lg = st.log.filter(function (l) { return pdtHit(nm, l[5]); });
  var s = 'none';
  if (lg.some(function (l) { return l[3] === '失败'; })) s = 'bad';
  else if (lg.some(function (l) { return l[3] === '运行中'; })) s = 'run';
  else if (lg.length) s = 'ok';
  return { ds: ds, lg: lg, st: s };
}

/* 全模块状态汇总，喂给模块页顶栏那排「分析进度」计数 */
function pdtModCounts(p) {
  var mods = pdtModules(p), c = { ok: 0, run: 0, bad: 0, none: 0 };
  mods.forEach(function (nm) { c[pdtModData(p, nm).st]++; });
  c.total = mods.length;
  return c;
}

/* 「分析进度」那一排计数。模块页与全景页共用 —— 两处各写一份，改一处就会漂一处。
   计数**按模块**统计，与页头那排角标（按运行记录条数）不是同一个分母，
   所以单位写进提示里，否则同一屏上两个「运行中 1 / 0」会被读成自相矛盾。
   tail 给调用方挂右端那一段（模块页放「当前模块状态 + 导出本步清单」，全景页不放）。 */
function pdtProgBar(p, tail) {
  var c = pdtModCounts(p), f = projFlows(p)[0] || null;
  return '<div class="pdmod__bar">'
    + '<span class="pdmod__lb">' + ico('chart-simple') + '分析进度</span>'
    + '<span class="pdmod__c pdmod__c--ok" title="已完成的模块">' + ico('circle-check') + fmtNum(c.ok) + '</span>'
    + '<span class="pdmod__c pdmod__c--run" title="运行中的模块">' + ico('rotate') + fmtNum(c.run) + '</span>'
    + '<span class="pdmod__c pdmod__c--bad" title="失败的模块">' + ico('circle-xmark') + fmtNum(c.bad) + '</span>'
    + '<span class="pdmod__c" title="还没跑过的模块">' + ico('circle-dot') + fmtNum(c.none) + '</span>'
    + '<span class="pdmod__hint">按模块统计 · 共 ' + c.total + ' 个模块 · 来自流程「' + esc(f ? f.n : '—') + '」</span>'
    + (tail || '')
    + '</div>';
}

/* 键值表：参考系统的「项目信息」就是这种两列表（左列浅底标签 + 右列值）。
   比把每个字段摆成一张卡省纵向空间 —— 11 个字段横排要占三行，这样只占一屏。 */
function pdtKV(rows) {
  return '<div class="tblwrap"><table class="tbl tbl--kv"><tbody>'
    + rows.map(function (r) {
        return '<tr><td class="kvk">' + r[0] + '</td><td>' + r[1] + '</td></tr>';
      }).join('')
    + '</tbody></table></div>';
}

/* 页头右上角那排计数（对齐参考系统的四个角标）：四格回答「这个项目有多少东西、
   跑到哪一步了」。数字全部现算，与卡片、列表、运行日志同源。 */
function pdtBadge(icon, n, label, tone) {
  return '<span class="pjbadge' + (tone ? ' pjbadge--' + tone : '') + '" title="' + esc(label) + '">'
    + ico(icon) + '<b>' + fmtNum(n) + '</b><span>' + esc(label) + '</span></span>';
}

function pdtCounts(st) {
  var f = function (r) { return st.log.filter(function (l) { return l[3] === r; }).length; };
  return { run: f('运行中'), ok: f('成功'), bad: f('失败') };
}

/* ---------- 页头 ---------- */

/* v44：页头跟着左栏走 —— 「项目概况」这个名字只在左栏选中「项目详情」时出现。
   切到「分析执行 / 分析结果」后，大标题与面包屑末段换成对应的名字；
   不这么做就会出「左栏停在结果全景、大标题和面包屑都还写着项目概况」的错位：
   用户是按左栏读页面的，页头却给了另一个答案。
   三个名字的来源都是**已有状态**（PDSEC / PDMOD + pdtModules），不另立一份表。 */
var PROJ_EYE = { info: 'PROJECT OVERVIEW', exec: 'ANALYSIS RUN', result: 'ANALYSIS RESULT' };
function projHeadName() {
  if (PDSEC === 'exec') return '分析执行';
  if (PDSEC === 'result') {
    /* 结果栏里没有页签，模块就是它的最小单位 —— 抬头写「分析结果」等于把用户
       刚点的那一格又抹掉。取不到模块（新项目未绑流程）才退回栏名。 */
    var p = projById(PROJ_DETAIL_ID) || curProj();
    if (!p) return '分析结果';
    return pdtModules(p)[PDMOD] || '分析结果';
  }
  return '项目概况';
}
function renderProjTitle() {
  var name = projHeadName();
  var h1 = $('#projH1');   if (h1)  h1.textContent = name;
  var eye = $('#projEye'); if (eye) eye.textContent = PROJ_EYE[PDSEC] || PROJ_EYE.info;
  /* 面包屑末段只换文字，**不整条重画** —— 重画会把 #crumbParent / #crumbHome
     换成新节点，而事件委托与验证脚本都是按 id 找它们的。 */
  var c = $('#crumb');     if (c)   c.textContent = name;
  markProjPano();
}

/* v45：页头那颗「查看项目结果全景」在**已经落在结果全景那一格**时隐去。
   它做的事是「跳到末模块」，而末模块此刻正开着（v44 起页头标题也是它）——
   再摆一颗指向自己的按钮，点下去什么都不发生，看着像坏了。
   判据取「当前位置」而不是「按钮文字」：流程末节点本身是出图/报告类时
   不会补出「结果全景」这个名字，但那仍是同一格，按名字判会整类项目漏掉。 */
function pdtAtPano(p) {
  if (PDSEC !== 'result' || !p) return false;
  var mods = pdtModules(p);
  return mods.length > 0 && PDMOD >= mods.length - 1;
}
/* 显隐的唯一挂点是 renderProjTitle()（进页面 / 切栏 / 切模块 / 切页签四处都调它），
   这里只切 hidden、**不重画操作条** —— 重画会把它旁边那排状态徽章一起闪一遍。 */
function markProjPano() {
  var b = $('#projPanoBtn'); if (!b) return;
  b.hidden = pdtAtPano(projById(PROJ_DETAIL_ID) || curProj());
}

function renderProjHead(pid) {
  var p = projById(pid);
  var tag = $('#projTag'), nm = $('#projName'), sub = $('#projSub');
  if (!p) {
    if (tag) tag.textContent = '—';
    if (nm) nm.textContent = '未找到项目';
    if (sub) sub.textContent = '';
    if ($('#projBadges')) $('#projBadges').innerHTML = '';
    if ($('#projActs')) $('#projActs').innerHTML = '';
    return;
  }
  var st = ownStats(p), c = pdtCounts(st);
  if (tag) tag.textContent = p.id;
  if (nm) nm.textContent = p.n;
  if (sub) {
    sub.textContent = p.kind + ' · ' + p.sp + ' · 负责人 ' + p.own
      + ' · 创建 ' + p.created.slice(0, 10) + ' · 最近更新 ' + p.t.slice(0, 16)
      + (p.on ? ' · 当前项目' : '');
  }
  var bb = $('#projBadges');
  if (bb) {
    bb.innerHTML = pdtBadge('database', st.ds.length, '数据集', '')
      + pdtBadge('rotate', c.run, '运行中', c.run ? 'warn' : '')
      + pdtBadge('circle-check', c.ok, '成功', c.ok ? 'ok' : '')
      + pdtBadge('circle-xmark', c.bad, '失败', c.bad ? 'danger' : '');
  }
  var ac = $('#projActs');
  if (ac) {
    /* v37：不再有「设为当前项目」按钮对，改成把项目状态摆在操作条首位。
       v39：这一条从抽屉里搬到了页头 —— 页面比抽屉更需要「一眼看到结论」。 */
    ac.innerHTML = '<span class="pd__st">' + ico('circle-info') + '项目状态' + projStTag(p.st) + '</span>'
      + '<button type="button" class="btn btn--sm" data-proj-share="' + p.id + '">' + ico('share-nodes') + '分享此项目</button>'
      /* v42 撤掉「运行记录」那一颗：运行记录在「分析执行 › 运行记录」里本来就有，
         页头这颗只是又一个入口。撤按钮前先问「谁在借它的去处」—— 它跳的是全局运行日志，
         那条路在左栏还留着，所以撤得掉、也撤得干净。 */
      /* 结果全景入口（v28 加 / v42 改落点 / v44 恢复）：只有真跑出过运行记录的项目才展示 ——
         空项目放这个按钮等于承诺一份不存在的全景。
         v43 曾以「同一件事别开两个门」为由撤过一版，v44 按用户要求恢复：
         页头这颗是**当前项目**的一键直达（并负责把当前项目切过去），与左栏那一格并存。 */
      /* v45：这一颗在**已经落在结果全景那一格**时由 markProjPano() 隐去 ——
         它做的事就是「跳到末模块」，而末模块此刻正开着，点它什么都不发生。 */
      + (st.log.length
          ? '<button type="button" class="btn btn--sm" id="projPanoBtn" data-proj-pano="' + p.id + '">' + ico('chart-column') + '查看项目结果全景</button>'
          : '');
  }
  /* 重画之后按钮是新节点（新节点默认没有 hidden），紧接着补一次显隐：
     从一个模块页换到另一个项目时，新画的按钮会先露出来再被隐掉。 */
  markProjPano();
}

/* ---------- 页签 / 流程条 ---------- */
function pdtTabOf(k) { return PDTABS.filter(function (x) { return x[0] === k; })[0] || null; }

/* 页签条与流程条共用一个位置，但不同时出现：
   信息/执行两栏下它是页签（回答「这一栏里还有哪几块」），
   分析结果下它是横向流程条（回答「我在整条线的第几步、前后各是什么」）。
   页签回答不了后一个问题 —— 模块有 18 个，塞成页签会溢出成两行。 */
function renderProjTabs() {
  var box = $('#projTabs'), steps = $('#projSteps');
  if (!box) return;
  var isMod = (PDSEC === 'result');
  box.hidden = isMod;
  if (steps) steps.hidden = !isMod;
  if (isMod) { renderProjSteps(); return; }
  box.innerHTML = (pdtHost(PDSEC).tabs || []).map(function (k) {
    var t = pdtTabOf(k);
    if (!t) return '';
    var on = (t[0] === PDTAB);
    return '<button class="ptab' + (on ? ' is-on' : '') + '" type="button" role="tab"'
      + ' id="pdt-tab-' + t[0] + '" data-pdt="' + t[0] + '" aria-selected="' + (on ? 'true' : 'false') + '"'
      + ' aria-controls="pdt-' + t[0] + '">' + ico(t[2]) + t[1] + '</button>';
  }).join('');
}

function renderProjSteps() {
  var box = $('#projSteps');
  if (!box) return;
  var p = projById(PROJ_DETAIL_ID), mods = pdtModules(p);
  box.innerHTML = mods.map(function (nm, i) {
    var on = (i === PDMOD), d = pdtModData(p, nm);
    return (i ? '<span class="psteps__arw" aria-hidden="true"></span>' : '')
      + '<button type="button" role="listitem" class="psteps__n psteps__n--' + d.st + (on ? ' is-on' : '') + '"'
      + ' data-pdmod="' + i + '" aria-current="' + (on ? 'step' : 'false') + '">'
      + '<span class="psteps__no">' + (i + 1) + '</span>'
      + '<span class="psteps__t">' + esc(nm) + '</span></button>';
  }).join('');
}

function setProjTab(t, scroll) {
  var keys = PDTABS.map(function (x) { return x[0]; });
  if (keys.indexOf(t) < 0) t = 'info';
  /* 页签归属哪一栏由表决定，不由调用方传 —— 传两处必然有一天对不上。 */
  var host = pdtHostOfTab(t), crossHost = (host !== PDSEC);
  PDSEC = host;
  PDTAB = t;
  renderProjNav(); markProjNav();
  renderProjTabs();
  /* 跨栏（含从「分析结果」的模块页跳回来）时正文里挂的是**另一栏**的面板，
     只切 .is-on 会切出一个「页签条在、面板全灰」的空白屏 —— 必须整批重画。
     同栏内切页签仍然只切显示：表格滚动位置与选中态都还在。 */
  if (crossHost) renderProjPanel();
  $$('#projBody .pjpanel').forEach(function (b) {
    b.classList.toggle('is-on', b.getAttribute('data-pdtpanel') === t);
  });
  renderProjTitle();   /* 跨栏时页头跟着换名（同栏内切页签名字不变，调用是幂等的） */
  if (scroll !== false) { var pane = $('#content'); if (pane) pane.scrollTop = 0; }
}

/* 左栏点「项目详情 / 分析执行」：只换栏与页签，不动模块下标 ——
   用户去看了眼运行记录再回来，应当还在刚才那个模块上。 */
function setProjSec(k) {
  PDSEC = (k === 'result') ? 'result' : k;
  if (PDSEC !== 'result') {
    var tabs = pdtHost(PDSEC).tabs || [];
    /* 页签要落回这一栏里合法的那一个，否则会出现「左栏停在分析执行、
       页签却指着项目信息」这种自相矛盾的状态。 */
    if (tabs.indexOf(PDTAB) < 0) PDTAB = tabs[0];
  }
  renderProjNav(); markProjNav();
  renderProjTabs(); renderProjPanel();
  renderProjTitle();   /* 切栏 → 页头换名（「项目概况」只在「项目详情」那一栏出现） */
  var pane = $('#content'); if (pane) pane.scrollTop = 0;
}

function setProjMod(i) {
  var mods = pdtModules(projById(PROJ_DETAIL_ID));
  if (!mods.length) return;
  PDSEC = 'result';
  PDMOD = Math.max(0, Math.min(i, mods.length - 1));
  renderProjNav(); markProjNav();
  renderProjTabs(); renderProjPanel();
  renderProjTitle();   /* 结果栏的页头 = 当前模块名（PDMOD 刚变过） */
  var pane = $('#content'); if (pane) pane.scrollTop = 0;
}

/* ---------- 六个面板 ---------- */
function pdtInfoPanel(p, st) {
  /* 数据集不在这一屏列表：它已经自己占了一个页签。这里只留计数与去处 ——
     两处各画一张表的话，改一处就会漂一处，而没有任何断言看得见。 */
  var dsIn = st.ds.filter(function (c) { return c.dir === 'in'; }).length;
  var els = st.ds.reduce(function (a, c) { return a + c.el; }, 0);
  var dsLine = st.ds.length
    ? '输入 ' + dsIn + ' 个 · 输出 ' + (st.ds.length - dsIn) + ' 个 · 共 ' + fmtNum(els) + ' 个元素，明细见「数据集」页签。'
    : '该项目尚未产出数据集 —— 数据集是分析流程跑完后的产物。';
  return '<div class="stack">'
    /* 四个指标与卡片上那行摘要同源 */
    + '<div class="mrow">'
    + '<div class="mcell"><div class="mcell__l">样本数量</div><div class="mcell__v">' + fmtNum(p.sm)
    + '<span class="mcell__u">' + esc(p.u) + '</span></div><div class="mcell__f">登记在样本管理</div></div>'
    + '<div class="mcell"><div class="mcell__l">分析流程</div><div class="mcell__v">' + p.rn
    + '<span class="mcell__u">条</span></div><div class="mcell__f">含模板与自定义</div></div>'
    + '<div class="mcell"><div class="mcell__l">数据集</div><div class="mcell__v">' + st.ds.length
    + '<span class="mcell__u">个</span></div><div class="mcell__f">' + (st.ds.length ? '已归属本项目' : '尚未登记') + '</div></div>'
    + '<div class="mcell"><div class="mcell__l">运行记录</div><div class="mcell__v">' + st.log.length
    + '<span class="mcell__u">条</span></div><div class="mcell__f">' + (st.log.length ? '取自运行日志' : '暂无记录') + '</div></div>'
    + '</div>'
    + '<div><div class="pd__sec">' + ico('circle-info') + '项目信息</div>'
    + pdtKV([
        ['项目编号', p.id],
        ['项目名称', esc(p.n)],
        ['负责人', esc(p.own)],
        ['参考基因组', p.ref === '—' ? '不适用（不依赖参考基因组）' : esc(p.ref)],
        ['样本数量', fmtNum(p.sm) + ' ' + esc(p.u)],
        ['创建时间', p.created],
        ['最近更新', p.t],
        ['项目状态', projStTag(p.st)]
      ])
    + '</div>'
    + '<div><div class="pd__sec">' + ico('align-left') + '项目描述</div>'
    + '<p class="pbody">' + esc(p.d) + '</p></div>'
    + '<div data-pdsec="ds"><div class="pd__sec">' + ico('database') + '关联数据集（' + st.ds.length + '）</div>'
    + '<div class="row"><span class="text-[12.5px] text-ink3">' + esc(dsLine) + '</span>'
    + '<button type="button" class="btn btn--sm" data-pdt="dataset">' + ico('arrow-right') + '去「数据集」页签</button>'
    + '</div></div>'
    + '</div>';
}

/* ---------- 数据集（v40：从独立菜单收进项目概况） ----------
   为什么它姓「项目」：数据集不是独立资产，它是某条分析流程在某次运行里读进去
   或吐出来的东西。脱离了项目，一份 counts 矩阵回答不了「为什么有它」。
   因此按 dir 分成两张表 —— 输入回答「用什么跑的」，输出回答「跑出了什么」，
   两者混在一张表里排序会把因果顺序搅乱。 */
function pdtDsTable(list, wrapAttrs) {
  return '<div class="tblwrap"><table class="tbl"><thead><tr>'
    + '<th>名称</th><th>类型</th><th class="num">元素</th><th class="num">产出任务</th><th class="num">更新时间</th>'
    + '</tr></thead><tbody' + (wrapAttrs || '') + '>'
    + list.map(function (c) {
        return '<tr><td>' + esc(c.n) + '</td><td>' + esc(c.kind) + '</td>'
          + '<td class="num">' + fmtNum(c.el) + '</td>'
          + '<td class="num">' + (c.job === '—' ? '<span class="text-ink3">外部导入</span>' : 'job ' + c.job) + '</td>'
          + '<td class="num nw">' + c.t + '</td></tr>';
      }).join('')
    + '</tbody></table></div>';
}

function pdtDatasetPanel(p, st) {
  var inl = st.ds.filter(function (c) { return c.dir === 'in'; });
  var outl = st.ds.filter(function (c) { return c.dir === 'out'; });
  if (!st.ds.length) {
    return '<div class="stack">'
      + '<div><div class="pd__sec">' + ico('database') + '数据集</div>'
      + pdEmpty('该项目还没有数据集。导入的原始数据与流程跑出的成果都会按所属项目挂到这里，'
        + '在「数据汇集」页导入后即可看到。') + '</div></div>';
  }
  return '<div class="stack">'
    + '<div class="mrow">'
    + '<div class="mcell"><div class="mcell__l">输入数据集</div><div class="mcell__v">' + inl.length
    + '<span class="mcell__u">个</span></div><div class="mcell__f">外部导入 / 索引类</div></div>'
    + '<div class="mcell"><div class="mcell__l">输出数据集</div><div class="mcell__v">' + outl.length
    + '<span class="mcell__u">个</span></div><div class="mcell__f">流程跑出的成果</div></div>'
    + '<div class="mcell"><div class="mcell__l">元素合计</div><div class="mcell__v">'
    + fmtNum(st.ds.reduce(function (a, c) { return a + c.el; }, 0))
    + '<span class="mcell__u">个</span></div><div class="mcell__f">样本 / 文件 / 单细胞</div></div>'
    + '</div>'
    + '<div data-pdsec="ds-detail"><div class="pd__sec">' + ico('file-arrow-down') + '输入数据集（' + inl.length + '）</div>'
    + (inl.length ? pdtDsTable(inl, ' data-pdsin')
        : '<p class="text-[12.5px] text-ink3">本项目没有外部导入的数据集。</p>')
    + '</div>'
    + '<div><div class="pd__sec">' + ico('file-arrow-up') + '输出数据集（' + outl.length + '）</div>'
    + (outl.length ? pdtDsTable(outl, ' data-pdsout')
        : '<p class="text-[12.5px] text-ink3">本项目还没有跑出成果 —— 输出数据集在分析流程运行成功后产出。</p>')
    + '</div>'
    + '<p class="fld__h mb-0">输出数据集可以在下一条流程里当输入用；'
    + '两条集合隶属同一个项目，前后关系看「产出任务」一列。 · 共 ' + ownStats(p).ds.length + ' 个数据集。</p>'
    + '</div>';
}

function pdtSamplePanel(p, st) {
  var body = st.smp.length
    ? '<div class="tblwrap"><table class="tbl"><thead><tr><th>样本名</th><th>类型</th><th>分组</th></tr></thead><tbody data-psm>'
      + st.smp.map(function (x) {
          return '<tr><td class="num">' + x[0] + '</td><td>' + x[1] + '</td><td>' + x[4] + '</td></tr>';
        }).join('') + '</tbody></table></div>'
    : pdEmpty('该项目尚未登记样本。样本在「样本管理」里登记后归属到当前项目。');
  return '<div class="stack">'
    + '<div><div class="pd__sec">' + ico('vial') + '关联样本（' + st.smp.length + '）</div>' + body + '</div>'
    + '<p class="fld__h">样本规模的权威数字在「样本管理」里维护；这一屏只列已登记到本项目的样本，'
    + '用于确认分组是否齐整。</p>'
    + '</div>';
}

/* 分析参数：这套值不是编的 —— 与「参数配置」页的系统推荐配置同源
   （padj < 0.05 / |log2FC| ≥ 1.0 / 最低表达量 ≥ 10 / BH 校正）。
   项目之间的差异只体现在参考基因组、物种与默认流程上，那三项现算。 */
function pdtParamPanel(p, st) {
  var fl = projFlows(p), first = fl.length ? fl[0] : null;
  /* v47：带 params 的项目（= 走完六步向导建的）如实显示它自己那份参数，
     不再显示「系统推荐值」。库里那 13 条历史项目没有 params 字段，
     继续走推荐值那一路 —— 两条路不是二选一，而是「有没有用户确认过的值」。 */
  var pr = p.params || null;
  var rows = [
    ['参考基因组', p.ref === '—' ? '不适用（宏基因组 / 16S / 代谢组按各自注释库运行）' : esc(p.ref)],
    ['物种', esc(p.sp)],
    ['显著性判定', pr ? 'padj &lt; ' + esc(pr.padj) + '（' + esc(pr.adj) + ' 校正）'
                      : 'padj &lt; 0.05（Benjamini-Hochberg 校正）'],
    ['变化幅度', pr ? '|log2FC| ≥ ' + esc(pr.lfc) : '|log2FC| ≥ 1.0（至少 2 倍）'],
    ['最低表达量', pr ? '≥ ' + esc(pr.mincount) + '（低于此值的基因先过滤）' : '≥ 10（低于此值的基因先过滤）']
  ];
  if (pr) {
    rows.push(['比对工具', esc(pr.aligner)]);
    rows.push(['定量方法', esc(pr.quant)]);
    rows.push(['差异分析算法', esc(pr.de)]);
    rows.push(['线程 / 内存', esc(pr.threads) + ' 核 / ' + esc(pr.mem) + ' GB']);
    rows.push(['附加处理', [pr.pair ? '配对设计' : '', pr.batch ? '批次效应校正' : '',
      pr.outlier ? '自动标记离群样本' : ''].filter(Boolean).join(' · ') || '无']);
  }
  rows.push(['富集数据库', 'GO / KEGG']);
  rows.push(['默认流程', first ? esc(first.n) : '—']);
  rows.push(['流程节点数', first ? first.nodes.length + ' 个' : '—']);
  rows.push(['已登记流程', p.rn + ' 条（流程模板库共 ' + FLOWS.length + ' 条）']);
  return '<div class="stack">'
    + '<div><div class="pd__sec">' + ico('sliders') + '参数快照'
    + (pr ? '<span class="tag tag--brand ml-2">向导已确认</span>' : '') + '</div>'
    + pdtKV(rows)
    + '</div>'
    + '<div class="row">'
    + '<button type="button" class="btn btn--sm" data-go="p05">' + ico('screwdriver-wrench') + '去「参数配置」调整</button>'
    + '<button type="button" class="btn btn--sm btn--quiet" data-go="p04">' + ico('diagram-project') + '查看流程模板</button>'
    + '</div>'
    + '<p class="fld__h mb-0">'
    + (pr ? '这一份是新建项目时在第 5 步「参数配置」确认的取值；实际运行时以「参数配置」页最后一次确认的参数为准。'
          : '这里给的是系统按项目规模与数据类型推荐的取值，实际运行时以「参数配置」页最后一次确认的参数为准。')
    + '</p>'
    + '</div>';
}

function pdtRefPanel(p) {
  var g = (p.ref && p.ref !== '—') ? refById(p.ref) : null;
  if (!g) {
    return '<div class="stack">'
      + '<div><div class="pd__sec">' + ico('dna') + '参考基因组</div>'
      + pdEmpty('本项目不依赖参考基因组 —— 宏基因组 / 16S / 代谢组类项目按各自的注释库与数据库运行，'
        + '在项目信息里显示为「不适用」。') + '</div></div>';
  }
  return '<div class="stack">'
    + '<div><div class="pd__sec">' + ico('dna') + '参考基因组（' + esc(g.alias) + '）</div>'
    + pdtKV([
        ['别名', esc(g.alias)],
        ['组装版本', esc(g.n)],
        ['物种', spLabel(g.sp)],
        ['发表版本', esc(g.build)],
        ['序列大小', esc(g.seq)],
        ['注释', esc(g.anno)],
        ['来源', esc(g.src)],
        ['入库时间', esc(g.built)],
        ['已服务任务', g.jobs + ' 次'],
        ['当前项目', p.id + ' · ' + esc(p.n)]
      ])
    + '</div>'
    + '<div><div class="pd__sec">' + ico('box-archive') + '已建索引（' + g.idx.length + '）</div>'
    + '<div class="tblwrap"><table class="tbl"><thead><tr><th>比对工具</th><th class="num">索引大小</th></tr></thead><tbody>'
    + g.idx.map(function (x) { return '<tr><td>' + esc(x.t) + '</td><td class="num">' + esc(x.s) + '</td></tr>'; }).join('')
    + '</tbody></table></div></div>'
    + '<p class="fld__h mb-0">参考基因组与索引在「数据汇集」页选择，切换参考基因组会让已建档的基因注释需要重建。</p>'
    + '</div>';
}

function pdtFlowPanel(p) {
  var fl = projFlows(p);
  if (!fl.length) {
    return '<div class="stack">'
      + '<div><div class="pd__sec">' + ico('diagram-project') + '实验流程</div>'
      + pdEmpty('该项目还没有登记流程模板。在「流程模板」页新建或复制一条，即可在本项目下运行。') + '</div></div>';
  }
  var note = p.rn > FLOWS.length
    ? '本项目累计登记 ' + p.rn + ' 条流程，其中 ' + (p.rn - FLOWS.length)
      + ' 条为已归档的历史版本（流程模板库共 ' + FLOWS.length + ' 条），仅在「运行日志」中留痕。'
    : '本项目登记的 ' + p.rn + ' 条流程均取自流程模板库（共 ' + FLOWS.length + ' 条），可在「流程模板」页继续编辑。';
  return '<div class="stack">'
    + '<div><div class="pd__sec">' + ico('diagram-project') + '流程模板（' + fl.length + '）</div>'
    + '<div class="tblwrap"><table class="tbl"><thead><tr><th>流程名称</th><th class="num">节点</th><th>链路</th></tr></thead><tbody data-pfl>'
    + fl.map(function (f) {
        return '<tr><td>' + esc(f.n) + '</td><td class="num">' + f.nodes.length + '</td>'
          + '<td class="text-[11.5px]">' + esc(f.s) + '</td></tr>';
      }).join('')
    + '</tbody></table></div></div>'
    + '<p class="fld__h mb-0">' + esc(note) + '</p>'
    + '</div>';
}

function pdtRunPanel(p, st) {
  var body = st.log.length
    ? '<div class="tblwrap"><table class="tbl"><thead><tr><th>时间</th><th>类型</th><th>结果</th><th>说明</th></tr></thead><tbody data-plg>'
      + st.log.map(function (l) {
          return '<tr><td class="num nw">' + l[0].slice(0, 16) + '</td><td>' + l[2] + '</td>'
            + '<td>' + l[3] + '</td><td class="text-[11.5px]">' + esc(l[5]) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
    : pdEmpty('该项目暂无运行记录。');
  return '<div class="stack">'
    + '<div><div class="pd__sec">' + ico('play') + '运行记录（' + st.log.length + '）</div>' + body + '</div>'
    + '<div class="row">'
    + '<button type="button" class="btn btn--sm" data-proj-golog>' + ico('clipboard-list') + '去「运行日志」看全站记录</button>'
    + '</div>'
    + '</div>';
}

function renderProjPanel() {
  var body = $('#projBody');
  if (!body) return;
  var p = projById(PROJ_DETAIL_ID);
  if (!p) { body.innerHTML = pdEmpty('未找到项目 ' + esc(String(PROJ_DETAIL_ID || ''))); return; }
  var st = ownStats(p);
  /* 分析结果不是「一屏内容」而是一组页面（每个模块一页），所以它不走面板表 */
  if (PDSEC === 'result') { body.innerHTML = pdtModPanel(p, st); mountPano('#panoMount', PANO_VIEW); return; }
  var map = {
    info: pdtInfoPanel, sample: pdtSamplePanel, dataset: pdtDatasetPanel,
    param: pdtParamPanel, ref: pdtRefPanel, flow: pdtFlowPanel, run: pdtRunPanel
  };
  /* 只渲染当前那一栏的面板：几个面板都住在 DOM 里（同一套 .pjpanel 显隐做法），
     切页签只换显示、不重画 —— 切回来时表格滚动位置与选中态都还在。 */
  body.innerHTML = (pdtHost(PDSEC).tabs || []).map(function (k) {
    var t = pdtTabOf(k);
    if (!t || !map[k]) return '';
    var on = (k === PDTAB);
    return '<div class="pjpanel' + (on ? ' is-on' : '') + '" id="pdt-' + k + '"'
      + ' data-pdtpanel="' + k + '" role="tabpanel" aria-labelledby="pdt-tab-' + k + '">'
      + map[k](p, st) + '</div>';
  }).join('');
}

/* ---------- 分析结果的模块页 ----------
   参考系统的模块页长这样：顶栏一行「分析进度 + 当前页分析状态 + 生成报告」，
   下面一条横向流程条（当前步高亮加粗），再往下才是这一模块的结果。
   这里照同一套骨架来，但内容全部取本系统真实数据 ——
   本步产出取命中的输出数据集、运行记录取命中的日志、状态由记录现算。 */
function pdtModPanel(p, st) {
  var mods = pdtModules(p), f = projFlows(p)[0] || null;
  if (!mods.length) {
    return pdEmpty('该项目还没绑定分析流程，所以「分析结果」下没有模块。'
      + '先在「分析执行 › 实验流程」里给它选一条流程。');
  }
  var i = Math.max(0, Math.min(PDMOD, mods.length - 1));
  var nm = mods[i], d = pdtModData(p, nm);
  var up = i > 0 ? mods[i - 1] : '';
  var dn = i < mods.length - 1 ? mods[i + 1] : '';
  var stTxt = { ok: '完成', run: '运行中', bad: '失败', none: '未运行' }[d.st];
  var stCls = { ok: 'tag--ok', run: 'tag--brand', bad: 'tag--danger', none: '' }[d.st];

  /* v42：「结果全景」是收口页，不套模块骨架。
     本步产出 / 本步运行记录对它没有意义 —— 流程里根本没有这一步，那几个数永远是 0，
     一屏两处「0 条 + 空态说明」读起来像加载失败。它要的是那份全景本身。
     顶上只留一排「分析进度」：它回答「整个项目跑到哪了」，放在收口页正合适。 */
  if (pdtIsPano(nm)) {
    return '<div class="stack">' + pdtProgBar(p) + '<div id="panoMount"></div></div>';
  }

  var dsBlock = d.ds.length
    ? '<div class="tblwrap"><table class="tbl"><thead><tr><th>名称</th><th>类型</th><th>方向</th>'
      + '<th class="num">元素</th><th class="num">job</th><th class="num">产出时间</th></tr></thead><tbody data-pmodds>'
      + d.ds.map(function (x) {
          return '<tr><td>' + esc(x.n) + '</td><td>' + esc(x.kind) + '</td>'
            + '<td><span class="tag tag--ok">输出</span></td><td class="num">' + fmtNum(x.el) + '</td>'
            + '<td class="num">' + x.job + '</td><td class="num nw">' + x.t.slice(0, 16) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
    : pdEmpty('这一步没有独立的产出数据集 —— ' + esc(nm) + ' 的产物并入了下游步骤的数据集。');

  var lgBlock = d.lg.length
    ? '<div class="tblwrap"><table class="tbl"><thead><tr><th>时间</th><th>类型</th><th>结果</th>'
      + '<th>说明</th></tr></thead><tbody data-pmodlg>'
      + d.lg.map(function (l) {
          return '<tr><td class="num nw">' + l[0].slice(0, 16) + '</td><td>' + l[2] + '</td>'
            + '<td>' + l[3] + '</td><td class="text-[11.5px]">' + esc(l[5]) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
    : pdEmpty('这一步还没有运行记录。在「分析执行 › 实验流程」里跑一次就会留下记录。');

  return '<div class="stack">'
    /* ① 顶栏：进度计数回答「整个项目跑到哪了」，右侧回答「我正看的这步什么状态」。 */
    + pdtProgBar(p, '<span class="ml-auto row">'
        + '<span class="pd__st">' + ico('circle-info') + '当前模块状态'
        + '<span class="tag ' + stCls + '">' + stTxt + '</span></span>'
        + '<button type="button" class="btn btn--sm" data-dl="modres">' + ico('download') + '导出本步清单</button>'
        + '</span>')
    /* ② 模块标题 + 它在整条线上的位置（上下游） */
    + '<div><div class="pd__sec">' + ico('table-cells') + esc(nm) + '</div>'
    + '<div class="text-[12px] text-ink3">第 ' + (i + 1) + ' / ' + mods.length + ' 步'
    + (up ? ' · 上游 ' + esc(up) : ' · 本步是首步')
    + (dn ? ' · 下游 ' + esc(dn) : ' · 本步是末步') + '</div></div>'
    /* ③ 本步产出 */
    + '<div data-pdsec="modds"><div class="pd__sec">' + ico('database') + '本步产出（' + d.ds.length + '）</div>'
    + dsBlock + '</div>'
    /* ④ 本步运行记录 */
    + '<div><div class="pd__sec">' + ico('clipboard-list') + '本步运行记录（' + d.lg.length + '）</div>'
    + lgBlock + '</div>'
    /* ⑤ 去两处：完整流程定义、本项目全部运行记录。
       两个都只挂 data-pdt —— setProjTab 会顺带把左栏切到「分析执行」，
       再挂一个 data-pds 反而会被先命中，把「run」吞掉（页面停在 flow 上）。 */
    + '<div class="row">'
    + '<button type="button" class="btn btn--sm" data-pdt="flow">'
    + ico('diagram-project') + '看完整流程定义</button>'
    + '<button type="button" class="btn btn--sm" data-pdt="run">'
    + ico('play') + '看本项目全部运行记录</button>'
    + '</div>'
    + '</div>';
}

/* 把 #panoTpl 的内容挂进指定宿主（v42 建；v51 改成双宿主）。
   为什么不让页面直接把 HTML 拼出来：那份全景有 300 行静态标记，
   拼成 JS 字符串就得把里面的引号转义一遍，改一次错一次；<template> 里是原样的 HTML。

   v51：「结果全景」现在有两个宿主 ——
     · 项目详情 › 分析结果 › 结果全景（#panoMount）
     · 智能分析第 5 步「查看分析结果」（#resMount）
   所以挂载前必须把**另一个**宿主清空。这不是省内存：template 里带着 #viewSeg
   与三张空表体的 id，两份同时存在就有两个同 id 元素 —— fillTables() 用 id 找表，
   只会填到文档里的第一份，另一份的表现是「表是空的、对应的导出点不动」，
   而页面看上去完全正常；.rview / #viewSeg 这些选择器本来就是全局的，
   切视图会同时切两份。互斥比「同名共存」好守得多。

   挂载后必须**显式**补两件事 —— 它们原本跑在 init() 里，而那一刻这段内容
   还躺在 <template> 里（不在文档树，$ 找不到它）：
     · fillTables() 填三张空表体（富集 / 蛋白组 / 代谢组）——
       不补的话那三条导出只能读到光表头，dlFromTable 见 rows < 2 就返回 null，
       表象是「导出入口有一半点不动」，而页面看起来完全正常；
     · renderChart() 把 13 个 .chartbox 渲染成图（按实际宽度画，所以宿主必须先可见）。
   fillTables 用 innerHTML 覆盖写，幂等 —— 反复进出这一页不会把行叠起来。 */
var PANO_HOSTS = ['#panoMount', '#resMount'];
function mountPano(slotId, view) {
  var tpl = $('#panoTpl');
  if (!tpl) return;
  PANO_HOSTS.forEach(function (s) {
    if (s === slotId) return;
    var o = $(s);
    if (o) o.innerHTML = '';   /* 同一时刻只留一份在文档里 */
  });
  var slot = $(slotId);
  if (!slot) return;
  slot.innerHTML = '';
  slot.appendChild(tpl.content.cloneNode(true));
  fillTables();
  $$(slotId + ' .chartbox').forEach(renderChart);
  setView(view || PANO_VIEW);
}

function renderProjDetail(pid) {
  var old = PROJ_DETAIL_ID;
  PROJ_DETAIL_ID = pid || PROJ_DETAIL_ID;
  /* 换了项目 → 模块清单整体换一套，PDMOD 必须归零：
     18 个模块的项目切到只有 3 个的项目时，旧下标会越界读到 undefined。 */
  if (PROJ_DETAIL_ID !== old) {
    PDMOD = 0;
    if (PDSEC === 'result') PDTAB = 'info';
    /* 换了项目 → 全景视图回到第一格。带着上一个项目的「差异表达」进新项目，
       停在一个与来路无关的视图上说不通。 */
    PANO_VIEW = 'variant';
  }
  /* 左栏与页签是同一个状态的两面，跨入口跳进来时可能对不上
     （比如带着 pdt='run' 直接进来）。以页签为准把它捋顺。 */
  if (PDSEC !== 'result') PDSEC = pdtHostOfTab(PDTAB);
  renderProjHead(PROJ_DETAIL_ID);
  renderProjNav(); markProjNav();
  renderProjTabs();
  renderProjPanel();
  /* v44：页头标题必须在**这里**补一次 —— goto 里 renderCrumb 跑在 renderProjDetail
     之前，那时 PDSEC / PDMOD 还是上一页留下的值，面包屑末段会先写成错的名字。 */
  renderProjTitle();
}

/* 跨页跳进来的落点提示：从样本档案的跨组学表点「查看数据」时，用户要看的是
   「这个项目下面有哪些数据集」。进了页面还得指出是哪一块，否则等于把人扔到
   一屏内容顶上自己找。
   sec 一律是页内的 anchor 锚点（见各面板上的 data-pdsec），不是页签名 ——
   页签由 openProjDetail 的第二个参数直接落到 PDTAB 上，两件事分开，
   免得「跳到某个页签」和「找到页签里的某一块」互相覆盖。 */
function projFlash(sec) {
  setTimeout(function () {
    var el = $('#projBody [data-pdsec="' + sec + '"]');
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.classList.add('is-flash');
    setTimeout(function () { el.classList.remove('is-flash'); }, 1600);
  }, 60);
}

/* tab：直接落到某个页签（不传 = 上次那个 / info）；
   focus：进页面后把某一块滚到视野中央并闪一下；
   mod：直接落到「分析结果」下第几个模块（对齐参考系统「查看 → 进项目分析线」的落点）。
   「查看数据」两样都给：先看数据集页签，再定位到输入 / 输出明细那一块。 */
function openProjDetail(pid, tab, focus, mod) {
  if (!projById(pid)) return;
  goto('projdetail', { proj: pid, pdt: tab, pmod: mod });
  if (focus) projFlash(focus);
}

/* 空态显式渲染，不能静默跳过：13 个项目里只有 2 个有登记资产，
   如果直接不渲染这一块，评审看到的就是「详情页少了几节」而不是「这个项目还没导数据」。 */
function pdEmpty(txt) {
  return '<div class="pd__empty">' + ico('inbox') + '<span>' + txt + '</span></div>';
}

/* ============================================================
   v46：整块撤掉了「基因档案重建」。
   原来这一节是「样本档案 › 基因档案」那个 tab 的重建能力：
   GENE_LAST 快照、GRB_SCOPE 重建范围、GRB_SRC 依据来源、GRB 运行态与
   GRB_PHASES、grbScopeBy / grbPicked / grbEvidence、geneLastText /
   renderGeneLast（「最近一次重建」印章）、grbTagSet / grbCell、
   renderGeneRebuild（配置 → 执行 → 结果三态）、openGeneRebuild /
   closeGeneDrawer、grbRun / grbFinish。
   那个 tab 撤了，它就没有任何入口 —— 连同 #drawerGene / #backGene 一起
   整块删：不留在 hidden 里的空壳，也不留走不到的分支（同 v39 撤项目抽屉）。
   ============================================================ */

/* ---------- 分享项目 ---------- */
var SHARE_PID = '', SHARE_DAYS = '7', SHARE_ROLE = '只读';

/* 短哈希：让链接形如 /s/001-a3f9。必须**确定性**（同一项目每次都算出同一串），
   否则改一次有效期就换一条链接，用户手里刚复制的那条立刻作废。 */
function shortHash(str) {
  var h = 0;
  for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) & 0xffff; }
  return ('0000' + h.toString(16)).slice(-4);
}

/* 分享链接从当前地址派生，而不是写死一个域名：
   写死的话在线版分享出去的链接指向一个不存在的站点，而且离线版会多出一条
   外部请求（构建自检会拦）。file:// 打开时没有 origin，退回源系统域名占位。 */
function projShareUrl(p) {
  var base = '';
  if (location.protocol === 'http:' || location.protocol === 'https:') base = location.origin;
  if (!base) base = 'aizx.jwzcloud.com:1888';
  return base + '/s/' + p.id.slice(-3) + '-' + shortHash(p.id);
}

var SHARE_DAY_OPTS = [['7', '7 天'], ['30', '30 天'], ['0', '永久']];
var SHARE_ROLE_OPTS = ['只读', '可评论', '可编辑'];

function projShareBody(pid) {
  var p = projById(pid); if (!p) return '';
  var url = projShareUrl(p);
  var members = [[p.own, '负责人', '可编辑'], ['张医生', '项目成员', '可评论'], ['李研究员', '项目成员', '只读']];
  return '<div class="stack">'
    + '<div class="pd__hd"><div class="min-w-0 flex-1">'
    + '<div class="pd__n">分享「' + esc(p.n) + '」</div>'
    + '<div class="pd__sub">' + p.id + ' · 当前可见范围：' + esc(p.vis) + '</div>'
    + '</div></div>'

    + '<div><div class="pd__sec">' + ico('link') + '分享链接</div>'
    + '<div class="sharelink"><span class="sharelink__u" id="shareUrl">' + url + '</span>'
    + '<button type="button" class="btn btn--sm" data-share-copy>' + ico('copy') + '复制</button></div>'
    + '<div class="fld__h mt-2">链接在有效期内可被任意持链者访问，到期自动失效；在「空间设置」里撤销分享会立即失效。</div></div>'

    + '<div><div class="pd__sec">有效期</div>'
    + '<div class="seg seg--sm" role="group" aria-label="链接有效期">'
    + SHARE_DAY_OPTS.map(function (d) {
        var on = d[0] === SHARE_DAYS;
        return '<button type="button" class="seg__b' + (on ? ' is-on' : '') + '" data-share-days="' + d[0] + '" aria-selected="' + (on ? 'true' : 'false') + '">' + d[1] + '</button>';
      }).join('')
    + '</div></div>'

    + '<div><div class="pd__sec">访问权限</div>'
    + '<div class="seg seg--sm" role="group" aria-label="访问权限">'
    + SHARE_ROLE_OPTS.map(function (r) {
        var on = r === SHARE_ROLE;
        return '<button type="button" class="seg__b' + (on ? ' is-on' : '') + '" data-share-role="' + r + '" aria-selected="' + (on ? 'true' : 'false') + '">' + r + '</button>';
      }).join('')
    + '</div>'
    + '<div class="fld__h mt-2">只读：只能查看结果与图表；可评论：可对结果留批注；可编辑：可上传数据与重跑流程。</div></div>'

    + '<div><div class="pd__sec">' + ico('users') + '已授权成员（' + members.length + '）</div>'
    + '<div class="tblwrap"><table class="tbl"><thead><tr><th>成员</th><th>角色</th><th>权限</th></tr></thead><tbody>'
    + members.map(function (m) {
        return '<tr><td>' + esc(m[0]) + '</td><td>' + m[1] + '</td><td>' + m[2] + '</td></tr>';
      }).join('')
    + '</tbody></table></div></div>'

    + '</div>';
}

function projShareFoot() {
  return '<button type="button" class="btn" data-close="modal">取消</button>'
    + '<button type="button" class="btn btn--primary" data-share-done>' + ico('share-nodes') + '复制分享链接</button>';
}

function openProjShare(pid) {
  var p = projById(pid) || curProj();
  if (!p) return;
  SHARE_PID = p.id;
  showModal('分享项目', projShareBody(p.id), projShareFoot());
}

function copyShareUrl() {
  var el = $('#shareUrl');
  if (!el) return;
  var u = el.textContent;
  var fired = false;
  var done = function () {
    if (fired) return;      /* 两条路（promise / 兜底定时器）只算一次 */
    fired = true;
    var dv = (SHARE_DAYS === '0') ? '永久有效' : ('有效期 ' + SHARE_DAYS + ' 天');
    toast('分享链接已复制（' + dv + ' · ' + SHARE_ROLE + '）', 'ok');
  };
  /* file:// 不是安全上下文，navigator.clipboard 常常不存在；
     两条路都要走到同一个提示，不能让「复制不了」变成「静默无反应」。
     更要紧的是它存在时也可能**既不 resolve 也不 reject**（页面失焦、权限待定）——
     提示押在它身上就会出现「点了没反应」，所以补一道超时兜底。 */
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(u).then(done, done);
    setTimeout(done, 120);
  } else { done(); }
}

/* ---------- 新建项目 ---------- */
function nowStr() {
  var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate())
    + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
}

/* 编号按已有最大值自增，不写死：写死的话第二次新建就会撞号 */
function nextProjId() {
  var max = 0;
  PROJECTS.forEach(function (p) {
    var m = /^P-(\d{4})-(\d+)$/.exec(p.id);
    if (m) max = Math.max(max, parseInt(m[2], 10));
  });
  return 'P-' + new Date().getFullYear() + '-' + ('00' + (max + 1)).slice(-3);
}

/* ============================================================
   新建项目：五步向导（v37 需求 6）
   ------------------------------------------------------------
   参考系统（/scgk/project-manage → 新建项目）把建项目拆成 5 步，每步只问
   一类事：填写基本信息 → 选择数据文件 → 选择分组方案 → 选择比较方案 →
   项目创建完成。本原型照这个次序落地，步骤名、字段名、必填项都与参考系统
   一致；下面这些校验规则也是从参考系统抄回来的**真规则**，不是自拟的：
     · 分组名必须以字母开头、长度 1–8、只能字母数字下划线、末位不能是
       下划线或中划线、不能重名；
     · 每个分组至少分配 2 例样本；
     · 分组方案名 / 比较方案名唯一，比较组不能重复、对照组与处理组都不能空。

   为什么不做成一张长表单：项目落库时要同时带上「数据文件 + 分组方案 +
   比较方案」三件事，一张长表单会让用户在最后一屏才发现「没选分组」而
   回头翻两屏。步骤条把「还差几步、差哪一步」摆在明处，且每步只校验本步。

   状态集中在 PNEW 一个对象上，renderProjNew() 每次按 PNEW.step 整块重画。
   子编辑器（新增样本ID / 新建分组方案 / 新建比较方案）走 PNEW.view 就地
   切换，**不叠第二层弹窗** —— 全站只有 #modal 一个模态容器，叠层会同时
   踩 z-index 与 Esc 分层的两个老坑（见 §5 踩坑速查第 1 条）。
   ============================================================ */
/* v39 需求 2：步骤轴按本系统的实际情况重排（不再照抄参考系统的 5 步）。
   本系统的分组方案与比较方案是一套配套的选择 —— 比较组的两个下拉**来自
   刚建的分组**，先有组才能定义谁比谁 —— 拆成两屏时用户要在两个长得几乎
   一样的列表页之间来回翻，合起来才是这套东西的真实操作节奏。
   于是 5 步 → 4 步：
     ① 项目信息（含样本登记、参考基因组）② 数据文件 ③ 分组与比较方案 ④ 创建完成

   v47 需求 2：**4 步 → 6 步**，「与目前实际的创建分析流程相匹配」。
   本系统真正的分析流程是 数据汇集 → 流程模板 → 参数配置 → 任务运行
   （左栏「智能分析」那四项、以及各页顶部那条 stepper 就是它）。
   原来的向导走到「分组与比较方案」就直接跳「创建完成」——
   等于建了一个**没有流程模板、没有参数**的项目，建完还得去 p04 / p05 先把
   这两件事补上，那两步才是「这个项目要跑什么、怎么跑」的全部内容。
   补进来之后，向导与主流程逐段对齐：
     ① 项目信息 ② 数据文件（=数据汇集）③ 分组与比较方案
     ④ 流程模版（=流程模板）⑤ 参数配置（=参数配置）⑥ 创建完成
   末段「任务运行」不属于建项目 —— 建完才跑，所以不进向导。

   注意：步骤条是「还差几步」的进度指示，不是参考系统的复刻；
   每步名与本步实际做的事逐字对应，改步骤内容时这张表必须一起改。 */
var PNEW_STEPS = ['项目信息', '数据文件', '分组与比较方案', '流程模版', '参数配置', '创建完成'];
var PNEW_TYPES = ['组织', '全血', '细胞'];

/* 参数配置（第 5 步）的可选值。**与「参数配置」页（p05）同源同名** ——
   两处各写一套下拉必然有一天出现「p05 有 STAR，向导里没有」这种分叉。
   这里只列向导需要的六项；p05 那份完整面板还有参考基因组与更多输出项。 */
var PNEW_PARAM_OPTS = {
  aligner: ['HISAT2 2.2.1', 'STAR 2.7.11b', 'Bowtie2 2.5.3'],
  quant:   ['featureCounts 2.0.6', 'Salmon 1.10.2', 'HTSeq 2.0.5'],
  de:      ['DESeq2 1.42.0', 'edgeR 4.0.16', 'limma-voom 3.58.1'],
  padj:    ['0.05', '0.01', '0.001', '0.1'],
  adj:     ['Benjamini-Hochberg', 'Bonferroni', 'Benjamini-Yekutieli']
};
var PNEW = null;

/* 候选样本来自样本档案（不另造一份示例数据）：取 20 例，够演示多选与分组。
   排序用 id 字典序，和样本档案列表首屏的前 20 例对得上。 */
function pnewSampPool() {
  return Object.keys(SAMP_ARCHIVE).sort().slice(0, 20);
}
function pnewSampType(s) {
  var m = (s && s.mat) || '';
  if (/全血|血浆|血清/.test(m)) return '全血';
  if (/组织/.test(m)) return '组织';
  return '细胞';
}
function pnewSampLabel(id) {
  var s = SAMP_ARCHIVE[id];
  if (!s) return id;
  return id + ' · ' + (s.dx || '') + ' · ' + (s.subj || '');
}
/* 全选控件的三态（v48）。判的是**档案池**那 20 例的选中情况：
   none = 一例都没选、all = 全选、part = 选了一部分（表头那颗显示 indeterminate）。
   口径只算池子、不算 d.manual —— 手工新增的 ID 只有一个来源（用户刚录的），
   把它们算进来会让「全选」这个词的适用范围变成浮动的。 */
function pnewSidAllState() {
  var pool = pnewSampPool(), sids = PNEW.d.sids;
  var n = pool.filter(function (id) { return sids.indexOf(id) >= 0; }).length;
  if (!n) return 'none';
  return n === pool.length ? 'all' : 'part';
}
/* indeterminate 只能由脚本设、写不进 HTML（`indeterminate` 不是属性），
   所以每次重画之后补一次。只碰 indeterminate，不碰 checked ——
   checked 已由模板按状态渲染好了，这里再设一次就会两处打架。 */
function pnewSidAllSync() {
  if (!PNEW || PNEW.view !== 'wizard' || PNEW.step !== 0) return;
  var c = $('#pnSidAll');
  if (c) c.indeterminate = pnewSidAllState() === 'part';
}
function pnewInit() {
  return {
    step: 0,
    view: 'wizard',          /* wizard | sid | group | plan */
    /* made：进最后一步时落库出来的那条项目记录。既当幂等开关
       （来回切步不重复建），也是回执上「项目编号」的来源。 */
    made: null,
    fq: '',                  /* 第 2 步的文件名筛选 */
    flowQ: '',               /* 第 4 步的流程名筛选（v47） */
    d: {
      name: '', desc: '', grp: '', sids: [], sampDesc: '', ref: '', cond: '',
      scope: 'mine', files: [], seq: '双端测序',
      schemes: [], scheme: null,   /* 分组方案：{n, groups:[{n,sids:[]}], def} */
      plans: [], plan: null,       /* 比较方案：{n, pairs:[{a,b}], def} */
      /* v48：「新增」进来的档案外样本ID。与 d.sids（**选中的**）分开存 ——
         合成一个数组的话，用户在列表里一取消勾选，这一行就从界面上消失了，
         等于把他刚录的 ID 抹掉。分开之后「这一行还在不在」与「它选没选中」
         是两件独立的事，与档案池那 20 例走同一套勾选规则。 */
      manual: [],
      /* v47：第 4 步选的流程模板 id；空 = 还没选。落库时写进项目记录的 flow 字段，
         项目详情（流程面板 / 左栏模块 / 参数快照）都读它。 */
      flow: '',
      /* v47：第 5 步确认的运行参数。值是**字符串**（与表单控件的 value 同型），
         落库时原样记进项目记录的 params —— 别在这里转数字，转了就与界面上
         「用户看到的那个值」不是同一个东西，回执与详情页会对不上。 */
      params: {
        aligner: 'HISAT2 2.2.1', quant: 'featureCounts 2.0.6', de: 'DESeq2 1.42.0',
        lfc: '1.0', padj: '0.05', adj: 'Benjamini-Hochberg', mincount: '10',
        threads: '12', mem: '48', pair: true, batch: false, outlier: true
      }
    },
    /* 分组方案子编辑器的草稿（打开时从 scheme 复制，取消即丢弃） */
    g: null,
    /* 新增样本ID 草稿 */
    sd: null,
    /* 比较方案子编辑器的草稿 */
    pl: null
  };
}

/* ============================================================
   新建项目 · 两条入口（v50 需求 3）
   ------------------------------------------------------------
   点「新建项目」先出一屏**选择**，而不是直接进向导：
     一键全流程分析 → 原来的 6 步向导（建项目 → 选数据 → 分组 → 流程 → 参数）
     智能分析       → 不建项目，直接进 p02 那条分析线
                      （数据汇集 → 流程模板 → 参数配置 → 任务运行 → 查看分析结果）

   为什么要分这两条：这两件事在用户心里的起点不同。
   「我有个课题要立」是项目管理动作，走向导；「我先拿这批数据跑跑看」
   是分析动作，先建一个项目反而是多余的前置步骤。
   原先只有前者，后者的用户只能**编一个项目名来换一次试跑**。

   两条入口共用一套 UI（`data-pns` 一张表驱动），不各写一块 HTML ——
   第二块迟早会忘了跟第一块一起改。 */
var PNEW_MODES = [
  { k: 'full', i: 'list-check', n: '一键全流程分析',
    d: '按向导一次填完：项目信息 → 数据文件 → 分组与比较方案 → 流程模版 → 参数配置，提交后就有一个可运行的项目。',
    m: '6 步 · 适合已立项、有明确分析目标的课题' },
  { k: 'smart', i: 'wand-magic-sparkles', n: '智能分析',
    d: '自定义自编排工作流：数据汇集 → 流程模板 → 参数配置 → 任务运行 → 查看分析结果，'
      + '流程节点与运行参数都由你自己编排，跑完直接看结果。',
    m: '5 步 · 适合先试跑一批数据、再决定要不要立项目' }
];

function pnewChooseBody() {
  return '<p class="pbody">选择这次要开始哪一种。两条路用的是同一批数据与同一套流程，'
    + '区别只在「要不要先立一个项目」。</p>'
    + '<div class="pnchoose">'
    + PNEW_MODES.map(function (m) {
        return '<button type="button" class="pnchoose__c" data-pns="' + m.k + '">'
          + '<span class="pnchoose__ic">' + ico(m.i) + '</span>'
          + '<span class="pnchoose__bd">'
          + '<span class="pnchoose__n">' + esc(m.n) + '</span>'
          + '<span class="pnchoose__d">' + esc(m.d) + '</span>'
          + '<span class="pnchoose__m">' + esc(m.m) + '</span>'
          + '</span>'
          + '<span class="pnchoose__go">' + ico('arrow-right') + '</span>'
          + '</button>';
      }).join('')
    + '</div>';
}

function pnewChooseFoot() {
  return '<button type="button" class="btn" data-close="modal">取消</button>';
}

function pnewOpen() {
  showModal('新建项目', pnewChooseBody(), pnewChooseFoot());
  /* 选择屏用**窄**弹窗：两块选项是纵向排的，宽版会把它们拉成两条横带 */
  var b = $('#modal .modal__b');
  if (b) b.classList.remove('modal__b--wide');
}

/* 进「一键全流程分析」那条线：初始化向导状态、开宽版弹窗、把向导画出来。
   v50 需求 3 把这段从 openProjNew() 里抽出来，理由是它现在有**两个**调用方：
   分流屏的 full 分支，以及自动化探针 __projNew（截图 setup 与向导用例全靠它）。
   探针必须能一步进向导 —— 让它先去点分流屏，开完就 return null，
   所有向导截图与用例会一起崩（而且表现为「弹窗里什么都没有」这种很难读的失败）。
   向导是 940px 的宽弹窗，层级观与 Esc 逐层退出用的是同一条。 */
function pnewStartFull() {
  PNEW = pnewInit();
  showModal('新建项目', '', '');
  var b = $('#modal .modal__b');
  if (b) b.classList.add('modal__b--wide');
  renderProjNew();
}

/* 两条分支各自判自己的前置条件，不在入口处判 ——
   入口只负责画那一屏，谁被点中谁负责把状态摆成自己要的样子。 */
function pnewChoose(k) {
  if (k === 'smart') {
    $('#modal').hidden = true;
    if ($('#modal .modal__b')) $('#modal .modal__b').classList.remove('modal__b--wide');
    /* 智能分析线不建项目：数据汇集页自己就是「选数据」那一步。
       落点用 goto（不是 gotoRaw），这样面包屑、来路栈、左栏高亮都照常。 */
    goto('p02');
    toast('已进入智能分析：数据汇集 → 流程模板 → 参数配置 → 任务运行 → 查看分析结果', 'ok');
    return;
  }
  if (k === 'full') { pnewStartFull(); return; }
}

function openProjNew() {
  pnewOpen();
}

/* ---------- 向导外壳 ---------- */
function pnewStepper() {
  return '<ol class="wiz" aria-label="新建项目步骤">'
    + PNEW_STEPS.map(function (t, i) {
      var cls = i < PNEW.step ? ' is-done' : (i === PNEW.step ? ' is-on' : '');
      return '<li class="wiz__i' + cls + '"'
        + (i === PNEW.step ? ' aria-current="step"' : '') + '>'
        + '<span class="wiz__n" aria-hidden="true">' + (i < PNEW.step ? ico('check') : (i + 1)) + '</span>'
        + '<span class="wiz__t">' + t + '</span></li>';
    }).join('')
    + '</ol>';
}

/* 把「用户当前输入框里的值」收回 PNEW —— 切步/切视图前必须先收，否则
   上一步填的内容在重画时被丢掉。取不到控件（不在当前步）时保持原值。 */
function pnewHarvest() {
  if (!PNEW) return;
  var g = function (id) {
    var e = $('#' + id);
    return e ? String(e.value || '').replace(/^\s+|\s+$/g, '') : null;
  };
  var d = PNEW.d, v;
  if (PNEW.view === 'wizard' && PNEW.step === 0) {
    if ((v = g('pnName')) !== null) d.name = v;
    if ((v = g('pnDesc')) !== null) d.desc = v;
    if ((v = g('pnGrp')) !== null) d.grp = v;
    if ((v = g('pnSampDesc')) !== null) d.sampDesc = v;
    if ((v = g('pnRef')) !== null) d.ref = v;
    if ((v = g('pnCond')) !== null) d.cond = v;
  } else if (PNEW.view === 'wizard' && PNEW.step === 1) {
    if ((v = g('pnSeq')) !== null) d.seq = v;
    if ((v = g('pnFileQ')) !== null) PNEW.fq = v;
  } else if (PNEW.view === 'group' && PNEW.g) {
    if ((v = g('pnGName')) !== null) PNEW.g.n = v;
    if ((v = g('pnGNew')) !== null) PNEW.g.draft = v;
    if ((v = g('pnGSampQ')) !== null) PNEW.g.q = v;
  } else if (PNEW.view === 'plan' && PNEW.pl) {
    if ((v = g('pnPName')) !== null) PNEW.pl.n = v;
  } else if (PNEW.view === 'sid' && PNEW.sd) {
    ['pnSidId', 'pnSidName', 'pnSidType', 'pnSidSrc', 'pnSidDesc'].forEach(function (k) {
      var val = g(k);
      if (val !== null) PNEW.sd[k] = val;
    });
  } else if (PNEW.view === 'wizard' && PNEW.step === 3) {
    if ((v = g('pnFlowQ')) !== null) PNEW.flowQ = v;
  } else if (PNEW.view === 'wizard' && PNEW.step === 4) {
    /* 第 5 步的参数**直接从 DOM 现读**，不靠 change 事件一路回写 ——
       用户填完最后一个框直接点「下一步」是最常见的路径，那时 change
       不一定发过（输入框要失焦才发）。这里是收口的唯一地方。 */
    pnewParamHarvest();
  }
}

/* 参数表单 → PNEW.d.params 的唯一出口。按 [data-pnp] 现读，
   所以「屏上有什么、状态里就是什么」，不会出现两处各记一份而漂移。
   checkbox 取 checked，其余取 value（不转数字：见 pnewInit 的注释）。 */
function pnewParamHarvest() {
  if (!PNEW) return;
  var box = $('#pnParamBox');
  if (!box) return;
  $$('#pnParamBox [data-pnp]').forEach(function (el) {
    var k = el.getAttribute('data-pnp');
    if (!k) return;
    PNEW.d.params[k] = (el.type === 'checkbox') ? !!el.checked : el.value;
  });
}

/* 第 5 步：把一次控件改动同步进状态 + 就地刷新右侧摘要。
   返回 true 表示「这次事件属于参数表单，已经被吃掉」。
   收完了再画摘要，而不是画了再收 —— 顺序反了摘要总会慢一拍。 */
function pnewParamLive(el) {
  if (!PNEW || !el || !el.closest || !el.closest('#pnParamBox')) return false;
  pnewParamHarvest();
  var sm = $('#pnParamSum');
  if (sm) sm.outerHTML = pnewParamSum();
  return true;
}

function renderProjNew() {
  if (!PNEW) return;
  var B = $('#modalB'), F = $('#modalF');
  if (!B || !F) return;
  B.innerHTML = pnewStepper() + '<div class="wiz__bd">' + pnewBody() + '</div>';
  F.innerHTML = pnewFoot();
  var T = $('#modalT'); if (T) T.textContent = '新建项目';
  /* 六步向导全程用宽版弹窗：第 2/3/4 步都是「列表 + 明细」两栏，
     窄弹窗下两栏会挤成两条缝；宽度不随步骤变也是刻意的 —— 切换时弹窗
     忽宽忽窄，用户刚建立的空间感会被反复打散。 */
  var b = $('#modal .modal__b');
  if (b) b.classList.add('modal__b--wide');
  var focus = $('.wiz__bd .inp, .wiz__bd .sel');
  if (focus && PNEW.view !== 'wizard') setTimeout(function () { focus.focus(); }, 30);
  /* 「部分选中」那个态写不进 HTML，重画后补一次（v48） */
  pnewSidAllSync();
}

function pnewBody() {
  if (PNEW.view === 'sid') return pnewSidEditor();
  if (PNEW.view === 'group') return pnewGroupEditor();
  if (PNEW.view === 'plan') return pnewPlanEditor();
  if (PNEW.step === 0) return pnewStep1();
  if (PNEW.step === 1) return pnewStep2();
  if (PNEW.step === 2) return pnewStep3();
  if (PNEW.step === 3) return pnewStep4();
  if (PNEW.step === 4) return pnewStep5();
  return pnewStep6();
}

/* 底栏按「当前是第几步」给按钮。v47 起是 6 步（v39 的 4 步 → 补上
   「流程模版 / 参数配置」两步），底栏规则没变：
   中间各步一律「取消 + 上一步 + 下一步」，最后一步只出现「完成」。 */
function pnewFoot() {
  var cancel = '<button type="button" class="btn" data-pn="cancel">取消</button>';
  var back = '<button type="button" class="btn" data-pn="back">' + ico('arrow-left') + '上一步</button>';
  var next = '<button type="button" class="btn btn--primary" data-pn="next">下一步' + ico('arrow-right') + '</button>';
  /* 子编辑器的「返回」：撤掉这一条草稿、退回向导本体。
     v48 改：三个子编辑器原先都写「取消」，但做的事其实是「返回」——
     词与事不符，用户会以为点了就把整个新建项目取消掉（新增样本ID 那个更糟：
     它挂的是全局 `cancel`，点下去真的会把整个弹窗关掉）。
     规则统一成 **子编辑器 = 返回；向导本体 = 取消**。 */
  var retBtn = function (act) {
    return '<button type="button" class="btn" data-pn="' + act + '">' + ico('arrow-left') + '返回</button>';
  };
  if (PNEW.view === 'sid') {
    return retBtn('sid-cancel')
      + '<button type="button" class="btn btn--primary" data-pn="sid-ok">确定</button>';
  }
  if (PNEW.view === 'group') {
    return retBtn('g-cancel')
      + '<button type="button" class="btn btn--primary" data-pn="g-ok">'
      + (PNEW.g && PNEW.g.edit ? '保存' : '创建') + '</button>';
  }
  if (PNEW.view === 'plan') {
    return retBtn('p-cancel')
      + '<button type="button" class="btn btn--primary" data-pn="p-ok">'
      + (PNEW.pl && PNEW.pl.edit ? '保存' : '创建') + '</button>';
  }
  /* 最后一步只给一颗「完成」，连「取消」都不给：创建在进入这一屏时已经发生，
     这一屏是回执、不是再确认一次 —— 摆一颗「取消」会让用户以为项目还没建，
     点了也只是关窗，等于一个承诺了不存在的「撤销」。 */
  if (PNEW.step === PNEW_STEPS.length - 1) {
    return '<button type="button" class="btn btn--primary" data-pn="done">' + ico('circle-check') + '完成</button>';
  }
  return cancel + (PNEW.step === 0 ? '' : back) + next;
}

/* ---------- 步骤 1 · 填写基本信息 ---------- */
function pnewStep1() {
  var d = PNEW.d, pool = pnewSampPool();
  /* 全选控件的三态（all / none / part）。「部分选中」写不进 HTML（indeterminate
     只能由脚本设），所以模板只负责勾选态，画完再补一次 —— 见 pnewSidAllSync()。 */
  var allOn = pnewSidAllState();
  var rows = pool.map(function (id) {
    var on = d.sids.indexOf(id) >= 0;
    return '<label class="pnpick__row' + (on ? ' is-on' : '') + '">'
      + '<input type="checkbox" data-pn="sid-tog" data-id="' + id + '"' + (on ? ' checked' : '') + '>'
      + '<span class="pnpick__id">' + id + '</span>'
      + '<span class="pnpick__meta">' + esc(pnewSampLabel(id).slice(id.length + 3)) + '</span>'
      + '</label>';
  }).join('');
  /* 手工新增的样本不在档案池里，必须单独补一行，否则「新增」完看不到结果。
     v48：extra 改从 d.manual 取（不再取 d.sids 的差集），且勾选态一律由
     d.sids 决定 —— 两条改动是配套的：只看差集的话，用户取消勾选那一瞬间
     这个 ID 就从 d.sids 里没了，行也跟着消失，等于把他刚录的东西抹掉。 */
  var extra = d.manual.filter(function (id) { return pool.indexOf(id) < 0; });
  var extraRows = extra.map(function (id) {
    var on = d.sids.indexOf(id) >= 0;
    var s = SAMP_ARCHIVE[id];
    return '<label class="pnpick__row' + (on ? ' is-on' : '') + '">'
      + '<input type="checkbox" data-pn="sid-tog" data-id="' + esc(id) + '"' + (on ? ' checked' : '') + '>'
      + '<span class="pnpick__id">' + esc(id) + '</span>'
      /* 档案里有这号样本（只是不在池子的前 20 例里）就照池子那行显示，
         别一律写「手工新增」—— 那会与样本档案里的记录自相矛盾。 */
      + '<span class="pnpick__meta">'
      + (s ? esc(pnewSampLabel(id).slice(id.length + 3)) : '档案外样本') + '</span></label>';
  }).join('');
  return '<div class="stack">'
    + '<div class="fld"><label class="fld__l" for="pnName">项目名称：' + reqMark() + '</label>'
    + '<input class="inp" id="pnName" autocomplete="off" aria-required="true" placeholder="请输入项目名称" value="' + esc(d.name) + '"></div>'
    + '<div class="fld"><label class="fld__l" for="pnDesc">项目描述：' + reqMark() + '</label>'
    + '<input class="inp" id="pnDesc" autocomplete="off" aria-required="true" placeholder="请输入项目描述" value="' + esc(d.desc) + '"></div>'
    + '<div class="fld"><label class="fld__l" for="pnGrp">所属项目组：' + reqMark() + '</label>'
    + '<select class="sel" id="pnGrp" aria-required="true"><option value="">请选择项目组</option>'
    /* v47：选项来自系统管理 › 项目组管理里「已通过 + 启用」的那些（pgPickNames()），
       不再是一张写死的名字数组。名单空了要**说清楚去哪加**，不能只留一个空下拉。 */
    + pgPickNames().map(function (g) {
      return '<option' + (g === d.grp ? ' selected' : '') + '>' + esc(g) + '</option>';
    }).join('') + '</select>'
    + (pgPickNames().length ? ''
        : '<span class="fld__h">当前没有可选的项目组 —— 到「系统管理 › 项目组管理」创建，'
          + '或把已有的组启用（只有 已通过 + 启用 的组会出现在这里）</span>')
    + '</div>'
    + '<div class="fld" role="group" aria-required="true"><div class="fld__l"><span>样本ID：' + reqMark() + '</span>'
    + '<span class="fld__h ml-auto">支持多选，也可新增</span></div>'
    + '<div class="pnpick"><div class="pnpick__hd">'
    + '<span>已选 <b>' + d.sids.length + '</b> 例</span>'
    /* v48 需求 1：一键全选。刻意放在**表头**而不是列表首行 ——
       `.pnpick__bd` 限高 148px 可滚动，放首行会随滚动移出视野，
       用户滚到下半截想全选时反而够不着它。 */
    + '<label class="pnpick__all" title="全选样本ID（' + pool.length + ' 例）">'
    + '<input type="checkbox" id="pnSidAll" data-pn="sid-all"'
    + (allOn === 'all' ? ' checked' : '') + '><span>全选</span></label>'
    + '<button type="button" class="btn btn--sm btn--quiet ml-auto" data-pn="sid-new">'
    + ico('file-circle-plus') + '新增</button></div>'
    + '<div class="pnpick__bd">' + extraRows + rows + '</div></div>'
    + '<p class="fld__h">勾选单例，或点表头「全选」一次选满；档案外的样本可用「新增」录入</p></div>'
    + '<div class="fld"><label class="fld__l" for="pnSampDesc">样本描述信息：' + reqMark() + '</label>'
    + '<input class="inp" id="pnSampDesc" autocomplete="off" aria-required="true" placeholder="请输入内容" value="' + esc(d.sampDesc) + '"></div>'
    + '<div class="frmrow">'
    + '<div class="fld"><label class="fld__l" for="pnRef">参考基因组：' + reqMark() + '</label>'
    + '<select class="sel" id="pnRef" aria-required="true"><option value="">请选择</option>'
    + REF_GENOMES.map(function (r) {
      return '<option' + (r.id === d.ref ? ' selected' : '') + '>' + r.alias + '</option>';
    }).join('') + '</select></div>'
    + '<div class="fld"><label class="fld__l" for="pnCond">实验条件：</label>'
    + '<input class="inp" id="pnCond" autocomplete="off" placeholder="请输入实验条件描述" value="' + esc(d.cond) + '"></div>'
    + '</div>'
    + frmLegend()
    + '</div>';
}

/* ---------- 步骤 2 · 选择数据文件 ---------- */
/* 文件树按 FM_DATA 现算分组，不另写一份目录数据：
   文件管理页与建项目向导指向同一批文件，抄一份必然分叉。
   v50：向导第 2 步与**数据汇集页**也开始共用它了（见下面的 fmTreeRows），
   所以名字里的 pnew- 去掉了 —— 它已经不是向导专属的东西。 */
function fmTreeGroups(scope) {
  var D = FM_DATA[scope] || {}, out = [], map = {};
  var push = function (label, lv) {
    if (!map[label]) { map[label] = { label: label, lv: lv, files: [] }; out.push(map[label]); }
    return map[label];
  };
  var head = (D.dirs || []).slice();
  (Object.keys(D.sub || {})).forEach(function (k) { head.push(k); });
  head.forEach(function (h) {
    (D.sub && D.sub[h] || []).forEach(function (s) { push(h + '/' + s, 1); });
    if (!Object.keys(map).some(function (k) { return k === h; })) push(h, 0);
  });
  (D.files || []).forEach(function (f) {
    var dir = f.dir || '';
    if (!dir) { push('（未归档）', 0).files.push(f); return; }
    var seg = dir.split('/');
    if (seg.length > 1) push(seg[0] + '/' + seg[1], 1).files.push(f);
    else push(seg[0], 0).files.push(f);
  });
  /* 只留下真有文件的分组，空目录在向导里没有可勾的东西 */
  return out.filter(function (g) { return g.files.length || g.lv === 1; });
}

/* 文件树本体。**唯一一处**生成 .pntree__f 的地方 ——
   向导第 2 步（key='pn'）与数据汇集页（key='p02'）都走这里，
   差别只有「动作挂给哪个委托」和 on() 怎么判「这一份选没选中」。

   为什么要分成 key：两处的事件委托范围不同（一个在弹窗 #modalB、一个在页面里），
   同一套属性名两边都会接住，改起来容易串味；分开之后各自一眼能看出归属。
   on(f, label) 由调用方给 —— 「选中」这件事在两处的真相在不同对象里，
   这里不替它们判断。 */
function fmTreeRows(scope, q, key, on) {
  q = (q || '').trim();
  var groups = fmTreeGroups(scope);
  var hit = function (f) { return !q || f.n.indexOf(q) >= 0; };
  var attr = ' data-' + key;
  var body = groups.map(function (g) {
    var fs = g.files.filter(hit);
    if (!fs.length) return '';
    return '<div class="pntree__dir"><span class="pntree__dn">' + ico(g.lv ? 'folder-open' : 'folder-tree')
      + esc(g.label.split('/').pop()) + '</span><span class="pntree__cnt">' + fs.length + '</span></div>'
      + '<div class="pntree__files' + (g.lv ? ' pntree__files--sub' : '') + '">'
      + fs.map(function (f) {
        var isOn = on(f, g.label);
        return '<label class="pntree__f' + (isOn ? ' is-on' : '') + '">'
          + '<input type="checkbox"' + attr + '="file-tog" data-n="' + esc(f.n) + '" data-path="' + esc(g.label) + '"'
          + (isOn ? ' checked' : '') + '>'
          + '<span class="pntree__n">' + esc(f.n) + '</span>'
          + '<span class="pntree__sz">' + esc(f.sz || '') + '</span></label>';
      }).join('')
      + '</div>';
  }).join('');
  return body;
}

function pnewFileRows() {
  var d = PNEW.d, q = (PNEW.fq || '').trim();
  var body = fmTreeRows(d.scope, q, 'pn', function (f, label) {
    return d.files.some(function (x) { return x.scope === d.scope && x.path === label && x.n === f.n; });
  });
  return body || '<p class="fld__h">该范围下没有匹配「' + esc(q) + '」的文件</p>';
}

/* ============================================================
   数据汇集 · 选数据（v50 需求 2）
   ------------------------------------------------------------
   原来是「上传组学数据」拖拽区。它默认了「数据还在用户本机」这一种来路，
   可系统里本来就有数据资产（文件管理那三档）—— 先导进来再分析是更常见的
   走法，而拖拽区把这条路的用户挡在门外：他得先跳到文件管理传一遍、再回来。

   换成「选择文件」之后两件事同时在位：
     左 = 已选择的文件（可逐条移除 / 一键清空）
     右 = 按可见范围浏览 + 按名称筛选，与文件管理、向导第 2 步读**同一份**
          FM_DATA（三处一个来源，不各写一份目录）

   本机文件没有撤：卡片底部那颗「选择本机文件」打开的仍是同一个 #realFile，
   格式异常那条链（真选一个 .xlsx → 引导修复）依赖它，动它会把那条链打断。
   拖拽只是不再是唯一的入场姿势，而不是被删掉。 */
var P02_PICK = { scope: 'mine', q: '', files: [] };

/* 文件名 → 识别出的格式。只服务「已识别的文件」那几行说明文字，
   不参与任何校验判断 —— 真校验由 #realFile 那条链负责。 */
function p02Fmt(n) {
  var seg = String(n).split('.');
  var e = (seg[seg.length - 1] || '').toLowerCase();
  var MAP = {
    vcf: 'VCF 4.3', bcf: 'BCF 2.2', fastq: 'FASTQ', fq: 'FASTQ', bam: 'BAM',
    tsv: 'TSV（表达矩阵）', csv: 'CSV', h5ad: 'H5AD（单细胞）', fa: 'FASTA',
    gtf: 'GTF 注释', xlsx: 'XLSX', pdf: 'PDF'
  };
  if (e === 'gz') {
    var inner = (seg[seg.length - 2] || '').toLowerCase();
    return (MAP[inner] || '压缩文件') + '（.gz）';
  }
  return MAP[e] || e.toUpperCase();
}

function p02FileRows() {
  var q = (P02_PICK.q || '').trim();
  var body = fmTreeRows(P02_PICK.scope, q, 'p02', function (f, label) {
    return P02_PICK.files.some(function (x) {
      return x.scope === P02_PICK.scope && x.path === label && x.n === f.n;
    });
  });
  return body || '<p class="fld__h">该范围下没有匹配「' + esc(q) + '」的文件</p>';
}

/* 左栏清单与页头计数各自重画 —— 勾选时只动这两处，不整块重画：
   整块重画会把 .pntree 的滚动位置清零，勾到第 8 个文件时列表跳回顶部，
   而那正是最需要它别动的时候。 */
function renderP02Picked() {
  var box = $('#p02Pick .pnsel'); if (!box) return;
  box.innerHTML = P02_PICK.files.map(function (f, i) {
    var sc = { mine: '个人文件', team: '团队文件', sys: '系统文件' }[f.scope];
    return '<div class="pnsel__row"><div class="min-w-0">'
      + '<div class="pnsel__n">' + esc(f.n) + '</div>'
      + '<div class="pnsel__p">' + sc + '/' + esc(f.path) + '</div></div>'
      + '<button type="button" class="iconbtn ml-auto" data-p02="file-del" data-i="' + i + '"'
      + ' aria-label="移除 ' + esc(f.n) + '">' + ico('xmark') + '</button></div>';
  }).join('') || '<div class="pnsel__empty">' + ico('inbox') + '<span>请选择数据文件</span></div>';
}

function renderP02Meta() {
  var m = $('#p02PickMeta');
  if (!m) return;
  var n = P02_PICK.files.length;
  m.textContent = n ? '已选 ' + n + ' 个文件 · 三档可见范围共用同一份数据资产' : '尚未选择';
}

/* 「已识别的文件」卡跟着选择走：选了什么，就识别出什么。
   没有这一层，「选择文件」就只是一次勾选动作，用户看不到系统对它的判断。 */
function renderP02SyncFiles() {
  var host = $('#fileCard');
  if (!host) return;
  if (!P02_PICK.files.length) { host.hidden = true; var L0 = $('#fileList'); if (L0) L0.innerHTML = ''; return; }
  host.hidden = false;
  var L = $('#fileList');
  if (L) {
    var sc = { mine: '个人文件', team: '团队文件', sys: '系统文件' }[P02_PICK.scope];
    L.innerHTML = P02_PICK.files.map(function (f) {
      return fileCardHTML({ name: f.n, detected_format: p02Fmt(f.n), size: f.sz, src: '数据资产 · ' + sc });
    }).join('');
  }
  var tag = $('#fileTag');
  if (tag) { tag.className = 'tag tag--ok'; tag.textContent = '校验通过'; }
}

function renderP02Pick() {
  var box = $('#p02Pick'); if (!box) return;
  var old = $('#p02Pick .pntree'), keep = old ? old.scrollTop : 0;
  var tabs = [['mine', '个人文件'], ['team', '团队文件'], ['sys', '系统文件']];
  box.innerHTML = '<div class="pn2col">'
    + '<section class="pn2col__l"><header class="pn2col__hd">'
    + '<span class="fld__l">' + reqMark() + '已选择的文件</span>'
    + '<button type="button" class="iconbtn ml-auto" data-p02="file-clear"'
    + ' aria-label="清空已选择的文件">' + ico('trash-can') + '</button></header>'
    + '<div class="pnsel"></div>'
    + '</section>'
    + '<section class="pn2col__r"><header class="pn2col__hd pn2col__hd--tabs">'
    + tabs.map(function (t) {
        return '<button type="button" class="pntab' + (P02_PICK.scope === t[0] ? ' is-on' : '') + '"'
          + ' data-p02="scope" data-scope="' + t[0] + '" aria-selected="' + (P02_PICK.scope === t[0]) + '">'
          + t[1] + '</button>';
      }).join('') + '</header>'
    + '<div class="pn2col__srch"><input class="inp" id="p02FileQ" autocomplete="off"'
    + ' placeholder="文件名称" value="' + esc(P02_PICK.q) + '" aria-label="按文件名称筛选"></div>'
    + '<div class="pntree">' + p02FileRows() + '</div>'
    + '</section></div>';
  renderP02Picked();
  renderP02Meta();
  var tr = $('#p02Pick .pntree'); if (tr) tr.scrollTop = keep;
}

/* 勾选某一行的**局部**更新：翻这一行的态、重画左侧清单、更新计数。
   左侧「已选择的文件」和「已识别的文件」卡是同一件事的两处呈现，
   一起更新才不会出现「左边说选了 3 个、识别卡还是 2 个」。 */
function p02Tog(t) {
  var n = t.getAttribute('data-n'), path = t.getAttribute('data-path');
  var j = -1;
  P02_PICK.files.forEach(function (f, ix) {
    if (f.scope === P02_PICK.scope && f.path === path && f.n === n) j = ix;
  });
  var on = j < 0;
  if (on) P02_PICK.files.push({ scope: P02_PICK.scope, path: path, n: n });
  else P02_PICK.files.splice(j, 1);
  var lab = t.closest('.pntree__f');
  if (lab) lab.classList.toggle('is-on', on);
  t.checked = on;
  renderP02Picked(); renderP02Meta(); renderP02SyncFiles();
}

function p02Act(a, t) {
  if (a === 'scope') {
    P02_PICK.scope = t.getAttribute('data-scope');
    renderP02Pick(); return;
  }
  if (a === 'file-tog') { p02Tog(t); return; }
  if (a === 'file-del') {
    P02_PICK.files.splice(parseInt(t.getAttribute('data-i'), 10), 1);
    renderP02Pick(); renderP02SyncFiles(); return;
  }
  if (a === 'file-clear') {
    if (!P02_PICK.files.length) return;
    P02_PICK.files = [];
    renderP02Pick(); renderP02SyncFiles(); return;
  }
  /* 本机文件走的是同一条老路（#realFile → change → onRealFile）：
     它是格式异常那条链的入口，不能因为换了选数据的方式就把它删掉。 */
  if (a === 'pick-local') { var rf = $('#realFile'); if (rf) rf.click(); return; }
}
function pnewStep2() {
  var d = PNEW.d;
  var tabs = [['mine', '个人文件'], ['team', '团队文件'], ['sys', '系统文件']];
  var picked = d.files.map(function (f, i) {
    var sc = { mine: '个人文件', team: '团队文件', sys: '系统文件' }[f.scope];
    return '<div class="pnsel__row"><div class="min-w-0"><div class="pnsel__n">' + esc(f.n) + '</div>'
      + '<div class="pnsel__p">' + sc + '/' + esc(f.path) + '</div></div>'
      + '<button type="button" class="iconbtn ml-auto" data-pn="file-del" data-i="' + i + '"'
      + ' aria-label="移除 ' + esc(f.n) + '">' + ico('xmark') + '</button></div>';
  }).join('');
  return '<div class="pn2col">'
    + '<section class="pn2col__l"><header class="pn2col__hd">'
    + '<span class="fld__l">' + reqMark() + '已选择的文件</span>'
    + '<button type="button" class="iconbtn ml-auto" data-pn="file-clear" aria-label="清空已选择的文件">'
    + ico('trash-can') + '</button></header>'
    + '<div class="pnsel">' + (picked
      || '<div class="pnsel__empty">' + ico('inbox') + '<span>请选择数据文件</span></div>') + '</div>'
    + '</section>'
    + '<section class="pn2col__r"><header class="pn2col__hd pn2col__hd--tabs">'
    + tabs.map(function (t) {
      return '<button type="button" class="pntab' + (d.scope === t[0] ? ' is-on' : '') + '"'
        + ' data-pn="scope" data-scope="' + t[0] + '" aria-selected="' + (d.scope === t[0]) + '">'
        + t[1] + '</button>';
    }).join('') + '</header>'
    + '<div class="pn2col__srch"><input class="inp" id="pnFileQ" autocomplete="off"'
    + ' placeholder="文件名称" value="' + esc(PNEW.fq || '') + '" aria-label="按文件名称筛选"></div>'
    + '<div class="pntree">' + pnewFileRows() + '</div>'
    + '</section>'
    + '</div>';
}

/* ---------- 步骤 3 · 分组与比较方案（v39 需求 2：两步合一） ---------- */
/* 为什么是「上下两块」而不是左右两栏：板比较组的两个下拉**来自刚建好的
   分组方案**，先后顺序是真的（先有组，才能定义谁比谁），所以是两块有次序的
   内容，不是并列的两个东西。左右分栏会让人以为可以先填比较方案。 */
function pnewStep3() {
  return '<div class="stack">'
    + '<section><div class="pd__sec">' + ico('layer-group') + '① 分组方案：把样本分成可比的两组及以上</div>'
    + pnewSchemeBlock() + '</section>'
    + '<section><div class="pd__sec">' + ico('code-compare') + '② 比较方案：指定谁和谁比（选项来自上面那套分组）</div>'
    + pnewPlanBlock() + '</section>'
    + '</div>';
}

function pnewSchemeBlock() {
  var d = PNEW.d;
  var list = d.schemes.map(function (s, i) {
    return '<button type="button" class="pnitem' + (d.scheme === i ? ' is-on' : '') + '"'
      + ' data-pn="scheme-sel" data-i="' + i + '">'
      + '<span class="pnitem__n">' + esc(s.n) + '</span>'
      + '<span class="pnitem__m">' + s.groups.length + ' 组 · ' + s.groups.reduce(function (a, g) { return a + g.sids.length; }, 0) + ' 例</span>'
      + (s.def ? '<span class="tag tag--brand">默认</span>' : '') + '</button>';
  }).join('');
  var s = d.scheme == null ? null : d.schemes[d.scheme];
  var detail = s
    /* data-pninfo 是给第 3 步「一屏两块」用的：两块详情同形同类名，
       没有它，脚本（和人眼）只能靠「第几个」区分，一改顺序就认错块。 */
    ? '<div class="pninfo" data-pninfo="scheme"><div class="pninfo__hd">' + ico('circle-info') + '分组方案详情</div>'
      + '<div class="pninfo__r"><span>分组方案名称</span><b>' + esc(s.n) + '</b></div>'
      + s.groups.map(function (g) {
        return '<div class="pninfo__r"><span>' + esc(g.n) + '</span><b>' + g.sids.length + ' 例样本</b></div>';
      }).join('')
      + '<div class="pninfo__r"><span>设为默认方案</span><b>' + (s.def ? '是' : '否') + '</b></div></div>'
      + '<button type="button" class="btn btn--sm mt-2" data-pn="g-edit">' + ico('pen-to-square') + '修改分组方案</button>'
    : '<div class="pnempty">' + ico('inbox') + '<span>请新建或选择一个分组方案</span></div>';
  return '<div class="pn2col">'
    + '<section class="pn2col__l"><header class="pn2col__hd">'
    + '<span class="fld__l">分组方案列表</span>'
    + '<button type="button" class="iconbtn ml-auto" data-pn="g-new" aria-label="新建分组方案">'
    + ico('plus') + '</button></header>'
    + '<div class="pnlist">' + (list
      || '<p class="fld__h pnpad">还没有分组方案，点右上角 ＋ 新建</p>') + '</div>'
    + '</section>'
    + '<section class="pn2col__r">' + detail + '</section>'
    + '</div>';
}

/* 样本池渲染抽成独立函数：搜索框每敲一个字只重画这一块（整块重画会连输入框
   一起换掉，焦点与光标一起丢）。抽出来之后「新建分组方案」与这个局部刷新
   走的是同一份渲染逻辑，不会出现「搜出来的和列出来的不一致」。 */
function pnewSampPoolHTML() {
  var g = PNEW && PNEW.g, d = PNEW && PNEW.d;
  if (!g || !d) return '';
  var q = (g.q || '').trim();
  var avail = d.sids.filter(function (id) {
    return !g.groups.some(function (gr) { return gr.sids.indexOf(id) >= 0; });
  }).filter(function (id) { return !q || id.indexOf(q) >= 0; });
  var pool = avail.map(function (id) {
    var on = g.picked.indexOf(id) >= 0;
    return '<label class="pnpool__i' + (on ? ' is-on' : '') + '">'
      + '<input type="checkbox" data-pn="g-pick" data-id="' + id + '"' + (on ? ' checked' : '') + '>'
      + '<span class="pnpool__n"><b>' + id + '</b><span>' + esc((SAMP_ARCHIVE[id] || {}).dx || '') + '</span></span></label>';
  }).join('');
  return pool || '<p class="fld__h pnpad">样本池已空</p>';
}

/* 子编辑器：新建 / 修改分组方案 */
function pnewGroupEditor() {
  var g = PNEW.g, d = PNEW.d;
  var groups = g.groups.map(function (gr, i) {
    var on = g.checked.indexOf(i) >= 0;
    return '<div class="pnpool__i' + (g.sel === i ? ' is-sel' : '') + (on ? ' is-on' : '') + '">'
      + '<label class="pnpool__c"><input type="checkbox" data-pn="g-check" data-i="' + i + '"'
      + (on ? ' checked' : '') + ' aria-label="选择分组 ' + esc(gr.n) + '"></label>'
      + '<button type="button" class="pnpool__n" data-pn="g-target" data-i="' + i + '">'
      + '<b>' + esc(gr.n) + '</b><span>' + gr.sids.length + ' 例</span></button>'
      + '<span class="pnpool__s">' + gr.sids.slice(0, 4).map(function (x) { return esc(x); }).join(' ')
      + (gr.sids.length > 4 ? ' …' : '') + '</span></div>';
  }).join('');
  return '<div class="stack">'
    + '<div class="fld"><label class="fld__l" for="pnGName">分组方案名称：' + reqMark() + '</label>'
    + '<input class="inp" id="pnGName" autocomplete="off" aria-required="true" placeholder="请输入" value="' + esc(g.n) + '"></div>'
    + '<div class="pn2col pn2col--pool">'
    + '<section class="pn2col__l"><header class="pn2col__hd">'
    + '<span class="fld__l">分组池</span>'
    + '<button type="button" class="iconbtn ml-auto" data-pn="g-add" aria-label="新增分组">' + ico('plus') + '</button>'
    + '<button type="button" class="iconbtn" data-pn="g-clear" aria-label="清空分组">' + ico('trash-can') + '</button>'
    + '</header>'
    + '<div class="pnpool">'
    + '<label class="pnpool__all"><input type="checkbox" data-pn="g-all"'
    + (g.checked.length && g.checked.length === g.groups.length ? ' checked' : '') + '><span>全选</span></label>'
    + (g.adding
      ? '<div class="pnpool__new"><input class="inp" id="pnGNew" autocomplete="off" placeholder="分组名（字母开头，1–8 位）"'
        + ' value="' + esc(g.draft || '') + '">'
        + '<button type="button" class="btn btn--sm btn--primary" data-pn="g-add-ok">保存</button>'
        + '<button type="button" class="btn btn--sm" data-pn="g-add-cancel">取消</button></div>'
      : '')
    + (groups || '<p class="fld__h pnpad">还没有分组，点 ＋ 新增</p>')
    + '</div></section>'
    + '<div class="pntrans"><button type="button" class="iconbtn" data-pn="g-move"'
    + ' aria-label="把勾选的样本分配到选中的分组">' + ico('arrow-left') + '</button></div>'
    + '<section class="pn2col__r"><header class="pn2col__hd"><span class="fld__l">样本池</span></header>'
    + '<div class="pn2col__srch"><input class="inp" id="pnGSampQ" autocomplete="off" placeholder="样本ID"'
    + ' value="' + esc(g.q || '') + '" aria-label="按样本ID筛选"></div>'
    + '<div class="pnpool" id="pnSampPool">' + pnewSampPoolHTML() + '</div>'
    + '</section></div>'
    + '<label class="pnchk"><input type="checkbox" data-pn="g-def"' + (g.def ? ' checked' : '') + '>设为默认方案</label>'
    + '<p class="fld__h">规则：分组名必须以字母开头，1–8 位，只能字母 / 数字 / 下划线；每个分组至少分配 2 例样本。</p>'
    + '</div>';
}

function pnewPlanBlock() {
  var d = PNEW.d;
  var list = d.plans.map(function (p, i) {
    return '<button type="button" class="pnitem' + (d.plan === i ? ' is-on' : '') + '"'
      + ' data-pn="plan-sel" data-i="' + i + '">'
      + '<span class="pnitem__n">' + esc(p.n) + '</span>'
      + '<span class="pnitem__m">' + p.pairs.length + ' 个比较组</span>'
      + (p.def ? '<span class="tag tag--brand">默认</span>' : '') + '</button>';
  }).join('');
  var p = d.plan == null ? null : d.plans[d.plan];
  var detail = p
    ? '<div class="pninfo" data-pninfo="plan"><div class="pninfo__hd">' + ico('circle-info') + '比较方案详情</div>'
      + '<div class="pninfo__r"><span>比较方案名称</span><b>' + esc(p.n) + '</b></div>'
      + p.pairs.map(function (x) {
        return '<div class="pninfo__r"><span>对照组 → 处理组</span><b>' + esc(x.a) + ' → ' + esc(x.b) + '</b></div>';
      }).join('')
      + '<div class="pninfo__r"><span>设为默认方案</span><b>' + (p.def ? '是' : '否') + '</b></div></div>'
      + '<button type="button" class="btn btn--sm mt-2" data-pn="p-edit">' + ico('pen-to-square') + '修改比较方案</button>'
    : '<div class="pnempty">' + ico('inbox') + '<span>请新建或选择一个比较方案</span></div>';
  return '<div class="pn2col">'
    + '<section class="pn2col__l"><header class="pn2col__hd">'
    + '<span class="fld__l">比较方案列表</span>'
    + '<button type="button" class="iconbtn ml-auto" data-pn="p-new" aria-label="新建比较方案">' + ico('plus') + '</button>'
    + '</header>'
    + '<div class="pnlist">' + (list || '<p class="fld__h pnpad">还没有比较方案，点右上角 ＋ 新建</p>') + '</div>'
    + '</section>'
    + '<section class="pn2col__r">' + detail + '</section>'
    + '</div>';
}
function pnewPlanEditor() {
  var p = PNEW.pl, d = PNEW.d;
  var s = d.scheme == null ? null : d.schemes[d.scheme];
  var opts = s ? s.groups.map(function (g) { return g.n; }) : [];
  var sel = function (k, v, ph) {
    return '<select class="sel" data-pn="p-pair" data-k="' + k + '"><option value="">' + ph + '</option>'
      + opts.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('')
      + '</select>';
  };
  var pairs = p.pairs.map(function (x, i) {
    return '<div class="pnpair"><span class="pnpair__i">比较组 ' + (i + 1) + '</span>'
      + sel('a' + i, x.a, '请选择对照组') + '<span class="pnpair__ar">' + ico('arrow-right') + '</span>'
      + sel('b' + i, x.b, '请选择处理组')
      + '<button type="button" class="iconbtn" data-pn="p-del" data-i="' + i + '" aria-label="删除比较组">'
      + ico('trash-can') + '</button></div>';
  }).join('');
  return '<div class="stack">'
    + '<div class="fld"><label class="fld__l" for="pnPName">比较方案名称：' + reqMark() + '</label>'
    + '<input class="inp" id="pnPName" autocomplete="off" aria-required="true" placeholder="请输入比较方案名称" value="' + esc(p.n) + '"></div>'
    + '<div class="fld"><div class="fld__l"><span>比较组</span>'
    + '<button type="button" class="btn btn--sm btn--quiet ml-auto" data-pn="p-add">' + ico('plus') + '添加</button></div>'
    + '<div class="pnpairs">' + (pairs || '<div class="pnempty pnempty--sm">' + ico('inbox') + '<span>暂无比较组</span></div>') + '</div>'
    + '<p class="fld__h">对照组与处理组不能为空，且不允许出现重复的比较组。可选分组来自步骤 3 的分组方案'
    + (s ? '「' + esc(s.n) + '」' : '（尚未选择分组方案）') + '。</p></div>'
    + '<label class="pnchk"><input type="checkbox" data-pn="p-def"' + (p.def ? ' checked' : '') + '>设为默认方案</label>'
    + '</div>';
}

/* ---------- 步骤 4 · 流程模版（v47 需求 2） ---------- */
/* 与「流程模板」页（p04）的关系：那边是**编辑器**（左栏流程列表 + 右栏画布，
   可以改节点、自编排、另存新模板），这里是**选择器**（左列表 + 右明细，
   只读，选定即走）。不复用画布的理由很直接：向导里弹一块 940px 宽的
   DAG 画布，用户得先学会看画布才能往下走一步，而这一步要回答的只是
   「这个项目跑哪条流程」。节点的先后仍如实列出来（它就是分析的先后）。 */
function pnewFlowList() {
  var q = (PNEW.flowQ || '').trim().toLowerCase();
  var list = FLOWS.filter(function (f) {
    return !q || f.n.toLowerCase().indexOf(q) >= 0 || f.d.toLowerCase().indexOf(q) >= 0
      || f.nodes.join(' ').toLowerCase().indexOf(q) >= 0;
  });
  if (!list.length) return '<p class="fld__h pnpad">没有匹配「' + esc(PNEW.flowQ) + '」的流程模板</p>';
  return list.map(function (f) {
    var on = f.id === PNEW.d.flow;
    return '<button type="button" class="pnitem' + (on ? ' is-on' : '') + '"'
      + ' data-pn="flow-sel" data-id="' + esc(f.id) + '" aria-current="' + (on ? 'true' : 'false') + '">'
      + '<span class="pnitem__n">' + esc(f.n) + '</span>'
      + '<span class="pnitem__m">' + f.nodes.length + ' 节点 · ' + f.links.length + ' 连线</span>'
      + (f.id === DEFAULT_FLOW ? '<span class="tag tag--brand">系统推荐</span>' : '') + '</button>';
  }).join('');
}
function pnewStep4() {
  var f = PNEW.d.flow ? flowById(PNEW.d.flow) : null;
  var detail = f
    ? '<div class="pninfo" data-pninfo="flow"><div class="pninfo__hd">'
      + ico('diagram-project') + '流程明细</div>'
      + '<div class="pninfo__r"><span>流程名称</span><b>' + esc(f.n) + '</b></div>'
      + '<div class="pninfo__r"><span>节点 / 连线</span><b>' + f.nodes.length + ' / ' + f.links.length + '</b></div>'
      + '<div class="pninfo__r"><span>链路</span><b class="pnflow__s">' + esc(f.s) + '</b></div>'
      + '</div>'
      + '<div class="pnnodes">'
      + f.nodes.map(function (nm, i) {
          return '<span class="pnnodes__i"><b>' + (i + 1) + '</b>' + esc(nm) + '</span>';
        }).join('<span class="pnnodes__a">' + ico('chevron-right') + '</span>')
      + '</div>'
      /* 这里**不给**「去编辑这条流程」的跳转按钮：向导是模态的，跳页会把弹窗
         留在新页面上（z 高于正文），用户回来时看到的是一个空壳向导。
         改成一句指路的话 —— 想改流程本身，建完项目在「流程模板」页改更顺。 */
      + '<p class="fld__h mt-3 mb-0">这一步只做选择。要改流程本身的节点与连线，'
      + '到「智能分析 › 流程模板」页编辑；建完项目后也能随时回去改。</p>'
    : '<div class="pnempty">' + ico('inbox') + '<span>请从左侧选择一条流程模板</span></div>';
  return '<div class="pn2col">'
    + '<section class="pn2col__l"><header class="pn2col__hd">'
    + '<span class="fld__l">流程模板（' + FLOWS.length + '）</span></header>'
    + '<div class="pn2col__srch"><input class="inp" id="pnFlowQ" autocomplete="off"'
    + ' placeholder="搜索流程名称 / 节点 / 说明" value="' + esc(PNEW.flowQ || '') + '"'
    + ' aria-label="按名称或节点搜索流程"></div>'
    + '<div class="pnlist">' + pnewFlowList() + '</div>'
    + '</section>'
    + '<section class="pn2col__r">' + detail + '</section>'
    + '</div>';
}

/* ---------- 步骤 5 · 参数配置（v47 需求 2） ---------- */
/* 参考基因组**不在这里重复一遍** —— 第 1 步已经选过（它是实验设计的一部分，
   不是运行参数）。两处各有一个下拉，等于同一个事实有两个来源，
   改了一处另一处不动，回执上就会出现两个不一样的答案。
   这里只把第 1 步选的那个显式回显出来，并说清去哪里改。 */
function pnewParamSum() {
  var pr = PNEW.d.params;
  return '<div class="pninfo" id="pnParamSum" data-pninfo="param">'
    + '<div class="pninfo__hd">' + ico('sliders') + '参数确认摘要</div>'
    + '<div class="pninfo__r"><span>参考基因组</span><b>' + esc(PNEW.d.ref || '未选择')
    + '<span class="text-ink3 text-[11.5px]">（第 1 步选，去那一步改）</span></b></div>'
    + '<div class="pninfo__r"><span>比对 / 定量</span><b>' + esc(pr.aligner) + ' · ' + esc(pr.quant) + '</b></div>'
    + '<div class="pninfo__r"><span>差异分析</span><b>' + esc(pr.de) + '</b></div>'
    + '<div class="pninfo__r"><span>判定阈值</span><b>|log2FC| ≥ ' + esc(pr.lfc)
    + ' · padj &lt; ' + esc(pr.padj) + '（' + esc(pr.adj) + ' 校正）</b></div>'
    + '<div class="pninfo__r"><span>资源</span><b>' + esc(pr.threads) + ' 核 / '
    + esc(pr.mem) + ' GB</b></div>'
    + '<div class="pninfo__r"><span>附加处理</span><b>'
    + [pr.pair ? '配对设计' : '', pr.batch ? '批次校正' : '', pr.outlier ? '离群标记' : '']
        .filter(Boolean).join(' · ') || '无' + '</b></div>'
    + '</div>';
}
function pnewStep5() {
  var pr = PNEW.d.params;
  var sel = function (k, opts) {
    return '<select class="sel" id="pnP' + k + '" data-pnp="' + k + '">'
      + opts.map(function (o) { return '<option' + (o === pr[k] ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('')
      + '</select>';
  };
  return '<div class="pn2col pn2col--param" id="pnParamBox">'
    + '<section class="pn2col__l"><header class="pn2col__hd">'
    + '<span class="fld__l">运行参数</span>'
    + '<button type="button" class="btn btn--sm btn--quiet ml-auto" data-pn="param-reset">'
    + ico('rotate-left') + '恢复推荐值</button></header>'
    + '<div class="grid2">'
    + '<div class="fld"><label class="fld__l" for="pnPaligner">比对工具</label>' + sel('aligner', PNEW_PARAM_OPTS.aligner) + '</div>'
    + '<div class="fld"><label class="fld__l" for="pnPquant">定量方法</label>' + sel('quant', PNEW_PARAM_OPTS.quant) + '</div>'
    + '<div class="fld"><label class="fld__l" for="pnPde">差异分析算法</label>' + sel('de', PNEW_PARAM_OPTS.de) + '</div>'
    + '<div class="fld"><label class="fld__l" for="pnPpadj">padj 阈值</label>' + sel('padj', PNEW_PARAM_OPTS.padj) + '</div>'
    + '<div class="fld"><label class="fld__l" for="pnPadj">多重检验校正</label>' + sel('adj', PNEW_PARAM_OPTS.adj) + '</div>'
    + '<div class="fld"><label class="fld__l" for="pnPlfc">|log2FC| 阈值</label>'
    + '<input class="inp num" type="number" step="0.1" id="pnPlfc" data-pnp="lfc" value="' + esc(pr.lfc) + '">'
    + '<span class="fld__h">取值域 0.1 – 5.0</span></div>'
    + '<div class="fld"><label class="fld__l" for="pnPmincount">低表达过滤阈值</label>'
    + '<input class="inp num" type="number" id="pnPmincount" data-pnp="mincount" value="' + esc(pr.mincount) + '"></div>'
    + '<div class="fld"><label class="fld__l" for="pnPthreads">线程数</label>'
    + '<input class="inp num" type="number" id="pnPthreads" data-pnp="threads" value="' + esc(pr.threads) + '">'
    + '<span class="fld__h">1 – 64 核</span></div>'
    + '<div class="fld"><label class="fld__l" for="pnPmem">内存上限 (GB)</label>'
    + '<input class="inp num" type="number" id="pnPmem" data-pnp="mem" value="' + esc(pr.mem) + '">'
    + '<span class="fld__h">1 – 512 GB</span></div>'
    + '</div>'
    + '<div class="hr"></div>'
    + '<div class="stack">'
    + '<label class="chk"><input type="checkbox" data-pnp="pair"' + (pr.pair ? ' checked' : '') + '>启用配对设计（同一样本源的配对样本）</label>'
    + '<label class="chk"><input type="checkbox" data-pnp="batch"' + (pr.batch ? ' checked' : '') + '>纳入批次效应校正（需提供批次字段）</label>'
    + '<label class="chk"><input type="checkbox" data-pnp="outlier"' + (pr.outlier ? ' checked' : '') + '>自动标记离群样本（不自动剔除）</label>'
    + '</div>'
    + '</section>'
    + '<section class="pn2col__r">' + pnewParamSum() + '</section>'
    + '</div>';
}

/* ---------- 步骤 6 · 创建完成（回执） ---------- */
/* 这一屏是回执而不是确认页 —— 项目在进入这一步时就落库了（见 pnewCreate），
   所以「项目编号」读的是刚建出来的那一条，不是 nextProjId() 算出来的预览值。
   旧实现在这里显示的编号是预览，而文案已经写「已成功创建」，属于自相矛盾。 */
function pnewStep6() {
  var d = PNEW.d;
  var made = PNEW.made, id = made ? made.id : nextProjId();
  var groups = d.scheme == null ? [] : d.schemes[d.scheme].groups;
  var f = d.flow ? flowById(d.flow) : null;
  var pr = d.params;
  return '<div class="pninfo"><div class="pninfo__hd">' + ico('circle-check') + '项目创建完成</div>'
    + '<div class="pninfo__r"><span>项目编号</span><b>' + esc(id) + '</b></div>'
    + '<div class="pninfo__r"><span>项目名称</span><b>' + esc(d.name || '—') + '</b></div>'
    + '<div class="pninfo__r"><span>所属项目组</span><b>' + esc(d.grp || '—') + '</b></div>'
    + '<div class="pninfo__r"><span>样本</span><b>' + d.sids.length + ' 例</b></div>'
    + '<div class="pninfo__r"><span>数据文件</span><b>' + d.files.length + ' 个 · ' + esc(d.seq) + '</b></div>'
    + '<div class="pninfo__r"><span>分组方案</span><b>'
    + (d.scheme == null ? '—' : esc(d.schemes[d.scheme].n) + '（' + groups.length + ' 组）') + '</b></div>'
    + '<div class="pninfo__r"><span>比较方案</span><b>' + (d.plan == null ? '—' : esc(d.plans[d.plan].n)) + '</b></div>'
    /* v47：回执要把「这个项目要跑什么、怎么跑」一并交代 —— 它正是新加的那两步
       填的东西。少了这两行，回执就说不清「建完之后这个项目是什么状态」。 */
    + '<div class="pninfo__r"><span>流程模版</span><b>'
    + (f ? esc(f.n) + '（' + f.nodes.length + ' 个节点）' : '—') + '</b></div>'
    + '<div class="pninfo__r"><span>参数配置</span><b>'
    + esc(pr.aligner) + ' · padj &lt; ' + esc(pr.padj) + ' · |log2FC| ≥ ' + esc(pr.lfc)
    + ' · ' + esc(pr.threads) + ' 核 / ' + esc(pr.mem) + ' GB</b></div>'
    + '</div>'
    + '<p class="pnok">' + ico('circle-check') + '您的项目已成功创建，点「完成」返回项目列表查看</p>';
}

/* ---------- 校验 ---------- */
function pnewMiss(field) {
  toast('请先补全：' + field, 'warn');
  var el = $('.wiz__bd .inp, .wiz__bd .sel');
  if (el && el.focus) el.focus();
  return false;
}
function pnewCheckStep0() {
  var d = PNEW.d;
  if (!d.name) return pnewMiss('项目名称');
  if (!d.desc) return pnewMiss('项目描述');
  if (!d.grp) return pnewMiss('所属项目组');
  if (!d.sids.length) return pnewMiss('样本ID（至少 1 例）');
  if (!d.sampDesc) return pnewMiss('样本描述信息');
  if (!d.ref) return pnewMiss('参考基因组');
  return true;
}
function pnewCheckStep1() {
  if (!PNEW.d.files.length) return pnewMiss('数据文件（至少勾选 1 个）');
  return true;
}
/* 第 3 步（分组与比较方案）的守卫：两件事都要齐 ——
   合并成一步之后，这是全流程唯一同时校验两样的地方。
   先报分组再报比较，与屏上的 ① ② 顺序一致：提示的顺序和界面顺序不一致时，
   用户会以为系统指错了地方。 */
function pnewCheckStep2() {
  var d = PNEW.d;
  if (d.scheme == null) return pnewMiss('分组方案（点右上角 ＋ 新建）');
  if (d.plan == null) return pnewMiss('比较方案（点右上角 ＋ 新建）');
  return true;
}
/* 第 4 步（流程模版，v47）：没选流程就不许往下走。
   这一条不是形式主义 —— 项目记录的 rn / 流程面板 / 左栏「分析结果」模块清单
   全都由它派生，空着建出来的项目在详情页里是一组空面板。 */
function pnewCheckStep3() {
  if (!PNEW.d.flow) return pnewMiss('流程模版（至少选 1 条）');
  return true;
}
/* 第 5 步（参数配置，v47）：只校验**真有取值域**的三个数字，
   下拉类字段的选项都来自固定枚举，不可能非法。
   为什么在这里校验而不是让它随便填：这三个值会写进项目记录、
   在回执与参数快照里原样展示，越界值（0 核 / 9999 GB）让整页看起来像没校验。 */
function pnewCheckStep4() {
  var pr = PNEW.d.params;
  var num = function (v) { return v === '' || v == null || isNaN(Number(v)) ? null : Number(v); };
  var t = num(pr.threads);
  if (t === null || t < 1 || t > 64 || t !== Math.round(t)) return pnewMiss('线程数（1 – 64 的整数）');
  var m = num(pr.mem);
  if (m === null || m < 1 || m > 512 || m !== Math.round(m)) return pnewMiss('内存上限（1 – 512 GB 的整数）');
  var l = num(pr.lfc);
  if (l === null || l < 0.1 || l > 5) return pnewMiss('|log2FC| 阈值（0.1 – 5.0）');
  var c = num(pr.mincount);
  if (c === null || c < 0 || c !== Math.round(c)) return pnewMiss('低表达过滤阈值（不小于 0 的整数）');
  return true;
}

/* ---------- 分组方案编辑器内部规则 ---------- */
var PNG_NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,7}$/;
function pngNameErr(nm, groups, self) {
  if (!nm) return '分组名称不能为空';
  if (nm.length > 8) return '分组名称长度不能超过 8 个字符';
  if (!/^[A-Za-z]/.test(nm)) return '分组名称必须以字母开头';
  if (!/^[A-Za-z0-9_]+$/.test(nm)) return '分组名称只能包含字母、数字和下划线';
  if (/[_]$|[_-]$/.test(nm)) return '分组名称最后一个字符不能为下划线或中划线';
  if (groups.some(function (g, i) { return i !== self && g.n === nm; })) return '分组名称已存在，请使用其他名称';
  return '';
}

/* ---------- 向导动作分发 ---------- */
function pnewAction(t) {
  pnewHarvest();
  var a = t.getAttribute('data-pn'), d = PNEW.d, i;
  if (a === 'cancel' || a === 'g-cancel' || a === 'p-cancel' || a === 'sid-cancel') {
    /* 子编辑器里的「返回」只撤销这一条草稿、退回**向导本体**；
       只有向导自己的「取消」才关掉整个弹窗（放弃建这个项目）。
       v48 修根因：新增样本ID 子编辑器原先挂的是全局 `cancel` —— 于是
       「新增样本」里点取消会把整个新建项目窗口一起关掉，用户填了半天的
       项目名 / 文件 / 分组全没了。三个子编辑器现在行为一致。 */
    if (a !== 'cancel') {
      PNEW.view = 'wizard'; PNEW.g = PNEW.pl = PNEW.sd = null;
      renderProjNew(); return;
    }
    $('#modal').hidden = true; PNEW = null; return;
  }
  if (a === 'back') {
    /* 步骤 3 若挂着子编辑器，先退回步骤本体 —— 与参考系统的「上一步」同义 */
    PNEW.step = Math.max(0, PNEW.step - 1);
    renderProjNew(); return;
  }
  if (a === 'next') {
    if (PNEW.step === 0 && !pnewCheckStep0()) return;
    if (PNEW.step === 1 && !pnewCheckStep1()) return;
    if (PNEW.step === 2 && !pnewCheckStep2()) return;
    if (PNEW.step === 3 && !pnewCheckStep3()) return;
    if (PNEW.step === 4 && !pnewCheckStep4()) return;
    PNEW.step = Math.min(PNEW_STEPS.length - 1, PNEW.step + 1);
    /* 进入最后一步 = 落库。最后一步的文案是「您的项目已成功创建」，
       落库就必须真的发生在它之前（旧实现把它推到「完成」之后，
       于是回执上的编号还是预览值，文案与事实对不上）。 */
    if (PNEW.step === PNEW_STEPS.length - 1) pnewCreate();
    renderProjNew(); return;
  }
  /* 最后一步只负责关窗回列表 —— 项目已经在进这一步时建好了，
     这里再做一次「提交」会让「完成」变成第二遍副作用。 */
  if (a === 'done') { $('#modal').hidden = true; PNEW = null; return; }

  /* 步骤 1：样本ID 多选 / 新增样本 */
  if (a === 'sid-tog') {
    var sid = t.getAttribute('data-id');
    i = d.sids.indexOf(sid);
    if (i >= 0) d.sids.splice(i, 1); else d.sids.push(sid);
    renderProjNew(); return;
  }
  if (a === 'sid-new') {
    PNEW.sd = { pnSidId: '', pnSidName: '', pnSidType: '', pnSidSrc: '', pnSidDesc: '' };
    PNEW.view = 'sid'; renderProjNew(); return;
  }
  /* v48 需求 1：一键全选 / 取消全选。
     三种当前态下点它的含义（读状态现算，不读那颗 checkbox 自己的 checked ——
     浏览器在 click 之前已经把它翻过了，读它等于读反）：
       all  → 清空（「全选」再点一下自然是取消）
       part → 补全（部分选中时点它是「选满」，不是「清掉」）
       none → 选满 */
  if (a === 'sid-all') {
    var _pool = pnewSampPool();
    d.sids = pnewSidAllState() === 'all'
      ? []
      : _pool.concat(d.manual.filter(function (id) { return _pool.indexOf(id) < 0; }));
    renderProjNew(); return;
  }
  if (a === 'sid-ok') {
    var sd = PNEW.sd;
    var need = [['pnSidId', '样本ID'], ['pnSidName', '样本名称'], ['pnSidType', '样本类型'],
                ['pnSidSrc', '样本源名称'], ['pnSidDesc', '样本描述']];
    for (var k = 0; k < need.length; k++) {
      if (!sd[need[k][0]]) { toast('请先补全：' + need[k][1], 'warn'); return; }
    }
    var nid = sd.pnSidId;
    if (d.sids.indexOf(nid) < 0) d.sids.push(nid);
    /* 档案池之外的 ID 单独记一笔，行才留得住（v48，见 pnewInit 里 manual 的注释） */
    if (pnewSampPool().indexOf(nid) < 0 && d.manual.indexOf(nid) < 0) d.manual.push(nid);
    PNEW.view = 'wizard'; PNEW.sd = null;
    toast('已新增样本ID ' + nid, 'ok');
    renderProjNew(); return;
  }

  /* 步骤 2：文件勾选 / 范围切换 / 移除 */
  if (a === 'scope') { d.scope = t.getAttribute('data-scope'); renderProjNew(); return; }
  if (a === 'file-tog') {
    var n = t.getAttribute('data-n'), path = t.getAttribute('data-path');
    var j = -1;
    d.files.forEach(function (f, ix) { if (f.scope === d.scope && f.path === path && f.n === n) j = ix; });
    if (j >= 0) d.files.splice(j, 1);
    else d.files.push({ scope: d.scope, path: path, n: n });
    renderProjNew(); return;
  }
  if (a === 'file-del') { d.files.splice(parseInt(t.getAttribute('data-i'), 10), 1); renderProjNew(); return; }
  if (a === 'file-clear') { if (!d.files.length) return; d.files = []; renderProjNew(); return; }

  /* 步骤 3：方案选择 */
  if (a === 'scheme-sel') { d.scheme = parseInt(t.getAttribute('data-i'), 10); renderProjNew(); return; }
  /* 步骤 4（v47）：流程模版选择 */
  if (a === 'flow-sel') { d.flow = t.getAttribute('data-id'); renderProjNew(); return; }
  /* 步骤 5（v47）：参数恢复推荐值。重置的是**那一份默认对象**，
     不是把当前值抄一遍 —— 抄一遍等于「恢复推荐值」恢复的是我刚才填的值。 */
  if (a === 'param-reset') {
    d.params = pnewInit().d.params;
    renderProjNew();
    toast('参数已恢复为系统推荐值', 'ok');
    return;
  }
  if (a === 'g-new' || a === 'g-edit') {
    var edit = (a === 'g-edit');
    var src = edit ? d.schemes[d.scheme] : { n: '', groups: [], def: false };
    PNEW.g = {
      n: src.n, def: src.def, edit: edit, src: edit ? d.scheme : -1,
      groups: src.groups.map(function (g) { return { n: g.n, sids: g.sids.slice() }; }),
      checked: [], picked: [], sel: src.groups.length ? 0 : -1, adding: false, draft: '', q: ''
    };
    PNEW.view = 'group'; renderProjNew(); return;
  }
  var g = PNEW.g;
  if (g) {
    if (a === 'g-add') { g.adding = true; renderProjNew(); return; }
    if (a === 'g-add-cancel') { g.adding = false; g.draft = ''; renderProjNew(); return; }
    if (a === 'g-add-ok') {
      var nm = (g.draft || '').replace(/^\s+|\s+$/g, '');
      var err = pngNameErr(nm, g.groups, -1);
      if (err) { toast(err, 'warn'); return; }
      g.groups.push({ n: nm, sids: [] });
      g.adding = false; g.draft = ''; g.sel = g.groups.length - 1;
      renderProjNew(); return;
    }
    if (a === 'g-clear') {
      if (!g.groups.length) return;
      g.groups = []; g.checked = []; g.sel = -1; renderProjNew(); return;
    }
    if (a === 'g-check') {
      i = parseInt(t.getAttribute('data-i'), 10);
      var ci = g.checked.indexOf(i);
      if (ci >= 0) g.checked.splice(ci, 1); else g.checked.push(i);
      renderProjNew(); return;
    }
    if (a === 'g-all') {
      g.checked = g.checked.length === g.groups.length
        ? [] : g.groups.map(function (_, ix) { return ix; });
      renderProjNew(); return;
    }
    if (a === 'g-target') { g.sel = parseInt(t.getAttribute('data-i'), 10); renderProjNew(); return; }
    if (a === 'g-pick') {
      var pid = t.getAttribute('data-id');
      ci = g.picked.indexOf(pid);
      if (ci >= 0) g.picked.splice(ci, 1); else g.picked.push(pid);
      renderProjNew(); return;
    }
    if (a === 'g-move') {
      if (g.sel < 0) { toast('先在「分组池」里点一个分组作为归属', 'warn'); return; }
      if (!g.picked.length) { toast('先在「样本池」里勾选要分配的样本', 'warn'); return; }
      var tgt = g.groups[g.sel];
      g.picked.forEach(function (id) {
        if (tgt.sids.indexOf(id) < 0) tgt.sids.push(id);
      });
      var mv = g.picked.length;
      g.picked = [];
      toast('已把 ' + mv + ' 例样本分配到分组「' + tgt.n + '」', 'ok');
      renderProjNew(); return;
    }
    if (a === 'g-def') { g.def = !g.def; renderProjNew(); return; }
    if (a === 'g-ok') {
      var gnm = (g.n || '').replace(/^\s+|\s+$/g, '');
      if (!gnm) { toast('分组方案名称不能为空', 'warn'); return; }
      if (d.schemes.some(function (x, ix) { return x.n === gnm && ix !== g.src; })) {
        toast('分组方案名称已存在，请使用其他名称', 'warn'); return;
      }
      if (!g.groups.length) { toast('至少需要一个分组', 'warn'); return; }
      for (var q = 0; q < g.groups.length; q++) {
        if (g.groups[q].sids.length < 2) {
          toast('分组「' + g.groups[q].n + '」至少需要分配2个样本', 'warn'); return;
        }
      }
      var rec = { n: gnm, groups: g.groups, def: !!g.def };
      if (g.def) d.schemes.forEach(function (x) { x.def = false; });
      if (g.edit) d.schemes[g.src] = rec; else d.schemes.push(rec);
      d.scheme = g.edit ? g.src : d.schemes.length - 1;
      PNEW.view = 'wizard'; PNEW.g = null;
      toast('分组方案「' + gnm + '」已' + (g.edit ? '更新' : '创建') + '并选中', 'ok');
      renderProjNew(); return;
    }
  }

  /* 步骤 4：比较方案 */
  if (a === 'plan-sel') { d.plan = parseInt(t.getAttribute('data-i'), 10); renderProjNew(); return; }
  if (a === 'p-new' || a === 'p-edit') {
    /* 比较组下拉的选项来自分组方案；没选分组方案就先去选，否则下拉是空的 */
    if (d.scheme == null) { toast('请先在步骤 3 选择分组方案，对照组/处理组来自它', 'warn'); return; }
    var e2 = (a === 'p-edit');
    var s2 = e2 ? d.plans[d.plan] : { n: '', pairs: [], def: false };
    PNEW.pl = {
      n: s2.n, def: s2.def, edit: e2, src: e2 ? d.plan : -1,
      pairs: s2.pairs.map(function (x) { return { a: x.a, b: x.b }; })
    };
    PNEW.view = 'plan'; renderProjNew(); return;
  }
  var pl = PNEW.pl;
  if (pl) {
    if (a === 'p-add') { pl.pairs.push({ a: '', b: '' }); renderProjNew(); return; }
    if (a === 'p-del') { pl.pairs.splice(parseInt(t.getAttribute('data-i'), 10), 1); renderProjNew(); return; }
    if (a === 'p-pair') {
      /* 下拉的取值不能靠 harvest —— data-pn 挂在 select 上，change 也要走这里；
         click 派发时 select 已改值，直接读即可 */
      var kk = t.getAttribute('data-k'), ix2 = parseInt(kk.slice(1), 10);
      pl.pairs[ix2][kk.charAt(0)] = t.value;
      return;
    }
    if (a === 'p-def') { pl.def = !pl.def; renderProjNew(); return; }
    if (a === 'p-ok') {
      var pn = (pl.n || '').replace(/^\s+|\s+$/g, '');
      if (!pn) { toast('比较方案名称不能为空', 'warn'); return; }
      if (d.plans.some(function (x, ix) { return x.n === pn && ix !== pl.src; })) {
        toast('方案名称不能重复', 'warn'); return;
      }
      if (!pl.pairs.length) { toast('至少需要一个比较组', 'warn'); return; }
      for (var w = 0; w < pl.pairs.length; w++) {
        if (!pl.pairs[w].a || !pl.pairs[w].b) { toast('比较组中对照组和处理组不能为空', 'warn'); return; }
      }
      var seenP = {};
      for (var w2 = 0; w2 < pl.pairs.length; w2++) {
        var key = pl.pairs[w2].a + '>' + pl.pairs[w2].b;
        if (seenP[key]) { toast('存在重复的比较组', 'warn'); return; }
        seenP[key] = 1;
      }
      var rec2 = { n: pn, pairs: pl.pairs, def: !!pl.def };
      if (pl.def) d.plans.forEach(function (x) { x.def = false; });
      if (pl.edit) d.plans[pl.src] = rec2; else d.plans.push(rec2);
      d.plan = pl.edit ? pl.src : d.plans.length - 1;
      PNEW.view = 'wizard'; PNEW.pl = null;
      toast('比较方案「' + pn + '」已' + (pl.edit ? '更新' : '创建') + '并选中', 'ok');
      renderProjNew(); return;
    }
  }
}

/* 新增样本ID 子编辑器 */
function pnewSidEditor() {
  var sd = PNEW.sd;
  var f = function (id, lab, ph, req, opts) {
    return '<div class="fld"><label class="fld__l" for="' + id + '">' + lab
      + (req ? reqMark() : '') + '</label>'
      + (opts
        ? '<select class="sel" id="' + id + '"' + (req ? ' aria-required="true"' : '') + '><option value="">' + ph + '</option>'
          + opts.map(function (o) {
            return '<option' + (o === sd[id] ? ' selected' : '') + '>' + o + '</option>';
          }).join('') + '</select>'
        : '<input class="inp" id="' + id + '" autocomplete="off" placeholder="' + ph + '" value="' + esc(sd[id] || '') + '">')
      + '</div>';
  };
  return '<div class="stack">'
    + f('pnSidId', '样本ID：', '请输入', true)
    + f('pnSidName', '样本名称：', '请输入', true)
    + f('pnSidType', '样本类型：', '请选择', true, PNEW_TYPES)
    + f('pnSidSrc', '样本源名称：', '请输入', true)
    + '<div class="fld"><label class="fld__l" for="pnSidDesc">样本描述：' + reqMark() + '</label>'
    + '<textarea class="inp inp--ta" id="pnSidDesc" rows="3" aria-required="true"'
    + ' placeholder="请输入要分析的样本相关信息备注">' + esc(sd.pnSidDesc || '') + '</textarea></div>'
    + frmLegend() + '</div>';
}

/* ---------- 落库：把向导填的东西写成一个项目 ---------- */
/* 落库（幂等）。抽成独立函数而不是把这段塞进 next 分支：
   它还要负责把「当前项目」切到新项目、刷新列表与导航徽章 —— 这些动作与
   「点了哪颗按钮」无关，藏在分支里下次改步骤时必然漏一处。
   PNEW.made 既当幂等开关，也当最后一步回执的数据源：来回切步不会建第二条。 */
function pnewCreate() {
  if (PNEW.made) return PNEW.made;
  var d = PNEW.d, id = nextProjId(), now = nowStr();
  var groups = d.scheme == null ? [] : d.schemes[d.scheme].groups;
  var f = d.flow ? flowById(d.flow) : null;
  var pr = d.params || {};
  var rec = {
    id: id, n: d.name, kind: '课题项目', sp: '不限定',
    ref: d.ref || '—', vis: '空间内公开', own: CUR_USER.n,
    /* v47：rn 跟着「向导里选没选流程」走 —— 它是「本项目登记了几条流程」。
       选了就是 1 条（见下方 flow 字段），没选才是 0。
       以前恒为 0 是因为向导压根不问流程，建出来的项目在详情页里
       是一组空面板（「未绑定分析流程」），而那并不是用户的意思。 */
    sm: d.sids.length, u: '例样本', rn: f ? 1 : 0,
    /* flow：向导选的流程模板 id。projFlows() 优先读它（见那里的注释）——
       不写这个字段的话，项目会按 projLine() 猜一条流程出来，
       跟用户刚在向导里点的那条对不上。 */
    flow: f ? f.id : '',
    /* params：第 5 步确认的参数，原样存。参数快照面板优先读它。 */
    params: {
      aligner: pr.aligner, quant: pr.quant, de: pr.de, lfc: pr.lfc, padj: pr.padj,
      adj: pr.adj, mincount: pr.mincount, threads: pr.threads, mem: pr.mem,
      pair: !!pr.pair, batch: !!pr.batch, outlier: !!pr.outlier
    },
    tags: [d.grp, d.seq].filter(Boolean),
    st: '分析中', created: now, t: now, on: true,
    d: d.desc + '｜数据文件 ' + d.files.length + ' 个（' + d.seq + '）'
      + '｜分组方案 ' + (d.scheme == null ? '—' : d.schemes[d.scheme].n + '（' + groups.length + ' 组）')
      + '｜比较方案 ' + (d.plan == null ? '—' : d.plans[d.plan].n)
      + '｜流程模版 ' + (f ? f.n : '—')
      + '｜参数 ' + pr.aligner + ' / padj<' + pr.padj + ' / |log2FC|≥' + pr.lfc
      + ' / ' + pr.threads + '核' + pr.mem + 'GB'
  };
  PROJECTS.unshift(rec);
  PNEW.made = rec;
  /* 建完就切到新项目：新项目的样本 / 数据集 / 运行记录都是空的，
     不切的话用户看到的是上一个项目的运行历史，会以为建错了。
     滚回列表页也是刻意的（需求 6）：参考系统建完停在列表。 */
  setCurProj(id);
  goto('proj');
  toast('已创建项目「' + d.name + '」（' + id + '）', 'ok');
  return rec;
}

/* 必填标识的唯一出口：提醒色星号 + 表单尾部一行图例。
   控件本身再挂 aria-required，读屏念「必填」——星号是给眼睛的，属性是给读屏的，
   少了哪一半都有一类用户看不出「这个不能空着」。 */
function reqMark() {
  return '<span class="req" aria-hidden="true">*</span>';
}
function frmLegend() {
  return '<p class="frmlegend">' + reqMark() + ' 为必填项</p>';
}

/* 智能体「查看项目」的答复：数字现场算，避免新建项目后还在说「12 个项目」 */
function projQaText() {
  var cp = curProj();
  var recent = PROJECTS.slice().sort(function (a, b) { return a.t < b.t ? 1 : -1; }).slice(0, 3);
  return '当前可见 <b>' + PROJECTS.length + ' 个项目</b>，激活中的是 <b>' + (cp ? cp.n : '—') + '</b>'
    + (cp ? '（' + projMeta(cp) + '）' : '') + '。最近更新的 3 个：\n\n'
    + recent.map(function (p) { return '· ' + p.n + ' · ' + p.t; }).join('\n')
    + '\n\n要切到哪个项目？切换后样本、数据集与运行历史会一起过滤。';
}

/* 同上：数据集现在有项目归属，统计口径必须跟着「当前项目」走，
   否则会出现「智能体说 4 个数据集、详情抽屉说 2 个」的同屏矛盾。
   样本 / 数据集 / 元素合计 / 流程四个数字全部现场算；
   成功率与累计运行次数没有数据源，保留演示文案不做派生。 */
function projQaStatsText() {
  var cp = curProj() || {};
  var pid = cp.id;
  var smp = SAMPLES.filter(function (x) { return x[6] === pid; });
  var ds = COLLECTIONS.filter(function (c) { return c.pj === pid; });
  var din = ds.filter(function (c) { return c.dir === 'in'; }).length;
  var el = ds.reduce(function (a, c) { return a + c.el; }, 0);
  var g1 = smp.filter(function (x) { return x[4] === 'group_1'; }).length;
  return '当前项目（' + (cp.n || '—') + '）统计：\n\n'
    + '· 样本 <b>' + smp.length + '</b> 例'
    + (smp.length ? '（group_1 ' + g1 + ' 例 / group_2 ' + (smp.length - g1) + ' 例，均为双端测序）' : '') + '\n'
    + '· 数据集 <b>' + ds.length + '</b> 个（输入 ' + din + ' / 输出 ' + (ds.length - din) + '），元素合计 <b>' + el + '</b> 项\n'
    + '· 流程 <b>' + (cp.rn || 0) + '</b> 条，累计运行 <b>92</b> 次\n'
    + '· 近 30 天运行成功率 <b>94.6%</b>（失败 5 次，全部为内存或磁盘配额）';
}

function renderSample() {
  var tb = $('#sampleBody');
  if (!tb) return;
  tb.innerHTML = SAMPLES.map(function (s, i) {
    return '<tr>'
      + '<td class="num">' + (i + 1) + '</td>'
      + '<td class="num">' + s[0] + '</td>'
      + '<td>' + s[1] + '</td>'
      + '<td class="text-[11.5px]">' + s[2] + '</td>'
      + '<td class="text-[11.5px]">' + s[3] + '</td>'
      + '<td>' + s[4] + '</td>'
      + '<td>' + (s[5] || '—') + '</td>'
      + '<td class="wid"><button class="btn btn--sm btn--quiet" data-toast="编辑样本 ' + s[0] + '">编辑</button>'
      + '<button class="btn btn--sm btn--quiet" data-toast="已删除样本 ' + s[0] + '">删除</button></td>'
      + '</tr>';
  }).join('');
  var c = $('#sampleCount');
  if (c) {
    var g1 = SAMPLES.filter(function (s) { return s[4] === 'group_1'; }).length;
    c.textContent = '共 ' + SAMPLES.length + ' 例 · group_1 ' + g1 + ' 例 / group_2 ' + (SAMPLES.length - g1) + ' 例';
  }
}

function renderLog() {
  var tb = $('#logBody');
  if (!tb) return;
  tb.innerHTML = LOGS.map(function (l) {
    var cls = l[3] === '成功' ? 'tag--ok' : l[3] === '运行中' ? 'tag--brand' : 'tag--danger';
    return '<tr>'
      + '<td class="num text-[11.5px]">' + l[0] + '</td>'
      + '<td class="nw">' + l[1] + '</td>'
      + '<td><span class="tag">' + l[2] + '</span></td>'
      + '<td><span class="tag ' + cls + '">' + l[3] + '</span></td>'
      + '<td class="text-[11.5px]">' + l[4] + '</td>'
      + '<td>' + esc(l[5]) + '</td></tr>';
  }).join('');
  var t = $('#logTotal');
  if (t) t.textContent = '全员视图 · 共 105,211 条（本页展示最近 ' + LOGS.length + ' 条）';
  var pi = $('#logPageInfo');
  if (pi) pi.textContent = '第 1 页 / 共 5,261 页 · 每页 20 条 · 共 105,211 条';
}

/* ============================================================
   工具详情（动态标签页）
   ============================================================ */
function cmdFor(name) {
  var b = TOOLBIN[name] || 'run-tool';
  if (name === 'HISAT2 序列比对') {
    return 'hisat2 -x /data/standards/indexes/hg38/hg38_index --pen-cansplice 0 --pen-noncansplice 12 \\\n'
      + '       --min-intronlen 20 --max-intronlen 500000 --rna-strandness R -p 8 --dta \\\n'
      + '       -1 {r1} -2 {r2} -S {output_dir}/out.sam --summary-file {output_dir}/align_summary.txt';
  }
  if (name === 'fastp 快速质控' || name === 'fastp 双端质控/去接头') {
    return 'fastp -i {r1} -I {r2} -o {output_dir}/{sample}_1.clean.fq.gz \\\n'
      + '      -O {output_dir}/{sample}_2.clean.fq.gz --detect_adapter_for_pe \\\n'
      + '      --qualified_quality_phred 20 --length_required 36 -w 8 \\\n'
      + '      -j {output_dir}/{sample}.fastp.json -h {output_dir}/{sample}.fastp.html';
  }
  if (name === 'Kraken2 物种分类') {
    return 'kraken2 --db /data/standards/kraken2/minikraken2_v2_8GB \\\n'
      + '        --paired {r1} {r2} --threads 16 --confidence 0.1 \\\n'
      + '        --report {output_dir}/{sample}.kreport --output {output_dir}/{sample}.kraken';
  }
  return b + ' -i {input_dir} -o {output_dir}/result -t 8';
}

/* 工具页「本次配置摘要」：从表单实际控件读值，保证与左侧所见一致。
   不重写文案 —— 页头已经写过工具描述，这里只讲「这一次要跑什么」。 */
function toolSummary(sec) {
  if (!sec) return;
  var sum = sec.querySelector('#tp-sum');
  if (!sum) return;
  var sel = sec.querySelector('#tp-1');
  var seg = sec.querySelector('.seg__b.is-on');
  var r1 = sec.querySelector('#tp-r1'), r2 = sec.querySelector('#tp-r2');
  var ref = sec.querySelector('#tp-ref'), th = sec.querySelector('#tp-th');
  var paired = seg ? seg.textContent.trim() === 'paired' : true;
  var rows = [
    ['输入集合', sel && sel.value ? sel.value : '（未选）', false],
    ['库类型', paired ? 'paired · R1 / R2 分别绑定' : 'single · 仅用 R1', false],
    ['Read 1', r1 && r1.value ? r1.value : '（未选）', false],
    ['Read 2', paired ? (r2 && r2.value ? r2.value : '（未选）') : '不适用', !paired],
    ['参考基因组', ref && ref.value ? ref.value : '（未填）', false],
    ['线程', th && th.value ? th.value : '8', false]
  ];
  sum.innerHTML = rows.map(function (r) {
    return '<div class="cfgrow"><span class="cfgrow__k">' + r[0] + '</span>'
      + '<span class="cfgrow__v' + (r[2] ? ' is-off' : '') + '">' + esc(String(r[1])) + '</span></div>';
  }).join('');
}

function renderToolPage(name) {
  var cat = '', desc = '';
  TOOLCATS.forEach(function (c) {
    c.t.forEach(function (t) { if (t[0] === name) { cat = c.c; desc = t[1]; } });
  });
  var flowHas = FLOWS.filter(function (f) { return f.nodes.join(' ').indexOf(name.split(' ')[0]) >= 0; }).length;
  var bin = TOOLBIN[name] || 'run-tool';
  var cmd = cmdFor(name)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/(-{1,2}[a-zA-Z][\w-]*)/g, '<span class="k">$1</span>')
    .replace(/(\{[\w\/.]+\})/g, '<span class="v">$1</span>')
    .replace(/(\/data\/[\w\/.\-]+)/g, '<span class="o">$1</span>');

  var html = ''
    + '<div class="phead">'
    + '<div><div class="phead__eye">' + esc(cat) + '</div>'
    + '<h1 class="phead__h1">' + esc(name) + '</h1>'
    + '<p class="phead__d">' + esc(desc || '该工具暂无补充说明。') + '</p></div>'
    + '<div class="phead__side"><span class="tag">v1 · SINGLE_TOOL</span><span class="tag tag--ok">已就绪</span></div></div>'
    + '<div class="side">'
    + '<div class="stack">'
    + '<div class="card"><div class="card__bd">'
    + '<div class="fld"><label class="fld__l" for="tp-1">输入集合（可选，多样本 fan-out）</label>'
    + '<select class="sel" id="tp-1"><option>test1（6 元素 · 配对双端）</option><option>fastp 快速质控（输出）（6 元素）</option><option>TCGA-LIHC 表达矩阵（421 元素）</option></select>'
    + '<div class="fld__h">选中集合后每个样本并行运行，自动绑定 {r1} / {r2}。</div></div>'
    + '<div class="hr"></div>'
    + '<div class="fld"><span class="fld__l">单端 / 双端</span>'
    + '<div class="seg" role="group" aria-label="单双端"><button class="seg__b is-on" aria-selected="true">paired</button><button class="seg__b" aria-selected="false">single</button></div>'
    + '<div class="fld__h">Galaxy 的 “Is this a single or paired library?”，决定是否解绑 R1 / R2。</div></div>'
    + '<div class="fld mt-3"><label class="fld__l" for="tp-r1">' + reqMark() + 'FASTA/Q file #1（Read 1）</label>'
    + '<select class="sel" id="tp-r1" aria-required="true"><option>DRR091871_1.fastq.gz</option><option>DRR091873_1.fastq.gz</option><option>DRR091875_1.fastq.gz</option></select>'
    + '<div class="fld__h">必须为 fastqsanger / fastq 格式。</div></div>'
    + '<div class="fld mt-3"><label class="fld__l" for="tp-r2">' + reqMark() + 'FASTA/Q file #2（Read 2）</label>'
    + '<select class="sel" id="tp-r2" aria-required="true"><option>DRR091871_2.fastq.gz</option><option>DRR091873_2.fastq.gz</option><option>DRR091875_2.fastq.gz</option></select>'
    + '<div class="fld__h">双端必填；paired 时缺此项会在提交前拦截。</div></div>'
    + '<div class="hr"></div>'
    + '<div class="fld"><label class="fld__l" for="tp-ref">' + reqMark() + '参考基因组索引前缀</label>'
    + '<input class="inp" id="tp-ref" aria-required="true" value="/data/standards/indexes/hg38/hg38_index">'
    + '<div class="fld__h">本地索引前缀，hg38 已内置（BWA 4.3 GB / HISAT2 4.1 GB / STAR 26.7 GB）。</div></div>'
    + '<div class="hr"></div>'
    + '<div class="fld"><label class="fld__l" for="tp-th">线程数</label><input class="inp" id="tp-th" type="number" value="8" min="1" max="64"></div>'
    + frmLegend()
    + '</div></div>'
    + '<div class="card"><div class="card__ft">'
    + '<button class="btn btn--primary" data-tool-run data-toast="已提交运行「' + esc(name) + '」">' + ico('play') + '运行此工具</button>'
    + '<button class="btn" data-toast="已加入画布待编辑">加入画布</button>'
    + '</div></div>'
    + '</div>'
    + '<div class="stack">'
    + '<div class="card"><div class="card__hd"><span class="card__t">命令预览</span>'
    + '<span class="card__d">运行时实际拼装的命令行</span></div>'
    + '<div class="card__bd"><pre class="cmdbox">' + cmd + '</pre>'
    + '</div></div>'
    + '<div class="card"><div class="card__hd"><span class="card__t">运行结果</span></div>'
    + '<div class="card__bd"><div class="tempty">点击「运行此工具」提交任务，结果将在此实时展示</div></div></div>'
    + '<div class="card"><div class="card__hd"><span class="card__t">本次配置摘要</span>'
    + '<span class="card__d">提交前核对</span></div>'
    + '<div class="card__bd"><div class="cfgsum" id="tp-sum"></div>'
    + '<div class="fld__h">摘要跟随左侧表单实时更新。该工具被 '
    + (flowHas || 0) + ' 条内置流程引用。</div>'
    + '</div></div>'
    + '</div></div>';

  return { key: name, label: name, cat: cat, html: html };
}

/* ============================================================
   工作流画布（手绘 SVG DAG，可编辑）
   ============================================================ */
/* 节点卡：序号圈 + 图标 + 名称三段排下来，160px 刚好放下 9 个中文字。
   画布右侧被缩略图占去一列（约 150px），所以这几组数不能按「越宽越好」调 ——
   viewBox 越宽、等比缩放的倍率越小，屏幕上的字反而越小（见 wrap() 的注释）。 */
var DAG_NW = 160, DAG_NH = 44, DAG_GX = 56, DAG_GY = 36, DAG_PAD = 22;
var COLS_MAX = 4;

/* 折行布局：一行最多 COLS_MAX 个，奇数行反向排（蛇形），从上到下读得通。
   主图与右下角缩略图共用这一份 —— 两处各写一遍必然会对不上形状。 */
function dagLayout(n, NW, NH, GX, GY, PAD) {
  var COLS = Math.min(n, COLS_MAX) || 1;
  var pos = [], i, r, c;
  for (i = 0; i < n; i++) {
    r = Math.floor(i / COLS); c = i % COLS;
    if (r % 2 === 1) c = COLS - 1 - c;
    pos.push([PAD + c * (NW + GX), PAD + r * (NH + GY)]);
  }
  var rows = Math.ceil(n / COLS) || 1;
  return {
    pos: pos,
    W: PAD * 2 + COLS * NW + (COLS - 1) * GX,
    H: PAD * 2 + rows * NH + (rows - 1) * GY
  };
}

/* 连线路径：同行/顺排走水平贝塞尔；折回下一行时绕一个 U 型。
   span 参数让缩略图用同一套走线、只是换个尺寸。 */
function dagPath(a, b, NW, NH, GX) {
  var x1 = a[0] + NW, y1 = a[1] + NH / 2, x2 = b[0], y2 = b[1] + NH / 2;
  var k = Math.round(GX * 0.6), drop = Math.round(NH * 0.77);
  if (x2 > x1 + 4) {
    var mx = (x1 + x2) / 2;
    return 'M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ',' + mx + ' ' + y2 + ',' + x2 + ' ' + y2;
  }
  return 'M' + x1 + ' ' + y1 + ' C' + (x1 + k) + ' ' + y1 + ',' + (x1 + k) + ' ' + (y1 + drop) + ',' + (x1 + 22) + ' ' + (y1 + drop)
    + ' L' + (x2 - 22) + ' ' + (y2 + drop) + ' C' + (x2 - k) + ' ' + (y2 + drop) + ',' + (x2 - k) + ' ' + y2 + ',' + x2 + ' ' + y2;
}

/* 节点名 → 图标。名字来自 FLOWS 数据，扫描器猜不出来，所以只能按关键词定。
   ⚠ 这里出现的图标名必须都在 ICON_REGISTRY 里，否则 ico() 会返回问号占位
   （dagIco 更干脆：直接不画），build.js 的 miss 检查也会挂。 */
var NODE_ICONS = [
  [/输入|集合|原始数据|reads|manifest|mzML|VCF/i, 'file-arrow-up'],
  [/去宿主|去冗余|过滤|质控|QC|快速|修剪|去接头|缺失值/i, 'filter'],
  [/比对|序列|变异|组装|预测|基因/i, 'dna'],
  [/定量|丰度|计数|矩阵|峰检测|格式转换|规范化/i, 'table-cells'],
  [/分箱|网络|互作|PPI|聚类|PCA|降噪/i, 'diagram-project'],
  [/完整度|污染|评估|分级|报告/i, 'clipboard-check'],
  [/分类|注释|物种|功能|耐药|毒力|CAZyme|病毒|bracken/i, 'microscope'],
  [/富集|统计|柱状|气泡|箱线|火山/i, 'chart-column'],
  [/差异|趋势|曲线|Sashimi|剪切/i, 'chart-line'],
  [/可视化|出图|热图|圈图|汇总|MultiQC/i, 'file-lines'],
  [/质谱|代谢/i, 'atom'],
  [/蛋白|MaxQuant|STRING/i, 'flask-vial']
];
var NODE_ICON_DEF = 'gears';

function nodeIcon(nm) {
  for (var i = 0; i < NODE_ICONS.length; i++) {
    if (NODE_ICONS[i][0].test(nm)) return NODE_ICONS[i][1];
  }
  return NODE_ICON_DEF;
}

/* 把 FontAwesome 图标嵌进外层 SVG。两处与 ico() 不同，都不能想当然：
   ① FAI[name].p 存的**已经是完整的 <path …> 标记**（build.js 直接存的 innerHTML），
      不是 d 属性值 —— 再包一层 <path d="…"> 会把属性截断，余下的 "/> 漏成画布上的
      一段可见文字（表现是节点名前面多一坨 `"/>`）。
   ② 嵌套 <svg> 必须自带 x/y/width/height，否则新视口尺寸为 0，图标画不出来。
   名字缺失时返回空串而不是问号占位 —— 画布里一个占位圆圈比少一个图标更难看，
   缺失由 verify 的图标探针兜住。 */
function dagIco(name, x, y, size, fill) {
  var d = (window.FAI || {})[name];
  if (!d) return '';
  return '<svg x="' + x + '" y="' + y + '" width="' + size + '" height="' + size
    + '" viewBox="' + d.v + '" fill="' + fill + '" aria-hidden="true">' + d.p + '</svg>';
}

/* mini = 右下角缩略图：只画几何，不带文字、图标与 .dagstep 标记 ——
   它就是「我现在编到多长了」的示意，不承担阅读职责（整块 aria-hidden）。 */
function dagSVG(nodes, links, mini) {
  var NW = mini ? 26 : DAG_NW, NH = mini ? 12 : DAG_NH;
  var GX = mini ? 9 : DAG_GX, GY = mini ? 7 : DAG_GY, PAD = mini ? 5 : DAG_PAD;
  var L = dagLayout(nodes.length, NW, NH, GX, GY, PAD);
  var pos = L.pos, W = L.W, H = L.H;
  var arrowId = mini ? 'dagArrowMini' : 'dagArrow';

  var out = '<svg class="chart' + (mini ? ' dagmini__svg' : '') + '" viewBox="0 0 ' + W + ' ' + H
    + '" role="img" aria-label="' + (mini ? '流程缩略图' : '工作流 DAG，共 ' + nodes.length + ' 个节点') + '">';
  if (!mini) out += '<title>工作流节点图：' + nodes.join(' → ') + '</title>';

  links.forEach(function (l) {
    out += '<path d="' + dagPath(pos[l[0]], pos[l[1]], NW, NH, GX) + '" fill="none" stroke="'
      + C.brandLine + '" stroke-width="' + (mini ? 1 : 1.4) + '" marker-end="url(#' + arrowId + ')"/>';
  });

  out += '<defs><marker id="' + arrowId + '" viewBox="0 0 8 8" refX="6.4" refY="4" markerWidth="'
    + (mini ? 4 : 5.6) + '" markerHeight="' + (mini ? 4 : 5.6) + '" orient="auto">'
    + '<path d="M0 0.6 L7.4 4 L0 7.4 z" fill="' + C.brand + '"/></marker></defs>';

  nodes.forEach(function (nm, i) {
    var x = pos[i][0], y = pos[i][1];
    var last = i === nodes.length - 1;
    if (mini) {
      out += rect(x, y, NW, NH, last ? C.ok : '#FFFFFF',
        'stroke="' + C.brandLine + '" stroke-width="1" rx="3"');
      return;
    }
    var band = last ? C.ok : C.brand;
    /* 节点是展示元素，不带 role / tabindex：它没有任何点击处理器，
       标成按钮只会让人「够得着点不动」。要看某一步的完整名称走「节点列表」。 */
    out += '<g class="dagstep" data-dagstep="' + i + '" aria-label="节点 ' + (i + 1) + '：' + nm + '">';
    out += rect(x, y, NW, NH, '#FFFFFF', 'stroke="' + C.brandLine + '" stroke-width="1.4" rx="9"');
    out += rect(x, y + 1, 4.5, NH - 2, band, 'rx="2"');
    out += circle(x + 17, y + NH / 2, 8.5, C.brandSoft);
    out += txt(x + 17, y + NH / 2 + 3.6, String(i + 1), { fill: C.brandDeep, fs: 9.5, anchor: 'middle', mono: true });
    /* 序号圈之后是图标，再之后才是名称：从 x+49 到卡右沿共 103px，约合 9 个中文字。
       更长的名字截断，全名在 aria-label 与「节点列表」表里都在，不会丢信息。 */
    out += dagIco(nodeIcon(nm), x + 31, y + NH / 2 - 6.5, 13, last ? C.ok : C.brand);
    var label = nm.length > 9 ? nm.slice(0, 8) + '…' : nm;
    out += txt(x + 49, y + NH / 2 + 4, label, { fill: C.ink, fs: 11.5 });
    out += '</g>';
  });
  out += '</svg>';
  return { svg: out, w: W, h: H, icons: nodes.map(nodeIcon) };
}

/* 流程的运行状态不硬编码。
   初始态里在跑的是「fastp 快速质控」这条单工具记录，没有任何流程在跑；
   硬把某条流程标成「运行中」会与运行历史面板（那里写着 4/4 已完成）正面冲突。
   状态一律从运行历史反查 —— 历史面板才是唯一事实来源。 */

function flowRunState(fid) {
  var f = orchFlowById(fid);
  if (!f) return null;
  for (var i = 0; i < HIST.length; i++) {          /* HIST 新的在前 */
    var h = HIST[i];
    if (h.n.indexOf('运行 #') === 0 && h.m.indexOf(f.n) >= 0) return h;
  }
  return null;
}

/* 没有运行记录的流程不给状态徽章 —— 与其显示一个「未运行」占位，不如什么都不说 */
function flowBadgeHTML(fid) {
  var h = flowRunState(fid);
  if (!h) return '';
  var running = h.s === 'run';
  return '<span class="tag ' + (running ? 'tag--brand' : 'tag--ok') + '">'
    + (running ? '运行中' : '已完成') + '</span>';
}

/* ============================================================
   流程编排（内嵌在「流程模板」这一步）
   ============================================================
   工具库与 DAG 画布原本是常驻左栏 + 独立动态标签页；
   现在它们是 p04 内部的能力，不再各自占一个导航位。 */
var ORCHMODE = 'flows';          /* flows | tools */
var ORCHQ = '';
/* v34：左栏列表的图标配色轮换（青/绿/琥珀/墨四色，全部取自现有 token 系，
   亮底软色 + 深前景成对出现，避免对比度回归变红）。纯装饰，不承载语义。 */
var WF_PAL = [
  ['rgba(16,99,118,.12)', 'var(--color-brand-deep)'],
  ['rgba(10,107,73,.12)', 'var(--color-ok)'],
  ['rgba(138,82,0,.12)', 'var(--color-warn)'],
  ['rgba(10,70,85,.12)', 'var(--color-ink)']
];
var PICK = { flow: DEFAULT_FLOW, tool: null };

/* 画布内容不再直接等于某条内置流程：载入模板后可以往末尾接节点。
   CANVAS 是画布的**唯一事实来源**，模板只负责给它一个初值；
   base 只是「这条草稿是从哪来的」，用来算「自编排 +N」与支持重置。 */
var CANVAS = { base: null, nodes: [], links: [] };

function orchFlowById(id) {
  return FLOWS.filter(function (f) { return f.id === id; })[0];
}

function renderOrchList() {
  var box = $('#orchList');
  if (!box) return;
  /* 占位符随来源切换：参考系统的「搜索工具 / 搜索流程」两套文案 */
  var si = $('#orchSrch');
  if (si) si.placeholder = ORCHMODE === 'tools' ? '搜索工具…' : '搜索流程…';
  var q = ORCHQ.trim().toLowerCase();

  if (ORCHMODE === 'flows') {
    var list = FLOWS.filter(function (f) {
      return !q || f.n.toLowerCase().indexOf(q) >= 0 || f.d.toLowerCase().indexOf(q) >= 0
        || f.nodes.join(' ').toLowerCase().indexOf(q) >= 0;
    });
    if (!list.length) { box.innerHTML = '<div class="orch__empty">没有匹配的流程</div>'; return; }
    box.innerHTML = list.map(function (f, fi) {
      /* v34：与工具库同构的「图标 + 名称 + 描述」行 —— 图标色随流程轮换，
         纯装饰（状态语义仍由 flowBadge 表达，不抢告警的活） */
      var pal = WF_PAL[fi % WF_PAL.length];
      return '<button class="wfitem" data-flow="' + f.id + '" aria-current="'
        + (f.id === PICK.flow ? 'true' : 'false') + '">'
        + '<span class="wfitem__i" style="background:' + pal[0] + ';color:' + pal[1] + '" aria-hidden="true">'
        + ico('diagram-project') + '</span>'
        + '<span class="wfitem__b"><span class="wfitem__n">' + esc(f.n) + '</span>'
        + '<span class="wfitem__s">' + flowBadgeHTML(f.id)
        + '<span>' + f.nodes.length + ' 节点</span><span>' + f.links.length + ' 连线</span>'
        + '</span></span></button>';
    }).join('');
    return;
  }

  /* 内置网络图入口。原先挂在左栏「工作流」列表头部，左栏改成分组导航后没有归属，
     改挂在工具库首位 —— 它本质就是一个可视化工具。 */
  var html = '<button class="netentry" data-netgraph>'
    + ico('circle-nodes')
    + '<span class="min-w-0"><span class="netentry__n">网络图 · 内置</span>'
    + '<span class="netentry__d">Cytoscape 可视化 · 布局 / 编辑 / 分析 / 导入导出</span></span></button>';
  TOOLCATS.forEach(function (cat, ci) {
    var items = cat.t.filter(function (t) {
      return !q || t[0].toLowerCase().indexOf(q) >= 0 || (t[1] || '').toLowerCase().indexOf(q) >= 0;
    });
    /* 搜索时跳过无命中的分类，避免整屏空标题；不搜索时保留全部分类，
       空分类显式说明「暂无独立工具条目」—— 静默跳过会被当成「少了一类」。 */
    if (q && !items.length) return;
    var pal = WF_PAL[ci % WF_PAL.length];
    html += '<div class="tcat"' + (items.length ? '' : ' data-empty="1"') + '>'
      + '<button class="tcat__h" data-tcat="' + esc(cat.c) + '" aria-expanded="true">'
      + '<span class="tcat__i" style="background:' + pal[0] + ';color:' + pal[1] + '" aria-hidden="true">' + ico(cat.ic) + '</span>' + esc(cat.c)
      + '<span class="tcat__n">' + items.length + '</span>'
      + '<span class="tcat__c">▾</span></button>'
      + '<div class="tcat__l" data-tcatl="' + esc(cat.c) + '">';
    if (!items.length) {
      html += '<div class="tempty">暂无独立工具条目（相关能力见「流程模板」）</div>';
    }
    items.forEach(function (t) {
      html += '<button class="titem" data-tool="' + esc(t[0]) + '" aria-current="'
        + (t[0] === PICK.tool ? 'true' : 'false') + '">'
        + '<span class="titem__i" aria-hidden="true">' + (t[2] || '🔧') + '</span>'
        + '<span class="titem__b"><span class="titem__n">' + esc(t[0]) + '</span>'
        + (t[1] ? '<span class="titem__d">' + esc(t[1]) + '</span>' : '')
        + '</span></button>';
    });
    html += '</div></div>';
  });
  box.innerHTML = html || '<div class="orch__empty">没有匹配的工具</div>';
}

/* 把一条内置流程灌进画布。只负责给初值，之后的改动都记在 CANVAS 上，
   不再回头改 FLOWS —— 模板是模板，草稿是草稿。 */
function loadFlow(id) {
  var f = orchFlowById(id);
  CANVAS.base = f ? id : null;
  CANVAS.nodes = f ? f.nodes.slice() : [];
  CANVAS.links = f ? f.links.map(function (l) { return [l[0], l[1]]; }) : [];
  PICK.flow = f ? id : PICK.flow;
}

/* 从工具库点一个工具 = 往画布末尾接一个节点，并把新节点接到原来的末端后面。
   没有任何连线会产生「孤岛节点」，所以这里一定补一条上一节点 → 新节点的边。 */
function appendNode(name) {
  var n = CANVAS.nodes.length;
  CANVAS.nodes.push(name);
  if (n > 0) CANVAS.links.push([n - 1, n]);
  renderOrchCanvas();
  return n;
}

function resetCanvas() {
  loadFlow(CANVAS.base || PICK.flow);
  renderOrch();
}

/* 连线一律按 [上游, 下游] 升序排列。插入与删除会打乱顺序，而「有没有改动」
   与「和模板是否一致」两处比较都按数组逐位比 —— 不归一化就会出现
   「逻辑上没改、却被判成有改动」。 */
function normLinks() {
  CANVAS.links.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
}

/* 画布是否偏离了来源模板：节点名或连线任一不同即为「有未保存的改动」。
   它决定「运行此流程」是直接往下走、还是先拦下来提醒另存为新模板。 */
function orchDirty() {
  var f = orchFlowById(CANVAS.base);
  if (!f) return CANVAS.nodes.length > 0;
  if (f.nodes.length !== CANVAS.nodes.length) return true;
  for (var i = 0; i < f.nodes.length; i++) if (f.nodes[i] !== CANVAS.nodes[i]) return true;
  if (f.links.length !== CANVAS.links.length) return true;
  for (var j = 0; j < f.links.length; j++) {
    if (f.links[j][0] !== CANVAS.links[j][0] || f.links[j][1] !== CANVAS.links[j][1]) return true;
  }
  return false;
}

/* 删掉第 i 个节点：连到它的边一并删掉，它下游的节点编号整体前移一位。
   漏掉编号前移的后果是画布上留下指向空位置的边 —— 表现为连线断在半空。 */
function deleteNode(i) {
  if (i < 0 || i >= CANVAS.nodes.length) return false;
  var gone = CANVAS.nodes[i];
  CANVAS.nodes.splice(i, 1);
  CANVAS.links = CANVAS.links
    .filter(function (l) { return l[0] !== i && l[1] !== i; })
    .map(function (l) { return [l[0] > i ? l[0] - 1 : l[0], l[1] > i ? l[1] - 1 : l[1]]; });
  normLinks();
  renderOrchCanvas();
  return gone;
}

/* 在第 i 个节点**之后**插入一个新节点：把原来的 i→i+1 断开，改接成 i→新→i+1。
   插在末端时没有 i+1，只补 i→新 一条 —— 新节点不会成为孤岛。 */
function insertNodeAfter(i, name) {
  if (i < 0 || i >= CANVAS.nodes.length || !name) return false;
  var k = i + 1;
  var hadNext = !!CANVAS.links.filter(function (l) { return l[0] === i && l[1] === k; }).length;
  CANVAS.nodes.splice(k, 0, name);
  CANVAS.links = CANVAS.links
    .filter(function (l) { return !(l[0] === i && l[1] === k); })   /* 先撤掉 i→i+1 */
    .map(function (l) { return [l[0] > i ? l[0] + 1 : l[0], l[1] > i ? l[1] + 1 : l[1]]; });
  CANVAS.links.push([i, k]);
  if (hadNext) CANVAS.links.push([k, k + 1]);
  normLinks();
  renderOrchCanvas();
  return true;
}

/* 插入节点的弹窗：工具名从工具库取（与「点工具往末尾接」同一份数据源），
   也允许直接写一个自定义节点名。 */
var INS_REF = null;
function openNodeInsert(i) {
  var nodes = CANVAS.nodes;
  if (i < 0 || i >= nodes.length) return;
  INS_REF = i;
  var opts = [];
  TOOLCATS.forEach(function (c) { c.t.forEach(function (t) { opts.push(t[0]); }); });
  showModal('插入节点',
    '<p class="text-[12.5px] text-ink2">插到「<b>' + esc(nodes[i]) + '</b>」之后，'
      + '原连线自动改接成「' + esc(nodes[i]) + ' → 新节点 → 下游」，不需要手工连边。</p>'
    + '<div class="mt-3">' + fldSel('insTool', '节点（取自工具库）',
        opts.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('')) + '</div>'
    + fldInp('insName', '自定义节点名（选填）', '', '留空则用上面选中的工具名'),
    '<button type="button" class="btn" data-close="modal">取消</button>'
    + '<button type="button" class="btn btn--primary" data-node-ins-ok>' + ico('plus') + '插入节点</button>');
}
function commitNodeInsert() {
  var i = INS_REF;
  if (i == null || !CANVAS.nodes[i]) { $('#modal').hidden = true; return; }
  var anchor = CANVAS.nodes[i];
  var nm = fv('#insName') || fv('#insTool');
  if (!nm) { toast('请选择或填写节点名称', 'warn'); return; }
  $('#modal').hidden = true;
  insertNodeAfter(i, nm);
  toast('已在「' + anchor + '」之后插入节点「' + nm + '」', 'ok');
}

/* 另存为新模板：把当前画布固化进 FLOWS —— 保存后它作为一条新模板出现在
   左侧「流程模板」列表里，可以再选中、再改动。内置模板本体不动（模板是模板、
   草稿是草稿）。真接后端时这里换成 POST 即可。 */
var SAVEDN = 1;
var SAVE_RUN = false;      /* 这次保存是不是「保存后立刻运行」拉起来的 */

function saveCanvas(name, desc) {
  if (!CANVAS.nodes.length) { toast('画布是空的，没有可保存的流程', 'warn'); return null; }
  if (!name) { toast('请先填写流程名称', 'warn'); return null; }
  var id = 'f' + (2013 + SAVEDN++);          /* f2014 起，与内置的 f01–f12 不撞号 */
  var f = {
    id: id, n: name,
    d: desc || CANVAS.nodes.join(' → '),
    s: CANVAS.nodes.join(' → '),
    nodes: CANVAS.nodes.slice(),
    links: normLinksReturn(),
    saved: true
  };
  FLOWS.push(f);
  CANVAS.base = id; PICK.flow = id;
  renderOrch();
  return f;
}
function normLinksReturn() {
  normLinks();
  return CANVAS.links.map(function (l) { return [l[0], l[1]]; });
}

/* 另存弹窗：名称必填、描述选填，并把将要保存的节点列出来 ——
   「保存」之后列表里到底会多出哪一条，用户在这一步就该看到。 */
function openSaveFlowModal(runAfter) {
  if (!CANVAS.nodes.length) { toast('画布是空的，先从左侧选一条流程模板', 'warn'); return; }
  SAVE_RUN = !!runAfter;
  var base = orchFlowById(CANVAS.base);
  var sug = (base ? base.n.replace(/（.*?）/, '') : '自编排流程') + '（自编排 ' + CANVAS.nodes.length + ' 步）';
  showModal('另存为新模板',
    '<p class="text-[12.5px] text-ink2">来源模板：<b>' + esc(base ? base.n : '（自己从工具库拼的）')
      + '</b> · 当前 <b>' + CANVAS.nodes.length + '</b> 个节点。保存后将成为一条新模板，'
      + '来源模板保持不变。</p>'
    + '<div class="mt-3">' + fldInp('flowNewName', '流程名称' + reqMark(), sug, '例如：RNA-seq 完整分析流程（加对照）') + '</div>'
    + fldInp('flowNewDesc', '流程描述', '', '选填：这条流程与来源模板差在哪')
    + '<div class="fld mt-3"><span class="fld__l">节点（' + CANVAS.nodes.length + ' 个）</span>'
    + '<div class="tempnodes">' + CANVAS.nodes.map(function (n, i) {
        return '<span><b>' + (i + 1) + '</b>' + esc(n) + '</span>';
      }).join('') + '</div></div>'
    + frmLegend(),
    '<button type="button" class="btn" data-close="modal">取消</button>'
    + '<button type="button" class="btn btn--primary" data-flow-save-ok>' + ico('floppy-disk') + '保存为新模板</button>');
  setTimeout(function () { var el = $('#flowNewName'); if (el) { el.focus(); el.select(); } }, 30);
}
function commitSaveFlow() {
  var nm = fv('#flowNewName');
  if (!nm) { toast('流程名称不能为空', 'warn'); var el = $('#flowNewName'); if (el) el.focus(); return; }
  if (FLOWS.some(function (x) { return x.n === nm; })) { toast('已有同名流程「' + nm + '」', 'warn'); return; }
  var wantRun = SAVE_RUN;
  var f = saveCanvas(nm, fv('#flowNewDesc'));
  if (!f) return;
  $('#modal').hidden = true;
  setOrchMode('flows');          /* 列表切回「流程模板」，新模板才看得见 */
  toast('已另存为新模板「' + f.n + '」，可在左侧流程模板列表中选中', 'ok');
  if (wantRun) { SAVE_RUN = false; goto('p05'); }
  SAVE_RUN = false;
}

/* 「运行此流程」：模板原样就直接往下走；改过的先拦下来 ——
   不提醒的话，这次改动会随着离开页面悄悄丢掉，而用户以为跑的就是眼前这条。 */
function runOrchFlow() {
  if (!CANVAS.nodes.length) { toast('画布是空的，先从左侧选一条流程模板', 'warn'); return; }
  if (!orchDirty()) { goto('p05'); return; }
  var base = orchFlowById(CANVAS.base);
  showModal('流程有未保存的改动',
    '<p class="text-[13px]">当前画布是在「<b>' + esc(base ? base.n : '自编排流程')
      + '</b>」上改过的版本：<b>' + (base ? base.nodes.length : 0) + '</b> → <b>'
      + CANVAS.nodes.length + '</b> 个节点。</p>'
    + '<div class="alert alert--warn mt-3"><span class="alert__ico">' + ico('triangle-exclamation') + '</span>'
    + '<div class="alert__bd"><div class="alert__t"><span class="alert__tag">先保存</span>运行的是画布上的这一版</div>'
    + '<p class="alert__p">内置流程模板不会被改写。要把这次改动留下来，'
      + '需要先把它另存为一条新模板；只点运行而不保存，改动会在离开本页时丢掉。</p></div></div>',
    '<button type="button" class="btn" data-close="modal">返回继续编辑</button>'
    + '<button type="button" class="btn btn--primary" data-orch-save-run>'
    + ico('floppy-disk') + '保存为新模板并运行</button>');
}

function renderOrchCanvas() {
  var cv = $('#orchCanvas'), tb = $('#orchTable'), nm = $('#orchName'), st = $('#orchStat'), hn = $('#orchHint');
  if (!cv) return;
  var nodes = CANVAS.nodes, links = CANVAS.links;
  var f = orchFlowById(CANVAS.base);
  if (!nodes.length) {
    if (nm) nm.textContent = '未选择流程';
    if (st) st.innerHTML = '';
    if (hn) hn.textContent = '';
    cv.innerHTML = '<div class="orch__empty">从左侧选一条流程模板，或切到工具库逐个挑工具。</div>';
    if (tb) { tb.hidden = true; tb.innerHTML = ''; }
    return;
  }
  var dag = dagSVG(nodes, links);
  var extra = f ? nodes.length - f.nodes.length : 0;
  if (nm) nm.textContent = f ? f.n : '自编排流程';
  if (st) {
    st.innerHTML = '<span class="tag">' + nodes.length + ' 节点</span>'
      + '<span class="tag">' + links.length + ' 连线</span>'
      + (extra > 0 ? '<span class="tag tag--brand">自编排 +' + extra + '</span>' : '')
      + (f ? (flowBadgeHTML(f.id) || '<span class="tag">未运行</span>') : '');
  }
  /* 底部那行只报状态差（模板 N 步 → 现在 M 步），不写「怎么用」的教学话术 */
  if (hn) {
    hn.textContent = extra > 0
      ? '模板原有 ' + f.nodes.length + ' 个节点，当前 ' + nodes.length + ' 个'
      : '';
  }
  /* 图 + 图例（v37 去掉缩略图：它把主图挤到窄列，节点文字反而更小 ——
     要看全貌不如直接用旁边的「全屏」）。节点数据只在数据表替代视图里再讲一次。 */
  cv.innerHTML = '<div class="dagwrap">' + dag.svg + '</div>'
    + '<div class="daglg">'
    + '<span><i style="background:' + C.brand + '"></i>普通节点</span>'
    + '<span><i style="background:' + C.ok + '"></i>终点节点（产物落地）</span>'
    + '<span><i style="background:' + C.brandLine + '"></i>数据流方向</span>'
    + '</div>';
  if (tb) {
    /* 节点表既是对 DAG 的无障碍替代视图，也是**编辑入口**：
       往末尾接节点靠工具库，中间插一个 / 删一个则在这里做 ——
       SVG 上的节点是可点区域，往上挂删除按钮既难点中也读不出来。 */
    tb.innerHTML = '<div class="tblwrap"><table class="tbl">'
      + '<thead><tr><th>#</th><th>节点</th><th>上游</th><th style="width:150px;">操作</th></tr></thead><tbody>'
      + nodes.map(function (n, i) {
          var ups = links.filter(function (l) { return l[1] === i; })
            .map(function (l) { return '#' + (l[0] + 1); });
          return '<tr><td class="num">' + (i + 1) + '</td><td>' + esc(n) + '</td>'
            + '<td class="num">' + (ups.join('、') || '—') + '</td>'
            + '<td><span class="ops">'
            + '<button type="button" class="btn btn--sm btn--quiet" data-node-ins="' + i + '"'
            + ' aria-label="在「' + esc(n) + '」之后插入节点">' + ico('plus') + '插入</button>'
            + '<button type="button" class="btn btn--sm btn--quiet" data-node-del="' + i + '"'
            + ' aria-label="删除节点「' + esc(n) + '」">' + ico('trash-can') + '删除</button>'
            + '</span></td></tr>';
        }).join('')
      + '</tbody></table></div>';
  }
}

/* 首次进入时给画布一个初值：默认那条 = 默认选中的分析类型对应的流程，
   卡片高亮与画布从第一屏起就是同一条。 */
function initOrch() { loadFlow(DEFAULT_FLOW); renderOrch(); }

function renderOrch() { renderOrchList(); renderOrchCanvas(); }

function setOrchMode(mode) {
  ORCHMODE = mode;
  ORCHQ = '';
  $$('#orch .seg__b').forEach(function (b) {
    var on = b.getAttribute('data-orchseg') === mode;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  var srch = $('#orchSrch');
  if (srch) { srch.value = ''; srch.placeholder = mode === 'tools' ? '搜索工具…' : '搜索流程…'; }
  renderOrchList();
}

/* 点左侧列表换流程 = 换模板，会**丢弃**当前画布上的自编排改动。
   这是刻意的：模板与草稿是两件事，选模板就该看到模板原样。 */
function pickFlow(id) {
  loadFlow(id);
  renderOrch();
}

/* 编排区全屏：把 #orch 拎出文档流铺满视口，再点一次或按 Esc 收起。
   DAG 是 viewBox 等比缩放 —— 中栏约 668px 时 7 节点流程只放大到 0.64 倍、
   节点文字被压到 ~7px；铺满后按窗口宽度放大，节点与连线标签才读得清。
   按钮文案与图标随状态切换，并同步 aria-pressed，不能只换外观不换语义。

   v60：「全屏」这一下**先进入外部编排系统**（.orchext 接管、站内画布收起）。
   需求是「点全屏进入外部编排页面」，但站内画布的全屏放大本身是有价值的既有能力，
   13 条断言正断着它 —— 所以两者都留：全屏默认显外部系统，bar 上有「返回站内画布」，
   点了在同一全屏壳里换回画布（仍保持放大态），再点「全屏」才整体收起。 */
function toggleOrchFull(force) {
  var box = $('#orch');
  if (!box) return;
  var on = (typeof force === 'boolean') ? force : !box.classList.contains('is-full');
  /* 状态没变就直接返回：goto() 每次导航都会调一次以收起全屏，
     若每次都重写按钮 innerHTML，会把焦点和选中态一起抖掉。 */
  if (on === box.classList.contains('is-full')) return;
  box.classList.toggle('is-full', on);
  document.body.classList.toggle('is-orchfull', on);
  var b = $('[data-orch-full]');
  if (b) {
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', on ? '收起外部编排系统，返回页面' : '全屏打开外部编排系统');
    b.innerHTML = ico(on ? 'compress' : 'expand') + (on ? '收起' : '外部编排');
  }
  /* 全屏的两态：进来显外部系统，收起时把站内画布放回去（否则下次进编排页是空的）。 */
  setOrchExt(on);
}

/* v60 · 外部编排系统
   ============================================================
   需求原文：「把 http://aizx.jwzcloud.com:1888/ 这个链接放入到
   项目管理-智能分析-流程编排页面中，点击自编排的全屏按钮进入此链接页面」。

   选「全屏 + 页内嵌入」而不是跳外链：跳外链会把整站布局丢掉，
   面包屑、左栏、顶栏全没了，回不来；iframe 让用户始终站在系统里。
   实测该地址 HTTP 200 且未下发 X-Frame-Options / CSP frame-ancestors，
   可被嵌套（这类硬约束由对方响应头决定，前端绕不过）。

   iframe 的 src 由 ORCH_EXT_URL 运行时 setAttribute 写入 —— HTML 里不写死，
   产物中因此没有 src 属性，只能靠运行时探针断（与 v58 知识库同一套路）。 */
var ORCH_EXT_URL = 'http://aizx.jwzcloud.com:1888/';
var ORCH_EXT_LOADED = false;
var ORCH_EXT_TIMER = null;
var ORCH_EXT_TIMEOUT = 8000;

/* 切外部系统 / 站内画布。两者是同一块区域里的两个视图，所以用 hidden 收放，
   不换页 —— 换页会丢滚动位置，面包屑也会多出一级。 */
function setOrchExt(on) {
  var box = $('#orch'), ext = $('#orchExt');
  if (!box) return;
  var extOn = !!on;
  if (ext) ext.hidden = !extOn;
  var body = $('.orch__b', box);
  if (body) body.hidden = extOn;
  box.setAttribute('data-orchview', extOn ? 'ext' : 'local');
  var back = $('[data-orchext-back]');
  if (back) back.hidden = !extOn;
  if (extOn) mountOrchExt();
}

/* 挂载 iframe。第一次进来才写 src：反复进出不该反复重载外部系统。 */
function mountOrchExt() {
  var f = $('#orchExt');
  if (!f) return;
  var el = $('[data-orchextel]', f);
  var uTxt = $('[data-orchexturl]', f);
  var aTxt = $('[data-orchextfailaddr]', f);
  if (uTxt) uTxt.textContent = ORCH_EXT_URL;
  if (aTxt) aTxt.textContent = ORCH_EXT_URL;
  $$('[data-orchext-open]', f).forEach(function (a) { a.href = ORCH_EXT_URL; });
  if (!el) return;
  if (el.getAttribute('src') === ORCH_EXT_URL) { orchExtOk(); return; }
  orchExtLoading();
  el.setAttribute('src', ORCH_EXT_URL);
}

function orchExtLoading() {
  var f = $('#orchExt');
  if (!f) return;
  ORCH_EXT_LOADED = false;
  var ph = $('[data-orchextph]', f), fail = $('[data-orchextfail]', f);
  if (ph) ph.hidden = false;
  if (fail) fail.hidden = true;
  if (ORCH_EXT_TIMER) clearTimeout(ORCH_EXT_TIMER);
  /* onload 在「被拒绝」时**不会**触发（X-Frame-Options 拒绝、连接失败、
     DNS 不通都是直接拒绝），所以「没等到 load」本身就是失败信号 ——
     必须有兜底计时器，否则失败态永远不显示。 */
  ORCH_EXT_TIMER = setTimeout(function () {
    if (!ORCH_EXT_LOADED) orchExtFail();
  }, ORCH_EXT_TIMEOUT);
}
function orchExtOk() {
  var f = $('#orchExt');
  if (!f) return;
  ORCH_EXT_LOADED = true;
  if (ORCH_EXT_TIMER) { clearTimeout(ORCH_EXT_TIMER); ORCH_EXT_TIMER = null; }
  var ph = $('[data-orchextph]', f), fail = $('[data-orchextfail]', f);
  if (ph) ph.hidden = true;
  if (fail) fail.hidden = true;
}
function orchExtFail() {
  var f = $('#orchExt');
  if (!f) return;
  var ph = $('[data-orchextph]', f), fail = $('[data-orchextfail]', f);
  if (fail) fail.hidden = false;
  if (ph) ph.hidden = true;
}

/* 「重新加载」：清掉 src 再写，逼浏览器重新请求 —— 直接改同一个 src
   值浏览器可能不再发请求。下一帧再写回去：同一 tick 内 remove→set
   浏览器可能不认这次变更。 */
function reloadOrchExt() {
  var el = $('[data-orchextel]');
  if (!el) return;
  orchExtLoading();
  el.removeAttribute('src');
  requestAnimationFrame(function () { el.setAttribute('src', ORCH_EXT_URL); });
}

function initOrchExt() {
  var el = $('[data-orchextel]');
  if (el) el.addEventListener('load', function () { orchExtOk(); });
  /* 初始态显式落一次：data-orchview 是「当前是哪个视图」的判据，
     若只在 setOrchExt() 里写，没进过全屏的编排页上它是 null ——
     「默认是站内画布」这件事就成了没有证据的假设。 */
  setOrchExt(false);
}

/* 工具配置抽屉：复用工具表单，但不给它开页面、不占标签 —— 它属于「选流程」这一步 */
function openToolDrawer(name) {
  var r = renderToolPage(name);
  var body = $('#toolBody'), t = $('#toolT'), tag = $('#toolTag');
  if (!body) return;
  PICK.tool = name;
  body.innerHTML = r.html;
  if (t) t.textContent = name;
  if (tag) tag.textContent = (r.cat ? r.cat + ' · ' : '') + 'SINGLE_TOOL';
  $('#backTool').hidden = false;
  $('#drawerTool').hidden = false;
  var d = $('#drawerTool'); if (d) d.scrollTop = 0;
  toolSummary($('#drawerTool'));
  renderOrchList();          /* 让工具库里刚点的那条亮起来 */
}

function closeToolDrawer() {
  var b = $('#backTool'), d = $('#drawerTool');
  if (b) b.hidden = true;
  if (d) d.hidden = true;
}

/* 运行历史抽屉：默认收起，把原来常驻的 300px 还给主流程 */
function toggleHist(force) {
  var d = $('#histDrawer'), b = $('#backHist'), btn = $('[data-hist-toggle]');
  if (!d) return;
  var want = typeof force === 'boolean' ? force : d.hidden;
  d.hidden = !want;
  if (b) b.hidden = !want;
  if (btn) btn.setAttribute('aria-expanded', want ? 'true' : 'false');
  if (want) {
    renderHist();            /* 打开时重算，避免读到过期条数 */
    var bd = $('#histBody'); if (bd) bd.scrollTop = 0;
  }
}

/* ============================================================
   智能体会话（v53 起：唯一宿主 = 主页「问答交互」卡 #wbAgentCard。
   右下角浮球 #agentFab + 浮窗 #agentWin 整体撤除 —— 浮球是浮窗唯一的入口，
   撤了它，窗就成了永远打不开的死面板。AGENT_LOG 与 agent* 问答逻辑不变。）
   ============================================================ */
var AGENT_LOG = [{ r: 'a', t: '你好，我是组学智能体。可以帮你：查看项目 / 流程 / 任务日志、按当前项目跑流程。会话按用户隔离，任何写操作都会先向你确认。', tm: '09:02' }];

function agentTime() {
  var d = new Date();
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}
function agentHTML(m) {
  return '<div class="msg msg--' + (m.r === 'u' ? 'u' : 'a') + '">' + m.t.replace(/\n/g, '<br>')
    + (m.tm ? '<div class="msg__t">' + m.tm + '</div>' : '') + '</div>';
}
/* 会话渲染容器：主页「问答交互」卡（v30；v53 起唯一宿主）。
   循环保留成「逐个容器刷」的形状 —— 哪天会话再开第二个宿主，
   把选择器加回名单就行，agentSay / renderAgent 一行都不用动。 */
function agentBoxes() {
  var list = [];
  ['#wbAgentBody'].forEach(function (sel) {
    var el = $(sel);
    if (el) list.push(el);
  });
  return list;
}
function renderAgent() {
  var html = AGENT_LOG.map(agentHTML).join('');
  agentBoxes().forEach(function (box) {
    box.innerHTML = html;
    box.scrollTop = box.scrollHeight;
  });
}
function agentSay(text, extra) {
  AGENT_LOG.push({ r: 'a', t: text, tm: agentTime() });
  renderAgent();
  if (extra) {
    /* 确认框必须挂到每个容器的最后一条消息上（agentBoxes 是名单不是单选，
       哪天加回第二个宿主，这里自动两处都挂 —— 漏一处就是假交互）。 */
    agentBoxes().forEach(function (box) {
      var last = box.lastElementChild;
      if (!last) return;
      var div = document.createElement('div');
      div.className = 'confirmbox';
      div.innerHTML = '<b>需要你确认一下再执行：</b><div class="mt-2">' + extra.body + '</div>'
        + '<div class="confirmbox__a">'
        + '<button class="btn btn--sm btn--primary" data-agent-ok="1">确认执行</button>'
        + '<button class="btn btn--sm" data-agent-no="1">取消</button></div>';
      last.appendChild(div);
      /* 确认框是 append 在 renderAgent 之后才进 DOM 的，
         上面那次 scrollTop 算不到它的高度，必须再滚一次，否则按钮落在可视区外 */
      box.scrollTop = box.scrollHeight;
    });
  }
}
function agentAsk(q) {
  AGENT_LOG.push({ r: 'u', t: esc(q).replace(/\n/g, '<br>'), tm: agentTime() });
  renderAgent();
  var conf = AGENT_CONFIRM[q];
  if (conf) {
    var body = conf.ask.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    AGENT_PENDING = q;
    agentSay('收到。这一步会写入运行记录，请确认后执行：', { body: body, q: q });
    return;
  }
  /* 值是函数的问答（项目 / 项目统计）要在提问这一刻求值，不能在建表时就求值：
     那样得到的只是页面加载瞬间的快照，新建一个项目后它还在说「12 个项目」。 */
  var pick = function (v) { return (typeof v === 'function') ? v() : v; };
  var a = pick(AGENT_QA[q]);
  if (!a) {
    var hit = Object.keys(AGENT_QA).filter(function (k) { return q.indexOf(k.slice(2)) >= 0 || q.indexOf(k) >= 0; })[0];
    a = pick(hit ? AGENT_QA[hit] : AGENT_FALLBACK);
  }
  setTimeout(function () { agentSay(a); }, 260);
}
var AGENT_PENDING = '';

/* 主页「问答交互」卡全屏：铺满视口，再点一次回到原来那一格。
   卡片是 .stack 里唯一的孩子，一旦 position:fixed 脱流，右侧栏高度归零 →
   整页往上跳一截。全屏层四周留 22px 视口边距，这个跳动正好在边距里看得见，
   所以先进全屏时用 min-height 把原来那一格占住，「缩回原位」才名副其实
   （否则缩回的是「重排之后的位置」）。 */
function toggleWbFull(force) {
  var c = $('#wbAgentCard');
  if (!c) return;
  var on = (typeof force === 'boolean') ? force : !c.classList.contains('is-full');
  if (on === c.classList.contains('is-full')) return;
  var holder = c.parentElement;
  if (on) {
    if (holder) holder.style.minHeight = Math.round(c.getBoundingClientRect().height) + 'px';
  } else if (holder) {
    holder.style.minHeight = '';
  }
  c.classList.toggle('is-full', on);
  document.body.classList.toggle('is-wbfull', on);
  /* 标注层让位（仅标注注入后的 index.html 存在该节点，src 里恒为 null）：
     Chromium 对「已打开的 popover」不响应 CSS display:none —— 只写样式压不住它，
     必须显式 hidePopover 让它退出 top layer；退出全屏后由标注框架的下一次
     层级巡检自行 showPopover 回来，这里不用替它恢复。 */
  var proto = document.getElementById('prototypeAnnotationRoot');
  if (proto && typeof proto.hidePopover === 'function') {
    try { proto.hidePopover(); } catch (e) { /* 未打开时调用会抛，忽略 */ }
  }
  var b = c.querySelector('[data-wb-full]');
  if (b) {
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', on ? '缩小回原位' : '全屏展开问答交互');
    b.innerHTML = ico(on ? 'compress' : 'expand');
  }
  var bd = $('#wbAgentBody'); if (bd) bd.scrollTop = bd.scrollHeight;
}

function agentSend(inId) {
  var i = $('#' + (inId || 'wbAgentIn'));
  if (!i) return;
  var q = i.value.trim();
  if (!q) { toast('先输入一句话，或点下方的快捷指令', 'warn'); return; }
  i.value = '';
  agentAsk(q);
}

document.addEventListener('keydown', function (e) {
  /* 血缘图节点画在 SVG 里，加了 tabindex 就进得了 Tab 序列 ——
     那么 Enter / Space 就必须真的能用，否则又是一个「够得着点不动」的假按钮。 */
  if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('[data-linnode]')) {
    e.preventDefault();
    linFocus(e.target.closest('[data-linnode]').getAttribute('data-linnode'));
    return;
  }
  if (e.key !== 'Enter') return;
  if (e.target.id === 'wbAgentIn') { e.preventDefault(); agentSend(e.target.id); return; }
});
document.addEventListener('input', function (e) {
  if (e.target.closest && e.target.closest('#drawerTool')) { toolSummary($('#drawerTool')); return; }
  if (e.target.id === 'orchSrch') { ORCHQ = e.target.value; renderOrchList(); return; }
  /* 样本查询：只过滤下方列表，不顺手切换选中样本 ——
     边打字边换样本会让血缘图一直闪，而且用户还没选定。 */
  if (e.target.id === 'sampQ') {
    SAMP_Q = e.target.value;
    SAMP_PAGE = 1;           /* 换关键词后停在第 3 页会看不到任何结果 */
    syncSampQuery();
    renderSampList();
    return;
  }
});

function agentConfirm(q) {
  var c = AGENT_CONFIRM[q];
  AGENT_LOG.push({ r: 'a', t: c ? c.done : '✅ 已执行完成。', tm: agentTime() });
  renderAgent();
  if (q === '跑 RNA-seq 流程') {
    toast('流程已提交运行，进度可在运行历史抽屉与流程列表里看到', 'ok');
    HIST.unshift({ ic: 'gear', n: '运行 #068291', m: '工作流 · 转录组 RNA-seq 分析流程 · 0/5 节点', s: 'run', p: 4, e: '剩余 42m', t: '2026-09-20 17:12:33', k: '刚提交' });
    HIST[1].s = 'ok'; HIST[1].p = null;
    renderHist();
    /* 跨面板联动：流程列表的状态徽章也从 HIST 反查，写完必须一起重绘 */
    renderOrchList();
  }
}

/* ============================================================
   样本档案（数据资产 › 样本档案 页的第一个 tab）
   ============================================================
   样本 ID 是这一页的主键：血缘节点与跨组学记录都挂在它下面。

   为什么这两个东西要放在一起：同一个样本源的血清与肝组织是两管不同的
   物理材料，血清跑蛋白组、肝组织跑基因组与转录组，三份数据落在不同项目、
   不同批次，文件层面没有任何共同字段 —— 能把它们认成同一个人的只有样本
   唯一 ID。血缘谱系在这里不只是谱系图，它标出了每条组学记录用的是哪一份
   衍生材料，这正是复核「这三份数据到底是不是同一个人」时要看的第一件事。

   四个样本覆盖队列里的四种样本形态（齐全 / ID 需映射 / 蛋白组缺失被排除 /
   两组学缺失被排除），数字与样本档案页同源：队列 75 例、三组学共同样本 71 例。
   组学范围也只放基因组 / 转录组 / 蛋白组三种 —— 多写两类组学会让
   「三组学共同样本 71 例」这句话在两页对不上。 */
/* 手写的只有这 4 例 —— 它们各自带一段「要看的故事」（齐全 / ID 映射 /
   血浆溶血 / 血清不足），血缘与资料都是量身写的。队列里剩下的 71 例由
   genSamp() 按模板生成：真实队列里绝大多数样本本来就是模板化的，
   手写 75 份只会让真正有内容的那 4 例淹没在重复里。 */
var SAMP_FULL = {
  S037: {
    cohort: 'TJ-TCM-2026', no: '第 37 例', subj: 'SUBJ-0371', dx: '肝细胞癌', src: '自创建',
    mat: '肝组织 + 外周血', t: '2026-03-14', store: '液氮 / -80 ℃',
    /* meta / docs 只补**不能从别处派生**的东西。样本 ID、样本源ID、
       采集物、采集时间、存放条件仍是上面的顶层字段；分装与衍生数取自 lin、
       所属项目取自 om —— 同一件事存两份，改数据时必然一处新一处旧。 */
    meta: {
      sex: '男', age: 58, stage: 'IIIa 期', site: '肝右叶 S6 段',
      vol: '组织 0.8 g + 全血 5 mL', proc: '液氮速冻 · EDTA 抗凝',
      loc: 'A 库 / 03 架 / 12 盒 / B4', inAt: '2026-03-14 11:05',
      /* 质控与下面的 docs、以及 om 里的缺失标记三者同源：
         S004 的血浆不合格解释了它为什么没有蛋白组，S052 的 RNA 降解解释了
         它为什么同时缺转录组与蛋白组。改这里就要回头核对另外两处。 */
      qc: { dnaC: '68.4 ng/µL', dnaP: '1.89（260/280）', rin: '8.7',
            plasma: '无明显溶血', verdict: '合格', st: 'ok' },
      consent: { st: '是', no: 'EC-TJ-2026-018', t: '2026-03-12',
                 use: '仅限本课题研究，不含商业用途' }
    },
    docs: [
      { k: '知情同意书', n: 'S037_ICF_签署版.pdf', sz: '412 KB', who: '张岚', t: '2026-03-12 09:30', note: '样本源签署原件扫描件' },
      { k: '伦理批件', n: 'EC-TJ-2026-018_批件.pdf', sz: '188 KB', who: '张岚', t: '2026-03-05 14:02', note: '覆盖本队列全部样本源' },
      { k: '病理报告', n: 'S037_病理报告.pdf', sz: '1.2 MB', who: '李劼', t: '2026-03-18 11:20', note: '肝细胞癌，中分化' },
      { k: '样本质检报告', n: 'S037_质检_DNA-RNA.pdf', sz: '264 KB', who: '王倩', t: '2026-03-20 16:45', note: '组织 DNA 与 RNA 均合格' },
      { k: '采集与处理记录', n: 'S037_采集处理记录.xlsx', sz: '38 KB', who: '张岚', t: '2026-03-14 11:05', note: '采集到液氮入库全过程' }
    ],
    lin: [
      { id: 'SUBJ-0371', lv: 0, k: 'subj', t: '样本源ID', s: 'SUBJ-0371 · 队列第 37 例' },
      { id: 'S037', lv: 1, k: 'self', t: 'S037', s: '肝组织 + 外周血', from: 'SUBJ-0371' },
      { id: 'S037-L', lv: 2, k: 'frac', t: 'S037-L', s: '肝组织块 · 液氮', from: 'S037', via: '分装' },
      { id: 'S037-B', lv: 2, k: 'frac', t: 'S037-B', s: '血浆分装 · 3 管', from: 'S037', via: '分装' },
      { id: 'S037-C', lv: 3, k: 'deriv', t: 'S037-C', s: '原代肝癌细胞 P2', from: 'S037-L', via: '消化培养' },
      { id: 'S037-O', lv: 3, k: 'deriv', t: 'S037-O', s: '类器官 P5', from: 'S037-L', via: '基质胶培养' },
      { id: 'S037-X', lv: 3, k: 'deriv', t: 'S037-X', s: 'PDX 模型 P2', from: 'S037-L', via: '皮下移植' }
    ],
    om: [
      { o: '基因组', ic: 'dna', n: 'S037-L', pj: 'P-2026-001', ref: 'hg38', f: 'somatic_variants.vcf.gz', sz: '412 MB', t: '2026-09-18 10:12' },
      { o: '转录组', ic: 'chart-column', n: 'S037-L', pj: 'P-2026-001', ref: 'hg38', f: 'counts.tsv', sz: '18 MB', t: '2026-09-18 10:14' },
      { o: '蛋白组', ic: 'flask-vial', n: 'S037-B', pj: 'P-2026-013', ref: '—', f: 'protein_dia.mzTab', sz: '96 MB', t: '2026-09-11 15:20' }
    ]
  },
  S068: {
    cohort: 'TJ-TCM-2026', no: '第 68 例', subj: 'SUBJ-0429', dx: '肝细胞癌', src: '自创建',
    mat: '肝组织 + 外周血', t: '2026-03-19', store: '液氮 / -80 ℃',
    meta: {
      sex: '女', age: 63, stage: 'II 期', site: '肝左叶 S3 段',
      vol: '组织 0.6 g + 全血 4 mL', proc: '液氮速冻 · EDTA 抗凝',
      loc: 'A 库 / 03 架 / 14 盒 / C2', inAt: '2026-03-19 09:50',
      qc: { dnaC: '71.2 ng/µL', dnaP: '1.91（260/280）', rin: '9.1',
            plasma: '无明显溶血', verdict: '合格', st: 'ok' },
      /* 同意书按**原始登记 ID S068A** 签署 —— 纸质件早于 ID 归并，
         两者对不上正是这一例要靠变更记录留痕的原因。 */
      consent: { st: '是', no: 'EC-TJ-2026-018', t: '2026-03-17',
                 use: '仅限本课题研究，不含商业用途' }
    },
    docs: [
      { k: '知情同意书', n: 'S068A_ICF_签署版.pdf', sz: '396 KB', who: '张岚', t: '2026-03-17 10:12', note: '按原始登记 ID S068A 签署' },
      { k: '伦理批件', n: 'EC-TJ-2026-018_批件.pdf', sz: '188 KB', who: '张岚', t: '2026-03-05 14:02', note: '覆盖本队列全部样本源' },
      { k: '病理报告', n: 'S068_病理报告.pdf', sz: '1.1 MB', who: '李劼', t: '2026-03-22 15:40', note: '肝细胞癌，低分化' },
      { k: '样本标识变更记录', n: 'S068_ID映射说明.pdf', sz: '96 KB', who: '王倩', t: '2026-03-19 09:05', note: 'S068A → S068 归并依据与校验位核对记录' }
    ],
    /* 这一条的看点全在血缘上：原始登记 ID 少写一位校验位，靠 ID 映射归并到
       S068 之后，两路组学才认回同一个人 —— 唯一 ID 的价值在这里最直白。 */
    lin: [
      { id: 'SUBJ-0429', lv: 0, k: 'subj', t: '样本源ID', s: 'SUBJ-0429 · 队列第 68 例' },
      { id: 'S068A', lv: 1, k: 'alias', t: 'S068A', s: '原始登记 ID · 采集物', from: 'SUBJ-0429' },
      { id: 'S068', lv: 2, k: 'self', t: 'S068', s: '归并后唯一 ID', from: 'S068A', via: 'ID 映射' },
      { id: 'S068-L', lv: 3, k: 'frac', t: 'S068-L', s: '肝组织块 · 液氮', from: 'S068', via: '分装' },
      { id: 'S068-B', lv: 3, k: 'frac', t: 'S068-B', s: '血浆分装 · 2 管', from: 'S068', via: '分装' }
    ],
    om: [
      { o: '基因组', ic: 'dna', n: 'S068-L', pj: 'P-2026-001', ref: 'hg38', f: 'somatic_variants.vcf.gz', sz: '398 MB', t: '2026-09-18 10:12' },
      { o: '转录组', ic: 'chart-column', n: 'S068-L', pj: 'P-2026-001', ref: 'hg38', f: 'counts.tsv', sz: '17 MB', t: '2026-09-18 10:14' },
      { o: '蛋白组', ic: 'flask-vial', n: 'S068-B', pj: 'P-2026-013', ref: '—', f: 'protein_dia.mzTab', sz: '88 MB', t: '2026-09-11 15:22' }
    ]
  },
  S004: {
    cohort: 'TJ-TCM-2026', no: '第 4 例', subj: 'SUBJ-0031', dx: '肝细胞癌', src: '自创建',
    mat: '肝组织 + 外周血', t: '2026-03-11', store: '液氮 / -80 ℃',
    meta: {
      sex: '男', age: 55, stage: 'IIIb 期', site: '肝右叶 S7 段',
      vol: '组织 0.7 g + 全血 3 mL', proc: '液氮速冻 · EDTA 抗凝',
      loc: 'A 库 / 02 架 / 08 盒 / A1', inAt: '2026-03-11 15:30',
      /* 血浆溶血 → 蛋白组建库未通过，这就是 om 里那条「血浆分装缺失 78%」的
         原始出处。信息、资料、组学缺失标记三处必须讲同一件事。 */
      qc: { dnaC: '62.1 ng/µL', dnaP: '1.87（260/280）', rin: '7.9',
            plasma: '中度溶血 · 游离血红蛋白 2.4 g/L',
            /* st 必须是 danger：这一例的蛋白组真的没产出来，和「缺蛋白组那 4 例」
               是同一批。标 warn 的话，质控筛选就筛不出它，因果链断在这里。 */
            verdict: '组织合格 · 血浆不合格', st: 'danger' },
      consent: { st: '是', no: 'EC-TJ-2026-018', t: '2026-03-09',
                 use: '仅限本课题研究，不含商业用途' }
    },
    docs: [
      { k: '知情同意书', n: 'S004_ICF_签署版.pdf', sz: '404 KB', who: '张岚', t: '2026-03-09 16:22', note: '样本源签署原件扫描件' },
      { k: '病理报告', n: 'S004_病理报告.pdf', sz: '1.3 MB', who: '李劼', t: '2026-03-16 10:05', note: '肝细胞癌，中低分化' },
      { k: '样本质检报告', n: 'S004_质检_血浆不合格.pdf', sz: '248 KB', who: '王倩', t: '2026-03-18 09:40', note: '血浆中度溶血，蛋白组建库未通过；组织 DNA / RNA 合格' }
    ],
    lin: [
      { id: 'SUBJ-0031', lv: 0, k: 'subj', t: '样本源ID', s: 'SUBJ-0031 · 队列第 4 例' },
      { id: 'S004', lv: 1, k: 'self', t: 'S004', s: '肝组织 + 外周血', from: 'SUBJ-0031' },
      { id: 'S004-L', lv: 2, k: 'frac', t: 'S004-L', s: '肝组织块 · 液氮', from: 'S004', via: '分装' }
    ],
    om: [
      { o: '基因组', ic: 'dna', n: 'S004-L', pj: 'P-2026-001', ref: 'hg38', f: 'somatic_variants.vcf.gz', sz: '377 MB', t: '2026-09-18 10:12' },
      { o: '转录组', ic: 'chart-column', n: 'S004-L', pj: 'P-2026-001', ref: 'hg38', f: 'counts.tsv', sz: '16 MB', t: '2026-09-18 10:14' },
      { o: '蛋白组', ic: 'flask-vial', n: '', miss: '血浆分装缺失 78%，已在「样本对齐」页排除本样本' }
    ]
  },
  S052: {
    cohort: 'TJ-TCM-2026', no: '第 52 例', subj: 'SUBJ-0164', dx: '肝细胞癌', src: '自创建',
    mat: '肝组织 + 外周血', t: '2026-03-21', store: '液氮 / -80 ℃',
    meta: {
      sex: '女', age: 49, stage: 'IV 期', site: '肝右叶 + 门静脉癌栓',
      vol: '组织 0.4 g + 全血 2 mL', proc: '液氮速冻 · EDTA 抗凝',
      loc: 'A 库 / 02 架 / 11 盒 / D3', inAt: '2026-03-21 10:40',
      /* 血清不足是蛋白组缺失的唯一原因。队列口径是「转录组覆盖 75 例」，
         所以这一例的转录组必须真的产出了 —— 缺两路会和队列口径对不上。 */
      qc: { dnaC: '58.6 ng/µL', dnaP: '1.85（260/280）', rin: '8.1',
            plasma: '血清分离量 0.3 mL，低于 1.0 mL 建库下限',
            verdict: '组织合格 · 血清不合格', st: 'danger' },
      consent: { st: '是', no: 'EC-TJ-2026-018', t: '2026-03-20',
                 use: '仅限本课题研究，不含商业用途' }
    },
    docs: [
      { k: '知情同意书', n: 'S052_ICF_签署版.pdf', sz: '408 KB', who: '张岚', t: '2026-03-20 17:05', note: '样本源签署原件扫描件' },
      { k: '样本质检报告', n: 'S052_质检_血清不足.pdf', sz: '232 KB', who: '王倩', t: '2026-03-22 14:30', note: '组织 DNA / RNA 合格；血清 0.3 mL 不足建库' },
      { k: '采集与处理记录', n: 'S052_采集处理记录.xlsx', sz: '34 KB', who: '张岚', t: '2026-03-21 10:40', note: '采集到液氮入库全过程' }
    ],
    lin: [
      { id: 'SUBJ-0164', lv: 0, k: 'subj', t: '样本源ID', s: 'SUBJ-0164 · 队列第 52 例' },
      { id: 'S052', lv: 1, k: 'self', t: 'S052', s: '肝组织 + 外周血', from: 'SUBJ-0164' },
      { id: 'S052-L', lv: 2, k: 'frac', t: 'S052-L', s: '肝组织块 · 液氮', from: 'S052', via: '分装' }
    ],
    om: [
      { o: '基因组', ic: 'dna', n: 'S052-L', pj: 'P-2026-001', ref: 'hg38', f: 'somatic_variants.vcf.gz', sz: '364 MB', t: '2026-09-18 10:12' },
      { o: '转录组', ic: 'chart-column', n: 'S052-L', pj: 'P-2026-001', ref: 'hg38', f: 'counts.tsv', sz: '15 MB', t: '2026-09-18 10:14' },
      { o: '蛋白组', ic: 'flask-vial', n: '', miss: '未产出 · 血清分离量 0.3 mL 低于建库下限，已在「样本对齐」页排除本样本' }
    ]
  }
};

/* ============================================================
   队列：其余 71 例按模板生成（4 例手写 + 71 例生成 = 75 例）
   ============================================================
   口径与样本档案页同源：队列 75 例 · 基因组 75 · 转录组 75 ·
   蛋白组 71 · 共同样本 71 —— 也就是**恰好 4 例缺蛋白组**，其余三路齐全。
   分布写死成数组而不是真随机：随机会让每次刷新列表顺序都变，验证脚本
   没法断言「71 / 71」这种数，也没法断言某一行到底写着什么。 */

var QUEUE_N = 75;

var MISS_PROT = ['S004', 'S052', 'S021', 'S063'];  /* 缺蛋白组的 4 例，同时是质控不合格的 4 例 */
var QC_WARN   = ['S009', 'S017', 'S026', 'S033', 'S041', 'S055', 'S074'];
var CONSENT_PEND  = ['S012', 'S048'];
var CONSENT_REVOK = ['S031'];
var DX_ICC = ['S007', 'S015', 'S023', 'S038', 'S046', 'S059', 'S066', 'S072'];  /* 肝内胆管癌 */
var DX_MIX = ['S011', 'S029', 'S045', 'S061'];                                  /* 混合型肝癌 */
var DX_CIR = ['S005', 'S020', 'S034', 'S050', 'S070'];                          /* 肝硬化对照 */

/* 确定性伪随机（LCG）：seed 固定 → 序列固定 */
function _lcq(seed) {
  var s = seed >>> 0;
  return function (n) { s = (s * 1664525 + 1013904223) >>> 0; return s % n; };
}
function p2(n) { return (n < 10 ? '0' : '') + n; }
function p3(n) { return (n < 10 ? '00' : n < 100 ? '0' : '') + n; }
/* 采集期自 2026-03-09 起算；跨度只到 4 月，按月 30 天简算就够，不必引日期库 */
function cdate(n) { var m = 3, d = 9 + n; while (d > 30) { m++; d -= 30; } return '2026-' + p2(m) + '-' + p2(d); }

function genSamp(i) {
  var id = 'S' + p3(i), r = _lcq(i * 7919 + 13);
  var sex = r(2) ? '男' : '女', age = 41 + r(39);
  var dx = DX_ICC.indexOf(id) >= 0 ? '肝内胆管癌'
         : DX_MIX.indexOf(id) >= 0 ? '混合型肝细胞-胆管癌'
         : DX_CIR.indexOf(id) >= 0 ? '肝硬化（对照）' : '肝细胞癌';
  var stage = dx === '肝硬化（对照）' ? (r(2) ? 'Child-Pugh A' : 'Child-Pugh B')
            : ['I 期', 'II 期', 'IIIa 期', 'IIIb 期', 'IV 期'][r(5)];
  var site = ['肝右叶 S6 段', '肝右叶 S7 段', '肝左叶 S3 段', '肝左叶 S2 段',
              '肝右叶 S5 段', '肝尾状叶 S1 段', '肝右叶 S8 段'][r(7)];
  var day = (i - 1) % 40, t = cdate(day), hm = p2(9 + r(8)) + ':' + p2(r(60));
  var loc = 'A 库 / 0' + (2 + r(3)) + ' 架 / ' + p2(1 + r(40)) + ' 盒 / '
          + 'ABCD'[r(4)] + (1 + r(8));
  var vol = '组织 0.' + (4 + r(5)) + ' g + 全血 ' + (3 + r(3)) + ' mL';
  var subj = 'SUBJ-' + (1000 + (i * 137) % 8999);

  /* 质控：4 例不合格（正是缺蛋白组那 4 例，因果成对）、7 例单项偏离、其余合格 */
  var bad = MISS_PROT.indexOf(id) >= 0, warn = QC_WARN.indexOf(id) >= 0;
  var st = bad ? 'danger' : warn ? 'warn' : 'ok';
  var qc = {
    dnaC: (54 + r(28)) + '.' + r(10) + ' ng/µL',
    dnaP: '1.8' + r(10) + '（260/280）',
    rin: (bad ? 7 : 8) + '.' + r(10),
    plasma: bad ? (r(2) ? '中度溶血 · 游离血红蛋白 2.' + r(9) + ' g/L'
                        : '血清分离量 0.' + (2 + r(4)) + ' mL，低于 1.0 mL 建库下限')
                : warn ? '轻度溶血 · 游离血红蛋白 0.' + (5 + r(4)) + ' g/L' : '无明显溶血',
    verdict: bad ? '组织合格 · 血浆不合格' : warn ? '基本合格 · 血浆轻度溶血' : '合格',
    st: st
  };

  var cst = CONSENT_REVOK.indexOf(id) >= 0 ? '未知'
          : CONSENT_PEND.indexOf(id) >= 0 ? '否' : '是';
  var consent = { st: cst, no: 'EC-TJ-2026-018', t: cdate(Math.max(0, day - 2)),
                  use: '仅限本课题研究，不含商业用途' };

  var docs = [
    { k: '知情同意书', n: id + '_ICF_签署版.pdf', sz: (380 + r(60)) + ' KB',
      who: '张岚', t: consent.t + ' ' + p2(9 + r(8)) + ':' + p2(r(60)), note: '样本源签署原件扫描件' },
    { k: '病理报告', n: id + '_病理报告.pdf', sz: '1.' + r(9) + ' MB', who: '李劼',
      t: cdate(Math.min(39, day + 6)) + ' ' + p2(9 + r(8)) + ':' + p2(r(60)),
      note: dx + '，' + ['高分化', '中分化', '中低分化', '低分化'][r(4)] },
    { k: '样本质检报告', n: id + '_质检.pdf', sz: (220 + r(80)) + ' KB', who: '王倩',
      t: cdate(Math.min(39, day + 8)) + ' ' + p2(9 + r(8)) + ':' + p2(r(60)),
      note: qc.verdict + '；组织 DNA / RNA 均合格' }
  ];
  if (r(2)) docs.push({ k: '采集与处理记录', n: id + '_采集处理记录.xlsx',
    sz: (32 + r(12)) + ' KB', who: '张岚', t: t + ' ' + hm, note: '采集到液氮入库全过程' });
  /* 伦理批件是队列级文件，只需归档一次 —— 不是每例都要挂一份 */
  if (r(4) === 0) docs.push({ k: '伦理批件', n: 'EC-TJ-2026-018_批件.pdf',
    sz: '188 KB', who: '张岚', t: '2026-03-05 14:02', note: '覆盖本队列全部样本源' });
  if (r(5) === 0) docs.push({ k: '出库与使用记录', n: id + '_出库记录.xlsx',
    sz: (24 + r(20)) + ' KB', who: '王倩', t: cdate(Math.min(39, day + 20)) + ' ' + hm,
    note: '已出库 ' + (1 + r(3)) + ' 次，按审批单执行' });

  var lin = [
    { id: subj, lv: 0, k: 'subj', t: '样本源ID', s: subj + ' · 队列第 ' + i + ' 例' },
    { id: id, lv: 1, k: 'self', t: id, s: '肝组织 + 外周血', from: subj },
    { id: id + '-L', lv: 2, k: 'frac', t: id + '-L', s: '肝组织块 · 液氮', from: id, via: '分装' },
    { id: id + '-B', lv: 2, k: 'frac', t: id + '-B', s: '血浆分装 · ' + (2 + r(3)) + ' 管', from: id, via: '分装' }
  ];
  if (r(5) === 0) lin.push({ id: id + '-O', lv: 3, k: 'deriv', t: id + '-O',
    s: '类器官 P' + (2 + r(5)), from: id + '-L', via: '基质胶培养' });
  if (r(7) === 0) lin.push({ id: id + '-C', lv: 3, k: 'deriv', t: id + '-C',
    s: '原代细胞 P' + (1 + r(4)), from: id + '-L', via: '消化培养' });

  var om = [
    { o: '基因组', ic: 'dna', n: id + '-L', pj: 'P-2026-001', ref: 'hg38',
      f: 'somatic_variants.vcf.gz', sz: (320 + r(160)) + ' MB', t: '2026-09-18 10:12' },
    { o: '转录组', ic: 'chart-column', n: id + '-L', pj: 'P-2026-001', ref: 'hg38',
      f: 'counts.tsv', sz: (13 + r(9)) + ' MB', t: '2026-09-18 10:14' }
  ];
  if (bad) om.push({ o: '蛋白组', ic: 'flask-vial', n: '',
    miss: '未产出 · ' + qc.plasma + '，已在「样本对齐」页排除本样本' });
  else om.push({ o: '蛋白组', ic: 'flask-vial', n: id + '-B', pj: 'P-2026-013', ref: '—',
    f: 'protein_dia.mzTab', sz: (78 + r(40)) + ' MB', t: '2026-09-11 15:2' + r(9) });

  return {
    cohort: 'TJ-TCM-2026', no: '第 ' + i + ' 例', subj: subj, dx: dx, src: '系统',
    mat: '肝组织 + 外周血', t: t, store: '液氮 / -80 ℃',
    meta: { sex: sex, age: age, stage: stage, site: site, vol: vol,
            proc: '液氮速冻 · EDTA 抗凝', loc: loc, inAt: t + ' ' + hm,
            qc: qc, consent: consent },
    docs: docs, lin: lin, om: om
  };
}

var SAMP_ARCHIVE = (function () {
  var out = {}, i, id;
  Object.keys(SAMP_FULL).forEach(function (k) { out[k] = SAMP_FULL[k]; });
  for (i = 1; i <= QUEUE_N; i++) {
    id = 'S' + p3(i);
    if (!out[id]) out[id] = genSamp(i);
  }
  return out;
})();

/* 资料类型做成固定几类，不做自由文本：类型决定归档后归到哪一格合规目录，
   自由填写会让「知情同意书」出现七八种写法，检索不到就等于没归档。 */
var DOC_KINDS = ['知情同意书', '伦理批件', '病理报告', '样本质检报告',
                 '采集与处理记录', '样本标识变更记录', '出库与使用记录', '其他'];

var SAMP_PEND = [];          /* 归档弹窗里待提交的文件（可一次多个）：{ k, n, sz, note, f } */

var SAMP_CUR = 'S037';       /* 当前选中的样本 ID */
var SAMP_Q = '';             /* 搜索关键词（只影响候选 chips） */
var LIN_FOCUS = '';          /* 血缘图上被点中的节点：'' = 不筛选 */
var LIN_OPEN = true;         /* 血缘谱系卡是否展开。是全局 UI 偏好而非样本属性 ——
                                用户收起它就是为了给跨组学表腾地方，切样本再弹开等于白收 */

function sampById(id) { return SAMP_ARCHIVE[id] || null; }
/* 按 ID 排序返回：SAMP_ARCHIVE 的键序是「4 例手写 + 71 例生成」，
   不排序的话列表第一行会是 S037 而不是 S001。 */
function sampIds() { return Object.keys(SAMP_ARCHIVE).sort(); }

/* 搜索命中：样本 ID / 样本源ID / 疾病 / 采集物 / 队列 都能查。
   带「例」的编号（第 37 例）也认，评审习惯照着文档念。 */
function sampMatch(q) {
  q = String(q == null ? '' : q).trim().toLowerCase();
  if (!q) return sampIds();
  return sampIds().filter(function (id) {
    var a = SAMP_ARCHIVE[id];
    var blob = [id, a.subj, a.no, a.dx, a.mat, a.cohort].join(' ').toLowerCase();
    return blob.indexOf(q) > -1;
  });
}

/* 某个血缘节点贡献了几路组学。节点上的徽标、以及筛选都读它 ——
   不另存一份计数，否则改数据时两处必然漂。 */
function linOm(a, id) {
  return a.om.filter(function (x) { return !x.miss && x.n === id; }).length;
}
function sampDeriv(a) {
  return a.lin.filter(function (n) { return n.k === 'deriv'; }).length;
}

/* tone 是可选的血统色相键（id / mat / derive / om），只有「特定样本条」在传。
   底色与文字色都写在 CSS 的 #sampKpis 里 —— 这里只负责把键带上，别把色号
   搬进 JS：两个地方各写一半，改一处就会出现「卡是新的、字还是旧的」。 */
function mcellOf(l, v, u, f, tone) {
  return '<div class="mcell' + (tone ? ' mcell--' + tone : '') + '">'
    + '<div class="mcell__l">' + l + '</div>'
    + '<div class="mcell__v">' + v + (u ? '<span class="mcell__u">' + u + '</span>' : '') + '</div>'
    + '<div class="mcell__f">' + esc(f) + '</div></div>';
}

/* ---------- v46：页内 tab 已撤 ----------
   原来这里是 syncArchTab()：在「样本档案 / 基因档案」两个页签之间切 .is-on，
   顺带按 data-tabonly 显隐页头按钮（样本 tab 下藏「重建档案」）。
   「基因档案」整块撤掉后，页面只剩一个面板：
     · 没有可切的页签      → 切 tab 的逻辑与 ARCH_TAB 状态一并删
     · 页头按钮不再分派    → data-tabonly 属性与 hidden 分派一并删
   `window.__sampTab` 探针同时撤（验证脚本里改从列表行 / 抽屉驱动）。
   注意 **不要**把这层「面板容器」也删掉：它现在叫 #sampPanel，脚本与验证按它定位。 */

/* ---------- 样本详情抽屉 ----------
   列表留在页面上负责「挑哪一例」，选中后的五块（指标 / 信息 / 血缘 / 跨组学 /
   资料）整体住在右侧抽屉里。这样翻到第 40 例时，不用滚回列表才想起自己在看谁。

   刻意**不带遮罩**：档案的用法是边翻边看，加了遮罩就得多一步「关掉 → 再点」。
   抽屉打开时 .content 右内缩让出宽度，列表因此仍完整可见、仍能点行 ——
   点另一行不重开抽屉，只把里面的内容换成那一例。

   hidden 与 .is-open 是两件事：hidden 管「在不在」，.is-open 管「滑没滑到位」。
   关闭要等滑出动画放完再真正撤下，直接 hidden=true 会让抽屉「啪」地消失。 */
var SAMP_DRW_T = 0;
/* 「开着」= 在 DOM 里**且**滑到位。只查 hidden 会把「正在滑出」也算成开着：
   关闭是「先摘 is-open 播动画，300ms 后才置 hidden」，
   而打开时若只看 hidden 就提前返回，is-open 再无机会加回来 ——
   留下一个「在屏幕外、却没 hidden」的幽灵抽屉（量得到高度、点不到任何东西）。
   表现就是切 tab 后 300ms 内又点回列表、抽屉再也出不来。 */
function sampDrawerOpen() {
  var d = $('#drawerSamp');
  return !!d && !d.hidden && d.classList.contains('is-open');
}

function openSampDrawer() {
  var d = $('#drawerSamp'); if (!d) return;
  clearTimeout(SAMP_DRW_T);                  /* 撤销「关到一半」的收尾，否则 300ms 后它会把抽屉撤下 */
  var was = !d.hidden;
  if (was && d.classList.contains('is-open')) return;   /* 已开且已就位：内容由 sampPick 重渲染，不重播动画 */
  d.hidden = false;
  document.body.classList.add('is-sampdrawer');
  /* 必须**开了之后**再排血缘：抽屉收起时 #linBox 宽是 0，那时算出来的布局
     用的是回退值，滑出来就对不上容器宽（会被缩放）。 */
  if (!was) renderLineage();
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { d.classList.remove('is-open'); d.classList.add('is-open'); });
  });
}

function closeSampDrawer() {
  var d = $('#drawerSamp'); if (!d || d.hidden) return;
  d.classList.remove('is-open');
  document.body.classList.remove('is-sampdrawer');
  clearTimeout(SAMP_DRW_T);
  SAMP_DRW_T = setTimeout(function () { d.hidden = true; }, 300);
}

/* 抽屉头跟着当前样本走：ID + 一句「这是什么样本」。抽屉是可以一直开着的，
   切样本时头上的 ID 若不跟着变，就会和内容对不上。 */
function syncSampDrawerHead() {
  var a = sampById(SAMP_CUR);
  var id = $('#sampDrawerId'), sub = $('#sampDrawerSub');
  if (id) id.textContent = SAMP_CUR;
  if (sub) {
    sub.textContent = a ? a.dx + ' · ' + esc(a.mat) + ' · ' + a.om.length + ' 路组学' : '—';
    sub.title = sub.textContent;
  }
}

/* ---------- 选中样本 ----------
   silent = true 时不报「已切换」：登记完新样本会紧接着弹两条 toast，
   一条「已登记」一条「已切换」，叠在一起只会互相挡。 */
function sampPick(id, silent) {
  if (!SAMP_ARCHIVE[id]) { toast('没有找到样本 ' + id + '，请换个 ID 或关键词试试'); return; }
  /* 同一例**且抽屉开着**才什么都不做。抽屉被关掉了再点同一行，是「想再看一次」，
     不能因为「已经是当前样本」就把这次点击吞掉。 */
  if (id === SAMP_CUR && sampDrawerOpen()) return;
  var same = id === SAMP_CUR;
  SAMP_CUR = id;
  sampLocate(id);
  LIN_FOCUS = '';            /* 上一个样本的节点 ID 对不上新样本，必须清掉 */
  syncSampQuery();
  renderSampList();          /* 列表要把当前行标出来，否则点了行看不出选中了谁 */
  renderSampKpis();
  renderSampInfo();
  renderLineage();
  renderOmics();
  renderSampDocs();
  syncSampDrawerHead();
  openSampDrawer();          /* 选中即滑出：这是本页唯一的「看这一例」入口 */
  if (!silent && !same) toast('已切换到样本 ' + id + '（' + SAMP_ARCHIVE[id].mat + '）', 'ok');
}

/* ---------- 血缘节点筛选 ---------- */
function linFocus(id) {
  LIN_FOCUS = LIN_FOCUS === id ? '' : (id || '');
  renderLineage();
  renderOmics();
}

/* ---------- 查询联动 ----------
   候选 chips 已撤（v27）：12 个 chip + 「还有 63 例」的罗列与下方列表完全重复，
   选中样本的唯一入口就是列表行。v46 去掉页签后，这里只剩一件必须跟着查询走的事：
   无命中时的空态提示（原来还要把总例数写到页签上，页签撤了 —— 计数现在只由
   列表卡的 meta 一处表达，两处写同一个数字本来就是重复）。 */
function syncSampQuery() {
  var emp = $('#sampEmpty');
  if (emp) emp.hidden = sampMatch(SAMP_Q).length > 0;
}

/* ---------- 样本列表：筛选 / 排序 / 分页 ----------
   75 例不可能一屏铺完，也不该一屏铺完：列表的价值是「按维度筛出那一批」，
   所以筛选、排序、分页三件事都得真能用 —— 翻页按钮置灰而列表纹丝不动，
   是评审一眼就能看出来的假。 */
var SAMP_PAGE_N = 15;
var SAMP_FLT  = { dx: '', qc: '', om: '', cs: '' };
var SAMP_SORT = { k: 'id', dir: 1 };
var SAMP_PAGE = 1;
var SAMP_LOCATED = false;   /* 首屏是否已把列表定位到当前选中项（只做一次，
                               否则用户翻到第 5 页、切个 tab 回来就被拽回去了） */

/* 当前选中项必须看得见：S037 在第 3 页，不翻过去的话列表上没有任何标记，
   用户会以为没切成功。点列表行时目标本就在当前页，等于不动。 */
function sampLocate(id) {
  var at = sampSorted(sampRows()).indexOf(id);
  if (at >= 0) SAMP_PAGE = Math.floor(at / SAMP_PAGE_N) + 1;
}

function sampOmDone(a) { return a.om.filter(function (x) { return !x.miss; }).length; }
function qcRank(a) {
  var s = ((a.meta || {}).qc || {}).st || 'ok';
  return s === 'danger' ? 0 : s === 'warn' ? 1 : 2;   /* 不合格排最前，好找 */
}

/* 筛选：顶部搜索框 + 四个下拉。关键词存 SAMP_Q，列表的筛选 / 排序 / 分页共用这一份 ——
   搜索框改了列表就跟着变，不会出现「搜了但列表没动」的割裂。 */
function sampRows() {
  var q = (SAMP_Q || '').trim().toLowerCase();
  return sampIds().filter(function (id) {
    var a = SAMP_ARCHIVE[id], m = a.meta || {};
    if (SAMP_FLT.dx && a.dx !== SAMP_FLT.dx) return false;
    if (SAMP_FLT.qc && (((m.qc || {}).st) || 'ok') !== SAMP_FLT.qc) return false;
    if (SAMP_FLT.cs && (((m.consent || {}).st) || '') !== SAMP_FLT.cs) return false;
    if (SAMP_FLT.om && String(sampOmDone(a)) !== SAMP_FLT.om) return false;
    if (!q) return true;
    return (id + ' ' + a.subj + ' ' + a.dx + ' ' + a.no + ' '
            + (m.site || '') + ' ' + (m.loc || '')).toLowerCase().indexOf(q) >= 0;
  });
}

function sampSorted(ids) {
  var k = SAMP_SORT.k, d = SAMP_SORT.dir;
  return ids.slice().sort(function (x, y) {
    var a = SAMP_ARCHIVE[x], b = SAMP_ARCHIVE[y], va, vb;
    if (k === 't') { va = a.t; vb = b.t; }
    else if (k === 'qc') { va = qcRank(a); vb = qcRank(b); }
    else if (k === 'docs') { va = a.docs.length; vb = b.docs.length; }
    else return d * (x < y ? -1 : x > y ? 1 : 0);
    /* 次级键恒为 ID：同值时顺序才可复现，验证脚本才有稳定的东西可断言 */
    if (va === vb) return x < y ? -1 : x > y ? 1 : 0;
    return d * (va < vb ? -1 : 1);
  });
}

function sampSort(k) {
  if (SAMP_SORT.k === k) SAMP_SORT.dir = -SAMP_SORT.dir;
  else { SAMP_SORT.k = k; SAMP_SORT.dir = 1; }
  renderSampList();
}

function sampPage(v) {
  var ids = sampSorted(sampRows());
  var pages = Math.max(1, Math.ceil(ids.length / SAMP_PAGE_N));
  if (v === 'prev') SAMP_PAGE = Math.max(1, SAMP_PAGE - 1);
  else if (v === 'next') SAMP_PAGE = Math.min(pages, SAMP_PAGE + 1);
  else SAMP_PAGE = Math.min(pages, Math.max(1, parseInt(v, 10) || 1));
  renderSampList();
}

function sampFltReset() {
  SAMP_FLT = { dx: '', qc: '', om: '', cs: '' };
  SAMP_Q = '';
  SAMP_PAGE = 1;
  var qi = $('#sampQ'); if (qi) qi.value = '';
  ['fltDx', 'fltQc', 'fltOm', 'fltCs'].forEach(function (i) {
    var el = $('#' + i); if (el) el.value = '';
  });
  syncSampQuery();
  /* 重置后把当前选中项带回视野：候选 chips 已撤（v27），列表行是选中态的
     唯一载体 —— 固定回第 1 页会让第 3 页的 S037 高亮凭空消失，
     看着就像「没选中任何样本」（chips 时代被「当前项置顶」遮住了）。 */
  sampLocate(SAMP_CUR);
  renderSampList();
}

/* 疾病选项从数据现算，不写死：加一个病种时下拉自己长出来。
   写死的话新病种会出现在列表里却筛不到 —— 又是同一事实两份维护。 */
function fillSampFilters() {
  var sel = $('#fltDx'); if (!sel) return;
  var set = {};
  sampIds().forEach(function (id) { set[SAMP_ARCHIVE[id].dx] = 1; });
  sel.innerHTML = '<option value="">全部</option>'
    + Object.keys(set).sort().map(function (d) { return '<option>' + esc(d) + '</option>'; }).join('');
}

/* 列表里用短结论 + title 展开全文：verdict 原文（组织合格 · 血浆不合格）
   放在 11 列的窄表里会把整行撑开。 */
function qcTag(qc) {
  var st = qc.st || 'ok';
  var cls = st === 'danger' ? 'tag--danger' : st === 'warn' ? 'tag--warn' : 'tag--ok';
  var s = st === 'danger' ? '不合格' : st === 'warn' ? '部分合格' : '合格';
  return '<span class="tag ' + cls + '" title="' + esc(qc.verdict || s) + '">' + s + '</span>';
}
function csTag(cs) {
  var s = cs.st || '';
  var cls = s === '是' ? 'tag--ok' : s === '否' ? 'tag--warn' : s === '未知' ? 'tag--danger' : '';
  return '<span class="tag ' + cls + '">' + esc(s || '—') + '</span>';
}
/* 组学覆盖画成三个字标而不是进度条：这一列要回答「缺哪一路」，
   不是「完成了百分之多少」。 */
function omTags(a) {
  var done = {};
  a.om.forEach(function (x) { if (!x.miss) done[x.o] = 1; });
  return ['基因组', '转录组', '蛋白组'].map(function (o) {
    var on = !!done[o];
    return '<span class="omtag' + (on ? ' is-on' : '') + '" role="img"'
      + ' aria-label="' + o + (on ? ' 已产出' : ' 未产出') + '">' + o.charAt(0) + '</span>';
  }).join('');
}

function renderSampList() {
  var box = $('#sampTbody'); if (!box) return;
  var ids = sampSorted(sampRows());
  var pages = Math.max(1, Math.ceil(ids.length / SAMP_PAGE_N));
  if (SAMP_PAGE > pages) SAMP_PAGE = pages;
  var from = (SAMP_PAGE - 1) * SAMP_PAGE_N;
  var rows = ids.slice(from, from + SAMP_PAGE_N);

  box.innerHTML = rows.map(function (id) {
    var a = SAMP_ARCHIVE[id], m = a.meta || {};
    return '<tr class="samptr' + (id === SAMP_CUR ? ' is-on' : '') + '" data-samp-pick="' + id + '">'
      + '<td class="nw"><button type="button" class="sampid" data-samp-pick="' + id + '">' + id + '</button></td>'
      + '<td class="nw num">' + esc(a.subj) + '</td>'
      + '<td class="nw">' + esc(a.src || '系统') + '</td>'
      + '<td class="nw num">' + esc(a.t) + '</td>'
      + '<td class="nw num">' + esc(m.loc || '—') + '</td>'
      + '<td>' + qcTag(m.qc || {}) + '</td>'
      + '<td class="nw">' + omTags(a) + '</td>'
      + '<td class="nw">' + csTag(m.consent || {}) + '</td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="8" class="tempty">没有符合当前筛选条件的样本</td></tr>';

  var pg = $('#sampPager');
  if (pg) {
    var bs = '', i;
    bs += '<button type="button" class="btn btn--sm btn--quiet"' + (SAMP_PAGE <= 1 ? ' disabled' : '')
        + ' data-samp-page="prev">上一页</button>';
    for (i = 1; i <= pages; i++) {
      bs += '<button type="button" class="btn btn--sm ' + (i === SAMP_PAGE ? 'btn--primary' : 'btn--quiet') + '"'
          + (i === SAMP_PAGE ? ' aria-current="page"' : '') + ' data-samp-page="' + i + '">' + i + '</button>';
    }
    bs += '<button type="button" class="btn btn--sm btn--quiet"' + (SAMP_PAGE >= pages ? ' disabled' : '')
        + ' data-samp-page="next">下一页</button>';
    pg.innerHTML = '<span class="pager__n">第 ' + (from + 1) + '–' + (from + rows.length) + ' 条 / 共 '
                 + ids.length + ' 条</span><span class="pager__bs">' + bs + '</span>';
  }
  var meta = $('#sampListMeta');
  if (meta) {
    /* 没有筛选时「筛出 N 例」等于总数，是句废话 —— 只在真筛过之后才说 */
    var narrowed = !!(SAMP_Q || SAMP_FLT.dx || SAMP_FLT.qc || SAMP_FLT.om || SAMP_FLT.cs);
    meta.textContent = '共 ' + sampIds().length + ' 例'
      + (narrowed ? ' · 筛出 ' + ids.length + ' 例' : '');
  }

  /* 当前排序列高亮 + 方向箭头：排序状态必须看得见，
     否则用户点了表头不知道结果为什么是这个顺序。 */
  $$('#sampTbl th').forEach(function (th) {
    var b = th.querySelector('[data-samp-sort]');
    var on = !!b && b.getAttribute('data-samp-sort') === SAMP_SORT.k;
    th.classList.toggle('is-sorted', on);
    th.classList.toggle('is-desc', on && SAMP_SORT.dir < 0);
  });
}

/* ---------- 四个指标：全部现算 ---------- */
/* 四格＝血缘谱系四层的「这一例是什么」：样本 ID（队列个体 / 样本源）→ 采集物
   （原始登记物）→ 衍生样本（分装）→ 关联组学（衍生模型）。色调键就按这条线
   依次取血缘的四个色相（蓝 → 蓝灰 → 青 → 紫），与下面那张图连起来看是一整条。
   只改顺序不改语义：换个样本这四格的含义不变。 */
function renderSampKpis() {
  var box = $('#sampKpis'); if (!box) return;
  var a = sampById(SAMP_CUR); if (!a) { box.innerHTML = ''; return; }
  var done = a.om.filter(function (x) { return !x.miss; });
  var names = done.map(function (x) { return x.o; }).join(' / ');
  var dv = sampDeriv(a);
  var frac = a.lin.filter(function (n) { return n.k === 'frac'; }).length;
  /* 新登记的样本没例号、没分装、没组学数据 —— 空字段要跳过，
     不能让「队列 X ·  · SUBJ-Y」这种空档留在卡片上。 */
  box.innerHTML =
      mcellOf('样本 ID', SAMP_CUR, '',
              [a.cohort, a.no, a.subj].filter(Boolean).join(' · ') || '尚未登记队列信息', 'id')
    + mcellOf('采集物', a.mat, '',
              (a.t ? a.t + ' 采集' : '采集时间未登记') + (a.store ? ' · ' + a.store : ''), 'mat')
    + mcellOf('衍生样本', String(dv), '份',
              frac ? '另有 ' + frac + ' 份分装材料' : '尚无分装与衍生材料', 'derive')
    + mcellOf('关联组学', String(done.length), '路',
              done.length
                ? names + (a.om.length > done.length ? ' · ' + (a.om.length - done.length) + ' 路缺失' : '')
                : '尚未在任何项目中产出组学数据', 'om');
}

/* ---------- 血缘谱系图（横向四列，v23） ----------
   数据里的 lv 就是列号：0 队列个体 → 1 样本源 → 2 分装样本 → 3 衍生模型。
   列名由该列节点的 k **现算**，不写死四个名字 —— S068 的血缘多一层
   「原始登记 ID」（lv1 是别名、lv2 才是归并后的唯一 ID），写死的话
   S068A 会被标成「样本源」。

   节点是「真按钮」：有 data-linnode 点击分支，也有 Enter / Space 的 keydown 分支 ——
   画成 role="button" 却没有处理器就是假按钮（编排区 .dagstep 早年犯过这个错）。

   配色取自评审给的参照图（蓝 / 青 / 紫三色相），但**整组加深**：参照图的亮青
   配白字只有 2.4:1、亮紫 4.1:1，在项目里过不了对比度回归。

   ⚠ 顶栏色块与它上面的白字必须包在**同一个子 <g>** 里：对比度探针 chartInk 取
   「该文字所在 <g> 内最后一个 rect / circle 的填充」当背景 —— 徽章那颗白圆若与
   顶栏白字同级，会把 4.9:1 的白字量成 1.0:1（误报成「白字压白底」）。
   顶栏也因此用 rect 而不是 path 画：探针只认 rect / circle。 */
var LIN_COLNAME = {
  subj: '队列个体', alias: '原始登记 ID', self: '样本类型',
  frac: '分装样本', deriv: '衍生模型'
};
/* top = 顶栏色（null = 整卡浅底、无顶栏）；body = 卡身底色 */
var LIN_SKIN = {
  subj:  { top: null,      body: '#EAF2FC' },
  alias: { top: '#4A6D93', body: '#FFFFFF' },
  self:  { top: '#1F6FD6', body: '#FFFFFF' },
  frac:  { top: '#14808F', body: '#FFFFFF' },
  deriv: { top: '#7C3FD0', body: '#FFFFFF' }
};
var LINC = {
  head: '#E9F2FB', headInk: '#4A6D93', hair: '#E3EAF3',
  /* ink 是「队列个体」卡的标题 / 图标 / 选中描边色。参照图那里的蓝是 #1F6FD6，
     铺在同卡浅蓝底 #EAF2FC 上只有 4.32:1 —— 差一口气，所以加深到这个值。 */
  line: '#9CC0E4', sub: '#63748A', badge: '#3D5266', ink: '#1A63C4',
  /* 分叉点小圆：连线色 #9CC0E4 在白底上只有 2.2:1，当「点」看太虚，单独加深一档。
     它是装饰性图形、不承载文字，所以不参与对比度回归，但要看得见。 */
  joint: '#6E96C4'
};

/* 一张节点卡长什么样，与「排在哪儿」无关 —— 两种方向共用这一份。
   几何差异集中在 LIN_GEO：横向泳道那一版的卡小（176×54），是为了让四列塞进
   画布宽度；纵向「上下结构」的卡按参照图放大到 250×90。两套数字都只在这里出现。 */
var LIN_GEO = {
  col: { NW: 176, NH: 54, BAR: 32, idFs: 12.5, subFs: 10.5, barFs: 12,
         bR: 9.5, bX: 19, bY: 16, iSz: 13, iX: 13, iY: 16, tX: 32, tY: 27,
         sX: 13, cT: 21, cS: 47 },
  row: { NW: 250, NH: 90, BAR: 56, idFs: 15, subFs: 11.5, barFs: 13,
         bR: 13, bX: 26, bY: 28, iSz: 17, iX: 17, iY: 27, tX: 42, tY: 47,
         sX: 17, cT: 36, cS: 76 }
};

/* 画布可视宽 —— **按容器实测，不写死**。血缘图从 v26 起住在右侧抽屉里，容器宽
   随抽屉与断点变（页面上 1110、抽屉里 804）；写死一个值，换了个住处图就被
   整体缩放，字号跟着一起变（v19 对齐矩阵、v23 三列血缘、v24 纵向都栽在这）。
   抽屉收起时 #linBox 宽为 0，回退到抽屉内容宽，免得初次渲染算出 0 宽的布局。 */
function linMaxW() {
  var box = $('#linBox');
  var w = box && box.clientWidth ? box.clientWidth : 804;
  return Math.max(560, Math.min(1100, w));
}

/* 卡宽自适应：给定「一格可用宽度」与卡片自然宽度，返回缩放系数。
   ⚠ 卡宽与间距是**同一个未知量的两种写法**（卡宽 = 可用宽 − 留白），
   分开各算一次（先定槽距、再把卡缩到最小系数）会让卡比槽距还宽 ——
   兄弟卡直接叠在一起。判据是「同层相邻卡的左边缘之差 ≥ 卡宽」，
   所以这里把 LINGAP 作为硬下限解出来，而不是给 k 拍一个最小值：
     可用宽 W 里要放下 卡 NW 与它右侧的留白 LINGAP → k ≤ (W − LINGAP) / NW0。
   下限是「再窄就不成卡片了」，只兜极端容器，正常容器根本走不到。 */
var LINGAP = 22;
function linFit(avail, natural) {
  if (!avail || !natural) return 1;
  return Math.max(0.45, Math.min(1, (avail - LINGAP) / natural));
}

/* 容器装不下时把**整张卡**等比缩小（含字号与图标偏移），而不是让 SVG 整体缩放。
   后者看着也是「变窄了」，但缩的是整张位图：字号、线宽、留白一起掉，
   且掉多少由容器决定、不可控。这里是布局阶段就定好卡多大，SVG 仍然 1:1。
   LIN_GEO 里全是相对卡左上角的数值偏移，统一乘 k 即可。 */
function linGeo(G, k) {
  if (!k || k >= 1) return G;
  var o = {}, key;
  for (key in G) { if (Object.prototype.hasOwnProperty.call(G, key)) o[key] = G[key] * k; }
  /* 字号**不跟着卡一起无限缩**：上下结构的卡从 250 压到 0.7 时，11.5px 的副标题
     会掉到 8px —— 在抽屉里就是「画出来了但读不了」。几何照缩，字号与图标留一个
     下限，卡窄了就少留白，字还得认得出。 */
  o.idFs = Math.max(o.idFs, 11.5);
  o.subFs = Math.max(o.subFs, 10);
  o.barFs = Math.max(o.barFs, 11);
  o.bR = Math.max(o.bR, 8);
  o.iSz = Math.max(o.iSz, 13);
  o.k = k;
  return o;
}

/* LIN_AXIS：图的排布方向。
   'col' = 层级 = 列（横向泳道，默认）/ 'row' = 层级 = 行（上下结构）。
   与 LIN_OPEN 一样是**全局 UI 偏好**而非样本属性：切样本、切 tab 都不复位，
   否则用户点了「上下结构」，换个样本又跳回横向。 */
var LIN_AXIS = 'col';

function linCardSVG(n, p, a, G) {
  var skin = LIN_SKIN[n.k] || LIN_SKIN.self;
  var on = LIN_FOCUS === n.id, cnt = linOm(a, n.id);
  var stroke = on ? (skin.top || LINC.ink) : LINC.hair;
  var out = '<g class="linnode' + (on ? ' is-on' : '') + '" data-linnode="' + esc(n.id) + '"'
    + ' role="button" tabindex="0"'
    + ' aria-label="' + esc(n.t + ' ' + n.s + '，' + (cnt ? cnt + ' 路组学' : '尚无组学数据') + '，点击筛选') + '">'
    + rect(p.x, p.y, G.NW, G.NH, skin.body,
        ' class="lncard" rx="10" stroke="' + stroke + '" stroke-width="' + (on ? 2 : 1) + '"');
  if (skin.top) {
    /* 顶栏：rx 的 rect 让顶部两角随卡圆，再用一条方形补丁把底边两角压平 ——
       这样顶栏铺满卡片上沿、下沿是直线。用 path 也能画，但对比度探针只认
       rect / circle，顶栏若画成 path，白字就找不到自己的背景了。 */
    out += '<g class="lnhead">'
      + rect(p.x, p.y, G.NW, G.BAR, skin.top, ' rx="10"')
      + rect(p.x, p.y + G.BAR - 12, G.NW, 12, skin.top, ' rx="0"')
      + txt(p.x + 13, p.y + G.cT, esc(n.t), { fs: G.idFs, fill: '#FFFFFF', mono: true, w: 600 })
      + '</g>';
    out += txt(p.x + G.sX, p.y + G.cS, esc(n.s), { fs: G.subFs, fill: LINC.sub });
  } else {
    /* 队列个体卡没有顶栏：整卡浅蓝底 + 图标 + 蓝色标题（参照图的两版都是这样）。
       图标名必须是 ICON_REGISTRY 里真实存在的键 —— build 只收集 ico() 调用与
       模板里的图标类名，写一个不存在的名字不会报错，只是图标静默消失
       （当初想用 user，注册表里只有 users）。 */
    out += dagIco('users', p.x + G.iX, p.y + G.iY, G.iSz, LINC.ink);
    out += txt(p.x + G.tX, p.y + G.tY, esc(n.t), { fs: G.idFs, fill: LINC.ink, w: 600 });
    out += txt(p.x + G.sX, p.y + G.cS, esc(n.s), { fs: G.subFs, fill: LINC.sub });
  }
  /* 右上角徽标：这个节点贡献了几路组学。0 也照画 ——「已分装但未送测」是有信息量
     的状态，与「数据丢了」是两回事；参照图里 0 同样是白底圆，跟着它走。
     单独挂 data-linbadge：纵向版还会画分叉点小圆，探针数 circle 会被它带偏。 */
  out += '<circle data-linbadge="1" cx="' + (p.x + G.NW - G.bX) + '" cy="' + (p.y + G.bY) + '"'
    + ' r="' + G.bR + '" fill="#FFFFFF"/>'
    + txt(p.x + G.NW - G.bX, p.y + G.bY + 3.5, String(cnt),
          { fs: G.bR + 0.5, fill: LINC.badge, anchor: 'middle', w: 600 })
    + '</g>';
  return out;
}

function linArrowDef() {
  return '<defs><marker id="linArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">'
    + '<path d="M0 0 L10 5 L0 10 z" fill="' + LINC.line + '"/></marker></defs>';
}

/* ── 方向一：层级 = 列（横向泳道）──
   列宽等分、列头带铺满整行、行内自上而下排。 */
function lineageCols(a) {
  var CW = 250, HEADH = 34, PADT = 22, PADB = 22, ROWGAP = 22;
  var FORK = 18;
  var cols = [], rows = 0;
  a.lin.forEach(function (n) {
    if (!cols[n.lv]) cols[n.lv] = [];
    cols[n.lv].push(n);
    if (cols[n.lv].length > rows) rows = cols[n.lv].length;
  });
  var ncol = cols.length;                 /* 稀疏数组：length 就是最大 lv + 1 */
  /* 列宽同样自适应：S068 多一层「原始登记 ID」就是 5 列，写死 250 会到 1250、
     超出画布被压缩。收窄到 linMaxW() / ncol，只让列间留白变窄。
     列窄到放不下 NW 的卡时再把卡整体缩一档 —— 让卡去适应容器，而不是让
     SVG 去缩放整张图。留白下限 LINGAP 同时也是「缩卡」的定量依据： */
  CW = Math.floor(Math.min(CW, linMaxW() / ncol));
  var G = linGeo(LIN_GEO.col, linFit(CW, LIN_GEO.col.NW));
  var NW = G.NW, NH = G.NH;
  var W = Math.round(ncol * CW);
  var H = HEADH + PADT + rows * NH + Math.max(0, rows - 1) * ROWGAP + PADB;
  var P = {};
  cols.forEach(function (col, ci) {
    col.forEach(function (n, ri) {
      P[n.id] = { x: ci * CW + (CW - NW) / 2, y: HEADH + PADT + ri * (NH + ROWGAP) };
    });
  });

  var out = '';
  /* 列头 + 列分隔线先铺底，节点压在上面 */
  out += rect(0, 0, W, HEADH, LINC.head, '');
  for (var ci = 1; ci < ncol; ci++) {
    out += line(ci * CW, 0, ci * CW, H, LINC.hair, ' stroke-width="1"');
  }
  cols.forEach(function (col, ci) {
    out += txt(ci * CW + CW / 2, HEADH / 2 + 4.5, LIN_COLNAME[col[0].k] || '',
      { fs: 12, fill: LINC.headInk, anchor: 'middle', w: 500 });
  });
  a.lin.forEach(function (n) {
    if (!n.from || !P[n.from]) return;
    var p = P[n.from], c = P[n.id];
    var x1 = p.x + NW, y1 = p.y + NH / 2, x2 = c.x, y2 = c.y + NH / 2, fx = x1 + FORK;
    /* 正交折线：水平 → 竖直 → 水平。同一父节点的多条边共用折点 fx，
       竖直段自然并成一条干线，不做交叉斜线（与参照图一致）。 */
    out += '<path d="' + (Math.abs(y1 - y2) < 0.6
        ? 'M' + x1 + ' ' + y1 + ' H' + x2
        : 'M' + x1 + ' ' + y1 + ' H' + fx + ' V' + y2 + ' H' + x2)
      + '" fill="none" stroke="' + LINC.line + '" stroke-width="1.5" marker-end="url(#linArrow)"/>';
    if (n.via) {
      /* 标签落在**最后一段水平线**的上方：同 y 时是整条线的中点，
         分叉时是「折点 → 子卡」这一段。白描边压在线上，不会和连线糊在一起。 */
      var mx = Math.abs(y1 - y2) < 0.6 ? (x1 + x2) / 2 : (fx + x2) / 2;
      out += '<text x="' + mx + '" y="' + (y2 - 5) + '" font-size="10" text-anchor="middle"'
        + ' fill="' + LINC.headInk + '" stroke="#FFFFFF" stroke-width="3"'
        + ' style="paint-order:stroke">' + esc(n.via) + '</text>';
    }
  });

  a.lin.forEach(function (n) { out += linCardSVG(n, P[n.id], a, G); });

  /* maxW = 自然宽度：**不许被容器拉伸**。生成样本的基础血缘只有三列（图宽 750），
     容器却有 1110 —— 不锁的话它会被放大 1.48 倍，字与卡片都比四列样本大一圈，
     同一个控件在不同样本下长相不一（v19 的对齐矩阵踩过同一个坑：viewBox 越小、
     放大越狠、屏幕字反而越大）。锁住后两种列数的图都是 1:1 居中。 */
  return wrap(W, H, '样本 ' + SAMP_CUR + ' 的血缘谱系（横向泳道）', linArrowDef() + out, W);
}

/* ── 方向二：层级 = 行（上下结构）──
   两张参照图里「上下结构」这张的排法是**紧凑树**，不是「每行各自居中」：
   叶子从左往右依次占位 → 有子节点的取子节点中点 → 同层再向右推开重叠。
   它解释了图里两个看似不对称的地方：S037-L 落在 S037-C 与 S037-O 正中间，
   而 S037-B 并没有落在 S037-X 正上方（X 被 O 顶到了右边，B 只能跟着右移）。
   「每行居中」做不到这一点 —— 那会让 B 与 X 错开、连线斜穿。 */
function lineageRows(a) {
  var GAP = 76, VGAP = 96, PADT = 22, PADB = 22, TRUNK = 34;
  var NW0 = LIN_GEO.row.NW;
  var rows = [], kids = {};
  a.lin.forEach(function (n) {
    (rows[n.lv] = rows[n.lv] || []).push(n);
    if (n.from) (kids[n.from] = kids[n.from] || []).push(n.id);
  });
  /* 槽距 S 由叶子数反推，不写死：叶子是树里最宽的一层，S037 有 4 个叶子
     （血浆分装 + 三个衍生模型），按固定 326 排就是 1228 宽、超出画布被压到
     0.904 倍。让 S 随叶子数收窄，整棵树正好落在容器内 —— 图还是 1:1，
     只是兄弟之间挨得近一点。
     ⚠ 卡宽是从 S 里「扣掉留白」得来的，不能反过来：先按 (maxW−NW0)/(slots−1)
     算 S、再把卡缩到 0.7，会让 4 个叶子时 S=173 而卡 175 —— 三张衍生模型
     互相压 2px（看着像「卡挨着卡」，其实是叠在一起）。
     正解是把 NW = S − LINGAP 代进去解 S：span = NW + (slots−1)·S ≤ maxW
     ⇒ S ≤ (maxW + LINGAP) / slots。 */
  var slots = 0;
  a.lin.forEach(function (n) { if (!kids[n.id]) slots++; });
  var NAT = NW0 + GAP;
  var S = slots > 1 ? Math.floor(Math.min(NAT, (linMaxW() + LINGAP) / slots)) : NAT;
  var G = linGeo(LIN_GEO.row, linFit(S, NW0));
  var NW = G.NW, NH = G.NH;
  var X = {}, seq = 0;
  a.lin.forEach(function (n) { if (!kids[n.id]) X[n.id] = seq++ * S + NW / 2; });
  for (var lv = rows.length - 1; lv >= 0; lv--) {
    rows[lv].forEach(function (n) {
      if (!kids[n.id]) return;
      var cs = kids[n.id].map(function (id) { return X[id]; });
      X[n.id] = (Math.min.apply(null, cs) + Math.max.apply(null, cs)) / 2;
    });
    var cur = rows[lv].slice().sort(function (p, q) { return X[p.id] - X[q.id]; });
    for (var i = 1; i < cur.length; i++) {
      if (X[cur[i].id] - X[cur[i - 1].id] < S) X[cur[i].id] = X[cur[i - 1].id] + S;
    }
  }
  var lo = Infinity, hi = -Infinity;
  a.lin.forEach(function (n) {
    lo = Math.min(lo, X[n.id] - NW / 2);
    hi = Math.max(hi, X[n.id] + NW / 2);
  });
  var W = Math.round(hi - lo);
  var H = PADT + rows.length * NH + (rows.length - 1) * VGAP + PADB;
  var P = {};
  rows.forEach(function (row, ri) {
    row.forEach(function (n) {
      P[n.id] = { x: X[n.id] - NW / 2 - lo, y: PADT + ri * (NH + VGAP) };
    });
  });

  var out = '';
  a.lin.forEach(function (n) {
    if (!n.from || !P[n.from]) return;
    var p = P[n.from], c = P[n.id];
    var fx = p.x + NW / 2, by = p.y + NH, ty = by + TRUNK, cx = c.x + NW / 2;
    /* 正交折线：父卡底边中点 → 干线 → 子卡顶边中点。父只有一个子且同列时
       就是一条竖直直线（样本源 → 样本源那一层），不必绕出干线。 */
    out += '<path d="' + (Math.abs(fx - cx) < 0.6
        ? 'M' + fx + ' ' + by + ' V' + c.y
        : 'M' + fx + ' ' + by + ' V' + ty + ' H' + cx + ' V' + c.y)
      + '" fill="none" stroke="' + LINC.line + '" stroke-width="1.5" marker-end="url(#linArrow)"/>';
    if (n.via) {
      /* 标签落在**两行之间的空白带**上，不压卡片：分叉时在「父中点 → 子中点」
         这一段的正上方，直线时贴在线右侧。白描边保证与连线不糊在一起。 */
      var straight = Math.abs(fx - cx) < 0.6;
      out += '<text x="' + (straight ? fx + 8 : (fx + cx) / 2) + '"'
        + ' y="' + (straight ? (by + c.y) / 2 + 3.5 : ty - 7) + '" font-size="11"'
        + ' text-anchor="' + (straight ? 'start' : 'middle') + '"'
        + ' fill="' + LINC.headInk + '" stroke="#FFFFFF" stroke-width="3"'
        + ' style="paint-order:stroke">' + esc(n.via) + '</text>';
    }
  });
  /* 分叉点：只有在**真的要分叉**（≥2 个子节点）的父卡下面画一个小圆。
     这是参照图里的写法，也顺带说明「这里一分为多」；只画一个子节点的父卡不画，
     否则每个父节点脚下都多一颗点，看着像每个卡都被钉了一下。 */
  a.lin.forEach(function (n) {
    var p = P[n.id];
    if (!kids[n.id] || kids[n.id].length < 2) return;
    out += '<circle data-linjoint="1" cx="' + (p.x + NW / 2) + '" cy="' + (p.y + NH + TRUNK) + '"'
      + ' r="3.4" fill="' + LINC.joint + '"/>';
  });
  a.lin.forEach(function (n) { out += linCardSVG(n, P[n.id], a, G); });

  /* 同样锁自然宽度：树宽已经在上面压到容器以内，这里传 W 就是「绝不缩放」。 */
  return wrap(W, H, '样本 ' + SAMP_CUR + ' 的血缘谱系（上下结构）', linArrowDef() + out, W);
}

function lineageSVG(a) {
  return LIN_AXIS === 'row' ? lineageRows(a) : lineageCols(a);
}

/* 方向切换。按钮文案写的是**点下去会变成什么**（「上下结构」/「横向泳道」），
   而不是当前是什么 —— 后者会让人以为按钮是个状态标签。 */
function syncLinAxis() {
  var b = $('#linAxis'); if (!b) return;
  var toRow = LIN_AXIS !== 'row';
  b.title = toRow ? '切换为上下结构的血缘谱系' : '切换为横向泳道的血缘谱系';
  b.setAttribute('aria-label', b.title);
  b.innerHTML = ico(toRow ? 'sitemap' : 'arrows-left-right')
    + '<span id="linAxisT">' + (toRow ? '上下结构' : '横向泳道') + '</span>';
}
function toggleLinAxis() { LIN_AXIS = LIN_AXIS === 'row' ? 'col' : 'row'; syncLinAxis(); renderLineage(); }

function renderLineage() {
  var box = $('#linBox'); if (!box) return;
  var a = sampById(SAMP_CUR);
  if (!a) { box.innerHTML = ''; renderLinTable(null); syncLinMeta(); return; }
  box.innerHTML = lineageSVG(a);
  renderLinTable(a);
  syncLinMeta();
}

/* 血缘图的「数据表替代视图」。图的元素是 <g role="button">，读屏只能一个个念
   aria-label；这张表把「哪一层、说明、上游是谁、贡献几路组学」一次性摊平。
   层级名与列头同源（LIN_COLNAME），不另写一套叫法。 */
function renderLinTable(a) {
  var tb = $('#linTbl'); if (!tb) return;
  if (!a) { tb.innerHTML = ''; return; }
  var byId = {};
  a.lin.forEach(function (n) { byId[n.id] = n; });
  tb.innerHTML = '<table class="tbl"><thead><tr>'
    + '<th class="num">#</th><th>节点</th><th>层级</th><th>说明</th><th>上游</th>'
    + '<th class="num">组学（路）</th></tr></thead><tbody>'
    + a.lin.map(function (n, i) {
        var up = n.from && byId[n.from] ? byId[n.from].t : '—';
        return '<tr><td class="num">' + (i + 1) + '</td><td>' + esc(n.t) + '</td>'
          + '<td>' + esc(LIN_COLNAME[n.k] || n.k) + '</td><td>' + esc(n.s) + '</td>'
          + '<td>' + esc(up) + '</td><td class="num">' + linOm(a, n.id) + '</td></tr>';
      }).join('')
    + '</tbody></table>';
}

/* ---------- 血缘谱系折叠 ---------- */
function linOpen() { return LIN_OPEN !== false; }

/* 状态位只有一个：按钮自己的 aria-expanded（与左栏 .snav__grp 同构）。
   图标旋转由 CSS 从它派生，正文隐藏由 hidden 属性承担 ——
   一个来源、两个消费者，不会出现「图标说收起了、正文还摊着」这种自相矛盾。 */
function syncLinFold() {
  var b = $('#linFold'), body = $('#linBody'), t = $('#linFoldT');
  if (!b) return;
  var on = linOpen();
  b.setAttribute('aria-expanded', on ? 'true' : 'false');
  b.title = on ? '收起血缘谱系图' : '展开血缘谱系图';
  if (t) t.textContent = on ? '收起' : '展开';
  if (body) body.hidden = !on;
  syncLinMeta();
}
function toggleLinFold() { LIN_OPEN = !linOpen(); syncLinFold(); }

/* 标题行的摘要。收起时必须去掉「点节点可筛出它贡献的组学记录」——
   节点已经藏起来了，留着这句等于让用户去找一个点不到的东西。 */
function syncLinMeta() {
  var meta = $('#linMeta'); if (!meta) return;
  var a = sampById(SAMP_CUR);
  if (!a) { meta.textContent = '—'; return; }
  var nodes = a.lin.length, edges = a.lin.filter(function (n) { return !!n.from; }).length;
  meta.textContent = nodes + ' 个节点 · ' + edges + ' 条衍生关系'
    + (linOpen() ? ' · 点节点可筛出它贡献的组学记录' : '');
}

/* ---------- 跨组学关联 ---------- */
function renderOmics() {
  var tb = $('#omBody'); if (!tb) return;
  var a = sampById(SAMP_CUR); if (!a) { tb.innerHTML = ''; return; }
  var rows = a.om.filter(function (x) { return !LIN_FOCUS || x.n === LIN_FOCUS; });

  tb.innerHTML = rows.map(function (x) {
    if (x.miss) {
      return '<tr class="is-miss"><td><span class="omchip">' + ico(x.ic) + esc(x.o) + '</span></td>'
        + '<td class="text-ink3">—</td><td class="text-ink3">—</td>'
        + '<td colspan="3" class="text-ink3">' + esc(x.miss) + '</td>'
        + '<td class="wid"><span class="tag">缺失</span></td></tr>';
    }
    return '<tr>'
      + '<td><span class="omchip">' + ico(x.ic) + esc(x.o) + '</span></td>'
      + '<td><button type="button" class="lnlink" data-linnode="' + esc(x.n) + '"'
      + ' title="只看 ' + esc(x.n) + ' 贡献的组学记录">' + esc(x.n) + '</button></td>'
      + '<td><span class="projlink">' + esc(x.pj) + '</span></td>'
      + '<td class="text-[11.5px]">' + esc(x.f) + ' · ' + esc(x.sz) + '</td>'
      + '<td>' + esc(x.ref) + '</td>'
      + '<td class="num nw">' + x.t + '</td>'
      + '<td class="wid"><button type="button" class="btn btn--sm" data-om-open="' + esc(x.pj) + '">'
      + ico('arrow-up-right-from-square') + '查看数据</button></td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="7" class="tempty">'
    + (LIN_FOCUS ? '该材料没有产出组学数据'
                 : '该样本尚未在任何项目中产出组学数据。数据在「数据汇集」导入并归属项目后，会按样本 ID 挂到这里。')
    + '</td></tr>';

  var done = a.om.filter(function (x) { return !x.miss; });
  var pjs = done.map(function (x) { return x.pj; }).filter(function (v, i, arr) { return arr.indexOf(v) === i; });
  var meta = $('#omMeta');
  if (meta) {
    /* 新登记的样本一条组学都没有：不能顺着算成「0 路组学 · 分布在 0 个项目」——
       那读起来像「算过了，结果是 0」，而事实是「还没开始」。 */
    meta.textContent = done.length
      ? done.length + ' 路组学 · 分布在 ' + pjs.length + ' 个项目'
        + (a.om.length > done.length ? ' · ' + (a.om.length - done.length) + ' 路缺失' : '')
      : (a.om.length ? a.om.length + ' 路组学全部缺失' : '尚未产出组学数据');
  }
  var ft = $('#omFilter');
  if (ft) {
    ft.hidden = !LIN_FOCUS;
    if (LIN_FOCUS) ft.textContent = '仅看 ' + LIN_FOCUS + '（清除）';
  }
}

/* ============================================================
   样本档案：信息与资料
   ============================================================
   页面上的分工：KPI 回答「规模」，样本信息回答「这个样本是什么」，血缘谱系
   回答「它生出了什么」，跨组学关联回答「它在哪跑过什么」，样本资料回答
   「原件与凭据存在哪」。前四块是分析用的，最后一块是合规用的 —— 两者挂在
   同一个样本 ID 下面，这才是「档案」两个字的完整含义。

   表单字典一律做成固定几类，不做自由文本输入：自由填写会让「肝细胞癌」长出
   「肝癌 / HCC / 肝细胞肝癌」七八种写法，跨样本统计时聚不到一起。 */
var SAMP_DX = ['肝细胞癌', '肝内胆管癌', '混合型肝癌', '肝硬化', '健康对照', '其他'];
var SAMP_MATS = ['肝组织 + 外周血', '肝组织', '外周血', '尿液', '粪便', '其他'];
var SAMP_STORES = ['液氮 / -80 ℃', '液氮（仅）', '-80 ℃（仅）', '-20 ℃', '4 ℃', '石蜡包埋 · 室温'];
/* 质控结论与知情同意状态：**选项自己带着状态色**（st）。
   让用户手填结论、再单独挑一个颜色，两处早晚要打架；绑在一起就没有漂的余地。 */
var QC_LEVELS = [
  { v: '合格', st: 'ok' },
  { v: '组织合格 · 血浆不合格', st: 'warn' },
  { v: '组织 DNA 合格 · RNA 与血清不合格', st: 'danger' },
  { v: '尚未质检', st: 'dim' }
];
var CONSENT_STS = [
  { v: '是', st: 'ok' }, { v: '否', st: 'warn' }, { v: '未知', st: 'danger' }
];

function levelSt(list, v) {
  var hit = list.filter(function (o) { return o.v === v; })[0];
  return hit ? hit.st : 'dim';
}

/* 取元素的纯文本（合并空白）。注意 app.js 里的 txt() 是画 SVG 文字的，
   不是读文字 —— 两个名字撞过一次车，所以这个单独叫 plainText。 */
function plainText(el) {
  return el ? String(el.textContent).replace(/\s+/g, ' ').trim() : '';
}

/* 表单小工具：字段多，手工拼 HTML 拼错一个引号就是整块渲染失败 */
function fv(sel) {
  var e = $(sel);
  return e ? String(e.value == null ? '' : e.value).replace(/^\s+|\s+$/g, '') : '';
}
function optHTML(list, cur) {
  return list.map(function (o) {
    return '<option' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>';
  }).join('');
}
function optPairs(list, cur) {
  return list.map(function (o) {
    return '<option value="' + esc(o.v) + '"' + (o.v === cur ? ' selected' : '') + '>' + esc(o.v) + '</option>';
  }).join('');
}
/* v40：req 参数统一带上 reqMark() 与 aria-required —— 必填的三件套
   （肉眼星号 / 表单尾部图例 / 读屏念必填）少哪一半都有一类用户看不出来。 */
function fldInp(id, l, v, ph, req) {
  return '<div class="fld"><label class="fld__l" for="' + id + '">' + esc(l) + (req ? reqMark() : '') + '</label>'
    + '<input class="inp" id="' + id + '" value="' + esc(v == null ? '' : v) + '" autocomplete="off"'
    + (ph ? ' placeholder="' + esc(ph) + '"' : '') + (req ? ' aria-required="true"' : '') + '></div>';
}
function fldSel(id, l, opts) {
  return '<div class="fld"><label class="fld__l" for="' + id + '">' + esc(l) + '</label>'
    + '<select class="sel" id="' + id + '">' + opts + '</select></div>';
}
function fmtSize(b) {
  b = Number(b) || 0;
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

/* ---------- 样本信息：字段先并成一处，再分组 ----------
   字段有三个来源：
     ① 顶层字段 —— 样本 ID / 样本源ID / 采集物 / 采集时间 / 存放条件；
     ② 派生 —— 分装与衍生数取自 lin，原始登记 ID 取自 lin 里的 alias 节点，
              所属项目取自 om（一个样本可以出现在多个项目里，所以是多个值）；
     ③ meta —— 临床、存储、质控、知情同意。
   为什么不存一份成品的字段表：上面三类任一改动，字段表就变成旧值。这种
   「显示层缓存」漂了没有任何断言看得见 —— 数字都还在，只是悄悄过期了。 */
function sampFields(a, id) {
  var m = a.meta || {}, q = m.qc || {}, c = m.consent || {};
  var frac = a.lin.filter(function (n) { return n.k === 'frac'; }).length;
  var deriv = a.lin.filter(function (n) { return n.k === 'deriv'; }).length;
  var alias = a.lin.filter(function (n) { return n.k === 'alias'; });
  var pjs = a.om.map(function (x) { return x.pj; })
    .filter(function (v, i, arr) { return v && arr.indexOf(v) === i; });
  var rin = parseFloat(q.rin);
  var badPlasma = !!q.plasma && q.plasma.indexOf('溶血') > -1;
  var tone = function (v, t) { return v ? t : 'dim'; };

  return [
    { g: '标识信息', ic: 'fingerprint', rows: [
      ['样本 ID', id, ''],
      ['样本源ID', a.subj || '——', tone(a.subj, '')],
      ['原始登记 ID', alias.length ? alias[0].t + '（已归并）' : '无别名', tone(alias.length, '')],
      ['所属队列', a.cohort || '——', tone(a.cohort, '')],
      ['所属项目', pjs.length ? pjs.join(' · ') : '尚未归属项目', tone(pjs.length, '')]
    ] },
    { g: '临床信息', ic: 'stethoscope', rows: [
      ['疾病诊断', a.dx || '——', tone(a.dx, '')],
      ['临床分期', m.stage || '——', tone(m.stage, '')],
      ['性别 / 年龄', (m.sex || '——') + ' · ' + (m.age ? m.age + ' 岁' : '——'), ''],
      ['取材部位', m.site || '——', tone(m.site, '')],
      ['队列例号', a.no || '——', tone(a.no, '')]
    ] },
    { g: '采集与处理', ic: 'vial', rows: [
      ['采集物', a.mat || '——', tone(a.mat, '')],
      ['采集时间', a.t || '——', tone(a.t, '')],
      ['采集量', m.vol || '——', tone(m.vol, '')],
      ['处理方式', m.proc || '——', tone(m.proc, '')]
    ] },
    { g: '存储与位置', ic: 'box-archive', rows: [
      ['存放条件', a.store || '——', tone(a.store, '')],
      /* 没上架不是「空」，是「还没做」—— 用 warn 而不是灰字，
         因为样本库最怕的就是「不知道存哪」。 */
      ['存储位置', m.loc || '尚未上架', m.loc ? '' : 'warn'],
      ['入库时间', m.inAt || '——', tone(m.inAt, '')],
      ['分装 / 衍生', frac + ' 份分装 · ' + deriv + ' 份衍生', (frac + deriv) ? '' : 'dim']
    ] },
    { g: '质控信息', ic: 'clipboard-check', rows: [
      ['DNA 浓度', q.dnaC || '——', tone(q.dnaC, '')],
      ['DNA 纯度', q.dnaP || '——', tone(q.dnaP, '')],
      /* RIN 低于 5 就是降解到不能建库了 —— 这是转录组做不出来的直接原因，
         所以它不该和普通数字用同一种颜色。
         标签不带「组织」二字：分组标题已经限定了是这一份样本，加了就撑破列宽。 */
      ['RNA 完整性', q.rin ? 'RIN ' + q.rin : '——',
        q.rin ? ((!isNaN(rin) && rin < 5) ? 'warn' : '') : 'dim'],
      ['血浆 / 血清状态', q.plasma || '——', badPlasma ? 'warn' : tone(q.plasma, '')],
      ['质控结论', q.verdict || '尚未质检', q.st || 'dim']
    ] },
    { g: '知情同意与伦理', ic: 'file-shield', rows: [
      ['知情同意状态', c.st || '未登记', c.st === '是' ? 'ok' : (c.st === '否' ? 'warn' : (c.st ? 'danger' : 'dim'))],
      ['伦理批件号', c.no || '——', tone(c.no, '')],
      ['签署日期', c.t || '——', tone(c.t, '')],
      ['用途限制', c.use || '未登记', tone(c.use, '')]
    ] }
  ];
}

function renderSampInfo() {
  var box = $('#sampInfo'); if (!box) return;
  var a = sampById(SAMP_CUR);
  if (!a) { box.innerHTML = ''; return; }
  var groups = sampFields(a, SAMP_CUR);
  var total = groups.reduce(function (n, g) { return n + g.rows.length; }, 0);
  box.innerHTML = '<div class="sgrid">' + groups.map(function (gr) {
    return '<div class="sgrp">'
      + '<div class="sgrp__h">' + ico(gr.ic) + esc(gr.g) + '</div>'
      + '<div class="sgrp__b">' + gr.rows.map(function (r) {
          return '<div class="srow"><span class="srow__l">' + esc(r[0]) + '</span>'
            + '<span class="srow__v' + (r[2] ? ' is-' + r[2] : '') + '" title="' + esc(r[1]) + '">'
            + esc(r[1]) + '</span></div>';
        }).join('') + '</div></div>';
  }).join('') + '</div>';
  var meta = $('#sampInfoMeta');
  if (meta) meta.textContent = groups.length + ' 组 · ' + total + ' 个字段';
}

/* ---------- 样本资料 ---------- */
/* 图标按扩展名走，不按资料类型走：类型是业务分类（质检报告可能是 PDF 也可能是
   Excel），扩展名才是这个文件本身长什么样。 */
function icoOfDoc(n) {
  var e = String(n || '').split('.').pop().toLowerCase();
  if (e === 'pdf') return 'file-pdf';
  if (e === 'xlsx' || e === 'xls' || e === 'csv') return 'file-excel';
  if (e === 'docx' || e === 'doc') return 'file-word';
  if (e === 'png' || e === 'jpg' || e === 'jpeg' || e === 'tif' || e === 'tiff') return 'file-image';
  return 'file-lines';
}

function renderSampDocs() {
  var tb = $('#docBody'); if (!tb) return;
  var a = sampById(SAMP_CUR);
  var ds = (a && a.docs) || [];

  tb.innerHTML = ds.length ? ds.map(function (d, i) {
    return '<tr>'
      + '<td><span class="tag tag--brand">' + esc(d.k) + '</span></td>'
      + '<td class="dname"><span class="dname__in">' + ico(icoOfDoc(d.n))
      + '<span class="dname__n" title="' + esc(d.n) + '">' + esc(d.n) + '</span></span></td>'
      + '<td class="num nw">' + esc(d.sz) + '</td>'
      + '<td class="nw">' + esc(d.who) + '</td>'
      + '<td class="num nw">' + d.t + '</td>'
      + '<td class="dnote">' + esc(d.note || '—') + '</td>'
      + '<td class="wid"><span class="ops">'
      + '<button type="button" class="btn btn--sm btn--quiet" data-doc-dl="' + i + '"'
      + (d.f ? '' : ' title="内置条目只有元数据，没有实际文件"') + '>'
      + ico('download') + '下载</button>'
      + '<button type="button" class="btn btn--sm btn--quiet" data-doc-del="' + i + '">'
      + ico('trash-can') + '移除</button>'
      + '</span></td></tr>';
  }).join('')
    : '<tr><td colspan="7" class="tempty">该样本还没有归档资料。知情同意书、病理报告、'
      + '质检报告这类东西不进分析流程，但它们是样本能否合规使用的凭据 —— '
      + '点右上角「归档资料」补上。</td></tr>';

  var dm = $('#docMeta');
  if (dm) {
    var kinds = ds.map(function (d) { return d.k; })
      .filter(function (v, i, arr) { return arr.indexOf(v) === i; });
    dm.textContent = ds.length ? ds.length + ' 份 · 覆盖 ' + kinds.length + ' 类资料' : '尚未归档';
  }
}

function renderArch() {
  if (!$('#sampPanel')) return;
  syncLinFold();
  syncSampQuery();
  if (!SAMP_LOCATED) { SAMP_LOCATED = true; sampLocate(SAMP_CUR); }
  renderSampList();
  renderSampKpis();
  renderSampInfo();
  renderLineage();
  renderOmics();
  renderSampDocs();
  syncSampDrawerHead();
  /* 这里**不**自动打开抽屉：进来先看列表，选中哪一例才滑出详情。
     自动展开会一进门就盖住半屏，而且刷新一次就多一次滑入动画。 */
}

/* ---------- 弹窗：登记新样本 ----------
   登记只放**当场必须填**的字段。录样本的人手上通常只有一张采集单，
   逼他一次填完 27 个字段，结果就是他不录了 —— 临床、质控、知情同意
   留给「编辑信息」慢慢补，这是真实样本库的用法：先入库，再补全。 */
function openSampNew() {
  showModal('登记新样本',
    '<div class="stack">'
    + '<div class="frmrow">'
    + '<div class="fld"><label class="fld__l" for="nsId">样本 ID ' + reqMark() + '</label>'
    + '<input class="inp" id="nsId" autocomplete="off" aria-required="true" placeholder="例如 S069"></div>'
    + '<div class="fld"><label class="fld__l" for="nsSubj">样本源ID</label>'
    + '<input class="inp" id="nsSubj" autocomplete="off" placeholder="例如 SUBJ-0432"></div>'
    + '<div class="fld"><label class="fld__l" for="nsNo">队列例号</label>'
    + '<input class="inp" id="nsNo" autocomplete="off" placeholder="例如 第 69 例"></div>'
    + '</div>'
    + '<div class="frmrow">'
    + fldInp('nsCohort', '所属队列', 'TJ-TCM-2026', '')
    + fldSel('nsDx', '疾病诊断', optHTML(SAMP_DX, '肝细胞癌'))
    + fldSel('nsMat', '采集物', optHTML(SAMP_MATS, '肝组织 + 外周血'))
    + '</div>'
    + '<div class="frmrow">'
    + '<div class="fld"><label class="fld__l" for="nsT">采集时间</label>'
    + '<input class="inp" id="nsT" autocomplete="off" placeholder="例如 2026-03-25"></div>'
    + fldSel('nsStore', '存放条件', optHTML(SAMP_STORES, '液氮 / -80 ℃'))
    + '</div>'
    + '<div class="frmrow">'
    + fldInp('nsLoc', '存放位置', '', '例如 A 库 / 03 架 / 12 盒 / B4')
    + fldSel('nsSrc', '数据来源', '<option>自创建</option>')
    + '</div>'
    + frmLegend()
    + '</div>',
    '<button type="button" class="btn" data-close="modal">取消</button>'
    + '<button type="button" class="btn btn--primary" data-samp-new-submit>'
    + ico('user-plus') + '登记入档</button>');
  setTimeout(function () { var el = $('#nsId'); if (el) el.focus(); }, 30);
}

function createSamp() {
  var el = $('#nsId');
  var id = fv('#nsId');
  /* 空 ID 不静默创建：否则候选区会多出一个没名字的样本，用户还不知道错在哪一步 */
  if (!id) {
    toast('请先填写样本 ID —— 血缘节点与组学记录都挂在它下面', 'warn');
    if (el) el.focus();
    return;
  }
  /* 唯一 ID 会被当成 data-* 属性值与选择器片段用（data-samp-pick / data-linnode），
     字符必须收敛。否则一个带引号的名字就能让整页的选择器失配。 */
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
    toast('样本 ID 只能用字母、数字、点、下划线与短横，且以字母或数字开头', 'warn');
    if (el) el.focus();
    return;
  }
  if (SAMP_ARCHIVE[id]) {
    toast('样本 ' + id + ' 已经建档 —— 直接在上面查询它，或换一个 ID', 'warn');
    if (el) el.focus();
    return;
  }

  var subj = fv('#nsSubj'), no = fv('#nsNo');
  SAMP_ARCHIVE[id] = {
    cohort: fv('#nsCohort'), no: no, subj: subj, dx: fv('#nsDx'),
    mat: fv('#nsMat'), t: fv('#nsT'), store: fv('#nsStore'), src: '自创建',
    meta: { sex: '', age: '', stage: '', site: '', vol: '', proc: '',
            loc: fv('#nsLoc'), inAt: '', qc: {}, consent: {} },
    docs: [],
    /* 新样本的血缘只有两层：样本源 → 采集物。分装与衍生材料要到样本处理时才产生，
       登记阶段就先编出几份来，等于替实验员记录了没发生过的事。 */
    lin: [
      { id: subj || id + '-SUBJ', lv: 0, k: 'subj', t: '样本源ID',
        s: (subj || '尚未分配编号') + (no ? ' · ' + no : '') },
      { id: id, lv: 1, k: 'self', t: id, s: fv('#nsMat'),
        from: subj || id + '-SUBJ' }
    ],
    om: []
  };
  $('#modal').hidden = true;
  /* 清掉搜索词再切过去：留着上一次的关键词，新样本很可能被过滤掉，
     用户点完「登记」却看不到它，会以为没成功。 */
  SAMP_Q = '';
  var qi = $('#sampQ'); if (qi) qi.value = '';
  /* 筛选条件也要清：新样本没有质控结论与组学数据，挂着筛选就看不见它 ——
     和搜索词是同一个道理，只是这一处更容易漏。 */
  SAMP_FLT = { dx: '', qc: '', om: '', cs: '' };
  ['fltDx', 'fltQc', 'fltOm', 'fltCs'].forEach(function (i) {
    var e2 = $('#' + i); if (e2) e2.value = '';
  });
  fillSampFilters();
  sampPick(id, true);
  toast('样本 ' + id + ' 已登记入档。临床与质控字段可在「编辑信息」里补，'
        + '资料在「归档资料」里传', 'ok');
}

/* ---------- 弹窗：编辑样本信息 ----------
   字段多是有意的：样本档案的价值就压在这些字段上，藏起来等于没存。
   弹窗正文可滚动（.modal__b 已限 86vh），所以长表单不会被裁掉。 */
function openSampEdit() {
  var a = sampById(SAMP_CUR); if (!a) return;
  var m = a.meta || {}, q = m.qc || {}, c = m.consent || {};
  showModal('编辑样本信息 · ' + SAMP_CUR,
    '<div class="stack">'
    + '<div class="frmrow">'
    + fldInp('esSubj', '样本源ID', a.subj, '例如 SUBJ-0432')
    + fldInp('esNo', '队列例号', a.no, '例如 第 37 例')
    + fldInp('esCohort', '所属队列', a.cohort, '')
    + '</div>'
    + '<div class="frmrow">'
    + fldSel('esDx', '疾病诊断', optHTML(SAMP_DX.concat(a.dx && SAMP_DX.indexOf(a.dx) < 0 ? [a.dx] : []), a.dx))
    + fldInp('esStage', '临床分期', m.stage, '例如 IIIa 期')
    + fldInp('esSite', '取材部位', m.site, '例如 肝右叶 S6 段')
    + '</div>'
    + '<div class="frmrow">'
    + fldSel('esSex', '性别', optHTML(['男', '女', '未知'], m.sex || '未知'))
    + fldInp('esAge', '年龄', m.age, '例如 58')
    + fldSel('esMat', '采集物', optHTML(SAMP_MATS.concat(a.mat && SAMP_MATS.indexOf(a.mat) < 0 ? [a.mat] : []), a.mat))
    + '</div>'
    + '<div class="frmrow">'
    + fldInp('esT', '采集时间', a.t, '例如 2026-03-14')
    + fldInp('esVol', '采集量', m.vol, '例如 组织 0.8 g + 全血 5 mL')
    + fldInp('esProc', '处理方式', m.proc, '例如 液氮速冻 · EDTA 抗凝')
    + '</div>'
    + '<div class="frmrow">'
    + fldSel('esStore', '存放条件', optHTML(SAMP_STORES.concat(a.store && SAMP_STORES.indexOf(a.store) < 0 ? [a.store] : []), a.store))
    + fldInp('esLoc', '存储位置', m.loc, '例如 A 库 / 03 架 / 12 盒 / B4')
    + fldInp('esInAt', '入库时间', m.inAt, '例如 2026-03-14 11:05')
    + '</div>'
    + '<div class="frmrow">'
    + fldInp('esDnaC', '组织 DNA 浓度', q.dnaC, '例如 68.4 ng/µL')
    + fldInp('esDnaP', '组织 DNA 纯度', q.dnaP, '例如 1.89（260/280）')
    + fldInp('esRin', '组织 RNA 完整性', q.rin, '例如 8.7')
    + '</div>'
    + '<div class="frmrow">'
    + fldInp('esPlasma', '血浆 / 血清状态', q.plasma, '例如 无明显溶血')
    + fldSel('esVerdict', '质控结论', optPairs(QC_LEVELS, q.verdict || '尚未质检'))
    + '</div>'
    + '<div class="frmrow">'
    + fldSel('esConsent', '知情同意状态', optPairs(CONSENT_STS, c.st || '否'))
    + fldInp('esCno', '伦理批件号', c.no, '例如 EC-TJ-2026-018')
    + fldInp('esCt', '签署日期', c.t, '例如 2026-03-12')
    + '</div>'
    + '<div class="fld"><label class="fld__l" for="esCuse">用途限制</label>'
    + '<input class="inp" id="esCuse" value="' + esc(c.use || '') + '" autocomplete="off"'
    + ' placeholder="例如 仅限本课题研究，不含商业用途"></div>'
    + '</div>',
    '<button type="button" class="btn" data-close="modal">取消</button>'
    + '<button type="button" class="btn btn--primary" data-samp-edit-submit>'
    + ico('pen-to-square') + '保存</button>');
}

function saveSampEdit() {
  var a = sampById(SAMP_CUR); if (!a) return;
  a.subj = fv('#esSubj'); a.no = fv('#esNo'); a.cohort = fv('#esCohort');
  a.dx = fv('#esDx'); a.mat = fv('#esMat'); a.t = fv('#esT'); a.store = fv('#esStore');

  var qv = fv('#esVerdict'), cv = fv('#esConsent');
  a.meta = {
    sex: fv('#esSex'), age: fv('#esAge'), stage: fv('#esStage'), site: fv('#esSite'),
    vol: fv('#esVol'), proc: fv('#esProc'), loc: fv('#esLoc'), inAt: fv('#esInAt'),
    /* 状态色不从表单读，而是由结论值反查字典 —— 表单里没有「颜色」这个选项，
       也就没有人能把它和结论改岔。 */
    qc: { dnaC: fv('#esDnaC'), dnaP: fv('#esDnaP'), rin: fv('#esRin'),
          plasma: fv('#esPlasma'), verdict: qv, st: levelSt(QC_LEVELS, qv) },
    consent: { st: cv, no: fv('#esCno'), t: fv('#esCt'), use: fv('#esCuse') }
  };

  /* 血缘节点上的样本源ID与采集物是从顶层字段派生的，必须跟着重写 ——
     否则卡片上写着新编号，谱系图上还挂着旧的那个。 */
  var sub = a.lin.filter(function (n) { return n.k === 'subj'; })[0];
  if (sub) {
    sub.id = a.subj || SAMP_CUR + '-SUBJ';
    sub.s = (a.subj || '尚未分配编号') + (a.no ? ' · ' + a.no : '');
  }
  var self = a.lin.filter(function (n) { return n.k === 'self'; })[0];
  if (self) self.s = a.mat;

  /* 顶层字段同时被候选 chips、KPI、信息卡与组学表消费，一次全刷 ——
     逐个挑着刷，漏掉的那个就是「改了没生效」。 */
  syncSampQuery();
  renderSampKpis();
  renderSampInfo();
  renderLineage();
  renderOmics();
  renderSampDocs();
  $('#modal').hidden = true;
  toast('样本 ' + SAMP_CUR + ' 的信息已更新', 'ok');
}

/* ---------- 弹窗：归档资料 ---------- */
function openSampDocAdd() {
  if (!sampById(SAMP_CUR)) return;
  SAMP_PEND = [];
  showModal('归档资料 · ' + SAMP_CUR,
    '<div class="stack">'
    + '<div class="frmrow">'
    + fldSel('docKind', '资料类型', optHTML(DOC_KINDS, DOC_KINDS[0]))
    + fldInp('docNote', '备注', '', '例如：样本源签署原件扫描件')
    + '</div>'
    + '<div class="dz" id="docDz" data-doc-drop role="button" tabindex="0"'
    + ' aria-label="选择要归档的文件">'
    + '<input type="file" id="docFile" data-doc-file multiple tabindex="-1" class="dzf">'
    + '<div class="dz__ico">' + ico('folder-open') + '</div>'
    + '<div class="dz__t">点击选择文件，或把文件拖到这里</div>'
    + '<div class="dz__d">可一次选多个；PDF / Word / Excel / 图片都能归档</div>'
    + '</div>'
    + '<div class="pendbox" id="docPend"></div>'
    + '</div>',
    '<button type="button" class="btn" data-close="modal">取消</button>'
    + '<button type="button" class="btn btn--primary" data-doc-submit>'
    + ico('folder-open') + '归档</button>');
  renderSampPend();
}

/* 一次选多个文件时，「资料类型」是弹窗级的；每个文件都带上当前选中的类型，
   这样改类型只影响之后选的，不会把已经在清单里的条目也改掉。 */
function pushSampFiles(list) {
  var kk = fv('#docKind') || DOC_KINDS[0];
  var n = 0;
  Array.prototype.forEach.call(list || [], function (f) {
    SAMP_PEND.push({ k: kk, n: f.name, sz: fmtSize(f.size), f: f });
    n++;
  });
  if (n) renderSampPend();
  return n;
}

function renderSampPend() {
  var box = $('#docPend'); if (!box) return;
  if (!SAMP_PEND.length) {
    box.innerHTML = '<div class="pendempty">还没有选文件。选好的文件会先列在这里，'
      + '点「归档」才真正写进档案 —— 选错了还来得及撤。</div>';
    return;
  }
  box.innerHTML = '<div class="pendhd">待归档 ' + SAMP_PEND.length + ' 份</div>'
    + SAMP_PEND.map(function (d, i) {
        return '<div class="pendrow">' + ico(icoOfDoc(d.n))
          + '<span class="pendrow__n" title="' + esc(d.n) + '">' + esc(d.n) + '</span>'
          + '<span class="tag tag--brand">' + esc(d.k) + '</span>'
          + '<span class="pendrow__s">' + esc(d.sz) + '</span>'
          + '<button type="button" class="iconbtn" data-pend-del="' + i + '"'
          + ' aria-label="把这一份从待归档里去掉">' + ico('xmark') + '</button></div>';
      }).join('');
}

function commitSampDocs() {
  var a = sampById(SAMP_CUR); if (!a) return;
  if (!SAMP_PEND.length) {
    toast('还没有选文件 —— 先点虚线框选一份，或把文件拖进去', 'warn');
    var dz = $('#docDz');
    if (dz) {
      dz.classList.add('is-err');
      setTimeout(function () { var d = $('#docDz'); if (d) d.classList.remove('is-err'); }, 1200);
    }
    return;
  }
  var note = fv('#docNote'), n = SAMP_PEND.length;
  a.docs = (a.docs || []).concat(SAMP_PEND.map(function (d) {
    return { k: d.k, n: d.n, sz: d.sz, who: '管理员', t: nowStr(), note: note || '本次归档', f: d.f || null };
  }));
  SAMP_PEND = [];
  $('#modal').hidden = true;
  renderSampDocs();
  toast('已归档 ' + n + ' 份资料到样本 ' + SAMP_CUR, 'ok');
}

/* 移除不做二次确认：它只从档案里摘掉一条记录，本机文件不会被动，
   而且随时可以重新归档 —— 加一层确认反而让「整理资料」变成体力活。
   真要防误点，靠的是紧跟着的 toast 把结果说出来。 */
function delSampDoc(i) {
  var a = sampById(SAMP_CUR); if (!a || !a.docs) return;
  var d = a.docs[i];
  if (!d) return;
  a.docs.splice(i, 1);
  renderSampDocs();
  toast('已从档案移除「' + d.n + '」', 'warn');
}

/* 归档件走同一个确认框：它是**真实文件对象**，确认后由 dlSave() 直接交给浏览器。
   内置条目没有文件对象，不给确认框 —— 弹一个「确认下载」再告诉你没有文件，
   比直接说清楚更让人恼火。 */
function dlSampDoc(i) {
  var a = sampById(SAMP_CUR); if (!a || !a.docs) return;
  var d = a.docs[i];
  if (!d) return;
  if (!d.f) {
    toast('「' + d.n + '」是内置条目，只有元数据、没有实际文件；'
          + '你自己归档的文件才可以直接下载', 'warn');
    return;
  }
  var ext = String(d.n).split('.').pop().toUpperCase();
  DL_PEND = {
    name: d.n, fmt: ext, mime: d.f.type || 'application/octet-stream',
    src: '样本档案 › ' + SAMP_CUR + ' › 样本资料', blob: d.f,
    note: '你在本机选中的原件，' + d.who + ' 于 ' + d.t + ' 归档'
  };
  showModal('下载确认', dlModalBody(DL_PEND),
    '<button type="button" class="btn" data-close="modal">取消</button>'
    + '<button type="button" class="btn btn--primary" data-dl-go="1">' + ico('download') + '确认下载</button>');
}

/* ============================================================
   文件管理（样本档案 › 文件管理 tab）
   ============================================================
   三档可见范围就是权限模型：个人文件仅本人可见；团队文件按项目组
   共享、带上传人归属；系统文件是平台公共参考数据、只读。上传不限
   格式 —— file input 不设 accept，accept 留空即浏览器原生行为。
   内置条目只有元数据没有实体字节（与样本资料的内置归档件同一条
   规则，下载时如实告知）；本会话经 web 上传进来的文件保留 File
   对象，可以走真实下载。 */
var FM_SCOPE = 'mine';            // mine | team | sys
var FM_UP = 'web';                // web | ftp
var FM_LOC = { mine: '', team: '' };   // 上传位置：'' = 根目录，否则为文件夹名
var FM_Q = '';
var FM_PJ = '';                   // 团队列表的项目组筛选
var FM_PJ_UPLOAD = '';            // 团队上传的所属项目组（必选）
var FM_PEND = [];                 // 待上传清单（必需中间态：选错还来得及撤）
var FM_UPLOADED = [];             // 本会话上传成功的文件（带 File 对象）
var FM_EXP = {};                  // 文件夹展开态
var FM_NEWDIRS = { mine: [], team: [] };
var FM_DEL_REF = null;
var FM_RENAME_REF = null;

var FM_DATA = {
  mine: {
    dirs: ['S037 血浆 WGS', 'S068 肿瘤组织 WGS', '肝细胞癌 批次A'],
    files: [
      { n: 'S037_1.fastq.gz', sz: '913.3 MB', t: '2026-08-21 10:12', dir: 'S037 血浆 WGS' },
      { n: 'S037_2.fastq.gz', sz: '907.8 MB', t: '2026-08-21 10:31', dir: 'S037 血浆 WGS' },
      { n: 'S068_1.fastq.gz', sz: '925.1 MB', t: '2026-08-22 14:05', dir: 'S068 肿瘤组织 WGS' },
      { n: 'S068_2.fastq.gz', sz: '919.4 MB', t: '2026-08-22 14:26', dir: 'S068 肿瘤组织 WGS' },
      { n: 'batchA_manifest.tsv', sz: '48.2 KB', t: '2026-08-23 09:00', dir: '肝细胞癌 批次A' },
      { n: 'S052_1.fastq.gz', sz: '911.7 MB', t: '2026-08-25 16:40', dir: '' }
    ]
  },
  team: {
    dirs: ['肝癌免疫队列 WGS', '血清蛋白组 DIA'],
    files: [
      { n: 'cohort75_manifest.tsv', sz: '132.6 KB', t: '2026-08-18 16:10', who: '管理员', pj: '肝癌免疫队列', dir: '肝癌免疫队列 WGS' },
      { n: 'YSi1_1.fastq.gz', sz: '915.8 MB', t: '2026-06-05 10:53', who: 'admin', pj: '肝癌免疫队列', dir: '肝癌免疫队列 WGS' },
      { n: '共同样本清单_71例.xlsx', sz: '86.0 KB', t: '2026-08-20 11:02', who: '陈铭', pj: '肝癌免疫队列', dir: '肝癌免疫队列 WGS' },
      { n: 'DIA_运行报告_0818.pdf', sz: '2.1 MB', t: '2026-08-18 16:10', who: '项目负责人', pj: '血清蛋白组 DIA', dir: '血清蛋白组 DIA' },
      { n: '蛋白鉴定矩阵_常规肽段.csv', sz: '18.4 MB', t: '2026-08-19 09:22', who: '李蔚', pj: '血清蛋白组 DIA', dir: '血清蛋白组 DIA' }
    ]
  },
  sys: {
    /* 系统文件是平台公共参考数据：只读，也没有「新建文件夹」。
       「示例数据集」下再分三个子文件夹（v37）—— 院内队列是本院队列，
       人类 / 小鼠公开是内置公开数据集（PUB_DS），两边逐条对得上：
       点开哪个子夹，看到的就是数据汇集页里那几张卡背后的数据。 */
    dirs: ['示例数据集', '参考基因组', '注释与变异库'],
    sub: { '示例数据集': ['院内队列', '人类公开', '小鼠公开'] },
    files: [
      { n: 'TJ-TCM-WGS-75.vcf.gz', sz: '36.2 GB', t: '2026-08-12 09:00', dir: '示例数据集/院内队列' },
      { n: 'TJ-TCM-RNAseq-75_fpkm.tsv.gz', sz: '248.6 MB', t: '2026-08-12 09:12', dir: '示例数据集/院内队列' },
      { n: 'TJ-TCM-scRNA-lung-12.h5ad', sz: '4.8 GB', t: '2026-08-12 09:20', dir: '示例数据集/院内队列' },
      { n: 'TCGA-LIHC_STARcounts_421.tsv.gz', sz: '38.6 GB', t: '2026-08-10 08:00', dir: '示例数据集/人类公开' },
      { n: 'GTEx_v8_liver_TPM_184.tsv.gz', sz: '12.4 GB', t: '2026-08-10 08:00', dir: '示例数据集/人类公开' },
      { n: '1000G_phase3_chr1-22.vcf.gz', sz: '1.2 TB', t: '2026-08-10 08:00', dir: '示例数据集/人类公开' },
      { n: 'TabulaMuris_liver_100605cells.h5ad', sz: '46.2 GB', t: '2026-08-10 08:00', dir: '示例数据集/小鼠公开' },
      { n: 'GSE137385_fpkm_40samples.tsv.gz', sz: '9.8 GB', t: '2026-08-10 08:00', dir: '示例数据集/小鼠公开' },
      { n: 'GSE36838_expression_18samples.tsv.gz', sz: '4.6 GB', t: '2026-08-10 08:00', dir: '示例数据集/小鼠公开' },
      { n: 'hg38_GRCh38.fa.gz', sz: '912.6 MB', t: '2025-11-02 08:00', dir: '参考基因组' },
      { n: 'hg19_GRCh37.fa.gz', sz: '861.9 MB', t: '2025-11-02 08:00', dir: '参考基因组' },
      { n: 'mm10_GRCm38.fa.gz', sz: '798.3 MB', t: '2025-11-02 08:00', dir: '参考基因组' },
      { n: 'GENCODE_v44.gtf.gz', sz: '1.4 GB', t: '2025-11-03 08:00', dir: '注释与变异库' },
      { n: 'clinvar_202606.vcf.gz', sz: '486.2 MB', t: '2026-06-30 08:00', dir: '注释与变异库' }
    ]
  }
};

/* 二级文件夹（目前只有系统文件里的「示例数据集」）。路径统一写成
   「父名/子名」，文件用 dir 存整条路径 —— 展开态也按路径做 key，
   父子同名时不会串。 */
function fmSubs(scope, dn) { return ((FM_DATA[scope].sub || {})[dn] || []).slice(); }

function fmDirs(scope) {
  var d = FM_DATA[scope].dirs.slice();
  (FM_NEWDIRS[scope] || []).forEach(function (n) { if (d.indexOf(n) < 0) d.push(n); });
  FM_UPLOADED.forEach(function (u) {
    if (u.scope === scope && u.dir && d.indexOf(u.dir) < 0) d.push(u.dir);
  });
  return d;
}
function fmFiles(scope) {
  return FM_DATA[scope].files.concat(
    FM_UPLOADED.filter(function (u) { return u.scope === scope; })
      .map(function (u, i) { return { n: u.n, sz: u.sz, t: u.t, who: u.who, pj: u.pj, dir: u.dir, up: i }; })
  );
}
function fmLocName(scope) { return FM_LOC[scope] || '根目录'; }
function fmNow() {
  var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function renderFM() {
  /* v33：守卫从 #apanel-files 改为 #page-files —— 升为独立页后旧面板容器已不存在 */
  if (!$('#page-files')) return;
  $$('#fmSeg [data-fmscope]').forEach(function (b) {
    var on = b.getAttribute('data-fmscope') === FM_SCOPE;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  /* v56：系统文件从「整卡隐藏」改为「始终占位」——
     只读用户也要看到「为什么这里传不了」，整卡消失等于没有这条信息。
     因此列表卡不再需要独占整行（v33 那句 gridColumn = '1 / -1' 已随之撤掉）。
     能不能写由 fmCanWrite() 判；面板内容两种形态在 renderFMUp 里分。 */
  /* v56：新建文件夹跟着写权限走。按铁律「不隐藏、只禁用 + 说明原因」，
     这里不再按身份隐藏按钮 —— 隐藏会让只读者以为「这功能不存在」，
     而它对超级管理员明明是有的。 */
  var ndb = $('#fmTools [data-fm-newdir]');
  if (ndb) {
    var ndbWhy = FM_SCOPE === 'sys' ? fmWriteWhy() : '';
    ndb.disabled = !fmCanWrite();
    ndb.title = ndbWhy;
  }
  renderFMUp();
  $('#fmListT').textContent = { mine: '个人文件列表', team: '团队文件列表', sys: '系统文件列表' }[FM_SCOPE];
  /* v56：页头这句跟着范围 + 身份变，三档的读写差异不必点进去才发现。 */
  var hint = $('#fmScopeHint');
  if (hint) {
    hint.textContent = FM_SCOPE === 'sys'
      ? (fmCanWrite()
          ? '系统文件是平台公共参考数据，全体用户可查看与下载；当前身份（' + roleName() + '）可上传、修改与删除。'
          : '系统文件是平台公共参考数据，全体用户可查看与下载；当前身份（' + roleName() + '）只能查看，上传与修改需「超级管理员」。')
      : FM_SCOPE === 'team'
        ? '团队文件按项目组共享，上传人自动记录；上传时必须选择所属项目组，它决定哪些成员可见。'
        : '个人文件仅本人可见；上传到团队空间后按项目组共享。';
  }
  var pjSel = $('#fmPjFlt');
  pjSel.hidden = FM_SCOPE !== 'team';
  if (FM_SCOPE === 'team') {
    var pjs = [];
    FM_DATA.team.files.forEach(function (f) { if (f.pj && pjs.indexOf(f.pj) < 0) pjs.push(f.pj); });
    pjSel.innerHTML = '<option value="">全部项目组</option>' + pjs.map(function (p) {
      return '<option value="' + esc(p) + '"' + (p === FM_PJ ? ' selected' : '') + '>' + esc(p) + '</option>';
    }).join('');
  }
  /* v33：页签计数 #ptabNFiles 随独立成页一并退场，总数交给左栏徽章（navCount） */
  renderFMRows();
}

function renderFMUp() {
  var box = $('#fmUpBody'); if (!box) return;
  var hd = $('#fmUpCard .card__t'); if (hd) hd.textContent = FM_SCOPE === 'sys' ? '上传系统文件' : '上传文件';
  /* v56：系统文件只读时不给上传区，改成一句话说清「谁才能传」——
     权限不足不隐藏信息、也不假装这个功能不存在。 */
  if (FM_SCOPE === 'sys' && !fmCanWrite()) {
    box.innerHTML =
      '<div class="alert alert--warn" role="status">'
      + '<span class="alert__ico">' + ico('lock') + '</span>'
      + '<div class="alert__bd"><div class="alert__t">当前身份不能上传系统文件</div>'
      + '<p class="alert__p">' + esc(fmWriteWhy()) + '</p></div></div>'
      + '<p class="text-[12px] text-ink3 mt-3">系统文件是平台公共参考数据，全体用户都能查看与下载；'
      + '上传、修改、删除由「超级管理员」统一维护。</p>';
    return;
  }
  var scope = FM_SCOPE;
  box.innerHTML =
    '<div class="fmloc"><span class="fmloc__k">上传位置</span>'
    + '<span class="fmloc__n" id="fmLocName">' + esc(fmLocName(scope)) + '</span>'
    + '<button type="button" class="btn btn--sm" data-fm-loc>' + ico('folder-open') + '更改</button></div>'
    + (scope === 'team'
      ? '<div class="fld mt-3"><label class="fld__l" for="fmProjSel">所属项目组（必选，决定哪些成员可见）</label>'
        + '<select class="sel" id="fmProjSel"><option value="">选择项目组</option>'
        /* v47：与新建项目第 1 步读**同一份**名单（pgPickNames()）。
           原先这里写死两个名字，而新建项目那边是另一张写死的数组 ——
           同一个下拉在两个页面给出不同选项，用户只会觉得系统记性不好。 */
        + pgPickNames().map(function (p) {
            return '<option value="' + esc(p) + '"' + (p === FM_PJ_UPLOAD ? ' selected' : '') + '>' + esc(p) + '</option>';
          }).join('') + '</select></div>'
      : '')
    + '<div class="dz mt-3" id="fmDz" data-fm-drop role="button" tabindex="0" aria-label="选择要上传的文件">'
    + '<input type="file" id="fmFile" data-fm-file multiple tabindex="-1" class="dzf">'
    + '<div class="dz__ico">' + ico('cloud-arrow-up') + '</div>'
    + '<div class="dz__t">拖拽文件到此处，或点击选择文件</div>'
    + '<div class="dz__d">不限文件格式，可一次选多个</div>'
    + '</div>'
    + '<p class="text-[12px] text-ink3 mt-2">'
    + (scope === 'sys'
        ? '系统文件对全体用户可见，上传人自动记录；上传 / 修改 / 删除仅「超级管理员」可操作。'
        : scope === 'team'
        ? '团队文件对项目组内所有成员可见，上传人自动记录。'
        : '个人文件仅本人可见；移动或上传到团队空间后按项目组共享。')
    + '命名建议「样本ID_1 / 样本ID_2」（正 / 反向测序）。</p>'
    + '<div class="pendbox" id="fmPend"></div>'
    + '<button type="button" class="btn btn--primary w-full mt-3" data-fm-upload'
    + (FM_PEND.length ? '' : ' disabled') + '>' + ico('arrow-up-from-bracket') + '立即上传'
    + (FM_PEND.length ? '（' + FM_PEND.length + '）' : '') + '</button>';
  renderFMPend();
}

function renderFMPend() {
  var box = $('#fmPend'); if (!box) return;
  /* 立即上传按钮的状态与清单严格同步：空 = 置灰，非空 = 带计数。
     只在清单非空时更新按钮的话，删光待上传后按钮还挂着旧计数。 */
  var ub = $('[data-fm-upload]');
  if (ub) {
    ub.disabled = !FM_PEND.length;
    ub.innerHTML = ico('arrow-up-from-bracket') + '立即上传'
      + (FM_PEND.length ? '（' + FM_PEND.length + '）' : '');
  }
  if (!FM_PEND.length) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = '<div class="pendhd">待上传 ' + FM_PEND.length + ' 个</div>'
    + FM_PEND.map(function (d, i) {
        return '<div class="pendrow">' + ico('file')
          + '<span class="pendrow__n" title="' + esc(d.n) + '">' + esc(d.n) + '</span>'
          + '<span class="pendrow__s">' + esc(d.sz) + '</span>'
          + '<button type="button" class="iconbtn" data-fm-pend-del="' + i + '"'
          + ' aria-label="把这一份从待上传里去掉">' + ico('xmark') + '</button></div>';
      }).join('');
}

/* 列表行。返回 { rows, nF, nD }：rows 是展平的渲染序（dir 后跟其展开内容），
   nF / nD 是**筛选后**的文件、文件夹总数 —— 计数不随折叠状态变化，
   否则收起一个文件夹数字就变小，看着像文件丢了。文件带 src
   （dat=内置 / up=本会话上传），操作按钮经 ref 字符串找到它 ——
   重绘后 DOM 会换，ref 必须自包含。 */
function fmRows() {
  var scope = FM_SCOPE;
  var dirs = fmDirs(scope), files = fmFiles(scope);
  var q = FM_Q.trim().toLowerCase();
  if (scope === 'team' && FM_PJ) files = files.filter(function (f) { return f.pj === FM_PJ; });
  if (q) files = files.filter(function (f) { return f.n.toLowerCase().indexOf(q) >= 0; });
  var rows = [], hidden = 0, nSub = 0;
  dirs.forEach(function (dn) {
    var inside = files.filter(function (f) { return f.dir === dn; });
    /* 子文件夹：命中筛选的子夹（自己有命中文件，或子夹名本身命中）才留着 */
    var subs = fmSubs(scope, dn).map(function (sn) {
      var path = dn + '/' + sn;
      return { name: sn, path: path, files: files.filter(function (f) { return f.dir === path; }) };
    }).filter(function (s) {
      return !q || s.files.length || s.name.toLowerCase().indexOf(q) >= 0;
    });
    /* 有筛选时，既不含命中文件、自身名字也不命中的文件夹不显示 ——
       空文件夹挂在筛选结果里会让人以为筛 选没生效。 */
    var self = q && dn.toLowerCase().indexOf(q) >= 0;
    if (q && !inside.length && !self && !subs.length) { hidden++; return; }
    if (scope === 'team' && FM_PJ && !inside.length) { hidden++; return; }
    nSub += subs.length;
    var open = !!FM_EXP[dn];
    var leafN = inside.length + subs.reduce(function (a, s) { return a + s.files.length; }, 0);
    rows.push({ kind: 'dir', name: dn, n: leafN, sub: subs.length, open: open });
    if (!open) return;
    subs.forEach(function (s) {
      var so = !!FM_EXP[s.path];
      rows.push({ kind: 'sub', name: s.name, path: s.path, n: s.files.length, open: so, nest: 1 });
      if (so) s.files.forEach(function (f) { rows.push({ kind: 'file', f: f, nest: 2 }); });
    });
    inside.forEach(function (f) { rows.push({ kind: 'file', f: f, nest: 1 }); });
  });
  files.filter(function (f) { return !f.dir; })
    .forEach(function (f) { rows.push({ kind: 'file', f: f }); });
  return { rows: rows, nF: files.length, nD: dirs.length - hidden + nSub };
}

function fmRef(f) { return f.up != null ? 'f:up:' + f.up : 'f:dat:' + FM_DATA[FM_SCOPE].files.indexOf(f); }

function renderFMRows() {
  var head = $('#fmHead'), body = $('#fmBody'), count = $('#fmCount');
  if (!head || !body) return;
  head.innerHTML = '<th style="width:46%;">名称</th><th>大小</th><th>上传时间</th>'
    + (FM_SCOPE === 'team' ? '<th>上传人</th>' : '') + '<th style="width:170px;">操作</th>';
  var out = fmRows(), rows = out.rows;
  count.textContent = out.nF + ' 个文件 · ' + out.nD + ' 个文件夹';
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="5"><div class="pendempty">'
      + (FM_Q ? '没有匹配「' + esc(FM_Q) + '」的文件或文件夹' : '这里还没有文件') + '</div></td></tr>';
    return;
  }
  body.innerHTML = rows.map(function (r) {
    var nm, sz = '—', tm = '', who = '', ops;
    /* v56：系统文件的写权限（文件夹行与文件行共用一份判据）。
       其余两个范围是自己的数据，恒为可写。 */
    var canW = FM_SCOPE === 'sys' ? fmCanWrite() : true;
    var why = FM_SCOPE === 'sys' ? fmWriteWhy() : '';
    if (r.kind === 'dir' || r.kind === 'sub') {
      var isSub = r.kind === 'sub';
      nm = '<button type="button" class="linkbtn' + (isSub ? ' fmsub' : '') + '"'
        + ' data-fm-dirtoggle="' + esc(isSub ? r.path : r.name) + '"'
        + ' aria-expanded="' + (r.open ? 'true' : 'false') + '">'
        + ico(r.open ? 'chevron-down' : 'chevron-right') + ico('folder-open')
        + '<b>' + esc(r.name) + '</b><span class="text-ink3">（' + r.n + '）</span></button>';
      /* v56：系统文件的重命名 / 删除改为**按权限禁用并说明原因**，不再整列撤掉 ——
         只读用户仍要能看到「这两个动作存在、只是我不能点」，这比让它们凭空消失更清楚。 */
      ops = (canW
        ? '<button type="button" class="iconbtn" data-fm-rename="d:' + esc(isSub ? r.path : r.name) + '" aria-label="重命名文件夹" title="重命名">' + ico('pen') + '</button>'
          + '<button type="button" class="iconbtn" data-fm-del="d:' + esc(isSub ? r.path : r.name) + '" aria-label="删除文件夹" title="删除">' + ico('trash-can') + '</button>'
        : '<span class="iconbtn is-off" aria-disabled="true" title="' + esc(why) + '" role="img" aria-label="不可用：' + esc(why) + '">'
          + ico('pen') + '</span>'
          + '<span class="iconbtn is-off" aria-disabled="true" title="' + esc(why) + '" role="img" aria-label="不可用：' + esc(why) + '">'
          + ico('trash-can') + '</span>');
    } else {
      var f = r.f;
      nm = '<span class="' + (r.nest === 2 ? 'fmnest fmnest--2' : r.nest ? 'fmnest' : '') + '">' + ico('file-lines') + '<span title="' + esc(f.n) + '">' + esc(f.n) + '</span></span>';
      sz = esc(f.sz); tm = esc(f.t || ''); who = esc(f.who || '');
      ops = '<button type="button" class="iconbtn" data-fm-view="' + esc(fmRef(f)) + '" aria-label="预览" title="预览">' + ico('eye') + '</button>'
        + '<button type="button" class="iconbtn" data-fm-dl="' + esc(fmRef(f)) + '" aria-label="下载" title="下载">' + ico('download') + '</button>'
        /* v56：预览 / 下载对所有人开放（读），重命名 / 删除对系统文件按权限禁用。 */
        + (canW
          ? '<button type="button" class="iconbtn" data-fm-rename="f:' + esc(fmRef(f)) + '" aria-label="重命名" title="重命名">' + ico('pen') + '</button>'
            + '<button type="button" class="iconbtn" data-fm-del="f:' + esc(fmRef(f)) + '" aria-label="删除" title="删除">' + ico('trash-can') + '</button>'
          : '<span class="iconbtn is-off" aria-disabled="true" title="' + esc(why) + '" role="img" aria-label="不可用：' + esc(why) + '">'
            + ico('pen') + '</span>'
            + '<span class="iconbtn is-off" aria-disabled="true" title="' + esc(why) + '" role="img" aria-label="不可用：' + esc(why) + '">'
            + ico('trash-can') + '</span>');
    }
    return '<tr><td>' + nm + '</td><td>' + sz + '</td><td>' + tm + '</td>'
      + (FM_SCOPE === 'team' ? '<td>' + who + '</td>' : '')
      + '<td><span class="row" style="gap:2px;justify-content:center;">' + ops + '</span></td></tr>';
  }).join('');
}

/* ---------- 上传 ---------- */
function pushFMFiles(list) {
  /* v56：系统文件不再是「一律不能传」，而是「只有超级管理员能传」。
     这是第二道判断 —— 拖拽区、file input、选择器按钮在只读身份下都不渲染，
     但脚本仍可能直接调到这里，所以按钮禁用之外还得再判一次。 */
  if (FM_SCOPE === 'sys' && !fmCanWrite()) { toast(fmWriteWhy(), 'warn'); return 0; }
  var n = 0;
  Array.prototype.forEach.call(list || [], function (f) {
    FM_PEND.push({ n: f.name, sz: fmtSize(f.size), f: f });
    n++;
  });
  if (n) { renderFMPend(); toast('已加入待上传 ' + n + ' 个文件', 'ok'); }
  return n;
}

function commitFMUpload() {
  if (!FM_PEND.length) return;
  /* v56：与 pushFMFiles 配对的第二道，挡住脚本直调 commitFMUpload() 的路径。 */
  if (FM_SCOPE === 'sys' && !fmCanWrite()) { toast(fmWriteWhy(), 'warn'); return; }
  if (FM_SCOPE === 'team' && !(fv('#fmProjSel') || FM_PJ_UPLOAD)) {
    toast('团队文件必须先选择所属项目组 —— 这决定哪些成员可见', 'warn');
    return;
  }
  if (FM_SCOPE === 'team') FM_PJ_UPLOAD = fv('#fmProjSel') || FM_PJ_UPLOAD;
  var dir = FM_LOC[FM_SCOPE] || '';
  var t = fmNow();
  FM_PEND.forEach(function (d) {
    FM_UPLOADED.push({
      scope: FM_SCOPE, dir: dir, n: d.n, sz: d.sz, t: t,
      who: '我', pj: FM_SCOPE === 'team' ? FM_PJ_UPLOAD : '', f: d.f || null
    });
  });
  if (dir) FM_EXP[dir] = true;
  var n = FM_PEND.length;
  FM_PEND = [];
  renderFM();
  toast('已上传 ' + n + ' 个文件到「' + fmLocName(FM_SCOPE) + '」', 'ok');
}

/* ---------- 弹窗：上传位置 / 新建文件夹 / 重命名 / 删除 / 预览 ---------- */
function openFMLoc() {
  var rows = [''].concat(fmDirs(FM_SCOPE)).map(function (d) {
    var on = (FM_LOC[FM_SCOPE] || '') === d;
    return '<button type="button" class="fmlocrow' + (on ? ' is-on' : '') + '" data-fm-locpick="' + esc(d) + '">'
      + ico('folder-open') + '<span>' + esc(d || '根目录') + '</span>'
      + (on ? '<span class="tag tag--brand">当前</span>' : '') + '</button>';
  }).join('');
  showModal('更改上传位置',
    '<p class="text-[12px] text-ink3 mb-2">文件会传到所选文件夹；「根目录」即列表最上层。</p>'
    + '<div class="stack">' + rows + '</div>',
    '<button type="button" class="btn" data-close="modal">取消</button>');
}
function pickFMLoc(name) {
  FM_LOC[FM_SCOPE] = name || '';
  $('#modal').hidden = true;
  renderFMUp();
  toast('上传位置已改为「' + fmLocName(FM_SCOPE) + '」', 'ok');
}

function openFMNewDir() {
  /* v56：字典补 sys（v33 起这里只有两档，切到系统文件会显示「（undefined）」）。
     系统文件新建文件夹同样只有超级管理员能做。 */
  if (FM_SCOPE === 'sys' && !fmCanWrite()) { toast(fmWriteWhy(), 'warn'); return; }
  showModal('新建文件夹（' + { mine: '个人文件', team: '团队文件', sys: '系统文件' }[FM_SCOPE] + '）',
    fldInp('fmDirName', '文件夹名称', '', '例如：S076 验证批'),
    '<button type="button" class="btn" data-close="modal">取消</button>'
    + '<button type="button" class="btn btn--primary" data-fm-newdir-ok>' + ico('folder-open') + '创建</button>');
}
function commitFMNewDir() {
  var nm = (fv('#fmDirName') || '').trim();
  if (!nm) { toast('文件夹名称不能为空', 'warn'); return; }
  if (fmDirs(FM_SCOPE).indexOf(nm) >= 0) { toast('已有同名文件夹', 'warn'); return; }
  FM_NEWDIRS[FM_SCOPE].push(nm);
  $('#modal').hidden = true;
  renderFM();
  toast('文件夹「' + nm + '」已创建', 'ok');
}

function fmByRef(ref) {
  /* ref 与 fmRef()/行内 data 属性一一对应：d:<文件夹名> / f:dat:<i> / f:up:<i>。
     up 的 i 是「本会话、当前 scope」里上传列表的下标，重绘即重算，不跨帧保存。 */
  var c = ref.split(':'), kind = c[0];
  if (kind === 'd') return { kind: 'd', name: c.slice(1).join(':') };
  var i = Number(c[2]);
  if (c[1] === 'dat') return FM_DATA[FM_SCOPE].files[i] != null ? { kind: 'f', f: FM_DATA[FM_SCOPE].files[i] } : null;
  var ups = FM_UPLOADED.filter(function (u) { return u.scope === FM_SCOPE; });
  return ups[i] ? { kind: 'f', f: ups[i] } : null;
}

function openFMRename(ref) {
  /* v56：第二道 —— 只读身份下行内按钮是禁用态，这里再挡一次直调。 */
  if (FM_SCOPE === 'sys' && !fmCanWrite()) { toast(fmWriteWhy(), 'warn'); return; }
  var hit = fmByRef(ref);
  var cur = hit && hit.kind === 'd' ? hit.name : (hit && hit.f ? hit.f.n : '');
  if (!cur) return;
  FM_RENAME_REF = ref;
  showModal('重命名',
    fldInp('fmRenameInp', '新名称', cur),
    '<button type="button" class="btn" data-close="modal">取消</button>'
    + '<button type="button" class="btn btn--primary" data-fm-rename-ok>' + ico('pen') + '确定</button>');
}
function commitFMRename() {
  var nm = (fv('#fmRenameInp') || '').trim();
  var hit = FM_RENAME_REF && fmByRef(FM_RENAME_REF);
  if (!hit || !nm) { $('#modal').hidden = true; return; }
  if (hit.kind === 'd') {
    if (hit.name !== nm && fmDirs(FM_SCOPE).indexOf(nm) >= 0) { toast('已有同名文件夹', 'warn'); return; }
    var scope = FM_SCOPE;
    FM_DATA[scope].files.forEach(function (f) { if (f.dir === hit.name) f.dir = nm; });
    FM_UPLOADED.forEach(function (u) { if (u.scope === scope && u.dir === hit.name) u.dir = nm; });
    var di = FM_NEWDIRS[scope].indexOf(hit.name);
    if (di >= 0) FM_NEWDIRS[scope][di] = nm;
    else {
      var di0 = FM_DATA[scope].dirs.indexOf(hit.name);
      if (di0 >= 0) FM_DATA[scope].dirs[di0] = nm;
    }
    if (FM_LOC[scope] === hit.name) FM_LOC[scope] = nm;
    delete FM_EXP[hit.name];
  } else {
    hit.f.n = nm;
    if (hit.f.up != null) {
      var ups = FM_UPLOADED.filter(function (u) { return u.scope === FM_SCOPE; });
      if (ups[hit.f.up]) ups[hit.f.up].n = nm;
    }
  }
  FM_RENAME_REF = null;
  $('#modal').hidden = true;
  renderFM();
  toast('已重命名为「' + nm + '」', 'ok');
}

function openFMDel(ref) {
  /* v56：第二道 —— 系统文件的删除只对超级管理员开放。 */
  if (FM_SCOPE === 'sys' && !fmCanWrite()) { toast(fmWriteWhy(), 'warn'); return; }
  var hit = fmByRef(ref);
  var nm = hit && hit.kind === 'd' ? hit.name : (hit && hit.f ? hit.f.n : '');
  if (!nm) return;
  FM_DEL_REF = ref;
  showModal('删除确认',
    '<p>确定删除「<b>' + esc(nm) + '</b>」吗？'
    + (hit.kind === 'd' ? '文件夹内的文件会一并移除。' : '')
    + '此操作即时生效、不可撤销。</p>',
    '<button type="button" class="btn" data-close="modal">取消</button>'
    + '<button type="button" class="btn btn--danger" data-fm-del-ok>' + ico('trash-can') + '删除</button>');
}
function commitFMDel() {
  var hit = FM_DEL_REF && fmByRef(FM_DEL_REF);
  FM_DEL_REF = null;
  $('#modal').hidden = true;
  if (!hit) return;
  if (hit.kind === 'd') {
    var scope = FM_SCOPE;
    FM_DATA[scope].files = FM_DATA[scope].files.filter(function (f) { return f.dir !== hit.name; });
    FM_UPLOADED = FM_UPLOADED.filter(function (u) { return !(u.scope === scope && u.dir === hit.name); });
    FM_NEWDIRS[scope] = FM_NEWDIRS[scope].filter(function (n) { return n !== hit.name; });
    FM_DATA[scope].dirs = FM_DATA[scope].dirs.filter(function (n) { return n !== hit.name; });
    if (FM_LOC[scope] === hit.name) FM_LOC[scope] = '';
    delete FM_EXP[hit.name];
    toast('文件夹「' + hit.name + '」及其内容已删除', 'ok');
  } else {
    if (hit.f.up != null) {
      FM_UPLOADED = FM_UPLOADED.filter(function (u) { return u !== hit.f; });
    } else {
      var i = FM_DATA[FM_SCOPE].files.indexOf(hit.f);
      if (i >= 0) FM_DATA[FM_SCOPE].files.splice(i, 1);
    }
    toast('「' + hit.f.n + '」已删除', 'ok');
  }
  renderFM();
}

function viewFMFile(ref) {
  var hit = fmByRef(ref);
  if (!hit || hit.kind !== 'f') return;
  var f = hit.f;
  showModal('文件预览 · ' + f.n,
    '<div class="tblwrap"><table class="tbl"><tbody>'
    + '<tr><td>文件名</td><td>' + esc(f.n) + '</td></tr>'
    + '<tr><td>大小</td><td>' + esc(f.sz) + '</td></tr>'
    + '<tr><td>上传时间</td><td>' + esc(f.t || '—') + '</td></tr>'
    + (f.who ? '<tr><td>上传人</td><td>' + esc(f.who) + '</td></tr>' : '')
    + (f.pj ? '<tr><td>所属项目组</td><td>' + esc(f.pj) + '</td></tr>' : '')
    + '<tr><td>位置</td><td>' + esc({ mine: '个人', team: '团队', sys: '系统' }[FM_SCOPE]) + '文件 · ' + esc(f.dir || '根目录') + '</td></tr>'
    + '<tr><td>可见范围</td><td>' + esc({ mine: '仅本人', team: '项目组内成员', sys: '全体用户（只读）' }[FM_SCOPE]) + '</td></tr>'
    + '</tbody></table></div>'
    + '<p class="text-[12px] text-ink3 mt-3">原型内预览只展示元数据；接入对象存储后此处嵌入 FASTQ / VCF 质量摘要。</p>');
}

function dlFMFile(ref) {
  var hit = fmByRef(ref);
  if (!hit || hit.kind !== 'f') return;
  var f = hit.f;
  if (!f.f) {
    toast('「' + f.n + '」是内置条目，只有元数据、没有实际文件；'
          + '你自己上传的文件才可以直接下载', 'warn');
    return;
  }
  var ext = String(f.n).split('.').pop().toUpperCase();
  DL_PEND = {
    name: f.n, fmt: ext, mime: f.f.type || 'application/octet-stream',
    src: '样本档案 › 文件管理 › ' + fmLocName(FM_SCOPE), blob: f.f,
    note: '你在本会话上传的原件，' + f.t + ' 上传'
  };
  showModal('下载确认', dlModalBody(DL_PEND),
    '<button type="button" class="btn" data-close="modal">取消</button>'
    + '<button type="button" class="btn btn--primary" data-dl-go="1">' + ico('download') + '确认下载</button>');
}

/* ============================================================
   导出 / 下载：确认弹窗 + 真实产出
   ============================================================
   下载入口一律挂 data-dl="<key>"，点击先弹确认框（文件名 / 格式 / 体积 / 行数 /
   来源），确认之后才把文件交出去。内容全部从界面上已有的数据现算 —— 样本档案
   算 75 行、结果表序列化当前表格、导出结果打一个标准 ZIP；改筛选、改排序，
   导出的东西跟着变。只弹一句「已导出 xxx.tsv」是假按钮：说得出口，交不出东西。 */

var DL_PEND = null;
var DL_UNAVAIL = '当前视图里没有可导出的数据，已取消';

function dlCellText(c) { return String(c.textContent || '').replace(/\s+/g, ' ').trim(); }

/* 从按钮往上找**唯一**的那张表。撞见两张就放弃 ——
   宁可不出文件，也不导错表：导错了比不导更难发现。 */
function dlNearestTable(btn) {
  var el = btn && btn.parentNode;
  while (el && el !== document.body) {
    var t = el.querySelectorAll('table.tbl');
    if (t.length === 1) return t[0];
    if (t.length > 1) return null;
    el = el.parentNode;
  }
  return null;
}

function dlHead(tbl) {
  var rows = dlTableRows(tbl);
  return rows.length ? rows[0] : [];
}

/* 「操作 / 处理方式」这类列装的是界面动作（一键映射、排除…），不是数据：
   整列丢掉而不是留空 —— 留空会让导出的表多出一列空白，看着像缺数据。 */
var DL_ACTION_COLS = ['操作', '处理方式'];
function dlTableRows(tbl) {
  if (!tbl) return [];
  var out = [], i, j, cells, drop = {};
  var ths = tbl.querySelectorAll('thead th');
  if (ths.length) {
    cells = [];
    for (i = 0; i < ths.length; i++) {
      var h = dlCellText(ths[i]);
      if (DL_ACTION_COLS.indexOf(h) >= 0) { drop[i] = 1; continue; }
      cells.push(h);
    }
    out.push(cells);
  }
  var trs = tbl.querySelectorAll('tbody tr');
  for (i = 0; i < trs.length; i++) {
    if (trs[i].querySelector('.tempty')) continue;
    var tds = trs[i].querySelectorAll('td');
    cells = [];
    for (j = 0; j < tds.length; j++) { if (drop[j]) continue; cells.push(dlCellText(tds[j])); }
    if (cells.length) out.push(cells);
  }
  return out;
}

function dlTsv(rows) {
  return rows.map(function (r) {
    return r.map(function (c) { return String(c).replace(/[\t\r\n]+/g, ' '); }).join('\t');
  }).join('\n') + '\n';
}
function dlCsv(rows) {
  return rows.map(function (r) {
    return r.map(function (c) {
      var s = String(c).replace(/"/g, '""');
      return /[",\n]/.test(s) ? '"' + s + '"' : s;
    }).join(',');
  }).join('\n') + '\n';
}
function dlSafeName(s) {
  return String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').replace(/[（）()]+/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

/* ---------- 真实 ZIP（STORE 无压缩） ----------
   按钮写着 .zip，就得交出一个资源管理器 / unzip 能正常打开的文件。
   里面是文本与 SVG，用不着压缩。 */
var _CRC_T = null;
function crcTable() {
  if (_CRC_T) return _CRC_T;
  var t = new Uint32Array(256), n, k, c;
  for (n = 0; n < 256; n++) {
    c = n;
    for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  _CRC_T = t;
  return t;
}
function crc32(b) {
  var t = crcTable(), c = 0xFFFFFFFF, i;
  for (i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function utf8Bytes(s) {
  var out = [], i, c;
  for (i = 0; i < s.length; i++) {
    c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
    else out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return new Uint8Array(out);
}
function zipStore(files) {
  var now = new Date();
  var tm = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  var dt = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  var chunks = [], cd = [], off = 0;
  function u16(a, v) { a.push(v & 255, (v >>> 8) & 255); }
  function u32(a, v) { a.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); }
  files.forEach(function (f) {
    var name = utf8Bytes(f.name), data = f.data, crc = crc32(data);
    var lh = [];
    u32(lh, 0x04034b50); u16(lh, 20); u16(lh, 0x0800); u16(lh, 0);
    u16(lh, tm); u16(lh, dt); u32(lh, crc); u32(lh, data.length); u32(lh, data.length);
    u16(lh, name.length); u16(lh, 0);
    chunks.push(new Uint8Array(lh), name, data);
    var ch = [];
    u32(ch, 0x02014b50); u16(ch, 20); u16(ch, 20); u16(ch, 0x0800); u16(ch, 0);
    u16(ch, tm); u16(ch, dt); u32(ch, crc); u32(ch, data.length); u32(ch, data.length);
    u16(ch, name.length); u16(ch, 0); u16(ch, 0); u16(ch, 0); u16(ch, 0);
    u32(ch, 0); u32(ch, off);
    cd.push(new Uint8Array(ch), name);
    off += lh.length + name.length + data.length;
  });
  var cdSize = cd.reduce(function (a, x) { return a + x.length; }, 0);
  var eo = [];
  u32(eo, 0x06054b50); u16(eo, 0); u16(eo, 0);
  u16(eo, files.length); u16(eo, files.length);
  u32(eo, cdSize); u32(eo, off); u16(eo, 0);
  var all = chunks.concat(cd, [new Uint8Array(eo)]);
  var len = all.reduce(function (a, x) { return a + x.length; }, 0);
  var buf = new Uint8Array(len), p = 0;
  all.forEach(function (x) { buf.set(x, p); p += x.length; });
  return buf;
}

/* ---------- 体积 / 保存 ---------- */
function dlSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}
function dlBytesOf(b) {
  if (b.blob) return b.blob.size;
  if (b.bytes) return b.bytes.length;
  return utf8Bytes(b.text || '').length;
}
function dlSave(b) {
  var u = URL.createObjectURL(b.blob || new Blob([b.bytes || b.text], { type: b.mime }));
  var el = document.createElement('a');
  el.href = u; el.download = b.name;
  document.body.appendChild(el); el.click(); el.remove();
  /* 立刻 revoke 会让刚起步的下载取不到内容，留 4 秒 */
  setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
}

/* ---------- 各入口的文件规格 ---------- */
/* total = 源数据的全量条数。表格是「抽样展示」，导出的是**表里这些行** ——
   全量数字写在确认框里，用户点之前就知道这次拿到的是全量还是前若干条。 */
function dlSampQcTxt(st) { return st === 'danger' ? '不合格' : st === 'warn' ? '部分合格' : '合格'; }
function dlSampOmTxt(a) {
  return a.om.map(function (x) { return x.o + (x.miss ? '（缺）' : ''); }).join(' / ');
}
function dlSampRow(id) {
  var a = SAMP_ARCHIVE[id], m = a.meta || {};
  return [id, a.subj, (m.sex || '—') + ' / ' + (m.age == null ? '—' : m.age), a.dx,
          m.stage || '—', a.t, m.loc || '—', dlSampQcTxt(((m.qc || {}).st) || 'ok'),
          dlSampOmTxt(a), String((a.docs || []).length), ((m.consent || {}).st || '—')];
}

var DL = {
  /* 模块页的「导出本步清单」。导出的是**当前那一步**的东西：它在流程里的位置、
     命中的产出数据集、命中的运行记录。所以它必须跟着 PDSEC/PDMOD 走，
     不能把项目名或模块名写死在条目里 —— 那样导出的永远是同一份。 */
  modres: {
    name: 'project_step_result.tsv', fmt: 'TSV',
    src: '项目空间 › 项目管理 › 项目概况 › 分析结果',
    build: function () {
      var p = projById(PROJ_DETAIL_ID);
      if (!p || PDSEC !== 'result') return null;
      var mods = pdtModules(p), nm = mods[PDMOD] || '';
      if (!nm) return null;
      var d = pdtModData(p, nm);
      var rows = [
        ['# 模块信息', ''], ['项目编号', p.id], ['项目名称', p.n], ['模块', nm],
        ['在流程中的位置', (PDMOD + 1) + ' / ' + mods.length],
        ['模块状态', { ok: '完成', run: '运行中', bad: '失败', none: '未运行' }[d.st]], [],
        ['# 产出数据集', '名称', '类型', '元素', 'job', '产出时间']
      ];
      if (d.ds.length) d.ds.forEach(function (x) { rows.push(['', x.n, x.kind, String(x.el), x.job, x.t]); });
      else rows.push(['', '（这一步没有独立产出数据集）']);
      rows.push([], ['# 运行记录', '时间', '类型', '结果', '说明']);
      if (d.lg.length) d.lg.forEach(function (l) { rows.push(['', l[0], l[2], l[3], l[5]]); });
      else rows.push(['', '（这一步还没有运行记录）']);
      return {
        name: p.id + '_' + dlSafeName(nm) + '.tsv',
        text: dlTsv(rows), lines: d.ds.length + d.lg.length,
        note: nm + ' · 产出 ' + d.ds.length + ' 个数据集 · 运行记录 ' + d.lg.length + ' 条'
      };
    }
  },
  samples: {
    name: 'sample_registry_20260922.tsv', fmt: 'TSV',
    src: '数据资产 › 样本档案 › 样本档案',
    build: function () {
      var head = dlHead($('#sampTbl'));
      if (!head.length) return null;
      var ids = sampIds(), rows = ids.map(dlSampRow);
      return { text: dlTsv([head].concat(rows)), lines: rows.length, note: '档案内全部 ' + ids.length + ' 例样本' };
    }
  },
  samplist: {
    name: 'sample_list.tsv', fmt: 'TSV',
    src: '样本档案 › 样本列表（当前筛选与排序）',
    build: function () {
      var head = dlHead($('#sampTbl'));
      if (!head.length) return null;
      var ids = sampSorted(sampRows()), rows = ids.map(dlSampRow);
      var all = sampIds().length;
      return { text: dlTsv([head].concat(rows)), lines: rows.length,
               note: rows.length === all ? '未筛选，即全部 ' + all + ' 例' : '当前的筛选结果 ' + rows.length + ' / ' + all + ' 例' };
    }
  },
  runlog: {
    name: 'run_T-2409-018.log', fmt: 'LOG', mime: 'text/plain;charset=utf-8',
    src: '智能分析 › 任务运行 › 运行日志',
    build: function () {
      var box = $('#logBox'), lines = [];
      if (box) lines = String(box.textContent || '').split('\n').filter(function (x) { return x.trim(); });
      if (lines.length < 3) {
        lines = RUN_LOGS.map(function (r) {
          var s = r[0], mm = Math.floor(s / 60), ss = s % 60;
          var lv = String(r[1]); while (lv.length < 5) lv += ' ';
          return '[' + p2(mm) + ':' + p2(ss) + '] ' + lv + r[2];
        });
      }
      return { text: '# 任务 T-2409-018 · 差异表达分析 · 75 例样本\n' + lines.join('\n') + '\n', lines: lines.length };
    }
  },
  /* 任务运行页 › 对齐明细。这张表是**静态三行**（三组学各一行），
     不是抽样展示 —— total 就等于表内条数，确认框里不会出现
     「表内 N 行 · 源数据全量 M」那种暗示还有更多的说法。
     v46 补：这个入口一直写在 HTML 里（`data-dl="alignmatrix"`），
     但 DL 里**没有同名条目** → `dlOpen()` 头一行 `if (!spec) return;`
     直接返回，点了毫无反应，连「暂不可用」的提示都没有。
     它被旧断言盖了很久：「下载入口齐备」原先只**数个数**
     （13 个入口、13 条注册，个数相等就过），而其中一颗挂的是空 key。
     v46 把那条断言改成「注册项 vs 界面入口的**集合**比对」才抓出来。 */
  alignmatrix: {
    name: 'align_matrix.tsv', fmt: 'TSV',
    src: '智能分析 › 任务运行 › 对齐明细',
    build: function (b) { return dlFromTable(b, 3, null, '#alignTbl'); }
  },
  resultzip: {
    name: 'T-2409-018_result.zip', fmt: 'ZIP', mime: 'application/zip',
    src: '项目详情 › 分析结果 › 结果全景（图与数据表）',
    build: function () {
      /* v42：结果全景从独立页搬进了项目详情层的模块页，导出源跟着走 ——
         读挂载容器，不读页面 id。没进那一页时容器不存在，返回 null。 */
      var page = $('#panoMount'); if (!page) return null;
      var files = [], nImg = 0, nTbl = 0, seen = {};
      var charts = page.querySelectorAll('.chartbox svg.chart');
      [].forEach.call(charts, function (svg, i) {
        var card = svg.closest('.card');
        var t = card && card.querySelector('.card__t') ? dlCellText(card.querySelector('.card__t')) : ('chart-' + (i + 1));
        var nm = dlSafeName(t) || ('chart-' + (i + 1));
        while (seen[nm]) nm += '_';
        seen[nm] = 1;
        /* 内联 SVG 没有 xmlns，单独打开会白屏；补上才算一个能看的文件 */
        var txt = svg.outerHTML;
        if (txt.indexOf('xmlns=') < 0) txt = txt.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
        files.push({ name: nm + '.svg', data: utf8Bytes('<?xml version="1.0" encoding="UTF-8"?>\n' + txt) });
        nImg++;
      });
      var tbls = page.querySelectorAll('table.tbl');
      [].forEach.call(tbls, function (tb) {
        var rows = dlTableRows(tb);
        if (rows.length < 2) return;
        var card = tb.closest('.card');
        var t = card && card.querySelector('.card__t') ? dlCellText(card.querySelector('.card__t')) : 'table';
        var nm = dlSafeName(t) || 'table';
        var k = 1, base = nm;
        while (seen[nm]) { nm = base + '_' + k; k++; }
        seen[nm] = 1;
        files.push({ name: nm + '.tsv', data: utf8Bytes(dlTsv(rows)) });
        nTbl++;
      });
      if (!files.length) return null;
      var bytes = zipStore(files);
      return { bytes: bytes, lines: files.length,
               note: '含 ' + nImg + ' 张图（SVG）与 ' + nTbl + ' 张数据表（TSV）' };
    }
  },
  patho:   { name: 'pathogenic_variants.tsv', fmt: 'TSV', src: '结果全景 › 基因变异 › 高等级变异清单', total: 111,
             build: function (b) { return dlFromTable(b, 111, null, '#pathoTbl'); } },
  diffgenes: { name: 'diff_genes.tsv', fmt: 'TSV', src: '结果全景 › 差异表达 › 差异基因清单', total: 1247,
             build: function (b) { return dlFromTable(b, 1247, null, '#diffGeneTbl'); } },
  enrich:  { name: 'enrichment_result.tsv', fmt: 'TSV', src: '结果全景 › 富集分析 › 显著通路清单', total: 233,
             build: function (b) { return dlFromTable(b, 233, null, '#enrichTbl'); } },
  diffprot: { name: 'diff_proteins.tsv', fmt: 'TSV', src: '结果全景 › 蛋白组 › 差异蛋白清单', total: 318,
             build: function (b) { return dlFromTable(b, 318, null, '#protTbl'); } },
  diffmeta: { name: 'diff_metabolites.tsv', fmt: 'TSV', src: '结果全景 › 代谢组 › 差异代谢物清单', total: 143,
             build: function (b) { return dlFromTable(b, 143, null, '#metabTbl'); } },
  kbresult: {
    name: 'kb_result_20260914.csv', fmt: 'CSV',
    src: '知识赋能 › 医学知识库 › 知识清单',
    build: function () {
      if (!KB_STORE || !KB_STORE.length) return null;
      var rows = [['编号', '标题', '分类', '来源', '证据强度', '关联实体数', '来源说明']];
      KB_STORE.forEach(function (k) {
        rows.push([k.id, k.t, (KB_CATS[k.cat] ? KB_CATS[k.cat].n : '知识'), k.src, k.conf, String(k.ev), k.s]);
      });
      return { text: dlCsv(rows), lines: KB_STORE.length, note: '检索命中 ' + KB_STORE.length + ' 条' };
    }
  },
  trace: {
    name: 'trace_T-2409-018.json', fmt: 'JSON', mime: 'application/json;charset=utf-8',
    src: '结果全景 › 运行详情（数据版本 / 参数快照 / 中间产物）',
    build: function () {
      var d = $('#drawerTrace'); if (!d) return null;
      var out = { task: 'T-2409-018', exported_at: nowStr() }, used = 0;
      var blocks = d.querySelectorAll('.drawer__bd .stack > div');
      [].forEach.call(blocks, function (blk) {
        var t = blk.querySelector('.card__t');
        var tb = blk.querySelector('table.tbl');
        if (!t || !tb) return;
        var rows = dlTableRows(tb);
        if (rows.length < 2) return;
        var key = dlCellText(t), arr = [], hasHead = !!tb.querySelector('thead th');
        rows.slice(1).forEach(function (r) {
          if (hasHead) { var o = {}; rows[0].forEach(function (h, i) { o[h] = r[i] || ''; }); arr.push(o); }
          else arr.push({ 项目: r[0] || '', 值: r[1] || '' });
        });
        out[key] = arr; used++;
      });
      if (!used) return null;
      return { text: JSON.stringify(out, null, 2) + '\n', lines: used, note: '含 ' + used + ' 组溯源信息' };
    }
  },
  template: {
    name: 'phenotype_template.csv', fmt: 'CSV',
    src: '数据汇集 › 文件格式校验 › 下载格式模板',
    build: function () {
      var rows = [['sample_id', 'subject_id', 'group', 'sex', 'age', 'stage', 'collection_date', 'material', 'batch']];
      sampIds().slice(0, 6).forEach(function (id) {
        var a = SAMP_ARCHIVE[id], m = a.meta || {};
        rows.push([id, a.subj, 'tumor', (m.sex === '女' ? 'F' : 'M'), String(m.age == null ? '' : m.age),
                   m.stage || '', a.t, a.mat, 'B' + (1 + (parseInt(id.slice(1), 10) % 4))]);
      });
      rows.push(['…', '…', '…', '…', '…', '…', '…', '…', '…']);
      return { text: dlCsv(rows), lines: rows.length - 1, note: '列名 + 6 行样例（末行为占位，请补全后上传）' };
    }
  }
};
function dlTblOf(btn, sel) {
  if (btn) { var t = dlNearestTable(btn); if (t) return t; }
  return sel ? $(sel) : null;
}
function dlFromTable(btn, total, noteTpl, sel) {
  var rows = dlTableRows(dlTblOf(btn, sel));
  if (rows.length < 2) return null;
  var n = rows.length - 1;
  var note = noteTpl ? noteTpl.replace('N', n)
    : ('表内 ' + n + ' 行' + (total && total > n ? ' · 源数据全量 ' + fmtNum(total) : ''));
  return { text: dlTsv(rows), lines: n, note: note };
}

/* ---------- 确认弹窗 ---------- */
function dlModalBody(b) {
  var rows = [
    ['文件名', b.name],
    ['格式', b.fmt + (b.lines != null ? ' · ' + fmtNum(b.lines) + ' 行' : '')],
    ['体积', dlSize(dlBytesOf(b))],
    ['来源', b.src]
  ];
  if (b.note) rows.push(['说明', b.note]);
  return '<div class="tblwrap"><table class="tbl"><tbody>'
    + rows.map(function (r) {
        return '<tr><td class="nw">' + esc(r[0]) + '</td><td class="num">' + esc(r[1]) + '</td></tr>';
      }).join('')
    + '</tbody></table></div>';
}

function dlOpen(key, btn) {
  var spec = DL[key];
  /* 未知 key 必须吵一声，不能静默返回 ——「按钮点了没反应」是最难查的一种坏：
     界面看着有入口、代码看着有分支，只是两边挂的 key 对不上。
     （v46 之前的 `alignmatrix` 就是这样：HTML 上有按钮、DL 里没有条目，
       而这条 `return` 把它咽掉了。verify 的「下载入口齐备」改成集合比对后才抓到。） */
  if (!spec) { toast(DL_UNAVAIL, 'warn'); return; }
  var built = null;
  try { built = spec.build(btn); } catch (err) { built = null; }
  if (!built) { toast(DL_UNAVAIL, 'warn'); return; }
  built.name = built.name || spec.name;
  built.fmt = built.fmt || spec.fmt;
  built.src = built.src || spec.src;
  built.mime = built.mime || spec.mime || 'text/plain;charset=utf-8';
  DL_PEND = built;
  showModal('下载确认', dlModalBody(built),
    '<button type="button" class="btn" data-close="modal">取消</button>'
    + '<button type="button" class="btn btn--primary" data-dl-go="1">' + ico('download') + '确认下载</button>');
}

/* ============================================================
   v58 · 知识赋能三页：外部系统挂载
   ============================================================
   需求原文：「把原先的『医学知识库』『自有知识库』和『知识图谱』直接对接到
   77.144 的三个独立路径，分别是 ke、kb 和 kg。把 menu 参数去掉，然后在右侧
   工作区展示外部页面（保持左侧菜单布局）使外部接入部分和当前系统更像一个整体」。

   三个要点各自对应一个实现决定：
   ① 「右侧工作区展示」→ 用 iframe 而不是跳外链。跳外链会把整站布局丢掉，
      那就不是「一个整体」；iframe 让左栏、面包屑、顶栏都还在。
   ② 「更像一个整体」→ 页内保留站内那份（切换器），不做「整页替换」。
      内网地址在别人机器上未必可达，全撤掉就只剩三张白页。
   ③ iframe 的 src 由 KB_EXT_BASE + KB_EXT 拼出，HTML 里不写死地址。

   跨域的硬约束：iframe 能否显示取决于外部系统的 X-Frame-Options /
   Content-Security-Policy: frame-ancestors —— 那是响应头，前端绕不过。
   实测三个路径均未下发这两条头（见§50），所以可挂载。将来若对方加上了，
   这里的表现就是 kbfail 失败态（浏览器直接拒绝，onload 不会触发）。 */

/* 加载超时：外部系统慢时不能一直停在「正在加载」。内网首屏可能要几秒，
   给 8 秒；超时即判失败并显示可点的重试。 */
var KB_LOAD_TIMEOUT = 8000;
var KB_LOADED = {};      /* 每页是否已成功加载过 —— 决定还要不要兜底计时器 */
var KB_TIMER = {};       /* 每页的兜底计时器 id */

/* 把一页切到 ext（外部系统）/ local（站内版本）。
   两块内容是**同一页内的两个区域**，所以用 hidden 收放而不是换页 ——
   换页会丢滚动位置、面包屑也会多出一级。 */
function setKbView(id, v) {
  if (!KB_EXT[id]) return;
  KBMODE[id] = (v === 'local') ? 'local' : 'ext';
  var page = $('#page-' + id);
  if (!page) return;
  page.setAttribute('data-kbview', KBMODE[id]);
  var frame = $('#kbframe-' + id);
  var local = $('[data-kblocal]', page);
  if (frame) frame.hidden = (KBMODE[id] !== 'ext');
  if (local) local.hidden = (KBMODE[id] === 'ext');
  /* 切换器自身的选中态：aria-selected 要跟着走，否则读屏读到的还是旧的那一档 */
  $$('.seg__b[data-kbview]', page).forEach(function (b) {
    var on = b.getAttribute('data-kbview') === KBMODE[id];
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  /* 站内那份里的图表按容器实际宽度画（藏在 display:none 里量到 0 宽，
     画出来是挤成一条线的图）—— 所以「切回站内」这一下必须重画。
     renderChart(host) 只收宿主元素，视图类型从 host 的 data-chart 读。 */
  if (KBMODE[id] === 'local') {
    var g = $('#kbGraph');
    if (g) renderChart(g);
    if (id === 'kbmed') renderKb2();
  } else {
    mountKbFrame(id);
  }
}

/* 挂载 iframe。第一次进来才写 src：同一页反复进出不该反复重载外部系统
   —— 那会让用户每次切菜单都等一遍网络。 */
function mountKbFrame(id) {
  var f = $('#kbframe-' + id);
  if (!f) return;
  var el = $('[data-kbframeel]', f);
  var url = kbExtUrl(id);
  var uTxt = $('[data-kburl]', f);
  var aTxt = $('[data-kbfailaddr]', f);
  if (uTxt) uTxt.textContent = url;
  if (aTxt) aTxt.textContent = url;
  $$('[data-kbframeopen]', f).forEach(function (a) { a.href = url; });
  if (!el) return;
  if (el.getAttribute('src') === url) { kbFrameOk(id); return; }
  kbFrameLoading(id);
  el.setAttribute('src', url);
}

function kbFrameLoading(id) {
  var f = $('#kbframe-' + id);
  if (!f) return;
  KB_LOADED[id] = false;
  var ph = $('[data-kbph]', f), fail = $('[data-kbfail]', f);
  if (ph) ph.hidden = false;
  if (fail) fail.hidden = true;
  if (KB_TIMER[id]) clearTimeout(KB_TIMER[id]);
  /* onload 在「被拒绝」时**不会**触发（X-Frame-Options 拒绝、连接失败、
     DNS 不通都是直接拒绝），所以「没等到 load」本身就是失败信号 ——
     必须有兜底计时器，否则失败态永远不显示。 */
  KB_TIMER[id] = setTimeout(function () {
    if (!KB_LOADED[id]) kbFrameFail(id);
  }, KB_LOAD_TIMEOUT);
}
function kbFrameOk(id) {
  var f = $('#kbframe-' + id);
  if (!f) return;
  KB_LOADED[id] = true;
  if (KB_TIMER[id]) { clearTimeout(KB_TIMER[id]); KB_TIMER[id] = null; }
  var ph = $('[data-kbph]', f), fail = $('[data-kbfail]', f);
  if (ph) ph.hidden = true;
  if (fail) fail.hidden = true;
}
function kbFrameFail(id) {
  var f = $('#kbframe-' + id);
  if (!f) return;
  var ph = $('[data-kbph]', f), fail = $('[data-kbfail]', f);
  if (fail) fail.hidden = false;
  if (ph) ph.hidden = true;
}

/* 三个页面各挂一次事件：iframe 的 load / error。
   注意：**故意不校验跨域可达性**（拿不到跨域响应头），失败一律靠上面的
   兜底计时器判定 —— 这是浏览器给的唯一可靠信号。 */
function initKbFrames() {
  $$('[data-kbframe]').forEach(function (f) {
    var id = f.getAttribute('data-kbframe');
    var el = $('[data-kbframeel]', f);
    if (el) el.addEventListener('load', function () { kbFrameOk(id); });
    /* 首次进入默认停在外部视图，所以先挂上再挂载 */
    mountKbFrame(id);
  });
  /* 页头「外部系统 / 站内版本」切换 */
  $$('.seg__b[data-kbview]').forEach(function (b) {
    b.addEventListener('click', function () {
      var page = b.closest('.page');
      if (page) setKbView(page.id.replace('page-', ''), b.getAttribute('data-kbview'));
    });
  });
  /* 「重新加载」：清掉 src 再写，逼浏览器重新请求 —— 直接改同一个 src
     值浏览器可能不再发请求。 */
  $$('[data-kbreload]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var f = btn.closest('[data-kbframe]');
      if (!f) return;
      var id = f.getAttribute('data-kbframe');
      var el = $('[data-kbframeel]', f);
      if (!el) return;
      kbFrameLoading(id);
      el.removeAttribute('src');
      /* 下一帧再写回去：同一 tick 内remove→set 浏览器可能不认这次变更 */
      requestAnimationFrame(function () { el.setAttribute('src', kbExtUrl(id)); });
    });
  });
  setKbView('kbmed', 'ext');
  setKbView('kbown', 'ext');
  setKbView('kbgraph', 'ext');
}

/* ============================================================
   初始化
   ============================================================ */
function init() {
  fillTables();
  renderPipe();
  renderStepper();
  $$('.chartbox').forEach(renderChart);
  updateExpect();

  /* 内置公开数据集与参考基因组（数据汇集的两个内置来源） */
  renderPubGroups();
  renderRefGrid();

  /* 知识赋能三页（kbmed / kbown / kbgraph） */
  renderKbNodes();
  renderKb2();
  initKbFrames();  /* v58：三页挂外部系统 /ke /kb /kg，默认停在外部视图 */

  /* 外壳：左栏分组导航、p04 内嵌流程编排、运行历史抽屉、当前用户（v54） */
  initOrchExt();       /* v60：外部编排系统的 iframe load 监听（默认不挂载，点全屏才进） */
  renderUserSw();      /* 顶栏身份按钮与三选项菜单（唯一身份入口） */
  renderNav();
  syncLinAxis();       /* 方向按钮的图标与文案由 JS 生成，起步时先对齐一次 */
  initOrch();
  renderHist();
  renderProj();
  fillSampFilters();   /* 疾病下拉从数据现算，必须在 renderArch() 之前 */
  renderArch();
  renderFM();          /* v33：文件管理独立成页，不再搭样本档案的渲染车 */
  renderSample();          /* 样本管理页（留页面不进菜单，hash 直达不断） */
  renderDemoSet();         /* v40：示例数据集设置页 + 前台卡片的首次同步 */
  renderProjGroups();      /* v47：项目组管理页（系统管理组） */
  renderP02Pick();         /* v50：数据汇集页的选数据面板（首屏就要有东西可点） */
  renderLog();
  renderAgent();

  /* 日志初始内容。v54：原来这里按「临床医生视角」把日志默认收起 ——
     视角概念已撤，日志统一**默认展开**（它是这一页的主要内容），
     收起 / 展开由卡片头那颗按钮控制，与角色无关。 */
  var lb = $('#logBox');
  if (lb) {
    lb.innerHTML = '';
    [[0, 'INFO', '任务已提交  等待调度'], [1, 'INFO', '参数快照已冻结  6 项'], [2, 'INFO', '数据集 TJ-TCM-2026 v2.1  71 例共同样本']]
      .forEach(function (l) { logLine(l[0], l[1], l[2]); });
  }

  var h = (location.hash || '').replace('#', '');
  goto(PAGES[h] ? h : 'p01');

  /* 交给验证脚本的运行时自检信号：初始化若中途抛错，__initDone 就不会是 true。
     __goto 用于直达不在左栏菜单里的页面（如「样本管理」），否则验证脚本只能
     通过点击导航按钮跳页，菜单外的页面就永远测不到。 */
  window.__chartErr = CHART_ERR;
  window.__goto = goto;
  /* 界面上已无返回按钮，但来路栈仍是可驱动的状态：自动化要能把导航状态归零、
     并直接读走栈，否则跨页用例的起点只能靠「点一串导航碰出来」。 */
  window.__back = goBack;
  window.__goHome = goHome;
  window.__navState = function () { return { cur: NAVCUR, hist: NAVHIST.slice() }; };
  /* 自编排画布的状态与落点。截图与断言都需要一个「还原到某条模板」的入口 ——
     靠点一串按钮把画布拼回原样，等于让验证脚本自己实现一遍编辑器逻辑。 */
  window.__orchPick = pickFlow;
  /* 撤掉「保存为自定义流程」留下的草稿。截图定妆照不该带探针存下的第十三条流程，
     跑了两遍验证也会累积成 14、15 条 —— 图片里的数字就再也不是产品本来的样子。 */
  window.__orchForget = function () {
    for (var i = FLOWS.length - 1; i >= 0; i--) { if (FLOWS[i].saved) FLOWS.splice(i, 1); }
    if (!orchFlowById(CANVAS.base)) loadFlow(DEFAULT_FLOW);
    renderOrch();
    return FLOWS.length;
  };
  window.__orchState = function () {
    return { base: CANVAS.base, steps: CANVAS.nodes.length,
             links: CANVAS.links.length, flows: FLOWS.length };
  };
  /* v60：外部编排系统挂载态。不传参 = 纯读；传 view 才切视图。
     读数含实际 iframe 的 src —— 产物 HTML 里没有 src 属性（运行时写入），
     这是唯一能在运行时证到「真的挂到了那个地址」的办法。
     **刻意不报「iframe 加载成功与否」**：目标地址能否达取决于跑回归的机器
     有没有接那个网络，那是环境不是缺陷，写进断言等于埋一颗换台机器就红的雷。 */
  window.__orchExt = function (view) {
    if (view !== undefined) setOrchExt(view === 'ext');
    var box = $('#orch'), f = $('#orchExt'), el = $('[data-orchextel]');
    return {
      url: ORCH_EXT_URL,
      mounted: !!el && el.getAttribute('src') === ORCH_EXT_URL,
      src: el ? (el.getAttribute('src') || '') : '',
      extHidden: f ? !!f.hidden : null,
      bodyHidden: !!(box && $('.orch__b', box) && $('.orch__b', box).hidden),
      view: box ? box.getAttribute('data-orchview') : null,
      full: !!(box && box.classList.contains('is-full')),
      failShown: !!($('[data-orchextfail]') && !$('[data-orchextfail]').hidden),
      backBtns: $$('[data-orchext-back]').length,
      opens: $$('[data-orchext-open]').filter(function (a) { return a.getAttribute('href') === ORCH_EXT_URL; }).length
    };
  };
  /* 面包屑可点段的落点。断言「哪些段存在」要能从外部独立算一遍：
     若拿产品里的判据照抄一遍，就只测出了自洽，测不出对错。 */
  window.__crumbSegs = function (id) { return crumbSegs(id || NAVCUR); };
  /* 项目视图 / 详情抽屉要能被验证脚本驱动：点卡片只能测「打开」这一态，
     空名称守卫、列表视图、Esc 分层这些边界得从外面看一眼才测得到 */
  window.__projState = function () {
    var cp = curProj();
    return { view: PROJ_VIEW, n: PROJECTS.length, cur: cp ? cp.id : '',
             ids: PROJECTS.map(function (p) { return p.id; }) };
  };
  window.__projOpen = openProjDetail;
  /* 项目概况页（v39）：切页签只能点，边界（无效页签、不带项目号直达）得从外面看 */
  /* 项目概况页（v39 立页 / v41 加项目专属左栏）。
     不传参 = 纯读（只回报状态）；传参才动作。
     sec 与 mod 都是「传了才动」，所以可以只读不切页 —— 判定段里两条断言
     先读左栏、再切模块，互不干扰。 */
  window.__projDetail = function (pid, tab, sec, mod) {
    if (pid) openProjDetail(pid);
    if (tab !== undefined) setProjTab(tab);
    if (sec !== undefined) setProjSec(sec);
    if (mod !== undefined) setProjMod(mod);
    var body = $('#projBody');
    var p = projById(PROJ_DETAIL_ID);
    var mods = pdtModules(p), mi = Math.max(0, Math.min(PDMOD, mods.length - 1));
    var tabsBox = $('#projTabs'), stepsBox = $('#projSteps');
    return {
      id: PROJ_DETAIL_ID, tab: PDTAB,
      sec: PDSEC, mod: PDMOD,
      on: !!($('#page-projdetail') && $('#page-projdetail').classList.contains('is-on')),
      /* v44：页头三处（大标题 / 英文小标 / 面包屑末段）都要跟着左栏走，
         所以每次导航探针都顺带回报一次 —— 分开读就等于漏报。
         ⚠ 这几个键名**不能叫 head / eye / crumb**：驱动段里 `R.projMod.head`
         已经占给了「已完成模块数」，撞名会被静默覆盖 —— 断言读到一个
         语法正确、语义无关的真数字，比读到 `<缺失>` 更难发现。 */
      title:      (function () { var e = $('#projH1');  return e ? e.textContent.trim() : ''; })(),
      titleEye:   (function () { var e = $('#projEye'); return e ? e.textContent.trim() : ''; })(),
      titleCrumb: (function () { var e = $('#crumb');  return e ? e.textContent.trim() : ''; })(),
      /* v45：页头那颗全景按钮**此刻是否真的看得见**。
         它不再靠「渲不渲染」来决定在不在（那会连状态徽章一起重画），
         而是常驻 DOM、靠 hidden 隐去 —— 所以这里必须按「hidden + 真有宽度」
         来量，只数 `#projActs [data-proj-pano]` 的命中数会恒为 1，
         按钮明明藏了断言还绿。 */
      panoN: (function () {
        var b = $('#projPanoBtn');
        if (!b || b.hidden) return 0;
        return b.getBoundingClientRect().width > 0 ? 1 : 0;
      })(),
      /* 左栏：这一层是项目自己的菜单 —— 三个入口 + 模块清单 */
      nav: $$('#navBody [data-pds]').map(function (b) { return b.getAttribute('data-pds'); }),
      navMods: $$('#navBody [data-pdmod] .snav__t').map(function (x) { return x.textContent.trim(); }),
      navOn: (function () {
        var b = $('#navBody [aria-current="page"]');
        return b ? (b.getAttribute('data-pds') || ('mod:' + b.getAttribute('data-pdmod'))) : '';
      })(),
      tabs: $$('#projTabs .ptab').map(function (b) { return b.getAttribute('data-pdt'); }),
      tabsHidden: !!(tabsBox && tabsBox.hidden),
      steps: $$('#projSteps [data-pdmod] .psteps__t').map(function (x) { return x.textContent.trim(); }),
      stepsHidden: !!(stepsBox && stepsBox.hidden),
      stepOn: (function () {
        var b = $('#projSteps .psteps__n.is-on .psteps__t');
        return b ? b.textContent.trim() : '';
      })(),
      panels: $$('#projBody .pjpanel').map(function (b) { return b.getAttribute('data-pdtpanel'); }),
      shown: $$('#projBody .pjpanel.is-on').map(function (b) { return b.getAttribute('data-pdtpanel'); }),
      secs: body ? $$('#projBody .pd__sec').map(function (x) { return x.textContent.trim(); }) : [],
      /* 模块页的真实内容：标题、上下游那句、本步产出与运行记录的行数 */
      modTitle: mods[mi] || '',
      modPos: body ? (function () { var e = body.querySelector('.pd__sec + .text-\\[12px\\]'); return e ? e.textContent.trim() : ''; })() : '',
      modDs: $$('#projBody [data-pmodds] tr').length,
      modLg: $$('#projBody [data-pmodlg] tr').length,
      modEmpties: $$('#projBody .pd__empty').length,
      modSt: (function () {
        var e = $('#projBody .pdmod__bar .pd__st .tag');
        return e ? e.textContent.trim() : '';
      })(),
      prog: $$('#projBody .pdmod__c').map(function (x) { return x.textContent.trim(); }),
      /* 模块清单本身（供「现算」类断言比对：它必须等于主流程节点去输入项） */
      mods: mods,
      primFlow: (function () { var f = projFlows(p)[0]; return f ? { id: f.id, n: f.n, nodes: f.nodes.length } : null; })()
    };
  };
  /* 「没绑流程的项目」长什么样（v47）。
     为什么需要这个探针：v47 把向导扩成 6 步，第 4 步「流程模版」是**必选**，
     于是「新建出来 = 没流程」这条不再成立，界面上再也走不到左栏那支
     「未绑定分析流程」与模块页那支「先去选一条流程」。可那两支仍要守 ——
     没有 flow 字段的历史项目、以及流程被归档的项目都会走到它，
     而它的作用正是「别让用户看到一个像加载失败的空分组头」。
     走不到就用探针走近它：把当前项目的 flow / rn 暂时摘掉、把三处事实
     一次性读回来、读完在 finally 里立刻还原。
     **三处必须在同一次调用里读完**：拆成三次「摘—还原」，中途抛一次就会把
     项目留在「没流程」的假状态上，后面所有现算数字（模块数 / 流程条数 /
     左栏徽章）集体漂移，而那时驱动段已经不知道是谁弄脏的。 */
  window.__projNoFlow = function () {
    var p = projById(PROJ_DETAIL_ID);
    if (!p) return null;
    var f0 = p.flow, r0 = p.rn;
    try {
      p.flow = ''; p.rn = 0;
      openProjDetail(p.id);
      setProjSec('info');
      var rail = {
        nav:     $$('#navBody [data-pds]').map(function (b) { return b.getAttribute('data-pds'); }),
        navOn:   (function () { var b = $('#navBody [aria-current="page"]'); return b ? (b.getAttribute('data-pds') || '') : ''; })(),
        mods:    pdtModules(p),                        /* 期望 [] */
        navMods: $$('#navBody [data-pdmod]').length,   /* 期望 0 */
        none:    (function () { var e = $('#navBody .snav__none'); return e ? e.textContent.trim() : ''; })(),
        grpOpen: !$('#pdModList').hidden,
        marks:   $$('#navBody [data-pdmod] .snav__n').length
      };
      setProjSec('exec');
      var exec = {
        sec:     PDSEC,
        panels:  $$('#projBody .pjpanel').map(function (b) { return b.getAttribute('data-pdtpanel'); }),
        empties: $$('#projBody .pd__empty').length,
        emptyPanels: $$('#projBody .pd__empty').map(function (e) {
          var pn = e.closest('.pjpanel'); return pn ? pn.getAttribute('data-pdtpanel') : null; }),
        emptyTxt: (function () { var e = $('#projBody .pd__empty'); return e ? e.textContent.trim() : ''; })()
      };
      setProjSec('result');
      var mod = {
        sec:         PDSEC,
        steps:       $$('#projSteps [data-pdmod] .psteps__t').map(function (x) { return x.textContent.trim(); }),
        stepsHidden: !!($('#projSteps') && $('#projSteps').hidden),
        tabsHidden:  !!($('#projTabs') && $('#projTabs').hidden),
        empty:       (function () { var e = $('#projBody .pd__empty'); return e ? e.textContent.trim() : ''; })()
      };
      return { rail: rail, exec: exec, mod: mod };
    } finally {
      p.flow = f0; p.rn = r0;
      openProjDetail(p.id);
      setProjSec('info');
    }
  };
  /* 左栏状态探针（v28）：验证脚本测完「手动收起/展开」后解锁 RAIL_LOCK，
     否则整个后续会话的自动收放都被用户手势锁死。 */
  window.__rail = function (on, unlock) { if (unlock) RAIL_LOCK = false; setRail(on); };
  /* 示例数据集设置（v40 需求 2）：不传参 = 纯读；传 {id, ...patch} 改一条并重画。
     回读里带上前台三组卡片的数量 —— 「设置真实作用于前台可见性」这句话
     只有把两侧数字放进同一次读数里，才断得成一条断言。 */
  window.__pubds = function (patch) {
    if (patch && patch.id) demoSet(patch.id, patch, '');
    var t = function (sel) { var e = $(sel); return e ? e.textContent.trim() : ''; };
    return {
      n: DEMO_DS.length,
      shown: DEMO_DS.filter(function (d) { return d.show; }).length,
      rows: $$('#pubdsList .pubdsr').length,
      toggles: $$('#pubdsList [data-pds-toggle]').length,
      checked: $$('#pubdsList [data-pds-toggle]').filter(function (i) { return i.checked; }).length,
      intros: $$('#pubdsList [data-pds-intro]').map(function (x) { return x.value; }),
      imgs: $$('#pubdsList [data-pds-img]').map(function (s) { return s.value; }),
      covers: $$('#pubdsList .pubdsr__im').length,
      noCover: $$('#pubdsList .pubdsr__no').length,
      count: t('#pubdsCount'), hidden: t('#pubdsHidden'), cur: t('#pubdsCur'), sum: t('#demoDsSum'),
      frontOwn: $$('#dsGroup-own .dcard').length,
      frontHuman: $$('#pubGrid-human .dcard').length,
      frontMouse: $$('#pubGrid-mouse .dcard').length,
      frontOwnImg: $$('#dsGroup-own .dcard .dcard__im').length,
      frontHumanImg: $$('#pubGrid-human .dcard .dcard__im').length,
      /* v59：封面「有 <img> 元素」不等于「图能显示」。查表失配时 assetAbs()
         静默退回 assets/xxx 相对路径，本地因为旁边有 assets/ 目录照样出图，
         分发成单文件（deploy-static/ 没有 assets/）才整片图裂 —— 静态与
         元素计数都断不出来，只能读运行时真实解码结果 naturalWidth。
         kind 顺手记一下 src 前缀：data: 才说明映射表命中了。 */
      coverSrcKinds: $$('.dcard__im').map(function (i) {
        var s = i.getAttribute('src') || '';
        return s.indexOf('data:image/') === 0 ? 'data' : (s.indexOf('http') === 0 ? 'http' : (s ? 'rel' : 'empty'));
      }),
      coverLoaded: $$('.dcard__im').map(function (i) { return i.naturalWidth > 0; }),
      coverSize: $$('.dcard__im').map(function (i) { return i.naturalWidth + 'x' + i.naturalHeight; }),
      /* 映射表键名是否完好（build 曾把键名一起替换成 base64，查表永远落空） */
      imgUriKeys: Object.keys(window.IMG_URI || {}),
      imgUriKeyAllPath: Object.keys(window.IMG_URI || {}).every(function (k) { return k.indexOf('assets/') === 0; }),
      resolveHit: DEMO_IMGS.map(function (im) { return assetAbs(im.f).indexOf('data:image/') === 0 || assetAbs(im.f).indexOf('http') === 0; }),
      frontMouseImg: $$('#pubGrid-mouse .dcard .dcard__im').length
    };
  };
  /* v46：原来这里还挂着「重建档案」抽屉的 4 个探针
     （__geneOpen / __geneClose / __geneRun / __geneState）——
     抽屉整块撤了，探针一并删（验证脚本里对应的整段断言也删）。 */
  /* 项目组名单的**出厂快照**：验证驱动会新建一条、删掉一条，跑完就不是默认长相了。
     截图要的恰恰是默认长相（与 `__fmReset()` 同一条理由）。快照在脚本求值时取一次，
     所以它记的是内置数据，不是任何一轮驱动跑过之后的状态。
     恢复的是**深拷贝**：浅拷贝会把快照自己也改掉，第二次恢复就恢复不回去了。 */
  var PG_DEF = JSON.parse(JSON.stringify(PROJ_GROUPS));
  window.__pgReset = function () {
    PROJ_GROUPS.length = 0;
    JSON.parse(JSON.stringify(PG_DEF)).forEach(function (g) { PROJ_GROUPS.push(g); });
    PG_SEL = {}; PG_Q = ''; PG_SORT = 0; PG_EDIT = null;
    /* v54：复位要连**身份**一起复位 —— 截图段与断言段都假定起点是超级管理员。
       只写 CUR_USER.role 会留下「顶栏还是上一个角色、body 上还是旧 data-role」
       的残影，所以这里走同一个 setRole 的收尾动作。 */
    CUR_USER.role = 'super';
    document.body.setAttribute('data-role', 'super');
    renderUserSw(); renderDemoSet(); renderKb2Admin();
    var qi = $('#pgQ'); if (qi) qi.value = '';
    renderProjGroups(); renderNav();
    return PROJ_GROUPS.length;
  };
  /* 当前身份（v54）：不传参 = 纯读；传角色 key = 切过去。
     读数把四处事实一次带回 —— 角色、三个权限位、顶栏文案、body 上的 data-role。
     换身份会同时影响这四处，只看其中一处（比如只看 CUR_USER.role）断不成立。 */
  window.__role = function (k) {
    if (k && k !== CUR_USER.role) setRole(k);
    return {
      role: CUR_USER.role, name: roleName(), who: roleDef().who, perm: roleDef().p,
      canManage: canManage(), canConfig: canConfig(), basic: isBasic(),
      bodyRole: document.body.getAttribute('data-role'),
      swName: (function () { var e = $('#userSwName'); return e ? e.textContent.trim() : '(none)'; })(),
      swWho: (function () { var e = $('#userSwWho'); return e ? e.textContent.trim() : '(none)'; })(),
      popHidden: !$('#popUser') || $('#popUser').hidden,
      options: $$('#popUserList [data-user-role]').map(function (b) { return b.getAttribute('data-user-role'); }),
      onOpt: (function () { var b = $('#popUserList .useropt.is-on'); return b ? b.getAttribute('data-user-role') : '(none)'; })()
    };
  };
  /* 数据汇集页 · 选数据（v50 需求 2）。不传参 = 纯读；传 {scope}/{q}/{pick} 改状态。
     回读同时给**状态**（P02_PICK）与**DOM 事实**（左侧清单几行、树上几个勾、
     已识别卡几行、元信息怎么写的）—— 「勾了一行之后三处同步」只有把
     这两边放进同一次读数才断得成：只看状态，三个渲染里漏一个也看不出来。 */
  window.__p02 = function (patch) {
    patch = patch || {};
    /* 本地小助手：这里的取文要能吃**元素**（列表 / 标签都要逐个数），
       而别处的 `t()` 只吃选择器 —— 所以另起一个，不去改那个共用的。 */
    var t2 = function (el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
    if (patch.scope) { P02_PICK.scope = patch.scope; renderP02Pick(); }
    if (patch.q != null) {
      P02_PICK.q = patch.q;
      var qi = $('#p02FileQ'); if (qi) qi.value = patch.q;
      var tr = $('#p02Pick .pntree'); if (tr) tr.innerHTML = p02FileRows();
    }
    if (patch.clear) { P02_PICK.files = []; renderP02Pick(); renderP02SyncFiles(); }
    var tree = $('#p02Pick .pntree');
    return {
      scope: P02_PICK.scope,
      q: P02_PICK.q,
      files: P02_PICK.files.map(function (f) { return f.scope + '/' + f.path + '/' + f.n; }),
      n: P02_PICK.files.length,
      tabs: $$('#p02Pick .pntab').map(function (b) { return t2(b); }),
      tabOn: (function () { var b = $('#p02Pick .pntab.is-on'); return b ? t2(b) : '(none)'; })(),
      treeRows: $$('#p02Pick .pntree__f').length,
      treeChecked: $$('#p02Pick .pntree__f input:checked').length,
      treeDirs: $$('#p02Pick .pntree__dir').length,
      leftRows: $$('#p02Pick .pnsel__row').length,
      leftEmpty: !!$('#p02Pick .pnsel__empty'),
      clearBtn: !!$('#p02Pick [data-p02="file-clear"]'),
      meta: t2($('#p02PickMeta')),
      fileCardHidden: $('#fileCard') ? $('#fileCard').hidden : null,
      fileCards: $$('#fileList .fcard').length,
      fileTag: t2($('#fileTag')),
      searchVal: (function () { var i = $('#p02FileQ'); return i ? i.value : '(none)'; })(),
      /* 树滚动位置：勾选是**局部**更新，位置不该被清零 —— 这里留个读数给它 */
      treeScroll: tree ? Math.round(tree.scrollTop) : -1,
      dzGone: $$('#page-p02 .dz').length,
      localBtn: !!$('#page-p02 [data-p02="pick-local"]'),
      realFile: !!$('#realFile')
    };
  };
  window.__p02Reset = function () {
    P02_PICK.scope = 'mine'; P02_PICK.q = ''; P02_PICK.files = [];
    /* v52：选着的**数据集**也是「选择」的一部分 —— 只清文件不清数据集，
       复位之后物种守卫还拿着小鼠数据集去对 hg38，源头上就是一句矛盾话。 */
    SEL.ds = null;
    var qi = $('#p02FileQ'); if (qi) qi.value = '';
    renderP02Pick(); renderP02SyncFiles();
    return P02_PICK.files.length;
  };
  /* 项目组管理（v47 需求 3）：不传参 = 纯读；传 {role} 切身份、{q} 设搜索、
     {sort} 设排序、{sel:[id]} 设勾选。
     回读里同时带上**数据**（PROJ_GROUPS 的条数与可选名单）与**DOM 事实**
     （表格实际渲染了几行、每行有几个编辑 / 删除按钮）—— 「权限不足时
     编辑按钮消失」这句话，只有把状态与渲染结果放进同一次读数才断得成。 */
  window.__pg = function (patch) {
    patch = patch || {};
    var touched = false;
    if (patch.role) {
      /* v54：身份只有一条路 —— 走 setRole（它顺带刷顶栏与另两个受权限影响的页面）。
         直接写 CUR_USER.role 会留下「顶栏还是上一个角色」的残影。 */
      if (patch.role !== CUR_USER.role) setRole(patch.role);
      PG_SEL = {}; PG_EDIT = null; touched = true;
    }
    if (patch.q != null) { PG_Q = patch.q; touched = true; }
    if (patch.sort != null) { PG_SORT = patch.sort | 0; touched = true; }
    if (patch.sel) {
      PG_SEL = {};
      patch.sel.forEach(function (id) { PG_SEL[id] = true; });
      touched = true;
    }
    if (touched) { renderProjGroups(); renderNav(); }
    var t = function (sel) { var e = $(sel); return e ? e.textContent.trim() : ''; };
    var rows = $$('#pgBody tr[data-pgrow]');
    return {
      role: CUR_USER.role, roleTxt: pgRoleTxt(), canWrite: pgCanWrite(),
      n: PROJ_GROUPS.length,
      names: PROJ_GROUPS.map(function (g) { return g.n; }),
      on: PROJ_GROUPS.filter(function (g) { return g.on; }).length,
      pick: pgPickNames(),
      rows: rows.length,
      rowNames: rows.map(function (r) { return r.cells[1].textContent.trim(); }),
      memText: rows.map(function (r) { return r.cells[2].textContent.replace(/\s+/g, ' ').trim(); }),
      memCounts: rows.map(function (r) { return r.cells[3].textContent.trim(); }),
      states: $$('#pgBody tr[data-pgrow] .tag').map(function (x) { return x.textContent.trim(); }),
      switches: $$('#pgBody [data-pg-on]').length,
      switchOn: $$('#pgBody [data-pg-on]').filter(function (i) { return !!i.checked; }).length,
      checks: $$('#pgBody [data-pg-check]').length,
      checked: $$('#pgBody [data-pg-check]').filter(function (i) { return !!i.checked; }).length,
      /* 只读身份下这些控件是**真 disabled**（不是换了个样式）：数一遍被禁用的个数，
         「权限挡得住」这件事才断得成 —— 只断「按钮文案变成只读」，
         换个写法（藏起来 / 只改 class）也能过。 */
      checksOff: $$('#pgBody [data-pg-check]').filter(function (i) { return !!i.disabled; }).length,
      switchOff: $$('#pgBody [data-pg-on]').filter(function (i) { return !!i.disabled; }).length,
      allOff: (function () { var b = $('#pgAll'); return !b || !!b.disabled; })(),
      edits: $$('#pgBody [data-pg-edit]').length,
      dels: $$('#pgBody [data-pg-rowdel]').length,
      readOnly: $$('#pgBody .pgop').length,
      newBtnHidden: (function () { var b = $('#page-projgroup [data-pg-new]'); return !b || b.hidden; })(),
      newBtnOff: (function () { var b = $('#page-projgroup [data-pg-new]'); return !b || b.disabled; })(),
      delAria: (function () { var b = $('#pgDel'); return b ? b.getAttribute('aria-disabled') : ''; })(),
      selTxt: t('#pgSel'), count: t('#pgCount'), onTxt: t('#pgOn'), foot: t('#pgFoot'),
      sortIc: (function () { var s = $('#pgSortBtn svg.ico'); return s ? (s.getAttribute('data-miss') || 'ok') : 'none'; })(),
      /* v50 需求 1 之后左栏不该再有 .snav__n 了。读数留在原位，
         期望值从「数字是多少」改成「一个都没有」，再加上「这一格还在不在」——
         撤徽标和撤入口长得像，得分开断。 */
      navBadge: (function () {
        var b = $('#navBody [data-go="projgroup"] .snav__n');
        return b ? b.textContent.trim() : '';
      })(),
      navItem: !!$('#navBody [data-go="projgroup"]'),
      /* 编辑弹窗当前是否开着、草稿里有什么 —— 增删改的「改」要从外面看得见 */
      modalOpen: !$('#modal').hidden,
      edit: PG_EDIT ? { id: PG_EDIT.id, n: PG_EDIT.n, members: PG_EDIT.members.slice(), on: PG_EDIT.on } : null,
      chips: $$('#pgMemList .pgchip').length,
      toast: (function () { var x = $$('.toast'); return x.length ? x[x.length - 1].textContent.trim() : ''; })()
    };
  };
  /* 样本档案：血缘筛选、搜索无结果、跳项目详情这些边界得从外面看一眼才测得到 */
  window.__sampState = function () {
    var a = sampById(SAMP_CUR);
    var ds = (a && a.docs) || [];
    return { cur: SAMP_CUR, q: SAMP_Q, focus: LIN_FOCUS,
             linOpen: linOpen(), axis: LIN_AXIS,
             /* 详情抽屉：open 是**属性真值**（关闭动画放完前仍为 true，
                因为那时抽屉还在滑出途中），断言要先等动画。 */
             drawer: sampDrawerOpen(),
             drawerOpen: !!(function () { var d = $('#drawerSamp'); return d && d.classList.contains('is-open'); })(),
             ids: sampIds(), n: sampIds().length,
             nodes: a ? a.lin.length : 0, edges: a ? a.lin.filter(function (n) { return !!n.from; }).length : 0,
             om: a ? a.om.length : 0, miss: a ? a.om.filter(function (x) { return !!x.miss; }).length : 0,
             omRows: $$('#omBody tr').length,
             /* 本轮新增：信息卡与资料卡。docs 只报计数与「有没有真实文件」——
                数组本身绝不能塞进来，里面挂着 File 对象，一 stringify 就炸。 */
             infoGroups: $$('#sampInfo .sgrp').length,
             infoFields: $$('#sampInfo .srow').length,
             infoRows: $$('#sampInfo .srow').map(function (r) {
               var g = function (s) {
                 var e = r.querySelector(s);
                 return e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
               };
               return [g('.srow__l'), g('.srow__v')];
             }),
             docs: ds.length,
             docsWithFile: ds.filter(function (d) { return !!d.f; }).length,
             docRows: $$('#docBody tr').length,
             docBlob: plainText($('#docBody')),
             pend: SAMP_PEND.length,
             pendNames: SAMP_PEND.map(function (d) { return d.n; }) };
  };
  /* 样本详情抽屉要能被验证脚本开合：点行只能测「选中即滑出」这一条路，
     Esc 分层、跳页收敛、切 tab 收敛这些都得从外面看一眼才测得到。
     ⚠️ 传 false 之后要等 ~300ms 再断言 —— 滑出动画放完才会真正 hidden。 */
  window.__sampDrawer = function (v) {
    if (v === true) openSampDrawer();
    else if (v === false) closeSampDrawer();
    return sampDrawerOpen();
  };
  /* 资料清单单独出一份：去掉 File 对象，只留能被序列化的字段 */
  window.__sampDocs = function () {
    var a = sampById(SAMP_CUR);
    return ((a && a.docs) || []).map(function (d) {
      return { k: d.k, n: d.n, sz: d.sz, who: d.who, t: d.t, hasFile: !!d.f };
    });
  };
  /* 阈值与上下文暴露给验证脚本：界面上的展示值必须与常量一致 */
  window.__thresholds = function () { return THRESHOLDS; };
  /* 导出要能被验证脚本从外面打开并读到真内容：点按钮只能证明「弹了框」，
     证不了产出的文件里到底有什么。__dlKeys() 列全部入口，__dlOpen() 弹确认框，
     __dlBuild() 直接取内容，__dlBytes() 取二进制（ZIP 用 base64 带出来）。 */
  window.__dlKeys = function () { return Object.keys(DL); };
  window.__dlOpen = function (k) { dlOpen(k, null); };
  window.__dlPending = function () { return DL_PEND ? { name: DL_PEND.name, fmt: DL_PEND.fmt, size: dlBytesOf(DL_PEND) } : null; };
  window.__dlBuild = function (k) {
    var sp = DL[k]; if (!sp) return null;
    var b = sp.build(null);
    if (!b) return null;
    b.name = b.name || sp.name; b.fmt = b.fmt || sp.fmt; b.src = b.src || sp.src;
    b.mime = b.mime || sp.mime || 'text/plain;charset=utf-8';
    return { name: b.name, fmt: b.fmt, size: dlBytesOf(b), lines: b.lines == null ? -1 : b.lines,
             note: b.note || '', head: b.text == null ? '' : b.text.slice(0, 300) };
  };
  window.__dlBytes = function (k) {
    var sp = DL[k]; if (!sp) return '';
    var b = sp.build(null);
    if (!b || !b.bytes) return '';
    var s2 = '', CH = 0x8000, i;
    for (i = 0; i < b.bytes.length; i += CH) s2 += String.fromCharCode.apply(null, b.bytes.subarray(i, i + CH));
    return btoa(s2);
  };
  window.__ctx = function () { return CTX; };
  window.__sampPick = sampPick;
  /* v46：__sampTab 随 syncArchTab 一起撤了（页面没有可切的 tab）。 */
  /* 文件管理：验证脚本需要「显式设态」而不是反复点按钮猜当前态；
     __fmAddFake 造一个无字节的待上传条目（File 对象造不出来），
     上传后走「内置条目」的下载口径，与真实上传天然区分。 */
  window.__fmState = function () {
    return {
      scope: FM_SCOPE, up: FM_UP,
      loc: { mine: FM_LOC.mine, team: FM_LOC.team },
      q: FM_Q, pj: FM_PJ, pjUp: FM_PJ_UPLOAD,
      pend: FM_PEND.length,
      uploaded: FM_UPLOADED.length,
      expanded: Object.keys(FM_EXP).filter(function (k) { return FM_EXP[k]; }),
      n: {
        mine: fmFiles('mine').length, team: fmFiles('team').length,
        sys: fmFiles('sys').length
      },
      dirs: { mine: fmDirs('mine').length, team: fmDirs('team').length, sys: fmDirs('sys').length }
    };
  };
  window.__fmScope = function (s) {
    FM_SCOPE = (s === 'team' || s === 'sys') ? s : 'mine';
    renderFM(); return FM_SCOPE;
  };
  /* v56：文件管理权限探针（纯读，不传参就是读当前身份）。
     只看 fmCanWrite() 不够 —— 还得证明界面上**真的**照它渲染了：
     面板形态、拖拽区在不在、按钮是不是禁用态、只读说明在不在。 */
  window.__fmPerm = function (role) {
    if (role) { CUR_USER.role = role; document.body.setAttribute('data-role', role); }
    FM_SCOPE = 'sys'; renderFM();
    /* 关键：系统文件默认是**折叠态**，列表里只有 3 行文件夹、没有文件行，
       此时量 [data-fm-view] / [data-fm-dl] 恒为 0 —— 那量到的是「没有文件」，
       不是「没有预览按钮」。所以先把所有文件夹展开，量完按快照原样还原。 */
    var expWas = {};
    Object.keys(FM_EXP).forEach(function (k) { expWas[k] = FM_EXP[k]; });
    FM_DATA.sys.dirs.forEach(function (dn) { FM_EXP[dn] = true; });
    renderFMRows();
    var card = $('#fmUpCard'), body = $('#fmUpBody');
    var dz = $('#fmDz'), upBtn = $('[data-fm-upload]');
    var rows = $$('#fmBody tr');
    var offBtns = $$('#fmBody .iconbtn.is-off').length;
    var writeBtns = $$('#fmBody [data-fm-del], #fmBody [data-fm-rename]').length;
    var ndb = $('#fmTools [data-fm-newdir]');
    var newDirVis = !!(ndb && !ndb.hidden);
    var snap = {
      role: CUR_USER.role, roleName: roleName(), canWrite: fmCanWrite(),
      cardVisible: !!(card && !card.hidden),
      alertShown: !!(body && body.querySelector('.alert--warn')),
      alertText: body ? (body.querySelector('.alert__p') ? body.querySelector('.alert__p').textContent : '') : '',
      dzShown: !!(dz && !dz.hidden),
      upBtnShown: !!(upBtn && !upBtn.hidden), upBtnDisabled: upBtn ? !!upBtn.disabled : null,
      offBtns: offBtns, writeBtns: writeBtns,
      /* 读权限永远开着：预览 / 下载对所有身份都在（量的是展开后的文件行） */
      viewBtns: $$('#fmBody [data-fm-view]').length, dlBtns: $$('#fmBody [data-fm-dl]').length,
      newDirVisible: newDirVis, newDirDisabled: ndb ? !!ndb.disabled : null,
      hint: $('#fmScopeHint') ? $('#fmScopeHint').textContent : '',
      title: $('#fmUpCard .card__t') ? $('#fmUpCard .card__t').textContent : '',
      rowCount: rows.length,
      fileRows: $$('#fmBody [data-fm-view]').length
    };
    /* 按快照复原展开态：探针不该给会话留残留（这是共享页内状态）。
       注意是「按快照逐键还原」，不能先全删 —— 那会把原本展开的目录也收掉。 */
    Object.keys(FM_EXP).forEach(function (k) { if (!(k in expWas)) delete FM_EXP[k]; });
    Object.keys(expWas).forEach(function (k) { FM_EXP[k] = expWas[k]; });
    renderFMRows();
    return snap;
  };
  window.__fmAddFake = function (name, mb) {
    FM_PEND.push({ n: name || 'probe_1.fastq.gz', sz: (mb || 1.2).toFixed(1) + ' MB', f: null });
    renderFMPend(); return FM_PEND.length;
  };
  /* 回默认视图：截图与「段首起点显式设定」都用得上。会话内上传的文件 /
     新建的文件夹一并清掉 —— 截图要的是内置数据的默认长相。 */
  window.__fmReset = function () {
    FM_SCOPE = 'mine'; FM_UP = 'web';
    FM_LOC = { mine: '', team: '' };
    FM_Q = ''; FM_PJ = ''; FM_PJ_UPLOAD = '';
    FM_EXP = {}; FM_PEND = [];
    FM_UPLOADED = []; FM_NEWDIRS = { mine: [], team: [] };
    renderFM();
  };
  /* 覆盖口径（基因组 / 转录组 / 蛋白组 / 三组学齐全）由验证脚本从数据现算，
     再与需求口径写死的 75 / 75 / 71 / 71 对照 —— 两边同源才有守卫。 */
  window.__sampIds = sampIds;
  window.__sampGet = sampById;
  /* 列表状态归零（筛选 / 搜索 / 排序 / 分页）：探针跑完后列表停在某个筛选与
     某个排序上，截图要拍的是「默认视图」，得先归零。 */
  window.__sampReset = function () {
    sampFltReset();
    SAMP_SORT = { k: 'id', dir: 1 };
    SAMP_PAGE = 1;
    /* 归零之后仍要把当前选中项带回来 —— 只清筛选的话，选中项停在第 3 页，
       列表上就没有任何标记，看着像"没选中任何样本"。 */
    sampLocate(SAMP_CUR);
    renderSampList();
  };
  window.__sampLin = linFocus;
  window.__linFold = toggleLinFold;
  /* 方向切换：截图与探针都要「显式设成某个方向」，而不是反复点按钮猜当前态 */
  window.__linAxis = function (v) {
    LIN_AXIS = v === 'row' ? 'row' : 'col';
    syncLinAxis(); renderLineage(); return LIN_AXIS;
  };

  /* ---- v37 新增探针 ---- */
  /* 新建项目六步向导（v47 起 6 步）：验证脚本要能「直接停在第 N 步」，
     否则后面的步骤只能靠连点按钮碰出来；截图同样需要定妆照，
     不能拍一张刚打开的空表单。
     填的是真实数据形状（样本取档案前 8 例、分组 4+4、流程取库里那一条），
     不是编造的假值。toStep 的语义是**步骤下标 0–5**，与 PNEW_STEPS 一一对应。 */
  function pnProbe() {
    if (!PNEW) return null;
    var d = PNEW.d;
    return {
      step: PNEW.step, view: PNEW.view, steps: PNEW_STEPS.slice(),
      name: d.name, grp: d.grp, sids: d.sids.length,
      files: d.files.length, seq: d.seq, schemes: d.schemes.length,
      scheme: d.scheme == null ? '' : d.schemes[d.scheme].n,
      groups: d.scheme == null ? 0 : d.schemes[d.scheme].groups.length,
      plans: d.plans.length,
      plan: d.plan == null ? '' : d.plans[d.plan].n,
      pairs: d.plan == null ? 0 : d.plans[d.plan].pairs.length,
      /* v47 新两步的状态：流程 id / 名称 / 节点数，以及参数快照 ——
         探针里带参数是因为「回执上那行参数」必须与状态里的是同一份，
         只读界面文字断不出这件事。 */
      flow: d.flow || '',
      flowName: d.flow && flowById(d.flow) ? flowById(d.flow).n : '',
      nodes: d.flow && flowById(d.flow) ? flowById(d.flow).nodes.length : 0,
      params: {
        aligner: d.params.aligner, padj: d.params.padj, lfc: d.params.lfc,
        threads: d.params.threads, mem: d.params.mem, pair: !!d.params.pair,
        batch: !!d.params.batch
      },
      made: PNEW.made ? PNEW.made.id : ''    /* 非空 = 项目已落库 */
    };
  }
  window.__projNew = function (toStep) {
    if (!PROJ_BASE37) PROJ_BASE37 = PROJECTS.map(function (p) { return p.id; });
    /* v50：走 pnewStartFull（= 直接进向导本体），**不**走分流屏 ——
       探针的契约是「调用后 PNEW 就绪」，多一屏就返回 null 了。 */
    pnewStartFull();
    if (!PNEW) return null;
    var d = PNEW.d;
    d.name = '肝癌免疫队列治疗响应分析';
    d.desc = '配对癌与癌旁组织，评估免疫治疗前后转录组与蛋白组变化';
    /* 取「可选名单」的第一条，而不是写死一个组名 —— 写死的话，
       哪天那个组被停用 / 驳回，探针就会往一个**下拉里根本没有的值**上填，
       而界面照旧渲染（select 找不到匹配项时显示第一个选项），
       于是状态与界面静默分叉。 */
    d.grp = pgPickNames()[0] || '';
    d.sids = pnewSampPool().slice(0, 8);
    d.sampDesc = '肝穿刺组织，癌与癌旁配对，干冰运输';
    d.ref = REF_GENOMES[0].alias;
    d.cond = 'Illumina NovaSeq 6000 · PE150';
    var n = (toStep == null) ? 0 : (toStep | 0);
    if (n >= 1) {
      d.files = (FM_DATA.mine.files || []).slice(0, 3).map(function (f) {
        return { scope: 'mine', path: f.dir || '（未归档）', n: f.n, sz: f.sz };
      });
      d.seq = '双端测序';
    }
    if (n >= 2) {
      d.schemes = [{ n: 'TreatScheme', def: true, groups: [
        { n: 'Treat', sids: d.sids.slice(0, 4) },
        { n: 'Ctrl', sids: d.sids.slice(4, 8) }
      ] }];
      d.scheme = 0;
    }
    if (n >= 3) {
      d.plans = [{ n: 'Treat_vs_Ctrl', def: true, pairs: [{ a: 'Ctrl', b: 'Treat' }] }];
      d.plan = 0;
      /* 第 4 步（下标 3 = 流程模版）要选的流程：系统推荐的那条
         （DEFAULT_FLOW = f06 差异表达），与「选分析类型」那五张卡片的默认选中项
         一致 —— 探针不该给出一份界面上选不出来的状态。
         第 5 步（下标 4）的参数不用推：pnewInit() 里已有一份推荐默认值。 */
      d.flow = DEFAULT_FLOW;
    }
    PNEW.step = Math.max(0, Math.min(PNEW_STEPS.length - 1, n));
    renderProjNew();
    /* 探针直接把状态推到「已落库」这一步时，也要真的建出那条项目 ——
       只改 step 会得到一张写着「已创建」却没有对应项目的假回执。 */
    if (PNEW.step === PNEW_STEPS.length - 1) pnewCreate();
    renderProjNew();
    return pnProbe();
  };
  window.__pnState = pnProbe;
  window.__pnClose = function () { $('#modal').hidden = true; PNEW = null; };
  /* 探针建出来的项目要从数据里撤走：截图与后续断言都以「13 个项目」为口径，
     留着这一条会把它悄悄改成 14，后面所有现算数字集体漂移。 */
  var PROJ_BASE37 = null;
  window.__projDropNew = function () {
    if (!PROJ_BASE37) return PROJECTS.length;
    for (var i = PROJECTS.length - 1; i >= 0; i--) {
      if (PROJ_BASE37.indexOf(PROJECTS[i].id) < 0) PROJECTS.splice(i, 1);
    }
    PROJ_BASE37 = null;
    var first = PROJECTS[0];
    if (first && !curProj()) setCurProj(first.id); else renderProj();
    return PROJECTS.length;
  };
  /* 另存为新模板弹窗：既守「运行前先提醒保存」，也守「保存 = 另存一条新模板」 */
  function _qa(sel) {
    return Array.prototype.slice.call(document.querySelectorAll(sel));
  }
  window.__orchSave = function (runAfter) {
    openSaveFlowModal(!!runAfter);
    return { open: !$('#modal').hidden, title: $('#modalT') ? $('#modalT').textContent : '',
             nodes: _qa('#modalB .tempnodes > span').length };
  };
  /* 主页「问答交互」卡全屏（v38）：页面流里的卡片脱流放大，与浮层全屏是两套状态。
     它的宿主在页面流里，没有「收掉」这个动作，能做的只有缩回原位。 */
  window.__wbFull = function (v) {
    if (v !== undefined) toggleWbFull(v);
    var c = $('#wbAgentCard');
    var btn = c ? c.querySelector('[data-wb-full]') : null;
    var r = c ? c.getBoundingClientRect() : null;
    /* 图标换没换不能只看「有没有 svg」—— 两个名字都会渲染出一个 svg。
       取 path 的 d 前 24 字符，与另一态比，才谈得上「图标随状态切换」。 */
    var pa = btn ? btn.querySelector('svg path') : null;
    var tn = $('.topnav');
    return {
      full: !!c && c.classList.contains('is-full'),
      bodyCls: document.body.classList.contains('is-wbfull'),
      aria: btn ? btn.getAttribute('aria-pressed') : '',
      label: btn ? btn.getAttribute('aria-label') : '',
      icon: pa ? pa.getAttribute('d').slice(0, 24) : '',
      pos: c ? getComputedStyle(c).position : '',
      z: c ? getComputedStyle(c).zIndex : '',
      topnavZ: tn ? getComputedStyle(tn).zIndex : '',
      rect: r ? { w: Math.round(r.width), h: Math.round(r.height),
                  top: Math.round(r.top),
                  right: Math.round(window.innerWidth - r.right),
                  bottom: Math.round(window.innerHeight - r.bottom) } : null,
      bdH: $('#wbAgentBody') ? Math.round($('#wbAgentBody').getBoundingClientRect().height) : -1,
      holderMinH: c && c.parentElement ? c.parentElement.style.minHeight : '',
      holderH: c && c.parentElement ? Math.round(c.parentElement.getBoundingClientRect().height) : -1
    };
  };
  /* 全屏时「页面上其它东西有没有被挤走」只能这样量：拿一个照理不动的元素当标尺。
     卡片脱流后若右侧栏塌成 0，这一格下面的卡片会整体上移 —— 那就不叫「缩回原位」了。 */
  window.__wbBelow = function () {
    var n = document.querySelector('#page-p01 [data-anchor="示例数据集"]');
    if (!n) return null;
    var r = n.getBoundingClientRect();
    return { top: Math.round(r.top), left: Math.round(r.left) };
  };
  /* 流程模板列表：新模板必须真的出现在左侧列表里，光看 FLOWS 数组不算 ——
     用户看得见的是列表，列表没渲染出来就等于没这条功能。 */
  window.__flowNames = function () {
    return FLOWS.map(function (f) { return f.n; });
  };
  window.__flowListNames = function () {
    return _qa('#orchList [data-flow]').map(function (b) {
      var n = b.querySelector('.wfitem__n');
      return n ? n.textContent.replace(/\s+/g, ' ').trim() : '';
    }).filter(Boolean);
  };

  window.__initDone = true;
}
document.addEventListener('DOMContentLoaded', init);
if (document.readyState !== 'loading') init();
})();
