import fs from "node:fs";
import path from "node:path";

/** Beken-compatible Windows preview toolchain under product xos-package. */
export function resolveWinToolsRoot(repoRoot: string): string | null {
  const candidates = [
    path.join(repoRoot, "xos-package/tools/win"),
    path.join(repoRoot, "tools/win"),
    path.join(repoRoot, "ref/beken/lvgl_ui_designer_2.0.3/resources/tools/win"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "w64devkit/bin/gcc.exe"))) return c;
    if (fs.existsSync(path.join(c, "cmake/bin/cmake.exe"))) return c;
    if (fs.existsSync(path.join(c, "sdl2/lib/cmake/SDL2/sdl2-config.cmake"))) return c;
  }
  return null;
}

export function winToolPath(repoRoot: string, ...parts: string[]): string | null {
  const root = resolveWinToolsRoot(repoRoot);
  if (!root) return null;
  const p = path.join(root, ...parts);
  return fs.existsSync(p) ? p : null;
}
