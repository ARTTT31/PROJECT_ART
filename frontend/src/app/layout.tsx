import type { Metadata } from 'next';
import { Anuphan } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const anuphan = Anuphan({
  weight: ['200', '300', '400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ART Workspace',
  description: 'Modern workspace management system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
        />
      </head>
      <body className={anuphan.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
