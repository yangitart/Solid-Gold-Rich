# Guía SDD del proyecto

Este repositorio usa GitHub Spec Kit. La especificación es la fuente de intención y el código es su
implementación.

## Dónde pertenece cada cosa

| Tipo de información | Artefacto | Regla de uso |
|---------------------|-----------|--------------|
| Regla permanente del proyecto | `.specify/memory/constitution.md` | Se cambia explícitamente, con versión SemVer y Sync Impact Report. |
| Orientación operativa del repositorio | `AGENTS.md` | Solo rutas, comandos y contexto necesario para trabajar; no requisitos de features. |
| Qué necesita el usuario y por qué | `specs/<NNN-feature>/spec.md` | Historias priorizadas, aceptación, `FR-###`, `SC-###`, bordes y supuestos; sin decisiones técnicas. |
| Respuestas a ambigüedades | Sección `Clarifications` de `spec.md` | Se agregan antes de planificar cuando una decisión cambia alcance, seguridad o experiencia. |
| Cómo se construirá | `plan.md` | Stack, arquitectura, estructura, Constitution Check y decisiones técnicas. |
| Decisiones investigadas | `research.md` | Decisión, razón y alternativas consideradas. |
| Datos e interfaces | `data-model.md` y `contracts/` | Entidades, invariantes, estados y contratos observables. |
| Cómo validar de extremo a extremo | `quickstart.md` | Escenarios y resultados esperados, sin contener la implementación completa. |
| Calidad de los requisitos | `checklists/*.md` | Son “tests del inglés”; `[x]` significa que un revisor aprobó la calidad del requisito, no que el código esté terminado. |
| Trabajo ejecutable | `tasks.md` | Tareas ordenadas con checkbox, ID, `[P]` si aplica, historia `[US#]` y ruta exacta. |

## Flujo

```text
constitution (una vez o cuando cambian reglas)
  -> specify
  -> clarify (opcional)
  -> plan
  -> checklist (opcional)
  -> tasks
  -> analyze (recomendado)
  -> implement
  -> converge
  -> implement/converge hasta quedar convergido
```

Comandos/habilidades instaladas para Codex:

- `$speckit-constitution`
- `$speckit-specify`
- `$speckit-clarify`
- `$speckit-plan`
- `$speckit-checklist`
- `$speckit-tasks`
- `$speckit-analyze`
- `$speckit-implement`
- `$speckit-converge`

## Cómo añadir trabajo después

1. Si la petición es una capacidad independiente, crear el siguiente directorio
   `specs/<NNN-short-name>/` mediante `$speckit-specify`.
2. Si cambia el comportamiento, alcance o criterio de éxito de una feature existente, actualizar
   primero `spec.md` y volver a comprobar su checklist.
3. Si cambia una decisión técnica o ruta de implementación, actualizar `plan.md` y sus artefactos de
   diseño antes de regenerar tareas.
4. Si es trabajo concreto dentro del alcance aprobado, añadirlo a `tasks.md` con el siguiente ID sin
   renumerar tareas existentes.
5. Una tarea de historia usa este formato:

   ```text
   - [ ] T010 [P] [US1] Acción trazable a FR-### en ruta/exacta/archivo.ts
   ```

6. `[P]` solo se usa si la tarea puede ejecutarse en paralelo sin tocar el mismo archivo ni depender
   de trabajo incompleto.
7. Después de cambiar artefactos, ejecutar `$speckit-analyze`; después del código, ejecutar
   `$speckit-converge`. Converge solo añade tareas faltantes y nunca reescribe las anteriores.

`.specify/feature.json` es un puntero local ignorado por Git. Selecciona la feature activa para los
scripts de plan, tareas, análisis, implementación y convergencia.
