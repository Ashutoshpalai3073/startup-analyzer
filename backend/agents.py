import os
import json
import time
import re
import random
import threading
import litellm
from concurrent.futures import ThreadPoolExecutor, as_completed
from crewai import Agent, Task, Crew, Process, LLM


# ══════════════════════════════════════════════════════════════════════════════
# TOKEN BUCKET — proactive rate limiter (prevents hitting limit in first place)
# ══════════════════════════════════════════════════════════════════════════════
class TokenBucket:
    def __init__(self, tokens_per_minute=10000):
        self.capacity       = tokens_per_minute
        self.tokens         = tokens_per_minute
        self.lock           = threading.Lock()
        self.last_refill    = time.time()

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
                wait_time = (deficit / self.capacity) * 60 + 3   # +3s buffer
                print(f"🪣 Token bucket: proactive wait {wait_time:.0f}s...")
                time.sleep(wait_time)
                self.tokens = self.capacity - estimated_tokens

# Single shared bucket across all threads
_bucket = TokenBucket(tokens_per_minute=10000)


# ══════════════════════════════════════════════════════════════════════════════
# EXPONENTIAL BACKOFF WITH JITTER
# ══════════════════════════════════════════════════════════════════════════════
def _backoff(attempt: int, base=20, cap=120) -> float:
    """Full jitter exponential backoff — prevents thundering herd"""
    sleep = min(cap, base * (2 ** attempt))
    return random.uniform(0, sleep)


# ══════════════════════════════════════════════════════════════════════════════
# CIRCUIT BREAKER — hard exit after MAX_RETRIES (never loops forever)
# ══════════════════════════════════════════════════════════════════════════════
MAX_RETRIES = 6

_original_completion = litellm.completion

def _patched_completion(*args, **kwargs):
    # Strip unsupported cache params
    if 'messages' in kwargs:
        for m in kwargs['messages']:
            if isinstance(m, dict):
                m.pop('cache_breakpoint', None)
                m.pop('cache_control', None)

    # Consume token budget proactively
    _bucket.consume(estimated_tokens=2500)

    # Retry with exponential backoff + circuit breaker
    for attempt in range(MAX_RETRIES):
        try:
            return _original_completion(*args, **kwargs)
        except litellm.RateLimitError:
            if attempt == MAX_RETRIES - 1:
                print(f"⛔ Circuit breaker: {MAX_RETRIES} retries exhausted. Moving on.")
                raise
            sleep_time = _backoff(attempt)
            print(f"⏳ Rate limit — backoff attempt {attempt+1}/{MAX_RETRIES}, "
                  f"waiting {sleep_time:.0f}s...")
            time.sleep(sleep_time)

litellm.completion = _patched_completion


# ══════════════════════════════════════════════════════════════════════════════
# JSON EXTRACTOR
# ══════════════════════════════════════════════════════════════════════════════
def _extract_json(text: str) -> dict:
    if not text:
        return {}
    # Clean common LLM artifacts
    text = text.strip()
    # Try direct parse first
    try:
        return json.loads(text)
    except Exception:
        pass
    # Remove markdown code fences
    text_clean = re.sub(r'```(?:json)?', '', text).replace('```', '').strip()
    try:
        return json.loads(text_clean)
    except Exception:
        pass
    # Find outermost { } using bracket matching
    start = text.find('{')
    if start == -1:
        return {}
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start:i+1])
                except Exception:
                    return {}
    return {}

# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════
MARKET_SCHEMA = """{
  "overview": "string", "problem_solved": "string",
  "key_drivers": ["d1","d2","d3"],
  "tam": {"value": 50.0, "reasoning": "One concise sentence, max 120 characters."},
  "sam": {"value": 15.0, "reasoning": "One concise sentence, max 120 characters."},
  "som": {"value": 2.0,  "reasoning": "One concise sentence, max 120 characters."},
  "current_market_size": 30.0, "five_year_projection": 70.0,
  "ten_year_projection": 150.0, "cagr": 18.5,
  "market_trends": [
    {"icon": "📈", "title": "Growth Driver", "insight": "One professional sentence about main growth trend, max 130 chars."},
    {"icon": "🔄", "title": "Market Shift",  "insight": "One professional sentence about a key market shift, max 130 chars."},
    {"icon": "⚡", "title": "Key Tailwind",  "insight": "One professional sentence about a macro tailwind, max 130 chars."}
  ],
  "segments": [{"name":"string","size":"string","pain_points":["p1","p2"]}],
  "risks": [{"risk":"string","type":"regulatory"}]
}"""

COMPETITOR_SCHEMA = """{
  "landscape_type":"red ocean","competition_level":"fragmented",
  "competitors": [{
    "name":"Co","founded":2020,"funding":"$10M","product":"string",
    "pricing":"$X/mo","usps":["u1","u2"],"weaknesses":["w1","w2"],
    "target_customer":"string"
  }],
  "gaps":["gap1","gap2","gap3"]
}"""

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
  "kpis":{"north_star":"string","mrr_6month":10000,"mrr_12month":50000,
           "cac":500,"ltv":5000,"churn_target":5,"revenue_12month":600000},
  "budget":[{"category":"Marketing","percentage":40},{"category":"Sales","percentage":30},
            {"category":"Product","percentage":20},{"category":"Ops","percentage":10}]
}
IMPORTANT: The channels array MUST contain EXACTLY 3 items, no more, no less."""


# ══════════════════════════════════════════════════════════════════════════════
# INDIVIDUAL TASK RUNNERS
# ══════════════════════════════════════════════════════════════════════════════
def _run_single(role, goal, backstory, description, llm) -> str:
    agent = Agent(role=role, goal=goal, backstory=backstory, llm=llm)
    task  = Task(description=description, expected_output="Valid JSON only", agent=agent)
    Crew(agents=[agent], tasks=[task], process=Process.sequential).kickoff()
    return task.output.raw or ""


def _run_market(idea, llm):
    return _run_single(
        role      = "Market Research Analyst",
        goal      = f"Produce JSON market analysis for: {idea}",
        backstory = "Senior market analyst. Always responds in pure JSON.",
        description = f"Analyze market for: {idea}\nReturn ONLY valid JSON:\n{MARKET_SCHEMA}",
        llm       = llm
    )

def _run_competitor(idea, llm):
    return _run_single(
        role      = "Competitive Intelligence Analyst",
        goal      = f"Produce JSON competitive analysis for: {idea}",
        backstory = "Competitive intelligence specialist. Always responds in pure JSON.",
        description = f"Analyze top 5 competitors for: {idea}\nReturn ONLY valid JSON:\n{COMPETITOR_SCHEMA}",
        llm       = llm
    )

def _run_funding(idea, llm):
    return _run_single(
        role      = "Startup Funding Analyst",
        goal      = f"Produce JSON funding landscape for: {idea}",
        backstory = "VC analyst tracking funding rounds. Always responds in pure JSON.",
        description = f"Analyze funding landscape for: {idea}\nReturn ONLY valid JSON:\n{FUNDING_SCHEMA}",
        llm       = llm
    )

def _run_swot(idea, llm, market_raw, comp_raw):
    ctx = f"Market: {market_raw[:600]}\nCompetitors: {comp_raw[:600]}"
    return _run_single(
        role      = "Strategic SWOT Analyst",
        goal      = f"Produce JSON SWOT analysis for: {idea}",
        backstory = "Strategy consultant. Always responds in pure JSON.",
        description = f"Build SWOT for: {idea}\nContext:\n{ctx}\nReturn ONLY valid JSON:\n{SWOT_SCHEMA}",
        llm       = llm
    )

def _run_gtm(idea, llm, swot_raw, fund_raw):
    ctx = f"SWOT priorities: {swot_raw[:400]}\nFunding: {fund_raw[:300]}"
    prompt = f"Design GTM for: {idea}\nContext:\n{ctx}\nReturn ONLY valid JSON, no extra text:\n{GTM_SCHEMA}"
    response = litellm.completion(
        model="groq/llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": "You are a GTM strategist. Always respond with pure valid JSON only. No explanation, no markdown, no extra text."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=2000,
        temperature=0.3,
    )
    return response.choices[0].message.content or ""


# ══════════════════════════════════════════════════════════════════════════════
# MAIN RUNNER
# ══════════════════════════════════════════════════════════════════════════════
def run_analysis(startup_idea: str, groq_api_key: str) -> dict:
    # ── FIX 1: Suppress CrewAI Fernet key error ──────────────────────────────
    os.environ["CREWAI_STORAGE_DIR"]        = "/tmp"
    os.environ.setdefault("CREWAI_TELEMETRY_OPT_OUT", "true")

    os.environ["OPENAI_API_KEY"] = "sk-dummy"
    os.environ["GROQ_API_KEY"]   = groq_api_key

    llm      = LLM(model="groq/llama-3.3-70b-versatile")
    llm_fast = LLM(model="groq/llama-3.1-8b-instant")

    # ── ROUND 1: Market + Competitor + Funding run in PARALLEL ───────────────
    print("\n🚀 Round 1: Parallel execution — market, competitor, funding...")
    results = {}

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            executor.submit(_run_market,     startup_idea, llm):      "market",
            executor.submit(_run_competitor, startup_idea, llm):      "competitors",
            executor.submit(_run_funding,    startup_idea, llm_fast): "funding",
        }
        for future in as_completed(futures):
            key = futures[future]
            try:
                results[key] = future.result()
                print(f"  ✅ {key} complete")
            except Exception as e:
                print(f"  ⚠️  {key} failed: {e}")
                results[key] = ""

    market_raw = results.get("market",      "")
    comp_raw   = results.get("competitors", "")
    fund_raw   = results.get("funding",     "")

    # ── MANDATORY COOLDOWN before SWOT + GTM ─────────────────────────────────
    print("\n⏸️  Cooldown: waiting 30s for token window to reset...")
    time.sleep(30)

    # ── ROUND 2: SWOT ─────────────────────────────────────────────────────────
    print("\n🔍 Round 2: SWOT analysis...")
    swot_raw = ""
    try:
        swot_raw = _run_swot(startup_idea, llm, market_raw, comp_raw)
        print("  ✅ SWOT complete")
    except Exception as e:
        print(f"  ⚠️  SWOT failed: {e}")

    # ── FIX 2: Increased pause before GTM ────────────────────────────────────
    print("\n⏸️  Short pause: waiting 25s before GTM...")
    time.sleep(25)

    # ── ROUND 3: GTM ──────────────────────────────────────────────────────────
    print("\n🚀 Round 3: GTM strategy...")
    gtm_raw = ""
    try:
        gtm_raw = _run_gtm(startup_idea, llm_fast, swot_raw, fund_raw)
        print("  ✅ GTM complete")
    except Exception as e:
        print(f"  ⚠️  GTM failed: {e}")

    print("\n✅ All analysis complete!")

    return {
        "startup_idea": startup_idea,
        "market":      _extract_json(market_raw),
        "competitors": _extract_json(comp_raw),
        "funding":     _extract_json(fund_raw),
        "swot":        _extract_json(swot_raw),
        "gtm":         _extract_json(gtm_raw),
    }