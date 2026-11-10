/* =========================================================
 * games/sevens/game.js — 排七牌桌畫面
 * ========================================================= */
CB.Table.mount({
  gameId: 'sevens',
  render: function (ctx) {
    var h = ctx.h, Cards = ctx.Cards, s = ctx.state, rules = CB.rules.sevens;
    var me = ctx.viewer >= 0 ? ctx.viewer : null;
    var n = s.hands.length;

    // 對手
    var opps = h('div', { class: 'opponents' });
    for (var k = 1; k <= n; k++) {
      var i = me === null ? k - 1 : (me + k) % n;
      if (i === me) continue;
      opps.appendChild(h('div', { class: 'opp' + (i === ctx.cp ? ' is-turn' : '') },
        h('div', { class: 'opp-name' }, (ctx.players[i].type === 'human' ? '🙋 ' : '🤖 ') + ctx.players[i].name,
          h('span', { class: 'badge' }, s.hands[i].length + ' 張'),
          s.covered[i].length ? h('span', { class: 'badge badge-warn' }, '蓋 ' + s.covered[i].length) : null),
        ctx.seesHand(i) ? Cards.row(s.hands[i], function () { return { size: 'sm' }; }, 'card-row-tight')
          : Cards.backs(s.hands[i].length, 'sm')
      ));
    }
    ctx.root.appendChild(opps);

    // 牌桌：四排，A..K 共 13 格
    var board = h('div', { class: 'sevens-board' });
    ['S', 'H', 'D', 'C'].forEach(function (suit) {
      var row = s.rows[suit];
      var line = h('div', { class: 'sevens-row' }, h('span', { class: 'sevens-suit ' + (Cards.isRed(suit) ? 'red' : '') }, Cards.symbol(suit)));
      for (var r = 1; r <= 13; r++) {
        if (row && r >= row.lo && r <= row.hi) line.appendChild(Cards.el(Cards.make(suit, r), { size: 'sm' }));
        else line.appendChild(h('div', { class: 'card card-sm card-slot' + (r === 7 ? ' is-seven' : '') }, Cards.rankLabel(r)));
      }
      board.appendChild(line);
    });
    ctx.root.appendChild(board);

    // 自己的手牌
    if (me !== null) {
      var legal = ctx.canAct ? ctx.legal() : [];
      var mustCover = legal.length && legal[0].type === 'cover';
      var playable = {};
      legal.forEach(function (m) { playable[m.cards[0].id] = m; });
      ctx.root.appendChild(h('div', { class: 'my-hand' + (me === ctx.cp ? ' is-turn' : '') },
        h('div', { class: 'zone-label' }, '🙋 ' + ctx.players[me].name + ' 的手牌',
          h('span', { class: 'badge' }, s.hands[me].length + ' 張'),
          s.covered[me].length ? h('span', { class: 'badge badge-warn' }, '已蓋 ' + s.covered[me].length + ' 張 · 罰 ' + rules.penalty(s, me) + ' 分') : null),
        Cards.row(s.hands[me], function (c) {
          var m = playable[c.id];
          return {
            size: 'lg',
            playable: !!m && !mustCover,
            dim: ctx.canAct && !m,
            onClick: m ? function () { ctx.play(m); } : null,
            title: m ? (mustCover ? '蓋這張（罰 ' + c.r + ' 分）' : '出這張') : undefined
          };
        }, 'card-row-fan')
      ));
      if (s.covered[me].length) {
        ctx.root.appendChild(h('div', { class: 'covered-strip' }, h('span', null, '你蓋掉的牌：'),
          Cards.row(s.covered[me], function () { return { size: 'sm' }; }, 'card-row-tight')));
      }
    }

    var bar = h('div', { class: 'action-bar' });
    if (ctx.canAct) {
      var mc = ctx.legal()[0].type === 'cover';
      bar.appendChild(h('span', { class: 'turn-tip' + (mc ? ' is-warn' : '') },
        mc ? '😣 沒牌可以接了，點一張牌把它蓋掉（點數 = 罰分）' : (s.first ? '請出 ♠7 開局' : '點一張發亮的牌出牌')));
      bar.appendChild(h('button', {
        class: 'btn btn-ghost', onclick: function () {
          var m = ctx.hint();
          var old = bar.querySelector('.hint-pop'); if (old) old.remove();
          bar.appendChild(h('span', { class: 'hint-pop' }, '建議' + (m.type === 'cover' ? '蓋 ' : '出 ') + Cards.label(m.cards[0])));
        }
      }, '💡 提示'));
    } else if (!ctx.over && ctx.cp !== null) {
      bar.appendChild(h('span', { class: 'turn-tip' }, ctx.waitText()));
    }
    ctx.root.appendChild(bar);

    // 結束後攤開大家蓋的牌
    if (ctx.over) {
      var reveal = h('div', { class: 'reveal' }, h('h3', null, '大家蓋的牌'));
      s.covered.forEach(function (cv, i) {
        reveal.appendChild(h('div', { class: 'reveal-row' },
          h('b', null, ctx.players[i].name + '（' + rules.penalty(s, i) + ' 分）'),
          cv.length ? Cards.row(cv, function () { return { size: 'sm' }; }, 'card-row-tight') : h('span', null, '沒有蓋牌 ✨')));
      });
      ctx.root.appendChild(reveal);
    }
  }
});
