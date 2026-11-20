/* Cartas de la sucursal ("Anuncios y recordatorios", S-147) e "Informe mensual de las cuentas" (S-30):
   los ancianos suben el PDF, la app lo lee y los publicadores lo ven ordenado y fácil de leer. */
const Docs = (() => {
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const RE_MES = new RegExp('\\b(' + MESES.join('|') + ')\\s+de\\s+(\\d{4})\\b', 'i');

  /* Líneas del PDF, sabiendo qué partes están en negrita (los títulos de cada anuncio) */
  async function leerPdf(buffer) {
    const base = new URL('../lib/pdfjs/', location.href).href;
    const pdfjs = await import(base + 'pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({ data: buffer }).promise;
    const lineas = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pag = await doc.getPage(n);
      try { await pag.getOperatorList(); } catch (e) {}
      const tc = await pag.getTextContent();
      const negrita = id => { try { return /bold|black|heavy|semibold/i.test(pag.commonObjs.get(id).name || ''); } catch (e) { return false; } };
      const filas = [];
      tc.items.forEach(it => {
        if (!it.str) return;
        const x = it.transform[4], y = it.transform[5], h = Math.abs(it.transform[3]) || 10;
        let f = filas.find(f => Math.abs(f.y - y) < Math.max(2, h * 0.35));
        if (!f) { f = { y, items: [] }; filas.push(f); }
        f.items.push({ x, w: it.width || 0, s: it.str, b: negrita(it.fontName) });
      });
      filas.sort((a, b) => b.y - a.y).forEach(f => {
        f.items.sort((a, b) => a.x - b.x);
        const segs = []; let fin = null;
        f.items.forEach(it => {
          let s = it.s;
          if (segs.length && fin != null && it.x - fin > 25) s = '\t' + s;
          else if (segs.length && fin != null && it.x - fin > 1.2 && !/\s$/.test(segs[segs.length - 1].s) && !/^\s/.test(s)) s = ' ' + s;
          const ult = segs[segs.length - 1];
          if (ult && ult.b === it.b) ult.s += s; else segs.push({ s, b: it.b });
          fin = it.x + it.w;
        });
        segs.forEach(s => { s.s = s.s.replace(/[  ]+/g, ' '); });
        const t = segs.map(s => s.s).join('').replace(/ *\t */g, '\t').trim();
        if (t) lineas.push({ t, segs });
      });
    }
    return lineas;
  }

  async function desdeArchivo(file) {
    const lineas = await leerPdf(await file.arrayBuffer());
    const todo = lineas.map(l => l.t).join('\n');
    if (/INFORME MENSUAL DE LAS CUENTAS/i.test(todo)) return leerCuentas(lineas);
    return leerCartas(lineas);
  }

  /* ---------- Anuncios y recordatorios (cartas) ---------- */
  function leerCartas(lineas) {
    const r = { tipo: 'cartas', titulo: '', mes: '', items: [] };
    let seccion = '', condicion = '', enCorchete = false, cur = null;
    const cerrar = () => { if (cur) { cur.titulo = limpiarT(cur.titulo); cur.texto = limpiarT(cur.texto); r.items.push(cur); cur = null; } };
    lineas.forEach((l, i) => {
      const t = l.t.replace(/\t/g, ' ').trim();
      if (!r.titulo && i < 3 && l.segs.every(s => s.b || !s.s.trim())) { r.titulo = t; return; }
      if (!r.mes && RE_MES.test(t) && t.length < 30) { r.mes = t; return; }
      if (/^S-\d{2,4}[-\s]/.test(t) || /^\d+\s*$/.test(t)) return;                       // pie de página / número de página
      if (enCorchete || /^\[/.test(t)) {                                                  // [Lea el siguiente anuncio solo si…]
        cerrar();
        condicion += (condicion ? ' ' : '') + t.replace(/^\[|\]\.?$/g, '');
        enCorchete = !/\]/.test(t);
        return;
      }
      if (t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{4}/.test(t) && !/^\d/.test(t)) { cerrar(); seccion = t; return; }  // PARA LAS CONGREGACIONES
      const m = t.match(/^(\d{1,2})\.\s*(.*)$/);
      if (m) {
        cerrar();
        // el título es la parte en negrita del principio
        let titulo = '', resto = '', enTitulo = true;
        l.segs.forEach(s => { const x = s.s.replace(/^\s*\d{1,2}\.\s*/, ''); if (enTitulo && (s.b || !x.trim())) titulo += x; else { enTitulo = false; resto += x; } });
        if (!titulo.trim()) { const p = m[2].match(/^(.{5,90}?[.:!?])\s+(.*)$/); titulo = p ? p[1] : m[2]; resto = p ? p[2] : ''; }
        const soloAncianos = seccion && !/congregaci|publicador/i.test(seccion);
        cur = { num: Number(m[1]), titulo, texto: resto, seccion, condicion, incluir: !condicion && !soloAncianos };
        condicion = '';
        return;
      }
      if (!cur) return;
      // si el título seguía en la línea siguiente (en negrita), se le agrega
      if (!cur.texto.trim() && l.segs[0] && l.segs[0].b) {
        let enTitulo = true;
        l.segs.forEach(s => { if (enTitulo && (s.b || !s.s.trim())) cur.titulo += ' ' + s.s; else { enTitulo = false; cur.texto += s.s; } });
        return;
      }
      cur.texto += (cur.texto && !/-$/.test(cur.texto) ? ' ' : '') + t;
    });
    cerrar();
    if (!r.titulo) r.titulo = 'Anuncios y recordatorios';
    // Si no tiene anuncios numerados, todo el texto es una sola carta
    if (!r.items.length) r.items.push({ num: 0, titulo: r.titulo, texto: limpiarT(lineas.slice(1).map(l => l.t).join(' ')), seccion: '', condicion: '', incluir: true });
    return r;
  }
  const limpiarT = s => String(s || '').replace(/\s+/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();

  /* ---------- Informe mensual de las cuentas (S-30) ---------- */
  const numero = s => { const m = String(s).replace(/\s/g, '').match(/(-?)[\d,]*\.?\d+$/); return m ? Number(m[0].replace(/,/g, '')) : null; };
  function leerCuentas(lineas) {
    const L = lineas.map(l => l.t);
    const monto = t => { const m = t.match(/(-\s?)?[\d,]+\.\d{2}\s*$/); return m ? numero(m[0]) : null; };
    const concepto = t => t.replace(/(-\s?)?[\d,]+\.\d{2}\s*$/, '').replace(/\t+/g, ' ').trim();
    const buscar = re => { const t = L.find(x => re.test(x) && monto(x) != null); return t ? monto(t) : null; };
    const entre = (ini, fin) => {
      const a = L.findIndex(x => ini.test(x)); if (a < 0) return [];
      const r = [];
      for (let i = a + 1; i < L.length && !fin.test(L[i]); i++) { const v = monto(L[i]); if (v != null) r.push({ concepto: concepto(L[i]), monto: v }); }
      return r;
    };
    const cab = L.find(x => RE_MES.test(x) && /\(\d+\)/.test(x)) || L.find(x => RE_MES.test(x)) || '';
    const mm = cab.match(RE_MES);
    const congr = cab.replace(RE_MES, '').replace(/\t+/g, ' ').trim();
    const iLeer = L.findIndex(x => /LEER A LA CONGREGACI/i.test(x));
    const leer = iLeer >= 0 ? limpiarT(L.slice(iLeer + 1).join(' ')) : '';
    const res = L.find(x => /^(Déficit|Deficit|Superávit|Superavit)/i.test(x.trim()));
    return {
      tipo: 'cuentas',
      titulo: 'Informe de las cuentas de la congregación',
      mes: mm ? mm[1].toLowerCase() + ' de ' + mm[2] : '',
      congregacion: congr,
      moneda: (leer.match(/\b([A-Z]{3})\s?[\d]/) || [])[1] || 'GTQ',
      inicio: buscar(/Fondos al comienzo/i),
      donaciones: entre(/RECIBIDO PARA LA CONGREGACI/i, /Total recibido/i),
      recibido: buscar(/Total recibido para la congregaci/i),
      otrosIngresos: entre(/OTROS INGRESOS/i, /Total de otros ingresos/i),
      ingresos: buscar(/^\s*Total de ingresos/i),
      gastos: entre(/GASTOS DE LA CONGREGACI/i, /Total de gastos/i),
      totalGastos: buscar(/Total de gastos de la congregaci/i),
      otrosDesembolsos: entre(/OTROS DESEMBOLSOS/i, /Total de otros desembolsos/i),
      desembolsos: buscar(/^\s*Total de desembolsos/i),
      resultado: res ? { tipo: /d[ée]ficit/i.test(res) ? 'Déficit' : 'Superávit', monto: Math.abs(monto(res) || 0) } : null,
      final: buscar(/Fondos de la congregaci[oó]n al final/i),
      prevision: buscar(/Total de Previsi[oó]n/i),
      disponibles: buscar(/DISPONIBLES AL FINAL/i),
      leer,
    };
  }

  /* ---------- Cómo se ven en la app ---------- */
  const dinero = (v, mon = 'GTQ') => v == null ? '—' : (mon === 'GTQ' ? 'Q' : mon + ' ') + Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const datosDe = a => { if (a.datos && typeof a.datos === 'object') return a.datos; try { return JSON.parse(a.datos || '{}'); } catch (e) { return {}; } };

  function htmlCartas(d, opciones = {}) {
    const items = opciones.todos ? d.items : d.items.filter(x => x.incluir !== false);
    return `<div class="carta">
      <div class="carta-cab"><span class="carta-ico">✉️</span><div><div class="carta-t">${esc(d.titulo || 'Anuncios y recordatorios')}</div>${d.mes ? `<div class="carta-m cap">${esc(d.mes)}</div>` : ''}</div></div>
      ${items.map((x, i) => `<details class="carta-item" ${i === 0 && !opciones.todos ? 'open' : ''}>
        <summary>${opciones.todos ? `<input type="checkbox" data-i="${d.items.indexOf(x)}" ${x.incluir !== false ? 'checked' : ''} onclick="event.stopPropagation()">` : ''}${x.num ? `<span class="carta-n">${x.num}</span>` : ''}<span class="carta-it">${esc(x.titulo)}</span></summary>
        ${x.condicion ? `<div class="carta-cond">${esc(x.condicion)}</div>` : ''}
        ${x.seccion && opciones.todos ? `<div class="small muted">${esc(x.seccion)}</div>` : ''}
        <p>${esc(x.texto)}</p></details>`).join('')}
    </div>`;
  }

  function htmlCuentas(d) {
    const mon = d.moneda || 'GTQ';
    const filas = (l) => (l || []).map(x => `<div class="cu-fila"><span>${esc(x.concepto)}</span><b>${dinero(x.monto, mon)}</b></div>`).join('');
    const def = d.resultado && d.resultado.tipo === 'Déficit';
    return `<div class="cuentas">
      <div class="carta-cab"><span class="carta-ico">📊</span><div><div class="carta-t">Informe de las cuentas</div>${d.mes ? `<div class="carta-m">${esc(d.mes)}</div>` : ''}</div></div>
      <div class="cu-res">
        <div><small>Donaciones recibidas</small><b>${dinero(d.recibido, mon)}</b></div>
        <div><small>Gastos de la congregación</small><b>${dinero(d.totalGastos, mon)}</b></div>
        <div class="cu-final"><small>Fondos al final del mes</small><b>${dinero(d.disponibles != null ? d.disponibles : d.final, mon)}</b></div>
      </div>
      ${d.resultado ? `<div class="cu-nota ${def ? 'def' : 'sup'}">${def ? 'Este mes los gastos fueron mayores que las donaciones' : 'Este mes las donaciones fueron mayores que los gastos'}: ${esc(d.resultado.tipo.toLowerCase())} de <b>${dinero(d.resultado.monto, mon)}</b>.</div>` : ''}
      ${d.leer ? `<blockquote class="cu-leer">${esc(d.leer)}</blockquote>` : ''}
      <details class="cu-det"><summary>Ver el informe completo</summary>
        <div class="cu-fila"><span>Fondos al comienzo del mes</span><b>${dinero(d.inicio, mon)}</b></div>
        <div class="cu-sub">Ingresos</div>${filas(d.donaciones)}${filas(d.otrosIngresos)}
        <div class="cu-fila tot"><span>Total de ingresos</span><b>${dinero(d.ingresos, mon)}</b></div>
        <div class="cu-sub">Desembolsos</div>${filas(d.gastos)}${filas(d.otrosDesembolsos)}
        <div class="cu-fila tot"><span>Total de desembolsos</span><b>${dinero(d.desembolsos, mon)}</b></div>
        ${d.resultado ? `<div class="cu-fila"><span>${esc(d.resultado.tipo)}</span><b>${def ? '− ' : ''}${dinero(d.resultado.monto, mon)}</b></div>` : ''}
        <div class="cu-fila"><span>Fondos al final del mes</span><b>${dinero(d.final, mon)}</b></div>
        ${d.prevision ? `<div class="cu-fila"><span>Previsión para grandes gastos</span><b>${dinero(d.prevision, mon)}</b></div>` : ''}
        <div class="cu-fila tot"><span>Disponibles al final del mes</span><b>${dinero(d.disponibles, mon)}</b></div>
        <p class="small muted" style="margin:8px 0 0">«Obra mundial» son las donaciones para la obra mundial: se reciben y se envían completas.</p>
      </details>
    </div>`;
  }

  /* Texto corto para el aviso al teléfono */
  function resumen(d) {
    if (d.tipo === 'cuentas') return `Recibido ${dinero(d.recibido, d.moneda)} · Gastos ${dinero(d.totalGastos, d.moneda)} · Fondos ${dinero(d.disponibles != null ? d.disponibles : d.final, d.moneda)}`;
    return d.items.filter(x => x.incluir !== false).map(x => x.titulo.replace(/[.:]$/, '')).join(' · ').slice(0, 170);
  }
  function tituloDe(d) {
    const m = (d.mes || '').split(' ')[0].toLowerCase();
    return d.tipo === 'cuentas' ? 'Informe de cuentas' + (m ? ' de ' + m : '') : (d.titulo || 'Anuncios y recordatorios') + (m ? ' de ' + m : '');
  }

  return { desdeArchivo, leerPdf, leerCartas, leerCuentas, htmlCartas, htmlCuentas, datosDe, resumen, tituloDe, dinero };
})();
