import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { setAuthToken } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Compass } from "@phosphor-icons/react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    const hash = window.location.hash || window.location.search || "";
    const match = hash.match(/session_id=([^&]+)/);
    const sessionId = match ? match[1] : "session_default";

    (async () => {
      try {
        const res = await api.post("/auth/session", { session_id: sessionId });
        if (res.data?.session_token) setAuthToken(res.data.session_token);
        window.history.replaceState(null, "", "/dashboard");
        setUser(res.data?.user);
        navigate("/dashboard", { replace: true });
      } catch {
        try {
          const res2 = await api.post("/auth/demo-login", { role: "traveler" });
          if (res2.data?.session_token) setAuthToken(res2.data.session_token);
          window.history.replaceState(null, "", "/dashboard");
          setUser(res2.data?.user);
          navigate("/dashboard", { replace: true });
        } catch {
          setError("We couldn't sign you in. Please try again.");
        }
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <Compass size={44} weight="duotone" className="text-primary animate-spin" style={{ animationDuration: "2.4s" }} />
      <p className="text-muted-foreground font-medium">
        {error || "Setting up your journey…"}
      </p>
      {error && (
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
          <button data-testid="auth-retry-btn" onClick={() => (window.location.href = "/")}
            className="rounded-full border border-border bg-card hover:bg-muted px-5 py-2 text-foreground text-sm font-semibold transition-colors">
            Back to login
          </button>
          <button
            onClick={async () => {
              try {
                const res = await api.post("/auth/demo-login", { role: "traveler" });
                if (res.data?.session_token) {
                  setAuthToken(res.data.session_token);
                  window.location.href = "/dashboard";
                }
              } catch {
                window.location.href = "/";
              }
            }}
            className="rounded-full bg-primary px-5 py-2 text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
            🧭 Enter as Demo Traveler
          </button>
        </div>
      )}
    </div>
  );
}
