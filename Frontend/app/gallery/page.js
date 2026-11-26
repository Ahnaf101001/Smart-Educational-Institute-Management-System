"use client";

// OM-05: public photo gallery (albums the school marked "Public").
import { useEffect, useState } from "react";
import { Images } from "lucide-react";
import { publicApi } from "../lib/api";
import PublicShell from "../components/public/PublicShell";
import { Card, EmptyState, Spinner, formatDate } from "../components/ui/kit";

export default function GalleryPage() {
  const [albums, setAlbums] = useState(null);
  useEffect(() => { publicApi.gallery().then(setAlbums).catch(() => setAlbums([])); }, []);
  return (
    <PublicShell title="Photo gallery">
      <h1 className="mb-5 flex items-center gap-2 text-2xl font-extrabold text-slate-900"><Images className="text-blue-600" /> Photo gallery <span className="text-base font-semibold text-slate-500">· ফটো গ্যালারি</span></h1>
      {albums === null ? <Spinner rows={4} /> : albums.length === 0 ? (
        <EmptyState icon={Images} title="No albums yet" subtitle="Photos from school events will appear here." />
      ) : (
        <div className="space-y-5">
          {albums.map((a) => (
            <Card key={a.id} title={a.titleBn ? `${a.title} · ${a.titleBn}` : a.title} subtitle={[a.eventDate ? formatDate(a.eventDate) : null, a.description].filter(Boolean).join(" · ") || undefined}>
              {a.photos.length === 0 ? <p className="text-sm text-slate-500">Photos coming soon.</p> : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {a.photos.map((p) => (
                    <figure key={p.id} className="overflow-hidden rounded-xl border border-slate-100 bg-white">
                      <a href={p.imageUrl} target="_blank" rel="noreferrer"><img src={p.imageUrl} alt={p.caption || a.title} loading="lazy" className="aspect-square w-full object-cover" /></a>
                      {p.caption && <figcaption className="truncate px-2 py-1 text-xs text-slate-600">{p.caption}</figcaption>}
                    </figure>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </PublicShell>
  );
}
