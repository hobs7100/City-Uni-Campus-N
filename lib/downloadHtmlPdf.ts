"use client";

import { prepareHtmlDocument } from "./printDocument";

/** Download the same isolated A4 document used by the print option. */
export async function downloadHtmlPdf(html: string, title: string, filename: string) {
  // Load PDF libraries only when requested; keep the normal dashboard lightweight.
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"), import("jspdf"),
  ]);
  const { iframe, frameDocument } = await prepareHtmlDocument(html, title, {
    waitForFrameLoad: true, strictImages: true, frameWidthMm: 210, frameHeightMm: 297,
  });
  try {
    const root = frameDocument.querySelector<HTMLElement>("[data-fit-single-page]");
    if (!root) throw new Error("The printable slip layout could not be prepared.");
    // html2canvas does not reliably lay out text under CSS zoom. Capture the
    // original document and fit its image into the PDF instead.
    root.style.zoom = "";
    for (const image of Array.from(root.querySelectorAll<HTMLImageElement>('[data-pdf-image-cover]'))) {
      const width = image.clientWidth * 3, height = image.clientHeight * 3;
      const cropped = frameDocument.createElement("canvas");
      cropped.width = width; cropped.height = height;
      const context = cropped.getContext("2d");
      if (!context) throw new Error("Your browser could not prepare the profile photo.");
      const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const sourceWidth = width / ratio, sourceHeight = height / ratio;
      context.drawImage(image, (image.naturalWidth - sourceWidth) / 2, (image.naturalHeight - sourceHeight) / 2,
        sourceWidth, sourceHeight, 0, 0, width, height);
      image.src = cropped.toDataURL("image/png");
      await image.decode();
    }
    const bounds = root.getBoundingClientRect();
    const width = Math.ceil(Math.max(root.scrollWidth, bounds.width));
    const height = Math.ceil(Math.max(root.scrollHeight, bounds.height));
    const canvas = await html2canvas(root, {
      backgroundColor: "#ffffff", scale: 2, useCORS: true, allowTaint: false,
      width, height, windowWidth: Math.ceil(210 / 25.4 * 96), windowHeight: height + 100,
      scrollX: 0, scrollY: 0, imageTimeout: 15_000, logging: false,
    });
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    pdf.setProperties({ title, subject: "Examination Slip", creator: "City College - University Campus" });
    const widthMm = width / 96 * 25.4, heightMm = height / 96 * 25.4;
    const fit = Math.min(1, Number(root.dataset.printWidthMm) / widthMm, Number(root.dataset.printHeightMm) / heightMm);
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 12, 12, widthMm * fit, heightMm * fit);
    await pdf.save(filename, { returnPromise: true });
  } finally {
    iframe.remove();
  }
}
