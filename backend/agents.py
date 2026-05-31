import os
import json
import time
import re
import random
import threading
import tempfile
import litellm
from concurrent.futures import ThreadPoolExecutor, as_completed
from crewai import Agent, Task, Crew, Process, LLM

try:
    from duckduckgo_search import DDGS
    _ddgs_available = True
except ImportError:
    _ddgs_available = False


# ══════════════════════════════════════════════════════════════════════════════
# TOKEN BUCKET — proactive rate limiter
# ══════════════════════════════════════════════════════════════════════════════
class TokenBucket:
    def __init__(self, tokens_per_minute=10000):
        self.capacity    = tokens_per_minute
        self.tokens      = tokens_per_minute
        self.lock        = threading.Lock()
        self.last_refill = time.time()

    def consume(self, estimated_tokens=2000):
        with self.lock:
            now     = time.time()
            elapsed = now - self.last_refill
            refill  = (elapsed / 60.0) * self.capacity
            self.tokens      = min(self.capacity, self.tokens + refill)
            self.last_refill = now
            if self.tokens >= estimated_tokens:
                self.tokens -= estimated_tokens
            else:
                deficit   = estimated_tokens - self.tokens
                wait_time = (deficit / self.capacity) * 60 + 3
                print(f"Token bucket: proactive wait {wait_time:.0f}s...")
                time.sleep(wait_time)
                self.tokens = self.capacity - estimated_tokens

_bucket = TokenBucket(tokens_per_minute=10000)


# ══════════════════════════════════════════════════════════════════════════════
# WEB SEARCH CONTEXT
# ══════════════════════════════════════════════════════════════════════════════
def search_web_context(startup_idea: str) -> dict:
    if not _ddgs_available:
        print("  [search] duckduckgo_search not installed — skipping web context")
        return {"market": [], "competitors": [], "funding": []}

    queries = {
        "market":      f"{startup_idea} total addressable market size 2024 2025 billion",
        "competitors": f"top companies startups {startup_idea} competitors",
        "funding":     f"{startup_idea} startup VC funding investment rounds 2024",
    }
    results = {}
    try:
        with DDGS() as ddgs:
            for key, query in queries.items():
                try:
                    hits = list(ddgs.text(query, max_results=3))
                    results[key] = [
                        {
                            "title":   h.get("title", ""),
                            "snippet": h.get("body", "")[:300],
                            "url":     h.get("href", ""),
                        }
                        for h in hits
                    ]
                    print(f"  [search] '{key}' — {len(results[key])} results")
                except Exception as e:
                    print(f"  [search] '{key}' failed: {e}")
                    results[key] = []
    except Exception as e:
        print(f"  [search] DDGS init failed: {e}")
        return {"market": [], "competitors": [], "funding": []}
    return results


def _fmt_ctx(sources: list, label: str) -> str:
    if not sources:
        return ""
    lines = [f"\n[Web Research — {label}]:"]
    for i, s in enumerate(sources[:3], 1):
        lines.append(f"  {i}. {s['title']}")
        if s["snippet"]:
            lines.append(f"     {s['snippet'][:200]}")
    return "\n".join(lines)


# ══════════════════════════════════════════════════════════════════════════════
# EXPONENTIAL BACKOFF WITH JITTER
# ══════════════════════════════════════════════════════════════════════════════
def _backoff(attempt: int, base=20, cap=120) -> float:
    sleep = min(cap, base * (2 ** attempt))
    return random.uniform(0, sleep)


# ══════════════════════════════════════════════════════════════════════════════
# CIRCUIT BREAKER
# ══════════════════════════════════════════════════════════════════════════════
MAX_RETRIES = 6

_original_completion = litellm.completion

def _patched_completion(*args, **kwargs):
    if 'messages' in kwargs:
        for m in kwargs['messages']:
            if isinstance(m, dict):
                m.pop('cache_breakpoint', None)
                m.pop('cache_control', None)
    _bucket.consume(estimated_tokens=2500)
    for attempt in range(MAX_RETRIES):
        try:
            return _original_completion(*args, **kwargs)
        except litellm.RateLimitError:
            if attempt == MAX_RETRIES - 1:
                print(f"Circuit breaker: {MAX_RETRIES} retries exhausted.")
                raise
            sleep_time = _backoff(attempt)
            print(f"Rate limit — backoff {attempt+1}/{MAX_RETRIES}, waiting {sleep_time:.0f}s...")
            time.sleep(sleep_time)

litellm.completion = _patched_completion


# ══════════════════════════════════════════════════════════════════════════════
# JSON EXTRACTOR — 4-stage parsing
# ══════════════════════════════════════════════════════════════════════════════
def _extract_json(text: str) -> dict:
    if not text:
        return {}
    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    text_clean = re.sub(r'```(?:json)?', '', text).replace('```', '').strip()
    try:
        return json.loads(text_clean)
    except Exception:
        pass
    start = text_clean.find('{')
    if start != -1:
        depth = 0
        for i, ch in enumerate(text_clean[start:], start):
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text_clean[start:i+1])
                    except Exception:
                        break
    try:
        fixed = re.sub(r',\s*([}\]])', r'\1', text_clean)
        start = fixed.find('{')
        if start != -1:
            return json.loads(fixed[start:])
    except Exception:
        pass
    return {}


# ══════════════════════════════════════════════════════════════════════════════
# STRUCTURE VALIDATORS
# FIX: removed `if not d: return {}` from ALL validators — every function now
# always returns a fully-keyed structure so the frontend never gets a bare {}
# ══════════════════════════════════════════════════════════════════════════════
def _ensure_market(d: dict) -> dict:
    d = d or {}
    segments = d.get("segments", [])[:3]
    while len(segments) < 3:
        segments.append({"name": f"Segment {len(segments)+1}", "size": "TBD", "pain_points": []})
    risks = d.get("risks", [])[:3]
    while len(risks) < 3:
        risks.append({"risk": "General market risk", "type": "market"})
    return {
        "overview":             d.get("overview", ""),
        "problem_solved":       d.get("problem_solved", ""),
        "key_drivers":          d.get("key_drivers", []),
        "tam":                  d.get("tam",  {"value": 0, "reasoning": ""}),
        "sam":                  d.get("sam",  {"value": 0, "reasoning": ""}),
        "som":                  d.get("som",  {"value": 0, "reasoning": ""}),
        "current_market_size":  d.get("current_market_size", 0),
        "five_year_projection": d.get("five_year_projection", 0),
        "ten_year_projection":  d.get("ten_year_projection", 0),
        "cagr":                 d.get("cagr", 0),
        "market_trends":        d.get("market_trends", []),
        "segments":             segments,
        "risks":                risks,
    }

def _ensure_competitors(d: dict) -> dict:
    d = d or {}
    competitors = d.get("competitors", [])[:5]
    while len(competitors) < 5:
        competitors.append({
            "name":            f"Competitor {len(competitors)+1}",
            "founded":         2015,
            "funding":         "Bootstrapped",
            "product":         "Similar product in this space",
            "pricing":         "Contact for pricing",
            "usps":            ["Established brand", "Wide distribution"],
            "weaknesses":      ["Limited innovation", "High pricing"],
            "target_customer": "General market",
        })
    return {
        "landscape_type":    d.get("landscape_type", ""),
        "competition_level": d.get("competition_level", ""),
        "competitors":       competitors,
        "gaps":              d.get("gaps", []),
    }

def _ensure_funding(d: dict) -> dict:
    d = d or {}
    return {
        "overview":         d.get("overview", ""),
        "sentiment":        d.get("sentiment", ""),
        "total_investment": d.get("total_investment", ""),
        "rounds":           d.get("rounds", []),
        "vcs":              d.get("vcs", []),
        "investor_metrics": d.get("investor_metrics", {}),
        "recommendations":  d.get("recommendations", {}),
    }

def _ensure_swot(d: dict) -> dict:
    d = d or {}
    return {
        "strengths":     d.get("strengths", []),
        "weaknesses":    d.get("weaknesses", []),
        "opportunities": d.get("opportunities", []),
        "threats":       d.get("threats", []),
        "priorities":    d.get("priorities", []),
        "risks":         d.get("risks", []),
    }

def _ensure_gtm(d: dict) -> dict:
    d = d or {}
    channels = sorted(d.get("channels", []), key=lambda c: c.get("priority", 99))[:3]
    kpis = d.get("kpis", {})
    if kpis.get("north_star"):
        words = kpis["north_star"].split()
        if len(words) > 5:
            kpis["north_star"] = " ".join(words[:5])
    return {
        "icp":               d.get("icp", {}),
        "value_proposition": d.get("value_proposition", ""),
        "pricing":           d.get("pricing", []),
        "channels":          channels,
        "phases":            d.get("phases", []),
        "kpis":              kpis,
        "budget":            d.get("budget", []),
    }


# ══════════════════════════════════════════════════════════════════════════════
# JSON RETRY WRAPPER
# FIX: direct retry uses llama-3.1-8b-instant (not 70b) to save token quota
# ══════════════════════════════════════════════════════════════════════════════
def _run_with_json_retry(run_fn, label: str, schema: str, idea: str, max_parse_retries=2):
    for attempt in range(max_parse_retries + 1):
        raw = ""
        try:
            raw = run_fn()
            print(f"  [{label}] raw output (first 300 chars): {repr(raw[:300])}")
        except Exception as e:
            print(f"  {label} LLM call failed (attempt {attempt+1}): {e}")
            if attempt < max_parse_retries:
                time.sleep(10)
                continue
            return ""

        parsed = _extract_json(raw)
        if parsed:
            print(f"  {label} — parsed OK (attempt {attempt+1})")
            return raw

        print(f"  {label} — empty JSON on attempt {attempt+1}, retrying...")
        if attempt < max_parse_retries:
            time.sleep(8)
            try:
                resp = litellm.completion(
                    model="groq/llama-3.1-8b-instant",
                    messages=[
                        {"role": "system", "content":
                            "You are a JSON-only API. "
                            "Respond with a single valid JSON object only. "
                            "No markdown, no explanation, no extra text whatsoever."},
                        {"role": "user", "content":
                            f"Return a valid JSON analysis for this startup idea: {idea}\n\n"
                            f"Use exactly this structure:\n{schema}\n\n"
                            "IMPORTANT: Return ONLY the JSON object, nothing else."},
                    ],
                    max_tokens=2500,
                    temperature=0.1,
                )
                raw = resp.choices[0].message.content or ""
                parsed = _extract_json(raw)
                if parsed:
                    print(f"  {label} — recovered on direct retry")
                    return raw
            except Exception as e:
                print(f"  {label} direct retry failed: {e}")

    print(f"  {label} — all retries exhausted, returning empty")
    return ""


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════
MARKET_SCHEMA = """{
  "overview": "string",
  "problem_solved": "string",
  "key_drivers": ["driver1","driver2","driver3"],
  "tam": {"value": <REAL_ESTIMATED_FLOAT_IN_BILLIONS>, "reasoning": "Max 40 chars"},
  "sam": {"value": <REAL_ESTIMATED_FLOAT_IN_BILLIONS>, "reasoning": "Max 40 chars"},
  "som": {"value": <REAL_ESTIMATED_FLOAT_IN_BILLIONS>, "reasoning": "Max 40 chars"},
  "current_market_size": <REAL_FLOAT>,
  "five_year_projection": <REAL_FLOAT>,
  "ten_year_projection": <REAL_FLOAT>,
  "cagr": <REAL_FLOAT>,
  "market_trends": [
    {"num": "1", "title": "Growth Driver", "insight": "Max 80 chars"},
    {"num": "2", "title": "Market Shift",  "insight": "Max 80 chars"},
    {"num": "3", "title": "Key Tailwind",  "insight": "Max 80 chars"}
  ],
  "segments": [
    {"name":"Segment 1 name","size":"$XB","pain_points":["p1","p2"]},
    {"name":"Segment 2 name","size":"$XB","pain_points":["p1","p2"]},
    {"name":"Segment 3 name","size":"$XB","pain_points":["p1","p2"]}
  ],
  "risks": [
    {"risk":"string","type":"regulatory|competitive|market|technology|operational"},
    {"risk":"string","type":"regulatory|competitive|market|technology|operational"},
    {"risk":"string","type":"regulatory|competitive|market|technology|operational"}
  ]
}
CRITICAL: segments MUST have EXACTLY 3 items. risks MUST have EXACTLY 3 items. reasoning fields under 40 chars."""

COMPETITOR_SCHEMA = """{
  "landscape_type": "Blue Ocean|Red Ocean|Emerging|Niche",
  "competition_level": "Fragmented|Consolidated|Duopoly|Monopolistic|Nascent",
  "competitors": [
    {"name":"Competitor1","founded":2010,"funding":"$10M","product":"string","pricing":"$X/mo","usps":["usp1","usp2"],"weaknesses":["w1","w2"],"target_customer":"string"},
    {"name":"Competitor2","founded":2012,"funding":"$20M","product":"string","pricing":"$X/mo","usps":["usp1","usp2"],"weaknesses":["w1","w2"],"target_customer":"string"},
    {"name":"Competitor3","founded":2014,"funding":"$5M","product":"string","pricing":"$X/mo","usps":["usp1","usp2"],"weaknesses":["w1","w2"],"target_customer":"string"},
    {"name":"Competitor4","founded":2016,"funding":"Bootstrapped","product":"string","pricing":"$X/mo","usps":["usp1","usp2"],"weaknesses":["w1","w2"],"target_customer":"string"},
    {"name":"Competitor5","founded":2018,"funding":"$2M","product":"string","pricing":"$X/mo","usps":["usp1","usp2"],"weaknesses":["w1","w2"],"target_customer":"string"}
  ],
  "gaps": ["specific_gap1","specific_gap2","specific_gap3"]
}
CRITICAL: competitors MUST have EXACTLY 5 items."""

FUNDING_SCHEMA = """{
  "overview":"string","sentiment":"bullish","total_investment":"$2B",
  "rounds":[{"company":"string","stage":"Series A","amount":"$5M","investor":"string","year":2024}],
  "vcs":[{"name":"string","thesis":"string","check_size":"$1-5M"}],
  "investor_metrics":{"arr":"string","nrr":"string","churn":"string","cac_ltv":"string"},
  "recommendations":{"ideal_stage":"Seed","round_size":"$2M","top_vcs":["VC1","VC2","VC3"]}
}"""

SWOT_SCHEMA = """{
  "strengths":["s1","s2","s3","s4","s5"],
  "weaknesses":["w1","w2","w3","w4","w5"],
  "opportunities":["o1","o2","o3","o4","o5"],
  "threats":["t1","t2","t3","t4","t5"],
  "priorities":["p1","p2","p3"],
  "risks":[{"risk":"string","likelihood":"High","impact":"High"}]
}"""

GTM_SCHEMA = """{
  "icp":{"company_size":"50-500","industry":"string","geography":"string",
         "buyer_title":"string","pain_points":["p1","p2"]},
  "value_proposition":"string",
  "pricing":[
    {"tier":"Basic","price":"$10/user/mo","inclusions":["f1","f2"]},
    {"tier":"Premium","price":"$25/user/mo","inclusions":["f1","f2","f3"]},
    {"tier":"Enterprise","price":"Custom","inclusions":["f1","f2","f3","f4"]}
  ],
  "channels":[
    {"name":"Channel 1","priority":1,"cac":"$X-Y"},
    {"name":"Channel 2","priority":2,"cac":"$X-Y"},
    {"name":"Channel 3","priority":3,"cac":"$X-Y"}
  ],
  "phases":[
    {"phase":1,"title":"Foundation","months":"Month 1-2","goals":["g1","g2"],"activities":["a1","a2"],"metrics":["m1","m2"]},
    {"phase":2,"title":"Validation","months":"Month 3-4","goals":["g1","g2"],"activities":["a1","a2"],"metrics":["m1","m2"]},
    {"phase":3,"title":"Growth","months":"Month 5-6","goals":["g1","g2"],"activities":["a1","a2"],"metrics":["m1","m2"]},
    {"phase":4,"title":"Scale","months":"Month 7-9","goals":["g1","g2"],"activities":["a1","a2"],"metrics":["m1","m2"]},
    {"phase":5,"title":"Leadership","months":"Month 10-12","goals":["g1","g2"],"activities":["a1","a2"],"metrics":["m1","m2"]}
  ],
  "kpis":{"north_star":"Max 5 words","mrr_6month":10000,"mrr_12month":50000,
           "cac":500,"ltv":5000,"churn_target":5,"revenue_12month":600000},
  "budget":[{"category":"Marketing","percentage":40},{"category":"Sales","percentage":30},
            {"category":"Product","percentage":20},{"category":"Ops","percentage":10}]
}
IMPORTANT: channels MUST have EXACTLY 3 items."""


# ══════════════════════════════════════════════════════════════════════════════
# INDIVIDUAL TASK RUNNERS
# FIX: _run_swot now uses direct litellm.completion instead of CrewAI
# CrewAI uses CREWAI_STORAGE_DIR="/tmp" which does not exist on Windows,
# causing kickoff() to fail silently and return "". GTM already used direct
# litellm and worked — SWOT now uses the same pattern.
# ══════════════════════════════════════════════════════════════════════════════
def _run_single(role, goal, backstory, description, llm) -> str:
    agent = Agent(role=role, goal=goal, backstory=backstory, llm=llm)
    task  = Task(description=description, expected_output="Valid JSON only", agent=agent)
    Crew(agents=[agent], tasks=[task], process=Process.sequential).kickoff()
    return task.output.raw or ""


def _run_market(idea, llm, web_ctx=None):
    ctx_str = _fmt_ctx(web_ctx, "Market Size & Trends") if web_ctx else ""
    def _call():
        return _run_single(
            role      = "Market Research Analyst",
            goal      = f"Produce a UNIQUE, RESEARCH-BASED JSON market analysis specifically for: {idea}",
            backstory = (
                "You are a senior market analyst at McKinsey. "
                "You always produce precise, startup-specific market estimates based on real industry data. "
                "You NEVER copy example values from schemas. Every number you output is researched and unique to the query. "
                "You respond only in pure JSON."
            ),
            description = (
                f"Research and analyze the market for this specific startup: {idea}\n"
                f"{ctx_str}\n"
                f"IMPORTANT: Use the web research above to ground your numeric estimates. "
                f"Generate UNIQUE values (TAM, SAM, SOM, CAGR, projections) specific to THIS idea.\n"
                f"Return ONLY valid JSON:\n{MARKET_SCHEMA}"
            ),
            llm = llm,
        )
    return _run_with_json_retry(_call, "market", MARKET_SCHEMA, idea)


def _run_competitor(idea, llm, web_ctx=None):
    ctx_str = _fmt_ctx(web_ctx, "Real Competitors") if web_ctx else ""
    def _call():
        return _run_single(
            role      = "Competitive Intelligence Analyst",
            goal      = f"Produce a UNIQUE, RESEARCH-BASED JSON competitive analysis for: {idea}",
            backstory = (
                "You are a competitive intelligence specialist at a top VC firm. "
                "You identify REAL competitors with accurate funding, pricing, and positioning data. "
                "You NEVER default to generic labels like 'red ocean' or 'fragmented' — "
                "you research the actual competitive dynamics of each specific market. "
                "You respond only in pure JSON."
            ),
            description = (
                f"Research and analyze the competitive landscape for this specific startup: {idea}\n"
                f"{ctx_str}\n"
                f"IMPORTANT: Use the web research above to name REAL companies. "
                f"landscape_type and competition_level MUST reflect actual market reality.\n"
                f"Return ONLY valid JSON:\n{COMPETITOR_SCHEMA}"
            ),
            llm = llm,
        )
    return _run_with_json_retry(_call, "competitors", COMPETITOR_SCHEMA, idea)


def _run_funding(idea, llm_fast, web_ctx=None):
    ctx_str = _fmt_ctx(web_ctx, "Funding Activity") if web_ctx else ""
    def _call():
        return _run_single(
            role        = "Startup Funding Analyst",
            goal        = f"Produce JSON funding landscape for: {idea}",
            backstory   = "VC analyst tracking funding rounds. Always responds in pure JSON.",
            description = (
                f"Analyze funding landscape for: {idea}\n"
                f"{ctx_str}\n"
                f"Use the web research above to cite REAL funding activity in this space.\n"
                f"Return ONLY valid JSON:\n{FUNDING_SCHEMA}"
            ),
            llm         = llm_fast,
        )
    return _run_with_json_retry(_call, "funding", FUNDING_SCHEMA, idea)


# FIX: replaced CrewAI _run_single with direct litellm.completion
# CrewAI's storage backend fails silently on Windows (no /tmp directory),
# returning "" every time. Direct litellm call bypasses this entirely.
def _run_swot(idea, llm_fast, market_raw, comp_raw):
    ctx = f"Market: {market_raw[:600]}\nCompetitors: {comp_raw[:600]}"
    prompt = (
        f"Build a SWOT analysis for this startup: {idea}\n\n"
        f"Context:\n{ctx}\n\n"
        f"Return ONLY valid JSON, no markdown, no explanation:\n{SWOT_SCHEMA}"
    )
    def _call():
        response = litellm.completion(
            model="groq/llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content":
                    "You are a strategic SWOT analyst. "
                    "Always respond with pure valid JSON only. "
                    "No explanation, no markdown, no extra text."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=2000,
            temperature=0.3,
        )
        return response.choices[0].message.content or ""
    return _run_with_json_retry(_call, "swot", SWOT_SCHEMA, idea)


def _run_gtm(idea, llm_fast, swot_raw, fund_raw):
    ctx    = f"SWOT priorities: {swot_raw[:400]}\nFunding: {fund_raw[:300]}"
    prompt = f"Design GTM for: {idea}\nContext:\n{ctx}\nReturn ONLY valid JSON, no extra text:\n{GTM_SCHEMA}"
    def _call():
        response = litellm.completion(
            model="groq/llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content":
                    "You are a GTM strategist. Always respond with pure valid JSON only. "
                    "No explanation, no markdown, no extra text."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=2000,
            temperature=0.3,
        )
        return response.choices[0].message.content or ""
    return _run_with_json_retry(_call, "gtm", GTM_SCHEMA, idea)


# ══════════════════════════════════════════════════════════════════════════════
# MAIN RUNNER
# FIX: CREWAI_STORAGE_DIR now uses tempfile.gettempdir() instead of "/tmp"
# which is a Linux-only path and does not exist on Windows
# ══════════════════════════════════════════════════════════════════════════════
def run_analysis(startup_idea: str, groq_api_key: str) -> dict:
    os.environ["CREWAI_STORAGE_DIR"] = tempfile.gettempdir()   # FIX: was "/tmp"
    os.environ.setdefault("CREWAI_TELEMETRY_OPT_OUT", "true")
    os.environ["OPENAI_API_KEY"] = "sk-dummy"
    os.environ["GROQ_API_KEY"]   = groq_api_key

    llm      = LLM(model="groq/llama-3.3-70b-versatile")
    llm_fast = LLM(model="groq/llama-3.1-8b-instant")

    # ── WEB SEARCH ───────────────────────────────────────────────────────────
    print("\nWeb search: fetching real-world context...")
    sources = search_web_context(startup_idea)
    print(f"  Sources collected — market:{len(sources.get('market',[]))}, "
          f"competitors:{len(sources.get('competitors',[]))}, "
          f"funding:{len(sources.get('funding',[]))}")

    # ── ROUND 1: Market + Competitor + Funding in PARALLEL ───────────────────
    print("\nRound 1: Parallel — market, competitor, funding...")
    results = {}

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            executor.submit(_run_market,     startup_idea, llm,      sources.get("market")):      "market",
            executor.submit(_run_competitor, startup_idea, llm,      sources.get("competitors")): "competitors",
            executor.submit(_run_funding,    startup_idea, llm_fast, sources.get("funding")):     "funding",
        }
        for future in as_completed(futures):
            key = futures[future]
            try:
                results[key] = future.result()
                print(f"  {key} complete")
            except Exception as e:
                print(f"  {key} failed: {e}")
                results[key] = ""

    market_raw = results.get("market",      "")
    comp_raw   = results.get("competitors", "")
    fund_raw   = results.get("funding",     "")

    # ── COOLDOWN ──────────────────────────────────────────────────────────────
    print("\nCooldown: 90s for token window to reset...")
    time.sleep(90)

    # ── ROUND 2: SWOT (direct litellm, bypasses CrewAI/tmp bug) ──────────────
    print("\nRound 2: SWOT analysis...")
    swot_raw = ""
    try:
        swot_raw = _run_swot(startup_idea, llm_fast, market_raw, comp_raw)
        print("  SWOT complete")
    except Exception as e:
        print(f"  SWOT failed: {e}")

    print("\nPause: 25s before GTM...")
    time.sleep(25)

    # ── ROUND 3: GTM ──────────────────────────────────────────────────────────
    print("\nRound 3: GTM strategy...")
    gtm_raw = ""
    try:
        gtm_raw = _run_gtm(startup_idea, llm_fast, swot_raw, fund_raw)
        print("  GTM complete")
    except Exception as e:
        print(f"  GTM failed: {e}")

    print("\nAll analysis complete!")

    # ── debug: print swot result so you can verify in terminal ───────────────
    swot_parsed = _extract_json(swot_raw)
    print(f"\n=== SWOT DEBUG === strengths count: {len(swot_parsed.get('strengths', []))}")

    return {
        "startup_idea": startup_idea,
        "market":       _ensure_market(     _extract_json(market_raw)),
        "competitors":  _ensure_competitors(_extract_json(comp_raw)),
        "funding":      _ensure_funding(    _extract_json(fund_raw)),
        "swot":         _ensure_swot(       _extract_json(swot_raw)),
        "gtm":          _ensure_gtm(        _extract_json(gtm_raw)),
        "sources":      sources,
    }