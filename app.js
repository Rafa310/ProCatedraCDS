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
app.get('/', (req, res) => res.render('login'));

app.get('/setup', async (req, res) => {
    try {
        await db.collection('usuarios').doc('admin@futbol.com').set({
            password: 'admin123', rol: 'admin', nombre: 'Admin'
        });
        res.send("<h1>Usuario Creado</h1><a href='/'>Ir al Login</a>");
    } catch (e) { res.send(e.message); }
});

app.get('/setup-roles', async (req, res) => {
    try {
        // 1. Encargado de Federación
        await db.collection('usuarios').doc('encargado@federacion.com').set({
            password: 'claveencargado',
            rol: 'encargado',
            nombre: 'Juan Pérez'
        });

        // 2. Designado por el Encargado
        await db.collection('usuarios').doc('designado@federacion.com').set({
            password: 'clavedesignado',
            rol: 'designado',
            nombre: 'Carlos López'
        });

        res.send("<h1>Usuarios de Encargado y Designado creados con éxito.</h1>");
    } catch (error) {
        res.send("Error: " + error.message);
    }
});

app.post('/login', async (req, res) => {
    const { usuario, password } = req.body;
    
    try {
        // Buscamos el usuario por su ID (correo) en la colección usuarios
        const userDoc = await db.collection('usuarios').doc(usuario).get();
        
        if (userDoc.exists) {
            const datos = userDoc.data();
            // Validamos la contraseña
            if (datos.password === password) {
                return res.redirect('/admin');
            }
        }
        res.send("<h1>Usuario o contraseña incorrectos</h1><a href='/'>Volver</a>");
    } catch (error) {
        res.status(500).send("Error en el servidor");
    }
});

// 4. Panel Principal
app.get('/admin', (req, res) => res.render('admin'));

// 5. Gestión de Federaciones
app.get('/nueva-federacion', (req, res) => res.render('federacion_registro'));

app.post('/guardar-federacion', async (req, res) => {
    const { id, nombre, fundacion, departamento, municipio, complemento } = req.body;
    await db.collection('federaciones').doc(id).set({
        nombre, fecha_fundacion: fundacion,
        direccion: { departamento, municipio, complemento }
    });
    res.redirect('/admin');
});

// 6. Gestión de Equipos (Carga las federaciones para el Select)
app.get('/nuevo-equipo', async (req, res) => {
    const snapshot = await db.collection('federaciones').get();
    const federaciones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('equipo_registro', { federaciones });
});

app.post('/guardar-equipo', async (req, res) => {
    const { id, nombre, id_federacion } = req.body;
    await db.collection('equipos').doc(id).set({ nombre, id_federacion });
    res.redirect('/admin');
});

// 7. Gestión de Jugadores (Carga los equipos para el Select)
app.get('/nuevo-jugador', async (req, res) => {
    const snapshot = await db.collection('equipos').get();
    const equipos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('jugador_registro', { equipos });
});

app.post('/guardar-jugador', async (req, res) => {
    const { id, nombre, nacimiento, genero, id_equipo } = req.body;
    await db.collection('jugadores').doc(id).set({
        nombre, fecha_nacimiento: nacimiento, genero, id_equipo
    });
    res.redirect('/admin');
});

// 8. Puerto
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});