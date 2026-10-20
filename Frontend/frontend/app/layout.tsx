import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { getDocuments, getQuotations, getRecentActivity, getShipments } from "@/lib/data";
import { SessionStoreProvider } from "@/lib/data/session-store";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Freight Management",
    template: "%s · Freight Management",
  },
  description:
    "Operations system for freight forwarding and clearing: shipments, documents, customs, invoicing and payments.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Seed the in-browser session store; edits made in the UI live there only.
  const [shipments, quotations, activity, documents] = await Promise.all([
    getShipments(),
    getQuotations(),
    getRecentActivity(),
    getDocuments(),
  ]);
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <SessionStoreProvider
          initialShipments={shipments.data}
          initialQuotations={quotations.data}
          initialActivity={activity.data}
          initialDocuments={documents.data}
        >
          <AppShell>{children}</AppShell>
        </SessionStoreProvider>
      </body>
    </html>
  );
}
