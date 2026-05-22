import { useState } from "react";
import LandingPage from "./components/LandingPage";
import LoadingScreen from "./components/LoadingScreen";
import Dashboard from "./components/Dashboard";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function App() {
  const [stage, setStage] = useState("dashboard");
  const [analysis, setAnalysis] = useState({
  startup_idea: "AI SaaS tool for remote team productivity",
  market: {
    overview: "The remote work productivity market is rapidly expanding driven by distributed teams.",
    problem_solved: "Teams lack real-time sentiment insights causing low engagement and high churn.",
    key_drivers: ["Remote work adoption", "AI integration", "Employee wellness focus"],
    tam: { value: 45.0, reasoning: "Global workforce management software market" },
    sam: { value: 12.0, reasoning: "SMB and mid-market remote-first companies" },
    som: { value: 1.5,  reasoning: "Achievable in 3 years with focused GTM" },
    current_market_size: 28.0,
    five_year_projection: 65.0,
    ten_year_projection: 140.0,
    cagr: 18.5,
    segments: [
      { name: "SMB Tech Companies", size: "$4.2B", pain_points: ["High turnover", "Low visibility"] },
      { name: "Enterprise HR Teams", size: "$6.8B", pain_points: ["Engagement tracking", "Burnout detection"] },
      { name: "Remote Agencies", size: "$1.0B", pain_points: ["Client delivery risk", "Team morale"] }
    ],
    risks: [
      { risk: "Data privacy regulations like GDPR", type: "regulatory" },
      { risk: "Big Tech entering the space", type: "competitive" }
    ]
  },
  competitors: {
    landscape_type: "red ocean",
    competition_level: "fragmented",
    competitors: [
      { name: "Lattice", founded: 2015, funding: "$329M", product: "People management platform", pricing: "$11/user/mo", usps: ["Strong OKR tracking", "360 reviews"], weaknesses: ["No sentiment AI", "Expensive"], target_customer: "Enterprise HR" },
      { name: "Culture Amp", founded: 2009, funding: "$200M", product: "Employee experience platform", pricing: "$5/user/mo", usps: ["Survey tools", "Benchmarking"], weaknesses: ["No real-time alerts", "Static reports"], target_customer: "Mid-market" },
      { name: "Leapsome", founded: 2016, funding: "$60M", product: "Continuous feedback tool", pricing: "$8/user/mo", usps: ["Goal alignment", "Learning modules"], weaknesses: ["No NLP analysis", "Complex UI"], target_customer: "Growth stage" },
      { name: "Officevibe", founded: 2013, funding: "$30M", product: "Team engagement tool", pricing: "$3.50/user/mo", usps: ["Simple UX", "Weekly pulses"], weaknesses: ["Shallow insights", "No AI"], target_customer: "SMB" },
      { name: "15Five", founded: 2011, funding: "$52M", product: "Performance management", pricing: "$4/user/mo", usps: ["Check-ins", "OKRs"], weaknesses: ["No sentiment analysis", "Limited integrations"], target_customer: "SMB to Mid" }
    ],
    gaps: ["No tool combines real-time sentiment AI with productivity metrics", "Existing tools are reactive not predictive", "No proactive burnout prevention alerts"]
  },
  funding: {
    overview: "Strong VC interest in HR tech and AI-powered workforce tools post-2022.",
    sentiment: "bullish",
    total_investment: "$2.4B",
    rounds: [
      { company: "Lattice", stage: "Series F", amount: "$175M", investor: "Tiger Global", year: 2021 },
      { company: "Culture Amp", stage: "Series F", amount: "$100M", investor: "TDM Growth", year: 2022 },
      { company: "Leapsome", stage: "Series A", amount: "$60M", investor: "Insight Partners", year: 2022 },
      { company: "Visier", stage: "Series E", amount: "$125M", investor: "Goldman Sachs", year: 2021 },
      { company: "Deel", stage: "Series D", amount: "$425M", investor: "Coatue", year: 2022 }
    ],
    vcs: [
      { name: "Andreessen Horowitz", thesis: "Future of work and AI productivity tools", check_size: "$5-50M" },
      { name: "Bessemer Venture Partners", thesis: "SaaS and HR tech", check_size: "$10-30M" },
      { name: "Insight Partners", thesis: "Growth stage B2B SaaS", check_size: "$20-100M" }
    ],
    investor_metrics: { arr: "$1M+ ARR", nrr: "110%+", churn: "<5% monthly", cac_ltv: "LTV:CAC > 3x" },
    recommendations: { ideal_stage: "Seed", round_size: "$2M", top_vcs: ["Andreessen Horowitz", "Bessemer", "First Round Capital"] }
  },
  swot: {
    strengths: ["AI-powered real-time sentiment analysis", "Proactive burnout detection", "Easy Slack/Teams integration", "Strong remote-first positioning", "Low implementation friction"],
    weaknesses: ["No brand recognition yet", "Small initial team", "Limited enterprise security features", "Unproven at scale", "No dedicated customer success"],
    opportunities: ["Remote work permanently mainstream", "HR budgets shifting to AI tools", "No direct competitor with full sentiment AI", "Partnership with Slack and Microsoft Teams", "APAC and EU expansion"],
    threats: ["Slack building native analytics", "Microsoft Viva direct competitor", "Data privacy regulation tightening", "Economic downturn reducing HR budgets", "Talent acquisition in AI is expensive"],
    priorities: ["Achieve product-market fit with 10 paying SMB customers", "Build Slack integration as primary acquisition channel", "Raise seed round of $2M by Q3"],
    risks: [
      { risk: "Microsoft Viva expands sentiment features", likelihood: "High", impact: "High" },
      { risk: "GDPR compliance complexity delays EU launch", likelihood: "Medium", impact: "High" },
      { risk: "Key AI engineer leaves", likelihood: "Low", impact: "High" }
    ]
  },
  gtm: {
    icp: { company_size: "50-500 employees", industry: "Technology, SaaS, Agencies", geography: "North America, UK", buyer_title: "Head of People / VP HR", pain_points: ["Can't detect disengagement early", "High unexpected attrition"] },
    value_proposition: "Give remote team leaders real-time sentiment signals so they can act before problems become resignations.",
    pricing: [
      { tier: "Starter", price: "$6/user/mo", inclusions: ["Sentiment dashboard", "Weekly reports", "Slack integration"] },
      { tier: "Growth", price: "$14/user/mo", inclusions: ["Real-time alerts", "Burnout prediction", "Custom surveys", "Priority support"] },
      { tier: "Enterprise", price: "Custom", inclusions: ["SSO", "Dedicated CSM", "Custom AI models", "SLA guarantee"] }
    ],
    channels: [
      { name: "Slack App Marketplace", priority: 1, cac: "$40-80" },
      { name: "Content Marketing / SEO", priority: 2, cac: "$60-120" },
      { name: "LinkedIn Outbound", priority: 3, cac: "$200-400" }
    ],
    phases: [
      { phase: 1, title: "Foundation", months: "Month 1-2", goals: ["Launch MVP", "10 beta users"], activities: ["Product hunt launch", "Founder-led sales"], metrics: ["10 signups", "NPS > 40"] },
      { phase: 2, title: "PMF Validation", months: "Month 3-4", goals: ["5 paying customers", "Validate ICP"], activities: ["Customer interviews", "Pricing tests"], metrics: ["$5K MRR", "Churn < 5%"] },
      { phase: 3, title: "Growth", months: "Month 5-6", goals: ["$15K MRR", "Slack marketplace live"], activities: ["SEO content", "Partnership outreach"], metrics: ["50 customers", "CAC < $150"] },
      { phase: 4, title: "Scale", months: "Month 7-9", goals: ["$40K MRR", "Seed raise"], activities: ["Paid acquisition", "Investor meetings"], metrics: ["150 customers", "LTV:CAC > 3x"] },
      { phase: 5, title: "Leadership", months: "Month 10-12", goals: ["$80K MRR", "Series A prep"], activities: ["Enterprise sales motion", "PR and awards"], metrics: ["300 customers", "NRR > 110%"] }
    ],
    kpis: { north_star: "Weekly Active Teams", mrr_6month: 15000, mrr_12month: 80000, cac: 150, ltv: 2400, churn_target: 4, revenue_12month: 720000 },
    budget: [
      { category: "Marketing", percentage: 35 },
      { category: "Sales", percentage: 25 },
      { category: "Product", percentage: 30 },
      { category: "Ops", percentage: 10 }
    ]
  }
});
  const [idea, setIdea]         = useState("");
  const [error, setError]       = useState("");

  const handleAnalyze = async (startupIdea) => {
    setIdea(startupIdea);
    setStage("loading");
    setError("");
    try {
      const res = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startup_idea: startupIdea }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Analysis failed");
      }
      const data = await res.json();
      setAnalysis(data);
      setStage("dashboard");
    } catch (e) {
      setError(e.message);
      setStage("landing");
    }
  };

  const handleDownload = async (brandName) => {
    try {
      const res = await fetch(`${API_URL}/download-pitch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, brand_name: brandName }),
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${brandName.replace(/ /g, "_")}_pitch_deck.pptx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Download failed: " + e.message);
    }
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", minHeight: "100vh", background: "#050510" }}>
      {stage === "landing"   && <LandingPage onAnalyze={handleAnalyze} error={error} />}
      {stage === "loading"   && <LoadingScreen idea={idea} />}
      {stage === "dashboard" && (
        <Dashboard analysis={analysis} onDownload={handleDownload} onReset={() => setStage("landing")} />
      )}
    </div>
  );
}
