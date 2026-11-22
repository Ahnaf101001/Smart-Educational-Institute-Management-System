"use client";

// ID card renderer (SRS §7, IDC-07..13). Cards are laid out in real millimetres
// so on-screen preview, PDF and print share the same physical dimensions.
// 10 distinct front designs: 5 for students, 5 for teachers/staff.
import { useEffect, useRef, useState } from "react";

const MM = 96 / 25.4; // CSS px per mm

export function useQrDataUrl(text, color = "#000000") {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!text) { setUrl(null); return undefined; }
    import("qrcode").then((QR) => QR.toDataURL(text, { margin: 0, width: 240, errorCorrectionLevel: "M", color: { dark: color, light: "#ffffff" } }))
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(null));
    return () => { alive = false; };
  }, [text, color]);
  return url;
}

function Qr({ text, size = 13, color }) {
  const url = useQrDataUrl(text, color);
  return (
    <div style={{ width: `${size}mm`, height: `${size}mm`, background: "#fff", padding: "0.6mm", borderRadius: "1mm" }}>
      {url ? <img src={url} alt="QR" style={{ width: "100%", height: "100%", display: "block" }} /> : <div style={{ width: "100%", height: "100%", background: "repeating-linear-gradient(45deg,#ddd 0 2px,#fff 2px 4px)" }} />}
    </div>
  );
}

function Barcode({ value, height = 7, color = "#000", width = 30 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    import("jsbarcode").then(({ default: JsBarcode }) => {
      try {
        JsBarcode(ref.current, String(value), { format: "CODE128", displayValue: false, margin: 0, lineColor: color, height: 40, width: 1.4, background: "transparent" });
      } catch { /* invalid value */ }
    });
  }, [value, color]);
  return <svg ref={ref} style={{ width: `${width}mm`, height: `${height}mm`, display: "block" }} preserveAspectRatio="none" />;
}

function Silhouette({ color = "#94a3b8" }) {
  return (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block", background: "#e2e8f0" }}>
      <circle cx="50" cy="38" r="18" fill={color} />
      <path d="M14 96c4-22 20-32 36-32s32 10 36 32z" fill={color} />
    </svg>
  );
}

function Photo({ src, w, h, radius = "1.5mm", border, shadow, grayscale }) {
  // A broken / missing file falls back to the silhouette so a card never prints an empty box.
  const [failedSrc, setFailedSrc] = useState(null);
  const ok = src && failedSrc !== src;
  return (
    <div style={{ width: `${w}mm`, height: `${h}mm`, borderRadius: radius, overflow: "hidden", border, boxShadow: shadow, flexShrink: 0, background: "#e2e8f0" }}>
      {ok ? (
        <img
          src={src}
          alt=""
          crossOrigin="anonymous"
          onError={() => setFailedSrc(src)}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block", filter: grayscale ? "grayscale(1)" : undefined }}
        />
      ) : <Silhouette />}
    </div>
  );
}

function Logo({ src, size = 8, color = "#fff", bg = "transparent" }) {
  return (
    <div style={{ width: `${size}mm`, height: `${size}mm`, borderRadius: "50%", overflow: "hidden", background: bg, display: "grid", placeItems: "center", flexShrink: 0 }}>
      {src ? <img src={src} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : (
        <svg viewBox="0 0 24 24" style={{ width: "70%", height: "70%" }} fill="none" stroke={color} strokeWidth="1.8"><path d="M3 10 12 4l9 6" /><path d="M5 10v9h14v-9" /><path d="M10 19v-5h4v5" /></svg>
      )}
    </div>
  );
}

// Movable / styleable field wrapper (IDC-09: position, font, size, colour, alignment, spacing).
function F({ id, ctx, children, style }) {
  const { cfg, editable, onOffset, pxPerMm, selected, onSelect } = ctx;
  const off = cfg.offsets?.[id] || { x: 0, y: 0 };
  const fs = cfg.fieldStyles?.[id] || {};
  const start = useRef(null);
  function onPointerDown(e) {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(id);
    start.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
    const move = (ev) => {
      const dx = (ev.clientX - start.current.x) / pxPerMm;
      const dy = (ev.clientY - start.current.y) / pxPerMm;
      onOffset?.(id, { x: Math.round((start.current.ox + dx) * 2) / 2, y: Math.round((start.current.oy + dy) * 2) / 2 });
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        position: "relative",
        transform: off.x || off.y ? `translate(${off.x}mm, ${off.y}mm)` : undefined,
        cursor: editable ? "move" : undefined,
        outline: editable && selected === id ? "0.3mm dashed #2563eb" : editable ? "0.2mm dashed transparent" : undefined,
        ...style,
        ...(fs.fontSize ? { fontSize: `${fs.fontSize}pt` } : {}),
        ...(fs.color ? { color: fs.color } : {}),
        ...(fs.align ? { textAlign: fs.align } : {}),
        ...(fs.letterSpacing !== undefined ? { letterSpacing: `${fs.letterSpacing}pt` } : {}),
        ...(fs.fontWeight ? { fontWeight: fs.fontWeight } : {}),
      }}
    >
      {children}
    </div>
  );
}

function formatDate(v) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Detail rows shown on a card, filtered by the template's field visibility (IDC-08).
export function detailRows(audience, data, fields = {}, card = {}) {
  if (audience === "Student") {
    return [
      ["studentId", "ID", data.id],
      ["className", "Class", data.className],
      ["section", "Section", data.section],
      ["roll", "Roll", data.roll],
      ["session", "Session", data.session],
      ["shift", "Shift", data.shift],
      ["group", "Group", data.group],
      ["dob", "DOB", formatDate(data.dob)],
      ["bloodGroup", "Blood", data.bloodGroup],
      ["guardianPhone", "Guardian", data.guardianPhone],
      ["validity", "Valid till", formatDate(card.validUntil)],
    ].filter(([k, , v]) => fields[k] && v);
  }
  return [
    ["employeeId", "ID", data.id],
    ["department", "Dept.", data.department],
    ["bloodGroup", "Blood", data.bloodGroup],
    ["phone", "Phone", data.phone],
    ["email", "Email", data.email],
    ["joinDate", "Joined", formatDate(data.joinDate)],
    ["validity", "Valid till", formatDate(card.validUntil)],
  ].filter(([k, , v]) => fields[k] && v);
}

function Rows({ rows, ctx, color, labelColor, size = 6, labelWidth = 11, gap = 0.6, divider }) {
  return (
    <F id="details" ctx={ctx}>
      {rows.map(([k, label, value]) => (
        <div key={k} style={{ display: "flex", alignItems: "baseline", gap: "1mm", fontSize: `${size}pt`, lineHeight: 1.25, marginBottom: `${gap}mm`, borderBottom: divider, color }}>
          <span style={{ width: `${labelWidth}mm`, flexShrink: 0, color: labelColor, fontWeight: 600 }}>{label}</span>
          {/* No overflow clipping here: html2canvas cuts glyphs inside overflow:hidden boxes in the PDF. */}
          <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{value}</span>
        </div>
      ))}
    </F>
  );
}

function Names({ data, cfg, ctx, size = 10, color, align = "center", font }) {
  return (
    <>
      <F id="name" ctx={ctx} style={{ fontSize: `${size}pt`, fontWeight: 800, color, textAlign: align, lineHeight: 1.1, fontFamily: font }}>{data.name}</F>
      {cfg.fields?.nameBn && data.nameBn && <F id="nameBn" ctx={ctx} style={{ fontSize: `${size * 0.72}pt`, fontWeight: 600, color, textAlign: align, fontFamily: "'Noto Sans Bengali', sans-serif" }}>{data.nameBn}</F>}
      {cfg.fields?.nameAr && data.nameAr && <F id="nameAr" ctx={ctx} style={{ fontSize: `${size * 0.8}pt`, fontWeight: 600, color, textAlign: align, direction: "rtl", fontFamily: "'Noto Naskh Arabic', 'Amiri', serif" }}>{data.nameAr}</F>}
    </>
  );
}

function IslamicPattern({ color = "#d4af37", opacity = 0.25 }) {
  return (
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity }}>
      <defs>
        <pattern id="star8" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M5 0l1.5 3.5L10 5 6.5 6.5 5 10 3.5 6.5 0 5l3.5-1.5z" fill="none" stroke={color} strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#star8)" />
    </svg>
  );
}

// ------------------------------------------------------------------ front layouts
const FRONTS = {
  // Student · Modern
  aurora: ({ c, d, cfg, ctx, inst, rows, qrText, w }) => (
    <>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "30mm", background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})`, borderBottomLeftRadius: "50% 8mm", borderBottomRightRadius: "50% 8mm" }} />
      <div style={{ position: "relative", padding: "3mm 3mm 0", display: "flex", alignItems: "center", gap: "1.5mm", color: "#fff" }}>
        {cfg.showLogo !== false && <Logo src={inst.logoUrl} size={8} bg="rgba(255,255,255,0.2)" />}
        <F id="institute" ctx={ctx} style={{ fontSize: "6.5pt", fontWeight: 800, lineHeight: 1.1 }}>{inst.name}<div style={{ fontSize: "4.5pt", fontWeight: 500, opacity: 0.9 }}>{inst.address}</div></F>
      </div>
      <F id="title" ctx={ctx} style={{ position: "relative", margin: "1.5mm auto 0", width: "fit-content", background: c.accent, color: "#fff", fontSize: "5.5pt", fontWeight: 800, padding: "0.5mm 3mm", borderRadius: "3mm", letterSpacing: "0.4pt" }}>{cfg.title}</F>
      <div style={{ position: "relative", display: "flex", justifyContent: "center", marginTop: "2mm" }}>
        {cfg.fields?.photo !== false && <F id="photo" ctx={ctx}><Photo src={d.photoUrl} w={21} h={21} radius="50%" border={`0.8mm solid #fff`} shadow="0 1mm 2mm rgba(0,0,0,0.2)" /></F>}
      </div>
      <div style={{ position: "relative", padding: "1.5mm 4mm 0", textAlign: "center" }}>
        <Names data={d} cfg={cfg} ctx={ctx} size={10} color={c.text} />
      </div>
      <div style={{ position: "relative", padding: "1.5mm 5mm 0" }}><Rows rows={rows} ctx={ctx} color={c.text} labelColor={c.primary} size={5.8} /></div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "15mm", background: `linear-gradient(90deg, ${c.primary}, ${c.secondary})`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 3mm", color: "#fff" }}>
        <div style={{ fontSize: "5pt", lineHeight: 1.3 }}><div style={{ opacity: 0.85 }}>Card No.</div><div style={{ fontWeight: 800, fontSize: "6pt" }}>{ctx.card.cardNumber}</div></div>
        {cfg.qr !== false && <F id="qr" ctx={ctx}><Qr text={qrText} size={11.5} /></F>}
      </div>
    </>
  ),
  // Student · Classic
  heritage: ({ c, d, cfg, ctx, inst, rows, qrText }) => (
    <>
      <div style={{ position: "absolute", inset: "1.5mm", border: `0.5mm solid ${c.accent}`, borderRadius: "2mm" }} />
      <div style={{ position: "absolute", inset: "2.4mm", border: `0.2mm solid ${c.primary}`, borderRadius: "1.5mm" }} />
      <div style={{ position: "relative", padding: "4mm 4mm 0", textAlign: "center", fontFamily: cfg.fontFamily }}>
        {cfg.showLogo !== false && <div style={{ display: "flex", justifyContent: "center" }}><Logo src={inst.logoUrl} size={10} color={c.primary} bg="#fff" /></div>}
        <F id="institute" ctx={ctx} style={{ fontSize: "7pt", fontWeight: 800, color: c.primary, marginTop: "1mm", lineHeight: 1.1 }}>{inst.name}</F>
        <div style={{ fontSize: "4.5pt", color: c.text, opacity: 0.8 }}>{inst.address}</div>
      </div>
      <F id="title" ctx={ctx} style={{ position: "relative", margin: "1.5mm 5mm 0", background: c.primary, color: c.accent, fontSize: "6pt", fontWeight: 800, textAlign: "center", padding: "0.6mm", letterSpacing: "1pt", fontFamily: cfg.fontFamily }}>{cfg.title}</F>
      <div style={{ position: "relative", display: "flex", justifyContent: "center", marginTop: "2mm" }}>
        {cfg.fields?.photo !== false && <F id="photo" ctx={ctx}><Photo src={d.photoUrl} w={19} h={23} radius="0.5mm" border={`0.6mm solid ${c.accent}`} /></F>}
      </div>
      <div style={{ position: "relative", padding: "1.5mm 5mm 0", textAlign: "center" }}><Names data={d} cfg={cfg} ctx={ctx} size={9.5} color={c.primary} font={cfg.fontFamily} /></div>
      <div style={{ position: "relative", padding: "1.2mm 6mm 0", fontFamily: cfg.fontFamily }}><Rows rows={rows} ctx={ctx} color={c.text} labelColor={c.secondary} size={5.6} divider={`0.1mm dotted ${c.accent}`} /></div>
      <div style={{ position: "absolute", bottom: "4mm", left: "5mm", right: "5mm", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        {cfg.qr !== false ? <F id="qr" ctx={ctx}><Qr text={qrText} size={10} color={c.primary} /></F> : <span />}
        <div style={{ textAlign: "center", fontSize: "4.5pt", color: c.text }}>
          {inst.signatureUrl ? <img src={inst.signatureUrl} alt="" crossOrigin="anonymous" style={{ height: "5mm" }} /> : <div style={{ height: "5mm" }} />}
          <div style={{ borderTop: `0.2mm solid ${c.text}`, paddingTop: "0.3mm" }}>{inst.principalTitle || "Principal"}</div>
        </div>
      </div>
    </>
  ),
  // Student · Minimal (landscape)
  slate: ({ c, d, cfg, ctx, inst, rows, qrText }) => (
    <>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "4mm", background: c.primary }} />
      <div style={{ position: "absolute", top: 0, left: "4mm", right: 0, height: "0.8mm", background: c.secondary }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "1.5mm", padding: "3mm 4mm 0 7mm" }}>
        {cfg.showLogo !== false && <Logo src={inst.logoUrl} size={7} color={c.primary} bg="#f1f5f9" />}
        <F id="institute" ctx={ctx} style={{ fontSize: "7pt", fontWeight: 800, color: c.text, lineHeight: 1.1 }}>{inst.name}</F>
        <F id="title" ctx={ctx} style={{ marginLeft: "auto", fontSize: "5.5pt", fontWeight: 700, color: c.primary, textTransform: "uppercase", letterSpacing: "1pt" }}>{cfg.title}</F>
      </div>
      <div style={{ position: "relative", display: "flex", gap: "3mm", padding: "3mm 4mm 0 7mm" }}>
        {cfg.fields?.photo !== false && <F id="photo" ctx={ctx}><Photo src={d.photoUrl} w={20} h={24} radius="1mm" /></F>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Names data={d} cfg={cfg} ctx={ctx} size={10} color={c.text} align="left" />
          <div style={{ height: "0.3mm", background: c.primary, width: "10mm", margin: "1mm 0 1.2mm" }} />
          <Rows rows={rows} ctx={ctx} color={c.text} labelColor="#64748b" size={5.6} labelWidth={10} />
        </div>
      </div>
      <div style={{ position: "absolute", right: "3.5mm", bottom: "3mm", display: "flex", alignItems: "flex-end", gap: "2mm" }}>
        <div style={{ fontSize: "4.5pt", color: "#64748b", textAlign: "right" }}>{ctx.card.cardNumber}</div>
        {cfg.qr !== false && <F id="qr" ctx={ctx}><Qr text={qrText} size={11} /></F>}
      </div>
      {cfg.barcode && <div style={{ position: "absolute", left: "7mm", bottom: "3mm" }}><Barcode value={ctx.card.cardNumber} width={28} height={5} color={c.text} /></div>}
    </>
  ),
  // Student · Colorful (kids)
  rainbow: ({ c, d, cfg, ctx, inst, rows, qrText }) => {
    const dots = [[4, 6, 6, c.accent], [44, 4, 8, c.secondary], [48, 34, 5, "#22c55e"], [2, 44, 7, "#38bdf8"], [40, 72, 9, c.accent], [6, 76, 5, c.primary], [26, 2, 4, "#f97316"]];
    return (
      <>
        {dots.map(([x, y, s, col], i) => <div key={i} style={{ position: "absolute", left: `${x}mm`, top: `${y}mm`, width: `${s}mm`, height: `${s}mm`, borderRadius: "50%", background: col, opacity: 0.35 }} />)}
        <div style={{ position: "relative", padding: "3mm 3mm 0", textAlign: "center" }}>
          {cfg.showLogo !== false && <div style={{ display: "flex", justifyContent: "center" }}><Logo src={inst.logoUrl} size={8} color={c.primary} bg="#fff" /></div>}
          <F id="institute" ctx={ctx} style={{ fontSize: "6.5pt", fontWeight: 900, color: c.secondary, lineHeight: 1.1, marginTop: "0.8mm" }}>{inst.name}</F>
          <F id="title" ctx={ctx} style={{ margin: "1mm auto 0", width: "fit-content", fontSize: "5.5pt", fontWeight: 900, color: "#fff", background: `linear-gradient(90deg, ${c.primary}, ${c.secondary})`, padding: "0.5mm 3mm", borderRadius: "3mm" }}>{cfg.title}</F>
        </div>
        <div style={{ position: "relative", display: "flex", justifyContent: "center", marginTop: "2mm" }}>
          {cfg.fields?.photo !== false && (
            <F id="photo" ctx={ctx}>
              <div style={{ padding: "0.9mm", borderRadius: "5mm", background: `conic-gradient(${c.primary}, ${c.accent}, #22c55e, #38bdf8, ${c.secondary}, ${c.primary})` }}>
                <Photo src={d.photoUrl} w={21} h={23} radius="4mm" border="0.6mm solid #fff" />
              </div>
            </F>
          )}
        </div>
        <div style={{ position: "relative", padding: "1.5mm 4mm 0", textAlign: "center" }}><Names data={d} cfg={cfg} ctx={ctx} size={10.5} color={c.text} /></div>
        <F id="details" ctx={ctx} style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: "0.8mm", justifyContent: "center", padding: "1.5mm 3mm 0" }}>
          {rows.map(([k, label, value], i) => (
            <span key={k} style={{ fontSize: "5.2pt", fontWeight: 700, padding: "0.4mm 1.6mm", borderRadius: "2mm", background: [c.primary, c.secondary, "#22c55e", "#0ea5e9", "#f97316"][i % 5], color: "#fff" }}>{label}: {value}</span>
          ))}
        </F>
        <div style={{ position: "absolute", bottom: "3mm", left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          {cfg.qr !== false && <F id="qr" ctx={ctx}><Qr text={qrText} size={11} color={c.text} /></F>}
        </div>
      </>
    );
  },
  // Student · Formal (Madrasa)
  crescent: ({ c, d, cfg, ctx, inst, rows, qrText }) => (
    <>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "26mm", background: `linear-gradient(160deg, ${c.primary}, ${c.secondary})`, overflow: "hidden" }}><IslamicPattern color={c.accent} /></div>
      <div style={{ position: "relative", padding: "3mm 3mm 0", textAlign: "center", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1.5mm" }}>
          {cfg.showLogo !== false && <Logo src={inst.logoUrl} size={8} bg="rgba(255,255,255,0.15)" />}
          <svg viewBox="0 0 24 24" style={{ width: "5mm", height: "5mm" }} fill={c.accent}><path d="M14.5 2a10 10 0 1 0 7.4 16.7A8 8 0 1 1 14.5 2z" /></svg>
        </div>
        {inst.nameAr && <div style={{ fontSize: "6pt", direction: "rtl", fontFamily: "'Noto Naskh Arabic', serif", color: c.accent }}>{inst.nameAr}</div>}
        <F id="institute" ctx={ctx} style={{ fontSize: "6.5pt", fontWeight: 800, lineHeight: 1.1 }}>{inst.name}</F>
        <F id="title" ctx={ctx} style={{ fontSize: "5pt", fontWeight: 700, color: c.accent, marginTop: "0.6mm", letterSpacing: "0.4pt" }}>{cfg.title}</F>
      </div>
      <div style={{ position: "relative", display: "flex", justifyContent: "center", marginTop: "1.5mm" }}>
        {cfg.fields?.photo !== false && <F id="photo" ctx={ctx}><Photo src={d.photoUrl} w={19} h={23} radius="9.5mm 9.5mm 1mm 1mm" border={`0.7mm solid ${c.accent}`} /></F>}
      </div>
      <div style={{ position: "relative", padding: "1.5mm 4mm 0", textAlign: "center" }}><Names data={d} cfg={cfg} ctx={ctx} size={9.5} color={c.primary} /></div>
      <div style={{ position: "relative", padding: "1.2mm 5.5mm 0" }}><Rows rows={rows} ctx={ctx} color={c.text} labelColor={c.secondary} size={5.6} /></div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "3mm", background: c.accent }} />
      <div style={{ position: "absolute", bottom: "4.5mm", right: "4mm" }}>{cfg.qr !== false && <F id="qr" ctx={ctx}><Qr text={qrText} size={10.5} color={c.primary} /></F>}</div>
      <div style={{ position: "absolute", bottom: "5mm", left: "4mm", fontSize: "4.8pt", color: c.primary, fontWeight: 700 }}>{ctx.card.cardNumber}</div>
    </>
  ),
  // Teacher · Modern
  executive: ({ c, d, cfg, ctx, inst, rows, qrText }) => (
    <>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "13mm", background: `linear-gradient(180deg, ${c.primary}, ${c.secondary})` }} />
      <div style={{ position: "absolute", top: "3mm", left: "2.5mm" }}>{cfg.showLogo !== false && <Logo src={inst.logoUrl} size={8} bg="rgba(255,255,255,0.15)" />}</div>
      <F id="title" ctx={ctx} style={{ position: "absolute", left: "3.5mm", bottom: "6mm", writingMode: "vertical-rl", transform: "rotate(180deg)", color: "#fff", fontSize: "11pt", fontWeight: 900, letterSpacing: "3pt", opacity: 0.9 }}>{cfg.title}</F>
      <div style={{ position: "relative", marginLeft: "15mm", padding: "3mm 3mm 0 0" }}>
        <F id="institute" ctx={ctx} style={{ fontSize: "6.2pt", fontWeight: 800, color: c.primary, lineHeight: 1.1 }}>{inst.name}</F>
        <div style={{ fontSize: "4.3pt", color: "#64748b" }}>{inst.address}</div>
        <div style={{ marginTop: "2.5mm" }}>{cfg.fields?.photo !== false && <F id="photo" ctx={ctx}><Photo src={d.photoUrl} w={22} h={26} radius="2mm" shadow="0 1mm 2.5mm rgba(11,31,77,0.25)" /></F>}</div>
        <div style={{ marginTop: "2mm" }}><Names data={d} cfg={cfg} ctx={ctx} size={9.5} color={c.text} align="left" /></div>
        {cfg.fields?.designation !== false && d.designation && <F id="designation" ctx={ctx} style={{ marginTop: "0.8mm", display: "inline-block", fontSize: "5.5pt", fontWeight: 800, color: "#fff", background: c.accent, padding: "0.4mm 2mm", borderRadius: "1mm" }}>{d.designation}</F>}
        <div style={{ marginTop: "1.5mm" }}><Rows rows={rows} ctx={ctx} color={c.text} labelColor={c.secondary} size={5.5} labelWidth={10} /></div>
      </div>
      <div style={{ position: "absolute", right: "3mm", bottom: "3mm" }}>{cfg.qr !== false && <F id="qr" ctx={ctx}><Qr text={qrText} size={11} color={c.primary} /></F>}</div>
      <div style={{ position: "absolute", left: "15mm", bottom: "3.5mm", fontSize: "4.8pt", fontWeight: 700, color: c.primary }}>{ctx.card.cardNumber}</div>
    </>
  ),
  // Teacher · Classic (landscape)
  faculty: ({ c, d, cfg, ctx, inst, rows, qrText }) => (
    <>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "12mm", background: c.primary }} />
      <div style={{ position: "absolute", top: "12mm", left: 0, right: 0, height: "0.8mm", background: c.accent }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "2mm", padding: "2mm 3mm 0", color: "#fff", fontFamily: cfg.fontFamily }}>
        {cfg.showLogo !== false && <Logo src={inst.logoUrl} size={8} bg="rgba(255,255,255,0.15)" />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <F id="institute" ctx={ctx} style={{ fontSize: "7pt", fontWeight: 800, lineHeight: 1.1 }}>{inst.name}</F>
          <F id="title" ctx={ctx} style={{ fontSize: "5pt", letterSpacing: "1pt", color: c.secondary }}>{cfg.title}</F>
        </div>
      </div>
      <div style={{ position: "relative", display: "flex", gap: "3mm", padding: "4mm 3mm 0", fontFamily: cfg.fontFamily }}>
        {cfg.fields?.photo !== false && <F id="photo" ctx={ctx}><Photo src={d.photoUrl} w={20} h={24} radius="0" border={`0.5mm solid ${c.primary}`} /></F>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Names data={d} cfg={cfg} ctx={ctx} size={9.5} color={c.primary} align="left" font={cfg.fontFamily} />
          {d.designation && <F id="designation" ctx={ctx} style={{ fontSize: "6pt", fontWeight: 700, color: c.accent, margin: "0.4mm 0 1mm" }}>{d.designation}</F>}
          <Rows rows={rows} ctx={ctx} color={c.text} labelColor="#475569" size={5.5} labelWidth={10} divider="0.1mm solid #e2e8f0" />
        </div>
      </div>
      <div style={{ position: "absolute", left: "3mm", bottom: "2.5mm", right: "16mm", display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: "4.5pt", color: c.text }}>
        <span style={{ fontWeight: 700 }}>{ctx.card.cardNumber}</span>
        <div style={{ textAlign: "center" }}>
          {inst.signatureUrl ? <img src={inst.signatureUrl} alt="" crossOrigin="anonymous" style={{ height: "4mm" }} /> : <div style={{ height: "4mm" }} />}
          <div style={{ borderTop: `0.2mm solid ${c.text}`, padding: "0.2mm 2mm 0" }}>{inst.principalTitle || "Principal"}</div>
        </div>
      </div>
      <div style={{ position: "absolute", right: "3mm", bottom: "2.5mm" }}>{cfg.qr !== false && <F id="qr" ctx={ctx}><Qr text={qrText} size={11} color={c.primary} /></F>}</div>
    </>
  ),
  // Teacher · Minimal
  mono: ({ c, d, cfg, ctx, inst, rows, qrText }) => (
    <>
      <div style={{ position: "relative", padding: "4mm 4mm 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <F id="institute" ctx={ctx} style={{ fontSize: "6pt", fontWeight: 800, color: c.text, lineHeight: 1.1, maxWidth: "36mm" }}>{inst.name}</F>
        {cfg.showLogo !== false && <Logo src={inst.logoUrl} size={7} color={c.text} bg="#f4f4f5" />}
      </div>
      <div style={{ position: "relative", margin: "2mm 4mm 0", height: "0.15mm", background: c.text }} />
      <F id="title" ctx={ctx} style={{ position: "relative", padding: "1mm 4mm 0", fontSize: "5pt", letterSpacing: "2pt", color: c.secondary, fontWeight: 700 }}>{cfg.title}</F>
      <div style={{ position: "relative", padding: "3mm 4mm 0" }}>{cfg.fields?.photo !== false && <F id="photo" ctx={ctx}><Photo src={d.photoUrl} w={22} h={26} radius="0" /></F>}</div>
      <div style={{ position: "relative", padding: "2.5mm 4mm 0" }}><Names data={d} cfg={cfg} ctx={ctx} size={11} color={c.text} align="left" /></div>
      {d.designation && <F id="designation" ctx={ctx} style={{ position: "relative", padding: "0.5mm 4mm 0", fontSize: "6pt", color: c.secondary }}>{d.designation}</F>}
      <div style={{ position: "relative", padding: "2mm 4mm 0" }}><Rows rows={rows} ctx={ctx} color={c.text} labelColor={c.secondary} size={5.5} labelWidth={10} divider={`0.1mm solid #e5e7eb`} /></div>
      <div style={{ position: "absolute", left: "4mm", right: "4mm", bottom: "3.5mm", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: "4.5pt", color: c.secondary, letterSpacing: "0.5pt" }}>{ctx.card.cardNumber}</div>
        {cfg.qr !== false && <F id="qr" ctx={ctx}><Qr text={qrText} size={10} color={c.text} /></F>}
      </div>
    </>
  ),
  // Teacher · Colorful (landscape)
  prism: ({ c, d, cfg, ctx, inst, rows, qrText }) => (
    <>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "34mm", background: c.primary, clipPath: "polygon(0 0, 100% 0, 70% 100%, 0 100%)" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "30mm", background: c.secondary, clipPath: "polygon(0 0, 65% 0, 30% 100%, 0 100%)", opacity: 0.9 }} />
      <div style={{ position: "absolute", bottom: 0, right: 0, width: "30mm", height: "6mm", background: c.accent, clipPath: "polygon(15% 0, 100% 0, 100% 100%, 0 100%)" }} />
      <div style={{ position: "absolute", top: "3mm", left: "3mm" }}>{cfg.showLogo !== false && <Logo src={inst.logoUrl} size={7.5} bg="rgba(255,255,255,0.2)" />}</div>
      <div style={{ position: "absolute", top: "13mm", left: "4mm" }}>{cfg.fields?.photo !== false && <F id="photo" ctx={ctx}><Photo src={d.photoUrl} w={20} h={20} radius="50%" border="0.8mm solid #fff" shadow="0 1mm 2mm rgba(0,0,0,0.25)" /></F>}</div>
      <div style={{ position: "relative", marginLeft: "33mm", padding: "3mm 3mm 0 0" }}>
        <F id="institute" ctx={ctx} style={{ fontSize: "6.2pt", fontWeight: 800, color: c.text, lineHeight: 1.1 }}>{inst.name}</F>
        <F id="title" ctx={ctx} style={{ fontSize: "5pt", fontWeight: 800, color: c.primary, letterSpacing: "1.5pt", marginTop: "0.5mm" }}>{cfg.title}</F>
        <div style={{ marginTop: "2mm" }}><Names data={d} cfg={cfg} ctx={ctx} size={9.5} color={c.text} align="left" /></div>
        {d.designation && <F id="designation" ctx={ctx} style={{ fontSize: "5.8pt", fontWeight: 700, color: c.secondary, margin: "0.3mm 0 1.2mm" }}>{d.designation}</F>}
        <Rows rows={rows} ctx={ctx} color={c.text} labelColor="#6b7280" size={5.3} labelWidth={9} />
      </div>
      <div style={{ position: "absolute", right: "3mm", top: "3mm" }}>{cfg.qr !== false && <F id="qr" ctx={ctx}><Qr text={qrText} size={10} color={c.text} /></F>}</div>
      <div style={{ position: "absolute", right: "3mm", bottom: "1.3mm", fontSize: "4.8pt", fontWeight: 800, color: "#fff" }}>{ctx.card.cardNumber}</div>
    </>
  ),
  // Teacher · Formal
  royal: ({ c, d, cfg, ctx, inst, rows, qrText }) => (
    <>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "31mm", background: `linear-gradient(180deg, ${c.primary}, ${c.secondary})` }} />
      <div style={{ position: "absolute", top: "29mm", left: 0, right: 0, height: "1mm", background: c.accent }} />
      <div style={{ position: "relative", textAlign: "center", padding: "3mm 3mm 0", color: "#fff", fontFamily: cfg.fontFamily }}>
        {cfg.showLogo !== false && <div style={{ display: "flex", justifyContent: "center" }}><Logo src={inst.logoUrl} size={9} bg="rgba(255,255,255,0.12)" /></div>}
        <F id="institute" ctx={ctx} style={{ fontSize: "6.8pt", fontWeight: 800, lineHeight: 1.1, marginTop: "0.8mm" }}>{inst.name}</F>
        <F id="title" ctx={ctx} style={{ margin: "1mm auto 0", width: "fit-content", fontSize: "5pt", fontWeight: 800, letterSpacing: "1pt", color: c.primary, background: c.accent, padding: "0.4mm 3mm", clipPath: "polygon(4% 0, 96% 0, 100% 50%, 96% 100%, 4% 100%, 0 50%)" }}>{cfg.title}</F>
      </div>
      <div style={{ position: "relative", display: "flex", justifyContent: "center", marginTop: "1.5mm" }}>
        {cfg.fields?.photo !== false && <F id="photo" ctx={ctx}><Photo src={d.photoUrl} w={21} h={21} radius="50%" border={`0.9mm solid ${c.accent}`} shadow="0 0 0 0.5mm #fff" /></F>}
      </div>
      <div style={{ position: "relative", padding: "1.5mm 4mm 0", textAlign: "center" }}><Names data={d} cfg={cfg} ctx={ctx} size={9.5} color={c.primary} font={cfg.fontFamily} /></div>
      {d.designation && <F id="designation" ctx={ctx} style={{ position: "relative", textAlign: "center", fontSize: "6pt", fontWeight: 800, color: c.accent, marginTop: "0.3mm" }}>{d.designation}</F>}
      <div style={{ position: "relative", padding: "1.5mm 6mm 0", fontFamily: cfg.fontFamily }}><Rows rows={rows} ctx={ctx} color={c.text} labelColor={c.secondary} size={5.5} /></div>
      <div style={{ position: "absolute", bottom: "3mm", left: "4mm", right: "4mm", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        {cfg.qr !== false ? <F id="qr" ctx={ctx}><Qr text={qrText} size={10} color={c.primary} /></F> : <span />}
        <div style={{ textAlign: "center", fontSize: "4.5pt", color: c.text }}>
          {inst.signatureUrl ? <img src={inst.signatureUrl} alt="" crossOrigin="anonymous" style={{ height: "4.5mm" }} /> : <div style={{ height: "4.5mm" }} />}
          <div style={{ borderTop: `0.2mm solid ${c.accent}`, padding: "0.2mm 2mm 0" }}>{inst.principalTitle || "Principal"}</div>
        </div>
      </div>
    </>
  ),
};

// ------------------------------------------------------------------ back side (IDC-10/11)
function Back({ c, b, ctx, inst, landscape, qrText, fontFamily }) {
  const rules = (b.rules || []).filter(Boolean);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", fontFamily }}>
      <div style={{ background: `linear-gradient(90deg, ${c.primary}, ${c.secondary})`, color: "#fff", padding: "2mm 3mm", display: "flex", alignItems: "center", gap: "1.5mm" }}>
        <Logo src={inst.logoUrl} size={6} bg="rgba(255,255,255,0.18)" />
        <div style={{ fontSize: "6pt", fontWeight: 800, lineHeight: 1.1 }}>{inst.name}</div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: landscape ? "row" : "column", gap: "2mm", padding: "2mm 3mm" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {b.showRules !== false && rules.length > 0 && (
            <F id="rules" ctx={ctx}>
              <div style={{ fontSize: "5.5pt", fontWeight: 800, color: c.primary, marginBottom: "0.6mm" }}>Instructions</div>
              <ol style={{ margin: 0, paddingLeft: "3mm", fontSize: "4.8pt", lineHeight: 1.35, color: c.text }}>{rules.map((r, i) => <li key={i}>{r}</li>)}</ol>
            </F>
          )}
          {b.showEmergency !== false && (inst.emergencyContact || inst.phone) && (
            <F id="emergency" ctx={ctx} style={{ marginTop: "1.2mm", fontSize: "5pt", color: c.text }}>
              <b style={{ color: c.primary }}>Emergency:</b> {inst.emergencyContact || inst.phone}
            </F>
          )}
          {b.showAddress !== false && inst.address && (
            <F id="address" ctx={ctx} style={{ marginTop: "0.8mm", fontSize: "4.8pt", color: c.text, lineHeight: 1.3 }}>
              <b style={{ color: c.primary }}>Address:</b> {inst.address}{inst.phone ? ` · ${inst.phone}` : ""}{inst.website ? ` · ${inst.website}` : ""}
            </F>
          )}
          {b.showReturn !== false && b.returnText && (
            <F id="return" ctx={ctx} style={{ marginTop: "1mm", fontSize: "4.6pt", fontStyle: "italic", color: "#475569" }}>{b.returnText}</F>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: landscape ? "column" : "row", alignItems: "center", justifyContent: "space-between", gap: "1.5mm" }}>
          {b.qr !== false && <F id="qr" ctx={ctx}><Qr text={qrText} size={landscape ? 14 : 12} color={c.primary} /></F>}
          {b.showSignature !== false && (
            <F id="signature" ctx={ctx} style={{ textAlign: "center", fontSize: "4.5pt", color: c.text }}>
              {inst.signatureUrl ? <img src={inst.signatureUrl} alt="" crossOrigin="anonymous" style={{ height: "5mm" }} /> : <div style={{ height: "5mm", width: "16mm" }} />}
              {inst.sealUrl && <img src={inst.sealUrl} alt="" crossOrigin="anonymous" style={{ height: "6mm", position: "absolute", marginLeft: "-6mm", opacity: 0.6 }} />}
              <div style={{ borderTop: `0.2mm solid ${c.text}`, paddingTop: "0.3mm" }}>{b.signatureLabel || "Authorized Signature"}</div>
            </F>
          )}
        </div>
      </div>
      <div style={{ padding: "0 3mm 2mm", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2mm" }}>
        {b.barcode !== false ? <Barcode value={ctx.card.cardNumber || "0000"} width={landscape ? 40 : 30} height={5} color={c.text} /> : <span />}
        <span style={{ fontSize: "4.8pt", fontWeight: 700, color: c.primary }}>{ctx.card.cardNumber}</span>
      </div>
    </div>
  );
}

export const LAYOUTS = Object.keys(FRONTS);

// Single card face. `scale` only affects on-screen size (transform), never the mm layout.
export function CardFace({
  template, side = "front", data = {}, institute = {}, card = {}, scale = 1, editable = false,
  onOffset, selected, onSelect, verifyBase,
}) {
  const front = template?.frontConfig || {};
  const back = template?.backConfig || {};
  const cfg = side === "front" ? front : back;
  const colors = (side === "front" ? front.colors : back.colors) || front.colors || { primary: "#1d4ed8", secondary: "#06b6d4", accent: "#f59e0b", text: "#0f172a", background: "#fff" };
  const widthMm = Number(template?.widthMm || 53.98);
  const heightMm = Number(template?.heightMm || 85.6);
  const landscape = (template?.orientation || "portrait") === "landscape";
  const base = verifyBase || (typeof window !== "undefined" ? window.location.origin : "");
  const qrText = card.qrToken ? `${base}/verify/card/${card.qrToken}` : `${base}/verify/card/SAMPLE`;
  const ctx = { cfg, editable, onOffset, pxPerMm: MM * scale, selected, onSelect, card: { cardNumber: card.cardNumber || "SC-26-000123", validUntil: card.validUntil } };
  const rows = detailRows(template?.audience === "Student" ? "Student" : "Teacher", data, front.fields || {}, card);
  const Layout = FRONTS[front.layout] || FRONTS.aurora;
  const fontScale = Number(front.fontScale || 1);

  return (
    <div style={{ width: `${widthMm * MM * scale}px`, height: `${heightMm * MM * scale}px`, flexShrink: 0 }}>
      <div
        className="id-card-face"
        style={{
          width: `${widthMm}mm`, height: `${heightMm}mm`, transform: `scale(${scale})`, transformOrigin: "top left",
          position: "relative", overflow: "hidden", borderRadius: "3mm", background: colors.background || "#fff",
          boxShadow: "0 0 0 0.2mm rgba(15,23,42,0.12)", fontFamily: front.fontFamily && front.fontFamily !== "Inter" ? `${front.fontFamily}, 'Noto Sans Bengali', serif` : "Inter, 'Noto Sans Bengali', sans-serif",
          color: colors.text, textAlign: front.textAlign || "center", fontSize: `${fontScale * 100}%`,
          WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
        }}
      >
        {side === "front"
          ? <Layout c={colors} d={data} cfg={front} ctx={ctx} inst={institute} rows={rows} qrText={qrText} w={widthMm} />
          : <Back c={colors} b={back} ctx={ctx} inst={institute} landscape={landscape} qrText={qrText} fontFamily={front.fontFamily} />}
      </div>
    </div>
  );
}

export const SAMPLE_STUDENT = {
  id: "STU-2026-0142", name: "Ayesha Rahman", nameBn: "আয়েশা রহমান", nameAr: "عائشة رحمن", className: "Class 9",
  section: "A", roll: "07", session: "2026", shift: "Morning", group: "Science", dob: "2011-03-14", bloodGroup: "B+", guardianPhone: "01712-345678",
};
export const SAMPLE_TEACHER = {
  id: "TCH-1024", name: "Md. Abdur Rahim", nameBn: "মোঃ আব্দুর রহিম", designation: "Senior Teacher", department: "Science",
  bloodGroup: "O+", phone: "01811-223344", email: "rahim@school.edu", joinDate: "2015-01-10",
};
