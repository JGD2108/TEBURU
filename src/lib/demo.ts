export const isLocalDemo = () => process.env.NEXT_PUBLIC_ENABLE_LOCAL_DEMO === 'true';

export type DemoRole = 'platform' | 'admin' | 'waiter' | 'kitchen' | 'guest';

export const demoMenu = [
  { id: 'arepa', name: 'Arepa de maíz pelao', desc: 'Queso campesino, mantequilla ahumada y hogao.', price: 8.5, cat: 'Recomendados', image: '' },
  { id: 'trucha', name: 'Trucha del día', desc: 'Papas criollas, ensalada de hierbas y limón.', price: 18, cat: 'Principales', image: '' },
  { id: 'ensalada', name: 'Huerta tibia', desc: 'Vegetales asados, semillas y vinagreta cítrica.', price: 11, cat: 'Principales', image: '' },
  { id: 'cacao', name: 'Cacao & sal', desc: 'Crema de cacao, aceite de oliva y sal marina.', price: 7, cat: 'Postres', image: '' },
];

export const demoOrders = [
  { user: 'Lucía', item: 'Arepa de maíz pelao', qty: 1, price: 8.5, item_status: 'preparing', notes: 'Sin cebolla' },
  { user: 'Mateo', item: 'Trucha del día', qty: 1, price: 18, item_status: 'ready', notes: '' },
];
