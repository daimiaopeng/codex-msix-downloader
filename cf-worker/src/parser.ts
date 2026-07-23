import { FetchConfig, StoreFile } from "./types";

const API_URL = "https://store.rg-adguard.net/api/GetFiles";

/**
 * 简易 HTML 实体解码器
 */
function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * 清理 HTML 单元格中的标签与多余空格
 */
function cleanCell(cellHtml: string): string {
  const withoutTags = cellHtml.replace(/<[^>]+>/gi, "");
  const decoded = decodeHTMLEntities(withoutTags);
  return decoded.replace(/\s+/g, " ").trim();
}

/**
 * 从文件名中提取语义化版本号 (例如 `_1.0.23.0_`)
 */
function parseVersion(name: string): string {
  const match = name.match(/_([0-9]+(?:\.[0-9]+){1,})_/);
  return match ? match[1] : "";
}

/**
 * 从文件名中提取架构标识 (例如 `_x64__`)
 */
function parseArch(name: string): string {
  const match = name.match(/_([A-Za-z0-9]+)__/);
  return match ? match[1] : "";
}

/**
 * 将版本号字符串转换为数字数组，便于比较
 */
function versionParts(version: string): number[] {
  if (!version) return [];
  return version.split(".").map((part) => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
}

/**
 * 比较两个版本号数组 (-1, 0, 1)
 */
function compareVersionParts(left: number[], right: number[]): number {
  const maxLength = Math.max(left.length, right.length);
  for (let i = 0; i < maxLength; i++) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }
  return 0;
}

/**
 * 解析文件大小为字节数
 */
function parseSizeBytes(sizeStr: string): number {
  const match = sizeStr.match(/([0-9]+(?:\.[0-9]+)?)\s*([KMGT]?B)/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const scaleMap: Record<string, number> = {
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };
  return val * (scaleMap[unit] ?? 1);
}

/**
 * 向 rg-adguard API 发起 POST 请求获取响应 HTML
 */
export async function fetchStoreHtml(config: FetchConfig): Promise<string> {
  const bodyParams = new URLSearchParams({
    type: config.queryType,
    url: config.storeUrl,
    gl: config.market,
    ring: config.ring,
    lang: config.language,
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
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`rg-adguard returned HTTP ${response.status}: ${errorText.slice(0, 240)}`);
  }

  return await response.text();
}

/**
 * 从页面 HTML 中解析所有文件表格记录
 */
export function parseStoreFiles(pageHtml: string): StoreFile[] {
  if (pageHtml.includes("Just a moment") && pageHtml.includes("challenge-platform")) {
    throw new Error("Request was blocked by Cloudflare challenge");
  }

  // 正则匹配每行的单元格数据
  const rowRegex = /<tr[^>]*>\s*<td>\s*<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>\s*<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<\/tr>/gis;
  
  const files: StoreFile[] = [];
  let match: RegExpExecArray | null;

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
      arch: parseArch(name),
    });
  }

  return files;
}

/**
 * 按照架构、扩展名和文件名子串筛选文件，并按版本号降序排列
 */
export function filterFiles(files: StoreFile[], config: FetchConfig): StoreFile[] {
  const needle = config.nameContains.toLowerCase();
  const extension = config.extension.toLowerCase();
  const archMarker = `_${config.arch.toLowerCase()}_`;

  const matches = files.filter((file) => {
    const lowerName = file.name.toLowerCase();
    return (
      lowerName.includes(needle) &&
      lowerName.endsWith(extension) &&
      lowerName.includes(archMarker)
    );
  });

  matches.sort((a, b) => {
    const versionCmp = compareVersionParts(
      versionParts(a.version),
      versionParts(b.version)
    );
    if (versionCmp !== 0) {
      // 降序
      return -versionCmp;
    }
    // 版本相同时按文件大小降序
    return parseSizeBytes(b.size) - parseSizeBytes(a.size);
  });

  return matches;
}

/**
 * 完整拉取与筛选最新文件
 */
export async function fetchLatest(config: FetchConfig): Promise<StoreFile> {
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
