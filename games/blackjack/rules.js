/* =========================================================
 * games/blackjack/rules.js — 21 點純規則 + 電腦 AI（不可碰 DOM）
 * ========================================================= */
(function (g) {
  var CB = g.CB, Cards = CB.Cards;

  function value(hand) {
    var total = 0, aces = 0;
    hand.forEach(function (c) {
      if (c.r === 1) { aces++; total += 11; }
      else total += Math.min(c.r, 10);
    });
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return { total: total, soft: aces > 0 };
  }
  function isBlackjack(hand) { return hand.length === 2 && value(hand).total === 21; }

  function draw(state) {
    if (state.deck.length < 15) {
      state.deck = state.rng.shuffle(Cards.deck(2));
      state.log.push('🔀 牌快用完了，重新洗牌。');
    }
    return state.deck.pop();
  }

  function newRound(state) {
    state.round++;
    state.phase = 'play';
    state.dealer = [draw(state), draw(state)];
    state.lastResults = null;
    state.log.push('— 第 ' + state.round + ' / ' + state.opt.rounds + ' 局 —');
    state.seats.forEach(function (s, i) {
      s.hand = []; s.doubled = false; s.delta = 0; s.result = null;
      if (s.chips < state.opt.bet) { s.status = 'out'; return; }
      s.bet = state.opt.bet;
      s.hand = [draw(state), draw(state)];
      s.status = isBlackjack(s.hand) ? 'bj' : 'playing';
      if (s.status === 'bj') state.log.push('✨ ' + state.players[i].name + ' 拿到 Blackjack！');
    });
    state.log.push('莊家明牌：' + Cards.label(state.dealer[0]));
    state.turn = -1;
    advance(state);
  }

  function advance(state) {
    for (var i = state.turn + 1; i < state.seats.length; i++) {
      if (state.seats[i].status === 'playing') { state.turn = i; return; }
    }
    dealerPlay(state);
  }

  function dealerPlay(state) {
    state.turn = -1;
    var anyAlive = state.seats.some(function (s) { return s.status === 'stand' || s.status === 'bj'; });
    if (anyAlive) {
      while (value(state.dealer).total < 17) state.dealer.push(draw(state));
    }
    var d = value(state.dealer).total, dealerBJ = isBlackjack(state.dealer);
    state.log.push('莊家開牌：' + Cards.labels(state.dealer) + '（' + (d > 21 ? '爆牌' : d + ' 點') + '）');
    state.seats.forEach(function (s, i) {
      if (s.status === 'out') return;
      var p = value(s.hand).total, delta, text;
      if (s.status === 'bust') { delta = -s.bet; text = '爆牌'; }
      else if (s.status === 'bj' && !dealerBJ) { delta = Math.floor(s.bet * 1.5); text = 'Blackjack'; }
      else if (dealerBJ && s.status !== 'bj') { delta = -s.bet; text = '莊家 Blackjack'; }
      else if (d > 21 || p > d) { delta = s.bet; text = '贏'; }
      else if (p === d) { delta = 0; text = '平手'; }
      else { delta = -s.bet; text = '輸'; }
      s.chips += delta; s.delta = delta; s.result = text;
      state.log.push(state.players[i].name + '：' + text + '（' + (delta >= 0 ? '+' : '') + delta + '）');
    });
    state.phase = state.round >= state.opt.rounds || state.seats.every(function (s) { return s.chips < state.opt.bet; })
      ? 'over' : 'roundEnd';
    if (state.phase === 'over') state.log.push('🏁 牌局結束！');
  }

  CB.defineRules('blackjack', {
    value: value,

    create: function (players, rng, options) {
      var opt = {
        rounds: options.rounds || 5,
        startChips: options.startChips || 100,
        bet: options.bet || 10
      };
      var state = {
        players: players, rng: rng, opt: opt,
        deck: rng.shuffle(Cards.deck(2)),
        seats: players.map(function () { return { chips: opt.startChips, hand: [], status: 'out', bet: 0 }; }),
        dealer: [], round: 0, phase: 'play', turn: -1, log: []
      };
      newRound(state);
      return state;
    },

    currentPlayer: function (state) {
      if (state.phase === 'over') return null;
      if (state.phase === 'roundEnd') {
        for (var i = 0; i < state.players.length; i++) if (state.players[i].type === 'human') return i;
        return 0;
      }
      return state.turn;
    },

    legalMoves: function (state) {
      if (state.phase === 'roundEnd') return [{ type: 'next' }];
      if (state.phase !== 'play' || state.turn < 0) return [];
      var s = state.seats[state.turn];
      var moves = [{ type: 'hit' }, { type: 'stand' }];
      if (s.hand.length === 2 && s.chips >= s.bet * 2) moves.push({ type: 'double' });
      return moves;
    },

    play: function (state, move) {
      if (move.type === 'next') { newRound(state); return state; }
      var i = state.turn, s = state.seats[i], name = state.players[i].name;
      if (move.type === 'hit' || move.type === 'double') {
        if (move.type === 'double') { s.bet *= 2; s.doubled = true; }
        var c = draw(state);
        s.hand.push(c);
        var v = value(s.hand).total;
        state.log.push(name + (move.type === 'double' ? ' 加倍，' : ' 要牌，') + '拿到 ' + Cards.label(c) + '（' + v + ' 點）');
        if (v > 21) { s.status = 'bust'; state.log.push('💥 ' + name + ' 爆牌！'); advance(state); }
        else if (v === 21 || move.type === 'double') { s.status = 'stand'; advance(state); }
      } else if (move.type === 'stand') {
        s.status = 'stand';
        state.log.push(name + ' 停牌（' + value(s.hand).total + ' 點）');
        advance(state);
      }
      return state;
    },

    isOver: function (state) { return state.phase === 'over'; },

    result: function (state) {
      var ranking = state.seats.map(function (s, i) { return { index: i, chips: s.chips, score: s.chips + ' 籌碼' }; })
        .sort(function (a, b) { return b.chips - a.chips; });
      return {
        title: state.players[ranking[0].index].name + ' 贏走最多籌碼！',
        ranking: ranking,
        note: '起始籌碼 ' + state.opt.startChips + '，共 ' + state.opt.rounds + ' 局。'
      };
    },

    summary: function (state, i) {
      var s = state.seats[i];
      return s.chips + ' 💰';
    },

    /** 電腦：easy 隨性、normal 簡化基本策略、hard 完整一點的基本策略 */
    ai: function (state, i, level, rng) {
      if (state.phase === 'roundEnd') return { type: 'next' };
      var s = state.seats[i], v = value(s.hand), t = v.total;
      var up = Math.min(state.dealer[0].r === 1 ? 11 : state.dealer[0].r, 10);
      if (state.dealer[0].r === 1) up = 11;
      var canDouble = s.hand.length === 2 && s.chips >= s.bet * 2;

      if (level === 'easy') {
        if (t <= 11) return { type: 'hit' };
        return t < 15 + rng.int(3) ? { type: 'hit' } : { type: 'stand' };
      }
      if (canDouble && !v.soft && (t === 11 || (t === 10 && up <= 9) || (level === 'hard' && t === 9 && up >= 3 && up <= 6)))
        return { type: 'double' };
      if (level === 'hard' && canDouble && v.soft && t >= 15 && t <= 18 && up >= 4 && up <= 6) return { type: 'double' };
      if (v.soft) return t <= 17 || (t === 18 && up >= 9) ? { type: 'hit' } : { type: 'stand' };
      if (t <= 11) return { type: 'hit' };
      if (t === 12) return up >= 4 && up <= 6 ? { type: 'stand' } : { type: 'hit' };
      if (t <= 16) return up <= 6 ? { type: 'stand' } : { type: 'hit' };
      return { type: 'stand' };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
