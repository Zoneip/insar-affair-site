/* Reproduction track: F1–L lines, training curves, throughput, status table. */
(() => {
  "use strict";

  const root = document.documentElement;
  const tok = (n, fb) => (getComputedStyle(root).getPropertyValue(n).trim() || fb);
  const CLS = [tok("--c1", "#0f766e"), tok("--c2", "#d97706"),
               tok("--c3", "#4a6fa5"), tok("--c4", "#9aa5b1")];
  const INK = tok("--ink", "#1b2a33");
  const MUTED = tok("--muted", "#6e6a60");
  const FAINT = tok("--faint", "#9a958a");
  const LINE = tok("--line", "#e7e2d6");

  const $ = (id) => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs) {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
    return n;
  }

  function frame(width, height) {
    const svg = svgEl("svg", {
      viewBox: `0 0 ${width} ${height}`, width: "100%", height,
      role: "img", "aria-label": "chart",
    });
    return svg;
  }

  function axes(svg, box, xTicks, yTicks, fmtX, fmtY) {
    const { l, t, w, h } = box;
    svg.append(svgEl("line", { x1: l, y1: t + h, x2: l + w, y2: t + h, stroke: LINE }));
    svg.append(svgEl("line", { x1: l, y1: t, x2: l, y2: t + h, stroke: LINE }));
    yTicks.forEach((v) => {
      const y = t + h - v.pos * h;
      svg.append(svgEl("line", { x1: l, y1: y, x2: l + w, y2: y,
        stroke: "#00000008" }));
      const label = svgEl("text", { x: l - 8, y: y + 3, "text-anchor": "end",
        "font-size": 10, fill: FAINT, "font-family": "var(--font-mono)" });
      label.textContent = fmtY(v.value);
      svg.append(label);
    });
    xTicks.forEach((v) => {
      const x = l + v.pos * w;
      const label = svgEl("text", { x, y: t + h + 16, "text-anchor": "middle",
        "font-size": 10, fill: FAINT, "font-family": "var(--font-mono)" });
      label.textContent = fmtX(v.value);
      svg.append(label);
    });
  }

  function lineChart(host, series, opts) {
    const o = Object.assign({ w: 760, h: 260, pad: 34, yMin: null, yMax: null }, opts || {});
    const svg = frame(o.w, o.h);
    const box = { l: o.pad + 18, t: 14, w: o.w - o.pad - 34, h: o.h - o.pad - 26 };
    const xs = series[0].points.map((p) => p.x);
    const all = series.flatMap((s) => s.points.map((p) => p.y));
    const yMin = o.yMin !== null ? o.yMin : Math.min(...all);
    const yMax = o.yMax !== null ? o.yMax : Math.max(...all);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const nx = (v) => (xMax === xMin ? 0.5 : (v - xMin) / (xMax - xMin));
    const ny = (v) => (yMax === yMin ? 0.5 : (v - yMin) / (yMax - yMin));

    axes(svg,
      box,
      xs.map((v) => ({ value: v, pos: nx(v) })),
      [0, 0.25, 0.5, 0.75, 1].map((p) => ({ value: yMin + (yMax - yMin) * p, pos: p })),
      o.fmtX || ((v) => v),
      o.fmtY || ((v) => v.toFixed(2)),
    );

    series.forEach((s) => {
      const pts = s.points
        .map((p) => `${box.l + nx(p.x) * box.w},${box.t + box.h - ny(p.y) * box.h}`)
        .join(" ");
      svg.append(svgEl("polyline", {
        points: pts, fill: "none", stroke: s.color, "stroke-width": 1.6,
        "stroke-dasharray": s.dash ? "4 3" : "0",
        "stroke-linejoin": "round", "stroke-linecap": "round",
      }));
      s.points.forEach((p) => {
        if (s.dot === false) return;
        svg.append(svgEl("circle", {
          cx: box.l + nx(p.x) * box.w, cy: box.t + box.h - ny(p.y) * box.h,
          r: 2.2, fill: s.color,
        }));
      });
    });
    host.append(svg);
  }

  function legend(host, items) {
    const box = document.createElement("div");
    box.className = "viz-legend";
    box.innerHTML = items.map(([label, color]) =>
      `<span class="viz-chip"><i style="background:${color}"></i>${label}</span>`).join("");
    host.append(box);
  }

  function f1Chart(host, data) {
    const series = data.runs.map((r, i) => ({
      label: r.label, color: CLS[i % CLS.length],
      points: r.tests.map((t) => ({ x: t.L, y: t.f1 })),
    }));
    const ys = series.flatMap((s) => s.points.map((p) => p.y));
    const lo = Math.floor((Math.min(...ys) - 0.015) * 50) / 50;
    const hi = Math.ceil((Math.max(...ys) + 0.015) * 50) / 50;
    lineChart(host, series, {
      h: 300, yMin: lo, yMax: hi,
      fmtY: (v) => v.toFixed(2), fmtX: (v) => `L=${v}`,
    });
    legend(host, series.map((s) => [s.label, s.color]));
  }

  function curveCharts(host, run) {
    host.innerHTML = "";
    const h = run.history || [];
    const epochs = h.map((x) => x.epoch);
    lineChart(host, [
      { label: "train", color: CLS[0], points: h.map((x) => ({ x: x.epoch, y: x.train_loss })) },
      { label: "val", color: CLS[1], dash: true, dot: false,
        points: h.map((x) => ({ x: x.epoch, y: x.val_loss })) },
    ], { h: 240, fmtX: (v) => `${v}`, fmtY: (v) => v.toFixed(2) });
    lineChart(host, [
      { label: "val F1", color: CLS[2], points: h.map((x) => ({ x: x.epoch, y: x.val_f1 })) },
    ], { h: 240, yMin: 0.5, yMax: 1.0, fmtX: (v) => `${v}`, fmtY: (v) => v.toFixed(2) });
    legend(host, [["train loss", CLS[0]], ["val loss", CLS[1]], ["val F1（右图）", CLS[2]]]);
    if (!epochs.length) host.textContent = "该 run 缺少历史记录";
  }

  function throughput(host, data) {
    const rows = data.runs.map((r) => {
      const per_epoch = (r.patches_epoch || 0);
      const tput = r.seconds ? (per_epoch * r.epochs) / r.seconds : 0;
      return { label: r.label, tput };
    }).sort((a, b) => b.tput - a.tput);
    const peak = Math.max(...rows.map((r) => r.tput)) || 1;
    host.innerHTML = `<div class="repro-bars">${rows.map((r) => `
      <div class="repro-bar">
        <span class="repro-bar-label">${r.label}</span>
        <span class="viz-bar"><i style="width:${(r.tput / peak) * 100}%"></i></span>
        <span class="repro-bar-value">${r.tput.toFixed(0)} patch/s</span>
      </div>`).join("")}</div>`;
  }

  const STATUS = [
    ["合成信号模型（Sec. II–III）", "done", "6 项物理自检全部通过，Eq. 6 方向已按原文修正"],
    ["在线数据生成（Sec. IV）", "done", "多进程在线生成，128×128 patch，四类合成场景"],
    ["全卷积网络（Sec. V-A / Fig. 7）", "done", "参数量与 Table IV 对齐（5 blocks = 1,083,908）"],
    ["训练流程（Sec. V-B）", "done", "Eq. 35 学习率日程、加权 F1 评估"],
    ["Table IV 精度对齐", "partial", "规模差 3 个数量级（3.7 亿 vs 1.5 万 patch/轮），只作定性对照"],
    ["PCD 统计对比（Sec. VI）", "todo", "论文的 PCD 指标未实现，缺定义与数据"],
    ["真实数据：冰岛 Sentinel-1", "todo", "无数据、无预处理链"],
    ["真实数据：TanDEM-X 露天矿", "todo", "无数据；β0 二次转换的风险已在缺陷页记录"],
  ];

  function statusTable(host) {
    const mark = { done: "已复现", partial: "部分", todo: "未开始" };
    host.innerHTML = `<table class="viz-cm repro-status">
      <thead><tr><th>论文环节</th><th>状态</th><th>说明</th></tr></thead>
      <tbody>${STATUS.map(([name, s, note]) => `
        <tr><td>${name}</td>
        <td><span class="pill pill-${s}">${mark[s]}</span></td>
        <td>${note}</td></tr>`).join("")}</tbody></table>`;
  }

  async function boot() {
    const host = $("repro-f1");
    if (!host) return;
    let data;
    try {
      const res = await fetch("data.json", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      data = await res.json();
    } catch (err) {
      host.innerHTML = `<p class="empty">数据加载失败：${err.message}</p>`;
      return;
    }
    f1Chart(host, data);
    throughput($("repro-tput"), data);
    statusTable($("repro-status"));

    const tabs = $("repro-runs");
    const curves = $("repro-curves");
    let current = data.runs[0].id;
    tabs.innerHTML = data.runs.map((r, i) =>
      `<button data-id="${r.id}" class="${r.id === current ? "active" : ""}">${r.label}</button>`).join("");
    const draw = () => curveCharts(curves, data.runs.find((r) => r.id === current));
    tabs.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      current = b.dataset.id;
      tabs.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
      draw();
    });
    draw();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
