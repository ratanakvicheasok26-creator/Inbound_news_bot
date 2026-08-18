"use client";

import { useEffect, useState } from "react";

function ThemeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [, setMounted] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- read DOM theme after mount to avoid hydration mismatch */
  useEffect(() => {
    setMounted(true);
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "dark" || current === "light") setTheme(current);

    const observer = new MutationObserver(() => {
      const next = document.documentElement.getAttribute("data-theme");
      if (next === "dark" || next === "light") setTheme(next);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
    try {
      document.cookie = `theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}
  }

  return (
    <button
      className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
      onClick={toggle}
      aria-label="Toggle theme"
    >
      <ThemeIcon />
    </button>
  );
}
