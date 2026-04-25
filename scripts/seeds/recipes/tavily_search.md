# Tavily Search recipe (optional, requires TAVILY_API_KEY)

Agent-tuned search, 1000 free searches/month. Used as a
second-opinion to Claude's built-in web_search when that returns
SEO-biased results.

## Check availability
```python
import os
api_key = os.environ.get("TAVILY_API_KEY")
if not api_key:
    # Fall back to DuckDuckGo HTML or built-in web_search
    raise RuntimeError("Tavily not configured; use built-in search")
```

## Python snippet
```python
import requests, os
api_key = os.environ["TAVILY_API_KEY"]
r = requests.post(
    "https://api.tavily.com/search",
    json={
        "api_key": api_key,
        "query": "Wrocław municipal council agendas",
        "max_results": 10,
        "search_depth": "advanced",
    },
    timeout=30,
)
results = r.json()["results"]
```

## When to prefer Tavily
- When Claude's web_search for a local beat returns mostly
  aggregators (SEO bias).
- When you need source-quality ranking (Tavily ranks primary sources
  higher by design).

NOTE: TAVILY_API_KEY is not currently provisioned in this environment.
Skip this recipe if `os.environ.get("TAVILY_API_KEY")` is None — fall
back to DuckDuckGo HTML or built-in web_search.
