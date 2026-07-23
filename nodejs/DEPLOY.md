# Guía de Despliegue - Sistema de Herrajes

## Opción 1: Supabase + Render (Recomendado - Gratis)

### Paso 1: Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) → Crear cuenta gratis
2. Crear nuevo proyecto
3. Ir a **Settings** → **Database** → **Connection string** → **URI**
4. Copiar la connection string (se ve así):
   ```
   postgresql://postgres:[TU-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
   ```
5. Ir al **SQL Editor** y ejecutar:
   - `sql/01_schema.sql` (estructura de tablas)
   - `sql/02_seed_data.sql` (datos de prueba, opcional)

### Paso 2: Desplegar en Render

1. Ir a [render.com](https://render.com) → Crear cuenta gratis
2. Conectar tu repositorio de GitHub (o subir el código)
3. Crear **New Web Service**
4. Configurar:
   - **Build Command**: `cd nodejs && npm install`
   - **Start Command**: `cd nodejs && node server.js`
   - **Environment Variables**:
     ```
     DATABASE_URL = [tu connection string de Supabase]
     SESSION_SECRET = [un secreto aleatorio largo]
     NODE_ENV = production
     ```
5. Click **Create Web Service**

### Paso 3: Verificar

1. Esperar a que Render termine el deploy (2-3 minutos)
2. Abrir la URL que Render te da (ej: `https://herrajes-xxx.onrender.com`)
3. Login con: `admin@herrajes.local` / `admin123`

---

## Opción 2: Railway (Alternativa - $5 gratis/mes)

1. Ir a [railway.app](https://railway.app)
2. Crear proyecto → Agregar PostgreSQL
3. Agregar servicio Node.js
4. Configurar variables de entorno
5. Deploy automático

---

## Opción 3: Local con Docker

```bash
# En la carpeta raíz del proyecto
docker-compose up -d

# El sistema estará en http://localhost:3000
```

---

## Variables de Entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://postgres:pass@host:5432/db` |
| `SESSION_SECRET` | Secreto para sesiones (aleatorio) | `mi-secreto-super-largo-123` |
| `SMTP_HOST` | Servidor SMTP (opcional) | `smtp.gmail.com` |
| `SMTP_USER` | Usuario SMTP (opcional) | `tu@gmail.com` |
| `SMTP_PASS` | Contraseña SMTP (opcional) | `app-password` |
| `PORT` | Puerto del servidor | `3000` (Render lo asigna) |
| `NODE_ENV` | Entorno | `production` |

---

## Notas Importantes

### Render Free Tier
- El servicio **duerme después de 15 minutos** sin tráfico
- Al despertar tarda **30-60 segundos**
- Solución: Usar [UptimeRobot](https://uptimerobot.com) para hacer ping cada 5 minutos

### Supabase Free Tier
- 500 MB de almacenamiento
- 50,000 usuarios activos/mes
- 500 MB de transferencia
- Suficiente para uso normal de la PYME

### PDFs
- Se generan en memoria (no se guardan en disco)
- Se envían directo al navegador o como adjunto de email
- No necesitas almacenamiento adicional

### Sesiones
- Se guardan en PostgreSQL (tabla `user_sessions`)
- Persisten entre reinicios del servidor
- Duración: 24 horas

---

## Credenciales por Defecto

| Email | Contraseña | Rol |
|-------|------------|-----|
| admin@herrajes.local | admin123 | admin |
| ventas@herrajes.local | ventas123 | ventas |
| bodega@herrajes.local | bodega123 | bodega |
| compras@herrajes.local | compras123 | compras |
| consulta@herrajes.local | consulta123 | consulta |

**⚠️ Cambiar estas contraseñas en producción**
