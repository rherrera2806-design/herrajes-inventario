const nodemailer = require('nodemailer');

// Configurar transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

async function enviarCotizacionEmail(emailDestino, cotizacion, pdfBuffer) {
    try {
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #1a237e; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">Sistema de Herrajes</h1>
                <p style="margin: 5px 0 0 0; font-size: 12px;">Gestión de Inventario y Cotizaciones</p>
            </div>
            <div style="padding: 20px; border: 1px solid #ddd; background: #fafafa;">
                <h2 style="color: #1a237e;">Cotización: ${cotizacion.numero}</h2>
                <p>Estimado/a <strong>${cotizacion.cliente_nombre}</strong>,</p>
                <p>Adjunto encontrará el archivo PDF con el detalle de su cotización.</p>
                <p><strong>Total: $${cotizacion.total}</strong></p>
                <p>Si tiene alguna duda o comentario, no dude en contactarnos.</p>
                <hr style="margin: 20px 0; border-color: #eee;">
                <p style="color: #999; font-size: 11px;">
                    Este es un correo automático generado por el Sistema de Gestión de Inventario.
                </p>
            </div>
        </body>
        </html>
        `;

        const mailOptions = {
            from: '"Sistema Herrajes" <noreply@herrajes.local>',
            to: emailDestino,
            subject: `Cotización ${cotizacion.numero} - Herrajes`,
            html: htmlContent,
            attachments: pdfBuffer ? [{
                filename: `${cotizacion.numero}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }] : []
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email enviado:', info.messageId);
        return info;
    } catch (error) {
        console.error('Error al enviar email:', error.message);
        // No lanzar error para que no bloquee la generación del PDF
    }
}

async function enviarAlertaStockCritico(alertas) {
    try {
        let htmlTable = `
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
            <tr style="background-color: #f44336; color: white;">
                <th>Código</th><th>Producto</th><th>Stock</th><th>Mínimo</th>
                <th>Faltante</th><th>Nivel</th><th>Proveedor</th>
            </tr>`;

        for (const a of alertas) {
            const bgColor = a.nivel_alerta === 'SIN_STOCK' ? '#ffebee' :
                           a.nivel_alerta === 'CRITICO' ? '#fff3e0' : '#fffde7';
            htmlTable += `
            <tr style="background-color: ${bgColor};">
                <td><strong>${a.codigo}</strong></td>
                <td>${a.nombre}</td>
                <td>${a.stock_actual}</td>
                <td>${a.stock_minimo}</td>
                <td><strong>${a.cantidad_comprar}</strong></td>
                <td><strong>${a.nivel_alerta}</strong></td>
                <td>${a.proveedor || 'N/A'}</td>
            </tr>`;
        }
        htmlTable += '</table>';

        const html = `
        <html><body style="font-family: Arial, sans-serif;">
            <h2 style="color: #d32f2f;">Alerta de Stock Crítico - Herrajes</h2>
            <p>Se han detectado ${alertas.length} productos con stock bajo el mínimo:</p>
            ${htmlTable}
            <br/>
            <p><em>Correo automático del Sistema de Gestión de Inventario.</em></p>
        </body></html>`;

        const mailOptions = {
            from: '"Sistema Herrajes" <noreply@herrajes.local>',
            to: 'compras@herrajes.local, admin@herrajes.local',
            subject: `Alerta Stock Crítico - ${alertas.length} productos`,
            html
        };

        await transporter.sendMail(mailOptions);
        console.log('Alerta de stock crítico enviada');
    } catch (error) {
        console.error('Error al enviar alerta:', error.message);
    }
}

module.exports = { enviarCotizacionEmail, enviarAlertaStockCritico };
