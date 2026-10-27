"use server";

import { revalidatePath } from "next/cache";
import { BookingError, acceptProposal, cancelByCustomer, rejectProposal, rescheduleByCustomer } from "@/lib/booking/service";
import { log } from "@/lib/server/log";

export interface ActionState {
  ok?: boolean;
  message?: string;
}

async function run(token: string, fn: () => Promise<string>): Promise<ActionState> {
  try {
    const message = await fn();
    revalidatePath(`/buchung/${token}`);
    return { ok: true, message };
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, message: err.message };
    log.error("self-service fehlgeschlagen", err);
    return { ok: false, message: "Das hat leider nicht geklappt. Bitte versuche es erneut." };
  }
}

export async function cancelAction(token: string): Promise<ActionState> {
  return run(token, async () => {
    const { late } = await cancelByCustomer(token);
    return late ? "Storniert. Hinweis: Die Stornierung war kurzfristig – es gelten die Stornoregeln." : "Dein Termin wurde storniert.";
  });
}

export async function acceptAction(token: string): Promise<ActionState> {
  return run(token, async () => {
    await acceptProposal(token);
    return "Super – dein Termin ist bestätigt!";
  });
}

export async function rejectAction(token: string): Promise<ActionState> {
  return run(token, async () => {
    await rejectProposal(token);
    return "Alles klar, der Vorschlag wurde abgelehnt.";
  });
}

export async function rescheduleAction(token: string, startIso: string): Promise<ActionState> {
  return run(token, async () => {
    const status = await rescheduleByCustomer(token, new Date(startIso));
    return status === "confirmed" ? "Umgebucht und bestätigt!" : "Umbuchung angefragt – du bekommst eine Bestätigung.";
  });
}
