/* ════════════════════════════════════════════════════════════════════
   LIQUID GLASS (prueba) — refracción real con SVG en backdrop-filter
   ────────────────────────────────────────────────────────────────────
   Por qué no liquidGL / liquid-glass-js en este sitio:
   esas librerías refractan una "foto" fija de la página. Acá el fondo
   son shaders WebGL animados (nubes, brillo rojo) y las secciones
   cambian con transiciones, así que la foto queda vieja (probado: el
   nav mostraba negro encima del rojo). En cambio, backdrop-filter con
   un filtro SVG de desplazamiento refracta EN VIVO lo que haya detrás,
   incluidos los canvas. Es la misma técnica de mapa de desplazamiento
   que usa liquid-glass-js, aplicada al fondo real.
   Soporte: Chrome / Edge / Opera (Chromium). Safari y Firefox no
   aceptan filtros SVG en backdrop-filter → caen a un blur normal.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var isChromium = !!window.chrome && /Chrome\//.test(navigator.userAgent);
  var SVGNS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  document.body.appendChild(svg);

  var uid = 0;

  /* Mapa de desplazamiento: borde biselado de un rectángulo redondeado.
     R = desplazamiento en X, G = en Y (128 = sin desplazamiento).
     En el bisel los píxeles "miran" hacia adentro → efecto de lente. */
  function buildMap(w, h, r, bezel, magnify) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(w, h);
    var d = img.data;
    var cx = w / 2, cy = h / 2;
    var hx = w / 2 - r, hy = h / 2 - r;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var px = x + 0.5 - cx, py = y + 0.5 - cy;
        var ax = Math.abs(px) - hx, ay = Math.abs(py) - hy;
        var ox = Math.max(ax, 0), oy = Math.max(ay, 0);
        var outside = Math.sqrt(ox * ox + oy * oy);
        var sdf = outside + Math.min(Math.max(ax, ay), 0) - r; // <0 adentro
        var dist = -sdf;                                         // distancia al borde
        var i = (y * w + x) * 4;
        var dx = 0, dy = 0;
        // Lupa suave en todo el panel: los píxeles miran hacia el centro
        if (dist >= 0 && magnify) {
          dx = -(px / (w / 2)) * magnify;
          dy = -(py / (h / 2)) * magnify;
        }
        if (dist >= 0 && dist < bezel) {
          var nx, ny;
          if (ox > 0 && oy > 0) { nx = ox / outside; ny = oy / outside; }
          else if (ax > ay)     { nx = 1; ny = 0; }
          else                  { nx = 0; ny = 1; }
          nx *= px < 0 ? -1 : 1;
          ny *= py < 0 ? -1 : 1;
          var t = 1 - dist / bezel;                 // 1 en el borde, 0 hacia adentro
          var mag = Math.pow(t, 2.2);               // perfil convexo
          dx += -nx * mag; dy += -ny * mag;         // borde: apunta hacia el centro
        }
        dx = Math.max(-1, Math.min(1, dx)); dy = Math.max(-1, Math.min(1, dy));
        d[i]     = Math.round(128 + dx * 127);
        d[i + 1] = Math.round(128 + dy * 127);
        d[i + 2] = 128;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  function el(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* Un filtro por elemento (el mapa depende de su tamaño). Tres pasadas
     con escalas apenas distintas por canal = aberración cromática. */
  function makeFilter(id, w, h, opt) {
    var f = el('filter', {
      id: id, x: '0', y: '0', width: String(w), height: String(h),
      filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse',
      'color-interpolation-filters': 'sRGB'
    }, svg);
    var map = el('feImage', { x: '0', y: '0', width: String(w), height: String(h), result: 'map', preserveAspectRatio: 'none' }, f);
    map.setAttributeNS('http://www.w3.org/1999/xlink', 'href', buildMap(w, h, opt.radius, opt.bezel, opt.magnify));
    el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: String(opt.frost), result: 'src' }, f);
    var s = opt.scale, ch = opt.chroma;
    f._map = map; f._disp = [];
    [['r', s, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'],
     ['g', s * (1 + ch), '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'],
     ['b', s * (1 + ch * 2), '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0']].forEach(function (p) {
      var dm = el('feDisplacementMap', { in: 'src', in2: 'map', scale: String(p[1]), xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' + p[0] }, f);
      dm._base = p[1]; f._disp.push(dm);
      el('feColorMatrix', { in: 'd' + p[0], type: 'matrix', values: p[2], result: 'c' + p[0] }, f);
    });
    el('feBlend', { in: 'cr', in2: 'cg', mode: 'screen', result: 'rg' }, f);
    el('feBlend', { in: 'rg', in2: 'cb', mode: 'screen', result: 'rgb' }, f);
    el('feColorMatrix', { in: 'rgb', type: 'saturate', values: String(opt.saturate) }, f);
    return f;
  }

  function glassify(node, opt) {
    opt = Object.assign({ scale: 60, bezel: 999, magnify: 0.12, chroma: 0.14, frost: 0.4, saturate: 1.4, tint: 'rgba(255,255,255,0.04)', fluid: true }, opt || {});
    var id = 'lg-' + (++uid);
    var filter = null, lastKey = '';
    node.classList.add('lg-glass');
    node.style.setProperty('--lg-tint', opt.tint);

    function update() {
      var w = node.offsetWidth, h = node.offsetHeight;
      if (!w || !h) return;
      var cs = getComputedStyle(node);
      var radius = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, w / 2, h / 2);
      var bezel = Math.min(opt.bezel, Math.min(w, h) / 2);
      var key = w + 'x' + h + 'r' + radius;
      if (key === lastKey) return;
      lastKey = key;
      if (filter) filter.remove();
      filter = makeFilter(id, w, h, { radius: radius, bezel: bezel, magnify: opt.magnify, scale: opt.scale, chroma: opt.chroma, frost: opt.frost, saturate: opt.saturate });
      if (isChromium) {
        node.style.backdropFilter = 'url(#' + id + ')';
        node.style.webkitBackdropFilter = 'url(#' + id + ')';
      }
    }
    update();
    if ('ResizeObserver' in window) new ResizeObserver(update).observe(node);
    var handle = { set: function (o) { Object.assign(opt, o); node.style.setProperty('--lg-tint', opt.tint); lastKey = ''; update(); } };

    /* Superficie "líquida": al pasar el cursor el vidrio se "hincha"
       (más refracción) y vuelve suave al salir. Imita el modo fluid de
       liquidGL sin WebGL. */
    if (opt.fluid && isChromium && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var tx = 0, ty = 0, tk = 0, cx = 0, cy = 0, ck = 0, raf = 0;
      function tick() {
        cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12; ck += (tk - ck) * 0.12;
        if (filter && filter._map) {
          filter._disp.forEach(function (dm) { dm.setAttribute('scale', (dm._base * (1 + ck * 0.45)).toFixed(2)); });
        }
        if (Math.abs(tx - cx) + Math.abs(ty - cy) + Math.abs(tk - ck) > 0.05) raf = requestAnimationFrame(tick);
        else raf = 0;
      }
      function go() { if (!raf) raf = requestAnimationFrame(tick); }
      node.addEventListener('pointermove', function (e) {
        var r = node.getBoundingClientRect();
        tx = e.clientX - (r.left + r.width / 2); ty = e.clientY - (r.top + r.height / 2); tk = 1; go();
      });
      node.addEventListener('pointerleave', function () { tx = 0; ty = 0; tk = 0; go(); });
    }
    return handle;
  }

  /* ── Estilos comunes: brillo del borde y respaldo para Safari/Firefox ── */
  var css = document.createElement('style');
  css.textContent = [
    '.lg-glass{background:var(--lg-tint)!important;',
    '  box-shadow:inset 0 1px 1px rgba(255,255,255,.55),inset 0 -1px 1px rgba(255,255,255,.18),',
    '    inset 0 0 0 1px rgba(255,255,255,.10),inset 0 0 18px rgba(255,255,255,.06),0 12px 34px rgba(0,0,0,.35)!important;',
    '  border:none!important;}',
    isChromium ? '' : '.lg-glass{-webkit-backdrop-filter:blur(14px) saturate(160%)!important;backdrop-filter:blur(14px) saturate(160%)!important;}',
    /* ── Botón "Send a message" de contacto: píldora de vidrio ── */
    '.contact-btn.lg-glass{border-radius:999px;text-shadow:0 1px 2px rgba(0,0,0,.55);transition:background-color .25s,box-shadow .25s;}',
    '.contact-btn.lg-glass:hover{background:rgba(255,255,255,.14)!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.55),inset 0 1px 1px rgba(255,255,255,.5);}',
    '.contact-btn.lg-glass:focus-visible{outline:2px solid #fff;outline-offset:3px;}',
    /* ── Esferas de contacto (mail, teléfono, LinkedIn, Torre) ── */
    '.contact-icon-circle.lg-glass{transition:box-shadow .25s,background-color .25s;}',
    '.contact-icon-item:hover .contact-icon-circle.lg-glass{background-color:var(--contact-hover-soft,rgba(255,255,255,.12));box-shadow:inset 0 0 0 1.5px var(--contact-hover,#fff),inset 0 1px 1px rgba(255,255,255,.5);}',
    '.contact-icon-circle.lg-glass svg{filter:drop-shadow(0 1px 2px rgba(0,0,0,.45));}',
    /* ── Cards: 4 propuestas (se eligen con el panel de abajo a la izquierda) ── */
    '#proj-cards li.sc.lg-glass{border-radius:16px;overflow:hidden;}',
    '#proj-cards li.sc.lg-glass > .sc-dim{border-radius:16px;z-index:4;}',
    '#proj-cards li.sc.lg-glass > .pc-logo-card{transition:background-color .35s ease,inset .35s ease;}',
    /* A · Marco: vidrio transparente alrededor, contenido opaco adentro */
    '#proj-cards[data-lg=marco] li.sc.lg-glass > .pc-logo-card{inset:12px!important;width:auto!important;height:auto!important;border-radius:8px;overflow:hidden;}',
    /* B · Tintado: toda la card es vidrio del color del proyecto */
    '#proj-cards[data-lg=tintado] li.sc.lg-glass > .pc-logo-card{background:rgba(var(--card-rgb),.55)!important;border-radius:16px;}',
    /* C · Bloque: vidrio grueso de color, con brillo diagonal y bisel marcado */
    '#proj-cards[data-lg=bloque] li.sc.lg-glass > .pc-logo-card{background:rgba(var(--card-rgb),.74)!important;border-radius:16px;}',
    '#proj-cards[data-lg=bloque] li.sc.lg-glass::before{content:"";position:absolute;inset:0;border-radius:16px;pointer-events:none;z-index:3;' +
    'background:linear-gradient(135deg,rgba(255,255,255,.30) 0%,rgba(255,255,255,.06) 28%,transparent 45%,transparent 70%,rgba(255,255,255,.10) 100%);' +
    'box-shadow:inset 0 2px 2px rgba(255,255,255,.55),inset 0 -2px 3px rgba(0,0,0,.25),inset 0 0 0 1px rgba(255,255,255,.18);}',
    /* D · Esmerilado: vidrio de color con textura opaca, bordes que refractan */
    '#proj-cards[data-lg=esmerilado] li.sc.lg-glass > .pc-logo-card{background:rgba(var(--card-rgb),.42)!important;border-radius:16px;}',
    /* Logos con fondo propio (ej. el JPG negro de Fragancia): se funden con el vidrio */
    '#proj-cards:not([data-lg=marco]) .pc-logo-chip img[data-lg-mask]{mask-image:var(--lg-mask);mask-mode:luminance;mask-size:var(--lg-mask-size,contain);mask-position:var(--lg-mask-pos,center);mask-repeat:no-repeat;}',
    /* Cards que son una imagen completa (ej. English Fluency): la imagen se vuelve translúcida */
    '#proj-cards li.sc.lg-glass > .pc-photo{transition:opacity .35s ease;}',
    '#proj-cards[data-lg=tintado] li.sc.lg-glass > .pc-photo{opacity:.62;}',
    '#proj-cards[data-lg=bloque] li.sc.lg-glass > .pc-photo{opacity:.8;}',
    '#proj-cards[data-lg=esmerilado] li.sc.lg-glass > .pc-photo{opacity:.5;}',
    '#proj-cards:not([data-lg=marco]) li.sc.lg-glass:has(> .pc-photo){background:rgba(var(--card-rgb),.35)!important;}',
    '#proj-cards[data-lg=marco] li.sc.lg-glass > .pc-photo{inset:12px;width:calc(100% - 24px);height:calc(100% - 24px);border-radius:8px;object-fit:cover;}',
    /* Panel para elegir la propuesta */
    '#lg-cards-panel{position:fixed;left:20px;bottom:20px;z-index:99990;display:flex;gap:6px;align-items:center;padding:6px;border-radius:999px;' +
    'background:rgba(10,10,10,.72);border:1px solid rgba(255,255,255,.14);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);' +
    'font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#fff;}',
    '#lg-cards-panel span{padding:0 8px 0 10px;opacity:.6;}',
    '#lg-cards-panel button{all:unset;cursor:pointer;padding:9px 12px;border-radius:999px;color:#fff;opacity:.7;}',
    '#lg-cards-panel button:hover{opacity:1;background:rgba(255,255,255,.08);}',
    '#lg-cards-panel button[aria-pressed=true]{opacity:1;background:#fff;color:#000;}',
    '#lg-cards-panel button:focus-visible{outline:2px solid #fff;outline-offset:2px;}',
    /* Botones del nav: transparentes para que se vea el vidrio del pill */
    '.nav.lg-glass .nav-home,.nav.lg-glass .nav-search{background:rgba(255,255,255,.08)!important;}',
    /* Legibilidad: el vidrio es transparente y detrás puede haber nubes blancas */
    '.nav.lg-glass .nav-links a,.nav.lg-glass .nav-home,.nav.lg-glass .nav-search,.top-utils > .lg-glass,.contact-footer.lg-glass{text-shadow:0 1px 2px rgba(0,0,0,.55),0 0 10px rgba(0,0,0,.25);}',
    '.nav.lg-glass .nav-links a{color:#fff!important;}'
  ].join('\n');
  document.head.appendChild(css);

  /* ── Aplicar: nav, botones de arriba a la derecha, footer y cards ── */
  function run() {
    var nav = document.querySelector('.nav');
    if (nav) glassify(nav, { scale: 46, magnify: 0.08 });

    document.querySelectorAll('.top-utils > button').forEach(function (b) {
      glassify(b, { scale: 34, magnify: 0.15, tint: 'rgba(255,255,255,0.08)' });
      b.style.color = '#fff';
    });

    var footer = document.querySelector('.contact-footer');
    if (footer) glassify(footer, { scale: 36, bezel: 16, magnify: 0, chroma: 0.12, tint: 'rgba(255,255,255,0.05)' });

    // Botón "Send a message": mismo vidrio que el nav
    var cbtn = document.querySelector('.contact-btn');
    if (cbtn) glassify(cbtn, { scale: 40, magnify: 0.1, tint: 'rgba(255,255,255,0.06)' });

    // Esferas de contacto: mismo vidrio líquido que los botones de arriba
    document.querySelectorAll('.contact-icon-circle').forEach(function (c) {
      glassify(c, { scale: 38, magnify: 0.15, tint: 'rgba(255,255,255,0.08)' });
    });

    /* Ajustes del vidrio de las cards según la propuesta */
    var CARD_MODES = {
      marco:      { label: 'Marco',      opt: { scale: 80,  bezel: 22, magnify: 0.06, chroma: 0.18, frost: 0.4, tint: 'rgba(255,255,255,0.03)' } },
      tintado:    { label: 'Tintado',    opt: { scale: 70,  bezel: 28, magnify: 0.10, chroma: 0.16, frost: 0.6, tint: 'rgba(255,255,255,0.02)' } },
      bloque:     { label: 'Bloque',     opt: { scale: 110, bezel: 42, magnify: 0.14, chroma: 0.22, frost: 0.5, tint: 'rgba(255,255,255,0.02)' } },
      esmerilado: { label: 'Esmerilado', opt: { scale: 50,  bezel: 20, magnify: 0,    chroma: 0.12, frost: 7,   tint: 'rgba(255,255,255,0.04)' } }
    };
    // Elegida: Marco. Para volver a comparar, cambia SHOW_PANEL a true.
    var SHOW_PANEL = false;
    var mode = 'marco';
    if (SHOW_PANEL) { try { mode = localStorage.getItem('lg-cards-mode') || mode; } catch (e) {} }
    if (!CARD_MODES[mode]) mode = 'marco';

    // Las cards se crean por JS: esperar a que existan
    var tries = 0;
    (function cards() {
      var list = document.getElementById('proj-cards');
      var lis = document.querySelectorAll('#proj-cards li.sc');
      if ((!list || !lis.length) && tries++ < 40) return setTimeout(cards, 150);
      if (!list) return;
      var handles = [];
      lis.forEach(function (li) {
        // Color propio de cada proyecto (el fondo original de su card)
        var face = li.querySelector('.pc-logo-card');
        var rgb = '20,13,58'; // cards de foto (English Fluency): azul noche de su imagen
        if (face) {
          var m = getComputedStyle(face).backgroundColor.match(/[\d.]+/g);
          if (m && m.length >= 3) rgb = m.slice(0, 3).join(',');
        }
        var c = rgb.split(',').map(Number);
        li.dataset.tone = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) > 140 ? 'light' : 'dark';
        li.style.setProperty('--card-rgb', rgb);
        // Logo JPG con fondo negro: el negro se vuelve transparente (máscara por luminancia)
        var logo = li.querySelector('.pc-logo-chip img');
        if (logo && li.dataset.tone === 'dark' && /\.jpe?g(\?|$)/i.test(logo.getAttribute('src') || '')) {
          var ics = getComputedStyle(logo);
          logo.dataset.lgMask = '1';
          logo.style.setProperty('--lg-mask', 'url("' + logo.currentSrc + '")');
          logo.style.setProperty('--lg-mask-size', ics.objectFit === 'cover' ? 'cover' : ics.objectFit === 'fill' ? '100% 100%' : 'contain');
          logo.style.setProperty('--lg-mask-pos', ics.objectPosition);
        }
        handles.push(glassify(li, Object.assign({ fluid: false }, CARD_MODES[mode].opt)));
      });

      var panel = document.createElement('div');
      panel.id = 'lg-cards-panel';
      panel.setAttribute('role', 'group');
      panel.setAttribute('aria-label', 'Estilo de las cards de proyectos');
      panel.innerHTML = '<span>Cards</span>' + Object.keys(CARD_MODES).map(function (k) {
        return '<button type="button" data-mode="' + k + '" aria-pressed="false">' + CARD_MODES[k].label + '</button>';
      }).join('');

      function setMode(m) {
        mode = m;
        list.setAttribute('data-lg', m);
        handles.forEach(function (h) { if (h) h.set(CARD_MODES[m].opt); });
        panel.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === m)); });
        if (SHOW_PANEL) { try { localStorage.setItem('lg-cards-mode', m); } catch (e) {} }
      }
      panel.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-mode]');
        if (b) setMode(b.dataset.mode);
      });
      if (SHOW_PANEL) document.body.appendChild(panel);
      setMode(mode);
    })();
  }
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
})();
