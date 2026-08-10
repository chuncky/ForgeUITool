/** Static AI host rows — always visible; detection only updates installed flags (BK parity). */
export type AiHostMenuRow = {
  id: "cursor" | "codex" | "trae" | "trae-cn";
  label: string;
  installed: boolean;
  launchSupported: boolean;
  exePath?: string;
  customExePath?: string;
  method?: string | null;
  mcpPath?: string;
  skillPath?: string;
};

export const STATIC_AI_HOSTS: AiHostMenuRow[] = [
  { id: "cursor", label: "Cursor", installed: false, launchSupported: true },
  { id: "codex", label: "Codex", installed: false, launchSupported: true },
  { id: "trae", label: "TRAE", installed: false, launchSupported: true },
  { id: "trae-cn", label: "TRAE CN", installed: false, launchSupported: true },
];

/** Merge detection results onto the fixed four-host list (never shrink to empty). */
export function mergeAiHostDetection(
  detected: Array<Partial<AiHostMenuRow> & { id: string }> | null | undefined,
): AiHostMenuRow[] {
  const byId = new Map((detected ?? []).map((h) => [h.id, h]));
  return STATIC_AI_HOSTS.map((seed) => {
    const hit = byId.get(seed.id);
    if (!hit) return { ...seed };
    return {
      ...seed,
      ...hit,
      id: seed.id,
      label: seed.label,
      launchSupported: hit.launchSupported ?? true,
      installed: Boolean(hit.installed),
    };
  });
}
