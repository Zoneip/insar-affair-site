# docs/ — 文档总索引

本目录存放**供人阅读**的项目资料。当前文档数量少，保持**平铺**，不预建分类目录。

## 现行文档

| 文档 | 内容 |
| --- | --- |
| （暂无） | 项目说明、架构说明、调研报告、操作手册、交接记录将在此登记 |

> **复现报告**：`daninet/README.md`（14 KB，已入库）是当前最完整的复现说明，含公式对照、复现发现（Eq. 6 方向、Table IV 不自洽）、训练配置与结果表。后续可提炼为 `docs/reproduction-report.md` 并在本索引登记。

## 报告（`docs/reports/`）

按日期归档的成套报告：代码说明书、数据分析报告、缺陷与改进分析。**只在用户主动要求时生成**，流程见 `.dsh/skills/project-report/SKILL.md`。

本站点由 GitHub Pages 从 `main` 分支 `/docs` 目录发布（`.nojekyll` 关闭 Jekyll）：

- 总览：`https://zoneip.github.io/InSAR_affair/`
- 单次：`https://zoneip.github.io/InSAR_affair/reports/<YYYY-MM-DD>/`

| 日期 | 目录 | 内容 |
| --- | --- | --- |
| （暂无） | — | 首次报告生成后在此登记 |

原始产出（含口语稿与代码 zip）留在 `report/<YYYY-MM-DD>/`，不入库；本目录只放站点文件（HTML/SVG/CSS）与三份 `.md` 原文。

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
