/* Núcleo compartido: utilidades, conexión con Google y modo demostración */
const CFG = window.APP_CONFIG || {};
const DEMO = !CFG.API_URL;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const store = {
  get(k, d) { try { const v = localStorage.getItem('rio_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('rio_' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem('rio_' + k); } catch (e) {} }
};
const sesion = {
  get(k, d) { try { const v = sessionStorage.getItem('rio_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return memSesion[k] ?? d; } },
  set(k, v) { memSesion[k] = v; try { sessionStorage.setItem('rio_' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { delete memSesion[k]; try { sessionStorage.removeItem('rio_' + k); } catch (e) {} }
};
const memSesion = {};

/* ---------- Fechas ---------- */
const z2 = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const hoy = () => ymd(new Date());
const addDias = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
function semana(offset = 0) {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow + 7 * offset);
  const ini = ymd(d);
  return { inicio: ini, fin: addDias(ini, 6) };
}
function fmtFecha(s, o = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!s) return '';
  return parseYmd(s).toLocaleDateString('es-GT', o).replace(/\./g, '');
}
const fmtLarga = s => fmtFecha(s, { weekday: 'long', day: 'numeric', month: 'long' });
function fmtRango(a, b) {
  if (!a && !b) return '';
  if (!b || a === b) return fmtFecha(a, { day: 'numeric', month: 'long' });
  if (!a) return 'hasta ' + fmtFecha(b, { day: 'numeric', month: 'long' });
  const A = parseYmd(a), B = parseYmd(b);
  if (A.getMonth() === B.getMonth()) return `${A.getDate()}–${B.getDate()} de ${B.toLocaleDateString('es-GT', { month: 'long' })}`;
  return `${fmtFecha(a, { day: 'numeric', month: 'short' })} – ${fmtFecha(b, { day: 'numeric', month: 'short' })}`;
}
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- Catálogos ---------- */
const SECCIONES = {
  entresemana: { nombre: 'Reunión de entre semana', corto: 'Entre semana', color: '#3d6b75' },
  discursos: { nombre: 'Discursos públicos', corto: 'Discursos', color: '#1f3a5f' },
  limpieza: { nombre: 'Limpieza', corto: 'Limpieza', color: '#4f7a3a' },
  audio_video: { nombre: 'Audio y video', corto: 'Audio y video', color: '#6a4c93' },
  acomodadores: { nombre: 'Acomodadores', corto: 'Acomodadores', color: '#946f2a' },
  predicacion: { nombre: 'Salidas a predicar', corto: 'Predicación', color: '#8b2f2b' }
};
const TIPOS_ANUNCIO = {
  anuncio: 'Anuncio', asamblea: 'Asamblea', superintendente: 'Visita del superintendente',
  conmemoracion: 'Conmemoración', otro: 'Evento'
};
const SUGERENCIAS_ASIGNACION = {
  entresemana: ['Presidente', 'Oración inicial', 'Oración final', 'Tesoros de la Biblia', 'Busquemos perlas escondidas', 'Lectura de la Biblia', 'Empecemos conversaciones', 'Hagamos revisitas', 'Hagamos discípulos', 'Nuestra vida cristiana', 'Estudio bíblico de la congregación', 'Lector del estudio'],
  discursos: ['Presidente', 'Lector de La Atalaya', 'Discursante saliente', 'Hospitalidad', 'Conductor de La Atalaya'],
  limpieza: ['Limpieza del Salón', 'Limpieza general', 'Limpieza de baños', 'Jardín'],
  audio_video: ['Audio', 'Video', 'Micrófono 1', 'Micrófono 2', 'Plataforma', 'Zoom'],
  acomodadores: ['Acomodador de entrada', 'Acomodador del auditorio', 'Estacionamiento'],
  predicacion: ['Conductor de la salida', 'Territorio', 'Carrito / predicación pública']
};

/* ---------- Archivos ---------- */
const esPdf = it => /pdf/i.test(it.mimeType || '') || /\.pdf$/i.test(it.url || '');
const srcImagen = it => it.url || (it.archivoId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(it.archivoId)}&sz=w2000` : '');
const urlOriginal = it => it.url || (it.archivoId ? `https://drive.google.com/file/d/${encodeURIComponent(it.archivoId)}/view` : '');
const vigente = p => { const h = hoy(); return (!p.fechaInicio || p.fechaInicio <= h) && (!p.fechaFin || p.fechaFin >= h); };

/* ---------- Conexión ---------- */
/* Todas las solicitudes llevan el código de la congregación (publicadores)
   o la contraseña (ancianos). */
class ErrorCodigo extends Error { constructor(m) { super(m); this.codigo = true; } }
const API = {
  clave: '',
  credenciales() { return { codigo: store.get('codigo', ''), password: API.clave || '' }; },
  async get() { return API.post('data'); },
  async puntos() { return API.post('puntos'); },
  async post(action, payload = {}) {
    const cuerpo = { ...API.credenciales(), ...payload, action };
    if (DEMO) return Demo.handle(action, cuerpo);
    const r = await fetch(CFG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(cuerpo)
    });
    const j = await r.json();
    if (!j.ok) throw j.codigo ? new ErrorCodigo(j.error) : new Error(j.error || 'Error del servidor');
    return j.data;
  }
};

/* Identificador de este teléfono (para poder mover o quitar su propio punto) */
function miDispositivo() {
  let d = store.get('dispositivo', '');
  if (!d) { d = uid() + uid(); store.set('dispositivo', d); }
  return d;
}
function haceCuanto(iso) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!isFinite(m)) return '';
  if (m < 1) return 'ahora mismo';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return `hace ${h} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`;
}

/* ---------- Modo demostración (sin Google) ---------- */
const Demo = (() => {
  const KEY = 'demo_v4';
  // Sin datos de ejemplo: todo lo sube el cuerpo de ancianos.
  const semilla = () => ({
    password: 'rio2026', publicaciones: [], anuncios: [], asignaciones: [],
    hermanos: [], ancianos: [], preguntas: [], salidas: [], registro: [], codigo: ''
  });
  let st = store.get(KEY, null) || semilla();
  const guardar = () => { if (!store.set(KEY, st)) console.warn('Demo: no se pudo guardar (archivo grande); queda solo en esta sesión.'); };
  const admin = p => { if (p.password !== st.password) throw new Error('Contraseña incorrecta (en la demostración es: rio2026)'); };
  const espera = (ms = 250) => new Promise(r => setTimeout(r, ms));
  const semanaDe = off => semana(off);

  const puntosActivos = () => (st.puntos ||= []).filter(x => x.expira > new Date().toISOString())
    .map(({ dispositivo, ...x }) => x).sort((a, b) => b.actualizado.localeCompare(a.actualizado));
  async function handle(action, p) {
    await espera(action === 'subir' ? 700 : 200);
    const h = hoy();
    const PUBLICAS = ['data', 'puntos', 'marcarPunto', 'quitarPunto', 'enviarPregunta', 'misPreguntas', 'registrarTerritorio'];
    if (PUBLICAS.includes(action) && st.codigo && norm(p.codigo) !== norm(st.codigo) && p.password !== st.password)
      throw new ErrorCodigo('Código de la congregación incorrecto');
    switch (action) {
      case 'data': return JSON.parse(JSON.stringify({
        congregacion: CFG.CONGREGACION,
        publicaciones: [...st.publicaciones].sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || '') || (b.creado || '').localeCompare(a.creado || '')),
        anuncios: st.anuncios.filter(a => !a.fecha || (a.fechaFin || a.fecha) >= addDias(h, -1)).sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999')),
        asignaciones: st.asignaciones.filter(a => a.fecha >= addDias(h, -7)).sort((a, b) => a.fecha.localeCompare(b.fecha)),
        ancianos: st.ancianos, hermanos: st.hermanos.map(x => x.nombre),
        puntos: puntosActivos(),
        zoom: st.zoom || null,
        tablas: (st.tablas ||= []).filter(x => x.mes >= addDias(h, -14).slice(0, 7)).sort((a, b) => a.mes.localeCompare(b.mes)),
        programas: (st.programas ||= []).filter(x => x.fin >= addDias(h, -14)).sort((a, b) => a.fecha.localeCompare(b.fecha)),
        registro: (st.registro ||= []).filter(x => x.fecha >= addDias(h, -730)),
        salidas: (st.salidas ||= []).filter(x => x.repetir === 'semanal' || x.fecha >= addDias(h, -1)).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))
      }));
      case 'enviarPregunta': {
        const o = { id: uid(), fecha: new Date().toISOString(), nombre: p.nombre || '', anciano: p.anciano || '', pregunta: p.pregunta, respuesta: '', estado: 'pendiente' };
        st.preguntas.push(o); guardar(); return { id: o.id };
      }
      case 'puntos': return puntosActivos();
      case 'marcarPunto': {
        st.puntos ||= [];
        const ahora = new Date();
        const datos = { nombre: p.nombre, nota: p.nota || '', lat: +p.lat, lng: +p.lng, territorio: p.territorio || '', actualizado: ahora.toISOString(), expira: new Date(+ahora + 8 * 3600e3).toISOString() };
        let x = st.puntos.find(q => q.dispositivo === p.dispositivo);
        if (x) Object.assign(x, datos); else st.puntos.push(x = { id: uid(), dispositivo: p.dispositivo, ...datos });
        guardar(); return { id: x.id };
      }
      case 'quitarPunto': st.puntos = (st.puntos || []).filter(q => !(q.id === p.id && q.dispositivo === p.dispositivo)); guardar(); return true;
      case 'registrarTerritorio': {
        if (!p.conductor) throw new Error('Escriba el nombre del conductor');
        const o = { id: uid(), territorio: String(p.territorio), fecha: p.fecha, estado: p.estado === 'completo' ? 'completo' : 'parcial', conductor: p.conductor, nota: p.nota || '', creado: new Date().toISOString() };
        (st.registro ||= []).push(o); guardar(); return o;
      }
      case 'misPreguntas': return st.preguntas.filter(x => (p.ids || []).includes(x.id));
    }
    admin(p);
    switch (action) {
      case 'login': return { ok: true };
      case 'subir': {
        const o = { id: uid(), seccion: p.seccion, titulo: p.titulo, fechaInicio: p.fechaInicio, fechaFin: p.fechaFin, nota: p.nota || '', url: `data:${p.mimeType};base64,${p.base64}`, mimeType: p.mimeType, nombreArchivo: p.nombreArchivo, creado: new Date().toISOString() };
        st.publicaciones.push(o); guardar(); return o;
      }
      case 'borrarPublicacion': st.publicaciones = st.publicaciones.filter(x => x.id !== p.id); guardar(); return true;
      case 'guardarAnuncio': {
        const o = { id: uid(), tipo: p.tipo, titulo: p.titulo, texto: p.texto || '', fecha: p.fecha || '', hora: p.todoDia ? '' : (p.hora || ''),
          fechaFin: p.fechaFin && p.fecha && p.fechaFin > p.fecha ? p.fechaFin : '', lugar: p.lugar || '', todoDia: p.todoDia && p.fecha ? 'si' : '', mimeType: p.mimeType || '', url: p.base64 ? `data:${p.mimeType};base64,${p.base64}` : '', creado: new Date().toISOString() };
        st.anuncios.push(o); guardar(); return o;
      }
      case 'guardarSalida': {
        if ((p.tipo || 'casa') === 'casa' && !p.territorio) throw new Error('Para casa en casa elija el territorio');
        const o = { id: p.id || uid(), tipo: p.tipo || 'casa', repetir: p.repetir === 'semanal' ? 'semanal' : '', dias: p.repetir === 'semanal' ? String(p.dias || '') : '', fecha: p.fecha, hora: p.hora || '', territorio: String(p.territorio || ''), conductor: p.conductor || '', punto: p.punto || '', lat: p.lat || '', lng: p.lng || '', nota: p.nota || '', creado: new Date().toISOString() };
        st.salidas = (st.salidas || []).filter(x => x.id !== o.id); st.salidas.push(o); guardar(); return o;
      }
      case 'borrarRegistro': st.registro = (st.registro || []).filter(x => x.id !== p.id); guardar(); return true;
      case 'registroCompleto': return [...(st.registro || [])].sort((a, b) => b.fecha.localeCompare(a.fecha));
      case 'historial': {
        const desde = addDias(h, -365);
        const f = st.asignaciones.filter(a => a.fecha >= desde).map(a => ({ fecha: a.fecha, asignacion: a.asignacion, seccion: a.seccion, hermano: a.hermano }));
        (st.salidas || []).filter(x => x.conductor && x.fecha >= desde).forEach(x => f.push({ fecha: x.fecha, asignacion: 'Conductor de la salida · Territorio ' + x.territorio, seccion: 'predicacion', hermano: x.conductor }));
        return f;
      }
      case 'ajustes': return { codigo: st.codigo || '' };
      case 'guardarTablas': {
        const ahora = new Date().toISOString(); let n = 0;
        (p.tablas || []).forEach(t => {
          st.tablas = (st.tablas || []).filter(x => !(x.seccion === t.seccion && x.mes === t.mes));
          st.asignaciones = st.asignaciones.filter(a => !(a.origen === 'tabla' && a.seccion === t.seccion && a.fecha.slice(0, 7) === t.mes));
          const filas = (t.filas || []).filter(f => f.fecha && f.fecha.slice(0, 7) === t.mes).sort((a, b) => a.fecha.localeCompare(b.fecha));
          st.tablas.push({ id: uid(), seccion: t.seccion, mes: t.mes, columnas: t.columnas, filas, creado: ahora });
          filas.forEach(f => f.valores.forEach((v, i) => (t.sinAsignar || []).includes(i) ? null : String(v || '').split('/').map(x => x.trim()).filter(Boolean).forEach(nm => {
            st.asignaciones.push({ id: uid(), fecha: f.fecha, seccion: t.seccion, asignacion: t.columnas[i], hermano: nm, creado: ahora, origen: 'tabla' }); n++;
          })));
        });
        guardar(); return { tablas: (p.tablas || []).length, asignaciones: n };
      }
      case 'borrarTabla': {
        const t = (st.tablas || []).find(x => x.id === p.id);
        if (t) { st.tablas = st.tablas.filter(x => x.id !== p.id); st.asignaciones = st.asignaciones.filter(a => !(a.origen === 'tabla' && a.seccion === t.seccion && a.fecha.slice(0, 7) === t.mes)); guardar(); }
        return true;
      }
      case 'guardarProgramas': {
        const fechas = (p.programas || []).map(x => x.fecha);
        st.programas = (st.programas || []).filter(x => !fechas.includes(x.fecha));
        const ahora = new Date().toISOString();
        p.programas.forEach(x => st.programas.push({ id: uid(), fecha: x.fecha, inicio: x.inicio, fin: x.fin, lectura: x.lectura, presidente: x.presidente, items: x.items, creado: ahora }));
        let n = 0;
        if (p.conAsignaciones) {
          st.asignaciones = st.asignaciones.filter(a => !(a.origen === 'programa' && fechas.includes(a.fecha)));
          (p.asignaciones || []).filter(a => fechas.includes(a.fecha)).forEach(a => { st.asignaciones.push({ id: uid(), ...a, seccion: 'entresemana', creado: ahora, origen: 'programa' }); n++; });
        }
        guardar(); return { semanas: fechas.length, asignaciones: n };
      }
      case 'borrarPrograma': {
        const x = (st.programas || []).find(q => q.id === p.id);
        if (x) { st.programas = st.programas.filter(q => q.id !== p.id); st.asignaciones = st.asignaciones.filter(a => !(a.origen === 'programa' && a.fecha === x.fecha)); guardar(); }
        return true;
      }
      case 'guardarZoom': {
        if (p.borrar) { st.zoom = null; guardar(); return null; }
        if (p.enlace && !/^https:\/\/([\w-]+\.)*zoom\.us\//i.test(p.enlace)) throw new Error('El enlace debe ser de zoom.us');
        st.zoom = { tema: p.tema || '', enlace: p.enlace || '', id: p.id || '', codigo: p.acceso || '', horarios: p.horarios || [], nota: p.nota || '', actualizado: new Date().toISOString() };
        guardar(); return st.zoom;
      }
      case 'guardarCodigo': st.codigo = String(p.codigo || '').trim(); guardar(); return { codigo: st.codigo };
      case 'borrarPunto': st.puntos = (st.puntos || []).filter(q => q.id !== p.id); guardar(); return true;
      case 'borrarSalida': st.salidas = (st.salidas || []).filter(x => x.id !== p.id); guardar(); return true;
      case 'borrarAnuncio': st.anuncios = st.anuncios.filter(x => x.id !== p.id); guardar(); return true;
      case 'listarAsignaciones': return st.asignaciones.filter(a => a.fecha >= addDias(h, -30)).sort((a, b) => a.fecha.localeCompare(b.fecha));
      case 'agregarAsignaciones': {
        const out = [];
        (p.items || []).forEach(it => String(it.hermano).split('/').map(s => s.trim()).filter(Boolean).forEach(n => {
          const o = { id: uid(), fecha: it.fecha, seccion: it.seccion, asignacion: it.asignacion, hermano: n, creado: new Date().toISOString() };
          st.asignaciones.push(o); out.push(o);
        }));
        guardar(); return out;
      }
      case 'borrarAsignacion': st.asignaciones = st.asignaciones.filter(x => x.id !== p.id); guardar(); return true;
      case 'listarHermanos': return [...st.hermanos].sort((a, b) => a.nombre.localeCompare(b.nombre));
      case 'guardarHermano': {
        const i = st.hermanos.findIndex(x => norm(x.nombre) === norm(p.nombre));
        const o = { nombre: p.nombre.trim(), telefono: p.telefono || '', email: p.email || '' };
        if (i >= 0) st.hermanos[i] = o; else st.hermanos.push(o);
        guardar(); return o;
      }
      case 'borrarHermano': st.hermanos = st.hermanos.filter(x => norm(x.nombre) !== norm(p.nombre)); guardar(); return true;
      case 'listarPreguntas': return [...st.preguntas].sort((a, b) => (a.estado === 'pendiente' ? 0 : 1) - (b.estado === 'pendiente' ? 0 : 1) || b.fecha.localeCompare(a.fecha));
      case 'responderPregunta': { const q = st.preguntas.find(x => x.id === p.id); if (q) { q.respuesta = p.respuesta; q.estado = 'respondida'; } guardar(); return true; }
      case 'borrarPregunta': st.preguntas = st.preguntas.filter(x => x.id !== p.id); guardar(); return true;
      case 'recordatorios': {
        const s = semanaDe(Number(p.semana) || 0);
        const mapa = {};
        st.asignaciones.filter(a => a.fecha >= s.inicio && a.fecha <= s.fin).forEach(a => {
          const k = norm(a.hermano);
          const her = st.hermanos.find(x => norm(x.nombre) === k) || {};
          (mapa[k] ||= { hermano: a.hermano, telefono: her.telefono || '', email: her.email || '', items: [] }).items.push(a);
        });
        (st.salidas || []).filter(x => x.conductor && x.fecha >= s.inicio && x.fecha <= s.fin).forEach(x => {
          const k = norm(x.conductor);
          const her = st.hermanos.find(y => norm(y.nombre) === k) || {};
          (mapa[k] ||= { hermano: x.conductor, telefono: her.telefono || '', email: her.email || '', items: [] }).items.push({ fecha: x.fecha, asignacion: `Conductor de la salida · Territorio ${x.territorio}${x.hora ? ' · ' + x.hora : ''}`, seccion: 'predicacion' });
        });
        const lista = Object.values(mapa).sort((a, b) => a.hermano.localeCompare(b.hermano));
        lista.forEach(g => g.items.sort((a, b) => a.fecha.localeCompare(b.fecha)));
        return { inicio: s.inicio, fin: s.fin, lista };
      }
      case 'enviarCorreos': return { enviados: 0, sinCorreo: [], total: 0, demo: true };
    }
    throw new Error('Acción desconocida');
  }
  return { handle, reiniciar() { st = semilla(); guardar(); } };
})();

/* ---------- Interfaz común ---------- */
let toastTimer;
function toast(msg, tipo = '') {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast ' + tipo; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

function chipSeccion(sec) {
  const s = SECCIONES[sec]; if (!s) return '';
  return `<span class="chip" style="--c:${s.color}">${esc(s.corto)}</span>`;
}

/* Visor de imágenes / PDF a pantalla completa */
function abrirVisor(item) {
  const v = $('#viewer');
  const pdf = esPdf(item);
  $('#viewerTitle').textContent = item.titulo || '';
  const cuerpo = $('#viewerBody');
  if (pdf && item.url && item.url.startsWith('data:')) {
    cuerpo.innerHTML = `<iframe class="viewer-pdf" src="${esc(item.url)}" title="PDF"></iframe>`;
  } else if (pdf && item.archivoId) {
    cuerpo.innerHTML = `<iframe class="viewer-pdf" src="https://drive.google.com/file/d/${encodeURIComponent(item.archivoId)}/preview" title="PDF" allow="autoplay"></iframe>`;
  } else {
    cuerpo.innerHTML = `<img class="viewer-img" src="${esc(srcImagen(item))}" alt="${esc(item.titulo || '')}">`;
    const img = $('.viewer-img', cuerpo);
    img.addEventListener('click', () => img.classList.toggle('zoom'));
  }
  const orig = $('#viewerOpen');
  orig.href = urlOriginal(item);
  orig.hidden = !orig.href || orig.href.startsWith('data:') && !pdf;
  v.hidden = false;
  document.body.classList.add('no-scroll');
  try { history.pushState({ visor: 1 }, ''); } catch (e) {}
}
function cerrarVisor(desdeHistorial) {
  const v = $('#viewer'); if (!v || v.hidden) return;
  v.hidden = true; $('#viewerBody').innerHTML = '';
  document.body.classList.remove('no-scroll');
  if (!desdeHistorial) { try { history.back(); } catch (e) {} }
}
window.addEventListener('popstate', () => cerrarVisor(true));
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarVisor(); });

/* Instalación como app */
let promptInstalar = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); promptInstalar = e;
  const b = $('#btnInstalar'); if (b) b.hidden = false;
});
async function instalarApp() {
  if (promptInstalar) { promptInstalar.prompt(); await promptInstalar.userChoice; promptInstalar = null; $('#btnInstalar').hidden = true; }
}
const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const esInstalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register(new URL('../sw.js', location.href).href, { scope: new URL('../', location.href).href }).catch(() => {}));
}

/* Leer archivo, reducir imágenes grandes y devolver base64 */
async function prepararArchivo(file) {
  if (!file) return null;
  if (file.size > 20 * 1024 * 1024) throw new Error('El archivo pesa más de 20 MB');
  let blob = file, mime = file.type || 'application/octet-stream', nombre = file.name;
  if (/^image\/(png|jpe?g|webp)$/i.test(mime)) {
    try {
      const bmp = await createImageBitmap(file);
      const max = 2200, escala = Math.min(1, max / Math.max(bmp.width, bmp.height));
      if (escala < 1 || file.size > 1.5 * 1024 * 1024) {
        const c = document.createElement('canvas');
        c.width = Math.round(bmp.width * escala); c.height = Math.round(bmp.height * escala);
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(bmp, 0, 0, c.width, c.height);
        blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.88));
        mime = 'image/jpeg'; nombre = nombre.replace(/\.\w+$/, '') + '.jpg';
      }
    } catch (e) { /* si falla, se sube el original */ }
  } else if (!/^image\/|^application\/pdf$/.test(mime)) {
    throw new Error('Solo se permiten imágenes o PDF');
  }
  const base64 = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1]);
    fr.onerror = () => rej(new Error('No se pudo leer el archivo'));
    fr.readAsDataURL(blob);
  });
  return { base64, mimeType: mime, nombreArchivo: nombre };
}

const ICON = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v17H5.5A1.5 1.5 0 0 1 4 18.5zM13 3h5.5A1.5 1.5 0 0 1 20 4.5v14a1.5 1.5 0 0 1-1.5 1.5H13z"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5zM9 4v13.5M15 6.5V20"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  ruta: '<svg viewBox="0 0 24 24"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/></svg>',
  gps: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7.5"/></svg>',
  wa: '<svg viewBox="0 0 24 24"><path d="M20 11.6a8.1 8.1 0 0 1-12 7.1L4 20l1.3-3.9A8.1 8.1 0 1 1 20 11.6z"/><path d="M9 8.5c.2 2.6 2.6 5.3 5.6 5.9l1-1.2-1.6-.9-.8.8c-1-.4-2.1-1.4-2.6-2.5l.8-.8-.8-1.6z"/></svg>'
};

/* Cuadro de confirmación propio (en vez de confirm() del navegador) */
function confirmar(msg, ok = 'Sí, continuar') {
  return new Promise(res => {
    const d = document.createElement('div');
    d.className = 'modal';
    d.innerHTML = `<div class="modal-box" role="alertdialog" aria-modal="true"><p>${esc(msg)}</p>
      <div class="row" style="justify-content:flex-end"><button class="btn" data-r="0">Cancelar</button>
      <button class="btn btn-primary" data-r="1">${esc(ok)}</button></div></div>`;
    d.addEventListener('click', e => {
      const b = e.target.closest('[data-r]');
      if (b || e.target === d) { d.remove(); res(b ? b.dataset.r === '1' : false); }
    });
    document.body.appendChild(d);
    $('[data-r="1"]', d).focus();
  });
}

/* ---------- Arreglos para la predicación ---------- */
const TIPOS_SALIDA = {
  casa: { nombre: 'Casa en casa', actividad: 'nuestra salida a la predicación de casa en casa' },
  cartas: { nombre: 'Cartas', actividad: 'nuestro arreglo para la predicación por cartas' },
  publica: { nombre: 'Predicación pública', actividad: 'nuestro arreglo para la predicación pública' },
  telefono: { nombre: 'Teléfono', actividad: 'nuestro arreglo para la predicación por teléfono' },
  revisitas: { nombre: 'Revisitas y estudios', actividad: 'nuestro arreglo para hacer revisitas y estudios' },
  varias: { nombre: 'Varias facetas', actividad: 'nuestros arreglos para la predicación' }
};
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const tipoSalida = x => TIPOS_SALIDA[x.tipo] || TIPOS_SALIDA.casa;
const tituloSalida = x => x.territorio ? `${tipoSalida(x).nombre} · Territorio ${x.territorio}` : tipoSalida(x).nombre;

/* Próxima fecha de una salida (si se repite cada semana, la siguiente desde hoy) */
const diasDe = x => x.dias ? String(x.dias).split(',').filter(Boolean).map(Number) : [parseYmd(x.fecha).getDay()];
function fechaProxima(x, desde = hoy()) {
  if (x.repetir !== 'semanal') return x.fecha;
  const dias = diasDe(x);
  const d = parseYmd(x.fecha > desde ? x.fecha : desde);
  for (let i = 0; i < 7; i++) { if (dias.includes(d.getDay())) return ymd(d); d.setDate(d.getDate() + 1); }
  return x.fecha;
}
const unirY = l => l.length <= 1 ? (l[0] || '') : l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1];
/* Lista de salidas próximas con su fecha real, ordenadas */
function salidasProximas(lista) {
  return (lista || []).map(x => ({ ...x, fechaOriginal: x.fecha, fecha: fechaProxima(x) }))
    .filter(x => x.fecha >= hoy())
    .sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
}
const textoRepetir = x => {
  if (x.repetir !== 'semanal') return '';
  const dias = x.dias ? diasDe(x) : [parseYmd(x.fechaOriginal || x.fecha).getDay()];
  return 'cada ' + unirY([...dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => DIAS[d]));
};

/* ----- Mensaje cálido automático ----- */
function momentoDelDia(hora) {
  const t = String(hora || '').toLowerCase();
  const m = t.match(/(\d{1,2})(?::\d{2})?/);
  if (!m) return '';
  const h = Number(m[1]);
  const marcas = t.match(/[ap]\.?\s*m\.?/g);
  const pm = marcas ? /p/.test(marcas[marcas.length - 1]) : (h >= 1 && h <= 6);
  if (!marcas && h >= 13) return h >= 18 ? 'noche' : 'tarde';
  if (pm) return (h >= 6 && h < 12) ? 'noche' : 'tarde';
  return 'mañana';
}
function partesMensaje(x, enlaces = true) {
  const ahora = new Date();
  const hh = ahora.getHours();
  const saludo = hh < 12 ? '¡Muy buenos días' : hh < 19 ? '¡Muy buenas tardes' : '¡Muy buenas noches';
  const mom = momentoDelDia(x.hora);
  const f = x.fecha, h = hoy(), man = addDias(h, 1);
  const porLa = mom ? ` por la ${mom}` : '';
  const fd = parseYmd(f);
  const cuando = f === h ? `hoy${porLa}` : f === man ? `mañana${porLa}` : `el ${DIAS[fd.getDay()]} ${fd.getDate()} de ${fd.toLocaleDateString('es-GT', { month: 'long' })}${porLa}`;
  const momento = f === h ? (mom ? `esta ${mom}` : 'hoy') : f === man ? 'mañana' : 'ese día';
  const hora = x.hora ? (/\d\s*(a|–|-)\s*\d/.test(x.hora) ? `, de ${x.hora}` : `, a las ${x.hora}`) : '';
  let lugar = '';
  if (x.punto) {
    const p = x.punto.trim();
    lugar = /^(el|la|los|las|en)\b/i.test(p) ? `, ${/^en\b/i.test(p) ? '' : 'en '}${p}` : /^sal[oó]n/i.test(p) ? `, en el ${p}` : `, en ${p}`;
  }
  const actividad = tipoSalida(x).actividad + (x.territorio ? ` en el territorio ${x.territorio}` : '');
  const c = x.lat && x.lng ? { lat: x.lat, lng: x.lng } : (x.territorio && typeof Mapa !== 'undefined' ? Mapa.centro(x.territorio) : null);
  let extra = '';
  if (enlaces && c) extra += `\n📍 Cómo llegar: ${Mapa.enlaceMapa(c.lat, c.lng)}`;
  if (enlaces && x.territorio && typeof Mapa !== 'undefined') extra += `\n🗺️ Ver el territorio: ${Mapa.enlaceApp(x.territorio)}`;
  return { saludo, cuando, momento, hora, lugar, actividad, conductor: x.conductor || '', nota: x.nota || '', extra };
}
const PLANTILLA_BASE = `{saludo}, queridos hermanos!

Esperamos que se encuentren muy bien y estén disfrutando de este hermoso día.

Les recordamos que {cuando} tendremos {actividad}{hora}{lugar}.

Aprovechemos esta oportunidad para seguir dando un «testimonio completo», participando con entusiasmo en las diferentes facetas de nuestro ministerio.

¡Será un gusto compartir {momento} con ustedes!`;
const plantillaDe = tipo => (store.get('plantillas', {})[tipo]) || PLANTILLA_BASE;
function mensajeSalida(x, plantilla) {
  const p = partesMensaje(x);
  let t = (plantilla || plantillaDe(x.tipo || 'casa')).replace(/\{(\w+)\}/g, (m, k) => k in p ? p[k] : m);
  if (x.conductor && !/\{conductor\}/.test(plantilla || plantillaDe(x.tipo || 'casa'))) t += `\nConductor: ${x.conductor}`;
  if (x.nota && !/\{nota\}/.test(plantilla || plantillaDe(x.tipo || 'casa'))) t += `\n${x.nota}`;
  return t + p.extra;
}
/* Convierte un mensaje ya escrito en plantilla (cambia los datos por {marcadores}) */
function aPlantilla(x, texto) {
  const p = partesMensaje(x);
  let t = texto;
  if (p.extra) t = t.replace(p.extra, '');
  if (x.conductor) t = t.replace(`\nConductor: ${x.conductor}`, '');
  if (x.nota) t = t.replace(`\n${x.nota}`, '');
  ['actividad', 'cuando', 'momento', 'lugar', 'hora', 'saludo'].sort((a, b) => p[b].length - p[a].length)
    .forEach(k => { if (p[k]) t = t.split(p[k]).join(`{${k}}`); });
  return t.trim();
}


/* ---------- Zoom ---------- */
function fmtHora(h) {
  const [H, M] = String(h || '').split(':').map(Number);
  if (isNaN(H)) return h || '';
  const pm = H >= 12, h12 = ((H + 11) % 12) + 1;
  return `${h12}:${String(M || 0).padStart(2, '0')} ${pm ? 'p. m.' : 'a. m.'}`;
}
/* "del 16 al 22 de noviembre" para la semana actual (lunes a domingo) */
function textoSemana(off = 0) {
  const s = semana(off), a = parseYmd(s.inicio), b = parseYmd(s.fin);
  const mes = d => d.toLocaleDateString('es-GT', { month: 'long' });
  return a.getMonth() === b.getMonth() ? `del ${a.getDate()} al ${b.getDate()} de ${mes(b)}` : `del ${a.getDate()} de ${mes(a)} al ${b.getDate()} de ${mes(b)}`;
}
const TEMA_ZOOM = 'Reunión {semana}: Vida y Ministerio y Estudio de La Atalaya';
const temaZoom = z => String((z && z.tema) || TEMA_ZOOM).replace(/\{semana\}/g, textoSemana());
const horariosOrdenados = z => [...((z && z.horarios) || [])].sort((a, b) => ((a.dia + 6) % 7) - ((b.dia + 6) % 7) || a.hora.localeCompare(b.hora));
const textoHorario = h => `${DIAS[h.dia]} ${fmtHora(h.hora)}${h.nombre ? ' (' + h.nombre + ')' : ''}`;
function mensajeZoom(z) {
  const hs = horariosOrdenados(z).map(textoHorario);
  return `Congregación ${CFG.CONGREGACION || 'el Río Panajachel'} le está invitando a una reunión de Zoom\n\n` +
    `Tema: ${temaZoom(z)}\n\n` +
    (hs.length ? `Hora: ${hs[0]}${hs.slice(1).map(h => '\n         ' + h).join('')}\n\n` : '') +
    (z.id ? `ID de reunión: ${z.id}\n` : '') + (z.codigo ? `Código de acceso: ${z.codigo}\n` : '') +
    (z.enlace ? `\nÚnase a la reunión de Zoom\n${z.enlace}` : '') + (z.nota ? `\n\n${z.nota}` : '');
}
/* Reunión de hoy por Zoom: {h, minutos para empezar} o null */
function reunionHoy(z) {
  if (!z || !z.horarios) return null;
  const ahora = new Date(), dia = ahora.getDay(), min = ahora.getHours() * 60 + ahora.getMinutes();
  const hoyH = horariosOrdenados(z).filter(h => h.dia === dia);
  for (const h of hoyH) {
    const [H, M] = h.hora.split(':').map(Number), ini = H * 60 + M;
    if (min <= ini + 120) return { h, faltan: ini - min };   // se muestra hasta 2 horas después de empezar
  }
  return null;
}
/* Lee una invitación de Zoom pegada (ID, código y enlace) */
function leerInvitacionZoom(t) {
  const r = {};
  const id = t.match(/ID de (?:la )?reuni[oó]n:?\s*([\d ]{9,})/i) || t.match(/Meeting ID:?\s*([\d ]{9,})/i);
  if (id) r.id = id[1].trim();
  const c = t.match(/(?:C[oó]digo de acceso|Contrase[nñ]a|Passcode):?\s*(\S+)/i);
  if (c) r.codigo = c[1].trim();
  const e = t.match(/https:\/\/[\w.-]*zoom\.us\/[^\s<>"]+/i);
  if (e) r.enlace = e[0];
  const tema = t.match(/Tema:?\s*(.+)/i);
  if (tema) r.temaTexto = tema[1].trim();
  const hs = [];
  const re = /(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)\s*(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m/gi;
  let m;
  while ((m = re.exec(t))) {
    const nombre = norm(m[1]).replace('miercoles', 'miércoles').replace('sabado', 'sábado');
    let H = Number(m[2]) % 12; if (/p/i.test(m[4])) H += 12;
    hs.push({ dia: DIAS.indexOf(nombre), hora: `${String(H).padStart(2, '0')}:${m[3] || '00'}` });
  }
  if (hs.length) r.horarios = hs;
  return r;
}


/* ---------- Fechas de eventos, como en el calendario de la congregación ---------- */
const DIAS_C = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaEvento(a) {
  if (!a.fecha) return '';
  const d = parseYmd(a.fecha);
  const uno = (x, conAnio) => `${DIAS_C[x.getDay()]}, ${x.getDate()} de ${MESES_C[x.getMonth()]}${conAnio ? ' de ' + x.getFullYear() : ''}`;
  if (!a.fechaFin || a.fechaFin === a.fecha) return uno(d, true);
  const f = parseYmd(a.fechaFin);
  return `${uno(d, d.getFullYear() !== f.getFullYear())} – ${uno(f, true)}`;
}
const horarioEvento = a => a.todoDia ? 'Todo el día' : (a.hora || '');
const mesEvento = a => { const d = parseYmd(a.fecha); return `${d.toLocaleDateString('es-GT', { month: 'long' })} de ${d.getFullYear()}`; };
