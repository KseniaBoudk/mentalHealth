import datetime

# Mock source list
SOURCES = [
    {"name": "Socialstyrelsen", "type": "authority_update", "url": "https://www.socialstyrelsen.se"},
    {"name": "Folkhälsomyndigheten", "type": "news", "url": "https://www.folkhalsomyndigheten.se"},
    {"name": "Regeringen", "type": "policy", "url": "https://www.regeringen.se"}
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
    # In a real implementation, this would fetch from actual RSS feeds
    # For now, it returns a structured mock feed item
    print("Fetching and processing policy/news items...")
    
    mock_items = [
        {
            "id": "1",
            "title": "Ny nationell strategi för suicidprevention",
            "url": "https://www.regeringen.se/nyhet1",
            "source_name": "Regeringen",
            "source_type": "policy",
            "published_at": datetime.datetime.now().isoformat(),
        }
    ]
    
    classifier = MockClassifier()
    processed_items = []
    
    for item in mock_items:
        classification = classifier.classify(item)
        item.update(classification)
        item["retrieved_at"] = datetime.datetime.now().isoformat()
        processed_items.append(item)
        
    return processed_items

if __name__ == "__main__":
    items = fetch_and_process()
    import json
    with open("js/real_policy_news.js", "w", encoding="utf-8") as f:
        f.write("const REAL_POLICY_NEWS = " + json.dumps(items, indent=2, ensure_ascii=False) + ";")
