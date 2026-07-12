"use client";

import { useSyncExternalStore } from "react";

const THEME_STORAGE_KEY = "cookin-the-books-theme";

type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new Event("cookin-theme-change"));
}

export function ThemeSetting() {
  const theme = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("cookin-theme-change", onStoreChange);
      window.addEventListener("storage", onStoreChange);
      return () => {
        window.removeEventListener("cookin-theme-change", onStoreChange);
        window.removeEventListener("storage", onStoreChange);
      };
    },
    () => document.documentElement.dataset.theme === "light" ? "light" : "dark",
    () => "dark",
  );

  function selectTheme(nextTheme: Theme) {
    applyTheme(nextTheme);
  }

  return (
    <section className="surface rounded-2xl p-5 sm:p-6">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Appearance
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">Theme</h2>
        <p className="mt-1 text-sm text-muted">
          Choose how Cookin&apos; the Books looks on this browser.
        </p>
      </div>

      <div className="mt-5 grid max-w-xl gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Theme">
        <button
          aria-checked={theme === "dark"}
          className={`theme-choice ${theme === "dark" ? "theme-choice-active" : ""}`}
          onClick={() => selectTheme("dark")}
          role="radio"
          type="button"
        >
          <span className="theme-preview theme-preview-dark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>Dark</strong>
            <small>Deep green and mint</small>
          </span>
          <span className="theme-choice-check" aria-hidden="true">✓</span>
        </button>

        <button
          aria-checked={theme === "light"}
          className={`theme-choice ${theme === "light" ? "theme-choice-active" : ""}`}
          onClick={() => selectTheme("light")}
          role="radio"
          type="button"
        >
          <span className="theme-preview theme-preview-light" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>Light</strong>
            <small>White, blue, and ink</small>
          </span>
          <span className="theme-choice-check" aria-hidden="true">✓</span>
        </button>
      </div>
    </section>
  );
}
