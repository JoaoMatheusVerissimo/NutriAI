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
  try {
    console.log("Tentando Gemini...")
    return await callGemini(prompt)

  } catch (err) {
    console.warn("⚠️ Gemini falhou. Tentando Groq...", err)

    try {
      return await callGroq(prompt)

    } catch (err) {
      console.warn("⚠️ Groq falhou. Tentando OpenRouter...", err)

      try {
        return await callOpenRouter(prompt)

      } catch (err) {
        console.error("❌ Todos os provedores falharam", err)
        throw new Error("Não foi possível gerar resposta no momento.")
      }
    }
  }
}

/**
 * =========================
 * 🔵 GEMINI (Google)
 * =========================
 */
async function callGemini(prompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
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

  // Se API falhar → força fallback
  if (!response.ok) {
    throw new Error("Erro no Gemini")
  }

  const data = await response.json()

  // Retorna texto gerado
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
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