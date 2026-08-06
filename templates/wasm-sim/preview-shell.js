/** Lightweight canvas renderer for preview-ir.json (V2: replace with Emscripten LVGL). */
(function () {
  const canvas = document.getElementById("canvas");
  const status = document.getElementById("status");
  const screenSelect = document.getElementById("screen-select");
  const ctx = canvas.getContext("2d");
  /** @type {{ display?: { width?: number; height?: number }; defaultScreen?: string; lvglVersion?: string; screens?: Array<{ id: string; name?: string; tree?: object }> } | null} */
  let ir = null;

  function colorForType(type) {
    const map = {
      button: "#3d5afe",
      label: "#455a64",
      image: "#6a1b9a",
      panel: "#263238",
      container: "#37474f",
      screen: "#1e1e22",
    };
    return map[type] || "#546e7a";
  }

  function drawNode(node, ox, oy) {
    if (!node || node.hidden) return;
    if (!node.frame) {
      if (Array.isArray(node.children)) {
        for (const c of node.children) drawNode(c, ox, oy);
      }
      return;
    }
    const f = node.frame;
    const x = ox + (f.x ?? 0);
    const y = oy + (f.y ?? 0);
    const w = f.w ?? 40;
    const h = f.h ?? 24;
    const rot = Number(f.rotation ?? 0);

    ctx.save();
    if (rot) {
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.translate(cx, cy);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    ctx.globalAlpha = node.type === "screen" ? 1 : 0.72;
    ctx.fillStyle = colorForType(node.type);
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (node.type !== "screen") {
      ctx.fillStyle = "#fff";
      ctx.font = "11px system-ui,sans-serif";
      const label = node.name || node.type || "?";
      ctx.fillText(label.length > 18 ? `${label.slice(0, 16)}…` : label, x + 4, y + 14);
    }
    ctx.restore();

    if (Array.isArray(node.children)) {
      for (const c of node.children) drawNode(c, x, y);
    }
  }

  function renderScreen(screenId) {
    if (!ir) return;
    const w = ir.display?.width ?? 480;
    const h = ir.display?.height ?? 320;
    canvas.width = w;
    canvas.height = h;
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, w, h);
    const screen = ir.screens?.find((s) => s.id === screenId) ?? ir.screens?.[0];
    if (screen?.tree) drawNode(screen.tree, 0, 0);
    status.textContent = `${screen?.name ?? screen?.id ?? "?"} · ${ir.screens?.length ?? 0} screen(s) · ${w}×${h} · lvgl ${ir.lvglVersion ?? "?"}`;
  }

  function populateScreens() {
    if (!ir || !screenSelect) return;
    screenSelect.innerHTML = "";
    for (const s of ir.screens ?? []) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${s.name ?? s.id} (${s.id})`;
      screenSelect.appendChild(opt);
    }
    screenSelect.disabled = !(ir.screens?.length > 1);
    screenSelect.value = ir.defaultScreen ?? ir.screens?.[0]?.id ?? "";
    screenSelect.onchange = () => renderScreen(screenSelect.value);
  }

  fetch("preview-ir.json")
    .then((r) => {
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    })
    .then((data) => {
      ir = data;
      populateScreens();
      renderScreen(ir.defaultScreen ?? ir.screens?.[0]?.id);
    })
    .catch((err) => {
      status.textContent = "Failed: " + err.message;
    });

  /** FR-063: poll hot-reload.stamp written by host after generate / model change */
  let lastStamp = "";
  function applyIr(data) {
    ir = data;
    const keep = screenSelect?.value;
    populateScreens();
    const next = keep && ir.screens?.some((s) => s.id === keep) ? keep : ir.defaultScreen ?? ir.screens?.[0]?.id;
    if (screenSelect && next) screenSelect.value = next;
    renderScreen(next);
    status.textContent = `${status.textContent} · hot-reload ${ir.generatedAt ?? ""}`;
  }
  setInterval(() => {
    fetch("hot-reload.stamp?" + Date.now())
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((text) => {
        const t = text.trim();
        if (!t || t === lastStamp) return;
        lastStamp = t;
        return fetch("preview-ir.json?" + Date.now()).then((r) => r.json()).then(applyIr);
      })
      .catch(() => {});
  }, 800);
})();
