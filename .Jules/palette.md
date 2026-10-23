# Palette's UX Journal

## 2025-05-18 - Accessibility in Custom Cyberpunk UI Components
**Learning:** Custom UI components in NeoNoir (such as styled HUD navigation bars and modal overlays like `ConfirmDialog`) rely heavily on visual styling without standard ARIA roles or labels. Icon-only buttons (notifications bell, mobile menu triggers) and modal overlays lack `aria-label`, `aria-expanded`, and `role="dialog"` modal descriptors, making them invisible or ambiguous to screen reader users.
**Action:** When adding or extending custom styled UI components in NeoNoir, ensure all icon-only buttons include descriptive `aria-label`s and `title` tooltips, toggle buttons state `aria-expanded`, and custom modals declare `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-describedby`.
