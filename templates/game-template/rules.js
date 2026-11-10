/* =========================================================
 * templates/game-template/rules.js — 新遊戲的規則模板
 * 範例遊戲「比大小」：每人輪流翻一張牌，翻完 3 輪後點數總和最大的人贏。
 *
 * 使用方式：
 *   1. 複製整個資料夾到 games/<你的-id>/
 *   2. 把下面的 'my-game' 換成 <你的-id>
 *   3. 改寫 create / legalMoves / play / ai… 成你的遊戲
 * 規則：這個檔案不可以使用 document / window 的 DOM API（要能在 Node 跑）。
 * ========================================================= */
(function (g) {
  var CB = g.CB, Cards = CB.Cards;

  CB.defineRules('my-game', {
    /** 建立新牌局。players: [{name,type,level}]，rng: 可重現亂數，options: manifest 的 options */
    create: function (players, rng, options) {
      return {
        players: players,
        deck: rng.shuffle(Cards.deck(1)),
        piles: players.map(function () { return []; }), // 每人翻出的牌
        rounds: options.rounds || 3,
        turn: 0,
        log: ['開始比大小！每人翻 ' + (options.rounds || 3) + ' 張。']
      };
    },

    /** 目前輪到誰（index）；遊戲結束回傳 null */
    currentPlayer: function (state) { return this.isOver(state) ? null : state.turn; },

    /** 目前玩家所有合法動作（陣列）。動作是純物件，牌用 cards:[card] 表示 */
    legalMoves: function (state) { return this.isOver(state) ? [] : [{ type: 'flip' }]; },

    /** 執行動作（直接修改 state），並把發生的事寫進 state.log */
    play: function (state, move) {
      var c = state.deck.pop();
      state.piles[state.turn].push(c);
      state.log.push(state.players[state.turn].name + ' 翻出 ' + Cards.label(c));
      state.turn = (state.turn + 1) % state.players.length;
      return state;
    },

    isOver: function (state) {
      return state.piles.every(function (p) { return p.length >= state.rounds; });
    },

    /** 結算：title + ranking:[{index, score}]（第一名放最前面） */
    result: function (state) {
      var ranking = state.piles.map(function (p, i) {
        var sum = p.reduce(function (s, c) { return s + c.r; }, 0);
        return { index: i, sum: sum, score: sum + ' 點' };
      }).sort(function (a, b) { return b.sum - a.sum; });
      return { title: state.players[ranking[0].index].name + ' 點數最大！', ranking: ranking };
    },

    /** （選用）側欄玩家旁的小字 */
    summary: function (state, i) { return state.piles[i].length + ' / ' + state.rounds; },

    /** 電腦出牌：level 為 'easy' | 'normal' | 'hard'，必須回傳 legalMoves 裡的其中一個 */
    ai: function (state, i, level, rng) { return this.legalMoves(state)[0]; }
  });
})(typeof window !== 'undefined' ? window : globalThis);
