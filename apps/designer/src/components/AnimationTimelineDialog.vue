<template>
  <div v-if="ui.showAnimations" class="mask" @click.self="close">
    <div class="dlg" role="dialog" aria-label="动画时间轴">
      <h2>动画时间轴（FR-071）</h2>
      <div class="layout">
        <aside class="list">
          <button type="button" class="add" @click="addAnim">+ 新建动画</button>
          <ul>
            <li
              v-for="(a, idx) in draft"
              :key="a.id"
              :class="{ on: idx === selected }"
              @click="selected = idx"
            >
              <span>{{ a.name }}</span>
              <button type="button" class="danger" @click.stop="draft.splice(idx, 1); if (selected >= draft.length) selected = Math.max(0, draft.length - 1)">删</button>
            </li>
          </ul>
        </aside>
        <section v-if="current" class="editor">
          <div class="row">
            <label>名称 <input v-model="current.name" /></label>
            <label>时长(ms) <input v-model.number="current.duration" type="number" min="1" /></label>
            <label><input v-model="current.loop" type="checkbox" /> 循环</label>
            <button type="button" @click="addTrack">+ 轨道</button>
            <button type="button" class="play" :disabled="playing" @click="playPreview">
              {{ playing ? "播放中…" : "播放预览" }}
            </button>
            <button type="button" @click="stopPreview">停止</button>
          </div>
          <div class="scrub">
            <label>
              预览位置 {{ scrub }}ms
              <input v-model.number="scrub" type="range" :min="0" :max="current.duration" />
            </label>
          </div>
          <div v-for="(t, ti) in current.tracks" :key="t.id" class="track">
            <div class="track-head">
              <label>控件 ID <input v-model="t.nodeId" /></label>
              <label>
                属性
                <select v-model="t.property">
                  <option v-for="p in props" :key="p" :value="p">{{ p }}</option>
                </select>
              </label>
              <button type="button" class="danger" @click="current.tracks.splice(ti, 1)">删轨道</button>
            </div>
            <div class="kfs">
              <div v-for="(k, ki) in t.keyframes" :key="ki" class="kf">
                <label>t<input v-model.number="k.t" type="number" min="0" /></label>
                <label>值<input v-model.number="k.value" type="number" /></label>
                <button type="button" @click="t.keyframes.splice(ki, 1)">×</button>
              </div>
              <button type="button" @click="t.keyframes.push({ t: current.duration, value: 0, easing: 'linear' })">+ 关键帧</button>
            </div>
            <p class="sample">t={{ scrub }} → {{ sample(t) }}</p>
          </div>
        </section>
        <p v-else class="empty">暂无动画，点击「新建动画」开始。</p>
      </div>
      <div class="footer">
        <button type="button" @click="close">取消</button>
        <button type="button" class="primary" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useUiStore } from "../stores/ui";
import { useProjectStore } from "../stores/project";

const props = ["x", "y", "w", "h", "opacity", "rotation"] as const;

type Track = {
  id: string;
  nodeId: string;
  property: (typeof props)[number];
  keyframes: Array<{ t: number; value: number; easing?: string }>;
};
type Anim = {
  id: string;
  name: string;
  duration: number;
  loop?: boolean;
  tracks: Track[];
};

const ui = useUiStore();
const store = useProjectStore();
const draft = ref<Anim[]>([]);
const selected = ref(0);
const scrub = ref(0);
const playing = ref(false);
let raf = 0;
let playStarted = 0;

const current = computed(() => draft.value[selected.value] ?? null);

function sampleAt(t: Track, tm: number): number | undefined {
  const kfs = [...t.keyframes].sort((a, b) => a.t - b.t);
  if (!kfs.length) return undefined;
  if (tm <= kfs[0]!.t) return kfs[0]!.value;
  const last = kfs[kfs.length - 1]!;
  if (tm >= last.t) return last.value;
  for (let i = 0; i < kfs.length - 1; i += 1) {
    const a = kfs[i]!;
    const b = kfs[i + 1]!;
    if (tm >= a.t && tm <= b.t) {
      const u = (tm - a.t) / (b.t - a.t || 1);
      return a.value + (b.value - a.value) * u;
    }
  }
  return last.value;
}

function applyPreviewAt(tm: number) {
  if (!current.value) {
    ui.animPreview = {};
    return;
  }
  const next: typeof ui.animPreview = {};
  for (const t of current.value.tracks) {
    const v = sampleAt(t, tm);
    if (v == null || !t.nodeId) continue;
    const slot = next[t.nodeId] ?? {};
    if (t.property === "x") slot.x = Math.round(v);
    else if (t.property === "y") slot.y = Math.round(v);
    else if (t.property === "w") slot.w = Math.round(v);
    else if (t.property === "h") slot.h = Math.round(v);
    else if (t.property === "opacity") slot.opacity = v;
    else if (t.property === "rotation") slot.rotation = v;
    next[t.nodeId] = slot;
  }
  ui.animPreview = next;
}

function stopPreview() {
  playing.value = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  ui.animPreview = {};
}

function playPreview() {
  if (!current.value || playing.value) return;
  playing.value = true;
  playStarted = performance.now();
  scrub.value = 0;
  const duration = Math.max(1, current.value.duration);
  const tick = (now: number) => {
    if (!playing.value || !current.value) return;
    let t = now - playStarted;
    if (current.value.loop) t = t % duration;
    else if (t >= duration) {
      scrub.value = duration;
      applyPreviewAt(duration);
      playing.value = false;
      return;
    }
    scrub.value = Math.round(t);
    applyPreviewAt(t);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

watch(scrub, (tm) => {
  if (!playing.value) applyPreviewAt(tm);
});

function load() {
  stopPreview();
  draft.value = store.animations.map((a) => ({
    id: a.id,
    name: a.name,
    duration: a.duration,
    loop: a.loop,
    tracks: a.tracks.map((t) => ({
      id: t.id,
      nodeId: t.nodeId,
      property: t.property,
      keyframes: t.keyframes.map((k) => ({ ...k })),
    })),
  }));
  selected.value = 0;
  scrub.value = 0;
}

watch(
  () => ui.showAnimations,
  (v) => {
    if (v) load();
    else stopPreview();
  },
);

onBeforeUnmount(stopPreview);

function close() {
  stopPreview();
  ui.showAnimations = false;
}

function addAnim() {
  const id = `anim_${Date.now().toString(36)}`;
  draft.value.push({
    id,
    name: `Animation ${draft.value.length + 1}`,
    duration: 1000,
    loop: false,
    tracks: [],
  });
  selected.value = draft.value.length - 1;
}

function addTrack() {
  if (!current.value) return;
  const nodeId = store.selectedId ?? "node";
  current.value.tracks.push({
    id: `track_${Date.now().toString(36)}`,
    nodeId,
    property: "opacity",
    keyframes: [
      { t: 0, value: 0, easing: "linear" },
      { t: current.value.duration, value: 255, easing: "linear" },
    ],
  });
}

function sample(t: Track): string {
  const v = sampleAt(t, scrub.value);
  return v == null ? "—" : String(Math.round(v * 100) / 100);
}

async function save() {
  await store.setAnimations(
    draft.value.map((a) => ({
      id: a.id,
      name: a.name,
      duration: a.duration,
      loop: a.loop,
      tracks: a.tracks.map((t) => ({
        id: t.id,
        nodeId: t.nodeId,
        property: t.property,
        keyframes: t.keyframes.map((k) => ({
          t: k.t,
          value: k.value,
          easing: (k.easing as "linear") ?? "linear",
        })),
      })),
    })),
  );
  close();
}
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
  width: min(980px, 94vw);
  max-height: 88vh;
  overflow: auto;
  background: #1e2430;
  color: #e8ecf4;
  border-radius: 10px;
  padding: 16px 18px 14px;
  border: 1px solid #3a4558;
}
h2 {
  margin: 0 0 12px;
  font-size: 16px;
}
.layout {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 12px;
  min-height: 360px;
}
.list ul {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}
.list li {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
}
.list li.on {
  background: #2a3344;
  border-color: #4a5568;
}
.row,
.track-head,
.kf,
.footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.play {
  background: #2d6a4f;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 4px 10px;
  cursor: pointer;
}
.track {
  border: 1px solid #3a4558;
  border-radius: 8px;
  padding: 10px;
  margin-top: 10px;
}
.kfs {
  margin-top: 8px;
}
.sample {
  margin: 6px 0 0;
  opacity: 0.75;
  font-size: 12px;
}
.empty {
  opacity: 0.7;
}
input,
select,
button {
  background: #121722;
  color: inherit;
  border: 1px solid #3a4558;
  border-radius: 4px;
  padding: 4px 8px;
}
button {
  cursor: pointer;
  background: #2a3344;
}
.add,
.primary {
  background: #3b6ea5 !important;
  border-color: #4d82bd !important;
}
.danger {
  background: #5a3030 !important;
  border-color: #7a4040 !important;
}
.footer {
  justify-content: flex-end;
  margin-top: 14px;
}
label {
  font-size: 12px;
  display: flex;
  gap: 4px;
  align-items: center;
}
</style>
