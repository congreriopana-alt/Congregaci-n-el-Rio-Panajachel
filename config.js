/* ============================================================
   CONFIGURACIÓN — solo hay que cambiar API_URL
   Pegue aquí la URL de la aplicación web de Google Apps Script
   (termina en /exec). Si la deja vacía, la app funciona en
   MODO DEMOSTRACIÓN con datos de ejemplo.
   ============================================================ */
window.APP_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwwCO8HmMZvgRvEvOQH5jY9ivja-2Ujsm8JxcNrlO5h091l3Yop2lq4njoRoUKZx7Wl/exec',
  CONGREGACION: 'El Río-Panajachel',
  CODIGO_PAIS: '502', // para los enlaces de WhatsApp

  // Los ancianos y sus teléfonos ya no están aquí (este archivo es público en GitHub):
  // se guardan en el servidor y se cambian en el panel → Ajustes.

  // Informe de predicación por grupos: la app busca el grupo del hermano por su nombre
  // y abre directamente la página de su grupo, con su nombre ya elegido.
  // Si alguien cambia de grupo, muévalo aquí (los nombres van como en la página: "Apellido, Nombre").
  INFORMES: {
    base: 'https://congreriopana-alt.github.io/informes-congregaci-n/',
    // Las listas de cada grupo ya no están aquí (este archivo es público en GitHub):
    // las entrega el servidor de Google solo a quien tiene el código de la congregación.
  },

  // Asistencia de la reunión: solo la ven los hermanos que están en los programas de
  // audio y video y de acomodadores (y los nombres que se agreguen en "extra").
  ASISTENCIA: {
    url: 'https://congreriopana-alt.github.io/Asistencia-/',
    estadisticas: 'https://congreriopana-alt.github.io/Asistencia-/dashboard_el_rio.html',
    extra: [],   // por ejemplo: ['Nombre Apellido']
  },
};
