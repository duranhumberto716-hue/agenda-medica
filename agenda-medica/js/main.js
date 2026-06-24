/**
 * MAIN APPLICATION LOGIC
 * ======================
 * Maneja autenticación, enrutamiento y navegación de la aplicación
 */

class MediApp {
    constructor() {
        this.currentUser = null;
        this.userType = null;
        this.init();
    }

    init() {
        console.log('🚀 Initializing MediApp...');
        this.setupEventListeners();
        this.checkAuthState();
    }

    setupEventListeners() {
        // Login Form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Signup Button
        const signupBtn = document.getElementById('signupBtn');
        if (signupBtn) {
            signupBtn.addEventListener('click', () => this.openSignupModal());
        }

        // Signup Form
        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => this.handleSignup(e));
        }

        // Modal close button
        const closeBtn = document.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeSignupModal());
        }

        // Modal close on outside click
        const modal = document.getElementById('signupModal');
        if (modal) {
            window.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeSignupModal();
                }
            });
        }

        // Mostrar especialidad si es médico
        const signupUserType = document.getElementById('signupUserType');
        if (signupUserType) {
            signupUserType.addEventListener('change', (e) => {
                const specialtyGroup = document.getElementById('specialtyGroup');
                if (specialtyGroup) {
                    specialtyGroup.style.display = e.target.value === 'doctor' ? 'flex' : 'none';
                }
            });
        }
    }

    /**
     * AUTENTICACIÓN
     */

    async handleLogin(e) {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const userType = document.getElementById('userType').value;
        const errorDiv = document.getElementById('errorMessage');

        if (!email || !password || !userType) {
            this.showError('Por favor completa todos los campos');
            return;
        }

        try {
            await waitForFirebase();
            
            const loginBtn = e.target.querySelector('button[type="submit"]');
            loginBtn.disabled = true;
            loginBtn.textContent = 'Iniciando sesión...';

            const result = await loginUser(email, password);

            if (result.success) {
                // Verificar que el tipo de usuario coincida
                const userData = await getUserData(result.uid);
                if (userData.success && userData.data.tipo === userType) {
                    this.currentUser = result.uid;
                    this.userType = userType;
                    this.redirectToDashboard(userType);
                } else {
                    this.showError('Tipo de usuario incorrecto');
                    await logoutUser();
                }
            } else {
                this.showError(result.error);
            }

            loginBtn.disabled = false;
            loginBtn.textContent = 'Iniciar Sesión';
        } catch (error) {
            this.showError(error.message);
            console.error('Login error:', error);
        }
    }

    async handleSignup(e) {
        e.preventDefault();

        const nombre = document.getElementById('firstName').value;
        const apellido = document.getElementById('lastName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const telefono = document.getElementById('phone').value;
        const userType = document.getElementById('signupUserType').value;
        const especialidad = document.getElementById('specialty')?.value || null;

        if (!nombre || !apellido || !email || !password || !telefono || !userType) {
            this.showError('Por favor completa todos los campos requeridos');
            return;
        }

        if (userType === 'doctor' && !especialidad) {
            this.showError('Por favor selecciona una especialidad');
            return;
        }

        try {
            await waitForFirebase();

            const signupBtn = e.target.querySelector('button[type="submit"]');
            signupBtn.disabled = true;
            signupBtn.textContent = 'Registrando...';

            const result = await createUser(email, password, {
                nombre: nombre,
                apellido: apellido,
                telefono: telefono,
                tipo: userType,
                especialidad: especialidad
            });

            if (result.success) {
                this.showSuccess('¡Registro exitoso! Por favor inicia sesión');
                this.closeSignupModal();
                document.getElementById('loginForm').reset();
                
                // Mostrar datos de login
                document.getElementById('email').value = email;
                document.getElementById('userType').value = userType;
            } else {
                this.showError(result.error);
            }

            signupBtn.disabled = false;
            signupBtn.textContent = 'Registrarse';
        } catch (error) {
            this.showError(error.message);
            console.error('Signup error:', error);
        }
    }

    checkAuthState() {
        onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user.uid;
                this.loadUserAndRedirect();
            } else {
                this.currentUser = null;
                this.userType = null;
            }
        });
    }

    async loadUserAndRedirect() {
        try {
            const userData = await getUserData(this.currentUser);
            if (userData.success) {
                this.userType = userData.data.tipo;
                this.redirectToDashboard(this.userType);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    redirectToDashboard(userType) {
        const dashboardMap = {
            'patient': 'pages/patient-dashboard.html',
            'secretary': 'pages/secretary-dashboard.html',
            'doctor': 'pages/doctor-dashboard.html'
        };

        const dashboardUrl = dashboardMap[userType];
        if (dashboardUrl) {
            window.location.href = dashboardUrl;
        } else {
            this.showError('Tipo de usuario no válido');
        }
    }

    /**
     * MODAL MANAGEMENT
     */

    openSignupModal() {
        const modal = document.getElementById('signupModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    closeSignupModal() {
        const modal = document.getElementById('signupModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * MENSAJES
     */

    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        } else {
            alert('Error: ' + message);
        }
    }

    showSuccess(message) {
        const errorDiv = document.getElementById('errorMessage');
        if (errorDiv) {
            errorDiv.className = 'success-message';
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
                errorDiv.className = 'error-message';
            }, 5000);
        } else {
            alert('Éxito: ' + message);
        }
    }
}

// Inicializar aplicación cuando DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new MediApp();
        window.app = app; // Hacer disponible globalmente para debugging
    });
} else {
    const app = new MediApp();
    window.app = app;
}

console.log('✓ Main application logic loaded');
