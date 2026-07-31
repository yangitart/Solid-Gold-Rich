import { extendLimits, fmtNum } from "@/src/core/utils/numberUtils";

// ── Mapa ──────────────────────────────────────────────────────────────────────
export const GRID_W = 48;
export const GRID_H = 48;
export const CELL = 48;

export const START_BUILDERS = 1;
export const BUILDER_BASE_SPEED = 0.8;  // celdas/s base (lento, como un carrito)
export const CLEAR_RADIUS = 5;
// 1 hora (a pedido, antes 2): tope de tiempo idle que la colonia sigue
// produciendo con la app cerrada — más que esto no acumula.
export const MAX_OFFLINE_MS = 1 * 60 * 60 * 1000;
export const OFFLINE_REPORT_MIN = 60 * 1000;
export const AGENT_MAX_DT = 200;

export const DAILY_REWARD_MS = 24 * 60 * 60 * 1000;
// Solo monedas/recursos "core" (nunca crudos/refinados de producción) — energía,
// agua, oxígeno, créditos y gemas.
export const DAILY_REWARD = { gems: 3, energy: 100, water: 50, oxygen: 50, credits: 100 };

export const BOOST_MS = 30 * 60 * 1000;
export const BOOST_COST_GEMS = 2;
export const BOOST_MULT = 2;

// Boosts DE UN edificio (se elige cuál, en la Tienda): 15 min, dinero — velocidad
// x2 de ciclo, o consumo de energía cero (y de paso no exige cable mientras dure).
export const BUILDING_BOOST_MS = 15 * 60 * 1000;
export const BUILDING_BOOST_SPEED_MULT = 2;
export const BUILDING_SPEED_BOOST_COST_GEMS = 3;
export const BUILDING_POWER_BOOST_COST_GEMS = 3;

// ── Boost de CLICK (tap-tap sobre la máquina, en la vista ESTRUCTURA) ─────────
// Machacar la máquina la apura un poquito MIENTRAS le des: cada toque suma un
// escalón y la racha se cae sola poco después del último. Es un empujón de
// atención, no una fuente de producción: por eso el escalón es chico y el tope
// bajo — no puede competir con mejorar el edificio ni con el boost de la Tienda
// (x2). Lo que apura es lo que ESE edificio haga (su ciclo), así que vale igual
// para una perforadora que para una fundición.
export const CLICK_BOOST_STEP = 0.03;      // +3 % de velocidad de ciclo por escalón
export const CLICK_BOOST_MAX_TAPS = 10;    // tope de racha de fábrica: +30 %
// La racha SE DRENA SOLA, en escalones por segundo. Es lo que obliga a apretar
// rápido: cada toque suma 1, y mientras tanto el drenaje resta. Con una ventana
// fija (la primera versión) alcanzaba con dar 10 toques sin apuro y después uno
// cada dos segundos para quedarse clavado en el tope — no había pulso.
// El drenaje es ALTO a propósito: llegar al tope tiene que costar de verdad y
// no se puede sostener distraído.
//   · por debajo de 4 toques/s la racha BAJA (no alcanza ni para sostenerla)
//   · a ~5/s sube despacio: el tope está lejos y hay que aguantar el ritmo
//   · a ~8/s (machaque real) el tope llega en unos 2,5 s — y se cae en menos
//     de 3 s de soltar
export const CLICK_BOOST_DECAY_PER_S = 4;
// Cada nivel de la mejora "Boost de Click" sube el TOPE de la racha. El escalón
// por toque no cambia: lo que crece es hasta dónde puede llegar esa racha.
export const CLICK_BOOST_TAPS_PER_LEVEL = 4;
// El COHETE no tiene ciclo de producción que apurar, pero sí un viaje: cada
// toque le recorta esto al aterrizaje. Es deliberadamente poco (hay que
// machacar un rato para notarlo) — apurar un viaje EN SERIO sigue costando
// gemas (ver hurryTrade).
export const CLICK_TRADE_SHAVE_MS = 250;
export function getClickBoostMaxTaps(clickLevel: number): number {
  return CLICK_BOOST_MAX_TAPS + Math.max(0, clickLevel - 1) * CLICK_BOOST_TAPS_PER_LEVEL;
}
// Racha VIVA en este instante: lo que quedaba menos lo que se drenó desde el
// último toque. Se calcula con el reloj (no con un temporizador propio), así que
// el tick de producción y la UI leen exactamente el mismo número sin coordinarse.
export function clickBoostHeat(run: { taps: number; at: number } | undefined, now: number): number {
  if (!run) return 0;
  return Math.max(0, run.taps - ((now - run.at) / 1000) * CLICK_BOOST_DECAY_PER_S);
}
// Multiplicador de velocidad de una racha. `heat` es fraccionario (se drena de
// continuo), así que el multiplicador sube y baja suave en vez de a saltos.
export function clickBoostMult(heat: number, clickLevel: number): number {
  return 1 + Math.min(heat, getClickBoostMaxTaps(clickLevel)) * CLICK_BOOST_STEP;
}

// Crudos: extraídos del suelo.  Refinados: procesados en edificios. Componentes: fabricados.
export type RawResource =
  | 'mineral' | 'dirt' | 'silicon' | 'copper' | 'titanium' | 'carbon' | 'water' | 'brine'
  | 'aluminum' | 'sulfur' | 'gold' | 'uranium' | 'crystal' | 'helium3';
export type RefinedResource =
  | 'steel' | 'glass' | 'wire' | 'oxygen' | 'credits'
  | 'plastic' | 'ceramic' | 'acid' | 'fuel' | 'alloy' | 'ceramium' | 'blocks'
  // Intermedios de la refinería (crudo → intermedio) — la FUNDICIÓN los
  // convierte en el refinado final (steel/glass/wire/alloy) que ya existía; cada
  // uno menos el acero pide su módulo de material instalado.
  | 'ironore' | 'silicaore' | 'copperore' | 'bauxite';

// Componentes: piezas que se fabrican en los constructores y se INSTALAN en los
// slots de los edificios (cohete y bases) para mejorarlos. Los `module_*` son
// distintos: no dan bono, son la "broca" que especializa una Perforadora — sin
// el módulo correcto instalado, la Perforadora no produce nada (ver
// MODULE_CATALOG y moduleFitsBuilding).
export type OreModule = 'module_silicon' | 'module_copper' | 'module_carbon' | 'module_aluminum'
  | 'module_titanium' | 'module_sulfur' | 'module_gold' | 'module_uranium' | 'module_crystal' | 'module_helium';
// Módulos de material (especializan la Fábrica: sin uno de estos produce según
// su cola de recetas, con uno instalado produce SOLO ese material) y módulos de
// ciencia (especializan el Laboratorio, mismo patrón) — misma filosofía de
// "llave sin bono" que los OreModule de la Perforadora.
export type FactoryModule = 'module_glass' | 'module_wire' | 'module_alloy';
export type LabModule = 'module_sci_fluid' | 'module_sci_gas' | 'module_sci_energy' | 'module_sci_exotic';
export type ComponentResource = 'circuit' | 'servo' | 'sensor' | 'core' | 'coolant' | 'capacitor' | 'reactor' | 'antenna' | 'lamp' | OreModule | FactoryModule | LabModule;
export type EnergyResource = 'energy';

// CINCO ciencias, una por tipo de laboratorio: cada rama del árbol de investigación
// se paga con SU ciencia — para avanzar una rama necesitas el laboratorio que la produce.
export type ScienceResource = 'research' | 'sci_fluid' | 'sci_gas' | 'sci_energy' | 'sci_exotic';
export type SpecialResource = ScienceResource;
export type ResourceType = EnergyResource | RawResource | RefinedResource | ComponentResource | SpecialResource;

export const RAW_RESOURCES: RawResource[] = ['mineral', 'dirt', 'silicon', 'copper', 'titanium', 'carbon', 'water', 'brine', 'aluminum', 'sulfur', 'gold', 'uranium', 'crystal', 'helium3'];
export const REFINED_RESOURCES: RefinedResource[] = ['steel', 'glass', 'wire', 'oxygen', 'credits', 'plastic', 'ceramic', 'acid', 'fuel', 'alloy', 'ceramium', 'blocks', 'ironore', 'silicaore', 'copperore', 'bauxite'];
export const ORE_MODULES: OreModule[] = ['module_silicon', 'module_copper', 'module_carbon', 'module_aluminum', 'module_titanium', 'module_sulfur', 'module_gold', 'module_uranium', 'module_crystal', 'module_helium'];
export const FACTORY_MODULES: FactoryModule[] = ['module_glass', 'module_wire', 'module_alloy'];
export const LAB_MODULES: LabModule[] = ['module_sci_fluid', 'module_sci_gas', 'module_sci_energy', 'module_sci_exotic'];
export const COMPONENT_RESOURCES: ComponentResource[] = ['circuit', 'servo', 'sensor', 'core', 'coolant', 'capacitor', 'reactor', 'antenna', 'lamp', ...ORE_MODULES, ...FACTORY_MODULES, ...LAB_MODULES];
export const SCIENCE_RESOURCES: ScienceResource[] = ['research', 'sci_fluid', 'sci_gas', 'sci_energy', 'sci_exotic'];
export const RESOURCE_ORDER: ResourceType[] = ['energy', ...RAW_RESOURCES, ...REFINED_RESOURCES, ...COMPONENT_RESOURCES, ...SCIENCE_RESOURCES];

// ── Descubrimiento de recursos ────────────────────────────────────────────────
// Un recurso "gated" solo aparece en la pestaña Recursos una vez que el jugador
// tuvo ≥1 unidad alguna vez (minado, refinado, fabricado, botín…). Energía e
// investigación quedan EXENTAS (monedas core, siempre visibles en el HUD).
export type GatedResource = RawResource | RefinedResource | ComponentResource;
export const GATED_RESOURCES: GatedResource[] = [...RAW_RESOURCES, ...REFINED_RESOURCES, ...COMPONENT_RESOURCES];

// ── Comercio (cohete de carga) ─────────────────────────────────────────────────
// Precio en CRÉDITOS por unidad al vender vía el cohete. 'credits' queda fuera
// (no tiene sentido venderlos por sí mismos). Escalado por tier: crudos baratos,
// refinados intermedios, componentes los más valiosos.
// COHERENCIA con las recetas: el precio de cada producto es SIEMPRE mayor que el
// valor de venta de sus insumos (procesar nunca pierde dinero). Ej.: 1 bloque =
// 50 tierra (50 créditos de insumo) → se vende a 60; 2 menas de hierro = 50
// mineral (50) → 30 c/u; 2 aceros = 4 menas (120) → 70 c/u; y así en cascada
// hasta los componentes. Si cambias una receta, revisa la cadena completa.
export const SELL_PRICE: Partial<Record<GatedResource, number>> = {
  mineral: 1, dirt: 1, silicon: 2, copper: 2, titanium: 4, carbon: 2, water: 1, brine: 3,
  aluminum: 3, sulfur: 3, gold: 8, uranium: 12, crystal: 15, helium3: 18,
  steel: 70, glass: 140, wire: 65, oxygen: 2, alloy: 200, blocks: 60,
  // Química y cerámica (acto II). Los precios viejos (plastic 5, ceramic 5,
  // acid 6, fuel 8, ceramium 36) venían de cuando NADA los producía y no había
  // receta contra la cual cuadrarlos: eran una pérdida enorme frente a sus
  // insumos (la cerámica sale de sílice refinada, que vale 60). Recalculados
  // con la regla de siempre — cada producto vale más que sus insumos — sabiendo
  // que una receta tiene UN SOLO insumo (ver `Recipe`):
  acid: 20,       // 4 azufre (12) → 2 ácidos: 6 de insumo c/u
  plastic: 55,    // 3 ácido (60) → 2 plásticos: 30 c/u
  fuel: 75,       // 4 ácido (80) → 2 combustibles: 40 c/u
  ceramic: 110,   // 2 sílice refinada (120) → 2 cerámicas: 60 c/u
  ceramium: 380,  // 4 cerámica (440) → 2 ceramium: 220 c/u   [acto III]
  ironore: 30, silicaore: 60, copperore: 40, bauxite: 90,
  circuit: 320, servo: 230, sensor: 720,
  lamp: 260,      // 3 vidrios (420) — se vende por DEBAJO del insumo a propósito:
                  // el foco es para usar, no para revender vidrio caro.
  // Módulos de bono: mismo problema que arriba — valían 20-45 cuando nadie los
  // fabricaba, o sea muchísimo MENOS que sus insumos. El Núcleo es el más caro
  // de todos porque es el que más cambia la partida (+50% de producción).
  antenna: 900,   // 2 circuitos (640)
  capacitor: 350, // 4 plásticos (220)
  coolant: 550,   // 4 combustibles (300)
  reactor: 800,   // 4 cerámicas (440)
  core: 2200,     // 4 circuitos (1280)
};
// CONSUMO DEL COHETE. Antes esto era un coste POR LANZAMIENTO que escalaba con
// el peso de la carga, y estaba mal por dos motivos: pedia muchisimo (con 100
// unidades se iba a cientos de energia) y, sobre todo, cuanto MAS cargabas mas
// te faltaba — o sea que llenar la bodega te alejaba de poder despegar, justo al
// reves de lo que uno espera.
//
// Ahora el cohete gasta como CUALQUIER OTRO EDIFICIO: un poquito por ciclo,
// siempre, mientras este conectado. La base da 10 de energia, asi que 1 es un
// gasto que se nota sin ahogar. Y al ser consumo normal aparece solo en las
// vistas de corriente/agua/gas, igual que el resto — que era la otra queja.
// Cada cuanto se cobra el mantenimiento del cohete.
export const ROCKET_UPKEEP_MS = 6_000;
export const ROCKET_UPKEEP_ENERGY = 1;
export const ROCKET_UPKEEP_WATER = 1;
export const ROCKET_UPKEEP_OXYGEN = 1;

export const TRADE_MS = 120_000; // 2 minutos de viaje ida y vuelta (base, antes de mejorar)
// Entre más carga lleve el cohete, más tarda. Antes esto era casi invisible en
// la práctica (15 ms/unidad, tope de 1 min a las 4000 unidades — una carga
// normal de unas pocas centenas apenas movía la aguja). Ahora una carga típica
// (algunos cientos de unidades) sí se nota, y el tope de la bodega llega antes.
// Demora extra por unidad de carga. YA NO tiene techo: la bodega no tiene tope
// de unidades (a pedido), así que el peso es lo ÚNICO que equilibra llevar
// mucho de una — con un tope de demora, pasado cierto punto cargar de más sería
// gratis. Cargar a tope = más plata por viaje, pero menos viajes por hora.
export const CARGO_WEIGHT_MS_PER_UNIT = 100;
// Bodega: se ARRANCA con 2 compartimentos, uno por recurso distinto y SIN tope
// de unidades — lo que limita es cuántos recursos DIFERENTES podés llevar en un
// viaje (y el peso, que alarga el viaje). Antes eran 6 slots y 50 unidades por
// slot: el tope de 50 solo obligaba a repetir el gesto de cargar, no era una
// decisión. Con 2 compartimentos la decisión es QUÉ llevar, y mejorar la bodega
// se siente de verdad.
export const TRADE_SLOTS = 2;

// Mejoras del COHETE (independientes de las de ALMACÉN speed/eff/slot de cualquier
// edificio): velocidad de viaje (acorta TRADE_MS) y capacidad de bodega (más
// TRADE_SLOTS). Solo dinero por ahora, igual que el resto de mejoras.
export type TradeUpgradeKind = 'tradeSpeed' | 'cargoSlot';

// ── Edificios ────────────────────────────────────────────────────────────────
export type BuildingType =
  | 'base'
  | 'rocket'
  | 'collector'
  // Perforadora: UN solo edificio de extracción de veta sólida — antes eran
  // 11 tipos separados (drill/silicon_drill/copper_drill/titanium_drill/
  // carbon_collector/aluminum_drill/sulfur_extractor/gold_drill/uranium_drill/
  // crystal_drill/helium_harvester). Extrae mineral (hierro) de fábrica; para
  // cualquier otra veta necesita el módulo correspondiente instalado (ver
  // ORE_MODULE_FOR_RESOURCE en gridConstants.ts).
  | 'perforadora'
  | 'water_pump'
  | 'brine_pump'
  | 'oxygen_generator'
  | 'gas_tank'
  | 'refinery'
  | 'block_printer'
  | 'smelter'
  | 'power_plant'
  | 'battery'
  | 'warehouse'
  // Fábricas: las constructoras de MÓDULOS del juego (cola de recetas, como
  // la vieja Constructora de Componentes), repartidas en TRES tiers para que
  // ninguna tenga 17 recetas: T1 (rango 4) los peldaños de arranque, T2
  // Avanzada (rango 7) el tramo medio, T3 Exótica (rango 9) el final. Los
  // módulos de VETA se instalan en la Perforadora, los de MATERIAL en la
  // Fundición (agregan Vidrio/Cables/Aleación como receta más de su cola —
  // ver SMELTER_RECIPE_MODULE) y los de CIENCIA en el Laboratorio.
  | 'fabrica'
  | 'fabrica_avanzada'
  | 'fabrica_exotica'
  // Laboratorio: reemplaza Laboratorio base + de Fluidos/Gases/Energético/
  // Exótico. Sin módulo produce investigación (research); con un módulo de
  // ciencia instalado produce esa ciencia especializada en su lugar (ver
  // LABORATORIO_MODULE_RECIPE).
  | 'laboratorio'
  // Se PODARON los edificios avanzados (taller/ensambladora/planta de sensores/
  // forja de núcleos/polímeros/cerámica/química/combustible/moneda/refrigerante/
  // capacitores/reactores/ceramium/lab cuántico) — mareaban con contenido a
  // medio definir; se irán reintroduciendo de a poco. En su lugar:
  // - fábrica de electrónica: componentes chicos (circuito/servo/sensor) a
  //   partir del Sílice refinado.
  | 'electronics_factory'
  // ── ACTO II (rangos 11-20): química y componentes de bono ──────────────────
  // Estos cinco resucitan contenido que ya estaba en el modelo de datos pero no
  // tenía QUIÉN lo produjera: los materiales `acid`/`ceramic`/`plastic`/`fuel`
  // (tipos completos, con ícono, color y precio, imposibles de conseguir) y los
  // 5 módulos de bono de MODULE_CATALOG (Núcleo +50% producción, Refrigerante,
  // Capacitor, Reactor, Antena), que eran instalables e infabricables.
  | 'chemical_plant'
  | 'ceramic_kiln'
  | 'polymer_plant'
  | 'fuel_plant'
  | 'assembler'
  // Panel solar: la forma REAL de generar electricidad en Marte al principio
  // (es lo que llevaban Spirit, Opportunity e InSight). Barato y sin insumos,
  // pero de noche da CERO — y la noche marciana es larga y helada. Es la pieza
  // que convierte el ciclo de día en una decisión: paneles + batería para
  // cruzar la noche, o quemar combustible en la central.
  | 'solar_panel'
  // Torre de Luz: ilumina su zona de noche. Basica y de las primeras — sin ella
  // la noche te encierra en el radio del cohete y la base, y no hay forma de
  // seguir construyendo. Gasta casi nada de energia porque es una lampara, no
  // una maquina.
  | 'light_tower';

// Depósitos: cada tipo produce un recurso crudo concreto.
export type DepositType =
  | 'ore' | 'silicon_ore' | 'copper_ore' | 'titanium_ore' | 'carbon' | 'water' | 'brine'
  | 'aluminum_ore' | 'sulfur_ore' | 'gold_ore' | 'uranium_ore' | 'crystal_vein' | 'helium_crater';
export const DEPOSIT_RESOURCE: Record<DepositType, RawResource> = {
  ore: 'mineral', silicon_ore: 'silicon', copper_ore: 'copper',
  titanium_ore: 'titanium', carbon: 'carbon', water: 'water', brine: 'brine',
  aluminum_ore: 'aluminum', sulfur_ore: 'sulfur', gold_ore: 'gold', uranium_ore: 'uranium',
  crystal_vein: 'crystal', helium_crater: 'helium3',
};

// Las 11 vetas SÓLIDAS donde se puede parar una Perforadora (agua/salmuera
// quedan afuera — esas siguen siendo bombas, mecánica de tubería aparte).
export const PERFORADORA_DEPOSITS: DepositType[] = [
  'ore', 'silicon_ore', 'copper_ore', 'titanium_ore', 'carbon',
  'aluminum_ore', 'sulfur_ore', 'gold_ore', 'uranium_ore', 'crystal_vein', 'helium_crater',
];
// Mena de hierro (mineral) es GRATIS — la Perforadora la extrae de fábrica, sin
// módulo (mismo trato que el 'drill' original: sin tech, sin costo extra).
// El resto de las vetas exige tener el módulo correspondiente INSTALADO — sin
// él, la Perforadora se queda sin producir nada (ver tickProduction).
export const ORE_MODULE_FOR_RESOURCE: Partial<Record<RawResource, OreModule>> = {
  silicon: 'module_silicon', copper: 'module_copper', carbon: 'module_carbon',
  aluminum: 'module_aluminum', titanium: 'module_titanium', sulfur: 'module_sulfur',
  gold: 'module_gold', uranium: 'module_uranium', crystal: 'module_crystal', helium3: 'module_helium',
};
// Mismos números que tenían los 11 edificios de extracción originales — la
// consolidación no cambia el ritmo de producción, solo cómo se desbloquea.
export const ORE_DRILL_AMOUNT: Partial<Record<RawResource, number>> = {
  mineral: 4, silicon: 3, copper: 3, carbon: 2, aluminum: 2, titanium: 1,
  sulfur: 2, gold: 1, uranium: 1, crystal: 1, helium3: 1,
};

// 'dune' se repite para que salga con más frecuencia que el resto (es solo arena
// del mismo suelo, así que abunda más que las rocas/cráteres/escoria).
export const TERRAIN_TYPES: TerrainType[] = ['mountain', 'rock', 'ice', 'dune', 'dune', 'dune', 'crater', 'debris', 'ridge', 'slag', 'permafrost'];

// Sesgo de recursos por planeta: multiplica cuántos clústeres de cada veta aparecen,
// para que viajar se sienta distinto (no solo un mapa nuevo con lo mismo de siempre).
export const PLANET_DEPOSIT_BIAS: Record<Planet, Partial<Record<DepositType, number>>> = {
  mars: {},
  moon: { water: 2, brine: 1.6, aluminum_ore: 0.6, copper_ore: 0.6, gold_ore: 0.5 },
  mercury: { copper_ore: 1.8, gold_ore: 1.8, titanium_ore: 1.6, aluminum_ore: 1.4, water: 0.2, brine: 0.3 },
  venus: { sulfur_ore: 2.2, carbon: 1.6, uranium_ore: 0.5, water: 0.4, silicon_ore: 0.7 },
  earth: { water: 1.4, carbon: 1.4, silicon_ore: 1.3, ore: 1.2, brine: 1.2 },
};

// Categorías de edificios para agrupar la tienda del Constructor.
export type BuildingCategory = 'extraction' | 'energy' | 'life' | 'logistics' | 'research' | 'components';
// 'energy' y 'life' EXISTÍAN en el tipo pero no las usaba ningún edificio: los
// 19 que no eran extracción/investigación estaban amontonados en 'logistics'.
// Resultado: una sección enorme e imposible de barrer, y el resto medio vacías.
// Repartidas quedan parejas — 4 extracción, 4 energía, 3 soporte, 9 proceso,
// 5 componentes, 1 investigación — y de paso los módulos apuntan mejor
// (`appliesTo`: el capacitor dice "baterías/almacenes" y ahora eso ES
// energy+life; el refrigerante dice "procesos de calor" y eso ES logistics).
export const BUILDING_CATEGORIES: { key: BuildingCategory; name: string; icon: string }[] = [
  { key: 'extraction', name: 'Extracción', icon: 'pickaxe' },
  { key: 'energy', name: 'Energía', icon: 'lightning-bolt' },
  { key: 'life', name: 'Soporte y almacén', icon: 'warehouse' },
  { key: 'logistics', name: 'Proceso', icon: 'factory' },
  // 'components' EXISTÍA como categoría (varios módulos la listan en su
  // `appliesTo`) pero no estaba acá, así que ningún edificio podía usarla sin
  // volverse invisible en el Constructor. Con el acto II ya son dos edificios
  // —Electrónica y Ensambladora— y merecen su propia pestaña en vez de engordar
  // Logística, que ya tiene una docena.
  { key: 'components', name: 'Componentes', icon: 'chip' },
  { key: 'research', name: 'Investigación', icon: 'flask' },
];

export interface ResourceFlow { resource: ResourceType; amount: number }

export interface BuildingDef {
  type: BuildingType;
  name: string;
  description: string;
  icon: string;
  buildCost: number;
  buildMs: number;
  cycleMs: number;
  input?: ResourceFlow;
  output?: ResourceFlow;
  powerUse: number;
  needsPower: boolean;
  needsRoad: boolean;
  needsPipe: boolean;
  needsGas?: boolean;
  // Puerto de gas OPCIONAL: a diferencia de `needsGas` (obligatorio, detiene la
  // producción si no está conectado), `gasPort` solo habilita el conector/marcador
  // en la vista de gas y la membresía en circuitos — nunca bloquea nada por sí
  // solo. Pensado para edificios con `gasBoost` que quieran un gasoducto realmente
  // tendido (no solo el pozo global) sin exigirlo para funcionar.
  gasPort?: boolean;
  bonusOutput?: ResourceFlow;
  extraOutputs?: ResourceFlow[];
  // Bono OPCIONAL de gasoducto: si está conectado y hay oxígeno suficiente para
  // TODOS los ciclos del tick, multiplica la producción — nunca bloquea si falta
  // (a diferencia de `needsGas`, que si es obligatorio SÍ detiene la producción).
  gasBoost?: { mult: number; oxygenPerCycle: number };
  requiresDeposit?: DepositType;
  // Como `requiresDeposit` pero acepta CUALQUIERA de una lista (solo lo usa la
  // Perforadora — se puede parar sobre cualquier veta sólida; QUÉ extrae ahí
  // depende del módulo instalado, no de este campo).
  requiresDepositOneOf?: DepositType[];
  storage?: { kind: 'energy' | 'goods' | 'gas'; amount: number };
  upgradeCostBase: number;
  upgradeMultiplier: number;
  sellable: boolean;
  buildable: boolean;
  category: BuildingCategory;
}

// Las 3 mejoras del edificio se cotizan por separado (misma curva base, con un
// factor distinto por tipo) — todas cuestan dinero por ahora, recursos a futuro.
export type UpgradeKind = 'speed' | 'eff' | 'slot' | 'click';
export const UPGRADE_KIND_COST_MULT: Record<UpgradeKind, number> = { speed: 1, eff: 0.85, slot: 1.4, click: 0.7 };

// ── Recetas asignables ───────────────────────────────────────────────────────
// Algunos edificios "de proceso" (refinería, fundición, taller…) permiten ELEGIR
// qué producen. Cada edificio colocado guarda su receta activa (`recipe`).
export interface Recipe { id: string; name: string; icon: string; input?: ResourceFlow; output: ResourceFlow }
export const BUILDING_RECIPES: Partial<Record<BuildingType, Recipe[]>> = {
  // La refinería REFINA (te da el material refinado), no vende nada — para vender
  // (convertir en créditos) usa la Casa de Moneda (oro→créditos).
  refinery: [
    { id: 'iron',     name: 'Refinar hierro',   icon: 'diamond-stone',  input: { resource: 'mineral', amount: 50 },  output: { resource: 'ironore', amount: 2 } },
    { id: 'silicon',  name: 'Refinar sílice',   icon: 'grain',          input: { resource: 'silicon', amount: 50 },  output: { resource: 'silicaore', amount: 2 } },
    { id: 'copper',   name: 'Refinar cobre',    icon: 'circle-slice-8', input: { resource: 'copper', amount: 50 },   output: { resource: 'copperore', amount: 3 } },
    { id: 'aluminum', name: 'Refinar aluminio', icon: 'cube-outline',   input: { resource: 'aluminum', amount: 50 }, output: { resource: 'bauxite', amount: 2 } },
  ],
  block_printer: [
    { id: 'blocks', name: 'Bloques de construcción', icon: 'wall', input: { resource: 'dirt', amount: 50 }, output: { resource: 'blocks', amount: 1 } },
  ],
  // Acero: receta LIBRE (siempre disponible, sin módulo). Vidrio/Cables/
  // Aleación se SUMAN a esta misma cola cuando su módulo (fabricado en la
  // Fábrica correspondiente) está INSTALADO en esta Fundición puntual — el
  // módulo no reemplaza nada, solo agrega una opción más a elegir (ver
  // SMELTER_RECIPE_MODULE, que gatea encolarla en queueRecipe).
  smelter: [
    { id: 'steel', name: 'Acero',    icon: 'anvil',           input: { resource: 'ironore', amount: 4 },  output: { resource: 'steel', amount: 2 } },
    { id: 'glass', name: 'Vidrio',   icon: 'weather-sunny',   input: { resource: 'silicaore', amount: 4 }, output: { resource: 'glass', amount: 2 } },
    { id: 'wire',  name: 'Cables',   icon: 'electric-switch', input: { resource: 'copperore', amount: 4 }, output: { resource: 'wire', amount: 3 } },
    { id: 'alloy', name: 'Aleación', icon: 'cube',            input: { resource: 'bauxite', amount: 4 },   output: { resource: 'alloy', amount: 2 } },
  ],
  // Oxígeno PRIMERO: es la receta por defecto (soporte vital siempre a mano,
  // desde el inicio) — quemar mineral/carbono son alternativas más eficientes
  // pero hay que desbloquearlas (ver RECIPE_UNLOCK_COST) una vez ya tengas minería.
  power_plant: [
    { id: 'oxygen',  name: 'Quemar oxígeno', icon: 'weather-windy', input: { resource: 'oxygen', amount: 4 }, output: { resource: 'energy', amount: 18 } },
    { id: 'mineral', name: 'Quemar mineral', icon: 'diamond-stone', input: { resource: 'mineral', amount: 3 }, output: { resource: 'energy', amount: 14 } },
    { id: 'coal',    name: 'Quemar carbono', icon: 'blur-radial',  input: { resource: 'carbon', amount: 3 },  output: { resource: 'energy', amount: 16 } },
  ],
  // Fábrica de Electrónica: componentes CHICOS a partir del Sílice refinado —
  // circuitos (base), servos y sensores. Servo/sensor se desbloquean con créditos.
  electronics_factory: [
    { id: 'circuit', name: 'Circuitos', icon: 'chip',  input: { resource: 'silicaore', amount: 6 }, output: { resource: 'circuit', amount: 1 } },
    { id: 'servo',   name: 'Servomotor', icon: 'cog',  input: { resource: 'wire', amount: 4 },      output: { resource: 'servo', amount: 1 } },
    { id: 'sensor',  name: 'Sensores',  icon: 'radar', input: { resource: 'circuit', amount: 2 },   output: { resource: 'sensor', amount: 1 } },
  // El FOCO se fabrica acá (y no en la Ensambladora, que abre recién en el rango
  // 15): la regla de "de noche, a oscuras, no se empuja" necesita tener respuesta
  // temprano, o es puro castigo. Vidrio de insumo — un foco es vidrio.
  { id: 'lamp',    name: 'Foco de Trabajo', icon: 'spotlight-beam', input: { resource: 'glass', amount: 3 }, output: { resource: 'lamp', amount: 1 } },
  ],
  // Fábricas: la cola de módulos "llave" del juego, repartida en TRES
  // edificios por tier de progresión (a pedido: una sola con 17 recetas hacía
  // el panel gigante e ilegible). Regla de progresión intacta: cada módulo se
  // construye con material de la cadena ANTERIOR (el de sílice con acero, el
  // de cobre con vidrio, el de aluminio con cables, el de titanio con
  // aleación, y los exóticos con electrónica). Se desbloquean con créditos
  // (RECIPE_UNLOCK_COST); sin nada encolado no producen.
  // T1 (rango 4): los peldaños de arranque de la escalera (rangos 5-7).
  fabrica: [
    { id: 'module_silicon',  name: 'Módulo de Sílice',   icon: 'grain',              input: { resource: 'steel', amount: 6 },   output: { resource: 'module_silicon', amount: 1 } },
    { id: 'module_glass',    name: 'Módulo de Vidrio',   icon: 'weather-sunny',      input: { resource: 'steel', amount: 8 },   output: { resource: 'module_glass', amount: 1 } },
    { id: 'module_copper',   name: 'Módulo de Cobre',    icon: 'circle-slice-8',     input: { resource: 'glass', amount: 6 },   output: { resource: 'module_copper', amount: 1 } },
    { id: 'module_carbon',   name: 'Módulo de Carbono',  icon: 'blur-radial',        input: { resource: 'steel', amount: 10 },  output: { resource: 'module_carbon', amount: 1 } },
    { id: 'module_sci_fluid', name: 'Módulo de Fluidos', icon: 'test-tube',          input: { resource: 'steel', amount: 6 },   output: { resource: 'module_sci_fluid', amount: 1 } },
  ],
  // T2 (rango 7): el tramo medio de la cadena (rangos 7-9).
  fabrica_avanzada: [
    { id: 'module_wire',     name: 'Módulo de Cables',   icon: 'electric-switch',    input: { resource: 'glass', amount: 8 },   output: { resource: 'module_wire', amount: 1 } },
    { id: 'module_aluminum', name: 'Módulo de Aluminio', icon: 'cube-outline',       input: { resource: 'wire', amount: 8 },    output: { resource: 'module_aluminum', amount: 1 } },
    { id: 'module_titanium', name: 'Módulo de Titanio',  icon: 'hexagon-outline',    input: { resource: 'alloy', amount: 6 },   output: { resource: 'module_titanium', amount: 1 } },
    { id: 'module_sci_gas',  name: 'Módulo de Gases',    icon: 'weather-windy',      input: { resource: 'glass', amount: 8 },   output: { resource: 'module_sci_gas', amount: 1 } },
    { id: 'module_sulfur',   name: 'Módulo de Azufre',   icon: 'flask-round-bottom', input: { resource: 'alloy', amount: 8 },   output: { resource: 'module_sulfur', amount: 1 } },
    { id: 'module_alloy',    name: 'Módulo de Aleación', icon: 'cube',               input: { resource: 'wire', amount: 10 },   output: { resource: 'module_alloy', amount: 1 } },
  ],
  // ── ACTO II: química ────────────────────────────────────────────────────────
  // Cada uno hace UN material y ya (sin cola de recetas a elegir): son el paso
  // que faltaba para que `acid`/`ceramic`/`plastic`/`fuel` existan de verdad.
  // Sus recetas van igual acá (y no como input/output del catálogo) para que la
  // Fundición/Refinería sigan siendo el patrón: un edificio, una cola.
  chemical_plant: [
    { id: 'acid', name: 'Ácido sulfúrico', icon: 'flask-round-bottom', input: { resource: 'sulfur', amount: 4 }, output: { resource: 'acid', amount: 2 } },
  ],
  ceramic_kiln: [
    { id: 'ceramic', name: 'Cerámica', icon: 'pot', input: { resource: 'silicaore', amount: 2 }, output: { resource: 'ceramic', amount: 2 } },
  ],
  // Polímeros y combustible salen del ÁCIDO, no del carbono: así la Planta
  // Química es el cuello de la rama entera (una decisión de cuánto ácido va a
  // cada cosa) en vez de dos edificios con el mismo insumo y distinto precio,
  // donde el barato no lo construiría nadie.
  polymer_plant: [
    { id: 'plastic', name: 'Polímeros', icon: 'water-outline', input: { resource: 'acid', amount: 3 }, output: { resource: 'plastic', amount: 2 } },
  ],
  fuel_plant: [
    { id: 'fuel', name: 'Combustible', icon: 'fuel', input: { resource: 'acid', amount: 4 }, output: { resource: 'fuel', amount: 2 } },
  ],
  // La Ensambladora: los 5 módulos de BONO (los que sí dan efecto, a diferencia
  // de los módulos "llave" de las Fábricas). Se desbloquean con créditos.
  assembler: [
    { id: 'antenna',   name: 'Antena Cuántica', icon: 'satellite-uplink', input: { resource: 'circuit', amount: 2 }, output: { resource: 'antenna', amount: 1 } },
    { id: 'capacitor', name: 'Capacitor',       icon: 'current-ac',       input: { resource: 'plastic', amount: 4 }, output: { resource: 'capacitor', amount: 1 } },
    { id: 'coolant',   name: 'Refrigerante',    icon: 'snowflake',        input: { resource: 'fuel', amount: 4 },    output: { resource: 'coolant', amount: 1 } },
    { id: 'reactor',   name: 'Reactor',         icon: 'atom',             input: { resource: 'ceramic', amount: 4 }, output: { resource: 'reactor', amount: 1 } },
    { id: 'core',      name: 'Núcleo',          icon: 'hexagram',         input: { resource: 'circuit', amount: 4 }, output: { resource: 'core', amount: 1 } },
  ],
  // T3 (rango 9): el tramo exótico/final (rango 10 y endgame).
  fabrica_exotica: [
    { id: 'module_gold',       name: 'Módulo de Oro',     icon: 'gold',          input: { resource: 'circuit', amount: 4 }, output: { resource: 'module_gold', amount: 1 } },
    { id: 'module_sci_energy', name: 'Módulo Energético', icon: 'flash',         input: { resource: 'alloy', amount: 8 },   output: { resource: 'module_sci_energy', amount: 1 } },
    { id: 'module_uranium',    name: 'Módulo de Uranio',  icon: 'radioactive',   input: { resource: 'circuit', amount: 6 }, output: { resource: 'module_uranium', amount: 1 } },
    { id: 'module_crystal',    name: 'Módulo de Cristal', icon: 'diamond-outline', input: { resource: 'sensor', amount: 4 }, output: { resource: 'module_crystal', amount: 1 } },
    { id: 'module_sci_exotic', name: 'Módulo Exótico',    icon: 'atom-variant',  input: { resource: 'sensor', amount: 4 },  output: { resource: 'module_sci_exotic', amount: 1 } },
    { id: 'module_helium',     name: 'Módulo de Helio-3', icon: 'weather-night', input: { resource: 'sensor', amount: 6 },  output: { resource: 'module_helium', amount: 1 } },
  ],
};

// ── Especialización de la Fundición/Laboratorio por módulo instalado ──────────
// Con uno de estos módulos puesto, el edificio IGNORA su cola de recetas y
// produce automático SOLO ese material/ciencia (mismo patrón que
// ORE_MODULE_FOR_RESOURCE/ORE_DRILL_AMOUNT de la Perforadora, pero acá el
// input/cycleMs/powerUse también cambian con el módulo, no solo el output).
export interface ModuleSpecRecipe { input?: ResourceFlow; output: ResourceFlow; cycleMs: number; powerUse: number }
// La Fundición no se especializa por módulo: el módulo de material INSTALADO
// solo DESBLOQUEA su receta (Vidrio/Cables/Aleación) para elegir en la cola,
// junto al Acero (siempre gratis) — no reemplaza ni anula nada, es una
// alternativa más. Clave = `Recipe.id` de BUILDING_RECIPES.smelter.
export const SMELTER_RECIPE_MODULE: Partial<Record<string, ComponentResource>> = {
  glass: 'module_glass',
  wire: 'module_wire',
  alloy: 'module_alloy',
}
export const LABORATORIO_MODULE_RECIPE: Partial<Record<ComponentResource, ModuleSpecRecipe>> = {
  module_sci_fluid:  { input: { resource: 'water', amount: 3 },  output: { resource: 'sci_fluid', amount: 2 },  cycleMs: 7_000,  powerUse: 4 },
  module_sci_gas:    { input: { resource: 'oxygen', amount: 3 }, output: { resource: 'sci_gas', amount: 2 },    cycleMs: 8_000,  powerUse: 5 },
  module_sci_energy: { output: { resource: 'sci_energy', amount: 2 }, cycleMs: 8_000, powerUse: 12 },
  module_sci_exotic: { input: { resource: 'crystal', amount: 1 }, output: { resource: 'sci_exotic', amount: 2 }, cycleMs: 12_000, powerUse: 9 },
};

// ── Ciclo del día marciano ────────────────────────────────────────────────────
// Un sol (día marciano) dura 24 h 37 min de verdad; acá, 5 minutos. La fase se
// deriva del RELOJ (`Date.now()`), no de un contador propio: así el velo de luz
// del mapa, el indicador del HUD y el consumo nocturno de los edificios miran
// exactamente lo mismo, sobrevive a recargar la app, y el tiempo pasa también
// mientras el juego está cerrado (la producción offline usa el mismo reloj).
// El largo se elige por la NOCHE, que es la fase que se sufre: la noche es el
// 41,7 % del sol (ver DAY_PHASE_BOUNDS, sale de la elevación real del sol), así
// que 5 min de sol = 2 min de noche — corta, algo que se cruza con la batería
// cargada sin que la colonia quede parada un rato largo.
export const SOL_MS = 300_000;
// Durante el TUTORIAL el sol queda clavado al MEDIODÍA: empezar una partida de
// noche era arrancar sin generar energía y con el mapa a oscuras, justo mientras
// se explica cómo construir. Como el reloj del sol sale de `Date.now()`, la hora
// de arranque era la del reloj del teléfono, o sea pura lotería.
// Es una bandera de módulo (no estado persistido) A PROPÓSITO: guardarla
// obligaría a subir `version` y borrarle la partida al jugador. La pone
// GameScreen al cambiar `onboardingStage`, y la leen tanto la UI como el tick,
// que corren en el mismo proceso.
let tutorialDaylight = false;
export function setTutorialDaylight(on: boolean): void {
  tutorialDaylight = on;
}
// Fase FIJADA a mano desde el modo sandbox (null = corre con el reloj). Sirve
// para probar amanecer/día/atardecer/noche sin esperar el ciclo entero.
let forcedPhase: number | null = null;
export function setForcedSolPhase(p: number | null): void {
  forcedPhase = p;
}
export function getForcedSolPhase(): number | null {
  return forcedPhase;
}
// 0 = medianoche · 0.25 = amanecer · 0.5 = mediodía · 0.75 = atardecer.
export function solPhaseAt(now: number): number {
  if (forcedPhase !== null) return forcedPhase;
  if (tutorialDaylight) return 0.5;
  return (now % SOL_MS) / SOL_MS;
}
// Fase representativa de cada nombre, para el selector del sandbox: el punto
// MEDIO de cada tramo, así al fijarla se ve la fase entera y no su borde.
export const DAY_PHASE_SAMPLE: Record<DayPhase, number> = {
  noche: 0,
  amanecer: 0.25 + 1 / 24,
  dia: 0.5,
  atardecer: 2 / 3 + 1 / 24,
};
// ELEVACIÓN del sol sobre el horizonte: −1 a medianoche, 0 al amanecer y al
// atardecer, +1 al mediodía. Es un giro completo del planeta, así que el sol
// pasa la MITAD del sol bajo el horizonte — igual que en Marte, cuyo eje está
// inclinado 25,2° (casi como el terrestre) y en el ecuador da ~12 h 20 min de
// día y otras tantas de noche.
//
// Antes esto era `sin(π·fase)`, que deja el sol SIEMPRE por encima del
// horizonte (solo sube y baja de altura), y encima se le restaba un piso para
// "alargar la noche". El resultado medido era al revés de lo buscado: la noche
// ocupaba apenas un 24% del sol, porque un seno pasa muy poco tiempo cerca de
// cero. Con la elevación real, las duraciones salen solas y son comprobables
// (ver DAY_PHASE_BOUNDS).
function sunElevationAt(now: number): number {
  return Math.sin(2 * Math.PI * (solPhaseAt(now) - 0.25));
}
// Altura útil del sol: 0 mientras está bajo el horizonte, hasta 1 al mediodía.
// La usa todo lo que depende del día (luz del mapa, generación, calefacción).
export function sunHeightAt(now: number): number {
  return Math.max(0, sunElevationAt(now));
}
export type DayPhase = 'amanecer' | 'dia' | 'atardecer' | 'noche';
export const DAY_PHASE_DEF: Record<DayPhase, { name: string; icon: string; color: string }> = {
  amanecer:   { name: 'Amanecer',  icon: 'weather-sunset-up',   color: '#7FB3E8' },
  dia:        { name: 'Día',       icon: 'white-balance-sunny', color: '#FFC98A' },
  atardecer:  { name: 'Atardecer', icon: 'weather-sunset-down', color: '#7FB3E8' },
  noche:      { name: 'Noche',     icon: 'weather-night',       color: '#8AA4C8' },
};
// Fronteras de las fases, en fracción de sol. Salen de la elevación del sol y
// son exactas, no umbrales a ojo:
//   · el CREPÚSCULO CIVIL empieza con el sol 15° BAJO el horizonte (todavía hay
//     luz utilizable antes de que asome, y la sigue habiendo un rato después de
//     que se pone). 15°/360° = 1/24 de sol a cada lado.
//   · el DÍA PLENO empieza cuando la elevación pasa de 0.5, y asin(0.5)/2π = 1/12.
//   noche     [19/24 … 5/24)  → 41,7 % del sol
//   amanecer  [5/24  … 1/3)   → 12,5 %
//   día       [1/3   … 2/3)   → 33,3 %
//   atardecer [2/3   … 19/24) → 12,5 %
// Con SOL_MS = 5 min: 2 min 5 s de noche, 37 s de amanecer, 1 min 40 s de día
// pleno y 37 s de atardecer. La noche se acortó (a pedido) contando el
// crepúsculo civil como luz en vez de como oscuridad — que además es lo cierto.
export const DAY_PHASE_BOUNDS: { phase: DayPhase; from: number }[] = [
  { phase: 'noche', from: 0 },
  { phase: 'amanecer', from: 5 / 24 },
  { phase: 'dia', from: 1 / 3 },
  { phase: 'atardecer', from: 2 / 3 },
  { phase: 'noche', from: 19 / 24 },
];
// Cuánta OSCURIDAD hay (0 = se ve todo, 1 = noche cerrada). Arranca justo donde
// arranca la fase 'noche' (crepúsculo civil, sin15° ≈ 0.2588), así lo que se VE
// y la fase que dice el HUD cambian en el mismo instante — antes el mapa ya
// estaba negro mientras el chip todavía decía "amanecer".
export function nightAmountAt(now: number): number {
  return Math.min(1, Math.max(0, (-sunElevationAt(now) - 0.2588) / 0.7412));
}
export function dayPhaseAt(now: number): DayPhase {
  const p = solPhaseAt(now);
  let ph: DayPhase = 'noche';
  for (const b of DAY_PHASE_BOUNDS) if (p >= b.from) ph = b.phase;
  return ph;
}
// Cuánto falta para que cambie la fase. Lo muestra el chip del HUD: sin esto,
// "Noche" no dice si te quedan 10 segundos o 5 minutos de no generar energía,
// que es justo lo que hay que saber para decidir si te alcanza la batería.
export function msToNextPhaseAt(now: number): number {
  const p = solPhaseAt(now);
  const next = DAY_PHASE_BOUNDS.find((b) => b.from > p)?.from ?? 1;
  return (next - p) * SOL_MS;
}
// GENERACIÓN de energía según la hora: de NOCHE nada, en amanecer/atardecer la
// mitad, a pleno día todo. Aplica a TODO lo que produce electricidad (paneles,
// central, la base y el cohete), no solo a los paneles solares: en Marte, con
// 43% de la luz que recibe la Tierra y sin red eléctrica planetaria, la energía
// es solar o no es. La consecuencia de diseño es fuerte y buscada: la colonia
// vive de noche de lo que guardó la batería durante el día, así que la Batería
// deja de ser "sube el tope" y pasa a ser lo que te mantiene funcionando.
// Energía que la BASE sigue dando de noche pase lo que pase: es el módulo de
// habitación de la tripulación, tiene respaldo propio y no puede apagarse. Sin
// este piso, una colonia sin baterías quedaba MUERTA hasta el amanecer y no
// había forma de salir del pozo (nada produce sin energía, ni siquiera para
// construir una batería).
// Subido de 2 a 4 (a pedido), en el mismo movimiento que el pico de día pasó de
// 10 a 15 (`bonusOutput` de la base en el catálogo): la noche seguía asfixiando
// aunque el día diera de sobra. Amanecer y atardecer quedan en la mitad del día
// (7.5), que es lo que devuelve energyDayFactor.
export const BASE_NIGHT_ENERGY = 4;
export function energyDayFactor(now: number): number {
  const ph = dayPhaseAt(now);
  return ph === 'noche' ? 0 : ph === 'dia' ? 1 : 0.5;
}
// De NOCHE los edificios gastan MÁS energía: en Marte se va a −100 °C y hay que
// calefaccionar para que la maquinaria (y la tripulación) aguanten. Es el costo
// real de que exista el ciclo de día — obliga a tener baterías cargadas para
// cruzar la noche, y le da a la Batería una razón de ser más allá de subir el
// tope. A pleno día no hay recargo; en plena noche se paga este multiplicador.
export const NIGHT_POWER_MULT = 1.6;
export function nightPowerMult(now: number): number {
  return 1 + (NIGHT_POWER_MULT - 1) * (1 - sunHeightAt(now));
}

export const REFINERY_WATER_PER_CYCLE = 2;
export const REFINERY_OXYGEN_PER_CYCLE = 2;
// El Laboratorio también respira oxígeno Y agua (aparte de la tierra/mineral de
// su receta) — mismo patrón que la refinería, mucho más caro por ciclo: la
// investigación es costosa de sostener, no solo lenta.
export const LAB_OXYGEN_PER_CYCLE = 9;
export const LAB_WATER_PER_CYCLE = 3;
// El generador de O₂ además filtra un poco de REGOLITO (tierra) por ciclo.
export const OXYGEN_GENERATOR_DIRT_PER_CYCLE = 1;
// ── Licencia de construcción ─────────────────────────────────────────────────
// Llegar al rango (o investigar la tecnología) HABILITA el edificio, pero además
// hay que comprar el plano una vez con créditos para poder construirlo. Sin esto,
// desbloquear algo era gratis y el rango nuevo escupía media docena de edificios
// de golpe; ahora cada uno es una decisión de en qué gastar.
// Solo lo pagan los edificios GATEADOS (por rango o por investigación): los que
// están disponibles desde el arranque siguen sin licencia.
export const BUILDING_LICENSE_MULT = 3;
export function getBuildingLicenseCost(buildCost: number): number {
  // Redondeado a decenas para que el precio se lea limpio en la tarjeta.
  return Math.round((buildCost * BUILDING_LICENSE_MULT) / 10) * 10;
}

export const RECIPE_UNLOCK_COST: Record<string, number> = {
  'refinery:silicon': 200,
  'refinery:copper': 250,
  'refinery:aluminum': 300,
  'power_plant:mineral': 150,
  'power_plant:coal': 200,
  // Electrónica: el circuito viene de fábrica; servo/sensor se pagan.
  'electronics_factory:servo': 400,
  'electronics_factory:lamp': 600,
  'electronics_factory:sensor': 800,
  // Fundición: Acero viene de fábrica. Vidrio/Cables/Aleación se desbloquean
  // con créditos IGUAL que cualquier otra receta — el módulo de material
  // (fabricado en la Fábrica) es el que además hay que tener INSTALADO para
  // poder elegirlas (ver SMELTER_RECIPE_MODULE), no basta con pagarlas.
  'smelter:glass': 700,
  'smelter:wire': 1600,
  'smelter:alloy': 3400,
  // Módulos: escalan con la rareza del material (mismo orden que la cadena de
  // progresión — ver PERFORADORA_DEPOSITS). El de sílice viene de fábrica: es
  // el primer paso obligatorio de la cadena. Las claves siguen a la FÁBRICA
  // (T1/T2/T3) que fabrica cada módulo — ver BUILDING_RECIPES.
  'fabrica:module_glass': 700,
  'fabrica:module_copper': 600,
  'fabrica:module_carbon': 900,
  'fabrica:module_sci_fluid': 900,
  'fabrica_avanzada:module_wire': 1600,
  'fabrica_avanzada:module_aluminum': 1400,
  'fabrica_avanzada:module_titanium': 2200,
  'fabrica_avanzada:module_sci_gas': 2200,
  'fabrica_avanzada:module_sulfur': 3200,
  'fabrica_avanzada:module_alloy': 3400,
  'fabrica_exotica:module_gold': 4500,
  'fabrica_exotica:module_sci_energy': 4500,
  'fabrica_exotica:module_uranium': 6000,
  'fabrica_exotica:module_crystal': 8000,
  'fabrica_exotica:module_sci_exotic': 8000,
  'fabrica_exotica:module_helium': 10_000,
  // Ensambladora (acto II): la Antena viene de fábrica — es el primer módulo de
  // bono que consigue el jugador y no tiene sentido cobrar por estrenar el
  // edificio. El resto escala con lo que hace cada uno (el Núcleo, +50% de
  // producción, es el más caro de todos con diferencia).
  'assembler:capacitor': 3_000,
  'assembler:coolant': 4_500,
  'assembler:reactor': 7_000,
  'assembler:core': 12_000,
};

export const DEPOSIT_DEF: Record<DepositType, { name: string; icon: string; color: string }> = {
  ore:          { name: 'Veta de Hierro',   icon: 'diamond-stone',      color: '#8a6fc0' },
  silicon_ore:  { name: 'Veta de Sílice',   icon: 'grain',              color: '#c8b45a' },
  copper_ore:   { name: 'Veta de Cobre',    icon: 'circle-slice-8',     color: '#c47a3a' },
  titanium_ore: { name: 'Titanio (raro)',   icon: 'hexagon-outline',    color: '#4a8aaf' },
  carbon:       { name: 'Carbono',          icon: 'blur-radial',        color: '#5a5a5a' },
  water:        { name: 'Depósito de agua congelada', icon: 'water',    color: '#2f6f8a' },
  brine:        { name: 'Salmuera',         icon: 'water-opacity',      color: '#3a6a55' },
  aluminum_ore: { name: 'Veta de Aluminio', icon: 'cube-outline',       color: '#9a9aa8' },
  sulfur_ore:   { name: 'Azufre',           icon: 'flask-round-bottom', color: '#b8a83a' },
  gold_ore:     { name: 'Veta de oro',      icon: 'gold',               color: '#c8a02a' },
  uranium_ore:  { name: 'Uranio (raro)',    icon: 'radioactive',        color: '#4a8a4a' },
  crystal_vein: { name: 'Veta de Cristal Marciano', icon: 'diamond-outline', color: '#B57CFF' },
  helium_crater:{ name: 'Cráter de Helio-3', icon: 'weather-night',     color: '#8AD8FF' },
};

// ── Terreno ──────────────────────────────────────────────────────────────────
export type TerrainType = 'mountain' | 'rock' | 'ice' | 'dune' | 'crater' | 'debris' | 'ridge' | 'slag' | 'permafrost';
export interface TerrainDef { name: string; icon: string; color: string; clearCost: number; clearMs: number; clearMaterial?: ResourceFlow }
export const TERRAIN_DEF: Record<TerrainType, TerrainDef> = {
  mountain: { name: 'Montaña', icon: 'mountain', color: '#6b3a22', clearCost: 60, clearMs: 8_000 },
  rock: { name: 'Roca', icon: 'rock', color: '#7a5a48', clearCost: 30, clearMs: 4_000 },
  ice: { name: 'Hielo', icon: 'ice', color: '#3f6f86', clearCost: 40, clearMs: 5_000 },
  dune: { name: 'Duna', icon: 'dune', color: '#a87a4a', clearCost: 20, clearMs: 3_000 },
  // Marrón tierra (no gris/negro): es un pozo en el MISMO regolito marciano de
  // alrededor, solo más hondo — no un material de roca distinto. "Rellenar" pide
  // TIERRA además de créditos (a diferencia del resto, que solo se pagan con
  // dinero) — es literal, hace falta tierra de verdad para tapar el pozo.
  crater: { name: 'Cráter', icon: 'crater', color: '#5a3018', clearCost: 45, clearMs: 6_000, clearMaterial: { resource: 'dirt', amount: 25 } },
  debris: { name: 'Chatarra', icon: 'debris', color: '#5a4030', clearCost: 75, clearMs: 9_500 },
  ridge: { name: 'Cresta rocosa', icon: 'ridge', color: '#8a6a52', clearCost: 50, clearMs: 7_000 },
  slag: { name: 'Escoria volcánica', icon: 'slag', color: '#3a2a24', clearCost: 65, clearMs: 8_500 },
  permafrost: { name: 'Permahielo', icon: 'permafrost', color: '#2f5060', clearCost: 55, clearMs: 7_500 },
};

// ── Redes ──────────────────────────────────────────────────────────────────────
export const ROAD_COST = 4;
export const CABLE_COST = 4;
export const PIPE_COST = 4;
export const GAS_COST = 4;
// Antes estos 4 costos eran fijos PARA SIEMPRE, sin importar cuántos tiles de
// esa red ya tenías construidos — a diferencia de TODO lo demás en el juego
// (mejoras, recetas), que se encarece con el uso. Ahora cada tile nuevo cuesta
// un poco más que el anterior DE ESE MISMO TIPO (ver getNetworkTileCost en
// functions.ts) — el crecimiento es chico a propósito (a pedido: "tampoco tanto
// el precio"): con cientos de tiles (una colonia grande, rango alto) el costo
// se nota, pero al ppio del juego un cable/tubería más sigue siendo casi gratis.
export const NETWORK_COST_GROWTH = 0.015;
// Fuentes de la red eléctrica: además de alimentarla, traen su cable de fábrica
// en su propia celda (ver `computeNetwork`), igual que cualquier consumidor con
// `needsPower`. El PANEL SOLAR va acá — sin esto nacía suelto y no entregaba su
// energía a ningún circuito hasta tenderle el cable a mano.
export const POWER_SOURCES: BuildingType[] = ['base', 'power_plant', 'battery', 'solar_panel'];
export const ROAD_SOURCES: BuildingType[] = ['base', 'warehouse'];
// ── LUZ DE NOCHE ─────────────────────────────────────────────────────────────
// Qué edificios ILUMINAN de noche POR SÍ MISMOS: el cohete y la base (los únicos
// que en una colonia real tendrían torres de luz de fábrica — el resto son
// máquinas, no farolas) y la Torre de Luz, que existe para eso.
// Cualquier OTRO edificio puede iluminar si le instalás un Foco de Trabajo
// (módulo `lamp`), con un radio más corto. Todo lo que quede fuera de esas luces
// se ve a oscuras de noche: no se puede construir ahí ni empujar una máquina a
// mano (ver litAreasFrom/isLitAt en functionsLib/buildings.ts, que es el ÚNICO
// lugar donde se decide esto — antes estaba calculado a mano en dos sitios).
export const LIGHT_SOURCES: BuildingType[] = ['base', 'rocket', 'light_tower'];
// Radio Chebyshev (un cuadrado, no un círculo). El de fábrica es 2 → 5×5: con 1
// el hueco quedaba más chico que la propia base y de noche no se veía ni dónde
// pisar. El del foco es 1 → 3×3: alcanza para su máquina y las de al lado, y
// deja a la Torre de Luz con razón de existir.
export const NIGHT_LIT_RADIUS = 2;
export const LAMP_LIT_RADIUS = 1;
export const PIPE_SOURCES: BuildingType[] = ['base', 'warehouse', 'water_pump'];
// La red de GAS distribuye oxígeno desde sus fuentes (cohete, generador de O₂, almacén).
// El tanque de gas es fuente igual que la batería en la red eléctrica: extiende la
// red y su almacenamiento cuenta como miembro del circuito donde esté conectado.
export const GAS_SOURCES: BuildingType[] = ['base', 'oxygen_generator', 'warehouse', 'gas_tank'];

// ── Investigación ──────────────────────────────────────────────────────────────
// CINCO RAMAS, una por ciencia. Cada técnica se paga con la ciencia de su rama
// (`resource`), producida por el laboratorio correspondiente. Los EDIFICIOS
// avanzados se DESCUBREN aquí (`unlocks`): investigar la técnica los habilita en
// el Constructor. La rama Básica además desbloquea los otros 4 laboratorios —
// así el árbol se auto-extiende: básica → labs nuevos → ramas nuevas.
// `category` agrupa la técnica visualmente (y dice qué laboratorio la produce, ver
// SCIENCE_BRANCHES) — YA NO es "una rama aislada con su propia moneda": TODA técnica
// cuesta ciencia BÁSICA (`cost`, siempre); las de categoría no-básica además piden
// `categoryCost` de SU ciencia especializada. Así la básica es la moneda común que
// nunca deja de servir, y las ramas especializadas se apoyan en ella en vez de
// sustituirla — para investigar algo avanzado necesitas AMBAS.
export interface TechDef { id: string; name: string; description: string; icon: string; cost: number; category: ScienceResource; categoryCost?: number; tier: number; requires: string[]; unlocks?: BuildingType[] }
export const RESEARCH_TREE: TechDef[] = [
  // ── CATEGORÍA BÁSICA (research · Laboratorio) — solo pide ciencia básica ────
  { id: 'mining', name: 'Perforación mejorada', description: '+5% producción de minerales', icon: 'pickaxe', cost: 25, category: 'research', tier: 1, requires: [] },
  { id: 'hydrology', name: 'Hidrología', description: 'Escalón previo de la rama de fluidos', icon: 'water-pump', cost: 35, category: 'research', tier: 1, requires: [] },
  // Su descripción prometía "desbloquea el Módulo de Titanio", pero las recetas
  // de las Fábricas NO se gatean por investigación (solo por créditos, ver
  // RECIPE_UNLOCK_COST) — o sea que no hacía absolutamente nada, y la misión del
  // Rango 5 obliga a comprarla. Ahora tiene un efecto REAL sobre lo que dice su
  // nombre: +15% a las vetas sólidas (ver getResearchMult).
  { id: 'deep_mining', name: 'Minería profunda', description: '+15% producción de vetas sólidas', icon: 'tunnel', cost: 80, category: 'research', tier: 2, requires: ['mining'] },
  { id: 'industry', name: 'Industria pesada', description: 'Escalón previo de construcción pesada', icon: 'factory', cost: 110, category: 'research', tier: 2, requires: ['mining'] },
  { id: 'gas_science', name: 'Ciencia de gases', description: 'Escalón previo de la rama de gases', icon: 'weather-windy', cost: 130, category: 'research', tier: 2, requires: ['hydrology'] },
  { id: 'energy_science', name: 'Ciencia energética', description: 'Escalón previo de la rama energética', icon: 'flash', cost: 220, category: 'research', tier: 3, requires: ['industry'] },
  { id: 'heavy_construction', name: 'Construcción pesada', description: 'Desbloquea la Fábrica (módulos de la Perforadora, y de material/ciencia)', icon: 'robot-industrial', cost: 100, category: 'research', tier: 3, requires: ['industry'], unlocks: ['fabrica'] },
  { id: 'trade', name: 'Mercados orbitales', description: '+30% créditos generados', icon: 'cash', cost: 900, category: 'research', tier: 4, requires: ['industry'] },
  { id: 'exotic_science', name: 'Ciencia exótica', description: 'Escalón previo de la rama exótica', icon: 'atom-variant', cost: 1600, category: 'research', tier: 5, requires: ['trade'] },
  // ── CATEGORÍA FLUIDOS (sci_fluid · Lab. de Fluidos) — básica + fluidos ──────
  { id: 'brine', name: 'Salmueras', description: 'Bomba de salmuera', icon: 'water-opacity', cost: 100, category: 'sci_fluid', categoryCost: 60, tier: 2, requires: ['hydrology'], unlocks: ['brine_pump'] },
  { id: 'hydro', name: 'Bombeo profundo', description: '+30% agua y salmuera extraídas', icon: 'waves', cost: 250, category: 'sci_fluid', categoryCost: 150, tier: 3, requires: ['brine'] },
  // ── CATEGORÍA GASES (sci_gas · Lab. de Gases) — básica + gases ──────────────
  { id: 'life', name: 'Bio-síntesis', description: '+30% oxígeno generado', icon: 'air-filter', cost: 250, category: 'sci_gas', categoryCost: 120, tier: 3, requires: ['gas_science'] },
  { id: 'sulfur_tech', name: 'Azufre atmosférico', description: 'Escalón previo de las aleaciones', icon: 'flask-round-bottom-outline', cost: 250, category: 'sci_gas', categoryCost: 170, tier: 3, requires: ['gas_science'] },
  { id: 'alloys', name: 'Aleaciones', description: 'Escalón previo de aleaciones', icon: 'cube', cost: 500, category: 'sci_gas', categoryCost: 450, tier: 4, requires: ['sulfur_tech'] },
  { id: 'helium', name: 'Cosecha de Helio-3', description: '+30% helio-3 y cristal extraídos', icon: 'weather-night', cost: 1000, category: 'sci_gas', categoryCost: 1100, tier: 5, requires: ['alloys'] },
  // ── CATEGORÍA ENERGÉTICA (sci_energy · Lab. Energético) — básica + energía ──
  { id: 'power', name: 'Reactores eficientes', description: '+30% energía de las centrales', icon: 'transmission-tower', cost: 500, category: 'sci_energy', categoryCost: 160, tier: 4, requires: ['energy_science'] },
  { id: 'electronics_t', name: 'Electrónica fina', description: '+30% producción de componentes', icon: 'chip', cost: 500, category: 'sci_energy', categoryCost: 380, tier: 4, requires: ['energy_science'] },
  { id: 'radiometrics', name: 'Prospección radiométrica', description: 'Escalón previo de la fusión compacta', icon: 'radioactive', cost: 1000, category: 'sci_energy', categoryCost: 550, tier: 5, requires: ['electronics_t'] },
  { id: 'fusion', name: 'Fusión compacta', description: '+30% energía extra (acumulable)', icon: 'orbit', cost: 1500, category: 'sci_energy', categoryCost: 1300, tier: 6, requires: ['radiometrics'] },
  // ── CATEGORÍA EXÓTICA (sci_exotic · Lab. Exótico) — básica + exótica ────────
  // (Podada junto con los edificios avanzados — se re-poblará de a poco.)
  { id: 'exotics', name: 'Mineralogía exótica', description: '+30% cristal y helio-3 extraídos', icon: 'diamond-outline', cost: 1500, category: 'sci_exotic', categoryCost: 300, tier: 6, requires: ['exotic_science'] },
  // ── ACTO II (rangos 11-20): la química y los módulos de bono ────────────────
  // REGLA para todo lo que se agregue de acá en adelante: una técnica nueva o
  // DESBLOQUEA un edificio (`unlocks`) o da un bono con efecto real en
  // getResearchMult. Nada de escalones que solo existan para pedir otro escalón
  // — había cinco descripciones que prometían desbloqueos inexistentes y hubo
  // que corregirlas; no volver a crear ese problema.
  { id: 'chemistry', name: 'Química industrial', description: 'Desbloquea la Planta Química (ácido sulfúrico)', icon: 'flask-round-bottom', cost: 700, category: 'sci_fluid', categoryCost: 260, tier: 4, requires: ['brine'], unlocks: ['chemical_plant'] },
  { id: 'ceramics', name: 'Cerámicas técnicas', description: 'Desbloquea el Horno Cerámico', icon: 'pot', cost: 800, category: 'research', tier: 4, requires: ['heavy_construction'], unlocks: ['ceramic_kiln'] },
  { id: 'polymers', name: 'Polímeros', description: 'Desbloquea la Refinería de Polímeros', icon: 'water-outline', cost: 950, category: 'sci_fluid', categoryCost: 420, tier: 5, requires: ['chemistry'], unlocks: ['polymer_plant'] },
  { id: 'fuel_synthesis', name: 'Síntesis de combustible', description: 'Desbloquea la Planta de Combustible', icon: 'fuel', cost: 1100, category: 'sci_gas', categoryCost: 480, tier: 5, requires: ['chemistry'], unlocks: ['fuel_plant'] },
  { id: 'precision_assembly', name: 'Ensamblaje de precisión', description: 'Desbloquea la Ensambladora (módulos de bono)', icon: 'robot-industrial', cost: 1400, category: 'sci_energy', categoryCost: 620, tier: 5, requires: ['electronics_t', 'polymers'], unlocks: ['assembler'] },
];
export const RESEARCH_TIERS = [1, 2, 3, 4, 5, 6];
// Ramas del árbol (para la UI): ciencia → nombre/ícono/color/lab que la produce.
export const SCIENCE_BRANCHES: { science: ScienceResource; name: string; icon: string; color: string; lab: BuildingType }[] = [
  { science: 'research', name: 'Ciencia Básica', icon: 'flask', color: '#6FE6D8', lab: 'laboratorio' },
  { science: 'sci_fluid', name: 'Fluidos', icon: 'test-tube', color: '#5FD0FF', lab: 'laboratorio' },
  { science: 'sci_gas', name: 'Gases', icon: 'weather-windy', color: '#8DF0C8', lab: 'laboratorio' },
  { science: 'sci_energy', name: 'Energética', icon: 'flash', color: '#FFD24A', lab: 'laboratorio' },
  { science: 'sci_exotic', name: 'Exótica', icon: 'atom-variant', color: '#B57CFF', lab: 'laboratorio' },
];
// Edificio → técnica que lo desbloquea (derivado del árbol).
export const BUILDING_TECH: Partial<Record<BuildingType, string>> = {};
for (const t of RESEARCH_TREE) for (const b of t.unlocks || []) BUILDING_TECH[b] = t.id;

export const MODULE_CATALOG: Record<ComponentResource, ModuleDef> = {
  // Genéricos (cualquier edificio):
  circuit:   { resource: 'circuit',   name: 'Circuito',   icon: 'chip',      effect: '+20% producción',         prodBonus: 0.20, speedBonus: 0,    powerBonus: 0 },
  sensor:    { resource: 'sensor',    name: 'Sensor',     icon: 'radar',     effect: '-25% consumo de energía', prodBonus: 0,    speedBonus: 0,    powerBonus: -0.25 },
  core:      { resource: 'core',      name: 'Núcleo',     icon: 'hexagram',  effect: '+50% producción',         prodBonus: 0.50, speedBonus: 0,    powerBonus: 0 },
  // Específicos:
  servo:     { resource: 'servo',     name: 'Servomotor', icon: 'cog',       effect: '+25% velocidad (extrae/fabrica/mueve)', prodBonus: 0, speedBonus: 0.25, powerBonus: 0, appliesTo: ['extraction', 'logistics', 'components', 'research'], drone: true },
  coolant:   { resource: 'coolant',   name: 'Refrigerante', icon: 'snowflake', effect: '+45% velocidad (procesos de calor)', prodBonus: 0, speedBonus: 0.45, powerBonus: 0, appliesTo: ['logistics', 'components'], drone: true },
  capacitor: { resource: 'capacitor', name: 'Capacitor',  icon: 'current-ac', effect: '-45% consumo (baterías/almacenes)', prodBonus: 0, speedBonus: 0, powerBonus: -0.45, appliesTo: ['energy', 'life'] },
  reactor:   { resource: 'reactor',   name: 'Reactor',    icon: 'atom',      effect: '+100% energía (solo centrales)', prodBonus: 1.0, speedBonus: 0, powerBonus: 0, appliesTo: ['energy'] },
  antenna:   { resource: 'antenna',   name: 'Antena Cuántica', icon: 'satellite-uplink', effect: '+35% producción (investigación/logística)', prodBonus: 0.35, speedBonus: 0, powerBonus: 0, appliesTo: ['research', 'logistics'] },
  // FOCO: el único módulo que no toca la producción — convierte al edificio en
  // fuente de luz (ver LIGHT_SOURCES / LAMP_LIT_RADIUS). Sirve para la máquina
  // suelta y lejana; para cubrir zona sigue conviniendo la Torre de Luz, que
  // ilumina un 5×5 y sale mucho más barata. El +10 % de consumo es a propósito:
  // una luz gasta, y sin ese costo el foco sería un sí automático en todas.
  lamp:      { resource: 'lamp',      name: 'Foco de Trabajo', icon: 'spotlight-beam', effect: 'Ilumina el edificio y su alrededor de noche · +10% consumo', prodBonus: 0, speedBonus: 0, powerBonus: 0.10 },
  // Módulos de veta: no dan bono — son la "broca" que especializa una
  // Perforadora. Sin el módulo correcto instalado, la Perforadora no produce
  // nada (ver ORE_MODULE_FOR_RESOURCE + tickProduction). Solo calzan en
  // 'perforadora' (ver moduleFitsBuilding).
  module_silicon:  { resource: 'module_silicon',  name: 'Módulo de Sílice',   icon: 'grain',              effect: 'Perfora vetas de sílice',   prodBonus: 0, speedBonus: 0, powerBonus: 0, appliesTo: ['extraction'] },
  module_copper:   { resource: 'module_copper',   name: 'Módulo de Cobre',    icon: 'circle-slice-8',     effect: 'Perfora vetas de cobre',    prodBonus: 0, speedBonus: 0, powerBonus: 0, appliesTo: ['extraction'] },
  module_carbon:   { resource: 'module_carbon',   name: 'Módulo de Carbono',  icon: 'blur-radial',        effect: 'Perfora vetas de carbono',  prodBonus: 0, speedBonus: 0, powerBonus: 0, appliesTo: ['extraction'] },
  module_aluminum: { resource: 'module_aluminum', name: 'Módulo de Aluminio', icon: 'cube-outline',       effect: 'Perfora vetas de aluminio', prodBonus: 0, speedBonus: 0, powerBonus: 0, appliesTo: ['extraction'] },
  module_titanium: { resource: 'module_titanium', name: 'Módulo de Titanio',  icon: 'hexagon-outline',    effect: 'Perfora vetas de titanio',  prodBonus: 0, speedBonus: 0, powerBonus: 0, appliesTo: ['extraction'] },
  module_sulfur:   { resource: 'module_sulfur',   name: 'Módulo de Azufre',   icon: 'flask-round-bottom', effect: 'Perfora vetas de azufre',   prodBonus: 0, speedBonus: 0, powerBonus: 0, appliesTo: ['extraction'] },
  module_gold:     { resource: 'module_gold',     name: 'Módulo de Oro',     icon: 'gold',                effect: 'Perfora vetas de oro',      prodBonus: 0, speedBonus: 0, powerBonus: 0, appliesTo: ['extraction'] },
  module_uranium:  { resource: 'module_uranium',  name: 'Módulo de Uranio',  icon: 'radioactive',         effect: 'Perfora vetas de uranio',   prodBonus: 0, speedBonus: 0, powerBonus: 0, appliesTo: ['extraction'] },
  module_crystal:  { resource: 'module_crystal',  name: 'Módulo de Cristal', icon: 'diamond-outline',     effect: 'Perfora vetas de cristal marciano', prodBonus: 0, speedBonus: 0, powerBonus: 0, appliesTo: ['extraction'] },
  module_helium:   { resource: 'module_helium',   name: 'Módulo de Helio-3', icon: 'weather-night',       effect: 'Perfora cráteres de helio-3', prodBonus: 0, speedBonus: 0, powerBonus: 0, appliesTo: ['extraction'] },
  // Módulos de material: DESBLOQUEAN una receta más en la Fundición (Vidrio/
  // Cables/Aleación, a elegir en la cola junto al Acero que siempre está) —
  // no anulan ni reemplazan la cola, ver SMELTER_RECIPE_MODULE. Se FABRICAN en
  // la Fábrica, se INSTALAN en la Fundición. `appliesTo` es solo informativo
  // acá — el encaje real lo
  // resuelve moduleFitsBuilding por tipo exacto (`smelter`), no por
  // categoría (comparte 'logistics' con edificios sin relación).
  module_glass: { resource: 'module_glass', name: 'Módulo de Vidrio', icon: 'weather-sunny', effect: 'Suma la receta de Vidrio a la cola de la Fundición', prodBonus: 0, speedBonus: 0, powerBonus: 0, appliesTo: ['logistics'] },
  module_wire:  { resource: 'module_wire',  name: 'Módulo de Cables', icon: 'electric-switch', effect: 'Suma la receta de Cables a la cola de la Fundición', prodBonus: 0, speedBonus: 0, powerBonus: 0, appliesTo: ['logistics'] },
  module_alloy: { resource: 'module_alloy', name: 'Módulo de Aleación', icon: 'cube', effect: 'Suma la receta de Aleación a la cola de la Fundición', prodBonus: 0, speedBonus: 0, powerBonus: 0, appliesTo: ['logistics'] },
  // Módulos de ciencia: especializan el Laboratorio (mismo patrón). Acá
  // `appliesTo: ['research']` SÍ alcanza — tras la fusión, `laboratorio` es
  // el único edificio con esa categoría.
  module_sci_fluid:  { resource: 'module_sci_fluid',  name: 'Módulo de Fluidos', icon: 'test-tube', effect: 'El Laboratorio produce Ciencia de Fluidos', prodBonus: 0, speedBonus: 0, powerBonus: 0, appliesTo: ['research'] },
  module_sci_gas:    { resource: 'module_sci_gas',    name: 'Módulo de Gases', icon: 'weather-windy', effect: 'El Laboratorio produce Ciencia de Gases', prodBonus: 0, speedBonus: 0, powerBonus: 0, appliesTo: ['research'] },
  module_sci_energy: { resource: 'module_sci_energy', name: 'Módulo Energético', icon: 'flash', effect: 'El Laboratorio produce Ciencia Energética', prodBonus: 0, speedBonus: 0, powerBonus: 0, appliesTo: ['research'] },
  module_sci_exotic: { resource: 'module_sci_exotic', name: 'Módulo Exótico', icon: 'atom-variant', effect: 'El Laboratorio produce Ciencia Exótica', prodBonus: 0, speedBonus: 0, powerBonus: 0, appliesTo: ['research'] },
};

// Slots de conexión fijos (la "estructura" por defecto) según necesidades.
// El CONDUCTO DE CARGA ('road') es un conector como los otros tres: el edificio
// puede tenerlo cortado. Faltaba, así que la vista de estructura no mostraba por
// dónde entra/sale el material — la red más usada del juego era la única
// invisible ahí. `disconnected` es Partial, así que sumar la clave no rompe las
// partidas guardadas (las viejas simplemente no la traen).
export type ConnectorKind = 'power' | 'water' | 'gas' | 'road';

// ── Rango en el planeta (progresión con misiones) ────────────────────────────────
export type RankMetric = 'buildings' | 'buildType' | 'credits' | 'oxygen' | 'research' | 'researchId' | 'drones' | 'modules' | 'water' | 'dirt' | 'trades' | 'mineral' | 'ironore' | 'silicon' | 'titanium' | 'resource';
// `researchId`: a diferencia de 'research' (cuenta TOTAL de techs desbloqueadas),
// esta pide UNA tech puntual (ver `techId`) — para misiones tipo "investiga X".
// `resource`: métrica GENÉRICA por recurso (lifetimeGains[resource]) — evita
// agregar un nombre de métrica nuevo por cada material de la cadena (cobre,
// carbono, aluminio, azufre, oro, vidrio, cables…). Las métricas viejas con
// nombre propio (mineral/ironore/silicon/titanium) se conservan por
// compatibilidad con los rangos ya definidos.
export interface RankMission { metric: RankMetric; label: string; icon: string; goal: number; buildingType?: BuildingType; techId?: string; resource?: GatedResource }
export interface RankDef { name: string; icon: string; missions: RankMission[]; reward: Partial<Record<'gems' | 'energy' | 'credits', number>> }
export const RANKS: RankDef[] = [
  // Rango 0: tutorial silencioso (sin textos/overlay, solo estas 3 misiones) —
  // enseña a recolectar agua, recolectar tierra (necesita construir Y CONECTAR
  // un Recolector de Regolito, aunque la meta en sí solo pide el recurso) y
  // vender algo por el cohete (primer contacto con el comercio).
  { name: 'Aterrizaje', icon: 'rocket-launch', reward: { gems: 1, energy: 150 }, missions: [
    { metric: 'water', label: 'Recolecta 10 de agua', icon: 'water', goal: 10 },
    { metric: 'dirt', label: 'Recolecta 10 de tierra', icon: 'terrain', goal: 10 },
    { metric: 'trades', label: 'Despliega el cohete', icon: 'rocket-launch', goal: 1 },
  ] },
  { name: 'Avanzada', icon: 'flag', reward: { gems: 2, energy: 300, credits: 100 }, missions: [
    { metric: 'mineral', label: 'Recolecta 100 de hierro', icon: 'diamond-stone', goal: 100 },
    { metric: 'buildType', buildingType: 'block_printer', label: 'Construye una Impresora de Bloques', icon: 'printer-3d', goal: 1 },
    { metric: 'buildType', buildingType: 'battery', label: 'Construye una Batería', icon: 'battery', goal: 1 },
  ] },
  // La Impresora de Bloques ahora cubre la necesidad temprana de bloques, así que
  // la Refinería (y el Laboratorio) se corren a este rango (Colonia, rango 2).
  { name: 'Colonia', icon: 'city', reward: { gems: 2, energy: 500, credits: 250 }, missions: [
    { metric: 'buildType', buildingType: 'power_plant', label: 'Construye una Central de Energía', icon: 'flash', goal: 1 },
    { metric: 'buildType', buildingType: 'laboratorio', label: 'Construye un Laboratorio', icon: 'flask', goal: 1 },
    { metric: 'buildType', buildingType: 'refinery', label: 'Construye una Refinería', icon: 'factory', goal: 1 },
  ] },
  { name: 'Metrópolis', icon: 'city-variant', reward: { gems: 3, energy: 800, credits: 500 }, missions: [
    { metric: 'research', label: 'Compra tu primera investigación', icon: 'flask', goal: 1 },
    { metric: 'buildType', buildingType: 'oxygen_generator', label: 'Construye un Generador de O₂', icon: 'air-filter', goal: 1 },
    { metric: 'ironore', label: 'Refina 150 de hierro', icon: 'hexagon', goal: 150 },
  ] },
  // Rango 4: a esta altura el jugador ya tiene una Perforadora (es rank 0, sin
  // gate) — pedirla de nuevo era una meta trivial/redundante. Ahora pide la
  // Fábrica (la "máquina de componentes"), que es la que de verdad marca este
  // salto: sin ella no hay módulos para especializar la Perforadora en nada
  // más que hierro. `fabrica` desbloquea justo en rango 4 (BUILDING_UNLOCK_RANK)
  // para que esta misión sea lograble EN este rango, no en el siguiente.
  { name: 'Estación Orbital', icon: 'space-station', reward: { gems: 4, energy: 1200, credits: 900 }, missions: [
    { metric: 'buildType', buildingType: 'warehouse', label: 'Construye un Almacén', icon: 'warehouse', goal: 1 },
    { metric: 'buildType', buildingType: 'smelter', label: 'Construye una Fundición', icon: 'fire', goal: 1 },
    { metric: 'buildType', buildingType: 'fabrica', label: 'Construye una Fábrica', icon: 'robot-industrial', goal: 1 },
  ] },
  // Rango 5: ya con la Fábrica en pie (rango 4), acá toca usarla — fabricar el
  // Módulo de Sílice (la PRIMERA especialización de la Perforadora, receta
  // gratis) y minar sílice con él. El titanio (módulo caro, más adentro de la
  // cadena) se pide recién en el rango 6 — antes estaba acá y era un salto
  // demasiado brusco justo después de estrenar la Fábrica.
  { name: 'Avanzadilla Industrial', icon: 'robot-industrial', reward: { gems: 5, energy: 1600, credits: 1400 }, missions: [
    { metric: 'researchId', techId: 'deep_mining', label: 'Investiga Minería profunda (perforación pesada)', icon: 'tunnel', goal: 1 },
    { metric: 'silicon', label: 'Extrae 50 de Sílice', icon: 'grain', goal: 50 },
    { metric: 'credits', label: 'Gana 20000 créditos', icon: 'cash', goal: 20_000 },
  ] },
  // ── Rangos 6-10: la ESCALERA DE MATERIALES. Cada rango sube un peldaño de
  // la cadena de módulos de la Fábrica (mismo orden que RECIPE_UNLOCK_COST):
  // sílice (R5) → cobre → carbono → aluminio → titanio+azufre → oro. En cada
  // uno se pide (a) FABRICAR el material/componente que es el INSUMO del
  // módulo del peldaño (vidrio→cobre, cables→aluminio, aleación→titanio,
  // circuitos→oro…) y (b) MINAR el material nuevo con ese módulo puesto —
  // más una meta de colonia (O₂/créditos/edificio) para el ritmo idle. ──────
  // Rango 6 — COBRE: el Módulo de Cobre se fabrica con vidrio (sílice del R5
  // fundida en la Fábrica con el Módulo de Vidrio).
  { name: 'Dominio Cuántico', icon: 'atom', reward: { gems: 7, energy: 2200, credits: 2200 }, missions: [
    { metric: 'resource', resource: 'glass', label: 'Produce 30 de Vidrio', icon: 'weather-sunny', goal: 30 },
    { metric: 'resource', resource: 'copper', label: 'Extrae 60 de Cobre', icon: 'circle-slice-8', goal: 60 },
    { metric: 'oxygen', label: 'Acumula 3000 O₂', icon: 'air-filter', goal: 3000 },
  ] },
  // Rango 7 — CARBONO y CABLES: el cobre del R6 refinado y estirado en cables
  // (insumo del Módulo de Aluminio del R8); el carbono sale con su módulo
  // (acero, ya fluye desde el R4).
  { name: 'Imperio Marciano', icon: 'crown', reward: { gems: 10, energy: 3000, credits: 4000 }, missions: [
    { metric: 'resource', resource: 'wire', label: 'Fabrica 30 Cables', icon: 'electric-switch', goal: 30 },
    { metric: 'resource', resource: 'carbon', label: 'Extrae 60 de Carbono', icon: 'blur-radial', goal: 60 },
    { metric: 'credits', label: 'Junta 60000 créditos', icon: 'cash', goal: 60_000 },
  ] },
  // Rango 8 — ALUMINIO y ELECTRÓNICA: los cables del R7 arman el Módulo de
  // Aluminio; la bauxita fundida da aleación (insumo del Módulo de Titanio del
  // R9). La Fábrica de Electrónica entra acá — sus circuitos/sensores son los
  // insumos de los módulos exóticos que vienen.
  { name: 'Forja Orbital', icon: 'factory', reward: { gems: 11, energy: 3200, credits: 4700 }, missions: [
    { metric: 'buildType', buildingType: 'electronics_factory', label: 'Construye una Fábrica de Electrónica', icon: 'chip', goal: 1 },
    { metric: 'resource', resource: 'aluminum', label: 'Extrae 60 de Aluminio', icon: 'cube-outline', goal: 60 },
    { metric: 'resource', resource: 'alloy', label: 'Funde 20 de Aleación', icon: 'cube', goal: 20 },
  ] },
  // Rango 9 — TITANIO y AZUFRE: los dos módulos que se pagan con aleación
  // (la Minería profunda ya se investigó en el R5). Los circuitos preparan
  // los Módulos de Oro/Uranio del R10.
  { name: 'Titán de Marte', icon: 'shield-moon', reward: { gems: 11, energy: 3400, credits: 5600 }, missions: [
    { metric: 'resource', resource: 'titanium', label: 'Extrae 50 de Titanio', icon: 'hexagon-outline', goal: 50 },
    { metric: 'resource', resource: 'sulfur', label: 'Extrae 50 de Azufre', icon: 'flask-round-bottom', goal: 50 },
    { metric: 'resource', resource: 'circuit', label: 'Fabrica 10 Circuitos', icon: 'chip', goal: 10 },
  ] },
  // Rango 10 — ORO: cierre del primer arco de la cadena. Los sensores dejan
  // listos los Módulos de Cristal/Helio-3 del final del juego.
  // El SERVO cierra el rango en vez de una meta de créditos: era contenido
  // huérfano (400 de desbloqueo y ninguna misión lo pedía nunca) y es el único
  // módulo que además va en los ROVERS — una mecánica que se puede terminar el
  // juego sin tocar. Sale barato: 32 de cables.
  { name: 'Vanguardia Dorada', icon: 'gold', reward: { gems: 12, energy: 3600, credits: 6600 }, missions: [
    { metric: 'resource', resource: 'gold', label: 'Extrae 40 de Oro', icon: 'gold', goal: 40 },
    { metric: 'resource', resource: 'sensor', label: 'Fabrica 5 Sensores', icon: 'radar', goal: 5 },
    { metric: 'resource', resource: 'servo', label: 'Fabrica 8 Servomotores', icon: 'cog', goal: 8 },
  ] },

  // ══ ACTO II (rangos 11-20) · QUÍMICA Y COMPONENTES ═════════════════════════
  // El acto I enseñó la cadena de materiales (veta → refinería → fundición →
  // fábricas). El acto II enseña un verbo NUEVO: optimizar lo que ya tenés.
  // Cada rango del 11 al 15 estrena su edificio (química) y del 16 al 20 se usa
  // todo eso para fabricar los módulos de BONO, que hasta ahora existían en
  // MODULE_CATALOG con efectos reales y no había forma de conseguir.
  // Rango 11 — ÁCIDO: el azufre del R9 por fin sirve para algo.
  // La INVESTIGACIÓN es misión, no letra chica. Los cinco edificios de la química
  // (11-15) tienen doble llave: rango Y tecnología. La misión decía "construí la
  // Planta Química" sin decir que antes hay que investigar Química industrial, o
  // sea que el jugador chocaba contra un muro invisible — la tarjeta pedía algo
  // que el Constructor no le dejaba hacer, sin explicar por qué.
  // Va explícita ACÁ (el primero de la cadena, donde se aprende el patrón) y en
  // el R15 (el keystone del acto, y el que más profundo requiere). En el medio no
  // se repite: cinco rangos de investigar/construir/producir sería cambiar una
  // monotonía por otra.
  { name: 'Industria Química', icon: 'flask-round-bottom', reward: { gems: 12, energy: 3800, credits: 8000 }, missions: [
    { metric: 'researchId', techId: 'chemistry', label: 'Investiga Química industrial', icon: 'flask-round-bottom', goal: 1 },
    { metric: 'buildType', buildingType: 'chemical_plant', label: 'Construye una Planta Química', icon: 'flask-round-bottom', goal: 1 },
    { metric: 'resource', resource: 'acid', label: 'Produce 40 de Ácido', icon: 'flask-round-bottom', goal: 40 },
  ] },
  // Rango 12 — CERÁMICA: sílice refinada cocida. Es el material que aguanta
  // calor y radiación, o sea el que van a pedir las máquinas de los actos IV-V.
  { name: 'Alfarería Marciana', icon: 'pot', reward: { gems: 13, energy: 4000, credits: 9500 }, missions: [
    { metric: 'buildType', buildingType: 'ceramic_kiln', label: 'Construye un Horno Cerámico', icon: 'pot', goal: 1 },
    { metric: 'resource', resource: 'ceramic', label: 'Produce 40 de Cerámica', icon: 'pot', goal: 40 },
    { metric: 'oxygen', label: 'Acumula 6000 O₂', icon: 'air-filter', goal: 6000 },
  ] },
  // Rango 13 — PLÁSTICO: carbono + ácido. Insumo del capacitor y el refrigerante.
  { name: 'Era del Polímero', icon: 'water-outline', reward: { gems: 13, energy: 4200, credits: 11_000 }, missions: [
    { metric: 'buildType', buildingType: 'polymer_plant', label: 'Construye una Refinería de Polímeros', icon: 'water-outline', goal: 1 },
    { metric: 'resource', resource: 'plastic', label: 'Produce 40 de Plástico', icon: 'water-outline', goal: 40 },
    { metric: 'buildings', label: 'Construye 25 edificios (de por vida)', icon: 'city', goal: 25 },
  ] },
  // Rango 14 — COMBUSTIBLE: el producto más caro de la química básica; es la
  // inyección de dinero que paga las recetas de la Ensambladora del R15.
  { name: 'Refinería Marciana', icon: 'fuel', reward: { gems: 14, energy: 4400, credits: 13_000 }, missions: [
    { metric: 'buildType', buildingType: 'fuel_plant', label: 'Construye una Planta de Combustible', icon: 'fuel', goal: 1 },
    { metric: 'resource', resource: 'fuel', label: 'Produce 40 de Combustible', icon: 'fuel', goal: 40 },
    { metric: 'credits', label: 'Junta 250000 créditos', icon: 'cash', goal: 250_000 },
  ] },
  // Rango 15 — LA ENSAMBLADORA: el rango bisagra del acto. La Antena viene
  // gratis con el edificio, así que la misión se puede cumplir apenas se
  // construye — es la que le enseña al jugador que los módulos existen.
  // La investigación va explícita (ver la nota del R11): `precision_assembly` es
  // la que más profundo requiere de todo el árbol (Electrónica fina + Polímeros),
  // así que es justo donde peor sentaba el muro invisible.
  // "Instala 35 módulos" se fue al R16: instalar módulos ES el tema declarado del
  // acto ("optimizar lo que ya tenés"), y corresponde al rango que se llama
  // Optimización, no colgado del rango en que se construye la Ensambladora.
  { name: 'Línea de Montaje', icon: 'robot-industrial', reward: { gems: 15, energy: 4600, credits: 16_000 }, missions: [
    { metric: 'researchId', techId: 'precision_assembly', label: 'Investiga Ensamblaje de precisión', icon: 'robot-industrial', goal: 1 },
    { metric: 'buildType', buildingType: 'assembler', label: 'Construye una Ensambladora', icon: 'robot-industrial', goal: 1 },
    { metric: 'resource', resource: 'antenna', label: 'Fabrica 5 Antenas Cuánticas', icon: 'satellite-uplink', goal: 5 },
  ] },
  // Rango 16 — OPTIMIZAR: el Núcleo (+50% producción) y el Capacitor (−45% de
  // consumo) son los dos módulos que de verdad cambian cómo se juega.
  { name: 'Optimización', icon: 'hexagram', reward: { gems: 15, energy: 4800, credits: 19_000 }, missions: [
    { metric: 'resource', resource: 'core', label: 'Fabrica 3 Núcleos', icon: 'hexagram', goal: 3 },
    { metric: 'resource', resource: 'capacitor', label: 'Fabrica 5 Capacitores', icon: 'current-ac', goal: 5 },
    // Viene del R15. Y reemplaza a una meta de créditos a propósito: las metas de
    // crédito miden `lifetimeGains.credits`, donde también entra la RECOMPENSA en
    // créditos de cada rango — o sea que los rangos se pagaban a sí mismos en
    // parte. Quedan las de R14/R19/R20, que alcanzan como presión: los créditos
    // ya se gastan en licencias y desbloqueos de receta.
    { metric: 'modules', label: 'Instala 35 módulos', icon: 'chip', goal: 35 },
  ] },
  // Rango 17 — CALOR: refrigerante y reactor, la pareja que prepara la energía
  // pesada del acto III (el Reactor Nuclear va a EXIGIR refrigerante puesto).
  { name: 'Termodinámica', icon: 'snowflake', reward: { gems: 16, energy: 5000, credits: 23_000 }, missions: [
    { metric: 'resource', resource: 'coolant', label: 'Fabrica 5 Refrigerantes', icon: 'snowflake', goal: 5 },
    { metric: 'resource', resource: 'reactor', label: 'Fabrica 3 Reactores', icon: 'atom', goal: 3 },
    { metric: 'oxygen', label: 'Acumula 12000 O₂', icon: 'air-filter', goal: 12_000 },
  ] },
  // Rango 18 — ESCALA: por primera vez las metas piden VOLUMEN de química, no
  // estrenar algo. Acá es donde el jugador nota si montó bien sus cadenas.
  { name: 'Producción en Masa', icon: 'factory', reward: { gems: 16, energy: 5200, credits: 28_000 }, missions: [
    { metric: 'resource', resource: 'plastic', label: 'Produce 120 de Plástico', icon: 'water-outline', goal: 120 },
    { metric: 'modules', label: 'Instala 50 módulos', icon: 'chip', goal: 50 },
    { metric: 'buildings', label: 'Construye 40 edificios (de por vida)', icon: 'city', goal: 40 },
  ] },
  // Rango 19 — COMPLEJO: cerámica y combustible en cantidad. La cerámica es el
  // stock que hará falta para las máquinas de terraformación.
  { name: 'Complejo Industrial', icon: 'city-variant', reward: { gems: 17, energy: 5400, credits: 34_000 }, missions: [
    { metric: 'resource', resource: 'ceramic', label: 'Produce 100 de Cerámica', icon: 'pot', goal: 100 },
    { metric: 'resource', resource: 'fuel', label: 'Produce 100 de Combustible', icon: 'fuel', goal: 100 },
    { metric: 'credits', label: 'Junta 700000 créditos', icon: 'cash', goal: 700_000 },
  ] },
  // Rango 20 — CIERRE DEL ACTO II: la colonia entera corriendo con módulos de
  // bono. Desde acá arranca el acto III (energía pesada).
  { name: 'Potencia Marciana', icon: 'lightning-bolt', reward: { gems: 18, energy: 5600, credits: 42_000 }, missions: [
    { metric: 'resource', resource: 'core', label: 'Fabrica 8 Núcleos', icon: 'hexagram', goal: 8 },
    { metric: 'modules', label: 'Instala 65 módulos', icon: 'chip', goal: 65 },
    { metric: 'credits', label: 'Junta 1000000 créditos', icon: 'cash', goal: 1_000_000 },
  ] },
];

// Rangos 21-50 (índices 20-49): TODAVÍA generados por fórmula. Es contenido
// PROVISIONAL — los actos III (energía pesada), IV y V (terraformación) los van
// a reemplazar por rangos escritos a mano, igual que se hizo con el 11-20. Se
// deja la generación mientras tanto porque sin ella `RANKS[20]` no existiría y
// el jugador quedaría trabado al reclamar el rango 20 (claimRank devuelve false
// si no hay definición). NO agregar más contenido acá: va en su acto.
//
// El tope pasó de 100 a 50 rangos (MAX_RANK): 100 era una cifra puesta cuando el
// late game era relleno generado. Con 50 rangos de contenido real, el 50 es el
// final del arco —Marte terraformado— y ahí se reinicia con bonificación
// permanente (ver RANK_FOR_TRAVEL).
// Tope de rangos del juego. Bajó de 100 a 50: los 100 existían solo porque del
// 11 en adelante era todo relleno generado, y estirar relleno no es progresión.
// Con 50 rangos de contenido escrito a mano, el 50 es el FINAL del arco (Marte
// terraformado) y el punto de reinicio con bonificación permanente. Además el
// alcance de la colonia está calibrado para descubrir el mapa ENTERO justo al
// llegar al 50 (ver getBuildRange en functionsLib/buildings.ts).
export const MAX_RANK = 50;
const GENERATED_TIERS: { name: string; icon: string }[] = [
  { name: 'Federación Marciana', icon: 'flag-variant' },
  { name: 'Consorcio Interplanetario', icon: 'satellite-variant' },
  { name: 'Hegemonía Orbital', icon: 'orbit' },
  { name: 'Dominio Estelar', icon: 'star-four-points' },
  { name: 'Imperio Galáctico', icon: 'star-circle' },
];
// La economía ahora gira alrededor del DINERO (vender por cohete, Casa de Moneda,
// recompensas): cada rango generado lleva SIEMPRE una misión de créditos con meta
// de crecimiento compuesto — a rangos altos las metas llegan a millones y billones
// (se muestran con fmtNum: 1k, 1M, 1B, 1T). Las otras dos misiones ciclan entre
// métricas de colonia. 'research' NO se usa aquí: el árbol es finito (~29 técnicas)
// y una meta creciente lo superaría (softlock).
// 'drones' NO se usa acá (se usaba antes): el costo en GEMAS de un dron nuevo
// crece ~85%/unidad (getNewBuilderCost) mucho más rápido que la recompensa de
// gemas por rango (~5%/rango, ver abajo) — cualquier rango generado al que le
// tocara pedir drones quedaba con una meta prácticamente imposible de pagar
// sin meses de regalo diario. 'buildings' (totalBuildingsBuilt, de por vida)
// escala con jugar normal, sin ese cuello de botella de moneda escasa.
const GEN_OTHERS: RankMetric[] = ['modules', 'buildings', 'oxygen'];
// Bases levantadas: el primer generado ya no es el rango 12 sino el 21, que
// viene DESPUÉS de que el rango 20 pidiera 65 módulos y 40 edificios. Con las
// bases viejas (28 módulos / 15 edificios) las metas BAJABAN al cruzar de los
// escritos a mano a los generados, que es justo lo que no puede pasar.
const GEN_BASE: Record<string, number> = { modules: 70, buildings: 45, oxygen: 14_000 };
// Tope duro por métrica: se acota para que las metas sigan siendo alcanzables en rangos altos.
const GEN_CAP: Record<string, number> = { modules: 250, buildings: 300, oxygen: 500_000 };
// Mismo criterio: el rango 20 pide 1M de créditos, así que el 21 tiene que
// arrancar por encima de eso y no en 40k.
const CREDITS_BASE = 1_200_000;
const CREDITS_GROWTH = 1.26;          // meta de dinero: crecimiento fuerte…
const CREDITS_CAP = 1_000_000_000_000; // …con techo en 1 billón (1T)
// `GEN_FROM`: primer índice generado (hoy 20 = rango 21). Todas las curvas de
// abajo miden el avance desde ACÁ, no desde un 7 hardcodeado que venía de
// cuando los generados empezaban en el rango 8 — con los rangos escritos a mano
// creciendo, ese 7 hacía que el primer generado saltara a mitad de la curva.
const GEN_FROM = RANKS.length;
for (let i = GEN_FROM; i < MAX_RANK; i++) {
  const n = i + 1; // rango 21, 22... 50
  const tier = GENERATED_TIERS[Math.min(GENERATED_TIERS.length - 1, Math.floor((i - GEN_FROM) / 6))];
  const m2 = GEN_OTHERS[i % GEN_OTHERS.length];
  const m3 = GEN_OTHERS[(i + 1) % GEN_OTHERS.length];
  const goalFor = (m: RankMetric): number => Math.min(GEN_CAP[m], Math.round(GEN_BASE[m] * Math.pow(1.11, i - GEN_FROM)));
  const label = (m: RankMetric, goal: number): { label: string; icon: string } => {
    const table: Partial<Record<RankMetric, { label: string; icon: string }>> = {
      modules: { label: `Instala ${goal} módulos`, icon: 'chip' },
      buildings: { label: `Construye ${goal} edificios (de por vida)`, icon: 'city' },
      oxygen: { label: `Acumula ${fmtNum(goal)} O₂`, icon: 'air-filter' },
    };
    return table[m] ?? { label: `${goal}`, icon: 'star' };
  };
  const gC = Math.min(CREDITS_CAP, Math.round(CREDITS_BASE * Math.pow(CREDITS_GROWTH, i - GEN_FROM)));
  const g2 = goalFor(m2), g3 = goalFor(m3);
  RANKS.push({
    name: `${tier.name} · Nv ${n}`, icon: tier.icon,
    // Arranca donde dejó el rango 20 (18 gemas / 5600 energía / 42k créditos):
    // la recompensa tampoco puede BAJAR al cruzar a los generados.
    reward: { gems: Math.round(18 * Math.pow(1.05, i - GEN_FROM)), energy: Math.round(5600 * Math.pow(1.06, i - GEN_FROM)), credits: Math.round(46_000 * Math.pow(1.18, i - GEN_FROM)) },
    missions: [
      { metric: 'credits', label: `Gana ${fmtNum(gC)} créditos`, icon: 'cash', goal: gC },
      { metric: m2, ...label(m2, g2), goal: g2 },
      { metric: m3, ...label(m3, g3), goal: g3 },
    ],
  });
}
// Sanity check en dev: exactamente MAX_RANK rangos (índices 0..MAX_RANK-1).
if (RANKS.length !== MAX_RANK) console.warn(`[RANKS] se esperaban ${MAX_RANK} rangos, hay ${RANKS.length}`);

// ── Planetas del sistema solar ───────────────────────────────────────────────────
// Al llegar al Rango 100 (índice 99) el cohete permite VIAJAR al siguiente planeta:
// se reinicia la colonia (rango 0, edificios, mapa nuevo) pero conservas gemas,
// racha, pasos totales, recursos descubiertos e investigación ya aprendida —
// un "New Game+" real, no solo un número más grande.
export type Planet = 'mars' | 'moon' | 'mercury' | 'venus' | 'earth';
export interface PlanetDef { name: string; icon: string; color: string; description: string; seed: number; sky: [string, string, string] }
export const PLANET_ORDER: Planet[] = ['mars', 'moon', 'mercury', 'venus', 'earth'];
export const PLANET_DEF: Record<Planet, PlanetDef> = {
  mars: { name: 'Marte', icon: 'image-filter-hdr', color: '#FF7A45', description: 'El planeta rojo. Tu primera colonia.', seed: 0x5eed1234, sky: ['#3a1608', '#6e2a12', '#a8431f'] },
  moon: { name: 'La Luna', icon: 'moon-waning-crescent', color: '#c9c9d8', description: 'Baja gravedad, vetas de hielo y regolito fino.', seed: 0x1001, sky: ['#0a0a14', '#1c1c2e', '#3a3a52'] },
  mercury: { name: 'Mercurio', icon: 'weather-sunny-alert', color: '#b8a04a', description: 'Calor extremo: vetas metálicas riquísimas.', seed: 0x2002, sky: ['#2a1a04', '#5a3a10', '#9a7a2a'] },
  venus: { name: 'Venus', icon: 'weather-cloudy-alert', color: '#e0a860', description: 'Atmósfera densa y tóxica. Azufre por todas partes.', seed: 0x3003, sky: ['#3a2a08', '#7a5a1a', '#c8a040'] },
  earth: { name: 'La Tierra', icon: 'earth', color: '#4a9ae8', description: 'El planeta natal, ahora como colonia avanzada.', seed: 0x4004, sky: ['#08182a', '#123a5e', '#2a6a9a'] },
};
// state.rank llega a MAX_RANK tras reclamar todos los rangos. Ahí se desbloquea
// reiniciar en un planeta nuevo — que a futuro dará una bonificación PERMANENTE
// de producción y créditos (el "Legado"), para que cada vuelta sea más rápida
// que la anterior. Hoy el reinicio ya conserva gemas, racha y descubrimientos.
export const RANK_FOR_TRAVEL = MAX_RANK;

// ── Desbloqueo por rango ────────────────────────────────────────────────────────
// Cada edificio se desbloquea a partir de cierto rango (índice 0 = Rango 1). Los que
// no figuran están disponibles desde el inicio. Algunos además tienen un TOPE de
// cantidad por rango (p. ej. la batería: 1 en el Rango 2, más en rangos superiores).
// Piso por rango (pacing temprano). El desbloqueo PRINCIPAL de los edificios
// avanzados es la INVESTIGACIÓN (ver BUILDING_TECH): ambos requisitos deben
// cumplirse. Los edificios base (rank 0/1) no requieren investigación.
export const BUILDING_UNLOCK_RANK: Partial<Record<BuildingType, number>> = {
  warehouse: 1, battery: 1, oxygen_generator: 1, gas_tank: 1, refinery: 2,
  smelter: 1, brine_pump: 2,
  // Rango 4 + ADEMÁS la tech 'heavy_construction' (Construcción pesada) para
  // la Fábrica — la misión del Rango 4 obliga a pasar por la investigación.
  // Las fábricas T2/T3 abren justo a tiempo para el peldaño de la escalera
  // de materiales que las necesita (cables en el R7, oro en el R10).
  fabrica: 4, fabrica_avanzada: 7, fabrica_exotica: 9,
  laboratorio: 2, electronics_factory: 5,
  // ACTO II — uno por rango, del 11 al 15: cada rango del acto estrena su
  // edificio y la misión de ese rango lo pide. Todos además cuelgan de una
  // técnica nueva (ver BUILDING_TECH/RESEARCH_TREE), así la investigación
  // vuelve a ser el motor de la progresión y no una lista de bonos sueltos.
  chemical_plant: 11, ceramic_kiln: 12, polymer_plant: 13, fuel_plant: 14, assembler: 15,
};

export const BUILDING_RANK_LIMITS: Partial<Record<BuildingType, number[]>> = {
  battery: extendLimits([0, 1, 2, 4, 7], 1.35, MAX_RANK, 300),
  power_plant: extendLimits([1, 2, 4, 6, 10], 1.3, MAX_RANK, 200),
  base: [1, 1, 1, 1, 1],
  rocket: [1, 1, 1, 1, 1],
};

// ── Almacenamiento (topes) ────────────────────────────────────────────────────
export const BASE_ENERGY_CAP = 500;
export const BASE_GOODS_CAP = 300;
export const BASE_GAS_CAP = 200;
// Reserva BASE de un circuito AISLADO (sin cohete), por red: chica pero
// suficiente para que las máquinas de una avanzada funcionen sin exigir
// batería/almacén/tanque propios — antes el tope arrancaba en 0 y TODO lo
// producido se recortaba a cero al final de cada tick, así que un circuito
// sin edificio de almacenamiento no podía sostener nada funcionando.
// Construir batería/almacén/tanque en el circuito sigue subiendo el tope.
export const ISOLATED_ENERGY_CAP = 100;
export const ISOLATED_GOODS_CAP = 100;
export const ISOLATED_GAS_CAP = 50;
// Tope de almacenamiento de UN circuito para UNA red — solo cuenta los edificios de
// almacenamiento (batería/almacén/tanque) que sean MIEMBROS de ese circuito concreto.
// `isHome` añade el tope base (el que tiene la colonia aunque no construyas nada) —
// solo el circuito hogar (el que contiene el cohete) lo recibe; cualquier otro
// circuito remoto/aislado depende ÚNICAMENTE de sus propios edificios de almacén.
// La capacidad de un edificio de almacenamiento tiene un TOPE de nivel (no crece
// infinito) — a partir de ahí subir su "capacidad" ya no es posible.
export const MAX_STORAGE_CAP_LEVEL = 10;
// Máximo de CONSUMIDORES conectados a UN MISMO circuito — aplica a las TRES
// redes (eléctrica, de agua y de gas). Al llegar acá no se puede seguir
// extendiendo ESE circuito (tendido/edificio nuevo): hay que formar uno aislado
// aparte (con su propia fuente/reserva).
export const MAX_POWER_CIRCUIT_MEMBERS = 10;



// Mejoras independientes (reemplazan el antiguo "nivel" único): velocidad de
// ciclo, eficiencia de consumo (energía/insumo) y capacidad de slots de módulo.
// Para edificios de almacenamiento (batería/almacén/tanque) `speedLevel` se
// reutiliza como "capacidad" (sube storage.amount) ya que no tienen ciclo de
// producción; en el almacén también extiende el alcance de construcción.
// Cola de producción: por defecto un edificio "de proceso" (con recetas) NO produce
// nada — hay que encolar manualmente qué fabricar. Hasta MAX_QUEUE_KINDS tipos de
// receta distintos a la vez (cada uno con su propia cantidad pendiente); se procesan
// en orden (el primero de la lista) y al agotarse pasa el siguiente.
// amount === INFINITE_QUEUE (-1): cupo INDEFINIDO — nunca se agota ni se quita
// solo de la cola (hay que sacarlo a mano). Se usa -1 en vez de `Infinity` porque
// JSON (AsyncStorage) serializa `Infinity` como `null` y se perdería al recargar.
export interface QueueEntry { recipeId: string; amount: number }
export const MAX_QUEUE_KINDS = 2;
export const INFINITE_QUEUE = -1;
// `clickLevel` (mejora "Boost de Click") es OPCIONAL a propósito: los edificios
// ya guardados no lo traen y se leen como nivel 1 (ver getClickLevel), así que
// no hace falta migrar la partida por agregarlo.
export interface PlacedBuilding { type: BuildingType; speedLevel: number; effLevel: number; slotLevel: number; clickLevel?: number; x: number; y: number; progress: number; modules?: ComponentResource[]; queue?: QueueEntry[]; paused?: boolean; speedBoostUntil?: number; freePowerUntil?: number; disconnected?: Partial<Record<ConnectorKind, true>> }
export interface Builder { id: number; x: number; y: number; status: 'idle' | 'moving' | 'working'; jobKey: string | null; speedLevel: number; buildLevel: number; modules?: ComponentResource[] }
// Slots de componentes de un dron (crecen con el nivel de motores).


// ── Módulos de componentes (slots) ──────────────────────────────────────────────
// Cada edificio tiene SLOTS. Los slots de conexión (energía/agua/gas) son fijos
// según lo que el edificio necesita. Los slots de MÓDULO se desbloquean por nivel
// y aceptan un Componente fabricado que aplica una mejora al edificio.
// `appliesTo`: categorías de edificio donde encaja el módulo. Si es undefined el
// módulo es GENÉRICO (sirve en cualquier edificio). Así hay piezas específicas y
// piezas comodín. `drone` = true si además puede instalarse en un dron.
export interface ModuleDef { resource: ComponentResource; name: string; icon: string; effect: string; prodBonus: number; speedBonus: number; powerBonus: number; appliesTo?: BuildingCategory[]; drone?: boolean }

export type UtilityKind = 'road' | 'cable' | 'pipe' | 'gas';
export const UTILITY_BUILD_MS = 20_000;  // 20 s por casilla de utilidad
export interface Job {
  kind: 'build' | 'clear' | 'demolish' | 'build_utility';
  buildingType?: BuildingType;
  utilityKind?: UtilityKind;
  // Costo REAL pagado al pedir un tile de red (ver getNetworkTileCost): el precio
  // sube con la cantidad ya construida de ese tipo, así que ya no es un valor fijo
  // recuperable desde ROAD_COST/etc — hay que guardar lo que se pagó DE VERDAD
  // para poder reembolsarlo exacto si se cancela la obra.
  paidCost?: number;
  x: number; y: number; workMs: number; startedAt: number | null; builderId: number | null;
}
export interface OfflineReport { durationMs: number; gains: Record<ResourceType, number>; newlyDiscovered: GatedResource[] }

// ── Alcance de construcción ──────────────────────────────────────────────────
// Los drones solo construyen dentro del ALCANCE de una base. El alcance del COHETE
// crece con el RANGO del jugador (no con su nivel — eso ahora solo da compartimentos).
// Los ALMACENES sí son avanzadas de verdad: subir su nivel extiende el área, así se
// "descubre"/expande el mapa. Alcance = distancia Chebyshev (cuadrado).
export const BASE_BUILD_RANGE = 6;
export const RANGE_SOURCES: BuildingType[] = ['base', 'warehouse'];

// Circuitos AISLADOS: cada red (cables/caminos/tuberías/gas) desconectada de las
// demás es su propio circuito, con su propio almacén — construir una central+
// batería, o una mina+almacén, lejos de la base principal (sin conexión física)
// alimenta/almacena SOLO lo que esté en ESE circuito, no el pozo global. El
// "circuito hogar" (el que contiene el cohete) sigue usando `resources` tal cual
// (compatibilidad con costes de construcción, HUD, etc.); cualquier OTRO circuito
// usa su propio pozo en `circuitStock[red:ancla]`.
export interface NetCircuit {
  id: string
  members: string[]
}

// ── Caché de circuitos por firma de topología ─────────────────────────────────
// computeCircuits (BFS + agrupado) solo depende de `key`+`type` de cada edificio
// y de qué celdas de la red están en `true` — NO de progress/queue/recursos. Sin
// esto, tickProduction recalculaba los 4 grafos desde cero cada segundo aunque
// nada hubiera cambiado desde el tick anterior. Caché a nivel de módulo (NO
// persistida, se recalcula sola en el próximo tick tras recargar la app).
export type CircuitKind = "power" | "road" | "pipe" | "gas"
export const circuitCache: Partial<
  Record<CircuitKind, { buildingsSig: string; networkSig: string; result: NetCircuit[] }>
> = {}