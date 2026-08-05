import type { GlossaryCategory, GlossaryTerm } from "./types"

export const GLOSSARY_CATEGORIES: {
  id: GlossaryCategory
  label: string
  blurb: string
}[] = [
  { id: "ai", label: "AI & ML", blurb: "Models, training, and how AI products work" },
  { id: "security", label: "Security", blurb: "Attacks, defenses, and vulnerability jargon" },
  { id: "infra", label: "Infra & chips", blurb: "Cloud, networks, and the hardware underneath" },
  { id: "business", label: "Business", blurb: "Startups, funding, and company moves" },
  { id: "policy", label: "Policy & region", blurb: "Rules, identity, and Southeast Asia context" },
]

/** All match strings for a term (canonical + aliases), longest first. */
export function glossaryMatchForms(term: GlossaryTerm): string[] {
  const forms = [term.term_en, ...(term.aliases || [])]
  const unique = Array.from(new Set(forms.map((f) => f.trim()).filter(Boolean)))
  return unique.sort((a, b) => b.length - a.length)
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  // —— AI & ML ——
  {
    slug: "api",
    term_en: "API",
    term_km: "",
    definition_en:
      "Application Programming Interface. A set of rules that lets software components talk to each other.",
    definition_km: "",
    analogy:
      "Like a restaurant menu — it tells you what you can order but not how the kitchen makes it.",
    story_count: 0,
    category: "ai",
    aliases: ["APIs", "application programming interface"],
  },
  {
    slug: "llm",
    term_en: "LLM",
    term_km: "",
    definition_en:
      "Large Language Model. An AI trained on massive text datasets that can generate, translate, and summarize human language.",
    definition_km: "",
    analogy:
      "Like an extremely well-read person who has skimmed millions of books — knows a lot, but doesn't always get things right.",
    story_count: 0,
    category: "ai",
    aliases: ["LLMs", "large language model", "large language models"],
  },
  {
    slug: "transformer",
    term_en: "Transformer",
    term_km: "",
    definition_en:
      "A neural network architecture that processes data in parallel, forming the basis of modern large language models.",
    definition_km: "",
    analogy:
      "Like a librarian who can instantly find any page in any book by understanding context, not just keywords.",
    story_count: 0,
    category: "ai",
    aliases: ["transformers"],
  },
  {
    slug: "rag",
    term_en: "RAG",
    term_km: "",
    definition_en:
      "Retrieval-Augmented Generation. Combines a language model with a search system to ground responses in real data.",
    definition_km: "",
    analogy:
      "Like giving a student access to a library during an exam — they can still think, but now they have facts to reference.",
    story_count: 0,
    category: "ai",
    aliases: ["retrieval-augmented generation", "retrieval augmented generation"],
  },
  {
    slug: "gpu",
    term_en: "GPU",
    term_km: "",
    definition_en:
      "Graphics Processing Unit. Originally for rendering graphics, now the workhorse chip for AI training and inference.",
    definition_km: "",
    analogy:
      "Like a kitchen with 10,000 tiny chefs — each one simple, but together they can cook a thousand dishes at once.",
    story_count: 0,
    category: "ai",
    aliases: ["GPUs", "graphics processing unit"],
  },
  {
    slug: "fine-tuning",
    term_en: "Fine-tuning",
    term_km: "",
    definition_en:
      "Taking a pre-trained model and further training it on specific data to improve performance on a particular task.",
    definition_km: "",
    analogy:
      "Like a chef trained in French cuisine learning Thai recipes — the base skills transfer, but the flavors change.",
    story_count: 0,
    category: "ai",
    aliases: ["fine tuning", "finetuning", "fine-tuned"],
  },
  {
    slug: "inference",
    term_en: "Inference",
    term_km: "",
    definition_en:
      "Running a trained AI model to produce an answer or prediction — the “using it” step after training.",
    definition_km: "",
    analogy:
      "Like taking an exam after months of studying — the learning is done; now you're applying what you know.",
    story_count: 0,
    category: "ai",
    aliases: ["AI inference", "model inference"],
  },
  {
    slug: "training",
    term_en: "Model training",
    term_km: "",
    definition_en:
      "The process of teaching an AI model by showing it huge amounts of data so it learns patterns.",
    definition_km: "",
    analogy:
      "Like drilling vocabulary every day until the words stick — expensive, slow, and you mostly do it once.",
    story_count: 0,
    category: "ai",
    aliases: ["AI training", "training a model"],
  },
  {
    slug: "hallucination",
    term_en: "Hallucination",
    term_km: "",
    definition_en:
      "When an AI confidently invents facts, citations, or details that aren't true.",
    definition_km: "",
    analogy:
      "Like a student who fills exam blanks with confident-sounding nonsense instead of leaving them empty.",
    story_count: 0,
    category: "ai",
    aliases: ["hallucinations", "AI hallucination"],
  },
  {
    slug: "agent",
    term_en: "AI agent",
    term_km: "",
    definition_en:
      "An AI system that can plan steps and use tools (search, code, apps) to complete a goal, not just reply once.",
    definition_km: "",
    analogy:
      "Like an assistant who doesn't only answer questions — they book the ticket, check the calendar, and follow up.",
    story_count: 0,
    category: "ai",
    aliases: ["AI agents", "autonomous agent", "autonomous agents"],
  },
  {
    slug: "multimodal",
    term_en: "Multimodal",
    term_km: "",
    definition_en:
      "AI that can work with more than one kind of input — text, images, audio, or video — together.",
    definition_km: "",
    analogy:
      "Like a person who can read a caption and look at a photo at the same time to understand the meme.",
    story_count: 0,
    category: "ai",
    aliases: ["multi-modal", "multimodality"],
  },
  {
    slug: "embedding",
    term_en: "Embedding",
    term_km: "",
    definition_en:
      "A numeric fingerprint of text (or images) that lets computers measure how similar two things are.",
    definition_km: "",
    analogy:
      "Like plotting every idea on a map so nearby points mean related meanings — even if the words differ.",
    story_count: 0,
    category: "ai",
    aliases: ["embeddings", "vector embedding"],
  },
  {
    slug: "token",
    term_en: "Token",
    term_km: "",
    definition_en:
      "A small chunk of text (often a word piece) that language models read and generate one at a time.",
    definition_km: "",
    analogy:
      "Like Lego bricks for language — sentences are built by snapping bricks together, not whole paragraphs at once.",
    story_count: 0,
    category: "ai",
    aliases: ["tokens", "tokenization"],
  },
  {
    slug: "open-weights",
    term_en: "Open weights",
    term_km: "",
    definition_en:
      "AI model parameters released so others can download and run the model themselves — not only call an API.",
    definition_km: "",
    analogy:
      "Like publishing the recipe and the ingredients list, not just selling plated meals from a locked kitchen.",
    story_count: 0,
    category: "ai",
    aliases: ["open-weight", "open weight", "open-weight model"],
  },
  {
    slug: "prompt",
    term_en: "Prompt",
    term_km: "",
    definition_en:
      "The instructions or question you give an AI model to steer what it generates.",
    definition_km: "",
    analogy:
      "Like a briefing note for a junior writer — clearer instructions usually mean a better draft.",
    story_count: 0,
    category: "ai",
    aliases: ["prompts", "prompting", "system prompt"],
  },

  // —— Security ——
  {
    slug: "zero-day",
    term_en: "Zero-day",
    term_km: "",
    definition_en:
      "A software vulnerability that is unknown to the vendor and has no patch available, making it exploitable by attackers.",
    definition_km: "",
    analogy:
      "Like a lock manufacturer discovering their locks have a secret key — but they don't know about it yet.",
    story_count: 0,
    category: "security",
    aliases: ["zero day", "0-day", "zero-day vulnerability"],
  },
  {
    slug: "ransomware",
    term_en: "Ransomware",
    term_km: "",
    definition_en:
      "Malware that locks or encrypts your files and demands payment to unlock them.",
    definition_km: "",
    analogy:
      "Like someone changing your house locks and mailing you the new key only if you pay.",
    story_count: 0,
    category: "security",
    aliases: [],
  },
  {
    slug: "phishing",
    term_en: "Phishing",
    term_km: "",
    definition_en:
      "Fraud that tricks people into handing over passwords or money — often via fake emails or messages.",
    definition_km: "",
    analogy:
      "Like a fake bank teller who looks official enough that you willingly hand over your PIN.",
    story_count: 0,
    category: "security",
    aliases: ["phish", "spear phishing"],
  },
  {
    slug: "malware",
    term_en: "Malware",
    term_km: "",
    definition_en:
      "Malicious software — viruses, trojans, spyware, and similar tools designed to harm or spy.",
    definition_km: "",
    analogy:
      "Like inviting a “helper” into your house who secretly steals your keys and listens at the door.",
    story_count: 0,
    category: "security",
    aliases: [],
  },
  {
    slug: "cve",
    term_en: "CVE",
    term_km: "",
    definition_en:
      "Common Vulnerabilities and Exposures. A public ID for a known security flaw so vendors and defenders can track it.",
    definition_km: "",
    analogy:
      "Like a license plate for a bug — once it has a number, everyone can talk about the same problem.",
    story_count: 0,
    category: "security",
    aliases: ["CVEs", "common vulnerabilities and exposures"],
  },
  {
    slug: "encryption",
    term_en: "Encryption",
    term_km: "",
    definition_en:
      "Scrambling data so only people with the right key can read it.",
    definition_km: "",
    analogy:
      "Like writing a letter in a secret code — the envelope can be stolen, but the message stays unreadable.",
    story_count: 0,
    category: "security",
    aliases: ["encrypt", "encrypted"],
  },
  {
    slug: "mfa",
    term_en: "MFA",
    term_km: "",
    definition_en:
      "Multi-Factor Authentication. Proving who you are with more than a password — e.g. a phone code or app prompt.",
    definition_km: "",
    analogy:
      "Like needing both a key and a fingerprint to open a door — stealing one isn't enough.",
    story_count: 0,
    category: "security",
    aliases: ["multi-factor authentication", "2FA", "two-factor authentication"],
  },
  {
    slug: "breach",
    term_en: "Data breach",
    term_km: "",
    definition_en:
      "An incident where private data is accessed, stolen, or exposed without authorization.",
    definition_km: "",
    analogy:
      "Like a filing cabinet left unlocked overnight — someone may have copied everything inside.",
    story_count: 0,
    category: "security",
    aliases: ["data breaches", "security breach"],
  },
  {
    slug: "vulnerability",
    term_en: "Vulnerability",
    term_km: "",
    definition_en:
      "A weakness in software or systems that attackers can exploit to gain access or cause damage.",
    definition_km: "",
    analogy:
      "Like a cracked window in a locked house — the door is solid, but there's still a way in.",
    story_count: 0,
    category: "security",
    aliases: ["vulnerabilities", "security vulnerability"],
  },

  // —— Infra & chips ——
  {
    slug: "open-source",
    term_en: "Open Source",
    term_km: "",
    definition_en:
      "Software with source code that anyone can inspect, modify, and distribute freely.",
    definition_km: "",
    analogy:
      "Like a recipe that everyone can see, improve, and share — nobody owns it, but everyone benefits.",
    story_count: 0,
    category: "infra",
    aliases: ["open-source", "open source software", "OSS"],
  },
  {
    slug: "edge-computing",
    term_en: "Edge Computing",
    term_km: "",
    definition_en:
      "Processing data near the source (on the device) instead of sending it to a distant cloud server.",
    definition_km: "",
    analogy:
      "Like doing your math homework at your desk instead of mailing it to a tutor and waiting for the answer.",
    story_count: 0,
    category: "infra",
    aliases: ["edge compute", "the edge"],
  },
  {
    slug: "cloud",
    term_en: "Cloud",
    term_km: "",
    definition_en:
      "Computing power, storage, and apps rented from remote data centers instead of running only on your own machines.",
    definition_km: "",
    analogy:
      "Like renting a kitchen when you need it — you cook without owning the building or the ovens.",
    story_count: 0,
    category: "infra",
    aliases: ["the cloud", "cloud computing"],
  },
  {
    slug: "data-center",
    term_en: "Data center",
    term_km: "",
    definition_en:
      "A building full of servers that stores data and runs internet services at scale.",
    definition_km: "",
    analogy:
      "Like a warehouse for computers — racks of machines humming so websites and apps stay online.",
    story_count: 0,
    category: "infra",
    aliases: ["data centers", "datacenter", "datacenters"],
  },
  {
    slug: "semiconductor",
    term_en: "Semiconductor",
    term_km: "",
    definition_en:
      "The material and industry behind computer chips — the tiny circuits that power phones, PCs, and AI.",
    definition_km: "",
    analogy:
      "Like the steel of the digital age — almost every modern device is built around it.",
    story_count: 0,
    category: "infra",
    aliases: ["semiconductors"],
  },
  {
    slug: "latency",
    term_en: "Latency",
    term_km: "",
    definition_en:
      "The delay between sending a request and getting a response — how “laggy” a system feels.",
    definition_km: "",
    analogy:
      "Like waiting for a reply after you say hello across a long hallway — distance and traffic both slow it down.",
    story_count: 0,
    category: "infra",
    aliases: ["low latency", "high latency"],
  },
  {
    slug: "bandwidth",
    term_en: "Bandwidth",
    term_km: "",
    definition_en:
      "How much data can move across a network in a given time — the size of the pipe.",
    definition_km: "",
    analogy:
      "Like the width of a highway — more lanes mean more cars (data) can pass at once.",
    story_count: 0,
    category: "infra",
    aliases: [],
  },
  {
    slug: "serverless",
    term_en: "Serverless",
    term_km: "",
    definition_en:
      "A cloud style where you run code without managing servers yourself — the provider scales it for you.",
    definition_km: "",
    analogy:
      "Like a food court: you cook when hungry, but you don't own the kitchen staff or the building.",
    story_count: 0,
    category: "infra",
    aliases: ["serverless computing"],
  },
  {
    slug: "cdn",
    term_en: "CDN",
    term_km: "",
    definition_en:
      "Content Delivery Network. Copies of your site's files cached around the world so users load them from nearby servers.",
    definition_km: "",
    analogy:
      "Like stocking convenience stores in every neighborhood so people don't all drive to one warehouse.",
    story_count: 0,
    category: "infra",
    aliases: ["content delivery network", "CDNs"],
  },

  // —— Business ——
  {
    slug: "startup",
    term_en: "Startup",
    term_km: "",
    definition_en:
      "A young company designed to grow fast, usually by building a new product and raising outside funding.",
    definition_km: "",
    analogy:
      "Like a small restaurant betting it can become a chain — high risk, high ambition.",
    story_count: 0,
    category: "business",
    aliases: ["startups", "start-up", "start-ups"],
  },
  {
    slug: "ipo",
    term_en: "IPO",
    term_km: "",
    definition_en:
      "Initial Public Offering. When a private company sells shares to the public for the first time.",
    definition_km: "",
    analogy:
      "Like inviting the whole town to buy a piece of your shop instead of only friends and family owning it.",
    story_count: 0,
    category: "business",
    aliases: ["initial public offering", "IPOs", "going public"],
  },
  {
    slug: "valuation",
    term_en: "Valuation",
    term_km: "",
    definition_en:
      "An estimate of what a company is worth — often set by investors during a funding round.",
    definition_km: "",
    analogy:
      "Like agreeing on a house price before anyone moves in — a negotiated guess, not a receipt.",
    story_count: 0,
    category: "business",
    aliases: ["valuations", "company valuation"],
  },
  {
    slug: "acquisition",
    term_en: "Acquisition",
    term_km: "",
    definition_en:
      "When one company buys another — team, product, customers, or all of the above.",
    definition_km: "",
    analogy:
      "Like one shop buying the shop next door so it can expand the menu and the customer list.",
    story_count: 0,
    category: "business",
    aliases: ["acquisitions", "acquired", "M&A"],
  },
  {
    slug: "saas",
    term_en: "SaaS",
    term_km: "",
    definition_en:
      "Software as a Service. Software you use over the internet on a subscription, not installed once forever.",
    definition_km: "",
    analogy:
      "Like a gym membership for software — you pay monthly to use the equipment instead of buying the machines.",
    story_count: 0,
    category: "business",
    aliases: ["software as a service", "SaaS product"],
  },
  {
    slug: "venture-capital",
    term_en: "Venture capital",
    term_km: "",
    definition_en:
      "Investment money for startups that may grow big — high risk for investors, high upside if the bet works.",
    definition_km: "",
    analogy:
      "Like funding a film: most projects flop, a few blockbusters pay for everything.",
    story_count: 0,
    category: "business",
    aliases: ["VC", "VCs", "venture capitalists"],
  },
  {
    slug: "unicorn",
    term_en: "Unicorn",
    term_km: "",
    definition_en:
      "A private startup valued at $1 billion or more.",
    definition_km: "",
    analogy:
      "Like calling a rare animal by name — it signals “this company is huge for its stage,” not magic.",
    story_count: 0,
    category: "business",
    aliases: ["unicorns", "unicorn startup"],
  },
  {
    slug: "layoff",
    term_en: "Layoff",
    term_km: "",
    definition_en:
      "When a company cuts jobs, often in batches, for business reasons rather than individual performance.",
    definition_km: "",
    analogy:
      "Like a restaurant closing tables for the season — seats disappear even if the cooks worked hard.",
    story_count: 0,
    category: "business",
    aliases: ["layoffs", "laid off", "job cuts"],
  },

  // —— Policy & region ——
  {
    slug: "blockchain",
    term_en: "Blockchain",
    term_km: "",
    definition_en:
      "A distributed digital ledger that records transactions across many computers so the record can't be altered retroactively.",
    definition_km: "",
    analogy:
      "Like a group project where everyone has a copy of the notes — nobody can cheat by erasing their mistakes.",
    story_count: 0,
    category: "infra",
    aliases: ["blockchains", "on-chain"],
  },
  {
    slug: "asean",
    term_en: "ASEAN",
    term_km: "",
    definition_en:
      "Association of Southeast Asian Nations — a regional group of 10 countries that cooperate on trade, security, and policy.",
    definition_km: "",
    analogy:
      "Like a neighborhood association for countries — they don't merge into one house, but they set shared rules.",
    story_count: 0,
    category: "policy",
    aliases: [],
  },
  {
    slug: "digital-id",
    term_en: "Digital ID",
    term_km: "",
    definition_en:
      "An online identity system that proves who you are for government or private services — often a national ID app or card.",
    definition_km: "",
    analogy:
      "Like a passport for the internet — one trusted credential that unlocks many doors.",
    story_count: 0,
    category: "policy",
    aliases: ["digital identity", "e-ID", "national digital ID"],
  },
  {
    slug: "fintech",
    term_en: "Fintech",
    term_km: "",
    definition_en:
      "Technology that delivers financial services — payments, banking, lending, insurance — often via apps.",
    definition_km: "",
    analogy:
      "Like a bank branch that lives in your phone — same money jobs, different building.",
    story_count: 0,
    category: "policy",
    aliases: ["fintechs", "financial technology"],
  },
  {
    slug: "regulation",
    term_en: "Regulation",
    term_km: "",
    definition_en:
      "Rules set by governments that companies must follow — privacy, competition, AI safety, telecom, and more.",
    definition_km: "",
    analogy:
      "Like traffic laws for industry — they slow some moves, but keep the road usable for everyone.",
    story_count: 0,
    category: "policy",
    aliases: ["regulations", "regulatory"],
  },
  {
    slug: "gdpr",
    term_en: "GDPR",
    term_km: "",
    definition_en:
      "Europe's General Data Protection Regulation — a landmark privacy law that shaped how companies handle personal data worldwide.",
    definition_km: "",
    analogy:
      "Like a strict library policy for personal data: you must say why you collected it and who can read it.",
    story_count: 0,
    category: "policy",
    aliases: ["general data protection regulation"],
  },
  {
    slug: "content-moderation",
    term_en: "Content moderation",
    term_km: "",
    definition_en:
      "How platforms decide what posts stay up, get labeled, or get removed — by people, AI, or both.",
    definition_km: "",
    analogy:
      "Like a club bouncer for posts — some get in, some get a warning, some are turned away.",
    story_count: 0,
    category: "policy",
    aliases: ["content moderators"],
  },

  // —— AI & ML (expanded) ——
  {
    slug: "neural-network",
    term_en: "Neural network",
    term_km: "",
    definition_en:
      "A computing model loosely inspired by brains: layers of simple units that learn patterns from data.",
    definition_km: "",
    analogy:
      "Like a stack of filters for photos — each layer notices something simpler, and together they recognize a face.",
    story_count: 0,
    category: "ai",
    aliases: ["neural networks", "neural net", "neural nets"],
  },
  {
    slug: "deep-learning",
    term_en: "Deep learning",
    term_km: "",
    definition_en:
      "Machine learning that uses many-layered neural networks to learn complex patterns from raw data.",
    definition_km: "",
    analogy:
      "Like learning a language by immersion at every level — sounds, words, sentences — instead of only memorizing flashcards.",
    story_count: 0,
    category: "ai",
    aliases: ["deep-learning"],
  },
  {
    slug: "machine-learning",
    term_en: "Machine learning",
    term_km: "",
    definition_en:
      "Software that improves from examples instead of only following hand-written rules.",
    definition_km: "",
    analogy:
      "Like teaching by showing many examples of spam mail instead of writing a perfect rule for every scam.",
    story_count: 0,
    category: "ai",
    aliases: ["ML", "machine-learning"],
  },
  {
    slug: "generative-ai",
    term_en: "Generative AI",
    term_km: "",
    definition_en:
      "AI that creates new content — text, images, audio, or code — rather than only classifying existing data.",
    definition_km: "",
    analogy:
      "Like a studio that can draft a poster from a brief, not only sort posters into folders.",
    story_count: 0,
    category: "ai",
    aliases: ["gen AI", "genAI", "generative artificial intelligence"],
  },
  {
    slug: "foundation-model",
    term_en: "Foundation model",
    term_km: "",
    definition_en:
      "A large general-purpose AI model trained broadly, then adapted for many downstream tasks.",
    definition_km: "",
    analogy:
      "Like a versatile chassis you can turn into a taxi, delivery van, or ambulance with different add-ons.",
    story_count: 0,
    category: "ai",
    aliases: ["foundation models"],
  },
  {
    slug: "diffusion-model",
    term_en: "Diffusion model",
    term_km: "",
    definition_en:
      "A generative model that starts from noise and gradually reshapes it into an image (or other media).",
    definition_km: "",
    analogy:
      "Like developing a photo in reverse — beginning with static and slowly revealing a clear picture.",
    story_count: 0,
    category: "ai",
    aliases: ["diffusion models", "image diffusion"],
  },
  {
    slug: "computer-vision",
    term_en: "Computer vision",
    term_km: "",
    definition_en:
      "AI that interprets images and video — detecting objects, faces, text, or scenes.",
    definition_km: "",
    analogy:
      "Like teaching a camera not only to record, but to say what it's looking at.",
    story_count: 0,
    category: "ai",
    aliases: ["CV systems"],
  },
  {
    slug: "nlp",
    term_en: "NLP",
    term_km: "",
    definition_en:
      "Natural Language Processing — techniques that let computers work with human language.",
    definition_km: "",
    analogy:
      "Like hiring a translator between people and machines so chat, search, and docs make sense both ways.",
    story_count: 0,
    category: "ai",
    aliases: ["natural language processing"],
  },
  {
    slug: "reinforcement-learning",
    term_en: "Reinforcement learning",
    term_km: "",
    definition_en:
      "Training an AI by rewarding good actions and penalizing bad ones through trial and error.",
    definition_km: "",
    analogy:
      "Like learning to ride a bike — wobbly tries, small corrections, until balance becomes automatic.",
    story_count: 0,
    category: "ai",
    aliases: ["RL", "reinforcement-learning"],
  },
  {
    slug: "rlhf",
    term_en: "RLHF",
    term_km: "",
    definition_en:
      "Reinforcement Learning from Human Feedback — tuning a model using human preferences about better answers.",
    definition_km: "",
    analogy:
      "Like a writing coach ranking drafts so the student learns what “good” looks like to people.",
    story_count: 0,
    category: "ai",
    aliases: ["reinforcement learning from human feedback"],
  },
  {
    slug: "parameter",
    term_en: "Parameters",
    term_km: "",
    definition_en:
      "The learned numbers inside a model that store what it picked up during training — often counted in billions.",
    definition_km: "",
    analogy:
      "Like the dials on a giant mixing board — each tiny setting shapes the final sound.",
    story_count: 0,
    category: "ai",
    aliases: ["model parameters", "billion parameters"],
  },
  {
    slug: "context-window",
    term_en: "Context window",
    term_km: "",
    definition_en:
      "How much text (in tokens) a model can consider at once in a single conversation or prompt.",
    definition_km: "",
    analogy:
      "Like a desk that only fits so many pages — add too many and older ones fall on the floor.",
    story_count: 0,
    category: "ai",
    aliases: ["context length", "context windows"],
  },
  {
    slug: "temperature",
    term_en: "Temperature",
    term_km: "",
    definition_en:
      "A setting that controls how random or “creative” a model's next-word choices are.",
    definition_km: "",
    analogy:
      "Like a spice dial — low is predictable and safe; high is surprising and sometimes messy.",
    story_count: 0,
    category: "ai",
    aliases: ["sampling temperature"],
  },
  {
    slug: "benchmark",
    term_en: "Benchmark",
    term_km: "",
    definition_en:
      "A standard test used to compare AI models on skills like math, coding, or language understanding.",
    definition_km: "",
    analogy:
      "Like a timed exam every student takes so scores can be compared fairly.",
    story_count: 0,
    category: "ai",
    aliases: ["benchmarks", "AI benchmark"],
  },
  {
    slug: "synthetic-data",
    term_en: "Synthetic data",
    term_km: "",
    definition_en:
      "Artificial training examples generated by software or AI instead of collected from the real world.",
    definition_km: "",
    analogy:
      "Like practicing surgery on a mannequin — useful drills when real cases are scarce or private.",
    story_count: 0,
    category: "ai",
    aliases: ["synthetic datasets"],
  },
  {
    slug: "dataset",
    term_en: "Dataset",
    term_km: "",
    definition_en:
      "A structured collection of examples used to train, test, or evaluate AI systems.",
    definition_km: "",
    analogy:
      "Like a textbook of practice problems — the quality of the book shapes what the student learns.",
    story_count: 0,
    category: "ai",
    aliases: ["datasets", "training data"],
  },
  {
    slug: "overfitting",
    term_en: "Overfitting",
    term_km: "",
    definition_en:
      "When a model memorizes training examples too closely and fails on new, unseen cases.",
    definition_km: "",
    analogy:
      "Like memorizing last year's exam answers — you ace the past paper and blank on a fresh test.",
    story_count: 0,
    category: "ai",
    aliases: ["overfit"],
  },
  {
    slug: "bias",
    term_en: "AI bias",
    term_km: "",
    definition_en:
      "Systematic unfairness in model outputs, often reflecting skewed training data or design choices.",
    definition_km: "",
    analogy:
      "Like a hiring form that quietly favors people who look like last year's hires.",
    story_count: 0,
    category: "ai",
    aliases: ["model bias", "algorithmic bias"],
  },
  {
    slug: "alignment",
    term_en: "AI alignment",
    term_km: "",
    definition_en:
      "The effort to make AI systems behave in line with human goals, values, and safety constraints.",
    definition_km: "",
    analogy:
      "Like steering a powerful ship so it heads where the crew intends — not wherever the engines push.",
    story_count: 0,
    category: "ai",
    aliases: ["alignment research", "model alignment"],
  },
  {
    slug: "agi",
    term_en: "AGI",
    term_km: "",
    definition_en:
      "Artificial General Intelligence — hypothetical AI that can match or exceed humans across most cognitive tasks.",
    definition_km: "",
    analogy:
      "Like hiring one person who can do every job in the company well — still more vision than product today.",
    story_count: 0,
    category: "ai",
    aliases: ["artificial general intelligence"],
  },
  {
    slug: "copilot",
    term_en: "Copilot",
    term_km: "",
    definition_en:
      "An AI assistant embedded in a product to help you write, code, or work faster — usually as a sidekick, not a replacement.",
    definition_km: "",
    analogy:
      "Like a navigator in the passenger seat — suggesting turns while you still hold the wheel.",
    story_count: 0,
    category: "ai",
    aliases: ["AI copilot", "coding copilot"],
  },
  {
    slug: "chatbot",
    term_en: "Chatbot",
    term_km: "",
    definition_en:
      "Software that converses with users in natural language, from simple FAQs to advanced LLM assistants.",
    definition_km: "",
    analogy:
      "Like a help desk that never sleeps — quality depends entirely on who trained the staff.",
    story_count: 0,
    category: "ai",
    aliases: ["chatbots", "AI chatbot"],
  },
  {
    slug: "prompt-engineering",
    term_en: "Prompt engineering",
    term_km: "",
    definition_en:
      "Crafting instructions carefully so an AI model produces more reliable, useful outputs.",
    definition_km: "",
    analogy:
      "Like briefing a contractor with clear specs — vague asks get vague builds.",
    story_count: 0,
    category: "ai",
    aliases: ["prompt engineer"],
  },
  {
    slug: "vector-database",
    term_en: "Vector database",
    term_km: "",
    definition_en:
      "A database optimized to store embeddings and find nearest neighbors by meaning, not exact keywords.",
    definition_km: "",
    analogy:
      "Like a library sorted by “feels similar,” not only by alphabetical title.",
    story_count: 0,
    category: "ai",
    aliases: ["vector DB", "vector databases", "vector store"],
  },
  {
    slug: "quantization",
    term_en: "Quantization",
    term_km: "",
    definition_en:
      "Compressing a model by using fewer bits per number so it runs faster and cheaper with some accuracy trade-offs.",
    definition_km: "",
    analogy:
      "Like saving a photo at lower resolution — smaller file, still recognizable, fine details soft.",
    story_count: 0,
    category: "ai",
    aliases: ["model quantization", "quantized model"],
  },
  {
    slug: "distillation",
    term_en: "Knowledge distillation",
    term_km: "",
    definition_en:
      "Training a smaller model to mimic a larger one's behavior so you get similar results at lower cost.",
    definition_km: "",
    analogy:
      "Like a senior doctor teaching a junior the shortcuts — not every research paper, but the useful habits.",
    story_count: 0,
    category: "ai",
    aliases: ["distillation", "model distillation"],
  },
  {
    slug: "moe",
    term_en: "Mixture of Experts",
    term_km: "",
    definition_en:
      "An architecture where only some specialized sub-networks activate per input — aiming for bigger capacity without full cost every time.",
    definition_km: "",
    analogy:
      "Like a hospital routing you to the right specialist instead of every doctor examining you at once.",
    story_count: 0,
    category: "ai",
    aliases: ["MoE", "mixture-of-experts"],
  },
  {
    slug: "jailbreak",
    term_en: "Jailbreak",
    term_km: "",
    definition_en:
      "Tricks that push an AI past its safety filters to produce disallowed or unintended outputs.",
    definition_km: "",
    analogy:
      "Like convincing a bouncer with a fake story so they let you into the VIP area.",
    story_count: 0,
    category: "ai",
    aliases: ["jailbreaking", "prompt jailbreak"],
  },

  // —— Security (expanded) ——
  {
    slug: "botnet",
    term_en: "Botnet",
    term_km: "",
    definition_en:
      "A network of hijacked devices controlled together to spam, steal, or launch attacks.",
    definition_km: "",
    analogy:
      "Like a fleet of stolen scooters all steered remotely into the same intersection.",
    story_count: 0,
    category: "security",
    aliases: ["botnets"],
  },
  {
    slug: "ddos",
    term_en: "DDoS",
    term_km: "",
    definition_en:
      "Distributed Denial of Service — flooding a site or service with traffic so real users can't get through.",
    definition_km: "",
    analogy:
      "Like packing a store entrance with fake customers so nobody who wants to buy can enter.",
    story_count: 0,
    category: "security",
    aliases: ["DDoS attack", "denial of service", "distributed denial of service"],
  },
  {
    slug: "spyware",
    term_en: "Spyware",
    term_km: "",
    definition_en:
      "Software that secretly monitors devices — keystrokes, messages, location — and reports back to someone else.",
    definition_km: "",
    analogy:
      "Like a hidden camera in your living room that streams to a stranger.",
    story_count: 0,
    category: "security",
    aliases: [],
  },
  {
    slug: "trojan",
    term_en: "Trojan",
    term_km: "",
    definition_en:
      "Malware disguised as something useful so you install it willingly.",
    definition_km: "",
    analogy:
      "Like a gift box that opens into a burglar — named after the Trojan Horse myth.",
    story_count: 0,
    category: "security",
    aliases: ["trojan horse", "trojans"],
  },
  {
    slug: "exploit",
    term_en: "Exploit",
    term_km: "",
    definition_en:
      "Code or a technique that takes advantage of a vulnerability to break into or crash a system.",
    definition_km: "",
    analogy:
      "Like a crowbar shaped exactly for one weak latch.",
    story_count: 0,
    category: "security",
    aliases: ["exploits", "exploit code"],
  },
  {
    slug: "patch",
    term_en: "Security patch",
    term_km: "",
    definition_en:
      "An update that fixes a vulnerability or bug — often rushed out after a flaw is disclosed.",
    definition_km: "",
    analogy:
      "Like replacing a broken lock as soon as you learn the old one can be picked.",
    story_count: 0,
    category: "security",
    aliases: ["software patch", "security patches", "patch Tuesday"],
  },
  {
    slug: "firewall",
    term_en: "Firewall",
    term_km: "",
    definition_en:
      "A filter that allows or blocks network traffic based on rules — a first line of defense.",
    definition_km: "",
    analogy:
      "Like a security gate that checks IDs before anyone enters the building.",
    story_count: 0,
    category: "security",
    aliases: ["firewalls"],
  },
  {
    slug: "vpn",
    term_en: "VPN",
    term_km: "",
    definition_en:
      "Virtual Private Network — encrypts your traffic and routes it through another server to hide or protect your connection.",
    definition_km: "",
    analogy:
      "Like sending mail in a sealed tube through a trusted courier so café Wi‑Fi spies can't read it.",
    story_count: 0,
    category: "security",
    aliases: ["virtual private network", "VPNs"],
  },
  {
    slug: "zero-trust",
    term_en: "Zero trust",
    term_km: "",
    definition_en:
      "A security approach that verifies every access request — never assuming someone is safe just because they're “inside” the network.",
    definition_km: "",
    analogy:
      "Like badge-checking at every office door, not only at the lobby.",
    story_count: 0,
    category: "security",
    aliases: ["zero-trust", "zero trust architecture"],
  },
  {
    slug: "soc",
    term_en: "SOC",
    term_km: "",
    definition_en:
      "Security Operations Center — the team and tools that monitor threats and respond to incidents.",
    definition_km: "",
    analogy:
      "Like an air-traffic control tower for cyber alarms — watching screens, dispatching help.",
    story_count: 0,
    category: "security",
    aliases: ["security operations center", "SOCs"],
  },
  {
    slug: "apt",
    term_en: "APT",
    term_km: "",
    definition_en:
      "Advanced Persistent Threat — a skilled attacker (often state-linked) that stays hidden in a network for a long time.",
    definition_km: "",
    analogy:
      "Like a burglar who doesn't smash-and-grab — they live in the attic for months and learn the schedule.",
    story_count: 0,
    category: "security",
    aliases: ["advanced persistent threat", "APT group"],
  },
  {
    slug: "social-engineering",
    term_en: "Social engineering",
    term_km: "",
    definition_en:
      "Manipulating people into giving up access, money, or secrets — hacking humans, not just code.",
    definition_km: "",
    analogy:
      "Like a con artist who talks the guard into opening the gate instead of picking the lock.",
    story_count: 0,
    category: "security",
    aliases: [],
  },
  {
    slug: "credential-stuffing",
    term_en: "Credential stuffing",
    term_km: "",
    definition_en:
      "Trying stolen username/password pairs from one breach on many other sites.",
    definition_km: "",
    analogy:
      "Like using a copied house key on every door on the block to see which still match.",
    story_count: 0,
    category: "security",
    aliases: [],
  },
  {
    slug: "bug-bounty",
    term_en: "Bug bounty",
    term_km: "",
    definition_en:
      "A program that pays outside researchers to find and report security flaws ethically.",
    definition_km: "",
    analogy:
      "Like offering a reward for finding cracks in your own walls before thieves do.",
    story_count: 0,
    category: "security",
    aliases: ["bug bounties", "bug bounty program"],
  },
  {
    slug: "penetration-test",
    term_en: "Penetration test",
    term_km: "",
    definition_en:
      "An authorized simulated attack to find weaknesses before real attackers do.",
    definition_km: "",
    analogy:
      "Like hiring professional thieves to test your shop's locks and cameras — then fixing what they find.",
    story_count: 0,
    category: "security",
    aliases: ["pentest", "pen test", "penetration testing"],
  },
  {
    slug: "end-to-end-encryption",
    term_en: "End-to-end encryption",
    term_km: "",
    definition_en:
      "Encryption where only the endpoints can read the message — intermediaries see scrambled data.",
    definition_km: "",
    analogy:
      "Like a locked diary whose key only you and your friend hold — the courier can't open it.",
    story_count: 0,
    category: "security",
    aliases: ["E2EE", "end to end encryption"],
  },
  {
    slug: "dark-web",
    term_en: "Dark web",
    term_km: "",
    definition_en:
      "Parts of the internet reachable only with special software, often used for anonymity — including crime markets.",
    definition_km: "",
    analogy:
      "Like a back-alley bazaar behind a maze — not all of it is illegal, but plenty of it is shady.",
    story_count: 0,
    category: "security",
    aliases: ["darknet", "dark web markets"],
  },

  // —— Infra & chips (expanded) ——
  {
    slug: "cpu",
    term_en: "CPU",
    term_km: "",
    definition_en:
      "Central Processing Unit — the general-purpose brain of a computer that runs most software instructions.",
    definition_km: "",
    analogy:
      "Like a head chef who can cook anything, but one dish at a time carefully.",
    story_count: 0,
    category: "infra",
    aliases: ["CPUs", "central processing unit"],
  },
  {
    slug: "tpu",
    term_en: "TPU",
    term_km: "",
    definition_en:
      "Tensor Processing Unit — Google's custom chip family optimized for machine learning workloads.",
    definition_km: "",
    analogy:
      "Like a specialized bakery oven built only for bread — faster at that job than a general kitchen stove.",
    story_count: 0,
    category: "infra",
    aliases: ["TPUs", "tensor processing unit"],
  },
  {
    slug: "nvidia",
    term_en: "NVIDIA",
    term_km: "",
    definition_en:
      "A major chip company whose GPUs dominate AI training and graphics workloads.",
    definition_km: "",
    analogy:
      "Like the brand of engines most race teams happen to use this season — not the only option, but the default bet.",
    story_count: 0,
    category: "infra",
    aliases: ["Nvidia"],
  },
  {
    slug: "fab",
    term_en: "Chip fab",
    term_km: "",
    definition_en:
      "A semiconductor fabrication plant — the factory that manufactures chips on silicon wafers.",
    definition_km: "",
    analogy:
      "Like a ultra-clean bakery for circuits — one speck of dust can ruin the whole batch.",
    story_count: 0,
    category: "infra",
    aliases: ["fab", "fabs", "foundry", "semiconductor fab"],
  },
  {
    slug: "eu-v",
    term_en: "EUV",
    term_km: "",
    definition_en:
      "Extreme Ultraviolet lithography — advanced light technology used to print the smallest chip features.",
    definition_km: "",
    analogy:
      "Like carving jewelry with a laser so fine it can etch patterns smaller than a virus.",
    story_count: 0,
    category: "infra",
    aliases: ["extreme ultraviolet", "EUV lithography"],
  },
  {
    slug: "5g",
    term_en: "5G",
    term_km: "",
    definition_en:
      "The fifth generation of mobile networks — higher speeds and lower latency than 4G for phones and connected devices.",
    definition_km: "",
    analogy:
      "Like upgrading from a two-lane road to an expressway with more exits for gadgets.",
    story_count: 0,
    category: "infra",
    aliases: ["5G network", "5G networks"],
  },
  {
    slug: "fiber",
    term_en: "Fiber optic",
    term_km: "",
    definition_en:
      "Cables that send data as light through glass strands — the backbone of fast internet.",
    definition_km: "",
    analogy:
      "Like shipping messages as beams of light through tiny glass highways.",
    story_count: 0,
    category: "infra",
    aliases: ["fiber", "fibre", "fiber optics", "fibre optic"],
  },
  {
    slug: "iot",
    term_en: "IoT",
    term_km: "",
    definition_en:
      "Internet of Things — everyday devices (sensors, cameras, appliances) connected to the internet.",
    definition_km: "",
    analogy:
      "Like giving your fridge, lock, and thermostat a phone number so they can talk to apps.",
    story_count: 0,
    category: "infra",
    aliases: ["Internet of Things", "IoT devices"],
  },
  {
    slug: "container",
    term_en: "Container",
    term_km: "",
    definition_en:
      "A portable package of an app and its dependencies so it runs the same way everywhere.",
    definition_km: "",
    analogy:
      "Like a shipping container for software — load it once, move it between ships without repacking.",
    story_count: 0,
    category: "infra",
    aliases: ["containers", "Docker container", "containerization"],
  },
  {
    slug: "kubernetes",
    term_en: "Kubernetes",
    term_km: "",
    definition_en:
      "Open-source software that schedules and manages containers across clusters of machines.",
    definition_km: "",
    analogy:
      "Like an air-traffic control system for shipping containers — deciding what runs where and when.",
    story_count: 0,
    category: "infra",
    aliases: ["K8s", "k8s"],
  },
  {
    slug: "microservice",
    term_en: "Microservice",
    term_km: "",
    definition_en:
      "An architecture style that splits a product into small independent services that talk over the network.",
    definition_km: "",
    analogy:
      "Like a food court of specialist stalls instead of one giant kitchen making every dish.",
    story_count: 0,
    category: "infra",
    aliases: ["microservices", "microservice architecture"],
  },
  {
    slug: "api-gateway",
    term_en: "API gateway",
    term_km: "",
    definition_en:
      "A front door for APIs that handles routing, auth, rate limits, and monitoring in one place.",
    definition_km: "",
    analogy:
      "Like a hotel concierge who greets guests and sends them to the right room.",
    story_count: 0,
    category: "infra",
    aliases: ["API gateways"],
  },
  {
    slug: "uptime",
    term_en: "Uptime",
    term_km: "",
    definition_en:
      "How long a service stays available without outages — often sold as a percentage like 99.9%.",
    definition_km: "",
    analogy:
      "Like a shop's open hours reliability — 99.9% still means occasional unexpected closures.",
    story_count: 0,
    category: "infra",
    aliases: ["uptime SLA", "high availability"],
  },
  {
    slug: "outage",
    term_en: "Outage",
    term_km: "",
    definition_en:
      "A period when a service, network, or website is unavailable.",
    definition_km: "",
    analogy:
      "Like the lights going out on a whole street — suddenly nobody can use what's usually there.",
    story_count: 0,
    category: "infra",
    aliases: ["outages", "service outage"],
  },
  {
    slug: "cdn-cache",
    term_en: "Caching",
    term_km: "",
    definition_en:
      "Temporarily storing data close by so repeated requests are faster.",
    definition_km: "",
    analogy:
      "Like keeping snacks on your desk so you don't walk to the kitchen for every bite.",
    story_count: 0,
    category: "infra",
    aliases: ["cache hit", "cache miss", "CDN cache"],
  },
  {
    slug: "load-balancer",
    term_en: "Load balancer",
    term_km: "",
    definition_en:
      "A system that spreads incoming traffic across many servers so none get overwhelmed.",
    definition_km: "",
    analogy:
      "Like a restaurant host seating guests at empty tables instead of piling everyone on one.",
    story_count: 0,
    category: "infra",
    aliases: ["load balancing", "load balancers"],
  },
  {
    slug: "object-storage",
    term_en: "Object storage",
    term_km: "",
    definition_en:
      "Cloud storage for files (objects) at massive scale — images, backups, datasets — accessed by API.",
    definition_km: "",
    analogy:
      "Like a gigantic self-serve locker room where each file has its own numbered locker.",
    story_count: 0,
    category: "infra",
    aliases: ["S3 storage", "blob storage"],
  },
  {
    slug: "devops",
    term_en: "DevOps",
    term_km: "",
    definition_en:
      "A culture and toolkit that connects software development with IT operations for faster, safer releases.",
    definition_km: "",
    analogy:
      "Like chefs and waitstaff sharing one kitchen plan so food leaves hot and on time.",
    story_count: 0,
    category: "infra",
    aliases: ["DevOps team"],
  },
  {
    slug: "ci-cd",
    term_en: "CI/CD",
    term_km: "",
    definition_en:
      "Continuous Integration / Continuous Delivery — automatically testing and shipping code changes often.",
    definition_km: "",
    analogy:
      "Like a factory conveyor that checks every widget before it ships — many small deliveries, fewer big surprises.",
    story_count: 0,
    category: "infra",
    aliases: ["continuous integration", "continuous delivery", "continuous deployment"],
  },
  {
    slug: "opensource-license",
    term_en: "Open-source license",
    term_km: "",
    definition_en:
      "Legal terms that say how you may use, modify, and share open-source software (MIT, Apache, GPL, etc.).",
    definition_km: "",
    analogy:
      "Like the house rules taped to a shared kitchen — free to use, but some recipes must stay public.",
    story_count: 0,
    category: "infra",
    aliases: ["OSS license", "software license"],
  },

  // —— Business (expanded) ——
  {
    slug: "series-a",
    term_en: "Series A",
    term_km: "",
    definition_en:
      "An early major venture funding round after seed — usually to scale a product that already shows traction.",
    definition_km: "",
    analogy:
      "Like upgrading from a pop-up stall to a permanent shop once customers keep coming back.",
    story_count: 0,
    category: "business",
    aliases: ["Series A funding", "Series-A"],
  },
  {
    slug: "seed-round",
    term_en: "Seed round",
    term_km: "",
    definition_en:
      "Very early funding to build a first product and find product-market fit.",
    definition_km: "",
    analogy:
      "Like friends chipping in so you can rent a kitchen and try the menu on real customers.",
    story_count: 0,
    category: "business",
    aliases: ["seed funding", "seed stage"],
  },
  {
    slug: "series-b",
    term_en: "Series B",
    term_km: "",
    definition_en:
      "A later growth funding round focused on scaling sales, hiring, and expansion after product-market fit.",
    definition_km: "",
    analogy:
      "Like opening new branches after the first location proves it works.",
    story_count: 0,
    category: "business",
    aliases: ["Series B funding"],
  },
  {
    slug: "burn-rate",
    term_en: "Burn rate",
    term_km: "",
    definition_en:
      "How quickly a startup spends cash — usually measured per month.",
    definition_km: "",
    analogy:
      "Like watching the fuel gauge on a long road trip — high burn means fewer months until empty.",
    story_count: 0,
    category: "business",
    aliases: ["cash burn", "monthly burn"],
  },
  {
    slug: "runway",
    term_en: "Runway",
    term_km: "",
    definition_en:
      "How many months a company can operate before cash runs out at the current burn rate.",
    definition_km: "",
    analogy:
      "Like how far the plane can fly before it needs to refuel — or land.",
    story_count: 0,
    category: "business",
    aliases: ["cash runway"],
  },
  {
    slug: "product-market-fit",
    term_en: "Product-market fit",
    term_km: "",
    definition_en:
      "The moment a product clearly satisfies a real market — users want it enough to keep using and paying.",
    definition_km: "",
    analogy:
      "Like a street-food cart that suddenly has a daily queue — you stopped guessing; demand is obvious.",
    story_count: 0,
    category: "business",
    aliases: ["PMF", "product market fit"],
  },
  {
    slug: "pivot",
    term_en: "Pivot",
    term_km: "",
    definition_en:
      "A significant change in product, customers, or business model when the original plan isn't working.",
    definition_km: "",
    analogy:
      "Like a restaurant that switches from fine dining to takeaway noodles after the room stays empty.",
    story_count: 0,
    category: "business",
    aliases: ["pivoted", "pivoting"],
  },
  {
    slug: "arr",
    term_en: "ARR",
    term_km: "",
    definition_en:
      "Annual Recurring Revenue — yearly subscription revenue, a key SaaS growth metric.",
    definition_km: "",
    analogy:
      "Like counting gym memberships for the year, not one-off smoothie sales.",
    story_count: 0,
    category: "business",
    aliases: ["annual recurring revenue"],
  },
  {
    slug: "mrr",
    term_en: "MRR",
    term_km: "",
    definition_en:
      "Monthly Recurring Revenue — subscription revenue normalized to a month.",
    definition_km: "",
    analogy:
      "Like your predictable monthly rent income from tenants — not including one-time deposits.",
    story_count: 0,
    category: "business",
    aliases: ["monthly recurring revenue"],
  },
  {
    slug: "churn",
    term_en: "Churn",
    term_km: "",
    definition_en:
      "The rate at which customers cancel or stop paying for a subscription product.",
    definition_km: "",
    analogy:
      "Like a leaky bucket — you can keep pouring new users in, but growth stalls if water drains out.",
    story_count: 0,
    category: "business",
    aliases: ["churn rate", "customer churn"],
  },
  {
    slug: "marketplace",
    term_en: "Marketplace",
    term_km: "",
    definition_en:
      "A platform that connects buyers and sellers (or riders and drivers) and usually takes a cut.",
    definition_km: "",
    analogy:
      "Like a night market organizer — you don't cook every dish; you bring stalls and customers together.",
    story_count: 0,
    category: "business",
    aliases: ["marketplaces", "two-sided marketplace"],
  },
  {
    slug: "platform",
    term_en: "Tech platform",
    term_km: "",
    definition_en:
      "A base product others build on — app stores, cloud APIs, or social networks that host ecosystems.",
    definition_km: "",
    analogy:
      "Like a shopping mall — the value is the space and foot traffic, not only one store.",
    story_count: 0,
    category: "business",
    aliases: ["platform business", "platform company"],
  },
  {
    slug: "monetization",
    term_en: "Monetization",
    term_km: "",
    definition_en:
      "How a product turns users or attention into revenue — ads, subscriptions, fees, and more.",
    definition_km: "",
    analogy:
      "Like deciding whether a festival charges tickets, sells food stalls, or both.",
    story_count: 0,
    category: "business",
    aliases: ["monetize", "monetizing"],
  },
  {
    slug: "spin-off",
    term_en: "Spin-off",
    term_km: "",
    definition_en:
      "When a company splits out a division into a separate business.",
    definition_km: "",
    analogy:
      "Like a big restaurant group letting one popular brand become its own independent chain.",
    story_count: 0,
    category: "business",
    aliases: ["spinoff", "spun off"],
  },
  {
    slug: "merger",
    term_en: "Merger",
    term_km: "",
    definition_en:
      "When two companies combine into one — related to, but not identical to, an acquisition.",
    definition_km: "",
    analogy:
      "Like two neighboring shops tearing down the wall and sharing one sign.",
    story_count: 0,
    category: "business",
    aliases: ["mergers", "merged"],
  },
  {
    slug: "stock-buyback",
    term_en: "Stock buyback",
    term_km: "",
    definition_en:
      "When a company purchases its own shares, often to return cash to shareholders or boost per-share metrics.",
    definition_km: "",
    analogy:
      "Like a club buying back memberships so fewer people own a larger slice.",
    story_count: 0,
    category: "business",
    aliases: ["share buyback", "buybacks", "share repurchase"],
  },
  {
    slug: "earnings",
    term_en: "Earnings report",
    term_km: "",
    definition_en:
      "A company's periodic public update on revenue, profit, and outlook — closely watched by markets.",
    definition_km: "",
    analogy:
      "Like a report card day for public companies — grades, comments, and next-term goals.",
    story_count: 0,
    category: "business",
    aliases: ["earnings", "quarterly earnings", "earnings call"],
  },

  // —— Policy & region (expanded) ——
  {
    slug: "antitrust",
    term_en: "Antitrust",
    term_km: "",
    definition_en:
      "Laws and cases aimed at preventing monopolies and unfair competition.",
    definition_km: "",
    analogy:
      "Like rules that stop one mega-mall from buying every shop so customers still have choices.",
    story_count: 0,
    category: "policy",
    aliases: ["anti-trust", "competition law"],
  },
  {
    slug: "data-privacy",
    term_en: "Data privacy",
    term_km: "",
    definition_en:
      "Rules and practices about how personal information is collected, stored, shared, and deleted.",
    definition_km: "",
    analogy:
      "Like deciding who may photocopy your ID — and how long they can keep the copy.",
    story_count: 0,
    category: "policy",
    aliases: ["personal data protection", "data privacy law"],
  },
  {
    slug: "ai-act",
    term_en: "EU AI Act",
    term_km: "",
    definition_en:
      "Europe's landmark regulation classifying AI systems by risk and setting obligations for providers and users.",
    definition_km: "",
    analogy:
      "Like vehicle safety classes — toys, city cars, and trucks follow different rulebooks.",
    story_count: 0,
    category: "policy",
    aliases: ["AI Act", "European AI Act"],
  },
  {
    slug: "digital-services-act",
    term_en: "Digital Services Act",
    term_km: "",
    definition_en:
      "EU rules for online platforms on illegal content, transparency, and systemic risk — often abbreviated DSA.",
    definition_km: "",
    analogy:
      "Like requiring big markets to post clear rules and remove dangerous stalls faster.",
    story_count: 0,
    category: "policy",
    aliases: ["DSA", "EU DSA"],
  },
  {
    slug: "net-neutrality",
    term_en: "Net neutrality",
    term_km: "",
    definition_en:
      "The principle that internet providers should treat all traffic equally — not favoring or blocking sites for payment.",
    definition_km: "",
    analogy:
      "Like a postal service that delivers every letter at the same speed, no matter who wrote it.",
    story_count: 0,
    category: "policy",
    aliases: ["network neutrality"],
  },
  {
    slug: "surveillance",
    term_en: "Surveillance",
    term_km: "",
    definition_en:
      "Systematic monitoring of people or communications by governments or companies.",
    definition_km: "",
    analogy:
      "Like CCTV on every corner — safety for some, a constant watcher for others.",
    story_count: 0,
    category: "policy",
    aliases: ["mass surveillance", "digital surveillance"],
  },
  {
    slug: "censorship",
    term_en: "Censorship",
    term_km: "",
    definition_en:
      "Blocking or suppressing information — by governments, platforms, or other authorities.",
    definition_km: "",
    analogy:
      "Like blacking out pages in a newspaper before it hits the street.",
    story_count: 0,
    category: "policy",
    aliases: ["internet censorship", "censored"],
  },
  {
    slug: "sanctions",
    term_en: "Sanctions",
    term_km: "",
    definition_en:
      "Penalties — often trade or tech export limits — used by countries to pressure other governments or companies.",
    definition_km: "",
    analogy:
      "Like grounding a teammate from the supply closet until they change behavior.",
    story_count: 0,
    category: "policy",
    aliases: ["export sanctions", "trade sanctions"],
  },
  {
    slug: "export-controls",
    term_en: "Export controls",
    term_km: "",
    definition_en:
      "Rules limiting which technologies (like advanced chips) can be sold to certain countries or buyers.",
    definition_km: "",
    analogy:
      "Like a customs list of tools you're not allowed to ship abroad without a special permit.",
    story_count: 0,
    category: "policy",
    aliases: ["chip export controls", "tech export controls"],
  },
  {
    slug: "data-localization",
    term_en: "Data localization",
    term_km: "",
    definition_en:
      "Rules requiring certain data to be stored or processed inside a country's borders.",
    definition_km: "",
    analogy:
      "Like insisting important files stay in the national filing room, not a warehouse overseas.",
    story_count: 0,
    category: "policy",
    aliases: ["data residency"],
  },
  {
    slug: "open-banking",
    term_en: "Open banking",
    term_km: "",
    definition_en:
      "Rules and APIs that let licensed apps access bank data (with consent) to build new financial services.",
    definition_km: "",
    analogy:
      "Like letting a trusted bookkeeper read your bank statements — with your permission — to automate bills.",
    story_count: 0,
    category: "policy",
    aliases: [],
  },
  {
    slug: "digital-payment",
    term_en: "Digital payments",
    term_km: "",
    definition_en:
      "Moving money via apps, QR codes, cards, or transfers instead of cash — central to fintech in ASEAN.",
    definition_km: "",
    analogy:
      "Like paying the noodle stall by scanning a code instead of counting bills.",
    story_count: 0,
    category: "policy",
    aliases: ["digital payment", "cashless payment", "QR payment"],
  },
  {
    slug: "e-government",
    term_en: "E-government",
    term_km: "",
    definition_en:
      "Delivering public services online — IDs, taxes, licenses — through digital portals and apps.",
    definition_km: "",
    analogy:
      "Like a government office that fits in your phone instead of a queue under fluorescent lights.",
    story_count: 0,
    category: "policy",
    aliases: ["egovernment", "digital government"],
  },
  {
    slug: "misinformation",
    term_en: "Misinformation",
    term_km: "",
    definition_en:
      "False or misleading information shared regardless of intent — often contrasted with deliberate disinformation.",
    definition_km: "",
    analogy:
      "Like a wrong map passed around a hiking group — not always malice, still gets people lost.",
    story_count: 0,
    category: "policy",
    aliases: ["disinformation", "fake news"],
  },
  {
    slug: "deepfake",
    term_en: "Deepfake",
    term_km: "",
    definition_en:
      "AI-generated audio or video that convincingly fakes a real person's likeness or voice.",
    definition_km: "",
    analogy:
      "Like a puppet that wears someone's face so well strangers think the person is speaking.",
    story_count: 0,
    category: "policy",
    aliases: ["deepfakes", "deep fake"],
  },
  {
    slug: "copyright",
    term_en: "Copyright",
    term_km: "",
    definition_en:
      "Legal rights that control how creative works (code, music, writing, images) can be copied and reused.",
    definition_km: "",
    analogy:
      "Like a deed for a song or photo — others need permission (or a license) to rebuild with it.",
    story_count: 0,
    category: "policy",
    aliases: ["copyrights", "copyrighted"],
  },
  {
    slug: "patent",
    term_en: "Patent",
    term_km: "",
    definition_en:
      "A time-limited legal monopoly on an invention — others can't commercially use it without a license.",
    definition_km: "",
    analogy:
      "Like a temporary exclusive recipe right — you publish how it works, but only you may sell it for a while.",
    story_count: 0,
    category: "policy",
    aliases: ["patents", "patent filing"],
  },
  {
    slug: "whistleblower",
    term_en: "Whistleblower",
    term_km: "",
    definition_en:
      "Someone who reports wrongdoing inside an organization, often at personal risk.",
    definition_km: "",
    analogy:
      "Like a firefighter pulling the alarm from inside the building — loud, costly, sometimes necessary.",
    story_count: 0,
    category: "policy",
    aliases: ["whistleblowers", "whistle-blower"],
  },

  // —— Cambodia / ASEAN / payments ——
  {
    slug: "bakong",
    term_en: "Bakong",
    term_km: "",
    definition_en:
      "Cambodia's central-bank digital payment system — a real-time retail/payment rail run with the National Bank of Cambodia.",
    definition_km: "",
    analogy:
      "Like a national digital wallet highway — banks and apps ride the same rails to move riel instantly.",
    story_count: 0,
    category: "policy",
    aliases: ["Bakong wallet", "Bakong system"],
  },
  {
    slug: "khqr",
    term_en: "KHQR",
    term_km: "",
    definition_en:
      "Cambodia's standardized QR payment code — one scan format that works across participating banks and wallets.",
    definition_km: "",
    analogy:
      "Like one universal price-tag barcode for payments — any participating app can read the same sticker.",
    story_count: 0,
    category: "policy",
    aliases: ["KH QR", "Cambodia QR"],
  },
  {
    slug: "kyc",
    term_en: "KYC",
    term_km: "",
    definition_en:
      "Know Your Customer — identity checks banks and fintechs run before letting you open accounts or move larger sums.",
    definition_km: "",
    analogy:
      "Like showing your ID at a hotel desk before you get a room key.",
    story_count: 0,
    category: "policy",
    aliases: ["know your customer", "KYC check"],
  },
  {
    slug: "aml",
    term_en: "AML",
    term_km: "",
    definition_en:
      "Anti-Money Laundering — rules and monitoring that try to stop dirty money being hidden through banks and apps.",
    definition_km: "",
    analogy:
      "Like airport security for cash flows — unusual bags get pulled aside and questioned.",
    story_count: 0,
    category: "policy",
    aliases: ["anti-money laundering", "AML compliance"],
  },
  {
    slug: "cbdc",
    term_en: "CBDC",
    term_km: "",
    definition_en:
      "Central Bank Digital Currency — digital money issued by a country's central bank (distinct from crypto tokens).",
    definition_km: "",
    analogy:
      "Like cash printed as software by the national mint — still official money, just not paper.",
    story_count: 0,
    category: "policy",
    aliases: ["central bank digital currency", "CBDCs"],
  },
  {
    slug: "biometric-id",
    term_en: "Biometric ID",
    term_km: "",
    definition_en:
      "Identity verification using body traits — fingerprint, face, iris — instead of only passwords or cards.",
    definition_km: "",
    analogy:
      "Like using your face as the key — convenient, but you can't change your face if it's copied.",
    story_count: 0,
    category: "policy",
    aliases: ["biometrics", "biometric authentication", "facial recognition"],
  },

  // —— Crypto / Web3 ——
  {
    slug: "cryptocurrency",
    term_en: "Cryptocurrency",
    term_km: "",
    definition_en:
      "Digital money secured by cryptography and usually recorded on a blockchain — Bitcoin is the best-known example.",
    definition_km: "",
    analogy:
      "Like casino chips for the internet — valuable inside the system if enough people accept them.",
    story_count: 0,
    category: "policy",
    aliases: ["crypto", "cryptocurrencies", "digital currency"],
  },
  {
    slug: "bitcoin",
    term_en: "Bitcoin",
    term_km: "",
    definition_en:
      "The first major cryptocurrency — a scarce digital asset secured by a public blockchain and mining.",
    definition_km: "",
    analogy:
      "Like digital gold with a public ledger — everyone can see the vault log, nobody can quietly reprint bars.",
    story_count: 0,
    category: "policy",
    aliases: ["BTC"],
  },
  {
    slug: "ethereum",
    term_en: "Ethereum",
    term_km: "",
    definition_en:
      "A major blockchain platform for smart contracts and apps, with ether (ETH) as its native token.",
    definition_km: "",
    analogy:
      "Like a world computer that also has its own fuel token to pay for running programs.",
    story_count: 0,
    category: "policy",
    aliases: ["ETH", "Ether"],
  },
  {
    slug: "stablecoin",
    term_en: "Stablecoin",
    term_km: "",
    definition_en:
      "A crypto token designed to hold a steady value — often pegged to the US dollar.",
    definition_km: "",
    analogy:
      "Like a digital traveler's check meant to stay near $1 instead of swinging like a meme coin.",
    story_count: 0,
    category: "policy",
    aliases: ["stablecoins", "USD stablecoin"],
  },
  {
    slug: "defi",
    term_en: "DeFi",
    term_km: "",
    definition_en:
      "Decentralized Finance — lending, trading, and banking-like services run by smart contracts instead of traditional banks.",
    definition_km: "",
    analogy:
      "Like an ATM network with no bank branch — code holds the vault keys.",
    story_count: 0,
    category: "policy",
    aliases: ["decentralized finance"],
  },
  {
    slug: "nft",
    term_en: "NFT",
    term_km: "",
    definition_en:
      "Non-Fungible Token — a blockchain record that marks a unique item (art, ticket, collectible) as one-of-a-kind.",
    definition_km: "",
    analogy:
      "Like a certificate of authenticity for a digital poster — the file can be copied; the certificate is scarce.",
    story_count: 0,
    category: "policy",
    aliases: ["NFTs", "non-fungible token", "non-fungible tokens"],
  },
  {
    slug: "web3",
    term_en: "Web3",
    term_km: "",
    definition_en:
      "A marketing umbrella for internet apps built around blockchains, tokens, and user-owned credentials.",
    definition_km: "",
    analogy:
      "Like promising a new mall where shoppers also own shares of the stalls — still under construction.",
    story_count: 0,
    category: "policy",
    aliases: ["Web 3", "web 3.0"],
  },
  {
    slug: "smart-contract",
    term_en: "Smart contract",
    term_km: "",
    definition_en:
      "Code on a blockchain that automatically runs agreements when conditions are met.",
    definition_km: "",
    analogy:
      "Like a vending machine contract — insert the right inputs, get the output without a cashier.",
    story_count: 0,
    category: "policy",
    aliases: ["smart contracts"],
  },

  // —— Security extras ——
  {
    slug: "supply-chain-attack",
    term_en: "Supply-chain attack",
    term_km: "",
    definition_en:
      "Compromising software by hitting a dependency, vendor, or update channel that many victims trust.",
    definition_km: "",
    analogy:
      "Like poisoning the flour mill instead of every bakery — one breach feeds many kitchens.",
    story_count: 0,
    category: "security",
    aliases: ["software supply chain attack", "supply chain compromise"],
  },
  {
    slug: "zero-click",
    term_en: "Zero-click",
    term_km: "",
    definition_en:
      "An exploit that infects a device with no tap or download from the victim — often via a message that auto-processes.",
    definition_km: "",
    analogy:
      "Like a letter that unlocks your door as soon as the mail slot swallows it — you never open the envelope.",
    story_count: 0,
    category: "security",
    aliases: ["zero-click exploit", "zero click attack"],
  },
  {
    slug: "sim-swap",
    term_en: "SIM swap",
    term_km: "",
    definition_en:
      "Fraud where attackers take over your phone number so SMS codes and calls route to them.",
    definition_km: "",
    analogy:
      "Like convincing the post office to redirect your mailbox — then intercepting every one-time password.",
    story_count: 0,
    category: "security",
    aliases: ["SIM swapping", "simjacking"],
  },
  {
    slug: "otp",
    term_en: "OTP",
    term_km: "",
    definition_en:
      "One-Time Password — a short-lived code (often SMS or app) used as a second login factor.",
    definition_km: "",
    analogy:
      "Like a hotel room code that expires after one use.",
    story_count: 0,
    category: "security",
    aliases: ["one-time password", "one time password", "OTPs"],
  },
  {
    slug: "raas",
    term_en: "Ransomware-as-a-service",
    term_km: "",
    definition_en:
      "Criminal kits that let affiliates run ransomware attacks using someone else's malware and infrastructure for a cut.",
    definition_km: "",
    analogy:
      "Like franchise crime — headquarters builds the tools; local crews run the heists.",
    story_count: 0,
    category: "security",
    aliases: ["RaaS", "ransomware as a service"],
  },

  // —— Infra / developer jargon ——
  {
    slug: "sdk",
    term_en: "SDK",
    term_km: "",
    definition_en:
      "Software Development Kit — libraries and tools vendors give developers to build on a platform faster.",
    definition_km: "",
    analogy:
      "Like a LEGO kit with the specialty bricks and instructions for one theme park ride.",
    story_count: 0,
    category: "infra",
    aliases: ["SDKs", "software development kit"],
  },
  {
    slug: "oauth",
    term_en: "OAuth",
    term_km: "",
    definition_en:
      "A standard way for apps to get limited access to your account on another service without sharing your password.",
    definition_km: "",
    analogy:
      "Like a hotel keycard for one floor — access without handing over the master key.",
    story_count: 0,
    category: "infra",
    aliases: ["OAuth 2.0", "OAuth2"],
  },
  {
    slug: "sso",
    term_en: "SSO",
    term_km: "",
    definition_en:
      "Single Sign-On — log in once to a company identity system and reach many apps.",
    definition_km: "",
    analogy:
      "Like one office badge that opens every door you're allowed to enter.",
    story_count: 0,
    category: "infra",
    aliases: ["single sign-on", "single sign on"],
  },
  {
    slug: "graphql",
    term_en: "GraphQL",
    term_km: "",
    definition_en:
      "A query language for APIs that lets clients ask for exactly the fields they need in one request.",
    definition_km: "",
    analogy:
      "Like ordering à la carte instead of fixed set menus — you pick only the dishes you want.",
    story_count: 0,
    category: "infra",
    aliases: [],
  },
  {
    slug: "sql",
    term_en: "SQL",
    term_km: "",
    definition_en:
      "Structured Query Language — the standard language for talking to relational databases.",
    definition_km: "",
    analogy:
      "Like a precise order form for filing cabinets — ask for rows that match rules, get them back sorted.",
    story_count: 0,
    category: "infra",
    aliases: ["Structured Query Language"],
  },
  {
    slug: "kafka",
    term_en: "Kafka",
    term_km: "",
    definition_en:
      "A popular open-source system for streaming events between services at high volume (Apache Kafka).",
    definition_km: "",
    analogy:
      "Like a industrial conveyor belt for messages — many producers drop packages, many consumers pick them up.",
    story_count: 0,
    category: "infra",
    aliases: ["Apache Kafka"],
  },
  {
    slug: "sla",
    term_en: "SLA",
    term_km: "",
    definition_en:
      "Service Level Agreement — a contract promising uptime, response times, or other reliability targets.",
    definition_km: "",
    analogy:
      "Like a delivery promise: “99.9% on-time or you get a refund.”",
    story_count: 0,
    category: "infra",
    aliases: ["service level agreement", "SLAs"],
  },

  // —— Climate / hardware future ——
  {
    slug: "climate-tech",
    term_en: "Climate tech",
    term_km: "",
    definition_en:
      "Technology aimed at cutting emissions, adapting to climate change, or measuring environmental impact.",
    definition_km: "",
    analogy:
      "Like inventing better umbrellas, drains, and clean engines for a stormier world.",
    story_count: 0,
    category: "business",
    aliases: ["climatetech", "climate technology"],
  },
  {
    slug: "esg",
    term_en: "ESG",
    term_km: "",
    definition_en:
      "Environmental, Social, and Governance — a framework investors use to score how companies handle sustainability and ethics.",
    definition_km: "",
    analogy:
      "Like a report card beyond profits — pollution, workers, and board behavior also get graded.",
    story_count: 0,
    category: "business",
    aliases: ["ESG investing", "ESG score"],
  },
  {
    slug: "ev",
    term_en: "EV",
    term_km: "",
    definition_en:
      "Electric vehicle — cars, bikes, or buses powered mainly by batteries instead of gasoline.",
    definition_km: "",
    analogy:
      "Like swapping the fuel tank for a giant rechargeable power bank on wheels.",
    story_count: 0,
    category: "infra",
    aliases: ["electric vehicle", "electric vehicles", "EVs"],
  },
  {
    slug: "autonomous-vehicle",
    term_en: "Autonomous vehicle",
    term_km: "",
    definition_en:
      "A vehicle that can drive with little or no human control using sensors and AI — often discussed in levels 0–5.",
    definition_km: "",
    analogy:
      "Like a taxi where the software holds the steering wheel — still supervised a lot of the time today.",
    story_count: 0,
    category: "infra",
    aliases: ["self-driving car", "self-driving cars", "robotaxi"],
  },
  {
    slug: "quantum-computing",
    term_en: "Quantum computing",
    term_km: "",
    definition_en:
      "Computing that uses quantum bits (qubits) to tackle certain problems classical computers struggle with — still early for most uses.",
    definition_km: "",
    analogy:
      "Like a weird calculator that can explore many paths at once — powerful for niche puzzles, not a laptop replacement yet.",
    story_count: 0,
    category: "ai",
    aliases: ["quantum computer", "quantum computers"],
  },
  {
    slug: "lidar",
    term_en: "LiDAR",
    term_km: "",
    definition_en:
      "A sensor that maps the world with laser pulses — common in self-driving stacks and 3D scanning.",
    definition_km: "",
    analogy:
      "Like a bat's echolocation, but with light instead of sound — bounce pulses, build a depth map.",
    story_count: 0,
    category: "infra",
    aliases: ["lidar sensor"],
  },
]

