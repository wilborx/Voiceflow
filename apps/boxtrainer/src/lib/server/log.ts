/**
 * Minimaler strukturierter Logger. Keine personenbezogenen Daten loggen:
 * nur IDs, Status, Fehlercodes. `redact` maskiert E-Mails/Telefonnummern in Freitext.
 */
export function redact(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\+?\d[\d\s/-]{6,}\d/g, "[phone]");
}

type Fields = Record<string, string | number | boolean | null | undefined>;

function write(level: "info" | "warn" | "error", msg: string, fields?: Fields) {
  const line = JSON.stringify({ level, msg: redact(msg), ...fields, ts: new Date().toISOString() });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, fields?: Fields) => write("info", msg, fields),
  warn: (msg: string, fields?: Fields) => write("warn", msg, fields),
  error: (msg: string, err?: unknown, fields?: Fields) =>
    write("error", msg, { ...fields, error: err instanceof Error ? redact(err.message) : err == null ? undefined : redact(String(err)) }),
};
