# Warframe Fair Price Estimator

A simple web app that estimates fair prices for Warframe.market items using Ridge Regression.

## Features

- **Search**: Autocomplete search for Warframe.market items
- **Price Trends**: View 1-day, 7-day, and 30-day median prices
- **Fair Price**: ML-based price estimation using Ridge Regression
- **Market Snapshot**: Current best buy/sell prices and spread

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Next.js API routes
- **ML**: Python + scikit-learn (Ridge Regression)
- **Data Source**: Warframe.market API v2

## Setup

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Create Python virtual environment (required on Arch Linux and many modern systems)
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Linux/Mac
# or
# venv\Scripts\activate  # On Windows

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Train the Model

Before running the app, you need to train the ML model:

```bash
# Make sure virtual environment is activated
source venv/bin/activate  # On Linux/Mac

# Run training script
python scripts/train_model.py
```

This will:
- Fetch historical price data from Warframe.market API
- Train a Ridge Regression model
- Save the model to `model/model.json`

**Note**: The training script fetches data for up to 200 items and may take several minutes. It includes rate limiting to be respectful to the API.

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── search/route.ts    # Item search endpoint
│   │   └── item/route.ts      # Item data endpoint
│   ├── page.tsx               # Main page component
│   ├── layout.tsx             # Root layout
│   └── globals.css            # Global styles
├── lib/
│   ├── wfm-api.ts            # Warframe.market API utilities
│   └── ml-model.ts           # ML model utilities
├── scripts/
│   └── train_model.py        # Model training script
├── model/
│   └── model.json            # Trained model (generated)
└── package.json
```

## API Endpoints

### GET /api/search?q=...

Searches for items matching the query.

**Response:**
```json
[
  {
    "item_name": "Ash Prime Set",
    "url_name": "ash_prime_set"
  }
]
```

### GET /api/item?url_name=...&platform=pc

Fetches item data including trends and fair price.

**Response:**
```json
{
  "item_name": "Ash Prime Set",
  "url_name": "ash_prime_set",
  "trends": {
    "median_1d": 120,
    "median_7d": 118,
    "median_30d": 112
  },
  "fair_price": 117,
  "snapshot": {
    "best_sell": 120,
    "best_buy": 115,
    "spread": 5
  }
}
```

## How the Machine Learning Model Works

### What is Ridge Regression? (In Simple Terms)

Think of Ridge Regression like a smart calculator that learns from past data to predict future prices. It's a type of machine learning that finds patterns in historical prices and uses them to estimate what an item should cost.

**The Basic Math (Simplified):**

Imagine you're trying to predict tomorrow's price. The model looks at three things:
- Yesterday's price
- Last week's average price  
- Last month's average price

It then uses a simple formula:
```
Predicted Price = Base Number + (Weight1 × Yesterday's Price) + (Weight2 × Week's Price) + (Weight3 × Month's Price)
```

The "weights" are numbers the computer learns during training - they tell the model how important each time period is. For example, if recent prices matter more, the weight for "Yesterday's Price" will be higher.

**Why This Works:**
- It's simple and fast - no complex calculations needed
- It prevents the model from getting too "stuck" on weird price spikes (called overfitting)
- The model learns from real historical data, so it understands actual market patterns

### Where Does the Data Come From?

The model learns by studying real price data from **Warframe.market API**:

1. **Training Phase**: When you run `train_model.py`, the script:
   - Fetches a list of items from Warframe.market
   - For each item, downloads 90 days of historical price data
   - Looks at thousands of past price changes across hundreds of items
   - Learns the patterns: "When prices were X yesterday, Y last week, and Z last month, what did they become tomorrow?"

2. **What the Model Learns**: 
   - How much each time period (1 day, 7 days, 30 days) matters for predicting prices
   - The relationship between past prices and future prices
   - How to ignore weird price spikes (outliers) that don't represent real market trends

### The Three Features (What the Model Looks At)

The model uses three pieces of information to make predictions:

- **`median_1d`**: The median price from the last 1 day
  - *Why?* Shows what's happening right now in the market
  
- **`median_7d`**: The median price from the last 7 days
  - *Why?* Smooths out daily ups and downs to show the short-term trend
  
- **`median_30d`**: The median price from the last 30 days
  - *Why?* Shows the long-term baseline and catches seasonal patterns

**Important**: These aren't just simple averages - they're "volume-weighted," meaning days with more trades count more. If 50 people traded an item yesterday but only 2 people traded it the day before, yesterday's price has more influence.

### How Training Works

1. **Fetch Real Data**: Downloads historical prices for up to 200 items from Warframe.market API
2. **Clean the Data**: 
   - Removes weird price spikes (like someone accidentally listing for 1 plat or 10,000 plat)
   - Focuses on days with actual trading activity
   - Needs at least 30 days of data per item to be reliable
3. **Learn Patterns**: The computer looks at thousands of examples like:
   - "When 1d=100, 7d=95, 30d=90, the next day was 98"
   - "When 1d=50, 7d=55, 30d=60, the next day was 52"
   - And finds the best formula (weights) that explains these patterns
4. **Save the Model**: Stores the learned weights as a simple JSON file that the web app can use

### How Predictions Are Made

When you search for an item, the app:

1. **Gets Current Prices**: Fetches the item's recent price history from Warframe.market
2. **Calculates Features**: Computes the 1-day, 7-day, and 30-day medians
3. **Runs the Model**: Uses the trained formula to predict tomorrow's price
4. **Applies Smart Adjustments**:
   - Blends the prediction with current market conditions (actual buy/sell orders)
   - Makes sure the price is realistic (can't be higher than what people are selling for, or lower than what people are buying for)
   - Adjusts for volatile markets (if prices are jumping around a lot)
5. **Returns Fair Price**: Gives you an estimate that's both data-driven and market-aware

### Search Functionality

**Note**: This project does not use RAG (Retrieval-Augmented Generation). The search is straightforward:

- When you type in the search box, it looks through the list of items from Warframe.market
- Matches your text against item names (case-insensitive)
- Returns the top 20 matches
- Caches the item list for 1 hour to avoid hitting the API too often

The trained model is saved as a simple JSON file with the learned weights, so the web app can make predictions instantly without needing Python running in the background.

## License

MIT
