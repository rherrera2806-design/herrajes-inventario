-- ============================================================
-- DATOS INICIALES - SEMILLA DE PRUEBA
-- ============================================================

-- Categorías
INSERT INTO categorias (nombre, descripcion) VALUES
('Bisagras', 'Bisagras para puertas de vidrio templado'),
('Tornillos', 'Tornillos de acero inoxidable y zinc'),
('Correderas', 'Correderas para puertas corredizas'),
('Juntas y Sellos', 'Juntas de goma y sellos para vidrio'),
('Cierres', 'Cierres magnéticos y mecánicos'),
('Perillas y Manijas', 'Perillas, manijas y pomos decorativos'),
('Rieles', 'Rieles de aluminio y acero inoxidable'),
('Herramientas', 'Herramientas para instalación de vidrio');

-- Proedores (costos ocultos para RLS)
INSERT INTO proveedores (nombre, contacto, telefono, email, rfc, costo_referencia) VALUES
('Aceros del Norte', 'Juan Pérez', '81-1234-5678', 'ventas@acerosnorte.com', 'ADN950101AB3', 45000.00),
('Vidrios y Accesorios SA', 'María López', '81-2345-6789', 'contacto@vidriosacc.com', 'VYA080515QR2', 82000.00),
('Herrajes Industriales', 'Carlos Ruiz', '81-3456-7890', 'pedidos@herrajesind.com', 'HIN030320TY4', 125000.00),
('Distribuidora de Vidrio', 'Ana García', '81-4567-8901', 'ventas@distvidrio.com', 'DVI120610ML5', 67000.00),
('Ferretera Industrial', 'Roberto Sánchez', '81-5678-9012', 'info@ferreterai.com', 'FEI070901BN8', 34000.00);

-- Productos de ejemplo
INSERT INTO productos (codigo, nombre, descripcion, unidad_medida, categoria_id, proveedor_id, precio_venta, costo_compra, stock_actual, stock_minimo, stock_maximo, ubicacion) VALUES
('BIS-001', 'Bisagra T para puerta 10mm', 'Bisagra T de acero inoxidable para vidrio 10mm', 'pieza', (SELECT id FROM categorias WHERE nombre = 'Bisagras'), (SELECT id FROM proveedores WHERE nombre = 'Aceros del Norte'), 85.00, 42.50, 150, 30, 500, 'Estante A-1'),
('BIS-002', 'Bisagra para puerta 12mm', 'Bisagra plana de acero cromado para vidrio 12mm', 'pieza', (SELECT id FROM categorias WHERE nombre = 'Bisagras'), (SELECT id FROM proveedores WHERE nombre = 'Aceros del Norte'), 95.00, 48.00, 8, 20, 400, 'Estante A-2'),
('TOR-001', 'Tornillo hexagonal M8x30', 'Tornillo de acero inoxidable M8 x 30mm', 'pieza', (SELECT id FROM categorias WHERE nombre = 'Tornillos'), (SELECT id FROM proveedores WHERE nombre = 'Ferretera Industrial'), 3.50, 1.20, 2000, 500, 5000, 'Cajón B-1'),
('TOR-002', 'Tornillo autorroscante #10x1"', 'Tornillo zinc para perfilería', 'pieza', (SELECT id FROM categorias WHERE nombre = 'Tornillos'), (SELECT id FROM proveedores WHERE nombre = 'Ferretera Industrial'), 2.80, 0.90, 45, 200, 5000, 'Cajón B-2'),
('COR-001', 'Corredera inferior 120cm', 'Corredera de rodillos para puerta corrediza', 'pieza', (SELECT id FROM categorias WHERE nombre = 'Correderas'), (SELECT id FROM proveedores WHERE nombre = 'Vidrios y Accesorios SA'), 320.00, 165.00, 25, 10, 100, 'Estante C-1'),
('COR-002', 'Corredera superior 120cm', 'Riel superior para puerta corrediza', 'pieza', (SELECT id FROM categorias WHERE nombre = 'Correderas'), (SELECT id FROM proveedores WHERE nombre = 'Vidrios y Accesorios SA'), 280.00, 140.00, 3, 8, 100, 'Estante C-2'),
('JUN-001', 'Junta T de neopreno 10mm', 'Junta en T para unión de vidrios', 'metro', (SELECT id FROM categorias WHERE nombre = 'Juntas y Sellos'), (SELECT id FROM proveedores WHERE nombre = 'Distribuidora de Vidrio'), 25.00, 8.50, 300, 100, 1000, 'Estante D-1'),
('CIE-001', 'Cierre magnético 180kg', 'Cierre magnético para puertas de vidrio', 'pieza', (SELECT id FROM categorias WHERE nombre = 'Cierres'), (SELECT id FROM proveedores WHERE nombre = 'Herrajes Industriales'), 450.00, 225.00, 12, 5, 50, 'Estante E-1'),
('PER-001', 'Perilla cristal 30mm', 'Perilla de cristal esmerilado para puerta', 'pieza', (SELECT id FROM categorias WHERE nombre = 'Perillas y Manijas'), (SELECT id FROM proveedores WHERE nombre = 'Vidrios y Accesorios SA'), 120.00, 55.00, 60, 15, 200, 'Estante F-1'),
('RIE-001', 'Riel aluminio 3m', 'Riel de aluminio anodizado para ducha', 'pieza', (SELECT id FROM categorias WHERE nombre = 'Rieles'), (SELECT id FROM proveedores WHERE nombre = 'Herrajes Industriales'), 180.00, 90.00, 2, 10, 80, 'Estante G-1');

-- Clientes de ejemplo
INSERT INTO clientes (nombre, rfc, telefono, email, direccion, ciudad) VALUES
('Vidriería El Claro', 'VEC980101AB1', '81-1111-2222', 'contacto@elclaro.com', 'Av. Constitución 1500', 'Monterrey'),
('Constructora Edifica', 'CE050505CD3', '81-3333-4444', 'compras@edifica.com', 'Blvd. Díaz Ordaz 2000', 'Guadalupe'),
('Mueblería Moderna', 'MM100101EF5', '81-5555-6666', 'ventas@muebleriamoderna.com', 'Calle Morelos 800', 'San Nicolás'),
('Distribuidora Cristal', 'DC070707GH7', '81-7777-8888', 'pedidos@cristaldist.com', 'Av. Garza Sada 3000', 'Monterrey'),
('Ingeniería en Acero', 'IEA121212IJ9', '81-9999-0000', 'info@ingenieriaacero.com', 'Calle Madero 500', 'Apodaca');

-- Movimientos de ejemplo
INSERT INTO movimientos_stock (producto_id, tipo_movimiento, cantidad, motivo, referencia, notas) VALUES
((SELECT id FROM productos WHERE codigo = 'BIS-001'), 'entrada', 100, 'Compra a proveedor', 'OC-2026-001', 'Pedido semanal'),
((SELECT id FROM productos WHERE codigo = 'BIS-001'), 'salida', 15, 'Venta', 'VTA-2026-010', 'Proyecto vidriería'),
((SELECT id FROM productos WHERE codigo = 'BIS-002'), 'salida', 12, 'Venta', 'VTA-2026-011', 'Dejó stock bajo'),
((SELECT id FROM productos WHERE codigo = 'TOR-001'), 'entrada', 1500, 'Compra mayoreo', 'OC-2026-002', ''),
((SELECT id FROM productos WHERE codigo = 'COR-001'), 'salida', 5, 'Venta', 'VTA-2026-012', 'Proyecto oficinas');

-- ============================================================
-- ROLES DE USUARIO PARA PRUEBA (5 usuarios)
-- NOTA: Estos usuarios deben crearse primero en auth.users
-- de Supabase, luego insertar en perfil_usuario.
-- Para desarrollo local, se puede insertar directamente.
-- ============================================================

-- Ejemplo de inserción de usuarios de prueba:
-- Primero crear los usuarios en Supabase Auth, luego:
-- INSERT INTO perfil_usuario (user_id, nombre_completo, rol, telefono) VALUES
-- ('uuid-usuario-1', 'Admin Sistema', 'admin', '81-1000-0001'),
-- ('uuid-usuario-2', 'Ventas Ejecutivo', 'ventas', '81-1000-0002'),
-- ('uuid-usuario-3', 'Bodega Almacén', 'bodega', '81-1000-0003'),
-- ('uuid-usuario-4', 'Compras Proveedor', 'compras', '81-1000-0004'),
-- ('uuid-usuario-5', 'Consulta Reportes', 'consulta', '81-1000-0005');
