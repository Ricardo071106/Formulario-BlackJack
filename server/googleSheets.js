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
    return `'${escaped}'!A1`;
  }

  const values = [[
    participant.id,
    participant.created_at,
    participant.raffle_number,
    participant.full_name,
    participant.cpf,
    participant.phone,
    participant.email,
    participant.store || '',
  ]];

  try {
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
    return `'${escaped}'!A1`;
  }
  const values = participants.map((p) => [
    p.id,
    p.created_at,
    p.raffle_number,
    p.full_name,
    p.cpf,
    p.phone,
    p.email,
    p.store || '',
  ]);
  try {
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

module.exports = { appendParticipant, appendParticipantsBatch };


