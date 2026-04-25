# DuckDuckGo HTML search recipe

Free, zero-auth fallback when Claude web_search is biased and
Tavily isn't configured.

## URL
`https://html.duckduckgo.com/html/?q=<QUERY>`

## Python snippet
```python
import requests
from bs4 import BeautifulSoup
r = requests.get(
    "https://html.duckduckgo.com/html/",
    params={"q": "Wrocław rada miasta"},
    headers={"User-Agent": "Mozilla/5.0 PersonalNewsroom/0.1"},
    timeout=15,
)
soup = BeautifulSoup(r.text, "html.parser")
results = [
    (a.get_text(), a.get("href"))
    for a in soup.select("a.result__a")
]
```
