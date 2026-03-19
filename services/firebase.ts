import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

/**
 * Helper para garantir que variáveis de ambiente existem.
 */
const getEnv = (key: string): string => {
  const value = import.meta.env[key];

  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${key}`);
  }

  return value;
};

/**
 * Configuração do Firebase baseada em variáveis de ambiente.
 */
const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID'),
};

/**
 * Inicializa o app Firebase.
 */
const app = initializeApp(firebaseConfig);

/**
 * Exporta serviços utilizados no projeto.
 */
export const db = getFirestore(app);
export const auth = getAuth(app);