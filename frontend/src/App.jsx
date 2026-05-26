import { useState, useEffect } from "react";
import LandingPage from "./components/LandingPage";
import LoadingScreen from "./components/LoadingScreen";
import Dashboard from "./components/Dashboard";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function App() {
  const [stage, setStage] = useState("landing");
  const [analysis, setAnalysis] = useState(null);
  const [idea, setIdea]         = useState("");
  const [error, setError]       = useState("");

  // ── Push a history entry when entering dashboard so the mobile
  //    hardware back button pops it instead of closing the app ──────────────
  useEffect(() => {
    if (stage === "dashboard") {
      window.history.pushState({ stage: "dashboard" }, "");
    }
  }, [stage]);

  useEffect(() => {
    const handlePop = () => {
      // User pressed the hardware/browser back button
      setStage("landing");
      setAnalysis(null);
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const handleAnalyze = async (startupIdea) => {
    setIdea(startupIdea);
    setStage("loading");
    setError("");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 600000);

      const res = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      if (e.name === "AbortError") {
        setError("Analysis timed out. Please try again.");
      } else {
        setError("Fetch failed. Check your connection and try again.");
      }
      setStage("landing");
    }
  };

  const handleDownload = async (brandName) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

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
      if (e.name === "AbortError") {
        alert("Download timed out. Please try again.");
      } else {
        alert("Download failed: " + e.message);
      }
    }
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", minHeight: "100vh", background: "#050510" }}>
      {stage === "landing"   && <LandingPage onAnalyze={handleAnalyze} error={error} />}
      {stage === "loading" && (
  <LoadingScreen idea={idea} />
)}
      {stage === "dashboard" && (
        <Dashboard analysis={analysis} onDownload={handleDownload} onReset={() => setStage("landing")} />
      )}
    </div>
  );
}