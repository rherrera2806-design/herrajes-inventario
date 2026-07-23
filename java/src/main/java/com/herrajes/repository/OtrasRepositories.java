package com.herrajes.repository;

import com.herrajes.model.Categoria;
import com.herrajes.model.Cliente;
import com.herrajes.model.MovimientoStock;
import com.herrajes.model.Proveedor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

// ============================================================
// Repositorio: Categorías
// ============================================================
@Repository
interface CategoriaRepository extends JpaRepository<Categoria, UUID> {
    Categoria findByNombre(String nombre);
    boolean existsByNombre(String nombre);
}

// ============================================================
// Repositorio: Proveedores
// ============================================================
@Repository
interface ProveedorRepository extends JpaRepository<Proveedor, UUID> {
    List<Proveedor> findByNombreContainingIgnoreCase(String nombre);
    List<Proveedor> findByActivoTrue();
}

// ============================================================
// Repositorio: Clientes
// ============================================================
@Repository
interface ClienteRepository extends JpaRepository<Cliente, UUID> {
    List<Cliente> findByNombreContainingIgnoreCase(String nombre);
    List<Cliente> findByActivoTrue();
    Cliente findByRfc(String rfc);
}

// ============================================================
// Repositorio: Movimientos de Stock
// ============================================================
@Repository
interface MovimientoStockRepository extends JpaRepository<MovimientoStock, UUID> {

    List<MovimientoStock> findByProductoId(UUID productoId);

    List<MovimientoStock> findByTipoMovimiento(MovimientoStock.TipoMovimiento tipo);

    // ============================================================
    // QUERY: Movimientos en un rango de fechas
    // ============================================================
    @Query("SELECT m FROM MovimientoStock m WHERE m.createdAt BETWEEN :inicio AND :fin ORDER BY m.createdAt DESC")
    List<MovimientoStock> findByRangoFechas(
            @Param("inicio") OffsetDateTime inicio,
            @Param("fin") OffsetDateTime fin);

    // ============================================================
    // QUERY: Total de entradas por producto en el mes
    // ============================================================
    @Query("SELECT COALESCE(SUM(m.cantidad), 0) FROM MovimientoStock m WHERE m.producto.id = :productoId AND m.tipoMovimiento = 'entrada' AND m.createdAt >= :desde")
    Integer totalEntradasDesde(@Param("productoId") UUID productoId, @Param("desde") OffsetDateTime desde);

    // ============================================================
    // QUERY: Total de salidas por producto en el mes
    // ============================================================
    @Query("SELECT COALESCE(SUM(m.cantidad), 0) FROM MovimientoStock m WHERE m.producto.id = :productoId AND m.tipoMovimiento = 'salida' AND m.createdAt >= :desde")
    Integer totalSalidasDesde(@Param("productoId") UUID productoId, @Param("desde") OffsetDateTime desde);
}

// ============================================================
// Repositorio: Perfil de Usuario
// ============================================================
@Repository
interface PerfilUsuarioRepository extends JpaRepository<com.herrajes.model.PerfilUsuario, UUID> {
    com.herrajes.model.PerfilUsuario findByUserId(UUID userId);
    List<com.herrajes.model.PerfilUsuario> findByRol(com.herrajes.model.PerfilUsuario.Rol rol);
}
