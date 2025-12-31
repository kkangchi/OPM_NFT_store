import type { Metadata } from 'next';
import './globals.css';
import { Suspense } from 'react';
import Header from '@/components/Header';
import AuthProvider from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'OPM Store',
  description: 'OPM 개인 마켓 플레이스',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="bg-[#f4f2ff]">
      <body className="bg-[#f4f2ff] text-[#1a1a1a] min-h-screen">
        <AuthProvider>
          {/* 🔥 useSearchParams를 쓰는 Header를 Suspense로 감싸줌 */}
          <Suspense fallback={null}>
            <Header />
          </Suspense>

          <main className="mx-auto max-w-[1100px] px-4 py-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
