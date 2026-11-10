/* =========================================================
 * games/ninety-nine/rules.js — 99 純規則 + 電腦 AI（不可碰 DOM）
 * 台灣常見完整版：4 迴轉、5 指定、10 ±10、J Pass、Q ±20、K 變 99、♠A 歸零。
 * 淘汰制：沒牌可出就爆掉出局，總數歸零，剩最後一人獲勝。
 * ========================================================= */
(function (g) {
  var CB = g.CB, Cards = CB.Cards;

  var HAND = 5, LIMIT = 99;

  function isSpadeA(c) { return c.r === 1 && c.s === 'S'; }

  /** 這張牌的效果種類 */
  function kind(c) {
    if (isSpadeA(c)) return 'zero';
    return { 4: 'reverse', 5: 'pick', 10: 'pm10', 11: 'pass', 12: 'pm20', 13: 'max' }[c.r] || 'add';
  }

  /** 出這張牌（type = play / plus / minus）之後的總數 */
  function after(total, c, type) {
    var k = kind(c);
    if (k === 'zero') return 0;
    if (k === 'max') return LIMIT;
    if (k === 'reverse' || k === 'pick' || k === 'pass') return total;
    if (k === 'pm10' || k === 'pm20') {
      var d = k === 'pm10' ? 10 : 20;
      return type === 'minus' ? Math.max(0, total - d) : total + d;
    }
    return total + c.r;
  }

  /** 一張牌給畫面用的效果說明 */
  function effectText(c, type) {
    var k = kind(c);
    return {
      zero: '歸零', max: '變 99', reverse: '迴轉', pick: '指定', pass: 'Pass',
      pm10: type === 'minus' ? '−10' : '+10', pm20: type === 'minus' ? '−20' : '+20'
    }[k] || '+' + c.r;
  }

  function byRank(a, b) { return (a.r - b.r) || (a.s < b.s ? -1 : a.s > b.s ? 1 : 0); }

  function alive(state) {
    var out = [];
    state.out.forEach(function (o, i) { if (!o) out.push(i); });
    return out;
  }

  /** 依目前方向，i 之後下一位還沒出局的玩家 */
  function nextAlive(state, i) {
    var n = state.players.length;
    for (var k = 1; k <= n; k++) {
      var j = ((i + state.dir * k) % n + n) % n;
      if (!state.out[j]) return j;
    }
    return i;
  }

  function draw(state, hand) {
    if (!state.deck.length) {
      if (!state.discard.length) return;
      state.deck = state.rng.shuffle(state.discard);
      state.discard = [];
      state.log.push('🔄 牌堆抽完了，把出過的牌洗一洗當新牌堆。');
    }
    hand.push(state.deck.pop());
    hand.sort(byRank);
  }

  function handMoves(state, hand) {
    var out = [];
    hand.forEach(function (c) {
      var k = kind(c);
      if (k === 'pm10' || k === 'pm20') {
        if (after(state.total, c, 'plus') <= LIMIT) out.push({ type: 'plus', cards: [c] });
        out.push({ type: 'minus', cards: [c] });
      } else if (after(state.total, c, 'play') <= LIMIT) {
        out.push({ type: 'play', cards: [c] });
      }
    });
    return out;
  }

  CB.defineRules('ninety-nine', {
    kind: kind,
    after: after,
    effectText: effectText,
    nextAlive: nextAlive,
    LIMIT: LIMIT,

    create: function (players, rng) {
      var deck = rng.shuffle(Cards.deck(1));
      var hands = players.map(function () { return deck.splice(deck.length - HAND, HAND).sort(byRank); });
      var state = {
        players: players, rng: rng, deck: deck, discard: [], hands: hands,
        out: players.map(function () { return false; }), outOrder: [],
        total: 0, dir: 1, turn: 0, phase: 'play', last: null, winner: null, log: []
      };
      state.log.push('每人 5 張，從 ' + players[0].name + ' 開始！');
      return state;
    },

    currentPlayer: function (state) { return state.winner === null ? state.turn : null; },

    /**
     * 動作：
     *   { type:'play',  cards:[c] }   一般牌、4、5、J、K、♠A
     *   { type:'plus',  cards:[c] }   10 / Q 選加
     *   { type:'minus', cards:[c] }   10 / Q 選減
     *   { type:'pick',  target:j }    出了 5 之後指定下一位
     *   { type:'bust' }               沒牌可出，爆掉出局
     */
    legalMoves: function (state) {
      if (state.winner !== null) return [];
      if (state.phase === 'pick') {
        return alive(state).filter(function (j) { return j !== state.turn; })
          .map(function (j) { return { type: 'pick', target: j }; });
      }
      var moves = handMoves(state, state.hands[state.turn]);
      return moves.length ? moves : [{ type: 'bust' }];
    },

    play: function (state, move) {
      var i = state.turn, name = state.players[i].name;

      if (move.type === 'pick') {
        state.phase = 'play';
        state.turn = move.target;
        state.log.push(name + ' 指定 ' + state.players[move.target].name + ' 接下去');
        return state;
      }

      if (move.type === 'bust') {
        state.out[i] = true;
        state.outOrder.push(i);
        state.discard = state.discard.concat(state.hands[i]);
        state.hands[i] = [];
        state.log.push('💥 ' + name + ' 沒牌可出，爆掉出局！總數歸零。');
        state.total = 0;
        state.last = { player: i, bust: true };
        var left = alive(state);
        if (left.length === 1) {
          state.winner = left[0];
          state.log.push('🏆 ' + state.players[state.winner].name + ' 撐到最後，獲勝！');
          return state;
        }
        state.turn = nextAlive(state, i);
        return state;
      }

      var card = Cards.take(state.hands[i], [move.cards[0].id])[0];
      var k = kind(card), before = state.total;
      state.total = after(before, card, move.type);
      state.discard.push(card);
      state.last = { player: i, card: card, type: move.type, before: before };
      var text = name + ' 出 ' + Cards.label(card);
      if (k === 'reverse') { state.dir = -state.dir; text += '，迴轉！'; }
      else if (k === 'pick') text += '，指定下一位';
      else if (k === 'pass') text += '，Pass';
      else if (k === 'zero') text += '，歸零！';
      else if (k === 'max') text += '，直接 99！';
      else text += '（' + effectText(card, move.type) + '）';
      state.log.push(text + ' → ' + state.total);
      draw(state, state.hands[i]);

      if (k === 'pick') state.phase = 'pick';
      else state.turn = nextAlive(state, i);
      return state;
    },

    isOver: function (state) { return state.winner !== null; },

    result: function (state) {
      var ranking = [{ index: state.winner, score: '存活 🏆' }];
      for (var k = state.outOrder.length - 1; k >= 0; k--) {
        ranking.push({ index: state.outOrder[k], score: '第 ' + (k + 1) + ' 個出局' });
      }
      return { title: state.players[state.winner].name + ' 撐到最後！', ranking: ranking };
    },

    summary: function (state, i) { return state.out[i] ? '出局' : state.hands[i].length + ' 張'; },

    ai: function (state, i, level, rng) {
      var legal = this.legalMoves(state);
      if (legal.length === 1) return legal[0];

      // 指定下一位
      if (state.phase === 'pick') {
        if (level === 'easy') return legal[rng.int(legal.length)];
        // 指定剛好「依方向會輪到的下下位」以外、手牌最少的人（手牌數是公開資訊）
        var pick = legal.slice().sort(function (a, b) {
          return state.hands[a.target].length - state.hands[b.target].length;
        });
        return level === 'hard' ? pick[0] : legal[rng.int(legal.length)];
      }

      // 簡單：常常亂出，把保命牌隨手用掉
      if (level === 'easy' && rng.chance(0.2)) return legal[rng.int(legal.length)];

      var total = state.total;
      var hand = state.hands[i];
      var specials = hand.filter(function (c) { var k = kind(c); return k !== 'add'; }).length;

      // 每個動作的「代價」：越小越想出
      function cost(m) {
        var c = m.cards[0], k = kind(c), nt = after(total, c, m.type);
        // 一般牌：先出，總數越高越能逼下一位（hard 更積極）
        if (k === 'add') return 100 - (level === 'hard' ? c.r * 3 : c.r);
        var keep = { pass: 200, reverse: 210, pick: 220, zero: 260, max: 240, pm10: 230, pm20: 250 }[k];
        if (m.type === 'plus') {
          // 用 10/Q 加：省下保命牌，但會讓總數變高
          keep -= 60;
          if (level === 'hard' && specials >= 2 && nt >= 90) keep -= 80;
        }
        if (m.type === 'minus') keep += (total < 20 ? 60 : 0);
        // 困難：手上保命牌夠多時，用 K 把總數推到 99 逼下一位
        if (level === 'hard' && k === 'max' && specials >= 3) keep -= 120;
        return keep;
      }
      return legal.slice().sort(function (a, b) { return cost(a) - cost(b); })[0];
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
