import type { Metadata } from 'next';
import { ask } from '@/ask/config';

export const metadata: Metadata = {
  title: ask.meta.title,
  description: ask.meta.description,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
