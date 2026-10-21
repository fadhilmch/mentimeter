import { randomUUID } from 'node:crypto';

// Stable slide/option identity helpers.
// Rules: votes and responses are only ever carried by an explicit id match.
// Anything unmatched is counted as removed so the route can demand explicit,
// count-aware confirmation before discarding real audience data.

export function ensureSlideIds(presentation) {
  let changed = false;
  for (const slide of presentation.slides) {
    if (!slide.id) {
      slide.id = randomUUID();
      changed = true;
    }
    for (const option of slide.options) {
      if (!option.id) {
        option.id = randomUUID();
        changed = true;
      }
    }
  }
  return changed;
}

// Atomically stamps missing ids onto the stored document. The write only lands
// if the document is untouched since `presentation` was loaded (guarded by the
// document version), so a concurrent vote, edit or stamping attempt can never
// be overwritten by a stale array snapshot. Returns true when the stored
// document is fully identified afterwards; false when a concurrent change won
// and the caller must reload before proceeding.
export async function stampSlideIdsIfMissing(presentation) {
  if (!hasUnidentifiedSlides(presentation.slides)) return true;
  ensureSlideIds(presentation);
  const result = await presentation.constructor.updateOne(
    { _id: presentation._id, __v: presentation.__v },
    // Bump the version ourselves: plain updateOne does not, and without the
    // bump two concurrent stamping writes would both match and race.
    { $set: { slides: presentation.slides.map((slide) => slide.toObject()) }, $inc: { __v: 1 } },
  );
  return result.modifiedCount === 1;
}

export function hasUnidentifiedSlides(slides) {
  return slides.some((slide) => !slide.id || slide.options.some((option) => !option.id));
}

// Merges an incoming slide list (identified existing slides + unidentified new
// slides) with the stored slides. Returns the merged array plus counts of
// votes/responses that the merge would discard.
export function matchSlideUpdate(storedSlides, incomingSlides) {
  const storedById = new Map(storedSlides.filter((s) => s.id).map((s) => [s.id, s]));
  const usedSlideIds = new Set();
  const usedOptionIds = new Set();

  const merged = incomingSlides.map((incoming) => {
    const previous = incoming.id ? storedById.get(incoming.id) : undefined;
    const kept = previous && previous.questionType === incoming.questionType;
    if (previous) {
      usedSlideIds.add(previous.id);
      for (const option of incoming.options) {
        if (option.id && previous.options.some((o) => o.id === option.id)) usedOptionIds.add(option.id);
      }
    }
    const previousOptionsById = new Map((previous?.options ?? []).filter((o) => o.id).map((o) => [o.id, o]));
    const options = incoming.options.map((option) => ({
      id: option.id && previousOptionsById.has(option.id) ? option.id : randomUUID(),
      text: option.text,
      votes: kept ? (previousOptionsById.get(option.id)?.votes ?? []) : [],
    }));
    // The quiz answer key must point at a merged option id. Incoming ids that
    // no stored option had are replaced above, so remap by the incoming
    // option's position; a key that matches nothing is dropped, never kept
    // dangling.
    let correctOptionId;
    if (incoming.correctOptionId) {
      const keyIndex = incoming.options.findIndex((option) => option.id === incoming.correctOptionId);
      if (keyIndex >= 0 && options[keyIndex]) correctOptionId = options[keyIndex].id;
    }
    return {
      id: previous?.id ?? randomUUID(),
      questionType: incoming.questionType,
      question: incoming.question,
      options,
      // Audience answers belong to a slide of a given type; a type change discards them.
      responses: kept ? previous.responses : [],
      ratings: kept ? previous.ratings : [],
      rankings: kept ? previous.rankings : [],
      // Quiz answer key and per-slide design follow the slide identity.
      correctOptionId,
      design: incoming.design,
    };
  });

  let removedVotes = 0;
  let removedResponses = 0;
  for (const slide of storedSlides) {
    if (slide.id && usedSlideIds.has(slide.id)) {
      const incoming = incomingSlides.find((s) => s.id === slide.id);
      const typeKept = incoming.questionType === slide.questionType;
      for (const option of slide.options) {
        if (!typeKept || (option.id && !usedOptionIds.has(option.id))) removedVotes += option.votes.length;
      }
      if (!typeKept) removedResponses += slide.responses.length + (slide.ratings?.length ?? 0) + (slide.rankings?.length ?? 0);
    } else {
      removedVotes += slide.options.reduce((n, o) => n + o.votes.length, 0);
      removedResponses += slide.responses.length + (slide.ratings?.length ?? 0) + (slide.rankings?.length ?? 0);
    }
  }

  return { merged, removedVotes, removedResponses };
}
