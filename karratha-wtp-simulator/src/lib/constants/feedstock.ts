/**
 * FEEDSTOCK TYPES & TRANSPORT DESTINATIONS
 * =========================================
 * Constants for oil feedstock classification and transport cost calculations
 */

export interface FeedstockType {
  id: string;
  name: string;
  oilContent: number;      // % typical oil content
  solidsContent: number;   // % typical solids
  oilValue: number;        // $/m³ recovered oil value
  description: string;
  color: string;
}

export interface TransportDestination {
  id: string;
  name: string;
  cost: number;            // $/m³ transport cost
  distance: string;
}

export const FEEDSTOCK_TYPES: Record<string, FeedstockType> = {
  washWater: {
    id: 'washWater',
    name: 'Wash Water',
    oilContent: 2.5,
    solidsContent: 1.5,
    oilValue: 350,
    description: 'Equipment/tank wash water - lower grade oil',
    color: 'text-blue-400',
  },
  refinerySlop: {
    id: 'refinerySlop',
    name: 'Refinery Slop Oil',
    oilContent: 8.0,
    solidsContent: 3.0,
    oilValue: 450,
    description: 'Refinery process water/slop - medium grade',
    color: 'text-purple-400',
  },
  tankBottoms: {
    id: 'tankBottoms',
    name: 'Tank Bottoms',
    oilContent: 15.0,
    solidsContent: 8.0,
    oilValue: 280,
    description: 'Storage tank bottoms - high solids, lower value',
    color: 'text-orange-400',
  },
  producedWater: {
    id: 'producedWater',
    name: 'Produced Water',
    oilContent: 1.5,
    solidsContent: 0.5,
    oilValue: 400,
    description: 'Oilfield produced water - low oil, premium treatment',
    color: 'text-cyan-400',
  },
  lightCrude: {
    id: 'lightCrude',
    name: 'Light Crude Emulsion',
    oilContent: 25.0,
    solidsContent: 2.0,
    oilValue: 520,
    description: 'Light crude emulsion - high value recovery',
    color: 'text-amber-400',
  },
  heavyCrude: {
    id: 'heavyCrude',
    name: 'Heavy Crude Emulsion',
    oilContent: 20.0,
    solidsContent: 5.0,
    oilValue: 380,
    description: 'Heavy crude emulsion - harder separation',
    color: 'text-red-400',
  },
};

export const TRANSPORT_DESTINATIONS: Record<string, TransportDestination> = {
  kalgoorlie: {
    id: 'kalgoorlie',
    name: 'Kalgoorlie Refinery',
    cost: 220,
    distance: '1,200 km',
  },
  perth: {
    id: 'perth',
    name: 'Perth (Kwinana)',
    cost: 280,
    distance: '1,500 km',
  },
  local: {
    id: 'local',
    name: 'Local Processing',
    cost: 80,
    distance: '< 50 km',
  },
  export: {
    id: 'export',
    name: 'Port Hedland (Export)',
    cost: 150,
    distance: '240 km',
  },
};

// Default operating costs
export const DEFAULT_COSTS = {
  elec: 0.34,              // $/kWh
  sludgeDisposal: 270,     // $/m³
  waterTreatment: 3.5,     // $/m³
  oilValue: 450,           // $/m³ (from feedstock)
  oilTransport: 220,       // $/m³ (from destination)
  pondDisposal: 3.5,       // $/m³
  laborRate: 140,          // $/hour
};
