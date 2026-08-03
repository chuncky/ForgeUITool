import { spawn } from "node:child_process";

export interface ProcessResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export interface RunProcessOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  maxBuffer?: number;
  /** Called for each complete stdout/stderr line as it arrives (FR-061a streaming logs). */
  onLine?: (line: string, stream: "stdout" | "stderr") => void;
}

/** Non-blocking subprocess runner — keeps Electron main event loop responsive (FR-061a). */
export function runProcessAsync(
  command: string,
  args: string[],
  opts: RunProcessOptions = {},
): Promise<ProcessResult> {
  const maxBuffer = opts.maxBuffer ?? 10 * 1024 * 1024;

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env,
      windowsHide: true,
    });

    let stdoutPending = "";
    let stderrPending = "";

    const feedStream = (
      chunk: Buffer,
      stream: "stdout" | "stderr",
      acc: { text: string; pending: string },
    ) => {
      const piece = chunk.toString();
      acc.text += piece;
      if (acc.text.length > maxBuffer) acc.text = acc.text.slice(-maxBuffer);

      acc.pending += piece;
      const parts = acc.pending.split(/\r?\n/);
      acc.pending = parts.pop() ?? "";
      if (opts.onLine) {
        for (const line of parts) {
          if (line.length) opts.onLine(line, stream);
        }
      }
    };

    const stdoutAcc = { text: stdout, pending: stdoutPending };
    const stderrAcc = { text: stderr, pending: stderrPending };

    child.stdout?.on("data", (chunk: Buffer) => {
      feedStream(chunk, "stdout", stdoutAcc);
      stdout = stdoutAcc.text;
      stdoutPending = stdoutAcc.pending;
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      feedStream(chunk, "stderr", stderrAcc);
      stderr = stderrAcc.text;
      stderrPending = stderrAcc.pending;
    });

    child.on("error", reject);
    child.on("close", (status) => {
      if (opts.onLine) {
        for (const pending of [stdoutAcc.pending, stderrAcc.pending]) {
          if (pending.trim()) opts.onLine(pending, "stderr");
        }
      }
      resolve({ status, stdout: stdoutAcc.text, stderr: stderrAcc.text });
    });
  });
}
