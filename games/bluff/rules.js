/* =========================================================
 * games/bluff/rules.js — 吹牛（撲克牌版）純規則 + 電腦 AI（不可碰 DOM）
 * 每一輪由開頭的人宣告點數，大家蓋著出 1–4 張並聲稱都是這個點數（可說謊）。
 * 輪到的人可以「抓！」翻開上一手：說謊的人收走整疊；說真話就換抓的人收。
 * 所有人都 Pass 回到最後出牌的人 → 清桌，由他重新宣告。最先出完的人贏。
 * ========================================================= */
(function (g) {
  var CB = g.CB, Cards = CB.Cards;

  var MAX_PLAY = 4;

  function byRank(a, b) { return (a.r - b.r) || (a.s < b.s ? -1 : a.s > b.s ? 1 : 0); }
  function rankName(r) { return Cards.rankLabel(r); }

  /** 手牌所有 1–4 張的組合 */
  function subsets(hand) {
    var out = [], n = hand.length;
    function rec(start, pick) {
      if (pick.length) out.push(pick.slice());
      if (pick.length === MAX_PLAY) return;
      for (var i = start; i < n; i++) { pick.push(hand[i]); rec(i + 1, pick); pick.pop(); }
    }
    rec(0, []);
    return out;
  }

  function countRank(hand, r) {
    return hand.filter(function (c) { return c.r === r; }).length;
  }

  function nextTurn(state, i) { return (i + 1) % state.players.length; }

  /** 開新的一輪：由 leader 宣告 */
  function newRound(state, leader) {
    state.pile = [];
    state.claim = null;     // 本輪宣告的點數
    state.lastPlay = null;  // { player, count }
    state.claimed = 0;      // 本輪大家聲稱出了幾張
    state.passes = 0;
    state.turn = leader;
    state.phase = 'declare';
  }

  CB.defineRules('bluff', {
    byRank: byRank,
    rankName: rankName,
    MAX_PLAY: MAX_PLAY,

    create: function (players, rng) {
      var deck = rng.shuffle(Cards.deck(1));
      var hands = players.map(function () { return []; });
      deck.forEach(function (c, k) { hands[k % players.length].push(c); });
      hands.forEach(function (hd) { hd.sort(byRank); });
      var state = {
        players: players, hands: hands, winner: null, pendingWin: null,
        reveal: null, log: []
      };
      newRound(state, 0);
      state.log.push('發牌完成，由 ' + players[0].name + ' 先宣告點數。');
      return state;
    },

    currentPlayer: function (state) { return state.winner === null ? state.turn : null; },

    /**
     * 動作：
     *   { type:'declare', rank:r }    開新一輪時宣告點數（1–13）
     *   { type:'play', cards:[…] }    蓋著出 1–4 張，聲稱都是本輪點數
     *   { type:'challenge' }          抓！翻開上一手
     *   { type:'pass' }
     */
    legalMoves: function (state) {
      if (state.winner !== null) return [];
      if (state.phase === 'declare') {
        var ds = [];
        for (var r = 1; r <= 13; r++) ds.push({ type: 'declare', rank: r });
        return ds;
      }
      var moves = [];
      var lp = state.lastPlay;
      if (lp && lp.player !== state.turn) moves.push({ type: 'challenge' });
      // 有人剛出完最後一張：只能抓或放他走
      if (state.pendingWin !== null) return moves.concat([{ type: 'pass' }]);
      subsets(state.hands[state.turn]).forEach(function (cs) { moves.push({ type: 'play', cards: cs }); });
      // 這輪還沒有人出牌（剛宣告完）時必須出牌，不能 Pass
      if (lp) moves.push({ type: 'pass' });
      return moves;
    },

    play: function (state, move) {
      var i = state.turn, name = state.players[i].name;

      if (move.type === 'declare') {
        state.claim = move.rank;
        state.phase = 'play';
        state.reveal = null;
        state.log.push(name + ' 宣告這輪是「' + rankName(move.rank) + '」');
        return state;
      }

      if (move.type === 'play') {
        var cards = Cards.take(state.hands[i], move.cards.map(function (c) { return c.id; }));
        var honest = cards.every(function (c) { return c.r === state.claim; });
        state.pile.push({ player: i, cards: cards, honest: honest });
        state.lastPlay = { player: i, count: cards.length };
        state.claimed += cards.length;
        state.passes = 0;
        state.reveal = null;
        state.log.push(name + '：「' + cards.length + ' 張 ' + rankName(state.claim) + '」');
        if (!state.hands[i].length) {
          state.pendingWin = i;
          state.log.push('⚠️ ' + name + ' 出完最後一張了！要不要抓他？');
        }
        state.turn = nextTurn(state, i);
        return state;
      }

      if (move.type === 'challenge') {
        var top = state.pile[state.pile.length - 1];
        var liar = state.players[top.player].name;
        var all = [];
        state.pile.forEach(function (p) { all = all.concat(p.cards); });
        var taker = top.honest ? i : top.player;
        var other = top.honest ? top.player : i;
        state.hands[taker] = state.hands[taker].concat(all).sort(byRank);
        state.reveal = { cards: top.cards, honest: top.honest, by: i, of: top.player, taker: taker, size: all.length };
        state.log.push(name + ' 喊「抓！」翻開 ' + liar + ' 的牌：' + Cards.labels(top.cards));
        state.log.push(top.honest
          ? '😇 ' + liar + ' 說的是真的！' + name + ' 收走 ' + all.length + ' 張'
          : '🤥 ' + liar + ' 吹牛被抓到！收走 ' + all.length + ' 張');
        if (state.pendingWin !== null) {
          var pw = state.pendingWin;
          state.pendingWin = null;
          if (top.honest && pw === top.player) {
            state.winner = pw;
            state.log.push('🎉 ' + state.players[pw].name + ' 出完牌，獲勝！');
            return state;
          }
        }
        newRound(state, other); // reveal 會保留到下一次宣告，給畫面顯示
        state.log.push('由 ' + state.players[other].name + ' 開新的一輪。');
        return state;
      }

      // pass
      state.log.push(name + '：Pass');
      if (state.pendingWin !== null) {
        state.winner = state.pendingWin;
        state.pendingWin = null;
        state.log.push('🎉 ' + state.players[state.winner].name + ' 沒被抓，出完牌獲勝！');
        return state;
      }
      state.passes++;
      state.turn = nextTurn(state, i);
      if (state.lastPlay && state.turn === state.lastPlay.player) {
        var leader = state.lastPlay.player;
        state.log.push('大家都 Pass，清掉 ' + state.claimed + ' 張牌，' + state.players[leader].name + ' 重新宣告。');
        newRound(state, leader);
      }
      return state;
    },

    isOver: function (state) { return state.winner !== null; },

    result: function (state) {
      var ranking = state.hands.map(function (hd, i) {
        return { index: i, left: i === state.winner ? -1 : hd.length, score: i === state.winner ? '出完！' : '剩 ' + hd.length + ' 張' };
      }).sort(function (a, b) { return a.left - b.left; });
      return { title: state.players[state.winner].name + ' 第一個出完牌！', ranking: ranking };
    },

    summary: function (state, i) { return state.hands[i].length + ' 張'; },

    /**
     * AI 只看得到：自己的手牌、本輪宣告點數、大家聲稱出了幾張、每個人剩幾張。
     */
    ai: function (state, i, level, rng) {
      var hand = state.hands[i];

      // 宣告：挑自己手上最多的點數（easy 隨便喊）
      if (state.phase === 'declare') {
        if (level === 'easy') return { type: 'declare', rank: rng.pick(hand).r };
        var best = null, bestN = -1;
        hand.forEach(function (c) {
          var k = countRank(hand, c.r);
          if (k > bestN) { bestN = k; best = c.r; }
        });
        return { type: 'declare', rank: best };
      }

      var lp = state.lastPlay;
      var canChallenge = lp && lp.player !== i;
      var mine = countRank(hand, state.claim);

      // 有人出完最後一張：抓不抓
      if (state.pendingWin !== null) {
        if (!canChallenge) return { type: 'pass' };
        if (level === 'easy') return rng.chance(0.5) ? { type: 'challenge' } : { type: 'pass' };
        return { type: 'challenge' }; // 不抓就輸了，一定抓
      }

      // 要不要抓
      if (canChallenge) {
        // 確定說謊：本輪聲稱的張數 + 自己手上的 > 4（hard 會算整輪，normal 只算上一手）
        var seen = level === 'hard' ? state.claimed : lp.count;
        var sure = seen + mine > 4;
        var p = 0.1;
        if (level === 'easy') p = 0.3; // 簡單：常常亂抓，抓錯就收整疊
        else {
          if (sure) p = 1;
          else if (lp.count >= 3) p += 0.2;
          if (state.hands[lp.player].length <= 2) p += level === 'hard' ? 0.35 : 0.2;
          if (level === 'hard' && countPile(state) >= 10) p -= 0.05; // 牌堆大，抓錯代價高
        }
        if (rng.chance(p)) return { type: 'challenge' };
      }

      var truth = hand.filter(function (c) { return c.r === state.claim; });
      var canPass = !!lp;

      if (level === 'easy') {
        // 簡單：真牌只出一部分，常常一次吹好幾張
        if (truth.length && rng.chance(0.6)) return { type: 'play', cards: truth.slice(0, 1 + rng.int(truth.length)) };
        if (canPass && rng.chance(0.3)) return { type: 'pass' };
        var lies = rng.shuffle(hand).slice(0, Math.min(hand.length, 1 + rng.int(3)));
        return { type: 'play', cards: lies };
      }

      // 有真牌就老實出（全部）
      if (truth.length) return { type: 'play', cards: truth.slice(0, 4) };

      // 沒有真牌：吹牛或 Pass
      // 挑「最沒用」的牌當假牌：自己手上張數最少的點數
      var fake = hand.slice().sort(function (a, b) { return countRank(hand, a.r) - countRank(hand, b.r) || a.r - b.r; });
      var risk = state.claimed + 1 > 4 ? 0.9 : 0.3; // 已經聲稱滿 4 張了，再吹很容易被抓
      var bluffChance = level === 'hard' ? (hand.length <= 3 ? 0.85 : 0.6) : 0.5;
      if (canPass && rng.chance(Math.min(0.95, 1 - bluffChance + risk * 0.5))) return { type: 'pass' };
      var nFake = level === 'hard' && hand.length > 6 && state.claimed <= 1 && rng.chance(0.3) ? 2 : 1;
      return { type: 'play', cards: fake.slice(0, nFake) };

      function countPile(st) {
        return st.pile.reduce(function (s, p) { return s + p.cards.length; }, 0);
      }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
