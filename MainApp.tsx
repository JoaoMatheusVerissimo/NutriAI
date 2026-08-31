import React, { Suspense, lazy, startTransition, useState } from 'react';
import Sidebar from './components/Sidebar';
import { useFirestore } from './hooks/useFirestore';
import LoadingScreen from './components/ui/LoadingScreen';
import { MealPlan, Recipe, SessionUser, UserProfile } from './types';
import { ChatBubbleIcon } from './components/icons/ChatBubbleIcon';

const Profile = lazy(() => import('./components/Profile'));
const Planner = lazy(() => import('./components/Planner'));
const Recipes = lazy(() => import('./components/Recipes'));
const SavedPlans = lazy(() => import('./components/SavedPlans'));
const SavedRecipes = lazy(() => import('./components/SavedRecipes'));
const WaterTracker = lazy(() => import('./components/WaterTracker'));
const Home = lazy(() => import('./components/Home'));
const Chatbot = lazy(() => import('./components/Chatbot'));

export type MainView =
  | 'home'
  | 'planner'
  | 'recipes'
  | 'water'
  | 'saved'
  | 'saved_recipes'
  | 'profile';

interface MainAppProps {
  user: SessionUser;
  onLogout: () => void;
  profile: UserProfile;
  onSaveProfile: (profile: UserProfile) => Promise<boolean>;
}

const MainApp: React.FC<MainAppProps> = ({
  user,
  onLogout,
  profile,
  onSaveProfile,
}) => {
  const [activeView, setActiveView] = useState<MainView>('home');
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  const [savedPlans, setSavedPlans, loadingPlans, savedPlansError] =
    useFirestore<MealPlan[]>(user.id, 'savedPlans', []);

  const [savedRecipes, setSavedRecipes, loadingRecipes, savedRecipesError] =
    useFirestore<Recipe[]>(user.id, 'savedRecipes', []);

  const handleSavePlan = async (plan: MealPlan): Promise<boolean> => {
    const alreadyExists = savedPlans.some((savedPlan) => savedPlan.id === plan.id);
    if (alreadyExists) return true;
    return setSavedPlans([...savedPlans, plan]);
  };

  const handleDeletePlan = async (planId: string): Promise<boolean> =>
    setSavedPlans(savedPlans.filter((plan) => plan.id !== planId));

  const handleUpdatePlan = async (planId: string, newName: string): Promise<boolean> =>
    setSavedPlans(savedPlans.map((plan) => (plan.id === planId ? { ...plan, name: newName } : plan)));

  const handleSaveRecipe = async (recipe: Recipe): Promise<boolean> => {
    const alreadyExists = savedRecipes.some((r) => r.id === recipe.id);
    if (alreadyExists) return true;
    return setSavedRecipes([...savedRecipes, recipe]);
  };

  const handleDeleteRecipe = async (recipeId: string): Promise<boolean> =>
    setSavedRecipes(savedRecipes.filter((r) => r.id !== recipeId));

  const handleUpdateRecipe = async (recipeId: string, newName: string): Promise<boolean> =>
    setSavedRecipes(savedRecipes.map((r) => (r.id === recipeId ? { ...r, name: newName } : r)));

  const handleNavigate = (view: string) => {
    startTransition(() => {
      setActiveView(view as MainView);
    });
  };

  const renderContent = () => {
    switch (activeView) {
      case 'home':
        return (
          <Home
            profile={profile}
            savedPlans={savedPlans}
            userId={user.id}
            onNavigate={handleNavigate}
          />
        );
      case 'planner':
        return <Planner profile={profile} onSavePlan={handleSavePlan} />;
      case 'recipes':
        return <Recipes onSaveRecipe={handleSaveRecipe} />;
      case 'water':
        return <WaterTracker profile={profile} userId={user.id} />;
      case 'saved':
        return (
          <SavedPlans
            savedPlans={savedPlans}
            onDeletePlan={handleDeletePlan}
            onUpdatePlan={handleUpdatePlan}
          />
        );
      case 'saved_recipes':
        return (
          <SavedRecipes
            savedRecipes={savedRecipes}
            onDeleteRecipe={handleDeleteRecipe}
            onUpdateRecipe={handleUpdateRecipe}
          />
        );
      case 'profile':
        return <Profile profile={profile} onSave={onSaveProfile} />;
      default:
        return (
          <Home
            profile={profile}
            savedPlans={savedPlans}
            userId={user.id}
            onNavigate={handleNavigate}
          />
        );
    }
  };

  const isDataLoading = loadingPlans || loadingRecipes;
  const dataError = savedPlansError ?? savedRecipesError;

  return (
    <div className="min-h-screen bg-background font-sans dark:bg-gray-900">
      <div className="flex">
        <Sidebar
          user={user}
          activeView={activeView}
          onNavigate={handleNavigate}
          onLogout={onLogout}
        />

        {/*
         * Layout padding:
         *  - Mobile: pt-14 (top bar) + pb-16 (bottom nav)
         *  - Desktop (md+): ml-64 (sidebar), no extra top/bottom padding
         */}
        <main className="flex-1 pt-14 pb-16 md:pt-0 md:pb-0 md:ml-64">
          {isDataLoading && (
            <div className="mx-4 mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300 md:mx-8">
              Carregando seus dados salvos em segundo plano...
            </div>
          )}

          {dataError && (
            <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300 md:mx-8">
              {dataError.message}
            </div>
          )}

          <Suspense fallback={<LoadingScreen label="Abrindo seção..." compact />}>
            {renderContent()}
          </Suspense>
        </main>
      </div>

      {/* Chatbot FAB — hides behind mobile bottom nav, so offset is pb-20 on mobile */}
      {!isChatbotOpen && (
        <button
          onClick={() => setIsChatbotOpen(true)}
          className="fixed bottom-20 right-6 z-40 rounded-full bg-primary p-4 text-black shadow-lg transition-transform duration-200 hover:scale-110 hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 animate-fade-in md:bottom-8 md:right-8"
          aria-label="Abrir Coach Nutricional"
        >
          <ChatBubbleIcon className="h-7 w-7" />
        </button>
      )}

      {isChatbotOpen && (
        <Suspense fallback={<LoadingScreen label="Abrindo coach..." compact overlay />}>
          <Chatbot profile={profile} onClose={() => setIsChatbotOpen(false)} />
        </Suspense>
      )}
    </div>
  );
};

export default MainApp;
