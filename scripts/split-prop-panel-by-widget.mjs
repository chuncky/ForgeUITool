/**
 * Generate per-widget property panel design docs.
 * Source: packages/core/src/widgets.ts + 控件属性面板使用说明.md §5
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs", "控件属性面板详设");
const manualPath = path.join(root, "docs", "工具详细说明手册", "控件属性面板使用说明.md");
const moduleDocPath = path.join(root, "docs", "嵌入式UI工具_控件属性面板详细设计说明.md");
const widgetsPath = path.join(root, "packages", "core", "src", "widgets.ts");

const widgetsSrc = fs.readFileSync(widgetsPath, "utf8");
const manual = fs.readFileSync(manualPath, "utf8");

const categoryLabel = {
  layout: "布局",
  button: "按钮",
  display: "数据展示",
  input: "表单输入",
  media: "图片媒体",
  viz: "可视化",
};

const orderPref = [
  "screen",
  "container",
  "button",
  "label",
  "image",
  "slider",
  "switch",
  "checkbox",
  "bar",
  "arc",
  "dropdown",
  "textarea",
  "list",
  "roller",
  "imagebutton",
  "spinner",
  "tabview",
  "keyboard",
  "msgbox",
  "line",
  "led",
  "animimg",
  "spinbox",
  "scale",
  "qrcode",
  "barcode",
  "canvas",
  "calendar",
  "digitalclock",
  "tileview",
  "win",
  "menu",
  "spangroup",
  "table",
  "buttonmatrix",
  "linechart",
  "barchart",
  "scatterchart",
  "chart",
];

function parseWidgets() {
  const items = [];
  const re = /\{\s*\n\s*type:\s*"([^"]+)"/g;
  let m;
  const starts = [];
  while ((m = re.exec(widgetsSrc))) starts.push({ type: m[1], index: m.index });

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].index;
    const end = i + 1 < starts.length ? starts[i + 1].index : widgetsSrc.length;
    const block = widgetsSrc.slice(start, end);
    const type = starts[i].type;
    const labelZh = (block.match(/"zh-CN":\s*"([^"]+)"/) || [])[1] || type;
    const category = (block.match(/category:\s*"([^"]+)"/) || [])[1] || "";
    const isContainer = /isContainer:\s*true/.test(block);
    const stylePartsMatch = block.match(/styleParts:\s*\[([^\]]*)\]/);
    const styleParts = stylePartsMatch
      ? [...stylePartsMatch[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])
      : ["main"];
    const eventsMatch = block.match(/events:\s*\[([^\]]*)\]/);
    const events = eventsMatch ? [...eventsMatch[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
    const extraDataEditor = (block.match(/extraDataEditor:\s*"([^"]+)"/) || [])[1];
    const defaultExtraDataRaw = (block.match(/defaultExtraData:\s*(\{[\s\S]*?\})\s*,\s*\n\s*(?:codegen|extraDataEditor|events|styleParts)/) ||
      block.match(/defaultExtraData:\s*(\{[^;]*?\})\s*,/))?.[1];
    const defaultExtraData = defaultExtraDataRaw?.replace(/\s+/g, " ").trim().slice(0, 220);
    const props = [];
    const propsBlock = block.match(
      /props:\s*\[([\s\S]*?)\],\s*\n\s*(?:lvglPropApis|styleParts|events|extraDataEditor|defaultExtraData|codegen)/,
    );
    if (propsBlock) {
      const propRe =
        /\{\s*name:\s*"([^"]+)"\s*,\s*type:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"\s*,\s*default:\s*([^}\n]+)/g;
      let pm;
      while ((pm = propRe.exec(propsBlock[1]))) {
        props.push({
          name: pm[1],
          type: pm[2],
          label: pm[3],
          default: pm[4].replace(/,$/, "").trim(),
        });
      }
    }

    items.push({
      type,
      labelZh,
      category,
      isContainer,
      props,
      styleParts,
      events,
      extraDataEditor,
      defaultExtraData: defaultExtraData?.replace(/\s+/g, " ").slice(0, 220),
    });
  }
  return items;
}

function extractManualSection(type, labelZh) {
  const aliases = type === "container" ? ["obj", "container"] : [type];
  for (const alias of aliases) {
    const re = new RegExp(
      `^#{2,4}\\s+[\\d.]+\\s+[^\\n]*[（(]\`?${alias}\`?[）)][^\\n]*\\n([\\s\\S]*?)(?=^#{2,3}\\s+[\\d.]+|\\Z)`,
      "im",
    );
    const m = manual.match(re);
    if (m) return m[0].trim();
  }
  const re2 = new RegExp(
    `^#{2,4}\\s+[\\d.]+\\s+${labelZh.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}[（(][^）)]+[）)][^\\n]*\\n([\\s\\S]*?)(?=^#{2,3}\\s+[\\d.]+|\\Z)`,
    "im",
  );
  const m2 = manual.match(re2);
  return m2 ? m2[0].trim() : "";
}

function propsTable(w) {
  if (!w.props.length) return "（无专用 `props`；面板仍含位置信息、行为配置、样式。）\n";
  const rows = w.props
    .map((p) => `| \`${p.name}\` | ${p.label} | \`${p.type}\` | \`${p.default.replace(/\|/g, "\\|")}\` |`)
    .join("\n");
  return `| 字段 | 面板标签 | 类型 | 默认值 |\n|------|----------|------|--------|\n${rows}\n`;
}

function coerceDefault(s) {
  const t = String(s).trim().replace(/,$/, "");
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null" || t === "undefined") return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  if (t.startsWith("{") || t.startsWith("[")) return t; // keep JS literal as string
  return t;
}

function buildDoc(w, order) {
  const manualSec = extractManualSection(w.type, w.labelZh);
  const bekenType = w.type === "container" ? "obj" : w.type;
  const cat = categoryLabel[w.category] || w.category || "—";
  const exampleProps = Object.fromEntries(w.props.map((p) => [p.name, coerceDefault(p.default)]));
  const example = {
    type: w.type,
    id: `${w.type}_1`,
    name: w.labelZh,
    frame: { x: 0, y: 0, w: 100, h: 40 },
    props: exampleProps,
    ...(w.extraDataEditor ? { extraData: { _editor: w.extraDataEditor } } : {}),
    style: { main: { default: {} } },
    events: [],
    children: [],
  };

  const parts = [
    `# ${w.labelZh}（\`${w.type}\`）属性面板设计`,
    "",
    "> **文档类型：** 控件属性面板 — 单控件设计契约  ",
    "> **所属模块：** [《控件属性面板详细设计说明》](../嵌入式UI工具_控件属性面板详细设计说明.md)  ",
    `> **Forge 类型：** \`${w.type}\`  `,
    `> **分类：** ${cat}  `,
    "> **权威注册表：** `packages/core/src/widgets.ts`  ",
    "> **字段级用户手册：** `docs/工具详细说明手册/控件属性面板使用说明.md`  ",
    `> **Beken 规格：** \`ref/beken/.../component-specs/${bekenType}/\`（若存在）`,
    "",
    "---",
    "",
    "## 1. 设计目标",
    "",
    "- 属性 Tab 按模块详设 §3.3 分组：身份头 → 位置信息 → **专用属性** → 扩展数据（若有）→ 行为配置 → 样式。",
    "- 写路径：面板 → `projectStore.patchSelected` / `patchSelectedStyle` → IPC → Core；画布须满足 **FR-016e**（改完可见）。",
    "- 禁止用 `children` 冒充列表/标签/图表数据（**FR-016b**）；结构化数据走 `extraData`。",
    "",
    "## 2. 注册表契约（WidgetSpec）",
    "",
    "| 项 | 值 |",
    "|----|----|",
    `| type | \`${w.type}\` |`,
    `| 中文名 | ${w.labelZh} |`,
    `| category | \`${w.category}\` |`,
    `| isContainer | ${w.isContainer} |`,
    `| styleParts | ${w.styleParts.map((p) => `\`${p}\``).join(", ")} |`,
    `| events | ${w.events.length ? w.events.map((e) => `\`${e}\``).join(", ") : "—"} |`,
    `| extraDataEditor | ${w.extraDataEditor ? `\`${w.extraDataEditor}\`` : "—"} |`,
    "",
    "### 2.1 专用属性（props）",
    "",
    propsTable(w),
  ];

  if (w.extraDataEditor) {
    parts.push(
      "### 2.2 扩展数据（extraData）",
      "",
      `- 编辑器种类：\`${w.extraDataEditor}\`（见模块详设 §4.2 / \`ExtraDataGroup\`）`,
      w.defaultExtraData ? `- 默认：\`${w.defaultExtraData}\`` : "- 默认：见 `widgets.ts` `defaultExtraData`",
      "",
      "### 2.3 样式 Part",
      "",
    );
  } else {
    parts.push("### 2.2 样式 Part", "");
  }

  parts.push(
    w.styleParts.map((p) => `- \`${p}\``).join("\n"),
    "",
    "通用样式子组见模块详设 §6；多 Part 控件须在 PART 下拉中分别编辑。",
    "",
    "## 3. 面板实现要点",
    "",
    "| 能力 | 要求 |",
    "|------|------|",
    "| DynamicPropForm | 仅渲染上表 PropSpec；类型映射见模块详设 §5.2 |",
    "| StyleGroup | Part = styleParts；`bg_image` / `text_font` 须资源库拾取且画布真显示（§6.4 / §6.5） |",
    `| ExtraData | ${w.extraDataEditor ? `使用 \`${w.extraDataEditor}\`；改完须驱动画布` : "无"} |`,
    "| 事件 Tab | 仅注册表 events 中的触发器 |",
    "| 删除 | 底部删除 + Delete/Backspace（FR-012a） |",
    "",
    "## 4. JSON 落盘形态（摘要）",
    "",
    "```json",
    JSON.stringify(example, null, 2),
    "```",
    "",
    "## 5. 验收要点",
    "",
    "1. 选中后属性 Tab 显示专用字段与正确 Part 列表。",
    "2. 修改专用属性/样式后画布或预览可观测变化（FR-016e）；存档后 JSON 一致。",
    "3. 若有 extraData：增删改与 CodeGen 同源，不得依赖伪子控件。",
    "4. Undo/Redo 可回退属性修改。",
    "",
  );

  if (manualSec) {
    parts.push(
      "## 6. 用户手册摘录（字段 encyclopedia）",
      "",
      "> 摘自《控件属性面板使用说明》；冲突时以 `widgets.ts` + 需求 FR 为准。",
      "",
      manualSec
        .split("\n")
        .map((line) => {
          if (line.startsWith("####")) return "###" + line.slice(4);
          if (line.startsWith("###")) return "##" + line.slice(3);
          return line.replace(/\]\(\.\.\/beken界面\//g, "](../../beken界面/");
        })
        .join("\n"),
      "",
    );
  } else {
    parts.push(
      "## 6. 用户手册",
      "",
      `详见 \`docs/工具详细说明手册/控件属性面板使用说明.md\` 中与 \`${w.type}\` /「${w.labelZh}」对应小节。`,
      "",
    );
  }

  parts.push(
    "---",
    "",
    `*分册序号：${order} · 生成自注册表与用户手册；模块架构见 [总目录](../嵌入式UI工具_控件属性面板详细设计说明.md)。*`,
    "",
  );
  return parts.join("\n");
}

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) {
  if (f.endsWith(".md")) fs.unlinkSync(path.join(outDir, f));
}

const widgets = parseWidgets().sort((a, b) => {
  const ia = orderPref.indexOf(a.type);
  const ib = orderPref.indexOf(b.type);
  return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.type.localeCompare(b.type);
});

console.log("widgets:", widgets.length);

const toc = [];
let idx = 1;
for (const w of widgets) {
  const fname = `${String(idx).padStart(2, "0")}-${w.type}.md`;
  fs.writeFileSync(path.join(outDir, fname), buildDoc(w, idx), "utf8");
  toc.push({ idx, w, fname });
  console.log("wrote", fname);
  idx++;
}

fs.writeFileSync(
  path.join(outDir, "README.md"),
  `# 控件属性面板详设 — 分册（按控件）

每个控件一份属性面板设计契约。生成自 \`packages/core/src/widgets.ts\` 与用户手册 §5。

**模块总目录（架构 / IPC / 共性契约）：** [\`../嵌入式UI工具_控件属性面板详细设计说明.md\`](../嵌入式UI工具_控件属性面板详细设计说明.md)

| # | 控件 | 类型 | 文档 |
|---|------|------|------|
${toc.map((t) => `| ${t.idx} | ${t.w.labelZh} | \`${t.w.type}\` | [${t.fname}](./${t.fname}) |`).join("\n")}

重新生成：\`node scripts/split-prop-panel-by-widget.mjs\`
`,
  "utf8",
);

let moduleDoc = fs.readFileSync(moduleDocPath, "utf8");
// strip previous auto TOC if re-run
moduleDoc = moduleDoc.replace(/\n> \*\*结构：\*\* 2026-08-05 起[\s\S]*?\n---\n\n## 1\. 文档说明/, "\n## 1. 文档说明");
moduleDoc = moduleDoc.replace(/\n## 分册目录（按控件）[\s\S]*?\n---\n\n## 1\. 文档说明/, "\n## 1. 文档说明");

const tocBlock = `
> **结构：** 2026-08-05 起 **按控件** 拆分为 \`docs/控件属性面板详设/\`；本文件保留模块架构与共性契约。

---

## 分册目录（按控件）

完整列表见 [\`docs/控件属性面板详设/README.md\`](./控件属性面板详设/README.md)。

| # | 控件 | 文档 |
|---|------|------|
${toc.map((t) => `| ${t.idx} | ${t.w.labelZh}（\`${t.w.type}\`） | [./控件属性面板详设/${t.fname}](./控件属性面板详设/${t.fname}) |`).join("\n")}

---
`;

if (!moduleDoc.includes("## 分册目录（按控件）")) {
  moduleDoc = moduleDoc.replace("\n## 1. 文档说明", `\n${tocBlock}\n## 1. 文档说明`);
}
moduleDoc = moduleDoc.replace(
  "| UI 分组 → JSON → IPC → Core API 全链路 | 38 控件逐字段操作步骤（见用户手册 §5） |",
  "| UI 分组 → JSON → IPC → Core API 全链路 | 单控件设计见 `docs/控件属性面板详设/`；操作 encyclopedia 见用户手册 §5 |",
);
moduleDoc = moduleDoc.replace(
  "*本文为《软件详细设计说明》的补充模块契约；与用户手册冲突时以需求 FR 与已锁定决策 D-01～D-07 为准。38 控件字段级说明以用户手册 §5 为权威，本文档侧重工程实现与分期验收。*",
  "*本文为模块契约总目录；单控件属性设计见 `docs/控件属性面板详设/`。实现进度见 `docs/IMPLEMENTATION_PROGRESS.md`。与用户手册冲突时以需求 FR 与已锁定决策为准。*",
);
fs.writeFileSync(moduleDocPath, moduleDoc, "utf8");
console.log("done", toc.length);
