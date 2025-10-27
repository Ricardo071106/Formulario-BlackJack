function fmtPhone(p){
  const d=(p||'').replace(/\D+/g,'');
  if (d.length===11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length===10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return p||'';
}
function fmtCPF(c){
  const d=(c||'').replace(/\D+/g,'');
  if (d.length!==11) return c||'';
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

function renderRows(rows){
  const tbody = document.querySelector('#participantsTable tbody');
  tbody.innerHTML = '';
  for (const r of rows){
    const tr = document.createElement('tr');
    const date = new Date(r.created_at || Date.now());
    tr.innerHTML = `
      <td>${date.toLocaleString()}</td>
      <td><strong>${r.raffle_number}</strong></td>
      <td>${r.full_name}</td>
      <td>${fmtCPF(r.cpf)}</td>
      <td>${fmtPhone(r.phone)}</td>
      <td>${r.email}</td>
    `;
    tbody.appendChild(tr);
  }
}

async function fetchAll(){
  const res = await fetch('/participants');
  const data = await res.json();
  if (data.ok){ renderRows(data.participants || []); }
}

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  await fetchAll();
  const sse = new EventSource('/events');
  sse.onmessage = async (ev) => {
    try{
      const data = JSON.parse(ev.data);
      if (data.type === 'participant_created'){
        await fetchAll();
      }
    }catch(_){/* ignore */}
  };
});


