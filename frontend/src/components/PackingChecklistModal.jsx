import React, { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  X, Plus, Trash, CheckSquare, Square, Backpack,
  FirstAid, Car, DeviceMobile, Suitcase, CircleNotch, Sparkle,
} from "@phosphor-icons/react";

const CAT_ICONS = {
  "Vehicle & Safety": Car,
  "Health & Medical": FirstAid,
  "Electronics": DeviceMobile,
  "Luggage & Essentials": Suitcase,
  "General": Backpack,
};

export default function PackingChecklistModal({ tripId, isOpen, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Luggage & Essentials");
  const [adding, setAdding] = useState(false);

  const loadChecklist = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    try {
      const res = await api.get(`/trips/${tripId}/checklist`);
      setItems(res.data);
    } catch {
      toast.error("Could not load packing checklist.");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    if (isOpen) loadChecklist();
  }, [isOpen, loadChecklist]);

  const DEFAULT_ITEMS = [
    { title: "Passport / Aadhaar Card", category: "Luggage & Essentials" },
    { title: "Phone Charger", category: "Electronics" },
    { title: "Power Bank", category: "Electronics" },
    { title: "Earphones / Headphones", category: "Electronics" },
    { title: "First Aid Kit", category: "Health & Medical" },
    { title: "Prescribed Medicines", category: "Health & Medical" },
    { title: "Sunscreen (SPF 50+)", category: "Health & Medical" },
    { title: "Water Bottle", category: "Luggage & Essentials" },
    { title: "Extra Clothes (3 days)", category: "Luggage & Essentials" },
    { title: "Cash & ATM Cards", category: "Luggage & Essentials" },
    { title: "Snacks for the road", category: "Luggage & Essentials" },
    { title: "Car Emergency Kit", category: "Vehicle & Safety" },
  ];

  const seedDefaults = async () => {
    setAdding(true);
    try {
      await Promise.all(
        DEFAULT_ITEMS.map((item) =>
          api.post(`/trips/${tripId}/checklist`, { ...item, is_checked: false })
        )
      );
      // Reload from server so count & state are always accurate
      const res = await api.get(`/trips/${tripId}/checklist`);
      setItems(res.data);
      toast.success(`✅ ${res.data.length} essential packing items added!`);
    } catch {
      toast.error("Could not add default items.");
    } finally {
      setAdding(false);
    }
  };

  if (!isOpen) return null;

  const toggleItem = async (item) => {
    const nextState = !item.is_checked;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_checked: nextState } : i)));
    try {
      await api.put(`/trips/${tripId}/checklist/${item.id}`, { is_checked: nextState });
    } catch {
      toast.error("Failed to update item.");
      loadChecklist();
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const res = await api.post(`/trips/${tripId}/checklist`, {
        title: newTitle.trim(),
        category: newCategory,
        is_checked: false,
      });
      setItems((prev) => [...prev, res.data]);
      setNewTitle("");
      toast.success("Item added to packing list!");
    } catch {
      toast.error("Could not add item.");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    try {
      await api.delete(`/trips/${tripId}/checklist/${itemId}`);
      toast.success("Item removed.");
    } catch {
      toast.error("Could not delete item.");
      loadChecklist();
    }
  };

  const checkedCount = items.filter((i) => i.is_checked).length;
  const totalCount = items.length;
  const progressPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  // Group by category
  const categories = Array.from(new Set(items.map((i) => i.category || "General")));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl border border-border bg-card shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600">
                <Backpack size={24} weight="bold" />
              </div>
              <div>
                <h3 className="font-display font-black text-xl tracking-tight text-foreground">
                  Road Trip Packing & Emergency Hub
                </h3>
                <p className="text-xs text-muted-foreground">
                  {checkedCount} of {totalCount} items ready ({progressPct}%)
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

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Body: Categorized Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <CircleNotch size={20} className="animate-spin text-primary" /> Loading packing items…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
              <div className="p-4 rounded-3xl bg-emerald-500/10">
                <Backpack size={36} className="text-emerald-500" weight="duotone" />
              </div>
              <div>
                <p className="font-bold text-foreground">Your packing list is empty!</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                  Add items manually, or let us fill in 12 road-trip essentials to get you started.
                </p>
              </div>
              <button
                onClick={seedDefaults}
                disabled={adding}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 text-white px-5 py-2.5 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-60 transition-colors shadow-sm"
              >
                {adding ? <CircleNotch size={16} className="animate-spin" /> : <Sparkle size={16} weight="fill" />}
                {adding ? "Adding items…" : "✨ Add Suggested Items"}
              </button>
              <p className="text-xs text-muted-foreground">Or use the form below to add your own.</p>
            </div>

          ) : (
            categories.map((cat) => {
              const Icon = CAT_ICONS[cat] || Backpack;
              const catItems = items.filter((i) => i.category === cat);
              return (
                <div key={cat} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Icon size={16} className="text-primary" weight="bold" />
                    <span>{cat}</span>
                    <span className="text-[11px] font-normal opacity-70">
                      ({catItems.filter((i) => i.is_checked).length}/{catItems.length})
                    </span>
                  </div>
                  <div className="space-y-1.5 pl-1">
                    {catItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => toggleItem(item)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                          item.is_checked
                            ? "border-emerald-500/30 bg-emerald-500/5 text-muted-foreground line-through"
                            : "border-border bg-card hover:border-primary/50 text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {item.is_checked ? (
                            <CheckSquare size={18} weight="fill" className="text-emerald-500 shrink-0" />
                          ) : (
                            <Square size={18} weight="bold" className="text-muted-foreground shrink-0" />
                          )}
                          <span className="text-sm font-medium truncate">{item.title}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item.id);
                          }}
                          className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Add Item Form */}
        <div className="p-4 border-t border-border bg-muted/20">
          <form onSubmit={handleAddItem} className="flex gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Add item (e.g. Flashlight, Action Cam, Passport)…"
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="rounded-xl border border-border bg-background px-2.5 py-2 text-xs font-semibold outline-none"
            >
              <option value="Vehicle & Safety">Vehicle</option>
              <option value="Health & Medical">Health</option>
              <option value="Electronics">Electronics</option>
              <option value="Luggage & Essentials">Luggage</option>
              <option value="General">General</option>
            </select>
            <button
              type="submit"
              disabled={adding || !newTitle.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {adding ? <CircleNotch size={16} className="animate-spin" /> : <Plus size={16} weight="bold" />}
              Add
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
