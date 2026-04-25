# Google News RSS recipe

Zero-auth primary discovery for local AND topical beats.

## URL template
`https://news.google.com/rss/search?q=<QUERY>&hl=<LANG>&gl=<COUNTRY>&ceid=<COUNTRY>:<LANG>`

## Examples
- Wrocław news in Polish:
  `https://news.google.com/rss/search?q=Wroc%C5%82aw&hl=pl&gl=PL&ceid=PL:pl`
- AI agents in English:
  `https://news.google.com/rss/search?q=%22AI+agents%22&hl=en&gl=US&ceid=US:en`

## Python snippet
```python
import feedparser, urllib.parse
q = urllib.parse.quote("Wrocław")
url = f"https://news.google.com/rss/search?q={q}&hl=pl&gl=PL&ceid=PL:pl"
feed = feedparser.parse(url)
publishers = {e.source.title for e in feed.entries if hasattr(e, "source")}
```

## Gotcha
Google News aggregates — each `entry.source.title` is the actual
publisher domain. Use THOSE as your source candidates, not
`news.google.com` itself.
