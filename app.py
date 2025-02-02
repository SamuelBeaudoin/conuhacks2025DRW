from flask import Flask, render_template, request, jsonify
import yfinance as yf
import pandas as pd
import numpy as np

app = Flask(__name__)

def get_stock_data(symbols, weights):
    data = {}
    market_caps = {}
    prices = {}

    for symbol in symbols:
        stock = yf.Ticker(symbol)
        hist = stock.history(period="1y")
        data[symbol] = hist['Close']
        info = stock.info
        market_caps[symbol] = info.get('marketCap', 0)
        prices[symbol] = hist['Close'].iloc[-1]

    # Create correlation matrix
    df = pd.DataFrame(data)
    corr_matrix = df.corr()

    # Analyze correlations
    correlation_flags = {}
    for i in range(len(symbols)):
        for j in range(i+1, len(symbols)):
            corr = corr_matrix.iloc[i,j]
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

    # Weight analysis
    weight_analysis = {}
    total_market_cap = sum(market_caps.values())

    for symbol, weight in zip(symbols, weights):
        market_cap_weight = market_caps[symbol] / total_market_cap
        weight_analysis[symbol] = {
            "assigned_weight": weight,
            "market_cap_weight": market_cap_weight,
            "price": prices[symbol],
            "market_cap": market_caps[symbol]
        }

    return {
        "correlation_flags": correlation_flags,
        "weight_analysis": weight_analysis,
        "correlation_matrix": corr_matrix.to_dict()
    }

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

if __name__ == '__main__':
    app.run(debug=True)