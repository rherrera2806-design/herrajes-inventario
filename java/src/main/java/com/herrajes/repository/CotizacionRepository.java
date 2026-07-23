package com.herrajes.repository;

import com.herrajes.model.Cotizacion;
import com.herrajes.model.CotizacionDetalle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface CotizacionRepository extends JpaRepository<Cotizacion, UUID> {

    List<Cotizacion> findByClienteId(UUID clienteId);

    List<Cotizacion> findByEstado(Cotizacion.EstadoCotizacion estado);

    List<Cotizacion> findByUsuarioId(UUID usuarioId);

    Cotizacion findByNumero(String numero);

    boolean existsByNumero(String numero);

    // ============================================================
    // QUERY: Cotizaciones próximas a vencer (3 días)
    // ============================================================
    @Query("SELECT c FROM Cotizacion c WHERE c.fechaVigencia <= :fechaLimite AND c.estado = 'enviada'")
    List<Cotizacion> findCotizacionesProximasAVencer(@Param("fechaLimite") LocalDate fechaLimite);

    // ============================================================
    // QUERY: Ventas totales del mes actual
    // ============================================================
    @Query("SELECT COALESCE(SUM(c.total), 0) FROM Cotizacion c WHERE c.estado = 'aprobada' AND c.fechaCotizacion BETWEEN :inicio AND :fin")
    java.math.BigDecimal calcularVentasTotales(@Param("inicio") LocalDate inicio, @Param("fin") LocalDate fin);

    // ============================================================
    // QUERY: Número de cotizaciones por estado
    // ============================================================
    @Query("SELECT c.estado, COUNT(c) FROM Cotizacion c GROUP BY c.estado")
    List<Object[]> contarCotizacionesPorEstado();
}

@Repository
interface CotizacionDetalleRepository extends JpaRepository<CotizacionDetalle, UUID> {

    List<CotizacionDetalle> findByCotizacionId(UUID cotizacionId);

    @Query("SELECT d FROM CotizacionDetalle d WHERE d.producto.id = :productoId")
    List<CotizacionDetalle> findByProductoId(@Param("productoId") UUID productoId);
}
