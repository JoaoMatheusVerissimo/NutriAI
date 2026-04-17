// src/services/aiService.ts

/**
 * Serviço central de IA
 * 
 * Responsável por:
 * - Gerar respostas usando IA
 * - Fazer fallback automático entre provedores
 * - Garantir que o sistema não quebre por limite de API
 */

// 🔑 Pegando chaves do .env
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY

/**
 * 🔥 FUNÇÃO PRINCIPAL
 * 
 * Use essa função no projeto inteiro.
 * Ela tenta múltiplos provedores automaticamente.
 */
export async function generateAIResponse(prompt: string): Promise<string> {
  // 🔵 Tenta Gemini (1 vez só)
  try {
    console.log("Tentando Gemini...")
    return await callGemini(prompt)
  } catch (err) {
    console.warn("Gemini falhou (normal em free tier), usando fallback...")
  }

  // 🟢 Groq (principal)
  try {
    console.log("Tentando Groq...")
    return await callGroq(prompt)
  } catch (err) {
    console.warn("Groq falhou, tentando OpenRouter...")
  }

  // 🟣 OpenRouter (backup)
  try {
    return await callOpenRouter(prompt)
  } catch (err) {
    throw new Error("Todos os provedores falharam")
  }
}

/**
 * =========================
 * 🔵 GEMINI (Google)
 * =========================
 */
async function callGemini(prompt: string): Promise<string> {
  const MAX_RETRIES = 3

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Gemini tentativa ${attempt}...`)

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }),
        }
      )

      // Se der erro de servidor (ex: 503)
      if (!response.ok) {
        const errorData = await response.json()

        // Se for erro de alta demanda → tenta novamente
        if (response.status === 503 && attempt < MAX_RETRIES) {
          console.warn("Gemini sobrecarregado, tentando novamente...")
          await delay(1000 * attempt) // espera progressiva
          continue
        }

        throw new Error(errorData?.error?.message || "Erro no Gemini")
      }

      const data = await response.json()

      return data?.candidates?.[0]?.content?.parts?.[0]?.text || ""

    } catch (err) {
      if (attempt === MAX_RETRIES) {
        throw err
      }

      console.warn("Erro temporário, tentando novamente...", err)
      await delay(1000 * attempt)
    }
  }

  throw new Error("Falha no Gemini após múltiplas tentativas")
}

/**
 * ⏱️ Função auxiliar para delay
 */
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * =========================
 * 🟢 GROQ (Llama 3)
 * =========================
 */
async function callGroq(prompt: string): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama3-70b-8192", // modelo rápido e gratuito
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    throw new Error("Erro no Groq")
  }

  const data = await response.json()

  return data?.choices?.[0]?.message?.content || ""
}

/**
 * =========================
 * 🟣 OPENROUTER (Fallback final)
 * =========================
 */
async function callOpenRouter(prompt: string): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,

      // Necessário para OpenRouter
      "HTTP-Referer": "http://localhost:5173",
      "X-Title": "NutriAI",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error("Erro no OpenRouter")
  }

  const data = await response.json()

  return data?.choices?.[0]?.message?.content || ""
}