/* =========================================================
 * templates/game-template/game.js — 新遊戲的畫面模板
 * 只負責把 ctx.state 畫進 ctx.root、把按鈕接到 ctx.play(move)。
 * 開局設定、輪流交接、電腦回合、紀錄、結算都由 core/table.js 處理。
 * ========================================================= */
CB.Table.mount({
  gameId: 'my-game',
  render: function (ctx) {
    var h = ctx.h, Cards = ctx.Cards, s = ctx.state;

    // 1) 每位玩家一個座位
    var seats = h('div', { class: 'seat-grid' });
    s.piles.forEach(function (pile, i) {
      seats.appendChild(h('div', { class: 'seat' + (i === ctx.cp ? ' is-turn' : '') },
        h('div', { class: 'seat-head' }, h('b', null, ctx.players[i].name)),
        Cards.row(pile, function () { return { size: 'md' }; })
      ));
    });
    ctx.root.appendChild(seats);

    // 2) 操作列：一定要用 .action-bar，輪到真人時才放按鈕
    var bar = h('div', { class: 'action-bar' });
    if (ctx.canAct) {
      ctx.legal().forEach(function (m) {
        bar.appendChild(h('button', { class: 'btn btn-primary', onclick: function () { ctx.play(m); } }, '翻牌 🂠'));
      });
    } else if (!ctx.over && ctx.cp !== null) {
      bar.appendChild(h('span', { class: 'turn-tip' }, '🤖 ' + ctx.players[ctx.cp].name + ' 思考中…'));
    }
    ctx.root.appendChild(bar);
  }
});
