import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { requireSecret } from "../config";

function key(purpose: string): Buffer {
  return createHash("sha256").update(`${purpose}:${requireSecret()}`).digest();
}

/**
 * Signiertes Token für Self-Service-Links (kein Login): "<id>.<hmac>".
 * Jederzeit reproduzierbar, damit jede Nachricht den Link enthalten kann; ungültig wird ein
 * Link über den Buchungsstatus, nicht über das Token.
 */
export function signId(kind: string, id: string): string {
  const mac = createHmac("sha256", key(`link:${kind}`)).update(id).digest("base64url").slice(0, 32);
  return `${id}.${mac}`;
}

export function verifySignedId(kind: string, token: string): string | null {
  const [id, mac] = token.split(".");
  if (!id || !mac || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const expected = Buffer.from(signId(kind, id).split(".")[1]!);
  const given = Buffer.from(mac);
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}

/** Zufälliges URL-Token für Self-Service-Links. In der DB wird nur der Hash gespeichert. */
export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHmac("sha256", key("token")).update(token).digest("hex");
}

export function sign(payload: string): string {
  const mac = createHmac("sha256", key("session")).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}

export function verify(signed: string): string | null {
  const [body, mac] = signed.split(".");
  if (!body || !mac) return null;
  const payload = Buffer.from(body, "base64url").toString();
  const expected = createHmac("sha256", key("session")).update(payload).digest();
  const given = Buffer.from(mac, "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected) ? payload : null;
}

/** AES-256-GCM für Daten at-rest (z. B. OAuth-Refresh-Token). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("encrypt"), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(blob: string): string {
  const [iv, tag, data] = blob.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key("encrypt"), iv!);
  decipher.setAuthTag(tag!);
  return Buffer.concat([decipher.update(data!), decipher.final()]).toString("utf8");
}
