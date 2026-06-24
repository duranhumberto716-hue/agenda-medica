/**
 * FIREBASE CONFIGURATION
 * ========================
 * Reemplaza los valores con tus propias credenciales de Firebase
 * Obtén estos valores desde: https://console.firebase.google.com
 */

// Importar Firebase SDK (desde CDN)
if (typeof firebase === 'undefined') {
    const script1 = document.createElement('script');
    script1.src = 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
    document.head.appendChild(script1);

    const script2 = document.createElement('script');
    script2.src = 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
    script2.onload = () => {
        const script3 = document.createElement('script');
        script3.src = 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';
        script3.onload = () => {
            const script4 = document.createElement('script');
            script4.src = 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
            document.head.appendChild(script4);
        };
        document.head.appendChild(script3);
    };
    document.head.appendChild(script1);
}

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Iniciailizar Firebase
let db;
let auth;
let realtimeDb;

// Esperar a que Firebase esté cargado
function initializeFirebase() {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        realtimeDb = firebase.database();
        console.log('✓ Firebase initialized successfully');
        return true;
    } else {
        console.log('⏳ Waiting for Firebase to load...');
        setTimeout(initializeFirebase, 500);
        return false;
    }
}

// Inicializar cuando DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFirebase);
} else {
    initializeFirebase();
}

/**
 * ESTRUCTURA DE DATOS EN FIREBASE (Firestore)
 * ==========================================
 * 
 * users/
 *   ├── uid/
 *   │   ├── email: string
 *   │   ├── nombre: string
 *   │   ├── apellido: string
 *   │   ├── telefono: string
 *   │   ├── tipo: "patient" | "secretary" | "doctor"
 *   │   ├── especialidad: string (solo para médicos)
 *   │   └── createdAt: timestamp
 *   
 * citas/
 *   ├── citaId/
 *   │   ├── paciente_id: string
 *   │   ├── medico_id: string
 *   │   ├── fecha: date
 *   │   ├── hora: string
 *   │   ├── especialidad: string
 *   │   ├── motivo: string
 *   │   ├── estado: "solicitado" | "aceptado" | "realizado" | "cancelado"
 *   │   ├── notas: string
 *   │   └── createdAt: timestamp
 *   
 * horarios/
 *   ├── medicoId/
 *   │   ├── dia: string (lunes, martes, ...)
 *   │   ├── horaInicio: string (HH:mm)
 *   │   ├── horaFin: string (HH:mm)
 *   │   └── disponible: boolean
 *   
 * notificaciones/
 *   ├── notificacionId/
 *   │   ├── usuario_id: string
 *   │   ├── tipo: string
 *   │   ├── mensaje: string
 *   │   ├── leida: boolean
 *   │   └── createdAt: timestamp
 *   
 * historialEstados/
 *   ├── entradaId/
 *   │   ├── cita_id: string
 *   │   ├── estado_anterior: string
 *   │   ├── estado_nuevo: string
 *   │   ├── usuario_id: string
 *   │   ├── razon: string
 *   │   └── fecha: timestamp
 */

/**
 * FUNCIONES AUXILIARES
 * ====================
 */

// Esperar a que Firebase esté disponible
async function waitForFirebase(timeout = 10000) {
    const startTime = Date.now();
    while (!auth || !db || !realtimeDb) {
        if (Date.now() - startTime > timeout) {
            throw new Error('Firebase initialization timeout');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

// Obtener usuario actual
function getCurrentUser() {
    return auth ? auth.currentUser : null;
}

// Escuchar cambios de autenticación
function onAuthStateChanged(callback) {
    if (auth) {
        auth.onAuthStateChanged(callback);
    }
}

// Crear nuevo usuario
async function createUser(email, password, userData) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;

        // Guardar datos adicionales en Firestore
        await db.collection('users').doc(uid).set({
            email: email,
            nombre: userData.nombre,
            apellido: userData.apellido,
            telefono: userData.telefono,
            tipo: userData.tipo,
            especialidad: userData.especialidad || null,
            createdAt: new Date(),
            activo: true
        });

        return { success: true, uid: uid };
    } catch (error) {
        console.error('Error creating user:', error);
        return { success: false, error: error.message };
    }
}

// Iniciar sesión
async function loginUser(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        return { success: true, uid: userCredential.user.uid };
    } catch (error) {
        console.error('Error logging in:', error);
        return { success: false, error: error.message };
    }
}

// Cerrar sesión
async function logoutUser() {
    try {
        await auth.signOut();
        return { success: true };
    } catch (error) {
        console.error('Error logging out:', error);
        return { success: false, error: error.message };
    }
}

// Obtener datos de usuario
async function getUserData(uid) {
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
            return { success: true, data: doc.data() };
        } else {
            return { success: false, error: 'User not found' };
        }
    } catch (error) {
        console.error('Error getting user data:', error);
        return { success: false, error: error.message };
    }
}

// Crear cita
async function createCita(citaData) {
    try {
        const docRef = await db.collection('citas').add({
            ...citaData,
            estado: 'solicitado',
            createdAt: new Date()
        });
        return { success: true, citaId: docRef.id };
    } catch (error) {
        console.error('Error creating cita:', error);
        return { success: false, error: error.message };
    }
}

// Obtener citas del paciente
async function getPatientCitas(pacienteId) {
    try {
        const snapshot = await db.collection('citas')
            .where('paciente_id', '==', pacienteId)
            .orderBy('fecha', 'desc')
            .get();

        const citas = [];
        snapshot.forEach(doc => {
            citas.push({ id: doc.id, ...doc.data() });
        });
        return { success: true, citas: citas };
    } catch (error) {
        console.error('Error getting patient citas:', error);
        return { success: false, error: error.message };
    }
}

// Actualizar estado de cita
async function updateCitaStatus(citaId, nuevoEstado, razon = '') {
    try {
        const citaDoc = await db.collection('citas').doc(citaId).get();
        const citaData = citaDoc.data();
        const estadoAnterior = citaData.estado;

        // Actualizar cita
        await db.collection('citas').doc(citaId).update({
            estado: nuevoEstado,
            updatedAt: new Date()
        });

        // Registrar en historial de estados
        await db.collection('historialEstados').add({
            cita_id: citaId,
            estado_anterior: estadoAnterior,
            estado_nuevo: nuevoEstado,
            usuario_id: getCurrentUser().uid,
            razon: razon,
            fecha: new Date()
        });

        // Crear notificación
        await createNotificacion(citaData.paciente_id, 
            `Tu cita ha sido ${nuevoEstado}`,
            `La cita para ${nuevoEstado === 'aceptado' ? 'el ' : ''}${nuevoEstado} por el médico`);

        return { success: true };
    } catch (error) {
        console.error('Error updating cita status:', error);
        return { success: false, error: error.message };
    }
}

// Crear notificación
async function createNotificacion(usuarioId, titulo, mensaje) {
    try {
        await db.collection('notificaciones').add({
            usuario_id: usuarioId,
            titulo: titulo,
            mensaje: mensaje,
            leida: false,
            createdAt: new Date()
        });
        return { success: true };
    } catch (error) {
        console.error('Error creating notificacion:', error);
        return { success: false, error: error.message };
    }
}

// Obtener notificaciones del usuario
async function getUserNotifications(usuarioId) {
    try {
        const snapshot = await db.collection('notificaciones')
            .where('usuario_id', '==', usuarioId)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        const notificaciones = [];
        snapshot.forEach(doc => {
            notificaciones.push({ id: doc.id, ...doc.data() });
        });
        return { success: true, notificaciones: notificaciones };
    } catch (error) {
        console.error('Error getting notifications:', error);
        return { success: false, error: error.message };
    }
}

// Marcar notificación como leída
async function markNotificationAsRead(notificacionId) {
    try {
        await db.collection('notificaciones').doc(notificacionId).update({
            leida: true
        });
        return { success: true };
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return { success: false, error: error.message };
    }
}

// Escuchar cambios en tiempo real de citas
function subscribeToUserCitas(usuarioId, callback) {
    return db.collection('citas')
        .where('paciente_id', '==', usuarioId)
        .onSnapshot(
            (snapshot) => {
                const citas = [];
                snapshot.forEach(doc => {
                    citas.push({ id: doc.id, ...doc.data() });
                });
                callback({ success: true, citas: citas });
            },
            (error) => {
                callback({ success: false, error: error.message });
            }
        );
}

console.log('✓ Firebase configuration loaded');
