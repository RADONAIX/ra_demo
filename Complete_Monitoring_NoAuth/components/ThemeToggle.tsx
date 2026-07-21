"use client";

import { useEffect, useState } from "react";
import AppIcon from "./AppIcon";

type Theme = "dark" | "light";

function apply(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("theme", theme);
  } catch {
    /* ignore private-mode storage errors */
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  // Sync initial state with whatever the no-flash script already set on <html>.
  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as Theme) || "dark";
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
  }

  const isDark = theme === "dark";
  return (
    <button
      className="btn theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
    >
      <AppIcon name={isDark ? "sun" : "moon"} size={15} />
    </button>
  );
}
