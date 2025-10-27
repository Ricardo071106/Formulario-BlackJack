function onlyDigits(s){return (s||'').replace(/\D+/g,'');}
function pad4(n){return String(n).padStart(4,'0');}

function formatNumberInput(value){
  // Durante a digitação: apenas mantém até 4 dígitos sem completar com zeros
  return onlyDigits(value).slice(0,4);
}

function showStatus(el, msg, type){
  el.textContent = msg||'';
  el.classList.remove('error','success');
  if (type) el.classList.add(type);
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('raffle-form');
  const fullName = document.getElementById('fullName');
  const cpf = document.getElementById('cpf');
  const phone = document.getElementById('phone');
  const email = document.getElementById('email');
  const store = document.getElementById('store');
  const number = document.getElementById('number');
  const accepted = document.getElementById('accepted');
  const statusEl = document.getElementById('status');
  const btnRandom = document.getElementById('btnRandom');
  const btnCheck = document.getElementById('btnCheck');
  document.getElementById('year').textContent = new Date().getFullYear();

  number.addEventListener('input', () => {
    number.value = formatNumberInput(number.value);
  });

  // Ao sair do campo, formata para 4 dígitos se válido (agora 0000-9999)
  number.addEventListener('blur', () => {
    const d = onlyDigits(number.value).slice(0,4);
    const n = parseInt(d||'');
    if (!Number.isNaN(n) && n>=0 && n<=9999){
      number.value = pad4(n);
    } else {
      number.value = d; // mantém apenas os dígitos
    }
  });

  btnRandom.addEventListener('click', async () => {
    showStatus(statusEl, 'Buscando número disponível...');
    try{
      const res = await fetch('/random-number');
      const data = await res.json();
      if (data.ok && data.number){
        number.value = data.number;
        showStatus(statusEl, `Número sugerido: ${data.number}`, 'success');
      } else {
        showStatus(statusEl, data.message||'Sem números disponíveis.', 'error');
      }
    }catch(e){
      showStatus(statusEl, 'Falha ao obter número.', 'error');
    }
  });

  btnCheck.addEventListener('click', async () => {
    const d = onlyDigits(number.value).slice(0,4);
    const n = parseInt(d||'');
    if (Number.isNaN(n) || n<0 || n>9999){
      showStatus(statusEl, 'Digite um número entre 0000 e 9999.', 'error');
      return;
    }
    const val = pad4(n);
    number.value = val; // reflete no campo
    try{
      const res = await fetch('/check-number', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({number: val})});
      const data = await res.json();
      if (data.ok){
        if (data.available) showStatus(statusEl, `Número ${data.number} disponível!`, 'success');
        else showStatus(statusEl, `Número ${data.number} indisponível.`, 'error');
      } else {
        showStatus(statusEl, data.message||'Erro na verificação.', 'error');
      }
    }catch(e){
      showStatus(statusEl, 'Falha ao verificar número.', 'error');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showStatus(statusEl, 'Enviando...');
    // Normaliza número antes de enviar
    const d = onlyDigits(number.value).slice(0,4);
    const n = parseInt(d||'');
    const normalizedNumber = (!Number.isNaN(n) && n>=0 && n<=9999) ? pad4(n) : d;

    const payload = {
      fullName: fullName.value.trim(),
      cpf: onlyDigits(cpf.value),
      phone: phone.value,
      email: email.value.trim(),
      store: store.value.trim(),
      number: normalizedNumber,
      accepted: true
    };
    try{
      const res = await fetch('/reserve-number', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      const data = await res.json();
      if (res.ok && data.ok){
        showStatus(statusEl, data.message||'Reservado com sucesso!', 'success');
        form.reset();
      } else {
        const msg = (data && (data.errors?.join(' ') || data.message)) || 'Erro ao reservar.';
        showStatus(statusEl, msg, 'error');
      }
    }catch(e){
      showStatus(statusEl, 'Falha de rede ao enviar.', 'error');
    }
  });
});


