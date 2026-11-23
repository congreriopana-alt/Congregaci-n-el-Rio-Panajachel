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

  // Informe de predicación por grupos: la app busca el grupo del hermano por su nombre
  // y abre directamente la página de su grupo, con su nombre ya elegido.
  // Si alguien cambia de grupo, muévalo aquí (los nombres van como en la página: "Apellido, Nombre").
  INFORMES: {
    base: 'https://congreriopana-alt.github.io/informes-congregaci-n/',
    grupos: {
      1: ["Caná, Gabriel", "Caná, Mercedes de", "Caro, Lucía de", "Caro, Saúl", "Cosme Yach, Susana", "Mucun, Francisco", "Mucun, Heidy de", "Mucun, Gladys", "Ordóñez, Adela de", "Queché Mejía, Lilian", "Queché Mejía, Matheo", "Ramos Buch, Joselin", "Ruíz, Erick", "Ruiz, Kathy de", "Shovin, Gerwer", "Shovin, Maria de", "Green, William"],
      2: ["Belisle, Marcel", "Cabrera, Edwin Armando", "Cabrera, Mariela", "Cabrera, Martina de", "Cabrera, Omar", "Cabrera, Osiel", "Cabrera, Raquel", "Choguaj, Eduardo", "Cosme Recinos, Bivia", "Orozco, Joselyn", "Palencia Cabrera, Erick", "Palencia Cabrera, Natalie", "Palencia de Cabrera, Olga", "Ruíz, Rudy"],
      3: ["Alvarado Mejía, Franklyn", "Atzij, Ericka", "Chuc, Benjamin", "Chuc, Evelyn de", "Chuc, Francisco", "Chuc, Jazmin", "Gabriel, Nayeli", "Gabriel, Viviana", "García, Dacia", "Giron, Alicia", "Gómez, Florencio", "Gómez, Pamela", "Guzman, Erika de"],
      4: ["Ajpuac Díaz, Jack", "Cácerez, María", "Cácerez, Thaiz", "Cácerez, Enrique", "Cácerez, Zucely de", "Caná, Monica Fabiola", "Caná, Pablo", "Chuc, Marcos", "López, Sandra de", "Morales, Antonieta", "Sulugui, Agustin", "Yax, Elsa de", "Yax, Roberto", "Yax, Sucely"],
      5: ["Cobar, Edgar", "Flores, Karla Tatiana", "Flores, Nelson", "García, Ernesto", "García, Nancy de", "Hill, Deborah", "Mucún, Dilma de", "Mucún, Glendy Raquel", "Mucún, Hugo", "Mucún, Lesly Sofía", "Mucún, Lidia de", "Ovando, Daniella", "Pineda, Enoe", "Queché Can, Alexander", "Queché Can, Belén", "Queché Can, Carmen"],
      6: ["Can Claudia de", "Can Sahón, Mario", "Can, Cristian", "Gil Rios, Silvia Kristel", "Gil Salazár, Yohnathan", "Gómez Cabrera, Belén", "Gómez Cabrera, Randy", "Gómez, Elida de", "Gómez, Melany de", "Raxtun Rosales, Lucrecia", "Ríos, Elizabeth", "Rosales, Esly de", "Rosales, Mauricio", "Sicay, William", "Velázquez, Abelina", "Yax, Luis", "Yax, Mariela de"]
    },
  },

  // Asistencia de la reunión: solo la ven los hermanos que están en los programas de
  // audio y video y de acomodadores (y los nombres que se agreguen en "extra").
  ASISTENCIA: {
    url: 'https://congreriopana-alt.github.io/Asistencia-/',
    estadisticas: 'https://congreriopana-alt.github.io/Asistencia-/dashboard_el_rio.html',
    extra: [],   // por ejemplo: ['Erick Ruiz', 'Nelson Flores']
  },
};
