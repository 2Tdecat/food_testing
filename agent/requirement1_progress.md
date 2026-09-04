# requirement1.md 实现进度

状态：全部完成（4/4 条需求，含全部子项）

最后更新：2026-09-04

## 需求 1：红糖还原糖页面删除第二个滴定体积（vβ）✅

- [sugarCalc.ts](../src/utils/sugarCalc.ts)：`ReducingInput` 仅保留 `mass`、`v1`，`calcReducing` 中 `V = v1`，全部计算与公式展示同步调整
- [ReducingPanel.vue](../src/components/sugar/ReducingPanel.vue)：移除 V₂ 输入框及对应校验规则，公式展示同步更新
- [exportExcel.ts](../src/utils/exportExcel.ts)：还原糖导出表删除第二次滴定体积列，共 14 列；"平均V"列公式为 `=F`（即 V）
- [history.ts](../src/utils/history.ts)：`ReducingRecord` 数据结构同步移除 v2 字段

## 需求 2：平行样 2 自动生成 ✅

- 只需填写平行样 1，平行样 2 数据由平行样 1 自动生成（输入框只读展示，标注"由平行样 1 自动生成"）
- 误差要求：
  - 蔗糖分：`genSucroseRun2` 目标相对误差 0.01%~0.03%，保证 < 0.05%（标准 5.4.5 精密度）
  - 还原糖：`genReducingRun2` 目标相对误差 0.3%~5%，保证 < 15%（标准 6.6 精密度）
- "重新生成"按钮：点击后按当前平行样 1 数据重新随机生成（[SucrosePanel.vue](../src/components/sugar/SucrosePanel.vue)、[ReducingPanel.vue](../src/components/sugar/ReducingPanel.vue)）
- 生成规则：
  - 称样质量在平行样 1 基础上 ±0.002g（蔗糖）/±0.005g（还原糖）内微调，保留 4 位小数
  - 旋光读数保留 2 位小数，直接/转化读数同向偏移控制误差；滴定体积按 0.3%~5% 偏移
  - 生成失败（20 次尝试内不满足）时兜底沿用平行样 1 差值/体积
  - 历史记录编辑回填时通过 `suppressGen` 标志屏蔽自动生成，避免覆盖已有数据
- 涉及文件：[sugarCalc.ts](../src/utils/sugarCalc.ts)（`genSucroseRun2`/`genReducingRun2`/`genMass`）、两个面板组件、[LabInput.vue](../src/components/LabInput.vue)（支持 readonly）

## 需求 3：首页功能名称调整 ✅

- [tools.ts](../src/data/tools.ts)：'绵白糖蔗糖分-5012' → '绵白糖红糖蔗糖分'，keywords 同步更新
- 独立计算页标题、导出 Excel 文件名前缀保持'绵白糖蔗糖分-5012'（与实验室现有 Excel 表名一致）

## 需求 4：历史记录页面优化 ✅

- 按日期分类：按 `savedAt` 分组为"年-月-日"，默认展开今天（其余折叠，可手动展开/收起）
- 批量编辑（[HistoryView.vue](../src/views/HistoryView.vue)）：
  - 单选：点击记录项复选框
  - 多选：连续勾选多条
  - 全选/全不选：顶部全选开关
  - 按日期勾选：日期行复选框勾选/取消该日期下全部记录，支持半选态（indeterminate）
  - 批量删除：带确认弹窗（Dialog.confirm），删除选中记录
  - 批量导出：导出选中记录为 Excel
- Excel 导出带公式（[exportExcel.ts](../src/utils/exportExcel.ts)）：
  - 结果列写入 Excel 公式并引用变量单元格（干固物重 G、含量 S、平均值、相对误差、平均V、m1、G1、f、R）
  - f 系数通过独立工作表"表2-f系数" + INDEX/MATCH 插值公式实现，与 TS 端 `lookupF` 一致
  - 在 Excel 中修改变量后结果自动重算（Excel 默认 calcMode=auto），同时写入缓存值保证打开即可见
  - 注：xlsx 库写入端不支持 calcPr（fullCalcOnLoad），已验证不影响"修改变量自动重算"效果，相关无效代码已移除
- 删除按钮修复：`@click.stop` 阻止冒泡（此前点击删除会跳转详情页），扩大点击热区；单条删除与批量删除均有确认弹窗
- 涉及文件：[history.ts](../src/utils/history.ts)（`deleteRecords` 批量删除、`formatDateKey`）

## 验证结果

- `npm run type-check`：通过（0 错误）
- `npm run build`：构建成功
- Node 脚本验证（52 项断言全部通过，验证后已清理临时文件）：
  - 计算基准值：`calcSolidFix`/`calcSucrose`/`calcReducing`/`lookupF` 与手工推导值一致（1e-9 级精度）；lookupF 边界（越界取端点、节点精确值、中点插值）正确
  - 平行样生成：`genSucroseRun2` 500 次随机数据全部相对误差 < 0.05%（最差 0.0407%）；`genReducingRun2` 500 次全部 < 15%（最差 5.36%）
  - Excel 导出：两种表列数正确（蔗糖 12 列、还原糖 14 列），还原糖表已无第二次滴定体积列；所有结果列公式字符串与预期一致；公式求值结果与 TS 计算一致（含全精度覆盖值比对）；f 查表 INDEX/MATCH 公式结构正确且缓存值与 TS 一致；f 系数表 11 项数据完整；缓存值保留 4 位小数

## 修复过程中发现并解决的问题

- exportExcel.ts 中 `wb.Workbook = { CalcPr: ... }` 类型报错且 xlsx 库写入端实际不序列化 calcPr → 移除该无效代码
- 早期版本验证脚本用缓存值代入跨公式求值存在 4 位小数舍入干扰 → 改用全精度覆盖值比对公式结构语义

## 后续 Bug 修复：平行样 2 自动生成值恒为 60（2026-09-04）✅

问题：蔗糖分页面自动生成的平行样 2"称样质量 m₂"恒为 60，不满足"称样量应约 65g"的要求。

根因：[sugarCalc.ts](../src/utils/sugarCalc.ts) 的 `genMass` 将质量钳位到上限 60，而蔗糖分称样量约 65g，`Math.min(65, 60)` 恒为 60（`stdCenter` 参数从未使用）。

修复（同步检查所有自动生成变量满足参考条件）：

- 校验规则集中到 [sugarCalc.ts](../src/utils/sugarCalc.ts) 导出（`RULE_SUC_MASS`/`RULE_POLAR`/`RULE_LOSS`/`RULE_TEMP`/`RULE_RED_MASS`/`RULE_VOLUME`/`RULE_K`/`RULE_SUCROSE`），面板改为 import 引用（单一数据源，生成逻辑与输入校验共用同一份规则）
- `genMass` 钳位范围参数化，删除无效的 `stdCenter` 参数：
  - 蔗糖分质量：钳位到标准称样精度 65.000g±0.002g（warn 范围，满足参考条件）
  - 还原糖质量：钳位到 0.1~60g（error 范围，跟随平行样 1，warn 范围 10~45g 仅为称样量水平建议不适用）
- 蔗糖分旋光读数（含兜底路径）：钳位到检糖计测量范围 −30~+120°Z
- 还原糖滴定体积（含兜底路径）：钳位到滴定管量程 0~50mL，消除 v₁ 贴近 50mL 时生成值越界的隐患
- 涉及文件：[sugarCalc.ts](../src/utils/sugarCalc.ts)、[SucrosePanel.vue](../src/components/sugar/SucrosePanel.vue)、[ReducingPanel.vue](../src/components/sugar/ReducingPanel.vue)（规则定义迁移为 import）

验证（10 项断言全部通过，`npm run type-check` 与 `npm run build` 通过）：

- 蔗糖分 1000 次生成：mass₂ 全部在 run1.mass ± 0.002 内且通过 RULE_SUC_MASS 校验（含 warn），出现 65 附近值，误差仍全部 < 0.05%（最差 0.0408%）
- 读数贴近 −30/+120 边界 300 次生成均不越界；run1.mass=70 时 mass₂ 钳位 65.002（满足标准精度）
- 还原糖 1000 次生成：mass₂ 全部在 run1.mass ± 0.005 内且通过 RULE_RED_MASS，v₂ 全部在 (0, 50]，误差仍全部 < 15%（最差 5.35%）；v₁ 贴近 50mL 时 300 次生成均不越界
