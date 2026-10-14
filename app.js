const saveHistoryButton = document.getElementById("save-history");
const backHomeButton = document.getElementById("back-home");
const clearHistoryButton = document.getElementById("clear-history");
const cancelButton = document.getElementById("cancel-business");

const totalNegocios = document.getElementById("total-negocios");
const totalSemanal = document.getElementById("total-semanal");
const totalCobrado = document.getElementById("total-cobrado");
const totalPendiente = document.getElementById("total-pendiente");
const gananciaMensual = document.getElementById("ganancia-mensual");
const mesGanancia = document.getElementById("mes-ganancia");

const addButton = document.getElementById("add-business");
const modal = document.getElementById("business-modal");
const saveButton = document.getElementById("save-business");
const paymentsSection = document.querySelector(".payments");
const imageInput = document.getElementById("business-image");
const clearCacheButton = document.getElementById("clear-cache");
const appMessage = document.getElementById("app-message");
const markAllPaidButton = document.getElementById("mark-all-paid");
const markAllPendingButton = document.getElementById("mark-all-pending");

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

/* ===================== CAMBIAR ESTADO DE TODOS ===================== */
function cambiarEstadoDeTodos(nuevoEstado) {
  const accion = nuevoEstado === "Cobrado" ? "cobrado" : "pendiente";
  const cantidad = document.querySelectorAll(".payment-card").length;

  if (cantidad === 0) {
    appMessage.textContent = "No hay negocios para actualizar.";
    return;
  }

  if (!confirm(`¿Marcar los ${cantidad} negocios como ${accion}? Esta acción cambiará el estado de todos.`)) return;

  document.querySelectorAll(".payment-card").forEach((card) => {
    const estado = card.querySelector(".status");
    estado.classList.toggle("paid", nuevoEstado === "Cobrado");
    estado.classList.toggle("pending", nuevoEstado === "Pendiente");
    estado.textContent = nuevoEstado;
  });

  guardarEstados();
  actualizarTotales();
  appMessage.textContent = `Listo: ${cantidad} negocios marcados como ${accion}.`;
}

markAllPaidButton?.addEventListener("click", () => cambiarEstadoDeTodos("Cobrado"));
markAllPendingButton?.addEventListener("click", () => cambiarEstadoDeTodos("Pendiente"));

/* ===================== GANANCIA MENSUAL ===================== */
function fechaDesdeTexto(valor) {
  if (!valor) return null;
  const texto = String(valor).trim();
  let m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12);
  return null;
}

function obtenerInicioSemana(fecha) {
  const inicio = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12);
  const dia = inicio.getDay();
  inicio.setDate(inicio.getDate() + (dia === 0 ? -6 : 1 - dia));
  return inicio;
}

function claveDeSemana(semana) {
  if (semana && /^\d{4}-\d{2}-\d{2}$/.test(String(semana.periodo || ""))) {
    return semana.periodo;
  }
  const fecha = fechaDesdeTexto(semana && semana.fecha);
  if (!fecha) return "";
  const inicio = obtenerInicioSemana(fecha);
  return inicio.getFullYear() + "-" + String(inicio.getMonth() + 1).padStart(2, "0") + "-" + String(inicio.getDate()).padStart(2, "0");
}

function sincronizarSemanaActual() {
  let historial;
  let negociosActuales;
  try {
    historial = JSON.parse(localStorage.getItem("historial") || "[]");
    negociosActuales = JSON.parse(localStorage.getItem("negocios") || "[]");
  } catch (error) {
    console.error("No se pudo sincronizar el historial semanal:", error);
    return [];
  }
  if (!Array.isArray(historial)) historial = [];
  if (!Array.isArray(negociosActuales)) negociosActuales = [];

  const ahora = new Date();
  const inicio = obtenerInicioSemana(ahora);
  const periodo = inicio.getFullYear() + "-" + String(inicio.getMonth() + 1).padStart(2, "0") + "-" + String(inicio.getDate()).padStart(2, "0");
  const indice = historial.findIndex((semana) => semana && Array.isArray(semana.negocios) && claveDeSemana(semana) === periodo);

  // No crea semanas vacías, pero sí actualiza una semana que ya existe.
  if (negociosActuales.length > 0 || indice >= 0) {
    const anterior = indice >= 0 ? historial[indice] : null;
    const registro = {
      ...(anterior || {}),
      fecha: (anterior && anterior.fecha) || ahora.toLocaleDateString("es-MX"),
      periodo,
      negocios: negociosActuales
    };
    if (indice >= 0) historial[indice] = registro;
    else historial.push(registro);
    try {
      localStorage.setItem("historial", JSON.stringify(historial));
    } catch (error) {
      console.error("No se pudo guardar la semana actual:", error);
    }
  }
  return historial;
}

function montoDeNegocios(negocios) {
  if (!Array.isArray(negocios)) return 0;
  return negocios.reduce((total, negocio) => {
    const monto = Number(String(negocio && negocio.monto || "0").replace(/[$,\s]/g, ""));
    return total + (Number.isFinite(monto) ? monto : 0);
  }, 0);
}

function actualizarGananciaMensual() {
  const historial = sincronizarSemanaActual();
  const ahora = new Date();
  const añoActual = ahora.getFullYear();
  const mesActual = ahora.getMonth();
  const semanasContadas = new Set();
  let total = 0;

  historial.forEach((semana) => {
    if (!semana || !Array.isArray(semana.negocios)) return;
    const fechaRegistro = fechaDesdeTexto(semana.fecha) || fechaDesdeTexto(semana.periodo);
    if (!fechaRegistro || fechaRegistro.getFullYear() !== añoActual || fechaRegistro.getMonth() !== mesActual) return;
    const clave = claveDeSemana(semana) || String(semana.fecha || "");
    if (semanasContadas.has(clave)) return;
    semanasContadas.add(clave);
    total += montoDeNegocios(semana.negocios);
  });

  if (gananciaMensual) {
    gananciaMensual.textContent = total.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 2
    });
  }
  if (mesGanancia) {
    mesGanancia.textContent = "Suma de las semanas registradas en " + ahora.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  }
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
  totalPendiente.textContent = `${pendiente}`;
  actualizarGananciaMensual();
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
    const ahora = new Date(); const fecha = ahora.toLocaleDateString("es-MX");
    const inicioSemana = obtenerInicioSemana(ahora);
    const periodo = inicioSemana.getFullYear()+"-"+String(inicioSemana.getMonth()+1).padStart(2,"0")+"-"+String(inicioSemana.getDate()).padStart(2,"0");
    const indiceSemana = historial.findIndex((semana) => {
      const fechaSemana = obtenerFechaRegistro(semana); if (!fechaSemana) return false;
      const inicio = semana.periodo ? semana.periodo : (() => { const f=obtenerInicioSemana(fechaSemana); return f.getFullYear()+"-"+String(f.getMonth()+1).padStart(2,"0")+"-"+String(f.getDate()).padStart(2,"0"); })();
      return inicio === periodo;
    });
    const registroSemana = { fecha, periodo, negocios: negociosSemana };
    if (indiceSemana >= 0) historial[indiceSemana] = registroSemana; else historial.push(registroSemana);
    try { localStorage.setItem("historial", JSON.stringify(historial)); }
    catch (error) { appMessage.textContent = "No se pudo guardar esta semana por falta de espacio, pero puedes ver el historial existente."; }
    actualizarGananciaMensual();
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
try { cargarEstados(); } catch (error) { console.error("No se pudieron cargar los negocios:", error); appMessage.textContent = "No se pudieron cargar los datos guardados."; }
actualizarGananciaMensual();
/* ===================== RESPALDO Y TRASLADO DE DATOS ===================== */
const exportDataButton = document.getElementById("export-data");
const importDataButton = document.getElementById("import-data");
const importFileInput = document.getElementById("import-file");
exportDataButton?.addEventListener("click", async () => {
  try {
    const backup = {
      app: "Estación",
      version: 1,
      exportedAt: new Date().toISOString(),
      negocios: JSON.parse(localStorage.getItem("negocios") || "[]"),
      historial: JSON.parse(localStorage.getItem("historial") || "[]")
    };
    if (!Array.isArray(backup.negocios) || !Array.isArray(backup.historial)) {
      throw new Error("Los datos guardados no tienen un formato válido.");
    }
    const fecha = new Date().toISOString().slice(0, 10);
    const archivo = new File([JSON.stringify(backup)], `respaldo-estacion-${fecha}.json`, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      await navigator.share({ files: [archivo], title: "Respaldo de Estación" });
      appMessage.textContent = "Respaldo listo. Guárdalo en Archivos para importarlo en la otra app.";
    } else {
      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = archivo.name;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      appMessage.textContent = "Respaldo descargado. Búscalo en Archivos para importarlo en la otra app.";
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("No se pudo exportar el respaldo:", error);
      appMessage.textContent = "No se pudo crear el respaldo. Inténtalo otra vez.";
    }
  }
});
importDataButton?.addEventListener("click", () => importFileInput.click());
importFileInput?.addEventListener("change", async () => {
  const archivo = importFileInput.files[0];
  if (!archivo) return;
  try {
    const respaldo = JSON.parse(await archivo.text());
    const esNegocio = (item) => item && typeof item.nombre === "string" &&
      (typeof item.monto === "string" || typeof item.monto === "number") &&
      typeof item.dia === "string" && typeof item.estado === "string" && typeof item.imagen === "string";
    const esSemana = (semana) => semana && typeof semana.fecha === "string" &&
      Array.isArray(semana.negocios) && semana.negocios.every(esNegocio);
    if (!respaldo || !Array.isArray(respaldo.negocios) || !Array.isArray(respaldo.historial) ||
        !respaldo.negocios.every(esNegocio) || !respaldo.historial.every(esSemana)) {
      throw new Error("El archivo no es un respaldo válido de Estación.");
    }
    const negociosActuales = JSON.parse(localStorage.getItem("negocios") || "[]");
    const historialActual = JSON.parse(localStorage.getItem("historial") || "[]");
    if ((negociosActuales.length || historialActual.length) &&
        !confirm("Esta app ya tiene datos. ¿Quieres reemplazarlos con el respaldo seleccionado?")) return;
    const anteriorNegocios = localStorage.getItem("negocios");
    const anteriorHistorial = localStorage.getItem("historial");
    try {
      localStorage.setItem("negocios", JSON.stringify(respaldo.negocios));
      localStorage.setItem("historial", JSON.stringify(respaldo.historial));
    } catch (error) {
      try {
        anteriorNegocios === null ? localStorage.removeItem("negocios") : localStorage.setItem("negocios", anteriorNegocios);
        anteriorHistorial === null ? localStorage.removeItem("historial") : localStorage.setItem("historial", anteriorHistorial);
      } catch (rollbackError) {
        console.error("No se pudieron restaurar los datos anteriores:", rollbackError);
      }
      throw error;
    }
    document.querySelectorAll(".payment-card").forEach((card) => card.remove());
    try { cargarEstados(); } catch (error) { console.error("No se pudieron cargar los negocios:", error); appMessage.textContent = "No se pudieron cargar los datos guardados."; }
    appMessage.textContent = `Respaldo importado: ${respaldo.negocios.length} negocios y ${respaldo.historial.length} semanas.`;
  } catch (error) {
    console.error("No se pudo importar el respaldo:", error);
    appMessage.textContent = "No se pudo importar ese archivo. Verifica que sea un respaldo de Estación.";
  } finally {
    importFileInput.value = "";
  }
});
