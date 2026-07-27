"use client"

import { useState } from "react"
import Link from "next/link"
import { User, Bookmark, Eye, Settings, Shield } from "lucide-react"

const tabs = [
  { id: "saved", label: "Saved Stories", icon: Bookmark },
  { id: "topics", label: "Followed Topics", icon: Eye },
  { id: "concepts", label: "Followed Concepts", icon: Shield },
  { id: "settings", label: "Settings", icon: Settings },
]

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState("saved")

  return (
    <div className="container">
      <section className="py-10 max-w-[720px] mx-auto">
        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-8 pb-6 border-b-2 border-[var(--text-primary)]">
          <div className="w-12 h-12 bg-[var(--surface-alt)] border border-[var(--border)] flex items-center justify-center">
            <User className="h-6 w-6 text-[var(--text-secondary)]" />
          </div>
          <div>
            <h1 className="font-serif text-[22px] font-bold">Guest Reader</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                Literacy Score:
              </span>
              <span className="font-mono text-[12px] font-bold text-[var(--accent)] tabular-nums">
                0 / 100
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-[var(--border)] mb-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 font-mono text-[11px] uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "saved" && (
          <div className="empty-state py-12">
            <p className="font-serif text-[18px] mb-2">No saved stories</p>
            <p>Bookmark stories to read them later.</p>
          </div>
        )}

        {activeTab === "topics" && (
          <div>
            <p className="text-[13px] text-[var(--text-secondary)] mb-4">
              Follow topics to get notified about new stories.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {["AI & ML", "Cybersecurity", "Startups", "DeFi & Crypto", "Big Tech", "Hardware"].map((topic) => (
                <div key={topic} className="p-3 border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text-secondary)]">
                  {topic}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "concepts" && (
          <div>
            <p className="text-[13px] text-[var(--text-secondary)] mb-4">
              Follow concepts to track the technologies that matter to you.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {["Transformers", "RAG", "LLMs", "GPU", "Fine-tuning", "Blockchain"].map((concept) => (
                <div key={concept} className="p-3 border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text-secondary)]">
                  {concept}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-6">
            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-secondary)] block mb-2">
                Default Reading Tier
              </label>
              <div className="flex gap-2">
                {["ELI5", "Standard", "Deep"].map((tier) => (
                  <button
                    key={tier}
                    className={`px-4 py-2 font-mono text-[12px] uppercase tracking-wider border transition-colors ${
                      tier === "Standard"
                        ? "bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-secondary)] block mb-2">
                Default Language
              </label>
              <div className="flex gap-2">
                {["English", "ខ្មែរ"].map((lang) => (
                  <button
                    key={lang}
                    className={`px-4 py-2 font-mono text-[12px] uppercase tracking-wider border transition-colors ${
                      lang === "English"
                        ? "bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-[var(--border)]">
              <div>
                <span className="text-[14px] text-[var(--text-primary)] block">Stealth Mode</span>
                <span className="text-[12px] text-[var(--text-secondary)]">Disables reading history tracking</span>
              </div>
              <div className="w-10 h-5 bg-[var(--surface-alt)] border border-[var(--border)] rounded-full relative cursor-pointer">
                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-[var(--text-secondary)] rounded-full transition-transform" />
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
