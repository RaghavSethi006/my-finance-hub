import type { Asset, AssetPriceSyncUpdate, Currency } from './types';

type MarketSyncResult = {
  updates: AssetPriceSyncUpdate[];
  warnings: string[];
};

const COINGECKO_IDS: Record<string, string> = {
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  BNB: 'binancecoin',
  BTC: 'bitcoin',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  ETH: 'ethereum',
  LINK: 'chainlink',
  LTC: 'litecoin',
  MATIC: 'matic-network',
  SHIB: 'shiba-inu',
  SOL: 'solana',
  TRX: 'tron',
  UNI: 'uniswap',
  USDC: 'usd-coin',
  USDT: 'tether',
  XRP: 'ripple',
};

const EXCHANGE_SUFFIXES: Record<string, string> = {
  AMEX: 'us',
  ARCA: 'us',
  ASX: 'au',
  BSE: 'in',
  CBOE: 'us',
  LSE: 'uk',
  NASDAQ: 'us',
  NSE: 'in',
  NYSE: 'us',
  TSX: 'ca',
  TSXV: 'ca',
};

function isoTimestamp(date = new Date()): string {
  return date.toISOString();
}

function isTrackableAsset(asset: Asset): boolean {
  return (
    (asset.type === 'crypto' && !!asset.ticker?.trim()) ||
    ((asset.type === 'stock' || asset.type === 'mutual_fund') && !!asset.ticker?.trim())
  );
}

function mapCurrency(currency: Currency): string {
  return currency.toLowerCase();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return response.text();
}

async function fetchThroughProxy(url: string): Promise<string> {
  return fetchText(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
}

async function fetchCryptoPrices(assets: Asset[]): Promise<MarketSyncResult> {
  const grouped = new Map<Currency, { asset: Asset; coinId: string }[]>();
  const warnings: string[] = [];

  assets.forEach((asset) => {
    const ticker = asset.ticker?.trim().toUpperCase();
    const coinId = ticker ? COINGECKO_IDS[ticker] : undefined;
    if (!ticker || !coinId) {
      warnings.push(`No CoinGecko mapping found for crypto asset "${asset.name}".`);
      return;
    }

    const current = grouped.get(asset.currency) ?? [];
    current.push({ asset, coinId });
    grouped.set(asset.currency, current);
  });

  const updates: AssetPriceSyncUpdate[] = [];
  await Promise.all(
    [...grouped.entries()].map(async ([currency, entries]) => {
      const ids = [...new Set(entries.map((entry) => entry.coinId))];
      const payload = await fetchJson<Record<string, Record<string, number>>>(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=${mapCurrency(currency)}`
      );

      entries.forEach(({ asset, coinId }) => {
        const price = payload[coinId]?.[mapCurrency(currency)];
        if (typeof price !== 'number' || !Number.isFinite(price)) {
          warnings.push(`Crypto quote unavailable for "${asset.name}".`);
          return;
        }

        updates.push({
          assetId: asset.id,
          price,
          note: `Live sync via CoinGecko (${asset.ticker?.toUpperCase()})`,
          syncedAt: isoTimestamp(),
        });
      });
    })
  );

  return { updates, warnings };
}

function buildStooqSymbol(asset: Asset): string | undefined {
  const ticker = asset.ticker?.trim();
  if (!ticker) {
    return undefined;
  }

  if (ticker.includes('.')) {
    return ticker.toLowerCase();
  }

  const suffix = asset.exchange ? EXCHANGE_SUFFIXES[asset.exchange.trim().toUpperCase()] : 'us';
  return `${ticker.toLowerCase()}.${suffix}`;
}

function parseStooqTimestamp(date: string, time: string): string {
  if (!date || date.toLowerCase() === 'n/a') {
    return isoTimestamp();
  }

  const normalizedTime = time && time.toLowerCase() !== 'n/a' ? time : '16:00:00';
  const localDate = new Date(`${date}T${normalizedTime}`);
  return Number.isNaN(localDate.getTime()) ? isoTimestamp() : localDate.toISOString();
}

async function fetchStooqPrice(asset: Asset): Promise<{ price: number; syncedAt: string } | undefined> {
  const symbol = buildStooqSymbol(asset);
  if (!symbol) {
    return undefined;
  }

  const csv = await fetchThroughProxy(`https://stooq.com/q/l/?s=${symbol}&f=sd2t2ohlcvn&i=d`);
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return undefined;
  }

  const values = lines[1].split(',');
  const close = Number(values[6]);
  return Number.isFinite(close)
    ? {
        price: close,
        syncedAt: parseStooqTimestamp(values[1], values[2]),
      }
    : undefined;
}

async function fetchIndianMutualFundPrice(asset: Asset): Promise<{ price: number; syncedAt: string } | undefined> {
  const ticker = asset.ticker?.trim();
  if (!ticker || !/^\d{5,6}$/.test(ticker)) {
    return undefined;
  }

  const payload = await fetchJson<{ data?: { nav?: string }[] }>(`https://api.mfapi.in/mf/${ticker}`);
  const nav = payload.data?.[0]?.nav ? Number(payload.data[0].nav) : undefined;
  return typeof nav === 'number' && Number.isFinite(nav) ? { price: nav, syncedAt: isoTimestamp() } : undefined;
}

async function fetchSecurityPrices(assets: Asset[]): Promise<MarketSyncResult> {
  const updates: AssetPriceSyncUpdate[] = [];
  const warnings: string[] = [];

  await Promise.all(
    assets.map(async (asset) => {
      try {
        const quote =
          asset.type === 'mutual_fund'
            ? (await fetchIndianMutualFundPrice(asset)) ?? (await fetchStooqPrice(asset))
            : await fetchStooqPrice(asset);

        if (!quote || typeof quote.price !== 'number' || !Number.isFinite(quote.price)) {
          warnings.push(`Market quote unavailable for "${asset.name}".`);
          return;
        }

        updates.push({
          assetId: asset.id,
          price: quote.price,
          note:
            asset.type === 'mutual_fund' && /^\d{5,6}$/.test(asset.ticker?.trim() ?? '')
              ? `Live sync via MFAPI (${asset.ticker})`
              : `Live sync via Stooq (${asset.ticker?.toUpperCase()})`,
          syncedAt: quote.syncedAt,
        });
      } catch {
        warnings.push(`Live quote lookup failed for "${asset.name}".`);
      }
    })
  );

  return { updates, warnings };
}

export async function syncMarketPrices(assets: Asset[]): Promise<MarketSyncResult> {
  const trackable = assets.filter(isTrackableAsset);
  if (trackable.length === 0) {
    return { updates: [], warnings: ['Add a ticker to stocks, mutual funds, or crypto assets to enable live sync.'] };
  }

  const cryptoAssets = trackable.filter((asset) => asset.type === 'crypto');
  const securityAssets = trackable.filter((asset) => asset.type === 'stock' || asset.type === 'mutual_fund');
  const results = await Promise.all([fetchCryptoPrices(cryptoAssets), fetchSecurityPrices(securityAssets)]);

  return {
    updates: results.flatMap((result) => result.updates),
    warnings: results.flatMap((result) => result.warnings),
  };
}
