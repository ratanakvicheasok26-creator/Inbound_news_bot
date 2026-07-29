"use client";

import { useEffect, useState } from "react";

interface ThemeToggleProps {
  variant?: "default" | "header";
}

export function ThemeToggle({ variant = "default" }: ThemeToggleProps) {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light";
    const v = document.documentElement.getAttribute("data-theme");
    return v === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const v = document.documentElement.getAttribute("data-theme");
      if (v === "dark" || v === "light") setTheme(v);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

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

  if (variant === "header") {
    return (
      <button
        className="flex items-center justify-center w-[34px] h-[30px] border border-[var(--text-primary)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-inverted transition-colors"
        onClick={toggle}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme">
      {theme === "dark" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
