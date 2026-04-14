# Кейс 1 - CheatCoders

<p align="center">
  <img src="media/sber.png" alt="Company Image" width="300"/>
</p>

<p align="center">
  <b>🟢 Хакатон Сбер & ПРОСТО & ИТМО </b>
</p>

---

## О проекте

Веб-приложение для бизнес-аналитиков, позволяющее создавать сводные таблицы на больших объёмах данных (до **10 млн записей** и **200 атрибутов**) с использованием AI для рекомендаций и интерпретации данных.

---

## Возможности

- Построение pivot-таблиц на больших данных  
- Работа с высоконагруженными наборами данных  
- AI-подсказки для анализа и интерпретации  
- Масштабируемая архитектура  
- Разделение backend / AI / frontend  

---

## Стек технологий

- **База данных:** PostgreSQL 16  
- **Backend:** Java 17+, Spring Boot 3  
- **Frontend:** React + TypeScript  
- **AI-модуль:** Spring Boot (proxy) + Mistral LLM  

---

## Запуск проекта

### 1. База данных (PostgreSQL)

##### Установка:

```bash
brew install postgresql@16
brew services start postgresql@16
```

##### Создание базы:
```bash
createdb pivot_analytics
```

##### Инициализация схемы:
```bash
psql -U <your_user> -d pivot_analytics -f db_scripts/01_create_tables.sql
psql -U <your_user> -d pivot_analytics -f db_scripts/02_create_indexes.sql
```

##### Заполнение тестовыми данными:
```bash
psql -U <your_user> -d pivot_analytics -f db_scripts/03_generate_data.sql
```

### 2. Основной backend (Spring Boot)
```bash
cd back/pivot-demo
mvn spring-boot:run
```
##### Сервис будет доступен на: http://localhost:8080

### 3. AI-модуль (LLM proxy)
```bash
cd back/ml/Danil-Backend/java-backend

export MISTRAL_API_KEY="ваш_ключ"
export MISTRAL_MODEL="mistral-tiny"

mvn spring-boot:run
```

##### Сервис будет доступен на: http://localhost:8082

### 4. Frontend
```bash
cd front
npm install
npm run dev
```

##### Приложение:http://localhost:5173

### Архитектура
Frontend (React + TypeScript)
Backend API (Spring Boot)
AI Proxy Service (Spring Boot)
PostgreSQL (основное хранилище)
LLM (Mistral)


## Команда
Разработано в рамках хакатона командой CheatCoders.
- Капитан команды, LLM + Backend : @SdvSeven (Tg)
- Backend + Data : @skyperfect (Tg)
- Frontend : @ORLIK1121 (Tg)
- Math: @Stefek2435 (Tg) 

