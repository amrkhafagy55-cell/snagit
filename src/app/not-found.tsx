import { SearchX } from "lucide-react";
import { LinkButton } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="card max-w-md p-8 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-navy-50 text-navy-500">
          <SearchX className="size-7" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-bold text-navy-950">{t.notFound.title}</h1>
        <p className="mt-1 text-navy-500">{t.notFound.body}</p>
        <LinkButton href="/dashboard" className="mt-6">
          {t.notFound.home}
        </LinkButton>
      </div>
    </main>
  );
}
