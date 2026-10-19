/* DANI-NET training dashboard: static page + replay of recorded runs. */
(() => {
  "use strict";

  const S = {
    data: null,
    run: null,
    upto: 0,
    playing: false,
    timer: null,
    speed: 2,
    liveTimer: null,
  };

  const $ = (id) => document.getElementById(id);
  const REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const fmt = (v, d = 4) => (v === null || v === undefined || Number.isNaN(v) ? "—" : Number(v).toFixed(d));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ------------------------------------------------------------------ chart */
  function chart(host, cfg) {
    const W = 600;
    const H = cfg.height || 210;
    const m = { l: 54, r: 18, t: 14, b: 30 };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    const n = Math.max(cfg.labels.length, 2);
    const xs = (i) => m.l + (pw * i) / (n - 1);

    const vals = cfg.series.flatMap((s) => s.values.filter((v) => v !== null && v !== undefined));
    let lo, hi;
    if (cfg.log) {
      const lg = vals.map((v) => Math.log10(Math.max(v, 1e-9)));
      lo = Math.min(...lg, -7);
      hi = Math.max(...lg, -3);
    } else if (cfg.range) {
      [lo, hi] = cfg.range;
    } else {
      lo = Math.min(...vals);
      hi = Math.max(...vals);
      const pad = (hi - lo || 0.1) * 0.12;
      lo -= pad;
      hi += pad;
    }
    const ys = (v) => {
      const t = cfg.log ? Math.log10(Math.max(v, 1e-9)) : v;
      return m.t + ph - ((t - lo) / (hi - lo || 1)) * ph;
    };

    const parts = [];
    parts.push(`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cfg.title || "chart")}">`);
    parts.push(`<defs><linearGradient id="g${cfg.uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${cfg.series[0].color}" stop-opacity=".28"/>
      <stop offset="100%" stop-color="${cfg.series[0].color}" stop-opacity="0"/>
    </linearGradient></defs>`);

    for (let k = 0; k <= 4; k++) {
      const y = m.t + (ph * k) / 4;
      const raw = cfg.log ? Math.pow(10, hi - ((hi - lo) * k) / 4) : hi - ((hi - lo) * k) / 4;
      const label = cfg.log ? raw.toExponential(0).replace("e-", "e-") : raw.toFixed(cfg.decimals ?? 2);
      parts.push(`<line x1="${m.l}" y1="${y}" x2="${W - m.r}" y2="${y}" stroke="#1b2631" stroke-width="1"/>`);
      parts.push(`<text x="${m.l - 10}" y="${y + 4}" fill="#6b7b8c" font-size="10.5" text-anchor="end" font-family="ui-monospace, monospace">${label}</text>`);
    }

    const step = Math.max(1, Math.ceil(cfg.labels.length / 8));
    cfg.labels.forEach((lab, i) => {
      if (i % step && i !== cfg.labels.length - 1) return;
      parts.push(`<text x="${xs(i)}" y="${H - 8}" fill="#6b7b8c" font-size="10.5" text-anchor="middle" font-family="ui-monospace, monospace">${esc(lab)}</text>`);
    });

    cfg.series.forEach((s, si) => {
      const pts = s.values.map((v, i) => (v === null || v === undefined ? null : [xs(i), ys(v)])).filter(Boolean);
      if (pts.length < 2) return;
      let d;
      if (s.step) {
        d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
        for (let i = 1; i < pts.length; i++) {
          d += ` H${pts[i][0].toFixed(1)} V${pts[i][1].toFixed(1)}`;
        }
      } else {
        d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
      }
      if (si === 0 && cfg.area !== false) {
        parts.push(`<path d="${d} L${pts[pts.length - 1][0].toFixed(1)},${m.t + ph} L${pts[0][0].toFixed(1)},${m.t + ph} Z" fill="url(#g${cfg.uid})"/>`);
      }
      parts.push(`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? 'stroke-dasharray="5 4"' : ""}/>`);
      const last = pts[pts.length - 1];
      parts.push(`<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.2" fill="${s.color}"/>`);
    });

    let lx = m.l;
    cfg.series.forEach((s) => {
      parts.push(`<rect x="${lx}" y="${m.t - 8}" width="9" height="3" rx="1.5" fill="${s.color}"/>`);
      parts.push(`<text x="${lx + 14}" y="${m.t - 3}" fill="#8b98a9" font-size="10.5">${esc(s.label)}</text>`);
      lx += 22 + s.label.length * 7;
    });

    parts.push("</svg>");
    host.innerHTML = parts.join("");
  }

  /* -------------------------------------------------------------- rendering */
  function visible(run, upto) {
    return run.history.slice(0, Math.max(upto, 1));
  }

  function renderKpis(run, upto) {
    const h = visible(run, upto);
    const cur = h[h.length - 1] || {};
    const tput = cur.seconds && run.patches_per_epoch ? run.patches_per_epoch / cur.seconds : null;
    const items = [
      ["epoch", `${cur.epoch ?? 0}<i> / ${run.epochs}</i>`],
      ["train loss", fmt(cur.train_loss)],
      ["val loss", fmt(cur.val_loss)],
      ["val F1 (weighted)", fmt(cur.val_f1)],
      ["learning rate", cur.lr ? Number(cur.lr).toExponential(0) : "—"],
      ["吞吐", tput ? `${tput.toFixed(1)}<i> patch/s</i>` : "—"],
      ["可训练参数", run.params ? run.params.toLocaleString() : "—"],
    ];
    $("kpis").innerHTML = items
      .map(([k, v]) => `<div class="kpi"><span>${k}</span><b>${v}</b></div>`)
      .join("");
  }

  function renderCharts(run, upto) {
    const h = visible(run, upto);
    const labels = h.map((x) => String(x.epoch));

    chart($("chartLoss"), {
      uid: "loss",
      title: "loss",
      labels,
      series: [
        { label: "train", color: "#34d3ee", values: h.map((x) => x.train_loss) },
        { label: "val", color: "#f5a524", values: h.map((x) => x.val_loss) },
      ],
    });

    chart($("chartF1"), {
      uid: "f1",
      title: "val weighted F1",
      labels,
      decimals: 3,
      series: [{ label: "val F1", color: "#3ddc97", values: h.map((x) => x.val_f1) }],
    });

    chart($("chartLR"), {
      uid: "lr",
      title: "learning rate",
      labels,
      log: true,
      area: false,
      height: 210,
      series: [{ label: "lr", color: "#a78bfa", values: h.map((x) => x.lr), step: true }],
    });

    const Ls = Object.keys(run.tests || {});
    chart($("chartTest"), {
      uid: "test",
      title: "test F1 by looks",
      labels: Ls.map((L) => `L=${L}`),
      decimals: 3,
      series: [{ label: "weighted F1", color: "#34d3ee", values: Ls.map((L) => run.tests[L].f1_weighted) }],
    });
  }

  function renderLog(run, upto) {
    const lines = run.log.filter((ln) => {
      const m = ln.match(/epoch (\d+)\//);
      if (m) return Number(m[1]) <= upto;
      if (/TEST L=|done in|best epoch/.test(ln)) return upto >= run.epochs;
      return true;
    });
    const box = $("log");
    box.textContent = lines.slice(-40).join("\n");
    box.scrollTop = box.scrollHeight;
  }

  function render() {
    const run = S.run;
    if (!run) return;
    const max = run.history.length;
    S.upto = Math.min(Math.max(S.upto, 1), max);
    renderKpis(run, S.upto);
    renderCharts(run, S.upto);
    renderLog(run, S.upto);
    $("progressBar").style.width = `${(S.upto / max) * 100}%`;
    $("progressText").textContent = `${S.upto} / ${run.epochs} epoch`;
    $("note").innerHTML =
      `<strong style="color:#c3ccd8">${esc(run.label)}</strong> · ` +
      `${run.epochs} epoch × ${run.patches_per_epoch?.toLocaleString() ?? "?"} patch · batch ${run.batch ?? "?"} · ` +
      `训练视数 ${esc((run.train_L || []).join("/"))} · 总耗时 ${(run.seconds / 60).toFixed(1)} min`;
  }

  function setStatus(text, cls) {
    const pill = $("statusPill");
    pill.className = `pill ${cls || ""}`;
    $("statusText").textContent = text;
  }

  /* -------------------------------------------------------------- playback */
  function stop() {
    S.playing = false;
    clearInterval(S.timer);
    S.timer = null;
    $("play").textContent = "回放";
  }

  function play() {
    stop();
    S.playing = true;
    S.upto = 1;
    $("play").textContent = "暂停";
    setStatus("回放中", "replay");
    render();
    const tick = Math.max(40, 720 / S.speed);
    S.timer = setInterval(() => {
      S.upto += 1;
      if (S.upto >= S.run.history.length) {
        S.upto = S.run.history.length;
        render();
        stop();
        setStatus(S.data.live ? "直播中" : "已完成", S.data.live ? "live" : "");
        return;
      }
      render();
    }, tick);
  }

  /* ---------------------------------------------------------------- chrome */
  function clock() {
    const d = new Date();
    $("clock").textContent = d.toLocaleTimeString("zh-CN", { hour12: false });
  }

  function renderRunbar() {
    const bar = $("runbar");
    bar.innerHTML = S.data.runs
      .map((r) => {
        const best = r.tests?.[String(r.test_L?.[r.test_L.length - 1])]?.f1_weighted;
        return `<button class="chip${r.id === S.run.id ? " active" : ""}" data-id="${esc(r.id)}">
          <strong>${esc(r.label)}</strong>
          <span>${r.epochs} ep · ${(r.seconds / 60).toFixed(1)} min · F1 ${fmt(best, 3)}</span>
        </button>`;
      })
      .join("");
    bar.querySelectorAll(".chip").forEach((el) => {
      el.addEventListener("click", () => {
        stop();
        S.run = S.data.runs.find((r) => r.id === el.dataset.id);
        S.upto = S.run.history.length;
        renderRunbar();
        render();
        setStatus(S.data.live ? "直播中" : "已完成", S.data.live ? "live" : "");
      });
    });
  }

  async function load(first) {
    const res = await fetch(`data.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`data.json ${res.status}`);
    S.data = await res.json();
    if (first) {
      S.run = S.data.runs[0];
      S.upto = S.run.history.length;
      renderRunbar();
      render();
      if (S.data.live) {
        setStatus("直播中", "live");
      } else {
        setStatus("已完成", "");
        if (!REDUCED) play();
      }
    } else if (S.data.live) {
      const current = S.data.runs.find((r) => r.id === S.run.id);
      if (current && current.history.length > S.run.history.length) {
        S.run = current;
        S.upto = current.history.length;
        renderRunbar();
        render();
      }
    }
  }

  function boot() {
    $("play").addEventListener("click", () => (S.playing ? (stop(), setStatus(S.data.live ? "直播中" : "已完成", S.data.live ? "live" : "")) : play()));
    $("speed").addEventListener("change", (e) => {
      S.speed = Number(e.target.value);
      if (S.playing) play();
    });
    clock();
    setInterval(clock, 1000);
    load(true).catch((err) => {
      setStatus("加载失败", "");
      $("note").textContent = `无法读取 data.json：${err.message}`;
    });
    setInterval(() => {
      if (S.data?.live) load(false).catch(() => {});
    }, 15000);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
