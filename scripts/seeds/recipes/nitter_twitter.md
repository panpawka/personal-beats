# Nitter (X/Twitter) RSS recipe

Zero-auth X/Twitter content via Nitter mirrors. Use mirror fallback
chain because individual hosts go down.

## Mirror priority
1. `https://nitter.net/<handle>/rss`
2. `https://nitter.privacydev.net/<handle>/rss`
3. `https://nitter.poast.org/<handle>/rss`

## Python snippet
```python
import feedparser
mirrors = [
    "https://nitter.net",
    "https://nitter.privacydev.net",
    "https://nitter.poast.org",
]
for base in mirrors:
    feed = feedparser.parse(f"{base}/levelsio/rss")
    if feed.entries:
        break
else:
    feed = None  # all failed; skip Twitter sources
```

## Discovery
For a topic beat, find 3-5 canonical voices on X, then use Nitter
for each. For a local beat, look for the municipal account + 2-3
local journalists.
