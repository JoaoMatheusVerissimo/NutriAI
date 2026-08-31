// services/proxyService.ts
// Ponto único de comunicação com o proxy (Cloudflare Worker).
// As chaves de IA vivem no Worker, nunca no frontend.

const PROXY_URL = import.meta.env.VITE_PROXY_URL;

export async function callProxy(prompt: string, wantJson = false): Promise<string> {
  if (!PROXY_URL) {
    throw new Error('VITE_PROXY_URL não configurada no .env');
  }

  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, json: wantJson }),
  });

  const data = (await res.json()) as { ok?: boolean; resposta?: string; error?: string };

  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || 'Falha ao chamar o serviço de IA');
  }

  return data.resposta ?? '';
}