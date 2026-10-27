import type { BookingStatus } from "../availability/types";

export type OfferingKind = "one_on_one" | "partner" | "trial" | "group" | "special";
export type Channel = "email" | "whatsapp";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced" | "competitive";

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  beginner: "Einsteiger",
  intermediate: "Fortgeschritten",
  advanced: "Erfahren",
  competitive: "Wettkampf",
};

export const KIND_LABELS: Record<OfferingKind, string> = {
  one_on_one: "1:1",
  partner: "Partner",
  trial: "Probetraining",
  group: "Gruppe",
  special: "Sondertermin",
};

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Offen",
  confirmed: "Bestätigt",
  declined: "Abgelehnt",
  expired: "Abgelaufen",
  cancelled: "Storniert",
  completed: "Absolviert",
  no_show: "No-Show",
};

export interface Offering {
  id: string;
  slug: string;
  kind: OfferingKind;
  name: string;
  description: string;
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeMin: number;
  maxHorizonDays: number;
  slotStepMin: number;
  priceCents: number | null;
  currency: string;
  capacity: number;
  color: string;
  location: string;
  visibility: "public" | "unlisted";
  isActive: boolean;
  autoConfirm: boolean;
  sortOrder: number;
}

export interface MessageTemplateOverride {
  subject?: string;
  body?: string;
}

export interface Settings {
  timezone: string;
  holdHours: number;
  cancellationHours: number;
  responseSlaHours: number;
  waitlistOfferHours: number;
  reminderOffsetsMin: number[];
  businessName: string;
  address: string;
  googleMapsUrl: string | null;
  googleReviewUrl: string | null;
  features: { payments?: boolean; packages?: boolean };
  messageTemplates: Record<string, MessageTemplateOverride>;
  trainerNotifyEmail: string | null;
  paymentMode: "off" | "deposit" | "full";
  depositPercent: number;
  followupDelayMin: number;
}

export interface BookingDetail {
  id: string;
  status: BookingStatus;
  startsAt: Date;
  endsAt: Date;
  holdExpiresAt: Date | null;
  seats: number;
  occurrenceId: string | null;
  offering: {
    id: string;
    slug: string;
    name: string;
    kind: OfferingKind;
    location: string;
    priceCents: number | null;
    capacity: number;
    autoConfirm: boolean;
    durationMin: number;
    color: string;
  };
  customer: { id: string; name: string; email: string; phone: string | null };
  preferredChannel: Channel;
  whatsappConsent: boolean;
  experienceLevel: ExperienceLevel | null;
  goal: string | null;
  healthNotes: string | null;
  message: string | null;
  utm: Record<string, string>;
  declineReason: string | null;
  awaitingCustomer: boolean;
  originalStartsAt: Date | null;
  googleEventId: string | null;
  paymentStatus: "none" | "open" | "paid" | "refunded";
  amountDueCents: number | null;
  reminderSent: Record<string, string>;
  lateCancellation: boolean;
  adminNotes: string;
  createdAt: Date;
  decidedAt: Date | null;
  cancelledAt: Date | null;
}

export interface SpecialEvent {
  id: string;
  offeringId: string;
  offeringName: string;
  title: string;
  description: string;
  firstDate: string;
  startMinute: number;
  durationMin: number;
  capacity: number;
  recurrence: "none" | "weekly";
  recurrenceUntil: string | null;
  skipDates: string[];
  location: string | null;
  isActive: boolean;
}

export interface Occurrence {
  id: string;
  specialEventId: string;
  title: string;
  offeringId: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  status: "scheduled" | "cancelled";
  booked: number;
  waitlist: number;
}

export interface CustomerSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date;
  sessions: number;
  noShows: number;
  upcoming: number;
  lastSession: Date | null;
}
