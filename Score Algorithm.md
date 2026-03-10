# Score Algorithm

This document explains the scoring logic implemented in [App.tsx](./App.tsx), focused on the `calculateQuizGamepoints(...)` algorithm and the values that feed into leaderboard ranking.

The app now supports two score modes for quiz leaderboard scoring:

- `Speedrun Score`
- `Study Score`

`Speedrun Score` and `Study Score` now have separate tuning constants. `Study Score` is the completion-first algorithm path and gives speed/timer performance a secondary, but still meaningful, bonus.

## Source Location

- `calculateQuizGamepoints(...)`: `App.tsx`
- Quiz result finalization: `finalizeQuiz(...)`
- Leaderboard rank selection: `getLeaderboardRankScore(...)`
- Leaderboard sorting: `compareLeaderboardEntriesByTime(...)`, `compareLeaderboardEntriesByScore(...)`

## Constants

These constants define the scoring curve:

```ts
const QUIZ_TIMER_MIN_MINUTES = 1;
const QUIZ_TIMER_MAX_MINUTES = 30;
const QUIZ_SCORE_MAX = 100_000_000;
const QUIZ_SCORE_INPUT_CHARS_PER_WORD = 5;
const QUIZ_SCORE_SPEED_ANCHOR_WPM = 180;
const QUIZ_SCORE_SPEED_SHAPE_K = 17.48;
const QUIZ_SCORE_TIMER_WEIGHT = 1.2;
const QUIZ_SCORE_TIMER_CURVE = 0.7;
const QUIZ_SCORE_BACKSPACE_PENALTY_POINTS = 1000;
```

### Notes

- `QUIZ_TIMER_MIN_MINUTES` / `QUIZ_TIMER_MAX_MINUTES`
  - Defines the valid timer range.
  - Also used to normalize timer difficulty bonuses.
- `QUIZ_SCORE_MAX`
  - Hard upper bound for the final score.
- `QUIZ_SCORE_INPUT_CHARS_PER_WORD`
  - Converts estimated typed input length into a WPM-style speed model.
  - The algorithm still uses `5` input characters as `1` word-equivalent unit.
- `QUIZ_SCORE_SPEED_ANCHOR_WPM`
  - Defines the top anchor of the speed curve.
  - A full-complete run at `180 WPM` maps to the top of the speed band.
- `QUIZ_SCORE_SPEED_SHAPE_K`
  - Controls the anchored exponential speed curve.
  - It is tuned so that roughly `45 WPM` lands around `1,000,000` on a full-complete neutral-timer run before penalties.
- `QUIZ_SCORE_TIMER_WEIGHT`
  - Controls how much the timer bonus matters in the final score.
- `QUIZ_SCORE_TIMER_CURVE`
  - Controls the shape of the short-timer bonus.
- `QUIZ_SCORE_BACKSPACE_PENALTY_POINTS`
  - Flat deduction per penalized backspace event.

## Helper Values Used By Scoring

### Total quiz character count

```ts
const getQuizTotalChars = (items: Array<{ kana?: string }>) =>
  items.reduce((sum, it) => sum + (it.kana ? it.kana.length : 0), 0);
```

### Notes

- The quiz still uses correct character coverage for completion and raw test score.
- `kana.length` is no longer used as the WPM workload base.

### Correct answer count

```ts
const calculateCorrectAnswers = useCallback(
  (answerMap: Record<string, string>) =>
    quizItems.reduce((sum, item) => {
      const response = answerMap[item.id];
      if (!response) return sum;
      return isCorrectAnswer(item.id, response) ? sum + 1 : sum;
    }, 0),
  [isCorrectAnswer, quizItems],
);
```

### Notes

- This is used for reporting and leaderboard display.
- It is not the ranked quiz score when score mode is enabled.

### Correct character count

```ts
const calculateCorrectCharacterCount = useCallback(
  (answerMap: Record<string, string>) =>
    quizItems.reduce((sum, item) => {
      const response = answerMap[item.id];
      if (!response) return sum;
      if (!isCorrectAnswer(item.id, response)) return sum;
      return sum + (item.kana ? item.kana.length : 0);
    }, 0),
  [isCorrectAnswer, quizItems],
);
```

### Notes

- This is the main raw performance input.
- A correct answer contributes the full `kana.length`; a wrong or blank answer contributes `0`.

### Estimated typed input length

```ts
const getScoreInputLengthForItem = useCallback(
  (item: any, sourceMode?: string) => {
    const resolvedSourceMode = sourceMode || getItemSourceMode(item);
    const accepted = getAcceptedAnswersForItem(item, resolvedSourceMode)
      .map((value: string) => String(value || '').trim())
      .filter(Boolean);

    if (accepted.length > 0) {
      return accepted.reduce((min, value) => Math.min(min, value.length), accepted[0].length);
    }

    if (usesJapaneseInputForItem(item, resolvedSourceMode)) {
      const fallbackRomanized = (item.answers || [])
        .map((value: string) => normalizeRomaji(value))
        .filter(Boolean);
      if (fallbackRomanized.length > 0) {
        return fallbackRomanized.reduce((min, value) => Math.min(min, value.length), fallbackRomanized[0].length);
      }
    }

    const fallback = String(item.kana || '').trim();
    return fallback.length;
  },
  [getAcceptedAnswersForItem, getItemSourceMode, usesJapaneseInputForItem],
);
```

### Notes

- This helper estimates the amount of typing required for each prompt.
- It uses the shortest accepted answer as the input workload.
- That makes speed scoring reflect answer-entry effort instead of prompt text length.
- For Japanese-input items, it still prefers accepted answers first and only falls back when needed.

## The Main Function

```ts
const calculateQuizGamepoints = useCallback(
  (correctCharCount: number, elapsedMs: number, backspaces: number) => {
    if (correctCharCount <= 0 || elapsedMs <= 0) return 0;

    const elapsedMinutes = elapsedMs / 60000;
    if (elapsedMinutes <= 0) return 0;

    const timerSeconds = timerMinutes * 60;
    const quizTotalChars = getQuizTotalChars(quizItems);
    if (quizTotalChars <= 0) return 0;

    const estimatedInputCharsTotal = quizItems.reduce(
      (sum, item) => sum + getScoreInputLengthForItem(item),
      0,
    );
    if (estimatedInputCharsTotal <= 0) return 0;

    const measuredWpm =
      (estimatedInputCharsTotal * (correctCharCount / quizTotalChars) / QUIZ_SCORE_INPUT_CHARS_PER_WORD) /
      elapsedMinutes;
    const speedNorm = clampNumber(
      Math.log(1 + measuredWpm) / Math.log(1 + QUIZ_SCORE_SPEED_ANCHOR_WPM),
      0,
      1,
    );
    const completionFactor = clampNumber(correctCharCount / quizTotalChars, 0, 1);

    const minTimerSeconds = QUIZ_TIMER_MIN_MINUTES * 60;
    const maxTimerSeconds = QUIZ_TIMER_MAX_MINUTES * 60;
    const clampedTimerSeconds = clampNumber(timerSeconds, minTimerSeconds, maxTimerSeconds);
    const timerRangeRatio = maxTimerSeconds / minTimerSeconds;
    const rawTimerReward = Math.pow(maxTimerSeconds / clampedTimerSeconds, QUIZ_SCORE_TIMER_CURVE);
    const timerRewardRange = Math.pow(timerRangeRatio, QUIZ_SCORE_TIMER_CURVE) - 1;
    const baseTimerFactor =
      timerRewardRange > 0
        ? clampNumber((rawTimerReward - 1) / timerRewardRange, 0, 1)
        : 0;
    const timerBonus = 1.0 + 0.25 * baseTimerFactor;

    const scoreFrac =
      (Math.exp(QUIZ_SCORE_SPEED_SHAPE_K * speedNorm) - 1) /
      (Math.exp(QUIZ_SCORE_SPEED_SHAPE_K) - 1);
    const rawScore =
      QUIZ_SCORE_MAX *
      scoreFrac *
      completionFactor *
      Math.pow(timerBonus, QUIZ_SCORE_TIMER_WEIGHT);
    const backspacePenaltyPoints = Math.max(0, backspaces) * QUIZ_SCORE_BACKSPACE_PENALTY_POINTS;
    const adjustedScore = rawScore - backspacePenaltyPoints;

    return Math.round(clampNumber(adjustedScore, 0, QUIZ_SCORE_MAX));
  },
  [getScoreInputLengthForItem, quizItems, timerMinutes],
);
```

## Variable-By-Variable Breakdown

### Input variables

- `correctCharCount`
  - Number of characters earned from correct answers.
  - This is the algorithm's main measure of output.
- `elapsedMs`
  - Time spent before the quiz finished.
  - If the user times out, this is forced to the full timer length.
- `backspaces`
  - Number of penalized backspace events recorded during the run.

### Guard clauses

- `if (correctCharCount <= 0 || elapsedMs <= 0) return 0;`
  - Prevents divide-by-zero and zero-work runs from scoring.
- `if (elapsedMinutes <= 0) return 0;`
  - Secondary protection after converting milliseconds to minutes.
- `if (quizTotalChars <= 0) return 0;`
  - Prevents invalid datasets from producing scores.

### Stage A: Speed workload and measured WPM

- `timerSeconds = timerMinutes * 60`
  - Converts selected timer into seconds.
- `quizTotalChars = getQuizTotalChars(quizItems)`
  - Total possible character value in the current quiz.
- `estimatedInputCharsTotal = quizItems.reduce((sum, item) => sum + getScoreInputLengthForItem(item), 0)`
  - Estimates total typing workload for the full quiz using accepted-answer length instead of prompt `kana.length`.
- `measuredWpm = (estimatedInputCharsTotal * (correctCharCount / quizTotalChars) / QUIZ_SCORE_INPUT_CHARS_PER_WORD) / elapsedMinutes`
  - Converts completed share of the quiz into an equivalent typed-input WPM.
  - This ties speed to expected answer-entry effort, not kana prompt size.
- `speedNorm = clampNumber(Math.log(1 + measuredWpm) / Math.log(1 + QUIZ_SCORE_SPEED_ANCHOR_WPM), 0, 1)`
  - Anchors the speed curve directly to `180 WPM`.
  - `180 WPM` maps to `1.0`.
  - Lower WPM values rise on a predictable log scale instead of the previous multi-stage peak-speed model.
- `completionFactor = clampNumber(correctCharCount / quizTotalChars, 0, 1)`
  - Multiplies score by fraction of quiz content completed correctly.
  - A fast partial run still loses proportionally to completion.

### Stage B: Timer Bonus

- `minTimerSeconds`
  - Lower normalization bound from the global timer config.
- `maxTimerSeconds`
  - Upper normalization bound from the global timer config.
- `clampedTimerSeconds`
  - Makes sure timer bonus calculations stay inside expected bounds.
- `timerRangeRatio = maxTimerSeconds / minTimerSeconds`
  - Defines total spread of timer difficulty.
- `rawTimerReward = Math.pow(maxTimerSeconds / clampedTimerSeconds, QUIZ_SCORE_TIMER_CURVE)`
  - Shorter timers produce larger values.
- `timerRewardRange = Math.pow(timerRangeRatio, QUIZ_SCORE_TIMER_CURVE) - 1`
  - Used to normalize timer reward across the full timer range.
- `baseTimerFactor`
  - Normalized timer difficulty from `0..1`.
- `timerBonus = 1.0 + 0.25 * baseTimerFactor`
  - Converts timer difficulty into a multiplier from `1.0x` to `1.25x`.

### Stage C: Anchored Speed Curve

- `scoreFrac = (exp(QUIZ_SCORE_SPEED_SHAPE_K * speedNorm) - 1) / (exp(QUIZ_SCORE_SPEED_SHAPE_K) - 1)`
  - This is now the only speed shaping curve.
  - It replaces the old chain of dynamic peak normalization, extra power weighting, and a second exponential remap.
  - It is explicitly anchored to the intended design goal:
    - around `180 WPM` -> near `100,000,000` on a full-complete neutral-timer run
    - around `45 WPM` -> around `1,000,000` on a full-complete neutral-timer run
- `rawScore = QUIZ_SCORE_MAX * scoreFrac * completionFactor * Math.pow(timerBonus, QUIZ_SCORE_TIMER_WEIGHT)`
  - Final pre-penalty score.
  - Combines speed quality, completion, timer difficulty, and score cap.

### Penalty stage

- `backspacePenaltyPoints = Math.max(0, backspaces) * QUIZ_SCORE_BACKSPACE_PENALTY_POINTS`
  - Flat subtraction for backspace usage.
- `adjustedScore = rawScore - backspacePenaltyPoints`
  - Applies penalties after all positive multipliers.
- `Math.round(clampNumber(adjustedScore, 0, QUIZ_SCORE_MAX))`
  - Ensures the output is an integer and never below `0` or above max.

## Backspace Penalty Logic

Backspace penalties are tracked per answer field:

```ts
onKeyPress={event => {
  if (
    event.nativeEvent.key === 'Backspace' &&
    !hasFinished &&
    !isQuizPaused &&
    (answers[item.id] || '').length > 0 &&
    !quizBackspacePenaltyWordIdsRef.current.has(item.id)
  ) {
    quizBackspacePenaltyWordIdsRef.current.add(item.id);
    setQuizBackspaceCount(prev => prev + 1);
  }
}}
```

### Notes

- The first penalized backspace on a given item counts.
- Additional backspaces on the same item do not stack.
- The penalty is trying to discourage correction-heavy runs without making one bad field catastrophic.

## Finalization Logic

At quiz completion, the app stores both the test score and the ranked score:

```ts
const finalGamepoints = leaderboardScoresEnabled
  ? calculateQuizGamepoints(finalCorrectCharCount, elapsedMs, quizBackspaceCount)
  : finalCorrectCharCount;

const entry = {
  mode: activeModeKey,
  timeMs: elapsedMs,
  score: finalCorrectCharCount,
  total: totalCharCount,
  date: now,
  finishReason: reason,
  timerMinutes,
  scoreType: leaderboardScoresEnabled ? 'speedrun_points' : undefined,
  correctCount: finalCorrectCount,
  testscore: finalCorrectCharCount,
  totalTestscore: totalCharCount,
  gamepoints: leaderboardScoresEnabled ? finalGamepoints : undefined,
};
```

### Notes

- `score`
  - Always stores the raw correct-character result.
- `gamepoints`
  - Stores the ranked quiz score only when score mode is enabled.
- `scoreType: 'speedrun_points'`
  - Marks leaderboard entries that should rank by `gamepoints` instead of raw `score`.

## Leaderboard Ranking Variables

### Rank score selection

```ts
const getLeaderboardRankScore = (entry: { score: number; gamepoints?: number; scoreType?: string }) => {
  if (entry.scoreType === 'speedrun_points') {
    return Math.round(entry.gamepoints ?? entry.score ?? 0);
  }
  return Math.round(entry.score ?? 0);
};
```

### Notes

- In quiz score mode, leaderboard rank uses `gamepoints`.
- Otherwise, leaderboard rank uses plain `score`.

### Time ranking rules

```ts
const compareLeaderboardEntriesByTime = useCallback((a, b) => {
  const aComplete = (a.finishReason || 'complete') === 'complete' ? 1 : 0;
  const bComplete = (b.finishReason || 'complete') === 'complete' ? 1 : 0;
  if (bComplete !== aComplete) return bComplete - aComplete;
  if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
  if (b.score !== a.score) return b.score - a.score;
  return a.date - b.date;
}, []);
```

### Notes

- Completed runs beat incomplete ones.
- Faster time wins.
- If time ties, higher score wins.
- If still tied, older entry wins.

### Score ranking rules

```ts
const compareLeaderboardEntriesByScore = useCallback((a, b) => {
  const aRankScore = getLeaderboardRankScore(a as any);
  const bRankScore = getLeaderboardRankScore(b as any);
  if (bRankScore !== aRankScore) return bRankScore - aRankScore;
  const aComplete = (a.finishReason || 'complete') === 'complete' ? 1 : 0;
  const bComplete = (b.finishReason || 'complete') === 'complete' ? 1 : 0;
  if (bComplete !== aComplete) return bComplete - aComplete;
  if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
  return a.date - b.date;
}, []);
```

### Notes

- Higher ranked score wins first.
- Completion status is the first tiebreaker.
- Faster time is the second tiebreaker.
- Older entry is the last tiebreaker.

## Practical Logic Summary

The scoring model is designed to reward:

- finishing more of the quiz correctly
- doing it at a strong typing speed
- choosing shorter timers
- using fewer backspaces

It is also designed to avoid:

- giant score inflation from tiny quizzes
- unlimited reward for speed above the target
- weak partial runs beating strong near-complete runs
- excessive leaderboard distortion from correction-heavy play
