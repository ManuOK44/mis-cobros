const saveHistoryButton = document.getElementById("save-history");
const backHomeButton = document.getElementById("back-home");
const cancelButton = document.getElementById("cancel-business");

const totalNegocios = document.getElementById("total-negocios");
const totalSemanal = document.getElementById("total-semanal");
const totalCobrado = document.getElementById("total-cobrado");
const totalPendiente = document.getElementById("total-pendiente");

const addButton = document.getElementById("add-business");
const modal = document.getElementById("business-modal");
const saveButton = document.getElementById("save-business");
const paymentsSection = document.querySelector(".payments");
const imageInput = document.getElementById("business-image");

let tarjetaEditando = null;

/* ===================== GUARDAR ===================== */
function guardarEstados() {
  const datos = [];

  document.querySelectorAll(".payment-card").forEach((card) => {
    datos.push({
      nombre: card.querySelector("h4").textContent,
      monto: card.dataset.monto,
      dia: card.querySelector("p").textContent.split("•")[0].trim(),
      estado: card.querySelector(".status").textContent,
      imagen: card.querySelector("img").src
    });
  });

  localStorage.setItem("negocios", JSON.stringify(datos));
}

/* ===================== CREAR TARJETA ===================== */
function crearTarjeta(nombre, monto, dia, estado, imagen) {
  const card = document.createElement("div");
  card.classList.add("payment-card");
  card.dataset.monto = monto;

  card.innerHTML = `
    <img src="${imagen || "https://via.placeholder.com/50"}">
    <div class="info">
      <h4>${nombre}</h4>
      <p>${dia} • $${monto}</p>
    </div>
    <div class="actions">
      <span class="status ${estado === "Cobrado" ? "paid" : "pending"}">${estado}</span>
      <button class="edit-btn">✎</button>
      <button class="delete-btn">✕</button>
    </div>
  `;

  paymentsSection.appendChild(card);
  activarEstado(card.querySelector(".status"));
}

/* ===================== ESTADO ===================== */
function activarEstado(estado) {
  estado.addEventListener("click", () => {
    estado.classList.toggle("paid");
    estado.classList.toggle("pending");
    estado.textContent = estado.classList.contains("paid") ? "Cobrado" : "Pendiente";

    guardarEstados();
    actualizarTotales();
  });
}

/* ===================== TOTALES ===================== */
function actualizarTotales() {
  let negocios = 0, semanal = 0, cobrado = 0, pendiente = 0;

  document.querySelectorAll(".payment-card").forEach((card) => {
    const monto = Number(card.dataset.monto);
    const estado = card.querySelector(".status");

    negocios++;
    semanal += monto;

    if (estado.classList.contains("paid")) cobrado += monto;
    else pendiente += monto;
  });

  totalNegocios.textContent = negocios;
  totalSemanal.textContent = `$${semanal}`;
  totalCobrado.textContent = `$${cobrado}`;
  totalPendiente.textContent = `$${pendiente}`;
}

/* ===================== CARGAR ===================== */
function cargarEstados() {
  const guardados = JSON.parse(localStorage.getItem("negocios"));

  if (!guardados) return;

  document.querySelectorAll(".payment-card").forEach(card => card.remove());

  guardados.forEach(item => {
    crearTarjeta(item.nombre, item.monto, item.dia, item.estado, item.imagen);
  });

  actualizarTotales();
}

/* ===================== LIMPIAR FORM ===================== */
function limpiarFormulario() {
  document.getElementById("business-name").value = "";
  document.getElementById("business-amount").value = "";
  document.getElementById("business-day").value = "";
  imageInput.value = "";
}

/* ===================== IMAGEN ===================== */
function obtenerImagen(callback) {
  const file = imageInput.files[0];

  if (!file) {
    callback(tarjetaEditando ? tarjetaEditando.querySelector("img").src : "");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => callback(reader.result);
  reader.readAsDataURL(file);
}

/* ===================== AGREGAR ===================== */
addButton.addEventListener("click", () => {
  tarjetaEditando = null;
  limpiarFormulario();
  modal.style.display = "flex";
});

/* ===================== GUARDAR ===================== */
saveButton.addEventListener("click", () => {
  const name = document.getElementById("business-name").value;
  const amount = document.getElementById("business-amount").value;
  const day = document.getElementById("business-day").value;

  if (!name || !amount || !day) return;

  obtenerImagen((img) => {
    if (tarjetaEditando) {
      tarjetaEditando.querySelector("h4").textContent = name;
      tarjetaEditando.querySelector("p").textContent = `${day} • $${amount}`;
      tarjetaEditando.dataset.monto = amount;
      tarjetaEditando.querySelector("img").src = img;
    } else {
      crearTarjeta(name, amount, day, "Pendiente", img);
    }

    guardarEstados();
    actualizarTotales();
    modal.style.display = "none";
    limpiarFormulario();
  });
});

/* ===================== CANCELAR ===================== */
cancelButton.addEventListener("click", () => {
  modal.style.display = "none";
  tarjetaEditando = null;
  limpiarFormulario();
});

/* ===================== EVENTOS ===================== */
document.addEventListener("click", (e) => {

  if (e.target.classList.contains("delete-btn")) {
    e.target.closest(".payment-card").remove();
    guardarEstados();
    actualizarTotales();
  }

  if (e.target.classList.contains("edit-btn")) {
    tarjetaEditando = e.target.closest(".payment-card");

    const texto = tarjetaEditando.querySelector("p").textContent;

    document.getElementById("business-name").value = tarjetaEditando.querySelector("h4").textContent;
    document.getElementById("business-amount").value = tarjetaEditando.dataset.monto;
    document.getElementById("business-day").value = texto.split("•")[0].trim();

    modal.style.display = "flex";
  }

  if (e.target.classList.contains("filter-btn")) {
    const filtro = e.target.dataset.filter;

    document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.remove("active"));
    e.target.classList.add("active");

    document.querySelectorAll(".payment-card").forEach((card) => {
      const estado = card.querySelector(".status");
      card.style.display = (filtro === "all" || estado.classList.contains(filtro)) ? "flex" : "none";
    });
  }
});

/* ===================== BUSCADOR ===================== */
document.getElementById("search-business").addEventListener("input", (e) => {
  const texto = e.target.value.toLowerCase();

  document.querySelectorAll(".payment-card").forEach((card) => {
    const nombre = card.querySelector("h4").textContent.toLowerCase();
    card.style.display = nombre.includes(texto) ? "flex" : "none";
  });
});

/* ===================== HISTORIAL ===================== */
saveHistoryButton.addEventListener("click", () => {
  const historial = JSON.parse(localStorage.getItem("historial")) || [];
  const negociosSemana = JSON.parse(localStorage.getItem("negocios")) || [];

  const fecha = new Date().toLocaleDateString("es-MX");

  if (!historial.some(s => s.fecha === fecha)) {
    historial.push({ fecha, negocios: negociosSemana });
    localStorage.setItem("historial", JSON.stringify(historial));
  }

  const historyList = document.getElementById("history-list");
  historyList.innerHTML = "";

  historial.forEach((semana) => {
    const card = document.createElement("div");
    card.classList.add("card");

    let html = `<h4>${semana.fecha}</h4>`;
    semana.negocios.forEach(n => {
      html += `<p style="color:#94a3b8;">${n.nombre} • ${n.dia} • $${n.monto}</p>`;
    });

    card.innerHTML = html;
    historyList.appendChild(card);
  });

  document.querySelector(".payments").style.display = "none";
  document.getElementById("history-view").style.display = "block";
});

/* ===================== VOLVER ===================== */
backHomeButton.addEventListener("click", () => {
  document.getElementById("history-view").style.display = "none";
  document.querySelector(".payments").style.display = "block";
});

/* ===================== INIT ===================== */
cargarEstados();