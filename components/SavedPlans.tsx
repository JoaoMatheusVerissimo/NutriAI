import React, { useState } from 'react';
import { MealPlan, Meal } from '../types';
import Card from './ui/Card';
import { DownloadIcon } from './icons/DownloadIcon';
import jsPDF from 'jspdf';

interface SavedPlansProps {
  savedPlans: MealPlan[];
  onDeletePlan: (planId: string) => Promise<boolean>;
  onUpdatePlan: (planId: string, newName: string) => Promise<boolean>;
}

const SavedPlans: React.FC<SavedPlansProps> = ({ savedPlans, onDeletePlan, onUpdatePlan }) => {
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);

  const togglePlan = (planId: string) => {
    if (editingPlanId === planId) return; // Don't collapse while editing
    setExpandedPlanId(expandedPlanId === planId ? null : planId);
  };
  
  const handleSaveName = async (planId: string) => {
    if (editingName.trim()) {
      const success = await onUpdatePlan(planId, editingName.trim());
      if (success) {
        setActionError(null);
        setEditingPlanId(null);
      } else {
        setActionError('Não foi possível renomear o plano agora.');
      }
    }
  };

  const handleDownloadPlanPDF = (plan: MealPlan) => {
    const doc = new jsPDF();
    const margin = 15;
    let y = 20;

    const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > 280) {
            doc.addPage();
            y = 20;
        }
    }

    // Title
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Plano Alimentar NutriAI', doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
    y += 15;

    // Plan Name
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    const nameLines = doc.splitTextToSize(`Plano: ${plan.name}`, 180);
    doc.text(nameLines, margin, y);
    y += nameLines.length * 6 + 2;

    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Salvo em: ${new Date(plan.id).toLocaleDateString()}`, margin, y);
    y += 15;
    doc.setTextColor(0);

    // Total Nutrition
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo Nutricional do Dia', margin, y);
    y += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const nutritionText = `  • Calorias: ${plan.totalNutrition.calories} kcal\n  • Proteínas: ${plan.totalNutrition.protein}g\n  • Carboidratos: ${plan.totalNutrition.carbs}g\n  • Gorduras: ${plan.totalNutrition.fat}g`;
    doc.text(nutritionText, margin, y);
    y += 25;

    // Helper function for adding meals
    const addMeal = (title: string, meal: Meal | undefined) => {
        if (!meal) return;
      checkPageBreak(30);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(title, margin, y);
        y += 7;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(meal.name, margin, y);
        y += 6;
        doc.setFontSize(10);
        doc.setTextColor(100);
        const descriptionLines = doc.splitTextToSize(meal.description, 170);
        doc.text(descriptionLines, margin, y);
        y += descriptionLines.length * 4 + 8;

        if (meal.ingredientsWithGrams && meal.ingredientsWithGrams.length > 0) {
          doc.setFontSize(10);
          doc.setTextColor(0);
          doc.text('Itens e gramas:', margin, y);
          y += 5;
          meal.ingredientsWithGrams.forEach((item) => {
            const itemLines = doc.splitTextToSize(`- ${item}`, 170);
            checkPageBreak(itemLines.length * 4 + 2);
            doc.text(itemLines, margin + 2, y);
            y += itemLines.length * 4 + 1;
          });
          y += 4;
        }

        doc.setTextColor(0);
    };

    addMeal('Café da Manhã', plan.dailyPlan.breakfast);
    addMeal('Almoço', plan.dailyPlan.lunch);
    addMeal('Jantar', plan.dailyPlan.dinner);
    plan.dailyPlan.snacks?.forEach((snack, i) => addMeal(`Lanche ${i + 1}`, snack));

    checkPageBreak(40);
    y += 10;
    
    // Shopping List
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Lista de Compras', margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    plan.shoppingList.forEach(item => {
        checkPageBreak(5);
        doc.text(`• ${item}`, margin, y);
        y+= 5;
    });

    checkPageBreak(40);
    y += 10;
    
    // Substitutions
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Sugestões de Substituição', margin, y);
    y += 8;
    doc.setFontSize(10);
    plan.substitutions.forEach(sub => {
        const subText = `• ${sub.original}: ${sub.replacement}`;
        const subLines = doc.splitTextToSize(subText, 180);
        checkPageBreak(subLines.length * 5);
        doc.text(subLines, margin, y);
        y += subLines.length * 4 + 1;
    });

    const fileName = `Plano-NutriAI-${plan.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    doc.save(fileName);
};


  if (savedPlans.length === 0) {
    return (
        <div className="p-4 md:p-8 text-center">
            <h1 className="text-3xl font-bold text-text dark:text-gray-50 mb-2">Planos Salvos</h1>
            <p className="text-text-light dark:text-gray-400 mt-8">Você ainda não salvou nenhum plano alimentar.</p>
            <p className="text-text-light dark:text-gray-400">Vá para o Planejador para criar e salvar seu primeiro plano!</p>
        </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold text-text dark:text-gray-50 mb-8">Seus Planos Salvos</h1>
      {actionError && <p className="mb-4 text-red-500">{actionError}</p>}
      <div className="space-y-4">
        {savedPlans.map((plan) => (
          <Card key={plan.id}>
            <div className="cursor-pointer" onClick={() => togglePlan(plan.id)}>
              <div className="flex justify-between items-center">
                {editingPlanId === plan.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xl font-bold text-primary-dark p-1 border border-primary rounded-md flex-grow dark:bg-gray-700 dark:text-gray-50"
                    autoFocus
                  />
                ) : (
                  <h2 className="text-xl font-bold text-primary-dark">{plan.name}</h2>
                )}
                <div className="flex items-center space-x-4 ml-4">
                  {editingPlanId === plan.id ? (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); void handleSaveName(plan.id); }} className="text-sm text-green-600 hover:text-green-800 font-semibold">Salvar</button>
                      <button onClick={(e) => { e.stopPropagation(); setEditingPlanId(null); }} className="text-sm text-gray-600 hover:text-gray-800 font-semibold">Cancelar</button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-text-light dark:text-gray-400 whitespace-nowrap hidden sm:inline">
                        {new Date(plan.id).toLocaleDateString()}
                      </span>
                      <button title="Baixar PDF" onClick={(e) => { e.stopPropagation(); handleDownloadPlanPDF(plan); }} className="text-gray-500 hover:text-primary"><DownloadIcon className="w-5 h-5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); setEditingPlanId(plan.id); setEditingName(plan.name); setExpandedPlanId(plan.id); }} className="text-blue-500 hover:text-blue-700 font-semibold text-sm">Renomear</button>
                      <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                if (window.confirm(`Tem certeza que deseja excluir o plano "${plan.name}"?`)) {
                                  const success = await onDeletePlan(plan.id);
                                  if (!success) {
                                    setActionError('Não foi possível excluir o plano agora.');
                                  }
                                }
                            }}
                            className="text-red-500 hover:text-red-700 font-semibold text-sm"
                        >
                            Excluir
                        </button>
                      <span className={`transform transition-transform text-text-light dark:text-gray-400 ${expandedPlanId === plan.id ? 'rotate-180' : ''}`}>▼</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {expandedPlanId === plan.id && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 animate-fade-in">
                 <h3 className="text-lg font-semibold mb-2 dark:text-gray-50">Total de Nutrientes:</h3>
                 <p className="text-text-light dark:text-gray-400">
                    {plan.totalNutrition.calories} kcal, {plan.totalNutrition.protein}g Proteína, {plan.totalNutrition.carbs}g Carboidratos, {plan.totalNutrition.fat}g Gordura
                 </p>
                 <h3 className="text-lg font-semibold mt-4 mb-2 dark:text-gray-50">Refeições:</h3>
                 <ul className="list-disc pl-5 text-text-light dark:text-gray-400">
                    <li>
                      <strong>Café da Manhã:</strong> {plan.dailyPlan.breakfast.description}
                      {plan.dailyPlan.breakfast.ingredientsWithGrams?.length ? (
                        <div className="mt-1 text-sm">
                          {plan.dailyPlan.breakfast.ingredientsWithGrams.join(', ')}
                        </div>
                      ) : null}
                    </li>
                    <li>
                      <strong>Almoço:</strong> {plan.dailyPlan.lunch.description}
                      {plan.dailyPlan.lunch.ingredientsWithGrams?.length ? (
                        <div className="mt-1 text-sm">
                          {plan.dailyPlan.lunch.ingredientsWithGrams.join(', ')}
                        </div>
                      ) : null}
                    </li>
                    <li>
                      <strong>Jantar:</strong> {plan.dailyPlan.dinner.description}
                      {plan.dailyPlan.dinner.ingredientsWithGrams?.length ? (
                        <div className="mt-1 text-sm">
                          {plan.dailyPlan.dinner.ingredientsWithGrams.join(', ')}
                        </div>
                      ) : null}
                    </li>
                    {plan.dailyPlan.snacks?.map((s, i) => (
                      <li key={i}>
                        <strong>Lanche:</strong> {s.description}
                        {s.ingredientsWithGrams?.length ? (
                          <div className="mt-1 text-sm">{s.ingredientsWithGrams.join(', ')}</div>
                        ) : null}
                      </li>
                    ))}
                 </ul>
                 <h3 className="text-lg font-semibold mt-4 mb-2 dark:text-gray-50">Lista supermercado</h3>
                 <ul className="list-disc pl-5 text-text-light dark:text-gray-400 columns-2 md:columns-3">
                    {plan.shoppingList.map((item, index) => <li key={index}>{item}</li>)}
                 </ul>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SavedPlans;