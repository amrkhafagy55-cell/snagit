import "server-only";
import { launchBrowser } from "./chrome";

/**
 * Renders report HTML to an A4 PDF with page numbers. The page may only load data: URIs
 * (fonts and images are embedded), so user content can never make the server fetch anything.
 */
export async function renderPdf(html: string, footerLabel: string): Promise<{ pdf: Buffer; pageCount: number }> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith("data:") || url === "about:blank") void req.continue();
      else void req.abort();
    });
    await page.setContent(html, { waitUntil: "load", timeout: 45_000 });
    await page.evaluate(() => document.fonts.ready.then(() => true));

    const footer = `<div style="width:100%;padding:0 14mm;font-family:Arial,sans-serif;font-size:7.5px;color:#6286c2;display:flex;justify-content:space-between;direction:ltr">
      <span>${footerLabel.replace(/[<>&"]/g, "")}</span>
      <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>`;
    const pdf = Buffer.from(
      await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate: footer,
        timeout: 60_000,
      }),
    );
    const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
    return { pdf, pageCount };
  } finally {
    await browser.close();
  }
}
