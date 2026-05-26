import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import Card from "./Card";
import { useWindowWidth } from "../../useWindowWidth";

const PHASE_COLORS = ["#6366f1","#8b5cf6","#06b6d4","#10b981","#f59e0b"];

export default function GtmSection({ data={} }) {
  const width    = useWindowWidth();
  const isMobile = width < 640;
  const isTablet = width < 1024;

  if (!data || !Object.keys(data).length) return <Empty />;

  const kpis    = data.kpis    || {};
  const budget  = data.budget  || [];
  const phases  = data.phases  || [];
  const pricing = data.pricing || [];
  const icp     = data.icp     || {};

  const mrrData = [
    { month:"M3",  mrr: Math.round((kpis.mrr_6month||0)*0.2)  },
    { month:"M6",  mrr: kpis.mrr_6month  || 0 },
    { month:"M9",  mrr: Math.round((kpis.mrr_12month||0)*0.6) },
    { month:"M12", mrr: kpis.mrr_12month || 0 },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1.25rem" }}>

      {/* Value prop */}
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
        style={{
          background:"linear-gradient(135deg, rgba(99,102,241,0.09), rgba(139,92,246,0.05))",
          border:"1px solid rgba(99,102,241,0.22)", borderRadius:16,
          padding: isMobile ? "1.1rem 1.25rem" : "1.4rem 1.75rem",
          position:"relative", overflow:"hidden",
        }}>
        <div style={{
          position:"absolute", top:-30, right:-30, width:140, height:140,
          background:"radial-gradient(circle, rgba(99,102,241,0.12), transparent)",
          borderRadius:"50%", pointerEvents:"none",
        }} />
        <div style={{ color:"#374151", fontSize:"0.68rem", textTransform:"uppercase",
          letterSpacing:"0.1em", marginBottom:"0.5rem" }}>Value Proposition</div>
        <p style={{ color:"#c7d2fe", fontSize: isMobile ? "0.95rem" : "1.08rem", fontStyle:"italic",
          margin:0, lineHeight:1.7, fontWeight:500 }}>
          "{data.value_proposition}"
        </p>
      </motion.div>

      {/* ICP + Pricing — stack on mobile */}
      <div style={{
        display:"grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap:"1.25rem",
      }}>
        {/* ICP */}
        <Card style={{ display:"flex", flexDirection:"column" }}>
          <h3 style={H3}>Ideal Customer Profile</h3>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.6rem", marginBottom:"0.75rem" }}>
            {[
              ["Company Size", icp.company_size, "#6366f1"],
              ["Industry",     icp.industry,     "#8b5cf6"],
              ["Geography",    icp.geography,    "#06b6d4"],
              ["Buyer Title",  icp.buyer_title,  "#10b981"],
            ].map(([label,value,color]) => (
              <div key={label} style={{
                background:`rgba(${hexRgb(color)},0.07)`,
                border:`1px solid rgba(${hexRgb(color)},0.18)`,
                borderRadius:10, padding:"0.75rem",
              }}>
                <div style={{ color:"#374151", fontSize:"0.62rem", marginBottom:"0.25rem",
                  textTransform:"uppercase", letterSpacing:"0.08em" }}>{label}</div>
                <div style={{ color, fontWeight:700, fontSize:"0.82rem", lineHeight:1.3 }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ height:1, background:"rgba(255,255,255,0.05)", marginBottom:"0.75rem" }} />

          <div style={{ marginBottom:"0.75rem" }}>
            <div style={{ color:"#374151", fontSize:"0.62rem", textTransform:"uppercase",
              letterSpacing:"0.08em", marginBottom:"0.45rem" }}>Pain Points</div>
            <div style={{ display:"flex", flexDirection:"column", gap:"0.4rem" }}>
              {(icp.pain_points||[]).map((p,i) => (
                <div key={i} style={{
                  background:"rgba(239,68,68,0.06)",
                  border:"1px solid rgba(239,68,68,0.15)",
                  borderLeft:"3px solid rgba(239,68,68,0.5)",
                  borderRadius:"0 8px 8px 0",
                  padding:"0.5rem 0.75rem",
                  color:"#fca5a5", fontSize:"0.82rem", lineHeight:1.4,
                  display:"flex", gap:"0.5rem", alignItems:"center",
                }}>
                  <span style={{ color:"#ef4444", fontSize:"0.7rem", flexShrink:0 }}>▸</span>
                  {p}
                </div>
              ))}
            </div>
          </div>

          <div style={{ height:1, background:"rgba(255,255,255,0.05)", marginBottom:"0.75rem" }} />

          <div>
            <div style={{ color:"#374151", fontSize:"0.62rem", textTransform:"uppercase",
              letterSpacing:"0.08em", marginBottom:"0.45rem" }}>Buying Signals</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"0.4rem" }}>
              {["Remote-first team", "HR budget approved", "Recent hiring surge",
                "High Glassdoor activity", "Slack-heavy org"].map((s,i) => (
                <span key={i} style={{
                  background:"rgba(99,102,241,0.08)",
                  border:"1px solid rgba(99,102,241,0.18)",
                  color:"#a5b4fc", borderRadius:8,
                  padding:"0.25rem 0.65rem", fontSize:"0.74rem",
                }}>{s}</span>
              ))}
            </div>
          </div>
        </Card>

        {/* Pricing */}
        <Card style={{ display:"flex", flexDirection:"column" }}>
          <h3 style={H3}>Pricing Tiers</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:"0.65rem", flex:1 }}>
            {pricing.map((tier,i) => (
              <motion.div key={i} whileHover={{ x:3 }}
                style={{
                  background: i===1
                    ? "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))"
                    : "rgba(255,255,255,0.03)",
                  border:`1px solid ${i===1 ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius:12, padding:"0.9rem 1rem",
                  cursor:"default", transition:"all 0.2s",
                  position:"relative",
                }}>
                {i===1 && (
                  <div style={{
                    position:"absolute", top:-9, right:12,
                    background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
                    color:"#fff", borderRadius:100, padding:"0.08rem 0.65rem",
                    fontSize:"0.6rem", fontWeight:800,
                    boxShadow:"0 3px 12px rgba(99,102,241,0.4)",
                  }}>★ POPULAR</div>
                )}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"0.65rem" }}>
                  <div>
                    <div style={{ color:"#475569", fontSize:"0.65rem", textTransform:"uppercase",
                      letterSpacing:"0.08em", marginBottom:"0.15rem" }}>{tier.tier}</div>
                    <div style={{ color:"#f1f5f9", fontWeight:900, fontSize:"1.2rem" }}>{tier.price}</div>
                  </div>
                  <div style={{
                    background:`rgba(${hexRgb(PHASE_COLORS[i])},0.1)`,
                    border:`1px solid rgba(${hexRgb(PHASE_COLORS[i])},0.25)`,
                    color:PHASE_COLORS[i], borderRadius:8,
                    padding:"0.15rem 0.55rem", fontSize:"0.65rem", fontWeight:700,
                  }}>
                    {i===0 ? "Entry" : i===1 ? "Growth" : "Scale"}
                  </div>
                </div>
                <div style={{ height:1, background:"rgba(255,255,255,0.05)", marginBottom:"0.55rem" }} />
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.2rem" }}>
                  {(tier.inclusions||[]).map((inc,j) => (
                    <div key={j} style={{ color:"#6b7280", fontSize:"0.74rem",
                      display:"flex", gap:"0.3rem", alignItems:"flex-start", lineHeight:1.4 }}>
                      <span style={{ color:"#10b981", flexShrink:0, marginTop:"0.05rem" }}>✓</span>{inc}
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>

      {/* GTM Channels — always exactly 3 */}
      {(data.channels||[]).length > 0 && (
        <Card>
          <h3 style={H3}>GTM Channels</h3>
          <div style={{
            display:"grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)",
            gap:"0.85rem",
          }}>
            {(data.channels||[]).slice(0,3).sort((a,b)=>a.priority-b.priority).map((ch,i) => (
              <div key={i} style={{
                background: i===0 ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
                border:`1px solid ${i===0 ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.05)"}`,
                borderRadius:12, padding:"1rem",
                display:"flex", flexDirection:"column", gap:"0.6rem",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:"0.65rem" }}>
                  <span style={{
                    background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
                    color:"#fff", borderRadius:"50%",
                    width:28, height:28, flexShrink:0,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontWeight:800, fontSize:"0.75rem",
                  }}>{ch.priority}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:"0.88rem", lineHeight:1.2 }}>{ch.name}</div>
                    {i===0 && (
                      <span style={{
                        background:"rgba(99,102,241,0.15)", color:"#818cf8",
                        borderRadius:5, padding:"0.05rem 0.45rem",
                        fontSize:"0.62rem", fontWeight:700,
                      }}>Primary Channel</span>
                    )}
                  </div>
                </div>

                <div style={{ height:1, background:"rgba(255,255,255,0.05)" }} />

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem" }}>
                  <div style={{
                    background:"rgba(16,185,129,0.07)",
                    border:"1px solid rgba(16,185,129,0.15)",
                    borderRadius:7, padding:"0.45rem 0.6rem",
                  }}>
                    <div style={{ color:"#374151", fontSize:"0.6rem", textTransform:"uppercase",
                      letterSpacing:"0.07em" }}>CAC</div>
                    <div style={{ color:"#10b981", fontWeight:700, fontSize:"0.82rem" }}>{ch.cac}</div>
                  </div>
                  <div style={{
                    background:"rgba(99,102,241,0.07)",
                    border:"1px solid rgba(99,102,241,0.15)",
                    borderRadius:7, padding:"0.45rem 0.6rem",
                  }}>
                    <div style={{ color:"#374151", fontSize:"0.6rem", textTransform:"uppercase",
                      letterSpacing:"0.07em" }}>Priority</div>
                    <div style={{ color:"#6366f1", fontWeight:700, fontSize:"0.82rem" }}>
                      {i===0 ? "High" : i===1 ? "Medium" : "Low"}
                    </div>
                  </div>
                </div>

                <div style={{ color:"#374151", fontSize:"0.72rem", lineHeight:1.5 }}>
                  {i===0
                    ? "Primary channel — focus majority of early marketing budget here."
                    : i===1
                    ? "Secondary channel — build organic presence and brand awareness."
                    : "Tertiary channel — targeted outreach for supplementary growth."}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 5-Phase roadmap — responsive grid */}
      <Card>
        <h3 style={H3}>5-Phase GTM Roadmap</h3>
        <div style={{
          display:"grid",
          gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(5,1fr)",
          gap:"0.65rem",
        }}>
          {phases.map((ph,i) => (
            <motion.div key={i}
              initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:i*0.08 }}
              whileHover={{ y:-3 }}
              style={{
                background:"rgba(10,10,28,0.9)",
                border:`1px solid rgba(${hexRgb(PHASE_COLORS[i%5])},0.22)`,
                borderTop:`3px solid ${PHASE_COLORS[i%5]}`,
                borderRadius:12, padding:"0.9rem 0.85rem",
                cursor:"default", transition:"all 0.3s ease",
              }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.4rem" }}>
                <span style={{ color:PHASE_COLORS[i%5], fontWeight:800, fontSize:"0.78rem" }}>P{ph.phase}</span>
                <span style={{ color:"#1f2937", fontSize:"0.62rem" }}>{ph.months}</span>
              </div>
              <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:"0.82rem",
                marginBottom:"0.6rem", lineHeight:1.3 }}>{ph.title}</div>
              <div style={{ height:1, background:`rgba(${hexRgb(PHASE_COLORS[i%5])},0.15)`, marginBottom:"0.5rem" }} />
              <div style={{ marginBottom:"0.5rem" }}>
                <div style={{ color:PHASE_COLORS[i%5], fontSize:"0.6rem", fontWeight:700,
                  textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"0.25rem" }}>Goals</div>
                {(ph.goals||[]).map((g,j) => (
                  <div key={j} style={{ color:"#475569", fontSize:"0.72rem",
                    marginBottom:"0.18rem", lineHeight:1.35 }}>• {g}</div>
                ))}
              </div>
              <div style={{ marginBottom:"0.5rem" }}>
                <div style={{ color:"#10b981", fontSize:"0.6rem", fontWeight:700,
                  textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"0.25rem" }}>Metrics</div>
                {(ph.metrics||[]).map((m,j) => (
                  <div key={j} style={{ color:"#374151", fontSize:"0.7rem",
                    marginBottom:"0.18rem", lineHeight:1.35 }}>• {m}</div>
                ))}
              </div>
              {ph.activities && ph.activities.length > 0 && (
                <div>
                  <div style={{ color:"#8b5cf6", fontSize:"0.6rem", fontWeight:700,
                    textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"0.25rem" }}>Activities</div>
                  {(ph.activities||[]).map((a,j) => (
                    <div key={j} style={{ color:"#374151", fontSize:"0.68rem",
                      marginBottom:"0.15rem", lineHeight:1.35 }}>• {a}</div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </Card>

      {/* KPIs + Budget — stack on mobile */}
      <div style={{
        display:"grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap:"1.25rem",
      }}>
        <Card>
          <h3 style={H3}>MRR Growth Projection</h3>
          <div style={{ display:"flex", gap:"0.75rem", marginBottom:"0.75rem", flexWrap:"wrap" }}>
            {[
              ["12M Revenue", `$${(kpis.revenue_12month||0).toLocaleString()}`, "#f59e0b"],
              ["MRR (12M)",   `$${(kpis.mrr_12month||0).toLocaleString()}`,    "#6366f1"],
              ["North Star",  kpis.north_star||"—",                             "#10b981"],
            ].map(([l,v,c]) => (
              <div key={l} style={{
                background:`rgba(${hexRgb(c)},0.07)`,
                border:`1px solid rgba(${hexRgb(c)},0.15)`,
                borderRadius:9, padding:"0.5rem 0.85rem", flex:1, minWidth:80,
              }}>
                <div style={{ color:c, fontWeight:900, fontSize:"1rem", lineHeight:1 }}>{v}</div>
                <div style={{ color:"#374151", fontSize:"0.65rem", marginTop:"0.15rem" }}>{l}</div>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={mrrData}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="month" stroke="#1f2937" tick={{ fill:"#374151", fontSize:11 }} />
              <YAxis stroke="#1f2937" tick={{ fill:"#374151", fontSize:11 }} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                formatter={v=>`$${v.toLocaleString()}`}
                contentStyle={{ background:"#1a1a3e", border:"1px solid rgba(99,102,241,0.35)", borderRadius:8 }}
                labelStyle={{ color:"#ffffff" }}
                itemStyle={{ color:"#ffffff" }}
              />
              <Area type="monotone" dataKey="mrr" stroke="#6366f1" strokeWidth={2.5}
                fill="url(#mrrGrad)" dot={{ fill:"#6366f1", r:4, strokeWidth:0 }} />
            </AreaChart>
          </ResponsiveContainer>
          {/* KPI micro-cards — 2-col on mobile, 4-col on desktop */}
          <div style={{
            display:"grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",
            gap:"0.5rem", marginTop:"0.75rem",
          }}>
            {[
              ["CAC",    `$${(kpis.cac||0).toLocaleString()}`,  "#ef4444"],
              ["LTV",    `$${(kpis.ltv||0).toLocaleString()}`,  "#10b981"],
              ["Churn",  `${kpis.churn_target||0}%`,             "#f59e0b"],
              ["MRR 6M", `$${(kpis.mrr_6month||0).toLocaleString()}`, "#8b5cf6"],
            ].map(([l,v,c]) => (
              <div key={l} style={{
                background:`rgba(${hexRgb(c)},0.07)`,
                borderRadius:8, padding:"0.45rem 0.6rem",
                border:`1px solid rgba(${hexRgb(c)},0.12)`,
              }}>
                <div style={{ color:"#374151", fontSize:"0.62rem", textTransform:"uppercase",
                  letterSpacing:"0.07em" }}>{l}</div>
                <div style={{ color:c, fontWeight:700, fontSize:"0.88rem" }}>{v}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 style={H3}>Budget Allocation</h3>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={budget} cx="50%" cy="50%"
                outerRadius={75} innerRadius={40}
                dataKey="percentage" nameKey="category" paddingAngle={3}>
                {budget.map((_,i) => (
                  <Cell key={i} fill={PHASE_COLORS[i%5]}
                    style={{ filter:`drop-shadow(0 0 4px ${PHASE_COLORS[i%5]}60)` }} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v,name)=>[`${v}%`, name]}
                contentStyle={{ background:"#1a1a3e", border:"1px solid rgba(99,102,241,0.35)", borderRadius:8 }}
                labelStyle={{ color:"#ffffff", fontWeight:700 }}
                itemStyle={{ color:"#ffffff" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
            {budget.map((b,i) => (
              <div key={i}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.2rem" }}>
                  <span style={{ color:"#6b7280", fontSize:"0.75rem" }}>{b.category}</span>
                  <span style={{ color:PHASE_COLORS[i%5], fontWeight:700, fontSize:"0.75rem" }}>{b.percentage}%</span>
                </div>
                <div style={{ height:4, background:"rgba(255,255,255,0.05)", borderRadius:2 }}>
                  <div style={{
                    height:"100%", borderRadius:2,
                    width:`${b.percentage}%`,
                    background:PHASE_COLORS[i%5],
                    boxShadow:`0 0 6px ${PHASE_COLORS[i%5]}80`,
                  }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{
            marginTop:"1rem", padding:"0.75rem", borderRadius:10,
            background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.12)",
          }}>
            <div style={{ color:"#374151", fontSize:"0.65rem", textTransform:"uppercase",
              letterSpacing:"0.08em", marginBottom:"0.2rem" }}>North Star Metric</div>
            <div style={{ color:"#a5b4fc", fontWeight:700, fontSize:"0.9rem" }}>{kpis.north_star}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

const H3 = { color:"#e2e8f0", fontWeight:700, fontSize:"0.95rem", marginBottom:"0.85rem", marginTop:0 };

function hexRgb(hex) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}

function Empty() {
  return <div style={{ color:"#374151", textAlign:"center", padding:"4rem" }}>No GTM data available.</div>;
}