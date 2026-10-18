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

  // Cargo compares the src it set with img.src. Keep the original string when it resolves to the same URL.
  (function () {
    var d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (!d || !d.set) return;
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true, enumerable: d.enumerable,
      get: function () {
        var real = d.get.call(this), raw = this.__rawSrc;
        if (raw != null) {
          try { if (new URL(local(raw), location.href).href === real) return raw; } catch (e) {}
        }
        return real;
      },
      set: function (v) { this.__rawSrc = v; d.set.call(this, v); }
    });
  })();
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

  // Cargo only loads media once its own visibility signal fires. Send that signal for items near the viewport.
  function kick() {
    var fire = window.__cargoFire;
    if (!fire) return;
    var vh = window.innerHeight || 800, vw = window.innerWidth || 1200;
    document.querySelectorAll('gallery-slideshow, gallery-freeform, gallery-grid, gallery-justify, gallery-columns, media-item').forEach(function (el) {
      var r = el.getBoundingClientRect();
      var near = r.bottom > -vh * 1.5 && r.top < vh * 2.5 && r.right > -vw && r.left < vw * 2;
      if (!near) return;
      var d = { hasLayout: true, visible: true, position: 'inside' };
      try { fire(el, 'lazyLoadIntersectionChange', d, { bubbles: false }); } catch (e) {}
      var inside = r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
      try { fire(el, 'viewportIntersectionChange', { hasLayout: true, visible: inside, position: inside ? 'inside' : (r.bottom <= 0 ? 'above' : 'below') }, { bubbles: false }); } catch (e) {}
    });
  }
  var pending = false;
  function schedule() { if (pending) return; pending = true; setTimeout(function () { pending = false; kick(); }, 120); }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  var ticks = 0, timer = setInterval(function () { kick(); if (++ticks > 40) clearInterval(timer); }, 500);

  // Education / Work switch on the Info page (the original script was commented out in Cargo).
  window.show = function (section) {
    var edu = document.getElementById('education'), work = document.getElementById('work');
    if (edu) edu.style.display = section === 'education' ? 'block' : 'none';
    if (work) work.style.display = section === 'work' ? 'block' : 'none';
    document.querySelectorAll('.education-work h2 span').forEach(function (sp) {
      var isEdu = /education/i.test(sp.textContent);
      var active = isEdu ? section === 'education' : section === 'work';
      sp.style.color = active ? '' : '#999';
      sp.setAttribute('role', 'button'); sp.setAttribute('tabindex', '0');
      sp.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  };
  function initSwitch() {
    document.querySelectorAll('.education-work').forEach(function (el) {
      if (el.__switchReady) return;
      el.__switchReady = true;
      window.show('education');
      el.querySelectorAll('h2 span').forEach(function (sp) {
        sp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sp.click(); }
        });
      });
    });
  }
  new MutationObserver(initSwitch).observe(document, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', initSwitch);

  // Make the Education / Work block use the same type as the rest of the Info page.
  (function () {
    var st = document.createElement('style');
    st.textContent =
      '.education-work h2 span{font:inherit !important;letter-spacing:inherit !important}' +
      '.education-work .year{font:inherit !important;letter-spacing:inherit !important;color:rgb(255,255,255) !important;text-decoration:underline !important;text-decoration-thickness:1px !important;text-underline-offset:0.2em !important}' +
      '.education-work #education,.education-work #work{' +
      'font-size:calc(var(--font-scale) * var(--font-size) * 1.0435) !important;' +
      'line-height:1.45 !important;color:rgba(255,255,255,.85) !important}';
    (document.head || document.documentElement).appendChild(st);
  })();

  // Info page (desktop): About Me column 10% wider, and its heading aligned with the other columns.
  (function () {
    var st = document.createElement('style');
    st.textContent = 'body:not(.mobile) .about-me .contactme h2 br{display:none !important}' +
      'body:not(.mobile) .about-me{top:0 !important}' +
      'body:not(.mobile) .about-text p,body:not(.mobile) .address p,body:not(.mobile) .address a,' +
      'body:not(.mobile) .clients,body:not(.mobile) #education,body:not(.mobile) #work{' +
      'font-family:"Helvetica Neue",Helvetica,sans-serif !important;' +
      'font-size:calc(var(--font-scale) * var(--font-size) * 1.0435) !important;' +
      'line-height:1.45 !important;font-weight:400 !important;color:rgba(255,255,255,.85) !important;letter-spacing:normal !important}' +
      'body:not(.mobile) .address p,body:not(.mobile) .about-text p{margin-top:0 !important;margin-bottom:0 !important}' +
      'body:not(.mobile) column-set:has(.about-me){flex-wrap:nowrap !important}';
    (document.head || document.documentElement).appendChild(st);
    var FACTOR = 1.1;
    function widen(first, force) {
      // Measure the column at Cargo's own width, then add exactly +10% via min-width.
      if (!force && first.style.getPropertyValue('min-width')) return;   // already applied
      first.style.removeProperty('min-width');
      var base = first.getBoundingClientRect().width;
      if (!base) return;
      first.style.setProperty('min-width', (base * FACTOR).toFixed(2) + 'px', 'important');
    }
    function run(force) {
      if (document.body && document.body.classList.contains('mobile')) return;
      document.querySelectorAll('column-set').forEach(function (set) {
        var first = set.querySelector(':scope > column-unit[slot="0"]');
        if (first && first.querySelector('.about-me')) {
          if (!first.__seenAt) first.__seenAt = Date.now();
          // Re-measure whenever the container size changed (Cargo's layout settles after load).
          var key = Math.round(set.getBoundingClientRect().width) + '/' + window.innerWidth;
          if (force || first.__key !== key) {
            first.__key = key;
            widen(first, true);
          } else {
            widen(first, false);
          }
        }
      });
    }
    var resizeTimer;
    window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(function () { run(true); }, 500); });
    setInterval(function () { run(false); }, 400);   // re-applies if Cargo re-renders the column
    document.addEventListener('DOMContentLoaded', function () { run(false); });
  })();

  // Info page (desktop): level the menu and the first text lines of all three columns with the headings.
  (function () {
    function firstTop(el) {
      if (!el) return null;
      var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { return n.textContent.trim() ? 1 : 2; } });
      var n = w.nextNode(); if (!n) return null;
      var r = document.createRange(); r.selectNodeContents(n);
      var rects = r.getClientRects(); return rects.length ? rects[0].top : null;
    }
    function shift(el, delta) {
      var off = (el.__alignOff || 0) + delta;
      el.__alignOff = off;
      el.style.transform = Math.abs(off) < 0.05 ? '' : 'translateY(' + off.toFixed(2) + 'px)';
    }
    function visible(el) { return el && getComputedStyle(el).display !== 'none' ? el : null; }
    function alignInfo() {
      var brand = document.querySelector('.brand');
      var about = document.querySelector('.about-text p');
      var ew = document.querySelector('.education-work');
      var clients = document.querySelector('.clients');
      var onInfo = about && ew && clients && !(document.body && document.body.classList.contains('mobile'));
      if (!onInfo) { if (brand && brand.__alignOff) { brand.__alignOff = 0; brand.style.transform = ''; } return; }
      // 1. menu level with the column headings
      var head = firstTop(ew.querySelector('h2')), b = firstTop(brand);
      if (head != null && b != null && Math.abs(head - b) > 0.04) shift(brand, head - b);
      // 2. first line of text level across the three columns (About text is the reference)
      var ref = firstTop(about);
      var edu = document.getElementById('education'), work = document.getElementById('work');
      var shown = visible(edu) || visible(work);
      var cur = firstTop(shown);
      if (ref != null && cur != null && Math.abs(ref - cur) > 0.04) {
        var d = ref - cur; [edu, work].forEach(function (e) { if (e) shift(e, d); });
      }
      var c = firstTop(clients);
      if (ref != null && c != null && Math.abs(ref - c) > 0.04) shift(clients, ref - c);
    }
    setInterval(alignInfo, 400);
    window.addEventListener('resize', function () { setTimeout(alignInfo, 600); });
    var origShow = window.show;
    window.show = function (sec) { origShow.apply(this, arguments); alignInfo(); };
  })();
  window.__localizeMedia = local;
})();
