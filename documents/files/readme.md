# InSAR_affair

InSAR 相干矩阵相关的复现与分割工作台。两条产品线共用同一套**物理合成器**（DANI-NET 信号模型），一条对齐论文做变化检测复现，一条做相干矩阵的对角块分割。

```text
物理合成器（Sec. II–III）
   ├── 产品线 A：DANI-NET 论文复现   → daninet/net/    → /visual/reproduction/
   └── 产品线 B：InSAR 块矩阵分割   → daninet/edge/   → /visual/segmentation/
```

- 简介与进度总览：<https://zoneip.github.io/insar-affair-site/>
- 完整说明与文档：<https://zoneip.github.io/insar-affair-site/documents/>
- 当前在干什么（跨 agent 看板）：`handoff.md`
- 长期事实与协作约定：`AGENTS.md`

---

## 1. 产品线 A：DANI-NET 论文复现

**任务**：重复轨道 InSAR 变化检测。输入合成孔径雷达信号块，输出逐像素的四类判别（稳定 / 突变 / 线性 / 周期），对应论文 Sec. II–III 的物理模型、Sec. IV 的在线数据生成、Sec. V 的全卷积网络。

**口径**：代码与文档引用论文时保留 `Sec. / Eq. / Fig. / Table` 编号，不自行改号。已核实的复现发现（Eq. 6 方向、Table IV 不自洽等）见 `daninet/README.md`。

**当前规模**（与论文差距）：

| 项 | 论文 | 本项目（P2 深跑） |
| --- | --- | --- |
| 训练数据 | 全因子枚举，每 L 1,855,740 片 | 在线随机抽样（分布等价、可无限生成） |
| 呈现次数 | 250 ep × 1.48 M ≈ 3.71 亿 | 60 ep × 200 k = 1,200 万（约 **3.2%**） |
| 硬件 | V100 | Ascend 910（单卡 chip 0） |

**缩放结论**（weighted F1，AMP fp16，batch 16）：

| run | 配置 | L=9 | L=25 | L=121 | 耗时 |
| --- | --- | --- | --- | --- | --- |
| `a3_amp_b16_e15` | 5 blk × 15ep × 10k | 0.7021 | 0.7291 | 0.7689 | 5.8 min |
| `a3_s5_p50k_e25` | 5 blk × 25ep × 50k | 0.7289 | 0.7496 | 0.7887 | 48.2 min |
| `a3_b10_e25` | 10 blk × 25ep × 10k | 0.7459 | 0.7628 | 0.7942 | 14.6 min |
| `a3_b10_p200k_e60` | 10 blk × 60ep × 200k | 进行中 | — | — | 预计 ~10 h |

同预算下**加深度优于加数据**（5→10 blk +0.041 @L=9，数据 ×5 仅 +0.021 @L=25）。

---

## 2. 产品线 B：InSAR 块矩阵分割

**任务**：从 N×N 非负相干矩阵 `|γ| ∈ [0,1]` 预测 **N−1** 个连续对角块边界（二维块检测 → 一维多标签边界检测）。合成口径与真实 InSAR 相干矩阵一致。

**主模型** `daninet/runs/edge_final_single`：DANI-NET 骨干 + 边界头，seed 20261019，60 epoch × 32768 合成矩阵，早停 epoch 24，11.3 min。

| 指标（n=3968） | 值 |
| --- | --- |
| Exact Accuracy | **0.6872** |
| Boundary F1 / Rect F1 | 0.8391 / 0.8133 |
| 边界数 MAE | 0.320（过分割 9.3% / 欠分割 15.9%） |
| 逐 L Exact | 0.312 → 0.548 → 0.665 → 0.775 → 0.860 → **0.977**（L=9…121） |
| 未见尺寸 25 | 0.592（过分割 35.4%，阈值需重校准） |
| 推理（17×17） | 单模型 0.12 ms |

难点在**窄块**（块宽 2 → 0.646，块宽 8 → 0.805）与**多边界**（4 个边界 → 0.487）。完整画廊与分解见 `/visual/segmentation/`，方法整理见文档区《InSAR 矩阵分割》。

**缺口**：真实带标注的相干矩阵数据（`.mat`）尚未入库，当前全部结论基于合成数据。

---

## 3. 硬件与环境

| 用途 | 环境 |
| --- | --- |
| 训练 | 华为云 Ascend **910**，CANN **9.0**，torch **2.10** + torch_npu **2.10**，Python 3.11.15 |
| 本机 | 文档、站点构建、数据核对（无 GPU、无 numpy/torch，**不训练**） |

训练机要点：

```bash
source /usr/local/Ascend/ascend-toolkit/set_env.sh   # 不 source 则 import torch 失败
export OMP_NUM_THREADS=1                             # 不设则数据生成掉速到 ~170 patch/s
/usr/local/python3.11.15/bin/python3 -m daninet.net.train ...
```

- 设备：`--device auto|npu|cuda|cpu`（auto 优先 npu）；AMP 仅 CUDA 验证过，NPU 走 fp32 或显式 `--amp`
- 传输：`scp` 不通，用 `ssh ... 'cat > 远端路径' < 本地文件`
- 长任务：`nohup setsid bash 脚本 >> logs/xx.log 2>&1 </dev/null &`

---

## 4. 目录结构

```text
daninet/               业务源码（Python 包）
├── net/               变化检测：model / train / metrics
├── edge/              块边界分割：model / synth / train / decode / ensemble
├── tools/             export_live（看板数据）、export_docs（文档导出）、
│                      visual_samples（逐像素抽样）、export_edge_visual（分割可视化）、
│                      parity_check（CPU/NPU 对齐）
├── runs/<run>/        metrics.json / log.txt / best.pt（权重不入库）
└── out/               图表与 summary
docs/                  GitHub Pages 源
├── visual/            可视化：segmentation（块分割）+ reproduction（复现）
├── documents/         文档区：本 README、矩阵分割、复现说明、分析、缺陷
├── live/              训练看板数据与页面
└── content/           人可编辑的 md 源（status-panel / analysis / gaps / segmentation）
.dsh/skills/           project-report（报告+站点）、data-refresh（全量更新，subagent 分工）
rules/ specs/          结构规则 / 方案（SPEC）
workspace/             论文 PDF、7z 归档（不入库）
handoff.md             跨 agent 进度看板
AGENTS.md              长期记忆
```

---

## 5. 怎么跑

### 训练（变化检测）

```bash
python3 -m daninet.net.train \
  --mode augmented --device npu --amp auto \
  --L 9 16 36 121 --test-L 9 16 25 36 49 121 \
  --patches 200000 --epochs 60 --batch 16 --workers 16 --prefetch 32 \
  --blocks 10 --lr-drops 0.6:1e-5,0.85:1e-6 --patience 20 \
  --resume auto --ckpt-every 1 --name a3_b10_p200k_e60
```

- `--resume auto|path`：从 `last.pt` 续训（只丢当前 epoch）；`--lr-drops` 的键 ≤1 时按总 epoch 比例换算
- 每 epoch 原子写 `metrics.partial.json`，跑完写 `metrics.json`

### 训练（块分割）

```bash
python3 -m daninet.edge.train --name edge_final_single \
  --seed 20261019 --epochs 60 --patches 32768 --workers 24 \
  --device npu --amp auto
```

### 可视化数据

```bash
python3 daninet/tools/export_edge_visual.py --run edge_final_single   # 分割页 edge.json
python3 -m daninet.tools.visual_samples --run <run> --out pixels.json # 复现页逐像素
python3 daninet/tools/export_live.py --repo .                          # 看板数据
python3 .dsh/skills/project-report/scripts/build_pages.py              # 重建站点
bash  .dsh/skills/project-report/scripts/publish_site.sh               # 发布
```

---

## 6. 站点与文档体系

| 页面 | 路径 | 内容 |
| --- | --- | --- |
| 总览 | `/` | 状态面板（人工维护 `docs/content/status-panel.md`）+ 入口 |
| 训练看板 | `/live/` | 逐 epoch 曲线、回放（不自动播放） |
| 数据分析 | `/analysis/` | 对照实验设置与结论 |
| 可视化 | `/visual/` | 入口：InSAR 块边界分割 / 论文复现 |
| 文档 | `/documents/` | 本 README、矩阵分割、复现说明、分析、缺陷 |

- **报告**（代码说明书 / 数据分析 / 缺陷分析 / 口语稿 / 代码包）：`.dsh/skills/project-report/SKILL.md`，只在用户要求时生成
- **全量数据更新**：`.dsh/skills/data-refresh/SKILL.md`，强制 subagent 分工（collector 采集 / auditor 核数），主 agent 只裁决、提交、发布

---

## 7. 数据说明

- 论文训练集是**全因子枚举**（附录 A）：每 L 1,855,740 片，合计 7,422,960 片 `[128,128,10]`；测试集独立生成（L ∈ {9,16,25,36,49,121}，其中 25/49 训练未见）。
- 本项目用**同一参数集在线随机抽样**：分布等价、可无限生成；离线落盘约 2.4–4.9 TB，本机磁盘不可行。
- 块分割的合成矩阵为非负相干矩阵 `|γ| ∈ [0,1]`，尺寸 14/17（未见 25），最小块宽 2，最多 4 个边界。
- **真实数据缺口**：论文两例真实数据（冰岛 Sentinel-1、TanDEM-X）不可达；带标注的相干矩阵 `.mat` 是下一项必需输入。

---

## 8. 常见问题

| 现象 | 处理 |
| --- | --- |
| `import torch` 报 torch_npu 加载失败 | 先 `source .../set_env.sh` |
| 数据生成吞吐只有 ~170 patch/s | `export OMP_NUM_THREADS=1` |
| A3 上 GitHub 不可达 | 用 `git bundle` 或 `ssh 'cat >'` 传文件 |
| 站点数字与 metrics 不一致 | 跑 `data-refresh` 的 auditor 步骤核数 |
| 推送失败 | 网络常态；记「待推送 N 个提交」，不 force |

---

## 9. 进度与协作

- **现在在干什么、下一步谁做**：`handoff.md`（跨 agent 交接看板）
- **长期事实、结论、纪律**：`AGENTS.md`
- 提交纪律：本地优先，推送尽力而为；推送前需用户同意；站点走公开仓库 `Zoneip/insar-affair-site`
