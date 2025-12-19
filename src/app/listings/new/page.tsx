'use client';

import { FormEvent, useRef, useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';
import { connectWallet } from '@/lib/eth';

type UploadState = 'idle' | 'uploading' | 'saving' | 'done' | 'error';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function shortAddr(addr: string) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function NewListingPage() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);

  const [walletAddress, setWalletAddress] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { user } = useAuth();

  // 페이지 들어오면 MetaMask 자동 연결
  useEffect(() => {
    async function loadWallet() {
      try {
        const addr = await connectWallet();
        if (addr) setWalletAddress(addr);
      } catch (e) {
        console.log('지갑 자동 연결 실패:', e);
      }
    }
    loadWallet();
  }, []);

  // preview url 해제(메모리 누수 방지)
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleButtonClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) setImagePreview(URL.createObjectURL(file));
    else setImagePreview(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) return setError('로그인해야 작품을 등록할 수 있습니다.');
    if (!walletAddress) return setError('MetaMask 지갑이 연결되어야 합니다.');
    if (!imageFile) return setError('이미지를 업로드해야 합니다.');
    if (!title.trim()) return setError('제목을 입력하세요.');

    try {
      setState('uploading');

      // 1) /api/ipfs로 업로드
      const form = new FormData();
      form.append('image', imageFile);
      form.append('title', title.trim());
      form.append('description', description.trim());
      form.append('price', price.trim());

      const res = await fetch('/api/ipfs', {
        method: 'POST',
        body: form,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'IPFS 업로드 실패');

      const imageURI = data.imageURI;
      const tokenURI = data.tokenURI;

      // 2) Firestore 저장
      setState('saving');

      await addDoc(collection(db, 'listings'), {
        title: title.trim(),
        description: description.trim(),
        price: Number(price) || 0,
        imageURI,
        tokenURI,
        ownerUid: user.uid,
        ownerName: user.displayName ?? null,
        ownerAddress: walletAddress,
        createdAt: serverTimestamp(),
      });

      setState('done');

      // reset
      setTitle('');
      setDescription('');
      setPrice('');
      setImageFile(null);
      setImagePreview(null);

      alert('작품이 등록되었습니다!');
    } catch (err: any) {
      console.error(err);
      setState('error');
      setError(err.message || '등록 실패');
    }
  };

  const busy = state === 'uploading' || state === 'saving';

  return (
    <main className="mx-auto max-w-[900px] px-6 py-10">
      {/* 헤더 */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            NFT 등록
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            이미지와 메타데이터를 IPFS에 업로드하고, listing 정보를 저장합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => (window.location.href = '/')}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition"
        >
          ← 메인으로
        </button>
      </div>

      {/* 지갑 상태 */}
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">지갑 연결</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              등록 시 판매자 주소(ownerAddress)가 함께 저장됩니다.
            </p>
          </div>

          {walletAddress ? (
            <span className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-gray-900">
              {shortAddr(walletAddress)}
            </span>
          ) : (
            <button
              type="button"
              className="rounded-2xl border border-[var(--border)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] transition"
              onClick={async () => {
                const addr = await connectWallet();
                if (addr) setWalletAddress(addr);
              }}
            >
              MetaMask 연결
            </button>
          )}
        </div>
      </section>

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 이미지 */}
        <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">작품 이미지</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                PNG/JPG 등 이미지 파일을 선택하세요.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              title="작품 이미지를 업로드하세요"
            />

            <button
              type="button"
              onClick={handleButtonClick}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition"
            >
              이미지 선택
            </button>
          </div>

          <div className="mt-4">
            {imagePreview ? (
              <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <img
                  src={imagePreview}
                  alt="preview"
                  className="w-full max-w-[360px] aspect-square object-cover"
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center text-sm text-[var(--muted)]">
                선택된 이미지가 없습니다.
              </div>
            )}
          </div>
        </section>

        {/* 메타데이터 */}
        <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)]">
              제목 *
            </label>
            <input
              className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus-visible:shadow-[var(--ring)]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="작품 제목"
              title="작품 제목 입력"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--muted)]">
              설명
            </label>
            <textarea
              className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus-visible:shadow-[var(--ring)] h-28"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="작품 설명"
              title="작품 설명 입력"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--muted)]">
              가격 (ETH)
            </label>
            <input
              className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus-visible:shadow-[var(--ring)]"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.1"
              title="판매 가격 입력"
              inputMode="decimal"
            />
          </div>
        </section>

        {/* 에러 */}
        {error ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-gray-900">
            <span className="font-semibold">오류:</span>{' '}
            <span className="text-[var(--muted)]">{error}</span>
          </div>
        ) : null}

        {/* 제출 */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className={cx(
              'rounded-2xl border border-[var(--border)] px-5 py-2.5 text-sm font-semibold transition',
              busy
                ? 'bg-[var(--surface)] text-[var(--muted)]'
                : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]'
            )}
          >
            {state === 'uploading'
              ? 'IPFS 업로드 중...'
              : state === 'saving'
              ? '저장 중...'
              : '등록'}
          </button>

          <span className="text-sm text-[var(--muted)]">
            등록 후 상세 페이지에서 거래를 진행할 수 있습니다.
          </span>
        </div>
      </form>
    </main>
  );
}
