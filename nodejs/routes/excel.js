const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../db/connection');

// Configurar multer para subir archivos
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/octet-stream'
        ];
        const allowedExts = ['.xlsx', '.xls'];
        const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

        if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'), false);
        }
    }
});

// POST /api/productos/excel - Carga masiva desde Excel
router.post('/excel', upload.single('archivo'), async (req, res) => {
    const client = await db.getClient();
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se envió archivo' });
        }

        // Leer el archivo Excel
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const datos = XLSX.utils.sheet_to_json(sheet);

        if (datos.length === 0) {
            return res.status(400).json({ error: 'El archivo está vacío' });
        }

        await client.query('BEGIN');

        let creados = 0;
        let errores = [];

        for (let i = 0; i < datos.length; i++) {
            const fila = datos[i];
            try {
                // Mapear columnas del Excel a la BD
                const codigo = fila['CODIGO'] || fila['codigo'] || fila['Código'];
                const nombre = fila['NOMBRE'] || fila['nombre'] || fila['Producto'];
                const descripcion = fila['DESCRIPCION'] || fila['descripcion'] || '';
                const unidad = fila['UNIDAD'] || fila['unidad'] || 'pieza';
                const categoria = fila['CATEGORIA'] || fila['categoria'] || '';
                const proveedor = fila['PROVEEDOR'] || fila['proveedor'] || '';
                const precioVenta = fila['PRECIO_VENTA'] || fila['precio_venta'] || fila['Precio'] || 0;
                const costoCompra = fila['COSTO_COMPRA'] || fila['costo_compra'] || null;
                const stockInicial = fila['STOCK'] || fila['stock'] || 0;
                const stockMinimo = fila['STOCK_MINIMO'] || fila['stock_minimo'] || 10;
                const ubicacion = fila['UBICACION'] || fila['ubicacion'] || '';

                if (!codigo || !nombre) {
                    errores.push(`Fila ${i + 2}: Falta código o nombre`);
                    continue;
                }

                // Buscar categoría por nombre
                let categoriaId = null;
                if (categoria) {
                    const catResult = await client.query('SELECT id FROM categorias WHERE nombre ILIKE $1', [categoria]);
                    if (catResult.rows.length > 0) {
                        categoriaId = catResult.rows[0].id;
                    }
                }

                // Buscar proveedor por nombre
                let proveedorId = null;
                if (proveedor) {
                    const provResult = await client.query('SELECT id FROM proveedores WHERE nombre ILIKE $1', [proveedor]);
                    if (provResult.rows.length > 0) {
                        proveedorId = provResult.rows[0].id;
                    }
                }

                // Verificar si ya existe el código
                const existe = await client.query('SELECT id FROM productos WHERE codigo = $1', [codigo]);
                if (existe.rows.length > 0) {
                    errores.push(`Fila ${i + 2}: Ya existe el código ${codigo}`);
                    continue;
                }

                // Insertar producto
                await client.query(`
                    INSERT INTO productos (codigo, nombre, descripcion, unidad_medida, categoria_id,
                        proveedor_id, precio_venta, costo_compra, stock_actual, stock_minimo, ubicacion)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [codigo, nombre, descripcion, unidad, categoriaId, proveedorId,
                    precioVenta, costoCompra, stockInicial, stockMinimo, ubicacion]);

                creados++;
            } catch (err) {
                errores.push(`Fila ${i + 2}: ${err.message}`);
            }
        }

        await client.query('COMMIT');

        res.json({
            message: `Carga completa: ${creados} productos creados`,
            creados,
            errores: errores.length > 0 ? errores : null
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
});

// GET /api/productos/excel/plantilla - Descargar plantilla Excel
router.get('/excel/plantilla', (req, res) => {
    const plantilla = [
        {
            'CODIGO': 'BIS-003',
            'NOMBRE': 'Bisagra Ejemplo',
            'DESCRIPCION': 'Descripción del producto',
            'UNIDAD': 'pieza',
            'CATEGORIA': 'Bisagras',
            'PROVEEDOR': 'Aceros del Norte',
            'PRECIO_VENTA': 100,
            'COSTO_COMPRA': 50,
            'STOCK': 50,
            'STOCK_MINIMO': 10,
            'UBICACION': 'Estante A-1'
        }
    ];

    const ws = XLSX.utils.json_to_sheet(plantilla);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=plantilla_productos.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
});

// POST /api/clientes/excel - Carga masiva de clientes desde Excel
router.post('/clientes/excel', upload.single('archivo'), async (req, res) => {
    const client = await db.getClient();
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se envió archivo' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const datos = XLSX.utils.sheet_to_json(sheet);

        if (datos.length === 0) {
            return res.status(400).json({ error: 'El archivo está vacío' });
        }

        await client.query('BEGIN');

        let creados = 0;
        let errores = [];

        for (let i = 0; i < datos.length; i++) {
            const fila = datos[i];
            try {
                const nombre = fila['NOMBRE'] || fila['nombre'] || fila['Nombre'];
                const rfc = fila['RFC'] || fila['rfc'] || '';
                const telefono = fila['TELEFONO'] || fila['telefono'] || fila['Teléfono'] || '';
                const email = fila['EMAIL'] || fila['email'] || fila['Correo'] || '';
                const direccion = fila['DIRECCION'] || fila['direccion'] || fila['Dirección'] || '';
                const ciudad = fila['CIUDAD'] || fila['ciudad'] || '';

                if (!nombre) {
                    errores.push(`Fila ${i + 2}: Falta el nombre del cliente`);
                    continue;
                }

                await client.query(`
                    INSERT INTO clientes (nombre, rfc, telefono, email, direccion, ciudad)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [nombre, rfc, telefono, email, direccion, ciudad]);

                creados++;
            } catch (err) {
                errores.push(`Fila ${i + 2}: ${err.message}`);
            }
        }

        await client.query('COMMIT');

        res.json({
            message: `Carga completa: ${creados} clientes creados`,
            creados,
            errores: errores.length > 0 ? errores : null
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
});

// GET /api/clientes/excel/plantilla - Descargar plantilla Excel de clientes
router.get('/clientes/excel/plantilla', (req, res) => {
    const plantilla = [
        {
            'NOMBRE': 'Cliente Ejemplo',
            'RFC': 'RFC123456789',
            'TELEFONO': '81-1234-5678',
            'EMAIL': 'correo@ejemplo.com',
            'DIRECCION': 'Calle Ejemplo 123',
            'CIUDAD': 'Monterrey'
        }
    ];

    const ws = XLSX.utils.json_to_sheet(plantilla);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=plantilla_clientes.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
});

module.exports = router;
