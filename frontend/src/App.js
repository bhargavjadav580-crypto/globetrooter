import "@/App.css";
import React from "react";
import { BrowserRouter, Routes, Route, useLocation, Outlet } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AuthCallback from "@/components/AuthCallback";
import Navbar from "@/components/Navbar";

import Login from "@/pages/Login";
import ProfileComplete from "@/pages/ProfileComplete";
import Dashboard from "@/pages/Dashboard";
import CreateTrip from "@/pages/CreateTrip";
import BuildItinerary from "@/pages/BuildItinerary";
import TripListing from "@/pages/TripListing";
import Profile from "@/pages/Profile";
import Search from "@/pages/Search";
import ItineraryView from "@/pages/ItineraryView";
import RoadTrip from "@/pages/RoadTrip";
import FullTripPlan from "@/pages/FullTripPlan";
import Community from "@/pages/Community";
import CalendarView from "@/pages/CalendarView";
import Admin from "@/pages/Admin";
import PublicTrip from "@/pages/PublicTrip";
import Templates from "@/pages/Templates";
import ExpenseTracker from "@/pages/ExpenseTracker";
import TripBrochure from "@/pages/TripBrochure";

function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main><Outlet /></main>
    </div>
  );
}

function Shell() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/t/:slug" element={<PublicTrip />} />
      <Route path="/t/:slug/plan" element={<FullTripPlan shared />} />
      <Route path="/profile-setup" element={<ProtectedRoute><ProfileComplete /></ProtectedRoute>} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/trips" element={<TripListing />} />
        <Route path="/trips/new" element={<CreateTrip />} />
        <Route path="/trips/:id/build" element={<BuildItinerary />} />
        <Route path="/trips/:id/view" element={<ItineraryView />} />
        <Route path="/trips/:id/roadtrip" element={<RoadTrip />} />
        <Route path="/trips/:id/plan" element={<FullTripPlan />} />
        <Route path="/trips/:id/expenses" element={<ExpenseTracker />} />
        <Route path="/trips/:id/brochure" element={<TripBrochure />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/search" element={<Search />} />
        <Route path="/community" element={<Community />} />
        <Route path="/calendar" element={<CalendarView />} />
        <Route path="/templates" element={<Templates />} />
      </Route>
      <Route path="/admin" element={<ProtectedRoute requireAdmin><AppLayout /></ProtectedRoute>}>
        <Route index element={<Admin />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Shell />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
