from db import list_tables_from_db, load_tables_from_db
from pipeline import process_question, apply_simple_task, save_with_explanations_to_excel, ask_mistral_simple
from sql_agent import answer_question_sql
from session import save_history, add_message, message_history, reset_session_timer, clear_history
from reformat import reformat_query
import sqlite3
import datetime
import pandas as pd

API_KEY = "ieVRtKjI6LLdnqW5lRhLOxrejXFahN7y"
MISTRAL_MODEL = "mistral-tiny"
HISTORY_FILE = "history.xlsx"
DB_PATH = "main.db"

SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "Ты — опытный аналитик и Data Engineer. "
        "Отвечай чётко, формируй корректные SQL-запросы или давай аналитические ответы по данным. "
        "Не давай лишних комментариев, пиши только по сути запроса пользователя. "
        "Если пользователь пишет вне темы данных — просто покажи первые 5 строк таблицы."
    )
}

def run_agent_session():
    history = []
    user_qa_list = []
    clear_history()
    add_message(SYSTEM_PROMPT["role"], SYSTEM_PROMPT["content"])
    reset_session_timer()

    # 1. Список таблиц
    tables = list_tables_from_db()
    if not tables:
        print("В базе нет таблиц.")
        return

    selected_tables = select_tables(tables)
    if not selected_tables:
        print("Таблицы не выбраны.")
        return

    # 2. Загрузка выбранной таблицы
    dfs = load_tables_from_db(selected_tables)
    df0 = dfs[0].copy(deep=True)
    orig_names = list(df0.columns)
    new_names = orig_names
    explanations = [""] * len(orig_names)

    conn = sqlite3.connect(DB_PATH)

    print("Теперь вы можете задавать вопросы к таблице (пустая строка — завершить):")
    while True:
        user_q = input("Вопрос: ").strip()
        if not user_q:
            break
        add_message('user', user_q)

        # ==== Сначала реформатируем вопрос через LLM ====
        try:
            rephrased, need_excel = reformat_query({"content": user_q}, message_history)
        except Exception as e:
            print("Ошибка реформатирования:", e)
            continue

        print(f"\nПереформулированный запрос: {rephrased}\nНужно создать Excel: {'Да' if need_excel else 'Нет'}")

        # ==== Отправляем на обработку SQL-агенту ====
        sql_answer = answer_question_sql(conn, selected_tables[0], orig_names, rephrased, API_KEY)
        add_message('assistant', sql_answer)
        print(sql_answer)
        user_qa_list.append((user_q, sql_answer))

        # ==== Если нужно сохранить Excel ====
        if need_excel and isinstance(sql_answer, pd.DataFrame):
            file_name = input("Имя файла для Excel (.xlsx): ").strip()
            if not file_name.endswith(".xlsx"):
                file_name += ".xlsx"
            sql_answer.to_excel(file_name, index=False)
            print(f"Результат выгружен в {file_name}")

    conn.close()

    # Сохраняем только последнюю историю
    if user_qa_list:
        history.append({
            "timestamp": datetime.datetime.now(),
            "tables": ", ".join(selected_tables),
            "task": user_qa_list[-1][0],
            "output_file": file_name if 'file_name' in locals() else ""
        })
        save_history(history)

def select_tables(tables):
    print("С какой(ими) таблицей будем работать? (введите номера через запятую):")
    for idx, t in enumerate(tables):
        print(f"{idx+1}. {t}")
    selected = input("Введите номера через запятую: ")
    indices = [int(i)-1 for i in selected.strip().split(",") if i.strip().isdigit() and 0 < int(i) <= len(tables)]
    selected_tables = [tables[i] for i in indices]
    return selected_tables

if __name__ == "__main__":
    run_agent_session()
