"""Send all 5 template scenarios to Telegram for visual testing.

Includes one scenario with an image URL to verify photo-sending path.

Run:  python test_templates_telegram.py

Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID in .env or environment.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
from telegram import Bot

from newsbot.ai import render_template, trim_for_caption

load_dotenv()

TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
CHANNEL_ID = int(os.environ["TELEGRAM_CHANNEL_ID"])
THREAD_ID_RAW = os.environ.get("TELEGRAM_THREAD_ID", "").strip()
THREAD_ID = int(THREAD_ID_RAW) if THREAD_ID_RAW else None

SCENARIOS = [
    {
        "label": "1/ BREAKING (with photo)",
        "data": {
            "urgency": "breaking",
            "headline": "Oracle Attack Exploits Ostium for $18M",
            "summary": "Ostium protocol was targeted in a sophisticated oracle manipulation attack, enabling attackers to drain $18 million from the platform.",
            "key_points": [
                "Attack vector: Flash loan + oracle manipulation",
                "Attacker exploited stale price data",
                "Protocol team working on emergency fixes",
            ],
            "metrics": [
                "Loss: $18 million",
                "Affected: Ostium lending/trading protocol",
                "Status: Incident under investigation",
            ],
            "context": "This marks the 4th oracle attack in DeFi this quarter. The pattern suggests attackers are systematically exploiting price feed vulnerabilities.",
            "timeline": "July 15, 2:45 AM UTC | Discovered 4:20 AM UTC | Ongoing",
            "tags": ["DeFi", "Security", "OracleAttack", "Exploit"],
            "source_name": "CoinDesk",
            "published_date": "Jul 15, 2026",
        },
        "image_url": "https://techcrunch.com/wp-content/uploads/2024/01/GettyImages-1713421289.jpg",
    },
    {
        "label": "2/ ANALYSIS (text only)",
        "data": {
            "urgency": "analysis",
            "headline": "SEC Proposes New Framework for DeFi Governance Tokens",
            "summary": "The US Securities and Exchange Commission has outlined preliminary guidance on how DAO governance tokens will be classified and regulated going forward.",
            "key_points": [
                "Governance tokens with economic rights = likely securities",
                "Pure voting-only tokens = may avoid securities classification",
                "Staking rewards structure matters for classification",
                "Safe harbor period: 2 years for existing DAOs to comply",
            ],
            "market_impact": "Bitcoin +1.2% on clarity expectations. Governance token sector mixed.",
            "who_affected": ["Major DAOs (Uniswap, Aave, Curve)", "DeFi protocols with token incentives", "US-based DAO contributors"],
            "context": "This is the clearest regulatory language on DAO tokens to date. Fills a 2-year gap since the SEC's Lido decision.",
            "tags": ["Regulation", "DeFi", "DAOs", "SEC"],
            "source_name": "The Block",
            "published_date": "Jul 16, 2026",
        },
        "image_url": None,
    },
    {
        "label": "3/ ALERT (text only)",
        "data": {
            "urgency": "alert",
            "headline": "Vulnerability Disclosed in Compound V2 Smart Contract",
            "summary": "Compound V2 has a medium-severity bug affecting users with liquidation positions. No active exploit yet.",
            "key_points": [
                "Bug affects liquidation bot reliability",
                "No active exploitation detected yet",
                "Patch expected in 7-10 days",
            ],
            "what_to_do": [
                "Check if you have collateral at risk",
                "Consider de-risking positions temporarily",
                "Monitor Compound Discord for updates",
                "Keep withdrawal path open",
            ],
            "who_affected": [
                "Users with <150% collateral ratio",
                "Liquidation bots relying on Compound oracles",
                "Active Compound traders",
            ],
            "timeline": "Disclosure: July 14 | Patch ETA: July 21-24",
            "tags": ["Security", "DeFi", "Compound", "Vulnerability"],
            "source_name": "Compound Governance Forum",
            "published_date": "Jul 14, 2026",
        },
        "image_url": None,
    },
    {
        "label": "4/ MARKET (text only)",
        "data": {
            "urgency": "market",
            "headline": "BTC Breaks $65K on ETF Inflow Catalyst",
            "summary": "Bitcoin surged 3.2% after spot ETF flows reached $2.1B in a single day, signaling institutional demand recovery.",
            "key_points": [
                "Current: $65,420 | Change: +3.2% 24h",
                "Volume: $34.2B | Trend: Bullish breakout",
                "Resistance: $66,500 | Support: $64,200",
            ],
            "market_impact": "BlackRock iShares ETF reported $2.1B in inflows overnight. Fed rate hike odds decreased 15%.",
            "tags": ["BTC", "Bitcoin", "ETF", "Bullish"],
            "source_name": "CoinGecko | Glassnode",
            "published_date": "Jul 16, 2026",
        },
        "image_url": None,
    },
    {
        "label": "5/ EXPLAINER (text only)",
        "data": {
            "urgency": "explainer",
            "headline": "How Oracle Attacks Work (And Why DeFi Is Vulnerable)",
            "summary": "Recent exploits at Ostium and others have exposed DeFi's critical dependency on price feeds. Here's what you need to know.",
            "key_points": [
                "Smart contracts rely on oracles for real-world price data",
                "Flash loans let attackers temporarily manipulate prices",
                "Oracle manipulation can drain entire protocols",
                "Decentralized oracles (Chainlink, Pyth) are the defense",
            ],
            "what_to_watch": [
                "Adoption of decentralized oracles (Chainlink v2, Pyth)",
                "Regulatory response to oracle standards",
                "Next protocol targeted (pattern suggests lending platforms)",
            ],
            "tldr": "DeFi platforms trust price oracles they can't fully verify — attackers are systematically exploiting this weak link.",
            "tags": ["Oracles", "DeFi", "Security", "Explained"],
            "source_name": "Messari Research",
            "published_date": "Jul 15, 2026",
        },
        "image_url": None,
    },
]


async def main():
    bot = Bot(token=TOKEN)
    sent = 0

    for scenario in SCENARIOS:
        text = render_template(scenario["data"])
        label = scenario["label"]
        image_url = scenario.get("image_url")

        print(f"\n{'='*60}")
        print(f"Sending: {label}")
        print(f"{'='*60}")
        print(text)
        print(f"\nLength: {len(text)} chars")
        if image_url:
            print(f"Image: {image_url}")

        try:
            send_kwargs: dict = {"chat_id": CHANNEL_ID}
            if THREAD_ID is not None:
                send_kwargs["message_thread_id"] = THREAD_ID

            if image_url:
                await bot.send_photo(
                    photo=image_url,
                    caption=trim_for_caption(text),
                    parse_mode="HTML",
                    **send_kwargs,
                )
            else:
                await bot.send_message(
                    text=text,
                    parse_mode="HTML",
                    disable_web_page_preview=True,
                    **send_kwargs,
                )
            sent += 1
            print(f"  -> Sent OK ({'photo' if image_url else 'text'})")
        except Exception as e:
            print(f"  -> FAILED: {e}")
            # Fallback: send as text if photo fails
            if image_url:
                try:
                    await bot.send_message(
                        text=text,
                        parse_mode="HTML",
                        disable_web_page_preview=True,
                        **send_kwargs,
                    )
                    sent += 1
                    print("  -> Sent OK (text fallback)")
                except Exception as e2:
                    print(f"  -> Fallback also failed: {e2}")

        await asyncio.sleep(1.5)

    print(f"\n{'='*60}")
    print(f"Done: {sent}/{len(SCENARIOS)} scenarios sent successfully")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
