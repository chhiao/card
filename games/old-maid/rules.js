/* =========================================================
 * games/old-maid/rules.js — 抽鬼牌純規則 + 電腦 AI（不可碰 DOM）
 * 52 張 + 1 張鬼牌；湊成同點數的對子就丟掉，輪流抽下一位的牌，
 * 最後拿著鬼牌的人輸。
 * ========================================================= */
(function (g) {
  var CB = g.CB, Cards = CB.Cards;

  function byRank(a, b) { return (a.r - b.r) || (a.s < b.s ? -1 : a.s > b.s ? 1 : 0); }

  /** 把手牌裡所有對子拿掉，回傳被丟掉的對子 [[c1,c2], …] */
  function removePairs(hand) {
    var pairs = [], byR = {};
    for (var i = 0; i < hand.length; i++) {
      var c = hand[i];
      if (c.joker) continue;
      if (byR[c.r] !== undefined) {
        pairs.push([hand[byR[c.r]], c]);
        delete byR[c.r];
      } else byR[c.r] = i;
    }
    var gone = {};
    pairs.forEach(function (p) { gone[p[0].id] = gone[p[1].id] = true; });
    for (var k = hand.length - 1; k >= 0; k--) if (gone[hand[k].id]) hand.splice(k, 1);
    return pairs;
  }

  function active(state) {
    var out = [];
    state.hands.forEach(function (hd, i) { if (hd.length) out.push(i); });
    return out;
  }

  /** i 之後下一位手上還有牌的玩家（找不到回傳 -1） */
  function nextActive(state, i) {
    var n = state.hands.length;
    for (var k = 1; k < n; k++) {
      var j = (i + k) % n;
      if (state.hands[j].length) return j;
    }
    return -1;
  }

  function markOut(state, i) {
    if (state.hands[i].length === 0 && state.out.indexOf(i) < 0) {
      state.out.push(i);
      state.log.push('🎉 ' + state.players[i].name + ' 手牌清空，安全下莊！');
    }
  }

  CB.defineRules('old-maid', {
    nextActive: nextActive,
    byRank: byRank,

    create: function (players, rng) {
      var deck = rng.shuffle(Cards.deck(1).concat([Cards.joker()]));
      var hands = players.map(function () { return []; });
      deck.forEach(function (c, k) { hands[k % players.length].push(c); });
      var state = {
        players: players, rng: rng, hands: hands, out: [], discards: 0,
        turn: 0, last: null, loser: null, log: []
      };
      state.log.push('發牌完成，大家先把手上的對子丟掉。');
      hands.forEach(function (hd, i) {
        var pairs = removePairs(hd);
        state.discards += pairs.length;
        if (pairs.length) state.log.push(players[i].name + ' 丟掉 ' + pairs.length + ' 對');
        hands[i] = rng.shuffle(hd);
      });
      hands.forEach(function (hd, i) { markOut(state, i); });
      var act = active(state);
      if (act.length <= 1) { state.loser = act.length ? act[0] : 0; return state; }
      // 從第 1 位開始（第 1 位已經下莊就往後找）
      state.turn = hands[0].length ? 0 : nextActive(state, 0);
      return state;
    },

    currentPlayer: function (state) { return state.loser === null ? state.turn : null; },

    /** 動作：{ type:'draw', pos:k } 從下一位手上（蓋著的）第 k 張抽 */
    legalMoves: function (state) {
      if (state.loser !== null) return [];
      var target = nextActive(state, state.turn);
      var out = [];
      for (var k = 0; k < state.hands[target].length; k++) out.push({ type: 'draw', pos: k });
      return out;
    },

    play: function (state, move) {
      var i = state.turn, target = nextActive(state, i);
      var me = state.players[i].name, other = state.players[target].name;
      var card = state.hands[target].splice(move.pos, 1)[0];
      var hand = state.hands[i];
      var mate = null;
      if (!card.joker) for (var k = 0; k < hand.length; k++) if (hand[k].r === card.r) { mate = hand.splice(k, 1)[0]; break; }
      if (mate) {
        state.discards++;
        state.last = { from: target, to: i, card: card, pair: [mate, card] };
        state.log.push(me + ' 抽了 ' + other + ' 一張，湊成一對 ' + Cards.labels([mate, card]) + ' 丟掉');
      } else {
        hand.push(card);
        state.last = { from: target, to: i, card: card, pair: null };
        state.log.push(me + ' 抽了 ' + other + ' 一張牌');
      }
      // 抽完把自己的手牌重新洗過，別人才不知道剛抽的那張在哪
      state.hands[i] = state.rng.shuffle(hand);
      markOut(state, target);
      markOut(state, i);

      var act = active(state);
      if (act.length <= 1) {
        state.loser = act[0];
        state.log.push('👻 ' + state.players[state.loser].name + ' 手上留著鬼牌，輸了！');
        return state;
      }
      state.turn = nextActive(state, i);
      return state;
    },

    isOver: function (state) { return state.loser !== null; },

    result: function (state) {
      var ranking = state.out.map(function (i, k) { return { index: i, score: '第 ' + (k + 1) + ' 個下莊' }; });
      ranking.push({ index: state.loser, score: '拿著鬼牌 👻' });
      return {
        title: state.players[state.loser].name + ' 拿到鬼牌了！',
        ranking: ranking,
        note: '抽鬼牌全看運氣，下一局換你轉運！'
      };
    },

    summary: function (state, i) { return state.hands[i].length ? state.hands[i].length + ' 張' : '下莊'; },

    /**
     * 抽鬼牌看不到對手的牌，抽哪張都是運氣；三種難度只差在「抽的習慣」，
     * 不影響勝率（manifest 規則裡有說明）。
     */
    ai: function (state, i, level, rng) {
      var legal = this.legalMoves(state);
      if (level === 'easy') return legal[0];                // 新手習慣抽第一張
      return legal[rng.int(legal.length)];
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
