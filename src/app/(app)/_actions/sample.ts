"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { todayIso } from "@/lib/i18n";
import { getProfile } from "@/lib/auth";
import type { ActionResult, DefectStatus, RoomType, Severity } from "@/lib/types";
import { authed, fail } from "./common";

type SampleDefect = {
  room: RoomType;
  roomIndex: number;
  item: string; // checklist template title_en
  severity: Severity;
  status: DefectStatus;
  en: { title: string; description: string; action: string };
  ar: { title: string; description: string; action: string };
  responsible: string;
  correctedDaysAgo?: number;
};

const SAMPLE_DEFECTS: SampleDefect[] = [
  {
    room: "kitchen", roomIndex: 1, item: "Water leakage under sink", severity: "critical", status: "open",
    responsible: "Developer (MEP)",
    en: {
      title: "Leak at sink trap connection",
      description: "Active drip from the trap slip joint after running the tap for 2 minutes. Cabinet base is damp.",
      action: "Replace the trap washer/connection, retest under flow, replace the cabinet base if swollen.",
    },
    ar: {
      title: "تسريب عند وصلة سيفون الحوض",
      description: "تنقيط مستمر من وصلة السيفون بعد تشغيل الحنفية لمدة دقيقتين. قاعدة الدولاب مبللة.",
      action: "تغيير جلبة/وصلة السيفون وإعادة الاختبار، وتغيير قاعدة الدولاب إذا انتفخت.",
    },
  },
  {
    room: "bathroom", roomIndex: 2, item: "Sockets with RCD protection", severity: "critical", status: "pending_reinspection",
    responsible: "Electrical contractor",
    en: {
      title: "Bathroom socket does not trip RCD on test",
      description: "RCD did not trip when tested with a socket tester. Possible missing earth or wiring fault.",
      action: "Check earth continuity and RCD rating; rewire the circuit and retest before use.",
    },
    ar: {
      title: "بريزة الحمام لا تفصل قاطع التسريب عند الاختبار",
      description: "لم يفصل قاطع التسريب عند الاختبار بجهاز فحص البرايز. احتمال عدم وجود أرضي أو خطأ في التوصيل.",
      action: "فحص استمرارية الأرضي وقيمة قاطع التسريب، وإعادة توصيل الدائرة واختبارها قبل الاستخدام.",
    },
  },
  {
    room: "living", roomIndex: 1, item: "Hollow tiles (tap test)", severity: "high", status: "open",
    responsible: "Finishing contractor",
    en: {
      title: "Hollow floor tiles near balcony door",
      description: "Six 60×60 tiles sound hollow when tapped (about 1.4 m²), indicating an incomplete adhesive bed.",
      action: "Remove and re-lay the affected tiles with a full adhesive bed; tap-test the surrounding area.",
    },
    ar: {
      title: "بلاط مطبل بجوار باب البلكونة",
      description: "ست بلاطات 60×60 تعطي صوتًا أجوف عند الطرق (حوالي 1.4 م²)، ما يدل على عدم اكتمال طبقة اللاصق.",
      action: "فك البلاط المتأثر وإعادة تركيبه بطبقة لاصق كاملة، واختبار المنطقة المحيطة بالطرق.",
    },
  },
  {
    room: "bathroom", roomIndex: 1, item: "Floor tiles and slope to drain", severity: "high", status: "open",
    responsible: "Finishing contractor",
    en: {
      title: "Water ponds away from floor drain",
      description: "After a shower test, water ponds about 0.6 m from the floor drain; the slope runs the wrong way.",
      action: "Re-screed the floor with a 1–2% fall toward the drain and re-tile.",
    },
    ar: {
      title: "تجمع مياه بعيدًا عن الصفاية",
      description: "بعد اختبار الدش تتجمع المياه على بعد 0.6 م من الصفاية، والميول في الاتجاه العكسي.",
      action: "إعادة عمل الميول بنسبة 1–2% ناحية الصفاية وإعادة التبليط.",
    },
  },
  {
    room: "balcony", roomIndex: 1, item: "Railing stability and height", severity: "high", status: "open",
    responsible: "Developer",
    en: {
      title: "Balcony railing lower than 1.1 m",
      description: "Measured 0.98 m from finished floor level to the top of the railing.",
      action: "Raise the railing to at least 1.1 m above finished floor per code, with secure fixings.",
    },
    ar: {
      title: "ارتفاع درابزين البلكونة أقل من 1.1 م",
      description: "الارتفاع المقاس 0.98 م من منسوب الأرضية التشطيب حتى أعلى الدرابزين.",
      action: "رفع الدرابزين إلى 1.1 م على الأقل فوق منسوب التشطيب طبقًا للكود مع تثبيت جيد.",
    },
  },
  {
    room: "bedroom", roomIndex: 1, item: "Wall cracks", severity: "medium", status: "under_correction",
    responsible: "Finishing contractor",
    en: {
      title: "Diagonal crack above window corner",
      description: "Hairline diagonal crack, about 45 cm long, from the top corner of the window. Typical plaster shrinkage at openings; monitor for widening.",
      action: "Rake out, apply fibre mesh and flexible filler, then repaint the full wall.",
    },
    ar: {
      title: "شرخ مائل أعلى ركن الشباك",
      description: "شرخ شعري مائل بطول 45 سم تقريبًا من الركن العلوي للشباك. غالبًا انكماش محارة عند الفتحات؛ يجب متابعة اتساعه.",
      action: "تفريغ الشرخ ووضع شبكة فايبر ومعجون مرن ثم إعادة دهان الحائط بالكامل.",
    },
  },
  {
    room: "corridor", roomIndex: 1, item: "Paint defects", severity: "low", status: "open",
    responsible: "Painting contractor",
    en: {
      title: "Paint drips and roller marks",
      description: "Visible drips and roller marks on the corridor wall under side light.",
      action: "Sand the affected area and apply a finishing coat.",
    },
    ar: {
      title: "سيلان دهان وآثار رولة",
      description: "سيلان وآثار رولة واضحة على حائط الطرقة تحت الإضاءة الجانبية.",
      action: "صنفرة المنطقة المتأثرة وعمل وش تشطيب.",
    },
  },
  {
    room: "entrance", roomIndex: 1, item: "Door lock, hinges and hardware", severity: "low", status: "resolved",
    responsible: "Carpentry contractor", correctedDaysAgo: 1,
    en: {
      title: "Main door lock is stiff",
      description: "The key needs force to turn; the latch rubs on the strike plate.",
      action: "Adjust the strike plate and lubricate the lock cylinder.",
    },
    ar: {
      title: "كالون الباب الرئيسي ثقيل",
      description: "المفتاح يحتاج لقوة عند اللف، واللسان يحتك بالكاونتر.",
      action: "ضبط الكاونتر وتزييت سلندر الكالون.",
    },
  },
];

const daysAgo = (n: number) => todayIso(-n);

export async function loadSampleProjectAction(): Promise<ActionResult> {
  let inspectionId = "";
  try {
    const { supabase } = await authed();
    const { lang } = await getI18n();
    const profile = await getProfile();
    const ar = lang === "ar";

    const { data: property, error: pErr } = await supabase
      .from("properties")
      .insert({
        project_name: ar ? "حدائق النخيل (مشروع تجريبي)" : "Al Nakheel Gardens (sample)",
        developer_name: ar ? "دلتا هورايزون للتطوير" : "Delta Horizon Developments",
        address: ar ? "الحي السابع، مدينة 6 أكتوبر، الجيزة" : "7th District, 6th of October City, Giza",
        building_number: "14",
        apartment_number: "302",
        floor_number: "3",
        property_type: "apartment",
        bedrooms: 3,
        bathrooms: 2,
        owner_name: ar ? "منى حسن" : "Mona Hassan",
        notes: ar
          ? "استلام شقة نصف تشطيب بعد التشطيب النهائي. الكهرباء والمياه متصلة وقت الفحص."
          : "Handover of a fully finished unit. Power and water were connected during the inspection.",
      })
      .select("id")
      .single();
    if (pErr) throw pErr;

    const { data: insp, error: iErr } = await supabase
      .from("inspections")
      .insert({
        property_id: property.id,
        inspection_date: daysAgo(2),
        inspector_name: profile?.full_name || (ar ? "م. كريم عادل" : "Eng. Karim Adel"),
        status: "in_progress",
      })
      .select("id")
      .single();
    if (iErr) throw iErr;
    inspectionId = insp.id;

    const { error: rErr } = await supabase.rpc("initialize_inspection", {
      p_inspection_id: insp.id, p_bedrooms: 3, p_bathrooms: 2, p_balconies: 1, p_has_roof: false,
    });
    if (rErr) throw rErr;

    const [{ data: rooms }, { data: items }] = await Promise.all([
      supabase.from("rooms").select("id, room_type, type_index").eq("inspection_id", insp.id),
      supabase.from("checklist_items").select("id, room_id, title_en, sort_order").eq("inspection_id", insp.id).order("sort_order"),
    ]);
    const roomKey = new Map((rooms ?? []).map((r) => [r.id as string, `${r.room_type}:${r.type_index}`]));
    const roomByKey = new Map((rooms ?? []).map((r) => [`${r.room_type}:${r.type_index}`, r.id as string]));

    // Mark most items as inspected so progress looks like a real visit (~80%).
    const failedKeys = new Set(SAMPLE_DEFECTS.map((d) => `${d.room}:${d.roomIndex}|${d.item}`));
    const passed: string[] = [];
    const failed = new Map<string, string>();
    (items ?? []).forEach((it, i) => {
      const key = `${roomKey.get(it.room_id as string)}|${it.title_en}`;
      if (failedKeys.has(key)) failed.set(key, it.id as string);
      else if (i % 5 !== 4) passed.push(it.id as string);
    });
    if (passed.length) await supabase.from("checklist_items").update({ result: "passed" }).in("id", passed);
    if (failed.size) await supabase.from("checklist_items").update({ result: "failed" }).in("id", [...failed.values()]);

    for (const d of SAMPLE_DEFECTS) {
      const key = `${d.room}:${d.roomIndex}|${d.item}`;
      const text = ar ? d.ar : d.en;
      const { error } = await supabase.from("defects").insert({
        inspection_id: insp.id,
        room_id: roomByKey.get(`${d.room}:${d.roomIndex}`) ?? null,
        checklist_item_id: failed.get(key) ?? null,
        title: text.title,
        description: text.description,
        recommended_action: text.action,
        category: categoryFor(d.item),
        severity: d.severity,
        status: d.status,
        identified_on: daysAgo(2),
        responsible_party: d.responsible,
        corrected_on: d.correctedDaysAgo != null ? daysAgo(d.correctedDaysAgo) : null,
        reinspection_notes: d.status === "resolved" ? (ar ? "تم التحقق: يعمل بسلاسة." : "Verified: operates smoothly.") : "",
      });
      if (error) throw error;
    }
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/dashboard");
  redirect(`/inspections/${inspectionId}`);
}

function categoryFor(item: string) {
  if (/tile|crack|paint|railing|door|lock/i.test(item)) return "architectural";
  if (/socket|switch|light|rcd|earthing/i.test(item)) return "electrical";
  if (/leak|drain|water|pipe|sink|wc|mixer/i.test(item)) return "plumbing";
  return "architectural";
}
