package com.herrajes;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

// ============================================================
// CLASE PRINCIPAL - Sistema de Inventario y Cotizaciones
// PYME de Herrajes para Vidrio
// ============================================================
@SpringBootApplication
@EnableScheduling  // Habilitar tareas programadas (alertas de stock)
public class SistemaHerrajesApplication {

    public static void main(String[] args) {
        SpringApplication.run(SistemaHerrajesApplication.class, args);
    }
}
