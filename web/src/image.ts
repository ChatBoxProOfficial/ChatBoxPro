/**
 * 把本地图片压成适合发给模型的 data URL。
 * 官方会把图片缩到约 1300×1300（每图 ≤1024 token），这里先压一遍，
 * 既省请求体体积，也避免把几 MB 的原图塞进 IndexedDB。
 */
export async function imageToDataUrl(
  file: File,
  maxSide = 2048,
  quality = 0.9,
): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  const url = canvas.toDataURL('image/jpeg', quality)
  // data URL 超过 8MB 时再降一档，保证请求体不炸
  if (url.length > 8 * 1024 * 1024) {
    return canvas.toDataURL('image/jpeg', 0.72)
  }
  return url
}
