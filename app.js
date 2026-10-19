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

/* ===================== OCULTAR / MOSTRAR CIFRAS ===================== */
const toggleFiguresButton = document.getElementById("toggle-figures");

function aplicarVisibilidadCifras(ocultar) {
  document.body.classList.toggle("hide-figures", ocultar);
  if (toggleFiguresButton) {
    toggleFiguresButton.innerHTML = '<svg class="eye-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle><path class="eye-slash" d="M4 4 20 20"></path></svg>';
    toggleFiguresButton.setAttribute("aria-label", ocultar ? "Mostrar cifras" : "Ocultar cifras");
    toggleFiguresButton.setAttribute("aria-pressed", String(ocultar));
    toggleFiguresButton.title = ocultar ? "Mostrar cifras" : "Ocultar cifras";
  }
}

if (toggleFiguresButton) {
  aplicarVisibilidadCifras(localStorage.getItem("estacionOcultarCifras") === "true");
  toggleFiguresButton.addEventListener("click", () => {
    const ocultar = !document.body.classList.contains("hide-figures");
    localStorage.setItem("estacionOcultarCifras", String(ocultar));
    aplicarVisibilidadCifras(ocultar);
  });
}


/* Logos en IndexedDB. Cobros e historial permanecen en localStorage.
   Las referencias tienen formato idb-logo:<identificador>; los respaldos
   siguen exportando imágenes completas para conservar compatibilidad. */
const LOGOS_DB = "estacion-logos-v1";
const LOGO_PREFIX = "idb-logo:";
function abrirAlmacenLogos() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("IndexedDB no disponible"));
    const req = indexedDB.open(LOGOS_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("logos")) req.result.createObjectStore("logos");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("No se pudo abrir IndexedDB"));
  });
}
async function ejecutarLogo(tipo, clave, contenido) {
  const db = await abrirAlmacenLogos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("logos", tipo === "get" ? "readonly" : "readwrite");
    const store = tx.objectStore("logos");
    const req = tipo === "get" ? store.get(clave) : store.put(contenido, clave);
    let resultado;
    req.onsuccess = () => { resultado = req.result; };
    tx.oncomplete = () => { db.close(); resolve(resultado); };
    tx.onerror = () => { const e = tx.error; db.close(); reject(e || new Error("Error al guardar logo")); };
    tx.onabort = () => { const e = tx.error; db.close(); reject(e || new Error("Guardado cancelado")); };
  });
}
function esReferenciaLogo(src) { return typeof src === "string" && src.startsWith(LOGO_PREFIX); }
async function guardarLogo(src) {
  if (!src || esReferenciaLogo(src) || !src.startsWith("data:image/")) return src || "";
  const clave = LOGO_PREFIX + (globalThis.crypto?.randomUUID?.() || Date.now()+"-"+Math.random().toString(36).slice(2));
  await ejecutarLogo("put", clave, src);
  return clave;
}
async function resolverLogo(src) {
  return esReferenciaLogo(src) ? (await ejecutarLogo("get", src) || "") : (src || "");
}
function mostrarLogo(img, src) {
  if (!img) return;
  img.dataset.logoRef = src || "";
  if (!esReferenciaLogo(src)) { img.src = src || "https://via.placeholder.com/50"; return; }
  img.removeAttribute("src");
  resolverLogo(src).then(valor => {
    if (img.dataset.logoRef === src) img.src = valor || "https://via.placeholder.com/50";
  }).catch(error => {
    console.error("No se pudo cargar logo:", error);
    if (img.dataset.logoRef === src) img.alt = "Logo no disponible";
  });
}
async function convertirLogosDatos(datos) {
  const conversiones = new Map();
  const convertir = async item => {
    if (!item || typeof item.imagen !== "string" || !item.imagen.startsWith("data:image/")) return;
    if (!conversiones.has(item.imagen)) conversiones.set(item.imagen, await guardarLogo(item.imagen));
    item.imagen = conversiones.get(item.imagen);
  };
  for (const n of datos.negocios || []) await convertir(n);
  for (const semana of datos.historial || []) for (const n of semana.negocios || []) await convertir(n);
}
async function exportarImagenes(datos) {
  const cache = new Map();
  const restaurar = async n => {
    if (!n || !esReferenciaLogo(n.imagen)) return;
    if (!cache.has(n.imagen)) {
      const original = await resolverLogo(n.imagen);
      if (!original) throw new Error("Falta un logo en el almacenamiento");
      cache.set(n.imagen, original);
    }
    n.imagen = cache.get(n.imagen);
  };
  for (const n of datos.negocios || []) await restaurar(n);
  for (const semana of datos.historial || []) for (const n of semana.negocios || []) await restaurar(n);
}
async function migrarLogosExistentes() {
  const negocios = JSON.parse(localStorage.getItem("negocios") || "[]");
  const historial = JSON.parse(localStorage.getItem("historial") || "[]");
  if (!Array.isArray(negocios) || !Array.isArray(historial)) return;
  const hayImagenesViejas = [...negocios, ...historial.flatMap(s => s.negocios || [])]
    .some(n => n && typeof n.imagen === "string" && n.imagen.startsWith("data:image/"));
  if (!hayImagenesViejas) return;
  await convertirLogosDatos({negocios, historial});
  // Solo sustituimos los registros después de que todas las imágenes
  // se hayan escrito con éxito en IndexedDB.
  const prevNegocios = localStorage.getItem("negocios");
  const prevHistorial = localStorage.getItem("historial");
  try {
    localStorage.setItem("negocios", JSON.stringify(negocios));
    localStorage.setItem("historial", JSON.stringify(historial));
  } catch (error) {
    if (prevNegocios === null) localStorage.removeItem("negocios");
    else localStorage.setItem("negocios", prevNegocios);
    if (prevHistorial === null) localStorage.removeItem("historial");
    else localStorage.setItem("historial", prevHistorial);
    throw error;
  }
}

/* ===================== GUARDAR ===================== */
function guardarEstados() {
  const datos = [];

  document.querySelectorAll(".payment-card").forEach((card) => {
    datos.push({
      nombre: card.querySelector("h4").textContent,
      monto: card.dataset.monto,
      dia: card.querySelector("p").textContent.split("•")[0].trim(),
      estado: card.querySelector(".status").textContent,
      imagen: card.querySelector("img").dataset.logoRef || card.querySelector("img").src
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
  mostrarLogo(card.querySelector("img"), imagen);
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
  if (semana && /^\d{4}-\d{2}-\d{2}$/.test(String(semana.periodo || ""))) return semana.periodo;
  const fecha = fechaDesdeTexto(semana && semana.fecha);
  if (!fecha) return "";
  const inicio = obtenerInicioSemana(fecha);
  return inicio.getFullYear() + "-" + String(inicio.getMonth() + 1).padStart(2, "0") + "-" + String(inicio.getDate()).padStart(2, "0");
}

function montoDeNegocios(negocios) {
  if (!Array.isArray(negocios)) return 0;
  return negocios.reduce((total, negocio) => {
    const monto = Number(String(negocio && negocio.monto || "0").replace(/[$,\s]/g, ""));
    return total + (Number.isFinite(monto) ? monto : 0);
  }, 0);
}

function sincronizarSemanaActual() {
  let historial = [];
  let negociosActuales = [];
  try {
    const guardado = JSON.parse(localStorage.getItem("historial") || "[]");
    historial = Array.isArray(guardado) ? guardado : [];
    const actuales = JSON.parse(localStorage.getItem("negocios") || "[]");
    negociosActuales = Array.isArray(actuales) ? actuales : [];
  } catch (error) {
    console.error("No se pudo leer el historial:", error);
    return [];
  }

  const ahora = new Date();
  const inicio = obtenerInicioSemana(ahora);
  const periodo = inicio.getFullYear() + "-" + String(inicio.getMonth() + 1).padStart(2, "0") + "-" + String(inicio.getDate()).padStart(2, "0");
  const indice = historial.findIndex((semana) => semana && Array.isArray(semana.negocios) && claveDeSemana(semana) === periodo);

  // La semana actual siempre refleja los negocios actuales; las semanas anteriores no se modifican.
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
    try { localStorage.setItem("historial", JSON.stringify(historial)); }
    catch (error) { console.error("No se pudo guardar la semana actual:", error); }
  }
  return historial;
}

function actualizarGananciaMensual() {
  // Estimación mensual: cobro semanal actual multiplicado por 4.
  const semanalActual = Number(
    String(totalSemanal && totalSemanal.textContent || "0").replace(/[$,\s]/g, "")
  ) || 0;
  const totalMensual = semanalActual * 4;

  if (gananciaMensual) {
    gananciaMensual.textContent = totalMensual.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 2
    });
  }
  if (mesGanancia) {
    mesGanancia.textContent = "Estimación mensual";
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
      resolve(tarjetaEditando ? (tarjetaEditando.querySelector("img").dataset.logoRef || tarjetaEditando.querySelector("img").src) : "");
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
    const referenciaImagen = await guardarLogo(img);
    if (tarjetaEditando) {
      tarjetaEditando.querySelector("h4").textContent = name;
      tarjetaEditando.querySelector("p").textContent = `${day} • $${amount}`;
      tarjetaEditando.dataset.monto = amount;
      mostrarLogo(tarjetaEditando.querySelector("img"), referenciaImagen);
    } else {
      crearTarjeta(name, amount, day, "Pendiente", referenciaImagen);
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

/* Confirmación visible del estado de almacenamiento de logos. */
async function confirmarAlmacenamientoLogos() {
  const indicador = document.getElementById("logo-storage-status");
  if (!indicador) return;
  try {
    const negocios = JSON.parse(localStorage.getItem("negocios") || "[]");
    const historial = JSON.parse(localStorage.getItem("historial") || "[]");
    const registros = [...negocios, ...historial.flatMap(s => Array.isArray(s.negocios) ? s.negocios : [])];
    const logos = [...new Set(registros.map(n => n?.imagen).filter(x => typeof x === "string" && x.startsWith("data:image/") || esReferenciaLogo(x)))];
    if (logos.some(x => !esReferenciaLogo(x))) throw new Error("Hay logos pendientes de migración");
    for (const ref of logos) {
      if (!(await resolverLogo(ref))) throw new Error("Un logo no se pudo recuperar");
    }
    // Una escritura y lectura real confirma que IndexedDB funciona aun si no hay logos.
    const prueba = "idb-logo:prueba-almacenamiento";
    await ejecutarLogo("put", prueba, "ok");
    if ((await ejecutarLogo("get", prueba)) !== "ok") throw new Error("La prueba de lectura falló");
    indicador.textContent = "✓ Almacenamiento actualizado";
    indicador.style.color = "#22c55e";
  } catch (error) {
    console.error("No se pudo confirmar almacenamiento:", error);
    indicador.textContent = "Almacenamiento pendiente de verificar";
    indicador.style.color = "#eab308";
  }
}

/* ===================== INIT ===================== */
migrarLogosExistentes().catch(error => {
  console.error("No se pudieron migrar los logos:", error);
  appMessage.textContent = "No se pudieron migrar algunos logos. Tus datos originales se conservaron.";
}).finally(async () => {
  await confirmarAlmacenamientoLogos();
  try { cargarEstados(); } catch (error) { console.error("No se pudieron cargar los negocios:", error); appMessage.textContent = "No se pudieron cargar los datos guardados."; }
});
actualizarGananciaMensual();
/* ===================== NAVEGACIÓN PRINCIPAL ===================== */
const vistasEstacion = {
  inicio: document.getElementById("nav-inicio"),
  cobros: document.getElementById("nav-cobros"),
  negocios: document.getElementById("nav-negocios"),
  historial: saveHistoryButton
};
function abrirVistaEstacion(vista) {
  const historial = document.getElementById("history-view");
  const resumen = document.querySelector(".summary");
  const titulo = paymentsSection.querySelector(".section-title h3");
  const esHistorial = vista === "historial";
  historial.style.display = esHistorial ? "block" : "none";
  paymentsSection.style.display = (vista === "inicio" || vista === "negocios") ? "block" : "none";
  resumen.style.display = (vista === "inicio" || vista === "cobros") ? "" : "none";
  document.body.classList.toggle("vista-negocios", vista === "negocios");
  if (titulo) titulo.textContent = vista === "negocios" ? "Negocios registrados" : "Cobros de esta semana";
  if (vista === "negocios") {
    const buscador = document.getElementById("search-business");
    if (buscador) { buscador.value = ""; buscador.dispatchEvent(new Event("input", {bubbles:true})); }
    const todos = document.querySelector('.filter-btn[data-filter="all"]');
    if (todos) todos.click();
  }
  Object.entries(vistasEstacion).forEach(([nombre, boton]) => {
    if (!boton) return;
    if (nombre === vista) boton.setAttribute("aria-current", "page");
    else boton.removeAttribute("aria-current");
  });
  if (!esHistorial) window.scrollTo({top:0,behavior:"auto"});
}
["inicio", "cobros", "negocios"].forEach(vista => {
  vistasEstacion[vista]?.addEventListener("click", () => abrirVistaEstacion(vista));
});
saveHistoryButton.addEventListener("click", () => abrirVistaEstacion("historial"));
backHomeButton.addEventListener("click", () => abrirVistaEstacion("inicio"));

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
    await exportarImagenes(backup);
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
    // Copia nueva: se preserva el archivo original del usuario.
    await convertirLogosDatos(respaldo);
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
