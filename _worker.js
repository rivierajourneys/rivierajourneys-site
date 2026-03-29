// _worker.js — Riviera Journeys shared nav injection
// Fetches nav.html and replaces <nav id="mainNav"> + <div id="mobileMenu">
// in every HTML response. Update nav.html → all pages update on next deploy.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Pass through all non-GET requests (POST, etc.)
    if (request.method !== 'GET') {
      return env.ASSETS.fetch(request);
    }

    // Fetch the actual page from static assets
    const response = await env.ASSETS.fetch(request);

    // Only process HTML — pass images, CSS, JS, AVIF straight through
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return response;
    }

    // Don't process nav.html itself (avoid infinite loop)
    if (url.pathname === '/nav.html') {
      return response;
    }

    // Fetch nav fragment from static assets
    let navHTML = '';
    try {
      const navUrl = new URL('/nav.html', url.origin);
      const navRes = await env.ASSETS.fetch(new Request(navUrl.toString()));
      navHTML = await navRes.text();
    } catch (e) {
      // If nav.html can't be fetched, return page unchanged
      return response;
    }

    // Split nav fragment into two parts at the mobile-menu div boundary
    const mobileIdx = navHTML.indexOf('<div class="mobile-menu"');
    if (mobileIdx === -1) {
      // nav.html not in expected format — return page unchanged
      return response;
    }
    const navPart    = navHTML.substring(0, mobileIdx).trimEnd();
    const mobilePart = navHTML.substring(mobileIdx).trim();

    // Use HTMLRewriter to swap both elements in the page
    return new HTMLRewriter()
      .on('nav#mainNav', {
        element(el) {
          el.replace(navPart, { html: true });
        }
      })
      .on('div#mobileMenu', {
        element(el) {
          el.replace(mobilePart, { html: true });
        }
      })
      .transform(response);
  }
};
