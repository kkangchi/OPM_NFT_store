'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { db } from '@/lib/firebase'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  Timestamp,
} from 'firebase/firestore'

type CartItem = {
  id: string // cart 문서 id (= listingId로 저장한 경우가 많음)
  listingId: string
  title: string
  price: number
  imageUrl: string
  ownerUid?: string | null
  ownerAddress?: string | null
  addedAt?: Date | null
}

export default function CartPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [items, setItems] = useState<CartItem[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)

  // 장바구니 목록 불러오기
  useEffect(() => {
    if (!user) {
      setItems([])
      setDataLoading(false)
      return
    }

    const uid = user.uid

    async function fetchCart() {
      setDataLoading(true)
      try {
        const cartRef = collection(db, `users/${uid}/cart`)
        const snap = await getDocs(cartRef)

        const list: CartItem[] = snap.docs.map((d) => {
          const data = d.data() as any
          const ts = data.addedAt as Timestamp | undefined
          return {
            id: d.id,
            listingId: data.listingId ?? d.id,
            title: data.title ?? '',
            price: Number(data.price ?? 0),
            imageUrl: data.imageUrl ?? '',
            ownerUid: data.ownerUid ?? null,
            ownerAddress: data.ownerAddress ?? null,
            addedAt: ts ? ts.toDate() : null,
          }
        })

        setItems(list)
      } catch (err) {
        console.error('장바구니 불러오기 오류:', err)
      } finally {
        setDataLoading(false)
      }
    }

    fetchCart()
  }, [user])

  // 항목 삭제
  const handleRemove = async (cartId: string) => {
    if (!user) return
    const ok = confirm('이 작품을 장바구니에서 제거하시겠습니까?')
    if (!ok) return

    const uid = user.uid
    try {
      setRemovingId(cartId)
      await deleteDoc(doc(db, `users/${uid}/cart/${cartId}`))
      setItems((prev) => prev.filter((it) => it.id !== cartId))
    } catch (err) {
      console.error(err)
      alert('장바구니에서 제거하는 중 오류가 발생했습니다.')
    } finally {
      setRemovingId(null)
    }
  }

  const totalPrice = items.reduce((sum, it) => sum + (it.price || 0), 0)

  if (loading || dataLoading) {
    return (
      <main className="max-w-[1100px] mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-4">장바구니</h1>
        <p className="text-gray-500 text-sm">장바구니를 불러오는 중입니다...</p>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="max-w-[1100px] mx-auto px-4 py-10 space-y-4">
        <h1 className="text-2xl font-bold">장바구니</h1>
        <p className="text-gray-600 text-sm">
          장바구니는 로그인 후 이용할 수 있습니다.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="px-4 py-2 rounded-md bg-black text-white text-sm"
        >
          로그인하러 가기
        </button>
      </main>
    )
  }

  return (
    <main className="max-w-[1100px] mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold">장바구니</h1>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">
          장바구니에 담긴 작품이 없습니다.
        </p>
      ) : (
        <>
          {/* 합계 영역 */}
          <section className="border rounded-2xl px-5 py-4 bg-white/70 flex items-center justify-between">
            <div className="text-sm">
              <p className="font-semibold">총 {items.length}개 작품</p>
              <p className="text-gray-500">
                총 금액:{' '}
                <span className="font-semibold text-purple-700">
                  {totalPrice} ETH
                </span>
              </p>
            </div>
            {/* 나중에 전체 구매 버튼을 여기서 구현해도 됨 */}
          </section>

          {/* 장바구니 목록 */}
          <section className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="border rounded-2xl bg-white/70 px-4 py-3 flex items-center gap-4"
              >
                {/* 썸네일 */}
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                  />
                )}

                {/* 정보 */}
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => router.push(`/listings/${item.listingId}`)}
                >
                  <p className="font-semibold text-sm truncate">
                    {item.title || '제목 없음'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    가격: {item.price} ETH
                  </p>
                  {item.addedAt && (
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      담은 시각{' '}
                      {item.addedAt.toLocaleString('ko-KR', {
                        year: '2-digit',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>

                {/* 삭제 버튼 */}
                <button
                  onClick={() => handleRemove(item.id)}
                  disabled={removingId === item.id}
                  className="px-3 py-1.5 rounded-md border border-gray-300 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {removingId === item.id ? '삭제 중...' : '제거'}
                </button>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  )
}
