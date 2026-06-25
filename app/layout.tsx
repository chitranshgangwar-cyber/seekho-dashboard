import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Seekho · Creative Intelligence",
  description: "Performance-creative analytics",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
