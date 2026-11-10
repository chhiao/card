/* =========================================================
 * core/net.js — 線上連線（WebRTC，透過 PeerJS 免費伺服器牽線）
 * 只在「有好友座位」或「用邀請連結加入」時才會動態載入 PeerJS，
 * 純單機（只有電腦對手）時完全不連網。
 *
 * 架構：房主（host）那台跑完整的 rules.js，好友（guest）只送出動作、接收同步。
 * 訊息格式一律是純物件：{ t: '類型', ... }
 * ========================================================= */
(function (g) {
  var CB = g.CB;

  var PEER_SRC = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  var PREFIX = 'cardbuddies-';
  var PING_MS = 4000;     // 心跳間隔
  var TIMEOUT_MS = 15000; // 超過這麼久沒收到任何訊息就當作斷線

  var Net = {};
  CB.Net = Net;

  /* 關掉分頁時主動通知對方，不用等心跳逾時 */
  var active = [];
  if (g.addEventListener) g.addEventListener('pagehide', function () {
    active.slice().forEach(function (l) { l.send({ t: 'bye' }); });
  });

  var loading = null;
  /** 動態載入 PeerJS（只載一次） */
  function load(done) {
    if (g.Peer) return done(null);
    if (!loading) {
      loading = [];
      var s = document.createElement('script');
      s.src = PEER_SRC;
      s.onload = function () { var q = loading; loading = null; q.forEach(function (f) { f(null); }); };
      s.onerror = function () { var q = loading; loading = null; s.remove(); q.forEach(function (f) { f(new Error('load')); }); };
      document.head.appendChild(s);
    }
    loading.push(done);
  }

  function errText(e) {
    var type = e && e.type;
    if (type === 'peer-unavailable') return '找不到這個房間，可能房主已經離開，或連結不完整。';
    if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed')
      return '連不上連線伺服器，請確認網路後再試一次。';
    if (type === 'browser-incompatible') return '這個瀏覽器不支援線上連線，請改用新版 Chrome、Safari 或 Edge。';
    if (e && e.message === 'load') return '連線元件載入失敗，請確認網路後再試一次。';
    return '連線發生問題（' + (type || (e && e.message) || '未知') + '）';
  }
  Net.errText = errText;

  /**
   * 把 PeerJS 的 DataConnection 包成簡單介面，並加上心跳偵測斷線。
   * 回傳 { send(obj), close(), onMessage, onClose }（onXxx 由使用者指定）
   */
  function wrap(conn) {
    var link = { onMessage: null, onClose: null, closed: false };
    var queue = [], open = conn.open, last = Date.now();
    function finish() {
      if (link.closed) return;
      link.closed = true;
      clearInterval(beat);
      var k = active.indexOf(link);
      if (k >= 0) active.splice(k, 1);
      try { conn.close(); } catch (e) { /* 忽略 */ }
      if (link.onClose) link.onClose();
    }
    var beat = setInterval(function () {
      if (Date.now() - last > TIMEOUT_MS) return finish();
      link.send({ t: 'ping' });
    }, PING_MS);

    conn.on('open', function () { open = true; queue.splice(0).forEach(function (m) { conn.send(m); }); });
    conn.on('data', function (m) {
      last = Date.now();
      if (!m || m.t === 'ping') return;
      if (m.t === 'bye') return finish();
      if (link.onMessage) link.onMessage(m);
    });
    conn.on('close', finish);
    conn.on('error', finish);
    link.send = function (m) {
      if (link.closed) return;
      if (open) { try { conn.send(m); } catch (e) { finish(); } }
      else queue.push(m);
    };
    link.close = finish;
    active.push(link);
    return link;
  }

  /**
   * 開房間。opts: { onOpen(code), onConnect(link), onError(text) }
   * 回傳 { close() }
   */
  Net.host = function (opts) {
    var room = { peer: null, code: null, closed: false };
    room.close = function () { room.closed = true; if (room.peer) room.peer.destroy(); };
    load(function (err) {
      if (room.closed) return;
      if (err) return opts.onError(errText(err));
      tryOpen(0);
    });
    function tryOpen(n) {
      var code = CB.randomSeed();
      var peer = new g.Peer(PREFIX + code);
      room.peer = peer;
      peer.on('open', function () { room.code = code; opts.onOpen(code); });
      peer.on('connection', function (conn) { opts.onConnect(wrap(conn)); });
      peer.on('error', function (e) {
        if (room.closed) return;
        if (e.type === 'unavailable-id' && n < 3) { peer.destroy(); tryOpen(n + 1); return; }
        // 個別好友連線失敗不影響房間；只有伺服器層級的錯誤才回報
        if (e.type === 'peer-unavailable') return;
        opts.onError(errText(e));
      });
      peer.on('disconnected', function () { if (!room.closed && !peer.destroyed) peer.reconnect(); });
    }
    return room;
  };

  /**
   * 用房間代碼加入。opts: { onOpen(link), onError(text) }
   * 回傳 { close() }
   */
  Net.join = function (code, opts) {
    var h = { peer: null, closed: false };
    h.close = function () { h.closed = true; if (h.peer) h.peer.destroy(); };
    load(function (err) {
      if (h.closed) return;
      if (err) return opts.onError(errText(err));
      var peer = new g.Peer();
      h.peer = peer;
      peer.on('open', function () {
        var conn = peer.connect(PREFIX + String(code).toLowerCase(), { reliable: true, serialization: 'json' });
        var link = wrap(conn);
        conn.on('open', function () { opts.onOpen(link); });
      });
      peer.on('error', function (e) { if (!h.closed) opts.onError(errText(e)); });
    });
    return h;
  };

  /** 這一頁的邀請連結 */
  Net.inviteUrl = function (code) {
    return location.href.split('?')[0].split('#')[0] + '?join=' + encodeURIComponent(code);
  };
})(typeof window !== 'undefined' ? window : globalThis);
