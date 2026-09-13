import React, { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

export function AnimatedCounter({ value = 0, prefix = "", suffix = "", className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const target = Number(value) || 0;
    const start = performance.now();
    const dur = 900;
    let raf;
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <span ref={ref} className={className}>
      {prefix}{display.toLocaleString()}{suffix}
    </span>
  );
}

export function ScoreRing({ score = 0, size = 120 }) {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color = score >= 75 ? "hsl(152 40% 40%)" : score >= 50 ? "hsl(38 68% 50%)" : "hsl(14 72% 53%)";
  return (
    <div className="relative" style={{ width: size, height: size }} data-testid="score-ring">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - pct) }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-black text-3xl tracking-tighter" style={{ color }}>{Math.round(score)}</span>
        <span className="overline text-muted-foreground text-[10px]">/ 100</span>
      </div>
    </div>
  );
}

export function PaceBadge({ pace }) {
  const map = {
    Relaxed: "bg-[hsl(152_34%_32%)/0.15] text-[hsl(152_40%_28%)]",
    Balanced: "bg-[hsl(38_68%_50%)/0.18] text-[hsl(30_70%_36%)]",
    Packed: "bg-primary/15 text-primary",
  };
  return (
    <span data-testid="pace-badge" className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${map[pace] || map.Balanced}`}>
      {pace}
    </span>
  );
}
