/* Leer tablas desde una imagen (foto o diseño), un Excel o un CSV.
   Todo se hace en el teléfono; las librerías se descargan solo la primera vez. */
const Lector = (() => {
  const base = () => new URL('../lib/', location.href).href;
  const cargarScript = src => new Promise((res, rej) => {
    if ([...document.scripts].some(s => s.src === src)) return res();
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src.split('/').pop()));
    document.head.appendChild(s);
  });

  /* ---------- Excel / CSV ---------- */
  async function leerExcel(file) {
    await cargarScript(base() + 'xlsx/xlsx.full.min.js');
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    const filas = [];
    wb.SheetNames.forEach(n => {
      XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }).forEach(r => {
        filas.push(r.map(c => c instanceof Date ? ymd(new Date(c.getFullYear(), c.getMonth(), c.getDate() + (c.getHours() >= 12 ? 1 : 0))) : String(c ?? '').trim()));
      });
    });
    return filas;
  }

  /* ---------- Imagen: detectar la cuadrícula y leer cada casilla ---------- */
  let workerP = null;
  async function lectorTexto(progreso) {
    if (!window.Tesseract) await cargarScript(base() + 'ocr/tesseract.min.js');
    if (!workerP) {
      workerP = Tesseract.createWorker('spa', 1, {
        workerPath: base() + 'ocr/worker.min.js', corePath: base() + 'ocr/', langPath: base() + 'ocr/lang', gzip: true,
        logger: m => progreso && m.status && progreso(m)
      }).then(async w => { await w.setParameters({ tessedit_pageseg_mode: '6' }); return w; });
    }
    return workerP;
  }
  function grises(ctx, W, H) {
    const d = ctx.getImageData(0, 0, W, H).data, g = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) g[i] = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000;
    return g;
  }
  /* Para cada fila (o columna), la corrida más larga de píxeles oscuros: así se distinguen las líneas de la tabla del texto */
  function corridas(g, W, H, vertical) {
    const n = vertical ? W : H, m = vertical ? H : W, largo = new Int32Array(n), ini = new Int32Array(n), fin = new Int32Array(n);
    for (let a = 0; a < n; a++) {
      let run = 0, s = 0;
      for (let b = 0; b < m; b++) {
        const v = vertical ? g[b * W + a] : g[a * W + b];
        if (v < 150) { if (!run) s = b; run++; if (run > largo[a]) { largo[a] = run; ini[a] = s; fin[a] = b; } } else run = 0;
      }
    }
    return { largo, ini, fin };
  }
  function agrupar(posiciones) {
    const out = [];
    let grupo = [];
    posiciones.forEach(p => {
      if (grupo.length && p - grupo[grupo.length - 1] > 3) { out.push(grupo); grupo = []; }
      grupo.push(p);
    });
    if (grupo.length) out.push(grupo);
    return out.map(gr => ({ a: gr[0], b: gr[gr.length - 1] }));
  }
  function cuadricula(g, W, H) {
    const cv = corridas(g, W, H, true);
    const candV = [];
    for (let x = 0; x < W; x++) if (cv.largo[x] > H * 0.3) candV.push(x);
    const bandasV = agrupar(candV);
    if (bandasV.length < 2) return null;
    const xs = bandasV.map(b => Math.round((b.a + b.b) / 2));
    const top = Math.min(...bandasV.map(b => cv.ini[b.a])), bot = Math.max(...bandasV.map(b => cv.fin[b.a]));
    const ancho = xs[xs.length - 1] - xs[0];
    const ch = corridas(g, W, H, false);
    const candH = [];
    for (let y = Math.max(0, top - 4); y <= Math.min(H - 1, bot + 4); y++) if (ch.largo[y] > ancho * 0.5) candH.push(y);
    const ys = agrupar(candH).flatMap(b => b.b - b.a > 14 ? [b.a, b.b] : [Math.round((b.a + b.b) / 2)]);
    return ys.length >= 2 ? { xs, ys } : null;
  }
  const limpiar = t => String(t || '').replace(/[|_—–=\[\]{}"“”'‘’`~^*#@<>«»©®]+/g, ' ').replace(/\s+/g, ' ')
    .replace(/^[^\p{L}\d]+|[^\p{L}\d.)]+$/gu, '').trim();

  async function leerImagen(file, progreso = () => {}) {
    progreso('Preparando la imagen…');
    const bmp = file instanceof HTMLCanvasElement ? file : await createImageBitmap(file);
    const esc = bmp.width < 1200 ? 1200 / bmp.width : bmp.width > 2400 ? 2400 / bmp.width : 1;
    const W = Math.round(bmp.width * esc), H = Math.round(bmp.height * esc);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.drawImage(bmp, 0, 0, W, H);
    const g = grises(ctx, W, H);
    const red = cuadricula(g, W, H);
    if (!red) throw new Error('No se encontró una tabla con líneas en la imagen');
    progreso('Cargando el lector de texto (la primera vez tarda un poco)…');
    const w = await lectorTexto(m => { if (m.status === 'loading language traineddata' || m.status === 'loading tesseract core') progreso('Descargando el lector de texto…'); });
    const filas = [];
    const total = (red.ys.length - 1) * (red.xs.length - 1);
    let hechas = 0;
    for (let r = 0; r < red.ys.length - 1; r++) {
      const fila = [];
      for (let c = 0; c < red.xs.length - 1; c++) {
        hechas++;
        const x0 = red.xs[c], x1 = red.xs[c + 1], y0 = red.ys[r], y1 = red.ys[r + 1];
        const m = Math.max(4, Math.round(Math.min(x1 - x0, y1 - y0) * 0.06));
        const cw = x1 - x0 - 2 * m, chh = y1 - y0 - 2 * m;
        if (cw < 12 || chh < 12) { fila.push(''); continue; }
        // recortar la casilla; si el fondo es oscuro (encabezado azul), se invierte
        const k = chh < 70 ? 70 / chh : 1;
        const cel = document.createElement('canvas'); cel.width = Math.round(cw * k); cel.height = Math.round(chh * k);
        const cx = cel.getContext('2d', { willReadFrequently: true });
        cx.drawImage(cv, x0 + m, y0 + m, cw, chh, 0, 0, cel.width, cel.height);
        const id = cx.getImageData(0, 0, cel.width, cel.height), d = id.data;
        let suma = 0;
        for (let i = 0; i < d.length; i += 4) suma += (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
        if (suma / (d.length / 4) < 120) { for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; } cx.putImageData(id, 0, 0); }
        progreso(`Leyendo casilla ${hechas} de ${total}…`);
        const { data } = await w.recognize(cel);
        fila.push(limpiar(data.text));
      }
      if (fila.some(Boolean)) filas.push(fila);
    }
    return filas;
  }

  /* ---------- Discursos públicos en bloques: se detecta cada franja azul de encabezado y se lee el bloque ---------- */
  async function aCanvas(src, minAncho = 1200) {
    const bmp = src instanceof HTMLCanvasElement ? src : await createImageBitmap(src);
    const k = Math.min(4, Math.max(1, minAncho / bmp.width));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
    return cv;
  }
  /* Borra los bordes finos de los recuadros (confunden al lector); deja el texto y las franjas gruesas */
  function borrarLineasFinas(c) {
    const ctx = c.getContext('2d', { willReadFrequently: true }), W = c.width, H = c.height;
    const id = ctx.getImageData(0, 0, W, H), d = id.data;
    const tinta = i => { const l = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000; return l < 200 || (d[i + 2] - d[i] > 50); };
    const filas = [];
    for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x++) if (tinta((y * W + x) * 4)) n++; if (n > W * 0.5) filas.push(y); }
    agrupar(filas).filter(b => b.b - b.a <= 6).forEach(b => { for (let y = Math.max(0, b.a - 1); y <= Math.min(H - 1, b.b + 1); y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; } });
    const cols = [];
    for (let x = 0; x < W; x++) { let run = 0, max = 0; for (let y = 0; y < H; y++) { if (tinta((y * W + x) * 4)) { run++; if (run > max) max = run; } else run = 0; } if (max > H * 0.25) cols.push(x); }
    agrupar(cols).filter(b => b.b - b.a <= 6).forEach(b => { for (let x = Math.max(0, b.a - 1); x <= Math.min(W - 1, b.b + 1); x++) for (let y = 0; y < H; y++) { const i = (y * W + x) * 4; if (!(d[i + 2] - d[i] > 50 && d[i + 2] > 120 && y < H * 0.25)) { d[i] = d[i + 1] = d[i + 2] = 255; } } });
    ctx.putImageData(id, 0, 0);
  }
  async function leerDiscursosImagen(src, anioBase, progreso = () => {}) {
    progreso('Preparando la imagen…');
    const cv = await aCanvas(src, 1300), W = cv.width, H = cv.height;
    const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    const filas = [];
    for (let y = 0; y < H; y++) {
      let n = 0;
      for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (d[i + 2] > 120 && d[i + 2] - d[i] > 50) n++; }
      if (n > W * 0.45) filas.push(y);
    }
    const bandas = agrupar(filas).filter(b => b.b - b.a >= Math.max(8, H * 0.006));
    progreso('Cargando el lector de texto (la primera vez tarda un poco)…');
    const w = await lectorTexto();
    const leer = async (canvas, psm) => { await w.setParameters({ tessedit_pageseg_mode: psm }); const { data } = await w.recognize(canvas); await w.setParameters({ tessedit_pageseg_mode: '6' }); return data.text; };
    if (!bandas.length) {
      progreso('Leyendo el texto…');
      return Tablas.leerDiscursos(await leer(cv, '6'), anioBase);
    }
    const out = [];
    for (let i = 0; i < bandas.length; i++) {
      progreso(`Leyendo el bloque ${i + 1} de ${bandas.length}…`);
      const y0 = Math.max(0, bandas[i].a - 3), y1 = i + 1 < bandas.length ? bandas[i + 1].a - 3 : H;
      const c = document.createElement('canvas'); c.width = W; c.height = y1 - y0;
      c.getContext('2d', { willReadFrequently: true }).drawImage(cv, 0, y0, W, y1 - y0, 0, 0, W, y1 - y0);
      borrarLineasFinas(c);
      let f = Tablas.leerBloqueDiscurso(await leer(c, '6'), anioBase);
      if (!f || Tablas.faltan(f) || f.valores.some(v => !v)) {
        // segunda lectura con otro modo; se combinan las dos para completar lo que faltó
        const g = Tablas.leerBloqueDiscurso(await leer(c, '4'), anioBase);
        if (!f) f = g;
        else if (g) f.valores = f.valores.map((v, j) => v || g.valores[j]);
      }
      if (f) out.push(f);
    }
    return out.filter((f, i, a) => a.findIndex(x => x.fecha === f.fecha) === i);
  }

  /* PDF que en realidad es una imagen (sin texto): se dibuja cada página y se lee como imagen */
  async function pdfACanvas(file) {
    const pdfjs = await import(base() + 'pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = base() + 'pdfjs/pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const out = [];
    for (let n = 1; n <= Math.min(doc.numPages, 4); n++) {
      const pag = await doc.getPage(n), v1 = pag.getViewport({ scale: 1 });
      const vp = pag.getViewport({ scale: Math.min(4, 1300 / Math.max(v1.width, v1.height)) });
      const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      await pag.render({ canvasContext: ctx, viewport: vp }).promise;
      out.push(cv);
    }
    return out;
  }
  async function leerPdfImagen(file, progreso = () => {}) {
    progreso('El PDF es una imagen; preparándolo…');
    const pdfjs = await import(base() + 'pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = base() + 'pdfjs/pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const filas = [];
    for (let n = 1; n <= Math.min(doc.numPages, 4); n++) {
      const pag = await doc.getPage(n);
      const v1 = pag.getViewport({ scale: 1 });
      const vp = pag.getViewport({ scale: Math.min(4, 1300 / Math.max(v1.width, v1.height)) });
      const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      await pag.render({ canvasContext: ctx, viewport: vp }).promise;
      filas.push(...await leerImagen(cv, t => progreso((doc.numPages > 1 ? `Página ${n}: ` : '') + t)));
    }
    return filas;
  }

  const esImagen = f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name);
  const esExcel = f => /\.(xlsx|xls|xlsm|ods|csv)$/i.test(f.name) || /sheet|excel|csv/i.test(f.type);
  return { leerExcel, leerImagen, leerPdfImagen, leerDiscursosImagen, pdfACanvas, esImagen, esExcel, limpiar };
})();
