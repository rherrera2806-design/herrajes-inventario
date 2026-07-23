-- ============================================================
-- ROW LEVEL SECURITY (RLS) - Políticas de Seguridad
-- Sistema de Gestión de Inventario y Cotizaciones
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE perfil_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizacion_detalles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNCIÓN AUXILIAR: Obtener el rol del usuario actual
-- ============================================================
CREATE OR REPLACE FUNCTION fn_get_user_role()
RETURNS TEXT AS $$
    SELECT rol FROM perfil_usuario WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- TABLA: perfil_usuario
-- ============================================================
-- Solo admin puede ver todos los perfiles
CREATE POLICY "Admin ve todos los perfiles"
    ON perfil_usuario FOR SELECT
    TO authenticated
    USING (fn_get_user_role() = 'admin');

-- Cada usuario puede ver su propio perfil
CREATE POLICY "Usuario ve su propio perfil"
    ON perfil_usuario FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Solo admin puede crear/editar perfiles
CREATE POLICY "Admin gestiona perfiles"
    ON perfil_usuario FOR ALL
    TO authenticated
    USING (fn_get_user_role() = 'admin');

-- ============================================================
-- TABLA: categorias
-- ============================================================
-- Todos los usuarios autenticados pueden VER categorías
CREATE POLICY "Todos ven categorías"
    ON categorias FOR SELECT
    TO authenticated
    USING (TRUE);

-- Solo admin y bodega pueden gestionar categorías
CREATE POLICY "Admin y bodega gestionan categorías"
    ON categorias FOR ALL
    TO authenticated
    USING (fn_get_user_role() IN ('admin', 'bodega'));

-- ============================================================
-- TABLA: proveedores
-- ============================================================
-- Admin ve TODO (incluyendo costo_referencia)
CREATE POLICY "Admin ve todos los proveedores"
    ON proveedores FOR SELECT
    TO authenticated
    USING (fn_get_user_role() = 'admin');

-- Ventas, Bodega, Consulta ven proveedores SIN costo
CREATE POLICY "Otros roles ven proveedores sin costo"
    ON proveedores FOR SELECT
    TO authenticated
    USING (fn_get_user_role() IN ('ventas', 'bodega', 'consulta', 'compras'));

-- Solo admin y compras pueden gestionar proveedores
CREATE POLICY "Admin y compras gestionan proveedores"
    ON proveedores FOR ALL
    TO authenticated
    USING (fn_get_user_role() IN ('admin', 'compras'));

-- ============================================================
-- TABLA: productos
-- ============================================================
-- Todos los usuarios autenticados pueden VER productos
-- Pero el costo_compra solo se expone en la vista de admin
CREATE POLICY "Todos ven productos"
    ON productos FOR SELECT
    TO authenticated
    USING (TRUE);

-- Admin puede hacer todo con productos
CREATE POLICY "Admin gestiona productos"
    ON productos FOR ALL
    TO authenticated
    USING (fn_get_user_role() = 'admin');

-- Bodega puede gestionar stock (no precios de compra)
CREATE POLICY "Bodega gestiona productos"
    ON productos FOR INSERT, UPDATE
    TO authenticated
    USING (fn_get_user_role() = 'bodega');

-- Ventas puede ver pero no modificar precios de compra
CREATE POLICY "Ventas actualiza productos limitado"
    ON productos FOR UPDATE
    TO authenticated
    USING (fn_get_user_role() = 'ventas')
    WITH CHECK (fn_get_user_role() = 'ventas');

-- ============================================================
-- TABLA: movimientos_stock
-- ============================================================
-- Todos pueden VER movimientos (historial)
CREATE POLICY "Todos ven movimientos"
    ON movimientos_stock FOR SELECT
    TO authenticated
    USING (TRUE);

-- Bodega puede registrar ENTRADAS
CREATE POLICY "Bodega registra entradas"
    ON movimientos_stock FOR INSERT
    TO authenticated
    WITH CHECK (
        fn_get_user_role() IN ('admin', 'bodega')
        AND tipo_movimiento = 'entrada'
    );

-- Ventas puede registrar SALIDAS
CREATE POLICY "Ventas registra salidas"
    ON movimientos_stock FOR INSERT
    TO authenticated
    WITH CHECK (
        fn_get_user_role() IN ('admin', 'ventas')
        AND tipo_movimiento = 'salida'
    );

-- Admin puede ambos
CREATE POLICY "Admin gestiona todos los movimientos"
    ON movimientos_stock FOR ALL
    TO authenticated
    USING (fn_get_user_role() = 'admin');

-- Nadie puede eliminar movimientos (traza de auditoría)
CREATE POLICY "No se eliminan movimientos"
    ON movimientos_stock FOR DELETE
    TO authenticated
    USING (FALSE);

-- ============================================================
-- TABLA: clientes
-- ============================================================
-- Todos los usuarios autenticados pueden VER clientes
CREATE POLICY "Todos ven clientes"
    ON clientes FOR SELECT
    TO authenticated
    USING (TRUE);

-- Ventas y admin pueden gestionar clientes
CREATE POLICY "Ventas y admin gestionan clientes"
    ON clientes FOR ALL
    TO authenticated
    USING (fn_get_user_role() IN ('admin', 'ventas'));

-- ============================================================
-- TABLA: cotizaciones
-- ============================================================
-- Ventas ve todas las cotizaciones
CREATE POLICY "Ventas ve cotizaciones"
    ON cotizaciones FOR SELECT
    TO authenticated
    USING (fn_get_user_role() IN ('admin', 'ventas', 'consulta'));

-- Bodega solo ve cotizaciones aprobadas (para preparar envíos)
CREATE POLICY "Bodega ve cotizaciones aprobadas"
    ON cotizaciones FOR SELECT
    TO authenticated
    USING (
        fn_get_user_role() = 'bodega'
        AND estado = 'aprobada'
    );

-- Solo ventas y admin pueden crear/modificar cotizaciones
CREATE POLICY "Ventas y admin gestionan cotizaciones"
    ON cotizaciones FOR ALL
    TO authenticated
    USING (fn_get_user_role() IN ('admin', 'ventas'));

-- ============================================================
-- TABLA: cotizacion_detalles
-- ============================================================
-- Seguir permisos de la cotización padre
CREATE POLICY "Detalles siguen permisos de cotización"
    ON cotizacion_detalles FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM cotizaciones c
            WHERE c.id = cotizacion_detalles.cotizacion_id
            AND (
                fn_get_user_role() IN ('admin', 'ventas', 'consulta')
                OR (fn_get_user_role() = 'bodega' AND c.estado = 'aprobada')
            )
        )
    );

CREATE POLICY "Ventas y admin gestionan detalles"
    ON cotizacion_detalles FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM cotizaciones c
            WHERE c.id = cotizacion_detalles.cotizacion_id
            AND fn_get_user_role() IN ('admin', 'ventas')
        )
    );

-- ============================================================
-- VISTA: Productos con campos sensibles ocultos
-- Para usuarios no-admin, ocultar costo_compra
-- ============================================================
CREATE OR REPLACE VIEW v_productos_publico AS
SELECT
    p.id,
    p.codigo,
    p.nombre,
    p.descripcion,
    p.unidad_medida,
    p.categoria_id,
    c.nombre AS categoria_nombre,
    p.proveedor_id,
    pr.nombre AS proveedor_nombre,
    p.precio_venta,
    p.stock_actual,
    p.stock_minimo,
    p.stock_maximo,
    p.ubicacion,
    p.activo,
    p.created_at,
    p.updated_at
FROM productos p
LEFT JOIN categorias c ON c.id = p.categoria_id
LEFT JOIN proveedores pr ON pr.id = p.proveedor_id;

-- ============================================================
-- VISTA: Reporte de stock crítico
-- ============================================================
CREATE OR REPLACE VIEW v_stock_critico AS
SELECT
    p.id,
    p.codigo,
    p.nombre,
    c.nombre AS categoria,
    pr.nombre AS proveedor,
    p.stock_actual,
    p.stock_minimo,
    p.stock_maximo,
    CASE
        WHEN p.stock_actual = 0 THEN 'SIN_STOCK'
        WHEN p.stock_actual <= p.stock_minimo THEN 'CRITICO'
        WHEN p.stock_actual <= (p.stock_minimo * 1.5) THEN 'BAJO'
        ELSE 'OK'
    END AS estado_stock,
    ROUND(((p.stock_minimo - p.stock_actual)::DECIMAL / NULLIF(p.stock_minimo, 0)) * 100, 1) AS porcentaje_faltante,
    p.precio_venta,
    p.costo_compra,
    CASE
        WHEN p.costo_compra IS NOT NULL
        THEN ROUND(p.stock_actual * p.costo_compra, 2)
        ELSE NULL
    END AS valor_inventario_costo,
    ROUND(p.stock_actual * p.precio_venta, 2) AS valor_inventario_venta
FROM productos p
LEFT JOIN categorias c ON c.id = p.categoria_id
LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
WHERE p.activo = TRUE
    AND p.stock_actual <= p.stock_minimo
ORDER BY
    CASE
        WHEN p.stock_actual = 0 THEN 0
        ELSE 1
    END,
    p.stock_actual ASC;
