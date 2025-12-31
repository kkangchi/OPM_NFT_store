import { ethers } from 'ethers'
import ABI from './abi.json'
import { CONTRACT_ADDRESS } from './constants'

/** ipfs://CID → https 게이트웨이 URL */
export function ipfsToHttp(uri: string | undefined): string {
  if (!uri) return ''
  if (uri.startsWith('ipfs://')) {
    const cid = uri.replace('ipfs://', '')
    return `https://gateway.pinata.cloud/ipfs/${cid}`
  }
  return uri
}

/** 브라우저의 MetaMask provider 가져오기 */
export function getProvider() {
  if (typeof window === 'undefined') return null
  const { ethereum } = window as any
  if (!ethereum) {
    alert('MetaMask가 설치되어 있지 않습니다.')
    return null
  }
  return new ethers.BrowserProvider(ethereum)
}

/** 컨트랙트 인스턴스 */
export async function getContract() {
  const provider = getProvider()
  const signer = await provider?.getSigner()
  if (!provider || !signer) throw new Error('지갑이 연결되지 않았습니다.')

  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer)
}

/** 🔥 구매하기 = purchase(seller, metadataURI) */
export async function purchaseNFT(
  seller: string,
  metadataURI: string,
  priceEth: string
) {
  const contract = await getContract()
  const tx = await contract.purchase(seller, metadataURI, {
    value: ethers.parseEther(priceEth),
  })
  const receipt = await tx.wait()
  return receipt
}

/** 🔥 관리자 mint(to, metadataURI) */
export async function mintNFT(to: string, metadataURI: string) {
  const contract = await getContract()
  const tx = await contract.mint(to, metadataURI)
  return await tx.wait()
}

/** 🔥 NFT 전송 */
export async function transferNFT(to: string, tokenId: number) {
  const contract = await getContract()
  const tx = await contract.transferNFT(to, tokenId)
  return await tx.wait()
}

/** (선택) tokenURI 수정 */
export async function updateTokenURI(tokenId: number, metadataURI: string) {
  const contract = await getContract()
  const tx = await contract.updateTokenURI(tokenId, metadataURI)
  return await tx.wait()
}

/** ✅ 현재 연결된 지갑 주소 */
export async function getCurrentWalletAddress() {
  const provider = getProvider()
  if (!provider) throw new Error('MetaMask가 설치되어 있지 않습니다.')
  const signer = await provider.getSigner()
  const address = await signer.getAddress()
  return address
}

/**
 * ✅ 온체인에서 특정 주소 보유 NFT 목록 조회
 *
 * - tokenURI 가 JSON이면 → meta.image / image_url 사용
 * - tokenURI 가 PNG/JPG 등 이미지면 → 그대로 이미지 URL로 사용
 * - JSON 파싱 실패해도 항상 try/catch 로 먹고 fallback 하므로
 *   더 이상 Console SyntaxError 가 나지 않음
 */
export async function getOwnedNFTsOnChainByAddress(ownerAddress: string) {
  const contract = await getContract()

  const tokenIdBigints: bigint[] = await contract.tokensOfOwner(ownerAddress)
  const results: {
    tokenId: number
    metadataURI: string
    imageUrl: string
    rawMetadata?: any
  }[] = []

  for (const idBn of tokenIdBigints) {
    const tokenId = Number(idBn)

    try {
      const metadataURI: string = await contract.tokenURI(tokenId)
      const metaUrl = ipfsToHttp(metadataURI)

      let imageUrl = ''
      let rawMetadata: any = null

      try {
        const res = await fetch(metaUrl)
        if (res.ok) {
          // 응답을 문자열로 읽어서, JSON 형태인지 직접 판단
          const bodyText = await res.text()
          const trimmed = bodyText.trim()

          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            // JSON일 가능성이 있을 때만 파싱
            try {
              const meta = JSON.parse(trimmed)
              rawMetadata = meta
              const imgField = (meta as any).image || (meta as any).image_url
              if (typeof imgField === 'string') {
                imageUrl = ipfsToHttp(imgField)
              } else {
                // image 필드 없으면 tokenURI 자체를 이미지로 사용
                imageUrl = metaUrl
              }
            } catch (jsonErr) {
              console.warn(
                `토큰 ${tokenId} JSON 파싱 실패, tokenURI를 이미지로 사용`,
                jsonErr
              )
              imageUrl = metaUrl
            }
          } else {
            // 바이너리(이미지 등)로 보이는 경우 → 그대로 이미지로 사용
            imageUrl = metaUrl
          }
        } else {
          // fetch 실패 → 최소한 tokenURI를 이미지로 사용
          imageUrl = metaUrl
        }
      } catch (e) {
        console.warn(`토큰 ${tokenId} 메타데이터 로딩 실패`, e)
        imageUrl = metaUrl
      }

      results.push({
        tokenId,
        metadataURI,
        imageUrl,
        rawMetadata,
      })
    } catch (err) {
      console.error(`tokenURI(${tokenId}) 조회 실패`, err)
    }
  }

  return results
}
