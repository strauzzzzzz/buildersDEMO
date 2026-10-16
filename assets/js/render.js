/*
 * render.js — turns config.json into HTML strings.
 *
 * This file is shared by two consumers, so the page is built from ONE source:
 *   1. The browser (assets/js/app.js) — renders at load time.
 *   2. tools/prerender.mjs (Node) — bakes the same HTML into index.html so the
 *      page works without JavaScript and social/SEO crawlers see real content.
 *
 * It contains no DOM access. You should not need to edit it to change content;
 * edit config.json instead.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SiteRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- helpers ---------- */

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // A value is "filled" when it is non-empty and has no [bracket] placeholder.
  function isFilled(v) {
    return typeof v === 'string' && v.trim() !== '' && !/[\[\]]/.test(v);
  }

  // Small stable hash of the raw config. If the hash baked into index.html
  // equals the hash of the loaded config.json, the browser skips re-rendering.
  function hashConfig(raw) {
    var s = JSON.stringify(raw);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(16);
  }

  function get(obj, path) {
    return path.split('.').reduce(function (o, k) {
      return o == null ? o : o[k];
    }, obj);
  }

  // Replace {{path.to.value}} inside every string of the config.
  function resolveTokens(cfg) {
    function walk(node) {
      if (typeof node === 'string') {
        return node.replace(/\{\{\s*([\w.]+)\s*\}\}/g, function (m, p) {
          var v = get(cfg, p);
          return v == null ? m : String(v);
        });
      }
      if (Array.isArray(node)) return node.map(walk);
      if (node && typeof node === 'object') {
        var out = {};
        Object.keys(node).forEach(function (k) { out[k] = walk(node[k]); });
        return out;
      }
      return node;
    }
    return walk(cfg);
  }

  function phoneHref(c) {
    var p = c.contacts || {};
    if (isFilled(p.phoneHref) || /^\+?\d+$/.test(p.phoneHref || '')) return p.phoneHref;
    var d = String(p.phone || '').replace(/\D/g, '');
    if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
    return d.length >= 10 ? '+' + d : '';
  }

  function isEmail(v) { return /^[^\s@\[\]]+@[^\s@\[\]]+\.[^\s@\[\]]+$/.test(v || ''); }
  function isUrl(v) { return /^https?:\/\//i.test(v || ''); }

  /* ---------- icons (inline SVG, stroke style, no emoji) ---------- */

  var ICON_PATHS = {
    brick: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 9.67h18M3 14.33h18M9 5v4.67M15 9.67v4.66M9 14.33V19"/>',
    finish: '<rect x="4" y="3.5" width="14" height="5" rx="1"/><path d="M18 6h2.5v5H12v3.5M10.5 14.5h3v6h-3z"/>',
    roof: '<path d="M3 12 12 4.5 21 12M5.5 10v10h13V10M10 20v-5h4v5"/>',
    electric: '<path d="M13 3 5 13.5h6L10 21l9-11h-6z"/>',
    plumbing: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
    tool: '<path d="m14 4 6 6-3 3-6-6zM12 8l-8 8v4h4l8-8"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    send: '<path d="m21 3-9.5 18-2.2-7.8L2 11z"/><path d="m9.3 13.2 5.7-4.7"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
    pin: '<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.800 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    check: '<path d="m5 12.5 4.500 4.500L19 7.500"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    camera: '<path d="M4 8h3l1.500-2.500h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.500"/>',
    quote: '<path d="M7 17c-2 0-3-1.500-3-3.500C4 10 6 8 9 7.500M16 17c-2 0-3-1.500-3-3.500 0-3.500 2-5.500 5-6"/>',
    contrast: '<circle cx="12" cy="12" r="8.500"/><path d="M12 3.500a8.500 8.500 0 0 1 0 17z" fill="currentColor"/>'
  };

  function icon(name, cls) {
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      (ICON_PATHS[name] || ICON_PATHS.tool) + '</svg>';
  }

  // Responsive image: WebP with JPEG fallback.
  function picture(img, opts) {
    opts = opts || {};
    var w = img.width ? ' width="' + esc(img.width) + '"' : '';
    var h = img.height ? ' height="' + esc(img.height) + '"' : '';
    var load = opts.eager ? ' fetchpriority="high"' : ' loading="lazy"';
    var src = img.webp
      ? '<source type="image/webp" srcset="' + esc(img.webp) + '">'
      : '';
    return '<picture>' + src + '<img src="' + esc(img.src) + '" alt="' + esc(img.alt || img.caption || '') + '"' + w + h + load + ' decoding="async"></picture>';
  }

  /* ---------- section renderers ---------- */

  function sectionHead(s) {
    return '<header class="section-head" data-reveal>' +
      '<p class="eyebrow">' + esc(s.eyebrow) + '</p>' +
      '<h2>' + esc(s.title) + '</h2>' +
      (s.lead ? '<p class="section-lead">' + esc(s.lead) + '</p>' : '') +
      '</header>';
  }

  function header(c) {
    var ph = phoneHref(c);
    var phone = c.contacts.phone;
    var navLinks = (c.nav || []).map(function (n) {
      return '<a href="' + esc(n.href) + '">' + esc(n.label) + '</a>';
    }).join('');
    return '<div class="container header-inner">' +
      '<a class="brand" href="#top" aria-label="' + esc(c.brand.name) + ': в начало страницы">' +
        '<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M2 5h9v6H2zM13 5h9v6h-9zM6.500 13H17.500v6H6.500z"/></svg></span>' +
        '<span class="brand-name">' + esc(c.brand.name) + '</span>' +
      '</a>' +
      '<nav class="nav" aria-label="Разделы страницы">' + navLinks + '</nav>' +
      '<div class="header-actions">' +
        (ph ? '<a class="btn btn-primary btn-phone" href="tel:' + esc(ph) + '" aria-label="Позвонить: ' + esc(phone) + '">' + icon('phone') + '<span class="phone-text">' + esc(phone) + '</span></a>' : '') +
        '<details class="menu"><summary aria-label="Открыть меню">' + icon('menu') + '</summary>' +
          '<nav class="menu-panel" aria-label="Разделы страницы (меню)">' + navLinks + '</nav></details>' +
        '<button class="theme-toggle" type="button" aria-label="Переключить светлую и тёмную тему" title="Тема">' + icon('contrast', 'theme-icon') + '</button>' +
      '</div>' +
    '</div>';
  }

  function hero(c) {
    var h = c.hero;
    var lines = (h.headline || []).map(function (l, i) {
      return '<span class="line hero-in" style="--d:' + (80 + i * 90) + 'ms">' + esc(l) + '</span>';
    }).join('');
    var facts = (h.facts || []).slice(0, 4).map(function (f) {
      return '<li><strong class="fact-value">' + esc(f.value) + '</strong><span class="fact-label">' + esc(f.label) + '</span></li>';
    }).join('');
    var d2 = 80 + (h.headline || []).length * 90;
    var visual = h.image && h.image.src
      ? picture(h.image, { eager: true })
      : '<div class="hero-art" aria-hidden="true"></div>';
    return '<div class="hero-bg" aria-hidden="true"></div>' +
      '<div class="container hero-grid">' +
        '<div class="hero-copy">' +
          '<p class="eyebrow hero-in" style="--d:0ms">' + esc(h.eyebrow) + '</p>' +
          '<h1>' + lines + '</h1>' +
          '<p class="lead hero-in" style="--d:' + d2 + 'ms">' + esc(h.subheadline) + '</p>' +
          '<div class="cta-row hero-in" style="--d:' + (d2 + 110) + 'ms">' +
            '<a class="btn btn-primary btn-lg" href="#request">' + esc(h.primaryCta) + icon('arrow') + '</a>' +
            '<a class="btn btn-ghost btn-lg" href="#works">' + esc(h.secondaryCta) + '</a>' +
          '</div>' +
        '</div>' +
        '<figure class="hero-visual hero-in" style="--d:160ms" data-hero-visual' + (c.features && c.features.hero3d ? ' data-hero3d' : '') + '>' + visual + '</figure>' +
      '</div>' +
      '<div class="container"><ul class="facts hero-in" style="--d:' + (d2 + 180) + 'ms" aria-label="Коротко о бригаде">' + facts + '</ul></div>';
  }

  function services(c) {
    var s = c.sections.services;
    var cards = (c.services || []).map(function (sv) {
      return '<li><article class="card service">' +
        '<span class="service-icon">' + icon(sv.icon) + '</span>' +
        '<h3>' + esc(sv.title) + '</h3>' +
        '<p>' + esc(sv.text) + '</p>' +
        '<p class="price"><span class="price-label">Стоимость</span><strong>' + esc(sv.price) + '</strong></p>' +
        '<a class="card-link" href="#request" data-service="' + esc(sv.title) + '">' + esc(s.cardCta) + icon('arrow') + '</a>' +
      '</article></li>';
    }).join('');
    return '<div class="container">' + sectionHead(s) +
      '<ul class="cards" data-reveal-group>' + cards + '</ul></div>';
  }

  function process(c) {
    var s = c.sections.process;
    var steps = (c.process || []).map(function (st, i) {
      return '<li class="step"><span class="step-num" aria-hidden="true">' + (i + 1) + '</span>' +
        '<div class="step-body"><h3>' + esc(st.title) + '</h3><p>' + esc(st.text) + '</p></div></li>';
    }).join('');
    return '<div class="container process-grid">' + sectionHead(s) +
      '<ol class="steps" role="list" data-reveal-group>' + steps + '</ol></div>';
  }

  function works(c) {
    var s = c.sections.works;
    var photos = (c.works && c.works.photos) || [];
    var body;
    if (!photos.length) {
      body = '<div class="gallery-empty" data-reveal>' + icon('camera') +
        '<p class="gallery-empty-title">' + esc(s.emptyTitle) + '</p>' +
        '<p>' + esc(s.emptyText) + '</p></div>';
    } else {
      body = '<ul class="gallery" data-reveal-group>' + photos.map(function (p, i) {
        var cap = p.caption || p.alt || '';
        return '<li><figure class="work">' +
          '<button class="shot" type="button" data-lb="' + i + '" data-src="' + esc(p.src) + '"' +
            (p.webp ? ' data-webp="' + esc(p.webp) + '"' : '') +
            ' data-alt="' + esc(p.alt || cap) + '" data-caption="' + esc(cap) + '" aria-label="Открыть фото: ' + esc(cap) + '">' +
            '<span class="frame">' + picture({ src: p.src, webp: p.webp, width: p.width, height: p.height, alt: p.alt || cap }) + '</span>' +
          '</button>' +
          (cap ? '<figcaption>' + esc(cap) + '</figcaption>' : '') +
        '</figure></li>';
      }).join('') + '</ul>';
    }
    return '<div class="container">' + sectionHead(s) + body + '</div>';
  }

  function trust(c) {
    var s = c.sections.trust;
    var items = ((c.trust && c.trust.items) || []).map(function (it) {
      return '<li><span class="trust-icon">' + icon('check') + '</span><h3>' + esc(it.title) + '</h3><p>' + esc(it.text) + '</p></li>';
    }).join('');
    var reviews = '';
    if (Array.isArray(c.reviews) && c.reviews.length) {
      // Reviews render ONLY when config.reviews has entries. Nothing is invented.
      reviews = '<div class="reviews"><h3 class="reviews-title" data-reveal>' + esc(c.sections.reviewsTitle) + '</h3>' +
        '<ul class="review-list" data-reveal-group>' + c.reviews.map(function (r) {
          return '<li><figure class="review">' + icon('quote') +
            '<blockquote><p>' + esc(r.text) + '</p></blockquote>' +
            '<figcaption><strong>' + esc(r.author) + '</strong>' + (r.meta ? '<span>' + esc(r.meta) + '</span>' : '') + '</figcaption>' +
          '</figure></li>';
        }).join('') + '</ul></div>';
    }
    return '<div class="container">' + sectionHead(s) +
      '<ul class="trust-grid" data-reveal-group>' + items + '</ul>' + reviews + '</div>';
  }

  function contactCard(iconName, label, value, href) {
    var inner = '<span class="ci-icon">' + icon(iconName) + '</span>' +
      '<span class="ci-body"><span class="ci-label">' + esc(label) + '</span><span class="ci-value">' + value + '</span></span>';
    return '<li>' + (href
      ? '<a class="contact-card" href="' + esc(href) + '"' + (/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '') + '>' + inner + '</a>'
      : '<div class="contact-card">' + inner + '</div>') + '</li>';
  }

  function form(c) {
    var f = c.form || {};
    return '<form class="request-form card" id="request-form" novalidate' +
      ' name="' + esc(f.formName || 'estimate') + '" method="post"' +
      ' data-netlify="true" netlify-honeypot="website"' +
      ' data-endpoint="' + esc(f.endpoint || '') + '"' +
      ' data-format="' + esc(f.format || 'json') + '"' +
      ' data-form-name="' + esc(f.formName || 'estimate') + '"' +
      ' data-msg-ok="' + esc(f.successMessage) + '"' +
      ' data-msg-off="' + esc(f.notConnectedMessage) + '"' +
      ' data-msg-err="' + esc(f.errorMessage) + '">' +
      '<h3 class="form-title">Заявка на бесплатную смету</h3>' +
      '<input type="hidden" name="form-name" value="' + esc(f.formName || 'estimate') + '">' +
      '<div class="field"><label for="f-name">Ваше имя</label>' +
        '<input id="f-name" name="name" type="text" autocomplete="name" maxlength="80" required aria-describedby="err-name">' +
        '<p class="field-error" id="err-name"></p></div>' +
      '<div class="field"><label for="f-phone">Телефон</label>' +
        '<input id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="24" placeholder="+7 900 000-00-00" required aria-describedby="err-phone">' +
        '<p class="field-error" id="err-phone"></p></div>' +
      '<div class="field"><label for="f-task">Что нужно сделать</label>' +
        '<textarea id="f-task" name="task" rows="4" maxlength="1000" required aria-describedby="err-task"></textarea>' +
        '<p class="field-error" id="err-task"></p></div>' +
      '<div class="field"><label for="f-address">Адрес объекта <span class="optional">(необязательно)</span></label>' +
        '<input id="f-address" name="address" type="text" autocomplete="street-address" maxlength="200"></div>' +
      // Honeypot: hidden from people and screen readers, bots fill it in.
      '<div class="hp" aria-hidden="true"><label for="f-website">Не заполняйте это поле</label>' +
        '<input id="f-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>' +
      '<button class="btn btn-primary btn-lg btn-submit" type="submit" data-state="idle">' +
        '<span class="btn-icon" aria-hidden="true"><span class="spinner"></span>' + icon('check', 'check') + '</span>' +
        '<span class="btn-text">' + esc(f.submitLabel || 'Отправить заявку') + '</span>' +
      '</button>' +
      '<p class="form-status" id="form-status" role="status" aria-live="polite"></p>' +
      '<p class="consent">' + esc(f.consent) + '</p>' +
    '</form>';
  }

  function contacts(c) {
    var s = c.sections.contacts;
    var ct = c.contacts;
    var ph = phoneHref(c);
    var cards = '';
    if (ct.phone) cards += contactCard('phone', 'Телефон', esc(ct.phone), ph ? 'tel:' + ph : '');
    if (ct.messenger && ct.messenger.url) {
      cards += contactCard('send', 'Мессенджер', esc(ct.messenger.label || 'Написать'), isUrl(ct.messenger.url) ? ct.messenger.url : '');
    }
    if (ct.email) cards += contactCard('mail', 'Почта', esc(ct.email), isEmail(ct.email) ? 'mailto:' + ct.email : '');
    var where = c.location.serviceArea + (c.location.address ? ', ' + c.location.address : '');
    if (where) cards += contactCard('pin', c.location.address ? 'Адрес и зона выезда' : 'Зона выезда', esc(where), '');
    if (ct.hours && ct.hours.length) {
      cards += contactCard('clock', 'Время работы',
        ct.hours.map(function (h) { return '<span class="hours-row">' + esc(h.days) + ': ' + esc(h.time) + '</span>'; }).join(''), '');
    }
    return '<div class="container">' + sectionHead(s) +
      '<div class="contacts-grid">' +
        '<ul class="contact-list" data-reveal-group>' + cards + '</ul>' +
        '<div class="form-wrap" id="request" data-reveal>' + form(c) + '</div>' +
      '</div></div>';
  }

  function footer(c) {
    var f = c.footer || {};
    return '<div class="container footer-inner">' +
      '<p class="footer-brand">' + esc(c.brand.name) + '</p>' +
      '<p class="footer-legal">' + esc(c.brand.legal) + '</p>' +
      (f.showSampleNote ? '<p class="footer-sample">' + esc(f.sampleNote) + '</p>' : '') +
    '</div>';
  }

  function sticky(c) {
    var ph = phoneHref(c);
    return (ph ? '<a class="btn btn-ghost" href="tel:' + esc(ph) + '">' + icon('phone') + 'Позвонить</a>' : '') +
      '<a class="btn btn-primary" href="#request">Заявка на смету</a>';
  }

  /* ---------- <head> tags & structured data ---------- */

  function jsonLd(c) {
    var s = c.site, ct = c.contacts, loc = c.location;
    var data = { '@context': 'https://schema.org', '@type': 'GeneralContractor', name: c.brand.name };
    if (isFilled(s.description)) data.description = s.description;
    if (isFilled(s.url)) data.url = s.url;
    if (isFilled(s.url) && s.ogImage) data.image = new URL(s.ogImage, s.url).href;
    if (isFilled(ct.phone)) data.telephone = ct.phone;
    if (isEmail(ct.email)) data.email = ct.email;
    var addr = {};
    if (isFilled(loc.city)) addr.addressLocality = loc.city;
    if (isFilled(loc.address)) addr.streetAddress = loc.address;
    if (addr.addressLocality || addr.streetAddress) { addr['@type'] = 'PostalAddress'; addr.addressCountry = 'RU'; data.address = addr; }
    if (isFilled(loc.serviceArea)) data.areaServed = loc.serviceArea;
    if (c.seo && isFilled(c.seo.priceRange)) data.priceRange = c.seo.priceRange;
    if (c.seo && c.seo.openingHours && c.seo.openingHours.length) data.openingHours = c.seo.openingHours;
    if (c.services && c.services.length) {
      data.hasOfferCatalog = {
        '@type': 'OfferCatalog', name: c.sections.services.title,
        itemListElement: c.services.map(function (sv) {
          return { '@type': 'Offer', itemOffered: { '@type': 'Service', name: sv.title, description: sv.text } };
        })
      };
    }
    return JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
  }

  // Returns a neutral list of head tags; Node serialises it, the browser upserts it.
  function headTags(c) {
    var s = c.site;
    var abs = function (p) { try { return isFilled(s.url) ? new URL(p, s.url).href : p; } catch (e) { return p; } };
    var tags = [
      { tag: 'title', text: s.title },
      { tag: 'meta', key: 'name=description', attrs: { name: 'description', content: s.description } },
      { tag: 'meta', key: 'name=theme-color', attrs: { name: 'theme-color', content: s.themeColor || '#F26A1B' } },
      { tag: 'link', key: 'rel=canonical', attrs: { rel: 'canonical', href: s.url } },
      { tag: 'meta', key: 'property=og:type', attrs: { property: 'og:type', content: 'website' } },
      { tag: 'meta', key: 'property=og:locale', attrs: { property: 'og:locale', content: 'ru_RU' } },
      { tag: 'meta', key: 'property=og:title', attrs: { property: 'og:title', content: s.title } },
      { tag: 'meta', key: 'property=og:description', attrs: { property: 'og:description', content: s.description } },
      { tag: 'meta', key: 'property=og:url', attrs: { property: 'og:url', content: s.url } },
      { tag: 'meta', key: 'property=og:image', attrs: { property: 'og:image', content: abs(s.ogImage) } },
      { tag: 'meta', key: 'name=twitter:card', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
      { tag: 'meta', key: 'name=twitter:title', attrs: { name: 'twitter:title', content: s.title } },
      { tag: 'meta', key: 'name=twitter:description', attrs: { name: 'twitter:description', content: s.description } },
      { tag: 'meta', key: 'name=twitter:image', attrs: { name: 'twitter:image', content: abs(s.ogImage) } },
      { tag: 'script', key: 'id=ld-json', attrs: { type: 'application/ld+json', id: 'ld-json' }, text: jsonLd(c) }
    ];
    return tags;
  }

  function serializeHead(tags) {
    return tags.map(function (t) {
      if (t.tag === 'title') return '<title>' + esc(t.text) + '</title>';
      var a = Object.keys(t.attrs).map(function (k) { return k + '="' + esc(t.attrs[k]) + '"'; }).join(' ');
      if (t.tag === 'script') return '<script ' + a + '>\n' + t.text + '\n</script>';
      return '<' + t.tag + ' ' + a + '>';
    }).join('\n');
  }

  /* ---------- public API ---------- */

  // Renders every section. `raw` is the parsed config.json.
  function renderAll(raw) {
    var c = resolveTokens(raw);
    return {
      header: header(c), hero: hero(c), services: services(c), process: process(c),
      works: works(c), trust: trust(c), contacts: contacts(c), footer: footer(c), sticky: sticky(c)
    };
  }

  return {
    esc: esc, isFilled: isFilled, hashConfig: hashConfig, resolveTokens: resolveTokens,
    renderAll: renderAll, serializeHead: serializeHead,
    headTags: function (raw) { return headTags(resolveTokens(raw)); }
  };
});
