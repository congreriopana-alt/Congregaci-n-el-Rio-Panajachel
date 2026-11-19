/* Programas del mes en tabla: audio y video, acomodadores, predicación y limpieza */
const Tablas = (() => {
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const CONFIG = {
    audio_video: { titulo: 'Programa de audio y video', columnas: ['Sonido', 'Video', 'Plataforma', 'Micrófono 1', 'Micrófono 2'], dias: 'reunion' },
    acomodadores: { titulo: 'Programa de acomodadores', columnas: ['Acomodador auditorio', 'Acomodador parqueo'], dias: 'reunion' },
    predicacion: { titulo: 'Programa de predicación (sábados y primer domingo)', columnas: ['Conductor'], dias: 'predicacion' },
    limpieza: { titulo: 'Programa de limpieza', columnas: ['Grupo'], dias: 'reunion' },
    entresemana: { titulo: 'Reunión de entre semana', columnas: ['Asignado'], dias: 'reunion' },
    discursos: { titulo: 'Discursos públicos', columnas: ['Discurso', 'Orador', 'Presidente', 'Lector', 'Hospitalidad', 'Discursante saliente'], dias: 'finsemana',
      sinAsignar: ['discurso', 'hospitalidad'] }
  };
  const SECCIONES_TABLA = ['discursos', 'audio_video', 'acomodadores', 'predicacion', 'limpieza'];
  /* Columnas que no son nombres de hermanos (no crean asignación ni recordatorio) */
  const sinAsignar = (seccion, columnas) => {
    const lista = (CONFIG[seccion] || {}).sinAsignar || [];
    return columnas.map((c, i) => lista.includes(norm(c)) ? i : -1).filter(i => i >= 0);
  };

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
      if (regla === 'finsemana') {
        const fin = dias.filter(x => x === 6 || x === 0);
        if ((fin.length ? fin : [6]).includes(dw)) out.push(ymd(f));
      } else if (regla === 'predicacion') {
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
    t = String(t || '').trim();
    let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return t;
    m = t.match(/(?:^|\D)(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:\D|$)/);
    if (m && +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${z2(m[2])}-${z2(m[1])}`;
    m = t.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+(?:de|del)\s+(\d{4}))?/i);
    if (m) { const mes = MESES.indexOf(norm(m[2])); if (mes >= 0) return `${m[3] || anioBase}-${z2(mes + 1)}-${z2(m[1])}`; }
    return null;
  }
  const esDia = c => reDia.test(norm(c).replace(/[^a-z]/g, '')) || /^(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(norm(c));
  const nombreCol = c => {
    c = String(c || '').replace(/[^\p{L}\d ]+/gu, ' ').replace(/\s+/g, ' ').trim();
    return c === c.toUpperCase() ? c.charAt(0) + c.slice(1).toLowerCase() : c;
  };
  const limpiarNombre = v => String(v || '').replace(/\s+/g, ' ').trim()
    .replace(/(^|\s)[^\s\p{L}\d¿?¡!]+(?=\s|$)/gu, ' ').replace(/\s+\p{L}$/u, '').replace(/^\p{Ll}\s+/u, '').trim();

  /* Filas de casillas (de Excel, de una imagen o de texto) → columnas y filas con fecha */
  function leerCeldas(celdas, anioBase = new Date().getFullYear()) {
    let iFecha = -1, iDia = -1, columnas = null, idx = null;
    for (const r of celdas) {
      const j = r.findIndex(c => /^fecha$/i.test(nombreCol(c)));
      if (j >= 0) {
        iFecha = j; iDia = r.findIndex(c => /^d[ií]a$/i.test(nombreCol(c)));
        const ult = Math.max(...r.map((c, i) => nombreCol(c) ? i : -1));
        idx = r.map((c, i) => i).filter(i => i !== iFecha && i !== iDia && i <= Math.max(ult, r.length - 1));
        columnas = idx.map(i => nombreCol(r[i]));
        break;
      }
    }
    const filas = [];
    celdas.forEach(r => {
      let fecha = iFecha >= 0 ? fechaDe(r[iFecha], anioBase) : null;
      if (!fecha) { for (const c of r) { fecha = fechaDe(c, anioBase); if (fecha) break; } }
      if (!fecha) return;
      let valores;
      if (idx) valores = idx.map(i => limpiarNombre(r[i]));
      else valores = r.filter(c => c && !fechaDe(c, anioBase) && !esDia(c)).map(limpiarNombre);
      // si la tabla trae el día (jueves, sábado…) y no coincide con la fecha leída, se marca para revisar
      let revisar = false;
      const diaCelda = iDia >= 0 ? norm(r[iDia]).replace(/[^a-z]/g, '') : (r.map(c => norm(c).replace(/[^a-z]/g, '')).find(c => /^(lunes|martes|miercoles|jueves|viernes|sabado|domingo)/.test(c)) || '');
      const m = diaCelda.match(/^(domingo|lunes|martes|miercoles|jueves|viernes|sabado)/);
      if (m) {
        const esperado = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'].indexOf(m[1]);
        if (parseYmd(fecha).getDay() !== esperado) {
          // intento: el mismo mes con el día más cercano que sí cae en ese día de la semana (ej. 05 leído en vez de 03)
          const d = parseYmd(fecha), cand = [-2, 2, -1, 1, -3, 3].map(k => { const x = new Date(d); x.setDate(d.getDate() + k); return x; })
            .find(x => x.getDay() === esperado && x.getMonth() === d.getMonth());
          if (cand) fecha = ymd(cand);
          revisar = true;
        }
      }
      if (valores.some(Boolean)) filas.push({ fecha, valores, revisar });
    });
    return { columnas, filas };
  }
  function leerFilas(lineas, anioBase = new Date().getFullYear()) {
    const celdas = lineas.map(l => {
      let c = l.split(/\t| {2,}/).map(x => x.trim()).filter(Boolean);
      // "Sabado 7/11/2026 Nelson Flores" en una sola celda
      if (c.length === 1) { const m = l.match(/^(.*?)(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s+(.+)$/); if (m) c = [m[1], m[2], m[3]].map(x => x.trim()).filter(Boolean); }
      return c;
    }).filter(c => c.length >= 2);
    return leerCeldas(celdas, anioBase).filas;
  }

  /* Tabla para los publicadores, con la semana actual y hoy resaltados */
  function html(t, resaltar = '', verPasadas = false) {
    const cfg = CONFIG[t.seccion] || {};
    const s = semana(), h = hoy(), r = norm(resaltar);
    const pasadas = t.filas.filter(f => f.fecha < s.inicio).length;
    const filas = verPasadas ? t.filas : t.filas.filter(f => f.fecha >= s.inicio);
    const nom = v => esc(v).split(/\s*\/\s*/).map(n => r && r.length >= 3 && norm(n).includes(r) ? `<span class="yo-nombre">${n}</span>` : n).join('<br>');
    return `<div class="tabla-prog ${t.columnas.length <= 3 ? 'tp-pocas' : ''}">
      <div class="tp-tit">${esc(cfg.titulo || 'Programa')}</div>
      <div class="tp-sub">${esc(CFG.CONGREGACION || '')} · ${esc(nombreMes(t.mes))}</div>
      ${t.columnas.length > 2 ? '<div class="tp-desliza">Deslice la tabla para ver todas las columnas →</div>' : ''}
      <div class="tp-scroll"><table>
        <thead><tr><th class="tp-fecha">Fecha</th>${t.columnas.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${filas.map(f => {
          const d = parseYmd(f.fecha);
          const clase = f.fecha === h ? 'tp-hoy' : (f.fecha >= s.inicio && f.fecha <= s.fin) ? 'tp-semana' : f.fecha < h ? 'tp-pasada' : '';
          return `<tr class="${clase}"><td class="tp-fecha"><b>${d.getDate()} ${esc(MESES[d.getMonth()].slice(0, 3))}</b><span>${esc(DIAS[d.getDay()])}</span>${f.fecha === h ? '<em>Hoy</em>' : clase === 'tp-semana' ? '<em>Esta semana</em>' : ''}</td>
            ${t.columnas.map((c, i) => `<td>${nom(f.valores[i] || '')}</td>`).join('')}</tr>`;
        }).join('')}</tbody></table></div>
      ${pasadas ? `<button class="tp-pasadas" onclick="verSemanasPasadas('${esc(t.id)}')">${verPasadas ? 'Ocultar las semanas pasadas' : `Ver ${pasadas} fecha${pasadas === 1 ? '' : 's'} que ya pasaron`}</button>` : ''}</div>`;
  }

  /* Discursos públicos: una tarjeta por semana (la de esta semana primero y resaltada) */
  function tarjetas(t, resaltar = '', verPasadas = false) {
    const s = semana(), r = norm(resaltar);
    const nom = v => r && r.length >= 3 && norm(v).includes(r) ? `<span class="yo-nombre">${esc(v)}</span>` : esc(v);
    const iDisc = t.columnas.findIndex(c => norm(c) === 'discurso');
    const pasadas = t.filas.filter(f => f.fecha < s.inicio).length;
    const filas = verPasadas ? t.filas : t.filas.filter(f => f.fecha >= s.inicio);
    return filas.map(f => {
      const d = parseYmd(f.fecha), esta = f.fecha >= s.inicio && f.fecha <= s.fin, pasada = f.fecha < s.inicio;
      return `<div class="disc ${esta ? 'disc-esta' : ''} ${pasada ? 'disc-pasada' : ''}">
        <div class="disc-cab"><span>${esc(DIAS[d.getDay()])} ${d.getDate()} de ${esc(MESES[d.getMonth()])}</span>${esta ? '<em>Esta semana</em>' : ''}</div>
        ${iDisc >= 0 && f.valores[iDisc] ? `<div class="disc-tema">${esc(f.valores[iDisc])}</div>` : ''}
        <div class="disc-datos">${t.columnas.map((c, i) => i === iDisc || !f.valores[i] ? '' : `<div><small>${esc(c)}</small><b>${nom(f.valores[i])}</b></div>`).join('')}</div>
      </div>`;
    }).join('') + (pasadas ? `<button class="tp-pasadas" style="margin-bottom:14px" onclick="verSemanasPasadas('${esc(t.id)}')">${verPasadas ? 'Ocultar las semanas pasadas' : `Ver ${pasadas} semana${pasadas === 1 ? '' : 's'} que ya pasaron`}</button>` : '');
  }

  /* ---------- Discursos públicos en bloques ("7 de noviembre • Discurso No. 56", tema, Orador:, Presidente:…) ---------- */
  const ETIQ = ['orador', 'presidente', 'lector', 'hospitalidad', 'discursante'];
  function campo(t, re) {
    const m = t.match(re);
    if (!m) return '';
    // el valor termina donde empieza otra etiqueta (columnas lado a lado) o en un hueco grande
    return m[1].split(/\s{3,}|\t|\s+(?=(?:Orador|Presidente|Lector|Hospitalidad|Discursa\w*)\b)/i)[0].replace(/\s+/g, ' ').replace(/[|_—\[\]]+/g, '').trim();
  }
  function leerBloqueDiscurso(t, anioBase) {
    const mf = t.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)/i);
    if (!mf) return null;
    const mes = MESES.indexOf(norm(mf[2]));
    if (mes < 0) return null;
    const num = (t.match(/Discurso\s*N\s*[oº°.]*\s*(\d+)/i) || [])[1] || '';
    let tema = ([...t.matchAll(/[“"«]\s*([^”"»\n]{4,}?)\s*[”"»]/g)].map(m => m[1]).find(x => !/Discurso\s*N/i.test(x)) || '');
    if (!tema) {
      const l = t.split('\n').map(x => x.trim()).filter(Boolean);
      const i = l.findIndex(x => /Discurso\s*N/i.test(x));
      const sig = i >= 0 ? l.slice(i + 1).find(x => !/Discurso\s*N/i.test(x)) : null;
      if (sig && !/:/.test(sig) && !/^\(?congregaci/i.test(sig)) tema = sig.replace(/^["“”«»]+|["“”«»]+$/g, '');
    }
    const orador = campo(t, /Orador\s*:\s*(.+)/i);
    let saliente = campo(t, /Discursa\w*\s+\S+\s*:\s*(.+)/i);
    const cong = (t.match(/[([]congregaci[oó]n\s+([^)\]]+)[)\]]/i) || [])[1];
    if (saliente && cong && !/\(/.test(saliente)) saliente += ` (${cong.replace(/\s+/g, ' ').trim()})`;
    return {
      fecha: `${anioBase}-${z2(mes + 1)}-${z2(mf[1])}`,
      valores: [[num ? `No. ${num}` : '', tema.replace(/\s+/g, ' ').trim()].filter(Boolean).join(' '),
        orador, campo(t, /Presidente\s*:\s*(.+)/i), campo(t, /Lector\s*:\s*(.+)/i), campo(t, /Hospitalidad\s*:\s*(.+)/i), saliente]
    };
  }
  /* Un texto con varios bloques (PDF con texto o lectura completa de una imagen) */
  function leerDiscursos(texto, anioBase = new Date().getFullYear()) {
    const partes = String(texto).split(/\n(?=[^\n]*\d{1,2}\s+de\s+[a-záéíóú]+[^\n]*Discurso)/i);
    return partes.map(p => leerBloqueDiscurso(p, anioBase)).filter(Boolean)
      .filter((f, i, a) => a.findIndex(x => x.fecha === f.fecha) === i);
  }
  const faltan = f => f.valores.slice(0, 4).filter(v => !v).length;

  return { leerDiscursos, leerBloqueDiscurso, faltan, CONFIG, SECCIONES_TABLA, fechasDelMes, nombreMes, leerFilas, leerCeldas, fechaDe, html, tarjetas, diasReunion, sinAsignar };
})();
