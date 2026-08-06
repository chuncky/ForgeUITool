/** In-memory A2 package descriptor (C `forge_loader_open_mem` v1). */
export interface MemRefDescriptor {
  format: "forgeui-mem-ref";
  root: string;
}

/** Build JSON bytes for `forge_loader_open_mem` (root must point at on-flash A2 layout). */
export function buildMemRefDescriptor(rootPath: string): Buffer {
  const desc: MemRefDescriptor = {
    format: "forgeui-mem-ref",
    root: rootPath.replace(/\\/g, "/"),
  };
  return Buffer.from(JSON.stringify(desc), "utf8");
}

/** Parse mem-ref descriptor from buffer (host-side helper / tests). */
export function parseMemRefDescriptor(buf: Buffer | string): MemRefDescriptor | null {
  try {
    const raw = typeof buf === "string" ? buf : buf.toString("utf8");
    const o = JSON.parse(raw) as Partial<MemRefDescriptor>;
    if (o.format !== "forgeui-mem-ref" || typeof o.root !== "string" || !o.root.trim()) {
      return null;
    }
    return { format: "forgeui-mem-ref", root: o.root.trim() };
  } catch {
    return null;
  }
}
