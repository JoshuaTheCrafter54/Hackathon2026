let currentAdmin = null;
let users = [];
let events = [];
let attendance = [];
let currentFilter = 'all';
let scannerActive = false;
let selectedEvent = null;
let scanInterval = null;
let isInitialized = false;

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) return;
    isInitialized = true;
    initializeAdminDashboard();
});

function initializeAdminDashboard() {
    const userStr = localStorage.getItem('currentUser');
    
    if (!userStr) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        const user = JSON.parse(userStr);
        
        if (!user || user.role !== 'admin') {
            window.location.href = 'index.html';
            return;
        }
        
        currentAdmin = user;
        document.getElementById('adminName').textContent = `${user.firstName} ${user.lastName}`;
        
        loadAllData();
        updateDashboardStats();
        initializeCharts();
        loadSection('dashboard');
    } catch (e) {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}

function loadAllData() {
    try {
        users = JSON.parse(localStorage.getItem('users') || '[]');
        events = JSON.parse(localStorage.getItem('events') || '[]');
        attendance = JSON.parse(localStorage.getItem('attendance') || '[]');
    } catch (e) {
        users = [];
        events = [];
        attendance = [];
    }
}

function loadSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const sectionElement = document.getElementById(`${section}-section`);
    if (sectionElement) {
        sectionElement.classList.add('active');
    }
    
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    const activeLink = document.querySelector(`a[href="#${section}"]`);
    if (activeLink) activeLink.classList.add('active');
    
    switch(section) {
        case 'users':
            loadUsersTable();
            break;
        case 'events':
            loadEventsTable();
            break;
        case 'attendance':
            loadScanAttendance();
            break;
    }
}

function updateDashboardStats() {
    const students = users.filter(u => u.role === 'student');
    const pending = students.filter(u => u.status === 'pending');
    const verified = students.filter(u => u.status === 'verified');
    
    document.getElementById('totalStudents').textContent = students.length;
    document.getElementById('pendingStudents').textContent = pending.length;
    document.getElementById('verifiedStudents').textContent = verified.length;
    document.getElementById('totalEvents').textContent = events.length;
    document.getElementById('totalAttendance').textContent = attendance.length;
}

function initializeCharts() {
    initializeAttendanceChart();
    initializeVerificationChart();
}

function initializeAttendanceChart() {
    const canvas = document.getElementById('attendanceChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    const eventNames = events.slice(0, 5).map(e => e.name || 'Event');
    const attendanceCounts = events.slice(0, 5).map(e => {
        return attendance.filter(a => a.eventId === e.id).length;
    });
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: eventNames.length > 0 ? eventNames : ['No Events'],
            datasets: [{
                label: 'Attendance Count',
                data: attendanceCounts.length > 0 ? attendanceCounts : [0],
                backgroundColor: '#007bff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function initializeVerificationChart() {
    const canvas = document.getElementById('verificationChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    const students = users.filter(u => u.role === 'student');
    const pending = students.filter(u => u.status === 'pending').length;
    const verified = students.filter(u => u.status === 'verified').length;
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Verified', 'Pending'],
            datasets: [{
                data: [verified, pending],
                backgroundColor: ['#28a745', '#ffc107']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function loadUsersTable() {
    loadAllData();
    
    let filteredUsers = users;
    
    if (currentFilter === 'pending') {
        filteredUsers = users.filter(u => u.role === 'student' && u.status === 'pending');
    } else if (currentFilter === 'verified') {
        filteredUsers = users.filter(u => u.role === 'student' && u.status === 'verified');
    } else if (currentFilter === 'admin') {
        filteredUsers = users.filter(u => u.role === 'admin');
    }
    
    const tbody = document.getElementById('usersTableBody');
    const pendingCount = users.filter(u => u.role === 'student' && u.status === 'pending').length;
    document.getElementById('pendingCount').textContent = pendingCount;
    
    if (filteredUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredUsers.map(user => `
        <tr>
            <td>
                <img src="${user.profilePhoto || 'assets/images/default-avatar.png'}" 
                     alt="Profile" class="table-avatar" onerror="this.src='assets/images/default-avatar.png'">
            </td>
            <td>${user.studentId || '-'}</td>
            <td>${user.firstName} ${user.lastName}</td>
            <td>${user.email}</td>
            <td><span class="role-badge ${user.role}">${user.role}</span></td>
            <td>
                ${user.role === 'student' ? 
                    `<span class="status-badge ${user.status}">${user.status}</span>` : 
                    '-'}
            </td>
            <td>
                ${user.role === 'student' && user.status === 'pending' ? 
                    `<button class="btn-primary btn-sm" onclick="openVerifyModal('${user.id}')">
                        <i class="fas fa-check"></i> Verify
                    </button>` : 
                user.role === 'student' && user.status === 'verified' ?
                    `<button class="btn-secondary btn-sm" onclick="viewUser('${user.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>` :
                    '-'}
            </td>
        </tr>
    `).join('');
}

function filterUsers(filter) {
    currentFilter = filter;
    loadUsersTable();
    
    document.querySelectorAll('#users-section .tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function searchUsers() {
    const query = document.getElementById('userSearch').value.toLowerCase();
    const filteredUsers = users.filter(u => 
        u.firstName.toLowerCase().includes(query) ||
        u.lastName.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        (u.studentId && u.studentId.toLowerCase().includes(query))
    );
    
    const tbody = document.getElementById('usersTableBody');
    
    if (filteredUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredUsers.map(user => `
        <tr>
            <td>
                <img src="${user.profilePhoto || 'assets/images/default-avatar.png'}" 
                     alt="Profile" class="table-avatar" onerror="this.src='assets/images/default-avatar.png'">
            </td>
            <td>${user.studentId || '-'}</td>
            <td>${user.firstName} ${user.lastName}</td>
            <td>${user.email}</td>
            <td><span class="role-badge ${user.role}">${user.role}</span></td>
            <td>
                ${user.role === 'student' ? 
                    `<span class="status-badge ${user.status}">${user.status}</span>` : 
                    '-'}
            </td>
            <td>
                ${user.role === 'student' && user.status === 'pending' ? 
                    `<button class="btn-primary btn-sm" onclick="openVerifyModal('${user.id}')">
                        <i class="fas fa-check"></i> Verify
                    </button>` : 
                    '-'}
            </td>
        </tr>
    `).join('');
}

function openVerifyModal(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const modalContent = document.getElementById('verifyStudentContent');
    modalContent.innerHTML = `
        <div class="verify-student-info">
            <img src="${user.profilePhoto || 'assets/images/default-avatar.png'}" 
                 alt="Profile" class="verify-avatar" onerror="this.src='assets/images/default-avatar.png'">
            <h3>${user.firstName} ${user.lastName}</h3>
            <p><strong>Student ID:</strong> ${user.studentId}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Registered:</strong> ${new Date(user.createdAt).toLocaleString()}</p>
        </div>
        <div class="verify-actions">
            <button class="btn-primary" onclick="verifyStudent('${user.id}')">
                <i class="fas fa-check"></i> Verify & Generate QR Code
            </button>
            <button class="btn-secondary" onclick="closeModal('verifyStudentModal')">
                Cancel
            </button>
        </div>
    `;
    
    openModal('verifyStudentModal');
}

function verifyStudent(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const qrData = JSON.stringify({
        studentId: user.studentId,
        id: user.id,
        name: `${user.firstName} ${user.lastName}`
    });
    
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);
    
    const qr = new QRCode(tempDiv, {
        text: qrData,
        width: 256,
        height: 256
    });
    
    setTimeout(() => {
        const qrImage = tempDiv.querySelector('img');
        if (qrImage) {
            user.qrCode = qrImage.src;
            user.status = 'verified';
            
            const userIndex = users.findIndex(u => u.id === userId);
            users[userIndex] = user;
            localStorage.setItem('users', JSON.stringify(users));
            
            const currentUserStr = localStorage.getItem('currentUser');
            if (currentUserStr) {
                const currentUser = JSON.parse(currentUserStr);
                if (currentUser.id === userId) {
                    localStorage.setItem('currentUser', JSON.stringify(user));
                }
            }
            
            document.body.removeChild(tempDiv);
            
            closeModal('verifyStudentModal');
            loadUsersTable();
            updateDashboardStats();
            showNotification('Student verified and QR code generated successfully!', 'success');
        } else {
            document.body.removeChild(tempDiv);
            showNotification('Error generating QR code', 'error');
        }
    }, 500);
}

function viewUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    alert(`Student: ${user.firstName} ${user.lastName}\nStudent ID: ${user.studentId}\nEmail: ${user.email}\nStatus: ${user.status}`);
}

function loadEventsTable() {
    loadAllData();
    const tbody = document.getElementById('eventsTableBody');
    
    if (events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No events created yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = events.map(event => {
        const attendeeCount = attendance.filter(a => a.eventId === event.id).length;
        return `
            <tr>
                <td><strong>${event.name}</strong></td>
                <td>${event.description}</td>
                <td>${new Date(event.date).toLocaleDateString()}</td>
                <td>${event.startTime} - ${event.endTime}</td>
                <td><span class="status-badge ${event.status}">${event.status}</span></td>
                <td>${attendeeCount}</td>
                <td>
                    <button class="btn-secondary btn-sm" onclick="toggleEventStatus('${event.id}')">
                        <i class="fas fa-toggle-on"></i> ${event.status === 'active' ? 'Complete' : 'Activate'}
                    </button>
                    <button class="btn-danger btn-sm" onclick="deleteEvent('${event.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterEvents(status) {
    let filtered = events;
    if (status !== 'all') {
        filtered = events.filter(e => e.status === status);
    }
    
    const tbody = document.getElementById('eventsTableBody');
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No events found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(event => {
        const attendeeCount = attendance.filter(a => a.eventId === event.id).length;
        return `
            <tr>
                <td><strong>${event.name}</strong></td>
                <td>${event.description}</td>
                <td>${new Date(event.date).toLocaleDateString()}</td>
                <td>${event.startTime} - ${event.endTime}</td>
                <td><span class="status-badge ${event.status}">${event.status}</span></td>
                <td>${attendeeCount}</td>
                <td>
                    <button class="btn-secondary btn-sm" onclick="toggleEventStatus('${event.id}')">
                        ${event.status === 'active' ? 'Complete' : 'Activate'}
                    </button>
                    <button class="btn-danger btn-sm" onclick="deleteEvent('${event.id}')">
                        Delete
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    document.querySelectorAll('#events-section .tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function createEvent(e) {
    e.preventDefault();

    const newEvent = {
        id: 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: document.getElementById('eventName').value,
        description: document.getElementById('eventDescription').value,
        date: document.getElementById('eventDate').value,
        startTime: document.getElementById('eventStartTime').value,
        endTime: document.getElementById('eventEndTime').value,
        status: 'active',
        createdAt: new Date().toISOString()
    };

    events.push(newEvent);
    localStorage.setItem('events', JSON.stringify(events));

    loadAllData();
    loadEventsTable();
    loadScanAttendance();
    updateDashboardStats();
    initializeCharts();

    closeModal('createEventModal');
    e.target.reset();

    loadSection('events');

    showNotification('Event created successfully!', 'success');
}

function toggleEventStatus(eventId) {
    const eventIndex = events.findIndex(e => e.id === eventId);
    if (eventIndex !== -1) {
        events[eventIndex].status = events[eventIndex].status === 'active' ? 'completed' : 'active';
        localStorage.setItem('events', JSON.stringify(events));
        loadEventsTable();
        showNotification('Event status updated', 'success');
    }
}

function deleteEvent(eventId) {
    if (!confirm('Are you sure you want to delete this event?')) return;
    
    events = events.filter(e => e.id !== eventId);
    localStorage.setItem('events', JSON.stringify(events));
    loadEventsTable();
    updateDashboardStats();
    showNotification('Event deleted', 'success');
}

function loadScanAttendance() {
    loadAllData();
    
    const select = document.getElementById('eventSelect');
    const activeEvents = events.filter(e => e.status === 'active');
    
    select.innerHTML = '<option value="">-- Select an Event --</option>' +
        activeEvents.map(e => `<option value="${e.id}">${e.name} - ${new Date(e.date).toLocaleDateString()}</option>`).join('');
}

function selectEvent() {
    const eventId = document.getElementById('eventSelect').value;
    
    if (!eventId) {
        document.getElementById('scannerArea').style.display = 'none';
        document.getElementById('eventAttendance').style.display = 'none';
        document.getElementById('scanStats').style.display = 'none';
        stopScanner();
        return;
    }
    
    selectedEvent = events.find(e => e.id === eventId);
    document.getElementById('scanStats').style.display = 'flex';
    document.getElementById('scannerArea').style.display = 'block';
    document.getElementById('eventAttendance').style.display = 'block';
    
    updateAttendanceList();
    startScanner();
}

function startScanner() {
    if (scannerActive) return;
    
    const video = document.getElementById('qrVideo');
    const canvas = document.getElementById('qrCanvas');
    const ctx = canvas.getContext('2d');
    
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
            video.srcObject = stream;
            video.play();
            scannerActive = true;
            
            scanInterval = setInterval(() => {
                if (!scannerActive) {
                    clearInterval(scanInterval);
                    return;
                }
                
                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0);
                    
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, canvas.width, canvas.height);
                    
                    if (code) {
                        processQRScan(code.data);
                    }
                }
            }, 100);
        })
        .catch(err => {
            showNotification('Camera access denied', 'error');
        });
}

function stopScanner() {
    scannerActive = false;
    
    if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
    }
    
    const video = document.getElementById('qrVideo');
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
}

function processQRScan(qrData) {
    try {
        const studentData = JSON.parse(qrData);
        const student = users.find(u => u.id === studentData.id);
        
        if (!student || student.status !== 'verified') {
            showScanResult('Student not verified', 'error');
            return;
        }
        
        const existingAttendance = attendance.find(a => 
            a.eventId === selectedEvent.id && a.studentId === student.id
        );
        
        if (existingAttendance) {
            showScanResult('Student already scanned for this event', 'warning');
            return;
        }
        
        const newAttendance = {
            id: 'attendance_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            eventId: selectedEvent.id,
            studentId: student.id,
            studentName: `${student.firstName} ${student.lastName}`,
            studentPhoto: student.profilePhoto,
            timestamp: new Date().toISOString()
        };
        
        attendance.push(newAttendance);
        localStorage.setItem('attendance', JSON.stringify(attendance));
        
        updateAttendanceList();
        updateDashboardStats();
        showScanResult(`✓ ${student.firstName} ${student.lastName} - Attendance recorded`, 'success');
        
        setTimeout(() => {
            document.getElementById('scanResult').innerHTML = '';
        }, 2000);
    } catch (err) {
        showScanResult('Invalid QR code', 'error');
    }
}

function showScanResult(message, type) {
    const resultDiv = document.getElementById('scanResult');
    resultDiv.innerHTML = `<div class="scan-message ${type}">${message}</div>`;
}

function updateAttendanceList() {
    const eventAttendance = attendance.filter(a => a.eventId === selectedEvent.id);
    document.getElementById('totalScanned').textContent = eventAttendance.length;
    
    const tbody = document.getElementById('eventAttendanceBody');
    
    if (eventAttendance.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="no-data">No attendance recorded yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = eventAttendance.map(a => {
        const student = users.find(u => u.id === a.studentId);
        return `
            <tr>
                <td>
                    <img src="${a.studentPhoto || 'assets/images/default-avatar.png'}" 
                         alt="Profile" class="table-avatar" onerror="this.src='assets/images/default-avatar.png'">
                </td>
                <td>${student ? student.studentId : a.studentId}</td>
                <td>${a.studentName}</td>
                <td>${new Date(a.timestamp).toLocaleString()}</td>
            </tr>
        `;
    }).join('');
}

function generateReport() {
    const reportType = document.getElementById('reportType').value;
    
    loadAllData();
    
    let reportData = [];
    let headers = [];
    
    if (reportType === 'event') {
        headers = ['Event Name', 'Date', 'Total Students', 'Attended', 'Attendance Rate'];
        reportData = events.map(event => {
            const eventAttendance = attendance.filter(a => a.eventId === event.id);
            const totalStudents = users.filter(u => u.role === 'student' && u.status === 'verified').length;
            const attendanceRate = totalStudents > 0 ? Math.round((eventAttendance.length / totalStudents) * 100) : 0;
            
            return [
                event.name,
                new Date(event.date).toLocaleDateString(),
                totalStudents,
                eventAttendance.length,
                attendanceRate + '%'
            ];
        });
    } else if (reportType === 'student') {
        headers = ['Student ID', 'Name', 'Total Events', 'Attended', 'Attendance Rate'];
        const students = users.filter(u => u.role === 'student' && u.status === 'verified');
        reportData = students.map(student => {
            const studentAttendance = attendance.filter(a => a.studentId === student.id);
            const totalEvents = events.length;
            const attendanceRate = totalEvents > 0 ? Math.round((studentAttendance.length / totalEvents) * 100) : 0;
            
            return [
                student.studentId,
                `${student.firstName} ${student.lastName}`,
                totalEvents,
                studentAttendance.length,
                attendanceRate + '%'
            ];
        });
    }
    
    displayReport(headers, reportData);
}

function displayReport(headers, data) {
    const thead = document.getElementById('reportTableHead');
    const tbody = document.getElementById('reportTableBody');
    
    thead.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="' + headers.length + '" class="no-data">No data available for this report</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.map(row => 
        '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>'
    ).join('');
}

function exportReport() {
    const table = document.querySelector('#reportDisplay table');
    const rows = table.querySelectorAll('tr');
    
    let csv = [];
    rows.forEach(row => {
        const cols = row.querySelectorAll('th, td');
        const csvRow = [];
        cols.forEach(col => csvRow.push(col.textContent));
        csv.push(csvRow.join(','));
    });
    
    const csvContent = csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance_report_' + Date.now() + '.csv';
    a.click();
    
    showNotification('Report exported successfully', 'success');
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    const form = document.querySelector(`#${modalId} form`);
    if (form) form.reset();
}

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

function showNotification(message, type = 'info') {
    alert(message);
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        stopScanner();
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}

const toggleBtn = document.querySelector('.toggle-sidebar');
if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('active');
    });

}

// Event Listener for Create Events
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('createEventForm');
    if (form) {
        form.addEventListener('submit', createEvent);
    }
});
