## Why

La ruta visual ya envía a Gemini la imagen renderizada de cada página, pero su arquitectura permite que grandes bloques de texto lineal influyan en la percepción visual, que el fallback textual arrastre categorías entre páginas y que resultados inválidos lleguen a `accepted` después de agotar retries. Además, la reconciliación, los retries regionales y el flattening pierden contexto espacial y provenance, por lo que no es posible demostrar dónde nació un item defectuoso.

Esta iteración establece una arquitectura visual-first por página con validación semántica explícita, retries dirigidos, reconciliación document-level conservadora y lineage durable antes de modificar el comportamiento. El fixture de Subarashii servirá como regresión, no como fuente de reglas de producción.

## What Changes

- Añadir una fundación de observabilidad que relacione página renderizada, request a Gemini, respuesta raw, resultado decodificado, validación, retries, reconciliación, normalización y persistencia.
- Hacer que la extracción primaria sea image-only para boundaries: rendered image, instrucciones/schema, page number y metadata técnica mínima; conservar OCR/texto fuera del primary extraction como evidence o contexto de targeted retry.
- Mantener `MenuDocument.pages[].sections[].items[]` durante extracción, validación y reconciliación; diferir el flattening y conservar IDs, `sectionKey`, bbox, razones, attempt y source.
- Endurecer el contrato estructurado de Gemini para representar items visuales independientes, precios únicos o variantes y bbox normalizados; todos los item/section/candidate/attempt/lineage/reconciled-section IDs serán generados por el servidor después del decode.
- Separar normativamente estados `valid`, `review` e `invalid`; `retry_exhausted` será metadata de ejecución y nunca promoverá un resultado. Los fragments inválidos no serán drafts ni aparecerán como platos sin categoría.
- Sustituir retries idénticos por retries dirigidos por razón, incluyendo reparación regional con overlap, deduplicación, precedence y provenance espacial.
- Aislar el fallback textual: no será una ruta visual equivalente ni conservará estado mutable de categoría entre páginas; sus resultados tendrán tratamiento explícito de evidence/review.
- Añadir reconciliación document-level entre páginas adyacentes para continuidad de secciones, con evidencia y precedencia para encabezados nuevos.
- Mantener separados los valores raw visuales de la normalización de precios/moneda y soportar precios múltiples sin labels o monedas hardcodeados.
- Ajustar mínimamente `MenuImportPanel` y APIs/modelos de review para distinguir items válidos, items ambiguos y fragments inválidos.
- Fijar budgets server-configurables: 1 primary visual attempt + máximo 1 semantic full-page retry + máximo 2 regional semantic retries por página; los provider-transient retries se contabilizarán aparte y también estarán acotados.
- Establecer retención durable de lineage y retención RAW de debug configurable, con default de 7 días, sin duplicar imágenes ni almacenar credenciales.
- Usar `menu-import-v4-visual` como analyzer explícito, manteniendo v3 disponible para imports existentes, comparación y rollback.
- Añadir pruebas determinísticas con respuestas mock/recorded/synthetic separadas de evaluaciones live de Gemini para layouts generales y Subarashii.

## Capabilities

### New Capabilities

- `menu-import-visual-architecture`: extracción visual por página, contratos de provenance, validación semántica, retries espaciales y reconciliación document-level para producir un `MenuDocument` canónico.

### Modified Capabilities

- `menu-import-gemini-structure`: cambiar el contrato de Gemini de estructuración textual/fallback equivalente a una extracción visual multimodal con texto auxiliar controlado, estados de validación y lineage de proveedor/attempt; conservar las garantías de credenciales server-only y respuesta estructurada.

## Impact

- Componentes principales: `src/lib/menu-import/provider.ts`, `visual-analysis.ts`, `worker.ts`, `dispatcher.ts`, APIs de menu import y `MenuImportPanel`.
- Posibles cambios en tipos compartidos, payloads de review, diagnósticos y almacenamiento de lineage. Se evitará una migración de Supabase si las estructuras existentes permiten guardar el contrato; si no, se justificará una migración mínima para estados/provenance/lineage.
- El rollout introducirá `menu-import-v4-visual` detrás de configuración, preservará imports existentes, permitirá rollback a v3 y comparará resultados mediante lineage y métricas antes de promoverla.
- No se cambian todavía reglas de negocio del catálogo, publicación aprobada ni soporte para un restaurante, idioma, moneda, categoría, plato o página concretos.
