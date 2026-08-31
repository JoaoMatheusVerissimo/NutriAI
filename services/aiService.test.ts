import { describe, it, expect } from 'vitest';
import { generateAIResponse } from './aiService';

describe('aiService Integration Test', () => {
  it('should generate a response from the AI service and log status', async () => {
    const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
    const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

    console.log('--- DIRECT API CHECKS ---');

    // 1. Gemini Check (using current configuration)
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Say OK' }] }]
          })
        }
      );
      const data = await response.json();
      console.log('Gemini v1 2.5-flash direct response status:', response.status);
    } catch (e: any) {
      console.log('Gemini direct error:', e.message);
    }

    // 2. Groq Check (using current configuration)
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: "Say OK" }],
          temperature: 0.7,
        }),
      });
      const data = await response.json();
      console.log('Groq direct response status:', response.status);
    } catch (e: any) {
      console.log('Groq direct error:', e.message);
    }

    // 3. OpenRouter Check (using current configuration)
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "NutriAI",
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-chat",
          messages: [{ role: "user", content: "Say OK" }],
        }),
      });
      const data = await response.json();
      console.log('OpenRouter direct response status:', response.status);
    } catch (e: any) {
      console.log('OpenRouter direct error:', e.message);
    }

    console.log('--- CALLING GENERATEAIRESPONSE ---');
    const result = await generateAIResponse('Responda apenas com a palavra: OK');
    console.log('generateAIResponse final result:', result);
    expect(result).toBeDefined();
    expect(result.trim()).toBeTruthy();
  }, 30000);
});
