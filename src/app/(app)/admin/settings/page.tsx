import { getAppSettings } from "@/lib/settings";
import { aiDailyLimit } from "@/lib/ai/defect-assistant";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  const settings = await getAppSettings();
  return (
    <div className="max-w-2xl">
      <SettingsForm initial={settings} aiDefault={aiDailyLimit()} />
    </div>
  );
}
