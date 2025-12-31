'use client'

import { FormEvent, useRef, useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '@/components/AuthProvider'
import { connectWallet } from '@/lib/eth'

type UploadState = 'idle' | 'uploading' | 'saving' | 'done' | 'error'

export default function NewListingPage() {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [state, setState] = useState<UploadState>('idle')
  const [error, setError] = useState<string | null>(null)

  const [walletAddress, setWalletAddress] = useState<string>('')

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { user } = useAuth()

  // 🔥 페이지 들어오면 MetaMask 자동 연결
  useEffect(() => {
    async function loadWallet() {
      try {
        const addr = await connectWallet()
        if (addr) setWalletAddress(addr)
      } catch (e) {
        console.log('지갑 자동 연결 실패:', e)
      }
    }
    loadWallet()
  }, [])

  const handleButtonClick = () => fileInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setImageFile(file)
    if (file) setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!user) return setError('로그인해야 작품을 등록할 수 있습니다.')
    if (!walletAddress) return setError('MetaMask 지갑이 연결되어야 합니다.')
    if (!imageFile) return setError('이미지를 업로드해야 합니다.')
    if (!title.trim()) return setError('제목을 입력하세요.')

    try {
      setState('uploading')

      // ========================
      // 🔥 1) /api/ipfs로 한번에 업로드
      // ========================
      const form = new FormData()
      form.append('image', imageFile)
      form.append('title', title.trim())
      form.append('description', description.trim())
      form.append('price', price.trim())

      const res = await fetch('/api/ipfs', {
        method: 'POST',
        body: form,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'IPFS 업로드 실패')

      const imageURI = data.imageURI // ipfs://CID 이미지
      const tokenURI = data.tokenURI // ipfs://CID metadata.json

      // ========================
      // 🔥 2) Firestore 저장
      // ========================
      setState('saving')

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
      })

      setState('done')

      // reset
      setTitle('')
      setDescription('')
      setPrice('')
      setImageFile(null)
      setImagePreview(null)

      alert('작품이 등록되었습니다!')
    } catch (err: any) {
      console.error(err)
      setState('error')
      setError(err.message || '등록 실패')
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">작품 등록</h1>
        <a href="/" className="text-sm underline">
          메인으로
        </a>
      </header>

      {/* 🔥 MetaMask 지갑 표시 */}
      <div className="mb-4">
        {walletAddress ? (
          <p className="text-sm text-green-600">
            지갑 연결됨: {walletAddress.slice(0, 6)}...
            {walletAddress.slice(-4)}
          </p>
        ) : (
          <button
            type="button"
            className="px-4 py-2 bg-orange-500 text-white rounded"
            onClick={async () => {
              const addr = await connectWallet()
              setWalletAddress(addr)
            }}
          >
            MetaMask 지갑 연결
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 이미지 업로드 */}
        <div>
          <label className="block text-sm mb-1">작품 이미지 *</label>
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
            className="px-4 py-2 mb-2 bg-violet-700 text-white text-sm rounded-md"
          >
            이미지 선택하기
          </button>

          {imagePreview && (
            <img
              src={imagePreview}
              alt="preview"
              className="w-40 h-40 object-cover rounded border mt-2"
            />
          )}
        </div>

        {/* 제목 */}
        <div>
          <label className="block text-sm mb-1">제목 *</label>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="작품 제목"
            title="작품 제목 입력"
          />
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-sm mb-1">설명</label>
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm h-24"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="작품 설명"
            title="작품 설명 입력"
          />
        </div>

        {/* 가격 */}
        <div>
          <label className="block text-sm mb-1">가격 (ETH)</label>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.1"
            title="판매 가격 입력"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={state === 'uploading' || state === 'saving'}
          className="px-4 py-2 rounded-md bg-black text-white text-sm"
        >
          {state === 'uploading'
            ? 'IPFS 업로드 중...'
            : state === 'saving'
            ? '저장 중...'
            : '등록'}
        </button>
      </form>
    </main>
  )
}
