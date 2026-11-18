/* Mapa de territorios: funciona sin internet (los polígonos y el GPS están dentro de la app).
   Las calles del fondo se guardan en el teléfono cada vez que se ven con internet. */
const Mapa = (() => {
  let GEO = null;
  const COLORES = ['#3d6b75', '#946f2a', '#6a4c93', '#4f7a3a', '#8b2f2b', '#1f3a5f', '#a0522d', '#2e7d7a'];

  async function territorios() {
    if (GEO) return GEO;
    const r = await fetch('territorios.geojson');
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
    const estilo = (n, sel) => ({
      color: sel ? '#c9a227' : COLORES[Number(n) % COLORES.length],
      weight: sel ? 4 : 2, opacity: .95,
      fillColor: COLORES[Number(n) % COLORES.length], fillOpacity: sel ? .28 : .12
    });
    const grupo = L.geoJSON(GEO, {
      style: f => estilo(f.properties.numero, false),
      onEachFeature: (f, layer) => {
        const n = f.properties.numero;
        capas[n] = layer;
        layer.bindTooltip(String(n), { permanent: true, direction: 'center', className: 'tlabel' });
        layer.on('click', e => {
          if (opts.onMapa) { opts.onMapa(e.latlng); L.DomEvent.stopPropagation(e); return; }
          if (opts.onTerritorio) opts.onTerritorio(n);
        });
      }
    }).addTo(map);
    map.fitBounds(grupo.getBounds(), { padding: [12, 12] });
    if (opts.onMapa) map.on('click', e => opts.onMapa(e.latlng));

    function seleccionar(n, acercar = true) {
      if (seleccionado != null && capas[seleccionado]) capas[seleccionado].setStyle(estilo(seleccionado, false));
      seleccionado = n;
      if (n == null || !capas[n]) return;
      capas[n].setStyle(estilo(n, true)); capas[n].bringToFront();
      if (acercar) map.fitBounds(capas[n].getBounds(), { padding: [24, 24], maxZoom: 18 });
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
    return { map, seleccionar, verTodos, marcarPunto, seguirme, detener, destruir() { detener(); map.remove(); } };
  }

  /* Enlaces y mensajes */
  const enlaceMapa = (lat, lng) => `https://maps.google.com/?q=${(+lat).toFixed(6)},${(+lng).toFixed(6)}`;
  const enlaceRuta = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${(+lat).toFixed(6)},${(+lng).toFixed(6)}`;
  const enlaceApp = n => `${location.origin}${location.pathname.replace(/ancianos\.html$/, '')}#territorio-${n}`;

  return { territorios, numeros, buscar, territorioDe, centro, crear, enlaceMapa, enlaceRuta, enlaceApp };
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
