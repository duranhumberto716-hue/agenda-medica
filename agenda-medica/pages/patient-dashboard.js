/**
 * PATIENT DASHBOARD LOGIC
 * =======================
 */

class PatientDashboard {
    constructor() {
        this.currentUser = null;
        this.currentUserData = null;
        this.init();
    }

    async init() {
        console.log('🏥 Initializing Patient Dashboard...');
        
        try {
            await waitForFirebase();
            
            // Verificar autenticación
            const user = getCurrentUser();
            if (!user) {
                window.location.href = '../index.html';
                return;
            }

            this.currentUser = user.uid;
            await this.loadUserData();
            this.setupEventListeners();
            this.loadCitas();
            this.loadNotificaciones();
            this.setDefaultDate();
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
            
            // Cargar datos en perfil
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

        // Nueva cita form
        document.getElementById('nuevaCitaForm').addEventListener('submit', (e) => this.handleNuevaCita(e));

        // Close modals
        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal').style.display = 'none';
            });
        });

        // Load doctors when specialty changes
        document.getElementById('especialidad').addEventListener('change', () => this.loadDoctors());
        document.getElementById('medico').addEventListener('change', () => this.loadAvailableHours());
        document.getElementById('fecha').addEventListener('change', () => this.loadAvailableHours());
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

        // Reload data if needed
        if (sectionName === 'citas') {
            this.loadCitas();
        } else if (sectionName === 'historial') {
            this.loadHistorial();
        } else if (sectionName === 'notificaciones') {
            this.loadNotificaciones();
        }
    }

    async loadCitas() {
        const tbody = document.getElementById('citasTableBody');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando citas...</td></tr>';

        const result = await getPatientCitas(this.currentUser);
        if (result.success && result.citas.length > 0) {
            tbody.innerHTML = '';
            result.citas.forEach(cita => {
                // Solo mostrar citas futuras/activas
                if (['solicitado', 'aceptado'].includes(cita.estado)) {
                    tbody.innerHTML += this.createCitaRow(cita);
                }
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No tienes citas pendientes</td></tr>';
        }
    }

    createCitaRow(cita) {
        const fecha = new Date(cita.fecha.seconds * 1000).toLocaleDateString('es-ES');
        const statusClass = `status-${cita.estado}`;
        
        return `
            <tr>
                <td>${fecha}</td>
                <td>${cita.hora}</td>
                <td>${cita.medico_nombre || 'Pendiente'}</td>
                <td>${cita.especialidad}</td>
                <td><span class="status-badge ${statusClass}">${cita.estado.charAt(0).toUpperCase() + cita.estado.slice(1)}</span></td>
                <td>
                    <button class="btn-secondary" onclick="patientDashboard.viewCitaDetail('${cita.id}')">Ver</button>
                </td>
            </tr>
        `;
    }

    async loadHistorial() {
        const tbody = document.getElementById('historialTableBody');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Cargando historial...</td></tr>';

        const result = await getPatientCitas(this.currentUser);
        if (result.success) {
            const completadas = result.citas.filter(c => ['realizado', 'cancelado'].includes(c.estado));
            if (completadas.length > 0) {
                tbody.innerHTML = '';
                completadas.forEach(cita => {
                    const fecha = new Date(cita.fecha.seconds * 1000).toLocaleDateString('es-ES');
                    const statusClass = `status-${cita.estado}`;
                    tbody.innerHTML += `
                        <tr>
                            <td>${fecha}</td>
                            <td>${cita.medico_nombre || 'N/A'}</td>
                            <td>${cita.especialidad}</td>
                            <td><span class="status-badge ${statusClass}">${cita.estado.charAt(0).toUpperCase() + cita.estado.slice(1)}</span></td>
                            <td>
                                <button class="btn-secondary" onclick="patientDashboard.viewCitaDetail('${cita.id}')">Ver</button>
                            </td>
                        </tr>
                    `;
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay historial disponible</td></tr>';
            }
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
                            <button class="btn-secondary" style="padding: 5px 10px; font-size: 12px;" onclick="patientDashboard.markNotificationRead('${notif.id}')">Marcar como leída</button>
                        </div>
                    </div>
                `;
            });
        } else {
            container.innerHTML = '<p class="text-center">No hay notificaciones</p>';
        }
    }

    async loadDoctors() {
        const especialidad = document.getElementById('especialidad').value;
        const medicoSelect = document.getElementById('medico');
        medicoSelect.innerHTML = '<option value="">Cargando médicos...</option>';

        if (!especialidad) {
            medicoSelect.innerHTML = '<option value="">Selecciona especialidad primero</option>';
            return;
        }

        try {
            // Esta es una simplificación. En producción, usarías una query a Firestore
            const snapshot = await db.collection('users')
                .where('tipo', '==', 'doctor')
                .where('especialidad', '==', especialidad)
                .get();

            medicoSelect.innerHTML = '<option value="">Selecciona médico</option>';
            
            if (snapshot.docs.length > 0) {
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    medicoSelect.innerHTML += `
                        <option value="${doc.id}">${data.nombre} ${data.apellido}</option>
                    `;
                });
            } else {
                medicoSelect.innerHTML = '<option value="">No hay médicos disponibles</option>';
            }
        } catch (error) {
            console.error('Error loading doctors:', error);
            medicoSelect.innerHTML = '<option value="">Error cargando médicos</option>';
        }
    }

    async loadAvailableHours() {
        const medico = document.getElementById('medico').value;
        const fecha = document.getElementById('fecha').value;
        const horaSelect = document.getElementById('hora');
        horaSelect.innerHTML = '<option value="">Cargando horarios...</option>';

        if (!medico || !fecha) {
            horaSelect.innerHTML = '<option value="">Selecciona médico y fecha</option>';
            return;
        }

        try {
            // Generar horas disponibles (9:00 a 17:00, cada 30 minutos)
            const horas = [];
            for (let h = 9; h < 17; h++) {
                for (let m = 0; m < 60; m += 30) {
                    horas.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                }
            }

            horaSelect.innerHTML = '<option value="">Selecciona hora</option>';
            horas.forEach(hora => {
                horaSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
            });
        } catch (error) {
            console.error('Error loading hours:', error);
        }
    }

    setDefaultDate() {
        // Set minimum date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('fecha').setAttribute('min', today);
    }

    async handleNuevaCita(e) {
        e.preventDefault();

        const especialidad = document.getElementById('especialidad').value;
        const medico = document.getElementById('medico').value;
        const fecha = document.getElementById('fecha').value;
        const hora = document.getElementById('hora').value;
        const motivo = document.getElementById('motivo').value;

        if (!especialidad || !medico || !fecha || !hora) {
            alert('Por favor completa todos los campos requeridos');
            return;
        }

        try {
            const result = await createCita({
                paciente_id: this.currentUser,
                medico_id: medico,
                fecha: new Date(fecha),
                hora: hora,
                especialidad: especialidad,
                motivo: motivo,
                estado: 'solicitado'
            });

            if (result.success) {
                alert('¡Cita solicitada exitosamente!');
                document.getElementById('nuevaCitaForm').reset();
                this.switchSection('citas');
                this.loadCitas();
            } else {
                alert('Error: ' + result.error);
            }
        } catch (error) {
            console.error('Error creating cita:', error);
            alert('Error solicitando cita: ' + error.message);
        }
    }

    async viewCitaDetail(citaId) {
        try {
            const doc = await db.collection('citas').doc(citaId).get();
            if (doc.exists) {
                const cita = doc.data();
                const fecha = new Date(cita.fecha.seconds * 1000).toLocaleDateString('es-ES');
                
                const content = document.getElementById('citaDetailContent');
                content.innerHTML = `
                    <div style="display: grid; gap: 15px;">
                        <div>
                            <strong>Fecha:</strong> ${fecha}
                        </div>
                        <div>
                            <strong>Hora:</strong> ${cita.hora}
                        </div>
                        <div>
                            <strong>Especialidad:</strong> ${cita.especialidad}
                        </div>
                        <div>
                            <strong>Médico:</strong> ${cita.medico_nombre || 'Pendiente de asignación'}
                        </div>
                        <div>
                            <strong>Estado:</strong> <span class="status-badge status-${cita.estado}">${cita.estado}</span>
                        </div>
                        <div>
                            <strong>Motivo:</strong> ${cita.motivo || 'No especificado'}
                        </div>
                        ${cita.notas ? `<div><strong>Notas:</strong> ${cita.notas}</div>` : ''}
                    </div>
                `;

                document.getElementById('cancelCitaBtn').onclick = () => this.cancelCita(citaId);
                document.getElementById('citaDetailModal').style.display = 'flex';
            }
        } catch (error) {
            console.error('Error loading cita detail:', error);
            alert('Error cargando detalles de cita');
        }
    }

    async cancelCita(citaId) {
        if (confirm('¿Estás seguro de que deseas cancelar esta cita?')) {
            const result = await updateCitaStatus(citaId, 'cancelado', 'Cancelado por el paciente');
            if (result.success) {
                alert('Cita cancelada exitosamente');
                document.getElementById('citaDetailModal').style.display = 'none';
                this.loadCitas();
            } else {
                alert('Error: ' + result.error);
            }
        }
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
let patientDashboard;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        patientDashboard = new PatientDashboard();
    });
} else {
    patientDashboard = new PatientDashboard();
}

console.log('✓ Patient dashboard logic loaded');
