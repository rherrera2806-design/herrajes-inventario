package com.herrajes.repository;

import com.herrajes.model.Producto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductoRepository extends JpaRepository<Producto, UUID> {

    Optional<Producto> findByCodigo(String codigo);

    boolean existsByCodigo(String codigo);

    List<Producto> findByNombreContainingIgnoreCase(String nombre);

    List<Producto> findByCategoriaId(UUID categoriaId);

    List<Producto> findByProveedorId(UUID proveedorId);

    List<Producto> findByActivoTrue();

    // ============================================================
    // QUERY CRÍTICO: Productos con stock por debajo del mínimo
    // ============================================================
    @Query("SELECT p FROM Producto p WHERE p.stockActual <= p.stockMinimo AND p.activo = true ORDER BY p.stockActual ASC")
    List<Producto> findProductosConStockCritico();

    // ============================================================
    // QUERY: Productos sin stock (agotados)
    // ============================================================
    @Query("SELECT p FROM Producto p WHERE p.stockActual = 0 AND p.activo = true")
    List<Producto> findProductosAgotados();

    // ============================================================
    // QUERY: Productos con stock bajo (hasta 150% del mínimo)
    // ============================================================
    @Query("SELECT p FROM Producto p WHERE p.stockActual > 0 AND p.stockActual <= (p.stockMinimo * 1.5) AND p.activo = true ORDER BY p.stockActual ASC")
    List<Producto> findProductosConStockBajo();

    // ============================================================
    // QUERY: Valor total del inventario
    // ============================================================
    @Query("SELECT COALESCE(SUM(p.stockActual * p.precioVenta), 0) FROM Producto p WHERE p.activo = true")
    java.math.BigDecimal calcularValorTotalInventario();

    // ============================================================
    // QUERY: Productos por categoría con stock crítico
    // ============================================================
    @Query("SELECT p FROM Producto p WHERE p.categoriaId = :categoriaId AND p.stockActual <= p.stockMinimo AND p.activo = true")
    List<Producto> findStockCriticoPorCategoria(@Param("categoriaId") UUID categoriaId);

    // ============================================================
    // QUERY: Top N productos más vendidos (por movimientos de salida)
    // ============================================================
    @Query(value = """
        SELECT p.* FROM productos p
        INNER JOIN movimientos_stock ms ON ms.producto_id = p.id
        WHERE ms.tipo_movimiento = 'salida'
        GROUP BY p.id
        ORDER BY SUM(ms.cantidad) DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Producto> findProductosMasVendidos(@Param("limit") int limit);
}
