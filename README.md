# Vocabia

Diccionario personal multilingüe para guardar vocabulario con contexto. Proyecto de aprendizaje y portfolio en construcción: esta primera etapa implementa un MVP local, sin cuentas de usuario ni publicación.

## Estado inicial y decisiones

La carpeta estaba vacía, sin archivos, configuración ni repositorio Git. No se sobrescribieron archivos existentes.

- **React + TypeScript:** componentes para la interfaz y tipos para detectar errores durante el desarrollo.
- **Vite:** servidor de desarrollo y compilación del frontend.
- **Node.js + Express + TypeScript:** API HTTP pequeña con validaciones mediante Zod.
- **PostgreSQL:** SQL explícito con consultas parametrizadas. Con `DATABASE_URL` se conecta a un servidor con `pg`.
- **PGlite para arrancar localmente:** PostgreSQL integrado en Node que persiste en `backend/data/`. Evita exigir un servidor instalado para probar el MVP. Los tests de API ejecutan SQL real en PGlite en memoria; no sustituyen la verificación con un servidor PostgreSQL independiente.
- **Vitest + Testing Library + Supertest:** pruebas del formulario y de la API con su base de datos.
- **npm workspaces:** frontend y backend son paquetes separados y comparten una instalación desde la raíz. No se añade una herramienta de monorepo.

Referencia: [Vite](https://vite.dev/guide/) y [PGlite](https://pglite.dev/docs/).

## Qué incluye el MVP

- Lista, creación, edición y borrado con confirmación.
- Palabra o expresión, traducción, idiomas distintos, tipo, notas opcionales y entre 1 y 10 ejemplos.
- Búsqueda en palabra y traducción, sin distinguir mayúsculas. No elimina diferencias de acentos.
- Colección limitada a la pareja exacta de idiomas seleccionada, combinable con búsqueda y filtro por tipo.
- Interfaz traducida a los siete idiomas disponibles, adaptable a móvil, con diálogos nativos y etiquetas de formulario. Las tarjetas conservan su contenido y sus etiquetas.
- Estados de carga, colección vacía, errores y mensajes de éxito.
- Seis entradas ficticias de demostración, cargadas una sola vez. Borrarlas no las repone al reiniciar.
- Idiomas iniciales: español, inglés, francés, alemán, italiano, portugués y japonés. Se pueden añadir más ampliando los catálogos del backend y frontend.

La aplicación permite guardar palabras repetidas: una misma palabra puede tener distintos significados o contextos. No hay conjugaciones ni sistema de estudio todavía.

### Mi idioma de referencia

Pulsa el **botón con la bandera y el nombre del idioma, fijo abajo a la derecha**, para elegir tu idioma nativo o el que prefieras como referencia. La selección se aplica y se guarda automáticamente. El botón para cerrar el diálogo también se traduce: **Listo**, **Done**, **Fertig**, etc.

- Las palabras nuevas utilizan ese idioma principal por defecto en **Idioma de la palabra**. La traducción utiliza el idioma que eliges estudiar en las banderas de la pantalla principal. Por ejemplo: Español → Inglés, `libro` → `book`. Puedes ajustar ambos campos en el formulario.
- Editar una entrada conserva sus idiomas originales. Cambiar el principal actualiza la pareja de la colección.
- Toda la interfaz cambia al instante: presentación, colección, búsqueda, filtros y sus opciones, contadores, estados vacíos, formularios, confirmación de borrado, preferencias y mensajes de éxito o error. Por ejemplo, Alemán muestra **Meine Sammlung**, **Wort hinzufügen** y **Alle Wortarten**. Hay textos preparados para los siete idiomas disponibles.
- Las tarjetas mantienen sus palabras, traducciones, ejemplos, notas, tipos, idiomas y botones tal como se mostraban. Cambiar el idioma de la interfaz no modifica los registros guardados ni envía peticiones para traducirlos.
- La elección se recuerda en `localStorage` con la clave `vocabia.referenceLanguage`. Este almacén pertenece al navegador y a la dirección donde abres la aplicación; no se sincroniza entre dispositivos. Borrar los datos del sitio también borra esta preferencia.
- Si no hay una preferencia válida, se utiliza español. Si el navegador bloquea el almacenamiento, puedes elegir un idioma para la sesión actual y se muestra un aviso.

**Concepto nuevo:** `useState` mantiene las selecciones mientras está abierta la aplicación; `localStorage` permite recuperarlas al volver. `App` pasa `referenceLanguage` y `studyLanguage` a `WordForm` mediante **props**, datos que un componente entrega a otro. El formulario utiliza el primero para las etiquetas y el idioma inicial de la palabra, y el segundo para el idioma inicial de la traducción. Al editar, los campos conservan los valores guardados. La API recibe esta pareja para filtrar la colección; el esquema de la base de datos se mantiene.

### Elegir el idioma de estudio

Entre la presentación y la colección aparece **¿Qué idioma quieres estudiar?**, con seis banderas y sus nombres. Se excluye el idioma principal, elegido en el botón inferior. La selección de estudio no cambia el idioma de la interfaz.

- La bandera seleccionada queda resaltada. También se muestra la pareja de idiomas: por ejemplo, **Español → Inglés**.
- Si tu idioma principal es español, elige Inglés y abre **Añadir palabra**: escribe `libro` como palabra y `book` como traducción. El formulario propondrá Español e Inglés.
- El idioma de estudio se recuerda con `vocabia.studyLanguage` en el mismo navegador. Sin una elección válida se propone inglés, o español cuando el principal es inglés.
- Si cambias el principal y coincide con el idioma que estudiabas, se propone otro distinto: inglés o español según corresponda. Las palabras existentes mantienen sus idiomas.
- Las banderas preparan el formulario y seleccionan qué tarjetas muestra la colección: solo **idioma principal → idioma de estudio**, en ese orden. Español → Inglés excluye Inglés → Español, Español → Alemán y Francés → Inglés.
- Buscar, filtrar por tipo y limpiar esos filtros mantiene siempre la pareja seleccionada. El desplegable general de idiomas se ha sustituido por las banderas.
- Encima de las tarjetas aparecen los marcadores **Todos los tipos, Sustantivos, Verbos, Adjetivos, Adverbios, Expresiones y Otros**, traducidos al idioma de la interfaz. Se selecciona un tipo cada vez y queda resaltado. **Todos los tipos** elimina solo el filtro de tipo; **Limpiar filtros** elimina tipo y búsqueda. La pareja de idiomas permanece en ambos casos.
- Cambiar de idioma vuelve a consultar la colección y actualiza el contador. Mientras se carga, no se muestran tarjetas de la pareja anterior. Las tarjetas de otras parejas permanecen guardadas y reaparecen al seleccionar su pareja.
- Si cambias los idiomas de una palabra al editarla, dejará de aparecer en la pareja anterior y podrás encontrarla seleccionando su nueva pareja.

El servidor usa dos condiciones SQL unidas por `AND`: `source_language` debe coincidir con el idioma principal **y** `target_language` con el de estudio. Es distinto del antiguo filtro que encontraba cualquiera de los dos idiomas. Se envían como parámetros, separados del SQL. La interfaz también comprueba la pareja de las tarjetas recibidas para evitar mostrar resultados anteriores durante un cambio de selección.

Los seis ejemplos originales se conservan con su dirección original: cuatro Inglés → Español, uno Francés → Español y uno Alemán → Español. Por eso, una instalación nueva puede mostrar vacía la pareja Español → Inglés. Puedes crear tu primera tarjeta en esa pareja o seleccionar Inglés como principal y Español como estudio para ver los cuatro ejemplos correspondientes. No se han invertido ni borrado registros existentes.

Los marcadores reutilizan el estado `wordType` de `App` y el parámetro del mismo nombre que ya admite la API. Pulsar **Adjetivos** establece `wordType` en `adjective`; pulsar **Todos los tipos** lo deja vacío. `aria-pressed` indica qué botón está seleccionado. Las etiquetas plurales de los filtros están separadas de las etiquetas singulares del formulario en `interfaceText.ts`. Los botones se distribuyen en varias filas si falta espacio en móvil. No se ha cambiado el backend ni la base de datos para este ajuste.

Comprobación de los marcadores: crea un sustantivo, un verbo y un adjetivo en la misma pareja; pulsa cada tipo y comprueba que solo aparece su tarjeta. Vuelve a **Todos los tipos**, prueba la combinación con una búsqueda y cambia de idioma de estudio: las tarjetas de otras parejas deben seguir excluidas.

Verificación del ajuste de marcadores: `npm test -w frontend` pasa las **29 pruebas** del frontend, incluida la selección y el resaltado de tipos, la vuelta a todos y la exclusión de tarjetas de otras parejas. `npm run build` comprueba TypeScript y compila ambos paquetes. No se ha realizado revisión visual en un navegador real.

`StudyLanguages.tsx` recibe las dos selecciones y una función `onChange`. Usa `filter` para excluir el idioma principal y `map` para dibujar cada botón. Al pulsar uno, llama a `onChange` para que `App` actualice la selección. `aria-pressed` comunica qué idioma está elegido a quienes usan un lector de pantalla. Los SVG de las banderas se reutilizan del botón inferior.

Para comprobarlo: con Español como principal, verifica que aparecen seis opciones y no aparece Español en esa fila. Elige Inglés y abre el formulario; comprueba Español → Inglés. Prueba Francés, recarga y comprueba que sigue seleccionado. Edita una entrada existente para confirmar que conserva sus idiomas. Por último, cambia tu idioma principal por el que estudiabas: las opciones deben actualizarse y la pareja debe seguir siendo de dos idiomas distintos.

Los textos se agrupan en `frontend/src/presentation.ts` (presentación) e `interfaceText.ts` (controles, formularios y mensajes). Cada idioma tiene las mismas claves: React lee, por ejemplo, `interfaceText[referenceLanguage].collection`. TypeScript comprueba que ningún idioma omita una clave. Los valores técnicos como `en` o `noun` siguen siendo iguales; solo cambia su etiqueta visible. Esto evita condiciones por cada frase, sin añadir librerías ni servicios automáticos.

Los mensajes con datos variables usan una plantilla: `'{count} palabras encontradas'` se rellena mediante `formatText`. Los avisos se conservan como claves, por ejemplo `wordAdded`, para que también cambien de idioma si ya están visibles. Los fallos HTTP se convierten en errores `ApiError` con una clave traducible: la interfaz muestra un mensaje según el estado HTTP sin depender del español que devuelve actualmente la API.

El atributo `lang` del documento, su título y su descripción se actualizan con la selección. Las tarjetas indican español para las etiquetas que conservan, y cada palabra, traducción y ejemplo mantiene su propio atributo de idioma. Los mensajes de validación del formulario también se traducen; los controles propios del navegador o del sistema operativo dependen de la configuración del navegador.

`LanguageFlag.tsx` dibuja iconos SVG locales para evitar depender de imágenes externas o del soporte de emojis de Windows. Se usan España, Reino Unido, Francia, Alemania, Italia, Portugal y Japón como símbolos visuales. El nombre del idioma acompaña a la bandera y el botón tiene una etiqueta accesible. `position: fixed` mantiene el botón en la esquina al desplazarse; el espacio al final de la página permite desplazar el último contenido por encima del botón.

Para comprobarlo manualmente:

1. Elige Alemán en el botón inferior y cierra con **Fertig**. Comprueba **Meine Sammlung**, **Wort hinzufügen**, **Alle Wortarten**, el contador y el aviso en alemán.
2. Busca un texto sin resultados: el estado vacío y el botón para limpiar filtros deben estar en alemán.
3. Abre **Wort hinzufügen**: campos, opciones y botones deben aparecer en alemán. Selecciona dos idiomas iguales y comprueba el mensaje de validación.
4. Cierra el formulario, recarga y comprueba que sigue en alemán.
5. Edita o abre el borrado de una tarjeta: el diálogo se traduce y los datos guardados se mantienen. Cancela para no modificarla.
6. Repite con Inglés u otro idioma. Comprueba que las tarjetas permanecen iguales y que el selector no cubre el último contenido al desplazarte, también con un ancho de 375 px.

Verificación del ajuste de parejas: `npm test` pasó **42 pruebas** en ese momento: 14 de API/SQL y 28 de interfaz. Incluyen parejas exactas, exclusión de la dirección inversa y otros idiomas, combinación con búsqueda y tipo, colección vacía, cambio de bandera y recuperación al volver. La API rechaza parejas incompletas, repetidas o con idiomas no admitidos. El ajuste posterior de marcadores eleva las pruebas de interfaz a 29, verificadas con `npm test -w frontend`. La revisión visual en un navegador real sigue pendiente; las pruebas de interfaz usan un DOM simulado.

## Estructura

```text
Vocabia/
  frontend/
    src/
      App.tsx               Lista, filtros y coordinación de operaciones
      WordForm.tsx          Formulario de creación y edición
      model.ts              Tipos, catálogos y cliente de la API
      presentation.ts       Textos de presentación en los siete idiomas
      interfaceText.ts      Controles, formularios, opciones y mensajes traducidos
      LanguageFlag.tsx      Banderas SVG del selector de idioma
      StudyLanguages.tsx    Selección del idioma de estudio en la pantalla principal
      styles.css            Diseño y adaptación a móvil
      *.test.tsx            Pruebas de interacción
    vite.config.ts          React y proxy hacia la API
  backend/
    src/
      server.ts             Arranque y cierre del servidor
      app.ts                Rutas HTTP y manejo de errores
      database.ts           Conexión, esquema y demostración
      validation.ts         Reglas de los datos recibidos
      app.test.ts           Pruebas de API y SQL
    .env.example            Configuración de ejemplo, sin secretos
  database/
    001_initial.sql         Esquema inicial
  package.json              Comandos comunes
  package-lock.json         Versiones exactas de las dependencias
```

Se conserva una estructura pequeña: no se añaden capas de servicios y repositorios para cada operación. Cuando aparezca lógica de estudio más compleja, tendrá sentido extraerla de las rutas.

## Instalar y ejecutar

Requisito: Node.js **22.12 o posterior** (recomendado Node 24 LTS) y npm. Los comandos se ejecutan desde la raíz del proyecto:

```powershell
npm ci
npm run dev
```

Abre **http://localhost:5173**. La API escucha en `127.0.0.1:3001`. `Ctrl+C` detiene ambos procesos. No hace falta crear `.env` para el modo local.

En el primer arranque se crea `backend/data/`, con las tablas y los ejemplos. Esa carpeta contiene los datos locales y Git la ignora. No la borres si quieres conservar tu vocabulario. Ejecuta una sola instancia del backend para ese directorio de PGlite.

El proxy de Vite envía `/api` al backend: el navegador puede pedir `/api/words` sin tener que conocer otro puerto. Si cambias `PORT`, actualiza también el destino en `frontend/vite.config.ts`.

### Usar un servidor PostgreSQL

Este modo requiere instalar PostgreSQL por separado; el proyecto no lo instala ni crea usuarios automáticamente.

1. Crea una base de datos vacía llamada `vocabia` con tu usuario de desarrollo (por ejemplo, `CREATE DATABASE vocabia;` desde una herramienta SQL).
2. Copia `backend/.env.example` a `backend/.env`.
3. Completa y descomenta `DATABASE_URL` con las credenciales de ese servidor. Si la contraseña contiene caracteres reservados, codifícalos para una URL.
4. Reinicia `npm run dev`. El backend crea el esquema y los datos de demostración en esa base.

El usuario necesita permisos para crear tablas en esa base. `.env` está ignorado: nunca subas credenciales. Cambiar entre PGlite y PostgreSQL **no copia** los datos de un motor a otro.

El esquema inicial usa `CREATE TABLE IF NOT EXISTS`: sirve para este MVP, pero no modifica tablas existentes. Antes de cambiar columnas en otra etapa añadiremos migraciones incrementales, es decir, scripts para evolucionar la base sin perder datos.

## Comprobar el proyecto

```powershell
npm test
npm run typecheck
npm run build
```

- `test`: prueba la API con Supertest y PGlite aislado en memoria; el frontend con Testing Library en un DOM simulado.
- `typecheck`: busca incompatibilidades de tipos sin generar JavaScript.
- `build`: comprueba TypeScript y genera `backend/dist/` y `frontend/dist/`.

Las pruebas no tocan tu vocabulario local. Para ejecutar solamente una parte: `npm test -w backend` o `npm test -w frontend`.

Comprobación manual recomendada:

1. Selecciona Español como idioma principal e Inglés como estudio. La pareja puede estar vacía en una instalación nueva; los ejemplos originales tienen otras direcciones.
2. Añade `libro` → `book`, Español → Inglés, con dos ejemplos y una nota.
3. Busca `LIBRO` y filtra por Sustantivo. Limpia los filtros. Cambia a Alemán: la tarjeta no debe aparecer. Vuelve a Inglés: debe reaparecer.
4. Edita la palabra y comprueba que los ejemplos se conservan.
5. Intenta guardar idiomas iguales o un ejemplo vacío: debe rechazarse.
6. Cancela un borrado y comprueba que la palabra sigue. Después confirma el borrado.
7. Añade otra entrada, detén ambos procesos y vuelve a arrancar: debe conservarse.
8. Revisa la interfaz en un ancho de 375 px, con teclado y a zoom del 200 %.

El DOM simulado no verifica el diseño real ni el comportamiento del navegador. La compilación tampoco comprueba el despliegue. El backend compilado puede arrancarse con `npm run start -w backend`, pero servir frontend y API juntos en producción queda para una etapa posterior.

### Resultado de la verificación inicial — 23 de octubre de 2026

En Windows, con Node 24.14.0 y npm 11.9.0:

- `npm test`: **18 pruebas correctas**, 12 de API/SQL y 6 de interfaz/formulario.
- `npm run typecheck`: correcto en ambos paquetes.
- `npm run build`: backend compilado y frontend generado correctamente.
- `npm audit`: **0 vulnerabilidades conocidas** en la consulta al registro después de actualizar Vitest. Este resultado corresponde a ese momento, no garantiza ausencia de vulnerabilidades futuras.
- `npm run dev`: ambos servidores arrancan. Frontend HTTP 200 y API accesible a través del proxy.
- Prueba real por HTTP: crear una palabra, detener ambos servidores, reiniciar, recuperar la palabra, editar sus dos ejemplos y borrarla (204). Al terminar quedan las seis entradas de demostración.
- Git ignora dependencias, compilaciones, `.env` y datos locales.
- Pendientes: revisión visual y de interacción en navegador real, y prueba contra un servidor PostgreSQL independiente. No se ha desplegado ni comprobado un entorno de producción.

## API

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/api/words?sourceLanguage=es&targetLanguage=en&search=book&wordType=noun` | Lista de la pareja exacta, con búsqueda y tipo, 200 |
| POST | `/api/words` | Crea una palabra, 201 |
| PUT | `/api/words/:id` | Reemplaza los campos de una palabra, 200 |
| DELETE | `/api/words/:id` | Borra una palabra, 204 |

Si se envía un idioma de la pareja, deben enviarse los dos y ser distintos. La interfaz siempre envía ambos. La API conserva las consultas generales sin pareja y el parámetro anterior `language` para consultas directas, pero los controles de la aplicación mantienen la pareja seleccionada.

Cuerpo de creación y edición:

```json
{
  "term": "book",
  "translation": "libro",
  "sourceLanguage": "en",
  "targetLanguage": "es",
  "wordType": "noun",
  "notes": "Puede tener otros significados.",
  "examples": ["I read a book."]
}
```

Los errores devuelven `{ "error": "Mensaje" }`: 400 para datos inválidos, 404 para registros o rutas inexistentes, 413 para peticiones demasiado grandes y 500 para fallos inesperados. El formulario limita longitudes y el backend vuelve a validarlas. La API utiliza `$1`, `$2`, etc. para separar valores del SQL.

No hay autenticación: es una herramienta local de un único usuario. Ambos servidores de desarrollo escuchan solo en la interfaz local. Antes de exponerla a Internet habrá que incorporar identidad, autorización y configuración de producción.

## Aprender con este código

Sigue una operación concreta, por ejemplo añadir `book`:

1. **Componente y estado:** `WordForm` muestra campos. `useState` conserva sus valores entre renderizados.
2. **Tipos:** `WordInput` describe los datos esperados. TypeScript ayuda mientras programas; no valida peticiones reales.
3. **HTTP y JSON:** `request` envía un `POST` con un objeto convertido en texto JSON. Express interpreta ese texto.
4. **Validación:** Zod comprueba que la entrada tenga contenido, dos idiomas distintos y ejemplos válidos.
5. **SQL y persistencia:** `INSERT` guarda el registro. La base conserva los datos aunque cierres el navegador.
6. **Operaciones asíncronas:** `await` espera la respuesta sin bloquear toda la interfaz. Mientras guarda, los botones se desactivan.
7. **Efectos:** `useEffect` consulta la lista al cambiar los filtros. Cancela peticiones anteriores para evitar mostrar resultados desactualizados.
8. **Pruebas:** una prueba de API envía peticiones y comprueba sus respuestas; una prueba de formulario simula escribir y pulsar botones.

Antes de avanzar, intenta explicar ese recorrido con tus palabras y modificar un texto o una validación pequeña. En el portfolio, presenta lo que has construido, el apoyo recibido y lo que puedes explicar; no presupongas dominio de todas las herramientas.

## Siguientes etapas (sin implementar)

1. **Estudio y contexto:** tarjetas, formas verbales y seguimiento. Primero definir cómo estudiarás realmente.
2. **Preparación para uso remoto:** usuarios, autorización, paginación si crece la colección, migraciones y despliegue con PostgreSQL independiente.
3. **Automatización:** CI/CD cuando se defina un destino de despliegue. Docker cuando sea útil reproducir el entorno entre máquinas.
4. **Integraciones opcionales:** traducción y voz cuando aporten valor a un flujo ya probado y se hayan evaluado coste y privacidad.

## Control de versiones

El código se versiona en la rama `main`. Repositorio remoto: [SulimanHB/Vocabio](https://github.com/SulimanHB/Vocabio). El nombre del repositorio es Vocabio y el de la aplicación es Vocabia.

El primer commit reúne el MVP funcional, sus pruebas y esta documentación. Un **commit** guarda una versión del código en el historial local; un **push** envía esos commits al repositorio remoto. Para futuras mejoras, revisa `git status` y `git diff` antes de preparar los archivos con `git add`, y comprueba las pruebas antes de guardar cada cambio coherente.

Git excluye las dependencias, compilaciones, datos locales y archivos `.env`. Se incluye `.env.example` con valores de ejemplo. Subir el código a GitHub no despliega la aplicación: su ejecución sigue siendo local.
