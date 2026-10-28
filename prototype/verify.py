#!/usr/bin/env python3
"""用 CDP 直连验证原型的渲染与交互链路，输出结构化结果并截图。"""
import json, os, re, shutil, signal, subprocess, time, urllib.request, urllib.parse
import websocket

# 目录从脚本自身位置推导 —— 硬编码绝对路径会让「换台机器/换个目录就断」。
# 需要指向别处时用环境变量 PROTOTYPE_ROOT 覆盖。
ROOT = os.environ.get("PROTOTYPE_ROOT") or os.path.dirname(os.path.abspath(__file__))
URL = "file://" + os.path.join(ROOT, "index.html")
SHOTS = os.path.join(ROOT, ".shots")
os.makedirs(SHOTS, exist_ok=True)

# 下载落点。本轮加了「归档的资料能真的下载」，所以必须接管 headless 的下载目录：
# 不接管的话 a[download] 会存进用户真实的下载目录，每跑一次就往人家那儿丢一个文件。
# 跑之前先清空 —— 否则上一轮的残留会冒充本轮的成果。
DL_DIR = os.environ.get("CDP_DL_DIR", "/tmp/_cdp_dl")
DL_NAME = "S037_质控复核补充报告.pdf"
DL_FILE = os.path.join(DL_DIR, DL_NAME)
shutil.rmtree(DL_DIR, ignore_errors=True)
os.makedirs(DL_DIR, exist_ok=True)
# Chrome 路径：先按本机默认找，找不到再扫几个常见安装位置；可用 CHROME_BIN 覆盖。
def _find_chrome():
    cands = [os.environ.get("CHROME_BIN"), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
             "/Applications/Chromium.app/Contents/MacOS/Chromium",
             "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]
    for c in cands:
        if c and os.path.exists(c):
            return c
    return None
CHROME = _find_chrome()
if not CHROME:
    raise SystemExit("找不到 Chrome —— 请装 Chrome 或设置环境变量 CHROME_BIN=/path/to/chrome")
PORT = int(os.environ.get("CDP_PORT", "9336"))

# v55 系统改名：期望名从产物 HTML 真读（<title>），不写死字面量 ——
# 这样「改了名但断言还按旧名判」不成立，两边永远同源。
def _read_sys_name():
    try:
        with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as f:
            m = re.search(r"<title>([^<]+)</title>", f.read())
        return m.group(1).strip() if m else ""
    except Exception:
        return ""
SYS_NAME = _read_sys_name()
# 期望名不能「随产物漂移」——若 build 忘了改标题，上面读到的也是旧名，
# 断言会拿旧名判旧名、永远绿。这里钉死用户 v55 指定的新名，两边对不上就直接炸。
EXPECT_SYS_NAME = "组学数据智能挖掘系统"
assert SYS_NAME == EXPECT_SYS_NAME, \
    "index.html 的 <title> 是 %r，应为 %r —— 先跑 node build.js 与标注注入" % (SYS_NAME, EXPECT_SYS_NAME)

DRIVE = r"""
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const q  = s => document.querySelector(s);
  const qa = s => Array.from(document.querySelectorAll(s));
  const vis = el => !!(el && el.getClientRects().length > 0);
  const txt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '(null)';

  /* ---- 跨段复用的辅助函数：命中测试 + 取最后一条 toast ----
     **必须定义在所有使用者之前**：它们是 const，提前引用会触发 TDZ
     （Cannot access 'x' before initialization），而且报错位置指向使用处、
     不在定义处，排查起来很绕。
     【为什么命中测试必须有】弹窗遮罩 .back 与主体 .modal__b 放在同一个层叠
     上下文里，.back 的 z-index:60 压在 z-index:auto 的主体之上 —— 用户点输入框
     其实点在遮罩上，命中 data-close="modal" 就把弹窗关了。而所有「用 JS 设值 +
     JS .click()」的断言全程通过，因为它们从不经过真实命中。
     **凡模态/抽屉，都必须断言「控件中心点能被自己接住」。**
     hitOK2 比 hitOK 多一步 scrollIntoView：视口外的元素 getBoundingClientRect
     给的是超界坐标，elementFromPoint 直接返回 null —— 会把「点得到」误判成
     「点不到」。所以命中测试必须先滚过去。 */
  const hitOK = sel => {
    const el = q(sel);
    if (!el) return { ok: false, got: '(no-el)' };
    const r = el.getBoundingClientRect();
    const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { ok: !!(h && (h === el || el.contains(h))),
             got: h ? h.tagName + '.' + String(h.className) : '(null)',
             w: Math.round(r.width), h: Math.round(r.height) };
  };
  const hitOK2 = sel => {
    const el = q(sel);
    if (!el) return { ok: false, got: '(no-el)' };
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { ok: !!(h && (h === el || el.contains(h))),
             got: h ? h.tagName + '.' + String(h.className) : '(null)' };
  };
  const lastToast = () => { const t = qa('.toast'); return t.length ? txt(t[t.length - 1]) : ''; };
  /* 沿 DOM 往上找第一个不透明背景色 —— 算「实际前景 vs 实际背景」的对比度用。
     必须按**计算色**量而不是看 token 名：深色左栏把一整块前景色换掉了，
     沿用页面浅底配色的值在那里等于隐形，但 token 名字本身看不出问题。
     ⚠️ 伪元素不是 DOM 节点，往上回溯摸不到它。顶栏左段的深色块正是伪元素，
     所以品牌区要显式取 ::before 的计算色（见 R.railNav）。 */
  const effBg = el => {
    let n = el;
    while (n && n.nodeType === 1) {
      const bg = getComputedStyle(n).backgroundColor;
      const m = (bg.match(/[\d.]+/g) || []);
      if ((m.length > 3 ? +m[3] : 1) > 0.95) return bg;
      n = n.parentElement;
    }
    return 'rgb(255, 255, 255)';
  };
  const toRgb = h => { h = String(h).replace('#', '');
    return 'rgb(' + [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)).join(', ') + ')'; };

  const R = {};
  window.__errs = [];
  window.addEventListener('error', e => window.__errs.push('error: ' + e.message));
  window.addEventListener('unhandledrejection', e => window.__errs.push('rejection: ' + e.reason));

  /* 导航唯一入口 = 左栏分组导航里的那一条（菜单内 13 项全部有）。
     display:none 的元素 .click() 仍会派发事件，所以「左栏已自动收起」
     以及「分组被折叠」都不影响点位。

     v41 有一处例外，而且它正是本轮要守的约定：站在项目详情层时左栏整条换成
     **这个项目自己的菜单**，全局项在 DOM 里一个都不剩 —— 真实用户此时的回头路
     只有面包屑的「项目管理」段（v17：返回只有面包屑一条路）。所以这里照用户的走法来：
     先点面包屑退回列表层，再点左栏那条。返回替身元素，调用点仍是 `goPage(x).click()`。
     __navFallback 记次数：不为 0 才说明这条「离开项目层」的路真的被走到过。 */
  window.__navFallback = 0;
  const goPage = p => {
    const real = () => q('.snav__i[data-go="' + p + '"]') || q('[data-go="' + p + '"]');
    const b = real();
    if (b) return b;
    const pd = q('#page-projdetail');
    if (!pd || !pd.classList.contains('is-on')) return null;
    return { click: () => {
      window.__navFallback++;
      const c = q('#crumbParent'); if (c) c.click();
      const b2 = real(); if (b2) b2.click(); else window.__goto(p);
    } };
  };
  window.__go = p => { const b = goPage(p); if (b) b.click(); return !!b; };
  /* 菜单外的页面（保留中的「样本管理」）没有导航按钮，用 goto 直达 */
  window.__goRaw = p => { if (window.__goto) window.__goto(p); };

  try {
    await sleep(900);

    /* ---- 基础渲染 ---- */
    R.initDone       = window.__initDone === true;   /* false = init() 中途抛错 */
    R.chartErr       = window.__chartErr || [];
    R.pageCount       = qa('.page').length;
    R.visibleOnLoad   = qa('.page.is-on').map(p => p.id);
    R.leftoverIcons   = qa('i[class*="fa-solid"]').length;
    R.svgIcons        = qa('svg.ico').length;
    /* 未内联的图标名会被 ico() 渲染成 .ico--miss 占位。必须为 0，
       否则就是「某个图标名没进 ICON_REGISTRY / 拼错了」，界面会缺图标。 */
    R.icoMiss         = qa('svg.ico--miss').map(s => s.getAttribute('data-miss')).filter((x, i, a) => a.indexOf(x) === i);
    R.chartBoxes      = qa('.chartbox').length;
    R.chartsRendered  = qa('.chartbox svg.chart').length;
    R.noteBands       = qa('.note').length;
    R.altToggles      = qa('.chart-alt').length;
    R.resultViews     = qa('.rview').length;
    R.colorBrand      = getComputedStyle(document.documentElement).getPropertyValue('--color-brand').trim();
    R.bodyBg          = getComputedStyle(document.body).backgroundColor;

    /* ---- 主题色回归：改配色后必须整站无残留、且文字对比度过 WCAG AA ---- */
    const root = getComputedStyle(document.documentElement);
    R.theme = {
      brand: root.getPropertyValue('--color-brand').trim(),
      deep:  root.getPropertyValue('--color-brand-deep').trim(),
      soft:  root.getPropertyValue('--color-brand-soft').trim(),
      line:  root.getPropertyValue('--color-brand-line').trim()
    };
    const LEGACY = ['#2b7fff', '#1e5bd6', '#eaf2ff', '#bbd5ff', '#d6e6ff',
                    'rgb(43, 127, 255)', 'rgb(30, 91, 214)', 'rgb(214, 230, 255)'];
    let legacy = 0;
    for (const sh of document.styleSheets) {
      let rules; try { rules = sh.cssRules; } catch (e) { continue; }
      if (!rules) continue;
      for (const r of rules) { const t = (r.cssText || '').toLowerCase();
        LEGACY.forEach(k => { if (t.includes(k)) legacy++; }); }
    }
    qa('svg.chart *').forEach(el => {
      const v = (el.getAttribute('fill') || el.getAttribute('stroke') || '').toLowerCase();
      LEGACY.forEach(k => { if (v === k) legacy++; });
    });
    R.legacyBlue = legacy;   /* 期望 0 */

    const rl = c => {
      let v; if (c.charAt(0) === '#') {
        v = [parseInt(c.substr(1,2),16), parseInt(c.substr(3,2),16), parseInt(c.substr(5,2),16)];
      } else { const m = c.match(/[\d.]+/g) || [255,255,255]; v = [+m[0],+m[1],+m[2]]; }
      v = v.map(x => { x /= 255; return x <= 0.03928 ? x/12.92 : Math.pow((x+0.055)/1.055, 2.4); });
      return 0.2126*v[0] + 0.7152*v[1] + 0.0722*v[2];
    };
    const rat = (a, b) => { const A = rl(a), B = rl(b);
      return Math.round(((Math.max(A,B)+0.05)/(Math.min(A,B)+0.05)) * 100) / 100; };
    const over = (fill, op) => {   /* 半透明填充按白底合成后再算对比度 */
      const A = rl(fill); return A * op + 1 * (1 - op);
    };
    R.contrast = {
      whiteOnBrand:    rat('#FFFFFF', R.theme.brand),
      deepOnWhite:     rat(R.theme.deep, '#FFFFFF'),
      deepOnSoft:      rat(R.theme.deep, R.theme.soft),
      brandOnWhite:    rat(R.theme.brand, '#FFFFFF')
    };
    /* 图表内「白字必须有足够深的底」：逐个白字找它压着的 circle / rect */
    R.chartInk = [];
    R.chartInkMin = 99;
    qa('svg.chart text').forEach(t => {
      const fg = t.getAttribute('fill') || '';
      if (fg.toUpperCase() !== '#FFFFFF') return;
      const g = t.closest('g');
      let bg = null, op = 1;
      const pool = g ? Array.from(g.querySelectorAll('circle,rect')) : [];
      const prev = [];
      let s = t.previousElementSibling;
      while (s) { if (/^(circle|rect)$/i.test(s.tagName)) prev.push(s); s = s.previousElementSibling; }
      const pick = (pool.length ? pool[pool.length - 1] : prev[0]) || null;
      if (pick) { bg = pick.getAttribute('fill'); op = parseFloat(pick.getAttribute('opacity') || '1'); }
      if (!bg) return;
      const L = over(bg, op);
      const cr = Math.round(((1.05) / (L + 0.05)) * 100) / 100;
      R.chartInkMin = Math.min(R.chartInkMin, cr);
      R.chartInk.push({ txt: (t.textContent||'').slice(0,10), bg: bg, op: op, ratio: cr });
    });   /* 只看 ratio < 4.5 的：应仅剩连续色阶的中段，节点标签必须干净 */
    R.chartInkLow = R.chartInk.filter(o => o.ratio < 4.5);
    R.chartInkBad = R.chartInk.filter(o => o.ratio < 4.0);   /* 期望 [] */
    /* 节点标签（不可替代的文字）必须全部 ≥ 4.5 */
    R.nodeInk = R.chartInk.filter(o => o.ratio < 4.5)
      .filter(o => /^(ALB|APOA1|C3|SERPINA1|FGA|HP|TF|APOB|ORM1|GC|S037)$/.test(o.txt));
    if (!R.chartInk.length) R.chartInkMin = 0;

    /* ---- 深色左栏（rail）：整块前景色被换过，颜色配对对不对不能靠看 token ----
       左栏底是品牌深色，块内前景色全部换成 --color-rail-* 三档浅字。任何一个沿用
       页面浅底配色的值（--color-ink / --color-brand）落到这里都等于隐形 —— 而
       「深底压深字」在 DOM 数据上完全正常，只有算对比度才发现。所以判据不是
       「用了哪个 token」，而是**块内每个可见文字元素的实际前景 vs 实际背景 ≥ 4.5**。
       顶栏左段的深色块是 ::before 伪元素（不是 DOM 节点），effBg() 摸不到它，
       品牌区必须显式拿 ::before 的计算色当背景 —— 否则会量出 1.1:1 的假结论。 */
    const capCs = getComputedStyle(q('.topnav'), '::before');
    const capOn = capCs.display !== 'none';
    R.railNav = {
      snavBg: getComputedStyle(q('.snav')).backgroundColor,
      snavW: Math.round(q('.snav').getBoundingClientRect().width),
      deepRgb: toRgb(R.theme.deep),          /* 期望值从 token 现算，不写死 rgb 字面量 */
      capW: capCs.width, capBg: capCs.backgroundColor, capDisp: capCs.display,
      brandW: Math.round(q('.tnav-brand').getBoundingClientRect().width),
      brandRight: Math.round(q('.tnav-brand').getBoundingClientRect().right),
      /* v55 改名后顶栏品牌位从 8 字变 10 字，宽度是固定值 calc(var(--rail-w) - 16px)，
         .tnav-name 又是 nowrap —— 「名字塞得下」不能靠估算，必须实测：
         nameTxt 看名字改对了，nameBox/nameScroll 看文字没被压扁、没溢出。 */
      brandName:       txt(q('.tnav-name')),
      brandNameBox:    Math.round(q('.tnav-name').getBoundingClientRect().width),
      brandNameScroll: q('.tnav-name').scrollWidth,
      /* v55 改名：标签页标题与 meta 也进同一份读数，三处口径一起判 */
      titleTxt: document.title,
      descTxt:  (document.querySelector('meta[name="description"]') || {}).content || '',
      padL: Math.round(parseFloat(getComputedStyle(q('.topnav')).paddingLeft) || 0),
      ink: [], min: 99
    };
    const railPush = (name, fg, bg) => {
      const cr = rat(fg, bg);
      R.railNav.ink.push({ name: name, fg: fg, bg: bg, ratio: cr });
      R.railNav.min = Math.min(R.railNav.min, cr);
    };
    /* v50 需求 1：取样点里的 ['.snav__n', '计数'] 整条删掉。
       徽标既然一个都不剩，这个点必定 miss → 下面「深底文字全部测到（探针没落空）」
       会永远红。而它的可读性问题（数字压在浅青小块上）随着那一格一起消失了 ——
       守一个已经不存在的元素，只会把一条真断言变成噪声。 */
    [['.snav__grp', '一级分组'], ['.snav__i--top', '顶级项'],
     ['.snav__i:not([aria-current="page"])', '二级项'],
     ['.snav__foot', '页脚']].forEach(p => {
      const el = q(p[0]);
      if (!el || !vis(el)) { R.railNav.ink.push({ name: p[1], miss: true }); return; }
      railPush(p[1], getComputedStyle(el).color, effBg(el));
    });
    [['.tnav-name', '顶栏系统名'], ['.tnav-sub', '顶栏副标题']].forEach(p => {
      const el = q(p[0]);
      if (!el || !vis(el)) { R.railNav.ink.push({ name: p[1], miss: true }); return; }
      railPush(p[1], getComputedStyle(el).color, capOn ? capCs.backgroundColor : effBg(el));
    });
    const railCur = q('.snav__i[aria-current="page"]');
    if (railCur) {
      const fg = getComputedStyle(railCur).color, bg = effBg(railCur);
      R.railNav.cur = { txt: txt(railCur), fg: fg, bg: bg, ratio: rat(fg, bg) };
    } else { R.railNav.cur = null; }

    /* ---- 图标尺寸回归：内联 <svg> 缺尺寸规则时会默认 width:100% 撑满容器 ----
       只统计可见图标：隐藏页面里的图标宽度恒为 0，会稀释断言 */
    const icoBox = qa('svg.ico').filter(vis).map(s => s.getBoundingClientRect().width);
    R.icoSize = {
      count: qa('svg.ico').length,
      visible: icoBox.length,
      maxW: icoBox.length ? Math.round(Math.max.apply(null, icoBox)) : 0,
      over24: icoBox.filter(w => w > 24).length,
      over48: icoBox.filter(w => w > 48).length
    };
    R.heroH = Math.round(q('.hero').getBoundingClientRect().height);
    R.heroSteps = qa('.hero__step').length;
    R.navItemWrapped  = qa('.snav__i, .titem, .wfitem')
                          .filter(b => b.getBoundingClientRect().height > 96).length;   /* 期望 0：导航项不应被撑高（标签换行） */
    const pb = q('.btn--primary');
    R.btnPrimaryBg    = pb ? getComputedStyle(pb).backgroundColor : '(none)';
    const hero = q('.hero__img');
    R.heroLoaded      = hero ? (hero.naturalWidth > 0) : false;
    R.heroSize        = hero ? hero.naturalWidth + 'x' + hero.naturalHeight : '(none)';
    /* v54：原 .rolesw__av（两张真人头像）随「临床医生 / 生信工程师」视图切换器
       一起撤了。现在顶栏那处身份入口是「图标 + 角色名 + 下拉菜单」，所以这里查
       三件事：按钮在、角色名写得出来、菜单里三个角色都渲染了。 */
    R.userSw = (function () {
      const b = q('#userSw');
      return b ? {
        name: txt(b),
        opts: qa('#popUserList [data-user-role]').map(x => x.getAttribute('data-user-role'))
      } : '(none)';
    })();
    R.datasetImgs     = qa('.dcard__im').map(i => i.naturalWidth > 0);
    R.navItems        = qa('.snav__i').length;           /* 左栏分组导航，v50 起 10（智能分析整组撤离菜单） */
    R.navGroups       = qa('.snav__grp').map(h => txt(h));  /* 期望 4 组 */
    R.navTop          = qa('.snav__i--top').length;      /* 期望 1：工作台是顶级叶子项 */
    R.oldTopnav       = qa('.tnav').length;              /* 期望 0：顶栏一级导航已下线 */
    R.oldTabstrip     = qa('.tabstrip, .wtab').length;   /* 期望 0：多标签工作区已下线 */
    R.stepperItems    = qa('#page-p02 .stepper__i').length;
    /* 断链守卫：每个 data-go 都必须有对应页面。
       删减页面后最常见的残留就是「入口删了、按钮还在」这类死链，静态看不出、点了没反应。 */
    R.danglingGo      = qa('[data-go]').map(b => b.getAttribute('data-go'))
                          .filter((v, i, a) => a.indexOf(v) === i)
                          .filter(id => !q('#page-' + id));   /* 期望 [] */

    /* ---- 逐页可达 ----
       v50 需求 4：p02 / p04 / p05 / p06 已整组撤离左栏，它们**没有导航按钮**了。
       原先这里 `if (!b) { R.nav[p] = 'NO-BUTTON'; continue; }` —— 撤组之后那四页
       会被静默跳过，而这一段正是图标尺寸的逐页扫描：漏一页就等于放过那一页。
       所以「没有按钮」不再提前跳过，改成走直达入口，并记下这一页是靠哪条路到的。 */
    R.nav = {};
    R.navVia = {};
    R.icoPerPage = {};   /* 逐页扫描：只测首屏可见页会漏掉「图表框内按钮图标被 .chartbox svg 撑满」这类问题 */
    for (const p of ['p01','gene','files','p02','p04','p05','p06','p07',
                     'kbmed','kbown','kbgraph','proj','pubds','projgroup','log']) {
      const b = goPage(p);
      if (b) { b.click(); R.navVia[p] = 'nav'; }
      else { window.__goRaw(p); R.navVia[p] = 'raw'; }
      await sleep(170);
      const pg = q('#page-' + p);
      R.nav[p] = !!pg && pg.classList.contains('is-on');
      const on = pg ? qa('#page-' + p + ' svg.ico').filter(vis)
                      .map(s => Math.round(s.getBoundingClientRect().width)) : [];
      R.icoPerPage[p] = {
        n: on.length,
        max: on.length ? Math.max.apply(null, on) : 0,
        over24: on.filter(w => w > 24).length
      };
    }
    R.crumbAfterNav = txt(q('#crumb'));

    /* ---- 用户与角色（v54）----
       v54 把「临床医生 / 生信工程师」那对**视图**切换器整块撤了，换成顶栏一处
       身份入口（超级管理员 / 普通管理员 / 普通用户）。这里按「先采事实、断言另写」
       的老规矩，把三档身份的能力位、工程细节（.eng-only）的显隐、两处权限门
       （知识审批按钮、示例数据集配置控件）一次采齐 —— 只看其中一处断不成立。
       注意 p05 不在左栏菜单里（v50 整组撤离），驱动只能走 __goRaw。 */
    window.__goRaw('p05'); await sleep(220);
    R.oldRolesw = qa('.rolesw, .rolesw__b').length;        /* 期望 0：旧视图切换器撤净 */
    R.roleSuper = Object.assign(window.__role('super'), {
      eng: qa('.eng-only').filter(vis).length,
      cli: qa('.cli-only').filter(vis).length,
      logVisible: vis(q('#logBox')),
      sumRows: qa('#sumBody tr').length
    });
    R.roleUser = Object.assign(window.__role('user'), {
      eng: qa('.eng-only').filter(vis).length,
      cli: qa('.cli-only').filter(vis).length,
      sumRows: qa('#sumBody tr').length
    });
    R.roleAdmin = Object.assign(window.__role('admin'), {
      eng: qa('.eng-only').filter(vis).length
    });
    /* 回超级管理员：后面的参数联动、上传模拟都假定「看得见全部控件」的起点 */
    window.__role('super'); await sleep(200);

    /* 三处权限门（按身份逐个采）：知识管理视图的审批按钮 / 示例数据集配置控件 */
    window.__goRaw('kbmed'); await sleep(220);
    const kbAdminView = () => {
      const b = q('#page-kbmed .seg__b[data-kb2mode="admin"]'); if (b) b.click();
      return {
        btns: qa('#kbmAdmTbl [data-kb2lc]').length,
        disabled: qa('#kbmAdmTbl [data-kb2lc]').filter(x => x.disabled).length,
        /* 审批类动作＝除「提交审核」（draft→review）之外的全部流转。
           普通用户该被挡住的正是这一批；「提交审核」属于新增流程，仍要可用。 */
        aprBtns: qa('#kbmAdmTbl [data-kb2lc]').filter(x => x.getAttribute('data-kb2lc') !== 'review').length,
        aprOff: qa('#kbmAdmTbl [data-kb2lc]').filter(x => x.getAttribute('data-kb2lc') !== 'review' && x.disabled).length,
        submitOn: qa('#kbmAdmTbl [data-kb2lc="review"]').filter(x => !x.disabled).length,
        hint: (function () { const h = q('#kbmAprHint'); return !h || h.hidden ? '' : txt(h); })()
      };
    };
    window.__role('user');  await sleep(200);
    R.kbUser  = kbAdminView();
    window.__role('admin'); await sleep(200);
    R.kbAdmin = kbAdminView();
    window.__role('super'); await sleep(200);
    R.kbSuper = kbAdminView();
    /* 复位：知识库的「管 理」模式是**页内状态**，不复位会污染后面
       「知识库页默认态是检索」「知识域切换」两条断言 —— 实测第一轮就是这么红的。 */
    (function () { var b = q('#page-kbmed .seg__b[data-kb2mode="search"]'); if (b) b.click(); })();
    await sleep(200);
    window.__goRaw('pubds'); await sleep(240);
    const pdsProbe = () => ({
      togglesOff: qa('#pubdsList [data-pds-toggle]').filter(x => x.disabled).length,
      toolsOff: qa('[data-pds-all], [data-pds-reset]').filter(x => x.disabled).length,
      hint: (function () { const h = q('#pubdsPerm'); return !h || h.hidden ? '' : txt(h); })(),
      who: txt(q('#pubdsWho'))
    });
    window.__role('admin'); await sleep(200);
    R.pdsAdmin = pdsProbe();
    window.__role('super'); await sleep(200);
    R.pdsSuper = pdsProbe();
    // ---- v56：文件管理 · 系统文件的上传权限 ----
    // 注意：这段在 DRIVE 字符串内部（JS），注释必须用 JS 写法；
    // DRIVE 之外的 Python 代码才用 # —— 两处相反，别搞混（v56 栽过两次）。
    // 同一页三档身份各采一次。探针内部会把范围切到 sys 并重画，
    // 所以采完必须把**范围**和**身份**都复位 —— 范围是页内状态，
    // 留在 sys 会污染后面文件管理那 20 多条（v54 在知识库模式上栽过一次）。
    window.__goRaw('files'); await sleep(240);
    window.__role('user');  await sleep(200);
    R.fmUser = window.__fmPerm();
    window.__role('admin'); await sleep(200);
    R.fmAdmin = window.__fmPerm();
    window.__role('super'); await sleep(200);
    R.fmSuper = window.__fmPerm();
    window.__fmReset(); await sleep(200);

    /* ---- v58：知识赋能三页 → 页内挂载外部系统 ----
       这段在 DRIVE 字符串内部（JS），注释用 //（v56 栽过两次，别搞混）。
       为什么必须运行时采：iframe 的 src 由 mountKbFrame() 动态 setAttribute
       赋值，产物 HTML 里**根本没有 src 属性**，静态检查一律断不了
       「页面上真的挂上了哪个地址」。
       ⚠ 不断言「iframe 加载成功」：跨域读不到内容，且目标是内网地址，
         加载成败取决于跑验证的这台机器有没有接内网 —— 那是环境，不是缺陷。
         真正要断的是「挂了正确的地址 + 失败时有可点的退路」。
       ⚠ 采完必须把三页都切回外部视图（默认态）：KBMODE 是跨页共享状态，
         留在 local 会让后面知识库的十几条断言全部在错的视图上量。 */
    const KB_IDS = ['kbmed', 'kbown', 'kbgraph'];
    R.kbFrames = {};
    for (const id of KB_IDS) {
      window.__go(id); await sleep(300);
      const page = q('#page-' + id);
      const f = q('#kbframe-' + id);
      const el = f ? f.querySelector('[data-kbframeel]') : null;
      const local = page ? page.querySelector('[data-kblocal]') : null;
      const ph = f ? f.querySelector('[data-kbph]') : null;
      const fail = f ? f.querySelector('[data-kbfail]') : null;
      const seg = page ? page.querySelector('.kbview__seg') : null;
      R.kbFrames[id] = {
        mode:    page ? page.getAttribute('data-kbview') : '(none)',
        frameShown:  !!(f && !f.hidden),
        localHidden: !!(local && local.hidden),
        /* 期望：三个路径各自对应需求里给的 ke / kb / kg，且没有 menu 参数 */
        src:      el ? (el.getAttribute('src') || '') : '',
        tag:      el ? el.tagName : '(none)',
        title:    el ? (el.getAttribute('title') || '') : '',
        relPolicy: el ? (el.getAttribute('referrerpolicy') || '') : '',
        urlTxt:   f && f.querySelector('[data-kburl]') ? txt(f.querySelector('[data-kburl]')) : '',
        openN:    f ? f.querySelectorAll('[data-kbframeopen]').length : 0,
        reloadN:  f ? f.querySelectorAll('[data-kbreload]').length : 0,
        failHidden: !!(fail && fail.hidden),
        phHidden: !!(ph && ph.hidden),
        segN:     seg ? seg.querySelectorAll('.seg__b').length : 0,
        /* 切换器的 aria-selected 必须跟着视图走，否则读屏读到的还是旧那一档 */
        segExtOn:   seg && seg.querySelector('.seg__b[data-kbview="ext"]')
                     ? seg.querySelector('.seg__b[data-kbview="ext"]').getAttribute('aria-selected') : '',
        segLocalOn: seg && seg.querySelector('.seg__b[data-kbview="local"]')
                     ? seg.querySelector('.seg__b[data-kbview="local"]').getAttribute('aria-selected') : ''
      };
    }
    /* 切到「站内版本」再切回：证明两个视图真能来回，且站内那份还在。
       站内视图量的是「有没有内容」（行数>0），不是「内容对不对」——
       内容正确性由那十几条既有知识库断言负责，这里只断「切得动」。 */
    window.__go('kbmed'); await sleep(260);
    const segMed = q('#page-kbmed .kbview__seg');
    const localBtn = segMed ? segMed.querySelector('.seg__b[data-kbview="local"]') : null;
    if (localBtn) localBtn.click();
    await sleep(280);
    const pMed = q('#page-kbmed');
    const lcMed = pMed ? pMed.querySelector('[data-kblocal]') : null;
    R.kbSwitch = {
      modeAfterLocal: pMed ? pMed.getAttribute('data-kbview') : '(none)',
      frameHidden:  !!(q('#kbframe-kbmed') && q('#kbframe-kbmed').hidden),
      localShown:   !!(lcMed && !lcMed.hidden),
      /* 站内内容还在（行数 > 0）：切视图不是把内容清空 */
      localRows: lcMed ? lcMed.querySelectorAll('div, tr, button').length : 0,
      /* 切视图不该顺手把地址改掉 */
      srcKept: (q('#kbframe-kbmed [data-kbframeel]') || {}).getAttribute
                ? q('#kbframe-kbmed [data-kbframeel]').getAttribute('src') || '' : ''
    };
    /* 切回外部（默认态），并确认还原成功 */
    const extBtn = pMed && pMed.querySelector('.seg__b[data-kbview="ext"]');
    if (extBtn) extBtn.click();
    await sleep(280);
    const pMed2 = q('#page-kbmed');
    R.kbSwitchBack = {
      mode: pMed2 ? pMed2.getAttribute('data-kbview') : '(none)',
      frameShown: !!(q('#kbframe-kbmed') && !q('#kbframe-kbmed').hidden),
      localHidden: !!(pMed2 && pMed2.querySelector('[data-kblocal]')
                      && pMed2.querySelector('[data-kblocal]').hidden)
    };

    /* ---- 参数 → 预期输出联动 ---- */
    window.__goRaw('p05'); await sleep(200);
    R.expectAtDefault = txt(q('#expGenes'));
    const padj = q('[data-param="padjPlain"]');
    padj.value = '0.01';
    padj.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(180);
    R.expectAtStrict = txt(q('#expGenes'));
    R.sumRowsAfterChange = qa('#sumBody tr').length;

    /* ---- 上传模拟 ---- */
    window.__goRaw('p02'); await sleep(220);
    R.fileCardHiddenBefore = q('#fileCard').hidden;
    q('[data-upload="vcf"]').click(); await sleep(200);
    R.fileCardHiddenAfter = q('#fileCard').hidden;
    R.fileCardCount = qa('#fileList .fcard').length;
    R.fileName = txt(q('#fileList .fcard__n'));
    R.toastCount = qa('#toasts .toast').length;

    /* ---- 数据汇集页 · 选数据（v50 需求 2）----
       原来的「上传组学数据」拖拽区换成两栏选择器。这一段断三件事：
       ① 换成选择器之后**拖放还在**（文案上写了「可以把本机文件直接拖到上方区域」）；
       ② 勾一行之后**三处同步**（左侧清单 / 树上勾 / 已识别文件卡）——
          只断其中一处，另外两处漏一个也看不出来；
       ③ 搜索框只重画树、**不被换掉**（换掉就丢焦点，打第二个字就断）。 */
    q('#fileCard').hidden = true; q('#fileList').innerHTML = '';
    (function () {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(2048)], 'S099_1.fastq.gz', { type: 'application/gzip' }));
      q('#p02Pick').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    })();
    await sleep(280);
    R.dzClick = {
      fileCardHidden: q('#fileCard').hidden,
      cards: qa('#fileList .fcard').length,
      name: q('#fileList .fcard__n') ? txt(q('#fileList .fcard__n')) : '',
      dropTarget: !!q('#page-p02 [data-dz]'),
      dzGone: qa('#page-p02 .dz').length          /* 期望 0：老拖拽区整块撤了 */
    };

    window.__p02Reset(); window.__goRaw('p02'); await sleep(260);
    R.p02 = { init: window.__p02() };
    const _tog = qa('#p02Pick .pntree__f input');
    if (_tog[0]) _tog[0].click();
    await sleep(150);
    if (_tog[1]) _tog[1].click();
    await sleep(180);
    R.p02.two = window.__p02();
    /* 再点一次同一个 → 取消勾选（「点的就是这一份」能撤回，不是单向的） */
    if (_tog[1]) _tog[1].click();
    await sleep(180);
    R.p02.untoggle = window.__p02();
    if (_tog[1]) _tog[1].click();
    await sleep(150);
    /* 搜索：只重画文件树，输入框本体必须还是同一个节点 */
    const _qi = q('#p02FileQ');
    _qi.value = 'S068';
    _qi.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(200);
    R.p02.search = window.__p02();
    R.p02.searchSameNode = q('#p02FileQ') === _qi;
    R.p02.searchType = 'input';
    R.p02.searchTyped = (function () {
      const i = q('#p02FileQ');
      i.value = 'S068_1';
      i.dispatchEvent(new Event('input', { bubbles: true }));
      return (window.__p02().treeRows);
    })();
    /* 范围切到团队：同一份数据资产的三档，树跟着换。
       切之前先把筛选清空 —— 否则带着上一段的 'S068_1' 切范围，团队那档一个都
       匹配不上，断出来的会是「筛不到」而不是「换了一档数据」（假绿：0 == 0）。 */
    const _q2 = q('#p02FileQ');
    _q2.value = ''; _q2.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(170);
    q('#p02Pick .pntab[data-scope="team"]').click(); await sleep(220);
    R.p02.team = window.__p02();
    /* 一键清空 */
    q('#p02Pick [data-p02="file-clear"]').click(); await sleep(220);
    R.p02.cleared = window.__p02();
    R.p02.localEntry = !!q('#page-p02 [data-p02="pick-local"]') && !!q('#realFile');
    window.__p02Reset(); await sleep(160);
    R.p02.afterReset = window.__p02();

    /* ---- 示例数据集一键载入（工作台点选 = 默认开始分析流程）
       v37 需求 3 删掉「样本对齐」之后，落点从 p03 顺延到 p04（流程模板）。 ---- */
    q('#fileCard').hidden = true; q('#fileList').innerHTML = '';
    q('[data-pick]').click(); await sleep(300);
    R.pickDemo = {
      fileCardHidden: q('#fileCard').hidden,
      cards: qa('#fileList .fcard').length,
      tag: q('#fileTag') ? txt(q('#fileTag')) : null,
      autoPage: qa('.page.is-on')[0].id,     /* 期望 page-p04：自动进入流程模板 */
      toast: lastToast()
    };
    window.__goRaw('p02'); await sleep(240);   /* 回数据汇集继续本页用例 */

    /* ---- 异常：格式不支持（真选一个 .xlsx，不再是「点按钮演示」） ---- */
    var rf = q('#realFile');
    var dtf = new DataTransfer();
    dtf.items.add(new File([new Uint8Array(1024)], 'sample_pheno.xlsx',
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    rf.files = dtf.files;
    rf.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(260);
    R.anomFormat = {
      visible: !q('#anomP02').hidden,
      hasDanger: qa('#anomP02 .alert--danger').length,
      acts: qa('#anomP02 .alert__act .btn').length,
      tag: txt(q('#anomP02 .alert__tag')),
      nameShown: txt(q('#anomP02 .alert__p')).indexOf('sample_pheno.xlsx') >= 0
    };

    /* 异常面板里的「下载格式模板」也是一个下载入口：点它必须只弹确认框。
       必须在点下面那个「自动转成 .csv」之前测 —— 修复动作会把整个面板换成已处理态，
       按钮随之消失（那时再去数 [data-dl="template"] 个数就是碰运气了）。 */
    q('#anomP02 [data-dl="template"]').click(); await sleep(260);
    R.anomTemplate = {
      modal: !q('#modal').hidden,
      title: txt(q('#modalT')),
      name: (window.__dlPending() || {}).name || null,
      toast: lastToast(),
      hitGo: hitOK2('#modal [data-dl-go]')
    };
    q('#modal .iconbtn[data-close="modal"]').click(); await sleep(200);
    R.anomTemplate.closed = q('#modal').hidden;

    q('#anomP02 [data-fix="0"]').click(); await sleep(260);
    R.anomFixed = txt(q('#anomP02 .alert__t')).slice(0, 40);

    /* ---- 排队态（v63）：只显示「请等待」，不再有算力队列 / 问题模块 ---- */
    window.__goRaw('p06'); await sleep(220);
    q('#btnRun').click(); await sleep(460);
    R.queueAnom = {
      anomGone: !q('#anomP06'),
      queueGone: !q('#queueList'),
      qPosGone: !q('#qPos') && !q('#etaV'),
      runTag: txt(q('#runTag')),
      stageText: txt(q('#runStageText'))
    };
    /* v51：排队态点「查看结果」必须被拦住，而且**不能跳页**。
       这道闸搬过两次家（[data-go] → [data-pano] → [data-res]），每搬一次都要确认
       它没被落在原地 —— 漏搬的后果不是「按钮灰着但点得动」这么轻：人已经站在
       结果页上，看的是上一批数据的结果。 */
    q('#btnResult').click(); await sleep(240);
    R.queueAnom.guardPage = qa('.page.is-on')[0].id;        /* 期望 page-p06 */
    R.queueAnom.guardToast = lastToast();

    /* ---- 运行模拟：从排队引导里走「降级快速模式」，任务真的跑起来 ---- */
    q('#btnRun').click();
    await sleep(1300);
    /* 流水线三态：这 1.3 秒里应该已经「前面完成、当步运行中、后面等待」——
       只断「最后全绿」是不够的：那样一个从头到尾都不变的流水线也能通过。 */
    R.runMid = {
      page: qa('.page.is-on')[0].id,
      pct: txt(q('#runPctText')),
      barW: q('#runBar').style.width,
      btnResultDisabled: q('#btnResult').getAttribute('aria-disabled'),
      states: qa('#pipeFlow [data-stage]').map(r => r.getAttribute('data-pipe-state')),
      runPct: txt(q('#pipeFlow [data-stage][data-pipe-state="run"] [data-stage-t]')),
      runBarW: (function () {
        var r = q('#pipeFlow [data-stage][data-pipe-state="run"]');
        return r ? r.style.getPropertyValue('--pipe-p') : '';
      })()
    };
    await sleep(5200);
    R.runEnd = {
      pct: txt(q('#runPctText')),
      barW: q('#runBar').style.width,
      btnResultDisabled: q('#btnResult').getAttribute('aria-disabled'),
      tag: txt(q('#runTag')),
      stageText: txt(q('#runStageText')),
      logLines: qa('#logBox .log__l').length,
      states: qa('#pipeFlow [data-stage]').map(r => r.getAttribute('data-pipe-state')),
      status: qa('#pipeFlow [data-stage-t]').map(n => n.textContent.trim()),
      arwDone: qa('#pipeFlow .pipe__arw.is-done').length,
      arwAll: qa('#pipeFlow .pipe__arw').length,
      names: qa('#pipeFlow .pipe__t').map(n => n.textContent.trim()),
      tools: qa('#pipeFlow .pipe__m').map(n => n.textContent.trim()),
      meta: txt(q('#pipeMeta')),
      stgSvg: qa('#pipeFlow .ico--miss').length,
      /* v51：任务运行页的页脚要多出「下一步：查看分析结果」——
         这条线到任务运行不再结束。页脚那一格是**不受任务状态影响**的入口：
         「查看结果」按钮在排队态是灰的，页脚这颗不是，人始终走得下去。 */
      foot: qa('#page-p06 .row.justify-between button[data-go]').map(b => b.getAttribute('data-go'))
    };

    /* ---- 取消任务：跑起来之后再取消，流水线不能留着「运行中」的节点 ----
       任务标签此时写「已取消」，节点若还亮着百分比，就是同一屏上的两句矛盾话。 */
    q('#btnRun').click(); await sleep(260);
    q('#btnRun').click(); await sleep(900);
    R.runCancel = {
      runBefore: qa('#pipeFlow [data-stage][data-pipe-state="run"]').length,
      doneBefore: qa('#pipeFlow [data-stage][data-pipe-state="done"]').length
    };
    q('#btnCancel').click(); await sleep(200);
    R.runCancel.runAfter = qa('#pipeFlow [data-stage][data-pipe-state="run"]').length;
    R.runCancel.tagAfter = txt(q('#runTag'));
    R.runCancel.doneAfter = qa('#pipeFlow [data-stage][data-pipe-state="done"]').length;
    /* 取消之后再跑一次，把「结果页」那一段需要的前置状态补回来 */
    q('#btnRun').click(); await sleep(260);
    q('#btnRun').click(); await sleep(7600);
    R.runAgain = { pct: txt(q('#runPctText')), tag: txt(q('#runTag')) };

    /* ---- 结果页：6 个视图 + 图表 ----
       v51：落点从「项目详情 › 结果全景」改成**智能分析第 5 步**「查看分析结果」——
       任务跑完点「查看结果」，人应该留在本线内往下走，而不是被送出这条线再钻回来。
       这一段顺带把「两个宿主互斥」量下来：结果全景是一份内容挂两个宿主
       （本页 #resMount / 项目详情 #panoMount），template 里带着 #viewSeg
       与三张空表体的 id —— 两份同时进文档树，fillTables 只会填到第一份、
       切视图会同时切两份，而页面看起来完全正常。所以「#viewSeg 全局只有 1 个」
       与「另一个宿主是空的」都要在这里断。 */
    q('#btnResult').click(); await sleep(420);
    R.resultPage = qa('.page.is-on')[0].id;      /* 期望 page-p07 */
    R.resStep = {
      eye: txt(q('#page-p07 .phead__eye')),      /* 期望 步骤 5 / 5 · P-07 */
      h1: txt(q('#page-p07 .phead__h1')),
      step: txt(q('#crumbStep')),                /* 期望 步骤 5 / 5 */
      crumb: txt(q('#crumb')),
      grp: txt(q('#crumbGrp')),
      steps: qa('#page-p07 .stepper .stepper__i').length,   /* 期望 5：步骤条也补上了第 5 格 */
      segs: qa('#viewSeg').length,               /* 期望 1 */
      rviews: qa('#resMount .rview').length,     /* 期望 6 */
      charts: qa('#resMount .chartbox').length,  /* 期望 13 */
      svg: qa('#resMount .chartbox svg.chart').length,
      panoRviews: qa('#panoMount .rview').length,   /* 期望 0：另一个宿主让位了 */
      /* 三张空表体（富集 / 蛋白组 / 代谢组）由 fillTables 现填 —— 不填的话
         对应那三条导出只能读到光表头，dlFromTable 见 rows < 2 返回 null，
         表象是「导出入口有一半点不动」而页面完全正常。 */
      emptied: [qa('#resMount #enrichTable tr').length,
                qa('#resMount #protTable tr').length,
                qa('#resMount #metabTable tr').length],
      dlKeys: qa('#resMount [data-dl]').map(b => b.getAttribute('data-dl')),
      foot: qa('#page-p07 .row.justify-between button[data-go]').map(b => b.getAttribute('data-go'))
    };
    R.views = {};
    for (const v of ['variant','de','enrich','prot','metab','align']) {
      const b = q('#viewSeg [data-view="' + v + '"]');
      b.click(); await sleep(160);
      const on = q('.rview.is-on');
      R.views[v] = {
        active: on ? on.getAttribute('data-view') : '(none)',
        charts: on ? on.querySelectorAll('.chartbox svg.chart').length : 0,
        tables: on ? on.querySelectorAll('.tbl').length : 0
      };
    }

    /* ---- 数据表替代视图 ---- */
    q('#viewSeg [data-view="de"]').click(); await sleep(160);
    const alt = q('.rview.is-on .chart-alt');
    const target = document.getElementById(alt.getAttribute('data-alt'));
    const before = target.hidden;
    alt.click(); await sleep(160);
    R.altToggle = { before: before, after: target.hidden, rows: target.querySelectorAll('tbody tr').length };

    /* ---- 空/禁用状态 ---- */
    R.metabDisabled = q('[data-pipe="metab"]').getAttribute('aria-disabled');
    R.pcardCount = qa('.pcard').length;

    /* ==================== 知识赋能三页（kbmed / kbown / kbgraph） ==================== */
    /* v58：这三页默认停在**外部系统**视图（iframe 挂载），而下面这几十条断言量的是
       **站内那份**内容。所以整段开头统一切到 local，段末再切回ext。
       —— 不这么做的话，每一条都会在「内容被收起来了」的页面上量，全部落空；
       而且失败原因会指向「词条少了」这种完全无关的方向，极难归因。 */
    ['kbmed', 'kbown', 'kbgraph'].forEach(function (id) { window.__kbView(id, 'local'); });
    await sleep(200);
    /* v36 医学知识库：四知识域（★临床诊疗/生物样本/多组学/权威文献）+ 检索/浏览/管理
       三模式 + 知识全生命周期（采集→审核→发布→更新→归档）。
       断言不写死词条总数（新增用例会 +1），只锁结构与行为。 */
    goPage('kbmed').click(); await sleep(300);
    R.kbMed = {
      on: qa('.page.is-on')[0].id,          /* 期望 page-kbmed */
      /* 默认检索。限定在 .kbm__seg（知识库模式段）里 —— v58 页头多了一个
         「外部系统 / 站内版本」切换器，它也是 .seg__b.is-on，不限定就会命中它。 */
      mode: txt(q('#page-kbmed .kbm__seg .seg__b.is-on')),
      dom: txt(q('#kbmDom .kbm-dom__i.is-on')),       /* 默认 ★临床诊疗域 */
      cloudTerms: qa('#kbmCloud .kbm-w').length,
      recentRows: qa('#kbmRecent .kbm-row').length,   /* 期望 4：疾病/症状/检查/药品 */
      recentCells: qa('#kbmRecent .kbm-cell').length,
      addBtn: !!q('#page-kbmed [data-kb2add]'),
      addInHead: !!q('#page-kbmed .phead__side [data-kb2add]'),
      tabBg: getComputedStyle(q('#page-kbmed .kbm__seg .seg__b.is-on')).backgroundColor
    };
    /* 知识域切换：切到「多组学」（3 分类）→ 切回临床诊疗 */
    q('[data-kb2dom="omics"]').click(); await sleep(240);
    R.kb2Dom = {
      on: txt(q('#kbmDom .kbm-dom__i.is-on')),
      recentRows: qa('#kbmRecent .kbm-row').length,   /* 多组学 3 分类 → 3 行 */
      cloudTerms: qa('#kbmCloud .kbm-w').length,
      catOpts: qa('#kb2Cat option').length            /* 下拉随域重建：全部+3 分类 */
    };
    /* 多组学详情：字段对齐（检测平台=平台名）+ 跨组学关联网络 chips */
    q('#kb2Q').value = 'TP53';
    q('[data-kb2search]').click(); await sleep(240);
    q('#kbmResList .kbm-cell').click(); await sleep(240);
    R.kb2DomNet = {
      title: txt(q('#kbmDetailT')),
      plat: (function () {
        var rows = qa('#kbmDetail .kbm-drow');
        for (var i = 0; i < rows.length; i++) {
          if (txt(rows[i].querySelector('span')) === '检测平台') { var d = rows[i].querySelector('div'); return d ? txt(d) : ''; }
        }
        return '';
      })(),
      net: qa('#kbmDetail .kbm-net__i').length
    };
    q('[data-kb2back]').click(); await sleep(200);
    q('[data-kb2dom="clin"]').click(); await sleep(240);
    R.kb2DomBack = { on: txt(q('#kbmDom .kbm-dom__i.is-on')), recentRows: qa('#kbmRecent .kbm-row').length };
    /* 浏览模式：菜单 / 字母筛选 / 词条表 */
    q('[data-kb2mode="browse"]').click(); await sleep(220);
    R.kb2Browse = {
      menu: qa('#kbmMenu .kbm-menu__i').length,       /* 期望 4 */
      menuOn: txt(q('#kbmMenu .kbm-menu__i.is-on')),  /* 默认疾病 */
      letters: qa('#kbmFlt .kbm-tag').length,         /* 期望 6 */
      words: qa('#kbmWordList .kbm-cell').length
    };
    const kb2WordsAll = R.kb2Browse.words;
    /* 字母筛选：词条全中文开头落「#」区，A-G 要切到检查类（CT/EB/C 开头）才有命中；
       断言只锁「筛选生效变窄」，不写死区间计数。 */
    q('[data-kb2menu="检查"]').click(); await sleep(200);
    const kb2ExamAll = qa('#kbmWordList .kbm-cell').length;
    q('[data-kb2letter="A-G"]').click(); await sleep(200);
    R.kb2Letter = { on: txt(q('#kbmFlt .kbm-tag.is-on')), words: qa('#kbmWordList .kbm-cell').length, all: kb2ExamAll };
    /* 词条详情：字段分组 + 关联知识条目 + 页内面包屑返回 */
    q('#kbmWordList .kbm-cell').click(); await sleep(240);
    R.kb2Detail = {
      vis: !q('#kbmDetailView').hidden,
      title: txt(q('#kbmDetailT')),
      secs: qa('#kbmDetail .kbm-dsec').length,
      drows: qa('#kbmDetail .kbm-drow').length,
      kbLinks: qa('#kbmDetail [data-kbopen]').length,
      vals: qa('#kbmDetail .kbm-drow > div').map(d => txt(d))   /* 字段值应互不相同（下标错位守卫） */
    };
    q('[data-kb2back]').click(); await sleep(200);
    R.kb2Back = { detailGone: q('#kbmDetailView').hidden, browseBack: !q('#kbmBrowseView').hidden };
    /* 回检索模式：命中 → 空态 → 返回 */
    q('[data-kb2mode="search"]').click(); await sleep(200);
    q('#kb2Q').value = '肝细胞癌';
    q('[data-kb2search]').click(); await sleep(260);
    R.kb2Search = { res: qa('#kbmResList .kbm-cell').length, homeHidden: q('#kbmSearchHome').hidden, count: txt(q('#kb2Count')) };
    /* 从检索结果进详情（应有关联知识条目 + ★临床实践规则区块） */
    q('#kbmResList .kbm-cell').click(); await sleep(220);
    R.kb2Detail2 = {
      title: txt(q('#kbmDetailT')),
      kbLinks: qa('#kbmDetail [data-kbopen]').length,
      crumbMode: txt(q('#kbmCrumbMode')),
      domRow: qa('#kbmDetail .kbm-drow > span').map(s => txt(s)).indexOf('所属知识域') > -1,
      rules: qa('#kbmDetail .kbm-rule').length
    };
    q('[data-kb2back]').click(); await sleep(180);
    /* 空态 */
    q('#kb2Q').value = 'zzzz-不存在的关键词-9999';
    q('[data-kb2search]').click(); await sleep(240);
    R.kb2NoHit = { emptyAlert: qa('#kbmSearchRes .alert--info').length, count: txt(q('#kb2Count')) };
    q('[data-kb2clear]').click(); await sleep(200);
    /* 管理模式：生命周期管道 + 状态筛选 + 归档↔恢复可逆（知识全生命周期） */
    q('[data-kb2mode="admin"]').click(); await sleep(240);
    const kb2St0 = window.__kb2St();
    R.kb2Admin = {
      pipeN: qa('#kbmPipe .kbm-pipe__n').length,       /* 期望 4：采集/待审核/已发布/已归档 */
      rows: qa('#kbmAdmTbl tbody tr').length,
      st: kb2St0,
      stSum: kb2St0.draft + kb2St0.review + kb2St0.pub + kb2St0.arch,
      total: window.__kb2Count(),
      hasAdd: !!q('#page-kbmed [data-kb2add]')
    };
    /* 状态筛选：待审核行数与管道计数一致 */
    q('[data-kb2afilt="review"]').click(); await sleep(200);
    R.kb2Admin.filtRows = qa('#kbmAdmTbl tbody tr').length;
    R.kb2Admin.filtOn = txt(q('#kbmAFlt .kbm-tag.is-on'));
    q('[data-kb2afilt="all"]').click(); await sleep(200);
    /* 归档 → 恢复：可逆流转，状态计数复原（不污染后续用例与截图） */
    q('#kbmAdmTbl [data-kb2lc="arch"]').click(); await sleep(220);
    const kb2St1 = window.__kb2St();
    R.kb2LC = { archAfter: kb2St1.arch, pubAfter: kb2St1.pub };
    q('#kbmAdmTbl [data-kb2lc="pub"]').click(); await sleep(220);
    const kb2St2 = window.__kb2St();
    R.kb2LC.back = (kb2St2.arch === kb2St0.arch && kb2St2.pub === kb2St0.pub
                    && kb2St2.draft === kb2St0.draft && kb2St2.review === kb2St0.review);
    /* 回检索模式做新增用例 */
    q('[data-kb2mode="search"]').click(); await sleep(200);
    /* 知识采集（需求 1）：两段式 —— 先选知识域，再二选一选采集方式；
       两种方式互斥不同时出现，差异模块随知识域变化。 */
    R.kb2AddBefore = window.__kb2Count();
    q('[data-kb2add]').click(); await sleep(260);
    R.kb2Step1 = {
      modal: !q('#modal').hidden,
      doms: qa('#modalB [data-kbc-dom]').length,          /* 期望 4：四个知识域卡片 */
      fields: qa('#modalB .fld').length,                  /* 期望 0：还没选域，不该有表单 */
      upInput: qa('#modalB input[type=file]').length,     /* 期望 0 */
      stepOn: txt(q('#modalB .kbc-step.is-on')),          /* 期望含「选择知识域」 */
      foot: qa('#modalF button').map(function (b) { return b.textContent.trim(); })
    };
    /* 选「临床知识」→ 第 2 步：两种方式并排摆出，且都还没选中 */
    q('[data-kbc-dom="clin"]').click(); await sleep(260);
    R.kb2Step2 = {
      domTag: txt(q('#modalB .kbc-way .tag')),            /* 期望 clin 的域中文名 */
      ways: qa('#modalB [data-kbc-way]').length,          /* 期望 2：手动填写 / 上传文件 */
      waysOn: qa('#modalB [data-kbc-way].is-on').length,  /* 期望 0：都还没选 */
      empty: qa('#modalB .pd__empty').length,             /* 期望 1：先选一种方式 */
      baseFields: qa('#modalB .kbc-base .fld').length,    /* 期望 0 */
      mods: qa('#modalB .kbc-mod').length,                /* 期望 0 */
      upInput: qa('#modalB input[type=file]').length,     /* 期望 0 */
      foot: qa('#modalF button').map(function (b) { return b.textContent.trim(); })
    };
    /* 选「手动填写」→ 长出本域专属模块；上传块整块不出现（互斥） */
    q('[data-kbc-way="manual"]').click(); await sleep(260);
    R.kb2Manual = {
      modTitles: qa('#modalB .kbc-mod__hd').map(txt),     /* 期望 ['标准化临床实践规则'] */
      ruleRows: qa('#modalB .kbc-row').length,            /* 期望 1：起手一条 */
      baseFields: qa('#modalB .kbc-base .fld').length,    /* 期望 5 */
      upInput: qa('#modalB input[type=file]').length      /* 期望 0：手动方式下没有上传 */
    };
    /* 切「上传文件」→ 手动模块整块消失、只剩上传块 */
    q('[data-kbc-way="upload"]').click(); await sleep(260);
    R.kb2Upload = {
      modTitles: qa('#modalB .kbc-mod__hd').map(txt),     /* 期望 ['上传与解析'] */
      ruleRows: qa('#modalB .kbc-row').length,            /* 期望 0 */
      upInput: qa('#modalB input[type=file]').length,     /* 期望 1 */
      upMultiple: !!(q('#kb2NewFiles') && q('#kb2NewFiles').multiple),
      hint: txt(q('#modalB .kbm-up__hint')),
      /* 读属性而不是读文字：卡片文字里除了名字还有一句 tip，
         txt() 会把它们连成一串，「等于」就断不成了 */
      wayOn: (function () {
        const b = q('#modalB [data-kbc-way].is-on'); return b ? b.getAttribute('data-kbc-way') : '(none)';
      })()
    };
    /* 换知识域 = 换模块：四个域各点一遍，模块标题与专属字段逐域不同 */
    const kb2Mods = {};
    for (const dm of ['samp', 'omics', 'lit', 'clin']) {
      q('[data-kbc-reset]').click(); await sleep(160);
      q('[data-kbc-dom="' + dm + '"]').click(); await sleep(180);
      q('[data-kbc-way="manual"]').click(); await sleep(220);
      const r = window.__kbc();
      kb2Mods[dm] = { t: r.modTitle, mods: r.modN, rules: r.ruleN, nets: qa('#modalB [data-kbcnet]').length };
    }
    R.kb2ModByDom = kb2Mods;
    /* 守卫：中文名称为空就提交 → 拦下，仍停在第 2 步、不进审核提醒 */
    q('[data-kbc-ok]').click(); await sleep(260);
    R.kb2Blocked = {
      modal: !q('#modal').hidden,
      title: txt(q('#modalT')),                            /* 期望仍是「新增知识采集」 */
      step: window.__kbc().step
    };
    /* 填齐（临床规则至少一条有内容）→ 审核提醒 → 确认入库 */
    window.__kbc('fill', {
      name: '肝细胞癌（新词条）',
      rules: [['R-C01', 'Child-Pugh C 级优先评估肝移植', '2019 版诊疗规范']]
    }); await sleep(200);
    q('[data-kbc-ok]').click(); await sleep(280);
    R.kb2AddRemind = {
      title: txt(q('#modalT')),
      body: txt(q('#modalB')),
      hasBack: !!q('[data-kb2add-back]'),
      hasFinal: !!q('[data-kb2add-final]')
    };
    /* 返回修改：回到第 2 步且会话还活着（分类选错不用重选域） */
    q('[data-kb2add-back]').click(); await sleep(220);
    R.kb2AddBack = { step: window.__kbc().step, modTitles: qa('#modalB .kbc-mod__hd').map(txt) };
    q('[data-kbc-ok]').click(); await sleep(260);
    q('[data-kb2add-final]').click(); await sleep(300);
    const kb2St3 = window.__kb2St();
    R.kb2AddDone = {
      modalClosed: q('#modal').hidden,
      firstCell: txt(q('#kbmRecent .kbm-row:first-child .kbm-cell:first-child .kbm-cell__n')),
      newTag: qa('#kbmRecent .kbm-cell__new').length,
      total: window.__kb2Count(),
      draftAfter: kb2St3.draft          /* 新增默认进入「采集」状态 */
    };
    /* 撤掉用例词条：后续截图与文案守卫见干净态 */
    window.__kb2Reset(); await sleep(240);

    /* ---- 自有知识库：上传 → 五步解析 → 版本表 +1 行 ---- */
    goPage('kbown').click(); await sleep(280);
    R.kbOwn = {
      on: qa('.page.is-on')[0].id,          /* 期望 page-kbown */
      verRows: qa('#kbVerTbl tr').length,
      hasUpload: !!q('#page-kbown [data-kbupload]')
    };
    q('#page-kbown [data-kbupload]').click(); await sleep(420);
    R.kbOwnParse = { visible: !q('#kbParse').hidden, steps: qa('#kbParseSteps .qrow').length, running: qa('#kbParseSteps .qpos--me').length };
    await sleep(2900);
    R.kbOwnParseEnd = {
      done: qa('#kbParseSteps .qpos.is-ok').length,
      steps: qa('#kbParseSteps .qrow').length,
      verRows: qa('#kbVerTbl tr').length
    };

    /* ---- 知识图谱：节点点击 → 关联面板 → 原文要点 → 重建图谱 ---- */
    goPage('kbgraph').click(); await sleep(280);
    R.kbGraph = {
      on: qa('.page.is-on')[0].id,          /* 期望 page-kbgraph */
      graphSvg: qa('#kbGraph svg.chart').length,
      graphNodes: qa('#kbGraph .gnode').length,
      panelTitle: txt(q('#kbPanel .card__t')),
      nodeSteps: qa('#nodeSteps .qrow').length,
      /* 图谱重建进度不能再用已删除的建模口径步骤名 */
      stepNames: qa('#nodeSteps .qrow .flex-1').map(n => txt(n))
    };
    const gnode = q('#kbGraph .gnode[data-kbnode="CYP3A4"]');
    gnode.dispatchEvent(new MouseEvent('click', { bubbles: true })); await sleep(240);
    R.kbGraphNode = {
      panelTitle: txt(q('#kbPanel .card__t')),
      selected: qa('#kbGraph .gnode.is-on').length,
      selectedId: q('#kbGraph .gnode.is-on') ? q('#kbGraph .gnode.is-on').getAttribute('data-kbnode') : '(none)',
      cites: qa('#kbPanel .kbrow--mini').length,
      bodyLen: txt(q('#kbPanel .pbody')).length,
      evRows: qa('#kbPanel .krrow').length
    };
    /* 原文要点弹窗 */
    q('#kbPanel [data-kbopen]').click(); await sleep(220);
    R.kbGraphModal = { open: !q('#modal').hidden, tags: qa('#modalB .tag').length };
    q('[data-close="modal"]').click(); await sleep(180);
    R.kbGraphModalClosed = q('#modal').hidden;
    /* 重建图谱 */
    q('#graphBuild').click(); await sleep(2800);
    R.kbGraphRebuild = {
      checked: q('#graphBuild').getAttribute('aria-checked'),
      done: qa('#nodeSteps .qpos.is-ok').length,
      steps: qa('#nodeSteps .qrow').length
    };

    /* v58：段首把这三页切到了「站内版本」，现在切回默认的「外部系统」。
       不还原的话，后面任何量这三页的断言都会在错的视图上量 ——
       而且失败原因会指向「词条/节点少了」这种完全无关的方向。 */
    ['kbmed', 'kbown', 'kbgraph'].forEach(function (id) { window.__kbView(id, 'ext'); });
    await sleep(160);
    R.kbLocalRestored = ['kbmed', 'kbown', 'kbgraph'].every(function (id) {
      const v = window.__kbView(id);
      return v.mode === 'ext' && v.frameShown === true && v.localHidden === true;
    });

    /* ---- 数据资产「样本档案」页（v46：页内的「基因档案」那块已整块撤走）----
       v46 之前这一页有两个页内 tab，统计一律限定到 #apanel-gene 才不会与样本
       档案那半边串味（4 会变 8、7 会变 11）。撤掉之后只剩一个面板，
       统计落 #sampPanel —— 但「只剩一个、且那一个真的铺开」这件事要断住。 */
    goPage('gene').click(); await sleep(280);
    R.gene = {
      on: qa('.page.is-on')[0].id,          /* 期望 page-gene */
      h1: txt(q('#page-gene .phead__h1')),
      eye: txt(q('#page-gene .phead__eye')),
      aria: q('#page-gene').getAttribute('aria-label'),
      navLabel: txt(qa('.snav__i').filter(b => b.getAttribute('data-go') === 'gene')[0]),
      /* v46 五连：页签条 / 基因档案面板 / 分派用的页头按钮 / 清单表 / 重建抽屉 */
      ptabs: qa('#page-gene .ptab').length,              /* 期望 0 */
      genePanel: !!q('#apanel-gene'),                    /* 期望 false */
      geneBtns: qa('#page-gene [data-tabonly]').length,  /* 期望 0 */
      geneTable: !!q('#geneTbl'),                        /* 期望 false */
      geneDrawer: !!q('#drawerGene'),                    /* 期望 false */
      headBtns: qa('#page-gene .phead__side .btn').map(txt),
      sampPanel: !!q('#sampPanel'),
      sampPanelH: (function () { var e = q('#sampPanel');
        return e ? Math.round(e.getBoundingClientRect().height) : 0; })(),
      sampCards: qa('#sampPanel > .card').length,
      grpGone: !q('#crumbGrp'),   /* 期望 true：「数据资产」分组只有这一页，那一段是死段 */
      crumb: txt(q('#crumb')),
      stepHidden: q('#crumbStep').hidden
    };

    /* ---- 文件管理（独立页 #page-files，v33 自样本档案第三个 tab 升格）----
       全程走真实点击；状态从 __fmState() 现算，不与写死数字互相将就。 */
    window.__goto('files'); await sleep(300);
    R.fm = {};
    R.fm.pageOn = q('#page-files').classList.contains('is-on');
    R.fm.crumb = txt(q('#crumb'));
    R.fm.navPos = (function () {
      const ids = qa('.snav__i').map(b => b.getAttribute('data-go'));
      return { has: ids.indexOf('files') > -1,
               afterGene: ids.indexOf('files') === ids.indexOf('gene') + 1 };
    })();
    R.fm.st0 = window.__fmState();
    /* 个人文件默认态 */
    R.fm.mine = {
      segOn: qa('#fmSeg .seg__b.is-on').map(b => b.getAttribute('data-fmscope')),
      upCard: !q('#fmUpCard').hidden,
      loc: q('#fmLocName') ? q('#fmLocName').textContent : null,
      headWho: q('#fmHead').textContent.indexOf('上传人') > -1,
      dirRows: qa('#fmBody [data-fm-dirtoggle]').length,
      noNest: qa('#fmBody .fmnest').length === 0,
      acceptFree: (function () { const i = q('#fmFile'); return i && i.accept === '' && i.multiple; })()
    };
    /* 展开第一个文件夹 → 文件行嵌套（S037 血浆 WGS 内置 2 份） */
    q('#fmBody [data-fm-dirtoggle]').click(); await sleep(240);
    R.fm.nestN = qa('#fmBody .fmnest').length;
    R.fm.expandAria = q('#fmBody [data-fm-dirtoggle]').getAttribute('aria-expanded');
    /* 更改位置 → 弹窗行可命中 → 选中文件夹 */
    q('[data-fm-loc]').click(); await sleep(260);
    R.fm.locRows = qa('[data-fm-locpick]').length;
    R.fm.locHit = hitOK('[data-fm-locpick]:not(.is-on)');
    qa('[data-fm-locpick]').filter(b => b.textContent.indexOf('肝细胞癌') > -1)[0].click();
    await sleep(240);
    R.fm.loc2 = q('#fmLocName').textContent;
    /* 待上传 → 立即上传 → mine 6→7、uploaded 1、总计数 17 */
    window.__fmAddFake('S076_1.fastq.gz', 3.4); await sleep(200);
    R.fm.pend = window.__fmState().pend;
    q('[data-fm-upload]').click(); await sleep(320);
    R.fm.st1 = window.__fmState();
    /* 内置条目点下载：如实告知、不弹确认框（与样本资料同一条规则） */
    qa('#fmBody [data-fm-dl]')[0].click(); await sleep(280);
    R.fm.dlModal = !q('#modal').hidden;
    R.fm.dlToast = txt(qa('.toast').slice(-1)[0]);
    if (R.fm.dlModal) { q('#modal .iconbtn[data-close="modal"]').click(); await sleep(180); }
    /* 新建 → 重命名 → 删除（全程弹窗 + 真按钮） */
    q('[data-fm-newdir]').click(); await sleep(260);
    q('#fmDirName').value = 'S076 验证批';
    q('[data-fm-newdir-ok]').click(); await sleep(280);
    R.fm.dirMade = txt(q('#fmBody')).indexOf('S076 验证批') > -1;
    const fmRn = qa('#fmBody [data-fm-rename]').filter(b => b.getAttribute('data-fm-rename').indexOf('S076 验证批') > -1)[0];
    fmRn.scrollIntoView({ block: 'center' }); fmRn.click(); await sleep(260);
    R.fm.rnHit = hitOK('#fmRenameInp');
    q('#fmRenameInp').value = 'S076 验证批B';
    q('[data-fm-rename-ok]').click(); await sleep(280);
    R.fm.renamed = txt(q('#fmBody')).indexOf('S076 验证批B') > -1;
    const fmDel = qa('#fmBody [data-fm-del]').filter(b => b.getAttribute('data-fm-del').indexOf('S076 验证批B') > -1)[0];
    fmDel.scrollIntoView({ block: 'center' }); fmDel.click(); await sleep(260);
    R.fm.delHit = hitOK('[data-fm-del-ok]');
    q('[data-fm-del-ok]').click(); await sleep(280);
    R.fm.dirGone = txt(q('#fmBody')).indexOf('S076 验证批B') < 0;
    /* 搜索过滤 */
    q('#fmQ').value = 'S037';
    q('#fmQ').dispatchEvent(new Event('input', { bubbles: true })); await sleep(240);
    R.fm.qState = window.__fmState().q;
    R.fm.qHit = txt(q('#fmBody')).indexOf('S037_1.fastq.gz') > -1;
    R.fm.qMiss = txt(q('#fmBody')).indexOf('S068_1') < 0;
    q('#fmQ').value = '';
    q('#fmQ').dispatchEvent(new Event('input', { bubbles: true })); await sleep(200);
    /* 团队：上传人列 + 项目组筛选 + 必选项目组拦截。
       团队内置文件全在文件夹里 —— 展开一个才看得到「上传人」单元格。 */
    window.__fmScope('team'); await sleep(260);
    qa('#fmBody [data-fm-dirtoggle]').filter(b => b.getAttribute('data-fm-dirtoggle').indexOf('肝癌') > -1)[0].click();
    await sleep(240);
    R.fm.team = {
      headWho: q('#fmHead').textContent.indexOf('上传人') > -1,
      pjFlt: !q('#fmPjFlt').hidden,
      pjOpts: qa('#fmPjFlt option').length,
      projSel: !!q('#fmProjSel'),
      whoCell: txt(q('#fmBody')).indexOf('陈铭') > -1
    };
    window.__fmAddFake('shared_probe.tsv', 0.1); await sleep(180);
    q('[data-fm-upload]').click(); await sleep(300);
    R.fm.teamBlocked = window.__fmState().uploaded === 1;   /* 仍只有 mine 那 1 个 */
    const fmPd = q('[data-fm-pend-del]');
    if (fmPd) fmPd.click(); await sleep(180);
    /* v56：系统文件不再是「一律只读」。这里采的是**超级管理员**（默认身份），
       它现在应该能上传、能删改；只读身份那一档由 __fmPerm 单独采。 */
    window.__fmScope('sys'); await sleep(260);
    /* v56：默认身份是超级管理员，系统文件对它可写。
       读权限（预览 / 下载）量的是**文件行** —— 系统文件默认折叠、只看得见 3 行
       文件夹，此时量到的 0 是「没有文件」而非「没有按钮」。
       用 __fmPerm 那套（量完复原展开态）来量，别在这里手动点开 ——
       手动展开会改了下一段「示例数据集两级结构」的起点（它要求折叠态）。 */
    R.fm.sys = {
      upCardShown: !q('#fmUpCard').hidden,
      dzShown: !!(q('#fmDz') && !q('#fmDz').hidden),
      newdirShown: !q('#fmTools [data-fm-newdir]').hidden,
      canDel: qa('#fmBody [data-fm-del]').length > 0,
      /* 读权限：预览 / 下载按钮必须在文件行上（数量由 __fmPerm 断言） */
      viewBtns: qa('#fmBody [data-fm-view]').length,
      dlBtns: qa('#fmBody [data-fm-dl]').length
    };
    /* ---- v37 需求 2：系统文件里「示例数据集」下挂三个子文件夹 ----
       两级都要真的能展开：只挂一级标题不挂内容 = 空壳；子夹展开后
       文件行必须缩进两级（nest--2），否则三级结构在视觉上塌成两级。
       结构从 DOM 现算（展开 → 数行），不读 FM_DATA —— 读数据源只能证明
       「数据里有」，证明不了「页面上看得出层级」。 */
    const _dirT = sel => qa('#fmBody [data-fm-dirtoggle="' + sel + '"]');
    _dirT('示例数据集')[0] && _dirT('示例数据集')[0].click(); await sleep(240);
    R.fm.demo = {
      lv1:   _dirT('示例数据集').length,
      lv1Txt: _dirT('示例数据集')[0] ? txt(_dirT('示例数据集')[0]) : '',
      subs:  ['院内队列', '人类公开', '小鼠公开'].map(n => _dirT('示例数据集/' + n).length),
      subTxt: ['院内队列', '人类公开', '小鼠公开'].map(n => {
        const b = _dirT('示例数据集/' + n)[0]; return b ? txt(b) : '(missing)';
      }),
      subCls: _dirT('示例数据集/院内队列')[0] ? _dirT('示例数据集/院内队列')[0].className : '',
      /* 子夹还没展开时，深层文件不该出现在表里（否则层级是假的） */
      deepBefore: qa('#fmBody .fmnest--2').length,
      /* 层级缩进看 computed padding-left，不看 getBoundingClientRect().left ——
         表头和单元格是全站居中的（v20），居中会把整行内容按宽度重新分配，
         于是「更深的那一级」在屏幕上的左边界反而可能更靠左（本轮实测
         一级 479 / 二级 475 / 三级 440，三个数字完全读不出层级）。
         缩进是设计上唯一表达层级的东西，量的就该是它。 */
      lvPad: (function () {
        const pad = el => el ? Math.round(parseFloat(getComputedStyle(el).paddingLeft)) : -1;
        return { dir: pad(_dirT('示例数据集')[0]),
                 sub: pad(_dirT('示例数据集/院内队列')[0]) };
      })()
    };
    _dirT('示例数据集/院内队列')[0] && _dirT('示例数据集/院内队列')[0].click(); await sleep(260);
    R.fm.demo.deepAfter = qa('#fmBody .fmnest--2').length;
    R.fm.demo.deepNames = qa('#fmBody .fmnest--2').map(n => txt(n));
    R.fm.demo.deepPad = (function () {
      const a = q('#fmBody .fmnest--2');
      return a ? Math.round(parseFloat(getComputedStyle(a).paddingLeft)) : -1;
    })();
    R.fm.demo.dirCount = window.__fmState().dirs.sys;
    window.__fmReset(); await sleep(200);
    window.__fmScope('sys'); await sleep(240);
    /* 复位：回到默认范围与默认态，并离开文件管理页 —— 本段之后还有量
       #sampListCard 几何的断言，停在本页的话那张卡不在当前页、宽度为 0。 */
    window.__fmScope('mine'); await sleep(200);
    window.__fmReset(); await sleep(200);
    window.__goto('gene'); await sleep(240);

    /* ---- 弹窗层叠：命中测试（hitOK 定义在脚本开头，见「跨段复用的辅助函数」） ----
       v37：新建项目改成五步向导后，这里跟着换字段 —— 守的东西没变，
       仍是「弹窗里的控件点得到、遮罩本身也点得到」。
       v50 需求 3：点「新建项目」先出一屏**选择**，所以这里多走一步 ——
       先断那一屏（两块入口、整块可点、这一屏里没有 stepper），
       再走「一键全流程分析」进向导本体。两条入口都是真链路，
       各自要走一遍：另一条（智能分析）在下面紧接着走。 */
    goPage('proj').click(); await sleep(240);
    q('[data-proj-new]').click(); await sleep(320);
    R.pnChoose = {
      open: !q('#modal').hidden,
      title: txt(q('#modalT')),
      cards: qa('.pnchoose__c').length,
      names: qa('.pnchoose__n').map(txt),
      keys: qa('.pnchoose__c').map(b => b.getAttribute('data-pns')),
      descLen: qa('.pnchoose__c .pnchoose__d').map(b => txt(b).length),
      /* v52 需求 1：智能分析的简介改成「自定义自编排工作流」，步数说明跟着 5 步走。
         文案断言收在判定段（v52 那组），这里只负责把字带出来。 */
      smartDesc: (function () { var c = qa('.pnchoose__c')[1];
        return c ? txt(c.querySelector('.pnchoose__d')) : null; })(),
      smartMeta: (function () { var c = qa('.pnchoose__c')[1];
        return c ? txt(c.querySelector('.pnchoose__m')) : null; })(),
      /* 这一屏**不是**向导：里面不该有 stepper，弹窗也不该是宽版 */
      stepper: qa('#modalB .wiz').length,
      wide: q('#modal .modal__b').classList.contains('modal__b--wide'),
      foot: qa('#modalF .btn').map(b => txt(b)),
      hitFull: hitOK('.pnchoose__c[data-pns="full"]'),
      hitSmart: hitOK('.pnchoose__c[data-pns="smart"]')
    };
    /* 先走「智能分析」：它要落到 p02，而且不该建出项目来。
       这一段也是「智能分析整组不在菜单里、但页面照旧可达」的证据。 */
    const projN0 = qa('#projGrid .projcard').length;
    q('.pnchoose__c[data-pns="smart"]').click(); await sleep(420);
    R.pnSmart = {
      modalHidden: q('#modal').hidden,
      modalWideLeft: q('#modal .modal__b').classList.contains('modal__b--wide'),
      page: qa('.page.is-on')[0].id,
      crumb: txt(q('#crumb')),
      crumbHome: txt(q('#crumbHome')),
      steps: qa('#page-p02 .stepper__i').length,
      picker: !!q('#p02Pick .pn2col'),
      toast: lastToast(),
      navCur: qa('.snav__i[aria-current="page"]').length,   /* 期望 0：这一组不在菜单里 */
      navSmart: qa('.snav__i[data-go="p02"]').length        /* 期望 0 */
    };
    /* 再走「一键全流程分析」：回到向导本体，字段与命中测试照旧。
       ⚠ 取不到就报一个不可能通过的值，别直接 .focus() —— 一旦 #pnName 不在，
       抛错会**打断整段驱动脚本**，其后几百条结果一条都看不到（v47 的坑）。 */
    goPage('proj').click(); await sleep(240);
    q('[data-proj-new]').click(); await sleep(300);
    q('.pnchoose__c[data-pns="full"]').click(); await sleep(340);
    R.projModalHit = {
      open: !q('#modal').hidden,
      chooseGone: qa('.pnchoose__c').length,      /* 期望 0：那一屏被向导换掉了 */
      stepper: qa('#modalB .wiz__i').length,      /* 期望 6 步 */
      wide: q('#modal .modal__b').classList.contains('modal__b--wide'),
      projN0: projN0,
      projN1: qa('#projGrid .projcard').length,   /* 与 projN0 相等：进向导还不建项目 */
      name: hitOK('#pnName'), desc: hitOK('#pnDesc'), sampDesc: hitOK('#pnSampDesc'),
      submit: hitOK('[data-pn="next"]'),
      sidAdd: hitOK('[data-pn="sid-new"]'),
      closeBtn: hitOK('#modal .iconbtn[data-close="modal"]'),
      /* 遮罩自己仍要能点：点弹窗外部应关闭，这条不能被「修好穿透」顺手改坏 */
      backdrop: (function () { const b = q('#modal .back');
        return !!(b && document.elementFromPoint(24, 24) === b); })()
    };
    const _nn = q('#pnName');
    if (_nn) _nn.focus();
    R.projModalHit.focusable = !!(_nn && document.activeElement.id === 'pnName');
    const _mc = q('#modal .iconbtn[data-close="modal"]');
    if (_mc) _mc.click();
    await sleep(200);
    R.projModalHit.closedByBtn = q('#modal').hidden;

    /* ---- 样本档案：查询 / 血缘谱系 / 跨组学关联 ---- */
    const boxAt = sel => { const e = q(sel); if (!e) return { w: 0, h: 0 };
      const r = e.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) }; };

    goPage('gene').click(); await sleep(320);

    /* ---- 样本详情抽屉（v26）：列表留在页面上挑，选中后详情从右侧滑出 ----
       四条一起量，缺一条都会退化成「看着像抽屉」：
       ① 状态位（hidden / .is-open）② 定位方式与覆盖范围（贴右、满高）
       ③ 变化量（主内容真的让出了宽度，不是改了个类名）④ 命中测试
       （抽屉里的控件点得到，**页面上的列表也要点得到** —— 用户选的是
       「抽屉开着仍能翻列表」，遮罩式实现会在这里露馅）。 */
    R.sampDrawer0 = {
      hidden: q('#drawerSamp').hidden,
      padRight: getComputedStyle(q('#content')).paddingRight,
      listW: Math.round(q('#sampListCard').getBoundingClientRect().width),
      /* 面板里现在只剩列表卡一张 —— 详情五块已搬进抽屉 */
      panelCards: qa('#sampPanel > .card').length
    };
    q('#sampTbody tr:nth-child(2) .sampid').click(); await sleep(520);
    /* 名字别用 dr：脚本后面那段工具抽屉已经声明过一次同名 const（同一作用域） */
    const drS = q('#drawerSamp'), drr = drS.getBoundingClientRect();
    const drcs = getComputedStyle(drS);
    R.sampDrawer1 = {
      hidden: drS.hidden, isOpen: drS.classList.contains('is-open'),
      position: drcs.position, z: drcs.zIndex,
      w: Math.round(drr.width), left: Math.round(drr.left), right: Math.round(drr.right),
      h: Math.round(drr.height), vw: window.innerWidth, vh: window.innerHeight,
      coversRight: Math.round(drr.right) === window.innerWidth,
      fullH: Math.round(drr.height) === window.innerHeight,
      padRight: getComputedStyle(q('#content')).paddingRight,
      listW: Math.round(q('#sampListCard').getBoundingClientRect().width),
      bodyCls: document.body.classList.contains('is-sampdrawer'),
      cur: window.__sampState().cur,
      head: txt(q('#sampDrawerId')), sub: txt(q('#sampDrawerSub')),
      moved: ['#sampKpis', '#sampInfoCard', '#linCard', '#omTbl']
             .map(s => !!(q(s) && q(s).closest('#drawerSamp'))),
      hitClose: hitOK2('[data-close="samp"]'),
      hitRow: hitOK2('#sampTbody tr:nth-child(3) .sampid'),
      hitPager: hitOK2('#sampPager button'),
      /* 抽屉体是 flex 列、高度确定 —— 子项若被按比例压扁，颜色 / 文字 / 行数
         全都还是对的，只有截图看得见。判据：被压扁的盒子内容溢出，
         scrollHeight > clientHeight。四块详情逐个量，别只看其中一块。 */
      clipped: Array.prototype.map.call(drS.querySelectorAll('.drawer__bd > *'), function (el) {
        return { id: el.id || el.className.split(' ')[0],
                 d: el.scrollHeight - el.clientHeight,
                 h: el.getBoundingClientRect().height };
      })
    };
    /* 抽屉开着点另一行：内容**原地换**，不关也不重播滑入 */
    const wantId2 = q('#sampTbody tr:nth-child(4) .sampid').textContent.trim();
    q('#sampTbody tr:nth-child(4) .sampid').click(); await sleep(400);
    R.sampDrawer2 = { want: wantId2, cur: window.__sampState().cur,
                      head: txt(q('#sampDrawerId')),
                      kpi: txt(q('#sampKpis .mcell__v')),
                      stillOpen: !q('#drawerSamp').hidden,
                      isOpen: q('#drawerSamp').classList.contains('is-open') };
    /* Esc 分层：抽屉里开出的弹窗先退，抽屉自己留着 ——
       从抽屉里点「编辑信息」，按 Esc 应该是回到抽屉而不是全没。 */
    q('[data-dl="samples"]').click(); await sleep(340);
    const escEv = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    R.sampDrawerEsc1 = { modal: !q('#modal').hidden, drawer: !q('#drawerSamp').hidden };
    escEv(); await sleep(380);
    R.sampDrawerEsc2 = { modal: !q('#modal').hidden, drawer: !q('#drawerSamp').hidden };
    escEv(); await sleep(440);
    R.sampDrawerEsc3 = { drawer: !q('#drawerSamp').hidden,
                         padRight: getComputedStyle(q('#content')).paddingRight,
                         bodyCls: document.body.classList.contains('is-sampdrawer') };
    /* 跨组学表「查看数据」→ 项目概况页。v39 把项目详情从「二级抽屉」改成独立页面，
       这一跳的语义跟着变，断言也整段换：
       ① 它是真跳页（.page.is-on 换了），不再是盖在样本抽屉上的浮层；
       ② 样本抽屉跟着收起 —— 抽屉是样本档案页的浮层，跳走了还挂着就是幽灵面板；
       ③ 返回只有面包屑一条路（v17），所以页面上**不该有关闭键**。 */
    window.__sampPick('S037'); await sleep(420);
    const omBtn = q('#omBody [data-om-open]');
    R.sampDrill0 = { hasBtn: !!omBtn, sampOpen: !q('#drawerSamp').hidden };
    omBtn.click(); await sleep(520);
    R.sampDrill1 = {
      onPage: q('#page-projdetail').classList.contains('is-on'),
      pageId: q('.page.is-on').id,
      sampClosed: q('#drawerSamp').hidden,
      tag: txt(q('#projTag')),
      name: txt(q('#projName')),
      cur: window.__sampState().cur,
      /* v40：落点从「项目信息里的关联数据集」搬到了「数据集」页签 ——
         所以闪的是数据集页签里那块输入 / 输出明细。 */
      flash: !!q('#projBody [data-pdsec="ds-detail"].is-flash'),
      noCloseBtn: qa('#page-projdetail [data-close]').length,      /* 期望 0 */
      /* 面包屑 = 可点段（.crumb__l）+ 末尾当前段（#crumb，不可点）。
         项目概况自己就是当前段，所以可点段只有「工作台 / 项目管理」两段。 */
      crumb: qa('#crumbBar .crumb__l').map(txt),
      crumbCur: txt(q('#crumb')),
      crumbParent: txt(q('#crumbParent'))
    };
    /* 返回走面包屑的「项目管理」段 —— 它是这一层唯一的回头路 */
    q('#crumbParent').click(); await sleep(360);
    R.sampDrill2 = { onList: q('#page-proj').classList.contains('is-on'),
                     detailOff: !q('#page-projdetail').classList.contains('is-on') };
    /* 再进一次：这次不先开样本抽屉，直接跳页也要能到位（页面不依赖抽屉） */
    window.__sampPick('S037'); await sleep(220);
    q('#omBody [data-om-open]').click(); await sleep(460);
    R.sampDrill3 = { onPage: q('#page-projdetail').classList.contains('is-on'),
                     tag: txt(q('#projTag')),
                     tab: window.__projDetail().tab,                 /* 期望 info */
                     sv: window.__sampState().drawer };               /* 样本抽屉已关 */
    window.__go('gene'); await sleep(320);
    /* 跳页要把它收起来：它是某一页的浮层，留在屏幕上就是幽灵面板。
       （v46 前这里还有一条「切 tab 也收起来」—— 页面没有可切的 tab 了，删。） */
    window.__sampDrawer(true); await sleep(440);
    window.__go('p01'); await sleep(420);
    R.sampDrawerNav = { drawer: !q('#drawerSamp').hidden, page: q('.page.is-on').id };
    /* 关闭按钮：抽屉与「让出的宽度」都要还回去 */
    window.__go('gene'); await sleep(320);
    window.__sampDrawer(true); await sleep(440);
    q('[data-close="samp"]').click(); await sleep(440);
    R.sampDrawerClose = { hidden: q('#drawerSamp').hidden,
                          padRight: getComputedStyle(q('#content')).paddingRight,
                          bodyCls: document.body.classList.contains('is-sampdrawer') };
    /* 收尾：回到样本页、选定 S037、打开抽屉 —— 后面所有样本段都在这个起点上 */
    window.__sampPick('S037'); await sleep(460);
    R.sampDrawerReady = { cur: window.__sampState().cur, drawer: !q('#drawerSamp').hidden };

    R.samp0 = {
      tab: window.__sampState().tab,
      /* 候选 chips 已撤（v27）：查询卡里不该再有任何 chip，罗列与下方列表重复 */
      chipsGone: !q('#sampChips'),
      /* 选中态改由列表行表达：当前样本行高亮且只有一行 */
      rowOn: qa('#sampTbody tr.is-on').length,
      onId: txt(q('#sampTbody tr.is-on .sampid')),
      kpi: qa('#sampKpis .mcell').length,
      kpiV: qa('#sampKpis .mcell__v').map(txt),
      nodes: qa('#linBox [data-linnode]').length,
      edges: qa('#linBox path[marker-end]').length,
      badge: qa('#linBox circle').length,
      omRows: qa('#omBody tr').length,
      /* 跨组学表限定到 #omTbl：这一页现在有两张表（跨组学 + 资料），
         按 #sampPanel 数 thead th 会把两张一起数进来（7 变 14，
         看着"通过"其实量的不是同一块） */
      omCols: qa('#omTbl thead th').length,
      omHead: qa('#omTbl thead th').map(txt),
      omBlob: txt(q('#omBody')),
      hitNode: hitOK2('[data-linnode="S037-C"]'),
      /* chips 撤了，查询卡旁真正的交互入口是列表行 —— 点得动才算入口还在 */
      hitRow: hitOK2('#sampTbody tr:nth-child(2) .sampid'),
      hitQ: hitOK2('#sampQ'),
      filterW: boxAt('#omFilter'),
      emptyW: boxAt('#sampEmpty')
    };

    /* ---- 特定样本条（四格）的血统配色 ----
       判据一律取**渲染出来的计算值**，不认类名也不认 token 名：
       ① 条与格子的底色都不再是白（改前四格与条底都是 #FFFFFF，
          光看 DOM 是发现不了的）；
       ② 四格四色 —— 写死成同一个色号也算「有色彩」，但那不是这条要的东西；
       ③ 顶部 3px 色条真的画出来了（inset box-shadow，别只写类名）；
       ④ 彩字压在彩底上 ≥ 4.5 —— 血缘顶栏那几个色是配白底的，直接拿来当浅底
          文字色会掉到 4.1:1（青 #14808F 在 #E6F3F4 上），必须逐格量。
       尺寸也要看一眼：四格是并排还是被挤成两行（gap 从 1px 变成 10px）。 */
    R.sampKpiTone = (function () {
      function toRgb(c) { var m = String(c).match(/[0-9.]+/g); return m ? m.slice(0, 3).map(Number) : [255, 255, 255]; }
      function lum(v) { var c = v.map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
      function lumOf(c) { return lum(toRgb(c)); }
      function ratio(a, b) { var L1 = lum(toRgb(a)), L2 = lum(toRgb(b)); var hi = Math.max(L1, L2), lo = Math.min(L1, L2); return Math.round((hi + 0.05) / (lo + 0.05) * 100) / 100; }
      var wrap = q('#sampKpis'), wcs = getComputedStyle(wrap);
      /* 页面底色也从 token 现算，不把 #F5F8FC 抄进来 —— 这条要验的正是
         「条底与页面底拉得开」，token 一改就得跟着失效。 */
      var probe = document.createElement('span');
      probe.style.background = 'var(--color-paper)';
      document.body.appendChild(probe);
      var paper = getComputedStyle(probe).backgroundColor;
      probe.remove();
      var cells = qa('#sampKpis .mcell').map(function (m) {
        var cs = getComputedStyle(m);
        var lb = m.querySelector('.mcell__l'), vv = m.querySelector('.mcell__v');
        var ft = m.querySelector('.mcell__f');
        return {
          bg: cs.backgroundColor, ink: getComputedStyle(vv).color,
          label: getComputedStyle(lb).color, foot: ft ? getComputedStyle(ft).color : '',
          bar: cs.boxShadow, radius: cs.borderTopLeftRadius,
          L: Math.round(lumOf(cs.backgroundColor) * 10000) / 10000,
          rV: ratio(cs.backgroundColor, getComputedStyle(vv).color),
          rL: ratio(cs.backgroundColor, getComputedStyle(lb).color),
          rF: ft ? ratio(cs.backgroundColor, getComputedStyle(ft).color) : 0,
          v: (vv.textContent || '').trim()
        };
      });
      var rows = Array.from(new Set(qa('#sampKpis .mcell').map(function (m) {
        return Math.round(m.getBoundingClientRect().top); }))).length;
      return {
        wrap: wcs.backgroundColor, pad: parseFloat(wcs.paddingTop),
        wrapL: Math.round(lumOf(wcs.backgroundColor) * 10000) / 10000,
        gap: parseFloat(wcs.columnGap), n: cells.length, rows: rows,
        paper: paper,
        /* 条与每格的实际高度：抽屉体是 flex 列，子项默认 flex-shrink:1 ——
           .mrow 的 overflow:hidden 会让「自动最小尺寸」退化成 0，
           四格彩底被压成 20px 的一条，而颜色 / 间距 / 行数三条断言全绿。
           判据是 offsetHeight 与 **scrollHeight** 的关系：被压扁的盒子
           scrollHeight 大于自身高度（内容溢出），正常盒子两者相等。 */
        wrapH: Math.round(wrap.getBoundingClientRect().height),
        cellH: cells.map(function (c, i) {
          var el = qa('#sampKpis .mcell')[i];
          return { h: el.offsetHeight, sh: el.scrollHeight };
        }),
        wrapClip: wrap.scrollHeight - wrap.clientHeight,
        wrapVsPaper: ratio(wcs.backgroundColor, paper),
        cellVsWrap: cells.map(function (c) { return ratio(c.bg, wcs.backgroundColor); }),
        cells: cells,
        hues: cells.map(function (c) { return c.bg; }),
        minR: cells.reduce(function (a, c) {
          return Math.min(a, c.rV, c.rL, c.rF || 99); }, 99),
        bars: cells.map(function (c) { return c.bar; })
      };
    })();

    /* ---- 血缘谱系：横向「层级 = 列」布局 ----
       三件事必须钉住，缺一件就退化成这次要改掉的旧版：
       ① 列名由数据现算 —— S068 多一层「原始登记 ID」，写死 4 列必然错；
       ② 边是正交折线 —— 含 C（三次贝塞尔）命令说明又画回旧版的斜曲线了；
       ③ 图不许被容器拉伸 —— 生成样本只有 3 列（自然宽 750），容器却有 1110，
          不锁就会被放大 1.48 倍，同一样本控件在切换时长相不一（v19 的坑）。
       另外补一组血统色对比度：列头与顶栏是新引入的配色，全站统一探针跑在图
       之前采样（此时 #linBox 还没渲染），够不着这里。 */
    const lsv = q('#linBox svg');
    const lvb = lsv.getAttribute('viewBox').split(' ').map(Number);
    const lr = lsv.getBoundingClientRect();
    const isHead = t => parseFloat(t.getAttribute('y') || '0') < 34;
    const strk = t => { const c = t.getAttribute('fill'); return c && c.toUpperCase() === '#FFFFFF'; };
    R.linLayout = {
      vb: lvb,
      svgW: Math.round(lr.width), svgH: Math.round(lr.height),
      cw: Math.round(q('#linBox').getBoundingClientRect().width),
      scale: Math.round((lr.width / lvb[2]) * 1000) / 1000,
      heads: qa('#linBox svg text').filter(isHead).map(txt),
      colsX: Array.from(new Set(qa('#linBox .linnode rect.lncard')
              .map(r => Math.round(r.getBBox().x)))).sort((a, b) => a - b),
      nodes: qa('#linBox [data-linnode]').length,
      edges: qa('#linBox path[marker-end]').length,
      curved: qa('#linBox path[marker-end]').filter(p => /C/i.test(p.getAttribute('d') || '')).length,
      eLabel: qa('#linBox svg text').filter(t => t.getAttribute('stroke') === '#FFFFFF').length,
      headBar: qa('#linBox .lnhead rect').length,
      ico: (function () { const s = qa('#linBox .linnode svg').filter(vis);
              if (!s.length) return { n: 0, w: 0, h: 0 };
              const r = s[0].getBoundingClientRect();
              return { n: s.length, w: Math.round(r.width), h: Math.round(r.height) }; })(),
      ink: qa('#linBox .lnhead').map(g => {
        const t = g.querySelector('text'), rs = g.querySelectorAll('rect');
        const bg = rs.length ? rs[rs.length - 1].getAttribute('fill') : null;
        return { t: txt(t), white: strk(t), bg: bg, ratio: bg ? rat('#FFFFFF', bg) : 0 };
      }),
      tblBtn: !!q('[data-lin-alt]'),
      tblRows: qa('#linTbl tbody tr').length
    };

    /* ---- 方向切换（v24）：横向泳道 ⇄ 上下结构 ---- */
    /* 两个方向共用同一套节点卡渲染，所以「换了个方向」不能只量节点数 ——
       真正变的是：卡宽（176 vs 250）、层级落在 y 还是 x、有没有分叉点。 */
    const linGeom = () => {
      const s = q('#linBox svg'), vb = s.getAttribute('viewBox').split(' ').map(Number);
      const r = s.getBoundingClientRect();
      const cs = qa('#linBox .linnode rect.lncard');
      return { vb: vb, scale: Math.round((r.width / vb[2]) * 1000) / 1000,
               cw: Math.round(q('#linBox').getBoundingClientRect().width),
               nodes: qa('#linBox [data-linnode]').length,
               edges: qa('#linBox path[marker-end]').length,
               curved: qa('#linBox path[marker-end]').filter(p => /C/i.test(p.getAttribute('d') || '')).length,
               rows: Array.from(new Set(cs.map(c => Math.round(c.getBBox().y)))).length,
               /* 横向布局要断的是「层级落在列上」= 去重后的**列数**（= 层数） */
               colXs: Array.from(new Set(cs.map(c => Math.round(c.getBBox().x)))).length,
               /* 同层相邻卡之间的**最小留白**：按行分组后取「左边缘之差 − 卡宽」。
                 这是「卡会不会互相压」的判据 —— 先定槽距、再把卡缩到某个最小系数
                 会让卡比槽距还宽（4 个叶子时 S=173 而卡 175，三张衍生模型叠在一起），
                 而那一眼看不出是重叠、只觉得「卡挨着卡」。单卡行给 9999（无约束）。 */
               rowGap: (function () {
                 var by = {}, m = 9999, cw = Math.round(parseFloat(cs[0].getAttribute('width')));
                 cs.forEach(function (c) { var y = Math.round(c.getBBox().y);
                   (by[y] = by[y] || []).push(Math.round(c.getBBox().x)); });
                 Object.keys(by).forEach(function (y) {
                   var a = by[y].sort(function (p, q) { return p - q; });
                   for (var i = 1; i < a.length; i++) m = Math.min(m, a[i] - a[i - 1]);
                 });
                 return m === 9999 ? 9999 : m - cw;
               })(),
               xs: Array.from(new Set(cs.map(c => Math.round(c.getBBox().x)))).sort((a, b) => a - b),
               cardW: Math.round(parseFloat(cs[0].getAttribute('width'))),
               joint: qa('#linBox [data-linjoint]').length,
               badge: qa('#linBox [data-linbadge]').length,
               ico: (function () { const s2 = qa('#linBox .linnode svg').filter(vis);
                       if (!s2.length) return { n: 0, w: 0, h: 0 };
                       const rr = s2[0].getBoundingClientRect();
                       return { n: s2.length, w: Math.round(rr.width), h: Math.round(rr.height) }; })(),
               inkMin: Math.min.apply(null, qa('#linBox .lnhead').map(g => {
                 const t = g.querySelector('text'), rs = g.querySelectorAll('rect');
                 const bg = rs.length ? rs[rs.length - 1].getAttribute('fill') : null;
                 return bg ? rat('#FFFFFF', bg) : 99; })),
               tblRows: qa('#linTbl tbody tr').length };
    };
    /* 命中测试前必须滚进视口：血缘卡在页面中段，不滚的话 elementFromPoint
       拿到 null —— 那不是按钮坏了，是它不在屏幕上。 */
    const linBtn = () => { q('#linCard').scrollIntoView({ block: 'center' });
      const b = q('#linAxis'), r = b.getBoundingClientRect();
      const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { label: txt(q('#linAxisT')), aria: b.getAttribute('aria-label'),
               icoW: Math.round(b.querySelector('svg').getBoundingClientRect().width),
               hit: !!(e && e.closest('#linAxis')) }; };

    R.linAxis0 = { axis: window.__sampState().axis, btn: linBtn(), col: linGeom() };
    q('[data-lin-axis]').click(); await sleep(420);
    R.linRow = { axis: window.__sampState().axis, btn: linBtn(), g: linGeom() };
    /* 方向是 UI 偏好而不是样本属性：换样本、**跳页往返**都不该复位。
       v46 前这一条测的是「切 tab 不复位」—— 页面没有可切的 tab 之后改成跳页往返：
       断的东西没变（这个偏好既不属于某个样本、也不属于某个页面），路径更贴近真实。
       ⚠ 跳页会收掉抽屉，回来要重新滑出 —— 后面的量都在抽屉里。 */
    window.__sampPick('S004'); await sleep(300);
    R.linKeepS = { axis: window.__sampState().axis, nodes: linGeom().nodes, vb: linGeom().vb };
    window.__go('p01'); await sleep(300);
    window.__go('gene'); await sleep(300);
    window.__sampDrawer(true); await sleep(440);
    R.linKeepT = { axis: window.__sampState().axis, nodes: linGeom().nodes };
    window.__sampPick('S037'); await sleep(320);
    /* 切回横向泳道 */
    q('[data-lin-axis]').click(); await sleep(420);
    R.linBack = { axis: window.__sampState().axis, btn: linBtn(), g: linGeom() };

    /* 血缘节点画在 SVG 里，是 <g>（SVGElement）—— 没有 .click() 方法，
       得自己派发 MouseEvent。委托挂在 document 上，冒泡即可命中。 */
    const fire = el => el && el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    /* 血缘节点筛选：3 路 → 只留该节点贡献的 2 路 */
    fire(q('[data-linnode="S037-L"]')); await sleep(240);
    R.samp1 = {
      focus: window.__sampState().focus,
      rows: qa('#omBody tr').length,
      filter: txt(q('#omFilter')), filterW: boxAt('#omFilter'),
      onNodes: qa('#linBox .linnode.is-on').length,
      rowBlob: txt(q('#omBody'))
    };
    fire(q('[data-linnode="S037-L"]')); await sleep(220);
    R.samp2 = { focus: window.__sampState().focus, rows: qa('#omBody tr').length,
                filterW: boxAt('#omFilter') };

    /* 键盘可达：血缘节点是真按钮，Enter 就该和点击等价 */
    q('[data-linnode="S037-B"]').focus();
    q('[data-linnode="S037-B"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await sleep(240);
    R.sampKey = { focus: window.__sampState().focus, rows: qa('#omBody tr').length };
    fire(q('[data-lin-clear]')); await sleep(200);

    /* 查询：命中数 / 空态 */
    const sampSearch = async kw => {
      const el = q('#sampQ');
      el.value = kw;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(220);
      /* 命中数看列表：rows 是当前页行数（≤15，查无结果时是 1 行「暂无数据」占位），
         真实命中看 ids（可点样本 ID 数）与列表计数 meta */
      return { rows: qa('#sampTbody tr').length, ids: qa('#sampTbody .sampid').length,
               empty: boxAt('#sampEmpty'), meta: txt(q('#sampListMeta')) };
    };
    R.sampQ = { s068: await sampSearch('S068'), dx: await sampSearch('肝细胞癌'),
                subj: await sampSearch('SUBJ-0371'), none: await sampSearch('zzz') };
    q('#sampQ').value = ''; q('#sampQ').dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(200);

    /* 换样本：S004 是「蛋白组缺失被排除」那一例（原挂在样本对齐页上） */
    window.__sampPick('S004'); await sleep(160);
    q('[data-samp-pick="S004"]').click(); await sleep(300);
    R.sampS4 = {
      cur: window.__sampState().cur,
      nodes: qa('#linBox [data-linnode]').length,
      rows: qa('#omBody tr').length,
      missRows: qa('#omBody tr.is-miss').length,
      missBlob: txt(q('#omBody tr.is-miss')),
      kpiV: qa('#sampKpis .mcell__v').map(txt)
    };

    /* ---- 样本列表（v14）：75 例 · 筛选 / 排序 / 分页 / 点行 ---- */
    /* 起点必须显式设定：上一段把当前样本留在了 S004，而 sampPick 会顺手
       把列表定位到它所在页 —— 不设起点，下面「第 1 页」的判断就是碰运气。 */
    window.__sampPick('S001'); await sleep(220);
    /* 覆盖口径从数据现算，断它自己的不变式（见末尾断言） */
    R.sampCov = (function () {
      var g = 0, t = 0, p = 0, all = 0;
      window.__sampIds().forEach(function (id) {
        var a = window.__sampGet(id), has = {};
        a.om.forEach(function (x) { if (!x.miss) has[x.o] = 1; });
        if (has['基因组']) g++;
        if (has['转录组']) t++;
        if (has['蛋白组']) p++;
        if (has['基因组'] && has['转录组'] && has['蛋白组']) all++;
      });
      return { n: window.__sampIds().length, g: g, t: t, p: p, all: all };
    })();

    R.sampList = {
      cols: qa('#sampTbl thead th').length,
      rows: qa('#sampTbody tr.samptr').length,
      meta: txt(q('#sampListMeta')),
      pager: txt(q('#sampPager .pager__n')),
      first: txt(q('#sampTbody tr.samptr .sampid')),
      omtags: qa('#sampTbody tr.samptr:first-child .omtag').length,
      omOn: qa('#sampTbody tr.samptr:first-child .omtag.is-on').length
    };

    /* 翻到第 2 页 */
    q('#sampPager [data-samp-page="2"]').click(); await sleep(220);
    R.sampPage2 = { first: txt(q('#sampTbody tr.samptr .sampid')),
                    pager: txt(q('#sampPager .pager__n')),
                    cur: txt(q('#sampPager [aria-current="page"]')),
                    prevOn: !q('#sampPager [data-samp-page="prev"]').disabled };

    /* 筛选：质控不合格 → 4 例，而且这 4 例正是缺蛋白组的那 4 例 */
    const fq = q('#fltQc'); fq.value = 'danger'; fq.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(240);
    R.sampFlt = { rows: qa('#sampTbody tr.samptr').length, meta: txt(q('#sampListMeta')),
                  ids: qa('#sampTbody .sampid').map(txt),
                  omOn: qa('#sampTbody tr.samptr:first-child .omtag.is-on').length };

    /* 组学覆盖筛「缺 1 路」→ 同样 4 例（两条筛选路径必须落在同一批样本上） */
    const fo = q('#fltOm'); fo.value = '2'; fo.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(240);
    R.sampFltOm = { rows: qa('#sampTbody tr.samptr').length, meta: txt(q('#sampListMeta')) };

    q('[data-samp-fltreset]').click(); await sleep(240);
    R.sampFltReset = { rows: qa('#sampTbody tr.samptr').length,
                       meta: txt(q('#sampListMeta')),
                       qc: q('#fltQc').value, om: q('#fltOm').value };

    /* 排序：点「采集日期」列头两次，验单调 + 表头高亮 */
    q('#sampTbl [data-samp-sort="t"]').click(); await sleep(200);
    const dAsc = qa('#sampTbody tr.samptr').map(r => r.children[3].textContent.trim());
    q('#sampTbl [data-samp-sort="t"]').click(); await sleep(200);
    const dDesc = qa('#sampTbody tr.samptr').map(r => r.children[3].textContent.trim());
    R.sampSort = { asc: dAsc, desc: dDesc,
                   ascOk: dAsc.every((v, i) => i === 0 || dAsc[i-1] <= v),
                   descOk: dDesc.every((v, i) => i === 0 || dDesc[i-1] >= v),
                   sortedN: qa('#sampTbl th.is-sorted').length };

    /* 点列表行 → 下方详情跟着切，且当前行要标出来 */
    const pickId = q('#sampTbody tr.samptr:nth-child(3) .sampid').textContent;
    q('#sampTbody tr.samptr:nth-child(3)').click(); await sleep(300);
    R.sampRowPick = { target: pickId, cur: window.__sampState().cur,
                      onRows: qa('#sampTbody tr.is-on').length,
                      onId: txt(q('#sampTbody tr.is-on .sampid')),
                      kpiFirst: txt(q('#sampKpis .mcell__v')) };

    /* 定位：S037 排在第 37 位、在第 3 页，归零之后仍要把它带到眼前 ——
       否则列表上没有任何标记，看着像"没选中任何样本" */
    window.__sampPick('S037'); await sleep(220);
    window.__sampReset();      await sleep(240);
    R.sampLocate = { page: txt(q('#sampPager [aria-current="page"]')),
                     onRows: qa('#sampTbody tr.is-on').length,
                     onId: txt(q('#sampTbody tr.is-on .sampid')) };

    /* 回位：这一段改过筛选 / 排序 / 分页 / 选中样本，后面的探针还在看这一页 */
    q('[data-samp-fltreset]').click(); await sleep(200);
    window.__sampPick('S037'); await sleep(220);

    /* 跨组学 → 项目概况页的数据集页签（「查看数据」要看的就是这个项目的数据集）。
       v40 起数据集有了自己的页签，所以落点也跟着从「信息屏的关联数据集」
       搬到「数据集」页签的明细块 —— 断言两样：页签对、那一块在视口里。 */
    window.__sampPick('S037'); await sleep(220);
    q('[data-samp-pick="S037"]').click(); await sleep(280);
    q('[data-om-open="P-2026-001"]').click(); await sleep(560);
    const pdSec = q('#projBody [data-pdsec="ds-detail"]');
    R.sampJump = {
      open: q('#page-projdetail').classList.contains('is-on'),
      tab: window.__projDetail().tab,
      tag: txt(q('#projTag')),
      name: txt(q('#projName')),
      /* 返回口是面包屑的「项目管理」段（页面上没有关闭键） */
      back: txt(q('#crumbParent')) == '项目管理',
      flash: !!(pdSec && pdSec.classList.contains('is-flash')),
      /* 页面正文的滚动容器是 #content（不是抽屉的 body）——
         落点提示必须真的把这一块滚到视口里，否则等于把人扔在一屏顶上 */
      scroll: Math.round(q('#content').scrollTop),
      secTop: pdSec ? Math.round(pdSec.getBoundingClientRect().top) : -1
    };
    /* 回样本档案页继续后面的样本段（跳页会收掉样本抽屉，这里显式回到起点） */
    window.__go('gene'); await sleep(320);

    /* 探针收尾：回到插入点那一页（本段在样本档案与项目页之间来回切过），
       并把详情抽屉滑出来 —— 下面「样本信息与资料」看的都是抽屉里那几块。
       v46：原来这里还有一组「tab 切换几何互换」探针（sampTabG / sampTabBack）——
       页面没有可切的 tab 之后整组删掉。 */
    window.__sampDrawer(true); await sleep(440);

    /* ═════ 样本信息与资料（「存放样本信息和资料」这一轮） ═════
       信息卡的字段是**现算**的：顶层字段 + lin 派生（分装/衍生/原始登记 ID）
       + om 派生（所属项目）+ meta。所以断言不能只数「有 6 组」——
       必须逐字段核对值本身，否则字段表整体漂了、个数照样是对的。 */
    const siRow = k => {
      const e = qa('#sampInfo .srow').filter(x => txt(x.querySelector('.srow__l')) === k)[0];
      const v = e ? e.querySelector('.srow__v') : null;
      return { v: v ? txt(v) : '', cls: v ? String(v.className) : '' };
    };

    R.sampInfo = {
      groups: qa('#sampInfo .sgrp').length,
      titles: qa('#sampInfo .sgrp__h').map(b => txt(b)),
      rows: window.__sampState().infoRows.length,
      meta: txt(q('#sampInfoMeta')),
      hitEdit: hitOK2('[data-samp-edit]'),
      fields: window.__sampState().infoRows,
      /* 派生字段必须与数据源同源：S037 = 2 份分装 + 3 份衍生、1 个项目、无别名 */
      splitDeriv: siRow('分装 / 衍生'),
      projects: siRow('所属项目'),
      alias: siRow('原始登记 ID'),
      verdict: siRow('质控结论')
    };

    /* 信息、资料、组学缺失三处必须讲同一件事 —— 这是本轮最该守住的一致性：
       S004 血浆溶血 → 质控「血浆不合格」→ 蛋白组缺失；
       S052 RNA 降解 + 血清不足 → 转录组与蛋白组双缺；
       S068 原始登记 ID 有别名 → 血缘图上多一个 alias 节点与一条 ID 映射边。 */
    window.__sampPick('S004'); await sleep(160);
    q('[data-samp-pick="S004"]').click(); await sleep(300);
    R.sampQc4 = { verdict: siRow('质控结论'), plasma: siRow('血浆 / 血清状态'),
                  missRows: qa('#omBody tr.is-miss').length, omBlob: txt(q('#omBody')) };
    window.__sampPick('S052'); await sleep(160);
    q('[data-samp-pick="S052"]').click(); await sleep(300);
    R.sampQc52 = { verdict: siRow('质控结论'), plasma: siRow('血浆 / 血清状态'),
                   rin: siRow('RNA 完整性'),
                   rows: qa('#omBody tr').length, missRows: qa('#omBody tr.is-miss').length };
    window.__sampPick('S068'); await sleep(160);
    q('[data-samp-pick="S068"]').click(); await sleep(300);
    R.sampAlias = { alias: siRow('原始登记 ID'), nodes: qa('#linBox [data-linnode]').length,
                    edges: qa('#linBox path[marker-end]').length,
                    /* 血缘列数由数据现算：S068 比 S037 多一层「原始登记 ID」，
                       写死 4 列的布局在这里会立刻露馅。 */
                    heads: qa('#linBox svg text').filter(t => parseFloat(t.getAttribute('y') || '0') < 34).map(txt) };

    /* ---- 登记新样本：三种非法输入都要被拦，正常输入要真落库 ---- */
    q('[data-samp-new]').click(); await sleep(300);
    R.sampNewOpen = {
      open: !q('#modal').hidden, title: txt(q('#modalT')),
      hitId: hitOK2('#nsId'), hitSubj: hitOK2('#nsSubj'),
      hitCohort: hitOK2('#nsCohort'), hitStore: hitOK2('#nsStore'),
      dx: qa('#nsDx option').length, mats: qa('#nsMat option').length,
      cohort: q('#nsCohort').value
    };
    q('[data-samp-new-submit]').click(); await sleep(300);
    R.sampNewEmpty = { open: !q('#modal').hidden, n: window.__sampState().n, toast: lastToast() };
    q('#nsId').value = 'S 070/x'; q('#nsId').dispatchEvent(new Event('input', { bubbles: true }));
    q('[data-samp-new-submit]').click(); await sleep(280);
    R.sampNewBad = { open: !q('#modal').hidden, n: window.__sampState().n, toast: lastToast() };
    q('#nsId').value = 'S037'; q('#nsId').dispatchEvent(new Event('input', { bubbles: true }));
    q('[data-samp-new-submit]').click(); await sleep(280);
    R.sampNewDup = { open: !q('#modal').hidden, n: window.__sampState().n, toast: lastToast() };

    /* S001–S075 全部已建档，补登必须用一个队列外的 ID ——
       用 S069 会撞上生成器造出来的那一例（这正是本次暴露的问题）。 */
    q('#nsId').value = 'S076';
    q('#nsSubj').value = 'SUBJ-0432';
    q('#nsNo').value = '第 76 例';
    q('#nsT').value = '2026-03-25';
    q('[data-samp-new-submit]').click(); await sleep(480);
    R.sampNewDone = {
      modal: q('#modal').hidden,
      n: window.__sampState().n, cur: window.__sampState().cur,
      chipsGone: !q('#sampChips'),
      rowOnId: txt(q('#sampTbody tr.is-on .sampid')),
      nodes: qa('#linBox [data-linnode]').length,
      edges: qa('#linBox path[marker-end]').length,
      omRows: qa('#omBody tr').length, omMeta: txt(q('#omMeta')), omBlob: txt(q('#omBody')),
      kpiV: qa('#sampKpis .mcell__v').map(txt), kpiF: qa('#sampKpis .mcell__f').map(txt),
      infoGroups: window.__sampState().infoGroups,
      infoFields: window.__sampState().infoFields,
      infoBlob: txt(q('#sampInfo')),
      docsRows: qa('#docBody tr').length, docsMeta: txt(q('#docMeta')),
      toast: lastToast()
    };

    /* 新增元素的文字对比度：状态值是 soft 底压深字，不能拿色号直接铺白底 */
    R.siInk = (function () {
      function toRgb(c) { var m = String(c).match(/[0-9.]+/g); return m ? m.slice(0, 3).map(Number) : [255, 255, 255]; }
      function lum(v) { var c = v.map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
      function ratio(a, b) { var L1 = lum(toRgb(a)), L2 = lum(toRgb(b)); var hi = Math.max(L1, L2), lo = Math.min(L1, L2); return Math.round((hi + 0.05) / (lo + 0.05) * 100) / 100; }
      return qa('#sampInfo .srow__v').map(function (el) {
        var st = getComputedStyle(el);
        return { cls: String(el.className), ratio: ratio(st.backgroundColor, st.color) };
      }).filter(function (x) { return /is-/.test(x.cls); }).slice(0, 8);
    })();
    R.siInkMin = R.siInk.reduce(function (m, x) { return Math.min(m, x.ratio); }, 99);

    /* ---- 收尾回位：后面几张样本档案截图拍的是 S037 ----
       本段把当前样本切到过 S076，不还原的话 32/33 两张图拍的就是刚登记的空样本。 */
    window.__sampPick('S037'); await sleep(160);
    q('[data-samp-pick="S037"]').click(); await sleep(340);
    R.sampRestore = { cur: window.__sampState().cur,
                      docs: qa('#docBody tr').length };

    /* ---- 血缘谱系折叠开关 ----
       折叠最容易只测到「类名变了」。这里一律量**几何**：
       display:none 的元素 client rect 是 0，而"看着没了"的任何东西都不是 0。
       另外三件容易漏的：状态四处同步（aria / 文案 / title / 图标朝向）、
       收起后不再提「点节点」（节点已藏起来）、切样本与切 tab 不替用户弹开。 */
    const linSnap = () => ({
      cardH: Math.round(q('#linCard').getBoundingClientRect().height),
      bodyH: Math.round(q('#linBody').getBoundingClientRect().height),
      boxH: Math.round(q('#linBox').getBoundingClientRect().height),
      hidden: q('#linBody').hidden,
      aria: q('#linFold').getAttribute('aria-expanded'),
      label: txt(q('#linFoldT')), title: q('#linFold').title,
      meta: txt(q('#linMeta')),
      tf: getComputedStyle(q('#linFold .ico')).transform,
      btnW: Math.round(q('#linFold').getBoundingClientRect().width),
      hit: hitOK2('#linFold'),
      /* 图的高度是「列数 / 每列最多几个节点」现算出来的，不是常量：
         3 列 3 行 284、3 列 1 行 132。把它和 viewBox 高度绑在一起，
         既钉住「没被容器拉伸」，也不会因为行数变化而失效。 */
      svgH: (function () { const s = q('#linBox svg'); if (!s) return 0;
        return Number(s.getAttribute('viewBox').split(' ')[3]); })()
    });
    R.linFold0 = linSnap();
    q('[data-lin-fold]').click(); await sleep(360);
    R.linFold1 = linSnap();
    /* 收起态切样本：数字要跟着刷新，但开关不该被弹开 */
    window.__sampPick('S004'); await sleep(160);
    q('[data-samp-pick="S004"]').click(); await sleep(300);
    R.linFoldKeep = linSnap();
    R.linFoldCur = window.__sampState().cur;
    /* 收起态**跳页往返**（v46 前是「切到基因 tab 再切回」—— 页面没有 tab 了）。
       跳页会收起抽屉，回来要重新滑出，否则下面量的是「还没滑出来的图」。
       原 R.linFoldGene（「基因 tab 里 linBody 的高度」）随之删：那个面板不存在了。 */
    window.__go('p01'); await sleep(280);
    window.__go('gene'); await sleep(280);
    window.__sampDrawer(true); await sleep(440);
    R.linFoldKeepTab = linSnap();
    /* 还原：展开 + 切回 S037，量化「同一样本同一状态必须逐像素复位」 */
    q('[data-lin-fold]').click(); await sleep(360);
    window.__sampPick('S037'); await sleep(160);
    q('[data-samp-pick="S037"]').click(); await sleep(320);
    R.linFoldBack = linSnap();
    R.linFoldExpanded = window.__sampState().linOpen;


    /* v46：删掉了「基因档案重建」整段探针（R.grb0 … R.grb10 + R.grbEndPage，约 90 行）——
       它驱动的「重建档案」抽屉长在「基因档案」那个 tab 里，tab 与抽屉都撤了，
       这段脚本没有任何东西可驱动，留着就是必炸的死代码。
       被测的能力随之退场：重建范围、依据勾选与证据计数、进度条、完成回执、
       关闭后重开是否重置 —— 这几条边界不再存在。 */

    /* ---- 面包屑与「工作台」这个顶级叶子项 ---- */
    goPage('p01').click(); await sleep(240);
    R.crumbTop = {
      /* 「工作台」是根：既没有祖先段，也不该留空壳占位。
         所以直接断言那两段**不存在** —— 比断言 display:none 更彻底，
         一个被隐藏但仍在 DOM 里占位的空 span 会在这里露馅 */
      grpGone: !q('#crumbGrp'),
      homeGone: !q('#crumbHome'),
      seps: qa('.crumb__sep').length,            /* 期望 0 */
      page: txt(q('#crumb')),
      step: txt(q('#crumbStep')),
      stepHidden: q('#crumbStep').hidden
    };
    goPage('gene').click(); await sleep(240);
    R.crumbMid = {
      home: txt(q('#crumbHome')),                /* 期望「工作台」 */
      homeTag: q('#crumbHome') ? q('#crumbHome').tagName : '(null)',
      /* 「数据资产」分组只有样本档案这一页 → 分组段点下去就是回当前页，
         是死段，不该生成。断言元素**不存在**，比断言 display:none 更彻底。 */
      grpGone: !q('#crumbGrp'),
      page: txt(q('#crumb')),
      pageTag: q('#crumb').tagName,              /* 期望 SPAN：当前页不是入口 */
      seps: qa('.crumb__sep').length,            /* 期望 1：只剩「工作台」后那一个 */
      stepHidden: q('#crumbStep').hidden         /* 期望 true：不是主流程步骤 */
    };
    /* 分组段只该出现在「不是该组首项」的页面上：首项页点它就是回自己。
       逐页取「该组首项页」，确认那一段不存在。 */
    R.crumbFirst = {};
    for (const p of ['p02', 'proj', 'kbmed']) {
      /* v50 需求 4：p02 已不在菜单里，goPage() 会返回 null —— 先判空再走直达，
         别直接 .click()（null.click() 会抛错并打断整段驱动脚本）。 */
      const _b = goPage(p); if (_b) _b.click(); else window.__goRaw(p);
      await sleep(200);
      R.crumbFirst[p] = { segs: qa('#crumbBar .crumb__l').map(b => txt(b)),
                          grpGone: !q('#crumbGrp') };
    }

    /* ---- 导航：面包屑是**唯一**的返回入口 ----
       返回条已撤（v17）—— 回上级走面包屑的祖先段、跨菜单走左栏，
       同一件事不再有两个入口。起点先归零：goHome() 清空来路并回工作台，
       这样下面每条用例都在确定的 {cur:'p01', hist:[]} 上开始。 */
    const segIds = () => (window.__crumbSegs() || []).map(s => s.id);
    window.__goHome(); await sleep(240);

    R.navHome = {
      bars: qa('.pageback').length,          /* 期望 0：全站已无返回条 */
      backAttrs: qa('[data-back]').length,   /* 期望 0：连属性都不该剩下 */
      cur: window.__navState().cur,          /* 期望 p01 */
      segs: segIds(),                        /* 期望 []：起点自己是根，没有祖先段 */
      crumb: txt(q('#crumb')),
      step: txt(q('#crumbStep'))             /* 期望 总览 */
    };

    /* 顺菜单进 p04：面包屑给出「工作台 › 数据汇集」，工作台段可点 */
    goPage('p04').click(); await sleep(260);
    R.navDeep = {
      cur: window.__navState().cur,          /* 期望 p04 */
      segs: segIds(),                        /* 期望 ['p01','p02'] */
      crumbs: qa('#crumbBar .crumb__l').map(b => txt(b)),
      curCrumb: txt(q('#crumb')),
      step: txt(q('#crumbStep'))
    };

    /* 「工作台」段：回主页；到了根上这一段就不该再生成 */
    R.crumbHomeTap = { txt: txt(q('#crumbHome')) };
    q('#crumbHome').click(); await sleep(300);
    R.crumbHomeTap.after = qa('.page.is-on')[0].id;     /* 期望 page-p01 */
    R.crumbHomeTap.segsAfter = segIds();                /* 期望 [] */

    /* 横向来路（示例数据集 → 项目）没有返回按钮，仍然回得去：面包屑的「工作台」段 */
    window.__goHome(); await sleep(200);
    goPage('pubds').click(); await sleep(240);
    goPage('proj').click(); await sleep(260);
    R.navLateral = {
      cur: window.__navState().cur,          /* 期望 proj */
      segs: segIds(),                        /* 期望 ['p01']：proj 是分组首项，无分组段 */
      bars: qa('.pageback').length,          /* 期望 0 */
      crumbs: qa('#crumbBar .crumb__l').map(b => txt(b))
    };
    q('#crumbHome').click(); await sleep(280);
    R.navLateral.after = qa('.page.is-on')[0].id;        /* 期望 page-p01 */

    /* 面包屑：组名段 → 该组第一项 */
    goPage('kbgraph').click(); await sleep(250);
    R.crumbTap = { group: txt(q('#crumbGrp')), page: txt(q('#crumb')) };
    q('#crumbGrp').click(); await sleep(270);
    R.crumbTap.after = qa('.page.is-on')[0].id;  /* 期望 page-kbmed */
    goPage('p01').click(); await sleep(220);
    /* v58 订正：v57 曾把这一行拆成「外链文字区 + 折叠箭头」，那时 data-navgrp /
       aria-* 搬到了箭头上，选择器必须指向箭头。v58 把跳外链方案整段撤销后，
       分组标题回到「整行 <button> 就是折叠开关」，data-navgrp 又回到按钮自己身上。
       → 这个选择器**跟着结构变**：改左栏结构时，grep 出的每一处都要重新确认
         指向的是不是「承载折叠能力的那个元素」，否则 q() 返 null、
         getAttribute 抛错、整段驱动被打断（同一族坑已栽八次）。 */
    const grpSel = '.snav__grp[data-navgrp]';
    /* 只认「知识赋能这一行」的折叠按钮，别把别的组也一起点。
       v58：组标题回到「整行 <button> 就是折叠开关」的形态，所以 data-navgrp
       在它**自己**身上 —— 用 querySelector('[data-navgrp]') 去找会返回 null
       （它找的是子元素，而子元素里没有）。要么匹配自己，要么匹配后代，
       这里直接选自己，最直白。 */
    const kbFoldBtn = () => qa('.snav__grp[data-navgrp]')
      .filter(b => txt(b).indexOf('知识赋能') === 0)[0] || null;
    const grp = kbFoldBtn() || q(grpSel);
    /* lid 必须取自 aria-controls。不能拿「.snav__grp 里的序号」去拼 navlist-gN ——
       navlist 的序号是 NAVGROUPS 的下标（含没有标题的「工作台」；v50 起
       智能分析整组不上菜单，于是下标与可见分组的下标差得更多：NAVGROUPS 里
       知识赋能是第 5 个（下标 4），而可见的 .snav__grp 里它是第 3 个（下标 2）。
       两者差多少会随「哪些组不上菜单」变化 —— 所以序号这条路彻底不能走，
       只认 aria-controls。 */
    const lidId = grp.getAttribute('aria-controls');
    const lid = '#' + lidId;
    R.navFoldInit = {
      expanded: grp.getAttribute('aria-expanded'),
      hiddenLists: qa('.snav__list[hidden]').length,
      itemsVisible: qa(lid + ' .snav__i').filter(vis).length,   /* 期望 3 */
      chev: !!grp.querySelector('.snav__chev'),
      controls: !!lidId && !!q(lid)
    };
    /* 每次 click 都会 renderNav() 重画整条左栏，旧节点失效 —— 必须重新取。
       拿到手就点，别把节点存进变量跨一步（v57 拆结构时踩到过）。 */
    kbFoldBtn().click(); await sleep(280);
    R.navFold = {
      expanded: kbFoldBtn().getAttribute('aria-expanded'),
      hiddenLists: qa('.snav__list[hidden]').length,            /* 期望 1 */
      itemsVisible: qa(lid + ' .snav__i').filter(vis).length,   /* 期望 0 */
      listH: Math.round(q(lid).getBoundingClientRect().height)  /* 期望 0：几何也要塌掉 */
    };
    kbFoldBtn().click(); await sleep(260);
    R.navFoldBack = {
      expanded: kbFoldBtn().getAttribute('aria-expanded'),
      hiddenLists: qa('.snav__list[hidden]').length,            /* 期望 0 */
      itemsVisible: qa(lid + ' .snav__i').filter(vis).length    /* 期望 3 */
    };
    /* 收起该组后直接导航到组内页面：应自动展开，否则高亮项藏在 hidden 里 */
    kbFoldBtn().click(); await sleep(240);
    goPage('kbgraph').click(); await sleep(300);
    R.navAutoOpen = {
      expanded: kbFoldBtn().getAttribute('aria-expanded'),
      hiddenLists: qa('.snav__list[hidden]').length,            /* 期望 0 */
      cur: !!q('.snav__i[data-go="kbgraph"][aria-current="page"]')
    };

    /* ==================== 内置公开数据集 + 参考基因组 ==================== */
    q('[data-go="p01"]').click(); await sleep(240);
    /* 未选数据集时摘要不能自称「已就绪」 */
    R.refInitial = { title: txt(q('#refSum .refsum__t')), tag: txt(q('#refSum .refsum__tag')),
                     sumF: txt(q('#refSum .refsum__f')).slice(0, 34) };
    R.dsGroup = {
      segs: qa('#dsSeg .seg__b').length,
      on: txt(q('#dsSeg .seg__b.is-on')),
      ownCards: qa('#dsGroup-own .dcard').length,
      humanCards: qa('#dsGroup-human .dcard').length,
      mouseCards: qa('#dsGroup-mouse .dcard').length,
      humanHidden: q('#dsGroup-human').hidden,
      mouseHidden: q('#dsGroup-mouse').hidden
    };
    qa('#dsSeg .seg__b')[1].click(); await sleep(200);
    R.dsSwitchHuman = { humanHidden: q('#dsGroup-human').hidden, ownHidden: q('#dsGroup-own').hidden,
                        on: txt(q('#dsSeg .seg__b.is-on')), cards: qa('#dsGroup-human .dcard').length };
    qa('#dsSeg .seg__b')[2].click(); await sleep(200);
    R.dsSwitchMouse = { mouseHidden: q('#dsGroup-mouse').hidden, humanHidden: q('#dsGroup-human').hidden,
                        on: txt(q('#dsSeg .seg__b.is-on')) };

    /* 首页点选小鼠数据集 → 应自动进入数据接入页并把参考基因组切到 mm10 */
    q('#dsGroup-mouse .dcard').click(); await sleep(380);
    R.pubFromHome = {
      page: qa('.page.is-on')[0].id,
      cards: qa('#fileList .fcard').length,
      name: txt(q('#fileList .fcard__n')),
      meta: txt(q('#fileList .fcard__m')).slice(0, 70),
      refOn: txt(q('#refGrid .refcard.is-on .refcard__a')),
      sumBad: q('#refSum').classList.contains('is-bad'),
      warnHidden: q('#refWarn').hidden
    };

    R.refCards = {
      n: qa('#refGrid .refcard').length,
      names: qa('#refGrid .refcard__n').map(x => txt(x)),
      aliases: qa('#refGrid .refcard__a').map(x => txt(x)),
      idxOnCard: qa('#refGrid .refcard.is-on .refcard__ix').length,
      allTag: txt(q('#refAllTag')),
      pubCount: txt(q('#pubCount')),
      pubP02: qa('#pubGrid-human .dcard').length + qa('#pubGrid-mouse .dcard').length
    };

    /* 手动改选人类基因组 → 触发物种不匹配守卫 */
    q('[data-refg="hg38"]').click(); await sleep(260);
    R.refMismatch = {
      warnVisible: !q('#refWarn').hidden,
      sumBad: q('#refSum').classList.contains('is-bad'),
      body: txt(q('#refWarnBody')).slice(0, 64),
      fixLabel: txt(q('#refWarnFix')),
      fixTarget: q('#refWarnFix').getAttribute('data-refg'),
      sumF: txt(q('#refSum .refsum__f')).slice(0, 40)
    };
    q('#refWarnFix').click(); await sleep(260);
    R.refFixed = { on: txt(q('#refGrid .refcard.is-on .refcard__a')),
                   warnHidden: q('#refWarn').hidden, sumBad: q('#refSum').classList.contains('is-bad') };
    q('[data-refg="hg38"]').click(); await sleep(220);
    q('[data-refkeep]').click(); await sleep(200);
    R.refKeep = { warnHidden: q('#refWarn').hidden };

    /* 载入人类数据集 → 警告应消失、配置摘要回到「可提交」 */
    q('#pubGrid-human [data-pubds="tcga-lihc"]').click(); await sleep(280);
    R.pubHuman = {
      name: txt(q('#fileList .fcard__n')),
      meta: txt(q('#fileList .fcard__m')).slice(0, 70),
      refOn: txt(q('#refGrid .refcard.is-on .refcard__a')),
      warnHidden: q('#refWarn').hidden,
      sumBad: q('#refSum').classList.contains('is-bad')
    };

    /* 新增元素的文字对比度（物种标签） */
    R.spInk = (function () {
      function toRgb(c) { var m = String(c).match(/\d+/g); return m ? m.slice(0, 3).map(Number) : [255, 255, 255]; }
      function lum(v) { var c = v.map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
      function ratio(a, b) { var L1 = lum(toRgb(a)), L2 = lum(toRgb(b)); var hi = Math.max(L1, L2), lo = Math.min(L1, L2); return Math.round((hi + 0.05) / (lo + 0.05) * 100) / 100; }
      return qa('.sp').slice(0, 4).map(function (el) {
        var st = getComputedStyle(el);
        return { t: txt(el), bg: st.backgroundColor, ratio: ratio(st.backgroundColor, st.color) };
      });
    })();

    /* ---- P0 回归：抽屉 / 弹窗 / 表格替代视图 ----
       v42：p07 整页撤了（结果全景并进项目详情层），原来借它测抽屉 —— 现在借
       「分析结果 › 结果全景」那个模块，那一页上同样挂着一颗 [data-drawer="trace"]。
       mod 下标给个大的，由 setProjMod 夹到末项，不写死模块个数。 */
    window.__projDetail('P-2026-001', 'result', null, 999); await sleep(320);
    q('[data-drawer="trace"]').click(); await sleep(220);
    R.drawerOpen = !q('#drawerTrace').hidden;
    R.drawerRows = qa('#drawerTrace .tbl tbody tr').length;
    q('[data-close="trace"]').click(); await sleep(200);
    R.drawerClosed = q('#drawerTrace').hidden;
    /* ⚠ 测完必须离开项目层：原来借 p07 时，那一步本身就是一次 goto，
       顺带跳到项目层外面、左栏换回全局菜单；现在借的是项目详情里的模块页，
       页面留在项目层 —— 左栏此刻是**这个项目自己的菜单**（.snav__i[data-pds]），
       没有 .snav__grp。后面的 R.ia 全靠全局左栏，不退出去就量不到东西。 */
    window.__goHome(); await sleep(260);

    /* v37：原先这里点的是挂在 p03 上的 [data-modal="qc"]（体检缺失率明细）。
       p03 整页删除后，改用「另存为新模板」弹窗继续守着同一条链路：
       鼠标点开 → #modal 显示 → 标题正确 → 关闭后确实收起。 */
    q('[data-orch-save]').click(); await sleep(260);
    R.modalOpen = !q('#modal').hidden;
    R.modalTitle = txt(q('#modalT'));
    R.modalRows = qa('#modalB .tempnodes > span').length;
    q('[data-close="modal"]').click(); await sleep(180);
    R.modalClosed = q('#modal').hidden;



    /* 外壳 = 顶栏（品牌 + 面包屑 + 全局控制）+ 左栏分组导航 + 内容区两栏。
       顶级导航不再平铺：7 个里 5 个是 CRUD 管理页，会把「这是一条分析流水线」挤没。 */
    R.ia = {
      navItems:    qa('.snav__i').length,                        /* v50 期望 10（v47 是 14，智能分析那 4 项整组撤离菜单） */
      /* v57：「知识赋能」组标题被拆成「外链文字区 + 折叠箭头」两块，
         那一行的容器**仍带 .snav__grp 类**（它确实还是分组标题行，
         样式与语义都对），但它已经是 <div> 而不是 <button>。
         所以这里按「能选到就是分组标题行」计数，不看标签名 ——
         否则「分组标题从 button 变 div」这种纯结构变化会被误判成少了一组。 */
      navGroups:   qa('.snav__grp').map(h => txt(h)),            /* 期望 4 组 */
      navTop:      qa('.snav__i--top').length,                   /* 期望 1：工作台 */
      navCur:      qa('.snav__i[aria-current="page"]').length,   /* 期望 1（这一段停在 p01） */
      navCurTxt:   txt(q('.snav__i[aria-current="page"]')),
      /* v50 需求 1：二级条目右侧的数字徽标整块撤掉。
         读数留在原位、期望值从「数字是多少」改成「一个都没有」——
         撤一个功能时顺手把探针删掉，就再没人守得住它没被悄悄加回来。 */
      navBadges:   qa('.snav__i .snav__n').map(n => txt(n)),     /* 期望 [] */
      navLists:    qa('.snav__list').length,                     /* 期望 4：每个分组一个子项容器 */
      /* v50 需求 4：「智能分析」整组不上菜单，但**页面与路由照旧**。
         四条拆开断「撤的是那一格、不是一个页面」：页面在、落点按钮还在、
         菜单里没有它、这一组也不再有子项容器。
         ⚠ 这一段停在 p01（__goHome 之后），所以「当前项」照旧只有工作台一枚 ——
         智能分析那几页此刻根本没被导航过。 */
      navSmartGroup: qa('.snav__grp').filter(b => txt(b) === '智能分析').length,   /* 期望 0 */
      navSmartItem:  qa('.snav__i[data-go="p02"]').length,                          /* 期望 0 */
      /* v51：p07 以「查看分析结果」的名字回来了（智能分析第 5 步），但它仍不在左栏 ——
         整组 off，所以这一格照旧数到 0。这条与 v50 时守的是同一件事（左栏里没有 p07），
         只是原因换了：那时是「整页撤了」，现在是「页面在、但这一组不上菜单」。
         仍不拿「菜单项总数 == 10」当代理：总数会被别的需求改动，
         而这条要守的只是 p07 这一格。 */
      navP07:        qa('.snav__i[data-go="p07"]').length,                          /* 期望 0 */
      smartPages:    ['p02', 'p04', 'p05', 'p06', 'p07'].filter(p => !!q('#page-' + p)).length,  /* 期望 5 */
      smartGoBtns:   qa('[data-go="p02"]').length,                                  /* 期望 >0 */
      /* 每个页面要么在菜单里，要么在「菜单外」这批里 —— 没有第三种。
         这条不变式比写死一个数耐用：上一版是「页数 = 菜单项数 + 2」，
         本轮需求 4 把 4 个页面挪出菜单，那个 +2 就整条废了。 */
      offMenu:     qa('.page').map(p => p.id.replace('page-', ''))
                     .filter(id => !q('.snav__i[data-go="' + id + '"]')),
      /* 图标只在**一级**（分组标题）与**顶级叶子项**上；二级条目是纯文字缩进。
         两侧都要断：一级掉图标是「层级塌了」，二级冒出图标是「层级又糊了」 */
      navIcoTop:   qa('.snav__grp, .snav__i--top').filter(b => !b.querySelector('svg.ico')).length,  /* 期望 0 */
      navIcoSub:   qa('.snav__i:not(.snav__i--top) svg.ico').length,   /* 期望 0 */
      /* 层级几何：二级文字必须比一级文字更靠右。这比「一级有图标」更本质 ——
         图标可以两边都挂，而缩进差一旦归零，两层立刻看起来是平的。
         取上下界而不是精确值：缩进微调不该弄红断言，但「拉平」必须红 */
      navIndent:   (function () {
        const g = qa('.snav__grp').filter(b => txt(b) === '数据资产')[0];
        const s = q('.snav__i[data-go="gene"]');
        if (!g || !s) return { grp: -1, sub: -1 };
        return {
          grp: Math.round(g.querySelector('.snav__gt').getBoundingClientRect().left),
          sub: Math.round(s.querySelector('.snav__t').getBoundingClientRect().left)
        };
      })(),
      /* v50 需求 4：原先这里有一条「智能分析二级不再带步骤号」的探针
         （靠 aria-controls 反查该组的子容器再数 .snav__n）。该组整体不上菜单后，
         这条探针**在 DOM 里已经量不到东西了** —— 留着只会永远返回 -1，
         变成一条常红且无法修的断言。它守的那件事已经被 navBadges 接过：
         「二级条目一律不带数字徽标」现在是对**整条左栏**断的，比只盯一个组更严。
         撤功能的正确姿势是「换个位置继续守」，不是把哨兵留在已经量不到的地方。 */
      shellCols:   getComputedStyle(q('.shell')).gridTemplateColumns.split(' ').length,  /* 期望 2 */
      tabstrip:    qa('.tabstrip, .wtab').length,                /* 期望 0 */
      /* 派发管理已下线：页面、左栏入口、资源表、日志类型都不该再出现 ——
         守卫比一次性删除更重要，防止它被静默加回来。 */
      dispatchPage: !!q('#page-dispatch'),
      dispatchNav:  qa('.snav__i[data-go="dispatch"]').length,
      dispatchTbl:  !!q('#dispBody'),
      logTypes:     qa('#logType option').map(o => txt(o)),
      crumbGrp:    txt(q('#crumbGrp')),
      crumb:       txt(q('#crumb')),
      crumbStep:   txt(q('#crumbStep')),
      histDrawerHidden: q('#histDrawer').hidden,                 /* 初始收起，不再常驻占宽 */
      histItems:   qa('#histBody .hitem').length,                /* 期望 10 */
      histFoot:    txt(q('#histFoot')),
      histProj:    txt(q('#histProj')),
      /* v53：右下角浮球 + 浮窗整体撤除（浮球是浮窗唯一入口）。读数改成「不在」，
         与派发管理同一条守卫思路 —— 防止它被静默加回来。 */
      agentFabGone: !q('#agentFab') && !q('#agentWin')
    };
    /* v37 需求 3：样本对齐页整页下线 —— 四处都要断。
       只删页面不删左栏入口 = 留一个点进去的空白死链；只删入口不删步骤条 =
       步骤条还写着 6 步而页面只剩 5 个，数字自己对不上自己。 */
    R.v37align = {
      page:      !!q('#page-p03'),
      nav:       qa('.snav__i[data-go="p03"]').length,
      goBtns:    qa('[data-go="p03"]').length,
      stepNames: qa('[data-stepper="1"] .stepper__i').map(txt),
      pages:     qa('.page').length,
      navItems:  qa('.snav__i').length
    };
    /* 顶栏不再溢出：1440 宽下演示标签要完整可见，左栏不该出现横向滚动 */
    R.navOverflow = {
      overflowX:      q('.snav__scroll').scrollWidth - q('.snav__scroll').clientWidth,
      demoTagVisible: vis(q('.tag--demo')),
      topnavH:        Math.round(q('.topnav').getBoundingClientRect().height)
    };


    /* 分组导航逐项可达（真实结构与条数） */
    R.ws = {};
    /* sample（样本管理）本轮不进左栏菜单，但页面仍在 DOM 里 —— 单独用 __goRaw 走一次，
       证明「保留的页面仍可直达、仍能渲染」，而不是被改成了死页 */
    /* v40：dataset 已从页面里撤掉（数据集收进项目概况页签），换成系统管理下的 pubds。
       这里轮流走一遍三个分组首项：proj / dataset / log 里的中间那个不再是页面了。
       v47：系统管理组新增 projgroup（项目组管理），一并走一遍 —— 它是新页面，
       不进这条循环的话「页面在、但左栏点不到 / 面包屑不对」这类问题没人守。 */
    for (const w of ['proj', 'pubds', 'projgroup', 'log']) {
      goPage(w).click(); await sleep(190);
      const pg = q('#page-' + w);
      const H = { proj:'#projGrid .projcard', sample:'#sampleBody tr', pubds:'#pubdsList .pubdsr',
                  projgroup:'#pgBody tr[data-pgrow]', log:'#logBody tr' }[w];
      R.ws[w] = {
        on:     !!pg && pg.classList.contains('is-on'),
        cur:    !!q('.snav__i[data-go="' + w + '"][aria-current="page"]'),
        /* v50：菜单内页「面包屑页名 == 左栏当前项文本」这条口径搬到这里来 ——
           p04 落到菜单外之后，原先那条断言（在 p04 上比这两个）就没有宿主了，
           而它守的正是「两处名字同源」，所以换个还在菜单里的页面继续守。 */
        curTxt: txt(q('.snav__i[data-go="' + w + '"][aria-current="page"]')),
        h1:     pg ? txt(pg.querySelector('.phead__h1')) : '(null)',
        rows:   pg ? pg.querySelectorAll(H).length : 0,
        /* 管理页不在主流程上：面包屑不该给「步骤 n/6」 */
        stepHidden: q('#crumbStep').hidden,
        crumb:  txt(q('#crumb'))
      };
    }
    /* v49：运行日志不再是「宽表页自动收起左栏」的名单成员 —— 它是系统管理组里
       的一个菜单项，到了就把左栏收起来，等于把「你正站着的这一格」也藏了
       （看上去就是整页进了全屏、左栏不见了）。这里量的是**反过来的事实**：
       左栏在场、当前项高亮、正文正好落在剩下的那一列里。
       为什么还要量宽度：只查「没有 is-railoff」不足以守住几何 ——
       网格列数与 --rail-w 一脱节，正文会被压窄甚至挤成 0，而 DOM 数据全是对的。 */
    R.logRail = {
      off:     !!q('.shell.is-railoff'),
      snavVis: getComputedStyle(q('.snav')).display !== 'none',
      cols:    getComputedStyle(q('.shell')).gridTemplateColumns.split(' ').length,  /* 期望 2 */
      cur:     txt(q('.snav__i[data-go="log"][aria-current="page"]')),
      rows:    qa('#logBody tr').length,
      railW:   Math.round(q('.snav').getBoundingClientRect().width),
      bodyW:   Math.round(q('#content').getBoundingClientRect().width),
      pageW:   Math.round(q('#page-log').getBoundingClientRect().width),
      vp:      window.innerWidth
    };
    /* v49：左栏常驻后这条筛选栏少了 252px，会折行 —— 「折行」本身没问题，
       「折在哪」才是问题：默认 flex-wrap 会把起始/结束日期拆成两行、
       三个按钮紧贴着「结束日期」落下（看上去像按钮属于那一格）。
       所以折断的是：日期对**同行**、动作组**贴右**（与字段之间留出空档）。
       字段行数取 .fld__l 的 top 去重 —— 标签高度一致，同一行的标签 top 必然相同，
       而按 .fld 或按钮的 top 分组会被 align-items:flex-end 打乱。 */
    R.logFilt = (function () {
      var bar = q('#page-log .filtbar');
      var labs = qa('#page-log .filtbar .fld__l');
      var tops = labs.map(function (l) { return Math.round(l.getBoundingClientRect().top); });
      var uniq = tops.filter(function (t, i) { return tops.indexOf(t) === i; });
      var bots = qa('#page-log .filtbar .fld').map(function (f) {
        return Math.round(f.getBoundingClientRect().bottom);
      });
      var act = q('#page-log .filtbar__act').getBoundingClientRect();
      var br = bar.getBoundingClientRect();
      var d1 = q('#logD1').getBoundingClientRect(), d2 = q('#logD2').getBoundingClientRect();
      return {
        fieldRows:    uniq.length,                                            /* 期望 2：7 个字段排两行 */
        datesSameRow: Math.abs(Math.round(d1.top) - Math.round(d2.top)) <= 1,  /* 期望 true：日期对不许拆行 */
        actOwnRow:    (act.bottom - Math.max.apply(null, bots)) > 4,           /* 期望 true：动作组另起一行 */
        actRight:     Math.round(br.right - act.right),                        /* 期望 0：动作组贴右 */
        barH:         Math.round(br.height)
      };
    })();

    /* 样本管理（sample）不在左栏菜单里（用户回复「另安排」），但页面与数据都保留 ——
       它是「自动收左栏」名单里**仅剩**的一页，正好借它把收起态量全：
       顶栏左段的深色块必须跟着收（不收的话白底上会剩一根没有柱身的色块，
       而它的文字是浅色 → 品牌区不可读）；网格必须跟着收成 1 列
       （不跟着收，正文会补进那格 0 宽轨道 → 整页渲染成空白。这是抓到的真事故：
       页面 is-on、标题对、行数对，就是宽 0）。走 __goRaw 直达一次，同时证明
       它仍然打得开、仍有内容，而不是被改成了死页。
       注意必须放在 logRail 之后：它会切走当前页，先跑会让 logRail 量到 0 宽。 */
    window.__goRaw('sample'); await sleep(240);
    R.railAuto = {
      offOnWide:     !!q('.shell.is-railoff'),   /* 唯一还会自动收起左栏的页 */
      snavHidden:    getComputedStyle(q('.snav')).display === 'none',
      cols:          getComputedStyle(q('.shell')).gridTemplateColumns.split(' ').length,  /* 期望 1：网格要跟着收，否则 0 宽轨道会吃掉正文 */
      bodyW:         Math.round(q('#content').getBoundingClientRect().width),
      pageW:         Math.round(q('#page-sample').getBoundingClientRect().width),
      vp:            window.innerWidth,
      /* 顶栏左段的深色块靠 .app 上的同一个状态类收起（见 setRail）。
         不跟着收的话，白底上会剩一根没有柱身的深色块，而它的文字是浅色 ——
         换句话说，「左栏收起」这个状态会顺手把品牌区变成不可读。 */
      appOff:        q('.app').classList.contains('is-railoff'),
      capDisp:       getComputedStyle(q('.topnav'), '::before').display,   /* 期望 none */
      brandFg:       getComputedStyle(q('.tnav-name')).color,
      brandRatio:    rat(getComputedStyle(q('.tnav-name')).color, effBg(q('.tnav-name')))
    };
    R.sampleKept = {
      on: !!q('#page-sample') && q('#page-sample').classList.contains('is-on'),
      h1: txt(q('#page-sample .phead__h1')),
      rows: qa('#sampleBody tr').length,
      inNav: qa('.snav__i[data-go="sample"]').length,   /* 期望 0：不在菜单里 */
      bodyW: Math.round(q('#content').getBoundingClientRect().width),
      vp: window.innerWidth
    };

    /* ---- v40 需求 2：系统管理 › 示例数据集（显示 / 简介 / 封面三件设置）----
       这一页的每一条设置都必须是「改完前台立刻看得见」。只看设置页自己重画
       没有意义（那只是把控件换了个值），所以每改一次都把前台卡片一起读回来 ——
       两侧数字放进同一次读数里，才断得成「设置真实作用于前台」这条。 */
    goPage('pubds').click(); await sleep(320);
    R.pubdsInit = window.__pubds();
    /* ① 显示开关：隐藏一条人类公开数据集 → 数据汇集页那组少一张 */
    window.__pubds({ id: 'tcga-lihc', show: false }); await sleep(240);
    R.pubdsHide = window.__pubds();
    /* ② 简介：改一条院内队列的简介 → 工作台卡片底部那行文字跟着换 */
    window.__pubds({ id: 'own-rna', intro: '【验证】改过的简介' }); await sleep(240);
    R.pubdsIntro = {
      card: txt(q('#dsGroup-own [data-pick="转录组表达矩阵"] .dcard__h')),
      store: window.__pubds().intros[1]
    };
    /* ③ 封面：给一条原本没封面的公开数据集配上封面 → 数据汇集页多一张 <img> */
    window.__pubds({ id: 'gtex-liver', img: 'img:rnaseq' }); await sleep(240);
    R.pubdsCover = {
      init: R.pubdsInit.frontHumanImg,
      now: qa('#pubGrid-human .dcard .dcard__im').length,
      preview: qa('#pubdsList .pubdsr__im').length
    };
    /* ④ 一键全隐藏 → 三组前台卡片都清空（而不是「改完还剩几张」） */
    q('[data-pds-all="0"]').click(); await sleep(260);
    R.pubdsAllOff = window.__pubds();
    /* ⑤ 恢复默认 → 三件设置一并复原，前台卡片数回到起点 */
    q('[data-pds-reset]').click(); await sleep(280);
    R.pubdsReset = window.__pubds();

    /* ---- 面包屑：主流程页给「步骤 n/4」，且与左栏当前项同源 ----
       v50 需求 4：p04 已不在左栏菜单里 → goPage('p04') 会返回 null，改用直达。
       这一改动让这一段多守一件事：**落在菜单外的页面时，左栏刻意不亮任何一项** ——
       页面照旧可达、面包屑照旧给分组段与步骤号，只是左栏里没有它这一格。 */
    window.__goRaw('p04'); await sleep(240);
    R.railOnFlow = { off: !!q('.shell.is-railoff'), snavVisible: getComputedStyle(q('.snav')).display !== 'none' };
    R.crumbStep = { group: txt(q('#crumbGrp')), page: txt(q('#crumb')),
                    step: txt(q('#crumbStep')), hidden: q('#crumbStep').hidden,
                    /* 左栏当前项：既要文案（菜单内的页面比名字用），也要条数
                       （菜单外的页面要断「一项都没亮」）。txt(null) 会返回 '(null)'，
                       拿它跟空串比是自找麻烦 —— 所以另给一个计数读数。 */
                    navCur: txt(q('.snav__i[aria-current="page"]')),
                    navCurN: qa('.snav__i[aria-current="page"]').length };

    /* ---- 项目管理：卡片/列表双视图 · 详情抽屉 · 设为当前 · 新建 · 分享 ----
       本轮新增的交互全部在这里走一遍。注意 PROJECTS 是运行时数组，
       新建用例会真的往里 push 一条，所以后面的用例都建立在「13 个项目」之上。 */
    goPage('proj').click(); await sleep(300);
    const cardOf = pid => q('#projGrid .projcard[data-proj="' + pid + '"]');
    R.projInit = {
      state: window.__projState(),
      cards: qa('#projGrid .projcard').length,          /* 期望 13 */
      cls: q('#projGrid').className,                    /* 期望 grid2 */
      segOn: txt(q('#projViewSeg .seg__b.is-on')),      /* 期望「卡片」 */
      segAria: q('#projViewSeg [data-projview="card"]').getAttribute('aria-selected'),
      count: txt(q('#projCount')),                      /* 期望「共 13 个项目」 */
      cur: txt(q('#projCur')),                          /* 期望「当前：原发性肝癌…」 */
      firstAct: qa('#projGrid .projcard:first-child .projcard__act .btn').length,
      /* v28：项目管理页左栏默认展开，不再随宽表页一起自动收起 */
      railOn: !q('.shell.is-railoff'),
      snavVis: getComputedStyle(q('.snav')).display !== 'none',
      /* 卡片摘要与详情指标同源：都从 sm/u/rn 现算，不许出现第二份数字 */
      meta: txt(q('#projGrid .projcard[data-proj="P-2026-001"] .pf-meta'))
    };

    /* 切列表视图：DOM 形状、分段态、几何宽度三样都要变 */
    q('#projViewSeg [data-projview="list"]').click(); await sleep(280);
    R.projList = {
      rows: qa('#projGrid .tbl tbody tr').length,       /* 期望 13 */
      cards: qa('#projGrid .projcard').length,          /* 期望 0：不是「两套都渲染再藏起来」 */
      cls: q('#projGrid').className,                    /* 期望 card */
      segOn: txt(q('#projViewSeg .seg__b.is-on')),      /* 期望「列表」 */
      ariaOn: q('#projViewSeg [data-projview="list"]').getAttribute('aria-selected'),
      ariaOff: q('#projViewSeg [data-projview="card"]').getAttribute('aria-selected'),
      heads: qa('#projGrid .tbl thead th').length,      /* 期望 9 列：v37 加了「项目状态」 */
      w: Math.round(q('#projGrid .tbl').getBoundingClientRect().width),
      vp: window.innerWidth
    };
    /* 操作列的「查看」：每行都要有，且点了要**真的**进项目概况页 ——
       只断「按钮存在」会漏掉「画了个不响应的按钮」（本项目有过 .dagstep 的先例） */
    R.projOpsView = {
      btns:  qa('#projGrid .tbl tbody .ops [data-proj-open]').length,   /* 期望 13：每行操作列一个 */
      label: txt(q('#projGrid .tbl tbody tr:first-child .ops [data-proj-open]')),
      rowId: q('#projGrid .tbl tbody tr:first-child').getAttribute('data-proj')
    };
    q('#projGrid .tbl tbody tr:first-child .ops [data-proj-open]').click(); await sleep(400);
    R.projOpsView.open   = q('#page-projdetail').classList.contains('is-on');
    R.projOpsView.tag    = txt(q('#projTag'));            /* 页头的编号，应与该行一致 */
    R.projOpsView.opened = txt(q('#projName'));
    /* v39：详情是页面不是浮层 —— 页面上不该有关闭键，「退出」= 面包屑回列表。
       这条同时守住「抽屉删干净了」：留着 data-close="proj" 就会变成一颗死按钮。 */
    R.projOpsView.closeBtns = qa('#page-projdetail [data-close]').length;   /* 期望 0 */
    R.projOpsView.crumb = window.__crumbSegs('projdetail').map(s => s.t);
    /* 当前段（不可点）：它是面包屑的最后一格，证明「人正站在项目概况上」 */
    R.projOpsView.crumbCur = txt(q('#crumb'));
    /* 左栏高亮要落在「项目管理」上：详情页不在菜单里，不落的话站在详情里
       左栏一格都不亮，用户会以为掉出了菜单 */
    R.projOpsView.navOn = txt(q('#snav .snav__i[aria-current="page"] .snav__t'));
    R.projOpsView.navProj = qa('#snav [data-pds]').length;      /* 项目层左栏的两个叶子 */
    R.projOpsView.navGlobal = qa('#snav [data-go]').length;     /* 期望 0：全局菜单已让位 */
    q('#crumbParent').click(); await sleep(340);
    R.projOpsView.backOnList = q('#page-proj').classList.contains('is-on');

    q('#projViewSeg [data-projview="card"]').click(); await sleep(240);
    R.projViewBack = { cards: qa('#projGrid .projcard').length, cls: q('#projGrid').className };

    /* 项目概况页：点的是**卡片主体按钮**（不是整张卡上的 div）。
       v39 起这一屏有六个页签，默认停在「项目信息」——页签条、面板、
       角标、键值表的数字全部现算，所以断言也按「结构 + 真数据」两条来。 */
    cardOf('P-2026-001').querySelector('[data-proj-open]').click(); await sleep(420);
    R.projDetail = {
      open: q('#page-projdetail').classList.contains('is-on'),
      tag: txt(q('#projTag')),
      name: txt(q('#projName')),
      sub: txt(q('#projSub')),
      /* 页头右上角那排计数（对齐参考系统）：数据集 / 运行中 / 成功 / 失败 */
      badges: qa('#projBadges .pjbadge').map(b => txt(b.querySelector('b'))),
      badgeTone: qa('#projBadges .pjbadge').map(b => b.className),
      /* 四格指标只数「项目信息」这一屏的 —— v40 起「数据集」页签自己也有一排
         .mrow，不限定容器就会把两屏的格子加起来（实测 4+3=7 格跨 2 行）。 */
      stats: qa('#pdt-info .mrow .mcell').map(m => txt(m.querySelector('.mcell__v'))),
      statN: qa('#pdt-info .mrow .mcell').length,      /* 期望 4 */
      actN: qa('#projActs .btn').length,                /* v44 期望 2：分享 + 全景（v42 撤了运行记录） */
      /* v45：全景那一颗**常驻 DOM、靠 hidden 显隐**（从「渲不渲染」换成「切 hidden」，
         免得重画操作条时把旁边那排状态徽章一起闪）。所以这里必须按**可见性**量：
         数 `#projActs [data-proj-pano]` 的命中数恒为 1，按钮藏了断言也照绿。
         此刻站在「项目概况」栏，期望 1。 */
      panoN: window.__projDetail().panoN,
      /* v37 需求 7：「设为当前项目」整条撤销，操作条首位换成项目状态 */
      onBtn: qa('#page-projdetail [data-proj-on]').length,   /* 期望 0 */
      stTxt: txt(q('#projActs .pd__st')),                    /* 期望含「项目状态 成功」 */
      stCls: (function () {
        const t = q('#projActs .pd__st .tag'); return t ? t.className : '';
      })(),
      /* 页签：键 + 名 + 当前态，以及「面板确实只有当前那个在显示」。
         v41 起页签条只列**当前这一栏**的页签，所以这一屏是 5 个；
         flow / run 属于「分析执行」那一栏，得先把左栏切过去才会出现。 */
      tabs: qa('#projTabs [data-pdt]').map(b => b.getAttribute('data-pdt')),
      tabTxt: qa('#projTabs .ptab').map(txt),
      tabOn: txt(q('#projTabs .ptab.is-on')),
      tabsHidden: q('#projTabs').hidden,
      stepsHidden: q('#projSteps').hidden,
      panels: qa('#projBody .pjpanel').length,          /* 期望 5：只渲染当前那一栏的面板 */
      panelsOn: qa('#projBody .pjpanel.is-on').map(b => b.getAttribute('data-pdtpanel')),
      /* 项目层的左栏 = **这个项目自己的菜单**（v41）：项目详情 / 分析执行两个叶子
         + 分析结果（可折叠分组，子项 = 该项目的流程步骤）。子项不在菜单树 NAVGROUPS
         里，它是进来时按项目现算的 —— 所以「换个项目左栏就换一套」这件事
         只能在这里断，点不出来。 */
      nav: window.__projDetail().nav,                   /* 期望 ['info','exec']：分析结果是分组头 */
      navMods: window.__projDetail().navMods,           /* 左栏渲染出来的模块名 */
      navOn: window.__projDetail().navOn,               /* 期望 info */
      navGrp: txt(q('#navBody [data-pdgrp] .snav__gt')),      /* 期望「分析结果」 */
      navGrpOpen: !q('#pdModList').hidden,
      navGrpExpanded: q('#navBody [data-pdgrp]').getAttribute('aria-expanded'),
      navMarks: qa('#navBody [data-pdmod] .snav__n').length,   /* 每个模块一枚状态记号 */
      /* 全局菜单项在这层必须一个都不剩：留着就是「两套导航叠在一起」 */
      navGlobal: qa('#navBody [data-go]').length,              /* 期望 0 */
      kv: qa('#pdt-info .tbl--kv tbody tr').length,     /* 期望 8 行键值 */
      /* v40：数据集不再在「项目信息」里铺一张表，而是自己占一个页签 ——
         这里断的是「信息屏只给计数与去处，明细在数据集页签」这件事。 */
      dsLink: qa('#pdt-info [data-pdt="dataset"]').length,   /* 期望 1 */
      dsInfoTxt: txt(q('#pdt-info [data-pdsec="ds"]')),
      smRows: qa('#projBody [data-psm] tr').length,     /* 期望 6 */
      lgRows: qa('#projBody [data-plg] tr').length,     /* 期望 4 */
      /* 流程模板条数必须等于卡片摘要里那个「9 条流程」——
         页面上多一个少一个都会变成「两屏数字对不上」 */
      flRows: qa('#projBody [data-pfl] tr').length,     /* 期望 9 */
      secs: qa('#projBody .pd__sec').map(txt),
      /* 四个指标必须能并排一行：挤成 3+1 时第 4 格会独占一行像空白块 */
      statsRows: (function () {
        const tops = qa('#pdt-info .mrow .mcell').map(m => Math.round(m.getBoundingClientRect().top));
        return tops.filter((t, i) => i === 0 || t !== tops[i - 1]).length;
      })()
    };
    /* v44：页头三处（大标题 / 英文小标 / 面包屑末段）跟着左栏走。
       此刻人在信息栏 —— 三处都该是「项目概况」。
       ⚠ 键名避开 `head`：`R.projMod.head` 已是「已完成模块数」，撞名会静默覆盖。 */
    R.projDetail.title      = window.__projDetail().title;
    R.projDetail.titleEye   = window.__projDetail().titleEye;
    R.projDetail.titleCrumb = window.__projDetail().titleCrumb;
    /* 页签逐个点一遍：切过去的面板真的显示、别的真的收起。
       只数「有几个按钮」会漏掉「点了不换内容」——那等于几个装饰。 */
    const tabClick = async t => {
      q('#projTabs [data-pdt="' + t + '"]').click(); await sleep(260);
      return { on: q('#pdt-' + t).classList.contains('is-on'),
               shown: qa('#projBody .pjpanel.is-on').map(b => b.getAttribute('data-pdtpanel')) };
    };
    /* 左栏点一项。这一层的左栏不是全局菜单（没有 data-go），走它自己的入口；
       点完回读探针 —— 分栏、页签、高亮三样要在同一次读数里对得上。 */
    const railClick = async k => {
      const b = q('#navBody [data-pds="' + k + '"]');
      if (!b) return { missing: k };
      b.click(); await sleep(320);
      return window.__projDetail();
    };
    R.projDetail.tSample = await tabClick('sample');
    R.projDetail.tSample.sec = txt(q('#pdt-sample .pd__sec'));
    R.projDetail.tDataset = await tabClick('dataset');
    R.projDetail.tDataset.mcells = qa('#pdt-dataset .mrow .mcell').map(m => txt(m.querySelector('.mcell__v')));
    R.projDetail.tDataset.inRows = qa('#pdt-dataset [data-pdsin] tr').length;
    R.projDetail.tDataset.outRows = qa('#pdt-dataset [data-pdsout] tr').length;
    R.projDetail.tDataset.secs = qa('#pdt-dataset .pd__sec').map(txt);
    R.projDetail.tDataset.note = txt(q('#pdt-dataset .fld__h'));
    R.projDetail.tParam = await tabClick('param');
    R.projDetail.tParam.kvTxt = txt(q('#pdt-param .tbl--kv'));
    R.projDetail.tParam.jumps = qa('#pdt-param [data-go]').length;
    R.projDetail.tRef = await tabClick('ref');
    R.projDetail.tRef.kvTxt = txt(q('#pdt-ref .tbl--kv'));
    R.projDetail.tRef.idx = qa('#pdt-ref tbody tr').length;
    R.projDetail.tBack = await tabClick('info');

    /* ── v41：项目详情层的左栏是「这个项目自己的菜单」 ────────────────
       对齐参考系统：点「查看」进来后左栏整条换掉（那边是「项目详情 / 转录组分析 ▸
       各模块」），页面里再分页签。四件事分开断：
         ① 左栏三项 + 模块清单现算（子项不在 NAVGROUPS 里，点的出来看不见）；
         ② 每栏只列自己的页签，页签条与横向流程条互斥；
         ③ 模块页给的是**这一步的真实产出**，不是一张通用占位表；
         ④ 模块页底部的两个跳转真的落在对应页签上。 */
    R.projExec = await railClick('exec');
    R.projExec.tabTxt   = qa('#projTabs .ptab').map(txt);
    R.projExec.panels   = qa('#projBody .pjpanel').map(b => b.getAttribute('data-pdtpanel'));
    R.projExec.panelOn  = qa('#projBody .pjpanel.is-on').map(b => b.getAttribute('data-pdtpanel'));
    R.projExec.flowNote = txt(q('#pdt-flow .fld__h'));
    R.projExec.runJump  = qa('#pdt-run [data-proj-golog]').length;
    /* 这两张表住在这两个面板里 —— 站在信息栏量只会得到 0（不是「没数据」，是「量错栏」） */
    R.projExec.flRows   = qa('#projBody [data-pfl] tr').length;
    R.projExec.lgRows   = qa('#projBody [data-plg] tr').length;
    R.projExec.tRun     = await tabClick('run');
    R.projExec.tFlow    = await tabClick('flow');
    /* 从「分析执行」点回「项目详情」：页签条要换回信息栏那五条，
       正文也要换回信息栏的面板（跨栏只切 .is-on 会切出一屏空白） */
    R.projBack = await railClick('info');
    R.projBack.tabTxt  = qa('#projTabs .ptab').map(txt);
    R.projBack.panels  = qa('#projBody .pjpanel').map(b => b.getAttribute('data-pdtpanel'));
    R.projBack.panelOn = qa('#projBody .pjpanel.is-on').map(b => b.getAttribute('data-pdtpanel'));
    R.projBack.infoTxt = txt(q('#pdt-info .tbl--kv tbody tr:first-child'));

    /* 分析结果：点左栏第 3 个模块（不是第 1 个 —— 第 1 个与「刚进来」分不开，
       断不出「点哪个就落哪个」）。 */
    q('#navBody [data-pdmod="2"]').click(); await sleep(340);
    R.projMod = window.__projDetail();
    R.projMod.head    = txt(q('#projBody .pdmod__c--ok'));      /* 已完成模块数 */
    R.projMod.hint    = txt(q('#projBody .pdmod__hint'));       /* 「按模块统计 · 共 N 个 · 来自流程 …」 */
    R.projMod.secs    = qa('#projBody .pd__sec').map(txt);
    R.projMod.stTag   = txt(q('#projBody .pdmod__bar .pd__st .tag'));
    R.projMod.dl      = !!q('#projBody [data-dl="modres"]');
    R.projMod.stepCls = q('#projSteps .psteps__n.is-on').className;
    R.projMod.stepNo  = txt(q('#projSteps .psteps__n.is-on .psteps__no'));
    R.projMod.dsName  = txt(q('#projBody [data-pmodds] tr:first-child td'));
    R.projMod.navItemOn = txt(q('#navBody [data-pdmod].snav__i[aria-current="page"] .snav__t'));
    R.projMod.navMark   = txt(q('#navBody [data-pdmod].snav__i[aria-current="page"] .snav__n'));
    R.projMod.dsSec     = txt(q('#projBody [data-pdsec="modds"] .pd__sec'));
    /* 流程条上点第 1 步：页内换模块，左栏高亮跟着走
       —— 两处是同一个状态的两面，只动一处就会「左边亮 3、右边亮 1」。 */
    q('#projSteps [data-pdmod="0"]').click(); await sleep(320);
    R.projMod0 = window.__projDetail();
    R.projMod0.navItemOn = txt(q('#navBody [data-pdmod].snav__i[aria-current="page"] .snav__t'));
    R.projMod0.stepOn    = txt(q('#projSteps .psteps__n.is-on .psteps__t'));
    R.projMod0.secs      = qa('#projBody .pd__sec').map(txt);
    /* 回到第 3 步（后面那条「底部两个跳转」的断言要按这一步判位置） */
    q('#navBody [data-pdmod="2"]').click(); await sleep(320);
    /* 底部两个跳转：挂 data-pdt（不是 data-pds）—— 后者会被先命中，
       把「看运行记录」吞成「看流程定义」，页面停在 flow 上。 */
    R.projModJumpFrom = window.__projDetail();
    q('#projBody [data-pdt="run"]').click(); await sleep(340);
    R.projModJump = window.__projDetail();
    R.projModJump.onRun   = q('#pdt-run').classList.contains('is-on');
    R.projModJump.onFlow  = q('#pdt-flow').classList.contains('is-on');
    R.projModJump.runJump = qa('#pdt-run [data-proj-golog]').length;
    q('#crumbParent').click(); await sleep(340);
    R.projDetailClosed = q('#page-proj').classList.contains('is-on');
    /* 离开项目层之后左栏必须**换回全局菜单**。renderNavOn 只改高亮、不重建 DOM，
       少了「换套数就重画」这一步，人已经站在项目管理列表上，左栏却还挂着上一个
       项目的模块清单 —— 看起来像串页了。这条只能在这里断：进了层再出来。 */
    R.projRailRestore = {
      onList:      q('#page-proj').classList.contains('is-on'),
      globalItems: qa('#navBody [data-go]').length,     /* 期望 10：全局菜单回来了（v50 起智能分析整组不上菜单） */
      projItems:   qa('#navBody [data-pds]').length,    /* 期望 0：项目菜单整条撤走 */
      projMods:    qa('#navBody [data-pdmod]').length,  /* 期望 0 */
      navOn:       txt(q('#snav .snav__i[aria-current="page"] .snav__t'))
    };

    /* v28：「查看项目结果全景」→ 本页内换到「分析结果 › 结果全景」那一格。
       v43 曾按「同一件事别开两个门」撤过一版，v44 按用户要求恢复 ——
       所以这里改回**点页头那颗**（它是一键直达，还会把当前项目切过去）；
       「左栏末一格也能到」由下面 `pp['navOn']` 一并守住：点完按钮后左栏高亮
       必须落在「结果全景」上，两处是同一个状态的两面。 */
    cardOf('P-2026-001').querySelector('[data-proj-open]').click(); await sleep(380);
    R.projPano = {
      panoN: window.__projDetail().panoN,                              /* 期望 1：还在项目概况栏 */
      actBtns: qa('#projActs .btn').length,                            /* 期望 2：分享 + 全景 */
      actTxt: qa('#projActs .btn').map(txt),
      gologInActs: qa('#projActs [data-proj-golog]').length            /* 期望 0 */
    };
    R.projPano.actTxtHasPano = R.projPano.actTxt.some(s => s.indexOf('全景') >= 0);  /* 期望 true */
    R.projPano.mods = window.__projDetail().mods;
    R.projPano.lastName = R.projPano.mods[R.projPano.mods.length - 1] || '';
    q('#projActs [data-proj-pano]').click(); await sleep(420);
    R.projPano.stayHere  = q('#page-projdetail').classList.contains('is-on');   /* 期望 true */
    /* v51：p07 又存在了（智能分析第 5 步），所以这条读数不能再用「页面在不在」来表达
       「结果全景有没有独立宿主」。它现在守的是：**页面在，但左栏里没有它那一格**
       （整组 off），而项目详情这一层照旧打得开 —— 两个宿主并存，各有各的入口。 */
    R.projPano.p07Page   = !!q('#page-p07');                                    /* 期望 true */
    R.projPano.p07InNav  = qa('.snav__i[data-go="p07"]').length;                /* 期望 0 */
    /* 互斥：进到项目详情这一屏之后，#resMount 那份必须已经让位 ——
       否则文档里会有两个 #viewSeg 与两套表体 id，fillTables 只填到第一份。 */
    R.projPano.resCleared = qa('#resMount .rview').length;                      /* 期望 0 */
    R.projPano.segTotal   = qa('#viewSeg').length;                              /* 期望 1 */
    R.projPano.navOn     = txt(q('#snav .snav__i[aria-current="page"] .snav__t'));
    /* v45：这一格就是全景本身 —— 页头标题换成「结果全景」（v44），那颗按钮
       指向的正是脚下这一格，所以它必须自己隐掉（点下去什么都不会发生）。
       同时读页头三处：按钮的显隐与标题是同一个状态的两面，分开读会对不上。 */
    R.projPano.panoNAfter = window.__projDetail().panoN;                        /* 期望 0 */
    R.projPano.titleAfter = window.__projDetail().title;                        /* 期望 lastName */
    R.projPano.crumbAfter = window.__projDetail().titleCrumb;
    R.projPano.btnHidden  = (function () {
      const b = q('#projPanoBtn'); return b ? !!b.hidden : null;                /* 期望 true */
    })();
    R.projPano.btnW       = (function () {
      const b = q('#projPanoBtn'); return b ? Math.round(b.getBoundingClientRect().width) : -1;
    })();                                                                       /* 期望 0：css 的 [hidden] 真的生效 */
    R.projPano.mount     = !!q('#panoMount');
    R.projPano.views     = qa('#panoMount .rview').length;                      /* 期望 6 */
    R.projPano.segBtns   = qa('#panoMount #viewSeg .seg__b').length;            /* 期望 6 */
    R.projPano.viewOn    = (function () {
      var v = q('#panoMount .rview.is-on'); return v ? v.getAttribute('data-view') : '';
    })();
    R.projPano.charts    = qa('#panoMount .chartbox svg.chart').length;         /* 期望 >0 */
    R.projPano.mountDl   = qa('#panoMount [data-dl]').length;                   /* 导出入口 */
    R.projPano.mountTrace = qa('#panoMount [data-drawer]').length;              /* 运行详情 */
    R.projPano.stepsShown = !q('#projSteps').hidden;
    R.projPano.tabsHidden = q('#projTabs').hidden;
    /* v45 反向：从全景那一格换到别的模块，那颗按钮要**自己回来** ——
       断的是「跟着当前位置走」，不是「进过一次就永久没了」。
       少了这一条，「条件显隐」写死成「进了层就不显示」也照样绿。 */
    q('#navBody [data-pdmod="2"]').click(); await sleep(340);
    R.projPano.panoNBack = window.__projDetail().panoN;                        /* 期望 1 */
    R.projPano.titleBack = window.__projDetail().title;                        /* 期望 ≠ lastName */
    goPage('proj').click(); await sleep(300);

    /* v42：三处「查看结果」（工作台最近任务表两处 + 任务运行页那颗）原来都跳
       「智能分析 › 结果全景」独立页，现在改落到项目详情层的「结果全景」模块，
       并且把视图带进去 —— 在「差异表达」那一行点，进去就该是差异表达视图。 */
    window.__goHome(); await sleep(280);
    R.panoEntry = { n: qa('[data-pano]').length };                        /* 期望 3 */
    var _pb = q('[data-pano]');
    if (_pb) { _pb.click(); await sleep(420); }
    R.panoEntry.inProj = q('#page-projdetail').classList.contains('is-on');
    R.panoEntry.mount  = !!q('#panoMount');
    /* v45：这条入口直接落在「结果全景」那一格（带视图参数），页头那颗同样要隐去 ——
       「自指就隐」是位置驱动的，从哪条路进来都一样。 */
    R.panoEntry.panoN  = window.__projDetail().panoN;                     /* 期望 0 */
    R.panoEntry.title  = window.__projDetail().title;                     /* 期望「结果全景」 */
    R.panoEntry.view   = (function () {
      var v = q('#panoMount .rview.is-on'); return v ? v.getAttribute('data-view') : '';
    })();

    /* 非当前项目：有关联资产为空时给**显式空态**，不能整节消失。
       v40 起「数据集」也跟着项目走了 —— 所以换 P-2026-004：它是唯一
       数据集 / 样本 / 运行记录**三样都没有**的项目。原来用 P-2026-003，
       那一条本轮补了数据集，再拿它断「三块都空」会断在一个不空的实例上。 */
    cardOf('P-2026-004').querySelector('[data-proj-open]').click(); await sleep(340);
    R.projDetailOther = {
      name: txt(q('#projName')),
      onBtn: qa('#page-projdetail [data-proj-on]').length,   /* v37 期望 0：按钮已撤 */
      stTxt: txt(q('#projActs .pd__st')),                    /* 非当前项目同样只给状态 */
      empties: qa('#projBody .pd__empty').length,            /* 期望 3：数据集 / 样本 / 运行记录 */
      pano: qa('#page-projdetail [data-proj-pano]').length,  /* 期望 0：无运行记录不给全景入口 */
      secTxt: qa('#projBody .pd__sec').map(txt)
    };
    /* 切到「数据集」页签看空态文案：空不是「缺节」，得说清为什么空 */
    q('#projTabs [data-pdt="dataset"]').click(); await sleep(240);
    R.projDetailOther.dsEmpty = txt(q('#pdt-dataset .pd__empty'));
    R.projDetailOther.dsSecs = qa('#pdt-dataset .pd__sec').map(txt);
    /* 不依赖参考基因组的项目（ref = '—'）：「参考基因组」页签给显式空态，
       而不是一张空表 —— 空表读起来像「加载失败」，一句话才说得清缘由 */
    cardOf('P-2026-002').querySelector('[data-proj-open]').click(); await sleep(320);
    q('#projTabs [data-pdt="ref"]').click(); await sleep(240);
    R.projRefNA = { tag: txt(q('#projTag')),
                    empty: !!q('#pdt-ref .pd__empty'),
                    kv: qa('#pdt-ref .tbl--kv').length };
    q('#projTabs [data-pdt="info"]').click(); await sleep(200);

    /* v37 需求 7：「设为当前」的三态流转整段撤销。替代守卫是**入口彻底不存在** ——
       「按钮删了但事件还在」「列表删了卡片还在」是这类改动的典型残留，
       所以卡片 / 列表 / 详情三个落点各数一遍，任何一处残留都会被抓住。 */
    R.projNoSetCur = {
      detail: qa('#page-projdetail [data-proj-on]').length,     /* 期望 0 */
      card:   qa('#projGrid .projcard [data-proj-on]').length,  /* 期望 0 */
      bodyHit: document.body.innerHTML.indexOf('data-proj-on'),  /* 期望 -1 */
      label:  document.body.innerText.indexOf('设为当前')         /* 期望 -1：文案也不该留 */
    };
    /* v39：Esc 在项目概况页上不该「关掉」任何东西 ——
       它原先收的是抽屉，而页面在页流里，没有可收的层（浮层才归 Esc 管）。 */
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(300);
    R.projEsc = { stillOnPage: q('#page-projdetail').classList.contains('is-on'),
                  tag: txt(q('#projTag')),
                  modalHidden: q('#modal').hidden,
                  sampHidden: q('#drawerSamp').hidden };

    /* v41 组学线：模块清单来自**这个项目自己那条线的主流程**。
       旧实现按 p.id 哈希取模板，把「原发性肝癌转录组示范项目」的主流程算成了
       「16S 扩增子分析流程」—— 模块清单、分析参数、实验流程三处会一起错，
       而且错得看不出来（都是一串同样专业的流程名）。
       所以这里断的是**具体是哪条流程**：16S 项目必须是 f08、且模块里有 DADA2 降噪。
       出层必须走面包屑（项目层的左栏里没有全局菜单）—— 所以先退回列表再点卡片。 */
    q('#crumbParent').click(); await sleep(320);
    cardOf('P-2026-007').querySelector('[data-proj-open]').click(); await sleep(400);
    R.projLine16S = window.__projDetail();
    R.projLine16S.navMods = qa('#navBody [data-pdmod] .snav__t').map(txt);   /* 左栏真渲染出来的那份 */
    R.projLine16S.navMarks = qa('#navBody [data-pdmod] .snav__n').length;
    /* 左栏点第一个模块进模块页：不是转录组项目，这一屏该给 16S 的步骤 */
    q('#navBody [data-pdmod="0"]').click(); await sleep(360);
    R.projLine16S.modSecs = qa('#projBody .pd__sec').map(txt);
    R.projLine16S.modPos  = window.__projDetail().modPos;
    q('#crumbParent').click(); await sleep(320);
    goPage('proj').click(); await sleep(300);
    /* 卡片：每张卡一枚状态标签。选择器要排掉「当前」那枚 brand 标签 ——
       它和状态同用一个 .tag 类，不排掉的话「状态取值只有三种」会被它污染。 */
    R.projStatus = {
      cardTags: qa('#projGrid .projcard .tag:not(.tag--brand)').length,
      statuses: qa('#projGrid .projcard .tag:not(.tag--brand)').map(t => txt(t))
    };
    /* 列表：切过去再量 —— 表头列与操作列只在列表视图里有；停在卡片视图量出来
       是 -1，那不是「列没了」，是「量错视图了」（本轮真实踩到）。 */
    q('#projViewSeg [data-projview="list"]').click(); await sleep(280);
    R.projStatus.listHead = qa('#projGrid table thead th').map(t => txt(t));
    R.projStatus.listTh   = R.projStatus.listHead.indexOf('项目状态');    /* 期望 5 */
    R.projStatus.listSt   = txt(q('#projGrid table tbody tr:first-child td:nth-child(6)'));
    R.projStatus.opsBtns  = (function () {
      const r = q('#projGrid table tbody tr'); if (!r) return -1;
      return r.querySelectorAll('td:last-child .btn').length;
    })();
    /* 回到卡片视图：向导段从「新增项目」按钮起步，卡片是默认态 */
    q('#projViewSeg [data-projview="card"]').click(); await sleep(240);

    /* ---- 新建项目：6 步向导（v39 需求 2 建 4 步 / v47 需求 2 补回两步）----
       项目信息 → 数据文件 → 分组与比较方案 → 流程模版 → 参数配置 → 创建完成。
       v47 补的那两步不是「多加两屏」：本系统真正的分析流程就是
       数据汇集 → 流程模板 → 参数配置 → 任务运行，原来的向导走到第 3 步
       直接跳「创建完成」，等于建了一个**没有流程、没有参数**的空壳项目。
       这里刻意用**真实点击**驱动而不是直接设 PNEW.step —— 要守的恰恰是
       「一步能不能往下走」和「走不动时拦不拦得住」；直接改状态就绕开了整条链路。 */
    q('[data-proj-new]').click(); await sleep(320);
    /* v50 需求 3：点「新建项目」先出一屏**选择**（一键全流程分析 / 智能分析）。
       这一段守的是向导本身的 6 步链路，所以先走「一键全流程分析」进去；
       那一屏自己由上面的 R.pnChoose 单独守。
       ⚠ 少了这一下，下面 `q('#modalF [data-pn="next"]')` 取到 null，`.click()`
       会抛错并**打断整段驱动脚本**（本轮实测：其后几百条读数全成 <缺失>）。 */
    q('.pnchoose__c[data-pns="full"]').click(); await sleep(340);
    /* 当前步下标（0–5）。用 .wiz__i.is-on 而不是 aria-current 反查 —— 同义两种表达都断一次 */
    const stepIdx = () => qa('#modalB .wiz__i').findIndex(el => el.classList.contains('is-on'));
    const curLabel = () => {
      const el = q('#modalB .wiz__i.is-on .wiz__t'); return el ? txt(el) : '(null)';
    };
    R.projWiz = {
      open:    !q('#modal').hidden,
      title:   txt(q('#modalT')),
      steps:   qa('#modalB .wiz__i .wiz__t').map(txt),      /* 期望 6 步名 */
      onCount: qa('#modalB .wiz__i.is-on').length,          /* 期望 1 */
      done:    qa('#modalB .wiz__i.is-done').length,        /* 期望 0：还没走 */
      ariaCur: qa('#modalB .wiz__i[aria-current="step"]').length,  /* 期望 1 */
      wide:    q('#modal .modal__b').className.indexOf('modal__b--wide') >= 0,
      fields:  qa('#modalB .fld').length,                   /* 期望 7：名称/描述/项目组/样本ID/样本描述/参考基因组/实验条件 */
      marks:   qa('#modalB .fld__l .req').length,           /* 期望 6 个必填 */
      aria:    qa('#modalB [aria-required="true"]').length,
      legend:  qa('#modalB .frmlegend').length,
      next:    !!q('#modalF [data-pn="next"]'),
      back:    qa('#modalF [data-pn="back"]').length,       /* 期望 0：第一步没有「上一步」 */
      /* v47：第 1 步的「所属项目组」下拉来自系统管理 › 项目组管理里
         「已通过 + 启用」的那些，不再是写死的名字数组。 */
      grpOpts: qa('#modalB #pnGrp option').map(o => o.value).filter(Boolean)
    };
    /* 空表直接下一步 → 拦在第一步，并点名缺哪一项（不是默默不动） */
    q('#modalF [data-pn="next"]').click(); await sleep(260);
    R.projWiz.guard = { step: stepIdx(), stillOpen: !q('#modal').hidden, toast: lastToast() };

    /* ---- 第 1 步：真实填表 ---- */
    const setV = (id, v, evName) => {
      const el = q('#' + id); if (!el) return false;
      el.value = v; el.dispatchEvent(new Event(evName || 'change', { bubbles: true })); return true;
    };
    const filled = [
      setV('pnName', '肝癌免疫治疗应答队列', 'input'),
      setV('pnDesc', '院内前瞻队列，入组 60 例，含治疗前 / 治疗后配对取样。', 'input'),
      setV('pnGrp', '肝癌免疫队列'),
      setV('pnSampDesc', '肝穿刺组织，癌与癌旁配对，干冰运输', 'input'),
      setV('pnRef', 'hg38'),
      setV('pnCond', 'Illumina NovaSeq 6000 · PE150', 'input')
    ];
    /* renderProjNew 每次动作后整块重绘 —— 一次 qa() 拿到的 NodeList，点完第一下之后
       剩下的就全是游离节点；游离节点的 click 不冒泡到 document，委托收不到，
       等于「点了但什么都没发生」（本轮真实踩到：选 4 例只登记了 1 例）。
       所以凡「连点若干下」都写成：每点一下按**当前** DOM 重新查一次。
       取「第一个还没勾的」而不是固定下标 —— 列表顺序会随勾选态重排。 */
    const clickN = async (sel, n) => {
      for (let k = 0; k < n; k++) {
        const c = qa(sel).find(x => !x.checked);
        if (!c) break;
        c.click(); await sleep(110);
      }
    };
    /* 选 4 例样本：后面要分成 2 + 2 两组，正好够「每组 ≥2 例」的规则 */
    const onIds = () => qa('#modalB .pnpick__row.is-on .pnpick__id').map(txt);
    const sidAllBox = () => q('#pnSidAll');
    await clickN('#modalB [data-pn="sid-tog"]', 4); await sleep(200);
    R.projWiz.s1 = {
      allFilled: filled.every(Boolean),
      chosen:    txt(q('#modalB .pnpick__hd')),
      onRows:    qa('#modalB .pnpick__row.is-on').length,
      sids:      window.__pnState().sids,
      sidIds:    onIds().join(','),
      cur:       curLabel()
    };
    /* ---- v48 需求 1：样本ID 一键全选（三态都要读到）----
       为什么三态都得读：只断「点了变 20」的话，把「取消全选」写成永远全选、
       或者把 indeterminate 整个漏掉，都照样绿。
       为什么这一段跑完必须还原成 4 例：第 3 步的分组方案**样本池就是 d.sids**，
       多一例少一例，后面「样本池 = 4 例」那条连带断言就跟着漂。 */
    R.projWiz.s1part = {
      onRows:  qa('#modalB .pnpick__row.is-on').length,        /* 4 */
      box:     !!sidAllBox(),
      label:   txt(q('#modalB .pnpick__all')),                 /* 期望 全选 */
      checked: sidAllBox() ? sidAllBox().checked : null,       /* false：没选满 */
      indet:   sidAllBox() ? sidAllBox().indeterminate : null  /* true：部分选中 */
    };
    q('#modalB [data-pn="sid-all"]').click(); await sleep(240);
    R.projWiz.s1all = {
      onRows:  qa('#modalB .pnpick__row.is-on').length,        /* 期望 20 = 档案池选满 */
      checked: sidAllBox() ? sidAllBox().checked : null,       /* true */
      indet:   sidAllBox() ? sidAllBox().indeterminate : null, /* false：已选满 */
      sids:    window.__pnState().sids,
      header:  txt(q('#modalB .pnpick__hd'))
    };
    q('#modalB [data-pn="sid-all"]').click(); await sleep(240);
    R.projWiz.s1none = {
      onRows:  qa('#modalB .pnpick__row.is-on').length,        /* 期望 0 */
      checked: sidAllBox() ? sidAllBox().checked : null,       /* false */
      sids:    window.__pnState().sids,
      rows:    qa('#modalB .pnpick__row').length               /* 行还在，只是没勾 */
    };
    /* 往返无损：再勾回原来那 4 例，必须与全选之前是**同一组 ID** */
    await clickN('#modalB [data-pn="sid-tog"]', 4); await sleep(240);
    R.projWiz.s1restore = {
      onRows: qa('#modalB .pnpick__row.is-on').length,
      sids:   window.__pnState().sids,
      same:   onIds().join(',') === R.projWiz.s1.sidIds
    };

    /* ---- v48 需求 2：新增样本ID 子编辑器的「返回」----
       要证明两件事：① 底栏那颗把用户送回**向导本体**（不是关掉整个弹窗）；
       ② 子编辑器里**没有**会把整个新建项目窗口关掉的那颗按钮。
       后者是这次真正的缺陷：它原先挂的是全局 `cancel`，点「取消」= 关窗 +
       丢掉整个向导，用户填了半天的项目名 / 文件 / 分组全没了。 */
    q('#modalB [data-pn="sid-new"]').click(); await sleep(260);
    R.projWiz.sidEditOpen = {
      view:      window.__pnState().view,                      /* 期望 sid */
      stillOpen: !q('#modal').hidden,
      foot:      qa('#modalF .btn').map(txt),                  /* 期望 ['返回','确定'] */
      back:      qa('#modalF [data-pn="sid-cancel"]').length,  /* 期望 1 */
      cancel:    qa('#modalF [data-pn="cancel"]').length,      /* 期望 0 */
      fields:    qa('#modalB .fld').length                     /* 期望 5 */
    };
    q('#modalF [data-pn="sid-cancel"]').click(); await sleep(260);
    R.projWiz.sidEditBack = {
      view:      window.__pnState().view,                      /* 期望 wizard */
      stillOpen: !q('#modal').hidden,                          /* 期望 true：整个向导还在 */
      step:      stepIdx(),                                    /* 期望 0：还在第 1 步 */
      name:      q('#pnName') ? q('#pnName').value : null,     /* 期望：刚填的项目名还在 */
      grp:       q('#pnGrp') ? q('#pnGrp').value : null,
      onRows:    qa('#modalB .pnpick__row.is-on').length,       /* 期望 4：勾选没丢 */
      sids:      window.__pnState().sids
    };
    /* 「确定」这条路也要走通，并且：**取消勾选后那一行必须还在**。
       v48 把 d.manual（录进来的 ID）与 d.sids（选中的）拆开就是为了这个 ——
       合成一个数组的话，用户一取消勾选，他刚录的 ID 就从界面上凭空消失了。
       ID 用 S900：档案里不存在（档案是 S001–S075），走的正是「档案外样本」那一支。 */
    q('#modalB [data-pn="sid-new"]').click(); await sleep(240);
    setV('pnSidId', 'S900', 'input');
    setV('pnSidName', 'P900 术中冰冻组织', 'input');
    setV('pnSidType', '组织');
    setV('pnSidSrc', '院内手术室', 'input');
    setV('pnSidDesc', '补登：病理号 B2026-0900，与 S037 同受试者', 'input');
    await sleep(140);
    q('#modalF [data-pn="sid-ok"]').click(); await sleep(280);
    const row900 = () => qa('#modalB .pnpick__row').filter(r => txt(r).indexOf('S900') >= 0);
    R.projWiz.sidEditOk = {
      view:   window.__pnState().view,                         /* wizard */
      sids:   window.__pnState().sids,                         /* 5 */
      rows:   row900().length,                                 /* 1 */
      onRows: qa('#modalB .pnpick__row.is-on').length,          /* 5 */
      meta:   row900().length ? txt(row900()[0].querySelector('.pnpick__meta')) : null
    };
    /* v48：MISS 的 `sidAdd` 是弹窗探针里的旧键，这里改用 sidEdit* 前缀避开重名 ——
       不同字典里同名不会静默覆盖，但读日志的人会认错。 */
    const ck900 = row900().length ? row900()[0].querySelector('input') : null;
    if (ck900) ck900.click(); await sleep(260);
    R.projWiz.sidEditOff = {
      sids:   window.__pnState().sids,                         /* 回到 4 */
      rows:   row900().length,                                 /* 1：行还在 */
      onRows: qa('#modalB .pnpick__row.is-on').length,          /* 4 */
      on900:  row900().length ? !!row900()[0].querySelector('input').checked : null   /* false */
    };
    q('#modalF [data-pn="next"]').click(); await sleep(320);

    /* ---- 第 2 步：选择数据文件（左「已选择的文件」+ 右「个人/团队/系统」三页签）---- */
    R.projWiz.s2 = {
      idx:    stepIdx(),
      cur:    curLabel(),
      done:   qa('#modalB .wiz__i.is-done').length,         /* 期望 1：第 1 步已勾 */
      back:   qa('#modalF [data-pn="back"]').length,        /* 期望 1 */
      tabs:   qa('#modalB .pntab').map(txt),                /* 期望 个人/团队/系统 三个 */
      dirs:   qa('#modalB .pntree__dir').length,
      hasSeq: !!q('#modalB #pnSeq'),
      selPane: txt(q('#modalB .pn2col__l .fld__l'))
    };
    /* 一个文件都不勾 → 下一步必须被拦 */
    q('#modalF [data-pn="next"]').click(); await sleep(240);
    R.projWiz.s2guard = lastToast();
    await clickN('#modalB [data-pn="file-tog"]', 3); await sleep(220);
    R.projWiz.s2pick = {
      files:  window.__pnState().files,
      rows:   qa('#modalB .pnsel__row').length,             /* 左栏「已选择」3 行 */
      header: txt(q('#modalB .pnsel .fld__l'))
    };
    q('#modalF [data-pn="next"]').click(); await sleep(320);

    /* ---- 第 3 步：分组与比较方案（v39 两步合一：两块内容同屏）----
       这一屏上半是分组方案、下半是比较方案，所以「空态」也是两个。 */
    R.projWiz.s3 = { idx: stepIdx(), cur: curLabel(),
                     emptyN: qa('#modalB .pnempty').length,      /* 期望 2：两块各一个 */
                     secs: qa('#modalB .pd__sec').map(txt),
                     foot: qa('#modalF .btn').map(txt) };
    /* 两块都空 → 先拦「分组方案」（提示顺序与屏上的 ① ② 一致） */
    q('#modalF [data-pn="next"]').click(); await sleep(260);
    R.projWiz.s3guard0 = { step: stepIdx(), toast: lastToast() };
    q('#modalB [data-pn="g-new"]').click(); await sleep(280);
    R.projWiz.gOpen = {
      view: window.__pnState().view,                        /* 期望 group：进了子编辑器 */
      name: q('#pnGName') ? q('#pnGName').value : null,
      pool: qa('#pnSampPool [data-pn="g-pick"]').length,    /* 样本池 = 第 1 步选的 4 例 */
      pools: qa('#modalB .pn2col__l .pnpool__i').length,
      /* v48：子编辑器底栏的按钮名单（期望 ['返回','创建']）。三个子编辑器共用
         这条口径 —— 子编辑器里的那颗是「返回」（退回向导本体），
         会关掉整个弹窗的「取消」只应该出现在向导本体的底栏上。 */
      foot: qa('#modalF .btn').map(txt)
    };
    setV('pnGName', 'TreatScheme', 'input');
    /* 规则守卫 ①：分组名必须以字母开头（参考系统 CreateGroup 的校验）。
       注意「分组名称」和「方案名称」是两个字段：前者在＋新增分组的小格里
       （id=pnGNew），后者才是方案名（pnGName）。拿方案名去撞分组名的规则，
       撞到的是另一条错误 —— 本轮真实踩过的坑。 */
    q('#modalB [data-pn="g-add"]').click(); await sleep(220);
    setV('pnGNew', '2bad', 'input');
    q('#modalB [data-pn="g-add-ok"]').click(); await sleep(240);
    R.projWiz.gBadName = lastToast();
    q('#modalB [data-pn="g-add-cancel"]').click(); await sleep(200);
    /* 建两个分组：Treat / Ctrl */
    q('#modalB [data-pn="g-add"]').click(); await sleep(220);
    setV('pnGNew', 'Treat', 'input');
    q('#modalB [data-pn="g-add-ok"]').click(); await sleep(240);
    q('#modalB [data-pn="g-add"]').click(); await sleep(220);
    setV('pnGNew', 'Ctrl', 'input');
    q('#modalB [data-pn="g-add-ok"]').click(); await sleep(260);
    R.projWiz.gGroups = qa('#modalB .pn2col__l .pnpool__i .pnpool__n b').map(txt);
    /* 规则守卫 ②：分组方案名不能为空 */
    setV('pnGName', '', 'input');
    q('#modalF [data-pn="g-ok"]').click(); await sleep(240);
    R.projWiz.gNoName = lastToast();
    setV('pnGName', 'TreatScheme', 'input');
    /* 规则守卫 ③：每组至少 2 例 —— 两个组都还是 0 例，保存必须被拦 */
    q('#modalF [data-pn="g-ok"]').click(); await sleep(240);
    R.projWiz.gNoSamp = lastToast();
    /* 分配样本：当前选中是 Ctrl（下标 1）→ 搬 2 例；再切到 Treat → 搬剩下 2 例 */
    await clickN('#pnSampPool [data-pn="g-pick"]', 2); await sleep(180);
    q('#modalB [data-pn="g-move"]').click(); await sleep(240);
    q('#modalB [data-pn="g-target"][data-i="0"]').click(); await sleep(220);
    /* 样本池会把「已归组的样本」剔掉，所以这第二轮的 2 例必然是剩下那两例 ——
       断「每组 2 例」的同时，也顺带证明了池子确实在收敛。 */
    await clickN('#pnSampPool [data-pn="g-pick"]', 2); await sleep(180);
    q('#modalB [data-pn="g-move"]').click(); await sleep(240);
    R.projWiz.gAssigned = qa('#modalB .pn2col__l .pnpool__n span').map(txt);
    q('#modalF [data-pn="g-ok"]').click(); await sleep(340);
    R.projWiz.s3after = {
      idx:    stepIdx(),
      scheme: window.__pnState().scheme,
      groups: window.__pnState().groups,
      /* v39：第 3 步一屏两块，两块详情同形同类名 —— 必须按 data-pninfo 认块，
         按「第几个」认的话，哪天调一下 ①② 的顺序这条就会静默读错另一个块。 */
      detail: txt(q('#modalB .pninfo[data-pninfo="scheme"]')),
      sel:    qa('#modalB .pnitem[data-pn="scheme-sel"].is-on').length
    };
    /* 分组齐了、比较方案还空着 —— 同一屏上再点「下一步」应当改拦「比较方案」。
       这条是合步之后新出现的边界：两块内容一屏，守卫必须按 ①→② 的顺序报缺。 */
    q('#modalF [data-pn="next"]').click(); await sleep(260);
    R.projWiz.s3guard2 = { step: stepIdx(), toast: lastToast() };

    /* ---- 同一步的下半块：比较方案（对照组 → 处理组）---- */
    R.projWiz.s3plan = {
      idx:    stepIdx(),
      empty:  qa('#modalB .pnempty').length,                  /* 期望 1：只剩比较方案那块空着 */
      secs:   qa('#modalB .pd__sec').map(txt),
      planRow: qa('#modalB [data-pn="p-new"]').length          /* 期望 1：比较方案的 ＋ */
    };
    q('#modalB [data-pn="p-new"]').click(); await sleep(300);
    R.projWiz.pOpen = {
      view:   window.__pnState().view,                      /* 期望 plan */
      name:   q('#pnPName') ? q('#pnPName').value : null,   /* 新建时方案名为空 */
      pairs0: qa('#modalB .pnpair').length,                 /* 期望 0：还没加比较组 */
      empty:  !!q('#modalB .pnempty--sm'),
      foot:   qa('#modalF .btn').map(txt)                   /* v48：期望 ['返回','创建'] */
    };
    /* 规则守卫 ①：一个比较组都没有 → 不许保存（至少一个比较组） */
    setV('pnPName', 'Treat_vs_Ctrl', 'input');
    q('#modalF [data-pn="p-ok"]').click(); await sleep(260);
    R.projWiz.pNone = lastToast();
    /* 加一个比较组：两个下拉的选项来自同一屏上半部分刚建的分组方案（Treat / Ctrl） */
    q('#modalB [data-pn="p-add"]').click(); await sleep(260);
    R.projWiz.pOpen.pairs   = qa('#modalB .pnpair').length;
    R.projWiz.pOpen.opts    = qa('#modalB .pnpair select').length;
    R.projWiz.pOpen.optVals = qa('#modalB .pnpair select')[0]
      ? qa('#modalB .pnpair select')[0].options.length - 1 : -1;
    R.projWiz.pOpen.optTxt  = qa('#modalB .pnpair select')[0]
      ? qa('#modalB .pnpair select')[0].options[1].textContent : null;
    /* 规则守卫 ②：对照组 / 处理组为空 → 不许保存 */
    q('#modalF [data-pn="p-ok"]').click(); await sleep(260);
    R.projWiz.pEmpty = lastToast();
    /* 选：对照组 Ctrl → 处理组 Treat。每次重查一次 DOM（下拉项由状态现渲染） */
    const setSel = async (ix, v) => {
      const s = qa('#modalB .pnpair select')[ix];
      if (!s) return false;
      s.value = v; s.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(120); return true;
    };
    R.projWiz.pPick = [await setSel(0, 'Ctrl'), await setSel(1, 'Treat')];
    await sleep(180);
    q('#modalF [data-pn="p-ok"]').click(); await sleep(340);
    R.projWiz.s3afterPlan = {
      idx:   stepIdx(),
      plan:  window.__pnState().plan,
      pairs: window.__pnState().pairs,
      detail: txt(q('#modalB .pninfo[data-pninfo="plan"]'))
    };

    /* ---- 第 4 步：流程模版（v47 需求 2）----
       这一步与「流程模板」页（p04）的关系是「选择器 vs 编辑器」：
       向导里只有左列表 + 右明细，没有画布。 */
    q('#modalF [data-pn="next"]').click(); await sleep(340);
    R.projWiz.s4 = {
      idx:    stepIdx(),
      cur:    curLabel(),
      done:   qa('#modalB .wiz__i.is-done').length,          /* 期望 3：前三步都勾上 */
      rows:   qa('#modalB .pnlist .pnitem').length,          /* 期望 12：模板库全量 */
      empty:  qa('#modalB .pnempty').length,                 /* 期望 1：还没选，右栏是空态 */
      info:   qa('#modalB .pninfo[data-pninfo="flow"]').length,  /* 期望 0 */
      foot:   qa('#modalF .btn').map(txt)
    };
    /* 一条都不选 → 下一步必须被拦（项目记录的 rn / 流程面板 / 左栏模块清单全靠它） */
    q('#modalF [data-pn="next"]').click(); await sleep(260);
    R.projWiz.s4guard = { step: stepIdx(), toast: lastToast() };
    /* 搜索：只重画列表本体，输入框本身不能被换掉（否则打第二个字就断） */
    setV('pnFlowQ', 'RNA-seq', 'input'); await sleep(240);
    R.projWiz.s4search = {
      rows: qa('#modalB .pnlist .pnitem').length,
      // 输入框还在、值没被冲掉 —— 「只重画列表」这件事只有把输入框一起读回来才断得成
      keep: q('#pnFlowQ') ? q('#pnFlowQ').value : '(null)'
    };
    setV('pnFlowQ', '', 'input'); await sleep(220);
    /* 选系统推荐的那条（f06 差异表达）：与「选分析类型」那五张卡片默认选中项一致。
       ⚠ 这里**不能直接 .find(...).click()** —— 找不到时 undefined.click() 会抛错，
       而这是驱动段，抛一次后面几百条判定一条都看不到（本项目踩过四次）。
       找不到就让它不点，s4pick.flow 为空 → 断言如实变红。 */
    const _f06row = qa('#modalB .pnitem[data-pn="flow-sel"]')
      .find(x => txt(x).indexOf('RNA-seq 完整分析流程') >= 0);
    if (_f06row) _f06row.click();
    await sleep(280);
    R.projWiz.s4pick = {
      flow:  window.__pnState().flow,
      nodes: window.__pnState().nodes,
      sel:   qa('#modalB .pnitem[data-pn="flow-sel"].is-on').length,
      detail: txt(q('#modalB .pninfo[data-pninfo="flow"]')),
      chain: qa('#modalB .pnnodes .pnnodes__i').length
    };
    q('#modalF [data-pn="next"]').click(); await sleep(340);

    /* ---- 第 5 步：参数配置（v47 需求 2）----
       参考基因组**不在这一步**（第 1 步选过，这里只回显）——所以这一步的
       控件里没有参考基因组那一项，改它要去第 1 步。 */
    R.projWiz.s5 = {
      idx:    stepIdx(),
      cur:    curLabel(),
      ctrls:  qa('#pnParamBox [data-pnp]').length,           /* 期望 12：9 个值 + 3 个勾选 */
      selects: qa('#pnParamBox select').length,              /* 期望 5 */
      sum:    txt(q('#modalB #pnParamSum')),
      refInSum: (txt(q('#modalB #pnParamSum')) || '').indexOf('参考基因组') >= 0,
      hasRefCtrl: qa('#pnParamBox [data-pnp="ref"]').length,  /* 期望 0：不重复一遍 */
      checks: qa('#pnParamBox .chk').length,                 /* 期望 3 */
      back:   qa('#modalF [data-pn="back"]').length          /* 期望 1 */
    };
    /* 越界值必须被拦：0 核 / 9999 GB 会让参数快照那一屏看起来像没校验 */
    setV('pnPthreads', '0', 'input'); await sleep(120);
    q('#modalF [data-pn="next"]').click(); await sleep(240);
    R.projWiz.s5guard = { step: stepIdx(), toast: lastToast() };
    setV('pnPthreads', '12', 'input'); await sleep(120);
    /* 改一个值 → 右侧摘要必须立刻跟着变（改完看不见，这一步就是个装饰） */
    setV('pnPpadj', '0.01', 'change'); await sleep(240);
    R.projWiz.s5live = {
      padj: window.__pnState().params.padj,
      sum:  txt(q('#modalB #pnParamSum'))
    };
    /* 「恢复推荐值」恢复的是那份默认对象，不是把当前值抄一遍 */
    q('#modalB [data-pn="param-reset"]').click(); await sleep(280);
    R.projWiz.s5reset = {
      padj: window.__pnState().params.padj,
      sum:  txt(q('#modalB #pnParamSum'))
    };

    /* ---- 第 6 步：创建完成（回执）。v39：进入这一步就已经落库；v47：回执多两行 ---- */
    q('#modalF [data-pn="next"]').click(); await sleep(420);
    R.projWiz.s6 = {
      idx:   stepIdx(),
      cur:   curLabel(),
      made:  window.__pnState().made,                        /* 期望非空：已落库 */
      rows:  qa('#modalB .pninfo__r').map(txt),
      ok:    txt(q('#modalB .pnok')),
      foot:  qa('#modalF .btn').length,                      /* 期望 1：只有「完成」 */
      cards: qa('#projGrid .projcard').length,                /* 期望 14：列表已经多了一条 */
      toast: lastToast()
    };
    /* 「完成」只负责关窗回列表 —— 项目早在进这一步时建好了，
       所以这里断的是「列表里真有它」，不是「点了才建」 */
    q('#modalF [data-pn="done"]').click(); await sleep(440);
    R.projNew = {
      closed:  q('#modal').hidden,
      onProj:  q('#page-proj').classList.contains('is-on'),   /* 期望 true */
      h1:      txt(q('#page-proj .phead__h1')),              /* 期望「项目管理」 */
      toast:   lastToast()
    };
    R.projNew.cards = qa('#projGrid .projcard').length;       /* 期望 14 */
    R.projNew.ids = window.__projState().ids;
    R.projNew.firstId = txt(q('#projGrid .projcard:first-child .projcard__f > span'));
    R.projNew.firstName = txt(q('#projGrid .projcard:first-child .projcard__n'));
    R.projNew.firstCur = q('#projGrid .projcard:first-child').getAttribute('aria-current');
    R.projNew.curCount = qa('#projGrid .projcard[aria-current="true"]').length;
    R.projNew.count = txt(q('#projCount'));
    R.projNew.cur = txt(q('#projCur'));
    /* 新项目的状态必须是「分析中」——刚建完就报「成功」是假状态 */
    R.projNew.status = qa('#projGrid .projcard:first-child .tag').map(txt);
    /* 新建项目的详情：三个关联区块都该是空态而非缺节 */
    q('#projGrid .projcard:first-child [data-proj-open]').click(); await sleep(420);
    R.projNewDetail = {
      name: txt(q('#projName')),
      stats: qa('#projBody .mrow .mcell').map(m => txt(m.querySelector('.mcell__v'))),
      /* 期望 2：样本 / 数据集两块是空态 —— 这一屏只住着「项目详情」这一栏的五个面板。
         另外两处空态（流程没选 / 运行记录为空）在「分析执行」栏里，下面切过去再数。
         v41 前这里数的是全部 7 个面板（4 处空态），分栏之后分母跟着栏走。 */
      empties: qa('#projBody .pd__empty').length,
      /* 光数个数说不清「空的是哪几块」—— 记下每个空态落在哪个面板上 */
      emptyPanels: qa('#projBody .pd__empty').map(e => {
        const pn = e.closest('.pjpanel'); return pn ? pn.getAttribute('data-pdtpanel') : null; }),
      /* 没有运行记录 → 不给「查看项目结果全景」入口（状态驱动，无假交互） */
      pano: qa('#page-projdetail [data-proj-pano]').length,  /* 期望 0 */
      stTxt: txt(q('#projActs .pd__st')),
      emptyTxt: txt(q('#projBody .pd__empty')),
      /* 页头那排角标对新建项目应当全是 0 —— 刚建的项目什么都还没跑 */
      badges: qa('#projBadges .pjbadge').map(b => txt(b.querySelector('b'))),
      /* v47：参数快照面板上的「向导已确认」标签 —— 它是「这一份参数是用户在第 5 步
         点过头的」的可见证据。没有它，参数页看起来和库里的历史项目一模一样。 */
      paramBrand: txt(q('#projBody #pdt-param .tag--brand')),
      onPage: q('#page-projdetail').classList.contains('is-on')
    };
    /* v47：向导第 4 步「流程模版」是必选，所以新建的项目**有**流程（rn = 1）——
       左栏「分析结果」这一组应当有模块可点，模块数 = 主流程节点去掉输入类 + 结果全景。
       「没绑流程」那一支（v41 立的那条）改由 __projNoFlow 探针单独守，见下面。 */
    R.projNewRail = {
      nav:      window.__projDetail().nav,
      navOn:    window.__projDetail().navOn,
      mods:     window.__projDetail().mods,                  /* 期望非空 */
      navMods:  qa('#navBody [data-pdmod]').length,
      none:     txt(q('#navBody .snav__none')),              /* 期望 ''：这一支不该出现 */
      grpOpen:  !q('#pdModList').hidden,
      marks:    qa('#navBody [data-pdmod] .snav__n').length,
      primFlow: window.__projDetail().primFlow
    };
    /* 「分析执行」栏：流程已经选过了（有内容）/ 运行记录仍为空（空态）——
       空态从 2 处减到 1 处，正是「向导里选的那条流程真的写进项目了」的可见证据。 */
    q('#navBody [data-pds="exec"]').click(); await sleep(320);
    R.projNewExec = {
      sec:     window.__projDetail().sec,
      tabTxt:  qa('#projTabs .ptab').map(txt),
      panels:  qa('#projBody .pjpanel').map(b => b.getAttribute('data-pdtpanel')),
      empties: qa('#projBody .pd__empty').length,            /* 期望 1：只剩运行记录为空 */
      emptyPanels: qa('#projBody .pd__empty').map(e => {
        const pn = e.closest('.pjpanel'); return pn ? pn.getAttribute('data-pdtpanel') : null; }),
      emptyTxt: txt(q('#projBody .pd__empty')),
      /* 流程面板从空态变成一张表 —— 光断「有空态/没空态」说不清里面有没有东西 */
      flowRows: qa('#projBody [data-pfl] tr').length
    };
    /* 流程绑上了 → 进「分析结果」直接落在主流程的第一步，而不是一张空页 */
    window.__projDetail(undefined, undefined, 'result'); await sleep(300);
    R.projNewMod = {
      sec:        window.__projDetail().sec,
      steps:      window.__projDetail().steps.length,        /* 期望 >0 */
      stepOn:     window.__projDetail().stepOn,
      modTitle:   window.__projDetail().modTitle,
      modEmpties: window.__projDetail().modEmpties,          /* 期望 2：本步产出 / 本步运行记录 */
      stepsHidden: window.__projDetail().stepsHidden,        /* 期望 false：流程条在 */
      tabsHidden: window.__projDetail().tabsHidden           /* 期望 true：模块页没有页签 */
    };
    q('#navBody [data-pds="info"]').click(); await sleep(280);
    /* 没绑流程那一支：一次调用把左栏 / 分析执行 / 分析结果三处读完（读完自动还原） */
    R.projNoFlow = window.__projNoFlow(); await sleep(340);
    /* 还原之后再看一眼：探针把 flow / rn 摘掉又装回去，这一条证明「装回去了」。
       少了它，探针一旦在 finally 之前抛错，后面所有现算数字会静默漂移。 */
    R.projNoFlowBack = window.__projDetail(); await sleep(200);
    q('#crumbParent').click(); await sleep(340);

    /* ---- v47 需求 3：系统管理 › 项目组管理 ----
       这一页有三件事要证明：① 表里那 7 条与数据同源（不是又写了一张假表）；
       ② 权限真的挡得住（普通成员下「增删改」不可用，而且脚本绕过视觉态也挡得住）；
       ③ 名单是**活的** —— 启用 / 禁用直接改变新建项目第 1 步下拉里能看到几条，
       这才是这一页存在的理由；只顾着自画一张表等于没做。 */
    /* 三个按名字取行的助手。**一律现查**，不缓存节点：renderProjGroups 每次动作
       都整块重画 tbody，缓存下来的节点下一刻就是游离节点 —— 游离节点的 click
       不冒泡到 document，委托收不到，表现为「点了但什么都没发生」
       （向导那一段已经为同一件事踩过一次）。 */
    const pgRowOf = (nm) => qa('#pgBody tr[data-pgrow]')
      .find(r => r.cells[1].textContent.trim() === nm);
    const pgChkOf = (nm) => { const r = pgRowOf(nm); return r ? r.querySelector('[data-pg-check]') : null; };
    const pgSwOf  = (nm) => { const r = pgRowOf(nm); return r ? r.querySelector('[data-pg-on]') : null; };
    const pgRowDelCount = (nm) => { const r = pgRowOf(nm); return r ? r.querySelectorAll('[data-pg-rowdel]').length : -1; };
    goPage('projgroup').click(); await sleep(360);
    R.pgInit = window.__pg();
    /* 创建时间那一列单独读一次：排序三态的断言要有「原序」这条基准线，
       只断「升序有序、降序有序」的话，把排序做成恒升序也能过。 */
    R.pgInit.times = qa('#pgBody tr[data-pgrow]').map(r => r.cells[5].textContent.trim());
    /* 搜索：只重画表格本体，输入框与已输入的值都得还在（与向导第 4 步同一条规矩 ——
       整块重画会把输入框换掉，打第二个字就断）。成员名也要能搜到。 */
    setV('pgQ', '王工', 'input'); await sleep(300);
    R.pgSearch = window.__pg();
    R.pgSearch.keep = q('#pgQ') ? q('#pgQ').value : '(null)';
    /* 刷新：一键把搜索与勾选都清掉（否则「刷新完还剩一半筛选」会让人以为没刷新） */
    const _pgc1 = pgChkOf('肝癌免疫队列'); if (_pgc1) _pgc1.click(); await sleep(240);
    q('#page-projgroup [data-pg-refresh]').click(); await sleep(300);
    R.pgRefresh = window.__pg();
    /* 排序：三态循环（原序 → 创建时间升序 → 降序 → 原序）。
       箭头是内联 SVG，换 class 换不动路径，所以由 renderProjGroups 重画节点 ——
       这里读的 aria-label 就是「按钮上写着的当前方向」，与列表顺序两条一起断。 */
    const _pgSort = () => q('#pgSortBtn [data-pg-sort]');
    const _pgTimes = () => qa('#pgBody tr[data-pgrow]').map(r => r.cells[5].textContent.trim());
    if (_pgSort()) _pgSort().click(); await sleep(280);
    R.pgSortAsc = { aria: _pgSort() ? _pgSort().getAttribute('aria-label') : '', times: _pgTimes() };
    if (_pgSort()) _pgSort().click(); await sleep(280);
    R.pgSortDesc = { aria: _pgSort() ? _pgSort().getAttribute('aria-label') : '', times: _pgTimes() };
    if (_pgSort()) _pgSort().click(); await sleep(260);
    R.pgSortNone = { aria: _pgSort() ? _pgSort().getAttribute('aria-label') : '', times: _pgTimes() };

    /* ③ 名单是活的：禁用「肝脏疾病队列」→ 它退出可选名单，新建项目第 1 步下拉少一项 */
    const _pgSw1 = pgSwOf('肝脏疾病队列'); if (_pgSw1) _pgSw1.click(); await sleep(320);
    R.pgOff = window.__pg();
    window.__projNew(0); await sleep(320);
    R.pgOffGrp = { opts: qa('#modalB #pnGrp option').map(o => o.value).filter(Boolean) };
    window.__pnClose(); await sleep(220);
    /* 启用回来：选项也该回来（只证明「能少」不证明「能恢复」等于没做） */
    goPage('projgroup').click(); await sleep(300);
    const _pgSw2 = pgSwOf('肝脏疾病队列'); if (_pgSw2) _pgSw2.click(); await sleep(320);
    R.pgOn = window.__pg();

    /* ② 权限：切到「普通用户」→ 勾选框 / 启停开关都禁用、操作列变成「只读」、
       工具条上的「删除」置为 aria-disabled、页脚改口径说明谁才能改。
       v54：页头那个三档身份开关撤了 —— 身份只有顶栏一处入口，所以这里走
       window.__role()（= 点顶栏菜单切角色），而不是点本页的按钮。 */
    window.__role('user'); await sleep(340);
    R.pgMember = window.__pg();
    R.pgMemberEdits = qa('#pgBody [data-pg-edit]').length;   /* 期望 0 */
    R.pgMemberDels  = qa('#pgBody [data-pg-rowdel]').length; /* 期望 0 */
    R.pgMemberReadOnly = qa('#pgBody .pgop').length;         /* 期望 0 */
    R.pgMemberWho = txt(q('#pgWho'));                        /* 页头只读徽标 */
    /* 委托分支里那道 self-guard 也得验：工具条那颗「删除」只是 aria-disabled，
       脚本照样点得动 —— 它必须给出理由，而不是默默不动（这就是「绕过视觉态」）。 */
    q('#page-projgroup [data-pg-del]').click(); await sleep(280);
    R.pgMemberDel = { toast: lastToast(), modalOpen: !q('#modal').hidden };
    /* 「创建项目组」在只读身份下是**真 disabled**（不是只换个样式）：
       合成一次点击，弹窗不许开。 */
    (function () {
      var nb = q('#page-projgroup [data-pg-new]');
      if (nb) nb.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    })();
    await sleep(300);
    R.pgMemberNew = { modalOpen: !q('#modal').hidden, toast: lastToast() };
    /* 普通管理员也能改（v54 口径：超级管理员与普通管理员都能治理项目组） */
    window.__role('admin'); await sleep(320);
    R.pgLead = window.__pg();
    R.pgLeadWho = txt(q('#pgWho'));
    window.__role('super'); await sleep(320);

    /* ④ 增：新建一个项目组。新组一律「待审核」—— 自己说自己通过等于没有审核这一环。 */
    q('#page-projgroup [data-pg-new]').click(); await sleep(320);
    R.pgNewOpen = {
      title: txt(q('#modalT')),
      chips: qa('#pgMemList .pgchip').length,            /* 期望 0：新组没有成员 */
      empty: txt(q('#pgMemList')),
      canWrite: window.__pg().canWrite
    };
    /* 守卫 ①：名称为空 → 拦；守卫 ②：名称有了但一个成员都没有 → 也要拦 */
    q('[data-pg-save]').click(); await sleep(280);
    R.pgNewG1 = lastToast();
    setV('pgName', '验证项目组', 'input');
    q('[data-pg-save]').click(); await sleep(280);
    R.pgNewG2 = lastToast();
    /* 成员：加一个 → 重复加被拦 → 再加一个 → 删掉一个 */
    setV('pgMem', '王工', 'input');
    q('[data-pg-memadd]').click(); await sleep(260);
    R.pgMem1 = { chips: qa('#pgMemList .pgchip').length, input: q('#pgMem') ? q('#pgMem').value : '(null)' };
    setV('pgMem', '王工', 'input');
    q('[data-pg-memadd]').click(); await sleep(280);
    R.pgMemDup = { chips: qa('#pgMemList .pgchip').length, toast: lastToast() };
    setV('pgMem', '陈铭', 'input');
    q('[data-pg-memadd]').click(); await sleep(260);
    qa('#pgMemList [data-pg-memdel]')[0].click(); await sleep(260);
    R.pgMem2 = {
      chips: qa('#pgMemList .pgchip').length,
      names: qa('#pgMemList .pgchip').map(x => x.textContent.trim())
    };
    /* 守卫 ③：重名 —— 同名两个组会让「所属项目组」下拉里出现两条一模一样的选项，
       之后就再也说不清哪个项目属于哪个。 */
    setV('pgName', '肝癌免疫队列', 'input');
    q('[data-pg-save]').click(); await sleep(280);
    R.pgDup = lastToast();
    setV('pgName', '验证项目组', 'input');
    /* 弹窗一关，PG_EDIT 必须置空 —— 否则下次点「创建」会带着上次的草稿 */
    q('[data-pg-cancel]').click(); await sleep(240);
    R.pgNewCancel = { modalOpen: !q('#modal').hidden, n: window.__pg().n };
    q('#page-projgroup [data-pg-new]').click(); await sleep(300);
    R.pgNewClean = { name: q('#pgName') ? q('#pgName').value : '(null)', chips: qa('#pgMemList .pgchip').length };
    setV('pgName', '验证项目组', 'input');
    setV('pgMem', '王工', 'input');
    q('[data-pg-memadd]').click(); await sleep(240);
    q('[data-pg-save]').click(); await sleep(400);
    R.pgAdded = window.__pg();

    /* ⑤ 删：只有「已驳回」能删。
       先勾一个「已通过」的点工具条删除 → 必须被挡（并且说清为什么）。 */
    const _pgc2 = pgChkOf('肝癌免疫队列'); if (_pgc2) _pgc2.click(); await sleep(280);
    R.pgSel1 = { selTxt: txt(q('#pgSel')), delAria: q('#pgDel').getAttribute('aria-disabled') };
    q('#page-projgroup [data-pg-del]').click(); await sleep(300);
    R.pgDelGuard = { toast: lastToast(), modalOpen: !q('#modal').hidden };
    /* 行内「删除」只出现在已驳回那一行 —— 「可删」这件事是逐行判定的，不是一页一个开关 */
    R.pgRowDel = {
      reject: pgRowDelCount('横向课题协作组'),
      pass:   pgRowDelCount('肝癌免疫队列'),
      pending: pgRowDelCount('肠道微生物组')
    };
    const _pgRjRow = pgRowOf('横向课题协作组');
    if (_pgRjRow) { const b = _pgRjRow.querySelector('[data-pg-rowdel]'); if (b) b.click(); }
    await sleep(320);
    R.pgDelOpen = { title: txt(q('#modalT')), items: qa('#modalB .pgdelist li').map(txt) };
    q('[data-pg-del-ok]').click(); await sleep(420);
    R.pgDeleted = window.__pg();
    R.pgDeletedRow = qa('#pgBody tr[data-pgrow]').length;
    /* 收尾：身份复位、排序复位、搜索与勾选清空 —— 后面的截图要的是默认长相 */
    window.__pg({ role: 'super', sort: 0, q: '', sel: [] }); await sleep(300);

    /* 分享：链接含项目编号且**确定性**（改有效期不许换链接） */
    q('[data-proj-share]').click(); await sleep(280);
    R.projShare = {
      open: !q('#modal').hidden,
      title: txt(q('#modalT')),
      url: txt(q('#shareUrl')),
      days: qa('#modalB [data-share-days]').length,     /* 期望 3 */
      roles: qa('#modalB [data-share-role]').length,    /* 期望 3 */
      dayOn: txt(q('#modalB [data-share-days].is-on')),
      roleOn: txt(q('#modalB [data-share-role].is-on')),
      members: qa('#modalB .tbl tbody tr').length,      /* 期望 3 */
      copyInline: !!q('#modalB [data-share-copy]'),
      done: !!q('#modalF [data-share-done]')
    };
    q('#modalB [data-share-days="30"]').click(); await sleep(240);
    R.projShareDay = {
      dayOn: txt(q('#modalB [data-share-days].is-on')),
      urlSame: txt(q('#shareUrl')) === R.projShare.url,   /* 期望 true */
      roleOn: txt(q('#modalB [data-share-role].is-on'))
    };
    q('#modalB [data-share-role="可评论"]').click(); await sleep(240);
    R.projShareRole = {
      roleOn: txt(q('#modalB [data-share-role].is-on')),
      dayOn: txt(q('#modalB [data-share-days].is-on')),
      urlSame: txt(q('#shareUrl')) === R.projShare.url
    };
    q('#modalF [data-share-done]').click(); await sleep(260);
    R.projShareCopy = { closed: q('#modal').hidden, toast: txt(qa('.toast').slice(-1)[0]) };

    /* 智能体数字必须跟着新建走：写死「13 个项目」的话这里会露馅。
       v53：会话唯一宿主是主页问答卡，读 #wbAgentBody。 */
    goPage('p01').click(); await sleep(200);
    q('[data-ask="查看项目"]').click(); await sleep(760);
    R.projAgent = { body: txt(q('#wbAgentBody')) };

    /* v28：项目管理页左栏默认展开，但点收起按钮仍要能收、再点能展开。
       测完用 __rail(true, true) 解锁 RAIL_LOCK，避免用户手势锁死后续自动收放。 */
    goPage('proj').click(); await sleep(300);
    q('[data-rail-toggle]').click(); await sleep(280);
    R.projRailToggle = {
      offAfterClick: !!q('.shell.is-railoff'),
      appOff: q('.app').classList.contains('is-railoff'),
      expanded: q('[data-rail-toggle]').getAttribute('aria-expanded')
    };
    q('[data-rail-toggle]').click(); await sleep(280);
    R.projRailToggle.onAfterClick = !q('.shell.is-railoff');
    R.projRailToggle.snavVis = getComputedStyle(q('.snav')).display !== 'none';
    window.__rail(true, true); await sleep(120);
    R.projRailToggle.unlockedOn = !q('.shell.is-railoff');

    /* 收尾必须回 p04：下面「编排区」那组用例是在「p04 可见」的前提下量的
       （orchFull 量的是 #orch 的实际像素宽，中途切走会量到 0×0，
        表现为「画布没变宽 / 没铺满视口 / 没垂直居中」三条同时挂）。
       v50 需求 4：p04 不在菜单里了，改走直达入口（goPage 会返回 null）。 */
    window.__goRaw('p04'); await sleep(260);

    /* ---- p04 内嵌流程编排：流程模板 → DAG 画布 ---- */
    R.orch = {
      insideP04: !!q('#page-p04 #orch'),          /* 编排区就在 p04 里，不另开页 / 标签 */
      mode:      txt(q('#orch .seg__b.is-on')),
      flows:     qa('#orchList .wfitem').length,  /* 期望 12 */
      /* 置顶只改顺序、不改集合：前两条必须是蛋白组（f12）与代谢组（f07）。
         量 data-flow 而不是名字 —— 名字里带全角括号与「+」，比 id 脆。 */
      topFlows:  qa('#orchList .wfitem').slice(0, 2).map(c => c.getAttribute('data-flow')),
      name:      txt(q('#orchName')),
      stat:      txt(q('#orchStat')),
      steps:     qa('#orchCanvas .dagstep').length,   /* DAG 节点块数 */
      rects:     qa('#orchCanvas .dagwrap rect').length,
      arrow:     !!q('#orchCanvas #dagArrow'),
      legend:    qa('#orchCanvas .daglg span').length,   /* 期望 3 */
      altBtn:    !!q('[data-orch-alt]'),
      pageCount: qa('.page').length                 /* v51 起 17 页：智能分析补上第 5 步「查看分析结果」 */
    };
    /* 统计条与图必须同源：节点数标签 == 画布里实际画的节点块数 */
    const nodeTag = (txt(q('#orchStat')).match(/(\d+)\s*节点/) || [])[1];
    R.orchStat = { nodeTag: nodeTag ? parseInt(nodeTag, 10) : null,
                   steps: qa('#orchCanvas .dagstep').length };
    R.orchStat.sumOk = R.orchStat.nodeTag === R.orchStat.steps;

    /* 流程节点必须是纯展示元素：带 role / tabindex 却没有处理器 = 假按钮 */
    R.dagSem = {
      total:    qa('#orchCanvas .dagstep').length,
      role:     qa('#orchCanvas .dagstep[role]').length,
      tabindex: qa('#orchCanvas .dagstep[tabindex]').length
    };

    /* 换一条流程：画布、统计、选中态都要跟着走 */
    const f2 = qa('#orchList .wfitem').filter(c => c.getAttribute('data-flow') === 'f06')[0];
    if (f2) f2.click(); await sleep(240);
    R.orchPick = { id: 'f06', name: txt(q('#orchName')),
                   steps: qa('#orchCanvas .dagstep').length,
                   on: qa('#orchList .wfitem[aria-current="true"]').length };

    /* DAG 数据表替代视图（无障碍：图形必须有文本等价物） */
    q('[data-orch-alt]').click(); await sleep(220);
    R.dagAlt = { hidden: q('#orchTable').hidden, rows: qa('#orchTable tbody tr').length,
                 expanded: q('[data-orch-alt]').getAttribute('aria-expanded') };
    q('[data-orch-alt]').click(); await sleep(160);

    /* ---- 编排区全屏（v60：全屏里进的是外部编排系统，站内画布可切回） ----
       只改 position 不改宽度就是「假全屏」，所以这里同时量画布宽度。
       注意量的时机：全屏后 .orch__b 被外部系统收起来了，此时量画布必然是 0 ——
       得先点「返回站内画布」把画布换回来，再量它是不是真的变宽了。 */
    const _svg0 = q('#orchCanvas .dagwrap svg');
    R.orchFull = {
      hasBtn:  !!q('[data-orch-full]'),
      off:     !q('#orch').classList.contains('is-full'),
      pressed: q('[data-orch-full]').getAttribute('aria-pressed'),
      label:   txt(q('[data-orch-full]')),
      w0:      _svg0 ? Math.round(_svg0.getBoundingClientRect().width) : 0
    };
    /* v60：进编排页时**不该**已经挂着外部系统 —— 默认还是站内画布，
       外部系统是点全屏才进的分支。 */
    R.orchFull.idleExt = window.__orchExt();
    q('[data-orch-full]').click(); await sleep(320);
    const _r1 = q('#orch').getBoundingClientRect();
    R.orchFull.on        = q('#orch').classList.contains('is-full');
    R.orchFull.bodyLock  = document.body.classList.contains('is-orchfull');
    R.orchFull.position  = getComputedStyle(q('#orch')).position;
    R.orchFull.pressedOn = q('[data-orch-full]').getAttribute('aria-pressed');
    R.orchFull.labelOn   = txt(q('[data-orch-full]'));
    R.orchFull.box       = Math.round(_r1.width) + 'x' + Math.round(_r1.height);
    R.orchFull.vp        = window.innerWidth + 'x' + window.innerHeight;
    R.orchFull.coversVp  = Math.round(_r1.width) === window.innerWidth
                           && Math.round(_r1.height) === window.innerHeight;
    /* v60：全屏里外部编排系统真的接管了（iframe 挂上地址 + 站内画布收起）。
       **不判「iframe 加载成功」** —— 目标地址能否达取决于跑回归的机器有没有接
       那个网络，那是环境不是缺陷，写进断言等于埋一颗「换台机器就红」的雷。 */
    R.orchFull.extOn = window.__orchExt();
    /* iframe 必须**真的占满全屏区**，否则是「挂上了但缩在角落」。
       注意判据不是「iframe 高度 == 容器高度」—— bar 与 iframe 是并列的 flex 子项，
       iframe 天然矮一个 bar 的高度（这里是 45px）。要比的是**它吃掉了 bar 之外的
       全部剩余空间**，且紧贴在 bar 下方不留缝。 */
    R.orchFull.extFill = (function () {
      var el = q('[data-orchextel]'), box = q('#orchExt'), bar = q('.orchext__bar');
      if (!el || !box || !bar) return null;
      var a = el.getBoundingClientRect(), b = box.getBoundingClientRect(), r = bar.getBoundingClientRect();
      var gap = Math.round(a.top - r.bottom);
      var slack = Math.round(b.bottom - a.bottom);
      return { ih: Math.round(a.height), rest: Math.round(b.height - r.height),
               gap: gap, slack: slack, vh: window.innerHeight,
               /* iframe 高 ≈ 容器高 − bar 高（差 2px 给边框），紧贴 bar、底部无余量，
                  且高度吃满视口的绝大部分 —— 三条合起来才排除「缩在角落」。 */
               ok: Math.abs(a.height - (b.height - r.height)) <= 2
                   && Math.abs(gap) <= 2 && Math.abs(slack) <= 2
                   && a.height >= window.innerHeight * 0.9 };
    })();
    /* 切回站内画布：仍保持全屏（这才是「画布放大」那条能力） */
    q('[data-orchext-back]').click(); await sleep(260);
    const _svg1 = q('#orchCanvas .dagwrap svg');
    R.orchFull.backLabel  = txt(q('[data-orch-full]'));
    R.orchFull.backStill  = q('#orch').classList.contains('is-full');
    R.orchFull.backExt     = window.__orchExt();
    R.orchFull.w1         = _svg1 ? Math.round(_svg1.getBoundingClientRect().width) : 0;
    R.orchFull.grew       = R.orchFull.w1 > R.orchFull.w0;
    /* DAG 宽而扁，铺满宽度后高度还剩大半 —— 断言「图 + 图例」这一组是垂直居中的，
       否则顶部对齐会在下方留一大块空白，看着像没做完。 */
    R.orchFull.vCenter = (function () {
      var cv = q('#orchCanvas'), dw = q('#orchCanvas .dagwrap'), lg = q('#orchCanvas .daglg');
      if (!cv || !dw || !lg) return null;
      var cs = getComputedStyle(cv), r = cv.getBoundingClientRect();
      var above = Math.round(dw.getBoundingClientRect().top - r.top - parseFloat(cs.paddingTop));
      var below = Math.round(r.bottom - parseFloat(cs.paddingBottom) - lg.getBoundingClientRect().bottom);
      return { above: above, below: below, ok: above > 0 && below > 0 && Math.abs(above - below) <= 24 };
    })();
    /* 全屏里仍要能调出工具配置：层级不能盖住抽屉 */
    R.orchFull.drawerAbove = (function () {
      var b = q('#backTool'); if (!b) return null;
      b.hidden = false;
      var z = getComputedStyle(b).zIndex, my = getComputedStyle(q('#orch')).zIndex;
      b.hidden = true;
      return { back: z, orch: my, ok: parseInt(z, 10) > parseInt(my, 10) };
    })();
    /* Esc 收起 */
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(300);
    R.orchFull.offAfterEsc    = !q('#orch').classList.contains('is-full');
    R.orchFull.unlockAfterEsc = !document.body.classList.contains('is-orchfull');
    R.orchFull.pressedOff     = q('[data-orch-full]').getAttribute('aria-pressed');
    R.orchFull.labelOff       = txt(q('[data-orch-full]'));
    /* 收起后外部系统必须让位给站内画布 —— 否则下次进编排页是块白板 */
    R.orchFull.afterEsc = window.__orchExt();
    /* 全屏状态下跳页必须自动收起，否则它会盖住新页面 */
    q('[data-orch-full]').click(); await sleep(200);
    R.orchFull.navExtBefore = window.__orchExt();
    window.__goRaw('p04'); await sleep(220);
    R.orchFull.exitOnNav = !q('#orch').classList.contains('is-full');
    R.orchFull.navClean  = !document.body.classList.contains('is-orchfull');
    R.orchFull.navExt    = window.__orchExt();

    /* ---- v21 「自编排流程」节：卡片 / 标题 / 画布默认来源 ----
       画布不再是「某条内置流程的只读预览」，而是一份草稿：
       载入模板给它初值，点工具库里的工具往末尾接节点。
       「跨组学对齐」那张静态卡只做说明、点不动（它没有 data-pipe，也不进画布），
       连同没有对应流程的空白一起撤掉；对齐视图本身留在结果页，不受影响。 */
    R.p04sec = {
      title:    txt(q('#page-p04 .sechd--sub .sechd__t')),
      cards:    qa('#pipelineGrid .pcard').map(c => txt(c.querySelector('.pcard__n'))),
      onCard:   txt(q('#pipelineGrid .pcard.is-on .pcard__n')),
      /* 画布默认那条流程的名字，必须与上面 is-on 的卡片是同一条 */
      canvasName: txt(q('#orchName')),
      canvasSteps: qa('#orchCanvas .dagstep').length
    };
    /* 换分析类型 → 画布跟着换（原先这里只换高亮，画布固定停在某一条上） */
    q('#pipelineGrid .pcard[data-pipe="variant"]').click(); await sleep(280);
    R.p04follow = {
      on:    txt(q('#pipelineGrid .pcard.is-on .pcard__n')),
      name:  txt(q('#orchName')),
      steps: qa('#orchCanvas .dagstep').length,
      first: (function () { const g = q('#orchCanvas .dagstep');
               const t = g ? g.querySelectorAll('text') : [];
               return t.length > 1 ? txt(t[1]) : '(null)'; })(),
      sel:   qa('#orchList .wfitem[aria-current="true"]').length
    };

    /* ---- v21 画布编辑器形态 ----
       基线显式选一条短流程（f11 功能富集，5 节点），否则量到的会是上一步留下的状态。 */
    const _f11 = qa('#orchList .wfitem').filter(c => c.getAttribute('data-flow') === 'f11')[0];
    if (_f11) _f11.click(); await sleep(250);
    R.editBase = {
      name:    txt(q('#orchName')),
      steps:   qa('#orchCanvas .dagstep').length,
      links:   qa('#orchCanvas .dagwrap path[marker-end]').length,
      /* 节点卡三段：序号圈 / 图标 / 名称 */
      circles: qa('#orchCanvas .dagstep circle').length,
      icons:   qa('#orchCanvas .dagstep svg').length,
      texts:   qa('#orchCanvas .dagstep text').length,
      /* 图标必须真的占像素 —— 嵌进外层 svg 的 <svg> 少了 x/y/width/height
         会以 0×0 渲染：DOM 里数得到 7 个，屏幕上什么都没有。 */
      iconBox: (function () {
        const s = q('#orchCanvas .dagstep svg'); if (!s) return [0, 0];
        const b = s.getBoundingClientRect();
        return [Math.round(b.width), Math.round(b.height)];
      })(),
      /* FAI 里存的是完整 <path …> 标记；再包一层 <path d="…"> 会把属性截断，
         余下的 "/> 会当成文字漏到画布上（节点名前多一坨）。 */
      stray:   qa('#orchCanvas .dagstep').filter(g => txt(g).indexOf('"/>') >= 0).length,
      /* v37 需求 5：右下角缩略图整块删掉。这里改成「它不在」的反向守卫 ——
         只删 DOM、CSS 留着，下次有人照旧样式再挂一个 div 就复活了，
         所以同时断「元素不存在」与「预留的网格列也收掉了」。 */
      mini:    !!q('#orchCanvas .dagmini'),
      miniRects: qa('#orchCanvas .dagmini rect').length,
      miniCss: (function () {
        const d = q('#orchCanvas .dagwrap');
        return d ? getComputedStyle(d).gridTemplateColumns.split(' ').length : -1;
      })(),
      foot: { save: txt(q('[data-orch-save]')), run: txt(q('[data-orch-run]')),
              reset: txt(q('[data-orch-reset]')), hint: txt(q('#orchHint')) },
      /* 「用这个流程」搬到底部了，卡头不该再留一个同义按钮 */
      barHasUse: !!q('#orch .orch__bar [data-go="p05"]')
    };

    /* 点工具库里的工具 → 画布末尾 +1 节点、连线 +1，并打开该工具的参数配置 */
    q('[data-orchseg="tools"]').click(); await sleep(240);
    const _tname = q('#orchList .titem').getAttribute('data-tool');
    q('#orchList .titem').click(); await sleep(330);
    R.editAppend = {
      tool:    _tname,
      steps:   qa('#orchCanvas .dagstep').length,
      links:   qa('#orchCanvas .dagwrap path[marker-end]').length,
      lastLabel: (function () {
        const gs = qa('#orchCanvas .dagstep'); if (!gs.length) return '(null)';
        const t = gs[gs.length - 1].querySelectorAll('text');
        return t.length > 1 ? txt(t[1]) : '(null)';
      })(),
      /* 图上截断了名字，但「节点列表」里必须是全名 —— 截断不能等于丢信息 */
      tblLast: (function () {
        const rs = qa('#orchTable tbody tr'); if (!rs.length) return '(hidden)';
        return txt(rs[rs.length - 1].cells[1]);
      })(),
      stat:    txt(q('#orchStat')),
      hint:    txt(q('#orchHint')),
      drawerOn: !q('#drawerTool').hidden
    };
    q('[data-close="tool"]').click(); await sleep(220);

    /* 重置：撤掉自编排的节点，回到模板原样 */
    q('[data-orch-reset]').click(); await sleep(260);
    R.editReset = { steps: qa('#orchCanvas .dagstep').length, hint: txt(q('#orchHint')) };

    /* 另存为新模板（v37 需求 4）：点「保存为自定义流程」不再直接固化，
       而是先弹一个填名字的框 —— 「保存后列表里会多出哪一条」用户得先看见。
       所以这里要走完整三步：点保存 → 弹框（含节点清单）→ 填名 → 确认。 */
    q('[data-orchseg="tools"]').click(); await sleep(220);
    qa('#orchList .titem')[0].click(); await sleep(280);
    q('[data-close="tool"]').click(); await sleep(200);
    q('[data-orchseg="flows"]').click(); await sleep(200);
    const _flBefore2 = qa('#orchList .wfitem').length;
    q('[data-orch-save]').click(); await sleep(320);
    /* ① 弹框先开着：名称有默认建议、节点逐个列出来（数量 = 画布当前节点数） */
    const _fm = {
      open:      !q('#modal').hidden,
      title:     txt(q('#modalT')),
      sug:       q('#flowNewName') ? q('#flowNewName').value : '',
      nodes:     qa('#modalB .tempnodes > span').length,
      nodesTxt:  qa('#modalB .tempnodes > span').map(txt).slice(0, 2),
      steps:     qa('#orchCanvas .dagstep').length,
      inModal:   !!q('#flowNewName')
    };
    /* ② 名称清空后确认 → 必须拦下来（不能把无名流程塞进列表） */
    q('#flowNewName').value = '';
    q('[data-flow-save-ok]').click(); await sleep(240);
    _fm.blockedToast = lastToast();
    _fm.blockedList  = qa('#orchList .wfitem').length;
    _fm.stillOpen    = !q('#modal').hidden;
    /* ③ 填上名字再确认 → 这次真的另存成功 */
    q('#flowNewName').value = 'RNA-seq 完整分析流程（自编排 6 步）';
    q('#flowNewDesc').value = '在 f11 功能富集上接了一步差异筛选';
    q('[data-flow-save-ok]').click(); await sleep(320);
    R.editSave = {
      saveDlg:  _fm,
      before:   _flBefore2,
      after:    qa('#orchList .wfitem').length,
      selected: qa('#orchList .wfitem[aria-current="true"]').length,
      name:     (function () { const a = q('#orchList .wfitem[aria-current="true"]');
                 return a ? txt(a.querySelector('.wfitem__n')) : '(null)'; })(),
      steps:    qa('#orchCanvas .dagstep').length,
      modalClosed: q('#modal').hidden,
      listHas:  qa('#orchList .wfitem').map(t => txt(t.querySelector('.wfitem__n'))),
      flowNames: window.__flowNames().slice(-1)[0] || '',
      toast:    lastToast()
    };
    /* 「编排来源」的分段回到流程模板，后面几段（工具库探针）依赖它自己再切 */
    q('[data-orchseg="flows"]').click(); await sleep(180);

    /* v37 需求 4 后半：改过的流程点「运行此流程」必须先弹提醒（不能悄悄按画布跑）。
       链路四段都要走：拦下 → 返回继续编辑 → 再运行 → 「保存为新模板并运行」转进另存框。
       注意节点表的删除按钮属性是 data-node-del（历史上曾写错成 data-orch-del，
       选择器失效会让「改一步」这一下静默落空，后面整段就退化成「运行本来就该放行」）。 */
    qa('#orchList .wfitem')[0].click(); await sleep(280);
    const _rgBase = qa('#orchCanvas .dagstep').length;
    q('[data-node-del="0"]').click(); await sleep(240);
    const _rgSteps = qa('#orchCanvas .dagstep').length;
    const _rgFlows = qa('#orchList .wfitem').length;
    q('[data-orch-run]').click(); await sleep(300);
    R.orchRun = {
      base:   _rgBase,
      steps:  _rgSteps,                                 /* 期望 base-1：改这一步真的生效了 */
      page:   qa('.page.is-on')[0].id,                  /* 期望 page-p04：没放行到 p05 */
      open:   !q('#modal').hidden,
      title:  txt(q('#modalT')),
      btns:   qa('#modalF button').map(txt),
      saysNew: (q('#modalB') || { textContent: '' }).textContent.indexOf('另存为一条新模板') >= 0,
      saveRunBtn: !!q('[data-orch-save-run]'),
      flows:  qa('#orchList .wfitem').length            /* 期望与 _rgFlows 相同：还没保存 */
    };
    R.orchRun.flowsSame = R.orchRun.flows === _rgFlows;
    /* 「返回继续编辑」= 收框、留在本页、画布原样（改动不丢也不落库） */
    q('#modalF button[data-close="modal"]').click(); await sleep(240);
    R.orchRun.back = {
      open:  !q('#modal').hidden,
      page:  qa('.page.is-on')[0].id,
      steps: qa('#orchCanvas .dagstep').length          /* 期望仍是 base-1 */
    };
    /* 再运行 → 点「保存为新模板并运行」→ 应转进「另存为新模板」框（先保存才放行） */
    q('[data-orch-run]').click(); await sleep(280);
    q('[data-orch-save-run]').click(); await sleep(320);
    R.orchRun.afterSaveRun = {
      modal:   txt(q('#modalT')),
      hasName: !!q('#flowNewName'),
      page:    qa('.page.is-on')[0].id                 /* 期望仍 page-p04：还没跑到 p05 */
    };
    q('#modalF button[data-close="modal"]').click(); await sleep(220);
    /* 收尾：撤回这一步改动，把画布还原成模板原样，别把脏状态带给后面几段 */
    q('[data-orch-reset]').click(); await sleep(240);
    R.orchRun.clean = { steps: qa('#orchCanvas .dagstep').length, dirty: !!q('#orchHint').textContent };

    /* ---- 编排区里的工具库：9 分类 / 54 工具 ---- */
    q('[data-orchseg="tools"]').click(); await sleep(230);
    R.orchTools = {
      cats:  qa('#orchList .tcat').length,        /* 期望 9 */
      tools: qa('#orchList .titem').length,       /* 期望 54 */
      icons: qa('#orchList .titem .titem__i').length,   /* v34 期望 54：每个工具带图标 */
      net:   qa('#orchList .netentry').length,    /* 期望 1：内置网络图入口 */
      emptyCats: qa('#orchList .tcat[data-empty="1"]').map(c => txt(c.querySelector('.tcat__h'))),  /* 空类目要显式呈现 */
      emptyNote: qa('#orchList .tcat[data-empty="1"] .tempty').length,
      mode:  txt(q('#orch .seg__b.is-on')),
      ph:    q('#orchSrch').placeholder,
      srchIco: !!q('.orch__srch .isrch__i')       /* v34：搜索框带放大镜图标 */
    };
    /* 分类可折叠 */
    const catH = q('#orchList .tcat__h');
    catH.click(); await sleep(180);
    R.toolCatFold = { expanded: catH.getAttribute('aria-expanded'),
                      hidden: q('#orchList .tcat__l').hidden };
    catH.click(); await sleep(160);

    /* 搜索过滤 */
    q('#orchSrch').value = 'hisat2';
    q('#orchSrch').dispatchEvent(new Event('input', { bubbles: true })); await sleep(200);
    R.toolSearch = { cats: qa('#orchList .tcat').length, tools: qa('#orchList .titem').length };
    q('#orchSrch').value = '';
    q('#orchSrch').dispatchEvent(new Event('input', { bubbles: true })); await sleep(180);
    R.toolSearchReset = { tools: qa('#orchList .titem').length };

    /* 点工具 → 配置抽屉（集合 fan-out / 单双端 / 命令预览）；不开页面、不占标签 */
    const t1 = q('#orchList .titem'), t1n = t1.getAttribute('data-tool');
    t1.click(); await sleep(320);
    const dr = q('#drawerTool');
    R.toolOpen = {
      name:      t1n,
      drawerOn:  !dr.hidden,
      backOn:    !q('#backTool').hidden,
      title:     txt(q('#toolT')),
      tag:       txt(q('#toolTag')),
      h1:        txt(dr.querySelector('.phead__h1')),
      cmdFrag:   dr.querySelectorAll('.cmdbox .k').length,   /* 命令预览里高亮出的参数 */
      cmdText:   txt(dr.querySelector('.cmdbox')).slice(0, 56),
      markOn:    qa('#orchList .titem[aria-current="true"]').length,   /* 期望 1 */
      pageCount: qa('.page').length,                          /* 期望 17：抽屉不是页面 */
      noTab:     qa('.wtab').length                           /* 期望 0 */
    };
    /* 抽屉里的 paired / single 分段：配置摘要必须跟着变 */
    const sumBefore2 = txt(dr.querySelector('#tp-sum'));
    dr.querySelector('.seg__b:not(.is-on)').click(); await sleep(190);
    R.toolSummary = {
      rows:     dr.querySelectorAll('#tp-sum .cfgrow').length,          /* 期望 6 */
      inputs:   sumBefore2.indexOf('test1') >= 0,
      libType:  txt(dr.querySelector('#tp-sum .cfgrow:nth-child(2) .cfgrow__v')),
      read2:    txt(dr.querySelector('#tp-sum .cfgrow:nth-child(4) .cfgrow__v')),
      read2Off: dr.querySelector('#tp-sum .cfgrow:nth-child(4) .cfgrow__v').classList.contains('is-off')
    };
    dr.querySelector('.seg__b:not(.is-on)').click(); await sleep(150);
    q('[data-close="tool"]').click(); await sleep(240);
    R.toolDrawerClosed = q('#drawerTool').hidden && q('#backTool').hidden;

    /* 网络图入口挂在「工具库」首位（左栏改成分组导航后它没了归属），
       所以必须在切回「流程模板」之前点它 */
    q('[data-netgraph]').click(); await sleep(300);
    R.netgraph = { drawerOn: !q('#drawerTool').hidden, title: txt(q('#toolT')),
                   cmdK: qa('#drawerTool .cmdbox .k').length };
    q('[data-close="tool"]').click(); await sleep(240);
    q('[data-orchseg="flows"]').click(); await sleep(180);

    /* ---- 运行历史抽屉：默认收起 → 展开 → 刷新 → 关闭 ---- */
    R.hist = { items: qa('#histBody .hitem').length, tags: qa('#histBody .hitem .tag').length,
               bars: qa('#histBody .hitem .bar').length, top: txt(q('#histBody .hitem')).slice(0, 40) };
    q('[data-hist-toggle]').click(); await sleep(280);
    R.histDrawer = { open: !q('#histDrawer').hidden, back: !q('#backHist').hidden,
                     expanded: q('[data-hist-toggle]').getAttribute('aria-expanded'),
                     onScreen: vis(q('#histDrawer')) };
    q('[data-hist-refresh]').click(); await sleep(200);
    R.histRefresh = qa('#histBody .hitem').length;
    q('[data-close="hist"]').click(); await sleep(240);
    R.histDrawerClosed = q('#histDrawer').hidden && q('#backHist').hidden;

    /* 跨面板一致性（改前这里是硬编码：编排区把 f09 标「运行中」，
       而运行历史里在跑的是 fastp 单工具、RNA-seq 那条写着 4/4 已完成 —— 同一屏自相矛盾）。
       现在状态一律从 HIST 反查，这里断言两边不打架。 */
    const histTexts = qa('#histBody .hitem').map(t => txt(t));
    R.flowRunning = {
      f09Badge:  txt(q('#orchList .wfitem[data-flow="f09"] .tag')),        /* 默认态应为「已完成」 */
      badgeAll:  qa('#orchList .wfitem .tag').map(t => txt(t)),            /* 只有有运行记录的流程才带徽章 */
      histRna:   (histTexts.filter(t => t.indexOf('RNA-seq') >= 0)[0] || '(无)').slice(0, 52),
      histRunningFlow: histTexts.filter(t => t.indexOf('工作流 ·') >= 0 && t.indexOf('运行中') >= 0).length
    };
    /* 编排区说自己有流程在跑时，运行历史里必须真有一条在跑 —— 单向蕴含，不要求反过来 */
    R.flowRunning.consistent =
      !(R.flowRunning.f09Badge === '运行中' && R.flowRunning.histRunningFlow === 0);
    R.histRefresh = qa('#histBody .hitem').length;

    /* 工作台问答交互卡（v30；v53 起是智能体会话唯一宿主 —— 右下角浮窗随浮球撤除）。
       段会切页，收尾必须留在 p01 —— 下面的问答闸门段也在卡上做。 */
    window.__go('p01'); await sleep(320);
    const wbCards = qa('#page-p01 .card__t').map(t => txt(t));
    /* 会话起步条数不写死：projAgent 段已经跟 agent 问答过，AGENT_LOG 不是空的。
       全段只看**增量**（提问 = +2 条），写死绝对值会随前面段落的变化集体变红。 */
    const wbMsgs0 = qa('#wbAgentBody .msg').length;
    q('#wbAgentQs [data-ask="查看流程"]').click(); await sleep(480);
    R.wbAgent = {
      p01Cards: wbCards,
      queueGone: wbCards.indexOf('算力队列') < 0,
      p06QueueGone: !q('#queueList'),
      msgsDelta: qa('#wbAgentBody .msg').length - wbMsgs0,/* 期望 +2（问 + 答） */
      msgs0: wbMsgs0,
      chips: qa('#wbAgentQs .qchip').length,
      last: txt(q('#wbAgentBody .msg:last-child')).slice(0, 40),
      sendBtn: !!q('[data-agent-send="wbAgentIn"]')
    };
    /* 输入框自由提问：发送后输入框清空、再 +2 条消息 */
    const wbIn = q('#wbAgentIn');
    wbIn.value = '查看项目统计';
    wbIn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await sleep(480);
    R.wbAgentTyping = {
      cleared: q('#wbAgentIn').value === '',
      wbMsgs: qa('#wbAgentBody .msg').length,
      last: txt(q('#wbAgentBody .msg:last-child')).slice(0, 30)
    };

    /* 智能体问答 + 写操作确认闸门（v53 起在问答卡上做 —— 浮窗撤了，闸门逻辑没变，
       agentBoxes 会把确认框挂到每个宿主）。#histBody / #orchList 都在 p04 的 DOM 里，
       跨页读条数不受「当前站在哪」影响，不必真的跳去 p04。 */
    R.agentOpen = { msgs: qa('#wbAgentBody .msg').length,
                    chips: qa('#wbAgentQs .qchip').length };
    /* 只读问答 */
    q('#wbAgentQs [data-ask="查看最近任务"]').click(); await sleep(450);
    R.agentQa = { msgs: qa('#wbAgentBody .msg').length, boxes: qa('#wbAgentBody .confirmbox').length,
                  last: txt(q('#wbAgentBody .msg:last-child')).slice(0, 46) };
    /* 写操作：先出确认框、数据不动 */
    const histA = qa('#histBody .hitem').length;
    q('#wbAgentQs [data-ask="跑 RNA-seq 流程"]').click(); await sleep(450);
    R.agentGate = { boxes: qa('#wbAgentBody .confirmbox').length,
                    histBefore: histA, histAfter: qa('#histBody .hitem').length };
    /* 取消：应不落记录 */
    q('#wbAgentBody [data-agent-no]').click(); await sleep(300);
    R.agentCancel = { boxes: qa('#wbAgentBody .confirmbox').length, hist: qa('#histBody .hitem').length };
    /* 重新发起 → 确认执行：右栏 +1 */
    q('#wbAgentQs [data-ask="跑 RNA-seq 流程"]').click(); await sleep(450);
    q('#wbAgentBody [data-agent-ok]').click(); await sleep(450);
    R.agentDone = { boxes: qa('#wbAgentBody .confirmbox').length, hist: qa('#histBody .hitem').length,
                    top: txt(q('#histBody .hitem')).slice(0, 30),
                    /* 写入成功后，编排区的 f09 徽章必须从「已完成」翻成「运行中」：
                       否则「历史已更新、流程列表还在说旧状态」，两个面板又不同源 */
                    f09Badge: txt(q('#orchList .wfitem[data-flow="f09"] .tag')) };

    /* ---- v38 需求：主页「问答交互」卡全屏 / 缩回原来那一格 ----
       宿主是页面流里的一格（不是 fixed 浮层），所以这里多守两件事：
       ① 缩回后回到**原来那一格**（尺寸 + 距视口右 / 下距离全等），不是「大概回去了」；
       ② 全屏期间页面不许被挤动。卡片一 position:fixed 就脱流，右侧栏会塌成 0，
          整页往上跳一截 —— 全屏层四周只留 22px 边距，这个跳动在边距里看得见。
          用下方那张卡的 top 当标尺，动了就说明「缩回的是重排后的位置」。
       （③「进全屏前先把浮窗收走」随浮窗撤除而消失，v53。） */
    window.__go('p01'); await sleep(420);
    q('#wbAgentQs [data-ask="查看项目"]').click(); await sleep(520);
    const _wbr0 = window.__wbFull();                 /* 不传参 = 只读当前态 */
    R.wbFull = {
      hasBtn:   !!q('#wbAgentCard [data-wb-full]'),
      ariaOff:  q('[data-wb-full]').getAttribute('aria-pressed'),
      labelOff: q('[data-wb-full]').getAttribute('aria-label'),
      iconOff:  _wbr0.icon,
      home:     _wbr0.rect,
      homeBdH:  _wbr0.bdH,
      homeHolderH: _wbr0.holderH,
      below0:   window.__wbBelow(),
      msgs:     qa('#wbAgentBody .msg').length
    };
    q('[data-wb-full]').click(); await sleep(460);
    R.wbFull.on = window.__wbFull();   /* 不传参 = 只读：读到的就是「点完之后」的真实状态 */
    R.wbFull.vp = window.innerWidth + 'x' + window.innerHeight;
    R.wbFull.below1 = window.__wbBelow();
    R.wbFull.on.msgInCard = qa('#wbAgentBody .msg').length;
    /* 全屏层若被别的高 z 元素压住，elementFromPoint 会替它挨这一下 ——
       三个控件逐个验（v31/v32 抓过的那类遮挡） */
    R.wbFull.on.hit = ['#wbAgentCard [data-agent-send="wbAgentIn"]', '#wbAgentIn', '[data-wb-full]']
      .map(function (sel) {
        const e = q(sel); if (!e) return 'none';
        const b = e.getBoundingClientRect();
        const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return el && (e === el || e.contains(el)) ? 'self' : (el ? el.tagName : 'null');
      });
    /* 全屏里开弹窗：卡片 z 58 必须低于遮罩 60 / 弹窗 70，否则弹窗开在它背后点不到 */
    window.__orchSave(true); await sleep(380);
    R.wbFull.modal = {
      open:    !q('#modal').hidden,
      z:       getComputedStyle(q('#modal')).zIndex,
      closeHit: (function () {
        const e = q('#modal .iconbtn[data-close="modal"]');
        if (!e) return null;
        const b = e.getBoundingClientRect();
        const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return !!(el && (e === el || e.contains(el)));
      })(),
      cardStillFull: q('#wbAgentCard').classList.contains('is-full')
    };
    q('#modal .iconbtn[data-close="modal"]').click(); await sleep(260);
    /* 再点一次 → 缩回原来那一格（需求里的「点缩小」就是这一下） */
    q('[data-wb-full]').click(); await sleep(460);
    R.wbFull.off = window.__wbFull();
    R.wbFull.below2 = window.__wbBelow();
    /* 再进一次，改用 Esc 退出：分层规则与右下角浮窗一致 ——
       先缩全屏，而不是把这一整张卡「收掉」（卡片在页面流里，没有可收的东西） */
    q('[data-wb-full]').click(); await sleep(400);
    R.wbFull.reIn = window.__wbFull()['full'];
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(440);
    R.wbFull.esc = window.__wbFull();
    /* 跳页自动复位：卡片是 p01 的东西，留在别的页面上就是盖住新页面的幽灵层 */
    q('[data-wb-full]').click(); await sleep(380);
    R.wbFull.navBefore = q('#wbAgentCard').classList.contains('is-full');
    window.__goRaw('p02'); await sleep(420);
    R.wbFull.navAfter = window.__wbFull();
    window.__go('p01'); await sleep(400);
    R.wbFull.again = window.__wbFull();         /* 回页后卡片与占位都得干净 */

    /* （v37 需求 1「智能体浮窗全屏」整块撤除，v53 —— 浮窗不在了，
        全屏/缩回原位那组几何断言一起退场；问答卡全屏仍由上面 wbFull 那组守。） */

    /* 高保真守卫①：界面文案里不应再有「演示」这类原型脚手架措辞。
       用 textContent 而不是 innerText —— 未激活页面同样属于界面文案，不能漏。 */
    /* 必须先剔掉 script / style：内联的 JS 注释里可以有「演示」二字（对开发有参考价值），
       但 textContent 会把它们算成界面文案，守卫就变成假警报。 */
    const _cl = document.body.cloneNode(true);
    _cl.querySelectorAll('script, style').forEach(n => n.remove());
    const allText = _cl.textContent || '';
    R.hifiNoDemo = {
      hits: (allText.match(/演示/g) || []).length,
      spots: (allText.match(/.{0,14}演示.{0,14}/g) || []).slice(0, 3)
    };

    /* 高保真守卫②：阈值常量与界面展示值必须同源 */
    const thr = window.__thresholds ? window.__thresholds() : null;
    R.thrSync = thr ? {
      ok: txt(q('#thrMissing')) === thr.missing + '%'
       && txt(q('#thrNsample')) === String(thr.nsample)
       && txt(q('#thrQpos')) === String(thr.qpos),
      shown: [txt(q('#thrMissing')), txt(q('#thrNsample')), txt(q('#thrQpos'))],
      want: [thr.missing + '%', String(thr.nsample), String(thr.qpos)]
    } : { ok: false, why: '拿不到 THRESHOLDS' };

    /* ---- 下载：确认弹窗 + 真产出（放在最后，它会切页）----
       三段都要：① 点按钮**只弹框**、文件还没出去；② 取消后什么都不发生；
       ③ 确认后内容是真的（样本档案 75 行与队列同源、结果表序列化带表头、
       导出结果是一个能被标准解压器打开的标准 ZIP）。
       只断言「弹了框」等于没测 —— 一个假按钮也能弹框。 */
    R.dlKeys = window.__dlKeys();
    /* 档案样本数要现算：前面的样本档案段补登过一例（S076），写死 75 会误判。
       导出口径的「同源」= 与当前档案条数一致，而不是与 p03 队列口径一致 ——
       补登的新样本还没进分析队列，这两者本来就允许不等。 */
    R.dlSampN = window.__sampState().n;
    /* v42：结果全景那五张表（patho / diffgenes / enrich / diffprot / diffmetab）现在
       住在项目详情层的「结果全景」模块里 —— 靠 #panoMount 挂载才进 DOM。
       采集前必须先进那一页，否则它们一律返回 null，而 null 混进后面那拨
       「每条都必有内容」的校验里，判定段会在下标取值上炸掉整轮回归。
       这跟 modres 是同一类「上下文相关」条目，区别只是它有五条、住在同一个挂载点下。 */
    window.__projDetail('P-2026-001', 'result', null, 999); await sleep(380);
    R.dlBuilds = {};
    R.dlKeys.forEach(function (k) {
      var b = window.__dlBuild(k);
      R.dlBuilds[k] = b ? { name: b.name, fmt: b.fmt, size: b.size, lines: b.lines,
                            note: b.note, head: b.head.slice(0, 90) } : null;
    });
    R.dlZipB64 = window.__dlBytes('resultzip');
    /* modres 是**上下文相关**的条目：它导出的是「我此刻站在哪一步」，
       所以要在项目层的模块页上取一次 —— 混进上面那一拨「每条都必有内容」会误判成坏条目，
       而把它写成「不校验」又会漏掉「导出的其实是别的东西」。 */
    window.__projDetail('P-2026-001', undefined, undefined, 2); await sleep(360);
    R.dlModres = (function () {
      var b = window.__dlBuild('modres');
      if (!b) return null;
      var e = q('#projBody [data-dl="modres"]');
      if (e) e.click();
      return { name: b.name, size: b.size, lines: b.lines, note: b.note };
    })();
    await sleep(300);
    R.dlModresModal = { open: !q('#modal').hidden, title: txt(q('#modalT')),
                        body: txt(q('#modalB')).slice(0, 140) };
    q('#modal .iconbtn[data-close="modal"]').click(); await sleep(200);
    window.__goHome(); await sleep(200);

    window.__goto('gene'); await sleep(340);
    /* v42：结果全景那 6 个导出入口（patho / diffgenes / enrich / diffprot / diffmeta /
       resultzip）现在住在 #panoTpl 里 —— 不挂载就不在文档树，站在别的页数会少 6 个。
       所以先挂一次全景再数「全站导出入口」，数完回 gene 继续测「档案导出」。
       （原来 p07 是个普通 <section>，那 6 颗按钮一直躺在 DOM 里，所以没这个问题。） */
    window.__projDetail('P-2026-001', 'result', null, 999); await sleep(340);
    R.dlEntryCount = qa('[data-dl]').length;
    /* 顺便把界面上的入口**按名字**收一份：只数个数的话，「注册了 13 条、
       界面上也是 13 颗，但其中一颗挂的是别的 key」照样通过。
       v46 起这条断言改成「注册项 vs 界面入口」的集合比对，见判定段。 */
    R.dlEntryKeys = qa('[data-dl]').map(e => e.getAttribute('data-dl'));
    window.__goto('gene'); await sleep(300);
    q('[data-dl="samples"]').click(); await sleep(280);
    R.dlModal = {
      open: !q('#modal').hidden,
      title: txt(q('#modalT')),
      body: txt(q('#modalB')),
      btns: qa('#modalF button').map(b => txt(b)),
      pending: window.__dlPending(),
      hitGo: hitOK2('#modal [data-dl-go]')
    };
    q('#modal .iconbtn[data-close="modal"]').click(); await sleep(220);
    R.dlCancel = { modal: q('#modal').hidden, toast: lastToast() };

    /* 表内「导出」按钮（靠向上找表定位）也要走同一套，且内容与那张表一致。
       v42：原来借 p07 上的差异表达表，现在那份内容住在项目详情的「结果全景」模块里 ——
       进门后先切到「差异表达」视图，那颗按钮才在显示态上。 */
    window.__projDetail('P-2026-001', 'result', null, 999); await sleep(320);
    q('#viewSeg [data-view="de"]').click(); await sleep(200);
    q('[data-dl="diffgenes"]').click(); await sleep(260);
    R.dlRowBtn = { open: !q('#modal').hidden, body: txt(q('#modalB')),
                   pending: window.__dlPending(), toast: lastToast() };
    q('#modal [data-dl-go]').click(); await sleep(420);
    R.dlRowBtn.confirmed = q('#modal').hidden;
    R.dlRowBtn.toastAfter = lastToast();

    /* 格式模板（走 alert 里的动作按钮）已在 p02 异常面板那段测过 —— 见 R.anomTemplate */

    /* ---- 列表对齐：表头与单元格同一套居中 ----
       两个探针各管一半，缺一不可：
       ① tblAlignCss 走**文档里全部** table.tbl（含 display:none 的页与没打开的弹窗）——
          计算值不受可见性影响，所以「全站 32 张表」这一层是它守的。
          只断 .tbl th/.num 会不会被人挂一个工具类改回去。
       ② tblAlignGeom 只看**此刻真的渲染出来**的表，用 Range 取表头与每个单元格
          内容的实际水平中心，比它们差多少 —— 证明上面那条规则真的落在像素上。
          少了它，「表头左、单元格右」这种错位在计算值上完全看不出问题。 */
    R.tblAlignCss = (function () {
      var o = { tables: 0, cells: 0, bad: [] };
      qa('table.tbl').forEach(function (t, ti) {
        o.tables++;
        var label = t.id || (t.closest('.card') ? 'card#' + ti : 'tbl#' + ti);
        Array.prototype.forEach.call(t.querySelectorAll('th,td'), function (c) {
          o.cells++;
          var ta = getComputedStyle(c).textAlign;
          if (ta !== 'center' && o.bad.length < 8) {
            o.bad.push(label + ' ' + c.tagName + '[' + txt(c).slice(0, 10) + ']=' + ta);
          }
        });
      });
      return o;
    })();

    /* 对齐探针要在真渲染的页面上跑，所以显式切到页面再量、量完回位。 */
    R.tblAlignGeom = (function () {
      var o = { tables: 0, cols: 0, worst: 0, bad: [], seen: [] };
      var cx = function (el) {
        var rg = document.createRange(); rg.selectNodeContents(el);
        var b = rg.getBoundingClientRect();
        return (b.width || b.height) ? (b.left + b.width / 2) : null;
      };
      var measure = function () {
        qa('table.tbl').forEach(function (t, ti) {
          var tr = t.querySelector('thead tr'); if (!tr) return;
          var tbl = t.getBoundingClientRect(); if (!tbl.width) return;   /* 隐藏页跳过 */
          o.tables++;
          /* 记下「量到了哪几张表、各几列」：只报一个总数时，数字对不上
             根本看不出是哪张表没渲染出来（p07 是分视图的，切到哪个视图变了
             就会少几张表，而总数只少几列，看着像「阈值该调小一点」）。 */
          o.seen.push((t.id || 'card#' + ti) + ':' + tr.children.length);
          Array.prototype.forEach.call(tr.children, function (th, ci) {
            var hc = cx(th); if (hc === null) return;
            o.cols++;
            Array.prototype.slice.call(t.querySelectorAll('tbody tr')).forEach(function (row) {
              if (!row.getClientRects().length) return;
              var c = row.cells[ci];
              if (!c || c.colSpan !== 1) return;
              var cc = cx(c); if (cc === null) return;
              var d = Math.abs(hc - cc);
              if (d > o.worst) o.worst = d;
              if (d > 2 && o.bad.length < 8) {
                o.bad.push((t.id || 'card#' + ti) + ' 第' + (ci + 1) + '列[' + txt(th).slice(0, 8) + '] Δ' + d.toFixed(1));
              }
            });
          });
        });
      };
      /* 三张被点名的表：样本列表（样本档案）、参数确认摘要（p05）、结果差异表（结果全景）。
         ⚠ 样本档案这一页现在把「跨组学」「样本资料」两张表收在右侧抽屉里 ——
         抽屉收起时它们 display:none、量不到（表数会从 6 掉到 4）。
         量之前必须先把抽屉滑出来，否则「那张表的单元格也居中」这条约束
         会在抽屉里静默失效，而总数只少 14 列、看着像阈值该调小一点。
         v42：第三张表不再走 p07（整页撤了），改在项目详情层的「结果全景」模块里量。 */
      ['gene', 'p05', 'pano'].forEach(function (pg) {
        if (pg === 'pano') {
          window.__projDetail('P-2026-001', 'result', null, 999);
          /* 视图要确在「基因变异」（默认那格）上 —— measure() 对宽度 0 的表直接跳过，
             视图不对就会少量几张，而总数只少几列、看着像阈值该调小一点。 */
          var vb = document.querySelector('#viewSeg [data-view="variant"]');
          if (vb) vb.click();
        } else {
          window.__goto(pg);
          if (pg === 'gene') { window.__sampDrawer(true); }
        }
        measure();
      });
      return o;
    })();

    /* ---- 必填标识：站内只有一套（提醒色星号 + 表单图例） ---- */
    window.__goHome(); window.__goto('proj'); await sleep(160);
    q('[data-proj-new]').click(); await sleep(240);
    /* v50 需求 3：点「新建项目」先出一道**分流屏**，必填标识在向导第 1 步上，
       所以要先走「一键全流程分析」进去 —— 不加这一下，`.req` 一个都量不到，
       整组读数会静默变成 0（红是红了，但红的原因看着像「星号被删了」）。 */
    q('.pnchoose__c[data-pns="full"]').click(); await sleep(320);
    /* 用一根临时元素把 --color-warn 解析成 rgb：这样断言比的是「星号用的是不是
       那个提醒色 token」，而不是把 #8A5200 抄进 verify.py 再逐字对一遍。 */
    R.reqProj = (function () {
      var p = document.createElement('span');
      p.style.color = 'var(--color-warn)';
      document.body.appendChild(p);
      var warnRgb = getComputedStyle(p).color;
      p.remove();
      return {
        /* ⚠ 「必填星号」有**两种**，别用 `.req` 一把捞：
           ① 字段标签上的（.fld__l .req）—— 一个必填字段一颗，这是要数的；
           ② 表单底部图例里的那一颗（.frmlegend .req）—— 只有一个，是图例本身。
           只数 `.req` 会把图例那颗算进来，于是「1 个必填项」量成 2，看着像多标了。 */
        marks: qa('#modal .fld__l .req').length,
        allReq: qa('#modal .req').length,
        aria: qa('#modal [aria-required="true"]').length,
        legend: qa('#modal .frmlegend').length,
        legendMark: qa('#modal .frmlegend .req').length,
        legendText: qa('#modal .frmlegend').length ? txt(qa('#modal .frmlegend')[0]) : '',
        color: qa('#modal .fld__l .req').length ? getComputedStyle(qa('#modal .fld__l .req')[0]).color : '',
        warn: getComputedStyle(document.documentElement).getPropertyValue('--color-warn').trim(),
        warnRgb: warnRgb,
        oldTag: qa('#modal .tag').filter(n => txt(n) === '必填').length
      };
    })();
    q('#modal .iconbtn[data-close="modal"]').click(); await sleep(200);

    window.__goto('gene'); 
    await sleep(220);
    q('[data-samp-new]').click(); await sleep(260);
    R.reqSamp = {
      marks: qa('#modal .fld__l .req').length,
      allReq: qa('#modal .req').length,
      aria: qa('#modal [aria-required="true"]').length,
      legend: qa('#modal .frmlegend').length,
      oldTag: qa('#modal .tag').filter(n => txt(n) === '必填').length
    };
    q('#modal .iconbtn[data-close="modal"]').click(); await sleep(200);

    /* 工具抽屉：三个必填项都挂星号，且**真的拦得住**空值 ——
       把参考基因组索引前缀清空再点「运行此工具」，应该被拦下来并给出提示。
       ⚠️ 必须**先切到「工具库」**：`#orchList` 默认渲染流程模板（`.wfitem`），
       此时 `.titem` 根本不存在 —— 对它 `.click()` 会抛 TypeError 并**打断整段 DRIVE**，
       后面的探针一个都采不到（表现是 KeyError，而不是「某条断言失败」）。 */
    window.__goto('p04'); await sleep(300);
    q('[data-orchseg="tools"]').click(); await sleep(260);
    q('#orchList .titem').click(); await sleep(320);
    const _dr = q('#drawerTool');
    R.reqTool = {
      marks: _dr.querySelectorAll('.fld__l .req').length,
      allReq: _dr.querySelectorAll('.req').length,
      aria: _dr.querySelectorAll('[aria-required="true"]').length,
      legend: _dr.querySelectorAll('.frmlegend').length,
      refId: !!_dr.querySelector('#tp-ref')
    };
    const _ref = _dr.querySelector('#tp-ref');
    _ref.value = '';
    _dr.querySelector('[data-tool-run]').click(); await sleep(220);
    R.reqTool.blocked = lastToast();
    R.reqTool.focused = document.activeElement ? document.activeElement.id : '';
    R.reqTool.notRun = R.reqTool.blocked.indexOf('必填项没填') >= 0
                       && R.reqTool.blocked.indexOf('已提交运行') < 0;
    /* 填回去再点，这次要真的提交 —— 证明拦的是「空值」，不是这个按钮本身不能点 */
    _ref.value = '/data/standards/indexes/hg38/hg38_index';
    _dr.querySelector('[data-tool-run]').click(); await sleep(220);
    R.reqTool.runs = lastToast();
    _dr.querySelector('[data-close="tool"]').click(); await sleep(240);
    window.__goHome(); await sleep(160);

    /* ---- v52 需求 2：智能分析线的「运行分析」先弹「完善项目信息」----
       这一段**必须放在驱动段最后**：确认会把任务提交进队列（QUEUE_JOBS=3>0 →
       submitRun），放中间会给后面所有依赖任务状态的段落添变量。
       三段各自量一件事：① 空手进 p06 信息条是收起的（没走过那一步不该出现）；
       ② 弹窗七项在位、两项回填、空表点确认被拦；③ 填完点确认才进 p06 并开跑。
       ⚠ 取不到 #btnRunAna 就报一个不可能通过的值 —— 直接 .click() 会抛错打断
       整段驱动脚本，其后几百条结果一条都看不到（v47 的坑）。 */
    window.__goRaw('p06'); await sleep(240);
    /* 先复位选数状态：走到这里 SEL.ds 停在向导选的小鼠数据集上，参考基因组却是
       hg38 —— 弹窗会把「小鼠细胞组 + GRCh38」并排写出来，图上就是一句矛盾话。 */
    window.__p02Reset(); await sleep(200);
    R.runMeta = { barBefore: { page: qa('.page.is-on')[0].id, hidden: q('#runMetaBar').hidden } };
    window.__goRaw('p05'); await sleep(240);
    var _rmBtn = q('#btnRunAna');
    R.runMeta.btn = _rmBtn
      ? { has: true, runmeta: _rmBtn.hasAttribute('data-runmeta'), oldRun: _rmBtn.hasAttribute('data-run') }
      : { has: false, runmeta: false, oldRun: null };
    if (_rmBtn) { _rmBtn.click(); await sleep(340); }
    R.runMeta.modal = {
      open: !q('#modal').hidden,
      title: txt(q('#modalT')),
      wide: q('#modal .modal__b').classList.contains('modal__b--wide'),
      labels: qa('#modalB .fld__l').map(txt),
      required: qa('#modalB [aria-required="true"]').map(e => e.id),
      /* 回填行必须是 .rbfill 而不是 disabled 的输入框：disabled 会被读屏跳过，
         而这两行恰恰要说「值已经带过来了，要改去源头上改」。 */
      fills: qa('#modalB [data-rmfill]').map(e => ({
        k: e.getAttribute('data-rmfill'),
        tag: txt(e.querySelector('.tag')),
        hint: txt(e.querySelector('.fld__h')),
        disabledInp: !!e.querySelector('input[disabled]')
      })),
      /* 样本ID 的例数是**现算**的（队列 − 缺蛋白组的 4 例），而队列在这段驱动里
         被前面的「补登样本」加过一例 —— 写死 71 会红。所以这里把弹窗里那条
         「共 N 例」带出来，判定段拿它去对「本次分析信息」条上的同一个 N，
         断的是「两处同一个数」而不是「两处同一个 71」。 */
      sidNote: (function () { var e = q('#modalB [data-rmfill="sid"] .rbfill__n');
        return e ? txt(e) : null; })(),
      selOpts: qa('#rmGrp option').length,
      legend: txt(q('#modalB .frmlegend')),
      ok: !!q('[data-rmok]'),
      foot: qa('#modalF .btn').map(b => txt(b))
    };
    q('[data-rmok]').click(); await sleep(240);
    R.runMeta.blocked = {
      open: !q('#modal').hidden,
      toast: lastToast(),
      errName: q('#rmName') ? q('#rmName').classList.contains('is-err') : null,
      page: qa('.page.is-on')[0].id
    };
    /* 填四项（两项回填项不归人管），再点确认 —— 这次要真的走进任务运行页 */
    (function () {
      var n = q('#rmName'); if (n) { n.value = '肝癌早筛多组学试跑'; n.classList.remove('is-err'); }
      var dd = q('#rmDesc'); if (dd) dd.value = '对 71 例共同样本做差异表达与功能富集，验证早筛标志物组合';
      var g = q('#rmGrp'); if (g && g.options[1]) g.value = g.options[1].value;
      var s = q('#rmSampDesc'); if (s) s.value = '肝癌 / 肝硬化 / 健康对照三类，配对设计，空腹采血';
      var c = q('#rmCond'); if (c) c.value = 'Illumina NovaSeq 6000 · PE150 · 测序深度 30×';
    })();
    q('[data-rmok]').click(); await sleep(520);
    R.runMeta.confirmed = {
      closed: q('#modal').hidden,
      page: qa('.page.is-on')[0].id,
      toast: lastToast(),
      barHidden: q('#runMetaBar').hidden,
      barT: txt(q('#runMetaT')),
      barP: txt(q('#runMetaP')),
      runTag: txt(q('#runTag'))
    };

    /* 整段驱动里「从项目详情层退回其它页」走了几次面包屑。这是 v41 的一条产品约定
       （项目层的左栏是这个项目的菜单，全局项一个不在 DOM 里），
       不为 0 才说明这条路真的被走到过 —— 否则那条约定等于没人验。 */
    R.navFallback = window.__navFallback;
    R.errs = window.__errs;
    R.Z_DONE = 'ok';
  } catch (e) {
    R.Z_ERROR = e.message + ' @ ' + (e.stack || '').split('\n')[1];
  }
  return JSON.stringify(R);
})()
"""

# v56：驱动串改完后先过一遍 JS 语法，再启 Chrome。
# DRIVE 是一整段塞给浏览器的 JS，它坏掉时报的是「Uncaught SyntaxError: Invalid or
# unexpected token + 行号」，**行号是 DRIVE 内的偏移、不是文件行号**，定位极费劲，
# 而代价是白等 4 分半才看到一句没头没尾的报错。这里先让 node 判一次。
import subprocess as _sp, tempfile as _tf
with _tf.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as _f:
    _f.write(DRIVE)
    _drive_js = _f.name
_chk = _sp.run(["node", "--check", _drive_js], capture_output=True, text=True)
if _chk.returncode != 0:
    _err = (_chk.stderr or "").strip()
    _lines = DRIVE.split("\n")
    _m = re.search(r":(\d+)\s*$", _err.split("\n")[-1])
    _ctx = ""
    if _m:
        n = int(_m.group(1))
        _ctx = "\n".join("  %d| %s" % (k, _lines[k - 1])
                         for k in range(max(1, n - 2), min(len(_lines), n + 2)))
    raise SystemExit("DRIVE 段 JS 语法错误（行号为 DRIVE 内偏移）：\n%s\n%s" % (_err, _ctx))

log = open("/tmp/cdp_verify.log", "w")
# HOME 重定向：Omaha 更新器的心跳删写的是 ~/Library/.../GoogleUpdater/，
# 沙箱拦「家目录文件删除」会把整棵进程树杀掉（v27 实测四次，均卡 2 分 02 秒）。
# 给 chrome 单独换一个 HOME，更新器就把心跳文件写进 /tmp —— 对它只是换个仓库，
# 对沙箱是放行路径。chrome 进程的其它行为不受影响。
#
# v49 补一刀：**只有 HOME 不够**。Chrome 在启动时会派一个
# `GoogleUpdater.app/Contents/MacOS/GoogleUpdater --wake` 子进程，它删的三个路径里
# `~/Library/Application Support/Google/RLZ/RlzStore.plist` 与
# `~/Downloads/.com.google.Chrome.*` 都不看 `$HOME` —— macOS 的 CoreFoundation 走
# `NSHomeDirectory()`，要单独用 **CFFIXED_USER_HOME** 才能改写（这正是 CF 给这类场景留的开关）。
# 实测症状：全量回归在 2 分半左右整棵进程树被沙箱杀掉、日志里只有
# `WebSocketConnectionClosedException`（**连判定行都没有**），而短探针（十几秒）从来不中招。
# 两个变量一起钉住，更新器才真正被挪进 /tmp。
_chrome_env = dict(os.environ)
_chrome_env["HOME"] = "/tmp/_cdp_home"
_chrome_env["CFFIXED_USER_HOME"] = "/tmp/_cdp_home"
os.makedirs("/tmp/_cdp_home", exist_ok=True)
proc = subprocess.Popen([CHROME, "--headless=old", "--disable-gpu", "--no-sandbox",
                         "--disable-dev-shm-usage", "--disable-component-update",
                         "--disable-background-networking", "--remote-allow-origins=*",
                         "--check-for-update-interval=2147483647",
                         "--no-first-run", "--no-default-browser-check",
                         # 必须让 chrome 用「假钥匙串」，别去碰 macOS 真钥匙串：
                         # profile 在 /tmp 下、又是 headless，chrome 想写 "Chrome Safe Storage"
                         # 却拿不到，系统会派 SecurityAgent 弹「找不到用于储存"Chrome"的钥匙串」
                         # 的模态框打断用户（v36.4 用系统日志定位：chrome 调 SecKeychainAddCallback
                         # 后紧接着拉起 SecurityAgent）。这两个开关让 chrome 完全不访问真钥匙串。
                         "--use-mock-keychain", "--password-store=basic",
                         "--remote-debugging-port=%d" % PORT,
                         "--user-data-dir=/tmp/_cdp_omics", "about:blank"],
                        stdout=log, stderr=log, env=_chrome_env)
ws = None
EVENTS = []
try:
    for _ in range(80):
        try:
            urllib.request.urlopen("http://127.0.0.1:%d/json/version" % PORT, timeout=5); break
        except Exception:
            time.sleep(0.5)

    req = urllib.request.Request("http://127.0.0.1:%d/json/new?%s" % (PORT, urllib.parse.quote(URL, safe="")), method="PUT")
    tab = json.loads(urllib.request.urlopen(req, timeout=15).read())
    # 超时是**整个 DRIVE 的墙钟预算**，不是单条指令的：DRIVE 里几十处 sleep 加起来
    # 已超过 3 分钟，卡在 180s 会以 WebSocketTimeoutException 收场（表现是「没判定就断」，
    # 而不是某条断言失败）。留足余量，别按单步耗时估。
    ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=900, max_size=64 * 1024 * 1024)
    mid = [0]

    def call(method, params=None):
        mid[0] += 1
        ws.send(json.dumps({"id": mid[0], "method": method, "params": params or {}}))
        while True:
            m = json.loads(ws.recv())
            if m.get("id") == mid[0]:
                return m
            EVENTS.append(m)

    call("Page.enable"); call("Runtime.enable"); call("Log.enable")
    # 接管下载目录：headless 默认会把 a[download] 存进用户真实下载目录
    call("Page.setDownloadBehavior", {"behavior": "allow", "downloadPath": DL_DIR})
    call("Emulation.setDeviceMetricsOverride",
         {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False})

    res = call("Runtime.evaluate", {"expression": DRIVE, "awaitPromise": True, "returnByValue": True})
    if "exceptionDetails" in res.get("result", {}):
        print("驱动脚本异常：", json.dumps(res["result"]["exceptionDetails"], ensure_ascii=False)[:900])
    data = json.loads(res["result"]["result"]["value"])

    # 截图
    # ── 每张截图该拍哪一页 ──
    # 检查放在 shot() 内部按**文件名查表**，所以不必改 37 处调用点；
    # 没登记的截图名会被判为不合格，保证新增截图必须表态。
    # 为什么需要它：截图 setup 普遍依赖「前一张恰好停在目标页」，而探针段会切页。
    # 本轮真实踩到 —— 23-orch-full 把浏览器留在 p04 全屏，紧接着的
    # 32/33/34 三张样本档案截图全部拍成了编排区，而 143 项判定一条没红。
    # 断言查的是 DOM 事实，截图查的是「此刻屏幕上是什么」，两者不是同一回事。
    SHOT_PAGE = {
        '01-workbench.png': 'p01', '02-params-admin.png': 'p05',
        '83-user-sw.png': 'p01', '84-params-basic.png': 'p05',
        '54-wb-agent.png': 'p01',        '03-results-de.png': 'projdetail', '04-variant.png': 'projdetail',
        '05-corr.png': 'projdetail', '06-ppi.png': 'projdetail', '07-run.png': 'p06',
        '08-kb-med.png': 'kbmed', '08b-kb-admin.png': 'kbmed', '09-kb-own.png': 'kbown', '24-kb-graph.png': 'kbgraph',
        '67-kbc-dom.png': 'kbmed', '68-kbc-form.png': 'kbmed',
        '10-datasets.png': 'p02', '11-refgenome.png': 'p02', '12-home-ds.png': 'p01',
        '12a-home-ds-own.png': 'p01',
        '14-ws-pubds.png': 'pubds', '15-ws-log.png': 'log', '16-nav-groups.png': 'p01',
        '17-samp-archive.png': 'gene',
        '25-nav-fold.png': 'p01', '26-nav-fold-auto.png': 'kbown', '27-crumb-nav.png': 'p05',
        '13-ws-project.png': 'proj', '28-proj-list.png': 'proj', '29-proj-detail.png': 'projdetail',
        '65-pd-sample.png': 'projdetail', '66-pd-run.png': 'projdetail',
        '69-pd-dataset.png': 'projdetail',
        '70-pd-rail.png': 'projdetail', '71-pd-mod.png': 'projdetail',
        '30-proj-new.png': 'proj', '31-proj-share.png': 'proj',
        '18-orch-canvas.png': 'p04', '19-orch-tools.png': 'p04', '20-tool-drawer.png': 'p04',
        '21-hist-drawer.png': 'p04', '22-agent.png': 'p01', '23-orch-ext.png': 'p04', '23b-orch-full.png': 'p04',
        '32-samp-cross.png': 'gene', '33-samp-lineage.png': 'gene',
        '33b-samp-lineage-row.png': 'gene', '50-samp-drawer.png': 'gene',
        '35-samp-fold.png': 'gene',
        '41-samp-info.png': 'gene', '44-samp-new.png': 'gene',
        '45-samp-list.png': 'gene', '46-dl-confirm.png': 'gene',
        '48-run-pipe.png': 'p06',
        '49-samp-kpi.png': 'gene',
        '51-fm-mine.png': 'files', '52-fm-team.png': 'files', '53-fm-sys.png': 'files',
        '53b-fm-sys-ro.png': 'files',
        '56-fm-demo.png': 'files',
        '64-wb-full.png': 'p01',
        '62a-orch-run-guard.png': 'p04', '62-orch-saveas.png': 'p04',
        '57-proj-wiz1.png': 'proj', '58-proj-wiz2.png': 'proj',
        '59-proj-wiz3.png': 'proj', '60-proj-wiz4.png': 'proj',
        '74-proj-wiz5.png': 'proj', '75-proj-wiz6.png': 'proj',
        '63-proj-newdone.png': 'proj',
        '77-pn-sidall.png': 'proj', '78-pn-sidnew.png': 'proj',
        '79-p02-picker.png': 'p02', '80-p07-result.png': 'p07',
        '81-runmeta-modal.png': 'p05', '82-p06-metabar.png': 'p06',
        '72-projgroup.png': 'projgroup', '73-projgroup-edit.png': 'projgroup',
        '76-projgroup-ro.png': 'projgroup'
    }
    SHOTFAIL = []
    def shot(name, setup=None):
        if setup:
            call("Runtime.evaluate", {"expression": setup, "awaitPromise": True, "returnByValue": True})
            time.sleep(1.1)
        want = SHOT_PAGE.get(name)
        if not want:
            SHOTFAIL.append('%s 未在 SHOT_PAGE 登记期望页面' % name)
        else:
            a = call("Runtime.evaluate", {
                "expression": "(function(){var p=document.querySelector('.page.is-on');"
                              "return p?p.id:'';})()", "returnByValue": True})["result"]["result"]
            got = a.get("value") or ''
            if got != 'page-' + want:
                SHOTFAIL.append('%s 应停在 page-%s，实际 %s' % (name, want, got or '(无可见页)'))
        # 拍前清掉残留 toast：它们会压住正文（32-samp-cross 里就盖住了底部的说明带），
        # 而 toast 表达的事实判定段已经断言过，留在图里只会挡字。
        # 当前没有哪张截图是「为了展示 toast」而拍的；将来若有，在这里开个豁免集合。
        call("Runtime.evaluate", {
            "expression": "document.querySelectorAll('.toast').forEach(function(t){t.remove();})",
            "returnByValue": True})
        r = call("Page.captureScreenshot", {"format": "png"})
        with open(os.path.join(SHOTS, name), "wb") as f:
            f.write(__import__("base64").b64decode(r["result"]["data"]))

    shot("01-workbench.png", "window.__go('p01')")
    # ── 工作台问答交互卡（v30）：问一条只读问题让卡片里有真实对话 ──
    shot("54-wb-agent.png",
         "window.__go('p01');"
         "setTimeout(()=>{var b=document.querySelector('#wbAgentQs [data-ask=\"查看流程\"]');b&&b.click();},140)")
    # v54：这张原来叫 02-params-engineer.png —— 它靠点顶栏「生信工程师」切换器
    # 露出完整参数面板。视图切换器已撤，现在参数页对**两档管理员**都是完整的，
    # 所以改名 02-params-admin.png，setup 只负责把身份设成超级管理员并进 p05。
    shot("02-params-admin.png",
         "window.__role('super'); window.__goRaw('p05')")
    # ── v54 新增两张：把「点顶栏用户即可换角色」这件事拍下来 ──
    # 83 拍展开的身份菜单（三个角色 + 各自能做什么），84 拍同页的**对照**：
    # 切到普通用户后，完整参数面板（.eng-only）整块消失、只剩推荐配置。
    # 两张连看才说明「换角色 = 换能做什么」，单拍菜单只是拍了一个下拉。
    shot("83-user-sw.png",
         "window.__role('super'); window.__go('p01');"
         "setTimeout(function(){ var b = document.querySelector('#userSw'); if (b) b.click(); },180)")
    shot("84-params-basic.png",
         "setTimeout(function(){"
         "var m = document.querySelector('#popUser'); if (m) m.hidden = true;"
         "window.__role('user'); window.__goRaw('p05'); },180)")
    # v42：这四张原来拍 p07（智能分析 › 结果全景）。p07 撤了，内容搬进项目详情层的
    # 「结果全景」模块 —— setup 一律先 __projDetail(..., 999) 进那一格，再切视图。
    # ⚠ 分号不能省：这一串是 JS，缺一个整段就废了（选择器写错只静默落空，更隐蔽）。
    shot("03-results-de.png",
         "window.__role('super');"
         "window.__projDetail('P-2026-001','result',null,999);"
         "setTimeout(()=>document.querySelector('#viewSeg [data-view=\"de\"]').click(),80)")
    shot("04-variant.png",
         "setTimeout(()=>document.querySelector('#viewSeg [data-view=\"variant\"]').click(),60)")
    shot("05-corr.png",
         "setTimeout(()=>{document.querySelector('#viewSeg [data-view=\"de\"]').click();"
         "var b=document.querySelector('.chartbox[data-chart=\"corr\"]');"
         "b&&b.closest('.card').scrollIntoView({block:'start'});},80)")
    shot("06-ppi.png",
         "setTimeout(()=>{document.querySelector('#viewSeg [data-view=\"prot\"]').click();"
         "var b=document.querySelector('.chartbox[data-chart=\"ppi\"]');"
         "b&&b.closest('.card').scrollIntoView({block:'start'});},80)")
    shot("07-run.png", "window.__goRaw('p06')")
    shot("08-kb-med.png",
         "window.__go('kbmed');"
         "setTimeout(()=>{var q=document.querySelector('#kb2Q');"
         "if(q){q.value='肝细胞癌';}"
         "var b=document.querySelector('[data-kb2search]');b&&b.click();},120);"
         "setTimeout(()=>{var c=document.querySelector('#kbmSearchRes');"
         "c&&c.scrollIntoView({block:'start'});},420)")
    shot("08b-kb-admin.png",
         "window.__go('kbmed');"
         "setTimeout(()=>{var b=document.querySelector('[data-kb2mode=\"admin\"]');b&&b.click();},120);"
         "setTimeout(()=>{var c=document.getElementById('kbmAdminView');"
         "c&&c.scrollIntoView({block:'start'});},420)")
    # v40 需求 1：知识采集两段式。两张各说一件事 ——
    # 67 = 第 1 屏「选择知识域」：屏上只有四张域卡，一个表单字段都没有；
    # 68 = 选定「临床诊疗 + 手动填写」后的第 2 屏：长出本域模块
    #      （标准化临床实践规则）+ 上传区整块不出现（两种方式互斥）。
    shot("67-kbc-dom.png",
         "window.__go('kbmed');"
         "setTimeout(()=>{var b=document.querySelector('#page-kbmed [data-kb2add]');b&&b.click();},240)")
    shot("68-kbc-form.png",
         "setTimeout(()=>{window.__kbc('dom','clin');},160);"
         "setTimeout(()=>{window.__kbc('way','manual');},340);"
         "setTimeout(()=>{window.__kbc('fill',{name:'肝细胞癌',"
         "rules:[['R-C01','Child-Pugh C 级优先评估肝移植','2019 版诊疗规范']]});},500)")
    # 上一张是**故意**把弹窗留在画面里的，得在下一张之前收掉 ——
    # goto() 只管收全屏、不管浮层，残留的弹窗会一路盖住后面几张。
    shot("09-kb-own.png",
         "var _m=document.querySelector('#modal'); if(_m) _m.hidden=true;"
         "window.__kb2Reset(); window.__go('kbown')")
    shot("24-kb-graph.png",
         "window.__go('kbgraph');"
         "setTimeout(()=>{var g=document.getElementById('kbGraph');g&&g.scrollIntoView({block:'center'});},80)")
    shot("10-datasets.png",
         "window.__goRaw('p02');"
         "setTimeout(()=>{var g=document.getElementById('pubGrid-human');"
         "g&&g.scrollIntoView({block:'start'});},120)")
    shot("12-home-ds.png",
         "window.__go('p01');"
         "setTimeout(()=>{document.querySelector('#dsSeg [data-dsgrp=\"mouse\"]').click();"
         "var g=document.querySelector('[data-anchor=\"示例数据集\"]');"
         "g&&g.scrollIntoView({block:'start'});},140)")
    # v59：院内队列那三条是唯一配了内置封面的（公开 6 条都没配），
    # 所以「封面能不能显示」只能在这一屏看得出。
    shot("12a-home-ds-own.png",
         "window.__go('p01');"
         "setTimeout(()=>{document.querySelector('#dsSeg [data-dsgrp=\"own\"]').click();"
         "var g=document.querySelector('[data-anchor=\"示例数据集\"]');"
         "g&&g.scrollIntoView({block:'start'});},140)")
    shot("11-refgenome.png",
         "window.__goRaw('p02');"
         "setTimeout(()=>{document.querySelector('#pubGrid-mouse .dcard').click();},90);"
         "setTimeout(()=>{document.querySelector('[data-refg=\"hg38\"]').click();"
         "var g=document.getElementById('refGrid');g&&g.scrollIntoView({block:'start'});},240)")


    # ── 外壳：左栏分组导航 / p04 内嵌编排 / 两个抽屉 ──
    shot("14-ws-pubds.png",  "window.__go('pubds')")
    shot("15-ws-log.png",      "window.__go('log')")
    shot("16-nav-groups.png",  "window.__go('p01')")
    shot("17-samp-archive.png", "window.__go('gene'); window.__sampReset();")
    # v58：跳外链方案撤销后，分组标题回到「整行 <button> 就是折叠开关」，
    # data-navgrp 回到按钮自己身上 → 直接匹配即可。
    # ⚠ setup 里的选择器写错是**静默失败**（只表现成 md5 变了，很难归因）；
    #   而且这里若还留着 v57 那句 `r.querySelector('[data-navgrp]')`，它现在返 null
    #   （找的是子元素，而 data-navgrp 在按钮自己身上）→ 整段 setup 悄悄落空。
    shot("25-nav-fold.png",
         "window.__go('p01');"
         "setTimeout(()=>{document.querySelector('.snav__grp[data-navgrp=\"知识赋能\"]').click();"
         "document.querySelector('.snav__grp[data-navgrp=\"系统管理\"]').click();},140)")
    shot("26-nav-fold-auto.png",
         "setTimeout(()=>{document.querySelector('.snav__grp[data-navgrp=\"知识赋能\"]').click();"
         "window.__go('kbown');},140)")
    # 导航：返回条已撤（v17），回上级一律走面包屑的祖先段。
    # 这一张拍的就是那条面包屑：从工作台逐级深入到 p05，看得到「工作台 › 数据汇集 › 参数配置」。
    shot("27-crumb-nav.png",
         "window.__goHome();"
         "setTimeout(()=>{window.__goto('p04');},120);"
         "setTimeout(()=>{window.__goto('p05');},300)")
    # 项目管理：卡片 / 列表 / 详情 / 新建 / 分享
    shot("13-ws-project.png",  "window.__go('proj')")
    shot("28-proj-list.png",
         "window.__go('proj');"
         "setTimeout(()=>{document.querySelector('#projViewSeg [data-projview=\"list\"]').click();},120)")
    shot("29-proj-detail.png",
         "setTimeout(()=>{document.querySelector('#projViewSeg [data-projview=\"card\"]').click();},60);"
         "setTimeout(()=>{document.querySelector('#projGrid .projcard[data-proj=\"P-2026-001\"] [data-proj-open]').click();},280)")
    # v39：29 拍的是**项目概况页**（详情已从抽屉升成页面），所以 30 的开头不能再
    # 点 [data-close="proj"] 关抽屉 —— 那个按钮跟着抽屉一起删了，留着会让这一整段
    # setup 在 null.click() 上抛错，后面「打开新建项目弹窗」一步静默落空。
    # 回列表统一走 __go('proj')（真实用户路径就是点面包屑/左栏回项目管理）。
    # v50 需求 3：这一下点到的不再是向导第 1 步，而是**分流屏**（一键全流程分析 /
    # 智能分析）—— 这张图就此换成「点新建项目看到的第一屏」。
    # 向导本体不另拍：57–75 那八张拍的已经是它的每一步，重复拍只会多一张同形图。
    shot("30-proj-new.png",
         "window.__go('proj');"
         "setTimeout(()=>{document.querySelector('[data-proj-new]').click();},280)")
    shot("31-proj-share.png",
         "setTimeout(()=>{document.querySelector('[data-close=\"modal\"]').click();},60);"
         "setTimeout(()=>{document.querySelector('[data-proj-share]').click();},280)")
    # 画布是可编辑的，探针在上面接过节点、存过自定义流程 —— 拍之前先还原成
    # 默认模板（f06），否则这张「流程模板 + 画布」的定妆照拍的是探针的残留状态。
    # 还要顺手关掉 31-proj-share 留下的分享弹窗：goto() 只管收起全屏、不管浮层，
    # 而 31 是**故意**把弹窗留在画面里的（它就是要拍那个弹窗），于是在这之后
    # 一路盖到 18 / 23 两张上 —— 图上看着像页面坏了，其实是上一张的残留。
    # 还要切回「流程模板」：DRIVE 最后停在工具库（reqTool 那段要从工具库点工具），
    # 不切回来的话这张「流程模板 + 画布」拍的是工具列表，和紧接其后的 19-orch-tools 撞脸。
    # **卡片选中态也是会被探针改动的状态**：p04follow 段点过「基因变异分析」，
    # 只 `__orchPick('f06')` 会把画布拉回 RNA-seq 而卡片高亮仍停在基因变异上 ——
    # 图上于是又出现 v21 刚消灭的「同屏两个已选流程」。这里直接点回默认那张卡
    # （真实用户路径，`is-on` + loadFlow + toast 一步到位，toast 由 shot() 清掉）。
    shot("18-orch-canvas.png",
         "var _m=document.querySelector('#modal'); if(_m) _m.hidden=true;"
         "window.__orchForget(); window.__goRaw('p04');"
         "document.querySelector('#pipelineGrid .pcard[data-pipe=\"de\"]').click();"
         "document.querySelector('[data-orchseg=\"flows\"]').click()")
    shot("19-orch-tools.png",
         "window.__goRaw('p04');"
         "setTimeout(()=>document.querySelector('[data-orchseg=\"tools\"]').click(),90)")
    shot("20-tool-drawer.png",
         "document.querySelector('#orchList .titem').click()")
    shot("21-hist-drawer.png",
         "document.querySelector('[data-close=\"tool\"]').click();"
         "setTimeout(()=>document.querySelector('[data-hist-toggle]').click(),90)")
    # ── 智能体问答卡（写操作确认闸门；v53 起会话唯一宿主在主页） ──
    shot("22-agent.png",
         "document.querySelector('[data-close=\"hist\"]').click();"
         "window.__goHome();"
         "setTimeout(()=>{var b=document.querySelector('#wbAgentQs [data-ask=\"跑 RNA-seq 流程\"]');b&&b.click();},180)")
    # ── 编排区全屏（v60：全屏先进外部编排系统，点「返回站内画布」才见画布放大）
    #    这两张必须**都拍**：只拍外部系统，就断不出「画布全屏放大」还在；
    #    只拍画布，就断不出外部系统接得上。
    shot("23-orch-ext.png",
         "document.querySelector('[data-close=\"hist\"]').click();"
         "window.__orchForget(); window.__orchPick('f06');"
         "window.__goRaw('p04');"
         "document.querySelector('[data-orchseg=\"flows\"]').click();"
         "setTimeout(()=>{document.querySelector('[data-orch-full]').click();},170)")
    shot("23b-orch-full.png",
         "setTimeout(()=>{var b=document.querySelector('[data-orchext-back]');b&&b.click();},170)")

    # v46：这三张（32-samp-cross / 33-samp-lineage / 33b / 49-samp-kpi / 35-samp-fold …）
    #    都在样本档案页上，**不打开任何浮层**。
    #    （这里原本还有一段「基因档案重建三态必须放在最后」的排期说明 —— v46 连
    #     `36-gene-rebuild` / `37-gene-running` / `38-gene-done` 三张一起撤了：
    #     它们会打开「重建档案」抽屉且不关，插在中间会污染其后所有截图。
    #     那张抽屉连同基因档案整块已不在页面上，排期约束随之消失。）
    # 每张都必须**自己显式导航**：紧邻的上一张（23-orch-full）停在 p04 且是全屏态，
    # 沿用「上一张的姿态」会拍到编排区。goto() 会顺手收起全屏。
    # 样本详情抽屉（v26）：本轮的核心改动。列表留在页面上挑、详情从右侧滑出，
    # 所以这张要一次把「左：列表明细可点 / 右：抽屉里五块详情」同框拍下来 ——
    # 只拍抽屉或只拍列表，都看不出「边翻边看」这件事。
    # 抽屉内容滚到顶：首屏就是特定样本条（四格彩底）+ 信息卡开头。
    # 左半边要露出**样本表的行** —— 「点某一行 → 右侧出详情」才看得出来；
    shot("50-samp-drawer.png",
         "document.querySelector('#modal').hidden = true;"
         "window.__go('gene'); "
         "window.__sampPick('S037');"
         "setTimeout(()=>{var b=document.querySelector('#drawerSamp .drawer__bd');"
         "if(b)b.scrollTop=0;"
         "var t=document.querySelector('#sampTbl tbody tr:nth-child(2)');"
         "t&&t.scrollIntoView({block:'center'});},140)")
    shot("32-samp-cross.png",
         "window.__go('gene'); "
         "document.querySelector('#modal').hidden=true;"
         "window.__sampPick('S004');"
         "document.querySelector('[data-samp-pick=\"S004\"]').click();"
         "setTimeout(()=>{var b=document.querySelector('#omTbl');"
         "b&&b.closest('.card').scrollIntoView({block:'center'});},160)")
    shot("33-samp-lineage.png",
         "window.__go('gene'); "
         "window.__sampPick('S037');"
         "window.__linAxis('col');"
         "setTimeout(()=>{var b=document.querySelector('#linBox');"
         "b&&b.closest('.card').scrollIntoView({block:'start'});},160)")
    # 同一张血缘图的「上下结构」视图。方向是全局偏好，拍完必须自己切回横向 ——
    # 后面的 49/35 都在同一页，留着 row 会把它们的血缘卡也拍成上下结构。
    shot("33b-samp-lineage-row.png",
         "window.__go('gene'); "
         "window.__sampPick('S037');"
         "window.__linAxis('row');"
         "setTimeout(()=>{var b=document.querySelector('#linBox');"
         "b&&b.closest('.card').scrollIntoView({block:'start'});},160)")
    # 特定样本条（四格）的血统配色。必须单拍一张：本次改动只落在 #sampKpis 上 ——
    # 没有这张图，看不出改的是哪一条。
    # （v46 之前它还兼作「同页基因 tab 那块 .mrow」的对照图，基因 tab 撤了之后
    #  对照对象没了，但它自己「这一条被改过」的取证意义仍在，保留。）
    # 它排在 33b 之后，血缘方向已由 33b 复位成 col，这里不再动方向。
    shot("49-samp-kpi.png",
         "window.__go('gene'); "
         "window.__sampPick('S037');"
         "setTimeout(()=>{var b=document.querySelector('#sampKpis');"
         "if(b){b.scrollIntoView({block:'center'});}},180)")
    # v46：删掉 `34-gene-tab.png` 那张（「同页没被改到的那处」的基因档案指标条对照图）——
    # 基因档案那一块整块撤了，没有「同页的另一处」可对照，这张图失去了存在理由。
    # 折叠态：收起后只剩标题行 + 「展开」按钮，跨组学表整表上移。
    # 与 33 那张同一页同一模块，合起来就是「收 / 开」两个姿态的对照。
    shot("35-samp-fold.png",
         "window.__go('gene'); "
         "window.__sampPick('S037');"
         "window.__linAxis('col');"
         "if(window.__sampState().linOpen)window.__linFold();"
         "setTimeout(()=>{var c=document.querySelector('#linCard');"
         "c&&c.scrollIntoView({block:'start'});},160)")
    # v46：删掉 `36-gene-rebuild.png` / `37-gene-running.png` / `38-gene-done.png` 三张 ——
    # 它们拍的是「重建档案」抽屉的配置 / 运行中 / 完成三态，抽屉整块撤了。
    # 样本档案两张：信息卡 / 登记弹窗（资料卡已随「样本资料」模块撤除）。
    # （v16 已删掉「功能介绍展开态」那张 —— 页面级介绍段落整体撤了，没有可展开的东西。
    #   当时的排序理由「都排在 40 之前」随之作废，现在的排序理由见下面每张的注释。）
    # 每张自己显式 __go + 选样本，不靠上一张的余温。
    shot("41-samp-info.png",
         "document.querySelector('#modal').hidden = true;"
         "window.__go('gene'); "
         "window.__sampPick('S037');"
         "setTimeout(()=>{var c=document.querySelector('#sampInfoCard');"
         "c&&c.scrollIntoView({block:'start'});},180)")
    # 样本列表：45 排在 44 之前，因为 44 会开「登记新样本」弹窗且不带关闭动作。
    # 这张要的是**抽屉收起**的列表全貌（翻页、四维筛选、选中行都能看到），
    # 所以显式把抽屉关掉 —— 抽屉开着会压掉列表右侧四列。
    shot("45-samp-list.png",
         "document.querySelector('#modal').hidden = true;"
         "window.__sampDrawer(false);"
         "window.__goHome(); window.__go('gene'); "
         "window.__sampReset();"
         "window.__sampPick('S037'); window.__sampDrawer(false);"
         "setTimeout(()=>{var c=document.querySelector('#sampListCard');"
         "c&&c.scrollIntoView({block:'start'});},200)")
    shot("44-samp-new.png",
         "document.querySelector('#modal').hidden = true;"
         "window.__goHome(); window.__go('gene'); "
         "setTimeout(()=>{document.querySelector('[data-samp-new]').click();},200)")
    # 文件管理三态（v29）：个人 / 团队 / 系统。__fmReset 先回内置默认 ——
    # 验证段上传的 S076_1 若不清掉，截图上会多出一个会话产物。
    # 51 展开第一个文件夹（嵌套文件行 + 操作图标都看得见）；
    # 52 展开团队文件夹（「上传人」列是团队范围的权限语义）；
    # 53 系统文件（v56 起默认身份 = 超级管理员，**可写**：上传区在、删改按钮在）；
    # 53b 同一页在只读身份下（上传区换成说明、删改按钮变禁用态）——
    #     权限这件事断言查得到，但「关掉和打开差多少」只有对照图看得出来。
    shot("51-fm-mine.png",
         "document.querySelector('#modal').hidden = true;"
         "window.__go('files');"
         "window.__fmReset();"
         "setTimeout(()=>{var d=document.querySelector('#fmBody [data-fm-dirtoggle]');"
         "d&&d.click();"
         "var c=document.querySelector('#fmListCard');"
         "c&&c.scrollIntoView({block:'start'});},220)")
    shot("52-fm-team.png",
         "document.querySelector('#modal').hidden = true;"
         "window.__go('files');"
         "window.__fmReset(); window.__fmScope('team');"
         "setTimeout(()=>{var d=document.querySelector('#fmBody [data-fm-dirtoggle]');"
         "d&&d.click();"
         "var c=document.querySelector('#fmListCard');"
         "c&&c.scrollIntoView({block:'start'});},220)")
    shot("53-fm-sys.png",
         "document.querySelector('#modal').hidden = true;"
         "window.__go('files');"
         "window.__fmReset(); window.__fmScope('sys');"
         "setTimeout(()=>{var c=document.querySelector('#fmListCard');"
         "c&&c.scrollIntoView({block:'start'});},220)")
    shot("53b-fm-sys-ro.png",
         "document.querySelector('#modal').hidden = true;"
         "window.__go('files'); window.__fmReset();"
         # 切到普通用户：系统文件只剩只读形态，这张与 53 是同一页的对照。
         # 收尾必须复位身份 —— 身份是全站共享状态，漏掉会让后面每张截图
         # 都停在普通用户（这条坑 v54 已在知识库模式上犯过一次）。
         "window.__role('user'); window.__fmScope('sys');"
         "setTimeout(()=>{var c=document.querySelector('#fmUpCard');"
         "c&&c.scrollIntoView({block:'start'});},220);"
         "setTimeout(()=>{window.__role('super');},400)")
    # 下载确认弹窗（v17）：本轮的核心新增，必须有一张图证明它长什么样 ——
    # 「点了先弹框、框里写清文件名/行数/来源」这件事，断言查得到，但没人看得见。
    # 排在序列最末：它会开弹窗且不关。开头先把 44 留下的登记弹窗关掉。
    shot("46-dl-confirm.png",
         "document.querySelector('#modal').hidden = true;"
         "window.__goHome(); window.__go('gene'); "
         "setTimeout(()=>{var b=document.querySelector('[data-dl=\"samples\"]');"
         "if(b)b.click();},260)")
    # ── v37 新增：另存为新模板弹窗（需求 4）──────────────────────────────
    # 「改过的流程点运行会被拦下来」这条链路有三张脸：拦住你的提醒框、填名字的
    # 另存框、以及保存后左侧列表里真多出来的那一条。光断言查得到，没人看得见。
    # 先改一步画布（删掉一个节点 → 与来源模板不再一致），否则 runOrchFlow 会
    # 直接放行到 p05，弹不出提醒框。
    # 需求 4 后半的第一张脸：改过的流程点「运行此流程」→ 先弹提醒框（不是直接跑）。
    # 「改一步」用的是节点表里的删除按钮，属性名 data-node-del ——
    # 写成 data-orch-del 会让这一下静默落空，图就变成「运行本来就该放行」的样子。
    shot("62a-orch-run-guard.png",
         "document.querySelector('#modal').hidden = true;"
         "window.__goHome(); window.__goRaw('p04');"
         "setTimeout(function(){"
         "window.__orchPick('f01');"
         "var d = document.querySelector('[data-node-del=\"0\"]'); if (d) d.click();"
         "var r = document.querySelector('[data-orch-run]'); if (r) r.click();"
         "},260)")
    # 第二张脸：从提醒框转进「另存为新模板」框（填名字 + 节点清单）。
    shot("62-orch-saveas.png",
         "document.querySelector('#modal').hidden = true;"
         "window.__goHome(); window.__goRaw('p04');"
         "setTimeout(function(){"
         "window.__orchPick('f01');"
         "var d = document.querySelector('[data-node-del=\"0\"]'); if (d) d.click();"
         "window.__orchSave(true);"
         "},260)")

    # （v37 需求 1 的 55-agent-full.png 随浮窗整体撤除，v53 ——
    #    问答卡全屏那态由 64-wb-full.png 表达，这张不再有对应物。）

    # ── v38 新增：主页「问答交互」卡全屏（需求 1）────────────────────────
    # 与上面 55 那张是两码事：那张是右下角浮窗铺满，这张是主页侧栏里的卡片
    # 脱离页面流铺满。铺没铺满、浮球有没有被藏、气泡有没有宽到读不下去，
    # 断言读得到数字，但「一眼看过去是不是真的占满一屏」只有截图能证明。
    # 收尾不在这里做：下一张 56 的 setup 会先 __go('files')，跳页即自动复位。
    shot("64-wb-full.png",
         "document.querySelector('#modal').hidden = true;"
         "window.__goHome(); window.__go('p01');"
         "setTimeout(function(){"
         "var q = document.querySelector('#wbAgentQs [data-ask=\"查看项目\"]'); if (q) q.click();"
         "},160);"
         "setTimeout(function(){"
         "var b = document.querySelector('[data-wb-full]'); if (b) b.click();"
         "},640)")

    # ── v37 新增：示例数据集两级文件夹（需求 2）──────────────────────────
    # 系统文件里「示例数据集」下挂三个子夹，这是本轮新做的层级；一张图同时
    # 证明「一级展开 → 三个子夹」「子夹再展开 → 里面有文件」两件事。
    shot("56-fm-demo.png",
         "document.querySelector('#modal').hidden = true;"
         "window.__go('files');"
         "window.__fmReset(); window.__fmScope('sys');"
         "setTimeout(function(){"
         "var a = document.querySelector('[data-fm-dirtoggle=\"示例数据集\"]'); if (a) a.click();"
         "setTimeout(function(){"
         "var b = document.querySelector('[data-fm-dirtoggle=\"示例数据集/院内队列\"]'); if (b) b.click();"
         "var c = document.querySelector('#fmListCard'); c && c.scrollIntoView({block:'start'});"
         "},120);"
         "},200)")

    # ── 新建项目向导（v37 建 / v39 由 5 步合为 4 步 / v47 补足 6 步）────────
    # 六步各一张。v39 把「分组方案」与「比较方案」合成一步（本系统里这两件事
    # 本来就在同一屏上定完），所以 59 那张是**一屏两块**；
    # v47 按真实的「创建分析流程」补回「流程模版」与「参数配置」两步 ——
    # 60 从「完成回执」变成「流程模版」，回执挪到 75，另加 74 拍参数配置。
    # 步骤条的推进态、两栏布局（选文件 / 分组 / 流程）和完成回执都得能看到。
    shot("57-proj-wiz1.png",
         "window.__goHome(); window.__go('proj');"
         "setTimeout(function(){ window.__projNew(0); },220)")
    # v48 需求 1：样本ID「一键全选」。与 57 同一屏，差别就在表头那颗全选
    # 与「已选 20 例」—— 不单拍一张的话，「多了个全选控件」这件事看不出来。
    # 滚动用容器 scrollTop 直接算（不用 scrollIntoView）：后者会顺手把
    # **页面**也滚一下，把要展示的东西顶出视口，v47 的 72 号图踩过一次。
    shot("77-pn-sidall.png",
         "setTimeout(function(){"
         "window.__projNew(0);"
         "var b = document.querySelector('#modalB [data-pn=\"sid-all\"]');"
         "if (b) b.click();"
         "var p = document.querySelector('#modalB .pnpick');"
         "var bd = document.querySelector('#modalB .wiz__bd');"
         "if (p && bd) bd.scrollTop += p.getBoundingClientRect().top"
         " - bd.getBoundingClientRect().top - 64;"
         "},220)")
    # v48 需求 2：新增样本ID 子编辑器 —— 底栏一颗「返回」+ 一颗「确定」。
    # 取证点有两处：① 返回这颗真的在；② 底栏**没有**「取消」（原先那颗挂的是
    # 全局 cancel，点下去会把整个新建项目窗口关掉，用户填的东西全丢）。
    shot("78-pn-sidnew.png",
         "setTimeout(function(){"
         "window.__projNew(0);"
         "var b = document.querySelector('#modalB [data-pn=\"sid-new\"]');"
         "if (b) b.click();"
         "var v = {'pnSidId':'S076','pnSidName':'P076 肝癌组织','pnSidSrc':'院内手术室'};"
         "Object.keys(v).forEach(function(k){var e=document.querySelector('#'+k); if(e)e.value=v[k];});"
         "var ty = document.querySelector('#pnSidType'); if (ty) ty.value='组织';"
         "var ds = document.querySelector('#pnSidDesc');"
         "if (ds) ds.value='补登：病理号 B2026-1076，与 S037 同受试者';"
         "},220)")
    shot("58-proj-wiz2.png",
         "setTimeout(function(){ window.__projNew(1); },200)")
    shot("59-proj-wiz3.png",
         "setTimeout(function(){ window.__projNew(2); },200)")
    shot("60-proj-wiz4.png",
         "setTimeout(function(){ window.__projNew(3); },200)")
    shot("74-proj-wiz5.png",
         "setTimeout(function(){ window.__projNew(4); },200)")
    # 75 = 回执（进这一步就已经落库）。**它必须与 63 共用同一条 PNEW** ——
    # 63 只负责点「完成」，不再重新调一次探针：探针每次都会 openProjNew() 重开，
    # 再来一次 pnewCreate() 就会建出第二条项目，把「14 个项目」的全局口径弄脏。
    shot("75-proj-wiz6.png",
         "setTimeout(function(){ window.__projNew(5); },200)")
    # 收尾：走完「完成」那一按，证明项目真的落进「项目管理」列表首行 ——
    # 需求 6 的后半句是「项目创建完成后进入到项目管理列表」，这一步得拍下来。
    # 探针建的这条项目要留到这张图拍完（否则首行看不到它）；真正撤掉它的动作
    # 放在 48 的开头，免得把后面以「13 个项目」为口径的链路污染成 14。
    shot("63-proj-newdone.png",
         "setTimeout(function(){"
         "var b = document.querySelector('[data-pn=\"done\"]'); if (b) b.click();"
         "var c = document.querySelector('[data-projview=\"list\"]'); if (c) c.click();"
         "},180)")

    # ── v47 需求 3：系统管理 › 项目组管理 ─────────────────────────────
    # 三张分别回答三个问题：这张表长什么样（72）、增删改长什么样（73）、
    # 没有权限的人看到什么（76）。三张都从「段首显式设身份 + 恢复出厂名单」开始 ——
    # 驱动段最后把身份复位成管理员了，靠余温拍会拍成同一张脸；
    # 而驱动段还新建过一条、删掉过一条，不恢复就拍不到默认长相。
    # 也**不要**在这里 scrollIntoView：那会把工具条（创建 / 删除 / 搜索 / 刷新）
    # 顶出视口 —— 那排按钮正是这一页要展示的东西，实测第一次就拍丢了。
    shot("72-projgroup.png",
         "window.__pgReset();"
         "window.__go('projgroup');"
         "setTimeout(function(){"
         "var c = document.querySelector('#content'); if (c) c.scrollTop = 0;"
         "},220)")
    shot("73-projgroup-edit.png",
         "setTimeout(function(){"
         "var b = document.querySelector('#page-projgroup [data-pg-new]'); if (b) b.click();"
         "},220)")
    shot("76-projgroup-ro.png",
         "setTimeout(function(){"
         "var b = document.querySelector('#modal [data-pg-cancel]'); if (b) b.click();"
         "window.__role('user');"      # v54：页头身份开关撤了，只读态靠切顶栏身份
         "},200)")

    # ── v39 新增：项目概况页（「查看详情」的落点从抽屉升成整页）───────────
    # 抽屉塞不下六个切面，v39 把它换成整页。65 / 66 要证明的正是**「整页 + 题签」**
    # 这件事：切一个页签，正文整块换掉 —— 抽屉版做不到这一屏。
    # 两张都从「样本信息」/「分析流程」这两个**非首屏**页签取景，理由很直接：
    # 29-proj-detail 拍的已经是首屏（info）那张脸，65 再拍一次就是同一张图拍两遍
    # （实测两张 PNG 只差 5 字节）。页头 + 六页签在 29 里已经看得到。
    # 一律用 P-2026-001：它是有运行记录、样本也最多的那一条，切到哪个页签都有内容。
    # 两张都要自己显式导航：上一张 76 停在项目组管理的**只读态**，
    # 沿用余温不仅拍不到概况页，连身份都还是「普通用户」——
    # 所以这里顺手把身份复位成超级管理员（截图段的「段首显式设起点」规矩）。
    shot("65-pd-sample.png",
         "window.__pg({ role:'super' });"
         "document.querySelector('#modal').hidden = true;"
         "window.__go('proj');"
         "setTimeout(function(){ window.__projDetail('P-2026-001','sample'); },220)")
    shot("66-pd-run.png",
         "setTimeout(function(){ window.__projDetail('P-2026-001','run'); },220)")
    # v40 需求 4：数据集是分析项目跑出来的产物，所以给它一个页签。
    # 这一屏要拍的是「输入 / 输出分开列 + 每条带产出任务」——
    # 输入是外部导入（产出任务那列写「外部导入」），输出才挂 job 号，
    # 这条前后关系一眼可辨，也是「数据集属于项目」这句话最直接的证据。
    shot("69-pd-dataset.png",
         "setTimeout(function(){ window.__projDetail('P-2026-001','dataset'); },220)")
    # ── v41：项目详情层的两条新脸 ─────────────────────────────────────────
    # 70 拍的是「左栏整条换成这个项目自己的菜单」这件事 —— 29-proj-detail 里
    # 左栏还是全局菜单，那是 v40 之前的脸。这一张同时要能看到「项目详情 / 分析执行 /
    # 分析结果 ▸ 各模块」三层与右侧五条页签。
    # 71 拍的是「分析结果」下的模块页：顶栏分析进度 + 横向流程条（当前步高亮）
    # + 本步产出。这一屏是新加的，没有它这两个页面在文档里就成了空话。
    shot("70-pd-rail.png",
         "window.__go('proj');"
         "setTimeout(function(){ window.__projDetail('P-2026-001','info'); },220)")
    shot("71-pd-mod.png",
         "setTimeout(function(){ window.__projDetail('P-2026-001',undefined,undefined,4); },220)")

    # 任务运行页的流水线：要拍「跑动中」，不能拍「全绿」——
    # 全绿的图分不出完成 / 运行中 / 等待三态，而这三种状态正是这张图要表达的东西。
    # 提交后会先进算力排队（提交的结果，不是一个开关），所以要点掉排队引导才会真的开跑；
    # 两个 setTimeout 串起来：420ms 时开跑，1.1s 时快照 → 落在第 2 个阶段运行中。
    shot("48-run-pipe.png",
         "(function(){"
         "document.querySelector('#modal').hidden = true;"
         # 撤掉 63 留下的探针项目，后面「13 个项目」的口径才不被污染
         "window.__projDropNew();"
         "window.__goHome(); window.__goRaw('p06');"
         "window.scrollTo(0,0);"
         "setTimeout(function(){ var b = document.querySelector('#btnRun'); if (b) b.click(); },140);"
         "setTimeout(function(){"
         "var b2 = document.querySelector('#btnRun'); if (b2) b2.click();"
         "window.scrollTo(0,0);"
         "},460);"
         "})()")

    # ── v50 需求 2：数据汇集页的选数据面板 ────────────────────────────────
    # 原来是「上传组学数据」拖拽卡（默认数据还在本机），现在是与文件管理、
    # 向导第 2 步同源的两栏选择器。这一屏是整轮的形状变化，只能靠图说清：
    # 左边「已选择的文件」有没有条目、右边三档与文件树长什么样。
    # 所以不是拍空态 —— 先勾两行再拍，否则左栏是空态，看不出「勾了会怎样」。
    # 段首显式设起点：上一张 48 停在 p06 的跑动态，靠余温会拍成运行页。
    shot("79-p02-picker.png",
         "(function(){"
         "document.querySelector('#modal').hidden = true;"
         "window.__goHome(); window.__p02Reset(); window.__goRaw('p02');"
         "setTimeout(function(){"
         "var t = document.querySelectorAll('#p02Pick .pntree__f input');"
         "if (t[2]) t[2].click(); if (t[3]) t[3].click();"
         "window.scrollTo(0, 0);"
         "},240);"
         "})()")

    # ── v50 需求 3：新建项目的两条入口 ────────────────────────────────────
    # 「一键全流程分析 / 智能分析」这一屏由 30-proj-new 拍（它就是「点新建项目
    # 看到的第一屏」）。这里不再重复拍一张 —— 同形图多一张只会让文档更难读。

    # ── v51：智能分析第 5 步「查看分析结果」（结果全景的第二个宿主）────────
    # 这一页的正文是**挂载出来的** —— 进页面时由 mountPano() 把 #panoTpl 克隆进
    # #resMount。所以这张图同时是「挂载成功了」的视觉证据：断言能数出 13 张图、
    # 6 个视图、三张表体有行，却数不出「图有没有画在正确的位置、宽度是不是 0」
    # （藏在 display:none 的页里量到 0 宽，图会挤成一条线，而读数一切正常）。
    # 段首显式设起点（这一页在菜单外，走直达），并先切到「差异表达」——
    # 默认的「基因变异」只有 2 张图，看不出这块内容的密度。
    shot("80-p07-result.png",
         "(function(){"
         "document.querySelector('#modal').hidden = true;"
         "window.__goHome(); window.__goRaw('p07');"
         "setTimeout(function(){"
         "var b = document.querySelector('#viewSeg [data-view=\"de\"]'); if (b) b.click();"
         "window.scrollTo(0, 0);"
         "},220);"
         "})()")

    # ── v52：智能分析线的「运行分析」先弹「完善项目信息」────────────────────
    # 弹窗是 runMetaBody() 现拼的 —— 断言能数出七个字段，数不出「回填行长什么样」：
    # .rbfill 是虚线框 + 品牌浅底，与真输入框的视觉差别只能靠图交代。
    # 驱动段已把 RUNMETA 填好并确认过，这里重开弹窗就是带着值的样子（一张图说两件事：
    # 七项结构在位 + 回填两行真的有值）。82 张的是确认后的落点：p06 顶上那条
    # 「本次分析信息」—— 填完就没了的话，那次填写就是假交互。
    shot("81-runmeta-modal.png",
         "(function(){"
         "window.__goHome(); window.__goRaw('p05');"
         "setTimeout(function(){"
         "var b = document.querySelector('#btnRunAna'); if (b) b.click();"
         "window.scrollTo(0, 0);"
         "},220);"
         "})()")
    shot("82-p06-metabar.png",
         "(function(){"
         "document.querySelector('#modal').hidden = true;"
         "window.__goRaw('p06');"
         "window.scrollTo(0, 0);"
         "})()")

    # 输出
    print(json.dumps(data, ensure_ascii=False, indent=1))

    # ── 判定：关键断言收在一处，跑完直接读结论，不必人肉翻 JSON ──
    FAILS, TOTAL = [], [0]

    def need(label, cond, got=None):
        TOTAL[0] += 1
        if not cond:
            FAILS.append(label + ('' if got is None else '（实际 %r）' % (got,)))

    # 探针字典的安全视图：读不到的键返回 None，而不是抛 KeyError。
    # 理由很实在 —— 判定段有 400 多条断言，只要有一条引用了本轮删掉的探针键，
    # 整个判定段就会在那一行崩掉，**后面所有断言的结果一条都看不到**，
    # 一次只能修一处还得重跑三分半。返回 None 让那条断言自己变红
    # （真实原因会跟着「实际 None」打出来），其余断言照常给结论。
    class _Miss(object):
        """缺失探针键的哨兵：属性 / 下标 / 调用 / len / 算术一律不报错，但一律为假。

        为什么不直接返回 None：None 遇上 len() 或 +1 照样抛 TypeError ——
        等于把「一条断言引用了本轮删掉的探针键」升级成「整段判定崩掉、后面
        几百条结果全看不到」。返回这个哨兵，那条断言自己变红，
        原因就写在「实际 <缺失>」里，其余断言照常给结论。"""
        def __getattr__(self, k):      return self
        def __getitem__(self, k):      return self
        def __call__(self, *a, **k):   return self
        def __len__(self):             return 0
        def __iter__(self):            return iter(())
        def __bool__(self):            return False
        def __eq__(self, o):           return False
        def __ne__(self, o):           return True
        def __contains__(self, o):     return False
        def __add__(self, o):          return self
        __radd__ = __sub__ = __mul__ = __truediv__ = __add__
        # 大小比较也要兜住：`_Miss >= 3.5` 走的是 __ge__，而 `3.5 >= _Miss`
        # 会先试 float.__ge__（NotImplemented）再反查到 __le__ —— 四个都得给。
        # 同理 `'x' in _Miss`、`len(_Miss)`。「活过这一次」的代价是这些断言
        # 悄悄变红而不是报错：红的那条会把「实际 <缺失>」打出来，找得到源头。
        def __lt__(self, o):           return False
        def __le__(self, o):           return False
        def __gt__(self, o):           return False
        def __ge__(self, o):           return False
        def __repr__(self):            return '<缺失>'

    MISS = _Miss()

    class _Safe(dict):
        def __missing__(self, k):
            return MISS

    def _safe(o):
        if isinstance(o, dict):
            return _Safe({k: _safe(v) for k, v in o.items()})
        if isinstance(o, list):
            return [_safe(x) for x in o]
        return o

    d = _safe(data)
    # v49：运行日志在「系统管理」组里是一个菜单项 —— 到了就把左栏收起来，
    # 等于把「你正站着的这一格」也一起藏了，看上去就是整页进了全屏、左栏不见了。
    # 所以这里断的是**反过来的事实**：左栏在场、当前项高亮、正文只占剩下的那一列
    # （不是「反正没报错」）。宽度也要量：网格列数与 --rail-w 一脱节，
    # 正文会被压窄甚至挤成 0，而 is-on / h1 / rows 全都是对的。
    _lg = d['logRail']
    need('运行日志页保留左栏：左栏在场、当前项高亮、正文落在剩下的那一列里',
         _lg['off'] is False and _lg['snavVis'] is True and _lg['cols'] == 2
         and _lg['cur'] == '运行日志' and _lg['rows'] >= 10
         and abs(_lg['bodyW'] - (_lg['vp'] - _lg['railW'])) <= 2,
         _lg)
    # v49：左栏恢复常驻后这条筛选栏（7 字段 + 3 按钮）开始折行 —— 折行可以，
    # 「折在哪」不行：起始/结束日期是**同一个区间**的两个端点，被拆到两行就断了读法；
    # 动作组紧贴「结束日期」落下来，读起来像按钮属于那一格。
    _lf = d['logFilt']
    need('运行日志筛选条：起始/结束日期同行、动作组贴右侧（不紧贴字段）',
         _lf['datesSameRow'] is True and _lf['actRight'] <= 2 and _lf['fieldRows'] <= 2,
         _lf)
    need('左栏收起后正文占满宽度',   d['railAuto']['cols'] == 1
                                     and d['railAuto']['bodyW'] >= d['railAuto']['vp'] * 0.9
                                     and d['railAuto']['pageW'] >= d['railAuto']['vp'] * 0.9,
                                     d['railAuto'])
    # 顶栏左段的深色块必须跟着左栏一起收：不收的话白底上会剩一根没有柱身的色块，
    # 而它的文字是浅色 —— 「左栏收起」这个动作会顺手把品牌区变成不可读。
    need('左栏收起时顶栏深色块一起撤走',
         d['railAuto']['appOff'] and d['railAuto']['capDisp'] == 'none',
         {'appOff': d['railAuto']['appOff'], 'capDisp': d['railAuto']['capDisp']})
    need('左栏收起后品牌文字仍可读', d['railAuto']['brandRatio'] >= 4.5, d['railAuto']['brandRatio'])
    # v39：多出来的第 16 页是「项目概况」—— 它由项目列表钻进去，不在左栏菜单里。
    # v42：反向也成立 —— 撤掉「结果全景」独立页，页数 16→15，菜单项同时 14→13。
    # v47：系统管理组加「项目组管理」，页数 15→16、菜单项 13→14（**两项一起涨**：
    #       它是能独立打开、也真的进菜单的一页）。
    # v50 需求 4：智能分析整组（4 页）撤离菜单 ——
    # 上一版这里写的是「页数 = 菜单项数 + 2」那个等式，本轮**整条废了**：
    # 页数还是 16，菜单项却从 14 掉到 10，差值不再是 2 而是 6。
    # 一条「页数 − 菜单项数 = 常数」的等式，只有在「哪些页不上菜单」不变时才成立；
    # 而本轮动的恰恰就是那一批。所以换成不含任何常数的**分类不变式**：
    # 每个页面要么在菜单里、要么落进 offMenu 这批，两者并集必须正好等于全部页面。
    # v51：智能分析补上第 5 步「查看分析结果」，页数 16→17。菜单项**不动**（还是 10）——
    # 它落在那个整组 off 的分组里，多一页不会让菜单长出东西来。
    # 这正是分类不变式的价值：页数与菜单项数各自独立变化，谁涨谁不涨都断得住。
    need('17 页',
         d['orch']['pageCount'] == 17, d['orch']['pageCount'])
    need('页面要么在菜单里、要么在菜单外这批 —— 没有第三种',
         len(d['ia']['offMenu']) == 7
         and sorted(d['ia']['offMenu']) == ['p02', 'p04', 'p05', 'p06', 'p07',
                                            'projdetail', 'sample'],
         d['ia']['offMenu'])
    # v39 需求 1：项目空间挪到智能分析**上方**。项目是数据的归属方 ——
    # 先有项目，才有被它约束的分析流程，菜单顺序要跟这条因果一致。
    # v50 需求 4：智能分析整组撤离，所以这张名单只剩 4 组、项数 14→10。
    need('左栏 4 分组 / 10 项（项目空间排在知识赋能之前）',
                                     d['ia']['navItems'] == 10
                                     and d['ia']['navGroups'] == ['数据资产', '项目空间',
                                                                  '知识赋能', '系统管理'], d['ia'])
    # 「页面照旧可达」的**逐页**证据：15 个页面全部真的切到了（含菜单外的 5 页）。
    # 这条以前写不出来 —— 那时循环遇到没有按钮的页面会 `continue` 静默跳过，
    # 「可达」只覆盖了菜单里的那些；本轮之前改了驱动，菜单外的页面改走直达入口，
    # 于是「每一页都到得了」成了可断的事实。
    # ⚠ 不要去断「哪几页必须走 raw」：goPage() 在左栏里找不到时会兜到**任意**
    # `[data-go]` 按钮（数据汇集 / 流程模板这些页面里本来就到处是「下一步」），
    # 于是菜单外的页面照样是 'nav' —— 那不是漏网，是这条链路的第二条腿。
    # 「这几页不在菜单里」由上面 offMenu 那条守着，两条各管各的。
    need('15 个页面均可达（含撤出菜单的 5 页）',
         len(d['nav']) == 15 and all(d['nav'][p] is True for p in d['nav']),
         {'nav': d['nav'], 'via': d['navVia']})
    need('工作台为顶级叶子项',        d['ia']['navTop'] == 1, d['ia']['navTop'])
    need('每个分组一个子项容器',       d['ia']['navLists'] == 4, d['ia']['navLists'])
    # 徽标是「同一条事实的第二个消费方」：数据层加了项目，左栏数字必须跟着走。
    # 断言成导航里的项目数 == 项目页卡片数（两侧都由本次运行的 DOM 现算），
    # 而不是再写死一个 13 —— 写死两处正是漂移的来源。
    # v40：数据集从菜单里撤了（收进项目概况的页签），所以徽标只剩两枚。
    # v47：系统管理组加了「项目组管理」，徽标回到三枚（多了项目组数）。
    # v50 需求 1：徽标**整块撤掉** —— 上面三个版本的账本全部作废。
    # 这里不再算「应该是几」：数量徽标原本有两个消费方（左栏 + 页面内文字），
    # 撤掉的是左栏那一个；页面内的计数（项目列表头「共 N 个项目」、文件管理计数、
    # 项目组页「可选 N 个」）**一个都没动**，它们仍由下面各自的断言守着。
    # 读数留在原位、期望值从「数字是多少」改成「一个都没有」——
    # 撤一个功能时顺手把探针删掉，就再没人守得住它没被悄悄加回来。
    need('左栏数字徽标一个都不剩（v50 需求 1）',
         d['ia']['navBadges'] == [], d['ia']['navBadges'])
    # v50 需求 4：「智能分析」整组不上菜单，但**页面与 data-go 按钮照旧**。
    # 四条拆开断，防的是「一撤就把整条线拆没了」——
    # 组标题不在、组内首项不在、五个页面都在、落点按钮还在。
    need('智能分析整组不上菜单、五个页面照旧可达',
         d['ia']['navSmartGroup'] == 0 and d['ia']['navSmartItem'] == 0
         and d['ia']['smartPages'] == 5 and d['ia']['smartGoBtns'] > 0,
         {'grp': d['ia']['navSmartGroup'], 'item': d['ia']['navSmartItem'],
          'pages': d['ia']['smartPages'], 'go': d['ia']['smartGoBtns']})
    # 层级靠「一级有图标 / 二级没有」表达：两侧都要断 ——
    # 一级掉图标是层级塌了，二级冒出图标是层级又糊了
    need('一级与顶级项都有图标',       d['ia']['navIcoTop'] == 0, d['ia']['navIcoTop'])
    need('二级条目没有图标',           d['ia']['navIcoSub'] == 0, d['ia']['navIcoSub'])
    # 几何判据：两级文字的缩进差落在可辨区间（拉平或过头都要红）
    need('二级缩进比一级文字更深',    8 <= d['ia']['navIndent']['sub'] - d['ia']['navIndent']['grp'] <= 40,
         d['ia']['navIndent'])
    # 折叠：初始全展开 → 收起后子项不可见且高度塌陷 → 复原 → 导航到组内页自动展开
    need('工作台是面包屑的根节点',     d['crumbTop']['grpGone'] and d['crumbTop']['homeGone']
                                     and d['crumbTop']['seps'] == 0
                                     and d['crumbTop']['page'] == '工作台'
                                     and d['crumbTop']['step'] == '总览', d['crumbTop'])
    need('面包屑祖先段可点、当前页不可点', d['crumbMid']['home'] == '工作台'
                                     and d['crumbMid']['homeTag'] == 'BUTTON'
                                     and d['crumbMid']['page'] == '样本档案'
                                     and d['crumbMid']['pageTag'] == 'SPAN'
                                     and d['crumbMid']['seps'] == 1
                                     and d['crumbMid']['stepHidden'], d['crumbMid'])
    need('单页分组不给分组段',         d['crumbMid']['grpGone'] is True, d['crumbMid'])
    need('全站说明条（.note）已清零',   d['noteBands'] == 0, d['noteBands'])
    need('分组首项页不给自己的分组段', d['crumbFirst']['p02']['grpGone'] is True
                                     and d['crumbFirst']['proj']['grpGone'] is True
                                     and d['crumbFirst']['kbmed']['grpGone'] is True
                                     and d['crumbFirst']['p02']['segs'] == ['工作台'], d['crumbFirst'])

    # ---- 导航：返回条已撤（v17），面包屑是界面唯一的返回入口 ----
    need('全站已无返回条（元素与属性都清掉）',
         d['navHome']['bars'] == 0 and d['navHome']['backAttrs'] == 0, d['navHome'])
    need('主页起点：无祖先段，标题与步骤正确',
         d['navHome']['cur'] == 'p01' and d['navHome']['segs'] == []
         and d['navHome']['crumb'] == '工作台' and d['navHome']['step'] == '总览', d['navHome'])
    # v37 需求 3 删掉「样本对齐」后，p04 从第 3 步前移到第 2 步，总数 6 → 5。
    need('深入后面包屑给出祖先段与步骤号',
         d['navDeep']['cur'] == 'p04' and d['navDeep']['segs'] == ['p01', 'p02']
         and d['navDeep']['crumbs'] == ['工作台', '智能分析']
         and d['navDeep']['curCrumb'] == '流程模板'
         and d['navDeep']['step'] == '步骤 2 / 5', d['navDeep'])
    need('点面包屑「工作台」回主页（到根后该段不再生成）',
         d['crumbHomeTap']['txt'] == '工作台'
         and d['crumbHomeTap']['after'] == 'page-p01'
         and d['crumbHomeTap']['segsAfter'] == [], d['crumbHomeTap'])
    need('横向来路（数据集→项目）没有返回条也回得去',
         d['navLateral']['cur'] == 'proj' and d['navLateral']['bars'] == 0
         and d['navLateral']['segs'] == ['p01']
         and d['navLateral']['crumbs'] == ['工作台']
         and d['navLateral']['after'] == 'page-p01', d['navLateral'])
    need('点面包屑组名落到组首页',     d['crumbTap']['group'] == '知识赋能'
                                     and d['crumbTap']['after'] == 'page-kbmed', d['crumbTap'])
    need('分组默认全展开',           d['navFoldInit']['expanded'] == 'true'
                                     and d['navFoldInit']['itemsVisible'] == 3
                                     and d['navFoldInit']['hiddenLists'] == 0, d['navFoldInit'])
    need('折叠箭头与 aria-controls',  d['navFoldInit']['chev'] and d['navFoldInit']['controls'],
         d['navFoldInit'])
    need('点标题收起该组',           d['navFold']['expanded'] == 'false'
                                     and d['navFold']['itemsVisible'] == 0
                                     and d['navFold']['listH'] == 0, d['navFold'])
    need('再点一次复原',             d['navFoldBack']['expanded'] == 'true'
                                     and d['navFoldBack']['hiddenLists'] == 0
                                     and d['navFoldBack']['itemsVisible'] == 3, d['navFoldBack'])
    need('导航到折叠组自动展开',       d['navAutoOpen']['expanded'] == 'true'
                                     and d['navAutoOpen']['hiddenLists'] == 0
                                     and d['navAutoOpen']['cur'], d['navAutoOpen'])
    # 知识赋能三页
    need('医学知识库页独立（检索默认态·临床诊疗域）', d['kbMed']['on'] == 'page-kbmed'
                                     and d['kbMed']['mode'] == '检 索'
                                     and d['kbMed']['dom'].startswith('临床诊疗')
                                     and d['kbMed']['recentRows'] == 4
                                     and d['kbMed']['cloudTerms'] > 0
                                     and d['kbMed']['addBtn'] is True
                                     and d['kbMed']['addInHead'] is True
                                     and d['kbMed']['tabBg'] == 'rgb(16, 99, 118)', d['kbMed'])
    need('知识域切换（多组学 3 分类 ↔ 临床诊疗）',
         d['kb2Dom']['on'].startswith('多组学') and d['kb2Dom']['recentRows'] == 3
         and d['kb2Dom']['cloudTerms'] > 0 and d['kb2Dom']['catOpts'] == 4
         and d['kb2DomBack']['on'].startswith('临床诊疗') and d['kb2DomBack']['recentRows'] == 4, d['kb2Dom'])
    need('多组学详情：字段对齐 + 跨组学关联网络',
         d['kb2DomNet']['title'] == 'TP53 突变'
         and 'Illumina' in d['kb2DomNet']['plat']
         and d['kb2DomNet']['net'] >= 1, d['kb2DomNet'])
    need('医学知识库浏览模式与字母筛选',  d['kb2Browse']['menu'] == 4
                                     # 菜单文本带计数徽章（如「疾病10」），只比前缀
                                     and d['kb2Browse']['menuOn'].startswith('疾病')
                                     and d['kb2Browse']['letters'] == 6
                                     and d['kb2Letter']['on'] == 'A-G'
                                     and d['kb2Letter']['words'] >= 1
                                     and d['kb2Letter']['words'] < d['kb2Letter']['all'], d['kb2Letter'])
    need('词条详情与页内面包屑返回',     d['kb2Detail']['vis'] is True
                                     and d['kb2Detail']['title']
                                     and d['kb2Detail']['secs'] >= 2
                                     and d['kb2Detail']['drows'] >= 5
                                     and len(set(d['kb2Detail']['vals'])) == len(d['kb2Detail']['vals'])
                                     and d['kb2Back']['detailGone'] is True
                                     and d['kb2Back']['browseBack'] is True, d['kb2Detail'])
    need('检索命中与空态',             d['kb2Search']['res'] > 0
                                     and d['kb2Search']['homeHidden'] is True
                                     and d['kb2NoHit']['emptyAlert'] >= 1, d['kb2Search'])
    need('检索详情：关联条目 + 临床实践规则 + 知识域行',
         d['kb2Detail2']['kbLinks'] >= 1 and d['kb2Detail2']['crumbMode'] == '检索'
         and d['kb2Detail2']['domRow'] is True and d['kb2Detail2']['rules'] >= 1, d['kb2Detail2'])
    need('管理模式：生命周期管道与状态筛选',
         d['kb2Admin']['pipeN'] == 4
         and d['kb2Admin']['stSum'] == d['kb2Admin']['total']
         and d['kb2Admin']['hasAdd'] is True
         and d['kb2Admin']['filtOn'] == '待审核'
         and d['kb2Admin']['filtRows'] == d['kb2Admin']['st']['review'], d['kb2Admin'])
    need('生命周期流转：归档可恢复（可逆）',
         d['kb2LC']['archAfter'] == d['kb2Admin']['st']['arch'] + 1
         and d['kb2LC']['pubAfter'] == d['kb2Admin']['st']['pub'] - 1
         and d['kb2LC']['back'] is True, d['kb2LC'])
    # ---- v40 知识采集：两段式 + 两种方式互斥 + 模块随域变化 ----
    need('知识采集第 1 步先选知识域：只给四张域卡，不给任何表单',
         d['kb2Step1']['modal'] is True and d['kb2Step1']['doms'] == 4
         and d['kb2Step1']['fields'] == 0 and d['kb2Step1']['upInput'] == 0
         and '选择知识域' in d['kb2Step1']['stepOn']
         and d['kb2Step1']['foot'] == ['取消'], d['kb2Step1'])
    need('选定知识域后进第 2 步：两种采集方式并排，且都还没被选中',
         d['kb2Step2']['domTag'] == '临床诊疗'
         and d['kb2Step2']['ways'] == 2 and d['kb2Step2']['waysOn'] == 0
         and d['kb2Step2']['empty'] == 1
         and d['kb2Step2']['baseFields'] == 0 and d['kb2Step2']['mods'] == 0
         and d['kb2Step2']['upInput'] == 0, d['kb2Step2'])
    need('选手动填写：长出本域专属模块（临床＝标准化临床实践规则），且没有上传区',
         d['kb2Manual']['modTitles'] == ['标准化临床实践规则']
         and d['kb2Manual']['ruleRows'] == 1
         and d['kb2Manual']['baseFields'] == 5
         and d['kb2Manual']['upInput'] == 0, d['kb2Manual'])
    need('切上传文件：手动模块整块消失，只剩上传区（两种方式不同时出现）',
         d['kb2Upload']['modTitles'] == ['上传与解析']
         and d['kb2Upload']['ruleRows'] == 0
         and d['kb2Upload']['upInput'] == 1 and d['kb2Upload']['upMultiple'] is True
         and '100MB' in d['kb2Upload']['hint'] and '20' in d['kb2Upload']['hint']
         and d['kb2Upload']['wayOn'] == 'upload', d['kb2Upload'])
    _mods = d['kb2ModByDom']
    need('换知识域＝换模块：四个域各自长出不同的专属模块',
         _mods['clin']['t'] == '标准化临床实践规则' and _mods['clin']['rules'] == 1
         and _mods['samp']['t'] == '样本溯源链' and _mods['samp']['rules'] == 0
         and _mods['omics']['t'] == '跨组学关联网络' and _mods['omics']['nets'] == 3
         and _mods['lit']['t'] == '文献结构化提炼' and _mods['lit']['nets'] == 0, _mods)
    need('新增知识采集：必填拦截 + 审核提醒 + 入库置顶',
         d['kb2Blocked']['modal'] is True and '新增知识采集' in d['kb2Blocked']['title']
         and d['kb2Blocked']['step'] == 2
         and '审核' in d['kb2AddRemind']['title']
         and '采集入库' in d['kb2AddRemind']['body']
         and '临床诊疗' in d['kb2AddRemind']['body']
         and '手动填写' in d['kb2AddRemind']['body']
         and d['kb2AddRemind']['hasBack'] is True and d['kb2AddRemind']['hasFinal'] is True
         and d['kb2AddBack']['step'] == 2
         and d['kb2AddBack']['modTitles'] == ['标准化临床实践规则']
         and d['kb2AddDone']['modalClosed'] is True
         and '新词条' in d['kb2AddDone']['firstCell']
         and d['kb2AddDone']['newTag'] >= 1
         and d['kb2AddDone']['total'] == d['kb2AddBefore'] + 1
         and d['kb2AddDone']['draftAfter'] == d['kb2Admin']['st']['draft'] + 1, d['kb2AddDone'])
    need('自有知识库页独立',          d['kbOwn']['on'] == 'page-kbown'
                                     and d['kbOwn']['hasUpload'], d['kbOwn'])
    need('自有知识库上传解析跑完',     d['kbOwnParseEnd']['done'] == d['kbOwnParseEnd']['steps']
                                     and d['kbOwnParseEnd']['verRows'] == d['kbOwn']['verRows'] + 1,
         d['kbOwnParseEnd'])
    need('知识图谱页独立',           d['kbGraph']['on'] == 'page-kbgraph'
                                     and d['kbGraph']['graphNodes'] > 0, d['kbGraph'])
    # 图谱重建进度曾是「机器学习建模」的残留步骤名（已被移除的建模口径）
    need('图谱步骤不再用建模口径',     '模型选择' not in d['kbGraph']['stepNames']
                                     and '超参调优' not in d['kbGraph']['stepNames'],
         d['kbGraph']['stepNames'])
    need('点图谱节点联动面板',        d['kbGraphNode']['selected'] == 1
                                     and d['kbGraphNode']['bodyLen'] > 0, d['kbGraphNode'])
    need('知识图谱重建六步完成',       d['kbGraphRebuild']['done'] == d['kbGraphRebuild']['steps'],
         d['kbGraphRebuild'])
    # 新增页
    need('样本档案是数据资产下的独立页', d['gene']['on'] == 'page-gene'
                                     and d['gene']['grpGone'] is True
                                     and d['gene']['stepHidden'] is True, d['gene'])
    # ---- 数据资产「样本档案」页：改名 / 单面板（v46 撤了基因档案）/ 血缘 / 跨组学 ----
    need('菜单与页标题改名为样本档案',  d['gene']['on'] == 'page-gene'
                                     and d['gene']['h1'] == '样本档案'
                                     and d['gene']['navLabel'] == '样本档案'
                                     and d['gene']['aria'] == '样本档案'
                                     and d['gene']['eye'].endswith('样本档案')
                                     and d['gene']['crumb'] == '样本档案', d['gene'])
    # v46：页内那个「基因档案」tab 整块撤了 —— 五样东西一起没了才叫撤干净：
    # 页签条、基因档案面板、分派用的页头按钮、它的清单表、重建档案抽屉。
    # （原来这条断的是「两个 tab 且默认 sample」+「基因 tab 里 4 格 7 行」。
    #   直接改成断「都没了」比删掉更值：撤除类改动最怕的就是撤了一半。）
    need('基因档案整块已撤（页签 / 面板 / 按钮 / 清单表 / 重建抽屉）',
         d['gene']['ptabs'] == 0 and d['gene']['genePanel'] is False
         and d['gene']['geneBtns'] == 0 and d['gene']['geneTable'] is False
         and d['gene']['geneDrawer'] is False, d['gene'])
    need('样本档案面板成为页面唯一内容且真的铺开',
         d['gene']['sampPanel'] and d['gene']['sampPanelH'] > 800
         and d['gene']['sampCards'] == 1,
         {'panel': d['gene']['sampPanel'], 'h': d['gene']['sampPanelH'],
          'cards': d['gene']['sampCards']})
    # 页头只剩「登记新样本 / 导出样本档案」两颗，都常显 —— 没有 tab 要分派了。
    # 断言按关键字匹配而不是整串等值：按钮文字前面还有图标，等值断言脆。
    need('页头只剩样本档案的两颗动作按钮（不再按 tab 分派）',
         len(d['gene']['headBtns']) == 2
         and any('登记新样本' in s for s in d['gene']['headBtns'])
         and any('导出样本档案' in s for s in d['gene']['headBtns']),
         d['gene']['headBtns'])
    # ---- 文件管理（独立页 #page-files，v33）：可见范围 = 权限模型 ----
    fm = d['fm']
    need('文件管理是数据资产组里紧跟样本档案的二级菜单页',
         fm['pageOn'] and fm['crumb'] == '文件管理'
         and fm['navPos']['has'] and fm['navPos']['afterGene'],
         (fm['pageOn'], fm['crumb'], fm['navPos']))
    # v37 需求 2 把「示例数据集」做成系统文件下的一级夹，其下再挂三个子夹，
    # 9 份示例文件全在子夹里（根目录下不再有它们）—— 所以 sys 的目录数 2→3、
    # 文件数 5→14。这两个数都从 fmFiles/fmDirs 现算，不是拍脑袋写的。
    need('文件管理页默认态为个人文件',
         fm['st0']['scope'] == 'mine'
         and fm['st0']['n'] == {'mine': 6, 'team': 5, 'sys': 14}
         and fm['st0']['dirs'] == {'mine': 3, 'team': 2, 'sys': 3},
         fm['st0'])
    need('个人文件默认态（无上传人列 · 根目录 · 不限格式多选）',
         fm['mine']['segOn'] == ['mine'] and fm['mine']['upCard'] is True
         and fm['mine']['loc'] == '根目录' and fm['mine']['headWho'] is False
         and fm['mine']['dirRows'] == 3 and fm['mine']['noNest'] is True
         and fm['mine']['acceptFree'] is True, fm['mine'])
    need('文件夹展开后文件行嵌套并同步 aria',
         fm['nestN'] == 2 and fm['expandAria'] == 'true', (fm['nestN'], fm['expandAria']))
    need('更改上传位置弹窗可选可命中并生效',
         fm['locRows'] == 4 and fm['locHit']['ok'] is True and fm['loc2'] == '肝细胞癌 批次A',
         (fm['locRows'], fm['locHit'], fm['loc2']))
    # 断「+1」这个不变量而不是某个总数：总数会随内置数据条数变（本轮 sys 5→14），
    # 每次加数据都要改一次写死的合计，而它真正想表达的只是「上传真的落库了」。
    need('待上传清单上传后入库（mine 6→7 · 全站 +1）',
         fm['pend'] == 1 and fm['st1']['n']['mine'] == 7
         and fm['st1']['uploaded'] == 1
         and (fm['st1']['n']['mine'] + fm['st1']['n']['team'] + fm['st1']['n']['sys']
              - (fm['st0']['n']['mine'] + fm['st0']['n']['team'] + fm['st0']['n']['sys'])) == 1,
         (fm['pend'], fm['st1'], fm['st0']))
    need('内置文件下载如实告知且不弹确认框',
         fm['dlModal'] is False and '内置条目' in fm['dlToast'], (fm['dlModal'], fm['dlToast']))
    need('新建文件夹 → 重命名 → 删除全链路',
         fm['dirMade'] is True and fm['rnHit']['ok'] is True and fm['renamed'] is True
         and fm['delHit']['ok'] is True and fm['dirGone'] is True,
         (fm['dirMade'], fm['rnHit'], fm['renamed'], fm['delHit'], fm['dirGone']))
    need('搜索文件名过滤命中且排除其余',
         fm['qState'] == 'S037' and fm['qHit'] is True and fm['qMiss'] is True,
         (fm['qState'], fm['qHit'], fm['qMiss']))
    need('团队文件带上传人与项目组筛选',
         fm['team']['headWho'] is True and fm['team']['pjFlt'] is True
         and fm['team']['pjOpts'] == 3 and fm['team']['projSel'] is True
         and fm['team']['whoCell'] is True, fm['team'])
    need('团队上传未选项目组被拦下',
         fm['teamBlocked'] is True, fm['teamBlocked'])
    need('v56 系统文件对超级管理员可写（上传区 / 新建 / 删改都在）',
         fm['sys']['upCardShown'] is True and fm['sys']['dzShown'] is True
         and fm['sys']['newdirShown'] is True and fm['sys']['canDel'] is True, fm['sys'])
    # 读权限不在这里判：系统文件默认折叠，列表里只有 3 行文件夹、没有文件行，
    # 此时 [data-fm-view] 恒为 0 —— 量到的是「没有文件」不是「没有按钮」。
    # 读权限由 __fmPerm 那条判（它会先展开、量完复原），见下面「读权限三档都开着」。
    # ---- v37 需求 2：「示例数据集」两级文件夹（系统文件里）----
    # 这一条把三层结构一次断清：一级夹 → 三个子夹 → 子夹里的文件。
    # 「展开后行数变多」只证明有内容，证明不了层级 —— 所以另加两条几何判据：
    #   · 子夹行比一级夹行更靠右（左边界更大）→ 视觉上真的退了一级；
    #   · 文件行比子夹行更靠右 → 三级没塌成两级。
    _dm2 = fm['demo']
    need('系统文件里「示例数据集」是一个可展开的一级文件夹',
         _dm2['lv1'] == 1 and '示例数据集' in _dm2['lv1Txt'], _dm2['lv1Txt'])
    need('「示例数据集」下挂院内队列 / 人类公开 / 小鼠公开三个子夹',
         _dm2['subs'] == [1, 1, 1]
         and all(n in t for n, t in zip(['院内队列', '人类公开', '小鼠公开'], _dm2['subTxt'])),
         _dm2['subTxt'])
    need('三级结构逐级缩进：一级夹 < 二级子夹 < 三级文件行',
         -1 < _dm2['lvPad']['dir'] < _dm2['lvPad']['sub'] < _dm2['deepPad'],
         (_dm2['lvPad'], _dm2['deepPad']))
    need('子夹展开前不出现深层文件行（层级不是摆样子）',
         _dm2['deepBefore'] == 0 and _dm2['deepAfter'] >= 3, _dm2)
    need('子夹展开后落出的是「院内队列」那三份示例文件',
         sorted(_dm2['deepNames']) == ['TJ-TCM-RNAseq-75_fpkm.tsv.gz',
                                       'TJ-TCM-WGS-75.vcf.gz',
                                       'TJ-TCM-scRNA-lung-12.h5ad'], _dm2['deepNames'])
    need('系统文件目录数随新增夹 +1（2 → 3）', _dm2['dirCount'] == 3, _dm2['dirCount'])

    # ---- 样本详情抽屉（v26）：五块详情从面板搬进右侧滑出抽屉 ----
    # 四条一起量：状态位 / 形态（贴右满高）/ 变化量（主内容真让出宽度）/ 命中测试。
    # 「命中测试」里特意带上**页面上的列表控件** —— 用户选的是「抽屉开着照样翻列表」，
    # 遮罩式实现（给 #content 盖一层、或抽屉带遮罩）会在这条上露馅。
    _d0 = d['sampDrawer0']
    need('进样本档案页时抽屉默认收起 · 面板只剩列表',
         _d0['hidden'] and _d0['panelCards'] == 1, _d0)
    _d1 = d['sampDrawer1']
    need('抽屉是真抽屉：贴右满高、浮在内容之上',
         not _d1['hidden'] and _d1['isOpen'] and _d1['position'] == 'fixed'
         and _d1['coversRight'] and _d1['fullH'] and int(_d1['z']) >= 60,
         {'position': _d1['position'], 'z': _d1['z'], 'w': _d1['w'], 'h': _d1['h'],
          'right': _d1['right'], 'vw': _d1['vw'], 'vh': _d1['vh']})
    # 变化量：只改类名不缩宽度的话，抽屉会压住列表右侧而不是把列表让窄 ——
    # 这里比的是同一张卡的前后宽度，量的是「内容真的收了」。
    _px = lambda v: float(str(v).replace('px', '') or 0)
    need('抽屉滑出后主内容让出宽度（不是压在列表上）',
         _px(_d1['padRight']) >= _d1['w'] and _px(_d1['padRight']) > _px(_d0['padRight'])
         and _d1['listW'] < _d0['listW'] and _d1['bodyCls'],
         {'listW前': _d0['listW'], 'listW后': _d1['listW'],
          'padRight前': _d0['padRight'], 'padRight后': _d1['padRight'],
          'drawerW': _d1['w'], 'bodyCls': _d1['bodyCls']})
    # 「五块都搬进去了」：不是数抽屉里有多少卡，而是逐块确认它的宿主换成了抽屉
    need('四块详情（指标/信息/血缘/跨组学）都住在抽屉里',
         all(_d1['moved']) and _d1['head'] == _d1['cur'],
         {'moved': _d1['moved'], 'head': _d1['head'], 'cur': _d1['cur'], 'sub': _d1['sub']})
    need('抽屉开着，页面上的列表照样可点（无遮罩）',
         all(_d1[k]['ok'] for k in ('hitClose', 'hitRow', 'hitPager')),
         {k: _d1[k] for k in ('hitClose', 'hitRow', 'hitPager')})
    # 抽屉体是 flex 列且高度确定：子项默认 flex-shrink:1，不显式挡一下就**整体被压扁**。
    # 受害者首推 #sampKpis（.mrow 的 overflow:hidden 让自动最小尺寸退化成 0），
    # 压扁后颜色、间距、「四格一行」三条断言全绿，只有截图看得见。
    need('抽屉里的每块详情都没被压扁（内容不溢出自身高度）',
         all(c['d'] <= 2 for c in _d1['clipped']),
         _d1['clipped'])
    # 点另一行是「原地换内容」：关掉重开会有一次滑入动画，看着像闪一下
    _d2 = d['sampDrawer2']
    need('抽屉开着点另一行：内容原地切换，不关不重播',
         _d2['want'] == _d2['cur'] == _d2['head'] and _d2['stillOpen'] and _d2['isOpen'],
         _d2)
    # Esc 分层：先退抽屉里开出的弹窗，抽屉自己留着；再按一次才收抽屉
    _e1, _e2, _e3 = d['sampDrawerEsc1'], d['sampDrawerEsc2'], d['sampDrawerEsc3']
    need('Esc 分层退出：先关弹窗再收抽屉',
         _e1['modal'] and _e1['drawer']
         and not _e2['modal'] and _e2['drawer']
         and not _e3['drawer'] and not _e3['bodyCls'],
         {'开弹窗': _e1, '一次Esc': _e2, '二次Esc': _e3})
    # v46：原来这里断的是「切 tab / 跳页都会收起抽屉」。页面没有可切的 tab 了，
    # 只留「跳页」这一路 —— 抽屉是某一页的浮层，跳走还挂在屏幕上就是幽灵面板。
    need('跳页会收起抽屉（不留幽灵面板）',
         not d['sampDrawerNav']['drawer'] and d['sampDrawerNav']['page'] == 'page-p01',
         d['sampDrawerNav'])
    _dc = d['sampDrawerClose']
    need('关闭按钮把抽屉与让出的宽度一起还回去',
         _dc['hidden'] and not _dc['bodyCls']
         and _px(_dc['padRight']) == _px(_d0['padRight']),
         {'关闭后': _dc, '初始': {'padRight': _d0['padRight']}})
    # 二级钻取链路（v39 起语义变了）：项目详情从「盖在样本抽屉上的二级抽屉」
    # 升为独立页面 —— 跨组学表的「查看数据」现在是一次真跳页，
    # 样本抽屉跟着收起（抽屉是样本档案页的浮层，跳走了还挂着就是幽灵面板，
    # 与 v26「切 tab / 跳页都会收起抽屉」是同一条规矩）。
    _j0, _j1, _j2, _j3 = d['sampDrill0'], d['sampDrill1'], d['sampDrill2'], d['sampDrill3']
    need('跨组学「查看数据」跳到项目概况页（不再叠一层抽屉）',
         _j0['hasBtn'] and _j0['sampOpen']
         and _j1['onPage'] and _j1['pageId'] == 'page-projdetail'
         and _j1['sampClosed'] and _j1['cur'] == 'S037'
         and _j1['tag'] == 'P-2026-001' and '原发性肝癌' in _j1['name']
         and _j1['flash'], _j1)
    # 面包屑 = 两段可点（工作台 / 项目管理）+ 末尾当前段「项目概况」。
    # 当前段是 #crumb（不可点的那格），不在 .crumb__l 里 —— 所以这里断的是
    # 「可点段只有这两条回头路」+「当前段写着项目概况」，而不是三段都叫 crumb__l。
    need('项目概况是页面：页面上没有关闭键，返回只走面包屑',
         _j1['noCloseBtn'] == 0
         and _j1['crumb'] == ['工作台', '项目管理']
         and _j1['crumbCur'] == '项目概况'
         and _j1['crumbParent'] == '项目管理', _j1)
    need('面包屑「项目管理」段把用户送回列表页，且详情页确实退场',
         _j2['onList'] and _j2['detailOff'], _j2)
    need('不经样本抽屉也能直达项目概况（页面不依赖任何浮层），且直接落在「数据集」页签',
         _j3['onPage'] and _j3['tag'] == 'P-2026-001'
         and _j3['tab'] == 'dataset' and _j3['sv'] is False, _j3)
    need('样本段起点就绪（S037 · 抽屉已开）',
         d['sampDrawerReady']['cur'] == 'S037' and d['sampDrawerReady']['drawer'],
         d['sampDrawerReady'])

    # 候选区只铺 12 个可点 chip，第 13 个是「还有 N 例 · 见下方列表」的提示 ——
    # 75 例全铺会把查询卡撑成三行
    need('样本档案默认选中 S037 · 选中态在列表行上（chips 已撤）',
         d['samp0']['chipsGone'] and d['samp0']['rowOn'] == 1
         and d['samp0']['onId'] == 'S037'
         and d['samp0']['kpi'] == 2, d['samp0'])
    # 边数不写死：受试者 → 采集物也是一条真实边（v24 补上后每个样本 +1），
    # 恒定的是「每个非根节点恰有一个父」→ 边数 == 节点数 - 1。
    need('血缘图 7 节点、每条边都有唯一父节点',
         d['samp0']['nodes'] == 7 and d['samp0']['edges'] == d['samp0']['nodes'] - 1
         and d['samp0']['badge'] == 7, d['samp0'])

    # ---- 特定样本条：条有底色、两格两色、彩字压彩底 ≥ 4.5 ----
    _kt = d['sampKpiTone']
    _W = ('rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)', 'transparent')
    need('特定样本条不再是白底白带（条底与四格底都不是白）',
         _kt['wrap'].replace(' ', '') not in [x.replace(' ', '') for x in _W]
         and all(c['bg'].replace(' ', '') not in [x.replace(' ', '') for x in _W]
                 for c in _kt['cells']),
         {'wrap': _kt['wrap'], 'cells': _kt['hues']})
    # 「有底色」不等于「看得见」：第一版取的 #F1F7FD 与页面底 #F5F8FC 只差 1.4%
    # 亮度，色值上确实是彩的、屏幕上还是一条白带。所以判据是**与页面底的亮度比**。
    need('条底与页面底拉得开（加的是看得见的底色，不是自欺欺人的 1%）',
         _kt['wrapVsPaper'] >= 1.10, {'wrap': _kt['wrap'], 'paper': _kt['paper'],
                                      'ratio': _kt['wrapVsPaper']})
    # 层次是有方向的：彩带是底、四格浮在它上面，每格比条底**亮**一档。
    # ⚠️ 别拿 cellVsWrap 那个对称比判方向 —— ratio() 算的是
    #    (max+0.05)/(min+0.05)，恒 ≥1，写成 > 1.0 等于永远通过：
    #    真把四格做得比条还深（层次反转），这条照样是绿的。
    #    所以这句判的是**亮度本身**，且要求拉得开 ≥0.02（光「不等于」不够）。
    need('两格浮在彩带上（每格都比条底亮一档，不糊进条里）',
         all(c['L'] > _kt['wrapL'] for c in _kt['cells'])
         and min(c['L'] - _kt['wrapL'] for c in _kt['cells']) >= 0.02,
         {'wrapL': _kt['wrapL'], 'cellL': [c['L'] for c in _kt['cells']],
          'sym': _kt['cellVsWrap']})
    need('两格各自上色（两格两色，不是同一个色号刷两遍）',
         _kt['n'] == 2 and len(set(_kt['hues'])) == 2, {'n': _kt['n'], 'hues': _kt['hues']})
    need('每格顶部 3px 色条真的渲染出来（inset 阴影，不是只挂了个类名）',
         all('inset' in c['bar'] and '3px' in c['bar'] for c in _kt['cells'])
         and all(c['radius'] != '0px' for c in _kt['cells']),
         {'bars': _kt['bars'], 'radius': [c['radius'] for c in _kt['cells']]})
    # 血缘顶栏那四个色是配白底的（白字压顶栏 / 深字压白卡身），直接搬来当浅底
    # 文字色会掉到 4.1:1 —— 所以这里量的是「格子实际底色 vs 实际文字色」，逐格看。
    need('彩底上的标签 / 数值 / 脚注对比度 ≥4.5',
         _kt['minR'] >= 4.5,
         {'min': _kt['minR'],
          'per': [{'v': c['v'], 'rV': c['rV'], 'rL': c['rL'], 'rF': c['rF']} for c in _kt['cells']]})
    # gap 从 1px 变 10px 是为了让条的底色看得见；格子仍须并排（挤成两行说明宽度不够）。
    need('特定样本条两格仍并排一行、条底在格间露得出来',
         _kt['rows'] == 1 and _kt['gap'] >= 6 and _kt['pad'] >= 6,
         {'rows': _kt['rows'], 'gap': _kt['gap'], 'pad': _kt['pad']})
    # ⚠ 「四格一行」不足以说明这条没被压坏：抽屉体是 flex 列时整体会被压成 20px 高，
    #   四格照样在一行、颜色照样对、间距照样是 10 —— 只有高度塌了。
    #   高度与内容一起判：塌掉的盒子 scrollHeight > clientHeight。
    need('特定样本条没被抽屉的 flex 列压塌（高度够、内容不溢出）',
         _kt['wrapH'] >= 90 and _kt['wrapClip'] <= 2
         and all(c['h'] >= 70 and c['sh'] - c['h'] <= 2 for c in _kt['cellH']),
         {'wrapH': _kt['wrapH'], 'wrapClip': _kt['wrapClip'],
          'cellH': _kt['cellH']})

    # ---- 血缘谱系：横向「层级 = 列」布局（本节取代原纵向四层）----
    _ll = d['linLayout']
    need('血缘按层级排成 4 列、列名由数据现算',
         _ll['heads'] == ['样本源', '样本类型', '分装样本', '衍生模型']
         and len(_ll['colsX']) == 4, {'heads': _ll['heads'], 'x': _ll['colsX']})
    # 列 x 坐标不写死具体值：它等于 ci*列宽 + 居中偏移，只要「等间距」成立即可，
    # 改列宽时不必回来改断言。
    # ⚠ 图宽同样不写死：血缘图从 v26 起住在右侧抽屉里，容器宽 770（页面上曾按 1110
    # 铺满）。写死 1000 的话，把详情搬进抽屉这一刀会以「等间距不成立」的样子报出来，
    # 而真正变的是容器 —— 改成「等分 + 落在容器内」这个与住处无关的不变式。
    _step = _ll['vb'][2] // 4
    need('同层节点对齐同一列且列宽等分',
         len(_ll['colsX']) == 4
         and _ll['colsX'] == [_ll['colsX'][0] + i * _step for i in range(4)]
         and _ll['vb'][2] == 4 * _step and 560 <= _ll['vb'][2] <= 1100
         and _ll['vb'][2] <= _ll['cw'],
         {'x': _ll['colsX'], 'step': _step, 'vb': _ll['vb'], '容器': _ll['cw']})
    need('连线是正交折线，不含贝塞尔曲线',
         _ll['curved'] == 0 and _ll['edges'] == _ll['nodes'] - 1,
         {'curved': _ll['curved'], 'edges': _ll['edges'], 'nodes': _ll['nodes']})
    need('图的显示宽度 = viewBox 宽（不许被容器拉伸）',
         _ll['scale'] == 1 and _ll['cw'] > _ll['vb'][2],
         {'scale': _ll['scale'], '容器': _ll['cw'], 'vb宽': _ll['vb'][2]})
    need('节点卡顶栏用白字，对比度 ≥ 4.5',
         all(o['white'] for o in _ll['ink'])
         and min(o['ratio'] for o in _ll['ink']) >= 4.5,
         sorted(set((o['bg'], o['ratio']) for o in _ll['ink'])))
    need('样本源卡带图标且真的渲染出来了',
         _ll['ico']['n'] == 1 and _ll['ico']['w'] > 8 and _ll['ico']['h'] > 8, _ll['ico'])
    need('血缘图有节点列表作为数据表替代视图',
         _ll['tblBtn'] and _ll['tblRows'] == _ll['nodes'],
         {'rows': _ll['tblRows'], 'nodes': _ll['nodes']})

    # ---- 方向切换：横向泳道 ⇄ 上下结构（v24）----
    _a0, _ar, _ab = d['linAxis0'], d['linRow'], d['linBack']
    need('默认横向泳道，按钮写「点下去会变成什么」',
         _a0['axis'] == 'col' and _a0['btn']['label'] == '上下结构'
         and _a0['btn']['hit'] and _a0['btn']['icoW'] > 8, _a0['btn'])
    need('点一下切成上下结构：层级落在行上（4 行）、出现分叉点',
         _ar['axis'] == 'row' and _ar['g']['rows'] == 4
         and _ar['g']['cardW'] >= 150 and _ar['g']['joint'] >= 1
         and _ar['btn']['label'] == '横向泳道' and _ar['btn']['hit'],
         {'axis': _ar['axis'], 'rows': _ar['g']['rows'], 'cardW': _ar['g']['cardW'],
          'joint': _ar['g']['joint'], 'btn': _ar['btn']})
    # 换方向只换排布，不换数据：节点 / 边 / 徽标 / 替代视图四处的数字必须一致
    need('换方向不换数据：节点、边、徽标、节点列表与横向视图一致',
         _ar['g']['nodes'] == _a0['col']['nodes']
         and _ar['g']['edges'] == _ar['g']['nodes'] - 1
         and _ar['g']['badge'] == _a0['col']['badge']
         and _ar['g']['tblRows'] == _ar['g']['nodes'],
         {'row': _ar['g'], 'col': _a0['col']})
    need('上下结构同样是正交折线，且不被容器缩放',
         _ar['g']['curved'] == 0 and _ar['g']['scale'] == 1
         and _ar['g']['vb'][2] <= 1100 and _ar['g']['cw'] >= _ar['g']['vb'][2],
         {'curved': _ar['g']['curved'], 'scale': _ar['g']['scale'],
          'vb宽': _ar['g']['vb'][2], '容器': _ar['g']['cw']})
    need('上下结构里顶栏白字对比度 ≥ 4.5、图标真的渲染出来',
         _ar['g']['inkMin'] >= 4.5 and _ar['g']['ico']['n'] == 1
         and _ar['g']['ico']['w'] > 8 and _ar['g']['ico']['h'] > 8,
         {'inkMin': _ar['g']['inkMin'], 'ico': _ar['g']['ico']})
    # 方向是 UI 偏好：换个样本、跳页往返都不该弹回默认
    # （v46 前这里是「换个样本、切个 tab」—— 页面没有可切的 tab 了，换成跳页往返：
    #   断的东西没变，都在证「这个偏好既不属于某个样本、也不属于某个页面」。）
    need('换样本 / 跳页往返后方向保持（它是 UI 偏好，不是样本属性）',
         d['linKeepS']['axis'] == 'row' and d['linKeepT']['axis'] == 'row',
         {'换样本': d['linKeepS'], '跳页往返': d['linKeepT']})
    need('再点一下切回横向泳道：层级回到列上、分叉点撤掉',
         _ab['axis'] == 'col' and _ab['g']['colXs'] == 4
         and _ab['g']['cardW'] >= 150 and _ab['g']['joint'] == 0
         and _ab['btn']['label'] == '上下结构',
         {'axis': _ab['axis'], 'colXs': _ab['g']['colXs'], 'cardW': _ab['g']['cardW'],
          'joint': _ab['g']['joint'], 'btn': _ab['btn']})
    # 卡宽与槽距联合求解的守门人：只要有人回头把「先定槽距、再把卡缩到某个
    # 最小系数」写回来，卡就会比槽距宽、兄弟互相压 —— 而这一眼看不出是重叠。
    need('两种排布下同层卡片都不互相压（留白 ≥ 12px）',
         _a0['col']['rowGap'] >= 12 and _ar['g']['rowGap'] >= 12
         and _ab['g']['rowGap'] >= 12,
         {'横向': _a0['col']['rowGap'], '上下': _ar['g']['rowGap'],
          '切回横向': _ab['g']['rowGap'], '卡宽': [_a0['col']['cardW'], _ar['g']['cardW']]})

    need('血缘节点、列表行与查询控件可点', d['samp0']['hitNode']['ok'] and d['samp0']['hitRow']['ok']
                                     and d['samp0']['hitQ']['ok'],
         {'node': d['samp0']['hitNode'], 'row': d['samp0']['hitRow'], 'q': d['samp0']['hitQ']})
    need('跨组学表 3 行 7 列且材料同行',  d['samp0']['omRows'] == 3 and d['samp0']['omCols'] == 7
                                     and 'S037-L' in d['samp0']['omBlob'] and 'S037-B' in d['samp0']['omBlob']
                                     and 'P-2026-013' in d['samp0']['omBlob'], d['samp0'])
    need('筛选标签与空态默认收起（宽高 0）', d['samp0']['filterW']['w'] == 0 and d['samp0']['emptyW']['w'] == 0
                                     and d['samp0']['filterW']['h'] == 0, d['samp0'])
    need('点血缘节点筛出该材料的组学',    d['samp1']['focus'] == 'S037-L' and d['samp1']['rows'] == 2
                                     and d['samp1']['filterW']['w'] > 0 and d['samp1']['onNodes'] == 1,
         d['samp1'])
    need('筛选后只剩该材料贡献的记录',    'S037-B' not in d['samp1']['rowBlob']
                                     and 'S037-L' in d['samp1']['rowBlob'], d['samp1'])
    need('再点同一节点取消筛选',         d['samp2']['focus'] == '' and d['samp2']['rows'] == 3
                                     and d['samp2']['filterW']['w'] == 0, d['samp2'])
    need('血缘节点键盘可达（Enter 等价点击）', d['sampKey']['focus'] == 'S037-B'
                                     and d['sampKey']['rows'] == 1, d['sampKey'])
    need('查询按 ID / 疾病 / 受试者都能命中', d['sampQ']['s068']['rows'] == 1
                                     # 疾病命中 58 例，列表分页 15/页 —— 当前页铺满
                                     and '58' in d['sampQ']['dx']['meta']
                                     and d['sampQ']['dx']['rows'] == 15
                                     and d['sampQ']['subj']['rows'] == 1, d['sampQ'])
    need('无命中显空态、有命中收起空态',  d['sampQ']['none']['ids'] == 0
                                     and d['sampQ']['none']['empty']['w'] > 0
                                     and d['sampQ']['dx']['empty']['w'] == 0, d['sampQ'])

    # ---------- 样本列表（v14） ----------
    # 覆盖口径由数据现算。原先还与「样本对齐」页写死的 75 / 75 / 71 / 71 对照，
    # v37 该页下线后只剩样本档案一处口径 —— 所以这里断的是它自己的不变式
    # （三组学样本数 ≥ 可联合分析数，且共同可分析数 = 三者最小值），
    # 而不是照抄那组数字：照抄就只是把常量抄了两遍，数据变了照样绿。
    _cv = d['sampCov']
    need('样本档案覆盖口径自洽：75 例 · 三组学各 ≥ 共同可分析 71',
         _cv == {'n': 75, 'g': 75, 't': 75, 'p': 71, 'all': 71}
         and min(_cv['g'], _cv['t'], _cv['p']) == _cv['all']
         and _cv['n'] >= _cv['g'], _cv)
    _sl = d['sampList']
    need('列表每页 15 行 · 8 个维度列',  _sl['rows'] == 15 and _sl['cols'] == 8, _sl)
    need('列表首行是 S001（按 ID 排）',    _sl['first'] == 'S001', _sl['first'])
    need('组学覆盖三个字标 · 首例全产出',  _sl['omtags'] == 3 and _sl['omOn'] == 3, _sl)
    need('分页器报出 15 / 75',            '共 75 条' in _sl['pager']
                                     and _sl['pager'].startswith('第 1'), _sl['pager'])
    _p2 = d['sampPage2']
    need('翻到第 2 页换一批样本',          _p2['first'] == 'S016'
                                     and _p2['pager'].startswith('第 16')
                                     and _p2['cur'] == '2' and _p2['prevOn'], _p2)
    _fl = d['sampFlt']
    need('筛质控不合格得到 4 例',          _fl['rows'] == 4 and '筛出 4 例' in _fl['meta'], _fl)
    need('这 4 例正是缺蛋白组的 4 例',      sorted(_fl['ids']) == ['S004', 'S021', 'S052', 'S063']
                                     and _fl['omOn'] == 2, _fl)
    _fo = d['sampFltOm']
    need('筛「缺 1 路」落在同一批样本上',   _fo['rows'] == 4 and '筛出 4 例' in _fo['meta'], _fo)
    _fr = d['sampFltReset']
    # 无筛选时只说「共 N 例」——「筛出 75 例」等于总数，是句废话
    need('重置筛选回到全量 75 例',          _fr['rows'] == 15 and _fr['qc'] == '' and _fr['om'] == ''
                                     and _fr['meta'] == '共 75 例', _fr)
    _so = d['sampSort']
    need('点列头排序单调且方向可逆',        _so['ascOk'] and _so['descOk'] and _so['sortedN'] == 1, _so)
    _lc = d['sampLocate']
    need('列表把选中项带到可见页',          _lc['onId'] == 'S037' and _lc['onRows'] == 1
                                     and _lc['page'] == '3', _lc)
    _rp = d['sampRowPick']
    need('点列表行切详情并标出当前行',      _rp['cur'] == _rp['target'] and _rp['onRows'] == 1
                                     and _rp['onId'] == _rp['target']
                                     and _rp['kpiFirst'] == _rp['target'], _rp)
    need('换样本后血缘与组学同步',       d['sampS4']['cur'] == 'S004' and d['sampS4']['nodes'] == 3
                                     and d['sampS4']['rows'] == 3, d['sampS4'])
    need('缺失组学显式标出、不静默少一行', d['sampS4']['missRows'] == 1 and '缺失' in d['sampS4']['missBlob'],
         d['sampS4'])
    need('跳项目概况页的数据集页签并定位到明细块',
         d['sampJump']['open'] and d['sampJump']['tab'] == 'dataset'
                                     and d['sampJump']['tag'] == 'P-2026-001'
                                     and d['sampJump']['name'] and d['sampJump']['back']
                                     and d['sampJump']['flash']
                                     and 0 < d['sampJump']['secTop'] < 900, d['sampJump'])
    # v46：删掉了「切到基因档案 tab 几何互换」与「可切回样本档案 tab」两条 ——
    # 页面没有可切的 tab 了（对应的 R.sampTabG / R.sampTabBack 两组探针同批撤掉）。
    # 血缘谱系折叠开关。一律断言**几何**：display:none 的元素 client rect 是 0，
    # 而任何「看着没了」的东西都不是 0 —— 只查类的写法测不出「其实还占着位」。
    # 默认展开的高度阈值不能写死：横向布局后 S037（3 列 3 行）是 284，
    # 生成样本（3 列 1 行）只有 132。绑到 viewBox 高度上 —— 顺带钉住「没被容器拉伸」。
    need('血缘谱系默认展开',             abs(d['linFold0']['boxH'] - d['linFold0']['svgH']) < 1
                                     and d['linFold0']['boxH'] > 120
                                     and d['linFold0']['hidden'] is False
                                     and d['linFold0']['aria'] == 'true'
                                     and d['linFold0']['label'] == '收起', d['linFold0'])
    need('收起后图几何归零',            d['linFold1']['boxH'] == 0
                                     and d['linFold1']['bodyH'] == 0 and d['linFold1']['hidden'] is True
                                     and d['linFold1']['cardH'] < d['linFold0']['cardH'] - 300,
         d['linFold1'])
    need('收起态四处同步（aria/文案/title/图标）', d['linFold1']['aria'] == 'false'
                                     and d['linFold1']['label'] == '展开'
                                     and '展开' in d['linFold1']['title']
                                     and d['linFold1']['tf'] != 'none'
                                     and d['linFold1']['tf'] != d['linFold0']['tf']
                                     and d['linFold0']['tf'] == 'none', d['linFold1'])
    need('收起后标题行只留摘要、不再提点节点', d['linFold1']['meta'].endswith('衍生关系')
                                     and '点节点' not in d['linFold1']['meta']
                                     and '点节点' in d['linFold0']['meta'], d['linFold1'])
    need('收起态切样本仍刷新数字且不弹开',  d['linFoldKeep']['hidden'] is True
                                     and d['linFoldKeep']['boxH'] == 0
                                     and d['linFoldCur'] == 'S004'
                                     and d['linFoldKeep']['meta'].startswith('3 个节点'),
         d['linFoldKeep'])
    need('收起态跳页回来仍收起',         d['linFoldKeepTab']['boxH'] == 0, d['linFoldKeepTab'])
    need('再展开逐像素复位',             d['linFoldExpanded'] is True
                                     and d['linFoldBack']['boxH'] == d['linFold0']['boxH']
                                     and abs(d['linFoldBack']['cardH'] - d['linFold0']['cardH']) <= 2
                                     and d['linFoldBack']['meta'] == d['linFold0']['meta'],
         d['linFoldBack'])
    need('折叠开关自己接得住点击',       d['linFold0']['hit']['ok'] and d['linFold1']['hit']['ok']
                                     and d['linFold1']['btnW'] > 40, d['linFold1'])
    # ══════ 样本档案：信息与资料（「存放样本信息和资料」这一轮）══════
    _si = d['sampInfo']
    _f = dict((r[0], r[1]) for r in _si['fields'])
    need('样本信息卡 4 组 16 字段',      _si['groups'] == 4 and _si['rows'] == 16,
         {'groups': _si['groups'], 'rows': _si['rows']})
    need('信息分组标题与顺序正确',
         _si['titles'] == ['标识信息', '临床信息', '采集与处理', '存储与位置'],
         _si['titles'])
    # 字段值必须逐条核对：只数个数的话，整张字段表漂了而个数照样是对的
    need('信息卡字段来自顶层字段（不是另存的一份）',
         _f.get('样本 ID') == 'S037' and _f.get('样本源ID') == 'SUBJ-0371'
         and _f.get('样本类型') == '肝组织 + 外周血' and _f.get('采集时间') == '2026-03-14'
         and _f.get('存放条件') == '液氮 / -80 ℃',
         dict((k, _f.get(k)) for k in ['样本 ID', '样本源ID', '样本类型', '采集时间', '存放条件']))
    need('分装 / 衍生数取自血缘谱系',    _si['splitDeriv']['v'] == '2 份分装 · 3 份衍生', _si['splitDeriv'])
    need('所属项目取自跨组学记录',       _si['projects']['v'] == 'P-2026-001 · P-2026-013', _si['projects'])

    need('S068 有别名 ↔ 血缘多一个节点与一条 ID 映射边',
         d['sampAlias']['nodes'] == 5
         and d['sampAlias']['edges'] == d['sampAlias']['nodes'] - 1, d['sampAlias'])
    need('血缘列数随数据增减（S068 多一层「原始登记 ID」）',
         d['sampAlias']['heads'] == ['样本源', '原始登记 ID', '样本类型', '分装样本'],
         d['sampAlias']['heads'])

    _no = d['sampNewOpen']
    need('登记弹窗打开、两个下拉都有选项',
         _no['open'] and _no['dx'] == 6 and _no['mats'] == 6 and _no['cohort'] == 'TJ-TCM-2026', _no)
    need('登记弹窗控件都能被自己接住',
         _no['hitId']['ok'] and _no['hitSubj']['ok'] and _no['hitCohort']['ok'] and _no['hitStore']['ok'],
         {'id': _no['hitId']['got'], 'cohort': _no['hitCohort']['got']})
    need('空 ID 不许登记',
         d['sampNewEmpty']['open'] and d['sampNewEmpty']['n'] == 75
         and '样本 ID' in d['sampNewEmpty']['toast'], d['sampNewEmpty'])
    need('含空格与斜杠的 ID 不许登记（会被当成选择器片段用）',
         d['sampNewBad']['open'] and d['sampNewBad']['n'] == 75, d['sampNewBad'])
    need('与已有样本撞 ID 不许登记',
         d['sampNewDup']['open'] and d['sampNewDup']['n'] == 75
         and '已经建档' in d['sampNewDup']['toast'], d['sampNewDup'])

    _nd = d['sampNewDone']
    need('登记成功后档案多一例并自动切过去（列表行高亮新样本）',
         _nd['modal'] and _nd['n'] == 76 and _nd['cur'] == 'S076'
         and _nd['chipsGone'] and _nd['rowOnId'] == 'S076', _nd)
    # v46：删掉了「页签总例数文案跟着变」那条 —— 页签撤了，计数现在只由列表卡 meta
    # 一处表达（重复写两处同一个数字本来就是冗余，撤掉页签等于顺手去掉一份）。
    need('新样本血缘只有受试者 → 采集物两层',
         _nd['nodes'] == 2 and _nd['edges'] == _nd['nodes'] - 1,
         {'nodes': _nd['nodes'], 'edges': _nd['edges']})
    need('新样本跨组学是空态、不是空白表',
         _nd['omRows'] == 1 and '尚未在任何项目中产出组学数据' in _nd['omBlob']
         and _nd['omMeta'] == '尚未产出组学数据', {'meta': _nd['omMeta'], 'blob': _nd['omBlob'][:70]})
    need('新样本 KPI 不留空档（没例号就不出「·  ·」）',
         '·  ·' not in ' '.join(_nd['kpiF']) and '第 76 例' in ' '.join(_nd['kpiF']), _nd['kpiF'])
    need('新样本信息卡仍按 6 组 27 字段渲染（缺项显示「——」）',
         _nd['infoGroups'] == 4 and _nd['infoFields'] == 16 and '尚未上架' in _nd['infoBlob'],
         {'groups': _nd['infoGroups'], 'fields': _nd['infoFields']})
    need('登记有结果提示',                '已登记入档' in _nd['toast'], _nd['toast'])

    # 状态值垫 soft 底压深字：直接拿 --color-warn 铺白底只有 4.25:1，过不了 AA
    need('样本信息状态值对比度 ≥4.5',
         d['siInkMin'] >= 4.5 and len(d['siInk']) > 0,
         {'min': d['siInkMin'], 'items': d['siInk']})
    need('探针收尾回位到 S037（32/33 截的是它）',
         d['sampRestore']['cur'] == 'S037', d['sampRestore'])

    # ---- v40 需求 2：系统管理 › 示例数据集（显示 / 简介 / 封面）----
    _pi, _ph, _pn, _pc, _pa, _pr = (d['pubdsInit'], d['pubdsHide'], d['pubdsIntro'],
                                    d['pubdsCover'], d['pubdsAllOff'], d['pubdsReset'])
    need('示例数据集设置页：9 条内置数据集逐条可设（显示开关 / 简介 / 封面三件）',
         _pi['n'] == 9 and _pi['rows'] == 9 and _pi['toggles'] == 9 and _pi['checked'] == 9
         and len(_pi['intros']) == 9 and len(_pi['imgs']) == 9
         and _pi['covers'] == 3 and _pi['noCover'] == 6
         and _pi['count'] == '显示 9 / 9 条' and _pi['hidden'] == '全部显示中'
         and _pi['cur'] == '院内队列 3 · 人类公开 3 · 小鼠公开 3'
         and (_pi['frontOwn'], _pi['frontHuman'], _pi['frontMouse']) == (3, 3, 3)
         and _pi['frontHumanImg'] == 0, _pi)
    need('显示开关真实作用于前台：隐藏一条 → 数据汇集页那组少一张',
         _ph['shown'] == 8 and _ph['checked'] == 8 and _ph['frontHuman'] == 2
         and _ph['hidden'] == '1 条已隐藏' and _ph['count'] == '显示 8 / 9 条'
         and _ph['sum'] == '9 条 · 显示 8 条', _ph)
    need('简介设置真实作用于前台：改院内队列的简介，工作台卡片底部那行文字跟着换',
         _pn['store'] == '【验证】改过的简介' and _pn['card'] == '【验证】改过的简介', _pn)
    need('封面设置真实作用于前台：给原本没封面的公开数据集配封面 → 卡片多一张图',
         _pc['now'] == _pc['init'] + 1 and _pc['preview'] == 4, _pc)

    # ---- v59：封面图「有 <img> 元素」≠「图能显示」----
    # v40 那条断言只数元素个数，而元素一直都在 —— 断不出图裂。
    # 根因是 build 的路径→base64 替换把 IMG_URI 的**键名**也换掉了，
    # assetAbs() 查表落空后静默退回 assets/xxx 相对路径：本地旁边有
    # assets/ 目录照样出图，只有分发成单文件才整片裂。
    # 这里断两件事：① 映射表键名完好且每条查得到；② 封面真的解码出了尺寸。
    need('封面映射表键名完好：6 条全为 assets/ 相对路径（build 不得替换键名）',
         _pi['imgUriKeyAllPath'] is True and len(_pi['imgUriKeys']) == 6
         and sorted(_pi['imgUriKeys']) == sorted([
             'assets/avatar-clinician.jpg', 'assets/avatar-engineer.jpg',
             'assets/dataset-rnaseq.jpg', 'assets/dataset-singlecell.jpg',
             'assets/dataset-wgs.jpg', 'assets/hero-genomics.jpg']),
         {'keys': _pi['imgUriKeys'], 'allPath': _pi['imgUriKeyAllPath']})
    need('内置封面短键全部命中映射表（不得退回相对路径）',
         _pi['resolveHit'] == [True, True, True], _pi['resolveHit'])
    need('工作台封面图真实解码成功：3 张院内队列封面全部有尺寸，src 走 data:',
         _pi['coverSrcKinds'] == ['data', 'data', 'data']
         and _pi['coverLoaded'] == [True, True, True]
         and all('x' in s and not s.startswith('0x') for s in _pi['coverSize']),
         {'kinds': _pi['coverSrcKinds'], 'loaded': _pi['coverLoaded'],
          'size': _pi['coverSize']})
    need('一键全隐藏：三组前台卡片都清空，设置页给「9 条已隐藏」',
         _pa['shown'] == 0 and _pa['hidden'] == '9 条已隐藏'
         and (_pa['frontOwn'], _pa['frontHuman'], _pa['frontMouse']) == (0, 0, 0)
         and _pa['count'] == '显示 0 / 9 条', _pa)
    need('恢复默认：显示 / 简介 / 封面三件一并复原，前台卡片数回到起点',
         _pr['shown'] == 9 and _pr['checked'] == 9
         and '【验证】' not in ''.join(_pr['intros'])
         and _pr['imgs'].count('img:rnaseq') == 1
         and (_pr['frontOwn'], _pr['frontHuman'], _pr['frontMouse']) == (3, 3, 3)
         and _pr['frontHumanImg'] == 0 and _pr['hidden'] == '全部显示中', _pr)

    need('样本管理保留但不在菜单',     d['sampleKept']['on'] and d['sampleKept']['inNav'] == 0, d['sampleKept'])
    need('派发管理已彻底移除',        d['ia']['dispatchPage'] is False
                                     and d['ia']['dispatchNav'] == 0
                                     and d['ia']['dispatchTbl'] is False,
                                     (d['ia']['dispatchPage'], d['ia']['dispatchNav'], d['ia']['dispatchTbl']))
    need('日志不再含「派发授权」',     '派发授权' not in d['ia']['logTypes'], d['ia']['logTypes'])
    need('右下角浮球与智能体浮窗已整体撤除（v53）', d['ia']['agentFabGone'] is True,
         d['ia']['agentFabGone'])
    need('左栏只有 1 项当前态',       d['ia']['navCur'] == 1, d['ia']['navCur'])
    need('外壳 2 栏 / 无多标签',      d['ia']['shellCols'] == 2 and d['ia']['tabstrip'] == 0, d['ia'])
    # 左栏「当前项」文本过去带步骤号/数量徽章（如「选择分析流程3」），所以原先
    # 只断言它以面包屑页名开头、不做全等。v50 需求 1 把徽章整块撤了，全等也成立；
    # 但 v50 需求 4 让 p04 落到了菜单外 —— 左栏里根本没有它那一格，
    # 所以这里改成断**两件同时为真**的事：面包屑照旧给出分组段与步骤号
    # （页面没被降级成死页），而左栏**刻意一项都不亮**（不为菜单外的页面硬凑高亮）。
    # 若哪天有人把 p02–p06 又塞回菜单，`navCur == 1` 立刻红，这一条不会白写。
    need('面包屑照旧给分组段与步骤号；页面在菜单外时左栏不亮任何一项',
         d['crumbStep']['step'] == '步骤 2 / 5' and d['crumbStep']['hidden'] is False
         and d['crumbStep']['group'] == '智能分析' and d['crumbStep']['page'] == '流程模板'
         and d['crumbStep']['navCurN'] == 0,
         d['crumbStep'])
    # 菜单内的页面仍然「面包屑页名 == 左栏当前项」—— 上面那条把口径放宽了
    # （菜单外的页面左栏不亮），这条把窄的那个口径在菜单内补回来，
    # 两条合起来才既覆盖菜单内、也覆盖菜单外。
    need('菜单内的页面仍是「面包屑页名 == 左栏当前项」',
         all(d['ws'][w]['cur'] and d['ws'][w]['curTxt'] == d['ws'][w]['crumb']
             for w in ['proj', 'pubds', 'projgroup', 'log']),
         {w: (d['ws'][w]['cur'], d['ws'][w]['curTxt'], d['ws'][w]['crumb'])
          for w in ['proj', 'pubds', 'projgroup', 'log']})
    need('p04 编排区在页面内',        d['orch']['insideP04'])
    need('编排区默认=流程模板',       d['orch']['mode'] == '流程模板', d['orch']['mode'])
    need('流程模板 12 条（9 条内置 + 变异 / 富集 / 蛋白组）',
                                     d['orch']['flows'] == 12, d['orch']['flows'])
    need('节点统计==实际节点数',      d['orchStat']['sumOk'], d['orchStat'])
    # ---- v21 自编排流程 ----
    _ps = d['p04sec']
    need('p04 第 1 节只剩 5 张分析类型卡，「跨组学对齐」静态卡已撤',
         len(_ps['cards']) == 5 and not any('跨组学对齐' in c for c in _ps['cards']), _ps['cards'])
    # 置顶（v22）：代谢组那张的 .pcard__n 里还嵌着「不可用」标签，所以只比前缀，
    # 后三张没嵌标签，直接全等 —— 既钉住置顶，也钉住「其余三张的相对顺序没被动过」。
    need('第 1 节 5 张卡：蛋白组 / 代谢组置顶，其后仍是基因变异 → 差异表达 → 功能富集',
         _ps['cards'][0].startswith('蛋白组') and _ps['cards'][1].startswith('代谢组')
         and _ps['cards'][2:] == ['基因变异分析', '差异表达分析', '功能富集分析'], _ps['cards'])
    need('左侧流程模板列表：蛋白组（f12）/ 代谢组（f07）排在最前两位，集合仍是 12 条',
         d['orch']['topFlows'] == ['f12', 'f07'] and d['orch']['flows'] == 12,
         d['orch']['topFlows'])
    need('第 2 节标题=自编排流程',    _ps['title'] == '自编排流程', _ps['title'])
    need('画布默认那条 = 默认选中的分析类型对应的流程',
         _ps['onCard'] == '差异表达分析' and _ps['canvasName'] == 'RNA-seq 完整分析流程'
         and _ps['canvasSteps'] == 7, _ps)
    _pf = d['p04follow']
    need('换分析类型时画布跟着换（名称 / 节点数 / 首节点 / 列表选中一起走）',
         _pf['on'] == '基因变异分析' and _pf['name'] == '基因变异分析流程（GATK + VEP）'
         and _pf['steps'] == 6 and _pf['first'] == 'VCF 输入' and _pf['sel'] == 1, _pf)
    _eb = d['editBase']
    need('画布节点卡 = 序号圈 + 图标 + 名称三件套，且图标真的占像素',
         _eb['steps'] == 5 and _eb['circles'] == 5 and _eb['icons'] == 5
         and _eb['texts'] == 10 and _eb['iconBox'][0] >= 8 and _eb['iconBox'][1] >= 8, _eb)
    need('节点名前面没有漏出来的图标标记（FAI 存的是完整 <path> 标记）',
         _eb['stray'] == 0, _eb['stray'])
    # v37 需求 5：缩略图删掉。反向守卫比正向更强 ——
    # 正向断言（「有缩略图且 5 个矩形」）删掉就没人守了；反向断言能挡住它被加回来。
    need('流程自编排的缩略图已删除（画布不再预留第二列）',
         _eb['mini'] is False and _eb['miniRects'] == 0 and _eb['miniCss'] == 1, _eb)
    # v37 需求 4：按钮从「保存为自定义流程」改名为「另存为新模板」——
    # 名字改了不是文案洁癖：改名后它和「运行此流程」弹出的提醒（另存为一条新模板）
    # 说的是同一件事，用户不会以为「保存 = 覆盖内置模板」。
    need('底部有保存 / 运行两个动作，卡头的「用这个流程」已搬走不再重复',
         _eb['foot']['save'] == '另存为新模板' and _eb['foot']['run'] == '运行此流程'
         and _eb['foot']['reset'] == '重置' and _eb['foot']['hint'] == ''
         and _eb['barHasUse'] is False, _eb['foot'])
    _ea = d['editAppend']
    # 基线 f11 是 5 节点 4 连线，接一个节点后是 6 节点 5 连线 ——
    # 「链式流程」的恒等式是 links == steps - 1（每接一个节点补一条边，不留孤岛）。
    need('工具库点工具 → 画布末尾接 1 个节点、补 1 条连线，并打开该工具的参数配置',
         _ea['steps'] == _eb['steps'] + 1 and _ea['links'] == _eb['links'] + 1
         and _ea['links'] == _ea['steps'] - 1
         and _ea['drawerOn'] and _ea['tool'] in _ea['tblLast'], _ea)
    need('接上的节点带「自编排 +N」标记与真实状态差',
         '自编排 +1' in _ea['stat'] and _ea['hint'] == '模板原有 5 个节点，当前 6 个', _ea)
    _er = d['editReset']
    need('「重置」把自编排的节点全撤掉，回到模板原样',
         _er['steps'] == 5 and _er['hint'] == '', _er)
    _es = d['editSave']
    _esd = _es['saveDlg']
    need('「保存为自定义流程」先弹另一个框：写清来源与节点清单，而不是直接固化',
         _esd['open'] is True and _esd['inModal'] and _esd['nodes'] == _esd['steps'] == 6, _esd)
    need('弹框给了默认可改的流程名',
         '自编排' in _esd['sug'], _esd['sug'])
    need('名字清空后确认被拦下：不新增、不关框、给出提醒',
         '不能为空' in (_esd['blockedToast'] or '')
         and _esd['blockedList'] == _es['before'] and _esd['stillOpen'] is True, _esd)
    need('填名确认后：固化进列表并成为当前选中项，弹框收起',
         _es['after'] == _es['before'] + 1 and _es['selected'] == 1
         and _es['name'] == 'RNA-seq 完整分析流程（自编排 6 步）'
         and _es['modalClosed'] is True, _es)
    # 另存的意义就是「多出一条新模板」，而不是把内置模板改写掉 ——
    # 光看列表条数会漏掉「新增的那条其实覆盖了 f11」这种错，所以两头都断：
    # 新名字在列表里、且它进了 FLOWS 注册表。
    need('新模板真的出现在左侧「流程模版」列表中',
         'RNA-seq 完整分析流程（自编排 6 步）' in _es['listHas']
         and _es['flowNames'] == 'RNA-seq 完整分析流程（自编排 6 步）', _es['listHas'][-3:])
    # ── v37 需求 4 后半：改过的流程点「运行此流程」必须先提醒保存 ──
    # 节点的增删（插一个 / 删一个）是本需求的编辑手段，改完立刻点运行看是否被拦。
    _or = d['orchRun']
    need('改一步后点「运行此流程」被拦下：不跳页、先弹提醒框',
         _or['steps'] == _or['base'] - 1
         and _or['page'] == 'page-p04' and _or['open'] is True
         and _or['title'] == '流程有未保存的改动', _or)
    need('提醒框说清「另存为一条新模板」并给「保存为新模板并运行」',
         _or['saysNew'] is True and _or['saveRunBtn'] is True
         and '返回继续编辑' in _or['btns']
         and any('保存为新模板并运行' in b for b in _or['btns']), _or['btns'])
    need('只是弹提醒、没偷着保存：列表条数不变',
         _or['flowsSame'] is True, (_or['flows'], _or['flows']))
    need('「返回继续编辑」收框 + 留在本页 + 改动不丢',
         _or['back']['open'] is False and _or['back']['page'] == 'page-p04'
         and _or['back']['steps'] == _or['base'] - 1, _or['back'])
    need('「保存为新模板并运行」先转进另存框（此时还没放行到 p05）',
         _or['afterSaveRun']['modal'] == '另存为新模板'
         and _or['afterSaveRun']['hasName'] is True
         and _or['afterSaveRun']['page'] == 'page-p04', _or['afterSaveRun'])
    need('DAG 数据表替代视图',        d['dagAlt']['rows'] == 7, d['dagAlt']['rows'])
    need('工具库 9 分类',            d['orchTools']['cats'] == 9, d['orchTools']['cats'])
    need('工具库 54 工具',           d['orchTools']['tools'] == 54, d['orchTools']['tools'])
    need('工具行全部带图标且搜索框带放大镜（v34 参考系统样式）',
         d['orchTools']['icons'] == 54 and d['orchTools']['srchIco'] is True
         and d['orchTools']['ph'] == '搜索工具…',
         (d['orchTools']['icons'], d['orchTools']['srchIco'], d['orchTools']['ph']))
    need('空分类显式呈现',           d['orchTools']['emptyNote'] >= 1, d['orchTools']['emptyCats'])
    need('内置网络图入口挂工具库',     d['orchTools']['net'] == 1, d['orchTools']['net'])
    need('跨面板流程状态同源',        d['flowRunning']['consistent'], d['flowRunning'])
    # 编排区全屏（本轮新增）
    of = d['orchFull']
    need('全屏按钮存在',             of['hasBtn'])
    need('默认未全屏且 aria=false',   of['off'] and of['pressed'] == 'false', (of['off'], of['pressed']))
    need('按钮文案=外部编排',       of['label'] == '外部编排', of['label'])
    need('全屏后加 is-full',         of['on'])
    need('全屏后锁背景滚动',         of['bodyLock'])
    need('全屏后 position=fixed',    of['position'] == 'fixed', of['position'])
    need('全屏后 aria-pressed=true', of['pressedOn'] == 'true', of['pressedOn'])
    need('全屏后文案=收起',          of['labelOn'] == '收起', of['labelOn'])
    need('全屏后画布真的变宽',        of['grew'], '%s → %s' % (of['w0'], of['w1']))
    need('全屏铺满视口',             of['coversVp'], '%s vs %s' % (of['box'], of['vp']))
    need('全屏后画布组垂直居中',       bool(of['vCenter']) and of['vCenter']['ok'], of['vCenter'])
    need('全屏不遮挡抽屉',           bool(of['drawerAbove']) and of['drawerAbove']['ok'], of['drawerAbove'])
    need('Esc 收起全屏',             of['offAfterEsc'])
    need('Esc 解除背景锁',           of['unlockAfterEsc'])
    need('Esc 后 aria-pressed=false', of['pressedOff'] == 'false', of['pressedOff'])
    need('Esc 后文案=外部编排',       of['labelOff'] == '外部编排', of['labelOff'])
    need('跳页自动收起全屏',         of['exitOnNav'] and of['navClean'], (of['exitOnNav'], of['navClean']))
    # v60：外部编排系统（本轮新增）。分组三块——未进入 / 全屏接管 / 退出复位。
    ie = of['idleExt']
    need('进编排页不预挂外部系统',   not ie['mounted'] and ie['extHidden'] is True,
         (ie['mounted'], ie['extHidden']))
    need('默认视图是站内画布',       ie['view'] == 'local' and ie['bodyHidden'] is False, ie['view'])
    ex = of['extOn']
    need('全屏即挂外部编排系统',     ex['mounted'] and ex['src'] == ex['url'],
         (ex['mounted'], ex['src']))
    need('外部系统接管（画布收起）',  ex['extHidden'] is False and ex['bodyHidden'] is True
                                    and ex['view'] == 'ext', (ex['extHidden'], ex['bodyHidden'], ex['view']))
    need('外部系统地址正确',         ex['url'] == 'http://aizx.jwzcloud.com:1888/', ex['url'])
    need('外部系统 iframe 铺满全屏', bool(of['extFill']) and of['extFill']['ok'], of['extFill'])
    need('失败退路真实可点',         ex['backBtns'] >= 1 and ex['opens'] >= 2,
         (ex['backBtns'], ex['opens']))
    bk = of['backExt']
    need('可切回站内画布且保持全屏', bk['extHidden'] is True and bk['bodyHidden'] is False
                                    and bk['view'] == 'local' and of['backStill'],
         (bk['extHidden'], bk['bodyHidden'], bk['view'], of['backStill']))
    need('切回后按钮仍是收起',       of['backLabel'] == '收起', of['backLabel'])
    ae, nv = of['afterEsc'], of['navExt']
    need('Esc 后外部系统让位画布',   ae['extHidden'] is True and ae['view'] == 'local', ae['view'])
    need('跳页后外部系统让位画布',   nv['extHidden'] is True and nv['view'] == 'local', nv['view'])
    # 项目管理（本轮新增）
    pj0, pjL, pjD = d['projInit'], d['projList'], d['projDetail']
    need('项目默认卡片视图',         pj0['cards'] == 13 and pj0['cls'] == 'grid2'
                                     and pj0['segOn'] == '卡片' and pj0['segAria'] == 'true', pj0['segOn'])
    need('项目管理页左栏默认展开',   pj0['railOn'] and pj0['snavVis'], pj0)
    need('项目计数与当前项同源',     pj0['count'] == '共 13 个项目'
                                     and pj0['cur'].startswith('当前：'), (pj0['count'], pj0['cur']))
    need('卡片摘要=规模+流程',       '71 例共同样本 · 9 条流程' in pj0['meta'], pj0['meta'])
    need('列表视图 13 行 9 列（v37 加「项目状态」）',
                                     pjL['rows'] == 13 and pjL['heads'] == 8 and pjL['cards'] == 0,
         (pjL['rows'], pjL['heads'], pjL['cards']))
    need('列表视图铺满正文宽',       pjL['w'] >= pjL['vp'] * 0.75, '%s / %s' % (pjL['w'], pjL['vp']))
    # 操作列的「查看」：每行一个，且点了真的开详情抽屉。
    # 判据取「抽屉标题的编号 == 该行的编号」—— 断到具体的行，
    # 才排除「点哪一行都开同一个项目」这种只在多行下暴露的问题。
    opv = d['projOpsView']
    need('列表操作列每行有查看',     opv['btns'] == 13 and opv['label'] == '查看', (opv['btns'], opv['label']))
    need('点查看进入对应项目的概况页', opv['open'] and opv['tag'] == opv['rowId']
                                     and bool(opv['opened']),
         (opv['open'], opv['tag'], opv['rowId'], opv['opened']))
    need('项目概况页上没有关闭键（返回只有面包屑一条路，v17）',
         opv['closeBtns'] == 0 and opv['crumb'] == ['工作台', '项目管理']
         and opv['crumbCur'] == '项目概况', opv)
    # v41：钻进来之后左栏不再是全局菜单 —— 它整条换成这个项目自己的菜单
    # （项目详情 / 分析执行 / 分析结果 ▸ 各模块），高亮落在「项目详情」上。
    # 这条换过语义但守的东西没变：**人不能掉出导航**（左栏一格都不亮）。
    need('钻进项目后左栏高亮落在「项目详情」上（v41 起这一层有自己的左栏）',
         opv['navOn'] == '项目详情' and opv['navProj'] == 2 and opv['navGlobal'] == 0,
         (opv['navOn'], opv['navProj'], opv['navGlobal']))
    need('面包屑「项目管理」段把用户送回列表页', opv['backOnList'], opv['backOnList'])
    need('视图分段三态正确',         pjL['segOn'] == '列表' and pjL['ariaOn'] == 'true'
                                     and pjL['ariaOff'] == 'false', pjL)
    need('视图可切回卡片',           d['projViewBack']['cards'] == 13
                                     and d['projViewBack']['cls'] == 'grid2', d['projViewBack'])
    need('项目概况页打开且带编号 · 名称 · 上下文',
         pjD['open'] and pjD['tag'] == 'P-2026-001'
         and pjD['name'] == '原发性肝癌转录组示范项目'
         and '负责人' in pjD['sub'] and '当前项目' in pjD['sub'],
         (pjD['tag'], pjD['name'], pjD['sub']))
    # v39：这张页面是「一个项目的几个切面」。页签条由 PDTABS 现渲染，
    # 所以断的是「键 + 中文名 + 当前态 + 面板数」四件，少一件都会漏出
    # 「有几个按钮但点了不换内容」那类装饰性页签。
    # v40 需求 4：数据集是分析项目的产物，自成一个页签（排在样本信息之后）。
    # v41：七个切面按左栏分栏切成 5 + 2，页签条只列**当前这一栏**那几条 ——
    # 所以这里断的不再是「七条都在」，而是「这一栏恰好这五条」。
    _pjE, _pjM, _pjB = d['projExec'], d['projMod'], d['projBack']
    # ── v44：「项目概况」这个名字只属于左栏「项目详情」那一栏 ──────────────
    # 页头三处（大标题 / 英文小标 / 面包屑末段）原本都是写死的：h1 写死在 HTML 里、
    # 面包屑末段取 PAGES 表 —— 于是切到别的栏后，屏幕上出现「左栏停在结果全景、
    # 页头还写着项目概况」的错位。三处必须一起断：只改一处只是把错位从
    # 一个地方挪到另一个地方。
    need('页头跟着左栏走：项目详情栏 = 项目概况（大标题 / 小标 / 面包屑三处一致）',
         pjD['title'] == '项目概况' and pjD['titleEye'] == 'PROJECT OVERVIEW'
         and pjD['titleCrumb'] == '项目概况',
         (pjD['title'], pjD['titleEye'], pjD['titleCrumb']))
    need('切到「分析执行」栏：页头三处一起换名',
         _pjE['sec'] == 'exec' and _pjE['title'] == '分析执行'
         and _pjE['titleEye'] == 'ANALYSIS RUN' and _pjE['titleCrumb'] == '分析执行',
         (_pjE['sec'], _pjE['title'], _pjE['titleEye'], _pjE['titleCrumb']))
    need('回到「项目详情」栏：页头三处复位（不留着上一栏的名字）',
         _pjB['sec'] == 'info' and _pjB['title'] == '项目概况'
         and _pjB['titleCrumb'] == '项目概况',
         (_pjB['sec'], _pjB['title'], _pjB['titleCrumb']))
    need('结果栏页头 = 当前模块名（页头 / 模块标题 / 左栏高亮 / 面包屑四处同源）',
         _pjM['sec'] == 'result' and _pjM['title'] == _pjM['modTitle']
         and _pjM['title'] == _pjM['navItemOn'] and _pjM['title'] == _pjM['titleCrumb']
         and _pjM['titleEye'] == 'ANALYSIS RESULT',
         (_pjM['title'], _pjM['modTitle'], _pjM['navItemOn'], _pjM['titleCrumb'], _pjM['titleEye']))
    need('「项目详情」栏：五个页签齐全且默认停在「项目信息」',
         pjD['tabs'] == ['info', 'sample', 'dataset', 'param', 'ref']
         and pjD['tabTxt'] == ['项目信息', '样本信息', '数据集', '分析参数', '参考基因组']
         and pjD['tabOn'] == '项目信息' and pjD['panels'] == 5
         and pjD['panelsOn'] == ['info'], (pjD['tabTxt'], pjD['tabOn'], pjD['panelsOn']))
    need('切页签真的换面板：五个都点了一遍，每次只显示对应的那一块',
         pjD['tSample']['on'] and pjD['tSample']['shown'] == ['sample']
         and pjD['tSample']['sec'].startswith('关联样本')
         and pjD['tDataset']['on'] and pjD['tDataset']['shown'] == ['dataset']
         and pjD['tParam']['shown'] == ['param'] and pjD['tRef']['shown'] == ['ref']
         and pjD['tBack']['shown'] == ['info'] and pjD['tBack']['on'],
         {'sample': pjD['tSample'], 'dataset': pjD['tDataset'], 'back': pjD['tBack']})
    # ── v41：项目详情层的左栏 = 这个项目自己的菜单 ──────────────────────
    # 对齐参考系统：点「查看」进来后，全局菜单整条让位给「该项目的分析线」。
    # 这一层最容易出的两类错都在这里断：① 全局菜单没让位（两套导航叠在一起）；
    # ② 子项写死在菜单表里（换个项目看到的还是上一套模块名）。
    need('钻进项目后左栏整条换成项目自己的菜单（三项 + 模块子项，全局菜单一条不剩）',
         pjD['nav'] == ['info', 'exec'] and pjD['navGlobal'] == 0
         and pjD['navGrp'] == '分析结果' and pjD['navOn'] == 'info'
         and pjD['navGrpOpen'] and pjD['navGrpExpanded'] == 'true'
         and len(pjD['navMods']) > 3 and len(pjD['navMods']) == pjD['navMarks'],
         (pjD['nav'], pjD['navGlobal'], pjD['navGrp'], pjD['navMods']))
    need('左栏模块子项 = 主流程节点（去输入项）现场算出来的那一份',
         pjD['navMods'] == _pjM['mods'], (pjD['navMods'], _pjM['mods']))
    # 「分析执行」栏：页签换成 flow/run，正文整批换成它那两个面板 ——
    # 跨栏只切 .is-on 会切出「页签条在、面板全灰」的空白屏（本轮实际修掉的一个 bug）。
    need('点左栏「分析执行」：页签换成实验流程 / 分析流程，正文跟着换成这两个面板',
         _pjE['sec'] == 'exec' and _pjE['tab'] == 'flow'
         and _pjE['tabTxt'] == ['实验流程', '分析流程']
         and _pjE['panels'] == ['flow', 'run'] and _pjE['panelOn'] == ['flow']
         and _pjE['navOn'] == 'exec'
         and _pjE['tRun']['shown'] == ['run'] and _pjE['tFlow']['shown'] == ['flow'],
         (_pjE['tabTxt'], _pjE['panels'], _pjE['panelOn']))
    need('点回左栏「项目详情」：页签与正文都回到信息栏那五条（不是留在上一栏）',
         _pjB['sec'] == 'info' and _pjB['tabTxt'] == ['项目信息', '样本信息', '数据集', '分析参数', '参考基因组']
         and _pjB['panels'] == ['info', 'sample', 'dataset', 'param', 'ref']
         and _pjB['panelOn'] == ['info'] and 'P-2026-001' in _pjB['infoTxt'],
         (_pjB['tabTxt'], _pjB['panels'], _pjB['panelOn']))
    # 页签条与横向流程条共用一个位置：信息 / 执行两栏下是页签，分析结果下是流程条。
    # 两者必须互斥 —— 同时出现就是「一屏两条导航」，同时消失就是「没有任何方向感」。
    need('页签条与流程条互斥：信息栏只见页签、模块页只见流程条',
         (not pjD['tabsHidden']) and pjD['stepsHidden']
         and (not _pjE['tabsHidden']) and _pjE['stepsHidden']
         and _pjM['tabsHidden'] and (not _pjM['stepsHidden']),
         (pjD['tabsHidden'], pjD['stepsHidden'], _pjM['tabsHidden'], _pjM['stepsHidden']))
    # 页头那排角标对齐参考系统的右上角计数：数据集 / 运行中 / 成功 / 失败。
    # 数字全部现算（数据集取自 COLLECTIONS，三档取自运行日志）；
    # 0 的那一档**不上色** —— 把「0 个失败」也渲染成红色告警是假告警。
    # P-2026-001 本轮补齐了「一条 RNA-seq 流程从头到尾」的产物，所以是 6 个数据集。
    need('页头四角标与真实数据对得上（6 数据集 / 1 运行中 / 3 成功 / 0 失败）',
         pjD['badges'] == ['6', '1', '3', '0']
         and 'pjbadge--warn' in pjD['badgeTone'][1]
         and 'pjbadge--ok' in pjD['badgeTone'][2]
         and 'pjbadge--' not in pjD['badgeTone'][3],
         (pjD['badges'], pjD['badgeTone']))
    need('项目信息页签：8 行键值表（编号/名称/负责人/参考基因组/样本数量/创建/更新/状态）',
         pjD['kv'] == 8, pjD['kv'])
    need('详情四指标一行不折行',     pjD['statN'] == 4 and pjD['statsRows'] == 1,
         '%s 格 / %s 行' % (pjD['statN'], pjD['statsRows']))
    need('详情指标=卡片摘要口径',    pjD['stats'][0].startswith('71') and pjD['stats'][1].startswith('9'),
         pjD['stats'])
    # v40 需求 4：数据集信息屏只留「计数 + 去处」，明细搬进数据集页签 ——
    # 两处各铺一张表的话，改一处就漂一处，而没有任何断言看得见。
    need('数据集不再铺在项目信息屏，改成计数 + 一个去页签的入口',
         pjD['dsLink'] == 1
         and '输入 2 个 · 输出 4 个 · 共 636 个元素' in pjD['dsInfoTxt'],
         (pjD['dsLink'], pjD['dsInfoTxt']))
    need('数据集页签：输入 / 输出分组列出该项目产出的数据集，计数与明细自洽',
         pjD['tDataset']['mcells'] == ['2个', '4个', '636个']
         and pjD['tDataset']['inRows'] == 2 and pjD['tDataset']['outRows'] == 4
         and '输入数据集（2）' in pjD['tDataset']['secs']
         and '输出数据集（4）' in pjD['tDataset']['secs']
         and '共 6 个数据集' in pjD['tDataset']['note'], pjD['tDataset'])
    # v41：运行记录表住在「分析执行」栏的分析流程面板里，所以这两个数字
    # 要在那一栏量 —— 站在信息栏量只会得到 0，那不是「没数据」，是「量错栏了」。
    need('详情关联资产真实过滤（样本 6 / 运行记录 4）',
         pjD['smRows'] == 6 and _pjE['lgRows'] == 4,
         (pjD['smRows'], _pjE['lgRows']))
    # 流程模板条数必须等于卡片摘要里那个「9 条流程」——
    # 页面上多一个少一个，同一屏就会出现两个数字互相打架。
    need('实验流程页签的模板条数 = 卡片摘要的「9 条流程」',
         _pjE['flRows'] == 9 and '流程模板库' in _pjE['flowNote'], (_pjE['flRows'], _pjE['flowNote']))
    need('分析参数页签给的是本系统的推荐参数（padj / log2FC / 最低表达量），并给出调整入口',
         'padj' in pjD['tParam']['kvTxt'] and 'log2FC' in pjD['tParam']['kvTxt']
         and '最低表达量' in pjD['tParam']['kvTxt'] and pjD['tParam']['jumps'] == 2, pjD['tParam'])
    need('参考基因组页签按项目的 ref 给真数据（hg38 → GRCh38 / GENCODE / 三条索引）',
         'GRCh38' in pjD['tRef']['kvTxt'] and 'GENCODE' in pjD['tRef']['kvTxt']
         and pjD['tRef']['idx'] >= 3, pjD['tRef'])
    need('分析流程页签给运行记录 + 去「运行日志」的入口', _pjE['runJump'] == 1, _pjE['runJump'])
    # ── v41：分析结果的模块页 ────────────────────────────────────────────
    # 参考系统的模块页骨架 = 顶栏「分析进度 + 当前页状态 + 生成报告」+ 横向流程条
    # （当前步高亮）+ 这一模块的结果表。这里照同一套骨架走，但内容全是本系统的真数据：
    # 本步产出取「名字命中这一步」的输出数据集、运行记录取命中的日志、状态由记录现算。
    # 断的重点是「点哪个模块就落哪个」与「左栏 / 流程条 / 正文三处说的是同一步」。
    need('点左栏第 3 个模块：正文、流程条、左栏三处说的是同一步',
         _pjM['sec'] == 'result' and _pjM['mod'] == 2
         and _pjM['modTitle'] == _pjM['mods'][2]
         and _pjM['stepOn'] == _pjM['modTitle'] and _pjM['stepNo'] == '3'
         and 'is-on' in _pjM['stepCls']
         and _pjM['navItemOn'] == _pjM['modTitle']
         and _pjM['navOn'] == 'mod:2'
         and len(_pjM['steps']) == len(_pjM['mods']),
         (_pjM['modTitle'], _pjM['stepOn'], _pjM['navItemOn'], _pjM['navOn']))
    need('模块页给出「在整条线的第几步、上下游各是什么」，且模块清单现算自这条线',
         _pjM['modPos'] == '第 3 / %d 步 · 上游 %s · 下游 %s'
                            % (len(_pjM['mods']), _pjM['mods'][1], _pjM['mods'][3])
         and _pjM['primFlow'] and _pjM['primFlow']['id'] == 'f06'
         and not any(('输入' in m or '集合' in m) for m in _pjM['mods'])
         and _pjM['mods'][-1] == '结果全景',
         (_pjM['modPos'], _pjM['primFlow'], _pjM['mods']))
    # 四个计数是「完成 / 运行中 / 失败 / 未运行」的模块数：和必须等于模块总数，
    # 且屏上那个「已完成」大字就是第一个计数（同一处状态不能有两个说法）。
    # 分母写进提示里：页头那排角标是按运行记录数算的，不写清会被当成同一件事。
    need('模块页顶上那排「分析进度」按模块统计，并把分母与来源流程写在旁边',
         _pjM['hint'].startswith('按模块统计 · 共 %d 个模块' % len(_pjM['mods']))
         and 'RNA-seq 完整分析流程' in _pjM['hint']
         and len(_pjM['prog']) == 4 and _pjM['head'] == _pjM['prog'][0]
         and sum(int(x) for x in _pjM['prog']) == len(_pjM['mods']),
         (_pjM['hint'], _pjM['prog'], _pjM['head']))
    need('模块页的本步产出取「名字命中这一步」的输出数据集，并给导出入口',
         _pjM['dsSec'].startswith('本步产出（') and _pjM['modDs'] >= 1
         and _pjM['dsName'] and _pjM['modSt'] in ('完成', '运行中', '失败', '未运行')
         and _pjM['dl'], (_pjM['dsSec'], _pjM['modDs'], _pjM['dsName'], _pjM['modSt']))
    _pjM0 = d['projMod0']
    need('流程条上点第 1 步：页内换模块，左栏高亮与正文同步跟着走',
         _pjM0['mod'] == 0 and _pjM0['stepOn'] == _pjM0['mods'][0]
         and _pjM0['navItemOn'] == _pjM0['mods'][0]
         and _pjM0['stepOn'] != _pjM['stepOn'],
         (_pjM0['stepOn'], _pjM0['navItemOn']))
    # v44：流程条换步时页头也要换 —— 正文在讲第 1 步、页头还写着第 3 步的模块名，
    # 就是同一屏上给了两个答案。
    need('流程条换步：页头跟着换（正文与页头不能各说各的）',
         _pjM0['title'] == _pjM0['stepOn'] and _pjM0['title'] == _pjM0['titleCrumb']
         and _pjM0['title'] != _pjM['title'],
         (_pjM0['title'], _pjM0['stepOn'], _pjM0['titleCrumb'], _pjM['title']))
    # 模块页底部的两个跳转挂 data-pdt（不是 data-pds）——后者会被先命中，
    # 把「看运行记录」吞成「看流程定义」，页面停在 flow 上（本轮实际踩到）。
    need('模块页底部的两个跳转真的落在对应页签上（跑到 run 而不是停在 flow）',
         d['projModJump']['sec'] == 'exec' and d['projModJump']['tab'] == 'run'
         and d['projModJump']['onRun'] and not d['projModJump']['onFlow']
         and d['projModJump']['runJump'] == 1
         and d['projModJumpFrom']['sec'] == 'result',
         (d['projModJump']['tab'], d['projModJump']['onRun'], d['projModJump']['onFlow']))
    # ── v41：项目 → 分析线（组学线匹配）────────────────────────────────
    # 旧实现按 p.id 哈希取模板，把转录组项目的主流程算成了 16S 扩增子分析流程。
    # 这类错**看不出来**——两条都是同样专业的流程名，但会同时污染模块清单、
    # 分析参数、实验流程三处。所以断的是「具体是哪条流程、模块里有哪个特征步骤」。
    need('16S 项目走 16S 的线：主流程 f08，模块里是 DADA2 / VSEARCH 那一套',
         d['projLine16S']['primFlow'] and d['projLine16S']['primFlow']['id'] == 'f08'
         and d['projLine16S']['navMods'] == ['qiime2 数据导入', 'DADA2 降噪', 'VSEARCH 物种分类', '物种丰度柱状图']
         and d['projLine16S']['navMarks'] == 4
         and any('数据导入' in s for s in d['projLine16S']['modSecs'])
         and not any('HISAT2' in s for s in d['projLine16S']['navMods']),
         (d['projLine16S']['primFlow'], d['projLine16S']['navMods']))
    need('同一个左栏在不同项目下渲染不同模块（不是写死在菜单表里的那套）',
         d['projLine16S']['navMods'] != pjD['navMods']
         and d['projLine16S']['navMods'] == d['projLine16S']['mods'],
         (d['projLine16S']['navMods'], pjD['navMods']))
    # v37 需求 7：详情操作条首位的「设为当前项目」换成「项目状态」。
    # v42 撤了「运行记录」；v43 撤过「结果全景」、v44 又按用户要求恢复 —— 页头现在是
    # 「项目状态 + 分享此项目 + 查看项目结果全景」：状态（是什么）+ 对外动作 + 一键直达。
    # v45：全景那一颗改为**条件显示**（人已站在全景那一格时自己隐去，见下），
    # 这里量的仍是「项目概况」栏的形态 —— 期望它在。
    need('当前项目详情：操作条 = 分享 + 全景两件（v42 撤运行记录、v44 恢复全景）',
         pjD['onBtn'] == 0 and pjD['actN'] == 2 and pjD['panoN'] == 1
         and '项目状态' in pjD['stTxt'] and '成功' in pjD['stTxt']
         and 'tag--ok' in pjD['stCls'],
         (pjD['onBtn'], pjD['actN'], pjD['panoN'], pjD['stTxt'], pjD['stCls']))
    need('面包屑回列表后详情页确实退场', d['projDetailClosed'])
    # 出层之后左栏必须换回全局菜单：renderNavOn 只改高亮、不重建 DOM，
    # 少了「换套数就重画」这一步，人已经站在项目管理列表上，左边却还是上一个项目的模块清单。
    # v50：全局项数 14 → 10（智能分析整组不上菜单），这条只随菜单口径走。
    _rr = d['projRailRestore']
    need('退出项目层后左栏换回全局菜单（项目菜单整条撤走，不留残影）',
         _rr['onList'] and _rr['globalItems'] == 10 and _rr['projItems'] == 0
         and _rr['projMods'] == 0 and _rr['navOn'] == '项目管理', _rr)
    # 项目层的左栏里没有全局菜单 → 从这里去别的页只能先走面包屑。
    # 这条不为 0 才说明「唯一的回头路是面包屑」这句约定真的被走到过。
    need('离开项目层确实只有面包屑一条路（驱动段走过若干次）',
         (d['navFallback'] or 0) >= 2, d['navFallback'])
    # v28 加过一颗「查看项目结果全景」；v42 把它从「跳独立页」改成「本页内落格」；
    # v43 撤过一版、v44 恢复 —— 恢复后要断的是「两条路都到同一个地方」：
    # ① 页头那颗在（且只有有运行记录的项目才有）；② 点它不跳走、落进结果全景模块；
    # ③ 落进去之后左栏高亮也跟到「结果全景」（同一个状态的两面，只动一处就会左边亮 A、右边亮 B）。
    # v45 再压一层：落进全景那一格之后，这颗按钮**自己隐去** —— 它指向的正是脚下这一格。
    pp = d['projPano']
    need('项目概况页头带「查看项目结果全景」入口（有运行记录时）',
         pjD['actN'] == 2 and pjD['panoN'] == 1 and pp['panoN'] == 1 and pp['actTxtHasPano'],
         (pjD['actN'], pjD['panoN'], pp['panoN'], pp['actTxt']))
    need('「查看项目结果全景」在本页内落到结果全景模块（不跳独立页，左栏高亮同步）',
         pp['stayHere'] and pp['navOn'] == '结果全景' and pp['mount']
         and pp['views'] == 6 and pp['segBtns'] == 6 and pp['charts'] > 0
         and pp['mountDl'] >= 1 and pp['mountTrace'] >= 1
         and pp['stepsShown'] and pp['tabsHidden'], pp)
    # v45 需求：人已经站在全景那一格时，页头那颗指向自己的按钮不该还挂着。
    # 断的是「按钮真的看不见」而不是「DOM 里没有」——它现在是常驻 + hidden 隐去，
    # 所以既读 hidden 也读实际宽度（宽度为 0 才证明 CSS 那条 [hidden] 兜底真的生效；
    # 只读 hidden 的话，.pd__act 是 flex 容器，漏了 CSS 按钮会照样躺着、断言仍绿）。
    need('已在「结果全景」那一格时，页头那颗按钮自己隐去（不再指向自己）',
         pp['titleAfter'] == pp['lastName'] and pp['crumbAfter'] == pp['lastName']
         and pp['panoNAfter'] == 0 and pp['btnHidden'] is True and pp['btnW'] == 0,
         (pp['titleAfter'], pp['lastName'], pp['crumbAfter'],
          pp['panoNAfter'], pp['btnHidden'], pp['btnW']))
    # 反向：换到别的模块，按钮要自己回来 —— 少了这条，「条件显隐」写成
    # 「进了层就不显示」也照样绿，而那正是这一版要避免的过度撤销。
    need('换到别的模块后按钮自己回来（跟着当前位置走，不是一进去就永久没了）',
         pp['panoNBack'] == 1 and pp['titleBack'] and pp['titleBack'] != pp['lastName'],
         (pp['panoNBack'], pp['titleBack'], pp['lastName']))
    # 位置驱动 ⇒ 从哪条路进来都一样：三处「查看结果」也直接落在这一格，同样要隐去。
    need('从「查看结果」入口直接落进全景那一格时，页头那颗同样隐去',
         d['panoEntry']['panoN'] == 0 and d['panoEntry']['title'] == pp['lastName'],
         (d['panoEntry']['panoN'], d['panoEntry']['title'], pp['lastName']))
    # v51：结果全景现在有两个宿主 —— 智能分析第 5 步（#page-p07）与项目详情那一层。
    # 这条原先写的是「整页撤走（连左栏那一格一起）」，那时它守「撤干净」；
    # 现在页面回来了，守的东西换成**同一件事的两面**：位置对了（第 5 步在、项目层也在），
    # 入口没多（左栏里依然没有 p07 这一格，整组 off）。
    # 「页面在不在」与「左栏有没有它的项」分开断，理由和 v50 一样：
    # 拿菜单项总数当代理，总数被别的需求一改就误报。
    need('结果全景两个宿主各就各位、左栏里依然没有它的入口',
         pp['p07Page'] and pp['p07InNav'] == 0 and d['ia']['navP07'] == 0,
         (pp['p07Page'], pp['p07InNav'], d['ia']['navP07']))
    need('结果全景同一时刻只在一处（互斥：另一个宿主已清空、#viewSeg 全局只有 1 个）',
         pp['resCleared'] == 0 and pp['segTotal'] == 1,
         (pp['resCleared'], pp['segTotal']))
    # 撤操作条那颗按钮时，不能顺手把别人的路铲了：pdtRunPanel 里那颗同样挂
    # data-proj-golog 的按钮（去全局运行日志）才是这条分支真正的用户，它必须还在。
    need('撤了操作条那颗「运行记录」，运行记录面板里的那颗还在',
         pp['gologInActs'] == 0 and _pjE['runJump'] >= 1,
         (pp['gologInActs'], _pjE['runJump']))
    # v42：三处「查看结果」改落点，且把视图带进项目详情层 ——
    # 在「差异表达」那一行点，进去就该是差异表达视图，不是回到默认那格。
    # v51：任务运行页那颗搬去 data-res（落点回到智能分析线内，见下面 v51 那组），
    # 所以走 data-pano 的只剩项目详情里的两处 —— 数出来的 3 变 2。
    # 这不是「少了一个入口」，是那一个换了分支；它由 v51 那组单独守着。
    pe = d['panoEntry']
    need('项目详情层里两处「查看结果」都在，且点了落进结果全景模块',
         pe['n'] == 2 and pe['inProj'] and pe['mount'], pe)
    need('入口把视图带进项目层（工作台那一处带 de）',
         pe['view'] == 'de', pe)
    # v41：空态按栏分家 —— 「项目详情」栏里空的是数据集 / 样本两块
    # （参考基因组有 mm10，不是空态）；运行记录那一块搬到「分析执行」栏，
    # 由上面 exec 那几条断言守（那里 lgRows == 4 恰好证明它不是空态）。
    need('空关联显式空态（数据集 / 样本两块都是空态而不是缺节）',
         d['projDetailOther']['name'] == '小鼠肝脏饮食干预模型'
         and d['projDetailOther']['empties'] == 2
         and d['projDetailOther']['onBtn'] == 0
         and d['projDetailOther']['pano'] == 0
         and '还没有数据集' in d['projDetailOther']['dsEmpty']
         and d['projDetailOther']['dsSecs'] == ['数据集'], d['projDetailOther'])
    # 不依赖参考基因组的项目（ref='—'）：该页签给显式空态 + 一句缘由，
    # 而不是一张空白表 —— 空表读起来像「加载失败」。
    need('不依赖参考基因组的项目：该页签给显式空态而不是空表',
         d['projRefNA']['tag'] == 'P-2026-002' and d['projRefNA']['empty']
         and d['projRefNA']['kv'] == 0, d['projRefNA'])
    # ── v37 需求 7：设为当前整条撤销 · 项目状态三态上线 ──
    # 「按钮删了但事件还在」「列表删了卡片还在」是这类改动的典型残留，
    # 所以卡片 / 列表 / 详情三个落点各数一遍，任何一处残留都会被抓住；
    # 连「设为当前」这四个字都不许留在可见文案里。
    _nsc = d['projNoSetCur']
    need('「设为当前」在详情/卡片/正文三处全部撤走，连文案都不留',
         _nsc['detail'] == 0 and _nsc['card'] == 0
         and _nsc['bodyHit'] == -1 and _nsc['label'] == -1, _nsc)
    _pst = d['projStatus']
    need('卡片视图每条项目都带一枚项目状态标签（13 张卡 13 枚）',
         _pst['cardTags'] == 13 and
         all(s in ('成功', '分析中', '失败') for s in _pst['statuses']), _pst['statuses'])
    need('项目状态只有成功 / 分析中 / 失败三种取值',
         sorted(set(_pst['statuses'])) == ['分析中', '失败', '成功'], sorted(set(_pst['statuses'])))
    need('列表视图「项目状态」列排在分析步骤之后（第 6 列）',
         _pst['listTh'] == 5 and _pst['listHead'][5] == '项目状态'
         and len(_pst['listHead']) == 8, _pst['listHead'])
    need('列表视图行内真的填了状态值',
         _pst['listSt'] in ('成功', '分析中', '失败'), _pst['listSt'])
    need('列表操作列不再有「设为当前」，只剩查看',
         _pst['opsBtns'] == 1, _pst['opsBtns'])
    # v39：Esc 归浮层管，项目概况是页面 —— 按 Esc 不该「关掉」它。
    # （它原先收的是抽屉；页面在页流里，没有可收的层。这条同时守住
    #  「抽屉删干净了」：若还有一处 hidden 的旧容器被 Esc 收起，这里看不到，
    #   但 projOpsView.closeBtns == 0 那条会先红。）
    need('Esc 不会把项目概况页关掉（页面不是浮层）',
         d['projEsc']['stillOnPage'] and d['projEsc']['tag'] == 'P-2026-002'
         and d['projEsc']['modalHidden'] and d['projEsc']['sampHidden'], d['projEsc'])

    # ── v39 需求 2 / v47 需求 2：新建项目 6 步向导 ──
    # v39 把 5 步并成 4 步（分组方案与比较方案合成一屏：比较组的选项来自分组，
    # 拆两屏时用户要在两个几乎一样的列表页之间来回翻）。
    # v47 又补回两步 ——「流程模版」与「参数配置」。真实的建流程动作是
    # 数据汇集 → 选流程模版 → 配参数 → 运行，中间那两步原先被整个跳过去了，
    # 于是「建完的项目要跑什么、按什么参数跑」在向导里一个字都没问。
    # 末段「任务运行」不进向导：那是建完之后的事（提交在 p06 上）。
    _wz = d['projWiz']
    need('新建项目弹窗是 6 步向导，步名与本系统的真实动作逐字对应',
         _wz['open'] and _wz['title'] == '新建项目'
         and _wz['steps'] == ['项目信息', '数据文件', '分组与比较方案',
                              '流程模版', '参数配置', '创建完成'],
         _wz['steps'])
    need('向导起步在第 1 步：只有一个当前态、没有已完成态、没有「上一步」',
         _wz['onCount'] == 1 and _wz['done'] == 0 and _wz['ariaCur'] == 1
         and _wz['next'] and _wz['back'] == 0, _wz)
    need('第 1 步 7 个字段 / 6 个必填（星号 + aria-required + 图例三件套齐）',
         _wz['fields'] == 7 and _wz['marks'] == 6
         and _wz['aria'] == 6 and _wz['legend'] == 1, _wz)
    need('第 1 步空表点「下一步」被拦下：留在原步、点名缺「项目名称」',
         _wz['guard']['step'] == 0 and _wz['guard']['stillOpen'] is True
         and '项目名称' in (_wz['guard']['toast'] or ''), _wz['guard'])
    # v47 需求 3 的接线处：第 1 步那个下拉不再是写死的名字数组，而是
    # 「系统管理 › 项目组管理」里 on && pass 的那些。两侧放进同一条断言，
    # 才断得成「下拉真的读那张表」—— 只断下拉里有 4 项，写死一个数组也能过。
    need('第 1 步「所属项目组」的选项 = 项目组管理里「已通过 + 启用」的那几条',
         _wz['grpOpts'] == d['pgInit']['pick'] and len(_wz['grpOpts']) >= 1,
         (_wz['grpOpts'], d['pgInit']['pick']))
    _w1 = _wz['s1']
    need('第 1 步：6 个字段都能填进去、样本支持多选（勾 4 例 → 状态里正好 4 例）',
         _w1['allFilled'] and '已选 4' in _w1['chosen'] and _w1['onRows'] == 4
         and _w1['sids'] == 4, _w1)
    # ── v48 需求 1：样本ID 一键全选 ──
    # 三态都断：只断「点了变 20」的话，把「取消全选」写成永远全选、
    # 或者把「部分选中」那个 indeterminate 整个漏掉，都照样绿。
    _s1p = _wz['s1part']
    need('样本ID 表头有「全选」；勾了 4/20 例时它呈「部分选中」而不是简单的勾/不勾',
         _s1p['box'] is True and _s1p['label'] == '全选'
         and _s1p['checked'] is False and _s1p['indet'] is True, _s1p)
    _s1a = _wz['s1all']
    need('点「全选」一次选满档案池 20 例，计数与勾选态同步',
         _s1a['onRows'] == 20 and _s1a['sids'] == 20
         and _s1a['checked'] is True and _s1a['indet'] is False
         and '已选 20' in _s1a['header'], _s1a)
    _s1n = _wz['s1none']
    need('再点一次「全选」= 取消全选：一例都不选，但 20 行**仍在**（不是把列表清空）',
         _s1n['onRows'] == 0 and _s1n['sids'] == 0 and _s1n['checked'] is False
         and _s1n['rows'] == 20, _s1n)
    _s1r = _wz['s1restore']
    need('全选 → 取消 → 重新勾 4 例：回到与之前**同一组**样本 ID（往返无损，后一步的分组池靠它）',
         _s1r['same'] is True and _s1r['onRows'] == 4 and _s1r['sids'] == 4, _s1r)
    # ── v48 需求 2：新增样本ID 子编辑器必须能「返回」向导 ──
    _so = _wz['sidEditOpen']
    need('「新增」打开子编辑器：底栏是「返回 + 确定」，**没有**会把整个向导关掉的那颗「取消」',
         _so['view'] == 'sid' and _so['foot'] == ['返回', '确定']
         and _so['back'] == 1 and _so['cancel'] == 0, _so)
    _sb = _wz['sidEditBack']
    need('点「返回」回到新建项目窗口本体：弹窗还在、仍在第 1 步、已填项目名与已勾 4 例全都没丢',
         _sb['view'] == 'wizard' and _sb['stillOpen'] is True and _sb['step'] == 0
         and _sb['name'] == '肝癌免疫治疗应答队列' and _sb['grp'] == '肝癌免疫队列'
         and _sb['onRows'] == 4 and _sb['sids'] == 4, _sb)
    _sk = _wz['sidEditOk']
    need('「确定」把档案外样本 S900 录进列表并选中，行上注明它来自档案外',
         _sk['view'] == 'wizard' and _sk['sids'] == 5 and _sk['rows'] == 1
         and _sk['onRows'] == 5 and _sk['meta'] == '档案外样本', _sk)
    _sf = _wz['sidEditOff']
    need('取消勾选刚录的那一例：行**留在列表里**（否则用户刚录的 ID 就凭空没了），状态回到 4 例',
         _sf['rows'] == 1 and _sf['on900'] is False
         and _sf['onRows'] == 4 and _sf['sids'] == 4, _sf)
    _w2 = _wz['s2']
    need('「下一步」真的推进到第 2 步，且第 1 步转为已完成态',
         _w2['idx'] == 1 and _w2['done'] == 1 and _w2['back'] == 1, _w2)
    need('第 2 步是「已选择的文件 + 个人/团队/系统」两栏三页签（无测序类型选项）',
         _w2['tabs'] == ['个人文件', '团队文件', '系统文件'] and _w2['dirs'] >= 1
         and '已选择的文件' in (_w2['selPane'] or '')
         and _w2['hasSeq'] is False, _w2)
    need('第 2 步不勾任何文件点「下一步」被拦下',
         '数据文件' in (_wz['s2guard'] or ''), _wz['s2guard'])
    _w2p = _wz['s2pick']
    need('第 2 步勾选 3 个文件后，左栏「已选择的文件」同步出现 3 行',
         _w2p['files'] == 3 and _w2p['rows'] == 3, _w2p)
    _w3 = _wz['s3']
    need('第 3 步一屏两块：① 分组方案 + ② 比较方案，两块各有一个空态',
         _w3['idx'] == 2 and _w3['cur'] == '分组与比较方案'
         and _w3['emptyN'] == 2 and len(_w3['secs']) == 2
         and '分组方案' in _w3['secs'][0] and '比较方案' in _w3['secs'][1]
         and _w3['foot'] == ['取消', '上一步', '下一步'], _w3)
    need('两块都空时点下一步：先拦「分组方案」（提示顺序 = 屏上 ① ② 顺序）',
         _wz['s3guard0']['step'] == 2 and '分组方案' in (_wz['s3guard0']['toast'] or ''),
         _wz['s3guard0'])
    _wg = _wz['gOpen']
    need('点 ＋ 进入分组方案子编辑器：名称可填、样本池来自第 1 步选的 4 例',
         _wg['view'] == 'group' and _wg['name'] == '' and _wg['pool'] == 4, _wg)
    need('分组池能看到刚建的两个分组 Treat / Ctrl',
         _wz['gGroups'] == ['Treat', 'Ctrl'], _wz['gGroups'])
    need('分组名校验：必须以字母开头、1–8 位、只能字母数字下划线',
         '字母开头' in (_wz['gBadName'] or ''), _wz['gBadName'])
    need('分组方案名不能为空（与分组名是两条不同的规则）',
         '不能为空' in (_wz['gNoName'] or ''), _wz['gNoName'])
    need('分组校验：每组至少 2 例样本，0 例时拦下',
         '至少需要分配2个样本' in (_wz['gNoSamp'] or ''), _wz['gNoSamp'])
    need('样本分配后两个分组各拿到 2 例',
         _wz['gAssigned'] == ['2 例', '2 例'], _wz['gAssigned'])
    _w3a = _wz['s3after']
    need('分组方案保存后回到向导第 3 步并被自动选中',
         _w3a['idx'] == 2 and _w3a['scheme'] == 'TreatScheme' and _w3a['groups'] == 2
         and _w3a['sel'] == 1 and 'TreatScheme' in _w3a['detail'], _w3a)
    need('同一屏再点下一步：这次拦的是「比较方案」（上一步拦的是分组方案）',
         _wz['s3guard2']['step'] == 2 and '比较方案' in (_wz['s3guard2']['toast'] or ''),
         _wz['s3guard2'])
    _w3p = _wz['s3plan']
    need('比较方案就在同一步的下半块（空态从 2 个减到 1 个）',
         _w3p['idx'] == 2 and _w3p['empty'] == 1 and _w3p['planRow'] == 1, _w3p)
    _wp = _wz['pOpen']
    need('比较方案子编辑器起步：方案名为空、零个比较组、显式空态',
         _wp['view'] == 'plan' and _wp['name'] == '' and _wp['pairs0'] == 0
         and _wp['empty'] is True, _wp)
    # v48：三个子编辑器（新增样本ID / 分组方案 / 比较方案）的底栏统一成
    # 「返回 + 创建/确定」。规则是 **子编辑器 = 返回；向导本体 = 取消** ——
    # 底栏词与事必须一致：那三颗原先都写「取消」，而做的事是「退回向导」。
    need('三个子编辑器的底栏统一成「返回 + 创建」，不出现「取消」（子编辑器=返回，向导本体=取消）',
         _wg['foot'] == ['返回', '创建'] and _wp['foot'] == ['返回', '创建'],
         (_wg['foot'], _wp['foot']))
    need('比较组校验来自参考系统 CreatePlan：一个比较组都没有时先拦「至少一个」',
         '至少需要一个比较组' in (_wz['pNone'] or ''), _wz['pNone'])
    need('点「添加」后出现 1 个比较组，两个下拉的选项来自第 3 步的分组方案',
         _wp['pairs'] == 1 and _wp['opts'] == 2 and _wp['optVals'] == 2
         and _wp['optTxt'] == 'Treat', _wp)
    need('比较组校验：对照组/处理组不能为空',
         '不能为空' in (_wz['pEmpty'] or ''), _wz['pEmpty'])
    need('两个下拉都选上（Ctrl → Treat）',
         _wz['pPick'] == [True, True], _wz['pPick'])
    _w3ap = _wz['s3afterPlan']
    need('比较方案保存后仍在第 3 步并被自动选中，比较组为 Ctrl → Treat',
         _w3ap['idx'] == 2 and _w3ap['plan'] == 'Treat_vs_Ctrl' and _w3ap['pairs'] == 1
         and 'Ctrl → Treat' in _w3ap['detail'], _w3ap['detail'][:80])
    # ── 第 4 步「流程模版」＋第 5 步「参数配置」（v47 需求 2）──
    # 这两步要证明的都不是「有个新页面」，而是「向导里选完真的落进项目」——
    # 所以每一步的读数都同时带上界面事实与状态事实（选中项 / 节点链 / 参数值）。
    _w4 = _wz['s4']
    need('第 4 步是「流程模版」：模板库 12 条全列、还没选所以右栏是空态、前三步都已完成',
         _w4['idx'] == 3 and _w4['cur'] == '流程模版' and _w4['done'] == 3
         and _w4['rows'] == 12 and _w4['empty'] == 1 and _w4['info'] == 0
         and _w4['foot'] == ['取消', '上一步', '下一步'], _w4)
    need('第 4 步一条都不选点「下一步」被拦下（项目记录的流程 / 左栏模块清单全靠它）',
         _wz['s4guard']['step'] == 3 and '流程模版' in (_wz['s4guard']['toast'] or ''),
         _wz['s4guard'])
    _w4s = _wz['s4search']
    need('第 4 步搜索只重画列表本体：行数收敛，输入框与已输入的值都没被冲掉',
         _w4s['rows'] < _w4['rows'] and _w4s['keep'] == 'RNA-seq',
         (_w4s['rows'], _w4['rows'], _w4s['keep']))
    _w4p = _wz['s4pick']
    need('选中系统推荐的那条流程后：列表项高亮、右栏明细与节点链逐节点列出',
         _w4p['flow'] == 'f06' and _w4p['nodes'] == 7 and _w4p['sel'] == 1
         and _w4p['chain'] == 7 and 'RNA-seq' in (_w4p['detail'] or ''), _w4p)
    _w5 = _wz['s5']
    need('第 5 步是「参数配置」：9 个值 + 3 个勾选共 12 个控件，其中 5 个下拉',
         _w5['idx'] == 4 and _w5['cur'] == '参数配置'
         and _w5['ctrls'] == 12 and _w5['selects'] == 5 and _w5['checks'] == 3
         and _w5['back'] == 1, _w5)
    need('参考基因组不在第 5 步重复出现（第 1 步选过，这里只在摘要里回显）',
         _w5['hasRefCtrl'] == 0 and _w5['refInSum'] is True, _w5)
    need('参数越界（线程数 0）点「下一步」被拦下',
         _wz['s5guard']['step'] == 4 and '线程数' in (_wz['s5guard']['toast'] or ''),
         _wz['s5guard'])
    _w5l = _wz['s5live']
    need('改一个参数值：状态与右侧摘要同步跟着变（改完看不见就成了装饰）',
         _w5l['padj'] == '0.01' and '0.01' in (_w5l['sum'] or ''), _w5l)
    _w5r = _wz['s5reset']
    need('「恢复推荐值」恢复的是那份默认对象，不是把当前值抄一遍',
         _w5r['padj'] == '0.05' and '0.05' in (_w5r['sum'] or ''), _w5r)
    _w6 = _wz['s6']
    need('第 6 步是「创建完成」回执：底部只剩一个「完成」，9 行信息（v47 多两行）',
         _w6['idx'] == 5 and _w6['cur'] == '创建完成'
         and len(_w6['rows']) == 9 and _w6['foot'] == 1
         and '已成功创建' in _w6['ok'], _w6)
    # v39 的关键修正：旧实现里回执上的编号是 nextProjId() 算出来的**预览值**，
    # 而文案已经写「已成功创建」；现在改成「进这一步就落库」，回执读的是真记录。
    # v47：多出来的那两行正是新加两步填的东西 —— 回执要能回答
    # 「建完之后这个项目跑什么、按什么参数跑」，否则那两步等于白问。
    need('回执上的项目编号就是真落库的那一条（不是 nextProjId 的预览值）',
         _w6['made'] == 'P-2026-014' and _w6['rows'][0].endswith(_w6['made'])
         and _w6['cards'] == 14 and '已创建项目' in (_w6['toast'] or ''), _w6)
    need('回执把「流程模版 / 参数配置」一并交代清楚（这两行是新加两步的落点）',
         any('RNA-seq' in r for r in _w6['rows'])
         and any('HISAT2' in r and 'padj' in r for r in _w6['rows']), _w6['rows'])
    pn = d['projNew']
    need('项目创建完成后回到「项目管理」列表页（不再直落数据汇集）',
         pn['closed'] and pn['onProj'] and pn['h1'] == '项目管理', (pn['onProj'], pn['h1']))
    need('「完成」只是关窗回列表：项目在按「完成」之前就已经在列表里了',
         pn['cards'] == 14 and pn['firstId'] == _w6['made'], (pn['cards'], pn['firstId']))
    need('新建后置顶并设为当前',     pn['cards'] == 14 and pn['firstId'] == 'P-2026-014'
                                     and pn['firstCur'] == 'true' and pn['curCount'] == 1,
         (pn['cards'], pn['firstId'], pn['firstCur']))
    need('新建编号自增不撞号',       pn['firstId'] not in pn['ids'][1:], pn['ids'][:3])
    need('新建后计数与当前项更新',   pn['count'] == '共 14 个项目' and '肝癌免疫治疗' in pn['cur'],
         (pn['count'], pn['cur']))
    # 刚建完的项目不可能已经出结果：状态必须是「分析中」。
    # 断的是「状态出现在卡片上」，不是某个具体字符串 —— 取值受 PROJ_ST 约束。
    need('新建项目的状态是「分析中」（不是成功 / 失败）',
         '分析中' in pn['status'], pn['status'])
    # 新建项目的详情：关联数据集 / 样本 / 运行记录都该是显式空态。
    # 「样本数」不是 0 —— 向导第 1 步就选了 4 例，所以这一格应当等于选中的例数
    # （写成 stats[0] == '0' 是把「没结果」和「没样本」混为一谈）。
    # v41：空态跟着栏走 —— 「项目详情」栏里空的是 sample / dataset（参考基因组第 1 步
    # 填了 hg38，所以它不是空态）；flow / run 那一处搬到「分析执行」栏数。
    # 分栏之后还按全量数「只有 4 块空」会漏掉「有一栏整栏没渲染」这类错。
    # v47：stats[1]「分析流程」从 0 条变 1 条 —— 向导第 4 步选的那条流程落库了。
    # 它不是被顺手改大的数字：这一格读的就是 p.rn，而 rn 现在跟着「选没选流程」走。
    need('新建项目详情：样本 / 数据集两块空态，流程 1 条、参数与参考基因组都有内容',
         d['projNewDetail']['empties'] == 2
         and d['projNewDetail']['emptyPanels'] == ['sample', 'dataset']
         and d['projNewDetail']['stats'][0].startswith(str(_wz['s1']['sids']))
         and d['projNewDetail']['stats'][1] == '1条'
         and d['projNewDetail']['stats'][2] == '0个'
         and d['projNewDetail']['pano'] == 0
         and d['projNewDetail']['paramBrand'] == '向导已确认',
         d['projNewDetail'])
    # v47：新项目**有**流程了（第 4 步必选），所以左栏「分析结果」这一组
    # 底下是真有模块可点的；模块清单 = 主流程节点去掉输入类 + 末尾收口一个「结果全景」，
    # 与 pdtModules() 现算的完全一致（把两侧一起断，避免「左栏少画一项」无人察觉）。
    _pnr = d['projNewRail']
    need('新建项目左栏「分析结果」有模块可点，清单 = 主流程节点 + 结果全景',
         # 「未绑定分析流程」那一格此刻**不该存在**；txt() 取不到节点时返回 '(null)'，
         # 所以这里两种都算「没有」—— 只认空串的话，断言会因为取值方式而不是事实变红。
         _pnr['none'] in ('', '(null)')
         and _pnr['nav'] == ['info', 'exec'] and _pnr['navOn'] == 'info'
         and _pnr['grpOpen']
         and len(_pnr['mods']) == 8 and _pnr['navMods'] == 8 and _pnr['marks'] == 8
         and _pnr['mods'][0] == 'fastp 质控' and _pnr['mods'][-1] == '结果全景'
         and _pnr['primFlow'] == {'id': 'f06', 'n': 'RNA-seq 完整分析流程', 'nodes': 7}, _pnr)
    # v41 立的那条「没绑流程」现在界面上走不到了（见驱动器里 __projNoFlow 的注释），
    # 改由探针代跑 —— 三处一起断：左栏的分组头、执行栏的面板、模块页的空态。
    _pnf = d['projNoFlow']
    need('没绑流程的项目：左栏「分析结果」说清缘由，而不是一个像加载失败的空分组头',
         _pnf['rail']['nav'] == ['info', 'exec'] and _pnf['rail']['navOn'] == 'info'
         and _pnf['rail']['mods'] == [] and _pnf['rail']['navMods'] == 0
         and _pnf['rail']['marks'] == 0 and _pnf['rail']['grpOpen']
         and '未绑定分析流程' in (_pnf['rail']['none'] or ''), _pnf['rail'])
    need('没绑流程的项目：执行栏两处空态都在，且各自给出缘由',
         _pnf['exec']['sec'] == 'exec'
         and _pnf['exec']['panels'] == ['flow', 'run']
         and _pnf['exec']['empties'] == 2
         and _pnf['exec']['emptyPanels'] == ['flow', 'run']
         and '流程模板' in (_pnf['exec']['emptyTxt'] or ''), _pnf['exec'])
    need('没绑流程的项目：模块页说清「先去选一条流程」，流程条在但一步都没有',
         _pnf['mod']['sec'] == 'result' and _pnf['mod']['steps'] == []
         and _pnf['mod']['stepsHidden'] is False and _pnf['mod']['tabsHidden'] is True
         and '没有模块' in (_pnf['mod']['empty'] or '')
         and '实验流程' in (_pnf['mod']['empty'] or ''), _pnf['mod'])
    # 探针读完后必须把项目还原成「有流程」——还原漏了，后面所有现算数字都会漂。
    _pnb = d['projNoFlowBack']
    need('探针读过之后新项目仍是有流程的（flow / rn 原样还原，不是只在探针里看一眼）',
         _pnb['primFlow'] is not None and _pnb['primFlow']['id'] == 'f06'
         and len(_pnb['mods']) == 8, _pnb['primFlow'])
    _pne = d['projNewExec']
    need('新项目「分析执行」栏：流程已绑（有表格），只剩运行记录为空',
         _pne['sec'] == 'exec' and _pne['panels'] == ['flow', 'run']
         and _pne['empties'] == 1 and _pne['emptyPanels'] == ['run']
         and _pne['flowRows'] == 1, _pne)
    _pnm = d['projNewMod']
    need('新项目进「分析结果」直接落在主流程第一步（不再是空页）',
         _pnm['sec'] == 'result' and _pnm['steps'] == 8
         and _pnm['stepOn'] == 'fastp 质控' and _pnm['modTitle'] == 'fastp 质控'
         and _pnm['modEmpties'] == 2
         and _pnm['stepsHidden'] is False and _pnm['tabsHidden'] is True, _pnm)

    # ── v47 需求 3：系统管理 › 项目组管理 ──
    # 三条主线，缺一条这一页就白做：
    #   ① 表与数据同源（不是又画一张假表）；
    #   ② 权限真的挡得住 —— 包括「脚本绕过视觉态」那条路；
    #   ③ 名单是活的 —— 改它，新建项目第 1 步的下拉立刻跟着变。
    _pg = d['pgInit']
    need('项目组管理页：7 条与数据同源，表格逐行对得上名字',
         _pg['role'] == 'super' and _pg['canWrite'] is True
         and _pg['n'] == 7 and _pg['rows'] == 7
         and _pg['rowNames'] == _pg['names'], (_pg['n'], _pg['rows'], _pg['rowNames']))
    need('页头与页脚口径一致：总数、启用与可选条数、当前身份与可做的事',
         _pg['count'] == '共 7 个项目组' and _pg['on'] == 5
         and _pg['onTxt'] == '启用 5 · 禁用 2 · 可选 4（新建项目下拉的条数）'
         and _pg['roleTxt'] == '超级管理员' and '可创建 / 编辑 / 启停' in _pg['foot'], _pg)
    # v50 需求 1：左栏那枚徽章整块撤了，所以只断「可选名单」这一半。
    # 「徽章没了」由 R.ia.navBadges（整条左栏一个 .snav__n 都没有）单独守，
    # 这一条顺带证明「撤的是徽章、不是菜单项」—— projgroup 那一格还在。
    need('「可选名单」= 已通过 且 启用（4 条）；撤徽章不撤菜单项',
         _pg['pick'] == ['肝癌免疫队列', '血清蛋白组 DIA', '肝脏疾病队列', '方法学验证组']
         and _pg['navBadge'] == '' and _pg['navItem'] is True,
         (_pg['pick'], _pg['navBadge'], _pg['navItem']))
    need('第七列是「项目组状态」（逐行带审核结论），行内 7 组启停 / 7 个勾选框',
         _pg['states'] == ['通过', '通过', '通过', '待审核', '通过', '通过', '驳回']
         and _pg['switches'] == 7 and _pg['switchOn'] == 5
         and _pg['checks'] == 7 and _pg['edits'] == 7 and _pg['dels'] == 1, _pg)
    _pgs = d['pgSearch']
    need('搜索同时命中名称与成员（搜「王工」得 2 条），且输入框与已输入的值都没被冲掉',
         _pgs['rows'] == 2 and _pgs['keep'] == '王工'
         and _pgs['rowNames'] == ['肝癌免疫队列', '肝脏疾病队列'], _pgs)
    need('刷新一键清空搜索与勾选（不是只把表格重画一遍）',
         d['pgRefresh']['rows'] == 7 and d['pgRefresh']['selTxt'] == '未选择'
         and d['pgRefresh']['checked'] == 0, d['pgRefresh'])
    _pa, _pd2, _pn2 = d['pgSortAsc'], d['pgSortDesc'], d['pgSortNone']
    need('排序三态循环：升序 / 降序各自成序，且箭头（aria-label）与方向同源',
         _pa['times'] == sorted(_pa['times']) and '升序' in _pa['aria']
         and _pd2['times'] == sorted(_pd2['times'], reverse=True) and '降序' in _pd2['aria']
         and _pn2['times'] == _pg['times'] and '升序' not in _pn2['aria']
         and '降序' not in _pn2['aria'], (_pa['aria'], _pd2['aria'], _pn2['aria']))
    # ③ 名单是活的：禁用一条已通过的项目组 → 它退出可选名单，新建项目第 1 步少一项
    _po, _pon = d['pgOff'], d['pgOn']
    need('禁用一条已通过的项目组：它退出「可选名单」，本页数字与状态跟着变',
         _po['switchOn'] == 4 and _po['on'] == 4
         and '肝脏疾病队列' not in _po['pick'] and len(_po['pick']) == 3, _po)
    need('同一份名单被下游读走：新建项目第 1 步的下拉当场少一项',
         d['pgOffGrp']['opts'] == _po['pick']
         and '肝脏疾病队列' not in d['pgOffGrp']['opts'], d['pgOffGrp'])
    need('启用回来：名单与数字一并复原（只证明「能少」不证明「能恢复」等于没做）',
         _pon['switchOn'] == 5 and _pon['on'] == 5
         and _pon['pick'] == _pg['pick'], _pon)
    # ② 权限：普通用户下增删改一律不可用。注意「不可用」有三层，
    # 只做最外面那一层（把按钮藏了）是挡不住键盘与脚本的。
    _pm = d['pgMember']
    need('切到「普通用户」：操作列变「只读」，行内编辑 / 删除按钮一个都不渲染',
         _pm['roleTxt'] == '普通用户' and _pm['canWrite'] is False
         and _pm['edits'] == 0 and _pm['dels'] == 0
         and d['pgMemberEdits'] == 0 and d['pgMemberDels'] == 0
         and d['pgMemberReadOnly'] == 0, _pm)
    need('只读身份下勾选框 / 启停开关 / 全选框全部真 disabled（不是只换个样式）',
         _pm['checksOff'] == 7 and _pm['switchOff'] == 7 and _pm['allOff'] is True, _pm)
    need('只读身份下「创建项目组」真 disabled，页头徽标与页脚口径都说明谁才能改',
         _pm['newBtnOff'] is True and _pm['newBtnHidden'] is False
         and d['pgMemberWho'] == '当前身份：普通用户'
         and '仅对「超级管理员」与「普通管理员」开放' in _pm['foot'], (_pm, d['pgMemberWho']))
    need('脚本绕过视觉态也挡得住：点工具条「删除」只给理由，不弹确认框',
         '没有删除权限' in (d['pgMemberDel']['toast'] or '')
         and d['pgMemberDel']['modalOpen'] is False
         and d['pgMemberNew']['modalOpen'] is False, (d['pgMemberDel'], d['pgMemberNew']))
    _pl = d['pgLead']
    need('「普通管理员」同样能治理项目组（v54 口径：两档管理员都能增删改查 / 审批）',
         _pl['roleTxt'] == '普通管理员' and _pl['canWrite'] is True
         and _pl['edits'] == 7 and d['pgLeadWho'] == '当前身份：普通管理员', (_pl, d['pgLeadWho']))
    # 增：新组一律「待审核」——自己说自己通过等于没有审核这一环
    _pno = d['pgNewOpen']
    need('点「创建项目组」开的是新建弹窗，成员列表起步为空且有指引',
         _pno['title'] == '新建项目组' and _pno['chips'] == 0
         and '还没有成员' in (_pno['empty'] or ''), _pno)
    need('新建守卫：名称不能为空',       '项目组名称' in (d['pgNewG1'] or ''), d['pgNewG1'])
    need('新建守卫：成员至少 1 人（与名称是两条不同的规则）',
         '项目组成员' in (d['pgNewG2'] or ''), d['pgNewG2'])
    _pm1 = d['pgMem1']
    need('加成员后出现在已选列表里，并且输入框被清空（不然会连着加同一个名字）',
         _pm1['chips'] == 1 and _pm1['input'] == '', _pm1)
    need('重复加同一个成员被拦下，列表不重复',
         d['pgMemDup']['chips'] == 1
         and '已经在成员列表里' in (d['pgMemDup']['toast'] or ''), d['pgMemDup'])
    need('成员可逐个移除', d['pgMem2']['chips'] == 1 and d['pgMem2']['names'] == ['陈铭'],
         d['pgMem2'])
    need('重名守卫：同名两个组会让「所属项目组」下拉出现两条一样的选项',
         '已存在同名项目组' in (d['pgDup'] or ''), d['pgDup'])
    need('取消 = 不留草稿：关窗后条数不变，再打开是空表单',
         d['pgNewCancel']['modalOpen'] is False and d['pgNewCancel']['n'] == 7
         and d['pgNewClean']['name'] == '' and d['pgNewClean']['chips'] == 0, d['pgNewCancel'])
    _pad = d['pgAdded']
    need('新建成功：条数 +1、新组置顶，状态是「待审核」而不是直接「通过」',
         _pad['n'] == 8 and _pad['rows'] == 8
         and _pad['rowNames'][0] == '验证项目组' and _pad['states'][0] == '待审核', _pad)
    need('新建的组不会立刻出现在「可选名单」里（待审核 = 还没批）',
         _pad['pick'] == _pg['pick'], (_pad['pick'], _pg['pick']))
    # 删：只有「已驳回」能删。先拿一个「已通过」的去撞。
    _ps1 = d['pgSel1']
    need('勾选一行后页头显示「已选 N 行」；选中项不可删时「删除」按钮置为 aria-disabled',
         _ps1['selTxt'] == '已选 1 行' and _ps1['delAria'] == 'true', _ps1)
    need('删除守卫：选中的不是「已驳回」时给出原因，不弹确认框',
         '不是已驳回状态' in (d['pgDelGuard']['toast'] or '')
         and d['pgDelGuard']['modalOpen'] is False, d['pgDelGuard'])
    need('行内「删除」逐行判定：只有已驳回那一行有，通过 / 待审核那两行都没有',
         d['pgRowDel']['reject'] == 1 and d['pgRowDel']['pass'] == 0
         and d['pgRowDel']['pending'] == 0, d['pgRowDel'])
    need('删除确认弹窗点名要删哪几个、且带上审核状态（不是干巴巴一句「确定删除吗」）',
         d['pgDelOpen']['title'] == '删除确认'
         and d['pgDelOpen']['items'] == ['横向课题协作组（驳回 · 3 名成员）'],
         d['pgDelOpen'])
    _pdl = d['pgDeleted']
    need('确认后真删掉：条数回到 7，那一行也不在表里了',
         _pdl['n'] == 7 and _pdl['rows'] == 7
         and '横向课题协作组' not in _pdl['rowNames']
         and '验证项目组' in _pdl['rowNames'], _pdl['rowNames'])
    need('新建项目详情首位也是项目状态',
         '项目状态' in d['projNewDetail']['stTxt']
         and '分析中' in d['projNewDetail']['stTxt'], d['projNewDetail']['stTxt'])
    rt = d['projRailToggle']
    need('左栏点击可收起可展开',     rt['offAfterClick'] and rt['appOff'] and rt['expanded'] == 'false'
                                     and rt['onAfterClick'] and rt['snavVis'], rt)
    need('左栏手势测后解锁复原',     rt['unlockedOn'], rt['unlockedOn'])
    sh = d['projShare']
    need('分享面板信息齐全',         sh['open'] and sh['title'] == '分享项目' and sh['days'] == 3
                                     and sh['roles'] == 3 and sh['members'] == 3
                                     and sh['copyInline'] and sh['done'], sh)
    need('分享链接含项目编号',       '/s/014-' in sh['url'], sh['url'])
    need('分享链接确定性',           d['projShareDay']['urlSame'] and d['projShareRole']['urlSame'],
         (d['projShareDay'], d['projShareRole']))
    need('有效期/权限可切换',        d['projShareDay']['dayOn'] == '30 天'
                                     and d['projShareRole']['roleOn'] == '可评论',
         (d['projShareDay']['dayOn'], d['projShareRole']['roleOn']))
    need('复制后关闭并提示',         d['projShareCopy']['closed'] and '已复制' in d['projShareCopy']['toast'],
         d['projShareCopy'])
    need('智能体项目数跟着变',       '14 个项目' in d['projAgent']['body'], d['projAgent']['body'][:120])

    # ── 工作台问答交互（v30）：算力队列让位、与右下角智能体同会话 ──
    wb = d['wbAgent']
    need('工作台已无算力队列卡（p01 卡片清单）',
         wb['queueGone'] and '问答交互' in wb['p01Cards'], wb['p01Cards'])
    need('任务运行页的算力队列卡也已撤除', wb['p06QueueGone'] is True, wb['p06QueueGone'])
    need('工作台问答卡结构齐全（6 快捷问题/输入框/发送）',
         wb['msgsDelta'] == 2 and wb['chips'] == 6 and wb['sendBtn'], wb)
    need('工作台快捷提问出答案（会话唯一宿主即问答卡，v53）',
         '流程' in wb['last'], wb['last'])
    wt = d['wbAgentTyping']
    need('工作台输入框提问：清空输入框并追加问答',
         wt['cleared'] and wt['wbMsgs'] == wb['msgs0'] + 4, wt)
    need('快捷提问与输入框提问衔接在同一个会话里（条数连续）',
         d['agentOpen']['msgs'] == wt['wbMsgs'], d['agentOpen'])

    # ── 智能体写操作确认闸门（问答卡宿主，v53）──
    # 闸门本身没变：先确认、数据不动；取消不落记录；确认执行右栏 +1。
    # 三条都用相对数（前后对比），不写死历史条数。
    _ag = d['agentGate']
    need('写操作先出确认框、历史不动', _ag['boxes'] == 1
         and _ag['histAfter'] == _ag['histBefore'],
         (_ag['boxes'], _ag['histBefore'], _ag['histAfter']))
    need('取消后确认框收起、历史仍不动',
         d['agentCancel']['boxes'] == 0
         and d['agentCancel']['hist'] == _ag['histBefore'], d['agentCancel'])
    _ad = d['agentDone']
    need('确认执行后历史 +1、f09 徽章翻成「运行中」',
         _ad['boxes'] == 0 and _ad['hist'] == _ag['histBefore'] + 1
         and '运行中' in (_ad['f09Badge'] or ''),
         (_ad['hist'], _ag['histBefore'], _ad['f09Badge']))

    # ── v38 需求：主页「问答交互」卡全屏 / 缩回原来那一格 ──
    # （v37 需求 1「智能体浮窗全屏」那组断言随浮窗整体撤除，v53 ——
    #   浮窗不在了，全屏/缩回原位的几何断言一起退场。）
    # 卡片脱流会带走它占的那一格高度（右侧栏塌成 0、整页往上跳），所以「原位」
    # 不只是「尺寸回到 322×523」，还得是「下面那张卡也回到原来的 top」。
    _wb = d['wbFull']
    need('主页问答卡有全屏按钮（带 aria-pressed 与随状态切换的 label）',
         _wb['hasBtn'] and _wb['ariaOff'] == 'false'
         and '全屏' in (_wb['labelOff'] or ''), _wb)
    _wo = _wb['on']
    need('点全屏后卡片脱离页面流铺满视口（四边各留 22px、z 高过顶栏）',
         _wo['full'] is True and _wo['bodyCls'] is True and _wo['pos'] == 'fixed'
         and int(_wo['z']) > int(_wo['topnavZ'])
         and _wo['rect']['w'] == int(_wb['vp'].split('x')[0]) - 44
         and _wo['rect']['h'] == int(_wb['vp'].split('x')[1]) - 44
         and _wo['rect']['top'] == 22 and _wo['rect']['right'] == 22
         and _wo['rect']['bottom'] == 22, (_wo, _wb['vp']))
    need('全屏时会话区真的撑开（不再是卡片内写死的 300px）',
         _wo['bdH'] > _wb['homeBdH'] * 2, (_wb['homeBdH'], _wo['bdH']))
    need('全屏时发送键 / 输入框 / 全屏键都还能被自己接住（命中测试）',
         _wo['hit'] == ['self', 'self', 'self'], _wo['hit'])
    need('全屏里开的弹窗仍压在全屏层之上且点得到（z 序没被改坏）',
         _wb['modal']['open'] and _wb['modal']['closeHit']
         and int(_wb['modal']['z']) > int(_wo['z'])
         and _wb['modal']['cardStillFull'] is True, _wb['modal'])
    need('放大的是同一段会话（不是换了一个空窗口）',
         _wo['msgInCard'] == _wb['msgs'] and _wo['msgInCard'] >= 2,
         (_wb['msgs'], _wo['msgInCard']))
    need('全屏期间页面没被挤动（下方那张卡原地不动）',
         _wb['below0'] == _wb['below1'], (_wb['below0'], _wb['below1']))
    _wf = _wb['off']
    need('点缩小回到原来那一格（尺寸与四边距全等，不是「重新排一遍」）',
         _wf['full'] is False and _wf['bodyCls'] is False
         and _wf['rect'] == _wb['home'], (_wb['home'], _wf['rect']))
    need('缩回后按钮回到「全屏展开」、图标也换回来',
         _wf['aria'] == 'false'
         and '全屏' in (_wf['label'] or '')
         and _wf['icon'] == _wb['iconOff'] and _wf['icon'] != _wo['icon'],
         (_wf['aria'], _wf['label'], _wb['iconOff'], _wo['icon'], _wf['icon']))
    need('缩回后页面仍在同一位置（占位高度已还原）',
         _wb['below2'] == _wb['below0'] and _wf['holderMinH'] == ''
         and _wf['holderH'] == _wb['homeHolderH'],
         (_wb['below2'], _wb['below0'], _wf['holderMinH']))
    need('Esc 同样只缩回原位（不把整张卡收掉）',
         _wb['reIn'] is True and _wb['esc']['full'] is False
         and _wb['esc']['bodyCls'] is False, (_wb['reIn'], _wb['esc']))
    _wn = _wb['navAfter']
    need('跳去别的页面时全屏自动复位（不留幽灵层与残留占位）',
         _wb['navBefore'] is True and _wn['full'] is False and _wn['bodyCls'] is False
         and _wn['holderMinH'] == '', _wn)
    need('回到主页后卡片状态干净（不残留全屏 / 占位，位置与第一次一致）',
         _wb['again']['full'] is False and _wb['again']['holderMinH'] == ''
         and _wb['again']['rect'] == _wb['home'], (_wb['again'], _wb['home']))

    # ── 弹窗层叠：本轮真事故（遮罩盖在弹窗主体上，点输入框就关弹窗）──
    pm = d['projModalHit']
    need('弹窗内控件不被遮罩压住（命中测试）',
         pm['open'] and pm['name']['ok'] and pm['desc']['ok']
         and pm['sampDesc']['ok'] and pm['sidAdd']['ok']
         and pm['submit']['ok'] and pm['closeBtn']['ok'],
         (pm['name'], pm['desc'], pm['sampDesc'], pm['sidAdd'], pm['submit'], pm['closeBtn']))
    need('遮罩仍可点击（点外部关闭未被改坏）', pm['backdrop'] is True, pm['backdrop'])
    need('弹窗输入框可获得焦点',             pm['focusable'] is True, pm['focusable'])
    need('弹窗可由关闭按钮关闭',             pm['closedByBtn'] is True, pm['closedByBtn'])

    # ── 下载：确认弹窗 + 真产出 ──
    _bl = d['dlBuilds']
    # modres 单独在上下文里取过（R.dlModres），这里按「无需上下文」的那一拨算
    _empty = [k for k, v in _bl.items() if k != 'modres' and (not v or not v['size'])]
    # 下界跟着 DL 的注册项走，不写死一个会随页面增减而漂移的常量。
    # 原来这里写的是 `dlEntryCount >= 13` —— v46 撤掉基因档案的「导出档案」
    # （DL.genes）后注册项 14 → 13、界面入口 13 → 12，那个魔数就成了假红。
    # 改成**不变式**：每条注册项都该有界面入口，显式例外只有两条
    # **上下文相关**的（不打开对应上下文就不在 DOM 里）：
    #   modres   —— 「导出本步清单」只在项目模块页上出现，采集时站在结果全景挂载点；
    #   template —— 「下载格式模板」只在下拉了工具抽屉的那一屏出现。
    # 这比数个数严格得多 —— v46 加严后立刻抓到一颗**挂空 key 的死按钮**：
    # p06「对齐明细」那张卡的 `data-dl="alignmatrix"`，DL 里从来没有这个条目，
    # 13 个入口 / 13 条注册个数相等，旧断言照样绿，而那颗按钮点了毫无反应。
    _DL_CTX = ['modres', 'template']
    _dlMiss = sorted(set(d['dlKeys']) - set(d['dlEntryKeys']))
    _dlExtra = sorted(set(d['dlEntryKeys']) - set(d['dlKeys']))
    need('下载入口齐备且每个都真的产出内容',
         len(d['dlKeys']) >= 13 and _dlMiss == _DL_CTX and not _dlExtra and not _empty,
         (sorted(_bl.keys()), _dlMiss, _dlExtra, d['dlEntryCount'], _empty))
    # v41：模块页的「导出本步清单」跟着**当前所处的那一步**走 ——
    # 文件名带项目号与模块名、条数 = 那一屏的产出行 + 运行记录行。
    # 条目里写死名字/内容的话，导出的永远会是同一份，而界面上看不出来。
    _mr = d['dlModres']
    need('模块页导出：文件名与条数按当前那一步现算，且点按钮真的弹确认框',
         _mr and _mr['size'] > 0 and _mr['name'] == 'P-2026-001_HISAT2_比对.tsv'
         and _mr['lines'] == _pjM['modDs'] + _pjM['modLg']
         and _mr['note'].startswith('HISAT2 比对 · 产出')
         and d['dlModresModal']['open'] and 'HISAT2' in d['dlModresModal']['body'],
         (_mr, d['dlModresModal']))
    _s = _bl['samples']
    need('样本档案导出与档案同源（行数=当前档案条数 · 带表头）',
         _s['lines'] == d['dlSampN'] and '样本 ID' in _s['head'] and '知情同意' in _s['head'],
         (_s['lines'], d['dlSampN'], _s['head'][:40]))
    _sl = _bl['samplist']
    need('导出当前列表与档案同口径（未筛选即全量）',
         _sl['lines'] == d['dlSampN'] and _sl['note'].startswith('未筛选'), _sl)
    # v46：删掉了「基因档案导出」（genes）那条 —— 那一页整块撤了，导出条目同批删掉。
    _p = _bl['patho']
    need('结果表导出带表头，并说明源数据全量',
         '基因' in _p['head'] and '全量' in _p['note'], _p)
    # 「未匹配清单丢了处理方式列」这条随样本对齐页一起下线（v37）——
    # 那条导出挂在被删的页面上，留着它只会以 KeyError 的形式炸掉整轮回归。
    # 反向守一手：它不该再回到 DL 注册表里（回到就意味着页面又冒出来了）。
    need('未匹配清单导出已随样本对齐页撤走', 'unmatched' not in _bl, list(_bl.keys()))
    _r = _bl['runlog']
    need('日志导出含任务头与 13 行输出',
         _r['lines'] == 13 and 'T-2409-018' in _r['head'] and 'INFO' in _r['head'], _r)
    _k = _bl['kbresult']
    need('检索结果导出 12 条且带证据强度',
         _k['lines'] == 12 and '证据强度' in _k['head'], _k)
    _t = _bl['trace']
    need('溯源报告是结构化 JSON（三组）',
         _t['fmt'] == 'JSON' and _t['lines'] == 3 and _t['head'].startswith('{'), _t)
    _tp = _bl['template']
    need('格式模板含列名与样例行', 'sample_id' in _tp['head'] and _tp['lines'] >= 6, _tp)

    # ZIP：光有扩展名不算 —— 交给标准解压器打开，条目与内容都要对
    import base64 as _b64, io as _io, zipfile as _zip
    _zf = _zip.ZipFile(_io.BytesIO(_b64.b64decode(d['dlZipB64'])))
    _names = _zf.namelist()
    _svg = [n for n in _names if n.endswith('.svg')]
    _tsv = [n for n in _names if n.endswith('.tsv')]
    need('导出结果是可被标准解压器打开的 ZIP',
         _zf.testzip() is None and len(_svg) >= 4 and len(_tsv) >= 3,
         (_zf.testzip(), len(_svg), len(_tsv)))
    _svg0 = _zf.read(_svg[0]).decode('utf-8')
    need('ZIP 里的 SVG 补了 xmlns（单独打开不白屏）',
         _svg0.lstrip().startswith('<?xml') and 'xmlns="http://www.w3.org/2000/svg"' in _svg0, _svg[0])
    _tsv0 = _zf.read(_tsv[0]).decode('utf-8')
    need('ZIP 里的数据表是带表头的 TSV',
         '\t' in _tsv0.split('\n')[0], _tsv0[:60])

    _dm = d['dlModal']
    need('点下载只弹确认框，不直接下文件',
         _dm['open'] and _dm['title'] == '下载确认' and _dm['btns'] == ['取消', '确认下载'], _dm)
    need('确认框写明文件名 / 行数 / 来源',
         'sample_registry_20260922.tsv' in _dm['body'] and (str(d['dlSampN']) + ' 行') in _dm['body']
         and '来源' in _dm['body'], _dm['body'])
    need('确认框按钮能被自己接住（提示层没压住主体）',
         _dm['hitGo']['ok'] is True, _dm['hitGo'])
    need('取消后弹窗关闭且没有开始下载',
         d['dlCancel']['modal'] is True and '已开始下载' not in (d['dlCancel']['toast'] or ''),
         d['dlCancel'])
    _rb = d['dlRowBtn']
    need('表内「导出」走同一套确认框，内容取自那张表',
         _rb['open'] and 'diff_genes.tsv' in _rb['body'] and '8 行' in _rb['body'], _rb['body'])
    need('确认之后才真的开始下载',
         _rb['confirmed'] is True and '已开始下载' in (_rb['toastAfter'] or ''), _rb)

    # v46：删掉「基因档案：重建档案交互」这一段（15 条断言，约 58 行）——
    # 它断的整套交互（最近一次重建状态条 / 打开抽屉 / 范围与依据 / 运行进度 /
    # 结果写回 / Esc 分层 / 重开不丢快照）全部长在「基因档案」那个 tab 里，
    # tab 与「重建档案」抽屉整块撤了，探针 R.grb0 … R.grb10 也已删，
    # 这里不再有可断的事实。
    # 注意：Esc 分层那一层（hadSecond）随之撤销，现在只剩「有/无顶层抽屉」两态 ——
    # 相关断言见上面抽屉那一节。

    # 截图拍到的必须是它声称的那一页 —— 断言查 DOM 事实，截图查「屏幕上是哪一页」，
    # 两者不是同一回事，断言全绿而截图拍错是本轮真实踩过的坑。
    need('每张截图都停在目标页',     SHOTFAIL == [], SHOTFAIL[:4])
    # 反向守卫：SHOTFAIL 只抓「拍了却没登记」，「登记了却从没拍」要单独看 ——
    # 删掉某个 shot 调用却忘了删登记条目时，否则会静默通过
    shotMissing = [k for k in SHOT_PAGE if not os.path.exists(os.path.join(SHOTS, k))]
    need('登记的截图全部产出',       shotMissing == [], shotMissing[:4])
    need('旧蓝色残留 0',             d['legacyBlue'] == 0, d['legacyBlue'])
    need('图表文字对比度 ≥4.5',       d['chartInkMin'] >= 4.5, d['chartInkMin'])
    # ---------- 对齐矩阵：整块随「样本对齐」页一起下线（v37 需求 3）----------
    # 原先这里守的是「小 viewBox 的图不许被容器拉伸」（416 → 772 是 1.86 倍）。
    # 该页整页删除后这条守卫没有宿主了；留一个永远取不到值的断言，比删掉它更坏 ——
    # 它会以「跳过」或异常的形式假装自己还在守。改成守「它没有回来」。
    _al = d['v37align']
    need('样本对齐页已整页下线',       _al['page'] is False, _al)
    need('样本对齐的左栏入口与跳转按钮一并撤走',
         _al['nav'] == 0 and _al['goBtns'] == 0, _al)
    # 步骤条上每一格前面带序号（1 数据汇集、2 流程模板…，与参考系统同形），
    # 所以比之前先把序号剥掉 —— 否则「删掉一个节点」会被数字前缀掩盖成「文案变了」。
    _steps = [s.lstrip('0123456789').strip() for s in (_al['stepNames'] or [])]
    # v42：15 页 = 16 − 1（「结果全景」独立页撤了，内容并进项目详情层）。
    # 菜单 13 项 = 14 − 1（同一个 p07 在左栏里的那一格）。两个数字一起断，
    # 才守得住「撤一个页面必须连它的菜单入口一起撤」—— 只撤页面会在菜单里
    # 留一个点不到的死项，而「页数」与「菜单项数」各断各的就看不出来。
    # v47：两处各 +1（系统管理组加了「项目组管理」）→ 16 页 / 14 项。
    # v50 需求 4：智能分析整组撤离菜单，**页数不变（还是 16），菜单项 14 → 10**。
    # 两个数字这一轮不再同向变化 —— 这正是「撤的是入口、不是页面」的量化证据：
    # 若有人顺手把页面也删了，pages 会掉到 12 而 navItems 仍是 10，这里立刻红。
    # v51：补上第 5 步「查看分析结果」→ 4 步变 5 步。页数 16→17、菜单项**仍是 10**
    # （这一页落在那个整组 off 的分组里）。三个数字一起断：只断步数的话，
    # 「步骤条多了一格但页面没建」也能混过去 —— 那种情况下点第 5 格是死的。
    need('智能分析步骤条 5 步（v37 少样本对齐、v42 少结果全景、v51 补查看分析结果）',
         _steps == ['数据汇集', '流程模板', '参数配置', '任务运行', '查看分析结果']
         and _al['pages'] == 17 and _al['navItems'] == 10, _al['stepNames'])

    # ══════════ v51：第 5 步「查看分析结果」= 结果全景的第二个宿主 ══════════
    # 形状与 v50 需求 2 一致：**按一个动作的几处回声来断**，不逐条罗列读数。
    #   ① 位置 —— 第 5 步在位：页头写 5/5、面包屑给步骤号、stepper 第 5 格
    #   ② 内容 —— 点「查看结果」落到这一页，且 6 视图 / 13 图 / 三张空表体真的被填上
    #   ③ 同源 —— 没有复制一份：这份内容与项目详情那一层是同一个 #panoTpl，
    #             所以同一时刻只允许一处装着它（#viewSeg 全局 1 个、另一个宿主为空）
    #   ④ 入口 —— 页脚「下一步」指向它；排队态点「查看结果」要被拦住
    # 为什么 ② 里要连「三张空表体」一起断：那三张表（富集/蛋白组/代谢组）的表体
    # 是空的，靠挂载后补做 fillTables() 现填 —— 漏了这一步，页面看上去完全正常，
    # 只有点那三条导出才会发现「读到的只有表头」。**一个跑不出来的动作要有人守着。**
    _rs = d['resStep']
    need('第 5 步在位：页头 5/5 · 面包屑步骤号 · stepper 5 格 · 页名「查看分析结果」',
         d['resultPage'] == 'page-p07' and _rs['steps'] == 5
         and _rs['eye'] == '步骤 5 / 5 · P-07' and _rs['step'] == '步骤 5 / 5'
         and _rs['h1'] == '查看分析结果' and _rs['crumb'] == '查看分析结果'
         and _rs['grp'] == '智能分析',
         {'page': d['resultPage'], 'step': _rs['step'], 'steps': _rs['steps'],
          'eye': _rs['eye'], 'h1': _rs['h1'], 'crumb': _rs['crumb'], 'grp': _rs['grp']})
    need('第 5 步的内容就是结果全景本体：6 视图 · 13 图全画出来 · 三张空表体被填上',
         _rs['rviews'] == 6 and _rs['charts'] == 13 and _rs['svg'] == 13
         and all(n > 0 for n in _rs['emptied']) and len(_rs['dlKeys']) == 7,
         {'rviews': _rs['rviews'], 'charts': _rs['charts'], 'svg': _rs['svg'],
          'emptied': _rs['emptied'], 'dl': _rs['dlKeys']})
    need('两个宿主同源且互斥：#viewSeg 全局只有 1 个、另一个宿主已清空',
         _rs['segs'] == 1 and _rs['panoRviews'] == 0,
         {'segs': _rs['segs'], 'panoRviews': _rs['panoRviews']})
    need('第 5 步的页脚：回上一步 + 基于这批数据发起新分析',
         _rs['foot'] == ['p06', 'p02'], _rs['foot'])
    # 这条闸搬过两次家（[data-go] → [data-pano] → [data-res]），每搬一次都得确认它还在。
    # 不搬的后果不是「按钮灰着但点得动」这么轻 —— 是任务还在排队，人已经站在结果页上，
    # 看的是上一批数据的结果。
    _qa2 = d['queueAnom']
    need('排队态点「查看结果」被拦住（闸跟着按钮搬了两次家）',
         _qa2['guardPage'] == 'page-p06' and '还没结束' in (_qa2['guardToast'] or ''),
         {'page': _qa2['guardPage'], 'toast': _qa2['guardToast']})
    # 页脚那一格与那颗按钮是「同一件事的两个入口」，区别在于页脚这颗**不受任务状态影响**：
    # 任务还在排队时「查看结果」是灰的，页脚照样走得下去。两条都要在，少一条就少一条腿。
    need('任务运行页的页脚给出「下一步：查看分析结果」',
         d['runEnd']['foot'] == ['p05', 'p07'], d['runEnd']['foot'])

    # ══════════ v50 需求 2：数据汇集页「上传组学数据」→ 两栏文件选择器 ══════════
    # 原来那张拖拽卡默认了「数据还在本机」这一种来路；换选择器之后
    # 数据资产（文件管理那三档）成了并列的一条路。这一段按「一个动作的四处回声」来断：
    #   ① 形状（两栏 / 三档 / 左清单空态 / 老 .dz 已撤 / 本机文件入口仍在）
    #   ② 勾选（左清单 · 树上勾 · 已识别卡 三处同步 —— 只断一处，另两处漏一个也看不出来）
    #   ③ 搜索（只筛树、且不换掉输入框：换掉就丢焦点，打第二个字就断）
    #   ④ 切档与清空（浏览别的档不丢已选；清空是把三处一起归零，不是一个）
    _p02 = d['p02']
    _i02, _two02, _un02 = _p02['init'], _p02['two'], _p02['untoggle']
    _se02, _tm02, _cl02, _ar02 = (_p02['search'], _p02['team'],
                                  _p02['cleared'], _p02['afterReset'])
    _dp = d['dzClick']
    need('拖放仍在：落点搬到选择区，老 .dz 拖拽区整块撤了',
         _dp['dropTarget'] is True and _dp['dzGone'] == 0
         and _dp['fileCardHidden'] is False and _dp['cards'] == 1
         and _dp['name'] == 'S099_1.fastq.gz', _dp)
    need('数据汇集页 = 「已选择的文件」+ 文件树 两栏（三档可见范围 · 空态 · 清空键）',
         _i02['scope'] == 'mine' and _i02['tabs'] == ['个人文件', '团队文件', '系统文件']
         and _i02['tabOn'] == '个人文件' and _i02['treeRows'] == 6 and _i02['treeDirs'] == 4
         and _i02['leftRows'] == 0 and _i02['leftEmpty'] is True and _i02['clearBtn'] is True
         and _i02['meta'] == '尚未选择' and _i02['n'] == 0
         and _i02['dzGone'] == 0 and _i02['localBtn'] is True and _i02['realFile'] is True, _i02)
    need('未选文件时「已识别的文件」卡跟着收起',
         _i02['fileCardHidden'] is True and _i02['fileCards'] == 0,
         (_i02['fileCardHidden'], _i02['fileCards']))
    need('勾选两行 → 左清单 / 树上勾 / 已识别卡三处同步',
         _two02['n'] == 2 and _two02['treeChecked'] == 2 and _two02['leftRows'] == 2
         and _two02['leftEmpty'] is False and _two02['fileCards'] == 2
         and _two02['fileCardHidden'] is False and _two02['fileTag'] == '校验通过'
         and _two02['meta'] == '已选 2 个文件 · 三档可见范围共用同一份数据资产'
         and _two02['files'] == ['mine/S037 血浆 WGS/S037_1.fastq.gz',
                                 'mine/S037 血浆 WGS/S037_2.fastq.gz'], _two02)
    need('再点同一行 = 取消勾选（「点的就是这一份」能撤回，不是单向的）',
         _un02['n'] == 1 and _un02['treeChecked'] == 1 and _un02['leftRows'] == 1
         and _un02['fileCards'] == 1, _un02)
    need('筛选只作用于文件树：命中 2 条，已选的 2 份一份不少',
         _se02['q'] == 'S068' and _se02['searchVal'] == 'S068' and _se02['treeRows'] == 2
         and _se02['n'] == 2 and _se02['leftRows'] == 2, _se02)
    need('筛选框本体不被换掉（局部重画，不是整块重画）',
         _p02['searchSameNode'] is True, _p02['searchSameNode'])
    need('接着打第二个字仍在筛（同一个节点上第二次 input 也生效）',
         _p02['searchTyped'] == 1, _p02['searchTyped'])
    need('切到团队档：树换成另一批文件，已选的 2 份不丢',
         _tm02['scope'] == 'team' and _tm02['tabOn'] == '团队文件'
         and _tm02['treeRows'] == 5 and _tm02['treeDirs'] == 2
         and _tm02['treeChecked'] == 0 and _tm02['n'] == 2 and _tm02['leftRows'] == 2, _tm02)
    need('一键清空把三处一起归零（清单 / 计数 / 已识别卡）',
         _cl02['n'] == 0 and _cl02['leftRows'] == 0 and _cl02['leftEmpty'] is True
         and _cl02['treeChecked'] == 0 and _cl02['fileCardHidden'] is True
         and _cl02['fileCards'] == 0 and _cl02['meta'] == '尚未选择', _cl02)
    need('本机文件那条链没被换掉（#realFile 与「选择本机文件」都在）',
         _p02['localEntry'] is True, _p02['localEntry'])
    need('复位探针把选择器打回出厂（范围回个人档、筛选清空、清单空）',
         _ar02['scope'] == 'mine' and _ar02['q'] == '' and _ar02['n'] == 0
         and _ar02['treeRows'] == 6 and _ar02['fileCardHidden'] is True, _ar02)

    # ══════════ v50 需求 3：新建项目先出「一键全流程分析 / 智能分析」两条入口 ══════════
    # 两条路不是「同一个向导的两种皮肤」：一条建项目走 6 步，一条不建项目直接进这条线。
    # 所以三条一起断：选择屏本身、smart 的落点（p02 且项目数不变）、full 回到老向导。
    # v51：这条线的步骤由 4 变 5（补了「查看分析结果」），落点仍是不建项目的 p02。
    _pc = d['pnChoose']
    _psm = d['pnSmart']
    need('点「新建项目」先出两条入口：两块大选项、整块可点',
         _pc['open'] is True and _pc['title'] == '新建项目' and _pc['cards'] == 2
         and _pc['names'] == ['一键全流程分析', '智能分析']
         and _pc['keys'] == ['full', 'smart']
         and _pc['hitFull']['ok'] is True and _pc['hitSmart']['ok'] is True, _pc)
    need('选择屏不是向导：无步骤条、弹窗是窄版、底部只有「取消」',
         _pc['stepper'] == 0 and _pc['wide'] is False
         and _pc['foot'] == ['取消'] and all(x > 0 for x in _pc['descLen']), _pc)
    need('「智能分析」不建项目，直接落数据汇集（5 步线）',
         _psm['modalHidden'] is True and _psm['modalWideLeft'] is False
         and _psm['page'] == 'page-p02' and _psm['crumb'] == '数据汇集'
         and _psm['crumbHome'] == '工作台' and _psm['steps'] == 5
         and _psm['picker'] is True
         and _psm['toast'] is not None and '智能分析' in _psm['toast']
         and _psm['navCur'] == 0 and _psm['navSmart'] == 0, _psm)
    _pm2 = d['projModalHit']
    need('「一键全流程分析」仍是原来那 6 步向导（选择屏被换掉、弹窗回到宽版）',
         _pm2['open'] is True and _pm2['chooseGone'] == 0 and _pm2['stepper'] == 6
         and _pm2['wide'] is True, _pm2)
    need('两条入口都只是「进流程」：选择完项目数一个没多',
         _pm2['projN1'] == _pm2['projN0'], (_pm2['projN0'], _pm2['projN1']))

    # ══════════ v52：智能分析简介改口径 + 「运行分析」先补项目信息 ══════════
    # 需求 1 是换说法，需求 2 是换流程：这条线不建项目就直接跑，那「这批数据属于谁」
    # 必须在开跑前有个落点 —— 顺序是刻意的：信息先落、再开跑，反过来结果出来没人认领。
    _rs = d['runMeta']
    need('智能分析简介是「自定义自编排工作流」，旧口径「不建项目」退场',
         '自定义自编排工作流' in (_pc['smartDesc'] or '')
         and '不建项目' not in (_pc['smartDesc'] or '')
         and (_pc['smartMeta'] or '').startswith('5 步'),
         {k: _pc[k] for k in ('smartDesc', 'smartMeta')})
    need('空手进任务运行页：信息条是收起的（没走过那一步不该出现）',
         _rs['barBefore']['page'] == 'page-p06' and _rs['barBefore']['hidden'] is True,
         _rs['barBefore'])
    need('「运行分析」挂在新分支 data-runmeta 上（不再与任务页「开始运行」共用一条）',
         _rs['btn']['has'] is True and _rs['btn']['runmeta'] is True
         and _rs['btn']['oldRun'] is False, _rs['btn'])
    _rmM = _rs['modal']
    need('「运行分析」先弹「完善项目信息」：窄版、七项字段、四项必填',
         _rmM['open'] is True and _rmM['title'] == '完善项目信息' and _rmM['wide'] is False
         and len(_rmM['labels']) == 7
         and _rmM['required'] == ['rmName', 'rmDesc', 'rmGrp', 'rmSampDesc'], _rmM)
    need('弹窗字段名一个不缺（含样本描述信息 / 实验条件）',
         all(any(k in (x or '') for x in _rmM['labels'])
             for k in ('项目名称', '项目描述', '所属项目组', '样本ID',
                       '样本描述信息', '参考基因组', '实验条件')), _rmM['labels'])
    need('两项回填行是 rbfill 而非禁用输入框，且不带「自动回填」标签与来源说明（v52 复审撤）',
         [f['k'] for f in _rmM['fills']] == ['sid', 'ref']
         and all(f['disabledInp'] is False for f in _rmM['fills'])
         and all('自动回填' not in (f['tag'] or '') for f in _rmM['fills'])
         and all('来自' not in (f['hint'] or '') for f in _rmM['fills']), _rmM['fills'])
    need('项目组下拉与新建项目向导同源（出厂 4 组 + 占位项）',
         _rmM['selOpts'] == 5, _rmM['selOpts'])
    need('必填图例与「确认并开始分析」都在',
         _rmM['legend'] == '* 为必填项' and _rmM['ok'] is True
         and _rmM['foot'] == ['取消', '确认并开始分析'], _rmM)
    need('空表点确认被拦：弹窗不关、toast 说缺哪项、那一格就地标红、人不挪页',
         _rs['blocked']['open'] is True and '请先补全' in (_rs['blocked']['toast'] or '')
         and '项目名称' in (_rs['blocked']['toast'] or '')
         and _rs['blocked']['errName'] is True
         and _rs['blocked']['page'] == 'page-p05', _rs['blocked'])
    _rmC = _rs['confirmed']
    _sidN = ''.join(ch for ch in (_rmM['sidNote'] or '') if ch.isdigit())
    need('填完点确认：弹窗关、落进任务运行页、任务真的提交',
         _rmC['closed'] is True and _rmC['page'] == 'page-p06'
         and '已提交' in (_rmC['toast'] or ''), _rmC)
    need('「本次分析信息」条把填的东西复述到位（项目名 / 项目组 / 描述 / 样本描述 / 实验条件）',
         _rmC['barHidden'] is False
         and '肝癌早筛多组学试跑' in (_rmC['barT'] or '')
         and '肝癌免疫队列' in (_rmC['barT'] or '')
         and all(k in (_rmC['barP'] or '') for k in
                 ('对 71 例共同样本做差异表达', '例（自动回填）',
                  '配对设计', 'GRCh38', 'NovaSeq 6000'))
         and _sidN != '' and (_sidN + ' 例（自动回填）') in (_rmC['barP'] or ''),
         {'sidNote': _rmM['sidNote'], 'barP': _rmC['barP']})
    # ---------- 深色左栏：L 形外壳 + 深底上的可读性 ----------
    # 配色改动最容易「看着对、其实读不了」—— 深底压深字在 DOM 数据上完全正常，
    # 只有算对比度才暴露。所以这里只认两件事：结构上顶栏左段与左栏等宽同色，
    # 内容上块内每处文字都过 AA。期望的深色从 token 现算，不写死 rgb 字面量。
    _rn = d['railNav']
    need('左栏底是品牌深色',         _rn['snavBg'] == _rn['deepRgb'], (_rn['snavBg'], _rn['deepRgb']))
    need('顶栏左段与左栏等宽（L 形外壳）',
         abs(float(_rn['capW'].replace('px', '')) - _rn['snavW']) <= 1, (_rn['capW'], _rn['snavW']))
    need('顶栏左段与左栏同色',       _rn['capBg'] == _rn['snavBg'], (_rn['capBg'], _rn['snavBg']))
    need('品牌区右边框压在深色块右缘',
         abs(_rn['brandRight'] - _rn['snavW']) <= 1, (_rn['brandRight'], _rn['snavW']))
    need('深底文字对比度 ≥4.5',      _rn['min'] >= 4.5, _rn['ink'])
    need('左栏当前项（浅青块 + 深青字）对比度 ≥4.5',
         _rn['cur'] is not None and _rn['cur']['ratio'] >= 4.5, _rn['cur'])
    need('深底文字全部测到（探针没落空）',
         all(not i.get('miss') for i in _rn['ink']), [i for i in _rn['ink'] if i.get('miss')])

    # v55 系统改名：全站三处口径必须一致，且新名字在固定宽度的品牌位里塞得下。
    # 「塞得下」的判据用 scrollWidth vs clientWidth（nowrap 文本被容器裁掉时
    # scrollWidth 会大于可见宽度），而不是拿字数去乘字号估算。
    # 注意：titleTxt / descTxt 也读 _rn（跟 brandName 同在 railNav 里）——
    # 写成 d['titleTxt'] 会拿到 _Miss 哨兵，set() 直接抛错。
    _nm = [_rn['brandName'], _rn['titleTxt'], _rn['descTxt']]
    need('系统名三处口径一致（顶栏 / 标签页标题 / meta）',
         len(set(_nm)) == 1 and _nm[0] == SYS_NAME, _nm)
    need('系统名已无「AI」前缀残留',
         not any('AI' in s for s in _nm), _nm)
    need('品牌名没被压扁（内容宽度 = 可见宽度）',
         _rn['brandNameScroll'] <= _rn['brandNameBox'],
         (_rn['brandNameScroll'], _rn['brandNameBox']))
    need('品牌名在固定宽度品牌位内不溢出',
         _rn['brandNameBox'] <= _rn['brandW'],
         (_rn['brandNameBox'], _rn['brandW']))
    need('无缺失图标',               d['icoMiss'] == [], d['icoMiss'])
    need('data-go 无死链',           d['danglingGo'] == [], d['danglingGo'])

    # ---------- 用户与角色（v54）：三档身份，一套到底 ----------
    # 撤掉的是「临床医生 / 生信工程师」那对**视图**切换器 —— 它只切界面露哪些控件、
    # 不改任何权限，与真正决定权限的身份并存时，切了它却什么权限都没变。
    # 换成顶栏一处身份入口后，验四件事：旧切换器撤净、三档能力位与四处呈现同步、
    # 工程细节按角色显隐、两处权限门（知识审批 / 示例数据集配置）真的挡得住。
    need('原「临床医生 / 生信工程师」视图切换器整块撤除（.rolesw 一个不剩）',
         d['oldRolesw'] == 0, d['oldRolesw'])
    need('顶栏身份入口＝当前用户：角色名 + 三个角色选项都在菜单里',
         d['userSw'] != '(none)' and d['userSw']['opts'] == ['super', 'admin', 'user'], d['userSw'])
    _rs, _ru, _ra = d['roleSuper'], d['roleUser'], d['roleAdmin']
    need('切到普通用户：顶栏文案 / body[data-role] / 菜单高亮 / 权限位四处同步（少一处就是残影）',
         _ru['role'] == 'user' and _ru['bodyRole'] == 'user'
         and _ru['swName'] == '普通用户' and _ru['onOpt'] == 'user'
         and _ru['canManage'] is False and _ru['canConfig'] is False and _ru['basic'] is True, _ru)
    need('超级管理员＝所有权限；普通管理员＝增删改查 / 审批（能管不能配）',
         _rs['role'] == 'super' and _rs['canManage'] is True and _rs['canConfig'] is True
         and _ra['role'] == 'admin' and _ra['canManage'] is True and _ra['canConfig'] is False,
         (_rs, _ra))
    need('普通用户看不到工程细节（.eng-only 全隐），两档管理员看得见同样多',
         _ru['eng'] == 0 and _rs['eng'] > 0 and _ra['eng'] == _rs['eng'],
         (_ru['eng'], _rs['eng'], _ra['eng']))
    need('撤的是「视图」不是内容：推荐配置卡（.cli-only）对三档身份一律可见',
         _rs['cli'] == _ru['cli'] and _ru['cli'] > 0, (_rs['cli'], _ru['cli']))
    _ku, _ka, _ks = d['kbUser'], d['kbAdmin'], d['kbSuper']
    need('知识审批：普通用户只能提交审核，审核发布 / 归档 / 恢复全禁用并给出提示条',
         _ku['aprBtns'] > 0 and _ku['aprOff'] == _ku['aprBtns']
         and _ku['submitOn'] >= 1 and _ku['hint'] != '', _ku)
    need('知识审批：普通管理员与超级管理员全部可用，提示条收起',
         _ka['aprOff'] == 0 and _ka['disabled'] == 0
         and _ks['aprOff'] == 0 and _ka['hint'] == '' and _ks['hint'] == '', (_ka, _ks))
    _pA, _pS = d['pdsAdmin'], d['pdsSuper']
    need('示例数据集配置：超级管理员可改；普通管理员进来是只读（9 个开关 + 3 颗工具条按钮全禁用）',
         _pS['togglesOff'] == 0 and _pS['toolsOff'] == 0 and _pS['hint'] == ''
         and _pA['togglesOff'] == 9 and _pA['toolsOff'] == 3 and _pA['hint'] != '', (_pA, _pS))
    # ---------- v56：文件管理 · 系统文件也能上传（超级管理员） ----------
    # 判据分三层，缺一层就说明只改了按钮外观：
    #   ① 能力位：谁 canWrite（普通管理员也不行 —— 系统文件是平台级资产，
    #      与「示例数据集设置」同一档，取 canConfig()）；
    #   ② 面板形态：可写时拖拽区在，只读时换成一段写明「谁能传」的说明；
    #   ③ 行内动作：重命名 / 删除从「按钮」变成禁用态但**仍在**（不是凭空消失）。
    _fu, _fa2, _fs2 = d['fmUser'], d['fmAdmin'], d['fmSuper']
    need('系统文件写权限只给超级管理员（普通管理员 / 普通用户都不可写）',
         _fs2['canWrite'] is True and _fa2['canWrite'] is False and _fu['canWrite'] is False,
         (_fs2['canWrite'], _fa2['canWrite'], _fu['canWrite']))
    need('超级管理员：系统文件有上传区（拖拽 / 选择 / 立即上传都在）',
         _fs2['cardVisible'] is True and _fs2['dzShown'] is True
         and _fs2['upBtnShown'] is True and _fs2['alertShown'] is False, _fs2)
    need('只读身份：上传区换成「谁能传」的说明，不是整卡消失',
         _fu['alertShown'] is True and _fu['dzShown'] is False
         and _fu['cardVisible'] is True and '超级管理员' in (_fu['alertText'] or ''), _fu)
    need('两档只读身份都拿不到上传区，「新建文件夹」仍在但禁用',
         _fa2['dzShown'] is False and _fa2['newDirVisible'] is True
         and _fa2['newDirDisabled'] is True
         and _fu['newDirVisible'] is True and _fu['newDirDisabled'] is True, (_fa2, _fu))
    need('系统文件行内删改：可写时是按钮，只读时变禁用态而不是消失',
         _fs2['writeBtns'] > 0 and _fs2['offBtns'] == 0
         and _fu['writeBtns'] == 0 and _fu['offBtns'] > 0
         and _fa2['writeBtns'] == 0 and _fa2['offBtns'] > 0, (_fs2, _fa2, _fu))
    need('读权限三档都开着：系统文件的预览 / 下载对所有身份都在',
         # 前置 _fs2['viewBtns'] > 0 是关键：等于 0 说明探针量到了折叠态的空列表，
         # 那时后面两个「相等」是 0 == 0 的假绿 —— 必须先证明样本非空。
         _fs2['viewBtns'] > 0 and _fu['viewBtns'] == _fs2['viewBtns']
         and _fu['dlBtns'] == _fs2['dlBtns'] and _fu['dlBtns'] > 0,
         (_fs2['viewBtns'], _fu['viewBtns'], _fs2['dlBtns'], _fu['dlBtns']))
    need('页头一句就说清当前身份在系统文件上能做什么',
         '超级管理员' in (_fs2['hint'] or '') and '查看' in (_fu['hint'] or ''), (_fs2['hint'], _fu['hint']))
    # ---------- v58：知识赋能三页 → 页内挂载外部系统 ----------
    # 需求：「把原先的『医学知识库』『自有知识库』和『知识图谱』直接对接到 77.144
    # 的三个独立路径，分别是 ke、kb 和 kg。把 menu 参数去掉，然后在右侧工作区
    # 展示外部页面（保持左侧菜单布局）」。
    #
    # 这里刻意**不断言 iframe 加载成功**：跨域读不到内容，目标又是内网地址，
    # 成败取决于跑验证的这台机器有没有接内网 —— 那是环境不是缺陷，写进断言
    # 等于给回归埋一颗「换台机器就红」的雷。要断的是四件确定的事：
    _kf = d['kbFrames']
    _ext = 'http://192.168.77.144:20080/package2'
    # 三页一一对应需求给的三个路径；顺带把「menu 参数已去掉」钉住 —— 那是需求
    # 明确要求的动作，漏改不会有任何报错，只会静默多传一个参数。
    need('三页各自挂上外部系统的独立路径（ke / kb / kg）',
         _kf['kbmed']['src'] == _ext + '/ke'
         and _kf['kbown']['src'] == _ext + '/kb'
         and _kf['kbgraph']['src'] == _ext + '/kg',
         (_kf['kbmed']['src'], _kf['kbown']['src'], _kf['kbgraph']['src']))
    need('外部地址已去掉 menu 参数（需求明确要求）',
         'menu=' not in (_kf['kbmed']['src'] or '') and 'menu=' not in (_kf['kbown']['src'] or '')
         and 'menu=' not in (_kf['kbgraph']['src'] or '')
         and 'menu=' not in (_kf['kbmed']['urlTxt'] or ''),
         (_kf['kbmed']['src'], _kf['kbmed']['urlTxt']))
    # 「在右侧工作区展示」= 用 iframe 而不是跳外链：跳外链会把整站布局丢掉，
    # 那就不像一个整体。tag 断的就是这一条（JS 里 window.open 也一样断）。
    need('外部页面挂在右侧工作区（iframe 承载，不是跳外链）',
         _kf['kbmed']['tag'] == 'IFRAME' and _kf['kbown']['tag'] == 'IFRAME'
         and _kf['kbgraph']['tag'] == 'IFRAME',
         (_kf['kbmed']['tag'], _kf['kbown']['tag'], _kf['kbgraph']['tag']))
    need('默认停在外部系统视图，站内那份收起来（不是把内容删掉）',
         _kf['kbmed']['mode'] == 'ext' and _kf['kbmed']['frameShown'] is True
         and _kf['kbmed']['localHidden'] is True,
         (_kf['kbmed']['mode'], _kf['kbmed']['frameShown'], _kf['kbmed']['localHidden']))
    # 失败态必须带**真实可点**的退路：内网地址在别人机器上未必可达，
    # 没有退路就只剩一张白板，用户连「是我网络问题还是系统坏了」都判断不了。
    need('加载失败有真实可点的退路（重新加载 / 新标签打开）',
         _kf['kbmed']['reloadN'] >= 2 and _kf['kbmed']['openN'] >= 2
         and _kf['kbgraph']['reloadN'] >= 2 and _kf['kbgraph']['openN'] >= 2,
         (_kf['kbmed']['reloadN'], _kf['kbmed']['openN'],
          _kf['kbgraph']['reloadN'], _kf['kbgraph']['openN']))
    _ks = d['kbSwitch']
    need('可切到「站内版本」：站内内容还在，不是清空',
         _ks['modeAfterLocal'] == 'local' and _ks['frameHidden'] is True
         and _ks['localShown'] is True and _ks['localRows'] > 0,
         (_ks['modeAfterLocal'], _ks['frameHidden'], _ks['localShown'], _ks['localRows']))
    need('切视图不改地址（src 原样保留）',
         _ks['srcKept'] == _ext + '/ke', _ks['srcKept'])
    _ksb = d['kbSwitchBack']
    need('切回「外部系统」还原成功，且 aria-selected 跟着视图走',
         _ksb['mode'] == 'ext' and _ksb['frameShown'] is True and _ksb['localHidden'] is True
         and _kf['kbmed']['segExtOn'] == 'true' and _kf['kbmed']['segLocalOn'] == 'false',
         (_ksb, _kf['kbmed']['segExtOn'], _kf['kbmed']['segLocalOn']))
    # 站内那份的十几条既有断言（词条 / 审批 / 图谱画布）全押在 local 视图上，
    # 探针若没还原，后续那些会在错的视图上量 —— 所以「还原」本身必须是一条断言。
    need('三页都提供「外部系统 / 站内版本」两个入口（一个不少）',
         all(_kf[i]['segN'] == 2 for i in ('kbmed', 'kbown', 'kbgraph')),
         {i: _kf[i]['segN'] for i in ('kbmed', 'kbown', 'kbgraph')})
    # 知识库采集段（那 24 条断言）把三页切到了站内视图，段末必须切回。
    # 「还原」本身要是一条断言 —— 否则探针偷偷改了共享状态、后面整轮都绿，
    # 只是绿的已经不是原来那个页面（v54 在知识库模式上栽过同一回）。
    need('知识库采集段用完已还原回外部视图（探针不留共享状态残留）',
         d['kbLocalRestored'] is True, d['kbLocalRestored'])
    # ---------- 高保真定位：告警由状态驱动 / 界面无演示字样 / 无假按钮 ----------
    _f = d['anomFormat'];
    need('格式告警由真选文件触发',      _f['visible'] and _f['hasDanger'] == 1, _f)
    need('格式告警带上真实文件名',      _f['nameShown'], _f)
    need('格式可修复并给出结果',        '已转换' in d['anomFixed'], d['anomFixed'])
    _at = d['anomTemplate']
    need('异常面板里的格式模板也走确认框（不是直接下载）',
         _at['modal'] is True and _at['title'] == '下载确认'
         and (_at['name'] or '').endswith('.csv')
         and '已开始下载' not in (_at['toast'] or ''), _at)
    need('格式模板确认框的按钮能被自己接住，取消后关闭',
         _at['hitGo']['ok'] is True and _at['closed'] is True, _at)
    _pd = d['pickDemo']
    need('工作台点选示例数据集：载入并直接进入流程模板',
         _pd['fileCardHidden'] is False and _pd['cards'] >= 1
         and _pd['tag'] == '校验通过' and _pd['autoPage'] == 'page-p04', _pd)
    # 落点改了、提示语也得跟着改：说「当前在样本对齐」而人已经站在流程模板页，
    # 是那种「断言全绿、用户困惑」的错。文案里必须出现真实落点。
    need('载入提示语说明落点是流程模板（不是样本对齐）',
         '流程模板' in (_pd['toast'] or '') and '样本对齐' not in (_pd['toast'] or ''), _pd['toast'])

    _q = d['queueAnom'];
    need('排队态只显示「请等待」，无问题模块 / 算力队列 / 队列位次',
         _q['anomGone'] and _q['queueGone'] and _q['qPosGone']
         and '排队' in _q['runTag'] and _q['stageText'] == '请等待', _q)
    need('再点「开始执行」任务真的跑起来',
         d['runMid']['pct'] != '0%' and d['runMid']['pct'] != '', d['runMid'])

    # ---------- 任务流水线（阶段进度的唯一出口） ----------
    _rm = d['runMid']
    need('跑动中流水线是「1 个运行中 + 已完成 + 等待」三态并存',
         _rm['states'].count('run') == 1 and _rm['states'].count('done') >= 1
         and _rm['states'].count('wait') >= 1, _rm)
    need('运行中的节点带本阶段百分比与剩余时间',
         '% · 剩' in (_rm['runPct'] or '') and (_rm['runBarW'] or '').endswith('%'), _rm)
    _re = d['runEnd']
    need('跑完后五个节点全绿、四条连线全亮',
         _re['states'] == ['done'] * 5 and _re['arwDone'] == _re['arwAll'] == 4, _re)
    need('节点状态文案带耗时（完成 · Ns）',
         all('完成 ·' in s for s in _re['status']), _re['status'])
    need('流水线名称与工具版本都由 RUN_STAGES 渲染（5 个节点 · 无图标缺失）',
         len(_re['names']) == 5 and len(_re['tools']) == 5 and _re['stgSvg'] == 0, _re)
    need('流水线卡片副标题写明阶段数与计划耗时',
         '5 个阶段' in (_re['meta'] or '') and '3m12s' in (_re['meta'] or ''), _re['meta'])
    _rc = d['runCancel']
    need('取消后流水线不留「运行中」的节点（已完成的阶段保留）',
         _rc['runBefore'] == 1 and _rc['runAfter'] == 0
         and _rc['doneAfter'] >= 1 and '已取消' in _rc['tagAfter'], _rc)
    need('取消后「开始运行」重新可点（提示写的是可随时重新提交）',
         d['runAgain']['tag'] == '已完成', d['runAgain'])

    need('界面文案不含「演示」字样',    d['hifiNoDemo']['hits'] == 0, d['hifiNoDemo'])
    need('流程节点不再是假按钮',        d['dagSem']['total'] > 0 and d['dagSem']['role'] == 0
                                    and d['dagSem']['tabindex'] == 0, d['dagSem'])
    need('阈值展示值与常量同源',        d['thrSync']['ok'], d['thrSync'])

    # ---------- 列表对齐：表头与单元格同一套居中 ----------
    _ta = d['tblAlignCss']
    need('全站表格表头与单元格同为一套居中（静态 · 覆盖文档里全部 .tbl）',
         _ta['bad'] == [] and _ta['tables'] >= 25 and _ta['cells'] >= 400, _ta)
    _tg = d['tblAlignGeom']
    # cols 的期望值不是拍脑袋定的，是探针连着量了三张页（gene / p05 / p07）后
    # **现算出来的构成**：样本列表 11 列 + 流程参数摘要 7 + 三张卡 7/3/4 + 差异表 6 = 38。
    # 报 seen 字段就是为了这个 —— 数字对不上时先看是哪张表没渲染出来，而不是把阈值改小。
    need('实际渲染的表里，每个单元格内容的水平中心 = 该列表头的中心（≤2px）',
         _tg['bad'] == [] and _tg['tables'] >= 6 and _tg['cols'] >= 38, _tg)

    # ---------- 必填字段用提醒色标识（站内只有一套） ----------
    # v37：新建项目从「1 个必填」的单步表单变成「6 个必填」的五步向导第 1 步。
    # 这里守的不是那个 6，而是**三件套的一致性**：星号数 == aria-required 数，
    # 且 .req 总数 = 字段星号 + 图例星号（多一颗就说明有人手写了星号没走 reqMark）。
    need('新建项目：第 1 步 6 个必填项，挂提醒色星号 + 图例 + aria-required',
         d['reqProj']['marks'] == 6 and d['reqProj']['aria'] == 6
         and d['reqProj']['legend'] == 1 and d['reqProj']['oldTag'] == 0
         and d['reqProj']['legendMark'] == 1
         and d['reqProj']['allReq'] == d['reqProj']['marks'] + 1
         and '必填' in (d['reqProj']['legendText'] or ''), d['reqProj'])
    need('必填星号用的就是提醒色 token',
         d['reqProj']['color'] != '' and d['reqProj']['color'] == d['reqProj']['warnRgb'],
         (d['reqProj']['color'], d['reqProj']['warnRgb']))
    need('样本登记：样本 ID 是唯一必填项，旧的灰色「必填」标签已撤',
         d['reqSamp']['marks'] == 1 and d['reqSamp']['aria'] == 1
         and d['reqSamp']['legend'] == 1 and d['reqSamp']['oldTag'] == 0
         and d['reqSamp']['allReq'] == d['reqSamp']['marks'] + 1, d['reqSamp'])
    need('工具参数：三个必填项都标出来（R1 / R2 / 索引前缀）',
         d['reqTool']['marks'] == 3 and d['reqTool']['aria'] == 3
         and d['reqTool']['legend'] == 1 and d['reqTool']['refId']
         and d['reqTool']['allReq'] == d['reqTool']['marks'] + 1, d['reqTool'])
    need('必填项空着点运行会被拦住（提示 + 焦点回落到该字段）',
         d['reqTool']['notRun'] and d['reqTool']['focused'] == 'tp-ref', d['reqTool'])
    need('填回去就能提交（拦的是空值，不是按钮本身）',
         '已提交运行' in (d['reqTool']['runs'] or ''), d['reqTool']['runs'])

    need('无浏览器异常',             d['errs'] == [], d['errs'])
    need('驱动脚本跑完',             d.get('Z_DONE') == 'ok', d.get('Z_ERROR'))

    print('\n=== 判定 ===')
    print('Z_DONE =', 'ok' if not FAILS else 'FAIL', '（%d/%d 项通过）' % (TOTAL[0] - len(FAILS), TOTAL[0]))
    for f in FAILS:
        print('  FAIL', f)
    exc = [e for e in EVENTS if e.get("method") in ("Runtime.exceptionThrown", "Log.entryAdded")]
    print("\n=== 浏览器异常事件 ===")
    if not exc:
        print("无")
    for e in exc[:10]:
        print(json.dumps(e.get("params", {}), ensure_ascii=False)[:400])
finally:
    try:
        if ws: ws.close()
    except Exception: pass
    proc.send_signal(signal.SIGTERM)
    try: proc.wait(timeout=10)
    except Exception: proc.kill()
    log.close()
print("\n截图目录：", SHOTS)
