## 2025-05-20 - Icon-only Buttons in Navigation Drawers
**Learning:** Mobile overlay drawer components in the app often use icon-only close buttons (like `<X />`) without explicit `aria-label` attributes, making them inaccessible to screen readers.
**Action:** Always inspect custom mobile overlays and drawer header buttons to ensure screen reader labels (`aria-label`) are present.
