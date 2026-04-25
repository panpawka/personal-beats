# YouTube channel RSS recipe

For beats that should include video content (creator beats,
educational, documentary-style).

## URL template
`https://www.youtube.com/feeds/videos.xml?channel_id=<CHANNEL_ID>`

## Finding a channel ID
Fetch `https://www.youtube.com/@<handle>`, grep for
`"channelId":"UC..."`. Or hit
`https://www.youtube.com/@<handle>/about` and parse.

## Python snippet
```python
import feedparser
feed = feedparser.parse(
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCsXVk37bltHxD1rDPwtNM8Q"
)
```
