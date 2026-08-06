<template>
  <div class="tabs-editor">
    <div class="toolbar">
      <button type="button" class="add" @click="add">+ 新增标签页</button>
    </div>

    <label class="field">
      起始标签页
      <select :value="initialIndex" @change="onInitialIndex" data-testid="tab-initial-select">
        <option v-for="(t, i) in draftTabs" :key="i" :value="i">
          {{ displayName(t, i) }}
        </option>
      </select>
    </label>

    <div class="chip-row" role="tablist">
      <button
        v-for="(t, i) in draftTabs"
        :key="i"
        type="button"
        class="chip"
        :class="{ on: i === selectedIndex }"
        data-testid="tab-chip"
        @click="onSelectCurrent(i)"
      >
        {{ displayName(t, i) }}
      </button>
    </div>

    <div v-if="current" class="current">
      <div class="current-head">当前标签页</div>
      <label class="field name-field">
        <span class="name-label">
          标签页名称
          <span class="static-hint" title="对应 BK is_name_static；画布始终显示名称文本">静态文本</span>
        </span>
        <input
          v-model="current.name"
          placeholder="Tab 名称"
          data-testid="tab-name-input"
          @input="onNameInput"
        />
      </label>
      <button
        type="button"
        class="danger"
        :disabled="draftTabs.length <= 1"
        @click="remove(editingIndex)"
      >
        删除标签页
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { resolveTabEntryLabel } from "../../../utils/tabview-chrome";

type TabEntry = {
  name: string;
  is_name_static?: boolean;
  name_i18nEnabled?: boolean;
};

const props = defineProps<{
  model: Record<string, unknown>;
}>();

const emit = defineEmits<{
  change: [patch: Record<string, unknown>];
}>();

const draftTabs = ref<TabEntry[]>([]);
/** Designer-visible tab (BK selectedTabIndex) — drives canvas. */
const selectedIndex = ref(0);
/** Runtime start tab (BK initialTabIndex). */
const initialIndex = ref(0);
const editingIndex = ref(0);
/** Ignore prop echo while the name field is being typed. */
const suppressPropSync = ref(false);

function asTab(tab: unknown, fallbackIndex: number): TabEntry {
  if (tab && typeof tab === "object" && !Array.isArray(tab)) {
    const o = { ...(tab as Record<string, unknown>) };
    return {
      ...o,
      name: resolveTabEntryLabel(o),
    } as TabEntry;
  }
  if (typeof tab === "string") return { name: tab };
  return { name: `Tab ${fallbackIndex + 1}` };
}

function normalizeTabs(model: Record<string, unknown>): TabEntry[] {
  const raw = model.tabs;
  if (!Array.isArray(raw) || !raw.length) {
    return [{ name: "Tab 1" }, { name: "Tab 2" }];
  }
  return raw.map((t, i) => asTab(t, i));
}

function fingerprint(tabs: TabEntry[], selected: number, initial: number): string {
  return JSON.stringify({ tabs: tabs.map((t) => t.name), selected, initial });
}

function displayName(tab: TabEntry, index: number): string {
  const n = String(tab.name ?? "").trim();
  return n || `Tab ${index + 1}`;
}

const current = computed(() => {
  const i = Math.max(0, Math.min(draftTabs.value.length - 1, editingIndex.value));
  return draftTabs.value[i] ?? null;
});

function emitPatch() {
  const tabs = draftTabs.value.map((t) => ({ ...t, name: String(t.name ?? "") }));
  const sel = Math.max(0, Math.min(tabs.length - 1, selectedIndex.value));
  const init = Math.max(0, Math.min(tabs.length - 1, initialIndex.value));
  selectedIndex.value = sel;
  initialIndex.value = init;
  emit("change", { tabs, selectedTabIndex: sel, initialTabIndex: init });
}

function syncFromModel(model: Record<string, unknown>, force = false) {
  const nextTabs = normalizeTabs(model);
  const nextSelected = Math.max(
    0,
    Math.min(nextTabs.length - 1, Number(model.selectedTabIndex ?? selectedIndex.value ?? 0)),
  );
  const nextInitial = Math.max(
    0,
    Math.min(
      nextTabs.length - 1,
      Number(model.initialTabIndex ?? model.selectedTabIndex ?? initialIndex.value ?? 0),
    ),
  );
  if (
    !force &&
    suppressPropSync.value &&
    fingerprint(nextTabs, nextSelected, nextInitial) !==
      fingerprint(draftTabs.value, selectedIndex.value, initialIndex.value)
  ) {
    return;
  }
  if (
    !force &&
    fingerprint(nextTabs, nextSelected, nextInitial) ===
      fingerprint(draftTabs.value, selectedIndex.value, initialIndex.value)
  ) {
    return;
  }
  draftTabs.value = nextTabs;
  selectedIndex.value = nextSelected;
  initialIndex.value = nextInitial;
  if (editingIndex.value >= nextTabs.length) editingIndex.value = nextSelected;
}

watch(
  () => props.model,
  (m) => {
    const model = m ?? {};
    const missing = !Array.isArray(model.tabs) || !(model.tabs as unknown[]).length;
    syncFromModel(model, missing);
    if (missing) {
      emitPatch();
    }
  },
  { deep: true, immediate: true },
);

function onNameInput() {
  suppressPropSync.value = true;
  emitPatch();
  window.setTimeout(() => {
    suppressPropSync.value = false;
  }, 300);
}

/** BK：点击标签 chip = 切换设计器当前页（selectedTabIndex）并进入该页编辑。 */
function onSelectCurrent(idx: number) {
  selectedIndex.value = idx;
  editingIndex.value = idx;
  emitPatch();
}

/** BK：起始标签页 = initialTabIndex（生成代码初始页）；同时切到该页预览。 */
function onInitialIndex(e: Event) {
  const idx = Number((e.target as HTMLSelectElement).value);
  initialIndex.value = idx;
  selectedIndex.value = idx;
  editingIndex.value = idx;
  emitPatch();
}

function add() {
  draftTabs.value.push({ name: `Tab ${draftTabs.value.length + 1}` });
  const idx = draftTabs.value.length - 1;
  selectedIndex.value = idx;
  editingIndex.value = idx;
  emitPatch();
}

function remove(idx: number) {
  if (draftTabs.value.length <= 1) return;
  draftTabs.value = draftTabs.value.filter((_, i) => i !== idx);
  if (editingIndex.value >= draftTabs.value.length) {
    editingIndex.value = draftTabs.value.length - 1;
  }
  if (selectedIndex.value >= draftTabs.value.length) {
    selectedIndex.value = draftTabs.value.length - 1;
  }
  if (initialIndex.value >= draftTabs.value.length) {
    initialIndex.value = draftTabs.value.length - 1;
  }
  emitPatch();
}
</script>

<style scoped>
.tabs-editor {
  display: grid;
  gap: 8px;
}

.toolbar {
  display: flex;
  gap: 6px;
}

.field {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}

.name-field .name-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.static-hint {
  font-size: 10px;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 6px;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.chip {
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}

.chip.on {
  border-color: var(--accent);
  background: rgba(61, 156, 240, 0.16);
  color: var(--accent);
  font-weight: 600;
}

.current {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px;
  display: grid;
  gap: 8px;
  background: var(--bg);
}

.current-head {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}

input,
select {
  background: var(--panel-2);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
}

.add,
.danger {
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  border-radius: 6px;
  cursor: pointer;
  padding: 6px 8px;
  font-size: 12px;
  justify-self: start;
}

.danger {
  border-color: rgba(248, 113, 113, 0.35);
  background: rgba(248, 113, 113, 0.12);
  color: #f87171;
}

.danger:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
