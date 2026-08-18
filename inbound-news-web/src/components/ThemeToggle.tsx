"use client";

import { useEffect, useState, useRef, useCallback } from "react";

function SunIcon() {
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

function MoonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

/**
 * Apply the theme to the DOM, localStorage, and cookie.
 */
function applyTheme(next: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("theme", next);
  } catch {}
  try {
    document.cookie = `theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {}
}

/**
 * Calculate the maximum radius needed to cover the entire viewport from a
 * given origin point — i.e. the distance to the farthest corner.
 *
 * radius = √(max(x, w−x)² + max(y, h−y)²)
 */
function maxRadius(x: number, y: number): number {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

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

  const toggle = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const next = theme === "dark" ? "light" : "dark";

      // ── Determine click / button-center coordinates ──────────────
      let x: number;
      let y: number;

      if (e.clientX !== 0 || e.clientY !== 0) {
        // Real pointer click
        x = e.clientX;
        y = e.clientY;
      } else if (btnRef.current) {
        // Keyboard activation — use button center
        const rect = btnRef.current.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      } else {
        x = window.innerWidth / 2;
        y = window.innerHeight / 2;
      }

      // ── Respect prefers-reduced-motion ───────────────────────────
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      // ── Check for View Transitions API support ──────────────────
      if (
        !prefersReducedMotion &&
        "startViewTransition" in document &&
        typeof (document as Document & { startViewTransition: (cb: () => void) => ViewTransition }).startViewTransition === "function"
      ) {
        const radius = maxRadius(x, y);

        // Communicate the origin to CSS via custom properties on :root
        // so the keyframe can read them (CSS custom properties on
        // ::view-transition-new cannot be set via JS directly).
        document.documentElement.style.setProperty("--vt-x", `${x}px`);
        document.documentElement.style.setProperty("--vt-y", `${y}px`);
        document.documentElement.style.setProperty(
          "--vt-radius",
          `${radius}px`,
        );

        const transition = (document as Document & { startViewTransition: (cb: () => void) => ViewTransition }).startViewTransition(() => {
          setTheme(next);
          applyTheme(next);
        });

        // Animate the incoming snapshot with an expanding circle
        transition.ready.then(() => {
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${radius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 500,
              easing: "cubic-bezier(0.4, 0, 0.2, 1)",
              pseudoElement: "::view-transition-new(root)",
            },
          );
        });
      } else {
        // Fallback — instant toggle (no animation)
        setTheme(next);
        applyTheme(next);
      }
    },
    [theme],
  );

  return (
    <button
      ref={btnRef}
      className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
      onClick={toggle}
      aria-label={
        mounted
          ? `Switch to ${theme === "dark" ? "light" : "dark"} mode`
          : "Toggle theme"
      }
    >
      {mounted ? (theme === "dark" ? <MoonIcon /> : <SunIcon />) : <SunIcon />}
    </button>
  );
}
