function injectPromptCounterButton() {
  const THEME_KEY = "prompt-counter-theme";
  const FLOATING_ID = "prompt-counter-floating";

  function loadChartJS(callback) {
    if (window.Chart) return callback();
    const chartScript = document.createElement("script");
  chartScript.src = browser.runtime.getURL("chart.min.js");
    chartScript.onload = callback; 
    document.head.appendChild(chartScript);
  }

  function injectInlineCSS() {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes countPulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }

      @keyframes cardHighlight {
        0% { 
          box-shadow: 0 6px 18px rgba(0,0,0,0.25);
          border-color: rgba(255,255,255,0.1);
        }
        50% { 
          box-shadow: 0 6px 28px rgba(74,222,128,0.4);
          border-color: rgba(74,222,128,0.6);
        }
        100% { 
          box-shadow: 0 6px 18px rgba(0,0,0,0.25);
          border-color: rgba(255,255,255,0.1);
        }
      }

      #prompt-counter-floating {
        pointer-events: none;
        transition: opacity 140ms ease, transform 80ms ease;
        z-index: 2147483647;
      }

      #prompt-counter-floating-card {
        pointer-events: auto;
        background: rgba(33,33,33,0.95);
        color: #f5f5f5;
        padding: 8px 12px;
        border-radius: 10px;
        box-shadow: 0 6px 18px rgba(0,0,0,0.25);
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial;
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255,255,255,0.1);
        transition: all 0.3s ease;
      }

      #prompt-counter-floating-card.updating {
        animation: cardHighlight 1.2s ease;
      }

      #prompt-counter-floating-card.light {
        background: rgba(255,255,255,0.95);
        color: #000;
        border: 1px solid rgba(0,0,0,0.1);
      }

      #pc-count {
        transition: color 0.3s ease;
      }

      #pc-count.updating {
        animation: countPulse 1.2s ease;
        color: #4ade80;
      }
    `;
    document.head.appendChild(style);
  }

  function getTheme() {
    return localStorage.getItem(THEME_KEY) || "dark";
  }

  function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme();
  }

  function toggleTheme() {
    setTheme(getTheme() === "dark" ? "light" : "dark");
  }

  function applyTheme() {
    const floating = document.getElementById(FLOATING_ID);
    if (!floating) return;
    const theme = getTheme();
    const card = floating.querySelector("#prompt-counter-floating-card");
    if (!card) return;

    if (theme === "dark") {
      card.style.background = "rgba(33,33,33,0.9)";
      card.style.color = "#f5f5f5";
    } else {
      card.style.background = "rgba(255,255,255,0.9)";
      card.style.color = "#000";
    }
  }

  async function getUserPromptCount() {
    const today = new Date().toISOString().split('T')[0];
  const { promptCounts = {} } = await browser.storage.local.get(['promptCounts']);
    const todaysCnt = promptCounts[today] || 0;
    return todaysCnt;
  }

  async function getUserTokenCount() {
    const today = new Date().toISOString().split('T')[0];
  const { tokenCounts = {} } = await browser.storage.local.get(['tokenCounts']);
    const todaysCnt = tokenCounts[today] || 0;
    return todaysCnt;
  }

  async function getUserTimeSpent() {
    const today = new Date().toISOString().split('T')[0];
  const { timeSpent = {} } = await browser.storage.local.get(['timeSpent']);
    const todaysTime = timeSpent[today] || 0;
    return todaysTime;
  }

  function getCurrentChatPrompts() {
    return document.querySelectorAll('[data-message-author-role="user"]').length;
  }

  function getCurrentTokenCount() {
    const userMessages = document.querySelectorAll('[data-message-author-role="user"]');
    let totalTokens = 0;
    
    userMessages.forEach(messageDiv => {
      const textContent = messageDiv.textContent || messageDiv.innerText || '';
      const textLength = textContent.trim().length;
      totalTokens += Math.ceil(textLength / 4);
    });
    
    return totalTokens;
  }

  // Time tracking with visibilityState
  async function setupTimeTracking() {
    if (window.timeTrackingInitialized) {
      console.log("Time tracking already initialized.");
      return;
    }
    window.timeTrackingInitialized = true;

    let startTime = null;
    let isActive = !document.hidden;

    // Start tracking if page is visible
    if (isActive) {
      startTime = Date.now();
    }

    // Save accumulated time to storage
    async function saveTimeToStorage(duration) {
      if (duration > 0) {
        const today = new Date().toISOString().split('T')[0];
  const storageData = await browser.storage.local.get(['timeSpent']);
  const timeSpent = storageData.timeSpent || {};
        
  // Add duration in seconds
  timeSpent[today] = (timeSpent[today] || 0) + Math.floor(duration / 1000);
  await browser.storage.local.set({ timeSpent });
        
        console.log(`Saved ${Math.floor(duration / 1000)} seconds to storage`);
      }
    }

    // Handle visibility change
    document.addEventListener('visibilitychange', async () => {
      if (document.hidden) {
        // Page became hidden - save accumulated time
        if (isActive && startTime) {
          const duration = Date.now() - startTime;
          await saveTimeToStorage(duration);
          startTime = null;
        }
        isActive = false;
      } else {
        // Page became visible - start tracking
        isActive = true;
        startTime = Date.now();
      }
    });

    // Periodic save every 30 seconds while active
    setInterval(async () => {
      if (isActive && startTime) {
        const duration = Date.now() - startTime;
        await saveTimeToStorage(duration);
        startTime = Date.now(); // Reset start time after saving
      }
    }, 30000); // 30 seconds

    // Save time before page unload
    window.addEventListener('beforeunload', async () => {
      if (isActive && startTime) {
        const duration = Date.now() - startTime;
        await saveTimeToStorage(duration);
      }
    });

    console.log("Time tracking initialized.");
  }

  // Tracks new messages and updates count in real-time
  async function setupPromptObserver() {
    if (window.promptObserverInitialized) {
      console.log("Prompt observer already initialized.");
      return;
    }
    window.promptObserverInitialized = true;

    let lastPromptCount = getCurrentChatPrompts();
    let lastTokenCount = getCurrentTokenCount();
    let updateTimeout = null;

  async function updateCount() {
    clearTimeout(updateTimeout); // Always clear previous timeout
    updateTimeout = setTimeout(async () => {
      const currentDOMPromptCount = getCurrentChatPrompts();
      const currentDOMTokenCount = getCurrentTokenCount();
      
      if (currentDOMPromptCount !== lastPromptCount || currentDOMTokenCount !== lastTokenCount) {
        const promptDiff = currentDOMPromptCount - lastPromptCount;
        const tokenDiff = currentDOMTokenCount - lastTokenCount;
        
        if (promptDiff > 0 || tokenDiff > 0) {
          const today = new Date().toISOString().split("T")[0];
          const storageData = await browser.storage.local.get(["promptCounts", "tokenCounts", "timeSpent"]);
          const promptCounts = storageData.promptCounts || {};
          const tokenCounts = storageData.tokenCounts || {};
          const timeSpent = storageData.timeSpent || {};
          
          if (promptDiff > 0) {
            promptCounts[today] = (promptCounts[today] || 0) + promptDiff;
          }
          if (tokenDiff > 0) {
            tokenCounts[today] = (tokenCounts[today] || 0) + tokenDiff;
          }
          
          await browser.storage.local.set({ promptCounts, tokenCounts });

          const sortedDates = Object.keys(promptCounts).sort();
          const values = sortedDates.map(d => promptCounts[d]);
          const timeValues = sortedDates.map(d => timeSpent[d] || 0);

          const totalPromptCount = promptCounts[today] || 0;
          const totalTokenCount = tokenCounts[today] || 0;
          const totalTimeSpent = timeSpent[today] || 0;
          updateFloatingContent(totalPromptCount, totalTokenCount, totalTimeSpent, values, timeValues);
          showFloating();
        }
        lastPromptCount = currentDOMPromptCount;
        lastTokenCount = currentDOMTokenCount;
      }
    }, 500); // Debounce period
  }


    const chatObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length) {
          const hasNewMessage = Array.from(mutation.addedNodes).some(node =>
            node.nodeType === 1 && node.hasAttribute("data-message-author-role")
          );
          if (hasNewMessage) updateCount();
        }
      }
    });

    function observeChat() {
      const chatContainer = document.querySelector("main div.flex.flex-col.text-sm");
      if (chatContainer) {
        chatObserver.observe(chatContainer, { childList: true, subtree: true });
        updateCount();
        console.log("Chat observer setup complete.");
      } else {
        console.log("Chat container not found, retrying...");
        setTimeout(observeChat, 1000);
      }
    }

    observeChat();
  }


  function isFloatingVisible() {
    const floating = document.getElementById(FLOATING_ID);
    return floating && floating.style.display !== 'none';
  }

  function showFloating() {
    const floating = document.getElementById(FLOATING_ID);
    if (floating) floating.style.display = 'block';
  }

  function hideFloating() {
    const floating = document.getElementById(FLOATING_ID);
    if (floating) floating.style.display = 'none';
  }

  // Rotating insights
  function getRotatingInsight(count, timeSpentHours) {
    const insights = [
      `"use your brain cuh..." ~gandhi, 1979`,
      `Could've used ${timeSpentHours} gettin sum' bitches`,
      `${count} prompts, yet no rizz :/`
    ];
    
    if (!window.currentInsightIndex) {
      window.currentInsightIndex = 0;
    }
    
    return insights[window.currentInsightIndex % insights.length];
  }

  function addDashboard(count, tokenCount, timeSpentHours, water, co2, energy, chartData, timeChartData) {
      let floating = document.getElementById("prompt-counter-floating");
      if (!floating) {
        floating = document.createElement("div");
        floating.id = "prompt-counter-floating";
        // wrapper doesn't receive pointer events so underlying UI still works;
        // inner card will handle pointer events (clicks) if needed
        floating.style.cssText = `
          position: fixed;
          left: 0;
          top: 0;
          transform: translate(0, 0);
          z-index: 2147483647;
          pointer-events: none;
          transition: opacity 140ms ease, transform 80ms ease;
          opacity: 0.95;
        `;

        const card = document.createElement("div");
        card.id = "prompt-counter-floating-card";
        card.style.cssText = `
          pointer-events: auto; 
          background: rgba(20,20,30,0.95);
          color: #f5f5f5;
          padding: 16px;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1);
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.15);
        `;

        card.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:10px;min-width:250px;max-width:360px;">
            <!-- Header Row with Prompts, Tokens & Time -->
            <div style="display:flex;gap:10px;">
              <div style="flex:1;background:rgba(59,130,246,0.15);padding:10px 12px;border-radius:8px;border:1px solid rgba(59,130,246,0.3);">
                <div style="font-size:11px;opacity:0.8;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">Prompts</div>
                <div id="pc-count" style="font-size:20px;font-weight:800;color:#60a5fa;">${count}</div>
              </div>
              <div style="flex:1;background:rgba(168,85,247,0.15);padding:10px 12px;border-radius:8px;border:1px solid rgba(168,85,247,0.3);">
                <div style="font-size:11px;opacity:0.8;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">Tokens</div>
                <div id="pc-token-count" style="font-size:20px;font-weight:800;color:#c084fc;">${tokenCount}</div>
              </div>
            </div>
            
            <!-- Time Spent Card -->
            <div style="background:rgba(236,72,153,0.15);padding:10px 12px;border-radius:8px;border:1px solid rgba(236,72,153,0.3);">
              <div style="font-size:11px;opacity:0.8;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">⏱️ Time Spent</div>
              <div id="pc-time-spent" style="font-size:20px;font-weight:800;color:#ec4899;">${timeSpentHours}</div>
            </div>
            
            <!-- Single Chart Section that alternates -->
            <div style="background:rgba(255,255,255,0.05);border-radius:8px;border:1px solid rgba(255,255,255,0.1);transition:all 0.3s ease;">
              <div id="pc-chart-label" style="font-size:11px;opacity:0.7;margin-bottom:6px;margin-left:10px; margin-top:10px; text-transform:uppercase;letter-spacing:0.5px;transition:opacity 0.3s ease;">📊 Prompt Activity</div>
              <canvas id="pc-chart" width="200" height="45" style="display:block;width:100%;"></canvas>
            </div>

            <!-- Environmental Impact Grid -->
            <div style="text-align:center;margin-top:5px;"><span style="font-style:bold; color:rgba(255,255,255,0.7);font-size:14px;">USAGE</span></div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
              <div style="background:rgba(56,189,248,0.15);padding:8px;border-radius:6px;border:1px solid rgba(56,189,248,0.3);text-align:center;">
                <div style="font-size:18px;margin-bottom:2px;">💧</div>
                <div style="font-size:13px;font-weight:700;color:#38bdf8;">${water}</div>
                <div style="font-size:9px;opacity:0.7;margin-top:2px;">mL water</div>
              </div>
              <div style="background:rgba(251,146,60,0.15);padding:8px;border-radius:6px;border:1px solid rgba(251,146,60,0.3);text-align:center;">
                <div style="font-size:18px;margin-bottom:2px;">🔥</div>
                <div style="font-size:13px;font-weight:700;color:#fb923c;">${co2}</div>
                <div style="font-size:9px;opacity:0.7;margin-top:2px;">g CO2e</div>
              </div>
              <div style="background:rgba(74,222,128,0.15);padding:8px;border-radius:6px;border:1px solid rgba(74,222,128,0.3);text-align:center;">
                <div style="font-size:18px;margin-bottom:2px;">⚡</div>
                <div style="font-size:13px;font-weight:700;color:#4ade80;">${energy}</div>
                <div style="font-size:9px;opacity:0.7;margin-top:2px;">Wh energy</div>
              </div>
            </div>
            
            <div style="text-align:center;margin-top:2px;"><span style="font-style:bold; color:rgba(255,255,255,0.7);font-size:14px;">INSIGHT</span></div>
            <div id="rotating-insight" style="text-align:center;transition:opacity 0.3s ease;">
              <span style="font-style:italic; color:rgba(255,255,255,0.7);font-size:12px;">${getRotatingInsight(count, timeSpentHours)}</span>
            </div>
          </div>
        `;

        floating.appendChild(card);
        document.body.appendChild(floating);

        // Store chart data globally for alternation
        window.chartData = chartData;
        window.timeChartData = timeChartData;
        window.currentChartType = 'prompts'; // Start with prompts

        // Setup chart alternation
        setInterval(() => {
          if (isFloatingVisible() && window.chartData && window.timeChartData) {
            const chartLabel = document.getElementById("pc-chart-label");
            
            // Toggle chart type
            window.currentChartType = window.currentChartType === 'prompts' ? 'time' : 'prompts';
            
            // Fade out label
            if (chartLabel) {
              chartLabel.style.opacity = '0';
              
              setTimeout(() => {
                if (window.currentChartType === 'prompts') {
                  chartLabel.textContent = '📊 Prompt Activity';
                  updateChart(window.chartData, 'prompts');
                } else {
                  chartLabel.textContent = '⏱️ Time Activity';
                  updateChart(window.timeChartData, 'time');
                }
                chartLabel.style.opacity = '0.7';
              }, 300);
            }
          }
        }, 4000); // Change every 4 seconds

        setInterval(() => {
          const insightEl = document.getElementById("rotating-insight");
          if (insightEl && isFloatingVisible()) {
            window.currentInsightIndex = (window.currentInsightIndex || 0) + 1;
            const newInsight = getRotatingInsight(count, timeSpentHours);
            
            // Fade out
            insightEl.style.opacity = '0';
            
            setTimeout(() => {
              insightEl.innerHTML = `<span style="font-style:italic; color:rgba(255,255,255,0.7);font-size:12px;">${newInsight}</span>`;
              // Fade in
              insightEl.style.opacity = '1';
            }, 300);
          }
        }, 4000); // Change every 4 seconds

        // Move floating with cursor, with an offset so it doesn't sit under the pointer
        let mouseMoveHandler = (ev) => {
          const x = ev.clientX + 18; // offset X
          const y = ev.clientY + 18; // offset Y
          floating.style.left = x + "px";
          floating.style.top = y + "px";
        };

        // Show on mouse move and attach listener
        document.addEventListener("mousemove", mouseMoveHandler, { passive: true });

        // Allow closing with Escape
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            floating.style.display = "none";
          }
        });
      }

      const countEl = document.getElementById("pc-count");
      const tokenCountEl = document.getElementById("pc-token-count");
      const timeSpentEl = document.getElementById("pc-time-spent");
      const card = document.getElementById("prompt-counter-floating-card");
      
      if (countEl) {
        countEl.textContent = count;
        countEl.classList.add('updating');
        card.classList.add('updating');
        
        setTimeout(() => {
          countEl.classList.remove('updating');
          card.classList.remove('updating');
        }, 1200);
      }
      
      if (tokenCountEl) {
        tokenCountEl.textContent = tokenCount;
      }
      
      if (timeSpentEl) {
        timeSpentEl.textContent = timeSpentHours;
      }

      // Store chart data for alternation
      window.chartData = chartData;
      window.timeChartData = timeChartData;

      // Initialize chart with prompt data
      updateChart(chartData, 'prompts');
      return;
  }

  // Function to update chart with transition
  function updateChart(data, type) {
    const canvas = document.querySelector("#prompt-counter-floating #pc-chart") || document.querySelector("#pc-chart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (window.pcChart) window.pcChart.destroy();

    const isPrompts = type === 'prompts';
    const borderColor = isPrompts ? "rgba(59,130,246,1)" : "rgba(236,72,153,1)";
    const backgroundColor = isPrompts ? "rgba(59,130,246,0.15)" : "rgba(236,72,153,0.15)";
    const label = isPrompts ? "Prompts" : "Time (hours)";

    window.pcChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.labels,
        datasets: [{
          label: label,
          data: data.values,
          borderColor: borderColor,
          backgroundColor: backgroundColor,
          tension: 0.3,
          fill: true,
          pointRadius: 0,
          pointBackgroundColor: borderColor
        }]
      },
      options: {
        responsive: false,
        animation: {
          duration: 800,
          easing: 'easeInOutQuart'
        },
        plugins: { legend: { display: false } },
        scales: { 
          x: { display: false }, 
          y: { display: false, beginAtZero: true } 
        },
        elements: { line: { borderWidth: 2 } }
      }
    });
  }

  function updateFloatingContent(count, tokenCount, timeSpentSeconds, historicalValues = [], historicalTimeValues = []) {
    const water = (count * 0.26).toFixed(3);
    const co2 = (count * 0.03).toFixed(1);
    const energy = (count * 0.24).toFixed(3);
    
    // Convert seconds to hours with 2 decimal places
    const hours = (timeSpentSeconds / 3600).toFixed(2);
    const timeSpentHours = `${hours}h`;
    
    const today = new Date();
    const labels = historicalValues.map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (historicalValues.length - 1 - i));
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });

    // Convert time values from seconds to hours for the chart
    const timeValuesInHours = historicalTimeValues.map(seconds => (seconds / 3600).toFixed(2));

    addDashboard(count, tokenCount, timeSpentHours, water, co2, energy, 
      { labels, values: historicalValues },
      { labels, values: timeValuesInHours }
    );
  }

  function addButton() {
    const trailing = document.querySelector("div.ms-auto.flex.items-center.gap-1\\.5");
    if (!trailing) return;

    if (trailing.querySelector("#prompt-counter-btn")) return;

    const btn = document.createElement("button");
    btn.id = "prompt-counter-btn";
    btn.type = "button";
    btn.textContent = "🌳";
    btn.className =
      "flex h-9 items-center justify-center rounded-full disabled:text-gray-50 disabled:opacity-30 w-9 composer-secondary-button-color hover:opacity-80";

    // Simply toggle visibility when clicking the button
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      if (isFloatingVisible()) {
        hideFloating();
      } else {
        // Get latest count and show
        const storedPromptCount = await getUserPromptCount();
        const storedTokenCount = await getUserTokenCount();
        const storedTimeSpent = await getUserTimeSpent();
        browser.storage.local.get(["promptCounts", "timeSpent"]).then(({ promptCounts = {}, timeSpent = {} }) => {
          const sortedDates = Object.keys(promptCounts).sort();
          const values = sortedDates.map(d => promptCounts[d]);
          const timeValues = sortedDates.map(d => timeSpent[d] || 0);

          updateFloatingContent(storedPromptCount, storedTokenCount, storedTimeSpent, values, timeValues);
          showFloating();
        });
      }
    });

    trailing.appendChild(btn);
  }

  // Load everything only after Chart.js is available
  loadChartJS(() => {
    injectInlineCSS();
    addButton();
    setupPromptObserver(); // Start tracking prompts
    setupTimeTracking(); // Start tracking time

    // Observe for later DOM changes to ensure button stays
    const observer = new MutationObserver(() => addButton());
    observer.observe(document.body, { childList: true, subtree: true });
  });

}

window.addEventListener("load", injectPromptCounterButton);
