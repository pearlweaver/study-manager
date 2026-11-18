import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cardStates, reviews } from "../src/db/schema.ts";
import { world } from "./support.ts";

let w: Awaited<ReturnType<typeof world>>;
beforeAll(async () => {
  w = await world();
});
afterAll(() => w.close());

describe("flashcard reviews", () => {
  it("keep the schedule and the review log in step when answers overlap", async () => {
    const tom = await w.user("Tom");
    const course = await w.services.courses.create(tom, { title: "RTES", semester: "WiSe26-27" });
    const deck = await w.services.flashcards.createDeck(tom, course.id, "Grundbegriffe");
    const card = await w.services.flashcards.addCard(tom, deck.id, { front: "Frage", back: "Antwort" });
    const now = new Date("2026-10-29T10:00:00Z");

    await Promise.all(Array.from({ length: 10 }, (_, i) => w.services.flashcards.review(tom, card.id, (i % 4) + 1, now)));

    const state = await w.db.query.cardStates.findFirst({ where: and(eq(cardStates.cardId, card.id), eq(cardStates.userId, tom)) });
    const logged = await w.db.select().from(reviews).where(and(eq(reviews.cardId, card.id), eq(reviews.userId, tom)));
    expect(logged).toHaveLength(10);
    expect(state?.reps).toBe(10);
  });
});
