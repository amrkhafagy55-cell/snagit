import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const arabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "SNAGIT — Property inspection & snagging", template: "%s · SNAGIT" },
  description:
    "Inspect newly delivered apartments room by room, document defects with photos and track them until they are fixed.",
};

export const viewport: Viewport = {
  themeColor: "#12213e",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { lang, dir } = await getI18n();
  return (
    <html lang={lang} dir={dir} className={`${inter.variable} ${arabic.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
