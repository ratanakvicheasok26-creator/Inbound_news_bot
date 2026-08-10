"""Tests for news_bot.py — command handlers and rate limiting."""

from unittest.mock import AsyncMock, MagicMock, patch

from news_bot import start_command, stop_command, fetch_command, _reply


class TestReply:
    def test_replies_to_effective_message(self):
        update = MagicMock()
        update.effective_message.reply_text = AsyncMock()
        import asyncio
        asyncio.run(_reply(update, "hello"))
        update.effective_message.reply_text.assert_awaited_once_with("hello")

    def test_noop_when_no_message(self):
        update = MagicMock(effective_message=None)
        import asyncio
        asyncio.run(_reply(update, "hello"))


class TestStartCommand:
    def test_subscribes_new_chat(self):
        update = MagicMock()
        update.effective_chat.id = 12345
        update.effective_chat.title = "Test Group"
        update.effective_message.reply_text = AsyncMock()
        context = MagicMock()

        with patch("news_bot.get_state") as mock_state:
            mock_state.return_value.load_subscribers.return_value = set()
            import asyncio
            asyncio.run(start_command(update, context))

        mock_state.return_value.save_subscribers.assert_called_once_with({12345})
        update.effective_message.reply_text.assert_awaited_once()
        assert "Subscribed" in update.effective_message.reply_text.call_args[0][0]

    def test_already_subscribed(self):
        update = MagicMock()
        update.effective_chat.id = 12345
        update.effective_message.reply_text = AsyncMock()
        context = MagicMock()

        with patch("news_bot.get_state") as mock_state:
            mock_state.return_value.load_subscribers.return_value = {12345}
            import asyncio
            asyncio.run(start_command(update, context))

        update.effective_message.reply_text.assert_awaited_once()
        assert "already" in update.effective_message.reply_text.call_args[0][0].lower()


class TestStopCommand:
    def test_unsubscribes(self):
        update = MagicMock()
        update.effective_chat.id = 12345
        update.effective_message.reply_text = AsyncMock()
        context = MagicMock()

        with patch("news_bot.get_state") as mock_state:
            mock_state.return_value.load_subscribers.return_value = {12345}
            import asyncio
            asyncio.run(stop_command(update, context))

        mock_state.return_value.save_subscribers.assert_called_once_with(set())
        assert "Unsubscribed" in update.effective_message.reply_text.call_args[0][0]

    def test_not_subscribed(self):
        update = MagicMock()
        update.effective_chat.id = 12345
        update.effective_message.reply_text = AsyncMock()
        context = MagicMock()

        with patch("news_bot.get_state") as mock_state:
            mock_state.return_value.load_subscribers.return_value = set()
            import asyncio
            asyncio.run(stop_command(update, context))

        assert "weren't subscribed" in update.effective_message.reply_text.call_args[0][0]


class TestFetchCommand:
    def test_rate_limited(self):
        update = MagicMock()
        update.effective_chat.id = 12345
        update.effective_message.reply_text = AsyncMock()
        context = MagicMock()

        with patch("news_bot._fetch_last_run", {12345: 9999999999.0}):
            import asyncio
            asyncio.run(fetch_command(update, context))

        assert "wait" in update.effective_message.reply_text.call_args[0][0].lower()

    def test_successful_fetch(self):
        update = MagicMock()
        update.effective_chat.id = 12345
        update.effective_message.reply_text = AsyncMock()
        context = MagicMock()

        with patch("news_bot.fetch_individual_and_post", new_callable=AsyncMock, return_value=3):
            import asyncio
            asyncio.run(fetch_command(update, context))

        calls = update.effective_message.reply_text.await_args_list
        assert "Fetching" in calls[0].args[0]
        assert "3" in calls[1].args[0]

    def test_zero_posts(self):
        update = MagicMock()
        update.effective_chat.id = 12345
        update.effective_message.reply_text = AsyncMock()
        context = MagicMock()

        with patch("news_bot.fetch_individual_and_post", new_callable=AsyncMock, return_value=0), \
             patch("news_bot._fetch_last_run", {}):
            import asyncio
            asyncio.run(fetch_command(update, context))

        calls = update.effective_message.reply_text.await_args_list
        assert "No new" in calls[1].args[0]

    def test_fetch_error(self):
        update = MagicMock()
        update.effective_chat.id = 12345
        update.effective_message.reply_text = AsyncMock()
        context = MagicMock()

        with patch("news_bot.fetch_individual_and_post", new_callable=AsyncMock, side_effect=RuntimeError("boom")), \
             patch("news_bot._fetch_last_run", {}):
            import asyncio
            asyncio.run(fetch_command(update, context))

        calls = update.effective_message.reply_text.await_args_list
        assert "wrong" in calls[1].args[0].lower()
