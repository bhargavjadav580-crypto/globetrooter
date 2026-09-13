import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Compass, MapTrifold, CalendarBlank, UsersThree, MagnifyingGlass, ShieldStar, SignOut, User, BookmarkSimple, MoonStars, Sparkle } from "@phosphor-icons/react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const links = [
  { to: "/dashboard", label: "Explore", icon: Compass },
  { to: "/trips", label: "My Trips", icon: MapTrifold },
  { to: "/templates", label: "Templates", icon: BookmarkSimple },
  { to: "/search", label: "Discover", icon: MagnifyingGlass },
  { to: "/calendar", label: "Calendar", icon: CalendarBlank },
  { to: "/community", label: "Community", icon: UsersThree },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains("dark") ||
      localStorage.getItem("gt_theme") === "dark";
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("gt_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("gt_theme", "light");
    }
  }, [isDark]);

  return (
    <header className="sticky top-0 z-[900] glass border-b border-border transition-colors duration-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-3">
        <button data-testid="nav-logo" onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 mr-2 shrink-0 group">
          <Compass size={28} weight="fill" className="text-primary group-hover:rotate-45 transition-transform duration-500" />
          <span className="font-display font-extrabold text-lg tracking-tight hidden sm:block">GlobeTrotter</span>
        </button>
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} data-testid={`nav-${l.label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                  isActive ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25" : "text-muted-foreground hover:text-foreground hover:bg-accent/70"
                }`}>
              <l.icon size={18} weight="bold" />
              <span className="hidden md:inline">{l.label}</span>
            </NavLink>
          ))}
          {user?.is_admin && (
            <NavLink to="/admin" data-testid="nav-admin"
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                  isActive ? "bg-secondary text-secondary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent/70"
                }`}>
              <ShieldStar size={18} weight="bold" />
              <span className="hidden md:inline">Admin</span>
            </NavLink>
          )}
        </nav>

        {/* Theme Toggle Button */}
        <button
          data-testid="theme-toggle"
          onClick={() => setIsDark((prev) => !prev)}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="shrink-0 rounded-full p-2 text-muted-foreground hover:text-primary hover:bg-accent/80 transition-all duration-200"
        >
          {isDark ? (
            <Sparkle size={20} weight="fill" className="text-amber-400 rotate-12 transition-transform" />
          ) : (
            <MoonStars size={20} weight="bold" className="hover:-rotate-12 transition-transform" />
          )}
        </button>

        <button data-testid="nav-profile" onClick={() => navigate("/profile")}
          className="shrink-0 rounded-full ring-2 ring-transparent hover:ring-primary/80 transition-all">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.photo_url} alt={user?.name} />
            <AvatarFallback><User size={18} /></AvatarFallback>
          </Avatar>
        </button>
        <button data-testid="nav-logout" onClick={logout}
          title="Sign out"
          className="shrink-0 rounded-full p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
          <SignOut size={20} weight="bold" />
        </button>
      </div>
    </header>
  );
}
