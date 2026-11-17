#!/usr/bin/env node
/**
 * out/ ফোল্ডারের স্ট্যাটিক ফাইল সার্ভ করে (Next-এর `next start`-এর বিকল্প)।
 * ডিফল্ট: /login → login.html, /contacts/view?id=x → contacts/view.html
 * ব্যবহার: node scripts/serve-static.cjs [port]
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "out");
const port = Number(process.argv[2]) || Number(process.env.PORT) || 3000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function send(res, status, filePath) {
  res.writeHead(status, {
    "Content-Type": TYPES[path.extname(filePath)] || "application/octet-stream",
    "Cache-Control": filePath.includes(`${path.sep}_next${path.sep}static`)
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }

  const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const candidates = safe.endsWith("/")
    ? [path.join(root, safe, "index.html")]
    : [
        path.join(root, safe),
        path.join(root, safe + ".html"),
        path.join(root, safe, "index.html"),
      ];

  for (const candidate of candidates) {
    if (!candidate.startsWith(root)) continue;
    try {
      if (fs.statSync(candidate).isFile()) {
        send(res, 200, candidate);
        return;
      }
    } catch {
      /* পরেরটা চেষ্টা */
    }
  }

  const notFound = path.join(root, "404.html");
  if (fs.existsSync(notFound)) send(res, 404, notFound);
  else res.writeHead(404, { "Content-Type": "text/plain" }).end("404");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`  ▲ স্ট্যাটিক সার্ভার চালু: http://localhost:${port}`);
});
