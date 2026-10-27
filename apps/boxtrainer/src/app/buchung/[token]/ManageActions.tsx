"use client";

import { useState, useTransition } from "react";
import { SlotPicker, type PickedSlot } from "@/components/SlotPicker";
import { Button } from "@/components/ui";
import { acceptAction, cancelAction, rejectAction, rescheduleAction, type ActionState } from "./actions";

export function ManageActions(p: {
  token: string;
  offeringSlug: string;
  canCancel: boolean;
  freeCancellation: boolean;
  cancellationHours: number;
  canReschedule: boolean;
  awaitingCustomer: boolean;
}) {
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"none" | "cancel" | "reschedule">("none");
  const [slot, setSlot] = useState<PickedSlot | null>(null);

  const act = (fn: () => Promise<ActionState>) => start(async () => setState(await fn()));

  if (state.ok) {
    return <p role="status" className="rounded-lg border border-green-900 bg-green-950/50 p-4 text-green-200">{state.message}</p>;
  }

  return (
    <div className="space-y-4">
      {state.message && <p role="alert" className="rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-200">{state.message}</p>}

      {p.awaitingCustomer && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" disabled={pending} onClick={() => act(() => acceptAction(p.token))}>Termin annehmen</Button>
          <Button size="lg" variant="secondary" disabled={pending} onClick={() => act(() => rejectAction(p.token))}>Ablehnen</Button>
        </div>
      )}

      {!p.awaitingCustomer && mode === "none" && (
        <div className="flex flex-col gap-3 sm:flex-row">
          {p.canReschedule && <Button variant="secondary" onClick={() => setMode("reschedule")}>Umbuchen</Button>}
          {p.canCancel && <Button variant="danger" onClick={() => setMode("cancel")}>Stornieren</Button>}
        </div>
      )}

      {mode === "cancel" && (
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="font-semibold">Termin wirklich stornieren?</p>
          <p className="mt-1 text-sm text-muted">
            {p.freeCancellation
              ? `Bis ${p.cancellationHours} Std. vorher ist die Stornierung kostenlos.`
              : `Der Termin ist in weniger als ${p.cancellationHours} Std. Laut Stornoregeln kann eine Gebühr anfallen.`}
          </p>
          <div className="mt-4 flex gap-3">
            <Button variant="danger" disabled={pending} onClick={() => act(() => cancelAction(p.token))}>Ja, stornieren</Button>
            <Button variant="ghost" onClick={() => setMode("none")}>Abbrechen</Button>
          </div>
        </div>
      )}

      {mode === "reschedule" && (
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="mb-4 font-semibold">Neuen Termin wählen</p>
          <SlotPicker offeringSlug={p.offeringSlug} value={slot} onSelect={setSlot} />
          <div className="mt-6 flex gap-3">
            <Button disabled={!slot || pending} onClick={() => slot && act(() => rescheduleAction(p.token, slot.start))}>Umbuchen</Button>
            <Button variant="ghost" onClick={() => setMode("none")}>Abbrechen</Button>
          </div>
        </div>
      )}

      {!p.canCancel && !p.awaitingCustomer && <p className="text-sm text-muted">Dieser Termin kann nicht mehr geändert werden. Bei Fragen melde dich gern direkt.</p>}
      {p.canCancel && !p.canReschedule && !p.awaitingCustomer && mode === "none" && (
        <p className="text-sm text-muted">Umbuchen ist bis {p.cancellationHours} Std. vorher möglich.</p>
      )}
    </div>
  );
}
