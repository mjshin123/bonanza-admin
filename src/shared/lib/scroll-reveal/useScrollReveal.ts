import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  threshold = 0.2,
) {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setRevealed(true);
        observer.disconnect();
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, revealed };
}

export function revealStyle(revealed: boolean, delayMs = 0): CSSProperties {
  return {
    opacity: revealed ? 1 : 0,
    transform: revealed ? "translateY(0)" : "translateY(12px)",
    transition: `opacity var(--dur-base) var(--ease) ${delayMs}ms, transform var(--dur-base) var(--ease) ${delayMs}ms`,
  };
}

const REVEAL_STAGGER_MS = 140;
const REVEAL_MAX_DELAY_MS = 1000;

export function getRevealDelay(
  index: number,
  stagger = REVEAL_STAGGER_MS,
  max = REVEAL_MAX_DELAY_MS,
): number {
  return Math.min(index * stagger, max);
}
