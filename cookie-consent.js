/* ============================================================
 * RIVIERA JOURNEYS — cookie-consent.js
 *
 * Last updated: 2026-08-18
 *
 * 2026-08-18 changes (Week-0, site workplan):
 *   8. "Came from" hidden field — document.referrer rides along with
 *      each enquiry, so /book submissions show the page (or search
 *      engine) that led to the form, not only /book itself.
 *   9. Cloudflare Web Analytics beacon — cookieless, consent-exempt,
 *      loads for every visitor regardless of the GA4 consent choice.
 *      Fills the traffic blind spot left by consent-gated GA4.
 *      Requires CF_BEACON_TOKEN below (Dashboard -> Web Analytics).
 *
 * Single source of truth for analytics + consent:
 *   1. Implements Google Consent Mode v2 (default: denied — CNIL safe)
 *   2. Renders an editorial-style consent strip (paper/terra brand voice)
 *   3. Stores user choice in localStorage for 6 months
 *   4. Loads GA4 (G-G7VH5DLYWF) ONLY after explicit consent
 *   5. Auto-tags WhatsApp / mailto / tel links and tracks contact_click
 *   6. Tracks enquiry_submitted on /book forms
 *   7. Stamps each enquiry with its origin page ("Source page" hidden field)
 *
 * Replaces:
 *   - inline GA4 snippet in <head> of all pages
 *   - standalone /analytics.js (deprecated)
 *
 * To revoke consent the user can call window.rjResetConsent() from console.
 * ============================================================ */

(function () {
  var GA4_ID = 'G-G7VH5DLYWF';
  // Cloudflare Web Analytics site token. Create the site under
  // Cloudflare Dashboard -> Analytics & Logs -> Web Analytics, copy the
  // token from the JS snippet and paste it here. Loader below is inert
  // until the placeholder is replaced, so deploying first is safe.
  var CF_BEACON_TOKEN = 'REPLACE_WITH_CF_BEACON_TOKEN';
  var STORAGE_KEY = 'rj_consent_v1';
  var STORAGE_TTL_DAYS = 180;

  // ─────────────────────────────────────────────────────────────────
  // 1. Consent Mode v2 — set defaults BEFORE any GA snippet loads
  // ─────────────────────────────────────────────────────────────────
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  gtag('consent', 'default', {
    'ad_storage':            'denied',
    'ad_user_data':          'denied',
    'ad_personalization':    'denied',
    'analytics_storage':     'denied',
    'functionality_storage': 'granted',
    'security_storage':      'granted',
    'wait_for_update':       500
  });

  // ─────────────────────────────────────────────────────────────────
  // 2. State helpers
  // ─────────────────────────────────────────────────────────────────
  function readState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed.ts) return null;
      var ageDays = (Date.now() - parsed.ts) / 86400000;
      if (ageDays > STORAGE_TTL_DAYS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeState(decision) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        decision: decision,        // 'accepted' | 'declined'
        ts: Date.now(),
        version: 1
      }));
    } catch (e) { /* private mode etc — silent fail */ }
  }

  // ─────────────────────────────────────────────────────────────────
  // 3. Load GA4 (only invoked after consent === accepted)
  // ─────────────────────────────────────────────────────────────────
  var ga4Loaded = false;
  function loadGA4() {
    if (ga4Loaded) return;
    ga4Loaded = true;

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(s);

    gtag('js', new Date());
    gtag('config', GA4_ID, {
      'anonymize_ip': true,
      'page_path': window.location.pathname
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // 4. Apply a decision (used by both UI and stored state)
  // ─────────────────────────────────────────────────────────────────
  function applyAccepted() {
    gtag('consent', 'update', {
      'analytics_storage': 'granted'
    });
    loadGA4();
  }
  function applyDeclined() {
    // defaults already deny everything — nothing to do
  }

  // ─────────────────────────────────────────────────────────────────
  // 5. Contact-link tracking — works regardless of consent
  //    (gtag calls are queued; only sent if consent granted)
  // ─────────────────────────────────────────────────────────────────
  // Cloudflare Web Analytics — cookieless beacon, no consent required
  // (no cookies, no localStorage, no fingerprinting). Loads always, so
  // traffic is measured even for the majority who never accept GA4.
  function loadCfBeacon() {
    if (CF_BEACON_TOKEN.indexOf('REPLACE') === 0) return; // token not set yet
    if (document.querySelector('script[data-cf-beacon]')) return;
    var s = document.createElement('script');
    s.defer = true;
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', '{"token": "' + CF_BEACON_TOKEN + '"}');
    document.head.appendChild(s);
  }

  function setupContactTracking() {
    var pageId = window.location.pathname.replace(/\//g, '-').replace(/^-|-$/g, '') || 'home';

    // UTM-tag WhatsApp links so attribution survives the redirect.
    // Re-runs as nav.js injects the nav/footer, so dynamically added links are covered.
    function utmTag(a) {
      var href = a.getAttribute('href');
      if (href && href.indexOf('https://wa.me/') === 0 && href.indexOf('utm_') === -1) {
        var sep = href.indexOf('?') !== -1 ? '&' : '?';
        a.setAttribute('href', href + sep + 'utm_source=site&utm_medium=whatsapp&utm_campaign=' + pageId);
      }
    }
    function tagAll() { document.querySelectorAll('a[href^="https://wa.me/"]').forEach(utmTag); }
    tagAll();
    if (window.MutationObserver) {
      try {
        new MutationObserver(tagAll).observe(document.body, { childList: true, subtree: true });
      } catch (e) { /* noop */ }
    }

    // Delegated click tracking — catches current AND future contact links
    // (header/footer are injected by nav.js after this script boots).
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[href^="https://wa.me/"], a[href^="mailto:"], a[href^="tel:"]');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      var linkType = href.indexOf('https://wa.me/') === 0 ? 'whatsapp'
                   : href.indexOf('mailto:') === 0 ? 'email'
                   : 'phone';
      gtag('event', 'contact_click', {
        'contact_method': linkType,
        'page_path': window.location.pathname
      });
    }, true);
  }

  function setupFormTracking() {
    var bookForm = document.querySelector('form#form, form[action*="formspree"], form[action*="book"], form#book, form#enquiry, form#bookForm');
    if (bookForm) {
      // Capture the page a form was submitted from — Playbook v1.1 §8.4.
      // Hidden field rides along in the Formspree submission so each enquiry
      // shows its origin page (sharpens triage + which-page-converts insight).
      if (!bookForm.querySelector('input[name="Source page"]')) {
        var srcField = document.createElement('input');
        srcField.type = 'hidden';
        srcField.name = 'Source page';
        srcField.value = window.location.href;
        bookForm.appendChild(srcField);
      }

      // Referrer capture — Week-0 workplan, 2026-08-18. On /book the
      // "Source page" field only shows /book?service=..., which loses
      // the content page (or search engine) the visitor came from.
      if (!bookForm.querySelector('input[name="Came from"]')) {
        var refField = document.createElement('input');
        refField.type = 'hidden';
        refField.name = 'Came from';
        refField.value = document.referrer || 'direct / none';
        bookForm.appendChild(refField);
      }

      bookForm.addEventListener('submit', function () {
        gtag('event', 'enquiry_submitted', {
          'page_path': window.location.pathname,
          'value': 1,
          'currency': 'EUR'
        });
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // 6. Render consent strip
  // ─────────────────────────────────────────────────────────────────
  function renderConsentUI() {
    if (document.getElementById('rj-consent')) return; // idempotent

    // Inject minimal stylesheet (scoped to #rj-consent)
    var style = document.createElement('style');
    style.id = 'rj-consent-styles';
    style.textContent = ''
      + '#rj-consent{position:fixed;left:24px;right:24px;bottom:24px;z-index:9000;'
      +   'max-width:560px;margin:0 auto;background:#FDFAF6;color:#1C1C1A;'
      +   'border:.5px solid #D4CDBA;box-shadow:0 12px 48px -12px rgba(28,28,26,.18);'
      +   'padding:28px 32px;'
      +   'transform:translateY(140%);transition:transform .55s cubic-bezier(.16,1,.3,1);'
      +   'cursor:auto}'
      + '#rj-consent.is-visible{transform:translateY(0)}'
      + '#rj-consent .rj-c-rubric{font-family:"Jost",-apple-system,sans-serif;'
      +   'font-size:9px;font-weight:500;letter-spacing:.28em;text-transform:uppercase;'
      +   'color:#A86543;margin-bottom:14px}'
      + '#rj-consent .rj-c-headline{font-family:"Cormorant Garamond",Georgia,serif;'
      +   'font-weight:500;font-size:22px;line-height:1.25;color:#1C1C1A;'
      +   'margin-bottom:10px;letter-spacing:-.01em}'
      + '#rj-consent .rj-c-body{font-family:"Newsreader",Georgia,serif;'
      +   'font-weight:400;font-size:14px;line-height:1.65;color:#3D3D38;'
      +   'margin-bottom:20px}'
      + '#rj-consent .rj-c-body a{color:#A86543;border-bottom:.5px solid #A86543;'
      +   'padding-bottom:1px;text-decoration:none}'
      + '#rj-consent .rj-c-body a:hover{opacity:.7}'
      + '#rj-consent .rj-c-actions{display:flex;align-items:center;gap:24px;flex-wrap:wrap}'
      + '#rj-consent .rj-c-btn{font-family:"Jost",sans-serif;font-size:10.5px;font-weight:500;'
      +   'letter-spacing:.22em;text-transform:uppercase;cursor:pointer;'
      +   'transition:opacity .3s,background .3s,color .3s}'
      + '#rj-consent .rj-c-btn--accept{background:#A86543;color:#FDFAF6;'
      +   'border:none;padding:13px 26px;display:inline-flex;align-items:center;gap:10px}'
      + '#rj-consent .rj-c-btn--accept:hover{background:#8E5234}'
      + '#rj-consent .rj-c-btn--accept svg{width:12px;height:12px;stroke:currentColor;'
      +   'fill:none;stroke-width:1.5;transition:transform .3s}'
      + '#rj-consent .rj-c-btn--accept:hover svg{transform:translateX(3px)}'
      + '#rj-consent .rj-c-btn--decline{background:transparent;border:none;'
      +   'color:#8C8880;border-bottom:.5px solid transparent;padding:0 0 2px 0}'
      + '#rj-consent .rj-c-btn--decline:hover{color:#1C1C1A;border-bottom-color:#1C1C1A}'
      + '@media (max-width:560px){'
      +   '#rj-consent{left:16px;right:16px;bottom:16px;padding:24px 22px}'
      +   '#rj-consent .rj-c-headline{font-size:19px}'
      +   '#rj-consent .rj-c-body{font-size:13px}'
      +   '#rj-consent .rj-c-actions{gap:18px}'
      +   '#rj-consent .rj-c-btn--accept{padding:12px 22px;font-size:10px}'
      + '}';
    document.head.appendChild(style);

    var el = document.createElement('aside');
    el.id = 'rj-consent';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Privacy preferences');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = ''
      + '<div class="rj-c-rubric">A note on measurement</div>'
      + '<div class="rj-c-headline">We measure which essays are read. Nothing more.</div>'
      + '<div class="rj-c-body">Google Analytics tells us which pages travellers actually finish — so we know what to write next. No advertising, no profiling, no resale. Read the <a href="/legal#cookies">full notice</a>.</div>'
      + '<div class="rj-c-actions">'
      +   '<button type="button" class="rj-c-btn rj-c-btn--accept" data-rj-consent="accept">'
      +     '<span>Allow measurement</span>'
      +     '<svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>'
      +   '</button>'
      +   '<button type="button" class="rj-c-btn rj-c-btn--decline" data-rj-consent="decline">Decline</button>'
      + '</div>';
    document.body.appendChild(el);

    // Animate in after DOM paints
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add('is-visible'); });
    });

    el.querySelector('[data-rj-consent="accept"]').addEventListener('click', function () {
      writeState('accepted');
      applyAccepted();
      dismissConsentUI();
    });
    el.querySelector('[data-rj-consent="decline"]').addEventListener('click', function () {
      writeState('declined');
      applyDeclined();
      dismissConsentUI();
    });
  }

  function dismissConsentUI() {
    var el = document.getElementById('rj-consent');
    if (!el) return;
    el.classList.remove('is-visible');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 600);
  }

  // ─────────────────────────────────────────────────────────────────
  // 7. Boot
  // ─────────────────────────────────────────────────────────────────
  function boot() {
    var state = readState();
    if (state && state.decision === 'accepted') {
      applyAccepted();
    } else if (state && state.decision === 'declined') {
      applyDeclined();
    } else {
      renderConsentUI();
    }
    loadCfBeacon();
    setupContactTracking();
    setupFormTracking();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Public hook for revoking consent (e.g. linked from /legal)
  window.rjResetConsent = function () {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    location.reload();
  };
})();
