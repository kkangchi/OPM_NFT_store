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
      const res = await fetch('/api/listings');
      const data = await res.json();
      console.log('listings from api:', data);
      setItems(data);
      setLoading(false);
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

  return (
    <section className="py-10">
      <div className="max-w-[1100px] mx-auto px-4">
        {loading ? (
          <p className="text-gray-500">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500">검색 결과가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
            {filtered.map((p) => (
              <ProductCard key={p.id} {...p} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
