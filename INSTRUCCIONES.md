# App de la Congregación El Río-Panajachel — Instalación

Son dos partes:

| Carpeta | Qué es | Dónde va |
|---|---|---|
| `google/Code.gs` | El "servidor": guarda todo en una Hoja de cálculo y los archivos en Google Drive. Envía los correos del lunes. | En la cuenta de Google de la congregación |
| `app/` | Las dos apps: **publicadores** (`index.html`) y **ancianos** (`ancianos.html`) | En un hosting gratuito (Netlify o GitHub Pages) |

Tiempo aproximado: 20–30 minutos, una sola vez.

---

## Paso 1 — Crear el servidor en Google (cuenta de la congregación)

1. Entre a **sheets.google.com** con la cuenta de la congregación y cree una hoja nueva. Póngale de nombre: `App Congregación El Río`.
2. Menú **Extensiones → Apps Script**.
3. Borre lo que aparece y **pegue todo el contenido de `google/Code.gs`**. Guarde (ícono de disquete).
4. Arriba, en la lista de funciones, elija **`setup`** y presione **Ejecutar**.
   - Google pedirá permisos: **Revisar permisos → elija la cuenta → Configuración avanzada → Ir a (proyecto) → Permitir**. Es normal: el script es suyo.
   - Esto crea las hojas (Publicaciones, Anuncios, Asignaciones, Hermanos, Preguntas, Ancianos) y una carpeta en Drive para los archivos.
5. **Cambie la contraseña de los ancianos:** ícono de engranaje ⚙️ (*Configuración del proyecto*) → abajo, *Propiedades de la secuencia de comandos* → edite `ADMIN_PASSWORD`. La inicial es `cambiar123`.
   - Ahí mismo puede agregar `CORREO_AVISO_PREGUNTAS` con uno o varios correos (separados por coma) para recibir un aviso cuando un publicador envíe una pregunta.
6. **Publicar como aplicación web:** botón azul **Implementar → Nueva implementación** → tipo (engranaje) **Aplicación web**:
   - *Ejecutar como:* **Yo**
   - *Quién tiene acceso:* **Cualquier usuario**
   - Presione **Implementar** y **copie la URL** (termina en `/exec`).
7. **Activar los recordatorios del lunes:** en el editor elija la función **`instalarRecordatorios`** → **Ejecutar**. Desde ese momento, cada lunes a las 7:00 a. m. se envía un correo a cada hermano que tenga asignación esa semana y correo registrado.

> Si después cambia el código, use **Implementar → Gestionar implementaciones → editar (lápiz) → Versión: Nueva versión**, para que la URL siga siendo la misma.

## Paso 2 — Conectar las apps

Abra `app/config.js` y pegue la URL entre las comillas:

```js
API_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec',
```

Si la deja vacía, la app funciona en **modo demostración** (contraseña de prueba `rio2026`).

## Paso 3 — Publicar las apps (gratis)

**Opción más fácil — Netlify Drop:**
1. Entre a **app.netlify.com/drop** (puede crear la cuenta con el mismo Google de la congregación).
2. Arrastre la **carpeta `app` completa** a la página.
3. Le da una dirección como `https://rio-panajachel.netlify.app`. En *Site settings → Change site name* puede elegir el nombre.

**Opción alternativa — GitHub Pages:** suba la carpeta `app` a un repositorio y active *Settings → Pages*.

Resultado:
- **Publicadores:** `https://su-sitio.netlify.app/` → este es el enlace que comparte por WhatsApp.
- **Ancianos:** `https://su-sitio.netlify.app/ancianos.html` → solo para ancianos (pide la contraseña).

## Paso 4 — Instalar en el teléfono

- **Android (Chrome):** abrir el enlace → botón **Instalar app** en la parte de arriba (o menú ⋮ → *Instalar aplicación*).
- **iPhone (Safari):** abrir el enlace → botón **Compartir** → **Agregar a pantalla de inicio**.

Las dos apps se instalan por separado, con íconos diferentes (la de ancianos tiene un círculo dorado).

## Paso 5 — Nombres de los ancianos (sección Preguntas)

En la Hoja de cálculo, pestaña **Ancianos**, escriba un nombre por fila (columna A, desde la fila 2). Aparecerán solos en la lista "Dirigida a" de los publicadores.

---

## Uso semanal (ancianos)

1. **Subir programa:** elegir la sección → fechas → foto o PDF → *Publicar*.
2. **Asignaciones:** escribir fecha, asignación y hermano (o pegar varias líneas a la vez: `19/11 ; Lectura de la Biblia ; Saul Caro`). Esto alimenta "Mis asignaciones" y los recordatorios.
3. **Hermanos:** registrar el WhatsApp y el correo de cada uno (una sola vez).
4. **Recordatorios:** el correo sale solo el lunes. Para WhatsApp, el botón verde abre el mensaje listo; también puede *Copiar resumen para el grupo*.
5. **Preguntas:** ver y responder las preguntas; el publicador ve la respuesta en su teléfono.

## Notas importantes

- **Privacidad:** las páginas no aparecen en Google (`noindex`), pero cualquiera que tenga el enlace puede verlas. Compártalo solo con la congregación. Los archivos subidos quedan en Drive como "cualquier persona con el enlace puede ver".
- **WhatsApp automático:** WhatsApp no permite enviar mensajes automáticos gratis; por eso el correo es automático y WhatsApp se envía con un toque por hermano. Si en el futuro quieren automatizarlo, se necesita la API de WhatsApp Business (de pago).
- **Límite de correos:** una cuenta Gmail gratuita puede enviar ~100 correos por día desde Apps Script; es suficiente para una congregación.
- Todos los datos se pueden ver y corregir directamente en la Hoja de cálculo.
