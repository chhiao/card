/* =========================================================
 * core/base.js — 全站共用命名空間 CB（Card Buddies）
 * 每個頁面第一個載入的 script。不可依賴 DOM 以外的任何函式庫。
 * ========================================================= */
(function (g) {
  var CB = (g.CB = g.CB || {});

  CB.version = '1.0.0';

  /** 遊戲清單（由 games/manifest.js 呼叫 CB.registerGame 填入） */
  CB.games = [];
  /** 各遊戲的純規則模組（由 games/<id>/rules.js 呼叫 CB.defineRules 填入） */
  CB.rules = {};

  var REQUIRED_META = ['id', 'name', 'emoji', 'tagline', 'players', 'tags', 'rules'];

  CB.registerGame = function (meta) {
    REQUIRED_META.forEach(function (k) {
      if (meta[k] === undefined) throw new Error('[manifest] ' + (meta.id || '?') + ' 缺少欄位 ' + k);
    });
    if (CB.getGame(meta.id)) throw new Error('[manifest] id 重複：' + meta.id);
    CB.games.push(meta);
    return meta;
  };

  CB.getGame = function (id) {
    for (var i = 0; i < CB.games.length; i++) if (CB.games[i].id === id) return CB.games[i];
    return null;
  };

  var REQUIRED_RULES = ['create', 'currentPlayer', 'legalMoves', 'play', 'isOver', 'result', 'ai'];

  /** 規則模組契約：見 AGENTS.md「規則模組介面」 */
  CB.defineRules = function (id, rules) {
    REQUIRED_RULES.forEach(function (k) {
      if (typeof rules[k] !== 'function') throw new Error('[rules:' + id + '] 缺少函式 ' + k + '()');
    });
    rules.id = id;
    CB.rules[id] = rules;
    return rules;
  };

  /** 讀網址參數 */
  CB.param = function (name, fallback) {
    if (typeof location === 'undefined') return fallback;
    var v = new URLSearchParams(location.search).get(name);
    return v === null || v === '' ? fallback : v;
  };

  /** localStorage 包一層 try/catch（隱私模式或預覽環境可能會丟錯） */
  CB.store = {
    get: function (key, fallback) {
      try {
        var v = g.localStorage.getItem('cb:' + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { g.localStorage.setItem('cb:' + key, JSON.stringify(value)); } catch (e) { /* 忽略 */ }
    }
  };

  /** 極簡 DOM 產生器：h('div', {class:'x', onclick:fn}, '文字', childEl) */
  CB.h = function (tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === undefined || v === null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  };
  function append(el, c) {
    if (c === undefined || c === null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
})(typeof window !== 'undefined' ? window : globalThis);
