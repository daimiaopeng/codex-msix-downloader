import { fetchLatest } from "./parser";
import { Env, FetchConfig, PageData } from "./types";

/**
 * 构建抓取配置对象，优先读取 Cloudflare Worker 环境变量
 */
function getConfig(env: Env): FetchConfig {
  return {
    storeUrl: env.STORE_URL || "https://apps.microsoft.com/detail/9plm9xgg6vks?hl=zh-CN",
    queryType: env.QUERY_TYPE || "url",
    market: env.MARKET || "US",
    ring: env.RING || "RP",
    language: env.LANGUAGE || "zh-CN",
    nameContains: env.NAME_CONTAINS || "OpenAI.Codex",
    arch: env.ARCH || "x64",
    extension: env.EXTENSION || ".msix",
  };
}

/**
 * 渲染精美的现代化响应式 UI Dashboard
 */
function renderHtml(data: PageData): string {
  const file = data.file;
  const error = data.error;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Codex - 面向 Windows 的安装包下载页</title>
  
  <!-- SEO 标准 Meta 标签 -->
  <meta name="description" content="面向 Windows 的 Codex 安装包下载页，实时获取可用版本。提供微软官方 MSIX 包下载与 Cloudflare Worker 代理加密中转。">
  <meta name="keywords" content="Codex, OpenAI Codex, Windows, MSIX, 官方直链, 代理下载">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="https://codex-msix-downloader.daimiaopeng.workers.dev/">

  <!-- Open Graph 社交网络分享卡片 -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="Codex - 面向 Windows 的安装包下载页">
  <meta property="og:description" content="实时获取 OpenAI Codex 微软官方离线安装包 MSIX 官方直链与代理下载服务。">
  <meta property="og:url" content="https://codex-msix-downloader.daimiaopeng.workers.dev/">
  <meta property="og:site_name" content="Codex Downloader">

  <!-- Schema.org 结构化数据 -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Codex",
    "operatingSystem": "Windows 10, Windows 11",
    "applicationCategory": "DeveloperApplication",
    "fileFormat": "application/msix",
    "softwareVersion": "${file ? file.version : "1.0.0"}",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  }
  </script>

  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 1.5rem;
      line-height: 1.5;
      position: relative;
      overflow-x: hidden;
    }

    /* 肉眼可见的灵动弥散光斑动画 */
    .bg-blob-1, .bg-blob-2, .bg-blob-3 {
      position: fixed;
      border-radius: 50%;
      filter: blur(60px);
      z-index: 0;
      pointer-events: none;
    }

    .bg-blob-1 {
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, rgba(147, 197, 253, 0.05) 70%);
      top: -150px;
      left: -150px;
      animation: floatBlob1 8s ease-in-out infinite alternate;
    }

    .bg-blob-2 {
      width: 550px;
      height: 550px;
      background: radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, rgba(224, 231, 255, 0.05) 70%);
      bottom: -180px;
      right: -150px;
      animation: floatBlob2 10s ease-in-out infinite alternate;
    }

    .bg-blob-3 {
      width: 350px;
      height: 350px;
      background: radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, transparent 70%);
      top: 40%;
      left: 30%;
      animation: floatBlob3 12s ease-in-out infinite alternate;
    }

    @keyframes floatBlob1 {
      0% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(120px, 80px) scale(1.15); }
      100% { transform: translate(60px, 160px) scale(0.9); }
    }

    @keyframes floatBlob2 {
      0% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(-140px, -90px) scale(1.2); }
      100% { transform: translate(-70px, -150px) scale(0.85); }
    }

    @keyframes floatBlob3 {
      0% { transform: translate(0, 0); }
      100% { transform: translate(-100px, 80px); }
    }

    /* 主容器：平滑入场动画 */
    .wrapper {
      max-width: 1040px;
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3.5rem;
      align-items: center;
      position: relative;
      z-index: 1;
      animation: fadeInSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes fadeInSlideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* 左侧文字与按钮区 */
    .left-section {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
    .tag-blue {
      color: #2563eb;
      font-weight: 700;
      font-size: 0.95rem;
      margin-bottom: 0.5rem;
    }
    .main-title {
      font-size: 4.25rem;
      font-weight: 900;
      letter-spacing: -0.04em;
      line-height: 1;
      color: #0f172a;
      margin-bottom: 1.25rem;
    }
    .sub-title {
      font-size: 1.15rem;
      color: #64748b;
      line-height: 1.6;
      margin-bottom: 2.25rem;
      max-width: 440px;
    }
    .error-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
      padding: 1rem;
      border-radius: 10px;
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
      width: 100%;
    }
    .action-group {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      flex-wrap: wrap;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      border-radius: 8px;
      font-size: 0.925rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .btn svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }
    .btn-blue {
      background: #2563eb;
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
    }
    .btn-blue:hover {
      background: #1d4ed8;
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35);
    }
    .btn-blue:active {
      transform: translateY(0) scale(0.98);
    }

    .btn-white {
      background: #ffffff;
      color: #0f172a;
      border-color: #cbd5e1;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
    }
    .btn-white:hover {
      background: #f8fafc;
      border-color: #94a3b8;
      transform: translateY(-2px);
    }
    .btn-white:active {
      transform: translateY(0) scale(0.98);
    }

    .btn-text {
      background: transparent;
      color: #64748b;
      padding: 0.75rem 0.5rem;
    }
    .btn-text:hover {
      color: #0f172a;
    }

    /* 右侧卡片区：带毛玻璃与 Hover 上浮 */
    .right-card {
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(226, 232, 240, 0.9);
      border-radius: 20px;
      padding: 2.25rem;
      box-shadow: 0 20px 30px -10px rgba(15, 23, 42, 0.05), 0 10px 15px -5px rgba(15, 23, 42, 0.02);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .right-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 30px 40px -15px rgba(15, 23, 42, 0.08), 0 15px 20px -8px rgba(15, 23, 42, 0.04);
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .label-blue {
      color: #2563eb;
      font-size: 0.875rem;
      font-weight: 600;
    }

    /* 呼吸灯脉冲效果 */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: #dcfce7;
      color: #15803d;
      font-size: 0.8rem;
      font-weight: 700;
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
    }
    .status-dot {
      width: 7px;
      height: 7px;
      background: #16a34a;
      border-radius: 50%;
      box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7);
      animation: pulseDot 2s infinite;
    }

    @keyframes pulseDot {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 6px rgba(22, 163, 74, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(22, 163, 74, 0);
      }
    }

    .version-display {
      font-size: 2.5rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #0f172a;
      margin-bottom: 1rem;
    }
    .filename-box {
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 8px;
      padding: 0.65rem 0.875rem;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 0.8rem;
      color: #334155;
      word-break: break-all;
      margin-bottom: 1.5rem;
    }
    .grid-2x2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.875rem;
      margin-bottom: 1.5rem;
    }
    .grid-box {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 0.875rem 1rem;
      background: #ffffff;
    }
    .box-label {
      font-size: 0.75rem;
      color: #64748b;
      margin-bottom: 0.35rem;
    }
    .box-val {
      font-size: 0.95rem;
      font-weight: 700;
      color: #0f172a;
      word-break: break-all;
    }
    .divider {
      height: 1px;
      background: #e2e8f0;
      margin-bottom: 1.25rem;
    }
    .sha-title {
      color: #16a34a;
      font-size: 0.875rem;
      font-weight: 700;
      margin-bottom: 0.4rem;
    }
    .sha-val {
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 0.775rem;
      color: #64748b;
      word-break: break-all;
    }

    .toast {
      position: fixed;
      bottom: 2rem;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      opacity: 0;
      background: #0f172a;
      color: #ffffff;
      padding: 0.75rem 1.25rem;
      border-radius: 2rem;
      font-size: 0.875rem;
      font-weight: 600;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 1000;
      pointer-events: none;
    }
    .toast.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }

    /* 自适应手机端响应式 */
    @media (max-width: 868px) {
      body {
        padding: 2rem 1rem;
      }
      .wrapper {
        grid-template-columns: 1fr;
        gap: 2.5rem;
      }
      .main-title {
        font-size: 3.25rem;
      }
      .sub-title {
        font-size: 1rem;
        margin-bottom: 1.75rem;
      }
      .action-group {
        width: 100%;
        flex-direction: column;
        align-items: stretch;
      }
      .btn {
        justify-content: center;
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <!-- 动态漂浮的弥散光斑背景 -->
  <div class="bg-blob-1"></div>
  <div class="bg-blob-2"></div>
  <div class="bg-blob-3"></div>

  <main class="wrapper">
    <!-- 左侧区域 -->
    <section class="left-section">
      <div class="tag-blue">Windows 安装包</div>
      <h1 class="main-title">Codex</h1>
      <p class="sub-title">面向 Windows 的 Codex 安装包下载页，实时获取可用版本。</p>

      ${error ? `<div class="error-box">${error}</div>` : ""}

      ${
        file
          ? `
      <div class="action-group">
        <a href="/proxy-download" class="btn btn-blue">
          <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          直接下载安装包
        </a>
        <button class="btn btn-white" onclick="copyDirectUrl('${file.url}')">
          <svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
          复制官方直链
        </button>
        <a href="/api/latest" class="btn btn-text" target="_blank">
          <svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
          查看版本 (JSON)
        </a>
      </div>
      `
          : ""
      }
    </section>

    <!-- 右侧卡片区 -->
    ${
      file
        ? `
    <article class="right-card">
      <div class="card-top">
        <div class="label-blue">最新版本</div>
        <div class="status-badge">
          <span class="status-dot"></span>
          可下载
        </div>
      </div>

      <div class="version-display">${file.version || "未知"}</div>
      <div class="filename-box">${file.name}</div>

      <div class="grid-2x2">
        <div class="grid-box">
          <div class="box-label">架构</div>
          <div class="box-val">${file.arch || "x64"}</div>
        </div>
        <div class="grid-box">
          <div class="box-label">格式</div>
          <div class="box-val">MSIX</div>
        </div>
        <div class="grid-box">
          <div class="box-label">大小</div>
          <div class="box-val">${file.size}</div>
        </div>
        <div class="grid-box">
          <div class="box-label">有效期</div>
          <div class="box-val">${file.expires}</div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="sha-title">SHA1 已验证</div>
      <div class="sha-val">${file.sha1}</div>
    </article>
    `
        : ""
    }
  </main>

  <div id="toast" class="toast">已成功复制直链到剪贴板</div>

  <!-- Cloudflare 官方 Web Analytics 商业统计 -->
  <script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "${data.beaconToken || "fe95d5f462554d1e9af97b1245d30bb4"}"}'></script>

  <script>
    function copyDirectUrl(url) {
      navigator.clipboard.writeText(url).then(() => {
        showToast("已成功复制微软官方直链到剪贴板");
      }).catch(() => {
        prompt("复制直链：", url);
      });
    }

    function showToast(message) {
      const toast = document.getElementById("toast");
      if (!toast) return;
      toast.innerText = message;
      toast.classList.add("show");
      setTimeout(() => {
        toast.classList.remove("show");
      }, 2500);
    }
  </script>
</body>
</html>`;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const config = getConfig(env);

    // 路由: GET /healthz
    if (pathname === "/healthz") {
      return new Response("ok", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // 路由: GET /api/latest
    if (pathname === "/api/latest") {
      try {
        const file = await fetchLatest(config);
        return new Response(JSON.stringify(file, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: err.message || String(err) }, null, 2),
          {
            status: 502,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    // 路由: GET /download (302 重定向到直链)
    if (pathname === "/download") {
      try {
        const file = await fetchLatest(config);
        return Response.redirect(file.url, 302);
      } catch (err: any) {
        return new Response(`获取直链失败: ${err.message || String(err)}`, {
          status: 502,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    }

    // 路由: GET /proxy-download (Worker 代理流式中转下载)
    if (pathname === "/proxy-download") {
      try {
        const file = await fetchLatest(config);

        const cdnResponse = await fetch(file.url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
            "Accept": "application/octet-stream,*/*",
          },
        });

        if (!cdnResponse.ok) {
          return new Response(
            `下载服务器返回 HTTP ${cdnResponse.status}`,
            { status: 502 }
          );
        }

        const headers = new Headers(cdnResponse.headers);
        headers.set("Content-Disposition", `attachment; filename="${file.name}"`);
        headers.set("Cache-Control", "no-store");
        headers.set("X-Content-Type-Options", "nosniff");

        return new Response(cdnResponse.body, {
          status: 200,
          headers,
        });
      } catch (err: any) {
        return new Response(`代理下载失败: ${err.message || String(err)}`, {
          status: 502,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    }

    // 路由: GET / (首页 UI)
    if (pathname === "/") {
      const generatedAt = new Date().toISOString().replace("T", " ").slice(0, 19);
      let pageData: PageData;

      try {
        const file = await fetchLatest(config);
        pageData = { file, error: null, generatedAt, beaconToken: env.CF_BEACON_TOKEN };
      } catch (err: any) {
        let msg = err.message || String(err);
        if (msg.includes("internal error") || msg.includes("challenge") || msg.includes("fetch failed")) {
          msg += " (提示：在本地 wrangler dev 模拟环境下，第三方接口 rg-adguard 会被 Cloudflare 防火墙拦截；部署至 Cloudflare Workers 边缘节点后将正常工作)";
        }
        pageData = { file: null, error: msg, generatedAt, beaconToken: env.CF_BEACON_TOKEN };
      }

      return new Response(renderHtml(pageData), {
        status: pageData.error ? 500 : 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60, s-maxage=3600",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
