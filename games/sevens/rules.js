/* =========================================================
 * games/sevens/rules.js — 排七純規則 + 電腦 AI（不可碰 DOM）
 * ========================================================= */
(function (g) {
  var CB = g.CB, Cards = CB.Cards;
  var SUIT_ORDER = { S: 0, H: 1, D: 2, C: 3 };

  function sortHand(hand) {
    return hand.sort(function (a, b) { return SUIT_ORDER[a.s] - SUIT_ORDER[b.s] || a.r - b.r; });
  }

  function canPlay(state, c) {
    if (state.first) return c.id === 'S7';
    var row = state.rows[c.s];
    if (!row) return c.r === 7;
    return c.r === row.lo - 1 || c.r === row.hi + 1;
  }

  function nextTurn(state) {
    var n = state.hands.length;
    for (var k = 1; k <= n; k++) {
      var i = (state.turn + k) % n;
      if (state.hands[i].length) { state.turn = i; return; }
    }
    state.done = true;
    state.log.push('🏁 所有牌都出完了，結算罰分！');
  }

  function penalty(state, i) {
    return state.covered[i].reduce(function (sum, c) { return sum + c.r; }, 0);
  }

  CB.defineRules('sevens', {
    sortHand: sortHand,
    penalty: penalty,

    create: function (players, rng) {
      var deck = rng.shuffle(Cards.deck(1));
      var hands = players.map(function () { return []; });
      deck.forEach(function (c, k) { hands[k % players.length].push(c); });
      hands.forEach(sortHand);
      var starter = 0;
      hands.forEach(function (hd, i) { if (hd.some(function (c) { return c.id === 'S7'; })) starter = i; });
      var state = {
        players: players, hands: hands, covered: players.map(function () { return []; }),
        rows: { S: null, H: null, D: null, C: null },
        turn: starter, first: true, done: false, log: []
      };
      state.log.push(players[starter].name + ' 拿到 ♠7，先出。');
      return state;
    },

    currentPlayer: function (state) { return state.done ? null : state.turn; },

    legalMoves: function (state) {
      if (state.done) return [];
      var hand = state.hands[state.turn];
      var plays = hand.filter(function (c) { return canPlay(state, c); });
      if (plays.length) return plays.map(function (c) { return { type: 'play', cards: [c] }; });
      return hand.map(function (c) { return { type: 'cover', cards: [c] }; });
    },

    play: function (state, move) {
      var i = state.turn, name = state.players[i].name;
      var c = Cards.take(state.hands[i], [move.cards[0].id])[0];
      if (move.type === 'play') {
        var row = state.rows[c.s];
        if (!row) state.rows[c.s] = { lo: 7, hi: 7 };
        else if (c.r < row.lo) row.lo = c.r;
        else row.hi = c.r;
        state.first = false;
        state.log.push(name + ' 出 ' + Cards.label(c));
      } else {
        state.covered[i].push(c);
        state.log.push(name + ' 沒牌可出，蓋了一張牌 🂠');
      }
      nextTurn(state);
      return state;
    },

    isOver: function (state) { return state.done; },

    result: function (state) {
      var ranking = state.players.map(function (_, i) {
        var p = penalty(state, i);
        return { index: i, p: p, score: p === 0 ? '0 分 ✨' : p + ' 分（蓋 ' + state.covered[i].length + ' 張）' };
      }).sort(function (a, b) { return a.p - b.p; });
      return { title: state.players[ranking[0].index].name + ' 罰分最低，獲勝！', ranking: ranking, note: '罰分 = 蓋牌點數加總，越低越好。' };
    },

    summary: function (state, i) {
      return state.hands[i].length + ' 張 · 蓋 ' + state.covered[i].length;
    },

    /**
     * easy：隨便出、蓋牌隨便蓋
     * normal：優先出「後面還有自己牌」的方向；蓋點數最小的牌
     * hard：再加上「不要替別人開路」與「提早甩掉大點數」
     */
    ai: function (state, i, level, rng) {
      var legal = this.legalMoves(state);
      if (level === 'easy' || legal.length === 1) return rng.pick(legal);
      var hand = state.hands[i];
      function mine(s, from, to) {
        return hand.filter(function (c) { return c.s === s && c.r >= Math.min(from, to) && c.r <= Math.max(from, to); }).length;
      }

      if (legal[0].type === 'cover') {
        // 蓋牌：蓋小牌；hard 會優先蓋「擋住別人」的牌（自己手上這個方向還有更外側的牌時保留）
        return legal.slice().sort(function (a, b) {
          return coverCost(a.cards[0]) - coverCost(b.cards[0]);
        })[0];
      }

      function coverCost(c) {
        var cost = c.r;
        if (level === 'hard') {
          var row = state.rows[c.s];
          // 這張牌如果是通往自己其他牌的路，蓋掉會害到自己 → 不要蓋
          var beyond = c.r < 7 ? mine(c.s, 1, c.r - 1) : c.r > 7 ? mine(c.s, c.r + 1, 13) : mine(c.s, 1, 13) - 1;
          cost += beyond * 4;
          if (!row) cost += 2;
        }
        return cost;
      }

      function score(c) {
        var ahead, opens;
        if (c.r === 7) { ahead = mine(c.s, 1, 13) - 1; opens = 2; }
        else if (c.r < 7) { ahead = mine(c.s, 1, c.r - 1); opens = c.r > 1 ? 1 : 0; }
        else { ahead = mine(c.s, c.r + 1, 13); opens = c.r < 13 ? 1 : 0; }
        var sc = ahead * 2 - opens * (level === 'hard' ? 1.5 : 0.5);
        if (level === 'hard') sc += Math.abs(c.r - 7) * 0.15 + (c.r >= 11 ? 0.5 : 0);
        return sc + rng.next() * 0.1;
      }
      return legal.slice().sort(function (a, b) { return score(b.cards[0]) - score(a.cards[0]); })[0];
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
