<template>
  <button type="button" @click="$emit('action', 'lock')">{{ locked ? "解锁" : "锁定" }}</button>
  <button type="button" @click="$emit('action', 'hide')">{{ hidden ? "显示" : "隐藏" }}</button>
  <button type="button" @click="$emit('action', 'copy')">复制</button>
  <button type="button" @click="$emit('action', 'up')">上移</button>
  <button type="button" @click="$emit('action', 'down')">下移</button>
  <button type="button" @click="$emit('action', 'top')">置顶</button>
  <button type="button" @click="$emit('action', 'bottom')">置底</button>
  <span class="menu-sep">对齐</span>
  <button type="button" @click="$emit('action', 'align-left')">左对齐</button>
  <button type="button" @click="$emit('action', 'align-center-h')">水平居中</button>
  <button type="button" @click="$emit('action', 'align-right')">右对齐</button>
  <button type="button" @click="$emit('action', 'align-top')">顶对齐</button>
  <button type="button" @click="$emit('action', 'align-center-v')">垂直居中</button>
  <button type="button" @click="$emit('action', 'align-bottom')">底对齐</button>
  <button type="button" @click="$emit('action', 'save-custom')">创建自定义控件</button>
  <button type="button" class="danger" @click="$emit('action', 'delete')">删除</button>
</template>

<script setup lang="ts">
defineProps<{ locked?: boolean; hidden?: boolean }>();
defineEmits<{ action: [string] }>();
</script>
