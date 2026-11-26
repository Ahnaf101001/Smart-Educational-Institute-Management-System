"use client";

// QM-07 Hijri holiday suggestions for the academic calendar, and the OM-05 photo gallery preview.
import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Images, MoonStar, RefreshCw } from "lucide-react";
import { http } from "../../lib/api";
import { can, useUser } from "../../lib/access";
import { Badge, Button, Card, EmptyState, Field, Select, Spinner, formatDate, useToast } from "../ui/kit";

const thisYear = () => new Date().getFullYear();

export function HijriHolidays() {
  const toast = useToast();
  const { user } = useUser();
  const canAdd = can(user, "academic", "create");
  const [year, setYear] = useState(String(thisYear() + (new Date().getMonth() >= 10 ? 1 : 0)));
  const [rows, setRows] = useState(null);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRows(null);
    try {
      const data = await http.get(`/x/calendar/hijri-suggestions?year=${year}`);
      setRows(data);
      setPicked(data.filter((r) => !r.added && r.type === "Holiday").map((r) => r.key));
    } catch (e) { toast.error(e); setRows([]); }
  }, [year, toast]);
  useEffect(() => { load(); }, [load]);

  async function apply() {
    setBusy(true);
    try {
      const created = await http.post("/x/calendar/hijri-suggestions/apply", { year: Number(year), keys: picked });
      toast.success(`${created.length} event(s) added to the calendar.`);
      await load();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  }

  const toggle = (key) => setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  const years = Array.from({ length: 5 }, (_, i) => String(thisYear() - 1 + i));

  return (
    <Card
      title="Hijri holiday suggestions"
      subtitle="Ramadan, Eid, Shab-e-Barat and other occasions estimated from the Umm al-Qura calendar. Dates may shift by a day after the moon-sighting announcement – review before adding."
    >
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Year"><Select value={year} onChange={(e) => setYear(e.target.value)} options={years} /></Field>
        <Button variant="secondary" icon={RefreshCw} onClick={load}>Refresh</Button>
        {canAdd && <Button icon={CalendarPlus} loading={busy} disabled={!picked.length} onClick={apply}>Add {picked.length || ""} to calendar</Button>}
      </div>
      <div className="mt-4">
        {rows === null ? <Spinner rows={5} /> : rows.length === 0 ? (
          <EmptyState icon={MoonStar} title="No suggestions" subtitle="Pick another year." />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
            {rows.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <input
                  type="checkbox" className="size-4 accent-blue-600" aria-label={`Add ${r.title}`}
                  checked={r.added || picked.includes(r.key)} disabled={r.added || !canAdd} onChange={() => toggle(r.key)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800">{r.title} <span className="font-semibold text-slate-500">· {r.titleBn}</span></p>
                  <p className="text-xs text-slate-500">{r.hijriLabel}</p>
                </div>
                <span className="text-sm font-semibold text-slate-700">
                  {formatDate(r.startDate)}{r.endDate !== r.startDate ? ` – ${formatDate(r.endDate)}` : ""}
                </span>
                <Badge tone={r.type === "Holiday" ? "amber" : "slate"}>{r.type}</Badge>
                {r.added && <Badge tone="green">In calendar</Badge>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

// What guardians see: published albums with their photos (Public + Guardians audiences).
export function GalleryPreview() {
  const toast = useToast();
  const [albums, setAlbums] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    Promise.all([http.get("/gallery-albums?limit=100"), http.get("/gallery-photos?limit=500")])
      .then(([a, p]) => { setAlbums(Array.isArray(a) ? a : a?.items || []); setPhotos(Array.isArray(p) ? p : p?.items || []); })
      .catch((e) => { toast.error(e); setAlbums([]); });
  }, [toast]);
  if (albums === null) return <Spinner rows={4} />;
  if (!albums.length) return <EmptyState icon={Images} title="No albums yet" subtitle="Create an album, then add photos to it." />;
  const current = albums.find((a) => a.id === open);
  const list = current ? photos.filter((p) => p.albumId === current.id) : [];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {albums.map((a) => {
          const count = photos.filter((p) => p.albumId === a.id).length;
          const cover = a.coverUrl || photos.find((p) => p.albumId === a.id)?.imageUrl;
          return (
            <button key={a.id} type="button" onClick={() => setOpen(a.id === open ? null : a.id)}
              className={`overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:shadow-md ${a.id === open ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"}`}>
              <div className="aspect-video bg-slate-100">{cover && <img src={cover} alt="" loading="lazy" className="size-full object-cover" />}</div>
              <div className="p-3">
                <p className="truncate font-bold text-slate-800">{a.title}</p>
                <p className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-500">{formatDate(a.eventDate)} · {count} photo(s) <Badge tone={a.audience === "Public" ? "green" : "blue"}>{a.audience}</Badge>{a.status === "Draft" && <Badge tone="slate">Draft</Badge>}</p>
              </div>
            </button>
          );
        })}
      </div>
      {current && (
        <Card title={current.title} subtitle={current.description || undefined}>
          {list.length === 0 ? <p className="text-sm text-slate-500">No photos in this album yet – add them on the Photos tab.</p> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {list.map((p) => (
                <figure key={p.id} className="overflow-hidden rounded-xl border border-slate-100">
                  <a href={p.imageUrl} target="_blank" rel="noreferrer"><img src={p.imageUrl} alt={p.caption || ""} loading="lazy" className="aspect-square w-full object-cover" /></a>
                  {p.caption && <figcaption className="truncate px-2 py-1 text-xs text-slate-600">{p.caption}</figcaption>}
                </figure>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
