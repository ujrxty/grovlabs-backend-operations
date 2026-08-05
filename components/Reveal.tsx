"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Adds a small fade-and-lift as a block scrolls in.
 *
 * Fails open: if IntersectionObserver is unavailable or JS never runs, the
 * class is simply never added and the CSS keeps the block visible. Nothing
 * here can hide content permanently.
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article" | "tr";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!("IntersectionObserver" in window)) {
      el.classList.add("is-visible");
      return;
    }

    el.classList.add("reveal");

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.transitionDelay = `${delay}s`;
          el.classList.add("is-visible");
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -5% 0px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  // @ts-expect-error — ref type varies with the chosen tag
  return <Tag ref={ref} className={className}>{children}</Tag>;
}
