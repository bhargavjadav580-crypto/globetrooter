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

const DEFAULT_TEMPLATES = [
  {
    id: "tmpl-golden-triangle",
    order: 1,
    name: "The Golden Triangle",
    description: "India's most iconic route: explore Mughal grandeur in Delhi, the Taj Mahal in Agra, and royal forts in Jaipur across 5 spectacular days.",
    starting_point: "Delhi",
    start_lat: 28.6139,
    start_lon: 77.209,
    destination: "Jaipur",
    dest_lat: 26.9124,
    dest_lon: 75.7873,
    total_budget: 35000,
    distance_km: 500,
    travel_time_minutes: 450,
    duration_days: 5,
    tags: ["Heritage", "Culture", "Iconic"],
    cover_image: "https://images.pexels.com/photos/1603650/pexels-photo-1603650.jpeg",
  },
  {
    id: "tmpl-kerala-coast",
    order: 2,
    name: "Kerala Coast & Tea Plantations",
    description: "Cruise the backwaters of Alleppey, hike the misty Munnar tea estates, and unwind on the pristine beaches of Kovalam across 6 days.",
    starting_point: "Kochi",
    start_lat: 9.9312,
    start_lon: 76.2673,
    destination: "Kovalam",
    dest_lat: 8.3988,
    dest_lon: 76.9782,
    total_budget: 42000,
    distance_km: 350,
    travel_time_minutes: 400,
    duration_days: 6,
    tags: ["Beaches", "Nature", "Backwaters"],
    cover_image: "https://images.pexels.com/photos/962464/pexels-photo-962464.jpeg",
  },
  {
    id: "tmpl-goa-escape",
    order: 3,
    name: "Goa Beach & Heritage Escape",
    description: "Party in North Goa, discover Portuguese old Goa churches, then relax on peaceful South Goa beaches across 4 sun-soaked days.",
    starting_point: "Panaji",
    start_lat: 15.4909,
    start_lon: 73.8278,
    destination: "Palolem",
    dest_lat: 15.01,
    dest_lon: 74.0233,
    total_budget: 28000,
    distance_km: 80,
    travel_time_minutes: 120,
    duration_days: 4,
    tags: ["Beaches", "Nightlife", "Heritage"],
    cover_image: "https://images.pexels.com/photos/1078850/pexels-photo-1078850.jpeg",
  },
  {
    id: "tmpl-himachal-circuit",
    order: 4,
    name: "Himachal High Pass Circuit",
    description: "Drive the legendary Manali-Spiti Highway through Rohtang, Kaza, Tabo and Nako across 8 days of dramatic Himalayan landscapes.",
    starting_point: "Chandigarh",
    start_lat: 30.7333,
    start_lon: 76.7794,
    destination: "Manali",
    dest_lat: 32.2396,
    dest_lon: 77.1887,
    total_budget: 55000,
    distance_km: 620,
    travel_time_minutes: 900,
    duration_days: 8,
    tags: ["Mountains", "Adventure", "Road Trip"],
    cover_image: "https://images.pexels.com/photos/7368308/pexels-photo-7368308.jpeg",
  },
  {
    id: "tmpl-rajasthan-royal",
    order: 5,
    name: "Classic Rajasthan Royal Tour",
    description: "Experience the grandeur of Rajasthan — from Jodhpur's Blue City to Jaisalmer's golden desert dunes and Udaipur's lake palaces across 7 days.",
    starting_point: "Jodhpur",
    start_lat: 26.2389,
    start_lon: 73.0243,
    destination: "Udaipur",
    dest_lat: 24.5854,
    dest_lon: 73.7125,
    total_budget: 65000,
    distance_km: 550,
    travel_time_minutes: 660,
    duration_days: 7,
    tags: ["Heritage", "Desert", "Palaces"],
    cover_image: "https://images.pexels.com/photos/20208538/pexels-photo-20208538.jpeg",
  },
];

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [loading, setLoading] = useState(false);
  const [cloning, setCloning] = useState(null);

  const loadTemplates = useCallback(async () => {
    try {
      const r = await api.get("/templates", { timeout: 6000 });
      if (Array.isArray(r.data) && r.data.length > 0) {
        setTemplates(r.data);
      } else {
        setTemplates(DEFAULT_TEMPLATES);
      }
    } catch {
      // Fallback silently to default curated templates without annoying error toast
      setTemplates(DEFAULT_TEMPLATES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleClone = async (templateId) => {
    setCloning(templateId);
    try {
      const tmpl = templates.find((t) => t.id === templateId) || DEFAULT_TEMPLATES.find((t) => t.id === templateId) || DEFAULT_TEMPLATES[0];

      // Attempt 1: Clone via dedicated clone endpoint
      try {
        const r = await api.post(`/templates/${templateId}/clone`, {}, { timeout: 12000 });
        const tripId = r.data?.trip?.id;
        toast.success("Template cloned! Customize your trip now.");
        if (tripId) navigate(`/trips/${tripId}/build`);
        else navigate("/trips");
        return;
      } catch (_) { /* fall through */ }

      // Attempt 2: Create trip via /trips POST
      try {
        const res = await api.post("/trips", {
          name: tmpl.name,
          description: tmpl.description,
          starting_point: tmpl.starting_point,
          destination: tmpl.destination,
          start_lat: tmpl.start_lat,
          start_lon: tmpl.start_lon,
          dest_lat: tmpl.dest_lat,
          dest_lon: tmpl.dest_lon,
          total_budget: tmpl.total_budget || 0,
          cover_image: tmpl.cover_image,
        }, { timeout: 12000 });
        const trip = res.data;
        toast.success("Template cloned! Customize your trip now.");
        navigate(`/trips/${trip.id}/build`);
        return;
      } catch (_) { /* fall through */ }

      // Attempt 3: Navigate to create trip page with template data pre-filled (fully client-side, always works)
      toast.success("Opening trip creator with template data...");
      navigate("/trips/new", {
        state: {
          fromTemplate: true,
          name: tmpl.name,
          description: tmpl.description,
          starting_point: tmpl.starting_point,
          destination: tmpl.destination,
          start_lat: tmpl.start_lat,
          start_lon: tmpl.start_lon,
          dest_lat: tmpl.dest_lat,
          dest_lon: tmpl.dest_lon,
          total_budget: tmpl.total_budget || 0,
          cover_image: tmpl.cover_image,
        },
      });
    } finally {
      setCloning(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground gap-2">
        <CircleNotch size={22} className="animate-spin text-primary" />
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
