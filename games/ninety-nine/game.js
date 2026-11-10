/* =========================================================
 * games/ninety-nine/game.js — 99 牌桌畫面
 * ========================================================= */
(function () {
  var selected = null;    // 選起來的牌 id（10 / Q 要再選加或減）
  var selectedFor = null; // 選牌屬於哪個回合（換回合就清空）
  var message = '';

  CB.Table.mount({
    gameId: 'ninety-nine',
    render: function (ctx) {
      var h = ctx.h, Cards = ctx.Cards, s = ctx.state, rules = CB.rules['ninety-nine'];
      var turnKey = s.log.length + ':' + ctx.cp;
      if (selectedFor !== turnKey) { selected = null; selectedFor = turnKey; message = ''; }

      var me = ctx.viewer >= 0 ? ctx.viewer : null;
      var n = s.hands.length;
      var legal = ctx.canAct ? ctx.legal() : [];

      // 對手
      var opps = h('div', { class: 'opponents' });
      for (var k = 1; k <= n; k++) {
        var i = me === null ? k - 1 : (me + k) % n;
        if (i === me) continue;
        var out = s.out[i];
        opps.appendChild(h('div', { class: 'opp' + (i === ctx.cp ? ' is-turn' : '') + (out ? ' is-done' : '') },
          h('div', { class: 'opp-name' }, (ctx.players[i].type === 'human' ? '🙋 ' : '🤖 ') + ctx.players[i].name,
            h('span', { class: out ? 'badge badge-warn' : 'badge' }, out ? '出局 💥' : s.hands[i].length + ' 張')),
          out ? null : (ctx.seesHand(i) ? Cards.row(s.hands[i], function () { return { size: 'sm' }; }, 'card-row-tight')
            : Cards.backs(s.hands[i].length, 'sm'))
        ));
      }
      ctx.root.appendChild(opps);

      // 桌面中央：總數、方向、上一張牌
      var hot = s.total >= 90 ? ' is-hot' : '';
      var center = h('div', { class: 'pile nn-center' },
        h('div', { class: 'nn-total' + hot }, h('b', null, s.total), h('small', null, ' / 99')),
        h('div', { class: 'pile-label' }, s.dir === 1 ? '↻ 順時針' : '↺ 逆時針',
          h('span', { class: 'badge' }, '牌堆 ' + s.deck.length))
      );
      if (s.last && s.last.card) {
        center.appendChild(h('div', { class: 'pile-label' },
          ctx.players[s.last.player].name + ' 出了 ' + rules.effectText(s.last.card, s.last.type)));
        center.appendChild(Cards.row([s.last.card], function () { return { size: 'lg' }; }));
      } else if (s.last && s.last.bust) {
        center.appendChild(h('div', { class: 'pile-empty' }, '💥 ' + ctx.players[s.last.player].name + ' 爆掉了，總數歸零'));
      }
      center.appendChild(h('p', { class: 'nn-legend' }, ['4 迴轉', '5 指定', '10 ±10', 'J Pass', 'Q ±20', 'K 變 99', '♠A 歸零']
        .map(function (t) { return h('span', null, t); })));
      ctx.root.appendChild(center);

      // 自己的手牌
      if (me !== null && !s.out[me]) {
        var byCard = {};
        legal.forEach(function (m) { if (m.cards) (byCard[m.cards[0].id] = byCard[m.cards[0].id] || []).push(m); });
        var picking = s.phase === 'pick';
        ctx.root.appendChild(h('div', { class: 'my-hand' + (me === ctx.cp ? ' is-turn' : '') },
          h('div', { class: 'zone-label' }, '🙋 ' + ctx.players[me].name + ' 的手牌'),
          Cards.row(s.hands[me], function (c) {
            var ms = byCard[c.id];
            return {
              size: 'lg',
              selected: selected === c.id,
              playable: !!ms && !picking,
              dim: ctx.canAct && !picking && !ms,
              title: ms ? ms.map(function (m) { return rules.effectText(c, m.type); }).join(' / ') : undefined,
              onClick: ms && !picking ? function () {
                if (ms.length === 1) ctx.play(ms[0]);
                else { selected = c.id; message = ''; ctx.rerender(); }
              } : null
            };
          }, 'card-row-fan')
        ));
      } else if (me !== null) {
        ctx.root.appendChild(h('div', { class: 'my-hand' }, h('p', { class: 'turn-tip' }, '💥 你已經出局了，看大家拚到最後吧！')));
      }

      // 操作列
      var bar = h('div', { class: 'action-bar' });
      if (ctx.canAct) {
        if (s.phase === 'pick') {
          bar.appendChild(h('span', { class: 'turn-tip' }, '你出了 5，指定誰接下去？'));
          legal.forEach(function (m) {
            bar.appendChild(h('button', { class: 'btn', onclick: function () { ctx.play(m); } }, '指定 ' + ctx.players[m.target].name));
          });
        } else if (legal[0].type === 'bust') {
          bar.appendChild(h('span', { class: 'turn-tip is-warn' }, '😱 每張牌出下去都會超過 99！'));
          bar.appendChild(h('button', { class: 'btn btn-primary', onclick: function () { ctx.play(legal[0]); } }, '爆了 💥 出局'));
        } else if (selected && byCardFor(selected).length) {
          var card = s.hands[ctx.cp].filter(function (c) { return c.id === selected; })[0];
          bar.appendChild(h('span', { class: 'turn-tip' }, '要用 ' + Cards.label(card) + ' 加還是減？'));
          byCardFor(selected).forEach(function (m) {
            bar.appendChild(h('button', { class: 'btn' + (m.type === 'minus' ? ' btn-primary' : ''), onclick: function () { ctx.play(m); } },
              rules.effectText(card, m.type) + '（變 ' + rules.after(s.total, card, m.type) + '）'));
          });
          bar.appendChild(h('button', { class: 'btn btn-ghost', onclick: function () { selected = null; ctx.rerender(); } }, '取消'));
        } else {
          bar.appendChild(h('span', { class: 'turn-tip' }, '點一張發亮的牌出牌'));
        }
        if (s.phase !== 'pick' && legal[0].type !== 'bust') {
          bar.appendChild(h('button', {
            class: 'btn btn-ghost', onclick: function () {
              var m = ctx.hint();
              var c = m.cards[0];
              message = '建議出 ' + Cards.label(c) + '（' + rules.effectText(c, m.type) + '）';
              selected = byCardFor(c.id).length > 1 ? c.id : null;
              ctx.rerender();
            }
          }, '💡 提示'));
        }
        if (message) bar.appendChild(h('span', { class: 'hint-pop' }, message));
      } else if (!ctx.over && ctx.cp !== null) {
        bar.appendChild(h('span', { class: 'turn-tip' }, ctx.waitText()));
      }
      ctx.root.appendChild(bar);

      function byCardFor(id) {
        return legal.filter(function (m) { return m.cards && m.cards[0].id === id; });
      }
    }
  });
})();
