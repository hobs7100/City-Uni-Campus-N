/**
 * Client-side image compression using the Canvas API.
 * Non-image files (PDF, DOC, PPT…) are returned unchanged.
 *
 * Strategy:
 *  1. Scale the image down if its longest side > MAX_DIM (preserves aspect ratio).
 *  2. Binary-search over JPEG quality to find the highest quality whose encoded
 *     size is ≤ maxKB.  8 iterations give ~0.4% precision — more than enough.
 *  3. If the original file is already small enough, return it as-is.
 */
export async function compressImage(
  file: File,
  maxKB = 100,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const targetBytes = maxKB * 1024;

  // Already small enough — skip compression entirely
  if (file.size <= targetBytes) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // ── Scale down if very large ─────────────────────────────────────────
      const MAX_DIM = 2000;
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > MAX_DIM || h > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }

      ctx.drawImage(img, 0, 0, w, h);

      // ── Binary-search over JPEG quality ──────────────────────────────────
      // We measure encoded size via the base-64 data-URL length.
      // base64 size ≈ (dataUrl.length - header.length) * 3/4
      const HEADER = "data:image/jpeg;base64,".length;
      const byteCount = (url: string) =>
        Math.round((url.length - HEADER) * 0.75);

      let lo = 0.05, hi = 0.92, best = 0.5;

      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        const url = canvas.toDataURL("image/jpeg", mid);
        if (byteCount(url) <= targetBytes) {
          best = mid;   // this quality fits — try higher
          lo   = mid;
        } else {
          hi = mid;     // too large — try lower
        }
      }

      // Final render at the best quality found
      const finalUrl = canvas.toDataURL("image/jpeg", best);

      // ── Convert data-URL → File ───────────────────────────────────────────
      const base64 = finalUrl.split(",")[1];
      const bstr   = atob(base64);
      const bytes  = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) bytes[i] = bstr.charCodeAt(i);

      const blob = new Blob([bytes], { type: "image/jpeg" });
      const name = file.name.replace(/\.[^/.]+$/, ".jpg");
      resolve(new File([blob], name, { type: "image/jpeg" }));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // fallback: send original
    };

    img.src = objectUrl;
  });
}
