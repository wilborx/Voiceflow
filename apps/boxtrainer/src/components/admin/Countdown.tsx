"use client";

import { useEffect, useState } from "react";
import { cx } from "../ui";

/** Restzeit bis zum Ablauf eines Holds, aktualisiert sich jede halbe Minute. */
export function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const ms = Date.parse(until) - now;
  if (ms <= 0) return <span className="font-semibold text-red-400">abgelaufen</span>;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return (
    <span className={cx("font-semibold tabular-nums", h < 3 ? "text-red-400" : h < 8 ? "text-amber-300" : "text-fg")}>
      noch {h} Std. {String(m).padStart(2, "0")} Min.
    </span>
  );
}
