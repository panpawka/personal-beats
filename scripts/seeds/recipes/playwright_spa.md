# Playwright recipe (JS-rendered sites)

For municipal sites and other SPAs that don't return content in the
initial HTML response. Slow (~3-8s per page) — use sparingly, cache
results.

## Python snippet
```python
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("https://www.wroclaw.pl/aktualnosci", wait_until="networkidle", timeout=30000)
    items = page.eval_on_selector_all(
        "article.news-item",
        "els => els.map(e => ({title: e.innerText, href: e.querySelector('a')?.href}))",
    )
    browser.close()
```

## When to use
- Municipal/government sites that hydrate from JS (common in PL, DE).
- Single-page-app news portals where view-source returns an empty
  shell.
- ONLY after confirming RSS autodiscovery + sitemap_news both fail.

## Cost discipline
Cap at 5 Playwright fetches per scout run. Each costs >5x a plain
requests.get.
