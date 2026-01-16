import { NextRequest, NextResponse } from "next/server";
import { fetchItems, WFMItem } from "@/lib/wfm-api";

let cachedItems: WFMItem[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function getItems(): Promise<WFMItem[]> {
  const now = Date.now();
  
  // Return cached items if still valid
  if (cachedItems && now - lastFetchTime < CACHE_DURATION) {
    return cachedItems;
  }
  
  // Fetch fresh items
  const items = await fetchItems();
  cachedItems = items;
  lastFetchTime = now;
  
  return items;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    
    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }
    
    const items = await getItems();
    
    // Simple case-insensitive search
    const queryLower = query.toLowerCase();
    const filtered = items
      .filter(
        (item) =>
          item.item_name.toLowerCase().includes(queryLower) ||
          item.url_name.toLowerCase().includes(queryLower)
      )
      .slice(0, 20) // Limit to 20 results
      .map((item) => ({
        item_name: item.item_name,
        url_name: item.url_name,
      }));
    
    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Error in search API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
