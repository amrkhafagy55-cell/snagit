import { z } from "zod";
import {
  CHECKLIST_RESULTS, DEFECT_STATUSES, INSPECTION_STATUSES, PROPERTY_TYPES, ROOM_TYPES, SEVERITIES,
} from "@/lib/types";

// Error messages are i18n keys from dictionary.errors.
const text = (max: number) => z.string().trim().max(max, "tooLong");
const requiredText = (max: number) => z.string().trim().min(1, "required").max(max, "tooLong");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalid");
const count = (max: number) => z.coerce.number().int("invalid").min(0, "invalid").max(max, "invalid");
const uuid = z.uuid("invalid");
const category = z.string().trim().min(1, "required").max(60, "tooLong");

export const FLOOR_PLAN_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
export const FLOOR_PLAN_MAX_BYTES = 15 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

export const createPropertySchema = z.object({
  propertyId: uuid,
  projectName: requiredText(150),
  developerName: text(150),
  address: text(300),
  buildingNumber: text(30),
  apartmentNumber: text(30),
  floorNumber: text(30),
  propertyType: z.enum(PROPERTY_TYPES, "invalid"),
  bedrooms: count(20),
  bathrooms: count(20),
  balconies: count(10),
  hasRoof: z.boolean(),
  inspectionDate: isoDate,
  ownerName: text(150),
  inspectorName: text(150),
  notes: text(4000),
  floorPlan: z
    .object({
      floorPlanPath: z.string().min(1).max(500),
      floorPlanMime: z.enum(FLOOR_PLAN_TYPES),
      floorPlanImagePath: z.string().min(1).max(500),
      floorPlanWidth: z.number().int().min(1).max(20000),
      floorPlanHeight: z.number().int().min(1).max(20000),
    })
    .nullable(),
});
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;

const coord = z.number().min(0).max(1);
export const pinSchema = z
  .object({ defectId: uuid, x: coord.nullable(), y: coord.nullable() })
  .refine((v) => (v.x === null) === (v.y === null), "invalid");

export const floorPlanSchema = z.object({
  inspectionId: uuid,
  floorPlanPath: z.string().min(1).max(500),
  floorPlanMime: z.enum(FLOOR_PLAN_TYPES),
  floorPlanImagePath: z.string().min(1).max(500),
  floorPlanWidth: z.number().int().min(1).max(20000),
  floorPlanHeight: z.number().int().min(1).max(20000),
});

export const defectSchema = z.object({
  inspectionId: uuid,
  roomId: uuid.nullable(),
  checklistItemId: uuid.nullable(),
  title: requiredText(200),
  description: text(4000),
  category,
  severity: z.enum(SEVERITIES, "invalid"),
  status: z.enum(DEFECT_STATUSES, "invalid"),
  recommendedAction: text(4000),
  identifiedOn: isoDate,
  responsibleParty: text(150),
  locationNote: text(200),
  planX: coord.nullable().optional(),
  planY: coord.nullable().optional(),
});
export type DefectInput = z.infer<typeof defectSchema>;

export const reinspectionSchema = z.object({
  defectId: uuid,
  status: z.enum(DEFECT_STATUSES, "invalid"),
  reinspectionNotes: text(4000),
  correctedOn: isoDate.nullable(),
});

export const checklistResultSchema = z.object({ itemId: uuid, result: z.enum(CHECKLIST_RESULTS) });
export const checklistNoteSchema = z.object({ itemId: uuid, notes: text(2000) });
export const customItemSchema = z.object({
  roomId: uuid,
  category,
  title: requiredText(200),
});
export const addRoomSchema = z.object({
  inspectionId: uuid,
  roomType: z.enum(ROOM_TYPES, "invalid"),
  name: text(80),
});
export const inspectionStatusSchema = z.object({
  inspectionId: uuid,
  status: z.enum(INSPECTION_STATUSES),
});
export const remarksSchema = z.object({ inspectionId: uuid, remarks: text(8000) });

export const profileSchema = z.object({
  fullName: text(120),
  phone: text(30),
  company: text(120),
  accountType: z.enum(["individual", "inspector"]),
});

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message in ERROR_KEYS ? issue.message : "invalid";
  }
  return out;
}

const ERROR_KEYS = { required: 1, tooLong: 1, invalid: 1 } as const;
