import type { Metadata } from "next";
import { Geist, Geist_Mono, Yarndings_20 } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProgressProvider } from "@/contexts/ProgressContext";
import MigrationPrompt from "@/components/MigrationPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const yarndings20 = Yarndings_20({
  subsets: ["latin"],
  weight: "400",
});

const siteTitle = "b's art studies";
const siteDescription = "Art-study flashcards for memorizing works, artists, and stories.";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "public/thewindrises.gif",
        width: 1200,
        height: 630,
        alt: siteTitle,
      },
    ],
    siteName: siteTitle,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <ProgressProvider>
            <Navbar brandName={siteTitle} />
            <main>{children}</main>
            <MigrationPrompt />
          </ProgressProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
