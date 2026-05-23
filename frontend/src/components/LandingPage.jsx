import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWindowWidth } from "../useWindowWidth";

const EXAMPLES = [
  "SaaS tool for remote team productivity using sentiment analysis",
  "Blockchain-based platform for secure digital identity verification",
  "AI-powered personal finance app for millennials",
  "No-code platform for building mobile apps with AI",
];

/* ── Floating 3D Orb (pure CSS + JS canvas) ─────────────────────────── */
function ParticleCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    let w = canvas.width  = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.4, dy: (Math.random() - 0.5) * 0.4,
      o: Math.random() * 0.5 + 0.1,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,102,241,${p.o})`;
        ctx.fill();
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > w) p.dx *= -1;
        if (p.y < 0 || p.y > h) p.dy *= -1;
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(99,102,241,${0.08 * (1 - dist/100)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    const onResize = () => {
      w = canvas.width  = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none" }} />;
}

/* ── 3D Rotating Cube ───────────────────────────────────────────────── */
function Cube3D({ size=60, color="#6366f1", delay=0 }) {
  return (
    <div style={{
      width: size, height: size,
      position: "relative", transformStyle: "preserve-3d",
      animation: `rotateCube 8s linear infinite ${delay}s`,
    }}>
      {["front","back","left","right","top","bottom"].map((face, i) => {
        const half = size/2;
        const transforms = [
          `translateZ(${half}px)`, `rotateY(180deg) translateZ(${half}px)`,
          `rotateY(-90deg) translateZ(${half}px)`, `rotateY(90deg) translateZ(${half}px)`,
          `rotateX(90deg) translateZ(${half}px)`, `rotateX(-90deg) translateZ(${half}px)`,
        ];
        return (
          <div key={face} style={{
            position:"absolute", width:size, height:size,
            border: `1px solid ${color}40`,
            background: `${color}08`,
            backdropFilter: "blur(2px)",
            transform: transforms[i],
          }} />
        );
      })}
    </div>
  );
}

export default function LandingPage({ onAnalyze, error }) {
  const width       = useWindowWidth();
  const isMobile    = width < 640;
  const isTablet    = width < 1024;

  const [idea, setIdea]       = useState("");
  const [focused, setFocused] = useState(false);
  const [exIdx, setExIdx]     = useState(0);

  useEffect(() => {
    const t = setInterval(() => setExIdx(i => (i+1) % EXAMPLES.length), 3500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ minHeight:"100vh", background:"#050510", overflow:"hidden", position:"relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800;900&display=swap');
        @keyframes rotateCube { from { transform: rotateX(0deg) rotateY(0deg); } to { transform: rotateX(360deg) rotateY(360deg); } }
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-20px); } }
        @keyframes glow { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
        @keyframes gradShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .cta-btn:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 20px 60px rgba(99,102,241,0.5) !important; }
        .example-chip:hover { background: rgba(99,102,241,0.2) !important; border-color: rgba(99,102,241,0.5) !important; }
        .hover-card:hover { transform: translateY(-4px) !important; transition: all 0.3s ease !important; }
      `}</style>

      <ParticleCanvas />

      {/* Ambient glows */}
      <div style={{ position:"fixed", top:"-20%", left:"-10%", width:isMobile?400:700, height:isMobile?400:700,
        background:"radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
        borderRadius:"50%", pointerEvents:"none", zIndex:1,
        animation:"glow 4s ease-in-out infinite" }} />
      <div style={{ position:"fixed", bottom:"-20%", right:"-10%", width:isMobile?300:600, height:isMobile?300:600,
        background:"radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)",
        borderRadius:"50%", pointerEvents:"none", zIndex:1 }} />

      {/* Navbar */}
      <motion.nav
        initial={{ opacity:0, y:-20 }}
        animate={{ opacity:1, y:0 }}
        style={{
          position:"relative", zIndex:10,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding: isMobile ? "1rem 1.25rem" : "1.25rem 3rem",
          borderBottom:"1px solid rgba(99,102,241,0.1)",
          background:"rgba(5,5,16,0.8)", backdropFilter:"blur(20px)",
        }}
      >
        <div style={{ display:"flex", alignItems:"center", gap:"0.6rem" }}>
          <div style={{
            width:32, height:32, borderRadius:8,
            background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:"1rem", fontWeight:800, color:"#fff",
            boxShadow:"0 4px 15px rgba(99,102,241,0.4)",
            flexShrink:0,
          }}>✦</div>
          <span style={{ color:"#fff", fontWeight:800, fontSize: isMobile ? "0.95rem" : "1.1rem", letterSpacing:"-0.02em" }}>
            Drusti
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
          <div style={{
            background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.25)",
            borderRadius:100, padding: isMobile ? "0.3rem 0.6rem" : "0.3rem 0.9rem",
            display:"flex", alignItems:"center", gap:"0.5rem",
          }}>
            <div style={{
              width:7, height:7, borderRadius:"50%",
              background:"#10b981",
              boxShadow:"0 0 8px #10b981",
              animation:"glow 2s ease-in-out infinite",
              flexShrink:0,
            }}/>
            <span style={{ color:"#10b981", fontSize:"0.75rem", fontWeight:600, whiteSpace:"nowrap" }}>
              {isMobile ? "Online" : "AI Agents Online"}
            </span>
          </div>
        </div>
      </motion.nav>

      {/* Hero */}
      <div style={{
        position:"relative", zIndex:5,
        display:"flex", flexDirection:"column", alignItems:"center",
        padding: isMobile ? "2.5rem 1rem 2rem" : isTablet ? "3.5rem 1.5rem 2.5rem" : "5rem 2rem 3rem",
        perspective:"1200px",
      }}>
        {/* Floating 3D cubes — hidden on mobile to avoid overlap */}
        {!isMobile && !isTablet && (
          <>
            <div style={{ position:"absolute", top:60, left:"8%", animation:"float 6s ease-in-out infinite", zIndex:2 }}>
              <Cube3D size={isTablet ? 35 : 50} color="#6366f1" delay={0} />
            </div>
            <div style={{ position:"absolute", top:120, right:"10%", animation:"float 8s ease-in-out infinite 1s", zIndex:2 }}>
              <Cube3D size={isTablet ? 25 : 35} color="#8b5cf6" delay={2} />
            </div>
            {!isTablet && (
              <div style={{ position:"absolute", bottom:100, left:"15%", animation:"float 7s ease-in-out infinite 0.5s", zIndex:2 }}>
                <Cube3D size={25} color="#06b6d4" delay={1} />
              </div>
            )}
          </>
        )}

        {/* Badge */}
        <motion.div
          initial={{ opacity:0, scale:0.8 }}
          animate={{ opacity:1, scale:1 }}
          transition={{ delay:0.1 }}
          style={{
            background:"linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))",
            border:"1px solid rgba(99,102,241,0.35)",
            borderRadius:100, padding: isMobile ? "0.35rem 0.9rem" : "0.4rem 1.2rem",
            fontSize: isMobile ? "0.7rem" : "0.78rem", fontWeight:700,
            color:"#a5b4fc", letterSpacing:"0.06em",
            textTransform:"uppercase", marginBottom: isMobile ? "1.25rem" : "2rem",
            backdropFilter:"blur(10px)",
            boxShadow:"0 0 30px rgba(99,102,241,0.15)",
            textAlign:"center",
          }}
        >
          🚀 {isMobile ? "AI Startup Intelligence" : "AI-Powered Startup Intelligence Platform"}
        </motion.div>

        {/* Main heading */}
        <motion.h1
          initial={{ opacity:0, y:30 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:0.2 }}
          style={{
            fontSize: isMobile ? "2rem" : isTablet ? "2.8rem" : "clamp(2.8rem,6vw,5rem)",
            fontWeight:900,
            textAlign:"center", lineHeight:1.1,
            letterSpacing:"-0.03em",
            marginBottom: isMobile ? "1rem" : "1.5rem",
            maxWidth:900, padding:"0 0.5rem",
          }}
        >
          <span style={{ color:"#f1f5f9" }}>Transform Your Idea Into</span>
          <br />
          <span style={{
            background:"linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #06b6d4 100%)",
            backgroundSize:"200% 200%",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
            animation:"gradShift 4s ease infinite",
          }}>
            {isMobile ? "an Investor Report" : "an Investor-Ready Report"}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity:0, y:20 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:0.3 }}
          style={{
            color:"#64748b", textAlign:"center",
            fontSize: isMobile ? "0.9rem" : "1.15rem",
            maxWidth:580, lineHeight:1.75,
            marginBottom: isMobile ? "1.75rem" : "3rem",
            padding:"0 0.5rem",
          }}
        >
          Five AI analysts work in parallel — market sizing, competitor intel,
          funding landscape, SWOT matrix, and full GTM strategy.{!isMobile && " Ready to impress any investor in minutes."}
        </motion.p>

        {/* Input card */}
        <motion.div
          initial={{ opacity:0, y:30 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:0.4 }}
          style={{
            width:"100%", maxWidth:680,
            background:"rgba(15,15,35,0.85)",
            border:`1px solid ${focused ? "rgba(99,102,241,0.6)" : "rgba(99,102,241,0.2)"}`,
            borderRadius:20, padding: isMobile ? "1.25rem" : "1.75rem",
            backdropFilter:"blur(20px)",
            boxShadow: focused
              ? "0 0 0 4px rgba(99,102,241,0.1), 0 30px 80px rgba(0,0,0,0.5)"
              : "0 30px 80px rgba(0,0,0,0.4)",
            transition:"all 0.3s ease",
            boxSizing:"border-box",
          }}
        >
          <label style={{ color:"#94a3b8", fontSize:"0.78rem", fontWeight:700,
            textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:"0.75rem" }}>
            Describe your startup idea
          </label>
          <textarea
            value={idea}
            onChange={e => setIdea(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="e.g. AI-powered SaaS tool for remote team productivity..."
            style={{
              width:"100%", minHeight:isMobile ? 70 : 90, background:"transparent",
              border:"none", outline:"none", color:"#f1f5f9",
              fontSize:"1rem", lineHeight:1.7, resize:"none",
              boxSizing:"border-box",
            }}
          />

          {/* Example chips */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:"0.4rem", marginTop:"0.75rem", marginBottom:"1.25rem" }}>
            {EXAMPLES.map((ex, i) => (
              <button key={i} className="example-chip"
                onClick={() => setIdea(ex)}
                style={{
                  background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.18)",
                  color:"#7c86e8", borderRadius:8, padding:"0.25rem 0.65rem",
                  fontSize:"0.72rem", cursor:"pointer", transition:"all 0.2s",
                }}>
                {ex.substring(0, isMobile ? 22 : 28)}…
              </button>
            ))}
          </div>

          <button
            className="cta-btn"
            disabled={!idea.trim()}
            onClick={() => onAnalyze(idea.trim())}
            style={{
              width:"100%",
              background: idea.trim()
                ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                : "rgba(99,102,241,0.2)",
              border:"none", borderRadius:12, color:"#fff",
              fontSize:"1rem", fontWeight:700, padding:"1rem",
              cursor: idea.trim() ? "pointer" : "not-allowed",
              boxShadow: idea.trim() ? "0 10px 40px rgba(99,102,241,0.35)" : "none",
              transition:"all 0.3s ease", letterSpacing:"0.02em",
            }}
          >
            {idea.trim() ? "✦ Generate Full Analysis →" : "Enter your idea above"}
          </button>

          {error && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
              style={{
                background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)",
                color:"#ef4444", borderRadius:10, padding:"0.75rem 1rem",
                marginTop:"1rem", fontSize:"0.85rem",
              }}>
              ⚠ {error}
            </motion.div>
          )}
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity:0 }}
          animate={{ opacity:1 }}
          transition={{ delay:0.6 }}
          style={{
            display:"grid",
            gridTemplateColumns: isMobile ? "1fr 1fr 1fr" : "repeat(6,1fr)",
            gap: isMobile ? "0.5rem" : "0.75rem",
            marginTop: isMobile ? "1.5rem" : "2.5rem",
            width:"100%", maxWidth:900,
            padding:"0 0.5rem",
          }}
        >
          {[
            ["▲","Market","TAM · SAM · SOM"],
            ["◈","Competitors","Top 5 rivals"],
            ["◎","Funding","VC landscape"],
            ["⬡","SWOT","Strategy matrix"],
            ["→","GTM","5-phase roadmap"],
            ["↓","Pitch Deck","Download PPTX"],
          ].map(([icon, title, sub]) => (
            <motion.div key={title} className="hover-card"
              style={{
                background:"rgba(15,15,35,0.7)",
                border:"1px solid rgba(99,102,241,0.14)",
                borderRadius:14, padding: isMobile ? "0.65rem 0.5rem" : "0.8rem 1.1rem",
                textAlign:"center",
                backdropFilter:"blur(10px)",
                cursor:"default",
                transition:"all 0.3s ease",
              }}>
              <div style={{
                fontSize:"1rem", fontWeight:900, marginBottom:"0.3rem",
                background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
              }}>{icon}</div>
              <div style={{ color:"#e2e8f0", fontWeight:700, fontSize: isMobile ? "0.72rem" : "0.82rem" }}>{title}</div>
              {!isMobile && <div style={{ color:"#475569", fontSize:"0.7rem", marginTop:"0.15rem" }}>{sub}</div>}
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity:0 }}
        animate={{ opacity:1 }}
        transition={{ delay:0.8 }}
        style={{
          position:"relative", zIndex:5,
          borderTop:"1px solid rgba(99,102,241,0.08)",
          borderBottom:"1px solid rgba(99,102,241,0.08)",
          background:"rgba(10,10,25,0.6)", backdropFilter:"blur(10px)",
          display:"grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",
          gap: isMobile ? "0" : "0",
          padding: isMobile ? "1rem" : "1.5rem 2rem",
        }}
      >
        {[
          ["500+","Startups Analyzed"],
          ["5","AI Analysts"],
          ["10 min","Full Report"],
          ["Free","To Get Started"],
        ].map(([num, label], i) => (
          <div key={i} style={{
            textAlign:"center",
            padding: isMobile ? "0.75rem 0.5rem" : "0 3rem",
            borderRight: isMobile
              ? (i % 2 === 0 ? "1px solid rgba(99,102,241,0.1)" : "none")
              : (i < 3 ? "1px solid rgba(99,102,241,0.1)" : "none"),
            borderBottom: isMobile && i < 2 ? "1px solid rgba(99,102,241,0.08)" : "none",
          }}>
            <div style={{
              background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
              fontWeight:900, fontSize: isMobile ? "1.4rem" : "1.8rem", letterSpacing:"-0.02em",
            }}>{num}</div>
            <div style={{ color:"#475569", fontSize:"0.78rem", marginTop:"0.1rem" }}>{label}</div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
