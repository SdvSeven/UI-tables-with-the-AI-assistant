export const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '—';
    return amount.toLocaleString('ru-RU') + ' ₽';
};

export const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
};

export const formatNumber = (number) => {
    if (number === null || number === undefined) return '—';
    return number.toLocaleString('ru-RU');
};