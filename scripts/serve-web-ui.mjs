import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, normalize } from "node:path";

const root = join(process.cwd(), "apps/web/public");
const port = Number(process.env.UI_TEST_PORT ?? "4173");

const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);

const server = createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
  const requestedPath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  let safePath = normalize(join(root, requestedPath));
  if (!safePath.startsWith(root)) {
    response.statusCode = 404;
    response.end("Not found");
    return;
  }
  if (!existsSync(safePath) || !statSync(safePath).isFile()) {
    if (requestedPath.includes(".")) {
      response.statusCode = 404;
      response.end("Not found");
      return;
    }
    safePath = join(root, "index.html");
  }
  const extension = safePath.slice(safePath.lastIndexOf("."));
  response.setHeader("content-type", mime.get(extension) ?? "application/octet-stream");
  createReadStream(safePath).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write("Phoenix UI test server listening on http://127.0.0.1:" + port + "\n");
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
