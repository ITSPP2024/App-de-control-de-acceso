import axios from "axios";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { refreshTTLockToken } from "./auth.js";

dotenv.config();

const {
  TTLOCK_BASE_URL,
  TTLOCK_CLIENT_ID,
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
} = process.env;

// 🗄️ Configurar conexión MySQL
const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
});

// ============================================================
// 🚪 FUNCIÓN PRINCIPAL: sincronizar dispositivos TTLock
// ============================================================
export async function syncTTLockDevices() {
  try {
    console.log("🔄 Sincronizando cerraduras TTLock...");

    // Obtener token actual (o refrescar si expiró)
    const tokenData = await refreshTTLockToken();
    const access_token = tokenData.access_token;

    // ✅ Obtener lista de cerraduras desde la API
    const response = await axios.post(
      `${TTLOCK_BASE_URL}/v3/lock/list`,
      new URLSearchParams({
        clientId: TTLOCK_CLIENT_ID,
        accessToken: access_token,
        pageNo: 1,
        pageSize: 50,
        date: Date.now(), // 🔥 Timestamp actual, evita error 400
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const data = response.data;
    if (data.errcode) {
      console.error("❌ Error TTLock:", data);
      return;
    }

    const locks = data.list || [];
    console.log(`🔍 ${locks.length} cerraduras encontradas.`);

    // Guardar o actualizar en la BD
    const conn = await pool.getConnection();
    try {
      for (const lock of locks) {
        const [rows] = await conn.query(
          "SELECT * FROM dispositivo WHERE idDispositivo = ?",
          [lock.lockId]
        );

        if (rows.length === 0) {
          await conn.query(
            `INSERT INTO dispositivo 
            (idDispositivo, nombre_dispositivo, tipo_dispositivo, Estado, lock_key, wifi_lock)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
              lock.lockId,
              lock.lockName,
              "TTLock",
              "Activo",
              lock.lockMac,
              1,
            ]
          );
          console.log(`✅ Cerradura agregada: ${lock.lockName}`);
        } else {
          await conn.query(
            `UPDATE dispositivo 
             SET nombre_dispositivo = ?, Estado = ?, lock_key = ?, wifi_lock = ?
             WHERE idDispositivo = ?`,
            [
              lock.lockName,
              "Activo",
              lock.lockMac,
              1,
              lock.lockId,
            ]
          );
          console.log(`🔁 Cerradura actualizada: ${lock.lockName}`);
        }
      }
    } finally {
      conn.release();
    }

    console.log("✅ Sincronización TTLock completada.");
  } catch (error) {
    console.error("❌ Error al sincronizar TTLock:", error.response?.data || error.message);
    throw error;
  }
}
