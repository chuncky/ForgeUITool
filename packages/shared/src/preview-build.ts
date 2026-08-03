import fs from "node:fs";
import path from "node:path";

/** Drop CMake cache so the next build reconfigures; keep lvgl_build/*.o for incremental speed. */
export function softCleanPreviewBuildOut(outDir: string): void {
  if (!fs.existsSync(outDir)) return;
  for (const name of ["CMakeCache.txt", "CMakeFiles"]) {
    const target = path.join(outDir, name);
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
  }
  for (const rel of [
    "forgeui_preview.exe",
    "Release/forgeui_preview.exe",
    "Debug/forgeui_preview.exe",
    "forgeui_preview",
  ]) {
    const target = path.join(outDir, rel);
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
  }
}
