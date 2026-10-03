#!/usr/bin/env python3
"""
================================================================================
KALI-ARES // TACTICAL E2EE GPS TRACKING GUI (PYQT6 + LEAFLET.JS)
================================================================================
Native desktop interface for Kali Linux (Xfce / GNOME).
Includes PBKDF2 Master Password Vault Setup/Login, QWebEngineView offline map,
QWebChannel bridge, real-time decryptor console, and libnotify integration.
================================================================================
"""

import sys
import os
import json
import subprocess
from typing import Dict, Any, Optional

from PyQt6.QtCore import (
    Qt, pyqtSignal, pyqtSlot, QObject, QUrl, QTimer, QSize
)
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QLineEdit, QPushButton, QTableWidget, QTableWidgetItem,
    QHeaderView, QSplitter, QTextEdit, QDialog, QMessageBox,
    QProgressBar, QFrame, QGroupBox, QStatusBar
)
from PyQt6.QtGui import QIcon, QFont, QColor, QPalette
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebChannel import QWebChannel

import backend_crypto
from backend_server import TacticalIngestServer


# QWebChannel Bridge to communicate bidirectionally with Leaflet map
class MapBridge(QObject):
    assetClicked = pyqtSignal(str)

    @pyqtSlot(str)
    def onMarkerSelected(self, device_id: str):
        self.assetClicked.emit(device_id)


# Dialog: Initial Master Password Setup
class MasterPasswordSetupDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("KALI-ARES // Inicialización de Bóveda Criptográfica")
        self.setFixedSize(520, 380)
        self.setStyleSheet("""
            QDialog { background-color: #0b111e; color: #f1f5f9; font-family: monospace; }
            QLabel { color: #cbd5e1; }
            QLineEdit { background-color: #1e293b; border: 1px solid #10b981; color: #38bdf8; padding: 8px; border-radius: 4px; font-size: 13px; }
            QLineEdit:focus { border: 2px solid #34d399; }
            QPushButton { background-color: #10b981; color: #022c22; font-weight: bold; padding: 10px; border-radius: 4px; font-size: 13px; }
            QPushButton:hover { background-color: #34d399; }
            QGroupBox { border: 1px solid #334155; border-radius: 6px; margin-top: 12px; padding: 12px; font-weight: bold; color: #10b981; }
        """)
        self.master_password = None
        self._build_ui()

    def _build_ui(self):
        layout = QVBoxLayout(self)

        title = QLabel("CONFIGURACIÓN DE BÓVEDA LOCAL // E2EE")
        title.setFont(QFont("Monospace", 13, QFont.Weight.Bold))
        title.setStyleSheet("color: #10b981;")
        layout.addWidget(title)

        desc = QLabel(
            "Se derivará una clave de cifrado (KEK) usando PBKDF2-HMAC-SHA256 con "
            "600,000 iteraciones para proteger el almacén AES-256-GCM.\n"
            "La contraseña maestra NUNCA se almacenará en disco."
        )
        desc.setWordWrap(True)
        desc.setStyleSheet("color: #94a3b8; font-size: 11px;")
        layout.addWidget(desc)

        box = QGroupBox("CREAR CONTRASEÑA MAESTRA")
        box_layout = QVBoxLayout(box)

        box_layout.addWidget(QLabel("Nueva Contraseña Maestra (Mínimo 8 caracteres):"))
        self.txt_pass = QLineEdit()
        self.txt_pass.setEchoMode(QLineEdit.EchoMode.Password)
        self.txt_pass.setPlaceholderText("Introduce contraseña robusta...")
        box_layout.addWidget(self.txt_pass)

        box_layout.addWidget(QLabel("Confirmar Contraseña Maestra:"))
        self.txt_confirm = QLineEdit()
        self.txt_confirm.setEchoMode(QLineEdit.EchoMode.Password)
        self.txt_confirm.setPlaceholderText("Repite la contraseña...")
        box_layout.addWidget(self.txt_confirm)

        layout.addWidget(box)

        self.btn_create = QPushButton("INICIALIZAR Y CIFRAR BÓVEDA")
        self.btn_create.clicked.connect(self._handle_create)
        layout.addWidget(self.btn_create)

    def _handle_create(self):
        p1 = self.txt_pass.text()
        p2 = self.txt_confirm.text()

        if len(p1) < 8:
            QMessageBox.warning(self, "Contraseña Débil", "La contraseña maestra debe contener al menos 8 caracteres.")
            return
        if p1 != p2:
            QMessageBox.warning(self, "No Coinciden", "Las contraseñas ingresadas no coinciden.")
            return

        self.master_password = p1
        self.accept()


# Dialog: Master Password Login
class MasterPasswordLoginDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("KALI-ARES // Autenticación de Bóveda")
        self.setFixedSize(480, 290)
        self.setStyleSheet("""
            QDialog { background-color: #0b111e; color: #f1f5f9; font-family: monospace; }
            QLabel { color: #cbd5e1; }
            QLineEdit { background-color: #1e293b; border: 1px solid #10b981; color: #38bdf8; padding: 10px; border-radius: 4px; font-size: 14px; }
            QPushButton { background-color: #10b981; color: #022c22; font-weight: bold; padding: 10px; border-radius: 4px; font-size: 13px; }
            QPushButton:hover { background-color: #34d399; }
        """)
        self.master_password = None
        self._build_ui()

    def _build_ui(self):
        layout = QVBoxLayout(self)

        title = QLabel("ACCESO A PLATAFORMA TÁCTICA")
        title.setFont(QFont("Monospace", 13, QFont.Weight.Bold))
        title.setStyleSheet("color: #10b981;")
        layout.addWidget(title)

        desc = QLabel(
            "Introduce la Contraseña Maestra para desbloquear la bóveda cifrada en /opt/kali-gps/data/vault.enc."
        )
        desc.setWordWrap(True)
        desc.setStyleSheet("color: #94a3b8; font-size: 11px;")
        layout.addWidget(desc)

        layout.addSpacing(10)
        layout.addWidget(QLabel("Contraseña Maestra:"))
        self.txt_pass = QLineEdit()
        self.txt_pass.setEchoMode(QLineEdit.EchoMode.Password)
        self.txt_pass.setPlaceholderText("••••••••••••••••")
        layout.addWidget(self.txt_pass)

        layout.addSpacing(15)
        self.btn_login = QPushButton("DESBLOQUEAR BÓVEDA (PBKDF2)")
        self.btn_login.clicked.connect(self._handle_login)
        layout.addWidget(self.btn_login)

        self.txt_pass.returnPressed.connect(self._handle_login)

    def _handle_login(self):
        p = self.txt_pass.text()
        if not p:
            QMessageBox.warning(self, "Entrada Requerida", "Debes ingresar la contraseña maestra.")
            return
        self.master_password = p
        self.accept()


# Main Tactical Window
class TacticalMainWindow(QMainWindow):
    telemetry_signal = pyqtSignal(dict, str)
    security_signal = pyqtSignal(str, str)

    def __init__(self, master_password: str, keystore_data: Dict[str, Any]):
        super().__init__()
        self.master_password = master_password
        self.keystore_data = keystore_data
        self.devices = keystore_data.get("devices", {})

        self.setWindowTitle("KALI-ARES // Centro de Mando Táctico E2EE - Kali Linux")
        self.resize(1380, 850)
        self.setStyleSheet("""
            QMainWindow { background-color: #070a12; color: #f1f5f9; font-family: monospace; }
            QTableWidget { background-color: #0b111e; border: 1px solid #1e293b; gridline-color: #1e293b; color: #e2e8f0; selection-background-color: #10b981; selection-color: #022c22; font-size: 11px; }
            QHeaderView::section { background-color: #111827; color: #10b981; font-weight: bold; border: 1px solid #1e293b; padding: 4px; font-size: 11px; }
            QTextEdit { background-color: #070a12; border: 1px solid #1e293b; color: #34d399; font-family: 'Courier New', monospace; font-size: 11px; }
            QPushButton { background-color: #1e293b; border: 1px solid #334155; color: #38bdf8; padding: 6px 12px; border-radius: 4px; font-weight: bold; }
            QPushButton:hover { background-color: #10b981; color: #022c22; border-color: #10b981; }
            QStatusBar { background-color: #0b111e; color: #94a3b8; border-top: 1px solid #1e293b; }
        """)

        # Bridges and Signals
        self.telemetry_signal.connect(self._on_telemetry_ui)
        self.security_signal.connect(self._on_security_ui)

        self._build_ui()
        self._start_network_engine()

    def _build_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(8, 8, 8, 8)
        main_layout.setSpacing(6)

        # Header Bar
        header = QFrame()
        header.setStyleSheet("background-color: #0b111e; border: 1px solid #1e293b; border-radius: 6px; padding: 4px;")
        h_layout = QHBoxLayout(header)
        h_layout.setContentsMargins(12, 6, 12, 6)

        app_title = QLabel("KALI-ARES // TACTICAL E2EE OPERATIONS")
        app_title.setFont(QFont("Monospace", 12, QFont.Weight.Bold))
        app_title.setStyleSheet("color: #10b981;")
        h_layout.addWidget(app_title)

        status_tls = QLabel("TLS 1.3: ESTRICTO | AES-256-GCM: ACTIVO | PEP 668: OK")
        status_tls.setStyleSheet("color: #38bdf8; font-size: 11px;")
        h_layout.addWidget(status_tls)

        h_layout.addStretch()

        self.btn_pair = QPushButton("+ EMPAREJAR UNIDAD")
        self.btn_pair.clicked.connect(self._pair_new_device_dialog)
        h_layout.addWidget(self.btn_pair)

        self.btn_clear = QPushButton("LIMPIAR RUTAS")
        self.btn_clear.clicked.connect(self._clear_tracks)
        h_layout.addWidget(self.btn_clear)

        main_layout.addWidget(header)

        # Main Splitter (Left: Asset Table | Right: Leaflet Map)
        v_splitter = QSplitter(Qt.Orientation.Vertical)
        h_splitter = QSplitter(Qt.Orientation.Horizontal)

        # Left Panel (Asset Roster)
        left_widget = QWidget()
        left_layout = QVBoxLayout(left_widget)
        left_layout.setContentsMargins(0, 0, 0, 0)

        left_title = QLabel(f"UNIDADES REGISTRADAS ({len(self.devices)})")
        left_title.setStyleSheet("color: #94a3b8; font-weight: bold; font-size: 11px; padding: 2px;")
        left_layout.addWidget(left_title)

        self.table = QTableWidget()
        self.table.setColumnCount(6)
        self.table.setHorizontalHeaderLabels(["ID", "CALLSIGN", "TIPO", "ESTADO", "VEL (km/h)", "BATERÍA"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.cellDoubleClicked.connect(self._on_table_double_clicked)
        left_layout.addWidget(self.table)
        self._populate_table()

        h_splitter.addWidget(left_widget)

        # Right Panel: QWebEngineView (Leaflet Map)
        self.web_view = QWebEngineView()
        self.web_channel = QWebChannel()
        self.bridge = MapBridge()
        self.bridge.assetClicked.connect(self._on_map_asset_selected)
        self.web_channel.registerObject("pyqtBridge", self.bridge)
        self.web_view.page().setWebChannel(self.web_channel)

        # Load map.html
        map_path = os.path.join(os.path.dirname(__file__), "map.html")
        if not os.path.exists(map_path):
            map_path = "/opt/kali-gps/map.html"

        if os.path.exists(map_path):
            self.web_view.load(QUrl.fromLocalFile(map_path))
        else:
            self.web_view.setHtml("<h2>map.html no encontrado</h2>")

        h_splitter.addWidget(self.web_view)
        h_splitter.setSizes([450, 930])

        v_splitter.addWidget(h_splitter)

        # Bottom Drawer: Decryption Stream Console
        bottom_widget = QWidget()
        bottom_layout = QVBoxLayout(bottom_widget)
        bottom_layout.setContentsMargins(0, 4, 0, 0)

        bottom_title = QLabel("CONSOLA DE TELEMETRÍA CRIPTOGRÁFICA EN VIVO (AES-256-GCM WIRE AUDIT)")
        bottom_title.setStyleSheet("color: #10b981; font-weight: bold; font-size: 10px;")
        bottom_layout.addWidget(bottom_title)

        self.console = QTextEdit()
        self.console.setReadOnly(True)
        self.console.setMaximumHeight(150)
        self.console.append("[SYSTEM] Bóveda criptográfica desbloqueada. Escuchando sockets TLS 1.3 y MQTT...")
        bottom_layout.addWidget(self.console)

        v_splitter.addWidget(bottom_widget)
        v_splitter.setSizes([650, 150])

        main_layout.addWidget(v_splitter)

        # Status Bar
        self.status = QStatusBar()
        self.setStatusBar(self.status)
        self.status.showMessage("Sistema Operativo Kali Linux | Puertos activos: TCP 8443 / MQTT 8883 | Esperando tramas...")

    def _populate_table(self):
        self.table.setRowCount(len(self.devices))
        for row, (dev_id, info) in enumerate(self.devices.items()):
            self.table.setItem(row, 0, QTableWidgetItem(dev_id))
            self.table.setItem(row, 1, QTableWidgetItem(info.get("callsign", dev_id)))
            self.table.setItem(row, 2, QTableWidgetItem(info.get("type", "asset").upper()))
            
            st_item = QTableWidgetItem("ESPERANDO")
            st_item.setForeground(QColor("#94a3b8"))
            self.table.setItem(row, 3, st_item)

            self.table.setItem(row, 4, QTableWidgetItem("--"))
            self.table.setItem(row, 5, QTableWidgetItem("--"))

    def _start_network_engine(self):
        """Starts asynchronous server in background thread."""
        def on_telem(telemetry_dict, source):
            self.telemetry_signal.emit(telemetry_dict, source)

        def on_sec_alert(category, message):
            self.security_signal.emit(category, message)

        self.server = TacticalIngestServer(
            keystore_devices=self.devices,
            on_telemetry=on_telem,
            on_security_alert=on_sec_alert,
            tcp_port=8443,
            mqtt_enabled=True
        )
        self.server.start_background()

    def _on_telemetry_ui(self, telemetry: dict, source: str):
        dev_id = telemetry.get("device_id")
        lat = telemetry.get("lat")
        lon = telemetry.get("lon")
        speed = telemetry.get("speed", 0.0)
        battery = telemetry.get("battery", 100)
        status = telemetry.get("status", "NORMAL")

        # Update table
        for r in range(self.table.rowCount()):
            if self.table.item(r, 0).text() == dev_id:
                st_item = self.table.item(r, 3)
                st_item.setText(status)
                st_item.setForeground(QColor("#10b981" if status == "NORMAL" else "#ef4444"))
                self.table.item(r, 4).setText(f"{speed:.1f}")
                self.table.item(r, 5).setText(f"{battery}%")
                break

        # Log in console
        log_line = (
            f"[{source}] DEV:{dev_id} | POS:({lat:.4f}, {lon:.4f}) | "
            f"SPD:{speed:.1f}km/h | BAT:{battery}% | TAG:VALID✓"
        )
        self.console.append(log_line)

        # Send to Leaflet map in QWebEngineView
        js_code = f"if (window.updateAssetTelemetry) {{ window.updateAssetTelemetry({json.dumps(telemetry)}); }}"
        self.web_view.page().runJavaScript(js_code)

        # Trigger desktop libnotify alert if anomaly
        if status in ("ALERT", "JAMMING", "SOS"):
            self._notify_desktop(
                f"KALI-ARES // ALERTA TÁCTICA ({dev_id})",
                f"Unidad {telemetry.get('_callsign')} en estado {status} en ({lat:.4f}, {lon:.4f})"
            )

    def _on_security_ui(self, category: str, message: str):
        self.console.append(f"<span style='color: #ef4444;'>[SEGURIDAD] [{category}] {message}</span>")
        self._notify_desktop("KALI-ARES // INCIDENTE DE SEGURIDAD", message)

    def _notify_desktop(self, title: str, text: str):
        """Uses Kali Linux libnotify (notify-send) or fallback."""
        try:
            subprocess.Popen(["notify-send", "-u", "critical", "-a", "Kali-ARES", title, text])
        except Exception:
            pass

    def _on_table_double_clicked(self, row, col):
        dev_id = self.table.item(row, 0).text()
        js_code = f"if (window.centerOnAsset) {{ window.centerOnAsset('{dev_id}'); }}"
        self.web_view.page().runJavaScript(js_code)

    def _on_map_asset_selected(self, dev_id: str):
        for r in range(self.table.rowCount()):
            if self.table.item(r, 0).text() == dev_id:
                self.table.selectRow(r)
                break

    def _clear_tracks(self):
        self.web_view.page().runJavaScript("if (window.clearAllTracks) { window.clearAllTracks(); }")

    def _pair_new_device_dialog(self):
        """Modal to add a new device pre-shared key to the encrypted keystore."""
        dlg = QDialog(self)
        dlg.setWindowTitle("Emparejar Nueva Unidad Táctica")
        dlg.setFixedSize(420, 260)
        dlg.setStyleSheet(self.styleSheet())
        layout = QVBoxLayout(dlg)

        layout.addWidget(QLabel("ID del Dispositivo (ej. RECON-03):"))
        txt_id = QLineEdit()
        layout.addWidget(txt_id)

        layout.addWidget(QLabel("Nombre / Callsign (ej. SPECTRE-3):"))
        txt_name = QLineEdit()
        layout.addWidget(txt_name)

        btn_gen = QPushButton("GENERAR CLAVE SIMÉTRICA AES-256")
        layout.addWidget(btn_gen)

        def save():
            new_id = txt_id.text().strip().upper()
            new_name = txt_name.text().strip() or new_id
            if not new_id:
                return
            new_key = os.urandom(32).hex()
            self.devices[new_id] = {
                "name": new_name,
                "callsign": new_name,
                "type": "operative",
                "key_hex": new_key,
                "paired_at": 1700000000
            }
            backend_crypto.save_keystore(self.master_password, self.keystore_data)
            self.server.update_keys(self.devices)
            self._populate_table()
            QMessageBox.information(
                dlg,
                "Unidad Emparejada",
                f"Dispositivo {new_id} registrado con éxito.\nClave Simétrica:\n{new_key}"
            )
            dlg.accept()

        btn_gen.clicked.connect(save)
        dlg.exec()

    def closeEvent(self, event):
        if hasattr(self, "server") and self.server:
            self.server.stop()
        event.accept()


def main():
    app = QApplication(sys.argv)
    app.setApplicationName("Kali-ARES Tactical GPS")

    # Step 1: Check if keystore exists
    if not backend_crypto.keystore_exists():
        setup_dlg = MasterPasswordSetupDialog()
        if setup_dlg.exec() != QDialog.DialogCode.Accepted or not setup_dlg.master_password:
            sys.exit(0)
        try:
            keystore = backend_crypto.init_keystore(setup_dlg.master_password)
            master_pass = setup_dlg.master_password
        except Exception as e:
            QMessageBox.critical(None, "Error Fatal", f"No se pudo inicializar la bóveda: {e}")
            sys.exit(1)
    else:
        login_dlg = MasterPasswordLoginDialog()
        if login_dlg.exec() != QDialog.DialogCode.Accepted or not login_dlg.master_password:
            sys.exit(0)
        try:
            keystore = backend_crypto.unlock_keystore(login_dlg.master_password)
            master_pass = login_dlg.master_password
        except Exception as e:
            QMessageBox.critical(
                None,
                "Autenticación Fallida",
                f"{str(e)}\n\nPor seguridad, la aplicación se cerrará inmediatamente."
            )
            sys.exit(1)

    window = TacticalMainWindow(master_pass, keystore)
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
EOF
