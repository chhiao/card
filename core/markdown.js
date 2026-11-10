/* =========================================================
 * core/markdown.js — 極簡 Markdown → HTML（給規則百科 wiki.html 用）
 * 純函式、不碰 DOM，Node 也能執行（tools/wiki.js 用它做檢查）。
 *
 * 支援：## / ### 標題、段落、- 清單、1. 清單、表格、> 引言、**粗體**、`程式碼`、
 *       [文字](網址)、[[頁面id]] / [[頁面id|文字]] 百科內部連結、
 *       {{♠A ♥10 🃏}} 撲克牌（由 core/wiki.js 換成 Cards.el 畫的牌）、
 *       {{rules}} 該遊戲在 manifest 裡的本站規則。
 * 所有文字都會先跳脫 HTML，內容裡不能寫原生 HTML。
 * ========================================================= */
(function (g) {
  var CB = (g.CB = g.CB || {});

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** 行內語法；opts.title(id) 回傳頁面標題（找不到回傳 null → 標成斷掉的連結） */
  function inline(text, opts) {
    var codes = [];
    text = text.replace(/`([^`]+)`/g, function (_, c) { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
    text = esc(text);
    text = text.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    text = text.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, function (_, id, label) {
      var t = opts.title ? opts.title(id) : id;
      if (t === null) return '<span class="wiki-broken" title="還沒有這一頁">' + (label || id) + '</span>';
      return '<a class="wiki-link" href="#' + id + '">' + (label || t) + '</a>';
    });
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, label, url) {
      if (/^javascript:/i.test(url)) return label;
      return '<a href="' + url + '"' + (/^https?:/.test(url) ? ' target="_blank" rel="noopener"' : '') + '>' + label + '</a>';
    });
    text = text.replace(/\{\{rules\}\}/g, '<span class="wiki-rules"></span>');
    text = text.replace(/\{\{([^}]+)\}\}/g, function (_, cards) { return '<span class="wiki-cards" data-cards="' + cards.trim() + '"></span>'; });
    return text.replace(/\u0000(\d+)\u0000/g, function (_, i) { return '<code>' + esc(codes[+i]) + '</code>'; });
  }

  function cells(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
  }

  /** 把整份 Markdown 轉成 HTML 字串 */
  function render(md, opts) {
    opts = opts || {};
    var lines = String(md).replace(/\r\n?/g, '\n').split('\n');
    var out = [], i = 0;
    function il(t) { return inline(t, opts); }

    while (i < lines.length) {
      var line = lines[i];
      if (!line.trim()) { i++; continue; }

      var m = line.match(/^(#{1,4})\s+(.*)$/);
      if (m) { var lv = Math.max(2, m[1].length); out.push('<h' + lv + '>' + il(m[2]) + '</h' + lv + '>'); i++; continue; }

      if (/^\s*\|/.test(line) && lines[i + 1] && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        var head = cells(line), rows = [];
        i += 2;
        while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        out.push('<div class="wiki-table"><table><thead><tr>' + head.map(function (c) { return '<th>' + il(c) + '</th>'; }).join('') +
          '</tr></thead><tbody>' + rows.map(function (r) {
            return '<tr>' + r.map(function (c) { return '<td>' + il(c) + '</td>'; }).join('') + '</tr>';
          }).join('') + '</tbody></table></div>');
        continue;
      }

      if (/^>\s?/.test(line)) {
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
        out.push('<blockquote>' + il(q.join(' ')) + '</blockquote>');
        continue;
      }

      var listRe = /^\s*([-*]|\d+\.)\s+(.*)$/;
      if (listRe.test(line)) {
        var ordered = /^\s*\d+\./.test(line), items = [];
        while (i < lines.length && listRe.test(lines[i])) { items.push(lines[i].match(listRe)[2]); i++; }
        var tag = ordered ? 'ol' : 'ul';
        out.push('<' + tag + '>' + items.map(function (t) { return '<li>' + il(t) + '</li>'; }).join('') + '</' + tag + '>');
        continue;
      }

      if (/^\{\{rules\}\}\s*$/.test(line.trim())) { out.push('<div class="wiki-rules"></div>'); i++; continue; }

      var para = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>|\s*([-*]|\d+\.)\s|\s*\|)/.test(lines[i])) { para.push(lines[i].trim()); i++; }
      out.push('<p>' + il(para.join(' ')) + '</p>');
    }
    return out.join('\n');
  }

  /** 找出 [[連結]] 的所有頁面 id（tools/wiki.js 用來檢查斷掉的連結與孤兒頁） */
  function links(md) {
    var ids = [], re = /\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g, m;
    while ((m = re.exec(md))) if (ids.indexOf(m[1]) < 0) ids.push(m[1]);
    return ids;
  }

  /** 把 {{♠A ♥10 🃏}} 裡的一個寫法轉成 { s, r } 或 { joker:true }；看不懂回傳 null */
  var SUIT_OF = { '♣': 'C', '♦': 'D', '♥': 'H', '♠': 'S' };
  var RANK_OF = { A: 1, J: 11, Q: 12, K: 13 };
  function parseCard(tok) {
    if (tok === '🃏') return { joker: true };
    var s = SUIT_OF[tok.charAt(0)], rk = tok.slice(1);
    var r = RANK_OF[rk] || (/^(10|[2-9])$/.test(rk) ? +rk : 0);
    return s && r ? { s: s, r: r } : null;
  }
  function cardTokens(md) {
    var out = [], re = /\{\{([^}]+)\}\}/g, m;
    while ((m = re.exec(md))) if (m[1].trim() !== 'rules') out = out.concat(m[1].trim().split(/\s+/));
    return out;
  }

  CB.markdown = { render: render, inline: inline, links: links, escape: esc, parseCard: parseCard, cardTokens: cardTokens };
})(typeof window !== 'undefined' ? window : globalThis);
