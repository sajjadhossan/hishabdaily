/**
 * Cloudflare Pages — RSC payload fix for the Next.js App Router static export.
 *
 * `next build` with `output: export` writes, for every route, a sibling `.txt`
 * file containing the React Server Component payload used by client-side
 * navigation (e.g. /dashboard -> /dashboard.txt).
 *
 * Plain Cloudflare Pages static hosting serves those `.txt` files as
 * `text/plain`. Next.js 15 fetches e.g. `/dashboard.txt` with RSC headers and
 * requires `text/x-component`; on `text/plain` client navigation breaks and the
 * raw payload can surface in the browser. Vercel serves the same request with
 * `text/x-component`, which is why the same build works there. Cloudflare does
 * not apply that rewrite here because this project deploys via Direct Upload
 * (no Next.js framework preset).
 *
 * This worker:
 *   1. serves the matching `.txt` asset with `text/x-component` for RSC requests;
 *   2. redirects accidental top-level visits to a `.txt` URL back to the real page;
 *   3. forwards every other request to Pages' static asset server unchanged.
 */

const RSC_HEADER = "rsc";
const RSC_ACCEPT = "text/x-component";
const RSC_CONTENT_TYPE = "text/x-component";

function wantsRsc(request) {
  if (request.headers.get(RSC_HEADER) === "1") return true;
  return (request.headers.get("accept") || "").includes(RSC_ACCEPT);
}

function payloadPath(pathname) {
  // Next.js 15 static export fetches the payload at "/<route>.txt" directly.
  // RSC-header form "/<route>" also occurs — normalize both to the .txt asset.
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean.endsWith(".txt")) return clean;
  return clean === "/" ? "/index.txt" : `${clean}.txt`;
}

function isTopLevelNavigation(request) {
  return request.headers.get("sec-fetch-mode") === "navigate";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // RSC requests take priority: Next.js fetches "/<route>.txt" with these
    // headers. They must receive the flight payload, never a redirect.
    if (wantsRsc(request)) {
      const assetUrl = new URL(payloadPath(url.pathname), url.origin);
      assetUrl.search = url.search;

      // Ask the asset server for a plain file, without the RSC routing headers.
      const headers = new Headers(request.headers);
      headers.delete(RSC_HEADER);
      headers.delete("next-router-state-tree");
      headers.delete("next-router-prefetch");
      headers.delete("next-router-segment-prefetch");
      headers.set("accept", "*/*");

      try {
        const asset = await env.ASSETS.fetch(
          new Request(assetUrl.toString(), { method: "GET", headers }),
        );
        if (asset.ok) {
          const out = new Headers(asset.headers);
          out.set("Content-Type", RSC_CONTENT_TYPE);
          out.set(
            "Vary",
            "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch",
          );
          return new Response(asset.body, {
            status: asset.status,
            statusText: asset.statusText,
            headers: out,
          });
        }
      } catch {
        // Fall through to the checks below.
      }
    }

    // A `.txt` payload opened directly in the address bar would be shown as
    // raw `text/plain` — send the visitor back to the real HTML page instead.
    if (
      url.pathname.endsWith(".txt") &&
      url.pathname !== "/robots.txt" &&
      isTopLevelNavigation(request)
    ) {
      const page = url.pathname.slice(0, -".txt".length) || "/";
      return Response.redirect(new URL(page + url.search, url.origin).toString(), 302);
    }

    // Everything else — HTML, JS, CSS, images, fonts — is served as before.
    return env.ASSETS.fetch(request);
  },
};
