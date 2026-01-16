//ML Model utilities for fair price calculation
export interface ModelData {
  intercept: number;
  coefficients: {
    median_1d: number;
    median_7d: number;
    median_30d: number;
  };
  model: string;
  trained_at: string;
  training_samples?: number;
  items_used?: number;
  r2_score?: number;
}

export interface Trends {
  median_1d: number | null;
  median_7d: number | null;
  median_30d: number | null;
}

// Load model from JSON file
export async function loadModel(): Promise<ModelData | null> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const modelPath = path.join(process.cwd(), "model", "model.json");
    const data = await fs.readFile(modelPath, "utf-8");
    return JSON.parse(data) as ModelData;
  } catch (error) {
    console.error("Error loading model:", error);
    return null;
  }
}

// Calculate fair price using the model
export function calculateFairPrice(
  model: ModelData,
  trends: Trends,
  snapshot?: { best_sell?: number; best_buy?: number; spread?: number }
): number | null {
  // Check if we have all required trends
  if (
    trends.median_1d === null ||
    trends.median_7d === null ||
    trends.median_30d === null
  ) {
    return null;
  }

  let modelPrediction = model.intercept + model.coefficients.median_1d * trends.median_1d +
    model.coefficients.median_7d * trends.median_7d + model.coefficients.median_30d * trends.median_30d;
  const baselinePrice = trends.median_1d * 0.5 + trends.median_7d * 0.3 + trends.median_30d * 0.2;
  let fairPrice = baselinePrice * 0.6 + modelPrediction * 0.4;

  // Apply madjustments
  if (snapshot) {
    const { best_sell, best_buy, spread } = snapshot;

    if (best_sell !== undefined && best_buy !== undefined) {
      const marketMidpoint = (best_sell + best_buy) / 2;
      fairPrice = fairPrice * 0.5 + marketMidpoint * 0.5;
      const minPrice = best_buy + 1;
      const maxPrice = best_sell - 1;
      if (fairPrice < minPrice) fairPrice = minPrice;
      else if (fairPrice > maxPrice) fairPrice = maxPrice;
    } else if (best_sell !== undefined) {
      fairPrice = Math.min(fairPrice, best_sell - 1);
    } else if (best_buy !== undefined) {
      fairPrice = Math.max(fairPrice, best_buy + 1);
    }
    if (spread !== undefined && spread > 0 && spread / trends.median_7d! > 0.2) {
      fairPrice = fairPrice * 0.95;
    }
  }

  const maxMedian = Math.max(trends.median_1d!, trends.median_7d!, trends.median_30d!);
  const minMedian = Math.min(trends.median_1d!, trends.median_7d!, trends.median_30d!);
  const upperBound = maxMedian * 1.1;
  const lowerBound = minMedian * 0.9;
  if (fairPrice > upperBound) fairPrice = upperBound;
  else if (fairPrice < lowerBound) fairPrice = lowerBound;
  fairPrice = Math.round(fairPrice);
  if (fairPrice < 1) fairPrice = Math.max(1, Math.round(trends.median_7d || trends.median_30d || 1));

  return fairPrice;
}
