import { useEffect, useRef, useState } from 'react';
import {
  FirestoreError,
  doc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';

export interface FirestoreStateError {
  code: string;
  message: string;
  operation: 'read' | 'write';
}

type SetFirestoreValue<T> = (
  value: T | ((currentValue: T) => T)
) => Promise<boolean>;

const getFirestoreError = (
  error: FirestoreError,
  operation: 'read' | 'write'
): FirestoreStateError => {
  switch (error.code) {
    case 'permission-denied':
      return {
        code: error.code,
        message:
          'Seu acesso a estes dados foi negado. Faça login novamente ou revise as regras do Firestore.',
        operation,
      };

    case 'unavailable':
      return {
        code: error.code,
        message: 'O Firestore está indisponível no momento. Tente novamente em instantes.',
        operation,
      };

    default:
      return {
        code: error.code,
        message:
          operation === 'read'
            ? 'Não foi possível carregar seus dados agora.'
            : 'Não foi possível salvar sua alteração agora.',
        operation,
      };
  }
};

export function useFirestore<T>(
  userId: string,
  key: string,
  initialValue: T
): [T, SetFirestoreValue<T>, boolean, FirestoreStateError | null] {
  const initialValueRef = useRef<T>(initialValue);
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreStateError | null>(null);

  useEffect(() => {
    initialValueRef.current = initialValue;
  }, [initialValue]);

  useEffect(() => {
    if (!userId) {
      setStoredValue(initialValueRef.current);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const docRef = doc(db, 'users', userId, 'data', key);

    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStoredValue((data?.value as T) ?? initialValueRef.current);
        } else {
          setStoredValue(initialValueRef.current);
        }

        setError(null);
        setLoading(false);
      },
      (firebaseError) => {
        console.error('Erro ao buscar dados do Firestore:', firebaseError);
        setError(getFirestoreError(firebaseError, 'read'));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, key]);

  const setValue: SetFirestoreValue<T> = async (valueOrUpdater) => {
    const previousValue = storedValue;

    try {
      const valueToStore =
        typeof valueOrUpdater === 'function'
          ? (valueOrUpdater as (currentValue: T) => T)(previousValue)
          : valueOrUpdater;

      setError(null);
      setStoredValue(valueToStore);

      if (!userId) {
        return false;
      }

      const docRef = doc(db, 'users', userId, 'data', key);
      await setDoc(docRef, { value: valueToStore });

      return true;
    } catch (unknownError) {
      console.error('Erro ao salvar dados no Firestore:', unknownError);
      setStoredValue(previousValue);

      if (unknownError instanceof FirestoreError) {
        setError(getFirestoreError(unknownError, 'write'));
      } else {
        setError({
          code: 'unknown',
          message: 'Não foi possível salvar sua alteração agora.',
          operation: 'write',
        });
      }

      return false;
    }
  };

  return [storedValue, setValue, loading, error];
}