export interface Env {
  GEMINI_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (request.method !== "POST") {
      return new Response("Método não permitido", { status: 405, headers: cors });
    }

    const body = (await request.json()) as { prompt?: string };
    const prompt = body?.prompt ?? "";

    return new Response(
      JSON.stringify({
        ok: true,
        recebido: prompt.slice(0, 50),
        gemini: env.GEMINI_API_KEY ? "presente" : "faltando",
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  },
};