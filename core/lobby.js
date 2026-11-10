/* =========================================================
 * core/lobby.js — 大廳：依 games/manifest.js 自動產生遊戲卡片
 * 新增遊戲時「不需要」改這個檔案。
 * ========================================================= */
(function () {
  var h = CB.h, Cards = CB.Cards;
  var SUITS = ['♠', '♥', '♦', '♣'];

  // 標題上方的扇形牌
  var fan = document.getElementById('hero-fan');
  [['S', 1], ['H', 13], ['D', 12], ['C', 11], ['S', 10]].forEach(function (x) {
    fan.appendChild(Cards.el(Cards.make(x[0], x[1]), { size: 'lg' }));
  });

  var grid = document.getElementById('game-grid');
  CB.games.forEach(function (g, i) {
    var p = g.players;
    var players = p.min === p.max ? p.min + ' 人' : p.min + '–' + p.max + ' 人';
    var stars = '★★★'.slice(0, g.difficulty || 1) + '☆☆☆'.slice(0, 3 - (g.difficulty || 1));
    grid.appendChild(h('a', { class: 'game-card', href: 'games/' + g.id + '/index.html', 'data-suit': SUITS[i % 4] },
      h('div', { class: 'game-emoji' }, g.emoji),
      h('h3', null, g.name),
      h('p', null, g.tagline),
      h('div', { class: 'meta-row' },
        h('span', { class: 'chip' }, '👥 ' + players),
        g.minutes ? h('span', { class: 'chip' }, '⏱ ' + g.minutes + ' 分鐘') : null,
        h('span', { class: 'chip', title: '難度' }, stars)
      ),
      h('div', { class: 'meta-row tag-row' },
        g.tags.map(function (t) { return h('span', { class: 'chip chip-tag' }, '#' + t); })
      ),
      h('span', { class: 'btn btn-primary' }, '開桌 →')
    ));
  });
  grid.appendChild(h('div', { class: 'game-card is-soon' },
    h('div', { class: 'game-emoji' }, '🃏'),
    h('p', null, '更多牌桌，陸續開張中…')));
})();
