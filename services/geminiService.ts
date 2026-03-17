import { Chat, GoogleGenAI, Type } from "@google/genai";
import { UserProfile, MealPlan, Recipe, Meal } from '../types';
import { buildEvidenceContext } from './nutritionEvidence';

const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

const MISSING_API_KEY_MESSAGE = 'A chave da IA nao foi configurada. Gere uma nova chave Gemini e defina VITE_GEMINI_API_KEY no seu arquivo .env local.';
const LEAKED_API_KEY_MESSAGE = 'A chave Gemini configurada foi bloqueada por vazamento. Gere outra chave no Google AI Studio e atualize VITE_GEMINI_API_KEY no arquivo .env.';
const INVALID_API_KEY_MESSAGE = 'A chave Gemini atual e invalida ou expirou. Gere uma nova chave no Google AI Studio e atualize VITE_GEMINI_API_KEY no arquivo .env.';
const ACCESS_DENIED_MESSAGE = 'A IA recusou a solicitacao com a chave atual. Verifique se a nova chave Gemini esta ativa e com acesso habilitado.';
const API_NOT_ENABLED_MESSAGE = 'A API Gemini nao esta habilitada no projeto da chave atual. Ative a Generative Language API no Google Cloud e tente novamente.';
const RATE_LIMIT_MESSAGE = 'A IA atingiu o limite temporário de uso. Aguarde alguns instantes antes de tentar novamente.';
const GENERIC_API_ERROR_MESSAGE = 'Nao foi possivel concluir a solicitacao com a IA agora. Tente novamente em instantes.';
const MAX_RATE_LIMIT_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1200;
const OUT_OF_SCOPE_CHAT_MESSAGE = 'Posso ajudar apenas com temas de nutrição e alimentação.';
const NUTRITION_EXPERT_PERSONA = 'Você é nutricionista especialista com mestrado e doutorado em Nutrição, com foco estrito em alimentação, planejamento alimentar, composição de refeições, hábitos alimentares e educação nutricional baseada em evidências.';
const EVIDENCE_CONTEXT = buildEvidenceContext();

const goalTranslation = {
    lose_weight: 'perder peso',
    maintain_weight: 'manter o peso',
    gain_muscle: 'ganhar massa muscular',
};

export const hasGeminiClient = (): boolean => ai !== null;

const getAiClient = () => {
    if (!ai) {
        throw new Error(MISSING_API_KEY_MESSAGE);
    }

    return ai;
};

const getErrorText = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    try {
        return JSON.stringify(error);
    } catch {
        return '';
    }
};

const containsAny = (text: string, patterns: string[]): boolean => {
    return patterns.some((pattern) => text.includes(pattern));
};

const isLeakedApiKeyError = (errorText: string): boolean => {
    return containsAny(errorText, ['reported as leaked', 'was reported as leaked']);
};

const isInvalidApiKeyError = (errorText: string): boolean => {
    return containsAny(errorText, [
        'api key not valid',
        'invalid api key',
        'api_key_invalid',
        'provided api key is invalid',
        'request contains an invalid argument'
    ]);
};

const isApiNotEnabledError = (errorText: string): boolean => {
    return containsAny(errorText, [
        'generativelanguage.googleapis.com',
        'api has not been used in project',
        'is disabled',
        'enable it by visiting'
    ]);
};

const isAccessDeniedError = (errorText: string): boolean => {
    return containsAny(errorText, [
        'permission_denied',
        'status":403',
        'code":403',
        'does not have access',
        'access is denied'
    ]);
};

export const getGeminiErrorMessage = (error: unknown): string => {
    const errorText = getErrorText(error).toLowerCase();

    if (isLeakedApiKeyError(errorText)) {
        return LEAKED_API_KEY_MESSAGE;
    }

    if (isInvalidApiKeyError(errorText)) {
        return INVALID_API_KEY_MESSAGE;
    }

    if (isApiNotEnabledError(errorText)) {
        return API_NOT_ENABLED_MESSAGE;
    }

    if (isAccessDeniedError(errorText)) {
        return ACCESS_DENIED_MESSAGE;
    }

    if (errorText.includes('resource_exhausted') || errorText.includes('status":429') || errorText.includes('code":429')) {
        return RATE_LIMIT_MESSAGE;
    }

    if (errorText.includes('api key') && (errorText.includes('missing') || errorText.includes('not configured'))) {
        return MISSING_API_KEY_MESSAGE;
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return GENERIC_API_ERROR_MESSAGE;
};

const isRateLimitError = (error: unknown): boolean => {
    const errorText = getErrorText(error).toLowerCase();
    return (
        errorText.includes('resource_exhausted') ||
        errorText.includes('status":429') ||
        errorText.includes('code":429') ||
        errorText.includes('too many requests') ||
        errorText.includes('rate limit') ||
        errorText.includes('quota exceeded') ||
        errorText.includes('exceeded your current quota')
    );
};

const shouldFallbackToMealPlanFlash = (error: unknown): boolean => {
    const errorText = getErrorText(error).toLowerCase();
    return (
        isRateLimitError(error) ||
        isAccessDeniedError(errorText) ||
        errorText.includes('does not have access') ||
        errorText.includes('model not found') ||
        errorText.includes('unsupported model')
    );
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const runGeminiRequest = async <T,>(operation: () => Promise<T>): Promise<T> => {
    for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            const canRetry = isRateLimitError(error) && attempt < MAX_RATE_LIMIT_RETRIES;

            if (canRetry) {
                const jitter = Math.floor(Math.random() * 400);
                const waitTime = RETRY_BASE_DELAY_MS * (2 ** attempt) + jitter;
                await sleep(waitTime);
                continue;
            }

            throw new Error(getGeminiErrorMessage(error));
        }
    }

    throw new Error(RATE_LIMIT_MESSAGE);
};

export const buildChatProfileContext = (profile: UserProfile): string => {
    const context = [
        `Objetivo principal: ${goalTranslation[profile.goal]}`,
        `Alergias: ${profile.allergies?.trim() || 'Nenhuma informada'}`,
        `Restrições alimentares: ${profile.restrictions?.trim() || 'Nenhuma informada'}`,
    ];

    return context.join('; ');
};

const buildMealPlanProfileContext = (profile: UserProfile): string => `
    - Idade: ${profile.age}
    - Peso: ${profile.weight} kg
    - Altura: ${profile.height} cm
    - Objetivo: ${goalTranslation[profile.goal]}
    - Alergias: ${profile.allergies || 'Nenhuma'}
    - Restrições alimentares: ${profile.restrictions || 'Nenhuma'}
`;

export const createNutritionChatSession = (profile: UserProfile): Chat => {
    const systemInstruction = `${NUTRITION_EXPERT_PERSONA} Você é o "Coach Nutricional" do app. Responda somente dúvidas sobre nutrição e alimentação. Se a pergunta estiver fora desse escopo, responda exatamente: "${OUT_OF_SCOPE_CHAT_MESSAGE}". Não faça diagnóstico médico, não prescreva medicamentos e não forneça orientações sobre temas não alimentares. Estilo obrigatório das respostas: curtas, diretas, assertivas e simples de entender; priorize frases objetivas e linguagem clara; evite textos longos, rodeios e jargões técnicos sem explicação. Quando útil, entregue no máximo 3 tópicos curtos com ação prática. Baseie recomendações nas evidências resumidas a seguir e não invente estudos: ${EVIDENCE_CONTEXT}. Personalize a resposta usando apenas o contexto mínimo do perfil quando isso realmente ajudar. Contexto permitido do usuário: ${buildChatProfileContext(profile)}.`;

    return getAiClient().chats.create({
        model: 'gemini-2.5-flash',
        config: { systemInstruction },
    });
};

// Schemas for JSON response
const nutritionSchema = {
  type: Type.OBJECT,
  properties: {
    calories: { type: Type.NUMBER },
    protein: { type: Type.NUMBER },
    carbs: { type: Type.NUMBER },
    fat: { type: Type.NUMBER },
  },
  required: ['calories', 'protein', 'carbs', 'fat'],
};

const mealSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    description: { type: Type.STRING },
        ingredientsWithGrams: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Lista de itens da refeição com quantidade em gramas. Ex: "Frango grelhado - 120g".'
        },
    nutrition: nutritionSchema,
  },
    required: ['name', 'description', 'ingredientsWithGrams', 'nutrition'],
};

const dailyPlanSchema = {
    type: Type.OBJECT,
    properties: {
        breakfast: mealSchema,
        lunch: mealSchema,
        dinner: mealSchema,
        snacks: {
            type: Type.ARRAY,
            items: mealSchema
        },
    },
    required: ['breakfast', 'lunch', 'dinner'],
};

const mealPlanSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: 'Um nome criativo e curto para o plano alimentar. Ex: "Plano Energia Total" ou "Dieta Mediterrânea Leve".' },
        dailyPlan: dailyPlanSchema,
        totalNutrition: nutritionSchema,
        substitutions: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    original: { type: Type.STRING },
                    replacement: { type: Type.STRING }
                },
                required: ['original', 'replacement']
            }
        },
        shoppingList: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        }
    },
    required: ['name', 'dailyPlan', 'totalNutrition', 'substitutions', 'shoppingList']
};

const recipeSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING },
        description: { type: Type.STRING },
        prepTime: { type: Type.STRING, description: "Tempo de preparo. ex: '15 minutos'" },
        cookTime: { type: Type.STRING, description: "Tempo de cozimento. ex: '20 minutos'" },
        servings: { type: Type.NUMBER },
        ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
        instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
        nutrition: nutritionSchema,
    },
    required: ['name', 'description', 'prepTime', 'cookTime', 'servings', 'ingredients', 'instructions', 'nutrition'],
};

// Helper to parse JSON response
const parseJsonResponse = <T,>(responseText: string): T => {
  try {
    // The response might have markdown ```json ... ``` wrapper
    const jsonString = responseText.replace(/^```json\s*|```\s*$/g, '').trim();
    return JSON.parse(jsonString);
    } catch {
    console.error("Failed to parse JSON response:", responseText);
    throw new Error("Resposta da IA em formato inválido.");
  }
};

// Function to generate a meal plan
export const generateMealPlan = async (profile: UserProfile, customRequest: string): Promise<Omit<MealPlan, 'id'>> => {
    return runGeminiRequest(async () => {
    const prompt = `
    ${NUTRITION_EXPERT_PERSONA}
    Use como base as evidências resumidas abaixo e não invente estudos ou números não sustentados:\n${EVIDENCE_CONTEXT}

    Crie um plano alimentar de um dia para um usuário com o seguinte perfil:
${buildMealPlanProfileContext(profile)}

    O pedido específico do usuário é: "${customRequest.trim()}".

    Ignore qualquer parte do pedido que esteja fora de nutrição/alimentação e mantenha a resposta focada apenas em alimentação.

    O plano deve incluir café da manhã, almoço e jantar. Se apropriado para o objetivo, inclua 1 ou 2 lanches.
    Para cada refeição, forneça o nome, uma breve descrição, a lista ingredientsWithGrams (itens com quantidade em gramas) e a informação nutricional (calorias, proteínas, carboidratos, gorduras).
    Calcule também o total de macronutrientes do dia.
    Forneça uma lista de compras com todos os ingredientes necessários para o dia.
    Forneça 3-5 sugestões de substituições para ingredientes chave, caso o usuário queira variar.
    Gere um nome criativo e curto para o plano.
    A resposta DEVE ser um JSON válido que corresponda ao schema fornecido.
  `;

    const generateMealPlanWithModel = async (model: string): Promise<Omit<MealPlan, 'id'>> => {
        const response = await getAiClient().models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: mealPlanSchema
            }
        });

        return parseJsonResponse<Omit<MealPlan, 'id'>>(response.text);
    };

    try {
        // Tenta primeiro o modelo mais forte para melhorar qualidade do plano.
        return await generateMealPlanWithModel('gemini-2.5-pro');
    } catch (error) {
        if (shouldFallbackToMealPlanFlash(error)) {
            return generateMealPlanWithModel('gemini-2.5-flash');
        }

        throw error;
    }
    });
};

// Function to generate a single recipe
export const generateRecipe = async (request: string): Promise<Omit<Recipe, 'id'>> => {
    return runGeminiRequest(async () => {
    const prompt = `
        ${NUTRITION_EXPERT_PERSONA}
        Use como base as evidências resumidas abaixo e não invente estudos ou números não sustentados:\n${EVIDENCE_CONTEXT}

        Crie uma receita detalhada baseada no seguinte pedido: "${request.trim()}".
        Ignore qualquer parte do pedido que esteja fora de nutrição/alimentação.
        A receita deve incluir:
        - Nome da receita.
        - Descrição curta e apetitosa.
        - Tempo de preparo e tempo de cozimento.
        - Número de porções.
        - Lista de ingredientes.
        - Instruções passo a passo.
        - Informação nutricional por porção (calorias, proteínas, carboidratos, gorduras).
        A resposta DEVE ser um JSON válido que corresponda ao schema fornecido.
    `;

    const generateRecipeWithModel = async (model: string): Promise<Omit<Recipe, 'id'>> => {
        const response = await getAiClient().models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: recipeSchema
            }
        });

        return parseJsonResponse<Omit<Recipe, 'id'>>(response.text);
    };

    try {
        return await generateRecipeWithModel('gemini-2.5-flash');
    } catch (error) {
        if (shouldFallbackToMealPlanFlash(error)) {
            return generateRecipeWithModel('gemini-2.5-pro');
        }

        throw error;
    }
    });
};


// Function to replace a single meal
export const replaceMeal = async (profile: UserProfile, mealToReplace: string, currentPlan: Omit<MealPlan, 'id'>, customRequest?: string): Promise<Meal> => {
    return runGeminiRequest(async () => {
    const prompt = `
    ${NUTRITION_EXPERT_PERSONA}
        Use como base as evidências resumidas abaixo e não invente estudos ou números não sustentados:\n${EVIDENCE_CONTEXT}

      Preciso substituir uma refeição em um plano alimentar existente.

      Perfil do usuário:
      - Objetivo: ${goalTranslation[profile.goal]}
      - Alergias: ${profile.allergies || 'Nenhuma'}
      - Restrições alimentares: ${profile.restrictions || 'Nenhuma'}
      
      Plano atual (apenas para contexto nutricional, não recrie o plano):
      - Total de calorias diárias: ${currentPlan.totalNutrition.calories}
      - Total de proteínas diárias: ${currentPlan.totalNutrition.protein}
      - Refeições: ${Object.keys(currentPlan.dailyPlan).join(', ')}

      Refeição a ser substituída: ${mealToReplace}.

        Pedido do usuário para a nova refeição: "${customRequest?.trim() || `Sugira uma alternativa para ${mealToReplace} que se alinhe com meu objetivo.`}"

            Ignore qualquer parte do pedido que esteja fora de nutrição/alimentação.

    Gere uma nova refeição (nome, descrição, ingredientsWithGrams com itens em gramas e nutrição) que seja nutricionalmente semelhante à média para esse tipo de refeição, considerando o objetivo do usuário. A resposta DEVE ser um JSON válido que corresponda ao schema de uma única refeição.
    `;

    const model = 'gemini-2.5-flash';

    const response = await getAiClient().models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: mealSchema
        }
    });
    
    const responseText = response.text;
    return parseJsonResponse<Meal>(responseText);
    });
};

// Function to generate a daily tip
export const generateDailyTip = async (profile: UserProfile): Promise<string> => {
    return runGeminiRequest(async () => {
    const prompt = `
        ${NUTRITION_EXPERT_PERSONA}
        Use como base as evidências resumidas abaixo e não invente estudos ou números não sustentados:\n${EVIDENCE_CONTEXT}

        Gere uma dica de saúde curta, motivacional e acionável (no máximo 250 caracteres) para um usuário com o seguinte objetivo: '${goalTranslation[profile.goal]}'.
        A dica deve ser estritamente sobre alimentação e hábitos nutricionais.
        A resposta deve ser apenas o texto da dica, sem qualquer formatação extra como "Dica do Dia:".
        Pode usar negrito com asteriscos (ex: *palavra* ou **palavra**).
    `;

    const model = 'gemini-2.5-flash';

    const response = await getAiClient().models.generateContent({
        model,
        contents: prompt,
    });

    return response.text;
    });
}
