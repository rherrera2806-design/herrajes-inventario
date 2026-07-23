package com.herrajes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.io.File;
import java.util.List;

// ============================================================
// SERVICIO: Envío de Emails
// ============================================================
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String remitente;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    // ============================================================
    // 1. Enviar email simple (texto)
    // ============================================================
    public void enviarEmail(String para, String asunto, String cuerpo) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(remitente);
            helper.setTo(para);
            helper.setSubject(asunto);
            helper.setText(cuerpo, false);

            mailSender.send(message);
            log.info("Email enviado a: {} - Asunto: {}", para, asunto);
        } catch (MessagingException e) {
            log.error("Error al enviar email a {}: {}", para, e.getMessage());
            throw new RuntimeException("Error al enviar email", e);
        }
    }

    // ============================================================
    // 2. Enviar email HTML
    // ============================================================
    public void enviarEmailHtml(String para, String asunto, String htmlCuerpo) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(remitente);
            helper.setTo(para);
            helper.setSubject(asunto);
            helper.setText(htmlCuerpo, true);

            mailSender.send(message);
            log.info("Email HTML enviado a: {} - Asunto: {}", para, asunto);
        } catch (MessagingException e) {
            log.error("Error al enviar email HTML a {}: {}", para, e.getMessage());
            throw new RuntimeException("Error al enviar email", e);
        }
    }

    // ============================================================
    // 3. Enviar email con PDF adjunto (Cotización)
    // ============================================================
    public void enviarCotizacionPdf(List<String> destinatarios, String numeroCotizacion,
                                     File archivoPdf, String nombreCliente) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(remitente);
            helper.setTo(destinatarios.toArray(new String[0]));
            helper.setSubject("Cotización " + numeroCotizacion + " - Herrajes");

            String html = construirHtmlCotizacion(numeroCotizacion, nombreCliente);
            helper.setText(html, true);

            // Adjuntar el PDF
            if (archivoPdf.exists()) {
                helper.addAttachment(numeroCotizacion + ".pdf", archivoPdf);
            }

            mailSender.send(message);
            log.info("Cotización {} enviada a: {}", numeroCotizacion, destinatarios);
        } catch (MessagingException e) {
            log.error("Error al enviar cotización {}: {}", numeroCotizacion, e.getMessage());
            throw new RuntimeException("Error al enviar cotización por email", e);
        }
    }

    // ============================================================
    // 4. Enviar alerta de stock crítico
    // ============================================================
    public void enviarAlertaStockCritico(List<String> destinatarios, String asunto, String htmlCuerpo) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(remitente);
            helper.setTo(destinatarios.toArray(new String[0]));
            helper.setSubject(asunto);
            helper.setText(htmlCuerpo, true);

            mailSender.send(message);
            log.info("Alerta de stock crítico enviada a: {}", destinatarios);
        } catch (MessagingException e) {
            log.error("Error al enviar alerta: {}", e.getMessage());
            throw new RuntimeException("Error al enviar alerta", e);
        }
    }

    // ============================================================
    // HTML de la cotización para el email
    // ============================================================
    private String construirHtmlCotizacion(String numero, String nombreCliente) {
        return """
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #1a237e; color: white; padding: 20px; text-align: center;">
                    <h1 style="margin: 0;">Sistema de Herrajes</h1>
                    <p style="margin: 5px 0 0 0;">Gestión de Inventario y Cotizaciones</p>
                </div>
                <div style="padding: 20px; border: 1px solid #ddd;">
                    <h2>Cotización: %s</h2>
                    <p>Estimado/a <strong>%s</strong>,</p>
                    <p>Adjunto encontrará el archivo PDF con el detalle de su cotización.</p>
                    <p>Si tiene alguna duda o comentario, no dude en contactarnos.</p>
                    <hr style="margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">
                        Este es un correo automático generado por el Sistema de Gestión de Inventario.
                    </p>
                </div>
            </body>
            </html>
            """.formatted(numero, nombreCliente);
    }
}
