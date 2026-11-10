/* =========================================================
 * games/big-two/game.js — 大老二牌桌畫面
 * ========================================================= */
(function () {
  var selected = {};      // 目前選起來的牌 id
  var selectedFor = null; // 選牌屬於哪個回合（換回合就清空）
  var message = '';

  CB.Table.mount({
    gameId: 'big-two',
    render: function (ctx) {
      var h = ctx.h, Cards = ctx.Cards, s = ctx.state, rules = CB.rules['big-two'];
      var turnKey = s.log.length + ':' + ctx.cp;
      if (selectedFor !== turnKey) { selected = {}; selectedFor = turnKey; message = ''; }

      var me = ctx.viewer >= 0 ? ctx.viewer : null;
      var n = s.hands.length;

      // 對手（依座位順序，從自己下一位開始）
      var opps = h('div', { class: 'opponents' });
      for (var k = 1; k <= n; k++) {
        var i = me === null ? k - 1 : (me + k) % n;
        if (i === me) continue;
        var hand = s.hands[i];
        opps.appendChild(h('div', { class: 'opp' + (i === ctx.cp ? ' is-turn' : '') + (hand.length <= 1 ? ' is-danger' : '') },
          h('div', { class: 'opp-name' }, (ctx.players[i].type === 'human' ? '🙋 ' : '🤖 ') + ctx.players[i].name,
            h('span', { class: 'badge' }, hand.length + ' 張')),
          ctx.seesHand(i) ? Cards.row(hand, function () { return { size: 'sm' }; }, 'card-row-tight')
            : Cards.backs(hand.length, 'sm')
        ));
      }
      ctx.root.appendChild(opps);

      // 桌面中央：最後一手
      var center = h('div', { class: 'pile' });
      if (s.lastPlay) {
        center.appendChild(h('div', { class: 'pile-label' },
          ctx.players[s.lastPlay.player].name + ' 出了 ' + rules.comboName(s.lastPlay.combo)));
        center.appendChild(Cards.row(s.lastPlay.cards, function () { return { size: 'lg' }; }));
      } else {
        center.appendChild(h('div', { class: 'pile-empty' },
          ctx.over ? '牌局結束' : (ctx.cp !== null ? ctx.players[ctx.cp].name + ' 自由出牌' : '')));
      }
      ctx.root.appendChild(center);

      // 自己的手牌
      if (me !== null) {
        var myHand = s.hands[me];
        var playable = {};
        if (ctx.canAct) ctx.legal().forEach(function (m) { if (m.cards) m.cards.forEach(function (c) { playable[c.id] = true; }); });
        var mine = h('div', { class: 'my-hand' + (me === ctx.cp ? ' is-turn' : '') },
          h('div', { class: 'zone-label' }, '🙋 ' + ctx.players[me].name + ' 的手牌', h('span', { class: 'badge' }, myHand.length + ' 張')),
          Cards.row(myHand, function (c) {
            return {
              size: 'lg',
              selected: !!selected[c.id],
              dim: ctx.canAct && !playable[c.id],
              onClick: ctx.canAct ? function () { selected[c.id] = !selected[c.id]; message = ''; ctx.rerender(); } : null
            };
          }, 'card-row-fan')
        );
        ctx.root.appendChild(mine);
      }

      // 操作列
      var bar = h('div', { class: 'action-bar' });
      if (ctx.canAct) {
        var legal = ctx.legal();
        var canPass = legal.some(function (m) { return m.type === 'pass'; });
        var picked = s.hands[ctx.cp].filter(function (c) { return selected[c.id]; });
        var combo = picked.length ? rules.analyze(picked) : null;
        bar.appendChild(h('span', { class: 'turn-tip' },
          picked.length ? (combo ? '已選：' + rules.comboName(combo) : '這不是合法牌型') : '點牌選取，再按出牌'));
        bar.appendChild(h('button', {
          class: 'btn btn-primary', disabled: !picked.length,
          onclick: function () {
            var move = { type: 'play', cards: picked };
            var key = CB.Table.moveKey(move);
            var ok = legal.some(function (m) { return CB.Table.moveKey(m) === key; });
            if (ok) ctx.play(move);
            else { message = s.lastPlay ? '要出同樣張數、而且比桌上更大的牌型喔' : (s.mustInclude ? '第一手必須包含最小的那張牌' : '這不是合法牌型'); ctx.rerender(); }
          }
        }, '出牌'));
        if (canPass) bar.appendChild(h('button', { class: 'btn', onclick: function () { ctx.play({ type: 'pass' }); } }, 'Pass'));
        bar.appendChild(h('button', {
          class: 'btn btn-ghost', onclick: function () {
            var m = ctx.hint();
            selected = {};
            if (m.type === 'pass') message = '建議：Pass';
            else { m.cards.forEach(function (c) { selected[c.id] = true; }); message = '已幫你選好建議的牌'; }
            ctx.rerender();
          }
        }, '💡 提示'));
        if (Object.keys(selected).length) bar.appendChild(h('button', { class: 'btn btn-ghost', onclick: function () { selected = {}; ctx.rerender(); } }, '清除'));
        if (message) bar.appendChild(h('span', { class: 'hint-pop' }, message));
      } else if (!ctx.over && ctx.cp !== null) {
        bar.appendChild(h('span', { class: 'turn-tip' }, '🤖 ' + ctx.players[ctx.cp].name + ' 思考中…'));
      }
      ctx.root.appendChild(bar);
    }
  });
})();
