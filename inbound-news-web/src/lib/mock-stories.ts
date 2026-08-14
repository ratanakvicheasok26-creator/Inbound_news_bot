/**
 * Local demo dataset — used when Supabase is unset (or USE_MOCK_STORIES=1).
 * Mimics clustered stories + linked articles so coverage / blindspot / compare work.
 */

import type { Article, Story, StoryWithArticles } from "@/lib/types"
import { uniqueOutlets } from "@/lib/outlet-roles"

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString()
}

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString()
}

type MockBundle = {
  story: Story
  articles: Article[]
}

const MOCK_BUNDLES: MockBundle[] = [
  {
    story: {
      id: "11111111-1111-4111-8111-111111111101",
      title: "OpenAI opens a Bangkok office as Southeast Asia AI demand accelerates",
      summary_en:
        "OpenAI said it will open a Bangkok office this year to support enterprise customers across ASEAN. The company cited growing demand for GPT APIs in banking, logistics, and government digitization programs. Local analysts expect hiring of solutions engineers and partnership managers rather than large research labs.",
      source_count: 5,
      category: "ai",
      tags: ["openai", "asean", "llm", "enterprise"],
      premium: true,
      created_at: hoursAgo(3),
      image_url: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=80",
      primary_url: "https://techcrunch.com/example/openai-bangkok",
      primary_source: "TechCrunch",
      primary_source_domain: "techcrunch.com",
    },
    articles: [
      {
        id: "a1111111-1111-4111-8111-111111111101",
        title: "OpenAI to open Bangkok office amid ASEAN AI boom",
        summary:
          "TechCrunch reports OpenAI will open a Bangkok office, focusing on enterprise sales across Southeast Asia. The company did not disclose headcount.",
        url: "https://techcrunch.com/example/openai-bangkok",
        source_name: "TechCrunch",
        source_domain: "techcrunch.com",
        category: "ai",
        language: "en",
        published_at: hoursAgo(4),
        ingested_at: hoursAgo(3),
        image_url: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=80",
      },
      {
        id: "a1111111-1111-4111-8111-111111111102",
        title: "OpenAI expands in Southeast Asia with Thailand hub",
        summary:
          "Reuters says OpenAI chose Bangkok for regional coverage, citing Thailand’s digital economy push and English-speaking talent pool.",
        url: "https://reuters.com/example/openai-bangkok",
        source_name: "Reuters",
        source_domain: "reuters.com",
        category: "ai",
        language: "en",
        published_at: hoursAgo(5),
        ingested_at: hoursAgo(3),
        image_url: null,
      },
      {
        id: "a1111111-1111-4111-8111-111111111103",
        title: "Why OpenAI’s Bangkok move matters for Cambodia’s startups",
        summary:
          "Rest of World notes Cambodian fintechs already call OpenAI APIs via Singapore vendors; a Bangkok hub could shorten support latency.",
        url: "https://restofworld.org/example/openai-cambodia",
        source_name: "Rest of World",
        source_domain: "restofworld.org",
        category: "ai",
        language: "en",
        published_at: hoursAgo(6),
        ingested_at: hoursAgo(3),
        image_url: null,
      },
      {
        id: "a1111111-1111-4111-8111-111111111104",
        title: "Skeptics warn ASEAN AI offices are sales outposts, not labs",
        summary:
          "Ars Technica argues the Bangkok site is unlikely to house frontier research and may intensify competition for scarce GPU cloud credits.",
        url: "https://arstechnica.com/example/openai-bangkok",
        source_name: "Ars Technica",
        source_domain: "arstechnica.com",
        category: "ai",
        language: "en",
        published_at: hoursAgo(7),
        ingested_at: hoursAgo(3),
        image_url: null,
      },
      {
        id: "a1111111-1111-4111-8111-111111111105",
        title: "HN thread: OpenAI Bangkok — opportunity or hype?",
        summary:
          "Hacker News commenters debate whether ASEAN startups will benefit more from cheaper models than from a regional sales office.",
        url: "https://news.ycombinator.com/example/openai-bangkok",
        source_name: "Hacker News",
        source_domain: "news.ycombinator.com",
        category: "ai",
        language: "en",
        published_at: hoursAgo(2),
        ingested_at: hoursAgo(2),
        image_url: null,
      },
    ],
  },
  {
    story: {
      id: "11111111-1111-4111-8111-111111111102",
      title: "Cambodia’s National Cyber Security Centre flags rise in QR-payment phishing",
      summary_en:
        "Cambodia’s NCSC warned of a spike in phishing kits that clone ABA and Wing QR checkout pages. Banks urged merchants to verify payment domains and enable transaction alerts. No confirmed large-scale breach of bank core systems was reported.",
      source_count: 3,
      category: "cybersecurity",
      tags: ["phishing", "fintech", "cambodia", "qr"],
      created_at: hoursAgo(8),
      image_url: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&q=80",
      primary_url: "https://krebsonsecurity.com/example/cambodia-qr",
      primary_source: "Krebs on Security",
      primary_source_domain: "krebsonsecurity.com",
    },
    articles: [
      {
        id: "a1111111-1111-4111-8111-111111111201",
        title: "QR payment phishing kits target Cambodian banks",
        summary:
          "Krebs on Security details cloned ABA KHQR pages distributed via Telegram channels, with victims redirected to credential harvesters.",
        url: "https://krebsonsecurity.com/example/cambodia-qr",
        source_name: "Krebs on Security",
        source_domain: "krebsonsecurity.com",
        category: "cybersecurity",
        language: "en",
        published_at: hoursAgo(9),
        ingested_at: hoursAgo(8),
        image_url: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&q=80",
      },
      {
        id: "a1111111-1111-4111-8111-111111111202",
        title: "NCSC Cambodia issues advisory on fake payment QR codes",
        summary:
          "Official advisory recommends verifying merchant names in-app and reporting suspicious domains to the NCSC portal.",
        url: "https://cisa.gov/example/cambodia-qr-advisory",
        source_name: "CISA",
        source_domain: "cisa.gov",
        category: "cybersecurity",
        language: "en",
        published_at: hoursAgo(10),
        ingested_at: hoursAgo(8),
        image_url: null,
      },
      {
        id: "a1111111-1111-4111-8111-111111111203",
        title: "Banks urge users to double-check KHQR before paying",
        summary:
          "Local trade coverage notes Wing and ABA pushed in-app banners; no evidence of bank backend compromise so far.",
        url: "https://theregister.com/example/cambodia-qr",
        source_name: "The Register",
        source_domain: "theregister.com",
        category: "cybersecurity",
        language: "en",
        published_at: hoursAgo(11),
        ingested_at: hoursAgo(8),
        image_url: null,
      },
    ],
  },
  {
    story: {
      id: "11111111-1111-4111-8111-111111111103",
      title: "Nvidia’s next data-center GPU reportedly delayed three months",
      summary_en:
        "Supply-chain sources told Bloomberg that Nvidia’s next-generation data-center GPU slipped by about a quarter due to packaging yield issues. Cloud providers may extend H100/H200 leases. Nvidia did not confirm the timeline.",
      source_count: 4,
      category: "hardware",
      tags: ["nvidia", "gpu", "semiconductor", "cloud"],
      created_at: hoursAgo(14),
      image_url: "https://images.unsplash.com/photo-1597872200969-2b65d72bd1f1?w=1200&q=80",
      primary_url: "https://bloomberg.com/example/nvidia-delay",
      primary_source: "Bloomberg",
      primary_source_domain: "bloomberg.com",
    },
    articles: [
      {
        id: "a1111111-1111-4111-8111-111111111301",
        title: "Nvidia AI chip delay tied to advanced packaging yields",
        summary:
          "Bloomberg reports a roughly three-month slip for the next data-center GPU, citing packaging partners in Taiwan.",
        url: "https://bloomberg.com/example/nvidia-delay",
        source_name: "Bloomberg",
        source_domain: "bloomberg.com",
        category: "hardware",
        language: "en",
        published_at: hoursAgo(15),
        ingested_at: hoursAgo(14),
        image_url: "https://images.unsplash.com/photo-1597872200969-2b65d72bd1f1?w=1200&q=80",
      },
      {
        id: "a1111111-1111-4111-8111-111111111302",
        title: "Cloud giants brace for longer wait on next Nvidia GPUs",
        summary:
          "The Information says hyperscalers are renegotiating capacity reservations and leaning harder on older H-series inventory.",
        url: "https://theinformation.com/example/nvidia-delay",
        source_name: "The Information",
        source_domain: "theinformation.com",
        category: "hardware",
        language: "en",
        published_at: hoursAgo(16),
        ingested_at: hoursAgo(14),
        image_url: null,
      },
      {
        id: "a1111111-1111-4111-8111-111111111303",
        title: "Nvidia delay rumors: what it means for AI startups",
        summary:
          "TechCrunch frames the slip as bullish for inference startups optimizing smaller models, less so for training-heavy labs.",
        url: "https://techcrunch.com/example/nvidia-delay",
        source_name: "TechCrunch",
        source_domain: "techcrunch.com",
        category: "hardware",
        language: "en",
        published_at: hoursAgo(17),
        ingested_at: hoursAgo(14),
        image_url: null,
      },
      {
        id: "a1111111-1111-4111-8111-111111111304",
        title: "Don’t panic about the GPU delay — yet",
        summary:
          "Ars Technica cautions that rumor timelines often move; software efficiency gains may offset some hardware shortages.",
        url: "https://arstechnica.com/example/nvidia-delay",
        source_name: "Ars Technica",
        source_domain: "arstechnica.com",
        category: "hardware",
        language: "en",
        published_at: hoursAgo(18),
        ingested_at: hoursAgo(14),
        image_url: null,
      },
    ],
  },
  {
    story: {
      id: "11111111-1111-4111-8111-111111111104",
      title: "EU AI Act transparency rules begin biting for general-purpose models",
      summary_en:
        "Providers of general-purpose AI models face new transparency and documentation duties under the EU AI Act’s phased timeline. Trade groups asked for clearer guidance on open-weight releases. Civil society groups said the rules still leave enforcement gaps.",
      source_count: 4,
      category: "regulation",
      tags: ["eu", "ai-act", "policy", "transparency"],
      created_at: hoursAgo(20),
      image_url: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&q=80",
      primary_url: "https://reuters.com/example/eu-ai-act",
      primary_source: "Reuters",
      primary_source_domain: "reuters.com",
    },
    articles: [
      {
        id: "a1111111-1111-4111-8111-111111111401",
        title: "EU starts enforcing AI Act rules for general-purpose models",
        summary:
          "Reuters outlines documentation, copyright, and systemic-risk obligations beginning to apply for GPAI providers.",
        url: "https://reuters.com/example/eu-ai-act",
        source_name: "Reuters",
        source_domain: "reuters.com",
        category: "regulation",
        language: "en",
        published_at: hoursAgo(21),
        ingested_at: hoursAgo(20),
        image_url: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&q=80",
      },
      {
        id: "a1111111-1111-4111-8111-111111111402",
        title: "Open-source AI groups seek clarity on EU documentation duties",
        summary:
          "The Register covers lobbying from open-weight projects worried about compliance costs for volunteer maintainers.",
        url: "https://theregister.com/example/eu-ai-act",
        source_name: "The Register",
        source_domain: "theregister.com",
        category: "regulation",
        language: "en",
        published_at: hoursAgo(22),
        ingested_at: hoursAgo(20),
        image_url: null,
      },
      {
        id: "a1111111-1111-4111-8111-111111111403",
        title: "EFF: AI Act transparency is a start, not enough for accountability",
        summary:
          "EFF argues users still lack meaningful recourse when opaque model training data causes harmful outputs.",
        url: "https://eff.org/example/eu-ai-act",
        source_name: "EFF",
        source_domain: "eff.org",
        category: "regulation",
        language: "en",
        published_at: hoursAgo(23),
        ingested_at: hoursAgo(20),
        image_url: null,
      },
      {
        id: "a1111111-1111-4111-8111-111111111404",
        title: "Microsoft blog: preparing customers for EU AI Act obligations",
        summary:
          "Microsoft’s corporate blog frames compliance tooling and Azure documentation features as customer aids.",
        url: "https://blogs.microsoft.com/example/eu-ai-act",
        source_name: "Microsoft",
        source_domain: "blogs.microsoft.com",
        category: "regulation",
        language: "en",
        published_at: hoursAgo(24),
        ingested_at: hoursAgo(20),
        image_url: null,
      },
    ],
  },
  {
    story: {
      id: "11111111-1111-4111-8111-111111111105",
      title: "Phnom Penh logistics startup raises $4.2M to digitize factory trucking",
      summary_en:
        "A Phnom Penh logistics startup raised $4.2 million seed to expand a trucking marketplace connecting garment factories with independent drivers. Investors include regional SEA funds. The company plans to add bilingual dispatch tools in Khmer and English.",
      source_count: 2,
      category: "startups",
      tags: ["cambodia", "logistics", "funding", "seed"],
      created_at: hoursAgo(28),
      image_url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80",
      primary_url: "https://techcrunch.com/example/phnom-penh-logistics",
      primary_source: "TechCrunch",
      primary_source_domain: "techcrunch.com",
    },
    articles: [
      {
        id: "a1111111-1111-4111-8111-111111111501",
        title: "Cambodian logistics startup raises $4.2M seed",
        summary:
          "TechCrunch covers the round and notes traction with garment exporters shipping to Sihanoukville port.",
        url: "https://techcrunch.com/example/phnom-penh-logistics",
        source_name: "TechCrunch",
        source_domain: "techcrunch.com",
        category: "startups",
        language: "en",
        published_at: hoursAgo(29),
        ingested_at: hoursAgo(28),
        image_url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80",
      },
      {
        id: "a1111111-1111-4111-8111-111111111502",
        title: "SEA funds back Cambodia factory trucking marketplace",
        summary:
          "Rest of World emphasizes bilingual product design and informal driver networks as the startup’s edge.",
        url: "https://restofworld.org/example/phnom-penh-logistics",
        source_name: "Rest of World",
        source_domain: "restofworld.org",
        category: "startups",
        language: "en",
        published_at: hoursAgo(30),
        ingested_at: hoursAgo(28),
        image_url: null,
      },
    ],
  },
  // Blindspot-style single-outlet stories
  {
    story: {
      id: "11111111-1111-4111-8111-111111111106",
      title: "Researchers publish open dataset of Khmer OCR errors in government PDFs",
      summary_en:
        "A university team released an open dataset cataloguing common OCR failures in Khmer-script government PDFs. They argue better OCR is a prerequisite for searchable public records and AI summarization tools used by journalists and NGOs.",
      source_count: 1,
      category: "science",
      tags: ["khmer", "ocr", "open-data", "research"],
      created_at: hoursAgo(12),
      image_url: "https://images.unsplash.com/photo-1456513080880-7d93aaa5ba63?w=1200&q=80",
      primary_url: "https://arxiv.org/example/khmer-ocr",
      primary_source: "arXiv",
      primary_source_domain: "arxiv.org",
    },
    articles: [
      {
        id: "a1111111-1111-4111-8111-111111111601",
        title: "An open benchmark for Khmer OCR on scanned government documents",
        summary:
          "arXiv preprint describes 12k annotated lines, error taxonomies, and baseline models. Code and data are released under CC-BY.",
        url: "https://arxiv.org/example/khmer-ocr",
        source_name: "arXiv",
        source_domain: "arxiv.org",
        category: "science",
        language: "en",
        published_at: hoursAgo(13),
        ingested_at: hoursAgo(12),
        image_url: "https://images.unsplash.com/photo-1456513080880-7d93aaa5ba63?w=1200&q=80",
      },
    ],
  },
  {
    story: {
      id: "11111111-1111-4111-8111-111111111107",
      title: "Critical analysis: vendor ‘AI security’ scores rarely measure real exploitability",
      summary_en:
        "A longform investigation argues many commercial AI security scorecards test shallow prompt refusals rather than tool-use jailbreaks or supply-chain risks. The piece urges procurement teams to demand adversarial red-team reports.",
      source_count: 1,
      category: "cybersecurity",
      tags: ["ai-security", "procurement", "red-team"],
      created_at: hoursAgo(18),
      image_url: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=1200&q=80",
      primary_url: "https://arstechnica.com/example/ai-security-scores",
      primary_source: "Ars Technica",
      primary_source_domain: "arstechnica.com",
    },
    articles: [
      {
        id: "a1111111-1111-4111-8111-111111111701",
        title: "AI security scorecards are mostly marketing theater",
        summary:
          "Ars Technica walks through vendor benchmarks that ignore agent tool access, plugin supply chains, and offline model theft.",
        url: "https://arstechnica.com/example/ai-security-scores",
        source_name: "Ars Technica",
        source_domain: "arstechnica.com",
        category: "cybersecurity",
        language: "en",
        published_at: hoursAgo(19),
        ingested_at: hoursAgo(18),
        image_url: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=1200&q=80",
      },
    ],
  },
  {
    story: {
      id: "11111111-1111-4111-8111-111111111108",
      title: "Cloudflare quietly expands encrypted client hello defaults for free plans",
      summary_en:
        "Cloudflare said Encrypted Client Hello (ECH) is now on by default for more free-plan zones, reducing SNI leakage to on-path observers. Enterprise customers retain advanced controls. Privacy advocates welcomed the move with caveats about centralization.",
      source_count: 1,
      category: "cloud",
      tags: ["privacy", "ech", "tls", "cloudflare"],
      created_at: hoursAgo(6),
      image_url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80",
      primary_url: "https://blog.cloudflare.com/example/ech",
      primary_source: "Cloudflare",
      primary_source_domain: "blog.cloudflare.com",
    },
    articles: [
      {
        id: "a1111111-1111-4111-8111-111111111801",
        title: "Encrypted Client Hello defaults expand on Cloudflare free plans",
        summary:
          "Cloudflare’s engineering blog explains ECH rollout stages and compatibility notes for older middleboxes.",
        url: "https://blog.cloudflare.com/example/ech",
        source_name: "Cloudflare",
        source_domain: "blog.cloudflare.com",
        category: "cloud",
        language: "en",
        published_at: hoursAgo(7),
        ingested_at: hoursAgo(6),
        image_url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80",
      },
    ],
  },
  {
    story: {
      id: "11111111-1111-4111-8111-111111111109",
      title: "Meta open-sources a lighter multimodal model for on-device translation",
      summary_en:
        "Meta released weights for a smaller multimodal model aimed at on-device translation and image captioning. Early benchmarks claim competitive quality at lower memory cost. Researchers noted license terms allow research use with attribution.",
      source_count: 3,
      category: "ai",
      tags: ["meta", "open-source", "multimodal", "on-device"],
      created_at: daysAgo(1),
      image_url: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1200&q=80",
      primary_url: "https://about.fb.com/example/multimodal",
      primary_source: "Meta",
      primary_source_domain: "about.fb.com",
    },
    articles: [
      {
        id: "a1111111-1111-4111-8111-111111111901",
        title: "Meta releases compact multimodal model weights",
        summary:
          "Meta’s corporate blog announces downloadable weights and a research license for on-device translation experiments.",
        url: "https://about.fb.com/example/multimodal",
        source_name: "Meta",
        source_domain: "about.fb.com",
        category: "ai",
        language: "en",
        published_at: daysAgo(1),
        ingested_at: daysAgo(1),
        image_url: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1200&q=80",
      },
      {
        id: "a1111111-1111-4111-8111-111111111902",
        title: "Meta’s new small multimodal model: early numbers",
        summary:
          "The Verge summarizes claimed latency wins on mid-range Android devices and remaining English bias in captions.",
        url: "https://theverge.com/example/meta-multimodal",
        source_name: "The Verge",
        source_domain: "theverge.com",
        category: "ai",
        language: "en",
        published_at: daysAgo(1),
        ingested_at: daysAgo(1),
        image_url: null,
      },
      {
        id: "a1111111-1111-4111-8111-111111111903",
        title: "Open weights, closed training data: same old tradeoff",
        summary:
          "404 Media argues releasing weights without training corpus transparency still leaves auditability gaps.",
        url: "https://404media.co/example/meta-multimodal",
        source_name: "404 Media",
        source_domain: "404media.co",
        category: "ai",
        language: "en",
        published_at: daysAgo(1),
        ingested_at: daysAgo(1),
        image_url: null,
      },
    ],
  },
  {
    story: {
      id: "11111111-1111-4111-8111-111111111110",
      title: "Stablecoin remittance volumes into Cambodia hit a quiet record",
      summary_en:
        "Industry trackers estimate USDT remittance corridors into Cambodia reached a new monthly high, mostly via informal OTC desks. The National Bank has not endorsed crypto remittances; compliance officers warn of AML exposure for banks onboarding related fintechs.",
      source_count: 2,
      category: "defi",
      tags: ["stablecoin", "remittance", "cambodia", "aml"],
      created_at: hoursAgo(36),
      image_url: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=1200&q=80",
      primary_url: "https://coindesk.com/example/cambodia-usdt",
      primary_source: "CoinDesk",
      primary_source_domain: "coindesk.com",
    },
    articles: [
      {
        id: "a1111111-1111-4111-8111-111111111a01",
        title: "USDT remittances into Cambodia quietly surge",
        summary:
          "Trade press estimates cite OTC desk interviews; on-chain labels remain incomplete for informal corridors.",
        url: "https://coindesk.com/example/cambodia-usdt",
        source_name: "CoinDesk",
        source_domain: "coindesk.com",
        category: "defi",
        language: "en",
        published_at: hoursAgo(37),
        ingested_at: hoursAgo(36),
        image_url: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=1200&q=80",
      },
      {
        id: "a1111111-1111-4111-8111-111111111a02",
        title: "Banks watch stablecoin remittance risk in Mekong markets",
        summary:
          "Reuters notes compliance teams tracking wallet-to-cash off-ramps without clear licensing frameworks.",
        url: "https://reuters.com/example/cambodia-usdt",
        source_name: "Reuters",
        source_domain: "reuters.com",
        category: "defi",
        language: "en",
        published_at: hoursAgo(38),
        ingested_at: hoursAgo(36),
        image_url: null,
      },
    ],
  },
  {
    story: {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Apple tightens App Store account-deletion rules for regional developers",
      summary_en:
        "Apple updated App Store guidelines requiring clearer in-app account deletion flows, with extra scrutiny for apps operating in Southeast Asia. Developers have a multi-month window to comply before review rejections ramp up.",
      source_count: 3,
      category: "mobile",
      tags: ["apple", "app-store", "privacy", "sea"],
      created_at: hoursAgo(40),
      image_url: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200&q=80",
      primary_url: "https://theverge.com/example/apple-deletion",
      primary_source: "The Verge",
      primary_source_domain: "theverge.com",
    },
    articles: [
      {
        id: "a1111111-1111-4111-8111-111111111b01",
        title: "Apple expands account deletion enforcement",
        summary:
          "The Verge details new reviewer checklists and timelines for apps that create user accounts.",
        url: "https://theverge.com/example/apple-deletion",
        source_name: "The Verge",
        source_domain: "theverge.com",
        category: "mobile",
        language: "en",
        published_at: hoursAgo(41),
        ingested_at: hoursAgo(40),
        image_url: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200&q=80",
      },
      {
        id: "a1111111-1111-4111-8111-111111111b02",
        title: "SEA developers scramble to ship account deletion UX",
        summary:
          "Rest of World interviews Phnom Penh and Jakarta studios about engineering cost for legacy apps.",
        url: "https://restofworld.org/example/apple-deletion",
        source_name: "Rest of World",
        source_domain: "restofworld.org",
        category: "mobile",
        language: "en",
        published_at: hoursAgo(42),
        ingested_at: hoursAgo(40),
        image_url: null,
      },
      {
        id: "a1111111-1111-4111-8111-111111111b03",
        title: "Apple: account deletion is required for App Store compliance",
        summary:
          "Apple’s developer site restates the requirement and links sample flows for UIKit and SwiftUI.",
        url: "https://developer.apple.com/example/account-deletion",
        source_name: "Apple",
        source_domain: "developer.apple.com",
        category: "mobile",
        language: "en",
        published_at: hoursAgo(43),
        ingested_at: hoursAgo(40),
        image_url: null,
      },
    ],
  },
  {
    story: {
      id: "11111111-1111-4111-8111-111111111112",
      title: "GitHub says malware campaigns are abusing Actions secrets in public forks",
      summary_en:
        "GitHub warned maintainers that attackers are probing public forks for leaked Actions secrets and recommending OIDC + environment protection. Several popular JavaScript repos rotated tokens after suspicious workflow runs.",
      source_count: 1,
      category: "opensource",
      tags: ["github", "security", "ci", "malware"],
      created_at: hoursAgo(5),
      image_url: "https://images.unsplash.com/photo-1618401471354-b516cfd1562c?w=1200&q=80",
      primary_url: "https://github.blog/example/actions-secrets",
      primary_source: "GitHub",
      primary_source_domain: "github.blog",
    },
    articles: [
      {
        id: "a1111111-1111-4111-8111-111111111c01",
        title: "Hardening GitHub Actions against secret abuse in forks",
        summary:
          "GitHub’s security blog walks through environment rules, OIDC, and auditing unexpected workflow_dispatch events.",
        url: "https://github.blog/example/actions-secrets",
        source_name: "GitHub",
        source_domain: "github.blog",
        category: "opensource",
        language: "en",
        published_at: hoursAgo(5),
        ingested_at: hoursAgo(5),
        image_url: "https://images.unsplash.com/photo-1618401471354-b516cfd1562c?w=1200&q=80",
      },
    ],
  },
  // Additional high-quality singletons (role variety) — not one per every desk
  {
    story: {
      id: "11111111-1111-4111-8111-111111111113",
      title: "NIST drafts guidance on evaluating LLM system cards for procurement",
      summary_en:
        "NIST published a draft outlining how agencies should read LLM system cards when buying AI tools — focusing on evaluation datasets, known failure modes, and update cadence. The draft is open for public comment and does not mandate a specific model vendor.",
      source_count: 1,
      category: "regulation",
      tags: ["nist", "procurement", "llm", "policy"],
      created_at: hoursAgo(9),
      image_url: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&q=80",
      primary_url: "https://nist.gov/example/llm-system-cards",
      primary_source: "NIST",
      primary_source_domain: "nist.gov",
    },
    articles: [
      {
        id: "a1111111-1111-4111-8111-111111111d01",
        title: "Draft NIST guidance on LLM system cards for government buyers",
        summary:
          "NIST’s draft asks vendors to document eval suites, red-team scope, and model update policies before agency procurement.",
        url: "https://nist.gov/example/llm-system-cards",
        source_name: "NIST",
        source_domain: "nist.gov",
        category: "regulation",
        language: "en",
        published_at: hoursAgo(10),
        ingested_at: hoursAgo(9),
        image_url: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&q=80",
      },
    ],
  },
  {
    story: {
      id: "11111111-1111-4111-8111-111111111114",
      title: "Trade desks quietly reprice AI capex as power interconnect queues lengthen",
      summary_en:
        "Bloomberg sources say several infrastructure funds are stretching AI data-center IRR models after interconnection study delays in key US grids. Chip demand assumptions are unchanged; the bottleneck is electricity delivery timelines, not GPU supply alone.",
      source_count: 1,
      category: "hardware",
      tags: ["data-center", "power", "capex", "ai"],
      created_at: hoursAgo(11),
      image_url: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=1200&q=80",
      primary_url: "https://bloomberg.com/example/ai-power-queues",
      primary_source: "Bloomberg",
      primary_source_domain: "bloomberg.com",
    },
    articles: [
      {
        id: "a1111111-1111-4111-8111-111111111e01",
        title: "AI data-center returns adjusted for longer power wait times",
        summary:
          "Bloomberg reports funds are pushing COD assumptions out by 12–24 months in congested interconnect regions.",
        url: "https://bloomberg.com/example/ai-power-queues",
        source_name: "Bloomberg",
        source_domain: "bloomberg.com",
        category: "hardware",
        language: "en",
        published_at: hoursAgo(12),
        ingested_at: hoursAgo(11),
        image_url: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=1200&q=80",
      },
    ],
  },
  {
    story: {
      id: "11111111-1111-4111-8111-111111111115",
      title: "404 Media: police AI ‘crime prediction’ vendors overstate audit claims",
      summary_en:
        "An investigation finds several vendors selling predictive policing tools cite ‘independent audits’ that were paid pilots or marketing case studies. Cities renewing contracts often lack access to raw false-positive rates by neighborhood.",
      source_count: 1,
      category: "ai",
      tags: ["surveillance", "audit", "procurement", "accountability"],
      created_at: hoursAgo(15),
      image_url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80",
      primary_url: "https://404media.co/example/crime-prediction-audits",
      primary_source: "404 Media",
      primary_source_domain: "404media.co",
    },
    articles: [
      {
        id: "a1111111-1111-4111-8111-111111111f01",
        title: "Predictive policing vendors’ ‘audits’ don’t hold up",
        summary:
          "404 Media reviews contracts and finds audit language that does not match independent methodology standards.",
        url: "https://404media.co/example/crime-prediction-audits",
        source_name: "404 Media",
        source_domain: "404media.co",
        category: "ai",
        language: "en",
        published_at: hoursAgo(16),
        ingested_at: hoursAgo(15),
        image_url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80",
      },
    ],
  },
  // Thin / skewed: two booster outlets only
  {
    story: {
      id: "11111111-1111-4111-8111-111111111116",
      title: "Two launch blogs hype a ‘chatGPT for factories’ without naming customers",
      summary_en:
        "TechCrunch and The Verge both covered a manufacturing AI launch using similar founder quotes. Neither piece named paying customers or published independent benchmarks — classic thin, same-lean coverage.",
      source_count: 2,
      category: "startups",
      tags: ["manufacturing", "ai", "launch", "hype"],
      created_at: hoursAgo(16),
      image_url: "https://images.unsplash.com/photo-1565043666747-69f6646db940?w=1200&q=80",
      primary_url: "https://techcrunch.com/example/factory-gpt",
      primary_source: "TechCrunch",
      primary_source_domain: "techcrunch.com",
    },
    articles: [
      {
        id: "a1111111-1111-4111-8111-111111111g01",
        title: "FactoryGPT launches to ‘reinvent the shop floor’",
        summary:
          "TechCrunch covers the seed round and product demo; no customer logos disclosed.",
        url: "https://techcrunch.com/example/factory-gpt",
        source_name: "TechCrunch",
        source_domain: "techcrunch.com",
        category: "startups",
        language: "en",
        published_at: hoursAgo(17),
        ingested_at: hoursAgo(16),
        image_url: "https://images.unsplash.com/photo-1565043666747-69f6646db940?w=1200&q=80",
      },
      {
        id: "a1111111-1111-4111-8111-111111111g02",
        title: "The Verge: FactoryGPT wants to be ChatGPT for plants",
        summary:
          "The Verge echoes the launch narrative with similar founder framing and no third-party validation.",
        url: "https://theverge.com/example/factory-gpt",
        source_name: "The Verge",
        source_domain: "theverge.com",
        category: "startups",
        language: "en",
        published_at: hoursAgo(17),
        ingested_at: hoursAgo(16),
        image_url: null,
      },
    ],
  },
]

function withCoverage(bundle: MockBundle): StoryWithArticles {
  const coverage_outlets = uniqueOutlets(bundle.articles, 8)
  return {
    ...bundle.story,
    coverage_outlets:
      coverage_outlets.length > 0 ? coverage_outlets : bundle.story.coverage_outlets,
    articles: bundle.articles,
  }
}

const ENRICHED = MOCK_BUNDLES.map(withCoverage)

export function isMockStoriesEnabled(): boolean {
  const flag = (process.env.USE_MOCK_STORIES || "").trim().toLowerCase()
  if (flag === "1" || flag === "true" || flag === "yes") return true
  if (flag === "0" || flag === "false" || flag === "no") return false
  // Never auto-mock in production deploys — missing env must fail empty, not show demo data.
  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    return false
  }
  // Local/dev: auto-on when Supabase public env is missing.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  return !url || !key
}

export function getMockStories(limit = 60): Story[] {
  return ENRICHED.slice(0, limit).map((s) => {
    const { articles: _articles, ...story } = s
    void _articles
    return story
  })
}

export function getMockStoriesByCategory(category: string, limit = 60): Story[] {
  return getMockStories(200)
    .filter((s) => s.category === category)
    .slice(0, limit)
}

export function getMockStoryById(id: string): StoryWithArticles | null {
  return ENRICHED.find((s) => s.id === id) || null
}

export function getMockStoriesByIds(ids: string[]): Story[] {
  const set = new Set(ids)
  return getMockStories(200).filter((s) => set.has(s.id))
}

export function getMockStoriesForBrief(dateYmd: string, limit = 24): Story[] {
  // Treat "today" (and any requested day in local demo) as having the freshest cluster.
  void dateYmd
  return getMockStories(limit)
}

export function getMockStoriesBySourceDomain(domain: string): Story[] {
  const normalized = domain.toLowerCase().replace(/^www\./, "")
  return ENRICHED.filter((s) =>
    s.articles.some((a) => {
      const d = (a.source_domain || "").toLowerCase().replace(/^www\./, "")
      return d === normalized || d.endsWith(`.${normalized}`)
    })
  ).map((s) => {
    const { articles: _articles, ...story } = s
    void _articles
    return story
  })
}

export function getMockArticlesForCompare(limit = 40): Article[] {
  const out: Article[] = []
  for (const bundle of ENRICHED) {
    for (const a of bundle.articles) {
      out.push(a)
      if (out.length >= limit) return out
    }
  }
  return out
}

export function findMockStoryByArticleId(articleId: string): StoryWithArticles | null {
  return ENRICHED.find((s) => s.articles.some((a) => a.id === articleId)) || null
}

export function getMockStats() {
  const stories = getMockStories(200)
  const domains = new Set<string>()
  for (const s of ENRICHED) {
    for (const a of s.articles) {
      if (a.source_domain) domains.add(a.source_domain)
    }
  }
  const categories = new Set(stories.map((s) => s.category).filter(Boolean))
  return {
    storyCount: stories.length,
    sourceCount: domains.size,
    categoryCount: categories.size,
  }
}
