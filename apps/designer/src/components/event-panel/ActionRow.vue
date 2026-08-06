<template>
  <div class="act-row" :class="{ 'act-row--wide': action.type === 'SET_PROP' }">
    <select :value="action.type" @change="onType">
      <option value="CHANGE_SCREEN">切页</option>
      <option value="CALL_FUNCTION">Call function</option>
      <option value="SET_PROP">改属性</option>
      <option value="SWITCH_LANGUAGE">切换语言</option>
      <option value="PLAY_ANIMATION">播放动画</option>
      <option value="SET_VAR">写变量</option>
      <option value="TOGGLE_VAR">切换变量</option>
    </select>

    <select v-if="action.type === 'CHANGE_SCREEN'" :value="changeTarget" @change="onTarget">
      <option v-for="s in screens" :key="s.id" :value="s.id">{{ s.id }}</option>
    </select>
    <input
      v-else-if="action.type === 'CALL_FUNCTION'"
      :value="callHandler"
      placeholder="handler 名"
      @change="onHandler"
    />
    <template v-else-if="action.type === 'SET_PROP'">
      <select :value="setPropNode" @change="onSetPropNode">
        <option value="" disabled>目标控件</option>
        <option v-for="n in nodes" :key="n.id" :value="n.id">{{ n.label }}</option>
      </select>
      <select :value="setPropKey" @change="onSetPropKey">
        <option v-for="p in SET_PROP_KEYS" :key="p.value" :value="p.value">{{ p.label }}</option>
      </select>
      <select v-if="isBoolProp" :value="String(setPropValue)" @change="onSetPropValue">
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
      <input v-else :value="String(setPropValue)" placeholder="value" @change="onSetPropValue" />
    </template>
    <select v-else-if="action.type === 'SWITCH_LANGUAGE'" :value="langLocale" @change="onLocale">
      <option v-for="l in locales" :key="l" :value="l">{{ l }}</option>
    </select>
    <select v-else-if="action.type === 'PLAY_ANIMATION'" :value="animId" @change="onAnim">
      <option v-for="a in animations" :key="a" :value="a">{{ a }}</option>
    </select>
    <template v-else-if="action.type === 'SET_VAR' || action.type === 'TOGGLE_VAR'">
      <select :value="varId" @change="onVar">
        <option v-for="v in variables" :key="v" :value="v">{{ v }}</option>
      </select>
      <input
        v-if="action.type === 'SET_VAR'"
        :value="varValue"
        placeholder="value"
        @change="onVarValue"
      />
    </template>
    <span v-else />

    <button type="button" class="mini" @click="$emit('remove')">×</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Action } from "../../env";

const SET_PROP_KEYS = [
  { value: "text", label: "text" },
  { value: "hidden", label: "hidden" },
  { value: "opacity", label: "opacity" },
  { value: "x", label: "x" },
  { value: "y", label: "y" },
  { value: "w", label: "w" },
  { value: "h", label: "h" },
  { value: "value", label: "value" },
  { value: "checked", label: "checked" },
  { value: "disabled", label: "disabled" },
] as const;

const BOOL_PROPS = new Set(["hidden", "checked", "disabled"]);

const props = defineProps<{
  action: Action;
  screens: Array<{ id: string }>;
  nodes?: Array<{ id: string; type: string; label: string }>;
  locales?: string[];
  animations?: string[];
  variables?: string[];
}>();

const emit = defineEmits<{
  update: [action: Action];
  remove: [];
}>();

const locales = computed(() => (props.locales?.length ? props.locales : ["en", "zh-CN"]));
const animations = computed(() => props.animations ?? []);
const variables = computed(() => props.variables ?? []);
const nodes = computed(() => props.nodes ?? []);

const changeTarget = computed(() =>
  props.action.type === "CHANGE_SCREEN" ? props.action.target : "",
);
const callHandler = computed(() =>
  props.action.type === "CALL_FUNCTION" ? props.action.handler : "",
);
const setPropNode = computed(() =>
  props.action.type === "SET_PROP" ? props.action.nodeId : "",
);
const setPropKey = computed(() =>
  props.action.type === "SET_PROP" ? props.action.prop : "text",
);
const setPropValue = computed(() =>
  props.action.type === "SET_PROP" ? props.action.value ?? "" : "",
);
const isBoolProp = computed(() => BOOL_PROPS.has(setPropKey.value));
const langLocale = computed(() =>
  props.action.type === "SWITCH_LANGUAGE" ? props.action.locale : locales.value[0]!,
);
const animId = computed(() =>
  props.action.type === "PLAY_ANIMATION" ? props.action.animationId : animations.value[0] ?? "",
);
const varId = computed(() =>
  props.action.type === "SET_VAR" || props.action.type === "TOGGLE_VAR"
    ? props.action.variableId
    : variables.value[0] ?? "",
);
const varValue = computed(() =>
  props.action.type === "SET_VAR" ? String(props.action.value ?? "") : "",
);

function defaultSetPropValue(prop: string): unknown {
  if (BOOL_PROPS.has(prop)) return true;
  if (prop === "opacity") return 255;
  if (prop === "text") return "";
  return 0;
}

function onType(e: Event) {
  const type = (e.target as HTMLSelectElement).value;
  if (type === "CHANGE_SCREEN") {
    emit("update", { type: "CHANGE_SCREEN", target: props.screens[0]?.id ?? "home" });
  } else if (type === "CALL_FUNCTION") {
    emit("update", { type: "CALL_FUNCTION", handler: "on_handler" });
  } else if (type === "SET_PROP") {
    const first = nodes.value[0]?.id ?? "";
    emit("update", { type: "SET_PROP", nodeId: first, prop: "text", value: "" });
  } else if (type === "SWITCH_LANGUAGE") {
    emit("update", { type: "SWITCH_LANGUAGE", locale: locales.value[0]! });
  } else if (type === "PLAY_ANIMATION") {
    emit("update", { type: "PLAY_ANIMATION", animationId: animations.value[0] ?? "anim_1" });
  } else if (type === "SET_VAR") {
    emit("update", { type: "SET_VAR", variableId: variables.value[0] ?? "var_1", value: 0 });
  } else if (type === "TOGGLE_VAR") {
    emit("update", { type: "TOGGLE_VAR", variableId: variables.value[0] ?? "var_1" });
  }
}

function onTarget(e: Event) {
  emit("update", { type: "CHANGE_SCREEN", target: (e.target as HTMLSelectElement).value });
}
function onHandler(e: Event) {
  emit("update", { type: "CALL_FUNCTION", handler: (e.target as HTMLInputElement).value });
}
function onSetPropNode(e: Event) {
  if (props.action.type !== "SET_PROP") return;
  emit("update", { ...props.action, nodeId: (e.target as HTMLSelectElement).value });
}
function onSetPropKey(e: Event) {
  if (props.action.type !== "SET_PROP") return;
  const prop = (e.target as HTMLSelectElement).value;
  emit("update", { ...props.action, prop, value: defaultSetPropValue(prop) });
}
function onSetPropValue(e: Event) {
  if (props.action.type !== "SET_PROP") return;
  const raw = (e.target as HTMLSelectElement | HTMLInputElement).value;
  if (BOOL_PROPS.has(props.action.prop)) {
    emit("update", { ...props.action, value: raw === "true" });
    return;
  }
  if (props.action.prop === "text") {
    emit("update", { ...props.action, value: raw });
    return;
  }
  const num = Number(raw);
  emit("update", { ...props.action, value: Number.isFinite(num) && raw.trim() !== "" ? num : raw });
}
function onLocale(e: Event) {
  emit("update", { type: "SWITCH_LANGUAGE", locale: (e.target as HTMLSelectElement).value });
}
function onAnim(e: Event) {
  emit("update", { type: "PLAY_ANIMATION", animationId: (e.target as HTMLSelectElement).value });
}
function onVar(e: Event) {
  const id = (e.target as HTMLSelectElement).value;
  if (props.action.type === "TOGGLE_VAR") emit("update", { type: "TOGGLE_VAR", variableId: id });
  else
    emit("update", {
      type: "SET_VAR",
      variableId: id,
      value: props.action.type === "SET_VAR" ? props.action.value : 0,
    });
}
function onVarValue(e: Event) {
  if (props.action.type !== "SET_VAR") return;
  const raw = (e.target as HTMLInputElement).value;
  const num = Number(raw);
  emit("update", { ...props.action, value: Number.isFinite(num) && raw.trim() !== "" ? num : raw });
}
</script>

<style scoped>
.act-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 4px;
  align-items: center;
}

.act-row--wide {
  grid-template-columns: minmax(72px, 0.9fr) minmax(72px, 1fr) minmax(64px, 0.8fr) minmax(56px, 0.8fr) auto;
}

select,
input {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 12px;
  min-width: 0;
}

.mini {
  padding: 2px 8px;
  font-size: 12px;
}
</style>
