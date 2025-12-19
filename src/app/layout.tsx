import type { Metadata } from 'next';
import './globals.css';
import { Suspense } from 'react';
import Header from '@/components/Header';
import AuthProvider from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'Token-Based NFT Marketplace',
  description: 'ERC-20 토큰 기반 NFT 거래 마켓플레이스 (기말고사 과제)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <AuthProvider>
          {/* useSearchParams 사용 Header 보호 */}
          <Suspense fallback={null}>
            <Header />
          </Suspense>

          <main className="mx-auto max-w-[1200px] px-6 py-10">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
