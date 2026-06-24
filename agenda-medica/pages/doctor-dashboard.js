/**
 * DOCTOR DASHBOARD LOGIC
 * ======================
 */

class DoctorDashboard {
    constructor() {
        this.currentUser = null;
        this.currentUserData = null;
        this.init();
    }

    async init() {
        console.log('🏥 Initializing Doctor Dashboard...');
        
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
            this.loadCitasSolicitadas();
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
                `Dr/Dra. ${result.data.nombre} ${result.data.apellido}`;
            document.getElementById('userInitials').textContent = 
                `${result.data.nombre.charAt(0)}${result.data.apellido.charAt(0)}`.toUpperCase();
            
            // Load profile data
            document.getElementById('profileNombre').value = result.data.nombre;
            document.getElementById('profileApellido').value = result.data.apellido;
            document.getElementById('profileEmail').value = result.data.email;
            document.getElementById('profileTelefono').value = result.data.telefono;
            document.getElementById('profileEspecialidad').value = result.data.especialidad || 'No especificada';
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

        // Schedule form
        document.getElementById('horarioForm').addEventListener('submit', (e) => this.handleHorarioSubmit(e));

        // Close modals
        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal').style.display = 'none';
            });
        });
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
        if (sectionName === 'solicitadas') {
            this.loadCitasSolicitadas();
        } else if (sectionName === 'programadas') {
            this.loadCitasProgramadas();
        } else if (sectionName === 'completadas') {
            this.loadCitasCompletadas();
        } else if (sectionName === 'horarios') {
            this.loadHorarios();
        } else if (sectionName === 'notificaciones') {
            this.loadNotificaciones();
        }
    }

    async loadCitasSolicitadas() {
        const tbody = document.getElementById('solicitadasTableBody');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Cargando citas...</td></tr>';

        try {
            const snapshot = await db.collection('citas')
                .where('medico_id', '==', this.currentUser)
                .where('estado', '==', 'solicitado')
                .orderBy('fecha')
                .get();

            if (snapshot.docs.length > 0) {
                tbody.innerHTML = '';
                for (const doc of snapshot.docs) {
                    const cita = doc.data();
                    const paciente = await this.getPatientName(cita.paciente_id);
                    const fecha = new Date(cita.fecha.seconds * 1000).toLocaleDateString('es-ES');
                    
                    tbody.innerHTML += `
                        <tr>
                            <td>${fecha}</td>
                            <td>${cita.hora}</td>
                            <td>${paciente}</td>
                            <td>${cita.motivo || 'No especificado'}</td>
                            <td>
                                <button class="btn-secondary" onclick="doctorDashboard.viewCitaDetail('${doc.id}', 'solicitado')">Ver</button>
                            </td>
                        </tr>
                    `;
                }
            } else {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay citas solicitadas</td></tr>';
            }
        } catch (error) {
            console.error('Error loading solicited citas:', error);
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Error cargando citas</td></tr>';
        }
    }

    async loadCitasProgramadas() {
        const tbody = document.getElementById('programadasTableBody');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Cargando citas...</td></tr>';

        try {
            const snapshot = await db.collection('citas')
                .where('medico_id', '==', this.currentUser)
                .where('estado', '==', 'aceptado')
                .orderBy('fecha')
                .get();

            if (snapshot.docs.length > 0) {
                tbody.innerHTML = '';
                for (const doc of snapshot.docs) {
                    const cita = doc.data();
                    const paciente = await this.getPatientName(cita.paciente_id);
                    const fecha = new Date(cita.fecha.seconds * 1000).toLocaleDateString('es-ES');
                    
                    tbody.innerHTML += `
                        <tr>
                            <td>${fecha}</td>
                            <td>${cita.hora}</td>
                            <td>${paciente}</td>
                            <td>${cita.motivo || 'No especificado'}</td>
                            <td>
                                <button class="btn-secondary" onclick="doctorDashboard.viewCitaDetail('${doc.id}', 'aceptado')">Ver</button>
                            </td>
                        </tr>
                    `;
                }
            } else {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay citas programadas</td></tr>';
            }
        } catch (error) {
            console.error('Error loading programmed citas:', error);
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Error cargando citas</td></tr>';
        }
    }

    async loadCitasCompletadas() {
        const tbody = document.getElementById('completadasTableBody');
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando citas...</td></tr>';

        try {
            const snapshot = await db.collection('citas')
                .where('medico_id', '==', this.currentUser)
                .where('estado', 'in', ['realizado', 'cancelado'])
                .orderBy('fecha', 'desc')
                .get();

            if (snapshot.docs.length > 0) {
                tbody.innerHTML = '';
                for (const doc of snapshot.docs) {
                    const cita = doc.data();
                    const paciente = await this.getPatientName(cita.paciente_id);
                    const fecha = new Date(cita.fecha.seconds * 1000).toLocaleDateString('es-ES');
                    const statusClass = `status-${cita.estado}`;
                    
                    tbody.innerHTML += `
                        <tr>
                            <td>${fecha}</td>
                            <td>${paciente}</td>
                            <td><span class="status-badge ${statusClass}">${cita.estado}</span></td>
                            <td>
                                <button class="btn-secondary" onclick="doctorDashboard.viewCitaDetail('${doc.id}', '${cita.estado}')">Ver</button>
                            </td>
                        </tr>
                    `;
                }
            } else {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay citas completadas</td></tr>';
            }
        } catch (error) {
            console.error('Error loading completed citas:', error);
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Error cargando citas</td></tr>';
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
                            <button class="btn-secondary" style="padding: 5px 10px; font-size: 12px;" onclick="doctorDashboard.markNotificationRead('${notif.id}')">Marcar como leída</button>
                        </div>
                    </div>
                `;
            });
        } else {
            container.innerHTML = '<p class="text-center">No hay notificaciones</p>';
        }
    }

    async loadHorarios() {
        const tbody = document.getElementById('horariosTableBody');
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando horarios...</td></tr>';

        try {
            const snapshot = await db.collection('horarios')
                .where('medico_id', '==', this.currentUser)
                .get();

            if (snapshot.docs.length > 0) {
                tbody.innerHTML = '';
                snapshot.docs.forEach(doc => {
                    const horario = doc.data();
                    tbody.innerHTML += `
                        <tr>
                            <td>${this.capitalizeDia(horario.dia)}</td>
                            <td>${horario.horaInicio}</td>
                            <td>${horario.horaFin}</td>
                            <td>
                                <button class="btn-danger" onclick="doctorDashboard.deleteHorario('${doc.id}')">Eliminar</button>
                            </td>
                        </tr>
                    `;
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay horarios configurados</td></tr>';
            }
        } catch (error) {
            console.error('Error loading schedules:', error);
        }
    }

    async handleHorarioSubmit(e) {
        e.preventDefault();

        const dia = document.getElementById('dia').value;
        const horaInicio = document.getElementById('horaInicio').value;
        const horaFin = document.getElementById('horaFin').value;

        if (!dia || !horaInicio || !horaFin) {
            alert('Por favor completa todos los campos');
            return;
        }

        try {
            await db.collection('horarios').add({
                medico_id: this.currentUser,
                dia: dia,
                horaInicio: horaInicio,
                horaFin: horaFin,
                disponible: true,
                createdAt: new Date()
            });

            alert('¡Horario guardado exitosamente!');
            document.getElementById('horarioForm').reset();
            this.loadHorarios();
        } catch (error) {
            console.error('Error saving schedule:', error);
            alert('Error guardando horario: ' + error.message);
        }
    }

    async deleteHorario(horarioId) {
        if (confirm('¿Estás seguro de que deseas eliminar este horario?')) {
            try {
                await db.collection('horarios').doc(horarioId).delete();
                this.loadHorarios();
            } catch (error) {
                console.error('Error deleting schedule:', error);
                alert('Error eliminando horario');
            }
        }
    }

    async viewCitaDetail(citaId, estado) {
        try {
            const doc = await db.collection('citas').doc(citaId).get();
            if (doc.exists) {
                const cita = doc.data();
                const paciente = await this.getPatientName(cita.paciente_id);
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
                            <strong>Paciente:</strong> ${paciente}
                        </div>
                        <div>
                            <strong>Especialidad:</strong> ${cita.especialidad}
                        </div>
                        <div>
                            <strong>Motivo:</strong> ${cita.motivo || 'No especificado'}
                        </div>
                        <div>
                            <strong>Estado:</strong> <span class="status-badge status-${cita.estado}">${cita.estado}</span>
                        </div>
                        <div>
                            <label for="notasField" style="font-weight: 600;">Notas Médicas:</label>
                            <textarea id="notasField" placeholder="Añade notas sobre la cita..." rows="4">${cita.notas || ''}</textarea>
                        </div>
                    </div>
                `;

                // Show/hide action buttons based on state
                const aceptarBtn = document.getElementById('aceptarCitaBtn');
                const rechazarBtn = document.getElementById('rechazarCitaBtn');
                const completarBtn = document.getElementById('completarCitaBtn');

                aceptarBtn.style.display = 'none';
                rechazarBtn.style.display = 'none';
                completarBtn.style.display = 'none';

                if (estado === 'solicitado') {
                    aceptarBtn.style.display = 'inline-block';
                    rechazarBtn.style.display = 'inline-block';
                    aceptarBtn.onclick = () => this.aceptarCita(citaId);
                    rechazarBtn.onclick = () => this.rechazarCita(citaId);
                } else if (estado === 'aceptado') {
                    completarBtn.style.display = 'inline-block';
                    completarBtn.onclick = () => this.completarCita(citaId);
                }

                document.getElementById('citaDetailModal').style.display = 'flex';
                this.currentCitaId = citaId;
            }
        } catch (error) {
            console.error('Error loading cita detail:', error);
            alert('Error cargando detalles de cita');
        }
    }

    async aceptarCita(citaId) {
        const result = await updateCitaStatus(citaId, 'aceptado', 'Aceptada por el médico');
        if (result.success) {
            alert('¡Cita aceptada!');
            document.getElementById('citaDetailModal').style.display = 'none';
            this.loadCitasSolicitadas();
            this.loadCitasProgramadas();
        } else {
            alert('Error: ' + result.error);
        }
    }

    async rechazarCita(citaId) {
        const razon = prompt('¿Cuál es la razón del rechazo?', '');
        if (razon !== null) {
            const result = await updateCitaStatus(citaId, 'cancelado', 'Rechazada por el médico: ' + razon);
            if (result.success) {
                alert('¡Cita rechazada!');
                document.getElementById('citaDetailModal').style.display = 'none';
                this.loadCitasSolicitadas();
            } else {
                alert('Error: ' + result.error);
            }
        }
    }

    async completarCita(citaId) {
        const notas = document.getElementById('notasField').value;
        
        try {
            await db.collection('citas').doc(citaId).update({
                estado: 'realizado',
                notas: notas,
                completedAt: new Date()
            });

            // Register state change
            const citaDoc = await db.collection('citas').doc(citaId).get();
            const cita = citaDoc.data();
            
            await db.collection('historialEstados').add({
                cita_id: citaId,
                estado_anterior: 'aceptado',
                estado_nuevo: 'realizado',
                usuario_id: this.currentUser,
                razon: 'Completada por el médico',
                fecha: new Date()
            });

            // Create notification
            await createNotificacion(cita.paciente_id,
                'Cita Completada',
                'Tu cita ha sido completada exitosamente');

            alert('¡Cita marcada como realizada!');
            document.getElementById('citaDetailModal').style.display = 'none';
            this.loadCitasProgramadas();
            this.loadCitasCompletadas();
        } catch (error) {
            console.error('Error completing cita:', error);
            alert('Error: ' + error.message);
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

    capitalizeDia(dia) {
        const dias = {
            'lunes': 'Lunes',
            'martes': 'Martes',
            'miercoles': 'Miércoles',
            'jueves': 'Jueves',
            'viernes': 'Viernes'
        };
        return dias[dia.toLowerCase()] || dia;
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
let doctorDashboard;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        doctorDashboard = new DoctorDashboard();
    });
} else {
    doctorDashboard = new DoctorDashboard();
}

console.log('✓ Doctor dashboard logic loaded');
