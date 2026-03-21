import { Faker, ru } from '@faker-js/faker';

const faker = new Faker({ locale: [ru] });

const REGIONS = ['Москва', 'Санкт-Петербург', 'Казань', 'Новосибирск', 'Екатеринбург'];
const CATEGORIES = ['Электроника', 'Смартфоны', 'Аксессуары', 'Одежда', 'Дом и сад'];
const PAYMENT_METHODS = ['Банковская карта', 'Наличные', 'Онлайн-платеж'];
const PRODUCTS: Record<string, string[]> = {
  'Электроника': ['Ноутбук Lenovo', 'Монитор Dell', 'Планшет Samsung', 'Ноутбук Asus', 'Монитор LG'],
  'Смартфоны': ['iPhone 14', 'Xiaomi Mi 11', 'Google Pixel 7', 'Samsung Galaxy S23'],
  'Аксессуары': ['Наушники Sony', 'Клавиатура Logitech', 'Мышь Logitech', 'Чехол для телефона'],
  'Одежда': ['Футболка', 'Джинсы', 'Куртка', 'Кроссовки'],
  'Дом и сад': ['Стул', 'Стол', 'Лампа', 'Горшок для цветов']
};

export function generateMockSalesChunk(startId: number, batchSize: number) {
  const data: any[] = [];
  const startDate = new Date('2023-01-01');
  const endDate = new Date('2024-12-31');

  for (let i = 0; i < batchSize; i++) {
    const id = startId + i;
    const category = faker.helpers.arrayElement(CATEGORIES);
    const productName = faker.helpers.arrayElement(PRODUCTS[category]);
    const quantity = faker.number.int({ min: 1, max: 10 });
    const price = faker.number.float({ min: 500, max: 100000, fractionDigits: 2 });
    const discount = faker.number.float({ min: 0, max: 30, fractionDigits: 1 });
    const revenue = quantity * price * (1 - discount / 100);

    data.push({
      id,
      sale_date: faker.date.between({ from: startDate, to: endDate }).toISOString().split('T')[0],
      region: faker.helpers.arrayElement(REGIONS),
      product_category: category,
      product_name: productName,
      quantity,
      price,
      revenue,
      customer_id: faker.number.int({ min: 1000, max: 100000 }),
      payment_method: faker.helpers.arrayElement(PAYMENT_METHODS),
      discount,
      extra_attributes: {
        brand: faker.company.name(),
        color: faker.color.human(),
        rating: faker.number.float({ min: 3, max: 5, fractionDigits: 1 })
      }
    });
  }
  return data;
}