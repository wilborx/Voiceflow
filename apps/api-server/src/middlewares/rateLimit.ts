import { type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";

const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => req.webhookVerified === true,
  message: { error: "Too many requests, please try again later" },
});

const writeOperationLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => req.webhookVerified === true,
  message: { error: "Too many requests, please try again later" },
});

export function rateLimitMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (req.method === "GET" || req.method === "HEAD") {
    return (
      generalLimiter as unknown as (
        req: Request,
        res: Response,
        next: NextFunction,
      ) => void
    )(req, _res, next);
  }
  return (
    writeOperationLimiter as unknown as (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => void
  )(req, _res, next);
}

export { generalLimiter, writeOperationLimiter };
