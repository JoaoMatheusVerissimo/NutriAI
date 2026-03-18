import React, { useState } from 'react';
import { UserProfile } from '../types';
import Card from './ui/Card';
import { ChartIcon } from './icons/ChartIcon';

interface OnboardingProps {
  profile: UserProfile;
  onSave: (profile: UserProfile) => Promise<boolean>;
  saveError?: string | null;
}

const Onboarding: React.FC<OnboardingProps> = ({ profile, onSave, saveError }) => {
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [error, setError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'age' || name === 'weight' || name === 'height'
          ? value === ''
            ? 0
            : Number(value)
          : value,
    }));
  };

  const validateForm = (): string => {
    if (!formData.age || formData.age < 12 || formData.age > 100) {
      return 'Informe uma idade válida entre 12 e 100 anos.';
    }

    if (!formData.weight || formData.weight < 30 || formData.weight > 300) {
      return 'Informe um peso válido entre 30 kg e 300 kg.';
    }

    if (!formData.height || formData.height < 120 || formData.height > 230) {
      return 'Informe uma altura válida entre 120 cm e 230 cm.';
    }

    if (!formData.sex) {
      return 'Selecione o sexo para continuar.';
    }

    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setIsSaving(true);

    const sanitizedProfile: UserProfile = {
      ...formData,
      allergies: formData.allergies?.trim() || '',
      restrictions: formData.restrictions?.trim() || '',
    };

    const success = await onSave(sanitizedProfile);

    if (!success) {
      setError('Não foi possível salvar seu perfil agora. Tente novamente.');
    }

    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-background p-4 dark:bg-gray-900">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center">
        <div className="w-full">
          <div className="mb-6 flex items-center justify-center">
            <ChartIcon className="h-8 w-8 text-primary" />
            <h1 className="ml-3 text-3xl font-bold text-text dark:text-gray-50">
              Bem-vindo(a) ao NutriAI!
            </h1>
          </div>

          <p className="mb-3 text-center text-text-light dark:text-gray-400">
            Complete seu perfil para receber recomendações alimentares mais alinhadas ao seu objetivo.
          </p>

          <p className="mb-6 text-center text-sm text-text-light dark:text-gray-500">
            Este aplicativo oferece apoio com foco em alimentação e não substitui orientação profissional.
          </p>

          <Card>
            <form onSubmit={handleSubmit} className="space-y-6">
              <h2 className="mb-4 text-xl font-bold text-text dark:text-gray-50">
                Complete seu Perfil
              </h2>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div>
                  <label
                    htmlFor="age"
                    className="block text-sm font-medium text-text-light dark:text-gray-400"
                  >
                    Idade
                  </label>
                  <input
                    type="number"
                    name="age"
                    id="age"
                    value={formData.age || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-gray-50 dark:placeholder-gray-400"
                    placeholder="Sua idade"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="weight"
                    className="block text-sm font-medium text-text-light dark:text-gray-400"
                  >
                    Peso (kg)
                  </label>
                  <input
                    type="number"
                    name="weight"
                    id="weight"
                    value={formData.weight || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-gray-50 dark:placeholder-gray-400"
                    placeholder="Seu peso"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="height"
                    className="block text-sm font-medium text-text-light dark:text-gray-400"
                  >
                    Altura (cm)
                  </label>
                  <input
                    type="number"
                    name="height"
                    id="height"
                    value={formData.height || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-gray-50 dark:placeholder-gray-400"
                    placeholder="Sua altura"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="sex"
                  className="block text-sm font-medium text-text-light dark:text-gray-400"
                >
                  Sexo
                </label>
                <select
                  name="sex"
                  id="sex"
                  value={formData.sex}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-gray-50"
                  required
                >
                  <option value="">Selecione</option>
                  <option value="female">Feminino</option>
                  <option value="male">Masculino</option>
                  <option value="non_binary">Não binário(a)</option>
                  <option value="prefer_not_to_say">Prefiro não dizer</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="goal"
                  className="block text-sm font-medium text-text-light dark:text-gray-400"
                >
                  Objetivo Principal
                </label>
                <select
                  name="goal"
                  id="goal"
                  value={formData.goal}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-gray-50"
                >
                  <option value="lose_weight">Perder peso</option>
                  <option value="maintain_weight">Manter peso</option>
                  <option value="gain_muscle">Ganhar massa muscular</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="allergies"
                  className="block text-sm font-medium text-text-light dark:text-gray-400"
                >
                  Alergias (opcional)
                </label>
                <textarea
                  name="allergies"
                  id="allergies"
                  value={formData.allergies || ''}
                  onChange={handleChange}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-gray-50 dark:placeholder-gray-400"
                  placeholder="Ex: amendoim, glúten, leite"
                />
              </div>

              <div>
                <label
                  htmlFor="restrictions"
                  className="block text-sm font-medium text-text-light dark:text-gray-400"
                >
                  Restrições alimentares (opcional)
                </label>
                <textarea
                  name="restrictions"
                  id="restrictions"
                  value={formData.restrictions || ''}
                  onChange={handleChange}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-gray-50 dark:placeholder-gray-400"
                  placeholder="Ex: vegetariano, sem lactose"
                />
              </div>

              {(error || saveError) && (
                <p className="text-center text-sm text-red-500">{error || saveError}</p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full rounded-lg bg-primary px-8 py-3 font-bold text-black shadow-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                >
                  {isSaving ? 'Salvando...' : 'Salvar e começar'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;