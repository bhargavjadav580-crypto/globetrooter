import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  MapTrifold, Car, Receipt, PencilSimple, FilePdf, UsersThree,
  Backpack, CurrencyInr, CurrencyDollar, CurrencyEur, CurrencyGbp,
  CaretDown, ArrowLeft, FlagCheckered, ShareNetwork,
} from "@phosphor-icons/react";
import CollaboratorsModal from "@/components/CollaboratorsModal";
import PackingChecklistModal from "@/components/PackingChecklistModal";
import ShareTripStoryModal from "@/components/ShareTripStoryModal";

const CURRENCIES = [
  { code: "INR", symbol: "₹", label: "INR (₹)" },
  { code: "USD", symbol: "$", label: "USD ($)" },
  { code: "EUR", symbol: "€", label: "EUR (€)" },
  { code: "GBP", symbol: "£", label: "GBP (£)" },
  { code: "AED", symbol: "AED", label: "AED (د.إ)" },
  { code: "JPY", symbol: "¥", label: "JPY (¥)" },
];

export default function TripSubNav({ trip, onTripUpdated }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollabOpen, setIsCollabOpen] = useState(false);
  const [isPackingOpen, setIsPackingOpen] = useState(false);
  const [isStoryOpen, setIsStoryOpen] = useState(false);
  const [currDropdown, setCurrDropdown] = useState(false);

  if (!trip) return null;

  const activeTab = (() => {
    const path = location.pathname;
    if (path.endsWith("/build")) return "build";
    if (path.endsWith("/view")) return "view";
    if (path.endsWith("/roadtrip")) return "roadtrip";
    if (path.endsWith("/expenses")) return "expenses";
    if (path.endsWith("/plan")) return "plan";
    if (path.endsWith("/brochure")) return "brochure";
    return "view";
  })();

  const handleCurrencyChange = async (c) => {
    setCurrDropdown(false);
    try {
      await api.put(`/trips/${trip.id}`, {
        currency: c.code,
        currency_symbol: c.symbol,
      });
      toast.success(`Currency switched to ${c.label}`);
      if (onTripUpdated) onTripUpdated();
    } catch {
      toast.error("Could not update currency.");
    }
  };

  const tabs = [
    { id: "build", label: "🧩 Build", icon: PencilSimple, path: `/trips/${trip.id}/build` },
    { id: "view", label: "📋 Day-by-Day", icon: MapTrifold, path: `/trips/${trip.id}/view` },
    { id: "roadtrip", label: "🚗 Road Trip & Stays", icon: Car, path: `/trips/${trip.id}/roadtrip` },
    { id: "expenses", label: "💰 Expenses & Split", icon: Receipt, path: `/trips/${trip.id}/expenses` },
    { id: "plan", label: "✨ Full Journey", icon: FlagCheckered, path: `/trips/${trip.id}/plan` },
  ];

  return (
    <>
      <div className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-30 shadow-xs">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* Top Bar: Breadcrumb + Title + Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 pb-2">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to="/dashboard"
                className="p-1.5 rounded-xl border border-border bg-background hover:bg-accent transition-colors text-muted-foreground hover:text-foreground shrink-0"
                title="Back to Dashboard"
              >
                <ArrowLeft size={16} weight="bold" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-black text-lg sm:text-xl tracking-tight truncate">
                    {trip.name}
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold shrink-0">
                    {trip.currency_symbol || "₹"} {trip.currency || "INR"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {trip.starting_point} ➔ {trip.destination} {trip.start_date ? `· ${trip.start_date}` : ""}
                </p>
              </div>
            </div>

            {/* Quick Action Tools */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Currency Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCurrDropdown(!currDropdown)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/90 hover:bg-accent px-3 py-1.5 text-xs font-semibold shadow-2xs hover:shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="font-extrabold text-primary">{trip.currency_symbol || "₹"}</span>
                  <span className="font-medium text-foreground">{trip.currency || "INR"}</span>
                  <CaretDown size={12} weight="bold" className="text-muted-foreground" />
                </button>
                {currDropdown && (
                  <div className="absolute right-0 mt-1.5 w-40 rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95">
                    {CURRENCIES.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => handleCurrencyChange(c)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between hover:bg-accent transition-colors ${
                          (trip.currency || "INR") === c.code ? "text-primary bg-primary/10 font-bold" : "text-foreground"
                        }`}
                      >
                        <span>{c.label}</span>
                        <span className="font-black">{c.symbol}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Packing Checklist - Featured Glow Pill */}
              <button
                type="button"
                onClick={() => setIsPackingOpen(true)}
                className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-emerald-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/50 text-emerald-800 dark:text-emerald-300 px-4 py-1.5 text-xs font-extrabold shadow-sm shadow-emerald-500/15 hover:shadow-emerald-500/25 transition-all hover:scale-[1.04] active:scale-[0.98]"
                title="Essential Trip Packing Checklist"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-85"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Backpack size={16} className="text-emerald-600 dark:text-emerald-400 group-hover:rotate-6 transition-transform" weight="fill" />
                <span className="tracking-tight">Packing List</span>
                <span className="text-[10px] uppercase font-black tracking-wider bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded-full ml-0.5">
                  Check
                </span>
              </button>

              {/* Friends / Collaborators */}
              <button
                type="button"
                onClick={() => setIsCollabOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-800 dark:text-amber-300 px-3.5 py-1.5 text-xs font-bold shadow-2xs hover:shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                title="Manage Trip Friends & Collaborators"
              >
                <UsersThree size={16} className="text-amber-600 dark:text-amber-400" weight="bold" />
                <span>Friends</span>
              </button>

              {/* PDF Brochure */}
              <button
                type="button"
                onClick={() => navigate(`/trips/${trip.id}/brochure`)}
                className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-700 dark:text-rose-300 px-3.5 py-1.5 text-xs font-bold shadow-2xs hover:shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                title="View & Download PDF Trip Brochure"
              >
                <FilePdf size={16} className="text-rose-600 dark:text-rose-400" weight="bold" />
                <span className="hidden sm:inline">Brochure</span>
              </button>

              {/* Share Story / Social Card */}
              <button
                type="button"
                onClick={() => setIsStoryOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-700 dark:text-sky-300 px-3.5 py-1.5 text-xs font-bold shadow-2xs hover:shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                title="Share Trip Story & WhatsApp Link"
              >
                <ShareNetwork size={16} className="text-sky-600 dark:text-sky-400" weight="bold" />
                <span className="hidden sm:inline">Story</span>
              </button>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-border/50 pt-1">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <Link
                  key={t.id}
                  to={t.path}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <Icon size={16} weight={isActive ? "fill" : "regular"} />
                  {t.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Collaborators Modal */}
      <CollaboratorsModal
        tripId={trip.id}
        isOpen={isCollabOpen}
        onClose={() => setIsCollabOpen(false)}
      />

      {/* Packing Checklist Modal */}
      <PackingChecklistModal
        tripId={trip.id}
        isOpen={isPackingOpen}
        onClose={() => setIsPackingOpen(false)}
      />

      {/* Social Story Share Modal */}
      <ShareTripStoryModal
        trip={trip}
        isOpen={isStoryOpen}
        onClose={() => setIsStoryOpen(false)}
      />
    </>
  );
}
