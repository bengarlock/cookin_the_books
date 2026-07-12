"use client";

import { useEffect } from "react";

import { APP_BASE_PATH } from "@/lib/config";

type Theme = "dark" | "light";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function faviconHref(theme: Theme) {
  return `${APP_BASE_PATH}/favicon-${theme}.svg`;
}

function setFavicon(theme: Theme) {
  const href = faviconHref(theme);
  let icon = document.querySelector<HTMLLinkElement>(
    'link[rel="icon"][data-theme-favicon="true"]',
  );

  if (!icon) {
    icon = document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/svg+xml";
    icon.dataset.themeFavicon = "true";
    document.head.appendChild(icon);
  }

  icon.href = href;
}

export function ThemeFavicon() {
  useEffect(() => {
    const update = () => setFavicon(currentTheme());

    update();
    window.addEventListener("cookin-theme-change", update);
    window.addEventListener("storage", update);

    return () => {
      window.removeEventListener("cookin-theme-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return null;
}
