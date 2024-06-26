// Librerias utilizadas
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const nodemailer = require('nodemailer');
const handlebars = require('nodemailer-express-handlebars');
const QRCode = require('qrcode');
const path = require('path');

// Puerto utilizado por node.js y creación de la app con express
const app = express();
const port = 3000;

// Conexión a la base de datos
const connection = mysql.createConnection({
    host: 'bdasoinco.cn82k4g6yqpt.us-east-2.rds.amazonaws.com',
    user: 'bdAsoinco',
    password: 'adminadmin',
    database: 'db1'
});

// Validación de la conexión con mensajes de error
connection.connect((err) => {
    if (err) {
        console.error('Error conectando a la base de datos:', err);
        return;
    }
    console.log('Conexión a la base de datos establecida.');
});

// Middleware para las solicitudes
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public')); // Se utiliza la carpeta public para archivos estaticos

// Configuración de nodemailer para enviar correos electrónicos
const transporter = nodemailer.createTransport({
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false, // true para 465, false para otros puertos
    auth: {
        // Credenciales del correo utilizado
        user: 'dreamteam.dev@outlook.com',
        pass: "Zxdm;>$EJae'j#M}7Py^/&"
    }
});

// Configurar handlebars (hbs) para plantillas de correo electronico
transporter.use('compile', handlebars({
    viewEngine: {
        extName: '.hbs', // Extensión de archivos de plantilla
        partialsDir: path.resolve('./emailTemplates'), // Directorio de las plantillas
        defaultLayout: false,
    },
    viewPath: path.resolve('./emailTemplates'),
    extName: '.hbs',
}));

// Ruta para la página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/index.html'));
});

// Obtención de las empresas por medio de la base de datos
app.get('/empresas', (req, res) => {
    const query = 'SELECT empId, empNombre FROM empresa';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching empresas:', err);
            res.status(500).send('Error del servidor al obtener empresas.');
            return;
        }
        res.json(results); // Devolver resultados en formato JSON
    });
});

// Método para registrar un nuevo asistente a la base de datos
app.post('/register', (req, res) => {
    const { asiNombre, asiApellido, asiRut, asiEmail, asiNumero, asiEmpresa, asiCargo, asiArea, asiSexo } = req.body;

    console.log('Datos recibidos:', req.body);

    // Verificar que estén todos los datos
    if (!asiNombre || !asiApellido || !asiRut || !asiEmail || !asiNumero || !asiSexo) {
        console.error('Faltan campos requeridos:', req.body);
        res.status(400).send('Faltan campos requeridos');
        return;
    }

    // Consulta para insertar el asistente en la base de datos
    const query = `
        INSERT INTO asistente (asiNombre, asiApellido, asiRut, asiEmail, asiNumero, asiEmpresa, asiCargo, asiArea, asiSexo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    connection.query(query, [asiNombre, asiApellido, asiRut, asiEmail, asiNumero, asiEmpresa, asiCargo, asiArea, asiSexo], (err, results) => {
        if (err) {
            console.error('Error en la consulta de inserción:', err);
            res.status(500).send('Error del servidor al insertar asistente.');
            return;
        }

        const asiId = results.insertId;
        const eveId = 1; // ID del evento, puede ser cambiado por un metodo que pueda registrar a otros eventos a futuro
        const fechaInscripcion = new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Consulta para ingresar al asistente en la tabla de registro de asistencia
        const asistenciaEventoQuery = `
            INSERT INTO asistencia_evento (asiId, eveId, fechaInscripcion)
            VALUES (?, ?, ?)
        `;

        connection.query(asistenciaEventoQuery, [asiId, eveId, fechaInscripcion], (err, results) => {
            if (err) {
                console.error('Error en la consulta de asistencia_evento:', err);
                res.status(500).send('Error del servidor al insertar en asistencia_evento.');
                return;
            }

            // Generar el codigo QR para el asistente
            QRCode.toDataURL(String(asiId), (err, qrCodeData) => {
                if (err) {
                    console.error('Error generando QR:', err);
                    res.status(500).send('Error del servidor al generar código QR.');
                    return;
                }

                // Configuración del correo
                const mailOptions = {
                    from: 'dreamteam.dev@outlook.com',
                    to: asiEmail,
                    subject: 'Registro Exitoso',
                    template: 'registrationEmail',
                    context: { nombre: asiNombre },
                    attachments: [
                        {
                            filename: 'codigo-qr.png',
                            path: qrCodeData,
                            cid: 'qrCode'
                        }
                    ],
                };

                // Enviar correo electrónico
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error('Error enviando correo:', error);
                        res.status(500).send('Error del servidor al enviar correo.');
                        return;
                    }
                    console.log('Correo enviado:', info.response);

                    // Se redirige al usuario a la página edit con los datos proporcionados y el qr de entrada
                    res.json({
                        success: true,
                        redirectUrl: `/edit?nombre=${encodeURIComponent(asiNombre)}&qrCode=${encodeURIComponent(qrCodeData)}`
                    });
                });
            });
        });
    });
});

// Ruta para la página de edición, en este caso la que se muestra luego de que el usuario se registra
app.get('/edit', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/edit.html'));
});

// Inicio del servidor
app.listen(port, () => {
    console.log(`Servidor en http://localhost:${port}`);
});
