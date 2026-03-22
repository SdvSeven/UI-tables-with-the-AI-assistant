import pandas as pd
import sqlite3
import ntpath
import os
import re
import requests
from db import write_to_sql
from config import model, key

def sanitize_path(path: str) -> str:
    return path.strip().strip('"').strip("'")

def clean_table_name(name):
    # Только латиница, цифры, подчёркивания
    return re.sub(r'[^a-zA-Z0-9_]', '_', name)

# ---- Блок LLM-реформатирования (NEW!) ----

sys_msg = {'role': 'system', 'content':
    """Ты — умная LLM. Перефразируй запрос пользователя, чтобы он был максимально понятен для SQL-аналитика.
    Определи, нужно ли создавать Excel: если запрос на выгрузку/изменение/сохранение — "да", если только вопрос — "нет".
    Структура ответа:
    1. Переформулированный запрос
    2. Нужно создать Excel: да/нет
    Всегда отвечай строго на русском!"""
}

def reformat_query(message, history):
    previous = ""
    for msg in reversed(history):
        if msg["role"] == "user":
            previous = msg["content"]
            break
    context_block = f"Предыдущее сообщение пользователя: {previous}" if previous else ""
    user_message = {
        "role": "user",
        "content": f"{context_block}\nТекущий запрос пользователя: {message['content']}",
    }
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    data = {
        "model": model,
        "messages": [sys_msg, user_message],
        "temperature": 0.1
    }
    response = requests.post("https://api.mistral.ai/v1/chat/completions", headers=headers, json=data)
    if response.status_code != 200:
        raise Exception(f"Mistral API error: {response.status_code} - {response.text[:100]}")
    result = response.json()["choices"][0]["message"]["content"].strip()
    match = re.search(r"1\. (.*?)\s*2\. Нужно создать Excel: (да|нет|Да|Нет)", result, re.DOTALL)
    if not match:
        raise ValueError(f"Формат ответа нарушен: {result}")
    rephrased = match.group(1).strip()
    need_excel = match.group(2).strip().lower() == "да"
    return rephrased, need_excel

# ---- ОСТАЛЬНОЕ оставляем как есть ----

def main():
    user_input = input('Название/путь до таблицы Excel или CSV файла: ')
    user_sheet = sanitize_path(user_input)
    if not os.path.exists(user_sheet):
        print("Файл не найден:", user_sheet)
        return
    file_ext = ntpath.splitext(user_sheet)[1][1:].lower()
    base_name = ntpath.basename(user_sheet)
    table_base_name = clean_table_name(ntpath.splitext(base_name)[0])
    db_name = "main.db"

    try:
        with sqlite3.connect(db_name) as conn:
            if file_ext in ['xlsx', 'xls', 'xlsm', 'xlsb', 'odf', 'ods', 'odt']:
                xls = pd.ExcelFile(user_sheet, engine='openpyxl')
                for sheet_name in xls.sheet_names:
                    df = xls.parse(sheet_name)
                    if df.empty:
                        print(f"Пропущен пустой лист '{sheet_name}'")
                        continue
                    table_name = clean_table_name(f"{table_base_name}_{sheet_name}")
                    write_to_sql(conn, df, table_name, override_existing=True)
            elif file_ext == 'csv':
                df = pd.read_csv(user_sheet)
                if df.empty:
                    print("CSV файл пустой, импорт пропущен.")
                    return
                write_to_sql(conn, df, table_base_name, override_existing=True)
            else:
                print("Неподдерживаемое расширение файла.")
                return
        print(f"Завершено. Все данные сохранены в {db_name}")
    except Exception as e:
        print("Ошибка при обработке файла:", e)

if __name__ == '__main__':
    main()
