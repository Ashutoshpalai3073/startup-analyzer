import { motion } from "framer-motion";
import Card from "./Card";
import { useWindowWidth } from "../../useWindowWidth";

export default function CompetitorSection({ data = {} }) {
  const width = useWindowWidth();
  const isMobile = width < 640;

  if (!data || !Object.keys(data).length) return <Empty />;
  const competitors = data.competitors || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* Overview stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",
        gap: "0.85rem",
      }}>
        {[
          ["Market Type",  data.landscape_type   || "—", "#8b5cf6"],
          ["Competition",  data.competition_level || "—", "#06b6d4"],
          ["Competitors",  competitors.length,            "#f59e0b"],
          ["Gaps Found",   (data.gaps || []).length,      "#10b981"],
        ].map(([label, value, color], i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            whileHover={{ y: -3 }}
            style={{
              background: `linear-gradient(135deg, rgba(${hexRgb(color)},0.08), rgba(${hexRgb(color)},0.03))`,
              border: `1px solid rgba(${hexRgb(color)},0.2)`,
              borderRadius: 14, padding: "0.9rem 1.1rem",
              cursor: "default", transition: "all 0.3s",
            }}>
            <div style={{ color: "#374151", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
            <div style={{ color, fontWeight: 800, fontSize: "1.25rem", textTransform: "capitalize", marginTop: "0.2rem" }}>{value}</div>
          </motion.div>
        ))}
      </div>

      {/* Competitor cards */}
      {competitors.map((c, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          style={{
            background: "rgba(10,10,28,0.85)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderLeft: `3px solid ${["#6366f1","#8b5cf6","#06b6d4","#10b981","#f59e0b"][i % 5]}`,
            borderRadius: 14, padding: "1.25rem",
          }}
        >
          {/* ── Header row: name + chips ── */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",          /* ← vertically centers chips with the name block */
            flexWrap: "wrap",
            gap: "0.75rem",
            marginBottom: "0.85rem",
          }}>
            <div>
              <h3 style={{ color: "#f1f5f9", fontWeight: 800, margin: "0 0 0.2rem", fontSize: "1.05rem" }}>{c.name}</h3>
              <span style={{ color: "#374151", fontSize: "0.78rem" }}>Founded {c.founded} · {c.target_customer}</span>
            </div>

            {/* ── Chips wrapper ── */}
            <div style={{
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
              alignItems: "center",        /* ← keeps chips aligned with each other */
            }}>
              <Chip color="#10b981">{c.funding}</Chip>
              <Chip color="#f59e0b">{c.pricing}</Chip>
            </div>
          </div>

          <p style={{ color: "#475569", fontSize: "0.85rem", marginBottom: "1rem", lineHeight: 1.6 }}>{c.product}</p>

          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: "0.75rem",
          }}>
            <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.12)", borderRadius: 10, padding: "0.85rem" }}>
              <div style={{ color: "#10b981", fontWeight: 700, fontSize: "0.75rem", marginBottom: "0.5rem", textTransform: "uppercase" }}>✓ USPs</div>
              {(c.usps || []).map((u, j) => (
                <div key={j} style={{ color: "#d1fae5", fontSize: "0.8rem", marginBottom: "0.3rem" }}>• {u}</div>
              ))}
            </div>
            <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 10, padding: "0.85rem" }}>
              <div style={{ color: "#ef4444", fontWeight: 700, fontSize: "0.75rem", marginBottom: "0.5rem", textTransform: "uppercase" }}>✗ Weaknesses</div>
              {(c.weaknesses || []).map((w, j) => (
                <div key={j} style={{ color: "#fecaca", fontSize: "0.8rem", marginBottom: "0.3rem" }}>• {w}</div>
              ))}
            </div>
          </div>
        </motion.div>
      ))}

      {/* Gaps */}
      {(data.gaps || []).length > 0 && (
        <Card glow color="#6366f1">
          <h3 style={H3}>◎ Market Gaps We Can Win</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {(data.gaps || []).map((g, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                style={{
                  background: "rgba(99,102,241,0.06)",
                  borderLeft: "3px solid #6366f1",
                  borderRadius: "0 10px 10px 0",
                  padding: "0.75rem 1rem",
                  color: "#c7d2fe", fontSize: "0.88rem", lineHeight: 1.55,
                }}>{g}</motion.div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   Chip — text is now perfectly centred
───────────────────────────────────────── */
function Chip({ children, color }) {
  return (
    <span style={{
      display: "inline-flex",            /* ← flex so align/justify work on the span */
      alignItems: "center",              /* ← vertical centre */
      justifyContent: "center",          /* ← horizontal centre */
      background: `rgba(${hexRgb(color)},0.1)`,
      border: `1px solid rgba(${hexRgb(color)},0.25)`,
      color,
      borderRadius: 100,
      padding: "0.35rem 0.85rem",        /* ← slightly taller so pill looks balanced */
      fontSize: "0.78rem",
      fontWeight: 600,
      lineHeight: 1,                     /* ← removes inherited line-height gaps */
      whiteSpace: "nowrap",              /* ← prevents chip text from wrapping */
    }}>{children}</span>
  );
}

/* ── Shared styles & helpers ── */
const H3 = { color: "#e2e8f0", fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.85rem", marginTop: 0 };

function hexRgb(hex) {
  return `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`;
}

function Empty() {
  return <div style={{ color: "#374151", textAlign: "center", padding: "4rem" }}>No competitor data available.</div>;
}