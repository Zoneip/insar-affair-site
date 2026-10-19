# docs/ — 文档总索引

本目录存放**供人阅读**的项目资料。当前文档数量少，保持**平铺**，不预建分类目录。

## 现行文档

| 文档 | 内容 |
| --- | --- |
| `docs/content/segmentation.md` | **InSAR 矩阵分割**：SVM 历史基线、CNN 当前主线、daninet 方案占位（置顶，长期维护） |
| `docs/content/analysis.md` | 数据分析：四组对照实验设置与结论 |
| `docs/content/gaps.md` | 缺陷清单、改进所需资源、疑难点 |
| `docs/content/status-panel.md` | 总览状态面板（人工维护） |

> **复现报告**：`daninet/README.md`（14 KB，已入库）是当前最完整的复现说明，含公式对照、复现发现（Eq. 6 方向、Table IV 不自洽）、训练配置与结果表。后续可提炼为 `docs/reproduction-report.md` 并在本索引登记。

## 报告（`docs/reports/`）

按日期归档的成套报告：代码说明书、数据分析报告、缺陷与改进分析。**只在用户主动要求时生成**，流程见 `.dsh/skills/project-report/SKILL.md`。

站点由公开仓库 `Zoneip/insar-affair-site` 发布（本仓库为 private，免费账户不支持私有仓库 Pages；每次发布用 `.dsh/skills/project-report/scripts/publish_site.sh` 同步 `docs/`）：

- 总览：`https://zoneip.github.io/insar-affair-site/`
- 训练直播：`https://zoneip.github.io/insar-affair-site/live/`
- 单次报告：`https://zoneip.github.io/insar-affair-site/reports/<YYYY-MM-DD>/`

| 日期 | 目录 | 内容 |
| --- | --- | --- |
| （暂无） | — | 首次报告生成后在此登记 |

原始产出（含口语稿与代码 zip）留在 `report/<YYYY-MM-DD>/`，不入库；本目录只放站点文件（HTML/SVG/CSS）与三份 `.md` 原文。

## 站点页面（GitHub Pages）

| 页面 | 路径 | 内容 |
| --- | --- | --- |
| 总览 | `/` | 各分区入口卡片 |
| 训练看板 | `/live/` | 逐 epoch 指标、回放（不自动播放） |
| 数据分析 | `/analysis/` | 四组对照实验设置与结论 |
| 可视化 | `/visual/` | 两条并行线的入口 |
| └ 矩阵分割 | `/visual/segmentation/` | 逐像素热力图、混淆、置信度 |
| └ 论文复现 | `/visual/reproduction/` | F1–视数曲线、训练过程、吞吐、逐节状态 |
| 缺陷分析 | `/gaps/` | 缺陷清单、所需资源、疑难点 |
| 文档 | `/documents/` | 三份说明/报告，可页内阅读或下载 Word |

两个可视化子页各自维护 `data.json`，互不影响：分割页由 `daninet/tools/visual_samples.py` 在 A3 上生成，复现页由 `live/data.json` 在 `build_pages.py` 里派生。

## 分层规则

1. 文档少时平铺，避免过早建目录。
2. 规模大到难以导航时，再按类别拆分（如 `architecture/`、`research/`、`operations/`、`handoff/`），并在本文件登记每个目录的职责。
3. 新增目录必须同时更新本索引与 `rules/01-structure.md`。
4. 本目录只描述**当前事实**；被取代的旧报告、旧交接移入 `achieve/docs/`，并在归档记录里留指针。

## 与其他目录的边界

- 「怎么工作」的约束 → `rules/`
- 某次任务的方案与验收 → `specs/`
- 项目当前状态与决策结论 → `AGENTS.md`
- 可再生成的中间产物 → `workspace/`
