import type { Metadata } from "next";

import { ThemeFavicon } from "@/components/theme-favicon";
import { APP_BASE_PATH } from "@/lib/config";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Cookin' the Books",
    template: "%s | Cookin' the Books",
  },
  description: "A secure dashboard for personal financial tools.",
  // A private dashboard (and its public demo) has nothing for search engines.
  robots: { index: false, follow: false },
};

const themeScript = `(()=>{try{const t=localStorage.getItem("cookin-the-books-theme");const v=t==="light"?"light":"dark";document.documentElement.dataset.theme=v;document.documentElement.style.colorScheme=v}catch{document.documentElement.dataset.theme="dark"}})()`;
const faviconScript = `(()=>{try{const v=document.documentElement.dataset.theme==="light"?"light":"dark";const h="${APP_BASE_PATH}/favicon-"+v+".svg";let l=document.querySelector('link[rel="icon"][data-theme-favicon="true"]');if(!l){l=document.createElement("link");l.rel="icon";l.type="image/svg+xml";l.dataset.themeFavicon="true";document.head.appendChild(l)}l.href=h}catch{}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <head>
        <link
          data-theme-favicon="true"
          href={`${APP_BASE_PATH}/favicon-dark.svg`}
          rel="icon"
          type="image/svg+xml"
        />
        <link
          href={`${APP_BASE_PATH}/apple-icon.png`}
          rel="apple-touch-icon"
          sizes="180x180"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: faviconScript }} />
      </head>
      <body className="min-h-full">
        <ThemeFavicon />
        {children}
      </body>
    </html>
  );
}
