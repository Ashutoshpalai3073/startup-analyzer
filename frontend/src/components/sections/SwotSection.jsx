import { motion } from "framer-motion";
import Card from "./Card";
import { useWindowWidth } from "../../useWindowWidth";

const Q = [
  { key:"strengths",     label:"Strengths",     icon:"S", color:"#10b981", bg:"rgba(16,185,129,0.05)",  border:"rgba(16,185,129,0.15)"  },
  { key:"weaknesses",    label:"Weaknesses",    icon:"W", color:"#ef4444", bg:"rgba(239,68,68,0.05)",   border:"rgba(239,68,68,0.15)"   },
  { key:"opportunities", label:"Opportunities", icon:"O", color:"#6366f1", bg:"rgba(99,102,241,0.05)",  border:"rgba(99,102,241,0.15)"  },
  { key:"threats",       label:"Threats",       icon:"T", color:"#f59e0b", bg:"rgba(245,158,11,0.05)",  border:"rgba(245,158,11,0.15)"  },
];

export default function SwotSection({ data={} }) {
  const width    = useWindowWidth();
  const isMobile = width < 640;

  if (!data || !Object.keys(data).length) return <Empty />;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1.25rem" }}>

      {/* Summary bar — 2-col on mobile, 4-col on desktop */}
      <div style={{
        display:"grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",
        gap:"0.75rem",
      }}>
        {Q.map((q) => (
          <div key={q.key} style={{
            background: q.bg,
            border: `1px solid ${q.border}`,
            borderRadius:12, padding:"0.85rem 1rem",
            display:"flex", alignItems:"center", gap:"0.65rem",
          }}>
            <div style={{
              width:32, height:32, borderRadius:8, flexShrink:0,
              background:`rgba(${hexRgb(q.color)},0.15)`,
              border:`1px solid rgba(${hexRgb(q.color)},0.25)`,
              display:"flex", alignItems:"center", justifyContent:"center",
              color:q.color, fontWeight:800, fontSize:"0.85rem",
            }}>{q.icon}</div>
            <div>
              <div style={{ color:q.color, fontWeight:700, fontSize:"0.82rem" }}>{q.label}</div>
              <div style={{ color:"#374151", fontSize:"0.7rem" }}>{(data[q.key]||[]).length} points</div>
            </div>
          </div>
        ))}
      </div>

      {/* SWOT matrix — 1-col on mobile, 2-col on desktop */}
      <div style={{
        display:"grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap:"1rem",
      }}>
        {Q.map((q, qi) => (
          <motion.div key={q.key}
            initial={{ opacity:0, scale:0.97 }}
            animate={{ opacity:1, scale:1 }}
            transition={{ delay:qi*0.08 }}
            style={{
              background: q.bg,
              border:`1px solid ${q.border}`,
              borderRadius:16, padding:"1.25rem",
              overflow:"hidden", position:"relative",
            }}
          >
            <div style={{
              position:"absolute", top:-12, right:-12,
              width:60, height:60, borderRadius:"50%",
              background:`rgba(${hexRgb(q.color)},0.08)`,
              pointerEvents:"none",
            }} />

            <div style={{
              display:"flex", alignItems:"center",
              justifyContent:"space-between", marginBottom:"1rem",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:"0.6rem" }}>
                <div style={{
                  width:28, height:28, borderRadius:7,
                  background:`rgba(${hexRgb(q.color)},0.15)`,
                  border:`1px solid rgba(${hexRgb(q.color)},0.3)`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color:q.color, fontWeight:900, fontSize:"0.78rem",
                }}>{q.icon}</div>
                <span style={{ color:q.color, fontWeight:800, fontSize:"0.95rem" }}>
                  {q.label}
                </span>
              </div>
              <span style={{
                background:`rgba(${hexRgb(q.color)},0.12)`,
                color:q.color, borderRadius:100,
                padding:"0.1rem 0.55rem", fontSize:"0.68rem", fontWeight:700,
              }}>
                {(data[q.key]||[]).length}
              </span>
            </div>

            <div style={{ height:1, background:`rgba(${hexRgb(q.color)},0.12)`, marginBottom:"0.85rem" }} />

            <div style={{ display:"flex", flexDirection:"column", gap:"0.45rem" }}>
              {(data[q.key]||[]).map((item, i) => (
                <motion.div key={i}
                  initial={{ opacity:0, x:-8 }}
                  animate={{ opacity:1, x:0 }}
                  transition={{ delay:qi*0.08 + i*0.04 }}
                  style={{
                    display:"flex", alignItems:"flex-start", gap:"0.6rem",
                    background:"rgba(0,0,0,0.2)",
                    borderRadius:8, padding:"0.5rem 0.75rem",
                    borderLeft:`2px solid rgba(${hexRgb(q.color)},0.4)`,
                  }}
                >
                  <span style={{
                    color:`rgba(${hexRgb(q.color)},0.7)`,
                    fontSize:"0.65rem", fontWeight:800,
                    marginTop:"0.15rem", flexShrink:0,
                  }}>
                    {String(i+1).padStart(2,"0")}
                  </span>
                  <span style={{ color:"#cbd5e1", fontSize:"0.82rem", lineHeight:1.5 }}>
                    {item}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Strategic priorities + risk — stack on mobile */}
      <div style={{
        display:"grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap:"1.25rem",
      }}>
        {(data.priorities||[]).length > 0 && (
          <Card glow color="#6366f1">
            <div style={{ display:"flex", alignItems:"center", gap:"0.6rem", marginBottom:"1rem" }}>
              <div style={{
                width:28, height:28, borderRadius:7,
                background:"rgba(99,102,241,0.15)",
                border:"1px solid rgba(99,102,241,0.3)",
                display:"flex", alignItems:"center", justifyContent:"center",
                color:"#6366f1", fontWeight:900, fontSize:"0.75rem",
              }}>P</div>
              <h3 style={{ color:"#e2e8f0", fontWeight:700, fontSize:"0.95rem", margin:0 }}>
                Strategic Priorities
              </h3>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"0.65rem" }}>
              {(data.priorities||[]).map((p, i) => (
                <motion.div key={i}
                  initial={{ opacity:0, x:-12 }}
                  animate={{ opacity:1, x:0 }}
                  transition={{ delay:i*0.1 }}
                  style={{
                    display:"flex", gap:"0.75rem", alignItems:"flex-start",
                    padding:"0.7rem 0.9rem",
                    background:"rgba(99,102,241,0.06)",
                    borderRadius:10, border:"1px solid rgba(99,102,241,0.1)",
                  }}
                >
                  <span style={{
                    background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
                    color:"#fff", borderRadius:7,
                    width:24, height:24, flexShrink:0,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontWeight:800, fontSize:"0.72rem",
                  }}>{i+1}</span>
                  <p style={{ color:"#c7d2fe", margin:0, lineHeight:1.6, fontSize:"0.83rem" }}>{p}</p>
                </motion.div>
              ))}
            </div>
          </Card>
        )}

        {(data.risks||[]).length > 0 && (
          <Card>
            <div style={{ display:"flex", alignItems:"center", gap:"0.6rem", marginBottom:"1rem" }}>
              <div style={{
                width:28, height:28, borderRadius:7,
                background:"rgba(239,68,68,0.12)",
                border:"1px solid rgba(239,68,68,0.25)",
                display:"flex", alignItems:"center", justifyContent:"center",
                color:"#ef4444", fontWeight:900, fontSize:"0.75rem",
              }}>R</div>
              <h3 style={{ color:"#e2e8f0", fontWeight:700, fontSize:"0.95rem", margin:0 }}>
                Risk Register
              </h3>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
              <div style={{
                display:"grid", gridTemplateColumns:"1fr auto auto",
                gap:"0.5rem", padding:"0 0.5rem 0.4rem",
                borderBottom:"1px solid rgba(255,255,255,0.05)",
              }}>
                {["Risk","Likelihood","Impact"].map(h => (
                  <span key={h} style={{
                    color:"#374151", fontSize:"0.65rem",
                    fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em",
                  }}>{h}</span>
                ))}
              </div>
              {(data.risks||[]).map((r, i) => (
                <div key={i} style={{
                  display:"grid", gridTemplateColumns:"1fr auto auto",
                  gap:"0.5rem", alignItems:"center",
                  padding:"0.5rem 0.5rem",
                  background: i%2===0 ? "rgba(255,255,255,0.02)" : "transparent",
                  borderRadius:7,
                }}>
                  <span style={{ color:"#6b7280", fontSize:"0.78rem", lineHeight:1.4 }}>{r.risk}</span>
                  <RatingPill v={r.likelihood} />
                  <RatingPill v={r.impact} />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* SWOT insight summary — 2-col on mobile, 4-col on desktop */}
      <div style={{
        background:"rgba(10,10,28,0.6)",
        border:"1px solid rgba(255,255,255,0.05)",
        borderRadius:14, padding:"1.25rem 1.5rem",
        display:"grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",
        gap:"1rem", textAlign:"center",
      }}>
        {Q.map(q => (
          <div key={q.key}>
            <div style={{ color:q.color, fontWeight:900, fontSize:"1.6rem", lineHeight:1 }}>
              {(data[q.key]||[]).length}
            </div>
            <div style={{ color:"#374151", fontSize:"0.7rem", marginTop:"0.25rem", textTransform:"uppercase", letterSpacing:"0.08em" }}>
              {q.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RatingPill({ v="" }) {
  const color = v==="High" ? "#ef4444" : v==="Medium" ? "#f59e0b" : "#10b981";
  return (
    <span style={{
      background:`rgba(${hexRgb(color)},0.1)`,
      border:`1px solid rgba(${hexRgb(color)},0.25)`,
      color, borderRadius:100, padding:"0.15rem 0.5rem",
      fontSize:"0.68rem", fontWeight:700, whiteSpace:"nowrap",
    }}>{v}</span>
  );
}

function hexRgb(hex) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}

function Empty() {
  return <div style={{ color:"#374151", textAlign:"center", padding:"4rem" }}>No SWOT data available.</div>;
}
