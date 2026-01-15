// ========================================
// AUTHENTICATION - Fixed & Enhanced
// ========================================

// Prevent multiple initializations
let authInitialized = false;

// Initialize default admin user
function initializeDefaultUsers() {
    try {
        const users = getUsers();
        
        // Check if default admin exists
        const adminExists = users.some(u => u.email === 'hckthon2026@gmail.com');
        
        if (!adminExists) {
            const defaultAdmin = {
                id: 'admin_' + Date.now(),
                email: 'hckthon2026@gmail.com',
                password: 'hckthon2026',
                role: 'admin',
                firstName: 'Admin',
                lastName: 'User',
                createdAt: new Date().toISOString()
            };
            users.push(defaultAdmin);
            saveUsers(users);
            console.log('Default admin created');
        }
    } catch (error) {
        console.error('Error initializing default users:', error);
    }
}

// Safe localStorage access
function getUsers() {
    try {
        const usersData = localStorage.getItem('users');
        return usersData ? JSON.parse(usersData) : [];
    } catch (error) {
        console.error('Error reading users:', error);
        return [];
    }
}

function saveUsers(users) {
    try {
        localStorage.setItem('users', JSON.stringify(users));
    } catch (error) {
        console.error('Error saving users:', error);
        showToast('Error saving data', 'error');
    }
}

function getCurrentUser() {
    try {
        const userData = localStorage.getItem('currentUser');
        return userData ? JSON.parse(userData) : null;
    } catch (error) {
        console.error('Error reading current user:', error);
        return null;
    }
}

function saveCurrentUser(user) {
    try {
        localStorage.setItem('currentUser', JSON.stringify(user));
    } catch (error) {
        console.error('Error saving current user:', error);
    }
}

// Check existing session and redirect
function checkExistingSession() {
    const currentUser = getCurrentUser();
    
    if (currentUser) {
        // Only redirect if we're on the login page
        const currentPath = window.location.pathname;
        if (currentPath.endsWith('index.html') || currentPath.endsWith('/')) {
            try {
                if (currentUser.role === 'admin') {
                    window.location.href = 'admin.html';
                } else if (currentUser.role === 'student') {
                    window.location.href = 'user.html';
                }
            } catch (error) {
                console.error('Redirect error:', error);
                localStorage.removeItem('currentUser');
            }
        }
    }
}

// Toggle password visibility
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(inputId + 'Icon');
    
    if (!input || !icon) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// Show/hide forms
function showSignup() {
    document.getElementById('loginForm')?.classList.remove('active');
    document.getElementById('signupForm')?.classList.add('active');
}

function showLogin() {
    document.getElementById('signupForm')?.classList.remove('active');
    document.getElementById('loginForm')?.classList.add('active');
}

// Sanitize input
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[<>]/g, '');
}

// Validate email
function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Handle signup
function handleSignup(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    
    try {
        const formData = new FormData(e.target);
        const studentId = sanitizeInput(formData.get('student_id'));
        const firstName = sanitizeInput(formData.get('first_name'));
        const lastName = sanitizeInput(formData.get('last_name'));
        const email = sanitizeInput(formData.get('email')).toLowerCase();
        const password = formData.get('password');
        const confirmPassword = formData.get('confirm_password');
        
        // Validation
        if (!studentId || !firstName || !lastName || !email || !password) {
            showToast('Please fill in all fields', 'error');
            submitBtn.disabled = false;
            return;
        }
        
        if (!isValidEmail(email)) {
            showToast('Please enter a valid email address', 'error');
            submitBtn.disabled = false;
            return;
        }
        
        if (password.length < 6) {
            showToast('Password must be at least 6 characters long', 'error');
            submitBtn.disabled = false;
            return;
        }
        
        if (password !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            submitBtn.disabled = false;
            return;
        }
        
        const users = getUsers();
        
        // Check for duplicate email
        if (users.some(u => u.email.toLowerCase() === email)) {
            showToast('Email already registered. Please login or use a different email.', 'error');
            submitBtn.disabled = false;
            showLogin();
            return;
        }
        
        // Check for duplicate student ID
        if (users.some(u => u.studentId === studentId)) {
            showToast('Student ID already registered. Please use a different ID.', 'error');
            submitBtn.disabled = false;
            return;
        }
        
        // Create new user
        const newUser = {
            id: 'student_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            studentId: studentId,
            firstName: firstName,
            lastName: lastName,
            email: email,
            password: password,
            role: 'student',
            status: 'pending',
            qrCode: null,
            profilePhoto: null,
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        saveUsers(users);
        
        showToast('Registration successful! Your account is pending admin verification. Please login.', 'success');
        
        // Reset form and show login
        e.target.reset();
        showLogin();
        
    } catch (error) {
        console.error('Signup error:', error);
        showToast('An error occurred during registration. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
    }
}

// Handle login
function handleLogin(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    
    try {
        const formData = new FormData(e.target);
        const email = sanitizeInput(formData.get('email')).toLowerCase();
        const password = formData.get('password');
        
        if (!email || !password) {
            showToast('Please enter both email and password', 'error');
            submitBtn.disabled = false;
            return;
        }
        
        if (!isValidEmail(email)) {
            showToast('Please enter a valid email address', 'error');
            submitBtn.disabled = false;
            return;
        }
        
        const users = getUsers();
        const user = users.find(u => u.email.toLowerCase() === email && u.password === password);
        
        if (user) {
            saveCurrentUser(user);
            showToast('Login successful! Redirecting...', 'success');
            
            // Redirect based on role
            setTimeout(() => {
                if (user.role === 'admin') {
                    window.location.href = 'admin.html';
                } else if (user.role === 'student') {
                    window.location.href = 'user.html';
                }
            }, 500);
        } else {
            showToast('Invalid email or password! Please check your credentials.', 'error');
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('An error occurred during login. Please try again.', 'error');
        submitBtn.disabled = false;
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const toastEl = document.getElementById('toastNotification');
    
    if (toastEl) {
        const toastBody = toastEl.querySelector('.toast-body');
        const toastHeader = toastEl.querySelector('.toast-header');
        
        if (toastBody) toastBody.textContent = message;
        
        // Set icon based on type
        if (toastHeader) {
            const icon = toastHeader.querySelector('i');
            if (icon) {
                icon.className = '';
                switch(type) {
                    case 'success':
                        icon.className = 'fas fa-check-circle me-2 text-success';
                        break;
                    case 'error':
                        icon.className = 'fas fa-exclamation-circle me-2 text-danger';
                        break;
                    case 'warning':
                        icon.className = 'fas fa-exclamation-triangle me-2 text-warning';
                        break;
                    default:
                        icon.className = 'fas fa-info-circle me-2 text-info';
                }
            }
        }
        
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
    } else {
        // Fallback to alert
        alert(message);
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', function() {
    if (authInitialized) return;
    authInitialized = true;
    
    console.log('Auth system initializing...');
    
    // Initialize default users
    initializeDefaultUsers();
    
    // Check existing session
    checkExistingSession();
    
    // Setup event listeners
    const loginForm = document.getElementById('loginFormElement');
    const signupForm = document.getElementById('signupFormElement');
    const showSignupLink = document.getElementById('showSignupLink');
    const showLoginLink = document.getElementById('showLoginLink');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    
    if (showSignupLink) {
        showSignupLink.addEventListener('click', function(e) {
            e.preventDefault();
            showSignup();
        });
    }
    
    if (showLoginLink) {
        showLoginLink.addEventListener('click', function(e) {
            e.preventDefault();
            showLogin();
        });
    }
    
    console.log('Auth system initialized');
});

// Expose toggle function globally
window.togglePassword = togglePassword;