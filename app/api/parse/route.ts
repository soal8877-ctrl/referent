import { NextResponse } from "next/server";
import { AppError, messageForCode } from "@/lib/errors";
import { fetchArticle, isHttpUrl } from "@/lib/fetchArticle";

export const runtime = "nodejs";

function errorResponse(error: AppError) {
  return NextResponse.json(
    { code: error.code, error: messageForCode(error.code) },
    { status: error.status },
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(new AppError("VALIDATION_BODY", 400));
  }

  const url =
    typeof body === "object" && body && "url" in body && typeof body.url === "string"
      ? body.url.trim()
      : "";

  if (!url || !isHttpUrl(url)) {
    return errorResponse(new AppError("VALIDATION_URL", 400));
  }

  try {
    const article = await fetchArticle(url);
    return NextResponse.json(article);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    return errorResponse(new AppError("UNKNOWN", 502));
  }
}
