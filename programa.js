/* Programa de la reunión de entre semana: leer el PDF, separarlo por semana y mostrarlo */
const Programa = (() => {
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const SECCIONES_P = {
    'tesoros de la biblia': { nombre: 'Tesoros de la Biblia', color: '#3d6b75' },
    'seamos mejores maestros': { nombre: 'Seamos mejores maestros', color: '#946f2a' },
    'nuestra vida cristiana': { nombre: 'Nuestra vida cristiana', color: '#8b2f2b' }
  };

  /* 1. Leer las líneas de texto del PDF (en el teléfono, sin internet) */
  async function leerLineas(buffer) {
    const base = new URL('../lib/pdfjs/', location.href).href;
    const pdfjs = await import(base + 'pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({ data: buffer }).promise;
    const lineas = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pag = await doc.getPage(n);
      const tc = await pag.getTextContent();
      const filas = [];
      tc.items.forEach(it => {
        if (!it.str || !it.str.trim()) return;
        const x = it.transform[4], y = it.transform[5], h = Math.abs(it.transform[3]) || 10;
        let f = filas.find(f => Math.abs(f.y - y) < Math.max(2, h * 0.35));
        if (!f) { f = { y, items: [] }; filas.push(f); }
        f.items.push({ x, w: it.width || 0, s: it.str });
      });
      filas.sort((a, b) => b.y - a.y).forEach(f => {
        f.items.sort((a, b) => a.x - b.x);
        let t = '', fin = null;
        f.items.forEach(it => {
          // un hueco grande = otra columna (ej. el nombre del presidente junto a la fecha)
          if (t && fin != null && it.x - fin > 25) t += '\t';
          else if (t && (fin == null || it.x - fin > 1.2) && !/\s$/.test(t) && !/^\s/.test(it.s)) t += ' ';
          t += it.s; fin = it.x + it.w;
        });
        t = t.replace(/[ \u00a0]+/g, ' ').replace(/ *\t */g, '\t').trim();
        if (t) lineas.push(t);
      });
    }
    return lineas;
  }

  /* 2. Interpretar las líneas: una entrada por semana */
  const limpiarNombre = n => {
    n = n.replace(/\s+/g, ' ').trim();
    const m = n.match(/^([^,]+),\s*(.+)$/);           // "Ruíz, Erick" → "Erick Ruíz"
    return m ? `${m[2].trim()} ${m[1].trim()}` : n;
  };
  const personas = t => String(t || '').split('/').map(limpiarNombre).filter(Boolean);

  function interpretar(lineas) {
    const semanas = [];
    let s = null;
    const reFecha = /^(\d{1,2}) de ([a-záéíóú]+) de (\d{4})\s*\|\s*(.*)$/i;
    for (let bruta of lineas) {
      if (/Reuni[oó]n de entre semana/i.test(bruta) || /^\d{1,2}\/\d{1,2}\/\d{4}/.test(bruta)) continue;
      if (/^Presidente$/i.test(bruta.trim())) continue;               // la etiqueta sola; el nombre viene junto a la fecha
      const cols = bruta.split('\t');
      let l = bruta.replace(/\t/g, ' ');
      const mf = cols[0].match(reFecha);
      if (mf) {
        const mes = MESES.indexOf(norm(mf[2]));
        if (mes < 0) continue;
        s = { fecha: `${mf[3]}-${String(mes + 1).padStart(2, '0')}-${String(mf[1]).padStart(2, '0')}`, lectura: '', presidente: '', items: [] };
        semanas.push(s);
        l = mf[4];
        const derecha = cols.slice(1).join(' ').replace(/^Presidente\s+/i, '').trim();
        if (derecha) s.presidente = limpiarNombre(derecha);
        if (!l) continue;
      }
      if (!s) continue;
      // presidente (a veces viene en la misma línea que la lectura)
      const mp = l.match(/^(.*?)\s*Presidente\s+(.+)$/i);
      if (mp) { if (mp[1] && !s.items.length) s.lectura = (s.lectura + ' ' + mp[1]).trim(); s.presidente = limpiarNombre(mp[2]); continue; }
      const mc = l.match(/^(Canci[oó]n\s+\d+\s*:.*?)(?:\s+Oraci[oó]n\s+(.+))?$/i);
      if (mc) { s.items.push({ t: 'cancion', texto: mc[1].trim(), oracion: mc[2] ? limpiarNombre(mc[2]) : '' }); continue; }
      const sec = SECCIONES_P[norm(l)];
      if (sec) { s.items.push({ t: 'seccion', nombre: sec.nombre, color: sec.color }); continue; }
      const mpar = l.match(/^(\d+)\.\s*(.+?)\s*\((\d+)\s*min[s]?\.?\)\s*(.*)$/i);
      if (mpar) { s.items.push({ t: 'parte', num: +mpar[1], titulo: mpar[2].trim(), min: +mpar[3], personas: personas(mpar[4]) }); continue; }
      if (!s.items.length) { s.lectura = (s.lectura + ' ' + l).trim(); continue; }
      s.items.push({ t: 'texto', texto: l });
    }
    semanas.forEach(x => {
      const d = parseYmd(x.fecha); d.setHours(12);
      const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow);
      x.inicio = ymd(d); x.fin = addDias(x.inicio, 6);
      x.lectura = x.lectura.replace(/\s+/g, ' ').trim();
    });
    return semanas.filter(x => x.items.some(i => i.t === 'parte'));
  }

  /* 3. Asignaciones que salen del programa (para Mis asignaciones, recordatorios e historial) */
  function asignaciones(s) {
    const out = [];
    const add = (asignacion, hermano) => { if (hermano) out.push({ fecha: s.fecha, seccion: 'entresemana', asignacion, hermano }); };
    add('Presidente', s.presidente);
    const canc = s.items.filter(i => i.t === 'cancion' && i.oracion);
    if (canc.length) add('Oración inicial', canc[0].oracion);
    if (canc.length > 1) add('Oración final', canc[canc.length - 1].oracion);
    s.items.filter(i => i.t === 'parte').forEach(p => {
      if (p.personas.length < 2) return add(p.titulo, p.personas[0]);
      const estudio = /estudio b[ií]blico/i.test(p.titulo);
      add(estudio ? `${p.titulo} (conductor)` : p.titulo, p.personas[0]);
      p.personas.slice(1).forEach(n => add(estudio ? `${p.titulo} (lector)` : `${p.titulo} (ayudante)`, n));
    });
    return out;
  }

  async function desdeArchivo(file) {
    const lineas = await leerLineas(await file.arrayBuffer());
    return interpretar(lineas);
  }

  /* 4. Dibujar el programa de una semana */
  function html(s, resaltar = '') {
    const r = norm(resaltar);
    const nom = n => `<span class="${r && r.length >= 3 && norm(n).includes(r) ? 'yo-nombre' : ''}">${esc(n)}</span>`;
    const d = parseYmd(s.fecha);
    let cuerpo = '';
    s.items.forEach(i => {
      if (i.t === 'seccion') cuerpo += `<div class="pg-sec" style="background:${i.color}">${esc(i.nombre)}</div>`;
      else if (i.t === 'cancion') cuerpo += `<div class="pg-fila pg-cancion"><span>${esc(i.texto)}</span>${i.oracion ? `<span class="pg-quien"><small>Oración</small> ${nom(i.oracion)}</span>` : ''}</div>`;
      else if (i.t === 'parte') cuerpo += `<div class="pg-fila"><span><b>${i.num}.</b> ${esc(i.titulo)} <small>(${i.min} min)</small></span><span class="pg-quien">${i.personas.map(nom).join('<br>')}</span></div>`;
      else cuerpo += `<div class="pg-fila pg-texto"><span>${esc(i.texto)}</span></div>`;
    });
    return `<div class="programa">
      <div class="pg-cab"><div><div class="pg-fecha">${esc(DIAS[d.getDay()])} ${d.getDate()} de ${MESES[d.getMonth()]}</div>
        <div class="pg-lectura">${esc(s.lectura)}</div></div>
        ${s.presidente ? `<div class="pg-quien"><small>Presidente</small> ${nom(s.presidente)}</div>` : ''}</div>
      ${cuerpo}</div>`;
  }

  return { leerLineas, interpretar, asignaciones, desdeArchivo, html };
})();
