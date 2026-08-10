import { defineStore } from "pinia";
import { computed, ref } from "vue";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

/** FR-021a～d canvas workbench view state (P0). */
export const useCanvasViewStore = defineStore("canvasView", () => {
  const zoom = ref(1);
  /** Pan offset in stage pixels relative to centered device frame. */
  const panX = ref(0);
  const panY = ref(0);
  const showRulers = ref(true);
  const showGrid = ref(true);
  const showPointerCoords = ref(true);
  /** BK 工作台「隐藏事件连线」反转；当前画布可无连线渲染，仍持久化偏好。 */
  const showEventLinks = ref(true);
  /** Alignment guide threshold in px (1–5). */
  const alignSnapPx = ref(2);
  const viewMenuOpen = ref(false);
  const pointer = ref<{ x: number; y: number } | null>(null);

  const zoomPercent = computed(() => Math.round(zoom.value * 100));

  function clampZoom(v: number): number {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(v * 100) / 100));
  }

  function setZoom(v: number) {
    zoom.value = clampZoom(v);
  }

  function zoomIn() {
    setZoom(zoom.value + ZOOM_STEP);
  }

  function zoomOut() {
    setZoom(zoom.value - ZOOM_STEP);
  }

  function setPan(x: number, y: number) {
    panX.value = x;
    panY.value = y;
  }

  function panBy(dx: number, dy: number) {
    panX.value += dx;
    panY.value += dy;
  }

  function resetPan() {
    panX.value = 0;
    panY.value = 0;
  }

  /** Fit screen into viewport; resets pan to center. */
  function fitToWindow(opts: { stageW: number; stageH: number; screenW: number; screenH: number }) {
    const pad = 48;
    const availW = Math.max(80, opts.stageW - pad);
    const availH = Math.max(80, opts.stageH - pad);
    if (opts.screenW <= 0 || opts.screenH <= 0) {
      setZoom(1);
      resetPan();
      return;
    }
    const z = Math.min(availW / opts.screenW, availH / opts.screenH);
    setZoom(z);
    resetPan();
  }

  function setPointer(x: number, y: number) {
    pointer.value = { x: Math.round(x), y: Math.round(y) };
  }

  function clearPointer() {
    pointer.value = null;
  }

  function toggleViewMenu() {
    viewMenuOpen.value = !viewMenuOpen.value;
  }

  function closeViewMenu() {
    viewMenuOpen.value = false;
  }

  return {
    zoom,
    zoomPercent,
    panX,
    panY,
    showRulers,
    showGrid,
    showPointerCoords,
    showEventLinks,
    alignSnapPx,
    viewMenuOpen,
    pointer,
    setZoom,
    zoomIn,
    zoomOut,
    setPan,
    panBy,
    resetPan,
    fitToWindow,
    setPointer,
    clearPointer,
    toggleViewMenu,
    closeViewMenu,
    ZOOM_MIN,
    ZOOM_MAX,
  };
});
