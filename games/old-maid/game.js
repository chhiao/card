/* =========================================================
 * games/old-maid/game.js — 抽鬼牌牌桌畫面
 * ========================================================= */
(function () {
  var message = '';
  var messageFor = null; // 提示訊息屬於哪個回合（換回合就清空）

  CB.Table.mount({
    gameId: 'old-maid',
    render: function (ctx) {
      var h = ctx.h, Cards = ctx.Cards, s = ctx.state, rules = CB.rules['old-maid'];
      var turnKey = s.log.length + ':' + ctx.cp;
      if (messageFor !== turnKey) { message = ''; messageFor = turnKey; }

      var me = ctx.viewer >= 0 ? ctx.viewer : null;
      var n = s.hands.length;
      var target = ctx.cp !== null ? rules.nextActive(s, ctx.cp) : -1;

      // 對手（從自己下一位開始）
      var opps = h('div', { class: 'opponents' });
      for (var k = 1; k <= n; k++) {
        var i = me === null ? k - 1 : (me + k) % n;
        if (i === me) continue;
        var hand = s.hands[i];
        var done = !hand.length;
        opps.appendChild(h('div', { class: 'opp' + (i === ctx.cp ? ' is-turn' : '') + (done ? ' is-done' : '') },
          h('div', { class: 'opp-name' }, (ctx.players[i].type === 'human' ? '🙋 ' : '🤖 ') + ctx.players[i].name,
            h('span', { class: 'badge' }, done ? '下莊 🎉' : hand.length + ' 張')),
          ctx.seesHand(i) ? Cards.row(hand.slice().sort(rules.byRank), function () { return { size: 'sm' }; }, 'card-row-tight')
            : Cards.backs(hand.length, 'sm')
        ));
      }
      ctx.root.appendChild(opps);

      // 桌面中央：輪到我 → 抽牌區；否則顯示上一手
      var center = h('div', { class: 'pile' });
      if (ctx.canAct) {
        center.appendChild(h('div', { class: 'pile-label' }, '從 ' + ctx.players[target].name + ' 手上抽一張'));
        center.appendChild(Cards.row(s.hands[target], function (c, pos) {
          return {
            faceDown: true, size: 'lg', title: '抽第 ' + (pos + 1) + ' 張',
            onClick: function () { ctx.play({ type: 'draw', pos: pos }); }
          };
        }, 'card-row-draw'));
      } else if (s.last) {
        var L = s.last, to = ctx.players[L.to].name, from = ctx.players[L.from].name;
        if (L.pair) {
          center.appendChild(h('div', { class: 'pile-label' }, to + ' 抽了 ' + from + ' 一張，湊成一對丟掉'));
          center.appendChild(Cards.row(L.pair, function () { return { size: 'lg' }; }));
        } else if (me !== null && L.to === me) {
          center.appendChild(h('div', { class: 'pile-label' }, '你從 ' + from + ' 手上抽到'));
          center.appendChild(Cards.row([L.card], function () { return { size: 'lg' }; }));
        } else if (me !== null && L.from === me) {
          center.appendChild(h('div', { class: 'pile-label' }, to + ' 從你手上抽走了'));
          center.appendChild(Cards.row([L.card], function () { return { size: 'lg' }; }));
        } else {
          center.appendChild(h('div', { class: 'pile-empty' }, to + ' 抽了 ' + from + ' 一張牌'));
        }
      } else {
        center.appendChild(h('div', { class: 'pile-empty' }, ctx.over ? '牌局結束' : '已丟掉 ' + s.discards + ' 對，開始抽牌！'));
      }
      ctx.root.appendChild(center);

      // 自己的手牌（依點數排好，方便看；別人抽的是洗亂後的順序）
      if (me !== null) {
        var mine = s.hands[me].slice().sort(rules.byRank);
        ctx.root.appendChild(h('div', { class: 'my-hand' + (me === ctx.cp ? ' is-turn' : '') },
          h('div', { class: 'zone-label' }, '🙋 ' + ctx.players[me].name + ' 的手牌',
            h('span', { class: 'badge' }, mine.length ? mine.length + ' 張' : '下莊 🎉'),
            mine.some(function (c) { return c.joker; }) ? h('span', { class: 'badge badge-warn' }, '鬼牌在你手上！') : null),
          mine.length ? Cards.row(mine, function () { return { size: 'lg' }; }, 'card-row-fan')
            : h('p', { class: 'turn-tip' }, '你已經安全下莊，看大家抽吧！')
        ));
      }

      // 操作列
      var bar = h('div', { class: 'action-bar' });
      if (ctx.canAct) {
        bar.appendChild(h('span', { class: 'turn-tip' }, '點 ' + ctx.players[target].name + ' 的一張牌來抽'));
        bar.appendChild(h('button', {
          class: 'btn btn-ghost', onclick: function () {
            var m = ctx.hint();
            message = '全看運氣！就抽第 ' + (m.pos + 1) + ' 張吧';
            ctx.rerender();
          }
        }, '💡 提示'));
        if (message) bar.appendChild(h('span', { class: 'hint-pop' }, message));
      } else if (!ctx.over && ctx.cp !== null) {
        bar.appendChild(h('span', { class: 'turn-tip' }, ctx.waitText()));
      }
      ctx.root.appendChild(bar);
    }
  });
})();
