/* Panel de ancianos */
let PASS = sesion.get('pass', '') || store.get('pass', '');
let DATA = null, ASIG = null, HER = null, PREG = null, REC = null;
let vista = sesion.get('vista', 'subir');
let recSemana = 0, filtroAsig = '';
const VISTAS = [
  ['subir', 'Subir programa'], ['publicado', 'Publicado'], ['anuncios', 'Anuncios'],
  ['tablas', 'Programas del mes'], ['asignaciones', 'Asignaciones'], ['territorios', 'Territorios'], ['recordatorios', 'Recordatorios'], ['preguntas', 'Preguntas'], ['hermanos', 'Hermanos'], ['zoom', 'Zoom'], ['ajustes', 'Ajustes']
];
let HIST = null;
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
    <p class="small muted" style="margin-bottom:0"><a href="../publicadores/">← Ir a la app de publicadores</a></p></div>`;
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
function salir() { PASS = ''; API.clave = ''; sesion.del('pass'); store.del('pass'); vLogin(); }

async function iniciar() {
  API.clave = PASS;
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
    else if (vista === 'anuncios') { app.innerHTML = vAnuncios(); initAnuncios(); }
    else if (vista === 'asignaciones') { if (!ASIG || !HIST) { app.innerHTML = '<div class="skeleton"></div>'; ASIG ||= await post('listarAsignaciones'); HER ||= await post('listarHermanos'); HIST ||= await post('historial'); } app.innerHTML = vAsignaciones(); }
    else if (vista === 'zoom') { app.innerHTML = vZoom(); initZoom(); }
    else if (vista === 'tablas') { app.innerHTML = '<div class="skeleton"></div>'; HER ||= await post('listarHermanos'); app.innerHTML = vTablas(); cargarEditor(); }
    else if (vista === 'ajustes') { app.innerHTML = '<div class="skeleton"></div>'; app.innerHTML = vAjustes(await post('ajustes')); }
    else if (vista === 'hermanos') { if (!HER) { app.innerHTML = '<div class="skeleton"></div>'; HER = await post('listarHermanos'); } app.innerHTML = vHermanos(); }
    else if (vista === 'preguntas') app.innerHTML = vPreguntas();
    else if (vista === 'territorios') { app.innerHTML = '<div class="skeleton"></div>'; await Mapa.territorios(); HER ||= await post('listarHermanos'); HIST ||= await post('historial'); app.innerHTML = vTerritorios(); initTerritorios(); }
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
    <p class="small muted" id="ayudaPdf" style="margin:-4px 0 12px">Reunión de entre semana: si sube el <b>PDF</b> del programa, la app lo separa por semana y crea las asignaciones de cada hermano.</p>
    <div id="camposNormales">
    <div class="grid2 resp">
      <label class="f"><span>Válido desde</span><input type="date" name="fechaInicio" id="dIni" required></label>
      <label class="f"><span>Hasta</span><input type="date" name="fechaFin" id="dFin" required></label>
    </div>
    <label class="f"><span>Título</span><input type="text" name="titulo" id="tTit" maxlength="150" required></label>
    <label class="f"><span>Nota para los publicadores (opcional)</span><textarea name="nota" maxlength="500" style="min-height:64px" placeholder="Ej. Recuerden llegar 15 minutos antes."></textarea></label>
    </div>
    <label class="drop" id="drop"><input type="file" name="archivo" id="fArch" accept="image/*,application/pdf" required>
      <span id="dropTxt">Toque para elegir la imagen o el PDF del programa</span></label>
    <div class="preview" id="prev"></div>
    <div id="progPrev"></div>
    <button class="btn btn-primary btn-block" id="bSubir" style="margin-top:14px">Publicar</button>
  </form>
  <p class="small muted">Las imágenes grandes se reducen automáticamente para que carguen rápido en los teléfonos.</p>`;
}
function initSubir() {
  const sSec = $('#sSec'), tTit = $('#tTit'), dIni = $('#dIni'), dFin = $('#dFin');
  tTit.dataset.auto = '1';
  const ponerFechas = () => { const r = rangoPorDefecto(sSec.value); dIni.value = r.inicio; dFin.value = r.fin; ponerTitulo(); };
  const ponerTitulo = () => { if (tTit.dataset.auto) tTit.value = `${SECCIONES[sSec.value].nombre} — ${fmtRango(dIni.value, dFin.value)}`; };
  sSec.onchange = () => { sesion.set('ult_seccion', sSec.value); ponerFechas(); $('#ayudaPdf').hidden = sSec.value !== 'entresemana'; revisarPdf(); };
  $('#ayudaPdf').hidden = sSec.value !== 'entresemana';
  dIni.onchange = dFin.onchange = ponerTitulo;
  tTit.oninput = () => { delete tTit.dataset.auto; };
  ponerFechas();
  $('#fArch').onchange = e => {
    const f = e.target.files[0];
    $('#drop').classList.toggle('has', !!f);
    $('#dropTxt').textContent = f ? `✓ ${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB) · tocar para cambiar` : 'Toque para elegir la imagen o el PDF del programa';
    $('#prev').innerHTML = f && f.type.startsWith('image/') ? `<img src="${URL.createObjectURL(f)}" alt="Vista previa">` : '';
    revisarPdf();
  };
}

/* ---------- Programa en PDF: separar por semana ---------- */
let PROG_LEIDO = null;
function modoPrograma(on) {
  $('#camposNormales').hidden = on;
  $$('#camposNormales [required]').forEach(i => { i.required = !on; i.dataset.req = '1'; });
  if (!on) $$('#camposNormales [data-req]').forEach(i => { i.required = true; });
}
async function revisarPdf() {
  const f = $('#fArch').files[0], box = $('#progPrev'), b = $('#bSubir');
  PROG_LEIDO = null; modoPrograma(false); box.innerHTML = ''; b.textContent = 'Publicar';
  if (!f || $('#sSec').value !== 'entresemana' || !/pdf/i.test(f.type || f.name)) return;
  box.innerHTML = '<div class="hist">Leyendo el programa…</div>';
  try {
    const semanas = await Programa.desdeArchivo(f);
    if (!semanas.length) { box.innerHTML = '<div class="hist alerta">No se reconoció el formato del programa. Se publicará como PDF normal.</div>'; return; }
    PROG_LEIDO = semanas;
    modoPrograma(true);
    box.innerHTML = `<div class="card flat" style="margin-top:12px">
      <b>Se encontraron ${semanas.length} semanas</b>
      <p class="small muted" style="margin:4px 0 10px">Cada semana se mostrará por separado; los publicadores verán la semana actual. Si una semana ya estaba publicada, se reemplaza.</p>
      ${semanas.map((x, i) => `<div class="item" style="padding:9px 2px">
        <input type="checkbox" class="semSel" value="${i}" ${x.fin >= hoy() ? 'checked' : ''} aria-label="Publicar semana del ${esc(fmtFecha(x.fecha))}">
        <div class="grow"><div class="t cap">${esc(fmtFecha(x.fecha, { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
        <div class="small muted">${esc(x.lectura)} · Presidente ${esc(x.presidente || '—')} · ${Programa.asignaciones(x).length} asignaciones</div></div>
        <button type="button" class="btn btn-sm" onclick="verProgramaModal(PROG_LEIDO[${i}])">Ver</button></div>`).join('')}
      <label class="small row" style="gap:8px;margin-top:10px"><input type="checkbox" id="cAsigProg" checked> Crear las asignaciones de cada hermano (Mis asignaciones, recordatorios e historial)</label>
      <label class="small row" style="gap:8px;margin-top:6px"><input type="checkbox" id="cPdfProg"> Guardar también el PDF completo</label>
    </div>`;
    const contar = () => { const n = $$('.semSel:checked').length; b.textContent = n ? `Publicar ${n} semana${n === 1 ? '' : 's'}` : 'Elija al menos una semana'; };
    $$('.semSel').forEach(c => c.onchange = contar); contar();
  } catch (err) {
    box.innerHTML = `<div class="hist alerta">No se pudo leer el PDF (${esc(err.message)}). Se publicará como PDF normal.</div>`;
  }
}
function verProgramaModal(sem) {
  const d = document.createElement('div');
  d.className = 'modal';
  d.innerHTML = `<div class="modal-box modal-ancho">${Programa.html(sem)}<button class="btn btn-block" style="margin-top:10px">Cerrar</button></div>`;
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('button')) d.remove(); });
  document.body.appendChild(d);
}
async function publicarPrograma(b) {
  const sel = $$('.semSel:checked').map(c => PROG_LEIDO[+c.value]);
  if (!sel.length) return toast('Elija al menos una semana', 'err');
  const conAsig = $('#cAsigProg').checked, conPdf = $('#cPdfProg').checked;
  b.disabled = true; b.textContent = 'Publicando…';
  try {
    const r = await post('guardarProgramas', {
      programas: sel.map(x => ({ fecha: x.fecha, inicio: x.inicio, fin: x.fin, lectura: x.lectura, presidente: x.presidente, items: x.items })),
      conAsignaciones: conAsig, asignaciones: conAsig ? sel.flatMap(Programa.asignaciones) : []
    });
    if (conPdf) {
      const arch = await prepararArchivo($('#fArch').files[0]);
      const ini = sel.map(x => x.inicio).sort()[0], fin = sel.map(x => x.fin).sort().pop();
      await post('subir', { seccion: 'entresemana', titulo: `Programa completo — ${fmtRango(ini, fin)}`, fechaInicio: ini, fechaFin: fin, nota: '', ...arch });
    }
    ASIG = null; HIST = null; await recargarData();
    toast('Programa publicado', 'ok');
    $('#app').innerHTML = `<div class="card" style="text-align:center">
      <h2 style="font-size:1.15rem">✓ ${r.semanas} semana${r.semanas === 1 ? '' : 's'} publicada${r.semanas === 1 ? '' : 's'}</h2>
      <p class="muted small">${conAsig ? `Se crearon ${r.asignaciones} asignaciones: cada hermano ya las ve en "Mis asignaciones" y recibirá su recordatorio el lunes.` : 'No se crearon asignaciones.'}</p>
      <div class="row" style="justify-content:center"><button class="btn" onclick="irA('publicado')">Ver lo publicado</button><button class="btn" onclick="render()">Subir otro</button></div></div>`;
  } catch (err) { toast(err.message, 'err'); b.disabled = false; b.textContent = 'Publicar'; }
}
async function subir(e) {
  e.preventDefault();
  const f = e.target, b = $('#bSubir');
  if (PROG_LEIDO) return publicarPrograma(b);
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
  const pubs = DATA.publicaciones, progs = DATA.programas || [];
  if (!pubs.length && !progs.length) return `<h1 class="titulo-vista">Publicado</h1><div class="empty">Aún no hay programas.</div>`;
  return `<h1 class="titulo-vista">Publicado</h1>
  ${progs.length ? `<div class="h-sec">Reunión de entre semana · por semana</div><div class="lista">${progs.map(x => `<div class="item">
      <div class="grow" style="cursor:pointer" onclick="verProgramaModal((DATA.programas||[]).find(p=>p.id==='${esc(x.id)}'))"><div class="t cap">${esc(fmtFecha(x.fecha, { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
      <div class="small muted">${esc(x.lectura)} · Presidente ${esc(x.presidente || '—')}${x.inicio <= hoy() && x.fin >= hoy() ? ' · <b style="color:var(--ok)">esta semana</b>' : ''}</div></div>
      <button class="btn btn-sm" onclick="editarPrograma('${esc(x.id)}')">Editar</button>
      <button class="x" aria-label="Eliminar semana" onclick="borrarPrograma('${esc(x.id)}')">✕</button></div>`).join('')}</div>` : ''}
  ${Object.keys(SECCIONES).map(sec => {
    const l = pubs.filter(p => p.seccion === sec); if (!l.length) return '';
    return `<div class="h-sec">${esc(SECCIONES[sec].nombre)}</div><div class="lista">${l.map(p => `<div class="item">
      <div class="grow" style="cursor:pointer" onclick="abrirVisor(DATA.publicaciones.find(x=>x.id==='${esc(p.id)}'))">
        <div class="t">${esc(p.titulo)}</div><div class="small muted">${esc(fmtRango(p.fechaInicio, p.fechaFin))} ${vigente(p) ? '· <b style="color:var(--ok)">vigente</b>' : ''}${esPdf(p) ? ' · PDF' : ''}</div></div>
      <button class="x" title="Eliminar" aria-label="Eliminar" onclick="borrarPub('${esc(p.id)}')">✕</button></div>`).join('')}</div>`;
  }).join('')}`;
}
/* Editar las asignaciones de una semana del programa de entre semana */
function editarPrograma(id) {
  const x = (DATA.programas || []).find(p => p.id === id); if (!x) return;
  const p = JSON.parse(JSON.stringify(x));
  const d = document.createElement('div');
  d.className = 'modal';
  const campo = (lbl, val, attrs) => `<label class="f" style="margin-bottom:8px"><span>${lbl}</span><input type="text" list="dlNomP" value="${esc(val || '')}" ${attrs}></label>`;
  let html = campo('Presidente', p.presidente, 'data-k="pres"');
  p.items.forEach((it, i) => {
    if (it.t === 'seccion') html += `<div class="pg-sec" style="background:${it.color};border-radius:8px;margin:12px 0 8px">${esc(it.nombre)}</div>`;
    if (it.t === 'cancion' && it.oracion !== undefined && it.oracion !== '') html += campo(`Oración (${esc(it.texto.split(':')[0])})`, it.oracion, `data-i="${i}" data-k="oracion"`);
    if (it.t === 'parte') {
      const n = Math.max(1, it.personas.length);
      for (let j = 0; j < n; j++) html += campo(`${it.num}. ${esc(it.titulo)}${n > 1 ? (j ? ' — ayudante / lector' : ' — principal') : ''}`, it.personas[j], `data-i="${i}" data-j="${j}"`);
    }
  });
  const nombres = nombresConocidos();
  d.innerHTML = `<form class="modal-box modal-ancho" style="padding:16px">
    <h3 style="font-size:1.05rem;margin-bottom:4px">Editar semana del ${esc(fmtFecha(p.fecha, { weekday: 'long', day: 'numeric', month: 'long' }))}</h3>
    <p class="small muted" style="margin:0 0 12px">${esc(p.lectura)}. Al guardar se actualizan las asignaciones y los recordatorios de esa semana.</p>
    ${html}<datalist id="dlNomP">${nombres.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="row" style="justify-content:flex-end;position:sticky;bottom:0;background:#fff;padding-top:10px"><button type="button" class="btn" data-x>Cancelar</button><button class="btn btn-primary">Guardar cambios</button></div></form>`;
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-x]')) d.remove(); });
  $('form', d).onsubmit = async e => {
    e.preventDefault();
    $$('input', d).forEach(inp => {
      const v = inp.value.trim();
      if (inp.dataset.k === 'pres') p.presidente = v;
      else if (inp.dataset.k === 'oracion') p.items[+inp.dataset.i].oracion = v;
      else if (inp.dataset.j !== undefined) { const it = p.items[+inp.dataset.i]; it.personas[+inp.dataset.j] = v; }
    });
    p.items.forEach(it => { if (it.t === 'parte') it.personas = it.personas.filter(Boolean); });
    const b = $('.btn-primary', d); b.disabled = true; b.textContent = 'Guardando…';
    try {
      await post('guardarProgramas', { programas: [{ fecha: p.fecha, inicio: p.inicio, fin: p.fin, lectura: p.lectura, presidente: p.presidente, items: p.items }], conAsignaciones: true, asignaciones: Programa.asignaciones(p) });
      ASIG = null; HIST = null; await recargarData(); d.remove(); toast('Semana actualizada', 'ok'); render();
    } catch (err) { toast(err.message, 'err'); b.disabled = false; b.textContent = 'Guardar cambios'; }
  };
  document.body.appendChild(d);
}
async function borrarPrograma(id) {
  if (!await confirmar('¿Eliminar esta semana del programa? También se borran las asignaciones que se crearon con ella.')) return;
  try { await post('borrarPrograma', { id }); ASIG = null; HIST = null; await recargarData(); render(); toast('Eliminado'); } catch (e) { toast(e.message, 'err'); }
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
    <label class="f"><span>Título</span><input type="text" name="titulo" required maxlength="150" placeholder="Ej. Asamblea de circuito con el superintendente de circuito"></label>
    <div class="grid2"><label class="f"><span>Fecha</span><input type="date" name="fecha" id="aFecha"></label>
      <label class="f"><span>Hasta (si dura varios días)</span><input type="date" name="fechaFin" id="aFin"></label></div>
    <label class="small row" style="gap:8px;margin:-4px 0 12px"><input type="checkbox" name="todoDia" id="aTodo"> Todo el día</label>
    <label class="f" id="aHoraBox"><span>Hora (opcional)</span><input type="text" name="hora" maxlength="20" placeholder="Ej. 7:00 p. m."></label>
    <label class="f"><span>Lugar (opcional)</span><input type="text" name="lugar" maxlength="200" placeholder="Ej. Salón de Asambleas de San Lucas Sacatepéquez"></label>
    <label class="f"><span>Detalles (opcional)</span><textarea name="texto" maxlength="3000" placeholder="Qué llevar, transporte, programa…"></textarea></label>
    <label class="f"><span>Imagen o PDF (opcional)</span><input type="file" name="archivo" accept="image/*,application/pdf"></label>
    <button class="btn btn-primary btn-block" id="bAnu">Publicar anuncio</button>
  </form>
  <div class="h-sec">Anuncios activos</div>
  ${DATA.anuncios.length ? `<div class="lista">${DATA.anuncios.map(a => `<div class="item">
    <div class="grow"><div class="t">${esc(a.titulo)}</div><div class="small muted">${esc(TIPOS_ANUNCIO[a.tipo] || '')}${a.fecha ? ' · ' + esc(fechaEvento(a)) : ''}${horarioEvento(a) ? ' · ' + esc(horarioEvento(a)) : ''}${a.lugar ? ' · ' + esc(a.lugar) : ''}</div></div>
    <button class="x" aria-label="Eliminar" onclick="borrarAnuncio('${esc(a.id)}')">✕</button></div>`).join('')}</div>` : '<div class="empty">No hay anuncios.</div>'}
  <p class="small muted">Los eventos se muestran agrupados por mes y desaparecen solos al día siguiente de terminar; los avisos sin fecha, después de 45 días.</p>`;
}
function initAnuncios() {
  const todo = $('#aTodo'), caja = $('#aHoraBox'), tipo = $('form [name=tipo]');
  todo.onchange = () => { caja.hidden = todo.checked; };
  // asambleas y visitas normalmente son de todo el día
  tipo.onchange = () => { todo.checked = ['asamblea', 'superintendente'].includes(tipo.value); todo.onchange(); };
  $('#aFecha').onchange = () => { $('#aFin').min = $('#aFecha').value; };
}
async function guardarAnuncio(e) {
  e.preventDefault();
  const f = e.target, b = $('#bAnu');
  b.disabled = true; b.textContent = 'Publicando…';
  try {
    const arch = f.archivo.files[0] ? await prepararArchivo(f.archivo.files[0]) : {};
    if (f.fechaFin.value && f.fecha.value && f.fechaFin.value < f.fecha.value) { b.disabled = false; b.textContent = 'Publicar anuncio'; return toast('La fecha "hasta" es antes de la fecha de inicio', 'err'); }
    await post('guardarAnuncio', { tipo: f.tipo.value, titulo: f.titulo.value.trim(), fecha: f.fecha.value, fechaFin: f.fechaFin.value, todoDia: f.todoDia.checked,
      hora: f.hora.value.trim(), lugar: f.lugar.value.trim(), texto: f.texto.value.trim(), ...arch });
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
    <label class="f"><span>Hermano(s) — si son dos, sepárelos con /</span><input type="text" name="hermano" list="dlHer" required maxlength="160" placeholder="Ej. Elsa de Yax / Mercy de Caná" oninput="$('#histHer').innerHTML=infoHermano(this.value)"></label>
    <div id="histHer"></div>
    <datalist id="dlAsig">${sugerencias(sec)}</datalist>
    <datalist id="dlHer">${(HER || []).map(x => `<option value="${esc(x.nombre)}">`).join('')}</datalist>
    <button class="btn btn-primary btn-block" id="bAsig">Agregar</button>
  </form>
  <details class="card">
    <summary>¿A quién le toca? Más tiempo sin asignación</summary>
    ${tablaEquilibrio()}
  </details>
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
/* ---------- Historial por hermano ---------- */
function historialDe(nombre) {
  const n = norm(nombre);
  return (HIST || []).filter(h => norm(h.hermano) === n).sort((a, b) => b.fecha.localeCompare(a.fecha));
}
function textoHace(fecha) {
  const d = Math.round((parseYmd(hoy()) - parseYmd(fecha)) / 864e5);
  return d === 0 ? 'hoy' : d > 0 ? `hace ${d} día${d === 1 ? '' : 's'}` : `en ${-d} día${d === -1 ? '' : 's'}`;
}
function infoHermano(valor) {
  const nombres = String(valor || '').split('/').map(x => x.trim()).filter(x => x.length >= 3);
  if (!nombres.length || !HIST) return '';
  return nombres.map(n => {
    const h = historialDe(n);
    if (!h.length) return `<div class="hist"><b>${esc(n)}</b>: sin asignaciones registradas en el último año.</div>`;
    const pasadas = h.filter(x => x.fecha <= hoy()), futuras = h.filter(x => x.fecha > hoy()).reverse();
    const ult = pasadas[0], prox = futuras[0];
    const desde90 = addDias(hoy(), -90);
    const cuenta = pasadas.filter(x => x.fecha >= desde90).length;
    const dias = f => Math.abs((parseYmd(hoy()) - parseYmd(f)) / 864e5);
    const cerca = (ult && dias(ult.fecha) <= 14) || (prox && dias(prox.fecha) <= 14);
    return `<div class="hist ${cerca ? 'alerta' : ''}"><b>${esc((ult || prox).hermano)}</b> ·
      ${ult ? `última: ${esc(fmtFecha(ult.fecha))} — ${esc(ult.asignacion)} (${textoHace(ult.fecha)})` : 'sin asignaciones pasadas en el último año'}.
      ${prox ? `Próxima: ${esc(fmtFecha(prox.fecha))} — ${esc(prox.asignacion)} (${textoHace(prox.fecha)}). ` : ''}
      ${cuenta} ${cuenta === 1 ? 'asignación' : 'asignaciones'} en los últimos 3 meses.${cerca ? ' <b>Tiene una asignación muy cerca.</b>' : ''}</div>`;
  }).join('');
}
function tablaEquilibrio() {
  const nombres = new Map();
  (HER || []).forEach(x => nombres.set(norm(x.nombre), x.nombre));
  (HIST || []).forEach(x => { if (!nombres.has(norm(x.hermano))) nombres.set(norm(x.hermano), x.hermano); });
  const filas = [...nombres.values()].map(n => {
    const pasadas = historialDe(n).filter(x => x.fecha <= hoy());
    const futuras = historialDe(n).filter(x => x.fecha > hoy());
    return { n, ult: pasadas[0], prox: futuras[futuras.length - 1] };
  }).filter(f => !f.prox).sort((a, b) => (a.ult ? a.ult.fecha : '0000').localeCompare(b.ult ? b.ult.fecha : '0000'));
  if (!filas.length) return '<p class="small muted">Registre hermanos o asignaciones para ver esta lista.</p>';
  return `<p class="small muted">Hermanos sin asignación próxima, empezando por quien lleva más tiempo sin una (incluye el archivo del último año).</p>
    <div class="lista">${filas.slice(0, 25).map(f => `<div class="item"><div class="grow"><div class="t">${esc(f.n)}</div>
      <div class="small muted">${f.ult ? `Última: ${esc(fmtFecha(f.ult.fecha))} — ${esc(f.ult.asignacion)} (${textoHace(f.ult.fecha)})` : 'Sin asignaciones en el último año'}</div></div>
      <button class="btn btn-sm" type="button" data-n="${esc(f.n)}" onclick="usarNombre(this.dataset.n)">Asignar</button></div>`).join('')}</div>`;
}

function usarNombre(n) {
  const i = $('#fAsig [name=hermano]'); if (!i) return;
  i.value = n; i.dispatchEvent(new Event('input'));
  i.scrollIntoView({ behavior: 'smooth', block: 'center' }); i.focus();
}
async function agregarAsig(e) {
  e.preventDefault();
  const f = e.target, b = $('#bAsig');
  b.disabled = true;
  try {
    sesion.set('asig_fecha', f.fecha.value);
    const n = await post('agregarAsignaciones', { items: [{ fecha: f.fecha.value, seccion: f.seccion.value, asignacion: f.asignacion.value.trim(), hermano: f.hermano.value.trim() }] });
    ASIG = await post('listarAsignaciones'); HIST = await post('historial'); await recargarData();
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
    ASIG = await post('listarAsignaciones'); HIST = await post('historial'); await recargarData();
    toast(`${n.length} asignaciones agregadas`, 'ok'); render();
  } catch (e) { toast(e.message, 'err'); }
}
async function borrarAsig(id) {
  try { await post('borrarAsignacion', { id }); ASIG = ASIG.filter(a => a.id !== id); HIST = null; await recargarData(); render(); } catch (e) { toast(e.message, 'err'); }
}

/* ---------- Territorios: el encargado programa las salidas ---------- */
let AM = null, PUNTO = null;
function vTerritorios() {
  const sal = salidasProximas(DATA.salidas);
  const nums = Mapa.numeros();
  const tipoSel = sesion.get('tipo_salida', 'casa');
  return `<h1 class="titulo-vista">Territorios y predicación</h1>
  <p class="small muted" style="margin-top:-6px">Programe los arreglos para la predicación (casa en casa, cartas, predicación pública…). Los publicadores los ven en Inicio y en el mapa, y el conductor recibe su recordatorio.</p>
  <form class="card" id="fSal" onsubmit="guardarSalida(event)">
    <label class="f"><span>Tipo de arreglo</span><select name="tipo" id="sTipo">${Object.entries(TIPOS_SALIDA).map(([k, t]) => `<option value="${k}" ${k === tipoSel ? 'selected' : ''}>${esc(t.nombre)}</option>`).join('')}</select></label>
    <div class="grid2"><label class="f"><span>Fecha</span><input type="date" name="fecha" required value="${esc(hoy())}"></label>
      <label class="f"><span>Horario</span><input type="text" name="hora" maxlength="30" placeholder="Ej. 3:45 a 6:00 p. m."></label></div>
    <label class="small row" style="gap:8px;margin:-4px 0 12px"><input type="checkbox" name="repetir" id="cRep"> Repetir cada semana</label>
    <div class="dias-sel" id="diasSel" hidden>${[1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" name="dia" value="${d}">${DIAS[d].slice(0, 3)}</label>`).join('')}</div>
    <div class="grid2 resp"><label class="f"><span>Territorio</span><select name="territorio" id="sTerr"><option value="">Sin territorio</option>${nums.map(n => `<option value="${esc(n)}">Territorio ${esc(n)}</option>`).join('')}</select></label>
      <label class="f"><span>Conductor (opcional)</span><input type="text" name="conductor" list="dlHerT" maxlength="80" oninput="$('#histCond').innerHTML=infoHermano(this.value)"></label></div>
    <div id="histCond"></div>
    <div id="estadoTerr"></div>
    <datalist id="dlHerT">${(HER || []).map(x => `<option value="${esc(x.nombre)}">`).join('')}</datalist>
    <label class="f"><span>Punto de encuentro</span><input type="text" name="punto" maxlength="150" placeholder="Ej. Salón del Reino" value="${tipoSel === 'casa' ? '' : 'Salón del Reino'}"></label>
    <div class="mapa-wrap"><div id="aMapa" class="mapa chico"></div>
      <div class="mapa-btns"><button type="button" class="btn btn-sm" onclick="puntoDesdeGps()"><span class="ico">${ICON.gps}</span>Usar mi ubicación</button></div></div>
    <p class="small muted" id="puntoTxt" style="margin-top:-4px">Toque el mapa para marcar el punto de encuentro (opcional).</p>
    <label class="f"><span>Nota (opcional)</span><textarea name="nota" maxlength="500" style="min-height:60px" placeholder="Ej. Llevar tratados de la campaña"></textarea></label>
    <button class="btn btn-primary btn-block" id="bSal">Programar arreglo</button>
  </form>
  ${(DATA.puntos || []).length ? `<div class="h-sec">Puntos de predicación activos</div><div class="lista" style="margin-bottom:8px">${DATA.puntos.map(pt => `<div class="item">
      <div class="grow"><div class="t">${esc(pt.nombre)}</div><div class="small muted">${pt.territorio ? 'Territorio ' + esc(pt.territorio) + ' · ' : ''}${esc(haceCuanto(pt.actualizado))}${pt.nota ? ' · ' + esc(pt.nota) : ''}</div></div>
      <button class="x" aria-label="Quitar punto" onclick="borrarPunto('${esc(pt.id)}')">✕</button></div>`).join('')}</div>
    <p class="small muted">Los publicadores marcan estos puntos desde su app; desaparecen solos después de 8 horas.</p>` : ''}
  <div class="h-sec">Arreglos programados</div>
  ${sal.length ? `<div class="lista">${sal.map(x => `<div class="item">
      <div class="grow"><div class="t">${esc(tituloSalida(x))} · <span class="cap" style="display:inline-block">${x.repetir === 'semanal' ? esc(textoRepetir(x)) + ' (próx. ' + esc(fmtFecha(x.fecha, { day: 'numeric', month: 'short' })) + ')' : esc(fmtFecha(x.fecha))}</span>${x.hora ? ' · ' + esc(x.hora) : ''}</div>
      <div class="small muted">${esc(x.conductor || 'Sin conductor')}${x.punto ? ' · ' + esc(x.punto) : ''}</div></div>
      <button class="btn btn-sm btn-wa" onclick="compartirSalidaAdmin('${esc(x.id)}')">Avisar</button>
      <button class="x" aria-label="Eliminar" onclick="borrarSalida('${esc(x.id)}')">✕</button></div>`).join('')}</div>`
    : '<div class="empty">No hay arreglos programados.</div>'}
  ${vRegistroTerritorios()}`;
}

/* ---------- Registro de territorios (S-13) ---------- */
function vRegistroTerritorios() {
  const R = Mapa.resumenRegistro(DATA.registro || []);
  const lista = Object.values(R).sort((a, b) => (b.dias ?? 1e9) - (a.dias ?? 1e9));
  const recientes = [...(DATA.registro || [])].sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado || '').localeCompare(a.creado || '')).slice(0, 15);
  return `<div class="h-sec">Registro de territorios</div>
  ${Mapa.leyenda()}
  <details class="card"><summary>Registrar predicación de un territorio</summary>
    <form id="fRegA" onsubmit="registrarAdmin(event)" style="margin-top:12px">
      <div class="grid2"><label class="f"><span>Territorio</span><select name="territorio">${Mapa.numeros().map(n => `<option>${esc(n)}</option>`).join('')}</select></label>
        <label class="f"><span>Fecha</span><input type="date" name="fecha" required max="${hoy()}" value="${hoy()}"></label></div>
      <div class="grid2 resp"><label class="f"><span>¿Cómo quedó?</span><select name="estado"><option value="completo">Completo</option><option value="parcial">Parcial</option></select></label>
        <label class="f"><span>Conductor</span><input type="text" name="conductor" list="dlHerT" required maxlength="80"></label></div>
      <label class="f"><span>Nota (opcional)</span><input type="text" name="nota" maxlength="300"></label>
      <button class="btn btn-primary btn-block">Guardar en el registro</button>
    </form></details>
  <p class="small muted">Ordenados por el que lleva más tiempo sin predicarse completo. Los publicadores también pueden registrar desde su app al terminar una salida.</p>
  <div class="lista">${lista.map(t => `<div class="item">
    <div class="fecha-box" style="background:${t.color}22"><div class="d" style="color:${t.color}">${esc(t.territorio)}</div><div class="m">terr.</div></div>
    <div class="grow"><div class="t">${t.ultimoCompleto ? 'Completo ' + esc(Mapa.textoDias(t.dias)) : 'Sin registro de completo'}</div>
      <div class="small muted">${t.ultimoCompleto ? esc(fmtFecha(t.ultimoCompleto.fecha, { day: 'numeric', month: 'short', year: 'numeric' })) + ' · ' + esc(t.ultimoCompleto.conductor) : ''}${t.enProgreso ? `${t.ultimoCompleto ? ' · ' : ''}<b>En progreso</b> (parcial el ${esc(fmtFecha(t.ultimo.fecha))})` : ''}</div></div>
    <button class="btn btn-sm" type="button" onclick="programarTerr('${esc(t.territorio)}')">Programar</button></div>`).join('')}</div>
  <div class="row" style="margin:12px 0"><button class="btn" type="button" onclick="copiarRegistro()">Copiar registro completo (para Excel o Sheets)</button></div>
  ${recientes.length ? `<div class="h-sec">Últimos registros</div><div class="lista">${recientes.map(x => `<div class="item">
      <div class="grow"><div class="t">Territorio ${esc(x.territorio)} · ${x.estado === 'completo' ? 'Completo' : 'Parcial'}</div>
      <div class="small muted">${esc(fmtFecha(x.fecha, { day: 'numeric', month: 'short', year: 'numeric' }))} · ${esc(x.conductor)}${x.nota ? ' · ' + esc(x.nota) : ''}</div></div>
      <button class="x" aria-label="Eliminar registro" onclick="borrarRegistro('${esc(x.id)}')">✕</button></div>`).join('')}</div>` : ''}`;
}
function programarTerr(n) {
  const sel = $('#sTerr'); if (!sel) return;
  sel.value = n; sel.dispatchEvent(new Event('change'));
  $('#fSal').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function pintarEstadoTerr() {
  const box = $('#estadoTerr'), sel = $('#sTerr'); if (!box || !sel) return;
  const t = Mapa.resumenRegistro(DATA.registro || [])[sel.value]; if (!t) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="hist ${t.estado === 'reciente' ? 'alerta' : ''}">Territorio ${esc(t.territorio)}: ${t.ultimoCompleto ? 'completo ' + esc(Mapa.textoDias(t.dias)) : 'sin registro de completo'}${t.enProgreso ? ' · en progreso' : ''}.${t.estado === 'reciente' ? ' <b>Se predicó hace poco.</b>' : ''}</div>`;
}
async function registrarAdmin(e) {
  e.preventDefault();
  const f = e.target;
  try {
    await post('registrarTerritorio', { territorio: f.territorio.value, fecha: f.fecha.value, estado: f.estado.value, conductor: f.conductor.value.trim(), nota: f.nota.value.trim() });
    await recargarData(); toast('Guardado en el registro', 'ok'); render();
  } catch (err) { toast(err.message, 'err'); }
}
async function borrarRegistro(id) {
  if (!await confirmar('¿Eliminar este registro?')) return;
  try { await post('borrarRegistro', { id }); await recargarData(); render(); } catch (e) { toast(e.message, 'err'); }
}
async function copiarRegistro() {
  let filas;
  try { filas = await post('registroCompleto'); } catch (e) { return toast(e.message, 'err'); }
  const t = ['Territorio\tFecha\tEstado\tConductor\tNota', ...filas.sort((a, b) => (Number(a.territorio) - Number(b.territorio)) || a.fecha.localeCompare(b.fecha))
    .map(x => [x.territorio, x.fecha, x.estado, x.conductor, x.nota].join('\t'))].join('\n');
  try { await navigator.clipboard.writeText(t); toast(`${filas.length} registros copiados. Péguelos en una hoja de cálculo.`, 'ok'); }
  catch (e) { hojaCompartir('Registro de territorios', t); }
}

/* ---------- Programas del mes en tabla ---------- */
let ED = null;
const mesActual = () => { const d = new Date(); if (d.getDate() >= 20) d.setMonth(d.getMonth() + 1, 1); return `${d.getFullYear()}-${z2(d.getMonth() + 1)}`; };
function vTablas() {
  const sec = sesion.get('tabla_sec', 'audio_video'), mes = sesion.get('tabla_mes', mesActual());
  const guardadas = DATA.tablas || [];
  return `<h1 class="titulo-vista">Programas del mes</h1>
  <p class="small muted" style="margin-top:-6px">Audio y video, acomodadores, predicación y limpieza. Los publicadores los ven en <b>Asignaciones</b> con la semana resaltada, y cada hermano recibe su recordatorio el lunes.</p>
  <div class="card">
    <div class="grid2"><label class="f"><span>Programa</span><select id="tSec">${Tablas.SECCIONES_TABLA.map(k => `<option value="${k}" ${k === sec ? 'selected' : ''}>${esc(SECCIONES[k].nombre)}</option>`).join('')}</select></label>
      <label class="f"><span>Mes</span><input type="month" id="tMes" value="${esc(mes)}"></label></div>
    <div class="row" style="gap:6px;margin-bottom:10px">
      <label class="btn btn-sm btn-primary">Leer archivo (PDF, Excel o imagen)<input type="file" accept="application/pdf,image/*,.xlsx,.xls,.csv,.ods" id="tPdf" hidden></label>
      <button class="btn btn-sm" type="button" onclick="pegarTabla()">Pegar de Word o Excel</button>
      <button class="btn btn-sm" type="button" onclick="rellenarRotacion()">Rellenar con rotación</button>
      <button class="btn btn-sm" type="button" onclick="fechasDeNuevo()">Fechas del mes</button>
    </div>
    <div id="edEstado" class="small muted" style="margin-bottom:8px"></div>
    <div class="ed-scroll"><table class="ed-tabla" id="edTabla"></table></div>
    <datalist id="dlNomT"></datalist>
    <div class="row" style="gap:6px;margin-top:10px">
      <button class="btn btn-sm" type="button" onclick="ED.filas.push({fecha:'',valores:ED.columnas.map(()=>'')});pintarEditor()">+ Agregar fecha</button>
      <button class="btn btn-sm" type="button" onclick="ED.columnas.push('Nueva');ED.filas.forEach(f=>f.valores.push(''));pintarEditor()">+ Agregar columna</button>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="guardarTabla()">Guardar y publicar</button>
  </div>
  <div class="h-sec">Publicados</div>
  ${guardadas.length ? `<div class="lista">${guardadas.map(t => `<div class="item"><div class="grow"><div class="t">${esc(SECCIONES[t.seccion].nombre)} · <span class="cap" style="display:inline-block">${esc(Tablas.nombreMes(t.mes))}</span></div>
    <div class="small muted">${t.filas.length} fechas · ${t.columnas.map(esc).join(', ')}</div></div>
    <button class="btn btn-sm" onclick="editarTabla('${esc(t.seccion)}','${esc(t.mes)}')">Editar</button>
    <button class="x" aria-label="Eliminar" onclick="borrarTabla('${esc(t.id)}')">✕</button></div>`).join('')}</div>` : '<div class="empty">Todavía no hay programas del mes publicados.</div>'}`;
}
function nombresConocidos() {
  const set = new Map();
  const add = n => { n = String(n || '').trim(); if (n.length >= 3 && !set.has(norm(n))) set.set(norm(n), n); };
  (HER || []).forEach(h => add(h.nombre));
  (DATA.tablas || []).forEach(t => t.filas.forEach(f => f.valores.forEach(v => String(v).split('/').forEach(add))));
  (HIST || []).forEach(h => add(h.hermano));
  (DATA.asignaciones || []).forEach(a => add(a.hermano));
  return [...set.values()].sort((a, b) => a.localeCompare(b));
}
function cargarEditor() {
  const sec = $('#tSec').value, mes = $('#tMes').value;
  sesion.set('tabla_sec', sec); sesion.set('tabla_mes', mes);
  const ex = (DATA.tablas || []).find(t => t.seccion === sec && t.mes === mes);
  ED = ex ? { seccion: sec, mes, columnas: [...ex.columnas], filas: ex.filas.map(f => ({ fecha: f.fecha, valores: [...f.valores] })) }
    : { seccion: sec, mes, columnas: [...Tablas.CONFIG[sec].columnas], filas: Tablas.fechasDelMes(sec, mes, DATA).map(f => ({ fecha: f, valores: Tablas.CONFIG[sec].columnas.map(() => '') })) };
  $('#edEstado').textContent = ex ? 'Editando el programa ya publicado de este mes.' : 'Programa nuevo: las fechas de reunión del mes ya están puestas.';
  $('#tSec').onchange = $('#tMes').onchange = cargarEditor;
  $('#tPdf').onchange = leerPdfTabla;
  $('#dlNomT').innerHTML = nombresConocidos().map(n => `<option value="${esc(n)}">`).join('');
  pintarEditor();
}
function editarTabla(sec, mes) { $('#tSec').value = sec; $('#tMes').value = mes; cargarEditor(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function fechasDeNuevo() {
  const fechas = Tablas.fechasDelMes(ED.seccion, ED.mes, DATA);
  const previas = new Map(ED.filas.map(f => [f.fecha, f.valores]));
  ED.filas = fechas.map(f => ({ fecha: f, valores: previas.get(f) || ED.columnas.map(() => '') }));
  pintarEditor();
}
function pintarEditor() {
  ED.filas.sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999'));
  $('#edTabla').innerHTML = `<thead><tr><th>Fecha</th>${ED.columnas.map((c, i) => `<th><input class="ed-col" value="${esc(c)}" onchange="ED.columnas[${i}]=this.value.trim()" aria-label="Nombre de la columna">
      ${ED.columnas.length > 1 ? `<button class="x" type="button" title="Quitar columna" onclick="ED.columnas.splice(${i},1);ED.filas.forEach(f=>f.valores.splice(${i},1));pintarEditor()">✕</button>` : ''}</th>`).join('')}<th></th></tr></thead>
    <tbody>${ED.filas.map((f, r) => `<tr class="${f.revisar ? 'ed-revisar' : ''}"><td class="ed-fecha"><input type="date" value="${esc(f.fecha)}" onchange="ED.filas[${r}].fecha=this.value;ED.filas[${r}].revisar=false;pintarEditor()"><span>${f.fecha ? esc(DIAS[parseYmd(f.fecha).getDay()]) : ''}</span></td>
      ${ED.columnas.map((c, i) => `<td><input list="dlNomT" value="${esc(f.valores[i] || '')}" onchange="ED.filas[${r}].valores[${i}]=this.value.trim()" aria-label="${esc(c)}"></td>`).join('')}
      <td><button class="x" type="button" title="Quitar fecha" onclick="ED.filas.splice(${r},1);pintarEditor()">✕</button></td></tr>`).join('')}</tbody>`;
}
function aplicarFilas(filas, origen, columnas, aviso = '') {
  if (!filas.length) return toast(`No se encontraron fechas con nombres en ${origen}`, 'err');
  const max = Math.max(...filas.map(f => f.valores.length));
  const def = (Tablas.CONFIG[ED.seccion] || {}).columnas || [];
  if (columnas && columnas.length >= max && columnas.slice(0, max).every(Boolean)) ED.columnas = columnas.slice(0, max);
  else if (def.length === max) ED.columnas = [...def];
  while (ED.columnas.length < max) ED.columnas.push('Columna ' + (ED.columnas.length + 1));
  ED.filas = filas.map(f => ({ fecha: f.fecha, valores: ED.columnas.map((c, i) => f.valores[i] || ''), revisar: f.revisar }));
  const dudosas = filas.filter(f => f.revisar).map(f => fmtFecha(f.fecha, { weekday: 'long', day: 'numeric', month: 'long' }));
  if (dudosas.length) aviso = `<b>Revise ${dudosas.length === 1 ? 'esta fecha' : 'estas fechas'}:</b> ${dudosas.join(', ')} (el día de la semana no coincidía con el número leído y se ajustó). ` + aviso;
  const meses = [...new Set(filas.map(f => f.fecha.slice(0, 7)))].sort();
  ED.mes = meses[0]; $('#tMes').value = meses[0];
  $('#edEstado').innerHTML = `Se leyeron <b>${filas.length} fechas</b>${meses.length > 1 ? ' de ' + meses.map(Tablas.nombreMes).join(' y ') + ' (se guardará un programa por mes)' : ''}. Revise y toque Guardar.${aviso ? `<div class="hist alerta" style="margin-top:6px">${aviso}</div>` : ''}`;
  pintarEditor();
}
/* Corrige nombres leídos de una imagen con los nombres que la app ya conoce (ej. "Frankilyn" → "Franklyn") */
function distancia(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function corregirNombres(filas, soloCols = null) {
  const conocidos = nombresConocidos();
  let n = 0;
  filas.forEach(f => { f.valores = f.valores.map((v, ci) => soloCols && !soloCols.includes(ci) ? v : String(v || '').split('/').map(x => {
    x = x.trim(); const nx = norm(x);
    if (!nx || conocidos.some(k => norm(k) === nx)) return x;
    let mejor = null, dm = 99;
    conocidos.forEach(k => { const dd = distancia(nx, norm(k)); if (dd < dm) { dm = dd; mejor = k; } });
    if (mejor && dm <= Math.max(1, Math.floor(nx.length * 0.2))) { n++; return mejor; }
    return x;
  }).join(' / ')); });
  return n;
}
async function leerDiscursosArchivo(f, anio, estado) {
  let filas = [], deImagen = true;
  if (!Lector.esImagen(f) && /pdf/i.test(f.type || f.name)) {
    estado('Leyendo el PDF…');
    const lineas = await Programa.leerLineas(await f.arrayBuffer());
    if (lineas.length) { filas = Tablas.leerDiscursos(lineas.join('\n').replace(/\t/g, '    '), anio); deImagen = false; }
    if (!filas.length) for (const cv of await Lector.pdfACanvas(f)) filas.push(...await Lector.leerDiscursosImagen(cv, anio, estado));
  } else filas = await Lector.leerDiscursosImagen(f, anio, estado);
  const corr = deImagen ? corregirNombres(filas, [2, 3]) : 0;
  ED.columnas = [...Tablas.CONFIG.discursos.columnas];
  aplicarFilas(filas, 'el archivo', ED.columnas, deImagen ? `Se leyó de una imagen: revise cada casilla${corr ? ` (se corrigieron ${corr} nombres con los que la app ya conoce)` : ''}. Si falta un dato, escríbalo.` : '');
}
async function leerPdfTabla(e) {
  const f = e.target.files[0]; if (!f) return;
  const anio = +ED.mes.slice(0, 4), estado = t => { $('#edEstado').textContent = t; };
  try {
    if (ED.seccion === 'discursos' && !Lector.esExcel(f)) { await leerDiscursosArchivo(f, anio, estado); e.target.value = ''; return; }
    if (Lector.esExcel(f)) {
      estado('Leyendo el Excel…');
      const r = Tablas.leerCeldas(await Lector.leerExcel(f), anio);
      aplicarFilas(r.filas, 'el Excel', r.columnas);
    } else if (Lector.esImagen(f)) {
      estado('Leyendo la imagen…');
      const r = Tablas.leerCeldas(await Lector.leerImagen(f, estado), anio);
      const corr = corregirNombres(r.filas);
      aplicarFilas(r.filas, 'la imagen', r.columnas, `Los nombres se leyeron de una imagen: revise cada casilla, puede haber letras equivocadas${corr ? ` (se corrigieron ${corr} con los nombres que la app ya conoce)` : ''}. Si falta una fecha, agréguela a mano.`);
    } else {
      estado('Leyendo el PDF…');
      const lineas = await Programa.leerLineas(await f.arrayBuffer());
      const celdas = lineas.map(l => l.split(/\t| {2,}/).map(x => x.trim()).filter(Boolean)).filter(c => c.length >= 2);
      let r = Tablas.leerCeldas(celdas, anio);
      if (!r.filas.length) r = { filas: Tablas.leerFilas(lineas, anio), columnas: null };
      if (r.filas.length) aplicarFilas(r.filas, 'el PDF', r.columnas);
      else {
        // el PDF no trae texto (es una imagen guardada como PDF): se lee como imagen
        const ri = Tablas.leerCeldas(await Lector.leerPdfImagen(f, estado), anio);
        const corr = corregirNombres(ri.filas);
        aplicarFilas(ri.filas, 'el PDF', ri.columnas, `Este PDF es una imagen: los nombres se leyeron con reconocimiento de texto. Revise cada casilla${corr ? ` (se corrigieron ${corr} con los nombres que la app ya conoce)` : ''}. Si falta una fecha, agréguela a mano.`);
      }
    }
  } catch (err) { estado(''); toast('No se pudo leer el archivo: ' + err.message, 'err'); }
  e.target.value = '';
}
function pegarTabla() {
  const d = document.createElement('div');
  d.className = 'modal';
  d.innerHTML = `<div class="modal-box"><h3 style="font-size:1.05rem">Pegar desde Word o Excel</h3>
    <p class="small muted">Copie la tabla completa (con las fechas) y péguela aquí.</p>
    <textarea class="compartir-edit" placeholder="5 de noviembre	jueves	Erick Josias	Rudy Ruiz	…"></textarea>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-x>Cancelar</button><button class="btn btn-primary" data-ok>Leer</button></div></div>`;
  d.addEventListener('click', e => {
    if (e.target === d || e.target.closest('[data-x]')) return d.remove();
    if (e.target.closest('[data-ok]')) { const t = $('textarea', d).value; d.remove(); aplicarFilas(Tablas.leerFilas(t.split('\n'), +ED.mes.slice(0, 4)), 'el texto'); }
  });
  document.body.appendChild(d); $('textarea', d).focus();
}
/* Rotación: llena las casillas vacías con quien lleva más tiempo sin hacer esa tarea, sin repetir en la misma fecha */
function rellenarRotacion() {
  const otras = (DATA.tablas || []).filter(t => t.seccion === ED.seccion && t.mes !== ED.mes);
  let llenas = 0; const sinNombres = [];
  ED.filas.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  ED.columnas.forEach((col, i) => {
    const ult = new Map();
    const usar = (n, fecha) => String(n || '').split('/').map(x => x.trim()).filter(Boolean).forEach(x => { if (!ult.has(x) || fecha > ult.get(x)) ult.set(x, fecha); });
    otras.forEach(t => { const j = t.columnas.findIndex(c => norm(c) === norm(col)); if (j >= 0) t.filas.forEach(f => usar(f.valores[j], f.fecha)); });
    ED.filas.forEach(f => usar(f.valores[i], f.fecha || ''));
    if (ult.size < 2) { sinNombres.push(col); return; }
    ED.filas.forEach(f => {
      if ((f.valores[i] || '').trim()) return;
      const enFila = new Set(f.valores.flatMap(v => String(v || '').split('/').map(x => norm(x))));
      const cand = [...ult.entries()].filter(([n]) => !enFila.has(norm(n))).sort((a, b) => (a[1] || '').localeCompare(b[1] || ''));
      if (!cand.length) return;
      f.valores[i] = cand[0][0]; ult.set(cand[0][0], f.fecha || '9999'); llenas++;
    });
  });
  pintarEditor();
  toast(llenas ? `Se llenaron ${llenas} casillas. Revise antes de guardar.` : sinNombres.length ? `Para rotar, escriba primero los nombres de un mes en: ${sinNombres.join(', ')}` : 'No había casillas vacías', llenas ? 'ok' : '');
}
async function guardarTabla() {
  const cols = ED.columnas.map(c => c.trim());
  if (cols.some(c => !c)) return toast('Ponga nombre a todas las columnas', 'err');
  const filas = ED.filas.filter(f => f.fecha);
  if (!filas.length) return toast('Agregue al menos una fecha', 'err');
  const porMes = {};
  filas.forEach(f => (porMes[f.fecha.slice(0, 7)] ||= []).push(f));
  const tablas = Object.keys(porMes).sort().map(mes => ({ seccion: ED.seccion, mes, columnas: cols, filas: porMes[mes], sinAsignar: Tablas.sinAsignar(ED.seccion, cols) }));
  try {
    const r = await post('guardarTablas', { tablas });
    ASIG = null; HIST = null; await recargarData();
    toast(`Publicado (${r.asignaciones} asignaciones)`, 'ok'); render();
  } catch (e) { toast(e.message, 'err'); }
}
async function borrarTabla(id) {
  if (!await confirmar('¿Eliminar este programa del mes? También se borran sus asignaciones.')) return;
  try { await post('borrarTabla', { id }); ASIG = null; HIST = null; await recargarData(); render(); } catch (e) { toast(e.message, 'err'); }
}

/* ---------- Zoom ---------- */
let ZHOR = [];
function vZoom() {
  const z = DATA.zoom || {};
  ZHOR = (z.horarios && z.horarios.length) ? z.horarios.map(h => ({ ...h })) : [{ dia: 4, hora: '19:00' }, { dia: 6, hora: '18:00' }];
  return `<h1 class="titulo-vista">Zoom de las reuniones</h1>
  <p class="small muted" style="margin-top:-6px">Se guarda una sola vez. Los publicadores ven el botón <b>Unirse por Zoom</b> en Reuniones, y el día de la reunión aparece en Inicio. El tema se actualiza solo cada semana.</p>
  <details class="card" ${z.enlace ? '' : 'open'}><summary>Pegar la invitación de Zoom</summary>
    <p class="small muted">Pegue aquí la invitación que les da Zoom (o la que mandan al grupo) y toque <b>Leer datos</b>: se llenan solos el ID, el código, el enlace y los horarios.</p>
    <textarea id="zPegar" placeholder="ID de reunión: 863 4492 5500&#10;Código de acceso: 829604&#10;https://us02web.zoom.us/j/..."></textarea>
    <button class="btn btn-primary" type="button" style="margin-top:8px" onclick="leerPegado()">Leer datos</button>
  </details>
  <form class="card" id="fZoom" onsubmit="guardarZoom(event)">
    <label class="f"><span>Tema</span><input type="text" name="tema" maxlength="200" value="${esc(z.tema || TEMA_ZOOM)}"></label>
    <p class="small muted" style="margin:-6px 0 12px">Donde dice <code class="k">{semana}</code> la app pone sola la semana actual: <b>${esc(textoSemana())}</b>.</p>
    <div class="f" style="font-size:.84rem;font-weight:650;color:var(--muted);margin-bottom:6px">Horarios</div>
    <div id="zHor"></div>
    <button class="btn btn-sm" type="button" onclick="ZHOR.push({dia:0,hora:'10:00'});pintarHorarios()" style="margin-bottom:12px">+ Agregar horario</button>
    <div class="grid2 resp"><label class="f"><span>ID de reunión</span><input type="text" name="idReunion" maxlength="30" inputmode="numeric" value="${esc(z.id || '')}" placeholder="863 4492 5500"></label>
      <label class="f"><span>Código de acceso</span><input type="text" name="codigo" maxlength="30" value="${esc(z.codigo || '')}"></label></div>
    <label class="f"><span>Enlace de Zoom</span><input type="url" name="enlace" required maxlength="400" value="${esc(z.enlace || '')}" placeholder="https://us02web.zoom.us/j/..."></label>
    <label class="f"><span>Nota (opcional)</span><input type="text" name="nota" maxlength="300" value="${esc(z.nota || '')}" placeholder="Ej. Conéctese 10 minutos antes y ponga su nombre completo"></label>
    <button class="btn btn-primary btn-block">Guardar</button>
  </form>
  ${z.enlace ? `<div class="card"><h3 style="font-size:1.05rem">Invitación de esta semana</h3>
    <div class="compartir-txt pre small" style="margin-top:8px">${esc(mensajeZoom(z))}</div>
    <div class="row" style="margin-top:10px"><button class="btn btn-wa" type="button" onclick="hojaCompartir('Invitación de Zoom', mensajeZoom(DATA.zoom), { editable: true })"><span class="ico">${ICON.wa}</span>Avisar</button>
    <button class="btn btn-danger btn-sm" type="button" onclick="borrarZoom()">Quitar Zoom de la app</button></div></div>` : ''}`;
}
function pintarHorarios() {
  $('#zHor').innerHTML = ZHOR.map((h, i) => `<div class="horario-fila">
    <select onchange="ZHOR[${i}].dia=+this.value">${[1, 2, 3, 4, 5, 6, 0].map(d => `<option value="${d}" ${d === +h.dia ? 'selected' : ''}>${DIAS[d]}</option>`).join('')}</select>
    <input type="time" value="${esc(h.hora)}" onchange="ZHOR[${i}].hora=this.value" required>
    <button class="x" type="button" aria-label="Quitar horario" onclick="ZHOR.splice(${i},1);pintarHorarios()">✕</button></div>`).join('') || '<p class="small muted">Sin horarios.</p>';
}
function initZoom() { pintarHorarios(); }
function leerPegado() {
  const r = leerInvitacionZoom($('#zPegar').value), f = $('#fZoom');
  const leidos = [];
  if (r.id) { f.idReunion.value = r.id; leidos.push('ID'); }
  if (r.codigo) { f.codigo.value = r.codigo; leidos.push('código'); }
  if (r.enlace) { f.enlace.value = r.enlace; leidos.push('enlace'); }
  if (r.horarios) { ZHOR = r.horarios.filter(h => h.dia >= 0); pintarHorarios(); leidos.push('horarios'); }
  toast(leidos.length ? 'Se leyó: ' + leidos.join(', ') + '. Revise y toque Guardar.' : 'No se encontraron datos de Zoom en el texto', leidos.length ? 'ok' : 'err');
}
async function guardarZoom(e) {
  e.preventDefault();
  const f = e.target;
  try {
    await post('guardarZoom', { tema: f.tema.value.trim(), id: f.idReunion.value.trim(), acceso: f.codigo.value.trim(), enlace: f.enlace.value.trim(), nota: f.nota.value.trim(), horarios: ZHOR.filter(h => h.hora) });
    await recargarData(); toast('Zoom guardado', 'ok'); render();
  } catch (err) { toast(err.message, 'err'); }
}
async function borrarZoom() {
  if (!await confirmar('¿Quitar los datos de Zoom? Los publicadores dejarán de ver el botón para unirse.', 'Quitar')) return;
  try { await post('guardarZoom', { borrar: true }); await recargarData(); render(); } catch (e) { toast(e.message, 'err'); }
}

/* ---------- Ajustes: código de la congregación ---------- */
function vAjustes(aj) {
  const enlace = new URL('../', location.href).href;
  return `<h1 class="titulo-vista">Ajustes</h1>
  <form class="card" onsubmit="guardarCodigo(event)">
    <h3 style="font-size:1.05rem">Código de la congregación</h3>
    <p class="small muted">Los publicadores lo escriben una sola vez en su teléfono para poder ver la app. Si lo cambia, todos tendrán que escribir el nuevo (sirve para quitar el acceso a alguien).</p>
    <p class="small">Estado actual: ${aj.codigo ? `<b style="color:var(--ok)">activado</b> · código: <b>${esc(aj.codigo)}</b>` : '<b style="color:var(--danger)">sin código</b> · cualquiera con el enlace puede ver la app'}</p>
    <label class="f"><span>Nuevo código</span><input type="text" name="codigo" maxlength="30" autocomplete="off" placeholder="Ej. RIO2026" value="${esc(aj.codigo)}"></label>
    <div class="row"><button class="btn btn-primary">Guardar código</button>
      ${aj.codigo ? '<button type="button" class="btn btn-danger" onclick="quitarCodigo()">Quitar código</button>' : ''}</div>
  </form>
  <div class="card">
    <h3 style="font-size:1.05rem">Enlace para los publicadores</h3>
    <p class="small" style="word-break:break-all"><b>${esc(enlace)}</b></p>
    <button class="btn btn-sm" type="button" onclick="hojaCompartir('App de la congregación', 'App de la congregación ${esc(CFG.CONGREGACION || '')}:\\n${esc(enlace)}')">Compartir enlace</button>
    <p class="small muted" style="margin-bottom:0">Envíe el código por separado, de persona a persona, no en el grupo junto con el enlace.</p>
  </div>`;
}
async function guardarCodigo(e) {
  e.preventDefault();
  const c = e.target.codigo.value.trim();
  if (c && c.length < 4) return toast('Use al menos 4 letras o números', 'err');
  try { await post('guardarCodigo', { codigo: c }); toast(c ? 'Código guardado' : 'Código quitado', 'ok'); render(); } catch (err) { toast(err.message, 'err'); }
}
async function quitarCodigo() {
  if (!await confirmar('¿Quitar el código? Cualquier persona con el enlace podrá ver la app.', 'Quitar')) return;
  try { await post('guardarCodigo', { codigo: '' }); toast('Código quitado'); render(); } catch (err) { toast(err.message, 'err'); }
}
function initTerritorios() {
  PUNTO = null;
  PUNTO_RECORDADO = false;
  AM = Mapa.crear($('#aMapa'), { onMapa: ll => { PUNTO_RECORDADO = false; ponerPunto(ll.lat, ll.lng); } });
  const R = Mapa.resumenRegistro(DATA.registro || []);
  const col = {}; Object.values(R).forEach(t => { col[t.territorio] = t.color; });
  AM.colorear(col);
  const sel = $('#sTerr'), tipo = $('#sTipo'), punto = $('#fSal [name=punto]');
  sel.onchange = () => { AM.seleccionar(sel.value || null); pintarEstadoTerr(); };
  // casa en casa necesita territorio; los demás arreglos normalmente no
  const ajustarTipo = () => {
    sesion.set('tipo_salida', tipo.value);
    if (tipo.value === 'casa' && !sel.value) { sel.value = Mapa.numeros()[0]; sel.onchange(); }
    if (tipo.value !== 'casa' && sel.value && ajustarTipo.hecho) { sel.value = ''; sel.onchange(); }
    ajustarTipo.hecho = true;
    if (tipo.value !== 'casa' && !punto.value) punto.value = 'Salón del Reino';
    usarPuntoGuardado();
  };
  tipo.onchange = ajustarTipo;
  // días de la semana cuando se repite
  const rep = $('#cRep'), fecha = $('#fSal [name=fecha]');
  const marcarDiaFecha = () => { if (!$$('#diasSel input:checked').length && fecha.value) { const d = parseYmd(fecha.value).getDay(); $(`#diasSel input[value="${d}"]`).checked = true; } };
  rep.onchange = () => { $('#diasSel').hidden = !rep.checked; if (rep.checked) marcarDiaFecha(); };
  fecha.addEventListener('change', () => { if (rep.checked) marcarDiaFecha(); });
  punto.addEventListener('input', usarPuntoGuardado);
  if (tipo.value !== 'casa') sel.value = '';
  ajustarTipo();
  AM.seleccionar(sel.value || null); pintarEstadoTerr();
}
/* Lugares ya marcados en el mapa (ej. el Salón del Reino) se recuerdan en este teléfono */
let PUNTO_RECORDADO = false;
function usarPuntoGuardado() {
  const t = norm($('#fSal [name=punto]').value);
  const g = store.get('lugares', {})[t];
  if (g && (!PUNTO || PUNTO_RECORDADO)) { ponerPunto(g.lat, g.lng); PUNTO_RECORDADO = true; AM.map.setView([g.lat, g.lng], 16); }
  else if (!g && PUNTO_RECORDADO) { PUNTO = null; PUNTO_RECORDADO = false; AM.marcarPunto(null); $('#puntoTxt').textContent = 'Toque el mapa para marcar el punto de encuentro (opcional).'; }
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
    sesion.set('tipo_salida', f.tipo.value);
    if (PUNTO && f.punto.value.trim()) { const l = store.get('lugares', {}); l[norm(f.punto.value)] = PUNTO; store.set('lugares', l); }
    const dias = $$('#diasSel input:checked').map(i => i.value).join(',');
    if (f.repetir.checked && !dias) { b.disabled = false; return toast('Elija al menos un día', 'err'); }
    await post('guardarSalida', { tipo: f.tipo.value, repetir: f.repetir.checked ? 'semanal' : '', dias: f.repetir.checked ? dias : '', fecha: f.fecha.value, hora: f.hora.value.trim(), territorio: f.territorio.value, conductor: f.conductor.value.trim(), punto: f.punto.value.trim(), nota: f.nota.value.trim(), lat: PUNTO ? PUNTO.lat : '', lng: PUNTO ? PUNTO.lng : '' });
    await recargarData(); toast('Arreglo programado', 'ok'); render();
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
  const x = salidasProximas(DATA.salidas).find(s => s.id === id); if (!x) return;
  const tipo = x.tipo || 'casa';
  hojaCompartir('Avisar: ' + tituloSalida(x), mensajeSalida(x), {
    editable: true,
    plantilla: texto => { const pl = store.get('plantillas', {}); pl[tipo] = aPlantilla(x, texto); store.set('plantillas', pl); }
  });
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
