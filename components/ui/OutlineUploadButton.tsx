"use client";

import { useRef } from "react";
import { Camera, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { compressImage } from "@/lib/compress-image";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_SIZE_LABEL } from "@/lib/upload-limits";

interface OutlineUploadButtonProps {
  /** Show a spinner/disabled state while the parent is uploading */
  uploading: boolean;
  /** Called with the (possibly compressed) file ready to send to the server */
  onFile: (file: File) => void;
  /** Accepted file types for the library picker. */
  accept?: string;
}

/**
 * Two-button outline upload widget:
 *   📁 Library  —  opens the device file-picker (images + documents)
 *   📷 Camera   —  opens the rear camera directly (images only)
 *
 * Images are automatically compressed to ≤ 100 KB before being handed
 * to the parent.  Non-image files (PDF, DOC, PPT…) are passed unchanged.
 */
export default function OutlineUploadButton({
  uploading,
  onFile,
  accept = ".pdf,.doc,.docx,.ppt,.pptx,image/*",
}: OutlineUploadButtonProps) {
  const libraryRef = useRef<HTMLInputElement>(null);
  const cameraRef  = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    e.target.value = ""; // reset so the same file can be re-selected
    if (!raw) return;
    const file = await compressImage(raw, 100);
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`Course outline files must be ${MAX_UPLOAD_SIZE_LABEL} or smaller.`);
      return;
    }
    onFile(file);
  }

  if (uploading) {
    return (
      <span className="text-xs text-slate-400 italic">Uploading…</span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Library picker */}
      <button
        type="button"
        onClick={() => libraryRef.current?.click()}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
        title="Upload from library"
      >
        <Upload size={12} />
        Library
      </button>

      <span className="select-none text-slate-300 dark:text-slate-600">|</span>

      {/* Camera capture */}
      <button
        type="button"
        onClick={() => cameraRef.current?.click()}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
        title="Capture with camera"
      >
        <Camera size={12} />
        Camera
      </button>

      {/* Hidden inputs */}
      <input
        ref={libraryRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
