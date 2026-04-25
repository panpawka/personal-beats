# RSS / Atom autodiscovery

Most press sites still publish feeds but bury the link.

## Python snippet
```python
import requests, re
from bs4 import BeautifulSoup
html = requests.get("https://example-news.com", timeout=15).text
soup = BeautifulSoup(html, "html.parser")
feeds = [
    link.get("href")
    for link in soup.find_all(
        "link",
        type=["application/rss+xml", "application/atom+xml"],
    )
]
# Fallback: try common paths
candidates = ["/feed", "/rss", "/feed.xml", "/atom.xml", "/rss.xml"]
```

Always try the `<link rel="alternate">` route first — it's
self-described. Only fall back to path-guessing.
