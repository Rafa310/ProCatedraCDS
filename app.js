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

// Variable global simulada para mantener el usuario activo 
let usuarioSesion = null;

// 3. Rutas de Autenticación
app.get('/', (req, res) => {
    res.render('login', { error: null });
});

app.get('/setup-usuarios', async (req, res) => {
    try {
        const lote = db.batch();
        lote.set(db.collection('usuarios').doc('admin@futbol.com'), { password: 'admin123', rol: 'admin', nombre: 'Administrador Global' });
        lote.set(db.collection('usuarios').doc('encargado@futbol.com'), { password: 'encargado123', rol: 'encargado', nombre: 'Gestor de Federación' });
        lote.set(db.collection('usuarios').doc('delegado@futbol.com'), { password: 'delegado123', rol: 'delegado', nombre: 'Delegado de Zona' });
        await lote.commit();
        res.send("<h1>Usuarios inyectados con éxito.</h1><a href='/'>Ir al Login</a>");
    } catch (e) { res.send("Error: " + e.message); }
});

app.post('/login', async (req, res) => {
    const usuarioInput = req.body.usuario ? req.body.usuario.trim() : "";
    const passwordInput = req.body.password ? req.body.password.trim() : "";

    try {
        const userDoc = await db.collection('usuarios').doc(usuarioInput).get();
        if (userDoc.exists && userDoc.data().password === passwordInput) {
            usuarioSesion = userDoc.data();
            return res.render('admin', { user: usuarioSesion });
        }
        return res.render('login', { error: 'Usuario o contraseña incorrectos.' });
    } catch (error) { res.status(500).send("Error: " + error.message); }
});

// 4. Panel Principal
app.get('/admin', (req, res) => {
    if (!usuarioSesion) return res.redirect('/');
    res.render('admin', { user: usuarioSesion });
});

// 5. Gestión de Federaciones (Solo Admin)
app.get('/nueva-federacion', (req, res) => {
    if (!usuarioSesion || usuarioSesion.rol !== 'admin') return res.send("<h1>Acceso Denegado: Solo el Administrador puede crear Federaciones.</h1>");
    res.render('federacion_registro', { user: usuarioSesion });
});

app.post('/guardar-federacion', async (req, res) => {
    if (!usuarioSesion || usuarioSesion.rol !== 'admin') return res.status(403).send("No autorizado");
    const { id, nombre, fundacion, departamento, municipio, complemento } = req.body;
    await db.collection('federaciones').doc(id).set({
        nombre, fecha_fundacion: fundacion,
        direccion: { departamento, municipio, complemento }
    });
    res.redirect('/admin');
});

// 6. Gestión de Equipos (Admin y Gestor)
app.get('/nuevo-equipo', async (req, res) => {
    if (!usuarioSesion || (usuarioSesion.rol !== 'admin' && usuarioSesion.rol !== 'encargado')) {
        return res.send("<h1>Acceso Denegado.</h1>");
    }
    const snapshot = await db.collection('federaciones').get();
    const federaciones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('equipo_registro', { federaciones, user: usuarioSesion });
});

app.post('/guardar-equipo', async (req, res) => {
    const { id, nombre, id_federacion } = req.body;
    await db.collection('equipos').doc(id).set({ nombre, id_federacion });
    res.redirect('/admin');
});

// 7. Gestión de Jugadores (Admin y Delegado)
app.get('/nuevo-jugador', async (req, res) => {
    if (!usuarioSesion || (usuarioSesion.rol !== 'admin' && usuarioSesion.rol !== 'delegado')) {
        return res.send("<h1>Acceso Denegado.</h1>");
    }
    const snapshot = await db.collection('equipos').get();
    const equipos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('jugador_registro', { equipos, user: usuarioSesion });
});

// Formulario para crear usuarios (Solo para el Administrador)
app.get('/nuevo-usuario', async (req, res) => {
    if (!usuarioSesion || usuarioSesion.rol !== 'admin') {
        return res.send("<h1>Acceso Denegado: Solo el Administrador Global puede gestionar usuarios.</h1>");
    }
    try {
        const snapshot = await db.collection('federaciones').get();
        const federaciones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.render('usuario_registro', { federaciones, user: usuarioSesion });
    } catch (error) {
        res.status(500).send("Error al cargar dependencias: " + error.message);
    }
});

// Procesar el guardado del nuevo usuario en Firestore
app.post('/guardar-usuario', async (req, res) => {
    if (!usuarioSesion || usuarioSesion.rol !== 'admin') return res.status(403).send("No autorizado");
    
    const { correo, password, nombre, apellido, cargo, id_federacion } = req.body;
    const emailClimpio = correo.trim();

    try {
        // Validación de Calidad: Evitar cuentas duplicadas
        const userCheck = await db.collection('usuarios').doc(emailClimpio).get();
        if (userCheck.exists) {
            return res.send("<h1>Error de Calidad: El correo electrónico ya está registrado en el sistema.</h1><a href='/nuevo-usuario'>Volver</a>");
        }

        // Estructura del nuevo usuario
        const nuevoUsuario = {
            nombre: `${nombre} ${apellido}`,
            password: password.trim(),
            rol: cargo, // admin, encargado, delegado
            id_federacion: cargo === 'admin' ? 'GLOBAL' : id_federacion
        };

        await db.collection('usuarios').doc(emailClimpio).set(nuevoUsuario);
        res.send("<h1>Usuario institucional registrado con éxito.</h1><a href='/admin'>Volver al Panel</a>");
    } catch (error) {
        res.status(500).send("Error al registrar usuario: " + error.message);
    }
});

app.post('/guardar-jugador', async (req, res) => {
    const { id, nombre, nacimiento, genero, id_equipo } = req.body;
    
    // VALIDACIÓN CRÍTICA DE CALIDAD: Evitar duplicidad del jugador en otros equipos
    const jugadorDoc = await db.collection('jugadores').doc(id).get();
    if (jugadorDoc.exists) {
        return res.send("<h1>Error de Negocio: El jugador ya está inscrito en un equipo del sistema.</h1><a href='/nuevo-jugador'>Volver</a>");
    }

    await db.collection('jugadores').doc(id).set({
        nombre, fecha_nacimiento: nacimiento, genero, id_equipo
    });
    res.redirect('/reporte');
});

// 8. Visualización de Reportes y Eliminación (Cumpliendo el requerimiento extra)
app.get('/reporte', async (req, res) => {
    if (!usuarioSesion) return res.redirect('/');
    const snapshot = await db.collection('jugadores').get();
    const jugadores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('reporte', { jugadores, user: usuarioSesion });
});

app.post('/eliminar-jugador/:id', async (req, res) => {
    if (!usuarioSesion || usuarioSesion.rol === 'delegado') {
        return res.send("<h1>Acceso Denegado: Los delegados no pueden dar de baja jugadores.</h1>");
    }
    const id = req.params.id;
    await db.collection('jugadores').doc(id).delete();
    res.redirect('/reporte');
});

// Cierre de sesión seguro
app.get('/logout', (req, res) => {
    usuarioSesion = null;
    res.redirect('/');
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor con RBAC activo en http://localhost:${PORT}`));