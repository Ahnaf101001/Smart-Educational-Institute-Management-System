"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Download, Printer } from "lucide-react";
import { idCardsApi } from "../../lib/api";
import { can, useUser } from "../../lib/access";
import { Button, Field, Input, Modal, Select, useToast } from "../ui/kit";
import { PAGE_SIZES, PrintSheets, computeLayout, generateCardsPdf, printSheets } from "./printing";

export default function PrintPreview({ open, onClose, job, template, cards, institute, onStatusChange }) {
  const { user } = useUser();
  const toast = useToast();
  const hiddenRef = useRef(null);
  const [layout, setLayout] = useState({
    pageSize: "A4", pageOrientation: "portrait", marginMm: 10, gapMm: 4, cropMarks: true, includeBack: true,
    ...(job?.filters?.layout || {}),
  });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const L = useMemo(() => (template ? computeLayout(template, layout) : null), [template, layout]);
  const blocked = job?.error === "Awaiting print approval";

  if (!open || !template) return null;
  const set = (k, v) => setLayout((cur) => ({ ...cur, [k]: v }));

  async function updateStatus(status, extra) {
    if (!job?.id) return;
    try {
      await idCardsApi.jobStatus(job.id, status, extra);
      onStatusChange?.(status);
    } catch (e) {
      toast.error(e);
    }
  }

  async function downloadPdf() {
    setBusy(true);
    setProgress({ done: 0, total: cards.length * (layout.includeBack ? 2 : 1) });
    try {
      await updateStatus("Processing");
      const fileName = `${job?.id || "id-cards"}-${template.name.replace(/\s+/g, "_")}.pdf`;
      await generateCardsPdf(hiddenRef.current, { cards, template, layout, fileName, onProgress: (done, total) => setProgress({ done, total }) });
      await updateStatus("Ready", { fileName });
      toast.success("PDF generated. Print at 100% scale (Actual size).");
    } catch (e) {
      await updateStatus("Failed", { error: e.message });
      toast.error(`PDF generation failed: ${e.message}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function browserPrint() {
    printSheets();
  }

  return (
    <Modal open={open} onClose={onClose} width="max-w-6xl" title={`Print preview – ${template.name} (v${template.version || 1})`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {job?.id && can(user, "idcards", "print") && <Button variant="success" disabled={blocked} onClick={() => updateStatus("Printed").then(() => toast.success("Marked as printed"))}>Mark printed</Button>}
          <Button variant="secondary" icon={Printer} disabled={blocked} onClick={browserPrint}>Print</Button>
          <Button icon={Download} loading={busy} disabled={blocked} onClick={downloadPdf}>
            {progress ? `Rendering ${progress.done}/${progress.total}` : "Download PDF"}
          </Button>
        </>
      )}>
      {blocked && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle size={18} /> This print job is awaiting approval. Printing is enabled after a principal/admin approves it.</div>
      )}
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <Field label="Page size"><Select value={layout.pageSize} onChange={(e) => set("pageSize", e.target.value)} options={Object.entries(PAGE_SIZES).map(([k, v]) => ({ value: k, label: v.label }))} /></Field>
          {layout.pageSize !== "CR80" && (
            <>
              <Field label="Page orientation"><Select value={layout.pageOrientation} onChange={(e) => set("pageOrientation", e.target.value)} options={["portrait", "landscape"]} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Margin (mm)"><Input type="number" min="0" max="40" value={layout.marginMm} onChange={(e) => set("marginMm", Number(e.target.value))} /></Field>
                <Field label="Gap (mm)"><Input type="number" min="0" max="20" value={layout.gapMm} onChange={(e) => set("gapMm", Number(e.target.value))} /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-blue-600" checked={layout.cropMarks} onChange={(e) => set("cropMarks", e.target.checked)} /> Crop marks</label>
            </>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-blue-600" checked={layout.includeBack} onChange={(e) => set("includeBack", e.target.checked)} /> Include back side (duplex-aligned)</label>
          <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            <p><b>Card:</b> {Number(template.widthMm).toFixed(2)} × {Number(template.heightMm).toFixed(2)} mm ({template.orientation})</p>
            <p><b>Cards per page:</b> {L?.perPage} ({L?.cols} × {L?.rows})</p>
            <p><b>Cards:</b> {cards.length} · <b>Pages:</b> {Math.ceil(cards.length / (L?.perPage || 1)) * (layout.includeBack ? 2 : 1)}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            <b>Print scaling:</b> In the print dialog choose <b>Scale 100% / Actual size</b> and disable “Fit to page”, otherwise card dimensions will not match {template.widthMm} × {template.heightMm} mm.
          </div>
        </div>
        <div className="max-h-[62vh] overflow-auto rounded-xl bg-slate-100 p-4">
          <PrintSheets cards={cards} template={template} layout={layout} institute={institute} preview previewScale={layout.pageSize === "CR80" ? 1.6 : 0.55} />
        </div>
      </div>
      {/* Unscaled copy (direct child of <body>) used for PDF capture and browser printing */}
      {typeof document !== "undefined" && createPortal(
        <div ref={hiddenRef} className="card-print-root" aria-hidden="true">
          <PrintSheets cards={cards} template={template} layout={layout} institute={institute} />
        </div>,
        document.body,
      )}
    </Modal>
  );
}
