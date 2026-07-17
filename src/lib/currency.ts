// Currency conversion utility — uses real-time rates from open.er-api.com

const API_URL = "https://open.er-api.com/v6/latest/USD";

// Fallback rates (used when API fails)
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  CNY: 7.20, HKD: 7.80, TWD: 32.5, JPY: 162, KRW: 1520,
  EUR: 0.92, GBP: 0.75, SGD: 1.29, AUD: 1.44, CAD: 1.42,
  THB: 33.3, VND: 26200, PHP: 61.5, MYR: 4.07, IDR: 17960,
};

// In-memory cache
let cachedRates: Record<string, number> | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 3600_000; // 1 hour

export const CURRENCY_OPTIONS = [
  { code: "USD", symbol: "$", label: "USD ($)" },
  { code: "CNY", symbol: "¥", label: "CNY (¥)" },
  { code: "HKD", symbol: "HK$", label: "HKD (HK$)" },
  { code: "TWD", symbol: "NT$", label: "TWD (NT$)" },
  { code: "JPY", symbol: "¥", label: "JPY (¥)" },
  { code: "KRW", symbol: "₩", label: "KRW (₩)" },
  { code: "EUR", symbol: "€", label: "EUR (€)" },
  { code: "GBP", symbol: "£", label: "GBP (£)" },
  { code: "SGD", symbol: "S$", label: "SGD (S$)" },
  { code: "AUD", symbol: "A$", label: "AUD (A$)" },
  { code: "CAD", symbol: "C$", label: "CAD (C$)" },
  { code: "THB", symbol: "฿", label: "THB (฿)" },
  { code: "VND", symbol: "₫", label: "VND (₫)" },
  { code: "PHP", symbol: "₱", label: "PHP (₱)" },
  { code: "MYR", symbol: "RM", label: "MYR (RM)" },
  { code: "IDR", symbol: "Rp", label: "IDR (Rp)" },
];

// Fetch latest rates from open.er-api.com
async function fetchRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch(API_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.result !== "success" || !data.rates) throw new Error("Invalid response");
    // Convert USD-based rates to inverse (1 XXX = ? USD)
    const rates: Record<string, number> = {};
    for (const [code, rate] of Object.entries(data.rates)) {
      const r = Number(rate);
      if (r > 0) rates[code] = 1 / r; // invert: 1/rate = 1 XXX in USD
    }
    cachedRates = rates;
    lastFetchTime = Date.now();
    return rates;
  } catch {
    // Fallback to hardcoded rates
    return FALLBACK_RATES;
  }
}

// Get cached or fresh rates
async function getRates(): Promise<Record<string, number>> {
  if (cachedRates && Date.now() - lastFetchTime < CACHE_TTL) {
    return cachedRates;
  }
  return fetchRates();
}

// Convert amount from local currency to USD
export async function convertToUSD(amount: number, currency: string): Promise<number> {
  const rates = await getRates();
  const rate = rates[currency.toUpperCase()];
  if (!rate) return amount; // fallback: no conversion
  return Math.round(amount * rate);
}

// Synchronous version using fallback rates (for initial render)
export function convertToUSDSync(amount: number, currency: string): number {
  const rates = cachedRates || FALLBACK_RATES;
  const rate = rates[currency.toUpperCase()];
  if (!rate) return amount;
  return Math.round(amount * rate);
}

export function getCurrencySymbol(currency: string): string {
  const opt = CURRENCY_OPTIONS.find((c) => c.code === currency.toUpperCase());
  return opt?.symbol || "$";
}

// Prefetch rates on page load
export function prefetchRates(): void {
  fetchRates().catch(() => { /* silently fail */ });
}
