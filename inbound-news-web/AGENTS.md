<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## UI & Frontend Engineering Rules

### 1. Scroll Direction & Auto-Hide Headers ("Headroom" Pattern)
- **Never compare single-frame scroll deltas against a threshold while resetting the reference point every frame**. Trackpad and momentum scrolling emit 1–3px deltas per frame and will fail single-frame threshold checks.
- **Always use pivot-based directional tracking**:
  - Track `isScrollingDown` and `pivotScrollY` (the scroll position where the user turned).
  - When direction reverses (`delta > 0` vs `delta < 0`), set `pivotScrollY = prevScrollY`.
  - Trigger hide when `(scrollY - pivotScrollY) > threshold` (e.g. >10px) and trigger reveal when `(scrollY - pivotScrollY) < -threshold` (e.g. <-8px).
  - Always enforce top-of-page visibility (`scrollY <= topOffset`).

### 2. Tailwind CSS v4 Class Safety
- Avoid relying on dynamic string template interpolations for critical layout/animation classes (e.g., `isHeaderVisible ? "md:translate-y-0" : "md:-translate-y-full"`), as Turbopack/PostCSS may not extract them.
- For essential layout animations and transitions (e.g., sticky headers, drawers, modal transforms), define explicit CSS rules in `globals.css` with `will-change: transform`.

### 3. Verification Rigor
- Do not equate `npm run build` or `npm run lint` passing with UI behavioral correctness.
- When implementing event-driven interactions (scroll, resize, gesture):
  - Verify that the required animation/transform rules exist in the compiled CSS bundle.
  - Test or simulate state transitions with micro-step inputs across all target screen sizes.

