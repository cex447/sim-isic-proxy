export default {
  async fetch(request) {
    const url = new URL(request.url);

    const station = (url.searchParams.get("station") || "pc")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");

    const allowedStations = new Set([
      "pc", "sr", "na", "pn", "tb",
      "gr", "mn", "tt", "re"
    ]);

    if (!allowedStations.has(station)) {
      return json(
        {
          ok: false,
          error: "Estación no autorizada",
          station
        },
        400
      );
    }

    const target =
      `https://geotren.fgc.cat/isic/${encodeURIComponent(station)}?_simproxy=${Date.now()}`;

    try {
      const started = Date.now();

      const response = await fetch(target, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 SIM-ISIC-Diagnostic/1.0",
          "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
          "Cache-Control": "no-cache"
        },
        redirect: "follow"
      });

      const text = await response.text();

      const result = {
        ok: response.ok,
        station: station.toUpperCase(),
        target,
        httpStatus: response.status,
        contentType: response.headers.get("content-type"),
        finalUrl: response.url,
        elapsedMs: Date.now() - started,
        bytes: text.length,

        containsVia: /\b(via|vía)\b/i.test(text),
        containsSortint: /\bsortint\b/i.test(text),

        preview: text.slice(0, 5000),

        scripts: [...text.matchAll(
          /<script[^>]+src=["']([^"']+)["']/gi
        )].map(m => m[1]).slice(0, 50),

        links: [...text.matchAll(
          /<link[^>]+href=["']([^"']+)["']/gi
        )].map(m => m[1]).slice(0, 50)
      };

      return json(result);

    } catch (error) {
      return json(
        {
          ok: false,
          station: station.toUpperCase(),
          target,
          error: {
            name: error?.name || "",
            message: error?.message || String(error),
            stack: error?.stack || ""
          }
        },
        502
      );
    }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "https://cex447.github.io",
      "Cache-Control": "no-store"
    }
  });
}
