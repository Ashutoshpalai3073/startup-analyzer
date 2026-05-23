import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { motion } from "framer-motion";
import Card from "./Card";
import { useWindowWidth } from "../../useWindowWidth";

const COLORS = ["#6366f1","#8b5cf6","#06b6d4"];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:"#1a1a3e", border:"1px solid rgba(99,102,241,0.35)",
      borderRadius:10, padding:"0.6rem 0.9rem", fontSize:"0.82rem",
      boxShadow:"0 8px 30px rgba(0,0,0,0.4)",
    }}>
      {label && <div style={{ color:"#94a3b8", marginBottom:"0.25rem" }}>{label}</div>}
      {payload.map((p,i) => (
        <div key={i} style={{ color:"#ffffff", fontWeight:700 }}>
          {p.name}: <span style={{ color:p.color||"#6366f1" }}>
            {typeof p.value === "number" ? `$${p.value}B` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function MarketSection({ data={} }) {
  const width    = useWindowWidth();
  const isMobile = width < 640;
  const isTablet = width < 1024;

  if (!data || !Object.keys(data).length) return <Empty />;

  const tam = data.tam?.value || 0;
  const sam = data.sam?.value || 0;
  const som = data.som?.value || 0;

  const tamSamSom = [
    { name:"TAM", value:tam },
    { name:"SAM", value:sam },
    { name:"SOM", value:som },
  ];

  const projections = [
    { year:"Current", value: data.current_market_size || 0 },
    { year:"5-Year",  value: data.five_year_projection || 0 },
    { year:"10-Year", value: data.ten_year_projection  || 0 },
  ];

  const riskColors = {
    regulatory:"#ef4444", competitive:"#f59e0b",
    market:"#8b5cf6", technology:"#06b6d4", operational:"#10b981",
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1.25rem" }}>

      {/* Top metric cards — 2-col on mobile, 4-col on desktop */}
      <div style={{
        display:"grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",
        gap:"0.85rem",
      }}>
        {[
          { label:"TAM",  value:`$${tam}B`,      sub: data.tam?.reasoning?.substring(0,55)+"…", color:"#6366f1" },
          { label:"SAM",  value:`$${sam}B`,      sub: data.sam?.reasoning?.substring(0,55)+"…", color:"#8b5cf6" },
          { label:"SOM",  value:`$${som}B`,      sub: data.som?.reasoning?.substring(0,55)+"…", color:"#06b6d4" },
          { label:"CAGR", value:`${data.cagr}%`, sub:"Compound Annual Growth Rate",              color:"#f59e0b" },
        ].map((m,i) => (
          <motion.div key={i}
            initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
            transition={{ delay:i*0.07 }}
            whileHover={{ y:-3 }}
            style={{
              background:`linear-gradient(135deg, rgba(${hexRgb(m.color)},0.09), rgba(${hexRgb(m.color)},0.03))`,
              border:`1px solid rgba(${hexRgb(m.color)},0.2)`,
              borderRadius:14, padding: isMobile ? "0.85rem" : "1.1rem 1.2rem",
              cursor:"default", transition:"all 0.3s ease",
            }}
          >
            <div style={{ color:"#475569", fontSize:"0.68rem", fontWeight:700,
              textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"0.4rem" }}>{m.label}</div>
            <div style={{ color:m.color, fontWeight:900, fontSize: isMobile ? "1.5rem" : "1.9rem", lineHeight:1, marginBottom:"0.4rem" }}>{m.value}</div>
            <div style={{ color:"#374151", fontSize:"0.7rem", lineHeight:1.45 }}>{m.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts row — stack on mobile */}
      <div style={{
        display:"grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap:"1.25rem",
      }}>
        <Card>
          <h3 style={H3}>Market Share Breakdown</h3>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={tamSamSom} cx="50%" cy="50%"
                innerRadius={52} outerRadius={82}
                dataKey="value" paddingAngle={3}>
                {tamSamSom.map((_,i) => (
                  <Cell key={i} fill={COLORS[i]}
                    style={{ filter:`drop-shadow(0 0 6px ${COLORS[i]}60)` }} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={v => <span style={{ color:"#94a3b8", fontSize:"0.78rem" }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", flexDirection:"column", gap:"0.4rem", marginTop:"0.5rem" }}>
            {tamSamSom.map((item,i) => (
              <div key={i} style={{
                display:"flex", gap:"0.5rem", alignItems:"flex-start",
                padding:"0.4rem 0.65rem",
                background:`rgba(${hexRgb(COLORS[i])},0.06)`,
                borderRadius:7, borderLeft:`2px solid ${COLORS[i]}`,
              }}>
                <span style={{ color:COLORS[i], fontWeight:700, fontSize:"0.72rem",
                  flexShrink:0, marginTop:"0.1rem" }}>{item.name}</span>
                <span style={{ color:"#374151", fontSize:"0.72rem", lineHeight:1.4 }}>
                  {data[item.name.toLowerCase()]?.reasoning || ""}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 style={H3}>Growth Trajectory ($B)</h3>
          <div style={{ display:"flex", gap:"0.75rem", marginBottom:"0.75rem", flexWrap:"wrap" }}>
            {[
              [data.cagr+"%", "CAGR", "#f59e0b"],
              ["$"+data.five_year_projection+"B", "5-Year", "#10b981"],
              ["$"+data.ten_year_projection+"B", "10-Year", "#6366f1"],
            ].map(([val,label,color]) => (
              <div key={label} style={{
                background:`rgba(${hexRgb(color)},0.07)`,
                border:`1px solid rgba(${hexRgb(color)},0.15)`,
                borderRadius:9, padding:"0.5rem 0.85rem", flex:1, textAlign:"center",
                minWidth:70,
              }}>
                <div style={{ color, fontWeight:900, fontSize:"1.1rem", lineHeight:1 }}>{val}</div>
                <div style={{ color:"#374151", fontSize:"0.65rem", marginTop:"0.15rem" }}>{label}</div>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={175}>
            <AreaChart data={projections}>
              <defs>
                <linearGradient id="mktGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="year" stroke="#1f2937" tick={{ fill:"#475569", fontSize:11 }} />
              <YAxis stroke="#1f2937" tick={{ fill:"#475569", fontSize:11 }} tickFormatter={v=>`$${v}B`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5}
                fill="url(#mktGrad)" dot={{ fill:"#6366f1", r:5, strokeWidth:0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Overview + drivers — stack on mobile */}
      <div style={{
        display:"grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap:"1.25rem",
      }}>
        <Card>
          <h3 style={H3}>Market Overview</h3>
          <p style={{ color:"#64748b", lineHeight:1.75, margin:"0 0 1rem", fontSize:"0.88rem" }}>{data.overview}</p>
          <div style={{
            display:"flex", alignItems:"flex-start", gap:"0.5rem",
            padding:"0.75rem 1rem",
            background:"rgba(99,102,241,0.06)",
            borderRadius:10, border:"1px solid rgba(99,102,241,0.12)",
          }}>
            <span style={{ color:"#6366f1", fontSize:"0.72rem", fontWeight:700,
              whiteSpace:"nowrap", marginTop:"0.1rem" }}>PROBLEM</span>
            <span style={{ color:"#94a3b8", fontSize:"0.85rem", lineHeight:1.6 }}>{data.problem_solved}</span>
          </div>
        </Card>

        <Card>
          <h3 style={H3}>Key Market Drivers</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
            {(data.key_drivers||[]).map((d,i) => (
              <div key={i} style={{
                display:"flex", alignItems:"center", gap:"0.75rem",
                padding:"0.65rem 0.85rem",
                background:"rgba(99,102,241,0.05)",
                borderRadius:9, border:"1px solid rgba(99,102,241,0.1)",
              }}>
                <div style={{
                  width:24, height:24, borderRadius:7, flexShrink:0,
                  background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color:"#fff", fontWeight:800, fontSize:"0.65rem",
                }}>{i+1}</div>
                <span style={{ color:"#c7d2fe", fontSize:"0.85rem" }}>{d}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Customer Segments — responsive grid */}
      <Card>
        <h3 style={H3}>Customer Segments</h3>
        <div style={{
          display:"grid",
          gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(3,1fr)",
          gap:"1rem",
        }}>
          {(data.segments||[]).map((seg,i) => (
            <motion.div key={i} whileHover={{ y:-3 }}
              style={{
                background:`linear-gradient(135deg, rgba(${hexRgb(COLORS[i%3])},0.08), rgba(${hexRgb(COLORS[i%3])},0.02))`,
                border:`1px solid rgba(${hexRgb(COLORS[i%3])},0.2)`,
                borderRadius:13, padding:"1.1rem",
                cursor:"default", transition:"all 0.3s ease",
                display:"flex", flexDirection:"column",
              }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"0.5rem" }}>
                <div style={{ color:COLORS[i%3], fontWeight:800, fontSize:"0.92rem", lineHeight:1.2 }}>{seg.name}</div>
                <div style={{
                  background:`rgba(${hexRgb(COLORS[i%3])},0.12)`,
                  color:COLORS[i%3], fontSize:"0.7rem", fontWeight:700,
                  borderRadius:6, padding:"0.1rem 0.5rem", flexShrink:0,
                }}>#{i+1}</div>
              </div>

              <div style={{
                display:"inline-flex", alignItems:"center", gap:"0.3rem",
                background:"rgba(16,185,129,0.08)",
                border:"1px solid rgba(16,185,129,0.18)",
                borderRadius:7, padding:"0.3rem 0.65rem", marginBottom:"0.75rem", alignSelf:"flex-start",
              }}>
                <span style={{ color:"#374151", fontSize:"0.62rem", textTransform:"uppercase", letterSpacing:"0.07em" }}>Market Size</span>
                <span style={{ color:"#10b981", fontWeight:800, fontSize:"0.82rem" }}>{seg.size}</span>
              </div>

              <div style={{ height:1, background:`rgba(${hexRgb(COLORS[i%3])},0.12)`, marginBottom:"0.65rem" }} />

              <div style={{ color:"#374151", fontSize:"0.62rem", fontWeight:700,
                textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"0.4rem" }}>
                Pain Points
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:"0.3rem", marginBottom:"0.75rem" }}>
                {(seg.pain_points||[]).map((p,j) => (
                  <div key={j} style={{
                    display:"flex", gap:"0.4rem", alignItems:"flex-start",
                    color:"#6b7280", fontSize:"0.8rem", lineHeight:1.45,
                  }}>
                    <span style={{ color:COLORS[i%3], opacity:0.7, flexShrink:0, marginTop:"0.1rem" }}>▸</span>{p}
                  </div>
                ))}
              </div>

              <div style={{ height:1, background:`rgba(${hexRgb(COLORS[i%3])},0.08)`, marginBottom:"0.65rem" }} />

              <div style={{ color:"#374151", fontSize:"0.62rem", fontWeight:700,
                textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"0.35rem" }}>
                Opportunity Signal
              </div>
              <div style={{
                background:`rgba(${hexRgb(COLORS[i%3])},0.06)`,
                borderLeft:`2px solid ${COLORS[i%3]}`,
                borderRadius:"0 7px 7px 0",
                padding:"0.45rem 0.65rem",
                color:"#94a3b8", fontSize:"0.76rem", lineHeight:1.5,
              }}>
                {i===0
                  ? "High willingness to pay for tools that reduce turnover costs."
                  : i===1
                  ? "Budget approval tied to compliance and engagement mandates."
                  : "Fast-moving teams need real-time visibility across client deliveries."}
              </div>
            </motion.div>
          ))}
        </div>
      </Card>

      {/* Market Risks */}
      <Card>
        <h3 style={H3}>Market Risks</h3>
        <div style={{ display:"flex", flexDirection:"column", gap:"0.6rem" }}>
          {(data.risks||[]).map((r,i) => {
            const color = riskColors[(r.type||"").toLowerCase()] || "#6366f1";
            return (
              <div key={i} style={{
                display:"flex",
                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "flex-start" : "center",
                gap: isMobile ? "0.5rem" : "1rem",
                background:`rgba(${hexRgb(color)},0.04)`,
                border:`1px solid rgba(${hexRgb(color)},0.12)`,
                borderLeft:`3px solid rgba(${hexRgb(color)},0.5)`,
                borderRadius:"0 10px 10px 0",
                padding:"0.75rem 1rem",
              }}>
                <span style={{
                  background:`rgba(${hexRgb(color)},0.1)`,
                  border:`1px solid rgba(${hexRgb(color)},0.25)`,
                  color, borderRadius:7, padding:"0.18rem 0.65rem",
                  fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase",
                  whiteSpace:"nowrap", alignSelf:"flex-start",
                }}>{r.type}</span>
                <span style={{ color:"#6b7280", fontSize:"0.85rem", lineHeight:1.5, flex:1 }}>{r.risk}</span>
                <span style={{
                  background:`rgba(${hexRgb(color)},0.08)`,
                  color, fontSize:"0.68rem", fontWeight:700,
                  borderRadius:6, padding:"0.15rem 0.55rem", whiteSpace:"nowrap",
                  alignSelf: isMobile ? "flex-start" : "center",
                }}>
                  {i===0 ? "High Impact" : i===1 ? "Med Impact" : "Low Impact"}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

const H3 = { color:"#e2e8f0", fontWeight:700, fontSize:"0.95rem", marginBottom:"0.75rem", marginTop:0 };

function hexRgb(hex) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}

function Empty() {
  return <div style={{ color:"#374151", textAlign:"center", padding:"4rem" }}>No market data available.</div>;
}
