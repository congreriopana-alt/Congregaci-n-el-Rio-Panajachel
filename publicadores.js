/* App de publicadores */
let DATA = null;
const VISTAS = [
  ['inicio', 'Inicio', ICON.home],
  ['reuniones', 'Reuniones', ICON.book],
  ['asignaciones', 'Asignaciones', ICON.list],
  ['anuncios', 'Anuncios', ICON.bell],
  ['preguntas', 'Preguntas', ICON.chat]
];
let vista = store.get('vista', 'inicio');
const sub = { reuniones: store.get('sub_reuniones', 'entresemana'), asignaciones: store.get('sub_asignaciones', 'limpieza') };

$('#tabs').innerHTML = VISTAS.map(([k, t, i]) => `<button data-v="${k}">${i}<span>${t}</span></button>`).join('');
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) irA(b.dataset.v); });
if (DEMO) $('#demoBanner').hidden = false;
if (CFG.CONGREGACION) $('#brand').textContent = CFG.CONGREGACION;

function irA(v) { vista = v; store.set('vista', v); render(); window.scrollTo(0, 0); }

async function cargar() {
  const cache = DEMO ? null : store.get('cache_data', null);
  if (cache) { DATA = cache; render(); }
  else $('#app').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  try {
    DATA = await API.get();
    if (!DEMO) store.set('cache_data', DATA);
    render();
  } catch (e) {
    if (DATA) toast('Sin conexión: se muestra la última información guardada');
    else $('#app').innerHTML = `<div class="empty">No se pudo cargar la información.<br><span class="small">${esc(e.message)}</span><br><br><button class="btn btn-primary" onclick="cargar()">Reintentar</button></div>`;
  }
}

function render() {
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === vista));
  if (!DATA) return;
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
      <div class="grow"><div class="row">${chipSeccion(p.seccion)} ${badge}</div>
      <div class="pub-t">${esc(p.titulo)}</div><div class="small muted">${esc(fmtRango(p.fechaInicio, p.fechaFin))}</div></div></button>`;
  return `<button class="pub" onclick="verPub('${esc(p.id)}')">${thumb}
    <div class="pub-body"><div class="row">${chipSeccion(p.seccion)} ${badge} ${pdf ? '<span class="chip warn">PDF</span>' : ''}</div>
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
  const eventos = DATA.anuncios.filter(a => a.fecha && a.fecha >= h).slice(0, 3);
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
  <div class="hero"><div class="k">Esta semana</div><div class="v">${esc(fmtRango(s.inicio, s.fin))}</div>
    <div class="small" style="color:#d6deea;margin-top:4px">${estaSemana ? `${estaSemana} asignaciones registradas` : 'Consulte los programas en Reuniones y Asignaciones'}</div></div>

  ${esIOS && !esInstalada && !store.get('ios_ok') ? `<div class="card flat small">Para instalar en iPhone: toque <b>Compartir</b> y luego <b>Agregar a pantalla de inicio</b>. <button class="btn btn-sm" style="margin-left:6px" onclick="store.set('ios_ok',1);render()">Entendido</button></div>` : ''}

  <div class="card">
    <h3 style="font-size:1.05rem">Mis asignaciones</h3>
    <p class="small muted" style="margin:4px 0 10px">Escriba su nombre para ver sus próximas asignaciones.</p>
    <form class="row" onsubmit="event.preventDefault();store.set('mi_nombre',this.n.value.trim());render()">
      <input class="grow" name="n" type="search" list="dlNombres" placeholder="Ej. Mateo Queche" value="${esc(nombre)}" autocomplete="name" style="flex:1 1 180px">
      <button class="btn btn-primary">Ver</button>
    </form>
    <datalist id="dlNombres">${nombres.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    ${mis}
  </div>

  ${eventos.length ? `<div class="h-sec">Próximos eventos <button onclick="irA('anuncios')">Ver todos</button></div>
    <div class="lista">${eventos.map(a => `<div class="item">${fechaBox(a.fecha)}<div class="grow"><div class="t">${esc(a.titulo)}</div>
    <div class="small muted">${esc(TIPOS_ANUNCIO[a.tipo] || 'Anuncio')}${a.hora ? ' · ' + esc(a.hora) : ''}</div></div></div>`).join('')}</div>` : ''}

  <div class="h-sec">Publicado recientemente</div>
  ${recientes.length ? recientes.map(p => tarjetaPub(p, true)).join('') : '<div class="empty">Aún no hay programas publicados.</div>'}`;
}

function vistaSeccion(seccion) {
  const pubs = DATA.publicaciones.filter(p => p.seccion === seccion);
  pubs.sort((a, b) => (vigente(b) - vigente(a)) || (b.fechaInicio || '').localeCompare(a.fechaInicio || ''));
  const asig = DATA.asignaciones.filter(a => a.seccion === seccion && a.fecha >= hoy());
  return `
    ${pubs.length ? pubs.map(p => tarjetaPub(p)).join('') : `<div class="empty">Todavía no hay programa publicado de ${esc(SECCIONES[seccion].nombre.toLowerCase())}.</div>`}
    ${asig.length ? `<div class="h-sec">Próximas asignaciones</div>${listaAsignaciones(asig, store.get('mi_nombre', ''))}` : ''}`;
}

function segmentos(grupo, claves) {
  return `<div class="seg" role="tablist">${claves.map(k => `<button role="tab" class="${sub[grupo] === k ? 'on' : ''}"
    onclick="sub['${grupo}']='${k}';store.set('sub_${grupo}','${k}');render()">${esc(SECCIONES[k].corto)}</button>`).join('')}</div>`;
}

function vReuniones() {
  return `<h1 class="titulo-vista">Reuniones</h1>${segmentos('reuniones', ['entresemana', 'discursos'])}${vistaSeccion(sub.reuniones)}`;
}

function vAsignaciones() {
  return `<h1 class="titulo-vista">Otras asignaciones</h1>${segmentos('asignaciones', ['limpieza', 'audio_video', 'acomodadores', 'predicacion'])}${vistaSeccion(sub.asignaciones)}`;
}

function vAnuncios() {
  const h = hoy();
  const lista = DATA.anuncios;
  if (!lista.length) return `<h1 class="titulo-vista">Anuncios y eventos</h1><div class="empty">No hay anuncios por ahora.</div>`;
  return `<h1 class="titulo-vista">Anuncios y eventos</h1>${lista.map(a => `
    <div class="card"><div class="anuncio">${a.fecha ? fechaBox(a.fecha) : ''}<div class="grow">
      <div class="row"><span class="chip ${a.tipo === 'anuncio' ? '' : 'gold'}">${esc(TIPOS_ANUNCIO[a.tipo] || 'Anuncio')}</span>${a.fecha && a.fecha < h ? '<span class="chip">Pasado</span>' : ''}</div>
      <h3 style="font-size:1.05rem;margin-top:8px">${esc(a.titulo)}</h3>
      ${a.fecha ? `<div class="small muted cap">${esc(fmtLarga(a.fecha))}${a.hora ? ' · ' + esc(a.hora) : ''}</div>` : ''}
      ${a.texto ? `<p class="pre" style="margin:8px 0 0">${esc(a.texto)}</p>` : ''}
      ${(a.url || a.archivoId) ? (esPdf(a) ? `<button class="btn btn-sm" style="margin-top:10px" onclick="verPub('${esc(a.id)}')">Ver PDF adjunto</button>` : `<img src="${esc(srcImagen(a))}" alt="" loading="lazy" onclick="verPub('${esc(a.id)}')">`) : ''}
    </div></div></div>`).join('')}`;
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
    cont.innerHTML = lista.length ? lista.map(q => `<div class="card preg ${q.estado === 'respondida' ? 'ok' : ''}">
      <div class="row"><span class="chip ${q.estado === 'respondida' ? 'ok' : 'warn'}">${q.estado === 'respondida' ? 'Respondida' : 'Pendiente'}</span>
      <span class="small muted">${q.anciano ? 'Para ' + esc(q.anciano) : 'Cualquier anciano'}</span></div>
      <p class="pre" style="margin:8px 0 0">${esc(q.pregunta)}</p>
      ${q.respuesta ? `<div class="respuesta small pre"><b>Respuesta:</b> ${esc(q.respuesta)}</div>` : ''}</div>`).join('')
      : '<div class="empty small">No se encontraron sus preguntas.</div>';
  } catch (e) { cont.innerHTML = `<div class="empty small">No se pudieron cargar: ${esc(e.message)}</div>`; }
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && DATA) cargar(); });
cargar();
