import { addExceptionAction, addRuleAction, deleteExceptionAction, deleteRuleAction, disconnectGoogleAction, saveGeneralSettingsAction, saveTemplatesAction } from "@/app/admin/actions";
import { Flash, PageHeader } from "@/components/admin/bits";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Badge, ButtonLink, Card, Field, inputClass } from "@/components/ui";
import { integrations, isDemo } from "@/lib/config";
import { getSettings, listExceptions, listRules } from "@/lib/db/queries";
import { isGoogleConnected } from "@/lib/google";
import { DEFAULT_TEMPLATES, MESSAGE_KINDS } from "@/lib/notify/templates";
import { localDateOf } from "@/lib/time/zoned";

const DAYS = ["", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export default async function EinstellungenPage({ searchParams }: { searchParams: Promise<{ ok?: string; fehler?: string; google?: string }> }) {
  const q = await searchParams;
  const today = localDateOf(Date.now());
  const [s, rules, exceptions, google] = await Promise.all([getSettings(), listRules(), listExceptions(today), isGoogleConnected()]);

  return (
    <>
      <PageHeader title="Einstellungen" />
      <Flash ok={q.ok ?? (q.google === "verbunden" ? "Google Calendar verbunden." : undefined)} error={q.fehler ?? (q.google === "fehler" ? "Google-Verbindung fehlgeschlagen." : undefined)} />
      <nav aria-label="Abschnitte" className="mb-6 flex flex-wrap gap-2 text-sm">
        {[["#verfuegbarkeit", "Verfügbarkeit"], ["#ausnahmen", "Urlaub & Ausnahmen"], ["#allgemein", "Regeln & Zahlungen"], ["#nachrichten", "Nachrichtentexte"], ["#integrationen", "Integrationen"]].map(([h, l]) => (
          <a key={h} href={h} className="rounded-lg border border-line px-3 py-1.5 hover:border-muted">{l}</a>
        ))}
      </nav>

      <section id="verfuegbarkeit" className="mb-10 scroll-mt-28">
        <h2 className="mb-3 text-lg font-semibold">Wöchentliche Verfügbarkeit</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
            const list = rules.filter((r) => r.isoWeekday === d);
            return (
              <Card key={d} className="p-4">
                <p className="mb-2 font-semibold">{DAYS[d]}</p>
                {list.length === 0 ? <p className="text-sm text-muted">frei</p> : (
                  <ul className="space-y-1">
                    {list.map((r) => (
                      <li key={r.id} className="flex items-center justify-between text-sm">
                        <span className="tabular-nums">{hhmm(r.startMinute)}–{hhmm(r.endMinute)}</span>
                        <form action={deleteRuleAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="text-xs text-muted hover:text-red-400" aria-label={`${DAYS[d]} ${hhmm(r.startMinute)} entfernen`}>entfernen</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
        <form action={addRuleAction} className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4">
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Tage</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <label key={d} className="flex items-center gap-1 text-sm"><input type="checkbox" name="weekday" value={d} className="size-4" />{DAYS[d]!.slice(0, 2)}</label>
              ))}
            </div>
          </fieldset>
          <Field label="Von" htmlFor="r-start"><input id="r-start" name="start" type="time" step={900} defaultValue="17:00" className={inputClass} /></Field>
          <Field label="Bis" htmlFor="r-end"><input id="r-end" name="end" type="time" step={900} defaultValue="21:00" className={inputClass} /></Field>
          <SubmitButton size="sm">Zeitfenster hinzufügen</SubmitButton>
        </form>
      </section>

      <section id="ausnahmen" className="mb-10 scroll-mt-28">
        <h2 className="mb-3 text-lg font-semibold">Urlaub, Sperren & Zusatztage</h2>
        <ul className="mb-4 divide-y divide-line rounded-xl border border-line bg-surface">
          {exceptions.length === 0 && <li className="p-4 text-sm text-muted">Keine kommenden Ausnahmen.</li>}
          {exceptions.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span>
                <Badge tone={e.kind === "blocked" ? "bad" : "ok"}>{e.kind === "blocked" ? "Gesperrt" : "Zusätzlich"}</Badge>{" "}
                <strong>{e.startDate}{e.endDate !== e.startDate ? ` – ${e.endDate}` : ""}</strong>
                {e.startMinute != null && e.endMinute != null ? ` · ${hhmm(e.startMinute)}–${hhmm(e.endMinute)}` : " · ganztägig"}
                {e.note && <span className="text-muted"> · {e.note}</span>}
              </span>
              <form action={deleteExceptionAction}>
                <input type="hidden" name="id" value={e.id} />
                <button type="submit" className="text-xs text-muted hover:text-red-400">entfernen</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addExceptionAction} className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-3 lg:grid-cols-7 lg:items-end">
          <Field label="Art" htmlFor="e-kind">
            <select id="e-kind" name="kind" className={inputClass}><option value="blocked">Sperren / Urlaub</option><option value="extra">Zusätzlich verfügbar</option></select>
          </Field>
          <Field label="Von (Datum)" htmlFor="e-from"><input id="e-from" name="startDate" type="date" required defaultValue={today} className={inputClass} /></Field>
          <Field label="Bis (Datum)" htmlFor="e-to"><input id="e-to" name="endDate" type="date" className={inputClass} /></Field>
          <Field label="Uhrzeit von" htmlFor="e-start"><input id="e-start" name="start" type="time" step={900} defaultValue="09:00" className={inputClass} /></Field>
          <Field label="bis" htmlFor="e-end"><input id="e-end" name="end" type="time" step={900} defaultValue="12:00" className={inputClass} /></Field>
          <label className="flex items-center gap-2 text-sm lg:pb-3"><input type="checkbox" name="allDay" defaultChecked className="size-4" /> ganztägig (nur Sperre)</label>
          <Field label="Notiz" htmlFor="e-note"><input id="e-note" name="note" className={inputClass} placeholder="z. B. Urlaub" /></Field>
          <SubmitButton size="sm" className="sm:col-span-3 lg:col-span-7 lg:w-fit">Ausnahme speichern</SubmitButton>
        </form>
      </section>

      <section id="allgemein" className="mb-10 scroll-mt-28">
        <h2 className="mb-3 text-lg font-semibold">Regeln, Kontakt & Zahlungen</h2>
        <form action={saveGeneralSettingsAction} className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name des Studios" htmlFor="businessName"><input id="businessName" name="businessName" defaultValue={s.businessName} className={inputClass} /></Field>
          <Field label="Adresse (für Nachrichten)" htmlFor="address"><input id="address" name="address" defaultValue={s.address} className={inputClass} /></Field>
          <Field label="Benachrichtigungen an (Trainer)" htmlFor="trainerNotifyEmail"><input id="trainerNotifyEmail" name="trainerNotifyEmail" type="email" defaultValue={s.trainerNotifyEmail ?? ""} className={inputClass} /></Field>
          <Field label="Google-Maps-Link" htmlFor="googleMapsUrl"><input id="googleMapsUrl" name="googleMapsUrl" type="url" defaultValue={s.googleMapsUrl ?? ""} className={inputClass} /></Field>
          <Field label="Google-Bewertungslink" htmlFor="googleReviewUrl"><input id="googleReviewUrl" name="googleReviewUrl" type="url" defaultValue={s.googleReviewUrl ?? ""} className={inputClass} /></Field>
          <Field label="Anfrage hält Slot (Std.)" htmlFor="holdHours" hint="danach automatisch „abgelaufen“"><input id="holdHours" name="holdHours" type="number" min={1} max={168} defaultValue={s.holdHours} className={inputClass} /></Field>
          <Field label="Antwortversprechen (Std.)" htmlFor="responseSlaHours"><input id="responseSlaHours" name="responseSlaHours" type="number" min={1} defaultValue={s.responseSlaHours} className={inputClass} /></Field>
          <Field label="Kostenlose Storno bis (Std. vorher)" htmlFor="cancellationHours"><input id="cancellationHours" name="cancellationHours" type="number" min={0} defaultValue={s.cancellationHours} className={inputClass} /></Field>
          <Field label="Erinnerungen (Std. vorher)" htmlFor="reminderHours" hint="z. B. 24, 2"><input id="reminderHours" name="reminderHours" defaultValue={s.reminderOffsetsMin.map((m) => m / 60).join(", ")} className={inputClass} /></Field>
          <Field label="Warteliste: Platz reserviert (Std.)" htmlFor="waitlistOfferHours"><input id="waitlistOfferHours" name="waitlistOfferHours" type="number" min={1} defaultValue={s.waitlistOfferHours} className={inputClass} /></Field>
          <Field label="Danke-Nachricht nach (Min.)" htmlFor="followupDelayMin"><input id="followupDelayMin" name="followupDelayMin" type="number" min={0} step={15} defaultValue={s.followupDelayMin} className={inputClass} /></Field>
          <Field label="Zahlungen (Stripe)" htmlFor="paymentMode" hint={integrations.stripe ? "Zahlungslink kommt mit der Bestätigung" : "STRIPE_SECRET_KEY fehlt"}>
            <select id="paymentMode" name="paymentMode" defaultValue={s.paymentMode} className={inputClass}>
              <option value="off">Aus (Zahlung vor Ort)</option>
              <option value="deposit">Anzahlung nach Bestätigung</option>
              <option value="full">Vollzahlung nach Bestätigung</option>
            </select>
          </Field>
          <Field label="Anzahlung (%)" htmlFor="depositPercent"><input id="depositPercent" name="depositPercent" type="number" min={1} max={100} defaultValue={s.depositPercent} className={inputClass} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="packages" defaultChecked={Boolean(s.features.packages)} className="size-4" /> Pakete/Karten öffentlich verkaufen (/pakete)</label>
          <div className="sm:col-span-2 lg:col-span-3"><SubmitButton>Speichern</SubmitButton></div>
        </form>
      </section>

      <section id="nachrichten" className="mb-10 scroll-mt-28">
        <h2 className="mb-1 text-lg font-semibold">Nachrichtentexte (E-Mail)</h2>
        <p className="mb-3 text-sm text-muted">
          Leer = Standardtext. Platzhalter: {"{name} {angebot} {datum} {uhrzeit} {ort} {grund} {stunden} {link}"}. WhatsApp verwendet die bei Meta freigegebenen Templates (Name jeweils angegeben).
        </p>
        <form action={saveTemplatesAction} className="space-y-3">
          {MESSAGE_KINDS.map((kind) => {
            const d = DEFAULT_TEMPLATES[kind];
            const o = s.messageTemplates[kind] ?? {};
            return (
              <details key={kind} className="rounded-xl border border-line bg-surface p-4">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 font-semibold">
                  {d.label}
                  <span className="flex items-center gap-2 text-xs font-normal text-muted">
                    {(o.subject || o.body) && <Badge tone="accent">angepasst</Badge>}
                    WhatsApp: <code>{d.whatsappTemplate}</code>
                    <a href={`/admin/nachrichten/vorschau/${kind}`} target="_blank" className="text-accent hover:underline">Vorschau</a>
                  </span>
                </summary>
                <div className="mt-3 space-y-3">
                  <Field label="Betreff" htmlFor={`${kind}-s`}><input id={`${kind}-s`} name={`${kind}.subject`} defaultValue={o.subject ?? ""} placeholder={d.subject} className={inputClass} /></Field>
                  <Field label="Text" htmlFor={`${kind}-b`}><textarea id={`${kind}-b`} name={`${kind}.body`} rows={5} defaultValue={o.body ?? ""} placeholder={d.body} className={inputClass} /></Field>
                </div>
              </details>
            );
          })}
          <SubmitButton>Texte speichern</SubmitButton>
        </form>
      </section>

      <section id="integrationen" className="scroll-mt-28">
        <h2 className="mb-3 text-lg font-semibold">Integrationen</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between"><p className="font-semibold">Google Calendar</p>{google ? <Badge tone="ok">verbunden</Badge> : <Badge>nicht verbunden</Badge>}</div>
            <p className="mt-1 text-sm text-muted">Belegte Zeiten blockieren Slots; bestätigte Termine werden als Event eingetragen.</p>
            <div className="mt-3">
              {!integrations.google ? <p className="text-sm text-amber-300">GOOGLE_CLIENT_ID/SECRET fehlen (siehe README).</p> : google ? (
                <form action={disconnectGoogleAction}><SubmitButton size="sm" variant="secondary">Trennen</SubmitButton></form>
              ) : <ButtonLink href="/api/google/connect" size="sm" prefetch={false}>Mit Google verbinden</ButtonLink>}
            </div>
          </Card>
          <IntegrationCard name="E-Mail (Resend)" ok={integrations.email} text="Bestätigungen, Erinnerungen, .ics-Anhang." missing="RESEND_API_KEY fehlt – Nachrichten werden nur simuliert (siehe Nachrichten)." />
          <IntegrationCard name="WhatsApp Business" ok={integrations.whatsapp} text="Nur mit Opt-in und freigegebenen Templates; Fallback auf E-Mail." missing="WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID fehlen – wird simuliert." />
          <IntegrationCard name="Stripe" ok={integrations.stripe} text="Zahlungslink nach Bestätigung, Pakete." missing="STRIPE_SECRET_KEY fehlt – Zahlungen deaktiviert." />
        </div>
        {isDemo && <p className="mt-4 text-sm text-amber-300">Demo-Modus: Daten liegen in einer lokalen Demo-Datenbank (.demo-db). Für den Livebetrieb DATABASE_URL setzen.</p>}
      </section>
    </>
  );
}

function IntegrationCard({ name, ok, text, missing }: { name: string; ok: boolean; text: string; missing: string }) {
  return (
    <Card>
      <div className="flex items-center justify-between"><p className="font-semibold">{name}</p>{ok ? <Badge tone="ok">aktiv</Badge> : <Badge tone="warn">simuliert</Badge>}</div>
      <p className="mt-1 text-sm text-muted">{text}</p>
      {!ok && <p className="mt-2 text-sm text-amber-300">{missing}</p>}
    </Card>
  );
}
