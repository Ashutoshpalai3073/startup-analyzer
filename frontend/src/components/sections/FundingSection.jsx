import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import Card from "./Card";
import { useWindowWidth } from "../../useWindowWidth";

const STAGE_COLORS = {
  "Seed":"#10b981", "Series A":"#6366f1", "Series B":"#8b5cf6",
  "Series C":"#06b6d4", "Series D":"#f59e0b", "Series E":"#ef4444",
  "Series F":"#ec4899",
};

// Truncate long strings for chart axis labels
function truncate(str, n) {
  if (!str) return "";
  return str.length > n ? str.slice(0, n).trimEnd() + "…" : str;
}

export default function FundingSection({ data={} }) {
  const width    = useWindowWidth();
  const isMobile = width < 640;
  const isTablet = width < 1024;

  if (!data || !Object.keys(data).length) return <Empty />;

  const sentiment  = (data.sentiment||"neutral").toLowerCase();
  const sentColor  = sentiment==="bullish" ? "#10b981" : sentiment==="bearish" ? "#ef4444" : "#f59e0b";
  const rounds     = data.rounds   || [];
  const vcs        = data.vcs      || [];
  const rec        = data.recommendations || {};
  const metrics    = data.investor_metrics || {};

  // FIX 1 — separate display label (truncated) from full name (for tooltip)
  const yAxisMaxChars = isMobile ? 11 : isTablet ? 14 : 18;
  const chartData = rounds.map(r => ({
    company:  r.company,                               // full name → used in tooltip
    label:    truncate(r.company, yAxisMaxChars),      // short label → shown on axis
    amount:   parseFloat((r.amount||"0").replace(/[^0-9.]/g,"")),
    stage:    r.stage,
  }));

  // FIX 2 — dynamic height: 42px per bar + 40px for axes, minimum 200px
  const chartHeight = Math.max(200, rounds.length * 42 + 40);

  // FIX 3 — y-axis wide enough to fit the truncated label at the chosen font size
  //          ~7px per char is a safe estimate at fontSize 10
  const yAxisWidth = Math.min(
    isMobile ? 90 : 120,
    yAxisMaxChars * 7 + 8
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1.25rem" }}>

      {/* Sentiment hero — stack on mobile */}
      <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
        style={{
          background:`linear-gradient(135deg, rgba(${hexRgb(sentColor)},0.07), rgba(${hexRgb(sentColor)},0.02))`,
          border:`1px solid rgba(${hexRgb(sentColor)},0.18)`,
          borderRadius:16, padding: isMobile ? "1.25rem" : "1.4rem 1.75rem",
          display:"grid",
          gridTemplateColumns: isMobile ? "1fr" : "auto 1px 1fr auto",
          gap: isMobile ? "1rem" : "1.5rem",
          alignItems:"center",
        }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ color:"#374151", fontSize:"0.68rem", textTransform:"uppercase",
            letterSpacing:"0.1em", marginBottom:"0.4rem" }}>Investor Sentiment</div>
          <div style={{
            width:52, height:52, borderRadius:"50%", margin:"0 auto 0.4rem",
            background:`rgba(${hexRgb(sentColor)},0.15)`,
            border:`2px solid rgba(${hexRgb(sentColor)},0.35)`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:"1.3rem", fontWeight:900, color:sentColor,
          }}>
            {sentiment==="bullish" ? "↑" : sentiment==="bearish" ? "↓" : "→"}
          </div>
          <div style={{ color:sentColor, fontWeight:800, fontSize:"1rem", textTransform:"capitalize" }}>{sentiment}</div>
        </div>

        {!isMobile && <div style={{ width:1, height:70, background:"rgba(255,255,255,0.06)" }} />}

        <div>
          <div style={{ color:"#f59e0b", fontWeight:900, fontSize:"1.6rem", marginBottom:"0.2rem", lineHeight:1 }}>
            {data.total_investment}
          </div>
          <div style={{ color:"#374151", fontSize:"0.72rem", marginBottom:"0.6rem" }}>Total VC Investment (3 years)</div>
          <p style={{ color:"#475569", fontSize:"0.85rem", lineHeight:1.65, margin:0 }}>{data.overview}</p>
        </div>

        {/* Quick stats */}
        <div style={{
          display:"grid",
          gridTemplateColumns: isMobile ? "repeat(3,1fr)" : "1fr",
          gap:"0.5rem",
        }}>
          {[
            ["Rounds", rounds.length],
            ["VCs",     vcs.length],
            ["Stage",   rec.ideal_stage||"—"],
          ].map(([label,val]) => (
            <div key={label} style={{
              background:"rgba(255,255,255,0.04)", borderRadius:9,
              padding:"0.45rem 0.65rem", textAlign:"center",
            }}>
              <div style={{ color:"#f1f5f9", fontWeight:700, fontSize:"0.95rem" }}>{val}</div>
              <div style={{ color:"#374151", fontSize:"0.65rem" }}>{label}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Rounds table + bar chart — stack on mobile */}
      <div style={{
        display:"grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap:"1.25rem",
      }}>
        <Card>
          <h3 style={H3}>Recent Funding Rounds</h3>
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:300 }}>
              <thead>
                <tr>
                  {["Company","Stage","Amount","Year"].map(h => (
                    <th key={h} style={{
                      color:"#374151", fontWeight:700, fontSize:"0.68rem",
                      padding:"0.45rem 0.6rem", textAlign:"left",
                      textTransform:"uppercase", letterSpacing:"0.08em",
                      borderBottom:"1px solid rgba(99,102,241,0.1)",
                      whiteSpace:"nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rounds.map((r,i) => (
                  <motion.tr key={i}
                    initial={{ opacity:0 }} animate={{ opacity:1 }}
                    transition={{ delay:i*0.05 }}
                    style={{
                      borderBottom:"1px solid rgba(255,255,255,0.03)",
                      background: i%2===0 ? "transparent" : "rgba(255,255,255,0.015)",
                    }}>
                    <td style={TD}><b style={{ color:"#e2e8f0" }}>{r.company}</b></td>
                    <td style={TD}>
                      <span style={{
                        background:`rgba(${hexRgb(STAGE_COLORS[r.stage]||"#6366f1")},0.12)`,
                        color: STAGE_COLORS[r.stage]||"#8b5cf6",
                        borderRadius:6, padding:"0.1rem 0.45rem",
                        fontSize:"0.7rem", fontWeight:700, whiteSpace:"nowrap",
                      }}>{r.stage}</span>
                    </td>
                    <td style={TD}><span style={{ color:"#10b981", fontWeight:700 }}>{r.amount}</span></td>
                    <td style={TD}>{r.year}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h3 style={H3}>Funding Raised by Competitors ($M)</h3>
          {/* FIX 2: height scales with number of rows */}
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={chartData} layout="vertical" margin={{ top:0, right:16, bottom:0, left:0 }}>
              <XAxis
                type="number"
                stroke="#1f2937"
                tick={{ fill:"#475569", fontSize:10 }}
                tickFormatter={v=>`$${v}M`}
              />
              {/* FIX 1 & 3: use truncated `label` key, computed width */}
              <YAxis
                type="category"
                dataKey="label"
                stroke="#1f2937"
                tick={{ fill:"#475569", fontSize:10 }}
                width={yAxisWidth}
              />
              <Tooltip
                /* Show full company name in tooltip, not the truncated label */
                labelFormatter={(_label, payload) =>
                  payload?.[0]?.payload?.company ?? _label
                }
                formatter={v=>[`$${v}M`, "Amount"]}
                contentStyle={{ background:"#1a1a3e", border:"1px solid rgba(99,102,241,0.35)", borderRadius:8 }}
                labelStyle={{ color:"#ffffff" }}
                itemStyle={{ color:"#ffffff" }}
              />
              <Bar dataKey="amount" radius={[0,4,4,0]}>
                {chartData.map((entry,i) => (
                  <Cell key={i} fill={STAGE_COLORS[entry.stage]||"#6366f1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* VCs + metrics + recommendation — responsive grid */}
      <div style={{
        display:"grid",
        gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr",
        gap:"1.25rem",
      }}>
        <Card>
          <h3 style={H3}>Active VCs in This Space</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:"0.6rem" }}>
            {vcs.map((vc,i) => (
              <motion.div key={i}
                initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }}
                transition={{ delay:i*0.07 }}
                style={{
                  background:"rgba(99,102,241,0.05)",
                  border:"1px solid rgba(99,102,241,0.1)",
                  borderRadius:10, padding:"0.8rem",
                }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.3rem", gap:"0.5rem", flexWrap:"wrap" }}>
                  <span style={{ color:"#6366f1", fontWeight:700, fontSize:"0.85rem" }}>{vc.name}</span>
                  <span style={{
                    background:"rgba(16,185,129,0.1)", color:"#10b981",
                    fontSize:"0.68rem", fontWeight:700,
                    borderRadius:6, padding:"0.1rem 0.45rem", whiteSpace:"nowrap",
                  }}>{vc.check_size}</span>
                </div>
                <div style={{ color:"#475569", fontSize:"0.75rem", lineHeight:1.5 }}>{vc.thesis}</div>
              </motion.div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 style={H3}>Key Investor Metrics</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:"0" }}>
            {Object.entries(metrics).map(([k,v],i) => (
              <div key={k} style={{
                display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"0.6rem 0",
                borderBottom:"1px solid rgba(255,255,255,0.04)",
                gap:"0.5rem",
              }}>
                <span style={{
                  color:"#374151", fontSize:"0.72rem",
                  textTransform:"uppercase", letterSpacing:"0.07em",
                }}>{k.replace(/_/g," ")}</span>
                <span style={{ color:"#c7d2fe", fontSize:"0.82rem", fontWeight:600, textAlign:"right" }}>{v}</span>
              </div>
            ))}
          </div>

          {rounds[0] && (
            <div style={{
              marginTop:"1rem", padding:"0.75rem",
              background:"rgba(99,102,241,0.06)",
              borderRadius:9, border:"1px solid rgba(99,102,241,0.12)",
            }}>
              <div style={{ color:"#374151", fontSize:"0.68rem", textTransform:"uppercase",
                letterSpacing:"0.08em", marginBottom:"0.25rem" }}>Top Lead Investor</div>
              <div style={{ color:"#a5b4fc", fontWeight:700 }}>{rounds[0].investor}</div>
              <div style={{ color:"#374151", fontSize:"0.72rem" }}>{rounds[0].company} · {rounds[0].stage}</div>
            </div>
          )}
        </Card>

        <Card glow color="#f59e0b">
          <h3 style={{ ...H3, color:"#f59e0b" }}>Fundraising Recommendation</h3>
          <div style={{
            background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)",
            borderRadius:10, padding:"0.85rem", marginBottom:"1rem",
          }}>
            <div style={{ color:"#f59e0b", fontWeight:900, fontSize:"1.25rem", lineHeight:1 }}>
              {rec.ideal_stage}
            </div>
            <div style={{ color:"#fde68a", fontWeight:700, fontSize:"1rem", marginTop:"0.2rem" }}>
              {rec.round_size}
            </div>
          </div>
          <div style={{ color:"#374151", fontSize:"0.68rem", textTransform:"uppercase",
            letterSpacing:"0.08em", marginBottom:"0.5rem" }}>Top VCs to approach</div>
          {(rec.top_vcs||[]).map((v,i) => (
            <div key={i} style={{
              color:"#fde68a", fontSize:"0.82rem", marginBottom:"0.35rem",
              paddingLeft:"0.6rem", borderLeft:"2px solid rgba(245,158,11,0.4)",
              lineHeight:1.5,
            }}>
              {v}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

const H3 = { color:"#e2e8f0", fontWeight:700, fontSize:"0.95rem", marginBottom:"0.75rem", marginTop:0 };
const TD = { color:"#6b7280", padding:"0.6rem 0.6rem", fontSize:"0.82rem", whiteSpace:"nowrap" };

function hexRgb(hex) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}

function Empty() {
  return <div style={{ color:"#374151", textAlign:"center", padding:"4rem" }}>No funding data available.</div>;
}