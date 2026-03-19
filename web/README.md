# Web (Next.js)

Interface do projeto em single page com seções de Base de dados e modelo, Treinamento, Previsões e Exploração.

## Executar

```bash
cd web
npm install
npm run dev
```

Abra: `http://localhost:3000`

## Backend integrado

As rotas de ML (`/api/ml/*`) rodam no próprio backend Node do Next.js.

- Não é necessário subir serviço Python separado.
- O modelo treinado é persistido em `web/.artifacts/match-predictor-node.json`.

## Build de produção

```bash
npm run lint
npm run build
npm run start
```
