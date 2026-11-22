# Salve Uma Música

Dez músicas brasileiras por ano. Você só pode salvar uma.

- `index.html`, `style.css`, `app.js`: o site (trecho de 5 s em sequência; ▶ toca 20 s)
- `bg.jpg`, `bg-mobile.jpg`: imagem de fundo
- `data/catalog.json`: músicas selecionadas (gerado a partir da planilha do catálogo)
- `api/track.js`: busca no Deezer o trecho e a capa na hora (o link do trecho expira)
- `api/vote.js`, `api/stats.js`: votos e rankings (Upstash Redis, integração gratuita da Vercel)
- `vercel.json`: funções rodando em São Paulo (gru1)
