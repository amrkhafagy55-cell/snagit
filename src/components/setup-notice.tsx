import { DatabaseZap } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";

export async function SetupNotice() {
  const { t } = await getI18n();
  return (
    <div className="card mx-auto w-full min-w-0 max-w-lg p-6 text-center sm:p-8">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-50 text-accent-600">
        <DatabaseZap className="size-7" aria-hidden />
      </div>
      <h1 className="mt-4 text-xl font-bold text-navy-950">{t.setup.title}</h1>
      <p className="mt-2 text-navy-600">{t.setup.body}</p>
      <pre className="mt-5 overflow-x-auto rounded-xl bg-navy-950 p-4 text-start text-sm text-navy-100" dir="ltr">
        {`cp .env.example .env.local\n# supabase/migrations/0001_init.sql\n# supabase/migrations/0002_checklist_templates.sql\nnpm run dev`}
      </pre>
    </div>
  );
}
