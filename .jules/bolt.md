## 2025-05-18 - Prevented Unnecessary Re-renders in Streaming Chat Logs
**Learning:** In real-time socket application feeds (like chat logs), state updates appending new items cause parent component re-renders that propagate to all previous list elements unless items (`MessageBubble`) and tokenizers (`MentionText`) are memoized.
**Action:** Always wrap chat message components in `React.memo` and reuse static regex instances outside tokenization loops.
