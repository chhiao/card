/* =========================================================
 * core/table.js — 共用「牌桌控制器」
 * 負責：頁面骨架、開局設定（幾人、誰是電腦）、輪流制交接畫面、
 *       電腦自動出牌、紀錄面板、結算畫面。
 * 各遊戲只需要提供 rules.js（純規則）＋ game.js 裡的 render()。
 * ========================================================= */
(function (g) {
  var CB = g.CB, h = CB.h;

  var AI_NAMES = ['阿牌', '小黑', '老K', '皮皮', '莊莊', '圈圈', '豆豆'];
  var LEVELS = [
    { id: 'easy', name: '簡單' },
    { id: 'normal', name: '普通' },
    { id: 'hard', name: '困難' }
  ];

  var Table = {};
  CB.Table = Table;
  Table.LEVELS = LEVELS;

  /**
   * config: {
   *   gameId: 'blackjack',
   *   render: function (ctx) {...}   // 把牌桌畫進 ctx.root
   * }
   */
  Table.mount = function (config) {
    var meta = CB.getGame(config.gameId);
    var rules = CB.rules[config.gameId];
    if (!meta) throw new Error('manifest 找不到遊戲：' + config.gameId);
    if (!rules) throw new Error('找不到規則模組：' + config.gameId + '（rules.js 是否有載入？）');

    document.title = meta.name + '｜牌搭子 Card Buddies';
    var app = document.getElementById('app');
    var T = { meta: meta, rules: rules, config: config, timer: null };

    /* ---------- 骨架 ---------- */
    T.stage = h('section', { class: 'stage felt', id: 'stage', 'aria-live': 'polite' });
    T.playersPanel = h('div', { class: 'panel players-panel' });
    T.logEl = h('ol', { class: 'log-list' });
    var header = h('header', { class: 'topbar' },
      h('a', { class: 'btn btn-ghost', href: '../../index.html' }, '← 大廳'),
      h('h1', { class: 'topbar-title' }, h('span', { class: 'emoji' }, meta.emoji), meta.name),
      h('div', { class: 'topbar-actions' },
        h('button', { class: 'btn btn-ghost', onclick: function () { showRules(T); } }, '📖 規則'),
        h('button', { class: 'btn btn-ghost', onclick: function () { showSetup(T); } }, '🔄 重新開局')
      )
    );
    app.appendChild(header);
    app.appendChild(h('main', { class: 'table-layout' },
      T.stage,
      h('aside', { class: 'sidebar' },
        T.playersPanel,
        h('div', { class: 'panel log-panel' }, h('h2', null, '牌局紀錄'), T.logEl),
        T.seedEl = h('p', { class: 'seed' })
      )
    ));
    T.overlay = h('div', { class: 'overlay', hidden: true });
    document.body.appendChild(T.overlay);

    showSetup(T);
    return T;
  };

  /* ---------- 開局設定 ---------- */
  function showSetup(T) {
    clearTimeout(T.timer);
    var meta = T.meta, p = meta.players;
    var saved = CB.store.get('setup:' + meta.id, null);
    var count = saved ? saved.length : p.default;
    var seats = [];
    for (var i = 0; i < p.max; i++) {
      seats.push(saved && saved[i] ? saved[i] : {
        name: i === 0 ? '你' : AI_NAMES[(i - 1) % AI_NAMES.length],
        type: i === 0 ? 'human' : 'ai',
        level: 'normal'
      });
    }

    var list = h('div', { class: 'seat-list' });
    var countSel = h('select', { class: 'input', 'aria-label': '玩家人數' });
    for (var n = p.min; n <= p.max; n++) countSel.appendChild(h('option', { value: n, selected: n === count }, n + ' 人'));
    countSel.addEventListener('change', function () { count = +countSel.value; drawSeats(); });
    var seedInput = h('input', { class: 'input', placeholder: '留空 = 隨機洗牌', value: CB.param('seed', '') });

    function drawSeats() {
      list.innerHTML = '';
      seats.slice(0, count).forEach(function (s, i) {
        var nameIn = h('input', { class: 'input', value: s.name, maxlength: 8, 'aria-label': '座位 ' + (i + 1) + ' 名稱' });
        nameIn.addEventListener('input', function () { s.name = nameIn.value.trim() || ('玩家' + (i + 1)); });
        var typeBtn = h('button', { class: 'btn btn-toggle ' + (s.type === 'human' ? 'is-human' : 'is-ai'), type: 'button' },
          s.type === 'human' ? '🙋 真人' : '🤖 電腦');
        typeBtn.addEventListener('click', function () { s.type = s.type === 'human' ? 'ai' : 'human'; drawSeats(); });
        var lvl = h('select', { class: 'input', disabled: s.type === 'human', 'aria-label': '電腦難度' });
        LEVELS.forEach(function (L) { lvl.appendChild(h('option', { value: L.id, selected: s.level === L.id }, L.name)); });
        lvl.addEventListener('change', function () { s.level = lvl.value; });
        list.appendChild(h('div', { class: 'seat-row' }, h('span', { class: 'seat-no' }, i + 1), nameIn, typeBtn, lvl));
      });
    }
    drawSeats();

    var startBtn = h('button', { class: 'btn btn-primary btn-lg' }, '開始發牌 🃏');
    startBtn.addEventListener('click', function () {
      var players = seats.slice(0, count).map(function (s) { return { name: s.name, type: s.type, level: s.level }; });
      CB.store.set('setup:' + meta.id, players);
      start(T, players, seedInput.value.trim() || CB.randomSeed());
    });

    openOverlay(T, h('div', { class: 'modal' },
      h('div', { class: 'modal-head' }, h('span', { class: 'modal-emoji' }, meta.emoji), h('h2', null, meta.name), h('p', null, meta.tagline)),
      h('label', { class: 'field' }, h('span', null, '人數'), countSel),
      list,
      h('p', { class: 'hint' }, '點「真人／電腦」切換。多位真人時會在同一台裝置輪流，換人時會先遮住手牌。'),
      h('details', { class: 'field-adv' }, h('summary', null, '進階：指定牌局編號（seed）'), seedInput,
        h('p', { class: 'hint' }, '同一個編號會發出一模一樣的牌，可以跟朋友比賽同一副牌。')),
      h('div', { class: 'modal-actions' }, startBtn)
    ));
  }

  /* ---------- 開局 & 主迴圈 ---------- */
  function start(T, players, seed) {
    clearTimeout(T.timer);
    closeOverlay(T);
    T.players = players;
    T.seed = seed;
    T.rng = CB.createRng(seed);
    T.state = T.rules.create(players, T.rng, T.meta.options || {});
    T.humans = players.map(function (p, i) { return p.type === 'human' ? i : -1; }).filter(function (i) { return i >= 0; });
    T.hidden = T.meta.hiddenInfo !== false;
    // 只有一位真人 → 永遠看他的牌；沒有真人 → 觀戰（全部攤開）
    T.viewer = T.humans.length ? T.humans[0] : -1;
    T.seedEl.textContent = '牌局編號：' + seed;
    T.lastLogLen = 0;
    T.logEl.innerHTML = '';
    loop(T);
  }

  function loop(T) {
    var rules = T.rules, state = T.state;
    var over = rules.isOver(state);
    var cp = over ? null : rules.currentPlayer(state);
    var needHandoff = !over && cp !== null && T.players[cp].type === 'human' &&
      T.hidden && T.humans.length > 1 && T.viewer !== cp;

    if (needHandoff) {
      T.cp = null; // 交接中不能操作
      draw(T, null, true);
      showHandoff(T, cp);
      return;
    }
    T.cp = cp;
    draw(T, cp, false);
    if (over) { T.timer = setTimeout(function () { showResult(T); }, 700); return; }
    if (T.players[cp].type === 'ai') {
      T.timer = setTimeout(function () {
        var move;
        try { move = rules.ai(state, cp, T.players[cp].level, T.rng); }
        catch (e) { console.error('[AI 錯誤]', e); }
        apply(T, move);
      }, T.meta.aiDelay || 800);
    }
  }

  function apply(T, move) {
    var legal = T.rules.legalMoves(T.state);
    if (!move || !isLegal(legal, move)) {
      console.warn('[table] 不合法的動作，改用第一個合法動作', move);
      move = legal[0];
    }
    T.rules.play(T.state, move);
    loop(T);
  }

  function isLegal(legal, move) {
    var key = moveKey(move);
    return legal.some(function (m) { return moveKey(m) === key; });
  }
  function moveKey(m) {
    if (m && m.cards) return (m.type || '') + ':' + m.cards.map(function (c) { return c.id || c; }).sort().join(',');
    return JSON.stringify(m);
  }
  Table.moveKey = moveKey;

  /* ---------- 繪製 ---------- */
  function draw(T, cp, covered) {
    var rules = T.rules, state = T.state, over = rules.isOver(state);
    var spectator = T.viewer === -1;
    var ctx = {
      state: state,
      players: T.players,
      root: T.stage,
      viewer: T.viewer,
      cp: cp,
      over: over,
      spectator: spectator,
      canAct: !over && cp !== null && T.players[cp].type === 'human' && (!T.hidden || T.viewer === cp || T.humans.length === 1),
      /** 這位玩家的手牌能不能翻開給目前螢幕前的人看 */
      seesHand: function (i) { return over || spectator || !T.hidden || i === T.viewer; },
      legal: function () { return rules.legalMoves(state); },
      play: function (move) { if (ctx.canAct) apply(T, move); },
      /** 只重畫（例如選牌），不推進遊戲 */
      rerender: function () { draw(T, cp, false); },
      hint: function () { return rules.ai(state, cp, 'normal', CB.createRng(T.seed + ':hint:' + (state.log || []).length)); },
      Cards: CB.Cards,
      h: h
    };
    T.stage.innerHTML = '';
    if (covered) T.stage.appendChild(h('div', { class: 'stage-cover' }, '🂠'));
    else T.config.render(ctx);
    drawPlayers(T, cp);
    drawLog(T);
  }

  function drawPlayers(T, cp) {
    var rules = T.rules;
    T.playersPanel.innerHTML = '';
    T.playersPanel.appendChild(h('h2', null, '玩家'));
    T.players.forEach(function (p, i) {
      T.playersPanel.appendChild(h('div', { class: 'player-chip' + (i === cp ? ' is-turn' : '') },
        h('span', { class: 'avatar' }, p.type === 'human' ? '🙋' : '🤖'),
        h('span', { class: 'player-name' }, p.name,
          p.type === 'ai' ? h('small', null, ' · ' + levelName(p.level)) : null),
        h('span', { class: 'player-sum' }, rules.summary ? rules.summary(T.state, i) : '')
      ));
    });
  }

  function drawLog(T) {
    var log = T.state.log || [];
    if (log.length < T.lastLogLen) { T.logEl.innerHTML = ''; T.lastLogLen = 0; }
    for (var i = T.lastLogLen; i < log.length; i++) T.logEl.appendChild(h('li', null, log[i]));
    T.lastLogLen = log.length;
    T.logEl.scrollTop = T.logEl.scrollHeight;
  }

  function levelName(id) {
    for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === id) return LEVELS[i].name;
    return id;
  }

  /* ---------- 覆蓋畫面 ---------- */
  function showHandoff(T, cp) {
    var name = T.players[cp].name;
    var go = h('button', { class: 'btn btn-primary btn-lg' }, '我是 ' + name + '，翻開手牌');
    go.addEventListener('click', function () { T.viewer = cp; closeOverlay(T); loop(T); });
    openOverlay(T, h('div', { class: 'modal modal-handoff' },
      h('div', { class: 'handoff-lock' }, '🔒'),
      h('h2', null, '輪到 ' + name),
      h('p', null, '請把裝置交給 ' + name + '，其他人先別偷看喔！'),
      h('div', { class: 'modal-actions' }, go)
    ));
    setTimeout(function () { go.focus(); }, 30);
  }

  function showResult(T) {
    var res = T.rules.result(T.state);
    var again = h('button', { class: 'btn btn-primary' }, '再來一局');
    again.addEventListener('click', function () { start(T, T.players, CB.randomSeed()); });
    var setup = h('button', { class: 'btn' }, '換人 / 設定');
    setup.addEventListener('click', function () { showSetup(T); });
    var view = h('button', { class: 'btn btn-ghost' }, '看牌桌');
    view.addEventListener('click', function () { closeOverlay(T); });
    openOverlay(T, h('div', { class: 'modal modal-result' },
      h('div', { class: 'result-trophy' }, '🏆'),
      h('h2', null, res.title),
      h('ol', { class: 'ranking' }, res.ranking.map(function (r, k) {
        return h('li', { class: k === 0 ? 'is-first' : '' },
          h('span', null, T.players[r.index].name), h('span', { class: 'rank-score' }, r.score));
      })),
      res.note ? h('p', { class: 'hint' }, res.note) : null,
      h('div', { class: 'modal-actions' }, view, setup, again),
      h('a', { class: 'link', href: '../../index.html' }, '回大廳')
    ));
  }

  function showRules(T) {
    var close = h('button', { class: 'btn btn-primary' }, '知道了');
    var wasOpen = !T.overlay.hidden ? Array.prototype.slice.call(T.overlay.childNodes) : null;
    close.addEventListener('click', function () {
      if (wasOpen) { T.overlay.innerHTML = ''; wasOpen.forEach(function (n) { T.overlay.appendChild(n); }); }
      else closeOverlay(T);
    });
    openOverlay(T, h('div', { class: 'modal' },
      h('div', { class: 'modal-head' }, h('span', { class: 'modal-emoji' }, '📖'), h('h2', null, T.meta.name + ' 規則')),
      h('ul', { class: 'rule-list' }, T.meta.rules.map(function (r) { return h('li', null, r); })),
      h('div', { class: 'modal-actions' }, close)
    ));
  }

  function openOverlay(T, content) {
    T.overlay.innerHTML = '';
    T.overlay.appendChild(content);
    T.overlay.hidden = false;
  }
  function closeOverlay(T) { T.overlay.hidden = true; T.overlay.innerHTML = ''; }
})(typeof window !== 'undefined' ? window : globalThis);
