-- Fix district localities to match actual Malta electoral boundaries
-- Source: Electoral Districts of Malta (Wikipedia / Electoral Commission)

UPDATE districts SET localities = ARRAY[
  'Valletta', 'Floriana', 'Ħamrun', 'Marsa', 'Pietà', 'Santa Venera', 'Fleur-de-Lys'
] WHERE id = 1;

UPDATE districts SET localities = ARRAY[
  'Birgu (Vittoriosa)', 'Senglea (L-Isla)', 'Bormla (Cospicua)',
  'Żabbar', 'Kalkara', 'Xgħajra', 'Fgura'
] WHERE id = 2;

UPDATE districts SET localities = ARRAY[
  'Żejtun', 'Għaxaq', 'Marsaskala', 'Marsaxlokk'
] WHERE id = 3;

UPDATE districts SET localities = ARRAY[
  'Paola', 'Tarxien', 'Santa Luċija', 'Gudja', 'Fgura'
] WHERE id = 4;

UPDATE districts SET localities = ARRAY[
  'Birżebbuġa', 'Żurrieq', 'Qrendi', 'Kirkop', 'Safi', 'Imqabba'
] WHERE id = 5;

UPDATE districts SET localities = ARRAY[
  'Qormi', 'Luqa', 'Siġġiewi', 'Farruġ'
] WHERE id = 6;

UPDATE districts SET localities = ARRAY[
  'Rabat', 'Mdina', 'Dingli', 'Żebbuġ', 'Mtarfa'
] WHERE id = 7;

UPDATE districts SET localities = ARRAY[
  'Birkirkara', 'Lija', 'Balzan', 'Iklin', 'Naxxar'
] WHERE id = 8;

UPDATE districts SET localities = ARRAY[
  'Msida', 'San Ġwann', 'Swieqi', 'Ta'' Xbiex', 'Pietà', 'Għargħur'
] WHERE id = 9;

UPDATE districts SET localities = ARRAY[
  'Sliema', 'San Ġiljan', 'Gżira', 'Pembroke', 'Baħar iċ-Ċagħaq', 'Naxxar'
] WHERE id = 10;

UPDATE districts SET localities = ARRAY[
  'Mosta', 'Attard'
] WHERE id = 11;

UPDATE districts SET localities = ARRAY[
  'Mellieħa', 'Mġarr', 'San Pawl il-Baħar'
] WHERE id = 12;

UPDATE districts SET localities = ARRAY[
  'Victoria (Rabat)', 'Fontana', 'Għajnsielem', 'Kerċem', 'Munxar',
  'Nadur', 'Qala', 'Sannat', 'Xagħra', 'Xewkija',
  'Żebbuġ', 'Għarb', 'Għasri', 'San Lawrenz'
] WHERE id = 13;
