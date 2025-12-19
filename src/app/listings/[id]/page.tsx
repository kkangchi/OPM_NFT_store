'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { purchaseNFT } from '@/lib/contract';

type Listing = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  tokenURI: string;
  ownerUid?: string | null;
  ownerAddress?: string | null;
  sold?: boolean;
};

function toGateway(uri: string | undefined): string {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) {
    const cid = uri.replace('ipfs://', '');
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }
  return uri;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [item, setItem] = useState<Listing | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('');

  const isOwner =
    !!user && !!item && !!item.ownerUid && user.uid === item.ownerUid;

  /* --------------------------------------
      Firestore에서 listing + owner 닉네임 불러오기
  ----------------------------------------*/
  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const ref = doc(db, 'listings', String(id));
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError('존재하지 않는 작품입니다.');
          setLoading(false);
          return;
        }

        const data = snap.data() as any;
        const priceNumber = parseFloat(String(data.price ?? '0')) || 0;

        const listing: Listing = {
          id: snap.id,
          name: data.title ?? '',
          description: data.description ?? '',
          price: priceNumber,
          imageUrl: toGateway(data.imageURI),
          tokenURI: data.tokenURI ?? '',
          ownerUid: data.ownerUid ?? null,
          ownerAddress: data.ownerAddress ?? null,
          sold: data.sold ?? false,
        };

        setItem(listing);
        setEditTitle(listing.name);
        setEditDescription(listing.description ?? '');
        setEditPrice(listing.price ? String(listing.price) : '');

        if (listing.ownerUid) {
          const profileRef = doc(db, `users/${listing.ownerUid}/profile/info`);
          const profileSnap = await getDoc(profileRef);

          if (profileSnap.exists()) {
            setOwnerName(profileSnap.data().nickname ?? '사용자');
          } else {
            setOwnerName('사용자');
          }
        } else {
          setOwnerName('알 수 없음');
        }
      } catch (e) {
        console.error(e);
        setError('작품 정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  /* --------------------------------------
      삭제 기능
  ----------------------------------------*/
  const handleDelete = async () => {
    if (!item) return;
    if (!user) {
      alert('로그인 후 삭제할 수 있습니다.');
      return;
    }
    if (!isOwner) {
      alert('작성자만 삭제할 수 있습니다.');
      return;
    }

    const ok = confirm('정말 이 작품을 삭제하시겠습니까?');
    if (!ok) return;

    try {
      await deleteDoc(doc(db, 'listings', item.id));
      alert('삭제되었습니다.');
      router.push('/');
    } catch (e) {
      console.error(e);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  /* --------------------------------------
      수정 기능
  ----------------------------------------*/
  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!item) return;
    if (!user) {
      alert('로그인 후 수정할 수 있습니다.');
      return;
    }
    if (!isOwner) {
      alert('작성자만 수정할 수 있습니다.');
      return;
    }

    const newTitle = editTitle.trim();
    const newDesc = editDescription.trim();
    const newPriceNumber = parseFloat(editPrice || '0') || 0;

    try {
      await updateDoc(doc(db, 'listings', item.id), {
        title: newTitle,
        description: newDesc,
        price: newPriceNumber,
        updatedAt: serverTimestamp(),
      });

      setItem({
        ...item,
        name: newTitle,
        description: newDesc,
        price: newPriceNumber,
      });
      setIsEditing(false);
      alert('수정되었습니다.');
    } catch (e) {
      console.error(e);
      alert('수정 중 오류가 발생했습니다.');
    }
  };

  /* --------------------------------------
      구매 기능 (purchase)
  ----------------------------------------*/
  const handlePurchase = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      router.push('/login');
      return;
    }

    if (!item) return;

    try {
      if (!item.ownerAddress) {
        alert('판매자 지갑 주소가 없습니다.');
        return;
      }

      if (!item.tokenURI) {
        alert('tokenURI가 없습니다.');
        return;
      }

      const tokenURI = item.tokenURI;

      const receipt = await purchaseNFT(
        item.ownerAddress,
        tokenURI,
        String(item.price)
      );

      const log = receipt.logs.find(
        (log: any) => log.topics && log.topics.length === 4
      );
      const tokenId = log ? Number(log.topics[3]) : 0;

      await setDoc(
        doc(db, `users/${user.uid}/purchases/${item.id}`),
        {
          listingId: item.id,
          tokenId,
          price: item.price,
          seller: item.ownerAddress,
          txHash: receipt.hash,
          purchasedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, `users/${user.uid}/nfts/${tokenId}`),
        {
          tokenId,
          tokenURI,
          imageUrl: item.imageUrl,
          purchasedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await updateDoc(doc(db, 'listings', item.id), {
        sold: true,
        soldAt: serverTimestamp(),
      });

      alert('NFT 구매 성공!');
      setItem({ ...item, sold: true });
    } catch (err: any) {
      console.error(err);
      alert('구매 실패: ' + err.message);
    }
  };

  /* --------------------------------------
      장바구니
  ----------------------------------------*/
  const handleAddToCart = async () => {
    if (!item) return;
    if (!user) {
      alert('로그인 후 보관함 이용 가능');
      router.push('/login');
      return;
    }

    try {
      await setDoc(
        doc(db, `users/${user.uid}/cart/${item.id}`),
        {
          listingId: item.id,
          title: item.name,
          price: item.price,
          imageUrl: item.imageUrl,
          ownerUid: item.ownerUid ?? null,
          ownerAddress: item.ownerAddress ?? null,
          addedAt: serverTimestamp(),
        },
        { merge: true }
      );

      alert('보관함에 담았습니다.');
    } catch (err) {
      console.error(err);
      alert('보관함 오류');
    }
  };

  /* --------------------------------------
      로딩 / 에러 처리
  ----------------------------------------*/
  if (loading) {
    return (
      <main className="mx-auto max-w-[1200px] px-6 py-10">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
          불러오는 중...
        </div>
      </main>
    );
  }

  if (error || !item) {
    return (
      <main className="mx-auto max-w-[1200px] px-6 py-10">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-sm text-gray-900 font-semibold">
            {error ?? '오류 발생'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition"
          >
            메인으로
          </button>
        </div>
      </main>
    );
  }

  const displayPrice = item.price > 0 ? `${item.price} ETH` : '가격 미정';

  /* --------------------------------------
      화면(UI)
  ----------------------------------------*/
  return (
    <main className="mx-auto max-w-[1200px] px-6 py-10">
      {/* 상단: 뒤로가기 */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition"
        >
          ← 목록으로
        </button>

        <div className="flex items-center gap-2">
          {item.sold ? (
            <span className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-gray-900">
              SOLD
            </span>
          ) : (
            <span className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--accent-strong)]">
              ON SALE
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 이미지 */}
        <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-auto object-cover"
              />
            ) : (
              <div className="aspect-square grid place-items-center text-sm text-[var(--muted)]">
                NO IMAGE
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--muted)]">
                등록한 사람
              </p>
              <p className="text-sm font-semibold text-gray-900 truncate">
                {ownerName ?? '알 수 없음'}
              </p>
            </div>

            <div className="shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold">
              {item.sold ? (
                <span className="text-gray-900">판매 완료</span>
              ) : (
                <span className="text-[var(--accent-strong)]">
                  {displayPrice}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* 오른쪽 정보 */}
        <section className="space-y-6">
          <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">
              {item.name}
            </h1>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-semibold text-[var(--muted)]">
                  Listing ID
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900 break-all">
                  {item.id}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-semibold text-[var(--muted)]">
                  결제 수단
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  (현재) ETH 표시
                </p>
              </div>
            </div>

            {/* 구매 + 보관함 버튼 (내 작품 아니고 판매 전일 때만) */}
            {!item.sold && !isOwner ? (
              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handlePurchase}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                >
                  구매하기
                </button>

                <button
                  onClick={handleAddToCart}
                  className="rounded-2xl border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition"
                >
                  보관함 담기
                </button>
              </div>
            ) : null}

            {/* 수정 + 삭제 (내 작품이고 판매 전일 때만) */}
            {isOwner && !item.sold ? (
              <div className="mt-5">
                {!isEditing ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition"
                    >
                      수정하기
                    </button>

                    <button
                      onClick={handleDelete}
                      className="rounded-2xl border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition"
                    >
                      삭제하기
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleUpdate} className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-[var(--muted)]">
                        제목
                      </label>
                      <input
                        className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus-visible:shadow-[var(--ring)]"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[var(--muted)]">
                        설명
                      </label>
                      <textarea
                        className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus-visible:shadow-[var(--ring)] h-28"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[var(--muted)]">
                        가격
                      </label>
                      <input
                        className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus-visible:shadow-[var(--ring)]"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-1">
                      <button
                        type="submit"
                        className="rounded-2xl border border-[var(--border)] bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                      >
                        수정 저장
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="rounded-2xl border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition"
                      >
                        취소
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : null}
          </div>

          {/* 작품 설명 */}
          <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">작품 설명</h2>
            <p className="mt-2 text-sm text-[var(--muted)] whitespace-pre-line">
              {item.description || '설명 없음'}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
