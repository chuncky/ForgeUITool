/**
 * CJS bootstrap so pack/load failures are always logged next to the exe.
 * package.json "main" points here; it dynamically imports the ESM main.
 */
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const logPath = path.join(path.dirname(process.execPath), "forgeui-boot.log");

function log(line) {
  try {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${line}\n`, "utf8");
  } catch {
    /* ignore */
  }
}

process.on("uncaughtException", (err) => {
  log(`uncaughtException: ${err?.stack || err}`);
});
process.on("unhandledRejection", (err) => {
  log(`unhandledRejection: ${err?.stack || err}`);
});

log(`bootstrap start exec=${process.execPath}`);
log(`resourcesPath=${process.resourcesPath}`);
log(`dirname=${__dirname}`);

const mainUrl = pathToFileURL(path.join(__dirname, "main.mjs")).href;
log(`import ${mainUrl}`);

import(mainUrl).then(() => {
  log("main.mjs imported OK");
}).catch((err) => {
  log(`main.mjs import FAILED: ${err?.stack || err}`);
  try {
    const { dialog, app } = require("electron");
    dialog.showErrorBox(
      "ForgeUI Kit 启动失败",
      String(err?.stack || err),
    );
    app?.quit?.();
  } catch (e) {
    log(`dialog failed: ${e?.stack || e}`);
  }
});
