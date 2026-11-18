/* Mapa de territorios: funciona sin internet (los polígonos y el GPS están dentro de la app).
   Las calles del fondo se guardan en el teléfono cada vez que se ven con internet. */
const Mapa = (() => {
  let GEO = null;
  const COLORES = ['#3d6b75', '#946f2a', '#6a4c93', '#4f7a3a', '#8b2f2b', '#1f3a5f', '#a0522d', '#2e7d7a'];

  async function territorios() {
    if (GEO) return GEO;
    const r = await fetch(new URL('../territorios.geojson', location.href).href);
    GEO = await r.json();
    GEO.features.forEach(f => { f.properties.anillos = anillos(f); });
    return GEO;
  }
  const anillos = f => f.geometry.type === 'Polygon' ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map(p => p[0]);
  const numeros = () => GEO ? GEO.features.map(f => f.properties.numero) : [];
  const buscar = n => GEO && GEO.features.find(f => String(f.properties.numero) === String(n));

  function dentro(lng, lat, ring) {
    let si = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) si = !si;
    }
    return si;
  }
  function territorioDe(lat, lng) {
    if (!GEO) return null;
    const f = GEO.features.find(f => f.properties.anillos.some(r => dentro(lng, lat, r)));
    return f ? f.properties.numero : null;
  }
  function centro(n) {
    const f = buscar(n); if (!f) return null;
    const pts = f.properties.anillos.flat();
    let a = 0, cx = 0, cy = 0;
    const r = f.properties.anillos[0];
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const k = r[j][0] * r[i][1] - r[i][0] * r[j][1];
      a += k; cx += (r[j][0] + r[i][0]) * k; cy += (r[j][1] + r[i][1]) * k;
    }
    if (Math.abs(a) < 1e-12) return { lat: pts.reduce((s, p) => s + p[1], 0) / pts.length, lng: pts.reduce((s, p) => s + p[0], 0) / pts.length };
    return { lat: cy / (3 * a), lng: cx / (3 * a) };
  }

  /* Crea un mapa dentro de un elemento. Devuelve un objeto con métodos útiles. */
  function crear(el, opts = {}) {
    const map = L.map(el, { zoomControl: true, attributionControl: true, tap: true, preferCanvas: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, crossOrigin: 'anonymous',
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    const capas = {};
    let seleccionado = null;
    let colores = null; // si hay registro: color según el tiempo sin predicar
    const colorDe = n => (colores && colores[n]) || (colores ? ESTADOS.sin.color : COLORES[Number(n) % COLORES.length]);
    const estilo = (n, sel) => ({
      color: sel ? '#c9a227' : colorDe(n),
      weight: sel ? 4 : 2, opacity: .95,
      fillColor: colorDe(n), fillOpacity: sel ? .32 : (colores ? .26 : .12)
    });
    const grupo = L.geoJSON(GEO, {
      style: f => estilo(f.properties.numero, false),
      onEachFeature: (f, layer) => {
        const n = f.properties.numero;
        capas[n] = layer;
        layer.bindTooltip(String(n), { permanent: true, direction: 'center', className: 'tlabel' });
        layer.on('click', e => {
          if (opts.onClic && opts.onClic(e.latlng)) { L.DomEvent.stopPropagation(e); return; }
          if (opts.onMapa) { opts.onMapa(e.latlng); L.DomEvent.stopPropagation(e); return; }
          if (opts.onTerritorio) opts.onTerritorio(n);
        });
      }
    }).addTo(map);
    map.fitBounds(grupo.getBounds(), { padding: [12, 12] });
    if (opts.onMapa) map.on('click', e => opts.onMapa(e.latlng));
    if (opts.onClic) map.on('click', e => opts.onClic(e.latlng));
    if (opts.onArrastre) map.on('dragstart', opts.onArrastre);

    /* Puntos donde están predicando */
    const capaPuntos = L.layerGroup().addTo(map);
    function ponerPuntos(lista, mios = [], onClick) {
      capaPuntos.clearLayers();
      lista.forEach(pt => {
        const mio = mios.includes(pt.id);
        L.marker([pt.lat, pt.lng], {
          icon: L.divIcon({ className: 'pin-pred' + (mio ? ' mio' : ''), html: '<span></span><i></i>', iconSize: [30, 30], iconAnchor: [15, 30] }),
          zIndexOffset: 1000
        }).addTo(capaPuntos)
          .bindTooltip(esc(pt.nombre), { permanent: true, direction: 'top', offset: [0, -28], className: 'plabel' })
          .on('click', () => onClick && onClick(pt));
      });
    }

    /* Ruta */
    let capaRuta = null, destinoMk = null;
    function mostrarRuta(coords, recta, ajustar) {
      if (capaRuta) capaRuta.remove();
      capaRuta = L.layerGroup([
        L.polyline(coords, { color: '#fff', weight: 9, opacity: .9 }),
        L.polyline(coords, { color: '#1a73e8', weight: 5, opacity: .95, dashArray: recta ? '8 10' : null })
      ]).addTo(map);
      if (ajustar) map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 18 });
    }
    function marcarDestino(lat, lng) {
      if (destinoMk) destinoMk.remove();
      destinoMk = lat == null ? null : L.circleMarker([lat, lng], { radius: 11, color: '#1a73e8', weight: 3, fillColor: '#fff', fillOpacity: 1 }).addTo(map);
    }
    function limpiarRuta() { if (capaRuta) capaRuta.remove(); capaRuta = null; marcarDestino(null); }

    function seleccionar(n, acercar = true) {
      if (seleccionado != null && capas[seleccionado]) capas[seleccionado].setStyle(estilo(seleccionado, false));
      seleccionado = n;
      if (n == null || !capas[n]) return;
      capas[n].setStyle(estilo(n, true)); capas[n].bringToFront();
      if (acercar) map.fitBounds(capas[n].getBounds(), { padding: [24, 24], maxZoom: 18 });
    }
    function colorear(mapa) {
      colores = mapa;
      Object.keys(capas).forEach(n => capas[n].setStyle(estilo(n, String(n) === String(seleccionado))));
    }
    function verTodos() { seleccionar(null); map.fitBounds(grupo.getBounds(), { padding: [12, 12] }); }

    /* Marcador de punto (punto de encuentro) */
    let punto = null;
    function marcarPunto(lat, lng, texto = 'Punto de encuentro') {
      if (punto) punto.remove();
      if (lat == null || lng == null || lat === '' || lng === '') { punto = null; return; }
      punto = L.marker([lat, lng], {
        icon: L.divIcon({ className: 'pin', html: '<span></span>', iconSize: [26, 26], iconAnchor: [13, 26] })
      }).addTo(map).bindTooltip(texto, { direction: 'top', offset: [0, -24] });
    }

    /* GPS */
    let watch = null, yo = null, prec = null, primera = true;
    function seguirme(onPos, onErr) {
      if (!('geolocation' in navigator)) { onErr && onErr('Este teléfono no permite usar el GPS aquí.'); return; }
      detener(); primera = true;
      watch = navigator.geolocation.watchPosition(p => {
        const ll = [p.coords.latitude, p.coords.longitude];
        if (!yo) {
          prec = L.circle(ll, { radius: p.coords.accuracy, color: '#1a73e8', weight: 1, fillOpacity: .12 }).addTo(map);
          yo = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1 }).addTo(map);
        } else { yo.setLatLng(ll); prec.setLatLng(ll).setRadius(p.coords.accuracy); }
        if (primera) { map.setView(ll, Math.max(map.getZoom(), 17)); primera = false; }
        onPos && onPos({ lat: ll[0], lng: ll[1], precision: Math.round(p.coords.accuracy), territorio: territorioDe(ll[0], ll[1]) });
      }, e => {
        const m = e.code === 1 ? 'Permita el acceso a la ubicación para esta página (en los ajustes del navegador).'
          : e.code === 3 ? 'El GPS está tardando. Salga a un lugar abierto e intente de nuevo.' : 'No se pudo obtener la ubicación. ¿Está activado el GPS?';
        onErr && onErr(m);
      }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
    }
    function detener() {
      if (watch != null) navigator.geolocation.clearWatch(watch);
      watch = null;
      if (yo) { yo.remove(); prec.remove(); yo = prec = null; }
    }

    setTimeout(() => map.invalidateSize(), 60);
    return { map, seleccionar, verTodos, colorear, marcarPunto, seguirme, detener, ponerPuntos, mostrarRuta, marcarDestino, limpiarRuta,
      centrarEn(lat, lng, z) { map.setView([lat, lng], z || Math.max(map.getZoom(), 17)); },
      destruir() { detener(); map.remove(); } };
  }

  /* Registro de territorios: cuánto tiempo lleva cada uno sin predicarse completo */
  const ESTADOS = {
    reciente: { color: '#2f8a4f', texto: 'Predicado hace menos de 4 meses' },
    medio: { color: '#d4a017', texto: 'Entre 4 y 8 meses' },
    viejo: { color: '#c0392b', texto: 'Más de 8 meses' },
    sin: { color: '#8a8f98', texto: 'Sin registro todavía' }
  };
  function resumenRegistro(registro) {
    const r = {};
    numeros().forEach(n => { r[n] = { territorio: n, ultimoCompleto: null, ultimo: null, enProgreso: false, historial: [] }; });
    [...(registro || [])].sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach(x => {
      const t = r[x.territorio]; if (!t) return;
      t.historial.push(x);
      t.ultimo = x;
      if (x.estado === 'completo') { t.ultimoCompleto = x; t.enProgreso = false; } else t.enProgreso = true;
    });
    const hoyD = parseYmd(hoy());
    Object.values(r).forEach(t => {
      t.dias = t.ultimoCompleto ? Math.round((hoyD - parseYmd(t.ultimoCompleto.fecha)) / 864e5) : null;
      t.estado = t.dias == null ? 'sin' : t.dias <= 120 ? 'reciente' : t.dias <= 240 ? 'medio' : 'viejo';
      t.color = ESTADOS[t.estado].color;
      t.historial.reverse();
    });
    return r;
  }
  const textoDias = d => d == null ? 'nunca registrado como completo' : d === 0 ? 'hoy' : d < 31 ? `hace ${d} días` : `hace ${Math.round(d / 30.4)} meses`;
  const leyenda = () => `<div class="leyenda">${Object.values(ESTADOS).map(e => `<span><i style="background:${e.color}"></i>${e.texto}</span>`).join('')}</div>`;

  /* Geometría */
  const R = 6371000, rad = d => d * Math.PI / 180;
  function distancia(a, b) {
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function rumbo(a, b) {
    const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
    const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  const rumboTexto = g => ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'][Math.round(g / 45) % 8];
  const fmtDist = m => m < 1000 ? `${Math.max(5, Math.round(m / 5) * 5)} m` : `${(m / 1000).toFixed(1)} km`;
  const fmtTiempo = s => { const m = Math.max(1, Math.round(s / 60)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
  /* Distancia de un punto a una línea (en metros, aproximada) y el índice del tramo más cercano */
  function cercaniaLinea(p, coords) {
    const kx = Math.cos(rad(p.lat)) * 111320, ky = 110540;
    let mejor = Infinity, idx = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const ax = (coords[i][1] - p.lng) * kx, ay = (coords[i][0] - p.lat) * ky;
      const bx = (coords[i + 1][1] - p.lng) * kx, by = (coords[i + 1][0] - p.lat) * ky;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < mejor) { mejor = d; idx = i; }
    }
    return { dist: mejor, idx };
  }

  /* Calcular ruta (necesita internet). modo: 'foot' a pie, 'car' en carro */
  const MOD = { left: 'a la izquierda', right: 'a la derecha', 'slight left': 'levemente a la izquierda', 'slight right': 'levemente a la derecha',
    'sharp left': 'bien a la izquierda', 'sharp right': 'bien a la derecha', straight: 'recto', uturn: 'y regrese' };
  function instruccion(st) {
    const m = st.maneuver || {}, mod = MOD[m.modifier] || '', calle = st.name ? ` por ${st.name}` : '';
    switch (m.type) {
      case 'depart': return `Salga${calle}`;
      case 'arrive': return 'Llegará a su destino';
      case 'roundabout': case 'rotary': return `En la rotonda, tome la salida ${m.exit || ''}${calle}`.replace('  ', ' ');
      case 'continue': case 'new name': return m.modifier && m.modifier !== 'straight' ? `Siga ${mod}${calle}` : `Siga recto${calle}`;
      case 'merge': case 'on ramp': case 'off ramp': case 'fork': return `Manténgase ${mod || 'recto'}${calle}`;
      default: return m.modifier === 'straight' ? `Siga recto${calle}` : `Gire ${mod}${calle}`;
    }
  }
  async function calcularRuta(origen, destino, modo = 'foot') {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 12000);
    try {
      const url = `https://routing.openstreetmap.de/routed-${modo}/route/v1/driving/${origen.lng.toFixed(6)},${origen.lat.toFixed(6)};${(+destino.lng).toFixed(6)},${(+destino.lat).toFixed(6)}?overview=full&geometries=geojson&steps=true`;
      const r = await fetch(url, { signal: ctl.signal });
      const j = await r.json();
      if (j.code !== 'Ok' || !j.routes || !j.routes.length) throw new Error('sin ruta');
      const rt = j.routes[0];
      return {
        coords: rt.geometry.coordinates.map(([x, y]) => [y, x]), distancia: rt.distance, duracion: rt.duration, recta: false,
        pasos: rt.legs[0].steps.map(st => ({ texto: instruccion(st), lat: st.maneuver.location[1], lng: st.maneuver.location[0] }))
      };
    } finally { clearTimeout(to); }
  }

  /* Enlaces y mensajes */
  const enlaceMapa = (lat, lng) => `https://maps.google.com/?q=${(+lat).toFixed(6)},${(+lng).toFixed(6)}`;
  const enlaceRuta = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${(+lat).toFixed(6)},${(+lng).toFixed(6)}`;
  const enlaceApp = n => new URL(`../publicadores/#territorio-${n}`, location.href).href;

  return { territorios, numeros, buscar, territorioDe, centro, crear, enlaceMapa, enlaceRuta, enlaceApp,
    ESTADOS, resumenRegistro, textoDias, leyenda,
    distancia, rumbo, rumboTexto, fmtDist, fmtTiempo, cercaniaLinea, calcularRuta };
})();

/* Hoja para compartir un texto: WhatsApp, SMS (sirve sin internet), compartir o copiar */
function hojaCompartir(titulo, texto) {
  const d = document.createElement('div');
  d.className = 'modal';
  const puedeShare = !!navigator.share;
  d.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true">
    <h3 style="font-size:1.05rem;margin-bottom:8px">${esc(titulo)}</h3>
    <div class="compartir-txt pre small">${esc(texto)}</div>
    <div class="grid2" style="gap:8px;margin-top:14px">
      <a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(texto)}"><span class="ico">${ICON.wa}</span>WhatsApp</a>
      <a class="btn" href="sms:?&body=${encodeURIComponent(texto)}">SMS (sin internet)</a>
      ${puedeShare ? '<button class="btn" data-a="share">Más opciones</button>' : ''}
      <button class="btn" data-a="copiar">Copiar</button>
    </div>
    <button class="btn btn-block" data-a="cerrar" style="margin-top:8px">Cerrar</button></div>`;
  d.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (e.target === d || a === 'cerrar') return d.remove();
    if (a === 'share') { try { await navigator.share({ title: titulo, text: texto }); } catch (err) {} }
    if (a === 'copiar') {
      try { await navigator.clipboard.writeText(texto); toast('Copiado', 'ok'); }
      catch (err) { const r = document.createRange(); r.selectNodeContents($('.compartir-txt', d)); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Seleccionado: use Copiar del teléfono'); }
    }
  });
  document.body.appendChild(d);
}
