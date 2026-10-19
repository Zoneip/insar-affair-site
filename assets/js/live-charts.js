/* Chart.js wrappers for the training dashboard (monochrome, no animation). */
window.LiveCharts = (() => {
  "use strict";

  const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  const INK = "#f2f2f2";
  const DIM = "#8a8a8a";
  const GRID = "rgba(255,255,255,.07)";

  const charts = {};

  if (window.Chart) {
    Chart.defaults.color = DIM;
    Chart.defaults.font.family = MONO;
    Chart.defaults.font.size = 10;
    Chart.defaults.animation = false;
  }

  function axis(title) {
    return {
      x: {
        grid: { color: GRID, drawTicks: false },
        border: { color: "#1f1f1f" },
        ticks: { color: DIM, maxRotation: 0, autoSkipPadding: 12 },
      },
      y: {
        grid: { color: GRID, drawTicks: false },
        border: { display: false },
        ticks: { color: DIM, padding: 8 },
        title: title ? { display: true, text: title, color: "#5a5a5a", font: { size: 9 } } : undefined,
      },
    };
  }

  const OPTIONS = (y) => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0d0d0d",
        borderColor: "#333",
        borderWidth: 1,
        titleFont: { family: MONO, size: 11 },
        bodyFont: { family: MONO, size: 11 },
        displayColors: false,
      },
    },
    scales: y,
  });

  function put(key, id, config) {
    const el = document.getElementById(id);
    if (!el) return;
    if (charts[key]) charts[key].destroy();
    charts[key] = new Chart(el, config);
  }

  function render(run, upto) {
    const history = run.history.slice(0, Math.max(upto, 1));
    const labels = history.map((h) => h.epoch);

    put("loss", "chartLoss", {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "train",
            data: history.map((h) => h.train_loss),
            borderColor: INK,
            backgroundColor: "rgba(242,242,242,.07)",
            fill: true,
            borderWidth: 1.4,
            pointRadius: 0,
            tension: 0.25,
          },
          {
            label: "val",
            data: history.map((h) => h.val_loss),
            borderColor: DIM,
            borderDash: [4, 3],
            borderWidth: 1.4,
            pointRadius: 0,
            tension: 0.25,
          },
        ],
      },
      options: OPTIONS(axis()),
    });

    put("f1", "chartF1", {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "val F1",
          data: history.map((h) => h.val_f1),
          borderColor: INK,
          backgroundColor: "rgba(242,242,242,.07)",
          fill: true,
          borderWidth: 1.4,
          pointRadius: 0,
          tension: 0.2,
        }],
      },
      options: OPTIONS(axis()),
    });

    const lrAxis = axis();
    lrAxis.y.type = "logarithmic";
    lrAxis.y.min = 5e-7;
    lrAxis.y.max = 2e-4;
    lrAxis.y.ticks.callback = (v) => Number(v).toExponential(0);
    put("lr", "chartLR", {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "lr",
          data: history.map((h) => h.lr),
          borderColor: "#c8c8c8",
          borderWidth: 1.4,
          pointRadius: 0,
          stepped: "before",
        }],
      },
      options: OPTIONS(lrAxis),
    });

    const Ls = Object.keys(run.tests || {});
    put("test", "chartTest", {
      type: "bar",
      data: {
        labels: Ls.map((L) => "L=" + L),
        datasets: [{
          label: "weighted F1",
          data: Ls.map((L) => run.tests[L].f1_weighted),
          backgroundColor: "#c8c8c8",
          hoverBackgroundColor: INK,
          borderWidth: 0,
          barPercentage: 0.62,
        }],
      },
      options: OPTIONS({ ...axis(), y: { ...axis().y, suggestedMin: 0.6, suggestedMax: 0.85 } }),
    });
  }

  return { render };
})();
