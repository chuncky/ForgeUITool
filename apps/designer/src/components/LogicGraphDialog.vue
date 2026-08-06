<template>
  <div v-if="ui.showLogicGraph" class="mask" @click.self="ui.showLogicGraph = false">
    <div class="dlg" role="dialog" aria-label="逻辑图">
      <header class="hdr">
        <div>
          <h2>逻辑图（FR-036 / AR-050）</h2>
          <p class="hint">事件存工程模型；本视图可拖拽排版。双击节点选中画布控件。Alt+拖动画布平移，滚轮缩放。</p>
        </div>
        <div class="hdr-actions">
          <button type="button" class="ghost" @click="resetLayout">重置布局</button>
          <button type="button" class="primary" @click="ui.showLogicGraph = false">关闭</button>
        </div>
      </header>

      <div v-if="!graphNodes.length" class="empty">当前页无事件绑定。</div>
      <div
        v-else
        ref="viewport"
        class="viewport"
        @pointerdown="onPanStart"
        @pointermove="onPanMove"
        @pointerup="onPanEnd"
        @pointerleave="onPanEnd"
        @wheel.prevent="onWheel"
      >
        <svg class="edges" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet">
          <defs>
            <marker id="lg-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L7,3 L0,6 Z" fill="#6b7c96" />
            </marker>
          </defs>
          <g :transform="`translate(${pan.x},${pan.y}) scale(${zoom})`">
            <line
              v-for="e in edges"
              :key="e.id"
              :x1="e.x1"
              :y1="e.y1"
              :x2="e.x2"
              :y2="e.y2"
              class="edge"
              marker-end="url(#lg-arrow)"
            />
          </g>
        </svg>
        <div class="world" :style="worldStyle">
          <div
            v-for="n in graphNodes"
            :key="n.id"
            class="gnode"
            :class="[`kind-${n.kind}`, { dragging: drag?.id === n.id }]"
            :style="{ left: `${n.x}px`, top: `${n.y}px` }"
            @pointerdown.stop="onNodeDown($event, n.id)"
            @dblclick.stop="onNodeDblClick(n)"
          >
            <span class="kind">{{ kindLabel(n.kind) }}</span>
            <strong>{{ n.title }}</strong>
            <span v-if="n.sub" class="sub">{{ n.sub }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import type { Action, UiNode } from "../env";
import { useUiStore } from "../stores/ui";
import { useProjectStore } from "../stores/project";

const ui = useUiStore();
const store = useProjectStore();

type Kind = "widget" | "trigger" | "action";
interface GraphNode {
  id: string;
  kind: Kind;
  title: string;
  sub?: string;
  widgetId?: string;
  x: number;
  y: number;
}
interface GraphEdge {
  id: string;
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const NODE_W = 168;
const NODE_H = 64;
const COL_GAP = 48;
const ROW_GAP = 28;

const positions = reactive<Record<string, { x: number; y: number }>>({});
const pan = reactive({ x: 24, y: 24 });
const zoom = ref(1);
const viewport = ref<HTMLElement | null>(null);

const drag = ref<{ id: string; ox: number; oy: number; sx: number; sy: number } | null>(null);
const panning = ref<{ ox: number; oy: number; px: number; py: number } | null>(null);

function actionLabel(a: Action): { title: string; sub: string } {
  switch (a.type) {
    case "CHANGE_SCREEN":
      return { title: a.type, sub: `→ ${a.target}` };
    case "CALL_FUNCTION":
      return { title: a.type, sub: a.handler };
    case "SET_PROP":
      return { title: a.type, sub: `${a.nodeId}.${a.prop}` };
    case "SWITCH_LANGUAGE":
      return { title: a.type, sub: a.locale };
    case "PLAY_ANIMATION":
      return { title: a.type, sub: a.animationId };
    case "SET_VAR":
      return { title: a.type, sub: `${a.variableId}=${String(a.value)}` };
    case "TOGGLE_VAR":
      return { title: a.type, sub: a.variableId };
    default:
      return { title: (a as { type: string }).type, sub: "" };
  }
}

function kindLabel(k: Kind): string {
  if (k === "widget") return "控件";
  if (k === "trigger") return "触发";
  return "动作";
}

interface Chain {
  widgetId: string;
  widgetName: string;
  trigger: string;
  actions: Action[];
  chainKey: string;
}

function collectChains(node: UiNode, out: Chain[]): void {
  (node.events ?? []).forEach((ev, ei) => {
    out.push({
      widgetId: node.id,
      widgetName: node.name || node.id,
      trigger: ev.trigger,
      actions: ev.actions ?? [],
      chainKey: `${node.id}::${ei}::${ev.trigger}`,
    });
  });
  for (const c of node.children ?? []) collectChains(c, out);
}

const chains = computed(() => {
  const screen = store.currentScreen;
  if (!screen) return [] as Chain[];
  const out: Chain[] = [];
  collectChains(screen, out);
  return out;
});

function ensureLayout(keys: string[], auto: Record<string, { x: number; y: number }>) {
  for (const k of keys) {
    if (!positions[k] && auto[k]) positions[k] = { ...auto[k]! };
  }
}

const layoutModel = computed(() => {
  const nodes: GraphNode[] = [];
  const edgeSpecs: Array<{ id: string; from: string; to: string }> = [];
  const auto: Record<string, { x: number; y: number }> = {};
  const keys: string[] = [];

  chains.value.forEach((ch, row) => {
    const y = row * (NODE_H + ROW_GAP);
    const wId = `w:${ch.widgetId}`;
    const tId = `t:${ch.chainKey}`;
    if (!keys.includes(wId)) {
      keys.push(wId);
      auto[wId] = { x: 0, y };
      nodes.push({
        id: wId,
        kind: "widget",
        title: ch.widgetName,
        sub: ch.widgetId,
        widgetId: ch.widgetId,
        x: 0,
        y,
      });
    }
    keys.push(tId);
    auto[tId] = { x: NODE_W + COL_GAP, y };
    nodes.push({
      id: tId,
      kind: "trigger",
      title: ch.trigger,
      widgetId: ch.widgetId,
      x: NODE_W + COL_GAP,
      y,
    });
    edgeSpecs.push({ id: `e:${wId}-${tId}`, from: wId, to: tId });

    let prev = tId;
    ch.actions.forEach((a, ai) => {
      const aId = `a:${ch.chainKey}:${ai}`;
      const x = (2 + ai) * (NODE_W + COL_GAP);
      keys.push(aId);
      auto[aId] = { x, y };
      const lab = actionLabel(a);
      nodes.push({
        id: aId,
        kind: "action",
        title: lab.title,
        sub: lab.sub,
        widgetId: ch.widgetId,
        x,
        y,
      });
      edgeSpecs.push({ id: `e:${prev}-${aId}`, from: prev, to: aId });
      prev = aId;
    });
  });

  ensureLayout(keys, auto);

  const placed = nodes.map((n) => {
    const p = positions[n.id] ?? auto[n.id]!;
    return { ...n, x: p.x, y: p.y };
  });

  const byId = new Map(placed.map((n) => [n.id, n]));
  const edges: GraphEdge[] = edgeSpecs.map((e) => {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    return {
      id: e.id,
      from: e.from,
      to: e.to,
      x1: a.x + NODE_W,
      y1: a.y + NODE_H / 2,
      x2: b.x,
      y2: b.y + NODE_H / 2,
    };
  });

  return { nodes: placed, edges };
});

const graphNodes = computed(() => layoutModel.value.nodes);
const edges = computed(() => layoutModel.value.edges);

const worldStyle = computed(() => ({
  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom.value})`,
  transformOrigin: "0 0",
}));

const viewBox = computed(() => {
  const el = viewport.value;
  const w = el?.clientWidth || 800;
  const h = el?.clientHeight || 420;
  return `0 0 ${w} ${h}`;
});

function resetLayout() {
  for (const k of Object.keys(positions)) delete positions[k];
  pan.x = 24;
  pan.y = 24;
  zoom.value = 1;
}

function onNodeDown(ev: PointerEvent, id: string) {
  if (ev.button !== 0) return;
  const n = graphNodes.value.find((g) => g.id === id);
  if (!n) return;
  (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
  drag.value = { id, ox: ev.clientX, oy: ev.clientY, sx: n.x, sy: n.y };
  window.addEventListener("pointermove", onNodeMove);
  window.addEventListener("pointerup", onNodeUp);
}

function onNodeMove(ev: PointerEvent) {
  if (!drag.value) return;
  positions[drag.value.id] = {
    x: drag.value.sx + (ev.clientX - drag.value.ox) / zoom.value,
    y: drag.value.sy + (ev.clientY - drag.value.oy) / zoom.value,
  };
}

function onNodeUp() {
  drag.value = null;
  window.removeEventListener("pointermove", onNodeMove);
  window.removeEventListener("pointerup", onNodeUp);
}

function onPanStart(ev: PointerEvent) {
  if (ev.button !== 1 && !(ev.button === 0 && ev.altKey)) return;
  panning.value = { ox: ev.clientX, oy: ev.clientY, px: pan.x, py: pan.y };
}

function onPanMove(ev: PointerEvent) {
  if (!panning.value) return;
  pan.x = panning.value.px + (ev.clientX - panning.value.ox);
  pan.y = panning.value.py + (ev.clientY - panning.value.oy);
}

function onPanEnd() {
  panning.value = null;
}

function onWheel(ev: WheelEvent) {
  zoom.value = Math.min(1.6, Math.max(0.55, zoom.value * (ev.deltaY < 0 ? 1.08 : 0.92)));
}

async function onNodeDblClick(n: GraphNode) {
  if (!n.widgetId) return;
  await store.select(n.widgetId);
}

watch(
  () => store.screenId,
  () => resetLayout(),
);
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 80;
}
.dlg {
  width: min(960px, 94vw);
  height: min(640px, 88vh);
  display: flex;
  flex-direction: column;
  background: #1a2030;
  color: #e8ecf4;
  border-radius: 12px;
  padding: 14px 16px;
  border: 1px solid #3a4558;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
}
.hdr {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}
.hdr h2 {
  margin: 0;
  font-size: 16px;
}
.hdr-actions {
  display: flex;
  gap: 8px;
}
.hint,
.empty {
  font-size: 12px;
  opacity: 0.75;
  margin: 4px 0 0;
}
.viewport {
  position: relative;
  flex: 1;
  min-height: 0;
  margin-top: 12px;
  border: 1px solid #2f3a4d;
  border-radius: 10px;
  background:
    radial-gradient(circle at 1px 1px, #2a3344 1px, transparent 0) 0 0 / 18px 18px,
    #121722;
  overflow: hidden;
  cursor: grab;
}
.edges {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.edge {
  stroke: #6b7c96;
  stroke-width: 2;
}
.world {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.gnode {
  position: absolute;
  width: 168px;
  min-height: 56px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid #4a5870;
  background: #243044;
  box-sizing: border-box;
  display: grid;
  gap: 2px;
  pointer-events: auto;
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.gnode.dragging {
  cursor: grabbing;
  z-index: 2;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
}
.gnode.kind-widget {
  border-color: #4d82bd;
  background: linear-gradient(180deg, #2a3f5c, #243044);
}
.gnode.kind-trigger {
  border-color: #c9a227;
  background: linear-gradient(180deg, #3f3820, #243044);
}
.gnode.kind-action {
  border-color: #3fa66b;
  background: linear-gradient(180deg, #1f3d30, #243044);
}
.kind {
  font-size: 10px;
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.gnode strong {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub {
  font-size: 11px;
  opacity: 0.75;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ghost,
.primary {
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
  color: inherit;
}
.ghost {
  background: transparent;
  border: 1px solid #4a5870;
}
.primary {
  background: #3b6ea5;
  border: 1px solid #4d82bd;
}
</style>