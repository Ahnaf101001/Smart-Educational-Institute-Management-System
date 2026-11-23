"use client";

// Table row actions: up to three are shown as buttons; with more, the first stays visible and the
// rest move into a "⋯" menu so rows no longer overflow. The menu is fixed-positioned so a scrolling
// table container cannot clip it.
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button, cx } from "./kit";

export default function RowActions({ actions, max = 3 }) {
  const [menu, setMenu] = useState(null); // { top, right } when open
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => { if (e.type !== "mousedown" || (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target))) setMenu(null); };
    const onKey = (e) => { if (e.key === "Escape") setMenu(null); };
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  if (!actions.length) return null;
  const inline = actions.length <= max ? actions : actions.slice(0, 1);
  const overflow = actions.length <= max ? [] : actions.slice(1);

  function toggle() {
    if (menu) { setMenu(null); return; }
    const r = btnRef.current.getBoundingClientRect();
    const height = overflow.length * 40 + 12;
    const top = r.bottom + height > window.innerHeight ? Math.max(8, r.top - height - 4) : r.bottom + 4;
    setMenu({ top, right: Math.max(8, window.innerWidth - r.right) });
  }

  return (
    <div className="flex justify-end gap-1">
      {inline.map((a) => (
        <Button key={a.label} size="sm" variant={a.ghost ? "ghost" : a.variant || "secondary"} icon={a.icon} onClick={a.run} title={a.label}
          className={cx(a.danger && "text-rose-600")}>{a.ghost || a.compact ? null : a.label}</Button>
      ))}
      {overflow.length > 0 && (
        <>
          <Button ref={btnRef} size="sm" variant="secondary" icon={MoreHorizontal} onClick={toggle} title="More actions" aria-haspopup="menu" aria-expanded={!!menu} />
          {menu && (
            <div ref={menuRef} role="menu" className="fixed z-[70] min-w-48 rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl" style={{ top: menu.top, right: menu.right }}>
              {overflow.map((a) => {
                const Icon = a.icon;
                return (
                  <button key={a.label} role="menuitem" type="button" onClick={() => { setMenu(null); a.run(); }}
                    className={cx("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-50", a.danger ? "text-rose-600" : "text-slate-700")}>
                    {Icon && <Icon size={16} className="shrink-0" />}<span className="whitespace-nowrap">{a.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
