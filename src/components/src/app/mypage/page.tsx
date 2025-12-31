'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { db } from '@/lib/firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  Timestamp,
  query,
  where,
} from 'firebase/firestore'
import {
  getCurrentWalletAddress,
  getOwnedNFTsOnChainByAddress,
} from '@/lib/contract'

type ProfileData = {
  nickname?: string | null
  email?: string | null
  photoURL?: string | null
}

type Purchase = {
  id: string
  listingId: string
  tokenId: number
  price: number
  seller?: string
  txHash?: string
  purchasedAt?: Date | null
}

type OwnedNFT = {
  id: string
  tokenId: number
  metadataURI: string
  imageUrl: string
}

type LikedItem = {
  id: string // listingId
  title: string
  price: number
  imageUrl: string
}

type MyListing = {
  id: string
  title: string
  price: number
  imageUrl: string
  sold?: boolean
}

const MAX_PREVIEW = 4

export default function MyPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [nicknameInput, setNicknameInput] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [ownedNFTs, setOwnedNFTs] = useState<OwnedNFT[]>([])
  const [likedItems, setLikedItems] = useState<LikedItem[]>([])
  const [myListings, setMyListings] = useState<MyListing[]>([])

  const [dataLoading, setDataLoading] = useState(true)

  const [showAllOwned, setShowAllOwned] = useState(false)
  const [showAllPurchases, setShowAllPurchases] = useState(false)
  const [showAllLikes, setShowAllLikes] = useState(false)
  const [showAllMyListings, setShowAllMyListings] = useState(false)

  // 로그인 상태 변경 시 전체 데이터 로딩
  useEffect(() => {
    if (!user) {
      setProfile(null)
      setNicknameInput('')
      setPurchases([])
      setOwnedNFTs([])
      setLikedItems([])
      setMyListings([])
      setDataLoading(false)
      return
    }

    const uid = user.uid
    const userEmail = user.email ?? null
    const userDisplayName = user.displayName ?? null
    const userPhotoURL = user.photoURL ?? null

    async function fetchAll() {
      setDataLoading(true)
      try {
        // 1) 프로필
        const profileRef = doc(db, `users/${uid}/profile/info`)
        const profileSnap = await getDoc(profileRef)

        if (profileSnap.exists()) {
          const data = profileSnap.data() as any
          const prof: ProfileData = {
            nickname: data.nickname ?? data.displayName ?? userDisplayName,
            email: data.email ?? userEmail,
            photoURL: data.photoURL ?? userPhotoURL,
          }
          setProfile(prof)
          setNicknameInput(prof.nickname ?? '')
        } else {
          const prof: ProfileData = {
            nickname: userDisplayName,
            email: userEmail,
            photoURL: userPhotoURL,
          }
          setProfile(prof)
          setNicknameInput(prof.nickname ?? '')
        }

        // 2) 구매 내역 (Firestore)
        const purchasesRef = collection(db, `users/${uid}/purchases`)
        const purchasesSnap = await getDocs(purchasesRef)
        const purchaseList: Purchase[] = purchasesSnap.docs.map((docSnap) => {
          const data = docSnap.data() as any
          const ts = data.purchasedAt as Timestamp | undefined
          return {
            id: docSnap.id,
            listingId: data.listingId ?? '',
            tokenId: Number(data.tokenId ?? 0),
            price: Number(data.price ?? 0),
            seller: data.seller ?? '',
            txHash: data.txHash ?? '',
            purchasedAt: ts ? ts.toDate() : null,
          }
        })

        // 3) 보유 NFT (온체인, 새 컨트랙트 기반)
        let nftsList: OwnedNFT[] = []
        try {
          const walletAddr = await getCurrentWalletAddress()
          const onChainNFTs = await getOwnedNFTsOnChainByAddress(walletAddr)
          nftsList = onChainNFTs.map((nft) => ({
            id: String(nft.tokenId),
            tokenId: nft.tokenId,
            metadataURI: nft.metadataURI,
            imageUrl: nft.imageUrl,
          }))
        } catch (err) {
          console.error('온체인 NFT 조회 실패:', err)
        }

        // 4) 찜한 작품 (likes → listings)
        const likesRef = collection(db, `users/${uid}/likes`)
        const likesSnap = await getDocs(likesRef)

        const likedList: LikedItem[] = []
        for (const likeDoc of likesSnap.docs) {
          const likeData = likeDoc.data() as any
          const listingId = likeData.listingId ?? likeDoc.id
          if (!listingId) continue

          const listingRef = doc(db, 'listings', listingId)
          const listingSnap = await getDoc(listingRef)
          if (!listingSnap.exists()) continue

          const listingData = listingSnap.data() as any
          const rawImage = listingData.imageURI as string | undefined
          const imageUrl = rawImage
            ? rawImage.startsWith('ipfs://')
              ? `https://gateway.pinata.cloud/ipfs/${rawImage.replace(
                  'ipfs://',
                  ''
                )}`
              : rawImage
            : ''

          likedList.push({
            id: listingSnap.id,
            title: listingData.title ?? '',
            price: Number(listingData.price ?? 0),
            imageUrl,
          })
        }

        // 5) 내가 등록한 작품 (listings 컬렉션에서 ownerUid == uid)
        const listingsRef = collection(db, 'listings')
        const myListingsQuery = query(listingsRef, where('ownerUid', '==', uid))
        const myListingsSnap = await getDocs(myListingsQuery)

        const myList: MyListing[] = myListingsSnap.docs.map((docSnap) => {
          const data = docSnap.data() as any
          const rawImage = data.imageURI as string | undefined
          const imageUrl = rawImage
            ? rawImage.startsWith('ipfs://')
              ? `https://gateway.pinata.cloud/ipfs/${rawImage.replace(
                  'ipfs://',
                  ''
                )}`
              : rawImage
            : ''

          return {
            id: docSnap.id,
            title: data.title ?? '',
            price: Number(data.price ?? 0),
            imageUrl,
            sold: data.sold ?? false,
          }
        })

        setPurchases(purchaseList)
        setOwnedNFTs(nftsList)
        setLikedItems(likedList)
        setMyListings(myList)
      } catch (err) {
        console.error('마이페이지 데이터 로딩 오류:', err)
      } finally {
        setDataLoading(false)
      }
    }

    fetchAll()
  }, [user])

  // 프로필 저장
  const handleSaveProfile = async () => {
    if (!user) return
    const uid = user.uid

    const nickname = nicknameInput.trim()
    const email = user.email ?? null
    const photoURL = user.photoURL ?? null

    setSavingProfile(true)
    try {
      const profileRef = doc(db, `users/${uid}/profile/info`)
      await setDoc(
        profileRef,
        {
          nickname: nickname || null,
          email,
          photoURL,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )

      setProfile((prev) => ({
        ...(prev ?? {}),
        nickname: nickname || null,
        email,
        photoURL,
      }))
      alert('프로필이 저장되었습니다.')
    } catch (err) {
      console.error(err)
      alert('프로필 저장 중 오류가 발생했습니다.')
    } finally {
      setSavingProfile(false)
    }
  }

  if (loading || dataLoading) {
    return (
      <main className="max-w-[1100px] mx-auto px-4 py-10">
        <p className="text-gray-500">마이페이지를 불러오는 중입니다...</p>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="max-w-[1100px] mx-auto px-4 py-10 space-y-4">
        <h1 className="text-2xl font-bold">마이페이지</h1>
        <p className="text-gray-600 text-sm">
          마이페이지는 로그인 후 이용할 수 있습니다.
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

  const displayNickname =
    profile?.nickname ??
    user.displayName ??
    (user.email ? user.email.split('@')[0] : '사용자')
  const displayEmail = profile?.email ?? user.email ?? '이메일 없음'

  const visibleOwnedNFTs = showAllOwned
    ? ownedNFTs
    : ownedNFTs.slice(0, MAX_PREVIEW)
  const visiblePurchases = showAllPurchases
    ? purchases
    : purchases.slice(0, MAX_PREVIEW)
  const visibleLikes = showAllLikes
    ? likedItems
    : likedItems.slice(0, MAX_PREVIEW)
  const visibleMyListings = showAllMyListings
    ? myListings
    : myListings.slice(0, MAX_PREVIEW)

  return (
    <main className="max-w-[1100px] mx-auto px-4 py-10 space-y-8">
      {/* 프로필 */}
      <section className="border rounded-2xl px-6 py-5 space-y-4 bg-white/70">
        <h1 className="text-xl font-bold">마이페이지</h1>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-purple-200 flex items-center justify-center text-lg font-bold text-purple-700">
            {displayNickname[0] ?? 'U'}
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-gray-700">
              닉네임: <span className="font-semibold">{displayNickname}</span>
            </p>
            <p className="text-gray-500">이메일: {displayEmail}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <label className="block text-xs font-semibold text-gray-600">
            닉네임 수정
          </label>
          <div className="flex gap-2">
            <input
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="표시할 닉네임을 입력하세요"
              className="flex-1 border rounded-md px-3 py-2 text-sm"
            />
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="px-4 py-2 rounded-md bg-purple-600 text-white text-sm disabled:opacity-60"
            >
              {savingProfile ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </section>

      {/* 보유 NFT */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">보유 NFT</h2>
          {ownedNFTs.length > MAX_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAllOwned((v) => !v)}
              className="text-xs text-violet-700 underline"
            >
              {showAllOwned ? '접기' : '더보기'}
            </button>
          )}
        </div>
        {ownedNFTs.length === 0 ? (
          <p className="text-sm text-gray-500">
            연결된 지갑에 보유한 NFT가 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {visibleOwnedNFTs.map((nft) => (
              <div
                key={nft.id}
                className="border rounded-xl overflow-hidden flex flex-col bg-white/70"
              >
                {nft.imageUrl && (
                  <img
                    src={nft.imageUrl}
                    alt={`Token #${nft.tokenId}`}
                    className="w-full h-36 object-cover"
                  />
                )}
                <div className="px-3 py-2 text-xs space-y-1">
                  <p className="font-semibold">Token #{nft.tokenId}</p>
                  <p className="text-gray-500 break-all">
                    {nft.metadataURI || 'metadataURI 없음'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 구매 내역 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">구매 내역</h2>
          {purchases.length > MAX_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAllPurchases((v) => !v)}
              className="text-xs text-violet-700 underline"
            >
              {showAllPurchases ? '접기' : '더보기'}
            </button>
          )}
        </div>
        {purchases.length === 0 ? (
          <p className="text-sm text-gray-500">구매 내역이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {visiblePurchases.map((p) => (
              <div
                key={p.id}
                className="border rounded-xl px-4 py-3 text-sm flex justify-between items-center bg-white/70"
              >
                <div>
                  <p className="font-semibold">
                    Listing: {p.listingId} (Token #{p.tokenId})
                  </p>
                  <p className="text-gray-500">가격: {p.price} ETH</p>
                  {p.purchasedAt && (
                    <p className="text-gray-400 text-xs">
                      구매일{' '}
                      {p.purchasedAt.toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
                {p.txHash && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${p.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-violet-700 underline"
                  >
                    거래 상세
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 내가 등록한 작품 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">등록한 작품</h2>
          {myListings.length > MAX_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAllMyListings((v) => !v)}
              className="text-xs text-violet-700 underline"
            >
              {showAllMyListings ? '접기' : '더보기'}
            </button>
          )}
        </div>
        {myListings.length === 0 ? (
          <p className="text-sm text-gray-500">등록한 작품이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {visibleMyListings.map((item) => (
              <button
                key={item.id}
                onClick={() => router.push(`/listings/${item.id}`)}
                className="border rounded-xl overflow-hidden text-left bg-white/70 hover:shadow-md transition-shadow"
              >
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-36 object-cover"
                  />
                )}
                <div className="px-3 py-2 text-xs space-y-1">
                  <p className="font-semibold truncate">{item.title}</p>
                  <p className="text-gray-500">{item.price} ETH</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 찜한 작품 */}
      <section className="space-y-3 mb-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">찜한 작품</h2>
          {likedItems.length > MAX_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAllLikes((v) => !v)}
              className="text-xs text-violet-700 underline"
            >
              {showAllLikes ? '접기' : '더보기'}
            </button>
          )}
        </div>
        {likedItems.length === 0 ? (
          <p className="text-sm text-gray-500">찜한 작품이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {visibleLikes.map((item) => (
              <button
                key={item.id}
                onClick={() => router.push(`/listings/${item.id}`)}
                className="border rounded-xl overflow-hidden text-left bg-white/70 hover:shadow-md transition-shadow"
              >
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-36 object-cover"
                  />
                )}
                <div className="px-3 py-2 text-xs space-y-1">
                  <p className="font-semibold truncate">{item.title}</p>
                  <p className="text-gray-500">{item.price} ETH</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
