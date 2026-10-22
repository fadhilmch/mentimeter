# Open-ended volume caps (brief 04 remainder)

- `LIVE_MAX_RESPONSES_PER_PARTICIPANT` (default 10): responses one participant can store on one open-ended question.
- `LIVE_MAX_RESPONSES_PER_SLIDE` (default 500): total stored responses on one question. This also bounds the size of the presentation document for open-ended slides.
- A refused send returns HTTP 400 with a plain message. A retry of a send that was already stored is not counted again.
- Caps count stored responses, including ones a presenter later hides. They are per instance only in the sense that the check runs on the stored document, so they hold across instances.
- Word clouds already allow one word per participant. Per-session limits on participants wait for the live session model (#41).
