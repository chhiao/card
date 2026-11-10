/* =========================================================
 * core/rng.js — 可重現的亂數：同一個 seed = 同一副洗好的牌
 * 規則與 AI 一律使用傳進來的 rng，禁止直接用 Math.random()。
 * ========================================================= */
(function (g) {
  var CB = g.CB;

  function hashSeed(seed) {
    var str = String(seed), h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  }

  CB.createRng = function (seed) {
    var a = hashSeed(seed);
    function next() {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      seed: String(seed),
      next: next,
      int: function (n) { return Math.floor(next() * n); },
      chance: function (p) { return next() < p; },
      pick: function (arr) { return arr.length ? arr[Math.floor(next() * arr.length)] : undefined; },
      shuffle: function (arr) {
        var b = arr.slice();
        for (var i = b.length - 1; i > 0; i--) {
          var j = Math.floor(next() * (i + 1)), t = b[i];
          b[i] = b[j]; b[j] = t;
        }
        return b;
      }
    };
  };

  /** 產生新的隨機 seed（只有這裡允許 Math.random） */
  CB.randomSeed = function () {
    return Math.random().toString(36).slice(2, 8);
  };
})(typeof window !== 'undefined' ? window : globalThis);
