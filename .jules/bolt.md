# Bolt's Performance Journal

## 2025-02-18 - Memoize primitive UI components like StatBar
**Learning:** Pure UI components in `shared/components/` that accept primitive props (such as `label`, `value`, `max`, `color`) are rendered heavily in parent views/dashboards and re-render needlessly when unrelated state in parent views update.
**Action:** Wrap primitive-prop shared UI components in `React.memo` to eliminate redundant render cycles during parent state updates.
