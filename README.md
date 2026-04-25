# FOLGA Candidate Hub 🏛️

Sistema integral de captación y gestión de candidatos para FOLGA. Diseñado para operaciones de reclutamiento de alto rendimiento con una estética "Zero Border Radius" inspirada en el brutalismo técnico y el diseño suizo.

## 🚀 Stack Tecnológico

- **Next.js 15+** (App Router)
- **TypeScript**
- **Tailwind CSS** (Estilo Sobrio / Zero Radius)
- **Prisma ORM** + PostgreSQL (Supabase)
- **next-intl** (Multilingüe: ES, EN, RU)
- **Supabase Auth & Storage**
- **XLSX** (Exportación de datos)

## 🛠️ Instalación Local

### 1. Clonar y Dependencias
```bash
npm install
```

### 2. Configurar Variables de Entorno
Copia el archivo `.env.example` a `.env` y rellena los datos de Supabase y PostgreSQL.
```bash
cp .env.example .env
```

### 3. Base de Datos
Prepara el esquema de Prisma y genera el cliente.
```bash
npx prisma generate
npx prisma db push
```

### 4. Datos de Prueba (Seeding)
Puebla la base de datos con candidatos demo.
```bash
npm run seed
```

### 5. Iniciar Desarrollo
```bash
npm run dev
```

## 🏗️ Arquitectura

- `src/app/[locale]/apply`: Formulario público multi-paso.
- `src/app/[locale]/dashboard`: Panel interno para recruiters.
- `src/app/actions`: Lógica de servidor (Creación, Deduplicación).
- `src/app/api/export`: Endpoints para descarga de reportes CSV/XLSX.
- `src/components/ui`: Primitives de UI personalizados con **Zero Border Radius**.

## ⚖️ Deduplicación

El sistema valida automáticamente por **Email** y **Teléfono** antes de registrar un nuevo candidato, evitando la saturación de datos duplicados y manteniendo la integridad del pipeline.

## 🔐 Seguridad y Auditoría

Cada cambio de estado y creación de perfil queda registrado en la tabla `AuditLog` y `StatusHistory`, permitiendo una trazabilidad completa de las operaciones de reclutamiento.

---
**FOLGA Candidate Hub** - Industrial Strength Recruitment.
