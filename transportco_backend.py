#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TransportCo - Транспортная компания: backend на Flask с SQLite и полной Swagger документацией
"""
from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import sqlite3
import os
import sys
from functools import wraps
from flasgger import Swagger, swag_from

# === Flask приложение ===
app = Flask(__name__)
app.secret_key = 'transportco-secret-key-change-in-production'
app.config['DATABASE'] = 'transport_company.db'

# Настройка Flasgger
swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "TransportCo API",
        "description": "API для работы с транспортной компанией TransportCo: пользователи, заказы, водители, заявки.",
        "version": "1.0.0",
        "contact": {
            "name": "Support Team",
            "email": "support@transportco.ru"
        }
    },
    "host": "127.0.0.1:5000",
    "basePath": "/api",
    "schemes": ["http"],
    "tags": [
        {"name": "Авторизация", "description": "Регистрация, вход, восстановление пароля"},
        {"name": "Профиль", "description": "Управление данными пользователя"},
        {"name": "Заказы", "description": "Создание и управление заказами"},
        {"name": "Водители", "description": "Управление заявками и статусами водителей"},
        {"name": "Администрирование", "description": "Функции для администратора"}
    ],
    "securityDefinitions": {
        "SessionAuth": {
            "type": "apiKey",
            "in": "cookie",
            "name": "session"
        }
    },
    "security": [{"SessionAuth": []}]
}

swagger = Swagger(app, template=swagger_template)

# Включаем CORS для работы с фронтендом
CORS(app, supports_credentials=True)

# === УТИЛИТЫ БД ===
def get_db():
    """Получить подключение к БД"""
    conn = sqlite3.connect(app.config['DATABASE'])
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Инициализация базы данных при первом запуске"""
    if os.path.exists(app.config['DATABASE']):
        if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
            print("[INFO] База уже существует")
        return
    try:
        conn = sqlite3.connect(app.config['DATABASE'])
        cursor = conn.cursor()
        if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
            print("[INFO] Создание таблиц базы данных...")
        # Таблица пользователей
        cursor.execute('''
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                phone TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                verified INTEGER DEFAULT 0,
                is_admin INTEGER DEFAULT 0,
                is_driver INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        # Таблица заказов
        cursor.execute('''
            CREATE TABLE orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                driver_id INTEGER,
                sender_name TEXT NOT NULL,
                sender_phone TEXT NOT NULL,
                sender_email TEXT,
                cargo_description TEXT NOT NULL,
                product_category TEXT,
                cargo_weight REAL,
                cargo_volume REAL,
                cargo_type TEXT,
                shipping_date DATE,
                pickup_address TEXT NOT NULL,
                delivery_address TEXT NOT NULL,
                distance REAL,
                price REAL,
                insurance INTEGER DEFAULT 0,
                packaging INTEGER DEFAULT 0,
                comments TEXT,
                status TEXT DEFAULT 'new',
                client_status TEXT DEFAULT 'processing',
                admin_comment TEXT,
                cancellation_reason TEXT,
                cancellation_fee REAL,
                refund_amount REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP,
                assigned_at TIMESTAMP,
                accepted_at TIMESTAMP,
                in_transit_at TIMESTAMP,
                delivered_at TIMESTAMP,
                cancelled_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (driver_id) REFERENCES users (id)
            )
        ''')
        # Таблица водителей
        cursor.execute('''
            CREATE TABLE drivers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                license_number TEXT NOT NULL,
                experience INTEGER,
                car_model TEXT,
                car_number TEXT,
                max_weight REAL,
                car_type TEXT,
                status TEXT DEFAULT 'active',
                work_status TEXT DEFAULT 'active',
                completed_deliveries INTEGER DEFAULT 0,
                hire_date DATE,
                inactive_since TIMESTAMP,
                inactive_reason TEXT,
                resignation_reason TEXT,
                dismissal_reason TEXT,
                dismissed_by INTEGER,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        # Таблица заявок водителей
        cursor.execute('''
            CREATE TABLE driver_applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                license_number TEXT NOT NULL,
                experience INTEGER NOT NULL,
                car_model TEXT NOT NULL,
                car_number TEXT NOT NULL,
                max_weight REAL NOT NULL,
                car_type TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP,
                processed_by INTEGER,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        # Таблица уведомлений
        cursor.execute('''
            CREATE TABLE notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                type TEXT DEFAULT 'info',
                read INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        # Таблица кодов подтверждения
        cursor.execute('''
            CREATE TABLE verification_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contact TEXT NOT NULL,
                code TEXT NOT NULL,
                purpose TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        # Создаем тестового администратора
        admin_password = generate_password_hash('admin123', method='pbkdf2:sha256')
        cursor.execute('''
            INSERT INTO users (email, phone, password, first_name, last_name, verified, is_admin)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', ('admin@transportco.ru', '+79123456780', admin_password, 'Александр', 'Петров', 1, 1))
        conn.commit()
        conn.close()
        if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
            print("[INFO] Таблицы транспортной компании успешно созданы!")
    except Exception as e:
        print(f"[ERROR] Ошибка при инициализации БД: {e}", file=sys.stderr)

# === ДЕКОРАТОРЫ ===
def login_required(f):
    """Декоратор для проверки авторизации"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Требуется авторизация'}), 401
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """Декоратор для проверки прав администратора"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Требуется авторизация'}), 401
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT is_admin FROM users WHERE id = ?', (session['user_id'],))
        user = cursor.fetchone()
        conn.close()
        if not user or not user['is_admin']:
            return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
        return f(*args, **kwargs)
    return decorated_function

# === МАРШРУТЫ ДЛЯ СТАТИКИ ===
@app.route('/')
def index():
    """Главная страница - отдаем main.html"""
    return send_from_directory('', 'main.html')

@app.route('/css/<path:filename>')
def styles(filename):
    """Раздача CSS файлов"""
    return send_from_directory('css', filename)

@app.route('/js/<path:filename>')
def scripts(filename):
    """Раздача JS файлов"""
    return send_from_directory('js', filename)

# === API ENDPOINTS ===
# === АВТОРИЗАЦИЯ ===
@app.route('/api/register', methods=['POST'])
@swag_from({
    'tags': ['Авторизация'],
    'parameters': [
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'email': {'type': 'string', 'example': 'user@example.com'},
                    'phone': {'type': 'string', 'example': '+79123456789'},
                    'password': {'type': 'string', 'example': 'secure123'},
                    'firstName': {'type': 'string', 'example': 'Иван'},
                    'lastName': {'type': 'string', 'example': 'Иванов'}
                },
                'required': ['email', 'phone', 'password', 'firstName', 'lastName']
            }
        }
    ],
    'responses': {
        200: {
            'description': 'Успешная регистрация',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'message': {'type': 'string', 'example': 'Регистрация успешна'},
                    'user': {
                        'type': 'object',
                        'properties': {
                            'id': {'type': 'integer', 'example': 1},
                            'email': {'type': 'string', 'example': 'user@example.com'},
                            'phone': {'type': 'string', 'example': '+79123456789'},
                            'firstName': {'type': 'string', 'example': 'Иван'},
                            'lastName': {'type': 'string', 'example': 'Иванов'},
                            'verified': {'type': 'boolean', 'example': True},
                            'isAdmin': {'type': 'boolean', 'example': False},
                            'isDriver': {'type': 'boolean', 'example': False}
                        }
                    }
                }
            }
        },
        400: {'description': 'Ошибка валидации'}
    }
})
def register():
    """Регистрация пользователя"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip()
        phone = data.get('phone', '').strip()
        password = data.get('password', '')
        first_name = data.get('firstName', '').strip()
        last_name = data.get('lastName', '').strip()
        if not all([email, phone, password, first_name, last_name]):
            return jsonify({'success': False, 'message': 'Заполните все поля'}), 400
        if len(password) < 6:
            return jsonify({'success': False, 'message': 'Пароль должен быть не менее 6 символов'}), 400
        conn = get_db()
        cursor = conn.cursor()
        # Проверка существования email или телефона
        cursor.execute('SELECT id FROM users WHERE email = ? OR phone = ?', (email, phone))
        if cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'message': 'Пользователь с таким email или телефоном уже существует'}), 400
        hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
        cursor.execute('''
            INSERT INTO users (email, phone, password, first_name, last_name, verified)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (email, phone, hashed_password, first_name, last_name, 1))
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()
        # Автоматический вход после регистрации
        session['user_id'] = user_id
        return jsonify({
            'success': True,
            'message': 'Регистрация успешна',
            'user': {
                'id': user_id,
                'email': email,
                'phone': phone,
                'firstName': first_name,
                'lastName': last_name,
                'verified': True,
                'isAdmin': False,
                'isDriver': False
            }
        })
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'message': 'Пользователь с таким email или телефоном уже существует'}), 400
    except Exception as e:
        print(f"[ERROR] Ошибка при регистрации: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/login', methods=['POST'])
@swag_from({
    'tags': ['Авторизация'],
    'parameters': [
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'login': {'type': 'string', 'description': 'Email или телефон', 'example': "+79123456789"},
                    'password': {'type': 'string', 'example': "secure123"}
                },
                'required': ['login', 'password']
            }
        }
    ],
    'responses': {
        200: {
            'description': 'Успешный вход',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'message': {'type': 'string', 'example': 'Вход выполнен успешно'},
                    'user': {
                        'type': 'object',
                        'properties': {
                            'id': {'type': 'integer', 'example': 1},
                            'email': {'type': 'string', 'example': 'user@example.com'},
                            'phone': {'type': 'string', 'example': '+79123456789'},
                            'firstName': {'type': 'string', 'example': 'Иван'},
                            'lastName': {'type': 'string', 'example': 'Иванов'},
                            'verified': {'type': 'boolean', 'example': True},
                            'isAdmin': {'type': 'boolean', 'example': False},
                            'isDriver': {'type': 'boolean', 'example': False}
                        }
                    }
                }
            }
        },
        400: {'description': 'Ошибка валидации'},
        401: {'description': 'Неверные учетные данные'}
    }
})
def login():
    """Вход пользователя"""
    try:
        data = request.get_json()
        login_field = data.get('login', '').strip()  # email или phone
        password = data.get('password', '')
        if not login_field or not password:
            return jsonify({'success': False, 'message': 'Заполните все поля'}), 400
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, email, phone, password, first_name, last_name, verified, is_admin, is_driver
            FROM users WHERE email = ? OR phone = ?
        ''', (login_field, login_field))
        user = cursor.fetchone()
        conn.close()
        if user and check_password_hash(user['password'], password):
            if not user['verified']:
                return jsonify({'success': False, 'message': 'Аккаунт не подтвержден'}), 400
            session['user_id'] = user['id']
            return jsonify({
                'success': True,
                'message': 'Вход выполнен успешно',
                'user': {
                    'id': user['id'],
                    'email': user['email'],
                    'phone': user['phone'],
                    'firstName': user['first_name'],
                    'lastName': user['last_name'],
                    'verified': bool(user['verified']),
                    'isAdmin': bool(user['is_admin']),
                    'isDriver': bool(user['is_driver'])
                }
            })
        else:
            return jsonify({'success': False, 'message': 'Неверный телефон/email или пароль'}), 401
    except Exception as e:
        print(f"[ERROR] Ошибка при входе: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/logout', methods=['POST'])
@swag_from({
    'tags': ['Авторизация'],
    'security': [{'SessionAuth': []}],
    'responses': {
        200: {
            'description': 'Успешный выход',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'message': {'type': 'string', 'example': 'Выход выполнен успешно'}
                }
            }
        }
    }
})
def logout():
    """Выход из системы"""
    session.clear()
    return jsonify({'success': True, 'message': 'Выход выполнен успешно'})

@app.route('/api/current-user', methods=['GET'])
@swag_from({
    'tags': ['Авторизация'],
    'security': [{'SessionAuth': []}],
    'responses': {
        200: {
            'description': 'Текущий пользователь',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'user': {
                        'type': 'object',
                        'properties': {
                            'id': {'type': 'integer', 'example': 1},
                            'email': {'type': 'string', 'example': 'user@example.com'},
                            'phone': {'type': 'string', 'example': '+79123456789'},
                            'firstName': {'type': 'string', 'example': 'Иван'},
                            'lastName': {'type': 'string', 'example': 'Иванов'},
                            'verified': {'type': 'boolean', 'example': True},
                            'isAdmin': {'type': 'boolean', 'example': False},
                            'isDriver': {'type': 'boolean', 'example': False}
                        }
                    }
                }
            }
        }
    }
})
def current_user():
    """Получить текущего пользователя"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'user': None})
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, email, phone, first_name, last_name, verified, is_admin, is_driver
        FROM users WHERE id = ?
    ''', (session['user_id'],))
    user = cursor.fetchone()
    conn.close()
    if user:
        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'email': user['email'],
                'phone': user['phone'],
                'firstName': user['first_name'],
                'lastName': user['last_name'],
                'verified': bool(user['verified']),
                'isAdmin': bool(user['is_admin']),
                'isDriver': bool(user['is_driver'])
            }
        })
    else:
        session.clear()
        return jsonify({'success': False, 'user': None})

# === ПРОФИЛЬ ===
@app.route('/api/profile', methods=['GET'])
@login_required
@swag_from({
    'tags': ['Профиль'],
    'security': [{'SessionAuth': []}],
    'responses': {
        200: {
            'description': 'Профиль пользователя',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'user': {
                        'type': 'object',
                        'properties': {
                            'id': {'type': 'integer', 'example': 1},
                            'email': {'type': 'string', 'example': 'user@example.com'},
                            'phone': {'type': 'string', 'example': '+79123456789'},
                            'firstName': {'type': 'string', 'example': 'Иван'},
                            'lastName': {'type': 'string', 'example': 'Иванов'},
                            'verified': {'type': 'boolean', 'example': True},
                            'isAdmin': {'type': 'boolean', 'example': False},
                            'isDriver': {'type': 'boolean', 'example': False}
                        }
                    }
                }
            }
        },
        404: {'description': 'Пользователь не найден'}
    }
})
def get_profile():
    """Получить профиль пользователя"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, email, phone, first_name, last_name, verified, is_admin, is_driver
        FROM users WHERE id = ?
    ''', (session['user_id'],))
    user = cursor.fetchone()
    conn.close()
    if user:
        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'email': user['email'],
                'phone': user['phone'],
                'firstName': user['first_name'],
                'lastName': user['last_name'],
                'verified': bool(user['verified']),
                'isAdmin': bool(user['is_admin']),
                'isDriver': bool(user['is_driver'])
            }
        })
    return jsonify({'success': False, 'message': 'Пользователь не найден'}), 404

@app.route('/api/profile', methods=['POST'])
@login_required
@swag_from({
    'tags': ['Профиль'],
    'security': [{'SessionAuth': []}],
    'parameters': [
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'firstName': {'type': 'string', 'example': 'Иван'},
                    'lastName': {'type': 'string', 'example': 'Иванов'},
                    'email': {'type': 'string', 'example': 'new_email@example.com'},
                    'phone': {'type': 'string', 'example': '+79123456789'}
                },
                'required': ['firstName', 'lastName', 'email', 'phone']
            }
        }
    ],
    'responses': {
        200: {
            'description': 'Профиль успешно обновлен',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'message': {'type': 'string', 'example': 'Профиль обновлен'}
                }
            }
        },
        400: {'description': 'Ошибка валидации'}
    }
})
def update_profile():
    """Обновить профиль пользователя"""
    try:
        data = request.get_json()
        first_name = data.get('firstName', '').strip()
        last_name = data.get('lastName', '').strip()
        email = data.get('email', '').strip()
        phone = data.get('phone', '').strip()
        conn = get_db()
        cursor = conn.cursor()
        # Проверка уникальности email и phone
        cursor.execute('SELECT id FROM users WHERE (email = ? OR phone = ?) AND id != ?',
                      (email, phone, session['user_id']))
        if cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'message': 'Email или телефон уже используются'}), 400
        cursor.execute('''
            UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?
            WHERE id = ?
        ''', (first_name, last_name, email, phone, session['user_id']))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Профиль обновлен'})
    except Exception as e:
        print(f"[ERROR] Ошибка при обновлении профиля: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/profile/password', methods=['POST'])
@login_required
@swag_from({
    'tags': ['Профиль'],
    'security': [{'SessionAuth': []}],
    'parameters': [
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'currentPassword': {'type': 'string', 'example': 'old_secure123'},
                    'newPassword': {'type': 'string', 'example': 'new_secure123'},
                    'isRecovery': {'type': 'boolean', 'example': False}
                },
                'required': ['newPassword']
            }
        }
    ],
    'responses': {
        200: {
            'description': 'Пароль успешно изменен',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'message': {'type': 'string', 'example': 'Пароль успешно изменен'}
                }
            }
        },
        400: {'description': 'Ошибка валидации'}
    }
})
def change_password():
    """Смена пароля (с поддержкой восстановления)"""
    try:
        data = request.get_json()
        current_password = data.get('currentPassword', '')
        new_password = data.get('newPassword', '')
        is_recovery = data.get('isRecovery', False)  # Новый флаг
        if not new_password:
            return jsonify({'success': False, 'message': 'Новый пароль обязателен'}), 400
        if len(new_password) < 6:
            return jsonify({'success': False, 'message': 'Пароль должен быть не менее 6 символов'}), 400
        conn = get_db()
        cursor = conn.cursor()
        # Если это НЕ восстановление — проверяем текущий пароль
        if not is_recovery:
            if not current_password:
                conn.close()
                return jsonify({'success': False, 'message': 'Текущий пароль обязателен'}), 400
            cursor.execute('SELECT password FROM users WHERE id = ?', (session['user_id'],))
            user = cursor.fetchone()
            if not user or not check_password_hash(user['password'], current_password):
                conn.close()
                return jsonify({'success': False, 'message': 'Текущий пароль указан неверно'}), 400
        # Обновляем пароль
        hashed_password = generate_password_hash(new_password, method='pbkdf2:sha256')
        cursor.execute('UPDATE users SET password = ? WHERE id = ?',
                       (hashed_password, session['user_id']))
        conn.commit()
        conn.close()
        # При восстановлении — разлогиниваем для безопасности
        if is_recovery:
            session.clear()
        return jsonify({'success': True, 'message': 'Пароль успешно изменен'})
    except Exception as e:
        print(f"[ERROR] Ошибка при смене пароля: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/reset-password', methods=['POST'])
@swag_from({
    'tags': ['Авторизация'],
    'parameters': [
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'contact': {'type': 'string', 'description': 'Email или телефон', 'example': "+79123456789"},
                    'newPassword': {'type': 'string', 'example': "new_secure123"}
                },
                'required': ['contact', 'newPassword']
            }
        }
    ],
    'responses': {
        200: {
            'description': 'Пароль успешно изменен',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'message': {'type': 'string', 'example': 'Пароль успешно изменён'}
                }
            }
        },
        400: {'description': 'Ошибка валидации'},
        404: {'description': 'Пользователь не найден'}
    }
})
def reset_password_no_auth():
    """Смена пароля без авторизации (после подтверждения через код)"""
    try:
        data = request.get_json()
        contact = data.get('contact', '').strip()  # email или phone
        new_password = data.get('newPassword', '')
        if not contact or not new_password:
            return jsonify({'success': False, 'message': 'Укажите email/телефон и новый пароль'}), 400
        if len(new_password) < 6:
            return jsonify({'success': False, 'message': 'Пароль должен быть не менее 6 символов'}), 400
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT id, email, phone FROM users WHERE email = ? OR phone = ?', (contact, contact))
        user = cursor.fetchone()
        if not user:
            conn.close()
            return jsonify({'success': False, 'message': 'Пользователь не найден'}), 404
        hashed_password = generate_password_hash(new_password, method='pbkdf2:sha256')
        cursor.execute('UPDATE users SET password = ? WHERE id = ?', (hashed_password, user['id']))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Пароль успешно изменён'})
    except Exception as e:
        print(f"[ERROR] reset_password_no_auth: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': str(e)}), 500

# === ЗАКАЗЫ ===
@app.route('/api/orders', methods=['GET'])
@login_required
@swag_from({
    'tags': ['Заказы'],
    'security': [{'SessionAuth': []}],
    'responses': {
        200: {
            'description': 'Список заказов',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'orders': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'id': {'type': 'integer', 'example': 1},
                                'senderName': {'type': 'string', 'example': 'Иван Иванов'},
                                'cargoDescription': {'type': 'string', 'example': 'Электроника'},
                                'status': {'type': 'string', 'example': 'new'},
                                'price': {'type': 'number', 'example': 1500}
                            }
                        }
                    }
                }
            }
        }
    }
})
def get_orders():
    """Получить заказы пользователя"""
    conn = get_db()
    cursor = conn.cursor()
    # Проверяем роль пользователя
    cursor.execute('SELECT is_admin, is_driver FROM users WHERE id = ?', (session['user_id'],))
    user = cursor.fetchone()
    if user['is_admin']:
        # Администратор видит все заказы
        cursor.execute('''
            SELECT * FROM orders ORDER BY created_at DESC
        ''')
    elif user['is_driver']:
        # Водитель видит свои заказы
        cursor.execute('''
            SELECT * FROM orders WHERE driver_id = ? ORDER BY created_at DESC
        ''', (session['user_id'],))
    else:
        # Обычный пользователь видит свои заказы
        cursor.execute('''
            SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC
        ''', (session['user_id'],))
    orders = []
    for row in cursor.fetchall():
        orders.append(dict(row))
    conn.close()
    return jsonify({'success': True, 'orders': orders})

@app.route('/api/orders', methods=['POST'])
@login_required
@swag_from({
    'tags': ['Заказы'],
    'security': [{'SessionAuth': []}],
    'parameters': [
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'senderName': {'type': 'string', 'example': 'Иван Иванов'},
                    'senderPhone': {'type': 'string', 'example': '+79123456789'},
                    'senderEmail': {'type': 'string', 'example': 'ivan@example.com'},
                    'cargoDescription': {'type': 'string', 'example': 'Электроника'},
                    'productCategory': {'type': 'string', 'example': 'electronics'},
                    'cargoWeight': {'type': 'number', 'example': 10},
                    'cargoVolume': {'type': 'number', 'example': 1},
                    'cargoType': {'type': 'string', 'example': 'general'},
                    'shippingDate': {'type': 'string', 'format': 'date', 'example': '2023-12-25'},
                    'pickupAddress': {'type': 'string', 'example': 'Москва, ул. Ленина, 1'},
                    'deliveryAddress': {'type': 'string', 'example': 'Санкт-Петербург, ул. Пушкина, 10'},
                    'distance': {'type': 'number', 'example': 700},
                    'insurance': {'type': 'boolean', 'example': True},
                    'packaging': {'type': 'boolean', 'example': False},
                    'comments': {'type': 'string', 'example': 'Осторожно, хрупкий груз'}
                },
                'required': [
                    'senderName', 'senderPhone', 'cargoDescription', 'productCategory',
                    'cargoWeight', 'cargoVolume', 'cargoType', 'shippingDate',
                    'pickupAddress', 'deliveryAddress', 'distance'
                ]
            }
        }
    ],
    'responses': {
        200: {
            'description': 'Заказ успешно создан',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'message': {'type': 'string', 'example': 'Заказ успешно создан'},
                    'order': {
                        'type': 'object',
                        'properties': {
                            'id': {'type': 'integer', 'example': 1},
                            'price': {'type': 'number', 'example': 15000},
                            'distance': {'type': 'number', 'example': 700}
                        }
                    }
                }
            }
        },
        400: {'description': 'Ошибка валидации'},
        403: {'description': 'Доступ запрещен для администраторов и водителей'}
    }
})
def create_order():
    """Создать новый заказ"""
    try:
        data = request.get_json()
        # Проверка, что пользователь не администратор и не водитель
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT is_admin, is_driver FROM users WHERE id = ?', (session['user_id'],))
        user = cursor.fetchone()
        if user['is_admin'] or user['is_driver']:
            conn.close()
            return jsonify({'success': False, 'message': 'Заказ доступен только для обычных пользователей'}), 403
        # Расчет расстояния (упрощенный)
        pickup_address = data.get('pickupAddress', '')
        delivery_address = data.get('deliveryAddress', '')
        distance = data.get('distance', 100)  # По умолчанию 100 км
        # Расчет цены (упрощенный)
        cargo_weight = float(data.get('cargoWeight', 0))
        cargo_volume = float(data.get('cargoVolume', 0))
        base_price = 1000
        price_per_km = 20
        price_per_kg = 80
        price_per_m3 = 400
        distance_cost = distance * price_per_km
        weight_cost = cargo_weight * price_per_kg
        volume_cost = cargo_volume * price_per_m3
        total_price = base_price + distance_cost + weight_cost + volume_cost
        # Коэффициенты для типов груза
        cargo_type_multiplier = {
            'general': 1.0,
            'fragile': 1.3,
            'dangerous': 1.5,
            'perishable': 1.4
        }
        multiplier = cargo_type_multiplier.get(data.get('cargoType', 'general'), 1.0)
        total_price *= multiplier
        # Страховка 1%
        if data.get('insurance'):
            total_price += total_price * 0.01
        # Упаковка
        if data.get('packaging'):
            total_price += 2000
        total_price = round(total_price)
        cursor.execute('''
            INSERT INTO orders (
                user_id, sender_name, sender_phone, sender_email, cargo_description,
                product_category, cargo_weight, cargo_volume, cargo_type, shipping_date,
                pickup_address, delivery_address, distance, price, insurance, packaging,
                comments, status, client_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            session['user_id'],
            data.get('senderName', ''),
            data.get('senderPhone', ''),
            data.get('senderEmail', ''),
            data.get('cargoDescription', ''),
            data.get('productCategory', ''),
            cargo_weight,
            cargo_volume,
            data.get('cargoType', 'general'),
            data.get('shippingDate', ''),
            pickup_address,
            delivery_address,
            distance,
            total_price,
            1 if data.get('insurance') else 0,
            1 if data.get('packaging') else 0,
            data.get('comments', ''),
            'new',
            'processing'
        ))
        order_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return jsonify({
            'success': True,
            'message': 'Заказ успешно создан',
            'order': {
                'id': order_id,
                'price': total_price,
                'distance': distance
            }
        })
    except Exception as e:
        print(f"[ERROR] Ошибка при создании заказа: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/orders/<int:order_id>', methods=['GET'])
@login_required
@swag_from({
    'tags': ['Заказы'],
    'security': [{'SessionAuth': []}],
    'parameters': [
        {
            'name': 'order_id',
            'in': 'path',
            'type': 'integer',
            'required': True,
            'description': 'ID заказа'
        }
    ],
    'responses': {
        200: {
            'description': 'Детали заказа',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'order': {
                        'type': 'object',
                        'properties': {
                            'id': {'type': 'integer', 'example': 1},
                            'senderName': {'type': 'string', 'example': 'Иван Иванов'},
                            'cargoDescription': {'type': 'string', 'example': 'Электроника'},
                            'status': {'type': 'string', 'example': 'new'},
                            'price': {'type': 'number', 'example': 1500}
                        }
                    }
                }
            }
        },
        403: {'description': 'Доступ запрещен'},
        404: {'description': 'Заказ не найден'}
    }
})
def get_order(order_id):
    """Получить детали заказа"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM orders WHERE id = ?', (order_id,))
    order = cursor.fetchone()
    if not order:
        conn.close()
        return jsonify({'success': False, 'message': 'Заказ не найден'}), 404
    # Проверка прав доступа
    cursor.execute('SELECT is_admin, is_driver FROM users WHERE id = ?', (session['user_id'],))
    user = cursor.fetchone()
    if not user['is_admin'] and not user['is_driver'] and order['user_id'] != session['user_id']:
        conn.close()
        return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
    conn.close()
    return jsonify({'success': True, 'order': dict(order)})

# === АДМИН: обработка заказов ===
@app.route('/api/admin/orders/<int:order_id>/decision', methods=['POST'])
@admin_required
@swag_from({
    'tags': ['Администрирование'],
    'security': [{'SessionAuth': []}],
    'parameters': [
        {
            'name': 'order_id',
            'in': 'path',
            'type': 'integer',
            'required': True,
            'description': 'ID заказа'
        },
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'decision': {'type': 'string', 'enum': ['confirm', 'reject'], 'example': 'confirm'},
                    'comment': {'type': 'string', 'example': 'Заказ подтвержден'}
                },
                'required': ['decision']
            }
        }
    ],
    'responses': {
        200: {
            'description': 'Решение по заказу применено',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'message': {'type': 'string', 'example': 'Решение применено'},
                    'status': {'type': 'string', 'example': 'confirmed'}
                }
            }
        },
        400: {'description': 'Некорректное решение'},
        404: {'description': 'Заказ не найден'}
    }
})
def admin_order_decision(order_id):
    """Подтвердить / отклонить заказ"""
    try:
        data = request.get_json()
        decision = data.get('decision')
        comment = data.get('comment', '')
        if decision not in ['confirm', 'reject']:
            return jsonify({'success': False, 'message': 'Некорректное решение'}), 400
        new_status = 'confirmed' if decision == 'confirm' else 'rejected'
        client_status = 'confirmed' if decision == 'confirm' else 'rejected'
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM orders WHERE id = ?', (order_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'message': 'Заказ не найден'}), 404
        cursor.execute('''
            UPDATE orders
            SET status = ?, client_status = ?, admin_comment = ?, processed_at = ?
            WHERE id = ?
        ''', (new_status, client_status, comment, datetime.now(), order_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Решение применено', 'status': new_status})
    except Exception as e:
        print(f"[ERROR] admin_order_decision: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/orders/<int:order_id>/assign', methods=['POST'])
@admin_required
@swag_from({
    'tags': ['Администрирование'],
    'security': [{'SessionAuth': []}],
    'parameters': [
        {
            'name': 'order_id',
            'in': 'path',
            'type': 'integer',
            'required': True,
            'description': 'ID заказа'
        },
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'driverId': {'type': 'integer', 'example': 5}
                },
                'required': ['driverId']
            }
        }
    ],
    'responses': {
        200: {
            'description': 'Водитель успешно назначен',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'message': {'type': 'string', 'example': 'Водитель назначен'},
                    'driverId': {'type': 'integer', 'example': 5}
                }
            }
        },
        400: {'description': 'Некорректные данные'},
        404: {'description': 'Заказ или водитель не найден'}
    }
})
def admin_assign_driver(order_id):
    """Назначить водителя на заказ"""
    try:
        data = request.get_json()
        driver_id = data.get('driverId')
        if not driver_id:
            return jsonify({'success': False, 'message': 'driverId обязателен'}), 400
        conn = get_db()
        cursor = conn.cursor()
        # Проверяем заказ
        cursor.execute('SELECT id FROM orders WHERE id = ?', (order_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'message': 'Заказ не найден'}), 404
        # Проверяем, что driver_id существует как пользователь с is_driver=1
        cursor.execute('SELECT id FROM users WHERE id = ? AND is_driver = 1', (driver_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'message': 'Водитель не найден'}), 404
        cursor.execute('''
            UPDATE orders
            SET driver_id = ?, assigned_at = ?
            WHERE id = ?
        ''', (driver_id, datetime.now(), order_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Водитель назначен', 'driverId': driver_id})
    except Exception as e:
        print(f"[ERROR] admin_assign_driver: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/orders/<int:order_id>/status', methods=['POST'])
@login_required
@swag_from({
    'tags': ['Заказы'],
    'security': [{'SessionAuth': []}],
    'parameters': [
        {
            'name': 'order_id',
            'in': 'path',
            'type': 'integer',
            'required': True,
            'description': 'ID заказа'
        },
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'status': {'type': 'string', 'example': 'in_transit'},
                    'clientStatus': {'type': 'string', 'example': 'in_transit'}
                },
                'required': ['status']
            }
        }
    ],
    'responses': {
        200: {
            'description': 'Статус успешно обновлен',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'message': {'type': 'string', 'example': 'Статус обновлен'}
                }
            }
        },
        403: {'description': 'Доступ запрещен'},
        404: {'description': 'Заказ не найден'}
    }
})
def update_order_status(order_id):
    """Обновление статуса заказа (водитель/админ/клиент)"""
    try:
        data = request.get_json()
        new_status = data.get('status')
        client_status = data.get('clientStatus')
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM orders WHERE id = ?', (order_id,))
        order = cursor.fetchone()
        if not order:
            conn.close()
            return jsonify({'success': False, 'message': 'Заказ не найден'}), 404
        # Проверка прав: админ — любые, водитель — только свои, клиент — только свой
        cursor.execute('SELECT is_admin, is_driver FROM users WHERE id = ?', (session['user_id'],))
        role = cursor.fetchone()
        is_admin = bool(role['is_admin'])
        is_driver = bool(role['is_driver'])
        is_owner = (order['user_id'] == session['user_id'])
        if is_driver and order['driver_id'] != session['user_id'] and not is_admin:
            conn.close()
            return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
        if not (is_admin or is_driver or is_owner):
            conn.close()
            return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
        # Обновляем статус и соответствующее поле времени
        update_fields = ['status = ?']
        update_values = [new_status]
        if client_status:
            update_fields.append('client_status = ?')
            update_values.append(client_status)
        if new_status == 'in_transit':
            update_fields.append('in_transit_at = ?')
            update_values.append(datetime.now())
        elif new_status == 'delivered':
            update_fields.append('delivered_at = ?')
            update_values.append(datetime.now())
            # Обновляем статистику водителя
            if is_driver and order['driver_id']:
                cursor.execute('''
                    UPDATE drivers 
                    SET completed_deliveries = completed_deliveries + 1 
                    WHERE user_id = ?
                ''', (order['driver_id'],))
        update_values.append(order_id)
        cursor.execute(f'''
            UPDATE orders
            SET {', '.join(update_fields)}
            WHERE id = ?
        ''', update_values)
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Статус обновлен'})
    except Exception as e:
        print(f"[ERROR] update_order_status: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/driver/orders/<int:order_id>/accept', methods=['POST'])
@login_required
@swag_from({
    'tags': ['Водители'],
    'security': [{'SessionAuth': []}],
    'parameters': [
        {
            'name': 'order_id',
            'in': 'path',
            'type': 'integer',
            'required': True,
            'description': 'ID заказа'
        }
    ],
    'responses': {
        200: {
            'description': 'Заказ успешно принят',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'message': {'type': 'string', 'example': 'Заказ принят'}
                }
            }
        },
        403: {'description': 'Доступ запрещен (нет прав водителя или заказ не назначен)'},
        404: {'description': 'Заказ не найден'}
    }
})
def driver_accept_order(order_id):
    """Водитель принимает заказ (меняет статус на in_transit)"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        # Проверяем что пользователь - водитель
        cursor.execute('SELECT is_driver FROM users WHERE id = ?', (session['user_id'],))
        user = cursor.fetchone()
        if not user or not user['is_driver']:
            conn.close()
            return jsonify({'success': False, 'message': 'Только водители могут принимать заказы'}), 403
        # Проверяем заказ
        cursor.execute('SELECT * FROM orders WHERE id = ?', (order_id,))
        order = cursor.fetchone()
        if not order:
            conn.close()
            return jsonify({'success': False, 'message': 'Заказ не найден'}), 404
        # Проверяем что заказ назначен этому водителю
        if order['driver_id'] != session['user_id']:
            conn.close()
            return jsonify({'success': False, 'message': 'Заказ не назначен вам'}), 403
        # Обновляем статус
        cursor.execute('''
            UPDATE orders 
            SET status = ?, client_status = ?, in_transit_at = ?, accepted_at = ?
            WHERE id = ?
        ''', ('in_transit', 'in_transit', datetime.now(), datetime.now(), order_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Заказ принят'})
    except Exception as e:
        print(f"[ERROR] driver_accept_order: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': str(e)}), 500

# === ЗАЯВКИ ВОДИТЕЛЕЙ ===
@app.route('/api/driver/application', methods=['GET'])
@login_required
@swag_from({
    'tags': ['Водители'],
    'security': [{'SessionAuth': []}],
    'responses': {
        200: {
            'description': 'Заявка водителя',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'application': {
                        'type': 'object',
                        'properties': {
                            'id': {'type': 'integer', 'example': 1},
                            'licenseNumber': {'type': 'string', 'example': '1234567890'},
                            'carModel': {'type': 'string', 'example': 'Volvo FH16'},
                            'status': {'type': 'string', 'example': 'pending'}
                        }
                    }
                }
            }
        }
    }
})
def get_driver_application():
    """Получить заявку водителя текущего пользователя"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM driver_applications WHERE user_id = ? ORDER BY applied_at DESC LIMIT 1
    ''', (session['user_id'],))
    app = cursor.fetchone()
    conn.close()
    if app:
        return jsonify({'success': True, 'application': dict(app)})
    return jsonify({'success': True, 'application': None})

@app.route('/api/driver/application', methods=['POST'])
@login_required
@swag_from({
    'tags': ['Водители'],
    'security': [{'SessionAuth': []}],
    'parameters': [
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'licenseNumber': {'type': 'string', 'example': '1234567890'},
                    'experience': {'type': 'integer', 'example': 5},
                    'carModel': {'type': 'string', 'example': 'Volvo FH16'},
                    'carNumber': {'type': 'string', 'example': 'А123ВС45'},
                    'maxWeight': {'type': 'number', 'example': 20000},
                    'carType': {'type': 'string', 'example': 'tent'}
                },
                'required': ['licenseNumber', 'experience', 'carModel', 'carNumber', 'maxWeight', 'carType']
            }
        }
    ],
    'responses': {
        200: {
            'description': 'Заявка успешно отправлена',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'message': {'type': 'string', 'example': 'Заявка успешно отправлена'},
                    'applicationId': {'type': 'integer', 'example': 1}
                }
            }
        },
        400: {'description': 'Уже есть активная заявка'}
    }
})
def submit_driver_application():
    """Подать заявку на роль водителя"""
    try:
        data = request.get_json()
        # Проверка существующей заявки
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM driver_applications WHERE user_id = ? AND status = ?',
                      (session['user_id'], 'pending'))
        if cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'message': 'У вас уже есть активная заявка'}), 400
        cursor.execute('''
            INSERT INTO driver_applications (
                user_id, license_number, experience, car_model, car_number,
                max_weight, car_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            session['user_id'],
            data.get('licenseNumber', ''),
            int(data.get('experience', 0)),
            data.get('carModel', ''),
            data.get('carNumber', ''),
            float(data.get('maxWeight', 0)),
            data.get('carType', 'tent')
        ))
        app_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Заявка успешно отправлена', 'applicationId': app_id})
    except Exception as e:
        print(f"[ERROR] Ошибка при подаче заявки: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': str(e)}), 500

# === АДМИНСКИЕ ФУНКЦИИ ===
@app.route('/api/admin/driver_applications', methods=['GET'])
@admin_required
@swag_from({
    'tags': ['Администрирование'],
    'security': [{'SessionAuth': []}],
    'responses': {
        200: {
            'description': 'Список заявок водителей',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'applications': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'id': {'type': 'integer', 'example': 1},
                                'firstName': {'type': 'string', 'example': 'Иван'},
                                'lastName': {'type': 'string', 'example': 'Иванов'},
                                'licenseNumber': {'type': 'string', 'example': '1234567890'},
                                'status': {'type': 'string', 'example': 'pending'}
                            }
                        }
                    }
                }
            }
        }
    }
})
def get_driver_applications():
    """Получить все заявки водителей (для админа)"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT da.*, u.first_name, u.last_name, u.phone, u.email
        FROM driver_applications da
        JOIN users u ON da.user_id = u.id
        ORDER BY da.applied_at DESC
    ''')
    applications = []
    for row in cursor.fetchall():
        app_dict = dict(row)
        applications.append(app_dict)
    conn.close()
    return jsonify({'success': True, 'applications': applications})

@app.route('/api/admin/driver_application/<int:app_id>/approve', methods=['POST'])
@admin_required
@swag_from({
    'tags': ['Администрирование'],
    'security': [{'SessionAuth': []}],
    'parameters': [
        {
            'name': 'app_id',
            'in': 'path',
            'type': 'integer',
            'required': True,
            'description': 'ID заявки'
        }
    ],
    'responses': {
        200: {
            'description': 'Заявка успешно одобрена',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'message': {'type': 'string', 'example': 'Заявка одобрена'}
                }
            }
        },
        400: {'description': 'Заявка уже обработана или не найдена'},
        404: {'description': 'Заявка не найдена'}
    }
})
def approve_driver_application(app_id):
    """Одобрить заявку водителя"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        # Получаем заявку
        cursor.execute('SELECT * FROM driver_applications WHERE id = ?', (app_id,))
        app = cursor.fetchone()
        if not app:
            conn.close()
            return jsonify({'success': False, 'message': 'Заявка не найдена'}), 404
        if app['status'] != 'pending':
            conn.close()
            return jsonify({'success': False, 'message': 'Заявка уже обработана'}), 400
        # Создаем запись водителя
        cursor.execute('''
            INSERT INTO drivers (
                user_id, license_number, experience, car_model, car_number,
                max_weight, car_type, status, work_status, hire_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            app['user_id'],
            app['license_number'],
            app['experience'],
            app['car_model'],
            app['car_number'],
            app['max_weight'],
            app['car_type'],
            'active',
            'active',
            datetime.now().date().isoformat()
        ))
        # Обновляем роль пользователя
        cursor.execute('UPDATE users SET is_driver = 1 WHERE id = ?', (app['user_id'],))
        # Обновляем статус заявки
        cursor.execute('''
            UPDATE driver_applications SET status = ?, processed_at = ?, processed_by = ?
            WHERE id = ?
        ''', ('approved', datetime.now(), session['user_id'], app_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Заявка одобрена'})
    except Exception as e:
        print(f"[ERROR] Ошибка при одобрении заявки: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/driver_application/<int:app_id>/reject', methods=['POST'])
@admin_required
@swag_from({
    'tags': ['Администрирование'],
    'security': [{'SessionAuth': []}],
    'parameters': [
        {
            'name': 'app_id',
            'in': 'path',
            'type': 'integer',
            'required': True,
            'description': 'ID заявки'
        }
    ],
    'responses': {
        200: {
            'description': 'Заявка успешно отклонена',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'message': {'type': 'string', 'example': 'Заявка отклонена'}
                }
            }
        },
        404: {'description': 'Заявка не найдена'}
    }
})
def reject_driver_application(app_id):
    """Отклонить заявку водителя"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM driver_applications WHERE id = ?', (app_id,))
        app = cursor.fetchone()
        if not app:
            conn.close()
            return jsonify({'success': False, 'message': 'Заявка не найдена'}), 404
        cursor.execute('''
            UPDATE driver_applications SET status = ?, processed_at = ?, processed_by = ?
            WHERE id = ?
        ''', ('rejected', datetime.now(), session['user_id'], app_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Заявка отклонена'})
    except Exception as e:
        print(f"[ERROR] Ошибка при отклонении заявки: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': str(e)}), 500

# === АДМИН: список водителей ===
@app.route('/api/admin/drivers', methods=['GET'])
@admin_required
@swag_from({
    'tags': ['Администрирование'],
    'security': [{'SessionAuth': []}],
    'responses': {
        200: {
            'description': 'Список водителей',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'drivers': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'id': {'type': 'integer', 'example': 1},
                                'firstName': {'type': 'string', 'example': 'Иван'},
                                'lastName': {'type': 'string', 'example': 'Иванов'},
                                'carModel': {'type': 'string', 'example': 'Volvo FH16'},
                                'status': {'type': 'string', 'example': 'active'}
                            }
                        }
                    }
                }
            }
        }
    }
})
def admin_drivers():
    """Получить список водителей с данными пользователя"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT d.*, u.first_name, u.last_name, u.phone, u.email
            FROM drivers d
            JOIN users u ON d.user_id = u.id
            ORDER BY d.id DESC
        ''')
        drivers = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify({'success': True, 'drivers': drivers})
    except Exception as e:
        print(f"[ERROR] admin_drivers: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/drivers/<int:driver_user_id>/dismiss', methods=['POST'])
@admin_required
@swag_from({
    'tags': ['Администрирование'],
    'security': [{'SessionAuth': []}],
    'parameters': [
        {
            'name': 'driver_user_id',
            'in': 'path',
            'type': 'integer',
            'required': True,
            'description': 'ID пользователя-водителя'
        },
        {
            'name': 'body',
            'in': 'body',
            'schema': {
                'type': 'object',
                'properties': {
                    'reason': {'type': 'string', 'example': 'Нарушение правил'},
                    'action': {'type': 'string', 'enum': ['reassign', 'cancel', 'keep'], 'example': 'reassign'}
                }
            }
        }
    ],
    'responses': {
        200: {
            'description': 'Водитель успешно удален',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'message': {'type': 'string', 'example': 'Водитель успешно удален из системы'}
                }
            }
        },
        404: {'description': 'Водитель не найден'}
    }
})
def dismiss_driver(driver_user_id):
    """Удалить водителя из системы"""
    try:
        data = request.get_json() or {}
        reason = data.get('reason', '')
        conn = get_db()
        cursor = conn.cursor()
        # Проверяем водителя
        cursor.execute('SELECT * FROM drivers WHERE user_id = ?', (driver_user_id,))
        driver = cursor.fetchone()
        if not driver:
            conn.close()
            return jsonify({'success': False, 'message': 'Водитель не найден'}), 404
        # Удаляем запись водителя из таблицы drivers
        cursor.execute('DELETE FROM drivers WHERE user_id = ?', (driver_user_id,))
        # Снимаем роль водителя с пользователя
        cursor.execute('UPDATE users SET is_driver = 0 WHERE id = ?', (driver_user_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Водитель успешно удален из системы'})
    except Exception as e:
        print(f"[ERROR] dismiss_driver: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/drivers/<int:driver_user_id>/restore', methods=['POST'])
@admin_required
@swag_from({
    'tags': ['Администрирование'],
    'security': [{'SessionAuth': []}],
    'parameters': [
        {
            'name': 'driver_user_id',
            'in': 'path',
            'type': 'integer',
            'required': True,
            'description': 'ID пользователя-водителя'
        }
    ],
    'responses': {
        200: {
            'description': 'Водитель успешно восстановлен',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'message': {'type': 'string', 'example': 'Водитель восстановлен'}
                }
            }
        },
        404: {'description': 'Водитель не найден'}
    }
})
def restore_driver(driver_user_id):
    """Восстановить водителя"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM drivers WHERE user_id = ?', (driver_user_id,))
        driver = cursor.fetchone()
        if not driver:
            conn.close()
            return jsonify({'success': False, 'message': 'Водитель не найден'}), 404
        cursor.execute('''
            UPDATE drivers 
            SET status = 'active',
                inactive_since = NULL,
                inactive_reason = NULL,
                dismissal_reason = NULL,
                dismissed_by = NULL
            WHERE user_id = ?
        ''', (driver_user_id,))
        cursor.execute('UPDATE users SET is_driver = 1 WHERE id = ?', (driver_user_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Водитель восстановлен'})
    except Exception as e:
        print(f"[ERROR] restore_driver: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': str(e)}), 500

# === ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ВОДИТЕЛЕЙ ===
@app.route('/api/driver/info', methods=['GET'])
@login_required
@swag_from({
    'tags': ['Водители'],
    'security': [{'SessionAuth': []}],
    'responses': {
        200: {
            'description': 'Информация о водителе',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'driver': {
                        'type': 'object',
                        'properties': {
                            'id': {'type': 'integer', 'example': 1},
                            'licenseNumber': {'type': 'string', 'example': '1234567890'},
                            'carModel': {'type': 'string', 'example': 'Volvo FH16'},
                            'completedDeliveries': {'type': 'integer', 'example': 15}
                        }
                    }
                }
            }
        },
        404: {'description': 'Водитель не найден'}
    }
})
def get_driver_info():
    """Получить информацию о водителе (для текущего пользователя)"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT d.*, u.first_name, u.last_name, u.phone, u.email
            FROM drivers d
            JOIN users u ON d.user_id = u.id
            WHERE d.user_id = ?
        ''', (session['user_id'],))
        driver = cursor.fetchone()
        conn.close()
        if driver:
            return jsonify({'success': True, 'driver': dict(driver)})
        return jsonify({'success': False, 'message': 'Водитель не найден'}), 404
    except Exception as e:
        print(f"[ERROR] get_driver_info: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/driver/work-status', methods=['POST'])
@login_required
@swag_from({
    'tags': ['Водители'],
    'security': [{'SessionAuth': []}],
    'parameters': [
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'workStatus': {'type': 'string', 'enum': ['active', 'inactive'], 'example': 'active'}
                },
                'required': ['workStatus']
            }
        }
    ],
    'responses': {
        200: {
            'description': 'Статус работы успешно обновлен',
            'schema': {
                'type': 'object',
                'properties': {
                    'success': {'type': 'boolean', 'example': True},
                    'message': {'type': 'string', 'example': 'Статус работы обновлен'}
                }
            }
        },
        400: {'description': 'Некорректный статус'},
        403: {'description': 'Только водители могут изменять статус работы'}
    }
})
def update_driver_work_status():
    """Обновить статус работы водителя (active/inactive)"""
    try:
        data = request.get_json()
        work_status = data.get('workStatus')
        if work_status not in ['active', 'inactive']:
            return jsonify({'success': False, 'message': 'Некорректный статус'}), 400
        conn = get_db()
        cursor = conn.cursor()
        # Проверяем что пользователь - водитель
        cursor.execute('SELECT is_driver FROM users WHERE id = ?', (session['user_id'],))
        user = cursor.fetchone()
        if not user or not user['is_driver']:
            conn.close()
            return jsonify({'success': False, 'message': 'Только водители могут изменять статус работы'}), 403
        cursor.execute('''
            UPDATE drivers SET work_status = ? WHERE user_id = ?
        ''', (work_status, session['user_id']))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Статус работы обновлен'})
    except Exception as e:
        print(f"[ERROR] update_driver_work_status: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': str(e)}), 500

# === ГЛАВНАЯ ФУНКЦИЯ ===
if __name__ == '__main__':
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        print("[INFO] Запуск Flask-сервера...")
    init_db()
    app.run(
        host='127.0.0.1',
        port=5000,
        debug=True,
        use_reloader=True
    )