# Jina Reader recipe

Clean markdown extraction from any article URL. Free, no key.

## URL template
`https://r.jina.ai/<URL>`

## Python snippet
```python
import requests
md = requests.get(
    "https://r.jina.ai/https://en.wikipedia.org/wiki/Wroc%C5%82aw",
    timeout=30,
).text
```

Use when:
- BS4 parsing returns paywall markup or login walls.
- You need headline+body+date from a press article and don't want
  to write per-site scraping logic.
- Editor is corroborating a claim and wants the canonical
  article text without noise.

Do NOT use for: RSS-bearing sites (RSS is cheaper and cleaner),
sites behind real auth.
