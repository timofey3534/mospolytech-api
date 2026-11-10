const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 8085;

// Load dishes catalog
const dishesPath = path.join(__dirname, 'dishes.json');
let dishes = [];
try {
    dishes = JSON.parse(fs.readFileSync(dishesPath, 'utf8'));
    console.log(`Loaded ${dishes.length} dishes from dishes.json`);
} catch (e) {
    console.error('Error loading dishes.json:', e);
}

// Persistent orders storage
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
const ordersFilePath = path.join(dataDir, 'orders.json');
let orders = [];

function loadOrdersFromDisk() {
    try {
        if (fs.existsSync(ordersFilePath)) {
            const content = fs.readFileSync(ordersFilePath, 'utf8');
            orders = JSON.parse(content);
            console.log(`Loaded ${orders.length} orders from ${ordersFilePath}`);
        } else {
            orders = [];
            saveOrdersToDisk();
        }
    } catch (err) {
        console.error('Failed to read orders file:', err);
        orders = [];
    }
}

function saveOrdersToDisk() {
    try {
        fs.writeFileSync(ordersFilePath, JSON.stringify(orders, null, 2), 'utf8');
    } catch (err) {
        console.error('Failed to write orders file:', err);
    }
}

loadOrdersFromDisk();

function getNextOrderId() {
    if (orders.length === 0) {
        return 1;
    }
    const maxId = orders.reduce((max, o) => (o.id > max ? o.id : max), 0);
    return maxId + 1;
}

// CORS & Parsing middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'api_key']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const upload = multer();
app.use(upload.none()); // parses multipart/form-data text fields

// Serve static images
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/labs/api/images', express.static(path.join(__dirname, 'public/images')));
app.use(express.static(path.join(__dirname, 'public')));

// API Key authorization middleware for /labs/api/orders
function requireApiKey(req, res, next) {
    const apiKey = req.query.api_key;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
        return res.status(401).json({
            error: 'Для получения доступа к API необходимо пройти процедуру авторизации. Для этого нужно передать в запросе персональный API Key.'
        });
    }
    req.apiKey = apiKey.trim();
    next();
}

// Root test route
app.get('/', (req, res) => {
    res.json({
        service: 'MosPolytech Web Course API Server',
        status: 'online',
        port: PORT,
        endpoints: {
            dishes: '/labs/api/dishes',
            singleDish: '/labs/api/dishes/:id',
            orders: '/labs/api/orders?api_key=YOUR_UUID_KEY'
        }
    });
});

// GET /labs/api/dishes
app.get('/labs/api/dishes', (req, res) => {
    res.json(dishes);
});

// GET /labs/api/dishes/:id
app.get('/labs/api/dishes/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const dish = dishes.find((d) => d.id === id);
    if (!dish) {
        return res.status(404).json({ error: 'Блюдо не найдено' });
    }
    res.json(dish);
});

// GET /labs/api/orders
app.get('/labs/api/orders', requireApiKey, (req, res) => {
    const userOrders = orders
        .filter((o) => o.api_key === req.apiKey)
        .map((o) => {
            const { api_key, ...safeOrder } = o;
            return safeOrder;
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(userOrders);
});

// GET /labs/api/orders/:id
app.get('/labs/api/orders/:id', requireApiKey, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const order = orders.find((o) => o.id === id && o.api_key === req.apiKey);
    if (!order) {
        return res.status(404).json({ error: 'Заказ не найден' });
    }
    const { api_key, ...safeOrder } = order;
    res.json(safeOrder);
});

// POST /labs/api/orders
app.post('/labs/api/orders', requireApiKey, (req, res) => {
    const userOrders = orders.filter((o) => o.api_key === req.apiKey);
    if (userOrders.length >= 10) {
        return res.status(422).json({
            error: 'В один момент времени в базе данных может быть не более 10 заказов, созданных одним и тем же пользователем.'
        });
    }

    const {
        full_name,
        email,
        phone,
        delivery_address,
        delivery_type,
        delivery_time,
        comment,
        subscribe,
        soup_id,
        main_course_id,
        salad_id,
        drink_id,
        dessert_id
    } = req.body;

    // Check mandatory fields
    if (!full_name || !email || !phone || !delivery_address || !delivery_type) {
        return res.status(422).json({
            error: 'Не заполнены обязательные поля: full_name, email, phone, delivery_address, delivery_type'
        });
    }

    if (delivery_type !== 'now' && delivery_type !== 'by_time') {
        return res.status(422).json({
            error: 'Значение delivery_type должно быть "now" или "by_time"'
        });
    }

    if (delivery_type === 'by_time' && !delivery_time) {
        return res.status(422).json({
            error: 'Не указано время доставки для типа доставки "by_time"'
        });
    }

    if (!drink_id) {
        return res.status(422).json({
            error: 'Обязательное поле drink_id не заполнено'
        });
    }

    const nowIso = new Date().toISOString();
    const newOrder = {
        id: getNextOrderId(),
        full_name: String(full_name).trim(),
        email: String(email).trim(),
        phone: String(phone).trim(),
        delivery_address: String(delivery_address).trim(),
        delivery_type: String(delivery_type),
        delivery_time: delivery_time ? String(delivery_time).trim() : null,
        comment: comment ? String(comment).trim() : '',
        subscribe: (subscribe === 1 || subscribe === '1' || subscribe === true) ? 1 : 0,
        soup_id: soup_id ? parseInt(soup_id, 10) : null,
        main_course_id: main_course_id ? parseInt(main_course_id, 10) : null,
        salad_id: salad_id ? parseInt(salad_id, 10) : null,
        drink_id: parseInt(drink_id, 10),
        dessert_id: dessert_id ? parseInt(dessert_id, 10) : null,
        created_at: nowIso,
        updated_at: nowIso,
        student_id: 1,
        api_key: req.apiKey
    };

    orders.push(newOrder);
    saveOrdersToDisk();

    const { api_key, ...safeOrder } = newOrder;
    res.status(201).json(safeOrder);
});

// PUT /labs/api/orders/:id
app.put('/labs/api/orders/:id', requireApiKey, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const orderIndex = orders.findIndex((o) => o.id === id && o.api_key === req.apiKey);
    if (orderIndex === -1) {
        return res.status(404).json({ error: 'Заказ не найден' });
    }

    const existing = orders[orderIndex];
    const b = req.body;

    if (b.full_name !== undefined) existing.full_name = String(b.full_name).trim();
    if (b.email !== undefined) existing.email = String(b.email).trim();
    if (b.phone !== undefined) existing.phone = String(b.phone).trim();
    if (b.delivery_address !== undefined) existing.delivery_address = String(b.delivery_address).trim();
    if (b.delivery_type !== undefined) existing.delivery_type = String(b.delivery_type);
    if (b.delivery_time !== undefined) existing.delivery_time = b.delivery_time ? String(b.delivery_time).trim() : null;
    if (b.comment !== undefined) existing.comment = String(b.comment).trim();
    if (b.subscribe !== undefined) {
        existing.subscribe = (b.subscribe === 1 || b.subscribe === '1' || b.subscribe === true) ? 1 : 0;
    }

    if (b.soup_id !== undefined) existing.soup_id = b.soup_id ? parseInt(b.soup_id, 10) : null;
    if (b.main_course_id !== undefined) existing.main_course_id = b.main_course_id ? parseInt(b.main_course_id, 10) : null;
    if (b.salad_id !== undefined) existing.salad_id = b.salad_id ? parseInt(b.salad_id, 10) : null;
    if (b.drink_id !== undefined) existing.drink_id = parseInt(b.drink_id, 10);
    if (b.dessert_id !== undefined) existing.dessert_id = b.dessert_id ? parseInt(b.dessert_id, 10) : null;

    existing.updated_at = new Date().toISOString();

    orders[orderIndex] = existing;
    saveOrdersToDisk();

    const { api_key, ...safeOrder } = existing;
    res.json(safeOrder);
});

// DELETE /labs/api/orders/:id
app.delete('/labs/api/orders/:id', requireApiKey, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const orderIndex = orders.findIndex((o) => o.id === id && o.api_key === req.apiKey);
    if (orderIndex === -1) {
        return res.status(404).json({ error: 'Заказ не найден' });
    }

    const deletedOrder = orders.splice(orderIndex, 1)[0];
    saveOrdersToDisk();

    const { api_key, ...safeOrder } = deletedOrder;
    res.json(safeOrder);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`MosPolytech Labs API server is running on http://0.0.0.0:${PORT}`);
});
