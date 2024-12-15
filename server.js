const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const multer = require('multer');
const xlsx = require('xlsx');
const bcrypt = require('bcrypt');
const path = require('path');
const app = express();
const PDFDocument = require('pdfkit');
const fs = require('fs');
require('dotenv').config();

timezone: 'America/Tijuana'
// Configuración de la sesión
app.use(session({
    secret: 'secretKey',
    resave: false,
    saveUninitialized: false,
}));
app.use(bodyParser.urlencoded({ extended: true }))
// Ruta para la página principal
app.get('/',requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Servir archivos estáticos (HTML)
app.use(express.static(path.join(__dirname, 'public')));
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login.html');
  }
  next();
}
function requireRole(role) {
    return (req, res, next) => {
        if (req.session.user && req.session.user.tipo_usuario === role) {
            next();
        } else {
            res.status(403).send('<link rel="stylesheet" href="/styles.css">Acceso denegado');
        }
    };
}
// Registro de usuario
app.post('/registro', async (req, res) => {
    const {nombre_usuario, password, codigo_acceso } = req.body;

    const query = 'SELECT tipo_usuario FROM codigos_acceso WHERE codigo = ?';
    connection.query(query, [codigo_acceso], (err, results) => {
        if (err || results.length === 0) {
            return res.send('<link rel="stylesheet" href="/styles.css">Código de acceso inválido');
        }

        const tipo_usuario = results[0].tipo_usuario;
        const hashedPassword = bcrypt.hashSync(password, 10);

        const insertUser = 'INSERT INTO usuarios_medicos(nombre_usuario, password_hash, tipo_usuario) VALUES (?, ?, ?)';
        connection.query(insertUser, [nombre_usuario, hashedPassword, tipo_usuario], (err) => {
            if (err) return res.send('<link rel="stylesheet" href="/styles.css">Error al registrar usuario');
            res.redirect('/login.html');
        });
    });
});

// Iniciar sesión
app.post('/login', (req, res) => {
    const { nombre_usuario, password } = req.body;

    // Consulta para obtener el usuario y su tipo
    const query = 'SELECT * FROM usuarios_medicos WHERE nombre_usuario = ?';
    connection.query(query, [nombre_usuario], (err, results) => {
        if (err) {
            return res.send('Error al obtener el usuario');
        }

        if (results.length === 0) {
            return res.send('<link rel="stylesheet" href="/styles.css">Usuario no encontrado');
        }

        const user = results[0];

        // Verificar la contraseña
        const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
        if (!isPasswordValid) {
            return res.send('<link rel="stylesheet" href="/styles.css">Contraseña incorrecta');
        }

        // Almacenar la información del usuario en la sesión
        req.session.user = {
            id: user.id,
            nombre_usuario: user.nombre_usuario,
            tipo_usuario: user.tipo_usuario // Aquí se establece el tipo de usuario en la sesión
        };

        // Redirigir al usuario a la página principal
        res.redirect('/');
    });
});

// Configurar conexión a MySQL
const connection = mysql.createConnection({
  host: process.env.DB_HOST,      
  user: process.env.DB_USER,       
  password: process.env.DB_PASSWORD, 
  database: process.env.DB_NAME
});

// Conectar a la base de datos
connection.connect(err => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err);
    return;
  }
  console.log('Conexión exitosa a la base de datos');
});

connection.connect(err => {
  if (err) throw err;
  console.log('Conectado a la base de datos');
});
// Configuración de Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuración de puerto
const PORT = process.env.PORT || 1000;
app.listen(PORT, () => console.log(`Servidor en funcionamiento en el puerto ${PORT}`));

// Ruta para obtener el tipo de usuario actual
app.get('/tipo-usuario', requireLogin,  (req, res) => {
    res.json({ tipo_usuario: req.session.user.tipo_usuario });
});

// Ruta para guardar datos en la base de datos
app.post('/submit-data', requireLogin, (req, res) => {
    const { name,raza, age } = req.body;
  
    const query = 'INSERT INTO pacientes ( nombre, raza, edad_humana) VALUES (?, ?, ?)';
    connection.query(query, [name,raza,age ], (err, result) => {
      if (err) {
        return res.send('<link rel="stylesheet" href="/styles.css">Error al guardar los datos en la base de datos.');
      }
        
      res.send(`<link rel="stylesheet" href="/styles.css">Paciente ${name} guardado en la base de datos.`);
    });
});

app.get('/eliminar-usuario/:id',requireLogin, requireRole('admin'), (req, res) => {
  const userId = req.params.id;  // Aquí obtienes el id del usuario

  // Eliminar el usuario de la base de datos
  connection.query('DELETE FROM usuarios_medicos WHERE id = ?', [userId], (err, results) => {
    if (err) {
      console.error('<link rel="stylesheet" href="/styles.css">Error al eliminar el usuario:', err);
      return res.send('<link rel="stylesheet" href="/styles.css">Error al eliminar el usuario.');
    }

    res.send(`
      <html>
        <head>
          <title>Usuario Eliminado</title>
        </head>
        <body>
          <h1>Usuario eliminado correctamente.</h1>
          <button onclick="window.location.href='/ver-usuarios'">Volver a la lista de usuarios</button>
        </body>
      </html>
    `);
  });
});

// Ruta para que solo admin pueda ver todos los usuarios
app.get('/ver-usuarios', requireLogin, requireRole('admin'), (req, res) => {
    const query = 'SELECT * FROM usuarios_medicos';
    connection.query(query, (err, results) => {
        if (err) return res.send('<link rel="stylesheet" href="/styles.css">Error al obtener usuarios');
        
        
        let html = `
        <html>
        <head>
          <link rel="stylesheet" href="/styles.css">
          
        </head>
        <body>
          <h2>Lista de usuarios </h1>
          <table>
            <tr>
              <th>Nombre de usuario</th>
              <th>Tipo de Usuario</th>
            </tr>`;
  
      results.forEach(user => {
        html += `
          <tr>
            <td>${user.nombre_usuario}</td>
            <td>${user.tipo_usuario || 'N/A'}</td>
            <td><button class="eliminar-btn" onclick="eliminarUsuario(${user.id})">Eliminar</button></td>
            
          </tr>`;
      });
  
      html += `
           </tbody>
         </table>
        <button onclick="window.location.href='/'">Volver</button>
        <script src="script.js"></script>
        </body>
        </html>
      `;
  
      res.send(html);
    
    });
});

app.get('/eliminar-paciente/:id', requireLogin, (req, res) => {
  const pacienteId = req.params.id;  // Aquí obtienes el id del paciente

  // Eliminar el paciente de la base de datos
  connection.query('DELETE FROM pacientes WHERE id = ?', [pacienteId], (err, results) => {
    if (err) {
      console.error('Error al eliminar el paciente:', err);
      return res.send('Error al eliminar el paciente.');
    }

    // Respuesta tras la eliminación
    res.send(`
      <html>
        <head>
          <title>Paciente Eliminado</title>
        </head>
        <body>
          <h1>Paciente eliminado correctamente.</h1>
          <button onclick="window.location.href='/pacientes'">Volver a la lista de pacientes</button>
        </body>
      </html>
    `);
  });
});


// Ruta para mostrar los datos de la base de datos
app.get('/pacientes',requireLogin,  (req, res) => {
    connection.query('SELECT * FROM pacientes', (err, results) => {
        if (err) {
            return res.send('<link rel="stylesheet" href="/styles.css">Error al obtener los datos.');
          }
      
          let html = `
            <html>
            <head>
              <link rel="stylesheet" href="/styles.css">
              <title>Pacientes</title>
            </head>
            <body>
              <h1>Pacientes Registrados</h1>
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th> 
                    <th>Raza</th>
                    <th>Edad Humana</th>
                    
                  </tr>
                </thead>
                <tbody>
          `;
      
          results.forEach(paciente => {
            html += `
              <tr>
                <td>${paciente.nombre}</td>
                <td>${paciente.raza}</td>
                <td>${paciente.edad_humana}</td>
                <td><button class="eliminar-btn" onclick="eliminarPaciente(${paciente.id})">Eliminar</button></td>
              </tr>
            `;
    
        });
        
        html += `
            </tbody>
            </table>
            <button onclick="window.location.href='/'">Volver</button>
            <script src="script.js"></script>
        </body>
        </html>
        `;
    
        res.send(html);
    });
});

// Ruta para ordenar pacientes por frecuencia cardiaca
app.get('/vista',requireLogin,  (req, res) => {
  const query = 'SELECT * FROM vista_medicos_areas';

  connection.query(query, (err, results) => {
    if (err) {
      return res.send('<link rel="stylesheet" href="/styles.css">Error al obtener los datos.');
    }

    let html = `
      <html>
      <head>
        <link rel="stylesheet" href="/styles.css">
        <title>Vista de Área de trabajo del personal</title>
      </head>
      <body>
        <h1>Vista de Área de trabajo del personal</h1>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Área</th>
            </tr>
          </thead>
          <tbody>
    `;

    results.forEach(vista => {
      html += `
        <tr>
          <td>${vista.nombre}</td>
          <td>${vista.area}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        <button onclick="window.location.href='/'">Volver</button>
      </body>
      </html>
    `;

    res.send(html);
  });
});

// Ruta para buscar pacientes según filtros
app.get('/buscar-pacientes',requireLogin,(req, res) => {
    const { name_search} = req.query;
    let query = 'SELECT * FROM pacientes WHERE 1=1';
  
    if (name_search) {
      query += ` AND nombre LIKE '%${name_search}%'`;
    }
   
    connection.query(query, (err, results) => {
      if (err) {
        return res.send('<link rel="stylesheet" href="/styles.css">Error al obtener los datos.');
      }
  
      let html = `
        <html>
        <head>
          <link rel="stylesheet" href="/styles.css">
          <title>Resultados de Búsqueda</title>
        </head>
        <body>
          <h1>Resultados de Búsqueda</h1>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Raza</th>
                <th>Edad Humana</th>
              </tr>
            </thead>
            <tbody>
      `;
  
      results.forEach(paciente => {
        html += `
          <tr>
                <td>${paciente.nombre}</td>
                <td>${paciente.raza}</td>
                <td>${paciente.edad_humana}</td>
         </tr>
        `;
      });
  
      html += `
            </tbody>
          </table>
          <button onclick="window.location.href='/'">Volver</button>
        </body>
        </html>
      `;
  
      res.send(html);
    });
});
// Ruta para ordenar pacientes por frecuencia cardiaca
app.get('/ordenar-pacientes',requireLogin,  (req, res) => {
    const query = 'SELECT * FROM pacientes ORDER BY nombre ASC';
  
    connection.query(query, (err, results) => {
      if (err) {
        return res.send('<link rel="stylesheet" href="/styles.css">Error al obtener los datos.');
      }
  
      let html = `
        <html>
        <head>
          <link rel="stylesheet" href="/styles.css">
          <title>Pacientes Ordenados</title>
        </head>
        <body>
          <h1>Pacientes Ordenados Alfabeticamente </h1>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Raza</th>
                <th>Edad Humana</th>
              </tr>
            </thead>
            <tbody>
      `;
  
      results.forEach(paciente => {
        html += `
          <tr>
            <td>${paciente.nombre}</td>
            <td>${paciente.raza}</td>
            <td>${paciente.edad_humana}</td>
          </tr>
        `;
      });
  
      html += `
            </tbody>
          </table>
          <button onclick="window.location.href='/'">Volver</button>
        </body>
        </html>
      `;
  
      res.send(html);
    });
});

// Ruta para insertar un nuevo médico
app.post('/insertar-medico',requireLogin, requireRole('admin'), (req, res) => {
    const { medico_name, area_id, Turno, fecha_contratacion} = req.body;
    const query = 'INSERT INTO medicos (nombre, area_id, Turno, fecha_contratacion) VALUES (?, ?, ?, ?)';
  
    connection.query(query, [medico_name, area_id, Turno, fecha_contratacion], (err, result) => {
      if (err) {
        return res.send('<link rel="stylesheet" href="/styles.css">Error al insertar el médico.');
      }
      res.send(`<link rel="stylesheet" href="/styles.css">Médico ${medico_name} guardado exitosamente.`);
    });
});

// Ruta para mostrar los datos de la base de datos en formato HTML
app.get('/medico',requireLogin, requireRole('admin'),(req, res) => {
  connection.query('SELECT * FROM medicos', (err, results) => {
    if (err) {
      return res.send('<link rel="stylesheet" href="/styles.css">Error al obtener los datos.');
    }

    let html = `
      <html>
      <head>
        <link rel="stylesheet" href="/styles.css">
        <title>Médicos</title>
      </head>
      <body>
        <h1>Médicos Registrados</h1>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Numero de Área </th>
               <th>Turno</th>
               <th>Fecha de contratación</th>
            </tr>
          </thead>
          <tbody>
    `;

    results.forEach(medicos => {
      html += `
        <tr>
          <td>${medicos.nombre}</td>
          <td>${medicos.area_id}</td>
          <td>${medicos.Turno}</td>
          <td>${medicos.fecha_contratacion}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        <button onclick="window.location.href='/'">Volver</button>
      </body>
      </html>
    `;

    res.send(html);
  });
});

// Ruta para contar medicos
app.get('/contar',requireLogin,  (req, res) => {
  const query = 'SELECT * FROM vista_medicos_conteo';

  connection.query(query, (err, results) => {
    if (err) {
      return res.send('<link rel="stylesheet" href="/styles.css">Error al obtener los datos.');
    }

    let html = `
      <html>
      <head>
        <link rel="stylesheet" href="/styles.css">
        <title>Conteo de médico por Área </title>
      </head>
      <body>
        <h1>Conteo de médico por Área</h1>
        <table>
          <thead>
            <tr>
              <th>Nombre del Área</th>
              <th>Cantidad de Médicos en dicha área</th>
            
            </tr>
          </thead>
          <tbody>
    `;

    results.forEach(vista => {
      html += `
        <tr>
          <td>${vista.nombre}</td>
          <td>${vista.numero_medicos }</td>
          
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        <button onclick="window.location.href='/'">Volver</button>
      </body>
      </html>
    `;

    res.send(html);
  });
});

// Cerrar sesión
  app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login.html');
});

app.get('/buscar', (req, res) => {
  const query = req.query.query;
  const sql = `SELECT nombre, raza FROM pacientes WHERE nombre LIKE ?`;
  connection.query(sql, [`%${query}%`], (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('excelFile'), (req, res) => {
  const filePath = req.file.path;
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  data.forEach(row => {
    const { Nombre, Descripción } = row;
    const sql = `INSERT INTO medicamentos ( Nombre , Descripción) VALUES (?, ?)`;
    connection.query(sql, [Nombre, Descripción], err => {
      if (err) throw err;
    });
  });

  res.send('<h1>Archivo cargado y datos guardados</h1><a href="/medicamentos.html">Volver</a>');
});
app.get('/downloads', (req, res) => {
  const sql = `SELECT * FROM medicamentos`;
  connection.query(sql, (err, results) => {
    if (err) throw err;

    const worksheet = xlsx.utils.json_to_sheet(results);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'medicamentos');

    const filePath = path.join(__dirname, 'uploads', 'MEDICINA.xlsx');
    xlsx.writeFile(workbook, filePath);
    res.download(filePath, 'MEDICINA.xlsx');
  });
});

app.get('/download', requireLogin,  (req, res) => {
  const sql = `SELECT * FROM medicamentos`;
  connection.query(sql, (err, results) => {
    if (err) throw err;  
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="medicamentos.pdf"');
    const doc = new PDFDocument();
    doc.pipe(res);
    doc.text('Lista de Medicamentos', { align: 'center', underline: true });
    doc.moveDown(2);
    results.forEach((row) => {
      doc.text(`ID: ${row.id}`);
      doc.text(`Nombre: ${row.Nombre}`);
      doc.text(`Descripción: ${row.Descripción}`);
      doc.moveDown(1);
    });
    doc.end();
  });
});



