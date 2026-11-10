/* =========================================================
 * games/blackjack/game.js — 21 點牌桌畫面（只負責「畫」與「按鈕」）
 * ========================================================= */
CB.Table.mount({
  gameId: 'blackjack',
  render: function (ctx) {
    var h = ctx.h, Cards = ctx.Cards, s = ctx.state, rules = CB.rules.blackjack;
    var revealDealer = s.phase !== 'play';

    // 莊家區
    var dv = rules.value(s.dealer).total;
    ctx.root.appendChild(h('div', { class: 'zone zone-dealer' },
      h('div', { class: 'zone-label' }, '🎩 莊家',
        h('span', { class: 'badge' }, revealDealer ? dv + ' 點' : '明牌 ' + Cards.label(s.dealer[0]))),
      Cards.row(s.dealer, function (c, i) { return { faceDown: i === 1 && !revealDealer, size: 'lg' }; })
    ));

    ctx.root.appendChild(h('div', { class: 'round-banner' },
      '第 ' + s.round + ' / ' + s.opt.rounds + ' 局 · 每注 ' + s.opt.bet));

    // 玩家座位
    var seats = h('div', { class: 'seat-grid' });
    s.seats.forEach(function (seat, i) {
      var p = ctx.players[i], v = rules.value(seat.hand).total;
      var status = {
        playing: i === s.turn ? (i === ctx.viewer ? '你的回合' : '思考中…') : '等待中', stand: '停牌', bust: '爆牌 💥',
        bj: 'Blackjack ✨', out: '籌碼不足'
      }[seat.status];
      if (s.phase !== 'play' && seat.result) status = seat.result + '（' + (seat.delta >= 0 ? '+' : '') + seat.delta + '）';
      seats.appendChild(h('div', { class: 'seat' + (i === ctx.cp && s.phase === 'play' ? ' is-turn' : '') + (seat.status === 'bust' ? ' is-bust' : '') },
        h('div', { class: 'seat-head' },
          h('b', null, (p.type === 'human' ? '🙋 ' : '🤖 ') + p.name),
          h('span', { class: 'badge' }, seat.hand.length ? v + ' 點' : '—')),
        Cards.row(seat.hand, function () { return { size: 'md' }; }),
        h('div', { class: 'seat-foot' },
          h('span', null, '💰 ' + seat.chips + (seat.bet && seat.status !== 'out' ? ' · 注 ' + seat.bet : '')),
          h('span', { class: 'seat-status' }, status))
      ));
    });
    ctx.root.appendChild(seats);

    // 操作按鈕
    var bar = h('div', { class: 'action-bar' });
    if (ctx.canAct) {
      var legal = ctx.legal();
      var label = { hit: '要牌 ➕', stand: '停牌 ✋', double: '加倍 ×2', next: s.round >= s.opt.rounds ? '看結果' : '下一局 ▶' };
      if (s.phase === 'play') bar.appendChild(h('span', { class: 'turn-tip' }, '輪到 ' + ctx.players[ctx.cp].name));
      legal.forEach(function (m) {
        bar.appendChild(h('button', {
          class: 'btn ' + (m.type === 'stand' || m.type === 'next' ? 'btn-primary' : ''),
          onclick: function () { ctx.play(m); }
        }, label[m.type]));
      });
      if (s.phase === 'play') {
        bar.appendChild(h('button', {
          class: 'btn btn-ghost', onclick: function () {
            var m = ctx.hint();
            alertHint(bar, '建議：' + label[m.type]);
          }
        }, '💡 提示'));
      }
    } else if (!ctx.over) {
      bar.appendChild(h('span', { class: 'turn-tip' }, ctx.waitText()));
    }
    ctx.root.appendChild(bar);

    function alertHint(el, text) {
      var old = el.querySelector('.hint-pop');
      if (old) old.remove();
      el.appendChild(h('span', { class: 'hint-pop' }, text));
    }
  }
});
