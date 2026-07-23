package com.herrajes.dto;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

// ============================================================
// DTO: Alerta de Stock Crítico
// ============================================================
public class StockCriticoDTO {

    private UUID productoId;
    private String codigo;
    private String nombre;
    private String categoria;
    private String proveedor;
    private Integer stockActual;
    private Integer stockMinimo;
    private Integer stockMaximo;
    private String estadoStock;      // SIN_STOCK, CRITICO, BAJO
    private Integer cantidadFaltante;
    private BigDecimal porcentajeFaltante;
    private BigDecimal precioVenta;
    private BigDecimal valorInventario;
    private String ubicacion;

    // Constructor desde entidad Producto
    public static StockCriticoDTO fromProducto(com.herrajes.model.Producto p) {
        StockCriticoDTO dto = new StockCriticoDTO();
        dto.productoId = p.getId();
        dto.codigo = p.getCodigo();
        dto.nombre = p.getNombre();
        dto.categoria = p.getCategoria() != null ? p.getCategoria().getNombre() : "Sin categoría";
        dto.proveedor = p.getProveedor() != null ? p.getProveedor().getNombre() : "Sin proveedor";
        dto.stockActual = p.getStockActual();
        dto.stockMinimo = p.getStockMinimo();
        dto.stockMaximo = p.getStockMaximo();
        dto.precioVenta = p.getPrecioVenta();
        dto.ubicacion = p.getUbicacion();
        dto.valorInventario = p.getPrecioVenta()
                .multiply(BigDecimal.valueOf(p.getStockActual()));

        // Calcular estado del stock
        if (p.getStockActual() == 0) {
            dto.estadoStock = "SIN_STOCK";
            dto.cantidadFaltante = p.getStockMinimo();
        } else if (p.getStockActual() <= p.getStockMinimo()) {
            dto.estadoStock = "CRITICO";
            dto.cantidadFaltante = p.getStockMinimo() - p.getStockActual();
        } else {
            dto.estadoStock = "BAJO";
            dto.cantidadFaltante = 0;
        }

        // Calcular porcentaje faltante
        if (p.getStockMinimo() > 0) {
            dto.porcentajeFaltante = BigDecimal.valueOf(p.getStockMinimo() - p.getStockActual())
                    .multiply(BigDecimal.valueOf(100))
                    .divide(BigDecimal.valueOf(p.getStockMinimo()), 1, RoundingMode.HALF_UP);
        } else {
            dto.porcentajeFaltante = BigDecimal.ZERO;
        }

        return dto;
    }

    // Getters
    public UUID getProductoId() { return productoId; }
    public String getCodigo() { return codigo; }
    public String getNombre() { return nombre; }
    public String getCategoria() { return categoria; }
    public String getProveedor() { return proveedor; }
    public Integer getStockActual() { return stockActual; }
    public Integer getStockMinimo() { return stockMinimo; }
    public Integer getStockMaximo() { return stockMaximo; }
    public String getEstadoStock() { return estadoStock; }
    public Integer getCantidadFaltante() { return cantidadFaltante; }
    public BigDecimal getPorcentajeFaltante() { return porcentajeFaltante; }
    public BigDecimal getPrecioVenta() { return precioVenta; }
    public BigDecimal getValorInventario() { return valorInventario; }
    public String getUbicacion() { return ubicacion; }
}
