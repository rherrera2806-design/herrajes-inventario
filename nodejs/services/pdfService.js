const PDFDocument = require('pdfkit');

async function generarPdfCotizacion(cotizacion, detalles) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const doc = new PDFDocument({
            size: 'LETTER',
            margins: { top: 50, bottom: 50, left: 50, right: 50 },
            bufferPages: true
        });

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // === ENCABEZADO ===
        doc.fontSize(22).fillColor('#1a237e').text('SISTEMA DE HERRAJES', 50, 50);
        doc.fontSize(10).fillColor('#666').text('Gestión de Inventario y Cotizaciones', 50, 78);
        doc.fontSize(8).fillColor('#999').text('RFC: HRJ200101AB3 | Tel: 81-1000-0000', 50, 92);

        // Cuadro de cotización
        doc.rect(420, 50, 160, 80).fill('#1a237e');
        doc.fontSize(14).fillColor('#fff').text('COTIZACIÓN', 420, 60, { width: 160, align: 'center' });
        doc.fontSize(18).fillColor('#ffeb3b').text(cotizacion.numero, 420, 80, { width: 160, align: 'center' });
        doc.fontSize(9).fillColor('#fff')
            .text(`Fecha: ${formatDate(cotizacion.fecha_cotizacion)}`, 420, 108, { width: 160, align: 'center' })
            .text(`Vigencia: ${formatDate(cotizacion.fecha_vigencia)}`, 420, 120, { width: 160, align: 'center' });

        // Línea separadora
        doc.moveTo(50, 140).lineTo(560, 140).strokeColor('#1a237e').lineWidth(1).stroke();

        // === DATOS DEL CLIENTE ===
        doc.fontSize(11).fillColor('#1a237e').text('DATOS DEL CLIENTE', 50, 155);
        doc.fontSize(9).fillColor('#333');
        doc.text(`Cliente: ${cotizacion.cliente_nombre || 'N/A'}`, 50, 175);
        doc.text(`RFC: ${cotizacion.cliente_rfc || 'N/A'}`, 50, 190);
        doc.text(`Teléfono: ${cotizacion.cliente_telefono || 'N/A'}`, 50, 205);
        doc.text(`Email: ${cotizacion.cliente_email || 'N/A'}`, 250, 175);
        doc.text(`Ciudad: ${cotizacion.cliente_ciudad || 'N/A'}`, 250, 190);
        doc.text(`Dirección: ${cotizacion.cliente_direccion || 'N/A'}`, 250, 205);

        // === TABLA DE DETALLES ===
        let y = 235;
        doc.fontSize(11).fillColor('#1a237e').text('DETALLE DE LA COTIZACIÓN', 50, y);
        y += 20;

        const headers = ['#', 'Descripción', 'Cant.', 'P. Unitario', 'Desc.', 'Subtotal'];
        const colX = [50, 80, 320, 370, 440, 500];
        const colW = [30, 240, 50, 70, 60, 60];

        doc.rect(50, y, 510, 20).fill('#1a237e');
        doc.fontSize(8).fillColor('#fff');
        headers.forEach((h, i) => {
            doc.text(h, colX[i], y + 5, { width: colW[i], align: i === 1 ? 'left' : 'center' });
        });
        y += 20;

        let numFila = 1;
        for (const d of detalles) {
            const bgColor = numFila % 2 === 0 ? '#f5f5f5' : '#fff';
            doc.rect(50, y, 510, 18).fill(bgColor);
            doc.fontSize(8).fillColor('#333');

            doc.text(numFila.toString(), colX[0], y + 4, { width: colW[0], align: 'center' });
            doc.text(d.producto_nombre, colX[1], y + 4, { width: colW[1] });
            doc.text(d.cantidad.toString(), colX[2], y + 4, { width: colW[2], align: 'center' });
            doc.text(`$${formatMoney(d.precio_unitario)}`, colX[3], y + 4, { width: colW[3], align: 'right' });
            doc.text(`${d.descuento_porcentaje}%`, colX[4], y + 4, { width: colW[4], align: 'center' });
            doc.fontSize(8).fillColor('#1a237e')
                .text(`$${formatMoney(d.subtotal_linea)}`, colX[5], y + 4, { width: colW[5], align: 'right' });

            y += 18;
            numFila++;
        }

        // === TOTALES ===
        y += 10;
        const totalesX = 400;
        const totalesW = 160;

        doc.fontSize(9).fillColor('#333');
        doc.text('Subtotal:', totalesX, y, { width: 80, align: 'right' });
        doc.text(`$${formatMoney(cotizacion.subtotal)}`, totalesX + 80, y, { width: 80, align: 'right' });
        y += 15;

        if (cotizacion.descuento_porcentaje > 0) {
            doc.text(`Descuento (${cotizacion.descuento_porcentaje}%):`, totalesX, y, { width: 80, align: 'right' });
            doc.text(`-$${formatMoney(cotizacion.descuento_monto)}`, totalesX + 80, y, { width: 80, align: 'right' });
            y += 15;
        }

        doc.text('IVA (16%):', totalesX, y, { width: 80, align: 'right' });
        doc.text(`$${formatMoney(cotizacion.iva)}`, totalesX + 80, y, { width: 80, align: 'right' });
        y += 20;

        doc.rect(totalesX, y, totalesW, 25).fill('#1a237e');
        doc.fontSize(12).fillColor('#fff');
        doc.text('TOTAL:', totalesX + 5, y + 5, { width: 80, align: 'right' });
        doc.text(`$${formatMoney(cotizacion.total)}`, totalesX + 85, y + 5, { width: 70, align: 'right' });

        // === NOTAS ===
        y += 45;
        doc.fontSize(10).fillColor('#1a237e').text('NOTAS Y CONDICIONES', 50, y);
        y += 15;
        doc.fontSize(8).fillColor('#666');
        doc.text('• Esta cotización tiene una vigencia de 30 días.', 50, y);
        doc.text('• Los precios incluyen IVA.', 50, y + 12);
        doc.text('• Tiempo de entrega: 3-5 días hábiles.', 50, y + 24);
        doc.text('• Forma de pago: Contado / Transferencia bancaria.', 50, y + 36);

        // === PIE DE PÁGINA ===
        doc.fontSize(7).fillColor('#999')
            .text('Sistema de Gestión de Inventario y Cotizaciones | Herrajes para Vidrio', 50, 720, { width: 510, align: 'center' })
            .text(`Generado el ${new Date().toLocaleDateString('es-MX')}`, 50, 732, { width: 510, align: 'center' });

        doc.end();
    });
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX');
}

function formatMoney(value) {
    const num = Math.round(parseFloat(value) || 0);
    return num.toLocaleString('es-MX');
}

module.exports = { generarPdfCotizacion };
