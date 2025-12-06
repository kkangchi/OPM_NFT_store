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

/* 🔥 ownerName 은 Firestore 에서 동적으로 불러올 것 */
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

        // 🔥 ownerUid 로 닉네임 가져오기
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
      alert('로그인 후 장바구니 이용 가능');
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

      alert('장바구니에 담았습니다.');
    } catch (err) {
      console.error(err);
      alert('장바구니 오류');
    }
  };

  /* --------------------------------------
      로딩 / 에러 처리
  ----------------------------------------*/
  if (loading) {
    return (
      <main className="max-w-[1100px] mx-auto px-4 py-10">
        <p className="text-gray-500">불러오는 중...</p>
      </main>
    );
  }

  if (error || !item) {
    return (
      <main className="max-w-[1100px] mx-auto px-4 py-10">
        <p className="text-red-600">{error ?? '오류 발생'}</p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 border px-4 py-2 rounded cursor-pointer hover:bg-gray-100 transition"
        >
          메인으로
        </button>
      </main>
    );
  }

  const displayPrice = item.price > 0 ? `${item.price} ETH` : '가격 미정';

  /* --------------------------------------
      화면(UI)
  ----------------------------------------*/
  return (
    <main className="max-w-[1100px] mx-auto px-4 py-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 이미지 */}
        <div>
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full rounded-2xl border object-cover"
          />
        </div>

        {/* 오른쪽 정보 */}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">{item.name}</h1>

            {/* 닉네임 표시 */}
            <p className="text-sm text-gray-500 mb-1">
              등록한 사람: {ownerName ?? '알 수 없음'}
            </p>

            {item.sold ? (
              <p className="text-lg font-bold text-red-600">판매 완료</p>
            ) : (
              <p className="text-lg font-semibold text-violet-700">
                {displayPrice}
              </p>
            )}
          </div>

          {/* 작품 설명 */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700">작품 설명</h2>
            <p className="text-sm text-gray-600 whitespace-pre-line">
              {item.description || '설명 없음'}
            </p>
          </div>

          {/* 구매 + 장바구니 버튼 (내 작품 아니고 판매 전일 때만) */}
          {!item.sold && !isOwner && (
            <div className="flex gap-4 mt-4">
              <button
                onClick={handlePurchase}
                className="bg-green-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-green-700 cursor-pointer transition"
              >
                NFT 구매하기
              </button>

              <button
                onClick={handleAddToCart}
                className="bg-violet-700 text-white px-5 py-2 rounded-lg font-semibold hover:bg-violet-800 cursor-pointer transition"
              >
                장바구니 담기
              </button>
            </div>
          )}

          {/* 수정 + 삭제 (내 작품이고 판매 전일 때만) */}
          {isOwner && !item.sold && (
            <>
              {!isEditing ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 rounded-lg border border-violet-600 text-violet-700 font-medium
             hover:bg-violet-600 hover:text-white cursor-pointer transition"
                  >
                    수정하기
                  </button>

                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 cursor-pointer transition"
                  >
                    삭제하기
                  </button>
                </div>
              ) : (
                <form onSubmit={handleUpdate} className="space-y-3">
                  <div>
                    <label className="text-xs">제목</label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs">설명</label>
                    <textarea
                      className="w-full border rounded px-3 py-2 text-sm h-24"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs">가격</label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-black text-white rounded cursor-pointer hover:bg-gray-900 transition"
                    >
                      수정 저장
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 border rounded cursor-pointer hover:bg-gray-100 transition"
                    >
                      취소
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
