import Link from "next/link";
import { saveEventAction } from "@/app/admin/actions";
import { Empty, Flash, PageHeader } from "@/components/admin/bits";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Badge, ButtonLink, Card, Field, inputClass } from "@/components/ui";
import { listOccurrences, listOfferings, listSpecialEvents } from "@/lib/db/queries";
import { formatForDisplay, formatLocalTime, localDateOf } from "@/lib/time/zoned";

const minToHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export default async function TerminePage({ searchParams }: { searchParams: Promise<{ edit?: string; ok?: string; fehler?: string }> }) {
  const q = await searchParams;
  const [events, offerings, occurrences] = await Promise.all([
    listSpecialEvents(),
    listOfferings(),
    listOccurrences(new Date(), new Date(Date.now() + 35 * 86_400_000)),
  ]);
  const groupOfferings = offerings.filter((o) => o.capacity > 1);
  const editing = q.edit === "neu" ? null : events.find((e) => e.id === q.edit);
  const showForm = q.edit === "neu" || Boolean(editing);
  const today = localDateOf(Date.now());

  return (
    <>
      <PageHeader title="Gruppen & Sondertermine">
        <ButtonLink href="/admin/termine?edit=neu" size="sm">Neuer Termin</ButtonLink>
      </PageHeader>
      <Flash ok={q.ok} error={q.fehler} />

      {showForm && (
        <Card className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">{editing ? `„${editing.title}“ bearbeiten` : "Neuer Gruppen-/Sondertermin"}</h2>
          <form action={saveEventAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <Field label="Titel" htmlFor="title" required><input id="title" name="title" required defaultValue={editing?.title ?? ""} className={inputClass} placeholder="z. B. Sparring-Samstag" /></Field>
            <Field label="Angebot" htmlFor="offeringId" required hint="Preis/Puffer kommen vom Angebot">
              <select id="offeringId" name="offeringId" defaultValue={editing?.offeringId} className={inputClass}>
                {groupOfferings.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
            <Field label="Kapazität" htmlFor="capacity" required><input id="capacity" name="capacity" type="number" min={1} defaultValue={editing?.capacity ?? 8} className={inputClass} /></Field>
            <Field label="Erster Termin" htmlFor="firstDate" required><input id="firstDate" name="firstDate" type="date" required defaultValue={editing?.firstDate ?? today} className={inputClass} /></Field>
            <Field label="Beginn" htmlFor="startTime" required><input id="startTime" name="startTime" type="time" step={900} required defaultValue={editing ? minToHHMM(editing.startMinute) : "18:30"} className={inputClass} /></Field>
            <Field label="Dauer (Min.)" htmlFor="durationMin" required><input id="durationMin" name="durationMin" type="number" min={15} step={5} defaultValue={editing?.durationMin ?? 90} className={inputClass} /></Field>
            <Field label="Wiederholung" htmlFor="recurrence">
              <select id="recurrence" name="recurrence" defaultValue={editing?.recurrence ?? "none"} className={inputClass}>
                <option value="none">Einmalig</option>
                <option value="weekly">Wöchentlich</option>
              </select>
            </Field>
            <Field label="Wiederholen bis" htmlFor="recurrenceUntil" hint="leer = unbegrenzt"><input id="recurrenceUntil" name="recurrenceUntil" type="date" defaultValue={editing?.recurrenceUntil ?? ""} className={inputClass} /></Field>
            <Field label="Ausfalltage" htmlFor="skipDates" hint="Daten mit Komma, z. B. Feiertage"><input id="skipDates" name="skipDates" defaultValue={editing?.skipDates.join(", ") ?? ""} placeholder="2026-12-24, 2026-12-31" className={inputClass} /></Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Beschreibung" htmlFor="description"><textarea id="description" name="description" rows={2} defaultValue={editing?.description ?? ""} className={inputClass} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={editing?.isActive ?? true} className="size-4" /> Aktiv (buchbar)</label>
            <div className="flex gap-3 sm:col-span-2 lg:col-span-3">
              <SubmitButton>Speichern</SubmitButton>
              <ButtonLink href="/admin/termine" variant="ghost">Abbrechen</ButtonLink>
            </div>
          </form>
        </Card>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted">Vorlagen</h2>
        {events.length === 0 ? <Empty>Noch keine Gruppen- oder Sondertermine.</Empty> : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {events.map((e) => (
              <li key={e.id}>
                <Card className="h-full">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{e.title}</p>
                      <p className="text-sm text-muted">{e.offeringName} · {e.capacity} Plätze · {e.durationMin} Min.</p>
                      <p className="mt-1 text-sm">
                        {e.recurrence === "weekly"
                          ? `Wöchentlich ${formatForDisplay(Date.parse(`${e.firstDate}T12:00:00Z`), "Europe/Berlin", { weekday: "long" })}s ${minToHHMM(e.startMinute)}${e.recurrenceUntil ? ` bis ${e.recurrenceUntil}` : ""}`
                          : `${e.firstDate} um ${minToHHMM(e.startMinute)}`}
                      </p>
                    </div>
                    {!e.isActive && <Badge>inaktiv</Badge>}
                  </div>
                  <Link href={`/admin/termine?edit=${e.id}`} className="mt-3 inline-block text-sm text-accent hover:underline">Bearbeiten</Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted">Nächste 5 Wochen</h2>
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {occurrences.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/termine/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-surface-2">
                <span>
                  <span className="font-semibold">{formatForDisplay(o.startsAt.getTime(), "Europe/Berlin", { weekday: "short", day: "2-digit", month: "2-digit" })}, {formatLocalTime(o.startsAt.getTime())}</span> · {o.title}
                </span>
                <span className="flex items-center gap-2 text-sm">
                  {o.status === "cancelled" ? <Badge tone="bad">abgesagt</Badge> : (
                    <>
                      <span className="hidden h-2 w-24 overflow-hidden rounded-full bg-line sm:block" aria-hidden><span className="block h-full bg-accent" style={{ width: `${Math.min(100, (o.booked / o.capacity) * 100)}%` }} /></span>
                      <span className="tabular-nums">{o.booked}/{o.capacity}</span>
                      {o.waitlist > 0 && <Badge tone="warn">{o.waitlist} Warteliste</Badge>}
                    </>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
