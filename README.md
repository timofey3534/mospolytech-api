# MosPolytech Web Course API Server (Docker)

Кастомный бэкенд API для лабораторных работ 7, 8, 9, 10 курса веб-разработки Московского Политеха.
Полностью повторяет спецификацию учебного сервера Политеха (`edu.std-900.ist.mospolytech.ru`), но работает автономно, без падений, без лимитов и с полным CORS (`Access-Control-Allow-Origin: *`).

## 🚀 Быстрый запуск

### Вариант 1: Через Docker Compose (рекомендуется)
```bash
docker compose up -d --build
```
Сервер запустится на порту `8085` (или любом другом, указанном в `.env` / `docker-compose.yml`).

### Вариант 2: Через Docker CLI
```bash
docker build -t mospolytech-api .
docker run -d -p 8085:8085 --name mospolytech-api -v $(pwd)/data:/app/data --restart unless-stopped mospolytech-api
```

### Вариант 3: Без Docker (напрямую через Node.js)
```bash
npm install
npm start
```

---

## 📌 Эндпоинты

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/labs/api/dishes` | Получить список всех блюд (30 позиций, 5 категорий) |
| `GET` | `/labs/api/dishes/:id` | Получить конкретное блюдо по ID |
| `GET` | `/labs/api/orders?api_key=UUID` | Получить заказы пользователя |
| `GET` | `/labs/api/orders/:id?api_key=UUID` | Получить конкретный заказ |
| `POST` | `/labs/api/orders?api_key=UUID` | Создать заказ (`application/json` или `multipart/form-data`) |
| `PUT` | `/labs/api/orders/:id?api_key=UUID` | Обновить заказ |
| `DELETE` | `/labs/api/orders/:id?api_key=UUID` | Удалить заказ |

---

## ⚙️ Переключение фронтенда на этот API

По умолчанию фронтенд лаб обращается к `edu.std-900.ist.mospolytech.ru`. Чтобы фронтенд обращался к вашему серверу, откройте консоль браузера (F12) на странице лабы и выполните:

```javascript
localStorage.setItem('api_base_url', 'http://ВАШ_IP_ИЛИ_ДОМЕН:8085');
```
Для возврата на сервер Политеха:
```javascript
localStorage.removeItem('api_base_url');
```
