import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scene It",
  description: "Interactive 3D Gaussian Splat scene viewer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="default">
      <head>
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`} />
            <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');` }} />
          </>
        )}
        {/* Theme fonts — loaded eagerly so theme switching is instant */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Share+Tech+Mono&family=Orbitron:wght@400;500;700&family=VT323&family=Space+Mono:wght@400;700&family=Silkscreen:wght@400;700&family=Pixelify+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Syne:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700&family=Bricolage+Grotesque:wght@400;500;600;700;800&family=Archivo+Black&family=Bebas+Neue&family=Azeret+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans bg-surface-base text-content-primary antialiased">
        {children}
      </body>
    </html>
  );
}
