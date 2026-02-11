/************************************************
 * CONFIGURACIÓN GENERAL
 ************************************************/
const PASSWORD = 'Elena';
const SESSION_KEY = 'edupay_session';
const STORAGE_KEY = 'edupay_state_final';

const GRADE_ORDER = [
  'Pre escolar',
  'Primero',
  'Segundo',
  'Tercero',
  'Cuarto',
  'Quinto'
];

/************************************************
 * LOGIN / SESIÓN
 ************************************************/
const loginView = document.getElementById('loginView');
const appView = document.getElementById('appView');

const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');

function isLoggedIn() {
  return localStorage.getItem(SESSION_KEY) === 'true';
}

function showLogin() {
  loginView.classList.remove('hidden');
  appView.classList.add('hidden');
}

function showApp() {
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  renderAll();
}

loginBtn.onclick = () => {
  if (passwordInput.value === PASSWORD) {
    localStorage.setItem(SESSION_KEY, 'true');
    showApp();
  } else {
    alert('Contraseña incorrecta');
  }
  passwordInput.value = '';
};

logoutBtn.onclick = () => {
  localStorage.removeItem(SESSION_KEY);
  showLogin();
};

/************************************************
 * ESTADO + PERSISTENCIA
 ************************************************/
const state = loadState() || {
  students: [],
  payments: []
};

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : null;
}

/************************************************
 * DOM
 ************************************************/
const studentNameInput = document.getElementById('studentName');
const addStudentBtn = document.getElementById('addStudentBtn');
const studentList = document.getElementById('studentList');
const studentSummary = document.getElementById('studentSummary');

const studentSelect = document.getElementById('studentSelect');
const amountInput = document.getElementById('amount');
const addPaymentBtn = document.getElementById('addPaymentBtn');

const paymentList = document.getElementById('paymentList');
const totalSpan = document.getElementById('total');

const exportCsvBtn = document.getElementById('exportCsvBtn');
const backupBtn = document.getElementById('backupBtn');
const restoreBtn = document.getElementById('restoreBtn');
const restoreFileInput = document.getElementById('restoreFileInput');

/************************************************
 * HELPERS
 ************************************************/
function getSelectedGrade() {
  const selected = document.querySelector('input[name="grade"]:checked');
  return selected ? selected.value : null;
}

function resetGrades() {
  document.querySelectorAll('input[name="grade"]').forEach(r => r.checked = false);
}

/************************************************
 * REGLAS DE NEGOCIO
 ************************************************/
function addStudent(name, grade) {
  if (!name || !grade) throw new Error('Nombre y grado obligatorios');
  state.students.push({ id: crypto.randomUUID(), name: name.trim(), grade });
  saveState();
}

function removeStudent(id) {
  if (state.payments.some(p => p.studentId === id)) {
    throw new Error('No se puede eliminar: tiene pagos');
  }
  state.students = state.students.filter(s => s.id !== id);
  saveState();
}

function addPayment(studentId, amount) {
  if (!studentId) throw new Error('Seleccione estudiante');
  if (amount <= 0) throw new Error('Monto inválido');

  state.payments.push({
    id: crypto.randomUUID(),
    date: new Date().toISOString().split('T')[0],
    studentId,
    amount
  });
  saveState();
}

/************************************************
 * CÁLCULOS
 ************************************************/
function total() {
  return state.payments.reduce((s, p) => s + p.amount, 0);
}

function totalByStudent(id) {
  return state.payments
    .filter(p => p.studentId === id)
    .reduce((s, p) => s + p.amount, 0);
}

/************************************************
 * RENDER
 ************************************************/
function renderStudents() {
  studentList.innerHTML = '';
  studentSelect.innerHTML = '<option value="">-- Seleccione estudiante --</option>';

  const grouped = {};
  GRADE_ORDER.forEach(g => grouped[g] = []);
  state.students.forEach(s => grouped[s.grade].push(s));

  GRADE_ORDER.forEach(grade => {
    if (!grouped[grade].length) return;

    const h4 = document.createElement('h4');
    h4.textContent = grade;
    studentList.appendChild(h4);

    grouped[grade]
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(s => {
        const li = document.createElement('li');
        li.textContent = `${s.name} — $${totalByStudent(s.id)} `;

        const del = document.createElement('button');
        del.textContent = '❌';
        del.onclick = () => {
          try {
            removeStudent(s.id);
            renderAll();
          } catch (e) {
            alert(e.message);
          }
        };

        li.appendChild(del);
        studentList.appendChild(li);

        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} (${grade})`;
        studentSelect.appendChild(opt);
      });
  });

  addPaymentBtn.disabled = !studentSelect.value;
}

function renderPayments() {
  paymentList.innerHTML = '';
  if (!state.payments.length) {
    paymentList.innerHTML = '<li>No hay pagos</li>';
  } else {
    state.payments.forEach(p => {
      const s = state.students.find(st => st.id === p.studentId);
      if (!s) return;
      const li = document.createElement('li');
      li.textContent = `${p.date} - ${s.name} - $${p.amount}`;
      paymentList.appendChild(li);
    });
  }
  totalSpan.textContent = total();
}

function renderStudentSummary() {
  studentSummary.innerHTML = '';
  state.students.forEach(s => {
    const li = document.createElement('li');
    li.textContent = `${s.name} (${s.grade}) → $${totalByStudent(s.id)}`;
    studentSummary.appendChild(li);
  });
}

/************************************************
 * GRÁFICO (PROTEGIDO)
 ************************************************/
let chartInstance = null;

function updateChart() {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js no disponible');
    return;
  }

  const canvas = document.getElementById('paymentChart');
  if (!canvas) return;

  const summary = {};
  state.payments.forEach(p => {
    const s = state.students.find(st => st.id === p.studentId);
    if (!s) return;
    summary[s.name] = (summary[s.name] || 0) + p.amount;
  });

  const labels = Object.keys(summary);
  const data = Object.values(summary);

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Total pagado',
        data,
        backgroundColor: '#1976d2',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

/************************************************
 * EXPORTAR CSV
 ************************************************/
function exportPaymentsCSV() {
  if (!state.payments.length) {
    alert('No hay pagos para exportar');
    return;
  }

  let csv = 'Fecha,Estudiante,Grado,Monto\n';
  state.payments.forEach(p => {
    const s = state.students.find(st => st.id === p.studentId);
    if (!s) return;
    csv += `${p.date},${s.name},${s.grade},${p.amount}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pagos_edupay.csv';
  a.click();
}

/************************************************
 * BACKUP / RESTORE
 ************************************************/
function createBackup() {
  const blob = new Blob(
    [JSON.stringify({ app: 'EduPay', state }, null, 2)],
    { type: 'application/json' }
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'edupay_backup.json';
  a.click();
}

function restoreBackup(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.state) throw new Error('Archivo inválido');
      state.students = data.state.students || [];
      state.payments = data.state.payments || [];
      saveState();
      renderAll();
      alert('Copia restaurada correctamente');
    } catch (err) {
      alert('Error al restaurar copia');
    }
  };
  reader.readAsText(file);
}

/************************************************
 * EVENTOS
 ************************************************/
addStudentBtn.onclick = () => {
  try {
    addStudent(studentNameInput.value, getSelectedGrade());
    studentNameInput.value = '';
    resetGrades();
    renderAll();
  } catch (e) {
    alert(e.message);
  }
};

addPaymentBtn.onclick = () => {
  try {
    addPayment(studentSelect.value, Number(amountInput.value));
    amountInput.value = '';
    studentSelect.value = '';
    renderAll();
  } catch (e) {
    alert(e.message);
  }
};

studentSelect.onchange = () => addPaymentBtn.disabled = !studentSelect.value;
exportCsvBtn.onclick = exportPaymentsCSV;

backupBtn.onclick = createBackup;
restoreBtn.onclick = () => restoreFileInput.click();
restoreFileInput.onchange = e => restoreBackup(e.target.files[0]);

/************************************************
 * RENDER GENERAL
 ************************************************/
function renderAll() {
  renderStudents();
  renderPayments();
  renderStudentSummary();
  updateChart();
}

/************************************************
 * INIT
 ************************************************/
isLoggedIn() ? showApp() : showLogin();
