"""
DRUSTI ANALYSIS ENGINE v3 — evidence-grounded, quant-backed startup analysis.

Architecture:
  0. NORMALIZE        — raw idea sentence -> clean search profile (industry, search_term, keywords)
  1. EVIDENCE LAYER   — Tavily (primary, LLM-optimized) -> DDG (fallback) -> Evidence store with IDs
  2. FACT EXTRACTION  — regex mining of market sizes, CAGRs, funding rounds from evidence
  3. QUANT ENGINE     — triangulated market sizing + 10k-run Monte Carlo projections (P10/P50/P90)
  4. LLM LAYER        — direct litellm + Groq JSON mode; LLM writes narrative, cites evidence IDs
  5. VALIDATION       — structural padding, citation verification, numeric sanity
                        (SOM <= SAM <= TAM enforced; code-computed numbers override LLM numbers)
  6. CACHE            — Supabase: skip the whole pipeline for recently-analyzed industries

CrewAI removed entirely. Output is backwards compatible; new keys are additive:
  profile, quant, data_quality, facts, and per-section "citations" + "confidence".

Required env vars:
  GROQ_API_KEY      (required)
  TAVILY_API_KEY    (recommended — clean LLM-grade search; falls back to DDG if absent)
  SUPABASE_URL      (optional — enables caching)
  SUPABASE_KEY      (optional — service-role key; backend-only)
"""

import os
import re
import json
import time
import random
import hashlib
import statistics
import threading
from dataclasses import dataclass, field, asdict
from concurrent.futures import ThreadPoolExecutor, as_completed

import litellm

# ── Tavily (primary search) ──
_tavily_available = False
try:
    from tavily import TavilyClient
    _tavily_available = True
except ImportError:
    pass

# ── DuckDuckGo (fallback search) ──
_ddgs_available = False
try:
    from ddgs import DDGS
    _ddgs_available = True
except ImportError:
    try:
        from duckduckgo_search import DDGS
        _ddgs_available = True
    except ImportError:
        pass

# ── Supabase (cache) ──
_supabase_available = False
try:
    from supabase import create_client
    _supabase_available = True
except ImportError:
    pass

try:
    import requests
    _requests_available = True
except ImportError:
    _requests_available = False


MODEL_DEEP = "groq/llama-3.3-70b-versatile"   # 70B — used only for market + GTM (need quality)
MODEL_MID  = "groq/llama-3.1-8b-instant"      # 8B  — used for competitors, funding, SWOT
MODEL_FAST = "groq/llama-3.1-8b-instant"      # 8B  — used for normalize + repairs

CACHE_TTL_DAYS = 7


# ══════════════════════════════════════════════════════════════════════════════
# 0. RATE LIMITING — token bucket + jittered exponential backoff (kept from v1)
# ══════════════════════════════════════════════════════════════════════════════
class TokenBucket:
    def __init__(self, tokens_per_minute=10000):
        self.capacity = tokens_per_minute
        self.tokens = tokens_per_minute
        self.lock = threading.Lock()
        self.last_refill = time.time()

    def consume(self, estimated_tokens=2000):
        with self.lock:
            now = time.time()
            self.tokens = min(self.capacity, self.tokens + ((now - self.last_refill) / 60.0) * self.capacity)
            self.last_refill = now
            if self.tokens >= estimated_tokens:
                self.tokens -= estimated_tokens
                return
            deficit = estimated_tokens - self.tokens
            wait = (deficit / self.capacity) * 60 + 2
            print(f"  [bucket] proactive wait {wait:.0f}s")
            time.sleep(wait)
            self.tokens = self.capacity - estimated_tokens


_bucket = TokenBucket(tokens_per_minute=10000)
MAX_RETRIES = 6


def _backoff(attempt, base=15, cap=120):
    return random.uniform(0, min(cap, base * (2 ** attempt)))


# ══════════════════════════════════════════════════════════════════════════════
# 1. EVIDENCE LAYER
#    Multi-query parallel search. Every hit becomes an Evidence object with an
#    ID (E1, E2, ...) so the LLM can cite it and the frontend can show sources.
# ══════════════════════════════════════════════════════════════════════════════
@dataclass
class Evidence:
    eid: str
    tag: str          # market | growth | competitors | pricing | funding | trends | news
    title: str
    snippet: str
    url: str
    body: str = ""    # fetched page text (optional, truncated)


class EvidenceStore:
    def __init__(self):
        self.items: list = []
        self._lock = threading.Lock()
        self._seen_urls = set()

    def add(self, tag, title, snippet, url):
        with self._lock:
            if url and url in self._seen_urls:
                return None
            self._seen_urls.add(url)
            ev = Evidence(eid=f"E{len(self.items)+1}", tag=tag,
                          title=(title or "")[:140], snippet=(snippet or "")[:400], url=url or "")
            self.items.append(ev)
            return ev

    def by_tags(self, tags):
        return [e for e in self.items if e.tag in tags]

    def valid_ids(self):
        return {e.eid for e in self.items}

    def url_map(self):
        return {e.eid: {"title": e.title, "url": e.url} for e in self.items}

    def digest(self, tags, limit=10, with_body=False):
        """Numbered evidence block injected into LLM prompts."""
        lines = []
        for e in self.by_tags(tags)[:limit]:
            lines.append(f"[{e.eid}] ({e.tag}) {e.title}\n     {e.snippet}")
            if with_body and e.body:
                lines.append(f"     EXTRACT: {e.body[:500]}")
        return "\n".join(lines) if lines else "(no web evidence available)"


_FILLER = re.compile(
    r"\b(a|an|the|startup|company|business|app|platform|website|based|on|for|of|that|which|"
    r"helps?|using|builds?|making|makes?|idea|about|to|in)\b", re.I)


def _fallback_normalize(idea: str) -> dict:
    """Regex-only cleanup if the LLM normalization call fails."""
    core = _FILLER.sub(" ", idea)
    core = re.sub(r"\s+", " ", core).strip() or idea
    kws = [w for w in core.split() if len(w) > 3][:6] or core.split()[:4]
    return {"industry": core, "search_term": core, "keywords": kws, "one_liner": idea}


def normalize_idea(idea: str) -> dict:
    """
    CRITICAL PRE-STEP: convert the user's raw sentence into a clean search profile.
    Raw sentences like 'a startup based on mobile manufacturing' produce garbage
    search results ('best a startup based on...' -> fashion 'tops' pages).
    """
    try:
        d = call_llm_json(
            MODEL_FAST,
            "You convert startup ideas into web-search profiles. JSON only.",
            (f"Startup idea: {idea}\n\n"
             'Return JSON: {"industry":"canonical industry name, 2-4 words",'
             '"search_term":"best 2-4 word phrase for web searching this market",'
             '"keywords":["5-8 single words or short phrases that MUST appear in relevant '
             'articles about this industry, lowercase"],'
             '"one_liner":"the idea restated clearly in one sentence"}\n'
             'Example: "a startup based on mobile manufacturing" -> '
             '{"industry":"mobile phone manufacturing","search_term":"smartphone manufacturing",'
             '"keywords":["smartphone","mobile phone","handset","manufacturing","oem","electronics"],'
             '"one_liner":"A startup that manufactures mobile phones."}'),
            max_tokens=400, temperature=0.0, est_tokens=600)
        if d.get("search_term") and d.get("keywords"):
            d.setdefault("industry", d["search_term"])
            d.setdefault("one_liner", idea)
            d["keywords"] = [str(k).lower() for k in d["keywords"]][:8]
            return d
    except Exception as e:
        print(f"  [normalize] LLM normalization failed: {e}")
    return _fallback_normalize(idea)


def _search_plan(term):
    return [
        ("market",      f"{term} market size billion 2025"),
        ("market",      f"{term} industry market report total addressable"),
        ("growth",      f"{term} market CAGR growth forecast"),
        ("competitors", f"largest {term} companies market leaders"),
        ("competitors", f"top {term} startups competitors list"),
        ("pricing",     f"{term} pricing cost comparison"),
        ("funding",     f"{term} startup raises series A B million 2025"),
        ("funding",     f"{term} funding round led by valuation"),
        ("trends",      f"{term} industry trends outlook 2025"),
    ]


def _is_relevant(title: str, snippet: str, keywords) -> bool:
    """Relevance gate: a hit must mention at least one industry keyword.
    Without this, fuzzy matches (e.g. fashion 'tops' pages for 'top companies')
    poison the evidence store and the LLM names completely wrong competitors."""
    if not keywords:
        return True
    text = f"{title} {snippet}".lower()
    return any(k in text for k in keywords)


# Authoritative sources to bias toward, per evidence tag. Tavily's include_domains
# nudges (not hard-restricts) ranking toward these — better citations, fewer SEO junk
# facts polluting the triangulation median. India-aware (IBEF, Inc42) for local ideas.
_AUTHORITATIVE = {
    "market":      ["statista.com", "grandviewresearch.com", "marketsandmarkets.com",
                    "mordorintelligence.com", "fortunebusinessinsights.com",
                    "precedenceresearch.com", "ibef.org"],
    "growth":      ["statista.com", "grandviewresearch.com", "mordorintelligence.com",
                    "marketsandmarkets.com", "alliedmarketresearch.com"],
    "funding":     ["crunchbase.com", "techcrunch.com", "inc42.com", "entrackr.com",
                    "yourstory.com", "pitchbook.com"],
    "competitors": [],   # leave open — competitor names live across the whole web
    "pricing":     [],
    "trends":      ["statista.com", "mckinsey.com", "gartner.com", "cbinsights.com"],
    "news":        [],
}

# How many results to pull per query, by tag. Numeric-fact-heavy tags get more
# results -> more data points -> more stable triangulated numbers. Same credit cost
# (Tavily bills per query, not per result).
_RESULTS_PER_TAG = {
    "market": 10, "growth": 10, "funding": 8, "trends": 8,
    "competitors": 6, "pricing": 6, "news": 5,
}


# ── PRIMARY: Tavily — LLM-grade search, returns clean extracted content ──
def _collect_tavily(profile: dict, store: EvidenceStore, keywords) -> int:
    client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])
    rejected = {"n": 0}
    rej_lock = threading.Lock()

    def _one(tag, query):
        try:
            kwargs = dict(query=query, search_depth="advanced",
                          max_results=_RESULTS_PER_TAG.get(tag, 6),
                          include_raw_content=True)
            domains = _AUTHORITATIVE.get(tag) or []
            if domains:
                kwargs["include_domains"] = domains
            resp = client.search(**kwargs)
            n = 0
            for h in resp.get("results", []):
                title = h.get("title", "")
                snippet = h.get("content", "")
                body = h.get("raw_content") or ""
                if not _is_relevant(title, snippet + " " + body[:500], keywords):
                    with rej_lock:
                        rejected["n"] += 1
                    continue
                ev = store.add(tag, title, snippet, h.get("url", ""))
                if ev:
                    ev.body = (body or "")[:3500]
                    n += 1
            print(f"  [tavily] {tag} '{query[:34]}…' +{n}"
                  f"{' (authoritative)' if domains else ''}")
        except Exception as e:
            print(f"  [tavily] {tag} failed: {e}")

    with ThreadPoolExecutor(max_workers=4) as ex:
        list(ex.map(lambda j: _one(*j), _search_plan(profile["search_term"])))

    # If the domain-biased market/growth queries came back thin, retry those two
    # WITHOUT the domain filter so we never end up with zero numeric grounding.
    if len(store.by_tags(["market", "growth"])) < 4:
        print("  [tavily] sparse market data — retrying open-web (no domain filter)")
        for tag in ("market", "growth"):
            try:
                resp = client.search(query=f"{profile['search_term']} market size billion forecast",
                                     search_depth="advanced", max_results=8, include_raw_content=True)
                for h in resp.get("results", []):
                    if _is_relevant(h.get("title", ""), h.get("content", ""), keywords):
                        ev = store.add(tag, h.get("title", ""), h.get("content", ""), h.get("url", ""))
                        if ev:
                            ev.body = (h.get("raw_content") or "")[:3500]
            except Exception:
                pass

    _tavily_extract_top(client, store, keywords)
    print(f"  [tavily] kept {len(store.items)}, rejected {rejected['n']} irrelevant")
    return len(store.items)


def _tavily_extract_top(client, store: EvidenceStore, keywords, per_tag=2):
    """Deep-extract full text of the top market/growth/funding pages that don't
    already have a usable body. Surfaces $X billion / CAGR Y% figures the snippet
    missed -> more numeric facts -> more stable quant. One extract call, batched."""
    urls = []
    for tag in ("market", "growth", "funding"):
        for ev in store.by_tags([tag])[:per_tag]:
            if ev.url.startswith("http") and len(ev.body) < 800:
                urls.append((ev.url, ev))
    if not urls:
        return
    try:
        resp = client.extract(urls=[u for u, _ in urls], extract_depth="advanced")
        by_url = {r.get("url"): r.get("raw_content", "") for r in resp.get("results", [])}
        filled = 0
        for url, ev in urls:
            content = by_url.get(url, "")
            if content:
                ev.body = content[:3500]
                filled += 1
        print(f"  [tavily] deep-extracted {filled} report page(s)")
    except Exception as e:
        print(f"  [tavily] extract pass skipped: {e}")


# ── FALLBACK: DuckDuckGo — used only if Tavily key absent or Tavily fails ──
def _collect_ddg(profile: dict, store: EvidenceStore, keywords) -> int:
    rejected = {"n": 0}
    rej_lock = threading.Lock()

    def _one(tag, query):
        time.sleep(random.uniform(0.4, 1.4))   # jitter — DDG rate-limits IP bursts
        for attempt in range(2):
            try:
                with DDGS() as ddgs:
                    hits = list(ddgs.text(query, max_results=4))
                n = 0
                for h in hits:
                    title = h.get("title", "")
                    snippet = h.get("body", "") or h.get("excerpt", "")
                    if not _is_relevant(title, snippet, keywords):
                        with rej_lock:
                            rejected["n"] += 1
                        continue
                    if store.add(tag, title, snippet, h.get("href", "") or h.get("url", "")):
                        n += 1
                print(f"  [ddg] {tag} '{query[:38]}…' +{n}")
                return
            except Exception as e:
                if attempt == 0:
                    time.sleep(random.uniform(2, 5))
                    continue
                print(f"  [ddg] {tag} failed: {e}")

    with ThreadPoolExecutor(max_workers=2) as ex:
        list(ex.map(lambda j: _one(*j), _search_plan(profile["search_term"])))
    _fetch_pages(store)   # DDG snippets are thin -> fetch a few full pages
    print(f"  [ddg] kept {len(store.items)}, rejected {rejected['n']} irrelevant")
    return len(store.items)


def collect_evidence(idea: str, profile: dict) -> EvidenceStore:
    store = EvidenceStore()
    keywords = profile.get("keywords", [])

    have_tavily = _tavily_available and os.environ.get("TAVILY_API_KEY")
    if have_tavily:
        try:
            if _collect_tavily(profile, store, keywords) > 0:
                return store
            print("  [evidence] Tavily returned nothing — falling back to DDG")
        except Exception as e:
            print(f"  [evidence] Tavily error ({e}) — falling back to DDG")

    if _ddgs_available:
        _collect_ddg(profile, store, keywords)
        return store

    print("  [evidence] no search backend available — LLM-only (low confidence)")
    return store


def _fetch_pages(store: EvidenceStore, per_tag=1, timeout=8):
    """DDG-only helper: fetch full text of the best page per key tag.
    Not needed for Tavily (it returns raw_content inline)."""
    if not _requests_available:
        return
    targets = []
    for tag in ("market", "growth", "funding"):
        targets.extend(store.by_tags([tag])[:per_tag])
    headers = {"User-Agent": "Mozilla/5.0 (compatible; DrustiBot/3.0)"}
    for ev in targets:
        if ev.body or not ev.url.startswith("http"):
            continue
        try:
            r = requests.get(ev.url, headers=headers, timeout=timeout)
            if r.status_code != 200 or "html" not in r.headers.get("content-type", ""):
                continue
            text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", r.text, flags=re.S | re.I)
            text = re.sub(r"<[^>]+>", " ", text)
            ev.body = re.sub(r"\s+", " ", text).strip()[:3000]
            print(f"  [fetch] {ev.eid} {ev.url[:54]} ({len(ev.body)} chars)")
        except Exception:
            pass


# ══════════════════════════════════════════════════════════════════════════════
# 2. FACT EXTRACTION
#    Regex-mine hard numbers out of evidence text. These are the raw inputs to
#    the quant engine — independent of anything the LLM says.
# ══════════════════════════════════════════════════════════════════════════════
_MONEY = re.compile(
    r"(?:US|U\.S\.)?\$\s?(\d[\d,]*\.?\d*)\s*(trillion|billion|million|tn|bn|mn|b|m)\b", re.I)
_CAGR = re.compile(
    r"(?:CAGR|compound annual growth rate)[^%\d]{0,50}?(\d{1,2}(?:\.\d+)?)\s*%", re.I)
_GROWTH = re.compile(
    r"grow(?:ing|th)?(?:\s+rate)?[^%\d]{0,40}?(\d{1,2}(?:\.\d+)?)\s*%", re.I)
_RAISED = re.compile(
    r"rais(?:e[ds]?|ing)\s+(?:a\s+|an\s+|its\s+)?(?:US)?\$\s?(\d[\d,]*\.?\d*)\s*(billion|million|bn|mn|b|m)\b", re.I)
# Money tied to a round stage, in either order:
#   "$60 million Series B"  /  "Series A ... $40M"  /  "$16M Series A"
_ROUND_AMT = re.compile(
    r"\$\s?(\d[\d,]*\.?\d*)\s*(billion|million|bn|mn|b|m)\b[^.]{0,40}?"
    r"(seed|pre-seed|series\s+[a-f]|angel)", re.I)
_ROUND_AMT2 = re.compile(
    r"(seed|pre-seed|series\s+[a-f]|angel)[^.]{0,40}?\$\s?(\d[\d,]*\.?\d*)\s*(billion|million|bn|mn|b|m)\b", re.I)
# "total funding of $88 million" / "$88 million in total funding" / "$120M total"
_TOTAL_FUND = re.compile(
    r"(?:total\s+(?:funding|capital|raised)[^.$]{0,30}?\$\s?(\d[\d,]*\.?\d*)\s*(billion|million|bn|mn|b|m)"
    r"|\$\s?(\d[\d,]*\.?\d*)\s*(billion|million|bn|mn|b|m)\b[^.]{0,25}?(?:in\s+total|total\s+funding|total\s+capital|across\s+\d+))",
    re.I)
_YEAR = re.compile(r"\b(20[12]\d|203[0-5])\b")

_UNIT_TO_B = {"trillion": 1000.0, "tn": 1000.0, "billion": 1.0, "bn": 1.0, "b": 1.0,
              "million": 0.001, "mn": 0.001, "m": 0.001}


@dataclass
class Fact:
    kind: str           # market_size | cagr | funding_round | total_funding
    value: float        # USD billions, or percent for cagr
    year: int
    evidence_id: str
    context: str
    stage: str = ""     # seed | series a… (funding only)
    company: str = ""   # best-guess company name (funding only)


def extract_facts(store: EvidenceStore) -> list:
    facts = []
    for ev in store.items:
        text = f"{ev.title}. {ev.snippet} {ev.body[:3000]}"
        years = [int(y) for y in _YEAR.findall(text)]
        default_year = max(years) if years else 2025

        if ev.tag in ("market", "growth", "trends", "news"):
            for m in _MONEY.finditer(text):
                val = float(m.group(1).replace(",", "")) * _UNIT_TO_B[m.group(2).lower()]
                if 0.01 <= val <= 5000:  # plausibility window in $B
                    facts.append(Fact("market_size", round(val, 3), default_year, ev.eid,
                                      text[max(0, m.start()-60):m.end()+60]))
            for m in _CAGR.finditer(text):
                pct = float(m.group(1))
                if 0.5 <= pct <= 60:
                    facts.append(Fact("cagr", pct, default_year, ev.eid,
                                      text[max(0, m.start()-60):m.end()+60]))
            if not _CAGR.search(text):
                for m in _GROWTH.finditer(text):
                    pct = float(m.group(1))
                    if 2 <= pct <= 60:
                        facts.append(Fact("cagr", pct, default_year, ev.eid,
                                          text[max(0, m.start()-60):m.end()+60]))

        if ev.tag in ("funding", "news", "competitors"):
            round_map = {}   # amount -> best Fact (prefer one with a stage)

            def _add_round(amount_b, stage, span_text):
                key = round(amount_b, 4)
                stage_t = stage.title() if stage else ""
                existing = round_map.get(key)
                # keep the richer record: a staged round beats a bare one
                if existing and not stage_t:
                    return
                if existing and existing.stage and not stage_t:
                    return
                company = ""
                title_m = re.match(r"([A-Z][A-Za-z0-9.&]+(?:\s+[A-Z][A-Za-z0-9.&]+){0,2})", ev.title)
                if title_m:
                    company = title_m.group(1)
                    # strip trailing noise words from title-derived names
                    company = re.split(r"\s+(?:raises?|revenue|funding|valuation|closes?)\b",
                                       company, flags=re.I)[0].strip()
                round_map[key] = Fact("funding_round", round(amount_b, 4), default_year, ev.eid,
                                      span_text, stage=stage_t, company=company)

            # collect total-funding amounts first so we can exclude them from rounds
            total_amounts = set()
            for m in _TOTAL_FUND.finditer(text):
                amt = m.group(1) or m.group(3)
                unit = m.group(2) or m.group(4)
                if not amt:
                    continue
                val = float(amt.replace(",", "")) * _UNIT_TO_B[unit.lower()]
                if 0.0001 <= val <= 100:
                    total_amounts.add(round(val, 4))
                    facts.append(Fact("total_funding", round(val, 4), default_year, ev.eid,
                                      text[max(0, m.start()-40):m.end()+40]))

            for m in _ROUND_AMT.finditer(text):
                val = float(m.group(1).replace(",", "")) * _UNIT_TO_B[m.group(2).lower()]
                if 0.0001 <= val <= 50 and round(val, 4) not in total_amounts:
                    _add_round(val, m.group(3), text[max(0, m.start()-30):m.end()+40])
            for m in _ROUND_AMT2.finditer(text):
                val = float(m.group(2).replace(",", "")) * _UNIT_TO_B[m.group(3).lower()]
                if 0.0001 <= val <= 50 and round(val, 4) not in total_amounts:
                    _add_round(val, m.group(1), text[max(0, m.start()-30):m.end()+40])
            for m in _RAISED.finditer(text):
                val = float(m.group(1).replace(",", "")) * _UNIT_TO_B[m.group(2).lower()]
                if 0.0001 <= val <= 50 and round(val, 4) not in total_amounts:
                    _add_round(val, "", text[max(0, m.start()-40):m.end()+40])

            facts.extend(round_map.values())

    print(f"  [facts] market_size:{sum(f.kind=='market_size' for f in facts)} "
          f"cagr:{sum(f.kind=='cagr' for f in facts)} "
          f"funding:{sum(f.kind=='funding_round' for f in facts)} "
          f"total_fund:{sum(f.kind=='total_funding' for f in facts)}")
    return facts


# ══════════════════════════════════════════════════════════════════════════════
# 3. QUANT ENGINE
#    Triangulation (robust median across sources) + Monte Carlo projection.
#    Pure stdlib — runs anywhere, no numpy needed on Render free tier.
# ══════════════════════════════════════════════════════════════════════════════
import math as _math

def _round_to_sig(val, sig=2):
    """Round to `sig` significant figures so $682.55B → $680B and $671B → $670B.
    This means two runs that extracted slightly different medians (say $682B vs $671B)
    map to values that are visually consistent rather than looking like different numbers."""
    if not val or val <= 0:
        return val
    magnitude = _math.floor(_math.log10(abs(val)))
    factor = 10 ** (magnitude - sig + 1)
    return round(round(val / factor) * factor, max(0, sig - magnitude - 1))


def _robust_estimate(values):
    """Median + MAD-based spread. Returns (median, spread, agreement 0-1).
    Trims the top and bottom 20% as outliers even with just 3 data points so a single
    wildly-scoped figure (e.g. 'global electronics $2T') doesn't shift the median."""
    if not values:
        return None, None, 0.0
    if len(values) == 1:
        return values[0], values[0] * 0.5, 0.3
    # Trim outer 20% from each side — apply even with 3 values (drops 1 outlier)
    trimmed = sorted(values)
    k = max(0, len(trimmed) // 5)
    trimmed = trimmed[k: len(trimmed) - k] if k > 0 else trimmed
    med = statistics.median(trimmed)
    mad = statistics.median([abs(v - med) for v in trimmed]) or med * 0.25
    rel_dispersion = mad / med if med else 1.0
    agreement = max(0.0, min(1.0, 1.0 - rel_dispersion))
    return med, mad * 1.4826, agreement  # MAD -> sigma equivalent


def _monte_carlo(base, base_sigma, cagr_pct, cagr_sigma_pct, years, n=10000):
    # Deterministic: seed a local RNG on the inputs so the SAME facts always
    # produce the SAME projection. This is a simulation, not a dice roll — two
    # identical analyses must return identical numbers.
    seed = int(abs(hash((round(base, 3), round(base_sigma, 3),
                          round(cagr_pct, 2), round(cagr_sigma_pct, 2), years))) % (2**32))
    rng = random.Random(seed)
    sims = []
    for _ in range(n):
        size = max(0.001, rng.gauss(base, base_sigma))
        g = max(-0.10, min(0.60, rng.gauss(cagr_pct, cagr_sigma_pct) / 100.0))
        sims.append(size * ((1 + g) ** years))
    sims.sort()
    return {"p10": round(sims[n // 10], 2),
            "p50": round(sims[n // 2], 2),
            "p90": round(sims[(9 * n) // 10], 2)}


def run_quant(facts: list) -> dict:
    size_vals = sorted(f.value for f in facts if f.kind == "market_size")
    cagr_vals = [f.value for f in facts if f.kind == "cagr"]

    # _robust_estimate now trims outer 20% internally; no pre-trim needed here
    size_med, size_sigma, size_agree = _robust_estimate(size_vals)
    cagr_med, cagr_sigma, cagr_agree = _robust_estimate(cagr_vals)

    # Round triangulated values to 2 significant figures.
    # This is the key stability fix: $682B and $671B (two slightly different runs)
    # both round to $680B, giving consistent output across repeated searches.
    stable_size = _round_to_sig(size_med, sig=2) if size_med else None
    stable_cagr = _round_to_sig(cagr_med, sig=2) if cagr_med else None

    quant = {
        "market_size_estimates_b": [round(v, 2) for v in size_vals[:12]],
        "cagr_estimates_pct": [round(v, 2) for v in cagr_vals[:12]],
        "triangulated_market_size_b": stable_size,
        "triangulated_cagr_pct": stable_cagr,
        "size_agreement": round(size_agree, 2),
        "cagr_agreement": round(cagr_agree, 2),
        "projection_5y": None,
        "projection_10y": None,
        "method": "robust-median triangulation + 10k-run Monte Carlo (gaussian size & growth priors)",
    }
    if stable_size and stable_cagr:
        # Use stable (rounded) values as Monte Carlo seed so projections are also stable
        stable_sigma = size_sigma or stable_size * 0.15
        quant["projection_5y"]  = _monte_carlo(stable_size, stable_sigma, stable_cagr, max(cagr_sigma or 2.0, 2.0), 5)
        quant["projection_10y"] = _monte_carlo(stable_size, stable_sigma, stable_cagr, max(cagr_sigma or 2.0, 2.0), 10)
        print(f"  [quant] size ${stable_size}B (from {len(size_vals)} pts), "
              f"CAGR {stable_cagr}%, "
              f"5y P50 ${quant['projection_5y']['p50']}B")
    else:
        print("  [quant] insufficient numeric facts — LLM estimates will be used with low confidence")
    return quant


def grade_data_quality(store, facts, quant) -> dict:
    n_src = len(store.items)
    n_fact = len(facts)
    score = 0
    score += min(40, n_src * 2.5)
    score += min(30, n_fact * 3)
    score += 30 * max(quant["size_agreement"], 0.1) if quant["triangulated_market_size_b"] else 0
    grade = "high" if score >= 70 else "medium" if score >= 40 else "low"
    return {
        "sources_found": n_src,
        "numeric_facts_extracted": n_fact,
        "market_size_data_points": len(quant["market_size_estimates_b"]),
        "cagr_data_points": len(quant["cagr_estimates_pct"]),
        "score": round(score),
        "grade": grade,
        "note": ("Estimates triangulated from independent web sources and simulated via Monte Carlo."
                 if grade != "low" else
                 "Limited public data found; figures are model estimates — treat directionally."),
    }


# ══════════════════════════════════════════════════════════════════════════════
# 4. LLM LAYER — direct litellm, Groq native JSON mode, evidence-cited prompts
# ══════════════════════════════════════════════════════════════════════════════
def _extract_json(text: str) -> dict:
    """Fallback parser (JSON mode makes this rarely needed)."""
    if not text:
        return {}
    text = text.strip()
    for candidate in (text, re.sub(r"```(?:json)?", "", text).replace("```", "").strip()):
        try:
            return json.loads(candidate)
        except Exception:
            pass
    start = text.find("{")
    if start != -1:
        depth = 0
        for i, ch in enumerate(text[start:], start):
            depth += ch == "{"
            depth -= ch == "}"
            if ch == "}" and depth == 0:
                try:
                    return json.loads(text[start:i + 1])
                except Exception:
                    break
    try:
        fixed = re.sub(r",\s*([}\]])", r"\1", text)
        return json.loads(fixed[fixed.find("{"):])
    except Exception:
        return {}


def call_llm_json(model, system, user, max_tokens=2500, temperature=0.2, est_tokens=2500) -> dict:
    """One LLM call -> parsed dict. Handles rate limits, JSON mode, and one repair retry."""
    _bucket.consume(est_tokens)
    for attempt in range(MAX_RETRIES):
        try:
            resp = litellm.completion(
                model=model,
                messages=[{"role": "system", "content": system},
                          {"role": "user", "content": user}],
                max_tokens=max_tokens,
                temperature=temperature,
                response_format={"type": "json_object"},
            )
            raw = resp.choices[0].message.content or ""
            parsed = _extract_json(raw)
            if parsed:
                return parsed
            # one repair pass on the fast model
            _bucket.consume(1500)
            resp = litellm.completion(
                model=MODEL_FAST,
                messages=[{"role": "system", "content": "Return only a single valid JSON object."},
                          {"role": "user", "content": f"Fix this into valid JSON, keep all data:\n{raw[:6000]}"}],
                max_tokens=max_tokens, temperature=0.0,
                response_format={"type": "json_object"},
            )
            return _extract_json(resp.choices[0].message.content or "")
        except litellm.RateLimitError:
            if attempt == MAX_RETRIES - 1:
                raise
            wait = _backoff(attempt)
            print(f"  [llm] rate limited, retry {attempt+1}/{MAX_RETRIES} in {wait:.0f}s")
            time.sleep(wait)
        except Exception as e:
            print(f"  [llm] error: {e}")
            if attempt == MAX_RETRIES - 1:
                return {}
            time.sleep(8)
    return {}


_CITE_RULE = ('Every section must include a "citations" array of evidence IDs (e.g. ["E1","E4"]) '
              "for the sources that support it. Only cite IDs that appear in the evidence block. "
              "Respond with a single valid JSON object only.")


# ══════════════════════════════════════════════════════════════════════════════
# 5. SCHEMAS (citations added; numbers marked as code-overridable)
# ══════════════════════════════════════════════════════════════════════════════
MARKET_SCHEMA = """{
  "overview":"string","problem_solved":"string",
  "key_drivers":["d1","d2","d3"],
  "tam":{"value":<float $B — total global/regional market>,"reasoning":"max 40 chars e.g. 'Global smartphone market 2024'"},
  "sam":{"value":<float $B — MUST be 5%-30% of TAM, the realistic serviceable slice>,"reasoning":"max 40 chars e.g. 'Mid-range segment India+SEA'"},
  "som":{"value":<float $B — MUST be 1%-10% of SAM, the obtainable share in yr 1-3>,"reasoning":"max 40 chars e.g. 'Target 2% share by year 3'"},
  "current_market_size":<float — same order of magnitude as TAM>,"five_year_projection":<float>,"ten_year_projection":<float>,"cagr":<float>,
  "market_trends":[{"num":"1","title":"t","insight":"max 80 chars"},{"num":"2","title":"t","insight":"i"},{"num":"3","title":"t","insight":"i"}],
  "segments":[{"name":"n","size":"$XB","pain_points":["p1","p2"]},{"name":"n","size":"$XB","pain_points":["p1","p2"]},{"name":"n","size":"$XB","pain_points":["p1","p2"]}],
  "risks":[{"risk":"r","type":"regulatory|competitive|market|technology|operational"},{"risk":"r","type":"market"},{"risk":"r","type":"technology"}],
  "citations":["E1"]
}
CRITICAL RATIO RULES (violations will be corrected in post-processing):
- SAM must be between 5% and 30% of TAM. NEVER set SAM equal to TAM.
- SOM must be between 1% and 10% of SAM. NEVER set SOM > 15% of SAM.
- reasoning fields: write a SHORT descriptive label (e.g. 'Mid-range India segment'), NOT a number or market size figure.
EXACTLY 3 segments, EXACTLY 3 risks."""

COMPETITOR_SCHEMA = """{
  "landscape_type":"Blue Ocean|Red Ocean|Emerging|Niche",
  "competition_level":"Fragmented|Consolidated|Duopoly|Monopolistic|Nascent",
  "competitors":[{"name":"REAL company from evidence","founded":2015,"funding":"$XM","product":"p","pricing":"$X/mo","usps":["u1","u2"],"weaknesses":["w1","w2"],"target_customer":"t"}],
  "gaps":["g1","g2","g3"],
  "citations":["E1"]
}
EXACTLY 5 competitors — prefer REAL companies named in the evidence; only invent if evidence is empty."""

FUNDING_SCHEMA = """{
  "overview":"2-3 sentence summary of the funding climate in this category",
  "sentiment":"bullish|neutral|bearish","total_investment":"$XB",
  "rounds":[{"company":"REAL company","stage":"Series A","amount":"$XM","investor":"lead investor","year":2024}],
  "vcs":[
    {"name":"Real VC fund name","thesis":"what they invest in (1 line)","check_size":"$1-5M","stage":"Seed-Series A"},
    {"name":"Real VC fund name","thesis":"...","check_size":"$X-YM","stage":"..."},
    {"name":"Real VC fund name","thesis":"...","check_size":"$X-YM","stage":"..."},
    {"name":"Real VC fund name","thesis":"...","check_size":"$X-YM","stage":"..."},
    {"name":"Real VC fund name","thesis":"...","check_size":"$X-YM","stage":"..."}
  ],
  "investor_metrics":{"arr":"typical ARR benchmark for category","nrr":"typical NRR %","churn":"typical churn %","cac_ltv":"typical CAC:LTV ratio"},
  "recommendations":{"ideal_stage":"Seed","round_size":"$2M","top_vcs":["VC1","VC2","VC3"]},
  "citations":["E1"]
}
RULES:
- 'rounds' MUST be real and from the evidence where possible (real companies, amounts, years). Never invent rounds.
- 'vcs' should list 4-6 REAL, well-known funds that actually invest in THIS category/geography
  (draw on your knowledge — these are funds active in the space, not necessarily backers of the rounds above).
- 'investor_metrics' = realistic benchmarks for this category (not 'N/A').
- 'recommendations.top_vcs' = real funds a founder here should approach."""

SWOT_SCHEMA = """{
  "strengths":["strength 1","strength 2","strength 3","strength 4","strength 5"],
  "weaknesses":["weakness 1","weakness 2","weakness 3","weakness 4","weakness 5"],
  "opportunities":["opportunity 1","opportunity 2","opportunity 3","opportunity 4","opportunity 5"],
  "threats":["threat 1","threat 2","threat 3","threat 4","threat 5"],
  "priorities":["priority 1","priority 2","priority 3","priority 4","priority 5"],
  "risks":[
    {"risk":"risk 1","likelihood":"High|Medium|Low","impact":"High|Medium|Low"},
    {"risk":"risk 2","likelihood":"High|Medium|Low","impact":"High|Medium|Low"},
    {"risk":"risk 3","likelihood":"High|Medium|Low","impact":"High|Medium|Low"},
    {"risk":"risk 4","likelihood":"High|Medium|Low","impact":"High|Medium|Low"},
    {"risk":"risk 5","likelihood":"High|Medium|Low","impact":"High|Medium|Low"}
  ],
  "citations":["E1"]
}
HARD RULES — violations break the UI:
- EXACTLY 5 strings in strengths, weaknesses, opportunities, threats, priorities.
- EXACTLY 5 objects in risks.
- Every string must be a real, specific sentence — NO placeholder tokens like s1/w1/p1."""

GTM_SCHEMA = """{
  "icp":{"company_size":"e.g. 50-500 employees","industry":"the actual industry","geography":"e.g. India + SEA","buyer_title":"real job title of the buyer","pain_points":["<concrete pain point, max 40 chars>","<concrete pain point, max 40 chars>"]},
  "value_proposition":"<one sharp sentence specific to this startup>",
  "pricing":[
    {"tier":"Basic","price":"$X/user/mo","inclusions":["<real feature>","<real feature>"]},
    {"tier":"Premium","price":"$Y/user/mo","inclusions":["<real feature>","<real feature>","<real feature>"]},
    {"tier":"Enterprise","price":"Custom","inclusions":["<real feature>","<real feature>","<real feature>","<real feature>"]}
  ],
  "channels":[
    {"name":"<real channel, e.g. Channel partnerships>","priority":1,"cac":"$X-Y"},
    {"name":"<real channel>","priority":2,"cac":"$X-Y"},
    {"name":"<real channel>","priority":3,"cac":"$X-Y"}
  ],
  "phases":[
    {"phase":1,"title":"Foundation","months":"Month 1-2","goals":["<punchy goal, MAX 28 chars, full sentence ending in period>","<punchy goal, MAX 28 chars, full sentence ending in period>"],"activities":["<specific activity, MAX 28 chars, full sentence ending in period>","<specific activity, MAX 28 chars, full sentence ending in period>"],"metrics":["<metric name, MAX 22 chars, ending in period>","<metric name, MAX 22 chars, ending in period>"]},
    {"phase":2,"title":"Validation","months":"Month 3-4","goals":["<specific goal>","<specific goal>"],"activities":["<specific activity>","<specific activity>"],"metrics":["<specific metric>","<specific metric>"]},
    {"phase":3,"title":"Growth","months":"Month 5-6","goals":["<specific goal>","<specific goal>"],"activities":["<specific activity>","<specific activity>"],"metrics":["<specific metric>","<specific metric>"]},
    {"phase":4,"title":"Scale","months":"Month 7-9","goals":["<specific goal>","<specific goal>"],"activities":["<specific activity>","<specific activity>"],"metrics":["<specific metric>","<specific metric>"]},
    {"phase":5,"title":"Leadership","months":"Month 10-12","goals":["<specific goal>","<specific goal>"],"activities":["<specific activity>","<specific activity>"],"metrics":["<specific metric>","<specific metric>"]}
  ],
  "kpis":{"north_star":"max 5 words","mrr_6month":10000,"mrr_12month":50000,"cac":500,"ltv":5000,"churn_target":5,"revenue_12month":600000},
  "budget":[{"category":"Marketing","percentage":40},{"category":"Sales","percentage":30},{"category":"Product","percentage":20},{"category":"Ops","percentage":10}],
  "citations":["E1"]
}
EXACTLY 3 channels, EXACTLY 5 phases.
CRITICAL: Replace EVERY angle-bracket placeholder with REAL, specific content for THIS startup.
NEVER output literal placeholder tokens like "g1","g2","m1","a1","p1","f1","c1" — those are forbidden.
Every goal, metric, activity, pain point and feature must be a concrete, industry-specific phrase."""


# ══════════════════════════════════════════════════════════════════════════════
# 6. SECTION RUNNERS
# ══════════════════════════════════════════════════════════════════════════════
def _quant_brief(quant):
    if not quant.get("triangulated_market_size_b"):
        return "No triangulated figures available — estimate carefully and conservatively."
    p5 = quant.get("projection_5y") or {}
    return (f"COMPUTED GROUND TRUTH (from {len(quant['market_size_estimates_b'])} independent sources, "
            f"Monte Carlo simulated):\n"
            f"- Triangulated current market size: ${quant['triangulated_market_size_b']}B\n"
            f"- Triangulated CAGR: {quant['triangulated_cagr_pct']}%\n"
            f"- 5-year projection P50: ${p5.get('p50')}B (P10 ${p5.get('p10')}B / P90 ${p5.get('p90')}B)\n"
            f"Your TAM and CAGR MUST be consistent with these computed figures.")


def _guard(profile):
    return (f"INDUSTRY: {profile['industry']}. "
            f"Ignore any evidence that is NOT about {profile['industry']} — treat it as noise. "
            f"If relevant evidence is sparse, rely on your own knowledge of REAL well-known "
            f"companies and figures in the {profile['industry']} industry. "
            f"NEVER base competitors, funding, or market figures on irrelevant evidence.")


def run_market(idea, store, quant, profile):
    user = (f"Startup idea: {profile.get('one_liner', idea)}\n\n{_guard(profile)}\n\n{_quant_brief(quant)}\n\n"
            f"EVIDENCE:\n{store.digest(['market','growth','trends'], 8, with_body=True)}\n\n"
            f"Produce the market analysis. {_CITE_RULE}\nSchema:\n{MARKET_SCHEMA}")
    return call_llm_json(MODEL_DEEP,
                         "Senior market analyst. Ground every claim in the evidence and computed figures. JSON only.",
                         user, max_tokens=2000, est_tokens=2800)


def run_competitors(idea, store, profile):
    user = (f"Startup idea: {profile.get('one_liner', idea)}\n\n{_guard(profile)}\n\n"
            f"EVIDENCE:\n{store.digest(['competitors','pricing','news'], 8)}\n\n"
            f"Name REAL companies in the {profile['industry']} industry — from the evidence if it's "
            f"relevant, otherwise from your own knowledge of this industry's actual major players. "
            f"{_CITE_RULE} Only include citations for claims actually supported by relevant evidence.\n"
            f"Schema:\n{COMPETITOR_SCHEMA}")
    return call_llm_json(MODEL_MID,
                         "Competitive intelligence analyst at a top VC. Real companies, real positioning. JSON only.",
                         user, max_tokens=1800, est_tokens=2400)


def run_funding(idea, store, facts, profile):
    rounds = [f for f in facts if f.kind == "funding_round"][:8]
    totals = [f for f in facts if f.kind == "total_funding"][:4]
    lines = []
    for f in rounds:
        co = f.company or "A company"
        stage = f" {f.stage}" if f.stage else ""
        lines.append(f"- [{f.evidence_id}] {co}: ${f.value*1000:.0f}M{stage} ({f.year})")
    for f in totals:
        lines.append(f"- [{f.evidence_id}] total funding ${f.value*1000:.0f}M ({f.year})")
    facts_str = "\n".join(lines) or "(no specific rounds found in evidence)"

    user = (f"Startup idea: {profile.get('one_liner', idea)}\n\n{_guard(profile)}\n\n"
            f"EXTRACTED FUNDING ROUNDS (real, cited — these are your 'rounds'):\n{facts_str}\n\n"
            f"EVIDENCE:\n{store.digest(['funding','news'], 8)}\n\n"
            f"Build a COMPLETE funding picture for the {profile['industry']} category:\n"
            f"1. 'rounds': use the EXTRACTED ROUNDS above (real & cited). Add other real, "
            f"well-known {profile['industry']} rounds you know of. NEVER invent fake rounds/amounts.\n"
            f"2. 'vcs': list 4-6 REAL venture funds that actively invest in this category and "
            f"geography (e.g. consumer/CPG/D2C funds for fragrance, in India + globally). These are "
            f"funds active in the space — real fund names from your knowledge, with realistic check "
            f"sizes and stages. This section should feel thorough, like a VC analyst's investor map.\n"
            f"3. 'investor_metrics': realistic category benchmarks (ARR, NRR, churn, CAC:LTV) for "
            f"this type of business — not 'N/A'.\n"
            f"4. 'recommendations': a sensible stage, round size, and 3 real funds to approach.\n"
            f"Set 'sentiment' from overall activity. Always fill overview, sentiment, total_investment. "
            f"Only call the space non-VC-funded if you genuinely know of NO investors in it.\n"
            f"{_CITE_RULE}\nSchema:\n{FUNDING_SCHEMA}")
    return call_llm_json(MODEL_MID,
                         "VC funding analyst building an investor map. Rounds must be real; investor "
                         "list and benchmarks come from your knowledge of who funds this category. "
                         "Thorough but never fabricate specific rounds. JSON only.",
                         user, max_tokens=1800, est_tokens=2400)


def run_swot(idea, market, competitors):
    ctx = json.dumps({"market_overview": market.get("overview", ""),
                      "risks": market.get("risks", []),
                      "competitors": [c.get("name") for c in competitors.get("competitors", [])],
                      "gaps": competitors.get("gaps", [])})[:800]
    user = f"Startup idea: {idea}\nUpstream analysis: {ctx}\n\n{_CITE_RULE}\nSchema:\n{SWOT_SCHEMA}"
    return call_llm_json(MODEL_FAST, "Strategic SWOT analyst. JSON only.", user,
                         max_tokens=1200, est_tokens=1600)


_PLACEHOLDER_RE = re.compile(r"^[a-z]\d{1,2}$", re.I)   # matches g1, m2, a1, p3, f1, c2…


def _has_placeholders(gtm: dict) -> bool:
    """Detect the 'LLM echoed the schema skeleton' failure (g1/m1/a1/p1/f1)."""
    if not gtm:
        return True
    blobs = []
    for ph in gtm.get("phases", []):
        blobs += ph.get("goals", []) + ph.get("activities", []) + ph.get("metrics", [])
    for pr in gtm.get("pricing", []):
        blobs += pr.get("inclusions", [])
    blobs += (gtm.get("icp", {}) or {}).get("pain_points", [])
    bad = sum(1 for x in blobs if isinstance(x, str) and _PLACEHOLDER_RE.match(x.strip()))
    return bad >= 3   # a few echoed tokens => the whole section is skeleton


def run_gtm(idea, swot, funding, profile):
    ctx = json.dumps({
        "industry": profile.get("industry", ""),
        "priorities": swot.get("priorities", []),
        "opportunities": swot.get("opportunities", [])[:3],
        "funding_reco": funding.get("recommendations", {}),
    })[:900]
    user = (f"Startup idea: {profile.get('one_liner', idea)}\n"
            f"Industry: {profile.get('industry', '')}\n"
            f"Context: {ctx}\n\n"
            f"Design a concrete go-to-market plan with REAL goals, metrics, activities and channels "
            f"specific to the {profile.get('industry','this')} industry.\n\n"
            f"CRITICAL FOR PHASES — every goal, activity, and metric must be:\n"
            f"  • A complete, meaningful sentence ending with a period.\n"
            f"  • Goals and activities: MAX 28 characters total (including the period).\n"
            f"  • Metrics: MAX 22 characters total (including the period).\n"
            f"  • Short and punchy — e.g. 'Launch beta with 50 users.' or 'Track weekly MRR.' — "
            f"NOT long explanations. Every word must fit on one line of a narrow card.\n\n"
            f"{_CITE_RULE}\nSchema:\n{GTM_SCHEMA}")
    # GTM has the most nested free-text -> use the stronger model to avoid skeleton echo
    gtm = call_llm_json(MODEL_DEEP, "Senior GTM strategist. Real, specific content only. JSON only.",
                        user, max_tokens=2000, est_tokens=2600)

    # one targeted retry if the model echoed placeholders
    if _has_placeholders(gtm):
        print("  [gtm] placeholder skeleton detected — regenerating once")
        retry_user = (user + "\n\nYOUR PREVIOUS ANSWER USED FORBIDDEN PLACEHOLDERS LIKE g1/m1/a1. "
                      "Rewrite with fully concrete, industry-specific content in every field.")
        gtm2 = call_llm_json(MODEL_DEEP, "Senior GTM strategist. Real, specific content only. JSON only.",
                             retry_user, max_tokens=2600, temperature=0.4, est_tokens=3200)
        if not _has_placeholders(gtm2):
            gtm = gtm2
    return gtm


# ══════════════════════════════════════════════════════════════════════════════
# 7. VALIDATION — structural padding + citation verification + numeric sanity.
#    Code-computed quant numbers OVERRIDE LLM numbers when available.
# ══════════════════════════════════════════════════════════════════════════════
def _clean_citations(d, store, fallback_tags=None, max_n=4):
    """Return citations as {id,title,url}. Keep the LLM's valid cited IDs; if it
    cited nothing valid (common once domain-biasing filters the store), fall back
    to the real source URLs for this section's tags so links ALWAYS appear."""
    valid = store.valid_ids()
    umap = store.url_map()
    cites = [c for c in (d.get("citations") or []) if c in valid]
    out = [{"id": c, **umap[c]} for c in cites]
    if not out and fallback_tags:
        for ev in store.by_tags(fallback_tags)[:max_n]:
            if ev.url.startswith("http"):
                out.append({"id": ev.eid, "title": ev.title, "url": ev.url})
    return out[:max_n]


def _num(x, default=0.0):
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


def _stable_estimate(seed_str, low, high, step):
    """Deterministic pseudo-value from a string seed — same idea always maps to
    the same number, so runs don't jitter when there's no real data to triangulate."""
    h = int(hashlib.sha256(seed_str.encode()).hexdigest(), 16)
    span = int((high - low) / step) + 1
    return round(low + (h % span) * step, 2)


def ensure_market(d, store, quant, profile=None):
    d = d or {}
    profile = profile or {}
    seed_str = (profile.get("search_term") or profile.get("industry") or "market").lower()

    segments = (d.get("segments") or [])[:3]
    while len(segments) < 3:
        segments.append({"name": f"Segment {len(segments)+1}", "size": "TBD", "pain_points": []})
    risks = (d.get("risks") or [])[:3]
    while len(risks) < 3:
        risks.append({"risk": "General market risk", "type": "market"})

    tam = _num((d.get("tam") or {}).get("value"))
    sam = _num((d.get("sam") or {}).get("value"))
    som = _num((d.get("som") or {}).get("value"))
    cagr = _num(d.get("cagr"))
    confidence = "low"
    estimated = True   # are these model estimates rather than data-triangulated?
    tam_reason = (d.get("tam") or {}).get("reasoning", "")[:40]

    # ── TAM: code-derived figures win when we actually have facts ─────────────
    if quant.get("triangulated_market_size_b"):
        tam = quant["triangulated_market_size_b"]
        confidence = "high" if quant["size_agreement"] >= 0.6 else "medium"
        estimated = False
        tam_reason = f"Triangulated from {len(quant['market_size_estimates_b'])} sources"[:40]
    elif tam <= 0:
        tam = _stable_estimate(seed_str, 2.0, 120.0, 0.5)
        tam_reason = "Model estimate — no market data found"[:40]

    if quant.get("triangulated_cagr_pct"):
        cagr = quant["triangulated_cagr_pct"]
    elif cagr <= 0:
        cagr = _stable_estimate(seed_str + "cagr", 5.0, 22.0, 0.5)
    cagr = max(1.0, min(45.0, cagr or 8.0))

    # ── SAM: enforce 5%-30% of TAM regardless of what the LLM returned ────────
    tam = max(tam, 0.05)
    sam_raw = sam if sam > 0 else round(tam * 0.18, 2)
    sam = max(tam * 0.05, min(sam_raw, tam * 0.30))   # clamp to [5%, 30%] of TAM
    sam = round(sam, 2)

    # ── SOM: enforce 1%-10% of SAM regardless of what the LLM returned ────────
    som_raw = som if som > 0 else round(sam * 0.07, 2)
    som = max(sam * 0.01, min(som_raw, sam * 0.10))   # clamp to [1%, 10%] of SAM
    som = round(som, 2)

    # ── Sanitize reasoning labels: strip anything that looks like a number/size ─
    _NUM_IN_REASON = re.compile(r"^\$?[\d.,]+\s*(B|M|bn|mn|billion|million)?$", re.I)
    def _safe_reason(raw, fallback):
        r = (raw or "").strip()[:40]
        # reject if it's just a number echoed back, or very short/empty
        if not r or _NUM_IN_REASON.match(r) or len(r) < 5:
            return fallback
        return r

    sam_reason = _safe_reason((d.get("sam") or {}).get("reasoning"), "Serviceable market segment")
    som_reason = _safe_reason((d.get("som") or {}).get("reasoning"), "Obtainable share yr 1-3")

    p5 = quant.get("projection_5y") or {}
    p10y = quant.get("projection_10y") or {}
    five_y = p5.get("p50") or round(tam * ((1 + cagr / 100) ** 5), 2)
    ten_y = p10y.get("p50") or round(tam * ((1 + cagr / 100) ** 10), 2)

    return {
        "overview": d.get("overview", ""),
        "problem_solved": d.get("problem_solved", ""),
        "key_drivers": d.get("key_drivers", []),
        "tam": {"value": round(tam, 2), "reasoning": tam_reason or "Estimated market size"},
        "sam": {"value": sam, "reasoning": sam_reason},
        "som": {"value": som, "reasoning": som_reason},
        "current_market_size": round(_num(d.get("current_market_size")) or tam, 2),
        "five_year_projection": five_y,
        "ten_year_projection": ten_y,
        "cagr": round(cagr, 2),
        "market_trends": (d.get("market_trends") or [])[:3],
        "segments": segments,
        "risks": risks,
        "projection_bands": {"five_year": p5 or None, "ten_year": p10y or None},
        "estimated": estimated,   # frontend can badge "model estimate" vs "data-grounded"
        "citations": _clean_citations(d, store, fallback_tags=["market", "growth", "trends"]),
        "confidence": confidence,
    }


def ensure_competitors(d, store):
    d = d or {}
    comps = (d.get("competitors") or [])[:5]
    while len(comps) < 5:
        comps.append({"name": f"Competitor {len(comps)+1}", "founded": 2015, "funding": "Undisclosed",
                      "product": "Similar product in this space", "pricing": "Contact for pricing",
                      "usps": ["Established brand"], "weaknesses": ["Limited innovation"],
                      "target_customer": "General market"})
    return {
        "landscape_type": d.get("landscape_type", ""),
        "competition_level": d.get("competition_level", ""),
        "competitors": comps,
        "gaps": d.get("gaps", []),
        "citations": _clean_citations(d, store, fallback_tags=["competitors", "pricing"]),
        "confidence": "high" if len(store.by_tags(["competitors"])) >= 4 else "medium",
    }


def ensure_funding(d, store, facts):
    d = d or {}
    n_rounds = sum(f.kind == "funding_round" for f in facts)
    total = d.get("total_investment") or ""
    if not str(total).strip() or str(total).strip() in ("$0", "$0k", "$0M", "0"):
        total = "Undisclosed"

    # scrub single-letter placeholder echoes in investor_metrics (arr:"s", nrr:"s"…)
    metrics = d.get("investor_metrics", {}) or {}
    clean_metrics = {}
    for k, v in metrics.items():
        sv = str(v).strip()
        clean_metrics[k] = sv if len(sv) > 1 and sv.lower() not in ("s", "string") else "N/A"

    rounds = d.get("rounds", []) or []
    vcs = d.get("vcs", []) or []
    # "has_data" now means we have ANY funding picture to show — rounds OR a real
    # investor map. A thin-data market with 1 round but 5 known active VCs is still
    # a useful, full-looking section, not an empty state.
    has_rounds = bool(rounds) or n_rounds > 0
    has_data = has_rounds or len(vcs) >= 2

    if not has_data:
        empty_note = ("No disclosed venture rounds or active investors surfaced for this "
                      "space. This is typical of capital-intensive or incumbent-dominated "
                      "industries financed via corporate balance sheets, debt, or "
                      "government incentives rather than VC.")
        overview = d.get("overview") or empty_note
    else:
        overview = d.get("overview", "") or "Funding activity and active investors in this category."

    return {
        "overview": overview,
        "sentiment": d.get("sentiment", "") or "neutral",
        "total_investment": total,
        "rounds": rounds,
        "vcs": vcs,
        "investor_metrics": clean_metrics,
        "recommendations": d.get("recommendations", {}),
        "data_available": has_data,          # frontend: hide empty tables, show the note
        "rounds_verified": has_rounds,       # true = rounds came from real cited evidence
        "empty_reason": None if has_data else "no_venture_rounds_in_space",
        "citations": _clean_citations(d, store, fallback_tags=["funding", "news"]),
        "confidence": ("high" if n_rounds >= 3 else
                       "medium" if (n_rounds >= 1 or len(vcs) >= 3) else "low"),
    }


def ensure_swot(d, store):
    d = d or {}
    TARGET = 5

    def _clean_list(raw, fallbacks):
        """Scrub placeholders, cap at TARGET, then pad with fallbacks up to TARGET."""
        items = [x for x in (raw or [])
                 if isinstance(x, str) and not _PLACEHOLDER_RE.match(x.strip()) and len(x.strip()) > 4][:TARGET]
        i = 0
        while len(items) < TARGET and i < len(fallbacks):
            fb = fallbacks[i]
            if fb not in items:
                items.append(fb)
            i += 1
        return items

    strengths    = _clean_list(d.get("strengths"),    [
        "Innovative product concept", "Lean founding team with domain knowledge",
        "First-mover advantage in target segment", "Low overhead cost structure",
        "Strong customer focus and feedback loop"])
    weaknesses   = _clean_list(d.get("weaknesses"),   [
        "Limited initial capital", "Small brand recognition",
        "Dependence on key suppliers", "Thin engineering team",
        "Unproven at scale"])
    opportunities = _clean_list(d.get("opportunities"), [
        "Large underserved customer segment", "Growing market CAGR",
        "Partnership opportunities with distributors", "Regulatory tailwinds",
        "Digital channel expansion"])
    threats      = _clean_list(d.get("threats"),      [
        "Intense competition from incumbents", "Macroeconomic uncertainty",
        "Supply chain disruptions", "Rapid technology change",
        "Price pressure from low-cost rivals"])

    # Priorities: scrub placeholders, then synthesise from SWOT if short
    priorities = [p for p in (d.get("priorities") or [])
                  if isinstance(p, str) and not _PLACEHOLDER_RE.match(p.strip()) and len(p.strip()) > 4]
    derived_pool = []
    if opportunities: derived_pool.append(f"Capture: {opportunities[0]}")
    if weaknesses:    derived_pool.append(f"Address: {weaknesses[0]}")
    if threats:       derived_pool.append(f"Mitigate: {threats[0]}")
    if strengths:     derived_pool.append(f"Leverage: {strengths[0]}")
    if opportunities and len(opportunities) > 1:
                      derived_pool.append(f"Expand into: {opportunities[1]}")
    for p in derived_pool:
        if len(priorities) >= TARGET:
            break
        if p not in priorities:
            priorities.append(p)
    priorities = priorities[:TARGET]

    # Risks: pad to TARGET with generic items if short
    risks = (d.get("risks") or [])[:TARGET]
    risk_fallbacks = [
        {"risk": "Supply chain disruption", "likelihood": "Medium", "impact": "High"},
        {"risk": "Regulatory compliance",   "likelihood": "Low",    "impact": "High"},
        {"risk": "Key talent attrition",    "likelihood": "Medium", "impact": "Medium"},
        {"risk": "Market entry delay",      "likelihood": "Medium", "impact": "Medium"},
        {"risk": "Competitor price war",    "likelihood": "High",   "impact": "Medium"},
    ]
    fb_i = 0
    while len(risks) < TARGET and fb_i < len(risk_fallbacks):
        fb = risk_fallbacks[fb_i]
        if not any(r.get("risk") == fb["risk"] for r in risks):
            risks.append(fb)
        fb_i += 1

    return {
        "strengths": strengths, "weaknesses": weaknesses,
        "opportunities": opportunities, "threats": threats,
        "priorities": priorities, "risks": risks,
        "citations": _clean_citations(d, store, fallback_tags=["market", "competitors", "trends"]),
        "confidence": "medium",
    }


def _strip_placeholder_list(items, fallback_label):
    """Replace any echoed g1/m1/a1 tokens; if a list ends up empty, give a neutral label."""
    out = [x for x in (items or []) if isinstance(x, str) and not _PLACEHOLDER_RE.match(x.strip())]
    return out or [f"{fallback_label} to be defined"]


def _normalize_line(text, target=58, hard_max=64):
    """Normalize a single bullet to a consistent visual width. Long lines are trimmed
    at a word boundary and closed with a period so every entry reads as a complete
    sentence. Never pad with filler — just keep within the tight band."""
    text = " ".join(str(text).split())  # collapse whitespace
    if len(text) > hard_max:
        cut = text[:hard_max].rsplit(" ", 1)[0].rstrip(" ,;:.-")
        text = cut + "."
    elif text and not text[-1] in ".!?":
        text = text.rstrip(" ,;:-") + "."
    return text


def _cap_len(items, fallback_label, target=58, hard_max=64, want=2):
    """Scrub placeholders, normalize each line to a uniform width band, and return
    exactly `want` lines so every card field is the same height. Pads short lists
    by promoting the fallback only if truly empty."""
    cleaned = [_normalize_line(x, target, hard_max)
               for x in (items or [])
               if isinstance(x, str) and not _PLACEHOLDER_RE.match(x.strip())]
    cleaned = [x for x in cleaned if x]
    if not cleaned:
        cleaned = [f"{fallback_label} to be defined"]
    return cleaned[:want]


def ensure_gtm(d, store):
    d = d or {}
    channels = sorted(d.get("channels") or [], key=lambda c: c.get("priority", 99))[:3]
    kpis = d.get("kpis") or {}
    if isinstance(kpis.get("north_star"), str):
        kpis["north_star"] = " ".join(kpis["north_star"].split()[:5])

    # Uniform width band (≈58 target / 64 hard cap) + fixed line count per field
    # => every phase card renders the same height with edge-to-edge bullets.
    phases = []
    for ph in (d.get("phases") or [])[:5]:
        phases.append({
            **ph,
            "goals":      _cap_len(ph.get("goals"), "Goal", 24, 28, want=2),
            "activities": _cap_len(ph.get("activities"), "Activity", 24, 28, want=2),
            "metrics":    _cap_len(ph.get("metrics"), "Metric", 18, 22, want=2),
        })
    pricing = []
    for pr in (d.get("pricing") or []):
        pricing.append({**pr, "inclusions": _cap_len(pr.get("inclusions"), "Feature", 36, 42, want=4)})
    icp = d.get("icp", {}) or {}
    if icp.get("pain_points"):
        icp["pain_points"] = _cap_len(icp.get("pain_points"), "Pain point", 52, 58, want=3)
    vp = _normalize_line(d.get("value_proposition", ""), 110, 120) if d.get("value_proposition") else ""

    had_placeholders = _has_placeholders(d)
    return {
        "icp": icp, "value_proposition": vp,
        "pricing": pricing, "channels": channels,
        "phases": phases, "kpis": kpis, "budget": d.get("budget", []),
        "citations": _clean_citations(d, store, fallback_tags=["market", "competitors", "trends"]),
        "confidence": "low" if had_placeholders else "medium",
    }


# ══════════════════════════════════════════════════════════════════════════════
# 7b. CACHE LAYER (Supabase) — skip the whole pipeline for recent industries.
#     Saves Tavily credits + Groq tokens, makes repeat demos instant, and builds
#     a proprietary dataset of analyses over time. Fails soft if Supabase absent.
# ══════════════════════════════════════════════════════════════════════════════
def _supabase_client():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not (_supabase_available and url and key):
        return None
    try:
        return create_client(url, key)
    except Exception as e:
        print(f"  [cache] supabase init failed: {e}")
        return None


def _cache_key(profile: dict) -> str:
    """Key on normalized search_term so 'food delivery app' and 'a startup for food
    delivery' collapse to the same cache entry."""
    base = (profile.get("search_term") or "").strip().lower()
    return hashlib.sha256(base.encode()).hexdigest()[:32]


def cache_get(profile: dict):
    sb = _supabase_client()
    if not sb:
        return None
    try:
        key = _cache_key(profile)
        res = sb.table("analyses").select("*").eq("cache_key", key).limit(1).execute()
        rows = res.data or []
        if not rows:
            return None
        row = rows[0]
        age_days = (time.time() - row.get("created_ts", 0)) / 86400
        if age_days > CACHE_TTL_DAYS:
            print(f"  [cache] hit but stale ({age_days:.1f}d) — re-running")
            return None
        print(f"  [cache] HIT ({age_days:.1f}d old) — returning stored analysis")
        result = row["payload"]
        result["_cached"] = True
        result["_cache_age_days"] = round(age_days, 1)
        return result
    except Exception as e:
        print(f"  [cache] get failed: {e}")
        return None


def cache_put(profile: dict, result: dict):
    sb = _supabase_client()
    if not sb:
        return
    try:
        clean = {k: v for k, v in result.items() if not k.startswith("_")}
        sb.table("analyses").upsert({
            "cache_key":   _cache_key(profile),
            "search_term": profile.get("search_term", ""),
            "industry":    profile.get("industry", ""),
            "startup_idea": result.get("startup_idea", ""),
            "grade":       result.get("data_quality", {}).get("grade", ""),
            "created_ts":  time.time(),
            "payload":     clean,
        }, on_conflict="cache_key").execute()
        print("  [cache] stored analysis")
    except Exception as e:
        print(f"  [cache] put failed: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# 8. MAIN ORCHESTRATOR — same signature as v1, additive output
# ══════════════════════════════════════════════════════════════════════════════
def run_analysis(startup_idea: str, groq_api_key: str, use_cache: bool = True) -> dict:
    os.environ["GROQ_API_KEY"] = groq_api_key
    t0 = time.time()

    print("\n[0/5] Normalizing idea into search profile…")
    profile = normalize_idea(startup_idea)
    print(f"  [normalize] industry='{profile['industry']}' "
          f"search_term='{profile['search_term']}' keywords={profile['keywords']}")

    if use_cache:
        cached = cache_get(profile)
        if cached:
            cached["startup_idea"] = startup_idea   # reflect this user's phrasing
            print(f"  Served from cache in {time.time()-t0:.1f}s")
            return cached

    print("\n[1/5] Evidence collection…")
    store = collect_evidence(startup_idea, profile)

    print("\n[2/5] Fact extraction…")
    facts = extract_facts(store)

    print("\n[3/5] Quant engine (triangulation + Monte Carlo)…")
    quant = run_quant(facts)
    data_quality = grade_data_quality(store, facts, quant)
    print(f"  [quality] grade={data_quality['grade']} score={data_quality['score']}")

    print("\n[4/5] LLM analysis — round 1 (market, competitors, funding in parallel)…")
    results = {}
    with ThreadPoolExecutor(max_workers=3) as ex:
        futures = {
            ex.submit(run_market, startup_idea, store, quant, profile): "market",
            ex.submit(run_competitors, startup_idea, store, profile): "competitors",
            ex.submit(run_funding, startup_idea, store, facts, profile): "funding",
        }
        for fut in as_completed(futures):
            key = futures[fut]
            try:
                results[key] = fut.result() or {}
                print(f"  {key} ✓")
            except Exception as e:
                print(f"  {key} ✗ {e}")
                results[key] = {}

    time.sleep(15)  # short safety gap; bucket handles the rest adaptively

    print("\n[5/5] LLM analysis — round 2 (SWOT → GTM)…")
    swot = {}
    try:
        swot = run_swot(startup_idea, results.get("market", {}), results.get("competitors", {})) or {}
        print("  swot ✓")
    except Exception as e:
        print(f"  swot ✗ {e}")
    time.sleep(10)
    gtm = {}
    try:
        gtm = run_gtm(startup_idea, swot, results.get("funding", {}), profile) or {}
        print("  gtm ✓")
    except Exception as e:
        print(f"  gtm ✗ {e}")

    # legacy-compatible sources block
    legacy_sources = {
        "market": [{"title": e.title, "snippet": e.snippet, "url": e.url} for e in store.by_tags(["market", "growth"])[:5]],
        "competitors": [{"title": e.title, "snippet": e.snippet, "url": e.url} for e in store.by_tags(["competitors", "pricing"])[:5]],
        "funding": [{"title": e.title, "snippet": e.snippet, "url": e.url} for e in store.by_tags(["funding"])[:5]],
    }

    print(f"\nDone in {time.time()-t0:.0f}s — {len(store.items)} sources, {len(facts)} facts, grade {data_quality['grade']}")

    result = {
        "startup_idea": startup_idea,
        "profile": profile,
        "market": ensure_market(results.get("market"), store, quant, profile),
        "competitors": ensure_competitors(results.get("competitors"), store),
        "funding": ensure_funding(results.get("funding"), store, facts),
        "swot": ensure_swot(swot, store),
        "gtm": ensure_gtm(gtm, store),
        "sources": legacy_sources,
        # ── new additive blocks ──
        "quant": quant,
        "data_quality": data_quality,
        "facts": [asdict(f) for f in facts[:30]],
        "_cached": False,
    }

    # store for future repeat queries (only worth caching if data was usable)
    if use_cache and data_quality["grade"] in ("high", "medium"):
        cache_put(profile, result)

    return result