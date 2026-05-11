/**
 * 头像 URL 工具
 * 为本地头像资源追加缓存失效参数，避免浏览器继续显示旧图。
 */

export function appendCacheBuster(src: string, cacheKey?: string | number): string {
  if (!cacheKey || !src) return src
  if (src.startsWith('data:') || src.startsWith('blob:')) return src

  try {
    const url = new URL(src, 'http://avatar.local')
    url.searchParams.set('v', String(cacheKey))

    if (/^https?:\/\//i.test(src)) {
      return url.toString()
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    const separator = src.includes('?') ? '&' : '?'
    return `${src}${separator}v=${encodeURIComponent(String(cacheKey))}`
  }
}
