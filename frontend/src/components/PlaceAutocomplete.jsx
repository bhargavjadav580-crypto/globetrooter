import React, { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { MapPin, MagnifyingGlass, Warning, SpinnerGap } from "@phosphor-icons/react";

export default function PlaceAutocomplete({ value, onSelect, placeholder = "Search a place…", testId = "place-autocomplete" }) {
  const [q, setQ] = useState(value || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const boxRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => { setQ(value || ""); }, [value]);

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const search = (text) => {
    setQ(text);
    setError(false);
    if (timer.current) clearTimeout(timer.current);
    if (!text || text.trim().length < 2) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setLoading(true); setOpen(true);
      try {
        const res = await api.get("/places/autocomplete", { params: { q: text } });
        setResults(res.data);
      } catch {
        setError(true); setResults([]);
      } finally { setLoading(false); }
    }, 400);
  };

  const pick = (r) => {
    setQ(r.name);
    setOpen(false);
    onSelect(r);
  };

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <MagnifyingGlass size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          data-testid={testId}
          value={q}
          onChange={(e) => search(e.target.value)}
          onFocus={() => q.length >= 2 && setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-input bg-card pl-10 pr-9 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
        />
        {loading && <SpinnerGap size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-spin" />}
      </div>
      {open && (
        <div className="absolute z-[1200] mt-2 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
          {loading && (
            <div className="p-3 space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-9 rounded-lg bg-muted animate-pulse" />)}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-destructive" data-testid="autocomplete-error">
              <Warning size={18} /> Live place search failed. Type again to retry.
            </div>
          )}
          {!loading && !error && results.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground">No matching places found.</div>
          )}
          {!loading && results.map((r) => (
            <button key={r.place_id} data-testid={`${testId}-option`} onClick={() => pick(r)}
              className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-accent transition-colors">
              <MapPin size={18} weight="fill" className="mt-0.5 shrink-0 text-primary" />
              <span className="text-sm">
                <span className="font-semibold block">{r.name}</span>
                <span className="text-muted-foreground text-xs line-clamp-1">{r.display_name}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
