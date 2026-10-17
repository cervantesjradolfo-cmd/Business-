// Encrypts the mailbox password for storage (AES-256-GCM). The key comes from BACKGROUND_SECRET, which
// only the server knows; the database alone can't reveal the password.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const key = () => createHash('sha256').update((process.env.BACKGROUND_SECRET ?? '').trim()).digest()
export const secretConfigured = () => (process.env.BACKGROUND_SECRET ?? '').trim().length >= 24

export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), data.toString('base64url')].join('.')
}

export function decrypt(sealed: string): string | null {
  const [v, iv, tag, data] = sealed.split('.')
  if (v !== 'v1' || !iv || !tag || data === undefined) return null
  try {
    const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'))
    d.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8')
  } catch {
    return null
  }
}
