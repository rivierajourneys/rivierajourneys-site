// _worker.js - Riviera Journeys
// Appends nav.js to every HTML page. Edit nav.js to update the menu site-wide.

export default {
  async fetch(request, env) {
    if (request.method !== "GET") return env.ASSETS.fetch(request);

    const response = await env.ASSETS.fetch(request);
    const ct = response.headers.get("content-type") || "";
    if (!ct.includes("text/html")) return response;

    const rewritten = new HTMLRewriter()
      .on("body", {
        element(el) {
          el.append('<script src="/nav.js"><\/script>', { html: true });
        }
      })
      .transform(response);

    const final = new Response(rewritten.body, {
      status: rewritten.status,
      statusText: rewritten.statusText,
      headers: new Headers(rewritten.headers)
    });
    final.headers.set("Cache-Control", "no-store");
    return final;
  }
};
