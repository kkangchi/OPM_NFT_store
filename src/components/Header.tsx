'use client';

import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

export default function Header() {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const [q, setQ] = useState('');

  const { user, logout } = useAuth();

  // URL 쿼리(q)를 input 값과 동기화
  useEffect(() => {
    const qParam = params.get('q') ?? '';
    setQ(qParam);
  }, [params]);

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = q.trim();
    const url = query ? `/?q=${encodeURIComponent(query)}` : '/';
    router.push(url);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
      <div className="mx-auto max-w-[1100px] px-4 py-3 grid grid-cols-[auto_1fr_auto] gap-4 items-center">
        {/* 로고 */}
        <Link href="/" className="flex items-center gap-2">
          <span className="rounded-lg bg-violet-700 px-2.5 py-1 text-white font-extrabold tracking-wide">
            OPM
          </span>
          <span className="text-violet-700 font-semibold leading-none">
            스토어
          </span>
        </Link>

        {/* 검색 */}
        <form
          onSubmit={onSearch}
          className="flex items-center gap-2 border-2 border-violet-700 rounded-full px-3 py-1.5"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="상품명 또는 브랜드 입력"
            aria-label="검색어 입력"
            className="flex-1 outline-none text-sm leading-none"
          />
          <button
            type="submit"
            className="text-sm font-semibold text-violet-700 leading-none"
          >
            검색
          </button>
        </form>

        {/* 우측 메뉴 */}
        <nav className="flex items-center justify-end gap-5 text-sm leading-none whitespace-nowrap">
          <Link href="/mypage" className={navBtnClass(pathname === '/mypage')}>
            마이페이지
          </Link>

          <Link
            href="/listings/new"
            className={navBtnClass(pathname === '/listings/new')}
          >
            작품 등록
          </Link>

          <Link href="/cart" className={navBtnClass(pathname === '/cart')}>
            장바구니
          </Link>

          {user ? (
            <button onClick={handleLogout} className={navBtnClass(false)}>
              로그아웃
            </button>
          ) : (
            <Link href="/login" className={navBtnClass(pathname === '/login')}>
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function navBtnClass(active: boolean) {
  const base =
    'px-3 py-1.5 rounded-full border font-semibold transition text-sm';
  const activeCls = 'border-violet-700 text-white bg-violet-700';
  const inactiveCls =
    'border-violet-700 text-violet-700 hover:bg-violet-700 hover:text-white';

  return `${base} ${active ? activeCls : inactiveCls}`;
}
