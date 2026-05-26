import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MarketSection     from "./sections/MarketSection";
import CompetitorSection from "./sections/CompetitorSection";
import FundingSection    from "./sections/FundingSection";
import SwotSection       from "./sections/SwotSection";
import GtmSection        from "./sections/GtmSection";
import { useWindowWidth } from "../useWindowWidth";

const TABS = [
  { key:"market",      icon:"▲", label:"Market",      color:"#6366f1", sub:"TAM · SAM · SOM" },
  { key:"competitors", icon:"◈", label:"Competitors",  color:"#8b5cf6", sub:"Top 5 rivals" },
  { key:"funding",     icon:"◎", label:"Funding",      color:"#06b6d4", sub:"VC landscape" },
  { key:"swot",        icon:"⬡", label:"SWOT",         color:"#10b981", sub:"Strategy matrix" },
  { key:"gtm",         icon:"→", label:"GTM",          color:"#f59e0b", sub:"5-phase roadmap" },
];

export default function Dashboard({ analysis, onDownload, onReset }) {
  const width    = useWindowWidth();
  const isMobile = width < 640;
  const isTablet = width < 1024;

  const [active, setActive]       = useState("market");
  const [brandName, setBrandName] = useState("");
  const [showBrand, setShowBrand] = useState(false);
  const tab = TABS.find(t => t.key === active);

  return (
    <div style={{ minHeight:"100vh", background:"#050510", color:"#f1f5f9" }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .tab-btn { transition: all 0.2s ease !important; }
        .tab-btn:hover { background: rgba(255,255,255,0.04) !important; }
        .section-content { animation: fadeUp 0.35s ease; }
        .tab-bar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── Top Navbar ─────────────────────────────────────────────────────── */}
      <div style={{
        background:"rgba(5,5,16,0.98)",
        backdropFilter:"blur(24px)",
        borderBottom:"1px solid rgba(99,102,241,0.12)",
        padding: isMobile ? "0.65rem 1rem" : "0.85rem 2rem",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        position:"sticky", top:0, zIndex:100,
        boxShadow:"0 4px 30px rgba(0,0,0,0.3)",
        gap:"0.5rem",
      }}>
        {/* Logo + idea — click to go back to landing */}
        <div
          onClick={onReset}
          style={{ display:"flex", alignItems:"center", gap:"0.75rem", minWidth:0, flex:1, cursor:"pointer" }}
        >
          <div style={{
            width:34, height:34, borderRadius:9,
            background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:"0.95rem", fontWeight:900, color:"#fff",
            boxShadow:"0 4px 16px rgba(99,102,241,0.45)",
            flexShrink:0,
          }}>✦</div>
          {!isMobile && (
            <div style={{ minWidth:0 }}>
              <div style={{
                color:"#fff", fontWeight:800, fontSize:"0.95rem",
                letterSpacing:"-0.01em", lineHeight:1.1,
              }}>Drusti</div>
              <div style={{
                color:"#374151", fontSize:"0.68rem", marginTop:"0.15rem",
                maxWidth: isTablet ? 200 : 380, overflow:"hidden",
                textOverflow:"ellipsis", whiteSpace:"nowrap",
              }}>
                {analysis.startup_idea}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display:"flex", gap:"0.5rem", alignItems:"center", flexShrink:0 }}>
          <motion.button
            whileHover={{ scale:1.02, y:-1 }}
            whileTap={{ scale:0.97 }}
            onClick={() => setShowBrand(true)}
            style={{
              background:"linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)",
              border:"none", borderRadius:10, color:"#fff",
              padding: isMobile ? "0.5rem 0.75rem" : "0.55rem 1.3rem",
              fontSize: isMobile ? "0.75rem" : "0.82rem", fontWeight:700,
              cursor:"pointer",
              boxShadow:"0 4px 20px rgba(99,102,241,0.4)",
              letterSpacing:"0.01em",
              whiteSpace:"nowrap",
            }}>
            {isMobile ? "↓ Pitch" : "↓ Download Pitch Deck"}
          </motion.button>
          <button
            onClick={onReset}
            style={{
              background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:10, color:"#4b5563",
              padding: isMobile ? "0.5rem 0.65rem" : "0.55rem 1rem",
              fontSize: isMobile ? "0.75rem" : "0.82rem",
              cursor:"pointer", transition:"all 0.2s",
              whiteSpace:"nowrap",
            }}>
            {isMobile ? "←" : "← New"}
          </button>
        </div>
      </div>

      {/* ── Tab Bar ────────────────────────────────────────────────────────── */}
      <div className="tab-bar" style={{
        background:"rgba(5,5,16,0.95)",
        backdropFilter:"blur(12px)",
        borderBottom:"1px solid rgba(255,255,255,0.05)",
        padding:"0 0.5rem",
        display:"flex",
        overflowX:"auto",
        position:"sticky", top: isMobile ? 57 : 65, zIndex:99,
        scrollbarWidth:"none",
        WebkitOverflowScrolling:"touch",
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            className="tab-btn"
            onClick={() => setActive(t.key)}
            style={{
              background: active===t.key
                ? `rgba(${hexRgb(t.color)},0.08)`
                : "transparent",
              border:"none",
              borderBottom: active===t.key
                ? `2px solid ${t.color}`
                : "2px solid transparent",
              padding: isMobile ? "0.7rem 0.85rem" : "0.85rem 1.6rem",
              cursor:"pointer",
              display:"flex",
              flexDirection:"column",
              alignItems:"center",
              justifyContent:"center",
              gap:"0.18rem",
              minWidth: isMobile ? 72 : 110,
              borderRadius:"8px 8px 0 0",
              outline:"none",
              flexShrink:0,
            }}>
            <div style={{
              display:"flex", alignItems:"center",
              justifyContent:"center", gap:"0.35rem",
            }}>
              <span style={{
                fontSize: isMobile ? "0.8rem" : "0.85rem", fontWeight:900,
                color: active===t.key ? t.color : "#374151",
                lineHeight:1,
              }}>
                {t.icon}
              </span>
              <span style={{
                color: active===t.key ? t.color : "#4b5563",
                fontWeight: active===t.key ? 700 : 500,
                fontSize: isMobile ? "0.75rem" : "0.85rem",
                letterSpacing:"0.01em",
              }}>
                {isMobile ? t.label.split(" ")[0] : t.label}
              </span>
            </div>
            {!isMobile && (
              <span style={{
                color: active===t.key ? t.color+"90" : "#1f2937",
                fontSize:"0.62rem",
                textAlign:"center",
              }}>
                {t.sub}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Section Header ─────────────────────────────────────────────────── */}
      <div style={{
        padding: isMobile ? "1.25rem 1rem 0" : "1.75rem 2rem 0",
        maxWidth:1200, margin:"0 auto",
      }}>
        <motion.div
          key={active}
          initial={{ opacity:0, x:-8 }}
          animate={{ opacity:1, x:0 }}
          transition={{ duration:0.25 }}
          style={{
            display:"flex", alignItems:"center",
            gap:"0.75rem", marginBottom:"1.25rem",
            flexWrap:"wrap",
          }}
        >
          <div style={{
            width:40, height:40, borderRadius:11,
            background:`rgba(${hexRgb(tab.color)},0.12)`,
            border:`1px solid rgba(${hexRgb(tab.color)},0.25)`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:"1rem", fontWeight:900, color:tab.color,
            flexShrink:0,
          }}>
            {tab.icon}
          </div>
          <div>
            <h1 style={{
              margin:0, fontSize: isMobile ? "1.1rem" : "1.45rem", fontWeight:800,
              color:"#f1f5f9", letterSpacing:"-0.02em", lineHeight:1.1,
            }}>
              {tab.label}
            </h1>
            <p style={{
              margin:"0.2rem 0 0", color:"#374151",
              fontSize:"0.78rem", letterSpacing:"0.02em",
            }}>
              {tab.sub}
            </p>
          </div>

          <div style={{
            marginLeft:"auto",
            background:`rgba(${hexRgb(tab.color)},0.1)`,
            border:`1px solid rgba(${hexRgb(tab.color)},0.25)`,
            borderRadius:100, padding:"0.25rem 0.75rem",
            fontSize:"0.7rem", fontWeight:700,
            color:tab.color, letterSpacing:"0.06em",
            textTransform:"uppercase", whiteSpace:"nowrap",
          }}>
            {TABS.findIndex(t => t.key === active) + 1} / {TABS.length}
          </div>
        </motion.div>
      </div>

      {/* ── Section Content ─────────────────────────────────────────────────── */}
      <div
        className="section-content"
        key={active}
        style={{
          padding: isMobile ? "0 1rem 3rem" : "0 2rem 3rem",
          maxWidth:1200, margin:"0 auto",
        }}
      >
        {active==="market"      && <MarketSection     data={analysis.market}      />}
        {active==="competitors" && <CompetitorSection data={analysis.competitors} />}
        {active==="funding"     && <FundingSection    data={analysis.funding}     />}
        {active==="swot"        && <SwotSection       data={analysis.swot}        />}
        {active==="gtm"         && <GtmSection        data={analysis.gtm}         />}
      </div>

      {/* ── Download Modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showBrand && (
          <motion.div
            initial={{ opacity:0 }}
            animate={{ opacity:1 }}
            exit={{ opacity:0 }}
            style={{
              position:"fixed", inset:0,
              background:"rgba(0,0,0,0.75)",
              display:"flex", alignItems:"center", justifyContent:"center",
              zIndex:200, backdropFilter:"blur(10px)",
              padding:"1rem",
            }}
            onClick={e => e.target===e.currentTarget && setShowBrand(false)}
          >
            <motion.div
              initial={{ scale:0.88, opacity:0, y:20 }}
              animate={{ scale:1, opacity:1, y:0 }}
              exit={{ scale:0.88, opacity:0, y:20 }}
              transition={{ type:"spring", damping:20, stiffness:300 }}
              style={{
                background:"rgba(8,8,28,0.98)",
                border:"1px solid rgba(99,102,241,0.25)",
                borderRadius:20, padding: isMobile ? "1.75rem 1.25rem" : "2.5rem",
                width:"100%", maxWidth:420,
                boxShadow:"0 40px 100px rgba(0,0,0,0.7), 0 0 80px rgba(99,102,241,0.08)",
              }}
            >
              <div style={{
                width:56, height:56, borderRadius:16, margin:"0 auto 1.25rem",
                background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:"1.5rem",
                boxShadow:"0 8px 30px rgba(99,102,241,0.4)",
              }}>↓</div>

              <h3 style={{
                color:"#f1f5f9", textAlign:"center",
                margin:"0 0 0.5rem", fontSize:"1.2rem", fontWeight:800,
              }}>
                Download Pitch Deck
              </h3>
              <p style={{
                color:"#475569", textAlign:"center",
                fontSize:"0.82rem", marginBottom:"1.5rem", lineHeight:1.6,
              }}>
                Enter your brand name — it will appear on the cover slide.
              </p>

              <input
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                placeholder="e.g. Acme Inc."
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    onDownload(brandName || "Your Brand");
                    setShowBrand(false);
                  }
                }}
                style={{
                  width:"100%",
                  background:"rgba(255,255,255,0.04)",
                  border:"1px solid rgba(99,102,241,0.3)",
                  borderRadius:10, color:"#f1f5f9",
                  fontSize:"1rem", padding:"0.85rem 1rem",
                  outline:"none", boxSizing:"border-box",
                }}
              />

              <div style={{ display:"flex", gap:"0.75rem", marginTop:"1.25rem" }}>
                <motion.button
                  whileHover={{ scale:1.02 }}
                  whileTap={{ scale:0.97 }}
                  onClick={() => {
                    onDownload(brandName || "Your Brand");
                    setShowBrand(false);
                  }}
                  style={{
                    flex:1,
                    background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
                    border:"none", borderRadius:10, color:"#fff",
                    padding:"0.85rem", fontWeight:700,
                    cursor:"pointer", fontSize:"0.92rem",
                    boxShadow:"0 8px 30px rgba(99,102,241,0.35)",
                  }}>
                  Download PPTX
                </motion.button>
                <button
                  onClick={() => setShowBrand(false)}
                  style={{
                    flex:1, background:"transparent",
                    border:"1px solid rgba(255,255,255,0.07)",
                    borderRadius:10, color:"#4b5563",
                    padding:"0.85rem", cursor:"pointer",
                    fontSize:"0.92rem",
                  }}>
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function hexRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}