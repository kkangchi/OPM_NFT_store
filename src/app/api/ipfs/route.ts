import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const JWT = process.env.PINATA_JWT
    if (!JWT) {
      return NextResponse.json({ error: 'PINATA_JWT missing' }, { status: 500 })
    }

    const form = await req.formData()
    const image = form.get('image') as File | null

    const title = String(form.get('title') ?? '')
    const description = String(form.get('description') ?? '')
    const price = String(form.get('price') ?? '')

    if (!image || !title) {
      return NextResponse.json(
        { error: 'image and title are required' },
        { status: 400 }
      )
    }

    // ============================
    // 1) 이미지 IPFS 업로드
    // ============================
    const imageUpload = await fetch(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${JWT}`,
        },
        body: (() => {
          const fd = new FormData()
          fd.append('file', image)
          return fd
        })(),
      }
    )

    if (!imageUpload.ok) {
      throw new Error('Image upload failed')
    }

    const imgRes = await imageUpload.json()
    const imgCID = imgRes.IpfsHash

    // 게이트웨이 URL (이미지 표시용)
    const imageGatewayURL = `https://gateway.pinata.cloud/ipfs/${imgCID}`

    // ============================
    // 2) 메타데이터 JSON 생성
    // ============================
    const metadata = {
      name: title,
      description,
      image: imageGatewayURL, // 💥 MetaMask 호환 위해 ipfs:// 대신 gateway URL 사용
      properties: { price },
    }

    // ============================
    // 3) metadata.json IPFS 업로드
    // ============================
    const metaUpload = await fetch(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${JWT}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      }
    )

    if (!metaUpload.ok) {
      throw new Error('Metadata upload failed')
    }

    const metaRes = await metaUpload.json()
    const tokenCID = metaRes.IpfsHash

    const metadataGatewayURL = `https://gateway.pinata.cloud/ipfs/${tokenCID}`

    // ============================
    // 4) 응답 반환
    // ============================
    return NextResponse.json({
      title,
      description,
      price,
      imageURI: imageGatewayURL, // UI용
      tokenURI: metadataGatewayURL, // NFT metadata URI
      imageCID: imgCID,
      tokenCID,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    )
  }
}
