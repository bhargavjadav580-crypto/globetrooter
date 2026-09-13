import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, Check } from "@phosphor-icons/react";

export default function ProfileComplete() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    phone: user?.phone || "",
    city: user?.city || "",
    country: user?.country || "",
    additional_info: user?.additional_info || "",
    photo_url: user?.photo_url || "",
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.first_name || !form.city || !form.country) {
      toast.error("Please fill first name, city and country.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.put("/auth/profile", form);
      setUser(res.data);
      toast.success("Profile ready — let's plan a trip!");
      navigate("/dashboard");
    } catch {
      toast.error("Could not save profile. Try again.");
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <p className="overline text-primary mb-2">Registration</p>
        <h1 className="font-display font-black text-4xl tracking-tighter mb-1">Complete your profile</h1>
        <p className="text-muted-foreground mb-8">A few details so we can personalize your journeys.</p>

        <form onSubmit={submit} className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 ring-2 ring-primary/30">
              <AvatarImage src={form.photo_url} />
              <AvatarFallback><User size={28} /></AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Label className="text-xs">Photo URL</Label>
              <Input data-testid="profile-photo-url" value={form.photo_url} onChange={set("photo_url")}
                placeholder="https://…" className="mt-1" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div><Label className="text-xs">First Name *</Label>
              <Input data-testid="profile-first-name" value={form.first_name} onChange={set("first_name")} className="mt-1" /></div>
            <div><Label className="text-xs">Last Name</Label>
              <Input data-testid="profile-last-name" value={form.last_name} onChange={set("last_name")} className="mt-1" /></div>
            <div><Label className="text-xs">Email</Label>
              <Input value={user?.email || ""} disabled className="mt-1 opacity-70" /></div>
            <div><Label className="text-xs">Phone Number</Label>
              <Input data-testid="profile-phone" value={form.phone} onChange={set("phone")} className="mt-1" /></div>
            <div><Label className="text-xs">City *</Label>
              <Input data-testid="profile-city" value={form.city} onChange={set("city")} className="mt-1" /></div>
            <div><Label className="text-xs">Country *</Label>
              <Input data-testid="profile-country" value={form.country} onChange={set("country")} className="mt-1" /></div>
          </div>

          <div><Label className="text-xs">Additional Information</Label>
            <Textarea data-testid="profile-info" value={form.additional_info} onChange={set("additional_info")}
              placeholder="Tell us about your travel style…" className="mt-1" rows={3} /></div>

          <button data-testid="profile-submit" type="submit" disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60">
            <Check size={18} weight="bold" /> {saving ? "Saving…" : "Register & continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
