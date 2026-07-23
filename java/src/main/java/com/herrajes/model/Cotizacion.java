package com.herrajes.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "cotizaciones")
public class Cotizacion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 30)
    private String numero;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private PerfilUsuario usuario;

    @Column(name = "fecha_cotizacion", nullable = false)
    private LocalDate fechaCotizacion;

    @Column(name = "fecha_vigencia", nullable = false)
    private LocalDate fechaVigencia;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal iva = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    @Column(name = "descuento_porcentaje", precision = 5, scale = 2)
    private BigDecimal descuentoPorcentaje = BigDecimal.ZERO;

    @Column(name = "descuento_monto", precision = 12, scale = 2)
    private BigDecimal descuentoMonto = BigDecimal.ZERO;

    @Column(columnDefinition = "TEXT")
    private String notas;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private EstadoCotizacion estado = EstadoCotizacion.BORRADOR;

    @Column(name = "pdf_url", columnDefinition = "TEXT")
    private String pdfUrl;

    @OneToMany(mappedBy = "cotizacion", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CotizacionDetalle> detalles = new ArrayList<>();

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    public enum EstadoCotizacion {
        BORRADOR, ENVIADA, APROBADA, RECHAZADA, VENCIDA
    }

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
        updatedAt = OffsetDateTime.now();
        if (fechaCotizacion == null) fechaCotizacion = LocalDate.now();
        if (fechaVigencia == null) fechaVigencia = LocalDate.now().plusDays(30);
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    // Métodos auxiliares
    public void agregarDetalle(CotizacionDetalle detalle) {
        detalles.add(detalle);
        detalle.setCotizacion(this);
    }

    public void removerDetalle(CotizacionDetalle detalle) {
        detalles.remove(detalle);
        detalle.setCotizacion(null);
    }

    // Getters y Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getNumero() { return numero; }
    public void setNumero(String numero) { this.numero = numero; }
    public Cliente getCliente() { return cliente; }
    public void setCliente(Cliente cliente) { this.cliente = cliente; }
    public PerfilUsuario getUsuario() { return usuario; }
    public void setUsuario(PerfilUsuario usuario) { this.usuario = usuario; }
    public LocalDate getFechaCotizacion() { return fechaCotizacion; }
    public void setFechaCotizacion(LocalDate fechaCotizacion) { this.fechaCotizacion = fechaCotizacion; }
    public LocalDate getFechaVigencia() { return fechaVigencia; }
    public void setFechaVigencia(LocalDate fechaVigencia) { this.fechaVigencia = fechaVigencia; }
    public BigDecimal getSubtotal() { return subtotal; }
    public void setSubtotal(BigDecimal subtotal) { this.subtotal = subtotal; }
    public BigDecimal getIva() { return iva; }
    public void setIva(BigDecimal iva) { this.iva = iva; }
    public BigDecimal getTotal() { return total; }
    public void setTotal(BigDecimal total) { this.total = total; }
    public BigDecimal getDescuentoPorcentaje() { return descuentoPorcentaje; }
    public void setDescuentoPorcentaje(BigDecimal descuentoPorcentaje) { this.descuentoPorcentaje = descuentoPorcentaje; }
    public BigDecimal getDescuentoMonto() { return descuentoMonto; }
    public void setDescuentoMonto(BigDecimal descuentoMonto) { this.descuentoMonto = descuentoMonto; }
    public String getNotas() { return notas; }
    public void setNotas(String notas) { this.notas = notas; }
    public EstadoCotizacion getEstado() { return estado; }
    public void setEstado(EstadoCotizacion estado) { this.estado = estado; }
    public String getPdfUrl() { return pdfUrl; }
    public void setPdfUrl(String pdfUrl) { this.pdfUrl = pdfUrl; }
    public List<CotizacionDetalle> getDetalles() { return detalles; }
    public void setDetalles(List<CotizacionDetalle> detalles) { this.detalles = detalles; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
