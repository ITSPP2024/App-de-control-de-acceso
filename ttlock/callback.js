// ✅ src/ttlock/callback.js
import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
// 📬 Callback TTLock
router.post("/", async (req, res) => {
  try {
    const data = req.body;
    console.log("📬 Callback recibido de TTLock:", data);

    // parsear registros si vienen
    let record = null;
    if (data.records) {
      try {
        const parsed = JSON.parse(data.records);
        record = parsed[0];
      } catch (err) {
        console.warn("⚠️ No se pudo parsear 'records':", err.message);
      }
    }

    const lockId = data.lockId || record?.lockId;
    const lockMac = data.lockMac || record?.lockMac;
    const battery = record?.electricQuantity ?? null;
    const admin = data.admin || "Desconocido";

    if (!lockId) {
      return res.status(400).json({ success: false, message: "Falta lockId" });
    }

    // ✅ Registrar/actualizar dispositivo
    const [rows] = await pool.query(
      "SELECT * FROM dispositivo WHERE idDispositivo = ?",
      [lockId]
    );

    if (rows.length === 0) {
      await pool.query(
        `INSERT INTO dispositivo (idDispositivo, nombre_dispositivo, tipo_dispositivo, Estado, lock_key, wifi_lock)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [lockId, `Cerradura-${lockId}`, "RFID", "Activo", lockMac, 1]
      );
      console.log(`✅ Cerradura ${lockId} registrada.`);
    } else {
      await pool.query(
        `UPDATE dispositivo 
         SET Estado = ?, lock_key = ?, wifi_lock = ? 
         WHERE idDispositivo = ?`,
        ["Activo", lockMac, 1, lockId]
      );
      console.log(`🔄 Cerradura ${lockId} actualizada.`);
    }

    // 🔹 Obtener usuario por huella o nombre **aquí dentro**
    const [userRows] = await pool.query(
      "SELECT * FROM usuarios WHERE CONCAT(nombre_usuario, ' ', apellido_usuario) = ? OR huella_usuario = ?",
      [data.username || record?.username, data.username || record?.username]
    );
    const user = userRows[0] || null;

    // 🔹 Validar acceso según zona y nivel de seguridad
    let estadoAcceso = "Denegado";
    let motivo = "Usuario no autorizado";

    // ⚠️ currentZone debería venir de tu lógica de zona, ej:
    const currentZone = null; // placeholder, luego obtienes la zona real
    if (user && currentZone) {
      if (user.nivel_acceso >= currentZone.nivel_seguridad_zona) {
        estadoAcceso = "Autorizado";
        motivo = null;
      } else {
        motivo = "Nivel de acceso insuficiente";
      }
    }

    // 🧾 Insertar acceso
    await pool.query(
      `INSERT INTO acceso 
        (idUsuario, idZona, tipo_acceso, tipo_dispositivo_acceso, idDispositivo, estado_acceso, motivo_rechazo_acceso, fecha_inicio_acceso)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        user?.idUsuarios || null,
        currentZone?.idzonas || null,
        record?.type || "Huella",
        "TTLock WiFi",
        lockId,
        estadoAcceso,
        motivo
      ]
    );

    console.log(`📝 Registro de acceso TTLock guardado correctamente.`);

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error en callback TTLock:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
