# Portfolio API

Backend del portafolio personal: autenticación de administrador, blog (público y CMS) y canción favorita (Deezer).

La referencia de endpoints para el frontend está en [`API.md`](./API.md). La especificación interactiva (Swagger / OpenAPI 3.0) se sirve en `/api/docs`.

## Stack

| Tecnología                                  | Uso                                                |
| ------------------------------------------- | -------------------------------------------------- |
| Node.js **v24.19.0** + **pnpm**             | Runtime y gestor de paquetes                       |
| **NestJS v11** + TypeScript                 | Framework HTTP                                     |
| **TypeORM** + **PostgreSQL**                | Persistencia (sin `synchronize`; solo migraciones) |
| **JWT** (`@nestjs/jwt` + Passport)          | Access token de corta duración                     |
| Refresh token opaco + cookie `httpOnly`     | Sesión del admin (whitelist en BD)                 |
| **Swagger** (`@nestjs/swagger`)             | Documentación OpenAPI en `/api/docs`               |
| **class-validator** / **class-transformer** | Validación de DTOs                                 |
| **Jest** + Supertest                        | Tests unitarios y e2e                              |
| **@nestjs/throttler**                       | Rate limiting global                               |
| **bcrypt**                                  | Hash de contraseñas y secretos de refresh token    |
| Deezer API (HTTP)                           | Búsqueda y persistencia de la canción favorita     |
| **Xenova/bge-m3** (local, ONNX)             | Embeddings para búsqueda semántica (1024 dims)     |
| **Groq** `openai/gpt-oss-20b`               | LLM para generación de respuestas RAG              |

## Requisitos

- Node.js 24.19.0 (recomendado)
- pnpm
- `pgvector/pgvector:pg17` (Docker) — PostgreSQL 17 con extensión pgvector incluida

Para levantar API y base con Compose, sigue [`README.Docker.md`](./README.Docker.md).

## Instalación

```bash
pnpm install
cp env.example .env
```

Completa `.env` (sobre todo `JWT_ACCESS_SECRET` y las credenciales de PostgreSQL). Luego:

```bash
pnpm migration:run
pnpm seed:run
pnpm start:dev
```

La API queda en `http://localhost:<PORT>/api` (por defecto `PORT=4000` en `env.example`). Swagger: `http://localhost:<PORT>/api/docs`.

Los seeders siembran categorías y tags. Los seeders son idempotentes. Con `pnpm start` no se ejecutan al arrancar. En Docker solo corren si `RUN_SEEDERS=true` (ver [`README.Docker.md`](./README.Docker.md)).

## Variables de entorno

Definidas en `env.example`:

| Variable                                                  | Descripción                                                                                                      |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                | `development` / `production`. En producción la cookie de refresh usa `secure: true`                              |
| `PORT`                                                    | Puerto HTTP (default de código: `3000` si no se define)                                                          |
| `CORS_ORIGIN`                                             | Orígenes permitidos, separados por coma (ej. `http://localhost:3000`). Si se omite, CORS acepta cualquier origen |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexión PostgreSQL. `DB_PORT` es el puerto del servidor (dentro de Docker, el puerto del contenedor)            |
| `RUN_SEEDERS`                                             | En Docker, `true` ejecuta los seeders compilados después de las migraciones. Default `false`                     |
| `DOCKER_IMAGE`                                            | Imagen de Docker Hub que usa `compose.hub.yaml`                                                                  |
| `JWT_ACCESS_SECRET`                                       | Secreto para firmar el access token (**obligatorio**)                                                            |
| `JWT_ACCESS_EXPIRES_IN`                                   | TTL del JWT (default `15m`)                                                                                      |
| `REFRESH_TOKEN_TTL_HOURS`                                 | Ventana de la sesión al hacer login (default `48`). El refresh **no** alarga esa fecha                           |
| `GROQ_API_KEY`                                            | Clave de API de Groq (obligatoria para el módulo RAG)                                                            |
| `RAG_TOP_K`                                               | Número de chunks recuperados por búsqueda (default: 5)                                                           |

CORS está habilitado con `credentials: true`. El frontend debe enviar cookies (`credentials: 'include'` / `withCredentials: true`) y el origen debe coincidir con `CORS_ORIGIN`.

## Scripts

```bash
pnpm start          # arranque
pnpm start:dev      # watch
pnpm start:debug    # debug + watch
pnpm start:prod     # node dist/main
pnpm build

pnpm lint
pnpm format

pnpm test           # unitarios (src/**/*.spec.ts)
pnpm test:watch
pnpm test:cov
pnpm test:e2e
pnpm test:e2e:watch
pnpm test:e2e:cov

pnpm migration:generate src/database/migrations/<nombre>
pnpm migration:run
pnpm migration:revert
pnpm migration:show
pnpm seed:run

pnpm migration:run:prod      # CLI sobre dist/ (contenedor)
pnpm migration:revert:prod
pnpm seed:run:prod
```

`synchronize` y `migrationsRun` están en `false`. En el host, las migraciones y los seeders se ejecutan con los scripts de arriba. En Docker, el entrypoint corre las migraciones compiladas en cada arranque; los seeders solo si `RUN_SEEDERS=true`. Detalle de compose, volúmenes y túnel: [`README.Docker.md`](./README.Docker.md).

## Asistente del Blog (RAG)

Al publicar (o actualizar) un post, el sistema lo indexa automáticamente: convierte el markdown a texto plano, lo divide en chunks, genera embeddings con **BGE-M3** y los guarda en `posts_chunks` (pgvector). Al despublicar, elimina esos chunks.

La consulta combina búsqueda semántica (HNSW, distancia coseno) y full-text (`tsvector` GIN) mediante **Reciprocal Rank Fusion (RRF)**. Con los fragmentos recuperados, Groq (`openai/gpt-oss-20b`) genera la respuesta.

Endpoint público (sin autenticación):

```http
POST /api/rag/ask
Content-Type: application/json

{ "query": "¿Cómo implementar autenticación JWT en NestJS?" }
```

Respuesta (dentro de `ApiResponseDto`):

```json
{
  "answer": "…",
  "sources": [{ "title": "…", "slug": "…" }]
}
```

`sources` solo incluye posts que el LLM citó con `[n]` en la respuesta (no todos los chunks recuperados).

## Arquitectura

Clean Architecture por módulo, con inversión de dependencias: el dominio no conoce TypeORM ni HTTP.

```
Request → Controller (HTTP) → Use case (lógica) → IRepository (puerto)
                                      ↑
                         RepositoryImpl + TypeORM (adaptador)
```

| Capa               | Ubicación                                                | Responsabilidad                                                                 |
| ------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Entidad de dominio | `domain/entities/*.entity.ts`                            | Clase pura: factories, transiciones de estado, invariantes. Sin decoradores ORM |
| Puerto             | `domain/repositories/*.repository.interface.ts`          | Contrato + token de inyección                                                   |
| Caso de uso        | `application/use-cases/**/*.use-case.ts`                 | Toda la lógica de negocio. Lanza las excepciones HTTP                           |
| Entidad TypeORM    | `infrastructure/persistence/typeorm/*.typeorm-entity.ts` | Tabla y columnas. Nunca importada por el dominio                                |
| Implementación     | `infrastructure/persistence/*.repository.impl.ts`        | `toOrm` / `toDomain`                                                            |
| DTO request        | `infrastructure/http/dtos/request/*.request.dto.ts`      | Validación + Swagger                                                            |
| DTO response       | `infrastructure/http/dtos/response/*.response.dto.ts`    | Forma de salida + `fromDomain`                                                  |
| Controller         | `infrastructure/http/*.controller.ts`                    | Delega al use case y envuelve en `ApiResponseDto`. Sin lógica                   |
| Module             | `<module>.module.ts`                                     | Enlaza token → implementación                                                   |

### Módulos

| Módulo  | Rol                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------- |
| `admin` | Entidad y repositorio de administradores (sin controller público)                                             |
| `auth`  | Login, refresh, logout, JWT, cookie, CRON de limpieza de tokens                                               |
| `blog`  | Blog público (`/api/blog/*`), CMS de posts (`/api/admin/posts`) y CRUD de categorías/tags (`/api/admin/blog`) |
| `songs` | Búsqueda Deezer, guardar/reemplazar favorita, lectura pública                                                 |

Código compartido: `src/common/` (wrapper de respuesta, filtro de excepciones, hasher). Base de datos: `src/database/` (DataSource, migraciones, seeds).

### Flujo HTTP

1. Prefijo global `/api` (sin versionado).
2. `ValidationPipe` global: `whitelist`, `forbidNonWhitelisted`, `transform`.
3. `ThrottlerGuard` global (límites en `AppModule`; login tiene umbrales más estrictos).
4. `JwtAuthGuard` en rutas de admin.
5. Éxito: `ApiResponseDto.ok(data, message)` → `{ status: "ok", message, data }`.
6. Error: `AllExceptionsFilter` → `{ statusCode, message, error }`.

Las excepciones de negocio se lanzan **solo** en los use cases.

## Autenticación

Solo hay usuarios administrador. El login es por `username`, no por email.

| Token         | TTL                                            | Dónde viaja                                             |
| ------------- | ---------------------------------------------- | ------------------------------------------------------- |
| Access JWT    | `JWT_ACCESS_EXPIRES_IN` (15m)                  | Header `Authorization: Bearer <token>`                  |
| Refresh opaco | `REFRESH_TOKEN_TTL_HOURS` (48h desde el login) | Cookie `refresh_token` (`httpOnly`, `sameSite: strict`) |

Payload del JWT: `{ sub, name, lastName, username }`.

El refresh token es `{id}.{secret}`: el `id` es la fila de whitelist; el `secret` solo se persiste como hash bcrypt. Varias sesiones concurrentes están permitidas (una fila por login). En cada refresh se rota el token **sin extender** `expiresAt`. Un mismatch de secreto borra la fila (posible robo). Un job horario (`RefreshTokenCleanupJob`) elimina filas vencidas.

Detalle de integración (headers, cookies, códigos): [`API.md`](./API.md#autenticación).

## Convenciones

- Código en **inglés**. Mensajes al cliente en **español**.
- Archivos y carpetas de módulo: kebab-case. Clases: PascalCase. Interfaces: `I…`. Type aliases: `T…`.
- Tablas y columnas: snake_case (`lastName` → `last_name`).
- JSDoc solo cuando hay reglas o efectos no obvios.

## Base de datos

PostgreSQL. DataSource único en `src/database/datasource.ts` (Nest y CLI).

### Tablas

- `admin_users` — administradores
- `admin_refresh_tokens` — whitelist de refresh (sin `updated_at`; inmutable)
- `blog_categories`, `post_tags`, `posts`, `post_tag` (N:N)
- `songs` — una canción favorita (guardar reemplaza el registro existente)

Relaciones: un admin tiene muchos posts y muchos refresh tokens; una categoría tiene muchos posts; posts ↔ tags vía `post_tag`.

`posts.content` se guarda en **markdown**. `posts.excerpt` ~160 caracteres. `posts.search_vector` es un `tsvector` generado (`spanish` sobre título + contenido) con índice GIN.

Búsqueda full-text:

```sql
WHERE search_vector @@ plainto_tsquery('spanish', 'palabra clave')
```

Índices relevantes: slug único, `category_id`, `post_tag.tag_id`, `expires_at` de refresh tokens, GIN de `search_vector`. No hay índice en `posts.published` (volumen bajo).

## Rate limiting

Límites globales (`ThrottlerModule`):

| Nombre   | Ventana | Máximo |
| -------- | ------- | ------ |
| `short`  | 1 s     | 3      |
| `medium` | 60 s    | 20     |
| `long`   | 1 h     | 200    |

Login (`POST /api/auth/login`) reduce a 5 / 60 s y 20 / 15 min. Respuesta `429`: `Demasiadas solicitudes, intenta de nuevo más tarde`.

## Tests

- Unitarios: junto al código, `*.spec.ts`. Mocks por token de repositorio (`useValue`).
- e2e: `test/<módulo>/*.e2e-spec.ts` contra la app completa y una **base de datos de test**, nunca la de desarrollo/producción.

Los e2e replican `main.ts` (prefijo `/api`, `ValidationPipe`, filtro global, `cookie-parser` cuando aplica).

## Estructura de carpetas

```
src/
  main.ts
  app.module.ts
  common/
    dto/response/
    filters/
    security/
  database/
    datasource.ts
    migrations/
    seeds/
  modules/
    admin/
    auth/
    blog/
    songs/
test/
  auth/
  blog/
  songs/
  helpers/
```
