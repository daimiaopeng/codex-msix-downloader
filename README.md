# OpenAI Codex MSIX Downloader

[![Go Version](https://img.shields.io/github/go-mod/go-version/username/reponame?label=Go)](https://go.dev/)
[![Python Version](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

* [English](#english) | [简体中文](#简体中文)

---

## English

A utility to automatically fetch, filter, and download the official installer package for **OpenAI Codex** on Microsoft Store. It features a lightweight **Go Web Server** (with dashboard & stream proxy downloading) and a zero-dependency **Python CLI script**.

This tool helps users bypass Windows Store connection restrictions by dynamically fetching direct CDN package links, offering a smooth offline installation experience.

### 🌟 Key Features

- **Smart Version Parsing & Ranking**: Automatically extracts semantic version numbers (e.g., `_1.0.23.0_`) and architecture suffixes, ensuring you always get the latest and most compatible release.
- **Go Web Portal**:
  - **Modern Dashboard**: A clean, responsive Web UI to check versions and fetch official direct links instantly.
  - **302 Redirect (`/download`)**: Easily integrates with download managers or scripts for automated redirects.
  - **Stream Proxy Download (`/proxy-download`)**: Streams the Microsoft CDN download payload directly through the server, bypassing local network restrictions.
  - **Self-Contained Deployment**: Built with Go's `embed` features, bundling HTML/CSS into a single binary for effortless deployment.
- **Python CLI**:
  - A zero-dependency script that prints raw URLs directly to standard output, making it easy to pipe to downloaders like aria2, IDM, or PowerShell scripts.

---

### 🛠 Project Layout

```text
├── .gitignore                   # Git ignore configurations
├── LICENSE                      # MIT Open Source License
├── README.md                    # This document (English / 简体中文)
├── main.go                      # Go Web Server entrypoint
├── go.mod                       # Go Module definition
├── get_codex_download_link.py   # Python CLI helper script
├── static/                      # Web Portal static assets
│   └── styles.css               # Portal stylesheet
└── templates/                   # Web Portal template views
    └── index.html               # UI HTML template
```

---

### 🚀 Quick Start

#### Option 1: Deploy the Go Web Server

1. **Local Run & Compilation**
   ```bash
   # Run directly
   go run main.go
   
   # Or build and execute
   go build -o codex-download-home.exe main.go
   ./codex-download-home.exe
   ```
   The portal is hosted at `http://localhost:8080` by default.

2. **Environment Variables**
   Customize the service behavior by passing environment variables:
   - `PORT`: Server listening port (default: `:8080`).
   - `CODEX_STORE_URL`: Target MS Store App URL (defaults to OpenAI Codex).
   - `CODEX_ARCH`: Target system architecture (default: `x64`).
   - `CODEX_EXTENSION`: Target package extension (default: `.msix`).

3. **Endpoints**
   - `/`: Main dashboard showing latest version metadata (file size, SHA-1, expiry).
   - `/download`: Retrieves and redirects (302) to the latest direct CDN link.
   - `/proxy-download`: Streams the package payload directly from Microsoft CDN as an attachment.
   - `/api/latest`: API endpoint returning JSON payload of the latest matched metadata.

---

#### Option 2: Run the Python CLI

A single Python script `get_codex_download_link.py` containing zero dependencies. Ideal for scripting and automation.

```bash
# Print the best matching official direct download URL
python get_codex_download_link.py
```

**Automate downloading with PowerShell**:
```powershell
$url = python get_codex_download_link.py
Invoke-WebRequest -Uri $url -OutFile .\OpenAI.Codex.msix
```

**Advanced Usage**:
```bash
# List all matched releases in TSV format
python get_codex_download_link.py --all

# Print matched metadata as JSON
python get_codex_download_link.py --json

# View all CLI options
python get_codex_download_link.py --help
```

---

### ⚖ Disclaimer

1. This project is provided for educational and research purposes only.
2. It interacts with the third-party parsing service (rg-adguard) and does not host, modify, or distribute any Microsoft Store installation files.
3. Microsoft Store direct links expire after a short period (usually around 30 minutes). Do not use them as permanent assets.
4. This project has no affiliation with Microsoft Corporation or OpenAI.

---

## 简体中文

自动获取、筛选并下载 Microsoft Store 中 **OpenAI Codex** 应用官方安装包的开源工具。包含**基于 Go 语言的极简 Web 服务**以及**基于 Python 的轻量级命令行脚本**。

本工具通过动态抓取应用商店直链分发接口，帮助用户规避 Windows 商店连接限制，且支持直接代理流式中转下载，提供流畅的本地离线安装体验。

### 🌟 主要功能

- **智能版本解析与排序**：自动提取文件名中的语义化版本号（如 `_1.0.23.0_`）和架构标记，始终保证筛选并提供最新、最匹配的包。
- **Go 网页端 (Web Portal)**：
  - **极简仪表盘**：响应式现代扁平化仪表盘，支持一键获取最新官方直链。
  - **302 直链跳转 (`/download`)**：便于第三方脚本或下载工具进行实时重定向下载。
  - **流式代理下载 (`/proxy-download`)**：在服务器直接读取微软 CDN 流并中转给客户端，解决因网络限制无法直连微软服务器的问题。
  - **内嵌静态资源**：基于 Go `embed` 特性，所有 HTML/CSS 均内嵌于单个二进制文件中，支持无依赖一键部署。
- **Python 命令行端 (CLI)**：
  - 单文件、零依赖的命令行工具，支持管道输出直链，无缝集成到 aria2、IDM 或 PowerShell 等脚本中。

---

### 🛠 目录结构

```text
├── .gitignore                   # Git 忽略配置
├── LICENSE                      # MIT 开源授权协议
├── README.md                    # 本说明文件 (英文 / 简体中文)
├── main.go                      # Go Web 服务主入口
├── go.mod                       # Go 依赖配置
├── get_codex_download_link.py   # Python 命令行脚本
├── static/                      # 静态资源目录
│   └── styles.css               # Web Portal 样式表
└── templates/                   # 网页模板目录
    └── index.html               # 交互网页模板
```

---

### 🚀 快速开始

#### 方式一：部署 Go Web 服务

1. **本地开发与运行**
   ```bash
   # 直接运行
   go run main.go
   
   # 或者编译后运行
   go build -o codex-download-home.exe main.go
   ./codex-download-home.exe
   ```
   默认启动在 `http://localhost:8080`。

2. **环境变量配置**
   您可通过传递环境变量自定义服务的行为：
   - `PORT`: 服务监听端口 (默认 `:8080`)。
   - `CODEX_STORE_URL`: 目标微软商店应用链接 (默认指向 OpenAI Codex)。
   - `CODEX_ARCH`: 目标系统架构限制 (默认 `x64`)。
   - `CODEX_EXTENSION`: 筛选的文件后缀名 (默认 `.msix`)。

3. **接口说明**
   - `/`: 下载面板主页，展示当前最新版本的大小、SHA-1 校验码和过期时间。
   - `/download`: 自动获取直链并重定向到微软下载。
   - `/proxy-download`: 服务器代理拉取微软包数据并以附件形式流式输出。
   - `/api/latest`: 获取当前最新包属性的 JSON。

---

#### 方式二：使用 Python 脚本

单文件 Python 脚本 `get_codex_download_link.py` 支持丰富参数，适合集成到命令行和自动化下载器中。

```bash
# 获取并打印最新匹配的官方下载直链
python get_codex_download_link.py
```

**配合 PowerShell 自动下载最新版本**：
```powershell
$url = python get_codex_download_link.py
Invoke-WebRequest -Uri $url -OutFile .\OpenAI.Codex.msix
```

**高级参数**：
```bash
# 输出匹配到的所有版本信息 (TSV 格式)
python get_codex_download_link.py --all

# 输出匹配到的最新版本信息的 JSON (包含 SHA1, 大小等)
python get_codex_download_link.py --json

# 查看支持的所有配置参数
python get_codex_download_link.py --help
```

---

### ⚖ 免责声明

1. 本项目所包含的脚本及 Web 服务仅用于学习交流及个人研究目的。
2. 项目通过第三方解析接口（rg-adguard）获取链接，不存储、不修改任何微软商店的数据包。
3. 官方直链是有时间限制的（通常约半小时内有效），请勿将直链用于长期静态存储库。
4. 本项目与微软官方（Microsoft Corporation）以及 OpenAI 没有任何直接或间接关系。
