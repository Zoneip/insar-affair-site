# 数据分析

本页汇总 2026-10-19 在单卡 Ascend910_9382 上的复现结果。所有数值取自 `daninet/runs/<run>/metrics.json`，可用页面底部命令复算。

## 实验设置

| 项 | 值 |
| --- | --- |
| 输入 | 4 个幅度 + 6 个相干，`10 × 128 × 128` |
| 网络 | 全卷积、无池化；5 blocks = 759,124 参数；10 blocks = 1,498,324 |
| 训练视数 | 9 / 16 / 36 / 121（augmented 模式混合采样） |
| 测试视数 | 9 / 16 / 25 / 36 / 49 / 121，其中 **25、49 未参与训练** |
| 损失 | Categorical Cross-Entropy（Eq. 34），Adam，学习率按 Eq. 35 三段下降 |
| 数据 | 在线合成，不落盘；每 batch 固定 seed，保证可复现 |

## 结果对比

| run | 设备 / 配置 | L=9 | L=25 | L=121 | 训练耗时 |
| --- | --- | ---: | ---: | ---: | ---: |
| `final_augmented_v2` | RTX 4060 · 5 blocks · fp32 | 0.7020 | 0.7292 | 0.7689 | 28.1 min |
| `a3_augmented_e15` | Ascend910 · 5 blocks · fp32 | 0.7020 | 0.7291 | 0.7689 | 8.9 min |
| `a3_amp_b16_e15` | Ascend910 · 5 blocks · **AMP+fp16** | 0.7021 | 0.7291 | 0.7689 | **5.8 min** |
| `a3_amp_b16_b10_e15` | Ascend910 · **10 blocks** · AMP | **0.7426** | **0.7604** | **0.7916** | 7.9 min |
| `a3_b10_e25` | Ascend910 · **10 blocks · 25 ep** | **0.7460** | **0.7628** | **0.7941** | 14.6 min |
| `a3_aug_e50` | Ascend910 · 5 blocks · 50 ep · b32 | 0.6876 | 0.7186 | 0.7609 | 21.2 min |

## 三条结论

1. **设备无关**：NPU 与 GPU 基线的逐视数差异 ≤ 0.0003，像素级 argmax 一致率 1.000，说明 `torch_npu` 路径与 CUDA 同解。
2. **混合精度免费**：AMP + fp16 数据管道的指标与 fp32 一致（Δ ≤ 0.0001），耗时降到 1/4.8。
3. **加规格要加成对的**：单纯把 epoch 加到 50、batch 加到 32 会掉 0.008–0.014，因为 Eq. 35 的学习率日程仍按 25 epoch 下降；加深到 10 blocks 则稳定提升 0.02–0.04。
4. **10 blocks 在第 15 轮后基本饱和**：从 15 轮拉到 25 轮，L=9 只涨 0.0034、L=121 只涨 0.0025，耗时却从 7.9 min 变 14.6 min。要再提升应换方向（15 blocks 或重标定学习率日程），而不是继续加 epoch。

## 类别层面

| 类别 | 含义 | L=121 的 p_D |
| --- | --- | ---: |
| c0 | 无变化 / 始终相干 | 0.886 |
| c1 | 第 1 景后发生动态变化 | 0.574 |
| c2 | 第 2 景后发生动态变化 | 0.696 |
| c3 | 第 3 景后 + ADCS | 0.760 |

c1 明显偏低：变化发生在第一个时间间隔内，可用基线只有一次，是该任务的物理下界，不是训练 bug。

## 复现命令

```bash
source /usr/local/Ascend/ascend-toolkit/set_env.sh
export ASCEND_RT_VISIBLE_DEVICES=0 OMP_NUM_THREADS=1

python -m daninet.tools.parity_check --device npu --batch 8
python -m daninet.net.train --mode augmented \
  --patches 10000 --val-patches 4000 --test-patches 4000 \
  --epochs 15 --batch 16 --blocks 10 --workers 16 --prefetch 32 \
  --transport fp16 --amp auto --device npu --name a3_amp_b16_b10_e15
```
