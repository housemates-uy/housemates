# Skills del proyecto

Skills de Claude Code compartidos por el equipo de HOUSE MATES.
Cada subcarpeta es un skill que cualquier miembro puede invocar desde Claude Code al clonar el repo.

## Formato

```
.claude/skills/nombre-skill/
├── SKILL.md        # descripción e instrucciones
└── (archivos de soporte si aplica)
```

## Skills disponibles

### `frontend-design/`
Crear interfaces distintivas, anti "AI slop". Fuerza a tomar decisiones estéticas bold en lugar de defaults genéricos. Se usa antes de codear cualquier UI nueva (landing, gate, admin, emails).

### `shannon/`
Pentester autónomo white-box. Analiza código fuente + ejecuta exploits reales para probar vulnerabilidades. Se corre antes de cada PR con cambios sensibles (gate, webhook MP, RLS, auth).

### `code-reviewer/`
Review automático de PRs (TypeScript/JavaScript + otros). Best practices, security scan, checklist. Se corre sobre el diff antes del push final.

### `browser-use/`
Automatiza navegador para testing e2e, screenshots, extracción de data. Útil para smoke tests del flow de compra y validar visualmente cambios de UI.

### `claude-md-improver/`
Audita y mejora el `CLAUDE.md` del repo. Detecta reglas desactualizadas, convenciones faltantes o inconsistencias. Se corre al cerrar cada feature, antes de `/handoff`.

## Cómo invocarlos

Desde Claude Code, mencionar el nombre del skill o su trigger (ej: "corré shannon sobre la app local", "usá frontend-design para la landing").

## Skills propuestos a futuro

- **new-migration** — genera una migration SQL con naming correcto + actualiza types
- **publish-event** — flujo guiado para publicar un evento
- **close-event** — posterior al evento: marca archived, genera reporte, exporta data a CSV

A medida que identifiquemos flujos repetitivos complejos, los convertimos en skills.
