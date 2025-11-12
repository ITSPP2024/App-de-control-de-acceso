import axios from "axios";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

// 🧠 Variables de entorno
const {
  TTLOCK_CLIENT_ID,
  TTLOCK_CLIENT_SECRET,
  TTLOCK_USERNAME,
  TTLOCK_PASSWORD,
  TTLOCK_BASE_URL,
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
} = process.env;

// ⚙️ Configurar conexión MySQL
const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
});

// =======================================================
// 🧩 LOGIN TTLOCK (con password MD5 encriptado)
// =======================================================
export async function ttlockLogin() {
  try {
    // Encriptar la contraseña con MD5
    const encryptedPassword = crypto
      .createHash("md5")
      .update(TTLOCK_PASSWORD)
      .digest("hex");

    const params = new URLSearchParams({
      clientId: TTLOCK_CLIENT_ID,
      clientSecret: TTLOCK_CLIENT_SECRET,
      username: TTLOCK_USERNAME,
      password: encryptedPassword,
    });

    const response = await axios.post(`${TTLOCK_BASE_URL}/oauth2/token`, params);
    const data = response.data;

    console.log("✅ Login TTLock correcto:", data);

    await saveTokens(data);
    return data;
  } catch (error) {
    console.error("❌ Error en login TTLock:", error.response?.data || error.message);
    throw error;
  }
}

// =======================================================
// 💾 GUARDAR O ACTUALIZAR TOKENS EN BASE DE DATOS
// =======================================================
async function saveTokens(data) {
  const conn = await pool.getConnection();
  try {
    const { access_token, refresh_token, expires_in } = data;

    // Dejamos solo un registro de token
    await conn.query("DELETE FROM ttlock_tokens");

    await conn.query(
      "INSERT INTO ttlock_tokens (access_token, refresh_token, expires_in, last_update) VALUES (?, ?, ?, NOW())",
      [access_token, refresh_token, expires_in]
    );

    console.log("💾 Token TTLock guardado en la BD correctamente");
  } finally {
    conn.release();
  }
}

// =======================================================
// 🔄 REFRESCAR TOKEN SI ESTÁ EXPIRADO
// =======================================================
export async function refreshTTLockToken() {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query("SELECT * FROM ttlock_tokens LIMIT 1");

    if (rows.length === 0) {
      console.log("⚠️ No hay token guardado, iniciando login...");
      return await ttlockLogin();
    }

    const tokenData = rows[0];
    const lastUpdate = new Date(tokenData.last_update);
    const now = new Date();
    const elapsed = (now - lastUpdate) / 1000; // segundos transcurridos

    if (elapsed < tokenData.expires_in - 60) {
      console.log("🔐 Token TTLock aún válido, no requiere refresh.");
      return tokenData;
    }

    console.log("♻️ Token expirado, refrescando...");

    const params = new URLSearchParams({
      clientId: TTLOCK_CLIENT_ID,
      clientSecret: TTLOCK_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: tokenData.refresh_token,
    });

    const response = await axios.post(`${TTLOCK_BASE_URL}/oauth2/token`, params);
    const newData = response.data;

    await saveTokens(newData);

    console.log("✅ Token TTLock actualizado correctamente");
    return newData;
  } catch (error) {
    console.error("❌ Error al refrescar token:", error.response?.data || error.message);
    throw error;
  } finally {
    conn.release();
  }
}
