'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth'
import { auth, googleProvider, githubProvider, db } from '@/lib/firebase'
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  deleteDoc,
} from 'firebase/firestore'

// Context 타입 정의
type AuthContextValue = {
  user: User | null
  loading: boolean
  loginWithGoogle: () => Promise<void>
  loginWithGitHub: () => Promise<void>
  logout: () => Promise<void>
}

// Context 생성
const AuthContext = createContext<AuthContextValue | null>(null)

// Hook: useAuth()
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

// Provider 컴포넌트
export default function AuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Firebase Auth 상태 변화 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      setLoading(false)

      // 로그인된 사용자가 있다면 Firestore에 profile 및 기본 하위 컬렉션 자동 생성
      if (currentUser) {
        const profileRef = doc(db, `users/${currentUser.uid}/profile/info`)

        await setDoc(
          profileRef,
          {
            uid: currentUser.uid,
            email: currentUser.email ?? null,
            displayName: currentUser.displayName ?? null,
            photoURL: currentUser.photoURL ?? null,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        )

        // 하위 컬렉션 구조 자동 세팅 (likes, purchases, sessions)
        const subCollections = ['likes', 'purchases', 'sessions']
        for (const name of subCollections) {
          const colRef = collection(db, `users/${currentUser.uid}/${name}`)
          const dummyDoc = doc(colRef)
          // Firestore는 빈 컬렉션 생성이 불가능하므로 dummy 문서 생성 후 즉시 삭제
          await setDoc(dummyDoc, { _init: true, createdAt: serverTimestamp() })
          await deleteDoc(dummyDoc)
        }
      }
    })

    // 언마운트 시 리스너 해제
    return () => unsubscribe()
  }, [])

  // Google 로그인
  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      console.error('Google login error:', err)
    }
  }

  // GitHub 로그인
  const loginWithGitHub = async () => {
    try {
      await signInWithPopup(auth, githubProvider)
    } catch (err) {
      console.error('GitHub login error:', err)
    }
  }

  // 로그아웃
  const logout = async () => {
    try {
      await signOut(auth)
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      loginWithGoogle,
      loginWithGitHub,
      logout,
    }),
    [user, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
