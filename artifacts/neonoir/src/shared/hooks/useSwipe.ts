import { useRef, useCallback, useEffect } from "react";

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

/**
 * Detects horizontal swipe gestures on touch devices.
 * Returns event handlers to attach to a container element.
 *
 * Callbacks are captured via refs so the returned handlers are always stable —
 * no re-registration is needed if the callback closes over changing state.
 *
 * @param onSwipeLeft  Called when user swipes left (next item)
 * @param onSwipeRight Called when user swipes right (prev item)
 * @param threshold    Minimum horizontal distance in px to count as a swipe (default 50)
 */
export function useSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold = 50,
): SwipeHandlers {
  // Keep callbacks in refs so the touch handlers don't need to recreate on every render
  const leftRef = useRef(onSwipeLeft);
  const rightRef = useRef(onSwipeRight);
  useEffect(() => { leftRef.current = onSwipeLeft; }, [onSwipeLeft]);
  useEffect(() => { rightRef.current = onSwipeRight; }, [onSwipeRight]);

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (startX.current === null || startY.current === null) return;
      const dx = e.changedTouches[0].clientX - startX.current;
      const dy = e.changedTouches[0].clientY - startY.current;
      // Only fire if horizontal motion dominates (avoids scroll conflicts)
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= threshold) {
        if (dx < 0) leftRef.current();
        else rightRef.current();
      }
      startX.current = null;
      startY.current = null;
    },
    [threshold],
  );

  return { onTouchStart, onTouchEnd };
}
