"use server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  AI_MODEL, AiNoResult, AiRefused, aiDailyLimit, isAiEnabled, suggestDefect,
  type AssistantInput, type DefectSuggestion,
} from "@/lib/ai/defect-assistant";
import { SEVERITIES, type ActionResult } from "@/lib/types";
import { ActionError, authed, fail } from "./common";
import { getAppSettings } from "@/lib/settings";

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // decoded; browser sends ~1280px JPEGs, stored photos are ≤2048px
const DATA_URI = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/;

const inputSchema = z.object({
  inspectionId: z.uuid(),
  defectId: z.uuid().nullable(),
  mode: z.enum(["analyze", "improve"]),
  lang: z.enum(["en", "ar"]),
  images: z.array(z.string().max(5_000_000)).max(MAX_IMAGES),
  context: z.object({
    title: z.string().max(200),
    description: z.string().max(4000),
    category: z.string().max(60),
    severity: z.enum(SEVERITIES),
    room: z.string().max(120),
    locationNote: z.string().max(200),
    recommendedAction: z.string().max(4000),
  }),
});

/**
 * Preliminary AI suggestion for a defect. Nothing is saved: the client shows the result for the
 * user to accept field by field. Images come from the browser (new defect) or from the defect's
 * stored photos (existing defect).
 */
export async function aiSuggestAction(raw: z.input<typeof inputSchema>): Promise<ActionResult<DefectSuggestion>> {
  if (!isAiEnabled()) return { ok: false, error: "aiDisabled" };
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;

  try {
    const { supabase } = await authed();

    const { data: insp } = await supabase.from("inspections").select("id").eq("id", v.inspectionId).maybeSingle();
    if (!insp) throw new ActionError("notFound");

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count, error: countErr } = await supabase
      .from("ai_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    // Fail closed: without the usage log (migration 0005) there is no spending limit, so don't call the API.
    if (countErr || count === null) {
      console.error("[ai] usage log unavailable — run supabase/migrations/0005_ai_requests.sql", countErr?.message);
      throw new ActionError("aiUnavailable");
    }
    // Admin → Settings overrides the server default (AI_DAILY_LIMIT, else 30).
    const limit = Number((await getAppSettings()).ai_daily_limit) || aiDailyLimit();
    if (count >= limit) throw new ActionError("aiLimit");

    const images: AssistantInput["images"] = [];
    for (const uri of v.images) {
      const m = DATA_URI.exec(uri);
      if (!m) throw new ActionError("fileType");
      if ((m[2].length * 3) / 4 > MAX_IMAGE_BYTES) throw new ActionError("fileTooBig");
      images.push({ mediaType: m[1] as AssistantInput["images"][number]["mediaType"], data: m[2] });
    }

    // Existing defect: use its stored photos (before photos first) when the browser sent none.
    if (v.defectId && images.length === 0) {
      const { data: photos } = await supabase
        .from("defect_photos")
        .select("storage_path, kind, defects!inner(inspection_id)")
        .eq("defect_id", v.defectId)
        .eq("defects.inspection_id", v.inspectionId)
        .order("kind", { ascending: true }) // 'after' < 'before' alphabetically → re-sort below
        .order("taken_at", { ascending: true });
      const ordered = [...(photos ?? [])].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "before" ? -1 : 1));
      for (const p of ordered.slice(0, MAX_IMAGES)) {
        const { data: blob } = await supabase.storage.from("defect-photos").download(p.storage_path as string);
        if (!blob) continue;
        const buf = Buffer.from(await blob.arrayBuffer());
        if (buf.length > MAX_IMAGE_BYTES) continue;
        const type = blob.type === "image/png" || blob.type === "image/webp" ? blob.type : "image/jpeg";
        images.push({ mediaType: type, data: buf.toString("base64") });
      }
    }

    if (v.mode === "analyze" && images.length === 0) throw new ActionError("aiNoPhotos");
    if (v.mode === "improve" && !v.context.title.trim() && !v.context.description.trim()) {
      throw new ActionError("aiNoText");
    }

    const log = (row: { ok: boolean; model?: string; inputTokens?: number; outputTokens?: number }) =>
      supabase.from("ai_requests").insert({
        inspection_id: v.inspectionId,
        kind: v.mode,
        model: row.model ?? AI_MODEL,
        input_tokens: row.inputTokens ?? 0,
        output_tokens: row.outputTokens ?? 0,
        image_count: images.length,
        ok: row.ok,
      });

    try {
      const { suggestion, usage } = await suggestDefect({ mode: v.mode, lang: v.lang, images, context: v.context });
      await log({ ok: true, ...usage });
      return { ok: true, data: suggestion };
    } catch (e) {
      const usage = (e as { usage?: { model: string; inputTokens: number; outputTokens: number } }).usage;
      await log({ ok: false, ...usage });
      if (e instanceof AiRefused || e instanceof AiNoResult) throw new ActionError("aiUnavailable");
      if (e instanceof Anthropic.RateLimitError) throw new ActionError("aiBusy");
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
        console.error("[ai] API key rejected", e.status);
        throw new ActionError("aiUnavailable");
      }
      if (e instanceof Anthropic.APIError) {
        console.error("[ai] API error", e.status, e.message);
        throw new ActionError("aiUnavailable");
      }
      throw e;
    }
  } catch (e) {
    return fail(e);
  }
}
