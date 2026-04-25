# arXiv recipe

Primary source for research-heavy beats (AI/ML, physics, economics).

## URL templates
- Category feed: `http://export.arxiv.org/rss/<CATEGORY>`
  e.g. `cs.AI`, `cs.LG`, `stat.ML`, `q-fin`.
- Search: `http://export.arxiv.org/api/query?search_query=<Q>&sortBy=submittedDate&sortOrder=descending&max_results=20`

## Python snippet
```python
import feedparser
feed = feedparser.parse("http://export.arxiv.org/rss/cs.AI")
```
