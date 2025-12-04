import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { WalletProviderWrapper } from "@/components/WalletProvider";

export const metadata: Metadata = {
  title: "SolEstate | Tokenized Real Estate on Solana",
  description: "Invest in premium real estate through fractional ownership powered by Solana blockchain. Own a piece of the world's finest properties.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col">
        <WalletProviderWrapper>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </WalletProviderWrapper>
      </body>
    </html>
  );
}
