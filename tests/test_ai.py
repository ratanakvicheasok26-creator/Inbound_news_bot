"""Tests for ai.py — JSON parsing, validation, template rendering, and utilities."""

from unittest.mock import MagicMock, patch

from newsbot.ai import (
    _parse_ai_json,
    _validate_ai_data,
    _fallback_data,
    _guess_category,
    render_template,
    trim_for_caption,
    collect_links,
    pick_image_url,
    rewrite_with_ai,
    rewrite_compact,
    rewrite_compact_khmer,
)
from newsbot.feeds import Entry


# --- JSON Parsing ---

class TestParseAiJson:
    def test_direct_json(self):
        raw = '{"urgency": "analysis", "headline": "Test", "summary": "Sum"}'
        result = _parse_ai_json(raw)
        assert result["urgency"] == "analysis"
        assert result["headline"] == "Test"

    def test_json_in_code_fence(self):
        raw = '```json\n{"urgency": "breaking", "headline": "X", "summary": "Y"}\n```'
        result = _parse_ai_json(raw)
        assert result["urgency"] == "breaking"

    def test_json_in_code_fence_without_label(self):
        raw = '```\n{"urgency": "alert", "headline": "A", "summary": "B"}\n```'
        result = _parse_ai_json(raw)
        assert result["urgency"] == "alert"

    def test_json_with_preamble(self):
        raw = 'Here is the result:\n{"urgency": "market", "headline": "BTC", "summary": "Up"}'
        result = _parse_ai_json(raw)
        assert result["urgency"] == "market"

    def test_invalid_json_raises(self):
        raw = "This is not JSON at all"
        try:
            _parse_ai_json(raw)
            assert False, "Should have raised ValueError"
        except ValueError:
            pass

    def test_non_greedy_does_not_span_multiple_objects(self):
        raw = '{"a": 1} some text {"b": 2}'
        result = _parse_ai_json(raw)
        assert result == {"a": 1}


# --- Validation ---

class TestValidateAiData:
    def test_valid_data(self):
        data = {"urgency": "analysis", "category": "ai", "headline": "Test", "summary": "Sum"}
        is_valid, reason = _validate_ai_data(data)
        assert is_valid is True
        assert reason is None

    def test_missing_urgency(self):
        data = {"headline": "Test", "summary": "Sum"}
        is_valid, reason = _validate_ai_data(data)
        assert is_valid is False
        assert "urgency" in reason

    def test_missing_headline(self):
        data = {"urgency": "analysis", "summary": "Sum"}
        is_valid, reason = _validate_ai_data(data)
        assert is_valid is False
        assert "headline" in reason

    def test_empty_headline(self):
        data = {"urgency": "analysis", "headline": "  ", "summary": "Sum"}
        is_valid, reason = _validate_ai_data(data)
        assert is_valid is False
        assert "headline" in reason

    def test_invalid_urgency(self):
        data = {"urgency": "invalid", "headline": "Test", "summary": "Sum", "category": "ai"}
        is_valid, reason = _validate_ai_data(data)
        assert is_valid is False
        assert "urgency" in reason

    def test_invalid_category(self):
        data = {"urgency": "analysis", "headline": "Test", "summary": "Sum", "category": "invalid"}
        is_valid, reason = _validate_ai_data(data)
        assert is_valid is False
        assert "category" in reason

    def test_missing_category(self):
        data = {"urgency": "analysis", "headline": "Test", "summary": "Sum"}
        is_valid, reason = _validate_ai_data(data)
        assert is_valid is False
        assert "category" in reason

    def test_non_list_key_points(self):
        data = {"urgency": "analysis", "category": "ai", "headline": "Test", "summary": "Sum", "key_points": "not a list"}
        is_valid, reason = _validate_ai_data(data)
        assert is_valid is False
        assert "key_points" in reason


# --- Template Rendering ---

class TestRenderTemplate:
    def test_breaking_template(self):
        data = {
            "urgency": "breaking",
            "category": "cybersecurity",
            "headline": "Major Exploit",
            "summary": "Protocol hacked for $10M.",
            "key_points": ["Flash loan used", "Oracle manipulated"],
        }
        result = render_template(data)
        assert "<b>🔴 CRITICAL — Inbound Reports</b>" in result
        assert "<b>Major Exploit</b>" in result
        assert "Protocol hacked" in result
        assert "▸ Flash loan used" in result
        assert "▸ Oracle manipulated" in result

    def test_alert_template(self):
        data = {
            "urgency": "alert",
            "category": "cybersecurity",
            "headline": "Vulnerability in Compound V2",
            "summary": "Medium-severity bug disclosed.",
            "key_points": ["Check positions", "De-risk if needed"],
        }
        result = render_template(data)
        assert "<b>🟡 ALERT — Inbound Reports</b>" in result
        assert "<b>Vulnerability in Compound V2</b>" in result
        assert "Medium-severity bug" in result
        assert "▸ Check positions" in result

    def test_analysis_template(self):
        data = {
            "urgency": "analysis",
            "category": "regulation",
            "headline": "SEC Proposes DeFi Framework",
            "summary": "New guidance on governance tokens.",
            "key_points": ["Governance tokens may be securities", "2-year safe harbor"],
        }
        result = render_template(data)
        assert "<b>🔵 Analysis — Inbound Reports</b>" in result
        assert "<b>SEC Proposes DeFi Framework</b>" in result
        assert "Governance tokens" in result

    def test_market_template(self):
        data = {
            "urgency": "market",
            "category": "defi",
            "headline": "BTC Breaks $65K",
            "summary": "Bitcoin surges on ETF inflows.",
            "key_points": ["Current: $65,420", "+3.2% 24h"],
        }
        result = render_template(data)
        assert "<b>💰 Market — Inbound Reports</b>" in result
        assert "<b>BTC Breaks $65K</b>" in result
        assert "Bitcoin surges" in result

    def test_explainer_template_with_tldr(self):
        data = {
            "urgency": "explainer",
            "category": "defi",
            "headline": "How Oracle Attacks Work",
            "summary": "DeFi relies on price feeds attackers can manipulate.",
            "key_points": ["Oracles feed prices", "Flash loans amplify attacks"],
            "tldr": "DeFi price feeds are a weak link.",
        }
        result = render_template(data)
        assert "<b>📖 Explainer — Inbound Reports</b>" in result
        assert "<b>How Oracle Attacks Work</b>" in result
        assert "DeFi price feeds are a weak link." in result
        assert "<b>TL;DR:</b>" in result

    def test_unknown_urgency_no_badge(self):
        data = {"urgency": "unknown", "headline": "Test", "summary": "Sum"}
        result = render_template(data)
        assert "<b>Test</b>" in result
        assert "Inbound Reports" not in result

    def test_truncation_over_limit(self):
        data = {
            "urgency": "analysis",
            "headline": "Test",
            "summary": "x" * 4500,
        }
        result = render_template(data)
        assert len(result) <= 4096
        assert result.endswith("...")

    def test_tldr_ignored_for_non_explainer(self):
        data = {
            "urgency": "alert",
            "headline": "Test",
            "summary": "Sum",
            "tldr": "This should not appear",
        }
        result = render_template(data)
        assert "This should not appear" not in result

    def test_no_key_points_section_when_empty(self):
        data = {"urgency": "analysis", "headline": "Test", "summary": "Sum"}
        result = render_template(data)
        assert "▸" not in result


# --- Fallback Data ---

class TestFallbackData:
    def test_fallback_normal(self):
        entries = [Entry(id="1", title="Test Story", summary="Summary text", link="http://a.com", source_name="TechCrunch")]
        data = _fallback_data(entries, urgent=False)
        assert data["urgency"] == "analysis"
        assert data["headline"] == "Test Story"
        assert data["summary"] == "Summary text"
        assert "TechCrunch" in data["key_points"][0]

    def test_fallback_urgent(self):
        entries = [Entry(id="1", title="Critical Bug", summary="Major issue", link="http://a.com", source_name="A")]
        data = _fallback_data(entries, urgent=True)
        assert data["urgency"] == "alert"
        assert data["headline"] == "Critical Bug"

    def test_fallback_multiple_sources(self):
        entries = [
            Entry(id="1", title="Story", summary="s", link="http://a.com", source_name="TechCrunch"),
            Entry(id="2", title="Story", summary="s", link="http://b.com", source_name="The Verge"),
        ]
        data = _fallback_data(entries, urgent=False)
        assert "TechCrunch" in data["key_points"][0]
        assert "The Verge" in data["key_points"][0]

    def test_fallback_empty_title(self):
        entries = [Entry(id="1", title="", summary="Summary text", link="http://a.com", source_name="A")]
        data = _fallback_data(entries, urgent=False)
        assert data["headline"] == "Untitled Story"
        assert data["summary"] == "Summary text"

    def test_fallback_empty_summary(self):
        entries = [Entry(id="1", title="Test Title", summary="", link="http://a.com", source_name="A")]
        data = _fallback_data(entries, urgent=False)
        assert data["headline"] == "Test Title"
        assert data["summary"] == "No summary available."

    def test_fallback_both_empty(self):
        entries = [Entry(id="1", title="", summary="", link="http://a.com", source_name="A")]
        data = _fallback_data(entries, urgent=False)
        assert data["headline"] == "Untitled Story"
        assert data["summary"] == "No summary available."

    def test_fallback_always_validates(self):
        entries = [Entry(id="1", title="Test", summary="Sum", link="http://a.com", source_name="A")]
        data = _fallback_data(entries, urgent=False)
        is_valid, reason = _validate_ai_data(data)
        assert is_valid is True, f"Fallback data failed validation: {reason}"


# --- Category Guessing ---

class TestGuessCategory:
    def test_cybersecurity_keywords(self):
        entries = [Entry(id="1", title="Major breach at exchange", summary="", link="http://a.com", source_name="A")]
        assert _guess_category(entries) == "cybersecurity"

    def test_defi_keywords(self):
        entries = [Entry(id="1", title="Ethereum gas fees surge", summary="", link="http://a.com", source_name="A")]
        assert _guess_category(entries) == "defi"

    def test_big_tech_keywords(self):
        entries = [Entry(id="1", title="Apple announces new MacBook", summary="", link="http://a.com", source_name="A")]
        assert _guess_category(entries) == "big_tech"

    def test_ai_keywords(self):
        entries = [Entry(id="1", title="OpenAI releases GPT-5", summary="", link="http://a.com", source_name="A")]
        assert _guess_category(entries) == "ai"

    def test_hardware_keywords(self):
        entries = [Entry(id="1", title="NVIDIA new GPU chip announced", summary="", link="http://a.com", source_name="A")]
        assert _guess_category(entries) == "hardware"

    def test_science_keywords(self):
        entries = [Entry(id="1", title="Scientists discover new material", summary="", link="http://a.com", source_name="A")]
        assert _guess_category(entries) == "science"

    def test_regulation_keywords(self):
        entries = [Entry(id="1", title="EU regulation on AI compliance", summary="", link="http://a.com", source_name="A")]
        assert _guess_category(entries) == "regulation"

    def test_cloud_keywords(self):
        entries = [Entry(id="1", title="AWS Kubernetes update", summary="", link="http://a.com", source_name="A")]
        assert _guess_category(entries) == "cloud"

    def test_opensource_keywords(self):
        entries = [Entry(id="1", title="Linux kernel 6.0 released", summary="", link="http://a.com", source_name="A")]
        assert _guess_category(entries) == "opensource"

    def test_gaming_keywords(self):
        entries = [Entry(id="1", title="Nintendo Switch 2 launch", summary="", link="http://a.com", source_name="A")]
        assert _guess_category(entries) == "gaming"

    def test_climate_keywords(self):
        entries = [Entry(id="1", title="New solar panel efficiency record", summary="", link="http://a.com", source_name="A")]
        assert _guess_category(entries) == "climate"

    def test_telecom_keywords(self):
        entries = [Entry(id="1", title="Starlink 5G partnership", summary="", link="http://a.com", source_name="A")]
        assert _guess_category(entries) == "telecom"

    def test_mobile_keywords(self):
        entries = [Entry(id="1", title="Android 15 release date", summary="", link="http://a.com", source_name="A")]
        assert _guess_category(entries) == "mobile"

    def test_defaults_to_startups(self):
        entries = [Entry(id="1", title="Random unrelated news", summary="Something happened", link="http://a.com", source_name="A")]
        assert _guess_category(entries) == "startups"

    def test_multiple_entries_combined(self):
        entries = [
            Entry(id="1", title="Ethereum gas fees surge", summary="", link="http://a.com", source_name="A"),
            Entry(id="2", title="Bitcoin price hits new ATH", summary="", link="http://b.com", source_name="B"),
        ]
        assert _guess_category(entries) == "defi"


# --- Utilities ---

class TestTrimForCaption:
    def test_short_text(self):
        assert trim_for_caption("hello", limit=100) == "hello"

    def test_long_text(self):
        long = "a" * 2000
        result = trim_for_caption(long, limit=100)
        assert len(result) <= 103  # limit + up to 2 for "..." suffix
        assert result.endswith("...")


class TestCollectLinks:
    def test_unique_links(self):
        entries = [
            Entry(id="1", title="A", summary="", link="http://a.com", source_name="A"),
            Entry(id="2", title="B", summary="", link="http://a.com", source_name="B"),
            Entry(id="3", title="C", summary="", link="http://c.com", source_name="C"),
        ]
        links = collect_links(entries)
        assert len(links) == 2
        urls = [url for url, _ in links]
        assert "http://a.com" in urls
        assert "http://c.com" in urls

    def test_urgent_cap(self):
        entries = [Entry(id=str(i), title=str(i), summary="", link=f"http://{i}.com", source_name="X") for i in range(5)]
        links = collect_links(entries, urgent=True)
        assert len(links) == 3

    def test_normal_cap(self):
        entries = [Entry(id=str(i), title=str(i), summary="", link=f"http://{i}.com", source_name="X") for i in range(8)]
        links = collect_links(entries, urgent=False)
        assert len(links) == 5


class TestPickImageUrl:
    def test_first_image(self):
        entries = [
            Entry(id="1", title="A", summary="", link="http://a.com", source_name="A", image_url=None),
            Entry(id="2", title="B", summary="", link="http://b.com", source_name="B", image_url="http://img.com/x.jpg"),
        ]
        assert pick_image_url(entries) == "http://img.com/x.jpg"

    def test_no_image(self):
        entries = [Entry(id="1", title="A", summary="", link="http://a.com", source_name="A")]
        with patch("newsbot.ai._fetch_og_image", return_value=None):
            assert pick_image_url(entries) is None


# --- AI Router Integration ---

class TestAIRouterIntegration:
    def test_router_success(self):
        mock_router = MagicMock()
        mock_router.call.return_value = ("groq output", "groq")
        with patch("newsbot.ai.get_router", return_value=mock_router):
            result, provider = mock_router.call("prompt")
            assert result == "groq output"
            assert provider == "groq"

    def test_router_returns_none_when_all_fail(self):
        mock_router = MagicMock()
        mock_router.call.return_value = (None, "none")
        with patch("newsbot.ai.get_router", return_value=mock_router):
            result, provider = mock_router.call("prompt")
            assert result is None
            assert provider == "none"


# --- Header Parameter ---

class TestHeaderParameter:
    def _mock_ai_output(self):
        return (
            '{"urgency": "analysis", "category": "ai", "headline": "Test Story", '
            '"summary": "A summary", "key_points": ["point"], "tags": ["Tag"]}'
        )

    def _make_mock_router(self, output, provider="groq"):
        mock_router = MagicMock()
        mock_router.call.return_value = (output, provider)
        return mock_router

    def test_header_prepended_to_output(self):
        cluster = [Entry(id="1", title="Test", summary="Summary", link="http://a.com", source_name="A")]
        mock_router = self._make_mock_router(self._mock_ai_output())
        with patch("newsbot.ai.get_router", return_value=mock_router):
            result = rewrite_with_ai(cluster, header="📰 1/3 · January 16, 2026")
        assert result.startswith("📰 1/3 · January 16, 2026\n\n")
        assert "Test Story" in result

    def test_no_header(self):
        cluster = [Entry(id="1", title="Test", summary="Summary", link="http://a.com", source_name="A")]
        mock_router = self._make_mock_router(self._mock_ai_output())
        with patch("newsbot.ai.get_router", return_value=mock_router):
            result = rewrite_with_ai(cluster, header=None)
        assert not result.startswith("📰")
        assert "Test Story" in result


# --- rewrite_with_ai ---

class TestRewriteWithAi:
    def _make_mock_router(self, output, provider="groq"):
        mock_router = MagicMock()
        mock_router.call.return_value = (output, provider)
        return mock_router

    def test_fallback_on_none_output(self):
        cluster = [Entry(id="1", title="Fallback Test", summary="Summary", link="http://a.com", source_name="A")]
        mock_router = self._make_mock_router(None, "none")
        with patch("newsbot.ai.get_router", return_value=mock_router):
            result = rewrite_with_ai(cluster)
        assert "Fallback Test" in result

    def test_fallback_on_invalid_json(self):
        cluster = [Entry(id="1", title="Bad JSON Test", summary="Summary", link="http://a.com", source_name="A")]
        mock_router = self._make_mock_router("not json at all", "groq")
        with patch("newsbot.ai.get_router", return_value=mock_router):
            result = rewrite_with_ai(cluster)
        assert "Bad JSON Test" in result

    def test_emergency_fallback_on_bad_validation(self):
        cluster = [Entry(id="1", title="Emergency", summary="Summary", link="http://a.com", source_name="A")]
        bad_data = '{"urgency": "INVALID_LEVEL", "category": "INVALID_CAT"}'
        mock_router = self._make_mock_router(bad_data, "groq")
        with patch("newsbot.ai.get_router", return_value=mock_router):
            result = rewrite_with_ai(cluster)
        assert "Emergency" in result

    def test_urgent_overrides_non_urgent_level(self):
        cluster = [Entry(id="1", title="Urgent Override", summary="Exploit detected", link="http://a.com", source_name="A")]
        data = '{"urgency": "explainer", "category": "ai", "headline": "Test", "summary": "Sum", "key_points": [], "tags": []}'
        mock_router = self._make_mock_router(data, "groq")
        with patch("newsbot.ai.get_router", return_value=mock_router):
            result = rewrite_with_ai(cluster, urgent=True)
        assert "🟡 ALERT" in result


# --- rewrite_compact ---

class TestRewriteCompact:
    def _make_mock_router(self, output, provider="groq"):
        mock_router = MagicMock()
        mock_router.call.return_value = (output, provider)
        return mock_router

    def test_compact_normal(self):
        cluster = [Entry(id="1", title="Test", summary="Summary", link="http://a.com", source_name="A")]
        mock_router = self._make_mock_router("Short summary.")
        with patch("newsbot.ai.get_router", return_value=mock_router):
            result = rewrite_compact(cluster)
        assert result == "Short summary."

    def test_compact_truncates_long_output(self):
        cluster = [Entry(id="1", title="Test", summary="Summary", link="http://a.com", source_name="A")]
        long_output = "First sentence. Second sentence. Third sentence. Fourth sentence."
        mock_router = self._make_mock_router(long_output)
        with patch("newsbot.ai.get_router", return_value=mock_router):
            result = rewrite_compact(cluster)
        sentences = result.split(". ")
        assert len(sentences) <= 3

    def test_compact_fallback_to_summary(self):
        cluster = [Entry(id="1", title="Test", summary="Original summary text", link="http://a.com", source_name="A")]
        mock_router = self._make_mock_router(None, "none")
        with patch("newsbot.ai.get_router", return_value=mock_router):
            result = rewrite_compact(cluster)
        assert result == "Original summary text"

    def test_compact_logs_non_groq_provider(self):
        cluster = [Entry(id="1", title="Test", summary="Summary", link="http://a.com", source_name="A")]
        mock_router = self._make_mock_router("ok", "gemini")
        with patch("newsbot.ai.get_router", return_value=mock_router), \
             patch("newsbot.ai.logger") as mock_logger:
            rewrite_compact(cluster)
            mock_logger.info.assert_any_call("Compact rewrite via %s", "gemini")


class TestRewriteCompactKhmer:
    def _make_mock_router(self, output, provider="gemini"):
        mock_router = MagicMock()
        mock_router.call.return_value = (output, provider)
        return mock_router

    def test_khmer_compact_parses_json(self):
        cluster = [Entry(id="1", title="Test", summary="Summary", link="http://a.com", source_name="A")]
        payload = '{"title": "ចំណងជើងខ្មែរ", "summary": "សង្ខេបខ្មែរ។"}'
        mock_router = self._make_mock_router(payload)
        with patch.dict("newsbot.ai.__dict__", {"NEWS_LANGUAGE": "km"}), \
             patch("newsbot.ai.get_router", return_value=mock_router):
            title, summary = rewrite_compact_khmer(cluster)
        assert title == "ចំណងជើងខ្មែរ"
        assert summary == "សង្ខេបខ្មែរ។"

    def test_khmer_compact_fallback_keeps_english_title(self):
        cluster = [Entry(id="1", title="Test", summary="Original summary text", link="http://a.com", source_name="A")]
        mock_router = self._make_mock_router(None, "none")
        mock_router.call.side_effect = [(None, "none"), ("សង្ខេបខ្មែរ។", "groq")]
        with patch.dict("newsbot.ai.__dict__", {"NEWS_LANGUAGE": "km"}), \
             patch("newsbot.ai.get_router", return_value=mock_router):
            title, summary = rewrite_compact_khmer(cluster)
        assert title == "Test"
        assert summary == "សង្ខេបខ្មែរ។"

    def test_khmer_compact_bad_json_falls_back(self):
        cluster = [Entry(id="1", title="Test", summary="Original summary text", link="http://a.com", source_name="A")]
        mock_router = self._make_mock_router("not json at all", "gemini")
        mock_router.call.side_effect = [("not json at all", "gemini"), ("translated", "groq")]
        with patch.dict("newsbot.ai.__dict__", {"NEWS_LANGUAGE": "km"}), \
             patch("newsbot.ai.get_router", return_value=mock_router):
            title, summary = rewrite_compact_khmer(cluster)
        assert title == "Test"
        assert summary == "translated"
