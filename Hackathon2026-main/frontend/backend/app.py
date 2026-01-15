from flask import Flask, request, jsonify, session
from flask_cors import CORS
from datetime import datetime, timedelta
import sqlite3
import os
import json
import base64

app = Flask(__name__)
app.secret_key = os.urandom(24)
CORS(app, supports_credentials=True)

# Database setup
DATABASE = 'attendance_system.db'

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database with tables"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            student_id TEXT UNIQUE,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'student',
            status TEXT NOT NULL DEFAULT 'pending',
            profile_photo TEXT,
            qr_code TEXT,
            created_at TEXT NOT NULL
        )
    ''')
    
    # Events table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL
        )
    ''')
    
    # Attendance table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attendance (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            student_id TEXT NOT NULL,
            student_name TEXT NOT NULL,
            student_photo TEXT,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (event_id) REFERENCES events (id),
            FOREIGN KEY (student_id) REFERENCES users (id)
        )
    ''')
    
    # Create default admin if not exists
    cursor.execute('SELECT * FROM users WHERE email = ?', ('hckthon2026@gmail.com',))
    if not cursor.fetchone():
        admin_id = f"admin_{int(datetime.now().timestamp())}"
        cursor.execute('''
            INSERT INTO users (id, email, password, role, first_name, last_name, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (admin_id, 'hckthon2026@gmail.com', 'hckthon2026', 'admin', 'Admin', 'User', 'verified', datetime.now().isoformat()))
    
    conn.commit()
    conn.close()

# Initialize database on startup
init_db()

# ===== AUTH ROUTES =====

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new student"""
    try:
        data = request.get_json()
        
        # Validation
        required_fields = ['student_id', 'first_name', 'last_name', 'email', 'password']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Check password length
        if len(data['password']) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Check duplicate email
        cursor.execute('SELECT * FROM users WHERE email = ?', (data['email'].lower(),))
        if cursor.fetchone():
            return jsonify({'error': 'Email already registered'}), 409
        
        # Check duplicate student ID
        cursor.execute('SELECT * FROM users WHERE student_id = ?', (data['student_id'],))
        if cursor.fetchone():
            return jsonify({'error': 'Student ID already registered'}), 409
        
        # Create new user
        user_id = f"student_{int(datetime.now().timestamp())}_{os.urandom(4).hex()}"
        cursor.execute('''
            INSERT INTO users (id, student_id, first_name, last_name, email, password, role, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id,
            data['student_id'],
            data['first_name'],
            data['last_name'],
            data['email'].lower(),
            data['password'],
            'student',
            'pending',
            datetime.now().isoformat()
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Registration successful. Awaiting admin verification.'}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    """User login"""
    try:
        data = request.get_json()
        email = data.get('email', '').lower()
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE email = ? AND password = ?', (email, password))
        user = cursor.fetchone()
        conn.close()
        
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Store user in session
        session['user_id'] = user['id']
        session['role'] = user['role']
        
        # Return user data
        user_data = {
            'id': user['id'],
            'student_id': user['student_id'],
            'first_name': user['first_name'],
            'last_name': user['last_name'],
            'email': user['email'],
            'role': user['role'],
            'status': user['status'],
            'profile_photo': user['profile_photo'],
            'qr_code': user['qr_code']
        }
        
        return jsonify({'user': user_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """User logout"""
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200

@app.route('/api/auth/check', methods=['GET'])
def check_auth():
    """Check if user is authenticated"""
    if 'user_id' in session:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],))
        user = cursor.fetchone()
        conn.close()
        
        if user:
            user_data = {
                'id': user['id'],
                'student_id': user['student_id'],
                'first_name': user['first_name'],
                'last_name': user['last_name'],
                'email': user['email'],
                'role': user['role'],
                'status': user['status'],
                'profile_photo': user['profile_photo'],
                'qr_code': user['qr_code']
            }
            return jsonify({'authenticated': True, 'user': user_data}), 200
    
    return jsonify({'authenticated': False}), 401

# ===== USER ROUTES =====

@app.route('/api/users', methods=['GET'])
def get_users():
    """Get all users (admin only)"""
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users ORDER BY created_at DESC')
    users = cursor.fetchall()
    conn.close()
    
    users_list = []
    for user in users:
        users_list.append({
            'id': user['id'],
            'student_id': user['student_id'],
            'first_name': user['first_name'],
            'last_name': user['last_name'],
            'email': user['email'],
            'role': user['role'],
            'status': user['status'],
            'profile_photo': user['profile_photo'],
            'qr_code': user['qr_code'],
            'created_at': user['created_at']
        })
    
    return jsonify({'users': users_list}), 200

@app.route('/api/users/<user_id>', methods=['GET'])
def get_user(user_id):
    """Get specific user"""
    # Users can only view their own profile unless admin
    if session.get('user_id') != user_id and session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
    user = cursor.fetchone()
    conn.close()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    user_data = {
        'id': user['id'],
        'student_id': user['student_id'],
        'first_name': user['first_name'],
        'last_name': user['last_name'],
        'email': user['email'],
        'role': user['role'],
        'status': user['status'],
        'profile_photo': user['profile_photo'],
        'qr_code': user['qr_code'],
        'created_at': user['created_at']
    }
    
    return jsonify({'user': user_data}), 200

@app.route('/api/users/<user_id>', methods=['PUT'])
def update_user(user_id):
    """Update user profile"""
    # Users can only update their own profile unless admin
    if session.get('user_id') != user_id and session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        data = request.get_json()
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Build update query dynamically based on provided fields
        update_fields = []
        params = []
        
        if 'first_name' in data:
            update_fields.append('first_name = ?')
            params.append(data['first_name'])
        
        if 'last_name' in data:
            update_fields.append('last_name = ?')
            params.append(data['last_name'])
        
        if 'email' in data:
            update_fields.append('email = ?')
            params.append(data['email'].lower())
        
        if 'password' in data and len(data['password']) >= 6:
            update_fields.append('password = ?')
            params.append(data['password'])
        
        if 'profile_photo' in data:
            update_fields.append('profile_photo = ?')
            params.append(data['profile_photo'])
        
        if not update_fields:
            return jsonify({'error': 'No fields to update'}), 400
        
        params.append(user_id)
        query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = ?"
        
        cursor.execute(query, params)
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Profile updated successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete user (admin only)"""
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Delete user's attendance records
    cursor.execute('DELETE FROM attendance WHERE student_id = ?', (user_id,))
    
    # Delete user
    cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'User deleted successfully'}), 200

@app.route('/api/users/<user_id>/verify', methods=['POST'])
def verify_user(user_id):
    """Verify student and generate QR code (admin only)"""
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        data = request.get_json()
        qr_code = data.get('qr_code')
        
        if not qr_code:
            return jsonify({'error': 'QR code required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE users 
            SET status = ?, qr_code = ? 
            WHERE id = ?
        ''', ('verified', qr_code, user_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'User verified successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/<user_id>/role', methods=['PUT'])
def update_user_role(user_id):
    """Update user role (admin only)"""
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        data = request.get_json()
        new_role = data.get('role')
        
        if new_role not in ['student', 'admin']:
            return jsonify({'error': 'Invalid role'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('UPDATE users SET role = ? WHERE id = ?', (new_role, user_id))
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Role updated successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===== EVENT ROUTES =====

@app.route('/api/events', methods=['GET'])
def get_events():
    """Get all events"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM events ORDER BY date DESC, start_time DESC')
    events = cursor.fetchall()
    conn.close()
    
    events_list = []
    for event in events:
        events_list.append({
            'id': event['id'],
            'name': event['name'],
            'description': event['description'],
            'date': event['date'],
            'start_time': event['start_time'],
            'end_time': event['end_time'],
            'status': event['status'],
            'created_at': event['created_at']
        })
    
    return jsonify({'events': events_list}), 200

@app.route('/api/events', methods=['POST'])
def create_event():
    """Create new event (admin only)"""
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        data = request.get_json()
        
        required_fields = ['name', 'description', 'date', 'start_time', 'end_time']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        event_id = f"event_{int(datetime.now().timestamp())}_{os.urandom(4).hex()}"
        
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO events (id, name, description, date, start_time, end_time, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            event_id,
            data['name'],
            data['description'],
            data['date'],
            data['start_time'],
            data['end_time'],
            'active',
            datetime.now().isoformat()
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Event created successfully', 'event_id': event_id}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/events/<event_id>', methods=['PUT'])
def update_event(event_id):
    """Update event (admin only)"""
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        data = request.get_json()
        
        conn = get_db()
        cursor = conn.cursor()
        
        update_fields = []
        params = []
        
        for field in ['name', 'description', 'date', 'start_time', 'end_time', 'status']:
            if field in data:
                update_fields.append(f'{field} = ?')
                params.append(data[field])
        
        if not update_fields:
            return jsonify({'error': 'No fields to update'}), 400
        
        params.append(event_id)
        query = f"UPDATE events SET {', '.join(update_fields)} WHERE id = ?"
        
        cursor.execute(query, params)
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Event updated successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/events/<event_id>', methods=['DELETE'])
def delete_event(event_id):
    """Delete event (admin only)"""
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Delete attendance records for this event
    cursor.execute('DELETE FROM attendance WHERE event_id = ?', (event_id,))
    
    # Delete event
    cursor.execute('DELETE FROM events WHERE id = ?', (event_id,))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Event deleted successfully'}), 200

# ===== ATTENDANCE ROUTES =====

@app.route('/api/attendance', methods=['GET'])
def get_attendance():
    """Get attendance records"""
    event_id = request.args.get('event_id')
    student_id = request.args.get('student_id')
    
    conn = get_db()
    cursor = conn.cursor()
    
    if event_id:
        cursor.execute('SELECT * FROM attendance WHERE event_id = ? ORDER BY timestamp DESC', (event_id,))
    elif student_id:
        cursor.execute('SELECT * FROM attendance WHERE student_id = ? ORDER BY timestamp DESC', (student_id,))
    else:
        cursor.execute('SELECT * FROM attendance ORDER BY timestamp DESC')
    
    records = cursor.fetchall()
    conn.close()
    
    attendance_list = []
    for record in records:
        attendance_list.append({
            'id': record['id'],
            'event_id': record['event_id'],
            'student_id': record['student_id'],
            'student_name': record['student_name'],
            'student_photo': record['student_photo'],
            'timestamp': record['timestamp']
        })
    
    return jsonify({'attendance': attendance_list}), 200

@app.route('/api/attendance', methods=['POST'])
def mark_attendance():
    """Mark attendance (admin only)"""
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        data = request.get_json()
        
        event_id = data.get('event_id')
        student_id = data.get('student_id')
        
        if not event_id or not student_id:
            return jsonify({'error': 'Event ID and Student ID required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Check if already marked
        cursor.execute('''
            SELECT * FROM attendance 
            WHERE event_id = ? AND student_id = ?
        ''', (event_id, student_id))
        
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Attendance already marked'}), 409
        
        # Get student details
        cursor.execute('SELECT * FROM users WHERE id = ?', (student_id,))
        student = cursor.fetchone()
        
        if not student or student['status'] != 'verified':
            conn.close()
            return jsonify({'error': 'Student not found or not verified'}), 404
        
        # Mark attendance
        attendance_id = f"attendance_{int(datetime.now().timestamp())}_{os.urandom(4).hex()}"
        cursor.execute('''
            INSERT INTO attendance (id, event_id, student_id, student_name, student_photo, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            attendance_id,
            event_id,
            student_id,
            f"{student['first_name']} {student['last_name']}",
            student['profile_photo'],
            datetime.now().isoformat()
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Attendance marked successfully'}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/attendance/<attendance_id>', methods=['DELETE'])
def delete_attendance(attendance_id):
    """Delete attendance record (admin only)"""
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM attendance WHERE id = ?', (attendance_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Attendance record deleted'}), 200

# ===== STATS & REPORTS =====

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get dashboard statistics (admin only)"""
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Total students
    cursor.execute("SELECT COUNT(*) as count FROM users WHERE role = 'student'")
    total_students = cursor.fetchone()['count']
    
    # Pending students
    cursor.execute("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND status = 'pending'")
    pending_students = cursor.fetchone()['count']
    
    # Verified students
    cursor.execute("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND status = 'verified'")
    verified_students = cursor.fetchone()['count']
    
    # Total events
    cursor.execute("SELECT COUNT(*) as count FROM events")
    total_events = cursor.fetchone()['count']
    
    # Total attendance
    cursor.execute("SELECT COUNT(*) as count FROM attendance")
    total_attendance = cursor.fetchone()['count']
    
    conn.close()
    
    return jsonify({
        'total_students': total_students,
        'pending_students': pending_students,
        'verified_students': verified_students,
        'total_events': total_events,
        'total_attendance': total_attendance
    }), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)