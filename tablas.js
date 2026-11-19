/* Programas del mes en tabla: audio y video, acomodadores, predicación y limpieza */
const Tablas = (() => {
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const CONFIG = {
    audio_video: { titulo: 'Programa de audio y video', columnas: ['Sonido', 'Video', 'Plataforma', 'Micrófono 1', 'Micrófono 2'], dias: 'reunion' },
    acomodadores: { titulo: 'Programa de acomodadores', columnas: ['Acomodador auditorio', 'Acomodador parqueo'], dias: 'reunion' },
    predicacion: { titulo: 'Programa de predicación (sábados y primer domingo)', columnas: ['Conductor'], dias: 'predicacion' },
    limpieza: { titulo: 'Programa de limpieza', columnas: ['Grupo'], dias: 'reunion' },
    entresemana: { titulo: 'Reunión de entre semana', columnas: ['Asignado'], dias: 'reunion' },
    discursos: { titulo: 'Discursos públicos', columnas: ['Orador', 'Presidente', 'Lector'], dias: 'reunion' }
  };
  const SECCIONES_TABLA = ['audio_video', 'acomodadores', 'predicacion', 'limpieza'];

  /* Días de reunión: los del Zoom si están guardados; si no, jueves y sábado */
  function diasReunion(data) {
    const d = [...new Set(((data && data.zoom && data.zoom.horarios) || []).map(h => +h.dia))];
    return d.length ? d : [4, 6];
  }
  /* Fechas del mes para una sección */
  function fechasDelMes(seccion, mes, data) {
    const [y, m] = mes.split('-').map(Number);
    const ultimo = new Date(y, m, 0).getDate();
    const regla = (CONFIG[seccion] || {}).dias;
    const dias = diasReunion(data);
    const out = [];
    let primerDomingo = true;
    for (let d = 1; d <= ultimo; d++) {
      const f = new Date(y, m - 1, d), dw = f.getDay();
      if (regla === 'predicacion') {
        if (dw === 6) out.push(ymd(f));
        if (dw === 0 && primerDomingo) { out.push(ymd(f)); primerDomingo = false; }
      } else if (dias.includes(dw)) out.push(ymd(f));
    }
    return out;
  }
  const nombreMes = mes => { const [y, m] = mes.split('-').map(Number); return `${MESES[m - 1]} ${y}`; };

  /* Leer fechas y nombres de un texto (copiado de Word/Excel) o de las líneas de un PDF */
  const reDia = /^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)$/i;
  function fechaDe(t, anioBase) {
    t = String(t).trim();
    let m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${z2(m[2])}-${z2(m[1])}`;
    m = t.match(/^(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+(?:de|del)\s+(\d{4}))?$/i);
    if (m) { const mes = MESES.indexOf(norm(m[2])); if (mes >= 0) return `${m[3] || anioBase}-${z2(mes + 1)}-${z2(m[1])}`; }
    m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return t;
    return null;
  }
  function leerFilas(lineas, anioBase = new Date().getFullYear()) {
    const filas = [];
    lineas.forEach(l => {
      // celdas: tabulador o 2+ espacios
      let celdas = l.split(/\t| {2,}/).map(c => c.trim()).filter(Boolean);
      if (celdas.length < 2) return;
      let fecha = null, resto = [];
      celdas.forEach(c => {
        if (!fecha) { const f = fechaDe(c, anioBase); if (f) { fecha = f; return; } }
        if (reDia.test(c)) return;
        if (fecha) resto.push(c);
      });
      // "Sabado 7/11/2026 Nelson Flores" en una sola celda
      if (!fecha) {
        const m = l.match(/(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s+(.+)$/);
        if (m) { fecha = fechaDe(m[1], anioBase); resto = m[2].split(/\t| {2,}/).map(c => c.trim()).filter(Boolean); }
      }
      if (fecha && resto.length) filas.push({ fecha, valores: resto });
    });
    return filas;
  }

  /* Tabla para los publicadores, con la semana actual y hoy resaltados */
  function html(t, resaltar = '') {
    const cfg = CONFIG[t.seccion] || {};
    const s = semana(), h = hoy(), r = norm(resaltar);
    const nom = v => esc(v).split(/\s*\/\s*/).map(n => r && r.length >= 3 && norm(n).includes(r) ? `<span class="yo-nombre">${n}</span>` : n).join('<br>');
    return `<div class="tabla-prog">
      <div class="tp-tit">${esc(cfg.titulo || 'Programa')}</div>
      <div class="tp-sub">${esc(CFG.CONGREGACION || '')} · ${esc(nombreMes(t.mes))}</div>
      ${t.columnas.length > 2 ? '<div class="tp-desliza">Deslice la tabla para ver todas las columnas →</div>' : ''}
      <div class="tp-scroll"><table>
        <thead><tr><th class="tp-fecha">Fecha</th>${t.columnas.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${t.filas.map(f => {
          const d = parseYmd(f.fecha);
          const clase = f.fecha === h ? 'tp-hoy' : (f.fecha >= s.inicio && f.fecha <= s.fin) ? 'tp-semana' : f.fecha < h ? 'tp-pasada' : '';
          return `<tr class="${clase}"><td class="tp-fecha"><b>${d.getDate()} ${esc(MESES[d.getMonth()].slice(0, 3))}</b><span>${esc(DIAS[d.getDay()])}</span>${f.fecha === h ? '<em>Hoy</em>' : clase === 'tp-semana' ? '<em>Esta semana</em>' : ''}</td>
            ${t.columnas.map((c, i) => `<td>${nom(f.valores[i] || '')}</td>`).join('')}</tr>`;
        }).join('')}</tbody></table></div></div>`;
  }

  return { CONFIG, SECCIONES_TABLA, fechasDelMes, nombreMes, leerFilas, fechaDe, html, diasReunion };
})();
