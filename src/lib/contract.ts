import { ethers } from 'ethers';
import ABI from './abi.json';
import ERC20_ABI_JSON from './erc20Abi.json';
import { CONTRACT_ADDRESS, TOKEN_ADDRESS } from './constants';

/** ✅ ERC20 ABI가 배열이든 { abi: [...] }든 자동으로 맞춰줌 */
const ERC20_ABI: any = (ERC20_ABI_JSON as any).abi ?? (ERC20_ABI_JSON as any);

/** ipfs://CID → https 게이트웨이 URL */
export function ipfsToHttp(uri: string | undefined): string {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) {
    const cid = uri.replace('ipfs://', '');
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }
  return uri;
}

/** 브라우저의 MetaMask provider 가져오기 */
export function getProvider() {
  if (typeof window === 'undefined') return null;
  const { ethereum } = window as any;
  if (!ethereum) {
    alert('MetaMask가 설치되어 있지 않습니다.');
    return null;
  }
  return new ethers.BrowserProvider(ethereum);
}

/** ✅ 현재 연결된 지갑 주소 */
export async function getCurrentWalletAddress() {
  const provider = getProvider();
  if (!provider) throw new Error('MetaMask가 설치되어 있지 않습니다.');
  const signer = await provider.getSigner();
  return await signer.getAddress();
}

/** =========================
 *  (A) 기존 마켓 컨트랙트 인스턴스
 *  ========================= */
export async function getContract() {
  const provider = getProvider();
  if (!provider) throw new Error('MetaMask가 설치되어 있지 않습니다.');
  const signer = await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}

/** 🔥 구매하기 = purchase(seller, metadataURI)  (현재: ETH 결제 방식 유지) */
export async function purchaseNFT(
  seller: string,
  metadataURI: string,
  priceEth: string
) {
  const contract = await getContract();
  const tx = await contract.purchase(seller, metadataURI, {
    value: ethers.parseEther(priceEth),
  });
  return await tx.wait();
}

/** 🔥 관리자 mint(to, metadataURI) */
export async function mintNFT(to: string, metadataURI: string) {
  const contract = await getContract();
  const tx = await contract.mint(to, metadataURI);
  return await tx.wait();
}

/** 🔥 NFT 전송 */
export async function transferNFT(to: string, tokenId: number) {
  const contract = await getContract();
  const tx = await contract.transferNFT(to, tokenId);
  return await tx.wait();
}

/** (선택) tokenURI 수정 */
export async function updateTokenURI(tokenId: number, metadataURI: string) {
  const contract = await getContract();
  const tx = await contract.updateTokenURI(tokenId, metadataURI);
  return await tx.wait();
}

/**
 * ✅ 온체인에서 특정 주소 보유 NFT 목록 조회
 */
export async function getOwnedNFTsOnChainByAddress(ownerAddress: string) {
  const contract = await getContract();

  const tokenIdBigints: bigint[] = await contract.tokensOfOwner(ownerAddress);
  const results: {
    tokenId: number;
    metadataURI: string;
    imageUrl: string;
    rawMetadata?: any;
  }[] = [];

  for (const idBn of tokenIdBigints) {
    const tokenId = Number(idBn);

    try {
      const metadataURI: string = await contract.tokenURI(tokenId);
      const metaUrl = ipfsToHttp(metadataURI);

      let imageUrl = '';
      let rawMetadata: any = null;

      try {
        const res = await fetch(metaUrl);
        if (res.ok) {
          const bodyText = await res.text();
          const trimmed = bodyText.trim();

          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
              const meta = JSON.parse(trimmed);
              rawMetadata = meta;
              const imgField = (meta as any).image || (meta as any).image_url;
              if (typeof imgField === 'string') {
                imageUrl = ipfsToHttp(imgField);
              } else {
                imageUrl = metaUrl;
              }
            } catch (jsonErr) {
              console.warn(
                `토큰 ${tokenId} JSON 파싱 실패, tokenURI를 이미지로 사용`,
                jsonErr
              );
              imageUrl = metaUrl;
            }
          } else {
            imageUrl = metaUrl;
          }
        } else {
          imageUrl = metaUrl;
        }
      } catch (e) {
        console.warn(`토큰 ${tokenId} 메타데이터 로딩 실패`, e);
        imageUrl = metaUrl;
      }

      results.push({
        tokenId,
        metadataURI,
        imageUrl,
        rawMetadata,
      });
    } catch (err) {
      console.error(`tokenURI(${tokenId}) 조회 실패`, err);
    }
  }

  return results;
}

/** =========================
 *  (B) ✅ ERC-20 토큰 컨트랙트 인스턴스 + Faucet 기능
 *  ========================= */

/** signer 포함 ERC-20 (claim/approve/transfer 등 트랜잭션용) */
export async function getTokenContract() {
  const provider = getProvider();
  if (!provider) throw new Error('MetaMask가 설치되어 있지 않습니다.');
  const signer = await provider.getSigner();
  return new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);
}

/** provider-only ERC-20 (조회용: balanceOf/claimed/dropAmount 등) */
export function getTokenContractReadOnly() {
  const provider = getProvider();
  if (!provider) throw new Error('MetaMask가 설치되어 있지 않습니다.');
  return new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);
}

/** ✅ 토큰 받기(드랍) */
export async function claimToken() {
  const token = await getTokenContract();

  // ABI/컨트랙트 불일치 안전 처리
  if (typeof (token as any).claim !== 'function') {
    throw new Error(
      'ERC-20 ABI에 claim()이 없습니다. erc20Abi.json이 올바른지 확인하세요.'
    );
  }

  const tx = await token.claim();
  return await tx.wait();
}

/** ✅ 한 번이라도 claim 했는지 */
export async function hasClaimed(address: string) {
  const token = getTokenContractReadOnly();
  if (typeof (token as any).claimed !== 'function') return false;
  return (await token.claimed(address)) as boolean;
}

/** ✅ 토큰 잔액 조회 (raw bigint) */
export async function getTokenBalanceRaw(address: string) {
  const token = getTokenContractReadOnly();
  return (await token.balanceOf(address)) as bigint;
}

/** ✅ 토큰 잔액 조회 (사람이 읽기 쉬운 문자열) */
export async function getTokenBalance(address: string) {
  const token = getTokenContractReadOnly();

  const [bal, decimalsRaw] = await Promise.all([
    token.balanceOf(address) as Promise<bigint>,
    token.decimals() as Promise<bigint | number>,
  ]);

  const decimals = Number(decimalsRaw);
  return ethers.formatUnits(bal, decimals);
}

/** ✅ 토큰 symbol 조회 (UI 표시용) */
export async function getTokenSymbol() {
  const token = getTokenContractReadOnly();
  return (await token.symbol()) as string;
}

/** ✅ 드랍 수량(dropAmount) 조회 (UI에 “1회 지급량” 표시용) */
export async function getDropAmount() {
  const token = getTokenContractReadOnly();
  if (typeof (token as any).dropAmount !== 'function') return null;

  const [amt, decimalsRaw] = await Promise.all([
    token.dropAmount() as Promise<bigint>,
    token.decimals() as Promise<bigint | number>,
  ]);

  const decimals = Number(decimalsRaw);
  return ethers.formatUnits(amt, decimals); // string
}

/** ✅ 컨트랙트에 남은 드랍 물량(컨트랙트 보유 잔액) */
export async function getFaucetRemaining() {
  const token = getTokenContractReadOnly();

  const [bal, decimalsRaw] = await Promise.all([
    token.balanceOf(TOKEN_ADDRESS) as Promise<bigint>, // 컨트랙트 자신 주소의 잔액
    token.decimals() as Promise<bigint | number>,
  ]);

  const decimals = Number(decimalsRaw);
  return ethers.formatUnits(bal, decimals); // string
}

/** ✅ 마켓 결제 대비 approve (향후 ERC-20 결제 구매에 사용 가능) */
export async function approveToken(spender: string, amountRaw: bigint) {
  const token = await getTokenContract();
  const tx = await token.approve(spender, amountRaw);
  return await tx.wait();
}

/** ✅ (추가) 토큰 전송: “이미 받음” 이후에도 할 수 있는 행동 제공 */
export async function transferToken(to: string, amountHuman: string) {
  const token = await getTokenContract();
  if (typeof (token as any).transfer !== 'function') {
    throw new Error('ERC-20 ABI에 transfer()가 없습니다.');
  }

  const decimalsRaw = (await token.decimals()) as bigint | number;
  const decimals = Number(decimalsRaw);
  const value = ethers.parseUnits(amountHuman, decimals);

  const tx = await token.transfer(to, value);
  return await tx.wait();
}

/** ✅ (추가) MetaMask에 토큰 추가 버튼용 */
export async function addTokenToMetaMask() {
  if (typeof window === 'undefined')
    throw new Error('브라우저 환경이 아닙니다.');
  const { ethereum } = window as any;
  if (!ethereum?.request) throw new Error('MetaMask가 설치되어 있지 않습니다.');

  const token = getTokenContractReadOnly();

  const [symbol, decimalsRaw] = await Promise.all([
    token.symbol() as Promise<string>,
    token.decimals() as Promise<bigint | number>,
  ]);

  const decimals = Number(decimalsRaw);

  // MetaMask 표준 메서드
  await ethereum.request({
    method: 'wallet_watchAsset',
    params: {
      type: 'ERC20',
      options: {
        address: TOKEN_ADDRESS,
        symbol,
        decimals,
        // image: 'https://...png'  // 필요하면 추가
      },
    },
  });
}

/** ✅ (추가) 토큰/트랜잭션 확인용 Etherscan 링크 생성 */
export function getSepoliaTokenLink(holderAddress?: string) {
  if (!holderAddress)
    return `https://sepolia.etherscan.io/token/${TOKEN_ADDRESS}`;
  return `https://sepolia.etherscan.io/token/${TOKEN_ADDRESS}?a=${holderAddress}`;
}

export function getSepoliaTxLink(txHash: string) {
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}
