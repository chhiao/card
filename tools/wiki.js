#!/usr/bin/env node
/* =========================================================
 * tools/wiki.js — LLM Wiki 的「編譯 + 健康檢查」（見 AGENTS.md 第 11 節）
 * 用法：node tools/wiki.js           檢查 wiki/，通過後重新產生 wiki/wiki-data.js
 *       node tools/wiki.js --check   只檢查（含 wiki-data.js 是否是最新的），不寫檔
 *
 * 為什麼要產生 wiki-data.js：網站要能用 file:// 直接開，瀏覽器不能 fetch .md 檔，
 * 所以把 Markdown 包成 <script> 可以載入的 CB.wiki 資料。wiki-data.js 不要手改。
 * ========================================================= */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.join(__dirname, '..');
var WIKI = path.join(ROOT, 'wiki');
var OUT = path.join(WIKI, 'wiki-data.js');
var CATEGORIES = ['遊戲攻略', '基礎知識', '網站說明'];
var REQUIRED = ['title', 'emoji', 'category', 'updated'];
var ID_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function rd(p) { return fs.readFileSync(p, 'utf8').replace(/\r\n?/g, '\n'); }

/** 讀 --- 包起來的簡易 frontmatter（key: value、key: [a, b]） */
function parseFront(text) {
  var m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: null, body: text };
  var meta = {};
  m[1].split('\n').forEach(function (line) {
    var kv = line.match(/^([a-z]+):\s*(.*)$/);
    if (!kv) return;
    var v = kv[2].trim();
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    meta[kv[1]] = v;
  });
  return { meta: meta, body: text.slice(m[0].length).trim() + '\n' };
}

function loadCB() {
  var sb = { console: console }; sb.globalThis = sb;
  var ctx = vm.createContext(sb);
  ['core/base.js', 'core/rng.js', 'core/cards.js', 'core/markdown.js', 'games/manifest.js'].forEach(function (f) {
    vm.runInContext(rd(path.join(ROOT, f)), ctx, { filename: f });
  });
  return sb.CB;
}

/** 檢查整個 wiki/，回傳 { errors, warns, data, output } */
function lint() {
  var CB = loadCB(), md = CB.markdown;
  var errors = [], warns = [];
  if (!fs.existsSync(WIKI)) return { errors: ['缺少 wiki/ 資料夾'], warns: warns };

  var raw = fs.existsSync(path.join(WIKI, 'raw')) ? fs.readdirSync(path.join(WIKI, 'raw')).filter(function (f) { return /\.md$/.test(f); }).sort() : [];
  var rawList = raw.map(function (f) {
    var first = (rd(path.join(WIKI, 'raw', f)).match(/^#\s+(.*)$/m) || [])[1] || f;
    return { file: f, title: first.replace(/^原始資料：/, '') };
  });

  var pages = fs.readdirSync(path.join(WIKI, 'pages')).filter(function (f) { return /\.md$/.test(f); }).sort().map(function (f) {
    var id = f.replace(/\.md$/, ''), p = parseFront(rd(path.join(WIKI, 'pages', f)));
    var where = 'wiki/pages/' + f;
    if (!ID_RE.test(id)) errors.push(where + '：檔名必須是小寫 kebab-case');
    if (!p.meta) { errors.push(where + '：缺少 --- frontmatter ---'); p.meta = {}; }
    REQUIRED.forEach(function (k) { if (!p.meta[k]) errors.push(where + '：frontmatter 缺少 ' + k); });
    if (p.meta.category && CATEGORIES.indexOf(p.meta.category) < 0) errors.push(where + '：category 只能是 ' + CATEGORIES.join('／'));
    if (p.meta.updated && !/^\d{4}-\d{2}-\d{2}$/.test(p.meta.updated)) errors.push(where + '：updated 要寫成 YYYY-MM-DD');
    var sources = Array.isArray(p.meta.sources) ? p.meta.sources : [];
    sources.forEach(function (s) { if (raw.indexOf(s) < 0) errors.push(where + '：sources 裡的 ' + s + ' 不在 wiki/raw/'); });
    if (p.meta.game && !CB.getGame(p.meta.game)) errors.push(where + '：game: ' + p.meta.game + ' 不在 games/manifest.js');
    if (/\{\{rules\}\}/.test(p.body) && !p.meta.game) errors.push(where + '：用了 {{rules}} 但 frontmatter 沒有 game');
    md.cardTokens(p.body).forEach(function (t) { if (!md.parseCard(t)) errors.push(where + '：看不懂的牌 {{' + t + '}}（寫法例如 ♠A、♥10、🃏）'); });
    if (/<[a-z][\s\S]*>/i.test(p.body.replace(/`[^`]*`/g, ''))) warns.push(where + '：內容裡有 HTML 標籤，網頁會原樣顯示成文字');
    return {
      id: id, title: p.meta.title || id, emoji: p.meta.emoji || '📄', category: p.meta.category || '',
      game: p.meta.game || null, sources: sources, updated: p.meta.updated || '', body: p.body
    };
  });

  // 遊戲頁依大廳（manifest）順序排，其他頁依檔名
  var order = function (p) { var k = CB.games.map(function (g) { return g.id; }).indexOf(p.game); return k < 0 ? 99 : k; };
  pages.sort(function (a, b) { return order(a) - order(b) || (a.id < b.id ? -1 : 1); });

  var ids = pages.map(function (p) { return p.id; });
  var index = fs.existsSync(path.join(WIKI, 'index.md')) ? rd(path.join(WIKI, 'index.md')) : (errors.push('缺少 wiki/index.md'), '');
  var log = fs.existsSync(path.join(WIKI, 'log.md')) ? rd(path.join(WIKI, 'log.md')) : (errors.push('缺少 wiki/log.md'), '');

  // 斷掉的連結
  [{ name: 'wiki/index.md', text: index }, { name: 'wiki/log.md', text: log }].concat(pages.map(function (p) { return { name: 'wiki/pages/' + p.id + '.md', text: p.body }; }))
    .forEach(function (doc) {
      md.links(doc.text).forEach(function (l) { if (ids.indexOf(l) < 0) errors.push(doc.name + '：[[' + l + ']] 連到不存在的頁面'); });
    });
  // 孤兒頁：index.md 一定要列出每一頁
  var fromIndex = md.links(index);
  ids.forEach(function (id) { if (fromIndex.indexOf(id) < 0) errors.push('wiki/index.md 沒有列出 [[' + id + ']]（孤兒頁面）'); });
  // 被其他頁面連到的次數太少，只是提醒
  ids.forEach(function (id) {
    var n = pages.filter(function (p) { return p.id !== id && md.links(p.body).indexOf(id) >= 0; }).length;
    if (!n) warns.push('[[' + id + ']] 沒有被任何其他頁面連到，考慮在相關頁面加連結');
  });
  // 每個遊戲都要有攻略頁
  CB.games.forEach(function (g) {
    var page = pages.filter(function (p) { return p.game === g.id; })[0];
    if (!page) errors.push('遊戲 ' + g.id + ' 還沒有百科頁面：請新增 wiki/pages/' + g.id + '.md（game: ' + g.id + '）');
  });
  if (!/^## \[\d{4}-\d{2}-\d{2}\] (ingest|query|lint) \| /m.test(log)) errors.push('wiki/log.md 至少要有一筆「## [YYYY-MM-DD] ingest|query|lint | 標題」紀錄');

  var data = { index: index, log: log, raw: rawList, pages: pages };
  var output = '/* 自動產生，請不要手改：改 wiki/ 底下的 .md 之後執行 node tools/wiki.js */\n' +
    'CB.wiki = ' + JSON.stringify(data, null, 1) + ';\n';
  return { errors: errors, warns: warns, data: data, output: output };
}

module.exports = { lint: lint, OUT: OUT };

if (require.main === module) {
  var onlyCheck = process.argv.indexOf('--check') >= 0;
  var r = lint();
  r.warns.forEach(function (w) { console.log('⚠️  ' + w); });
  if (!r.errors.length && onlyCheck && (!fs.existsSync(OUT) || rd(OUT) !== r.output))
    r.errors.push('wiki/wiki-data.js 不是最新的：請執行 node tools/wiki.js 重新產生');
  if (r.errors.length) {
    r.errors.forEach(function (e) { console.error('✗ ' + e); });
    console.error('\n共 ' + r.errors.length + ' 個問題。');
    process.exit(1);
  }
  if (!onlyCheck) fs.writeFileSync(OUT, r.output);
  console.log('✓ 百科檢查通過：' + r.data.pages.length + ' 頁、' + r.data.raw.length + ' 份原始資料' +
    (onlyCheck ? '（wiki-data.js 是最新的）' : '，已產生 wiki/wiki-data.js'));
}
