"use client";

/** Prepare a page-sized isolated document for both printing and PDF downloads. */
export async function prepareHtmlDocument(
  html: string,
  title: string,
  options: { waitForFrameLoad?: boolean; frameWidthMm?: number; frameHeightMm?: number; strictImages?: boolean } = {},
) {
  const iframe = document.createElement("iframe");
  iframe.title = title;
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${options.frameWidthMm ?? 210}mm`,
    height: `${options.frameHeightMm ?? 297}mm`,
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

  const frameLoaded = options.waitForFrameLoad
    ? new Promise<void>((resolve) => {
        iframe.addEventListener("load", () => resolve(), { once: true });
      })
    : null;

  try {
  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  if (frameLoaded) {
    await Promise.race([
      frameLoaded,
      new Promise<void>((resolve) => window.setTimeout(resolve, 2_000)),
    ]);
  }

  const images = Array.from(frameDocument.images);
  await Promise.all(
    images.map((image) => {
      if (image.complete) {
        if (options.strictImages && !image.naturalWidth) throw new Error("An image on the slip could not be loaded. Please check your profile picture and try again.");
        return Promise.resolve();
      }
      return new Promise<void>((resolve, reject) => {
        const finish = (failed = false) => {
          window.clearTimeout(timer);
          image.removeEventListener("load", loaded);
          image.removeEventListener("error", errored);
          if (failed && options.strictImages) reject(new Error("An image on the slip could not be loaded. Please check your profile picture and try again."));
          else resolve();
        };
        const loaded = () => finish();
        const errored = () => finish(true);
        const timer = window.setTimeout(errored, 15_000);
        image.addEventListener("load", loaded, { once: true });
        image.addEventListener("error", errored, { once: true });
      });
    }),
  );
  await frameDocument.fonts?.ready;
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

  const singlePageElements = frameDocument.querySelectorAll<HTMLElement>("[data-fit-single-page]");
  for (const singlePageElement of singlePageElements) {
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

  return { iframe, frameDocument, frameWindow };
  } catch (error) {
    iframe.remove();
    throw error;
  }
}

export async function printHtmlDocument(
  html: string,
  title: string,
  options: { waitForFrameLoad?: boolean; frameWidthMm?: number; frameHeightMm?: number; strictImages?: boolean } = {},
) {
  const { iframe, frameWindow } = await prepareHtmlDocument(html, title, options);
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    iframe.remove();
  };
  frameWindow.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(cleanup, 60_000);
  if (options.waitForFrameLoad) {
    await new Promise<void>((resolve) => {
      frameWindow.setTimeout(() => {
        frameWindow.focus();
        frameWindow.print();
        resolve();
      }, 0);
    });
  } else {
    frameWindow.focus();
    frameWindow.print();
  }
}

export function escapePrintHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}