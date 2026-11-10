/* =========================================================
 * core/cards.js — 撲克牌資料結構 + 牌面繪製
 * 牌 = { id:'S7', s:'S', r:7 }  s ∈ C D H S（梅花 方塊 紅心 黑桃）, r ∈ 1..13（A=1, J=11, Q=12, K=13）
 * 資料函式可在 Node 執行；el() 只在瀏覽器呼叫。
 * ========================================================= */
(function (g) {
  var CB = g.CB;

  var SUITS = ['C', 'D', 'H', 'S'];
  var SYMBOL = { C: '♣', D: '♦', H: '♥', S: '♠' };
  var SUIT_NAME = { C: '梅花', D: '方塊', H: '紅心', S: '黑桃' };
  var RANK_LABEL = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

  var Cards = {
    SUITS: SUITS,
    symbol: function (s) { return SYMBOL[s]; },
    suitName: function (s) { return SUIT_NAME[s]; },
    isRed: function (s) { return s === 'H' || s === 'D'; },
    rankLabel: function (r) { return RANK_LABEL[r] || String(r); },
    /** '♠7' 這種給 log 用的短標籤 */
    label: function (c) { return SYMBOL[c.s] + Cards.rankLabel(c.r); },
    labels: function (cards) { return cards.map(Cards.label).join(' '); },
    make: function (s, r) { return { id: s + r, s: s, r: r }; },

    /** 產生 n 副 52 張牌（不含鬼牌）。多副牌時 id 會加上副數避免重複。 */
    deck: function (n) {
      n = n || 1;
      var out = [];
      for (var d = 0; d < n; d++)
        SUITS.forEach(function (s) {
          for (var r = 1; r <= 13; r++) {
            var c = Cards.make(s, r);
            if (n > 1) c.id += '#' + d;
            out.push(c);
          }
        });
      return out;
    },

    /** 依多張牌 id 從手牌中移除，回傳被移除的牌 */
    take: function (hand, ids) {
      var taken = [];
      ids.forEach(function (id) {
        for (var i = 0; i < hand.length; i++)
          if (hand[i].id === id) { taken.push(hand.splice(i, 1)[0]); break; }
      });
      return taken;
    },

    /* ---------------- 繪製（瀏覽器） ---------------- */
    /**
     * opts: { faceDown, size:'sm'|'md'|'lg', selected, playable, dim, onClick, title }
     */
    el: function (card, opts) {
      opts = opts || {};
      var h = CB.h;
      var cls = ['card', 'card-' + (opts.size || 'md')];
      if (opts.faceDown) cls.push('card-back');
      else cls.push(Cards.isRed(card.s) ? 'card-red' : 'card-black');
      if (opts.selected) cls.push('is-selected');
      if (opts.playable) cls.push('is-playable');
      if (opts.dim) cls.push('is-dim');
      if (opts.onClick) cls.push('is-clickable');

      var attrs = { class: cls.join(' '), onclick: opts.onClick };
      if (opts.onClick) { attrs.role = 'button'; attrs.tabindex = '0'; }
      if (opts.faceDown) {
        attrs['aria-label'] = '蓋著的牌';
        return h('div', attrs);
      }
      attrs['aria-label'] = SUIT_NAME[card.s] + Cards.rankLabel(card.r);
      attrs.title = opts.title || attrs['aria-label'];
      var rank = Cards.rankLabel(card.r), sym = SYMBOL[card.s];
      var el = h('div', attrs,
        h('span', { class: 'card-corner tl' }, h('b', null, rank), h('i', null, sym)),
        h('span', { class: 'card-pip' }, sym),
        h('span', { class: 'card-corner br' }, h('b', null, rank), h('i', null, sym))
      );
      if (opts.onClick) el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onClick(e); }
      });
      return el;
    },

    /** 一排牌（手牌） */
    row: function (cards, optsFn, extraClass) {
      var wrap = CB.h('div', { class: 'card-row ' + (extraClass || '') });
      cards.forEach(function (c, i) { wrap.appendChild(Cards.el(c, optsFn ? optsFn(c, i) : {})); });
      return wrap;
    },

    /** n 張牌背（對手手牌數） */
    backs: function (n, size) {
      var wrap = CB.h('div', { class: 'card-row card-row-tight' });
      for (var i = 0; i < n; i++) wrap.appendChild(Cards.el(null, { faceDown: true, size: size || 'sm' }));
      return wrap;
    }
  };

  CB.Cards = Cards;
})(typeof window !== 'undefined' ? window : globalThis);
