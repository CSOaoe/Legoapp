import type { Metadata } from "next";
import "./globals.css";
import "./viewer.css";
import "./resolver.css";
import "./assembly.css";
import "./reconstruction.css";
import "./studio.css";

export const metadata: Metadata = {
  title: "BrickForge Studio — Images and 3D Models to Bricks",
  description: "Turn images, OBJ, or STL files into editable brick models with validated structures, parts lists, and ordered build instructions.",
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
