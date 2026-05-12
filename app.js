const express = require('express');
const admin = require('firebase-admin');
const path = require('path');

const app = express();

// 1. Conexión a Firebase
const serviceAccount = require("./firebase-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore(); // Esta es nuestra base de datos

// 2. Configuraciones
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true })); // Para leer datos de los formularios

// 3. Rutas
app.get('/', (req, res) => {
    res.render('login');
});

// Ruta para procesar el login (Prueba)
app.post('/login', async (req, res) => {
    const { usuario, password } = req.body;
    console.log(`Intento de login: ${usuario}`);
    
    // Por ahora, como es prueba, nos mandará al panel principal
    res.redirect('/admin'); 
});

app.get('/admin', (req, res) => {
    res.send('<h1>Panel de Administración - ¡Próximamente!</h1>');
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});