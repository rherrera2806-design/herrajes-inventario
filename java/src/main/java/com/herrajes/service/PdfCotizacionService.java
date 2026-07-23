package com.herrajes.service;

import com.herrajes.model.Cotizacion;
import com.herrajes.model.CotizacionDetalle;
import com.herrajes.model.Cliente;
import com.itextpdf.io.font.PdfEncodings;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.kernel.pdf.canvas.draw.SolidLine;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.Border;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.*;
import com.itextpdf.layout.properties.HorizontalAlignment;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileNotFoundException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

// ============================================================
// SERVICIO: Generación de PDF para Cotizaciones (iText 7)
// ============================================================
@Service
public class PdfCotizacionService {

    private static final Logger log = LoggerFactory.getLogger(PdfCotizacionService.class);

    // Colores corporativos
    private static final DeviceRgb COLOR_PRIMARIO = new DeviceRgb(26, 35, 126);    // Azul oscuro
    private static final DeviceRgb COLOR_SECUNDARIO = new DeviceRgb(63, 81, 181);  // Azul medio
    private static final DeviceRgb COLOR_HEADER = new DeviceRgb(13, 71, 161);      // Azul fuerte
    private static final DeviceRgb COLOR_SUCCESS = new DeviceRgb(76, 175, 80);     // Verde
    private static final DeviceRgb COLOR_WARNING = new DeviceRgb(255, 152, 0);     // Naranja
    private static final DeviceRgb COLOR_LIGHT_BG = new DeviceRgb(227, 242, 253);  // Azul claro

    @Value("${app.cotizaciones.ruta-pdf:./pdf-cotizaciones/}")
    private String rutaPdf;

    // ============================================================
    // 1. Generar PDF de una cotización completa
    // ============================================================
    public File generarPdfCotizacion(Cotizacion cotizacion) {
        String nombreArchivo = cotizacion.getNumero() + ".pdf";
        String rutaCompleta = rutaPdf + nombreArchivo;

        // Crear directorio si no existe
        File directorio = new File(rutaPdf);
        if (!directorio.exists()) {
            directorio.mkdirs();
        }

        File archivoPdf = new File(rutaCompleta);

        try {
            PdfWriter writer = new PdfWriter(archivoPdf);
            PdfDocument pdfDoc = new PdfDocument(writer);
            Document document = new Document(pdfDoc, PageSize.LETTER);
            document.setMargins(20, 20, 20, 20);

            // === ENCABEZADO ===
            agregarEncabezado(document, cotizacion);

            // === INFORMACIÓN DEL CLIENTE ===
            agregarInfoCliente(document, cotizacion.getCliente());

            // === TABLA DE DETALLES ===
            agregarTablaDetalles(document, cotizacion.getDetalles());

            // === TOTALES ===
            agregarTotales(document, cotizacion);

            // === NOTAS Y CONDICIONES ===
            agregarNotas(document, cotizacion);

            // === PIE DE PÁGINA ===
            agregarPiePagina(document);

            document.close();
            log.info("PDF generado exitosamente: {}", rutaCompleta);

        } catch (FileNotFoundException e) {
            log.error("Error al crear archivo PDF: {}", e.getMessage());
            throw new RuntimeException("Error al generar PDF", e);
        }

        return archivoPdf;
    }

    // ============================================================
    // ENCABEZADO del documento
    // ============================================================
    private void agregarEncabezado(Document document, Cotizacion cotizacion) throws FileNotFoundException {
        PdfFont fontBold = PdfFontFactory.createFont("Helvetica-Bold");
        PdfFont fontNormal = PdfFontFactory.createFont("Helvetica");

        // Tabla de encabezado (2 columnas: logo-info | número cotización)
        Table tablaHeader = new Table(UnitValue.createPercentArray(new float[]{70, 30}))
                .useAllAvailableWidth()
                .setMarginBottom(10);

        // Lado izquierdo: Nombre de la empresa
        Cell celdaEmpresa = new Cell()
                .add(new Paragraph("SISTEMA DE HERRAJES")
                        .setFont(fontBold)
                        .setFontSize(20)
                        .setFontColor(COLOR_PRIMARIO))
                .add(new Paragraph("Gestión de Inventario y Cotizaciones")
                        .setFont(fontNormal)
                        .setFontSize(10)
                        .setFontColor(ColorConstants.GRAY))
                .add(new Paragraph("RFC: HRJ200101AB3 | Tel: 81-1000-0000")
                        .setFont(fontNormal)
                        .setFontSize(8)
                        .setFontColor(ColorConstants.DARK_GRAY))
                .setBorder(Border.NO_BORDER)
                .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE);

        // Lado derecho: Datos de la cotización
        Cell celdaCotizacion = new Cell()
                .add(new Paragraph("COTIZACIÓN")
                        .setFont(fontBold)
                        .setFontSize(14)
                        .setFontColor(ColorConstants.WHITE)
                        .setTextAlignment(TextAlignment.CENTER))
                .add(new Paragraph(cotizacion.getNumero())
                        .setFont(fontBold)
                        .setFontSize(18)
                        .setFontColor(new DeviceRgb(255, 235, 59))
                        .setTextAlignment(TextAlignment.CENTER))
                .add(new Paragraph("Fecha: " + cotizacion.getFechaCotizacion()
                        .format(DateTimeFormatter.ofPattern("dd/MM/yyyy")))
                        .setFont(fontNormal)
                        .setFontSize(9)
                        .setTextAlignment(TextAlignment.CENTER))
                .add(new Paragraph("Vigencia: " + cotizacion.getFechaVigencia()
                        .format(DateTimeFormatter.ofPattern("dd/MM/yyyy")))
                        .setFont(fontNormal)
                        .setFontSize(9)
                        .setTextAlignment(TextAlignment.CENTER))
                .setBackgroundColor(COLOR_HEADER)
                .setPadding(10)
                .setBorder(Border.NO_BORDER)
                .setVerticalAlignment(com.itextpdf.layout.properties.VerticalAlignment.MIDDLE);

        tablaHeader.addCell(celdaEmpresa);
        tablaHeader.addCell(celdaCotizacion);

        document.add(tablaHeader);

        // Línea separadora
        document.add(new LineSeparator(new SolidLine(1))
                .setWidth(UnitValue.createPercentValue(100))
                .setMarginBottom(10));
    }

    // ============================================================
    // INFORMACIÓN DEL CLIENTE
    // ============================================================
    private void agregarInfoCliente(Document document, Cliente cliente) {
        PdfFont fontBold = PdfFontFactory.createFont("Helvetica-Bold");
        PdfFont fontNormal = PdfFontFactory.createFont("Helvetica");

        Paragraph titulo = new Paragraph("DATOS DEL CLIENTE")
                .setFont(fontBold)
                .setFontSize(11)
                .setFontColor(COLOR_PRIMARIO)
                .setMarginBottom(5);

        document.add(titulo);

        Table tablaCliente = new Table(UnitValue.createPercentArray(new float[]{33, 33, 34}))
                .useAllAvailableWidth()
                .setMarginBottom(15);

        agregarCeldaInfo(tablaCliente, "Cliente:", cliente.getNombre(), fontBold, fontNormal);
        agregarCeldaInfo(tablaCliente, "RFC:", cliente.getRfc() != null ? cliente.getRfc() : "N/A", fontBold, fontNormal);
        agregarCeldaInfo(tablaCliente, "Ciudad:", cliente.getCiudad() != null ? cliente.getCiudad() : "N/A", fontBold, fontNormal);
        agregarCeldaInfo(tablaCliente, "Teléfono:", cliente.getTelefono() != null ? cliente.getTelefono() : "N/A", fontBold, fontNormal);
        agregarCeldaInfo(tablaCliente, "Email:", cliente.getEmail() != null ? cliente.getEmail() : "N/A", fontBold, fontNormal);
        agregarCeldaInfo(tablaCliente, "Dirección:", cliente.getDireccion() != null ? cliente.getDireccion() : "N/A", fontBold, fontNormal);

        document.add(tablaCliente);
    }

    // ============================================================
    // TABLA DE DETALLES (productos de la cotización)
    // ============================================================
    private void agregarTablaDetalles(Document document, List<CotizacionDetalle> detalles) {
        PdfFont fontBold = PdfFontFactory.createFont("Helvetica-Bold");
        PdfFont fontNormal = PdfFontFactory.createFont("Helvetica");

        Paragraph titulo = new Paragraph("DETALLE DE LA COTIZACIÓN")
                .setFont(fontBold)
                .setFontSize(11)
                .setFontColor(COLOR_PRIMARIO)
                .setMarginBottom(5);

        document.add(titulo);

        // Tabla con 6 columnas
        Table tabla = new Table(UnitValue.createPercentArray(new float[]{6, 32, 10, 15, 12, 25}))
                .useAllAvailableWidth()
                .setMarginBottom(10);

        // === ENCABEZADOS DE COLUMNA ===
        String[] encabezados = {"#", "Descripción", "Cant.", "P. Unitario", "Desc.", "Subtotal"};
        for (String encabezado : encabezados) {
            Cell celda = new Cell()
                    .add(new Paragraph(encabezado)
                            .setFont(fontBold)
                            .setFontSize(9)
                            .setFontColor(ColorConstants.WHITE))
                    .setBackgroundColor(COLOR_PRIMARIO)
                    .setTextAlignment(TextAlignment.CENTER)
                    .setPadding(5)
                    .setBorder(new SolidBorder(ColorConstants.WHITE, 0.5f));
            tabla.addHeaderCell(celda);
        }

        // === FILAS DE PRODUCTOS ===
        int numFila = 1;
        for (CotizacionDetalle detalle : detalles) {
            DeviceRgb colorFila = numFila % 2 == 0
                    ? new DeviceRgb(232, 234, 246)  // Azul muy claro
                    : ColorConstants.WHITE;

            tabla.addCell(crearCeldaTabla(String.valueOf(numFila), fontNormal, colorFila, TextAlignment.CENTER));
            tabla.addCell(crearCeldaTabla(detalle.getProducto().getNombre(), fontNormal, colorFila, TextAlignment.LEFT));
            tabla.addCell(crearCeldaTabla(String.valueOf(detalle.getCantidad()), fontNormal, colorFila, TextAlignment.CENTER));
            tabla.addCell(crearCeldaTabla(formatearMoneda(detalle.getPrecioUnitario()), fontNormal, colorFila, TextAlignment.RIGHT));
            tabla.addCell(crearCeldaTabla(detalle.getDescuentoPorcentaje() + "%", fontNormal, colorFila, TextAlignment.CENTER));
            tabla.addCell(crearCeldaTabla(formatearMoneda(detalle.getSubtotalLinea()), fontBold, colorFila, TextAlignment.RIGHT));

            numFila++;
        }

        document.add(tabla);
    }

    // ============================================================
    // TOTALES de la cotización
    // ============================================================
    private void agregarTotales(Document document, Cotizacion cotizacion) {
        PdfFont fontBold = PdfFontFactory.createFont("Helvetica-Bold");
        PdfFont fontNormal = PdfFontFactory.createFont("Helvetica");

        // Tabla alineada a la derecha
        Table tablaTotales = new Table(UnitValue.createPercentArray(new float[]{65, 35}))
                .useAllAvailableWidth()
                .setMarginBottom(15);

        // Columna vacía a la izquierda
        Cell celdaVacia = new Cell(3, 1).setBorder(Border.NO_BORDER);
        tablaTotales.addCell(celdaVacia);

        // Subtotal
        tablaTotales.addCell(crearFilaTotal("Subtotal:", formatearMoneda(cotizacion.getSubtotal()),
                fontNormal, fontBold, ColorConstants.WHITE));

        // Descuento
        if (cotizacion.getDescuentoPorcentaje().compareTo(BigDecimal.ZERO) > 0) {
            tablaTotales.addCell(crearFilaTotal(
                    "Descuento (" + cotizacion.getDescuentoPorcentaje() + "%):",
                    "-" + formatearMoneda(cotizacion.getDescuentoMonto()),
                    fontNormal, fontBold, new DeviceRgb(255, 235, 58)));
        }

        // IVA
        tablaTotales.addCell(crearFilaTotal("IVA (16%):", formatearMoneda(cotizacion.getIva()),
                fontNormal, fontBold, ColorConstants.WHITE));

        // TOTAL (destacado)
        Cell celdaTotalLabel = new Cell()
                .add(new Paragraph("TOTAL:")
                        .setFont(fontBold)
                        .setFontSize(14)
                        .setFontColor(ColorConstants.WHITE))
                .setBackgroundColor(COLOR_PRIMARIO)
                .setPadding(8)
                .setTextAlignment(TextAlignment.RIGHT)
                .setBorder(new SolidBorder(COLOR_PRIMARIO, 1));

        Cell celdaTotalValor = new Cell()
                .add(new Paragraph(formatearMoneda(cotizacion.getTotal()))
                        .setFont(fontBold)
                        .setFontSize(14)
                        .setFontColor(ColorConstants.WHITE))
                .setBackgroundColor(COLOR_PRIMARIO)
                .setPadding(8)
                .setTextAlignment(TextAlignment.RIGHT)
                .setBorder(new SolidBorder(COLOR_PRIMARIO, 1));

        tablaTotales.addCell(celdaTotalLabel);
        tablaTotales.addCell(celdaTotalValor);

        document.add(tablaTotales);
    }

    // ============================================================
    // NOTAS Y CONDICIONES
    // ============================================================
    private void agregarNotas(Document document, Cotizacion cotizacion) {
        PdfFont fontBold = PdfFontFactory.createFont("Helvetica-Bold");
        PdfFont fontNormal = PdfFontFactory.createFont("Helvetica");

        Paragraph titulo = new Paragraph("NOTAS Y CONDICIONES")
                .setFont(fontBold)
                .setFontSize(11)
                .setFontColor(COLOR_PRIMARIO)
                .setMarginBottom(5);

        document.add(titulo);

        // Cuadro de notas
        Paragraph notas = new Paragraph()
                .setFont(fontNormal)
                .setFontSize(9);

        if (cotizacion.getNotas() != null && !cotizacion.getNotas().isEmpty()) {
            notas.add(cotizacion.getNotas() + "\n\n");
        }

        notas.add("• Esta cotización tiene una vigencia de 30 días a partir de la fecha de emisión.\n");
        notas.add("• Los precios incluyen IVA.\n");
        notas.add("• El tiempo de entrega es de 3 a 5 días hábiles después de la confirmación del pedido.\n");
        notas.add("• La disponibilidad de productos está sujeta a inventario.\n");
        notas.add("• Forma de pago: Contado / Transferencia bancaria.");

        document.add(new Div()
                .add(notas)
                .setBackgroundColor(new DeviceRgb(245, 245, 245))
                .setPadding(10)
                .setMarginBottom(15)
                .setBorder(new SolidBorder(ColorConstants.LIGHT_GRAY, 0.5f)));
    }

    // ============================================================
    // PIE DE PÁGINA
    // ============================================================
    private void agregarPiePagina(Document document) {
        PdfFont fontNormal = PdfFontFactory.createFont("Helvetica");

        document.add(new LineSeparator(new SolidLine(0.5f))
                .setMarginBottom(5));

        document.add(new Paragraph("Sistema de Gestión de Inventario y Cotizaciones | Herrajes para Vidrio")
                .setFont(fontNormal)
                .setFontSize(7)
                .setFontColor(ColorConstants.GRAY)
                .setTextAlignment(TextAlignment.CENTER));

        document.add(new Paragraph("Generado automáticamente el " +
                LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")))
                .setFont(fontNormal)
                .setFontSize(7)
                .setFontColor(ColorConstants.GRAY)
                .setTextAlignment(TextAlignment.CENTER));
    }

    // ============================================================
    // MÉTODOS AUXILIARES
    // ============================================================
    private void agregarCeldaInfo(Table tabla, String label, String valor,
                                  PdfFont fontBold, PdfFont fontNormal) {
        Cell celda = new Cell()
                .add(new Paragraph(label).setFont(fontBold).setFontSize(9))
                .add(new Paragraph(valor).setFont(fontNormal).setFontSize(9))
                .setBorder(Border.NO_BORDER)
                .setPadding(3);
        tabla.addCell(celda);
    }

    private Cell crearCeldaTabla(String texto, PdfFont font, DeviceRgb bgColor, TextAlignment align) {
        return new Cell()
                .add(new Paragraph(texto).setFont(font).setFontSize(9))
                .setBackgroundColor(bgColor)
                .setTextAlignment(align)
                .setPadding(4)
                .setBorder(new SolidBorder(ColorConstants.LIGHT_GRAY, 0.5f));
    }

    private Cell crearFilaTotal(String label, String valor, PdfFont fontLabel, PdfFont fontValor, DeviceRgb bgColor) {
        Cell celdaLabel = new Cell()
                .add(new Paragraph(label).setFont(fontLabel).setFontSize(10))
                .setBackgroundColor(bgColor)
                .setTextAlignment(TextAlignment.RIGHT)
                .setPadding(5)
                .setBorder(new SolidBorder(ColorConstants.LIGHT_GRAY, 0.5f));

        Cell celdaValor = new Cell()
                .add(new Paragraph(valor).setFont(fontValor).setFontSize(10))
                .setBackgroundColor(bgColor)
                .setTextAlignment(TextAlignment.RIGHT)
                .setPadding(5)
                .setBorder(new SolidBorder(ColorConstants.LIGHT_GRAY, 0.5f));

        // Agregar ambas celdas juntas
        Table miniTabla = new Table(UnitValue.createPercentArray(new float[]{50, 50}))
                .useAllAvailableWidth();
        miniTabla.addCell(celdaLabel);
        miniTabla.addCell(celdaValor);

        Cell celdaContenedor = new Cell()
                .add(miniTabla)
                .setBorder(Border.NO_BORDER);

        return celdaContenedor;
    }

    private String formatearMoneda(BigDecimal valor) {
        if (valor == null) return "$0.00";
        return "$" + valor.setScale(2, RoundingMode.HALF_UP).toString();
    }
}
