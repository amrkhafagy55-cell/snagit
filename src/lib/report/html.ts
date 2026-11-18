import "server-only";
import { categoryLabel, formatDate, formatNumber, getDictionary, itemTitle, roomLabel } from "@/lib/i18n";
import type { ChecklistResult, DefectStatus, Lang, Severity } from "@/lib/types";
import { SEVERITIES } from "@/lib/types";
import type { ReportData, ReportDefect } from "./collect";

const SEV_HEX: Record<Severity, { bg: string; fg: string; soft: string }> = {
  critical: { bg: "#dc2626", fg: "#ffffff", soft: "#fef2f2" },
  high: { bg: "#ea580c", fg: "#ffffff", soft: "#fff7ed" },
  medium: { bg: "#eab308", fg: "#0b1528", soft: "#fefce8" },
  low: { bg: "#2563eb", fg: "#ffffff", soft: "#eff6ff" },
};
const STATUS_HEX: Record<DefectStatus, string> = {
  open: "#b91c1c",
  under_correction: "#b45309",
  pending_reinspection: "#6d28d9",
  resolved: "#047857",
  rejected: "#475569",
};
const CLOSED: DefectStatus[] = ["resolved", "rejected"];

/** Escapes text for HTML element content and attribute values. */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** User-entered text: escaped, line breaks kept, direction detected per paragraph. */
const u = (v: unknown) => `<span class="u">${esc(v).replace(/\r?\n/g, "<br>")}</span>`;

export type ReportMeta = { version: number; generatedAt: Date; lang: Lang; preview: boolean };

export function buildReportHtml(data: ReportData, meta: ReportMeta, fontCss: string): string {
  const { lang } = meta;
  const t = getDictionary(lang);
  const r = t.report;
  const n = (v: number) => formatNumber(v, lang);
  const d = (v: string | null) => formatDate(v, lang);
  const { inspection, property, defects, rooms, items, summary, profile, plan } = data;

  const roomName = new Map(rooms.map((room) => [room.id, roomLabel(room, t)]));
  const open = defects.filter((x) => !CLOSED.includes(x.status));
  const openBy = (s: Severity) => open.filter((x) => x.severity === s).length;
  const allBy = (s: Severity) => defects.filter((x) => x.severity === s).length;
  const completion = summary.items_total ? Math.round(((summary.items_passed + summary.items_failed) / summary.items_total) * 100) : 0;
  const notInspected = summary.items_total - summary.items_passed - summary.items_failed;

  const verdict =
    openBy("critical") > 0
      ? { text: r.verdictCritical.replace("{n}", n(openBy("critical"))), color: "#b91c1c", soft: "#fef2f2" }
      : openBy("high") > 0
        ? { text: r.verdictHigh.replace("{n}", n(openBy("high"))), color: "#c2410c", soft: "#fff7ed" }
        : open.length > 0
          ? { text: r.verdictMinor.replace("{n}", n(open.length)), color: "#a16207", soft: "#fefce8" }
          : { text: r.verdictClear, color: "#047857", soft: "#ecfdf5" };

  const sevPill = (s: Severity) =>
    `<span class="pill" style="background:${SEV_HEX[s].bg};color:${SEV_HEX[s].fg}">${esc(t.severity[s])}</span>`;
  const statusPill = (s: DefectStatus) =>
    `<span class="pill outline" style="color:${STATUS_HEX[s]};border-color:${STATUS_HEX[s]}">${esc(t.defectStatus[s])}</span>`;
  const marker = (defect: Pick<ReportDefect, "number" | "severity">, cls = "num") =>
    `<span class="${cls}" style="background:${SEV_HEX[defect.severity].bg};color:${SEV_HEX[defect.severity].fg}">${defect.number}</span>`;

  const unitLine = [
    property.building_number && `${t.property.building} ${property.building_number}`,
    property.apartment_number && `${t.property.apt} ${property.apartment_number}`,
    property.floor_number && `${t.property.floor} ${property.floor_number}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const infoRows = (rows: [string, string | null | undefined][]) =>
    rows
      .filter(([, v]) => v)
      .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${u(v)}</td></tr>`)
      .join("");

  const previewText = lang === "ar" ? "نسخة تجريبية — غير صالحة للاستلام" : "PREVIEW — not valid for handover";
  // position:fixed repeats on every printed page in Chromium.
  const watermark = meta.preview ? `<div class="watermark" aria-hidden="true">${esc(lang === "ar" ? "نسخة تجريبية" : "PREVIEW")}</div>` : "";

  // ---------------------------------------------------------------- Cover
  const cover = `
  <section class="cover">
    ${meta.preview ? `<div class="preview-banner">${esc(previewText)}</div>` : ""}
    <div class="cover-band">
      ${logoSvg()}
      <div class="cover-kicker">${esc(r.docSubtitle)}</div>
    </div>
    <h1>${esc(r.docTitle)}</h1>
    <div class="cover-project">${u(property.project_name)}</div>
    <div class="cover-unit"><bdi>${esc(unitLine || t.propertyTypes[property.property_type])}</bdi>${property.address ? ` · <bdi>${esc(property.address)}</bdi>` : ""}</div>

    <div class="cover-grid">
      <div>
        <h3>${esc(r.unitDetails)}</h3>
        <table class="kv">${infoRows([
          [t.property.propertyType, t.propertyTypes[property.property_type]],
          [t.property.developerName, property.developer_name],
          [t.property.buildingNumber, property.building_number],
          [t.property.apartmentNumber, property.apartment_number],
          [t.property.floorNumber, property.floor_number],
          [t.property.bedrooms, String(property.bedrooms)],
          [t.property.bathrooms, String(property.bathrooms)],
          [t.property.ownerName, property.owner_name],
        ])}</table>
      </div>
      <div>
        <h3>${esc(r.inspectionInfo)}</h3>
        <table class="kv">${infoRows([
          [t.property.inspectionDate, d(inspection.inspection_date)],
          [t.property.inspectorName, inspection.inspector_name || profile?.full_name],
          [r.company, profile?.company],
          [r.phone, profile?.phone],
          [r.status, t.status[inspection.status]],
          [r.reportVersion, `v${meta.version}`],
          [r.reportDate, d(meta.generatedAt.toISOString())],
        ])}</table>
      </div>
    </div>

    <div class="verdict" style="border-color:${verdict.color};background:${verdict.soft}">
      <div class="verdict-label" style="color:${verdict.color}">${esc(r.overall)}</div>
      <div class="verdict-text">${esc(verdict.text)}</div>
    </div>

    <div class="kpis">
      <div class="kpi"><b>${n(defects.length)}</b><span>${esc(r.totalDefects)}</span></div>
      <div class="kpi"><b>${n(open.length)}</b><span>${esc(r.openDefects)}</span></div>
      <div class="kpi" style="border-color:${SEV_HEX.critical.bg}"><b style="color:${SEV_HEX.critical.bg}">${n(allBy("critical"))}</b><span>${esc(t.severity.critical)}</span></div>
      <div class="kpi" style="border-color:${SEV_HEX.high.bg}"><b style="color:${SEV_HEX.high.bg}">${n(allBy("high"))}</b><span>${esc(t.severity.high)}</span></div>
      <div class="kpi"><b>${n(completion)}%</b><span>${esc(r.completion)}</span></div>
    </div>
    <div class="cover-foot"><bdi>${esc(r.preparedWith)}</bdi> · <bdi>v${meta.version}</bdi> · <bdi>${esc(d(meta.generatedAt.toISOString()))}</bdi></div>
  </section>`;

  // ---------------------------------------------------------------- Executive summary
  const maxSev = Math.max(1, ...SEVERITIES.map(allBy));
  const roomRows = [...rooms.map((room) => ({ id: room.id as string | null, label: roomLabel(room, t) })), { id: null, label: t.defect.noRoom }]
    .map((room) => {
      const list = defects.filter((x) => x.room_id === room.id);
      return { ...room, list };
    })
    .filter((room) => room.list.length > 0);

  const summarySection = `
  <section class="page">
    <h2>${esc(r.execSummary)}</h2>
    <div class="verdict" style="border-color:${verdict.color};background:${verdict.soft}">
      <div class="verdict-label" style="color:${verdict.color}">${esc(r.overall)}</div>
      <div class="verdict-text">${esc(verdict.text)}</div>
    </div>
    <div class="two">
      <div>
        <h3>${esc(r.bySeverity)}</h3>
        <table class="grid">
          <thead><tr><th>${esc(t.defect.severity)}</th><th class="c">${esc(r.total)}</th><th class="c">${esc(r.openDefects)}</th><th></th></tr></thead>
          <tbody>${SEVERITIES.map(
            (s) => `<tr><td>${sevPill(s)}</td><td class="c">${n(allBy(s))}</td><td class="c">${n(openBy(s))}</td>
              <td class="barcell"><div class="bar" style="width:${(allBy(s) / maxSev) * 100}%;background:${SEV_HEX[s].bg}"></div></td></tr>`,
          ).join("")}
          <tr class="sum"><td>${esc(r.total)}</td><td class="c">${n(defects.length)}</td><td class="c">${n(open.length)}</td><td></td></tr></tbody>
        </table>
      </div>
      <div>
        <h3>${esc(t.workspace.progress)}</h3>
        <table class="grid">
          <tbody>
            <tr><td>${esc(t.results.passed)}</td><td class="c ok">${n(summary.items_passed)}</td></tr>
            <tr><td>${esc(t.results.failed)}</td><td class="c bad">${n(summary.items_failed)}</td></tr>
            <tr><td>${esc(t.results.not_inspected)}</td><td class="c muted">${n(notInspected)}</td></tr>
            <tr class="sum"><td>${esc(r.completion)}</td><td class="c">${n(completion)}%</td></tr>
          </tbody>
        </table>
        <table class="grid" style="margin-top:4mm">
          <tbody>
            <tr><td>${esc(r.openDefects)}</td><td class="c">${n(open.length)}</td></tr>
            <tr><td>${esc(r.closedDefects)}</td><td class="c">${n(defects.length - open.length)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    ${
      roomRows.length
        ? `<h3>${esc(r.byRoom)}</h3>
    <table class="grid">
      <thead><tr><th>${esc(t.defect.room)}</th>${SEVERITIES.map((s) => `<th class="c">${sevPill(s)}</th>`).join("")}<th class="c">${esc(r.total)}</th><th class="c">${esc(r.openDefects)}</th></tr></thead>
      <tbody>${roomRows
        .map(
          (room) => `<tr><td>${u(room.label)}</td>${SEVERITIES.map((s) => {
            const c = room.list.filter((x) => x.severity === s).length;
            return c ? `<td class="c">${n(c)}</td>` : `<td class="c muted">–</td>`;
          }).join("")}
          <td class="c"><b>${n(room.list.length)}</b></td><td class="c">${n(room.list.filter((x) => !CLOSED.includes(x.status)).length)}</td></tr>`,
        )
        .join("")}</tbody>
    </table>`
        : ""
    }
  </section>`;

  // ---------------------------------------------------------------- Floor plan
  let planSection = "";
  if (plan) {
    const maxW = 180; // mm (A4 210 − 28 margins − border)
    const maxH = 205; // mm, leaves room for title and legend
    const scale = Math.min(maxW / plan.width, maxH / plan.height);
    const w = (plan.width * scale).toFixed(1);
    const h = (plan.height * scale).toFixed(1);
    const pinned = defects.filter((x) => x.plan_x !== null && x.plan_y !== null);
    const unpinned = defects.filter((x) => x.plan_x === null || x.plan_y === null);
    planSection = `
  <section class="page">
    <h2>${esc(r.floorPlan)}</h2>
    <div class="legend">${SEVERITIES.map((s) => `<span><i style="background:${SEV_HEX[s].bg}"></i>${esc(t.severity[s])}</span>`).join("")}</div>
    <div class="plan" dir="ltr" style="width:${w}mm;height:${h}mm">
      <img src="${plan.dataUri}" alt="">
      ${pinned
        .map(
          (x) =>
            `<span class="pin${CLOSED.includes(x.status) ? " closed" : ""}" style="left:${(x.plan_x! * 100).toFixed(3)}%;top:${(x.plan_y! * 100).toFixed(3)}%;background:${SEV_HEX[x.severity].bg};color:${SEV_HEX[x.severity].fg}">${x.number}</span>`,
        )
        .join("")}
    </div>
    ${unpinned.length ? `<p class="small muted" style="margin-top:3mm">${esc(r.notPinned)}: ${unpinned.map((x) => `D-${x.number}`).join(", ")}</p>` : ""}
  </section>`;
  }

  // ---------------------------------------------------------------- Defect register
  const photoBlock = (defect: ReportDefect) => {
    const groups = (["before", "after"] as const)
      .map((kind) => ({ kind, list: defect.photos.filter((p) => p.kind === kind) }))
      .filter((g) => g.list.length);
    if (!groups.length) return "";
    const compare = groups.length === 2;
    return `<div class="${compare ? "compare" : ""}">${groups
      .map(
        (g) => `<div><div class="photos-label">${esc(g.kind === "before" ? r.before : r.after)}</div>
        <div class="photos${compare ? " one" : ""}">${g.list.map((p) => `<figure><img src="${p.dataUri}" alt=""><figcaption>${esc(d(p.takenAt))}</figcaption></figure>`).join("")}</div></div>`,
      )
      .join("")}</div>`;
  };

  const register = `
  <section class="page">
    <h2>${esc(r.register)}</h2>
    ${
      defects.length === 0
        ? `<p class="muted">${esc(r.noDefects)}</p>`
        : defects
            .map((x) => {
              const meta2: [string, string][] = [
                [t.defect.room, x.room_id ? roomName.get(x.room_id) ?? "" : t.defect.noRoom],
                [r.location, x.location_note],
                [t.defect.category, categoryLabel(x.category, t)],
                [t.defect.identified, d(x.identified_on)],
                [t.defect.responsible, x.responsible_party],
                [t.defect.correctedOn, x.corrected_on ? d(x.corrected_on) : ""],
              ];
              return `
      <article class="defect${x.photos.length <= 4 ? " keep" : ""}" style="border-inline-start-color:${SEV_HEX[x.severity].bg}">
        <header>
          <span class="dnum" dir="ltr">D-${x.number}</span>
          <h4>${u(x.title)}</h4>
          <span class="pills">${sevPill(x.severity)} ${statusPill(x.status)}</span>
        </header>
        <dl class="meta">${meta2
          .filter(([, v]) => v)
          .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${u(v)}</dd></div>`)
          .join("")}</dl>
        ${x.description ? `<p class="desc">${u(x.description)}</p>` : ""}
        ${x.recommended_action ? `<div class="action"><b>${esc(r.action)}</b><p>${u(x.recommended_action)}</p></div>` : ""}
        ${x.reinspection_notes ? `<div class="reinsp"><b>${esc(r.reinspection)}</b><p>${u(x.reinspection_notes)}</p></div>` : ""}
        ${photoBlock(x)}
      </article>`;
            })
            .join("")
    }
  </section>`;

  // ---------------------------------------------------------------- Checklist
  const resultCell = (res: ChecklistResult) =>
    res === "passed"
      ? `<td class="c ok">✓ ${esc(t.results.passed)}</td>`
      : res === "failed"
        ? `<td class="c bad">✗ ${esc(t.results.failed)}</td>`
        : `<td class="c muted">– ${esc(t.results.not_inspected)}</td>`;
  const checklist = `
  <section class="page">
    <h2>${esc(r.checklist)}</h2>
    ${rooms
      .map((room) => {
        const list = items.filter((it) => it.room_id === room.id);
        if (!list.length) return "";
        const passed = list.filter((it) => it.result === "passed").length;
        const failed = list.filter((it) => it.result === "failed").length;
        return `
      <div class="room">
        <h3>${u(roomLabel(room, t))} <span class="small muted">· ✓ ${n(passed)} · ✗ ${n(failed)} · ${n(list.length)}</span></h3>
        <table class="grid compact">
          <thead><tr><th>${esc(r.item)}</th><th>${esc(t.defect.category)}</th><th class="c">${esc(r.result)}</th><th>${esc(r.notes)}</th></tr></thead>
          <tbody>${list
            .map((it) => `<tr><td>${u(itemTitle(it, lang))}</td><td>${u(categoryLabel(it.category, t))}</td>${resultCell(it.result)}<td>${it.notes ? u(it.notes) : ""}</td></tr>`)
            .join("")}</tbody>
        </table>
      </div>`;
      })
      .join("")}
  </section>`;

  // ---------------------------------------------------------------- Final remarks + signatures
  const recs = [
    openBy("critical") > 0 && r.recCritical,
    openBy("high") > 0 && r.recHigh,
    open.length > 0 && r.recReinspect,
    r.recKeep,
  ].filter(Boolean) as string[];
  const inspectorName = inspection.inspector_name || profile?.full_name || "";
  const final = `
  <section class="page">
    <h2>${esc(r.finalRemarks)}</h2>
    <h3>${esc(r.observations)}</h3>
    <p>${inspection.general_remarks ? u(inspection.general_remarks) : `<span class="muted">${esc(r.noRemarks)}</span>`}</p>
    <h3>${esc(r.recommendations)}</h3>
    <ol class="recs">${recs.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
    <h3>${esc(r.outstanding)}</h3>
    ${
      open.length
        ? `<table class="grid compact keep-rows">
      <thead><tr><th class="c">#</th><th>${esc(t.defect.title)}</th><th>${esc(t.defect.room)}</th><th class="c">${esc(t.defect.severity)}</th><th class="c">${esc(t.defect.status)}</th></tr></thead>
      <tbody>${[...open]
        .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) || a.number - b.number)
        .map(
          (x) => `<tr><td class="c">${marker(x)}</td><td>${u(x.title)}</td><td>${u(x.room_id ? roomName.get(x.room_id) ?? "" : t.defect.noRoom)}</td>
          <td class="c">${sevPill(x.severity)}</td><td class="c">${statusPill(x.status)}</td></tr>`,
        )
        .join("")}</tbody>
    </table>`
        : `<p class="muted">${esc(r.noOutstanding)}</p>`
    }
    <div class="signatures">
      ${[
        { role: r.inspectorSig, name: inspectorName },
        { role: r.ownerSig, name: property.owner_name },
      ]
        .map(
          (s) => `<div class="sig">
        <div class="sig-role">${esc(s.role)}</div>
        <div class="sig-row"><span>${esc(r.name)}</span><b>${s.name ? u(s.name) : ""}</b></div>
        <div class="sig-row"><span>${esc(r.signature)}</span><b></b></div>
        <div class="sig-row"><span>${esc(r.date)}</span><b></b></div>
      </div>`,
        )
        .join("")}
    </div>
    <p class="disclaimer">${esc(r.disclaimer)}</p>
  </section>`;

  return `<!doctype html>
<html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8">
<title>${esc(r.docTitle)} · ${esc(property.project_name)}</title>
<style>
${fontCss}
${css(lang)}
</style>
</head>
<body>
${watermark}
${cover}
${summarySection}
${planSection}
${register}
${checklist}
${final}
</body>
</html>`;
}

function css(lang: Lang) {
  const font = lang === "ar" ? `"SnagitArabic", "SnagitLatin", sans-serif` : `"SnagitLatin", "SnagitArabic", sans-serif`;
  return `
@page { size: A4; margin: 16mm 14mm 18mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: ${font}; font-size: 9.6pt; line-height: 1.5; color: #12213e; }
.u { unicode-bidi: plaintext; }
p { margin: 0 0 2.5mm; }
h2 { font-size: 15pt; margin: 0 0 4mm; padding-inline-start: 3mm; border-inline-start: 1.6mm solid #f97316; line-height: 1.25; }
h3 { font-size: 10.5pt; margin: 5mm 0 2mm; color: #1b2f56; }
h4 { margin: 0; font-size: 10.5pt; flex: 1; }
.page { break-before: page; }
.small { font-size: 8pt; }
.muted { color: #6286c2; }
.ok { color: #047857; font-weight: 600; }
.bad { color: #b91c1c; font-weight: 600; }
.c { text-align: center; }
.pill { display: inline-block; padding: 0.4mm 2.2mm; border-radius: 10mm; font-size: 7.6pt; font-weight: 700; white-space: nowrap; }
.pill.outline { background: #fff; border: 0.3mm solid; }
.num { display: inline-grid; place-items: center; min-width: 5.6mm; height: 5.6mm; padding: 0 1mm; border-radius: 10mm; font-size: 7.6pt; font-weight: 700; }

/* Cover */
.cover { min-height: 262mm; display: flex; flex-direction: column; }
.cover-band { display: flex; align-items: center; justify-content: space-between; background: #12213e; color: #fff; border-radius: 4mm; padding: 6mm 7mm; }
.cover-kicker { font-size: 9pt; color: #bfd0ea; }
.cover h1 { font-size: 24pt; margin: 14mm 0 2mm; line-height: 1.2; }
.cover-project { font-size: 18pt; font-weight: 700; color: #e15d0a; }
.cover-unit { font-size: 10.5pt; color: #3f65a8; margin-top: 1mm; }
.cover-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; margin-top: 10mm; }
.kv { width: 100%; border-collapse: collapse; }
.kv th { text-align: start; font-weight: 400; color: #3f65a8; padding: 1.4mm 0; width: 42%; border-bottom: 0.2mm solid #dfe8f5; vertical-align: top; }
.kv td { padding: 1.4mm 0; border-bottom: 0.2mm solid #dfe8f5; font-weight: 600; }
.verdict { border: 0.4mm solid; border-inline-start-width: 2mm; border-radius: 2.5mm; padding: 3.5mm 4.5mm; margin: 6mm 0 4mm; }
.verdict-label { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3mm; }
.verdict-text { font-size: 11.5pt; font-weight: 700; margin-top: 1mm; }
.kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3mm; }
.kpi { border: 0.3mm solid #dfe8f5; border-radius: 2.5mm; padding: 3mm; text-align: center; }
.kpi b { display: block; font-size: 17pt; line-height: 1.1; }
.kpi span { font-size: 7.6pt; color: #3f65a8; }
.cover-foot { margin-top: auto; padding-top: 6mm; font-size: 8pt; color: #6286c2; border-top: 0.2mm solid #dfe8f5; }

/* Tables */
.two { display: grid; grid-template-columns: 1.3fr 1fr; gap: 8mm; }
.grid { width: 100%; border-collapse: collapse; }
.grid th { background: #f1f5fb; color: #243f72; font-size: 8pt; font-weight: 700; text-align: start; padding: 1.8mm 2mm; border-bottom: 0.3mm solid #bfd0ea; }
.grid td { padding: 1.6mm 2mm; border-bottom: 0.2mm solid #dfe8f5; vertical-align: top; }
.grid th.c, .grid td.c { text-align: center; }
.grid tr { break-inside: avoid; }
.grid tr.sum td { font-weight: 700; border-top: 0.3mm solid #bfd0ea; }
.grid.compact td { padding: 1.1mm 2mm; font-size: 8.6pt; }
.barcell { width: 32%; }
.bar { height: 2.6mm; border-radius: 2mm; min-width: 0.5mm; }

/* Floor plan */
.legend { display: flex; gap: 5mm; font-size: 8pt; margin-bottom: 3mm; }
.legend i { display: inline-block; width: 3mm; height: 3mm; border-radius: 3mm; margin-inline-end: 1.2mm; vertical-align: -0.4mm; }
.plan { position: relative; margin: 0 auto; border: 0.3mm solid #dfe8f5; }
.plan img { position: absolute; inset: 0; width: 100%; height: 100%; }
.pin { position: absolute; transform: translate(-50%, -50%); min-width: 6mm; height: 6mm; padding: 0 1mm; border-radius: 6mm; display: grid; place-items: center; font-size: 7.6pt; font-weight: 700; border: 0.5mm solid #fff; box-shadow: 0 0.3mm 1mm rgba(0,0,0,.35); }
.pin.closed { opacity: .55; }

/* Defect register */
.defect { border: 0.3mm solid #dfe8f5; border-inline-start: 1.6mm solid; border-radius: 2.5mm; padding: 3.5mm 4mm; margin-bottom: 4mm; }
.defect.keep { break-inside: avoid; }
.defect header { display: flex; align-items: center; gap: 2.5mm; break-after: avoid; }
.dnum { background: #12213e; color: #fff; font-weight: 700; font-size: 8pt; padding: 0.6mm 1.8mm; border-radius: 1.2mm; }
.pills { display: flex; gap: 1.5mm; }
.meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5mm 5mm; margin: 2.5mm 0; }
.meta dt { font-size: 7.4pt; color: #6286c2; }
.meta dd { margin: 0; font-weight: 600; font-size: 8.8pt; }
.desc { margin-top: 1.5mm; }
.action, .reinsp { border-radius: 1.8mm; padding: 2.2mm 3mm; margin: 2mm 0; break-inside: avoid; }
.action { background: #fff6ed; border-inline-start: 1mm solid #f97316; }
.reinsp { background: #f1f5fb; border-inline-start: 1mm solid #3f65a8; }
.action b, .reinsp b { font-size: 8pt; }
.action p, .reinsp p { margin: 0.6mm 0 0; }
.photos-label { font-size: 8pt; font-weight: 700; color: #243f72; margin: 2.5mm 0 1.2mm; }
.photos { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5mm; }
.photos.one { grid-template-columns: 1fr; }
.compare { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
.photos figure { margin: 0; break-inside: avoid; }
.photos img { width: 100%; height: 58mm; object-fit: contain; background: #f1f5fb; border-radius: 1.5mm; display: block; }
.photos figcaption { font-size: 7pt; color: #6286c2; margin-top: 0.6mm; }

/* Checklist */
.room { break-inside: auto; }
.room h3 { break-after: avoid; }

/* Final */
.recs { margin: 0 0 3mm; padding-inline-start: 6mm; }
.recs li { margin-bottom: 1.2mm; }
.signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; margin-top: 10mm; break-inside: avoid; }
.sig { border: 0.3mm solid #bfd0ea; border-radius: 2.5mm; padding: 4mm 5mm; }
.sig-role { font-weight: 700; margin-bottom: 3mm; }
.sig-row { display: flex; align-items: flex-end; gap: 3mm; margin-top: 5mm; }
.sig-row span { font-size: 8pt; color: #3f65a8; width: 18mm; flex: none; }
.sig-row b { flex: 1; border-bottom: 0.3mm solid #93afd9; min-height: 5mm; font-weight: 600; }
.watermark { position: fixed; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 64pt; font-weight: 700; color: rgba(220, 38, 38, 0.13); white-space: nowrap; z-index: 1000; pointer-events: none; letter-spacing: 2mm; }
.preview-banner { background: #fef2f2; color: #b91c1c; border: 0.4mm solid #fecaca; border-radius: 2mm; padding: 2mm 4mm; font-weight: 700; font-size: 9pt; margin-bottom: 4mm; text-align: center; }
.disclaimer { margin-top: 10mm; font-size: 7.6pt; color: #6286c2; border-top: 0.2mm solid #dfe8f5; padding-top: 3mm; }
`;
}

function logoSvg() {
  return `<div dir="ltr" style="display:flex;align-items:center;gap:3mm">
  <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">
    <rect width="32" height="32" rx="9" fill="#ffffff"/>
    <path d="M8 23V12l8-5 8 5v11h-5v-6h-6v6H8Z" fill="none" stroke="#12213e" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="23.5" cy="22.5" r="4.5" fill="#f97316"/>
    <path d="m21.6 22.6 1.3 1.3 2.3-2.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
  <span style="font-family:'SnagitLatin',sans-serif;font-weight:700;font-size:17pt;letter-spacing:-0.2mm">SNAG<span style="color:#f97316">IT</span></span>
</div>`;
}
