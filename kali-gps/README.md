# KALI-ARES // TACTICAL E2EE GPS TRACKING SUITE
### Plataforma Nativa Militar para Kali Linux (Xfce / GNOME)

---

## 🛡️ Arquitectura y Hardening de Seguridad

1. **Cumplimiento PEP 668 (Debian/Kali externally-managed-environment):**
   - Instalación aislada en `/opt/kali-gps/venv` sin alterar los paquetes del sistema base.
2. **Capacidades Linux sin Privilegios Root (`setcap`):**
   - Se asigna `cap_net_bind_service=+ep` al binario Python del entorno virtual. Esto permite abrir sockets de escucha en puertos privilegiados (< 1024 como 443 o 883) bajo el usuario no privilegiado (`kali`), evitando ejecutar interfaces gráficas X11 como root.
3. **Cifrado Militar de Bóveda Local (PBKDF2-HMAC-SHA256 + AES-256-GCM):**
   - La contraseña maestra deriva una clave KEK de 256 bits tras **600,000 iteraciones** con sal aleatoria de 16 bytes.
   - El almacén `/opt/kali-gps/data/vault.enc` se cifra con AES-256-GCM y nonce de 96 bits. Si la contraseña falla, el tag de autenticación GCM detiene la ejecución inmediatamente.
4. **Cifrado en Tránsito y Wire Telemetry (E2EE):**
   - Capa de transporte protegida con **TLS 1.3 estricto** y certificados X.509 de 4096 bits en `/etc/kali-gps/certs/`.
   - Cifrado de extremo a extremo de cada trama con AES-256-GCM mediante claves pre-compartidas por dispositivo.
5. **Broker de Mensajería Mosquitto Local:**
   - Configurado en `/etc/mosquitto/conf.d/kali-gps.conf` con TLS 1.3 y aislamiento.

---

## 🚀 Instalación en un Solo Comando

```bash
git clone https://github.com/kali-ares/kali-gps.git /opt/kali-gps
cd /opt/kali-gps
sudo bash install.sh
```

O descarga directa en un solo comando:
```bash
curl -sSL https://raw.githubusercontent.com/kali-ares/kali-gps/main/install.sh | sudo bash
```

---

## 🎮 Ejecución

Una vez completada la instalación, inicia la plataforma desde tu terminal habitual:
```bash
kali-gps
```
O selecciónala desde el menú de aplicaciones de Kali Linux en **08 - Exploitation Tools** o **11 - Post Exploitation**.

### Prueba de Campo y Simulación de Dispositivos:
En otra pestaña de la terminal:
```bash
/opt/kali-gps/venv/bin/python3 /opt/kali-gps/device_simulator.py --password "TuContraseñaMaestra"
```
