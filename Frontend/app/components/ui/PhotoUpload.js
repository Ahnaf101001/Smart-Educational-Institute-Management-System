"use client";

// ID-card photo field for Students, Teachers, Staff (and guardians via ResourceManager's image field).
// Validates in the browser first (type, size, dimensions, aspect ratio), previews instantly, then uploads
// through the shared /uploads pipeline. With ownerType + ownerId the backend also saves the photo on that
// person straight away (permission-checked and audited).
import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { uploadsApi } from "../../lib/api";
import { cx, useToast } from "./kit";

export const PHOTO_HINT = "JPG, PNG or WEBP · max 2 MB · min 200×200 px · plain background, face centred (used on ID card)";
const MAX_BYTES = 2 * 1024 * 1024;
const MIN_PX = 200;
const TYPES = /^image\/(jpeg|png|webp)$/;

export function getInitials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(-2)
    .toUpperCase() || "?";
}

/** Photo when available, otherwise the initials circle. */
export function PhotoAvatar({ src, name, className = "size-10", rounded = "rounded-full", textClass = "text-xs" }) {
  const [failedSrc, setFailedSrc] = useState(null); // a broken link falls back to initials
  if (src && failedSrc !== src) {
    return <img src={src} alt={name ? `${name} photo` : "Photo"} className={cx(className, rounded, "shrink-0 object-cover object-top")} onError={() => setFailedSrc(src)} />;
  }
  return (
    <span className={cx(className, rounded, textClass, "grid shrink-0 place-items-center bg-blue-50 font-bold text-blue-700")} aria-hidden="true">
      {getInitials(name)}
    </span>
  );
}

function readDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { reject(new Error("This file could not be opened as an image.")); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

/** Returns { error } when the file is not acceptable, otherwise { dims }. */
export async function checkPhotoFile(file) {
  if (!file) return { error: "No file selected." };
  if (!TYPES.test(file.type)) return { error: "Choose a JPG, PNG or WEBP image." };
  if (file.size > MAX_BYTES) return { error: "Photo must be 2 MB or smaller." };
  let dims;
  try { dims = await readDimensions(file); } catch (e) { return { error: e.message }; }
  if (dims.width < MIN_PX || dims.height < MIN_PX) {
    return { error: `Photo must be at least ${MIN_PX}×${MIN_PX} px (this one is ${dims.width}×${dims.height}).` };
  }
  return { dims };
}

export default function PhotoUpload({
  value, onChange, ownerType, ownerId, label = "ID Card Photo", required = false, disabled = false, size = "lg",
  upload = (file, extra) => uploadsApi.upload(file, extra), hint = PHOTO_HINT,
  allowRemove = true, // false where there is no Save step (the photo is stored immediately on the owner)
}) {
  const toast = useToast();
  const inputId = useId();
  const inputRef = useRef(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);

  // Release the local preview URL when it is replaced or the field unmounts.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function handle(file) {
    if (!file || disabled || busy) return;
    setError("");
    const { error: problem, dims } = await checkPhotoFile(file);
    if (problem) { setError(problem); return; }
    const ratio = dims.width / dims.height;
    const nearPassport = Math.abs(ratio - 0.75) < 0.12 || Math.abs(ratio - 1) < 0.12;
    if (!nearPassport) toast.warning("Tip: a passport-style photo (3:4 portrait or square) fits ID cards best.");
    setPreview(URL.createObjectURL(file)); // instant preview while uploading
    setBusy(true);
    try {
      const up = await upload(file, { category: "photo", ...(ownerType && ownerId ? { ownerType, ownerId } : {}) });
      onChange?.(up.url, up);
      if (ownerType && ownerId) toast.success("Photo saved");
    } catch (err) {
      setError(err?.message || "Upload failed.");
    } finally {
      // From here on the field shows the parent's `value` (the saved URL), so a form reset clears it.
      setPreview("");
      setBusy(false);
    }
  }

  function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    handle(file);
  }

  const shown = preview || value || "";
  const small = size === "sm";
  const box = small ? "size-14" : "h-36 w-28";

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-semibold text-slate-700">
          {label}{required && <span className="text-rose-500"> *</span>}
        </label>
      )}
      <div className={cx("flex gap-3", small ? "items-center" : "items-start")}>
        <label
          htmlFor={inputId}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]); }}
          className={cx(
            box,
            "relative grid shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed transition",
            drag ? "border-blue-500 bg-blue-50" : error ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-slate-50 hover:border-blue-400",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          {shown ? (
            <img src={shown} alt={label ? `${label} preview` : "Photo preview"} className="size-full object-cover object-top" />
          ) : (
            <span className="flex flex-col items-center gap-1 px-1 text-center text-[11px] text-slate-400">
              <ImagePlus size={small ? 18 : 24} />
              {!small && "Drop or click"}
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-white/70">
              <Loader2 size={20} className="animate-spin text-blue-600" />
            </span>
          )}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={onPick}
          disabled={disabled || busy}
        />
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : shown ? <RefreshCw size={14} /> : <Upload size={14} />}
              {busy ? "Uploading…" : shown ? "Change" : "Upload photo"}
            </button>
            {shown && !busy && allowRemove && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => { setPreview(""); setError(""); onChange?.(""); }}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 size={14} /> Remove
              </button>
            )}
          </div>
          {!small && hint && <p className="text-xs leading-snug text-slate-500">{hint}</p>}
          {error && <p className="text-xs font-medium text-rose-600" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}
