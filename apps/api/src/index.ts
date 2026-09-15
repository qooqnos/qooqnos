export interface ApiEnv {
  readonly APP_VERSION?: string;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });

const html = (body: string, status = 200): Response =>
  new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const homePage = (version: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Qooqnos — Phoenix AI Marketplace" />
    <title>Qooqnos — Phoenix AI Marketplace</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: #080b12; color: #f5f7fb; }
      main { width: min(960px, calc(100% - 40px)); margin: 0 auto; padding: 96px 0; }
      .badge { display: inline-block; padding: 7px 12px; border: 1px solid #293246; border-radius: 999px; color: #aeb9ce; font-size: 13px; }
      h1 { max-width: 760px; margin: 24px 0 16px; font-size: clamp(44px, 8vw, 76px); line-height: .98; letter-spacing: -.04em; }
      p { max-width: 680px; color: #aeb9ce; font-size: 18px; line-height: 1.7; }
      .actions { display: flex; gap: 12px; margin-top: 32px; flex-wrap: wrap; }
      a { display: inline-block; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 650; }
      .primary { background: #f5f7fb; color: #080b12; }
      .secondary { border: 1px solid #293246; color: #f5f7fb; }
      footer { margin-top: 80px; color: #66738b; font-size: 13px; }
    </style>
  </head>
  <body>
    <main>
      <span class="badge">Phoenix AI Marketplace</span>
      <h1>Qooqnos is coming to life.</h1>
      <p>
        The Phoenix platform foundation is online. This deployment currently exposes
        the API boundary and its health/readiness services while the marketplace
        experience is being built.
      </p>
      <div class="actions">
        <a class="primary" href="/health">System health</a>
        <a class="secondary" href="/ready">Readiness</a>
      </div>
      <footer>Qooqnos · Phoenix · v${version}</footer>
    </main>
  </body>
</html>`;

export default {
  async fetch(request: Request, env: ApiEnv): Promise<Response> {
    const url = new URL(request.url);
    const version = env.APP_VERSION ?? "development";

    if (request.method === "GET" && url.pathname === "/") {
      return html(homePage(version));
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version,
      });
    }

    if (request.method === "GET" && url.pathname === "/ready") {
      return json({
        status: "ready",
        timestamp: new Date().toISOString(),
      });
    }

    return json(
      {
        error: "not_found",
        message: "Route not found",
      },
      404,
    );
  },
};
