import { NextResponse } from "next/server";
import { AppError, messageForCode } from "@/lib/errors";
import { isHttpUrl } from "@/lib/fetchArticle";
import { generateFromArticle } from "@/lib/generateFromArticle";
import { isGenerateAction } from "@/lib/prompts";

export const runtime = "nodejs";

export const maxDuration = 120;

function readBody(body: unknown): { url: string; action: unknown } {
  if (typeof body !== "object" || !body) {
    return { url: "", action: null };
  }

  const url = "url" in body && typeof body.url === "string" ? body.url.trim() : "";
  const action = "action" in body ? body.action : null;

  return { url, action };
}

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

  const { url, action } = readBody(body);

  if (!url || !isHttpUrl(url)) {
    return errorResponse(new AppError("VALIDATION_URL", 400));
  }

  if (!isGenerateAction(action)) {
    return errorResponse(new AppError("VALIDATION_ACTION", 400));
  }

  try {
    const result = await generateFromArticle(url, action);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    return errorResponse(new AppError("UNKNOWN", 502));
  }
}
