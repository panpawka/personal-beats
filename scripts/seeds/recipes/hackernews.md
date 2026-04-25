# Hacker News recipe

Algolia-backed HN search. Free, no auth.

## URL templates
- Search: `https://hn.algolia.com/api/v1/search?query=<Q>&tags=story`
- By date: `https://hn.algolia.com/api/v1/search_by_date?query=<Q>&tags=story`
- Live RSS: `https://hnrss.org/newest?q=<Q>`

## Python snippet
```python
import requests
r = requests.get(
    "https://hn.algolia.com/api/v1/search",
    params={"query": "claude agents", "tags": "story"},
    timeout=15,
)
hits = r.json()["hits"]
```

Strong signal for developer tools, AI, startups, tech business beats.
