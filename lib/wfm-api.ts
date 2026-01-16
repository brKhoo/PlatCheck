// Warframe.market API utils

// Item endpoint uses v2, statistics and orders use v1
const API_BASE_V2 = "https://api.warframe.market/v2";
const API_BASE_V1 = "https://api.warframe.market/v1";

export interface WFMItem {
  item_name: string;
  url_name: string;
  id?: string;
  thumb?: string;
}

export interface WFMStatistics {
  datetime: string;
  volume?: number;
  min_price?: number;
  max_price?: number;
  open_price?: number;
  closed_price?: number;
  avg_price?: number;
  wa_price?: number;
  median?: number;
  moving_avg?: number;
  donch_top?: number;
  donch_bot?: number;
  id?: string;
}

export interface WFMSnapshot {
  best_sell?: number;
  best_buy?: number;
  spread?: number;
}

// Get items from Warframe.market API
export async function fetchItems(): Promise<WFMItem[]> {
  try {
    const response = await fetch(`${API_BASE_V2}/items`);
    if (!response.ok) {
      throw new Error(`Failed to fetch items: ${response.statusText}`);
    }
    const data = await response.json();
    const items = data.data || [];
    // Transform to match expected format
    return items.map((item: any) => ({
      item_name: item.i18n?.en?.name || item.slug,
      url_name: item.slug,
      id: item.id,
      thumb: item.i18n?.en?.thumb,
    }));
  } catch (error) {
    console.error("Error fetching items:", error);
    return [];
  }
}

// Get item stats
export async function fetchItemStatistics(
  urlName: string,
  platform: string = "pc"
): Promise<WFMStatistics[]> {
  try {
    // Stats endpoint uses v1 API
    const response = await fetch(
      `${API_BASE_V1}/items/${urlName}/statistics?platform=${platform}`
    );
    if (!response.ok) {
      if (response.status === 404) {
        // Item might not have any stats yet
        return [];
      }
      throw new Error(`Failed to fetch statistics: ${response.statusText}`);
    }
    const data = await response.json();
    const payload = data.payload || {};
    const statsClosed = payload.statistics_closed || {};
    return statsClosed["90days"] || [];
  } catch (error) {
    console.error("Error fetching statistics:", error);
    return [];
  }
}

// Get current orders for an item
export async function fetchItemOrders(
  urlName: string,
  platform: string = "pc"
): Promise<WFMSnapshot> {
  try {
    // Orders endpoint uses v1
    const response = await fetch(
      `${API_BASE_V1}/items/${urlName}/orders?platform=${platform}`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.statusText}`);
    }
    const data = await response.json();
    
    const payload = data.payload || {};
    const orders = payload.orders || [];
    const sellOrders = orders
      .filter((o: any) => o.order_type === "sell" && o.visible && o.user?.status === "ingame")
      .map((o: any) => o.platinum)
      .sort((a: number, b: number) => a - b);
    
    const buyOrders = orders
      .filter((o: any) => o.order_type === "buy" && o.visible && o.user?.status === "ingame")
      .map((o: any) => o.platinum)
      .sort((a: number, b: number) => b - a);
    
    const bestSell = sellOrders.length > 0 ? sellOrders[0] : undefined;
    const bestBuy = buyOrders.length > 0 ? buyOrders[0] : undefined;
    const spread = bestSell && bestBuy ? bestSell - bestBuy : undefined;
    
    return {
      best_sell: bestSell,
      best_buy: bestBuy,
      spread,
    };
  } catch (error) {
    console.error("Error fetching orders:", error);
    return {};
  }
}

// Calculate median prices for the different time intervals
export function calculateTrends(
  statistics: WFMStatistics[]
): {
  median_1d: number | null;
  median_7d: number | null;
  median_30d: number | null;
} {
  if (statistics.length === 0) {
    return {
      median_1d: null,
      median_7d: null,
      median_30d: null,
    };
  }

  // Sort by datetime (newest first)
  const sorted = [...statistics].sort(
    (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
  );

  // Filter out items with no median or low volume 
  const validStats = sorted.filter(
    (s) =>
      s.median !== undefined &&
      s.median !== null &&
      (s.volume === undefined || s.volume >= 1) // At least 1 trade
  );

  if (validStats.length === 0) {
    return {
      median_1d: null,
      median_7d: null,
      median_30d: null,
    };
  }

  // Calculate 1-day: Use most recent day or weighted average of last 1-2 days if volume is low
  const median_1d = calculateWeightedMedian(validStats.slice(0, Math.min(2, validStats.length)));

  // Calculate 7-day: Use volume-weighted median of last 7 days
  const median_7d = calculateWeightedMedian(
    validStats.slice(0, Math.min(7, validStats.length))
  );

  // Calculate 30-day: Use volume-weighted median of last 30 days
  const median_30d = calculateWeightedMedian(
    validStats.slice(0, Math.min(30, validStats.length))
  );

  return {
    median_1d,
    median_7d,
    median_30d,
  };
}

function calculateWeightedMedian(stats: WFMStatistics[]): number {
  if (stats.length === 0) return 0;
  const withVolume = stats.filter((s) => s.volume !== undefined && s.volume > 0);
  if (withVolume.length > 0) {
    const weightedPrices: number[] = [];
    for (const stat of withVolume) {
      const repeatCount = Math.min(stat.volume || 1, 100);
      for (let i = 0; i < repeatCount; i++) weightedPrices.push(stat.median!);
    }
    if (weightedPrices.length > 0) return calculateSimpleMedian(weightedPrices);
  }
  const prices = stats.map((s) => s.median!).filter((p) => p !== undefined && p !== null);
  return calculateSimpleMedian(prices);
}

function calculateSimpleMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const filtered = removeOutliers(values);
  const sorted = [...filtered].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function removeOutliers(values: number[]): number[] {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  return values.filter((v) => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
}
