# Sitemap crawl recipe

For press sites without clear feeds. Most have sitemaps for SEO; news
sites publish a dedicated `sitemap_news.xml` per Google News spec.

## Common paths to try in order
1. `<site>/sitemap_news.xml` (Google News sitemap, often dated last 48h)
2. `<site>/sitemap.xml`
3. `<site>/robots.txt` (lists `Sitemap:` directives)

## Python snippet
```python
import requests, xml.etree.ElementTree as ET
r = requests.get("https://example-news.com/sitemap_news.xml", timeout=15)
root = ET.fromstring(r.text)
ns = {"news": "http://www.google.com/schemas/sitemap-news/0.9"}
items = []
for url in root.iter("{http://www.sitemaps.org/schemas/sitemap/0.9}url"):
    loc = url.find("{http://www.sitemaps.org/schemas/sitemap/0.9}loc").text
    title_el = url.find("news:news/news:title", ns)
    items.append({"url": loc, "title": title_el.text if title_el is not None else None})
```

Use when: RSS autodiscovery returns nothing AND robots.txt allows
the path.
