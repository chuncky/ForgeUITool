<template>
  <div class="canvas-root">
    <div class="canvas-toolbar">
      <div class="zoom-group">
        <button type="button" title="缩小" @click="view.zoomOut()">−</button>
        <span class="zoom-label">{{ view.zoomPercent }}%</span>
        <button type="button" title="放大" @click="view.zoomIn()">+</button>
        <button type="button" class="fit" title="适应窗口" @click="onFit">适应</button>
      </div>
      <div class="view-menu-wrap" ref="viewMenuEl">
        <button type="button" class="view-btn" @click="view.toggleViewMenu()">
          视图 ▾
        </button>
        <div v-if="view.viewMenuOpen" class="view-menu" role="menu">
          <label class="view-item">
            <input v-model="view.showRulers" type="checkbox" />
            标尺
          </label>
          <label class="view-item">
            <input v-model="view.showGrid" type="checkbox" />
            网格
          </label>
          <label class="view-item">
            <input v-model="view.showPointerCoords" type="checkbox" />
            指针坐标
          </label>
        </div>
      </div>
      <span
        v-if="view.showPointerCoords"
        class="pointer-coords"
        :class="{ dim: !view.pointer }"
      >
        {{ pointerLabel }}
      </span>
    </div>

    <div
      v-if="store.packPreview?.active && store.packPreviewScreen"
      class="canvas-body pack-mode"
    >
      <div class="pack-bar">
        <span class="badge">UI 包装载预览</span>
        <span class="meta">
          {{ store.packPreview.widgetCount }} 控件 · {{ store.packPreview.screens.length }} 屏 ·
          {{ shortPath(store.packPreview.outDir) }}
        </span>
        <select
          class="screen-pick"
          :value="store.packPreview.viewScreenId"
          @change="onPackScreen"
        >
          <option v-for="s in store.packPreview.screens" :key="s.id" :value="s.id">
            {{ s.name || s.id }}{{ s.id === store.packPreview.entryScreen ? " (entry)" : "" }}
          </option>
        </select>
        <button type="button" class="exit" @click="store.clearPackPreview()">退出预览</button>
      </div>
      <div class="stage" :class="{ grid: view.showGrid }">
        <div class="world" :style="worldStyle">
          <div class="screen pack-screen" :style="packScreenStyle">
            <div class="screen-clip">
              <div
                v-if="packResolvedBg"
                class="screen-bg-img"
                aria-hidden="true"
                :style="packBgImgLayerStyle"
              />
              <WidgetView
                v-for="child in store.packPreviewScreen.children"
                :key="child.id"
                :node="child"
                :editing-disabled="true"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else
      class="canvas-body"
      :class="{ 'with-rulers': view.showRulers }"
    >
      <template v-if="store.currentScreen && store.loaded">
        <div v-if="view.showRulers" class="ruler-corner" aria-hidden="true" />
        <div v-if="view.showRulers" class="ruler ruler-h" aria-hidden="true">
          <canvas ref="rulerHEl" class="ruler-canvas" />
        </div>
        <div v-if="view.showRulers" class="ruler ruler-v" aria-hidden="true">
          <canvas ref="rulerVEl" class="ruler-canvas" />
        </div>
        <div
          ref="stageEl"
          class="stage"
          :class="{ grid: view.showGrid, panning: isPanning }"
          @mousedown="onStageMouseDown"
          @mousemove="onStageMove"
          @mouseleave="onStageLeave"
          @wheel.prevent="onWheelZoom"
        >
          <div class="world" :style="worldStyle">
            <div
              class="screen"
              :class="{ locked: preview.busy }"
              :style="screenStyle"
              @click="onCanvasClick"
              @dragover.prevent="onDragOver"
              @drop.prevent="onDrop"
            >
              <div class="screen-clip">
                <div
                  v-if="screenResolvedBg"
                  class="screen-bg-img"
                  aria-hidden="true"
                  :style="screenBgImgLayerStyle"
                />
                <WidgetView
                  v-for="child in store.currentScreen.children"
                  :key="child.id"
                  :node="child"
                  :editing-disabled="preview.busy"
                />
              </div>
            </div>
          </div>
          <div v-if="preview.busy" class="busy-overlay" aria-live="polite">
            <span>{{ preview.phase || "处理中…" }}</span>
            <small>预览编译在后台进行，画布暂不可编辑</small>
          </div>
        </div>
      </template>
      <div v-else class="empty">打开工程后在此编辑</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useProjectStore } from "../stores/project";
import { usePreviewStore } from "../stores/preview";
import { useCanvasViewStore } from "../stores/canvasView";
import WidgetView from "./WidgetView.vue";
import { resolveProjectAssetDataUrl } from "../utils/asset-url";
import { buildFillBackground } from "../utils/canvas-chrome";
import { opacityToCss01 } from "@forgeui/core/opacity";

const store = useProjectStore();
const preview = usePreviewStore();
const view = useCanvasViewStore();

const stageEl = ref<HTMLElement | null>(null);
const rulerHEl = ref<HTMLCanvasElement | null>(null);
const rulerVEl = ref<HTMLCanvasElement | null>(null);
const viewMenuEl = ref<HTMLElement | null>(null);
const isPanning = ref(false);
const skipNextClick = ref(false);
const screenResolvedBg = ref<string | null>(null);
const packResolvedBg = ref<string | null>(null);

const RULER = 22;
const PAN_THRESHOLD = 3;

type PanSession = {
  startX: number;
  startY: number;
  originPanX: number;
  originPanY: number;
  moved: boolean;
};
let panSession: PanSession | null = null;

const displaySize = computed(() => {
  const d = store.loaded?.project.display;
  return { w: d?.width ?? 480, h: d?.height ?? 320 };
});

type ScreenStyleMain = {
  bg_color?: string;
  bg_grad_dir?: string;
  bg_grad_color?: string;
  bg_image?: string;
  bg_img_opacity?: number;
  bg_opacity?: number;
};

function screenMainDefault(style: unknown): ScreenStyleMain {
  const s = style as { main?: { default?: ScreenStyleMain } } | undefined;
  return s?.main?.default ?? {};
}

function screenFillStyle(def: ScreenStyleMain, hasBgImage: boolean) {
  const { fill, isGradient } = buildFillBackground(def as Record<string, unknown>, {
    colorFallback: "var(--screen)",
  });
  // With bg image layer: keep gradient on `background`; solid prefers backgroundColor
  // so it cannot fight the image layer shorthand.
  if (hasBgImage && !isGradient) {
    return { backgroundColor: fill, background: undefined as string | undefined };
  }
  return { background: fill, backgroundColor: undefined as string | undefined };
}

const screenStyle = computed(() => {
  const d = displaySize.value;
  const def = screenMainDefault(store.currentScreen?.style);
  const fill = screenFillStyle(def, Boolean(screenResolvedBg.value));
  return {
    width: `${d.w}px`,
    height: `${d.h}px`,
    ...fill,
  };
});

const packScreenStyle = computed(() => {
  const d = store.loaded?.project.display;
  const doc = store.packPreviewScreen;
  const def = screenMainDefault(doc?.style);
  const frame = doc?.frame;
  const fill = screenFillStyle(def, Boolean(packResolvedBg.value));
  return {
    width: `${frame?.w ?? d?.width ?? 480}px`,
    height: `${frame?.h ?? d?.height ?? 320}px`,
    ...fill,
  };
});

const screenBgImgLayerStyle = computed(() => {
  if (!screenResolvedBg.value) return {};
  const def = screenMainDefault(store.currentScreen?.style);
  const opa = opacityToCss01(def.bg_img_opacity) ?? 1;
  return {
    position: "absolute" as const,
    inset: "0",
    zIndex: 0,
    pointerEvents: "none" as const,
    backgroundImage: `url("${screenResolvedBg.value}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    opacity: opa,
  };
});

const packBgImgLayerStyle = computed(() => {
  if (!packResolvedBg.value) return {};
  const def = screenMainDefault(store.packPreviewScreen?.style);
  const opa = opacityToCss01(def.bg_img_opacity) ?? 1;
  return {
    position: "absolute" as const,
    inset: "0",
    zIndex: 0,
    pointerEvents: "none" as const,
    backgroundImage: `url("${packResolvedBg.value}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    opacity: opa,
  };
});

watch(
  () => String(screenMainDefault(store.currentScreen?.style).bg_image ?? ""),
  async (bg) => {
    if (!bg) {
      screenResolvedBg.value = null;
      return;
    }
    const url = await resolveProjectAssetDataUrl(bg);
    if (!url) console.warn("[forgeui] screen bg_image failed to resolve:", bg);
    screenResolvedBg.value = url;
  },
  { immediate: true },
);

watch(
  () => String(screenMainDefault(store.packPreviewScreen?.style).bg_image ?? ""),
  async (bg) => {
    if (!bg) {
      packResolvedBg.value = null;
      return;
    }
    const url = await resolveProjectAssetDataUrl(bg);
    if (!url) console.warn("[forgeui] pack screen bg_image failed to resolve:", bg);
    packResolvedBg.value = url;
  },
  { immediate: true },
);
/** Centered device frame + pan + zoom (no scrollbars). */
const worldStyle = computed(() => {
  const { w, h } = displaySize.value;
  return {
    width: `${w}px`,
    height: `${h}px`,
    transform: `translate(-50%, -50%) translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
  };
});

const pointerLabel = computed(() => {
  const p = view.pointer;
  if (!p) return "[—, —]";
  return `[${p.x}, ${p.y}]`;
});

function shortPath(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/");
  return parts.slice(-2).join("/") || p;
}

function onPackScreen(e: Event) {
  store.setPackPreviewScreen((e.target as HTMLSelectElement).value);
}

function onCanvasClick() {
  if (preview.busy || skipNextClick.value) {
    skipNextClick.value = false;
    return;
  }
  store.select(store.screenId);
}

function onDragOver(e: DragEvent) {
  if (preview.busy) return;
  if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
}

function screenLocalFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
  const screen =
    (stageEl.value?.querySelector(".screen-clip") as HTMLElement | null) ??
    (stageEl.value?.querySelector(".screen") as HTMLElement | null);
  if (!screen) return null;
  const rect = screen.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const { w, h } = displaySize.value;
  return {
    x: ((clientX - rect.left) / rect.width) * w,
    y: ((clientY - rect.top) / rect.height) * h,
  };
}

function onDrop(e: DragEvent) {
  if (preview.busy) return;
  const local = screenLocalFromClient(e.clientX, e.clientY);
  if (!local) return;
  const customId = e.dataTransfer?.getData("application/x-forgeui-custom-widget");
  if (customId) {
    store.addCustomWidget(customId, { x: local.x, y: local.y });
    return;
  }
  const type = e.dataTransfer?.getData("application/x-forgeui-widget");
  if (!type) return;
  store.addWidgetAt(type, { x: local.x, y: local.y });
}

function onStageMove(e: MouseEvent) {
  if (!view.showPointerCoords) return;
  const local = screenLocalFromClient(e.clientX, e.clientY);
  if (!local) {
    view.clearPointer();
    return;
  }
  view.setPointer(local.x, local.y);
}

function onStageLeave() {
  view.clearPointer();
}

function onWheelZoom(e: WheelEvent) {
  if (e.deltaY < 0) view.zoomIn();
  else view.zoomOut();
  scheduleRulers();
}

function onFit() {
  const el = stageEl.value;
  if (!el) {
    view.setZoom(1);
    view.resetPan();
    return;
  }
  view.fitToWindow({
    stageW: el.clientWidth,
    stageH: el.clientHeight,
    screenW: displaySize.value.w,
    screenH: displaySize.value.h,
  });
  scheduleRulers();
}

function onStageMouseDown(e: MouseEvent) {
  if (preview.busy || e.button !== 0) return;
  const t = e.target as HTMLElement | null;
  if (t?.closest(".widget") || t?.closest(".handle")) return;

  panSession = {
    startX: e.clientX,
    startY: e.clientY,
    originPanX: view.panX,
    originPanY: view.panY,
    moved: false,
  };
  window.addEventListener("mousemove", onPanMove);
  window.addEventListener("mouseup", onPanUp);
}

function onPanMove(e: MouseEvent) {
  if (!panSession) return;
  const dx = e.clientX - panSession.startX;
  const dy = e.clientY - panSession.startY;
  if (!panSession.moved && Math.hypot(dx, dy) < PAN_THRESHOLD) return;
  panSession.moved = true;
  isPanning.value = true;
  view.setPan(panSession.originPanX + dx, panSession.originPanY + dy);
  scheduleRulers();
}

function onPanUp() {
  if (panSession?.moved) skipNextClick.value = true;
  panSession = null;
  isPanning.value = false;
  window.removeEventListener("mousemove", onPanMove);
  window.removeEventListener("mouseup", onPanUp);
}

function drawRulers() {
  const z = view.zoom;
  const sw = displaySize.value.w;
  const sh = displaySize.value.h;
  const stage = stageEl.value;
  if (!stage || !view.showRulers) return;

  const hCanvas = rulerHEl.value;
  const vCanvas = rulerVEl.value;
  if (!hCanvas || !vCanvas) return;

  const screen = stage.querySelector(".screen") as HTMLElement | null;
  if (!screen) return;

  const stageRect = stage.getBoundingClientRect();
  const screenRect = screen.getBoundingClientRect();
  const screenLeft = screenRect.left - stageRect.left;
  const screenTop = screenRect.top - stageRect.top;

  const hW = stage.clientWidth;
  const vH = stage.clientHeight;
  const dpr = window.devicePixelRatio || 1;

  hCanvas.width = Math.max(1, Math.floor(hW * dpr));
  hCanvas.height = Math.floor(RULER * dpr);
  hCanvas.style.width = `${hW}px`;
  hCanvas.style.height = `${RULER}px`;
  vCanvas.width = Math.floor(RULER * dpr);
  vCanvas.height = Math.max(1, Math.floor(vH * dpr));
  vCanvas.style.width = `${RULER}px`;
  vCanvas.style.height = `${vH}px`;

  const hc = hCanvas.getContext("2d");
  const vc = vCanvas.getContext("2d");
  if (!hc || !vc) return;
  hc.setTransform(dpr, 0, 0, dpr, 0, 0);
  vc.setTransform(dpr, 0, 0, dpr, 0, 0);

  hc.fillStyle = "#151c24";
  hc.fillRect(0, 0, hW, RULER);
  vc.fillStyle = "#151c24";
  vc.fillRect(0, 0, RULER, vH);

  hc.fillStyle = "rgba(61, 156, 240, 0.28)";
  hc.fillRect(screenLeft, 0, sw * z, RULER);
  vc.fillStyle = "rgba(61, 156, 240, 0.28)";
  vc.fillRect(0, screenTop, RULER, sh * z);

  const major = z >= 1.2 ? 50 : z >= 0.7 ? 100 : 200;
  const minor = major / 5;

  hc.strokeStyle = "#5a6d82";
  hc.fillStyle = "#8aa0b6";
  hc.font = "10px Segoe UI, sans-serif";
  hc.textAlign = "center";
  hc.textBaseline = "top";

  const startX = Math.floor(-screenLeft / z / minor) * minor;
  const endX = Math.ceil((hW - screenLeft) / z / minor) * minor;
  for (let px = startX; px <= endX; px += minor) {
    const sx = screenLeft + px * z;
    if (sx < -2 || sx > hW + 2) continue;
    const isMajor = Math.abs(px % major) < 0.001 || Math.abs(px) < 0.001;
    hc.beginPath();
    hc.moveTo(sx + 0.5, isMajor ? 8 : 14);
    hc.lineTo(sx + 0.5, RULER);
    hc.stroke();
    if (isMajor && px >= 0 && px <= sw) {
      hc.fillText(String(px), sx, 2);
    }
  }
  hc.fillStyle = "#3d9cf0";
  hc.fillText(String(sw), screenLeft + (sw * z) / 2, 2);

  vc.strokeStyle = "#5a6d82";
  vc.fillStyle = "#8aa0b6";
  vc.font = "10px Segoe UI, sans-serif";
  vc.textAlign = "center";
  vc.textBaseline = "middle";

  const startY = Math.floor(-screenTop / z / minor) * minor;
  const endY = Math.ceil((vH - screenTop) / z / minor) * minor;
  for (let py = startY; py <= endY; py += minor) {
    const sy = screenTop + py * z;
    if (sy < -2 || sy > vH + 2) continue;
    const isMajor = Math.abs(py % major) < 0.001 || Math.abs(py) < 0.001;
    vc.beginPath();
    vc.moveTo(isMajor ? 8 : 14, sy + 0.5);
    vc.lineTo(RULER, sy + 0.5);
    vc.stroke();
    if (isMajor && py >= 0 && py <= sh) {
      vc.save();
      vc.translate(10, sy);
      vc.rotate(-Math.PI / 2);
      vc.fillText(String(py), 0, 0);
      vc.restore();
    }
  }
  vc.fillStyle = "#3d9cf0";
  vc.save();
  vc.translate(10, screenTop + (sh * z) / 2);
  vc.rotate(-Math.PI / 2);
  vc.fillText(String(sh), 0, 0);
  vc.restore();
}

function scheduleRulers() {
  void nextTick(() => {
    requestAnimationFrame(() => drawRulers());
  });
}

function onDocClick(e: MouseEvent) {
  if (!view.viewMenuOpen) return;
  const root = viewMenuEl.value;
  if (root && !root.contains(e.target as Node)) view.closeViewMenu();
}

let ro: ResizeObserver | null = null;

onMounted(() => {
  document.addEventListener("click", onDocClick);
  scheduleRulers();
  ro = new ResizeObserver(() => scheduleRulers());
  if (stageEl.value) ro.observe(stageEl.value);
});

onUnmounted(() => {
  document.removeEventListener("click", onDocClick);
  window.removeEventListener("mousemove", onPanMove);
  window.removeEventListener("mouseup", onPanUp);
  ro?.disconnect();
});

watch(
  () => [
    view.zoom,
    view.panX,
    view.panY,
    view.showRulers,
    view.showGrid,
    displaySize.value.w,
    displaySize.value.h,
    store.screenId,
  ],
  () => scheduleRulers(),
);

watch(stageEl, (el) => {
  ro?.disconnect();
  if (el) {
    ro = new ResizeObserver(() => scheduleRulers());
    ro.observe(el);
    scheduleRulers();
  }
});
</script>

<style scoped>
.canvas-root {
  position: relative;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--canvas-bg);
}

.canvas-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 10px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
  font-size: 12px;
  flex-shrink: 0;
  z-index: 2;
}

.zoom-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.zoom-group button {
  padding: 2px 8px;
  min-width: 28px;
  line-height: 1.4;
}

.zoom-label {
  min-width: 44px;
  text-align: center;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.fit {
  margin-left: 4px;
}

.view-menu-wrap {
  position: relative;
}

.view-btn {
  padding: 2px 10px;
}

.view-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 140px;
  padding: 6px 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel-2);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  z-index: 20;
}

.view-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  user-select: none;
}

.view-item:hover {
  background: rgba(61, 156, 240, 0.12);
}

.pointer-coords {
  margin-left: auto;
  font-family: Consolas, "Courier New", monospace;
  font-variant-numeric: tabular-nums;
  color: #7ddea5;
}

.pointer-coords.dim {
  color: var(--muted);
}

.canvas-body {
  flex: 1;
  min-height: 0;
  display: grid;
  position: relative;
}

.canvas-body.with-rulers {
  grid-template-columns: 22px 1fr;
  grid-template-rows: 22px 1fr;
}

.ruler-corner {
  grid-column: 1;
  grid-row: 1;
  background: #151c24;
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.ruler-h {
  grid-column: 2;
  grid-row: 1;
  overflow: hidden;
  border-bottom: 1px solid var(--border);
  background: #151c24;
}

.ruler-v {
  grid-column: 1;
  grid-row: 2;
  overflow: hidden;
  border-right: 1px solid var(--border);
  background: #151c24;
}

.ruler-canvas {
  display: block;
}

.stage {
  grid-column: 2;
  grid-row: 2;
  position: relative;
  overflow: hidden;
  min-height: 0;
  background: var(--canvas-bg);
  cursor: grab;
  user-select: none;
}

.stage.panning {
  cursor: grabbing;
}

.canvas-body:not(.with-rulers) .stage {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
}

.stage.grid {
  background-color: var(--canvas-bg);
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 16px 16px;
  background-position: center center;
}

.world {
  position: absolute;
  left: 50%;
  top: 50%;
  transform-origin: center center;
}

.screen {
  position: relative;
  width: 100%;
  height: 100%;
  border: 1px solid #4a5d72;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.35),
    0 16px 48px rgba(0, 0, 0, 0.45);
  overflow: visible;
  cursor: default;
}

/* BK canvas-content-inner: clip widgets to device logical size (LVGL screen). */
.screen-clip {
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: 0;
}

.screen-bg-img {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

/* Do NOT set position:relative on widgets — must stay absolute so left/top == frame.x/y (sim). */

.pack-mode {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.pack-mode .stage {
  flex: 1;
  grid-column: auto;
  grid-row: auto;
}

.pack-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid #3a6b4a;
  background: #1a2e24;
  color: #d8efe0;
  font-size: 12px;
  flex-shrink: 0;
}

.badge {
  font-weight: 600;
  color: #7ddea5;
  letter-spacing: 0.02em;
}

.meta {
  opacity: 0.8;
}

.screen-pick {
  background: #121a16;
  color: inherit;
  border: 1px solid #3a6b4a;
  border-radius: 6px;
  padding: 4px 8px;
}

.exit {
  margin-left: auto;
  background: #2d4a38;
  border: 1px solid #4a7a5c;
  color: inherit;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
}

.pack-screen {
  border-color: #3fa66b;
  box-shadow: 0 12px 40px rgba(40, 120, 70, 0.28);
  pointer-events: none;
}

.screen.locked {
  pointer-events: none;
  opacity: 0.72;
}

.busy-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 6px;
  pointer-events: none;
  color: var(--text);
  font-size: 14px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  background: rgba(11, 16, 21, 0.35);
}

.busy-overlay small {
  color: var(--muted);
  font-size: 12px;
}

.empty {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
  display: grid;
  place-items: center;
  color: var(--muted);
}
</style>
