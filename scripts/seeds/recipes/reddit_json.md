# Reddit JSON API recipe

Zero-auth (with User-Agent header), great for community signal.

## URL templates
- Subreddit feed: `https://www.reddit.com/r/<SUB>/new.json?limit=25`
- Search all: `https://www.reddit.com/search.json?q=<Q>&sort=new&limit=25`
- Find subs: `https://www.reddit.com/subreddits/search.json?q=<TOPIC>`

## Python snippet
```python
import requests
r = requests.get(
    "https://www.reddit.com/r/poland/new.json?limit=25",
    headers={"User-Agent": "PersonalNewsroom/0.1 by research-bot"},
    timeout=15,
)
r.raise_for_status()
posts = r.json()["data"]["children"]
```

## Gotchas
- Missing User-Agent → 429.
- Reddit's `.json` endpoint is officially public but has rate limits.
  Add retry with 30-60s backoff.
- Active subs change — verify `post_count_last_week > 5` before
  including as a source.
