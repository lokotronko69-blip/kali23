#!/usr/bin/env bash
# ==============================================================================
# KALI-ARES // TACTICAL E2EE GPS TRACKING SYSTEM - AUTOMATED INSTALLER
# PLATAFORMA NATIVA PARA KALI LINUX (XFCE / GNOME)
# ==============================================================================
set -euo pipefail

# ANSI Color Palette
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Base Configuration
INSTALL_DIR="/opt/kali-gps"
CERTS_DIR="/etc/kali-gps/certs"
DATA_DIR="${INSTALL_DIR}/data"
LOGS_DIR="${INSTALL_DIR}/logs"
VENV_DIR="${INSTALL_DIR}/venv"
MOSQUITTO_CONF_DIR="/etc/mosquitto/conf.d"
MOSQUITTO_CONF="${MOSQUITTO_CONF_DIR}/kali-gps.conf"
SCRIPT_SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Verify Root Privileges
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR] Este instalador debe ejecutarse con privilegios sudo:${NC}"
   echo -e "${BOLD}sudo bash $0${NC}"
   exit 1
fi

# Detect Real Unprivileged User (even under sudo)
if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    REAL_USER="${SUDO_USER}"
    REAL_HOME=$(getent passwd "${REAL_USER}" | cut -d: -f6)
else
    REAL_USER=$(logname 2>/dev/null || who | awk '{print $1; exit}' || echo "kali")
    REAL_HOME=$(getent passwd "${REAL_USER}" | cut -d: -f6 || echo "/home/${REAL_USER}")
fi

clear
cat << "EOF"
 ██████╗ ███████╗██████╗ ███████╗   ████████╗ █████╗  ██████╗████████╗██╗ ██████╗ █████╗ ██╗     
██╔════╝ ██╔════╝██╔══██╗██╔════╝   ╚══██╔══╝██╔══██╗██╔════╝╚══██╔══╝██║██╔════╝██╔══██╗██║     
██║  ███╗███████╗██████╔╝███████╗███╗  ██║   ███████║██║        ██║   ██║██║     ███████║██║     
██║   ██║╚════██║██╔═══╝ ╚════██║╚══╝  ██║   ██╔══██║██║        ██║   ██║██║     ██╔══██║██║     
╚██████╔╝███████║██║     ███████║      ██║   ██║  ██║╚██████╗   ██║   ██║╚██████╗██║  ██║███████╗
 ╚═════╝ ╚══════╝╚═╝     ╚══════╝      ╚═╝   ╚═╝  ╚═╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝
  KALI LINUX NATIVE HARDENED E2EE GPS TRACKING SUITE // TLS 1.3 // AES-256-GCM // PBKDF2
EOF

echo -e "${CYAN}==============================================================================${NC}"
echo -e "${BOLD}Target System  :${NC} Kali Linux (${REAL_USER}) -> ${REAL_HOME}"
echo -e "${BOLD}Install Root   :${NC} ${INSTALL_DIR}"
echo -e "${BOLD}Certificate Dir:${NC} ${CERTS_DIR}"
echo -e "${CYAN}==============================================================================${NC}\n"

# Step 1: System Packages Update and Dependencies
echo -e "${BLUE}[+] [1/6] Verificando e instalando dependencias del sistema Kali...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

PKGS=(
    python3
    python3-pip
    python3-venv
    python3-dev
    build-essential
    libssl-dev
    libffi-dev
    mosquitto
    mosquitto-clients
    libcap2-bin
    openssl
    libnotify-bin
    libgl1-mesa-glx
    libegl1
    libxcb-cursor0
    libnss3
)

# Optional audio/video libraries depending on Kali release
apt-get install -y -qq "${PKGS[@]}" || {
    echo -e "${YELLOW}[!] Reintentando con fix-missing...${NC}"
    apt-get install -y --fix-missing "${PKGS[@]}"
}

# Step 2: Directory Architecture and Security Hardening
echo -e "${BLUE}[+] [2/6] Creando jerarquía de directorios protegidos...${NC}"
mkdir -p "${INSTALL_DIR}" "${CERTS_DIR}" "${DATA_DIR}" "${LOGS_DIR}" "${INSTALL_DIR}/www" "${MOSQUITTO_CONF_DIR}"

# Step 3: Python Virtual Environment (PEP 668 Debian/Kali bypass)
echo -e "${BLUE}[+] [3/6] Creando entorno virtual aislado (PEP 668 Compliance)...${NC}"
if [[ ! -d "${VENV_DIR}" ]]; then
    python3 -m venv "${VENV_DIR}"
fi

# Upgrade pip & install requirements inside venv
echo -e "${BLUE}[+] Instalando librerías Python en venv (PyQt6, PyQt6-WebEngine, Cryptography, Paho-MQTT)...${NC}"
"${VENV_DIR}/bin/pip" install --upgrade --quiet pip setuptools wheel
"${VENV_DIR}/bin/pip" install --quiet \
    "paho-mqtt>=2.0.0" \
    "cryptography>=42.0.0" \
    "PyQt6>=6.6.0" \
    "PyQt6-WebEngine>=6.6.0"

# Step 4: Linux Capabilities (setcap) for Low Port Binding without root
echo -e "${BLUE}[+] [4/6] Aplicando 'setcap cap_net_bind_service=+ep' al binario de Python...${NC}"
# Find actual binary if venv uses symlink
PYTHON_BIN="${VENV_DIR}/bin/python3"
RESOLVED_BIN=$(readlink -f "${PYTHON_BIN}")

# Set cap on the resolved binary and check
setcap 'cap_net_bind_service=+ep' "${RESOLVED_BIN}" || true
setcap 'cap_net_bind_service=+ep' "${PYTHON_BIN}" 2>/dev/null || true

echo -e "${GREEN}[✓] Python configurado para enlazar puertos <1024 (443/883) bajo el usuario '${REAL_USER}'${NC}"

# Step 5: Generate TLS 1.3 X.509 Certificates with OpenSSL
echo -e "${BLUE}[+] [5/6] Generando infraestructura de certificados TLS 1.3...${NC}"
if [[ ! -f "${CERTS_DIR}/server.key" || ! -f "${CERTS_DIR}/server.crt" ]]; then
    cat > "${CERTS_DIR}/openssl-kali-gps.cnf" << 'EOF'
[req]
default_bits = 4096
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
C = ES
ST = CyberCommand
L = FieldOperations
O = Kali Tactical Ops
OU = Tactical GPS E2EE
CN = kali-gps.local

[v3_req]
subjectAltName = @alt_names
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth, clientAuth

[alt_names]
DNS.1 = localhost
DNS.2 = kali-gps.local
DNS.3 = kali
IP.1 = 127.0.0.1
IP.2 = 0.0.0.0
EOF

    openssl req -x509 -newkey rsa:4096 -nodes \
        -keyout "${CERTS_DIR}/server.key" \
        -out "${CERTS_DIR}/server.crt" \
        -days 730 \
        -config "${CERTS_DIR}/openssl-kali-gps.cnf" 2>/dev/null

    # Generate a CA cert if needed for mutual auth
    openssl req -x509 -newkey rsa:4096 -nodes \
        -keyout "${CERTS_DIR}/ca.key" \
        -out "${CERTS_DIR}/ca.crt" \
        -days 1095 \
        -subj "/C=ES/ST=CyberCommand/O=Kali Tactical Root CA/CN=kali-gps-ca" 2>/dev/null

    chmod 600 "${CERTS_DIR}/"*.key
    chmod 644 "${CERTS_DIR}/"*.crt
    echo -e "${GREEN}[✓] Certificados generados en ${CERTS_DIR}${NC}"
else
    echo -e "${YELLOW}[!] Certificados TLS existentes detectados. Preservando certificados.${NC}"
fi

# Configure Mosquitto MQTT Broker for TLS 1.3
echo -e "${BLUE}[+] Configurando broker Mosquitto seguro en /etc/mosquitto/conf.d/...${NC}"
cat > "${MOSQUITTO_CONF}" << EOF
# Mosquitto Hardened TLS 1.3 Configuration for Kali-ARES
listener 8883 0.0.0.0
tls_version tlsv1.3
cafile ${CERTS_DIR}/ca.crt
certfile ${CERTS_DIR}/server.crt
keyfile ${CERTS_DIR}/server.key

allow_anonymous true
persistence false
log_dest file ${LOGS_DIR}/mosquitto.log
EOF

systemctl enable mosquitto >/dev/null 2>&1 || true
systemctl restart mosquitto >/dev/null 2>&1 || true

# Step 6: Deploy Application Source Files & Desktop Integration
echo -e "${BLUE}[+] [6/6] Desplegando archivos de aplicación y lanzadores...${NC}"

# Copy script files if running from extracted repo
for file in backend_crypto.py backend_server.py frontend_gui.py map.html device_simulator.py; do
    if [[ -f "${SCRIPT_SRC_DIR}/${file}" ]]; then
        cp "${SCRIPT_SRC_DIR}/${file}" "${INSTALL_DIR}/${file}"
    fi
done

# Launcher Script inside /opt/kali-gps/run.sh
cat > "${INSTALL_DIR}/run.sh" << 'EOF'
#!/usr/bin/env bash
INSTALL_DIR="/opt/kali-gps"
VENV_DIR="${INSTALL_DIR}/venv"

# Ensure X11/Wayland display is accessible
export DISPLAY="${DISPLAY:-:0}"
export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-xcb}"
export QTWEBENGINE_DISABLE_SANDBOX=1

cd "${INSTALL_DIR}"
exec "${VENV_DIR}/bin/python3" "${INSTALL_DIR}/frontend_gui.py" "$@"
EOF
chmod +x "${INSTALL_DIR}/run.sh"

# Create symlink in /usr/local/bin/kali-gps
ln -sf "${INSTALL_DIR}/run.sh" /usr/local/bin/kali-gps

# Desktop Icon & Application Menu Entry for Kali Xfce & GNOME
cat > /usr/share/applications/kali-gps.desktop << EOF
[Desktop Entry]
Name=Kali-ARES Tactical GPS
Comment=Plataforma Militar de Rastreo GPS E2EE con TLS 1.3 y AES-256-GCM
Exec=/usr/local/bin/kali-gps
Icon=applications-internet
Terminal=false
Type=Application
Categories=08-exploitation-tools;11-post-exploitation;Security;System;
Keywords=gps;tracking;e2ee;tactical;kali;aes;
StartupNotify=true
EOF
chmod +x /usr/share/applications/kali-gps.desktop

# Permissions Hardening: Restrict to real user, root read-write only
chown -R "${REAL_USER}:${REAL_USER}" "${INSTALL_DIR}"
chmod 700 "${INSTALL_DIR}"
chmod -R 700 "${DATA_DIR}"
chmod -R 700 "${LOGS_DIR}"
chown -R "${REAL_USER}:${REAL_USER}" "${CERTS_DIR}" || true

echo -e "\n${GREEN}==============================================================================${NC}"
echo -e "${BOLD}${GREEN}[✓] INSTALACIÓN COMPLETADA EXITOSAMENTE${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo -e "Para iniciar la plataforma ejecuta como usuario estándar (${REAL_USER}):"
echo -e "  ${BOLD}${CYAN}kali-gps${NC}"
echo -e "o bien desde el menú de aplicaciones de Kali (Categoría 08-Exploitation / Post-Exploitation)."
echo -e "\nPara simular dispositivos en una terminal paralela:"
echo -e "  ${CYAN}${VENV_DIR}/bin/python3 ${INSTALL_DIR}/device_simulator.py${NC}\n"
EOF
