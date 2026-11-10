#!/usr/bin/env node
/* =========================================================
 * tools/simulate.js — 讓電腦自己打 N 局，確認規則不會卡死、AI 只出合法牌
 * 用法：node tools/simulate.js            （所有遊戲，各 200 局）
 *       node tools/simulate.js big-two 500
 *       node tools/simulate.js my-game 50 templates/game-template   （測模板或新資料夾）
 * ========================================================= */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.join(__dirname, '..');

function load(ctx, rel) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });
}

var sandbox = { console: console };
sandbox.globalThis = sandbox;
var ctx = vm.createContext(sandbox);
['core/base.js', 'core/rng.js', 'core/cards.js', 'games/manifest.js'].forEach(function (f) { load(ctx, f); });
var CB = sandbox.CB;

var only = process.argv[2];
var N = +(process.argv[3] || 200);
var customDir = process.argv[4];

var targets = only ? [only] : CB.games.map(function (g) { return g.id; });
var LEVELS = ['easy', 'normal', 'hard'];
var failed = false;

targets.forEach(function (id) {
  var dir = customDir || ('games/' + id);
  load(ctx, dir + '/rules.js');
  var rules = CB.rules[id];
  var meta = CB.getGame(id) || { players: { min: 2, max: 4 }, options: {} };
  if (!rules) { console.error('✗ 找不到規則模組 ' + id); failed = true; return; }

  var wins = {}, totalSteps = 0, maxSteps = 0, t0 = Date.now();
  for (var k = 0; k < N; k++) {
    var count = meta.players.min + (k % (meta.players.max - meta.players.min + 1));
    var players = [];
    for (var i = 0; i < count; i++) players.push({ name: 'P' + i, type: 'ai', level: LEVELS[i % 3] });
    var rng = CB.createRng('sim-' + id + '-' + k);
    var state = rules.create(players, rng, meta.options || {});
    var steps = 0;
    while (!rules.isOver(state)) {
      var cp = rules.currentPlayer(state);
      var legal = rules.legalMoves(state);
      if (!legal.length) { fail(id, k, '輪到 ' + cp + ' 卻沒有任何合法動作'); break; }
      var move = rules.ai(state, cp, players[cp].level, rng);
      var key = moveKey(move);
      if (!legal.some(function (m) { return moveKey(m) === key; })) { fail(id, k, 'AI 出了不合法的動作 ' + key); break; }
      rules.play(state, move);
      if (++steps > 5000) { fail(id, k, '超過 5000 步還沒結束（可能卡死）'); break; }
    }
    if (rules.isOver(state)) {
      var res = rules.result(state);
      if (!res || !res.title || !res.ranking || res.ranking.length !== count) fail(id, k, 'result() 格式錯誤');
      else {
        var lvl = players[res.ranking[0].index].level;
        wins[lvl] = (wins[lvl] || 0) + 1;
      }
    }
    totalSteps += steps; maxSteps = Math.max(maxSteps, steps);
  }
  console.log((failed ? '✗ ' : '✓ ') + id + '：' + N + ' 局，平均 ' + (totalSteps / N).toFixed(1) + ' 步（最多 ' + maxSteps + '），' +
    (Date.now() - t0) + 'ms，第一名難度分布 ' + JSON.stringify(wins));
});

function moveKey(m) {
  if (m && m.cards) return (m.type || '') + ':' + m.cards.map(function (c) { return c.id || c; }).sort().join(',');
  return JSON.stringify(m);
}
function fail(id, k, msg) { failed = true; console.error('✗ [' + id + '] 第 ' + k + ' 局：' + msg); }

process.exit(failed ? 1 : 0);
