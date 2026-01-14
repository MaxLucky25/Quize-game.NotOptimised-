# 🎮 Quiz Game API

> Modern RESTful API for multiplayer pair quiz game, built with NestJS using CQRS and Domain-Driven Design

[![NestJS](https://img.shields.io/badge/NestJS-11.0-E0234E?logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Latest-4169E1?logo=postgresql)](https://www.postgresql.org/)

---

## ✨ Features

- 🔐 **Multi-layered Security System** - JWT tokens, refresh token rotation, rate limiting
- 🎯 **CQRS Architecture** - separation of commands and queries for scalability
- 🏗️ **Domain-Driven Design** - clean architecture with business logic isolation
- 🎮 **Game Mechanics** - automatic pair creation, timeouts, rating system
- 📱 **Session Management** - device tracking, active session management
- 📧 **Email Integration** - registration confirmation and password recovery
- 🧪 **Full Test Coverage** - E2E, integration and unit tests
- 📖 **Swagger Documentation** - basic auto-generated API documentation (Swagger UI configured)

---

## 🚀 Quick Start

### Requirements

- Node.js >= 18
- PostgreSQL
- Yarn or npm

### Installation

```bash
# Clone repository
git clone <repository-url>

# Install dependencies
yarn install

# Configure environment variables
# Create env/.env.development file with required variables

# Start application
yarn start:dev
```

Application will be available at `http://localhost:3004`  
Swagger documentation: `http://localhost:3004/swagger`

---

## 🛠️ Tech Stack

| Category           | Technologies                        |
| ------------------ | ----------------------------------- |
| **Backend**        | NestJS 11, TypeScript 5.7           |
| **Database**       | PostgreSQL, TypeORM                 |
| **Authentication** | JWT, Passport.js, bcryptjs          |
| **Architecture**   | CQRS, DDD, Clean Architecture       |
| **Validation**     | class-validator, class-transformer  |
| **Testing**        | Jest, Supertest                     |
| **Security**       | @nestjs/throttler, httpOnly cookies |
| **Documentation**  | Swagger/OpenAPI                     |

---

## 📚 Main API Endpoints

### 🔑 Authentication

```
POST   /auth/registration              - User registration
POST   /auth/login                     - User login
POST   /auth/logout                    - User logout
POST   /auth/refresh-token             - Refresh access token
GET    /auth/me                        - Current user info
```

### 👥 User Management (Admin)

```
GET    /sa/users                       - Get users list
POST   /sa/users                       - Create user
PUT    /sa/users/:id                   - Update user
DELETE /sa/users/:id                   - Delete user
```

### ❓ Question Management (Admin)

```
GET    /sa/quiz/questions              - Get questions list
POST   /sa/quiz/questions              - Create question
PUT    /sa/quiz/questions/:id         - Update question
PUT    /sa/quiz/questions/:id/publish - Publish question
```

### 🎮 Game Mechanics

```
POST   /pair-game-quiz/pairs/connection           - Connect to game
GET    /pair-game-quiz/pairs/my-current           - Current game
GET    /pair-game-quiz/pairs/my                   - My games
POST   /pair-game-quiz/pairs/my-current/answers   - Submit answer
GET    /pair-game-quiz/users/my-statistic         - My statistics
GET    /pair-game-quiz/users/top                  - Top players
```

### 🔒 Session Management

```
GET    /security/devices              - Active devices
DELETE /security/devices/:deviceId    - Delete specific device
DELETE /security/devices              - Delete all devices except current
```

---

## 🔐 Security

### Implemented Security Measures

- ✅ **JWT Authentication** - Access and Refresh tokens with separate secrets
- ✅ **Refresh Token Rotation** - Automatic revocation of old tokens
- ✅ **Password Hashing** - bcrypt with configurable salt rounds
- ✅ **Rate Limiting** - Protection against DDoS and brute-force attacks
- ✅ **Input Validation** - Validation of all incoming data
- ✅ **SQL Injection Protection** - Parameterized queries with TypeORM
- ✅ **XSS Protection** - Input sanitization
- ✅ **CSRF Protection** - SameSite cookies
- ✅ **Session Management** - Device and IP tracking
- ✅ **Secure Cookies** - httpOnly, secure, sameSite for refresh tokens

---

## 🧪 Testing

```bash
# Run all tests
yarn test

# E2E tests
yarn test:e2e

# Integration tests
yarn test:integration

# Unit tests
yarn test:unit

# Code coverage
yarn test:cov
```

---

## 📁 Project Structure

```
src/
├── core/                    # Core (filters, pipes, exceptions)
├── configs/                 # Configuration
├── modules/
│   ├── auth-manage/         # Authentication and users
│   │   ├── access-control/  # Login, registration, tokens
│   │   ├── user-accounts/   # Account management
│   │   └── security-device/ # Session management
│   ├── quiz-game/           # Game module
│   │   ├── questions/       # Question management
│   │   └── pair-game/       # Game mechanics
│   └── testing/             # Testing module
└── types/                   # TypeScript types
```

---

## 🎯 Architectural Decisions

- **CQRS** - Separation of commands and queries for performance optimization
- **DDD** - Business logic isolation in domain layers
- **Clean Architecture** - Clear layer separation (Domain, Application, Infrastructure, API)
- **Dependency Injection** - Dependency management through NestJS DI
- **Exception Filters** - Centralized error handling
- **Validation Pipes** - Global validation of incoming data

---

## 📦 Scripts

| Command           | Description               |
| ----------------- | ------------------------- |
| `yarn start:dev`  | Start in development mode |
| `yarn build:prod` | Build for production      |
| `yarn test`       | Run all tests             |
| `yarn test:e2e`   | E2E tests                 |
| `yarn lint`       | Code linting              |
| `yarn format`     | Code formatting           |

---

## 📖 Documentation

Basic API documentation is available through Swagger UI in development mode (auto-generated from controllers):

```
http://localhost:3004/swagger
```

> **Note**: Swagger is configured and functional, but detailed documentation with descriptions and examples requires additional `@nestjs/swagger` decorators in controllers.

---

## 🚀 Deployment

The project is ready for deployment on various platforms:

- ✅ Vercel (configuration included)
- ✅ Docker
- ✅ Any Node.js hosting

<div align="center">

**Made with using NestJS**

[⬆ Back to top](#-quiz-game-api)

</div>
