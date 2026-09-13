import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import ItineraryContent from "@/components/ItineraryContent";
import TripSubNav from "@/components/TripSubNav";
import { PencilSimple, ShareNetwork, Copy, LinkSimple, Car, MapTrifold, Star } from "@phosphor-icons/react";

export default function ItineraryView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/trips/${id}/full`);
      setData(res.data);
    } catch {
      setError(true);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const publish = async () => {
    try {
      const res = await api.post(`/trips/${id}/publish`);
      const url = `${window.location.origin}/t/${res.data.public_slug}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Trip is public! Link copied to clipboard.");
      load();
    } catch { toast.error("Could not publish."); }
  };

  const unpublish = async () => {
    try {
      await api.post(`/trips/${id}/unpublish`);
      toast.success("Trip is now private.");
      load();
    } catch { toast.error("Could not unpublish."); }
  };

  const copyTrip = async () => {
    try { const res = await api.post(`/trips/${id}/copy`); toast.success("Copied to your trips!"); navigate(`/trips/${res.data.id}/view`); }
    catch { toast.error("Could not copy."); }
  };

  if (error) return <div className="mx-auto max-w-3xl px-6 py-20 text-center text-destructive">Could not load this trip.</div>;
  if (!data) return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 space-y-4" data-testid="itinerary-skeleton">
      <div className="h-8 w-56 rounded-2xl bg-muted animate-pulse" />
      <div className="h-4 w-40 rounded-xl bg-muted animate-pulse" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-3xl border border-border bg-card p-6 space-y-3">
          <div className="flex gap-3 items-center">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            <div className="h-6 w-44 rounded-xl bg-muted animate-pulse" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map(j => <div key={j} className="h-28 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="pb-16">
      {/* Persistent Trip Navigation Tab Bar */}
      <TripSubNav trip={data.trip} onTripUpdated={load} />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
        <div className="flex flex-wrap gap-2 justify-end mb-4">
          <button data-testid="copy-trip-btn" onClick={copyTrip}
            className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground hover:opacity-90 transition-opacity">
            <Copy size={16} weight="bold" /> Clone trip
          </button>
          {data.trip.is_public ? (
            <>
              <button data-testid="publish-trip-btn" onClick={publish}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
                <LinkSimple size={16} weight="bold" /> Copy public link
              </button>
              <button data-testid="unpublish-trip-btn" onClick={unpublish}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card hover:bg-destructive/10 text-muted-foreground hover:text-destructive px-3.5 py-2 text-xs font-semibold transition-colors">
                Make private
              </button>
            </>
          ) : (
            <button data-testid="publish-trip-btn" onClick={publish}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
              <ShareNetwork size={16} weight="bold" /> Publish trip
            </button>
          )}
        </div>

        {/* Post-Trip Celebration Banner */}
        {data.trip.end_date && new Date(data.trip.end_date + "T23:59:59") < new Date() && (
          <div className="mb-6 rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-3xl mb-1">🎉</p>
                <h3 className="font-display font-black text-xl tracking-tight">
                  Your trip is done! How was it?
                </h3>
                <p className="text-sm text-white/80 mt-1">
                  {data.trip.name} · {data.trip.starting_point} ➔ {data.trip.destination}
                </p>
              </div>
              <div className="flex flex-col items-center gap-2">
                {ratingSubmitted ? (
                  <p className="text-white font-bold text-lg">
                    ⭐ Thanks for rating! ({rating}/5)
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-white/90 font-semibold">Rate your experience</p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onMouseEnter={() => setHoveredStar(star)}
                          onMouseLeave={() => setHoveredStar(0)}
                          onClick={() => {
                            setRating(star);
                            setRatingSubmitted(true);
                            toast.success(`⭐ You rated this trip ${star}/5! Thanks for the feedback.`);
                          }}
                          className="transition-transform hover:scale-125"
                        >
                          <Star
                            size={28}
                            weight={(hoveredStar || rating) >= star ? "fill" : "regular"}
                            className={(hoveredStar || rating) >= star ? "text-amber-300" : "text-white/40"}
                          />
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-white/60">Tap a star to rate</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <ItineraryContent data={data} />
      </div>
    </div>
  );
}
