#!/usr/bin/env node
/* =========================================================
 * tools/check.js — 結構檢查：manifest、資料夾、檔名、載入順序是否符合 AGENTS.md
 * 用法：node tools/check.js
 * ========================================================= */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.join(__dirname, '..');
var errors = [], warns = [];
function rd(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }

var sb = { console: console }; sb.globalThis = sb;
var ctx = vm.createContext(sb);
['core/base.js', 'core/rng.js', 'core/cards.js'].forEach(function (f) { vm.runInContext(rd(f), ctx, { filename: f }); });
try { vm.runInContext(rd('games/manifest.js'), ctx, { filename: 'games/manifest.js' }); }
catch (e) { errors.push('games/manifest.js 執行失敗：' + e.message); }
var CB = sb.CB;

var EXPECTED_SCRIPTS = ['../../core/base.js', '../../core/rng.js', '../../core/cards.js', '../../core/net.js', '../../core/table.js', '../manifest.js', 'rules.js', 'game.js'];
var ID_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

CB.games.forEach(function (g) {
  var dir = 'games/' + g.id;
  if (!ID_RE.test(g.id)) errors.push(g.id + '：id 必須是小寫 kebab-case（例如 big-two）');
  ['index.html', 'rules.js', 'game.js'].forEach(function (f) {
    if (!exists(dir + '/' + f)) errors.push(g.id + '：缺少 ' + dir + '/' + f);
  });
  var p = g.players;
  if (!p || !(p.min >= 1 && p.max >= p.min && p.default >= p.min && p.default <= p.max))
    errors.push(g.id + '：players 需為 {min, max, default} 且 min ≤ default ≤ max');
  if (!Array.isArray(g.tags) || g.tags.length < 1 || g.tags.length > 3) errors.push(g.id + '：tags 需要 1–3 個');
  if (!Array.isArray(g.rules) || g.rules.length < 3) errors.push(g.id + '：rules 至少寫 3 條');
  if (g.tagline && g.tagline.length > 28) warns.push(g.id + '：tagline 超過 28 字，卡片可能太擠');
  if (g.difficulty && [1, 2, 3].indexOf(g.difficulty) < 0) errors.push(g.id + '：difficulty 只能是 1、2、3');

  if (exists(dir + '/index.html')) {
    var html = rd(dir + '/index.html');
    var srcs = (html.match(/<script src="([^"]+)"/g) || []).map(function (s) { return s.replace(/<script src="|"/g, ''); });
    if (JSON.stringify(srcs) !== JSON.stringify(EXPECTED_SCRIPTS))
      errors.push(g.id + '：index.html 的 <script> 載入順序不符合規範，應為 ' + EXPECTED_SCRIPTS.join(' → '));
    if (html.indexOf('lang="zh-Hant-TW"') < 0) errors.push(g.id + '：index.html 需要 lang="zh-Hant-TW"');
    if (html.indexOf('../../assets/style.css') < 0) errors.push(g.id + '：index.html 沒有引用 assets/style.css');
  }
  if (exists(dir + '/rules.js')) {
    var rules = rd(dir + '/rules.js');
    if (rules.indexOf("CB.defineRules('" + g.id + "'") < 0) errors.push(g.id + "：rules.js 必須呼叫 CB.defineRules('" + g.id + "', …)");
    if (/\bdocument\.|\bwindow\.(?!CB)|localStorage/.test(rules)) errors.push(g.id + '：rules.js 不可使用 DOM / localStorage');
    if (/Math\.random/.test(rules)) errors.push(g.id + '：rules.js 不可使用 Math.random()，請用傳入的 rng');
    try { vm.runInContext(rules, ctx, { filename: dir + '/rules.js' }); }
    catch (e) { errors.push(g.id + '：rules.js 執行失敗：' + e.message); }
  }
  if (exists(dir + '/game.js')) {
    var game = rd(dir + '/game.js');
    if (game.indexOf("gameId: '" + g.id + "'") < 0) errors.push(g.id + "：game.js 必須呼叫 CB.Table.mount({ gameId: '" + g.id + "', … })");
    if (/Math\.random/.test(game)) errors.push(g.id + '：game.js 不可使用 Math.random()');
  }
});

// games/ 底下不能有沒登記的資料夾
fs.readdirSync(path.join(ROOT, 'games')).forEach(function (name) {
  if (fs.statSync(path.join(ROOT, 'games', name)).isDirectory() && !CB.getGame(name))
    errors.push('games/' + name + '/ 沒有在 games/manifest.js 登記');
});

// 共用檔案存在
['index.html', 'assets/style.css', 'core/table.js', 'core/net.js', 'core/lobby.js', 'AGENTS.md', 'CLAUDE.md', 'README.md', '.nojekyll']
  .forEach(function (f) { if (!exists(f)) errors.push('缺少必要檔案 ' + f); });

// LLM Wiki（規則百科）：內容檢查 + wiki-data.js 是否是最新的（見 AGENTS.md 第 11 節）
['wiki.html', 'core/markdown.js', 'core/wiki.js', 'wiki/index.md', 'wiki/log.md']
  .forEach(function (f) { if (!exists(f)) errors.push('缺少百科檔案 ' + f); });
try {
  var wiki = require('./wiki.js').lint();
  wiki.errors.forEach(function (e) { errors.push('[百科] ' + e); });
  wiki.warns.forEach(function (w) { warns.push('[百科] ' + w); });
  if (!wiki.errors.length && (!exists('wiki/wiki-data.js') || rd('wiki/wiki-data.js').replace(/\r\n?/g, '\n') !== wiki.output))
    errors.push('[百科] wiki/wiki-data.js 不是最新的：請執行 node tools/wiki.js');
} catch (e) { errors.push('[百科] tools/wiki.js 執行失敗：' + e.message); }

warns.forEach(function (w) { console.log('⚠️  ' + w); });
if (errors.length) {
  errors.forEach(function (e) { console.error('✗ ' + e); });
  console.error('\n共 ' + errors.length + ' 個問題，請修正後再提交。');
  process.exit(1);
}
console.log('✓ 結構檢查通過：' + CB.games.length + ' 個遊戲（' + CB.games.map(function (g) { return g.id; }).join(', ') + '）');
