/* =========================================================================
   ZEBRA VERDE — STORE
   Shared UI (header, menu, reveal, newsletter) + catalogue + bag + checkout.
   Pages declare <body data-page="home|shop|product|bag|checkout|order">.
   ========================================================================= */
(function () {
  'use strict';

  var CFG = window.ZV_CONFIG || {};
  var ROOT = (function () {
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/assets\/js\/store\.js.*$/, '') : './';
  })();
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PAGE = document.body.getAttribute('data-page') || '';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------------------------------------------------------------- utils */
  function money(n) {
    return 'COP ' + Math.round(n).toLocaleString('en-US');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------------ catalogue */
  var catalogPromise = null;
  function catalog() {
    if (!catalogPromise) {
      catalogPromise = fetch(ROOT + 'data/products.json', { cache: 'no-cache' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          d.byId = {};
          d.products.forEach(function (p) { d.byId[p.id] = p; });
          return d;
        });
    }
    return catalogPromise;
  }
  function img(d, im, big) {
    // im = [path, ext, mediumSize, largeSize|null, color]
    var base = d.imageBase;
    if (big) return base + im[0] + (im[3] ? '-' + im[3] : '') + im[1];
    return base + im[0] + '-' + im[2] + im[1];
  }
  function priceOf(p, color) {
    return (p.priceByColor && p.priceByColor[color]) || p.price;
  }
  function imageFor(d, p, color) {
    var m = p.images.filter(function (i) { return i[4] === color; })[0] || p.images[0];
    return img(d, m);
  }

  /* ------------------------------------------------------------------ bag */
  var BAG_KEY = 'zv-bag-v1';
  var Bag = {
    items: function () { return store(BAG_KEY) || []; },
    save: function (items) { store(BAG_KEY, items); Bag.paint(); },
    add: function (id, color, size, qty) {
      var items = Bag.items(), key = [id, color, size].join('|');
      var hit = items.filter(function (i) { return i.key === key; })[0];
      if (hit) hit.qty = Math.min(9, hit.qty + (qty || 1));
      else items.push({ key: key, id: id, color: color, size: size, qty: qty || 1 });
      Bag.save(items);
    },
    setQty: function (key, qty) {
      var items = Bag.items().map(function (i) { if (i.key === key) i.qty = Math.max(1, Math.min(9, qty)); return i; });
      Bag.save(items);
    },
    remove: function (key) { Bag.save(Bag.items().filter(function (i) { return i.key !== key; })); },
    clear: function () { Bag.save([]); },
    count: function () { return Bag.items().reduce(function (a, i) { return a + i.qty; }, 0); },
    lines: function (d) {
      return Bag.items().filter(function (i) { return d.byId[i.id]; }).map(function (i) {
        var p = d.byId[i.id], unit = priceOf(p, i.color);
        return { item: i, p: p, unit: unit, total: unit * i.qty, image: imageFor(d, p, i.color) };
      });
    },
    paint: function () {
      var n = Bag.count();
      $$('[data-bag-count]').forEach(function (el) { el.textContent = n; });
      $$('[data-bag-link]').forEach(function (el) { el.setAttribute('aria-label', 'Shopping bag, ' + n + (n === 1 ? ' item' : ' items')); });
    }
  };
  window.ZVBag = Bag;
  window.addEventListener('storage', function (e) { if (e.key === BAG_KEY) Bag.paint(); });

  /* ------------------------------------------------------- shared chrome */
  function chrome() {
    var header = $('#header');
    if (header && !header.classList.contains('solid')) {
      var onScroll = function () { header.classList.toggle('scrolled', window.scrollY > 40); };
      window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    }

    function drawer(el, opener) {
      if (!el) return function () {};
      var last = null;
      function set(open) {
        el.classList.toggle('open', open);
        el.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (opener) opener.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.style.overflow = open ? 'hidden' : '';
        if (open) { last = document.activeElement; var f = el.querySelector('[data-close],[data-close-bag]'); f && f.focus(); }
        else if (last) last.focus();
      }
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && el.classList.contains('open')) set(false); });
      return set;
    }
    var menuBtn = $('#menuBtn'), setMenu = drawer($('#drawer'), menuBtn);
    menuBtn && menuBtn.addEventListener('click', function () { setMenu(true); });
    $$('#drawer [data-close]').forEach(function (b) { b.addEventListener('click', function () { setMenu(false); }); });

    var setMini = drawer($('#miniBag'));
    $$('#miniBag [data-close-bag]').forEach(function (b) { b.addEventListener('click', function () { setMini(false); }); });
    window.ZVOpenMiniBag = function () {
      catalog().then(function (d) {
        var lines = Bag.lines(d);
        $('#miniBagItems').innerHTML = lines.map(lineMini).join('');
        $('#miniBagTotal').textContent = money(lines.reduce(function (a, l) { return a + l.total; }, 0));
        setMini(true);
      });
    };

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
      }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
      $$('.reveal').forEach(function (el) { io.observe(el); });
    } else { $$('.reveal').forEach(function (el) { el.classList.add('in'); }); }

    var nf = $('#newsForm');
    nf && nf.addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = $('#zv-email'), msg = $('#newsMsg');
      msg.textContent = inp.checkValidity() ? 'Thank you — welcome to La Maison.' : 'Please enter a valid email address.';
    });

    Bag.paint();
  }

  function lineMini(l) {
    return '<div class="mini-line"><div class="plinth"><img src="' + esc(l.image) + '" alt=""></div>' +
      '<div><p class="serif" style="margin:0;font-size:20px;color:var(--strong)">' + esc(l.p.name) + '</p>' +
      '<p class="muted-sm">' + esc(l.p.title) + '</p>' +
      '<p class="muted-sm">' + esc(l.item.color) + ' · ' + esc(l.item.size) + ' · Qty ' + l.item.qty + '</p></div>' +
      '<p class="muted-sm" style="white-space:nowrap">' + money(l.total) + '</p></div>';
  }

  /* ----------------------------------------------------------------- shop */
  function shopPage() {
    var grid = $('#grid'), cards = $$('.p-card', grid);
    var pills = $$('[data-filter]'), sortSel = $('#sort'), countEl = $('#count');
    function apply() {
      var f = (location.hash || '#all').slice(1);
      if (!pills.some(function (p) { return p.dataset.filter === f; })) f = 'all';
      pills.forEach(function (p) { p.setAttribute('aria-pressed', p.dataset.filter === f ? 'true' : 'false'); });
      var shown = 0;
      cards.forEach(function (c) { var on = f === 'all' || c.dataset.cat === f; c.hidden = !on; if (on) shown++; });
      countEl.textContent = shown + (shown === 1 ? ' piece' : ' pieces');
      var s = sortSel.value;
      cards.slice().sort(function (a, b) {
        if (s === 'price-asc') return a.dataset.price - b.dataset.price;
        if (s === 'price-desc') return b.dataset.price - a.dataset.price;
        return a.dataset.order - b.dataset.order;
      }).forEach(function (c) { grid.appendChild(c); });
    }
    pills.forEach(function (p) {
      p.addEventListener('click', function () {
        history.replaceState(null, '', p.dataset.filter === 'all' ? location.pathname : '#' + p.dataset.filter);
        apply();
      });
    });
    sortSel.addEventListener('change', apply);
    window.addEventListener('hashchange', apply);
    apply();
  }

  /* -------------------------------------------------------------- product */
  function productPage() {
    var data = JSON.parse($('#pdata').textContent);
    var state = { color: null, size: null };
    var priceEl = $('#pPrice'), mainImg = $('#mainImg'), thumbs = $$('.thumb'), msg = $('#addMsg');
    var colorBtns = $$('[data-color]'), sizeBtns = $$('[data-size]');

    function showImage(btn) {
      thumbs.forEach(function (t) { t.setAttribute('aria-current', t === btn ? 'true' : 'false'); });
      mainImg.classList.add('swap');
      setTimeout(function () {
        mainImg.src = btn.dataset.large; mainImg.alt = btn.dataset.alt;
        mainImg.onload = function () { mainImg.classList.remove('swap'); };
        if (mainImg.complete) mainImg.classList.remove('swap');
      }, reduce ? 0 : 200);
    }
    thumbs.forEach(function (t) { t.addEventListener('click', function () { showImage(t); }); });

    function pickColor(c) {
      state.color = c;
      colorBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.color === c ? 'true' : 'false'); });
      $('#colorName').textContent = c;
      priceEl.textContent = money((data.priceByColor && data.priceByColor[c]) || data.price);
      var first = thumbs.filter(function (t) { return t.dataset.color === c; })[0];
      if (first) showImage(first);
      msg.textContent = '';
    }
    colorBtns.forEach(function (b) { b.addEventListener('click', function () { pickColor(b.dataset.color); }); });

    function pickSize(s) {
      state.size = s;
      sizeBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.size === s ? 'true' : 'false'); });
      $('#sizeName').textContent = s;
      msg.textContent = '';
    }
    sizeBtns.forEach(function (b) { b.addEventListener('click', function () { pickSize(b.dataset.size); }); });
    if (sizeBtns.length === 1) pickSize(sizeBtns[0].dataset.size);
    pickColor(colorBtns[0].dataset.color);

    $('#addBtn').addEventListener('click', function () {
      if (!state.size) { msg.textContent = 'Please choose your size.'; $('#sizeGroup').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); sizeBtns[0].focus(); return; }
      Bag.add(data.id, state.color, state.size, 1);
      window.ZVOpenMiniBag();
    });

    var adv = $('#advisorLink');
    adv && adv.addEventListener('click', function (e) {
      e.preventDefault();
      var t = 'Hello Zebra Verde, I would like to know more about ' + data.name + ' — ' + data.title +
        (state.color ? ' (' + state.color + (state.size ? ', size ' + state.size : '') + ')' : '') + '. ' + location.href;
      window.open('https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(t), '_blank', 'noopener');
    });
  }

  /* ------------------------------------------------------------------ bag */
  function bagPage() {
    var wrap = $('#bagWrap');
    function render() {
      catalog().then(function (d) {
        var lines = Bag.lines(d);
        if (!lines.length) {
          wrap.innerHTML = '<div class="empty"><p class="serif" style="font-size:clamp(32px,4vw,52px);color:var(--strong);margin:0">Your bag is empty.</p>' +
            '<p class="body" style="margin:0 auto">Every pair begins with a choice. Let us help you find yours.</p>' +
            '<a class="btn solid" href="' + ROOT + 'shop/">Discover the collection</a></div>';
          return;
        }
        var sub = lines.reduce(function (a, l) { return a + l.total; }, 0);
        wrap.innerHTML =
          '<div class="bag-grid"><ul class="bag-lines" aria-label="Items in your bag">' +
          lines.map(function (l) {
            var url = ROOT + 'shop/' + l.p.slug + '/';
            return '<li class="bag-line">' +
              '<a class="plinth" href="' + url + '"><img src="' + esc(l.image) + '" alt="' + esc(l.p.name + ' — ' + l.item.color) + '"></a>' +
              '<div class="bag-info"><p class="eyebrow" style="font-size:10px">' + esc(l.p.title) + '</p>' +
              '<h2 class="serif" style="font-size:28px"><a href="' + url + '">' + esc(l.p.name) + '</a></h2>' +
              '<p class="muted-sm">Colour: ' + esc(l.item.color) + '</p><p class="muted-sm">Size: ' + esc(l.item.size) + '</p>' +
              '<div class="qty" role="group" aria-label="Quantity for ' + esc(l.p.name) + '">' +
              '<button type="button" data-q="-1" data-k="' + esc(l.item.key) + '" aria-label="Decrease quantity">−</button>' +
              '<span aria-live="polite">' + l.item.qty + '</span>' +
              '<button type="button" data-q="1" data-k="' + esc(l.item.key) + '" aria-label="Increase quantity">+</button></div>' +
              '<button type="button" class="linkish" data-rm="' + esc(l.item.key) + '">Remove</button></div>' +
              '<p class="bag-price">' + money(l.total) + '</p></li>';
          }).join('') + '</ul>' + summary(sub, true) + '</div>';
        $$('[data-q]', wrap).forEach(function (b) {
          b.addEventListener('click', function () {
            var it = Bag.items().filter(function (i) { return i.key === b.dataset.k; })[0];
            if (it) { Bag.setQty(it.key, it.qty + (+b.dataset.q)); render(); }
          });
        });
        $$('[data-rm]', wrap).forEach(function (b) { b.addEventListener('click', function () { Bag.remove(b.dataset.rm); render(); }); });
      });
    }
    render();
  }

  function shippingFor(country) {
    if (country === 'CO') return CFG.shipping && CFG.shipping.CO != null ? CFG.shipping.CO : null;
    return CFG.shipping ? CFG.shipping.international : null;
  }
  function summary(sub, withCta, country) {
    var ship = shippingFor(country || 'CO');
    var shipTxt = ship === null ? 'Quoted by your advisor' : (ship === 0 ? (CFG.shipping.CO_label || 'Complimentary') : money(ship));
    return '<aside class="summary" aria-label="Order summary"><p class="eyebrow">Order summary</p>' +
      '<div class="sum-row"><span>Subtotal</span><span>' + money(sub) + '</span></div>' +
      '<div class="sum-row"><span>Shipping' + (country && country !== 'CO' ? '' : ' (Colombia)') + '</span><span>' + shipTxt + '</span></div>' +
      '<div class="sum-row total"><span>Total</span><span>' + money(sub + (ship || 0)) + '</span></div>' +
      (withCta ? '<a class="btn solid" href="' + ROOT + 'checkout/" style="width:100%">Proceed to checkout</a>' +
        '<p class="muted-sm" style="text-align:center">Secure payment with Wompi · Cards, PSE, Nequi</p>' : '') +
      '</aside>';
  }

  /* ------------------------------------------------------------- checkout */
  function checkoutPage() {
    var form = $('#checkoutForm'), sumBox = $('#checkoutSummary'), err = $('#formError');
    var payReady = !!(CFG.wompi && CFG.wompi.publicKey && CFG.wompi.signatureEndpoint);
    var d0 = null;

    function paintSummary() {
      var lines = Bag.lines(d0), sub = lines.reduce(function (a, l) { return a + l.total; }, 0);
      var country = form.country.value;
      sumBox.innerHTML = '<div class="sum-lines">' + lines.map(lineMini).join('') + '</div>' + summary(sub, false, country);
      var intl = country !== 'CO';
      $('#payWompi').disabled = intl || !payReady;
      $('#wompiNote').textContent = intl
        ? 'For deliveries outside Colombia, a Client Advisor will confirm shipping and send you a secure payment link.'
        : (payReady ? 'You will be redirected to Wompi to pay securely by card, PSE, Nequi or Bancolombia.' : 'Online payment is being activated. Meanwhile, complete your order with a Client Advisor — same pieces, same prices.');
      if ((intl || !payReady) && $('#payWompi').checked) $('#payAdvisor').checked = true;
      if (!intl && payReady && !$('#payAdvisor').checked) $('#payWompi').checked = true;
      $('#submitBtn').textContent = $('#payWompi').checked ? 'Pay ' + money(sub + (shippingFor(country) || 0)) : 'Send my order to a Client Advisor';
      return { lines: lines, sub: sub };
    }

    catalog().then(function (d) {
      d0 = d;
      if (!Bag.count()) {
        $('#checkoutWrap').innerHTML = '<div class="empty"><p class="serif" style="font-size:clamp(32px,4vw,52px);color:var(--strong);margin:0">Your bag is empty.</p><a class="btn solid" href="' + ROOT + 'shop/">Discover the collection</a></div>';
        return;
      }
      var saved = store('zv-customer') || {};
      Object.keys(saved).forEach(function (k) { if (form[k] && form[k].type !== 'radio') form[k].value = saved[k]; });
      paintSummary();
      form.addEventListener('change', paintSummary);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.textContent = '';
      if (!form.checkValidity()) {
        var bad = form.querySelector(':invalid'); bad && bad.focus();
        err.textContent = 'Please complete the highlighted fields.';
        return;
      }
      var s = paintSummary();
      var c = {};
      ['email', 'firstName', 'lastName', 'phone', 'country', 'address', 'address2', 'city', 'region', 'postal', 'notes'].forEach(function (k) { c[k] = (form[k] && form[k].value || '').trim(); });
      store('zv-customer', c);
      var items = Bag.items().map(function (i) { return { id: i.id, color: i.color, size: i.size, qty: i.qty }; });

      if ($('#payAdvisor').checked) {
        var lines = s.lines.map(function (l) { return '• ' + l.p.name + ' ' + l.p.title + ' — ' + l.item.color + ', size ' + l.item.size + ' × ' + l.item.qty + ' = ' + money(l.total); }).join('\n');
        var text = 'Hello Zebra Verde, I would like to place this order:\n\n' + lines + '\n\nSubtotal: ' + money(s.sub) +
          '\n\nName: ' + c.firstName + ' ' + c.lastName + '\nEmail: ' + c.email + '\nPhone: ' + c.phone +
          '\nShip to: ' + c.address + (c.address2 ? ', ' + c.address2 : '') + ', ' + c.city + ', ' + c.region + ' ' + c.postal + ', ' + form.country.options[form.country.selectedIndex].text +
          (c.notes ? '\nNotes: ' + c.notes : '');
        window.open('https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
        $('#advisorDone').hidden = false;
        return;
      }

      // Wompi: the backend recalculates the total from its own price list and signs it.
      var btn = $('#submitBtn'); btn.disabled = true; btn.textContent = 'Preparing secure payment…';
      fetch(CFG.wompi.signatureEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids CORS preflight on Apps Script
        body: JSON.stringify({ action: 'createOrder', items: items, customer: c })
      }).then(function (r) { return r.json(); }).then(function (o) {
        if (!o || !o.signature) throw new Error(o && o.error || 'No signature');
        var f = document.createElement('form');
        f.method = 'GET'; f.action = 'https://checkout.wompi.co/p/';
        var fields = {
          'public-key': CFG.wompi.publicKey,
          'currency': o.currency,
          'amount-in-cents': o.amountInCents,
          'reference': o.reference,
          'signature:integrity': o.signature,
          'redirect-url': ROOT.replace(/^(?!https?:)/, location.origin + '/') + 'order/',
          'customer-data:email': c.email,
          'customer-data:full-name': c.firstName + ' ' + c.lastName,
          'customer-data:phone-number': c.phone.replace(/\D/g, ''),
          'shipping-address:address-line-1': c.address,
          'shipping-address:address-line-2': c.address2,
          'shipping-address:country': 'CO',
          'shipping-address:city': c.city,
          'shipping-address:region': c.region,
          'shipping-address:phone-number': c.phone.replace(/\D/g, '')
        };
        Object.keys(fields).forEach(function (k) {
          if (!fields[k]) return;
          var i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = fields[k]; f.appendChild(i);
        });
        store('zv-last-ref', o.reference);
        document.body.appendChild(f); f.submit();
      }).catch(function () {
        btn.disabled = false; paintSummary();
        err.textContent = 'We could not start the payment. Please try again, or complete your order with a Client Advisor.';
      });
    });
  }

  /* ---------------------------------------------------------------- order */
  function orderPage() {
    var box = $('#orderBox');
    var id = new URLSearchParams(location.search).get('id');
    function show(title, body, ok) {
      box.innerHTML = '<p class="eyebrow">' + (ok ? 'Thank you' : 'Payment status') + '</p>' +
        '<h1 style="font-size:clamp(40px,6vw,84px);line-height:1">' + title + '</h1><p class="body" style="margin:0 auto">' + body + '</p>' +
        '<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center"><a class="btn solid" href="' + ROOT + 'shop/">Continue exploring</a>' +
        '<a class="btn" style="color:var(--text)" href="https://wa.me/' + CFG.whatsapp + '" target="_blank" rel="noopener">Talk to a Client Advisor</a></div>';
    }
    if (!id) { show('Your order', 'We could not find a payment reference. If you completed a payment, a Client Advisor will confirm it shortly.'); return; }
    var host = CFG.wompi && CFG.wompi.env === 'sandbox' ? 'https://sandbox.wompi.co' : 'https://production.wompi.co';
    fetch(host + '/v1/transactions/' + encodeURIComponent(id)).then(function (r) { return r.json(); }).then(function (j) {
      var t = j.data || {}, st = t.status;
      var ref = t.reference ? '<br><span class="muted-sm">Reference ' + esc(t.reference) + ' · ' + money((t.amount_in_cents || 0) / 100) + '</span>' : '';
      if (st === 'APPROVED') { Bag.clear(); show('Every step will be yours.', 'Your payment was approved. We have begun preparing your pieces and will write to you with every detail.' + ref, true); }
      else if (st === 'PENDING') show('Payment pending', 'Your payment is being confirmed by the bank. We will email you as soon as it is approved.' + ref);
      else show('Payment not completed', 'The payment was ' + esc((st || 'not completed').toLowerCase()) + '. Your bag is saved — you can try again or ask a Client Advisor for help.' + ref);
    }).catch(function () {
      show('Your order', 'We could not check the payment status right now. A Client Advisor will confirm it shortly.');
    });
  }

  /* ----------------------------------------------------------------- boot */
  chrome();
  if (PAGE === 'shop') shopPage();
  if (PAGE === 'product') productPage();
  if (PAGE === 'bag') bagPage();
  if (PAGE === 'checkout') checkoutPage();
  if (PAGE === 'order') orderPage();
})();
