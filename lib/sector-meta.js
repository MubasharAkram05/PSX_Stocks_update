// lib/sector-meta.js
// Static, hand-picked sector lookup — purely a helpful starting point
// for grouping, not live financial data. Used once to seed the
// stock_sectors table on first run; after that, sectors are whatever
// was added/edited via the Stocks page.

module.exports = {
  OGDC: 'petroleum', PPL: 'petroleum', POL: 'petroleum', PSO: 'petroleum',
  MARI: 'petroleum', SNGP: 'petroleum', SSGC: 'petroleum', ATRL: 'petroleum', NRL: 'petroleum',

  FFC: 'fertilizer', EFERT: 'fertilizer', ENGRO: 'fertilizer', FATIMA: 'fertilizer', FFBL: 'fertilizer',

  SEARL: 'pharma', GLAXO: 'pharma', HINOON: 'pharma', AGP: 'pharma', IBLHL: 'pharma', HIGHNOON: 'pharma',

  LUCK: 'cement', DGKC: 'cement', MLCF: 'cement', FCCL: 'cement',
  PIOC: 'cement', CHCC: 'cement', KOHC: 'cement', ACPL: 'cement',

  SYS: 'tech', TRG: 'tech', NETSOL: 'tech', AVN: 'tech', PTC: 'tech',

  HUBC: 'power', KAPCO: 'power', KEL: 'power', NPL: 'power',

  ICI: 'chemical', LOTCHEM: 'chemical', EPCL: 'chemical',

  INDU: 'auto', PSMC: 'auto', HCAR: 'auto', MTL: 'auto',

  ISL: 'engineering', ASTL: 'steel',

  MEBL: 'bank', UBL: 'bank', HBL: 'bank', MCB: 'bank', BAHL: 'bank',
  ABL: 'bank', BOP: 'bank', NBP: 'bank', FABL: 'bank', AKBL: 'bank',
};
