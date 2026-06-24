/**
 * SECRETARY DASHBOARD LOGIC
 * =========================
 */

class SecretaryDashboard {
    constructor() {
        this.currentUser = null;
        this.currentUserData = null;
        this.allCitas = [];
        this.init();
    }

    async init() {
        console.log('🏥 Initializing Secretary Dashboard...');
        
        try {
            await waitForFirebase();
            
            // Verify authentication
            const user = getCurrentUser();
            if (!user) {
                window.location.href = '../index.html';
                return;
            }

            this.currentUser = user.uid;
            await this.loadUserData();
            this.setupEventListeners();
            this.loadResumen();
            this.loadNotificaciones();
        } catch (error) {
            console.error('Dashboard init error:', error);
            alert('Error inicializando dashboard: ' + error.message);
        }
    }

    async loadUserData() {
        const result = await getUserData(this.currentUser);
        if (result.success) {
            this.currentUserData = result.data;
            document.getElementById('userName').textContent = 
                `${result.data.nombre} ${result.data.apellido}`;
            document.getElementById('userInitials').textContent = 
                `${result.data.nombre.charAt(0)}${result.data.apellido.charAt(0)}`.toUpperCase();
            
            // Load profile data
            document.getElementById('profileNombre').value = result.data.nombre;
            document.getElementById('profileApellido').value = result.data.apellido;
            document.getElementById('profileEmail').value = result.data.email;
            document.getElementById('profileTelefono').value = result.data.telefono;
        }
    }

    setupEventListeners() {
        // Menu navigation
        document.querySelectorAll('.menu-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchSection(e.target.closest('a').dataset.section);
            });
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            await this.logout();
        });

        // Filter citas
        document.getElementById('filterEstado').addEventListener('change', () => this.filterCitas());

        // Search pacientes
        document.getElementById('searchPaciente').addEventListener('input', (e) => this.searchPacientes(e.target.value));
    }

    switchSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
        
        // Remove active class from all menu links
        document.querySelectorAll('.menu-link').forEach(link => {
            link.classList.remove('active');
        });

        // Show selected section
        const section = document.getElementById(sectionName);
        if (section) {
            section.style.display = 'block';
        }

        // Add active class to clicked link
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        // Load data if needed
        if (sectionName === 'todas-citas') {
            this.loadAllCitas();
        } else if (sectionName === 'medicos') {
            this.loadMedicos();
        } else if (sectionName === 'pacientes') {
            this.loadPacientes();
        } else if (sectionName === 'notificaciones') {
            this.loadNotificaciones();
        }
    }

    async loadResumen() {
        await this.loadCitasResumen();
        await this.loadCounts();
    }

    async loadCitasResumen() {
        const tbody = document.getElementById('proximasTableBody');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Cargando citas...</td></tr>';

        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const snapshot = await db.collection('citas')
                .where('fecha', '>=', today)
                .where('fecha', '<', tomorrow)
                .orderBy('fecha')
                .limit(10)
                .get();

            if (snapshot.docs.length > 0) {
                tbody.innerHTML = '';
                for (const doc of snapshot.docs) {
                    const cita = doc.data();
                    const paciente = await this.getPatientName(cita.paciente_id);
                    const medico = await this.getDoctorName(cita.medico_id);
                    const fecha = new Date(cita.fecha.seconds * 1000).toLocaleDateString('es-ES');
                    const statusClass = `status-${cita.estado}`;
                    
                    tbody.innerHTML += `
                        <tr>
                            <td>${fecha}</td>
                            <td>${cita.hora}</td>
                            <td>${paciente}</td>
                            <td>${medico}</td>
                            <td><span class="status-badge ${statusClass}">${cita.estado}</span></td>
                        </tr>
                    `;
                }
            } else {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay citas para hoy</td></tr>';
            }
        } catch (error) {
            console.error('Error loading resumen citas:', error);
        }
    }

    async loadCounts() {
        try {
            // Today's citas
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const citasSnapshot = await db.collection('citas')
                .where('fecha', '>=', today)
                .where('fecha', '<', tomorrow)
                .get();
            document.getElementById('citasHoyCount').textContent = citasSnapshot.docs.length;

            // Doctors count
            const doctorsSnapshot = await db.collection('users')
                .where('tipo', '==', 'doctor')
                .get();
            document.getElementById('medicosCount').textContent = doctorsSnapshot.docs.length;

            // Patients count
            const patientsSnapshot = await db.collection('users')
                .where('tipo', '==', 'patient')
                .get();
            document.getElementById('pacientesCount').textContent = patientsSnapshot.docs.length;

            // Pending citas
            const pendientesSnapshot = await db.collection('citas')
                .where('estado', '==', 'solicitado')
                .get();
            document.getElementById('pendientesCount').textContent = pendientesSnapshot.docs.length;
        } catch (error) {
            console.error('Error loading counts:', error);
        }
    }

    async loadAllCitas() {
        const tbody = document.getElementById('todasCitasTableBody');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando citas...</td></tr>';

        try {
            const snapshot = await db.collection('citas')
                .orderBy('fecha', 'desc')
                .limit(100)
                .get();

            this.allCitas = [];
            if (snapshot.docs.length > 0) {
                tbody.innerHTML = '';
                for (const doc of snapshot.docs) {
                    const cita = doc.data();
                    this.allCitas.push({ id: doc.id, ...cita });
                    
                    const paciente = await this.getPatientName(cita.paciente_id);
                    const medico = await this.getDoctorName(cita.medico_id);
                    const fecha = new Date(cita.fecha.seconds * 1000).toLocaleDateString('es-ES');
                    const statusClass = `status-${cita.estado}`;
                    
                    tbody.innerHTML += `
                        <tr>
                            <td>${fecha}</td>
                            <td>${cita.hora}</td>
                            <td>${paciente}</td>
                            <td>${medico}</td>
                            <td>${cita.especialidad}</td>
                            <td><span class="status-badge ${statusClass}">${cita.estado}</span></td>
                            <td>
                                <button class="btn-secondary" style="padding: 5px 10px; font-size: 12px;" onclick="secretaryDashboard.viewCitaDetail('${doc.id}')">Ver</button>
                            </td>
                        </tr>
                    `;
                }
            } else {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay citas</td></tr>';
            }
        } catch (error) {
            console.error('Error loading all citas:', error);
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Error cargando citas</td></tr>';
        }
    }

    filterCitas() {
        const selectedEstado = document.getElementById('filterEstado').value;
        const tbody = document.getElementById('todasCitasTableBody');
        
        if (!selectedEstado) {
            this.loadAllCitas();
            return;
        }

        tbody.innerHTML = '';
        const filtered = this.allCitas.filter(cita => cita.estado === selectedEstado);
        
        if (filtered.length > 0) {
            filtered.forEach(async (cita) => {
                const paciente = await this.getPatientName(cita.paciente_id);
                const medico = await this.getDoctorName(cita.medico_id);
                const fecha = new Date(cita.fecha.seconds * 1000).toLocaleDateString('es-ES');
                const statusClass = `status-${cita.estado}`;
                
                tbody.innerHTML += `
                    <tr>
                        <td>${fecha}</td>
                        <td>${cita.hora}</td>
                        <td>${paciente}</td>
                        <td>${medico}</td>
                        <td>${cita.especialidad}</td>
                        <td><span class="status-badge ${statusClass}">${cita.estado}</span></td>
                        <td>
                            <button class="btn-secondary" style="padding: 5px 10px; font-size: 12px;" onclick="secretaryDashboard.viewCitaDetail('${cita.id}')">Ver</button>
                        </td>
                    </tr>
                `;
            });
        } else {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center">No hay citas con estado "${selectedEstado}"</td></tr>`;
        }
    }

    async viewCitaDetail(citaId) {
        try {
            const doc = await db.collection('citas').doc(citaId).get();
            if (doc.exists) {
                const cita = doc.data();
                const paciente = await this.getPatientName(cita.paciente_id);
                const medico = await this.getDoctorName(cita.medico_id);
                const fecha = new Date(cita.fecha.seconds * 1000).toLocaleString('es-ES');
                
                alert(`
Detalles de la Cita:
━━━━━━━━━━━━━━━━━━━━━━━━
Paciente: ${paciente}
Médico: ${medico}
Fecha: ${fecha}
Hora: ${cita.hora}
Especialidad: ${cita.especialidad}
Estado: ${cita.estado}
Motivo: ${cita.motivo || 'No especificado'}
Notas: ${cita.notas || 'Sin notas'}
                `);
            }
        } catch (error) {
            console.error('Error loading cita detail:', error);
            alert('Error cargando detalles de cita');
        }
    }

    async loadMedicos() {
        const container = document.getElementById('medicosList');
        container.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">Cargando médicos...</p>';

        try {
            const snapshot = await db.collection('users')
                .where('tipo', '==', 'doctor')
                .get();

            if (snapshot.docs.length > 0) {
                container.innerHTML = '';
                snapshot.docs.forEach(doc => {
                    const medico = doc.data();
                    container.innerHTML += `
                        <div class="card">
                            <h4 style="color: var(--primary-color); margin-bottom: 10px;">
                                Dr. ${medico.nombre} ${medico.apellido}
                            </h4>
                            <p><strong>Especialidad:</strong> ${medico.especialidad}</p>
                            <p><strong>Email:</strong> ${medico.email}</p>
                            <p><strong>Teléfono:</strong> ${medico.telefono}</p>
                        </div>
                    `;
                });
            } else {
                container.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">No hay médicos registrados</p>';
            }
        } catch (error) {
            console.error('Error loading doctors:', error);
            container.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">Error cargando médicos</p>';
        }
    }

    async loadPacientes() {
        const tbody = document.getElementById('pacientesTableBody');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Cargando pacientes...</td></tr>';

        try {
            const snapshot = await db.collection('users')
                .where('tipo', '==', 'patient')
                .get();

            if (snapshot.docs.length > 0) {
                tbody.innerHTML = '';
                snapshot.docs.forEach(doc => {
                    const paciente = doc.data();
                    const fecha = new Date(paciente.createdAt.seconds * 1000).toLocaleDateString('es-ES');
                    
                    tbody.innerHTML += `
                        <tr>
                            <td>${paciente.nombre}</td>
                            <td>${paciente.apellido}</td>
                            <td>${paciente.email}</td>
                            <td>${paciente.telefono}</td>
                            <td>${fecha}</td>
                        </tr>
                    `;
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay pacientes registrados</td></tr>';
            }
        } catch (error) {
            console.error('Error loading patients:', error);
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Error cargando pacientes</td></tr>';
        }
    }

    async searchPacientes(searchTerm) {
        const tbody = document.getElementById('pacientesTableBody');
        
        if (!searchTerm.trim()) {
            this.loadPacientes();
            return;
        }

        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Buscando...</td></tr>';

        try {
            const snapshot = await db.collection('users')
                .where('tipo', '==', 'patient')
                .get();

            const filtered = snapshot.docs.filter(doc => {
                const paciente = doc.data();
                const fullName = `${paciente.nombre} ${paciente.apellido}`.toLowerCase();
                return fullName.includes(searchTerm.toLowerCase());
            });

            if (filtered.length > 0) {
                tbody.innerHTML = '';
                filtered.forEach(doc => {
                    const paciente = doc.data();
                    const fecha = new Date(paciente.createdAt.seconds * 1000).toLocaleDateString('es-ES');
                    
                    tbody.innerHTML += `
                        <tr>
                            <td>${paciente.nombre}</td>
                            <td>${paciente.apellido}</td>
                            <td>${paciente.email}</td>
                            <td>${paciente.telefono}</td>
                            <td>${fecha}</td>
                        </tr>
                    `;
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No se encontraron resultados</td></tr>';
            }
        } catch (error) {
            console.error('Error searching patients:', error);
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Error en la búsqueda</td></tr>';
        }
    }

    async loadNotificaciones() {
        const container = document.getElementById('notificacionesList');
        container.innerHTML = '<p class="text-center">Cargando notificaciones...</p>';

        const result = await getUserNotifications(this.currentUser);
        if (result.success && result.notificaciones.length > 0) {
            container.innerHTML = '';
            result.notificaciones.forEach(notif => {
                const fecha = new Date(notif.createdAt.seconds * 1000).toLocaleDateString('es-ES');
                container.innerHTML += `
                    <div class="card">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div>
                                <h4 style="color: var(--primary-color); margin-bottom: 5px;">${notif.titulo}</h4>
                                <p>${notif.mensaje}</p>
                                <small style="color: #999;">${fecha}</small>
                            </div>
                            <button class="btn-secondary" style="padding: 5px 10px; font-size: 12px;" onclick="secretaryDashboard.markNotificationRead('${notif.id}')">Marcar como leída</button>
                        </div>
                    </div>
                `;
            });
        } else {
            container.innerHTML = '<p class="text-center">No hay notificaciones</p>';
        }
    }

    async getPatientName(pacienteId) {
        try {
            const doc = await db.collection('users').doc(pacienteId).get();
            if (doc.exists) {
                const data = doc.data();
                return `${data.nombre} ${data.apellido}`;
            }
        } catch (error) {
            console.error('Error getting patient name:', error);
        }
        return 'Desconocido';
    }

    async getDoctorName(medicoId) {
        try {
            const doc = await db.collection('users').doc(medicoId).get();
            if (doc.exists) {
                const data = doc.data();
                return `Dr. ${data.nombre} ${data.apellido}`;
            }
        } catch (error) {
            console.error('Error getting doctor name:', error);
        }
        return 'Desconocido';
    }

    async markNotificationRead(notificacionId) {
        const result = await markNotificationAsRead(notificacionId);
        if (result.success) {
            this.loadNotificaciones();
        }
    }

    async logout() {
        if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
            const result = await logoutUser();
            if (result.success) {
                window.location.href = '../index.html';
            } else {
                alert('Error: ' + result.error);
            }
        }
    }
}

// Initialize dashboard
let secretaryDashboard;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        secretaryDashboard = new SecretaryDashboard();
    });
} else {
    secretaryDashboard = new SecretaryDashboard();
}

console.log('✓ Secretary dashboard logic loaded');
