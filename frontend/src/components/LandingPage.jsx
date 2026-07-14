import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWindowWidth } from "../useWindowWidth";
import { useAuth } from "../context/AuthContext";

/* ── The 5 analysts — colors mirror the dashboard so the product feels of a piece ── */
const AGENTS = [
  { icon: "▲", name: "Market Research", color: "#6366f1", desc: "TAM, SAM & SOM sizing with CAGR projections grounded in real data." },
  { icon: "◈", name: "Competitive Intel", color: "#8b5cf6", desc: "Your top 5 rivals, their positioning, and the gaps you can own." },
  { icon: "◎", name: "Funding Landscape", color: "#06b6d4", desc: "Active investors, comparable rounds, and where the capital is flowing." },
  { icon: "⬡", name: "SWOT Matrix", color: "#10b981", desc: "Strengths, weaknesses, opportunities and threats — synthesised, not generic." },
  { icon: "→", name: "GTM Strategy", color: "#f59e0b", desc: "A phased go-to-market roadmap from first users to scale." },
];

const EXAMPLES = [
  "AI-powered SaaS for remote team productivity",
  "Blockchain platform for digital identity",
  "Personal finance app for Gen Z",
  "No-code mobile app builder",
];

const STEPS = [
  { n: "01", title: "Describe your idea", desc: "One sentence is enough. The more specific, the sharper the analysis." },
  { n: "02", title: "Five agents go to work", desc: "Market, competitors, funding, SWOT and GTM analysts run in parallel." },
  { n: "03", title: "Get an investor-ready report", desc: "A full dashboard plus a downloadable pitch deck — in minutes, not weeks." },
];

/* ── OPM-inspired "Integrated Divisions": two big cards with a rising glow ── */
const DIVISIONS = [
  {
    tag: "Deep Intelligence", icon: "◎",
    title: "Market & Competitor Research",
    desc: "TAM, SAM and SOM sizing, competitor mapping and the funding landscape — grounded in live web data, not guesswork.",
    cta: "See what's analysed", color: "#6366f1",
  },
  {
    tag: "Execution Ready", icon: "→",
    title: "Strategy & Pitch Output",
    desc: "A SWOT matrix, a phased go-to-market roadmap and an investor-ready pitch deck you can download and present.",
    cta: "See the output", color: "#06b6d4",
  },
];

/* ── OPM-inspired industry ecosystem — [name, accent, starter idea] ── */
const INDUSTRIES = [
  ["SaaS",          "#6366f1", "A SaaS tool that automates workflows for small teams"],
  ["Fintech",       "#8b5cf6", "A fintech app for seamless cross-border payments"],
  ["Healthtech",    "#06b6d4", "A healthtech platform for remote patient monitoring"],
  ["E-commerce",    "#10b981", "An e-commerce brand for sustainable home goods"],
  ["AI / ML",       "#f59e0b", "An AI copilot for legal document review"],
  ["Consumer Apps", "#ec4899", "A consumer app for social fitness challenges"],
  ["EdTech",        "#3b82f6", "An edtech platform for personalized exam prep"],
  ["Climate",       "#22c55e", "A climate startup for automated carbon accounting"],
  ["Marketplaces",  "#a855f7", "A marketplace connecting freelance designers with startups"],
];

/* ── Subtle aurora backdrop — replaces the old particle/cube noise ── */
function Backdrop({ isMobile }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      {/* grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage:
          "linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
        maskImage: "radial-gradient(ellipse 100% 60% at 50% 0%, #000 40%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 100% 60% at 50% 0%, #000 40%, transparent 100%)",
      }} />
      {/* aurora blobs */}
      <div style={{
        position: "absolute", top: "-15%", left: "50%", transform: "translateX(-50%)",
        width: isMobile ? 520 : 900, height: isMobile ? 520 : 900,
        background: "radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 60%)",
        borderRadius: "50%", animation: "auroraA 14s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", top: "5%", right: "-10%",
        width: isMobile ? 360 : 620, height: isMobile ? 360 : 620,
        background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 60%)",
        borderRadius: "50%", animation: "auroraB 18s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", top: "12%", left: "-8%",
        width: isMobile ? 320 : 520, height: isMobile ? 320 : 520,
        background: "radial-gradient(circle, rgba(6,182,212,0.14) 0%, transparent 60%)",
        borderRadius: "50%", animation: "auroraA 16s ease-in-out infinite 2s",
      }} />
    </div>
  );
}

export default function LandingPage({ onAnalyze, error, onOpenAuth }) {
  const width    = useWindowWidth();
  const isMobile = width < 640;
  const isTablet = width < 1024;
  const { user, logout, deleteAccount } = useAuth();

  const [idea, setIdea]       = useState("");
  const [focused, setFocused] = useState(false);
  const [showUserMenu, setShowUserMenu]           = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const userMenuRef = useRef(null);
  const inputRef    = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false);
    };
    if (showUserMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUserMenu]);

  const handleLogout = () => { logout(); setShowUserMenu(false); };
  const handleDeleteAccount = async () => {
    await deleteAccount();
    setShowDeleteConfirm(false);
    setShowUserMenu(false);
  };
  const scrollToInput = () => {
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => inputRef.current?.focus(), 400);
  };

  const reveal = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  };

  return (
    <div style={{ minHeight: "100vh", background: "#050510", position: "relative", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes auroraA { 0%,100% { transform: translate(-50%,0) scale(1); opacity:.9 } 50% { transform: translate(-50%,6%) scale(1.08); opacity:1 } }
        @keyframes auroraB { 0%,100% { transform: translate(0,0) scale(1); opacity:.8 } 50% { transform: translate(-4%,8%) scale(1.1); opacity:1 } }
        @keyframes pulse { 0%,100% { opacity:.5 } 50% { opacity:1 } }
        @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .lp-cta:hover { transform: translateY(-2px); box-shadow: 0 24px 60px rgba(99,102,241,0.45) !important; }
        .lp-chip:hover { background: rgba(99,102,241,0.16) !important; border-color: rgba(99,102,241,0.45) !important; color:#c7d2fe !important; }
        .lp-agent:hover { transform: translateY(-6px); border-color: var(--ac) !important; box-shadow: 0 24px 60px rgba(0,0,0,0.5); }
        .lp-agent:hover .lp-agent-glow { opacity:.9 !important; }
        .lp-ghost:hover { border-color: rgba(99,102,241,0.6) !important; color:#f1f5f9 !important; }
        .opm-card { transition: transform .4s ease, border-color .4s ease; }
        .opm-card:hover { transform: translateY(-6px); border-color: rgba(129,140,248,0.5) !important; }
        .opm-card:hover .opm-glow { opacity: 1 !important; transform: translateY(0) !important; }
        .opm-pill { transition: all .25s ease; }
        .opm-pill:hover { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.85) !important; transform: translateY(-1px); }
        .opm-tile { transition: transform .25s ease, border-color .25s ease, background .25s ease; }
        .opm-tile:hover { transform: translateY(-4px); border-color: var(--tc) !important; background: rgba(255,255,255,0.04) !important; }
        .opm-tile:hover .opm-tile-dot { box-shadow: 0 0 16px var(--tc); }
        .opm-tile:hover .opm-tile-arrow { color: var(--tc) !important; transform: translateX(3px); }
        ::selection { background: rgba(99,102,241,0.35); }
      `}</style>

      <Backdrop isMobile={isMobile} />

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
        style={{
          position: "sticky", top: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: isMobile ? "0.9rem 1.25rem" : "1.1rem 3rem",
          borderBottom: "1px solid rgba(99,102,241,0.1)",
          background: "rgba(5,5,16,0.72)", backdropFilter: "blur(20px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1rem", fontWeight: 800, color: "#fff",
            boxShadow: "0 4px 15px rgba(99,102,241,0.4)", flexShrink: 0,
          }}>✦</div>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: isMobile ? "1rem" : "1.15rem", letterSpacing: "-0.02em" }}>Drusti</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            display: isMobile ? "none" : "flex", alignItems: "center", gap: "0.5rem",
            background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)",
            borderRadius: 100, padding: "0.3rem 0.85rem",
          }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981", animation: "pulse 2s ease-in-out infinite" }} />
            <span style={{ color: "#10b981", fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap" }}>Agents Online</span>
          </div>

          {user ? (
            <div ref={userMenuRef} style={{ position: "relative" }}>
              <button onClick={() => setShowUserMenu(!showUserMenu)} style={{
                background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
                borderRadius: 100, padding: "0.4rem 0.85rem 0.4rem 0.4rem",
                color: "#f1f5f9", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem",
                fontSize: "0.85rem", fontWeight: 600,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: "0.85rem", fontWeight: 700, flexShrink: 0,
                }}>{user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}</div>
                {!isMobile && (
                  <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.name || user.email.split("@")[0]}
                  </span>
                )}
                <span style={{ color: "#4b5563", fontSize: "0.7rem" }}>▾</span>
              </button>
              {showUserMenu && (
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  style={{
                    position: "absolute", top: "calc(100% + 0.5rem)", right: 0,
                    background: "rgba(10,10,30,0.97)", border: "1px solid rgba(99,102,241,0.2)",
                    borderRadius: 12, backdropFilter: "blur(20px)",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.5)", minWidth: 210, zIndex: 200, overflow: "hidden",
                  }}>
                  <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
                    <div style={{ color: "#f1f5f9", fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.2rem" }}>{user.name}</div>
                    <div style={{ color: "#4b5563", fontSize: "0.75rem" }}>{user.email}</div>
                  </div>
                  <button onClick={handleLogout}
                    style={{ width: "100%", padding: "0.75rem 1rem", border: "none", background: "none", color: "#f1f5f9", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", textAlign: "left" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}>Log Out</button>
                  <div style={{ height: 1, background: "rgba(99,102,241,0.1)", margin: "0 1rem" }} />
                  <button onClick={() => { setShowDeleteConfirm(true); setShowUserMenu(false); }}
                    style={{ width: "100%", padding: "0.75rem 1rem", border: "none", background: "none", color: "#ef4444", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", textAlign: "left" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}>Delete Account</button>
                </motion.div>
              )}
            </div>
          ) : (
            <>
              <button onClick={() => onOpenAuth("login")} className="lp-ghost" style={{
                background: "none", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 8,
                padding: isMobile ? "0.4rem 0.75rem" : "0.45rem 1rem",
                color: "#94a3b8", fontWeight: 600, fontSize: isMobile ? "0.8rem" : "0.85rem",
                cursor: "pointer", transition: "all 0.2s",
              }}>Log In</button>
              <button onClick={() => onOpenAuth("signup")} style={{
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 8,
                padding: isMobile ? "0.4rem 0.85rem" : "0.45rem 1.1rem",
                color: "#fff", fontWeight: 700, fontSize: isMobile ? "0.8rem" : "0.85rem",
                cursor: "pointer", boxShadow: "0 4px 15px rgba(99,102,241,0.35)", transition: "all 0.2s",
              }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "0 6px 25px rgba(99,102,241,0.55)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "0 4px 15px rgba(99,102,241,0.35)"}>Sign Up</button>
            </>
          )}
        </div>
      </motion.nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section style={{
        position: "relative", zIndex: 5,
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: isMobile ? "3rem 1.25rem 2rem" : isTablet ? "4rem 1.5rem 3rem" : "6rem 2rem 4rem",
      }}>
        <motion.button
          onClick={scrollToInput}
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer",
            background: "linear-gradient(135deg, rgba(99,102,241,0.14), rgba(139,92,246,0.14))",
            border: "1px solid rgba(99,102,241,0.3)", borderRadius: 100,
            padding: isMobile ? "0.35rem 0.9rem" : "0.4rem 1.1rem",
            fontSize: isMobile ? "0.72rem" : "0.8rem", fontWeight: 600, color: "#a5b4fc",
            marginBottom: isMobile ? "1.5rem" : "2rem", backdropFilter: "blur(10px)",
          }}>
          <span style={{ fontSize: "0.65rem" }}>✦</span>
          AI-Powered Startup Intelligence
          <span style={{ color: "#6366f1" }}>→</span>
        </motion.button>

        <motion.h1
          initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{
            fontSize: isMobile ? "2.35rem" : isTablet ? "3.4rem" : "clamp(3.4rem,6vw,5.25rem)",
            fontWeight: 800, textAlign: "center", lineHeight: 1.05, letterSpacing: "-0.035em",
            margin: 0, marginBottom: isMobile ? "1.1rem" : "1.5rem", maxWidth: 960, color: "#f8fafc",
          }}>
          Validate your startup
          <br />
          <span style={{
            background: "linear-gradient(120deg,#818cf8 0%,#a78bfa 45%,#22d3ee 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>before you build it.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
          style={{
            color: "#94a3b8", textAlign: "center",
            fontSize: isMobile ? "1rem" : "1.2rem", maxWidth: 620, lineHeight: 1.65,
            margin: 0, marginBottom: isMobile ? "2rem" : "2.75rem",
          }}>
          Five specialized AI analysts research your market, competitors, funding and
          strategy — then hand you an investor-ready report and pitch deck.
        </motion.p>

        {/* Input card */}
        <motion.div
          ref={inputRef}
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          style={{
            width: "100%", maxWidth: 700, scrollMarginTop: "6rem",
            background: "rgba(13,13,32,0.85)",
            border: `1px solid ${focused ? "rgba(129,140,248,0.65)" : "rgba(99,102,241,0.22)"}`,
            borderRadius: 22, padding: isMobile ? "1.25rem" : "1.5rem",
            backdropFilter: "blur(20px)",
            boxShadow: focused ? "0 0 0 4px rgba(99,102,241,0.12), 0 30px 80px rgba(0,0,0,0.55)" : "0 30px 80px rgba(0,0,0,0.45)",
            transition: "all 0.3s ease", boxSizing: "border-box",
          }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <label style={{ color: "#818cf8", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Describe your startup idea
            </label>
            <span style={{ color: "#475569", fontSize: "0.72rem", fontWeight: 500 }}>{idea.length}/300</span>
          </div>
          <textarea
            value={idea}
            onChange={e => setIdea(e.target.value.slice(0, 300))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && idea.trim()) onAnalyze(idea.trim()); }}
            placeholder="e.g. An AI-powered SaaS tool for remote team productivity using sentiment analysis…"
            style={{
              width: "100%", minHeight: isMobile ? 76 : 92, background: "transparent",
              border: "none", outline: "none", color: "#f1f5f9",
              fontSize: "1.02rem", lineHeight: 1.6, resize: "none", boxSizing: "border-box",
              fontFamily: "inherit",
            }} />

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.6rem", marginBottom: "1.1rem" }}>
            {EXAMPLES.map((ex, i) => (
              <button key={i} className="lp-chip" onClick={() => setIdea(ex)} style={{
                background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.18)",
                color: "#8b93de", borderRadius: 100, padding: "0.3rem 0.75rem",
                fontSize: "0.72rem", fontWeight: 500, cursor: "pointer", transition: "all 0.2s",
              }}>{isMobile ? ex.slice(0, 24) + "…" : ex}</button>
            ))}
          </div>

          <button className="lp-cta" disabled={!idea.trim()} onClick={() => onAnalyze(idea.trim())} style={{
            width: "100%",
            background: idea.trim() ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(99,102,241,0.14)",
            border: "none", borderRadius: 14, color: idea.trim() ? "#fff" : "#64748b",
            fontSize: "1rem", fontWeight: 700, padding: "1rem",
            cursor: idea.trim() ? "pointer" : "not-allowed",
            boxShadow: idea.trim() ? "0 12px 40px rgba(99,102,241,0.35)" : "none",
            transition: "all 0.3s ease", letterSpacing: "0.01em",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
          }}>
            {idea.trim() ? <>Generate Full Analysis <span>→</span></> : "Enter your idea to begin"}
          </button>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", marginTop: "0.8rem" }}>
            <span style={{ color: "#475569", fontSize: "0.72rem" }}>Free to start · No credit card · ~10 min report</span>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                style={{
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                  color: "#f87171", borderRadius: 10, padding: "0.75rem 1rem", marginTop: "1rem", fontSize: "0.85rem",
                }}>⚠ {error}</motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* trust marquee */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          style={{ marginTop: isMobile ? "2rem" : "2.75rem", width: "100%", maxWidth: 760, overflow: "hidden",
            maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
            WebkitMaskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)" }}>
          <div style={{ display: "flex", gap: "2.5rem", width: "max-content", animation: "marquee 22s linear infinite" }}>
            {[...AGENTS, ...AGENTS].map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#64748b", fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                <span style={{ color: a.color, fontSize: "0.9rem" }}>{a.icon}</span>{a.name}
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Agents ─────────────────────────────────────────────── */}
      <section style={{ position: "relative", zIndex: 5, padding: isMobile ? "2rem 1.25rem" : "4rem 2rem", maxWidth: 1120, margin: "0 auto" }}>
        <motion.div {...reveal} style={{ textAlign: "center", marginBottom: isMobile ? "2rem" : "3rem" }}>
          <div style={{ color: "#818cf8", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.75rem" }}>The team behind every report</div>
          <h2 style={{ color: "#f8fafc", fontSize: isMobile ? "1.75rem" : "2.5rem", fontWeight: 800, letterSpacing: "-0.02em", margin: 0, lineHeight: 1.15 }}>
            Five analysts. One idea.<br />Working in parallel.
          </h2>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(3,1fr)", gap: isMobile ? "0.85rem" : "1.1rem" }}>
          {AGENTS.map((a, i) => (
            <motion.div key={a.name} className="lp-agent"
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              style={{
                "--ac": a.color, position: "relative", overflow: "hidden",
                background: "rgba(13,13,32,0.7)", border: "1px solid rgba(99,102,241,0.14)",
                borderRadius: 18, padding: isMobile ? "1.25rem" : "1.5rem",
                backdropFilter: "blur(10px)", transition: "all 0.3s ease", cursor: "default",
              }}>
              <div className="lp-agent-glow" style={{
                position: "absolute", top: -40, right: -40, width: 140, height: 140,
                background: `radial-gradient(circle, ${a.color}33 0%, transparent 70%)`,
                borderRadius: "50%", opacity: 0.4, transition: "opacity 0.3s ease", pointerEvents: "none",
              }} />
              <div style={{
                width: 44, height: 44, borderRadius: 12, marginBottom: "1rem",
                background: `${a.color}18`, border: `1px solid ${a.color}45`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: a.color, fontSize: "1.2rem", fontWeight: 900,
              }}>{a.icon}</div>
              <h3 style={{ color: "#f1f5f9", fontSize: "1.05rem", fontWeight: 700, margin: 0, marginBottom: "0.4rem" }}>{a.name}</h3>
              <p style={{ color: "#64748b", fontSize: "0.88rem", lineHeight: 1.6, margin: 0 }}>{a.desc}</p>
            </motion.div>
          ))}
          {/* pitch-deck tile */}
          <motion.div className="lp-agent"
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: AGENTS.length * 0.06, ease: [0.22, 1, 0.36, 1] }}
            style={{
              "--ac": "#e2e8f0", position: "relative", overflow: "hidden",
              background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.1))",
              border: "1px solid rgba(99,102,241,0.25)", borderRadius: 18,
              padding: isMobile ? "1.25rem" : "1.5rem", backdropFilter: "blur(10px)",
              transition: "all 0.3s ease", cursor: "default",
            }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, marginBottom: "1rem",
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "1.2rem", fontWeight: 900,
            }}>↓</div>
            <h3 style={{ color: "#f1f5f9", fontSize: "1.05rem", fontWeight: 700, margin: 0, marginBottom: "0.4rem" }}>Pitch Deck Export</h3>
            <p style={{ color: "#94a3b8", fontSize: "0.88rem", lineHeight: 1.6, margin: 0 }}>Everything packaged into a polished, downloadable <code style={{ color: "#c7d2fe" }}>.pptx</code> ready for investors.</p>
          </motion.div>
        </div>
      </section>

      {/* ── Integrated divisions — OPM dual cards with rising glow ── */}
      <section style={{
        position: "relative", zIndex: 5,
        background: "linear-gradient(180deg,#020b1f 0%,#050510 100%)",
        borderTop: "1px solid rgba(99,102,241,0.1)", borderBottom: "1px solid rgba(99,102,241,0.1)",
      }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: isMobile ? "3rem 1.25rem" : "5.5rem 2rem" }}>
          <motion.div {...reveal} style={{ textAlign: "center", marginBottom: isMobile ? "2rem" : "3.25rem" }}>
            <div style={{ color: "#5b9bff", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.9rem" }}>One platform · two engines</div>
            <h2 style={{ color: "#f8fafc", fontSize: isMobile ? "1.75rem" : "2.5rem", fontWeight: 800, letterSpacing: "-0.025em", margin: 0, lineHeight: 1.15 }}>
              Research and strategy,<br />working as one.
            </h2>
          </motion.div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "1rem" : "1.5rem" }}>
            {DIVISIONS.map((d, i) => (
              <motion.div key={d.title} className="opm-card"
                initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "relative", overflow: "hidden", borderRadius: 22,
                  minHeight: isMobile ? 300 : 380,
                  background: "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))",
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: isMobile ? "1.75rem" : "2.25rem",
                  display: "flex", flexDirection: "column", justifyContent: "flex-end",
                }}>
                {/* rising blue glow — OPM signature */}
                <div className="opm-glow" style={{
                  position: "absolute", left: 0, right: 0, bottom: 0, height: "72%",
                  background: `linear-gradient(to top, ${d.color}66, ${d.color}1f, transparent)`,
                  opacity: 0.5, transform: "translateY(12px)", transition: "all 0.45s ease", pointerEvents: "none",
                }} />
                {/* icon top-left */}
                <div style={{
                  position: "absolute", top: isMobile ? "1.75rem" : "2.25rem", left: isMobile ? "1.75rem" : "2.25rem",
                  width: 46, height: 46, borderRadius: 13,
                  background: `${d.color}1f`, border: `1px solid ${d.color}55`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: d.color, fontSize: "1.25rem", fontWeight: 900, zIndex: 2,
                }}>{d.icon}</div>

                <div style={{ position: "relative", zIndex: 2 }}>
                  <div style={{ color: d.color, fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: "0.6rem" }}>{d.tag}</div>
                  <h3 style={{ color: "#f8fafc", fontSize: isMobile ? "1.4rem" : "1.7rem", fontWeight: 700, letterSpacing: "-0.02em", margin: 0, marginBottom: "0.75rem", lineHeight: 1.15 }}>{d.title}</h3>
                  <p style={{ color: "#a9b4c9", fontSize: "0.95rem", lineHeight: 1.65, margin: 0, marginBottom: "1.5rem", maxWidth: 440 }}>{d.desc}</p>
                  <button onClick={scrollToInput} className="opm-pill" style={{
                    display: "inline-flex", alignItems: "center", gap: "0.5rem",
                    background: "transparent", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 100,
                    padding: "0.6rem 1.25rem", color: "#f1f5f9", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
                  }}>{d.cta} <span>→</span></button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Measurable-impact statement band — OPM thin-weight signature ── */}
      <motion.section {...reveal} style={{
        position: "relative", zIndex: 5, overflow: "hidden",
        background: "linear-gradient(180deg,#020b1f 0%,#00030c 100%)",
        borderBottom: "1px solid rgba(99,102,241,0.1)",
      }}>
        <div style={{
          position: "absolute", left: "50%", bottom: "-35%", transform: "translateX(-50%)",
          width: isMobile ? 500 : 950, height: isMobile ? 500 : 950,
          background: "radial-gradient(circle, rgba(12,85,204,0.28) 0%, transparent 60%)", pointerEvents: "none",
        }} />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 900, margin: "0 auto", textAlign: "center", padding: isMobile ? "3.5rem 1.25rem" : "6rem 2rem" }}>
          <h2 style={{
            color: "#f8fafc", fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.15,
            margin: 0, marginBottom: "1.5rem", fontSize: isMobile ? "2.1rem" : "clamp(2.6rem,5vw,4rem)",
          }}>
            Validate in minutes.<br /><span style={{ fontWeight: 700 }}>Decide with conviction.</span>
          </h2>
          <p style={{ color: "#a9b4c9", fontSize: isMobile ? "1rem" : "1.15rem", lineHeight: 1.7, margin: "0 auto", maxWidth: 560 }}>
            Skip weeks of research. Get the market truth, the competitive picture and a
            fundable narrative — before you commit a single sprint.
          </p>
        </div>
      </motion.section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section style={{ position: "relative", zIndex: 5, padding: isMobile ? "2rem 1.25rem" : "4rem 2rem", maxWidth: 1000, margin: "0 auto" }}>
        <motion.div {...reveal} style={{ textAlign: "center", marginBottom: isMobile ? "2rem" : "3rem" }}>
          <div style={{ color: "#818cf8", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.75rem" }}>How it works</div>
          <h2 style={{ color: "#f8fafc", fontSize: isMobile ? "1.75rem" : "2.5rem", fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>From idea to report in 3 steps</h2>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: isMobile ? "1rem" : "1.5rem" }}>
          {STEPS.map((s, i) => (
            <motion.div key={s.n}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              style={{ position: "relative", padding: isMobile ? "1.25rem" : "1.5rem", borderRadius: 18, background: "rgba(13,13,32,0.5)", border: "1px solid rgba(99,102,241,0.12)" }}>
              <div style={{
                fontSize: isMobile ? "2rem" : "2.5rem", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: "0.75rem",
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>{s.n}</div>
              <h3 style={{ color: "#f1f5f9", fontSize: "1.1rem", fontWeight: 700, margin: 0, marginBottom: "0.4rem" }}>{s.title}</h3>
              <p style={{ color: "#64748b", fontSize: "0.9rem", lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Industry ecosystem tiles — OPM-inspired, clickable to prefill ── */}
      <section style={{ position: "relative", zIndex: 5, maxWidth: 1120, margin: "0 auto", padding: isMobile ? "2rem 1.25rem" : "4rem 2rem" }}>
        <motion.div {...reveal} style={{ textAlign: "center", marginBottom: isMobile ? "1.75rem" : "2.5rem" }}>
          <div style={{ color: "#818cf8", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.75rem" }}>Built for every founder</div>
          <h2 style={{ color: "#f8fafc", fontSize: isMobile ? "1.75rem" : "2.5rem", fontWeight: 800, letterSpacing: "-0.02em", margin: 0, lineHeight: 1.15 }}>
            Whatever you're building,<br />we've mapped the market.
          </h2>
          <p style={{ color: "#64748b", fontSize: isMobile ? "0.9rem" : "1rem", marginTop: "0.9rem", marginBottom: 0 }}>
            Tap an industry to drop a starter idea into the box.
          </p>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: isMobile ? "0.75rem" : "1rem" }}>
          {INDUSTRIES.map(([name, color, seed], i) => (
            <motion.button key={name} className="opm-tile"
              onClick={() => { setIdea(seed); scrollToInput(); }}
              initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              style={{
                "--tc": color, textAlign: "left", cursor: "pointer",
                background: "rgba(13,13,32,0.6)", border: "1px solid rgba(99,102,241,0.12)", borderRadius: 16,
                padding: isMobile ? "0.95rem 1rem" : "1.15rem 1.35rem",
                display: "flex", alignItems: "center", gap: "0.85rem",
              }}>
              <span className="opm-tile-dot" style={{ width: 12, height: 12, borderRadius: 4, background: color, flexShrink: 0, transition: "box-shadow 0.25s ease" }} />
              <span style={{ color: "#e2e8f0", fontSize: isMobile ? "0.9rem" : "1rem", fontWeight: 600 }}>{name}</span>
              <span className="opm-tile-arrow" style={{ marginLeft: "auto", color: "#475569", fontSize: "1rem", transition: "color 0.25s ease, transform 0.25s ease" }}>→</span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────── */}
      <motion.section {...reveal} style={{
        position: "relative", zIndex: 5, margin: isMobile ? "1rem 1.25rem" : "2rem auto", maxWidth: 1000,
        borderRadius: 22, overflow: "hidden",
        border: "1px solid rgba(99,102,241,0.14)", background: "rgba(10,10,25,0.6)", backdropFilter: "blur(10px)",
        display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",
      }}>
        {[["500+", "Startups Analyzed"], ["5", "AI Analysts"], ["~10 min", "Full Report"], ["Free", "To Get Started"]].map(([num, label], i) => (
          <div key={i} style={{
            textAlign: "center", padding: isMobile ? "1.5rem 0.75rem" : "2rem 1rem",
            borderRight: !isMobile && i < 3 ? "1px solid rgba(99,102,241,0.1)" : "none",
            borderBottom: isMobile && i < 2 ? "1px solid rgba(99,102,241,0.1)" : "none",
            ...(isMobile && i % 2 === 0 ? { borderRight: "1px solid rgba(99,102,241,0.1)" } : {}),
          }}>
            <div style={{ background: "linear-gradient(135deg,#818cf8,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 900, fontSize: isMobile ? "1.6rem" : "2.1rem", letterSpacing: "-0.02em" }}>{num}</div>
            <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "0.25rem" }}>{label}</div>
          </div>
        ))}
      </motion.section>

      {/* ── Final CTA ─────────────────────────────────────────────── */}
      <motion.section {...reveal} style={{
        position: "relative", zIndex: 5, textAlign: "center",
        padding: isMobile ? "3rem 1.25rem" : "5rem 2rem", maxWidth: 720, margin: "0 auto",
      }}>
        <h2 style={{ color: "#f8fafc", fontSize: isMobile ? "1.9rem" : "2.75rem", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.1, margin: 0, marginBottom: "1rem" }}>
          Your next big idea deserves<br />a second opinion.
        </h2>
        <p style={{ color: "#94a3b8", fontSize: isMobile ? "1rem" : "1.15rem", lineHeight: 1.6, margin: 0, marginBottom: "2rem" }}>
          Test the market before you write a line of code.
        </p>
        <button className="lp-cta" onClick={scrollToInput} style={{
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 14,
          color: "#fff", fontSize: "1.05rem", fontWeight: 700, padding: "1rem 2.25rem",
          cursor: "pointer", boxShadow: "0 12px 40px rgba(99,102,241,0.35)", transition: "all 0.3s ease",
          display: "inline-flex", alignItems: "center", gap: "0.5rem",
        }}>Analyze my idea <span>→</span></button>
      </motion.section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer style={{
        position: "relative", zIndex: 5, borderTop: "1px solid rgba(99,102,241,0.1)",
        padding: isMobile ? "1.75rem 1.25rem" : "2rem 3rem",
        display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: "center", justifyContent: "space-between", gap: "1rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 800, color: "#fff" }}>✦</div>
          <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: "0.9rem" }}>Drusti</span>
        </div>
        <span style={{ color: "#475569", fontSize: "0.8rem" }}>© {new Date().getFullYear()} Drusti · AI-powered startup intelligence</span>
      </footer>

      {/* ── Delete Account Confirmation ─────────────────────────────────── */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "1rem" }}>
            <motion.div initial={{ scale: 0.88, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.88, opacity: 0 }}
              transition={{ type: "spring", damping: 22, stiffness: 300 }}
              style={{ background: "rgba(8,8,28,0.99)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 20, padding: isMobile ? "1.75rem 1.25rem" : "2.25rem", width: "100%", maxWidth: 420, boxShadow: "0 40px 100px rgba(0,0,0,0.7)" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", margin: "0 auto 1.25rem" }}>⚠</div>
              <h3 style={{ color: "#f1f5f9", fontSize: "1.1rem", fontWeight: 700, textAlign: "center", margin: "0 0 0.75rem" }}>Delete Account?</h3>
              <p style={{ color: "#64748b", fontSize: "0.85rem", textAlign: "center", lineHeight: 1.6, margin: "0 0 1.75rem" }}>
                Are you sure? This will permanently delete your account and all your data. This cannot be undone.
              </p>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button onClick={handleDeleteAccount} style={{ flex: 1, background: "linear-gradient(135deg,#ef4444,#dc2626)", border: "none", borderRadius: 10, padding: "0.85rem", color: "#fff", fontWeight: 700, fontSize: "0.92rem", cursor: "pointer", boxShadow: "0 4px 20px rgba(239,68,68,0.3)" }}>Yes, Delete</button>
                <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, background: "transparent", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, color: "#4b5563", padding: "0.85rem", cursor: "pointer", fontSize: "0.92rem" }}>Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
