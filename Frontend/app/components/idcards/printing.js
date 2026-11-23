"use client";

import { CardFace } from "./CardRenderer";

export const PAGE_SIZES = {
  A4: { w: 210, h: 297, label: "A4 (210 × 297 mm)" },
  Letter: { w: 215.9, h: 279.4, label: "Letter (8.5 × 11 in)" },
  CR80: { w: null, h: null, label: "PVC card printer (one card per page)" },
};

// How many cards fit on a page.
export function computeLayout(template, layout) {
  const cw = Number(template.widthMm);
  const ch = Number(template.heightMm);
  if (layout.pageSize === "CR80") {
    return { pageW: cw, pageH: ch, cols: 1, rows: 1, perPage: 1, cw, ch, margin: 0, gap: 0, offsetX: 0, offsetY: 0 };
  }
  const base = PAGE_SIZES[layout.pageSize] || PAGE_SIZES.A4;
  const pageW = layout.pageOrientation === "landscape" ? base.h : base.w;
  const pageH = layout.pageOrientation === "landscape" ? base.w : base.h;
  const margin = Number(layout.marginMm ?? 10);
  const gap = Number(layout.gapMm ?? 4);
  const cols = Math.max(1, Math.floor((pageW - 2 * margin + gap) / (cw + gap)));
  const rows = Math.max(1, Math.floor((pageH - 2 * margin + gap) / (ch + gap)));
  const usedW = cols * cw + (cols - 1) * gap;
  const usedH = rows * ch + (rows - 1) * gap;
  return {
    pageW, pageH, cols, rows, perPage: cols * rows, cw, ch, margin, gap,
    offsetX: (pageW - usedW) / 2, offsetY: Math.max(margin, (pageH - usedH) / 2),
  };
}

// Builds page descriptors; back pages mirror columns so duplex printing aligns.
export function buildPages(cards, template, layout) {
  const L = computeLayout(template, layout);
  const pages = [];
  for (let i = 0; i < cards.length; i += L.perPage) {
    const chunk = cards.slice(i, i + L.perPage);
    const slot = (idx, mirror) => {
      const r = Math.floor(idx / L.cols);
      let c = idx % L.cols;
      if (mirror) c = L.cols - 1 - c;
      return { x: L.offsetX + c * (L.cw + L.gap), y: L.offsetY + r * (L.ch + L.gap) };
    };
    pages.push({ side: "front", items: chunk.map((card, idx) => ({ card, ...slot(idx, false) })) });
    if (layout.includeBack) pages.push({ side: "back", items: chunk.map((card, idx) => ({ card, ...slot(idx, true) })) });
  }
  return { pages, L };
}

function CropMarks({ x, y, w, h }) {
  const len = 3;
  const off = 1;
  const s = { position: "absolute", background: "#000" };
  return (
    <>
      {[[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([cx, cy], i) => (
        <div key={i}>
          <div style={{ ...s, left: `${cx - (i % 2 === 0 ? len + off : -off)}mm`, top: `${cy}mm`, width: `${len}mm`, height: "0.15mm" }} />
          <div style={{ ...s, left: `${cx}mm`, top: `${cy - (i < 2 ? len + off : -off)}mm`, width: "0.15mm", height: `${len}mm` }} />
        </div>
      ))}
    </>
  );
}

// Printable sheets at true physical size (used for preview, browser print and PDF capture).
export function PrintSheets({ cards, template, layout, institute, preview = false, previewScale = 0.6 }) {
  const { pages, L } = buildPages(cards, template, layout);
  return (
    <div className="print-area" style={{ display: "flex", flexDirection: "column", alignItems: preview ? "center" : "flex-start", gap: preview ? "16px" : 0 }}>
      {pages.map((page, pi) => (
        <div key={pi} style={preview ? { width: `${L.pageW * 3.7795 * previewScale}px`, height: `${L.pageH * 3.7795 * previewScale}px` } : undefined}>
          <div
            className="print-page"
            data-page={pi}
            style={{
              width: `${L.pageW}mm`, height: `${L.pageH}mm`, position: "relative", background: "#fff", overflow: "hidden",
              pageBreakAfter: "always", breakAfter: "page",
              transform: preview ? `scale(${previewScale})` : undefined, transformOrigin: "top left",
              boxShadow: preview ? "0 4px 18px rgba(15,23,42,0.15)" : undefined,
            }}
          >
            {preview && <div style={{ position: "absolute", top: "2mm", right: "3mm", fontSize: "8pt", color: "#94a3b8" }}>Page {pi + 1} · {page.side}</div>}
            {page.items.map(({ card, x, y }) => (
              <div key={`${card.id}-${page.side}`} style={{ position: "absolute", left: `${x}mm`, top: `${y}mm` }}>
                <div data-card-face={`${card.id}:${page.side}`}>
                  <CardFace template={template} side={page.side} data={card.data || card.snapshot || {}} institute={institute} card={card} />
                </div>
                {layout.cropMarks && layout.pageSize !== "CR80" && <CropMarks x={0} y={0} w={L.cw} h={L.ch} />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

async function waitForImages(root) {
  const imgs = [...root.querySelectorAll("img")];
  await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; }))));
  await new Promise((r) => setTimeout(r, 400));
}

// Generates a PDF where every card is placed at its exact mm position.
export async function generateCardsPdf(rootEl, { cards, template, layout, fileName = "id-cards.pdf", onProgress }) {
  const [{ jsPDF }, html2canvas] = await Promise.all([import("jspdf"), import("html2canvas").then((m) => m.default)]);
  await waitForImages(rootEl);
  const { pages, L } = buildPages(cards, template, layout);
  const doc = new jsPDF({ unit: "mm", format: [L.pageW, L.pageH], orientation: L.pageW > L.pageH ? "landscape" : "portrait", compress: true });
  let done = 0;
  const total = pages.reduce((s, p) => s + p.items.length, 0);
  for (const [pi, page] of pages.entries()) {
    if (pi > 0) doc.addPage([L.pageW, L.pageH], L.pageW > L.pageH ? "landscape" : "portrait");
    for (const item of page.items) {
      const el = rootEl.querySelector(`[data-card-face="${item.card.id}:${page.side}"] .id-card-face`);
      if (!el) continue;
      const canvas = await html2canvas(el, { scale: 4, useCORS: true, backgroundColor: null, logging: false });
      doc.addImage(canvas.toDataURL("image/png"), "PNG", item.x, item.y, L.cw, L.ch, undefined, "FAST");
      if (layout.cropMarks && layout.pageSize !== "CR80") {
        doc.setLineWidth(0.1);
        const marks = [[item.x, item.y], [item.x + L.cw, item.y], [item.x, item.y + L.ch], [item.x + L.cw, item.y + L.ch]];
        marks.forEach(([x, y], i) => {
          const dx = i % 2 === 0 ? -1 : 1;
          const dy = i < 2 ? -1 : 1;
          doc.line(x + dx * 1, y, x + dx * 4, y);
          doc.line(x, y + dy * 1, x, y + dy * 4);
        });
      }
      done += 1;
      onProgress?.(done, total);
    }
  }
  doc.save(fileName);
  return { pages: pages.length };
}

export function printSheets() {
  document.body.classList.add("printing-cards");
  const cleanup = () => { document.body.classList.remove("printing-cards"); window.removeEventListener("afterprint", cleanup); };
  window.addEventListener("afterprint", cleanup);
  setTimeout(() => window.print(), 300);
}
