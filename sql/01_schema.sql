-- ============================================================
-- SISTEMA DE GESTIÓN DE INVENTARIO Y COTIZACIONES
-- PYME de Herrajes para Vidrio - Supabase (PostgreSQL)
-- ============================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: categorias
-- ============================================================
CREATE TABLE categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: proveedores
-- ============================================================
CREATE TABLE proveedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(150) NOT NULL,
    contacto VARCHAR(150),
    telefono VARCHAR(20),
    email VARCHAR(150),
    direccion TEXT,
    rfc VARCHAR(20),
    costo_referencia DECIMAL(12,2), -- Solo visible para Admin
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: productos (herrajes)
-- ============================================================
CREATE TABLE productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    unidad_medida VARCHAR(20) NOT NULL DEFAULT 'pieza', -- pieza, kg, metro, par, juego
    categoria_id UUID NOT NULL REFERENCES categorias(id),
    proveedor_id UUID REFERENCES proveedores(id),
    precio_venta DECIMAL(12,2) NOT NULL,
    costo_compra DECIMAL(12,2), -- Solo visible para Admin
    stock_actual INTEGER NOT NULL DEFAULT 0,
    stock_minimo INTEGER NOT NULL DEFAULT 10,
    stock_maximo INTEGER DEFAULT 500,
    ubicacion VARCHAR(100), -- Ej: "Estante A-3, Nivel 2"
    imagen_url TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: movimientos_stock (entradas y salidas)
-- ============================================================
CREATE TABLE movimientos_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_id UUID NOT NULL REFERENCES productos(id),
    tipo_movimiento VARCHAR(10) NOT NULL CHECK (tipo_movimiento IN ('entrada', 'salida')),
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    motivo VARCHAR(200) NOT NULL, -- Compra, Venta, Devolución, Ajuste, etc.
    referencia VARCHAR(100), -- Número de factura, orden de compra, etc.
    usuario_id UUID REFERENCES auth.users(id),
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: clientes
-- ============================================================
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(200) NOT NULL,
    rfc VARCHAR(20),
    telefono VARCHAR(20),
    email VARCHAR(150),
    direccion TEXT,
    ciudad VARCHAR(100),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: cotizaciones
-- ============================================================
CREATE TABLE cotizaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero VARCHAR(30) NOT NULL UNIQUE, -- COT-2026-00001
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    usuario_id UUID NOT NULL REFERENCES auth.users(id),
    fecha_cotizacion DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_vigencia DATE NOT NULL, -- Vigencia de la cotización
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    iva DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
    descuento_monto DECIMAL(12,2) DEFAULT 0,
    notas TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador'
        CHECK (estado IN ('borrador', 'enviada', 'aprobada', 'rechazada', 'vencida')),
    pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: cotizacion_detalles (líneas de la cotización)
-- ============================================================
CREATE TABLE cotizacion_detalles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cotizacion_id UUID NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id),
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(12,2) NOT NULL,
    descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
    subtotal_linea DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: perfil_usuario (datos extendidos del usuario)
-- ============================================================
CREATE TABLE perfil_usuario (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_completo VARCHAR(200) NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'bodega'
        CHECK (rol IN ('admin', 'ventas', 'bodega', 'compras', 'consulta')),
    telefono VARCHAR(20),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES para optimización
-- ============================================================
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_productos_proveedor ON productos(proveedor_id);
CREATE INDEX idx_productos_codigo ON productos(codigo);
CREATE INDEX idx_movimientos_producto ON movimientos_stock(producto_id);
CREATE INDEX idx_movimientos_fecha ON movimientos_stock(created_at);
CREATE INDEX idx_cotizaciones_cliente ON cotizaciones(cliente_id);
CREATE INDEX idx_cotizaciones_estado ON cotizaciones(estado);
CREATE INDEX idx_cotizacion_detalles_cotizacion ON cotizacion_detalles(cotizacion_id);

-- ============================================================
-- TRIGGER: Actualizar stock_actual al insertar movimiento
-- ============================================================
CREATE OR REPLACE FUNCTION fn_actualizar_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tipo_movimiento = 'entrada' THEN
        UPDATE productos
        SET stock_actual = stock_actual + NEW.cantidad,
            updated_at = NOW()
        WHERE id = NEW.producto_id;
    ELSIF NEW.tipo_movimiento = 'salida' THEN
        -- Verificar que haya stock suficiente
        IF (SELECT stock_actual FROM productos WHERE id = NEW.producto_id) < NEW.cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente para el producto. Stock actual: %, cantidad solicitada: %',
                (SELECT stock_actual FROM productos WHERE id = NEW.producto_id),
                NEW.cantidad;
        END IF;

        UPDATE productos
        SET stock_actual = stock_actual - NEW.cantidad,
            updated_at = NOW()
        WHERE id = NEW.producto_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_actualizar_stock
    AFTER INSERT ON movimientos_stock
    FOR EACH ROW
    EXECUTE FUNCTION fn_actualizar_stock();

-- ============================================================
-- TRIGGER: Actualizar totales de cotización
-- ============================================================
CREATE OR REPLACE FUNCTION fn_calcular_totales_cotizacion()
RETURNS TRIGGER AS $$
DECLARE
    v_subtotal DECIMAL(12,2);
    v_descuento_pct DECIMAL(5,2);
    v_descuento_monto DECIMAL(12,2);
    v_iva DECIMAL(12,2);
    v_total DECIMAL(12,2);
    v_cotizacion_id UUID;
BEGIN
    -- Determinar el ID de la cotización afectada
    IF TG_OP = 'DELETE' THEN
        v_cotizacion_id := OLD.cotizacion_id;
    ELSE
        v_cotizacion_id := NEW.cotizacion_id;
    END IF;

    -- Calcular subtotal de todas las líneas
    SELECT COALESCE(SUM(subtotal_linea), 0)
    INTO v_subtotal
    FROM cotizacion_detalles
    WHERE cotizacion_id = v_cotizacion_id;

    -- Obtener descuento de la cotización
    SELECT descuento_porcentaje
    INTO v_descuento_pct
    FROM cotizaciones
    WHERE id = v_cotizacion_id;

    -- Calcular monto de descuento
    v_descuento_monto := v_subtotal * (v_descuento_pct / 100);

    -- Calcular IVA (16% México)
    v_iva := (v_subtotal - v_descuento_monto) * 0.16;

    -- Calcular total
    v_total := (v_subtotal - v_descuento_monto) + v_iva;

    -- Actualizar la cotización
    UPDATE cotizaciones
    SET subtotal = v_subtotal,
        descuento_monto = v_descuento_monto,
        iva = v_iva,
        total = v_total,
        updated_at = NOW()
    WHERE id = v_cotizacion_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calcular_totales_cotizacion
    AFTER INSERT OR UPDATE OR DELETE ON cotizacion_detalles
    FOR EACH ROW
    EXECUTE FUNCTION fn_calcular_totales_cotizacion();

-- ============================================================
-- TRIGGER: Generar número de cotización automático
-- ============================================================
CREATE OR REPLACE FUNCTION fn_generar_numero_cotizacion()
RETURNS TRIGGER AS $$
DECLARE
    v_siguiente INTEGER;
    v_numero VARCHAR(30);
BEGIN
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(numero FROM 11 FOR 5) AS INTEGER)
    ), 0) + 1
    INTO v_siguiente
    FROM cotizaciones
    WHERE numero LIKE 'COT-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-%';

    v_numero := 'COT-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' ||
                LPAD(v_siguiente::TEXT, 5, '0');

    NEW.numero := v_numero;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generar_numero_cotizacion
    BEFORE INSERT ON cotizaciones
    FOR EACH ROW
    WHEN (NEW.numero IS NULL OR NEW.numero = '')
    EXECUTE FUNCTION fn_generar_numero_cotizacion();

-- ============================================================
-- TRIGGER: Actualizar updated_at genérico
-- ============================================================
CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_timestamp_categorias
    BEFORE UPDATE ON categorias
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TRIGGER trg_update_timestamp_proveedores
    BEFORE UPDATE ON proveedores
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TRIGGER trg_update_timestamp_productos
    BEFORE UPDATE ON productos
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TRIGGER trg_update_timestamp_clientes
    BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TRIGGER trg_update_timestamp_cotizaciones
    BEFORE UPDATE ON cotizaciones
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TRIGGER trg_update_timestamp_perfil_usuario
    BEFORE UPDATE ON perfil_usuario
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();
