import React, { useState, useRef } from "react";
import api, { API } from "@/lib/api";
import { toast } from "sonner";
import { Camera, Image as ImageIcon, Trash, CircleNotch, ArrowUpRight } from "@phosphor-icons/react";

export default function ImageUploader({
  value,
  onChange,
  label = "Upload Photo",
  hint = "PNG, JPG, WebP up to 10MB",
  compact = false,
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Compute full display URL (handles relative /uploads/ and external http URLs)
  const fullUrl = value
    ? value.startsWith("http")
      ? value
      : `${API.replace(/\/api$/, "")}${value}`
    : null;

  const handleUpload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPEG, WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image file is too large (maximum 10 MB).");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const res = await api.post("/upload/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange(res.data.url);
      toast.success("Photo uploaded successfully!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Photo upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  if (value) {
    return (
      <div className="space-y-1.5">
        {label && <label className="text-xs font-semibold text-foreground/80">{label}</label>}
        <div className="relative group overflow-hidden rounded-2xl border border-border bg-muted/30 p-2 flex items-center gap-3">
          <img
            src={fullUrl}
            alt="Uploaded preview"
            className={`${compact ? "h-14 w-14" : "h-20 w-20"} rounded-xl object-cover border border-border shrink-0 bg-background`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate text-foreground">Photo Attached</p>
            <p className="text-[11px] text-muted-foreground truncate">{value}</p>
            <a
              href={fullUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5"
            >
              View Full Size <ArrowUpRight size={12} />
            </a>
          </div>
          <button
            type="button"
            onClick={() => onChange("")}
            className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
            title="Remove photo"
          >
            <Trash size={18} weight="bold" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs font-semibold text-foreground/80">{label}</label>}

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-2xl border-2 border-dashed transition-colors p-4 text-center ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border/80 bg-muted/20 hover:border-primary/50"
        } ${compact ? "py-3" : "py-5"}`}
      >
        {uploading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-2">
            <CircleNotch size={24} className="animate-spin text-primary" />
            <p className="text-xs font-semibold text-muted-foreground">Uploading & optimizing photo…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
              >
                <Camera size={15} weight="bold" /> Take Photo
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-3.5 py-1.5 text-xs font-bold text-secondary-foreground hover:bg-secondary/20 transition-colors"
              >
                <ImageIcon size={15} weight="bold" /> Browse File
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">{hint} or drag & drop</p>
          </div>
        )}
      </div>
    </div>
  );
}
