<template>
  <div v-if="ui.showColorLibrary" class="mask" @click.self="close">
    <div class="dialog" role="dialog" aria-labelledby="color-lib-title">
      <header class="head">
        <h2 id="color-lib-title">颜色库</h2>
        <button type="button" class="icon-x" title="关闭" @click="close">×</button>
      </header>

      <p v-if="picking" class="pick-hint">选择颜色填入样式字段（命名色写入 @id，网格色写入字面量）</p>

      <div class="main-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          :class="{ active: mainTab === 'colors' }"
          @click="mainTab = 'colors'"
        >
          颜色
        </button>
        <button
          type="button"
          role="tab"
          :class="{ active: mainTab === 'themes' }"
          @click="mainTab = 'themes'"
        >
          主题
        </button>
      </div>

      <!-- 颜色主 Tab -->
      <section v-if="mainTab === 'colors'" class="pane">
        <div class="sub-tabs" role="tablist">
          <button
            v-for="t in colorSubTabs"
            :key="t.id"
            type="button"
            role="tab"
            :class="{ active: colorSubTab === t.id }"
            @click="colorSubTab = t.id"
          >
            {{ t.label }}
          </button>
        </div>

        <!-- 我的 -->
        <div v-if="colorSubTab === 'mine'" class="sub-pane">
          <button v-if="!picking && !editingMine" type="button" class="primary wide" @click="startAddMine">
            + 添加颜色
          </button>
          <input
            v-if="!editingMine"
            v-model="mineSearch"
            class="search"
            type="search"
            placeholder="搜索颜色…"
          />
          <div v-if="editingMine" class="editor">
            <span class="swatch lg" :style="{ background: colorSwatch(editValue) }" />
            <input v-model="editName" class="field" placeholder="名称" />
            <input v-model="editValue" class="field" placeholder="#RRGGBBAA" />
            <input type="color" class="native" :value="colorSwatch(editValue)" @input="onNativeColor" />
            <div class="editor-actions">
              <button type="button" class="primary" @click="commitMineEdit">确定</button>
              <button type="button" @click="editingMine = false">取消</button>
            </div>
          </div>
          <ul v-else-if="filteredMine.length" class="list">
            <li v-for="c in filteredMine" :key="c.id" class="row">
              <button v-if="picking" type="button" class="pick-row" @click="pickNamed(c.id)">
                <span class="swatch" :style="{ background: colorSwatch(c.value) }" />
                <span class="name">{{ c.name }}</span>
                <span class="meta">{{ c.value }}</span>
              </button>
              <template v-else>
                <span class="swatch" :style="{ background: colorSwatch(c.value) }" />
                <span class="name">{{ c.name }}</span>
                <span class="meta">{{ c.value }}</span>
                <button type="button" class="link" @click="startEditMine(c)">编辑</button>
                <button type="button" class="danger-sm" @click="removeMine(c.id)">删除</button>
              </template>
            </li>
          </ul>
          <div v-else class="empty">
            <p>暂无颜色，点击「添加颜色」来创建</p>
          </div>
        </div>

        <!-- 最近 -->
        <div v-else-if="colorSubTab === 'recent'" class="sub-pane">
          <div v-if="ui.recentColors.length" class="grid">
            <button
              v-for="hex in ui.recentColors"
              :key="hex"
              type="button"
              class="tile"
              :style="{ background: colorSwatch(hex) }"
              :title="hex"
              @click="onGridHex(hex)"
            />
          </div>
          <p v-else class="empty">暂无最近使用的颜色</p>
        </div>

        <!-- 预设 / LVGL -->
        <div v-else class="sub-pane">
          <div class="grid">
            <button
              v-for="hex in gridColors"
              :key="hex"
              type="button"
              class="tile"
              :style="{ background: colorSwatch(hex) }"
              :title="hex"
              @click="onGridHex(hex)"
            />
          </div>
          <p v-if="!picking" class="hint-line">管理态：点击色块加入「最近」；可再「加入我的颜色库」。</p>
          <button
            v-if="!picking && lastGridHex"
            type="button"
            class="link-btn"
            @click="addHexToMine(lastGridHex)"
          >
            将 {{ lastGridHex }} 加入我的颜色库
          </button>
        </div>
      </section>

      <!-- 主题（色板）主 Tab -->
      <section v-else class="pane">
        <div class="theme-toolbar">
          <button type="button" class="primary" @click="createPaletteTheme">+ 创建主题</button>
          <button type="button" class="outline" @click="triggerImport">↑ 导入主题</button>
          <input ref="importInput" type="file" accept="application/json,.json" class="hidden" @change="onImportFile" />
        </div>

        <p v-if="!paletteThemes.length" class="empty">暂无主题，点击上方按钮创建</p>

        <template v-else>
          <ul class="theme-list">
            <li v-for="t in paletteThemes" :key="t.id">
              <button
                type="button"
                class="theme-name"
                :class="{ active: selectedThemeId === t.id }"
                @click="selectedThemeId = t.id"
              >
                {{ t.name }}
              </button>
            </li>
          </ul>

          <div v-if="selectedTheme" class="theme-detail">
            <div class="theme-ops">
              <button v-if="!picking" type="button" class="primary" @click="startAddThemeColor">+ 添加颜色</button>
              <button v-if="!picking" type="button" class="outline" @click="renameSelectedTheme">✎ 编辑主题</button>
              <button v-if="!picking" type="button" class="outline" @click="exportSelectedTheme">↓ 导出主题</button>
              <button v-if="!picking" type="button" class="danger-sm" @click="deleteSelectedTheme">删除主题</button>
            </div>

            <div v-if="editingThemeColor" class="editor">
              <span class="swatch lg" :style="{ background: colorSwatch(editValue) }" />
              <input v-model="editName" class="field" placeholder="名称" />
              <input v-model="editValue" class="field" placeholder="#RRGGBBAA" />
              <input type="color" class="native" :value="colorSwatch(editValue)" @input="onNativeColor" />
              <div class="editor-actions">
                <button type="button" class="primary" @click="commitThemeColorEdit">确定</button>
                <button type="button" @click="editingThemeColor = false">取消</button>
              </div>
            </div>

            <ul v-else-if="selectedTheme.colors.length" class="list">
              <li v-for="c in selectedTheme.colors" :key="c.id" class="row">
                <button v-if="picking" type="button" class="pick-row" @click="pickNamed(c.id)">
                  <span class="swatch" :style="{ background: colorSwatch(c.value) }" />
                  <span class="name">{{ c.name }}</span>
                  <span class="meta">{{ c.value }}</span>
                </button>
                <template v-else>
                  <span class="swatch" :style="{ background: colorSwatch(c.value) }" />
                  <span class="name">{{ c.name }}</span>
                  <span class="meta">{{ c.value }}</span>
                  <button type="button" class="link" @click="startEditThemeColor(c)">编辑</button>
                  <button type="button" class="danger-sm" @click="removeThemeColor(c.id)">删除</button>
                </template>
              </li>
            </ul>
            <p v-else class="empty">该主题暂无颜色</p>
          </div>
        </template>
      </section>

      <div class="actions">
        <button type="button" class="primary" @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { collectColorIds, slugThemeId, uniqueId } from "@forgeui/core/themes";
import { colorSwatch, toRgbaHex } from "../utils/color";
import { LVGL_COMMON_COLORS, PRESET_COLORS } from "../utils/color-presets";
import { useProjectStore } from "../stores/project";
import { useUiStore } from "../stores/ui";

type Named = { id: string; name: string; value: string };
type PaletteTheme = { id: string; name: string; colors: Named[]; createdAt?: string };

const store = useProjectStore();
const ui = useUiStore();

const mainTab = ref<"colors" | "themes">("colors");
const colorSubTab = ref<"mine" | "recent" | "preset" | "lvgl">("mine");
const colorSubTabs = [
  { id: "mine" as const, label: "我的颜色库" },
  { id: "recent" as const, label: "最近使用" },
  { id: "preset" as const, label: "预设颜色" },
  { id: "lvgl" as const, label: "LVGL 常用" },
];

const mineSearch = ref("");
const editingMine = ref(false);
const editingThemeColor = ref(false);
const editId = ref<string | null>(null);
const editName = ref("");
const editValue = ref("#336699ff");
const lastGridHex = ref<string | null>(null);
const selectedThemeId = ref<string | null>(null);
const importInput = ref<HTMLInputElement | null>(null);

const picking = computed(() => !!ui.colorPickHandler);
const paletteThemes = computed(() => store.colorThemes as PaletteTheme[]);
const selectedTheme = computed(() => paletteThemes.value.find((t) => t.id === selectedThemeId.value) ?? null);

const filteredMine = computed(() => {
  const q = mineSearch.value.trim().toLowerCase();
  const list = store.colorLibrary as Named[];
  if (!q) return list;
  return list.filter((c) => c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
});

const gridColors = computed(() => (colorSubTab.value === "lvgl" ? LVGL_COMMON_COLORS : PRESET_COLORS));

watch(
  () => ui.showColorLibrary,
  (open) => {
    if (!open) return;
    mainTab.value = "colors";
    colorSubTab.value = "mine";
    editingMine.value = false;
    editingThemeColor.value = false;
    mineSearch.value = "";
    lastGridHex.value = null;
    selectedThemeId.value = paletteThemes.value[0]?.id ?? null;
  },
);

watch(paletteThemes, (list) => {
  if (selectedThemeId.value && !list.some((t) => t.id === selectedThemeId.value)) {
    selectedThemeId.value = list[0]?.id ?? null;
  }
});

function usedIds() {
  return collectColorIds(store.colorLibrary as Named[], store.colorThemes as PaletteTheme[]);
}

function onNativeColor(e: Event) {
  const v = (e.target as HTMLInputElement).value;
  editValue.value = toRgbaHex(v);
}

function startAddMine() {
  editId.value = null;
  editName.value = `颜色 ${store.colorLibrary.length + 1}`;
  editValue.value = "#336699ff";
  editingMine.value = true;
}

function startEditMine(c: Named) {
  editId.value = c.id;
  editName.value = c.name;
  editValue.value = c.value;
  editingMine.value = true;
}

async function commitMineEdit() {
  const name = editName.value.trim() || "颜色";
  const value = toRgbaHex(editValue.value);
  const ids = usedIds();
  let id = editId.value;
  if (!id) {
    id = uniqueId(slugThemeId(name) || "color", ids);
  }
  const next = [...(store.colorLibrary as Named[])];
  const idx = next.findIndex((c) => c.id === id);
  const row = { id, name, value };
  if (idx >= 0) next[idx] = row;
  else next.push(row);
  await store.setColorLibrary(next);
  editingMine.value = false;
  ui.pushRecentColor(value);
}

async function removeMine(id: string) {
  if (!window.confirm("确定删除该颜色？")) return;
  await store.setColorLibrary((store.colorLibrary as Named[]).filter((c) => c.id !== id));
}

async function addHexToMine(hex: string) {
  const value = toRgbaHex(hex);
  const ids = usedIds();
  const id = uniqueId(slugThemeId(`color_${value.slice(1, 7)}`) || "color", ids);
  await store.setColorLibrary([...(store.colorLibrary as Named[]), { id, name: id, value }]);
  ui.pushRecentColor(value);
  colorSubTab.value = "mine";
}

function onGridHex(hex: string) {
  const value = toRgbaHex(hex);
  lastGridHex.value = value;
  ui.pushRecentColor(value);
  if (picking.value) {
    ui.pickColorRef(value);
  }
}

function pickNamed(id: string) {
  const hit = store.allNamedColors.find((c) => c.id === id);
  if (hit) ui.pushRecentColor(hit.value);
  ui.pickColorRef(`@${id}`);
}

async function createPaletteTheme() {
  const name = window.prompt("主题名称", `主题 ${paletteThemes.value.length + 1}`);
  if (!name?.trim()) return;
  const ids = new Set(paletteThemes.value.map((t) => t.id));
  const id = uniqueId(slugThemeId(name) || "palette", ids);
  const next: PaletteTheme[] = [
    ...paletteThemes.value,
    { id, name: name.trim(), colors: [], createdAt: new Date().toISOString() },
  ];
  await store.setColorThemes(next);
  selectedThemeId.value = id;
}

async function renameSelectedTheme() {
  const t = selectedTheme.value;
  if (!t) return;
  const name = window.prompt("主题名称", t.name);
  if (!name?.trim()) return;
  const next = paletteThemes.value.map((x) => (x.id === t.id ? { ...x, name: name.trim() } : x));
  await store.setColorThemes(next);
}

async function deleteSelectedTheme() {
  const t = selectedTheme.value;
  if (!t) return;
  if (!window.confirm(`确定删除主题「${t.name}」？`)) return;
  await store.setColorThemes(paletteThemes.value.filter((x) => x.id !== t.id));
}

function exportSelectedTheme() {
  const t = selectedTheme.value;
  if (!t) return;
  const blob = new Blob([JSON.stringify({ name: t.name, colors: t.colors }, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${t.id || "color-theme"}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function triggerImport() {
  importInput.value?.click();
}

async function onImportFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = "";
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text()) as { name?: string; colors?: Named[] };
    const name = String(raw.name ?? file.name.replace(/\.json$/i, "") ?? "导入主题").trim() || "导入主题";
    const themeIds = new Set(paletteThemes.value.map((t) => t.id));
    const colorIds = usedIds();
    const id = uniqueId(slugThemeId(name) || "palette", themeIds);
    const colors: Named[] = [];
    for (const c of raw.colors ?? []) {
      const cid = uniqueId(slugThemeId(c.name || c.id || "color") || "color", colorIds);
      colorIds.add(cid);
      colors.push({ id: cid, name: String(c.name || cid), value: toRgbaHex(String(c.value || "#000000ff")) });
    }
    await store.setColorThemes([
      ...paletteThemes.value,
      { id, name, colors, createdAt: new Date().toISOString() },
    ]);
    selectedThemeId.value = id;
  } catch (err) {
    window.alert(`导入失败：${err instanceof Error ? err.message : String(err)}`);
  }
}

function startAddThemeColor() {
  if (!selectedTheme.value) return;
  editId.value = null;
  editName.value = `颜色 ${(selectedTheme.value.colors.length || 0) + 1}`;
  editValue.value = "#336699ff";
  editingThemeColor.value = true;
}

function startEditThemeColor(c: Named) {
  editId.value = c.id;
  editName.value = c.name;
  editValue.value = c.value;
  editingThemeColor.value = true;
}

async function commitThemeColorEdit() {
  const t = selectedTheme.value;
  if (!t) return;
  const name = editName.value.trim() || "颜色";
  const value = toRgbaHex(editValue.value);
  const ids = usedIds();
  let id = editId.value;
  if (!id) id = uniqueId(slugThemeId(name) || "color", ids);
  const colors = [...t.colors];
  const idx = colors.findIndex((c) => c.id === id);
  const row = { id, name, value };
  if (idx >= 0) colors[idx] = row;
  else colors.push(row);
  const next = paletteThemes.value.map((x) => (x.id === t.id ? { ...x, colors } : x));
  await store.setColorThemes(next);
  editingThemeColor.value = false;
  ui.pushRecentColor(value);
}

async function removeThemeColor(cid: string) {
  const t = selectedTheme.value;
  if (!t) return;
  if (!window.confirm("确定删除该颜色？")) return;
  const next = paletteThemes.value.map((x) =>
    x.id === t.id ? { ...x, colors: x.colors.filter((c) => c.id !== cid) } : x,
  );
  await store.setColorThemes(next);
}

function close() {
  ui.clearColorPick();
  ui.showColorLibrary = false;
}
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
  z-index: 70;
}

.dialog {
  width: min(640px, 94vw);
  max-height: min(80vh, 720px);
  overflow: auto;
  background: var(--panel, #1a2332);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 18px;
  display: grid;
  gap: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.icon-x {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}

.pick-hint {
  margin: 0;
  font-size: 12px;
  color: var(--accent, #60a5fa);
}

.main-tabs,
.sub-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
}

.main-tabs button,
.sub-tabs button {
  border: none;
  background: transparent;
  color: var(--muted);
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  border-radius: 0;
}

.main-tabs button.active,
.sub-tabs button.active {
  color: var(--accent, #3d9cf0);
  border-bottom-color: var(--accent, #3d9cf0);
  font-weight: 600;
}

.pane,
.sub-pane {
  display: grid;
  gap: 10px;
  min-height: 160px;
}

.wide {
  width: 100%;
}

.primary {
  background: var(--accent, #3b82f6);
  border: 1px solid var(--accent, #3b82f6);
  color: #fff;
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
}

.outline {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
}

.search,
.field {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.row {
  display: grid;
  grid-template-columns: 28px 1fr auto auto auto;
  gap: 8px;
  align-items: center;
}

.pick-row {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 28px 1fr auto;
  gap: 8px;
  align-items: center;
  text-align: left;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 8px;
  color: inherit;
  cursor: pointer;
}

.swatch {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid var(--border);
}

.swatch.lg {
  width: 36px;
  height: 36px;
}

.name,
.meta {
  font-size: 12px;
}

.meta {
  color: var(--muted);
}

.empty {
  margin: 24px 0;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
  gap: 8px;
}

.tile {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid var(--border);
  cursor: pointer;
  padding: 0;
}

.editor {
  display: grid;
  grid-template-columns: auto 1fr 1fr auto;
  gap: 8px;
  align-items: center;
}

.editor-actions {
  grid-column: 1 / -1;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.native {
  width: 36px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.link,
.link-btn {
  background: transparent;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}

.danger-sm {
  background: transparent;
  border: 1px solid #e11d48;
  color: #fb7185;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}

.theme-toolbar,
.theme-ops {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.theme-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.theme-name {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--muted);
  padding: 4px 8px;
  cursor: pointer;
  font-size: 13px;
}

.theme-name.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 600;
}

.theme-detail {
  display: grid;
  gap: 10px;
}

.hint-line {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

.hidden {
  display: none;
}

.actions {
  display: flex;
  justify-content: flex-end;
}

.actions .primary {
  min-width: 72px;
}
</style>
