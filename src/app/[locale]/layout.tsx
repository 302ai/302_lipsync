// import AppAuth from "@/components/global/app-auth";
import AppChat from "@/components/global/app-chat";
import AppClient from "@/components/global/app-client";
import AppFooter from "@/components/global/app-footer";
import AppHeader from "@/components/global/app-header";
import AppMessage from "@/components/global/app-message";
import AppTheme from "@/components/global/app-theme";
import AppTooltip from "@/components/global/app-tooltip";
import { SEO_DATA } from "@/constants";
import { languages } from "@/i18n/settings";
import { cn } from "@/lib/utils";
import "@/styles/globals.css";
import { getServerTheme } from "@/utils/theme";
import { dir } from "i18next";
import localFont from "next/font/local";
import { cookies, headers } from "next/headers";
import { Metadata, ResolvingMetadata } from "next/types";
import { ReactNode } from "react";

// Default font
const geistSans = localFont({
  src: "../fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "../fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// SEO metadata
export async function generateMetadata(
  props: { params: Promise<{ locale: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const params = await props.params;

  const { locale } = params;

  const headers_ = await headers();
  const hostname = headers_.get("host");

  const previousImages = (await parent).openGraph?.images || [];

  const defaultSEO = {
    title: "Default Title",
    description: "Default Description",
    image: "/default-image.jpg",
  };

  const info = SEO_DATA.languages || { [locale]: defaultSEO };

  const images = [info[locale].image || defaultSEO.image, ...previousImages];

  return {
    title: info[locale].title || defaultSEO.title,

    description: info[locale].description || defaultSEO.description,
    metadataBase: new URL(`https://${hostname}`),
    alternates: {
      canonical: `/${locale}`,
      languages: languages
        .filter((item) => item !== locale)
        .map((item) => ({
          [item]: `/${item}`,
        }))
        .reduce((acc, curr) => Object.assign(acc, curr), {}),
    },
    openGraph: {
      url: `/${locale}`,
      images,
    },
    twitter: {
      site: `https://${hostname}/${locale}`,
      images,
    },
  };
}

export default async function RootLayout({
  params: { locale },
  children,
}: {
  params: { locale: string };
  children: ReactNode;
}) {
  // Ensure theme is set on server side, to avoid hydration error
  const theme = getServerTheme(cookies);

  return (
    <html
      lang={locale}
      dir={dir(locale)}
      className={theme}
      style={{ colorScheme: theme }}
    >
      <body
        className={cn(
          `${geistSans.variable} ${geistMono.variable} antialiased`,
          "relative flex flex-col"
        )}
      >
        {/* Force theme to be set on client side, to avoid hydration error on first render */}
        <AppTheme theme={theme}>
          <AppClient>
            <AppTooltip>
              <AppHeader />
              <main className="z-0 flex grow">{children}</main>
              <AppFooter />
            </AppTooltip>
          </AppClient>
          <AppChat />
          <AppMessage />
          {/* <AppAuth /> */}
        </AppTheme>
      </body>
    </html>
  );
}
