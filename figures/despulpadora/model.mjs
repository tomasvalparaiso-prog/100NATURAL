// Modelo de la despulpadora. 1 unidad del dibujo = 4 mm.
const UNIT_MM = 4;
const motorPulleyR = 8; // 64 mm de diámetro
const rotorPulleyR = 26; // 208 mm de diámetro
const tipR = 31; // radio de la punta de las paletas: 124 mm

export const MODEL = {
  motorRpm50: 2880, // motor de 2 polos, 50 Hz, con deslizamiento nominal
  motorPulleyR,
  rotorPulleyR,
  motorPulleyMm: 2 * motorPulleyR * UNIT_MM,
  rotorPulleyMm: 2 * rotorPulleyR * UNIT_MM,
  ratio: rotorPulleyR / motorPulleyR,
  tipR,
  tipM: (tipR * UNIT_MM) / 1000,
  slow: 30, // las paletas se dibujan 30 veces más lentas
};
