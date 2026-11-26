// Single source of truth for UI animation timing. framer-motion reads MOTION directly; the CSS in
// app/motion.css reads the same values as CSS variables (motionCssVars is injected by app/layout.js).
// Only transform and opacity are animated, and prefers-reduced-motion switches everything off
// (globals.css + <MotionConfig reducedMotion="user"> in the toast provider). No React imports here, so the
// server layout can import it; the change-highlight hook lives in lib/useChangedRows.js.
export const MOTION = {
  fast: 180, // ms – hover / press feedback, table rows
  base: 220, // ms – cards, modal panel
  slow: 250, // ms – page / route transition
  stagger: 40, // ms between siblings
  maxStagger: 12, // later items do not wait any longer
  flash: 1200, // ms – highlight on a changed record
  liftPx: -2, // hover lift
  pressScale: 0.97, // press feedback
  ease: [0.22, 1, 0.36, 1], // ease-out (framer-motion)
};

export const MOTION_EASE_CSS = `cubic-bezier(${MOTION.ease.join(", ")})`;

export const motionCssVars = `:root{--motion-fast:${MOTION.fast}ms;--motion-base:${MOTION.base}ms;--motion-slow:${MOTION.slow}ms;` +
  `--motion-stagger:${MOTION.stagger}ms;--motion-flash:${MOTION.flash}ms;--motion-lift:${MOTION.liftPx}px;` +
  `--motion-press:${MOTION.pressScale};--motion-ease:${MOTION_EASE_CSS};}`;

/** framer-motion transition presets built from MOTION. */
export const transitions = {
  fast: { duration: MOTION.fast / 1000, ease: MOTION.ease },
  base: { duration: MOTION.base / 1000, ease: MOTION.ease },
};

/** Style for the i-th staggered row (`motion-row` class): delay = min(i, maxStagger) × stagger. */
export const staggerStyle = (i) => ({ "--i": Math.min(i, MOTION.maxStagger) });
