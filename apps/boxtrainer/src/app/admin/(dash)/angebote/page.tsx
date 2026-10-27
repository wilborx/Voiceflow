import Link from "next/link";
import { saveOfferingAction, savePackageAction, togglePackageAction } from "@/app/admin/actions";
import { Flash, PageHeader } from "@/components/admin/bits";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Badge, ButtonLink, Card, Field, formatPrice, inputClass } from "@/components/ui";
import { env } from "@/lib/config";
import { sql } from "@/lib/db/client";
import { getSettings, listOfferings } from "@/lib/db/queries";
import { KIND_LABELS, type Offering } from "@/lib/db/types";

export default async function AngebotePage({ searchParams }: { searchParams: Promise<{ edit?: string; ok?: string; fehler?: string }> }) {
  const q = await searchParams;
  const [offerings, settings] = await Promise.all([listOfferings(), getSettings()]);
  const packages = await sql<{ id: string; name: string; credits: number; priceCents: number; validDays: number | null; isActive: boolean; sold: number }>(
    `select p.id, p.name, p.credits, p.price_cents as "priceCents", p.valid_days as "validDays", p.is_active as "isActive",
            (select count(*) from customer_packages cp where cp.package_id = p.id)::int as sold
       from packages p order by p.price_cents`,
  );
  const editing: Partial<Offering> | undefined = q.edit === "neu" ? {} : offerings.find((o) => o.id === q.edit);

  return (
    <>
      <PageHeader title="Angebote">
        <ButtonLink href="/admin/angebote?edit=neu" size="sm">Neues Angebot</ButtonLink>
      </PageHeader>
      <Flash ok={q.ok} error={q.fehler} />

      {editing && (
        <Card className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">{editing.id ? `„${editing.name}“ bearbeiten` : "Neues Angebot"}</h2>
          <form action={saveOfferingAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="id" value={editing.id ?? ""} />
            <div className="sm:col-span-2"><Field label="Name" htmlFor="name" required><input id="name" name="name" required defaultValue={editing.name} className={inputClass} /></Field></div>
            <Field label="URL-Kürzel" htmlFor="slug" required hint="für Links: /buchen?angebot=…"><input id="slug" name="slug" required pattern="[a-z0-9-]+" defaultValue={editing.slug} className={inputClass} /></Field>
            <Field label="Art" htmlFor="kind">
              <select id="kind" name="kind" defaultValue={editing.kind ?? "one_on_one"} className={inputClass}>
                {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2 lg:col-span-4"><Field label="Beschreibung" htmlFor="description"><textarea id="description" name="description" rows={2} defaultValue={editing.description} className={inputClass} /></Field></div>
            <Field label="Dauer (Min.)" htmlFor="durationMin"><input id="durationMin" name="durationMin" type="number" min={5} step={5} defaultValue={editing.durationMin ?? 60} className={inputClass} /></Field>
            <Field label="Preis (€)" htmlFor="price" hint="leer = auf Anfrage, 0 = kostenlos"><input id="price" name="price" inputMode="decimal" defaultValue={editing.priceCents == null ? "" : (editing.priceCents / 100).toString()} className={inputClass} /></Field>
            <Field label="Kapazität" htmlFor="capacity" hint="1 = Einzel, >1 = Gruppe (Termine unter „Gruppen“)"><input id="capacity" name="capacity" type="number" min={1} defaultValue={editing.capacity ?? 1} className={inputClass} /></Field>
            <Field label="Farbe" htmlFor="color"><input id="color" name="color" type="color" defaultValue={editing.color ?? "#e5383b"} className="h-11 w-full rounded-lg border border-line bg-surface-2" /></Field>
            <Field label="Puffer davor (Min.)" htmlFor="bufferBeforeMin"><input id="bufferBeforeMin" name="bufferBeforeMin" type="number" min={0} step={5} defaultValue={editing.bufferBeforeMin ?? 15} className={inputClass} /></Field>
            <Field label="Puffer danach (Min.)" htmlFor="bufferAfterMin"><input id="bufferAfterMin" name="bufferAfterMin" type="number" min={0} step={5} defaultValue={editing.bufferAfterMin ?? 15} className={inputClass} /></Field>
            <Field label="Mindestvorlauf (Std.)" htmlFor="minNoticeHours"><input id="minNoticeHours" name="minNoticeHours" type="number" min={0} step={0.5} defaultValue={(editing.minNoticeMin ?? 720) / 60} className={inputClass} /></Field>
            <Field label="Buchbar bis (Tage)" htmlFor="maxHorizonDays"><input id="maxHorizonDays" name="maxHorizonDays" type="number" min={1} defaultValue={editing.maxHorizonDays ?? 60} className={inputClass} /></Field>
            <Field label="Slot-Raster (Min.)" htmlFor="slotStepMin"><input id="slotStepMin" name="slotStepMin" type="number" min={5} step={5} defaultValue={editing.slotStepMin ?? 30} className={inputClass} /></Field>
            <Field label="Sichtbarkeit" htmlFor="visibility">
              <select id="visibility" name="visibility" defaultValue={editing.visibility ?? "public"} className={inputClass}>
                <option value="public">Öffentlich</option>
                <option value="unlisted">Nur per Link</option>
              </select>
            </Field>
            <Field label="Reihenfolge" htmlFor="sortOrder"><input id="sortOrder" name="sortOrder" type="number" defaultValue={editing.sortOrder ?? 0} className={inputClass} /></Field>
            <div className="sm:col-span-2"><Field label="Ort" htmlFor="location"><input id="location" name="location" defaultValue={editing.location} className={inputClass} /></Field></div>
            <div className="flex flex-wrap gap-6 sm:col-span-2 lg:col-span-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={editing.isActive ?? true} className="size-4" /> Aktiv</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="autoConfirm" defaultChecked={editing.autoConfirm ?? false} className="size-4" /> Auto-Bestätigung (sonst manuelle Freigabe)</label>
            </div>
            <div className="flex gap-3 sm:col-span-2 lg:col-span-4">
              <SubmitButton>Speichern</SubmitButton>
              <ButtonLink href="/admin/angebote" variant="ghost">Abbrechen</ButtonLink>
            </div>
          </form>
        </Card>
      )}

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {offerings.map((o) => (
          <li key={o.id}>
            <Card className="h-full" style={{ borderLeft: `4px solid ${o.color}` }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted">{KIND_LABELS[o.kind]}</p>
                  <p className="text-lg font-semibold">{o.name}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {!o.isActive && <Badge tone="bad">inaktiv</Badge>}
                  {o.visibility === "unlisted" && <Badge>nur per Link</Badge>}
                  {o.autoConfirm ? <Badge tone="ok">Auto</Badge> : <Badge>Manuell</Badge>}
                </div>
              </div>
              <p className="mt-2 text-sm text-muted">
                {formatPrice(o.priceCents)} · {o.durationMin} Min. · {o.capacity > 1 ? `Gruppe bis ${o.capacity}` : "Einzel"} · Puffer {o.bufferBeforeMin}/{o.bufferAfterMin} · Vorlauf {o.minNoticeMin / 60} Std.
              </p>
              <div className="mt-3 flex gap-4 text-sm">
                <Link href={`/admin/angebote?edit=${o.id}`} className="text-accent hover:underline">Bearbeiten</Link>
                <span className="truncate text-muted">{env.appUrl}/buchen?angebot={o.slug}</span>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <section className="mt-12">
        <h2 className="mb-1 text-lg font-semibold">Pakete (5er-/10er-Karten)</h2>
        <p className="mb-4 text-sm text-muted">
          {settings.features.packages ? "Öffentlich unter /pakete kaufbar (Stripe)." : "Pakete sind deaktiviert (Einstellungen → Zahlungen & Pakete)."} Guthaben kann im Kundenprofil auch manuell zugewiesen werden.
        </p>
        <ul className="mb-4 divide-y divide-line rounded-xl border border-line bg-surface">
          {packages.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <span><strong>{p.name}</strong> · {p.credits} Einheiten · {formatPrice(p.priceCents)}{p.validDays ? ` · ${p.validDays} Tage` : ""} · {p.sold}× verkauft</span>
              <form action={togglePackageAction}>
                <input type="hidden" name="id" value={p.id} />
                <SubmitButton size="sm" variant={p.isActive ? "secondary" : "primary"}>{p.isActive ? "Deaktivieren" : "Aktivieren"}</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
        <form action={savePackageAction} className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-5 sm:items-end">
          <div className="sm:col-span-2"><Field label="Name" htmlFor="p-name"><input id="p-name" name="name" required className={inputClass} placeholder="10er-Karte 1:1" /></Field></div>
          <Field label="Einheiten" htmlFor="p-credits"><input id="p-credits" name="credits" type="number" min={1} defaultValue={10} className={inputClass} /></Field>
          <Field label="Preis (€)" htmlFor="p-price"><input id="p-price" name="price" inputMode="decimal" required className={inputClass} /></Field>
          <Field label="Gültig (Tage)" htmlFor="p-valid"><input id="p-valid" name="validDays" type="number" min={1} className={inputClass} /></Field>
          <SubmitButton size="sm" className="sm:col-span-5 sm:w-fit">Paket anlegen</SubmitButton>
        </form>
      </section>
    </>
  );
}
