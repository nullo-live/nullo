import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/config/brand";
import { JsonLd } from "@/components/JsonLd";
import { ChainProvider } from "@/components/providers/ChainProvider";
import { Motion } from "@/components/site/Motion";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { WalletModalProvider } from "@/components/wallet/WalletButton";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { HOME_DESCRIPTION, HOME_TITLE, siteLd } from "@/lib/seo";

// Nunito Sans for everything (the layout reference's family), JetBrains Mono for addresses and call data.
const nunito = Nunito_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-nunito", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-face", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: { default: HOME_TITLE, template: `%s | ${BRAND.name}` },
  description: HOME_DESCRIPTION,
  applicationName: BRAND.name,
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: BRAND.url, siteName: BRAND.name, title: HOME_TITLE, description: HOME_DESCRIPTION, locale: "en_US" },
  twitter: { card: "summary_large_image", site: BRAND.xHandle, creator: BRAND.xHandle, title: HOME_TITLE, description: HOME_DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#697733", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${nunito.variable} ${mono.variable} no-js`}>
      <head>
        <JsonLd data={siteLd} />
      </head>
      <body>
        <WalletProvider>
          <WalletModalProvider>
            <ChainProvider>
              <SiteHeader />
              {children}
              <SiteFooter />
            </ChainProvider>
          </WalletModalProvider>
        </WalletProvider>
        <Motion />
      </body>
    </html>
  );
}
