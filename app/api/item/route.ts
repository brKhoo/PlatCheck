import { NextRequest, NextResponse } from "next/server";
import {
  fetchItemStatistics,
  fetchItemOrders,
  calculateTrends,
  fetchItems,
} from "@/lib/wfm-api";
import { loadModel, calculateFairPrice } from "@/lib/ml-model";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const urlName = searchParams.get("url_name");
    const platform = searchParams.get("platform") || "pc";
    
    if (!urlName) {
      return NextResponse.json(
        { error: "url_name parameter is required" },
        { status: 400 }
      );
    }
    
    // Fetch item info to get item_name
    const items = await fetchItems();
    const item = items.find((i) => i.url_name === urlName);
    
    if (!item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }
    
    // Fetch statistics and orders in parallel
    const [statistics, snapshot] = await Promise.all([
      fetchItemStatistics(urlName, platform),
      fetchItemOrders(urlName, platform),
    ]);
    
    // Calculate trends
    const trends = calculateTrends(statistics);
    
    // Load model and calculate fair price
    const model = await loadModel();
    let fairPrice: number | null = null;
    
    if (model) {
      fairPrice = calculateFairPrice(model, trends, snapshot);
    }
    
    return NextResponse.json({
      item_name: item.item_name,
      url_name: item.url_name,
      thumb: item.thumb,
      trends: { median_1d: trends.median_1d, median_7d: trends.median_7d, median_30d: trends.median_30d },
      fair_price: fairPrice,
      snapshot: snapshot,
    });
  } catch (error) {
    console.error("Error in item API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
