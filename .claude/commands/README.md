# Slash commands del proyecto

Acá van los comandos custom de Claude Code compartidos por el equipo.
Cada `.md` en esta carpeta se convierte en un slash command (`/nombre-del-archivo`).

## Formato

```markdown
---
description: Descripción corta del comando
---

Instrucciones que Claude va a ejecutar cuando se tipee /nombre.
Pueden incluir $ARGUMENTS para recibir parámetros.
```

## Comandos propuestos a futuro

- `/new-feature` — crea branch feature/* desde develop y abre un scaffold básico
- `/check-env` — valida que todas las env vars necesarias estén seteadas
- `/migrate` — aplica migrations pendientes de Supabase
- `/seed-whitelist` — agrega emails a whitelist desde un archivo temporal
- `/validate-ticket` — dado un qr_token, muestra su estado completo
- `/mp-test` — dispara un pago de test contra MP sandbox

A medida que aparezcan patrones repetitivos, los convertimos en comandos.
