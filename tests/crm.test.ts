import { describe, it, expect } from "vitest";
import {
  calculateNoShowRate,
  classifyRisk,
  shouldRequireDeposit,
  mergeClients,
  planReminderSend,
  markNoShow,
  undoNoShow,
} from "../src/lib/crm";
import type { Client, Reservation, ReservationStatus } from "../src/lib/crm";

// ---------- Helpers : fabriques de données de test ----------

let nextId = 1;
const id = () => String(nextId++);

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: id(),
    firstName: "Jean",
    lastName: "Tremblay",
    phone: "+15145550100",
    email: "jean.tremblay@example.com",
    reservations: [],
    ...overrides,
  };
}

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: id(),
    clientId: "",
    partySize: 2,
    scheduledAt: new Date("2026-06-13T19:00:00-04:00"),
    status: "confirmed",
    ...overrides,
  };
}

function visits(count: number, status: ReservationStatus = "completed"): Reservation[] {
  return Array.from({ length: count }, () => makeReservation({ status }));
}

// ---------- US-08 / US-09 : taux de no-show et score de risque ----------

describe("calculateNoShowRate", () => {
  it("retourne 0 pour un client sans réservation passée", () => {
    const client = makeClient();
    expect(calculateNoShowRate(client)).toBe(0);
  });

  it("compte les no-shows sur les réservations réellement honorées ou manquées", () => {
    // 3 visites honorées + 2 no-shows → 2 / (3 + 2) = 40 %
    const client = makeClient({
      reservations: [...visits(3), ...visits(2, "no-show")],
    });
    expect(calculateNoShowRate(client)).toBe(0.4);
  });

  it("exclut les annulations du calcul", () => {
    // 1 visite honorée + 1 no-show + 3 annulations → 1 / (1 + 1) = 50 %
    const client = makeClient({
      reservations: [...visits(1), ...visits(1, "no-show"), ...visits(3, "cancelled")],
    });
    expect(calculateNoShowRate(client)).toBe(0.5);
  });
});

describe("classifyRisk", () => {
  it("classe un client fidèle sans no-show comme risque faible", () => {
    const client = makeClient({ reservations: visits(12) });
    expect(classifyRisk(client, makeReservation({ partySize: 2 }))).toBe("low");
  });

  it("classe un nouveau client (sans historique) comme risque moyen", () => {
    const client = makeClient();
    expect(classifyRisk(client, makeReservation())).toBe("medium");
  });

  it("classe un client récidiviste (≥ 2 no-shows) comme risque élevé", () => {
    const client = makeClient({ reservations: [...visits(2), ...visits(2, "no-show")] });
    expect(classifyRisk(client, makeReservation())).toBe("high");
  });

  it("rehausse d'un niveau le risque pour une grande table (≥ 6 couverts)", () => {
    const newClient = makeClient(); // risque de base : medium
    expect(classifyRisk(newClient, makeReservation({ partySize: 8 }))).toBe("high");
  });
});

// ---------- US-14 : règles de dépôt / carte de garantie ----------

describe("shouldRequireDeposit", () => {
  it("exige un dépôt pour une grande table", () => {
    const loyalClient = makeClient({ reservations: visits(10) });
    expect(shouldRequireDeposit(loyalClient, makeReservation({ partySize: 6 }))).toBe(true);
  });

  it("exige un dépôt pour un client à risque, même à 2 couverts", () => {
    const riskyClient = makeClient({ reservations: [...visits(1), ...visits(2, "no-show")] });
    expect(shouldRequireDeposit(riskyClient, makeReservation({ partySize: 2 }))).toBe(true);
  });

  it("n'exige rien pour un client fidèle à petite table", () => {
    const loyalClient = makeClient({ reservations: visits(15) });
    expect(shouldRequireDeposit(loyalClient, makeReservation({ partySize: 2 }))).toBe(false);
  });

  it("respecte un seuil de couverts configurable", () => {
    const loyalClient = makeClient({ reservations: visits(10) });
    expect(
      shouldRequireDeposit(loyalClient, makeReservation({ partySize: 4 }), {
        minPartySize: 4,
      }),
    ).toBe(true);
  });
});

// ---------- US-05 : déduplication des clients synchronisés ----------

describe("mergeClients", () => {
  it("fusionne deux fiches dupliquées en conservant tout l'historique", () => {
    const primary = makeClient({ reservations: visits(3) });
    const duplicate = makeClient({
      id: "dup-1",
      phone: "+15145550100",
      reservations: visits(2),
    });

    const merged = mergeClients(primary, duplicate);

    expect(merged.id).toBe(primary.id);
    expect(merged.reservations).toHaveLength(5);
  });

  it("reconnaît un doublon malgré un formatage différent du téléphone", () => {
    const primary = makeClient({ phone: "+1 (514) 555-0100" });
    const duplicate = makeClient({ id: "dup-2", phone: "+15145550100" });

    expect(mergeClients(primary, duplicate).id).toBe(primary.id);
  });

  it("ne fusionne pas deux clients au téléphone différent", () => {
    const primary = makeClient({ phone: "+15145550100" });
    const other = makeClient({ id: "other", phone: "+15145559999" });

    expect(() => mergeClients(primary, other)).toThrow();
  });
});

// ---------- US-13 : planification des rappels SMS ----------

describe("planReminderSend", () => {
  // Fenêtre d'envoi testée en temps universel (UTC) pour un comportement
  // identique quel que soit le fuseau horaire de la machine (local ou CI).

  it("programme le rappel 24 h avant la réservation par défaut", () => {
    const reservation = makeReservation({
      scheduledAt: new Date("2026-06-13T19:00:00Z"),
    });

    const sendAt = planReminderSend(reservation);

    expect(sendAt.toISOString()).toBe("2026-06-12T19:00:00.000Z");
  });

  it("respecte un délai configurable en heures", () => {
    const reservation = makeReservation({
      scheduledAt: new Date("2026-06-13T19:00:00Z"),
    });

    const sendAt = planReminderSend(reservation, { hoursBefore: 3 });

    expect(sendAt.toISOString()).toBe("2026-06-13T16:00:00.000Z");
  });

  it("ne programme jamais d'envoi après 21 h", () => {
    // 24 h avant 22 h 30 → 22 h 30 la veille → replié à 21 h
    const reservation = makeReservation({
      scheduledAt: new Date("2026-06-13T22:30:00Z"),
    });

    const sendAt = planReminderSend(reservation);

    expect(sendAt.getUTCHours()).toBe(21);
  });

  it("ne programme jamais d'envoi avant 8 h", () => {
    // 24 h avant 7 h 30 → 7 h 30 la veille, trop tôt → replié à 8 h
    const reservation = makeReservation({
      scheduledAt: new Date("2026-06-13T07:30:00Z"),
    });

    const sendAt = planReminderSend(reservation);

    expect(sendAt.getUTCHours()).toBe(8);
  });
});

// ---------- US-15 : marquage des no-shows ----------

describe("markNoShow / undoNoShow", () => {
  it("marque une réservation en no-show et met à jour la fiche client", () => {
    const client = makeClient({ reservations: visits(3) });
    const reservation = client.reservations[0];

    const { reservation: updatedReservation, client: updatedClient } = markNoShow(
      reservation,
      client,
    );

    expect(updatedReservation.status).toBe("no-show");
    // Le taux du client reflète immédiatement le nouveau no-show : 1 / 3 ≈ 0.33
    expect(calculateNoShowRate(updatedClient)).toBe(0.33);
  });

  it("distingue un no-show d'une annulation", () => {
    const client = makeClient({ reservations: visits(2) });
    const reservation = client.reservations[0];

    // Annulation : ne compte pas dans le taux de no-show
    const cancelled = { ...reservation, status: "cancelled" as ReservationStatus };
    const afterCancel = { ...client, reservations: [cancelled, ...client.reservations.slice(1)] };

    expect(calculateNoShowRate(afterCancel)).toBe(0);
  });

  it("permet d'annuler un marquage effectué par erreur", () => {
    const client = makeClient({ reservations: visits(3) });
    const reservation = client.reservations[0];

    const marked = markNoShow(reservation, client);
    const undone = undoNoShow(marked.reservation, marked.client);

    expect(undone.reservation.status).toBe("confirmed");
    expect(calculateNoShowRate(undone.client)).toBe(0);
  });
});
