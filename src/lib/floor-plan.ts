"use client";
import { createClient } from "@/lib/supabase/client";
import { FLOOR_PLAN_MAX_BYTES, FLOOR_PLAN_TYPES } from "@/lib/validation";

/** Longest edge of the image rendered from a PDF plan. Sharp enough to zoom and to print in reports. */
const PDF_RENDER_EDGE = 2400;

export type FloorPlanUpload = {
  floorPlanPath: string;
  floorPlanMime: (typeof FLOOR_PLAN_TYPES)[number];
  floorPlanImagePath: string;
  floorPlanWidth: number;
  floorPlanHeight: number;
};

export function validateFloorPlan(file: File): "fileType" | "fileTooBig" | null {
  if (!(FLOOR_PLAN_TYPES as readonly string[]).includes(file.type)) return "fileType";
  if (file.size > FLOOR_PLAN_MAX_BYTES) return "fileTooBig";
  return null;
}

async function imageSize(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

/** Renders page 1 of a PDF to a PNG. pdf.js is loaded only when a PDF is chosen. */
async function renderPdfFirstPage(file: File) {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(
      new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
      { type: "module" },
    );
  }
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(4, PDF_RENDER_EDGE / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("render failed"))), "image/png"),
    );
    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    await task.destroy();
  }
}

/**
 * Uploads a floor plan to floor-plans/<user>/<property>/… . PDFs are also rendered to PNG so the
 * plan can be shown, pinned and printed. Returns the paths to save on the property.
 */
export async function uploadFloorPlan(file: File, userId: string, propertyId: string): Promise<FloorPlanUpload> {
  const problem = validateFloorPlan(file);
  if (problem) throw new Error(problem);
  const supabase = createClient();
  const stamp = Date.now();
  const folder = `${userId}/${propertyId}`;
  const isPdf = file.type === "application/pdf";
  const ext = isPdf ? "pdf" : file.type.split("/")[1].replace("jpeg", "jpg");
  const floorPlanPath = `${folder}/floor-plan-${stamp}.${ext}`;
  const uploaded: string[] = [];

  try {
    let image: { blob: Blob; width: number; height: number } | null = null;
    if (isPdf) {
      try {
        image = await renderPdfFirstPage(file);
      } catch {
        throw new Error("pdfRender");
      }
    }
    const { error } = await supabase.storage.from("floor-plans").upload(floorPlanPath, file, { contentType: file.type });
    if (error) throw new Error("uploadFailed");
    uploaded.push(floorPlanPath);

    if (image) {
      const imagePath = `${folder}/floor-plan-${stamp}.png`;
      const { error: imgErr } = await supabase.storage
        .from("floor-plans")
        .upload(imagePath, image.blob, { contentType: "image/png" });
      if (imgErr) throw new Error("uploadFailed");
      uploaded.push(imagePath);
      return {
        floorPlanPath,
        floorPlanMime: "application/pdf",
        floorPlanImagePath: imagePath,
        floorPlanWidth: image.width,
        floorPlanHeight: image.height,
      };
    }

    const { width, height } = await imageSize(file);
    return {
      floorPlanPath,
      floorPlanMime: file.type as FloorPlanUpload["floorPlanMime"],
      floorPlanImagePath: floorPlanPath,
      floorPlanWidth: width,
      floorPlanHeight: height,
    };
  } catch (e) {
    if (uploaded.length) await supabase.storage.from("floor-plans").remove(uploaded);
    throw e;
  }
}

/** Removes files uploaded by uploadFloorPlan when the follow-up save fails. */
export async function discardFloorPlan(upload: FloorPlanUpload) {
  const paths = [...new Set([upload.floorPlanPath, upload.floorPlanImagePath])];
  await createClient().storage.from("floor-plans").remove(paths);
}
