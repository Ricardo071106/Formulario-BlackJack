const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Ensure data folder exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database
const dbFile = path.join(dataDir, 'database.sqlite');
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL;');
  db.run('PRAGMA foreign_keys = ON;');
  db.run(
    `CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      cpf TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      raffle_number TEXT NOT NULL UNIQUE,
      accepted_rules INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`
  );
  db.run(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_raffle_number ON participants(raffle_number);',
    (err) => {
      // older migration mistake guard: if typo breaks, ignore; we already have UNIQUE on column
    }
  );
});

// SSE clients
const sseClients = new Set();
function sendSse(clientRes, data) {
  clientRes.write(`data: ${JSON.stringify(data)}\n\n`);
}
function broadcastSse(event) {
  for (const res of sseClients) {
    try {
      sendSse(res, event);
    } catch (_) {
      // best-effort
    }
  }
}

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(': connected\n\n');

  sseClients.add(res);
  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Helpers
function onlyDigits(str) {
  return (str || '').replace(/\D+/g, '');
}

function isValidEmail(email) {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
  return re.test(String(email).trim());
}

function isValidPhone(phone) {
  const digits = onlyDigits(phone);
  // BR: 10 or 11 digits (with 9-digit mobile)
  return digits.length === 10 || digits.length === 11;
}

function isValidCPF(cpf) {
  const digits = onlyDigits(cpf);
  if (!digits || digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // repeated digits

  // Validate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let check1 = 11 - (sum % 11);
  if (check1 >= 10) check1 = 0;
  if (check1 !== parseInt(digits.charAt(9), 10)) return false;

  // Validate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  let check2 = 11 - (sum % 11);
  if (check2 >= 10) check2 = 0;
  if (check2 !== parseInt(digits.charAt(10), 10)) return false;

  return true;
}

function formatRaffleNumber(input) {
  if (typeof input === 'number') {
    if (!Number.isInteger(input)) return null;
    if (input < 1 || input > 9999) return null;
    return String(input).padStart(4, '0');
  }
  const str = String(input || '').trim();
  const digits = onlyDigits(str);
  const num = parseInt(digits, 10);
  if (Number.isNaN(num)) return null;
  if (num < 1 || num > 9999) return null;
  return String(num).padStart(4, '0');
}

// Routes
app.post('/check-number', (req, res) => {
  const formatted = formatRaffleNumber(req.body?.number);
  if (!formatted) {
    return res.status(400).json({ ok: false, message: 'Número inválido. Use 0001 a 9999.' });
  }
  db.get('SELECT 1 FROM participants WHERE raffle_number = ? LIMIT 1', [formatted], (err, row) => {
    if (err) return res.status(500).json({ ok: false, message: 'Erro no banco de dados.' });
    return res.json({ ok: true, number: formatted, available: !row });
  });
});

app.get('/random-number', (req, res) => {
  db.all('SELECT raffle_number FROM participants', (err, rows) => {
    if (err) return res.status(500).json({ ok: false, message: 'Erro no banco.' });
    const used = new Set((rows || []).map(r => r.raffle_number));
    const available = [];
    for (let i = 1; i <= 9999; i++) {
      const num = String(i).padStart(4, '0');
      if (!used.has(num)) available.push(num);
    }
    if (available.length === 0) {
      return res.json({ ok: true, number: null, message: 'Sem números disponíveis.' });
    }
    const pick = available[Math.floor(Math.random() * available.length)];
    return res.json({ ok: true, number: pick });
  });
});

app.post('/reserve-number', (req, res) => {
  const { fullName, cpf, phone, email, number, accepted } = req.body || {};

  const errors = [];
  if (!fullName || String(fullName).trim().length < 3) errors.push('Nome inválido.');
  if (!isValidCPF(cpf)) errors.push('CPF inválido.');
  if (!isValidPhone(phone)) errors.push('Telefone inválido.');
  if (!isValidEmail(email)) errors.push('E-mail inválido.');
  if (accepted !== true && accepted !== 'true' && accepted !== 1 && accepted !== '1' && accepted !== 'on') errors.push('É necessário aceitar o regulamento.');

  const raffleNumber = formatRaffleNumber(number);
  if (!raffleNumber) errors.push('Número da rifa inválido.');

  if (errors.length > 0) {
    return res.status(400).json({ ok: false, message: 'Validação falhou.', errors });
  }

  const acceptedRules = 1;
  const insertSql = `INSERT INTO participants (full_name, cpf, phone, email, raffle_number, accepted_rules) VALUES (?, ?, ?, ?, ?, ?)`;

  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION');
    db.run(
      insertSql,
      [String(fullName).trim(), onlyDigits(cpf), onlyDigits(phone), String(email).trim(), raffleNumber, acceptedRules],
      function (err) {
        if (err) {
          db.run('ROLLBACK');
          if (String(err.message || '').includes('UNIQUE')) {
            return res.status(409).json({ ok: false, message: 'Número já reservado.' });
          }
          return res.status(500).json({ ok: false, message: 'Erro ao salvar no banco.' });
        }
        const insertedId = this.lastID;
        db.run('COMMIT', (commitErr) => {
          if (commitErr) {
            return res.status(500).json({ ok: false, message: 'Erro ao confirmar transação.' });
          }
          const participant = {
            id: insertedId,
            full_name: String(fullName).trim(),
            cpf: onlyDigits(cpf),
            phone: onlyDigits(phone),
            email: String(email).trim(),
            raffle_number: raffleNumber,
            accepted_rules: acceptedRules,
            created_at: new Date().toISOString(),
          };
          broadcastSse({ type: 'participant_created', participant });
          return res.json({ ok: true, message: 'Reserva efetuada com sucesso.', participant });
        });
      }
    );
  });
});

app.get('/participants', (req, res) => {
  db.all('SELECT id, full_name, cpf, phone, email, raffle_number, accepted_rules, created_at FROM participants ORDER BY created_at DESC, id DESC', (err, rows) => {
    if (err) return res.status(500).json({ ok: false, message: 'Erro no banco.' });
    return res.json({ ok: true, participants: rows || [] });
  });
});

// Healthcheck
app.get('/health', (req, res) => res.json({ ok: true }));

// Fallback to index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado em http://localhost:${PORT}`);
});


