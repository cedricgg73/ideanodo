# Zetha · Prototipo de personajes funcionales

Nodo y Ora dentro del POS de restaurantes. **Nodo automatiza. Ora responde.**
Cada uno tiene su propio panel: no comparten chat.

---

## Correr en local

```bash
npm start
```

No hay que instalar nada: cero dependencias. Usa `node:sqlite` y el
type-stripping nativo de Node (requiere **Node 22.6+**).

Abre <http://localhost:3000>.

```bash
npm test     # 25 tests del clasificador y de los dos motores
npm run reset # borra la base local y vuelve a sembrar el catalogo
```

---

## Subirlo a Vercel

El proyecto ya esta configurado (`vercel.json`, `.vercelignore`, funcion en
`api/`). Desde **esta carpeta**, el CLI pide login por navegador la primera
vez y luego despliega:

```bash
npx -y vercel deploy --prod
```

Responde a las preguntas del CLI:

- *Set up and deploy?* → **Y**
- *Which scope?* → tu cuenta
- *Link to existing project?* → **N**
- *Project name?* → `zetha-nodo`
- *In which directory is your code located?* → `./`
- *Want to modify these settings?* → **N** (ya estan en `vercel.json`)

Al terminar imprime la URL de produccion.

### Diferencia entre local y Vercel

| | Local | Vercel |
|---|---|---|
| Store | SQLite en disco (`db/nodo.sqlite`) | En memoria |
| Reglas activas | Persisten en la base | Las guarda el navegador |

Vercel es serverless: no hay disco. La API responde `persistente: false` y
el front guarda las activaciones en `localStorage`. Los ids del catalogo son
*slugs* estables, asi que lo guardado sigue siendo valido entre despliegues.
La limitacion se declara en la respuesta de la API, no se disimula.

---

## Como esta armado

```
db/schema.sql          Diseno oficial (PostgreSQL / Supabase)
db/schema.sqlite.sql   Traduccion 1:1 para correr en local
db/seed.ts             Catalogo de Nodo: 8 intenciones x 3 reglas = 24
db/consultas.ts        Catalogo de Ora: 9 consultas + dataset de ejemplo

src/clasificador.ts    ¿Es una automatizacion o una pregunta?
src/matchingEngine.ts  Motor de Nodo: frase -> intencion
src/consultasEngine.ts Motor de Ora: pregunta -> cifra
src/routes/agentes.ts  Los dos personajes y la derivacion entre ellos
src/store.ts           Interfaz de almacenamiento (SQLite | memoria)

api/[accion].ts        Funcion serverless de Vercel
src/server.ts          Servidor local (node:http)
public/                Maqueta del POS: sidebar real + panel por personaje
```

### El flujo

1. El usuario escribe en el panel de **un** personaje.
2. `clasificar()` decide si la frase pide **automatizar** o **consultar**.
3. Si el personaje no es el indicado, lo dice y **deriva**, llevandose la
   frase para que no haya que repetirla.
4. Nodo presenta 3 plantillas fijas; el usuario elige y la regla queda activa.
5. Ora devuelve la cifra y, si la pregunta se puede automatizar, pasa a Nodo.

### Por que reglas y no IA

El catalogo es **cerrado**: no hay nada que generar. A cambio se obtiene
trazabilidad (`evidencia` y `senales` dicen por que se entendio lo que se
entendio), cero costo por consulta y cero latencia. Los dos motores son
funciones puras con contrato estable: se les puede cambiar el interior por
embeddings sin tocar rutas ni UI.

Ora nunca genera SQL. Cada consulta ya viene escrita en el catalogo; el
motor solo elige cual. Una cifra equivocada en un negocio es peor que un
"no se".

---

## Pendiente

- **Ambar Zetha**: el hex llego sin resolver (`{{accentHex}}`). Esta como
  `#F5A524` provisional en `public/styles.css`, en una sola linea.
- Los demas personajes (Tico, Bodo, Sello, Zeta) son branding de otras
  areas y no estan implementados. Sumar uno funcional = una entrada en el
  catalogo de `manejarCatalogo()`; el front construye su panel solo.
