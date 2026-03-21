import pandas as pd
import numpy as np
import requests
import re
import time

API_KEY = "ieVRtKjI6LLdnqW5lRhLOxrejXFahN7y"
MISTRAL_MODEL = "mistral-tiny"

SAFE_BUILTINS = {
    'len': len,
    'range': range,
    'min': min,
    'max': max,
    'sum': sum,
    'abs': abs,
}

def apply_simple_task(df, task, new_names=None, orig_names=None):
    """
    Выполняет простые задачи без LLM (whitelist для "гибридной логики").
    """
    t = task.lower().strip()

    # 1. Удалить дубликаты
    if "удали дубликаты" in t or "удалить дубликаты" in t or "drop_duplicates" in t:
        return df.drop_duplicates()

    # 2. Оставить первые N строк (например, "оставь первые 50 строк", "top 100", "первые 10 строк")
    match = re.search(r"перв(ых|ые|ые)\s+(\d+)\s+стр", t)
    if match:
        n = int(match.group(2))
        return df.head(n)
    match = re.search(r"top\s*(\d+)", t)
    if match:
        n = int(match.group(1))
        return df.head(n)
    match = re.search(r"head\s*(\d+)", t)
    if match:
        n = int(match.group(1))
        return df.head(n)

    # 3. Оставить последние N строк (например, "последние 20 строк")
    match = re.search(r"последн(их|ие|ие)\s+(\d+)\s+стр", t)
    if match:
        n = int(match.group(2))
        return df.tail(n)

    # 4. Очистить пропуски (dropna)
    if "очисти пропуски" in t or "удали пропуски" in t or "dropna" in t:
        return df.dropna()

    # 5. Сортировка (например, "отсортируй по column" или "сортируй по column")
    sort_match = re.search(r"сортируй по ([\wа-яёА-ЯЁ]+)", t)
    if sort_match:
        col = sort_match.group(1).strip()
        if (new_names and col in new_names) or (orig_names and col in orig_names) or col in df.columns:
            return df.sort_values(col)

    # 6. Оставить только уникальные значения в столбце
    uniq_match = re.search(r"уникальные значения (столбца|в столбце) ([\wа-яёА-ЯЁ]+)", t)
    if uniq_match:
        col = uniq_match.group(2).strip()
        if col in df.columns:
            return df[[col]].drop_duplicates()

    # 7. Фильтрация по значению (например, "оставь строки где column = value")
    filt_match = re.search(r"где ([\wа-яёА-ЯЁ]+)\s*[=]\s*([^\s]+)", t)
    if filt_match:
        col = filt_match.group(1).strip()
        val = filt_match.group(2).strip()
        if col in df.columns:
            return df[df[col] == val]

    # 8. Удалить столбец (например, "удали столбец X")
    del_match = re.search(r"удали столбец ([\wа-яёА-ЯЁ]+)", t)
    if del_match:
        col = del_match.group(1).strip()
        if col in df.columns:
            return df.drop(columns=[col])

    # 9. Сбросить индексы
    if "сбрось индекс" in t or "reset index" in t:
        return df.reset_index(drop=True)

    # 10. Вывести названия столбцов
    if "названия столбцов" in t or "имена столбцов" in t or "сколько столбцов" in t:
        return list(df.columns)

    # 11. Количество строк и столбцов
    if "размер таблицы" in t or "сколько строк" in t or "число строк" in t or "число столбцов" in t:
        return f"Строк: {df.shape[0]}, столбцов: {df.shape[1]}"

    # 12. Сводная информация
    if "describe" in t or "описание" in t or "summary" in t:
        return df.describe()
    return None

def save_with_explanations_to_excel(
        df_clean,
        explanations,
        output_file,
        user_qa_list=None,
        original_names=None,
        new_names=None
    ):
    """
    Сохраняет DataFrame в Excel, добавляет лист с объяснениями и историей вопросов.
    """
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        df_clean.to_excel(writer, sheet_name='Result', index=False)
        # Лист с объяснениями
        if original_names and new_names and explanations:
            explain_df = pd.DataFrame({
                "Оригинальные имена": original_names,
                "Новые имена": new_names,
                "Пояснения": explanations
            })
            explain_df.to_excel(writer, sheet_name='Explanations', index=False)
        # Лист с историей запросов/ответов
        if user_qa_list:
            hist_df = pd.DataFrame(user_qa_list, columns=['Вопрос', 'Ответ'])
            hist_df.to_excel(writer, sheet_name='History', index=False)

def ask_mistral_simple(prompt, api_key=API_KEY, model=MISTRAL_MODEL, retries=3, messages=None):
    url = "https://api.mistral.ai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    if messages is not None:
        data = {
            "model": model,
            "messages": messages,
            "temperature": 0.2
        }
    else:
        data = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2
        }
    for attempt in range(retries):
        try:
            r = requests.post(url, headers=headers, json=data, timeout=60)
            if r.status_code == 200:
                return r.json()['choices'][0]['message']['content'].strip()
            elif "rate limit" in r.text.lower():
                print("Rate limit! Жду 10 секунд...")
                time.sleep(10*(attempt+1))
        except Exception as e:
            print("Ошибка сети:", e)
    return "Не удалось получить ответ от нейросети."

def clean_code(code):
    code = re.sub(r"^import .+$", "", code, flags=re.MULTILINE)
    code = re.sub(r"print\(.+?\)", "", code)
    code = re.sub(r"input\(.+?\)", "", code)
    code = re.sub(r"display\(.+?\)", "", code)
    code = re.sub(r"open\(.+?\)", "", code)
    code = re.sub(r"with\s+open\(.+?\):", "", code)
    code = code.strip()
    return code

def make_json_safe(obj):
    if isinstance(obj, dict):
        return {k: make_json_safe(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [make_json_safe(v) for v in obj]
    elif isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating,)):
        return float(obj)
    elif isinstance(obj, (np.ndarray,)):
        return obj.tolist()
    else:
        return obj

def process_question(df, question, user_qa_list=None, message_history=None):
    prompt = (
        f"Ты — опытный аналитик. Пользователь задал вопрос: '{question}'.\n"
        f"Вот первые 10 строк таблицы:\n{df.head(10).to_string(index=False)}\n\n"
        "Напиши ЧИСТЫЙ Python-код (без markdown, без комментариев, без import, print, input).\n"
        "- Если задача аналитическая — сохрани текст в переменную `answer`\n"
        "- Если обработка таблицы — результат в переменной `result_df`\n"
        "Возвращай ТОЛЬКО код, без пояснений."
    )
    if message_history is not None:
        messages = message_history + [{"role": "user", "content": prompt}]
        llm_code = ask_mistral_simple(prompt, API_KEY, MISTRAL_MODEL, messages=messages)
    else:
        llm_code = ask_mistral_simple(prompt, API_KEY, MISTRAL_MODEL)

    code_block = re.findall(r"```python(.*?)```", llm_code, re.DOTALL)
    if not code_block:
        code_block = re.findall(r"```(.*?)```", llm_code, re.DOTALL)
    if code_block:
        code = code_block[0].strip()
    else:
        match = re.search(r"(result_df\s*=.+|answer\s*=.+)", llm_code, re.DOTALL)
        code = match.group(0).strip() if match else llm_code.strip()

    code = clean_code(code)
    local_vars = {"df": df.copy()}
    try:
        exec(code, {"pd": pd, "np": np, "__builtins__": SAFE_BUILTINS}, local_vars)
        if "result_df" in local_vars and isinstance(local_vars["result_df"], pd.DataFrame):
            return local_vars["result_df"]
        if "answer" in local_vars:
            return local_vars["answer"]
    except Exception as e:
        return f"Ошибка при исполнении сгенерированного кода: {e}\nКод был:\n{code}"

    return "Не удалось получить валидный ответ от нейросети."
