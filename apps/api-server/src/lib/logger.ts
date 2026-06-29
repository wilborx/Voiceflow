import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
    "req.body.email",
    "req.body.callerNumber",
    "req.body.transcript",
    "req.body.summary",
    "req.body.extractedData",
    "req.body.googleCalendarAccessToken",
    "req.body.googleCalendarRefreshToken",
    "req.body.ipAddress",
    "req.body.userAgent",
    "res.locals.consentIpHash",
    "*.googleCalendarAccessToken",
    "*.googleCalendarRefreshToken",
    "*.extractedData",
    "*.transcript",
    "*.summary",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
