import { useEffect, useRef, useState, useCallback } from "react";

// --- Density Maps (from the GitHub project) ---
const DENSITY_MAPS = {
  complex: " .^!*<&%$#@",
  simple:  " .:-=+*#%@",
  blocks:  " ░▒▓█",
  binary:  " 01",
};

function getAsciiChar(brightness, densityKey) {
  const map = DENSITY_MAPS[densityKey];
  const index = Math.floor((brightness / 255) * (map.length - 1));
  return map[index];
}

// ── Tiny icon components (inline SVG, no dependency) ──────────────────────
const IconCamera = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

const IconFullscreen = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
    <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
  </svg>
);

// ── Slider control ─────────────────────────────────────────────────────────
function Slider({ label, value, min, max, step = 0.1, onChange, format }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 110 }}>
      <label style={{ fontSize: 10, letterSpacing: "0.12em", color: "#4ade80", opacity: 0.8 }}>
        {label}: <span style={{ color: "#86efac" }}>{format ? format(value) : value}</span>
      </label>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ accentColor: "#22c55e", height: 3, cursor: "pointer", width: "100%" }}
      />
    </div>
  );
}

// ── Mode button group ──────────────────────────────────────────────────────
function ButtonGroup({ label, options, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 10, letterSpacing: "0.12em", color: "#4ade80", opacity: 0.8 }}>{label}</span>
      <div style={{ display: "flex", gap: 3 }}>
        {options.map(opt => (
          <button key={opt} onClick={() => onChange(opt)} style={{
            padding: "3px 8px",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            border: `1px solid ${value === opt ? "#22c55e" : "#14532d"}`,
            background: value === opt ? "#22c55e" : "transparent",
            color: value === opt ? "#000" : "#4ade80",
            cursor: "pointer",
            borderRadius: 2,
            transition: "all 0.15s",
            fontFamily: "'Courier New', monospace",
          }}>{opt}</button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function LiveAsciiCamera() {
  const videoRef        = useRef(null);
  const hiddenCanvasRef = useRef(null);   // small canvas for pixel sampling
  const displayCanvasRef= useRef(null);   // full-size output canvas
  const prevFrameRef    = useRef(null);   // Float32Array for temporal smoothing
  const rafRef          = useRef(null);
  const containerRef    = useRef(null);

  const [error, setError]     = useState(null);
  const [options, setOptions] = useState({
    fontSize:   11,
    brightness: 1.0,
    contrast:   1.2,
    colorMode:  "matrix",   // matrix | bw | retro | color
    density:    "complex",  // complex | simple | blocks | binary
  });
  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; }, [options]);

  // helper to patch one option key
  const set = useCallback((key, val) =>
    setOptions(prev => ({ ...prev, [key]: val })), []);

  // ── Camera startup ───────────────────────────────────────────────────────
  useEffect(() => {
    let stream;
    navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
    }).then(s => {
      stream = s;
      const v = videoRef.current;
      v.srcObject = s;
      v.play().catch(console.error);
    }).catch(() => setError("Camera access denied — please allow permissions."));

    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  // ── Canvas resize ────────────────────────────────────────────────────────
  useEffect(() => {
    const fit = () => {
      const c = displayCanvasRef.current;
      const p = c?.parentElement;
      if (!c || !p) return;
      c.width  = p.clientWidth;
      c.height = p.clientHeight;
    };
    window.addEventListener("resize", fit);
    fit();
    return () => window.removeEventListener("resize", fit);
  }, []);

  // ── Render loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const loop = () => {
      const video   = videoRef.current;
      const hidden  = hiddenCanvasRef.current;
      const display = displayCanvasRef.current;

      if (!video || !hidden || !display || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const ctx = display.getContext("2d", { alpha: false });
      const hCtx = hidden.getContext("2d",  { willReadFrequently: true });
      if (!ctx || !hCtx) { rafRef.current = requestAnimationFrame(loop); return; }

      const { fontSize, brightness, contrast, colorMode, density } = optionsRef.current;

      const charH = fontSize;
      const charW = charH * 0.6;
      const cols  = Math.floor(display.width  / charW);
      const rows  = Math.floor(display.height / charH);
      if (cols <= 0 || rows <= 0) { rafRef.current = requestAnimationFrame(loop); return; }

      if (hidden.width !== cols || hidden.height !== rows) {
        hidden.width  = cols;
        hidden.height = rows;
        prevFrameRef.current = null;
      }

      // Draw video mirrored into the small hidden canvas
      hCtx.save();
      hCtx.translate(cols, 0);
      hCtx.scale(-1, 1);
      hCtx.drawImage(video, 0, 0, cols, rows);
      hCtx.restore();

      const frameData = hCtx.getImageData(0, 0, cols, rows);
      const data = frameData.data;

      // Temporal smoothing (reduces flickery character swaps)
      const n = data.length;
      if (!prevFrameRef.current || prevFrameRef.current.length !== n) {
        prevFrameRef.current = new Float32Array(data);
      }
      const prev   = prevFrameRef.current;
      const inertia = 0.72;
      for (let i = 0; i < n; i++) {
        const v = prev[i] + (data[i] - prev[i]) * (1 - inertia);
        prev[i] = v;
        data[i] = v;
      }

      // Contrast factor
      const cf = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

      // Clear
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, display.width, display.height);

      ctx.font = `${fontSize}px 'Courier New', monospace`;
      ctx.textBaseline = "top";

      if (colorMode === "color") {
        // Per-character colored ASCII
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const off = (y * cols + x) * 4;
            const r = data[off], g = data[off+1], b = data[off+2];
            let lum = 0.2126*r + 0.7152*g + 0.0722*b;
            lum = Math.max(0, Math.min(255, (cf * (lum - 128) + 128) * brightness));
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillText(getAsciiChar(lum, density), x * charW, y * charH);
          }
        }
      } else {
        // Single-colour modes — batch per row for performance
        ctx.fillStyle =
          colorMode === "matrix" ? "#00ff41" :
          colorMode === "retro"  ? "#ffb000" : "#ffffff";

        // Glow for matrix / retro
        if (colorMode === "matrix" || colorMode === "retro") {
          ctx.shadowColor = colorMode === "matrix" ? "#00ff41" : "#ffb000";
          ctx.shadowBlur  = 6;
        } else {
          ctx.shadowBlur = 0;
        }

        for (let y = 0; y < rows; y++) {
          let row = "";
          for (let x = 0; x < cols; x++) {
            const off = (y * cols + x) * 4;
            const r = data[off], g = data[off+1], b = data[off+2];
            let lum = 0.2126*r + 0.7152*g + 0.0722*b;
            lum = Math.max(0, Math.min(255, (cf * (lum - 128) + 128) * brightness));
            row += getAsciiChar(lum, density);
          }
          ctx.fillText(row, 0, y * charH);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // options accessed via ref — no restart needed

  // ── Screenshot ───────────────────────────────────────────────────────────
  const saveSnapshot = () => {
    const url  = displayCanvasRef.current?.toDataURL("image/png");
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `ascii_${Date.now()}.png`;
    a.click();
  };

  const goFullscreen = () => document.documentElement.requestFullscreen?.();

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{
      minHeight: "100vh",
      background: "#050505",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Courier New', monospace",
      overflow: "hidden",
    }}>
      {/* ── HUD Header ── */}
      <header style={{
        position: "absolute", top: 0, left: 0, width: "100%", zIndex: 20,
        padding: "12px 20px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)",
        pointerEvents: "none",
        boxSizing: "border-box",
      }}>
        <div style={{ color: "#22c55e", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: "bold", letterSpacing: "0.2em", textShadow: "0 0 12px #22c55e" }}>
            ASCII<span style={{ opacity: 0.5, fontSize: 11, marginLeft: 4 }}>v2.0</span>
          </span>
        </div>
        <div style={{ color: "#166534", fontSize: 10, letterSpacing: "0.12em", display: "flex", gap: 16 }}>
          <span>SYS: ONLINE</span>
          <span>CAM: ACTIVE</span>
          <span style={{ animation: "blink 1.2s step-start infinite", color: "#4ade80" }}>● REC</span>
        </div>
      </header>

      {/* ── Canvas area ── */}
      <main style={{ flexGrow: 1, position: "relative" }}>
        {error && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#f87171", zIndex: 50, fontSize: 14, letterSpacing: "0.08em",
          }}>
            {error}
          </div>
        )}

        {/* Hidden video — must NOT be display:none in some browsers */}
        <video ref={videoRef} playsInline autoPlay muted
          style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1 }} />

        <canvas ref={hiddenCanvasRef} style={{ display: "none" }} />
        <canvas ref={displayCanvasRef} style={{ display: "block", width: "100%", height: "100%" }} />

        {/* CRT scanline overlay */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5,
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.18) 1px, rgba(0,0,0,0.18) 2px)",
          opacity: 0.6,
        }} />

        {/* Floating action buttons */}
        <div style={{
          position: "absolute", bottom: 90, left: "50%", transform: "translateX(-50%)",
          display: "flex", gap: 20, alignItems: "center", zIndex: 30,
        }}>
          <button onClick={saveSnapshot} title="Save snapshot" style={{
            background: "rgba(0,0,0,0.6)", color: "#4ade80",
            border: "1px solid rgba(74,222,128,0.4)", borderRadius: "50%",
            width: 46, height: 46, cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(8px)",
            transition: "box-shadow 0.2s, background 0.2s",
            boxShadow: "0 0 8px rgba(74,222,128,0.2)",
          }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 18px rgba(74,222,128,0.5)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = "0 0 8px rgba(74,222,128,0.2)"}
          >
            <IconCamera />
          </button>

          <button onClick={goFullscreen} title="Fullscreen" style={{
            background: "rgba(0,0,0,0.6)", color: "#4ade80",
            border: "1px solid rgba(74,222,128,0.4)", borderRadius: "50%",
            width: 40, height: 40, cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(8px)", transition: "box-shadow 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 14px rgba(74,222,128,0.4)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
          >
            <IconFullscreen />
          </button>
        </div>
      </main>

      {/* ── Control Panel ── */}
      <footer style={{
        background: "rgba(0,0,0,0.85)",
        borderTop: "1px solid rgba(34,197,94,0.2)",
        backdropFilter: "blur(10px)",
        padding: "12px 20px",
        zIndex: 30,
      }}>
        <div style={{
          maxWidth: 900, margin: "0 auto",
          display: "flex", flexWrap: "wrap", gap: 20,
          alignItems: "flex-end", justifyContent: "center",
        }}>
          <Slider label="FONT SIZE" value={options.fontSize} min={7} max={20} step={1}
            format={v => `${v}px`} onChange={v => set("fontSize", v)} />
          <Slider label="GAIN" value={options.brightness} min={0.5} max={2.5} step={0.1}
            format={v => v.toFixed(1)} onChange={v => set("brightness", v)} />
          <Slider label="CONTRAST" value={options.contrast} min={0.5} max={3.0} step={0.1}
            format={v => v.toFixed(1)} onChange={v => set("contrast", v)} />
          <ButtonGroup label="MODE" value={options.colorMode} onChange={v => set("colorMode", v)}
            options={["matrix", "retro", "bw", "color"]} />
          <ButtonGroup label="CHARSET" value={options.density} onChange={v => set("density", v)}
            options={["complex", "simple", "blocks", "binary"]} />
        </div>
      </footer>

      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        input[type=range] { width: 100%; }
      `}</style>
    </div>
  );
}
