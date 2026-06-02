import { useState, useRef, useCallback } from "react";
import axios from "axios";
import MatrixBackground from "../components/MatrixBackground";

// ── Charset options shown in UI (must match backend DENSITY_MAPS keys) ──────
const CHARSETS  = ["complex", "simple", "blocks", "binary"];
const COLOR_MODES = ["mono", "color"];

// ── Tiny reusable components ─────────────────────────────────────────────────
function GlowButton({ onClick, disabled, children, small }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "#0a1a0a" : "#0d1f0d",
        color: disabled ? "#2d6a2d" : "#39ff14",
        border: `1px solid ${disabled ? "#1a3d1a" : "#39ff14"}`,
        padding: small ? "8px 16px" : "11px 22px",
        cursor: disabled ? "not-allowed" : "pointer",
        borderRadius: 6,
        boxShadow: disabled ? "none" : "0 0 8px #39ff14, 0 0 20px rgba(57,255,20,0.3)",
        fontWeight: "bold",
        fontFamily: "'Courier New', monospace",
        fontSize: small ? 11 : 13,
        letterSpacing: "0.08em",
        transition: "box-shadow 0.2s, background 0.2s",
        margin: "4px",
      }}
    >
      {children}
    </button>
  );
}

function ChipGroup({ label, options, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 10, color: "#4ade80", letterSpacing: "0.15em", opacity: 0.8 }}>{label}</span>
      <div style={{ display: "flex", gap: 4 }}>
        {options.map(opt => (
          <button key={opt} onClick={() => onChange(opt)} style={{
            padding: "4px 10px",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            border: `1px solid ${value === opt ? "#39ff14" : "#1a3d1a"}`,
            background: value === opt ? "#39ff14" : "transparent",
            color: value === opt ? "#000" : "#39ff14",
            cursor: "pointer",
            borderRadius: 3,
            fontFamily: "'Courier New', monospace",
            transition: "all 0.15s",
          }}>{opt}</button>
        ))}
      </div>
    </div>
  );
}

function SliderControl({ label, value, min, max, step = 0.1, onChange, format }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 130 }}>
      <label style={{ fontSize: 10, color: "#4ade80", letterSpacing: "0.1em", opacity: 0.8 }}>
        {label}: <span style={{ color: "#86efac" }}>{format ? format(value) : value}</span>
      </label>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ accentColor: "#39ff14", cursor: "pointer", width: "100%" }}
      />
    </div>
  );
}

// ── Canvas renderer for colored ASCII ────────────────────────────────────────
function renderColorAscii(rows, fontSize, canvasRef) {
  if (!rows?.length || !canvasRef.current) return;
  const canvas = canvasRef.current;
  const ctx = canvas.getContext("2d");
  const charW = fontSize * 0.6;
  const charH = fontSize;
  canvas.width  = rows[0].length * charW;
  canvas.height = rows.length    * charH;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
  ctx.textBaseline = "top";
  rows.forEach((row, y) => {
    row.forEach(([char, r, g, b], x) => {
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillText(char, x * charW, y * charH);
    });
  });
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ImageToAscii() {
  const [file,       setFile]       = useState(null);
  const [preview,    setPreview]    = useState(null);
  const [ascii,      setAscii]      = useState("");        // mono result
  const [colorRows,  setColorRows]  = useState(null);      // color result
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  // Controls
  const [width,      setWidth]      = useState(120);
  const [contrast,   setContrast]   = useState(1.5);
  const [brightness, setBrightness] = useState(1.0);
  const [charset,    setCharset]    = useState("complex");
  const [colorMode,  setColorMode]  = useState("mono");
  const [faceMode,   setFaceMode]   = useState(false);

  const canvasRef   = useRef(null);
  const fontSize    = 10; // px used for canvas render

  // ── Conversion ─────────────────────────────────────────────────────────────
  const convertImage = useCallback(async () => {
    if (!file) return;
    setError("");
    setAscii("");
    setColorRows(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("file",       file);
    formData.append("width",      faceMode ? 120 : width);
    formData.append("face_mode",  faceMode);
    formData.append("contrast",   contrast);
    formData.append("brightness", brightness);
    formData.append("charset",    charset);
    formData.append("color_mode", colorMode);

    try {
      const res = await axios.post("https://asciiverse-api.onrender.com/convert-image", formData);

      if (colorMode === "color") {
        setColorRows(res.data.ascii_color);
        // draw on next tick so canvas is in DOM
        setTimeout(() => renderColorAscii(res.data.ascii_color, fontSize, canvasRef), 0);
      } else {
        setAscii(res.data.ascii);
      }
    } catch (err) {
      console.error(err);
      setError("Conversion failed — is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [file, faceMode, width, contrast, brightness, charset, colorMode]);

  // ── Download helpers ───────────────────────────────────────────────────────
  const copyAscii = () => {
    navigator.clipboard.writeText(ascii);
  };

  const downloadTxt = () => {
    const blob = new Blob([ascii], { type: "text/plain" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = "ascii_art.txt";
    a.click();
  };

  const downloadPng = () => {
    if (!canvasRef.current) return;
    const a    = document.createElement("a");
    a.href     = canvasRef.current.toDataURL("image/png");
    a.download = "ascii_art.png";
    a.click();
  };

  const hasResult = ascii || colorRows;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh",
      background: "#000",
      color: "#fff",
      padding: "30px 20px",
      textAlign: "center",
      fontFamily: "'Courier New', monospace",
      boxSizing: "border-box",
    }}>
      <MatrixBackground />

      {/* Title */}
      <h1 style={{
        fontSize: "clamp(2rem, 6vw, 4rem)",
        color: "#39ff14",
        textShadow: "0 0 10px #39ff14, 0 0 25px #39ff14, 0 0 50px #39ff14",
        marginBottom: 4,
        letterSpacing: "0.15em",
      }}>ASCIIVERSE</h1>
      <p style={{ color: "#39ff14", opacity: 0.6, fontSize: 13, letterSpacing: "0.2em", marginBottom: 36 }}>
        TRANSFORM REALITY INTO ASCII
      </p>

      {/* File picker */}
      <label style={{
        display: "inline-block",
        padding: "10px 20px",
        border: "1px solid #39ff14",
        borderRadius: 6,
        color: "#39ff14",
        cursor: "pointer",
        fontSize: 12,
        letterSpacing: "0.1em",
        boxShadow: "0 0 8px rgba(57,255,20,0.3)",
        marginBottom: 20,
      }}>
        ▲ UPLOAD IMAGE
        <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
          const f = e.target.files[0];
          if (!f) return;
          setFile(f);
          setPreview(URL.createObjectURL(f));
          setAscii(""); setColorRows(null); setError("");
        }} />
      </label>

      {/* Preview + controls */}
      {preview && (
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <img src={preview} alt="preview" style={{
            maxWidth: 320,
            borderRadius: 10,
            border: "2px solid #39ff14",
            boxShadow: "0 0 15px #39ff14, 0 0 35px rgba(57,255,20,0.3)",
            marginBottom: 28,
          }} />

          {/* Controls grid */}
          <div style={{
            background: "rgba(0,20,0,0.7)",
            border: "1px solid rgba(57,255,20,0.2)",
            borderRadius: 10,
            padding: "20px 24px",
            display: "flex",
            flexWrap: "wrap",
            gap: 20,
            justifyContent: "center",
            alignItems: "flex-end",
            marginBottom: 20,
            backdropFilter: "blur(6px)",
          }}>
            <SliderControl label="WIDTH" value={width} min={60} max={250} step={5}
              format={v => `${v} chars`} onChange={setWidth} />
            <SliderControl label="CONTRAST" value={contrast} min={0.5} max={3.0}
              format={v => v.toFixed(1)} onChange={setContrast} />
            <SliderControl label="BRIGHTNESS" value={brightness} min={0.4} max={2.0}
              format={v => v.toFixed(1)} onChange={setBrightness} />
            <ChipGroup label="CHARSET"    options={CHARSETS}    value={charset}   onChange={setCharset} />
            <ChipGroup label="COLOR MODE" options={COLOR_MODES} value={colorMode} onChange={setColorMode} />

            {/* Face mode toggle */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "#4ade80", letterSpacing: "0.15em", opacity: 0.8 }}>FACE MODE</span>
              <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "#39ff14", fontSize: 12 }}>
                <input type="checkbox" checked={faceMode} onChange={e => setFaceMode(e.target.checked)}
                  style={{ accentColor: "#39ff14", width: 14, height: 14 }} />
                Auto-crop face
              </label>
            </div>
          </div>

          <GlowButton onClick={convertImage} disabled={loading}>
            {loading ? "CONVERTING…" : "▶ CONVERT TO ASCII"}
          </GlowButton>

          {error && (
            <p style={{ color: "#ff4444", marginTop: 12, fontSize: 12 }}>{error}</p>
          )}
        </div>
      )}

      {/* Results */}
      {hasResult && (
        <div style={{ marginTop: 40 }}>
          <h2 style={{ color: "#39ff14", letterSpacing: "0.2em", marginBottom: 16, fontSize: 16 }}>
            ◆ ASCII OUTPUT
          </h2>

          {/* Action buttons */}
          <div style={{ marginBottom: 20 }}>
            {colorMode === "mono" && (
              <>
                <GlowButton small onClick={copyAscii}>⎘ COPY</GlowButton>
                <GlowButton small onClick={downloadTxt}>↓ TXT</GlowButton>
              </>
            )}
            {colorMode === "color" && (
              <GlowButton small onClick={downloadPng}>↓ PNG</GlowButton>
            )}
          </div>

          {/* Mono text display */}
          {colorMode === "mono" && ascii && (
            <div style={{ overflowX: "auto", padding: "0 10px" }}>
              <pre style={{
                background: "#000",
                color: "#7fff7f",
                padding: "18px 20px",
                overflow: "auto",
                whiteSpace: "pre",
                fontSize: 10,
                lineHeight: "10px",
                fontFamily: "'Courier New', monospace",
                display: "inline-block",
                margin: "auto",
                border: "2px solid #39ff14",
                borderRadius: 10,
                backgroundImage: "repeating-linear-gradient(0deg, rgba(57,255,20,0.04) 0px, rgba(57,255,20,0.04) 1px, transparent 1px, transparent 3px)",
                boxShadow: "0 0 12px #39ff14, 0 0 30px rgba(57,255,20,0.25)",
                textShadow: "0 0 4px #39ff14",
                maxWidth: "90vw",
              }}>
                {ascii}
              </pre>
            </div>
          )}

          {/* Color canvas display */}
          {colorMode === "color" && colorRows && (
            <div style={{ overflowX: "auto", padding: "0 10px" }}>
              <canvas ref={canvasRef} style={{
                border: "2px solid #39ff14",
                borderRadius: 10,
                boxShadow: "0 0 12px #39ff14, 0 0 30px rgba(57,255,20,0.25)",
                maxWidth: "90vw",
                display: "block",
                margin: "auto",
              }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
