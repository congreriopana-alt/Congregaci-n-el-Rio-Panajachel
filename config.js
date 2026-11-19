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

  // Ancianos que aparecen en "Preguntas" (la pregunta se abre en WhatsApp, no se guarda en la app).
  // Se usa solo si el servidor aún no tiene la lista; los ancianos la pueden cambiar en su panel → Ajustes.
  ANCIANOS: [
    ['Erick Ruiz', '+502 5448 2541'],
    ['Willam Green', '+1 (248) 759-9624'],
    ['Enrique Caceres', '+502 5827 8196'],
    ['Florencio Gomez', '+502 4122 8703'],
    ['Nelson Flores', '+502 5550 5176'],
    ['Francisco Chuc', '+502 4163 5004'],
    ['Rudy Ruiz', '+502 3731 8751'],
    ['Luis Yax', '+502 5833 2462'],
    ['Luis Garcia', '+502 5588 5445'],
  ],
};
