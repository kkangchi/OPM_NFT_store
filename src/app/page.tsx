// src/app/page.tsx
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ProductCard, { type Product } from '@/components/ProductCard';
import {
  claimToken,
  getCurrentWalletAddress,
  getTokenBalance,
  getTokenSymbol,
  hasClaimed,
} from '@/lib/contract';

function HomeContent() {
  const params = useSearchParams();

  const rawQuery = (params.get('q') ?? '').toLowerCase().trim();
  const normalizedQuery = rawQuery.replace(/\s+/g, '');

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  /* =========================
     ERC-20 토큰 상태
     ========================= */
  const [wallet, setWallet] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [tokenSymbol, setTokenSymbol] = useState<string>('TOKEN');
  const [claimed, setClaimed] = useState<boolean>(false);
  const [claiming, setClaiming] = useState<boolean>(false);

  /* =========================
     NFT 목록 로딩
     ========================= */
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/listings');
        const data = await res.json();
        setItems(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* =========================
     지갑 + 토큰 정보 로딩
     ========================= */
  useEffect(() => {
    async function loadTokenInfo() {
      try {
        const addr = await getCurrentWalletAddress();
        setWallet(addr);

        const [bal, sym, isClaimed] = await Promise.all([
          getTokenBalance(addr),
          getTokenSymbol(),
          hasClaimed(addr),
        ]);

        setTokenBalance(bal);
        setTokenSymbol(sym);
        setClaimed(isClaimed);
      } catch {
        // 지갑 미연결 상태면 조용히 무시
      }
    }

    loadTokenInfo();
  }, []);

  /* =========================
     토큰 받기
     ========================= */
  const handleClaim = async () => {
    try {
      setClaiming(true);
      await claimToken();

      if (wallet) {
        const bal = await getTokenBalance(wallet);
        setTokenBalance(bal);
        setClaimed(true);
      }

      alert('토큰을 성공적으로 받았습니다!');
    } catch (err: any) {
      alert(err?.message ?? '토큰 받기 실패');
    } finally {
      setClaiming(false);
    }
  };

  /* =========================
     검색 필터
     ========================= */
  const filtered = useMemo(() => {
    if (!normalizedQuery) return items;

    return items.filter((p) => {
      const name = (p.name ?? '').toLowerCase();
      const hitOriginal = name.includes(rawQuery);
      const normalizedName = name.replace(/\s+/g, '');
      const hitNoSpace = normalizedName.includes(normalizedQuery);
      return hitOriginal || hitNoSpace;
    });
  }, [items, rawQuery, normalizedQuery]);

  const headerTitle = rawQuery ? '검색 결과' : '마켓 피드';
  const headerDesc = rawQuery
    ? `“${rawQuery}”에 대한 결과입니다.`
    : '등록된 NFT 목록을 확인하고, ERC-20 토큰으로 거래할 수 있습니다.';

  return (
    <section className="py-10">
      <div className="mx-auto max-w-[1200px] px-6">
        {/* =========================
            ERC-20 토큰 패널
           ========================= */}
        <div className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="font-semibold text-gray-900">내 토큰 잔액</p>
            <p className="mt-1 text-[var(--muted)]">
              {wallet ? `${tokenBalance} ${tokenSymbol}` : '지갑을 연결하세요'}
            </p>
          </div>

          <button
            onClick={handleClaim}
            disabled={!wallet || claimed || claiming}
            className="rounded-xl px-4 py-2 text-sm font-semibold border
              disabled:opacity-50
              bg-black text-white hover:bg-gray-900 transition"
          >
            {claimed ? '이미 받음' : claiming ? '요청 중...' : '토큰 받기'}
          </button>
        </div>

        {/* =========================
            섹션 헤더
           ========================= */}
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">
              {headerTitle}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{headerDesc}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-gray-900">
              {loading ? '—' : filtered.length}
            </span>
            <span className="text-sm text-[var(--muted)]">items</span>
          </div>
        </div>

        {/* =========================
            본문
           ========================= */}
        {loading ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
            불러오는 중...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
            검색 결과가 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((p) => (
              <ProductCard key={p.id} {...p} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center text-sm text-[var(--muted)]">
          로딩 중...
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
