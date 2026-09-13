import React, { useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { X, Plus, Sparkle, CircleNotch, MapPin, Tag, CurrencyInr } from "@phosphor-icons/react";
import ImageUploader from "@/components/ImageUploader";

const POPULAR_TAGS = ["Must Try", "Scenic View", "Pure Veg", "Hidden Gem", "Photo Spot", "Heritage", "Budget", "Family-Friendly"];

export default function CustomPlaceModal({ section, isOpen, onClose, onPlaceAdded, currencySymbol = "₹" }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("food");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [selectedTags, setSelectedTags] = useState(["Must Try"]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !section) return null;

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please provide a name for this place.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        external_place_id: `custom-${Date.now()}`,
        name: name.trim(),
        category: category,
        description: description.trim() || `Custom ${category} spot in ${section.place_name || section.title}.`,
        cost_estimate: parseFloat(cost) || 0,
        scheduled_time: scheduledTime || null,
        lat: section.latitude || null,
        lon: section.longitude || null,
        photo_url: photoUrl || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=70",
        tags: selectedTags,
      };
      await api.post(`/sections/${section.id}/places`, payload);
      toast.success(`Added "${name}" to itinerary!`);
      setName("");
      setDescription("");
      setCost("");
      setScheduledTime("");
      setPhotoUrl("");
      if (onPlaceAdded) onPlaceAdded();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not add custom place.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl border border-border bg-card shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-border bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <MapPin size={22} weight="bold" />
            </div>
            <div>
              <h3 className="font-display font-black text-xl tracking-tight text-foreground">
                Add Custom Place / Hidden Gem
              </h3>
              <p className="text-xs text-muted-foreground">
                Adding to {section.title} ({section.place_name || "Custom section"})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Place Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Grandma's Seaside Chai Stall or Secret Waterfall Trek"
              required
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
              >
                <option value="food">🍽️ Food & Dining</option>
                <option value="attraction">🏛️ Attraction / Sight</option>
                <option value="market">🛍️ Market / Shopping</option>
                <option value="scenic">🌄 Viewpoint / Nature</option>
                <option value="stay">🏨 Stays / Campsite</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1">Estimated Cost ({currencySymbol})</label>
              <input
                type="number"
                min="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Scheduled Time (optional)</label>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Traveler Notes / Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Why visit? Any tips, famous dishes, or entry notes?"
              className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Vibe / Dietary Tags */}
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5 flex items-center gap-1">
              <Tag size={13} /> Vibe & Dietary Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-bold shadow-xs"
                        : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {isSelected ? `✓ ${tag}` : `+ ${tag}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photo Upload */}
          <ImageUploader
            value={photoUrl}
            onChange={setPhotoUrl}
            label="Upload Photo of this Place (optional)"
            compact
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-xs"
            >
              {submitting ? <CircleNotch size={16} className="animate-spin" /> : <Plus size={16} weight="bold" />}
              Add to Itinerary
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
