"use client";

import { useEffect, useState } from "react";

type Toast = { id: number; message: string; kind: "ok" | "err" };
type Listener = (t: Toast) => void;

let listeners: Listener[] = [];
let counter = 0;

export function toast(message: string, kind: "ok" | "err" = "ok") {
  const t = { id: ++counter, message, kind };
  listeners.forEach((l) => l(t));
}

export default function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const l: Listener = (t) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 4000);
    };
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);

  return (
    <>
      {items.map((t, i) => (
        <div key={t.id} className={`toast ${t.kind}`} style={{ bottom: 20 + i * 56 }}>
          {t.message}
        </div>
      ))}
    </>
  );
}
