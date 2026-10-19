# DANI-NET 复现：基于重复轨道 InSAR 的合成训练流程

对论文 **"DANI-NET: A Physics-Aware Deep Learning Framework for Change Detection
using Repeat-Pass InSAR"**（G. Costa, A. V. Monti Guarnieri, A. Parizzi, P. Rizzoli）
的**合成信号模型 + 合成数据集生成 + 网络训练**流程的代码复现。

所有公式编号（Eq.）、图号（Fig.）、表号（Table）、章节号（Sec.）均指论文原文。

---

## 1. 目录结构

```
E:\DaniNet\
├── DANI_NET.pdf                  原始论文
└── daninet\                      复现代码包
    ├── config.py                 全部可调参数（物理、数据、网络、训练）
    ├── physics.py                后向散射模型 + 相干性因子分解 + Cholesky（Eq.5-7,17-18,21,27-33）
    ├── patterns.py               时空变化模式（Fig.5：圆锥/金字塔、入射方向、翻转、时间演化）
    ├── synthetic.py              合成信号模型与数据集生成（Sec.III,IV；Alg.1）
    ├── plot.py                   图/表生成（Fig.6,11,12,14；Table III/VIII 版式）
    ├── data\test_generator.py    信号模型自检（5 组物理一致性测试）
    ├── net\model.py              DANI-NET 网络（Sec.V-A，Fig.7，Table IV）
    ├── net\metrics.py            ACC / F1 / F1_w / p_D / 混淆矩阵（Eq.36-38，Sec.V-C）
    ├── net\train.py              训练与评估流程（Sec.V-B, V-D, VII）
    ├── runs\                     每次训练的输出（best.pt / metrics.json / examples.npz）
    └── out\                      汇总图表与报告
```

运行环境：`D:\anima_trainer_ref\venv\Scripts\python.exe`（Python 3.11.9，
numpy 1.26.4，**torch 2.10.0+cu130**，CUDA 可用：RTX 4060 Laptop 8 GB）。

---

## 2. 合成信号模型（Sec. III，Eq. 16-33）

对场景中每个像素，先抽取物理场景
`(θ, θ_L, Δα, Bn/Bc, τ/tr, L, 变化类别, 空间模式)`，再按

```
    S = ξ ∘ (L d),       L Lᵀ = Γ,       Γ = γ₀·γ_b·γ_t·(变化模式)      Eq.(5),(16),(21),(33)
```

生成 Bw = 4 个 SLC 复数样本（`d` 为白复高斯过程，Eq. (19)）。随后按 Fig. 2 组装网络输入：

* **4 个幅度样本** `|S_n|`（Eq. (25)）
* **6 个干涉相干样本** `|γ̂_ij|, i<j`（Eq. (5)，样本相干估计，L 视数）

得到 `[4+6, 128, 128]` 张量。

### 2.1 后向散射（Sec. III-A，Eq. 17-18，Table I）

* Ulaby & Dobson 多项式模型（`ULABY_P`）：X 波段 HH、裸土，θ∈[25°,55°]
  → β⁰ ∈ [-12.9, -1.3] dB。
* **"TanDEM-β0"**：论文称用玻利维亚 Uyuni 盐沼 100 景 TanDEM-X 数据在 Ulaby 系数
  基础上重新拟合（Table I 第二行）。

代码现在直接采用 Table I 的 TanDEM-β0 系数，并按论文 Eq. (18) 将其解释为
**已经在 β⁰(dB) 域拟合的曲线**；不会再次减去 `10log10(sin(theta))`。Ulaby
系数仍按 Eq. (17) 作为 σ⁰ 曲线，再用局部入射角转换为 β⁰。这样可以明确区分
论文的两种模型，避免把 TanDEM-β0 当作 σ⁰ 重复转换。

### 2.2 相干性因子分解（Eq. 5-7）

* 时间去相干（Eq. (6)）：

  ```
  γ_t^(ij) = exp(−|B_t,ij| / τ),   B_t,ij = |i−j|·t_r   ⟹   γ_t = exp(−|i−j| / (τ/t_r))
  ```

  即 Table II 中的无量纲比值 `τ/t_r` **越大，去相干越慢**（与 Sec. VIII
  "the slower the temporal decorrelation, i.e., the higher τ/tr, the higher the
  importance of the long-term coherence samples" 一致）。

  > **⚠ 复现发现 2：把 Eq. (6) 写成 `exp(−|i−j|·τ/t_r)` 会把趋势写反。**
  > 该写法下 τ/t_r 越大去相干越快，与 Sec. VIII 的结论矛盾，且会显著低估相干性
  > （τ/t_r = 2 时 lag-2 相干为 0.018 而非正确的 0.368），使合成数据远比论文"暗"。
  > 本复现初版即犯此错，已按上式更正。正确取值为：

  | τ/t_r | γ_t(lag 1) | γ_t(lag 2) | γ_t(lag 3) |
  |---|---|---|---|
  | 0 | 0.000 | 0.000 | 0.000 |
  | 1 | 0.368 | 0.135 | 0.050 |
  | 2 | 0.607 | 0.368 | 0.223 |
  | 3 | 0.717 | 0.513 | 0.368 |

  τ/t_r = 0 是"无限快去相干"的极限（表中确实列出 0），实现为极小比值，对任意非零
  时间基线给出 γ_t ≈ 0。

* 几何去相干 `γ_b = 1 − Bn/Bc`（Eq. (7)），`Bn/Bc ~ U[−0.15, 0.15]`。
* `γ₀ = 0.98`（最大理论相干性）。

代码先恢复相关矩阵的单位对角线，再使用下三角 Cholesky 因子 `L`，满足
`L @ L.T = Γ`。由于 Γ 的对角线为 1，`L` 的每一行平方和也为 1，因此
`d` 归一化为 `E|d|²=1` 后同时满足论文的 coherence 和亮度标定；回归测试会直接
检查 `max|LLᵀ−Γ|`。

### 2.3 幅度标定（Eq. 27-33）

复高斯过程在代码中显式除以 `sqrt(2)`，所以 `E|d|²=1`；相应的标定为
**`ξ = sqrt(β0)`**，并且 `E|S|² = β0`。四类场景的实测误差约为 0.02 dB。
> 多段重标度（Eq. (31)-(32)）由此退化为逐像素的 `ξ_k = sqrt(β0_k)`，与 Eq. (33)
> 的 `Ξ = ξ⁽⁰⁾[1, ξ⁽¹⁾, …, ξ⁽Ω⁻¹⁾]ᵀ` 等价。

---

## 3. 变化现象学与数据集（Sec. II-B, IV；Alg. 1）

### 3.1 四类变化（Sec. IV-A，Fig. 4）

| 类别 | `i_cp` | 现象学 | 相干矩阵结构 | 幅度 |
|---|---|---|---|---|
| 0 | — | AC 始终相干 / NC 从不失相干 | 全 1 / 全 ε | 不变 |
| 1 | 1 | 第 1 景后发生动态变化 | 十字或块 | TC 不变 / DC 改变 |
| 2 | 2 | 第 2 景后 | 同上 | 同上 |
| 3 | 3 | 第 3 景后 + **ADCS** | 十字 / 独立岛 | 同上 / 岛屿自有 β⁰ |

* **TC（暂态变化，Eq. (12)）**：以变化时刻为中心的一"十字"低值，事件外的历元之间
  仍保持相干（目标恢复）。Δα ≡ 0（Sec. II-B），即后向散射不变；连续多个事件历元
  之间也保持低相干。
* **DC（确定性变化，Eq. (13)）**：变化点之后形成新的雷达目标，与初始目标永久失相干，
  呈**块结构**；Δα ≠ 0，雷达亮度按 Eq. (29) 变化。
* **ADCS**：第 3、4 景之间的一段很短的独立相干"岛"，并拥有自己的 β⁰；随机生成器
  会将其 `icp` 固定为 2，避免原先 class-3 端点把两个岛屿景压到同一景的问题。
* **DC** 的 β⁰ 按 Eq. (29) 实现：σ⁰ 保持原始入射角，只有
  `sin(theta_L + Delta_alpha) / sin(theta_L)` 改变局部雷达亮度。

### 3.2 时空变化模式（Sec. IV-B，Fig. 5）

恒定坡度 Δα 的"材料堆"（圆锥或金字塔）从角点或边进入被照射区域，含 4 种翻转
（模拟升/降轨等观测几何），并随时间平移（Fig. 5b/5c）。批量生成由 `sample_patterns`
完成；平移现在采用零填充裁剪，
不会通过 `np.roll` 从 patch 对侧周期性回绕；第 `i_cp` 景达到完全进入状态。

### 3.3 数据规模（Sec. IV-C）

论文：每个视数 L 生成 **1,855,740** 个 patch，共 **7,422,960** 个
`[128×128×10]` patch（10 = 4 幅度 + 6 相干）。
本复现在线生成（不落盘），规模按算力缩放，见 §5。

自检（`python -m daninet.data.test_generator`，6 项全部 PASS）：

```
1. backscatter   Ulaby/TanDEM-β0 曲线有限且可计算
2. scaling       四种目标类型的 10log10(E|S|²/β0) 均在 ±0.05 dB 内
3. coherence     样本相干估计的有限视数偏置符合 sqrt(π/4L)，L=9 时低相干对偏置 +0.25
4. signatures    AC 单块 / NC 全去相干 / TC 十字 / DC 块 / ADCS 独立岛，全部复现
5. timing        patch 形状、[0,1] 归一化、空间标签
6. regressions   Cholesky、连续 TC、随机 ADCS、像素级标签回归检查
```

---

## 4. 网络与训练（Sec. V）

### 4.1 DANI-NET（Sec. V-A，Fig. 7）

* **输入块**：两个 1×1 卷积把 10 个输入通道逐步混到 128 个特征图，各接 BN + ReLU，
  卷积前做 same padding 保持尺寸。
* **隐藏块**：`n` 个 3×3、128 通道卷积 + BN + ReLU，**完全不含池化**，全分辨率。
* **输出块**：1×1 卷积 + BN + dropout，再 1×1 卷积降到 4 类，softmax。

可训练参数量 vs. 论文 Table IV：

| 深度（隐藏块数） | 本复现 | Table IV | 偏差 |
|---|---|---|---|
| 5 | **759,124** | 759,044 | +80 (0.01 %) |
| 10 | 1,498,324 | 1,496,452 | +1,872 |
| 15 | 2,237,524 | 2,235,652 | +1,872 |
| 20 | 2,976,724 | 2,974,852 | +1,872 |
| 25 | 3,715,924 | 3,714,052 | +1,872 |

> **⚠ 复现发现 6：Table IV 自身不自洽。**
> 表中 5→10 块的增量是 1,496,452 − 759,044 = **737,408**，不能被 5 整除；
> 而 10→15→20→25 的增量恒为 **739,200 = 5 × 147,840**。
> 一个 3×3、128→128 卷积（含偏置 147,584）+ BN（256）= **147,840**，与恒定增量完全一致，
> 这独立验证了隐藏块的定义；据此反推，Table IV 中 5 块那一行应比线性外推值小约 1,792。
> 本复现的架构精确复现了"每 5 块 +739,200"的增量规律。

### 4.2 训练策略（Sec. V-B）

* 损失：Categorical Cross-Entropy（Eq. (34)），实现为对 logits 的 `cross_entropy`
  （softmax + CCE，数值等价）。
* 优化器：Adam，学习率按 Eq. (35)：`1e-4 (≤14 epoch) → 1e-5 (15-24) → 1e-6 (>24)`。
* 早停：验证损失 16 个 epoch 无改善则停止。
* 输入归一化到 [0,1]：相干本身在 [0,1]，幅度按全局最大/最小后向散射归一化（Sec. V-B）。
* 数据划分：80 % 训练 / 20 % 验证（Sec. V-B），测试集独立生成（Sec. V-D，
  `L ~ U[9,16,25,36,49,121]`，其中 **L = 25、49 训练时从未见过**）。

### 4.3 工程实现

* **在线生成**：patch 由进程池（6 worker，实测 ~264 patch/s）并行生成，
  与 GPU 训练重叠；每个 batch 用固定 seed（`base + k`），保证**完全可复现**，
  验证集每个 epoch 完全一致。
* **混合精度**：`torch.amp` + GradScaler。
* 设备吞吐：batch 16 时 ~167 patch/s，显存峰值 ~1.0 GB。

---

## 5. 复现规模与论文的差异（重要）

论文的算力规模（单卡 V100、250 epoch、每 epoch 约 15 min、共约 60 h、
每类训练集 1.48 M patch）无法在单台笔记本 GPU 上原样重跑。本复现**保持算法、
物理与评估口径完全一致**，只缩放数据量与 epoch 数：

| 项目 | 论文 | 本复现 |
|---|---|---|
| patch 尺寸 | 128×128×10 | 同 |
| 导频 patch | 16×16 | 同 |
| 训练 patch / epoch | ~1.48 M（基线）/ 3.05 M（增强） | 10,000（全量可运行版） |
| epoch | 250（早停 16） | 15（全量可运行版） |
| batch | 180 组 × ~1000 patch | 16 patch |
| 数据来源 | 预生成 742 万 patch | 在线生成（不落盘） |
| 硬件 | NVIDIA V100 | RTX 4060 Laptop 8 GB；实际训练约 28.1 分钟 |

因此本文的训练结果用于**验证流程正确性与定性规律**（类别可分性、L 泛化趋势、
混淆矩阵结构），**不用于复现论文的具体精度数值**。修复后的 augmented 运行使用
change-focused 采样来覆盖论文强调的 class 1/2 变化样本；原始论文的完整
“一半基线 + 一半变化增强”规模仍需按论文算力另行运行。

---

## 6. 修复后全量运行结果

最终全量可运行训练位于 `runs/final_augmented_v2/`，使用最终修复后的代码和 augmented 配置：15 epoch、每 epoch 10,000 个 patch、batch 16、训练视数 `[9,16,36,121]`，测试视数 `[9,16,25,36,49,121]`。实际训练耗时约 28.1 分钟，最佳 epoch 为 15。完整汇总见 `out/summary.md`。

| 测试 L | weighted F1 | ACC | p_D(c0) | p_D(c1) | p_D(c2) | p_D(c3) |
|---:|---:|---:|---:|---:|---:|---:|
| 9 | 0.702 | 0.704 | 0.817 | 0.566 | 0.603 | 0.663 |
| 16 | 0.718 | 0.721 | 0.842 | 0.566 | 0.616 | 0.678 |
| 25* | 0.729 | 0.732 | 0.853 | 0.572 | 0.630 | 0.693 |
| 36 | 0.739 | 0.742 | 0.863 | 0.575 | 0.642 | 0.705 |
| 49* | 0.747 | 0.750 | 0.871 | 0.576 | 0.654 | 0.718 |
| 121 | 0.769 | 0.772 | 0.886 | 0.574 | 0.696 | 0.760 |

`*` L=25、49 未参与训练。验证 weighted F1 从第 1 epoch 的 0.605 提升到第 15 epoch 的 0.723，验证 ACC 从 0.612 提升到 0.726。

修复后的生成器现在具有以下可验证性质：

* 标签按空间事件掩膜逐像素生成，class 0 是未变化背景；一次 12 patch 回归样本的 changed-label fraction 约为 0.55。
* ADCS 随机路径固定为 acquisition 2–3 的独立相干岛。
* `L @ L.T` 与目标 Γ 的最大误差约为 `1.1e-16`。
* 连续 TC 事件中，事件历元之间也保持低相干。
* 模式平移采用零填充裁剪，没有周期性回绕。
* DC 的 β⁰ 按 Eq. (29) 的局部入射角比例更新；TanDEM-β0 按 Eq. (18) 直接计算。

旧的 `augmented_LALL`、`baseline_L9` 和 `baseline_L121` 指标是在修复前生成的，已保留作历史文件，但不应与本节结果比较。`fixed_augmented_smoke` 是小规模回归训练，不是最终模型。

---

## 7. 使用方法

```powershell
$py = "D:\anima_trainer_ref\venv\Scripts\python.exe"
cd E:\DaniNet

# 1) 信号模型自检（6 项物理一致性测试）
& $py -m daninet.data.test_generator

# 2) 网络参数量 vs Table IV
& $py -m daninet.net.model

# 3) 训练（本次复现使用的配置）
& $py -u -m daninet.net.train --mode baseline  --L 9   --patches 10000 --epochs 15 --batch 16 --workers 6
& $py -u -m daninet.net.train --mode baseline  --L 121 --patches 10000 --epochs 15 --batch 16 --workers 6
& $py -u -m daninet.net.train --mode augmented         --patches 10000 --epochs 15 --batch 16 --workers 6 --name final_augmented_v2

# 4) 图与表
& $py -m daninet.plot dataset      # Fig. 11 数据集统计
& $py -m daninet.plot example      # Fig. 6  合成 patch 示例
& $py -m daninet.plot report       # Table III/VIII 汇总 + 混淆矩阵 + 训练曲线
```

`--model ulaby` 可切换到 Ulaby 后向散射模型；`--blocks N` 可切换网络深度（Table IV）。

### 7.1 Ascend NPU（910_9382 实测）

```bash
source /usr/local/Ascend/ascend-toolkit/set_env.sh   # 必须先执行，否则 import torch 失败
export ASCEND_RT_VISIBLE_DEVICES=0                  # 单卡
export OMP_NUM_THREADS=1                            # 关键：避免 worker 间 BLAS 线程争抢

# 数值一致性 + 纯算力吞吐
python -m daninet.tools.parity_check --device npu --batch 8

# 训练（CANN 原生 fp16 + fp16 数据管道）
python -u -m daninet.net.train --mode augmented \
  --patches 10000 --val-patches 4000 --test-patches 4000 \
  --epochs 50 --batch 32 --workers 16 --prefetch 32 \
  --transport fp16 --amp auto --device npu --name a3_aug_e50
```

| 参数 | 说明 |
| --- | --- |
| `--device auto\|npu\|cuda\|cpu` | `auto` 按 npu → cuda → cpu 选择；显式 `npu` 失败会直接报错，不静默回落 |
| `--amp auto\|on\|off` | `auto` 在 cuda/npu 上启用 fp16；`off` 为 fp32 基线 |
| `--transport fp32\|fp16` | worker 到主进程的传输精度；fp16 让数据管道吞吐接近翻倍 |
| `--prefetch N` | 预取批数，默认 16；A3 上 32 更稳 |
| `--wd F` | Adam weight decay，默认 0（论文未指定，非必要不开） |

实测（单卡 910_9382）：fp32 算力 516–598 patch/s，AMP 850 patch/s；数据管道 fp32 332 → fp16 776 patch/s；与 GPU 基线的逐视数 F1 差异 ≤ 0.0003，耗时 28.1 min → 8.9 min。
