// Stylized approximations, not manufacturer CAD or verified sales rankings.
const car = (id, name, color, length, width, height, style, extra = {}) => ({ id, name, category: 'cars', color, length, width, height, style, ...extra });
const bike = (id, name, color, style, extra = {}) => ({ id, name, category: 'bikes', color, length: 2.05, width: .72, height: 1.15, style, ...extra });
const truck = (id, name, color, style, length = 6.6, extra = {}) => ({ id, name, category: 'vehicles', color, length, width: 2.3, height: 3, style, ...extra });
export const VEHICLES = Object.freeze([
  car('baleno', 'Maruti Suzuki Baleno', '#27a6cf', 3.99, 1.75, 1.5, 'hatch'),
  car('nexon', 'Tata Nexon', '#ec6440', 3.99, 1.81, 1.61, 'crossover', { roof: '#192735' }),
  car('punch', 'Tata Punch', '#ecbb39', 3.83, 1.74, 1.62, 'boxy', { roof: '#24384a' }),
  car('fronx', 'Maruti Suzuki Fronx', '#c94a3a', 3.99, 1.76, 1.55, 'crossover'),
  car('wagon-r', 'Maruti Suzuki Wagon R', '#81baaf', 3.66, 1.62, 1.68, 'tall'),
  car('dzire', 'Maruti Suzuki Dzire', '#e2dfcd', 3.99, 1.73, 1.52, 'sedan'),
  car('creta', 'Hyundai Creta', '#507698', 4.33, 1.79, 1.64, 'suv', { roof: '#dce7e7' }),
  car('swift', 'Maruti Suzuki Swift', '#e83d51', 3.86, 1.73, 1.5, 'hatch', { roof: '#192735' }),
  car('scorpio', 'Mahindra Scorpio', '#3d4942', 4.66, 1.92, 1.88, 'rugged', { spare: true }),
  car('ertiga', 'Maruti Suzuki Ertiga', '#ad8fc1', 4.4, 1.74, 1.69, 'mpv'),
  bike('splendor-plus', 'Hero Splendor Plus', '#a43f42', 'commuter'),
  bike('activa', 'Honda Activa', '#95b5c8', 'scooter'),
  bike('jupiter', 'TVS Jupiter', '#dd9b61', 'scooter', { length: 1.9, roundLight: true }),
  bike('shine', 'Honda Shine', '#394d66', 'commuter', { length: 2.04 }),
  bike('pulsar', 'Bajaj Pulsar', '#df3d48', 'sport'),
  bike('apache', 'TVS Apache', '#e4e7e8', 'sport', { length: 2.1, accent: '#d23c41' }),
  bike('hf-deluxe', 'Hero HF Deluxe', '#358977', 'commuter', { length: 1.96 }),
  bike('classic-350', 'Royal Enfield Classic 350', '#6b7852', 'classic', { length: 2.16, width: .8 }),
  bike('access-125', 'Suzuki Access 125', '#ede2c0', 'scooter', { roundLight: true }),
  bike('xl100', 'TVS XL100', '#4689a1', 'moped', { length: 1.9, width: .66 }),
  car('police-car', 'Police Patrol', '#f0f2ec', 4.5, 1.85, 1.73, 'suv', { category: 'vehicles', emergency: 'police', roof: '#213b52' }),
  bike('police-bike', 'Police Motorcycle', '#f1f0e5', 'classic', { category: 'vehicles', emergency: 'police', length: 2.2 }),
  truck('ambulance', 'Ambulance', '#f4f0df', 'ambulance', 5.6, { emergency: 'medical', height: 2.7 }),
  truck('fire-truck', 'Fire Engine', '#d93e3b', 'fire', 7.2, { emergency: 'fire' }),
  truck('delivery-truck', 'Delivery Truck', '#eeb448', 'box'),
  truck('tipper-truck', 'Tipper Truck', '#e57738', 'tipper', 7),
  truck('tanker-truck', 'Tanker Truck', '#69a8b5', 'tanker', 7.8),
  truck('tractor-trailer', 'Box Semi Trailer', '#4974bd', 'semi-box', 12.8, { articulated: true }),
  truck('flatbed-trailer', 'Flatbed Semi Trailer', '#4e9b87', 'semi-flatbed', 12.8, { articulated: true })
].map(Object.freeze));
export const VEHICLE_IDS = Object.freeze(VEHICLES.map(v => v.id));
export function getVehicleSpec(id) {
  const spec = VEHICLES.find(v => v.id === id);
  if (!spec) throw new RangeError(`Unknown vehicle "${id}". Valid IDs: ${VEHICLE_IDS.join(', ')}`);
  return spec;
}
