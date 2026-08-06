<template>
  <PropGroup>
    <template #title>样式</template>
    <template #actions>
      <button type="button" title="保存当前 Part+State 到样式库" @click="saveTheme">保存</button>
      <button type="button" title="打开样式库" @click="applyTheme">
        样式库
      </button>
      <button
        v-if="styleRef"
        type="button"
        title="清除主题链接（保留当前样式值）"
        @click="clearStyleRef"
      >
        取消链接
      </button>
    </template>

    <div class="selectors" :class="{ 'state-only': !showPartSelector }">
      <label v-if="showPartSelector" class="sel">
        PART *
        <select v-model="part">
          <option v-for="p in styleParts" :key="p" :value="p">{{ partLabel(p) }}</option>
        </select>
      </label>
      <label class="sel">
        STATE *
        <select v-model="state">
          <option v-for="s in STYLE_STATES" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>
    </div>

    <p v-if="linkedTheme" class="link-banner" title="主题变更时将自动同步到此节点">
      已链接主题：{{ linkedTheme.name }}
      <span class="meta">({{ linkedTheme.id }})</span>
    </p>
    <p v-else-if="styleRef" class="link-banner warn">
      主题引用丢失：{{ styleRef }}
    </p>

    <div
      v-for="group in subgroups"
      :key="group.id"
      class="subgroup"
      :class="{ off: isSubgroupOff(group.id) }"
    >
      <div class="subgroup-summary">
        <span class="dot" />
        <span class="subgroup-title">{{ group.title }}</span>
        <button
          type="button"
          class="eye"
          :title="
            isSubgroupOff(group.id)
              ? '显示：展开编辑区并参与渲染'
              : '隐藏：收起编辑区且不参与渲染'
          "
          @click="toggleSubgroup(group.id)"
        >
          {{ isSubgroupOff(group.id) ? "显示" : "隐藏" }}
        </button>
      </div>
      <div v-show="!isSubgroupOff(group.id)" class="sub-fields">
        <label v-for="sf in visibleFields(group.fields)" :key="sf.key" class="field">
          {{ sf.label }}
          <input
            v-if="sf.type === 'number'"
            type="number"
            min="0"
            :value="Number(fieldValue(sf.key) ?? '')"
            @change="onField(sf.key, $event, 'number')"
          />
          <div v-else-if="sf.type === 'imageSrc'" class="image-row">
            <select
              v-if="imageOptions.length"
              :value="String(fieldValue(sf.key) ?? '')"
              @change="onPlainField(sf.key, $event)"
            >
              <option value="">— 选择图片 —</option>
              <option v-for="opt in imageOptions" :key="opt.path" :value="opt.path">
                {{ opt.id }}
              </option>
            </select>
            <input
              type="text"
              :value="String(fieldValue(sf.key) ?? '')"
              placeholder="assets/images/…"
              @change="onPlainField(sf.key, $event)"
            />
            <button type="button" class="lib-btn" title="从资源管理选择图片" @click="pickImage(sf.key)">
              库
            </button>
          </div>
          <div v-else-if="sf.type === 'fontRef'" class="font-row">
            <select
              v-if="fontOptions.length"
              :value="fontSelectValue(sf.key)"
              @change="onFontSelect(sf.key, $event)"
            >
              <option value="">— 选择字体 —</option>
              <option v-for="f in fontOptions" :key="f.id" :value="f.id">
                {{ f.id }}{{ f.size ? ` · ${f.size}px` : "" }}
              </option>
            </select>
            <input
              type="text"
              :value="String(fieldValue(sf.key) ?? '')"
              placeholder="字体 id 或 @fontId"
              @change="onPlainField(sf.key, $event)"
            />
            <button type="button" class="lib-btn" title="从资源管理选择字体" @click="pickFont(sf.key)">
              库
            </button>
          </div>
          <select
            v-else-if="sf.type === 'enum'"
            :value="String(fieldValue(sf.key) ?? sf.enum?.[0] ?? '')"
            @change="onField(sf.key, $event, 'text')"
          >
            <option v-for="opt in sf.enum ?? []" :key="opt" :value="opt">
              {{ sf.enumLabels?.[opt] ?? opt }}
            </option>
          </select>
          <div v-else class="color-row">
            <input
              type="text"
              :value="String(fieldValue(sf.key) ?? '')"
              placeholder="#RRGGBBAA 或 @colorId"
              @change="onField(sf.key, $event, 'text')"
            />
            <input
              type="color"
              class="color-swatch"
              :value="colorSwatch(displayColorValue(fieldValue(sf.key), store.colorLibrary))"
              @input="onColorField(sf.key, $event)"
            />
            <button type="button" class="lib-btn" title="从颜色库选择" @click="pickFromLibrary(sf.key)">
              库
            </button>
          </div>
        </label>
      </div>
    </div>
  </PropGroup>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import PropGroup from "./PropGroup.vue";
import { partLabel, STYLE_STATES } from "./constants";
import { colorSwatch, displayColorValue, toRgbaHex } from "../../utils/color";
import {
  readStyleProp,
  normalizeStyleParts,
  styleSubgroupsForWidget,
  visibleStyleFields,
  type StyleFieldDef,
} from "../../utils/style";
import { useProjectStore } from "../../stores/project";
import { useUiStore } from "../../stores/ui";

const props = defineProps<{
  widgetType: string;
  style: Record<string, unknown>;
  styleParts: string[];
  styleRef?: string;
}>();

const emit = defineEmits<{
  patch: [part: string, state: string, patch: Record<string, unknown>];
  "update-disabled-subgroups": [ids: string[]];
  "clear-style-ref": [];
}>();

const store = useProjectStore();
const ui = useUiStore();

const part = ref("main");
const state = ref("default");

watch(
  () => [props.widgetType, props.styleParts] as const,
  () => {
    part.value = props.styleParts[0] ?? "main";
    state.value = "default";
  },
  { immediate: true },
);

const showPartSelector = computed(() => props.styleParts.length > 1);

const subgroups = computed(() => styleSubgroupsForWidget(props.widgetType));

const linkedTheme = computed(() => {
  if (!props.styleRef) return undefined;
  return store.styleThemes.find((t) => t.id === props.styleRef);
});

const fontOptions = computed(() => store.fontAssets);

const imageOptions = computed(() => store.imageAssets);

function fontSelectValue(key: string): string {
  const raw = String(fieldValue(key) ?? "");
  return raw.startsWith("@") ? raw.slice(1) : raw;
}

function onFontSelect(key: string, e: Event) {
  const id = (e.target as HTMLSelectElement).value;
  emit("patch", part.value, state.value, { [key]: id ? `@${id}` : "" });
}

function pickFont(key: string) {
  ui.openAssetsForFontPick((fontId) => {
    emit("patch", part.value, state.value, { [key]: `@${fontId}` });
  });
}

function pickImage(key: string) {
  ui.openAssetsForImagePick((imagePath) => {
    emit("patch", part.value, state.value, { [key]: imagePath });
  });
}

function isSubgroupOff(id: string): boolean {
  const raw = props.style?.disabledSubgroups;
  return Array.isArray(raw) && raw.map(String).includes(id);
}

function toggleSubgroup(id: string) {
  const raw = props.style?.disabledSubgroups;
  const cur = Array.isArray(raw) ? raw.map(String) : [];
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  emit("update-disabled-subgroups", next);
}

function visibleFields(fields: StyleFieldDef[]) {
  return visibleStyleFields(props.widgetType, fields);
}

function fieldValue(key: string) {
  return readStyleProp(props.style, part.value, state.value, key);
}

function onField(key: string, e: Event, kind: "number" | "text") {
  const raw = (e.target as HTMLInputElement).value;
  const value = kind === "number" ? Number(raw) : toRgbaHex(raw);
  emit("patch", part.value, state.value, { [key]: value });
}

function onPlainField(key: string, e: Event) {
  emit("patch", part.value, state.value, { [key]: (e.target as HTMLInputElement).value });
}

function onColorField(key: string, e: Event) {
  emit("patch", part.value, state.value, { [key]: `${(e.target as HTMLInputElement).value}ff` });
}

function pickFromLibrary(key: string) {
  ui.openColorsForPick((ref) => {
    emit("patch", part.value, state.value, { [key]: ref });
  });
}

function currentPartStateProps(): Record<string, unknown> {
  const parts = normalizeStyleParts(props.style);
  return { ...(parts[part.value]?.[state.value] ?? {}) };
}

async function saveTheme() {
  ui.openSaveStyle({
    part: part.value,
    state: state.value,
    props: currentPartStateProps(),
    widgetType: props.widgetType,
  });
}

async function applyTheme() {
  ui.openStyleLibrary();
}

function clearStyleRef() {
  emit("clear-style-ref");
}
</script>

<style scoped>
.selectors {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 8px;
}

.selectors.state-only {
  grid-template-columns: 1fr;
}

.sel {
  display: grid;
  gap: 4px;
  font-size: 11px;
  color: var(--muted);
}

.link-banner {
  margin: 0 0 8px;
  padding: 6px 8px;
  font-size: 11px;
  color: var(--text);
  background: color-mix(in srgb, var(--accent, #3b82f6) 12%, transparent);
  border-radius: 6px;
}

.link-banner .meta {
  color: var(--muted);
  margin-left: 4px;
}

.link-banner.warn {
  background: color-mix(in srgb, #f59e0b 18%, transparent);
}

.subgroup {
  margin-top: 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
}

.subgroup-summary {
  width: 100%;
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 6px;
}

.subgroup-summary .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent, #3b82f6);
  flex-shrink: 0;
}

.subgroup-title {
  flex: 1;
  min-width: 0;
}

.subgroup.off {
  opacity: 0.55;
}

.eye {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--panel-2, var(--bg));
  color: var(--muted);
  cursor: pointer;
  flex-shrink: 0;
}

.eye:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.sub-fields {
  display: grid;
  gap: 8px;
  padding: 0 8px 8px;
}

.field {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}

select,
input {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
}

.color-row {
  display: grid;
  grid-template-columns: 1fr 32px 28px;
  gap: 6px;
  align-items: center;
}

.font-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 28px;
  gap: 6px;
  align-items: center;
}

.image-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 28px;
  gap: 6px;
  align-items: center;
}

.image-row:has(> input:only-of-type) {
  grid-template-columns: minmax(0, 1fr) 28px;
}

.color-swatch {
  padding: 2px;
  height: 32px;
  cursor: pointer;
}

.lib-btn {
  font-size: 10px;
  padding: 4px 0;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--muted);
  cursor: pointer;
}

.lib-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
