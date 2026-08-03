import { FigmaImporter } from "./figma.js";
import { ForgeuiBundleImporter } from "./bundle.js";
import type { Importer } from "./types.js";

const registry: Importer[] = [new ForgeuiBundleImporter(), new FigmaImporter()];

export function listImporters(): Importer[] {
  return [...registry];
}

export function getImporter(id: string): Importer | undefined {
  return registry.find((i) => i.id === id);
}
