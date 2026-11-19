/* App de publicadores */
let DATA = null;
const VISTAS = [
  ['inicio', 'Inicio', ICON.home],
  ['reuniones', 'Reuniones', ICON.book],
  ['asignaciones', 'Asignaciones', ICON.list],
  ['territorios', 'Territorios', ICON.map],
  ['anuncios', 'Anuncios', ICON.bell],
  ['preguntas', 'Preguntas', ICON.chat]
];
let vista = store.get('vista', 'inicio');
const sub = { reuniones: store.get('sub_reuniones', 'entresemana'), asignaciones: store.get('sub_asignaciones', 'limpieza') };

$('#tabs').innerHTML = VISTAS.map(([k, t, i]) => `<button data-v="${k}">${i}<span>${t}</span></button>`).join('');
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) irA(b.dataset.v); });
if (DEMO) $('#demoBanner').hidden = false;
if (CFG.CONGREGACION) $('#brand').textContent = CFG.CONGREGACION;

function irA(v) {
  if (location.hash) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
  vista = v; store.set('vista', v); render(); window.scrollTo(0, 0);
}
let terrSel = null;
function leerHash() {
  const m = location.hash.match(/^#territorio-(\w+)$/);
  if (m) { vista = 'territorios'; terrSel = m[1]; }
}
leerHash();
window.addEventListener('hashchange', () => { leerHash(); render(); });

/* ---------- Código de la congregación ---------- */
function pantallaCodigo(error = '') {
  $('#tabs').hidden = true;
  $('#app').innerHTML = `<div class="codigo-pant card">
    <h1 style="font-size:1.2rem">Bienvenido</h1>
    <p class="small muted">Escriba el código de la congregación. Lo pide una sola vez en este teléfono. Si no lo tiene, pídaselo a un anciano.</p>
    <form onsubmit="event.preventDefault();store.set('codigo',this.c.value.trim());$('#tabs').hidden=false;cargar()">
      <input type="text" name="c" required autocomplete="off" autocapitalize="characters" placeholder="Código" aria-label="Código de la congregación">
      ${error ? `<p class="small" style="color:var(--danger);margin:8px 0 0">${esc(error)}</p>` : ''}
      <button class="btn btn-primary btn-block" style="margin-top:12px">Entrar</button>
    </form></div>`;
}

async function cargar() {
  const cache = DEMO ? null : store.get('cache_data', null);
  if (cache) { DATA = cache; render(); }
  else $('#app').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  try {
    DATA = await API.get();
    if (!DEMO) store.set('cache_data', DATA);
    $('#tabs').hidden = false;
    render();
    revisarRespuestas();
  } catch (e) {
    if (e.codigo) {
      const habia = store.get('codigo', '');
      DATA = null; store.del('cache_data'); store.del('cache_puntos');
      return pantallaCodigo(habia ? 'El código no es correcto o fue cambiado.' : '');
    }
    if (DATA) toast('Sin conexión: se muestra la última información guardada');
    else $('#app').innerHTML = `<div class="empty">No se pudo cargar la información.<br><span class="small">${esc(e.message)}</span><br><br><button class="btn btn-primary" onclick="cargar()">Reintentar</button></div>`;
  }
}

/* ---------- Avisos de "nuevo" ---------- */
const SEC_TAB = { reuniones: ['entresemana', 'discursos'], asignaciones: ['limpieza', 'audio_video', 'acomodadores', 'predicacion'], anuncios: ['anuncios'], territorios: ['salidas'] };
let VISTO = store.get('visto', null);
if (!VISTO) {
  const base = new Date(Date.now() - 3 * 864e5).toISOString();
  VISTO = {}; Object.values(SEC_TAB).flat().forEach(k => { VISTO[k] = base; });
  store.set('visto', VISTO);
}
const PREV = {};
let RESP_NUEVAS = 0;
function itemsDe(k) {
  if (!DATA) return [];
  if (k === 'anuncios') return DATA.anuncios;
  if (k === 'salidas') return DATA.salidas || [];
  return [...DATA.publicaciones.filter(p => p.seccion === k), ...DATA.asignaciones.filter(a => a.seccion === k),
    ...(k === 'entresemana' ? (DATA.programas || []) : []), ...(DATA.tablas || []).filter(t => t.seccion === k)];
}
const hayNuevo = k => itemsDe(k).some(x => (x.creado || '') > (VISTO[k] || ''));
const esNuevo = (k, x) => (x.creado || '') > (k in PREV ? PREV[k] : (VISTO[k] || ''));
const chipNuevo = (k, x) => esNuevo(k, x) ? '<span class="chip nuevo">Nuevo</span>' : '';
function marcarVisto(k) {
  if (!(k in PREV)) PREV[k] = VISTO[k] || '';
  VISTO[k] = new Date().toISOString(); store.set('visto', VISTO);
}
function pintarAvisos() {
  $$('#tabs button').forEach(b => {
    const v = b.dataset.v;
    const nuevo = v === 'preguntas' ? RESP_NUEVAS > 0 : (SEC_TAB[v] || []).some(hayNuevo);
    let d = $('.dot-nuevo', b);
    if (nuevo && !d) { d = document.createElement('i'); d.className = 'dot-nuevo'; b.appendChild(d); }
    if (!nuevo && d) d.remove();
  });
}
async function revisarRespuestas() {
  const ids = store.get('mis_preguntas', []);
  if (!ids.length) return;
  try {
    const lista = await API.post('misPreguntas', { ids });
    const vistas = store.get('resp_vistas', []);
    RESP_NUEVAS = lista.filter(q => q.estado === 'respondida' && !vistas.includes(q.id)).length;
    pintarAvisos();
  } catch (e) {}
}

function render() {
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === vista));
  if (!DATA) return;
  const actual = { reuniones: sub.reuniones, asignaciones: sub.asignaciones, anuncios: 'anuncios', territorios: 'salidas' }[vista];
  if (actual) marcarVisto(actual);
  pintarAvisos();
  if (vista !== 'territorios' && T.mapa) { T.mapa.destruir(); T.mapa = null; }
  if (vista === 'territorios') return renderTerritorios();
  const f = { inicio: vInicio, reuniones: vReuniones, asignaciones: vAsignaciones, anuncios: vAnuncios, preguntas: vPreguntas }[vista] || vInicio;
  $('#app').innerHTML = f();
  if (vista === 'preguntas') cargarMisPreguntas();
}

/* ---------- Componentes ---------- */
function tarjetaPub(p, mini = false) {
  const pdf = esPdf(p);
  const thumb = pdf && !p.archivoId ? `<div class="pub-pdf">PDF</div>` : `<img class="pub-img" loading="lazy" src="${esc(srcImagen(p))}" alt="">`;
  const badge = vigente(p) ? '<span class="chip ok">Vigente</span>' : '';
  if (mini) return `<button class="pub pub-mini" onclick="verPub('${esc(p.id)}')">${thumb}
      <div class="grow"><div class="row">${chipSeccion(p.seccion)} ${badge} ${chipNuevo(p.seccion, p)}</div>
      <div class="pub-t">${esc(p.titulo)}</div><div class="small muted">${esc(fmtRango(p.fechaInicio, p.fechaFin))}</div></div></button>`;
  return `<button class="pub" onclick="verPub('${esc(p.id)}')">${thumb}
    <div class="pub-body"><div class="row">${chipSeccion(p.seccion)} ${badge} ${chipNuevo(p.seccion, p)} ${pdf ? '<span class="chip warn">PDF</span>' : ''}</div>
    <div class="pub-t">${esc(p.titulo)}</div>
    <div class="small muted">${esc(fmtRango(p.fechaInicio, p.fechaFin))}</div>
    ${p.nota ? `<div class="small pre" style="margin-top:6px">${esc(p.nota)}</div>` : ''}</div></button>`;
}
function verPub(id) {
  const p = [...DATA.publicaciones, ...DATA.anuncios].find(x => x.id === id);
  if (p) abrirVisor(p);
}

function fechaBox(s) {
  const d = parseYmd(s);
  return `<div class="fecha-box"><div class="d">${d.getDate()}</div><div class="m">${d.toLocaleDateString('es-GT', { month: 'short' }).replace('.', '')}</div></div>`;
}

function listaAsignaciones(items, resaltar = '') {
  if (!items.length) return '';
  const porDia = {};
  items.forEach(a => (porDia[a.fecha] ||= []).push(a));
  const n = norm(resaltar);
  return Object.keys(porDia).sort().map(f => `<div class="dia"><div class="dia-h">${esc(fmtLarga(f))}</div><div class="lista">
    ${porDia[f].map(a => `<div class="item ${n && norm(a.hermano).includes(n) ? 'yo' : ''}">
      <div class="grow"><div class="t">${esc(a.asignacion)}</div><div class="small muted">${esc(a.hermano)}</div></div></div>`).join('')}
    </div></div>`).join('');
}

/* ---------- Vistas ---------- */
function vInicio() {
  const s = semana(), h = hoy();
  const nombre = store.get('mi_nombre', '');
  const nombres = [...new Set([...(DATA.hermanos || []), ...DATA.asignaciones.map(a => a.hermano)])].sort();
  const mias = nombre ? DATA.asignaciones.filter(a => a.fecha >= h && norm(a.hermano).includes(norm(nombre))) : [];
  const eventos = DATA.anuncios.filter(a => a.fecha && (a.fechaFin || a.fecha) >= h).slice(0, 3);
  const recientes = DATA.publicaciones.slice(0, 4);
  const estaSemana = DATA.asignaciones.filter(a => a.fecha >= s.inicio && a.fecha <= s.fin).length;

  let mis = '';
  if (nombre) {
    mis = mias.length
      ? `<div class="lista" style="margin-top:12px">${mias.map(a => `<div class="item">${fechaBox(a.fecha)}<div class="grow">
          <div class="t">${esc(a.asignacion)}</div><div class="small muted cap">${esc(fmtLarga(a.fecha))}</div>
          <div style="margin-top:4px">${chipSeccion(a.seccion)}</div></div></div>`).join('')}</div>`
      : `<p class="small muted" style="margin:10px 2px 0">No hay asignaciones próximas registradas para <b>${esc(nombre)}</b>.</p>`;
  }

  return `
  ${avisoReunionHoy()}
  ${tarjetasHoy()}
  ${(() => { const pg = programaDeEstaSemana(); const dpg = pg ? parseYmd(pg.fecha) : null;
    return `<div class="hero" ${pg ? `role="button" tabindex="0" style="cursor:pointer" onclick="sub.reuniones='entresemana';semIdx=null;irA('reuniones')"` : ''}><div class="k">Esta semana</div><div class="v">${esc(fmtRango(s.inicio, s.fin))}</div>
    <div class="small" style="color:#d6deea;margin-top:4px">${pg ? `Reunión del ${DIAS[dpg.getDay()]} ${dpg.getDate()}: ${esc(pg.lectura)}${pg.presidente ? ' · Presidente ' + esc(pg.presidente) : ''} · <u>ver programa</u>`
      : estaSemana ? `${estaSemana} asignaciones registradas` : 'Consulte los programas en Reuniones y Asignaciones'}</div>
    ${(() => { const dc = discursoDeEstaSemana(); if (!dc) return ''; const dd = parseYmd(dc.fecha);
      return `<div class="small" style="color:#d6deea;margin-top:4px;cursor:pointer" onclick="event.stopPropagation();sub.reuniones='discursos';irA('reuniones')">Discurso del ${DIAS[dd.getDay()]} ${dd.getDate()}: ${esc(dc.tema || 'ver programa')}${dc.orador ? ' · ' + esc(dc.orador) : ''} · <u>ver</u></div>`; })()}</div>`; })()}

  ${esIOS && !esInstalada && !store.get('ios_ok') ? `<div class="card flat small">Para instalar en iPhone: toque <b>Compartir</b> y luego <b>Agregar a pantalla de inicio</b>. <button class="btn btn-sm" style="margin-left:6px" onclick="store.set('ios_ok',1);render()">Entendido</button></div>` : ''}

  ${(DATA.puntos || []).length ? `<div class="h-sec">Predicando ahora <button onclick="irA('territorios')">Ver mapa</button></div>
    <div class="lista">${DATA.puntos.slice(0, 3).map(pt => `<div class="item"><span class="ico" style="color:#1f8f4e">${ICON.pin}</span><div class="grow"><div class="t">${esc(pt.nombre)}</div>
    <div class="small muted">${pt.territorio ? 'Territorio ' + esc(pt.territorio) + ' · ' : ''}${esc(haceCuanto(pt.actualizado))}</div></div>
    <button class="btn btn-sm btn-primary" onclick="navegarPunto('${esc(pt.id)}')">Ir</button></div>`).join('')}</div>` : ''}

  ${(() => { const sig = proxSalidas().filter(x => x.fecha > hoy()); return sig.length ? `<div class="h-sec">Próximo arreglo para la predicación <button onclick="irA('territorios')">Ver todos</button></div>${tarjetaSalida(sig[0])}` : ''; })()}

  ${eventos.length ? `<div class="h-sec">Próximos eventos <button onclick="irA('anuncios')">Ver todos</button></div>
    ${eventos.map(tarjetaEvento).join('')}` : ''}

  <div class="h-sec">Publicado recientemente</div>
  ${recientes.length ? recientes.map(p => tarjetaPub(p, true)).join('') : '<div class="empty">Aún no hay programas publicados.</div>'}`;
}

function vistaSeccion(seccion) {
  const pubs = DATA.publicaciones.filter(p => p.seccion === seccion);
  pubs.sort((a, b) => (vigente(b) - vigente(a)) || (b.fechaInicio || '').localeCompare(a.fechaInicio || ''));
  const tablas = (DATA.tablas || []).filter(t => t.seccion === seccion && t.filas.some(f => f.fecha >= semana().inicio));
  const conPrograma = (seccion === 'entresemana' && (DATA.programas || []).length) || tablas.length;
  const asig = conPrograma ? [] : DATA.asignaciones.filter(a => a.seccion === seccion && a.fecha >= hoy());
  return `
    ${seccion === 'entresemana' && (DATA.programas || []).length ? bloquePrograma() : ''}
    ${tablas.map(t => seccion === 'discursos' ? Tablas.tarjetas(t, store.get('mi_nombre', ''), !!VER_PASADAS[t.id]) : Tablas.html(t, store.get('mi_nombre', ''), !!VER_PASADAS[t.id])).join('')}
    ${pubs.length ? (conPrograma ? `<details class="archivos"><summary>Ver ${pubs.length === 1 ? 'el archivo original' : `los ${pubs.length} archivos originales`} (imagen o PDF)</summary>${pubs.map(p => tarjetaPub(p)).join('')}</details>` : pubs.map(p => tarjetaPub(p)).join(''))
      : conPrograma ? '' : `<div class="empty">Todavía no hay programa publicado de ${esc(SECCIONES[seccion].nombre.toLowerCase())}.</div>`}
    ${asig.length ? `<div class="h-sec">Próximas asignaciones</div>${listaAsignaciones(asig, store.get('mi_nombre', ''))}` : ''}`;
}

/* Semanas que ya pasaron: ocultas, con botón para verlas */
const VER_PASADAS = {};
function verSemanasPasadas(id) { VER_PASADAS[id] = !VER_PASADAS[id]; render(); }
/* Discurso público de esta semana (para la tarjeta de Inicio) */
function discursoDeEstaSemana() {
  const s = semana();
  for (const t of (DATA.tablas || []).filter(t => t.seccion === 'discursos')) {
    const f = t.filas.find(f => f.fecha >= s.inicio && f.fecha <= s.fin);
    if (f) { const v = c => { const i = t.columnas.findIndex(x => norm(x) === c); return i >= 0 ? f.valores[i] : ''; }; return { fecha: f.fecha, tema: v('discurso'), orador: v('orador') }; }
  }
  return null;
}

/* Programa de entre semana separado por semana (se abre en la semana actual) */
let semIdx = null;
function programaActualIdx() {
  const ps = DATA.programas || [], h = hoy();
  let i = ps.findIndex(p => p.inicio <= h && p.fin >= h);
  if (i < 0) i = ps.findIndex(p => p.fin >= h);
  return i < 0 ? ps.length - 1 : i;
}
function programaDeEstaSemana() { const ps = DATA.programas || [], h = hoy(); return ps.find(p => p.inicio <= h && p.fin >= h) || null; }
function bloquePrograma() {
  const ps = DATA.programas || [];
  if (semIdx == null || semIdx >= ps.length) semIdx = programaActualIdx();
  const p = ps[semIdx];
  const actual = p.inicio <= hoy() && p.fin >= hoy();
  return `<div class="pg-nav">
      <button class="btn btn-sm" ${semIdx <= 0 ? 'disabled' : ''} onclick="semIdx--;render()" aria-label="Semana anterior">‹ Anterior</button>
      <div class="pg-nav-c"><b>${esc(fmtRango(p.inicio, p.fin))}</b>${actual ? '<span class="chip ok">Esta semana</span>' : p.fin < hoy() ? '<span class="chip">Pasada</span>' : ''}${chipNuevo('entresemana', p)}</div>
      <button class="btn btn-sm" ${semIdx >= ps.length - 1 ? 'disabled' : ''} onclick="semIdx++;render()" aria-label="Semana siguiente">Siguiente ›</button>
    </div>
    ${Programa.html(p, store.get('mi_nombre', ''))}
`;
}

function segmentos(grupo, claves) {
  return `<div class="seg" role="tablist">${claves.map(k => `<button role="tab" class="${sub[grupo] === k ? 'on' : ''}"
    onclick="sub['${grupo}']='${k}';store.set('sub_${grupo}','${k}');render()">${esc(SECCIONES[k].corto)}${sub[grupo] !== k && hayNuevo(k) ? '<i class="dot-nuevo"></i>' : ''}</button>`).join('')}</div>`;
}

function vReuniones() {
  return `<h1 class="titulo-vista">Reuniones</h1>${DATA.zoom && DATA.zoom.enlace ? tarjetaZoom(DATA.zoom) : ''}${segmentos('reuniones', ['entresemana', 'discursos'])}${vistaSeccion(sub.reuniones)}`;
}

/* ---------- Zoom ---------- */
async function copiarTexto(t, msg = 'Copiado') {
  try { await navigator.clipboard.writeText(t); toast(msg, 'ok'); } catch (e) { hojaCompartir('Copiar', t); }
}
function tarjetaZoom(z) {
  const r = reunionHoy(z);
  return `<div class="card zoom-card">
    <div class="row"><span class="zoom-logo">Zoom</span><h3 class="grow" style="font-size:1.05rem">Reunión por Zoom</h3>${r ? '<span class="chip ok">Hoy</span>' : ''}</div>
    <p class="small" style="margin:8px 0 6px"><b>${esc(temaZoom(z))}</b></p>
    <div class="small muted">${horariosOrdenados(z).map(h => `<div class="cap">${esc(textoHorario(h))}</div>`).join('')}</div>
    <a class="btn btn-zoom btn-block" style="margin-top:12px" href="${esc(z.enlace)}" target="_blank" rel="noopener">Unirse por Zoom</a>
    <div class="zoom-datos">
      ${z.id ? `<div><span class="muted small">ID de reunión</span><b>${esc(z.id)}</b><button class="btn btn-sm" onclick="copiarTexto('${esc(z.id.replace(/\s/g, ''))}','ID copiado')">Copiar</button></div>` : ''}
      ${z.codigo ? `<div><span class="muted small">Código de acceso</span><b>${esc(z.codigo)}</b><button class="btn btn-sm" data-c="${esc(z.codigo)}" onclick="copiarTexto(this.dataset.c,'Código copiado')">Copiar</button></div>` : ''}
    </div>
    ${z.nota ? `<p class="small pre" style="margin:8px 0 0">${esc(z.nota)}</p>` : ''}
    <button class="btn btn-sm" style="margin-top:10px" onclick="hojaCompartir('Invitación de Zoom', mensajeZoom(DATA.zoom))">Compartir invitación</button>
  </div>`;
}
function avisoReunionHoy() {
  const z = DATA.zoom; if (!z || !z.enlace) return '';
  const r = reunionHoy(z); if (!r) return '';
  const cuando = r.faltan > 60 ? `Hoy a las ${fmtHora(r.h.hora)}` : r.faltan > 0 ? `Empieza en ${r.faltan} min (${fmtHora(r.h.hora)})` : 'La reunión ya comenzó';
  return `<div class="hoy-card zoom-hoy">
    <div class="k">Hoy hay reunión</div>
    <h2>${esc(cuando)}</h2>
    <div class="det">${esc(temaZoom(z))}</div>
    <div class="row" style="margin-top:12px">
      <a class="btn btn-w" href="${esc(z.enlace)}" target="_blank" rel="noopener">Unirse por Zoom</a>
      <button class="btn btn-t" onclick="irA('reuniones')">ID y código</button>
    </div></div>`;
}
setInterval(() => { if (DATA && vista === 'inicio' && document.visibilityState === 'visible' && reunionHoy(DATA.zoom)) render(); }, 60000);

function vAsignaciones() {
  return `<h1 class="titulo-vista">Otras asignaciones</h1>${segmentos('asignaciones', ['limpieza', 'audio_video', 'acomodadores', 'predicacion'])}${vistaSeccion(sub.asignaciones)}`;
}

/* Tarjeta de evento con el formato del calendario de la congregación */
function tarjetaEvento(a) {
  const pasado = (a.fechaFin || a.fecha) < hoy();
  const horario = horarioEvento(a);
  return `<div class="evento ${pasado ? 'pasado' : ''}">
    <div class="row" style="gap:6px;justify-content:space-between"><div class="ev-fecha">${a.fecha ? esc(fechaEvento(a)) : ''}</div><div class="row" style="gap:4px">${chipNuevo('anuncios', a)}${pasado ? '<span class="chip">Pasado</span>' : ''}</div></div>
    <h3 class="ev-titulo">${esc(a.titulo)}</h3>
    ${horario ? `<div class="ev-linea">${esc(horario)}</div>` : ''}
    ${a.lugar ? `<div class="ev-linea">${esc(a.lugar)}</div>` : ''}
    ${a.texto ? `<p class="pre ev-texto">${esc(a.texto)}</p>` : ''}
    ${(a.url || a.archivoId) ? (esPdf(a) ? `<button class="btn btn-sm" style="margin-top:10px" onclick="verPub('${esc(a.id)}')">Ver PDF adjunto</button>` : `<img src="${esc(srcImagen(a))}" alt="" loading="lazy" onclick="verPub('${esc(a.id)}')">`) : ''}
  </div>`;
}
function vAnuncios() {
  const lista = DATA.anuncios;
  if (!lista.length) return `<h1 class="titulo-vista">Anuncios y eventos</h1><div class="empty">No hay anuncios por ahora.</div>`;
  const sinFecha = lista.filter(a => !a.fecha);
  const porMes = [];
  lista.filter(a => a.fecha).forEach(a => {
    const m = mesEvento(a);
    let g = porMes.find(x => x.mes === m);
    if (!g) porMes.push(g = { mes: m, items: [] });
    g.items.push(a);
  });
  return `<h1 class="titulo-vista">Anuncios y eventos</h1>
    ${sinFecha.length ? `<h2 class="ev-mes">Avisos</h2>${sinFecha.map(tarjetaEvento).join('')}` : ''}
    ${porMes.map(g => `<h2 class="ev-mes">${esc(g.mes)}</h2>${g.items.map(tarjetaEvento).join('')}`).join('')}`;
}

function vPreguntas() {
  const anc = DATA.ancianos || [];
  return `<h1 class="titulo-vista">Preguntas a los ancianos</h1>
  <div class="card">
    <p class="small muted" style="margin:0 0 12px">Su pregunta llega solo a los ancianos. Si escribe su nombre podrán buscarle para responderle en persona.</p>
    <form id="fPreg" onsubmit="enviarPregunta(event)">
      <label class="f"><span>Su nombre (opcional)</span><input type="text" name="nombre" value="${esc(store.get('mi_nombre', ''))}" maxlength="80"></label>
      <label class="f"><span>Dirigida a</span><select name="anciano"><option value="">Cualquier anciano</option>${anc.map(n => `<option>${esc(n)}</option>`).join('')}</select></label>
      <label class="f"><span>Pregunta</span><textarea name="pregunta" required maxlength="2000" placeholder="Escriba su pregunta…"></textarea></label>
      <button class="btn btn-primary btn-block" id="bPreg">Enviar pregunta</button>
    </form>
  </div>
  <div class="h-sec">Mis preguntas</div><div id="misPreg"><div class="skeleton" style="height:70px"></div></div>`;
}

async function enviarPregunta(e) {
  e.preventDefault();
  const f = e.target, b = $('#bPreg');
  b.disabled = true; b.textContent = 'Enviando…';
  try {
    const r = await API.post('enviarPregunta', { nombre: f.nombre.value.trim(), anciano: f.anciano.value, pregunta: f.pregunta.value.trim() });
    const ids = store.get('mis_preguntas', []); ids.unshift(r.id); store.set('mis_preguntas', ids.slice(0, 50));
    f.pregunta.value = '';
    toast('Pregunta enviada. ¡Gracias!', 'ok');
    cargarMisPreguntas();
  } catch (err) { toast(err.message, 'err'); }
  b.disabled = false; b.textContent = 'Enviar pregunta';
}

async function cargarMisPreguntas() {
  const cont = $('#misPreg'); if (!cont) return;
  const ids = store.get('mis_preguntas', []);
  if (!ids.length) { cont.innerHTML = '<div class="empty small">Aquí verá el estado de las preguntas que envíe desde este teléfono.</div>'; return; }
  try {
    const lista = await API.post('misPreguntas', { ids });
    lista.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    const vistas = store.get('resp_vistas', []);
    store.set('resp_vistas', lista.filter(q => q.estado === 'respondida').map(q => q.id));
    RESP_NUEVAS = 0; pintarAvisos();
    cont.innerHTML = lista.length ? lista.map(q => `<div class="card preg ${q.estado === 'respondida' ? 'ok' : ''}">
      <div class="row"><span class="chip ${q.estado === 'respondida' ? 'ok' : 'warn'}">${q.estado === 'respondida' ? 'Respondida' : 'Pendiente'}</span>${q.estado === 'respondida' && !vistas.includes(q.id) ? '<span class="chip nuevo">Nueva respuesta</span>' : ''}
      <span class="small muted">${q.anciano ? 'Para ' + esc(q.anciano) : 'Cualquier anciano'}</span></div>
      <p class="pre" style="margin:8px 0 0">${esc(q.pregunta)}</p>
      ${q.respuesta ? `<div class="respuesta small pre"><b>Respuesta:</b> ${esc(q.respuesta)}</div>` : ''}</div>`).join('')
      : '<div class="empty small">No se encontraron sus preguntas.</div>';
  } catch (e) { cont.innerHTML = `<div class="empty small">No se pudieron cargar: ${esc(e.message)}</div>`; }
}

/* ---------- Territorios ---------- */
const T = { mapa: null, gps: false, pos: null, eligiendo: null, timer: null };
let PUNTOS = [];
let NAV = null; // navegación activa
const misPuntos = () => store.get('mis_puntos', []);
const proxSalidas = () => salidasProximas(DATA.salidas);
const buscarSalida = id => proxSalidas().find(x => x.id === id) || (DATA.salidas || []).find(x => x.id === id);
const coordsSalida = x => x.lat && x.lng ? { lat: +x.lat, lng: +x.lng } : (x.territorio ? Mapa.centro(x.territorio) : null);

function tarjetaSalida(x, conMapa = true) {
  const c = coordsSalida(x);
  return `<div class="card salida">
    <div class="row"><span class="chip ok">${x.fecha === hoy() ? 'Hoy' : esc(fmtFecha(x.fecha))}</span>${x.hora ? `<span class="small muted">${esc(x.hora)}</span>` : ''}${x.repetir === 'semanal' ? `<span class="chip">${esc(textoRepetir(x))}</span>` : ''}${chipNuevo('salidas', x)}</div>
    <h3 style="font-size:1.1rem;margin-top:8px">${esc(tituloSalida(x))}</h3>
    <div class="small muted cap">${esc(fmtLarga(x.fecha))}</div>
    ${x.conductor ? `<div class="small" style="margin-top:6px">Conductor: <b>${esc(x.conductor)}</b></div>` : ''}
    ${x.punto ? `<div class="small">Punto de encuentro: <b>${esc(x.punto)}</b></div>` : ''}
    ${x.nota ? `<div class="small pre" style="margin-top:4px">${esc(x.nota)}</div>` : ''}
    <div class="row" style="margin-top:10px">
      ${c ? `<button class="btn btn-sm btn-primary" onclick="navegarSalida('${esc(x.id)}')"><span class="ico">${ICON.ruta}</span>Cómo llegar</button>` : ''}
      ${conMapa && x.territorio ? `<button class="btn btn-sm" onclick="verTerritorio('${esc(x.territorio)}')">Ver territorio</button>` : ''}
      <button class="btn btn-sm" onclick="compartirSalida('${esc(x.id)}')">Compartir</button>
      ${x.territorio && x.fecha <= hoy() ? `<button class="btn btn-sm btn-verde" onclick="abrirRegistro('${esc(x.territorio)}','${esc(x.id)}')">Registrar cómo quedó</button>` : ''}
    </div></div>`;
}

/* Tarjeta destacada con los arreglos de hoy (va arriba en Inicio) */
function tarjetasHoy() {
  const hoyS = proxSalidas().filter(x => x.fecha === hoy());
  return hoyS.map(x => {
    const c = coordsSalida(x);
    return `<div class="hoy-card">
      <div class="k">Hoy · arreglo para la predicación</div>
      <h2>${esc(tituloSalida(x))}</h2>
      <div class="det">${[x.hora, x.punto].filter(Boolean).map(esc).join(' · ')}${x.conductor ? `<br>Conductor: <b>${esc(x.conductor)}</b>` : ''}</div>
      ${x.nota ? `<div class="det pre" style="margin-top:4px">${esc(x.nota)}</div>` : ''}
      <div class="row" style="margin-top:12px">
        ${c ? `<button class="btn btn-w" onclick="navegarSalida('${esc(x.id)}')"><span class="ico">${ICON.ruta}</span>Cómo llegar</button>` : ''}
      </div></div>`;
  }).join('');
}

/* ----- Registro de territorios ----- */
let RESUMEN = null;
function calcularResumen() { RESUMEN = Mapa.resumenRegistro(DATA.registro || []); return RESUMEN; }
function abrirRegistro(territorio, salidaId) {
  const sal = salidaId ? buscarSalida(salidaId) : null;
  const d = document.createElement('div');
  d.className = 'modal';
  d.innerHTML = `<form class="modal-box" id="fReg">
    <h3 style="font-size:1.05rem;margin-bottom:6px">Registrar predicación</h3>
    <p class="small muted" style="margin:0 0 12px">Queda en el registro de territorios y cambia el color del mapa.</p>
    <div class="grid2"><label class="f"><span>Territorio</span><select name="territorio">${Mapa.numeros().map(n => `<option ${String(n) === String(territorio) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label class="f"><span>Fecha</span><input type="date" name="fecha" required max="${hoy()}" value="${esc(sal && sal.fecha <= hoy() ? sal.fecha : hoy())}"></label></div>
    <label class="f"><span>¿Cómo quedó?</span>
      <div class="seg-mini" role="radiogroup"><button type="button" data-e="completo" class="on">Completo</button><button type="button" data-e="parcial">Parcial</button></div></label>
    <label class="f"><span>Conductor</span><input type="text" name="conductor" required maxlength="80" value="${esc((sal && sal.conductor) || store.get('mi_nombre', ''))}"></label>
    <label class="f"><span>Nota (opcional)</span><input type="text" name="nota" maxlength="300" placeholder="Ej. Faltó la calle de atrás del mercado"></label>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-x>Cancelar</button><button class="btn btn-primary">Guardar</button></div></form>`;
  document.body.appendChild(d);
  const f = $('#fReg', d); let estado = 'completo';
  d.addEventListener('click', e => {
    if (e.target === d || e.target.closest('[data-x]')) return d.remove();
    const b = e.target.closest('[data-e]');
    if (b) { estado = b.dataset.e; $$('[data-e]', d).forEach(x => x.classList.toggle('on', x === b)); }
  });
  f.onsubmit = async e => {
    e.preventDefault();
    const btn = $('button.btn-primary', f); btn.disabled = true;
    try {
      const r = await API.post('registrarTerritorio', { territorio: f.territorio.value, fecha: f.fecha.value, estado, conductor: f.conductor.value.trim(), nota: f.nota.value.trim() });
      (DATA.registro ||= []).push(r);
      d.remove(); toast(`Territorio ${r.territorio} registrado como ${r.estado}`, 'ok');
      calcularResumen();
      if (T.mapa) { T.mapa.colorear(colorMapa()); pintarChips(); pintarInfo(); }
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
  };
}
const colorMapa = () => { const m = {}; Object.values(RESUMEN || calcularResumen()).forEach(t => { m[t.territorio] = t.color; }); return m; };
function pintarChips() {
  const prox = new Set(proxSalidas().map(x => String(x.territorio)));
  const R = RESUMEN || calcularResumen();
  $('#tChips').innerHTML = Mapa.numeros().map(n => `<button data-n="${esc(n)}" class="${prox.has(String(n)) ? 'prox' : ''} ${String(n) === String(terrSel) ? 'on' : ''}"
    style="border-bottom:4px solid ${R[n].color}" title="${esc(Mapa.ESTADOS[R[n].estado].texto)}" onclick="verTerritorio('${esc(n)}')">${esc(n)}</button>`).join('');
}
function tarjetaPunto(pt) {
  const mio = misPuntos().includes(pt.id);
  const d = T.pos ? Mapa.distancia(T.pos, pt) : null;
  return `<div class="card punto-card">
    <div class="row"><span class="chip ok">Predicando aquí</span><span class="small muted">${esc(haceCuanto(pt.actualizado))}</span>${mio ? '<span class="chip gold">Su punto</span>' : ''}</div>
    <h3 style="font-size:1.05rem;margin-top:8px">${esc(pt.nombre)}</h3>
    <div class="small muted">${pt.territorio ? 'Territorio ' + esc(pt.territorio) : 'Fuera de los territorios'}${d != null ? ' · a ' + Mapa.fmtDist(d) + ' de usted' : ''}</div>
    ${pt.nota ? `<div class="small pre" style="margin-top:4px">${esc(pt.nota)}</div>` : ''}
    <div class="row" style="margin-top:10px">
      <button class="btn btn-sm btn-primary" onclick="navegarPunto('${esc(pt.id)}')"><span class="ico">${ICON.ruta}</span>Cómo llegar</button>
      <button class="btn btn-sm" onclick="verPunto('${esc(pt.id)}')">Ver</button>
      ${mio ? `<button class="btn btn-sm" onclick="moverMiPunto('${esc(pt.id)}')">Mover a mi ubicación</button>
               <button class="btn btn-sm btn-danger" onclick="quitarMiPunto('${esc(pt.id)}')">Quitar</button>` : ''}
    </div></div>`;
}

function verTerritorio(n) {
  terrSel = String(n);
  if (vista !== 'territorios') irA('territorios');
  else { T.mapa && T.mapa.seleccionar(terrSel); pintarInfo(); $('#tMapa').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}
function verPunto(id) {
  const pt = PUNTOS.find(x => x.id === id); if (!pt) return;
  const ir = () => { T.mapa.centrarEn(pt.lat, pt.lng, 18); $('#tMapa').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  if (vista !== 'territorios') { irA('territorios'); setTimeout(ir, 400); } else ir();
}

/* ----- Compartir ----- */
function compartirSalida(id) {
  const x = buscarSalida(id); if (!x) return;
  hojaCompartir(tituloSalida(x), mensajeSalida(x), { editable: true });
}
function compartirTerritorio(n) {
  const c = Mapa.centro(n);
  hojaCompartir('Territorio ' + n, `Territorio ${n}\nUbicación: ${Mapa.enlaceMapa(c.lat, c.lng)}\nVer el territorio en la app: ${Mapa.enlaceApp(n)}`);
}
function compartirUbicacion() {
  if (!T.pos) { toast('Buscando su ubicación… vuelva a tocar cuando aparezca el punto azul'); return activarGps(true); }
  const p = T.pos;
  hojaCompartir('Enviar mi ubicación', `📍 Estoy aquí${p.territorio != null ? ' (territorio ' + p.territorio + ')' : ''}:\n${Mapa.enlaceMapa(p.lat, p.lng)}\nCoordenadas: ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)} (precisión ±${p.precision} m)`);
}

/* ----- GPS ----- */
function activarGps(on) {
  T.gps = on;
  $('#bGps')?.classList.toggle('on', on);
  const est = $('#gpsEstado');
  if (!on) { T.mapa && T.mapa.detener(); T.pos = null; if (est) est.hidden = true; return; }
  if (est) { est.hidden = false; est.className = 'gps-estado'; est.textContent = 'Buscando su ubicación con el GPS…'; }
  T.mapa.seguirme(p => {
    const primera = !T.pos;
    T.pos = p;
    const e = $('#gpsEstado');
    if (e && !NAV) {
      e.className = 'gps-estado'; e.hidden = false;
      e.innerHTML = p.territorio != null
        ? `Usted está en el <b>territorio ${esc(p.territorio)}</b> · precisión ±${p.precision} m`
        : `Usted está fuera de los territorios · precisión ±${p.precision} m`;
    } else if (e) e.hidden = true;
    if (primera) pintarPuntos();
    alMoverme();
  }, m => {
    const e = $('#gpsEstado'); if (e) { e.hidden = false; e.className = 'gps-estado err'; e.textContent = m; }
    T.gps = false; $('#bGps')?.classList.remove('on');
  });
}
function esperarPosicion(ms = 30000) {
  if (T.pos) return Promise.resolve(T.pos);
  if (!T.gps) activarGps(true);
  return new Promise((res, rej) => {
    const ini = Date.now();
    const iv = setInterval(() => {
      if (T.pos) { clearInterval(iv); res(T.pos); }
      else if (!T.gps || Date.now() - ini > ms) { clearInterval(iv); rej(new Error('No se pudo obtener la ubicación. Revise que el GPS esté activado.')); }
    }, 300);
  });
}

/* ----- Puntos donde están predicando (los ven todos) ----- */
function pintarPuntos() {
  if (T.mapa) T.mapa.ponerPuntos(PUNTOS, misPuntos(), pt => { const c = $('#tPuntos'); c && c.scrollIntoView({ behavior: 'smooth' }); });
  const c = $('#tPuntos');
  if (c) c.innerHTML = PUNTOS.length ? `<div class="h-sec" style="margin-top:4px">Predicando ahora (${PUNTOS.length})</div>${PUNTOS.map(tarjetaPunto).join('')}` : '';
}
async function refrescarPuntos() {
  try {
    PUNTOS = await API.puntos();
    if (!DEMO) store.set('cache_puntos', PUNTOS);
    pintarPuntos();
  } catch (e) { /* sin internet: se quedan los últimos */ }
}
function iniciarRefresco() {
  clearInterval(T.timer);
  T.timer = setInterval(() => { if (document.visibilityState === 'visible' && vista === 'territorios') refrescarPuntos(); }, 30000);
}
function abrirMarcar() {
  const d = document.createElement('div');
  d.className = 'modal';
  d.innerHTML = `<form class="modal-box" id="fPunto">
    <h3 style="font-size:1.05rem;margin-bottom:6px">Marcar dónde estamos predicando</h3>
    <p class="small muted" style="margin:0 0 12px">El punto lo verán todos en el mapa durante 8 horas. Puede moverlo o quitarlo cuando quiera.</p>
    <label class="f"><span>Nombre o grupo</span><input type="text" name="nombre" required maxlength="40" value="${esc(store.get('mi_nombre', ''))}" placeholder="Ej. Grupo de Mateo Queche"></label>
    <label class="f"><span>Detalle (opcional)</span><input type="text" name="nota" maxlength="150" placeholder="Ej. Frente a la escuela, hasta las 11:00"></label>
    <div class="grid2" style="gap:8px">
      <button class="btn btn-verde" data-m="gps"><span class="ico">${ICON.gps}</span>Mi ubicación</button>
      <button class="btn" data-m="mapa"><span class="ico">${ICON.pin}</span>Elegir en el mapa</button>
    </div>
    <button type="button" class="btn btn-block" data-m="cerrar" style="margin-top:8px">Cancelar</button></form>`;
  document.body.appendChild(d);
  const f = $('#fPunto', d);
  f.onsubmit = e => e.preventDefault();
  d.addEventListener('click', async e => {
    const m = e.target.closest('[data-m]')?.dataset.m;
    if (e.target === d || m === 'cerrar') return d.remove();
    if (!m) return;
    e.preventDefault();
    const nombre = f.nombre.value.trim(), nota = f.nota.value.trim();
    if (!nombre) { f.nombre.focus(); return toast('Escriba su nombre o el del grupo', 'err'); }
    store.set('mi_nombre_punto', nombre);
    d.remove();
    if (m === 'gps') {
      toast('Buscando su ubicación…');
      try { const p = await esperarPosicion(); await guardarPunto(p.lat, p.lng, nombre, nota); }
      catch (err) { toast(err.message, 'err'); }
    } else {
      T.eligiendo = { nombre, nota };
      $('#tMapa').scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('#elegirAviso').hidden = false;
    }
  });
}
async function guardarPunto(lat, lng, nombre, nota, id) {
  try {
    const r = await API.post('marcarPunto', { dispositivo: miDispositivo(), nombre, nota, lat, lng, territorio: Mapa.territorioDe(lat, lng) ?? '', id });
    store.set('mis_puntos', [r.id]);
    toast('Punto marcado. Todos lo pueden ver.', 'ok');
    await refrescarPuntos();
  } catch (e) { toast(navigator.onLine ? e.message : 'Se necesita internet para que los demás vean el punto', 'err'); }
}
async function moverMiPunto(id) {
  const pt = PUNTOS.find(x => x.id === id); if (!pt) return;
  toast('Buscando su ubicación…');
  try { const p = await esperarPosicion(); await guardarPunto(p.lat, p.lng, pt.nombre, pt.nota, id); } catch (e) { toast(e.message, 'err'); }
}
async function quitarMiPunto(id) {
  if (!await confirmar('¿Quitar su punto del mapa?', 'Quitar')) return;
  try { await API.post('quitarPunto', { id, dispositivo: miDispositivo() }); store.set('mis_puntos', []); toast('Punto quitado'); refrescarPuntos(); }
  catch (e) { toast(e.message, 'err'); }
}
function clicEnMapa(ll) {
  if (!T.eligiendo) return false;
  const { nombre, nota } = T.eligiendo; T.eligiendo = null;
  $('#elegirAviso').hidden = true;
  guardarPunto(ll.lat, ll.lng, nombre, nota);
  return true;
}

/* ----- Navegación dentro de la app ----- */
function navegarPunto(id) {
  const pt = PUNTOS.find(x => x.id === id) || (DATA.puntos || []).find(x => x.id === id);
  if (pt) navegarA(pt.lat, pt.lng, pt.nombre);
}
function navegarSalida(id) {
  const x = buscarSalida(id); if (!x) return;
  const c = coordsSalida(x);
  if (c) navegarA(c.lat, c.lng, x.punto || tituloSalida(x));
}
async function navegarA(lat, lng, nombre) {
  NAV = { destino: { lat: +lat, lng: +lng }, nombre, modo: store.get('modo_ruta', 'foot'), ruta: null, paso: 0, calc: false, ult: 0, seguir: true, llego: false };
  if (vista !== 'territorios') { irA('territorios'); await new Promise(r => setTimeout(r, 300)); }
  T.mapa.marcarDestino(NAV.destino.lat, NAV.destino.lng);
  pintarNav();
  $('#navPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (!T.gps) activarGps(true);
  if (T.pos) recalcular(true);
}
function terminarNav() { NAV = null; T.mapa && T.mapa.limpiarRuta(); pintarNav(); if (T.pos) activarGps(true); }
function cambiarModo(m) { if (!NAV) return; NAV.modo = m; store.set('modo_ruta', m); NAV.ult = 0; recalcular(true); }
function centrarNav() { if (NAV && T.pos) { NAV.seguir = true; T.mapa.centrarEn(T.pos.lat, T.pos.lng, 18); pintarNav(); } }
async function recalcular(ajustar) {
  if (!NAV || !T.pos || NAV.calc) return;
  NAV.calc = true; NAV.ult = Date.now(); pintarNav();
  try {
    NAV.ruta = await Mapa.calcularRuta(T.pos, NAV.destino, NAV.modo);
    NAV.paso = 0; NAV.idx = 0;
    // posición de cada vuelta dentro de la línea de la ruta
    const co = NAV.ruta.coords;
    NAV.ruta.pasos.forEach(st => {
      let mejor = Infinity;
      co.forEach((c, i) => { const d = Mapa.distancia({ lat: c[0], lng: c[1] }, st); if (d < mejor) { mejor = d; st.i = i; } });
    });
  } catch (e) {
    NAV.ruta = { coords: [[T.pos.lat, T.pos.lng], [NAV.destino.lat, NAV.destino.lng]], recta: true, pasos: [] };
  }
  NAV.calc = false;
  if (!NAV) return;
  T.mapa.mostrarRuta(NAV.ruta.coords, NAV.ruta.recta, ajustar);
  pintarNav();
}
function alMoverme() {
  if (!NAV || !T.pos) return;
  if (!NAV.ruta && !NAV.calc) return recalcular(true);
  if (!NAV.ruta) return;
  const p = T.pos;
  if (NAV.ruta.recta) {
    NAV.ruta.coords = [[p.lat, p.lng], [NAV.destino.lat, NAV.destino.lng]];
    T.mapa.mostrarRuta(NAV.ruta.coords, true, false);
    if (navigator.onLine && Date.now() - NAV.ult > 30000) recalcular(false);
  } else {
    const c = Mapa.cercaniaLinea(p, NAV.ruta.coords);
    NAV.idx = c.idx;
    if (c.dist > Math.max(40, p.precision) && Date.now() - NAV.ult > 15000) recalcular(false);
    const ps = NAV.ruta.pasos;
    // la siguiente vuelta es la primera que todavía está adelante en la ruta
    let k = 0;
    for (let j = 1; j < ps.length; j++) if (ps[j].i <= c.idx || Mapa.distancia(p, ps[j]) < 15) k = j;
    NAV.paso = k;
  }
  NAV.llego = Mapa.distancia(p, NAV.destino) < Math.max(25, Math.min(p.precision, 60));
  if (NAV.seguir) T.mapa.map.panTo([p.lat, p.lng], { animate: true });
  pintarNav();
}
function restante() {
  if (!NAV || !NAV.ruta || !T.pos) return null;
  const co = NAV.ruta.coords;
  if (NAV.ruta.recta) return Mapa.distancia(T.pos, NAV.destino);
  let d = 0, i = NAV.idx || 0;
  d += Mapa.distancia(T.pos, { lat: co[i + 1]?.[0] ?? co[i][0], lng: co[i + 1]?.[1] ?? co[i][1] });
  for (let k = i + 1; k < co.length - 1; k++) d += Mapa.distancia({ lat: co[k][0], lng: co[k][1] }, { lat: co[k + 1][0], lng: co[k + 1][1] });
  return d;
}
function pintarNav() {
  const box = $('#navPanel'); if (!box) return;
  if (!NAV) { box.innerHTML = ''; return; }
  const modos = `<div class="row" style="gap:6px;margin-top:10px">
      <button class="btn btn-t ${NAV.modo === 'foot' ? 'on' : ''}" onclick="cambiarModo('foot')">A pie</button>
      <button class="btn btn-t ${NAV.modo === 'car' ? 'on' : ''}" onclick="cambiarModo('car')">En carro</button>
      ${NAV.seguir ? '' : '<button class="btn btn-t" onclick="centrarNav()">Centrar</button>'}
      <span class="grow"></span><button class="btn btn-w" onclick="terminarNav()">Terminar</button></div>`;
  let cuerpo;
  if (!T.pos) cuerpo = `<div class="grande">Buscando su ubicación…</div><div class="peq">Active el GPS para ver la ruta.</div>`;
  else if (NAV.llego) cuerpo = `<div class="grande">¡Llegó!</div><div class="peq">Está junto a ${esc(NAV.nombre)}.</div>`;
  else if (NAV.calc && !NAV.ruta) cuerpo = `<div class="grande">Calculando la ruta…</div>`;
  else if (NAV.ruta && NAV.ruta.recta) {
    const d = Mapa.distancia(T.pos, NAV.destino), g = Mapa.rumbo(T.pos, NAV.destino);
    cuerpo = `<div class="grande">Camine hacia el ${Mapa.rumboTexto(g)} · ${Mapa.fmtDist(d)}</div>
      <div class="peq">Sin internet no se pueden calcular las calles: la línea punteada muestra la dirección en línea recta. La distancia se actualiza con su GPS.</div>`;
  } else if (NAV.ruta) {
    const ps = NAV.ruta.pasos, sig = ps[NAV.paso + 1];
    const dSig = sig ? Mapa.distancia(T.pos, sig) : null;
    const rest = restante() ?? NAV.ruta.distancia;
    const vel = NAV.modo === 'car' ? 6 : 1.25;
    cuerpo = `<div class="peq">${sig ? 'En ' + Mapa.fmtDist(dSig) : ''}</div>
      <div class="grande">${esc(sig ? sig.texto : 'Siga hasta el destino')}</div>
      <div class="peq">Faltan ${Mapa.fmtDist(rest)} · unos ${Mapa.fmtTiempo(rest / vel)} ${NAV.modo === 'car' ? 'en carro' : 'a pie'}${NAV.calc ? ' · recalculando…' : ''}</div>`;
  }
  box.innerHTML = `<div class="nav ${NAV.llego ? 'llego' : ''}"><div class="peq">Ruta hacia <b>${esc(NAV.nombre)}</b></div>${cuerpo}${modos}</div>`;
}

/* ----- Info del territorio seleccionado ----- */
function pintarInfo() {
  const box = $('#tInfo'); if (!box) return;
  $$('#tChips button').forEach(b => b.classList.toggle('on', b.dataset.n === String(terrSel)));
  if (terrSel == null || !Mapa.buscar(terrSel)) { box.innerHTML = ''; return; }
  const c = Mapa.centro(terrSel);
  const sal = proxSalidas().filter(x => String(x.territorio) === String(terrSel));
  const R = (RESUMEN || calcularResumen())[terrSel];
  const est = Mapa.ESTADOS[R.estado];
  box.innerHTML = `<div class="card"><div class="row"><h3 class="grow" style="font-size:1.1rem">Territorio ${esc(terrSel)}</h3>
      <button class="x" aria-label="Quitar selección" onclick="terrSel=null;T.mapa.verTodos();pintarInfo()">✕</button></div>
    <div class="estado-t" style="margin-top:4px"><i style="background:${est.color}"></i>Completo ${esc(Mapa.textoDias(R.dias))}${R.ultimoCompleto ? ' (' + esc(fmtFecha(R.ultimoCompleto.fecha, { day: 'numeric', month: 'short', year: 'numeric' })) + ')' : ''}</div>
    ${R.enProgreso ? `<div class="small" style="margin-top:4px">En progreso: trabajado parcialmente el ${esc(fmtFecha(R.ultimo.fecha))} por ${esc(R.ultimo.conductor)}${R.ultimo.nota ? ' — ' + esc(R.ultimo.nota) : ''}</div>` : ''}
    <p class="small muted" style="margin:6px 0 10px">${sal.length ? `Próxima salida: <b>${esc(fmtLarga(sal[0].fecha))}${sal[0].hora ? ', ' + esc(sal[0].hora) : ''}</b>` : 'Sin salida programada.'}</p>
    ${R.historial.length ? `<details style="margin-bottom:10px"><summary class="small" style="cursor:pointer;font-weight:600">Historial (${R.historial.length})</summary>
      <div class="small" style="margin-top:6px">${R.historial.slice(0, 12).map(h => `<div>${esc(fmtFecha(h.fecha, { day: 'numeric', month: 'short', year: 'numeric' }))} · ${h.estado === 'completo' ? '<b>Completo</b>' : 'Parcial'} · ${esc(h.conductor)}${h.nota ? ' — ' + esc(h.nota) : ''}</div>`).join('')}</div></details>` : ''}
    <div class="row"><button class="btn btn-sm btn-verde" onclick="abrirRegistro('${esc(terrSel)}')">Registrar predicación</button><button class="btn btn-sm btn-primary" onclick="navegarA(${c.lat},${c.lng},'Territorio ${esc(terrSel)}')"><span class="ico">${ICON.ruta}</span>Cómo llegar</button>
      <button class="btn btn-sm" onclick="compartirTerritorio('${esc(terrSel)}')">Compartir territorio</button></div></div>`;
}

async function renderTerritorios() {
  const app = $('#app');
  if (T.mapa && $('#tMapa')) { calcularResumen(); T.mapa.colorear(colorMapa()); pintarChips(); pintarSalidas(); pintarInfo(); pintarPuntos(); pintarNav(); return; }
  app.innerHTML = '<div class="skeleton" style="height:300px"></div>';
  try { await Mapa.territorios(); } catch (e) { app.innerHTML = '<div class="empty">No se pudo cargar el mapa de territorios.</div>'; return; }
  const prox = new Set(proxSalidas().map(x => String(x.territorio)));
  app.innerHTML = `<h1 class="titulo-vista">Territorios</h1>
    <div id="navPanel"></div>
    <div id="gpsEstado" class="gps-estado" hidden></div>
    <div id="elegirAviso" class="gps-estado" hidden>Toque el mapa en el lugar donde están predicando. <a href="#" onclick="event.preventDefault();T.eligiendo=null;this.parentNode.hidden=true">Cancelar</a></div>
    <div class="mapa-wrap"><div id="tMapa" class="mapa"></div>
      <div class="mapa-btns"><button id="bGps" class="btn btn-sm" onclick="activarGps(!T.gps)"><span class="ico">${ICON.gps}</span>Mi ubicación</button></div></div>
    <div class="grid2" style="gap:8px;margin-bottom:14px">
      <button class="btn btn-verde" onclick="abrirMarcar()"><span class="ico">${ICON.pin}</span>Marcar dónde predicamos</button>
      <button class="btn btn-gold" onclick="compartirUbicacion()">Enviar mi ubicación</button></div>
    <div id="tPuntos"></div>
    <div id="tSalidas"></div>
    <div id="tInfo"></div>
    <div class="h-sec">Elegir territorio</div>
    ${Mapa.leyenda()}
    <div class="chips-t" id="tChips"></div>
    <p class="small muted" style="margin-top:14px">Los territorios, el GPS y la dirección hacia un punto funcionan <b>sin internet</b>. Para ver la ruta por las calles y los puntos nuevos de otros grupos se necesita internet. Las calles del fondo se guardan cuando se ven con internet. Borde azul = territorio con salida programada. Los colores muestran cuánto tiempo lleva cada territorio sin predicarse completo.</p>`;
  T.mapa = Mapa.crear($('#tMapa'), {
    onTerritorio: n => { terrSel = String(n); T.mapa.seleccionar(terrSel, false); pintarInfo(); },
    onClic: clicEnMapa,
    onArrastre: () => { if (NAV && NAV.seguir) { NAV.seguir = false; pintarNav(); } }
  });
  calcularResumen(); T.mapa.colorear(colorMapa()); pintarChips();
  if (terrSel != null) T.mapa.seleccionar(terrSel);
  if (!PUNTOS.length) PUNTOS = DATA.puntos || store.get('cache_puntos', []);
  pintarSalidas(); pintarInfo(); pintarPuntos();
  if (NAV) { T.mapa.marcarDestino(NAV.destino.lat, NAV.destino.lng); if (NAV.ruta) T.mapa.mostrarRuta(NAV.ruta.coords, NAV.ruta.recta, false); pintarNav(); }
  if (T.gps) activarGps(true);
  refrescarPuntos(); iniciarRefresco();
}
function pintarSalidas() {
  const s = proxSalidas().slice(0, 3);
  $('#tSalidas').innerHTML = s.length ? `<div class="h-sec" style="margin-top:4px">Salidas programadas</div>${s.map(x => tarjetaSalida(x)).join('')}` : '';
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && DATA) cargar(); });
Mapa.territorios().then(() => { if (DATA && vista === 'inicio') render(); }).catch(() => {});
cargar();
