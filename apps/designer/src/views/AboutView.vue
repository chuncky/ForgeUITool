<template>
  <div class="page">
    <h1>关于 ForgeUI Kit</h1>
    <dl>
      <div><dt>产品</dt><dd>ForgeUI Kit — qm10x LVGL 可视化 UI 工具链</dd></div>
      <div><dt>版本</dt><dd>0.1.0（设计器 MVP）</dd></div>
      <div><dt>LVGL 版本线</dt><dd>9.10（D-04）</dd></div>
      <div><dt>首发平台</dt><dd>qm10xd（D-03）；xv/xh V1</dd></div>
      <div><dt>工程格式</dt><dd>自有多文件 JSON 权威；单文件 .forgeui 仅分享（D-06）</dd></div>
      <div><dt>用户代码</dt><dd>forgeui_generated/ 工具区可覆盖；custom/ 再生成不覆盖（D-07）</dd></div>
    </dl>
    <p class="note">
      本产品不兼容 SquareLine / Beken / UIBuilder / LVGL Pro 等他厂工程格式，不使用未授权商标素材。体验对齐
      Beken 工作台信息架构（L1），格式与许可自控。
    </p>
  </div>
</template>

<style scoped>
.page {
  max-width: 640px;
  margin: 0 auto;
  padding: 36px 24px;
}

h1 {
  margin: 0 0 20px;
  font-size: 24px;
}

dl {
  display: grid;
  gap: 12px;
  margin: 0 0 24px;
}

dl > div {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

dt {
  color: var(--muted);
  font-size: 12px;
}

dd {
  margin: 0;
  font-size: 14px;
}

.note {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.55;
}
</style>
