import type { ProjectDocument } from "./types.js";

export interface ProjectVariable {
  id: string;
  name: string;
  type: "int" | "bool" | "string";
  defaultValue?: string | number | boolean;
}

export function normalizeVariables(project: ProjectDocument): ProjectVariable[] {
  const raw = project.variables;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is ProjectVariable => !!v && typeof v === "object" && typeof v.id === "string")
    .map((v) => ({
      id: v.id,
      name: typeof v.name === "string" ? v.name : v.id,
      type: v.type === "bool" || v.type === "string" ? v.type : "int",
      defaultValue: v.defaultValue,
    }));
}

export function createVariable(
  existing: ProjectVariable[],
  opts: { name?: string; type?: ProjectVariable["type"] } = {},
): ProjectVariable {
  const n = existing.length + 1;
  const id = `var_${n}`;
  return {
    id: existing.some((e) => e.id === id) ? `var_${Date.now().toString(36)}` : id,
    name: opts.name ?? `Variable ${n}`,
    type: opts.type ?? "int",
    defaultValue: opts.type === "bool" ? false : opts.type === "string" ? "" : 0,
  };
}
