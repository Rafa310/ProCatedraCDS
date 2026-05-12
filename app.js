const express = require('express');
const admin = require('firebase-admin');
const path = require('path');

const app = express();

// 1. Conexión a Firebase
const serviceAccount = require("./firebase-key.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 2. Configuraciones
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// 3. Rutas de Autenticación

app.get('/', (req, res) => {
    res.render('login');
});

// Ruta temporal para crear/resetear el usuario (Visítala primero: localhost:3000/setup)
app.get('/setup', async (req, res) => {
    try {
        await db.collection('usuarios').doc('admin@futbol.com').set({
            password: 'admin123',
            rol: 'admin',
            nombre: 'Administrador Global'
        });
        res.send("<h1>Usuario admin@futbol.com con clave admin123 creado/resetado.</h1><a href='/'>Ir al Login</a>");
    } catch (error) {
        res.send("Error al crear usuario: " + error.message);
    }
});

app.post('/login', async (req, res) => {
    const usuarioInput = req.body.usuario ? req.body.usuario.trim() : "";
    const passwordInput = req.body.password ? req.body.password.trim() : "";

    // LOGIN MAESTRO (Si esto coincide, entra sin ir a Firebase)
    if (usuarioInput === "admin@futbol.com" && passwordInput === "admin123") {
        console.log("Login exitoso con usuario maestro");
        return res.redirect('/admin');
    }

    try {
        // Intento normal por Firebase (si quieres usar otros usuarios después)
        const userDoc = await db.collection('usuarios').doc(usuarioInput).get();
        if (userDoc.exists && userDoc.data().password === passwordInput) {
            return res.redirect('/admin');
        }
        res.send("<h1>Usuario o contraseña incorrectos</h1><a href='/'>Volver</a>");
    } catch (error) {
        res.status(500).send("Error: " + error.message);
    }
});

// 4. Rutas del Sistema

app.get('/admin', (req, res) => {
    res.render('admin'); 
});

app.get('/nueva-federacion', (req, res) => {
    res.render('federacion_registro');
});

app.post('/guardar-federacion', async (req, res) => {
    try {
        const { id, nombre, fundacion, departamento, municipio, complemento } = req.body;
        
        const doc = await db.collection('federaciones').doc(id).get();
        if (doc.exists) {
            return res.send("<h1>Error: El ID ya existe.</h1><a href='/nueva-federacion'>Volver</a>");
        }

        await db.collection('federaciones').doc(id).set({
            nombre,
            fecha_fundacion: fundacion,
            direccion: { departamento, municipio, complemento }
        });

        res.send("<h1>Federación guardada con éxito</h1><a href='/admin'>Volver al Panel</a>");
    } catch (error) {
        res.status(500).send("Error: " + error.message);
    }
});

// 5. Encendido del servidor 
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});