from flask import Flask, render_template, request, jsonify
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime
from dateutil.relativedelta import relativedelta

app = Flask(__name__)

def get_stock_data(symbols, weights):
    data = {}
    market_caps = {}
    prices = {}
    volatilities = {}

    for symbol in symbols:
        stock = yf.Ticker(symbol)
        hist = stock.history(period="1y")
        data[symbol] = hist['Close']
        info = stock.info
        market_caps[symbol] = info.get('marketCap', 0)
        prices[symbol] = hist['Close'].iloc[-1]
        # Compute volatility as the standard deviation of daily percent changes.
        vol = hist['Close'].pct_change().dropna().std()
        volatilities[symbol] = vol if vol is not None else 0

    # Compute correlation matrix from daily returns instead of closing price levels.
    price_df = pd.DataFrame(data)
    returns_df = price_df.pct_change().dropna()
    corr_matrix = returns_df.corr()

    # Analyze correlations based on the daily returns correlation.
    correlation_flags = {}
    for i in range(len(symbols)):
        for j in range(i + 1, len(symbols)):
            corr = corr_matrix.iloc[i, j]
            if corr > 0.6:
                correlation_flags[f"{symbols[i]}-{symbols[j]}"] = {
                    "level": "high",
                    "value": corr
                }
            elif corr > 0.3:
                correlation_flags[f"{symbols[i]}-{symbols[j]}"] = {
                    "level": "medium",
                    "value": corr
                }

    # Weight analysis remains unchanged.
    weight_analysis = {}
    total_market_cap = sum(market_caps.values()) if sum(market_caps.values()) else 1

    for symbol, weight in zip(symbols, weights):
        market_cap_weight = market_caps[symbol] / total_market_cap
        weight_analysis[symbol] = {
            "assigned_weight": weight,
            "market_cap_weight": market_cap_weight,
            "price": prices[symbol],
            "market_cap": market_caps[symbol],
            "volatility": volatilities[symbol]
        }

    return {
        "correlation_flags": correlation_flags,
        "weight_analysis": weight_analysis,
        "correlation_matrix": corr_matrix.to_dict()
    }

def get_portfolio_performance(symbols, weights, start_date, end_date, yf_interval):
    portfolio_df = pd.DataFrame()
    for symbol, weight in zip(symbols, weights):
        stock = yf.Ticker(symbol)
        hist = stock.history(start=start_date, end=end_date, interval=yf_interval)
        if hist.empty:
            continue
        # Use the closing price
        hist = hist['Close'].rename(symbol)
        if portfolio_df.empty:
            portfolio_df = pd.DataFrame(hist)
        else:
            portfolio_df = portfolio_df.join(hist, how='outer')
    if portfolio_df.empty:
        return None
    portfolio_df.sort_index(inplace=True)
    portfolio_df.fillna(method='ffill', inplace=True)
    portfolio_df.fillna(method='bfill', inplace=True)

    # Normalize to 1 at the start date and compute weighted sum over time.
    normalized = portfolio_df / portfolio_df.iloc[0]
    portfolio = normalized.multiply(weights, axis=1).sum(axis=1)

    return portfolio

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.json
    symbols = data['symbols']
    weights = data['weights']
    analysis = get_stock_data(symbols, weights)
    return jsonify(analysis)

@app.route('/performance', methods=['POST'])
def performance():
    data = request.json
    symbols = data['symbols']
    weights = data['weights']
    end_date = datetime.today()

    # Determine the period based on the payload.
    if "years" in data:
        start_date = end_date - relativedelta(years=int(data["years"]))
    elif "months" in data:
        start_date = end_date - relativedelta(months=int(data["months"]))
    elif "days" in data:
        start_date = end_date - relativedelta(days=int(data["days"]))
    else:
        # Default to 1 year if not provided.
        start_date = end_date - relativedelta(years=1)

    yf_interval = "1d"
    performance_series = get_portfolio_performance(symbols, weights, start_date, end_date, yf_interval)
    if performance_series is None:
        return jsonify({"error": "Could not fetch performance data."}), 400

    dates = performance_series.index.strftime('%Y-%m-%d').tolist()
    values = performance_series.round(4).tolist()

    return jsonify({
        "dates": dates,
        "values": values
    })

if __name__ == '__main__':
    app.run(debug=True)