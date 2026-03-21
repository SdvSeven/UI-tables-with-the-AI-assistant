export function evaluateFormula(formula: string, rowData: Record<string, any>): any {
  if (!formula || !formula.startsWith('=')) return formula;

  const expr = formula.slice(1).trim();
  const columnNames = Object.keys(rowData);
  let expression = expr;

  for (const col of columnNames) {
    const regex = new RegExp(`\\b${col}\\b`, 'g');
    const value = rowData[col];
    if (typeof value === 'number') {
      expression = expression.replace(regex, value);
    } else if (typeof value === 'string') {
      expression = expression.replace(regex, `"${value}"`);
    } else if (value === null || value === undefined) {
      expression = expression.replace(regex, 'null');
    } else {
      expression = expression.replace(regex, value);
    }
  }

  try {
    const result = Function(`"use strict"; return (${expression})`)();
    return isNaN(result) ? result : Number(result.toFixed(2));
  } catch (e) {
    console.error('Formula evaluation error:', e);
    return '#ОШИБКА!';
  }
}

export function extractColumnReferences(formula: string): string[] {
  if (!formula || !formula.startsWith('=')) return [];
  const expr = formula.slice(1);
  const columnNames: string[] = [];
  const regex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  let match;
  while ((match = regex.exec(expr)) !== null) {
    if (!['true', 'false', 'null', 'undefined', 'NaN', 'Infinity'].includes(match[1])) {
      columnNames.push(match[1]);
    }
  }
  return [...new Set(columnNames)];
}