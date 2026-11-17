export const USER_ROLES = ["individual", "inspector", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROPERTY_TYPES = [
  "apartment", "duplex", "penthouse", "studio", "villa", "townhouse", "chalet", "office", "other",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const INSPECTION_STATUSES = ["draft", "in_progress", "completed", "archived"] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const ROOM_TYPES = [
  "entrance", "living", "bedroom", "kitchen", "bathroom", "balcony", "corridor", "roof", "other",
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const CHECKLIST_RESULTS = ["not_inspected", "passed", "failed"] as const;
export type ChecklistResult = (typeof CHECKLIST_RESULTS)[number];

export const SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const DEFECT_STATUSES = ["open", "under_correction", "pending_reinspection", "resolved", "rejected"] as const;
export type DefectStatus = (typeof DEFECT_STATUSES)[number];

export const STANDARD_CATEGORIES = ["architectural", "electrical", "plumbing", "mechanical"] as const;

export type PhotoKind = "before" | "after";

export type Lang = "en" | "ar";

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  company: string | null;
  role: UserRole;
  locale: Lang;
}

export interface Property {
  id: string;
  owner_id: string;
  project_name: string;
  developer_name: string;
  building_number: string;
  apartment_number: string;
  floor_number: string;
  property_type: PropertyType;
  bedrooms: number;
  bathrooms: number;
  owner_name: string;
  address: string;
  notes: string;
  floor_plan_path: string | null;
  floor_plan_mime: string | null;
  floor_plan_image_path: string | null;
  floor_plan_width: number | null;
  floor_plan_height: number | null;
  created_at: string;
}

export interface Inspection {
  id: string;
  property_id: string;
  inspection_date: string;
  inspector_name: string;
  status: InspectionStatus;
  general_remarks: string;
  updated_at: string;
  created_at: string;
}

export interface InspectionSummary {
  id: string;
  property_id: string;
  status: InspectionStatus;
  inspection_date: string;
  inspector_name: string;
  updated_at: string;
  project_name: string;
  developer_name: string;
  building_number: string;
  apartment_number: string;
  floor_number: string;
  property_type: PropertyType;
  address: string;
  items_total: number;
  items_passed: number;
  items_failed: number;
  defects_total: number;
  defects_open: number;
  defects_critical: number;
  defects_high: number;
  defects_medium: number;
  defects_low: number;
}

export interface Room {
  id: string;
  inspection_id: string;
  room_type: RoomType;
  type_index: number;
  name: string | null;
  sort_order: number;
}

export interface ChecklistItem {
  id: string;
  room_id: string;
  inspection_id: string;
  category: string;
  title_en: string;
  title_ar: string;
  result: ChecklistResult;
  notes: string;
  is_custom: boolean;
  sort_order: number;
}

export interface Defect {
  id: string;
  inspection_id: string;
  room_id: string | null;
  checklist_item_id: string | null;
  number: number;
  title: string;
  description: string;
  category: string;
  severity: Severity;
  status: DefectStatus;
  recommended_action: string;
  identified_on: string;
  responsible_party: string;
  location_note: string;
  plan_x: number | null;
  plan_y: number | null;
  reinspection_notes: string;
  corrected_on: string | null;
  created_at: string;
  updated_at: string;
}

export interface DefectPhoto {
  id: string;
  defect_id: string;
  storage_path: string;
  kind: PhotoKind;
  caption: string;
  taken_at: string;
  url?: string | null;
}

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
