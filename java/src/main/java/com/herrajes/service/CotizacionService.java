package com.herrajes.service;

import com.herrajes.model.*;
import com.herrajes.repository.CotizacionDetalleRepository;
import com.herrajes.repository.CotizacionRepository;
import com.herrajes.repository.ProductoRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

// ============================================================
// SERVICIO: Gestión de Cotizaciones
// ============================================================
@Service
public class CotizacionService {

    private static final Logger log = LoggerFactory.getLogger(CotizacionService.class);

    private final CotizacionRepository cotizacionRepository;
    private final CotizacionDetalleRepository detalleRepository;
    private final ProductoRepository productoRepository;
    private final PdfCotizacionService pdfService;
    private final EmailService emailService;

    public CotizacionService(CotizacionRepository cotizacionRepository,
                             CotizacionDetalleRepository detalleRepository,
                             ProductoRepository productoRepository,
                             PdfCotizacionService pdfService,
                             EmailService emailService) {
        this.cotizacionRepository = cotizacionRepository;
        this.detalleRepository = detalleRepository;
        this.productoRepository = productoRepository;
        this.pdfService = pdfService;
        this.emailService = emailService;
    }

    // ============================================================
    // 1. Crear una nueva cotización
    // ============================================================
    @Transactional
    public Cotizacion crearCotizacion(Cotizacion cotizacion) {
        // Validar que tenga detalles
        if (cotizacion.getDetalles() == null || cotizacion.getDetalles().isEmpty()) {
            throw new RuntimeException("La cotización debe tener al menos un detalle");
        }

        // Asignar fechas por defecto
        cotizacion.setFechaCotizacion(LocalDate.now());
        if (cotizacion.getFechaVigencia() == null) {
            cotizacion.setFechaVigencia(LocalDate.now().plusDays(30));
        }

        cotizacion.setEstado(Cotizacion.EstadoCotizacion.BORRADOR);

        // Calcular subtotales de cada línea y totales
        for (CotizacionDetalle detalle : cotizacion.getDetalles()) {
            Producto producto = detalle.getProducto();
            if (producto == null) {
                throw new RuntimeException("Detalle sin producto válido");
            }

            // Usar el precio de venta del producto si no se especifica
            if (detalle.getPrecioUnitario() == null) {
                detalle.setPrecioUnitario(producto.getPrecioVenta());
            }

            // Calcular subtotal de la línea
            BigDecimal subtotalLinea = producto.getPrecioVenta()
                    .multiply(BigDecimal.valueOf(detalle.getCantidad()));

            if (detalle.getDescuentoPorcentaje() != null &&
                detalle.getDescuentoPorcentaje().compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal descuento = subtotalLinea
                        .multiply(detalle.getDescuentoPorcentaje().divide(BigDecimal.valueOf(100)));
                subtotalLinea = subtotalLinea.subtract(descuento);
            }

            detalle.setSubtotalLinea(subtotalLinea);
        }

        // Guardar la cotización
        Cotizacion guardada = cotizacionRepository.save(cotizacion);

        // Guardar los detalles
        for (CotizacionDetalle detalle : guardada.getDetalles()) {
            detalle.setCotizacion(guardada);
            detalleRepository.save(detalle);
        }

        // Calcular totales
        calcularTotales(guardada);

        log.info("Cotización creada: {}", guardada.getNumero());
        return guardada;
    }

    // ============================================================
    // 2. Generar PDF y enviar por email
    // ============================================================
    @Transactional
    public void generarPdfYEnviarEmail(UUID cotizacionId, List<String> destinatarios) {
        Cotizacion cotizacion = cotizacionRepository.findById(cotizacionId)
                .orElseThrow(() -> new RuntimeException("Cotización no encontrada: " + cotizacionId));

        // 1. Generar el PDF
        File pdf = pdfService.generarPdfCotizacion(cotizacion);

        // 2. Enviar por email
        String nombreCliente = cotizacion.getCliente().getNombre();
        emailService.enviarCotizacionPdf(
                destinatarios,
                cotizacion.getNumero(),
                pdf,
                nombreCliente
        );

        // 3. Actualizar estado
        cotizacion.setEstado(Cotizacion.EstadoCotizacion.ENVIADA);
        cotizacion.setPdfUrl(pdf.getAbsolutePath());
        cotizacionRepository.save(cotizacion);

        log.info("Cotización {} generada y enviada a: {}", cotizacion.getNumero(), destinatarios);
    }

    // ============================================================
    // 3. Aprobar una cotización (genera movimiento de salida)
    // ============================================================
    @Transactional
    public void aprobarCotizacion(UUID cotizacionId) {
        Cotizacion cotizacion = cotizacionRepository.findById(cotizacionId)
                .orElseThrow(() -> new RuntimeException("Cotización no encontrada"));

        if (cotizacion.getEstado() != Cotizacion.EstadoCotizacion.ENVIADA) {
            throw new RuntimeException("Solo se pueden aprobar cotizaciones en estado ENVIADA");
        }

        // Verificar stock disponible para cada producto
        for (CotizacionDetalle detalle : cotizacion.getDetalles()) {
            Producto producto = detalle.getProducto();
            if (producto.getStockActual() < detalle.getCantidad()) {
                throw new RuntimeException(String.format(
                        "Stock insuficiente para %s: disponible %d, solicitado %d",
                        producto.getCodigo(), producto.getStockActual(), detalle.getCantidad()));
            }
        }

        // Descontar stock (registrar salidas)
        for (CotizacionDetalle detalle : cotizacion.getDetalles()) {
            MovimientoStock movimiento = new MovimientoStock();
            movimiento.setProducto(detalle.getProducto());
            movimiento.setTipoMovimiento(MovimientoStock.TipoMovimiento.SALIDA);
            movimiento.setCantidad(detalle.getCantidad());
            movimiento.setMotivo("Venta por cotización");
            movimiento.setReferencia(cotizacion.getNumero());

            // El trigger de la BD se encarga de actualizar el stock
            // Aquí solo registramos el movimiento
            log.info("Movimiento registrado: Salida de {} unidades de {}",
                    detalle.getCantidad(), detalle.getProducto().getCodigo());
        }

        cotizacion.setEstado(Cotizacion.EstadoCotizacion.APROBADA);
        cotizacionRepository.save(cotizacion);

        log.info("Cotización {} aprobada", cotizacion.getNumero());
    }

    // ============================================================
    // 4. Calcular totales de una cotización
    // ============================================================
    private void calcularTotales(Cotizacion cotizacion) {
        BigDecimal subtotal = cotizacion.getDetalles().stream()
                .map(CotizacionDetalle::getSubtotalLinea)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal descuentoMonto = BigDecimal.ZERO;
        if (cotizacion.getDescuentoPorcentaje() != null &&
            cotizacion.getDescuentoPorcentaje().compareTo(BigDecimal.ZERO) > 0) {
            descuentoMonto = subtotal
                    .multiply(cotizacion.getDescuentoPorcentaje().divide(BigDecimal.valueOf(100)));
        }

        BigDecimal baseImponible = subtotal.subtract(descuentoMonto);
        BigDecimal iva = baseImponible.multiply(BigDecimal.valueOf(0.16)); // 16% IVA México
        BigDecimal total = baseImponible.add(iva);

        cotizacion.setSubtotal(subtotal);
        cotizacion.setDescuentoMonto(descuentoMonto);
        cotizacion.setIva(iva);
        cotizacion.setTotal(total);
    }

    // ============================================================
    // 5. Obtener cotización por ID
    // ============================================================
    @Transactional(readOnly = true)
    public Cotizacion obtenerPorId(java.util.UUID id) {
        return cotizacionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cotización no encontrada: " + id));
    }

    // ============================================================
    // 6. Listar cotizaciones por estado
    // ============================================================
    @Transactional(readOnly = true)
    public List<Cotizacion> listarPorEstado(Cotizacion.EstadoCotizacion estado) {
        return cotizacionRepository.findByEstado(estado);
    }

    // ============================================================
    // 7. Marcar cotizaciones vencidas (programado)
    // ============================================================
    @org.springframework.scheduling.annotation.Scheduled(cron = "0 0 8 * * *") // Todos los días a las 8am
    public void marcarCotizacionesVencidas() {
        List<Cotizacion> proximasAVencer = cotizacionRepository
                .findCotizacionesProximasAVencer(LocalDate.now());

        for (Cotizacion cotizacion : proximasAVencer) {
            if (cotizacion.getFechaVigencia().isBefore(LocalDate.now())) {
                cotizacion.setEstado(Cotizacion.EstadoCotizacion.VENCIDA);
                cotizacionRepository.save(cotizacion);
                log.info("Cotización {} marcada como VENCIDA", cotizacion.getNumero());
            }
        }
    }
}
