function injectPromptCounterButton() {
  const SIDEBAR_ID = "prompt-counter-sidebar";
  const CONTENT_ID = "prompt-counter-sidebar-content";
  const SIDEBAR_WIDTH = 320; // px
  const THEME_KEY = "prompt-counter-theme";

  // Load Chart.js first, wait until it's ready
  function loadChartJS(callback) {
    if (window.Chart) return callback();
    const chartScript = document.createElement("script");
  chartScript.src = browser.runtime.getURL("chart.min.js");
    chartScript.onload = callback;  // Wait for Chart.js before proceeding
    document.head.appendChild(chartScript);
  }

  function injectInlineCSS() {
    const style = document.createElement("style");
    style.textContent = `
      .stats-container {
        display: flex;
        flex-direction: column;
        gap: 20px; /* gap-5 ≈ 1.25rem ≈ 20px */
      }

      .stats-card {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 12px; /* p-3 ≈ 0.75rem ≈ 12px */
        border: 1px dotted #4ade80; /* border-green-400 */
        border-radius: 12px; /* rounded-xl ≈ 0.75rem ≈ 12px */
      }

      .stats-title {
        font-size: 15px;
      }

      .stats-value {
        font-size: 28px;
        font-weight: 800;
        margin-top: 6px;
      }

      .metric-card {
        flex: 1;
        background: rgba(0, 0, 0, 0.02);
        padding: 8px;
        border-radius: 8px;
        text-align: center;
      }

      .metric-emoji {
        font-size: 16px;
      }

      .metric-value {
        font-weight: 700;
        margin-top: 6px;
        font-size: 15px;
      }

      .metric-label {
        font-size: 11px;
      }

    `;
    document.head.appendChild(style);
  }

  function updatePromptCount(userId, newCount) {
    const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
    browser.storage.sync.get(["promptCounts"]).then(({ promptCounts }) => {
      promptCounts = promptCounts || {};

      if (!promptCounts[userId]) promptCounts[userId] = {};
      if (!promptCounts[userId][today]) promptCounts[userId][today] = 0;

      promptCounts[userId][today] += newCount;

      return browser.storage.sync.set({ promptCounts }).then(() => {
        console.log("Updated count:", promptCounts[userId][today]);
      });
    });
  }

  function getTheme() {
    return localStorage.getItem(THEME_KEY) || "dark";
  }

  function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme();
  }

  function toggleTheme() {
    setTheme(getTheme() === "light" ? "dark" : "light");
  }

  function applyTheme() {
    const sb = document.getElementById(SIDEBAR_ID);
    if (!sb) return;
    const theme = getTheme();
    if (theme === "dark") {
      sb.style.setProperty("--bg", "#212121");
      sb.style.setProperty("--fg", "#f5f5f5");
      sb.style.setProperty("--muted", "#aaa");
    } else {
      sb.style.setProperty("--bg", "#fff");
      sb.style.setProperty("--fg", "#000");
      sb.style.setProperty("--muted", "#666");
    }
  }

  function getUserPromptCount() {
    return document.querySelectorAll('[data-message-author-role="user"]').length;
  }

  function addDashboard(count, water, fire, tree, chartData) {
    const sidebarContent = document.getElementById(CONTENT_ID);
    if (!sidebarContent) return;

    // Check if dashboard container already exists
    let container = sidebarContent.querySelector(".stats-container");
    if (!container) {
      // Create container and inject HTML only once
      container = document.createElement("div");
      container.className = "stats-container";

      container.innerHTML = `
        <div class="stats-card">
          <div class="stats-title">Prompts sent</div>
          <div id="pc-count" class="stats-value">${count}</div>
          <canvas id="pc-chart" style="max-width: 100%; margin-top: 16px;"></canvas>
        </div>

        <div class="stats-card metric-card">
          <div class="metric-emoji">💦</div>
          <div id="pc-water" class="metric-value">${water}</div>
          <div class="metric-label">water</div>
        </div>

        <div class="stats-card metric-card">
          <div class="metric-emoji">🔥</div>
          <div id="pc-fire" class="metric-value">${fire}</div>
          <div class="metric-label">fire</div>
        </div>

        <div class="stats-card metric-card">
          <div class="metric-emoji">🌳</div>
          <div id="pc-tree" class="metric-value">${tree}</div>
          <div class="metric-label">tree</div>
        </div>
      `;

      sidebarContent.appendChild(container);
    } else {
      // Update existing values
      container.querySelector("#pc-count").textContent = count;
      container.querySelector("#pc-water").textContent = water;
      container.querySelector("#pc-fire").textContent = fire;
      container.querySelector("#pc-tree").textContent = tree;
    }

    // Initialize Chart.js after the canvas is in the DOM
    const canvas = container.querySelector("#pc-chart");
    if (canvas) {
      const ctx = canvas.getContext("2d");

      // Destroy existing chart instance if it exists to prevent duplicates
      if (window.pcChart) {
        window.pcChart.destroy();
      }

      window.pcChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: chartData.labels,   // e.g., ["Mon", "Tue", "Wed"]
          datasets: [{
            label: "Prompts Sent",
            data: chartData.values,   // e.g., [5, 7, 4]
            borderColor: "rgba(75, 192, 192, 1)",
            backgroundColor: "rgba(75, 192, 192, 0.1)",
            tension: 0.3,
            fill: true,
            pointRadius: 3,
            pointBackgroundColor: "rgba(75, 192, 192, 1)"
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false } },
            y: { grid: { color: "rgba(0,0,0,0.05)" } }
          }
        }
      });
    }
  }

  function createSidebarIfNeeded() {
    let sidebar = document.getElementById(SIDEBAR_ID);
    if (sidebar) return sidebar;

    sidebar = document.createElement("div");
    sidebar.id = SIDEBAR_ID;
    sidebar.style.cssText = `
      position: fixed;
      top: 0;
      right: -${SIDEBAR_WIDTH}px;
      width: ${SIDEBAR_WIDTH}px;
      height: 100%;
      background: var(--bg, #fff);
      color: var(--fg, #000);
      border-left: 1px solid rgba(0,0,0,0.08);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: right 280ms cubic-bezier(.2,.8,.2,1);
      z-index: 1000;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
    `;

    // Header with title + close button
    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;";

    const title = document.createElement("div");
    title.textContent = "Your ChatGPT Statistics";
    title.style.cssText = "font-weight:700;font-size:20px";

    const btnWrap = document.createElement("div");
    btnWrap.style.cssText = "display:flex;gap:6px;";

    const themeBtn = document.createElement("button");
    themeBtn.id = "theme-toggle-btn";
    themeBtn.textContent = "🌗";
    themeBtn.style.cssText = "background:none;border:none;font-size:16px;cursor:pointer;padding:4px";
    themeBtn.addEventListener("click", toggleTheme);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✖";
    closeBtn.style.cssText = "background:none;border:none;font-size:16px;cursor:pointer;padding:4px";
    closeBtn.addEventListener("click", closeSidebar);

    btnWrap.appendChild(themeBtn);
    btnWrap.appendChild(closeBtn);

    header.appendChild(title);
    header.appendChild(btnWrap);

    sidebar.appendChild(header);

    const footer = document.createElement("div");
    footer.id = "sidebar-footer";
    footer.style.cssText = "display: flex; align-items:center; justify-content:space-between; gap:8px";

    const lastUpdatedOn = document.createElement("span");
    lastUpdatedOn.innerHTML = 
    `
      <div style="margin-top:12px;font-size:12px;">
        Updated: ${new Date().toLocaleString()}
      </div>
    `
    const credits = document.createElement("span");
    credits.textContent = "Made by PS <3";
    credits.style.cssText = "margin-top:12px;font-size:12px;"

    footer.appendChild(lastUpdatedOn);
    footer.appendChild(credits);

    const content = document.createElement("div");
    content.id = CONTENT_ID;
    content.style.cssText = "flex:1 1 auto; overflow:auto; padding-right:4px;";

    sidebar.appendChild(content);
    sidebar.appendChild(footer);
    document.body.appendChild(sidebar);

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && isSidebarOpen()) closeSidebar();
    });

    document.addEventListener("mousedown", (ev) => {
      const sb = document.getElementById(SIDEBAR_ID);
      if (!sb) return;
      if (sb.getAttribute("data-open") === "true") {
        if (!sb.contains(ev.target) && !ev.target.closest("#prompt-counter-btn")) {
          closeSidebar();
        }
      }
    });

    // Mark closed initially
    sidebar.setAttribute("data-open", "false");

    return sidebar;
  }

  function isSidebarOpen() {
    const sb = document.getElementById(SIDEBAR_ID);
    return !!sb && sb.getAttribute("data-open") === "true";
  }

  function openSidebar() {
    const sb = createSidebarIfNeeded();
    sb.style.right = "0";
    sb.setAttribute("data-open", "true");
  }

  function closeSidebar() {
    const sb = document.getElementById(SIDEBAR_ID);
    if (!sb) return;
    sb.style.right = `-${SIDEBAR_WIDTH}px`;
    sb.setAttribute("data-open", "false");
  }

  function toggleSidebar(newCount) {
    const sb = createSidebarIfNeeded();

    // Authenticate once
      browser.runtime.sendMessage({ type: "GET_AUTH_TOKEN" }).then((resp) => {
      if (!resp || !resp.success) {
        console.error("Auth failed", resp && resp.error);
        return;
      }

      const token = resp.token;

      fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: "Bearer " + token }
      })
        .then(res => res.json())
        .then(user => {
          const userId = user.id;

          browser.storage.sync.get(["promptCounts"]).then(({ promptCounts }) => {
            promptCounts = promptCounts || {};
            const userCounts = promptCounts[userId] || {};

            const today = new Date().toISOString().split("T")[0];
            const currentCount = userCounts[today] || 0;
            const updatedCount = currentCount + (newCount || 0);

            // Save updated count back to storage
            userCounts[today] = updatedCount;
            promptCounts[userId] = userCounts;

            browser.storage.sync.set({ promptCounts }).then(() => {
              // Prepare chart data
              const sortedDates = Object.keys(userCounts).sort();
              const values = sortedDates.map(d => userCounts[d]);

              updateSidebarContent(updatedCount, values);

              // Open / close sidebar after data is ready
              if (sb.getAttribute("data-open") === "true") {
                closeSidebar();
              } else {
                openSidebar();
              }
            });
          });
        })
        .catch(err => console.error(err));
    });
  }

  function updateSidebarContent(count, historicalValues = []) {
    const content = document.getElementById(CONTENT_ID) || createSidebarIfNeeded().querySelector(`#${CONTENT_ID}`);
    if (!content) return;

    const water = (count * 0.0025).toFixed(3);
    const fire = (count * 1.2).toFixed(1);
    const tree = (count * 0.001).toFixed(3);

    const today = new Date();
    const labels = historicalValues.map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (historicalValues.length - 1 - i));
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });

    addDashboard(count, water, fire, tree, { labels, values: historicalValues });
  }

  function addButton() {
    const trailing = document.querySelector("div.flex.items-center.gap-2");
    if (!trailing) return;

    // Prevent duplicate
    if (trailing.querySelector("#prompt-counter-btn")) return;

    const btn = document.createElement("button");
    btn.id = "prompt-counter-btn";
    btn.type = "button";
    btn.textContent = "🌳";
    btn.className =
      "flex h-9 items-center justify-center rounded-full disabled:text-gray-50 disabled:opacity-30 w-9 composer-secondary-button-color hover:opacity-80";

    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const newCount = getUserPromptCount(); // your function
      toggleSidebar(newCount);
    });

    trailing.appendChild(btn);
  }

  // Load everything only after Chart.js is available
  loadChartJS(() => {
    injectInlineCSS();
    createSidebarIfNeeded();
    addButton();

    // Observe for later DOM changes
    const observer = new MutationObserver(() => addButton());
    observer.observe(document.body, { childList: true, subtree: true });
  });

}

window.addEventListener("load", injectPromptCounterButton);
