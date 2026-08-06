import fs from "node:fs";
import path from "node:path";

const srcPath = path.join("docs", "嵌入式UI工具_软件详细设计说明.md");
const outDir = path.join("docs", "软件详细设计");
const text = fs.readFileSync(srcPath, "utf8");
if (!text.includes("## 1. 文档说明") || !text.includes("## 9. 设计器界面详细设计")) {
  console.error(
    "Refuse to split: source is not the full LLD monolith (already an index?). Restore a full copy first.",
  );
  process.exit(1);
}
const lines = text.split(/\r?\n/);

const chapters = [
  { id: "01", start: 48 },
  { id: "02", start: 76 },
  { id: "03", start: 128 },
  { id: "04", start: 398 },
  { id: "05", start: 610 },
  { id: "06", start: 727 },
  { id: "07", start: 797 },
  { id: "08", start: 864 },
  { id: "09", start: 910 },
  { id: "10", start: 1566 },
  { id: "11", start: 1591 },
  { id: "12", start: 1637 },
  { id: "13", start: 1657 },
  { id: "14", start: 1680 },
  { id: "15", start: 1697 },
  { id: "16", start: 1712 },
  { id: "17", start: 1728 },
];

const originalTitles = [
  "文档说明",
  "仓库与包结构",
  "工程文件系统详设",
  "核心模块详细设计",
  "CodeGen（A1）详细设计",
  "预览（PreviewHost / SDL）详细设计",
  "Packer / Loader（A2）详细设计",
  "SDK 交付适配（原「平台插件」；D-08）",
  "设计器界面详细设计（Electron + Vue3）",
  "CLI 详细设计",
  "扩展点 Stub（AR）",
  "错误码",
  "黄金用例与测试",
  "实现里程碑（编码顺序）",
  "与竞品实现的映射（合规）",
  "待详细设计收口（非产品选型）",
  "修订记录",
];

const fileNames = [
  "01-文档说明.md",
  "02-仓库与包结构.md",
  "03-工程文件系统详设.md",
  "04-核心模块详细设计.md",
  "05-CodeGen详细设计.md",
  "06-预览详细设计.md",
  "07-Packer与Loader详细设计.md",
  "08-SDK交付适配.md",
  "09-设计器界面详细设计.md",
  "10-CLI详细设计.md",
  "11-扩展点Stub.md",
  "12-错误码.md",
  "13-黄金用例与测试.md",
  "14-实现里程碑.md",
  "15-与竞品实现的映射.md",
  "16-待详细设计收口.md",
  "17-修订记录.md",
];

fs.mkdirSync(outDir, { recursive: true });

function sliceChapter(i) {
  const start = chapters[i].start - 1;
  const end = i + 1 < chapters.length ? chapters[i + 1].start - 1 : lines.length;
  return lines.slice(start, end);
}

for (let i = 0; i < chapters.length; i++) {
  let bodyLines = sliceChapter(i);
  if (bodyLines[0]?.startsWith("## ")) {
    bodyLines = bodyLines.slice(1);
    while (bodyLines[0] === "") bodyLines = bodyLines.slice(1);
  }

  // Demote headings one level so chapter H1 owns the file
  bodyLines = bodyLines.map((line) => {
    if (line.startsWith("#####")) return "####" + line.slice(5);
    if (line.startsWith("####")) return "###" + line.slice(4);
    if (line.startsWith("###")) return "##" + line.slice(3);
    return line;
  });

  const num = Number(chapters[i].id);
  const header = [
    `# ${num}. ${originalTitles[i]}`,
    "",
    "> **所属文档：** [《软件详细设计说明》](../嵌入式UI工具_软件详细设计说明.md)  ",
    `> **章节：** §${num}  `,
    "> **版本：** 与主文档同步（见主文档 / §17 修订记录）",
    "",
    "---",
    "",
  ].join("\n");

  const content = header + bodyLines.join("\n").replace(/\n+$/, "") + "\n";
  fs.writeFileSync(path.join(outDir, fileNames[i]), content, "utf8");
  console.log("wrote", fileNames[i], "bodyLines", bodyLines.length);
}

// Front matter: lines 1..46 but drop the locked-decisions table block from becoming duplicated awkwardly.
// Keep full front matter through line 32 (before ### 已锁定决策), then add short note + TOC.
const frontEnd = 32; // 0-based exclusive end at line 33? lines[0] is title. Line 34 is ### 已锁定
// Keep lines 1-33 (index 0-32) which ends at reference materials; then locked decisions stay in index.
const frontMatter = lines.slice(0, 46).join("\n").trimEnd();

const tocRows = chapters
  .map((c, i) => {
    const num = Number(c.id);
    return `| §${num} | [${originalTitles[i]}](./软件详细设计/${fileNames[i]}) |`;
  })
  .join("\n");

const index = `${frontMatter}

---

## 分册目录

本文档已按章拆分。正文位于 [\`docs/软件详细设计/\`](./软件详细设计/)。

| 章节 | 文档 |
|------|------|
${tocRows}

---

*引用约定：外部文档仍可写作 \`嵌入式UI工具_软件详细设计说明.md\` §N；请打开上表对应分册。章节内小节编号（如 §9.7.4）语义保持不变。*
`;

fs.writeFileSync(srcPath, index, "utf8");
console.log("index updated");
