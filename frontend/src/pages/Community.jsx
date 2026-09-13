import React, { useEffect, useState } from "react";
import api, { API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MagnifyingGlass, PaperPlaneTilt, User, MapPin, Plus, ChatCircleText, Heart } from "@phosphor-icons/react";
import ImageUploader from "@/components/ImageUploader";

export default function Community() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", place_name: "", image: "" });

  const load = (query) => api.get("/community/posts", { params: query ? { q: query } : {} }).then((r) => setPosts(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  // Debounced live search — waits 350ms after typing stops
  useEffect(() => {
    const timer = setTimeout(() => { if (q !== undefined) load(q); }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  const toggleLike = async (postId) => {
    try {
      const res = await api.post(`/community/posts/${postId}/like`);
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const currentLikedBy = p.liked_by || [];
          const uid = user?.id || user?.user_id;
          const newLikedBy = res.data.liked
            ? [...currentLikedBy.filter((id) => id !== uid), uid]
            : currentLikedBy.filter((id) => id !== uid);
          return {
            ...p,
            like_count: res.data.like_count,
            liked_by: newLikedBy,
          };
        })
      );
    } catch {
      toast.error("Could not update like. Please make sure you are logged in.");
    }
  };

  const submit = async () => {
    if (!form.title || !form.body) return toast.error("Add a title and your experience.");
    setSubmitting(true);
    try {
      await api.post("/community/posts", form);
      toast.success("Shared with the community!");
      setOpen(false);
      setForm({ title: "", body: "", place_name: "", image: "" });
      load();
    } catch {
      toast.error("Could not post.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div><p className="overline text-primary mb-1">Traveler stories</p>
          <h1 className="font-display font-black text-4xl tracking-tighter">Community</h1></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button data-testid="new-post-btn" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
              <Plus size={18} weight="bold" /> Share
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display tracking-tight">Share your experience</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Title</Label><Input data-testid="post-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs">Place / City</Label><Input data-testid="post-place" value={form.place_name} onChange={(e) => setForm({ ...form, place_name: e.target.value })} className="mt-1" /></div>
              <ImageUploader value={form.image} onChange={(url) => setForm({ ...form, image: url })} label="Travel Photo" compact />
              <div><Label className="text-xs">Your story</Label><Textarea data-testid="post-body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} className="mt-1" /></div>
              <button data-testid="post-submit" onClick={submit} disabled={submitting} className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground disabled:opacity-60 transition-opacity">
                {submitting ? <><span className="animate-spin">⏳</span> Posting…</> : <><PaperPlaneTilt size={18} weight="bold" /> Post</>}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); load(q); }} className="relative mb-6">
        <MagnifyingGlass size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input data-testid="community-search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search stories by place or keyword…"
          className="w-full rounded-full border border-input bg-card pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-ring" />
      </form>

      {posts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-12 text-center">
          <ChatCircleText size={40} weight="duotone" className="mx-auto text-primary mb-3" />
          <p className="font-semibold mb-1">No stories yet</p>
          <p className="text-muted-foreground text-sm">Be the first to share a travel experience.</p>
        </div>
      ) : (
        <div className="space-y-4" data-testid="community-feed">
          {posts.map((p, i) => {
            const uid = user?.id || user?.user_id;
            const isLiked = (p.liked_by || []).includes(uid);
            return (
              <motion.article key={p.id} data-testid={`post-${i}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="rounded-3xl border border-border bg-card overflow-hidden shadow-xs hover:border-primary/30 transition-all">
                {p.image && (
                  <img
                    src={p.image.startsWith("http") ? p.image : `${API.replace(/\/api$/, "")}${p.image}`}
                    alt={p.title}
                    className="h-56 w-full object-cover"
                  />
                )}
                <div className="p-5">
                  <div className="flex items-center justify-between gap-2.5 mb-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-9 w-9"><AvatarImage src={p.author_photo} /><AvatarFallback><User size={16} /></AvatarFallback></Avatar>
                      <div>
                        <p className="text-sm font-semibold">{p.author_name || "Traveler"}</p>
                        <p className="text-xs text-muted-foreground">{(p.created_at || "").slice(0, 10)}</p>
                      </div>
                    </div>
                    {/* Interactive Like Button */}
                    <button
                      onClick={() => toggleLike(p.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        isLiked
                          ? "bg-rose-500/10 text-rose-600 border border-rose-500/30"
                          : "bg-muted text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                      }`}
                    >
                      <Heart size={15} weight={isLiked ? "fill" : "bold"} className={isLiked ? "text-rose-500 animate-pulse" : ""} />
                      <span>{p.like_count || (p.liked_by || []).length || 0}</span>
                    </button>
                  </div>
                  <h3 className="font-display font-bold text-lg tracking-tight">{p.title}</h3>
                  {p.place_name && <p className="text-xs text-primary flex items-center gap-1 mt-0.5"><MapPin size={13} weight="fill" /> {p.place_name}</p>}
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line leading-relaxed">{p.body}</p>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
}
