# api/app.py
from flask import Flask, jsonify, request, g
from flask_cors import CORS
import sqlite3
import os
import datetime
import hashlib
import functools

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost", "http://127.0.0.1"]}})

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, '..', 'data', 'footprint_map.db')
print(f"[INFO] Database path configured: {DB_PATH}")

def get_db_connection():
    try:
        # print(f"!!! Connecting to DB at: {DB_PATH}") # Optional: uncomment for path verification
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        # Enable foreign key support for this connection (important for DELETE CASCADE)
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn
    except sqlite3.OperationalError as e:
        print(f"[ERROR] DB Connect Error: {e}")
        print(f"[ERROR] Ensure the directory '{os.path.dirname(DB_PATH)}' exists and the file '{os.path.basename(DB_PATH)}' is accessible and valid.")
        raise
    except Exception as e:
        print(f"[ERROR] Unexpected error in get_db_connection: {e}")
        raise

# --- Authentication ---
# (verify_token and login_required decorator remain the same)
def verify_token(token):
    # ... (same as before) ...
    if token and token.startswith("sample-token-"):
        try:
            user_id = int(token.split("-")[-1])
            conn = get_db_connection()
            user = conn.execute('SELECT id, username, email, role FROM users WHERE id = ? AND is_active = 1', (user_id,)).fetchone()
            conn.close()
            if user:
                # Convert Row object to dictionary before returning
                return dict(user)
        except (ValueError, IndexError, sqlite3.Error) as e:
            print(f"Token verification error: {e}")
        except Exception as e:
            print(f"Unexpected error during token verification: {e}")
    return None

def login_required(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        token = None
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        user = verify_token(token)
        if not user:
            print("[WARN] Authentication failed: No valid user found for token.")
            return jsonify({"error": "Authentication required"}), 401

        g.user = user # Store user dict in Flask's global context
        print(f"[INFO] User {g.user.get('id')} authenticated for request.")
        return func(*args, **kwargs)
    return wrapper

# --- API Endpoints ---

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    print(f"[INFO] Login attempt for email: {data.get('email')}") # Log attempt

    if not data or 'email' not in data or 'password' not in data:
        print("[WARN] Login failed: Missing email or password in request.")
        return jsonify({"error": "Missing email or password"}), 400

    email = data['email']
    password = data['password']
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    print(f"[DEBUG] Calculated hash for login attempt: {password_hash[:10]}...") # Log partial hash for comparison

    conn = None
    try:
        conn = get_db_connection()
        print(f"[DEBUG] Querying user with email: {email}")
        user_row = conn.execute('''
            SELECT id, username, email, role, password_hash, is_active
            FROM users
            WHERE email = ?
        ''', (email,)).fetchone() # Fetch user by email first

        if user_row:
            print(f"[DEBUG] User found. DB hash: {user_row['password_hash'][:10]}..., is_active: {user_row['is_active']}")
            # Now check password and is_active status
            if user_row['password_hash'] == password_hash and user_row['is_active'] == 1:
                print(f"[INFO] Login successful for user ID: {user_row['id']}")
                conn.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', (user_row['id'],))
                conn.commit()
                # Prepare user data to return (exclude password hash)
                user_data = {k: user_row[k] for k in user_row.keys() if k != 'password_hash' and k != 'is_active'}
                user_data['id'] = user_row['id'] # Ensure id is included if keys() missed it

                token = "sample-token-" + str(user_row['id'])
                conn.close()
                return jsonify({"success": True, "user": user_data, "token": token})
            else:
                 print(f"[WARN] Login failed for {email}: Password mismatch or inactive user.")
                 conn.close()
                 return jsonify({"error": "Invalid email or password"}), 401
        else:
            print(f"[WARN] Login failed: User with email {email} not found.")
            conn.close()
            return jsonify({"error": "Invalid email or password"}), 401 # Keep error generic

    except sqlite3.Error as e:
        print(f"[ERROR] Database error during login for {email}: {e}")
        if conn: conn.close()
        return jsonify({"error": "Database error during login"}), 500
    except Exception as e:
        print(f"[ERROR] Unexpected error during login for {email}: {e}")
        if conn: conn.close()
        return jsonify({"error": "An unexpected error occurred"}), 500

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    print(f"[INFO] Registration attempt for email: {data.get('email')}")

    if not data or 'username' not in data or 'email' not in data or 'password' not in data:
        print("[WARN] Registration failed: Missing required fields.")
        return jsonify({"error": "Missing required fields"}), 400

    username = data['username']
    email = data['email']
    password = data['password']

    if len(password) < 6:
        print(f"[WARN] Registration failed for {email}: Password too short.")
        return jsonify({"error": "Password must be at least 6 characters long"}), 400

    password_hash = hashlib.sha256(password.encode()).hexdigest()
    print(f"[DEBUG] Calculated hash for registration: {password_hash[:10]}...")

    conn = None
    try:
        conn = get_db_connection()

        existing_user = conn.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
        if existing_user:
            print(f"[WARN] Registration failed: Email {email} already in use.")
            conn.close()
            return jsonify({"error": "Email already in use"}), 409

        print(f"[DEBUG] Inserting new user: {username}, {email}")
        cursor = conn.execute('''
            INSERT INTO users (username, email, password_hash, created_at, updated_at, role, is_active)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'user', 1)
        ''', (username, email, password_hash))

        user_id = cursor.lastrowid
        print(f"[INFO] User created with ID: {user_id}")

        # Create settings (add more error checking here if needed)
        try:
             conn.execute('''
                 INSERT INTO settings (user_id, dark_mode, animation_speed, popup_delay, max_arc_height, default_view, center_latitude, center_longitude, created_at, updated_at)
                 VALUES (?, 0, 5, 5, 50, '3d', 35.0, 105.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ''', (user_id,))
             print(f"[INFO] Default settings created for user ID: {user_id}")
        except sqlite3.Error as settings_e:
             print(f"[ERROR] Failed to insert settings for user {user_id}: {settings_e}")
             # Decide if this is critical. Maybe log and continue? Or rollback?
             # conn.rollback()
             # conn.close()
             # return jsonify({"error": "Failed to create user settings"}), 500


        conn.commit()
        print("[INFO] Transaction committed.")

        user = conn.execute('SELECT id, username, email, role FROM users WHERE id = ?', (user_id,)).fetchone()
        conn.close()

        if user:
             user_data = dict(user)
             token = "sample-token-" + str(user_id)
             print(f"[INFO] Registration successful for {email}, returning user data and token.")
             return jsonify({"success": True, "user": user_data, "token": token}), 201
        else:
             print(f"[ERROR] Failed to retrieve newly registered user ID: {user_id}")
             return jsonify({"error": "Failed to retrieve newly registered user"}), 500

    except sqlite3.IntegrityError as e:
        print(f"[ERROR] IntegrityError during registration for {email}: {e}")
        if conn: conn.rollback()
        if conn: conn.close()
        return jsonify({"error": "Email already in use or another integrity constraint failed"}), 409
    except sqlite3.OperationalError as e: # Catch potential schema errors specifically
        print(f"[ERROR] OperationalError (possible schema issue) during registration for {email}: {e}")
        if conn: conn.rollback()
        if conn: conn.close()
        return jsonify({"error": f"Database schema error: {e}"}), 500
    except sqlite3.Error as e:
        print(f"[ERROR] Generic Database error during registration for {email}: {e}")
        if conn: conn.rollback()
        if conn: conn.close()
        return jsonify({"error": "Database error during registration"}), 500
    except Exception as e:
        print(f"[ERROR] Unexpected error during registration for {email}: {e}")
        if conn: conn.rollback()
        if conn: conn.close()
        return jsonify({"error": "An unexpected error occurred"}), 500


# --- Other Endpoints (Keep the versions from the previous response) ---
@app.route('/api/users/stats', methods=['GET'])
@login_required
def get_user_stats():
    # ... (previous code) ...
    # (Make sure it uses get_db_connection and handles errors)
    user_id = g.user['id']
    conn = None
    try:
        conn = get_db_connection()
        journey_count = conn.execute('SELECT COUNT(*) FROM journeys WHERE user_id = ?', (user_id,)).fetchone()[0]
        point_count = conn.execute('SELECT COUNT(*) FROM journey_points jp JOIN journeys j ON jp.journey_id = j.id WHERE j.user_id = ?', (user_id,)).fetchone()[0]
        total_views = conn.execute('SELECT SUM(view_count) FROM journeys WHERE user_id = ?', (user_id,)).fetchone()[0] or 0
        shared_count = conn.execute("SELECT COUNT(*) FROM journeys WHERE user_id = ? AND visibility = 'public'", (user_id,)).fetchone()[0]

        conn.close()
        return jsonify({
            "journey_count": journey_count,
            "point_count": point_count,
            "total_views": total_views,
            "shared_count": shared_count
        })
    except sqlite3.Error as e:
        print(f"[ERROR] DB error getting stats user {user_id}: {e}")
        if conn: conn.close()
        return jsonify({"error": "Database error"}), 500
    except Exception as e:
        print(f"[ERROR] Unexpected error getting stats user {user_id}: {e}")
        if conn: conn.close()
        return jsonify({"error": "An unexpected error occurred"}), 500

@app.route('/api/journeys', methods=['GET'])
@login_required
def get_user_journeys():
    # ... (previous code with pagination/search/sort) ...
     # (Make sure it uses get_db_connection and handles errors)
    user_id = g.user['id']
    page = request.args.get('page', default=1, type=int)
    per_page = request.args.get('per_page', default=5, type=int)
    search = request.args.get('search', default='', type=str).strip()
    sort_by = request.args.get('sort', default='updated_at', type=str)
    visibility = request.args.get('visibility', default='all', type=str)
    offset = (page - 1) * per_page

    base_query = "FROM journeys WHERE user_id = ?"
    count_query = "SELECT COUNT(*) " + base_query
    data_query = "SELECT * " + base_query
    params_data = [user_id] # Params for the main data query
    params_count = [user_id] # Params for the count query

    if search:
        data_query += " AND (title LIKE ? OR description LIKE ?)"
        count_query += " AND (title LIKE ? OR description LIKE ?)"
        params_data.extend([f'%{search}%', f'%{search}%'])
        params_count.extend([f'%{search}%', f'%{search}%'])

    if visibility != 'all' and visibility in ['public', 'private', 'unlisted']:
        data_query += " AND visibility = ?"
        count_query += " AND visibility = ?"
        params_data.append(visibility)
        params_count.append(visibility)

    order_clause = " ORDER BY "
    if sort_by == 'updated_at': order_clause += "updated_at DESC"
    elif sort_by == 'created_at': order_clause += "created_at DESC"
    elif sort_by == 'view_count': order_clause += "view_count DESC"
    elif sort_by == 'title': order_clause += "title ASC"
    else: order_clause += "updated_at DESC"
    data_query += order_clause

    data_query += " LIMIT ? OFFSET ?"
    params_data.append(per_page)
    params_data.append(offset)

    conn = None
    try:
        conn = get_db_connection()
        total_items = conn.execute(count_query, params_count).fetchone()[0]
        journeys_rows = conn.execute(data_query, params_data).fetchall()

        journeys = []
        for row in journeys_rows:
            journey_dict = dict(row)
            point_count = conn.execute('SELECT COUNT(*) FROM journey_points WHERE journey_id = ?', (journey_dict['id'],)).fetchone()[0]
            journey_dict['point_count'] = point_count
            journeys.append(journey_dict)

        conn.close()
        total_pages = (total_items + per_page - 1) // per_page

        return jsonify({
            "journeys": journeys,
            "pagination": {
                "page": page, "per_page": per_page,
                "total_items": total_items, "total_pages": total_pages
            }
        })
    except sqlite3.Error as e:
        print(f"[ERROR] DB error getting journeys user {user_id}: {e}")
        if conn: conn.close()
        return jsonify({"error": "Database error"}), 500
    except Exception as e:
        print(f"[ERROR] Unexpected error getting journeys user {user_id}: {e}")
        if conn: conn.close()
        return jsonify({"error": "An unexpected error occurred"}), 500

# Use the modified get_journey from previous response that handles auth check
@app.route('/api/journeys/<int:journey_id>', methods=['GET'])
def get_journey(journey_id):
     # ... (code from previous response) ...
    conn = None
    user = None
    auth_header = request.headers.get('Authorization')
    token = None
    if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            user = verify_token(token) # Get user if token is provided

    try:
        conn = get_db_connection()
        journey = conn.execute('''
            SELECT j.*, u.username
            FROM journeys j
            JOIN users u ON j.user_id = u.id
            WHERE j.id = ?
        ''', (journey_id,)).fetchone()

        if not journey:
            conn.close()
            return jsonify({"error": "Journey not found"}), 404

        is_owner = user and journey['user_id'] == user['id']
        is_public_or_unlisted = journey['visibility'] in ['public', 'unlisted']

        if not (is_public_or_unlisted or is_owner):
             conn.close()
             return jsonify({"error": "Forbidden"}), 403

        points = conn.execute('SELECT * FROM journey_points WHERE journey_id = ? ORDER BY order_index', (journey_id,)).fetchall()
        journey_dict = dict(journey)
        journey_dict['points'] = [dict(point) for point in points]

        if not is_owner: # Only increment view count if not the owner viewing
            conn.execute('UPDATE journeys SET view_count = view_count + 1 WHERE id = ?', (journey_id,))
            conn.commit()

        conn.close()
        return jsonify(journey_dict)

    except sqlite3.Error as e:
        # ... error handling ...
        print(f"[ERROR] DB error getting journey {journey_id}: {e}")
        if conn: conn.close()
        return jsonify({"error": "Database error"}), 500
    except Exception as e:
        # ... error handling ...
        print(f"[ERROR] Unexpected error getting journey {journey_id}: {e}")
        if conn: conn.close()
        return jsonify({"error": "An unexpected error occurred"}), 500

@app.route('/api/journeys', methods=['POST'])
@login_required
def create_journey():
     # ... (previous code) ...
    # (Make sure it uses get_db_connection and handles errors)
    user_id = g.user['id']
    data = request.json

    if not data or 'title' not in data:
        return jsonify({"error": "Missing title"}), 400

    title = data['title']
    description = data.get('description', '')
    visibility = data.get('visibility', 'private')
    cover_image = data.get('cover_image')
    points_data = data.get('points', [])

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.execute('''
            INSERT INTO journeys (user_id, title, description, visibility, cover_image, created_at, updated_at, view_count)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
        ''', (user_id, title, description, visibility, cover_image))
        journey_id = cursor.lastrowid

        if points_data:
            for index, point in enumerate(points_data):
                 if 'location' in point and 'latitude' in point and 'longitude' in point:
                    conn.execute('''
                        INSERT INTO journey_points (journey_id, location, time, exact_date, latitude, longitude, content, order_index, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ''', (
                        journey_id, point.get('location'), point.get('time'), point.get('date'),
                        point.get('latitude'), point.get('longitude'), point.get('content'),
                        point.get('order_index', index)
                    ))
        conn.commit()

        new_journey = conn.execute('SELECT j.*, u.username FROM journeys j JOIN users u ON j.user_id = u.id WHERE j.id = ?', (journey_id,)).fetchone()
        inserted_points = conn.execute('SELECT * FROM journey_points WHERE journey_id = ? ORDER BY order_index', (journey_id,)).fetchall()
        conn.close()

        if new_journey:
            journey_dict = dict(new_journey)
            journey_dict['points'] = [dict(p) for p in inserted_points]
            return jsonify(journey_dict), 201
        else:
            return jsonify({"error": "Failed to retrieve created journey"}), 500
    except sqlite3.Error as e:
        # ... error handling ...
        print(f"[ERROR] DB error creating journey user {user_id}: {e}")
        if conn: conn.rollback()
        if conn: conn.close()
        return jsonify({"error": "Database error"}), 500
    except Exception as e:
        # ... error handling ...
        print(f"[ERROR] Unexpected error creating journey user {user_id}: {e}")
        if conn: conn.rollback()
        if conn: conn.close()
        return jsonify({"error": "An unexpected error occurred"}), 500

@app.route('/api/journeys/<int:journey_id>', methods=['PUT'])
@login_required
def update_journey(journey_id):
     # ... (previous code) ...
    # (Make sure it uses get_db_connection and handles errors)
    user_id = g.user['id']
    data = request.json
    if not data: return jsonify({"error": "Missing data"}), 400

    title = data.get('title')
    description = data.get('description')
    visibility = data.get('visibility')
    cover_image = data.get('cover_image')
    points_data = data.get('points')

    conn = None
    try:
        conn = get_db_connection()
        journey = conn.execute('SELECT user_id FROM journeys WHERE id = ?', (journey_id,)).fetchone()
        if not journey: conn.close(); return jsonify({"error": "Journey not found"}), 404
        if journey['user_id'] != user_id: conn.close(); return jsonify({"error": "Forbidden"}), 403

        update_fields = {}
        if title is not None: update_fields['title'] = title
        if description is not None: update_fields['description'] = description
        if visibility is not None: update_fields['visibility'] = visibility
        if cover_image is not None: update_fields['cover_image'] = cover_image

        if update_fields:
            set_clause = ", ".join([f"{key} = ?" for key in update_fields])
            params = list(update_fields.values()) + [journey_id]
            conn.execute(f'UPDATE journeys SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?', params)

        if points_data is not None:
            conn.execute('DELETE FROM journey_points WHERE journey_id = ?', (journey_id,))
            for index, point in enumerate(points_data):
                 if 'location' in point and 'latitude' in point and 'longitude' in point:
                    conn.execute('''
                        INSERT INTO journey_points (journey_id, location, time, exact_date, latitude, longitude, content, order_index, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ''', (
                        journey_id, point.get('location'), point.get('time'), point.get('date'),
                        point.get('latitude'), point.get('longitude'), point.get('content'),
                        point.get('order_index', index)
                    ))
        conn.commit()

        updated_journey = conn.execute('SELECT j.*, u.username FROM journeys j JOIN users u ON j.user_id = u.id WHERE j.id = ?', (journey_id,)).fetchone()
        updated_points = conn.execute('SELECT * FROM journey_points WHERE journey_id = ? ORDER BY order_index', (journey_id,)).fetchall()
        conn.close()

        if updated_journey:
            journey_dict = dict(updated_journey)
            journey_dict['points'] = [dict(p) for p in updated_points]
            return jsonify(journey_dict)
        else:
            return jsonify({"error": "Failed to retrieve updated journey"}), 500
    except sqlite3.Error as e:
        # ... error handling ...
        print(f"[ERROR] DB error updating journey {journey_id}: {e}")
        if conn: conn.rollback()
        if conn: conn.close()
        return jsonify({"error": "Database error"}), 500
    except Exception as e:
        # ... error handling ...
        print(f"[ERROR] Unexpected error updating journey {journey_id}: {e}")
        if conn: conn.rollback()
        if conn: conn.close()
        return jsonify({"error": "An unexpected error occurred"}), 500


@app.route('/api/journeys/<int:journey_id>', methods=['DELETE'])
@login_required
def delete_journey(journey_id):
     # ... (previous code) ...
    # (Make sure it uses get_db_connection and handles errors)
    user_id = g.user['id']
    conn = None
    try:
        conn = get_db_connection()
        journey = conn.execute('SELECT user_id FROM journeys WHERE id = ?', (journey_id,)).fetchone()
        if not journey: conn.close(); return jsonify({"error": "Journey not found"}), 404
        if journey['user_id'] != user_id: conn.close(); return jsonify({"error": "Forbidden"}), 403

        conn.execute('DELETE FROM journeys WHERE id = ?', (journey_id,)) # FK cascade should handle points
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Journey deleted successfully"})
    except sqlite3.Error as e:
        # ... error handling ...
        print(f"[ERROR] DB error deleting journey {journey_id}: {e}")
        if conn: conn.rollback()
        if conn: conn.close()
        return jsonify({"error": "Database error"}), 500
    except Exception as e:
        # ... error handling ...
        print(f"[ERROR] Unexpected error deleting journey {journey_id}: {e}")
        if conn: conn.rollback()
        if conn: conn.close()
        return jsonify({"error": "An unexpected error occurred"}), 500

@app.route('/api/settings', methods=['GET'])
@login_required
def get_user_settings():
    # ... (previous code) ...
     # (Make sure it uses get_db_connection and handles errors)
    user_id = g.user['id']
    conn = None
    try:
        conn = get_db_connection()
        settings = conn.execute('SELECT * FROM settings WHERE user_id = ?', (user_id,)).fetchone()
        conn.close()
        if settings:
            return jsonify(dict(settings))
        else:
            # Return default settings instead of 404 might be friendlier
             print(f"[WARN] Settings not found for user {user_id}, returning defaults.")
             return jsonify({
                 "user_id": user_id, "dark_mode": 0, "animation_speed": 5, "popup_delay": 5,
                 "max_arc_height": 50, "default_view": '3d', "center_latitude": 35.0, "center_longitude": 105.0
             })
    except sqlite3.Error as e:
        # ... error handling ...
        print(f"[ERROR] DB error getting settings user {user_id}: {e}")
        if conn: conn.close()
        return jsonify({"error": "Database error"}), 500
    except Exception as e:
        # ... error handling ...
        print(f"[ERROR] Unexpected error getting settings user {user_id}: {e}")
        if conn: conn.close()
        return jsonify({"error": "An unexpected error occurred"}), 500

@app.route('/api/settings', methods=['PUT'])
@login_required
def update_user_settings():
     # ... (previous code) ...
    # (Make sure it uses get_db_connection and handles errors)
    user_id = g.user['id']
    data = request.json
    if not data: return jsonify({"error": "Missing data"}), 400

    allowed_fields = ['dark_mode', 'animation_speed', 'popup_delay', 'max_arc_height',
                      'default_view', 'center_latitude', 'center_longitude']
    update_fields = {k: v for k, v in data.items() if k in allowed_fields}

    if not update_fields: return jsonify({"error": "No valid fields to update"}), 400

    conn = None
    try:
        conn = get_db_connection()
        # Check if settings exist, if not, insert
        existing = conn.execute('SELECT id FROM settings WHERE user_id = ?', (user_id,)).fetchone()
        if existing:
            set_clause = ", ".join([f"{key} = ?" for key in update_fields])
            params = list(update_fields.values()) + [user_id]
            conn.execute(f'UPDATE settings SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', params)
        else:
             # Insert default + updated fields
             print(f"[INFO] Settings row not found for user {user_id}, inserting.")
             # Prepare default values, overwrite with provided data
             default_settings = {
                 "user_id": user_id, "dark_mode": 0, "animation_speed": 5, "popup_delay": 5,
                 "max_arc_height": 50, "default_view": '3d', "center_latitude": 35.0, "center_longitude": 105.0
             }
             insert_data = {**default_settings, **update_fields} # Merge, provided data overwrites defaults
             columns = ", ".join(insert_data.keys())
             placeholders = ", ".join(["?"] * len(insert_data))
             values = list(insert_data.values())
             conn.execute(f'INSERT INTO settings ({columns}, created_at, updated_at) VALUES ({placeholders}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', values)

        conn.commit()
        updated_settings = conn.execute('SELECT * FROM settings WHERE user_id = ?', (user_id,)).fetchone()
        conn.close()

        if updated_settings: return jsonify(dict(updated_settings))
        else: return jsonify({"error": "Failed to retrieve updated settings"}), 500
    except sqlite3.Error as e:
        # ... error handling ...
        print(f"[ERROR] DB error updating settings user {user_id}: {e}")
        if conn: conn.rollback()
        if conn: conn.close()
        return jsonify({"error": "Database error"}), 500
    except Exception as e:
        # ... error handling ...
        print(f"[ERROR] Unexpected error updating settings user {user_id}: {e}")
        if conn: conn.rollback()
        if conn: conn.close()
        return jsonify({"error": "An unexpected error occurred"}), 500

@app.route('/api/users/profile', methods=['PUT'])
@login_required
def update_user_profile():
     # ... (previous code) ...
     # (Make sure it uses get_db_connection and handles errors)
    user_id = g.user['id']
    data = request.json
    if not data: return jsonify({"error": "Missing data"}), 400

    allowed_fields = ['username', 'avatar'] # Add others if schema supports
    update_fields = {k: v for k, v in data.items() if k in allowed_fields}

    if not update_fields: return jsonify({"error": "No valid fields to update"}), 400

    conn = None
    try:
        conn = get_db_connection()
        set_clause = ", ".join([f"{key} = ?" for key in update_fields])
        params = list(update_fields.values()) + [user_id]
        conn.execute(f'UPDATE users SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?', params)
        conn.commit()

        updated_user = conn.execute('SELECT id, username, email, role, avatar FROM users WHERE id = ?', (user_id,)).fetchone()
        conn.close()

        if updated_user: return jsonify(dict(updated_user))
        else: return jsonify({"error": "Failed to retrieve updated profile"}), 500
    except sqlite3.Error as e:
        # ... error handling ...
        print(f"[ERROR] DB error updating profile user {user_id}: {e}")
        if conn: conn.rollback()
        if conn: conn.close()
        return jsonify({"error": "Database error"}), 500
    except Exception as e:
        # ... error handling ...
        print(f"[ERROR] Unexpected error updating profile user {user_id}: {e}")
        if conn: conn.rollback()
        if conn: conn.close()
        return jsonify({"error": "An unexpected error occurred"}), 500

@app.route('/api/users/password', methods=['PUT'])
@login_required
def change_user_password():
     # ... (previous code) ...
     # (Make sure it uses get_db_connection and handles errors)
    user_id = g.user['id']
    data = request.json
    if not data or 'currentPassword' not in data or 'newPassword' not in data:
        return jsonify({"error": "Missing current or new password"}), 400

    current_password = data['currentPassword']
    new_password = data['newPassword']
    if len(new_password) < 6: return jsonify({"error": "New password must be at least 6 characters long"}), 400

    conn = None
    try:
        conn = get_db_connection()
        user = conn.execute('SELECT password_hash FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user: conn.close(); return jsonify({"error": "User not found"}), 404

        current_password_hash_input = hashlib.sha256(current_password.encode()).hexdigest()
        if user['password_hash'] != current_password_hash_input:
            conn.close(); return jsonify({"error": "Incorrect current password"}), 403

        new_password_hash = hashlib.sha256(new_password.encode()).hexdigest()
        conn.execute('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', (new_password_hash, user_id))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Password updated successfully"})
    except sqlite3.Error as e:
        # ... error handling ...
        print(f"[ERROR] DB error changing password user {user_id}: {e}")
        if conn: conn.rollback()
        if conn: conn.close()
        return jsonify({"error": "Database error"}), 500
    except Exception as e:
        # ... error handling ...
        print(f"[ERROR] Unexpected error changing password user {user_id}: {e}")
        if conn: conn.rollback()
        if conn: conn.close()
        return jsonify({"error": "An unexpected error occurred"}), 500

# --- Public Endpoints (Keep from previous response) ---
@app.route('/api/featured-journeys', methods=['GET'])
def get_featured_journeys_public():
     # ... (code from previous response, uses get_db_connection) ...
     conn = get_db_connection()
     limit = request.args.get('limit', default=6, type=int)
     offset = request.args.get('offset', default=0, type=int)
     try:
        journeys = conn.execute('''
            SELECT j.id, j.title, j.description, j.view_count, u.username, j.cover_image
            FROM journeys j
            JOIN users u ON j.user_id = u.id
            WHERE j.visibility = 'public'
            ORDER BY j.view_count DESC, j.updated_at DESC
            LIMIT ? OFFSET ?
        ''', (limit, offset)).fetchall()

        result = []
        for journey in journeys:
            first_point = conn.execute('''
                SELECT location, content, time
                FROM journey_points
                WHERE journey_id = ?
                ORDER BY order_index
                LIMIT 1
            ''', (journey['id'],)).fetchone()

            journey_dict = dict(journey)
            journey_dict['first_point'] = dict(first_point) if first_point else None
            result.append(journey_dict)

        conn.close()
        return jsonify(result)
     except sqlite3.Error as e:
        print(f"[ERROR] Public featured journeys DB error: {e}")
        if conn: conn.close()
        return jsonify({"error": "Database error"}), 500
     except Exception as e:
        print(f"[ERROR] Public featured journeys unexpected error: {e}")
        if conn: conn.close()
        return jsonify({"error": "An unexpected error occurred"}), 500

# Keep the /api/messages endpoint as is
@app.route('/api/messages', methods=['POST'])
def submit_message():
    # ... (code from previous response, uses get_db_connection) ...
    data = request.json
    if not data or 'name' not in data or 'email' not in data or 'message' not in data:
        return jsonify({"error": "Missing required fields"}), 400

    conn = None
    try:
        conn = get_db_connection()
        journey_id = data.get('journey_id')
        user_id = data.get('user_id')
        conn.execute('''
            INSERT INTO messages (name, email, message, journey_id, user_id, created_at, status)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'pending')
        ''', (data['name'], data['email'], data['message'], journey_id, user_id))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Message sent successfully!"}), 201
    except sqlite3.Error as e:
        print(f"[ERROR] Submit message DB error: {e}")
        if conn: conn.rollback(); conn.close()
        return jsonify({"error": "Database error"}), 500
    except Exception as e:
        print(f"[ERROR] Submit message unexpected error: {e}")
        if conn: conn.rollback(); conn.close()
        return jsonify({"error": "An unexpected error occurred"}), 500


if __name__ == '__main__':
    # ... (directory/db check code remains the same) ...
    data_dir = os.path.join(BASE_DIR, '..', 'data')
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"[INFO] Created directory: {data_dir}")
    if not os.path.exists(DB_PATH):
         print(f"[WARN] Database file not found at {DB_PATH}. Run createdata.py to initialize.")

    app.run(host='127.0.0.1', port=5000, debug=True)