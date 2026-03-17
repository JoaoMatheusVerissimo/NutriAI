import { describe, expect, it } from 'vitest';
import { buildChatProfileContext, getGeminiErrorMessage } from './geminiService';

describe('buildChatProfileContext', () => {
  it('keeps the context minimal for chatbot personalization', () => {
    const context = buildChatProfileContext({
      name: 'Lia',
      age: 29,
      weight: 68,
      height: 170,
      sex: 'female',
      goal: 'gain_muscle',
      allergies: 'amendoim',
      restrictions: 'sem lactose',
    });

    expect(context).toContain('Objetivo principal: ganhar massa muscular');
    expect(context).toContain('Alergias: amendoim');
    expect(context).toContain('Restrições alimentares: sem lactose');
    expect(context).not.toContain('29');
    expect(context).not.toContain('68');
    expect(context).not.toContain('170');
  });
});

describe('getGeminiErrorMessage', () => {
  it('maps leaked keys to a safe action message', () => {
    const message = getGeminiErrorMessage(new Error('API key was reported as leaked'));

    expect(message).toContain('bloqueada por vazamento');
  });

  it('maps invalid key errors to key regeneration guidance', () => {
    const message = getGeminiErrorMessage(new Error('API key not valid. Please pass a valid API key.'));

    expect(message).toContain('invalida ou expirou');
  });

  it('maps disabled API errors to enablement guidance', () => {
    const message = getGeminiErrorMessage(new Error('GenerativeLanguage API has not been used in project and is disabled. Enable it by visiting the Google Cloud console.'));

    expect(message).toContain('nao esta habilitada');
  });

  it('keeps quota exceeded as temporary limit', () => {
    const message = getGeminiErrorMessage(new Error('RESOURCE_EXHAUSTED: quota exceeded for quota metric'));

    expect(message).toContain('limite temporário');
  });
});