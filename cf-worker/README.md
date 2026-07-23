# OpenAI Codex MSIX Downloader - Cloudflare Worker (TypeScript 版)

本项目是基于 TypeScript 实现的 **Cloudflare Worker** 版本 OpenAI Codex MSIX 商店安装包下载器。

支持自动抓取微软商店最新的 OpenAI Codex `msix` 官方直链、提供可视化仪表盘、302 自动重定向跳转、JSON API 以及 Cloudflare Worker 代理流式中转下载。

---

## 🌟 接口列表

- `GET /` : 现代化的 UI 仪表盘主页，展示最新版本号、文件大小、SHA-1 校验码及直链失效时间。
- `GET /download` : 302 自动跳转重定向至微软 CDN 直链（适合下载器及 PowerShell 脚本）。
- `GET /proxy-download` : Worker 作为代理流式中转下载文件，避免客户端直连微软 CDN 受限。
- `GET /api/latest` : 返回最新匹配包属性的 JSON API。
- `GET /healthz` : 健康检查接口，返回 `ok`。

---

## 🛠 本地开发与测试

在部署到 Cloudflare 之前，您可以在本地启动 Wrangler 预览测试：

1. **安装依赖**
   ```bash
   cd cf-worker
   npm install
   ```

2. **本地启动开发服务器**
   ```bash
   npm run dev
   ```
   启动后，可在浏览器访问 `http://localhost:8787` 查看效果。

3. **类型检查**
   ```bash
   npm run typecheck
   ```

---

## 🚀 部署至 Cloudflare Workers

1. **登录 Cloudflare 账号**（若未登录过）：
   ```bash
   npx wrangler login
   ```

2. **一键发布上线**：
   ```bash
   npm run deploy
   ```
   或使用：
   ```bash
   npx wrangler deploy
   ```

发布完成后，Cloudflare 会为您生成类似于 `https://codex-msix-downloader.<your-subdomain>.workers.dev` 的默认访问域名。

---

## ⚙ 自定义配置 (环境变量)

您可以编辑 `wrangler.jsonc` 中的 `vars` 字段，或在 Cloudflare 控制台中添加环境变量来调整筛选行为：

| 环境变量 | 默认值 | 描述 |
| :--- | :--- | :--- |
| `STORE_URL` | `https://apps.microsoft.com/detail/9plm9xgg6vks?hl=zh-CN` | 目标微软商店应用链接 |
| `NAME_CONTAINS` | `OpenAI.Codex` | 匹配的文件名包含关键字 |
| `ARCH` | `x64` | 架构过滤 (如 `x64`, `arm64`) |
| `EXTENSION` | `.msix` | 目标包后缀名 (如 `.msix`, `.appxbundle`) |
| `MARKET` | `US` | 商店市场/区域 |
| `RING` | `RP` | 商店通道 (如 `RP`, `Retail`) |
| `LANGUAGE` | `zh-CN` | 响应语言 |

---

## 💻 命令行下载示例

**使用 PowerShell 直接下载最新版本：**
```powershell
Invoke-WebRequest -Uri "https://codex-msix-downloader.<your-subdomain>.workers.dev/download" -OutFile "OpenAI.Codex.msix"
```

**使用 cURL 配合重定向：**
```bash
curl -L -o OpenAI.Codex.msix "https://codex-msix-downloader.<your-subdomain>.workers.dev/download"
```
