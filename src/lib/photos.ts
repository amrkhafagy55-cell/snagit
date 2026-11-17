"use client";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_MAX_BYTES, PHOTO_TYPES } from "@/lib/validation";
import type { PhotoKind } from "@/lib/types";

const MAX_EDGE = 2048;

export function validatePhoto(file: File): "fileType" | "fileTooBig" | null {
  // Phones may report HEIC; browsers that can decode it get converted to JPEG below.
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type) && !/^image\/hei[cf]$/.test(file.type)) return "fileType";
  if (file.size > 25 * 1024 * 1024) return "fileTooBig";
  return null;
}

/** Downscale to MAX_EDGE and re-encode as JPEG (also strips EXIF/GPS metadata). */
export async function preparePhoto(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
  );
  if (blob.size > PHOTO_MAX_BYTES) throw new Error("fileTooBig");
  return { blob, width, height };
}

/** Uploads to defect-photos/<user>/<inspection>/<defect>/<uuid>.jpg and returns rows to register. */
export async function uploadDefectPhotos(opts: {
  files: File[];
  userId: string;
  inspectionId: string;
  defectId: string;
  kind: PhotoKind;
  onProgress?: (done: number, total: number) => void;
}) {
  const supabase = createClient();
  const uploaded: { path: string; kind: PhotoKind; width: number | null; height: number | null }[] = [];
  let done = 0;
  for (const file of opts.files) {
    const { blob, width, height } = await preparePhoto(file);
    const path = `${opts.userId}/${opts.inspectionId}/${opts.defectId}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from("defect-photos").upload(path, blob, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (error) {
      if (uploaded.length) await supabase.storage.from("defect-photos").remove(uploaded.map((u) => u.path));
      throw new Error("uploadFailed");
    }
    uploaded.push({ path, kind: opts.kind, width, height });
    opts.onProgress?.(++done, opts.files.length);
  }
  return uploaded;
}
