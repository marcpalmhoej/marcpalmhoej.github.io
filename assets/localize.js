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

  // Browsers only autoplay muted, inline videos. Mute autoplaying videos that have no controls.
  function prep(v) {
    if (!(v instanceof HTMLVideoElement) || v.controls) return;
    if (!(v.autoplay || v.hasAttribute('autoplay'))) return;
    v.muted = true; v.defaultMuted = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.playsInline = true;
  }
  function scan(root) {
    if (!root.querySelectorAll) return;
    if (root instanceof HTMLVideoElement) prep(root);
    root.querySelectorAll('video').forEach(prep);
  }
  var play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { prep(this); return play.apply(this, arguments); };
  var attach = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function () {
    var root = attach.apply(this, arguments);
    new MutationObserver(function (list) {
      list.forEach(function (m) { m.addedNodes.forEach(scan); });
    }).observe(root, { childList: true, subtree: true });
    return root;
  };
  new MutationObserver(function (list) {
    list.forEach(function (m) { m.addedNodes.forEach(scan); });
  }).observe(document, { childList: true, subtree: true });
  window.__localizeMedia = local;
})();
