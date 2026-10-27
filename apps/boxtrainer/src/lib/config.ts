import "server-only";

function read(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

/** Ohne DATABASE_URL läuft die App im Demo-Modus mit eingebetteter Datenbank (PGlite). */
export const isDemo = !read("DATABASE_URL");

const DEMO_SECRET = "demo-secret-nur-fuer-lokale-praesentation-nicht-produktiv-nutzen";

export const env = {
  databaseUrl: read("DATABASE_URL"),
  appUrl: (read("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000").replace(/\/$/, ""),
  appSecret: read("APP_SECRET") ?? (isDemo ? DEMO_SECRET : undefined),
  cronSecret: read("CRON_SECRET"),

  adminEmail: read("ADMIN_EMAIL") ?? (isDemo ? "admin@demo.de" : undefined),
  adminPassword: read("ADMIN_PASSWORD") ?? (isDemo ? "demo" : undefined),
  supabaseUrl: read("SUPABASE_URL"),
  supabaseAnonKey: read("SUPABASE_ANON_KEY"),

  resendApiKey: read("RESEND_API_KEY"),
  emailFrom: read("EMAIL_FROM") ?? "Boxtraining <buchung@example.com>",
  trainerEmail: read("TRAINER_NOTIFY_EMAIL"),

  whatsappToken: read("WHATSAPP_TOKEN"),
  whatsappPhoneNumberId: read("WHATSAPP_PHONE_NUMBER_ID"),
  whatsappTemplateLang: read("WHATSAPP_TEMPLATE_LANG") ?? "de",

  googleClientId: read("GOOGLE_CLIENT_ID"),
  googleClientSecret: read("GOOGLE_CLIENT_SECRET"),
  googleCalendarId: read("GOOGLE_CALENDAR_ID") ?? "primary",

  stripeSecretKey: read("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: read("STRIPE_WEBHOOK_SECRET"),
} as const;

export function requireSecret(): string {
  if (!env.appSecret) throw new Error("APP_SECRET ist nicht gesetzt");
  return env.appSecret;
}

export const integrations = {
  email: Boolean(env.resendApiKey),
  whatsapp: Boolean(env.whatsappToken && env.whatsappPhoneNumberId),
  google: Boolean(env.googleClientId && env.googleClientSecret),
  stripe: Boolean(env.stripeSecretKey),
};
