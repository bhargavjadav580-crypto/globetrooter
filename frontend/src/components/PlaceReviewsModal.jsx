import React, { useEffect, useState, useCallback } from "react";
import api, { API } from "@/lib/api";
import { toast } from "sonner";
import { Star, X, CircleNotch, Trash, Lightbulb, ChatCircleText, Image as ImageIcon } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import ImageUploader from "@/components/ImageUploader";

export default function PlaceReviewsModal({ place, isOpen, onClose, onReviewUpdated }) {
  const { user } = useAuth();
  const [data, setData] = useState({ reviews: [], avg_rating: null, review_count: 0 });
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [visitTip, setVisitTip] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadReviews = useCallback(async () => {
    if (!place?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/places/${place.id}/reviews`);
      setData(res.data);
    } catch {
      toast.error("Could not load reviews for this place.");
    } finally {
      setLoading(false);
    }
  }, [place?.id]);

  useEffect(() => {
    if (isOpen) {
      loadReviews();
      setComment("");
      setVisitTip("");
      setPhotoUrl("");
      setRating(5);
    }
  }, [isOpen, loadReviews]);

  if (!isOpen || !place) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) {
      toast.error("Please write a review comment.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/places/${place.id}/reviews`, {
        rating,
        comment: comment.trim(),
        visit_tip: visitTip.trim() || null,
        photo_url: photoUrl || null,
      });
      toast.success("Review submitted! Thank you for helping other travelers.");
      setComment("");
      setVisitTip("");
      setPhotoUrl("");
      await loadReviews();
      if (onReviewUpdated) onReviewUpdated();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId) => {
    setDeletingId(reviewId);
    try {
      await api.delete(`/places/${place.id}/reviews/${reviewId}`);
      toast.success("Review deleted.");
      await loadReviews();
      if (onReviewUpdated) onReviewUpdated();
    } catch {
      toast.error("Could not delete review.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl border border-border bg-card shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{place.name}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <div className="flex items-center text-amber-500">
                <Star size={16} weight="fill" />
                <span className="font-bold ml-1 text-foreground">
                  {data.avg_rating != null ? data.avg_rating : "No ratings yet"}
                </span>
              </div>
              <span>·</span>
              <span>{data.review_count} {data.review_count === 1 ? "review" : "reviews"}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} weight="bold" />
          </button>
        </div>

        {/* Modal Body / Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Write a Review Form */}
          <form onSubmit={handleSubmit} className="p-4 rounded-2xl border border-border bg-muted/30 space-y-3">
            <p className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
              <ChatCircleText size={16} className="text-primary" weight="bold" />
              Leave your rating & traveler tip
            </p>
            
            {/* Star selector */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 text-2xl transition-transform hover:scale-125 focus:outline-none"
                >
                  <Star
                    size={24}
                    weight={(hoverRating || rating) >= star ? "fill" : "regular"}
                    className={(hoverRating || rating) >= star ? "text-amber-400" : "text-muted-foreground/40"}
                  />
                </button>
              ))}
              <span className="ml-2 text-xs font-bold text-muted-foreground">
                {rating === 5 ? "Exceptional" : rating === 4 ? "Very Good" : rating === 3 ? "Average" : rating === 2 ? "Below Average" : "Poor"}
              </span>
            </div>

            {/* Comment */}
            <div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What did you think? What should other travelers know?"
                rows={3}
                required
                className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Visit Tip */}
            <div>
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                <Lightbulb size={14} className="text-amber-500" weight="fill" />
                Insider tip for travelers (optional)
              </div>
              <input
                value={visitTip}
                onChange={(e) => setVisitTip(e.target.value)}
                placeholder="e.g. 'Arrive before 8:30 AM to skip the queue' or 'Try the Malpua'"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Photo Attachment */}
            <ImageUploader
              value={photoUrl}
              onChange={setPhotoUrl}
              label="Attach Photo of Place / Food / View (optional)"
              compact
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-xs"
              >
                {submitting ? <CircleNotch size={16} className="animate-spin" /> : "Post Review"}
              </button>
            </div>
          </form>

          {/* Reviews List */}
          <div className="space-y-4">
            <h4 className="font-bold text-sm text-foreground">Traveler Reviews ({data.review_count})</h4>
            
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <CircleNotch size={18} className="animate-spin" /> Loading reviews…
              </div>
            ) : data.reviews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-2xl p-6">
                Be the first to review <strong>{place.name}</strong> and share practical tips!
              </div>
            ) : (
              data.reviews.map((rev) => (
                <div key={rev.id} className="p-4 rounded-2xl border border-border bg-card space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={rev.user_photo} />
                        <AvatarFallback>{rev.user_name?.[0] || "T"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-sm leading-tight">{rev.user_name}</p>
                        <p className="text-xs text-muted-foreground">{new Date(rev.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center text-amber-500">
                        {[...Array(rev.rating)].map((_, i) => (
                          <Star key={i} size={14} weight="fill" />
                        ))}
                      </div>
                      {(user?.user_id === rev.user_id || user?.is_admin) && (
                        <button
                          onClick={() => handleDelete(rev.id)}
                          disabled={deletingId === rev.id}
                          className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                          title="Delete review"
                        >
                          {deletingId === rev.id ? <CircleNotch size={14} className="animate-spin" /> : <Trash size={14} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{rev.comment}</p>

                  {/* Attached Review Photo */}
                  {rev.photo_url && (
                    <div className="mt-2">
                      <a
                        href={rev.photo_url.startsWith("http") ? rev.photo_url : `${API.replace(/\/api$/, "")}${rev.photo_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block"
                      >
                        <img
                          src={rev.photo_url.startsWith("http") ? rev.photo_url : `${API.replace(/\/api$/, "")}${rev.photo_url}`}
                          alt="Traveler photo"
                          className="h-36 w-auto max-w-full rounded-xl object-cover border border-border shadow-xs hover:opacity-90 transition-opacity"
                        />
                      </a>
                    </div>
                  )}

                  {rev.visit_tip && (
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                      <Lightbulb size={16} className="text-amber-500 shrink-0 mt-0.5" weight="fill" />
                      <div>
                        <strong className="font-semibold">Traveler Tip: </strong>
                        {rev.visit_tip}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
