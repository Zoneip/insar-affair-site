/* Chart.js wrappers for the training dashboard (monochrome, no animation). */
window.LiveCharts = (() => {
  "use strict";

  const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  const INK = "#0a0a0a";
  const DIM = "#6b6b6b";
  const GRID = "rgba(0,0,0,.07)";

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
        border: { color: "#e3e3e3" },
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
        backgroundColor: "#ffffff",
        borderColor: "#d8d8d8",
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
            backgroundColor: "rgba(10,10,10,.06)",
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
          backgroundColor: "rgba(10,10,10,.06)",
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
          borderColor: "#9a9a9a",
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
          backgroundColor: "#b8b8b8",
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
