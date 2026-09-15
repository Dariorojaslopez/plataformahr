import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function internalApiBase(): string {
  const fromEnv = process.env.INTERNAL_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  // Local `next dev` → Nest on loopback (not the public NEXT_PUBLIC_API_URL).
  return "http://127.0.0.1:3001";
}

/**
 * Same-origin upload proxy. The browser posts here (www) so CORS-masked 413s
 * from the public API host are avoided; Nest is reached over the Docker network.
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      { message: "Se esperaba un archivo multipart." },
      { status: 400 },
    );
  }

  const authorization = request.headers.get("authorization");
  const companyId = request.headers.get("x-company-id");
  if (!authorization || !companyId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) {
    return NextResponse.json(
      { message: "A logo file is required" },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${internalApiBase()}/companies/current/branding/logo`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "X-Company-Id": companyId,
          "Content-Type": contentType,
          Accept: "application/json",
        },
        body,
        cache: "no-store",
      },
    );
  } catch {
    return NextResponse.json(
      { message: "No se pudo contactar el API interno." },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}
