/*!
 * Accessibility Widget — standalone, dependency-free
 * Drop-in accessibility assistant: profiles + granular settings.
 * Usage: <script src="accessibility-widget.js"></script>
 * Optional config before the script tag:
 *   <script>window.A11Y_WIDGET_CONFIG = { position: 'bottom-right', accentColor: '#7c6cf0' };</script>
 */
(function () {
  "use strict";

  if (window.__a11yWidgetLoaded) return;
  window.__a11yWidgetLoaded = true;

  var CONFIG = Object.assign(
    {
      position: "bottom-right", // bottom-right | bottom-left | top-right | top-left
      accentColor: "#6c5ce7",
      storageKey: "a11yWidgetState",
      brandName: "Accesibilidad",
      poweredByText: "", // e.g. "Powered by YourCompany" — leave empty to hide
      language: "es" // 'es' | 'en' — sitios con toggle de idioma pueden pasar esto dinámicamente
    },
    window.A11Y_WIDGET_CONFIG || {}
  );

  var I18N = {
    es: {
      brandName: CONFIG.brandName || "Accesibilidad",
      close: "Cerrar",
      tabProfiles: "Perfiles",
      tabSettings: "Ajustes",
      reset: "Restablecer",
      cert: "Certificación",
      profiles: { vision: "Visión", cognitive: "Cognitivo", seizure: "Foto-sensibilidad", adhd: "TDAH", dyslexia: "Dislexia" },
      settings: {
        keyboardNav: "Navegación por teclado",
        underlineLinks: "Subrayar enlaces",
        underlineHeaders: "Subrayar títulos",
        textSize: "Tamaño de texto",
        spacing: "Espaciado",
        readableFonts: "Fuentes legibles",
        readingGuide: "Guía de lectura",
        readMode: "Modo lectura",
        highContrast: "Alto contraste",
        darkContrast: "Contraste oscuro",
        stopAnimations: "Detener animaciones",
        bigCursor: "Cursor grande",
        hideImages: "Ocultar imágenes"
      }
    },
    en: {
      brandName: "Accessibility",
      close: "Close",
      tabProfiles: "Profiles",
      tabSettings: "Settings",
      reset: "Reset",
      cert: "Certification",
      profiles: { vision: "Vision", cognitive: "Cognitive", seizure: "Seizure Safe", adhd: "ADHD", dyslexia: "Dyslexia" },
      settings: {
        keyboardNav: "Keyboard Navigation",
        underlineLinks: "Underline Links",
        underlineHeaders: "Underline Headers",
        textSize: "Text Size",
        spacing: "Spacing",
        readableFonts: "Readable Fonts",
        readingGuide: "Reading Guide",
        readMode: "Read Mode",
        highContrast: "High Contrast",
        darkContrast: "Dark Contrast",
        stopAnimations: "Stop Animations",
        bigCursor: "Big Cursor",
        hideImages: "Hide Images"
      }
    }
  };
  var T = I18N[CONFIG.language] || I18N.es;
  // Si no pasaron brandName explícito en la config, usamos el traducido;
  // si sí lo pasaron (personalización del sitio), lo respetamos tal cual.
  if (!window.A11Y_WIDGET_CONFIG || !window.A11Y_WIDGET_CONFIG.brandName) {
    CONFIG.brandName = T.brandName;
  }

  /* ---------------------------------------------------------------------
   * State
   * ------------------------------------------------------------------- */
  var DEFAULT_STATE = {
    open: false,
    activeTab: "profiles", // profiles | settings
    profiles: { vision: false, cognitive: false, seizure: false, adhd: false, dyslexia: false },
    settings: {
      underlineLinks: false,
      underlineHeaders: false,
      textSize: 100, // %
      spacing: 100, // %
      readableFonts: false,
      readingGuide: false,
      readMode: false,
      highContrast: false,
      darkContrast: false,
      saturation: 100, // %
      stopAnimations: false,
      bigCursor: false,
      hideImages: false,
      keyboardNav: false
    }
  };

  function loadState() {
    try {
      var raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_STATE));
      var parsed = JSON.parse(raw);
      return Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed, {
        profiles: Object.assign({}, DEFAULT_STATE.profiles, parsed.profiles),
        settings: Object.assign({}, DEFAULT_STATE.settings, parsed.settings)
      });
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  }

  var state = loadState();

  function saveState() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
    } catch (e) {}
  }

  /* ---------------------------------------------------------------------
   * Styles
   * ------------------------------------------------------------------- */
  var css = "" +
  ":root{--a11y-accent:" + CONFIG.accentColor + ";}" +
  "#a11y-toggle-btn{position:fixed;z-index:2147483000;width:56px;height:56px;border-radius:50%;" +
  "background:#0D0B09;border:3px solid var(--a11y-accent);cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35);" +
  "display:flex;align-items:center;justify-content:center;transition:transform .15s ease;}" +
  "#a11y-toggle-btn:hover{transform:scale(1.06);}" +
  "#a11y-toggle-btn svg{width:26px;height:26px;}" +
  ".a11y-pos-bottom-right{bottom:20px;right:20px;}" +
  ".a11y-pos-bottom-left{bottom:20px;left:20px;}" +
  ".a11y-pos-top-right{top:20px;right:20px;}" +
  ".a11y-pos-top-left{top:20px;left:20px;}" +
  "#a11y-panel{position:fixed;z-index:2147483001;width:340px;max-width:92vw;max-height:80vh;" +
  "background:#ffffff;color:#1a1a1a;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.28);" +
  "display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;" +
  "font-size:14px;line-height:1.4;}" +
  "#a11y-panel.a11y-open{display:flex;}" +
  "#a11y-panel *{box-sizing:border-box;}" +
  ".a11y-header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #eee;}" +
  ".a11y-header h2{margin:0;font-size:17px;font-weight:700;}" +
  ".a11y-close-btn{background:none;border:none;cursor:pointer;color:#666;font-size:20px;line-height:1;padding:4px;border-radius:6px;}" +
  ".a11y-close-btn:hover{background:#f0f0f0;}" +
  ".a11y-tabs{display:flex;border-bottom:1px solid #eee;}" +
  ".a11y-tab{flex:1;padding:12px 8px;text-align:center;background:none;border:none;cursor:pointer;" +
  "font-weight:600;color:#888;border-bottom:2px solid transparent;}" +
  ".a11y-tab.active{color:var(--a11y-accent);border-bottom-color:var(--a11y-accent);}" +
  ".a11y-body{overflow-y:auto;padding:8px 0;flex:1;}" +
  ".a11y-row{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;gap:10px;}" +
  ".a11y-row + .a11y-row{border-top:1px solid #f5f5f5;}" +
  ".a11y-row-label{display:flex;align-items:center;gap:10px;font-weight:500;}" +
  ".a11y-row-label svg{width:18px;height:18px;flex-shrink:0;color:#555;}" +
  ".a11y-switch{position:relative;width:42px;height:24px;flex-shrink:0;}" +
  ".a11y-switch input{opacity:0;width:0;height:0;}" +
  ".a11y-slider-track{position:absolute;cursor:pointer;inset:0;background:#ccc;border-radius:24px;transition:.15s;}" +
  ".a11y-slider-track:before{content:'';position:absolute;height:18px;width:18px;left:3px;bottom:3px;" +
  "background:#fff;border-radius:50%;transition:.15s;}" +
  ".a11y-switch input:checked + .a11y-slider-track{background:var(--a11y-accent);}" +
  ".a11y-switch input:checked + .a11y-slider-track:before{transform:translateX(18px);}" +
  ".a11y-range-row{padding:10px 18px;}" +
  ".a11y-range-row .a11y-range-top{display:flex;justify-content:space-between;margin-bottom:6px;font-weight:500;}" +
  ".a11y-range-row input[type=range]{width:100%;accent-color:var(--a11y-accent);}" +
  ".a11y-footer{display:flex;gap:8px;padding:14px 18px;border-top:1px solid #eee;}" +
  ".a11y-btn{flex:1;padding:10px 12px;border-radius:10px;font-weight:600;cursor:pointer;font-size:13px;" +
  "border:1px solid #ddd;background:#fff;color:#333;}" +
  ".a11y-btn:hover{background:#f6f6f6;}" +
  ".a11y-btn.a11y-btn-primary{background:var(--a11y-accent);color:#fff;border-color:var(--a11y-accent);}" +
  ".a11y-powered{text-align:center;font-size:11px;color:#aaa;padding:4px 0 10px;}" +
  /* Applied effects */
  ".a11y-fx-underline-links a{text-decoration:underline !important;}" +
  ".a11y-fx-underline-headers h1,.a11y-fx-underline-headers h2,.a11y-fx-underline-headers h3," +
  ".a11y-fx-underline-headers h4,.a11y-fx-underline-headers h5,.a11y-fx-underline-headers h6{text-decoration:underline !important;}" +
  ".a11y-fx-readable-fonts, .a11y-fx-readable-fonts *{font-family:Arial,Helvetica,sans-serif !important;letter-spacing:.03em !important;}" +
  ".a11y-fx-high-contrast{filter:contrast(1.35);}" +
  ".a11y-fx-dark-contrast{filter:invert(1) hue-rotate(180deg);}" +
  ".a11y-fx-dark-contrast img,.a11y-fx-dark-contrast video{filter:invert(1) hue-rotate(180deg);}" +
  ".a11y-fx-stop-animations *{animation:none !important;transition:none !important;}" +
  ".a11y-fx-big-cursor, .a11y-fx-big-cursor *{cursor:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22 viewBox=%220 0 24 24%22><path fill=%22black%22 stroke=%22white%22 stroke-width=%221%22 d=%22M4 2l14 8-6 2 4 7-3 2-4-7-5 5V2z%22/></svg>') 4 4, auto !important;}" +
  ".a11y-fx-hide-images img,.a11y-fx-hide-images picture,.a11y-fx-hide-images video{visibility:hidden !important;}" +
  ".a11y-bg-img-hidden{background-image:none !important;}" +
  ".a11y-fx-keyboard-nav :focus{outline:3px solid var(--a11y-accent) !important;outline-offset:3px !important;" +
  "box-shadow:0 0 0 6px rgba(108,92,231,.25) !important;border-radius:2px;}" +
  ".a11y-fx-keyboard-nav a:focus, .a11y-fx-keyboard-nav button:focus, .a11y-fx-keyboard-nav input:focus," +
  ".a11y-fx-keyboard-nav select:focus, .a11y-fx-keyboard-nav textarea:focus, .a11y-fx-keyboard-nav [tabindex]:focus{" +
  "outline:3px solid var(--a11y-accent) !important;outline-offset:3px !important;" +
  "box-shadow:0 0 0 6px rgba(108,92,231,.25) !important;}" +
  "#a11y-kbnav-badge{position:fixed;z-index:2147483002;pointer-events:none;display:none;" +
  "background:var(--a11y-accent);color:#fff;font:600 11px/1 -apple-system,sans-serif;padding:4px 8px;" +
  "border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.25);transform:translateY(-130%);white-space:nowrap;}" +
  "#a11y-reading-guide{position:fixed;left:0;right:0;height:36px;background:rgba(255,235,59,.35);" +
  "pointer-events:none;z-index:2147482999;display:none;border-top:2px solid rgba(255,193,7,.8);" +
  "border-bottom:2px solid rgba(255,193,7,.8);}" +
  "@media (max-width:480px){#a11y-panel{width:94vw;bottom:10px !important;right:3vw !important;left:3vw !important;}}";

  var styleEl = document.createElement("style");
  styleEl.id = "a11y-widget-styles";
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---------------------------------------------------------------------
   * Markup
   * ------------------------------------------------------------------- */
  var posClass = "a11y-pos-" + CONFIG.position;

  var iconSvg =
    '<svg viewBox="0 0 24 24" fill="none">' +
    '<circle cx="12" cy="4.4" r="2.1" fill="#fff"/>' +
    '<path d="M12 8.6v5.6M12 10.5l-5.6-2.3M12 10.5l5.6-2.3M12 14.2l-4.4 7.1M12 14.2l4.4 7.1" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  var toggleBtn = document.createElement("button");
  toggleBtn.id = "a11y-toggle-btn";
  toggleBtn.className = posClass;
  toggleBtn.setAttribute("aria-label", CONFIG.brandName);
  toggleBtn.innerHTML = iconSvg;
  document.body.appendChild(toggleBtn);

  var panel = document.createElement("div");
  panel.id = "a11y-panel";
  panel.className = posClass;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", CONFIG.brandName);

  var PROFILE_DEFS = [
    { key: "vision", label: T.profiles.vision, icon: "M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" },
    { key: "cognitive", label: T.profiles.cognitive, icon: "M12 2a7 7 0 0 0-4 12.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26A7 7 0 0 0 12 2zm-1 19h2v1h-2z" },
    { key: "seizure", label: T.profiles.seizure, icon: "M11 2 2 13h7l-1 9 10-13h-7l1-7z" },
    { key: "adhd", label: T.profiles.adhd, icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2zm0-4h-2V7h2z" },
    { key: "dyslexia", label: T.profiles.dyslexia, icon: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 3h6v3h-6z" }
  ];

  function iconSpan(path) {
    return '<svg viewBox="0 0 24 24"><path d="' + path + '"/></svg>';
  }

  var profilesHtml = PROFILE_DEFS.map(function (p) {
    return (
      '<div class="a11y-row" data-profile-row="' + p.key + '">' +
        '<span class="a11y-row-label">' + iconSpan(p.icon) + '<span>' + p.label + '</span></span>' +
        '<label class="a11y-switch"><input type="checkbox" data-profile="' + p.key + '">' +
        '<span class="a11y-slider-track"></span></label>' +
      '</div>'
    );
  }).join("");

  function switchRow(labelText, dataKey, iconPath) {
    return (
      '<div class="a11y-row">' +
        '<span class="a11y-row-label">' + (iconPath ? iconSpan(iconPath) : "") + '<span>' + labelText + '</span></span>' +
        '<label class="a11y-switch"><input type="checkbox" data-setting="' + dataKey + '">' +
        '<span class="a11y-slider-track"></span></label>' +
      '</div>'
    );
  }

  function rangeRow(labelText, dataKey, min, max, unit) {
    return (
      '<div class="a11y-range-row">' +
        '<div class="a11y-range-top"><span>' + labelText + '</span><span data-range-value="' + dataKey + '">100' + unit + '</span></div>' +
        '<input type="range" min="' + min + '" max="' + max + '" step="5" data-setting="' + dataKey + '">' +
      '</div>'
    );
  }

  var settingsHtml =
    switchRow(T.settings.keyboardNav, "keyboardNav") +
    switchRow(T.settings.underlineLinks, "underlineLinks") +
    switchRow(T.settings.underlineHeaders, "underlineHeaders") +
    rangeRow(T.settings.textSize, "textSize", 80, 200, "%") +
    rangeRow(T.settings.spacing, "spacing", 80, 200, "%") +
    switchRow(T.settings.readableFonts, "readableFonts") +
    switchRow(T.settings.readingGuide, "readingGuide") +
    switchRow(T.settings.readMode, "readMode") +
    switchRow(T.settings.highContrast, "highContrast") +
    switchRow(T.settings.darkContrast, "darkContrast") +
    switchRow(T.settings.stopAnimations, "stopAnimations") +
    switchRow(T.settings.bigCursor, "bigCursor") +
    switchRow(T.settings.hideImages, "hideImages");

  panel.innerHTML =
    '<div class="a11y-header"><h2>' + CONFIG.brandName + '</h2>' +
    '<button class="a11y-close-btn" id="a11y-close-btn" aria-label="' + T.close + '">✕</button></div>' +
    '<div class="a11y-tabs">' +
      '<button class="a11y-tab" data-tab="profiles">' + T.tabProfiles + '</button>' +
      '<button class="a11y-tab" data-tab="settings">' + T.tabSettings + '</button>' +
    '</div>' +
    '<div class="a11y-body">' +
      '<div class="a11y-tab-panel" data-panel="profiles">' + profilesHtml + '</div>' +
      '<div class="a11y-tab-panel" data-panel="settings" style="display:none;">' + settingsHtml + '</div>' +
    '</div>' +
    '<div class="a11y-footer">' +
      '<button class="a11y-btn" id="a11y-reset-btn">' + T.reset + '</button>' +
      '<button class="a11y-btn a11y-btn-primary" id="a11y-cert-btn">' + T.cert + '</button>' +
    '</div>' +
    (CONFIG.poweredByText ? '<div class="a11y-powered">' + CONFIG.poweredByText + '</div>' : "");

  document.body.appendChild(panel);

  var guide = document.createElement("div");
  guide.id = "a11y-reading-guide";
  document.body.appendChild(guide);

  var kbBadge = document.createElement("div");
  kbBadge.id = "a11y-kbnav-badge";
  document.body.appendChild(kbBadge);

  /* ---------------------------------------------------------------------
   * Profile -> settings mapping
   * ------------------------------------------------------------------- */
  var PROFILE_EFFECTS = {
    vision: { textSize: 150, highContrast: true, underlineLinks: true, readableFonts: true },
    cognitive: { readMode: true, readingGuide: true, stopAnimations: true, spacing: 130, keyboardNav: true },
    seizure: { stopAnimations: true, hideImages: false, darkContrast: false },
    adhd: { readingGuide: true, stopAnimations: true, underlineLinks: true, keyboardNav: true },
    dyslexia: { readableFonts: true, spacing: 140, textSize: 115 }
  };

  /* ---------------------------------------------------------------------
   * Apply state to document
   * ------------------------------------------------------------------- */
  var root = document.documentElement;
  var FX_CLASS_MAP = {
    underlineLinks: "a11y-fx-underline-links",
    underlineHeaders: "a11y-fx-underline-headers",
    readableFonts: "a11y-fx-readable-fonts",
    highContrast: "a11y-fx-high-contrast",
    darkContrast: "a11y-fx-dark-contrast",
    stopAnimations: "a11y-fx-stop-animations",
    bigCursor: "a11y-fx-big-cursor",
    hideImages: "a11y-fx-hide-images",
    keyboardNav: "a11y-fx-keyboard-nav"
  };

  var bgImageEls = [];
  function toggleBackgroundImages(hide) {
    if (hide) {
      if (bgImageEls.length) return; // already applied
      var all = document.querySelectorAll('body *');
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        if (panel.contains(el) || el === toggleBtn || el === guide) continue;
        var bg = getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none') {
          el.classList.add('a11y-bg-img-hidden');
          bgImageEls.push(el);
        }
      }
    } else {
      bgImageEls.forEach(function (el) { el.classList.remove('a11y-bg-img-hidden'); });
      bgImageEls = [];
    }
  }

  function applyState() {
    toggleBackgroundImages(!!state.settings.hideImages);
    Object.keys(FX_CLASS_MAP).forEach(function (key) {
      root.classList.toggle(FX_CLASS_MAP[key], !!state.settings[key]);
    });

    root.style.fontSize = state.settings.textSize + "%";
    root.style.setProperty("--a11y-letter-spacing", (state.settings.spacing - 100) / 400 + "em");
    document.body.style.letterSpacing = state.settings.spacing !== 100 ? (state.settings.spacing - 100) / 400 + "em" : "";
    document.body.style.lineHeight = state.settings.spacing !== 100 ? (state.settings.spacing / 100) * 1.5 : "";

    // Read mode: strip loud backgrounds, narrow measure
    if (state.settings.readMode) {
      document.body.classList.add("a11y-read-mode");
      if (!document.getElementById("a11y-read-mode-style")) {
        var rm = document.createElement("style");
        rm.id = "a11y-read-mode-style";
        rm.textContent = ".a11y-read-mode{background:#fdfdfa !important;color:#1a1a1a !important;}" +
          ".a11y-read-mode img, .a11y-read-mode video, .a11y-read-mode iframe{opacity:.15;}";
        document.head.appendChild(rm);
      }
    } else {
      document.body.classList.remove("a11y-read-mode");
    }

    guide.style.display = state.settings.readingGuide ? "block" : "none";

    // sync UI controls
    PROFILE_DEFS.forEach(function (p) {
      var cb = panel.querySelector('[data-profile="' + p.key + '"]');
      if (cb) cb.checked = !!state.profiles[p.key];
    });
    Object.keys(state.settings).forEach(function (key) {
      var input = panel.querySelector('[data-setting="' + key + '"]');
      if (!input) return;
      if (input.type === "checkbox") input.checked = !!state.settings[key];
      if (input.type === "range") {
        input.value = state.settings[key];
        var out = panel.querySelector('[data-range-value="' + key + '"]');
        if (out) out.textContent = state.settings[key] + "%";
      }
    });

    saveState();
    document.dispatchEvent(new CustomEvent('a11y:settingschange', { detail: JSON.parse(JSON.stringify(state.settings)) }));
  }

  function setProfile(key, enabled) {
    state.profiles[key] = enabled;
    var fx = PROFILE_EFFECTS[key] || {};
    if (enabled) {
      Object.keys(fx).forEach(function (k) {
        state.settings[k] = fx[k];
      });
    } else {
      // revert only the keys this profile touched, back to default
      Object.keys(fx).forEach(function (k) {
        state.settings[k] = DEFAULT_STATE.settings[k];
      });
    }
    applyState();
  }

  /* ---------------------------------------------------------------------
   * Events
   * ------------------------------------------------------------------- */
  toggleBtn.addEventListener("click", function () {
    state.open = !state.open;
    panel.classList.toggle("a11y-open", state.open);
    saveState();
  });

  panel.querySelector("#a11y-close-btn").addEventListener("click", function () {
    state.open = false;
    panel.classList.remove("a11y-open");
    saveState();
  });

  panel.querySelectorAll(".a11y-tab").forEach(function (tabBtn, idx) {
    if (idx === 0) tabBtn.classList.add("active");
    tabBtn.addEventListener("click", function () {
      panel.querySelectorAll(".a11y-tab").forEach(function (b) { b.classList.remove("active"); });
      tabBtn.classList.add("active");
      var tab = tabBtn.getAttribute("data-tab");
      panel.querySelectorAll(".a11y-tab-panel").forEach(function (p) {
        p.style.display = p.getAttribute("data-panel") === tab ? "block" : "none";
      });
      state.activeTab = tab;
      saveState();
    });
  });

  panel.querySelectorAll('[data-profile]').forEach(function (cb) {
    cb.addEventListener("change", function () {
      setProfile(cb.getAttribute("data-profile"), cb.checked);
    });
  });

  panel.querySelectorAll('[data-setting]').forEach(function (input) {
    var key = input.getAttribute("data-setting");
    var evt = input.type === "range" ? "input" : "change";
    input.addEventListener(evt, function () {
      state.settings[key] = input.type === "range" ? Number(input.value) : input.checked;
      applyState();
    });
  });

  panel.querySelector("#a11y-reset-btn").addEventListener("click", function () {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    state.open = true;
    applyState();
  });

  panel.querySelector("#a11y-cert-btn").addEventListener("click", function () {
    window.open("https://www.w3.org/WAI/WCAG21/quickref/", "_blank");
  });

  document.addEventListener("mousemove", function (e) {
    if (state.settings.readingGuide) {
      guide.style.top = e.clientY - 18 + "px";
    }
  });

  // Keyboard Navigation: show a small badge naming the focused element
  // as the user tabs through the page, in addition to the strong focus ring.
  function describeElement(el) {
    if (!el || el === document.body) return "";
    var label =
      el.getAttribute("aria-label") ||
      el.getAttribute("alt") ||
      el.getAttribute("title") ||
      (el.textContent || "").trim().slice(0, 40) ||
      el.getAttribute("placeholder") ||
      el.tagName.toLowerCase();
    var role = el.tagName.toLowerCase();
    return role + (label && label.toLowerCase() !== role ? ": " + label : "");
  }

  function positionBadge(el) {
    var rect = el.getBoundingClientRect();
    kbBadge.style.left = Math.max(4, rect.left) + "px";
    kbBadge.style.top = Math.max(28, rect.top) + "px";
  }

  document.addEventListener(
    "focusin",
    function (e) {
      if (!state.settings.keyboardNav) {
        kbBadge.style.display = "none";
        return;
      }
      var el = e.target;
      if (el === document.body || panel.contains(el) || el === toggleBtn) {
        kbBadge.style.display = "none";
        return;
      }
      kbBadge.textContent = describeElement(el);
      positionBadge(el);
      kbBadge.style.display = "block";
    },
    true
  );

  document.addEventListener(
    "focusout",
    function () {
      kbBadge.style.display = "none";
    },
    true
  );

  window.addEventListener("scroll", function () {
    if (kbBadge.style.display === "block" && document.activeElement) {
      positionBadge(document.activeElement);
    }
  });

  // restore open/tab state on load
  if (state.open) panel.classList.add("a11y-open");
  if (state.activeTab === "settings") {
    panel.querySelectorAll(".a11y-tab").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-tab") === "settings");
    });
    panel.querySelectorAll(".a11y-tab-panel").forEach(function (p) {
      p.style.display = p.getAttribute("data-panel") === "settings" ? "block" : "none";
    });
  }

  applyState();
})();
