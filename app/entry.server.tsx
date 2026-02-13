import type { EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { renderToString } from "react-dom/server";
import { addDocumentResponseHeaders } from "./shopify.server";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  try {
    addDocumentResponseHeaders(request, responseHeaders);
  } catch (e: any) {
    console.error("[entry.server] addDocumentResponseHeaders failed:", e.message);
  }

  try {
    const body = renderToString(
      <ServerRouter context={routerContext} url={request.url} />
    );

    responseHeaders.set("Content-Type", "text/html");

    return new Response(body, {
      headers: responseHeaders,
      status: responseStatusCode,
    });
  } catch (e: any) {
    console.error("[entry.server] renderToString failed:", e.message, e.stack?.slice(0, 500));
    return new Response(
      `<!DOCTYPE html><html><body><h1>Server Render Error</h1><pre>${e.message}\n${e.stack?.slice(0, 1000)}</pre></body></html>`,
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}
