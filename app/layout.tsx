import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { Navbar } from '@/components/layout/Navbar';
import AddToHomePrompt from '@/components/pwa/AddToHomePrompt';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${inter.className} bg-gray-50`} suppressHydrationWarning>
        <AuthProvider>
          <Navbar />
          <main className="min-h-screen pb-28 pt-14 md:pb-0 md:pt-16">
            {children}
          </main>
          <AddToHomePrompt />
        </AuthProvider>
      </body>
    </html>
  );
}
