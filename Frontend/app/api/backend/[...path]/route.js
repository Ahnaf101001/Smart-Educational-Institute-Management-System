import { NextResponse } from "next/server";

// Thin reverse proxy to the API. It never injects credentials: the previous
// version logged in as the admin for any request without a token, which gave
// anonymous visitors full access. Authorization now always comes from the
// browser session (NFR-02 / NFX-07).
const backendUrl = process.env.BACKEND_API_URL || "http://localhost:4000/api/v1";

const FORWARD_REQUEST_HEADERS = [
  "authorization", "content-type", "accept", "x-signature", "x-device-key", "x-gps-key", "user-agent",
];
const FORWARD_RESPONSE_HEADERS = [
  "content-type", "content-disposition", "cache-control", "retry-after", "x-content-type-options",
];

async function handler(request, context) {
  try {
    const { path } = await context.params;
    const target = new URL(`${backendUrl}/${path.map(encodeURIComponent).join("/")}`);
    target.search = new URL(request.url).search;

    const headers = new Headers();
    for (const name of FORWARD_REQUEST_HEADERS) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);

    const hasBody = !["GET", "HEAD"].includes(request.method);
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      return NextResponse.redirect(response.headers.get("location"), response.status);
    }
    if (response.status === 204) return new NextResponse(null, { status: 204 });

    const outHeaders = new Headers();
    for (const name of FORWARD_RESPONSE_HEADERS) {
      const value = response.headers.get(name);
      if (value) outHeaders.set(name, value);
    }
    // Binary-safe passthrough (photos, PDFs, backups).
    return new NextResponse(await response.arrayBuffer(), { status: response.status, headers: outHeaders });
  } catch (error) {
    const unreachable = /fetch failed|ECONNREFUSED|ENOTFOUND/i.test(`${error.message} ${error.cause?.code || ""}`);
    return NextResponse.json(
      {
        success: false,
        message: unreachable
          ? `Cannot reach the API server (${new URL(backendUrl).origin}). Start it with "npm run dev" in the backend folder.`
          : error.message || "Backend service is unavailable.",
      },
      { status: 502 },
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
