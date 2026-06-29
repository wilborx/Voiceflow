export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
      };
      userId?: string;
      org?: {
        id: string;
        name: string;
        ownerId: string;
        plan: string;
        stripeCustomerId?: string | null;
        stripeSubscriptionId?: string | null;
        subscriptionStatus?: string | null;
        minutesIncluded: number;
        dataRetentionDays: number;
        createdAt: Date;
        updatedAt: Date;
      };
      webhookVerified?: boolean;
      stripeWebhookEvent?: import("stripe").Event;
    }
  }
}
