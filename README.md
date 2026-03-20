# brasileirao-pretreined-tensorflow

Aplicação web completa para análise do Campeonato Brasileiro e predição de resultados com **Next.js**, **TypeScript** e **TensorFlow.js**, processando dados históricos em CSV.

## Objetivo

Projeto acadêmico demonstrando um **pipeline completo de ML aplicado ao futebol**, com interface integrada para:

- **Explorar** dados históricos do Campeonato Brasileiro
- **Treinar** modelo neural com parâmetros customizáveis
- **Acompanhar** métricas de treinamento em tempo real
- **Gerar previsões** de resultados de partidas

Fluxo rápido: **configure → treine → observe métricas → preveja**.

## 🚀 Projeto em produção

**Acesse:** https://brasileirao-pretreined-tensorflow-1.onrender.com/

## Tecnologias

• **Next.js 16** (App Router + TypeScript): framework web moderno com SSR/SSG  
• **TensorFlow.js**: treinamento e inferência de modelos neurais no backend Node.js  
• **Tailwind CSS**: estilização com utility-first CSS  
• **Zod**: validação de schemas e payloads  
• **csv-parse**: parsing robusto de dados CSV  

### Dados

Datasets em `data/`:

• `campeonato-brasileiro-full.csv` – Histórico de partidas  
• `campeonato-brasileiro-estatisticas-full.csv` – Estatísticas de times  
• `campeonato-brasileiro-gols.csv` – Registro de gols  
• `campeonato-brasileiro-cartoes.csv` – Cartões recebidos  

## Como executar localmente

### 1. Instalar dependências

```bash
npm install
```

### 2. Rodar em desenvolvimento

```bash
npm run dev
```

A aplicação estará em `http://localhost:3000`.

### 3. Build de produção

```bash
npm run lint
npm run build
npm run start
```

## Scripts principais

### Desenvolvimento e build

• `npm run dev` – inicia dev server com hot reload  
• `npm run build` – compila Next.js para produção  
• `npm run start` – inicia servidor de produção  
• `npm run lint` – valida código com ESLint  

## Arquitetura (resumo)

O sistema roda como **aplicação monolítica** no Next.js:

**Frontend:**
- Página única (SPA) com 5 seções navegáveis:
  - **Base de dados**: exploração de partidas, estatísticas e tabelas
  - **Treinamento**: interface de ajuste de hiperparâmetros e monitoramento
  - **Previsões**: predição de resultado de matches
  - **Exploração**: análises avançadas por rodada e time
  - **Ajuda**: documentação de parâmetros

**API Routes (Next.js):**
- `/api/data/*` – leitura e agregação de dados CSV
- `/api/ml/*` – orquestração de treinamento e predição

**Machine Learning:**
- Modelo sequencial TensorFlow.js com camadas customizáveis
- Treinamento com early stopping, dropout e regularização L2
- Persistência de pesos em `.artifacts/` (local)

**Fluxo:**
1. Frontend envia requisição HTTP para rotas internas do Next.js
2. Backend carrega/normaliza dados, executa treino/predição via TFJS
3. Estado do modelo é salvo em `.artifacts/` para reutilização

## Endpoints relevantes

### Dados

• `GET /api/data/years` – lista de anos disponíveis  
• `GET /api/data/teams?year=YYYY` – times de um ano  
• `GET /api/data/matches?year=YYYY&team=...` – partidas com filtros  
• `GET /api/data/team-summary?year=YYYY&team=...` – estatísticas de time  

### Machine Learning

• `POST /api/ml/train` – inicia treino (payload: hiperparâmetros)  
• `GET /api/ml/train-status` – status e métricas do treino em progresso  
• `POST /api/ml/predict` – predição de resultado (payload: `{ homeTeam, awayTeam }`)  
• `GET /api/ml/model-info` – info do modelo armazenado  

## Parâmetros de treinamento

Customize o modelo via UI (presets: Fast / Balanced / Accuracy) ou manualmente:

| Parâmetro | Padrão | Descrição |
|-----------|--------|-----------|
| `epochs` | 100 | Iterações sobre dataset |
| `batch_size` | 32 | Amostras por atualização |
| `test_size` | 0.2 | Fração para validação |
| `learning_rate` | 0.01 | Taxa de aprendizado |
| `optimizer` | adam | Otimizador (adam, sgd, rmsprop) |
| `dropout_rate` | 0.3 | Regularização por dropout |
| `l2_lambda` | 0.0001 | Regularização L2 |
| `early_stopping_patience` | 15 | Épocas sem melhora antes de parar |
| `early_stopping_min_delta` | 0.001 | Delta mínimo para considerar melhora |

## Artefatos e Git

Os artefatos do modelo (pesos TensorFlow) em `.artifacts/` são:
- Gerados **localmente** durante treinamento
- **Ignorados no versionamento** (em `.gitignore`)
- Reutilizáveis entre sessões sem necessidade de retreinamento

## Estrutura do repositório

```
.
├── web/                           # Aplicação Next.js
│   ├── src/
│   │   ├── app/                  # App Router pages + API routes
│   │   │   ├── training/         # Página de treinamento
│   │   │   ├── predictions/      # Página de predições
│   │   │   ├── exploration/      # Página de exploração
│   │   │   └── api/              # Rotas de dados e ML
│   │   └── lib/                  # Serviços e tipos
│   │       └── server/           # ML service, CSV data layer
│   ├── package.json
│   └── tsconfig.json
├── data/                          # Datasets CSV (ignorado em .gitignore)
├── .artifacts/                    # Artefatos do modelo (ignorado)
├── package.json
└── README.md
```

## Deploy

Recomendado: serviços com Node.js e suporte a file system (Render, Railway, fly.io).

Configuração mínima:
- **Build**: `npm ci`
- **Start**: `npm run build && npm run start`
- **Variáveis**: nenhuma obrigatória (CSVs em `data/`)

## Licença

MIT

## Autor

Marco

- Marco Sérgio de Oliveira Araújo
- LinkedIn: https://www.linkedin.com/in/marcosergio/
