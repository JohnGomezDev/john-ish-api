# Docker

La API y Postgres (pgvector) se levantan con Compose. Los dos archivos leen `.env`. Dentro de la red de Compose, `DB_HOST` se sobreescribe a `postgres`; en el host sigue siendo `localhost` para `pnpm start`.

`compose.hub.yaml` espera la imagen que el CD workflow publicará en Docker Hub (`DOCKER_IMAGE`).

## Archivos

| Archivo                                          | Uso                                                |
| ------------------------------------------------ | -------------------------------------------------- |
| [`compose.yaml`](./compose.yaml)                 | Pruebas locales: build de la imagen y `up`         |
| [`compose.hub.yaml`](./compose.hub.yaml)         | Misma topología, sin build. Toma `${DOCKER_IMAGE}` |
| [`Dockerfile`](./Dockerfile)                     | Multi-stage sobre `node:24.19.0-bookworm-slim`     |
| [`docker/entrypoint.sh`](./docker/entrypoint.sh) | Migraciones, seeders opcionales y arranque         |

La imagen usa Debian slim (glibc). Alpine no sirve: `onnxruntime-node`, que carga `@xenova/transformers`, no trae binario musl.

## Arranque local

```bash
cp env.example .env
docker compose -f compose.yaml up --build
```

La API queda en `http://localhost:<PORT>/api` (por defecto `4000`). Swagger: `http://localhost:<PORT>/api/docs`.

Contenedores: `johnish-api` y `johnish-api-postgres`.

## Imagen de Docker Hub

```bash
docker compose -f compose.hub.yaml up
```

`DOCKER_IMAGE` en `.env` apunta a la imagen (por defecto `johngomezdev/john-ish-api:latest`). Cámbiala si el usuario de Docker Hub es otro.

En el VPS la API no publica su puerto. Traefik, en la red externa `traefik-proxy`, enruta `api.johnish.dev`: el entrypoint `web` redirige a HTTPS y `websecure` termina TLS con el certresolver `letsencrypt`. Esos nombres tienen que coincidir con el Traefik del servidor. El registro DNS `A` de `api.johnish.dev` apunta a la IP del VPS, y los puertos 80 y 443 deben estar abiertos.

```bash
docker network create traefik-proxy
```

## Migraciones y seeders

`migrationsRun` sigue en `false`. El entrypoint, con `set -eu`, ejecuta las migraciones compiladas en cada arranque (`dist/database/datasource.js`). Si fallan, el contenedor se detiene y la API no arranca.

Los seeders compilados solo corren si `RUN_SEEDERS=true`. Son idempotentes. Para sembrar una vez: pon la flag en `true`, levanta, y vuelve a `false`.

Revertir la última migración dentro del contenedor (la API debe estar detenida). Al volver a levantar la misma imagen, el entrypoint la aplica otra vez; para dejarla revertida hace falta una imagen que ya no la incluya.

```bash
docker compose -f compose.hub.yaml stop api

docker compose -f compose.hub.yaml run --rm --no-deps --entrypoint npm api run migration:revert:prod
```

En local el archivo es `compose.yaml` y el servicio sigue llamándose `api`.

## Volúmenes

Nombres fijos, compartidos por los dos compose:

| Volumen                        | Montaje           |
| ------------------------------ | ----------------- |
| `johnish_api_postgres_data`    | Datos de Postgres |
| `johnish_api_embeddings_cache` | Pesos de multilingual-e5-small |

`DB_PORT` es el puerto de Postgres dentro de la red de Docker en `5432`, `pnpm start` en el host y la API en Docker llegan a la misma base.

El modelo no se descarga en el build. `EmbeddingService` escribe la caché en `EMBEDDINGS_CACHE_DIR` (`/var/cache/johnish-api/embeddings`), y el volumen conserva esos archivos entre builds. El primer arranque descarga multilingual-e5-small; los siguientes lo cargan desde el volumen. Esa variable no va en `.env`: en el host, `pnpm start` usa la caché por defecto de Transformers.js.

## Variables de Docker en `.env`

| Variable       | Uso                                                          |
| -------------- | ------------------------------------------------------------ |
| `RUN_SEEDERS`  | `true` ejecuta los seeders compilados tras las migraciones   |
| `DOCKER_IMAGE` | Imagen que usa `compose.hub.yaml`                            |
| `DB_PORT`      | Puerto de Postgres dentro del contenedor y el que usa la API |
