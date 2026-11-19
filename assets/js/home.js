(function(){
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var css = function(v){ return getComputedStyle(root).getPropertyValue(v).trim(); };

  /* ---------- collection rail ---------- */
  var rail = document.getElementById('rail');
  document.querySelectorAll('[data-rail]').forEach(function(b){
    b.addEventListener('click', function(){
      rail.scrollBy({left: (+b.dataset.rail) * Math.max(320, rail.clientWidth * .6), behavior: reduce ? 'auto' : 'smooth'});
    });
  });

  /* ---------- parallax on the finished piece ---------- */
  var par = document.getElementById('parallax');
  if (!reduce && par){
    var ticking = false;
    window.addEventListener('scroll', function(){
      if (ticking) return; ticking = true;
      requestAnimationFrame(function(){
        var r = par.parentNode.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight){ par.style.transform = 'translateY(' + (-(r.top / innerHeight) * 60 - 60) + 'px)'; }
        ticking = false;
      });
    }, {passive:true});
  }

  /* ---------- variants ---------- */
  var light = root.getAttribute('data-theme') === 'light';
  var V = {
    emerald:  { img:'assets/green-grid.webp',   alt:'The season’s pieces photographed on emerald green',
                copy:'Emerald — the house colour. Deep, vivid and unmistakably Zebra Verde.',
                bg: light ? 'radial-gradient(ellipse at 50% 60%,#E3EEE8 0%,#F3F7F4 50%,#FFFFFF 85%)' : 'radial-gradient(ellipse at 50% 60%,#12594C 0%,#0A3A32 45%,#061B17 85%)' },
    bordeaux: { img:'assets/boots-maroon.webp', alt:'Bordeaux leather boots',
                copy:'Bordeaux — burnished by hand until the leather holds the last colour of dusk.',
                bg: light ? 'radial-gradient(ellipse at 50% 60%,#F3E3E6 0%,#FAF3F4 50%,#FFFFFF 85%)' : 'radial-gradient(ellipse at 50% 60%,#4A1622 0%,#2A0D15 45%,#120609 85%)' },
    noir:     { img:'assets/boot-cutout.webp',  alt:'Black knee-high stiletto boot',
                copy:'Noir — the classic, sharpened. A line drawn once, with intent.',
                bg: light ? 'radial-gradient(ellipse at 50% 55%,#ECECE8 0%,#F7F7F5 50%,#FFFFFF 85%)' : 'radial-gradient(ellipse at 50% 55%,#3B3F3A 0%,#1A1C1A 45%,#0A0B0A 85%)' }
  };
  var vSec = document.getElementById('variants'), vImg = document.getElementById('varImg'), vCopy = document.getElementById('varCopy');
  function setVariant(k){
    var v = V[k];
    vSec.style.background = v.bg;
    document.querySelectorAll('[data-variant]').forEach(function(b){ b.setAttribute('aria-pressed', b.dataset.variant === k ? 'true' : 'false'); });
    vImg.classList.add('swap');
    setTimeout(function(){ vImg.src = v.img; vImg.alt = v.alt; vCopy.textContent = v.copy; vImg.classList.remove('swap'); }, reduce ? 0 : 380);
  }
  document.querySelectorAll('[data-variant]').forEach(function(b){ b.addEventListener('click', function(){ setVariant(b.dataset.variant); }); });
  vSec.style.background = V.emerald.bg;

  /* ---------- scarcity counter ---------- */
  var count = document.getElementById('count');
  if (!reduce){
    var cio = new IntersectionObserver(function(es){
      if (!es[0].isIntersecting) return; cio.disconnect();
      var to = +count.dataset.to, from = 980, t0 = performance.now(), d = 2200;
      (function tick(now){ var p = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - p, 4);
        count.textContent = Math.round(from + (to - from) * e); if (p < 1) requestAnimationFrame(tick); })(t0);
    }, {threshold:.5});
    cio.observe(count);
  }

  /* ---------- hero: zebra stripes made of particles ---------- */
  var cv = document.getElementById('stripes'), ctx = cv.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2), W = 0, H = 0, pts = [], mouse = {x:-9999, y:-9999};
  var palette = [css('--p1'), css('--p1'), css('--p2'), css('--p3'), css('--p4'), css('--p5')];
  var alphaBoost = light ? 1.15 : .85;
  function build(){
    var r = cv.getBoundingClientRect(); W = r.width; H = r.height;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.round(Math.min(2600, W * H / 520)); pts = [];
    for (var i = 0; i < n; i++) pts.push({
      stripe: Math.floor(Math.random() * 14), t: Math.random(), off: (Math.random() - .5) * 26,
      sp: .00012 + Math.random() * .00028, s: Math.random() < .04 ? 2.2 : .5 + Math.random() * 1.1,
      c: palette[Math.floor(Math.random() * palette.length)], a: .25 + Math.random() * .6, dx: 0, dy: 0
    });
  }
  function pos(p, time){
    var gap = W / 11, baseX = -gap * 1.5 + p.stripe * gap, y = p.t * (H + 200) - 100;
    var bend = Math.sin(y / 180 + p.stripe * .9 + time * .00025) * 46 + Math.sin(y / 70 + p.stripe) * 10;
    return [baseX + y * .32 + bend + p.off, y];
  }
  var last = performance.now(), visible = true;
  function frame(now){
    var dt = Math.min(48, now - last); last = now;
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < pts.length; i++){
      var p = pts[i];
      if (!reduce){ p.t += p.sp * dt * .06; if (p.t > 1) p.t -= 1; }
      var xy = pos(p, now), x = xy[0], y = xy[1];
      var mx = x - mouse.x, my = y - mouse.y, d2 = mx * mx + my * my;
      if (d2 < 22000){ var f = (22000 - d2) / 22000; p.dx += mx * f * .06; p.dy += my * f * .06; }
      p.dx *= .92; p.dy *= .92; x += p.dx; y += p.dy;
      var fade = Math.min(1, y / 120, (H - y) / 160); if (fade <= 0) continue;
      ctx.globalAlpha = Math.min(1, p.a * fade * alphaBoost); ctx.fillStyle = p.c; ctx.fillRect(x, y, p.s, p.s);
    }
    ctx.globalAlpha = 1;
    if (!reduce && visible) requestAnimationFrame(frame);
  }
  build();
  window.addEventListener('resize', build);
  cv.parentNode.addEventListener('pointermove', function(e){ var r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  cv.parentNode.addEventListener('pointerleave', function(){ mouse.x = mouse.y = -9999; });
  new IntersectionObserver(function(es){
    var was = visible; visible = es[0].isIntersecting;
    if (visible && !was && !reduce){ last = performance.now(); requestAnimationFrame(frame); }
  }).observe(cv);
  requestAnimationFrame(frame);
})();
