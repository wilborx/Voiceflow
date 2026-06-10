import { clerkMiddleware, requireAuth } from "@clerk/express";

export const clerkSetup = clerkMiddleware();

export { requireAuth };
