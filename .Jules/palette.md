## 2025-05-18 - Modal Dialog Accessibility and Keyboard Controls
**Learning:** Custom modal confirmation overlays created with basic `<div>` wrappers lack essential accessibility features: screen readers do not announce them as modal dialogs, and keyboard users cannot dismiss them via the `Escape` key or navigate buttons with clear focus rings.
**Action:** Always ensure modal components include `role="dialog"`, `aria-modal="true"`, proper `aria-labelledby`/`aria-describedby` links, keydown handlers for `Escape`, and `focus-visible` styling on interactive action buttons.
