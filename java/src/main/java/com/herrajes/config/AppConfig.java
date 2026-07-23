package com.herrajes.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

// ============================================================
// Configuración general del sistema
// ============================================================
@Configuration
@EnableScheduling
public class AppConfig {
    // Las configuraciones se cargan desde application.properties
    // Este archivo es para configuraciones adicionales de beans
}
