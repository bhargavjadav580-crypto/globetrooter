import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { API } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash, CircleNotch, Wallet, Receipt,
  ArrowsLeftRight, CurrencyInr, ChartBar, Image as ImageIcon, ArrowUpRight,
  User, Check, UsersThree, FilePdf, Printer, DownloadSimple, FileCsv,
} from "@phosphor-icons/react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import ImageUploader from "@/components/ImageUploader";
import TripSubNav from "@/components/TripSubNav";

const CATEGORIES = ["food", "transport", "stay", "activity", "shopping", "general"];
const CAT_COLOR = {
  food: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  transport: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  stay: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  activity: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  shopping: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  general: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};
const CHART_COLORS = {
  food: "#f97316",
  transport: "#3b82f6",
  stay: "#a855f7",
  activity: "#22c55e",
  shopping: "#ec4899",
  general: "#6b7280",
};

export default function ExpenseTracker() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  const [travelers, setTravelers] = useState(["You", "Traveler 2"]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [newTravelerName, setNewTravelerName] = useState("");

  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: "general",
    paid_by: "You",
    split_among: ["You", "Traveler 2"],
    receipt_url: "",
  });

  const load = useCallback(async () => {
    try {
      const [tripR, expR, sumR, colR] = await Promise.all([
        api.get(`/trips/${id}`),
        api.get(`/trips/${id}/expenses`),
        api.get(`/trips/${id}/expenses/summary`),
        api.get(`/trips/${id}/collaborators`).catch(() => ({ data: { collaborators: [], owner: {} } })),
      ]);
      setTrip(tripR.data);
      setExpenses(expR.data);
      setSummary(sumR.data);
      setCollaborators(colR.data.collaborators || []);

      // Extract unique traveler names from owner, collaborators, and past expenses
      const ownerName = colR.data.owner?.name || "You";
      const memberNames = (colR.data.collaborators || []).map((c) => c.name);
      const pastPayers = (expR.data || []).map((e) => e.paid_by);
      const pastSplitters = (expR.data || []).flatMap((e) => e.split_among || []);
      const uniqueNames = Array.from(new Set([ownerName, ...memberNames, ...pastPayers, ...pastSplitters])).filter(Boolean);
      const finalTravelers = uniqueNames.length > 0 ? uniqueNames : ["You", "Traveler 2"];
      setTravelers(finalTravelers);
      setForm((prev) => ({
        ...prev,
        paid_by: finalTravelers[0] || "You",
        split_among: finalTravelers,
      }));
    } catch {
      toast.error("Could not load expense data.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const toggleSplitter = (person) => {
    setForm((prev) => {
      const current = prev.split_among || [];
      const updated = current.includes(person)
        ? current.filter((p) => p !== person)
        : [...current, person];
      return { ...prev, split_among: updated.length > 0 ? updated : [person] };
    });
  };

  const selectAllSplitters = () => {
    setForm((prev) => ({ ...prev, split_among: [...travelers] }));
  };

  const addCustomTraveler = (e) => {
    e.preventDefault();
    if (!newTravelerName.trim()) return;
    const name = newTravelerName.trim();
    if (!travelers.includes(name)) {
      setTravelers((prev) => [...prev, name]);
      setForm((prev) => ({ ...prev, split_among: [...prev.split_among, name] }));
    }
    setNewTravelerName("");
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.description.trim() || !form.amount || Number(form.amount) <= 0) {
      toast.error("Please enter a valid description and amount.");
      return;
    }
    setAdding(true);
    try {
      const payload = {
        description: form.description.trim(),
        amount: parseFloat(form.amount),
        category: form.category,
        paid_by: form.paid_by || travelers[0] || "You",
        split_among: form.split_among?.length > 0 ? form.split_among : travelers,
        receipt_url: form.receipt_url || null,
      };
      await api.post(`/trips/${id}/expenses`, payload);
      toast.success("Expense logged!");
      setForm({
        description: "",
        amount: "",
        category: "general",
        paid_by: travelers[0] || "You",
        split_among: [...travelers],
        receipt_url: "",
      });
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not add expense.");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (expId) => {
    setDeleting(expId);
    try {
      await api.delete(`/trips/${id}/expenses/${expId}`);
      toast.success("Expense removed.");
      await load();
    } catch {
      toast.error("Could not delete expense.");
    } finally {
      setDeleting(null);
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    if (expenses.length === 0) {
      toast.info("No expenses to export yet.");
      return;
    }
    const headers = ["Date", "Description", "Category", "Paid By", "Split Among", "Total Amount", "Per Person"];
    const rows = expenses.map((e) => [
      `"${e.created_at ? new Date(e.created_at).toLocaleDateString("en-IN") : ""}"`,
      `"${(e.description || "").replace(/"/g, '""')}"`,
      `"${e.category || "general"}"`,
      `"${e.paid_by || ""}"`,
      `"${(e.split_among || []).join("; ")}"`,
      Number(e.amount || 0).toFixed(2),
      Number(e.per_person || 0).toFixed(2),
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${(trip?.name || "trip").replace(/\s+/g, "_")}_expense_split.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Expense split CSV downloaded!");
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 space-y-5" data-testid="expenses-skeleton">
        <div className="h-8 w-52 rounded-2xl bg-muted animate-pulse" />
        <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
          <div className="h-5 w-36 rounded-xl bg-muted animate-pulse" />
          <div className="h-4 w-full rounded-full bg-muted animate-pulse" />
          <div className="flex gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-6 w-20 rounded-lg bg-muted animate-pulse" />)}
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 h-48 animate-pulse bg-muted" />
        <div className="rounded-3xl border border-border bg-card p-6 space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  const planned = trip?.total_budget || 0;
  const actual = summary?.total_spent || 0;
  const diff = planned - actual;
  const pct = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0;
  const sym = trip?.currency_symbol || "₹";

  return (
    <div className="pb-16 print-area">
      {/* Persistent Trip Navigation Tab Bar */}
      <TripSubNav trip={trip} onTripUpdated={load} />

      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 space-y-6">
        {/* Print Only Header */}
        <div className="hidden print:block border-b border-gray-300 pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black">{trip?.name || "Trip"} — Expense & Split Report</h1>
              <p className="text-sm text-gray-600">
                {trip?.starting_point} ➔ {trip?.destination} {trip?.start_date ? `· ${trip.start_date}` : ""}
              </p>
            </div>
            <div className="text-right text-xs text-gray-500">
              <p className="font-bold text-sm text-gray-800">GlobeTrotter</p>
              <p>Generated: {new Date().toLocaleDateString("en-IN")}</p>
            </div>
          </div>
        </div>

        {/* Budget gauge */}
        <div className="rounded-3xl border border-border bg-card p-6 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold flex items-center gap-2"><ChartBar size={18} className="text-primary" /> Budget Overview</span>
            <span className={`text-sm font-bold ${diff < 0 ? "text-destructive" : "text-green-600"}`}>
              {diff < 0 ? `${sym}${Math.abs(diff).toLocaleString("en-IN")} over` : `${sym}${diff.toLocaleString("en-IN")} remaining`}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${diff < 0 ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Spent: <strong className="text-foreground">{sym}{actual.toLocaleString("en-IN")}</strong></span>
            <span>Planned: <strong className="text-foreground">{sym}{planned.toLocaleString("en-IN")}</strong></span>
          </div>
          {/* By category */}
          {summary?.by_category && Object.keys(summary.by_category).length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {Object.entries(summary.by_category).map(([cat, amt]) => (
                <span key={cat} className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${CAT_COLOR[cat] || CAT_COLOR.general}`}>
                  {cat.toUpperCase()}: {sym}{amt.toLocaleString("en-IN")}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Expense Donut Chart — only when there is spending data */}
        {summary?.by_category && Object.keys(summary.by_category).length > 0 && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-xs">
            <h2 className="font-semibold flex items-center gap-2 text-foreground mb-4">
              <ChartBar size={18} className="text-primary" /> Spending Breakdown
            </h2>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Donut chart */}
              <div className="w-full sm:w-64 h-56 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(summary.by_category).map(([cat, amt]) => ({
                        name: cat.charAt(0).toUpperCase() + cat.slice(1),
                        value: amt,
                        cat,
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {Object.entries(summary.by_category).map(([cat]) => (
                        <Cell key={cat} fill={CHART_COLORS[cat] || CHART_COLORS.general} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${sym}${Number(value).toLocaleString("en-IN")}`, name]}
                      contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend pills */}
              <div className="flex-1 grid grid-cols-2 gap-2">
                {Object.entries(summary.by_category).map(([cat, amt]) => {
                  const pctOfTotal = actual > 0 ? Math.round((amt / actual) * 100) : 0;
                  return (
                    <div key={cat} className="flex items-center gap-2.5 rounded-2xl border border-border p-3">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ background: CHART_COLORS[cat] || CHART_COLORS.general }} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold capitalize truncate">{cat}</p>
                        <p className="text-[11px] text-muted-foreground">{sym}{Number(amt).toLocaleString("en-IN")} · {pctOfTotal}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Bill split / settlements */}
        {summary?.settlements?.length > 0 && (
          <div className="rounded-3xl border border-border bg-card p-6 space-y-3 shadow-xs">
            <h2 className="font-semibold flex items-center gap-2 text-foreground">
              <ArrowsLeftRight size={18} className="text-primary" /> Bill Split Settlements
            </h2>
            <div className="space-y-2">
              {summary.settlements.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-2xl bg-muted/40 p-3 text-sm">
                  <span>
                    <strong className="text-destructive">{s.from}</strong>
                    {" owes "}
                    <strong className="text-green-600">{s.to}</strong>
                  </span>
                  <span className="font-bold">{sym}{s.amount.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expense list + Action buttons */}
        <div className="rounded-3xl border border-border bg-card p-6 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold flex items-center gap-2 text-foreground">
              <Wallet size={18} className="text-primary" /> Expenses ({expenses.length})
            </h2>

            {/* Quick Action Tools */}
            <div className="flex items-center gap-2 flex-wrap no-print">
              <button
                type="button"
                onClick={handleExportPDF}
                className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 px-3.5 py-2 text-xs font-bold transition-all hover:scale-[1.02]"
                title="Export Expense Split as PDF or Print"
              >
                <FilePdf size={16} weight="bold" />
                <span>Export PDF</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCSV}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background hover:bg-accent px-3.5 py-2 text-xs font-semibold transition-all hover:scale-[1.02]"
                title="Download Expense Ledger as CSV"
              >
                <FileCsv size={16} weight="bold" />
                <span>CSV</span>
              </button>

              <button
                onClick={() => setShowForm((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs font-bold hover:bg-primary/90 transition-colors shadow-xs hover:scale-[1.02]"
              >
                <Plus size={16} weight="bold" />
                Add Expense
              </button>
            </div>
          </div>

          {/* Add form */}
          {showForm && (
            <form onSubmit={handleAdd} className="rounded-2xl border border-border bg-muted/20 p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Description *</label>
                  <input
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="e.g. Seafood Dinner at Seagull Waterfront"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Amount ({sym}) *</label>
                  <input
                    type="number" min="0" step="0.01"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="e.g. 1200"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
                  <select
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Paid By (Interactive Avatar Chips) */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Paid By (Who spent the money?):
                </label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {travelers.map((person) => {
                    const isSelected = form.paid_by === person;
                    return (
                      <button
                        key={person}
                        type="button"
                        onClick={() => setForm({ ...form, paid_by: person })}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-background border border-border text-foreground hover:border-primary/50"
                        }`}
                      >
                        <User size={13} weight="bold" />
                        <span>{person}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Split Among (Interactive Checkboxes + 1-Tap Split All) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Split Among (Who shares this cost?):
                  </label>
                  <button
                    type="button"
                    onClick={selectAllSplitters}
                    className="text-[11px] font-bold text-primary hover:underline"
                  >
                    Split All ({travelers.length})
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {travelers.map((person) => {
                    const isIncluded = form.split_among?.includes(person);
                    return (
                      <button
                        key={person}
                        type="button"
                        onClick={() => toggleSplitter(person)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          isIncluded
                            ? "bg-secondary text-secondary-foreground font-bold shadow-xs border border-secondary"
                            : "bg-background border border-border text-muted-foreground hover:border-border/80"
                        }`}
                      >
                        {isIncluded ? <Check size={12} weight="bold" /> : <Plus size={12} />}
                        <span>{person}</span>
                      </button>
                    );
                  })}

                  {/* Quick Add Friend */}
                  <div className="inline-flex items-center gap-1">
                    <input
                      value={newTravelerName}
                      onChange={(e) => setNewTravelerName(e.target.value)}
                      placeholder="+ Add person"
                      className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
                      onKeyDown={(e) => e.key === "Enter" && addCustomTraveler(e)}
                    />
                    {newTravelerName && (
                      <button
                        type="button"
                        onClick={addCustomTraveler}
                        className="p-1 rounded-md bg-primary text-primary-foreground text-xs"
                      >
                        <Plus size={12} weight="bold" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Receipt Photo Upload */}
              <ImageUploader
                value={form.receipt_url}
                onChange={(url) => setForm({ ...form, receipt_url: url })}
                label="Attach Bill / Receipt Photo (optional)"
                compact
              />

              <div className="flex gap-2 justify-end pt-2 border-t border-border">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={adding}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-xs">
                  {adding && <CircleNotch size={14} className="animate-spin" />}
                  Save Expense
                </button>
              </div>
            </form>
          )}

          {/* List */}
          {expenses.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-2xl">
              No expenses logged yet. Start tracking your road trip spending!
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between rounded-2xl border border-border bg-muted/20 px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{exp.description}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CAT_COLOR[exp.category] || CAT_COLOR.general}`}>
                        {exp.category}
                      </span>
                      {exp.receipt_url && (
                        <a
                          href={exp.receipt_url.startsWith("http") ? exp.receipt_url : `${API.replace(/\/api$/, "")}${exp.receipt_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary/10 text-primary hover:bg-primary/20"
                          title="View receipt"
                        >
                          <ImageIcon size={12} weight="bold" /> Receipt <ArrowUpRight size={10} />
                        </a>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Paid by <strong>{exp.paid_by}</strong> &bull; {sym}{exp.per_person?.toLocaleString("en-IN")}/person
                      {exp.split_among?.length ? ` (${exp.split_among.join(", ")})` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-bold text-sm">
                      {sym}{exp.amount.toLocaleString("en-IN")}
                    </span>
                    <button
                      onClick={() => handleDelete(exp.id)}
                      disabled={deleting === exp.id}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      {deleting === exp.id
                        ? <CircleNotch size={14} className="animate-spin" />
                        : <Trash size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
