<template>
  <PropGroup>
    <template #title>{{ isScreen ? "屏幕信息" : "位置信息" }}</template>

    <template v-if="isScreen">
      <div class="grid2">
        <label>
          宽
          <input type="number" min="16" :value="displayWidth" @change="onDisplaySize('width', $event)" />
        </label>
        <label>
          高
          <input type="number" min="16" :value="displayHeight" @change="onDisplaySize('height', $event)" />
        </label>
      </div>
    </template>
    <template v-else>
      <div class="layout-row">
        <div class="anchor-grid" role="group" aria-label="容器方位">
          <button
            v-for="cell in anchorCells"
            :key="cell.key"
            type="button"
            class="anchor-cell"
            :class="[`pos-${cell.key}`, { active: cell.col === anchorX && cell.row === anchorY }]"
            :title="`${cell.label}（对齐到父容器）`"
            :aria-label="`${cell.label}，对齐到父容器`"
            :aria-pressed="cell.col === anchorX && cell.row === anchorY"
            @click="onAlignCell(cell.col, cell.row)"
          />
        </div>
        <div class="fields-col">
          <div class="grid4">
            <label>x <input type="number" :value="frame.x" @change="onFrame('x', $event)" /></label>
            <label>y <input type="number" :value="frame.y" @change="onFrame('y', $event)" /></label>
            <label>宽 <input type="number" min="16" :value="frame.w" @change="onFrame('w', $event)" /></label>
            <label>高 <input type="number" min="16" :value="frame.h" @change="onFrame('h', $event)" /></label>
          </div>
          <label class="full">
            旋转 (°)
            <input
              type="number"
              step="1"
              :value="rotation"
              @input="onRotation($event)"
              @change="onRotation($event)"
            />
          </label>
          <label v-if="showLayoutType" class="full">
            布局类型
            <select :value="layoutType" @change="onLayoutType($event)">
              <option value="none">No Layout</option>
              <option value="flex_row">Flex 横向</option>
              <option value="flex_column">Flex 纵向</option>
              <option value="grid">Grid</option>
            </select>
          </label>
          <div v-if="showLayoutType && layoutType === 'grid'" class="grid2">
            <label>
              列数
              <input
                type="number"
                min="1"
                max="8"
                :value="gridColumns"
                @change="onGridTrack('grid_columns', $event)"
              />
            </label>
            <label>
              行数
              <input
                type="number"
                min="1"
                max="8"
                :value="gridRows"
                @change="onGridTrack('grid_rows', $event)"
              />
            </label>
          </div>
        </div>
      </div>
    </template>
  </PropGroup>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { alignFrameToParent, normalizeAnchor } from "@forgeui/core/frame-anchor";
import { normalizeRotation } from "@forgeui/core/types";
import PropGroup from "./PropGroup.vue";

const props = defineProps<{
  isScreen: boolean;
  frame: {
    x: number;
    y: number;
    w: number;
    h: number;
    anchorX?: 0 | 1 | 2;
    anchorY?: 0 | 1 | 2;
    rotation?: number;
  };
  /** Direct parent content size (screen display or parent frame). */
  parentWidth: number;
  parentHeight: number;
  displayWidth: number;
  displayHeight: number;
  showLayoutType?: boolean;
  layoutType?: string;
  gridColumns?: number;
  gridRows?: number;
}>();

const emit = defineEmits<{
  "update:frame": [patch: Record<string, number>];
  "update:display": [patch: { width?: number; height?: number }];
  "update:layout": [layoutType: string];
  "update:grid": [patch: { grid_columns?: number; grid_rows?: number }];
}>();

const anchorCells = [
  { key: "tl", col: 0, row: 0, label: "左上" },
  { key: "tc", col: 1, row: 0, label: "上中" },
  { key: "tr", col: 2, row: 0, label: "右上" },
  { key: "ml", col: 0, row: 1, label: "左中" },
  { key: "mc", col: 1, row: 1, label: "中心" },
  { key: "mr", col: 2, row: 1, label: "右中" },
  { key: "bl", col: 0, row: 2, label: "左下" },
  { key: "bc", col: 1, row: 2, label: "下中" },
  { key: "br", col: 2, row: 2, label: "右下" },
] as const;

const anchorX = computed(() => normalizeAnchor(props.frame).anchorX);
const anchorY = computed(() => normalizeAnchor(props.frame).anchorY);
const rotation = computed(() => props.frame.rotation ?? 0);

function onFrame(key: string, e: Event) {
  emit("update:frame", { [key]: Number((e.target as HTMLInputElement).value) });
}

function onDisplaySize(key: "width" | "height", e: Event) {
  const value = Math.max(16, Number((e.target as HTMLInputElement).value));
  emit("update:display", { [key]: value });
}

function onAlignCell(col: 0 | 1 | 2, row: 0 | 1 | 2) {
  const patch = alignFrameToParent(props.frame, props.parentWidth, props.parentHeight, col, row);
  emit("update:frame", patch as Record<string, number>);
}

function onRotation(e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  // Allow empty / partial typing; spinner and complete values wrap 0–359 (Beken).
  if (raw === "" || raw === "-" || raw === "+") return;
  const n = Number(raw);
  if (!Number.isFinite(n)) return;
  emit("update:frame", { rotation: normalizeRotation(n) });
}

function onLayoutType(e: Event) {
  emit("update:layout", (e.target as HTMLSelectElement).value);
}

function onGridTrack(key: "grid_columns" | "grid_rows", e: Event) {
  const n = Math.min(8, Math.max(1, Math.round(Number((e.target as HTMLInputElement).value) || 2)));
  emit("update:grid", { [key]: n });
}
</script>

<style scoped>
label {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}

input {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
}

.layout-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  min-width: 0;
  width: 100%;
}

.fields-col {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 8px;
}

.grid4 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 8px;
  min-width: 0;
}

.grid4 label {
  min-width: 0;
}

.grid4 input {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  padding: 5px 6px;
}

.anchor-grid {
  display: grid;
  grid-template-columns: repeat(3, 22px);
  grid-template-rows: repeat(3, 22px);
  gap: 4px;
  flex-shrink: 0;
  padding-top: 18px;
}

.anchor-cell {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  cursor: pointer;
  position: relative;
}

/* Indicator sits at the cell's named corner/edge/center (Beken-style). */
.anchor-cell::after {
  content: "";
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 1px;
  background: var(--muted);
  opacity: 0.7;
}

.anchor-cell.pos-tl::after {
  top: 3px;
  left: 3px;
}
.anchor-cell.pos-tc::after {
  top: 3px;
  left: 50%;
  transform: translateX(-50%);
}
.anchor-cell.pos-tr::after {
  top: 3px;
  right: 3px;
}
.anchor-cell.pos-ml::after {
  top: 50%;
  left: 3px;
  transform: translateY(-50%);
}
.anchor-cell.pos-mc::after {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
}
.anchor-cell.pos-mr::after {
  top: 50%;
  right: 3px;
  transform: translateY(-50%);
}
.anchor-cell.pos-bl::after {
  bottom: 3px;
  left: 3px;
}
.anchor-cell.pos-bc::after {
  bottom: 3px;
  left: 50%;
  transform: translateX(-50%);
}
.anchor-cell.pos-br::after {
  bottom: 3px;
  right: 3px;
}

.anchor-cell:hover {
  border-color: color-mix(in srgb, var(--border) 40%, #9aa4b2);
}

.anchor-cell.active {
  border-color: #3d5afe;
  background: rgba(61, 90, 254, 0.15);
}

.anchor-cell.active::after {
  background: #3d5afe;
  opacity: 1;
}

.full {
  grid-column: 1 / -1;
}

select {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
}

.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  min-width: 0;
}

.grid2 label {
  min-width: 0;
}

.grid2 input {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}
</style>
