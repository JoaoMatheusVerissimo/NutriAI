import React, { useState } from 'react';
import { generateRecipe, getGeminiErrorMessage } from '../services/geminiService';
import { Recipe } from '../types';
import Spinner from './ui/Spinner';
import Card from './ui/Card';

const NutritionPill: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="bg-primary-light text-primary-dark text-sm font-medium px-3 py-1 rounded-full">
        {label}: {value}
    </div>
);

interface RecipesProps {
    onSaveRecipe: (recipe: Recipe) => Promise<boolean>;
}

const Recipes: React.FC<RecipesProps> = ({ onSaveRecipe }) => {
    const [request, setRequest] = useState('');
    const [recipe, setRecipe] = useState<Recipe | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSaved, setIsSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const examplePrompts = [
        "Almoço vegetariano rico em proteínas",
        "Vitamina rápida para o café da manhã",
        "Jantar saudável de salmão com menos de 400 calorias",
        "Uma sobremesa sem glúten"
    ];

    const handleGenerate = async () => {
        if (!request.trim()) {
            setError("Por favor, insira uma ideia de receita.");
            return;
        }
        setLoading(true);
        setError(null);
        setRecipe(null);
        setIsSaved(false);
        try {
            const result = await generateRecipe(request);
            setRecipe({ ...result, id: crypto.randomUUID() });
        } catch (err) {
            console.error(err);
            setError(getGeminiErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleExampleClick = (prompt: string) => {
        setRequest(prompt);
    };

    const handleSave = async () => {
        if (recipe) {
            setIsSaving(true);
            const success = await onSaveRecipe(recipe);
            setIsSaving(false);
            setIsSaved(success);
            if (!success) {
                setError('Não foi possível salvar a receita agora. Tente novamente.');
            }
        }
    }

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold text-text dark:text-gray-50 mb-2">Gerador de Receitas IA</h1>
            <p className="text-text-light dark:text-gray-400 mb-8">Procurando inspiração culinária? Descreva o que você deseja.</p>

            <Card className="mb-8">
                <div className="space-y-4">
                    <textarea
                        value={request}
                        onChange={(e) => setRequest(e.target.value)}
                        placeholder="ex: 'Uma receita saudável de frango com abacate que leva menos de 30 minutos.'"
                        className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-gray-50 dark:placeholder-gray-400"
                        rows={3}
                    />
                    <div className="flex flex-wrap gap-2">
                        <span className="text-sm text-text-light dark:text-gray-400 my-auto">Ideias:</span>
                        {examplePrompts.map(p => (
                            <button key={p} onClick={() => handleExampleClick(p)} className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded-md transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300">
                                {p}
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={handleGenerate}
                            disabled={loading}
                            className="px-8 py-3 bg-accent text-black font-bold rounded-lg shadow-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent transition-transform duration-150 ease-in-out hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100"
                        >
                            {loading ? 'Buscando...' : 'Encontrar Receita'}
                        </button>
                    </div>
                </div>
            </Card>

            {loading && <Spinner />}
            {error && <p className="text-red-500 text-center">{error}</p>}

            {recipe && (
                <Card className="animate-fade-in">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h2 className="text-3xl font-bold text-primary-dark">{recipe.name}</h2>
                            <p className="text-text-light dark:text-gray-400 mt-2">{recipe.description}</p>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={isSaved || isSaving}
                            className="px-4 py-2 bg-accent text-black font-semibold rounded-md shadow-sm hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap ml-4"
                        >
                            {isSaved ? 'Salva!' : isSaving ? 'Salvando...' : 'Salvar Receita'}
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-4 my-6 text-sm text-text dark:text-gray-50">
                        <span className="font-semibold">Preparo: {recipe.prepTime}</span>
                        <span className="font-semibold">Cozimento: {recipe.cookTime}</span>
                        <span className="font-semibold">Porções: {recipe.servings}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-6">
                        <NutritionPill label="Calorias" value={recipe.nutrition.calories} />
                        <NutritionPill label="Proteína" value={`${recipe.nutrition.protein}g`} />
                        <NutritionPill label="Carbs" value={`${recipe.nutrition.carbs}g`} />
                        <NutritionPill label="Gordura" value={`${recipe.nutrition.fat}g`} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="md:col-span-1">
                            <h3 className="text-xl font-bold text-text dark:text-gray-50 mb-3">Ingredientes</h3>
                            <ul className="list-disc pl-5 space-y-2 text-text-light dark:text-gray-400">
                                {recipe.ingredients.map((item, index) => <li key={index}>{item}</li>)}
                            </ul>
                        </div>
                        <div className="md:col-span-2">
                            <h3 className="text-xl font-bold text-text dark:text-gray-50 mb-3">Instruções</h3>
                            <ol className="list-decimal pl-5 space-y-3 text-text-light dark:text-gray-400">
                                {recipe.instructions.map((step, index) => <li key={index}>{step}</li>)}
                            </ol>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default Recipes;
