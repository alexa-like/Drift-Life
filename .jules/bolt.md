## 2025-05-18 - Chat Component Memoization and Pure Render Invariants
**Learning:** In high-frequency render paths like chat feeds (`ChatPage.tsx`, `MentionText.tsx`), regex tokenization and Set creation on every render pass cause measurable main-thread lag. However, side effects like CSS injection must remain strictly inside `useEffect` to avoid SSR/purity violations.
**Action:** Always memoize item components (`MessageBubble`, `MentionText`) and action handlers (`useCallback`) in list streams, while keeping side effects inside React lifecycle hooks.
