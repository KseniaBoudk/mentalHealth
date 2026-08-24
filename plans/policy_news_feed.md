# Plan: Policy & News Intelligence Feed ("Nyheter & Policy") for Kurvan (Mental Health Observatory)

## 1. Executive Summary & Architecture Fit
Kurvan is a vanilla JavaScript static web application with a Python offline data pipeline (`pipeline/`). It has no runtime server or database; all processed data is compiled into static JavaScript modules (like [`js/real_mh_data.js`](js/real_mh_data.js)) loaded at startup.

To build the **Policy & News Intelligence Feed** matching Kurvan's architecture while fulfilling all prompt requirements:
- **Pipeline & Ingestion (`pipeline/fetch_policy_news.py` & `pipeline/build_kurvan_data.py`)**: A Python script that fetches real RSS/Atom/JSON feeds from authoritative Swedish sources (e.g., Socialstyrelsen, Folkhälsomyndigheten, Regeringen/Riksdagen), normalizes items, deduplicates them, runs a mock/rule-based classifier, and outputs `js/real_policy_news.js`.
- **Classification Abstraction**: Implemented in Python during pipeline build (and mirrorable in JS for admin/future AI), with a clear `FeedItemClassifier` interface supporting a `MockClassifier` with rule-based keyword matching for topics and item types, ready for an future `AIClassifier`.
- **Data Model (`js/real_policy_news.js`)**: Structured feed items with fields: `id`, `title`, `description`, `url`, `source_name`, `source_type`, `published_at`, `retrieved_at`, `item_type`, `topic`, `subtopic`, `geography`, `relevance`, `summary`, `observatory_note`, `related_indicators` (linking to Kurvan indicators like `psych`, `suicide`, `self_harm`, `distress`, `sjukfranvaro`).
- **Frontend Tab (`Nyheter & Policy` / `Policy & News`)**: Added as a new section `policy_news` in [`js/shell.js`](js/shell.js), [`js/lang.js`](js/lang.js) (full SV/EN support), [`js/views.js`](js/views.js) (`viewPolicyNews()`), and styled in [`kurvan.css`](kurvan.css). Features tab filters (All, Policy, News/Signals, Research), dropdown filters for Topic and Source, search, and rich cards displaying source summaries, Observatory notes, and related indicator links.

---

## 2. Taxonomy & Controlled Vocabulary

### Topics (`topic`)
- `mental_health` (Psykisk hälsa)
- `psychiatric_care` (Psykiatrisk vård)
- `children_young_people` (Barn & unga)
- `suicide_prevention` (Suicidprevention)
- `prevention` (Prevention & tidiga insatser)
- `substance_use` (Missbruk & beroende)
- `inequalities` (Ojämlikhet i hälsa)
- `social_determinants` (Sociala bestämningsgrunder)
- `healthcare_access` (Vårdtillgång & köer)
- `workforce` (Kompetensförsörjning i vården)
- `digital_health` (Digital psykiatri & e-hälsa)

### Item Types (`item_type`)
- `policy` (Policybeslut / Strategi)
- `news` (Nyhet / Meddelande)
- `research` (Forskning & utvärdering)
- `report` (Myndighetsrapport / SOU)
- `remiss` (Remissvar)
- `proposition` (Proposition / Skrivelse)
- `authority_update` (Föreskrift / Rekommendation)

---

## 3. Authoritative Sources & RSS/Atom Connectors
Initial connectors targeting real public endpoints:
1. **Socialstyrelsen Nyheter RSS**: `https://www.socialstyrelsen.se/om-socialstyrelsen/pressrum/nyheter/` (or structured RSS/press API)
2. **Folkhälsomyndigheten Press RSS**: `https://www.folkhalsomyndigheten.se/nyheter-och-press/nyhetsarkiv/` (RSS/atom feed)
3. **Regeringen / Aktuellt RSS**: `https://www.regeringen.se/rss/aktuellt/` (Government press releases & decisions)

---

## 4. Frontend Design & UX Integration
- **Navigation**: Added to `SECTIONS` in [`js/shell.js`](js/shell.js) as `"policy_news"`.
- **Labels**: `t.tabs.policy_news = "Nyheter & Policy"` (SV) / `"Policy & News"` (EN) in [`js/lang.js`](js/lang.js).
- **View (`viewPolicyNews`)**:
  - Filter bar: Type pills (All, Policy, News, Reports, Research) + Select dropdowns (Topic, Source).
  - Feed cards showing: Badge for item type & topic, publication date, source name, title (linked to original URL), short summary, and an **Observatory Note** box ("Varför detta är viktigt för observatoriet") with chips linking to relevant Kurvan indicators (`behov`, `sjukskrivning`, `over_tid`, etc.).

---

## 5. Implementation Roadmap (Todos)
1. Create pipeline script `pipeline/fetch_policy_news.py` to ingest RSS feeds and apply `MockClassifier`.
2. Generate initial `js/real_policy_news.js` with structured sample & fetched feed items.
3. Update [`js/lang.js`](js/lang.js) with Swedish and English translations for feed UI, topics, and item types.
4. Implement `viewPolicyNews()` in [`js/views.js`](js/views.js) and wire into [`js/shell.js`](js/shell.js) and [`kurvan.html`](kurvan.html).
5. Add CSS styling in [`kurvan.css`](kurvan.css) for feed cards, filter bars, tags, and Observatory note callouts.
