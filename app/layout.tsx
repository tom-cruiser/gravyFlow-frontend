import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/toast/ToastProvider';
import './globals.css';

// Inter is a variable font; loading it here self-hosts it at build time and
// exposes it as a CSS variable consumed by globals.css and Tailwind's font-sans.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GravyFlow',
  description: 'GravyFlow dashboard canvas',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
