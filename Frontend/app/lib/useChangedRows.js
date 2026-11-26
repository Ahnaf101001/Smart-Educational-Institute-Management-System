"use client";

import { useEffect, useRef, useState } from "react";
import { MOTION } from "./motion";

/**
 * Keys of rows whose content changed since the previous data set (new or edited records), cleared after
 * the flash animation. The first data set never flashes.
 */
export function useChangedRows(rows, rowKey = "id") {
  const previous = useRef(null);
  const [changed, setChanged] = useState(() => new Set());
  useEffect(() => {
    const next = new Map((rows || []).map((r, i) => [String(r?.[rowKey] ?? i), JSON.stringify(r)]));
    const before = previous.current;
    previous.current = next;
    if (!before) return undefined;
    const keys = new Set([...next].filter(([k, v]) => before.get(k) !== v).map(([k]) => k));
    if (!keys.size) return undefined;
    setChanged(keys);
    const t = setTimeout(() => setChanged(new Set()), MOTION.flash);
    return () => clearTimeout(t);
  }, [rows, rowKey]);
  return changed;
}
