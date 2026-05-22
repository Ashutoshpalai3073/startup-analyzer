import { motion } from "framer-motion";

export default function Card({ children, style={}, glow=false, color="#6366f1", hover=false }) {
  return (
    <motion.div
      initial={{ opacity:0, y:16 }}
      animate={{ opacity:1, y:0 }}
      whileHover={hover ? { y:-3, boxShadow:`0 20px 60px rgba(0,0,0,0.4), 0 0 30px rgba(${hexRgb(color)},0.12)` } : {}}
      transition={{ duration:0.3 }}
      style={{
        background:"rgba(10,10,28,0.85)",
        border:`1px solid ${glow ? color+"30" : "rgba(99,102,241,0.1)"}`,
        borderRadius:16, padding:"1.5rem",
        backdropFilter:"blur(12px)",
        boxShadow: glow
          ? `0 8px 40px rgba(0,0,0,0.3), 0 0 20px rgba(${hexRgb(color)},0.08)`
          : "0 4px 20px rgba(0,0,0,0.2)",
        transition:"all 0.3s ease",
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

function hexRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}
