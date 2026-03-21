import java.io.*;
import java.nio.charset.*;
import java.nio.file.*;
import java.util.*;
import java.util.regex.*;
import java.util.stream.Collectors;

/**
 * Класс для преобразования Excel-подобных формул в SQL запросы
 */
public class ExcelFormulas {
    // Список заголовков колонок из CSV
    private static List<String> headers = new ArrayList<>();
    // Количество строк в CSV
    private static int rowCount = 0;

    /**
     * Точка входа в программу
     */
    public static void main(String[] args) {
        // Загружаем CSV файл и получаем структуру данных (без вывода)
        loadCSV("sales_1000.csv");
        
        // Создаем сканер для чтения ввода из консоли (UTF-8 для поддержки русских символов)
        Scanner scanner = new Scanner(System.in, "UTF-8");
        
        // Выводим приветствие и инструкции
        System.out.println("SQL Query Generator Ready. Type 'exit' to quit.");
        System.out.println();
        
        // Основной цикл обработки формул
        while (true) {
            try {
                // Приглашение к вводу
                System.out.print("> ");
                String input = scanner.nextLine().trim();
                
                // Выход из программы
                if (input.equalsIgnoreCase("exit")) break;
                if (input.isEmpty()) continue;
                
                // Убираем знак = если он есть (Excel стиль)
                String formula = input;
                if (formula.startsWith("=")) {
                    formula = formula.substring(1);
                }
                
                // Генерируем SQL запрос из формулы
                String sqlQuery = generateSQL(formula);
                
                // Выводим результат
                System.out.println(sqlQuery);
                System.out.println();
            } catch (NoSuchElementException e) {
                // Обработка конца ввода (Ctrl+D / Ctrl+Z)
                break;
            } catch (Exception e) {
                // Выводим сообщение об ошибке
                System.out.println("Error: " + e.getMessage());
            }
        }
        scanner.close();
    }

    /**
     * Загрузка CSV файла для получения структуры (заголовки и количество строк)
     * @param filename - имя файла CSV
     */
    private static void loadCSV(String filename) {
        try (BufferedReader br = Files.newBufferedReader(Paths.get(filename), Charset.forName("UTF-8"))) {
            // Читаем первую строку - заголовки колонок
            String line = br.readLine();
            if (line == null) return;
            
            // Разбиваем заголовки по запятым
            headers = Arrays.asList(line.split(","));
            
            // Подсчитываем количество строк данных (пропускаем заголовок)
            int rowNum = 1;
            while ((line = br.readLine()) != null) {
                rowNum++;
            }
            rowCount = rowNum - 1;
            
            // Вывод загрузки убран - ничего не выводим
        } catch (IOException e) {
            System.err.println("Error loading CSV: " + e.getMessage());
            System.exit(1);
        }
    }
    
    /**
     * Основной метод преобразования формулы в SQL запрос
     * @param formula - формула для преобразования
     * @return SQL запрос в виде строки
     */
    private static String generateSQL(String formula) {
        String upperFormula = formula.toUpperCase().trim();
        
        // ========== 1. COUNT(*) - подсчет всех строк ==========
        if (upperFormula.equals("COUNT(*)")) {
            return "SELECT COUNT(*) as result FROM sales_data;";
        }
        
        // ========== 2. COUNT(DISTINCT field) - подсчет уникальных значений ==========
        if (upperFormula.startsWith("COUNT(DISTINCT ")) {
            String field = extractField(formula, "COUNT(DISTINCT ");
            return String.format("SELECT COUNT(DISTINCT %s) as result FROM sales_data;", field);
        }
        
        // ========== 3. STRING_AGG(DISTINCT field) - список уникальных значений ==========
        if (upperFormula.startsWith("STRING_AGG(DISTINCT ")) {
            String field = extractField(formula, "STRING_AGG(DISTINCT ");
            return String.format("SELECT STRING_AGG(DISTINCT %s, ', ') as result FROM sales_data;", field);
        }
        
        // ========== 4. SUM(field) - сумма значений ==========
        if (upperFormula.startsWith("SUM(") && !upperFormula.contains("DISTINCT") && !upperFormula.contains("CAST")) {
            String field = extractField(formula, "SUM(");
            return String.format("SELECT SUM(%s) as result FROM sales_data;", field);
        }
        
        // ========== 5. SUM(CAST(field AS INT)) - целочисленная сумма ==========
        if (upperFormula.contains("SUM(CAST(") && upperFormula.contains("AS INT")) {
            Pattern pattern = Pattern.compile("SUM\\(CAST\\(([a-z_]+)\\s+AS\\s+INT\\)\\)", Pattern.CASE_INSENSITIVE);
            Matcher matcher = pattern.matcher(formula);
            if (matcher.find()) {
                String field = matcher.group(1);
                return String.format("SELECT SUM(CAST(%s AS INTEGER)) as result FROM sales_data;", field);
            }
        }
        
        // ========== 6. AVG(field) - среднее значение ==========
        if (upperFormula.startsWith("AVG(")) {
            String field = extractField(formula, "AVG(");
            return String.format("SELECT AVG(%s) as result FROM sales_data;", field);
        }
        
        // ========== 7. PERCENTILE_CONT(0.5) / MEDIAN - медиана ==========
        if (upperFormula.startsWith("PERCENTILE_CONT(0.5)") || upperFormula.startsWith("MEDIAN(")) {
            String field;
            if (upperFormula.startsWith("PERCENTILE_CONT(0.5)")) {
                field = extractField(formula, "PERCENTILE_CONT(0.5)");
            } else {
                field = extractField(formula, "MEDIAN(");
            }
            return String.format("SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY %s) as result FROM sales_data;", field);
        }
        
        // ========== 8. VAR_SAMP(field) - выборочная дисперсия ==========
        if (upperFormula.startsWith("VAR_SAMP(")) {
            String field = extractField(formula, "VAR_SAMP(");
            return String.format("SELECT VAR_SAMP(%s) as result FROM sales_data;", field);
        }
        
        // ========== 9. STDDEV_SAMP(field) - выборочное стандартное отклонение ==========
        if (upperFormula.startsWith("STDDEV_SAMP(")) {
            String field = extractField(formula, "STDDEV_SAMP(");
            return String.format("SELECT STDDEV_SAMP(%s) as result FROM sales_data;", field);
        }
        
        // ========== 10. MIN(field) - минимальное значение ==========
        if (upperFormula.startsWith("MIN(")) {
            String field = extractField(formula, "MIN(");
            return String.format("SELECT MIN(%s) as result FROM sales_data;", field);
        }
        
        // ========== 11. MAX(field) - максимальное значение ==========
        if (upperFormula.startsWith("MAX(")) {
            String field = extractField(formula, "MAX(");
            return String.format("SELECT MAX(%s) as result FROM sales_data;", field);
        }
        
        // ========== 12. FIRST_VALUE(field) - первое значение ==========
        if (upperFormula.startsWith("FIRST_VALUE(")) {
            String field = extractField(formula, "FIRST_VALUE(");
            return String.format("SELECT FIRST_VALUE(%s) OVER (ORDER BY id) as result FROM sales_data LIMIT 1;", field);
        }
        
        // ========== 13. LAST_VALUE(field) - последнее значение ==========
        if (upperFormula.startsWith("LAST_VALUE(")) {
            String field = extractField(formula, "LAST_VALUE(");
            return String.format("SELECT LAST_VALUE(%s) OVER (ORDER BY id ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as result FROM sales_data ORDER BY id DESC LIMIT 1;", field);
        }
        
        // ========== ОБРАБОТКА ФОРМУЛ С ДИАПАЗОНАМИ ЯЧЕЕК ==========
        
        // Последовательно обрабатываем различные функции для диапазонов
        String processedFormula = formula;
        processedFormula = processSumRangeSQL(processedFormula);      // SUM(price1:price10)
        processedFormula = processAverageRangeSQL(processedFormula);  // AVERAGE(price1:price10)
        processedFormula = processMinRangeSQL(processedFormula);      // MIN(price1:price10)
        processedFormula = processMaxRangeSQL(processedFormula);      // MAX(price1:price10)
        processedFormula = processCountRangeSQL(processedFormula);    // COUNT(price1:price10)
        
        // Если после обработки остались ссылки на отдельные ячейки (price1, revenue5)
        if (processedFormula.matches(".*[a-z_]+\\d+.*")) {
            return generateCellFormulaSQL(processedFormula);
        }
        
        // Если формула не распознана
        throw new IllegalArgumentException("Unknown formula: " + formula);
    }
    
    /**
     * Генерация SQL для формул с отдельными ячейками (price1, revenue5)
     * Использует ROW_NUMBER() для нумерации строк
     * @param formula - формула с ссылками на ячейки
     * @return SQL запрос
     */
    private static String generateCellFormulaSQL(String formula) {
        // Регулярное выражение для поиска ссылок на ячейки (колонка + номер строки)
        Pattern cellPattern = Pattern.compile("([a-z_]+)(\\d+)", Pattern.CASE_INSENSITIVE);
        Matcher matcher = cellPattern.matcher(formula);
        StringBuffer result = new StringBuffer();
        
        // Заменяем каждую ссылку на подзапрос, который выбирает значение по номеру строки
        while (matcher.find()) {
            String col = matcher.group(1).toLowerCase();  // имя колонки
            int row = Integer.parseInt(matcher.group(2)); // номер строки
            
            // Подзапрос: выбираем значение из указанной строки с помощью ROW_NUMBER()
            String replacement = String.format("(SELECT %s FROM (SELECT %s, ROW_NUMBER() OVER (ORDER BY id) as rn FROM sales_data) t WHERE rn = %d)", col, col, row);
            matcher.appendReplacement(result, replacement);
        }
        matcher.appendTail(result);
        
        // Возвращаем готовый SQL запрос
        return "SELECT " + result.toString() + " as result;";
    }
    
    /**
     * Преобразование SUM(price1:price10) в SQL подзапрос
     * @param formula - исходная формула
     * @return формула с замененными SUM диапазонами
     */
    private static String processSumRangeSQL(String formula) {
        Pattern pattern = Pattern.compile("SUM\\(([a-z_]+)(\\d+):([a-z_]+)(\\d+)\\)", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(formula);
        StringBuffer result = new StringBuffer();
        
        while (matcher.find()) {
            String col = matcher.group(1).toLowerCase();
            int row1 = Integer.parseInt(matcher.group(2));
            int row2 = Integer.parseInt(matcher.group(4));
            
            // SQL: сумма значений колонки в указанном диапазоне строк
            String replacement = String.format("(SELECT SUM(%s) FROM (SELECT %s, ROW_NUMBER() OVER (ORDER BY id) as rn FROM sales_data) t WHERE rn BETWEEN %d AND %d)", col, col, row1, row2);
            matcher.appendReplacement(result, replacement);
        }
        matcher.appendTail(result);
        return result.toString();
    }
    
    /**
     * Преобразование AVERAGE(price1:price10) в SQL подзапрос
     * @param formula - исходная формула
     * @return формула с замененными AVERAGE диапазонами
     */
    private static String processAverageRangeSQL(String formula) {
        Pattern pattern = Pattern.compile("AVERAGE\\(([a-z_]+)(\\d+):([a-z_]+)(\\d+)\\)", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(formula);
        StringBuffer result = new StringBuffer();
        
        while (matcher.find()) {
            String col = matcher.group(1).toLowerCase();
            int row1 = Integer.parseInt(matcher.group(2));
            int row2 = Integer.parseInt(matcher.group(4));
            
            // SQL: среднее значение колонки в указанном диапазоне строк
            String replacement = String.format("(SELECT AVG(%s) FROM (SELECT %s, ROW_NUMBER() OVER (ORDER BY id) as rn FROM sales_data) t WHERE rn BETWEEN %d AND %d)", col, col, row1, row2);
            matcher.appendReplacement(result, replacement);
        }
        matcher.appendTail(result);
        return result.toString();
    }
    
    /**
     * Преобразование MIN(price1:price10) в SQL подзапрос
     * @param formula - исходная формула
     * @return формула с замененными MIN диапазонами
     */
    private static String processMinRangeSQL(String formula) {
        Pattern pattern = Pattern.compile("MIN\\(([a-z_]+)(\\d+):([a-z_]+)(\\d+)\\)", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(formula);
        StringBuffer result = new StringBuffer();
        
        while (matcher.find()) {
            String col = matcher.group(1).toLowerCase();
            int row1 = Integer.parseInt(matcher.group(2));
            int row2 = Integer.parseInt(matcher.group(4));
            
            // SQL: минимальное значение колонки в указанном диапазоне строк
            String replacement = String.format("(SELECT MIN(%s) FROM (SELECT %s, ROW_NUMBER() OVER (ORDER BY id) as rn FROM sales_data) t WHERE rn BETWEEN %d AND %d)", col, col, row1, row2);
            matcher.appendReplacement(result, replacement);
        }
        matcher.appendTail(result);
        return result.toString();
    }
    
    /**
     * Преобразование MAX(price1:price10) в SQL подзапрос
     * @param formula - исходная формула
     * @return формула с замененными MAX диапазонами
     */
    private static String processMaxRangeSQL(String formula) {
        Pattern pattern = Pattern.compile("MAX\\(([a-z_]+)(\\d+):([a-z_]+)(\\d+)\\)", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(formula);
        StringBuffer result = new StringBuffer();
        
        while (matcher.find()) {
            String col = matcher.group(1).toLowerCase();
            int row1 = Integer.parseInt(matcher.group(2));
            int row2 = Integer.parseInt(matcher.group(4));
            
            // SQL: максимальное значение колонки в указанном диапазоне строк
            String replacement = String.format("(SELECT MAX(%s) FROM (SELECT %s, ROW_NUMBER() OVER (ORDER BY id) as rn FROM sales_data) t WHERE rn BETWEEN %d AND %d)", col, col, row1, row2);
            matcher.appendReplacement(result, replacement);
        }
        matcher.appendTail(result);
        return result.toString();
    }
    
    /**
     * Преобразование COUNT(price1:price10) в SQL подзапрос
     * @param formula - исходная формула
     * @return формула с замененными COUNT диапазонами
     */
    private static String processCountRangeSQL(String formula) {
        Pattern pattern = Pattern.compile("COUNT\\(([a-z_]+)(\\d+):([a-z_]+)(\\d+)\\)", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(formula);
        StringBuffer result = new StringBuffer();
        
        while (matcher.find()) {
            String col = matcher.group(1).toLowerCase();
            int row1 = Integer.parseInt(matcher.group(2));
            int row2 = Integer.parseInt(matcher.group(4));
            
            // SQL: количество не-NULL значений колонки в указанном диапазоне строк
            String replacement = String.format("(SELECT COUNT(%s) FROM (SELECT %s, ROW_NUMBER() OVER (ORDER BY id) as rn FROM sales_data) t WHERE rn BETWEEN %d AND %d AND %s IS NOT NULL)", col, col, row1, row2, col);
            matcher.appendReplacement(result, replacement);
        }
        matcher.appendTail(result);
        return result.toString();
    }
    
    /**
     * Извлечение имени поля из формулы
     * Пример: из "SUM(price)" извлекаем "price"
     * @param formula - формула целиком
     * @param functionName - имя функции (например "SUM(")
     * @return имя поля
     */
    private static String extractField(String formula, String functionName) {
        int start = functionName.length();
        int end = formula.lastIndexOf(")");
        if (end == -1) throw new IllegalArgumentException("Missing closing parenthesis");
        return formula.substring(start, end).trim();
    }
}