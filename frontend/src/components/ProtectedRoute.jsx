import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Compass } from "@phosphor-icons/react";

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Compass size={40} weight="duotone" className="text-primary animate-spin" style={{ animationDuration: "2.4s" }} />
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  if (!user.profile_complete && location.pathname !== "/profile-setup") {
    return <Navigate to="/profile-setup" replace />;
  }
  if (requireAdmin && !user.is_admin) return <Navigate to="/dashboard" replace />;
  return children;
}
