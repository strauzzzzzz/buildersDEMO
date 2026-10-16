/*
 * app.js — page behaviour. Vanilla JS, no dependencies.
 *
 *  1. Loads config.json and (re)renders sections only if the page was not
 *     already baked from the same config (see tools/prerender.mjs).
 *  2. Theme toggle, scroll progress, smooth anchors, reveal-on-scroll.
 *  3. Gallery lightbox, request form, optional 3D hero.
 *
 * All listeners are delegated on `document`, so re-rendering never breaks them.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var R = window.SiteRender;
  var reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var cfg = null;

  function $(s, ctx) { return (ctx || document).querySelector(s); }
  function $$(s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); }
  function reduced() { return reduceMq.matches; }

  /* ------------------------------------------------------------------ *
   * 1. Config + rendering
   * ------------------------------------------------------------------ */

  function loadConfig() {
    // On file:// browsers block fetch(); the baked HTML is used as-is then.
    return fetch('config.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('config.json: HTTP ' + r.status);
      return r.json();
    });
  }

  function upsertHead(tags) {
    tags.forEach(function (t) {
      if (t.tag === 'title') { document.title = t.text; return; }
      var el;
      if (t.tag === 'script') el = document.getElementById(t.attrs.id);
      else {
        var k = t.key.split('=');
        el = document.head.querySelector(t.tag + '[' + k[0] + '="' + k[1] + '"]');
      }
      if (!el) { el = document.createElement(t.tag); document.head.appendChild(el); }
      Object.keys(t.attrs).forEach(function (a) { el.setAttribute(a, t.attrs[a]); });
      if (t.tag === 'script') el.textContent = t.text;
    });
  }

  function applyConfig(raw) {
    var hash = R.hashConfig(raw);
    if (root.getAttribute('data-cfg') === hash) return; // already baked: nothing to do
    var html = R.renderAll(raw);
    $$('[data-render]').forEach(function (el) {
      if (html[el.getAttribute('data-render')] != null) el.innerHTML = html[el.getAttribute('data-render')];
    });
    upsertHead(R.headTags(raw));
    root.lang = (raw.site && raw.site.lang) || 'ru';
    root.setAttribute('data-cfg', hash);
    root.classList.add('rerendered'); // skip the hero intro on a re-render
  }

  /* ------------------------------------------------------------------ *
   * 2. Theme, progress, anchors, reveal
   * ------------------------------------------------------------------ */

  function effectiveTheme() {
    return root.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  var rotation = 0;
  function toggleTheme(btn) {
    var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    root.classList.add('theme-anim');
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('crew-theme', next); } catch (e) {}
    rotation += 180;
    var ic = $('.theme-icon', btn);
    if (ic) ic.style.setProperty('--rot', rotation + 'deg');
    window.setTimeout(function () { root.classList.remove('theme-anim'); }, 300);
    document.dispatchEvent(new CustomEvent('themechange'));
  }

  // Scroll progress: passive listener, work batched into one rAF per frame.
  function initProgress() {
    var bar = $('#progress');
    if (!bar || reduced()) return;
    var ticking = false;
    function update() {
      var max = root.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      ticking = false;
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  // Anchor links: JS fallback for browsers without CSS smooth scrolling.
  // scroll-margin-top on sections accounts for the sticky header.
  function onAnchorClick(e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var id = decodeURIComponent(a.getAttribute('href').slice(1));
    var target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    var menu = a.closest('details.menu');
    if (menu) menu.removeAttribute('open');
    target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    try { history.pushState(null, '', '#' + id); } catch (err) {}
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });

    // Service card links pre-fill the task field, but never overwrite user text.
    var svc = a.getAttribute('data-service');
    var task = $('#f-task');
    if (svc && task && !task.value.trim()) task.value = 'Нужна услуга: ' + svc + '. ';
  }

  // Reveal on scroll: only elements BELOW the fold are hidden, then revealed once.
  var revealObservers = [];
  function initReveal() {
    revealObservers.forEach(function (o) { o.disconnect(); });
    revealObservers = [];
    if (reduced() || !('IntersectionObserver' in window)) return;
    var vh = window.innerHeight;
    $$('[data-reveal], [data-reveal-group]').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < vh) return; // visible on load: never animate in
      if (el.hasAttribute('data-reveal-group')) {
        Array.prototype.forEach.call(el.children, function (child, i) {
          child.style.setProperty('--i', Math.min(i, 5)); // stagger 60ms, capped at 6 items
        });
      }
      el.classList.add('is-hidden');
      // Very tall groups can never reach 15% visible, so cap the threshold.
      var th = Math.min(0.15, (vh * 0.3) / Math.max(r.height, 1));
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          el.classList.remove('is-hidden');
          io.disconnect(); // reveal once
        }
      }, { threshold: th });
      io.observe(el);
      revealObservers.push(io);
    });
  }

  /* ------------------------------------------------------------------ *
   * 3a. Lightbox
   * ------------------------------------------------------------------ */

  var lb = { idx: 0, items: [], opener: null };
  var EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

  function lbEls() {
    return {
      dlg: $('#lightbox'), fig: $('#lb-figure'), img: $('#lb-img'), src: $('#lb-source'),
      cap: $('#lb-caption'), count: $('#lb-count'), prev: $('[data-lb-prev]'), next: $('[data-lb-next]'),
      scrim: $('.lb-scrim')
    };
  }

  function lbShow(i) {
    var e = lbEls(), n = lb.items.length;
    lb.idx = (i + n) % n;
    var s = lb.items[lb.idx];
    if (s.webp) e.src.setAttribute('srcset', s.webp); else e.src.removeAttribute('srcset');
    e.img.src = s.src;
    e.img.alt = s.alt;
    e.cap.textContent = s.caption;
    e.count.textContent = (lb.idx + 1) + ' / ' + n;
    e.prev.hidden = e.next.hidden = n < 2;
  }

  function lbOpen(btn) {
    var e = lbEls();
    if (!e.dlg || typeof e.dlg.showModal !== 'function') return;
    var thumbs = $$('.shot');
    lb.items = thumbs.map(function (t) {
      return { src: t.dataset.src, webp: t.dataset.webp || '', alt: t.dataset.alt, caption: t.dataset.caption };
    });
    lb.opener = btn;
    lbShow(thumbs.indexOf(btn));
    root.classList.add('lb-open');
    e.dlg.showModal();
    if (reduced() || !e.fig.animate) return;
    // Fade + small scale, drifting in from the clicked thumbnail.
    var r = btn.getBoundingClientRect();
    var dx = (r.left + r.width / 2 - window.innerWidth / 2) * 0.12;
    var dy = (r.top + r.height / 2 - window.innerHeight / 2) * 0.12;
    e.fig.animate([
      { opacity: 0, transform: 'translate(' + dx + 'px,' + dy + 'px) scale(0.94)' },
      { opacity: 1, transform: 'none' }
    ], { duration: 360, easing: EASE });
    e.scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: EASE });
  }

  // `instant` is used for Escape: keyboard-driven actions skip the animation.
  function lbClose(instant) {
    var e = lbEls();
    if (!e.dlg.open) return;
    function done() {
      e.dlg.close();
      root.classList.remove('lb-open');
      if (lb.opener && document.contains(lb.opener)) lb.opener.focus({ preventScroll: true });
    }
    if (instant || reduced() || !e.fig.animate) return done();
    e.scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: EASE, fill: 'forwards' });
    e.fig.animate([
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'scale(0.96)' }
    ], { duration: 200, easing: EASE, fill: 'forwards' }).onfinish = done;
  }

  function initLightbox() {
    var e = lbEls();
    if (!e.dlg) return;
    // Escape: the dialog fires `cancel`; close without animation (keyboard action).
    e.dlg.addEventListener('cancel', function (ev) { ev.preventDefault(); lbClose(true); });
    e.dlg.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); lbShow(lb.idx - 1); }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); lbShow(lb.idx + 1); }
    });
    e.dlg.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-lb-prev]')) return lbShow(lb.idx - 1);
      if (ev.target.closest('[data-lb-next]')) return lbShow(lb.idx + 1);
      // Backdrop, empty stage area, or the close button
      if (ev.target.closest('[data-lb-close]') || ev.target === e.dlg || ev.target === e.fig) lbClose(false);
    });
    // Touch swipe between photos
    var sx = null;
    e.dlg.addEventListener('touchstart', function (ev) { sx = ev.touches[0].clientX; }, { passive: true });
    e.dlg.addEventListener('touchend', function (ev) {
      if (sx == null) return;
      var dx = ev.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 50 && lb.items.length > 1) lbShow(lb.idx + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ *
   * 3b. Request form
   * ------------------------------------------------------------------ */

  var MSG = {
    name: 'Укажите ваше имя: минимум 2 символа.',
    phone: 'Введите номер телефона полностью, например +7 900 123-45-67.',
    task: 'Опишите задачу хотя бы парой слов: что нужно сделать.'
  };

  function validateField(form, name) {
    var v = form.elements[name].value.trim();
    if (name === 'name') return v.length >= 2 ? '' : MSG.name;
    if (name === 'task') return v.length >= 5 ? '' : MSG.task;
    if (name === 'phone') {
      var d = v.replace(/\D/g, '');
      var ok = (d.length === 11 && /^[78]/.test(d)) || (d.length === 10 && d[0] === '9') || (d.length >= 11 && d.length <= 15 && v.charAt(0) === '+');
      return ok ? '' : MSG.phone;
    }
    return '';
  }

  function setError(form, name, msg) {
    var field = form.elements[name], out = $('#err-' + name, form);
    if (!out) return;
    out.textContent = msg;
    if (msg) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid');
  }

  function setState(btn, state) {
    btn.setAttribute('data-state', state);
    var t = $('.btn-text', btn);
    var labels = { loading: 'Отправляем…', success: 'Отправлено' };
    if (!btn.dataset.label) btn.dataset.label = t.textContent;
    t.textContent = labels[state] || btn.dataset.label;
    btn.disabled = state === 'loading';
    btn.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
  }

  function showStatus(form, msg, kind) {
    var el = $('#form-status', form);
    el.className = 'form-status' + (kind ? ' is-' + kind : '');
    el.textContent = msg;
    // Not-connected / error states point to the direct contacts.
    if (kind === 'warn') {
      var tel = $('.btn-phone');
      if (tel) {
        el.appendChild(document.createTextNode(' '));
        var a = document.createElement('a');
        a.href = tel.getAttribute('href'); a.textContent = tel.getAttribute('aria-label').replace('Позвонить: ', '');
        el.appendChild(a);
      }
    }
  }

  function post(form, data) {
    var url = form.dataset.endpoint, fmt = form.dataset.format;
    var ctl = 'AbortController' in window ? new AbortController() : null;
    var timer = window.setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    var opts = { method: 'POST', signal: ctl && ctl.signal };
    if (fmt === 'form') {
      var p = new URLSearchParams();
      p.set('form-name', form.dataset.formName);
      Object.keys(data).forEach(function (k) { p.set(k, data[k]); });
      opts.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      opts.body = p.toString();
    } else {
      opts.headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      opts.body = JSON.stringify(data);
    }
    return fetch(url, opts).then(function (r) {
      window.clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
    });
  }

  function onSubmit(e) {
    var form = e.target;
    if (!form.matches || !form.matches('#request-form')) return;
    e.preventDefault();

    var first = null;
    ['name', 'phone', 'task'].forEach(function (n) {
      var m = validateField(form, n);
      setError(form, n, m);
      if (m && !first) first = n;
    });
    showStatus(form, '', '');
    if (first) { form.elements[first].focus(); return; }

    var btn = $('.btn-submit', form);
    // Honeypot: bots fill the hidden field. Pretend nothing happened, send nothing.
    var isBot = form.elements.website.value !== '';

    if (!form.dataset.endpoint && !isBot) {
      // Never fake success when no backend is connected.
      showStatus(form, form.dataset.msgOff, 'warn');
      return;
    }

    var data = {
      name: form.elements.name.value.trim(),
      phone: form.elements.phone.value.trim(),
      task: form.elements.task.value.trim(),
      address: form.elements.address.value.trim(),
      page: location.href
    };

    setState(btn, 'loading');
    var minDelay = new Promise(function (res) { window.setTimeout(res, 450); }); // avoid a spinner flicker
    var req = isBot ? Promise.resolve() : post(form, data);
    Promise.all([req, minDelay]).then(function () {
      setState(btn, 'success');
      showStatus(form, form.dataset.msgOk, 'ok');
      form.reset();
      window.setTimeout(function () { setState(btn, 'idle'); }, 2200);
    }).catch(function () {
      setState(btn, 'idle');
      showStatus(form, form.dataset.msgErr, 'warn');
    });
  }

  function onFieldInput(e) {
    var f = e.target;
    if (!f.form || f.form.id !== 'request-form' || !f.hasAttribute('aria-invalid')) return;
    setError(f.form, f.name, validateField(f.form, f.name)); // clear the error as soon as it's fixed
  }

  /* ------------------------------------------------------------------ *
   * 3c. Optional 3D hero (loaded lazily, only if config says so)
   * ------------------------------------------------------------------ */

  function initHero3D() {
    var host = $('[data-hero-visual][data-hero3d]'); // attribute is set from features.hero3d
    if (!host) return;
    var c = navigator.connection || {};
    var lowPower = reduced() || c.saveData || /(^|-)2g$/.test(c.effectiveType || '') ||
      (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
      (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
    if (lowPower) return; // static hero image stays
    var load = function () {
      var s = document.createElement('script');
      s.src = 'assets/js/hero3d.js';
      s.async = true;
      document.head.appendChild(s);
    };
    // Never compete with first paint or the CTA: wait for load + idle time.
    var start = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 300); })(load); };
    if (document.readyState === 'complete') start(); else window.addEventListener('load', start, { once: true });
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  function bindOnce() {
    document.addEventListener('click', function (e) {
      var tg = e.target.closest && e.target.closest('.theme-toggle');
      if (tg) return toggleTheme(tg);
      var shot = e.target.closest && e.target.closest('.shot');
      if (shot) return lbOpen(shot);
      onAnchorClick(e);
    });
    document.addEventListener('submit', onSubmit);
    document.addEventListener('input', onFieldInput);
    document.addEventListener('focusout', function (e) {
      var f = e.target;
      if (f.form && f.form.id === 'request-form' && ['name', 'phone', 'task'].indexOf(f.name) > -1 && f.value) {
        setError(f.form, f.name, validateField(f.form, f.name));
      }
    });
    initLightbox();
    initProgress();
  }

  function boot() {
    bindOnce();
    loadConfig().then(function (raw) {
      cfg = raw;
      applyConfig(raw);
    }).catch(function (err) {
      // file:// or offline: the baked HTML is already on screen.
      if (window.console) console.info('[template] Using baked content. ' + err.message);
    }).then(function () {
      initReveal();
      initHero3D();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
