import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'

// ipfs:// → 게이트웨이 URL로 변환 (이미지 표시용)
function toGateway(uri: string | undefined): string {
  if (!uri) return ''
  return uri.startsWith('ipfs://')
    ? uri.replace('ipfs://', 'https://nftstorage.link/ipfs/')
    : uri
}

export async function GET() {
  try {
    // Firestore의 "listings" 콜렉션 조회
    const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)

    const items = snap.docs.map((doc) => {
      const data = doc.data() as any

      return {
        id: doc.id,
        name: data.title ?? '',
        price: Number(data.price ?? 0),
        imageUrl: toGateway(data.imageURI),
        description: data.description ?? '',
        sold: data.sold ?? false, // 판매 여부
      }
    })

    // 🔥 판매된 작품(sold:true) 제외하고 반환
    const visibleItems = items.filter((item) => item.sold !== true)

    return NextResponse.json(visibleItems)
  } catch (err: any) {
    console.error('GET /api/listings error:', err)
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    )
  }
}
