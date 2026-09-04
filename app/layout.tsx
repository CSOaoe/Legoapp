import type { Metadata } from "next";
import "./globals.css";
import "./viewer.css";
import "./resolver.css";
import "./assembly.css";

export const metadata: Metadata = {
  title: "BrickForge AI — Assembly Workspace",
  description: "Build, validate, and export real multi-part brick models.",
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
