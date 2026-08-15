# Pasapalabras

Aplicación móvil para preparar y operar partidas de Pasapalabras. Incluye modo individual y por equipos, temporizador, partidas guardadas y una vista de audiencia sin respuestas que se actualiza durante la ronda.

## Publicación en Cloudflare

El proyecto usa Cloudflare Workers para la aplicación y Cloudflare D1 para guardar partidas y estados públicos.

1. Crea una base D1 llamada `pasapalabras-db`.
2. Sustituye `REPLACE_WITH_D1_DATABASE_ID` en `wrangler.jsonc` por su identificador.
3. Ejecuta `npm install`.
4. Ejecuta `npm run deploy`.

El esquema se crea automáticamente al guardar la primera partida o iniciar la primera sesión en vivo.
