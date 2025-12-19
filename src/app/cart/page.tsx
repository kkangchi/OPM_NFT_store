'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  Timestamp,
} from 'firebase/firestore';

type CartItem = {
  id: string; // cart 문서 id (= listingId로 저장한 경우가 많음)
  listingId: string;
  title: string;
  price: number;
  imageUrl: string;
  ownerUid?: string | null;
  ownerAddress?: string | null;
  addedAt?: Date | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function CartPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<CartItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // 장바구니 목록 불러오기
  useEffect(() => {
    if (!user) {
      setItems([]);
      setDataLoading(false);
      return;
    }

    const uid = user.uid;

    async function fetchCart() {
      setDataLoading(true);
      try {
        const cartRef = collection(db, `users/${uid}/cart`);
        const snap = await getDocs(cartRef);

        const list: CartItem[] = snap.docs.map((d) => {
          const data = d.data() as any;
          const ts = data.addedAt as Timestamp | undefined;
          return {
            id: d.id,
            listingId: data.listingId ?? d.id,
            title: data.title ?? '',
            price: Number(data.price ?? 0),
            imageUrl: data.imageUrl ?? '',
            ownerUid: data.ownerUid ?? null,
            ownerAddress: data.ownerAddress ?? null,
            addedAt: ts ? ts.toDate() : null,
          };
        });

        setItems(list);
      } catch (err) {
        console.error('장바구니 불러오기 오류:', err);
      } finally {
        setDataLoading(false);
      }
    }

    fetchCart();
  }, [user]);

  // 항목 삭제
  const handleRemove = async (cartId: string) => {
    if (!user) return;
    const ok = confirm('이 항목을 보관함에서 제거하시겠습니까?');
    if (!ok) return;

    const uid = user.uid;
    try {
      setRemovingId(cartId);
      await deleteDoc(doc(db, `users/${uid}/cart/${cartId}`));
      setItems((prev) => prev.filter((it) => it.id !== cartId));
    } catch (err) {
      console.error(err);
      alert('제거 중 오류가 발생했습니다.');
    } finally {
      setRemovingId(null);
    }
  };

  const totalPrice = useMemo(
    () => items.reduce((sum, it) => sum + (it.price || 0), 0),
    [items]
  );

  // 공통 헤더 텍스트
  const headerTitle = '보관함';
  const headerDesc =
    '임시로 담아둔 NFT 목록을 확인하고 상세 페이지로 이동할 수 있습니다.';

  if (loading || dataLoading) {
    return (
      <main className="mx-auto max-w-[1200px] px-6 py-10">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            {headerTitle}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{headerDesc}</p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
          보관함을 불러오는 중입니다...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-[1200px] px-6 py-10 space-y-4">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">
          {headerTitle}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          보관함은 로그인 후 이용할 수 있습니다.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition"
        >
          로그인하러 가기
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-10 space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            {headerTitle}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{headerDesc}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-gray-900">
            {items.length}
          </span>
          <span className="text-sm text-[var(--muted)]">items</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
          보관함에 담긴 항목이 없습니다.
        </div>
      ) : (
        <>
          {/* 합계 카드 */}
          <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-semibold text-gray-900">
                총 {items.length}개 항목
              </p>
              <p className="mt-1 text-[var(--muted)]">
                총 금액:{' '}
                <span className="font-semibold text-[var(--accent-strong)]">
                  {totalPrice} ETH
                </span>
              </p>
            </div>

            {/* 확장 기능 자리(전체 구매 등) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition"
              >
                계속 둘러보기
              </button>
            </div>
          </section>

          {/* 목록 */}
          <section className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className={cx(
                  'rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm',
                  'flex flex-col gap-4 sm:flex-row sm:items-center'
                )}
              >
                {/* 썸네일 */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-xs text-[var(--muted)]">
                        NO IMAGE
                      </div>
                    )}
                  </div>

                  {/* 정보 */}
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => router.push(`/listings/${item.listingId}`)}
                  >
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {item.title || '제목 없음'}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      가격:{' '}
                      <span className="font-semibold text-gray-900">
                        {item.price} ETH
                      </span>
                    </p>
                    {item.addedAt ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        담은 시각{' '}
                        {item.addedAt.toLocaleString('ko-KR', {
                          year: '2-digit',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* 액션 */}
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/listings/${item.listingId}`)}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition"
                  >
                    상세 보기
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    disabled={removingId === item.id}
                    className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition disabled:opacity-60"
                  >
                    {removingId === item.id ? '삭제 중...' : '제거'}
                  </button>
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
