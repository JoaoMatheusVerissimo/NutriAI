import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile, MealPlan, Meal, NutritionInfo } from '../types';
import { useDailyLocalStorage } from '../hooks/useDailyLocalStorage';
import { generateDailyTip, getGeminiErrorMessage } from '../services/geminiService';
import Card from './ui/Card';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { DropletIcon } from './icons/DropletIcon';
import { LeafIcon } from './icons/LeafIcon';
import { RefreshCwIcon } from './icons/RefreshCwIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';

interface HomeProps {
  profile: UserProfile;
  savedPlans: MealPlan[];
  userId: string;
  onNavigate: (view: string) => void;
}

const ProgressBar: React.FC<{ value: number; maxValue: number; colorClass: string; label: string }> = ({ value, maxValue, colorClass, label }) => {
    const isOver = value > maxValue;
    const percentage = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;

    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-text dark:text-gray-300">{label}</span>
                <span className={`text-sm font-medium ${isOver ? 'text-red-500' : 'text-text-light dark:text-gray-400'}`}>
                    {Math.round(value)}g / {Math.round(maxValue)}g
                </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div className={`${colorClass} h-2.5 rounded-full`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

const TipOfTheDay: React.FC<{ profile: UserProfile; userId: string }> = ({ profile, userId }) => {
    const [cachedTip, setCachedTip] = useDailyLocalStorage<string>(`dailyTip_${userId}`, '');
    const [tip, setTip] = useState(cachedTip);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const fetchingRef = useRef(false);
    const [spinning, setSpinning] = useState(false);

    // Remove blocos <think> que modelos de raciocínio incluem
    const cleanThinking = (text: string): string => {
        let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
        clean = clean.replace(/<think>[\s\S]*/gi, '');
        return clean.trim();
    };

    const fetchTip = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh && cachedTip) {
            setTip(cleanThinking(cachedTip));
            setIsLoading(false);
            return;
        }

        if (fetchingRef.current) return;
        fetchingRef.current = true;

        setSpinning(true);
        setTip('');
        setIsLoading(true);
        setError(null);
        try {
            const rawTip = await generateDailyTip(profile);
            const newTip = cleanThinking(rawTip);
            setTip(newTip);
            setCachedTip(newTip);
        } catch (err) {
            console.error(err);
            setError(getGeminiErrorMessage(err));
        } finally {
            setIsLoading(false);
            setSpinning(false);
            fetchingRef.current = false;
        }
    }, [cachedTip, profile, setCachedTip]);

    useEffect(() => {
        fetchTip();
    }, [fetchTip]);

    const renderBoldText = (text: string) => {
        if (!text) return null;
        const parts = text.split(/(\*.*?\*|\*\*.*?\*\*)/g);
        return parts.map((part, index) => {
          if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('**') && part.endsWith('**'))) {
            return <strong key={index}>{part.replace(/\*/g, '')}</strong>;
          }
          return part;
        });
    };

    return (
        <Card>
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-bold text-text dark:text-gray-50 flex items-center">
                    <LightbulbIcon className="w-6 h-6 mr-2 text-primary" /> Dica do Dia
                </h2>
                <button
                    onClick={() => { setSpinning(true); fetchTip(true); }}
                    disabled={isLoading}
                    className="p-1.5 text-gray-500 hover:text-primary disabled:cursor-wait disabled:opacity-50"
                    aria-label="Gerar nova dica"
                >
                    <RefreshCwIcon className={`w-5 h-5 ${spinning ? 'animate-spin' : ''}`} />
                </button>
            </div>
            {isLoading && !tip && <p className="text-text-light dark:text-gray-400 italic">Buscando uma dica para você...</p>}
            
            {error && <p className="text-red-500 italic">{error}</p>}
            {!isLoading && !error && tip && <p className="text-text-light dark:text-gray-400 italic">"{renderBoldText(tip)}"</p>}
        </Card>
    );
};


const Home: React.FC<HomeProps> = ({ profile, savedPlans, userId, onNavigate }) => {
  const [waterIntake] = useDailyLocalStorage<number>(`waterIntake_${userId}`, 0);
  const waterGoal = profile.weight > 0 ? Math.round(profile.weight * 35) : 2000;

  const latestPlan = useMemo(() => {
    if (savedPlans.length === 0) return null;
    return [...savedPlans].sort((a, b) => b.id.localeCompare(a.id))[0];
  }, [savedPlans]);

  const [checkedMeals, setCheckedMeals] = useDailyLocalStorage<string[]>(`checkedMeals_${userId}`, []);

  const consumedNutrition = useMemo(() => {
    const initialNutrition: NutritionInfo = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    if (!latestPlan) return initialNutrition;

    return checkedMeals.reduce((total, mealKey) => {
      let meal: Meal | undefined;
      if (mealKey.startsWith('snacks.')) {
        const index = parseInt(mealKey.split('.')[1], 10);
        meal = latestPlan.dailyPlan.snacks?.[index];
      } else {
        meal = latestPlan.dailyPlan[mealKey as 'breakfast' | 'lunch' | 'dinner'];
      }

      if (meal) {
        total.calories += meal.nutrition.calories;
        total.protein += meal.nutrition.protein;
        total.carbs += meal.nutrition.carbs;
        total.fat += meal.nutrition.fat;
      }
      return total;
    }, initialNutrition);
  }, [latestPlan, checkedMeals]);

  const handleCheckMeal = (mealKey: string) => {
    setCheckedMeals(prev =>
      prev.includes(mealKey)
        ? prev.filter(k => k !== mealKey)
        : [...prev, mealKey]
    );
  };

  const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return "Bom dia";
      if (hour < 18) return "Boa tarde";
      return "Boa noite";
  }

  const mealsToList = useMemo(() => {
    if (!latestPlan) return [];
    const { breakfast, lunch, dinner, snacks } = latestPlan.dailyPlan;
    return [
      { key: 'breakfast', title: 'Café da Manhã', meal: breakfast },
      { key: 'lunch', title: 'Almoço', meal: lunch },
      { key: 'dinner', title: 'Jantar', meal: dinner },
      ...(snacks?.map((snack, index) => ({
        key: `snacks.${index}`,
        title: `Lanche ${index + 1}`,
        meal: snack
      })) || [])
    ].filter(item => item.meal);
  }, [latestPlan]);

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold text-text dark:text-gray-50 mb-2">{getGreeting()}, {profile.name}!</h1>
      <p className="text-text-light dark:text-gray-400 mb-8">Aqui está um resumo do seu dia.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            <TipOfTheDay profile={profile} userId={userId} />

            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-text dark:text-gray-50 flex items-center">
                         <LeafIcon className="w-6 h-6 mr-2 text-primary" /> Plano de Hoje
                    </h2>
                     <button onClick={() => onNavigate('planner')} className="text-sm text-primary hover:text-primary-dark font-semibold">
                        Ver/Mudar Plano
                    </button>
                </div>
                {latestPlan ? (
                    <div>
                        <h3 className="text-2xl font-bold text-primary-dark mb-4">{latestPlan.name}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            <div className="flex flex-col items-center justify-center">
                                <p className="text-5xl font-extrabold text-text dark:text-gray-50">
                                    {Math.round(consumedNutrition.calories)}
                                   <span className="text-xl font-medium text-text-light dark:text-gray-400"> / {latestPlan.totalNutrition.calories} kcal</span>
                                </p>
                                 <p className="text-sm text-text-light dark:text-gray-400 mt-1">Calorias consumidas</p>
                            </div>
                            <div className="space-y-4">
                                <ProgressBar label="Proteínas" value={consumedNutrition.protein} maxValue={latestPlan.totalNutrition.protein} colorClass="bg-red-500" />
                                <ProgressBar label="Carboidratos" value={consumedNutrition.carbs} maxValue={latestPlan.totalNutrition.carbs} colorClass="bg-yellow-500" />
                                <ProgressBar label="Gorduras" value={consumedNutrition.fat} maxValue={latestPlan.totalNutrition.fat} colorClass="bg-blue-500" />
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                             <h4 className="font-semibold text-text dark:text-gray-50 mb-3">Check-in de Refeições:</h4>
                             <div className="space-y-3">
                                {mealsToList.map(({ key, title, meal }) => {
                                    const isChecked = checkedMeals.includes(key);
                                    return (
                                        <div key={key} className={`p-3 rounded-lg transition-colors ${isChecked ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                                            <div className="flex items-center justify-between">
                                                <div className={`flex-grow pr-4 ${isChecked ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-text dark:text-gray-50'}`}>
                                                    <p className="font-bold">{title}: <span className="font-normal">{meal.name}</span></p>
                                                    <p className="text-xs text-text-light dark:text-gray-500">
                                                        {meal.nutrition.calories} kcal, P:{meal.nutrition.protein}g, C:{meal.nutrition.carbs}g, G:{meal.nutrition.fat}g
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleCheckMeal(key)}
                                                    title={isChecked ? 'Desmarcar' : 'Marcar como consumido'}
                                                    className="ml-4 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex-shrink-0"
                                                >
                                                    {isChecked
                                                        ? <CheckCircleIcon className="w-7 h-7 text-primary" />
                                                        : <div className="w-7 h-7 rounded-full border-2 border-gray-400"></div>
                                                    }
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <p className="text-text-light dark:text-gray-400 mb-4">Nenhum plano alimentar para hoje.</p>
                        <button
                            onClick={() => onNavigate('planner')}
                            className="px-6 py-2 bg-primary text-black font-bold rounded-lg shadow-md hover:bg-primary-dark"
                        >
                            Criar um Plano Agora
                        </button>
                    </div>
                )}
            </Card>
        </div>

        <div className="space-y-6">
             <Card>
                <h2 className="text-xl font-bold text-text dark:text-gray-50 mb-3 flex items-center">
                    <DropletIcon className="w-6 h-6 mr-2 text-primary" /> Hidratação
                </h2>
                <div className="text-center">
                    <p className="text-4xl font-extrabold text-primary-dark">{waterIntake}<span className="text-xl text-text-light dark:text-gray-400">ml</span></p>
                    <p className="text-sm text-text-light dark:text-gray-400">de {waterGoal}ml</p>
                </div>
                 <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mt-4">
                    <div className="bg-blue-400 h-4 rounded-full" style={{ width: `${Math.min(100, (waterIntake/waterGoal) * 100)}%` }}></div>
                </div>
                <button onClick={() => onNavigate('water')} className="mt-4 w-full text-sm text-primary hover:text-primary-dark font-semibold text-center">
                    Adicionar Água
                </button>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default Home;