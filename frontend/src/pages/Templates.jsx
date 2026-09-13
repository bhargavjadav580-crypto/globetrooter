import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  MapTrifold, Clock, CurrencyInr, Tag, ArrowRight, CircleNotch,
  BookmarkSimple, Sparkle,
} from "@phosphor-icons/react";

const TAG_COLORS = {
  Heritage: "bg-amber-100 text-amber-800",
  Culture: "bg-purple-100 text-purple-800",
  Iconic: "bg-blue-100 text-blue-800",
  Beaches: "bg-cyan-100 text-cyan-800",
  Nature: "bg-green-100 text-green-800",
  Backwaters: "bg-teal-100 text-teal-800",
  Nightlife: "bg-pink-100 text-pink-800",
  Mountains: "bg-indigo-100 text-indigo-800",
  Adventure: "bg-orange-100 text-orange-800",
  "Road Trip": "bg-red-100 text-red-800",
  Desert: "bg-yellow-100 text-yellow-800",
  Palaces: "bg-violet-100 text-violet-800",
};

function TemplateCard({ template, onClone, cloning }) {
  const dur = template.duration_days;
  const budget = template.total_budget?.toLocaleString("en-IN");
  const dist = Math.round(template.distance_km || 0);

  return (
    <div className="group relative rounded-2xl overflow-hidden border border-border bg-card shadow-sm card-hover">
      <div className="relative h-48 overflow-hidden">
        <img
          src={template.cover_image}
          alt={template.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => { e.target.src = "https://images.pexels.com/photos/1078850/pexels-photo-1078850.jpeg"; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-white font-bold text-lg leading-tight">{template.name}</h3>
          <p className="text-white/80 text-sm mt-0.5">
            {template.starting_point} to {template.destination}
          </p>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">{template.description}</p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock size={14} className="text-primary" />
            {dur} days
          </span>
          <span className="flex items-center gap-1">
            <CurrencyInr size={14} className="text-primary" />
            Rs.{budget}
          </span>
          <span className="flex items-center gap-1">
            <MapTrifold size={14} className="text-primary" />
            {dist} km
          </span>
        </div>
        {template.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {template.tags.map((tag) => (
              <span key={tag} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TAG_COLORS[tag] || "bg-muted text-muted-foreground"}`}>
                <Tag size={10} />
                {tag}
              </span>
            ))}
          </div>
        )}
        <button
          onClick={() => onClone(template.id)}
          disabled={cloning === template.id}
          className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {cloning === template.id ? (
            <CircleNotch size={16} className="animate-spin" />
          ) : (
            <BookmarkSimple size={16} weight="bold" />
          )}
          {cloning === template.id ? "Cloning..." : "Clone & Customize"}
          {cloning !== template.id && <ArrowRight size={14} />}
        </button>
      </div>
    </div>
  );
}

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(null);

  const loadTemplates = useCallback(async () => {
    try {
      const r = await api.get("/templates");
      setTemplates(r.data);
    } catch {
      toast.error("Could not load trip templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const handleClone = async (templateId) => {
    setCloning(templateId);
    try {
      const r = await api.post(`/templates/${templateId}/clone`);
      const tripId = r.data?.trip?.id;
      toast.success("Template cloned! Customize your trip now.");
      if (tripId) navigate(`/trips/${tripId}/build`);
      else navigate("/trips");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not clone template.");
    } finally {
      setCloning(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground gap-2">
        <CircleNotch size={22} className="animate-spin" />
        Loading trip templates...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Sparkle size={22} className="text-primary" weight="fill" />
          <h1 className="text-2xl font-bold">Starter Trip Templates</h1>
        </div>
        <p className="text-muted-foreground">
          Pick a curated route, clone it in one click, then customize dates, stops, and budget to make it yours.
        </p>
      </div>
      {templates.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">No templates available yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((tmpl) => (
            <TemplateCard key={tmpl.id} template={tmpl} onClone={handleClone} cloning={cloning} />
          ))}
        </div>
      )}
    </div>
  );
}
