import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import CotacaoWidget from "@/app/comissoes/cotacao-widget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sistema de Pagamentos | Ether Private Bank",
  description: "Gerenciamento de pagamentos e prestadores de serviço",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="sticky top-0 z-30 border-b border-border bg-card px-4 py-1.5 flex justify-end">
          <CotacaoWidget />
        </div>
        {children}
      </body>
    </html>
  );
}
