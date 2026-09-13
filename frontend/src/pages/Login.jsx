import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api, { setAuthToken } from "@/lib/api";
import { motion } from "framer-motion";
import { Compass, GoogleLogo, MapTrifold, ChartLineUp, Wallet } from "@phosphor-icons/react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  const signIn = () => {
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const features = [
    { icon: MapTrifold, t: "Live distances", d: "Real leg-by-leg driving distance & time." },
    { icon: Wallet, t: "Budget Guardian", d: "Know if your trip actually adds up." },
    { icon: ChartLineUp, t: "Trip Score", d: "See how balanced & realistic your plan is." },
  ];

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left brand / hero */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden">
        <img src="https://images.pexels.com/photos/7368308/pexels-photo-7368308.jpeg"
          alt="Travel planning" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-secondary/70" />
        <div className="relative z-10 flex items-center gap-2 text-white">
          <Compass size={30} weight="fill" />
          <span className="font-display font-extrabold text-xl tracking-tight">GlobeTrotter</span>
        </div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="relative z-10 text-white max-w-md">
          <p className="overline text-white/70 mb-3">Plan · Understand · Optimize</p>
          <h1 className="font-display font-black text-5xl leading-[0.98] tracking-tighter mb-4">
            Plan the trip.<br />Understand the trip.
          </h1>
          <p className="text-white/85 text-lg">
            The travel planner that tells you whether your trip is affordable, realistic and geographically sensible — using live real-world data.
          </p>
        </motion.div>
        <div className="relative z-10" />
      </div>

      {/* Right auth */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Compass size={28} weight="fill" className="text-primary" />
            <span className="font-display font-extrabold text-xl tracking-tight">GlobeTrotter</span>
          </div>
          <p className="overline text-primary mb-2">Welcome aboard</p>
          <h2 className="font-display font-black text-4xl tracking-tighter mb-2">Sign in to start planning</h2>
          <p className="text-muted-foreground mb-8">Continue with Google — we'll set up your traveler profile in one step.</p>

          <button data-testid="google-login-btn" onClick={signIn}
            className="w-full flex items-center justify-center gap-3 rounded-full bg-foreground text-background px-6 py-3.5 font-semibold hover:opacity-90 transition-opacity active:scale-[0.99]">
            <GoogleLogo size={22} weight="bold" /> Continue with Google
          </button>

          <div className="relative my-6 text-center text-xs text-muted-foreground after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
            <span className="relative z-10 bg-background px-3 font-medium">Or quick demo access</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              data-testid="demo-traveler-btn"
              onClick={async () => {
                try {
                  const res = await api.post("/auth/demo-login", { role: "traveler" });
                  if (res.data?.session_token) {
                    setAuthToken(res.data.session_token);
                    window.location.href = "/dashboard";
                  }
                } catch { /* silent — user stays on login page */ }
              }}
              className="w-full text-center rounded-xl border border-border bg-card py-2.5 px-3 text-xs font-semibold hover:bg-muted transition-colors"
            >
              🧭 Demo Traveler
            </button>
            <button
              data-testid="demo-admin-btn"
              onClick={async () => {
                try {
                  const res = await api.post("/auth/demo-login", { role: "admin" });
                  if (res.data?.session_token) {
                    setAuthToken(res.data.session_token);
                    window.location.href = "/dashboard";
                  }
                } catch { /* silent — user stays on login page */ }
              }}
              className="w-full text-center rounded-xl border border-border bg-card py-2.5 px-3 text-xs font-semibold hover:bg-muted transition-colors"
            >
              🛡️ Demo Admin
            </button>
          </div>

          <div className="grid gap-4 mt-10">
            {features.map((f) => (
              <div key={f.t} className="flex items-start gap-3">
                <div className="rounded-xl bg-accent p-2.5 text-accent-foreground"><f.icon size={20} weight="bold" /></div>
                <div>
                  <p className="font-semibold text-sm">{f.t}</p>
                  <p className="text-muted-foreground text-sm">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
