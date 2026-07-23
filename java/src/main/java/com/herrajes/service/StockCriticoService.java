package com.herrajes.service;

import com.herrajes.dto.StockCriticoDTO;
import com.herrajes.model.Producto;
import com.herrajes.repository.ProductoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

// ============================================================
// SERVICIO: Lógica de Stock Crítico y Alertas
// ============================================================
@Service
public class StockCriticoService {

    private static final Logger log = LoggerFactory.getLogger(StockCriticoService.class);

    private final ProductoRepository productoRepository;
    private final EmailService emailService;

    public StockCriticoService(ProductoRepository productoRepository, EmailService emailService) {
        this.productoRepository = productoRepository;
        this.emailService = emailService;
    }

    // ============================================================
    // 1. Obtener todos los productos con stock crítico
    // ============================================================
    @Transactional(readOnly = true)
    public List<StockCriticoDTO> obtenerProductosConStockCritico() {
        List<Producto> productos = productoRepository.findProductosConStockCritico();
        return productos.stream()
                .map(StockCriticoDTO::fromProducto)
                .collect(Collectors.toList());
    }

    // ============================================================
    // 2. Obtener productos agotados (stock = 0)
    // ============================================================
    @Transactional(readOnly = true)
    public List<StockCriticoDTO> obtenerProductosAgotados() {
        List<Producto> productos = productoRepository.findProductosAgotados();
        return productos.stream()
                .map(StockCriticoDTO::fromProducto)
                .collect(Collectors.toList());
    }

    // ============================================================
    // 3. Obtener productos con stock bajo (hasta 150% del mínimo)
    // ============================================================
    @Transactional(readOnly = true)
    public List<StockCriticoDTO> obtenerProductosConStockBajo() {
        List<Producto> productos = productoRepository.findProductosConStockBajo();
        return productos.stream()
                .map(StockCriticoDTO::fromProducto)
                .collect(Collectors.toList());
    }

    // ============================================================
    // 4. Calcular el nivel de criticidad de un producto específico
    // ============================================================
    @Transactional(readOnly = true)
    public CriticidadProducto calcularCriticidad(UUID productoId) {
        Producto producto = productoRepository.findById(productoId)
                .orElseThrow(() -> new RuntimeException("Producto no encontrado: " + productoId));

        CriticidadProducto criticidad = new CriticidadProducto();
        criticidad.setProductoId(productoId);
        criticidad.setCodigo(producto.getCodigo());
        criticidad.setNombre(producto.getNombre());
        criticidad.setStockActual(producto.getStockActual());
        criticidad.setStockMinimo(producto.getStockMinimo());

        // Calcular distancia al mínimo en porcentaje
        if (producto.getStockMinimo() > 0) {
            BigDecimal distancia = BigDecimal.valueOf(producto.getStockActual())
                    .subtract(BigDecimal.valueOf(producto.getStockMinimo()))
                    .divide(BigDecimal.valueOf(producto.getStockMinimo()), 4, java.math.RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100));

            criticidad.setDistanciaAlMinimo(distancia);
        }

        // Determinar nivel de criticidad
        if (producto.getStockActual() == 0) {
            criticidad.setNivel(Criticidad.AGOTADO);
            criticidad.setAccionRecomendada("URGENTE: Realizar pedido inmediato al proveedor");
        } else if (producto.getStockActual() <= producto.getStockMinimo() * 0.5) {
            criticidad.setNivel(Criticidad.CRITICO);
            criticidad.setAccionRecomendada("Generar orden de compra lo antes posible");
        } else if (producto.getStockActual() <= producto.getStockMinimo()) {
            criticidad.setNivel(Criticidad.BAJO);
            criticidad.setAccionRecomendada("Planificar reposición en la próxima semana");
        } else if (producto.getStockActual() <= producto.getStockMinimo() * 1.5) {
            criticidad.setNivel(Criticidad.PRECAUCION);
            criticidad.setAccionRecomendada("Monitorear y considerar reposición");
        } else {
            criticidad.setNivel(Criticidad.OK);
            criticidad.setAccionRecomendada("Stock suficiente");
        }

        return criticidad;
    }

    // ============================================================
    // 5. Resumen general del inventario
    // ============================================================
    @Transactional(readOnly = true)
    public ResumenInventario obtenerResumenInventario() {
        ResumenInventario resumen = new ResumenInventario();

        List<Producto> todos = productoRepository.findByActivoTrue();

        resumen.setTotalProductos(todos.size());
        resumen.setProductosAgotados((int) todos.stream().filter(p -> p.getStockActual() == 0).count());
        resumen.setProductosCriticos((int) todos.stream()
                .filter(p -> p.getStockActual() > 0 && p.getStockActual() <= p.getStockMinimo()).count());
        resumen.setProductosBajos((int) todos.stream()
                .filter(p -> p.getStockActual() > p.getStockMinimo() && p.getStockActual() <= p.getStockMinimo() * 1.5).count());
        resumen.setProductosOk((int) todos.stream()
                .filter(p -> p.getStockActual() > p.getStockMinimo() * 1.5).count());

        BigDecimal valorTotal = todos.stream()
                .map(p -> p.getPrecioVenta().multiply(BigDecimal.valueOf(p.getStockActual())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        resumen.setValorTotalInventario(valorTotal);

        return resumen;
    }

    // ============================================================
    // 6. Ejecutar alertas de stock bajo (programado cada 6 horas)
    // ============================================================
    @Scheduled(cron = "0 0 */6 * * *") // Cada 6 horas
    public void ejecutarAlertasStockBajo() {
        log.info("=== Iniciando verificación de stock crítico ===");

        List<StockCriticoDTO> criticos = obtenerProductosConStockCritico();

        if (criticos.isEmpty()) {
            log.info("No hay productos con stock crítico.");
            return;
        }

        log.warn("Se encontraron {} productos con stock crítico", criticos.size());

        // Construir el reporte HTML para el email
        StringBuilder html = new StringBuilder();
        html.append("<html><body>");
        html.append("<h2 style='color: #d32f2f;'>⚠ Alerta de Stock Crítico - Herrajes</h2>");
        html.append("<p>Se han detectado los siguientes productos con stock bajo el mínimo:</p>");
        html.append("<table border='1' cellpadding='8' cellspacing='0' style='border-collapse: collapse;'>");
        html.append("<tr style='background-color: #f44336; color: white;'>");
        html.append("<th>Código</th><th>Producto</th><th>Stock</th><th>Mínimo</th>");
        html.append("<th>Faltante</th><th>Estado</th><th>Proveedor</th></tr>");

        for (StockCriticoDTO dto : criticos) {
            String colorFila = dto.getEstadoStock().equals("SIN_STOCK") ? "#ffebee" :
                               dto.getEstadoStock().equals("CRITICO") ? "#fff3e0" : "#fffde7";

            html.append(String.format("<tr style='background-color: %s;'>", colorFila));
            html.append(String.format("<td><strong>%s</strong></td>", dto.getCodigo()));
            html.append(String.format("<td>%s</td>", dto.getNombre()));
            html.append(String.format("<td>%d</td>", dto.getStockActual()));
            html.append(String.format("<td>%d</td>", dto.getStockMinimo()));
            html.append(String.format("<td><strong>%d</strong></td>", dto.getCantidadFaltante()));
            html.append(String.format("<td><strong>%s</strong></td>", dto.getEstadoStock()));
            html.append(String.format("<td>%s</td>", dto.getProveedor()));
            html.append("</tr>");
        }

        html.append("</table>");
        html.append("<br/>");
        html.append("<p><em>Este es un correo automático del Sistema de Gestión de Inventario.</em></p>");
        html.append("</body></html>");

        // Enviar email a compras y admin
        emailService.enviarAlertaStockCritico(
                Arrays.asList("compras@herrajes.local", "admin@herrajes.local"),
                "Alerta Stock Crítico - " + criticos.size() + " productos",
                html.toString()
        );

        log.info("Email de alerta enviado a compras y admin.");
    }

    // ============================================================
    // ENUM: Niveles de criticidad
    // ============================================================
    public enum Criticidad {
        AGOTADO,    // Stock = 0
        CRITICO,    // Stock <= 50% del mínimo
        BAJO,       // Stock <= mínimo
        PRECAUCION, // Stock <= 150% del mínimo
        OK          // Stock > 150% del mínimo
    }

    // ============================================================
    // DTO Interno: Criticidad de un producto
    // ============================================================
    public static class CriticidadProducto {
        private UUID productoId;
        private String codigo;
        private String nombre;
        private Integer stockActual;
        private Integer stockMinimo;
        private BigDecimal distanciaAlMinimo;
        private Criticidad nivel;
        private String accionRecomendada;

        // Getters y Setters
        public UUID getProductoId() { return productoId; }
        public void setProductoId(UUID productoId) { this.productoId = productoId; }
        public String getCodigo() { return codigo; }
        public void setCodigo(String codigo) { this.codigo = codigo; }
        public String getNombre() { return nombre; }
        public void setNombre(String nombre) { this.nombre = nombre; }
        public Integer getStockActual() { return stockActual; }
        public void setStockActual(Integer stockActual) { this.stockActual = stockActual; }
        public Integer getStockMinimo() { return stockMinimo; }
        public void setStockMinimo(Integer stockMinimo) { this.stockMinimo = stockMinimo; }
        public BigDecimal getDistanciaAlMinimo() { return distanciaAlMinimo; }
        public void setDistanciaAlMinimo(BigDecimal distanciaAlMinimo) { this.distanciaAlMinimo = distanciaAlMinimo; }
        public Criticidad getNivel() { return nivel; }
        public void setNivel(Criticidad nivel) { this.nivel = nivel; }
        public String getAccionRecomendada() { return accionRecomendada; }
        public void setAccionRecomendada(String accionRecomendada) { this.accionRecomendada = accionRecomendada; }
    }

    // ============================================================
    // DTO Interno: Resumen del inventario
    // ============================================================
    public static class ResumenInventario {
        private int totalProductos;
        private int productosAgotados;
        private int productosCriticos;
        private int productosBajos;
        private int productosOk;
        private BigDecimal valorTotalInventario;

        // Getters y Setters
        public int getTotalProductos() { return totalProductos; }
        public void setTotalProductos(int totalProductos) { this.totalProductos = totalProductos; }
        public int getProductosAgotados() { return productosAgotados; }
        public void setProductosAgotados(int productosAgotados) { this.productosAgotados = productosAgotados; }
        public int getProductosCriticos() { return productosCriticos; }
        public void setProductosCriticos(int productosCriticos) { this.productosCriticos = productosCriticos; }
        public int getProductosBajos() { return productosBajos; }
        public void setProductosBajos(int productosBajos) { this.productosBajos = productosBajos; }
        public int getProductosOk() { return productosOk; }
        public void setProductosOk(int productosOk) { this.productosOk = productosOk; }
        public BigDecimal getValorTotalInventario() { return valorTotalInventario; }
        public void setValorTotalInventario(BigDecimal valorTotalInventario) { this.valorTotalInventario = valorTotalInventario; }
    }
}
