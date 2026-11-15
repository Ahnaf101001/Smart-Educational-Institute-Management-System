import { ImageResponse } from "next/og";

// PNG app icons for the web app manifest (192 / 512 px, maskable-safe padding).
export async function GET(request, { params }) {
  const { size: raw } = await params;
  const size = [180, 192, 512].includes(Number(raw)) ? Number(raw) : 192;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #1d4ed8, #0ea5e9)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "white" }}>
          <div style={{ fontSize: size * 0.34, fontWeight: 800, lineHeight: 1 }}>EIMS</div>
          <div style={{ fontSize: size * 0.09, marginTop: size * 0.04, opacity: 0.9 }}>School · Madrasa</div>
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
