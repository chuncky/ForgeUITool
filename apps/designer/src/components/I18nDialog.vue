<template>
  <div v-if="ui.showI18n" class="mask" @click.self="close">
    <div class="dlg" role="dialog" aria-label="多语言">
      <h2>多语言 / i18n（FR-042 / FR-043）</h2>
      <div class="row toggles">
        <label>
          <input v-model="draft.enabled" type="checkbox" />
          启用多语言
        </label>
        <label>
          默认语言
          <select v-model="draft.defaultLocale">
            <option v-for="l in draft.locales" :key="l.id" :value="l.id">{{ l.name }} ({{ l.id }})</option>
          </select>
        </label>
        <label>
          预览语言
          <select v-model="draft.previewLocale">
            <option v-for="l in draft.locales" :key="l.id" :value="l.id">{{ l.name }} ({{ l.id }})</option>
          </select>
        </label>
      </div>

      <div v-if="progress.locales.length" class="progress-panel">
        <div v-for="p in progress.locales" :key="p.localeId" class="prog-row">
          <span class="prog-label">{{ p.localeId }}</span>
          <div class="bar">
            <div class="fill" :style="{ width: `${Math.round(p.ratio * 100)}%` }" />
          </div>
          <span class="prog-meta"
            >{{ p.translated }}/{{ p.total }}（缺 {{ p.missing }}）· {{ Math.round(p.ratio * 100) }}%</span
          >
        </div>
      </div>

      <div class="toolbar">
        <button type="button" @click="addLocale">添加语言</button>
        <button type="button" @click="addString">添加词条</button>
        <button type="button" @click="seedFromUi">从界面文本播种</button>
        <label class="inline">
          导出目标
          <select v-model="xliffTarget">
            <option v-for="l in exportTargets" :key="l.id" :value="l.id">{{ l.id }}</option>
          </select>
        </label>
        <label class="inline">
          <input v-model="onlyMissing" type="checkbox" />
          仅缺失
        </label>
        <button type="button" @click="doExportXliff">导出 XLIFF</button>
        <button type="button" @click="doImportXliff">导入 XLIFF</button>
        <label class="inline">
          <input v-model="showMissingOnly" type="checkbox" />
          表内只看缺失
        </label>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>键</th>
              <th v-for="l in draft.locales" :key="l.id">{{ l.id }}</th>
              <th>状态</th>
              <th>备注</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, idx) in visibleStrings" :key="s.id + idx" :class="rowClass(s)">
              <td><input v-model="s.id" class="key" /></td>
              <td v-for="l in draft.locales" :key="l.id">
                <input v-model="s.values[l.id]" />
              </td>
              <td class="state">{{ statusLabel(s) }}</td>
              <td><input v-model="s.note" /></td>
              <td>
                <button type="button" class="danger" @click="removeString(s)">删</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="footer">
        <button type="button" @click="close">取消</button>
        <button type="button" class="primary" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useUiStore } from "../stores/ui";
import { useProjectStore } from "../stores/project";

type Draft = {
  enabled: boolean;
  defaultLocale: string;
  previewLocale: string;
  locales: Array<{ id: string; name: string }>;
  strings: Array<{ id: string; note?: string; values: Record<string, string> }>;
};

const ui = useUiStore();
const store = useProjectStore();
const draft = reactive<Draft>({
  enabled: false,
  defaultLocale: "en",
  previewLocale: "en",
  locales: [],
  strings: [],
});
const xliffTarget = ref("zh-CN");
const onlyMissing = ref(true);
const showMissingOnly = ref(false);

function filled(v: string | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function unitState(s: Draft["strings"][number], target: string): "new" | "needs-translation" | "translated" {
  const src = s.values[draft.defaultLocale];
  const tgt = s.values[target];
  if (!filled(src)) return "new";
  if (!filled(tgt)) return "needs-translation";
  if (tgt!.trim() === src!.trim() && draft.defaultLocale !== target) return "needs-translation";
  return "translated";
}

const exportTargets = computed(() => draft.locales.filter((l) => l.id !== draft.defaultLocale));

const progress = computed(() => {
  const locales = exportTargets.value.map((loc) => {
    const missingIds: string[] = [];
    let translated = 0;
    for (const s of draft.strings) {
      if (unitState(s, loc.id) === "translated") translated += 1;
      else missingIds.push(s.id);
    }
    const total = draft.strings.length;
    return {
      localeId: loc.id,
      total,
      translated,
      missing: missingIds.length,
      ratio: total === 0 ? 1 : translated / total,
    };
  });
  return { locales };
});

const visibleStrings = computed(() => {
  if (!showMissingOnly.value) return draft.strings;
  const target = xliffTarget.value || exportTargets.value[0]?.id || draft.defaultLocale;
  return draft.strings.filter((s) => unitState(s, target) !== "translated");
});

function statusLabel(s: Draft["strings"][number]): string {
  const target = xliffTarget.value || exportTargets.value[0]?.id || draft.defaultLocale;
  const st = unitState(s, target);
  if (st === "translated") return "已译";
  if (st === "new") return "无源文";
  return "待译";
}

function rowClass(s: Draft["strings"][number]): string {
  const st = unitState(s, xliffTarget.value || exportTargets.value[0]?.id || draft.defaultLocale);
  return st === "translated" ? "ok" : "miss";
}

function removeString(s: Draft["strings"][number]) {
  const i = draft.strings.indexOf(s);
  if (i >= 0) draft.strings.splice(i, 1);
}

function load() {
  const src = store.i18nConfig;
  draft.enabled = src.enabled;
  draft.defaultLocale = src.defaultLocale;
  draft.previewLocale = src.previewLocale ?? src.defaultLocale;
  draft.locales = src.locales.map((l) => ({ ...l }));
  draft.strings = src.strings.map((s) => ({
    id: s.id,
    note: s.note,
    values: { ...s.values },
  }));
  const tgt = draft.locales.find((l) => l.id !== draft.defaultLocale)?.id;
  if (tgt) xliffTarget.value = tgt;
}

watch(
  () => ui.showI18n,
  (v) => {
    if (v) load();
  },
);

function close() {
  ui.showI18n = false;
}

function addLocale() {
  const id = prompt("语言 ID（如 ja）", "ja");
  if (!id?.trim()) return;
  if (draft.locales.some((l) => l.id === id.trim())) return;
  draft.locales.push({ id: id.trim(), name: id.trim() });
}

function addString() {
  const id = prompt("词条键", `str_${draft.strings.length + 1}`);
  if (!id?.trim()) return;
  draft.strings.push({ id: id.trim(), values: {}, note: "" });
}

async function seedFromUi() {
  await store.seedI18nFromProject();
  load();
}

async function save() {
  await store.setI18n({
    enabled: draft.enabled,
    defaultLocale: draft.defaultLocale,
    previewLocale: draft.previewLocale,
    locales: draft.locales.map((l) => ({ ...l })),
    strings: draft.strings.map((s) => ({
      id: s.id,
      note: s.note,
      values: { ...s.values },
    })),
  });
  close();
}

async function doExportXliff() {
  const target = xliffTarget.value || exportTargets.value[0]?.id || draft.defaultLocale;
  await store.exportI18nXliff(draft.defaultLocale, target, { onlyMissing: onlyMissing.value });
}

async function doImportXliff() {
  await store.importI18nXliff();
  load();
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
  width: min(960px, 94vw);
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
.row,
.toolbar,
.footer {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
}
.toggles label,
.inline {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 13px;
}
.progress-panel {
  margin-bottom: 12px;
  padding: 8px 10px;
  background: #161b26;
  border: 1px solid #3a4558;
  border-radius: 6px;
}
.prog-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
  font-size: 12px;
}
.prog-label {
  width: 56px;
  flex-shrink: 0;
}
.bar {
  flex: 1;
  height: 8px;
  background: #2a3344;
  border-radius: 4px;
  overflow: hidden;
}
.fill {
  height: 100%;
  background: #3b9b6e;
}
.prog-meta {
  min-width: 160px;
  color: #9aa4b2;
}
.toolbar button,
.footer button {
  background: #2a3344;
  color: inherit;
  border: 1px solid #4a5568;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
}
.primary {
  background: #3b6ea5 !important;
  border-color: #4d82bd !important;
}
.danger {
  background: #5a3030 !important;
  border-color: #7a4040 !important;
}
.table-wrap {
  overflow: auto;
  max-height: 48vh;
  margin-bottom: 12px;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
th,
td {
  border: 1px solid #3a4558;
  padding: 4px;
}
tr.miss {
  background: rgba(120, 60, 40, 0.18);
}
tr.ok {
  background: transparent;
}
td.state {
  white-space: nowrap;
  color: #c5d0de;
}
input,
select {
  width: 100%;
  background: #121722;
  color: inherit;
  border: 1px solid #3a4558;
  border-radius: 4px;
  padding: 4px 6px;
}
input.key {
  min-width: 110px;
}
.footer {
  justify-content: flex-end;
  margin-bottom: 0;
}
</style>
