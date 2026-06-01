import type { ReactNode } from "react";

export const metadata = {
  title: "POS Kasir Backend",
  description: "Next.js API backend for POS Kasir",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
