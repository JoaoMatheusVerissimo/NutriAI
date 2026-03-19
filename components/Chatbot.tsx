import React, { useEffect, useRef, useState } from 'react';
import { UserProfile } from '../types';
import {
  createNutritionChatSession,
  getGeminiErrorMessage,
  hasGeminiClient,
} from '../services/geminiService';
import { ChatBubbleIcon } from './icons/ChatBubbleIcon';
import { XIcon } from './icons/XIcon';
import { SendIcon } from './icons/SendIcon';

interface ChatbotProps {
  onClose: () => void;
  profile: UserProfile;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

type NutritionChatSession = ReturnType<typeof createNutritionChatSession>;

const Chatbot: React.FC<ChatbotProps> = ({ onClose, profile }) => {
  const [chat, setChat] = useState<NutritionChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasGeminiClient()) {
      setChat(null);
      setMessages([
        {
          role: 'model',
          text: 'A chave da IA nao foi configurada. Gere uma nova chave Gemini e atualize VITE_GEMINI_API_KEY no arquivo .env.',
        },
      ]);
      return;
    }

    const newChat = createNutritionChatSession(profile);
    setChat(newChat);
    setMessages([
      {
        role: 'model',
        text: `Olá, ${profile.name}! Eu sou seu Coach Nutricional. Posso te ajudar com dúvidas sobre alimentação, estratégias nutricionais e escolhas alimentares.`,
      },
    ]);
  }, [profile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async () => {
    const currentInput = input.trim();

    if (!currentInput || isLoading || !chat) {
      return;
    }

    const userMessage: Message = {
      role: 'user',
      text: currentInput,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chat.sendMessage({ message: currentInput });

      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: response.text,
        },
      ]);
    } catch (error) {
      console.error('Erro ao enviar mensagem para a IA:', error);

      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: getGeminiErrorMessage(error),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const renderWithMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);

    return (
      <>
        {parts.map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index}>{part.slice(2, -2)}</strong>;
          }

          return <React.Fragment key={index}>{part}</React.Fragment>;
        })}
      </>
    );
  };

  return (
    <div className="fixed bottom-8 right-8 z-50 flex h-[70vh] max-h-[600px] w-[400px] flex-col rounded-2xl bg-surface shadow-2xl animate-fade-in dark:bg-gray-800">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-center">
          <ChatBubbleIcon className="h-6 w-6 text-primary" />
          <h2 className="ml-2 text-lg font-bold text-text dark:text-gray-50">
            Coach Nutricional
          </h2>
        </div>

        <button
          onClick={onClose}
          className="rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
          aria-label="Fechar chat"
        >
          <XIcon className="h-5 w-5 text-text-light dark:text-gray-400" />
        </button>
      </div>

      <div className="flex-grow overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div
              key={`${msg.role}-${index}`}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3 ${
                  msg.role === 'user'
                    ? 'rounded-br-none bg-primary text-black'
                    : 'rounded-bl-none bg-gray-200 text-text dark:bg-gray-700 dark:text-gray-50'
                }`}
              >
                <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {renderWithMarkdown(msg.text)}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-none bg-gray-200 p-3 dark:bg-gray-700">
                <div className="flex items-center space-x-1.5">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-gray-500"></div>
                  <div className="h-2 w-2 animate-pulse rounded-full bg-gray-500 [animation-delay:0.2s]"></div>
                  <div className="h-2 w-2 animate-pulse rounded-full bg-gray-500 [animation-delay:0.4s]"></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-gray-200 p-4 dark:border-gray-700">
        <p className="mb-2 text-xs text-text-light dark:text-gray-400">
          Este chat responde apenas sobre nutrição e alimentação, usando seu objetivo e
          restrições do perfil quando necessário.
        </p>

        <div className="flex items-center gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua dúvida sobre alimentação..."
            rows={1}
            className="min-h-[44px] flex-1 resize-none rounded-lg border border-gray-300 p-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-gray-50 dark:placeholder-gray-400"
          />

          <button
            onClick={() => void handleSend()}
            disabled={isLoading || !input.trim() || !chat}
            className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center self-center rounded-full bg-primary text-black transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-gray-400"
            aria-label="Enviar mensagem"
          >
            <SendIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;