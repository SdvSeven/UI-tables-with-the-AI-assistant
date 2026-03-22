# Кейс 1 - CheatCoders
Веб‑приложение для бизнес‑аналитиков, позволяющее создавать сводные таблицы на больших объёмах данных (10 млн записей, до 200 атрибутов) с использованием ИИ для рекомендаций и интерпретации данных.

Чтобы развернуть сервер, обратись к нам, мы предоставим вам свой сервер и устройство 🤗

## Стек технологий

- **База данных**: PostgreSQL 16
- **Бэкенд**: Java 17+, Spring Boot 3
- **Фронтенд**: React + TypeScript
- **AI‑модуль**: Spring Boot (прокси) + Mistral (LLM)

Запуск:

### База данных (PostgreSQL)

1. Установите PostgreSQL (например, через Homebrew):
   brew install postgresql@16
   
   brew services start postgresql@16

3. Создайте базу данных и выполните скрипты инициализации:
   createdb pivot_analytics
   
   psql -U <your_user> -d pivot_analytics -f db_scripts/01_create_tables.sql
   
   psql -U <your_user> -d pivot_analytics -f db_scripts/02_create_indexes.sql

5. Для наполнения тестовыми данными (100 000 строк) выполните:
   psql -U <your_user> -d pivot_analytics -f db_scripts/03_generate_data.sql

### Основной бэкенд (Spring Boot)
   cd back/pivot-demo
   
   mvn spring-boot:run

Сервер запустится на порту 8080.

### AI‑модуль (прокси для LLM)
   cd back/ml/Danil-Backend/java-backend
   
   export MISTRAL_API_KEY="ваш_ключ"
   
   export MISTRAL_MODEL="mistral-tiny"
   
   mvn spring-boot:run

Сервер запустится на порту 8082.

### Фронтенд
   cd front
   
   npm install
   
   npm run dev

Приложение будет доступно по адресу http://localhost:5173.

Разработано в рамках хакатона командой CheatCoders.
