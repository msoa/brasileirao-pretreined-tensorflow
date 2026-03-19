# brasileirao-pretreined-tensorflow

Aplicação web para análise do Campeonato Brasileiro e predição de resultados com TensorFlow.js, usando dados históricos em CSV.

## Objetivo

Projeto acadêmico para prática de ciência de dados e machine learning aplicada ao futebol, com interface única para:

- explorar os dados,
- treinar o modelo,
- acompanhar métricas de treino,
- gerar previsões.

Fluxo rápido: **ajuste, treine, observe e preveja**.

## Stack

### Web + API (único processo)
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Rotas de API do Next.js

### Machine Learning (Node)
- TensorFlow.js (`@tensorflow/tfjs`)
- Treinamento e inferência no backend do próprio Next.js
- Persistência local em `web/.artifacts/`

### Dados
Arquivos em `data/`:

- `campeonato-brasileiro-full.csv`
- `campeonato-brasileiro-estatisticas-full.csv`
- `campeonato-brasileiro-gols.csv`
- `campeonato-brasileiro-cartoes.csv`

## Arquitetura atual

O sistema roda no diretório `web/`:

- Frontend: página única com seções `Base de dados`, `Treinamento`, `Previsões`, `Exploração`, `Ajuda`.
- API de dados: `/api/data/*` (leitura e agregação dos CSVs).
- API de ML: `/api/ml/*` (treino, status, predição e info do modelo).

Resumo do fluxo:

1. A interface chama rotas internas do Next.js.
2. O backend processa dados e executa treino/predição via TFJS.
3. O estado do modelo é salvo em `.artifacts`.

## Rodar localmente

```bash
cd web
npm install
npm run dev
```

App: `http://localhost:3000`

## Build de produção

```bash
cd web
npm run lint
npm run build
npm run start
```

## Endpoints principais

### Dados
- `GET /api/data/years`
- `GET /api/data/teams?year=...`
- `GET /api/data/matches?year=...&team=...`
- `GET /api/data/team-summary?year=...&team=...`

### Machine Learning
- `POST /api/ml/train`
- `GET /api/ml/train-status`
- `POST /api/ml/predict`
- `GET /api/ml/model-info`

## Parâmetros de treino expostos na UI

- `preset`
- `epochs`
- `batch_size`
- `test_size`
- `learning_rate`
- `optimizer`
- `dropout_rate`
- `l2_lambda`
- `hidden_layers` (camadas 1, 2 e 3)
- `early_stopping_patience`
- `early_stopping_min_delta`

## Artefatos e Git

Os artefatos do modelo em `.artifacts/` são gerados localmente e estão ignorados no versionamento.

## Autor

- Marco Sérgio de Oliveira Araújo
- LinkedIn: https://www.linkedin.com/in/marcosergio/
