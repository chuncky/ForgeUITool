<template>
  <div
    v-if="!node.hidden"
    class="widget"
    :class="{
      on: store.isSelected(node.id),
      locked: node.locked,
      interacting: interacting,
      [node.type]: true,
    }"
    :style="shellStyle"
    @click.stop="onSelect"
    @mousedown.stop="onDragStart"
    @contextmenu.prevent.stop="onContextMenu"
  >
    <div class="widget-body" :class="node.type" :style="paintBodyStyle">
      <div
        v-if="resolvedBg"
        class="widget-bg-img"
        aria-hidden="true"
        :style="bgImgLayerStyle"
      />
      <template v-if="node.type === 'tabview' && tabviewChrome">
        <div class="tab-bar" :style="tabviewChrome.barStyle">
          <button
            v-for="(name, i) in tabviewChrome.tabs"
            :key="`${i}-${name}`"
            type="button"
            class="tab-item"
            :class="{ on: i === tabviewChrome.selectedIndex }"
            :style="tabviewChrome.itemStyle(i === tabviewChrome.selectedIndex)"
            :disabled="editingDisabled"
            @click.stop="onSelectTab(i)"
          >{{ name }}</button>
        </div>
        <div class="tab-content" :style="tabviewChrome.contentStyle">
          <WidgetView
            v-for="c in visibleTabChildren"
            :key="c.id"
            :node="c"
            :editing-disabled="editingDisabled"
          />
        </div>
      </template>
      <template v-else-if="node.type === 'label'">
        <span
          v-if="textScrollKind"
          class="caption-scroll"
          :class="textScrollKind === 'circular' ? 'is-circular' : 'is-scroll'"
        >
          <span class="caption-scroll-track">
            <span class="caption-scroll-chunk">{{ displayText }}</span>
            <span v-if="textScrollKind === 'circular'" class="caption-scroll-chunk" aria-hidden="true">{{
              displayText
            }}</span>
          </span>
        </span>
        <span v-else class="label-caption" :style="labelCaptionStyle">{{ displayText }}</span>
      </template>
      <template v-else-if="node.type === 'button'">
        <span
          v-if="textScrollKind"
          class="caption-scroll"
          :class="textScrollKind === 'circular' ? 'is-circular' : 'is-scroll'"
        >
          <span class="caption-scroll-track">
            <span class="caption-scroll-chunk">{{ displayText || "Button" }}</span>
            <span v-if="textScrollKind === 'circular'" class="caption-scroll-chunk" aria-hidden="true">{{
              displayText || "Button"
            }}</span>
          </span>
        </span>
        <span v-else class="btn-label" :style="btnLabelStyle">{{ displayText || "Button" }}</span>
      </template>
      <template v-else-if="node.type === 'image'">
        <img v-if="resolvedSrc" class="img-src" :src="resolvedSrc" alt="" draggable="false" />
        <span v-else class="img-placeholder">IMG</span>
      </template>
      <template v-else>{{ node.type }}</template>
      <WidgetView
        v-if="node.type !== 'tabview'"
        v-for="c in node.children"
        :key="c.id"
        :node="c"
        :editing-disabled="editingDisabled"
      />
    </div>
    <template v-if="store.selectedId === node.id && !node.locked">
      <div class="selection-border" aria-hidden="true" />
      <div
        v-for="dir in resizeHandleDirs"
        :key="dir"
        class="handle"
        :class="`handle-${dir}`"
        :style="{ cursor: resizeHandleCursor(dir) }"
        @mousedown.stop="onResizeStart(dir, $event)"
      />
      <div class="rotate-stem" aria-hidden="true" />
      <div
        class="handle handle-rotate"
        title="旋转"
        @mousedown.stop="onRotateStart($event)"
      >
        <svg
          class="rotate-handle-icon"
          viewBox="0 0 16 16"
          width="12"
          height="12"
          aria-hidden="true"
          focusable="false"
        >
          <!-- Curved refresh/rotate arrow (BK-style affordance) -->
          <path
            d="M13.2 8A5.2 5.2 0 1 1 8 2.8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
          <path d="M8 1.2 L10.4 3.4 L7.4 4.2 Z" fill="currentColor" />
        </svg>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { UiNode } from "../env";
import { useProjectStore } from "../stores/project";
import { useUiStore } from "../stores/ui";
import { useCanvasViewStore } from "../stores/canvasView";
import { nodeDisplayText } from "../utils/i18n-display";
import {
  bodyStyleWithoutBgImage,
  buildBgImageLayerStyle,
  buildWidgetCanvasChrome,
  splitCanvasChrome,
} from "../utils/canvas-chrome";
import {
  ensureCanvasFontFace,
  fontPathForId,
  resolveProjectAssetDataUrl,
} from "../utils/asset-url";
import { opacityToCss01 } from "@forgeui/core/opacity";
import { resolveCanvasStyleProps } from "../utils/style";
import {
  buttonCaptionOverflowCss,
  textLongModeOverflowCss,
  textLongModeScrollKind,
} from "../utils/button-prop-display-contract";
import { buildTabviewChrome, isTabviewChildVisible } from "../utils/tabview-chrome";
import {
  RESIZE_HANDLE_DIRS,
  applyResizeDelta,
  resizeHandleCursor,
  type ResizeHandleDir,
} from "../utils/resize-handles";
import { angleDegFromCenter, applyRotationDrag, normalizeRotationDeg } from "../utils/rotate-handle";
import { clampFrameToParent } from "../utils/frame-clamp";
import { findParentNode } from "../stores/project";

const props = defineProps<{ node: UiNode; editingDisabled?: boolean }>();
const store = useProjectStore();
const ui = useUiStore();
const canvasView = useCanvasViewStore();

function parentContentSize(): { w: number; h: number } {
  const screen = store.currentScreen;
  if (!screen) {
    return {
      w: store.loaded?.project.display.width ?? 480,
      h: store.loaded?.project.display.height ?? 320,
    };
  }
  const parent = findParentNode(screen, props.node.id);
  if (!parent || parent.id === screen.id) {
    return {
      w: screen.frame?.w ?? store.loaded?.project.display.width ?? 480,
      h: screen.frame?.h ?? store.loaded?.project.display.height ?? 320,
    };
  }
  return { w: parent.frame.w, h: parent.frame.h };
}

const resizeHandleDirs = RESIZE_HANDLE_DIRS;

const displayText = computed(() =>
  nodeDisplayText(props.node.props as Record<string, unknown>, store.i18nConfig),
);

const longMode = computed(
  () => (props.node.props as Record<string, unknown> | undefined)?.long_mode,
);

const textScrollKind = computed(() => textLongModeScrollKind(longMode.value));

const btnLabelStyle = computed(() => buttonCaptionOverflowCss(longMode.value));

const labelCaptionStyle = computed(() => {
  const overflow = textLongModeOverflowCss(longMode.value);
  return {
    ...overflow,
    display: "block",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box" as const,
  };
});

const live = ref<{ x: number; y: number; w: number; h: number; rotation?: number } | null>(null);
const interacting = ref(false);
const resolvedBg = ref<string | null>(null);
const resolvedFontFamily = ref<string | null>(null);
const resolvedSrc = ref<string | null>(null);

const styleProps = computed(() => {
  const previewState = String(
    (props.node.props as Record<string, unknown> | undefined)?.preview_state ?? "default",
  );
  return resolveCanvasStyleProps(props.node.style as Record<string, unknown>, previewState);
});

const liveFrame = computed(() => live.value ?? props.node.frame);

const tabviewChrome = computed(() => {
  if (props.node.type !== "tabview") return null;
  return buildTabviewChrome({
    frame: liveFrame.value,
    props: props.node.props as Record<string, unknown>,
    style: props.node.style as Record<string, unknown>,
    extraData: (props.node.extraData as Record<string, unknown> | undefined) ?? null,
    resolvedBgImage: resolvedBg.value,
    resolvedFontFamily: resolvedFontFamily.value,
  });
});

/** BK: only children for selectedTabIndex (via layout/props.tabIndex) paint in the content area. */
const visibleTabChildren = computed(() => {
  if (props.node.type !== "tabview" || !tabviewChrome.value) return [];
  const idx = tabviewChrome.value.selectedIndex;
  return props.node.children.filter((c) =>
    isTabviewChildVisible(
      {
        props: c.props as Record<string, unknown>,
        layout: (c as UiNode & { layout?: Record<string, unknown> }).layout,
        hidden: c.hidden,
      },
      idx,
    ),
  );
});

async function onSelectTab(index: number) {
  if (props.editingDisabled || props.node.type !== "tabview") return;
  const extra = (props.node.extraData as Record<string, unknown> | undefined) ?? {};
  if (Number(extra.selectedTabIndex ?? 0) === index) return;
  // Select the tabview first so patchSelected targets it.
  store.select(props.node.id);
  await store.patchSelected({
    extraData: {
      ...extra,
      selectedTabIndex: index,
    },
  });
}

watch(
  () => ({
    bg: String(styleProps.value.bg_image ?? ""),
    font: String(styleProps.value.text_font ?? ""),
    src: String((props.node.props as Record<string, unknown> | undefined)?.src ?? ""),
    type: props.node.type,
    fonts: store.fontAssets,
  }),
  async ({ bg, font, src, type, fonts }) => {
    if (bg) {
      const url = await resolveProjectAssetDataUrl(bg);
      if (!url) console.warn("[forgeui] bg_image failed to resolve:", bg);
      resolvedBg.value = url;
    } else {
      resolvedBg.value = null;
    }

    if (font) {
      const path = fontPathForId(font, fonts) ?? (font.includes("/") ? font : "");
      if (path) {
        const dataUrl = await resolveProjectAssetDataUrl(path);
        resolvedFontFamily.value = dataUrl ? ensureCanvasFontFace(font, dataUrl) : null;
      } else {
        resolvedFontFamily.value = null;
      }
    } else {
      resolvedFontFamily.value = null;
    }

    if (type === "image" && src) {
      resolvedSrc.value = await resolveProjectAssetDataUrl(src);
    } else {
      resolvedSrc.value = null;
    }
  },
  { immediate: true },
);

const chromeParts = computed(() => {
  if (props.node.type === "tabview" && tabviewChrome.value) {
    return splitCanvasChrome({ ...tabviewChrome.value.rootStyle });
  }
  const chrome = buildWidgetCanvasChrome({
    type: props.node.type,
    frame: props.node.frame,
    props: props.node.props as Record<string, unknown>,
    style: props.node.style as Record<string, unknown>,
    liveFrame: live.value,
    animPreview: ui.animPreview[props.node.id] ?? null,
    resolvedBgImage: resolvedBg.value,
    resolvedFontFamily: resolvedFontFamily.value,
  });
  return splitCanvasChrome(chrome);
});

const shellStyle = computed(() => chromeParts.value.shell);
const bodyStyle = computed(() => chromeParts.value.body);

const paintBodyStyle = computed(() => {
  const body = bodyStyleWithoutBgImage(bodyStyle.value);
  if (resolvedBg.value && body.background && !String(body.background).includes("gradient")) {
    body.backgroundColor = body.backgroundColor ?? body.background;
    delete body.background;
  }
  return body;
});

const bgImgLayerStyle = computed(() => {
  if (!resolvedBg.value) return {};
  const opaRaw = bodyStyle.value["--forge-bg-img-opa"];
  const opa =
    typeof opaRaw === "number"
      ? opaRaw
      : opacityToCss01(styleProps.value.bg_img_opacity) ?? 1;
  return buildBgImageLayerStyle(resolvedBg.value, opa, bodyStyle.value.borderRadius);
});

const editingDisabled = computed(() => props.editingDisabled ?? false);

function onSelect(e: MouseEvent) {
  if (editingDisabled.value) return;
  store.select(props.node.id, { additive: e.ctrlKey || e.metaKey });
}

function onContextMenu(e: MouseEvent) {
  if (editingDisabled.value) return;
  void store.select(props.node.id);
  ui.openWidgetContextMenu(props.node.id, e.clientX, e.clientY);
}

function onDragStart(e: MouseEvent) {
  if (editingDisabled.value || props.node.locked) return;
  if (e.button !== 0) return;
  store.select(props.node.id);
  interacting.value = true;
  const startX = e.clientX;
  const startY = e.clientY;
  const ox = props.node.frame.x;
  const oy = props.node.frame.y;
  live.value = { ...props.node.frame };

  const onMove = (ev: MouseEvent) => {
    const z = canvasView.zoom || 1;
    const box = parentContentSize();
    const next = {
      ...live.value!,
      x: Math.round(ox + (ev.clientX - startX) / z),
      y: Math.round(oy + (ev.clientY - startY) / z),
    };
    const clamped = clampFrameToParent(next, box.w, box.h);
    live.value = { ...live.value!, x: clamped.x, y: clamped.y };
  };
  const onUp = async () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    interacting.value = false;
    if (!live.value) return;
    const frame = { ...live.value };
    live.value = null;
    if (frame.x === ox && frame.y === oy) return;
    await store.patchSelected({ frame });
    await store.alignSelected({ recordHistory: false });
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

function onResizeStart(dir: ResizeHandleDir, e: MouseEvent) {
  if (editingDisabled.value || props.node.locked) return;
  if (e.button !== 0) return;
  interacting.value = true;
  const startX = e.clientX;
  const startY = e.clientY;
  const startFrame = {
    x: props.node.frame.x,
    y: props.node.frame.y,
    w: props.node.frame.w,
    h: props.node.frame.h,
  };
  const startRotation = props.node.frame.rotation;
  live.value = { ...startFrame, rotation: startRotation };

  const onMove = (ev: MouseEvent) => {
    const z = canvasView.zoom || 1;
    const dx = (ev.clientX - startX) / z;
    const dy = (ev.clientY - startY) / z;
    const box = parentContentSize();
    const resized = applyResizeDelta(startFrame, dir, dx, dy);
    const clamped = clampFrameToParent(resized, box.w, box.h);
    live.value = { ...clamped, rotation: startRotation };
  };
  const onUp = async () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    interacting.value = false;
    if (!live.value) return;
    const frame = { ...live.value };
    live.value = null;
    if (
      frame.x === startFrame.x &&
      frame.y === startFrame.y &&
      frame.w === startFrame.w &&
      frame.h === startFrame.h
    ) {
      return;
    }
    await store.patchSelected({ frame: { x: frame.x, y: frame.y, w: frame.w, h: frame.h } });
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

/** BK-style: drag circular handle above top edge; pivot = geometric center. */
function onRotateStart(e: MouseEvent) {
  if (editingDisabled.value || props.node.locked) return;
  if (e.button !== 0) return;
  const host = (e.currentTarget as HTMLElement | null)?.parentElement;
  if (!host) return;
  interacting.value = true;
  const rect = host.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const startRotation = normalizeRotationDeg(props.node.frame.rotation ?? 0);
  const startPointerAngle = angleDegFromCenter(cx, cy, e.clientX, e.clientY);
  live.value = { ...props.node.frame, rotation: startRotation };

  const onMove = (ev: MouseEvent) => {
    const ang = angleDegFromCenter(cx, cy, ev.clientX, ev.clientY);
    live.value = {
      ...live.value!,
      rotation: applyRotationDrag(startRotation, startPointerAngle, ang),
    };
  };
  const onUp = async () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    interacting.value = false;
    if (!live.value) return;
    const rotation = normalizeRotationDeg(live.value.rotation ?? 0);
    live.value = null;
    if (rotation === startRotation) return;
    await store.patchSelected({ frame: { rotation } });
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}
</script>

<style scoped>
.widget {
  position: absolute;
  overflow: visible;
  border: 1px dashed transparent;
  font-size: 14px;
  font-family: "Montserrat", "DejaVu Sans", "Arial", sans-serif;
  user-select: none;
  cursor: move;
}

.widget.on {
  z-index: 200;
}

.widget.interacting {
  z-index: 300;
}

.selection-border {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border: 2px solid var(--accent);
  pointer-events: none;
  z-index: 1;
  box-sizing: border-box;
}

.handle {
  position: absolute;
  width: 8px;
  height: 8px;
  min-width: 8px;
  min-height: 8px;
  background: var(--accent);
  border: none;
  border-radius: 1px;
  z-index: 10;
  box-sizing: border-box;
  pointer-events: auto;
}

.handle-tl {
  left: -4px;
  top: -4px;
}
.handle-tc {
  left: 50%;
  top: -4px;
  transform: translateX(-50%);
}
.handle-tr {
  right: -4px;
  top: -4px;
}
.handle-ml {
  left: -4px;
  top: 50%;
  transform: translateY(-50%);
}
.handle-mr {
  right: -4px;
  top: 50%;
  transform: translateY(-50%);
}
.handle-bl {
  left: -4px;
  bottom: -4px;
}
.handle-bc {
  left: 50%;
  bottom: -4px;
  transform: translateX(-50%);
}
.handle-br {
  right: -4px;
  bottom: -4px;
}

/* BK: stem + circular rotate handle with arrow icon above top-center */
.rotate-stem {
  position: absolute;
  left: 50%;
  top: -22px;
  width: 1px;
  height: 16px;
  background: var(--accent);
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 10;
}

.handle-rotate {
  left: 50%;
  top: -34px;
  width: 18px;
  height: 18px;
  min-width: 18px;
  min-height: 18px;
  border-radius: 50%;
  transform: translateX(-50%);
  cursor: grab;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

.handle-rotate:active {
  cursor: grabbing;
}

.rotate-handle-icon {
  display: block;
  pointer-events: none;
  flex-shrink: 0;
}

.widget.locked {
  cursor: default;
  opacity: 0.85;
}

.btn-label,
.label-caption {
  display: block;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  pointer-events: none;
}

/* LVGL LONG_SCROLL / LONG_SCROLL_CIRCULAR canvas preview */
.caption-scroll {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  pointer-events: none;
  box-sizing: border-box;
  container-type: inline-size;
  container-name: caption;
}

.caption-scroll-track {
  display: inline-flex;
  width: max-content;
  max-width: none;
  white-space: nowrap;
  will-change: transform;
}

.caption-scroll-chunk {
  flex: 0 0 auto;
}

.caption-scroll.is-circular .caption-scroll-chunk {
  padding-right: 2em;
}

/* SCROLL: bounce when text wider than box; idle when it fits (min(0, …)=0) */
.caption-scroll.is-scroll .caption-scroll-track {
  animation: forge-caption-scroll-pingpong 3.5s ease-in-out infinite alternate;
}

@keyframes forge-caption-scroll-pingpong {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(min(0px, 100cqw - 100%));
  }
}

/* SCROLL_CIRCULAR: continuous marquee (two chunks; -50% = one cycle) */
.caption-scroll.is-circular .caption-scroll-track {
  animation: forge-caption-scroll-circular 6s linear infinite;
}

@keyframes forge-caption-scroll-circular {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .caption-scroll.is-scroll .caption-scroll-track,
  .caption-scroll.is-circular .caption-scroll-track {
    animation: none;
  }
}

.img-src {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.img-placeholder {
  color: var(--muted);
  font-size: 11px;
}

.widget-bg-img {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.widget-body > :not(.widget-bg-img) {
  position: relative;
  z-index: 1;
}

.widget-body.image {
  background: #243b53;
  color: var(--muted);
  overflow: hidden;
}

.tab-bar {
  z-index: 2;
  flex-shrink: 0;
}

.tab-item {
  pointer-events: auto;
  border: none;
  margin: 0;
  font: inherit;
}

.tab-item:disabled {
  pointer-events: none;
}

.tab-content {
  pointer-events: none;
  z-index: 1;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  position: relative;
  overflow: hidden;
}

.widget.tabview > .widget-body :deep(.widget) {
  z-index: 1;
}
</style>
