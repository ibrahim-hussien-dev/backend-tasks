# Task 2 – Secured RESTful CRUD API

Express + SQLite (SQL) CRUD API for `products`.

**Security / validation:** `helmet` headers, rate limiting, 10kb body limit, parameterized SQL, zod validation middleware, `X-API-Key` required for POST/PUT/DELETE.

## Run
```bash
npm install
# optional: set API_KEY (defaults to "dev-key")
npm start
```

## Endpoints
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /products | API key | Create |
| GET | /products?limit=&offset= | – | List |
| GET | /products/:id | – | Read one |
| PUT | /products/:id | API key | Update |
| DELETE | /products/:id | API key | Delete |

## Try it
```bash
curl -X POST localhost:3000/products -H "Content-Type: application/json" -H "X-API-Key: dev-key" \
  -d '{"name":"Keyboard","price":49.9,"stock":10}'
curl localhost:3000/products
curl -X POST localhost:3000/products -H "Content-Type: application/json" -H "X-API-Key: dev-key" \
  -d '{"name":"","price":-1}'      # -> 400 validation error
```
