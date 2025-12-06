import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

// ipfs://CID → 게이트웨이 URL
function toGateway(uri: string | undefined): string {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) {
    const cid = uri.replace('ipfs://', '');
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }
  return uri;
}

export async function GET() {
  try {
    const colRef = collection(db, 'listings');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);

    const items = snap.docs.map((doc) => {
      const data = doc.data() as any;

      // 업로드 시 price를 "0.1" 또는 "0.1 ETH" 등으로 저장했어도
      // parseFloat 로 숫자만 뽑아냄 → 0.1
      const rawPrice = data.price ?? '0';
      const priceNumber = parseFloat(String(rawPrice)) || 0;

      return {
        id: doc.id,
        name: data.title ?? '',
        price: priceNumber, // 🔥 숫자 (ETH 단위)
        imageUrl: toGateway(data.imageURI),
        description: data.description ?? '',
      };
    });

    return NextResponse.json(items);
  } catch (err: any) {
    console.error('GET /api/listings error:', err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}
