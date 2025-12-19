'use client';

import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
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

  const navItems = useMemo(
    () => [
      { href: '/mypage', label: '내 자산' },
      { href: '/listings/new', label: 'NFT 등록' },
      { href: '/cart', label: '보관함' },
    ],
    []
  );

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-[1200px] px-6 py-4 flex items-center gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <div className="h-9 w-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm grid place-items-center">
            <span className="text-[13px] font-extrabold tracking-[0.18em] text-[var(--accent-strong)]">
              TB
            </span>
          </div>

          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-gray-900">
              Token-Based Market
            </div>
            <div className="text-xs text-[var(--muted)]">
              ERC-20 결제 NFT 마켓플레이스
            </div>
          </div>
        </Link>

        {/* Search */}
        <form
          onSubmit={onSearch}
          className="flex-1 max-w-[540px] hidden md:flex"
        >
          <div className="w-full flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-sm">
            <span className="text-[var(--muted)] text-sm select-none">⌕</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="NFT 이름으로 검색"
              aria-label="검색어 입력"
              className="w-full bg-transparent outline-none text-sm text-gray-900 placeholder:text-[var(--muted)]"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] transition"
            >
              검색
            </button>
          </div>
        </form>

        {/* Nav */}
        <nav className="ml-auto flex items-center gap-2 whitespace-nowrap">
          {/* 모바일: 검색 버튼(간단) */}
          <button
            type="button"
            onClick={() =>
              router.push(
                q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : '/'
              )
            }
            className="md:hidden rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm hover:border-[var(--accent)] transition"
            aria-label="검색으로 이동"
          >
            ⌕
          </button>

          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={navPillClass(pathname === item.href)}
            >
              {item.label}
            </Link>
          ))}

          <div className="w-px h-7 bg-[var(--border)] mx-1 hidden sm:block" />

          {user ? (
            <button onClick={handleLogout} className={navGhostClass()}>
              로그아웃
            </button>
          ) : (
            <Link
              href="/login"
              className={navPrimaryClass(pathname === '/login')}
            >
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

/** 무채색 pill 네비 */
function navPillClass(active: boolean) {
  const base =
    'hidden sm:inline-flex items-center rounded-2xl px-3 py-2 text-sm font-semibold transition border';
  const activeCls =
    'border-[var(--accent)] bg-[var(--surface)] text-[var(--accent-strong)]';
  const inactiveCls =
    'border-transparent text-gray-700 hover:border-[var(--border)] hover:bg-[var(--surface)]';

  return `${base} ${active ? activeCls : inactiveCls}`;
}

/** 기본(텍스트) 버튼 */
function navGhostClass() {
  return 'inline-flex items-center rounded-2xl px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-[var(--surface)] hover:text-gray-900 transition border border-transparent hover:border-[var(--border)]';
}

/** 포인트(회청) 버튼 */
function navPrimaryClass(active: boolean) {
  const base =
    'inline-flex items-center rounded-2xl px-3 py-2 text-sm font-semibold transition border';
  const activeCls = 'border-[var(--accent)] bg-[var(--accent)] text-white';
  const inactiveCls =
    'border-[var(--border)] bg-white text-gray-900 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]';

  return `${base} ${active ? activeCls : inactiveCls}`;
}
