
export interface CityData {
  p24_id: string;
}

export interface LocationData {
  [cityName: string]: CityData;
}

export interface SouthAfricanLocations {
  [provinceName: string]: LocationData;
}

export const southAfricanLocations: SouthAfricanLocations = {
  'Western Cape': {
    'Somerset West': { p24_id: '390' },
    'Gordons Bay': { p24_id: '395' },
    'Stellenbosch': { p24_id: '389' },
    'Cape Town': { p24_id: '32' },
    'George': { p24_id: '359' },
    'Paarl': { p24_id: '380' },
    'Hermanus': { p24_id: '363' },
  },
  'Gauteng': {
    'Johannesburg': { p24_id: '7' },
    'Pretoria': { p24_id: '9' },
    'Sandton': { p24_id: '71' },
    'Midrand': { p24_id: '61' },
    'Centurion': { p24_id: '10364' },
  },
  'KwaZulu-Natal': {
    'Durban': { p24_id: '22' },
    'Pietermaritzburg': { p24_id: '49' },
    'Umhlanga': { p24_id: '50' },
    'Ballito': { p24_id: '2891' },
  },
  'Eastern Cape': {
    'East London': { p24_id: '133' },
    'Gqeberha (Port Elizabeth)': { p24_id: '159' },
  },
  'Free State': {
    'Bloemfontein': { p24_id: '20' },
  },
  'Limpopo': {
    'Polokwane': { p24_id: '63' },
  },
  'Mpumalanga': {
    'Mbombela (Nelspruit)': { p24_id: '60' },
  },
  'North West': {
    'Rustenburg': { p24_id: '69' },
    'Potchefstroom': { p24_id: '64' },
  },
  'Northern Cape': {
    'Kimberley': { p24_id: '18' },
  },
};

export const provinces = Object.keys(southAfricanLocations);

