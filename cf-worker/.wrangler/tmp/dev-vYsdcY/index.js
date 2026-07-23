var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-l3iYZe/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-l3iYZe/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/parser.ts
var API_URL = "https://store.rg-adguard.net/api/GetFiles";
function decodeHTMLEntities(str) {
  return str.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}
__name(decodeHTMLEntities, "decodeHTMLEntities");
function cleanCell(cellHtml) {
  const withoutTags = cellHtml.replace(/<[^>]+>/gi, "");
  const decoded = decodeHTMLEntities(withoutTags);
  return decoded.replace(/\s+/g, " ").trim();
}
__name(cleanCell, "cleanCell");
function parseVersion(name) {
  const match = name.match(/_([0-9]+(?:\.[0-9]+){1,})_/);
  return match ? match[1] : "";
}
__name(parseVersion, "parseVersion");
function parseArch(name) {
  const match = name.match(/_([A-Za-z0-9]+)__/);
  return match ? match[1] : "";
}
__name(parseArch, "parseArch");
function versionParts(version) {
  if (!version)
    return [];
  return version.split(".").map((part) => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
}
__name(versionParts, "versionParts");
function compareVersionParts(left, right) {
  const maxLength = Math.max(left.length, right.length);
  for (let i = 0; i < maxLength; i++) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l > r)
      return 1;
    if (l < r)
      return -1;
  }
  return 0;
}
__name(compareVersionParts, "compareVersionParts");
function parseSizeBytes(sizeStr) {
  const match = sizeStr.match(/([0-9]+(?:\.[0-9]+)?)\s*([KMGT]?B)/i);
  if (!match)
    return 0;
  const val = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const scaleMap = {
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024
  };
  return val * (scaleMap[unit] ?? 1);
}
__name(parseSizeBytes, "parseSizeBytes");
async function fetchStoreHtml(config) {
  const bodyParams = new URLSearchParams({
    type: config.queryType,
    url: config.storeUrl,
    gl: config.market,
    ring: config.ring,
    lang: config.language
  });
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Encoding": "identity",
      "Accept-Language": `${config.language},zh;q=0.9,en;q=0.8`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Origin": "https://store.rg-adguard.net",
      "Referer": "https://store.rg-adguard.net/",
      "Sec-Ch-Ua": '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"
    },
    body: bodyParams.toString()
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`rg-adguard returned HTTP ${response.status}: ${errorText.slice(0, 240)}`);
  }
  return await response.text();
}
__name(fetchStoreHtml, "fetchStoreHtml");
function parseStoreFiles(pageHtml) {
  if (pageHtml.includes("Just a moment") && pageHtml.includes("challenge-platform")) {
    throw new Error("Request was blocked by Cloudflare challenge");
  }
  const rowRegex = /<tr[^>]*>\s*<td>\s*<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>\s*<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<\/tr>/gis;
  const files = [];
  let match;
  while ((match = rowRegex.exec(pageHtml)) !== null) {
    const href = decodeHTMLEntities(match[1]);
    const rawName = match[2];
    const rawExpires = match[3];
    const rawSha1 = match[4];
    const rawSize = match[5];
    const name = cleanCell(rawName);
    files.push({
      name,
      url: href,
      expires: cleanCell(rawExpires),
      sha1: cleanCell(rawSha1),
      size: cleanCell(rawSize),
      version: parseVersion(name),
      arch: parseArch(name)
    });
  }
  return files;
}
__name(parseStoreFiles, "parseStoreFiles");
function filterFiles(files, config) {
  const needle = config.nameContains.toLowerCase();
  const extension = config.extension.toLowerCase();
  const archMarker = `_${config.arch.toLowerCase()}_`;
  const matches = files.filter((file) => {
    const lowerName = file.name.toLowerCase();
    return lowerName.includes(needle) && lowerName.endsWith(extension) && lowerName.includes(archMarker);
  });
  matches.sort((a, b) => {
    const versionCmp = compareVersionParts(
      versionParts(a.version),
      versionParts(b.version)
    );
    if (versionCmp !== 0) {
      return -versionCmp;
    }
    return parseSizeBytes(b.size) - parseSizeBytes(a.size);
  });
  return matches;
}
__name(filterFiles, "filterFiles");
async function fetchLatest(config) {
  const html = await fetchStoreHtml(config);
  const files = parseStoreFiles(html);
  const matchedFiles = filterFiles(files, config);
  if (matchedFiles.length === 0) {
    throw new Error(
      `No ${config.arch} ${config.extension} package matched in ${files.length} parsed files`
    );
  }
  return matchedFiles[0];
}
__name(fetchLatest, "fetchLatest");

// src/index.ts
function getConfig(env) {
  return {
    storeUrl: env.STORE_URL || "https://apps.microsoft.com/detail/9plm9xgg6vks?hl=zh-CN",
    queryType: env.QUERY_TYPE || "url",
    market: env.MARKET || "US",
    ring: env.RING || "RP",
    language: env.LANGUAGE || "zh-CN",
    nameContains: env.NAME_CONTAINS || "OpenAI.Codex",
    arch: env.ARCH || "x64",
    extension: env.EXTENSION || ".msix"
  };
}
__name(getConfig, "getConfig");
function renderHtml(data) {
  const file = data.file;
  const error = data.error;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenAI Codex MSIX \u76F4\u94FE\u4E0B\u8F7D\u5668 - Cloudflare Worker</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
      --card-bg: rgba(30, 41, 59, 0.7);
      --card-border: rgba(255, 255, 255, 0.1);
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --primary-glow: rgba(99, 102, 241, 0.35);
      --accent: #10b981;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --danger: #ef4444;
      --code-bg: #0f172a;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--bg-gradient);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }

    .container {
      width: 100%;
      max-width: 680px;
    }

    .card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 1.25rem;
      padding: 2rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    }

    .header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .logo-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      border-radius: 1rem;
      box-shadow: 0 0 20px var(--primary-glow);
      margin-bottom: 1rem;
    }

    .logo-badge svg {
      width: 32px;
      height: 32px;
      fill: #fff;
    }

    h1 {
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.025em;
      margin-bottom: 0.5rem;
      background: linear-gradient(to right, #ffffff, #cbd5e1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      color: var(--text-muted);
      font-size: 0.95rem;
    }

    .error-box {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: var(--danger);
      padding: 1rem;
      border-radius: 0.75rem;
      font-size: 0.9rem;
      margin-bottom: 1.5rem;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    @media (max-width: 480px) {
      .meta-grid {
        grid-template-columns: 1fr;
      }
    }

    .meta-item {
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.05);
      padding: 0.875rem 1rem;
      border-radius: 0.75rem;
    }

    .meta-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 0.25rem;
    }

    .meta-value {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-main);
      word-break: break-all;
    }

    .badge-ver {
      display: inline-block;
      background: rgba(16, 185, 129, 0.15);
      color: var(--accent);
      padding: 0.15rem 0.5rem;
      border-radius: 0.375rem;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.875rem 1.25rem;
      border-radius: 0.75rem;
      font-size: 0.95rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
      border: none;
    }

    .btn-primary {
      background: var(--primary);
      color: #fff;
      box-shadow: 0 4px 12px var(--primary-glow);
    }

    .btn-primary:hover {
      background: var(--primary-hover);
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-main);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
      transform: translateY(-1px);
    }

    .code-section {
      background: var(--code-bg);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 0.75rem;
      padding: 1rem;
      margin-top: 1rem;
    }

    .code-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }

    .code-block {
      font-family: monospace;
      font-size: 0.85rem;
      color: #a5b4fc;
      overflow-x: auto;
      white-space: nowrap;
    }

    .footer {
      text-align: center;
      margin-top: 1.5rem;
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .footer a {
      color: var(--text-muted);
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo-badge">
          <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        </div>
        <h1>OpenAI Codex \u4E0B\u8F7D\u5668</h1>
        <p class="subtitle">\u90E8\u7F72\u4E8E Cloudflare Workers \u7684 Microsoft Store \u76F4\u94FE\u83B7\u53D6\u4E0E\u4EE3\u7406\u670D\u52A1</p>
      </div>

      ${error ? `<div class="error-box">\u26A0\uFE0F \u83B7\u53D6\u5931\u8D25: ${error}</div>` : ""}

      ${file ? `
      <div class="meta-grid">
        <div class="meta-item">
          <div class="meta-label">\u6700\u65B0\u7248\u672C</div>
          <div class="meta-value"><span class="badge-ver">${file.version || "\u672A\u77E5"}</span></div>
        </div>
        <div class="meta-item">
          <div class="meta-label">\u6587\u4EF6\u5927\u5C0F / \u67B6\u6784</div>
          <div class="meta-value">${file.size} (${file.arch || "x64"})</div>
        </div>
        <div class="meta-item" style="grid-column: span 2;">
          <div class="meta-label">\u6587\u4EF6\u5305\u5168\u540D</div>
          <div class="meta-value" style="font-size: 0.85rem; font-family: monospace;">${file.name}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">SHA-1 \u6821\u9A8C\u7801</div>
          <div class="meta-value" style="font-size: 0.8rem; font-family: monospace;">${file.sha1}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">\u76F4\u94FE\u5931\u6548\u65F6\u95F4</div>
          <div class="meta-value">${file.expires}</div>
        </div>
      </div>

      <div class="actions">
        <a href="/download" class="btn btn-primary" target="_blank">
          \u{1F680} 302 \u76F4\u94FE\u8DF3\u8F6C\u4E0B\u8F7D
        </a>
        <a href="/proxy-download" class="btn btn-secondary">
          \u26A1 CF Worker \u4E2D\u8F6C\u4EE3\u7406\u4E0B\u8F7D
        </a>
        <a href="/api/latest" class="btn btn-secondary" target="_blank">
          \u{1F50C} \u67E5\u770B JSON API \u63A5\u53E3
        </a>
      </div>

      <div class="code-section">
        <div class="code-header">
          <span>PowerShell \u547D\u4EE4\u884C\u4E00\u952E\u4E0B\u8F7D</span>
        </div>
        <div class="code-block">Invoke-WebRequest -Uri "https://&lt;your-worker&gt;.workers.dev/download" -OutFile "OpenAI.Codex.msix"</div>
      </div>
      ` : ""}
    </div>

    <div class="footer">
      \u751F\u6210\u65F6\u95F4: ${data.generatedAt} UTC | Powered by Cloudflare Workers
    </div>
  </div>
</body>
</html>`;
}
__name(renderHtml, "renderHtml");
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const config = getConfig(env);
    if (pathname === "/healthz") {
      return new Response("ok", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
    if (pathname === "/api/latest") {
      try {
        const file = await fetchLatest(config);
        return new Response(JSON.stringify(file, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*"
          }
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: err.message || String(err) }, null, 2),
          {
            status: 502,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );
      }
    }
    if (pathname === "/download") {
      try {
        const file = await fetchLatest(config);
        return Response.redirect(file.url, 302);
      } catch (err) {
        return new Response(`\u83B7\u53D6\u76F4\u94FE\u5931\u8D25: ${err.message || String(err)}`, {
          status: 502,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    }
    if (pathname === "/proxy-download") {
      try {
        const file = await fetchLatest(config);
        const cdnResponse = await fetch(file.url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
            "Accept": "application/octet-stream,*/*"
          }
        });
        if (!cdnResponse.ok) {
          return new Response(
            `\u4E0B\u8F7D\u670D\u52A1\u5668\u8FD4\u56DE HTTP ${cdnResponse.status}`,
            { status: 502 }
          );
        }
        const headers = new Headers(cdnResponse.headers);
        headers.set("Content-Disposition", `attachment; filename="${file.name}"`);
        headers.set("Cache-Control", "no-store");
        headers.set("X-Content-Type-Options", "nosniff");
        return new Response(cdnResponse.body, {
          status: 200,
          headers
        });
      } catch (err) {
        return new Response(`\u4EE3\u7406\u4E0B\u8F7D\u5931\u8D25: ${err.message || String(err)}`, {
          status: 502,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    }
    if (pathname === "/") {
      const generatedAt = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 19);
      let pageData;
      try {
        const file = await fetchLatest(config);
        pageData = { file, error: null, generatedAt };
      } catch (err) {
        pageData = { file: null, error: err.message || String(err), generatedAt };
      }
      return new Response(renderHtml(pageData), {
        status: pageData.error ? 500 : 200,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }
    return new Response("Not Found", { status: 404 });
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-l3iYZe/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-l3iYZe/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
