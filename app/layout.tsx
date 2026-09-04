import type { Metadata } from "next";
import "./globals.css";
import "./viewer.css";
import "./resolver.css";
import "./assembly.css";
import "./reconstruction.css";

export const metadata: Metadata = {
  title: "BrickForge AI — Photo to Brick",
  description: "Turn multi-view photographs into editable brick studies, parts lists, and build steps.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
