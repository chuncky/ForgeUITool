import { createRouter, createWebHashHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";
import WorkspaceView from "./views/WorkspaceView.vue";
import SettingsView from "./views/SettingsView.vue";
import DocsView from "./views/DocsView.vue";
import AboutView from "./views/AboutView.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/home" },
    { path: "/home", name: "home", component: HomeView },
    { path: "/workspace", name: "workspace", component: WorkspaceView },
    { path: "/settings", name: "settings", component: SettingsView },
    { path: "/docs", name: "docs", component: DocsView },
    { path: "/about", name: "about", component: AboutView },
  ],
});
