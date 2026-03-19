# Web (Next.js)

Aplicação principal do projeto, em página única, com backend integrado no próprio Next.js.

## Seções da interface

- Base de dados e modelo
- Treinamento
- Previsões
- Exploração
- Sobre mim
- Aviso acadêmico
- Ajuda

Fluxo rápido: **ajuste, treine, observe e preveja**.

## Executar localmente

```bash
cd web
npm install
npm run dev
```

Abra: `http://localhost:3000`

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Arquitetura

- Frontend e APIs no mesmo projeto.
- Rotas de dados: `/api/data/*`.
- Rotas de machine learning: `/api/ml/*`.
- Treino/predição usando TensorFlow.js no backend Node.

## Endpoints de ML

- `POST /api/ml/train`
- `GET /api/ml/train-status`
- `POST /api/ml/predict`
- `GET /api/ml/model-info`

## Parâmetros de treino suportados

- `preset`
- `epochs`
- `batch_size`
- `test_size`
- `learning_rate`
- `optimizer` (`adam` ou `rmsprop`)
- `dropout_rate`
- `l2_lambda`
- `hidden_layers`
- `early_stopping_patience`
- `early_stopping_min_delta`

## Artefatos do modelo

Os arquivos gerados pelo treino ficam em `.artifacts/` (ex.: `match-predictor-tfjs`) e não devem ser versionados.

## Observações

- Não é necessário subir serviço Python para usar a aplicação web atual.
- Em caso de erro de estado de treino, reinicie apenas o servidor Next.js (`npm run dev`).
