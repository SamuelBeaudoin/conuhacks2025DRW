// Constants for weight difference thresholds
const WEIGHT_DIFFERENCE_THRESHOLDS = {
    HIGH: 0.15,    // 15% difference shows as red
    MEDIUM: 0.05,  // 5% difference shows as orange
    LOW: 0.05      // Under 5% difference shows as green
};

function addStockInput() {
  const container = document.getElementById('stockInputs');
  const inputGroup = document.createElement('div');
  inputGroup.className = 'stock-input';

  const symbolInput = document.createElement('input');
  symbolInput.type = 'text';
  symbolInput.placeholder = 'Symbol';
  symbolInput.className = 'symbol-input';

  const weightInput = document.createElement('input');
  weightInput.type = 'number';
  weightInput.placeholder = 'Weight %';
  weightInput.className = 'weight-input';
  weightInput.step = '0.1';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
  deleteBtn.onclick = function() {
    container.removeChild(inputGroup);
  };

  inputGroup.appendChild(symbolInput);
  inputGroup.appendChild(weightInput);
  inputGroup.appendChild(deleteBtn);
  container.appendChild(inputGroup);
}

function analyzePortfolio() {
  const inputs = document.querySelectorAll('.stock-input');
  const symbols = [];
  const weights = [];

  inputs.forEach(input => {
    const symbol = input.querySelector('.symbol-input').value.toUpperCase();
    const weight = parseFloat(input.querySelector('.weight-input').value);
    if (symbol && !isNaN(weight)) {
      symbols.push(symbol);
      weights.push(weight / 100);
    }
  });

  if (symbols.length < 2) {
    alert('Please add at least 2 stocks to analyze');
    return;
  }

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (Math.abs(totalWeight - 1) > 0.001) {
    alert('Weights must sum to 100%');
    return;
  }

  document.getElementById('correlationMatrix').innerHTML = 'Loading...';
  document.getElementById('weightAnalysis').innerHTML = 'Loading...';

  fetch('/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols, weights })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    displayResults(data);
    getPerformance(symbols, weights);
  })
  .catch(error => {
    console.error('Error:', error);
    alert('Error analyzing portfolio. Please check the stock symbols and try again.');
    document.getElementById('correlationMatrix').innerHTML = 'Error loading data';
    document.getElementById('weightAnalysis').innerHTML = 'Error loading data';
  });
}

function rebalancePortfolio() {
  const inputs = document.querySelectorAll('.stock-input');
  const symbols = [];
  const weights = [];

  inputs.forEach(input => {
    const symbol = input.querySelector('.symbol-input').value.toUpperCase();
    const weight = parseFloat(input.querySelector('.weight-input').value);
    if (symbol && !isNaN(weight)) {
      symbols.push(symbol);
      weights.push(weight / 100);
    }
  });

  if (symbols.length < 2) {
    alert('Please add at least 2 stocks to analyze');
    return;
  }

  // Get the selected rebalancing method
  const weightingMethodSelect = document.getElementById('rebalanceMethodSelect');
  const weightingMethod = weightingMethodSelect.value;

  fetch('/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols, weights })
  })
  .then(response => response.json())
  .then(data => {
    const newWeights = calculateBalancedWeights(data.weight_analysis, weightingMethod);

    inputs.forEach(input => {
      const symbol = input.querySelector('.symbol-input').value.toUpperCase();
      const weightInput = input.querySelector('.weight-input');
      if (newWeights[symbol]) {
        weightInput.value = (newWeights[symbol] * 100).toFixed(2);
      }
    });

    analyzePortfolio();
  })
  .catch(error => {
    console.error('Error:', error);
    alert('Error rebalancing portfolio. Please try again.');
  });
}

function calculateBalancedWeights(weightAnalysis, weightingMethod) {
  const symbols = Object.keys(weightAnalysis);
  const newWeights = {};

  // Calculate initial target weights based on the selected method.
  if (weightingMethod === "marketCap") {
    symbols.forEach(symbol => {
      newWeights[symbol] = weightAnalysis[symbol].market_cap_weight;
    });
  } else if (weightingMethod === "equal") {
    symbols.forEach(symbol => {
      newWeights[symbol] = 1 / symbols.length;
    });
  }

  const minWeight = 0.03;
  const maxWeight = 0.35;

  symbols.forEach(symbol => {
    if (newWeights[symbol] < minWeight) {
      newWeights[symbol] = minWeight;
    } else if (newWeights[symbol] > maxWeight) {
      newWeights[symbol] = maxWeight;
    }
  });

  let totalWeight = Object.values(newWeights).reduce((sum, weight) => sum + weight, 0);
  symbols.forEach(symbol => {
    newWeights[symbol] = newWeights[symbol] / totalWeight;
  });

  // Optional iterative adjustment toward the target weights.
  const maxIterations = 10;
  let iteration = 0;
  while (iteration < maxIterations) {
    let maxDiff = 0;
    let symbolToAdjust = null;
    symbols.forEach(symbol => {
      let target;
      if (weightingMethod === "marketCap") {
        target = weightAnalysis[symbol].market_cap_weight;
      } else { // equal weighting
        target = 1 / symbols.length;
      }
      const currentWeight = newWeights[symbol];
      const diff = Math.abs(currentWeight - target);
      if (diff > maxDiff) {
        maxDiff = diff;
        symbolToAdjust = symbol;
      }
    });
    if (maxDiff < WEIGHT_DIFFERENCE_THRESHOLDS.LOW) {
      break;
    }
    if (symbolToAdjust) {
      let target;
      if (weightingMethod === "marketCap") {
        target = weightAnalysis[symbolToAdjust].market_cap_weight;
      } else {
        target = 1 / symbols.length;
      }
      const currentWeight = newWeights[symbolToAdjust];
      const adjustment = (target - currentWeight) * 0.5;
      newWeights[symbolToAdjust] += adjustment;
      const adjustmentPerSymbol = -adjustment / (symbols.length - 1);
      symbols.forEach(symbol => {
        if (symbol !== symbolToAdjust) {
          newWeights[symbol] += adjustmentPerSymbol;
        }
      });
    }
    iteration++;
  }

  const finalTotal = Object.values(newWeights).reduce((sum, weight) => sum + weight, 0);
  symbols.forEach(symbol => {
    newWeights[symbol] = newWeights[symbol] / finalTotal;
  });

  return newWeights;
}

function getRebalanceRecommendation() {
  const inputs = document.querySelectorAll('.stock-input');
  const symbols = [];
  const weights = [];

  inputs.forEach(input => {
    const symbol = input.querySelector('.symbol-input').value.toUpperCase();
    const weight = parseFloat(input.querySelector('.weight-input').value);
    if (symbol && !isNaN(weight)) {
      symbols.push(symbol);
      weights.push(weight / 100);
    }
  });

  if (symbols.length < 2) {
    alert('Please add at least 2 stocks to get a rebalance recommendation.');
    return;
  }

  fetch('/rebalance_recommendation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols, weights })
  })
  .then(response => response.json())
  .then(data => {
    if (data.error) {
      alert('Error: ' + data.error);
    } else {
      alert(`Recommended Rebalance Frequency: ${data.recommended_frequency}\n` +
            `Approximately every ${data.recommended_rebalance_days} days.\n` +
            `Average Daily Drift: ${data.avg_portfolio_drift}\n` +
            `Drift Threshold: ${data.threshold}`);
    }
  })
  .catch(error => {
    console.error('Error:', error);
    alert('Error fetching rebalance recommendation.');
  });
}

function displayResults(data) {
  // Display correlation matrix.
  const correlationDiv = document.getElementById('correlationMatrix');
  correlationDiv.innerHTML = '';
  const ctx = document.createElement('canvas');
  correlationDiv.appendChild(ctx);

  const labels = Object.keys(data.correlation_matrix);
  const correlationData = [];
  labels.forEach((row) => {
    labels.forEach((col) => {
      correlationData.push({ x: col, y: row, v: data.correlation_matrix[row][col] });
    });
  });

  new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        data: correlationData,
        backgroundColor: (context) => {
          const { x, y, v } = context.raw;
          if (x === y) {
            return 'rgba(200,200,200,0.4)';
          }
          if (v > 0.6) {
            return 'rgb(231, 76, 60)';
          } else if (v > 0.3) {
            return 'rgb(241, 196, 15)';
          } else {
            return 'rgb(46, 204, 113)';
          }
        },
        pointRadius: 15,
        pointHoverRadius: 20
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { left: 15, right: 15, top: 15, bottom: 15 }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => {
              const { x, y, v } = context.raw;
              if (x === y) {
                return `${x} vs. ${y}: Self-correlation (ignored)`;
              }
              return `${x} vs. ${y}: ${v.toFixed(2)}`;
            }
          }
        },
        legend: { display: false }
      },
      scales: {
        x: {
          type: 'category',
          labels: labels,
          ticks: { padding: 10, autoSkip: false, font: { size: 11 } },
          grid: { display: false }
        },
        y: {
          type: 'category',
          labels: labels,
          ticks: { padding: 10, autoSkip: false, font: { size: 11 } },
          grid: { display: false }
        }
      }
    }
  });

  // Display weight analysis.
  const weightDiv = document.getElementById('weightAnalysis');
  weightDiv.innerHTML = '';
  Object.entries(data.weight_analysis).forEach(([symbol, analysis]) => {
    const card = document.createElement('div');
    card.className = 'weight-card';
    const weightDiff = analysis.assigned_weight - analysis.market_cap_weight;
    const absWeightDiff = Math.abs(weightDiff);
    let differenceClass;
    if (absWeightDiff > WEIGHT_DIFFERENCE_THRESHOLDS.HIGH) {
      differenceClass = 'difference-high';
    } else if (absWeightDiff > WEIGHT_DIFFERENCE_THRESHOLDS.MEDIUM) {
      differenceClass = 'difference-medium';
    } else {
      differenceClass = 'difference-low';
    }

    const assignedWeight = analysis.assigned_weight ? (analysis.assigned_weight * 100).toFixed(2) : "N/A";
    const marketCapWeight = analysis.market_cap_weight ? (analysis.market_cap_weight * 100).toFixed(2) : "N/A";
    const price = (analysis.price !== undefined && !isNaN(analysis.price))
                          ? analysis.price.toFixed(2)
                          : 'N/A';
    const marketCap = (analysis.market_cap !== undefined && !isNaN(analysis.market_cap))
                          ? (analysis.market_cap / 1e9).toFixed(2) + "B"
                          : "N/A";

    card.innerHTML = `
      <h3>${symbol}</h3>
      <p>Assigned Weight: ${assignedWeight}%</p>
      <p>Market Cap Weight: ${marketCapWeight}%</p>
      <p>Current Price: ${price}</p>
      <p>Market Cap: ${marketCap}</p>
      <p>Weight Difference: 
        <span class="weight-difference ${differenceClass}">
          ${(weightDiff * 100).toFixed(2)}%
        </span>
      </p>
    `;
    weightDiv.appendChild(card);
  });
}

function getPerformance(symbols, weights) {
  const period = document.getElementById("performancePeriodSelect").value;
  let payload = { symbols, weights };

  if (period === "5years") {
    payload.years = 5;
  } else if (period === "1year") {
    payload.years = 1;
  } else if (period === "6months") {
    payload.months = 6;
  } else if (period === "1month") {
    payload.months = 1;
  } else if (period === "5days") {
    payload.days = 5;
  }

  const container = document.getElementById("performanceChart");
  container.innerHTML = '<canvas id="performanceCanvas"></canvas>';

  fetch("/performance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(response => response.json())
  .then(data => {
    if (data.error) {
      alert(data.error);
      return;
    }
    displayPerformanceChart(data, document.getElementById("performanceCanvas"));
  })
  .catch(err => {
    console.error(err);
    alert("Error fetching performance data.");
  });
}

function displayPerformanceChart(data, canvasElement) {
  new Chart(canvasElement, {
    type: 'line',
    data: {
      labels: data.dates,
      datasets: [{
        label: 'Portfolio Performance',
        data: data.values,
        borderColor: 'var(--primary-color)',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true,
        tension: 0.2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { autoSkip: true, maxTicksLimit: 10 } },
        y: {
          ticks: {
            callback: function(value) {
              return value.toFixed(2);
            }
          }
        }
      }
    }
  });
}

function setupPerformanceDropdownListener() {
  const performanceSelect = document.getElementById("performancePeriodSelect");
  performanceSelect.addEventListener("change", function() {
    const inputs = document.querySelectorAll('.stock-input');
    const symbols = [];
    const weights = [];
    inputs.forEach(input => {
      const symbol = input.querySelector('.symbol-input').value.toUpperCase();
      const weight = parseFloat(input.querySelector('.weight-input').value);
      if (symbol && !isNaN(weight)) {
        symbols.push(symbol);
        weights.push(weight / 100);
      }
    });
    if (symbols.length < 2) {
      document.getElementById("performanceChart").innerHTML = '<p>Please add at least 2 stocks to view performance.</p>';
      return;
    }
    getPerformance(symbols, weights);
  });
}

// Initialize with two stock inputs.
addStockInput();
addStockInput();

// Setup the dropdown listener to update performance data upon change.
setupPerformanceDropdownListener();