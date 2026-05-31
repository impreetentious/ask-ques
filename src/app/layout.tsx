import type { Metadata } from 'next';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/instrument-sans';
import './globals.css';
import { ask } from '@/ask/config';

export const metadata: Metadata = {
  title: ask.meta.title,
  description: ask.meta.description,
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
