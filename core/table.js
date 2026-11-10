/* =========================================================
 * core/table.js — 共用「牌桌控制器」
 * 負責：頁面骨架、開局設定（幾人、誰是好友、誰是電腦）、線上房間與邀請連結、
 *       電腦自動出牌、紀錄面板、結算畫面。
 * 各遊戲只需要提供 rules.js（純規則）＋ game.js 裡的 render()。
 *
 * 線上對戰（見 core/net.js）：
 *   - 房主（host）：開局設定的那台。跑完整的 rules.js，每次狀態改變就同步給所有好友。
 *   - 好友（guest）：用邀請連結（?join=代碼）打開的那台。只送出自己的動作，畫面照房主同步的狀態畫。
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
   *   gameId: 'big-two',
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
    var joinCode = CB.param('join', null);
    var T = {
      meta: meta, rules: rules, config: config, timer: null,
      role: joinCode ? 'guest' : 'host',
      phase: 'setup',   // setup：開局設定／等待中；play：牌局進行中（含結算）
      guests: [],       // 房主端：已連進來的好友 [{ link, name, seat }]
      gen: 0,           // 第幾局（換新局時 +1，好友端用來判斷要不要清畫面）
      me: 0             // 螢幕前的玩家是第幾個座位；-1 = 觀戰
    };

    /* ---------- 骨架 ---------- */
    T.stage = h('section', { class: 'stage felt', id: 'stage', 'aria-live': 'polite' });
    T.playersPanel = h('div', { class: 'panel players-panel' });
    T.logEl = h('ol', { class: 'log-list' });
    var header = h('header', { class: 'topbar' },
      h('a', { class: 'btn btn-ghost', href: '../../index.html' }, '← 大廳'),
      h('h1', { class: 'topbar-title' }, h('span', { class: 'emoji' }, meta.emoji), meta.name),
      h('div', { class: 'topbar-actions' },
        h('button', { class: 'btn btn-ghost', onclick: function () { showRules(T); } }, '📖 規則'),
        T.role === 'host' ? h('button', { class: 'btn btn-ghost', onclick: function () { showSetup(T); } }, '🔄 重新開局') : null
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

    if (T.role === 'guest') showJoin(T, joinCode);
    else showSetup(T);
    return T;
  };

  /* =========================================================
   * 房主：開局設定（同時也是等好友加入的房間）
   * ========================================================= */
  function isFriendSeat(s, i) { return i > 0 && s.type === 'human'; }

  function showSetup(T) {
    clearTimeout(T.timer);
    var resumable = T.phase === 'play' && !!T.state; // 牌局中按「重新開局」→ 可以取消回到牌局
    T.phase = 'setup';
    var meta = T.meta, p = meta.players;
    var saved = CB.store.get('setup:' + meta.id, null);
    var count = saved ? Math.min(Math.max(saved.length, p.min), p.max) : p.default;
    var seats = [];
    for (var i = 0; i < p.max; i++) {
      seats.push(saved && saved[i] ? saved[i] : {
        name: i === 0 ? '你' : AI_NAMES[(i - 1) % AI_NAMES.length],
        type: i === 0 ? 'human' : 'ai',
        level: 'normal'
      });
    }
    T.setupSeats = seats;
    T.setupCount = function () { return count; };

    var list = h('div', { class: 'seat-list' });
    var inviteWrap = h('div');
    var countSel = h('select', { class: 'input', 'aria-label': '玩家人數' });
    for (var n = p.min; n <= p.max; n++) countSel.appendChild(h('option', { value: n, selected: n === count }, n + ' 人'));
    countSel.addEventListener('change', function () { count = +countSel.value; drawSeats(); });
    var seedInput = h('input', { class: 'input', placeholder: '留空 = 隨機洗牌', value: CB.param('seed', '') });
    var startBtn = h('button', { class: 'btn btn-primary btn-lg' }, '開始發牌 🃏');

    function drawSeats() {
      assignSeats(T);
      list.innerHTML = '';
      seats.slice(0, count).forEach(function (s, i) {
        var friend = isFriendSeat(s, i), guest = guestAt(T, i);
        var nameIn = h('input', {
          class: 'input', maxlength: 8, 'aria-label': '座位 ' + (i + 1) + ' 名稱',
          value: friend ? (guest ? guest.name : '') : s.name,
          placeholder: friend ? '⏳ 等待好友加入…' : '',
          disabled: friend
        });
        nameIn.addEventListener('input', function () { s.name = nameIn.value.trim() || ('玩家' + (i + 1)); });
        var label = s.type === 'ai' ? '🤖 電腦' : (i === 0 ? '🙋 你' : '🌐 好友');
        var typeBtn = h('button', { class: 'btn btn-toggle ' + (s.type === 'human' ? 'is-human' : 'is-ai'), type: 'button' }, label);
        typeBtn.addEventListener('click', function () { s.type = s.type === 'human' ? 'ai' : 'human'; drawSeats(); });
        var lvl = h('select', { class: 'input', disabled: s.type === 'human', 'aria-label': '電腦難度' });
        LEVELS.forEach(function (L) { lvl.appendChild(h('option', { value: L.id, selected: s.level === L.id }, L.name)); });
        lvl.addEventListener('change', function () { s.level = lvl.value; });
        list.appendChild(h('div', { class: 'seat-row' }, h('span', { class: 'seat-no' }, i + 1), nameIn, typeBtn, lvl));
      });

      // 邀請連結與開始按鈕
      var friends = 0, missing = 0;
      seats.slice(0, count).forEach(function (s, i) {
        if (isFriendSeat(s, i)) { friends++; if (!guestAt(T, i)) missing++; }
      });
      inviteWrap.innerHTML = '';
      if (friends) { ensureRoom(T); inviteWrap.appendChild(inviteBox(T)); }
      startBtn.disabled = missing > 0 || (friends > 0 && !T.code);
      startBtn.textContent = missing ? '還在等 ' + missing + ' 位好友…' : '開始發牌 🃏';
      broadcastLobby(T);
    }
    T.redrawSetup = drawSeats;
    drawSeats();

    startBtn.addEventListener('click', function () {
      if (startBtn.disabled) return;
      var picked = seats.slice(0, count);
      CB.store.set('setup:' + meta.id, picked.map(function (s) { return { name: s.name, type: s.type, level: s.level }; }));
      var players = picked.map(function (s, i) {
        var guest = isFriendSeat(s, i) ? guestAt(T, i) : null;
        return guest ? { name: guest.name, type: 'human', level: s.level, online: true }
          : { name: s.name, type: s.type, level: s.level };
      });
      // 有線上好友時，預設名字「你」在好友畫面上會被誤會成他自己 → 改叫「房主」
      if (players[0].name === '你' && players.some(function (q) { return q.online; })) players[0].name = '房主';
      // 沒排到座位的好友請他們先離開
      T.guests.slice().forEach(function (gu) {
        if (gu.seat === null) dropGuest(T, gu, { t: 'full', text: '這桌已經坐滿了，下次早點來！' });
      });
      start(T, players, seedInput.value.trim() || CB.randomSeed());
    });

    openOverlay(T, h('div', { class: 'modal' },
      h('div', { class: 'modal-head' }, h('span', { class: 'modal-emoji' }, meta.emoji), h('h2', null, meta.name), h('p', null, meta.tagline)),
      h('label', { class: 'field' }, h('span', null, '人數'), countSel),
      list,
      h('p', { class: 'hint' }, '點「好友／電腦」切換。好友座位會產生邀請連結，好友用自己的手機或電腦打開就能加入。'),
      inviteWrap,
      h('details', { class: 'field-adv' }, h('summary', null, '進階：指定牌局編號（seed）'), seedInput,
        h('p', { class: 'hint' }, '同一個編號會發出一模一樣的牌，可以跟朋友比賽同一副牌。')),
      h('div', { class: 'modal-actions' },
        resumable ? h('button', { class: 'btn btn-ghost', type: 'button', onclick: function () { resume(T); } }, '取消，回到牌局')
          : h('a', { class: 'btn btn-ghost', href: '../../index.html' }, '← 回大廳'),
        startBtn)
    ));
  }

  function guestAt(T, seat) {
    for (var i = 0; i < T.guests.length; i++) if (T.guests[i].seat === seat) return T.guests[i];
    return null;
  }

  /** 依目前的座位設定，把好友排進「好友座位」（先來先排） */
  function assignSeats(T) {
    if (T.phase !== 'setup' || !T.setupSeats) return;
    var seats = T.setupSeats, count = T.setupCount();
    T.guests.forEach(function (gu) {
      if (gu.seat !== null && !(gu.seat < count && isFriendSeat(seats[gu.seat], gu.seat))) gu.seat = null;
    });
    T.guests.forEach(function (gu) {
      if (gu.seat !== null) return;
      for (var i = 1; i < count; i++) if (isFriendSeat(seats[i], i) && !guestAt(T, i)) { gu.seat = i; return; }
    });
  }

  /** 告訴每位好友目前的座位狀況（等待畫面用） */
  function broadcastLobby(T) {
    if (T.phase !== 'setup' || !T.setupSeats) return;
    var count = T.setupCount();
    var seats = T.setupSeats.slice(0, count).map(function (s, i) {
      var guest = isFriendSeat(s, i) ? guestAt(T, i) : null;
      return {
        name: isFriendSeat(s, i) ? (guest ? guest.name : '') : s.name,
        kind: s.type === 'ai' ? 'ai' : (i === 0 ? 'host' : 'friend')
      };
    });
    T.guests.forEach(function (gu) { gu.link.send({ t: 'lobby', seats: seats, seat: gu.seat }); });
  }

  /** 需要好友座位時才開房間（才會連網） */
  function ensureRoom(T) {
    if (T.room) return;
    T.code = null; T.roomError = null;
    T.room = CB.Net.host({
      onOpen: function (code) { T.code = code; if (T.phase === 'setup' && T.redrawSetup) T.redrawSetup(); },
      onError: function (text) {
        T.roomError = text;
        if (!T.code) { T.room.close(); T.room = null; }
        if (T.phase === 'setup' && T.redrawSetup) T.redrawSetup();
      },
      onConnect: function (link) { onGuestConnect(T, link); }
    });
  }

  function inviteBox(T) {
    var box = h('div', { class: 'invite-box' });
    if (T.roomError && !T.code) {
      box.appendChild(h('p', { class: 'invite-title' }, '⚠️ ' + T.roomError));
      box.appendChild(h('button', { class: 'btn', type: 'button', onclick: function () { T.roomError = null; T.redrawSetup(); } }, '重試'));
      return box;
    }
    if (!T.code) {
      box.appendChild(h('p', { class: 'invite-title' }, '🔗 正在建立房間…'));
      return box;
    }
    var url = CB.Net.inviteUrl(T.code);
    var input = h('input', { class: 'input', readonly: true, value: url, 'aria-label': '邀請連結', onfocus: function () { input.select(); } });
    var copy = h('button', { class: 'btn', type: 'button' }, '複製');
    copy.addEventListener('click', function () {
      function done() { copy.textContent = '已複製 ✓'; }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, fallback);
      else fallback();
      function fallback() { input.select(); try { if (document.execCommand('copy')) done(); } catch (e) { /* 忽略 */ } }
    });
    var row = h('div', { class: 'invite-row' }, input, copy);
    if (navigator.share) {
      row.appendChild(h('button', {
        class: 'btn', type: 'button', onclick: function () {
          navigator.share({ title: T.meta.name + '｜牌搭子', text: '一起來玩' + T.meta.name + '！', url: url }).catch(function () {});
        }
      }, '分享'));
    }
    box.appendChild(h('p', { class: 'invite-title' }, '🔗 把邀請連結傳給好友', h('span', { class: 'badge' }, '房號 ' + T.code)));
    box.appendChild(row);
    if (T.roomError) box.appendChild(h('p', { class: 'hint' }, '⚠️ ' + T.roomError));
    box.appendChild(h('p', { class: 'hint' }, '這個視窗要保持開著，好友才連得進來；好友到齊後就能開始。'));
    return box;
  }

  /* ---------- 房主：處理好友連線 ---------- */
  function onGuestConnect(T, link) {
    var gu = { link: link, name: '好友', seat: null, hello: false };
    link.onMessage = function (m) {
      if (m.t === 'hello' && !gu.hello) {
        gu.hello = true;
        gu.name = String(m.name || '').trim().slice(0, 8) || '好友';
        if (T.phase !== 'setup') { link.send({ t: 'full', text: '這桌已經開打了，等這局結束、房主回到設定畫面再加入吧！' }); setTimeout(link.close, 300); return; }
        T.guests.push(gu);
        if (T.redrawSetup) T.redrawSetup();
      } else if (m.t === 'move') {
        onRemoteMove(T, gu, m.move);
      }
    };
    link.onClose = function () { onGuestLeave(T, gu); };
  }

  function dropGuest(T, gu, farewell) {
    var k = T.guests.indexOf(gu);
    if (k >= 0) T.guests.splice(k, 1);
    gu.link.onClose = null;
    if (farewell) gu.link.send(farewell);
    setTimeout(gu.link.close, 300);
  }

  function onGuestLeave(T, gu) {
    var k = T.guests.indexOf(gu);
    if (k < 0) return;
    T.guests.splice(k, 1);
    if (T.phase === 'setup') { if (T.redrawSetup) T.redrawSetup(); return; }
    // 牌局中斷線 → 這個座位改由電腦代打，牌局不會卡住
    var p = gu.seat !== null && T.players[gu.seat];
    if (p && p.online) {
      p.type = 'ai'; p.level = 'normal'; p.online = false;
      if (T.rules.isOver(T.state)) { draw(T, null); return; }
      if (T.state.log) T.state.log.push(p.name + ' 斷線了，改由電腦（普通）代打。');
      loop(T);
    }
  }

  function onRemoteMove(T, gu, move) {
    if (T.phase !== 'play' || gu.seat === null) return;
    var legal = T.rules.legalMoves(T.state);
    if (!T.rules.isOver(T.state) && T.rules.currentPlayer(T.state) === gu.seat && move && isLegal(legal, move)) {
      T.rules.play(T.state, move);
      loop(T);
    } else {
      sync(T); // 不合法或不是他的回合 → 重送一次狀態，讓他的畫面解鎖
    }
  }

  /** 把目前牌局同步給所有好友 */
  function sync(T) {
    if (T.role !== 'host' || !T.guests.length) return;
    var msg = { t: 'sync', gen: T.gen, seed: T.seed, players: T.players, state: T.state };
    T.guests.forEach(function (gu) { if (gu.seat !== null) gu.link.send(msg); });
  }

  /* =========================================================
   * 好友：加入房間
   * ========================================================= */
  function showJoin(T, code) {
    var meta = T.meta;
    var nameIn = h('input', { class: 'input', maxlength: 8, value: CB.store.get('myName', ''), placeholder: '例如：小明', 'aria-label': '你的名字' });
    var status = h('p', { class: 'hint' });
    var go = h('button', { class: 'btn btn-primary btn-lg' }, '加入牌桌 🃏');
    function submit() {
      var name = nameIn.value.trim();
      if (!name) { status.textContent = '先取個名字吧！'; nameIn.focus(); return; }
      CB.store.set('myName', name);
      go.disabled = true;
      status.textContent = '連線中…';
      if (T.join) T.join.close();
      T.join = CB.Net.join(code, {
        onOpen: function (link) {
          T.link = link;
          link.onMessage = function (m) { onHostMessage(T, m); };
          link.onClose = function () {
            if (T.kicked) return;
            showMessage(T, '📴', '和房主斷線了', '房主可能關掉了視窗或網路不穩。請請房主重新傳一次邀請連結。');
          };
          link.send({ t: 'hello', name: name });
          status.textContent = '已連上，等房主安排座位…';
        },
        onError: function (text) { status.textContent = '⚠️ ' + text; go.disabled = false; }
      });
    }
    go.addEventListener('click', submit);
    nameIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });

    openOverlay(T, h('div', { class: 'modal' },
      h('div', { class: 'modal-head' }, h('span', { class: 'modal-emoji' }, meta.emoji),
        h('h2', null, '加入 ' + meta.name + ' 牌桌'), h('p', null, '好友邀請你一起玩！房號 ' + code)),
      h('label', { class: 'field' }, h('span', null, '你的名字'), nameIn),
      status,
      h('div', { class: 'modal-actions' }, h('a', { class: 'btn btn-ghost', href: '../../index.html' }, '← 回大廳'), go)
    ));
    setTimeout(function () { nameIn.focus(); }, 30);
  }

  function onHostMessage(T, m) {
    if (m.t === 'lobby') {
      T.phase = 'setup';
      T.me = m.seat === null ? -1 : m.seat;
      showWaiting(T, m.seats, m.seat);
    } else if (m.t === 'sync') {
      var fresh = m.gen !== T.gen || T.phase !== 'play';
      T.phase = 'play';
      T.players = m.players;
      T.state = m.state;
      T.pending = false;
      if (fresh) {
        T.gen = m.gen; T.seed = m.seed; T.resultShown = false;
        T.hidden = T.meta.hiddenInfo !== false;
        T.seedEl.textContent = '牌局編號：' + m.seed;
        T.lastLogLen = 0; T.logEl.innerHTML = '';
        closeOverlay(T);
      }
      var over = T.rules.isOver(T.state);
      draw(T, over ? null : T.rules.currentPlayer(T.state));
      if (over && !T.resultShown) { T.resultShown = true; T.timer = setTimeout(function () { showResult(T); }, 700); }
    } else if (m.t === 'full') {
      T.kicked = true;
      showMessage(T, '🙇', '沒有位子了', m.text);
    }
  }

  function showWaiting(T, seats, mySeat) {
    openOverlay(T, h('div', { class: 'modal modal-center' },
      h('div', { class: 'modal-icon' }, '⏳'),
      h('h2', null, mySeat === null ? '座位已滿' : '等房主開始…'),
      h('p', null, mySeat === null ? '房主調整座位中，有空位時會自動幫你排進去。' : '你坐在第 ' + (mySeat + 1) + ' 位，人到齊後房主就會發牌。'),
      h('ol', { class: 'ranking' }, seats.map(function (s, i) {
        var who = s.kind === 'ai' ? '🤖 ' + s.name : (s.kind === 'host' ? '🙋 ' + s.name + '（房主）' : (s.name ? '🌐 ' + s.name : '⏳ 等待好友加入…'));
        return h('li', { class: i === mySeat ? 'is-first' : '' }, h('span', null, who), h('span', { class: 'rank-score' }, i === mySeat ? '你' : ''));
      }))
    ));
  }

  function showMessage(T, icon, title, text) {
    clearTimeout(T.timer);
    openOverlay(T, h('div', { class: 'modal modal-center' },
      h('div', { class: 'modal-icon' }, icon),
      h('h2', null, title),
      h('p', null, text),
      h('div', { class: 'modal-actions' }, h('a', { class: 'btn btn-primary', href: '../../index.html' }, '回大廳'))
    ));
  }

  /* =========================================================
   * 房主：開局 & 主迴圈
   * ========================================================= */
  function start(T, players, seed) {
    clearTimeout(T.timer);
    closeOverlay(T);
    T.phase = 'play';
    T.redrawSetup = null;
    T.gen++;
    T.players = players;
    T.seed = seed;
    T.rng = CB.createRng(seed);
    T.state = T.rules.create(players, T.rng, T.meta.options || {});
    T.hidden = T.meta.hiddenInfo !== false;
    // 第 1 位是電腦 → 房主觀戰（全部攤開）
    T.me = players[0].type === 'human' ? 0 : -1;
    T.seedEl.textContent = '牌局編號：' + seed;
    T.lastLogLen = 0;
    T.logEl.innerHTML = '';
    // 記住每位好友這局坐哪裡（取消設定回到牌局時要還原）
    T.guests.forEach(function (gu) { gu.gameSeat = gu.seat; gu.gameGen = T.gen; });
    loop(T);
  }

  /** 從「重新開局」的設定畫面取消，回到原本的牌局 */
  function resume(T) {
    closeOverlay(T);
    T.phase = 'play';
    T.redrawSetup = null;
    // 這局本來就在的好友回到原座位；設定期間才加入的好友請他先離開
    T.guests.slice().forEach(function (gu) {
      if (gu.gameGen === T.gen && T.players[gu.gameSeat] && T.players[gu.gameSeat].online) gu.seat = gu.gameSeat;
      else dropGuest(T, gu, { t: 'full', text: '房主回到進行中的牌局了，等這局結束再加入吧！' });
    });
    // 設定期間離開的好友 → 改由電腦代打
    var over = T.rules.isOver(T.state);
    T.players.forEach(function (p, i) {
      if (p.online && !guestAt(T, i)) {
        p.type = 'ai'; p.level = 'normal'; p.online = false;
        if (!over && T.state.log) T.state.log.push(p.name + ' 斷線了，改由電腦（普通）代打。');
      }
    });
    if (over) { draw(T, null); sync(T); }
    else loop(T);
  }

  function loop(T) {
    clearTimeout(T.timer);
    var rules = T.rules, state = T.state;
    var over = rules.isOver(state);
    var cp = over ? null : rules.currentPlayer(state);
    draw(T, cp);
    sync(T);
    if (over) { T.timer = setTimeout(function () { showResult(T); }, 700); return; }
    if (T.players[cp].type === 'ai') {
      T.timer = setTimeout(function () {
        var move;
        try { move = rules.ai(state, cp, T.players[cp].level, T.rng); }
        catch (e) { console.error('[AI 錯誤]', e); }
        apply(T, move);
      }, T.meta.aiDelay || 800);
    }
    // 輪到房主 → 等按鈕；輪到好友 → 等 onRemoteMove
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

  /* ---------- 繪製（房主與好友共用） ---------- */
  function draw(T, cp) {
    var rules = T.rules, state = T.state, over = rules.isOver(state);
    var spectator = T.me === -1;
    var guest = T.role === 'guest';
    var ctx = {
      state: state,
      players: T.players,
      root: T.stage,
      viewer: T.me,
      cp: cp,
      over: over,
      spectator: spectator,
      canAct: !over && cp !== null && cp === T.me && !(guest && T.pending),
      /** 這位玩家的手牌能不能翻開給目前螢幕前的人看 */
      seesHand: function (i) { return over || spectator || !T.hidden || i === T.me; },
      legal: function () { return rules.legalMoves(state); },
      play: function (move) {
        if (!ctx.canAct) return;
        if (guest) { T.pending = true; T.link.send({ t: 'move', move: move }); draw(T, cp); }
        else apply(T, move);
      },
      /** 只重畫（例如選牌），不推進遊戲 */
      rerender: function () { draw(T, cp); },
      hint: function () { return rules.ai(state, cp, 'normal', CB.createRng(T.seed + ':hint:' + (state.log || []).length)); },
      /** 不是自己回合時，操作列顯示的等待文字 */
      waitText: function () {
        if (cp === null) return '';
        if (guest && T.pending && cp === T.me) return '⏳ 送出中…';
        var p = T.players[cp];
        return (p.type === 'ai' ? '🤖 ' : '🙋 ') + p.name + ' 思考中…';
      },
      Cards: CB.Cards,
      h: h
    };
    T.stage.innerHTML = '';
    T.config.render(ctx);
    drawPlayers(T, cp);
    drawLog(T);
  }

  function drawPlayers(T, cp) {
    var rules = T.rules;
    T.playersPanel.innerHTML = '';
    T.playersPanel.appendChild(h('h2', null, '玩家'));
    T.players.forEach(function (p, i) {
      var note = p.type === 'ai' ? ' · ' + levelName(p.level) : (i === T.me ? (p.name === '你' ? '' : ' · 你') : (p.online ? ' · 線上' : ''));
      T.playersPanel.appendChild(h('div', { class: 'player-chip' + (i === cp ? ' is-turn' : '') },
        h('span', { class: 'avatar' }, p.type === 'human' ? '🙋' : '🤖'),
        h('span', { class: 'player-name' }, p.name, note ? h('small', null, note) : null),
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
  function showResult(T) {
    var res = T.rules.result(T.state);
    var view = h('button', { class: 'btn btn-ghost' }, '看牌桌');
    view.addEventListener('click', function () { closeOverlay(T); });
    var actions;
    if (T.role === 'guest') {
      actions = h('div', { class: 'modal-actions' }, view);
    } else {
      var again = h('button', { class: 'btn btn-primary' }, '再來一局');
      again.addEventListener('click', function () { start(T, T.players, CB.randomSeed()); });
      var setup = h('button', { class: 'btn' }, '換人 / 設定');
      setup.addEventListener('click', function () { showSetup(T); });
      actions = h('div', { class: 'modal-actions' }, view, setup, again);
    }
    openOverlay(T, h('div', { class: 'modal modal-result' },
      h('div', { class: 'result-trophy' }, '🏆'),
      h('h2', null, res.title),
      h('ol', { class: 'ranking' }, res.ranking.map(function (r, k) {
        return h('li', { class: k === 0 ? 'is-first' : '' },
          h('span', null, T.players[r.index].name), h('span', { class: 'rank-score' }, r.score));
      })),
      res.note ? h('p', { class: 'hint' }, res.note) : null,
      T.role === 'guest' ? h('p', { class: 'hint' }, '等房主開下一局…') : null,
      actions,
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
      h('p', { class: 'hint' }, h('a', { href: '../../wiki.html#' + T.meta.id, target: '_blank' }, '📚 到規則百科看新手攻略')),
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
