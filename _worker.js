/**
 * Riviera Journeys — _worker.js
 *
 * Replaces <nav id="mainNav"> on every HTML page with the
 * canonical contents of /nav.html — one file, every page.
 *
 * ─── HOW TO UPDATE THE NAV ───────────────────────────────
 * Edit /nav.html in the repo root → commit → done.
 * Every page on the site updates automatically.
 * ─────────────────────────────────────────────────────────
 */

export default {
  async fetch(request, env) {

    // 1. Fetch the original response from static assets
    const response = await env.ASSETS.fetch(request);

    // 2. Skip non-HTML (images, CSS, JS, etc.)
    const ct = response.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return response;

    // 3. Fetch /nav.html (same origin, served from ASSETS)
    const navUrl = new URL('/nav.html', request.url).toString();
    let navHtml = '';
    try {
      const navRes = await env.ASSETS.fetch(new Request(navUrl));
      if (navRes.ok) navHtml = await navRes.text();
    } catch (_) {}

    // 4. If nav.html is missing or empty, serve page unchanged
    if (!navHtml.trim()) return response;

    // 5. Replace <nav id="mainNav">…</nav> with nav.html content
    return new HTMLRewriter()
      .on('nav#mainNav', new NavReplacer(navHtml))
      .transform(response);
  }
};

class NavReplacer {
  constructor(html) { this.html = html; this.done = false; }
  element(el) {
    if (this.done) return;
    el.replace(this.html, { html: true });
    this.done = true;
  }
}
