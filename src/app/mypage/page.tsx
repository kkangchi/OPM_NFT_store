'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
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
} from 'firebase/firestore';
import {
  getCurrentWalletAddress,
  getOwnedNFTsOnChainByAddress,

  // ✅ 토큰 UI 기능 추가에 필요한 것들
  claimToken,
  hasClaimed,
  getTokenBalance,
  getTokenSymbol,
  getDropAmount,
  getFaucetRemaining,
  addTokenToMetaMask,
  transferToken,
  getSepoliaTokenLink,
  getSepoliaTxLink,
} from '@/lib/contract';

type ProfileData = {
  nickname?: string | null;
  email?: string | null;
  photoURL?: string | null;
};

type Purchase = {
  id: string;
  listingId: string;
  tokenId: number;
  price: number;
  seller?: string;
  txHash?: string;
  purchasedAt?: Date | null;
};

type OwnedNFT = {
  id: string;
  tokenId: number;
  metadataURI: string;
  imageUrl: string;
};

type LikedItem = {
  id: string; // listingId
  title: string;
  price: number;
  imageUrl: string;
};

type MyListing = {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
  sold?: boolean;
};

const MAX_PREVIEW = 4;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function toGateway(uri: string | undefined) {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) {
    const cid = uri.replace('ipfs://', '');
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }
  return uri;
}

function SectionHeader(props: {
  title: string;
  count?: number;
  action?: any;
  desc?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{props.title}</h2>
        {props.desc ? (
          <p className="mt-1 text-sm text-[var(--muted)]">{props.desc}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {typeof props.count === 'number' ? (
          <span className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-semibold text-gray-900">
            {props.count}
          </span>
        ) : null}
        {props.action}
      </div>
    </div>
  );
}

function ToggleMoreButton(props: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="rounded-xl border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition"
    >
      {props.open ? '접기' : '더보기'}
    </button>
  );
}

/** 타일형 프리뷰 카드: (마이페이지용) */
function TileCard(props: {
  imageUrl?: string;
  title: string;
  subtitle?: string;
  meta?: string;
  onClick?: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cx(
        'group w-full text-left overflow-hidden rounded-2xl',
        'border border-[var(--border)] bg-white shadow-sm',
        'transition hover:shadow-[var(--shadow)]'
      )}
    >
      <div className="relative aspect-square bg-[var(--surface)]">
        {props.imageUrl ? (
          <img
            src={props.imageUrl}
            alt={props.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full grid place-items-center text-xs text-[var(--muted)]">
            NO IMAGE
          </div>
        )}

        {props.badge ? (
          <div className="absolute left-3 top-3 rounded-xl border border-[var(--border)] bg-white/90 px-2 py-1 text-xs font-semibold text-gray-900 backdrop-blur">
            {props.badge}
          </div>
        ) : null}
      </div>

      <div className="p-3">
        <div className="text-sm font-semibold text-gray-900 truncate">
          {props.title}
        </div>
        {props.subtitle ? (
          <div className="mt-1 text-sm text-[var(--muted)] truncate">
            {props.subtitle}
          </div>
        ) : null}
        {props.meta ? (
          <div className="mt-2 text-xs text-[var(--muted)] truncate">
            {props.meta}
          </div>
        ) : null}
      </div>
    </button>
  );
}

export default function MyPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [ownedNFTs, setOwnedNFTs] = useState<OwnedNFT[]>([]);
  const [likedItems, setLikedItems] = useState<LikedItem[]>([]);
  const [myListings, setMyListings] = useState<MyListing[]>([]);

  const [dataLoading, setDataLoading] = useState(true);

  const [showAllOwned, setShowAllOwned] = useState(false);
  const [showAllPurchases, setShowAllPurchases] = useState(false);
  const [showAllLikes, setShowAllLikes] = useState(false);
  const [showAllMyListings, setShowAllMyListings] = useState(false);

  /** =========================
   *  ✅ 토큰 UI 상태 (추가)
   *  ========================= */
  const [walletAddr, setWalletAddr] = useState<string>('');
  const [tokenSymbol, setTokenSymbol] = useState<string>('TB');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [tokenClaimed, setTokenClaimed] = useState<boolean>(false);
  const [dropAmount, setDropAmount] = useState<string | null>(null);
  const [faucetRemaining, setFaucetRemaining] = useState<string>('0');
  const [tokenBusy, setTokenBusy] = useState<boolean>(false);
  const [tokenTx, setTokenTx] = useState<string>('');

  const [sendTo, setSendTo] = useState('');
  const [sendAmt, setSendAmt] = useState('');

  async function refreshTokenInfo(addr: string) {
    try {
      const [sym, bal, claimed, drop, remain] = await Promise.all([
        getTokenSymbol().catch(() => 'TB'),
        getTokenBalance(addr).catch(() => '0'),
        hasClaimed(addr).catch(() => false),
        getDropAmount().catch(() => null),
        getFaucetRemaining().catch(() => '0'),
      ]);

      setTokenSymbol(sym || 'TB');
      setTokenBalance(bal || '0');
      setTokenClaimed(!!claimed);
      setDropAmount(drop);
      setFaucetRemaining(remain || '0');
    } catch (e) {
      console.error('토큰 정보 갱신 실패:', e);
    }
  }

  async function handleClaimToken() {
    try {
      setTokenBusy(true);
      setTokenTx('');
      const receipt = await claimToken();
      const hash =
        (receipt as any)?.hash ?? (receipt as any)?.transactionHash ?? '';
      if (hash) setTokenTx(hash);

      if (walletAddr) await refreshTokenInfo(walletAddr);
      alert('토큰 발급이 완료되었습니다.');
    } catch (e: any) {
      console.error(e);
      alert(e?.reason || e?.message || '토큰 발급 중 오류가 발생했습니다.');
    } finally {
      setTokenBusy(false);
    }
  }

  async function handleAddTokenToMetaMask() {
    try {
      await addTokenToMetaMask();
      alert('MetaMask에 토큰이 추가되었습니다.');
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'MetaMask 토큰 추가 실패');
    }
  }

  async function handleTransferToken() {
    try {
      const to = sendTo.trim();
      const amt = sendAmt.trim();
      if (!to || !amt) {
        alert('받는 주소와 수량을 입력하세요.');
        return;
      }
      setTokenBusy(true);
      setTokenTx('');
      const receipt = await transferToken(to, amt);
      const hash =
        (receipt as any)?.hash ?? (receipt as any)?.transactionHash ?? '';
      if (hash) setTokenTx(hash);

      setSendTo('');
      setSendAmt('');
      if (walletAddr) await refreshTokenInfo(walletAddr);
      alert('전송이 완료되었습니다.');
    } catch (e: any) {
      console.error(e);
      alert(e?.reason || e?.message || '전송 중 오류가 발생했습니다.');
    } finally {
      setTokenBusy(false);
    }
  }

  // 로그인 상태 변경 시 전체 데이터 로딩
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setNicknameInput('');
      setPurchases([]);
      setOwnedNFTs([]);
      setLikedItems([]);
      setMyListings([]);
      setWalletAddr('');
      setTokenBalance('0');
      setTokenClaimed(false);
      setTokenTx('');
      setDataLoading(false);
      return;
    }

    const uid = user.uid;
    const userEmail = user.email ?? null;
    const userDisplayName = user.displayName ?? null;
    const userPhotoURL = user.photoURL ?? null;

    async function fetchAll() {
      setDataLoading(true);
      try {
        // 1) 프로필
        const profileRef = doc(db, `users/${uid}/profile/info`);
        const profileSnap = await getDoc(profileRef);

        if (profileSnap.exists()) {
          const data = profileSnap.data() as any;
          const prof: ProfileData = {
            nickname: data.nickname ?? data.displayName ?? userDisplayName,
            email: data.email ?? userEmail,
            photoURL: data.photoURL ?? userPhotoURL,
          };
          setProfile(prof);
          setNicknameInput(prof.nickname ?? '');
        } else {
          const prof: ProfileData = {
            nickname: userDisplayName,
            email: userEmail,
            photoURL: userPhotoURL,
          };
          setProfile(prof);
          setNicknameInput(prof.nickname ?? '');
        }

        // 2) 구매 내역 (Firestore)
        const purchasesRef = collection(db, `users/${uid}/purchases`);
        const purchasesSnap = await getDocs(purchasesRef);
        const purchaseList: Purchase[] = purchasesSnap.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          const ts = data.purchasedAt as Timestamp | undefined;
          return {
            id: docSnap.id,
            listingId: data.listingId ?? '',
            tokenId: Number(data.tokenId ?? 0),
            price: Number(data.price ?? 0),
            seller: data.seller ?? '',
            txHash: data.txHash ?? '',
            purchasedAt: ts ? ts.toDate() : null,
          };
        });

        // 3) 보유 NFT (온체인) + ✅ 토큰 정보
        let nftsList: OwnedNFT[] = [];
        try {
          const addr = await getCurrentWalletAddress();
          setWalletAddr(addr);

          // 온체인 NFT
          const onChainNFTs = await getOwnedNFTsOnChainByAddress(addr);
          nftsList = onChainNFTs.map((nft) => ({
            id: String(nft.tokenId),
            tokenId: nft.tokenId,
            metadataURI: nft.metadataURI,
            imageUrl: nft.imageUrl,
          }));

          // ✅ 토큰 섹션 갱신
          await refreshTokenInfo(addr);
        } catch (err) {
          console.error('지갑/온체인 조회 실패:', err);
        }

        // 4) 찜한 작품 (likes → listings)
        const likesRef = collection(db, `users/${uid}/likes`);
        const likesSnap = await getDocs(likesRef);

        const likedList: LikedItem[] = [];
        for (const likeDoc of likesSnap.docs) {
          const likeData = likeDoc.data() as any;
          const listingId = likeData.listingId ?? likeDoc.id;
          if (!listingId) continue;

          const listingRef = doc(db, 'listings', listingId);
          const listingSnap = await getDoc(listingRef);
          if (!listingSnap.exists()) continue;

          const listingData = listingSnap.data() as any;
          const imageUrl = toGateway(
            listingData.imageURI as string | undefined
          );

          likedList.push({
            id: listingSnap.id,
            title: listingData.title ?? '',
            price: Number(listingData.price ?? 0),
            imageUrl,
          });
        }

        // 5) 내가 등록한 작품
        const listingsRef = collection(db, 'listings');
        const myListingsQuery = query(
          listingsRef,
          where('ownerUid', '==', uid)
        );
        const myListingsSnap = await getDocs(myListingsQuery);

        const myList: MyListing[] = myListingsSnap.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          const imageUrl = toGateway(data.imageURI as string | undefined);

          return {
            id: docSnap.id,
            title: data.title ?? '',
            price: Number(data.price ?? 0),
            imageUrl,
            sold: data.sold ?? false,
          };
        });

        setPurchases(purchaseList);
        setOwnedNFTs(nftsList);
        setLikedItems(likedList);
        setMyListings(myList);
      } catch (err) {
        console.error('마이페이지 데이터 로딩 오류:', err);
      } finally {
        setDataLoading(false);
      }
    }

    fetchAll();
  }, [user]);

  // 프로필 저장
  const handleSaveProfile = async () => {
    if (!user) return;
    const uid = user.uid;

    const nickname = nicknameInput.trim();
    const email = user.email ?? null;
    const photoURL = user.photoURL ?? null;

    setSavingProfile(true);
    try {
      const profileRef = doc(db, `users/${uid}/profile/info`);
      await setDoc(
        profileRef,
        {
          nickname: nickname || null,
          email,
          photoURL,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setProfile((prev) => ({
        ...(prev ?? {}),
        nickname: nickname || null,
        email,
        photoURL,
      }));
      alert('프로필이 저장되었습니다.');
    } catch (err) {
      console.error(err);
      alert('프로필 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingProfile(false);
    }
  };

  const displayNickname = useMemo(() => {
    if (!user) return '사용자';
    return (
      profile?.nickname ??
      user.displayName ??
      (user.email ? user.email.split('@')[0] : '사용자')
    );
  }, [profile?.nickname, user]);

  const displayEmail = useMemo(() => {
    if (!user) return '이메일 없음';
    return profile?.email ?? user.email ?? '이메일 없음';
  }, [profile?.email, user]);

  const visibleOwnedNFTs = showAllOwned
    ? ownedNFTs
    : ownedNFTs.slice(0, MAX_PREVIEW);
  const visiblePurchases = showAllPurchases
    ? purchases
    : purchases.slice(0, MAX_PREVIEW);
  const visibleLikes = showAllLikes
    ? likedItems
    : likedItems.slice(0, MAX_PREVIEW);
  const visibleMyListings = showAllMyListings
    ? myListings
    : myListings.slice(0, MAX_PREVIEW);

  if (loading || dataLoading) {
    return (
      <main className="mx-auto max-w-[1200px] px-6 py-10">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
          마이페이지를 불러오는 중입니다...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-[1200px] px-6 py-10 space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">내 자산</h1>
        <p className="text-sm text-[var(--muted)]">
          마이페이지는 로그인 후 이용할 수 있습니다.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition"
        >
          로그인하러 가기
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-10 space-y-8">
      {/* 프로필 */}
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">내 자산</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              계정 정보 및 내 활동 내역을 확인합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-gray-900">
              {displayNickname}
            </span>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl border border-[var(--border)] bg-[var(--surface)] grid place-items-center text-sm font-semibold text-[var(--accent-strong)]">
            {(displayNickname?.[0] ?? 'U').toUpperCase()}
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-gray-900">
              닉네임: <span className="font-semibold">{displayNickname}</span>
            </p>
            <p className="text-[var(--muted)]">이메일: {displayEmail}</p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <label className="block text-xs font-semibold text-[var(--muted)]">
            닉네임 수정
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="표시할 닉네임을 입력하세요"
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus-visible:shadow-[var(--ring)]"
            />
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="rounded-2xl border border-[var(--border)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
            >
              {savingProfile ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </section>

      {/* ✅ 토큰 섹션 (추가) */}
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              내 토큰 잔액
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              웹에서 발급 신청(1회) 후, MetaMask에 토큰을 추가하거나 전송할 수
              있습니다.
            </p>
          </div>

          <div className="text-right">
            <div className="text-sm text-[var(--muted)]">지갑 주소</div>
            <div className="font-mono text-sm text-gray-900 break-all">
              {walletAddr || '-'}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-2xl font-semibold text-gray-900">
            {Number(tokenBalance || '0').toFixed(4)} {tokenSymbol}
          </div>
          <div className="text-sm text-[var(--muted)]">
            1회 지급량: {dropAmount ?? '-'} {tokenSymbol} · 남은 드랍:{' '}
            {faucetRemaining} {tokenSymbol}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!tokenClaimed ? (
            <button
              type="button"
              onClick={handleClaimToken}
              disabled={tokenBusy}
              className="rounded-2xl border border-[var(--border)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
            >
              {tokenBusy ? '발급 중...' : '토큰 발급 신청(1회)'}
            </button>
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-gray-900">
              이미 발급받은 지갑입니다.
            </div>
          )}

          <button
            type="button"
            onClick={() => walletAddr && refreshTokenInfo(walletAddr)}
            disabled={tokenBusy || !walletAddr}
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition disabled:opacity-60"
          >
            새로고침
          </button>

          <button
            type="button"
            onClick={handleAddTokenToMetaMask}
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition"
          >
            MetaMask에 {tokenSymbol} 추가
          </button>

          {walletAddr ? (
            <a
              href={getSepoliaTokenLink(walletAddr)}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition"
            >
              Explorer에서 보기
            </a>
          ) : null}
        </div>

        {tokenTx ? (
          <div className="text-sm">
            최근 트랜잭션:{' '}
            <a
              className="underline"
              href={getSepoliaTxLink(tokenTx)}
              target="_blank"
              rel="noreferrer"
            >
              {tokenTx}
            </a>
          </div>
        ) : null}

        {/* ✅ 받은 뒤에도 할 수 있는 기능: 전송 */}
        <div className="pt-4 border-t border-[var(--border)]">
          <div className="text-sm font-semibold text-gray-900 mb-2">
            {tokenSymbol} 전송
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              placeholder="받는 주소 (0x...)"
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus-visible:shadow-[var(--ring)]"
            />
            <input
              value={sendAmt}
              onChange={(e) => setSendAmt(e.target.value)}
              placeholder="수량 (예: 1.5)"
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus-visible:shadow-[var(--ring)]"
            />
            <button
              type="button"
              onClick={handleTransferToken}
              disabled={tokenBusy}
              className="rounded-2xl border border-[var(--border)] bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {tokenBusy ? '처리 중...' : '전송하기'}
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            전송 트랜잭션은 되돌릴 수 없습니다. 주소를 꼭 확인하세요.
          </p>
        </div>
      </section>

      {/* 보유 NFT */}
      <section className="space-y-3">
        <SectionHeader
          title="보유 NFT"
          count={ownedNFTs.length}
          desc="지갑 주소 기준으로 온체인 보유 목록을 조회합니다."
          action={
            ownedNFTs.length > MAX_PREVIEW ? (
              <ToggleMoreButton
                open={showAllOwned}
                onClick={() => setShowAllOwned((v) => !v)}
              />
            ) : null
          }
        />

        {ownedNFTs.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
            연결된 지갑에 보유한 NFT가 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {visibleOwnedNFTs.map((nft) => (
              <TileCard
                key={nft.id}
                imageUrl={nft.imageUrl}
                title={`Token #${nft.tokenId}`}
                subtitle="Owned (On-chain)"
                meta={nft.metadataURI || 'metadataURI 없음'}
              />
            ))}
          </div>
        )}
      </section>

      {/* 구매 내역 */}
      <section className="space-y-3">
        <SectionHeader
          title="구매 내역"
          count={purchases.length}
          desc="Firestore에 기록된 구매 로그입니다."
          action={
            purchases.length > MAX_PREVIEW ? (
              <ToggleMoreButton
                open={showAllPurchases}
                onClick={() => setShowAllPurchases((v) => !v)}
              />
            ) : null
          }
        />

        {purchases.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
            구매 내역이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {visiblePurchases.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    Listing: {p.listingId} · Token #{p.tokenId}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    가격: {p.price} ETH
                  </p>
                  {p.purchasedAt && (
                    <p className="mt-1 text-xs text-[var(--muted)]">
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

                {p.txHash ? (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${p.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition"
                  >
                    거래 상세
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 내가 등록한 작품 */}
      <section className="space-y-3">
        <SectionHeader
          title="등록한 작품"
          count={myListings.length}
          desc="Firestore listings 컬렉션 기준으로 내 등록 목록을 조회합니다."
          action={
            myListings.length > MAX_PREVIEW ? (
              <ToggleMoreButton
                open={showAllMyListings}
                onClick={() => setShowAllMyListings((v) => !v)}
              />
            ) : null
          }
        />

        {myListings.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
            등록한 작품이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {visibleMyListings.map((item) => (
              <TileCard
                key={item.id}
                imageUrl={item.imageUrl}
                title={item.title || '제목 없음'}
                subtitle={item.sold ? '상태: 판매완료' : '상태: 판매중'}
                meta={`가격: ${item.price} ETH`}
                badge={item.sold ? 'SOLD' : 'LISTED'}
                onClick={() => router.push(`/listings/${item.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 찜한 작품 */}
      <section className="space-y-3 mb-8">
        <SectionHeader
          title="찜한 작품"
          count={likedItems.length}
          desc="내가 찜한 목록입니다."
          action={
            likedItems.length > MAX_PREVIEW ? (
              <ToggleMoreButton
                open={showAllLikes}
                onClick={() => setShowAllLikes((v) => !v)}
              />
            ) : null
          }
        />

        {likedItems.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
            찜한 작품이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {visibleLikes.map((item) => (
              <TileCard
                key={item.id}
                imageUrl={item.imageUrl}
                title={item.title || '제목 없음'}
                subtitle="Liked"
                meta={`가격: ${item.price} ETH`}
                onClick={() => router.push(`/listings/${item.id}`)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
