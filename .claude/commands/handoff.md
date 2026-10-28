---
description: Genera/actualiza HANDOFF.md, agrega entrada a JOURNAL.md y (si aplica) DECISIONS.md antes de abrir PR a develop
---

# /handoff

Ejecutar al terminar una feature, antes de abrir el PR contra `develop`. Asegura que el contexto queda versionado en el repo para que José y Tato mantengan un hilo de memoria entre sesiones y máquinas.

## Qué hacés cuando se invoca este comando

### 1. Diagnóstico del estado actual

Leé (no asumas):
- `git status` — archivos modificados
- `git log origin/develop..HEAD --oneline` — commits de la feature
- `git diff origin/develop...HEAD --stat` — scope del cambio
- Branch activa (`git branch --show-current`)
- `.claude/HANDOFF.md` actual (para ver qué dice hoy)
- Últimas 2 entradas de `.claude/memoria/JOURNAL.md`
- Último ID de `.claude/memoria/DECISIONS.md` (para numerar la siguiente)

### 2. Proponer actualización de HANDOFF.md

Generá una versión nueva reescrita completa, NO un append. Debe reflejar el estado **post-merge** (lo que quedará en develop cuando se mergee este PR).

Estructura:
- **Dónde estamos** — fase actual, qué cambió en esta feature
- **Branch activa** — si ya se abre PR, anotá que está pendiente de merge
- **Qué está hecho** — lista concreta
- **Qué está pendiente** — próximos pasos inmediatos
- **Bloqueos / Dudas abiertas** — si hay
- **Decisiones recientes relevantes** — 3-5 highlights con link a DECISIONS.md si aplica
- **Quién hizo qué en la última sesión**
- **Próximos pasos concretos** — 3-5 bullets accionables

Máx ~120 líneas.

### 3. Proponer entrada nueva para JOURNAL.md

Append al final del archivo, formato estandarizado:

```markdown
## YYYY-MM-DD — <autor> — `feature/<nombre>` → `develop`

### Contexto
<1-3 líneas sobre por qué se abrió esta feature>

### Qué se hizo
<lista concreta de cambios agrupados por área>

### Decisiones clave tomadas
<links a entradas de DECISIONS.md si aplica, o "ninguna decisión nueva registrada">

### Problemas / consideraciones
<bloqueos, workarounds, cosas raras que aparecieron>

### Estado al cerrar
<1-2 líneas sobre qué queda listo para la próxima fase>
```

Fecha en formato ISO (YYYY-MM-DD). Autor deducido de `git config user.name` o preguntado si hay duda.

### 4. Proponer entradas para DECISIONS.md si aplica

**Solo si** durante la feature se tomó alguna decisión técnica relevante que:
- No estaba documentada antes
- Afecta cómo se codea o se piensa el sistema
- Tuvo alternativas evaluadas y descartadas

Formato:
```markdown
## #<número consecutivo> — <título corto>

**Fecha:** YYYY-MM-DD
**Autor:** <nombre>

**Contexto:** <qué problema se estaba resolviendo>

**Decisión:** <qué se eligió>

**Alternativas descartadas:**
- <opción>: <por qué no>

**Consecuencias:** <qué implica esta elección>
```

Si no hubo decisiones, no agregues nada — NO inventes entradas por inventar.

### 5. Mostrar todo al usuario y esperar confirmación

Antes de escribir los archivos:
- Mostrá los 3 diffs propuestos (HANDOFF completo, entrada JOURNAL, entrada/s DECISIONS)
- Pedí confirmación explícita
- Si el usuario pide ajustes → aplicalos y volvé a mostrar

### 6. Escribir archivos

Solo después de confirmación:
- `Write` sobre `.claude/HANDOFF.md` (reescritura completa)
- `Edit` en `.claude/memoria/JOURNAL.md` append al final
- `Edit` en `.claude/memoria/DECISIONS.md` append al final (si aplica)

### 7. NO hacer git commit ni git push automáticamente

El usuario decide cuándo commitear. Terminá el comando indicando:
- Qué archivos se modificaron
- Sugerencia de mensaje de commit (ej: `chore(handoff): cierre feature/<nombre> pre-PR`)
- Recordarle que falta abrir el PR contra `develop`

## Regla crítica

Nunca inventes contexto. Si no podés deducir algo del git log o los archivos, preguntá al usuario antes de escribir.
