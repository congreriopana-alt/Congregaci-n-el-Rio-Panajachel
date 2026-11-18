/* Panel de ancianos */
let PASS = sesion.get('pass', '') || store.get('pass', '');
let DATA = null, ASIG = null, HER = null, PREG = null, REC = null;
let vista = sesion.get('vista', 'subir');
let recSemana = 0, filtroAsig = '';
const VISTAS = [
  ['subir', 'Subir programa'], ['publicado', 'Publicado'], ['anuncios', 'Anuncios'],
  ['asignaciones', 'Asignaciones'], ['territorios', 'Territorios'], ['recordatorios', 'Recordatorios'], ['preguntas', 'Preguntas'], ['hermanos', 'Hermanos']
];
if (DEMO) $('#demoBanner').hidden = false;
if (CFG.CONGREGACION) $('#subBrand').textContent = CFG.CONGREGACION;

const opcionesSeccion = (sel = '') => Object.entries(SECCIONES).map(([k, s]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(s.nombre)}</option>`).join('');
const post = (a, p = {}) => API.post(a, { ...p, password: PASS });

/* ---------- Acceso ---------- */
function vLogin(error = '') {
  $('#tabs').hidden = true; $('#btnSalir').hidden = true;
  $('#app').innerHTML = `<div class="login card">
    <h1 style="font-size:1.25rem">Acceso para ancianos</h1>
    <p class="small muted">Escriba la contraseña del cuerpo de ancianos.</p>
    <form onsubmit="entrar(event)">
      <label class="f"><span>Contraseña</span><input type="password" name="p" required autocomplete="current-password" autofocus></label>
      <label class="small row" style="margin:-4px 0 14px;gap:8px"><input type="checkbox" name="r"> Recordar en este teléfono</label>
      ${error ? `<p class="small" style="color:var(--danger);margin-top:0">${esc(error)}</p>` : ''}
      <button class="btn btn-primary btn-block" id="bEntrar">Entrar</button>
    </form>
    <p class="small muted" style="margin-bottom:0"><a href="index.html">← Ir a la app de publicadores</a></p></div>`;
}
async function entrar(e) {
  e.preventDefault();
  const f = e.target, b = $('#bEntrar');
  b.disabled = true; b.textContent = 'Verificando…';
  try {
    PASS = f.p.value;
    await post('login');
    sesion.set('pass', PASS);
    if (f.r.checked) store.set('pass', PASS);
    iniciar();
  } catch (err) { PASS = ''; vLogin(err.message); }
}
function salir() { PASS = ''; sesion.del('pass'); store.del('pass'); vLogin(); }

async function iniciar() {
  $('#tabs').hidden = false; $('#btnSalir').hidden = false;
  $('#tabs').innerHTML = VISTAS.map(([k, t]) => `<button data-v="${k}">${t}<span class="badge" data-badge="${k}" hidden></span></button>`).join('');
  $('#tabs').onclick = e => { const b = e.target.closest('button'); if (b) irA(b.dataset.v); };
  $('#app').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
  try {
    [DATA, PREG] = await Promise.all([API.get(), post('listarPreguntas')]);
    actualizarBadge();
    render();
  } catch (e) {
    if (/contraseña/i.test(e.message)) return salir();
    $('#app').innerHTML = `<div class="empty">No se pudo cargar: ${esc(e.message)}<br><br><button class="btn" onclick="iniciar()">Reintentar</button></div>`;
  }
}
function actualizarBadge() {
  const n = (PREG || []).filter(q => q.estado === 'pendiente').length;
  const b = $('[data-badge="preguntas"]'); if (b) { b.textContent = n; b.hidden = !n; }
}
function irA(v) { vista = v; sesion.set('vista', v); render(); window.scrollTo(0, 0); }
async function recargarData() { DATA = await API.get(); }

async function render() {
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === vista));
  const app = $('#app');
  if (AM) { AM.destruir(); AM = null; }
  try {
    if (vista === 'subir') app.innerHTML = vSubir(), initSubir();
    else if (vista === 'publicado') app.innerHTML = vPublicado();
    else if (vista === 'anuncios') app.innerHTML = vAnuncios();
    else if (vista === 'asignaciones') { if (!ASIG) { app.innerHTML = '<div class="skeleton"></div>'; ASIG = await post('listarAsignaciones'); HER ||= await post('listarHermanos'); } app.innerHTML = vAsignaciones(); }
    else if (vista === 'hermanos') { if (!HER) { app.innerHTML = '<div class="skeleton"></div>'; HER = await post('listarHermanos'); } app.innerHTML = vHermanos(); }
    else if (vista === 'preguntas') app.innerHTML = vPreguntas();
    else if (vista === 'territorios') { app.innerHTML = '<div class="skeleton"></div>'; await Mapa.territorios(); HER ||= await post('listarHermanos'); app.innerHTML = vTerritorios(); initTerritorios(); }
    else if (vista === 'recordatorios') { app.innerHTML = '<div class="skeleton"></div>'; REC = await post('recordatorios', { semana: recSemana }); app.innerHTML = vRecordatorios(); }
  } catch (e) { app.innerHTML = `<div class="empty">Error: ${esc(e.message)}</div>`; }
}

/* ---------- Subir programa (imagen o PDF) ---------- */
function rangoPorDefecto(sec) {
  if (sec === 'entresemana' || sec === 'limpieza' || sec === 'acomodadores' || sec === 'audio_video') {
    const s = semana(new Date().getDay() >= 5 || new Date().getDay() === 0 ? 1 : 0);
    return sec === 'entresemana' ? s : { inicio: s.inicio, fin: addDias(s.inicio, 27) };
  }
  const d = new Date(), y = d.getFullYear(), m = d.getMonth();
  return { inicio: ymd(new Date(y, m, 1)), fin: ymd(new Date(y, m + 1, 0)) };
}
function vSubir() {
  const sec = sesion.get('ult_seccion', 'entresemana');
  return `<h1 class="titulo-vista">Subir programa</h1>
  <form class="card" id="fSubir" onsubmit="subir(event)">
    <label class="f"><span>Sección</span><select name="seccion" id="sSec">${opcionesSeccion(sec)}</select></label>
    <div class="grid2 resp">
      <label class="f"><span>Válido desde</span><input type="date" name="fechaInicio" id="dIni" required></label>
      <label class="f"><span>Hasta</span><input type="date" name="fechaFin" id="dFin" required></label>
    </div>
    <label class="f"><span>Título</span><input type="text" name="titulo" id="tTit" maxlength="150" required></label>
    <label class="f"><span>Nota para los publicadores (opcional)</span><textarea name="nota" maxlength="500" style="min-height:64px" placeholder="Ej. Recuerden llegar 15 minutos antes."></textarea></label>
    <label class="drop" id="drop"><input type="file" name="archivo" id="fArch" accept="image/*,application/pdf" required>
      <span id="dropTxt">Toque para elegir la imagen o el PDF del programa</span></label>
    <div class="preview" id="prev"></div>
    <button class="btn btn-primary btn-block" id="bSubir" style="margin-top:14px">Publicar</button>
  </form>
  <p class="small muted">Las imágenes grandes se reducen automáticamente para que carguen rápido en los teléfonos.</p>`;
}
function initSubir() {
  const sSec = $('#sSec'), tTit = $('#tTit'), dIni = $('#dIni'), dFin = $('#dFin');
  tTit.dataset.auto = '1';
  const ponerFechas = () => { const r = rangoPorDefecto(sSec.value); dIni.value = r.inicio; dFin.value = r.fin; ponerTitulo(); };
  const ponerTitulo = () => { if (tTit.dataset.auto) tTit.value = `${SECCIONES[sSec.value].nombre} — ${fmtRango(dIni.value, dFin.value)}`; };
  sSec.onchange = () => { sesion.set('ult_seccion', sSec.value); ponerFechas(); };
  dIni.onchange = dFin.onchange = ponerTitulo;
  tTit.oninput = () => { delete tTit.dataset.auto; };
  ponerFechas();
  $('#fArch').onchange = e => {
    const f = e.target.files[0];
    $('#drop').classList.toggle('has', !!f);
    $('#dropTxt').textContent = f ? `✓ ${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB) · tocar para cambiar` : 'Toque para elegir la imagen o el PDF del programa';
    $('#prev').innerHTML = f && f.type.startsWith('image/') ? `<img src="${URL.createObjectURL(f)}" alt="Vista previa">` : '';
  };
}
async function subir(e) {
  e.preventDefault();
  const f = e.target, b = $('#bSubir');
  if (f.fechaFin.value < f.fechaInicio.value) return toast('La fecha "hasta" es antes de "desde"', 'err');
  b.disabled = true; b.textContent = 'Subiendo…';
  try {
    const arch = await prepararArchivo(f.archivo.files[0]);
    const pub = await post('subir', { seccion: f.seccion.value, titulo: f.titulo.value.trim(), fechaInicio: f.fechaInicio.value, fechaFin: f.fechaFin.value, nota: f.nota.value.trim(), ...arch });
    await recargarData();
    toast('Programa publicado', 'ok');
    $('#app').innerHTML = `<div class="card" style="text-align:center">
      <h2 style="font-size:1.15rem">✓ Publicado</h2>
      <p class="muted small">"${esc(pub.titulo)}" ya está visible para los publicadores.</p>
      <p class="small">Para que cada hermano reciba su recordatorio el lunes, agregue también los nombres y sus asignaciones.</p>
      <div class="row" style="justify-content:center"><button class="btn btn-gold" onclick="sesion.set('asig_seccion','${esc(pub.seccion)}');irA('asignaciones')">Agregar asignaciones</button>
      <button class="btn" onclick="render()">Subir otro</button></div></div>`;
  } catch (err) { toast(err.message, 'err'); b.disabled = false; b.textContent = 'Publicar'; }
}

/* ---------- Publicado ---------- */
function vPublicado() {
  const pubs = DATA.publicaciones;
  if (!pubs.length) return `<h1 class="titulo-vista">Publicado</h1><div class="empty">Aún no hay programas.</div>`;
  return `<h1 class="titulo-vista">Publicado</h1>${Object.keys(SECCIONES).map(sec => {
    const l = pubs.filter(p => p.seccion === sec); if (!l.length) return '';
    return `<div class="h-sec">${esc(SECCIONES[sec].nombre)}</div><div class="lista">${l.map(p => `<div class="item">
      <div class="grow" style="cursor:pointer" onclick="abrirVisor(DATA.publicaciones.find(x=>x.id==='${esc(p.id)}'))">
        <div class="t">${esc(p.titulo)}</div><div class="small muted">${esc(fmtRango(p.fechaInicio, p.fechaFin))} ${vigente(p) ? '· <b style="color:var(--ok)">vigente</b>' : ''}${esPdf(p) ? ' · PDF' : ''}</div></div>
      <button class="x" title="Eliminar" aria-label="Eliminar" onclick="borrarPub('${esc(p.id)}')">✕</button></div>`).join('')}</div>`;
  }).join('')}`;
}
async function borrarPub(id) {
  const p = DATA.publicaciones.find(x => x.id === id);
  if (!await confirmar(`¿Eliminar "${p ? p.titulo : ''}"? También se borrará el archivo.`)) return;
  try { await post('borrarPublicacion', { id }); await recargarData(); render(); toast('Eliminado'); } catch (e) { toast(e.message, 'err'); }
}

/* ---------- Anuncios ---------- */
function vAnuncios() {
  return `<h1 class="titulo-vista">Anuncios y eventos</h1>
  <form class="card" onsubmit="guardarAnuncio(event)">
    <label class="f"><span>Tipo</span><select name="tipo">${Object.entries(TIPOS_ANUNCIO).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    <label class="f"><span>Título</span><input type="text" name="titulo" required maxlength="150" placeholder="Ej. Asamblea de circuito"></label>
    <div class="grid2"><label class="f"><span>Fecha (opcional)</span><input type="date" name="fecha"></label>
      <label class="f"><span>Hora (opcional)</span><input type="text" name="hora" maxlength="20" placeholder="Ej. 9:00 a. m."></label></div>
    <label class="f"><span>Detalles</span><textarea name="texto" maxlength="3000" placeholder="Lugar, horario, qué llevar…"></textarea></label>
    <label class="f"><span>Imagen o PDF (opcional)</span><input type="file" name="archivo" accept="image/*,application/pdf"></label>
    <button class="btn btn-primary btn-block" id="bAnu">Publicar anuncio</button>
  </form>
  <div class="h-sec">Anuncios activos</div>
  ${DATA.anuncios.length ? `<div class="lista">${DATA.anuncios.map(a => `<div class="item">
    <div class="grow"><div class="t">${esc(a.titulo)}</div><div class="small muted">${esc(TIPOS_ANUNCIO[a.tipo] || '')}${a.fecha ? ' · ' + esc(fmtLarga(a.fecha)) : ''}</div></div>
    <button class="x" aria-label="Eliminar" onclick="borrarAnuncio('${esc(a.id)}')">✕</button></div>`).join('')}</div>` : '<div class="empty">No hay anuncios.</div>'}
  <p class="small muted">Los anuncios con fecha desaparecen solos 3 días después; los que no tienen fecha, después de 45 días.</p>`;
}
async function guardarAnuncio(e) {
  e.preventDefault();
  const f = e.target, b = $('#bAnu');
  b.disabled = true; b.textContent = 'Publicando…';
  try {
    const arch = f.archivo.files[0] ? await prepararArchivo(f.archivo.files[0]) : {};
    await post('guardarAnuncio', { tipo: f.tipo.value, titulo: f.titulo.value.trim(), fecha: f.fecha.value, hora: f.hora.value.trim(), texto: f.texto.value.trim(), ...arch });
    await recargarData(); render(); toast('Anuncio publicado', 'ok');
  } catch (err) { toast(err.message, 'err'); b.disabled = false; b.textContent = 'Publicar anuncio'; }
}
async function borrarAnuncio(id) {
  if (!await confirmar('¿Eliminar este anuncio?')) return;
  try { await post('borrarAnuncio', { id }); await recargarData(); render(); } catch (e) { toast(e.message, 'err'); }
}

/* ---------- Asignaciones (para "Mis asignaciones" y recordatorios) ---------- */
function vAsignaciones() {
  const sec = sesion.get('asig_seccion', 'entresemana');
  const h = hoy();
  const lista = ASIG.filter(a => a.fecha >= h && (!filtroAsig || a.seccion === filtroAsig));
  const porDia = {}; lista.forEach(a => (porDia[a.fecha] ||= []).push(a));
  return `<h1 class="titulo-vista">Asignaciones</h1>
  <p class="small muted" style="margin-top:-6px">Con estos datos cada hermano ve "Mis asignaciones" y recibe su recordatorio el lunes.</p>
  <form class="card" id="fAsig" onsubmit="agregarAsig(event)">
    <div class="grid2 resp">
      <label class="f"><span>Sección</span><select name="seccion" onchange="sesion.set('asig_seccion',this.value);$('#dlAsig').innerHTML=sugerencias(this.value)">${opcionesSeccion(sec)}</select></label>
      <label class="f"><span>Fecha</span><input type="date" name="fecha" required value="${esc(sesion.get('asig_fecha', ''))}"></label>
    </div>
    <label class="f"><span>Asignación</span><input type="text" name="asignacion" list="dlAsig" required maxlength="150" placeholder="Ej. Lectura de la Biblia"></label>
    <label class="f"><span>Hermano(s) — si son dos, sepárelos con /</span><input type="text" name="hermano" list="dlHer" required maxlength="160" placeholder="Ej. Elsa de Yax / Mercy de Caná"></label>
    <datalist id="dlAsig">${sugerencias(sec)}</datalist>
    <datalist id="dlHer">${(HER || []).map(x => `<option value="${esc(x.nombre)}">`).join('')}</datalist>
    <button class="btn btn-primary btn-block" id="bAsig">Agregar</button>
  </form>
  <details class="card">
    <summary>Agregar varias a la vez</summary>
    <p class="small muted">Una por línea: <code class="k">fecha ; asignación ; hermano</code>. La fecha puede ser 21/11 o 21/11/2026. Se usa la sección elegida arriba.</p>
    <textarea id="bulk" placeholder="19/11 ; Presidente ; Nelson Flores&#10;19/11 ; Lectura de la Biblia ; Saul Caro&#10;19/11 ; Empecemos conversaciones ; Elsa de Yax / Mercy de Caná"></textarea>
    <button class="btn btn-primary" style="margin-top:10px" onclick="agregarBulk()">Agregar todas</button>
  </details>
  <div class="h-sec">Próximas <span><select onchange="filtroAsig=this.value;irA('asignaciones')" style="width:auto;padding:5px 8px;font-size:.85rem">
    <option value="">Todas las secciones</option>${opcionesSeccion(filtroAsig)}</select></span></div>
  ${lista.length ? Object.keys(porDia).sort().map(f => `<div class="dia"><div class="dia-h">${esc(fmtLarga(f))}</div><div class="lista">
    ${porDia[f].map(a => `<div class="item"><div class="grow"><div class="t">${esc(a.asignacion)}</div><div class="small muted">${esc(a.hermano)}</div></div>
    ${chipSeccion(a.seccion)}<button class="x" aria-label="Eliminar" onclick="borrarAsig('${esc(a.id)}')">✕</button></div>`).join('')}</div></div>`).join('')
    : '<div class="empty">No hay asignaciones próximas registradas.</div>'}`;
}
const sugerencias = sec => (SUGERENCIAS_ASIGNACION[sec] || []).map(s => `<option value="${esc(s)}">`).join('');
async function agregarAsig(e) {
  e.preventDefault();
  const f = e.target, b = $('#bAsig');
  b.disabled = true;
  try {
    sesion.set('asig_fecha', f.fecha.value);
    const n = await post('agregarAsignaciones', { items: [{ fecha: f.fecha.value, seccion: f.seccion.value, asignacion: f.asignacion.value.trim(), hermano: f.hermano.value.trim() }] });
    ASIG = await post('listarAsignaciones'); await recargarData();
    toast(`Agregada (${n.length})`, 'ok');
    render().then(() => { const i = $('#fAsig [name=asignacion]'); if (i) i.focus(); });
  } catch (err) { toast(err.message, 'err'); b.disabled = false; }
}
function parseFecha(t) {
  t = t.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${z2(m[2])}-${z2(m[3])}`;
  m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/);
  if (!m) return null;
  const now = new Date();
  let y = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : now.getFullYear();
  if (!m[3] && Number(m[2]) < now.getMonth() + 1 - 2) y++; // ej. en diciembre se escribe "5/1"
  const d = Number(m[1]), mo = Number(m[2]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${z2(mo)}-${z2(d)}`;
}
async function agregarBulk() {
  const sec = $('#fAsig [name=seccion]').value;
  const items = [], malas = [];
  $('#bulk').value.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
    const p = l.split(/\s*[;|\t]\s*/);
    const fecha = parseFecha(p[0] || '');
    if (!fecha || p.length < 3 || !p[1] || !p[2]) malas.push(l);
    else items.push({ fecha, seccion: sec, asignacion: p[1], hermano: p.slice(2).join(' / ') });
  });
  if (malas.length) return toast(`Revise ${malas.length} línea(s): "${malas[0]}"`, 'err');
  if (!items.length) return toast('Escriba al menos una línea', 'err');
  try {
    const n = await post('agregarAsignaciones', { items });
    ASIG = await post('listarAsignaciones'); await recargarData();
    toast(`${n.length} asignaciones agregadas`, 'ok'); render();
  } catch (e) { toast(e.message, 'err'); }
}
async function borrarAsig(id) {
  try { await post('borrarAsignacion', { id }); ASIG = ASIG.filter(a => a.id !== id); await recargarData(); render(); } catch (e) { toast(e.message, 'err'); }
}

/* ---------- Territorios: el encargado programa las salidas ---------- */
let AM = null, PUNTO = null;
function vTerritorios() {
  const sal = (DATA.salidas || []).filter(x => x.fecha >= hoy());
  const nums = Mapa.numeros();
  return `<h1 class="titulo-vista">Territorios</h1>
  <p class="small muted" style="margin-top:-6px">Programe qué territorio se predicará. Los publicadores lo verán en el mapa y el conductor recibirá su recordatorio.</p>
  <form class="card" id="fSal" onsubmit="guardarSalida(event)">
    <div class="grid2"><label class="f"><span>Fecha</span><input type="date" name="fecha" required value="${esc(hoy())}"></label>
      <label class="f"><span>Hora</span><input type="text" name="hora" maxlength="20" placeholder="Ej. 9:00 a. m."></label></div>
    <div class="grid2 resp"><label class="f"><span>Territorio</span><select name="territorio" id="sTerr">${nums.map(n => `<option value="${esc(n)}">Territorio ${esc(n)}</option>`).join('')}</select></label>
      <label class="f"><span>Conductor</span><input type="text" name="conductor" list="dlHerT" maxlength="80"></label></div>
    <datalist id="dlHerT">${(HER || []).map(x => `<option value="${esc(x.nombre)}">`).join('')}</datalist>
    <label class="f"><span>Punto de encuentro</span><input type="text" name="punto" maxlength="150" placeholder="Ej. Salón del Reino, casa de la familia Yax"></label>
    <div class="mapa-wrap"><div id="aMapa" class="mapa chico"></div>
      <div class="mapa-btns"><button type="button" class="btn btn-sm" onclick="puntoDesdeGps()"><span class="ico">${ICON.gps}</span>Usar mi ubicación</button></div></div>
    <p class="small muted" id="puntoTxt" style="margin-top:-4px">Toque el mapa para marcar el punto de encuentro (opcional).</p>
    <label class="f"><span>Nota (opcional)</span><textarea name="nota" maxlength="500" style="min-height:60px" placeholder="Ej. Llevar tratados de la campaña"></textarea></label>
    <button class="btn btn-primary btn-block" id="bSal">Programar salida</button>
  </form>
  ${(DATA.puntos || []).length ? `<div class="h-sec">Puntos de predicación activos</div><div class="lista" style="margin-bottom:8px">${DATA.puntos.map(pt => `<div class="item">
      <div class="grow"><div class="t">${esc(pt.nombre)}</div><div class="small muted">${pt.territorio ? 'Territorio ' + esc(pt.territorio) + ' · ' : ''}${esc(haceCuanto(pt.actualizado))}${pt.nota ? ' · ' + esc(pt.nota) : ''}</div></div>
      <button class="x" aria-label="Quitar punto" onclick="borrarPunto('${esc(pt.id)}')">✕</button></div>`).join('')}</div>
    <p class="small muted">Los publicadores marcan estos puntos desde su app; desaparecen solos después de 8 horas.</p>` : ''}
  <div class="h-sec">Salidas programadas</div>
  ${sal.length ? `<div class="lista">${sal.map(x => `<div class="item">
      <div class="grow"><div class="t">Territorio ${esc(x.territorio)} · <span class="cap" style="display:inline-block">${esc(fmtFecha(x.fecha))}</span>${x.hora ? ' · ' + esc(x.hora) : ''}</div>
      <div class="small muted">${esc(x.conductor || 'Sin conductor')}${x.punto ? ' · ' + esc(x.punto) : ''}</div></div>
      <button class="btn btn-sm btn-wa" onclick="compartirSalidaAdmin('${esc(x.id)}')">Avisar</button>
      <button class="x" aria-label="Eliminar" onclick="borrarSalida('${esc(x.id)}')">✕</button></div>`).join('')}</div>`
    : '<div class="empty">No hay salidas programadas.</div>'}`;
}
function initTerritorios() {
  PUNTO = null;
  AM = Mapa.crear($('#aMapa'), { onMapa: ll => ponerPunto(ll.lat, ll.lng) });
  const sel = $('#sTerr');
  sel.onchange = () => AM.seleccionar(sel.value);
  AM.seleccionar(sel.value);
}
function ponerPunto(lat, lng) {
  PUNTO = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
  AM.marcarPunto(PUNTO.lat, PUNTO.lng);
  const t = Mapa.territorioDe(PUNTO.lat, PUNTO.lng);
  $('#puntoTxt').innerHTML = `Punto marcado${t != null ? ' (en el territorio ' + esc(t) + ')' : ''}. <a href="#" onclick="event.preventDefault();PUNTO=null;AM.marcarPunto(null);this.parentNode.textContent='Toque el mapa para marcar el punto de encuentro (opcional).'">Quitar</a>`;
}
function puntoDesdeGps() {
  if (!navigator.geolocation) return toast('GPS no disponible', 'err');
  toast('Buscando su ubicación…');
  navigator.geolocation.getCurrentPosition(p => { ponerPunto(p.coords.latitude, p.coords.longitude); AM.map.setView([p.coords.latitude, p.coords.longitude], 17); },
    () => toast('No se pudo obtener la ubicación. Revise el permiso del GPS.', 'err'), { enableHighAccuracy: true, timeout: 30000 });
}
async function guardarSalida(e) {
  e.preventDefault();
  const f = e.target, b = $('#bSal');
  b.disabled = true;
  try {
    await post('guardarSalida', { fecha: f.fecha.value, hora: f.hora.value.trim(), territorio: f.territorio.value, conductor: f.conductor.value.trim(), punto: f.punto.value.trim(), nota: f.nota.value.trim(), lat: PUNTO ? PUNTO.lat : '', lng: PUNTO ? PUNTO.lng : '' });
    await recargarData(); toast('Salida programada', 'ok'); render();
  } catch (err) { toast(err.message, 'err'); b.disabled = false; }
}
async function borrarSalida(id) {
  if (!await confirmar('¿Eliminar esta salida programada?')) return;
  try { await post('borrarSalida', { id }); await recargarData(); render(); } catch (e) { toast(e.message, 'err'); }
}
async function borrarPunto(id) {
  if (!await confirmar('¿Quitar este punto del mapa para todos?', 'Quitar')) return;
  try { await post('borrarPunto', { id }); await recargarData(); render(); } catch (e) { toast(e.message, 'err'); }
}
function compartirSalidaAdmin(id) {
  const x = (DATA.salidas || []).find(s => s.id === id); if (!x) return;
  const c = x.lat && x.lng ? { lat: x.lat, lng: x.lng } : Mapa.centro(x.territorio);
  hojaCompartir('Avisar salida', `Salida a predicar — ${fmtLarga(x.fecha)}${x.hora ? ', ' + x.hora : ''}\nTerritorio ${x.territorio}` +
    (x.conductor ? `\nConductor: ${x.conductor}` : '') + (x.punto ? `\nPunto de encuentro: ${x.punto}` : '') + (x.nota ? `\n${x.nota}` : '') +
    (c ? `\nUbicación: ${Mapa.enlaceMapa(c.lat, c.lng)}` : '') + `\nVer el territorio: ${Mapa.enlaceApp(x.territorio)}`);
}

/* ---------- Recordatorios ---------- */
function numeroWa(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 8) d = (CFG.CODIGO_PAIS || '502') + d;
  return d;
}
function mensajeHermano(g) {
  return `Hola, ${g.hermano}. Le recordamos sus asignaciones de esta semana en la congregación ${CFG.CONGREGACION || ''}:\n\n` +
    g.items.map(i => `• ${fmtLarga(i.fecha)}: ${i.asignacion} (${SECCIONES[i.seccion]?.nombre || ''})`).join('\n') +
    `\n\n¡Muchas gracias por su apoyo!`;
}
function resumenSemana() {
  const items = REC.lista.flatMap(g => g.items.map(i => ({ ...i, hermano: g.hermano })));
  const porDia = {}; items.forEach(i => (porDia[i.fecha] ||= []).push(i));
  return `*Asignaciones · ${fmtRango(REC.inicio, REC.fin)}*\n` + Object.keys(porDia).sort().map(f =>
    `\n*${fmtLarga(f)}*\n` + porDia[f].map(i => `• ${i.asignacion}: ${i.hermano}`).join('\n')).join('\n');
}
function vRecordatorios() {
  const l = REC.lista;
  const conCorreo = l.filter(g => g.email).length;
  return `<h1 class="titulo-vista">Recordatorios</h1>
  <div class="seg">${['Esta semana', 'Próxima semana'].map((t, i) => `<button class="${recSemana === i ? 'on' : ''}" onclick="recSemana=${i};render()">${t}</button>`).join('')}</div>
  <div class="card flat small">
    <b>${esc(fmtRango(REC.inicio, REC.fin))}</b> · ${l.length} hermano(s) con asignación.<br>
    Cada <b>lunes a las 7:00 a. m.</b> se envía un correo automático a quienes tienen correo registrado (${conCorreo}).
    Para WhatsApp, toque el botón verde de cada hermano: se abre el mensaje listo para enviar.
  </div>
  ${l.length ? `<div class="row" style="margin-bottom:12px">
      <button class="btn" onclick="copiarResumen()">Copiar resumen para el grupo</button>
      <button class="btn" onclick="enviarCorreosAhora()" ${conCorreo ? '' : 'disabled'}>Enviar correos ahora</button></div>
    <div class="lista">${l.map((g, i) => `<div class="item" style="align-items:flex-start">
      <div class="grow"><div class="t">${esc(g.hermano)}</div>
        ${g.items.map(it => `<div class="small muted">${esc(fmtFecha(it.fecha))} · ${esc(it.asignacion)}</div>`).join('')}
        <div class="small" style="margin-top:4px">${g.email ? '✉️ ' + esc(g.email) : '<span class="muted">Sin correo</span>'}${g.telefono ? '' : ' · <span class="muted">sin WhatsApp</span>'}</div></div>
      <a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="https://wa.me/${numeroWa(g.telefono)}?text=${encodeURIComponent(mensajeHermano(g))}">
        <span class="ico">${ICON.wa}</span>WhatsApp</a></div>`).join('')}</div>`
    : '<div class="empty">No hay asignaciones registradas para esta semana.<br><button class="btn btn-sm" style="margin-top:10px" onclick="irA(\'asignaciones\')">Agregar asignaciones</button></div>'}
  <p class="small muted">Si un hermano no tiene número registrado, WhatsApp le pedirá elegir el contacto. Agregue números y correos en la pestaña Hermanos.</p>`;
}
async function copiarResumen() {
  const t = resumenSemana();
  try { await navigator.clipboard.writeText(t); toast('Resumen copiado. Péguelo en el grupo de WhatsApp.', 'ok'); }
  catch (e) { const d = document.createElement('div'); d.className = 'modal'; d.innerHTML = '<div class="modal-box"><p>Seleccione y copie el texto:</p><textarea class="copia" readonly></textarea><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn btn-primary">Cerrar</button></div></div>'; $('textarea', d).value = t; $('button', d).onclick = () => d.remove(); document.body.appendChild(d); $('textarea', d).select(); }
}
async function enviarCorreosAhora() {
  if (!await confirmar('¿Enviar ahora los correos de recordatorio de esta semana?')) return;
  try {
    const r = await post('enviarCorreos', { semana: recSemana });
    toast(r.demo ? 'En la demostración no se envían correos' : `Correos enviados: ${r.enviados}`, 'ok');
  } catch (e) { toast(e.message, 'err'); }
}

/* ---------- Preguntas ---------- */
function vPreguntas() {
  if (!PREG.length) return `<h1 class="titulo-vista">Preguntas</h1><div class="empty">No hay preguntas de los publicadores.</div>`;
  return `<h1 class="titulo-vista">Preguntas</h1>${PREG.map(q => `<div class="card preg ${q.estado === 'respondida' ? 'ok' : ''}">
    <div class="row"><span class="chip ${q.estado === 'respondida' ? 'ok' : 'warn'}">${q.estado === 'respondida' ? 'Respondida' : 'Pendiente'}</span>
      <span class="small muted grow">${esc(q.nombre || 'Anónimo')} → ${esc(q.anciano || 'cualquier anciano')} · ${esc(fmtFecha((q.fecha || '').slice(0, 10)))}</span>
      <button class="x" aria-label="Eliminar" onclick="borrarPreg('${esc(q.id)}')">✕</button></div>
    <p class="pre" style="margin:10px 0 0">${esc(q.pregunta)}</p>
    ${q.estado === 'respondida'
      ? `<div class="respuesta small pre"><b>Respuesta:</b> ${esc(q.respuesta || '(respondida en persona)')}</div>`
      : `<form onsubmit="responder(event,'${esc(q.id)}')" style="margin-top:10px">
          <textarea name="r" placeholder="Respuesta (opcional: el publicador la verá en su teléfono)" style="min-height:70px"></textarea>
          <button class="btn btn-primary btn-sm" style="margin-top:8px">Marcar como respondida</button></form>`}
  </div>`).join('')}`;
}
async function responder(e, id) {
  e.preventDefault();
  try { await post('responderPregunta', { id, respuesta: e.target.r.value.trim() }); PREG = await post('listarPreguntas'); actualizarBadge(); render(); toast('Guardado', 'ok'); }
  catch (err) { toast(err.message, 'err'); }
}
async function borrarPreg(id) {
  if (!await confirmar('¿Eliminar esta pregunta?')) return;
  try { await post('borrarPregunta', { id }); PREG = PREG.filter(q => q.id !== id); actualizarBadge(); render(); } catch (e) { toast(e.message, 'err'); }
}

/* ---------- Hermanos ---------- */
function vHermanos() {
  return `<h1 class="titulo-vista">Hermanos</h1>
  <p class="small muted" style="margin-top:-6px">Números de WhatsApp y correos para los recordatorios. Escriba el nombre igual que en las asignaciones.</p>
  <form class="card" id="fHer" onsubmit="guardarHer(event)">
    <label class="f"><span>Nombre</span><input type="text" name="nombre" required maxlength="80"></label>
    <div class="grid2 resp"><label class="f"><span>WhatsApp</span><input type="tel" name="telefono" maxlength="30" placeholder="5555 1234"></label>
      <label class="f"><span>Correo</span><input type="email" name="email" maxlength="120" placeholder="nombre@gmail.com"></label></div>
    <button class="btn btn-primary btn-block">Guardar</button>
  </form>
  <div class="h-sec">${HER.length} registrados</div>
  ${HER.length ? `<div class="lista">${HER.map(x => `<div class="item"><div class="grow" style="cursor:pointer" onclick="editarHer('${esc(x.nombre).replace(/'/g, '&#39;')}')">
      <div class="t">${esc(x.nombre)}</div><div class="small muted">${esc(x.telefono || 'sin WhatsApp')} · ${esc(x.email || 'sin correo')}</div></div>
      <button class="x" aria-label="Eliminar" onclick="borrarHer('${esc(x.nombre).replace(/'/g, '&#39;')}')">✕</button></div>`).join('')}</div>`
    : '<div class="empty">Aún no hay hermanos registrados.</div>'}`;
}
function editarHer(n) {
  const x = HER.find(h => h.nombre === n); if (!x) return;
  const f = $('#fHer'); f.nombre.value = x.nombre; f.telefono.value = x.telefono; f.email.value = x.email;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function guardarHer(e) {
  e.preventDefault();
  const f = e.target;
  try { await post('guardarHermano', { nombre: f.nombre.value.trim(), telefono: f.telefono.value.trim(), email: f.email.value.trim() }); HER = await post('listarHermanos'); render(); toast('Guardado', 'ok'); }
  catch (err) { toast(err.message, 'err'); }
}
async function borrarHer(n) {
  if (!await confirmar(`¿Eliminar a ${n} de la lista?`)) return;
  try { await post('borrarHermano', { nombre: n }); HER = await post('listarHermanos'); render(); } catch (e) { toast(e.message, 'err'); }
}

/* ---------- Arranque ---------- */
if (PASS) post('login').then(iniciar).catch(() => salir());
else vLogin();
