/* =========================================================
 * games/big-two/rules.js — 大老二純規則 + 電腦 AI（不可碰 DOM）
 * ========================================================= */
(function (g) {
  var CB = g.CB, Cards = CB.Cards;

  var SUIT_POWER = { C: 0, D: 1, H: 2, S: 3 };
  /** 3→0, 4→1, … K→10, A→11, 2→12 */
  function bv(r) { return (r + 10) % 13; }
  function power(c) { return bv(c.r) * 4 + SUIT_POWER[c.s]; }
  function byPower(a, b) { return power(a) - power(b); }

  var TYPE_NAME = { single: '單張', pair: '對子', straight: '順子', fullhouse: '葫蘆', four: '鐵支', sflush: '同花順' };
  var FIVE_RANK = { straight: 1, fullhouse: 2, four: 3, sflush: 4 };

  /** 判斷一組牌是什麼牌型；不合法回傳 null */
  function analyze(cards) {
    var cs = cards.slice().sort(byPower), n = cs.length;
    var top = power(cs[n - 1]);
    if (n === 1) return { type: 'single', size: 1, key: top };
    if (n === 2) return cs[0].r === cs[1].r ? { type: 'pair', size: 2, key: top } : null;
    if (n !== 5) return null;

    var counts = {};
    cs.forEach(function (c) { counts[c.r] = (counts[c.r] || 0) + 1; });
    var groups = Object.keys(counts).map(function (r) { return { r: +r, n: counts[r] }; })
      .sort(function (a, b) { return b.n - a.n; });
    var flush = cs.every(function (c) { return c.s === cs[0].s; });
    var straight = groups.length === 5 && cs.every(function (c, i) { return i === 0 || bv(c.r) === bv(cs[i - 1].r) + 1; });

    if (straight && flush) return { type: 'sflush', size: 5, key: top };
    if (groups[0].n === 4) return { type: 'four', size: 5, key: bv(groups[0].r) };
    if (groups[0].n === 3 && groups[1].n === 2) return { type: 'fullhouse', size: 5, key: bv(groups[0].r) };
    if (straight) return { type: 'straight', size: 5, key: top };
    return null;
  }

  /** a 是否能壓過 b */
  function beats(a, b) {
    if (a.size !== b.size) return false;
    if (a.size === 5 && a.type !== b.type) return FIVE_RANK[a.type] > FIVE_RANK[b.type];
    return a.key > b.key;
  }

  /** 列出手牌所有合法牌型 */
  function allCombos(hand) {
    var out = [], h = hand.slice().sort(byPower), n = h.length, i, j;
    for (i = 0; i < n; i++) out.push(mk([h[i]]));
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) if (h[i].r === h[j].r) out.push(mk([h[i], h[j]]));
    if (n >= 5) {
      var idx = [0, 1, 2, 3, 4];
      while (true) {
        var pick = idx.map(function (k) { return h[k]; });
        var combo = analyze(pick);
        if (combo) out.push({ type: 'play', cards: pick, combo: combo });
        // 下一個組合
        var p = 4;
        while (p >= 0 && idx[p] === n - 5 + p) p--;
        if (p < 0) break;
        idx[p]++;
        for (var q = p + 1; q < 5; q++) idx[q] = idx[q - 1] + 1;
      }
    }
    return out;
    function mk(cs) { return { type: 'play', cards: cs, combo: analyze(cs) }; }
  }

  function comboName(combo) { return TYPE_NAME[combo.type]; }

  /** 給 AI 用的「這手牌有多弱」：越小越弱（越想先丟） */
  function weakness(m) {
    var c = m.combo;
    return (c.size === 5 ? FIVE_RANK[c.type] * 60 : 0) + c.key;
  }

  function nextTurn(state) {
    state.turn = (state.turn + 1) % state.hands.length;
    if (state.lastPlay && state.lastPlay.player === state.turn) {
      state.lastPlay = null;
      state.log.push('大家都 Pass，' + state.players[state.turn].name + ' 可以自由出牌。');
    }
  }

  CB.defineRules('big-two', {
    analyze: analyze,
    power: power,
    byPower: byPower,
    comboName: comboName,

    create: function (players, rng) {
      var deck = rng.shuffle(Cards.deck(1));
      var hands = players.map(function (_, i) { return deck.slice(i * 13, i * 13 + 13).sort(byPower); });
      // 誰先出：拿著全場最小牌的人（4 人時一定是 ♣3）
      var lowest = null, starter = 0;
      hands.forEach(function (hd, i) {
        if (!lowest || power(hd[0]) < power(lowest)) { lowest = hd[0]; starter = i; }
      });
      var state = {
        players: players, hands: hands, turn: starter, lastPlay: null,
        mustInclude: lowest.id, winner: null, trick: [], log: []
      };
      state.log.push(players[starter].name + ' 拿著最小的 ' + Cards.label(lowest) + '，先出牌。');
      return state;
    },

    currentPlayer: function (state) { return state.winner === null ? state.turn : null; },

    legalMoves: function (state) {
      if (state.winner !== null) return [];
      var combos = allCombos(state.hands[state.turn]);
      if (state.mustInclude) {
        return combos.filter(function (m) { return m.cards.some(function (c) { return c.id === state.mustInclude; }); });
      }
      if (!state.lastPlay) return combos;
      var target = state.lastPlay.combo;
      return combos.filter(function (m) { return beats(m.combo, target); }).concat([{ type: 'pass' }]);
    },

    play: function (state, move) {
      var name = state.players[state.turn].name;
      if (move.type === 'pass') {
        state.log.push(name + '：Pass');
        nextTurn(state);
        return state;
      }
      var ids = move.cards.map(function (c) { return c.id; });
      var cards = Cards.take(state.hands[state.turn], ids).sort(byPower);
      var combo = analyze(cards);
      state.lastPlay = { player: state.turn, cards: cards, combo: combo };
      state.mustInclude = null;
      state.log.push(name + ' 出 ' + comboName(combo) + '：' + Cards.labels(cards));
      if (state.hands[state.turn].length === 0) {
        state.winner = state.turn;
        state.log.push('🎉 ' + name + ' 出完牌了！');
        return state;
      }
      if (state.hands[state.turn].length === 1) state.log.push('⚠️ ' + name + ' 只剩最後一張！');
      nextTurn(state);
      return state;
    },

    isOver: function (state) { return state.winner !== null; },

    result: function (state) {
      var ranking = state.hands.map(function (hd, i) { return { index: i, left: hd.length, score: hd.length === 0 ? '出完！' : '剩 ' + hd.length + ' 張' }; })
        .sort(function (a, b) { return a.left - b.left; });
      return { title: state.players[state.winner].name + ' 第一個出完牌！', ranking: ranking };
    },

    summary: function (state, i) { return state.hands[i].length + ' 張'; },

    ai: function (state, i, level, rng) {
      var legal = this.legalMoves(state);
      var plays = legal.filter(function (m) { return m.type === 'play'; });
      var canPass = legal.some(function (m) { return m.type === 'pass'; });
      if (!plays.length) return { type: 'pass' };

      if (level === 'easy') {
        if (canPass && rng.chance(0.25)) return { type: 'pass' };
        // 偏好小牌，但有隨機性
        plays.sort(function (a, b) { return weakness(a) - weakness(b); });
        return plays[Math.min(plays.length - 1, rng.int(Math.min(3, plays.length)))];
      }

      var hand = state.hands[i];
      var n = state.hands.length;
      var nextLeft = state.hands[(i + 1) % n].length;
      var minOpp = Math.min.apply(null, state.hands.map(function (hd, k) { return k === i ? 99 : hd.length; }));
      var rankCount = {};
      hand.forEach(function (c) { rankCount[c.r] = (rankCount[c.r] || 0) + 1; });

      // 拆牌成本：單張拆掉對子/三條要扣分
      function cost(m) {
        var c = weakness(m);
        if (m.combo.size === 1 && rankCount[m.cards[0].r] >= 2) c += level === 'hard' ? 25 : 10;
        if (m.combo.size === 2 && rankCount[m.cards[0].r] >= 3) c += 8;
        if (m.cards.some(function (x) { return x.r === 2; }) && hand.length > 4) c += 15;
        return c;
      }

      if (!state.lastPlay) {
        // 自由出牌：優先把含有最小牌的組合丟掉，五張 > 對子 > 單張
        var lowestId = hand.slice().sort(byPower)[0].id;
        var withLow = plays.filter(function (m) { return m.cards.some(function (c) { return c.id === lowestId; }); });
        var pool = withLow.length ? withLow : plays;
        if (level === 'hard' && minOpp <= 2) {
          // 有人快出完：避免出單張
          var multi = plays.filter(function (m) { return m.combo.size > 1; });
          if (multi.length) pool = multi;
          else return plays.sort(function (a, b) { return weakness(b) - weakness(a); })[0];
        }
        pool.sort(function (a, b) { return (b.combo.size - a.combo.size) * 1000 + cost(a) - cost(b); });
        return pool[0];
      }

      // 跟牌
      plays.sort(function (a, b) { return cost(a) - cost(b); });
      var best = plays[0];
      var danger = level === 'hard' ? minOpp <= 2 : nextLeft <= 1;
      if (danger && state.lastPlay.combo.size === 1) {
        // 對手快贏了：直接出最大的單張壓住
        return plays.sort(function (a, b) { return weakness(b) - weakness(a); })[0];
      }
      var expensive = cost(best) - weakness(best) >= 15;
      if (canPass && expensive && !danger && rng.chance(0.7)) return { type: 'pass' };
      return best;
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
