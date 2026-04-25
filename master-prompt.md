Actúa como un principal engineer / staff full-stack engineer especializado en construir aplicaciones SaaS internas de operaciones y reclutamiento listas para producción.

Quiero que construyas desde cero una aplicación web completa para FOLGA, pensada como un sistema interno y externo de captación y gestión de candidatos. No quiero un prototipo superficial: quiero una app real, desplegable, escalable y mantenible.

====================
OBJETIVO DEL PRODUCTO
====================

La app debe centralizar en una sola plataforma todo este flujo:

1. Un candidato entra a una página pública y rellena un formulario.
2. Al hacer submit:
   - se valida toda la información;
   - se crea automáticamente el perfil del candidato en la base de datos;
   - se suben y registran los documentos adjuntos;
   - se evita la creación de duplicados;
   - el registro queda visible de inmediato en el panel interno.
3. El equipo interno de reclutamiento de FOLGA puede:
   - ver todos los candidatos;
   - filtrarlos;
   - actualizar estados;
   - ver documentos;
   - añadir notas internas;
   - exportar datos a Excel/CSV;
   - gestionar el pipeline de reclutación.
4. Excel/CSV no debe ser la fuente principal de verdad; la base de datos debe ser el sistema maestro y Excel/CSV solo una salida operativa o de exportación.

====================
TIPO DE APP
====================

Quiero una web app profesional de reclutamiento / ATS liviano / candidate intake system.

Debe tener:
- una parte pública para candidatos;
- una parte privada para recruiters y admins;
- una arquitectura lista para producción;
- deployment real.

====================
STACK TECNOLÓGICO OBLIGATORIO
====================

Usa este stack salvo que exista una razón técnica muy fuerte para cambiar algo:

- Next.js 15+ con App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL (preferiblemente Supabase Postgres o Neon)
- React Hook Form
- Zod
- Autenticación con NextAuth o Supabase Auth
- Upload de archivos con Supabase Storage o S3-compatible storage
- Exportación a CSV y XLSX
- API routes / route handlers en Next.js
- Deploy en Vercel
- Variables de entorno bien organizadas
- ESLint + Prettier
- Arquitectura modular y limpia

Si decides usar Supabase, puedes usar:
- Supabase Postgres
- Supabase Storage
- Supabase Auth
pero mantén Prisma si es viable, o justifica claramente si prefieres no combinar ambos.

====================
REQUERIMIENTOS DE NEGOCIO
====================

La aplicación debe cubrir estos módulos:

A. FORMULARIO PÚBLICO DE CANDIDATOS
- URL pública para candidatos
- Responsive mobile-first
- Multi-step form o single form bien estructurado
- Validación cliente y servidor
- Campos obligatorios y opcionales
- Confirmación de envío
- Protección básica anti-spam
- Consentimiento legal / GDPR / RODO

Campos iniciales sugeridos:
- nombre
- segundo nombre
- apellido
- teléfono
- email
- fecha de nacimiento
- lugar de nacimiento
- país de nacimiento
- ciudadanía
- nacionalidad
- sexo
- estado civil
- educación
- fecha estimada de llegada
- necesita alojamiento
- observaciones
- consentimiento de contacto
- consentimiento de reclutación

B. DOCUMENTOS
- permitir subir CV
- permitir subir pasaporte/DNI/permiso si se quiere activar
- guardar metadatos de documentos
- relacionar documentos con el candidato
- guardar tipo de documento, nombre de archivo, fecha, estado y URL segura

C. BASE DE DATOS
Crear un esquema sólido y normalizado con tablas mínimas como:
- users
- candidates
- candidate_documents
- candidate_notes
- recruitment_status_history
- audit_logs
- optionally recruiters / assignments

D. DEDUPLICACIÓN
Implementar lógica para evitar duplicados:
- prioridad 1: email
- prioridad 2: teléfono
- si ya existe, no crear un candidato nuevo sin control
- permitir estrategia create / update / merge_candidate
- dejar trazabilidad de duplicados potenciales

E. PANEL INTERNO
Debe incluir:
- dashboard principal
- tabla de candidatos
- buscador
- filtros
- detalle individual del candidato
- timeline o historial
- documentos
- notas internas
- cambios de estado
- acciones rápidas
- exportación a CSV/XLSX
- vista limpia y productiva

Estados sugeridos:
- NUEVO
- CONTACTADO
- EN REVISION
- ENTREVISTA
- DOCUMENTACION PENDIENTE
- APROBADO
- RECHAZADO
- CONTRATADO

F. ROLES Y PERMISOS
Mínimo:
- admin
- recruiter
- viewer

G. EXPORTACIÓN
- exportar candidatos filtrados a CSV
- exportar candidatos filtrados a XLSX
- incluir columnas configurables
- no usar Excel como sistema transaccional principal

H. API INTERNA
Crear endpoints bien diseñados para:
- create candidate
- update candidate
- upload documents
- list candidates
- candidate detail
- add notes
- update recruitment status
- export candidates

I. LOGS Y AUDITORÍA
- registrar creación de candidato
- registrar cambios de estado
- registrar uploads
- registrar errores importantes
- registrar usuario que hizo cambios internos

====================
DISEÑO / UI / UX
====================

Este punto es CRÍTICO.

Quiero una interfaz con estas reglas visuales obligatorias:

- ZERO BORDER RADIUS UI: absolutamente todo debe tener border-radius: 0 o visualmente cero.
- Nada de esquinas redondeadas.
- Nada de estética bubbly.
- Nada de UI estilo startup genérica.
- Nada de morado, gradients de IA, glow effects, blobs, glassmorphism ni estilos “futuristas”.
- Nada de tarjetas con iconos en círculos de color.
- Nada de botones con gradiente.
- Nada de paneles con bordes redondeados.
- Nada de look “template SaaS AI”.

Quiero un estilo:
- sobrio
- enterprise
- Swiss / editorial / brutal clean
- muy limpio
- jerarquía tipográfica fuerte
- layout ordenado
- mucho uso de grid
- bordes rectos
- 1px borders
- superficies neutras
- acentos muy medidos
- diseño funcional primero

Inspiración visual:
- software enterprise elegante
- dashboards minimalistas
- estética editorial técnica
- sensación de herramienta seria y operativa
- nada juguetón

Reglas UI obligatorias:
- border-radius global = 0
- inputs rectos
- botones rectos
- modales rectos
- tablas rectas
- cards rectas
- dropdowns rectos
- badges rectos o con esquinas completamente rectas
- uso intensivo de líneas, divisores y estructura
- tipografía sans limpia, no experimental
- preferir una combinación como Geist / Inter / Satoshi / General Sans
- máximo 1 color de acento
- light mode y dark mode incluidos
- foco en legibilidad y densidad de información
- excelente tabla de datos
- excelente experiencia mobile sin perder carácter desktop

También quiero:
- estados vacíos bien diseñados
- skeletons
- errores inline claros
- UX defensiva
- feedback de submit
- navegación rápida
- dashboard usable de verdad

====================
ARQUITECTURA TÉCNICA
====================

Quiero que diseñes la app con:
- estructura de carpetas profesional
- separación clara entre app, components, lib, server, db, schemas, actions, api
- convenciones consistentes
- reusable UI primitives
- capa de validación compartida
- server-side validation
- manejo de errores robusto
- typed APIs
- seguridad básica real

Quiero:
- schema Prisma completo
- migraciones
- seed opcional
- tipos TypeScript correctos
- acciones y servicios desacoplados
- DTOs o contratos claros si hace falta

====================
PÁGINAS Y RUTAS
====================

Construye al menos estas rutas:

Públicas:
- /
- /apply
- /apply/success

Privadas:
- /login
- /dashboard
- /candidates
- /candidates/[id]
- /documents
- /settings
- /export

Puedes proponer otras si mejoran el producto.

====================
REQUISITOS DE IMPLEMENTACIÓN
====================

Quiero que entregues TODO lo necesario para que el proyecto se pueda clonar, instalar y desplegar.

Eso incluye:
1. estructura de proyecto
2. código completo
3. schema de base de datos
4. rutas
5. componentes
6. formularios
7. lógica backend
8. autenticación
9. uploads
10. exportaciones
11. manejo de errores
12. seeds o datos demo
13. README completo
14. instrucciones de setup
15. archivo .env.example
16. comandos de instalación
17. pasos de migración
18. pasos de deployment
19. recomendaciones de hardening
20. test plan básico

====================
DEPLOYMENT
====================

Quiero deployment realista en:
- Vercel para frontend/backend Next.js
- Supabase o Neon/Postgres para base de datos
- Supabase Storage o S3 para documentos

Incluye:
- variables de entorno necesarias
- configuración para producción
- pasos exactos para desplegar
- consideraciones de dominio
- seguridad mínima
- estrategia de backups recomendada
- logs / observabilidad recomendada

====================
ENTREGABLES ESPERADOS
====================

Tu respuesta debe construirme el proyecto de forma integral y ordenada.

Quiero que generes:

1. Resumen ejecutivo del sistema
2. Arquitectura técnica
3. Modelo de datos
4. Estructura de carpetas
5. Prisma schema completo
6. Plan de autenticación y roles
7. Diseño del formulario público
8. Diseño del dashboard interno
9. Endpoints o route handlers necesarios
10. Estrategia de uploads
11. Estrategia de exportación CSV/XLSX
12. Lógica de deduplicación
13. Código base de cada parte importante
14. Setup local
15. Deployment paso a paso
16. Checklist de QA
17. Posibles mejoras futuras

====================
ESTILO DE IMPLEMENTACIÓN
====================

- No me des teoría genérica.
- No me des respuestas vagas.
- No me des solo ideas.
- Quiero decisiones concretas.
- Si hay varias opciones, elige una y justifica brevemente.
- Produce código realista y consistente.
- Mantén naming limpio.
- Escribe en español, pero el código y nombres técnicos pueden ir en inglés.
- Si necesitas asumir cosas, asume las más razonables para una empresa de reclutamiento como FOLGA.
- Prioriza mantenibilidad, velocidad de entrega y capacidad de crecer después.
- No sacrifiques calidad de datos por rapidez visual.

====================
REGLA FINAL DE DISEÑO
====================

Recuerda: ZERO BORDER RADIUS UI.
Todo debe ser cuadrado, recto, limpio, sobrio y enterprise.
Si en algún momento vas a usar border-radius por defecto, elimínalo.
No quiero nada redondeado en ningún componente.