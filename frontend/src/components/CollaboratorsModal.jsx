import React, { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { UsersThree, UserPlus, X, Trash, CircleNotch, ShieldCheck, Eye, PencilSimple, EnvelopeSimple } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function CollaboratorsModal({ tripId, isOpen, onClose }) {
  const [data, setData] = useState({ owner: null, collaborators: [], is_owner: false });
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadCollaborators = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    try {
      const res = await api.get(`/trips/${tripId}/collaborators`);
      setData(res.data);
    } catch {
      toast.error("Could not load collaborators.");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    if (isOpen) {
      loadCollaborators();
      setEmail("");
      setRole("editor");
    }
  }, [isOpen, loadCollaborators]);

  if (!isOpen || !tripId) return null;

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter a valid email or username.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/trips/${tripId}/collaborators`, {
        email: email.trim(),
        role: role,
      });
      toast.success(`Collaborator added as ${role}!`);
      setEmail("");
      await loadCollaborators();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not invite collaborator.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (collabId) => {
    setDeletingId(collabId);
    try {
      await api.delete(`/trips/${tripId}/collaborators/${collabId}`);
      toast.success("Collaborator removed.");
      await loadCollaborators();
    } catch {
      toast.error("Could not remove collaborator.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-3xl border border-border bg-card shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <UsersThree size={22} className="text-primary" weight="bold" />
            <h3 className="text-lg font-bold">Trip Collaborators</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Invite Form (only owner can invite) */}
          {data.is_owner ? (
            <form onSubmit={handleInvite} className="p-4 rounded-2xl border border-border bg-muted/30 space-y-3">
              <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <UserPlus size={15} weight="bold" /> Invite Friends to Plan Together
              </p>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <EnvelopeSimple size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Friend's email or username"
                    required
                    className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold outline-none"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {submitting ? <CircleNotch size={14} className="animate-spin" /> : <UserPlus size={14} weight="bold" />}
                  Invite
                </button>
              </div>
            </form>
          ) : (
            <div className="p-3 rounded-xl bg-muted text-xs text-muted-foreground">
              You are viewing this trip as a collaborator. Only the owner can invite new members.
            </div>
          )}

          {/* Members List */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Trip Members</h4>
            
            {loading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground gap-2 text-sm">
                <CircleNotch size={16} className="animate-spin" /> Loading members…
              </div>
            ) : (
              <div className="space-y-2">
                {/* Trip Owner */}
                {data.owner && (
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-card border border-border">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={data.owner.photo_url} />
                        <AvatarFallback>{data.owner.name?.[0] || "O"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-sm leading-tight flex items-center gap-1.5">
                          {data.owner.name}
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600">Owner</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{data.owner.email}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Collaborators */}
                {data.collaborators.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-2xl bg-card border border-border">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={c.photo_url} />
                        <AvatarFallback>{c.name?.[0] || "C"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-sm leading-tight flex items-center gap-1.5">
                          {c.name}
                          <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                            c.role === "editor" ? "bg-blue-500/10 text-blue-600" : "bg-muted text-muted-foreground"
                          }`}>
                            {c.role === "editor" ? "Can Edit" : "Can View"}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </div>
                    </div>

                    {data.is_owner && (
                      <button
                        onClick={() => handleRemove(c.id)}
                        disabled={deletingId === c.id}
                        className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg transition-colors"
                        title="Remove collaborator"
                      >
                        {deletingId === c.id ? <CircleNotch size={16} className="animate-spin" /> : <Trash size={16} />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
