// Logique métier cœur du CRM anti no-show — fonctions pures, sans dépendance
// externe (pas de base de données, pas de réseau). Testées par tests/crm.test.ts
// et couvrent US-05, US-08, US-09, US-13, US-14, US-15.

export type ReservationStatus = "confirmed" | "completed" | "cancelled" | "no-show";
export type RiskLevel = "low" | "medium" | "high";

export interface Reservation {
  id: string;
  clientId: string;
  partySize: number;
  /** Date et heure de la réservation */
  scheduledAt: Date;
  status: ReservationStatus;
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  /** Historique des réservations du client */
  reservations: Reservation[];
}

// ---------- US-08 : taux de no-show ----------

export function calculateNoShowRate(client: Client): number {
  // Les annulations sont libres : seul un faux bond est fautif.
  const pertinentes = client.reservations.filter(
    (r) => r.status === "completed" || r.status === "no-show",
  );
  if (pertinentes.length === 0) return 0;
  const noShows = pertinentes.filter((r) => r.status === "no-show").length;
  return Math.round((noShows / pertinentes.length) * 100) / 100;
}

// ---------- US-09 : score de risque ----------

export function classifyRisk(client: Client, reservation: Reservation): RiskLevel {
  const pertinentes = client.reservations.filter(
    (r) => r.status === "completed" || r.status === "no-show",
  );
  const noShows = pertinentes.filter((r) => r.status === "no-show").length;
  const total = pertinentes.length;

  // score interne : 0 = faible, 1 = moyen, 2 = élevé
  let score: number;
  if (total === 0) {
    score = 1; // client sans historique : prudence (moyen)
  } else if (noShows >= 2 || calculateNoShowRate(client) >= 0.5) {
    score = 2; // récidiviste ou forte proportion de faux bonds
  } else if (total >= 10 && noShows === 0) {
    score = 0; // client fidèle sans faux bond
  } else {
    score = 1;
  }

  // Grande table (6 couverts et plus) : on rehausse d'un niveau.
  if (reservation.partySize >= 6) {
    score = Math.min(2, score + 1);
  }

  return score === 0 ? "low" : score === 1 ? "medium" : "high";
}

// ---------- US-14 : dépôt / carte de garantie ----------

export function shouldRequireDeposit(
  client: Client,
  reservation: Reservation,
  options: { minPartySize?: number } = {},
): boolean {
  const minPartySize = options.minPartySize ?? 6;
  if (reservation.partySize >= minPartySize) return true;
  return classifyRisk(client, reservation) === "high";
}

// ---------- US-05 : déduplication des clients ----------

function normalizePhone(phone: string): string {
  // On conserve au maximum les 10 derniers chiffres : rend équivalents
  // « +1 (514) 555-0100 » et « +15145550100 ».
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function mergeClients(primary: Client, duplicate: Client): Client {
  if (normalizePhone(primary.phone) !== normalizePhone(duplicate.phone)) {
    throw new Error(
      `Fusion impossible : numéros de téléphone différents (${primary.phone} et ${duplicate.phone})`,
    );
  }
  return {
    ...primary,
    reservations: [...primary.reservations, ...duplicate.reservations],
  };
}

// ---------- US-13 : planification des rappels SMS ----------

const HEURE_MIN_ENVOI = 8; // pas d'envoi avant 8 h…
const HEURE_MAX_ENVOI = 21; // … ni après 21 h

export function planReminderSend(
  reservation: Reservation,
  options: { hoursBefore?: number } = {},
): Date {
  const hoursBefore = options.hoursBefore ?? 24;
  const sendAt = new Date(reservation.scheduledAt.getTime() - hoursBefore * 60 * 60 * 1000);

  // Fenêtre d'envoi en temps universel (UTC) : on replie l'heure si elle tombe
  // hors fenêtre. En production, le fuseau horaire du restaurant serait passé
  // en paramètre ; les tests sont calibrés en UTC pour rester déterministes.
  const heure = sendAt.getUTCHours();
  if (heure < HEURE_MIN_ENVOI) {
    sendAt.setUTCHours(HEURE_MIN_ENVOI, 0, 0, 0);
  } else if (heure > HEURE_MAX_ENVOI) {
    sendAt.setUTCHours(HEURE_MAX_ENVOI, 0, 0, 0);
  }
  return sendAt;
}

// ---------- US-15 : marquage des no-shows ----------

export function markNoShow(
  reservation: Reservation,
  client: Client,
): { reservation: Reservation; client: Client } {
  const updatedReservation: Reservation = { ...reservation, status: "no-show" };
  const presente = client.reservations.some((r) => r.id === reservation.id);
  const updatedClient: Client = {
    ...client,
    reservations: presente
      ? client.reservations.map((r) => (r.id === reservation.id ? updatedReservation : r))
      : [...client.reservations, updatedReservation],
  };
  return { reservation: updatedReservation, client: updatedClient };
}

export function undoNoShow(
  reservation: Reservation,
  client: Client,
): { reservation: Reservation; client: Client } {
  const restored: Reservation = { ...reservation, status: "confirmed" };
  const updatedClient: Client = {
    ...client,
    reservations: client.reservations.map((r) => (r.id === restored.id ? restored : r)),
  };
  return { reservation: restored, client: updatedClient };
}
