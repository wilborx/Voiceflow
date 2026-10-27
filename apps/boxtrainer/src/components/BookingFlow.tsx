"use client";

import { Check, Clock, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Offering } from "@/lib/db/types";
import { EXPERIENCE_LABELS, KIND_LABELS } from "@/lib/db/types";
import { formatForDisplay, formatLocalTime } from "@/lib/time/zoned";
import { contactSchema } from "@/lib/validation";
import { SlotPicker, type PickedSlot } from "./SlotPicker";
import { Button, Field, cx, formatPrice, inputClass } from "./ui";

type PublicOffering = Pick<Offering, "slug" | "name" | "description" | "durationMin" | "priceCents" | "capacity" | "kind" | "color">;

const STEPS = ["Angebot", "Termin", "Deine Daten", "Absenden"];

interface Contact {
  name: string;
  email: string;
  phone: string;
  preferredChannel: "email" | "whatsapp";
  experienceLevel: string;
  goal: string;
  healthNotes: string;
  message: string;
}

const EMPTY: Contact = { name: "", email: "", phone: "", preferredChannel: "email", experienceLevel: "", goal: "", healthNotes: "", message: "" };

function readUtm(): Record<string, string> {
  try {
    const stored = sessionStorage.getItem("bt_utm");
    if (stored) return JSON.parse(stored) as Record<string, string>;
    const p = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
      const v = p.get(k);
      if (v) utm[k] = v.slice(0, 100);
    }
    if (!utm.utm_source && document.referrer && !document.referrer.startsWith(window.location.origin)) {
      utm.referrer = new URL(document.referrer).hostname;
    }
    sessionStorage.setItem("bt_utm", JSON.stringify(utm));
    return utm;
  } catch {
    return {};
  }
}

export function BookingFlow({ offerings, initialSlug, responseHours }: { offerings: PublicOffering[]; initialSlug?: string; responseHours: number }) {
  const router = useRouter();
  const initial = offerings.find((o) => o.slug === initialSlug);
  const [step, setStep] = useState(initial ? 2 : 1);
  const [offering, setOffering] = useState<PublicOffering | undefined>(initial);
  const [slot, setSlot] = useState<PickedSlot | null>(null);
  const [contact, setContact] = useState<Contact>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consents, setConsents] = useState({ privacy: false, whatsapp: false, health: false });
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const utm = useRef<Record<string, string>>({});

  useEffect(() => {
    utm.current = readUtm();
  }, []);
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const set = <K extends keyof Contact>(k: K, v: Contact[K]) => setContact((c) => ({ ...c, [k]: v }));
  const waitlist = Boolean(slot?.isFull);

  function validateContact(): boolean {
    const r = contactSchema.safeParse(contact);
    if (r.success) {
      setErrors({});
      return true;
    }
    const e: Record<string, string> = {};
    for (const issue of r.error.issues) e[String(issue.path[0])] ??= issue.message;
    setErrors(e);
    return false;
  }

  async function submit() {
    const e: Record<string, string> = {};
    if (!consents.privacy) e.privacy = "Bitte stimme der Datenschutzerklärung zu.";
    if (contact.preferredChannel === "whatsapp" && !consents.whatsapp) e.whatsapp = "Für WhatsApp-Nachrichten brauchen wir deine Einwilligung – oder wähle E-Mail.";
    if (contact.healthNotes && !consents.health) e.health = "Bitte willige ein – oder lösche die Angaben zu Verletzungen.";
    setErrors(e);
    if (Object.keys(e).length) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: waitlist ? "waitlist" : "book",
          offeringSlug: offering!.slug,
          startsAt: slot!.occurrenceId ? undefined : slot!.start,
          occurrenceId: slot!.occurrenceId,
          contact,
          consents,
          utm: utm.current,
          website,
        }),
      });
      const json = (await res.json()) as { ok: boolean; status?: string; error?: string; message?: string };
      if (json.ok) {
        router.push(`/buchen/danke?status=${json.status}`);
        return;
      }
      setSubmitError(json.message ?? "Bitte prüfe deine Eingaben.");
      if (json.error === "slot_taken" || json.error === "occurrence_full" || json.error === "occurrence_not_bookable") {
        setSlot(null);
        setReloadKey((k) => k + 1);
        setStep(2);
      }
    } catch {
      setSubmitError("Keine Verbindung. Bitte versuche es erneut.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Fortschritt */}
      <nav aria-label="Fortschritt" className="mb-8">
        <ol className="grid grid-cols-4 gap-2">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const done = n < step;
            const current = n === step;
            return (
              <li key={label} aria-current={current ? "step" : undefined}>
                <div className={cx("h-1.5 rounded-full", done || current ? "bg-accent" : "bg-line")} />
                <p className={cx("mt-2 flex items-center gap-1 text-xs sm:text-sm", current ? "font-semibold text-fg" : "text-muted")}>
                  {done && <Check aria-hidden size={14} />}
                  <span className="sr-only">Schritt {n}: </span>
                  {label}
                </p>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Honeypot – für Menschen unsichtbar */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {step === 1 && (
        <section>
          <h1 ref={headingRef} tabIndex={-1} className="font-display text-4xl outline-none">Was möchtest du trainieren?</h1>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {offerings.map((o) => (
              <li key={o.slug}>
                <button
                  type="button"
                  onClick={() => {
                    setOffering(o);
                    setSlot(null);
                    setStep(2);
                  }}
                  className={cx("h-full w-full rounded-xl border p-5 text-left transition-colors hover:border-muted", offering?.slug === o.slug ? "border-accent bg-accent/10" : "border-line bg-surface")}
                >
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: o.color }}>{KIND_LABELS[o.kind]}</span>
                  <span className="mt-1 flex items-baseline justify-between gap-3">
                    <span className="text-xl font-semibold">{o.name}</span>
                    <span className="shrink-0 font-semibold">{formatPrice(o.priceCents)}</span>
                  </span>
                  <span className="mt-2 block text-sm text-muted">{o.description}</span>
                  <span className="mt-3 flex gap-4 text-sm text-zinc-300">
                    <span className="inline-flex items-center gap-1"><Clock aria-hidden size={15} /> {o.durationMin} Min.</span>
                    {o.capacity > 1 && <span className="inline-flex items-center gap-1"><Users aria-hidden size={15} /> Gruppe bis {o.capacity}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === 2 && offering && (
        <section>
          <h1 ref={headingRef} tabIndex={-1} className="font-display text-4xl outline-none">Wann passt es dir?</h1>
          <p className="mb-6 mt-2 text-muted">
            {offering.name} · {offering.durationMin} Min. ·{" "}
            <button type="button" className="underline hover:text-fg" onClick={() => setStep(1)}>ändern</button>
          </p>
          {submitError && <p role="alert" className="mb-4 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-200">{submitError}</p>}
          <SlotPicker offeringSlug={offering.slug} value={slot} onSelect={setSlot} reloadKey={reloadKey} />
          <div className="mt-8 flex justify-between gap-3">
            <Button variant="ghost" onClick={() => setStep(1)}>Zurück</Button>
            <Button disabled={!slot} onClick={() => { setSubmitError(null); setStep(3); }}>
              {waitlist ? "Auf Warteliste – weiter" : "Weiter"}
            </Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <h1 ref={headingRef} tabIndex={-1} className="font-display text-4xl outline-none">Erzähl mir von dir</h1>
          <form
            className="mt-6 grid gap-5 sm:grid-cols-2"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (validateContact()) setStep(4);
            }}
          >
            <Field label="Name" htmlFor="name" error={errors.name} required>
              <input id="name" className={inputClass} autoComplete="name" value={contact.name} onChange={(e) => set("name", e.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "name-error" : undefined} />
            </Field>
            <Field label="E-Mail" htmlFor="email" error={errors.email} required>
              <input id="email" type="email" inputMode="email" className={inputClass} autoComplete="email" value={contact.email} onChange={(e) => set("email", e.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} />
            </Field>
            <Field label="Telefon / Handy" htmlFor="phone" error={errors.phone} hint="Optional – für WhatsApp erforderlich.">
              <input id="phone" type="tel" inputMode="tel" className={inputClass} autoComplete="tel" value={contact.phone} onChange={(e) => set("phone", e.target.value)} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "phone-error" : undefined} />
            </Field>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Wie soll ich dich benachrichtigen?</legend>
              <div className="flex gap-2">
                {(["email", "whatsapp"] as const).map((c) => (
                  <label key={c} className={cx("flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm", contact.preferredChannel === c ? "border-accent bg-accent/10" : "border-line bg-surface-2")}>
                    <input type="radio" name="channel" value={c} className="sr-only" checked={contact.preferredChannel === c} onChange={() => set("preferredChannel", c)} />
                    {c === "email" ? "E-Mail" : "WhatsApp"}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Erfahrungslevel" htmlFor="level" error={errors.experienceLevel} required>
              <select id="level" className={inputClass} value={contact.experienceLevel} onChange={(e) => set("experienceLevel", e.target.value)} aria-invalid={Boolean(errors.experienceLevel)}>
                <option value="">Bitte wählen</option>
                {Object.entries(EXPERIENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Dein Ziel" htmlFor="goal" hint="z. B. Fitness, Technik, Wettkampf, Selbstbewusstsein">
              <input id="goal" className={inputClass} value={contact.goal} onChange={(e) => set("goal", e.target.value)} maxLength={500} />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="Verletzungen oder Einschränkungen (freiwillig)"
                htmlFor="health"
                hint="Gesundheitsdaten sind besonders geschützt. Ich nutze sie nur, um das Training sicher zu gestalten, und nur mit deiner ausdrücklichen Einwilligung im nächsten Schritt."
              >
                <textarea id="health" rows={2} className={inputClass} value={contact.healthNotes} onChange={(e) => set("healthNotes", e.target.value)} maxLength={1000} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Nachricht (optional)" htmlFor="message">
                <textarea id="message" rows={3} className={inputClass} value={contact.message} onChange={(e) => set("message", e.target.value)} maxLength={2000} />
              </Field>
            </div>
            <div className="flex justify-between gap-3 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setStep(2)}>Zurück</Button>
              <Button type="submit">Weiter zur Übersicht</Button>
            </div>
          </form>
        </section>
      )}

      {step === 4 && offering && slot && (
        <section>
          <h1 ref={headingRef} tabIndex={-1} className="font-display text-4xl outline-none">{waitlist ? "Auf die Warteliste" : "Alles richtig?"}</h1>
          <dl className="mt-6 grid gap-x-6 gap-y-3 rounded-xl border border-line bg-surface p-5 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted">Angebot</dt>
            <dd className="font-semibold">{offering.name} · {formatPrice(offering.priceCents)}</dd>
            <dt className="text-muted">Termin</dt>
            <dd className="font-semibold">
              {formatForDisplay(Date.parse(slot.start), "Europe/Berlin", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, {formatLocalTime(Date.parse(slot.start))}–{formatLocalTime(Date.parse(slot.end))} Uhr
            </dd>
            <dt className="text-muted">Name</dt>
            <dd>{contact.name}</dd>
            <dt className="text-muted">Kontakt</dt>
            <dd>{contact.email}{contact.phone && ` · ${contact.phone}`} · per {contact.preferredChannel === "email" ? "E-Mail" : "WhatsApp"}</dd>
            <dt className="text-muted">Level / Ziel</dt>
            <dd>{EXPERIENCE_LABELS[contact.experienceLevel as keyof typeof EXPERIENCE_LABELS]}{contact.goal && ` · ${contact.goal}`}</dd>
          </dl>
          <button type="button" className="mt-2 text-sm text-muted underline hover:text-fg" onClick={() => setStep(3)}>Daten bearbeiten</button>

          <fieldset className="mt-6 space-y-4">
            <legend className="sr-only">Einwilligungen</legend>
            <Consent id="c-privacy" checked={consents.privacy} onChange={(v) => setConsents((c) => ({ ...c, privacy: v }))} error={errors.privacy}>
              Ich habe die <Link href="/datenschutz" target="_blank" className="underline">Datenschutzerklärung</Link> gelesen und bin einverstanden, dass meine Angaben zur Bearbeitung der Anfrage gespeichert werden. <span className="text-accent">*</span>
            </Consent>
            {contact.preferredChannel === "whatsapp" && (
              <Consent id="c-whatsapp" checked={consents.whatsapp} onChange={(v) => setConsents((c) => ({ ...c, whatsapp: v }))} error={errors.whatsapp}>
                Ich möchte Bestätigungen und Erinnerungen per WhatsApp erhalten (WhatsApp/Meta verarbeitet dabei meine Telefonnummer). Widerruf jederzeit möglich. <span className="text-accent">*</span>
              </Consent>
            )}
            {contact.healthNotes && (
              <Consent id="c-health" checked={consents.health} onChange={(v) => setConsents((c) => ({ ...c, health: v }))} error={errors.health}>
                Ich willige ausdrücklich ein, dass meine Angaben zu Verletzungen/Einschränkungen (Gesundheitsdaten, Art. 9 DSGVO) ausschließlich zur sicheren Gestaltung des Trainings verarbeitet werden. Widerruf jederzeit möglich. <span className="text-accent">*</span>
              </Consent>
            )}
          </fieldset>
          <p className="mt-4 rounded-lg border border-line bg-surface-2 p-3 text-xs text-muted">
            Hinweis: Boxtraining ist körperlich fordernd. Bitte lies vor dem ersten Training den{" "}
            <Link href="/agb#gesundheit" target="_blank" className="underline">Gesundheitshinweis</Link> und die{" "}
            <Link href="/agb#storno" target="_blank" className="underline">Stornoregeln</Link>.
          </p>

          {submitError && <p role="alert" className="mt-4 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-200">{submitError}</p>}

          <div className="mt-8 flex flex-col-reverse justify-between gap-3 sm:flex-row">
            <Button variant="ghost" onClick={() => setStep(3)}>Zurück</Button>
            <Button size="lg" onClick={submit} disabled={submitting}>
              {submitting ? "Wird gesendet …" : waitlist ? "Auf Warteliste setzen" : "Anfrage senden"}
            </Button>
          </div>
          {!waitlist && <p className="mt-3 text-right text-xs text-muted">Unverbindlich – du bekommst innerhalb von {responseHours} Std. eine Bestätigung.</p>}
        </section>
      )}
    </div>
  );
}

function Consent({ id, checked, onChange, error, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer gap-3 text-sm leading-relaxed">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-5 shrink-0 accent-[var(--color-accent)]" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
        <span>{children}</span>
      </label>
      {error && <p id={`${id}-error`} className="ml-8 mt-1 text-sm text-red-400">{error}</p>}
    </div>
  );
}
