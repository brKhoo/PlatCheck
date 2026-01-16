# Accuracy Improvements

This document describes the improvements made to increase the accuracy of median calculations and fair price estimation.

## Improvements Made

### 1. Volume-Weighted Medians

**Before**: Simple median of prices over time periods
**After**: Volume-weighted median that gives more weight to days with higher trade volume

**Why it's better**: Days with more trades are more representative of the true market price. A day with 50 trades should influence the median more than a day with 2 trades.

**Implementation**:
- For each time period (1d, 7d, 30d), we repeat each price by its trade volume
- Then calculate the median of this weighted dataset
- Falls back to simple median if volume data is unavailable

### 2. Outlier Filtering

**Before**: All data points included in median calculations
**After**: Outliers removed using Interquartile Range (IQR) method

**Why it's better**: Removes extreme price spikes/drops that might be due to:
- Market manipulation
- Data errors
- Unusual one-off trades

**Implementation**:
- Calculates Q1 (25th percentile) and Q3 (75th percentile)
- Removes values outside 1.5 × IQR range
- Ensures more stable and reliable median calculations

### 3. Data Quality Filtering

**Before**: Included all statistics entries
**After**: Filters out entries with:
- Missing median values
- Zero or very low trade volume (< 1 trade)

**Why it's better**: Ensures we only use reliable data points in our calculations.

### 4. Enhanced Fair Price Calculation

**Before**: Simple linear combination of medians with basic clamping
**After**: Market-aware blending with multiple adjustments

**Improvements**:

#### a. Market Blending
- Blends model prediction (70% weight) with current market midpoint (30% weight)
- Uses actual buy/sell orders to ground the prediction in current market reality

#### b. Intelligent Bounds
- Ensures fair price is between `best_buy + 1` and `best_sell - 1`
- Prevents unrealistic prices that couldn't be executed

#### c. Volatility Adjustment
- Detects volatile markets (spread > 20% of 7d median)
- Applies conservative adjustment (5% reduction) in volatile markets
- Protects against overpricing in illiquid markets

#### d. Fallback Handling
- Handles cases where only buy OR sell orders are available
- Provides reasonable defaults when market data is incomplete

### 5. Improved Training Data

**Before**: Simple median calculations during training
**After**: Volume-weighted medians and outlier filtering during training

**Why it's better**: The model learns from more accurate features, leading to better predictions.

## Expected Impact

1. **More Accurate Medians**: Volume-weighting and outlier removal should provide medians that better represent true market value
2. **Better Fair Prices**: Market blending and volatility adjustments should produce prices that are:
   - More likely to execute
   - Closer to actual market value
   - More conservative in volatile markets
3. **Improved Model**: Training with better features should improve the model's R² score

## Retraining Recommendation

After these improvements, you should retrain the model to take advantage of the improved feature calculations:

```bash
./venv/bin/python scripts/train_model.py
```

The new model will be trained on volume-weighted medians and should perform better than the previous version.

## Testing

To verify improvements:
1. Compare old vs new median calculations for the same items
2. Check if fair prices are more reasonable (within buy/sell range)
3. Verify that prices in volatile markets are more conservative
4. Test with items that have varying trade volumes
