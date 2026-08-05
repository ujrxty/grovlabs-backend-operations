"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Subtle animated gradient mesh background.
 * Uses CSS animations (no JS animation loop) for performance.
 * Respects prefers-reduced-motion.
 */
export default function GradientMesh() {
  const [allowMotion, setAllowMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setAllowMotion(!mq.matches);
    const handler = (e: MediaQueryListEvent) => setAllowMotion(!e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {/* Base gradient layer */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 15% 20%, rgba(166, 90, 46, 0.18) 0%, transparent 50%),
            radial-gradient(ellipse 60% 80% at 85% 75%, rgba(166, 90, 46, 0.12) 0%, transparent 50%),
            radial-gradient(ellipse 70% 50% at 50% 50%, rgba(202, 191, 178, 0.25) 0%, transparent 60%)
          `,
        }}
      />

      {/* Animated orbs - only animate if motion allowed */}
      <div
        className="absolute h-[700px] w-[700px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(166, 90, 46, 0.2) 0%, transparent 60%)",
          top: "-20%",
          left: "-10%",
          filter: "blur(80px)",
          animation: allowMotion ? "mesh-drift-1 25s ease-in-out infinite" : "none",
        }}
      />
      <div
        className="absolute h-[600px] w-[600px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(202, 191, 178, 0.3) 0%, transparent 60%)",
          bottom: "-20%",
          right: "-10%",
          filter: "blur(100px)",
          animation: allowMotion ? "mesh-drift-2 30s ease-in-out infinite" : "none",
        }}
      />
      <div
        className="absolute h-[500px] w-[500px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(166, 90, 46, 0.15) 0%, transparent 60%)",
          top: "30%",
          right: "15%",
          filter: "blur(60px)",
          animation: allowMotion ? "mesh-drift-3 20s ease-in-out infinite" : "none",
        }}
      />

      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
