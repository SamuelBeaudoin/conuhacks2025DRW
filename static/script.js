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
      // After analysis, update the performance chart using the selected period.
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
  
    fetch('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols, weights })
    })
    .then(response => response.json())
    .then(data => {
      const newWeights = calculateBalancedWeights(data.weight_analysis);
  
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
  
  function calculateBalancedWeights(weightAnalysis) {
    const symbols = Object.keys(weightAnalysis);
    const newWeights = {};
  
    symbols.forEach(symbol => {
      const analysis = weightAnalysis[symbol];
      newWeights[symbol] = analysis.market_cap_weight;
    });
  
    const minWeight = 0.03;
    const maxWeight = 0.35;
  
    symbols.forEach(symbol => {
      if (newWeights[symbol] < minWeight) {
        newWeights[symbol] = minWeight;
      } else if (newWeights[symbol] > maxWeight) {
        newWeights[symbol] = maxWeight;
      }
    });
  
    const totalWeight = Object.values(newWeights).reduce((sum, weight) => sum + weight, 0);
    symbols.forEach(symbol => {
      newWeights[symbol] = newWeights[symbol] / totalWeight;
    });
  
    const maxIterations = 10;
    let iteration = 0;
    while (iteration < maxIterations) {
      let maxDiff = 0;
      let symbolToAdjust = null;
      symbols.forEach(symbol => {
        const diff = Math.abs(newWeights[symbol] - weightAnalysis[symbol].market_cap_weight);
        if (diff > maxDiff) {
          maxDiff = diff;
          symbolToAdjust = symbol;
        }
      });
      if (maxDiff < WEIGHT_DIFFERENCE_THRESHOLDS.LOW) {
        break;
      }
      if (symbolToAdjust) {
        const targetWeight = weightAnalysis[symbolToAdjust].market_cap_weight;
        const currentWeight = newWeights[symbolToAdjust];
        const adjustment = (targetWeight - currentWeight) * 0.5;
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
            const value = context.raw.v;
            if (value === 1) return 'rgb(46, 204, 113)';
            if (value > 0.6) return 'rgb(231, 76, 60)';
            if (value > 0.3) return 'rgb(241, 196, 15)';
            return 'rgb(46, 204, 113)';
          },
          pointRadius: 15,
          pointHoverRadius: 20
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { left: 15, right: 15, top: 15, bottom: 15 } },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.raw.v;
                return `Correlation: ${value.toFixed(2)}`;
              }
            }
          },
          legend: { display: false }
        },
        scales: {
          x: { type: 'category', labels: labels, ticks: { padding: 10, autoSkip: false, font: { size: 11 } }, grid: { display: false } },
          y: { type: 'category', labels: labels, ticks: { padding: 10, autoSkip: false, font: { size: 11 } }, grid: { display: false } }
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
      card.innerHTML = `
        <h3>${symbol}</h3>
        <p>Assigned Weight: ${(analysis.assigned_weight * 100).toFixed(2)}%</p>
        <p>Market Cap Weight: ${(analysis.market_cap_weight * 100).toFixed(2)}%</p>
        <p>Current Price: ${analysis.price.toFixed(2)}</p>
        <p>Market Cap: ${(analysis.market_cap / 1e9).toFixed(2)}B</p>
        <p>Weight Difference: 
          <span class="weight-difference ${differenceClass}">
            ${(weightDiff * 100).toFixed(2)}%
          </span>
        </p>
      `;
      weightDiv.appendChild(card);
    });
  }
  
  // Fetch performance data based on the selected period.
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
  
    // Update the performance chart container.
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
  
  // Add event listener to repopulate performance data when the period changes.
  function setupPerformanceDropdownListener() {
    const performanceSelect = document.getElementById("performancePeriodSelect");
    performanceSelect.addEventListener("change", function() {
      // Retrieve stock symbols and weights from the input fields.
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
        // Optionally clear the performance chart if there are fewer than 2 stocks.
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