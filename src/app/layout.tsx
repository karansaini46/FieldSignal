import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";

// ponytail: Robust system-backed typography stack; eliminates build failure risk from remote Google Fonts CDN outages in air-gapped/CI/CD production pipelines.
export const metadata: Metadata = {
  title: "FieldSignal — Solar Plant O&M Maintenance Intelligence",
  description:
    "Voice-first fault reporting and equipment intelligence platform for solar plant O&M teams in Hindi, Hinglish, and English.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={cn(
          "h-full bg-neutral-50 font-sans text-neutral-900 antialiased"
        )}
      >
        {children}
      </body>
    </html>
  );
}
