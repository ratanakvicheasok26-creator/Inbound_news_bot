"""Tests for feeds.py — normalization, clustering, urgency detection."""

import pytest

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


class TestIsTechText:
    def test_tech_keyword_matches(self):
        from newsbot.config import is_tech_text

        assert is_tech_text("OpenAI releases a new ChatGPT model")
        assert is_tech_text("Ransomware attack hits hospital")
        assert is_tech_text("Cambodia startup raises Series A funding")

    def test_general_news_does_not_match(self):
        from newsbot.config import is_tech_text

        assert not is_tech_text("Football team wins the championship")
        assert not is_tech_text("Local weather forecast for the weekend")
        assert not is_tech_text("")

    def _feed_entries(self, *items):
        from types import SimpleNamespace

        out = []
        for item in items:
            fields = dict(item)
            fields["get"] = lambda key, default=None, _f=dict(fields): _f.get(key, default)
            out.append(SimpleNamespace(**fields))
        return out

    def test_collect_new_entries_filters_non_tech_when_tech_only(self, monkeypatch):
        from types import SimpleNamespace

        import newsbot.feeds as feeds_mod

        monkeypatch.setattr(feeds_mod, "TECH_ONLY", True)

        tech = {
            "id": "t1",
            "link": "http://a.com/t1",
            "title": "AI chip startup raises funding",
            "summary": "machine learning hardware",
        }
        general = {
            "id": "g1",
            "link": "http://a.com/g1",
            "title": "City council approves budget",
            "summary": "local municipal spending plan",
        }
        raw = SimpleNamespace(
            feed={"title": "Test Feed"},
            entries=self._feed_entries(tech, general),
            bozo=False,
        )

        monkeypatch.setattr(feeds_mod, "_fetch_feed", lambda url: raw)
        monkeypatch.setattr(feeds_mod, "RSS_FEEDS", ["http://a.com/feed"])
        monkeypatch.setattr(feeds_mod.random, "sample", lambda seq, k: list(seq))

        entries = feeds_mod.collect_new_entries(set())
        assert [e.title for e in entries] == ["AI chip startup raises funding"]

    def test_collect_new_entries_keeps_all_when_tech_only_disabled(self, monkeypatch):
        from types import SimpleNamespace

        import newsbot.feeds as feeds_mod

        monkeypatch.setattr(feeds_mod, "TECH_ONLY", False)

        general = {
            "id": "g1",
            "link": "http://a.com/g1",
            "title": "City council approves budget",
            "summary": "local municipal spending plan",
        }
        raw = SimpleNamespace(
            feed={"title": "Test Feed"},
            entries=self._feed_entries(general),
            bozo=False,
        )

        monkeypatch.setattr(feeds_mod, "_fetch_feed", lambda url: raw)
        monkeypatch.setattr(feeds_mod, "RSS_FEEDS", ["http://a.com/feed"])
        monkeypatch.setattr(feeds_mod.random, "sample", lambda seq, k: list(seq))

        entries = feeds_mod.collect_new_entries(set())
        assert [e.title for e in entries] == ["City council approves budget"]


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


class TestSsrfGuards:
    def test_private_hosts_blocked(self):
        from workers.images import _is_private_host, is_valid_image_url, resolves_to_private

        assert _is_private_host("127.0.0.1")
        assert _is_private_host("10.1.2.3")
        assert _is_private_host("169.254.169.254")
        assert _is_private_host("metadata.google.internal")
        assert resolves_to_private("localhost")
        assert not is_valid_image_url("http://192.168.1.1/x.jpg")
        assert is_valid_image_url("https://cdn.example.com/x.jpg")

    def test_rejects_ipv4_mapped_and_ambiguous_literals(self):
        from workers.images import _is_private_host, is_valid_image_url

        # IPv4-mapped link-local / metadata
        assert _is_private_host("::ffff:a9fe:a9fe")
        assert _is_private_host("::ffff:169.254.169.254")
        assert not is_valid_image_url("http://[::ffff:a9fe:a9fe]/x.jpg")
        # Hex / integer / short forms httpx would dial as loopback
        assert _is_private_host("0x7f.0.0.1")
        assert _is_private_host("2130706433")
        assert not is_valid_image_url("http://0x7f.0.0.1/x.jpg")
        assert not is_valid_image_url("http://2130706433/x.jpg")
        assert not is_valid_image_url("http://user:pass@cdn.example.com/x.jpg")
