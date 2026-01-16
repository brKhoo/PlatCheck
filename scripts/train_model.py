#!/usr/bin/env python3
"""
Training script for Warframe Sell Price Estimator
Trains a Ridge Regression model on historical price data
"""

import json
import os
import sys
from datetime import datetime
from typing import List, Dict, Any
import requests
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

# Warframe.market API's
API_BASE_V2 = "https://api.warframe.market/v2"
API_BASE_V1 = "https://api.warframe.market/v1"

def fetch_item_list() -> List[Dict[str, str]]:
    """Get list of items from Warframe.market API"""
    try:
        response = requests.get(f"{API_BASE_V2}/items", timeout=30)
        response.raise_for_status()
        data = response.json()
        items = data.get("data", [])
        # Transform to match expected format
        result = []
        for item in items:
            slug = item.get("slug", "")
            name = item.get("i18n", {}).get("en", {}).get("name", slug)
            if slug:
                result.append({
                    "item_name": name,
                    "url_name": slug
                })
        return result
    except Exception as e:
        print(f"Error getting item list: {e}")
        import traceback
        traceback.print_exc()
        return []

def fetch_item_statistics(url_name: str, platform: str = "pc") -> List[Dict[str, Any]]:
    """Get daily stats for an item"""
    try:
        response = requests.get(
            f"{API_BASE_V1}/items/{url_name}/statistics",
            params={"platform": platform},
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        
        payload = data.get("payload", {})
        stats_closed = payload.get("statistics_closed", {})
        
        result = stats_closed.get("90days", [])
        return result
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            # Item might not have any stats yet
            return []
        print(f"  HTTP error getting stats for {url_name}: {e.response.status_code}")
        return []
    except Exception as e:
        print(f"  Error getting stats for {url_name}: {e}")
        return []

def calculate_weighted_median(stats: List[Dict[str, Any]]) -> float:
    """Calculate volume-weighted median for more accurate pricing"""
    if not stats:
        return 0.0
    
    # Filter out entries without median
    valid_stats = [s for s in stats if s.get("median") is not None]
    if not valid_stats:
        return 0.0
    
    # If we have volume data, use volume-weighted calculation
    with_volume = [s for s in valid_stats if s.get("volume", 0) > 0]
    
    if with_volume:
        weighted_prices = []
        for stat in with_volume:
            volume = min(stat.get("volume", 1), 100)  # Cap at 100 to avoid memory issues
            price = stat.get("median")
            weighted_prices.extend([price] * int(volume))
        
        if weighted_prices:
            return float(np.median(weighted_prices))
    
    # Default to simple median
    prices = [s.get("median") for s in valid_stats]
    return float(np.median(prices))

def remove_outliers(values: List[float]) -> List[float]:
    """Remove outliers using IQR method"""
    if len(values) < 4:
        return values
    
    sorted_vals = sorted(values)
    q1_idx = int(len(sorted_vals) * 0.25)
    q3_idx = int(len(sorted_vals) * 0.75)
    q1 = sorted_vals[q1_idx]
    q3 = sorted_vals[q3_idx]
    iqr = q3 - q1
    
    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr
    
    return [v for v in values if lower_bound <= v <= upper_bound]

def prepare_features(statistics: List[Dict[str, Any]]) -> List[Dict[str, float]]:
    """
    Use volume-weighted medians and filter outliers
    """
    if len(statistics) < 30:
        return []
    
    # Sort by datetime (oldest first)
    sorted_stats = sorted(statistics, key=lambda x: x.get("datetime", ""))
    
    # Filter out items with no median or low volume
    valid_stats = [
        s for s in sorted_stats
        if s.get("median") is not None
        and (s.get("volume", 1) >= 1)  # At least 1 trade
    ]
    
    if len(valid_stats) < 30:
        return []
    
    # Build features and targets
    features = []
    for i in range(29, len(valid_stats) - 1):  # Need at least 30 days, and target is next day
        current_stat = valid_stats[i]
        next_stat = valid_stats[i + 1]
        
        if current_stat.get("median") is None or next_stat.get("median") is None:
            continue
        
        # Calculate 1-day: use current day
        median_1d = float(current_stat.get("median"))
        
        # Calculate 7-day: volume-weighted median of last 7 days
        last_7 = valid_stats[max(0, i-6):i+1]
        if len(last_7) < 3:
            continue
        median_7d = calculate_weighted_median(last_7)
        
        # Calculate 30-day: volume-weighted median of last 30 days
        last_30 = valid_stats[max(0, i-29):i+1]
        if len(last_30) < 10:
            continue
        median_30d = calculate_weighted_median(last_30)
        
        target = float(next_stat.get("median"))
        
        # Remove outliers from features
        feature_values = [median_1d, median_7d, median_30d]
        filtered_features = remove_outliers(feature_values)
        
        # If too many outliers removed, skip this sample
        if len(filtered_features) < 3:
            continue
        
        # Use filtered values (or original if no outliers)
        if len(filtered_features) == 3:
            median_1d, median_7d, median_30d = filtered_features
        
        features.append({
            "median_1d": median_1d,
            "median_7d": median_7d,
            "median_30d": median_30d,
            "target": target
        })
    
    return features

def train_model(items: List[Dict[str, str]], max_items: int = 200) -> Dict[str, Any]:
    """
    Train Ridge Regression model on multiple items
    """
    print(f"Getting data for up to {max_items} items...")
    
    all_features = []
    processed = 0
    items_to_process = items[:max_items]
    
    for idx, item in enumerate(items_to_process, 1):
        url_name = item.get("url_name")
        if not url_name:
            continue
        
        print(f"Processing {item.get('item_name', url_name)}... ({idx}/{len(items_to_process)})")
        
        statistics = fetch_item_statistics(url_name)
        features = prepare_features(statistics)
        
        if features:
            all_features.extend(features)
            processed += 1
            print(f"  Collected {len(features)} samples from this item (total: {len(all_features)})")
        
        # Be nice to the API
        import time
        time.sleep(0.5)
    
    if len(all_features) < 50:
        print(f"Warning: Only {len(all_features)} samples collected. Need at least 50 for accuracy.")
        return None
    
    print(f"\nCollected {len(all_features)} training samples from {processed} items")
    
    # Prepare data
    X = np.array([[f["median_1d"], f["median_7d"], f["median_30d"]] for f in all_features])
    y = np.array([f["target"] for f in all_features])
    
    # Train model
    print("Training Ridge Regression model...")
    model = Ridge(alpha=1.0)
    model.fit(X, y)
    
    # Create model JSON
    model_data = {
        "intercept": float(model.intercept_),
        "coefficients": {
            "median_1d": float(model.coef_[0]),
            "median_7d": float(model.coef_[1]),
            "median_30d": float(model.coef_[2])
        },
        "model": "ridge_regression",
        "trained_at": datetime.now().strftime("%Y-%m-%d"),
        "training_samples": len(all_features),
        "items_used": processed
    }
    
    # Calculate R^2 score
    from sklearn.metrics import r2_score
    y_pred = model.predict(X)
    r2 = r2_score(y, y_pred)
    model_data["r2_score"] = float(r2)
    
    print(f"Model trained. R^2 score: {r2:.4f}")
    print(f"Intercept: {model_data['intercept']:.4f}")
    print(f"Coefficients: {model_data['coefficients']}")
    
    return model_data

def main():
    print("Warframe Sell Price Estimator - Model Training")
    print("=" * 50)
    
    # Get items
    print("Getting item list...")
    items = fetch_item_list()
    
    if not items:
        print("Could not get items.")
        sys.exit(1)
    
    print(f"Found {len(items)} items")
    
    # Filter popular items (common names, or high volume)
    # For simplicity use first 200 items
    
    # Train model
    model_data = train_model(items, max_items=200)
    
    if not model_data:
        print("Training failed")
        sys.exit(1)
    
    # Save model
    os.makedirs("model", exist_ok=True)
    model_path = "model/model.json"
    
    with open(model_path, "w") as f:
        json.dump(model_data, f, indent=2)
    
    print(f"\nModel saved to {model_path}")
    print("Done")

if __name__ == "__main__":
    main()
