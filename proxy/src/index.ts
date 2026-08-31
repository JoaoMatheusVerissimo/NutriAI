export interface Env {
  GEMINI_API_KEY: string;
  GROQ_API_KEY: string;
  OPENROUTER_API_KEY: string;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Modelos free-tier ativos. Se algum sair do ar, troca aqui num lugar só.
const GEMINI_MODEL = "gemini-2.5-flash";
const GROQ_MODEL = "qwen/qwen3.6-27b";
const OPENROUTER_MODEL = "openrouter/free";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "Método não permitido" }, 405);
    }

    let body: { prompt?: string; json?: boolean };
    try {
      body = (await request.json()) as { prompt?: string; json?: boolean };
    } catch {
      return json({ error: "Corpo inválido" }, 400);
    }

    const prompt = (body?.prompt ?? "").trim();
    const wantJson = body?.json === true;
    if (!prompt) {
      return json({ error: "Prompt vazio" }, 400);
    }

    // Tenta Gemini → Groq → OpenRouter, em ordem.
    const provedores = [
      () => callGemini(prompt, wantJson, env),
      () => callGroq(prompt, wantJson, env),
      () => callOpenRouter(prompt, wantJson, env),
    ];

        const erros: string[] = [];
    for (const tentar of provedores) {
      try {
        const texto = limparPensamento(await tentar());
        const limpo = wantJson ? extrairJson(texto) : texto;
        if (limpo) {
          return json({ ok: true, resposta: limpo });
        }
        erros.push("Resposta vazia");
      } catch (e) {
        erros.push(e instanceof Error ? e.message : "Erro desconhecido");
      }
    }

    return json({ ok: false, error: `Todos os provedores falharam: ${erros.join(" | ")}` }, 502);
  },
};

// ---------- helpers ----------

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Remove blocos <think>...</think> que modelos de raciocínio incluem.
function limparPensamento(texto: string): string {
  // Remove <think>...</think> (fechado) e <think>... sem fechar (até o fim ou até o conteúdo real)
  let limpo = texto.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // Se sobrou um <think> sem fechar, remove tudo do <think> até o fim
  limpo = limpo.replace(/<think>[\s\S]*/gi, "");
  return limpo.trim();
}

// Remove cercas ```json e valida que sobrou um JSON parseável.
// Retorna a string JSON limpa, ou "" se não for JSON válido.
function extrairJson(texto: string): string {
  const semCercas = texto
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    JSON.parse(semCercas);
    return semCercas;
  } catch {
    return "";
  }
}

// ---------- Gemini (chave AQ: endpoint nativo + header x-goog-api-key) ----------

async function callGemini(prompt: string, wantJson: boolean, env: Env): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const corpo: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
  };
  if (wantJson) {
    corpo.generationConfig = { responseMimeType: "application/json" };
  }

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY,
    },
    body: JSON.stringify(corpo),
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Gemini ${r.status}: ${err.slice(0, 200)}`);
  }

  const data = (await r.json()) as any;
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ---------- Groq (OpenAI-compatible) ----------

async function callGroq(prompt: string, wantJson: boolean, env: Env): Promise<string> {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      ...(wantJson ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Groq ${r.status}: ${err.slice(0, 200)}`);
  }

  const data = (await r.json()) as any;
  return data?.choices?.[0]?.message?.content ?? "";
}

// ---------- OpenRouter (OpenAI-compatible) ----------

async function callOpenRouter(prompt: string, wantJson: boolean, env: Env): Promise<string> {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "X-Title": "NutriAI",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "user", content: prompt }],
      ...(wantJson ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`OpenRouter ${r.status}: ${err.slice(0, 200)}`);
  }

  const data = (await r.json()) as any;
  return data?.choices?.[0]?.message?.content ?? "";
}