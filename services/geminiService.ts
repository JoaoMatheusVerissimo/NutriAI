import { Chat, GoogleGenAI, Type } from '@google/genai';
import { Meal, MealPlan, Recipe, UserProfile } from '../types';
import { buildEvidenceContext } from './nutritionEvidence';
import { generateAIResponse } from './aiService';
import { callProxy } from './proxyService';

/**
 * Lê a chave do Gemini a partir do .env do frontend.
 * Enquanto a IA ainda estiver no cliente, este é o ponto de entrada da credencial.
 */
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();

/**
 * Cria o cliente Gemini apenas se a chave existir.
 * Se a chave não existir, o cliente fica null e o sistema trata isso depois.
 */
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

/**
 * Mensagens de erro amigáveis para situações comuns.
 * Isso melhora a UX e evita mostrar erro técnico cru para o usuário.
 */
const MISSING_API_KEY_MESSAGE =
  'A chave da IA nao foi configurada. Gere uma nova chave Gemini e defina VITE_GEMINI_API_KEY no seu arquivo .env local.';
const LEAKED_API_KEY_MESSAGE =
  'A chave Gemini configurada foi bloqueada por vazamento. Gere outra chave no Google AI Studio e atualize VITE_GEMINI_API_KEY no arquivo .env.';
const INVALID_API_KEY_MESSAGE =
  'A chave Gemini atual e invalida ou expirou. Gere uma nova chave no Google AI Studio e atualize VITE_GEMINI_API_KEY no arquivo .env.';
const ACCESS_DENIED_MESSAGE =
  'A IA recusou a solicitacao com a chave atual. Verifique se a nova chave Gemini esta ativa e com acesso habilitado.';
const API_NOT_ENABLED_MESSAGE =
  'A API Gemini nao esta habilitada no projeto da chave atual. Ative a Generative Language API no Google Cloud e tente novamente.';
const RATE_LIMIT_MESSAGE =
  'A IA atingiu o limite temporário de uso. Aguarde alguns instantes antes de tentar novamente.';
const GENERIC_API_ERROR_MESSAGE =
  'Nao foi possivel concluir a solicitacao com a IA agora. Tente novamente em instantes.';
const INVALID_RESPONSE_MESSAGE =
  'A IA retornou uma resposta incompleta ou em formato inválido.';

/**
 * Define quantas tentativas extras podem ser feitas
 * quando ocorrer erro temporário de limite de uso.
 */
const MAX_RATE_LIMIT_RETRIES = 2;

/**
 * Tempo base para retry com backoff exponencial.
 */
const RETRY_BASE_DELAY_MS = 1200;

/**
 * Resposta padrão quando o usuário perguntar algo fora do escopo alimentar.
 */
const OUT_OF_SCOPE_CHAT_MESSAGE =
  'Posso ajudar apenas com temas de nutrição e alimentação';

/**
 * Persona principal usada nos prompts.
 * Ela ajuda a manter consistência no papel assumido pela IA.
 */
const NUTRITION_EXPERT_PERSONA =
  'Você é nutricionista especialista com mestrado e doutorado em Nutrição, com foco estrito em alimentação, planejamento alimentar, composição de refeições, hábitos alimentares e educação nutricional baseada em evidências.';

/**
 * Contexto de evidências resumidas.
 * Vem de outro arquivo e serve para orientar melhor as respostas da IA.
 */
const EVIDENCE_CONTEXT = buildEvidenceContext();

/**
 * Centraliza os modelos usados em cada tipo de tarefa.
 * Isso facilita trocar o modelo depois, sem sair mexendo em vários lugares.
 */
const MODELS = {
  chat: 'gemini-2.5-flash',
  mealPlanPrimary: 'gemini-2.5-pro',
  mealPlanFallback: 'gemini-2.5-flash',
  recipePrimary: 'gemini-2.5-flash',
  recipeFallback: 'gemini-2.5-pro',
  replaceMeal: 'gemini-2.5-flash',
  dailyTip: 'gemini-2.5-flash',
  dailyTipFallback: 'gemini-2.5-pro',
} as const;

/**
 * Traduz o objetivo interno do sistema para texto natural em português.
 * Isso ajuda na montagem dos prompts.
 */
const goalTranslation: Record<UserProfile['goal'], string> = {
  lose_weight: 'perder peso',
  maintain_weight: 'manter o peso',
  gain_muscle: 'ganhar massa muscular',
};

/**
 * Schema da informação nutricional.
 * Usado para pedir JSON estruturado ao Gemini.
 */
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

/**
 * Schema de uma refeição única.
 */
const mealSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    description: { type: Type.STRING },
    ingredientsWithGrams: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'Lista de itens da refeição com quantidade em gramas. Ex: "Frango grelhado - 120g".',
    },
    nutrition: nutritionSchema,
  },
  required: ['name', 'description', 'ingredientsWithGrams', 'nutrition'],
};

/**
 * Schema do plano diário.
 */
const dailyPlanSchema = {
  type: Type.OBJECT,
  properties: {
    breakfast: mealSchema,
    lunch: mealSchema,
    dinner: mealSchema,
    snacks: {
      type: Type.ARRAY,
      items: mealSchema,
    },
  },
  required: ['breakfast', 'lunch', 'dinner'],
};

/**
 * Schema completo do plano alimentar.
 */
const mealPlanSchema = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description:
        'Um nome criativo e curto para o plano alimentar. Ex: "Plano Energia Total".',
    },
    dailyPlan: dailyPlanSchema,
    totalNutrition: nutritionSchema,
    substitutions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING },
          replacement: { type: Type.STRING },
        },
        required: ['original', 'replacement'],
      },
    },
    shoppingList: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['name', 'dailyPlan', 'totalNutrition', 'substitutions', 'shoppingList'],
};

/**
 * Schema completo de uma receita.
 */
const recipeSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    description: { type: Type.STRING },
    prepTime: {
      type: Type.STRING,
      description: "Tempo de preparo. Ex: '15 minutos'",
    },
    cookTime: {
      type: Type.STRING,
      description: "Tempo de cozimento. Ex: '20 minutos'",
    },
    servings: { type: Type.NUMBER },
    ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
    instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
    nutrition: nutritionSchema,
  },
  required: [
    'name',
    'description',
    'prepTime',
    'cookTime',
    'servings',
    'ingredients',
    'instructions',
    'nutrition',
  ],
};

/**
 * Permite ao resto do app verificar se a IA está configurada.
 */
export const hasGeminiClient = (): boolean => ai !== null;

/**
 * Retorna o cliente Gemini pronto para uso.
 * Se não existir, lança erro amigável.
 */
const getAiClient = (): GoogleGenAI => {
  if (!ai) {
    throw new Error(MISSING_API_KEY_MESSAGE);
  }

  return ai;
};

/**
 * Limpa strings opcionais para evitar espaços desnecessários.
 */
const sanitizeText = (value?: string): string => (value ?? '').trim();

/**
 * Extrai texto de erro de vários formatos possíveis.
 */
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

/**
 * Verifica se algum dos padrões aparece no texto.
 */
const containsAny = (text: string, patterns: string[]): boolean =>
  patterns.some((pattern) => text.includes(pattern));

/**
 * Detecta erros de chave vazada.
 */
const isLeakedApiKeyError = (errorText: string): boolean =>
  containsAny(errorText, ['reported as leaked', 'was reported as leaked']);

/**
 * Detecta chave inválida.
 */
const isInvalidApiKeyError = (errorText: string): boolean =>
  containsAny(errorText, [
    'api key not valid',
    'invalid api key',
    'api_key_invalid',
    'provided api key is invalid',
    'request contains an invalid argument',
  ]);

/**
 * Detecta API desabilitada.
 */
const isApiNotEnabledError = (errorText: string): boolean =>
  containsAny(errorText, [
    'generativelanguage.googleapis.com',
    'api has not been used in project',
    'is disabled',
    'enable it by visiting',
  ]);

/**
 * Detecta erro de acesso/permissão.
 */
const isAccessDeniedError = (errorText: string): boolean =>
  containsAny(errorText, [
    'permission_denied',
    'status":403',
    'code":403',
    'does not have access',
    'access is denied',
  ]);

/**
 * Traduz erro técnico em mensagem amigável.
 * Essa função é a principal responsável por exibir erro claro no frontend.
 */
export const getGeminiErrorMessage = (error: unknown): string => {
  const errorText = getErrorText(error).toLowerCase();

  if (isLeakedApiKeyError(errorText)) return LEAKED_API_KEY_MESSAGE;
  if (isInvalidApiKeyError(errorText)) return INVALID_API_KEY_MESSAGE;
  if (isApiNotEnabledError(errorText)) return API_NOT_ENABLED_MESSAGE;
  if (isAccessDeniedError(errorText)) return ACCESS_DENIED_MESSAGE;

  if (
    errorText.includes('resource_exhausted') ||
    errorText.includes('status":429') ||
    errorText.includes('code":429')
  ) {
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

/**
 * Detecta se o erro é temporário de limite/quota.
 * Usado para saber se vale tentar novamente.
 */
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

/**
 * Decide se vale tentar outro modelo quando o primeiro falha.
 */
const shouldFallbackToAlternativeModel = (error: unknown): boolean => {
  const errorText = getErrorText(error).toLowerCase();

  return (
    isRateLimitError(error) ||
    isAccessDeniedError(errorText) ||
    errorText.includes('does not have access') ||
    errorText.includes('model not found') ||
    errorText.includes('unsupported model')
  );
};

/**
 * Pequena pausa assíncrona usada no retry.
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wrapper geral para chamadas Gemini.
 * Faz retry em caso de rate limit e lança erro amigável no fim.
 */
const runGeminiRequest = async <T>(operation: () => Promise<T>): Promise<T> => {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const canRetry = isRateLimitError(error) && attempt < MAX_RATE_LIMIT_RETRIES;

      if (canRetry) {
        const jitter = Math.floor(Math.random() * 400);
        const waitTime = RETRY_BASE_DELAY_MS * 2 ** attempt + jitter;
        await sleep(waitTime);
        continue;
      }

      throw new Error(getGeminiErrorMessage(error));
    }
  }

  throw new Error(RATE_LIMIT_MESSAGE);
};

/**
 * Faz parse do texto retornado pela IA.
 * Também remove blocos markdown ```json ... ```
 */
const parseJsonResponse = <T>(responseText: string): T => {
  try {
    const cleaned = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    return JSON.parse(cleaned) as T;
  } catch {
    console.error('Failed to parse JSON response:', responseText);
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }
};

/**
 * Normaliza números vindos da IA.
 * Aceita número real ou string numérica.
 */
const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

/**
 * Normaliza arrays de string.
 */
const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
};

/**
 * Valida e normaliza informação nutricional.
 */
const validateNutritionInfo = (value: unknown) => {
  const nutrition = value as Record<string, unknown>;

  if (!nutrition || typeof nutrition !== 'object') {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  return {
    calories: Math.max(0, toNumber(nutrition.calories)),
    protein: Math.max(0, toNumber(nutrition.protein)),
    carbs: Math.max(0, toNumber(nutrition.carbs)),
    fat: Math.max(0, toNumber(nutrition.fat)),
  };
};

/**
 * Valida e normaliza uma refeição.
 */
const validateMeal = (value: unknown): Meal => {
  const meal = value as Record<string, unknown>;

  if (!meal || typeof meal !== 'object') {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  const name = String(meal.name ?? '').trim();
  const description = String(meal.description ?? '').trim();

  if (!name || !description) {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  return {
    name,
    description,
    ingredientsWithGrams: normalizeStringArray(meal.ingredientsWithGrams),
    nutrition: validateNutritionInfo(meal.nutrition),
  };
};

/**
 * Valida e normaliza um plano alimentar completo.
 */
const validateMealPlan = (value: unknown): Omit<MealPlan, 'id'> => {
  const plan = value as Record<string, unknown>;

  if (!plan || typeof plan !== 'object') {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  const dailyPlanRaw = plan.dailyPlan as Record<string, unknown>;
  if (!dailyPlanRaw || typeof dailyPlanRaw !== 'object') {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  return {
    name: String(plan.name ?? '').trim() || 'Plano alimentar personalizado',
    dailyPlan: {
      breakfast: validateMeal(dailyPlanRaw.breakfast),
      lunch: validateMeal(dailyPlanRaw.lunch),
      dinner: validateMeal(dailyPlanRaw.dinner),
      snacks: Array.isArray(dailyPlanRaw.snacks)
        ? dailyPlanRaw.snacks.map(validateMeal)
        : [],
    },
    totalNutrition: validateNutritionInfo(plan.totalNutrition),
    substitutions: Array.isArray(plan.substitutions)
      ? plan.substitutions
        .map((item) => {
          const entry = item as Record<string, unknown>;
          const original = String(entry?.original ?? '').trim();
          const replacement = String(entry?.replacement ?? '').trim();

          if (!original || !replacement) return null;

          return { original, replacement };
        })
        .filter(Boolean) as Array<{ original: string; replacement: string }>
      : [],
    shoppingList: normalizeStringArray(plan.shoppingList),
  };
};

/**
 * Valida e normaliza uma receita.
 */
const validateRecipe = (value: unknown): Omit<Recipe, 'id'> => {
  const recipe = value as Record<string, unknown>;

  if (!recipe || typeof recipe !== 'object') {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  const name = String(recipe.name ?? '').trim();
  const description = String(recipe.description ?? '').trim();
  const prepTime = String(recipe.prepTime ?? '').trim();
  const cookTime = String(recipe.cookTime ?? '').trim();

  if (!name || !description || !prepTime || !cookTime) {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  return {
    name,
    description,
    prepTime,
    cookTime,
    servings: Math.max(1, Math.round(toNumber(recipe.servings) || 1)),
    ingredients: normalizeStringArray(recipe.ingredients),
    instructions: normalizeStringArray(recipe.instructions),
    nutrition: validateNutritionInfo(recipe.nutrition),
  };
};

/**
 * Contexto resumido do perfil para o chat.
 */
export const buildChatProfileContext = (profile: UserProfile): string => {
  const context = [
    `Objetivo principal: ${goalTranslation[profile.goal]}`,
    `Alergias: ${sanitizeText(profile.allergies) || 'Nenhuma informada'}`,
    `Restrições alimentares: ${sanitizeText(profile.restrictions) || 'Nenhuma informada'}`,
  ];

  return context.join('; ');
};

/**
 * Contexto mais completo do perfil para geração de plano.
 */
const buildMealPlanProfileContext = (profile: UserProfile): string => `
- Idade: ${profile.age}
- Peso: ${profile.weight} kg
- Altura: ${profile.height} cm
- Sexo: ${profile.sex || 'Não informado'}
- Objetivo: ${goalTranslation[profile.goal]}
- Alergias: ${sanitizeText(profile.allergies) || 'Nenhuma'}
- Restrições alimentares: ${sanitizeText(profile.restrictions) || 'Nenhuma'}
`;

/**
 * Cria uma sessão de chat do Gemini já com instrução de sistema fixa.
 * Essa função é usada pelo chatbot do app.
 */
export const createNutritionChatSession = (profile: UserProfile): Chat => {
  const systemInstruction = `
${NUTRITION_EXPERT_PERSONA}

Você é o "Coach Nutricional" do app.
Responda somente dúvidas sobre nutrição e alimentação.
Se a pergunta estiver fora desse escopo, responda exatamente:
"${OUT_OF_SCOPE_CHAT_MESSAGE}"

Regras:
- Não faça diagnóstico médico.
- Não prescreva medicamentos.
- Não forneça orientações sobre temas não alimentares.
- Responda de forma curta, direta, clara e simples.
- Quando útil, entregue no máximo 3 tópicos curtos com ação prática.
- Baseie recomendações nas evidências resumidas abaixo e não invente estudos.

Evidências resumidas:
${EVIDENCE_CONTEXT}

Contexto do usuário:
${buildChatProfileContext(profile)}
`.trim();

  return getAiClient().chats.create({
    model: MODELS.chat,
    config: { systemInstruction },
  });
};

/**
 * Gera um plano alimentar de 1 dia com base no perfil do usuário e no pedido customizado.
 * Tenta primeiro um modelo mais forte e faz fallback se necessário.
 */
export const generateMealPlan = async (
  profile: UserProfile,
  customRequest: string
): Promise<Omit<MealPlan, 'id'>> => {
  return runGeminiRequest(async () => {
    const prompt = `
${NUTRITION_EXPERT_PERSONA}

Use como base as evidências resumidas abaixo e não invente estudos ou números não sustentados:
${EVIDENCE_CONTEXT}

Crie um plano alimentar de um dia para um usuário com o seguinte perfil:
${buildMealPlanProfileContext(profile)}

Pedido do usuário:
"${sanitizeText(customRequest) || 'Crie um plano alimentar equilibrado e coerente com meu objetivo.'}"

Regras:
- Responda apenas sobre nutrição e planejamento alimentar. Se o pedido estiver fora desse escopo, retorne a string exata "OUT_OF_SCOPE" no campo "name" do plano e preencha os demais com valores genéricos válidos para manter o JSON correto.
- Inclua café da manhã, almoço e jantar.
- Inclua 1 ou 2 lanches apenas se fizer sentido.
- Para cada refeição, forneça:
  - name
  - description
  - ingredientsWithGrams
  - nutrition
- Gere totalNutrition do dia.
- Gere shoppingList com os ingredientes principais.
- Gere de 3 a 5 substitutions úteis.
- Gere um name curto e natural para o plano.
- Use alimentos comuns e plausíveis.
- Evite sugestões incompatíveis com alergias e restrições.
- A resposta DEVE ser JSON válido no schema fornecido.
`.trim();

    const generateWithModel = async (model: string): Promise<Omit<MealPlan, 'id'>> => {
      const response = await getAiClient().models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: mealPlanSchema,
        },
      });

      const parsed = parseJsonResponse<unknown>(response.text ?? '');      const validated = validateMealPlan(parsed);
      if (validated.name === 'OUT_OF_SCOPE') {
        throw new Error(OUT_OF_SCOPE_CHAT_MESSAGE);
      }
      return validated;
    };

    try {
      return await generateWithModel(MODELS.mealPlanPrimary);
    } catch (error) {
      if (shouldFallbackToAlternativeModel(error)) {
        return await generateWithModel(MODELS.mealPlanFallback);
      }

      throw error;
    }
  });
};

/**
 * Gera uma receita estruturada em JSON.
 */
export const generateRecipe = async (request: string): Promise<Omit<Recipe, 'id'>> => {
  return runGeminiRequest(async () => {
    const prompt = `
${NUTRITION_EXPERT_PERSONA}

Use como base as evidências resumidas abaixo e não invente estudos ou números não sustentados:
${EVIDENCE_CONTEXT}

Crie uma receita detalhada baseada no seguinte pedido:
"${sanitizeText(request)}"

Regras:
- Responda apenas sobre nutrição, receitas e alimentação. Se o pedido estiver fora desse escopo, retorne a string exata "OUT_OF_SCOPE" no campo "name" e preencha os demais campos com valores genéricos para não quebrar o schema.
- Retorne:
  - name
  - description
  - prepTime
  - cookTime
  - servings
  - ingredients
  - instructions
  - nutrition
- Use linguagem clara e ingredientes plausíveis.
- A resposta DEVE ser JSON válido no schema fornecido.
`.trim();

    const generateWithModel = async (model: string): Promise<Omit<Recipe, 'id'>> => {
      const response = await getAiClient().models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: recipeSchema,
        },
      });

      const parsed = parseJsonResponse<unknown>(response.text ?? '');      const validated = validateRecipe(parsed);
      if (validated.name === 'OUT_OF_SCOPE') {
        throw new Error(OUT_OF_SCOPE_CHAT_MESSAGE);
      }
      return validated;
    };

    try {
      return await generateWithModel(MODELS.recipePrimary);
    } catch (error) {
      if (shouldFallbackToAlternativeModel(error)) {
        return await generateWithModel(MODELS.recipeFallback);
      }

      throw error;
    }
  });
};

/**
 * Gera uma substituição para uma refeição específica do plano atual.
 */
export const replaceMeal = async (
  profile: UserProfile,
  mealToReplace: string,
  currentPlan: Omit<MealPlan, 'id'>,
  customRequest?: string
): Promise<Meal> => {
  return runGeminiRequest(async () => {
    const prompt = `
${NUTRITION_EXPERT_PERSONA}

Use como base as evidências resumidas abaixo e não invente estudos ou números não sustentados:
${EVIDENCE_CONTEXT}

Preciso substituir uma refeição em um plano alimentar existente.

Perfil do usuário:
- Objetivo: ${goalTranslation[profile.goal]}
- Alergias: ${sanitizeText(profile.allergies) || 'Nenhuma'}
- Restrições alimentares: ${sanitizeText(profile.restrictions) || 'Nenhuma'}

Plano atual, apenas para contexto:
- Total de calorias diárias: ${currentPlan.totalNutrition.calories}
- Total de proteínas diárias: ${currentPlan.totalNutrition.protein}
- Refeições disponíveis: ${Object.keys(currentPlan.dailyPlan).join(', ')}

Refeição a ser substituída:
${mealToReplace}

Pedido do usuário:
"${sanitizeText(customRequest) || `Sugira uma alternativa para ${mealToReplace} coerente com meu objetivo.`}"

Regras:
- Responda apenas sobre substituições de refeições, alimentação e nutrição. Se o pedido estiver fora desse escopo, retorne a string exata "OUT_OF_SCOPE" no campo "name" e preencha os demais com valores genéricos.
- Gere somente uma nova refeição.
- Retorne:
  - name
  - description
  - ingredientsWithGrams
  - nutrition
- Mantenha coerência com o objetivo e as restrições.
- A resposta DEVE ser JSON válido no schema fornecido.
`.trim();

    const response = await getAiClient().models.generateContent({
      model: MODELS.replaceMeal,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: mealSchema,
      },
    });

      const parsed = parseJsonResponse<unknown>(response.text ?? '');    const validated = validateMeal(parsed);
    if (validated.name === 'OUT_OF_SCOPE') {
      throw new Error(OUT_OF_SCOPE_CHAT_MESSAGE);
    }
    return validated;
  });
};

/**
 * Gera uma dica curta do dia voltada ao objetivo do usuário.
 */
export const generateDailyTip = async (profile: UserProfile): Promise<string> => {
  const randomTopicSeed = Math.floor(Math.random() * 10000);
  const prompt = `
${NUTRITION_EXPERT_PERSONA}

Use como base as evidências resumidas abaixo e não invente estudos ou números não sustentados:
${EVIDENCE_CONTEXT}

Gere uma dica curta, motivacional e acionável, com no máximo 250 caracteres, para um usuário com o objetivo:
"${goalTranslation[profile.goal]}"

Regras:
- A dica deve ser estritamente sobre alimentação e hábitos nutricionais.
- Não use título.
- Retorne apenas o texto da dica.
- Pode usar negrito com asteriscos.
- Importante: Gere uma dica única, criativa e diferente das mais comuns (Semente de variação: ${randomTopicSeed}).
`.trim();

   try {
    const response = await callProxy(prompt, false);
    return response.trim();
  } catch (error) {
    throw new Error(getGeminiErrorMessage(error));
  }
};