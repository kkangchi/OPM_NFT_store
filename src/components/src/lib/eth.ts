import { ethers } from 'ethers'

// 🔥 MetaMask 지갑 연결
export async function connectWallet(): Promise<string> {
  if (typeof window === 'undefined') return ''
  if (!window.ethereum) {
    alert('MetaMask가 설치되어 있지 않습니다.')
    return ''
  }

  try {
    const accounts: string[] = await window.ethereum.request({
      method: 'eth_requestAccounts',
    })
    return accounts[0]
  } catch (err) {
    console.error('지갑 연결 실패:', err)
    return ''
  }
}

// 🔥 provider 가져오기
export function getProvider() {
  if (!window.ethereum) throw new Error('MetaMask가 필요합니다.')
  return new ethers.BrowserProvider(window.ethereum)
}

// 🔥 signer 가져오기
export async function getSigner() {
  const provider = getProvider()
  return await provider.getSigner()
}
