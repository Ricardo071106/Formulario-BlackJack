const { google } = require('googleapis');
const fs = require('fs');

function isEnabled() {
  return String(process.env.GOOGLE_SHEETS_ENABLED || '').toLowerCase() === 'true';
}

function getAuthClient() {
  let clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const credsPath = process.env.GOOGLE_CREDENTIALS_JSON_PATH;

  if ((!clientEmail || !privateKey) && credsPath) {
    try {
      const raw = fs.readFileSync(credsPath, 'utf8');
      const json = JSON.parse(raw);
      if (!clientEmail) clientEmail = json.client_email;
      if (!privateKey) privateKey = json.private_key;
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = clientEmail;
      process.env.GOOGLE_PRIVATE_KEY = privateKey;
    } catch (_) {
      // ignore read errors
    }
  }

  if (!clientEmail || !privateKey) return null;
  // Handle escaped newlines in env vars
  privateKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth;
}

function onlyDigits(str) {
  return String(str || '').replace(/\D+/g, '');
}

function pad4(n) {
  const num = typeof n === 'number' ? n : parseInt(onlyDigits(n || ''), 10);
  if (!num || num < 1 || num > 9999) return null;
  return String(num).padStart(4, '0');
}

async function appendParticipant(participant) {
  if (!isEnabled()) return { ok: false, skipped: true, reason: 'disabled' };
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'Participants';
  if (!spreadsheetId) return { ok: false, skipped: true, reason: 'missing spreadsheet id' };

  const auth = getAuthClient();
  if (!auth) return { ok: false, skipped: true, reason: 'missing credentials' };

  const sheets = google.sheets({ version: 'v4', auth });

  function buildRange(sheetName) {
    const escaped = String(sheetName).replace(/'/g, "''");
    return `'${escaped}'!A2`;
  }

  async function ensureHeader() {
    const header = ['Data','Número','Nome','CPF','Loja','Telefone','E-mail'];
    try {
      const current = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${String(sheetName).replace(/'/g, "''")}'!A1:G1`,
      });
      const values = current?.data?.values || [];
      const firstRow = values[0] || [];
      const matches = header.length === firstRow.length && header.every((h, i) => firstRow[i] === h);
      if (!matches) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${String(sheetName).replace(/'/g, "''")}'!A1:G1`,
          valueInputOption: 'RAW',
          requestBody: { values: [header] },
        });
      }
    } catch (_) { /* ignore */ }
  }

  function formatBrazilTime(isoOrString) {
    const d = new Date(isoOrString);
    const dtf = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const parts = dtf.formatToParts(d).reduce((acc,p)=>{acc[p.type]=p.value;return acc;},{});
    return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
  }

  const values = [[
    formatBrazilTime(participant.created_at),
    pad4(participant.raffle_number) || participant.raffle_number,
    participant.full_name,
    participant.cpf,
    participant.store || '',
    participant.phone,
    participant.email,
  ]];

  try {
    await ensureHeader();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: buildRange(sheetName),
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
    return { ok: true };
  } catch (err) {
    console.warn('[Sheets] appendParticipant error:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

async function appendParticipantsBatch(participants) {
  if (!isEnabled()) return { ok: false, skipped: true, reason: 'disabled' };
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'Participants';
  if (!spreadsheetId) return { ok: false, skipped: true, reason: 'missing spreadsheet id' };

  const auth = getAuthClient();
  if (!auth) return { ok: false, skipped: true, reason: 'missing credentials' };

  const sheets = google.sheets({ version: 'v4', auth });
  function buildRange(sheetName) {
    const escaped = String(sheetName).replace(/'/g, "''");
    return `'${escaped}'!A2`;
  }
  async function ensureHeader() {
    const header = ['Data','Número','Nome','CPF','Loja','Telefone','E-mail'];
    try {
      const current = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${String(sheetName).replace(/'/g, "''")}'!A1:G1`,
      });
      const values = current?.data?.values || [];
      const firstRow = values[0] || [];
      const matches = header.length === firstRow.length && header.every((h, i) => firstRow[i] === h);
      if (!matches) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${String(sheetName).replace(/'/g, "''")}'!A1:G1`,
          valueInputOption: 'RAW',
          requestBody: { values: [header] },
        });
      }
    } catch (_) { /* ignore */ }
  }
  function formatBrazilTime(isoOrString) {
    const d = new Date(isoOrString);
    const dtf = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const parts = dtf.formatToParts(d).reduce((acc,p)=>{acc[p.type]=p.value;return acc;},{});
    return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
  }
  const values = participants.map((p) => [
    formatBrazilTime(p.created_at),
    pad4(p.raffle_number) || p.raffle_number,
    p.full_name,
    p.cpf,
    p.store || '',
    p.phone,
    p.email,
  ]);
  try {
    await ensureHeader();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: buildRange(sheetName),
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
    return { ok: true };
  } catch (err) {
    console.warn('[Sheets] appendParticipantsBatch error:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

module.exports = { appendParticipant, appendParticipantsBatch, getAuthClient };


