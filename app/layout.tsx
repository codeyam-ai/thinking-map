import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Thinking Map',
  description:
    'An AI thinking partner that deconstructs a vague idea, explores the problem space with you, and turns your thinking into a visual map and an actionable plan.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
