const ALLOWED_ORIGIN = "https://cex447.github.io";

const BV_STATIONS = new Set([
  "pc","pr","gr","pm","pd","ep","tb",
  "sg","mn","bn","tt","sr","pf","vl","lp","lf","vd","sc","ms","hg","rb","fn","tr","vp","en","na",
  "vo","sj","bt","un","sq","cf","pj","ct","no","pn",
  "re"
]);

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    const url = new URL(request.url);
    const station = (url.searchParams.get("station") || "pc")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");

    const mode = (url.searchParams.get("mode") || "inspect").toLowerCase();

    if (!BV_STATIONS.has(station)) {
      return json({
        ok: false,
        error: "Estación no autorizada",
        station
      }, 400);
    }

    const target =
      `https://geotren.fgc.cat/isic/${encodeURIComponent(station)}?_simproxy=${Date.now()}`;

    try {
      const started = Date.now();

      const upstream = await fetch(target, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 SIM-ISIC-Proxy/2.0",
          "Accept": "image/png,image/*;q=0.9,*/*;q=0.8",
          "Cache-Control": "no-cache"
        },
        redirect: "follow"
      });

      const contentType = upstream.headers.get("content-type") || "";

      if (mode === "image") {
        const headers = new Headers();
        headers.set("Content-Type", contentType || "image/png");
        headers.set("Cache-Control", "no-store");
        headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
        headers.set("X-SIM-Station", station.toUpperCase());
        headers.set("X-SIM-Upstream-Status", String(upstream.status));
        return new Response(upstream.body, {
          status: upstream.status,
          headers
        });
      }

      const bytes = new Uint8Array(await upstream.arrayBuffer());
      const png = inspectPng(bytes);

      return json({
        ok: upstream.ok,
        station: station.toUpperCase(),
        target,
        mode,
        httpStatus: upstream.status,
        contentType,
        finalUrl: upstream.url,
        elapsedMs: Date.now() - started,
        bytes: bytes.length,
        png,
        imageUrl: `${url.origin}${url.pathname}?station=${encodeURIComponent(station)}&mode=image`
      });

    } catch (error) {
      return json({
        ok: false,
        station: station.toUpperCase(),
        target,
        error: {
          name: error?.name || "",
          message: error?.message || String(error),
          stack: error?.stack || ""
        }
      }, 502);
    }
  }
};

function inspectPng(bytes) {
  const signature = [137,80,78,71,13,10,26,10];
  const isPng = bytes.length >= 24 &&
    signature.every((v, i) => bytes[i] === v);

  if (!isPng) {
    return {
      isPng: false,
      first32Hex: [...bytes.slice(0, 32)]
        .map(b => b.toString(16).padStart(2, "0")).join("")
    };
  }

  const width = readU32(bytes, 16);
  const height = readU32(bytes, 20);
  const chunks = [];
  const textChunks = [];

  let pos = 8;
  let guard = 0;

  while (pos + 12 <= bytes.length && guard++ < 200) {
    const length = readU32(bytes, pos);
    const type = ascii(bytes.slice(pos + 4, pos + 8));
    const dataStart = pos + 8;
    const dataEnd = dataStart + length;
    const next = dataEnd + 4;

    if (dataEnd > bytes.length || next > bytes.length) break;

    chunks.push({ type, length });

    if (type === "tEXt") {
      const raw = ascii(bytes.slice(dataStart, dataEnd));
      textChunks.push({ type, raw: raw.slice(0, 2000) });
    } else if (type === "iTXt") {
      const raw = ascii(bytes.slice(dataStart, dataEnd));
      textChunks.push({ type, raw: raw.slice(0, 2000) });
    } else if (type === "zTXt") {
      const raw = ascii(bytes.slice(dataStart, Math.min(dataEnd, dataStart + 300)));
      textChunks.push({
        type,
        note: "Texto comprimido zTXt; se muestra solo la cabecera sin descomprimir.",
        raw
      });
    }

    pos = next;
    if (type === "IEND") break;
  }

  return {
    isPng: true,
    width,
    height,
    chunkCount: chunks.length,
    chunks,
    textChunks
  };
}

function readU32(bytes, offset) {
  return (
    ((bytes[offset] << 24) >>> 0) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function ascii(bytes) {
  let out = "";
  for (const b of bytes) {
    out += (b >= 32 && b <= 126) ? String.fromCharCode(b) : ".";
  }
  return out;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders()
    }
  });
}
