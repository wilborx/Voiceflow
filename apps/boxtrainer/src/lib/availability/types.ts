import type { LocalDate } from "../time/zoned";

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "declined",
  "expired",
  "cancelled",
  "completed",
  "no_show",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Zeitregeln eines Angebots (Spalten aus `offerings`). */
export interface OfferingRules {
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  /** Mindestvorlauf, z. B. 720 = 12 Std. */
  minNoticeMin: number;
  /** Maximaler Buchungshorizont in Tagen, z. B. 60 */
  maxHorizonDays: number;
  /** Slot-Raster, z. B. 30 */
  slotStepMin: number;
}

/** Wöchentliche Standard-Verfügbarkeit (Wandzeit Europe/Berlin). Mehrere pro Tag möglich. */
export interface AvailabilityRule {
  /** 1 = Montag … 7 = Sonntag */
  isoWeekday: number;
  /** Minuten seit Mitternacht, 0…1439 */
  startMinute: number;
  /** Minuten seit Mitternacht, 1…1440 (1440 = 24:00) */
  endMinute: number;
}

/**
 * Ausnahme für einen Datumsbereich (inklusive).
 * - `blocked` ohne Uhrzeiten: ganzer Tag gesperrt (Urlaub, Krankheit)
 * - `blocked` mit Uhrzeiten: nur dieses Fenster an jedem Tag des Bereichs gesperrt
 * - `extra`: zusätzliches Fenster (Uhrzeiten Pflicht). Hat Vorrang vor `blocked`,
 *   weil es die spezifischere, bewusste Freigabe ist.
 */
export interface AvailabilityException {
  startDate: LocalDate;
  endDate: LocalDate;
  kind: "blocked" | "extra";
  startMinute?: number | null;
  endMinute?: number | null;
}

/** Eine vorhandene Buchung, wie sie für die Verfügbarkeit relevant ist. */
export interface ExistingBooking {
  startsAt: number;
  endsAt: number;
  /** Puffer-Snapshot zum Buchungszeitpunkt */
  bufferBeforeMin: number;
  bufferAfterMin: number;
  status: BookingStatus;
  /** Nur bei `pending`: bis wann der Slot vorläufig gehalten wird */
  holdExpiresAt?: number | null;
  /** Gesetzt bei Buchungen auf Gruppen-/Sondertermine */
  occurrenceId?: string | null;
  /** Belegte Plätze (Standard 1) */
  seats?: number;
}

/** Konkreter Termin eines (wiederkehrenden) Gruppen-/Sonderevents. */
export interface EventOccurrence {
  id: string;
  startsAt: number;
  endsAt: number;
  capacity: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  status: "scheduled" | "cancelled";
}

export interface Slot {
  start: number;
  end: number;
}

export interface EventSlot extends Slot {
  occurrenceId: string;
  capacity: number;
  booked: number;
  remaining: number;
  /** Voll → Warteliste anbieten */
  isFull: boolean;
}
