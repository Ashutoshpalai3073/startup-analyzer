import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWindowWidth } from "../useWindowWidth";
import { useAuth } from "../context/AuthContext";

export default function AuthModal({ idea, initialMode = "signup", onClose }) {
  const width    = useWindowWidth();
  const isMobile = width < 640;
  const { signup, login, verifyOTP, loginWithGoogle } = useAuth();

  const [mode, setMode]             = useState(initialMode); // "signup" | "login"
  const [step, setStep]             = useState("form");       // "form"   | "otp"
  const [email, setEmail]           = useState("");
  const [name, setName]             = useState("");
  const [otp, setOtp]               = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false); // Case A — 409

  const switchMode = (m) => {
    setMode(m); setStep("form"); setError(""); setOtp(""); setAlreadyRegistered(false);
  };

  const handleForm = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setAlreadyRegistered(false);
    try {
      await (mode === "signup" ? signup(email, name) : login(email));
      setStep("otp");
    } catch (err) {
      if (err.status === 409) {
        // Case A: exact email+name pair already registered — show "Log In" redirect
        setAlreadyRegistered(true);
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await verifyOTP(email, otp);
      // isAuthenticated becomes true → App.jsx useEffect auto-triggers analysis
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const input = {
    width: "100%", background: "rgba(30,41,59,0.6)",
    border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10,
    padding: "0.8rem 1rem", color: "#f1f5f9", fontSize: "0.95rem",
    outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
  };

  const submitLabel = () => {
    if (loading) return mode === "signup" ? "Sending code…" : "Sending OTP…";
    if (mode === "signup") return idea ? "Get My Analysis →" : "Create Account →";
    return idea ? "Log In & Analyze →" : "Log In →";
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{    scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 22, stiffness: 300 }}
        style={{
          position: "relative", width: "100%", maxWidth: 420,
          background: "rgba(8,8,28,0.98)",
          border: "1px solid rgba(99,102,241,0.25)", borderRadius: 20,
          padding: isMobile ? "1.75rem 1.25rem" : "2.25rem",
          boxShadow: "0 40px 100px rgba(0,0,0,0.7), 0 0 60px rgba(99,102,241,0.08)",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", fontWeight: 900, color: "#fff" }}>✦</div>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.02em" }}>Drusti</span>
        </div>

        {/* Idea preview */}
        {idea && (
          <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.18)", borderRadius: 10, padding: "0.65rem 0.9rem", marginBottom: "1.25rem", display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
            <span style={{ color: "#6366f1", fontSize: "0.9rem", flexShrink: 0 }}>✦</span>
            <p style={{ color: "#94a3b8", fontSize: "0.8rem", margin: 0, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{idea}</p>
          </div>
        )}

        {/* Mode tabs */}
        <div style={{ display: "flex", gap: "0.5rem", background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "0.3rem", marginBottom: "1.5rem" }}>
          {["signup", "login"].map(m => (
            <button key={m} onClick={() => switchMode(m)} style={{
              flex: 1, padding: "0.5rem", border: "none", borderRadius: 8,
              background: mode === m ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "transparent",
              color: mode === m ? "#fff" : "#4b5563",
              fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", transition: "all 0.2s",
            }}>
              {m === "signup" ? "Sign Up" : "Log In"}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === "form" ? (
            <motion.form key="form" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }} onSubmit={handleForm} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div>
                <h2 style={{ color: "#f1f5f9", fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.25rem", letterSpacing: "-0.01em" }}>
                  {mode === "signup" ? "Create your free account" : "Welcome back"}
                </h2>
                <p style={{ color: "#4b5563", fontSize: "0.82rem", margin: 0 }}>
                  {mode === "signup"
                    ? (idea ? "Sign up to unlock your full analysis" : "Join Drusti — it's free")
                    : (idea ? "Log in to continue to your analysis" : "Log in to your account")}
                </p>
              </div>

              {error && (
                <div style={{ background: alreadyRegistered ? "rgba(99,102,241,0.08)" : "rgba(239,68,68,0.1)", border: `1px solid ${alreadyRegistered ? "rgba(99,102,241,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 8, padding: "0.65rem 0.9rem", fontSize: "0.82rem" }}>
                  <div style={{ color: alreadyRegistered ? "#a5b4fc" : "#fca5a5", marginBottom: alreadyRegistered ? "0.5rem" : 0 }}>{error}</div>
                  {alreadyRegistered && (
                    <button type="button" onClick={() => switchMode("login")} style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 6, padding: "0.4rem 0.9rem", color: "#fff", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>
                      Log In →
                    </button>
                  )}
                </div>
              )}

              {mode === "signup" && (
                <input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} style={input} required />
              )}
              <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} style={input} required />

              <button type="submit" disabled={loading} style={{
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                border: "none", borderRadius: 10, padding: "0.85rem",
                color: "#fff", fontWeight: 700, fontSize: "0.95rem",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                boxShadow: "0 4px 20px rgba(99,102,241,0.35)",
              }}>
                {submitLabel()}
              </button>

              <div style={{ textAlign: "center", color: "#374151", fontSize: "0.78rem", margin: "0.1rem 0" }}>
                ──── or ────
              </div>

              <button
                type="button"
                onClick={loginWithGoogle}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.6rem",
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "0.75rem 1rem",
                  cursor: "pointer",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  color: "#1e293b",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                  <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.86v2.07A8 8 0 0 0 8.98 17z"/>
                  <path fill="#FBBC05" d="M4.51 10.52A4.8 4.8 0 0 1 4.26 9c0-.52.09-1.02.25-1.52V5.41H1.86A8 8 0 0 0 .98 9c0 1.29.31 2.51.88 3.59l2.65-2.07z"/>
                  <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 8.98 1a8 8 0 0 0-7.12 4.41l2.65 2.07c.63-1.89 2.39-3.3 4.47-3.3z"/>
                </svg>
                Continue with Google
              </button>
            </motion.form>
          ) : (
            <motion.form key="otp" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }} onSubmit={handleOTP} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div>
                <h2 style={{ color: "#f1f5f9", fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Check your inbox</h2>
                <p style={{ color: "#4b5563", fontSize: "0.82rem", margin: 0 }}>
                  We sent a 6-digit code to <span style={{ color: "#94a3b8" }}>{email}</span>
                </p>
              </div>

              {error && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "0.65rem 0.9rem", color: "#fca5a5", fontSize: "0.82rem" }}>
                  {error}
                </div>
              )}

              <input
                type="text" inputMode="numeric" placeholder="_ _ _ _ _ _"
                value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                style={{ ...input, fontSize: "1.6rem", letterSpacing: "0.35em", textAlign: "center" }}
                autoFocus required
              />

              <button type="submit" disabled={loading || otp.length !== 6} style={{
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                border: "none", borderRadius: 10, padding: "0.85rem",
                color: "#fff", fontWeight: 700, fontSize: "0.95rem",
                cursor: (loading || otp.length !== 6) ? "not-allowed" : "pointer",
                opacity: (loading || otp.length !== 6) ? 0.7 : 1,
                boxShadow: "0 4px 20px rgba(99,102,241,0.35)",
              }}>
                {loading ? "Verifying…" : "Verify & Continue →"}
              </button>

              <button type="button" onClick={() => { setStep("form"); setOtp(""); setError(""); }} style={{ background: "none", border: "none", color: "#4b5563", fontSize: "0.8rem", cursor: "pointer", textAlign: "center" }}>
                ← Change email
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Close button */}
        <button onClick={onClose} style={{ position: "absolute", top: "1rem", right: "1rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "50%", width: 28, height: 28, color: "#4b5563", cursor: "pointer", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
          ×
        </button>
      </motion.div>
    </motion.div>
  );
}
