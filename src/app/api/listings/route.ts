import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'

// 캐시 완전 비활성화 → 즉시 반영
export const dynamic = 'force-dynamic'

// ipfs:// → gateway URL 변환
function toGateway(uri: string | undefined): string {
  if (!uri) return ''
  if (uri.startsWith('ipfs://')) {
    const cid = uri.replace('ipfs://', '')
    return `https://gateway.pinata.cloud/ipfs/${cid}`
  }
  return uri
}

export async function GET() {
  try {
    const colRef = collection(db, 'listings')
    const q = query(colRef, orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)

    // 🔥 sold === true 인 문서는 목록에서 제외
    const visibleListings = snap.docs
      .map((doc) => {
        const data = doc.data() as any
        const priceNumber = parseFloat(String(data.price ?? '0')) || 0

        // 판매 완료된 작품 제외
        if (data.sold === true) return null

        return {
          id: doc.id,
          name: data.title ?? '',
          price: priceNumber,
          imageUrl: toGateway(data.imageURI),
          description: data.description ?? '',
        }
      })
      .filter((item) => item !== null)

    return NextResponse.json(visibleListings)
  } catch (err: any) {
    console.error('GET /api/listings error:', err)
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    )
  }
}
