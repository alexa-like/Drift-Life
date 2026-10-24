## 2025-05-18 - Avoid `toLocaleString()` in Hot Render Paths and Animation Loops

**Learning:** `Number.prototype.toLocaleString()` invokes JavaScript's `Intl` subsystem, which is orders of magnitude slower than native string conversion (`.toString()`). When called in hot paths such as currency formatters (`formatDC`) or inside high-frequency animation loops (`requestAnimationFrame` in `StatCounter`), `toLocaleString()` causes noticeable CPU overhead and main-thread layout/render lag. Furthermore, regex operations like `.replace(/\.0$/, "")` allocated overhead on every format call.

**Action:** For numbers under 1000, fast-path using `Math.round(abs).toString()`. For decimal string truncation, prefer direct `.endsWith()` string slicing over regular expressions in hot formatting functions.
