// Sistema modular de estrategias
import * as burs from '../method.mjs';

// Registro de estrategias disponibles
const strategies = {
  burs: {
    name: 'BURS ADVISORY',
    description: 'Order Blocks + Confirmaciones',
    findSignals: burs.findSignals,
    buildOrderBlocks: burs.buildOrderBlocks
  }
};

export function getStrategy(name) {
  return strategies[name] || strategies.burs;
}

export function listStrategies() {
  return Object.keys(strategies).map(key => ({
    key,
    ...strategies[key]
  }));
}

export function addStrategy(name, strategy) {
  strategies[name] = strategy;
}
