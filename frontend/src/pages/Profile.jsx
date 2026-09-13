import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { User, FloppyDisk, Eye, Trash, BookmarkSimple, Warning, MapPin } from "@phosphor-icons/react";

const LANGS = ["English", "हिन्दी", "Español", "Français", "Deutsch", "日本語"];

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [saved, setSaved] = useState([]);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadSaved = () => api.get("/saved-destinations").then((r) => setSaved(r.data)).catch(() => {});
  useEffect(() => {
    setForm({ first_name: user?.first_name || "", last_name: user?.last_name || "", phone: user?.phone || "",
      city: user?.city || "", country: user?.country || "", additional_info: user?.additional_info || "",
      photo_url: user?.photo_url || "", language: user?.language || "English" });
    api.get("/trips").then((r) => setTrips(r.data)).catch(() => {});
    loadSaved();
  }, [user]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async () => {
    setSaving(true);
    try { const res = await api.put("/auth/profile", form); setUser(res.data); toast.success("Profile updated"); }
    catch { toast.error("Could not update"); } finally { setSaving(false); }
  };

  const removeSaved = async (id) => { await api.delete(`/saved-destinations/${id}`); loadSaved(); };
  const deleteAccount = async () => {
    try { await api.delete("/auth/account"); toast.success("Account deleted"); logout(); }
    catch { toast.error("Could not delete account"); }
  };

  const today = new Date().toISOString().slice(0, 10);
  const preplanned = trips.filter((t) => !t.end_date || t.end_date >= today);
  const previous = trips.filter((t) => t.end_date && t.end_date < today);

  const Row = ({ list, label, testid }) => (
    <section className="mt-10">
      <h2 className="overline text-primary mb-4">{label}</h2>
      {list.length === 0 ? <p className="text-sm text-muted-foreground">Nothing here yet.</p> : (
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2" data-testid={testid}>
          {list.map((t, i) => (
            <div key={t.id} className="shrink-0 w-52 rounded-2xl border border-border bg-card overflow-hidden">
              <img src={t.cover_image} alt={t.name} className="h-28 w-full object-cover" />
              <div className="p-3">
                <p className="font-display font-bold tracking-tight line-clamp-1">{t.name}</p>
                <button data-testid={`profile-view-${i}`} onClick={() => navigate(`/trips/${t.id}/view`)}
                  className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:bg-primary hover:text-primary-foreground transition-colors">
                  <Eye size={15} weight="bold" /> View
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex flex-col items-center gap-3">
            <Avatar className="h-28 w-28 ring-4 ring-primary/20">
              <AvatarImage src={form.photo_url} />
              <AvatarFallback><User size={40} /></AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 grid sm:grid-cols-2 gap-4">
            <div><Label className="text-xs">First Name</Label><Input data-testid="pf-first" value={form.first_name || ""} onChange={set("first_name")} className="mt-1" /></div>
            <div><Label className="text-xs">Last Name</Label><Input data-testid="pf-last" value={form.last_name || ""} onChange={set("last_name")} className="mt-1" /></div>
            <div><Label className="text-xs">Phone</Label><Input data-testid="pf-phone" value={form.phone || ""} onChange={set("phone")} className="mt-1" /></div>
            <div><Label className="text-xs">Photo URL</Label><Input data-testid="pf-photo" value={form.photo_url || ""} onChange={set("photo_url")} className="mt-1" /></div>
            <div><Label className="text-xs">City</Label><Input data-testid="pf-city" value={form.city || ""} onChange={set("city")} className="mt-1" /></div>
            <div><Label className="text-xs">Country</Label><Input data-testid="pf-country" value={form.country || ""} onChange={set("country")} className="mt-1" /></div>
            <div><Label className="text-xs">Language preference</Label>
              <select data-testid="pf-language" value={form.language || "English"} onChange={set("language")}
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
                {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><Label className="text-xs">Additional Information</Label>
              <Textarea data-testid="pf-info" value={form.additional_info || ""} onChange={set("additional_info")} className="mt-1" rows={2} /></div>
          </div>
        </div>
        <button data-testid="save-profile-btn" onClick={save} disabled={saving}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60">
          <FloppyDisk size={18} weight="bold" /> {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <Row list={preplanned} label="Preplanned Trips" testid="preplanned-row" />
      <Row list={previous} label="Previous Trips" testid="previous-row" />

      {/* Saved Destinations */}
      <section className="mt-10">
        <h2 className="overline text-primary mb-4">Saved Destinations</h2>
        {saved.length === 0 ? <p className="text-sm text-muted-foreground">No saved destinations yet. Save cities from the Discover tab.</p> : (
          <div className="flex flex-wrap gap-2" data-testid="saved-destinations">
            {saved.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
                <MapPin size={14} weight="fill" className="text-primary" /> {s.place_name}
                <button data-testid={`remove-saved-${s.id}`} onClick={() => removeSaved(s.id)} className="text-muted-foreground hover:text-destructive"><Trash size={14} /></button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Danger zone */}
      <section className="mt-12 rounded-3xl border border-destructive/40 bg-destructive/5 p-6">
        <h2 className="font-display font-bold tracking-tight text-destructive flex items-center gap-2"><Warning size={20} weight="fill" /> Danger zone</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-4">Deleting your account permanently removes all your trips, itineraries and posts.</p>
        <button data-testid="delete-account-btn" onClick={() => setConfirmDelete(true)}
          className="inline-flex items-center gap-2 rounded-full bg-destructive px-5 py-2.5 font-semibold text-destructive-foreground hover:opacity-90 transition-opacity">
          <Trash size={18} weight="bold" /> Delete my account
        </button>
      </section>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display tracking-tight">Delete your account?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This cannot be undone. All your trips and data will be permanently deleted.</p>
          <DialogFooter>
            <button onClick={() => setConfirmDelete(false)} className="rounded-full bg-muted px-4 py-2 text-sm font-semibold">Cancel</button>
            <button data-testid="confirm-delete-account" onClick={deleteAccount} className="rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground">Yes, delete</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
