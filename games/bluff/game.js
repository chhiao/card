/* =========================================================
 * games/bluff/game.js — 吹牛牌桌畫面
 * ========================================================= */
(function () {
  var selected = {};      // 選起來的牌 id
  var selectedFor = null; // 選牌屬於哪個回合（換回合就清空）
  var message = '';

  CB.Table.mount({
    gameId: 'bluff',
    render: function (ctx) {
      var h = ctx.h, Cards = ctx.Cards, s = ctx.state, rules = CB.rules.bluff;
      var turnKey = s.log.length + ':' + ctx.cp;
      if (selectedFor !== turnKey) { selected = {}; selectedFor = turnKey; message = ''; }

      var me = ctx.viewer >= 0 ? ctx.viewer : null;
      var n = s.hands.length;

      // 對手
      var opps = h('div', { class: 'opponents' });
      for (var k = 1; k <= n; k++) {
        var i = me === null ? k - 1 : (me + k) % n;
        if (i === me) continue;
        var hand = s.hands[i];
        opps.appendChild(h('div', { class: 'opp' + (i === ctx.cp ? ' is-turn' : '') + (hand.length <= 2 ? ' is-danger' : '') },
          h('div', { class: 'opp-name' }, (ctx.players[i].type === 'human' ? '🙋 ' : '🤖 ') + ctx.players[i].name,
            h('span', { class: 'badge' }, hand.length + ' 張')),
          ctx.seesHand(i) ? Cards.row(hand, function () { return { size: 'sm' }; }, 'card-row-tight')
            : Cards.backs(Math.min(hand.length, 20), 'sm')
        ));
      }
      ctx.root.appendChild(opps);

      // 桌面中央
      var center = h('div', { class: 'pile' });
      var pileCount = s.pile.reduce(function (t, p) { return t + p.cards.length; }, 0);
      if (s.claim) {
        center.appendChild(h('div', { class: 'pile-label' }, '這輪宣告：「' + rules.rankName(s.claim) + '」',
          h('span', { class: 'badge' }, '大家說出了 ' + s.claimed + ' 張')));
      }
      if (pileCount) {
        center.appendChild(Cards.backs(Math.min(pileCount, 16), 'md'));
        center.appendChild(h('div', { class: 'pile-label' },
          ctx.players[s.lastPlay.player].name + ' 說：「' + s.lastPlay.count + ' 張 ' + rules.rankName(s.claim) + '」',
          h('span', { class: 'badge' }, '整疊 ' + pileCount + ' 張')));
      }
      if (s.reveal && !pileCount) {
        var R = s.reveal;
        center.appendChild(h('div', { class: 'pile-label' },
          ctx.players[R.by].name + ' 抓 ' + ctx.players[R.of].name + '：' + (R.honest ? '😇 是真的！' : '🤥 吹牛被抓到！')));
        center.appendChild(Cards.row(R.cards, function () { return { size: 'lg' }; }));
        center.appendChild(h('div', { class: 'pile-label' }, ctx.players[R.taker].name + ' 收走 ' + R.size + ' 張'));
      } else if (!pileCount && !s.claim) {
        center.appendChild(h('div', { class: 'pile-empty' },
          ctx.over ? '牌局結束' : (ctx.cp !== null ? ctx.players[ctx.cp].name + ' 要宣告新的點數' : '')));
      }
      ctx.root.appendChild(center);

      // 自己的手牌
      var legal = ctx.canAct ? ctx.legal() : [];
      var canPlay = legal.some(function (m) { return m.type === 'play'; });
      if (me !== null) {
        var myHand = s.hands[me];
        ctx.root.appendChild(h('div', { class: 'my-hand' + (me === ctx.cp ? ' is-turn' : '') },
          h('div', { class: 'zone-label' }, '🙋 ' + ctx.players[me].name + ' 的手牌', h('span', { class: 'badge' }, myHand.length + ' 張')),
          Cards.row(myHand, function (c) {
            return {
              size: 'lg',
              selected: !!selected[c.id],
              playable: canPlay && s.claim === c.r,
              onClick: canPlay ? function () {
                if (!selected[c.id] && Object.keys(selected).length >= rules.MAX_PLAY) { message = '一次最多出 ' + rules.MAX_PLAY + ' 張'; }
                else { selected[c.id] = !selected[c.id]; if (!selected[c.id]) delete selected[c.id]; message = ''; }
                ctx.rerender();
              } : null
            };
          }, 'card-row-fan')
        ));
      }

      // 操作列
      var bar = h('div', { class: 'action-bar' });
      if (ctx.canAct) {
        var has = function (t) { return legal.some(function (m) { return m.type === t; }); };
        if (s.phase === 'declare') {
          bar.appendChild(h('span', { class: 'turn-tip' }, '你開新的一輪，宣告點數：'));
          legal.forEach(function (m) {
            bar.appendChild(h('button', { class: 'btn btn-rank', onclick: function () { ctx.play(m); } }, rules.rankName(m.rank)));
          });
        } else {
          var picked = s.hands[ctx.cp].filter(function (c) { return selected[c.id]; });
          if (s.pendingWin !== null) {
            bar.appendChild(h('span', { class: 'turn-tip is-warn' }, ctx.players[s.pendingWin].name + ' 出完最後一張了！要抓嗎？'));
          } else {
            bar.appendChild(h('span', { class: 'turn-tip' },
              picked.length ? '說它們是 ' + picked.length + ' 張「' + rules.rankName(s.claim) + '」' : '選 1–4 張牌，蓋著出（可以吹牛）'));
          }
          if (canPlay) bar.appendChild(h('button', {
            class: 'btn btn-primary', disabled: !picked.length,
            onclick: function () { ctx.play({ type: 'play', cards: picked }); }
          }, '出牌'));
          if (has('challenge')) bar.appendChild(h('button', { class: 'btn', onclick: function () { ctx.play({ type: 'challenge' }); } }, '抓！🔍'));
          if (has('pass')) bar.appendChild(h('button', { class: 'btn', onclick: function () { ctx.play({ type: 'pass' }); } },
            s.pendingWin !== null ? '放他走' : 'Pass'));
        }
        bar.appendChild(h('button', {
          class: 'btn btn-ghost', onclick: function () {
            var m = ctx.hint();
            selected = {};
            if (m.type === 'declare') message = '建議宣告「' + rules.rankName(m.rank) + '」';
            else if (m.type === 'challenge') message = '建議：抓他！';
            else if (m.type === 'pass') message = '建議：Pass';
            else {
              m.cards.forEach(function (c) { selected[c.id] = true; });
              message = m.cards.every(function (c) { return c.r === s.claim; }) ? '已幫你選好真牌' : '沒有真牌…幫你選了一張來吹牛';
            }
            ctx.rerender();
          }
        }, '💡 提示'));
        if (Object.keys(selected).length) bar.appendChild(h('button', { class: 'btn btn-ghost', onclick: function () { selected = {}; ctx.rerender(); } }, '清除'));
        if (message) bar.appendChild(h('span', { class: 'hint-pop' }, message));
      } else if (!ctx.over && ctx.cp !== null) {
        bar.appendChild(h('span', { class: 'turn-tip' }, ctx.waitText()));
      }
      ctx.root.appendChild(bar);
    }
  });
})();
