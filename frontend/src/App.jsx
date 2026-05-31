import { useState, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import LandingPage   from "./components/LandingPage";
import LoadingScreen from "./components/LoadingScreen";
import Dashboard     from "./components/Dashboard";
import AuthModal     from "./components/AuthModal";
import { AuthProvider, useAuth } from "./context/AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

function AppContent() {
  const [stage, setStage]           = useState("landing");
  const [analysis, setAnalysis]     = useState(null);
  const [idea, setIdea]             = useState("");
  const [error, setError]           = useState("");
  const [pendingIdea, setPendingIdea]     = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState("signup"); // "signup"|"login"

  const { isAuthenticated, loading: authLoading, token } = useAuth();

  // ── After login: always close the modal, then start analysis if pending ──
  useEffect(() => {
    if (isAuthenticated) {
      setShowAuthModal(false);        // close modal regardless (navbar sign-up or generate flow)
      if (pendingIdea) {
        const toAnalyze = pendingIdea;
        setPendingIdea("");
        runAnalysis(toAnalyze);
      }
    }
  }, [isAuthenticated]);

  // ── If user logs out while on dashboard → return to landing ────────
  useEffect(() => {
    if (!isAuthenticated && !authLoading && stage === "dashboard") {
      setStage("landing");
      setAnalysis(null);
    }
  }, [isAuthenticated, authLoading]);

  // ── Push a history entry for every non-landing stage so the browser back
  //    button fires popstate (→ landing) instead of leaving the React app ──
  useEffect(() => {
    if (stage === "loading" || stage === "dashboard") {
      window.history.pushState({ stage }, "");
    }
  }, [stage]);

  useEffect(() => {
    const handlePop = () => { setStage("landing"); setAnalysis(null); };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  // ── Core analysis runner ─────────────────────────────────────────────
  const runAnalysis = async (startupIdea) => {
    setIdea(startupIdea);
    setStage("loading");
    setError("");
    try {
      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), 600000);
      // Always read token fresh from storage to avoid stale closure
      const authToken  = localStorage.getItem("auth_token") || token;

      const res = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({ startup_idea: startupIdea }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Analysis failed");
      }
      const data = await res.json();
      setAnalysis(data);
      setStage("dashboard");
    } catch (e) {
      setError(
        e.name === "AbortError"
          ? "Analysis timed out. Please try again."
          : e.message || "Analysis failed. Please try again."
      );
      setStage("landing");
    }
  };

  // ── Called by LandingPage when user clicks Generate ─────────────────
  const handleAnalyze = (startupIdea) => {
    if (!isAuthenticated) {
      setPendingIdea(startupIdea);
      setAuthInitialMode("signup");   // unauthenticated user hits Generate → show Sign Up tab first
      setShowAuthModal(true);
      return;
    }
    runAnalysis(startupIdea);
  };

  // ── Called by navbar Sign In / Sign Up buttons ───────────────────────
  const handleOpenAuth = (mode = "signup") => {
    setAuthInitialMode(mode);
    setPendingIdea("");
    setShowAuthModal(true);
  };

  // ── Pitch deck download ───────────────────────────────────────────────
  const handleDownload = async (brandName) => {
    try {
      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), 60000);
      const res = await fetch(`${API_URL}/download-pitch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, brand_name: brandName }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${brandName.replace(/ /g, "_")}_pitch_deck.pptx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.name === "AbortError" ? "Download timed out." : "Download failed: " + e.message);
    }
  };

  if (authLoading) {
    return (
      <div style={{
        minHeight: "100vh", background: "#050510",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ color: "#374151", fontSize: "0.9rem" }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", minHeight: "100vh", background: "#050510" }}>

      {/* ── Main stages ─────────────────────────────────────────────── */}
      {stage === "landing" && (
        <LandingPage onAnalyze={handleAnalyze} error={error} onOpenAuth={handleOpenAuth} />
      )}
      {stage === "loading" && (
        <LoadingScreen
          idea={idea}
          onCancel={() => { setStage("landing"); setError(""); }}
        />
      )}
      {stage === "dashboard" && (
        <Dashboard
          analysis={analysis}
          onDownload={handleDownload}
          onReset={() => { setStage("landing"); setAnalysis(null); }}
        />
      )}

      {/* ── Auth modal — slides up when unauthenticated user hits Generate */}
      <AnimatePresence>
        {showAuthModal && (
          <AuthModal
            idea={pendingIdea}
            initialMode={authInitialMode}
            onClose={() => { setShowAuthModal(false); setPendingIdea(""); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
