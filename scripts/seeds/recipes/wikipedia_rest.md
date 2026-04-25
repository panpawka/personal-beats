# Wikipedia REST recipe (entity verification)

Editor's primary tool for checking "did I get this name/place right?"
Free, no auth, multi-language.

## URL template
`https://<LANG>.wikipedia.org/api/rest_v1/page/summary/<TITLE>`

## Python snippet
```python
import requests, urllib.parse
title = urllib.parse.quote("Wrocław")
r = requests.get(
    f"https://pl.wikipedia.org/api/rest_v1/page/summary/{title}",
    timeout=15,
)
data = r.json()
# data["title"], data["description"], data["extract"], data["content_urls"]
```

Use for: disambiguation ("Springfield"), verifying a
politician/company exists, canonicalizing place names before
geocoding.
