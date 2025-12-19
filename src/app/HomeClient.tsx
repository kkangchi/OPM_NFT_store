'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ProductCard, { type Product } from '@/components/ProductCard';

export default function HomeClient() {
  const params = useSearchParams();

  // 원래 쿼리(소문자 + trim)
  const rawQuery = (params.get('q') ?? '').toLowerCase().trim();
  // 공백 제거 버전 (띄어쓰기 무시 검색용)
  const normalizedQuery = rawQuery.replace(/\s+/g, '');

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/listings');
        const data = await res.json();
        console.log('listings from api:', data);
        setItems(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!normalizedQuery) return items;

    return items.filter((p) => {
      const name = (p.name ?? '').toLowerCase();

      // 1) 원본 이름에서 공백 포함 검색
      const hitOriginal = name.includes(rawQuery);

      // 2) 공백 제거 후 검색 (위닝 글러브 vs 위닝글러브)
      const normalizedName = name.replace(/\s+/g, '');
      const hitNoSpace = normalizedName.includes(normalizedQuery);

      return hitOriginal || hitNoSpace;
    });
  }, [items, rawQuery, normalizedQuery]);

  const headerTitle = rawQuery ? '검색 결과' : '마켓 피드';
  const headerDesc = rawQuery
    ? `“${rawQuery}”에 대한 결과입니다.`
    : '등록된 NFT 목록을 확인하고 상세 페이지에서 거래를 진행할 수 있습니다.';

  return (
    <section className="py-10">
      <div className="mx-auto max-w-[1200px] px-6">
        {/* 섹션 헤더: 과제용/시스템 느낌 */}
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

        {/* 본문 */}
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
