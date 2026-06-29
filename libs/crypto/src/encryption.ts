import crypto from "node:crypto";

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  const decoded = Buffer.from(key, "base64");
  if (decoded.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (base64-encoded)");
  }
  return decoded;
}

function encode(iv: Buffer, tag: Buffer, ciphertext: Buffer): string {
  return `${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

function decode(
  encoded: string,
): { iv: Buffer; tag: Buffer; ciphertext: Buffer } | null {
  const parts = encoded.split(":");
  if (parts.length !== 3) return null;
  return {
    iv: Buffer.from(parts[0], "base64"),
    tag: Buffer.from(parts[1], "base64"),
    ciphertext: Buffer.from(parts[2], "base64"),
  };
}

export function encrypt(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return null;
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return encode(iv, tag, ciphertext);
}

export function decrypt(encoded: string | null | undefined): string | null {
  if (encoded == null) return null;
  const parts = decode(encoded);
  if (!parts) return null;
  const key = getKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, parts.iv);
  decipher.setAuthTag(parts.tag);
  try {
    return (
      decipher.update(parts.ciphertext).toString("utf8") +
      decipher.final("utf8")
    );
  } catch {
    return null;
  }
}

export function isEncrypted(value: string | null | undefined): boolean {
  if (value == null) return false;
  return decode(value) !== null;
}
