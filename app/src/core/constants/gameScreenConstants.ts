// Pasos de ACCIÓN (manual:false) avanzan solos al detectarse hecho (ver los
// useEffect de detección en GameScreen.tsx) — solo los informativos muestran "Entendido".
// `target` decide dónde apunta la manito CUANDO no hay otro modal abierto encima
// (si hay uno, ese modal recibe la MISMA tarjeta por su cuenta — ver tutorialCard
// en ConstructorModal/RankModal/el TabModal de Recursos).
export type TutorialTarget = 'none' | 'rankBtn' | 'buildTab' | 'waterDeposit' | 'rightOfBase' | 'resourcesTab';
// Ícono de la burbuja del rover cuando la tarjeta está EXPANDIDA: el mismo que el
// botón al que apunta ese paso. La burbuja MINIMIZADA siempre usa un bombillo
// (ver GameScreen.tsx) — no tiene sentido mostrar ahí el ícono del objetivo.
export const TARGET_ICON: Record<TutorialTarget, string> = {
  none: 'robot', rankBtn: 'trophy-award', buildTab: 'hammer-wrench', waterDeposit: 'hammer-wrench', rightOfBase: 'hammer-wrench', resourcesTab: 'archive',
};
// `why`: la razón de juego detrás de la instrucción, una línea. El tutorial daba
// órdenes sueltas ("elige el cable", "tiende la tubería") sin decir nunca para
// qué sirve cada cosa, así que se aprendía a obedecer pasos y no a jugar. Es
// opcional: los pasos que se explican solos no la llevan.
// IMPORTANTE: la CANTIDAD de pasos no puede cambiar — `onboardingStage` (1..21)
// está persistido y los useEffect de detección de GameScreen van por número.
export const TUTORIAL_STEPS: { text: string; why?: string; target: TutorialTarget; manual: boolean }[] = [
  { text: 'Has llegado a Marte. Tu misión: colonizarlo y, con el tiempo, terraformarlo.', why: 'Vas a empezar por lo básico de cualquier colonia: energía, agua y tus primeros créditos.', target: 'none', manual: true },
  { text: 'Toca el menú de RANGO (arriba) para ver tus misiones.', why: 'Las misiones de rango marcan el camino: cumplirlas sube tu rango y desbloquea edificios nuevos.', target: 'rankBtn', manual: false },
  { text: 'Ciérralo cuando termines de verlas.', target: 'none', manual: false },
  { text: 'Toca "Construir" para empezar.', why: 'Ahí está el catálogo completo de la colonia, ordenado por categoría.', target: 'buildTab', manual: false },
  { text: 'Elige la Bomba de Agua.', why: 'El agua es el primer recurso que necesitás: la consumen la refinería, el laboratorio y el soporte vital.', target: 'buildTab', manual: false },
  { text: 'Tócala sobre el depósito de agua más cercano a tu base.', why: 'Los extractores solo funcionan encima de su yacimiento — no se pueden poner en cualquier lado.', target: 'waterDeposit', manual: false },
  // Los pasos de elegir algo en Construir se leen igual AFUERA (la manito señala
  // la pestaña) y ADENTRO (la tarjeta resaltada rebota) — nada de "entra a..."
  // que suena repetido cuando ya estás dentro.
  { text: 'Elige Cable (en Construir → Redes).', why: 'Un edificio sin cable no recibe energía y no produce nada, por más bien puesto que esté.', target: 'buildTab', manual: false },
  { text: 'Tiende el cable desde tu base hasta la Bomba de Agua para conectarla.', why: 'Las redes se tienden celda por celda: cada tramo cuesta un poco más que el anterior.', target: 'none', manual: false },
  { text: 'Elige Tubería (en Construir → Redes).', why: 'El agua no viaja sola: necesita su propia red, separada de la eléctrica.', target: 'buildTab', manual: false },
  { text: 'Tiende la tubería hasta conectar la Bomba de Agua.', target: 'none', manual: false },
  { text: 'Así se ve la red ELÉCTRICA ahora mismo: el ojito de arriba cambia la vista.', why: 'Cuando algo deje de producir, estas vistas te dicen de un vistazo qué quedó desconectado.', target: 'none', manual: true },
  { text: 'Y así la red de AGUA (tuberías) — mismo ojito, otra vista.', target: 'none', manual: true },
  { text: 'Ahora elige el Recolector de Tierra.', why: 'La tierra (regolito) es tu primera fuente de ingresos: se recolecta sin yacimiento y se vende.', target: 'buildTab', manual: false },
  { text: 'Colócalo a la derecha de tu base.', why: 'Cerca de la base: todo lo que construyas tiene que caer dentro del alcance de la colonia.', target: 'rightOfBase', manual: false },
  { text: 'Elige Cable otra vez, para conectar el Recolector.', target: 'buildTab', manual: false },
  { text: 'Tiende el cable desde tu base hasta el Recolector.', target: 'none', manual: false },
  { text: 'Elige el Conducto de Carga (en Construir → Redes).', why: 'Es la tercera red: mueve lo PRODUCIDO hasta tu almacén. Sin ella lo recolectado no llega.', target: 'buildTab', manual: false },
  { text: 'Tiende el conducto hasta conectar el Recolector — así entrega lo que recolecta.', target: 'none', manual: false },
  { text: 'Ya estás recolectando tierra. Entra a la pestaña Recursos.', why: 'Ahí ves todo tu stock y podés cargar el cohete para vender.', target: 'resourcesTab', manual: false },
  { text: 'Espera a tener 10 de tierra y toca "Lanzar" ahí mismo para venderla.', why: 'Vender es cómo se consiguen créditos, y los créditos son lo que paga cada edificio nuevo.', target: 'resourcesTab', manual: false },
  { text: 'Toca el menú de RANGO y reclama tu ascenso.', why: 'Cada rango sube el alcance de la colonia y abre edificios nuevos en el catálogo.', target: 'rankBtn', manual: false },
];
