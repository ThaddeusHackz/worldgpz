import crypto from 'node:crypto';

const PREFIX = 'v1';

function getEncryptionKey() {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('Set API_KEY_ENCRYPTION_SECRET (32+ characters) or a strong JWT_SECRET before saving provider credentials.');
  }
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptSecret(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':');
}

export function decryptSecret(payload) {
  const [version, ivPart, tagPart, ciphertextPart] = String(payload).split(':');
  if (version !== PREFIX || !ivPart || !tagPart || !ciphertextPart) throw new Error('Unsupported or malformed encrypted credential.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextPart, 'base64url')), decipher.final()]).toString('utf8');
}

export function maskSecret(value) {
  if (!value) return '';
  const secret = String(value);
  if (secret.length <= 8) return '•'.repeat(secret.length);
  return `${secret.slice(0, 3)}${'•'.repeat(Math.min(secret.length - 7, 18))}${secret.slice(-4)}`;
}
