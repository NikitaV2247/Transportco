// === Работа с API  ===
const API_BASE_URL = 'http://127.0.0.1:5000/api';

// Текущий пользователь (загружается из API)
let currentUser = null;

// Кэш данных (загружаются из API)
let orders = [];
let driverApplications = [];
let drivers = [];
let notifications = [];

// Функция для загрузки текущего пользователя
async function loadCurrentUser() {
    try {
        const response = await fetch(`${API_BASE_URL}/current-user`, {
            credentials: 'include'
        });
        const data = await response.json();
        if (data.success && data.user) {
            currentUser = data.user;
            return currentUser;
        }
        return null;
    } catch (error) {
        console.error('Ошибка загрузки пользователя:', error);
        return null;
    }
}

// Функция для загрузки заказов
async function loadOrders() {
    try {
        const response = await fetch(`${API_BASE_URL}/orders`, {
            credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
            orders = (data.orders || []).map(normalizeOrder);
            return orders;
        }
        return [];
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        return [];
    }
}

// Константы статусов заказов
const ORDER_STATUSES = {
// Статусы для клиента
CLIENT: {
    PROCESSING: 'processing',       // В обработке
    CONFIRMED: 'confirmed',         // Подтвержден
    IN_TRANSIT: 'in_transit',       // В пути
    DELIVERED: 'delivered',         // Завершен
    REJECTED: 'rejected',           // Отклонен
    CANCELLED: 'cancelled'          // Отменен
},
// Статусы для администратора
ADMIN: {
    NEW: 'new',                     // Новый
    CONFIRMED: 'confirmed',         // Подтвержден
    IN_TRANSIT: 'in_transit',       // В пути
    DELIVERED: 'delivered',         // Завершен
    REJECTED: 'rejected',           // Отклонен
    CANCELLED_BY_CLIENT: 'cancelled_by_client' // Отменен клиентом
}
};

// Нормализация заказов из API (snake_case -> camelCase)
function normalizeOrder(o) {
    return {
        id: Number(o.id),
        userId: Number(o.user_id ?? o.userId),
        driverId: o.driver_id !== undefined ? Number(o.driver_id) : (o.driverId !== undefined ? Number(o.driverId) : null),
        senderName: o.sender_name || o.senderName,
        senderPhone: o.sender_phone || o.senderPhone,
        senderEmail: o.sender_email || o.senderEmail,
        cargoDescription: o.cargo_description || o.cargoDescription,
        productCategory: o.product_category || o.productCategory,
        cargoWeight: o.cargo_weight ?? o.cargoWeight,
        cargoVolume: o.cargo_volume ?? o.cargoVolume,
        cargoType: o.cargo_type || o.cargoType,
        shippingDate: o.shipping_date || o.shippingDate,
        pickupAddress: o.pickup_address || o.pickupAddress,
        deliveryAddress: o.delivery_address || o.deliveryAddress,
        distance: o.distance,
        price: o.price !== undefined && o.price !== null && o.price !== '' ? Number(o.price) : null, // fix
        insurance: !!(o.insurance),
        packaging: !!(o.packaging),
        comments: o.comments,
        status: o.status,
        clientStatus: o.client_status || o.clientStatus || o.status,
        adminComment: o.admin_comment || o.adminComment,
        cancellationReason: o.cancellation_reason || o.cancellationReason,
        cancellationFee: o.cancellation_fee ?? o.cancellationFee,
        refundAmount: o.refund_amount ?? o.refundAmount,
        createdAt: o.created_at || o.createdAt,
        processedAt: o.processed_at || o.processedAt,
        assignedAt: o.assigned_at || o.assignedAt,
        acceptedAt: o.accepted_at || o.acceptedAt,
        inTransitAt: o.in_transit_at || o.inTransitAt,
        deliveredAt: o.delivered_at || o.deliveredAt,
        cancelledAt: o.cancelled_at || o.cancelledAt
    };
}

function normalizeDriverApplication(a) {
    return {
        id: a.id,
        userId: a.user_id,
        licenseNumber: a.license_number,
        experience: a.experience,
        carModel: a.car_model,
        carNumber: a.car_number,
        maxWeight: a.max_weight,
        carType: a.car_type,
        status: a.status,
        appliedAt: a.applied_at,
        processedAt: a.processed_at,
        processedBy: a.processed_by,
        firstName: a.first_name,
        lastName: a.last_name,
        phone: a.phone,
        email: a.email
    };
}

function normalizeDriver(d) {
    return {
        id: d.id,
        userId: d.user_id,
        licenseNumber: d.license_number,
        experience: d.experience,
        carModel: d.car_model,
        carNumber: d.car_number,
        maxWeight: d.max_weight,
        carType: d.car_type,
        status: d.status ? String(d.status) : '', // тип безопасности
        workStatus: d.work_status,
        completedDeliveries: d.completed_deliveries,
        hireDate: d.hire_date,
        firstName: d.first_name,
        lastName: d.last_name,
        phone: d.phone,
        email: d.email
    };
}

// Функция для получения текста статуса в зависимости от роли пользователя
function getStatusText(status, isAdmin = false) {
if (isAdmin) {
    switch(status) {
        case ORDER_STATUSES.ADMIN.NEW: return 'Новый';
        case ORDER_STATUSES.ADMIN.CONFIRMED: return 'Подтвержден';
        case ORDER_STATUSES.ADMIN.IN_TRANSIT: return 'В пути';
        case ORDER_STATUSES.ADMIN.DELIVERED: return 'Завершен';
        case ORDER_STATUSES.ADMIN.REJECTED: return 'Отклонен';
        case ORDER_STATUSES.ADMIN.CANCELLED_BY_CLIENT: return 'Отменен клиентом';
        default: return status;
    }
} else {
    switch(status) {
        case ORDER_STATUSES.CLIENT.PROCESSING:
        case ORDER_STATUSES.ADMIN.NEW:
            return 'В обработке';
        case ORDER_STATUSES.CLIENT.CONFIRMED:
        case ORDER_STATUSES.ADMIN.CONFIRMED:
            return 'Подтвержден';
        case ORDER_STATUSES.CLIENT.IN_TRANSIT:
        case ORDER_STATUSES.ADMIN.IN_TRANSIT:
            return 'В пути';
        case ORDER_STATUSES.CLIENT.DELIVERED:
        case ORDER_STATUSES.ADMIN.DELIVERED:
            return 'Завершен';
        case ORDER_STATUSES.CLIENT.REJECTED:
        case ORDER_STATUSES.ADMIN.REJECTED:
            return 'Отклонен';
        case ORDER_STATUSES.CLIENT.CANCELLED:
        case ORDER_STATUSES.ADMIN.CANCELLED_BY_CLIENT:
            return 'Отменен';
        default: return status;
    }
}
}

// Функция для получения CSS класса статуса
function getStatusClass(status) {
switch(status) {
    case ORDER_STATUSES.CLIENT.PROCESSING:
    case ORDER_STATUSES.ADMIN.NEW:
        return 'processing';
    case ORDER_STATUSES.CLIENT.CONFIRMED:
    case ORDER_STATUSES.ADMIN.CONFIRMED:
        return 'confirmed';
    case ORDER_STATUSES.CLIENT.IN_TRANSIT:
    case ORDER_STATUSES.ADMIN.IN_TRANSIT:
        return 'in-transit';
    case ORDER_STATUSES.CLIENT.DELIVERED:
    case ORDER_STATUSES.ADMIN.DELIVERED:
        return 'delivered';
    case ORDER_STATUSES.CLIENT.REJECTED:
    case ORDER_STATUSES.ADMIN.REJECTED:
        return 'rejected';
    case ORDER_STATUSES.CLIENT.CANCELLED:
    case ORDER_STATUSES.ADMIN.CANCELLED_BY_CLIENT:
        return 'cancelled';
    default:
        return 'new';
}
}

// Функция преобразования статуса между ролями
function convertStatusForRole(status, targetRole) {
// Преобразование статуса "Новый" администратора в "В обработке" для клиента
if (status === ORDER_STATUSES.ADMIN.NEW && targetRole === 'client') {
    return ORDER_STATUSES.CLIENT.PROCESSING;
}
// Преобразование статуса "Отменен клиентом" администратора в "Отменен" для клиента
else if (status === ORDER_STATUSES.ADMIN.CANCELLED_BY_CLIENT && targetRole === 'client') {
    return ORDER_STATUSES.CLIENT.CANCELLED;
}
// Преобразование статуса "В обработке" клиента в "Новый" для администратора
else if (status === ORDER_STATUSES.CLIENT.PROCESSING && targetRole === 'admin') {
    return ORDER_STATUSES.ADMIN.NEW;
}
// Преобразование статуса "Отменен" клиента в "Отменен клиентом" для администратора
else if (status === ORDER_STATUSES.CLIENT.CANCELLED && targetRole === 'admin') {
    return ORDER_STATUSES.ADMIN.CANCELLED_BY_CLIENT;
}
// Для остальных статусов преобразование 1:1
else if (status.includes('confirmed') || status.includes('in_transit') ||
        status.includes('delivered') || status.includes('rejected')) {
    return status;
}

return status; // На случай неизвестного статуса
}

function getCategoryName(categoryCode) {
const categories = {
    'electronics': 'Электроника',
    'clothing': 'Одежда и обувь',
    'furniture': 'Мебель',
    'food': 'Продукты питания',
    'building': 'Строительные материалы',
    'auto': 'Автозапчасти',
    'industrial': 'Промышленное оборудование',
    'chemicals': 'Химические вещества',
    'documents': 'Документы',
    'other': 'Другое'
};

return categories[categoryCode] || categoryCode;
}

// Функция для преобразования типа кузова
function getCarTypeName(carType) {
const carTypes = {
    'tent': 'Тент',
    'refrigerator': 'Рефрижератор',
    'container': 'Контейнер',
    'tank': 'Цистерна',
    'flatbed': 'Платформа'
};
return carTypes[carType] || carType;
}

function getCargoTypeName(cargoTypeCode) {
const cargoTypes = {
    'general': 'Общий груз',
    'fragile': 'Хрупкий груз',
    'dangerous': 'Опасный груз',
    'perishable': 'Скоропортящийся груз'
};
return cargoTypes[cargoTypeCode] || cargoTypeCode;
}

// База расстояний между городами (в км)
const cityDistances = {
// Центральный регион
'Москва': {
    'Санкт-Петербург': 714,
    'Кострома': 346,
    'Ярославль': 274,
    'Владимир': 194,
    'Казань': 807,
    'Нижний Новгород': 416,
    'Екатеринбург': 1745,
    'Новосибирск': 3350,
    'Сочи': 1584
},
'Санкт-Петербург': {
    'Москва': 710,
    'Кострома': 860,
    'Ярославль': 800,
    'Великий Новгород': 180,
    'Псков': 280,
    'Мурманск': 1400
},
'Кострома': {
    'Москва': 340,
    'Санкт-Петербург': 860,
    'Ярославль': 85,
    'Иваново': 110,
    'Нижний Новгород': 330,
    'Вологда': 220
},
'Ярославль': {
    'Москва': 280,
    'Санкт-Петербург': 800,
    'Кострома': 85,
    'Вологда': 200,
    'Рыбинск': 75
}
};

// Функция для расчета расстояния между городами
function calculateDistance(city1, city2) {
if (!city1 || !city2) return 100; // Значение по умолчанию

const normalizedCity1 = normalizeCityName(city1);
const normalizedCity2 = normalizeCityName(city2);

if (normalizedCity1 === normalizedCity2) {
    return 10; // Внутри города
}

// Проверяем в обе стороны
if (cityDistances[normalizedCity1] && cityDistances[normalizedCity1][normalizedCity2]) {
    return cityDistances[normalizedCity1][normalizedCity2];
}

if (cityDistances[normalizedCity2] && cityDistances[normalizedCity2][normalizedCity1]) {
    return cityDistances[normalizedCity2][normalizedCity1];
}
}

// Функция для нормализации названия города
function normalizeCityName(city) {
if (!city) return '';

// Удаляем лишние пробелы, приводим к нижнему регистру
const normalized = city.trim().toLowerCase();

// Ищем соответствие в базе городов
const knownCities = Object.keys(cityDistances);
const found = knownCities.find(knownCity =>
    knownCity.toLowerCase().includes(normalized) ||
    normalized.includes(knownCity.toLowerCase())
);

return found || city.trim();
}

// Временные данные для регистрации
let tempRegistrationData = null;

// Переменная для запоминания страницы после авторизации
let pendingPageAfterLogin = null;

// Система уведомлений
function showNotification(message, type = 'info', duration = 5000) {
const container = document.getElementById('notificationContainer');

const notification = document.createElement('div');
notification.className = `notification notification-${type}`;

notification.innerHTML = `
    <div class="notification-content">${message}</div>
    <button class="notification-close" onclick="this.parentElement.remove()">×</button>
`;

container.appendChild(notification);

// Автоматическое удаление через указанное время
if (duration > 0) {
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.add('hiding');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, duration);
}

return notification;
}

// Функция для переключения страниц
function showPage(pageId) {
// Проверяем авторизацию для доступа к профилю и заказу
if ((pageId === 'profile' || pageId === 'order') && !currentUser) {
    if (pageId === 'order') {
        showNotification('Для оформления заказа необходимо войти в аккаунт', 'warning');
        pendingPageAfterLogin = 'order';
    }
    openLoginModal();
    return;
}

// Скрыть все страницы
const pages = document.querySelectorAll('.page-content');
pages.forEach(page => {
    page.classList.remove('active');
});

// Показать выбранную страницу
const pageElement = document.getElementById(pageId + '-page');
if (pageElement) {
    pageElement.classList.add('active');
}

// Обновить активную ссылку в навигации
const navLinks = document.querySelectorAll('nav a');
navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.textContent === getPageName(pageId)) {
        link.classList.add('active');
    }
});

// Прокрутить вверх
window.scrollTo(0, 0);

// Если показываем страницу профиля, показываем соответствующую вкладку
if (pageId === 'profile') {
    if (currentUser.isAdmin) {
        showProfileTab('admin-orders');
    } else if (currentUser.isDriver) {
        showProfileTab('driver-active-orders');
    } else {
        showProfileTab('data');
        setTimeout(() => {
            updateProfileOrderStats();
        }, 100);
    }
}

// Если показываем страницу заказа, заполняем поля данными пользователя
if (pageId === 'order' && currentUser) {
    fillOrderFormWithUserData();
}
}

// Функция для получения названия страницы по ID
function getPageName(pageId) {
const pageNames = {
    'main': 'Главная',
    'about': 'О компании',
    'contacts': 'Контакты',
    'profile': 'Профиль',
    'order': 'Заказать перевозку'
};

return pageNames[pageId] || 'Главная';
}

// Функция отображения заказов пользователя
function displayUserOrders(ordersList) {
const ordersTable = document.getElementById('profile-orders-table');
    if (!ordersTable) return;
const existingRows = ordersTable.querySelectorAll('.order-row');
existingRows.forEach(row => row.remove());
let tableBody = ordersTable.querySelector('tbody');
if (!tableBody) {
    tableBody = document.createElement('tbody');
    ordersTable.appendChild(tableBody);
}
tableBody.innerHTML = '';
ordersList.forEach((order, index) => {
    const row = document.createElement('div');
    row.className = 'order-row';
        let formattedDate = 'Не указана';
        if (order.createdAt) {
            try {
    const orderDate = new Date(order.createdAt);
                if (!isNaN(orderDate.getTime())) {
                    formattedDate = orderDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
                }
            } catch (e) { console.error('Ошибка форматирования даты:', e); }
        }
    let formattedShippingDate = 'Не указана';
    if (order.shippingDate) {
        const shippingDate = new Date(order.shippingDate);
            formattedShippingDate = shippingDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
    }
        const clientStatus = order.clientStatus || order.status || 'processing';
    const statusText = getStatusText(clientStatus, false);
    const statusClass = getStatusClass(clientStatus);
    const categoryName = getCategoryName(order.productCategory);
    row.innerHTML = `
            <div class="order-cell order-id" data-label="№ заказа"><span class="order-id-text">#${order.id}</span></div>
            <div class="order-cell date-container" data-label="Дата заявки"><span class="date-day">${formattedDate}</span></div>
            <div class="order-cell date-container order-shipping-date-cell" data-label="Дата отправки"><span class="date-day">${formattedShippingDate}</span></div>
            <div class="order-cell address-container" data-label="Адрес отправления"><span class="address-line">${order.pickupAddress || 'Не указан'}</span></div>
            <div class="order-cell address-container" data-label="Адрес доставки"><span class="address-line">${order.deliveryAddress || 'Не указан'}</span></div>
            <div class="order-cell" data-label="Груз"><span class="cargo-text">${order.cargoDescription || 'Не указан'}</span></div>
            <div class="order-cell order-category-cell" data-label="Категория"><span>${categoryName || 'Не указана'}</span></div>
            <div class="order-cell order-status-cell" data-label="Статус"><div class="order-status ${statusClass}"><span class="status-icon">●</span><span>${statusText}</span></div></div>
            <div class="order-cell" data-label="Расстояние"><span>${order.distance ? order.distance + ' км' : 'Не указано'}</span></div>
            <div class="order-cell order-price-cell" data-label="Цена"><span class="order-price">${order.price !== null && order.price !== undefined ? `${order.price} ₽` : 'Не указана'}</span></div>
            <div class="order-cell order-actions-cell" data-label="Действия"><div class="actions-container"></div></div>`;
    tableBody.appendChild(row);
});
}

// Обработчик формы профиля
async function handleProfileSubmit(event) {
event.preventDefault();

const currentPassword = document.getElementById('profile-current-password').value;
const newPassword = document.getElementById('profile-new-password').value;
const confirmPassword = document.getElementById('profile-confirm-password').value;

// Проверка на смену пароля
if (currentPassword || newPassword || confirmPassword) {
    if (newPassword !== confirmPassword) {
        showNotification('Новый пароль и подтверждение не совпадают', 'error');
        return false;
    }
    if (newPassword.length < 6) {
        showNotification('Новый пароль должен содержать минимум 6 символов', 'error');
        return false;
    }

    // Отправляем запрос на смену пароля (проверка пароля на сервере)
    try {
        const response = await fetch(`${API_BASE_URL}/profile/password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                currentPassword: currentPassword,
                newPassword: newPassword
            })
        });

        const data = await response.json();
        if (data.success) {
            showNotification('Пароль успешно изменен!', 'success');
        } else {
            showNotification(data.message || 'Ошибка при смене пароля', 'error');
        return false;
    }
    } catch (error) {
        console.error('Ошибка смены пароля:', error);
        showNotification('Ошибка соединения с сервером', 'error');
        return false;
    }

    // Очищаем поля пароля
    document.getElementById('profile-current-password').value = '';
    document.getElementById('profile-new-password').value = '';
    document.getElementById('profile-confirm-password').value = '';
}

showNotification('Изменения сохранены!', 'success');
return false;
}

// Функция для имитации авторизации
function loginUser() {
document.getElementById('unauth-buttons').style.display = 'none';
document.getElementById('auth-user-buttons').style.display = 'flex';

// Обновляем данные профиля
if (currentUser) {
    document.getElementById('profile-first-name').value = currentUser.firstName || '';
    document.getElementById('profile-last-name').value = currentUser.lastName || '';
    document.getElementById('profile-email').value = currentUser.email || '';
    document.getElementById('profile-phone').value = currentUser.phone || '';

    // Обновляем навигацию в зависимости от роли
    updateProfileNavigation();

    // Обновляем видимость кнопки "Заказать перевозку"
    updateOrderButtonVisibility();
}
}

// Обновление навигации профиля в зависимости от роли
function updateProfileNavigation() {
const profileNav = document.querySelector('.profile-nav');
if (!profileNav) return;

let navHTML = '';

if (currentUser.isAdmin) {
    navHTML = `
        <button class="profile-nav-btn active" onclick="showProfileTab('data')">Данные</button>
        <button class="profile-nav-btn" onclick="showProfileTab('admin-orders')">Управление заказами</button>
        <button class="profile-nav-btn" onclick="showProfileTab('driver-applications')">Заявки водителей</button>
        <button class="profile-nav-btn" onclick="showProfileTab('drivers-list')">Водители</button>
    `;
} else if (currentUser.isDriver) {
    // Навигация для водителя
    navHTML = `
        <button class="profile-nav-btn active" onclick="showProfileTab('data')">Данные</button>
        <button class="profile-nav-btn" onclick="showProfileTab('driver-active-orders')">Мои заказы</button>
        <button class="profile-nav-btn" onclick="showProfileTab('driver-history')">История доставок</button>
    `;
} else {
    // Навигация для обычного пользователя
    navHTML = `
        <button class="profile-nav-btn active" onclick="showProfileTab('data')">Данные</button>
        <button class="profile-nav-btn" onclick="showProfileTab('orders')">Мои заказы</button>
        <button class="profile-nav-btn" onclick="showProfileTab('become-driver')">Стать водителем</button>
    `;
}

profileNav.innerHTML = navHTML;
}

// Функция для обновления видимости кнопки "Заказать перевозку"
function updateOrderButtonVisibility() {
const headerOrderButton = document.getElementById('order-button');
const mainPageOrderButton = document.getElementById('main-page-order-button');

if (currentUser && (currentUser.isAdmin || currentUser.isDriver)) {
    // Скрыть кнопку для администраторов и водителей
    if (headerOrderButton) {
        headerOrderButton.style.display = 'none';
    }
    if (mainPageOrderButton) {
        mainPageOrderButton.style.display = 'none';
    }
} else {
    // Показать кнопку для обычных пользователей и неавторизованных
    if (headerOrderButton) {
        headerOrderButton.style.display = 'inline-block';
    }
    if (mainPageOrderButton) {
        mainPageOrderButton.style.display = 'inline-block';
    }
}
}

async function logout() {
try {
    await fetch(`${API_BASE_URL}/logout`, {
        method: 'POST',
        credentials: 'include'
    });
} catch (error) {
    console.error('Ошибка выхода:', error);
}

currentUser = null;
orders = [];
driverApplications = [];
drivers = [];
notifications = [];

document.getElementById('unauth-buttons').style.display = 'flex';
document.getElementById('auth-user-buttons').style.display = 'none';

updateOrderButtonVisibility();

showPage('main');
showNotification('Вы успешно вышли из системы', 'info');
}

// Функции для работы с модальными окнами авторизации и регистрации
function openLoginModal() {
document.getElementById('loginModal').classList.add('active');
document.body.style.overflow = 'hidden';
}

function closeLoginModal() {
document.getElementById('loginModal').classList.remove('active');
document.body.style.overflow = 'auto';
}

function openRegisterModal() {
document.getElementById('registerModal').classList.add('active');
document.body.style.overflow = 'hidden';
}

function closeRegisterModal() {
document.getElementById('registerModal').classList.remove('active');
document.body.style.overflow = 'auto';
}

function switchToRegister() {
closeLoginModal();
openRegisterModal();
}

function switchToLogin() {
closeRegisterModal();
openLoginModal();
}

// Функции для модальных окон регистрации с SMS
function openConfirmRegisterCodeModal() {
document.getElementById('confirmRegisterCodeModal').classList.add('active');
document.body.style.overflow = 'hidden';
startRegisterTimer();
}

function closeConfirmRegisterCodeModal() {
document.getElementById('confirmRegisterCodeModal').classList.remove('active');
document.body.style.overflow = 'auto';
resetRegisterTimer();
}

function backToRegister() {
closeConfirmRegisterCodeModal();
openRegisterModal();
}

// Функция для перемещения между полями ввода кода при регистрации
function moveToNextRegister(currentIndex, event) {
const input = event.target;
const value = input.value;

if (value.length === 1 && currentIndex < 4) {
    document.getElementById(`reg-sms-code-${currentIndex + 1}`).focus();
}

if (event.inputType === 'deleteContentBackward' && currentIndex > 1 && value.length === 0) {
    document.getElementById(`reg-sms-code-${currentIndex - 1}`).focus();
}
}

// Таймер для повторной отправки кода при регистрации
let registerTimerInterval;
let registerTimerSeconds = 59;

function startRegisterTimer() {
clearInterval(registerTimerInterval);
registerTimerSeconds = 59;

const resendCodeElement = document.getElementById('reg-resend-code');
resendCodeElement.classList.add('disabled');

registerTimerInterval = setInterval(() => {
    const timerElement = document.getElementById('reg-sms-timer');
    timerElement.textContent = `Пожалуйста подождите... ${registerTimerSeconds} сек`;

    if (registerTimerSeconds <= 0) {
        clearInterval(registerTimerInterval);
        timerElement.textContent = 'Код не пришел?';
        resendCodeElement.classList.remove('disabled');
    }

    registerTimerSeconds--;
}, 1000);
}

function resetRegisterTimer() {
clearInterval(registerTimerInterval);
document.getElementById('reg-sms-timer').textContent = 'Пожалуйста подождите... 59 сек';
document.getElementById('reg-resend-code').classList.add('disabled');
}

// Функция для повторной отправки кода при регистрации
function resendRegisterCode() {
const resendCodeElement = document.getElementById('reg-resend-code');

if (resendCodeElement.classList.contains('disabled')) {
    return;
}

showNotification('Код отправлен повторно!', 'success');
startRegisterTimer();
}

// Функция для проверки введенного кода при регистрации
function verifyRegisterCode() {
const code1 = document.getElementById('reg-sms-code-1').value;
const code2 = document.getElementById('reg-sms-code-2').value;
const code3 = document.getElementById('reg-sms-code-3').value;
const code4 = document.getElementById('reg-sms-code-4').value;

const fullCode = code1 + code2 + code3 + code4;

if (fullCode.length !== 4) {
    showNotification('Пожалуйста, введите полный код из 4 цифр', 'warning');
    return;
}

// Проверяем код (для демо используем "1234")
if (fullCode === "1234") {
    // Регистрируем пользователя через API после проверки кода
    if (tempRegistrationData) {
        fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(tempRegistrationData)
        })
        .then(resp => resp.json())
        .then(data => {
            if (data.success) {
                currentUser = data.user;
        showNotification('Регистрация подтверждена! Вы успешно зарегистрировались.', 'success');
        closeConfirmRegisterCodeModal();
                closeRegisterModal();
        loginUser();
        if (pendingPageAfterLogin) {
            showPage(pendingPageAfterLogin);
            pendingPageAfterLogin = null;
        } else {
            showPage('profile');
        }
            } else {
                showNotification(data.message || 'Ошибка регистрации', 'error');
            }
        })
        .catch(err => {
            console.error('Ошибка регистрации:', err);
            showNotification('Ошибка соединения с сервером', 'error');
        })
        .finally(() => {
            tempRegistrationData = null;
        });
    } else {
        showNotification('Ошибка регистрации: данные не найдены', 'error');
    }
} else {
    showNotification('Неверный код подтверждения. Попробуйте еще раз.', 'error');
}
}

async function confirmNewPassword() {
    const pass1 = document.getElementById('reset-new-pass')?.value || '';
    const pass2 = document.getElementById('reset-new-pass-confirm')?.value || '';
    const contact = document.getElementById('recovery-contact')?.value || '';

    if (!contact) {
        showNotification('Укажите email или телефон, использованный при регистрации', 'error');
        return;
    }
    if (!pass1 || pass1.length < 6) {
        showNotification('Пароль должен быть не менее 6 символов', 'error');
        return;
    }
    if (pass1 !== pass2) {
        showNotification('Пароли не совпадают', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                contact: contact,
                newPassword: pass1
            })
        });
        const data = await response.json();

        if (data.success) {
            showNotification('Пароль успешно обновлён. Войдите с новым паролем.', 'success');
            closeConfirmCodeModal();
            closeModal('resetPasswordModal');
            openLoginModal();
        } else {
            showNotification(data.message || 'Ошибка при смене пароля', 'error');
        }
    } catch (error) {
        console.error('Ошибка сброса пароля:', error);
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Функции для работы с модальными окнами восстановления пароля
function openForgotPasswordModal() {
closeLoginModal();
document.getElementById('forgotPasswordModal').classList.add('active');
document.body.style.overflow = 'hidden';
}

function closeForgotPasswordModal() {
document.getElementById('forgotPasswordModal').classList.remove('active');
document.body.style.overflow = 'auto';
openLoginModal();
}

function openConfirmCodeModal() {
document.getElementById('confirmCodeModal').classList.add('active');
document.body.style.overflow = 'hidden';
startTimer();
}

function closeConfirmCodeModal() {
document.getElementById('confirmCodeModal').classList.remove('active');
document.body.style.overflow = 'auto';
resetTimer();
}

function backToForgotPassword() {
closeConfirmCodeModal();
openForgotPasswordModal();
}

// Функция для отправки кода восстановления
function sendRecoveryCode() {
const contact = document.getElementById('recovery-contact').value;

if (!contact) {
    showNotification('Заполните поле с телефоном или email', 'warning');
    return;
}

// В демо всегда отправляем код 1234 и показываем уведомление
showNotification('Код восстановления: 1234', 'info');
closeForgotPasswordModal();
openConfirmCodeModal();
}

// Функция для перемещения между полями ввода кода
function moveToNext(currentIndex, event) {
const input = event.target;
const value = input.value;

if (value.length === 1 && currentIndex < 4) {
    document.getElementById(`sms-code-${currentIndex + 1}`).focus();
}

if (event.inputType === 'deleteContentBackward' && currentIndex > 1 && value.length === 0) {
    document.getElementById(`sms-code-${currentIndex - 1}`).focus();
}
}

// Таймер для повторной отправки кода
let timerInterval;
let timerSeconds = 59;

function startTimer() {
clearInterval(timerInterval);
timerSeconds = 59;

const resendCodeElement = document.getElementById('resend-code');
resendCodeElement.classList.add('disabled');

timerInterval = setInterval(() => {
    const timerElement = document.getElementById('sms-timer');
    timerElement.textContent = `Пожалуйста подождите... ${timerSeconds} сек`;

    if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        timerElement.textContent = 'Код не пришел?';
        resendCodeElement.classList.remove('disabled');
    }

    timerSeconds--;
}, 1000);
}

function resetTimer() {
clearInterval(timerInterval);
document.getElementById('sms-timer').textContent = 'Пожалуйста подождите... 59 сек';
document.getElementById('resend-code').classList.add('disabled');
}

// Функция для повторной отправки кода
function resendCode() {
const resendCodeElement = document.getElementById('resend-code');

if (resendCodeElement.classList.contains('disabled')) {
    return;
}

showNotification('Код восстановления: 1234', 'info');
startTimer();
}

// Функция для проверки введенного кода
function verifyCode() {
const code1 = document.getElementById('sms-code-1').value;
const code2 = document.getElementById('sms-code-2').value;
const code3 = document.getElementById('sms-code-3').value;
const code4 = document.getElementById('sms-code-4').value;

const fullCode = code1 + code2 + code3 + code4;

if (fullCode.length !== 4) {
    showNotification('Пожалуйста, введите полный код из 4 цифр', 'warning');
    return;
}

// Для демо используем "1234" как правильный код
if (fullCode === "1234") {
    // Показываем модалку ввода нового пароля (без prompt)
    const existing = document.getElementById('resetPasswordModal');
    if (existing) existing.remove();

    const modalHTML = `
        <div class="modal active" id="resetPasswordModal">
            <div class="auth-container" style="max-width: 420px;">
                <div class="auth-header">
                    <button class="close-auth-btn" onclick="closeModal('resetPasswordModal')">×</button>
                    <div class="auth-logo">Новый пароль</div>
                </div>
                <div class="auth-form-container">
                    <div class="order-form-group">
                        <label for="reset-new-pass">Новый пароль</label>
                        <input id="reset-new-pass" type="password" class="auth-input" placeholder="Минимум 6 символов">
                    </div>
                    <div class="order-form-group">
                        <label for="reset-new-pass-confirm">Повторите пароль</label>
                        <input id="reset-new-pass-confirm" type="password" class="auth-input" placeholder="Ещё раз">
                    </div>
                    <div class="forgot-password-buttons">
                        <button class="back-btn" onclick="closeModal('resetPasswordModal')">Отмена</button>
                        <button class="recovery-btn" onclick="confirmNewPassword()">Сохранить</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    showNotification('Код подтвержден, задайте новый пароль', 'success');
} else {
    showNotification('Неверный код подтверждения', 'error');
}
}

// Функции для отображения ошибок в формах авторизации/регистрации
function showError(inputId, message) {
const input = document.getElementById(inputId);
const errorElement = document.getElementById(inputId + '-error');

if (input && errorElement) {
    input.classList.add('error');
    errorElement.textContent = message;
    errorElement.classList.add('show');
    errorElement.style.display = 'block';
}
}

function clearError(inputId) {
const input = document.getElementById(inputId);
const errorElement = document.getElementById(inputId + '-error');

if (input && errorElement) {
    input.classList.remove('error');
    errorElement.textContent = '';
    errorElement.classList.remove('show');
    errorElement.style.display = 'none';
}
}

function clearAllErrors() {
const errorMessages = document.querySelectorAll('.error-message');
const inputs = document.querySelectorAll('.auth-input');

errorMessages.forEach(error => {
    error.textContent = '';
    error.classList.remove('show');
    error.style.display = 'none';
});

inputs.forEach(input => {
    input.classList.remove('error');
});
}

// Функции для отображения ошибок в форме заказа
function showOrderError(inputId, message) {
const input = document.getElementById(inputId);
const errorElement = document.getElementById(inputId + '-error');

if (input && errorElement) {
    input.classList.add('error');
    errorElement.textContent = message;
    errorElement.classList.add('show');
    errorElement.style.display = 'block';
}
}

function clearOrderError(inputId) {
const input = document.getElementById(inputId);
const errorElement = document.getElementById(inputId + '-error');

if (input && errorElement) {
    input.classList.remove('error');
    errorElement.textContent = '';
    errorElement.classList.remove('show');
    errorElement.style.display = 'none';
}
}

function clearAllOrderErrors() {
const errorMessages = document.querySelectorAll('.order-error-message');
const inputs = document.querySelectorAll('#orderForm input, #orderForm textarea, #orderForm select');

errorMessages.forEach(error => {
    error.textContent = '';
    error.classList.remove('show');
    error.style.display = 'none';
});

inputs.forEach(input => {
    input.classList.remove('error');
});
}

// Обработчики форм
async function handleLogin() {
const login = document.getElementById('auth-login').value;
const password = document.getElementById('auth-password').value;

clearAllErrors();

let hasError = false;

if (!login) {
    showError('auth-login', 'Заполните это поле');
    hasError = true;
}

if (!password) {
    showError('auth-password', 'Заполните это поле');
    hasError = true;
}

if (hasError) {
    return;
}

try {
    const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ login, password })
    });

    const data = await response.json();

    if (data.success) {
        currentUser = data.user;
    showNotification('Вход выполнен успешно!', 'success');
    closeLoginModal();
    loginUser();

    // Переход на запомненную страницу или профиль
    if (pendingPageAfterLogin) {
        showPage(pendingPageAfterLogin);
        pendingPageAfterLogin = null;
    } else {
        showPage('profile');
    }
} else {
        showError('auth-login', data.message || 'Ошибка входа');
        showNotification(data.message || 'Ошибка входа', 'error');
    }
} catch (error) {
    console.error('Ошибка входа:', error);
    showNotification('Ошибка соединения с сервером', 'error');
    }
}

async function handleRegister() {
const firstName = document.getElementById('reg-firstName').value;
const lastName = document.getElementById('reg-lastName').value;
const email = document.getElementById('reg-email').value;
const phone = document.getElementById('reg-phone').value;
const password = document.getElementById('reg-password').value;
const confirmPassword = document.getElementById('reg-confirmPassword').value;
const agreeTerms = document.getElementById('reg-agreeTerms').checked;

clearAllErrors();

let hasError = false;

if (!firstName) {
    showError('reg-firstName', 'Заполните это поле');
    hasError = true;
}

if (!lastName) {
    showError('reg-lastName', 'Заполните это поле');
    hasError = true;
}

if (!email) {
    showError('reg-email', 'Заполните это поле');
    hasError = true;
} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError('reg-email', 'Введите корректный email');
    hasError = true;
}

if (!phone) {
    showError('reg-phone', 'Заполните это поле');
    hasError = true;
}

if (!password) {
    showError('reg-password', 'Заполните это поле');
    hasError = true;
} else if (password.length < 6) {
    showError('reg-password', 'Пароль должен содержать не менее 6 символов');
    hasError = true;
}

if (!confirmPassword) {
    showError('reg-confirmPassword', 'Заполните это поле');
    hasError = true;
} else if (password !== confirmPassword) {
    showError('reg-confirmPassword', 'Пароли не совпадают');
    hasError = true;
}

if (!agreeTerms) {
    showNotification('Необходимо согласиться с условиями использования', 'warning');
    return;
}

if (hasError) {
    return;
}

// Этап 1: запрашиваем SMS-код (демо 1234), показываем модал ввода кода
tempRegistrationData = { firstName, lastName, email, phone, password };
showNotification('Код для регистрации: 1234', 'info');
openConfirmRegisterCodeModal();
}

// Функция для извлечения города из адреса
function extractCityFromAddress(address) {
if (!address) return '';

// Простой способ извлечь город (первое слово до запятой)
const parts = address.split(',');
if (parts.length > 0) {
    return parts[0].trim();
}

// Если нет запятых, берем первое слово
const words = address.trim().split(' ');
return words[0] || '';
}

// Функция расчета расстояния между адресами
function calculateDistanceBetweenAddresses(address1, address2) {
const city1 = extractCityFromAddress(address1);
const city2 = extractCityFromAddress(address2);

return calculateDistance(city1, city2);
}

// Функция расчета цены с учетом расстояния и страховки 1%
function calculateOrderPrice(orderData, distance) {
// Базовые тарифы
const BASE_PRICE = 1000; // Базовая стоимость заказа
const PRICE_PER_KM = 45; // Стоимость за километр
const PRICE_PER_KG = 80; // Стоимость за килограмм
const PRICE_PER_M3 = 400; // Стоимость за кубический метр

// Коэффициенты для типов груза
const cargoTypeMultiplier = {
    'general': 1.0,
    'fragile': 1.3,
    'dangerous': 1.5,
    'perishable': 1.4
};

// Рассчитываем компоненты стоимости
const distanceCost = distance * PRICE_PER_KM;
const weightCost = orderData.cargoWeight * PRICE_PER_KG;
const volumeCost = orderData.cargoVolume * PRICE_PER_M3;

// Рассчитываем стоимость доставки
let deliveryCost = BASE_PRICE + distanceCost + weightCost + volumeCost;

// Применяем коэффициент типа груза
const multiplier = cargoTypeMultiplier[orderData.cargoType] || 1.0;
deliveryCost *= multiplier;

// Дополнительные услуги
let additionalCost = 0;
if (orderData.packaging) {
    additionalCost += 2000; // Упаковка
}

// Страховка - 1% от стоимости доставки
if (orderData.insurance) {
    const insuranceCost = deliveryCost * 0.01;
    additionalCost += insuranceCost;
}

// Итоговая стоимость
const totalPrice = Math.round(deliveryCost + additionalCost);

return totalPrice;
}

// функция c проверкой валидации в "Заказать перевозку"
async function handleOrderSubmit(event) {
event.preventDefault();

clearAllOrderErrors();

const senderName = document.getElementById('sender-name').value;
const senderPhone = document.getElementById('sender-phone').value;
const senderEmail = document.getElementById('sender-email').value;
const cargoDescription = document.getElementById('cargo-description').value;
const productCategory = document.getElementById('product-category').value;
const cargoWeight = document.getElementById('cargo-weight').value;
const cargoVolume = document.getElementById('cargo-volume').value;
const cargoType = document.getElementById('cargo-type').value;
const shippingDate = document.getElementById('shipping-date').value;
const pickupAddress = document.getElementById('pickup-address').value;
const deliveryAddress = document.getElementById('delivery-address').value;
const insurance = document.getElementById('insurance').checked;
const packaging = document.getElementById('packaging').checked;

let hasError = false;

// Валидация полей
if (!senderName) {
    showOrderError('sender-name', 'Заполните это поле');
    hasError = true;
}

if (!senderPhone) {
    showOrderError('sender-phone', 'Заполните это поле');
    hasError = true;
}

if (!cargoDescription) {
    showOrderError('cargo-description', 'Заполните это поле');
    hasError = true;
}

if (!productCategory) {
    showOrderError('product-category', 'Выберите категорию товара');
    hasError = true;
}

if (!cargoWeight || parseFloat(cargoWeight) <= 0) {
    showOrderError('cargo-weight', 'Введите корректный вес');
    hasError = true;
}

if (!cargoVolume || parseFloat(cargoVolume) <= 0) {
    showOrderError('cargo-volume', 'Введите корректный объем');
    hasError = true;
}

if (!cargoType) {
    showOrderError('cargo-type', 'Выберите тип груза');
    hasError = true;
}

if (!shippingDate) {
    showOrderError('shipping-date', 'Выберите дату отправки');
    hasError = true;
}

if (!pickupAddress) {
    showOrderError('pickup-address', 'Заполните это поле');
    hasError = true;
}

if (!deliveryAddress) {
    showOrderError('delivery-address', 'Заполните это поле');
    hasError = true;
}

if (hasError) {
    showNotification('Пожалуйста, заполните все обязательные поля корректно', 'warning');
    return false;
}

try {
    // Расчет расстояния
    const distance = calculateDistanceBetweenAddresses(pickupAddress, deliveryAddress);

    const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
        senderName,
        senderPhone,
        senderEmail,
        cargoDescription,
        productCategory,
        cargoWeight: parseFloat(cargoWeight),
        cargoVolume: parseFloat(cargoVolume),
        cargoType,
        shippingDate,
        pickupAddress,
        deliveryAddress,
            distance,
        insurance,
        packaging
        })
    });

    const data = await response.json();

    if (data.success) {
        // Перезагружаем заказы
        await loadOrders();

    // Показываем уведомление с информацией о цене и расстоянии
    let notificationMessage = `Заказ успешно оформлен!`;
        notificationMessage += `<br>Расстояние: ${data.order.distance} км`;
        notificationMessage += `<br>Стоимость доставки: ${data.order.price} ₽`;

    if (insurance) {
        notificationMessage += '<br>Включена страховка: 1% от стоимости доставки';
    }

    const notification = showNotification(notificationMessage, 'success', 8000);
    const contentDiv = notification.querySelector('.notification-content');
    contentDiv.innerHTML = notificationMessage;

    // Сбрасываем форму
    document.getElementById('orderForm').reset();

    // Если пользователь авторизован, показываем профиль
    if (currentUser) {
        showPage('profile');
        showProfileTab('orders');
        updateProfileOrderStats();
    } else {
        showPage('main');
        }
    } else {
        showNotification(data.message || 'Ошибка при оформлении заказа', 'error');
    }
} catch (error) {
    console.error('Ошибка создания заказа:', error);
    showNotification('Ошибка соединения с сервером', 'error');
}

return false;
}

// Функции для страницы "Мои заказы" в профиле
function toggleOrdersVisibility(hasOrders) {
const ordersTable = document.getElementById('profile-orders-table');
const noOrdersMessage = document.getElementById('profile-no-orders-message');

if (hasOrders) {
    if (ordersTable) ordersTable.style.display = 'block';
    if (noOrdersMessage) noOrdersMessage.style.display = 'none';
} else {
    if (ordersTable) ordersTable.style.display = 'none';
    if (noOrdersMessage) noOrdersMessage.style.display = 'block';
}
}

function viewOrder(orderId) {
const order = orders.find(o => o.id === orderId);
if (!order) return;

const user = users.find(u => u.id === order.userId);
const driver = order.driverId ? drivers.find(d => d.userId === order.driverId) : null;
const driverUser = driver ? users.find(u => u.id === driver.userId) : null;

let modalHTML = `
    <div class="modal active" id="orderDetailsModal">
        <div class="auth-container order-details-modal">
            <div class="auth-header">
                <button class="close-auth-btn" onclick="closeModal('orderDetailsModal')">×</button>
                <div class="auth-logo">Заказ #${orderId}</div>
            </div>

            <div class="auth-form-container">
                <div class="order-detail-item">
                    <div class="order-detail-label">Статус</div>
                    <div class="order-detail-value">
                        <span class="status-badge status-${order.status}">${getStatusText(order.status)}</span>
                    </div>
                </div>

                <div class="order-form-row">
                    <div class="order-detail-item">
                        <div class="order-detail-label">Клиент</div>
                        <div class="order-detail-value">${user ? `${user.firstName} ${user.lastName}` : 'Неизвестно'}</div>
                    </div>
                    <div class="order-detail-item">
                        <div class="order-detail-label">Телефон</div>
                        <div class="order-detail-value">${order.senderPhone}</div>
                    </div>
                </div>

                <div class="order-detail-item">
                    <div class="order-detail-label">Маршрут</div>
                    <div class="order-detail-value">
                        <div><strong>Откуда:</strong> ${order.pickupAddress}</div>
                        <div><strong>Куда:</strong> ${order.deliveryAddress}</div>
                        <div><strong>Расстояние:</strong> ${order.distance} км</div>
                    </div>
                </div>

                <div class="order-detail-item">
                    <div class="order-detail-label">Груз</div>
                    <div class="order-detail-value">
                        <div><strong>Описание:</strong> ${order.cargoDescription}</div>
                        <div><strong>Категория:</strong> ${getCategoryName(order.productCategory)}</div>
                        <div><strong>Тип:</strong> ${order.cargoType === 'general' ? 'Общий' : order.cargoType === 'fragile' ? 'Хрупкий' : order.cargoType === 'dangerous' ? 'Опасный' : 'Скоропортящийся'}</div>
                        <div><strong>Вес/Объем:</strong> ${order.cargoWeight} кг / ${order.cargoVolume} м³</div>
                    </div>
                </div>

                <div class="order-detail-item">
                    <div class="order-detail-label">Стоимость</div>
                    <div class="order-detail-value">
                        <div><strong>Общая:</strong> ${order.price} ₽</div>
                        ${order.cancellationFee ? `<div><strong>Штраф за отмену:</strong> ${order.cancellationFee} ₽</div>` : ''}
                        ${order.refundAmount ? `<div><strong>К возврату:</strong> ${order.refundAmount} ₽</div>` : ''}
                    </div>
                </div>

                ${driver ? `
                    <div class="order-detail-item">
                        <div class="order-detail-label">Водитель</div>
                        <div class="order-detail-value">
                            <div><strong>Имя Фамилия:</strong> ${driverUser ? `${driverUser.firstName} ${driverUser.lastName}` : 'Неизвестно'}</div>
                            <div><strong>Автомобиль:</strong> ${driver.carModel} (${driver.carNumber})</div>
                            <div><strong>Телефон:</strong> ${driverUser ? driverUser.phone : 'Неизвестно'}</div>
                        </div>
                    </div>
                ` : ''}

                ${order.comments ? `
                    <div class="order-detail-item">
                        <div class="order-detail-label">Комментарий клиента</div>
                        <div class="order-detail-value">${order.comments}</div>
                    </div>
                ` : ''}

                ${order.adminComment ? `
                    <div class="order-detail-item">
                        <div class="order-detail-label">Комментарий администратора</div>
                        <div class="order-detail-value">${order.adminComment}</div>
                    </div>
                ` : ''}

                <div class="forgot-password-buttons">
                    ${currentUser.isAdmin && order.status === 'new' ? `
                        <button class="recovery-btn" onclick="openOrderModal(${orderId}); closeModal('orderDetailsModal')">Обработать заказ</button>
                    ` : ''}

                    ${currentUser.isAdmin && order.status === 'confirmed' && !order.driverId ? `
                        <button class="recovery-btn" onclick="assignDriverModal(${orderId}); closeModal('orderDetailsModal')">Назначить водителя</button>
                    ` : ''}

                    ${order.userId === currentUser.id && order.clientStatus !== 'cancelled' && order.clientStatus !== 'delivered' && order.clientStatus !== 'rejected' ? `
                        <button class="back-btn" onclick="openCancelOrderModal(${orderId})">Отменить заказ</button>
                    ` : ''}

                    <button class="back-btn" onclick="closeModal('orderDetailsModal')">Закрыть</button>
                </div>
            </div>
        </div>
    </div>
`;

document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Закрытие модальных окон при клике вне их
document.addEventListener('click', function(event) {
const modals = ['loginModal', 'registerModal', 'forgotPasswordModal', 'confirmCodeModal', 'confirmRegisterCodeModal'];

modals.forEach(modalId => {
    const modal = document.getElementById(modalId);
    if (event.target === modal) {
        if (modalId === 'loginModal') closeLoginModal();
        if (modalId === 'registerModal') closeRegisterModal();
        if (modalId === 'forgotPasswordModal') closeForgotPasswordModal();
        if (modalId === 'confirmCodeModal') closeConfirmCodeModal();
        if (modalId === 'confirmRegisterCodeModal') closeConfirmRegisterCodeModal();
    }
});
});

//  Функции для водителей

// Принять заказ водителем
async function acceptOrder(orderId) {

try {
    const response = await fetch(`${API_BASE_URL}/driver/orders/${orderId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    });

    const data = await response.json();
    if (data.success) {
showNotification('Заказ успешно принят!', 'success');
        await loadOrders();
loadDriverActiveOrders();
updateDriverStats();
    } else {
        showNotification(data.message || 'Ошибка принятия заказа', 'error');
    }
} catch (error) {
    console.error('Ошибка принятия заказа:', error);
    showNotification('Ошибка соединения с сервером', 'error');
}
}

// Загрузка активных заказов водителя
async function loadDriverActiveOrders() {
if (!currentUser || !currentUser.isDriver) return;
    await loadOrders();
    const activeOrders = orders.filter(order => order.driverId === currentUser.id && (order.status === 'in_transit' || order.status === 'confirmed'));
const container = document.getElementById('driver-active-orders-list');
const noOrders = document.getElementById('driver-no-active-orders');
if (activeOrders.length === 0) {
    if (container) container.style.display = 'none';
    if (noOrders) noOrders.style.display = 'block';
    return;
}
if (container) container.style.display = 'block';
if (noOrders) noOrders.style.display = 'none';
    let html = `<div class="table-header">
        <div class="table-header-item">№</div>
        <div class="table-header-item">КЛИЕНТ</div>
        <div class="table-header-item">МАРШРУТ</div>
        <div class="table-header-item">ГРУЗ</div>
        <div class="table-header-item">СТАТУС</div>
        <div class="table-header-item">СТОИМОСТЬ</div>
        <div class="table-header-item">ДЕЙСТВИЯ</div></div>`;
    activeOrders.forEach((order) => {
        const clientName = order.senderName || 'Неизвестно';
        html += `<div class="order-row">
            <div class="order-cell" data-label="№">${order.id}</div>
            <div class="order-cell" data-label="Клиент">${clientName}</div>
            <div class="order-cell address-container" data-label="Маршрут"><span class="address-line">${order.pickupAddress || 'Не указан'}</span>
                <span class="address-line"> → ${order.deliveryAddress || 'Не указан'}</span></div>
            <div class="order-cell" data-label="Груз">${order.cargoDescription || 'Не указан'}</div>
            <div class="order-cell" data-label="Статус"><div class="order-status ${getStatusClass(order.status)}"><span class="status-icon">●</span><span>${getStatusText(order.status)}</span></div></div>
            <div class="order-cell" data-label="Стоимость">${order.price !== null && order.price !== undefined ? `${order.price} ₽` : 'Не указана'}</div>
            <div class="order-cell" data-label="Действия">${order.status === 'confirmed' ?
                `<button class="track-btn" onclick="markAsInTransit(${order.id})">Груз принят</button>` :
                `<button class="track-btn" onclick="markAsDelivered(${order.id})">Доставлено</button>`}</div>
            </div>`;
});
if (container) container.innerHTML = html;
}

// Отметить груз как принятый (статус В пути)
async function markAsInTransit(orderId) {
try {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            status: 'in_transit',
            clientStatus: 'in_transit'
        })
    });

    const data = await response.json();
    if (data.success) {
showNotification('Груз отмечен как принятый', 'success');
        await loadOrders();
loadDriverActiveOrders();
    } else {
        showNotification(data.message || 'Ошибка обновления статуса', 'error');
    }
} catch (error) {
    console.error('Ошибка обновления статуса:', error);
    showNotification('Ошибка соединения с сервером', 'error');
}
}

// Отметить заказ как доставленный
async function markAsDelivered(orderId) {
try {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            status: 'delivered',
            clientStatus: 'delivered'
        })
    });

    const data = await response.json();
    if (data.success) {
showNotification('Заказ отмечен как доставленный', 'success');
        await loadOrders();
        await loadDriversList(); // Перезагружаем список водителей для обновления статистики
loadDriverActiveOrders();
loadDriverHistory();
updateDriverStats();
    } else {
        showNotification(data.message || 'Ошибка обновления статуса', 'error');
    }
} catch (error) {
    console.error('Ошибка обновления статуса:', error);
    showNotification('Ошибка соединения с сервером', 'error');
}
}

// Загрузка истории доставок водителя
async function loadDriverHistory() {
if (!currentUser || !currentUser.isDriver) return;
    await loadOrders();
    const historyOrders = orders.filter(order => order.driverId === currentUser.id && order.status === 'delivered');
const container = document.getElementById('driver-history-list');
const noHistory = document.getElementById('driver-no-history');
if (historyOrders.length === 0) {
    if (container) container.style.display = 'none';
    if (noHistory) noHistory.style.display = 'block';
    return;
}
if (container) container.style.display = 'block';
if (noHistory) noHistory.style.display = 'none';
    let html = `<div class="table-header">
        <div class="table-header-item">№</div>
        <div class="table-header-item">КЛИЕНТ</div>
        <div class="table-header-item">МАРШРУТ</div>
        <div class="table-header-item">ДАТА ДОСТАВКИ</div>
        <div class="table-header-item">СТОИМОСТЬ</div></div>`;
    historyOrders.forEach((order) => {
        const clientName = order.senderName || 'Неизвестно';
        const deliveredDate = order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString() : 'Не указана';
        html += `<div class="order-row">
            <div class="order-cell" data-label="№">${order.id}</div>
            <div class="order-cell" data-label="Клиент">${clientName}</div>
            <div class="order-cell address-container" data-label="Маршрут"><span class="address-line">${order.pickupAddress || 'Не указан'}</span>
                <span class="address-line">→ ${order.deliveryAddress || 'Не указан'}</span></div>
            <div class="order-cell date-container" data-label="Дата доставки"><span class="date-day">${deliveredDate}</span></div>
            <div class="order-cell" data-label="Стоимость">${order.price !== null && order.price !== undefined ? `${order.price} ₽` : 'Не указана'}</div>
            </div>`;
});
if (container) container.innerHTML = html;
}

// Обновление статистики водителя
async function updateDriverStats() {
if (!currentUser || !currentUser.isDriver) return;

try {
    // Загружаем данные водителя
    const response = await fetch(`${API_BASE_URL}/driver/info`, { credentials: 'include' });
    const data = await response.json();

    let driver = null;
    if (data.success && data.driver) {
        driver = normalizeDriver(data.driver);
        // Обновляем локальный кэш
        const idx = drivers.findIndex(d => d.userId === currentUser.id);
        if (idx >= 0) {
            drivers[idx] = driver;
        } else {
            drivers.push(driver);
        }
    } else {
        // Если не нашли, ищем в кэше
        driver = drivers.find(d => d.userId === currentUser.id);
    }

if (!driver) return;

    // Заполняем данные статистики
    const totalDeliveriesEl = document.getElementById('driver-total-deliveries');
    const earningsEl = document.getElementById('driver-earnings');
    const avgTimeEl = document.getElementById('driver-avg-delivery-time');

    if (totalDeliveriesEl) totalDeliveriesEl.textContent = driver.completedDeliveries || 0;
    if (earningsEl) earningsEl.textContent = calculateDriverEarnings();
    if (avgTimeEl) avgTimeEl.textContent = '24';

// Данные автомобиля
    const carModelEl = document.getElementById('driver-car-model');
    const carNumberEl = document.getElementById('driver-car-number');
    const maxWeightEl = document.getElementById('driver-max-weight');
    const statusEl = document.getElementById('driver-status');

    if (carModelEl) carModelEl.value = driver.carModel || '';
    if (carNumberEl) carNumberEl.value = driver.carNumber || '';
    if (maxWeightEl) maxWeightEl.value = `${driver.maxWeight || 0} кг`;
    if (statusEl) statusEl.value = driver.workStatus === 'active' ? 'Активен' : 'Неактивен';
} catch (error) {
    console.error('Ошибка загрузки данных водителя:', error);
    // Пытаемся использовать кэш
    const driver = drivers.find(d => d.userId === currentUser.id);
    if (driver) {
        const totalDeliveriesEl = document.getElementById('driver-total-deliveries');
        const earningsEl = document.getElementById('driver-earnings');
        if (totalDeliveriesEl) totalDeliveriesEl.textContent = driver.completedDeliveries || 0;
        if (earningsEl) earningsEl.textContent = calculateDriverEarnings();
    }
}

// Добавляем переключатель статуса работы
if (currentUser.isDriver) {
    const driver = drivers.find(d => d.userId === currentUser.id);
    if (driver) {
        const statusSection = document.querySelector('#profile-driver-stats .profile-section:last-child');

        // Создаем или обновляем переключатель
        let statusToggle = statusSection.querySelector('#work-status-toggle');
        if (!statusToggle) {
            statusToggle = document.createElement('div');
            statusToggle.id = 'work-status-toggle';
            statusToggle.style.marginTop = '20px';
            statusToggle.innerHTML = `
                <h3>Статус работы</h3>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <button id="toggle-work-status" class="order-submit-btn"
                            style="background: ${driver.workStatus === 'active' ? '#28a745' : '#6c757d'};">
                        ${driver.workStatus === 'active' ? 'Активен' : 'Неактивен'}
                    </button>
                    <span style="color: #666; font-size: 14px;">
                        ${driver.workStatus === 'active'
                            ? 'Вы видите все доступные заказы и можете их принимать'
                            : 'Вы не видите новые заказы и не можете их принимать'}
                    </span>
                </div>
            `;
            statusSection.appendChild(statusToggle);

            // Назначаем обработчик
            document.getElementById('toggle-work-status').onclick = toggleWorkStatus;
        } else {
            const btn = statusToggle.querySelector('#toggle-work-status');
            btn.style.background = driver.workStatus === 'active' ? '#28a745' : '#6c757d';
            btn.textContent = driver.workStatus === 'active' ? 'Активен' : 'Неактивен';
            const span = statusToggle.querySelector('span');
            span.textContent = driver.workStatus === 'active'
                ? 'Вы видите все доступные заказы и можете их принимать'
                : 'Вы не видите новые заказы и не можете их принимать';
        }
    }
}

const statsSection = document.querySelector('#profile-driver-stats .profile-section:last-child');
if (statsSection && driver.status === 'active') {
    let resignButton = statsSection.querySelector('#resign-driver-btn');
    if (!resignButton) {
        resignButton = document.createElement('button');
        resignButton.id = 'resign-driver-btn';
        resignButton.className = 'order-submit-btn';
        resignButton.style.background = '#dc3545';
        resignButton.style.marginTop = '20px';
        resignButton.textContent = 'Уволиться';
        resignButton.onclick = resignDriver;
        statsSection.appendChild(resignButton);
    }
}
}

// Функция переключения статуса работы водителя
async function toggleWorkStatus() {

const driver = drivers.find(d => d.userId === currentUser.id);
if (!driver) {
    showNotification('Данные водителя не найдены', 'error');
    return;
}

const newStatus = driver.workStatus === 'active' ? 'inactive' : 'active';

try {
    const response = await fetch(`${API_BASE_URL}/driver/work-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ workStatus: newStatus })
    });

    const data = await response.json();
    if (data.success) {
        // Обновляем локальный кэш
        driver.workStatus = newStatus;

// Обновляем отображение
        await updateDriverStats();
        updateOrderButtonVisibility();

showNotification(`Статус работы изменен на "${newStatus === 'active' ? 'Активен' : 'Неактивен'}"`, 'success');

if (currentUser.isAdmin) {
    loadDriversList();
        }
    } else {
        showNotification(data.message || 'Ошибка изменения статуса', 'error');
    }
} catch (error) {
    console.error('Ошибка изменения статуса работы:', error);
    showNotification('Ошибка соединения с сервером', 'error');
}
}

// Расчет заработка водителя
function calculateDriverEarnings() {
if (!currentUser || !currentUser.isDriver) return 0;

const driverOrders = orders.filter(order =>
    order.driverId === currentUser.id &&
    order.status === 'delivered'
);

// Предположим, что водитель получает 70% от стоимости заказа
return driverOrders.reduce((sum, order) => sum + (order.price * 0.7), 0).toFixed(0);
}

// Функция для увольнения/деактивации водителя (самостоятельно)
function resignDriver() {

// Проверяем, есть ли активные заказы
const activeOrders = orders.filter(order =>
    order.driverId === currentUser.id &&
    (order.status === 'confirmed' || order.status === 'in_transit')
);

if (activeOrders.length > 0) {
    showNotification(`У вас есть ${activeOrders.length} активных заказа(ов). Завершите их или передайте другому водителю перед увольнением.`, 'error');
    return;
}

// Показываем модальное окно подтверждения
const modalHTML = `
    <div class="modal active" id="resignModal">
        <div class="auth-container" style="max-width: 500px;">
            <div class="auth-header">
                <button class="close-auth-btn" onclick="closeModal('resignModal')">×</button>
                <div class="auth-logo">Увольнение</div>
            </div>

            <div class="auth-form-container">
                <h3 style="margin-bottom: 15px; color: #333;">Вы уверены, что хотите уволиться?</h3>
                <p style="margin-bottom: 20px; color: #666;">Это действие:</p>
                <ul style="margin-bottom: 20px; padding-left: 20px; color: #666;">
                    <li>Сделает ваш профиль водителя неактивным</li>
                    <li>Вы больше не сможете принимать новые заказы</li>
                    <li>Ваша статистика будет сохранена</li>
                    <li>Вы сможете восстановить статус через администратора</li>
                </ul>

                <div class="order-form-group">
                    <label for="resign-reason">Причина ухода (необязательно)</label>
                    <textarea id="resign-reason" rows="3" placeholder="Укажите причину ухода..."></textarea>
                </div>

                <div class="forgot-password-buttons">
                    <button class="back-btn" onclick="closeModal('resignModal')">Отмена</button>
                    <button class="recovery-btn" style="background: #dc3545;" onclick="confirmResignation()">Подтвердить увольнение</button>
                </div>
            </div>
        </div>
    </div>
`;

document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Подтверждение увольнения
function confirmResignation() {
const reason = document.getElementById('resign-reason').value;

const driverIndex = drivers.findIndex(d => d.userId === currentUser.id);
if (driverIndex === -1) {
    showNotification('Ошибка: данные водителя не найдены', 'error');
    return;
}

// Деактивируем водителя
drivers[driverIndex].status = 'inactive';
drivers[driverIndex].inactiveSince = new Date().toISOString();
drivers[driverIndex].inactiveReason = 'resignation';
drivers[driverIndex].resignationReason = reason;

// Обновляем пользователя
const userIndex = users.findIndex(u => u.id === currentUser.id);
if (userIndex !== -1) {
    users[userIndex].isDriver = false; // Снимаем флаг водителя
}

// Обновляем текущего пользователя
currentUser.isDriver = false;

// Уведомляем администраторов
const admins = users.filter(u => u.isAdmin);
admins.forEach(admin => {
    createNotification(
        admin.id,
        'Водитель уволился',
        `Водитель ${currentUser.firstName} ${currentUser.lastName} уволился.${reason ? ` Причина: ${reason}` : ''}`,
        'warning'
    );
});

showNotification('Вы успешно уволились. Ваш профиль водителя деактивирован.', 'info');
closeModal('resignModal');

// Обновляем интерфейс
updateOrderButtonVisibility()
updateProfileNavigation();
showProfileTab('data');
updateDriverStats();

// Скрываем блок "Статус заявки" после увольнения
const applicationStatus = document.getElementById('driver-application-status');
if (applicationStatus) {
    applicationStatus.style.display = 'none';
}

showPage('profile');
}

// Функция для увольнения водителя администратором
async function dismissDriver(driverUserId) {

    // Проверяем, есть ли активные заказы у водителя
    await loadOrders(); // Загружаем свежие данные о заказах
const activeOrders = orders.filter(order =>
    order.driverId === driverUserId &&
    (order.status === 'confirmed' || order.status === 'in_transit')
);

if (activeOrders.length > 0) {
        // Показываем модальное окно для обработки активных заказов
        const driver = drivers.find(d => d.userId === driverUserId);
        const driverUser = users.find(u => u.id === driverUserId);

    const modalHTML = `
        <div class="modal active" id="dismissDriverModal">
            <div class="auth-container" style="max-width: 600px;">
                <div class="auth-header">
                    <button class="close-auth-btn" onclick="closeModal('dismissDriverModal')">×</button>
                    <div class="auth-logo">Увольнение водителя</div>
                </div>
                <div class="auth-form-container">
                        <h3 style="margin-bottom: 15px; color: #333;">
                            У водителя ${driverUser ? `${driverUser.firstName} ${driverUser.lastName}` : driverUserId} есть активные заказы:
                        </h3>
                    <div style="max-height: 200px; overflow-y: auto; margin-bottom: 20px;">
                        ${activeOrders.map(order => `
                            <div class="driver-card" style="margin-bottom: 10px;">
                                <div><strong>Заказ #${order.id}</strong></div>
                                <div>${order.pickupAddress} → ${order.deliveryAddress}</div>
                                <div>Статус: ${getStatusText(order.status)}</div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="order-form-group">
                        <label for="dismiss-action">Действие с заказами:</label>
                        <select id="dismiss-action">
                            <option value="reassign">Переназначить другому водителю</option>
                            <option value="cancel">Отменить заказы (с возвратом средств)</option>
                            <option value="keep">Оставить текущему водителю (он завершит их)</option>
                        </select>
                    </div>
                    <div class="order-form-group">
                        <label for="dismiss-reason">Причина увольнения</label>
                            <textarea id="dismiss-reason" rows="3" placeholder="Укажите причину увольнения..." required></textarea>
                    </div>
                    <div class="forgot-password-buttons">
                        <button class="back-btn" onclick="closeModal('dismissDriverModal')">Отмена</button>
                            <button class="recovery-btn" style="background: #dc3545;"
                                    onclick="processDismissal(${driverUserId})">Уволить водителя</button>
                    </div>
                </div>
            </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } else {
        // Если активных заказов нет, показываем простую форму
        const modalHTML = `
            <div class="modal active" id="dismissDriverModal">
                <div class="auth-container" style="max-width: 500px;">
                    <div class="auth-header">
                        <button class="close-auth-btn" onclick="closeModal('dismissDriverModal')">×</button>
                        <div class="auth-logo">Увольнение водителя</div>
        </div>
                    <div class="auth-form-container">
                        <div class="order-form-group">
                            <label for="dismiss-reason-simple">Причина увольнения</label>
                            <textarea id="dismiss-reason-simple" rows="3" placeholder="Укажите причину увольнения..." required></textarea>
                        </div>
                        <div class="forgot-password-buttons">
                            <button class="back-btn" onclick="closeModal('dismissDriverModal')">Отмена</button>
                            <button class="recovery-btn" style="background: #dc3545;"
                                    onclick="processDismissalSimple(${driverUserId})">Уволить водителя</button>
                        </div>
                    </div>
                </div>
            </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
}

// Обработка увольнения администратором (с активными заказами)
async function processDismissal(driverUserId) {

    const reason = document.getElementById('dismiss-reason')?.value || '';
    const action = document.getElementById('dismiss-action')?.value || 'reassign';

    if (!reason.trim()) {
        showNotification('Пожалуйста, укажите причину увольнения', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/admin/drivers/${driverUserId}/dismiss`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ reason, action })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Водитель уволен', 'success');
            closeModal('dismissDriverModal');

            // Перезагружаем данные
            await loadDriversList();
            await loadAdminOrders();
        } else {
            showNotification(data.message || 'Ошибка увольнения водителя', 'error');
        }
    } catch (error) {
        console.error('Ошибка увольнения водителя:', error);
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Обработка увольнения администратором (без активных заказов)
async function processDismissalSimple(driverUserId) {

    const reason = document.getElementById('dismiss-reason-simple')?.value || '';

    if (!reason.trim()) {
        showNotification('Пожалуйста, укажите причину увольнения', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/admin/drivers/${driverUserId}/dismiss`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ reason, action: 'reassign' })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Водитель уволен', 'success');
            closeModal('dismissDriverModal');

            // Перезагружаем данные
            await loadDriversList();
            await loadAdminOrders();
        } else {
            showNotification(data.message || 'Ошибка увольнения водителя', 'error');
        }
    } catch (error) {
        console.error('Ошибка увольнения водителя:', error);
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Загрузка списка водителей (обновленная версия)
async function loadDriversList() {
    if (!currentUser || !currentUser.isAdmin) return;

    const container = document.getElementById('drivers-list-body');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/drivers`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            drivers = (data.drivers || []).map(normalizeDriver);
        } else {
            drivers = [];
            showNotification('Ошибка загрузки списка водителей', 'error');
        }
    } catch (error) {
        console.error('Ошибка загрузки водителей:', error);
        drivers = [];
        showNotification('Ошибка загрузки списка водителей', 'error');
    }

    let html = '';
    // ОТРИСОВКА ТОЛЬКО АКТИВНЫХ ВОДИТЕЛЕЙ (status == 'active')
    drivers
        .filter(driver => driver.status === 'active')
        .forEach((driver, index) => {
        const activeOrders = orders.filter(order =>
            order.driverId === driver.userId &&
            (order.status === 'confirmed' || order.status === 'in_transit')
        ).length;
        html += `
            <div class="order-row">
                <div class="order-cell" data-label="ID">${index + 1}</div>
                <div class="order-cell" data-label="Водитель">
                    ${driver.firstName || ''} ${driver.lastName || ''}
                </div>
                <div class="order-cell" data-label="Телефон">${driver.phone || ''}</div>
                <div class="order-cell" data-label="Автомобиль">
                    ${driver.carModel || ''} ${driver.carNumber ? `(${driver.carNumber})` : ''}
                </div>
                <div class="order-cell" data-label="Доставок">${driver.completedDeliveries || 0}</div>
                <div class="order-cell" data-label="Статус">
                    <span class="order-status ${driver.status === 'active' ? 'delivered' : 'cancelled'}">
                        ${driver.status === 'active' ? 'Активен' : 'Неактивен'}
                    </span>
                </div>
                <div class="order-cell date-container" data-label="Дата найма">
                    <span class="date-day">
                        ${driver.hireDate ? new Date(driver.hireDate).toLocaleDateString() : 'Не указана'}
                    </span>
                </div>
                <div class="order-cell" data-label="Действия">
                    <button class="track-btn" style="background:#dc3545; border-color:#dc3545;"
                            onclick="dismissDriver(${driver.userId})">Уволить</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// Функция восстановления водителя
async function restoreDriver(driverUserId) {

try {
    const response = await fetch(`${API_BASE_URL}/admin/drivers/${driverUserId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    });

    const data = await response.json();
    if (data.success) {
        showNotification('Водитель восстановлен', 'success');
loadDriversList();
        loadAdminOrders();
    } else {
        showNotification(data.message || 'Ошибка восстановления водителя', 'error');
    }
} catch (error) {
    console.error('Ошибка восстановления водителя:', error);
    showNotification('Ошибка соединения с сервером', 'error');
}
}

// Функция для отображения истории увольнений в профиле администратора
function showResignationHistory() {

const allRecords = [...resignations, ...dismissals]
    .sort((a, b) => new Date(b.dismissedAt || b.resignedAt) - new Date(a.dismissedAt || a.resignedAt));

let html = `
    <div class="profile-section">
        <h2>История увольнений водителей</h2>
        <div class="orders-table-container" style="display: block;">
            <div class="table-header">
                <div class="table-header-item">ВОДИТЕЛЬ</div>
                <div class="table-header-item">ТИП</div>
                <div class="table-header-item">ПРИЧИНА</div>
                <div class="table-header-item">ЗАКАЗОВ ЗАДЕТО</div>
                <div class="table-header-item">ДАТА</div>
                <div class="table-header-item">ДЕЙСТВИЯ</div>
            </div>
`;

allRecords.forEach(record => {
    const user = users.find(u => u.id === record.userId);
    const driver = drivers.find(d => d.userId === record.userId);
    const isDismissal = 'dismissedBy' in record;

    html += `
        <div class="order-row">
            <div class="order-cell" data-label="Водитель">
                ${user ? `${user.firstName} ${user.lastName}` : 'Неизвестно'}
            </div>
            <div class="order-cell" data-label="Тип">
                <span class="order-status ${isDismissal ? 'cancelled' : 'processing'}">
                    ${isDismissal ? 'Уволен' : 'Уволился'}
                </span>
            </div>
            <div class="order-cell" data-label="Причина">
                ${record.reason || 'Не указана'}
            </div>
            <div class="order-cell" data-label="Заказов задето">
                ${record.ordersAffected || 0}
            </div>
            <div class="order-cell date-container" data-label="Дата">
                <span class="date-day">${new Date(record.dismissedAt || record.resignedAt).toLocaleDateString()}</span>
            </div>
            <div class="order-cell" data-label="Действия">
                ${driver && driver.status === 'inactive' ?
                    `<button class="track-btn" onclick="restoreDriver(${record.userId})">Восстановить</button>` :
                    'Активен'
                }
            </div>
        </div>
    `;
});

html += `
        </div>
    </div>
`;

return html;
}

// ФУНКЦИИ ДЛЯ АДМИНИСТРАТОРА

// Загрузка заказов для администратора
async function loadAdminOrders() {
if (!currentUser || !currentUser.isAdmin) return;

const container = document.getElementById('admin-orders-body');
if (!container) return;

await loadOrders();

let html = '';

orders.forEach(order => {
    const statusText = getStatusText(order.status, true); // true = для администратора
    const statusClass = getStatusClass(order.status);

    html += `
        <div class="order-row">
            <div class="order-cell" data-label="Номер заказа">#${order.id}</div>
            <div class="order-cell" data-label="Клиент">${order.senderName || 'Неизвестно'}</div>
            <div class="order-cell" data-label="Телефон">${order.senderPhone || ''}</div>
            <div class="order-cell address-container" data-label="Маршрут">
                <span class="address-line">${order.pickupAddress || 'Не указан'}</span>
                <span class="address-line"> → ${order.deliveryAddress || 'Не указан'}</span>
            </div>
            <div class="order-cell" data-label="Груз">${order.cargoDescription || 'Не указан'}</div>
            <div class="order-cell" data-label="Статус">
                <div class="order-status ${statusClass}">
                    <span class="status-icon">●</span>
                    <span>${statusText}</span>
                </div>
            </div>
            <div class="order-cell" data-label="Водитель">${order.driverId ? `ID ${order.driverId}` : 'Не назначен'}</div>
            <div class="order-cell" data-label="Цена">${order.price || 'Не указана'} ₽</div>
            <div class="order-cell date-container" data-label="Дата">
                <span class="date-day">${order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''}</span>
            </div>
            <div class="order-cell" data-label="Действия">
                ${order.status === ORDER_STATUSES.ADMIN.NEW ? `
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <button class="track-btn" onclick="processOrderDecision(${order.id}, 'confirm')">Принять</button>
                        <button class="view-btn" onclick="processOrderDecision(${order.id}, 'reject')">Отклонить</button>
                    </div>
                ` : ''}
                ${!order.driverId && order.status === ORDER_STATUSES.ADMIN.CONFIRMED ?
                `<button class="track-btn" onclick="assignDriverModal(${order.id})">Назначить водителя</button>` : ''}
            </div>
        </div>
    `;
});

container.innerHTML = html;
updateAdminStats();
}

// Модальное окно обработки заказа администратором
function openOrderModal(orderId) {
const existingModal = document.getElementById('orderProcessingModal');
if (existingModal) {
    existingModal.remove();
}

const order = orders.find(o => o.id === orderId);
if (!order) return;

const user = users.find(u => u.id === order.userId);

const modalHTML = `
    <div class="modal active" id="orderProcessingModal">
        <div class="auth-container" style="max-width: 600px;">
            <div class="auth-header">
                <button class="close-auth-btn" onclick="closeModal('orderProcessingModal')">×</button>
                <div class="auth-logo">Обработка заказа #${orderId}</div>
            </div>

            <div class="auth-form-container">
                <h3>Детали заказа</h3>
                <div class="order-form-row">
                    <div class="order-form-group">
                        <label>Клиент:</label>
                        <input type="text" class="profile-field-readonly" value="${user ? `${user.firstName} ${user.lastName}` : 'Неизвестно'}" readonly>
                    </div>
                    <div class="order-form-group">
                        <label>Телефон:</label>
                        <input type="text" class="profile-field-readonly" value="${order.senderPhone}" readonly>
                    </div>
                </div>

                <div class="order-form-group">
                    <label>Маршрут:</label>
                    <input type="text" class="profile-field-readonly" value="${order.pickupAddress} → ${order.deliveryAddress}" readonly>
                </div>

                <div class="order-form-row">
                    <div class="order-form-group">
                        <label>Груз:</label>
                        <input type="text" class="profile-field-readonly" value="${order.cargoDescription}" readonly>
                    </div>
                    <div class="order-form-group">
                        <label>Вес/Объем:</label>
                        <input type="text" class="profile-field-readonly" value="${order.cargoWeight} кг / ${order.cargoVolume} м³" readonly>
                    </div>
                </div>

                <div class="order-form-row">
                    <div class="order-form-group">
                        <label>Стоимость:</label>
                        <input type="text" class="profile-field-readonly" value="${order.price} ₽" readonly>
                    </div>
                    <div class="order-form-group">
                        <label>Дата отправки:</label>
                        <input type="text" class="profile-field-readonly" value="${new Date(order.shippingDate).toLocaleDateString()}" readonly>
                    </div>
                </div>

                <h3>Решение по заказу</h3>
                <div class="order-form-group">
                    <label for="order-decision">Решение:</label>
                    <select id="order-decision">
                        <option value="confirm">Подтвердить заказ</option>
                        <option value="reject">Отклонить заказ</option>
                    </select>
                </div>

                <div class="order-form-group">
                    <label for="admin-comment">Комментарий для клиента:</label>
                    <textarea id="admin-comment" rows="3" placeholder="Введите комментарий для клиента..."></textarea>
                </div>

                <div class="forgot-password-buttons">
                    <button class="back-btn" onclick="closeModal('orderProcessingModal')">Отмена</button>
                    <button class="recovery-btn" onclick="processOrderDecision(${orderId})">Применить решение</button>
                </div>
            </div>
        </div>
    </div>
`;

document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Обработка решения администратора
async function processOrderDecision(orderId, directDecision = null) {
const decisionElement = document.getElementById('order-decision');
const commentElement = document.getElementById('admin-comment');

let decision = directDecision;
let comment = '';

if (!decision) {
if (!decisionElement || !commentElement) {
    showNotification('Ошибка: элементы формы не найдены', 'error');
    return;
}
    decision = decisionElement.value;
    comment = commentElement.value;
}

try {
    const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ decision, comment })
    });
    const data = await response.json();
    if (data.success) {
showNotification('Решение применено', 'success');
closeModal('orderProcessingModal');
        await loadOrders();
loadAdminOrders();
        if (decision === 'confirm') {
            assignDriverModal(orderId);
        }
    } else {
        showNotification(data.message || 'Ошибка при обработке заказа', 'error');
    }
} catch (error) {
    console.error('Ошибка решения заказа:', error);
    showNotification('Ошибка соединения с сервером', 'error');
}
}

// Модальное окно назначения водителя
async function assignDriverModal(orderId) {
// Загружаем список водителей если не загружен
if (drivers.length === 0) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/drivers`, { credentials: 'include' });
        const data = await response.json();
        if (data.success) {
            drivers = (data.drivers || []).map(normalizeDriver);
}
    } catch (error) {
        console.error('Ошибка загрузки водителей:', error);
    }
}

const activeDrivers = drivers.filter(d => d.status === 'active' && d.workStatus === 'active');

let driversHTML = '';
activeDrivers.forEach(driver => {
        driversHTML += `
            <div class="checkbox-group">
                <label>
                    <input type="radio" name="selectedDriver" value="${driver.userId}">
                ${driver.firstName || ''} ${driver.lastName || ''} - ${driver.carModel || ''} (${driver.carNumber || ''})
                    - Доставок: ${driver.completedDeliveries || 0}
                </label>
            </div>
        `;
});

const modalHTML = `
    <div class="modal active" id="assignDriverModal">
        <div class="auth-container" style="max-width: 500px;">
            <div class="auth-header">
                <button class="close-auth-btn" onclick="closeModal('assignDriverModal')">×</button>
                <div class="auth-logo">Назначение водителя</div>
            </div>

            <div class="auth-form-container">
                <p>Выберите водителя для заказа #${orderId}</p>

                <div id="drivers-list">
                    ${driversHTML || '<p>Нет доступных водителей</p>'}
                </div>

                <div class="forgot-password-buttons">
                    <button class="back-btn" onclick="closeModal('assignDriverModal')">Отмена</button>
                    <button class="recovery-btn" onclick="assignDriverToOrder(${orderId})">Назначить</button>
                </div>
            </div>
        </div>
    </div>
`;

document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Назначение водителя на заказ
async function assignDriverToOrder(orderId) {
const selectedDriver = document.querySelector('input[name="selectedDriver"]:checked');
if (!selectedDriver) {
    showNotification('Выберите водителя', 'warning');
    return;
}

const driverId = parseInt(selectedDriver.value);

try {
    const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ driverId })
    });
    const data = await response.json();
    if (data.success) {
        showNotification('Водитель назначен', 'success');
closeModal('assignDriverModal');
        await loadOrders();
loadAdminOrders();
    } else {
        showNotification(data.message || 'Ошибка назначения водителя', 'error');
    }
} catch (error) {
    console.error('Ошибка назначения водителя:', error);
    showNotification('Ошибка соединения с сервером', 'error');
}
}

// Загрузка заявок водителей
async function loadDriverApplications() {
if (!currentUser || !currentUser.isAdmin) return;

const container = document.getElementById('driver-applications-body');
if (!container) return;

try {
    const response = await fetch(`${API_BASE_URL}/admin/driver_applications`, { credentials: 'include' });
    const data = await response.json();
    if (data.success) {
        driverApplications = (data.applications || []).map(normalizeDriverApplication);
    } else {
        driverApplications = [];
    }
} catch (error) {
    console.error('Ошибка загрузки заявок водителей:', error);
    driverApplications = [];
}

let html = '';

driverApplications.forEach((app, index) => {
    const carTypeName = getCarTypeName(app.carType);

    html += `
        <div class="order-row">
            <div class="order-cell" data-label="ID">${index + 1}</div>
            <div class="order-cell" data-label="Имя Фамилия">${app.firstName || ''} ${app.lastName || ''}</div>
            <div class="order-cell" data-label="Телефон">${app.phone || ''}</div>
            <div class="order-cell" data-label="Вод. удост.">${app.licenseNumber || ''}</div>
            <div class="order-cell" data-label="Автомобиль">${app.carModel || ''} (${app.carNumber || ''})</div>
            <div class="order-cell" data-label="Тип кузова">${carTypeName || 'Не указано'}</div>
            <div class="order-cell" data-label="Опыт">${app.experience || 0} лет</div>
            <div class="order-cell" data-label="Статус">
                <span class="order-status ${app.status === 'pending' ? 'processing' : app.status === 'approved' ? 'delivered' : 'cancelled'}">
                    ${app.status === 'pending' ? 'На рассмотрении' : app.status === 'approved' ? 'Одобрена' : 'Отклонена'}
                </span>
            </div>
            <div class="order-cell date-container" data-label="Дата">
                <span class="date-day">${app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : ''}</span>
            </div>
            <div class="order-cell" data-label="Действия">
                ${app.status === 'pending' ? `
                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        <button class="track-btn" onclick="processApplication(${app.id}, 'approved')">Нанять</button>
                        <button class="view-btn" onclick="processApplication(${app.id}, 'rejected')">Отклонить</button>
                    </div>
                ` : 'Обработана'}
            </div>
        </div>
    `;
});

container.innerHTML = html;
}

// Обработка заявки водителя
async function processApplication(appId, decision) {
if (!currentUser || !currentUser.isAdmin) return;

try {
    const response = await fetch(`${API_BASE_URL}/admin/driver_application/${appId}/${decision === 'approved' ? 'approve' : 'reject'}`, {
        method: 'POST',
        credentials: 'include'
    });
    const data = await response.json();
    if (data.success) {
        showNotification(`Заявка ${decision === 'approved' ? 'одобрена' : 'отклонена'}`, 'success');
        await loadDriverApplications();
        await loadDriversList();
    } else {
        showNotification(data.message || 'Ошибка обработки заявки', 'error');
    }
} catch (error) {
    console.error('Ошибка обработки заявки:', error);
    showNotification('Ошибка соединения с сервером', 'error');
}
}

// Загрузка списка водителей
async function loadDriversList() {
if (!currentUser || !currentUser.isAdmin) return;

const container = document.getElementById('drivers-list-body');
if (!container) return;

try {
    const response = await fetch(`${API_BASE_URL}/admin/drivers`, { credentials: 'include' });
    const data = await response.json();
    if (data.success) {
        drivers = (data.drivers || []).map(normalizeDriver);
    } else {
        drivers = [];
    }
} catch (error) {
    console.error('Ошибка загрузки водителей:', error);
    drivers = [];
}

let html = '';

drivers.forEach((driver, index) => {
    const activeOrders = orders.filter(order =>
        order.driverId === driver.userId &&
        (order.status === 'confirmed' || order.status === 'in_transit')
    ).length;

    html += `
        <div class="order-row">
            <div class="order-cell" data-label="ID">${index + 1}</div>
            <div class="order-cell" data-label="Имя Фамилия">${driver.firstName || ''} ${driver.lastName || ''}</div>
            <div class="order-cell" data-label="Телефон">${driver.phone || ''}</div>
            <div class="order-cell" data-label="Автомобиль">${driver.carModel || ''} (${driver.carNumber || ''})</div>
            <div class="order-cell" data-label="Доставок">${driver.completedDeliveries || 0}</div>
            <div class="order-cell" data-label="Статус работы">
                <span class="order-status ${driver.workStatus === 'active' ? 'delivered' : 'cancelled'}">
                    ${driver.workStatus === 'active' ? 'Активен' : 'Неактивен'}
                </span>
            </div>
            <div class="order-cell date-container" data-label="Дата найма">
                <span class="date-day">${driver.hireDate ? new Date(driver.hireDate).toLocaleDateString() : ''}</span>
            </div>
            <div class="order-cell" data-label="Действия">
                <button class="track-btn" style="background:#dc3545; border-color:#dc3545;" onclick="dismissDriver(${driver.userId})">Уволить</button>
            </div>
        </div>
    `;
});

container.innerHTML = html;
}

// Функция загрузки истории увольнений
function loadDismissalHistory() {
if (!currentUser || !currentUser.isAdmin) return;

const container = document.getElementById('dismissal-history-body');
const noHistory = document.getElementById('no-dismissal-history');
if (!container) return;

// Объединяем все записи
const allRecords = [...dismissals, ...resignations]
    .sort((a, b) => new Date(b.dismissedAt || b.resignedAt) - new Date(a.dismissedAt || a.resignedAt));

if (allRecords.length === 0) {
    if (container) container.style.display = 'none';
    if (noHistory) noHistory.style.display = 'block';
    return;
}

let html = '';

allRecords.forEach((record, index) => {
    const user = users.find(u => u.id === record.userId);
    const driver = drivers.find(d => d.userId === record.userId);
    const isDismissal = 'dismissedBy' in record;

    html += `
        <div class="order-row">
            <div class="order-cell" data-label="Водитель">
                ${user ? `${user.firstName} ${user.lastName}` : 'Неизвестно'}
            </div>
            <div class="order-cell" data-label="Тип">
                <span class="order-status ${isDismissal ? 'cancelled' : 'processing'}">
                    ${isDismissal ? 'Уволен' : 'Уволился'}
                </span>
            </div>
            <div class="order-cell" data-label="Причина">
                ${record.reason || 'Не указана'}
            </div>
            <div class="order-cell" data-label="Заказов задето">
                ${record.ordersAffected || 0}
            </div>
            <div class="order-cell date-container" data-label="Дата">
                <span class="date-day">${new Date(record.dismissedAt || record.resignedAt).toLocaleDateString()}</span>
            </div>
            <div class="order-cell" data-label="Действия">
                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <button class="view-btn" onclick="viewDismissalDetails(${record.userId})">Подробнее</button>
                    ${driver && driver.status === 'inactive' && isDismissal ?
                        `<button class="track-btn" onclick="restoreDriver(${record.userId})">Восстановить</button>` :
                        ''
                    }
                </div>
            </div>
        </div>
    `;
});

container.innerHTML = html;
if (container) container.style.display = 'block';
if (noHistory) noHistory.style.display = 'none';
}

// Функция просмотра деталей увольнения
function viewDismissalDetails(userId) {
const user = users.find(u => u.id === userId);
const driver = drivers.find(d => d.userId === userId);

const dismissalRecord = dismissals.find(d => d.userId === userId);
const resignationRecord = resignations.find(r => r.userId === userId);
const record = dismissalRecord || resignationRecord;

if (!record) return;

const isDismissal = 'dismissedBy' in record;
const dismissedByUser = isDismissal ? users.find(u => u.id === record.dismissedBy) : null;

let modalHTML = `
    <div class="modal active" id="dismissalDetailsModal">
        <div class="auth-container" style="max-width: 600px;">
            <div class="auth-header">
                <button class="close-auth-btn" onclick="closeModal('dismissalDetailsModal')">×</button>
                <div class="auth-logo">Детали ${isDismissal ? 'увольнения' : 'ухода'}</div>
            </div>

            <div class="auth-form-container">
                <h3>Информация о водителе</h3>
                <div class="order-form-row">
                    <div class="order-form-group">
                        <label>Имя Фамилия:</label>
                        <input type="text" class="profile-field-readonly" value="${user ? `${user.firstName} ${user.lastName}` : 'Неизвестно'}" readonly>
                    </div>
                    <div class="order-form-group">
                        <label>Телефон:</label>
                        <input type="text" class="profile-field-readonly" value="${user ? user.phone : 'Неизвестно'}" readonly>
                    </div>
                </div>

                <div class="order-form-row">
                    <div class="order-form-group">
                        <label>Автомобиль:</label>
                        <input type="text" class="profile-field-readonly" value="${driver ? `${driver.carModel} (${driver.carNumber})` : 'Неизвестно'}" readonly>
                    </div>
                    <div class="order-form-group">
                        <label>Тип ${isDismissal ? 'увольнения' : 'ухода'}:</label>
                        <input type="text" class="profile-field-readonly" value="${isDismissal ? 'Уволен администратором' : 'Уволился самостоятельно'}" readonly>
                    </div>
                </div>

                <div class="order-form-group">
                    <label>Причина:</label>
                    <textarea class="profile-field-readonly" rows="3" readonly>${record.reason || 'Не указана'}</textarea>
                </div>

                <div class="order-form-row">
                    <div class="order-form-group">
                        <label>Дата:</label>
                        <input type="text" class="profile-field-readonly" value="${new Date(record.dismissedAt || record.resignedAt).toLocaleString()}" readonly>
                    </div>
                    ${isDismissal ? `
                        <div class="order-form-group">
                            <label>Уволил:</label>
                            <input type="text" class="profile-field-readonly" value="${dismissedByUser ? `${dismissedByUser.firstName} ${dismissedByUser.lastName}` : 'Неизвестно'}" readonly>
                        </div>
                    ` : ''}
                </div>

                ${record.ordersAffected ? `
                    <div class="order-form-group">
                        <label>Заказов задето:</label>
                        <input type="text" class="profile-field-readonly" value="${record.ordersAffected}" readonly>
                    </div>
                ` : ''}

                ${record.actionTaken ? `
                    <div class="order-form-group">
                        <label>Действие с заказами:</label>
                        <input type="text" class="profile-field-readonly" value="${getActionTakenText(record.actionTaken)}" readonly>
                    </div>
                ` : ''}

                <div class="forgot-password-buttons">
                    ${driver && driver.status === 'inactive' && isDismissal ?
                        `<button class="recovery-btn" onclick="restoreDriver(${userId}); closeModal('dismissalDetailsModal')">Восстановить водителя</button>` :
                        ''
                    }
                    <button class="back-btn" onclick="closeModal('dismissalDetailsModal')">Закрыть</button>
                </div>
            </div>
        </div>
    </div>
`;

document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Вспомогательная функция для текста действий
function getActionTakenText(action) {
const actions = {
    'reassign': 'Переназначены другому водителю',
    'cancel': 'Отменены с возвратом средств',
    'keep': 'Оставлены текущему водителю'
};
return actions[action] || action;
}
// Изменение статуса водителя
function toggleDriverStatus(userId) {
const driverIndex = drivers.findIndex(d => d.userId === userId);
if (driverIndex === -1) return;

drivers[driverIndex].status = drivers[driverIndex].status === 'active' ? 'inactive' : 'active';

// Отправляем уведомление водителю
createNotification(
    userId,
    'Изменение статуса',
    `Ваш статус изменен на "${drivers[driverIndex].status === 'active' ? 'Активен' : 'Неактивен'}".`,
    'info'
);

showNotification('Статус водителя изменен', 'success');
loadDriversList();
}

// Обновление статистики администратора
function updateAdminStats() {
// Статистика скрыта по требованиям — ничего не делаем
}

// Отправка заявки на роль водителя
async function submitDriverApplication(event) {
event.preventDefault();

try {
    const response = await fetch(`${API_BASE_URL}/driver/application`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
    licenseNumber: document.getElementById('driver-license').value,
    experience: parseInt(document.getElementById('driver-experience').value),
    carModel: document.getElementById('car-model').value,
    carNumber: document.getElementById('car-number').value,
    maxWeight: parseInt(document.getElementById('max-weight').value),
            carType: document.getElementById('car-type').value
        })
    });

    const data = await response.json();

    if (data.success) {
// Показываем статус заявки
document.getElementById('driver-application-status').style.display = 'block';
document.getElementById('application-status-content').innerHTML = `
    <div class="order-status processing">
        <span class="status-icon">●</span>
        <span>Заявка отправлена на рассмотрение</span>
    </div>
    <p style="margin-top: 10px;">Мы рассмотрим вашу заявку в течение 3 рабочих дней.</p>
`;

showNotification('Заявка успешно отправлена!', 'success');
return false;
    } else {
        showNotification(data.message || 'Ошибка при отправке заявки', 'error');
return false;
    }
} catch (error) {
    console.error('Ошибка отправки заявки:', error);
    showNotification('Ошибка соединения с сервером', 'error');
    return false;
}
}

// Создание уведомления
function createNotification(userId, title, message, type = 'info') {
const notification = {
    id: notifications.length + 1,
    userId: userId,
    title: title,
    message: message,
    type: type,
    read: false,
    createdAt: new Date().toISOString()
};

notifications.push(notification);

// Если это текущий пользователь, показываем уведомление
if (currentUser && currentUser.id === userId) {
    showNotification(`${title}: ${message}`, type);
}

return notification;
}

// Пометка уведомления как прочитанного
function markNotificationAsRead(notificationId) {
const notificationIndex = notifications.findIndex(n => n.id === notificationId);
if (notificationIndex !== -1) {
    notifications[notificationIndex].read = true;
}
}

// Закрытие модального окна
function closeModal(modalId) {
const modal = document.getElementById(modalId);
if (modal) {
    modal.classList.remove('active');
    setTimeout(() => {
        if (modal.parentElement) {
            modal.remove();
        }
    }, 300);
}
}

// Функции сброса фильтров
function resetDriverFilters() {
document.getElementById('driver-distance-filter').value = 'all';
document.getElementById('driver-weight-filter').value = 'all';
document.getElementById('driver-date-filter').value = 'all';
}

//
function showProfileTab(tabName) {
// Скрываем все вкладки
const tabs = document.querySelectorAll('.profile-tab');
tabs.forEach(tab => tab.style.display = 'none');

// Убираем активный класс у всех кнопок
const navButtons = document.querySelectorAll('.profile-nav-btn');
navButtons.forEach(btn => btn.classList.remove('active'));

// Добавляем активный класс нажатой кнопке
const activeBtn = document.querySelector(`.profile-nav-btn[onclick*="${tabName}"]`);
if (activeBtn) activeBtn.classList.add('active');

// Показываем выбранную вкладку
const tabElement = document.getElementById(`profile-${tabName}`);
if (tabElement) {
    tabElement.style.display = 'block';

    // Загружаем данные для вкладки
    switch(tabName) {
        case 'orders':
            loadUserOrders();
            break;
        case 'driver-active-orders':
            loadDriverActiveOrders();
            break;
        case 'driver-history':
            loadDriverHistory();
            break;
        case 'admin-orders':
            loadAdminOrders();
            break;
        case 'driver-applications':
            loadDriverApplications();
            break;
        case 'drivers-list':
            loadDriversList();
            break;
        case 'become-driver':
            checkDriverApplicationStatus();
            break;
    }
}
}

// Проверка статуса заявки водителя
function checkDriverApplicationStatus() {
if (!currentUser) return;

const existingApp = driverApplications.find(app => app.userId === currentUser.id);
const statusDiv = document.getElementById('driver-application-status');
const contentDiv = document.getElementById('application-status-content');

if (existingApp) {
    statusDiv.style.display = 'block';

    let statusHTML = '';
    if (existingApp.status === 'pending') {
        statusHTML = `
            <div class="order-status processing">
                <span class="status-icon">●</span>
                <span>Заявка на рассмотрении</span>
            </div>
            <p style="margin-top: 10px;">Дата подачи: ${new Date(existingApp.appliedAt).toLocaleDateString()}</p>
        `;
    } else if (existingApp.status === 'approved') {
        statusHTML = `
            <div class="order-status delivered">
                <span class="status-icon">●</span>
                <span>Заявка одобрена</span>
            </div>
            <p style="margin-top: 10px;">Поздравляем! Теперь вы водитель.</p>
        `;
    } else {
        statusHTML = `
            <div class="order-status cancelled">
                <span class="status-icon">●</span>
                <span>Заявка отклонена</span>
            </div>
            <p style="margin-top: 10px;">Дата обработки: ${new Date(existingApp.processedAt).toLocaleDateString()}</p>
        `;
    }

    contentDiv.innerHTML = statusHTML;
} else {
    statusDiv.style.display = 'none';
}
}

// Детали заказа
function openAdminOrderDetails(orderId) {
const order = orders.find(o => o.id === orderId);
if (!order) return;

const user = users.find(u => u.id === order.userId);
const driver = order.driverId ? drivers.find(d => d.userId === order.driverId) : null;
const driverUser = driver ? users.find(u => u.id === driver.userId) : null;

const adminStatus = order.status;
const clientStatus = order.clientStatus || order.status;
const adminStatusText = getStatusText(adminStatus, true);
const clientStatusText = getStatusText(clientStatus, false);

let modalHTML = `
    <div class="modal active" id="adminOrderDetailsModal">
        <div class="auth-container order-details-modal">
            <div class="auth-header">
                <button class="close-auth-btn" onclick="closeModal('adminOrderDetailsModal')">×</button>
                <div class="auth-logo">Заказ #${orderId}</div>
            </div>

            <div class="auth-form-container">
                <div class="order-form-row">
                    <div class="order-detail-item">
                        <div class="order-detail-label">Статус (админ)</div>
                        <div class="order-detail-value">
                            <span class="status-badge status-${adminStatus}">${adminStatusText}</span>
                        </div>
                    </div>
                    <div class="order-detail-item">
                        <div class="order-detail-label">Статус (клиент)</div>
                        <div class="order-detail-value">
                            <span class="status-badge status-${clientStatus}">${clientStatusText}</span>
                        </div>
                    </div>
                </div>

                <!-- Остальные детали заказа -->
                <div class="order-detail-item">
                    <div class="order-detail-label">Клиент</div>
                    <div class="order-detail-value">${user ? `${user.firstName} ${user.lastName}` : 'Неизвестно'}</div>
                </div>

                <div class="order-detail-item">
                    <div class="order-detail-label">Телефон</div>
                    <div class="order-detail-value">${order.senderPhone}</div>
                </div>

                <div class="order-detail-item">
                    <div class="order-detail-label">Маршрут</div>
                    <div class="order-detail-value">
                        <div><strong>Откуда:</strong> ${order.pickupAddress}</div>
                        <div><strong>Куда:</strong> ${order.deliveryAddress}</div>
                        <div><strong>Расстояние:</strong> ${order.distance || 'Не указано'} км</div>
                    </div>
                </div>

                <div class="order-detail-item">
                    <div class="order-detail-label">Груз</div>
                    <div class="order-detail-value">
                        <div><strong>Описание:</strong> ${order.cargoDescription}</div>
                        <div><strong>Категория:</strong> ${getCategoryName(order.productCategory)}</div>
                        <div><strong>Вес/Объем:</strong> ${order.cargoWeight} кг / ${order.cargoVolume} м³</div>
                        ${order.cargoType ? `<div><strong>Тип:</strong> ${getCargoTypeName(order.cargoType)}</div>` : ''}
                    </div>
                </div>

                <div class="order-detail-item">
                    <div class="order-detail-label">Стоимость</div>
                    <div class="order-detail-value">
                        <div><strong>Общая:</strong> ${order.price || 'Не указана'} ₽</div>
                        ${order.cancellationFee ? `<div><strong>Штраф за отмену:</strong> ${order.cancellationFee} ₽</div>` : ''}
                        ${order.refundAmount ? `<div><strong>К возврату:</strong> ${order.refundAmount} ₽</div>` : ''}
                    </div>
                </div>

                ${driverUser ? `
                    <div class="order-detail-item">
                        <div class="order-detail-label">Водитель</div>
                        <div class="order-detail-value">
                            <div><strong>Имя Фамилия:</strong> ${driverUser.firstName} ${driverUser.lastName}</div>
                            <div><strong>Автомобиль:</strong> ${driver.carModel} (${driver.carNumber})</div>
                            <div><strong>Телефон:</strong> ${driverUser.phone}</div>
                        </div>
                    </div>
                ` : ''}

                ${order.comments ? `
                    <div class="order-detail-item">
                        <div class="order-detail-label">Комментарий клиента</div>
                        <div class="order-detail-value">${order.comments}</div>
                    </div>
                ` : ''}

                ${order.adminComment ? `
                    <div class="order-detail-item">
                        <div class="order-detail-label">Комментарий администратора</div>
                        <div class="order-detail-value">${order.adminComment}</div>
                    </div>
                ` : ''}

                ${order.cancellationReason ? `
                    <div class="order-detail-item">
                        <div class="order-detail-label">Причина отмены</div>
                        <div class="order-detail-value">${order.cancellationReason}</div>
                    </div>
                ` : ''}

                <div class="forgot-password-buttons">
                    ${adminStatus === ORDER_STATUSES.ADMIN.NEW ? `
                        <button class="recovery-btn" onclick="openOrderModal(${orderId}); closeModal('adminOrderDetailsModal')">Обработать заказ</button>
                    ` : ''}

                    ${adminStatus === ORDER_STATUSES.ADMIN.CONFIRMED && !order.driverId ? `
                        <button class="recovery-btn" onclick="assignDriverModal(${orderId}); closeModal('adminOrderDetailsModal')">Назначить водителя</button>
                    ` : ''}

                    <button class="back-btn" onclick="closeModal('adminOrderDetailsModal')">Закрыть</button>
                </div>
            </div>
        </div>
    </div>
`;

document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function openCancelOrderModal(orderId) {
const order = orders.find(o => o.id === orderId);
if (!order) return;

const modalHTML = `
    <div class="modal active" id="cancelOrderModal">
        <div class="auth-container" style="max-width: 500px;">
            <div class="auth-header">
                <button class="close-auth-btn" onclick="closeModal('cancelOrderModal')">×</button>
                <div class="auth-logo">Отмена заказа #${orderId}</div>
            </div>

            <div class="auth-form-container">
                <p style="margin-bottom: 20px; color: #666;">Вы собираетесь отменить заказ. Пожалуйста, укажите причину отмены.</p>

                <div class="order-form-group">
                    <label for="cancelReason">Причина отмены:</label>
                    <select id="cancelReason" style="margin-bottom: 10px;">
                        <option value="">Выберите причину</option>
                        <option value="changed_plans">Изменились планы</option>
                        <option value="found_cheaper">Нашел более дешевый вариант</option>
                        <option value="no_longer_needed">Груз больше не нужен</option>
                        <option value="date_issue">Проблемы с датой отправки</option>
                        <option value="other">Другое</option>
                    </select>
                    <textarea id="cancelReasonDetails" rows="3" placeholder="Дополнительные детали (необязательно)"></textarea>
                </div>

                <div class="important-notice" style="margin: 20px 0;">
                    <p><strong>Внимание!</strong> При отмене заказа может быть удержана часть суммы в качестве штрафа.</p>
                </div>

                <div class="forgot-password-buttons">
                    <button class="back-btn" onclick="closeModal('cancelOrderModal')">Отмена</button>
                    <button class="recovery-btn" onclick="confirmCancelOrder(${orderId})" style="background: #dc3545;">Подтвердить отмену</button>
                </div>
            </div>
        </div>
    </div>
`;

document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Функция для подтверждения отмены заказа с фиксированным штрафом 10%
function confirmCancelOrder(orderId) {
// Находим заказ
const orderIndex = orders.findIndex(o => o.id === orderId);
if (orderIndex === -1) {
    showNotification('Заказ не найден', 'error');
    return;
}

const order = orders[orderIndex];

// Расчет штрафа за отмену - всегда 10%
const cancellationFee = order.price * 0.10; // Фиксированный штраф 10%
const cancellationReason = 'Отмена заказа (штраф 10%)';

// Обновляем статус заказа
orders[orderIndex].status = ORDER_STATUSES.ADMIN.CANCELLED_BY_CLIENT;
orders[orderIndex].clientStatus = ORDER_STATUSES.CLIENT.CANCELLED;
orders[orderIndex].cancelledAt = new Date().toISOString();
orders[orderIndex].cancellationReason = cancellationReason;
orders[orderIndex].cancellationFee = cancellationFee;
orders[orderIndex].refundAmount = order.price - cancellationFee;

// Уведомление администратора
const admins = users.filter(u => u.isAdmin);
admins.forEach(admin => {
    createNotification(
        admin.id,
        'Заказ отменен',
        `Заказ #${orderId} был отменен. Штраф 10%: ${cancellationFee.toFixed(2)} ₽.`,
        'warning'
    );
});

// Уведомление клиента
createNotification(
    order.userId,
    'Заказ отменен',
    `Ваш заказ #${orderId} был отменен. Удержан штраф 10%: ${cancellationFee.toFixed(2)} ₽. К возврату: ${orders[orderIndex].refundAmount.toFixed(2)} ₽.`,
    'warning'
);

// Обновляем интерфейс
loadAdminOrders();
if (currentUser && (currentUser.id === order.userId || currentUser.isDriver)) {
    updateProfileOrderStats();
}
if (currentUser && currentUser.id === order.userId) {
    updateProfileOrderStats();
    // Также нужно обновить список заказов на странице профиля
    if (document.getElementById('profile-orders').style.display !== 'none') {
        // Если клиент находится на вкладке "Мои заказы"
        const userOrders = orders.filter(o => o.userId === currentUser.id);
        displayUserOrders(userOrders);
        toggleOrdersVisibility(userOrders.length > 0);
    }
}

// Закрываем модальное окно, если оно открыто
closeModal('cancelOrderModal');

// Также закрываем модальное окно деталей заказа, если оно открыто
const detailsModal = document.getElementById('orderDetailsModal');
if (detailsModal) {
    closeModal('orderDetailsModal');
}

return orders[orderIndex];
}

function openDriverDetailsModal(driverUserId) {
const driver = drivers.find(d => d.userId === driverUserId);
const driverUser = users.find(u => u.id === driverUserId);
const application = driverApplications.find(app => app.userId === driverUserId);

if (!driver || !driverUser) return;

const modalHTML = `
    <div class="modal active" id="driverDetailsModal">
        <div class="auth-container" style="max-width: 700px;">
            <div class="auth-header">
                <button class="close-auth-btn" onclick="closeModal('driverDetailsModal')">×</button>
                <div class="auth-logo">Информация о водителе</div>
            </div>

            <div class="auth-form-container">
                <h3>Личные данные</h3>
                <div class="order-form-row">
                    <div class="order-detail-item">
                        <div class="order-detail-label">Имя Фамилия</div>
                        <div class="order-detail-value">${driverUser.firstName} ${driverUser.lastName}</div>
                    </div>
                    <div class="order-detail-item">
                        <div class="order-detail-label">Статус</div>
                        <div class="order-detail-value">
                            <span class="status-badge ${driver.status === 'active' ? 'status-delivered' : 'status-cancelled'}">
                                ${driver.status === 'active' ? 'Активен' : 'Неактивен'}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="order-form-row">
                    <div class="order-detail-item">
                        <div class="order-detail-label">Телефон</div>
                        <div class="order-detail-value">${driverUser.phone}</div>
                    </div>
                    <div class="order-detail-item">
                        <div class="order-detail-label">Email</div>
                        <div class="order-detail-value">${driverUser.email}</div>
                    </div>
                </div>

                <h3>Данные из заявки</h3>
                ${application ? `
                    <div class="order-form-row">
                        <div class="order-detail-item">
                            <div class="order-detail-label">Водительское удостоверение</div>
                            <div class="order-detail-value">${application.licenseNumber || 'Не указано'}</div>
                        </div>
                        <div class="order-detail-item">
                            <div class="order-detail-label">Опыт вождения</div>
                            <div class="order-detail-value">${application.experience || 'Не указано'} лет</div>
                        </div>
                    </div>

                    <div class="order-form-row">
                        <div class="order-detail-item">
                            <div class="order-detail-label">Дата подачи заявки</div>
                            <div class="order-detail-value">${new Date(application.appliedAt).toLocaleDateString('ru-RU')}</div>
                        </div>
                        <div class="order-detail-item">
                            <div class="order-detail-label">Статус заявки</div>
                            <div class="order-detail-value">
                                <span class="status-badge ${application.status === 'approved' ? 'status-delivered' :
                                                            application.status === 'rejected' ? 'status-cancelled' : 'status-new'}">
                                    ${application.status === 'approved' ? 'Одобрена' :
                                    application.status === 'rejected' ? 'Отклонена' : 'На рассмотрении'}
                                </span>
                            </div>
                        </div>
                    </div>

                    ${application.additionalInfo ? `
                        <div class="order-detail-item">
                            <div class="order-detail-label">Дополнительная информация</div>
                            <div class="order-detail-value">${application.additionalInfo}</div>
                        </div>
                    ` : ''}
                ` : '<p class="order-detail-value">Заявка не найдена</p>'}

                <h3>Автомобиль</h3>
                <div class="order-form-row">
                    <div class="order-detail-item">
                        <div class="order-detail-label">Модель</div>
                        <div class="order-detail-value">${driver.carModel || 'Не указано'}</div>
                    </div>
                    <div class="order-detail-item">
                        <div class="order-detail-label">Госномер</div>
                        <div class="order-detail-value">${driver.carNumber || 'Не указано'}</div>
                    </div>
                </div>

                <div class="order-form-row">
                    <div class="order-detail-item">
                        <div class="order-detail-label">Тип кузова</div>
                        <div class="order-detail-value">${getCarTypeName(driver.carType) || 'Не указано'}</div>
                    </div>
                    <div class="order-detail-item">
                        <div class="order-detail-label">Грузоподъемность</div>
                        <div class="order-detail-value">${driver.maxWeight || 'Не указано'} кг</div>
                    </div>
                </div>

                <h3>Статистика</h3>
                <div class="order-form-row">
                    <div class="order-detail-item">
                        <div class="order-detail-label">Всего доставок</div>
                        <div class="order-detail-value">${driver.completedDeliveries || 0}</div>
                    </div>
                </div>

                <div class="order-form-row">
                    <div class="order-detail-item">
                        <div class="order-detail-label">Доход</div>
                        <div class="order-detail-value">${calculateDriverEarnings(driverUserId)} ₽</div>
                    </div>
                    <div class="order-detail-item">
                        <div class="order-detail-label">Активных заказов</div>
                        <div class="order-detail-value">
                            ${orders.filter(o => o.driverId === driverUserId &&
                                (o.status === 'confirmed' || o.status === 'in_transit')).length}
                        </div>
                    </div>
                </div>

                <div class="forgot-password-buttons" style="margin-top: 20px;">
                    ${driver.status === 'active' ? `
                        <button class="recovery-btn" style="background: #dc3545;" onclick="dismissDriver(${driverUserId})">Уволить</button>
                    ` : `
                        <button class="recovery-btn" onclick="restoreDriver(${driverUserId})">Восстановить</button>
                    `}
                    <button class="back-btn" onclick="closeModal('driverDetailsModal')">Закрыть</button>
                </div>
            </div>
        </div>
    </div>
`;

document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function changeOrderStatus(orderId, newStatus) {
const orderIndex = orders.findIndex(o => o.id === orderId);
if (orderIndex === -1) return;

orders[orderIndex].status = newStatus;
orders[orderIndex].statusUpdatedAt = new Date().toISOString();

showNotification('Статус заказа обновлен', 'success');
loadAdminOrders(); // Перезагружаем таблицу
}

function renderDriverStatusDropdown(driverUserId, currentStatus) {
return `
    <div style="display: flex; flex-direction: column; gap: 5px;">
        <select class="status-dropdown" onchange="changeDriverStatus(${driverUserId}, this.value)"
                style="padding: 4px 8px; border-radius: 4px; border: 1px solid #ddd; font-size: 12px;
                    background-color: ${currentStatus === 'active' ? '#d4edda' : '#f8d7da'};">
            <option value="active" ${currentStatus === 'active' ? 'selected' : ''}>Активен</option>
            <option value="inactive" ${currentStatus === 'inactive' ? 'selected' : ''}>Неактивен</option>
            <option value="pending" ${currentStatus === 'pending' ? 'selected' : ''}>На проверке</option>
        </select>

        ${currentStatus === 'active' ?
            `<button class="track-btn" style="padding: 3px 8px; font-size: 11px;"
                    onclick="dismissDriver(${driverUserId})">Уволить</button>` :
            `<button class="recovery-btn" style="padding: 3px 8px; font-size: 11px; background: #28a745;"
                    onclick="restoreDriver(${driverUserId})">Восстановить</button>`
        }
    </div>
`;
}

async function loadUserOrders() {
if (!currentUser) return;

try {
    await loadOrders();
const userOrders = orders.filter(order => order.userId === currentUser.id);

// Обновляем статистику
updateProfileOrderStats(userOrders);

// Показываем или скрываем таблицу
if (userOrders.length > 0) {
    displayUserOrders(userOrders);
        const ordersTable = document.getElementById('profile-orders-table');
        const noOrdersMsg = document.getElementById('profile-no-orders-message');
        if (ordersTable) ordersTable.style.display = 'block';
        if (noOrdersMsg) noOrdersMsg.style.display = 'none';
} else {
        const ordersTable = document.getElementById('profile-orders-table');
        const noOrdersMsg = document.getElementById('profile-no-orders-message');
        if (ordersTable) ordersTable.style.display = 'none';
        if (noOrdersMsg) noOrdersMsg.style.display = 'block';
    }
} catch (error) {
    console.error('Ошибка загрузки заказов:', error);
}
}

// Функция обновления статистики заказов
function updateProfileOrderStats(userOrders = null) {
if (!currentUser) return;

const ordersToCount = userOrders || orders.filter(order => order.userId === currentUser.id);

const totalEl = document.getElementById('profile-total-orders-count');
const processingEl = document.getElementById('profile-processing-orders-count');
const transitEl = document.getElementById('profile-in-transit-orders-count');
const deliveredEl = document.getElementById('profile-delivered-orders-count');

if (totalEl) totalEl.textContent = ordersToCount.length;
if (processingEl) processingEl.textContent =
    ordersToCount.filter(order => {
        const cs = order.clientStatus || order.status;
        return cs === 'processing' || cs === 'new';
    }).length;
if (transitEl) transitEl.textContent =
    ordersToCount.filter(order => {
        const cs = order.clientStatus || order.status;
        return cs === 'in_transit';
    }).length;
if (deliveredEl) deliveredEl.textContent =
    ordersToCount.filter(order => {
        const cs = order.clientStatus || order.status;
        return cs === 'delivered';
    }).length;
}

// Инициализация
document.addEventListener('DOMContentLoaded', async function() {
// Установить сегодняшнюю дату в поле даты отправки
const today = new Date().toISOString().split('T')[0];
const shippingDate = document.getElementById('shipping-date');
if (shippingDate) {
    shippingDate.min = today;
}

// Загружаем текущего пользователя из API
currentUser = await loadCurrentUser();

// Проверяем авторизацию при загрузке
if (currentUser) {
    loginUser();
    // Загружаем заказы
    await loadOrders();
} else {
    // Обновляем видимость кнопки для неавторизованных пользователей
    updateOrderButtonVisibility();
}

// По умолчанию показываем сообщение об отсутствии заказов
toggleOrdersVisibility(false);

// Загружаем данные для администратора
if (currentUser && currentUser.isAdmin) {
    loadAdminOrders();
    loadDriverApplications();
    loadDriversList();
}

// Скрываем неиспользуемые вкладки/блоки статистики и увольнений
const adminStats = document.getElementById('profile-admin-stats');
const driverStats = document.getElementById('profile-driver-stats');
const resignationHistory = document.getElementById('profile-resignation-history');
if (adminStats) adminStats.style.display = 'none';
if (driverStats) driverStats.style.display = 'none';
if (resignationHistory) resignationHistory.style.display = 'none';

// Дополнительно скрываем возможные блоки статистики пользователей/водителей
const extraStatsSelectors = ['#profile-stats', '.profile-stats-section', '.user-stats-block'];
extraStatsSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => el.style.display = 'none');
});
})

// Функция для автоматического заполнения формы заказа данными пользователя
function fillOrderFormWithUserData() {
if (!currentUser) return;

// Заполняем имя (имя + фамилия)
const nameInput = document.getElementById('sender-name');
if (nameInput && currentUser.firstName && currentUser.lastName) {
    nameInput.value = `${currentUser.firstName} ${currentUser.lastName}`;
} else if (nameInput && currentUser.firstName) {
    nameInput.value = currentUser.firstName;
} else if (nameInput && currentUser.lastName) {
    nameInput.value = currentUser.lastName;
}

// Заполняем телефон
const phoneInput = document.getElementById('sender-phone');
if (phoneInput && currentUser.phone) {
    phoneInput.value = currentUser.phone;
}

// Заполняем email
const emailInput = document.getElementById('sender-email');
if (emailInput && currentUser.email) {
    emailInput.value = currentUser.email;
}
}