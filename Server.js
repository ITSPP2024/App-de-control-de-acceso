import express from "express";
import mysql from "mysql2";
import cors from "cors";
import bodyParser from "body-parser";

// ============================================================
// 🔌 CONFIGURACIÓN DEL SERVIDOR
// ============================================================
const app = express();
const PORT = 5002; // usa otro puerto distinto al del web (ej: 5001)

app.use(cors());
app.use(bodyParser.json());

// ============================================================
// 🗄️ CONEXIÓN A LA BASE DE DATOS
// ============================================================
const db = mysql.createConnection({
  host: "localhost",
  user: "root",       
  password: "admin",       
  database: "sistema_control_acceso", 
});

db.connect((err) => {
  if (err) {
    console.error("❌ Error al conectar con la base de datos:", err);
  } else {
    console.log("✅ Conectado a la base de datos MySQL (Desktop Server)");
  }
});

// ============================================================
// 🔐 LOGIN DE ADMINISTRADORES
// ============================================================
import bcrypt from "bcrypt"; // asegúrate de instalarlo con: npm install bcrypt

app.post("/api/login", (req, res) => {
  const { correo, contraseña } = req.body;

  if (!correo || !contraseña) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  const query = `
    SELECT * FROM administradores WHERE Correo_Administrador = ?
  `;

  db.query(query, [correo], async (err, results) => {
    if (err) {
      console.error("❌ Error al consultar el administrador:", err);
      return res.status(500).json({ error: "Error interno del servidor" });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: "Correo no encontrado" });
    }

    const admin = results[0];

    // ✅ Comparar contraseñas (hash vs texto plano)
    const isMatch = await bcrypt.compare(contraseña, admin.Contraseña_Administrador);

    if (!isMatch) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    // ✅ Enviar datos seguros del administrador
    res.json({
      idAdministrador: admin.idAdministrador,
      nombre: admin.Nombre_Administrador,
      apellido: admin.Apellido_Administrador,
      correo: admin.Correo_Administrador,
    });
  });
});

// ============================================================
// 🧾 ENDPOINT: Registrar un acceso
// ============================================================
app.post("/api/accesos", (req, res) => {
  const { idUsuario, idZona, tipo_acceso, metodo } = req.body;

  if (!idUsuario || !idZona || !tipo_acceso || !metodo) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  const query = `
    INSERT INTO accesos (idUsuario, idZona, tipo_acceso, metodo, fecha)
    VALUES (?, ?, ?, ?, NOW())
  `;

  db.query(query, [idUsuario, idZona, tipo_acceso, metodo], (err, result) => {
    if (err) {
      console.error("Error al registrar acceso:", err);
      return res.status(500).json({ error: "Error al registrar acceso" });
    }

    console.log(`✅ Acceso registrado -> Usuario: ${idUsuario}, Zona: ${idZona}`);
    res.json({ message: "Acceso registrado correctamente" });
  });
});

// ======================================================
// 🔹 Obtener lista de zonas (incluye nivel de seguridad)
// ======================================================
app.get('/api/zonas', (req, res) => {
  const sql = `
    SELECT 
      idzonas,
      nombre_zona,
      nivel_seguridad_zona,
      capacidad_maxima_zona,
      horario_inicio_zona,
      horario_fin_zona,
      descripcion_zona,
      estado_zona,
      requiresEscort
    FROM zonas
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('❌ Error al obtener zonas:', err);
      return res.status(500).json({ error: 'Error al obtener zonas' });
    }

    console.log('✅ Zonas obtenidas correctamente:', results.length);
    res.json(results);
  });
});

// ======================================================
// 🔹 Registrar o vincular dispositivo
// ======================================================
app.post("/api/dispositivo", (req, res) => {
  const { 
    Idzona_dispositivo, 
    nombre_dispositivo, 
    tipo_dispositivo, 
    ubicacion, 
    Estado, 
    creado_por 
  } = req.body;

  if (!Idzona_dispositivo || !nombre_dispositivo || !creado_por) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  // 🔸 Obtener datos de la zona (nombre y nivel de seguridad)
  const zonaQuery = `
    SELECT nombre_zona, nivel_seguridad_zona 
    FROM zonas 
    WHERE idzonas = ?
  `;
  db.query(zonaQuery, [Idzona_dispositivo], (errZona, zonaResults) => {
    if (errZona) {
      console.error("❌ Error al consultar la zona:", errZona);
      return res.status(500).json({ error: errZona.message });
    }

    if (zonaResults.length === 0) {
      return res.status(404).json({ error: "Zona no encontrada" });
    }

    const { Nombre_Zona, nivel_seguridad_zona } = zonaResults[0];

    // 🔹 Verificar si el dispositivo ya existe
    const checkQuery = "SELECT * FROM dispositivo WHERE nombre_dispositivo = ?";
    db.query(checkQuery, [nombre_dispositivo], (err, results) => {
      if (err) {
        console.error("❌ Error al verificar dispositivo:", err);
        return res.status(500).json({ error: err.message });
      }

      // ======================================================
      // 🟢 Si el dispositivo ya existe → actualizar zona y datos
      // ======================================================
      if (results.length > 0) {
        const updateQuery = `
          UPDATE dispositivo
          SET 
            Idzona_dispositivo = ?, 
            nombre_zona_dispositivo = ?, 
            tipo_dispositivo = ?, 
            ubicacion = ?, 
            Estado = ?,
            nivel_seguridad_zona = ?
          WHERE nombre_dispositivo = ?
        `;
        db.query(
          updateQuery,
          [
            Idzona_dispositivo, 
            Nombre_Zona, 
            tipo_dispositivo || results[0].tipo_dispositivo, 
            ubicacion || results[0].ubicacion, 
            Estado || results[0].Estado, 
            nivel_seguridad_zona,
            nombre_dispositivo
          ],
          (err2) => {
            if (err2) {
              console.error("❌ Error al actualizar dispositivo:", err2);
              return res.status(500).json({ error: err2.message });
            }

            // Registrar auditoría
            const detalle = `Actualizó el dispositivo "${nombre_dispositivo}" vinculado a la zona "${Nombre_Zona}" (Nivel ${nivel_seguridad_zona})`;
            const auditQuery = `
              INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, fecha)
              VALUES (?, 'ACTUALIZAR', 'DISPOSITIVO', ?, ?, NOW())
            `;
            db.query(auditQuery, [creado_por, results[0].idDispositivo, detalle]);

            res.json({ message: "✅ Dispositivo actualizado correctamente y auditoría registrada" });
          }
        );
      } 
      // ======================================================
      // 🔵 Si el dispositivo no existe → insertar nuevo
      // ======================================================
      else {
        const insertQuery = `
          INSERT INTO dispositivo 
          (nombre_dispositivo, tipo_dispositivo, Idzona_dispositivo, nombre_zona_dispositivo, ubicacion, Estado, nivel_seguridad_zona)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        db.query(
          insertQuery,
          [
            nombre_dispositivo, 
            tipo_dispositivo || "Lector biométrico", 
            Idzona_dispositivo, 
            Nombre_Zona, 
            ubicacion || "Sin definir", 
            Estado || "Activo",
            nivel_seguridad_zona
          ],
          (err3, result) => {
            if (err3) {
              console.error("❌ Error al registrar dispositivo:", err3);
              return res.status(500).json({ error: err3.message });
            }

            // Registrar auditoría
            const detalle = `Registró nuevo dispositivo "${nombre_dispositivo}" en zona "${Nombre_Zona}" (Nivel ${nivel_seguridad_zona})`;
            const auditQuery = `
              INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, fecha)
              VALUES (?, 'CREAR', 'DISPOSITIVO', ?, ?, NOW())
            `;
            db.query(auditQuery, [creado_por, result.insertId, detalle]);

            res.json({ message: "✅ Nuevo dispositivo registrado y auditado correctamente" });
          }
        );
      }
    });
  });
});
// ============================================================
// 🧾 REGISTRO DE AUDITORÍA
// ============================================================
app.post("/api/auditoria", (req, res) => {
  const { usuario_id, accion, entidad, entidad_id, detalle } = req.body;

  if (!usuario_id || !accion || !entidad || !detalle) {
    return res.status(400).json({ error: "Faltan datos obligatorios en la auditoría" });
  }

  const query = `
    INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, fecha)
    VALUES (?, ?, ?, ?, ?, NOW())
  `;

  db.query(query, [usuario_id, accion, entidad, entidad_id || null, detalle], (err, result) => {
    if (err) {
      console.error("❌ Error al registrar auditoría:", err);
      return res.status(500).json({ error: "Error al registrar auditoría" });
    }
    console.log(`🧾 Auditoría registrada -> ${accion} en ${entidad}`);
    res.json({ message: "Auditoría registrada correctamente" });
  });
});

// ============================================================
// 🚀 INICIAR SERVIDOR
// ============================================================
app.listen(PORT, () => {
  console.log(`🟢 Servidor de escritorio corriendo en http://localhost:${PORT}`);
});
