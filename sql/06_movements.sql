INSERT INTO movimientos_stock (producto_id, tipo_movimiento, cantidad, motivo, referencia, notas) VALUES
((SELECT id FROM productos WHERE codigo = 'BIS-001'), 'salida', 15, 'Venta', 'VTA-2026-010', 'Proyecto vidriera');

INSERT INTO movimientos_stock (producto_id, tipo_movimiento, cantidad, motivo, referencia, notas) VALUES
((SELECT id FROM productos WHERE codigo = 'TOR-001'), 'entrada', 1500, 'Compra mayoreo', 'OC-2026-002', '');

INSERT INTO movimientos_stock (producto_id, tipo_movimiento, cantidad, motivo, referencia, notas) VALUES
((SELECT id FROM productos WHERE codigo = 'COR-001'), 'salida', 5, 'Venta', 'VTA-2026-012', 'Proyecto oficinas');
