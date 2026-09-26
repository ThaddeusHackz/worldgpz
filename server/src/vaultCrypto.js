/**
 * Encrypted transport for the uplink vault.
 *
 * Purpose: make admin-pasted API keys survive container restarts, redeploys,
 * and migration to another machine *without* requiring a database.
 *
 * On platforms with an ephemeral filesystem (Render free tier, Fly, most
 * serverless runtimes) a local JSON file is wiped on every deploy. The
 * operator can instead carry the vault as a single encrypted environment
 * variable. The value is AES-256-GCM ciphertext derived from a secret the
 * operator already controls, so it is safe to store in plain env storage —
 * and it is never returned to the browser in decrypted form.
 *
 * Format: `wgv1.<base64(salt)>.<base64(iv)>.<base64(tag)>.<base64(ciphertext)>`
 * The version prefix lets the format change later without breaking imports.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const VERSION = "wgv1";
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const SCRYPT_PARAMS = { N: 16_384, r: 8, p: 1 };

/** Stable key derivation: same secret + salt always yields the same key. */
const deriveKey = (secret, salt) =>
  scryptSync(String(secret), salt, KEY_BYTES, SCRYPT_PARAMS);

const fail = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

/** Encrypt a plain settings object into a versioned, portable blob. */
export function encryptVault(settings, secret) {
  if (!secret || String(secret).length < 16)
    throw fail("Vault encryption requires a secret of at least 16 characters");

  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = deriveKey(secret, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(settings ?? {}), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    salt.toString("base64url"),
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Decrypt a blob back into a settings object.
 *
 * Rejects malformed input, wrong versions, and wrong secrets (GCM auth tag
 * mismatch) with a clear operator-facing message rather than throwing raw
 * crypto internals into the admin console.
 */
export function decryptVault(blob, secret) {
  if (typeof blob !== "string" || !blob.trim())
    throw fail("Vault blob is empty");

  const parts = blob.trim().split(".");
  if (parts.length !== 5 || parts[0] !== VERSION)
    throw fail(
      "Vault blob is malformed or from an unsupported version (expected wgv1)",
    );

  const [, saltPart, ivPart, tagPart, dataPart] = parts;
  let salt;
  let iv;
  let tag;
  let ciphertext;
  try {
    salt = Buffer.from(saltPart, "base64url");
    iv = Buffer.from(ivPart, "base64url");
    tag = Buffer.from(tagPart, "base64url");
    ciphertext = Buffer.from(dataPart, "base64url");
  } catch {
    throw fail("Vault blob contains invalid encoding");
  }
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES || tag.length !== 16)
    throw fail("Vault blob is corrupted (unexpected segment length)");

  const key = deriveKey(secret, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  let plaintext;
  try {
    plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw fail("Vault blob could not be decrypted — wrong secret or corrupted");
  }

  let parsed;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw fail("Vault blob decrypted to invalid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw fail("Vault blob does not contain a settings object");

  return parsed;
}

/** Constant-time comparison helper used when validating a vault secret. */
export function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
