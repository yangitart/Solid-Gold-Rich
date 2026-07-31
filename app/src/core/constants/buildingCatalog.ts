import { BuildingDef, BuildingType, PERFORADORA_DEPOSITS } from "./gridConstants";

export const BUILDING_CATALOG: Record<BuildingType, BuildingDef> = {
  base: {
    type: 'base', name: 'Base de la Colonia',
    description: 'El corazón de la colonia: genera y almacena energía, y produce O₂. Ancla de toda la red.',
    icon: 'domain', buildCost: 0, buildMs: 0, cycleMs: 12_000,
    // 15 de energía es el pico de MEDIODÍA: el bono sigue al sol (`sunMult`), a
    // media mañana/tarde da la mitad y de noche cae al piso de BASE_NIGHT_ENERGY.
    output: { resource: 'oxygen', amount: 1 }, bonusOutput: { resource: 'energy', amount: 15 },
    powerUse: 0, needsPower: false, needsRoad: false, needsPipe: false,
    upgradeCostBase: 100, upgradeMultiplier: 1.8, sellable: false, buildable: false, category: 'logistics',
  },
  rocket: {
    type: 'rocket', name: 'Cohete de Carga',
    description: 'Aquí se carga la mercancía para comerciar con otros planetas. Los rovers llegan y descargan aquí.',
    icon: 'rocket-launch', buildCost: 0, buildMs: 0, cycleMs: 1_000,
    // El cohete se MANTIENE encendido: soporte vital de la tripulacion, bombas
    // y torre. Gasta 1 de energia, 1 de agua y 1 de oxigeno por ciclo (ver
    // ROCKET_UPKEEP_*), asi que tiene las cuatro tomas y su consumo se ve en las
    // vistas de red igual que el de cualquier otro edificio.
    powerUse: 1, needsPower: true, needsRoad: true, needsPipe: true, gasPort: true,
    upgradeCostBase: 100, upgradeMultiplier: 1.8, sellable: false, buildable: false, category: 'logistics',
  },
  water_pump: {
    type: 'water_pump', name: 'Bomba de Agua',
    description: 'Va sobre un depósito de agua. Extrae agua para la colonia.',
    icon: 'pump', buildCost: 90, buildMs: 80_000, cycleMs: 6_000,
    output: { resource: 'water', amount: 3 }, powerUse: 3, needsPower: true, needsRoad: false, needsPipe: true, requiresDeposit: 'water',
    upgradeCostBase: 25, upgradeMultiplier: 1.6, sellable: true, buildable: true, category: 'extraction',
  },
  collector: {
    // Renombrado de "Perforadora de Tierra": desde que existe el edificio
    // único "Perforadora" (veta sólida + módulo), ese nombre quedaba
    // confundible con este otro edificio distinto (recolecta tierra suelta,
    // sin necesitar veta).
    type: 'collector', name: 'Recolector de Tierra',
    description: 'Recoge regolito del suelo normal: sobre todo tierra, algo de hierro. Rinde poco, va en cualquier parte.',
    icon: 'collector', buildCost: 50, buildMs: 60_000, cycleMs: 7_500,
    output: { resource: 'dirt', amount: 3 }, extraOutputs: [{ resource: 'mineral', amount: 1 }],
    powerUse: 2, needsPower: true, needsRoad: true, needsPipe: false,
    upgradeCostBase: 20, upgradeMultiplier: 1.5, sellable: true, buildable: true, category: 'extraction',
  },
  // Perforadora ÚNICA: reemplaza los 11 edificios de extracción que existían
  // antes (uno por cada veta sólida). Se para sobre CUALQUIERA de esas vetas
  // (ver requiresDepositOneOf/PERFORADORA_DEPOSITS) y extrae mineral de hierro
  // de fábrica, sin módulo — para cualquier otra veta hace falta instalarle el
  // módulo correspondiente (fabricado en la Fábrica), si no, no produce nada
  // (ver tickProduction/ORE_MODULE_FOR_RESOURCE en gridConstants.ts).
  perforadora: {
    type: 'perforadora', name: 'Perforadora',
    description: 'Se para sobre cualquier veta sólida y extrae mineral de hierro de fábrica. Para sacar otro material (sílice, cobre, titanio, aluminio, carbono, azufre, oro, uranio, cristal, helio-3) necesita el módulo correspondiente instalado, fabricado en la Fábrica.',
    icon: 'pickaxe', buildCost: 90, buildMs: 90_000, cycleMs: 4_500,
    output: { resource: 'mineral', amount: 4 }, powerUse: 3, needsPower: true, needsRoad: true, needsPipe: false, requiresDepositOneOf: PERFORADORA_DEPOSITS,
    upgradeCostBase: 25, upgradeMultiplier: 1.6, sellable: true, buildable: true, category: 'extraction',
  },
  // ── Logística: el ORDEN de declaración ES el orden del Constructor (ver
  //    CATALOG_ORDER) — impresora, batería, central, almacén, generador de O₂,
  //    luego la refinería y el resto. ─────────────────────────────────────────
  block_printer: {
    type: 'block_printer', name: 'Impresora de Bloques',
    description: 'Imprime bloques de construcción a partir de tierra. Disponible desde el inicio — la refinería se desbloquea después.',
    icon: 'printer-3d', buildCost: 70, buildMs: 65_000, cycleMs: 22_000,
    input: { resource: 'dirt', amount: 50 }, output: { resource: 'blocks', amount: 1 },
    powerUse: 3, needsPower: true, needsRoad: true, needsPipe: false,
    upgradeCostBase: 24, upgradeMultiplier: 1.6, sellable: true, buildable: true, category: 'logistics',
  },
  // Marte recibe ~43% de la luz que recibe la Tierra, así que un panel rinde
  // menos que acá — pero no necesita insumos ni gasoducto, que es justo lo que
  // hace falta al arrancar. Su gracia (y su problema) es que sigue al sol: da su
  // máximo al mediodía y CERO de noche. Ver SOLAR_OUTPUT en tickProduction.
  solar_panel: {
    type: 'solar_panel', name: 'Panel Solar',
    description: 'Genera energía del sol, sin insumos ni conexiones. Rinde según la altura del sol: a pleno mediodía da el máximo y de noche NO PRODUCE NADA. Combínalo con baterías para cruzar la noche.',
    icon: 'solar-panel', buildCost: 80, buildMs: 70_000, cycleMs: 4_000,
    output: { resource: 'energy', amount: 6 },
    powerUse: 0, needsPower: false, needsRoad: false, needsPipe: false, needsGas: false,
    upgradeCostBase: 26, upgradeMultiplier: 1.6, sellable: true, buildable: true, category: 'energy',
  },
  // Lampara sobre un mastil: ilumina las celdas de alrededor durante la noche
  // (ver LIGHT_SOURCES). Es de lo mas barato del juego y gasta 1 de energia —
  // no es una maquina, es una luz, y sin ella la noche deja la colonia paralizada
  // fuera del radio del cohete y la base.
  light_tower: {
    type: 'light_tower', name: 'Torre de Luz',
    description: 'Ilumina las celdas de alrededor durante la noche marciana, para poder seguir construyendo cuando se hace de noche. Gasta muy poca energía: es una lámpara, no una máquina.',
    icon: 'lightbulb-on', buildCost: 45, buildMs: 40_000, cycleMs: 1_000,
    powerUse: 1, needsPower: true, needsRoad: false, needsPipe: false, needsGas: false,
    upgradeCostBase: 18, upgradeMultiplier: 1.5, sellable: true, buildable: true, category: 'energy',
  },
  battery: {
    type: 'battery', name: 'Batería',
    description: 'Almacena energía: sube el tope. Imprescindible con paneles solares — es lo que guarda de día para gastar de noche. Extiende la red de cables.',
    icon: 'battery', buildCost: 90, buildMs: 75_000, cycleMs: 1_000,
    powerUse: 0, needsPower: false, needsRoad: false, needsPipe: false, storage: { kind: 'energy', amount: 200 },
    upgradeCostBase: 30, upgradeMultiplier: 1.6, sellable: true, buildable: true, category: 'energy',
  },
  power_plant: {
    type: 'power_plant', name: 'Central Eléctrica',
    description: 'Quema oxígeno para generar Energía y alimentar la red de cables (receta por defecto — necesita gasoducto). Quemar mineral o carbono es más eficiente pero hay que desbloquearlo. Conectarla a un gasoducto con oxígeno de sobra además da un bono de producción sobre cualquier receta activa.',
    icon: 'plant', buildCost: 120, buildMs: 110_000, cycleMs: 9_000,
    input: { resource: 'oxygen', amount: 4 }, output: { resource: 'energy', amount: 18 },
    powerUse: 0, needsPower: false, needsRoad: false, needsPipe: false, needsGas: false, gasPort: true,
    gasBoost: { mult: 1.3, oxygenPerCycle: 10 },
    upgradeCostBase: 35, upgradeMultiplier: 1.7, sellable: true, buildable: true, category: 'energy',
  },
  warehouse: {
    type: 'warehouse', name: 'Almacén',
    description: 'Guarda mineral y agua: sube el tope. Recibe por caminos.',
    icon: 'warehouse', buildCost: 90, buildMs: 75_000, cycleMs: 1_000,
    powerUse: 0, needsPower: false, needsRoad: false, needsPipe: false, storage: { kind: 'goods', amount: 600 },
    upgradeCostBase: 30, upgradeMultiplier: 1.6, sellable: true, buildable: true, category: 'life',
  },
  oxygen_generator: {
    type: 'oxygen_generator', name: 'Generador de O₂',
    description: 'Consume agua (y un poco de tierra como filtro) para sintetizar oxígeno. Conéctalo con tubería a una bomba de agua — no necesita camino, el oxígeno no se transporta en cinta. Trae su PROPIO puerto de gasoducto: ya es fuente de la red (GAS_SOURCES), esto solo hace visible el conector para tenderle un gasoducto real.',
    icon: 'generator', buildCost: 110, buildMs: 100_000, cycleMs: 5_000,
    input: { resource: 'water', amount: 2 }, output: { resource: 'oxygen', amount: 5 },
    powerUse: 3, needsPower: true, needsRoad: false, needsPipe: true, gasPort: true,
    upgradeCostBase: 30, upgradeMultiplier: 1.6, sellable: true, buildable: true, category: 'life',
  },
  refinery: {
    type: 'refinery', name: 'Refinería',
    description: 'Refina mineral de hierro, sílice, cobre o aluminio en el material de verdad (Hierro, Sílice, Cobre, Aluminio). Ese material se convierte en el producto final en la fundición o la fábrica. Elige la receta. Cada ciclo también consume agua y oxígeno (necesita tubería y gasoducto conectados).',
    icon: 'refinery', buildCost: 160, buildMs: 120_000, cycleMs: 22_000,
    input: { resource: 'mineral', amount: 50 }, output: { resource: 'ironore', amount: 2 },
    powerUse: 4, needsPower: true, needsRoad: true, needsPipe: true, needsGas: true,
    upgradeCostBase: 40, upgradeMultiplier: 1.7, sellable: true, buildable: true, category: 'logistics',
  },
  gas_tank: {
    type: 'gas_tank', name: 'Tanque de Gas',
    description: 'Almacena oxígeno: sube el tope de gas de la colonia.',
    icon: 'gas-cylinder', buildCost: 100, buildMs: 80_000, cycleMs: 1_000,
    powerUse: 0, needsPower: false, needsRoad: false, needsPipe: false, storage: { kind: 'gas', amount: 300 },
    upgradeCostBase: 32, upgradeMultiplier: 1.6, sellable: true, buildable: true, category: 'life',
  },
  // Laboratorio ÚNICO: reemplaza el Laboratorio base + los 4 especializados
  // (de Fluidos/Gases/Energético/Exótico). Sin módulo instalado produce
  // Ciencia Básica (receta de siempre, con el mismo consumo extra fijo de
  // agua/oxígeno — ver LAB_OXYGEN_PER_CYCLE/LAB_WATER_PER_CYCLE en
  // productionSlice.ts); con un módulo de ciencia instalado (fabricado en la
  // Fábrica) produce esa ciencia especializada en su lugar (ver
  // LABORATORIO_MODULE_RECIPE en gridConstants.ts).
  laboratorio: {
    type: 'laboratorio', name: 'Laboratorio',
    description: 'Analiza mineral para generar Ciencia Básica. Consume mucha energía, agua y oxígeno (tubería y gasoducto obligatorios). Con un módulo de ciencia instalado (Fábrica) produce esa ciencia especializada en vez de la básica.',
    icon: 'flask', buildCost: 210, buildMs: 126_000, cycleMs: 26_000,
    input: { resource: 'mineral', amount: 3 }, output: { resource: 'research', amount: 1 },
    powerUse: 40, needsPower: true, needsRoad: false, needsPipe: true, needsGas: true,
    upgradeCostBase: 57, upgradeMultiplier: 1.73, sellable: true, buildable: true, category: 'research',
  },
  // ── Extractores especializados ──────────────────────────────────────────────
  brine_pump: {
    type: 'brine_pump', name: 'Bomba de Salmuera',
    description: 'Extrae salmuera subterránea. Base para procesos químicos.',
    icon: 'water-opacity', buildCost: 110, buildMs: 85_000, cycleMs: 7_500,
    output: { resource: 'brine', amount: 2 }, powerUse: 3, needsPower: true, needsRoad: false, needsPipe: true, requiresDeposit: 'brine',
    upgradeCostBase: 28, upgradeMultiplier: 1.6, sellable: true, buildable: true, category: 'extraction',
  },
  // ── Edificios de refinado ──────────────────────────────────────────────────
  smelter: {
    type: 'smelter', name: 'Fundición',
    description: 'Funde el material refinado. El Acero siempre está disponible en su cola; Vidrio, Cables y Aleación se suman a esa misma cola cuando instalás el módulo correspondiente (fabricado en la Fábrica) y pagás el desbloqueo de la receta.',
    icon: 'fire', buildCost: 140, buildMs: 110_000, cycleMs: 5_000,
    input: { resource: 'ironore', amount: 4 }, output: { resource: 'steel', amount: 2 },
    powerUse: 5, needsPower: true, needsRoad: true, needsPipe: false,
    upgradeCostBase: 38, upgradeMultiplier: 1.7, sellable: true, buildable: true, category: 'logistics',
  },
  // Fábricas: las constructoras de MÓDULOS (cola de recetas, como la vieja
  // Constructora de Componentes), en TRES tiers para que ninguna acumule 17
  // recetas en el panel. Los módulos de veta se instalan en la Perforadora,
  // los de material en la FUNDICIÓN (ver SMELTER_RECIPE_MODULE) y los de
  // ciencia en el Laboratorio. Sin nada encolado no producen nada.
  fabrica: {
    type: 'fabrica', name: 'Fábrica',
    description: 'Fabrica los MÓDULOS básicos de la cadena: Sílice, Vidrio, Cobre, Carbono y Fluidos. Los de veta se instalan en la Perforadora, los de material en la Fundición y los de ciencia en el Laboratorio. Cada receta se desbloquea con créditos.',
    icon: 'robot-industrial', buildCost: 180, buildMs: 123_750, cycleMs: 15_000,
    powerUse: 7, needsPower: true, needsRoad: true, needsPipe: false, needsGas: true,
    upgradeCostBase: 45, upgradeMultiplier: 1.7, sellable: true, buildable: true, category: 'components',
  },
  fabrica_avanzada: {
    type: 'fabrica_avanzada', name: 'Fábrica Avanzada',
    description: 'El tramo medio de la cadena de módulos: Cables, Aluminio, Titanio, Gases, Azufre y Aleación. Mismo funcionamiento que la Fábrica: cola de recetas, cada una se desbloquea con créditos.',
    icon: 'cog-box', buildCost: 260, buildMs: 150_000, cycleMs: 14_000,
    powerUse: 9, needsPower: true, needsRoad: true, needsPipe: false, needsGas: true,
    upgradeCostBase: 58, upgradeMultiplier: 1.75, sellable: true, buildable: true, category: 'components',
  },
  fabrica_exotica: {
    type: 'fabrica_exotica', name: 'Fábrica Exótica',
    description: 'El final de la cadena de módulos: Oro, Energético, Uranio, Cristal, Exótico y Helio-3. Mismo funcionamiento que la Fábrica: cola de recetas, cada una se desbloquea con créditos.',
    icon: 'atom', buildCost: 380, buildMs: 180_000, cycleMs: 13_000,
    powerUse: 12, needsPower: true, needsRoad: true, needsPipe: false, needsGas: true,
    upgradeCostBase: 72, upgradeMultiplier: 1.8, sellable: true, buildable: true, category: 'components',
  },
  // ── Componentes chicos (se instalan en los slots de edificios y drones) ─────
  electronics_factory: {
    type: 'electronics_factory', name: 'Fábrica de Electrónica',
    description: 'Componentes pequeños a partir del Sílice refinado: circuitos, servos y sensores. Se instalan en slots de edificios/drones, y los módulos avanzados de la Fábrica los piden. Tripulación necesita O₂.',
    icon: 'chip', buildCost: 240, buildMs: 150_000, cycleMs: 10_000,
    input: { resource: 'silicaore', amount: 6 }, output: { resource: 'circuit', amount: 1 },
    powerUse: 6, needsPower: true, needsRoad: true, needsPipe: false, needsGas: true,
    upgradeCostBase: 60, upgradeMultiplier: 1.8, sellable: true, buildable: true, category: 'components',
  },
  // ── ACTO II (rangos 11-20): química y componentes de bono ───────────────────
  // Los cuatro primeros son de UNA receta: existen para que `acid`/`ceramic`/
  // `plastic`/`fuel` dejen de ser tipos de recurso imposibles de conseguir.
  // Todos piden agua por tubería — son procesos húmedos, y eso los ata a la red
  // de agua igual que la refinería (no son otra caja seca más sobre la cinta).
  chemical_plant: {
    type: 'chemical_plant', name: 'Planta Química',
    description: 'Ataca el azufre con agua para producir Ácido Sulfúrico, la base de toda la química de la colonia (polímeros, refrigerante, combustible). Necesita tubería.',
    icon: 'flask-round-bottom', buildCost: 260, buildMs: 150_000, cycleMs: 11_000,
    input: { resource: 'sulfur', amount: 4 }, output: { resource: 'acid', amount: 2 },
    powerUse: 8, needsPower: true, needsRoad: true, needsPipe: true, needsGas: false,
    upgradeCostBase: 62, upgradeMultiplier: 1.78, sellable: true, buildable: true, category: 'logistics',
  },
  ceramic_kiln: {
    type: 'ceramic_kiln', name: 'Horno Cerámico',
    description: 'Cuece sílice refinada hasta convertirla en Cerámica: aguanta el calor y la radiación, así que es el material de las máquinas pesadas que vienen después.',
    icon: 'pot', buildCost: 280, buildMs: 155_000, cycleMs: 13_000,
    input: { resource: 'silicaore', amount: 2 }, output: { resource: 'ceramic', amount: 2 },
    powerUse: 10, needsPower: true, needsRoad: true, needsPipe: false, needsGas: true,
    upgradeCostBase: 66, upgradeMultiplier: 1.78, sellable: true, buildable: true, category: 'logistics',
  },
  polymer_plant: {
    type: 'polymer_plant', name: 'Refinería de Polímeros',
    description: 'Convierte ácido en Plásticos. Livianos y aislantes: con ellos se fabrican los capacitores. Necesita una Planta Química que le dé ácido.',
    icon: 'water-outline', buildCost: 300, buildMs: 160_000, cycleMs: 12_000,
    input: { resource: 'acid', amount: 3 }, output: { resource: 'plastic', amount: 2 },
    powerUse: 9, needsPower: true, needsRoad: true, needsPipe: true, needsGas: false,
    upgradeCostBase: 70, upgradeMultiplier: 1.78, sellable: true, buildable: true, category: 'logistics',
  },
  fuel_plant: {
    type: 'fuel_plant', name: 'Planta de Combustible',
    description: 'Sintetiza Combustible a partir de ácido. El producto más caro de la química básica: se vende muy bien y es el insumo del Refrigerante.',
    icon: 'fuel', buildCost: 320, buildMs: 165_000, cycleMs: 12_000,
    input: { resource: 'acid', amount: 4 }, output: { resource: 'fuel', amount: 2 },
    powerUse: 10, needsPower: true, needsRoad: true, needsPipe: true, needsGas: false,
    upgradeCostBase: 74, upgradeMultiplier: 1.8, sellable: true, buildable: true, category: 'logistics',
  },
  // La Ensambladora es el edificio MÁS importante del acto II: fabrica los 5
  // módulos de BONO (Núcleo/Refrigerante/Capacitor/Reactor/Antena), que hasta
  // ahora estaban definidos con efectos reales en MODULE_CATALOG y no había
  // forma de conseguirlos. Es la primera vez en la partida que el jugador puede
  // OPTIMIZAR lo que ya tiene en vez de solo construir más.
  assembler: {
    type: 'assembler', name: 'Ensambladora',
    description: 'Fabrica los módulos de bono que mejoran cualquier edificio: Núcleo (+50% producción), Refrigerante (+45% velocidad), Capacitor (−45% consumo), Reactor (+100% en centrales) y Antena. Elige qué fabricar en su cola.',
    icon: 'robot-industrial', buildCost: 420, buildMs: 185_000, cycleMs: 16_000,
    powerUse: 14, needsPower: true, needsRoad: true, needsPipe: false, needsGas: true,
    upgradeCostBase: 80, upgradeMultiplier: 1.82, sellable: true, buildable: true, category: 'components',
  },
};

// ── Encarecimiento GLOBAL (a pedido): construir cuesta más dinero y las obras
// tardan más. Se aplica UNA vez sobre los números base de arriba, así los
// valores listados siguen siendo comparables entre sí (proporciones intactas).
// Los materiales de obra escalan solos (getBuildMaterials deriva de buildCost).
// El multiplicador de TIEMPO bajó de 1.7 a 1.4 (a pedido: "reducir el tiempo de
// idle" — las obras se sentían demasiado lentas/muertas). El de costo se deja
// igual: el objetivo era la ESPERA, no el precio.
for (const def of Object.values(BUILDING_CATALOG)) {
  if (def.buildable) {
    def.buildCost = Math.round(def.buildCost * 1.5);
    def.buildMs = Math.round(def.buildMs * 1.4);
  }
}