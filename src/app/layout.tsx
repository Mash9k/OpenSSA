import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OpenSSA",
  description: "Cross-platform local-first system cleaner, storage analyzer, and resource monitor.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} ${inter.variable}`}>
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          try {
            var theme = localStorage.getItem('openssa-theme') || 'dark';
            var root = document.documentElement;
            var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            var effective = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
            root.setAttribute('data-theme', effective);
            if (effective === 'dark') root.classList.add('dark');
            else root.classList.remove('dark');
          } catch(e) {}
        })();
      ` }} />
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}