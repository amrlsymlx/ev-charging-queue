# ETA Calculation

## Constants

Charging Duration

65 minutes

Number of Bays

2

---

## Formula

ETA = CEILING(Position / 2) × 65

---

## Example

Current:

Bay 1 Occupied
Bay 2 Occupied

Queue

#1 AAA1111
#2 BBB2222
#3 CCC3333
#4 DDD4444

Customer:

Position #3

Calculation:

CEILING(3 / 2) × 65

= 2 × 65

= 130 minutes

Estimated Wait Time:

2 hours 10 minutes

---

## Realtime Updates

Recalculate whenever:

- Customer joins queue
- Charging starts
- Charging ends
- Queue removed
- Queue skipped