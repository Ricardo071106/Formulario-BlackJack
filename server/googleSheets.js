const { google } = require('googleapis');

function isEnabled() {
  return String(process.env.GOOGLE_SHEETS_ENABLED || '').toLowerCase() === 'true';
}

function getAuthClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
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
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

module.exports = { appendParticipant };


