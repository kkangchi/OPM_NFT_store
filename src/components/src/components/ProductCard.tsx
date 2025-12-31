'use client'

import type React from 'react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'

// Firestore
import { db } from '@/lib/firebase'
import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore'

export type Product = {
  id: string
  name: string
  price: number
  imageUrl: string
  description?: string
}

type Props = Product

// 제목을 Firestore 문서 ID로 안전하게 변환하는 함수
function makeSafeId(title: string) {
  return title
    .trim()
    .replace(/\s+/g, '-') // 공백 → -
    .replace(/[^a-zA-Z0-9가-힣-_]/g, '') // 특수문자 제거
    .slice(0, 40) // 너무 길면 40자까지만
}

const ProductCard: React.FC<Props> = ({
  id,
  name,
  price,
  imageUrl,
  description,
}) => {
  const [liked, setLiked] = useState(false)

  const { user } = useAuth()
  const router = useRouter()

  const displayPrice = price > 0 ? `${price} ETH` : '가격 미정'

  // 제목 기반 문서 ID
  const docId = makeSafeId(name) || id

  // 찜 여부 불러오기 (TS 안전하게 수정됨)
  useEffect(() => {
    if (!user) return

    const uid = user.uid // TS가 여기서부터는 절대 null 아님

    async function loadLiked() {
      const ref = doc(db, `users/${uid}/likes/${docId}`)
      const snap = await getDoc(ref)
      if (snap.exists()) {
        setLiked(true)
      }
    }

    loadLiked()
  }, [user, docId])

  // 찜 버튼 클릭
  const onToggleLike: React.MouseEventHandler<HTMLButtonElement> = async (
    e
  ) => {
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      router.push('/login')
      return
    }

    const uid = user.uid // 다시 TS 안전하게 보장

    const ref = doc(db, `users/${uid}/likes/${docId}`)

    // 이미 찜 → 삭제
    if (liked) {
      await deleteDoc(ref)
      setLiked(false)
      return
    }

    // 찜 저장
    await setDoc(ref, {
      listingId: id,
      title: name,
      createdAt: new Date(),
    })

    setLiked(true)
  }

  return (
    <Link
      href={`/listings/${id}`}
      className="bg-white rounded-2xl border border-gray-300 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
    >
      {/* 이미지 영역 */}
      <div className="relative aspect-3/4 bg-gray-100 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
            이미지 없음
          </div>
        )}

        {/* 찜 버튼 */}
        <button
          type="button"
          onClick={onToggleLike}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 flex items-center justify-center text-xs shadow-sm"
        >
          <span className={liked ? 'text-pink-500' : 'text-gray-400'}>♥</span>
        </button>
      </div>

      {/* 정보 영역 */}
      <div className="flex-1 flex flex-col px-3 py-3">
        <div className="text-sm font-semibold truncate">
          {name || '제목 없음'}
        </div>

        {description && (
          <div className="mt-1 text-xs text-gray-500 line-clamp-2">
            {description}
          </div>
        )}

        <div className="mt-2 text-sm font-semibold text-violet-700">
          {displayPrice}
        </div>
      </div>
    </Link>
  )
}

export default ProductCard
