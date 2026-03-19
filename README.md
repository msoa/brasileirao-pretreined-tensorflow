# brasileirao-pretreined-tensorflow

Aplicação para análise de dados do Campeonato Brasileiro e experimentos de predição de resultados usando CSVs históricos.

## Motivação

Este projeto foi desenvolvido como prática aplicada com base em conteúdos da aula de TensorFlow na pós-graduação em Inteligência Artificial Aplicada da UNIPDS.

## Tecnologias usadas

### Aplicação Web + Backend Node integrado
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Rotas de API do Next.js para dados e machine learning

### Machine Learning (em Node)
- Treinamento e inferência implementados em TypeScript
- Persistência local de artefatos em `web/.artifacts/`

### Dados
- Arquivos CSV em `data/`:
	- `campeonato-brasileiro-full.csv`
	- `campeonato-brasileiro-estatisticas-full.csv`
	- `campeonato-brasileiro-gols.csv`
	- `campeonato-brasileiro-cartoes.csv`

## Arquitetura

O projeto roda em um único processo Node via Next.js:

- `web/`: interface + APIs internas (`/api/data/*` e `/api/ml/*`)

Fluxo resumido:

1. O usuário interage com as páginas no `web/`.
2. As rotas `/api/data/*` leem/processam CSVs locais.
3. As rotas `/api/ml/*` treinam e predizem direto no backend Node do Next.js.
4. O modelo e metadados ficam salvos em `web/.artifacts/`.

## Rodar rápido

```bash
cd web
npm install
npm run dev
```

## URL

- App: `http://localhost:3000`

## Ordem de teste

1. Abra `/exploracao` e confira os dados.
2. Abra `/treinamento` e execute um treino.
3. Abra `/previsoes` e rode uma predição.

## Autor

- Marco Sérgio de Oliveira Araújo
- LinkedIn: https://www.linkedin.com/in/marcosergio/
