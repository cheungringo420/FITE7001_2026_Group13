export function normalizeMarketImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('ipfs://')) {
    const ipfsPath = trimmed.replace('ipfs://', '').replace(/^ipfs\//, '');
    return `https://ipfs.io/ipfs/${ipfsPath}`;
  }

  return trimmed;
}
