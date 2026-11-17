/**
 * API key 的本地加密存储。
 *
 * 方案：用 WebCrypto 生成一把 **不可导出(non-extractable)** 的 AES-GCM 密钥，
 * 把 CryptoKey 本身存进 IndexedDB，再用它加密 API key，密文单独存放。
 *
 * 为什么不是「自己生成密钥再保存」：不可导出的 CryptoKey 无法被脚本读出原始字节，
 * 即使有人拿到 IndexedDB 里的密文也没有可用的密钥材料；比起把密钥和密文放在一起
 * （那样等于没加密），这能实质提高门槛。
 *
 * 注意：浏览器/WebView 环境仍不是硬件级安全域。装入 Capacitor 后应切换到
 * 系统密钥库（Android Keystore / iOS Keychain），本模块的接口就是为此预留的。
 */
import { db } from './db'

const CRYPTO_KEY_ID = '__apikey_crypto_key__'
const CIPHERTEXT_ID = '__apikey_ciphertext__'
const KEY_ALG = { name: 'AES-GCM', length: 256 } as const

async function getOrCreateCryptoKey(): Promise<CryptoKey> {
  const existing = await db.getKV(CRYPTO_KEY_ID)
  if (existing instanceof CryptoKey) return existing
  const key = await crypto.subtle.generateKey(KEY_ALG, false /* 不可导出 */, [
    'encrypt',
    'decrypt',
  ])
  await db.setKV(CRYPTO_KEY_ID, key)
  return key
}

function b64encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

function b64decode(text: string): Uint8Array {
  const s = atob(text)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export async function saveApiKey(plain: string): Promise<void> {
  const value = plain.trim()
  if (!value) {
    await db.delKV(CIPHERTEXT_ID)
    return
  }
  const key = await getOrCreateCryptoKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(value),
  )
  await db.setKV(CIPHERTEXT_ID, { iv: b64encode(iv.buffer), data: b64encode(enc) })
  // 只在内存里留一份，供本次会话的请求使用
  cached = value
}

let cached: string | null = null

export async function loadApiKey(): Promise<string> {
  if (cached !== null) return cached
  const rec = await db.getKV(CIPHERTEXT_ID)
  if (!rec || typeof rec !== 'object') {
    cached = ''
    return ''
  }
  try {
    const key = await getOrCreateCryptoKey()
    const iv = b64decode(rec.iv)
    const data = b64decode(rec.data)
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      data as unknown as BufferSource,
    )
    cached = new TextDecoder().decode(plain)
  } catch {
    cached = ''
  }
  return cached
}

export async function clearApiKey(): Promise<void> {
  cached = ''
  await db.delKV(CIPHERTEXT_ID)
  await db.delKV(CRYPTO_KEY_ID)
}

/** 用于展示：只显示前后几位 */
export function maskKey(key: string): string {
  if (!key) return ''
  if (key.length <= 10) return '****'
  return `${key.slice(0, 6)}…${key.slice(-4)}`
}
