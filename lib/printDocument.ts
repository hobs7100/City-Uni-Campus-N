"use client";

export async function printHtmlDocument(html: string, title: string) {
  const iframe = document.createElement("iframe");
  iframe.title = title;
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "210mm",
    height: "297mm",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);

  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error("Unable to prepare the printable document.");
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  const images = Array.from(frameDocument.images);
  await Promise.all(
    images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  );
  await frameDocument.fonts?.ready;
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

  const singlePageElement = frameDocument.querySelector<HTMLElement>("[data-fit-single-page]");
  if (singlePageElement) {
    const printableWidthMm = Number(singlePageElement.dataset.printWidthMm || 194);
    const printableHeightMm = Number(singlePageElement.dataset.printHeightMm || 281);
    const printableWidthPx = (printableWidthMm / 25.4) * 96;
    const printableHeightPx = (printableHeightMm / 25.4) * 96;
    const contentWidth = singlePageElement.scrollWidth;
    const contentHeight = singlePageElement.scrollHeight;
    const scale = Math.min(
      1,
      printableWidthPx / contentWidth,
      printableHeightPx / contentHeight,
    );
    if (scale < 1) {
      singlePageElement.style.zoom = String(scale);
    }
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    iframe.remove();
  };
  frameWindow.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(cleanup, 60_000);
  frameWindow.focus();
  frameWindow.print();
}

export function escapePrintHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}