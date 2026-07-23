# Sistema de Inventario y Cotizaciones - Herrajes

## Arquitectura del Sistema

```
herrajes-inventario/
├── docker-compose.yml          # PostgreSQL + pgAdmin local
├── sql/
│   ├── 01_schema.sql           # Estructura de tablas + triggers
│   ├── 02_seed_data.sql        # Datos de prueba
│   └── 03_rls_policies.sql     # Políticas RLS (para Supabase)
└── java/
    ├── pom.xml
    └── src/main/java/com/herrajes/
        ├── SistemaHerrajesApplication.java
        ├── model/              # Entidades JPA
        ├── repository/         # Repositorios Spring Data
        ├── service/            # Lógica de negocio
        ├── dto/                # Objetos de transferencia
        ├── controller/         # REST Controllers
        └── config/             # Configuración
```

---

## PASO 1: Levantar Base de Datos Local

```bash
# Asegúrate de tener Docker Desktop instalado y corriendo
cd herrajes-inventario
docker-compose up -d
```

Esto levantará:
- **PostgreSQL** en `localhost:5432`
- **pgAdmin** en `http://localhost:5050`

### Credenciales pgAdmin:
- Email: `admin@herrajes.local`
- Password: `Admin2026!`

### Credenciales PostgreSQL:
- Base de datos: `herrajes_inventario`
- Usuario: `herrajes_admin`
- Password: `Herrajes2026!`

---

## PASO 2: Verificar la Base de Datos

1. Abrir pgAdmin en `http://localhost:5050`
2. Conectar al servidor PostgreSQL
3. Verificar que las tablas se crearon:
   - categorias
   - proveedores
   - productos
   - movimientos_stock
   - clientes
   - cotizaciones
   - cotizacion_detalles
   - perfil_usuario

4. Verificar los triggers:
   - `trg_actualizar_stock`
   - `trg_calcular_totales_cotizacion`
   - `trg_generar_numero_cotizacion`

---

## PASO 3: Ejecutar la Aplicación Spring Boot

```bash
cd java
mvn spring-boot:run
```

La aplicación estará disponible en: `http://localhost:8080`

---

## PASO 4: Endpoints de Prueba

### Productos
```http
GET    /api/productos                    # Listar todos
GET    /api/productos/criticos           # Stock crítico
GET    /api/productos/resumen            # Resumen inventario
GET    /api/productos/{id}/criticidad    # Criticidad de un producto
```

### Cotizaciones
```http
POST   /api/cotizaciones                 # Crear cotización
POST   /api/cotizaciones/{id}/pdf        # Generar PDF
POST   /api/cotizaciones/{id}/enviar     # Generar PDF + Enviar email
POST   /api/cotizaciones/{id}/aprobar    # Aprobar cotización
```

### Ejemplo de creación de cotización (JSON):
```json
{
  "clienteId": "uuid-del-cliente",
  "usuarioId": "uuid-del-usuario",
  "descuentoPorcentaje": 5,
  "notas": "Proyecto de oficina",
  "detalles": [
    {
      "productoId": "uuid-del-producto",
      "cantidad": 20,
      "descuentoPorcentaje": 0
    }
  ]
}
```

---

## PASO 5: Migrar a Supabase (Producción)

Cuando estés listo para producción:

1. Crear proyecto en Supabase
2. Ejecutar los scripts SQL en el SQL Editor de Supabase:
   - `01_schema.sql`
   - `02_seed_data.sql`
   - `03_rls_policies.sql`
3. Crear usuarios en Supabase Auth
4. Insertar perfiles en `perfil_usuario`
5. Actualizar `application.properties` con las credenciales de Supabase

---

## Roles del Sistema

| Rol | Permisos |
|-----|----------|
| **Admin** | Todo: productos, proveedores, costos, usuarios, cotizaciones |
| **Ventas** | Cotizaciones, clientes, stock, salidas |
| **Bodega** | Entradas de stock, productos (sin costos) |
| **Compras** | Proveedor, órdenes de compra |
| **Consulta** | Solo lectura de todo |

---

## Stock Crítico - Lógica

| Estado | Condición | Acción |
|--------|-----------|--------|
| **SIN_STOCK** | stock = 0 | Pedido urgente |
| **CRITICO** | stock ≤ 50% del mínimo | Orden de compra |
| **BAJO** | stock ≤ mínimo | Planificar reposición |
| **PRECAUCION** | stock ≤ 150% del mínimo | Monitorear |
| **OK** | stock > 150% del mínimo | Suficiente |
