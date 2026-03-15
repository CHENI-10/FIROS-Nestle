const zones = [
  {
    id: 'A',
    name: 'Powdered Beverages, Noodles & Seasonings',
    tempMin: 25,
    tempMax: 32,
    humidityMin: 60,
    humidityMax: 70,
    maxSafeTemp: 30,
    maxSafeHumidity: 65
  },
  {
    id: 'B',
    name: 'Dairy & Condensed',
    tempMin: 22,
    tempMax: 28,
    humidityMin: 55,
    humidityMax: 62,
    maxSafeTemp: 27,
    maxSafeHumidity: 60
  },
  {
    id: 'C',
    name: 'Infant & Nutrition',
    tempMin: 20,
    tempMax: 27,
    humidityMin: 50,
    humidityMax: 57,
    maxSafeTemp: 25,
    maxSafeHumidity: 55
  },
  {
    id: 'D',
    name: 'Cold Storage',
    tempMin: 2,
    tempMax: 10,
    humidityMin: null,
    humidityMax: null,
    maxSafeTemp: 10,
    maxSafeHumidity: null
  }
];

module.exports = zones;
