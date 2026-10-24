import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Opportunity Radar | Live Indian College Student Opportunities",
  description:
    "Find currently open internships, hackathons, competitions, scholarships, fellowships and open-source programs matched to your student profile using live web data.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen antialiased bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors duration-200`}>
        {children}
      </body>
    </html>
  );
}
