# GitHub Trending recipe

For developer beats. No official API — HTML scrape.

## URL
`https://github.com/trending/<lang>?since=daily|weekly|monthly`

Example: `https://github.com/trending/python?since=weekly`

## Python snippet
```python
import requests
from bs4 import BeautifulSoup
html = requests.get(
    "https://github.com/trending/python?since=weekly",
    headers={"User-Agent": "Mozilla/5.0"},
    timeout=15,
).text
soup = BeautifulSoup(html, "html.parser")
for article in soup.select("article.Box-row"):
    repo = article.h2.a.get_text(strip=True).replace(" ", "")
    desc = (article.p.get_text(strip=True) if article.p else "")
```
