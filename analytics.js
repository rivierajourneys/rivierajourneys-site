/* ============================================================
 * RIVIERA JOURNEYS - analytics.js
 * Last updated: 2026-04-20
 *
 * What this does:
 * 1. Loads Google Analytics 4 (GA4) tracking
 * 2. Auto-tags WhatsApp / mailto / tel links with UTM params
 * 3. Tracks contact_click events when user clicks WhatsApp/email/phone
 * 4. Tracks enquiry_submitted event when user submits the /book form
 *
 * To change Measurement ID: edit GA4_ID below.
 * ============================================================ */

(function() {
  var GA4_ID = 'G-G7VH5DLYWF';

  // ── 1. Load Google Analytics 4 ──────────────────────────────
  var gaScript = document.createElement('script');
  gaScript.async = true;
  gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
  document.head.appendChild(gaScript);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function() { window.dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', GA4_ID, {
    'anonymize_ip': true,
    'page_path': window.location.pathname
  });

  // ── 2. Auto-tag contact links + 3. Track click events ──────
  function setupContactTracking() {
    var pageId = window.location.pathname.replace(/\//g, '-').replace(/^-|-$/g, '') || 'home';

    document.querySelectorAll('a[href^="https://wa.me/"], a[href^="mailto:"], a[href^="tel:"]').forEach(function(a) {
      var href = a.getAttribute('href');
      var linkType = href.indexOf('https://wa.me/') === 0 ? 'whatsapp' :
                     href.indexOf('mailto:') === 0 ? 'email' : 'phone';

      // Add UTM to WhatsApp links so we know which page led to the click
      if (linkType === 'whatsapp' && href.indexOf('utm_') === -1) {
        var sep = href.indexOf('?') !== -1 ? '&' : '?';
        a.setAttribute('href', href + sep + 'utm_source=site&utm_medium=' + linkType + '&utm_campaign=' + pageId);
      }

      // Track the click event in GA4
      a.addEventListener('click', function() {
        if (typeof gtag === 'function') {
          gtag('event', 'contact_click', {
            'contact_method': linkType,
            'page_path': window.location.pathname
          });
        }
      });
    });
  }

  // ── 4. Track form submissions on /book/ ────────────────────
  function setupFormTracking() {
    var bookForm = document.querySelector('form[action*="book"], form#book, form#enquiry, form#bookForm');
    if (bookForm) {
      bookForm.addEventListener('submit', function() {
        if (typeof gtag === 'function') {
          gtag('event', 'enquiry_submitted', {
            'page_path': window.location.pathname,
            'value': 1,
            'currency': 'EUR'
          });
        }
      });
    }
  }

  // Wait for DOM ready, then setup
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setupContactTracking();
      setupFormTracking();
    });
  } else {
    setupContactTracking();
    setupFormTracking();
  }
})();
