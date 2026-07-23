/**
 * 存储从 Microsoft Store 解析出来的文件元数据
 */
export interface StoreFile {
  /** 文件名称 */
  name: string;
  /** 微软 CDN 下载直链 URL */
  url: string;
  /** 链接过期时间 */
  expires: string;
  /** 文件 SHA-1 校验值 */
  sha1: string;
  /** 可读格式的文件大小 (如 123.45 MB) */
  size: string;
  /** 提取的语义化版本号 (如 1.0.23.0) */
  version: string;
  /** 提取的系统架构 (如 x64) */
  arch: string;
}

/**
 * 抓取与筛选配置参数
 */
export interface FetchConfig {
  storeUrl: string;
  queryType: string;
  market: string;
  ring: string;
  language: string;
  nameContains: string;
  arch: string;
  extension: string;
}

/**
 * Cloudflare Worker 环境变量接口
 */
export interface Env {
  STORE_URL?: string;
  QUERY_TYPE?: string;
  MARKET?: string;
  RING?: string;
  LANGUAGE?: string;
  NAME_CONTAINS?: string;
  ARCH?: string;
  EXTENSION?: string;
}

/**
 * 渲染模版及页面交互所需的数据结构
 */
export interface PageData {
  file: StoreFile | null;
  error: string | null;
  generatedAt: string;
}
