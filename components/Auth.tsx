import React, { useState } from 'react';
import Card from './ui/Card';
import { ChartIcon } from './icons/ChartIcon';
import { useTheme } from '../hooks/useTheme';
import { SunIcon } from './icons/SunIcon';
import { MoonIcon } from './icons/MoonIcon';
import { EyeIcon } from './icons/EyeIcon';
import { EyeOffIcon } from './icons/EyeOffIcon';
import { useAuth } from '../hooks/useAuth';

const Auth: React.FC = () => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [theme, setTheme] = useTheme();
  const { register, login, sendPasswordReset } = useAuth();

  const passwordRules = [
    { label: 'Mínimo de 8 caracteres', test: (p: string) => p.length >= 8 },
    { label: 'Pelo menos uma letra maiúscula', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'Pelo menos uma letra minúscula', test: (p: string) => /[a-z]/.test(p) },
    { label: 'Pelo menos um número', test: (p: string) => /[0-9]/.test(p) },
    { label: 'Pelo menos um caractere especial (!@#$%...)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
    { label: 'As senhas devem coincidir', test: (p: string, c: string) => c.length > 0 && p === c },
  ];

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const isRegisterFormValid =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    passwordRules.every((rule) => rule.test(password, confirmPassword));

  const isSubmitDisabled = loading || (!isLoginMode && !isRegisterFormValid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!email || !password || (!isLoginMode && (!name || !confirmPassword))) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    if (!isLoginMode) {
      const failedRule = passwordRules.find((rule) => !rule.test(password, confirmPassword));
      if (failedRule) {
        setPasswordFocused(true);
        return;
      }
    }

    setLoading(true);

    try {
      let result;
      if (isLoginMode) {
        result = await login(email, password);
      } else {
        result = await register(name, email, password);
      }

      if (!result.success) {
        setError(result.message || 'Nao foi possivel concluir a autenticacao.');
      } else {
        if (result.message) {
          setInfoMessage(result.message);
        }

        if (!isLoginMode) {
          setIsLoginMode(true);
        }

        setName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      }
    } catch {
      setError('Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setError('');
    setInfoMessage('');
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setPasswordFocused(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleForgotPassword = async () => {
    setError('');
    setInfoMessage('');

    if (!email) {
      setError('Informe seu e-mail para recuperar a senha.');
      return;
    }

    setLoading(true);
    try {
      const result = await sendPasswordReset(email);
      if (!result.success) {
        setError(result.message || 'Nao foi possivel enviar o e-mail de recuperacao de senha.');
        return;
      }
      setInfoMessage(result.message || 'Confira seu e-mail para redefinir a senha.');
    } catch {
      setError('Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background dark:bg-gray-900 min-h-screen flex items-center justify-center p-4 relative">
       <div className="absolute top-6 right-6">
            <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-text-light dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
            {theme === 'light' ? <MoonIcon className="h-6 w-6" /> : <SunIcon className="h-6 w-6" />}
            </button>
       </div>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
            <ChartIcon className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-bold ml-3 text-text dark:text-gray-50">NutriAI</h1>
        </div>
        <Card>
          <h2 className="text-2xl font-bold text-center text-text dark:text-gray-50 mb-6">
            {isLoginMode ? 'Acessar sua Conta' : 'Criar Nova Conta'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLoginMode && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-text-light dark:text-gray-400">Nome</label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-gray-50 dark:placeholder-gray-400"
                  placeholder="Seu nome completo"
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-light dark:text-gray-400">E-mail</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-gray-50 dark:placeholder-gray-400"
                placeholder="seuemail@exemplo.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-light dark:text-gray-400">Senha</label>
              <div className="mt-1 relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  className="block w-full p-2 pr-20 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-gray-50 dark:placeholder-gray-400"
                  placeholder="Sua senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-2 my-auto h-fit p-1 text-text-light dark:text-gray-300 hover:text-primary"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
              {!isLoginMode && (passwordFocused || confirmPassword.length > 0) && (
                <ul className="mt-2 space-y-1">
                  {passwordRules.map((rule) => {
                    const passed = rule.test(password, confirmPassword);
                    return (
                      <li key={rule.label} className={`flex items-center gap-1.5 text-xs ${passed ? 'text-green-500' : 'text-red-500'}`}>
                        <span>{passed ? '✓' : '✗'}</span>
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              )}
              {isLoginMode && (
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={loading}
                    className="text-sm text-primary hover:text-primary-dark font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Esqueceu sua senha?
                  </button>
                </div>
              )}
            </div>
            {!isLoginMode && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-light dark:text-gray-400">Confirme sua senha</label>
                <div className="mt-1 relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full p-2 pr-20 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-gray-50 dark:placeholder-gray-400"
                    placeholder="Repita sua senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-2 my-auto h-fit p-1 text-text-light dark:text-gray-300 hover:text-primary"
                    aria-label={showConfirmPassword ? 'Ocultar confirmacao de senha' : 'Mostrar confirmacao de senha'}
                  >
                    {showConfirmPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            )}
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            {infoMessage && <p className="text-green-600 text-sm text-center">{infoMessage}</p>}
            <div>
              <button 
                type="submit" 
                disabled={isSubmitDisabled}
                className={`w-full px-6 py-3 font-bold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  'bg-primary text-black hover:bg-primary-dark focus:ring-primary'
                }`}
              >
                {loading ? 'Processando...' : (isLoginMode ? 'Entrar' : 'Cadastrar')}
              </button>
            </div>
          </form>
          <div className="mt-6 text-center">
            <button onClick={toggleMode} className="text-sm text-primary hover:text-primary-dark font-medium">
              {isLoginMode ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Faça login'}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
