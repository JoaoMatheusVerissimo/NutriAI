# 🧠 NutriAI

Aplicação web inteligente para geração de planos alimentares, receitas e suporte nutricional personalizado utilizando Inteligência Artificial.

---

## 🚀 Sobre o Projeto

O **NutriAI** é uma aplicação desenvolvida como projeto acadêmico (TCC) com foco em:

- Nutrição personalizada
- Geração de planos alimentares com IA
- Sugestões de receitas
- Educação nutricional baseada em evidências

O sistema utiliza modelos de IA (Google Gemini) para gerar recomendações alimentares adaptadas ao perfil do usuário.

---

## 🎯 Objetivo

Criar uma solução acessível que ajude usuários a:

- Melhorar hábitos alimentares
- Planejar refeições de forma prática
- Entender melhor sua alimentação
- Receber orientações nutricionais seguras e baseadas em evidência

---

## 🧩 Funcionalidades

### 👤 Perfil do Usuário
- Cadastro com dados básicos (idade, peso, altura, sexo)
- Definição de objetivo:
  - Perder peso
  - Manter peso
  - Ganhar massa muscular
- Alergias e restrições alimentares

---

### 🥗 Planejador Alimentar (IA)
- Geração de plano alimentar diário
- Cálculo de macronutrientes
- Lista de compras automática
- Sugestões de substituição de alimentos

---

### 🍳 Receitas Inteligentes
- Geração de receitas com base em pedido do usuário
- Informações nutricionais por porção
- Instruções passo a passo

---

### 💬 Chat Nutricional
- Assistente inteligente focado em nutrição
- Respostas baseadas em evidência
- Personalizado com dados do usuário

---

### 💾 Salvamento de Dados
- Planos alimentares salvos
- Receitas favoritas
- Persistência com Firebase

---

### 💧 Monitor de Água
- Controle simples de ingestão diária

---

## 🏗️ Tecnologias Utilizadas

### Frontend
- React
- TypeScript
- Vite
- TailwindCSS

### Backend (BaaS)
- Firebase Authentication
- Firestore Database

### Inteligência Artificial
- Google Gemini API

---

## 🧠 Arquitetura

O projeto segue uma arquitetura modular:

```bash
src/
├── components/ # UI e telas
├── hooks/ # Lógica reutilizável (estado, firestore)
├── services/ # Integrações (Gemini, Firebase)
├── types/ # Tipagens do sistema
├── App.tsx # Controle principal
├── MainApp.tsx # Fluxo da aplicação
```
---

## 🔐 Variáveis de Ambiente

Crie um arquivo `.env` na raiz com:

Gemini
```bash
VITE_GEMINI_API_KEY=
```
Firebase
```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```
---

## ▶️ Como Rodar o Projeto

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev
```

## Configuração local

1. Instalar dependências:
```bash
   `npm install`
```   
2. Criar arquivo `.env` a partir de `.env.example`.
3. Preencha pelo menos `VITE_GEMINI_API_KEY` e as variáveis do Firebase.
4. Rode o app:
```bash
   `npm run dev`
```

## Scripts
```bash
- `npm run dev` # servidor local
- `npm run build` # build de produção
- `npm run preview` # pré-visualização do build
- `npm run lint` # checagem de lint
- `npm run typecheck` # checagem TypeScript
- `npm run test` # testes automatizados
- `npm run format` # formatação com Prettier
```
