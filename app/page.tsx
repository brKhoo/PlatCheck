"use client";

import { useState, useEffect, useRef } from "react";

interface SearchItem {
  item_name: string;
  url_name: string;
}

interface ItemData {
  item_name: string;
  url_name: string;
  thumb?: string;
  trends: { median_1d: number | null; median_7d: number | null; median_30d: number | null };
  fair_price: number | null;
  snapshot?: { best_sell?: number; best_buy?: number; spread?: number };
}

const TrendCard = ({ label, value, color }: { label: string; value: number | null; color: string }) => (
  <div className={`bg-gradient-to-br ${color} rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow`}>
    <div className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">{label}</div>
    <div className={`text-3xl font-bold ${color.includes('blue') ? 'text-blue-700' : color.includes('green') ? 'text-green-700' : 'text-purple-700'}`}>
      {value !== null ? `${value} plat` : "N/A"}
    </div>
  </div>
);

const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className={`bg-gradient-to-br ${color} rounded-xl p-4 shadow-sm`}>
    <div className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">{label}</div>
    <div className={`text-xl font-bold ${color.includes('red') ? 'text-red-700' : color.includes('green') ? 'text-green-700' : 'text-gray-700'}`}>
      {value} plat
    </div>
  </div>
);

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json();
        setSearchResults(data);
        setShowDropdown(data.length > 0);
      } catch (err) {
        console.error("Search error:", err);
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleItemSelect = async (item: SearchItem) => {
    setSearchQuery(item.item_name);
    setShowDropdown(false);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/item?url_name=${encodeURIComponent(item.url_name)}&platform=pc`);
      if (!response.ok) throw new Error("Failed to fetch item data");
      const data = await response.json();
      setSelectedItem(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load item data");
      setSelectedItem(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <header className="text-center mb-12">
          <div className="inline-block mb-4">
            <h1 className="text-5xl font-extrabold text-blue-600 mb-3">
              PlatCheck
            </h1>
            <div className="h-1 w-24 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
          </div>
          <p className="text-gray-600 text-lg mt-4">
            Machine-Learning powered sell price estimator for Warframe items
          </p>
        </header>

        <div className="mb-8" ref={searchRef}>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for an item..."
              className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-white shadow-sm transition-all"
            />
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                {searchResults.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleItemSelect(item)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors border-b border-gray-100 last:border-0"
                  >
                    <span className="font-medium text-gray-900">{item.item_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading item data...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 text-red-700 px-6 py-4 rounded-lg mb-6 shadow-sm">
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {selectedItem && !loading && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-gray-100">
              <div className="flex items-center gap-4 mb-6">
                {selectedItem.thumb && (
                  <img
                    src={`https://warframe.market/static/assets/${selectedItem.thumb}`}
                    alt={selectedItem.item_name}
                    className="w-16 h-16 object-contain bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-2 shadow-md border border-gray-200"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <h2 className="text-3xl font-bold text-gray-900">
                  {selectedItem.item_name}
                </h2>
              </div>

              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                  <span className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full mr-3"></span>
                  Recent Price Trends
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <TrendCard label="1 Day" value={selectedItem.trends.median_1d} color="from-blue-50 to-blue-100" />
                  <TrendCard label="7 Days" value={selectedItem.trends.median_7d} color="from-green-50 to-green-100" />
                  <TrendCard label="30 Days" value={selectedItem.trends.median_30d} color="from-purple-50 to-purple-100" />
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                  <span className="w-1 h-6 bg-gradient-to-b from-yellow-500 to-orange-500 rounded-full mr-3"></span>
                  Fair Price
                </h3>
                <div className="bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 rounded-xl p-8 border-2 border-amber-200 shadow-lg">
                  <div className="flex items-baseline justify-center mb-3">
                    <span className="text-5xl font-extrabold text-orange-600">
                      {selectedItem.fair_price !== null ? selectedItem.fair_price : "—"}
                    </span>
                    <span className="text-2xl font-semibold text-orange-500 ml-2">plat</span>
                  </div>
                  <p className="text-center text-sm text-gray-600 font-medium">
                    {selectedItem.fair_price !== null 
                      ? "Estimated using Ridge regression on recent price trends"
                      : "Unable to calculate fair price"}
                  </p>
                </div>
              </div>

              {selectedItem.snapshot && (selectedItem.snapshot.best_sell !== undefined || selectedItem.snapshot.best_buy !== undefined || selectedItem.snapshot.spread !== undefined) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                    <span className="w-1 h-6 bg-gradient-to-b from-gray-400 to-gray-600 rounded-full mr-3"></span>
                    Market Snapshot
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {selectedItem.snapshot.best_sell !== undefined && (
                      <StatCard label="Best Sell" value={selectedItem.snapshot.best_sell} color="from-red-50 to-red-100" />
                    )}
                    {selectedItem.snapshot.best_buy !== undefined && (
                      <StatCard label="Best Buy" value={selectedItem.snapshot.best_buy} color="from-green-50 to-green-100" />
                    )}
                    {selectedItem.snapshot.spread !== undefined && (
                      <StatCard label="Spread" value={selectedItem.snapshot.spread} color="from-gray-50 to-gray-100" />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!selectedItem && !loading && !error && (
          <div className="text-center py-20">
            <div className="inline-block p-6 bg-white/60 backdrop-blur-sm rounded-2xl shadow-lg">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-gray-500 font-medium text-lg">Search for an item to see price trends and fair price estimate</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
