import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Lang, Severity } from "@/lib/types";

export const AI_MODEL = "claude-opus-5-5";

/** The assistant is optional: it exists only when the server has an API key (never sent to the browser). */
export function isAiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function aiDailyLimit(): number {
  const n = Number(process.env.AI_DAILY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
}

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic({ timeout: 90_000, maxRetries: 2 });
  return client;
}

/** What the model must return. Plain strings/enums only, so it maps cleanly onto structured outputs. */
const SuggestionSchema = z.object({
  defect_visible: z
    .boolean()
    .describe("True if the photos show a construction defect or snag; false if unclear, unrelated or no photos."),
  title: z.string().describe("Short, specific defect title (max ~80 characters)."),
  category: z.enum(["architectural", "electrical", "plumbing", "mechanical", "other"]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  severity_reason: z.string().describe("One sentence explaining the suggested severity, hedged."),
  description: z
    .string()
    .describe("Professional description of what is visible: location, extent, pattern. No invented measurements."),
  recommended_action: z.string().describe("Preliminary corrective action in general good-practice terms."),
  possible_causes: z.array(z.string()).describe("Possible causes, each phrased as a possibility, never as a finding."),
  serious_flags: z
    .array(z.string())
    .describe("Visible signs that could indicate a safety or structural concern needing a qualified specialist. Empty if none."),
  verify_on_site: z.array(z.string()).describe("Concrete checks the inspector should do on site to confirm."),
  confidence: z.enum(["low", "medium", "high"]),
});
export type DefectSuggestion = z.infer<typeof SuggestionSchema>;

const SYSTEM_PROMPT = `You assist property snagging inspectors and apartment buyers in Egypt and the Gulf who are documenting defects in newly delivered units before handover. You turn photos and short notes into a clear, professional defect record that the inspector will review, edit and confirm.

How your output is used: every field is shown to the inspector as a preliminary suggestion with its own "use" button. Nothing is saved until a person confirms it, and the confirmed text may appear in a handover report given to a developer. Write so that text is accurate and defensible.

Evidence and wording:
- Describe only what is visible or what the inspector told you. Do not invent measurements, counts, brands, ages or locations; if size matters and is not visible, say it should be measured.
- A photo cannot prove that a structure is safe, and cannot establish the definitive cause of a defect. Never state either. Phrase causes as possibilities ("may indicate", "commonly caused by"), and put them in possible_causes, not in the description.
- If the photos are blurry, too dark, unrelated to construction, or show no defect, set defect_visible to false, use confidence "low", and say what photo would help.
- Recommended actions are preliminary good practice (what a competent contractor would normally do), not engineering instructions, and include re-testing or reinspection where relevant. No prices or product brands.

Severity guide:
- critical: possible immediate risk to safety or major damage (e.g. exposed live conductors, missing/ineffective earth or RCD protection, active leak onto electrics, gas smell or fittings, unstable or low balcony railing, wide or stepped cracks in structural elements, signs of movement).
- high: function or water-tightness compromised or likely to cause damage if left (leaks, ponding toward walls, hollow tiles over large areas, doors/windows that don't close or seal).
- medium: noticeable workmanship defect that should be corrected before handover (hairline cracks in plaster, misalignment, uneven grout, poor sealant).
- low: cosmetic finish issue (paint marks, minor scratches, small chips).
When in doubt between two levels, choose the higher one and say why in severity_reason.

serious_flags: list any visible sign that could indicate a structural, electrical, gas, fall or water-ingress risk, each with a short reason and "assessment by a qualified engineer/specialist recommended". Leave empty when nothing suggests such a risk; do not add generic warnings.

Category: architectural (finishes, cracks, tiles, doors, windows, railings, waterproofing), electrical, plumbing (water supply, drainage, sanitary fittings, heaters), mechanical (HVAC, ventilation, equipment), other.

Language: write every string in the language requested in the user message. For Arabic use clear Modern Standard Arabic as used in Egyptian construction practice (e.g. شرخ، محارة، بلاط مطبل، عزل، صفاية، قاطع تسريب). Keep each field concise: title under 80 characters, description and recommended_action under 600 characters, at most 4 items per list.`;

export type AssistantInput = {
  mode: "analyze" | "improve";
  lang: Lang;
  images: { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string }[];
  context: {
    title: string;
    description: string;
    category: string;
    severity: Severity;
    room: string;
    locationNote: string;
    recommendedAction: string;
  };
};

export class AiRefused extends Error {}
export class AiNoResult extends Error {}

export async function suggestDefect(input: AssistantInput) {
  const { mode, lang, images, context } = input;
  const languageName = lang === "ar" ? "Arabic" : "English";
  const known = [
    context.room && `Room / location: ${context.room}`,
    context.locationNote && `Exact spot: ${context.locationNote}`,
    context.title && `Inspector's title: ${context.title}`,
    context.category && `Inspector's category: ${context.category}`,
    `Inspector's current severity: ${context.severity}`,
    context.description && `Inspector's description: ${context.description}`,
    context.recommendedAction && `Inspector's recommended action: ${context.recommendedAction}`,
  ]
    .filter(Boolean)
    .join("\n");

  const task =
    mode === "analyze"
      ? `Analyze the attached photo(s) of a possible defect and draft the defect record. Use the inspector's notes below as context; where the photos and the notes disagree, describe what is visible and mention the difference in verify_on_site.`
      : `Rewrite the inspector's defect record in clear, professional technical wording for a handover report. Keep every fact the inspector gave and do not add new facts; if something important is missing, list it in verify_on_site. Photos, if attached, are context only.`;

  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...images.map(
      (img): Anthropic.Beta.BetaContentBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.data },
      }),
    ),
    {
      type: "text",
      text: `${task}\n\nWrite all text in ${languageName}.\n\nInspector's notes (may be empty or in another language):\n<notes>\n${known || "(none)"}\n</notes>`,
    },
  ];

  const response = await getClient().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    // Opus 5.5 defaults to medium; set it explicitly. Adaptive thinking is always on for this model.
    output_config: { effort: "medium", format: betaZodOutputFormat(SuggestionSchema) },
    // If a safety classifier declines, retry server-side on Anthropic's recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  const usage = {
    model: response.model,
    inputTokens: response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0),
    outputTokens: response.usage.output_tokens,
  };
  if (response.stop_reason === "refusal") throw Object.assign(new AiRefused("refused"), { usage });
  const out = response.parsed_output;
  if (!out) throw Object.assign(new AiNoResult(`no parsed output (${response.stop_reason})`), { usage });

  const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
  const suggestion: DefectSuggestion = {
    ...out,
    title: clip(out.title.trim(), 200),
    severity_reason: clip(out.severity_reason.trim(), 400),
    description: clip(out.description.trim(), 4000),
    recommended_action: clip(out.recommended_action.trim(), 4000),
    possible_causes: out.possible_causes.slice(0, 4).map((x) => clip(x, 300)),
    serious_flags: out.serious_flags.slice(0, 4).map((x) => clip(x, 300)),
    verify_on_site: out.verify_on_site.slice(0, 4).map((x) => clip(x, 300)),
  };
  return { suggestion, usage };
}
