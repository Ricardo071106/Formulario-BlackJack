# Rifa 0001-9999 (Node.js + Express + SQLite)

Aplicação completa para registrar participantes de uma rifa, com front-end (HTML/CSS/JS) e back-end em Node.js/Express usando SQLite.

## Requisitos
- Node.js 18+ (recomendado LTS)

## Instalação
```bash
npm install
```

## Executar (local)
```bash
npm run start
```
- Acesse: `http://localhost:3000` (Formulário)
- Admin: `http://localhost:3000/admin.html` (tabela em tempo real)

## Estrutura
- `server/index.js`: API Express, SQLite e SSE
- `public/`: arquivos estáticos (HTML, CSS, JS)
- `data/database.sqlite`: banco local (criado automaticamente)

## Rotas Backend
- `POST /check-number` → body `{ number }` → `{ ok, number, available }`
- `GET /random-number` → `{ ok, number }`
- `POST /reserve-number` → body `{ fullName, cpf, phone, email, number, accepted }` → `{ ok, participant }`
- `GET /participants` → `{ ok, participants: [] }`
- `GET /events` → SSE para atualizações em tempo real

## Deploy simples (Render/Heroku/etc.)
- Configure build/rodar como `npm install` e `npm start`
- Porta: use a variável `PORT` provida pela plataforma

## Observações
- Validações de CPF, e-mail, telefone e número são aplicadas no backend.
- Constraint UNIQUE em `raffle_number` garante que o mesmo número não seja reservado 2x.
- A tabela de participantes atualiza em tempo real via SSE.

## Integração com Google Sheets (opcional)
Preencha variáveis de ambiente e compartilhe a planilha com o e-mail da Service Account.
- `GOOGLE_SHEETS_ENABLED=true`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL=...@...gserviceaccount.com`
- `GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"` (atenção às quebras de linha com \n)
- `GOOGLE_SHEETS_SPREADSHEET_ID=ID_DA_PLANILHA`
- `GOOGLE_SHEETS_SHEET_NAME=Participants` (opcional)
