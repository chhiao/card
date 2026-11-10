/* =========================================================
 * core/wiki.js — 規則百科頁（wiki.html）
 * 資料來自 wiki/wiki-data.js（由 node tools/wiki.js 從 wiki/ 的 Markdown 產生）。
 * 網址：wiki.html（首頁）、wiki.html#big-two（某一頁）、wiki.html#log（更新紀錄）
 * 新增百科內容時「不需要」改這個檔案，只要改 wiki/ 底下的 .md。
 * ========================================================= */
(function () {
  var h = CB.h, Cards = CB.Cards, md = CB.markdown;
  var root = document.getElementById('wiki');
  var W = CB.wiki;
  if (!W) {
    root.appendChild(h('p', { class: 'pile-empty' }, '找不到百科資料，請先執行 node tools/wiki.js'));
    return;
  }
  var CATEGORIES = ['遊戲攻略', '基礎知識', '網站說明'];
  var byId = {};
  W.pages.forEach(function (p) { byId[p.id] = p; });
  var query = '';

  function title(id) { return byId[id] ? byId[id].emoji + ' ' + byId[id].title : null; }

  /** 把 render 出來的 {{牌}}、{{rules}} 佔位換成真正的元件 */
  function hydrate(el, page) {
    [].slice.call(el.querySelectorAll('.wiki-cards')).forEach(function (span) {
      var cards = span.getAttribute('data-cards').split(/\s+/).map(md.parseCard).filter(Boolean).map(function (c) {
        return c.joker ? Cards.joker() : Cards.make(c.s, c.r);
      });
      span.appendChild(Cards.row(cards, function () { return { size: 'sm' }; }));
    });
    var game = page && page.game ? CB.getGame(page.game) : null;
    [].slice.call(el.querySelectorAll('.wiki-rules')).forEach(function (box) {
      box.appendChild(game ? h('ol', { class: 'rule-list' }, game.rules.map(function (r) { return h('li', null, r); }))
        : h('p', null, '（這一頁沒有對應的遊戲）'));
    });
  }

  function nav(current) {
    var list = h('nav', { class: 'wiki-nav panel', 'aria-label': '百科目錄' });
    var search = h('input', {
      class: 'input wiki-search', type: 'search', placeholder: '🔍 搜尋，例如：蓋牌、♠A', value: query, 'aria-label': '搜尋百科',
      oninput: function () { query = search.value.trim(); draw(true); }
    });
    list.appendChild(search);
    var q = query.toLowerCase();
    var hits = W.pages.filter(function (p) { return !q || (p.title + p.body).toLowerCase().indexOf(q) >= 0; });

    function item(id, label) {
      return h('a', { class: 'wiki-nav-item' + (id === current ? ' is-selected' : ''), href: '#' + id }, label);
    }
    if (!q) list.appendChild(item('index', '🏠 百科首頁'));
    CATEGORIES.forEach(function (cat) {
      var ps = hits.filter(function (p) { return p.category === cat; });
      if (!ps.length) return;
      list.appendChild(h('h2', null, cat));
      ps.forEach(function (p) { list.appendChild(item(p.id, p.emoji + ' ' + p.title)); });
    });
    if (q && !hits.length) list.appendChild(h('p', { class: 'hint' }, '找不到「' + query + '」，換個關鍵字試試？'));
    if (!q) {
      list.appendChild(h('h2', null, '關於百科'));
      list.appendChild(item('log', '📝 更新紀錄'));
    }
    return { el: list, search: search };
  }

  function article(id) {
    var page = byId[id], art = h('article', { class: 'wiki-article' });
    if (id === 'index' || id === 'log') {
      var body = h('div', { class: 'wiki-body', html: md.render(id === 'index' ? W.index : W.log, { title: title }) });
      art.appendChild(body);
      if (id === 'index') {
        art.appendChild(h('div', { class: 'wiki-sources' },
          h('b', null, '📎 原始資料（wiki/raw/）'),
          h('ul', null, W.raw.map(function (r) { return h('li', null, h('code', null, r.file), '：' + r.title); }))));
      }
      document.title = (id === 'index' ? '規則百科' : '更新紀錄｜規則百科') + '｜牌搭子 Card Buddies';
      return art;
    }
    if (!page) {
      document.title = '找不到這一頁｜規則百科｜牌搭子 Card Buddies';
      art.appendChild(h('div', { class: 'modal-center' },
        h('div', { class: 'modal-icon' }, '🤔'), h('h2', null, '找不到這一頁'),
        h('a', { class: 'btn', href: '#index' }, '回百科首頁')));
      return art;
    }
    var game = page.game ? CB.getGame(page.game) : null;
    art.appendChild(h('header', { class: 'wiki-head' },
      h('span', { class: 'badge' }, page.category),
      h('h2', null, h('span', { class: 'wiki-emoji' }, page.emoji), page.title),
      game ? h('div', { class: 'meta-row' },
        h('span', { class: 'chip' }, '👥 ' + (game.players.min === game.players.max ? game.players.min : game.players.min + '–' + game.players.max) + ' 人'),
        game.minutes ? h('span', { class: 'chip' }, '⏱ ' + game.minutes + ' 分鐘') : null,
        game.tags.map(function (t) { return h('span', { class: 'chip chip-tag' }, '#' + t); })
      ) : null,
      game ? h('a', { class: 'btn btn-primary', href: 'games/' + game.id + '/index.html' }, '開一桌 ' + game.name + ' →') : null
    ));
    var b = h('div', { class: 'wiki-body', html: md.render(page.body, { title: title }) });
    hydrate(b, page);
    art.appendChild(b);
    art.appendChild(h('footer', { class: 'wiki-sources' },
      page.sources.length ? h('span', null, '📎 資料來源：', page.sources.map(function (s) { return h('code', null, 'raw/' + s); })) : null,
      h('span', null, '🕒 最後更新：' + page.updated)
    ));
    document.title = page.title + '｜規則百科｜牌搭子 Card Buddies';
    return art;
  }

  function draw(keepFocus) {
    var id = decodeURIComponent(location.hash.slice(1)) || 'index';
    root.innerHTML = '';
    var n = nav(id);
    root.appendChild(n.el);
    root.appendChild(article(id));
    if (keepFocus) { n.search.focus(); n.search.setSelectionRange(query.length, query.length); }
  }

  window.addEventListener('hashchange', function () { draw(false); window.scrollTo(0, 0); });
  draw(false);
})();
