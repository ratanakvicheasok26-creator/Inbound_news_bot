"""Tests for feeds.py — normalization, clustering, urgency detection."""

from newsbot.feeds import (
    Entry,
    _normalize_title,
    _summary_similarity,
    _title_similarity,
    cluster_entries,
    extract_image_url,
    looks_telegram_important,
    looks_urgent,
)


class TestNormalizeTitle:
    def test_lowercase(self):
        assert _normalize_title("HELLO World") == ["hello", "world"]

    def test_strips_punctuation(self):
        result = _normalize_title("Apple's new iPhone 16!")
        assert "apples" not in result
        assert "new" in result
        assert "iphone" in result
        assert "16" in result

    def test_removes_stop_words(self):
        result = _normalize_title("The Quick Brown Fox")
        assert "the" not in result
        assert "quick" in result
        assert "brown" in result
        assert "fox" in result

    def test_empty_string(self):
        assert _normalize_title("") == []

    def test_only_stop_words(self):
        assert _normalize_title("a the and or") == []


class TestTitleSimilarity:
    def test_identical_titles(self):
        assert _title_similarity("Apple releases iPhone 16", "Apple releases iPhone 16") == 1.0

    def test_no_overlap(self):
        assert _title_similarity("Apple iPhone", "Samsung Galaxy") == 0.0

    def test_partial_overlap(self):
        score = _title_similarity("Apple releases new iPhone 16", "Apple announces iPhone 16 Pro")
        assert 0.3 < score < 0.8

    def test_empty_titles(self):
        assert _title_similarity("", "") == 0.0

    def test_one_empty(self):
        assert _title_similarity("Apple iPhone", "") == 0.0


class TestSummarySimilarity:
    def test_identical_summaries(self):
        s = "This is a test summary about technology"
        assert _summary_similarity(s, s) == 1.0

    def test_no_overlap(self):
        assert _summary_similarity("Apple iPhone release", "Samsung Galaxy launch") == 0.0

    def test_partial_overlap(self):
        score = _summary_similarity(
            "Apple released a new iPhone with better camera",
            "Apple announced iPhone with improved camera system",
        )
        assert 0.2 < score < 0.9


class TestClusterEntries:
    def test_single_entry(self):
        entries = [Entry(id="1", title="Test", summary="", link="http://a.com", source_name="A")]
        clusters = cluster_entries(entries)
        assert len(clusters) == 1
        assert len(clusters[0]) == 1

    def test_identical_titles_cluster_together(self):
        entries = [
            Entry(id="1", title="Apple releases iPhone 16", summary="new phone", link="http://a.com", source_name="A"),
            Entry(id="2", title="Apple releases iPhone 16", summary="new phone", link="http://b.com", source_name="B"),
        ]
        clusters = cluster_entries(entries)
        assert len(clusters) == 1
        assert len(clusters[0]) == 2

    def test_different_titles_stay_separate(self):
        entries = [
            Entry(id="1", title="Apple iPhone", summary="phone", link="http://a.com", source_name="A"),
            Entry(id="2", title="Samsung Galaxy", summary="phone", link="http://b.com", source_name="B"),
        ]
        clusters = cluster_entries(entries)
        assert len(clusters) == 2

    def test_empty_entries(self):
        assert cluster_entries([]) == []

    def test_cluster_preserves_order(self):
        entries = [
            Entry(id="1", title="Apple releases iPhone 16 with AI features", summary="Apple unveiled new iPhone 16 with AI capabilities and better camera", link="http://a.com", source_name="A"),
            Entry(id="2", title="Apple releases new iPhone 16 with AI tools", summary="New iPhone 16 from Apple includes AI capabilities and processing", link="http://b.com", source_name="B"),
            Entry(id="3", title="Samsung confirms Galaxy S25 launch date", summary="Samsung confirmed the Galaxy S25 launch schedule and pricing", link="http://c.com", source_name="C"),
        ]
        clusters = cluster_entries(entries)
        assert len(clusters) == 2
        assert any(len(c) == 2 for c in clusters)
        assert any(len(c) == 1 for c in clusters)


class TestExtractImageUrl:
    def test_media_content(self):
        raw = {"media_content": [{"url": "https://cdn.example.com/a.jpg", "medium": "image"}]}
        assert extract_image_url(raw) == "https://cdn.example.com/a.jpg"

    def test_media_thumbnail(self):
        raw = {"media_thumbnail": [{"url": "https://cdn.example.com/thumb.png"}]}
        assert extract_image_url(raw) == "https://cdn.example.com/thumb.png"

    def test_enclosure_image(self):
        raw = {"enclosures": [{"href": "https://cdn.example.com/e.webp", "type": "image/webp"}]}
        assert extract_image_url(raw) == "https://cdn.example.com/e.webp"

    def test_img_in_summary(self):
        raw = {"summary": '<p>Hi <img src="https://cdn.example.com/from-html.jpg" /></p>'}
        assert extract_image_url(raw) == "https://cdn.example.com/from-html.jpg"

    def test_no_image(self):
        assert extract_image_url({"summary": "no image here"}) is None


class TestLooksUrgent:
    def test_urgent_keyword_in_title(self):
        entries = [Entry(id="1", title="Critical vulnerability found in Chrome", summary="", link="http://a.com", source_name="A")]
        assert looks_urgent(entries) is True

    def test_urgent_keyword_in_summary(self):
        entries = [Entry(id="1", title="Security update", summary="A ransomware attack affected millions", link="http://a.com", source_name="A")]
        assert looks_urgent(entries) is True

    def test_not_urgent(self):
        entries = [Entry(id="1", title="New phone released", summary="Apple announced a new phone", link="http://a.com", source_name="A")]
        assert looks_urgent(entries) is False

    def test_urgent_from_cluster(self):
        entries = [
            Entry(id="1", title="Security update", summary="", link="http://a.com", source_name="A"),
            Entry(id="2", title="Major outage at cloud provider", summary="down globally", link="http://b.com", source_name="B"),
        ]
        assert looks_urgent(entries) is True

    def test_empty_entries(self):
        assert looks_urgent([]) is False


class TestLooksTelegramImportant:
    def test_urgent_is_important(self):
        entries = [
            Entry(
                id="1",
                title="Critical vulnerability in library",
                summary="",
                link="http://a.com",
                source_name="A",
            )
        ]
        assert looks_telegram_important(entries) is True

    def test_multi_source_is_important(self):
        entries = [
            Entry(id="1", title="Startup raises funding", summary="Series B", link="http://a.com", source_name="A"),
            Entry(id="2", title="Startup raises funding", summary="Big round", link="http://b.com", source_name="B"),
        ]
        assert looks_telegram_important(entries) is True
        assert looks_urgent(entries) is False

    def test_important_keyword_single_source(self):
        entries = [
            Entry(
                id="1",
                title="OpenAI unveils new model",
                summary="Launching today",
                link="http://a.com",
                source_name="A",
            )
        ]
        assert looks_telegram_important(entries) is True

    def test_thin_single_source_not_important(self):
        entries = [
            Entry(
                id="1",
                title="Random gadget tip of the week",
                summary="How to clean your keyboard",
                link="http://a.com",
                source_name="A",
            )
        ]
        assert looks_telegram_important(entries) is False
        assert looks_urgent(entries) is False
