import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/instrument-sans';
import './globals.css';
import { ask } from '@/ask/config';
import { themeFor } from '@/ask/themes';

export const metadata: Metadata = {
  title: ask.meta.title,
  description: ask.meta.description,
  robots: { index: true, follow: true },
};

/**
 * The defaults are restated because declaring this export replaces them. The
 * theme colour paints the browser chrome to match the page; a shared link that
 * opens on a phone should not arrive framed in white. A hash-borne theme
 * overwrites it on the client.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: themeFor(ask.theme).paper,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
