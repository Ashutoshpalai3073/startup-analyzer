import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  { icon:"▲", label:"Market Research Analyst",    desc:"Calculating TAM, SAM, SOM and CAGR projections...", color:"#6366f1" },
  { icon:"◈", label:"Competitive Intelligence",   desc:"Mapping top 5 competitors and market gaps...",      color:"#8b5cf6" },
  { icon:"◎", label:"Startup Funding Analyst",    desc:"Tracking VC activity and funding rounds...",        color:"#06b6d4" },
  { icon:"⬡", label:"SWOT Analyst",               desc:"Synthesizing strengths, threats and opportunities...",color:"#10b981" },
  { icon:"→", label:"GTM Strategist",             desc:"Crafting 5-phase go-to-market roadmap...",          color:"#f59e0b" },
];

export default function LoadingScreen({ idea }) {
  const [current, setCurrent] = useState(0);
  const [dots, setDots]       = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setCurrent(c => c < STEPS.length - 1 ? c + 1 : c);
    }, 18000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
  const target = (current / STEPS.length) * 100;
  const t = setInterval(() => {
    setProgress(p => {
      if (p >= target) { clearInterval(t); return target; }
      return p + 0.5;
    });
  }, 30);
  return () => clearInterval(t);
}, [current]);

  return (
    <div style={{
      minHeight:"100vh", background:"#050510",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      padding:"2rem", position:"relative", overflow:"hidden",
    }}>
      <style>{`
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(80px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(80px) rotate(-360deg); }
        }
        @keyframes pulse3d {
          0%,100% { transform: scale(1); box-shadow: 0 0 30px rgba(99,102,241,0.3); }
          50%      { transform: scale(1.08); box-shadow: 0 0 60px rgba(99,102,241,0.6); }
        }
      `}</style>

      {/* Background glow */}
      <div style={{
        position:"absolute", top:"50%", left:"50%",
        transform:"translate(-50%,-50%)",
        width:600, height:600,
        background:"radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)",
        borderRadius:"50%", pointerEvents:"none",
      }} />

      {/* 3D Orbital spinner */}
      <div style={{ position:"relative", width:160, height:160, marginBottom:"2.5rem" }}>
        {/* Core sphere */}
        <div style={{
          position:"absolute", top:"50%", left:"50%",
          transform:"translate(-50%,-50%)",
          width:60, height:60, borderRadius:"50%",
          background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
          boxShadow:"0 0 40px rgba(99,102,241,0.6)",
          animation:"pulse3d 2s ease-in-out infinite",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:"1.4rem", zIndex:2,
        }}>✦</div>

        {/* Orbiting rings */}
        {[0,1,2].map(i => (
          <div key={i} style={{
            position:"absolute", top:"50%", left:"50%",
            transform:"translate(-50%,-50%)",
            width: 80 + i*30, height: 80 + i*30,
            borderRadius:"50%",
            border:`1px solid rgba(99,102,241,${0.3 - i*0.08})`,
            boxShadow:`0 0 ${10+i*5}px rgba(99,102,241,${0.1-i*0.02})`,
          }} />
        ))}

        {/* Orbiting dots */}
        {[0,1,2].map(i => (
          <div key={i} style={{
            position:"absolute", top:"50%", left:"50%",
            width:10, height:10, marginTop:-5, marginLeft:-5,
            borderRadius:"50%",
            background: ["#6366f1","#8b5cf6","#06b6d4"][i],
            boxShadow:`0 0 10px ${["#6366f1","#8b5cf6","#06b6d4"][i]}`,
            animation:`orbit ${2+i*0.7}s linear infinite ${i*0.4}s`,
          }} />
        ))}
      </div>

      <motion.h2
        animate={{ opacity:[0.7,1,0.7] }}
        transition={{ duration:2, repeat:Infinity }}
        style={{ color:"#f1f5f9", fontSize:"1.6rem", fontWeight:800,
          marginBottom:"0.5rem", letterSpacing:"-0.02em" }}
      >
        Analyzing Your Idea{dots}
      </motion.h2>

      <p style={{
        color:"#475569", fontSize:"0.9rem", marginBottom:"2.5rem",
        textAlign:"center", maxWidth:460, lineHeight:1.6,
      }}>
        "{idea}"
      </p>

      {/* Progress bar */}
      <div style={{ width:"100%", maxWidth:520, marginBottom:"2rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.5rem" }}>
          <span style={{ color:"#475569", fontSize:"0.75rem" }}>Analysis progress</span>
          <span style={{ color:"#6366f1", fontSize:"0.75rem", fontWeight:700 }}>{Math.round(progress)}%</span>
        </div>
        <div style={{ height:4, background:"rgba(99,102,241,0.1)", borderRadius:2 }}>
          <motion.div
            animate={{ width:`${progress}%` }}
            transition={{ duration:0.3 }}
            style={{
              height:"100%", borderRadius:2,
              background:"linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4)",
              boxShadow:"0 0 10px rgba(99,102,241,0.5)",
            }}
          />
        </div>
      </div>

      {/* Agent steps */}
      <div style={{ width:"100%", maxWidth:520, display:"flex", flexDirection:"column", gap:"0.6rem" }}>
        {STEPS.map((step, i) => {
          const done   = i < current;
          const active = i === current;
          return (
            <motion.div key={i}
              initial={{ opacity:0, x:-20 }}
              animate={{ opacity:1, x:0 }}
              transition={{ delay:i*0.1 }}
              style={{
                background: active ? `rgba(${hexRgb(step.color)},0.1)` : done ? "rgba(16,185,129,0.05)" : "rgba(15,15,35,0.5)",
                border:`1px solid ${active ? step.color+"60" : done ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.04)"}`,
                borderRadius:12, padding:"0.85rem 1.1rem",
                display:"flex", alignItems:"center", gap:"0.9rem",
                transition:"all 0.4s ease",
              }}
            >
              <div style={{
                width:36, height:36, borderRadius:10, flexShrink:0,
                background: done ? "rgba(16,185,129,0.15)" : active ? `rgba(${hexRgb(step.color)},0.2)` : "rgba(255,255,255,0.04)",
                border:`1px solid ${done ? "rgba(16,185,129,0.3)" : active ? step.color+"40" : "transparent"}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:"1.1rem", fontWeight:900,
              }}>
                {done ? "✓" : step.icon}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color: done ? "#10b981" : active ? "#f1f5f9" : "#374151", fontWeight:600, fontSize:"0.88rem" }}>
                  {step.label}
                </div>
                {active && (
                  <div style={{ color:step.color, fontSize:"0.75rem", marginTop:"0.15rem" }}>{step.desc}</div>
                )}
              </div>
              {active && (
                <div style={{
                  width:18, height:18, borderRadius:"50%", flexShrink:0,
                  border:`2px solid ${step.color}30`,
                  borderTop:`2px solid ${step.color}`,
                  animation:"spin 0.8s linear infinite",
                }} />
              )}
              {done && <div style={{ color:"#10b981", fontSize:"0.85rem", flexShrink:0 }}>✓</div>}
            </motion.div>
          );
        })}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <p style={{ color:"#1e293b", fontSize:"0.78rem", marginTop:"2rem" }}>
        Analysis takes 5–10 minutes · Please keep this tab open
      </p>
    </div>
  );
}

function hexRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}
