import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import ItineraryContent from "@/components/ItineraryContent";
import { Compass, Copy, Eye, WhatsappLogo, XLogo, FacebookLogo, LinkSimple } from "@phosphor-icons/react";

export default function PublicTrip() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get(`/trips/public/${slug}`).then((r) => setData(r.data)).catch(() => setError(true));
  }, [slug]);

  const copyTrip = async () => {
    if (!user) { navigate("/"); return; }
    try {
      const res = await api.post(`/trips/${data.trip.id}/copy`);
      toast.success("Copied into your account!");
      navigate(`/trips/${res.data.id}/view`);
    } catch { toast.error("Could not copy this trip."); }
  };

  if (error) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">This public trip is not available.</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading shared trip…</div>;

  const shareUrl = window.location.href;
  const shareText = `Check out this trip: ${data.trip.name}`;
  const shareLinks = [
    { icon: WhatsappLogo, label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}` },
    { icon: XLogo, label: "X", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}` },
    { icon: FacebookLogo, label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` },
  ];
  const copyLink = async () => { await navigator.clipboard.writeText(shareUrl).catch(() => {}); toast.success("Link copied!"); };

  return (
    <div className="min-h-screen bg-background">
      <header className="glass border-b border-border sticky top-0 z-[900]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <Compass size={26} weight="fill" className="text-primary" />
            <span className="font-display font-extrabold text-lg tracking-tight">GlobeTrotter</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1" data-testid="social-share">
              {shareLinks.map((s) => (
                <a key={s.label} data-testid={`share-${s.label.toLowerCase()}`} href={s.href} target="_blank" rel="noreferrer"
                  className="rounded-full p-2 text-muted-foreground hover:text-primary hover:bg-accent transition-colors" title={`Share on ${s.label}`}>
                  <s.icon size={20} weight="fill" />
                </a>
              ))}
              <button data-testid="share-copy" onClick={copyLink} title="Copy link"
                className="rounded-full p-2 text-muted-foreground hover:text-primary hover:bg-accent transition-colors"><LinkSimple size={20} weight="bold" /></button>
            </div>
            <span className="hidden lg:flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
              <Eye size={14} weight="bold" /> Read-only
            </span>
            <button data-testid="public-copy-btn" onClick={copyTrip}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              <Copy size={16} weight="bold" /> {user ? "Copy to my trips" : "Sign in to copy"}
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 pb-16">
        <ItineraryContent data={data} readOnly />
      </div>
    </div>
  );
}
