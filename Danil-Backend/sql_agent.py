import pandas as pd
import sqlite3
import re
from pipeline import ask_mistral_simple, MISTRAL_MODEL, API_KEY

SQL_SYSTEM_PROMPT = {
    'role': 'system',
    'content': (
        "You are a professional developer and Data Engineer. "
        "Write correct, high-quality SQL SELECT queries for SQLite based on user requests. "
        "Never write any comments, explanations or markdown, only pure SQL. "
        "If the user asks general or off-topic questions, reply with 'SELECT * FROM {table_name} LIMIT 5;'."
    )
}

def extract_sql_query(text):
    for line in text.splitlines():
        l = line.strip().upper()
        if l.startswith("SELECT"):
            sql = line.strip()
            if not sql.endswith(";"):
                sql += ";"
            return sql
        elif l.startswith(("UPDATE", "DELETE", "DROP", "ALTER", "INSERT", "CREATE")):
            return None
    match = re.search(r'(SELECT[\s\S]+?;)', text, re.IGNORECASE)
    return match.group(1) if match else None

def add_limit(sql, max_rows=100):
    if re.search(r'\blimit\b', sql, re.IGNORECASE):
        return sql
    sql = sql.rstrip(";")
    return f"{sql} LIMIT {max_rows};"

def execute_sql_and_return_result(conn, sql_query):
    try:
        cur = conn.execute(sql_query)
        rows = cur.fetchall()
        colnames = [description[0] for description in cur.description] if cur.description else []
        return pd.DataFrame(rows, columns=colnames) if colnames else rows
    except Exception as e:
        return f"Ошибка выполнения SQL: {e}"

def answer_question_sql(
    conn, table_name, columns, user_question,
    api_key, model=MISTRAL_MODEL,
    message_history=None
):
    sys_msg = {
        'role': SQL_SYSTEM_PROMPT['role'],
        'content': SQL_SYSTEM_PROMPT['content'].format(table_name=table_name)
    }
    prompt_sql = (
        f"Таблица: {table_name}. Столбцы: {', '.join(columns)}.\n"
        f"Составь КОРОТКИЙ ОДНОСТРОЧНЫЙ SQL SELECT для SQLite, чтобы ответить на вопрос: '{user_question}'. "
        "Ответь только строкой SQL, без комментариев, без markdown, без пояснений."
    )
    sql = ask_mistral_simple(prompt_sql, api_key, model)
    sql = extract_sql_query(sql)
    if sql is None:
        return f"Вопрос к таблице: {user_question}\n\n=== Результат ===\n\nНе удалось сгенерировать корректный SQL для вашего вопроса."
    sql = add_limit(sql)
    result = execute_sql_and_return_result(conn, sql)
    # Если результат DataFrame — вернуть для возможного сохранения в Excel
    if isinstance(result, pd.DataFrame):
        return result
    if isinstance(result, str):
        return f"Вопрос к таблице: {user_question}\n\n=== Результат ===\n\n{result}"
    if isinstance(result, pd.DataFrame) and result.empty:
        result_text = "Нет данных по вашему запросу."
    else:
        result_text = result.head(10).to_string(index=False) if isinstance(result, pd.DataFrame) else str(result)
    # Human answer
    prompt_human = (
        f"Вопрос к таблице: {user_question}\n\n"
        f"SQL-запрос: {sql}\n\n"
        f"Результат выполнения запроса:\n{result_text}\n\n"
        "Ответь КОРОТКО на русском языке, без SQL и таблиц. Только результат."
    )
    answer = ask_mistral_simple(prompt_human, api_key, model)
    match = re.search(r'=== Результат ===\n*(.+)', answer, re.DOTALL)
    result_only = match.group(1).strip() if match else answer.strip()
    return f"Вопрос к таблице: {user_question}\n\n=== Результат ===\n{result_only}"
