import datetime
import feedparser
import json

# Authoritative source list with RSS feeds
SOURCES = [
    {
        "name": "Socialstyrelsen",
        "type": "authority_update",
        "feed_url": "https://www.socialstyrelsen.se/om-socialstyrelsen/pressrum/press/RssFeed/?url=https://www.socialstyrelsen.se/om-socialstyrelsen/pressrum/press/"
    },
    {
        "name": "Folkhälsomyndigheten",
        "type": "news",
        "feed_url": "https://www.folkhalsomyndigheten.se/nyheter-och-press/nyhetsarkiv/?syndication=rss"
    },
    {
        "name": "Regeringen",
        "type": "policy",
        "feed_url": "https://www.regeringen.se/Filter/RssFeed?filterType=Taxonomy&filterByType=FilterablePageBase&preFilteredCategories=1284%2C1285%2C1286%2C1287%2C1288%2C1290%2C1291%2C1292%2C1293%2C1294%2C1295%2C1296%2C1297%2C2425&rootPageReference=0&filteredContentCategories=1334%2C1341%2C1329%2C1331&filteredPoliticalLevelCategories=&filteredPoliticalAreaCategories=2747&filteredPublisherCategories=1292"
    }
]

class MockClassifier:
    """Temporary classifier for categorizing feed items."""
    def classify(self, item):
        # Very basic rule-based classification
        title = item.get("title", "").lower()
        
        topic = "mental_health"
        if "barn" in title or "ung" in title: topic = "children_young_people"
        elif "suicid" in title: topic = "suicide_prevention"
        elif "psykiatri" in title: topic = "psychiatric_care"
        elif "missbruk" in title or "beroende" in title: topic = "substance_use"

        item_type = item.get("source_type", "news")
        if "remiss" in title: item_type = "remiss"
        elif "sou" in title or "rapport" in title: item_type = "report"

        return {
            "topic": topic,
            "item_type": item_type,
            "relevance": 0.8,
            "summary": "Mock summary for: " + item.get("title", ""),
            "observatory_note": "Awaiting AI interpretation."
        }

def fetch_and_process():
    print("Fetching and processing policy/news items from live feeds...")
    
    classifier = MockClassifier()
    processed_items = []
    seen_urls = set()

    for src in SOURCES:
        print(f"Fetching {src['name']}...")
        try:
            feed = feedparser.parse(src["feed_url"])
            for entry in feed.entries:
                if entry.link in seen_urls:
                    continue
                
                item = {
                    "id": entry.get("id", entry.link),
                    "title": entry.title,
                    "url": entry.link,
                    "source_name": src["name"],
                    "source_type": src["type"],
                    "published_at": entry.get("published", datetime.datetime.now().isoformat()),
                }
                
                classification = classifier.classify(item)
                item.update(classification)
                item["retrieved_at"] = datetime.datetime.now().isoformat()
                
                processed_items.append(item)
                seen_urls.add(entry.link)
        except Exception as e:
            print(f"Error fetching {src['name']}: {e}")
        
    return processed_items

if __name__ == "__main__":
    items = fetch_and_process()
    import json
    with open("js/real_policy_news.js", "w", encoding="utf-8") as f:
        f.write("const REAL_POLICY_NEWS = " + json.dumps(items, indent=2, ensure_ascii=False) + ";")
