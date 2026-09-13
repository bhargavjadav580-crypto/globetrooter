import React, { useState, useRef } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  X, ShareNetwork, WhatsappLogo, Copy, Check, Sparkle, MapPin,
  CalendarBlank, Path, Wallet, Compass, DownloadSimple, CircleNotch,
} from "@phosphor-icons/react";
import html2canvas from "html2canvas";

export default function ShareTripStoryModal({ trip, isOpen, onClose }) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [downloadingImg, setDownloadingImg] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const cardRef = useRef(null);

  if (!isOpen || !trip) return null;

  const sym = trip.currency_symbol || "₹";

  const getPublicLink = async () => {
    try {
      setSharing(true);
      const res = await api.post(`/trips/${trip.id}/publish`);
      const url = `${window.location.origin}/t/${res.data.public_slug}`;
      setPublicUrl(url);
      return url;
    } catch {
      const fallback = `${window.location.origin}/trips/${trip.id}/view`;
      setPublicUrl(fallback);
      return fallback;
    } finally {
      setSharing(false);
    }
  };

  const shareToWhatsApp = async () => {
    const link = publicUrl || (await getPublicLink());
    const text = `🗺️ *${trip.name}*\n` +
      `🚗 ${trip.starting_point} ➔ ${trip.destination}\n` +
      (trip.start_date ? `📅 ${trip.start_date} to ${trip.end_date || ""}\n` : "") +
      (trip.distance_km ? `🛣️ Total distance: ${trip.distance_km} km\n` : "") +
      (trip.total_budget ? `💰 Estimated budget: ${sym}${Number(trip.total_budget).toLocaleString()}\n` : "") +
      `\n✨ Check out our full interactive road trip plan here:\n${link}`;

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  };

  const copyShareText = async () => {
    const link = publicUrl || (await getPublicLink());
    const text = `🗺️ ${trip.name}\n` +
      `🚗 ${trip.starting_point} ➔ ${trip.destination}\n` +
      (trip.start_date ? `📅 ${trip.start_date} to ${trip.end_date || ""}\n` : "") +
      `\nView interactive trip plan:\n${link}`;

    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Trip share message copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const downloadAsImage = async () => {
    if (!cardRef.current) return;
    setDownloadingImg(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        scale: 3,           // 3× for crisp image on retina/Instagram
        backgroundColor: null,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `${trip.name.replace(/\s+/g, "_")}_story.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("🖼️ Story card saved as image!");
    } catch {
      toast.error("Could not export image. Try again.");
    } finally {
      setDownloadingImg(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md flex flex-col rounded-3xl border border-border bg-card shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <ShareNetwork size={20} className="text-primary" weight="bold" />
            <h3 className="font-display font-black text-lg">Share Trip Story</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Content: Story Card Preview */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Instagram/WhatsApp Story Card Style */}
          <div
            ref={cardRef}
            id="trip-story-card"
            className="relative rounded-3xl overflow-hidden shadow-lg border border-white/20 text-white min-h-[380px] flex flex-col justify-between p-6"
            style={{
              background: "linear-gradient(145deg, #1e293b 0%, #0f172a 50%, #0284c7 100%)",
            }}
          >
            {/* Background cover with gradient overlay */}
            {trip.cover_image && (
              <>
                <img
                  src={trip.cover_image}
                  alt={trip.name}
                  crossOrigin="anonymous"
                  className="absolute inset-0 h-full w-full object-cover opacity-35"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30" />
              </>
            )}

            {/* Card Header */}
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-black tracking-wider uppercase border border-white/30 flex items-center gap-1.5">
                  <Sparkle size={12} weight="fill" className="text-amber-300" />
                  GlobeTrotter Story
                </span>
                <span className="text-[10px] text-white/80 font-bold tracking-tight bg-black/40 px-2 py-0.5 rounded-md">
                  ROAD TRIP
                </span>
              </div>

              <div className="mt-6">
                <p className="text-xs font-semibold text-white/80 uppercase tracking-wider flex items-center gap-1">
                  <Compass size={14} weight="bold" className="text-amber-300" /> Our Great Journey
                </p>
                <h2 className="font-display font-black text-2xl sm:text-3xl tracking-tight leading-tight mt-1">
                  {trip.name}
                </h2>
              </div>
            </div>

            {/* Card Middle: Route & Highlights */}
            <div className="relative z-10 space-y-3 my-4">
              <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <MapPin size={16} weight="fill" className="text-emerald-400 shrink-0" />
                  <span className="truncate">{trip.starting_point}</span>
                  <span className="text-amber-300">➔</span>
                  <span className="truncate">{trip.destination}</span>
                </div>

                {trip.start_date && (
                  <p className="text-xs text-white/80 flex items-center gap-1.5 font-medium">
                    <CalendarBlank size={14} />
                    {new Date(trip.start_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    {trip.end_date ? ` — ${new Date(trip.end_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                  </p>
                )}
              </div>

              {/* Stats badges */}
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                {trip.distance_km ? (
                  <div className="rounded-xl bg-black/30 backdrop-blur-xs p-2 border border-white/10">
                    <p className="text-[10px] text-white/70 font-semibold">Total Distance</p>
                    <p className="font-display font-black text-base text-amber-300">{trip.distance_km} km</p>
                  </div>
                ) : null}
                {trip.total_budget ? (
                  <div className="rounded-xl bg-black/30 backdrop-blur-xs p-2 border border-white/10">
                    <p className="text-[10px] text-white/70 font-semibold">Est. Budget</p>
                    <p className="font-display font-black text-base text-emerald-400">
                      {sym}{Number(trip.total_budget).toLocaleString()}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Card Footer */}
            <div className="relative z-10 pt-2 border-t border-white/20 flex items-center justify-between text-[11px] text-white/80">
              <span className="font-bold flex items-center gap-1">
                🌐 Built with GlobeTrotter
              </span>
              <span className="text-[10px] opacity-80">Scan or click to view plan</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2 pt-2">
            {/* Download as Image — NEW */}
            <button
              onClick={downloadAsImage}
              disabled={downloadingImg}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white py-3 px-4 font-bold text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {downloadingImg
                ? <><CircleNotch size={18} className="animate-spin" /> Generating image…</>
                : <><DownloadSimple size={18} weight="bold" /> 📸 Download as Image (Instagram / Status)</>
              }
            </button>

            <button
              onClick={shareToWhatsApp}
              disabled={sharing}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 font-bold text-sm shadow-md transition-all active:scale-[0.98]"
            >
              <WhatsappLogo size={20} weight="fill" />
              Share on WhatsApp
            </button>

            <button
              onClick={copyShareText}
              disabled={sharing}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border bg-card hover:bg-accent text-foreground py-2.5 px-4 font-semibold text-xs transition-colors"
            >
              {copied ? <Check size={16} weight="bold" className="text-emerald-500" /> : <Copy size={16} weight="bold" />}
              {copied ? "Copied to Clipboard!" : "Copy Share Message & Link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
