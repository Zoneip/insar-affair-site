/* Live dashboard logic: replay of recorded runs + polling when training writes data.json. */
(() => {
  "use strict";

  const S = { data: null, run: null, upto: 0, playing: false, timer: null, speed: 2 };
  const $ = (id) => document.getElementById(id);
  const REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // The script is shared by templates; do nothing if this page is not the dashboard.
  const REQUIRED = ["statusPill", "statusText", "runbar", "error", "kpis"];
  if (!REQUIRED.every((id) => document.getElementById(id))) return;

  const fmt = (v, d = 4) => (v === null || v === undefined || Number.isNaN(v) ? "—" : Number(v).toFixed(d));
  const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function fail(message) {
    const box = $("error");
    box.hidden = false;
    box.textContent = message;
    setStatus("加载失败", "");
  }

  function setStatus(text, cls) {
    $("statusPill").className = `status-pill ${cls || ""}`;
    $("statusText").textContent = text;
  }

  function visible(run, upto) {
    return run.history.slice(0, Math.max(upto, 1));
  }

  function renderKpis(run, upto) {
    const h = visible(run, upto);
    const cur = h[h.length - 1] || {};
    const tput = cur.seconds && run.patches_per_epoch ? run.patches_per_epoch / cur.seconds : null;
    const items = [
      ["epoch", `${cur.epoch ?? 0}<small> / ${run.epochs}</small>`],
      ["train loss", fmt(cur.train_loss)],
      ["val loss", fmt(cur.val_loss)],
      ["val F1 (weighted)", fmt(cur.val_f1)],
      ["learning rate", cur.lr ? Number(cur.lr).toExponential(0) : "—"],
      ["吞吐", tput ? `${tput.toFixed(1)}<small> patch/s</small>` : "—"],
      ["可训练参数", run.params ? run.params.toLocaleString() : "—"],
    ];
    $("kpis").innerHTML = items
      .map(([k, v]) => `<article><span class="k">${k}</span><span class="v">${v}</span></article>`)
      .join("");
  }

  function renderCharts(run, upto) {
    if (window.LiveCharts) LiveCharts.render(run, upto);
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
    $("progress").value = Math.round((S.upto / max) * 100);
    $("progressText").textContent = `${S.upto} / ${run.epochs} epoch`;
    $("note").innerHTML =
      `<strong style="color:var(--ink-soft)">${esc(run.label)}</strong> · ` +
      `${run.epochs} epoch × ${run.patches_per_epoch ? run.patches_per_epoch.toLocaleString() : "?"} patch · ` +
      `batch ${run.batch ?? "?"} · 训练视数 ${esc((run.train_L || []).join("/"))} · ` +
      `总耗时 ${(run.seconds / 60).toFixed(1)} min`;
  }

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

  function clock() {
    const el = $("clock");
    if (el) el.textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  }

  function renderRunbar() {
    const bar = $("runbar");
    bar.innerHTML = S.data.runs
      .map((r) => {
        const lastL = r.test_L?.[r.test_L.length - 1];
        const best = r.tests?.[String(lastL)]?.f1_weighted;
        return `<button data-id="${esc(r.id)}" class="${r.id === S.run.id ? "active" : ""}" aria-pressed="${r.id === S.run.id}">
          <strong>${esc(r.label)}</strong>
          <span>${r.epochs} ep · ${(r.seconds / 60).toFixed(1)} min · F1 ${fmt(best, 3)}</span>
        </button>`;
      })
      .join("");
    bar.querySelectorAll("button").forEach((el) => {
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
      intro();
      if (S.data.live) {
        setStatus("直播中", "live");
      } else {
        // Show the finished run as-is; replay only starts on an explicit click.
        setStatus("已完成", "");
        $("play").textContent = "回放";
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

  function intro() {
    if (!window.anime || REDUCED) return;
    anime({ targets: ".stats article", translateY: [8, 0], duration: 420, delay: anime.stagger(50), easing: "easeOutQuad" });
    anime({ targets: ".panels article", translateY: [12, 0], duration: 520, delay: anime.stagger(70, { start: 120 }), easing: "easeOutQuad" });
  }

  function boot() {
    $("play").addEventListener("click", () => {
      if (S.playing) {
        stop();
        setStatus(S.data.live ? "直播中" : "已完成", S.data.live ? "live" : "");
      } else {
        play();
      }
    });
    $("speed").addEventListener("change", (e) => {
      S.speed = Number(e.target.value);
      if (S.playing) play();
    });
    clock();
    setInterval(clock, 1000);
    load(true).catch((err) => fail(`无法读取 data.json：${err.message}`));
    setInterval(() => {
      if (S.data && S.data.live) load(false).catch(() => {});
    }, 15000);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
