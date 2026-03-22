import pandas as pd
import datetime
import threading

HISTORY_FILE = "history.xlsx"

message_history = []

session_timeout = 1800  # 30 минут
session_timer = None

def reset_session_timer():
    global session_timer, message_history
    if session_timer:
        session_timer.cancel()
    session_timer = threading.Timer(session_timeout, end_session)
    session_timer.start()

def end_session():
    global message_history
    message_history = []
    print("\nСессия завершена из-за бездействия.")

def add_message(role, content):
    message_history.append({'role': role, 'content': content})
    reset_session_timer()

def clear_history():
    global message_history
    message_history = []

def save_history(history):
    try:
        if history:
            last = pd.DataFrame([history[-1]])
            last.to_excel(HISTORY_FILE, index=False)
            print("История операции сохранена в", HISTORY_FILE)
        else:
            print("Нет записей для сохранения истории.")
    except Exception as e:
        print("Не удалось сохранить историю:", e)
