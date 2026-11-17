"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { collectReportData, ReportNotFound } from "@/lib/report/collect";
import { fontFaceCss } from "@/lib/report/fonts";
import { buildReportHtml } from "@/lib/report/html";
import { renderPdf } from "@/lib/report/render";
import { PdfEngineUnavailable } from "@/lib/report/chrome";
import type { ActionResult, Lang } from "@/lib/types";
import { todayIso } from "@/lib/i18n";
import { ActionError, authed, fail } from "./common";

const input = z.object({ inspectionId: z.uuid(), lang: z.enum(["en", "ar"]) });

function slug(s: string) {
  return (
    s
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 40) || "inspection"
  );
}

/**
 * Builds a new report version (never overwrites old ones), stores the PDF privately and
 * returns a short-lived download link.
 */
export async function generateReportAction(
  inspectionId: string,
  lang: Lang,
): Promise<ActionResult<{ url: string; version: number; pageCount: number }>> {
  const parsed = input.safeParse({ inspectionId, lang });
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const { user, supabase } = await authed();
    const data = await collectReportData(supabase, inspectionId, user.id);

    const { data: last } = await supabase
      .from("reports")
      .select("version")
      .eq("inspection_id", inspectionId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const version = (last?.version ?? 0) + 1;
    const generatedAt = new Date();

    const html = buildReportHtml(data, { version, generatedAt, lang }, await fontFaceCss());
    // Footer stays Latin-only: header/footer templates can't use the embedded fonts (no Arabic glyphs on servers).
    const { pdf, pageCount } = await renderPdf(html, `SNAGIT · v${version} · ${todayIso()}`);

    const fileName = `SNAGIT-${slug(data.property.project_name)}-v${version}-${lang}.pdf`;
    const path = `${user.id}/${inspectionId}/${generatedAt.getTime()}-${fileName}`;
    const { error: upErr } = await supabase.storage.from("reports").upload(path, pdf, { contentType: "application/pdf" });
    if (upErr) throw upErr;

    const open = data.defects.filter((x) => x.status !== "resolved" && x.status !== "rejected");
    const { error: rowErr } = await supabase.from("reports").insert({
      inspection_id: inspectionId,
      version,
      language: lang,
      storage_path: path,
      byte_size: pdf.length,
      page_count: pageCount,
      summary: {
        defects_total: data.defects.length,
        defects_open: open.length,
        open_critical: open.filter((x) => x.severity === "critical").length,
        open_high: open.filter((x) => x.severity === "high").length,
        items_total: data.summary.items_total,
        items_passed: data.summary.items_passed,
        items_failed: data.summary.items_failed,
        status: data.inspection.status,
      },
    });
    if (rowErr) {
      await supabase.storage.from("reports").remove([path]);
      throw rowErr;
    }

    const { data: signed } = await supabase.storage.from("reports").createSignedUrl(path, 3600, { download: fileName });
    revalidatePath(`/inspections/${inspectionId}/report`);
    return { ok: true, data: { url: signed?.signedUrl ?? "", version, pageCount } };
  } catch (e) {
    if (e instanceof ReportNotFound) return fail(new ActionError("notFound"));
    if (e instanceof PdfEngineUnavailable) return fail(new ActionError("pdfEngine"));
    return fail(e);
  }
}
