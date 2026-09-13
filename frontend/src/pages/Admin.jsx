import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { AnimatedCounter } from "@/components/Widgets";
import { UsersThree, MapPinLine, Sparkle, ChartLineUp, Trash, User, City, Buildings } from "@phosphor-icons/react";

const COLORS = ["hsl(14,72%,53%)", "hsl(152,34%,32%)", "hsl(38,68%,50%)", "hsl(20,50%,45%)", "hsl(90,28%,42%)"];

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [cities, setCities] = useState([]);
  const [activities, setActivities] = useState([]);

  const loadUsers = () => api.get("/admin/users").then((r) => setUsers(r.data)).catch(() => {});
  useEffect(() => {
    api.get("/admin/stats").then((r) => setStats(r.data)).catch(() => {});
    loadUsers();
    api.get("/admin/popular-cities").then((r) => setCities(r.data)).catch(() => {});
    api.get("/admin/popular-activities").then((r) => setActivities(r.data)).catch(() => {});
  }, []);

  const delUser = async (uid) => {
    try { await api.delete(`/admin/users/${uid}`); toast.success("User removed"); loadUsers(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Could not delete"); }
  };

  const kpis = stats ? [
    { label: "Users", value: stats.users, icon: UsersThree },
    { label: "Trips", value: stats.trips, icon: MapPinLine },
    { label: "Activities", value: stats.places, icon: Sparkle },
    { label: "Stories", value: stats.posts, icon: ChartLineUp },
  ] : [];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <p className="overline text-primary mb-1">Control room</p>
      <h1 className="font-display font-black text-4xl tracking-tighter mb-8">Admin Panel</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-card p-5" data-testid={`kpi-${k.label.toLowerCase()}`}>
            <k.icon size={22} weight="bold" className="text-primary mb-2" />
            <AnimatedCounter value={k.value} className="font-display font-black text-3xl tracking-tighter block" />
            <p className="text-sm text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="users">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="users" data-testid="tab-users">Manage Users</TabsTrigger>
          <TabsTrigger value="cities" data-testid="tab-cities">Popular Cities</TabsTrigger>
          <TabsTrigger value="activities" data-testid="tab-activities">Popular Activities</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">User Trends & Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <div className="rounded-2xl border border-border bg-card overflow-hidden" data-testid="admin-users-table">
            {users.map((u) => (
              <div key={u.user_id} className="flex items-center gap-3 p-3 border-b border-border last:border-0">
                <Avatar className="h-10 w-10"><AvatarImage src={u.photo_url} /><AvatarFallback><User size={16} /></AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm line-clamp-1">{u.name || u.email} {u.is_admin && <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">admin</span>}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{u.email} · {u.city}, {u.country}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{u.trip_count} trips</span>
                {!u.is_admin && (
                  <button data-testid={`del-user-${u.user_id}`} onClick={() => delUser(u.user_id)}
                    className="rounded-full p-2 text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"><Trash size={16} /></button>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="cities" className="mt-6">
          <div className="rounded-2xl border border-border bg-card p-6" data-testid="popular-cities">
            <h3 className="font-display font-bold tracking-tight mb-4 flex items-center gap-2"><City size={20} weight="bold" className="text-primary" /> Where travelers are actually going</h3>
            {cities.length === 0 ? <p className="text-sm text-muted-foreground">No destination data yet.</p> : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={cities} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="city" width={110} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                    {cities.map((c, i) => <Cell key={c.city} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activities" className="mt-6">
          <div className="rounded-2xl border border-border bg-card p-6" data-testid="popular-activities">
            <h3 className="font-display font-bold tracking-tight mb-4 flex items-center gap-2"><Buildings size={20} weight="bold" className="text-primary" /> Most-added places & activities</h3>
            {activities.length === 0 ? <p className="text-sm text-muted-foreground">No activities selected yet.</p> : (
              <div className="space-y-2">
                  {activities.map((a, i) => (
                  <div key={a.name} className="flex items-center gap-3">
                    <span className="w-6 text-sm font-bold text-muted-foreground">{i + 1}</span>
                    <div className="flex-1"><p className="font-semibold text-sm">{a.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{a.category}</p></div>
                    <span className="rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">{a.count}×</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="trends" className="mt-6 grid lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-border bg-card p-6" data-testid="trend-line">
            <h3 className="font-display font-bold tracking-tight mb-4">Trips created over time</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="trips" stroke="hsl(14,72%,53%)" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6" data-testid="trend-pie">
            <h3 className="font-display font-bold tracking-tight mb-4">Budget distribution</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={stats?.budget_dist || []} dataKey="value" nameKey="name" outerRadius={90} label>
                  {(stats?.budget_dist || []).map((d, i) => <Cell key={d.name} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
