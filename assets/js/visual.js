/* Segmentation gallery: renders 64x64 class maps from docs/visual/data.json. */
(() => {
  "use strict";

  const root = document.documentElement;
  const tok = (name, fb) => (getComputedStyle(root).getPropertyValue(name).trim() || fb);
  const CLS = [tok("--c1", "#0f766e"), tok("--c2", "#d97706"),
               tok("--c3", "#4a6fa5"), tok("--c4", "#9aa5b1")];
  const NAMES = ["c0 稳定", "c1 变点", "c2 线性", "c3 周期"];
  const ERR = "#b23a2b";
  const PAPER = tok("--bg-soft", "#f2eee3");
  const INK = tok("--ink", "#1b2a33");
  const MUTED = tok("--muted", "#6e6a60");

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  };

  function hex2rgb(h) {
    const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
    if (!m) return [15, 118, 110];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function paint(canvas, map, side, mode, gt) {
    const dpr = window.devicePixelRatio || 1;
    const css = canvas.clientWidth || 168;
    canvas.width = css * dpr;
    canvas.height = css * dpr;
    const ctx = canvas.getContext("2d");
    const cell = (css * dpr) / side;
    const rgb = CLS.map(hex2rgb);
    const paper = hex2rgb(PAPER);
    const ink = hex2rgb(INK);
    const err = hex2rgb(ERR);

    for (let y = 0; y < side; y += 1) {
      for (let x = 0; x < side; x += 1) {
        const i = y * side + x;
        let c;
        if (mode === "feat") {
          const v = Number(map[i]) / 9;
          c = [paper[0] + (ink[0] - paper[0]) * v,
               paper[1] + (ink[1] - paper[1]) * v,
               paper[2] + (ink[2] - paper[2]) * v];
        } else if (mode === "diff") {
          c = map[i] === gt[i] ? paper : err;
        } else {
          c = rgb[Number(map[i])] || paper;
        }
        ctx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
        ctx.fillRect(x * cell, y * cell, cell + 0.6, cell + 0.6);
      }
    }
  }

  function figure(canvas, label, note) {
    const fig = el("figure", "viz-figure");
    fig.append(canvas);
    fig.append(el("figcaption", "", `${label}${note ? `<small>${note}</small>` : ""}`));
    return fig;
  }

  function kpi(label, value, note) {
    return `<div class="viz-kpi"><span>${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ""}</div>`;
  }

  function drawLegend(box) {
    box.innerHTML = CLS.map((c, i) =>
      `<span class="viz-chip"><i style="background:${c}"></i>${NAMES[i]}</span>`).join("")
      + `<span class="viz-chip"><i style="background:${ERR}"></i>错分像素</span>`;
  }

  function drawLevels(box, data) {
    const maxL = data.levels[data.levels.length - 1];
    box.innerHTML = data.levels.map((lv) => {
      const best = lv.samples[0];
      const bars = lv.recall.map((r, i) =>
        `<span class="viz-bar"><i style="width:${(r * 100).toFixed(0)}%;background:${CLS[i]}"></i></span>`).join("");
      return `<article class="viz-card">
        <header><strong>L = ${lv.L}</strong><span>${(lv.acc * 100).toFixed(1)}%</span></header>
        <canvas class="viz-heat" data-map="${best.pred}" data-side="${Math.sqrt(best.pred.length)}" data-mode="class" style="--cells:${Math.sqrt(best.pred.length)}"></canvas>
        <div class="viz-recall">${bars}</div>
      </article>`;
    }).join("");

    box.querySelectorAll("canvas.viz-heat").forEach((c) => {
      requestAnimationFrame(() => paint(c, c.dataset.map, Number(c.dataset.side), c.dataset.mode));
    });

    const top = data.levels.reduce((a, b) => (b.acc > a.acc ? b : a));
    const worstClass = top.recall.indexOf(Math.min(...top.recall));
    const kpis = el("div", "viz-kpis");
    kpis.innerHTML =
      kpi("最佳视数", `L=${top.L}`, `ACC ${(top.acc * 100).toFixed(1)}%`) +
      kpi("最弱类别", NAMES[worstClass].split(" ")[0], `召回 ${(top.recall[worstClass] * 100).toFixed(1)}%`) +
      kpi("输入尺寸", `${data.patch}×${data.patch}`, `${data.classes.length} 类逐像素`) +
      kpi("检查点", data.run, `epoch ${data.epoch}`);
    box.parentNode.insertBefore(kpis, box);
  }

  function drawSamples(box, tabs, data) {
    let current = data.levels[data.levels.length - 1].L;
    tabs.innerHTML = data.levels
      .map((lv) => `<button data-l="${lv.L}" class="${lv.L === current ? "active" : ""}">L=${lv.L}</button>`)
      .join("");

    function render() {
      const lv = data.levels.find((x) => x.L === current);
      box.innerHTML = "";
      lv.samples.forEach((s) => {
        const wrap = el("div", "viz-sample");
        const side = Math.sqrt(s.gt.length);
        const g = el("canvas", "viz-heat");
        const p = el("canvas", "viz-heat");
        const d = el("canvas", "viz-heat");
        [g, p, d].forEach((c) => { c.style.setProperty("--cells", side); });
        wrap.append(figure(g, "真值", ""));
        wrap.append(figure(p, "预测", ""));
        wrap.append(figure(d, "误差", ""));
        wrap.append(el("p", "viz-note",
          `<strong>${s.note === "best" ? "最好样本" : "最差样本"}</strong> 像素准确率 ${(s.acc * 100).toFixed(1)}%`));
        box.append(wrap);

        requestAnimationFrame(() => {
          paint(g, s.gt, side, "class");
          paint(p, s.pred, side, "class");
          paint(d, s.pred, side, "diff", s.gt);
        });
      });
    }

    tabs.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      current = Number(b.dataset.l);
      tabs.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
      render();
    });
    render();
  }

  function drawConfusion(box, data) {
    const lv = data.levels.reduce((a, b) => (b.acc > a.acc ? b : a));
    const cm = lv.confusion;
    const side = cm.length;
    const canvas = el("canvas", "viz-heat viz-heat-lg");
    canvas.style.setProperty("--cells", side);
    const table = el("table", "viz-cm");
    const head = `<thead><tr><th></th>${data.classes.map((c) => `<th>${c}</th>`).join("")}<th>召回</th></tr></thead>`;
    const rows = cm.map((row, i) => {
      const total = row.reduce((a, b) => a + b, 0) || 1;
      const cells = row.map((v, j) => {
        const pct = (v / total) * 100;
        const bg = i === j ? `rgba(15,118,110,${0.08 + 0.5 * (pct / 100)})` : `rgba(178,58,43,${0.05 + 0.45 * (pct / 100)})`;
        return `<td style="background:${bg}">${pct.toFixed(1)}</td>`;
      }).join("");
      return `<tr><th>${data.classes[i]}</th>${cells}<td class="num">${(lv.recall[i] * 100).toFixed(1)}%</td></tr>`;
    }).join("");
    table.innerHTML = head + `<tbody>${rows}</tbody>`;
    box.append(el("div", "viz-cm-wrap", `L=${lv.L} · ACC ${(lv.acc * 100).toFixed(1)}%`));
    box.append(table);
  }

  function drawRecallGrid(box, data) {
    const head = `<thead><tr><th>类别</th>${data.levels.map((l) => `<th>L=${l.L}</th>`).join("")}<th>落差</th></tr></thead>`;
    const rows = data.classes.map((cls, i) => {
      const vals = data.levels.map((l) => l.recall[i]);
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      const cells = vals.map((v) => {
        const t = hi > lo ? (v - lo) / (hi - lo) : 1;
        return `<td style="background:rgba(178,58,43,${(1 - t) * 0.55})">${(v * 100).toFixed(0)}</td>`;
      }).join("");
      return `<tr><th>${NAMES[i] || cls}</th>${cells}<td class="num">${((hi - lo) * 100).toFixed(1)}</td></tr>`;
    }).join("");
    box.innerHTML = `<table class="viz-cm">${head}<tbody>${rows}</tbody></table>
      <p class="viz-note dim">“落差”= 该类召回率随视数的最大差值；差距大说明模型对该类的判断依赖相干估计精度，而不是稳定的结构特征。</p>`;
  }

  function drawConfidence(box, data) {
    const bins = 10;
    const ok = new Array(bins).fill(0);
    const bad = new Array(bins).fill(0);
    data.levels.forEach((lv) => {
      lv.samples.forEach((s) => {
        const conf = s.conf;
        for (let i = 0; i < conf.length; i += 2) {
          const v = parseInt(conf.slice(i, i + 2), 16) / 99;
          const idx = Math.min(bins - 1, Math.floor(v * bins));
          if (s.gt[i / 2] === s.pred[i / 2]) ok[idx] += 1; else bad[idx] += 1;
        }
      });
    });
    const peak = Math.max(...ok, ...bad) || 1;
    const rows = ok.map((v, i) => {
      const pct = (i + 0.5) * 10;
      return `<div class="viz-hist-row"><span>${pct.toFixed(0)}%</span>
        <span class="viz-bar ok"><i style="width:${(v / peak) * 100}%"></i></span>
        <span class="viz-bar bad"><i style="width:${(bad[i] / peak) * 100}%"></i></span></div>`;
    }).join("");
    const total = ok.reduce((a, b) => a + b, 0) + bad.reduce((a, b) => a + b, 0);
    const hiWrong = bad.slice(7).reduce((a, b) => a + b, 0);
    box.innerHTML = `<div class="viz-hist">${rows}</div>
      <p class="viz-note">青绿 = 判断正确，橙红 = 判断错误；横轴为模型给出的最大类别概率。
      ${total ? `高置信（≥70%）却判错的像素占全部错误的 <strong>${((hiWrong / (bad.reduce((a, b) => a + b, 0) || 1)) * 100).toFixed(1)}%</strong>。` : ""}</p>
      <p class="viz-note dim">判错集中在低置信区说明模型“知道自己不确定”；若集中在高置信区，则说明校准有问题，需要重新训练而非调阈值。</p>`;
  }

  async function drawEdge() {
    const figs = $("viz-edge-figs");
    if (!figs) return;
    let data;
    try {
      const res = await fetch("edge.json", { cache: "no-store" });
      if (!res.ok) return;
      data = await res.json();
    } catch (err) {
      return;
    }

    const fig = (src, label, note) =>
      `<figure class="viz-figure"><img src="${src}" alt="${label}" loading="lazy">` +
      `<figcaption>${label}<small>${note}</small></figcaption></figure>`;
    figs.innerHTML =
      fig("../../assets/img/edge/gallery.png", "样本画廊", "不同视数 / 边界数的真值与预测对照") +
      fig("../../assets/img/edge/dataset_overview.png", "数据集概览", "尺寸、边界数、块宽分布");

    const bars = (id, obj, label) => {
      const host = $(id);
      if (!host) return;
      const entries = Object.entries(obj).sort((a, b) => Number(a[0]) - Number(b[0]));
      const peak = Math.max(...entries.map(([, v]) => v || 0)) || 1;
      host.innerHTML = entries.map(([k, v]) => `
        <div class="repro-bar">
          <span class="repro-bar-label">${label}${k}</span>
          <span class="viz-bar"><i style="width:${((v || 0) / peak) * 100}%"></i></span>
          <span class="repro-bar-value">${((v || 0) * 100).toFixed(1)}%</span>
        </div>`).join("");
    };
    bars("edge-looks", data.by_looks, "L=");
    bars("edge-width", data.by_min_width, "块宽 ");
    bars("edge-count", data.by_truth_count, "边界数 ");

    const rows = Object.entries(data.by_looks_full || {}).map(([L, m]) => `
      <tr><td>L=${L}</td>
      <td class="num">${(m.exact_accuracy * 100).toFixed(1)}</td>
      <td class="num">${(m.boundary_f1 * 100).toFixed(1)}</td>
      <td class="num">${((m.rect_precision || 0) * 100).toFixed(1)}</td>
      <td class="num">${m.mean_absolute_count_error.toFixed(2)}</td></tr>`).join("");
    const u = data.unseen_size || {};
    const lat = (data.latency_ms && data.latency_ms["17"]) || {};
    const th = data.thresholds || {};
    const table = $("edge-table");
    if (table) {
      table.innerHTML = `
        <table class="viz-cm">
          <thead><tr><th>切分</th><th>Exact</th><th>Boundary F1</th><th>Rect P</th><th>MAE</th></tr></thead>
          <tbody>${rows}
          <tr><th>未见尺寸 25</th>
            <td class="num">${((u.exact || 0) * 100).toFixed(1)}</td>
            <td class="num">${((u.boundary_f1 || 0) * 100).toFixed(1)}</td>
            <td class="num">${((u.rect_precision || 0) * 100).toFixed(1)}</td>
            <td class="num">${(u.mean_absolute_count_error || 0).toFixed(2)}</td></tr>
          </tbody></table>
        <p class="viz-note dim">${data.run} · ${(data.members || []).length > 1
            ? `集成 ${(data.members || []).length} 模型`
            : "单模型"} · 解码 ${data.decode_best} ·
          阈值 14→${th["14"]} 17→${th["17"]} · 17×17 推理 ${(lat.single_ms || 0).toFixed(2)} ms</p>`
        + (data.matrix && data.matrix.note
          ? `<p class="viz-note dim">矩阵口径：${data.matrix.note}</p>` : "");
    }
  }

  async function bootPixels() {
    const host = $("viz-levels");
    if (!host) return;
    let data;
    try {
      const res = await fetch("pixels.json", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      data = await res.json();
    } catch (err) {
      host.innerHTML = `<p class="empty">逐像素数据加载失败：${err.message}</p>`;
      return;
    }
    drawLegend($("viz-legend"));
    drawLevels(host, data);
    drawSamples($("viz-samples"), $("viz-tabs"), data);
    drawConfusion($("viz-confusion"), data);
    drawRecallGrid($("viz-recall-grid"), data);
    drawConfidence($("viz-conf"), data);
  }

  async function drawEdgeProgress() {
    const dpHost = $("edge-dp");
    if (!dpHost) return;
    let d;
    try {
      const res = await fetch("progress.json", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      d = await res.json();
    } catch (err) {
      dpHost.innerHTML = `<p class="empty">进度数据加载失败：${err.message}</p>`;
      return;
    }

    const pct = (v) => (v === null || v === undefined ? "—" : (v * 100).toFixed(1));
    const gal = $("edge-gallery-table");
    if (gal && d.gallery) {
      const rows = d.gallery.models.map((m) => `
        <tr><td>${m.id}</td>
        <td class="num">${pct(m.exact)}</td>
        <td class="num">${pct((m.thresholds || {})["14"])}</td>
        <td class="num">${pct((m.thresholds || {})["17"])}</td></tr>`).join("");
      gal.innerHTML = `<table class="viz-cm">
        <thead><tr><th>模型</th><th>Exact（${d.gallery.count} 面板）</th><th>阈值 N=14</th><th>阈值 N=17</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <p class="viz-note dim">画廊种子 ${d.gallery.seed}；阈值按尺寸在验证集上校准。</p>`;
    }

    if (d.dp) {
      const sets = [
        ["N=14/17（训练内）", d.dp.indist],
        ["N=10/25（未见尺寸）", d.dp.ood],
      ];
      const rows = sets.map(([label, s]) => {
        const dp = s.dp || {}, cnn = s.cnn || {};
        return `<tr><td rowspan="2">${label}</td><td>DP</td>
            <td class="num">${pct(dp.exact_accuracy)}</td><td class="num">${pct(dp.boundary_f1)}</td>
            <td class="num">${pct(dp.rect_f1)}</td><td class="num">${(dp.mean_absolute_count_error || 0).toFixed(2)}</td></tr>
          <tr><td><strong>CNN</strong></td>
            <td class="num"><strong>${pct(cnn.exact_accuracy)}</strong></td>
            <td class="num"><strong>${pct(cnn.boundary_f1)}</strong></td>
            <td class="num"><strong>${pct(cnn.rect_f1)}</strong></td>
            <td class="num"><strong>${(cnn.mean_absolute_count_error || 0).toFixed(2)}</strong></td></tr>`;
      }).join("");
      const looks = Object.entries((d.dp.indist && d.dp.indist.by_looks) || {});
      const bars = looks.map(([L, v]) => `
        <div class="repro-bar">
          <span class="repro-bar-label">L=${L}</span>
          <span class="viz-bar"><i style="width:${(v.cnn || 0) * 100}%"></i></span>
          <span class="viz-bar"><i style="width:${(v.dp || 0) * 100}%;background:${"var(--c2)"}"></i></span>
          <span class="repro-bar-value">${pct(v.cnn)} / ${pct(v.dp)}</span>
        </div>`).join("");
      dpHost.innerHTML = `<table class="viz-cm">
        <thead><tr><th>测试集</th><th>方法</th><th>Exact</th><th>Boundary F1</th><th>Rect F1</th><th>MAE</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <p class="viz-note">训练内 12/12 格、真实尺寸 N=10 6/6 格 CNN 全胜；N=25 两者持平但 CNN 的计数 MAE 更大。
        逐 L（上=CNN，下=DP，训练内）：</p>
        <div class="viz-edge-bars">${bars}</div>
        <p class="viz-note dim">结论：CNN 优于 DP，DP 保留为无监督兜底与交叉验证；瓶颈在「边界数」而非切点定位。</p>`;
    }

    const auditHost = $("edge-audit");
    if (auditHost && d.audit) {
      const card = (title, body) => `<article class="viz-card"><header><strong>${title}</strong></header>
        <div class="viz-note">${body}</div></article>`;
      const i1 = d.audit.iter1 || {}, i2 = d.audit.iter2 || {}, i3 = d.audit.iter3 || {};
      auditHost.innerHTML = `<div class="viz-grid">
        ${card("迭代 1 · 合成参考卡", `等级 <strong>${i1.grade || "—"}</strong>（${i1.n || "—"} 个矩阵）<br>
          近对角带 Exact 0.492 / AUC 0.915，全矩阵仅 0.033 / 0.615`)}
        ${card("迭代 2 · 注入负测试", `9 类缺陷检出 <strong>${(i2.rows || []).filter((r) => r.detected === "YES").length}/${(i2.rows || []).length}</strong><br>
          通过率 ${i2.pass_rate === undefined ? "—" : (i2.pass_rate * 100).toFixed(1) + "%"}`)}
        ${card("迭代 3 · 仿真真实集", `等级 <strong>${i3.grade || "—"}</strong>（${i3.n || "—"} 个矩阵）<br>
          ${(i3.hard_failures || []).join("；") || "无硬失败"}`)}
      </div>
      <p class="viz-note dim">三轮结论：模矩阵不保证 PSD（合成集自身 26% 违例），不能作 |γ| 硬门禁；
        块信息只在近对角带；反转比例 0.37，L̂ 可由跨块均值反演到 ±1 档；注入负测试 9/9 检出，并能定位整组标注口径漂移。
        <strong>真实数据尚未跑门禁，任何合成→真实的性能断言都不可用。</strong></p>`;
    }
  }

  async function boot() {
    await Promise.all([bootPixels(), drawEdge(), drawEdgeProgress()]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
