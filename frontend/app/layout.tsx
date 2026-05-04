import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Genuinity Checker — Google Form Responses",
  description:
    "Score Google Form responses for genuinity using fast heuristics and Gemini AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // suppressHydrationWarning here silences false-positive hydration warnings
  // caused by browser extensions (e.g. Grammarly, Dark Reader, Cursor's IDE
  // browser) that mutate <html>/<body> attributes after the server-rendered
  // HTML arrives. Our own attributes don't differ between server and client.
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
