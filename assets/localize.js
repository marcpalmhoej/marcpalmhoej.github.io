// Redirects Cargo CDN media URLs to the local copies in /assets/media
(function () {
  var RE = /^https?:\/\/freight\.cargo\.site\/.*?\/([A-Z]\d{15,})\/([^?#]+)/;
  var files = null;
  function local(u) {
    if (typeof u !== 'string') return u;
    var m = RE.exec(u);
    if (!m) return u;
    var name = m[2];
    try { name = decodeURIComponent(name); } catch (e) {}
    name = name.replace(/\.mov$/i, '.mp4');
    return '/assets/media/' + m[1] + '-' + encodeURIComponent(name);
  }
  function fixSrcset(v) {
    return String(v).split(',').map(function (p) {
      var t = p.trim().split(/\s+/); t[0] = local(t[0]); return t.join(' ');
    }).join(', ');
  }
  function patchProp(proto, prop, fn) {
    var d = Object.getOwnPropertyDescriptor(proto, prop);
    if (!d || !d.set) return;
    Object.defineProperty(proto, prop, {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set: function (v) { d.set.call(this, fn(v)); }
    });
  }
  [[HTMLImageElement.prototype, 'src'], [HTMLMediaElement.prototype, 'src'],
   [HTMLSourceElement.prototype, 'src'], [HTMLVideoElement.prototype, 'poster']
  ].forEach(function (x) { patchProp(x[0], x[1], local); });
  patchProp(HTMLImageElement.prototype, 'srcset', fixSrcset);
  patchProp(HTMLSourceElement.prototype, 'srcset', fixSrcset);
  var setAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (n, v) {
    var k = String(n).toLowerCase();
    if (k === 'src' || k === 'poster' || k === 'data-src') v = local(v);
    else if (k === 'srcset') v = fixSrcset(v);
    return setAttr.call(this, n, v);
  };
  window.__localizeMedia = local;
})();
