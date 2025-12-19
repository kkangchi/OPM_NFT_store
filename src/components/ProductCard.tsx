'use client';

import type React from 'react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';

// Firestore
import { db } from '@/lib/firebase';
import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

export type Product = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  description?: string;
};

type Props = Product;

// 제목을 Firestore 문서 ID로 안전하게 변환하는 함수
function makeSafeId(title: string) {
  return title
    .trim()
    .replace(/\s+/g, '-') // 공백 → -
    .replace(/[^a-zA-Z0-9가-힣-_]/g, '') // 특수문자 제거
    .slice(0, 40); // 너무 길면 40자까지만
}

const ProductCard: React.FC<Props> = ({
  id,
  name,
  price,
  imageUrl,
  description,
}) => {
  const [liked, setLiked] = useState(false);

  const { user } = useAuth();
  const router = useRouter();

  const displayPrice = price > 0 ? `${price} ETH` : '가격 미정';

  // 제목 기반 문서 ID
  const docId = makeSafeId(name) || id;

  // 찜 여부 불러오기
  useEffect(() => {
    if (!user) return;

    const uid = user.uid;

    async function loadLiked() {
      const ref = doc(db, `users/${uid}/likes/${docId}`);
      const snap = await getDoc(ref);
      if (snap.exists()) setLiked(true);
    }

    loadLiked();
  }, [user, docId]);

  // 찜 버튼 클릭
  const onToggleLike: React.MouseEventHandler<HTMLButtonElement> = async (
    e
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push('/login');
      return;
    }

    const uid = user.uid;
    const ref = doc(db, `users/${uid}/likes/${docId}`);

    if (liked) {
      await deleteDoc(ref);
      setLiked(false);
      return;
    }

    await setDoc(ref, {
      listingId: id,
      title: name,
      createdAt: new Date(),
    });

    setLiked(true);
  };

  return (
    <Link
      href={`/listings/${id}`}
      className={[
        'group relative overflow-hidden rounded-2xl',
        'border border-[var(--border)] bg-white shadow-sm',
        'transition hover:shadow-[var(--shadow)]',
      ].join(' ')}
    >
      <div className="flex gap-4 p-4">
        {/* 썸네일: 세로 포스터 느낌 제거 → 정사각/가로형 카드 */}
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="h-full w-full grid place-items-center text-xs text-[var(--muted)]">
              NO IMAGE
            </div>
          )}

          {/* 찜 버튼 */}
          <button
            type="button"
            onClick={onToggleLike}
            className={[
              'absolute right-2 top-2 h-8 w-8 rounded-xl',
              'border border-[var(--border)] bg-white/90 backdrop-blur',
              'grid place-items-center shadow-sm',
              'transition hover:border-[var(--accent)]',
            ].join(' ')}
            aria-label={liked ? '찜 해제' : '찜하기'}
            title={liked ? '찜 해제' : '찜하기'}
          >
            <span
              className={[
                'text-sm leading-none',
                liked ? 'text-[var(--accent-strong)]' : 'text-gray-400',
              ].join(' ')}
            >
              ♥
            </span>
          </button>
        </div>

        {/* 정보 영역 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-gray-900 truncate">
                {name || '제목 없음'}
              </div>

              {description ? (
                <div className="mt-1 text-sm text-[var(--muted)] line-clamp-2">
                  {description}
                </div>
              ) : (
                <div className="mt-1 text-sm text-[var(--muted)]">
                  설명 없음
                </div>
              )}
            </div>

            {/* 가격 배지: 회청 포인트는 ‘테두리/텍스트’로만 절제 */}
            <div
              className={[
                'shrink-0 rounded-xl px-3 py-1.5',
                'border border-[var(--border)] bg-[var(--surface)]',
                'text-xs font-semibold',
                price > 0
                  ? 'text-[var(--accent-strong)]'
                  : 'text-[var(--muted)]',
              ].join(' ')}
            >
              {displayPrice}
            </div>
          </div>

          {/* 하단 메타(전부 무채색) */}
          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--muted)]">
            <span className="rounded-lg border border-[var(--border)] bg-white px-2 py-1">
              Listing ID
            </span>
            <span className="truncate">{id}</span>
          </div>
        </div>
      </div>

      {/* Hover 라인: 은은한 포인트 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-transparent transition group-hover:bg-[var(--accent)]/40" />
    </Link>
  );
};

export default ProductCard;
