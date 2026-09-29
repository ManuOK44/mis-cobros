const saveHistoryButton = document.getElementById("save-history");
const backHomeButton = document.getElementById("back-home");
const clearHistoryButton = document.getElementById("clear-history");
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
const clearCacheButton = document.getElementById("clear-cache");
const appMessage = document.getElementById("app-message");

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
function optimizarImagen(src) {
  return new Promise((resolve, reject) => {
    if (!src) return resolve("");
    const image = new Image();
    image.onload = () => {
      const maxSize = 640;
      const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = reject;
    image.src = src;
  });
}

function obtenerImagen() {
  return new Promise((resolve, reject) => {
  const file = imageInput.files[0];

  if (!file) {
      optimizarImagen(tarjetaEditando ? tarjetaEditando.querySelector("img").src : "").then(resolve, reject);
      return;
  }

  const reader = new FileReader();
    reader.onload = () => optimizarImagen(reader.result).then(resolve, reject);
    reader.onerror = reject;
  reader.readAsDataURL(file);
  });
}

/* ===================== AGREGAR ===================== */
addButton.addEventListener("click", () => {
  tarjetaEditando = null;
  limpiarFormulario();
  modal.style.display = "flex";
});

/* ===================== GUARDAR ===================== */
saveButton.addEventListener("click", async () => {
  const name = document.getElementById("business-name").value;
  const amount = document.getElementById("business-amount").value;
  const day = document.getElementById("business-day").value;

  if (!name || !amount || !day) return;

  saveButton.disabled = true;
  appMessage.textContent = "Guardando…";
  try {
    const img = await obtenerImagen();
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
    appMessage.textContent = "Cambios guardados.";
  } catch (error) {
    console.error("No se pudo guardar el negocio:", error);
    appMessage.textContent = "No se pudo guardar. Borra imágenes antiguas o libera espacio del navegador.";
  } finally {
    saveButton.disabled = false;
  }
});

clearCacheButton.addEventListener("click", async () => {
  if (!confirm("¿Borrar los archivos temporales de esta app? Tus negocios y tu historial se conservarán.")) return;
  try {
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }
    appMessage.textContent = "Caché de la app borrado. Tus negocios e historial siguen guardados.";
  } catch (error) {
    console.error("No se pudo borrar el caché:", error);
    appMessage.textContent = "El navegador no permitió borrar el caché.";
  }
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
  const historyList = document.getElementById("history-list");
  const historyView = document.getElementById("history-view");
  const payments = document.querySelector(".payments");

  payments.style.display = "none";
  historyView.style.display = "block";
  historyList.innerHTML = "";

  try {
    const historialGuardado = JSON.parse(localStorage.getItem("historial") || "[]");
    const historial = Array.isArray(historialGuardado)
      ? historialGuardado.filter((semana) => semana && Array.isArray(semana.negocios))
      : [];

    const negociosGuardados = JSON.parse(localStorage.getItem("negocios") || "[]");
    const negociosSemana = Array.isArray(negociosGuardados) ? negociosGuardados : [];
    const fecha = new Date().toLocaleDateString("es-MX");

    if (!historial.some((semana) => semana.fecha === fecha)) {
      historial.push({ fecha, negocios: negociosSemana });
      try {
        localStorage.setItem("historial", JSON.stringify(historial));
      } catch (error) {
        appMessage.textContent = "No se pudo guardar esta semana por falta de espacio, pero puedes ver el historial existente.";
      }
    }

    if (historial.length === 0) {
      historyList.innerHTML = '<p class="empty-history">No hay semanas guardadas en el historial.</p>';
      return;
    }

    historial.forEach((semana) => {
      const card = document.createElement("div");
      card.classList.add("card");

      const titulo = document.createElement("h4");
      titulo.textContent = semana.fecha || "Semana guardada";
      card.appendChild(titulo);

      semana.negocios.forEach((negocio) => {
        const detalle = document.createElement("p");
        detalle.style.color = "#94a3b8";
        detalle.textContent = `${negocio.nombre || "Negocio"} • ${negocio.dia || ""} • $${negocio.monto || 0}`;
        card.appendChild(detalle);
      });

      historyList.appendChild(card);
    });
  } catch (error) {
    console.error("No se pudo leer el historial:", error);
    historyList.innerHTML = '<p class="empty-history">No se pudo leer el historial guardado. Puedes borrarlo e intentarlo de nuevo.</p>';
  }
});

clearHistoryButton.addEventListener("click", () => {
  if (!confirm("¿Borrar todo el historial semanal? Los negocios actuales se conservarán.")) return;

  localStorage.removeItem("historial");
  document.getElementById("history-list").innerHTML = '<p class="empty-history">No hay semanas guardadas en el historial.</p>';
  appMessage.textContent = "Historial borrado. Tus negocios actuales se conservaron.";
});

/* ===================== VOLVER ===================== */
backHomeButton.addEventListener("click", () => {
  document.getElementById("history-view").style.display = "none";
  document.querySelector(".payments").style.display = "block";
});

/* ===================== INIT ===================== */
cargarEstados();
