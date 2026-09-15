# RTB Intelligence Marketing Posts

## Screenshots to Use (Blur These)
- Buyer names (Flex MG, Ray Advertising, etc.)
- Source/Publisher names (Hablyte Media, Four nine nine, etc.)
- Caller phone numbers
- Keep visible: Offer types (HVAC, Pest, Roofing), States, Status badges, Revenue/Margin numbers, Latency (ms)

---

## POST 1: The Speed Story (LinkedIn)

**Image:** Live Feed screenshot showing ms column with sub-100ms responses

Built our own RTB intelligence layer for pay per call.

Why? Because when you're routing thousands of pings to buyers, every millisecond matters.

Our average response time: under 500ms
Best responses: 2-3ms

How we got there:
- In-memory config caching (no DB lookup per ping)
- Async logging (don't block the response)
- Platform-specific response parsers (CallGrid, Retreaver, custom)
- UUID validation before any processing

The result: Real-time bid capture with zero latency overhead.

When your publishers are sending volume, you can't afford slow infrastructure.

#PayPerCall #PerformanceMarketing #RTB #MarTech

---

## POST 2: Duplicate Detection (LinkedIn)

**Image:** Overview showing "37 Duplicates" stat + Live feed with "Dup" badges

One thing most pay per call platforms don't handle well: duplicate pings.

Same caller hits multiple sources. Gets pinged to the same buyer 3x in 5 minutes. Buyer gets annoyed. Starts rejecting everything.

We built a 30-minute duplicate window:
- Track every caller + buyer combination
- Block duplicates BEFORE they hit the buyer
- Save buyer relationships
- Protect your accept rates

37 duplicates blocked in the last week alone.

That's 37 times we saved a buyer relationship and protected our publishers' traffic quality.

#PayPerCall #LeadGen #TrafficQuality

---

## POST 3: Margin Visibility (Twitter/X Thread)

**Image:** Live Feed showing Rev, Pay, Margin columns

Pay per call operators: do you know your real-time margin on every ping?

We built visibility into every single bid:
- Revenue (what buyer pays)
- Publisher payout (what we owe)
- Margin (what we keep)

All calculated live, per ping, based on your TrackDrive payout configs.

No more spreadsheet reconciliation at month end.

---

## POST 4: Bid Floor Enforcement (LinkedIn)

**Image:** Relay Config showing bid floors ($25, $30) per buyer

"We only want calls above $25"

Easy to say. Hard to enforce in real-time.

Our RTB layer checks every bid against your floor:
- Set per-buyer minimums
- Auto-reject low bids before they waste capacity
- Protect your margins

One buyer set a $30 floor on roofing calls. Accept rate jumped to 62%.

Quality over quantity. Always.

#PayPerCall #PerformanceMarketing

---

## POST 5: The Tech Behind It (LinkedIn, longer form)

**Image:** Overview dashboard with all KPIs

Built a ping relay system that sits between TrackDrive and our buyers.

The problem: TrackDrive pings buyers directly. We had no visibility into bids, rejections, or latency. Flying blind.

The solution: Route pings through our infrastructure first.

How it works:
1. TrackDrive pings our relay endpoint
2. We log the caller, offer, source, state
3. Forward to the real buyer endpoint
4. Parse their response (accept/reject, bid amount)
5. Return to TrackDrive
6. Calculate payout and margin

All in under 500ms average.

Now we see:
- Every bid in real-time
- Accept rates by buyer, source, offer
- Duplicate callers getting blocked
- Revenue vs payout vs margin

$10K+ in bids tracked in the first week.

If you're running pay per call volume and can't see your ping-level data, you're leaving money on the table.

#PayPerCall #RTB #PerformanceMarketing #MarTech #LeadGeneration

---

## POST 6: Short Twitter/X

**Image:** KPI cards (1,633 pings, 19.6% accept, $32.37 avg bid, 799ms latency)

Built RTB intelligence for pay per call.

1,633 pings tracked
$10K+ in bid value
799ms avg latency
37 duplicates blocked

All running through our relay layer before hitting buyers.

Real-time visibility changes everything.

---

## POST 7: The "Why" Story (LinkedIn)

**Image:** Live feed with Won/Rej/Dup status badges

We used to get buyer complaints: "Your traffic quality is dropping."

But we had no data to prove otherwise. TrackDrive shows call outcomes, not ping-level decisions.

So we built our own intelligence layer.

Now when a buyer says quality is dropping, I pull up the dashboard:
- "Actually, your accept rate this week is 30%"
- "Here's the 15 duplicates we blocked for you"
- "Your avg bid is $36.40"

Data wins arguments.
Data builds trust.
Data keeps partnerships alive.

That's why we built this.

#PayPerCall #PerformanceMarketing #DataDriven

---

## Image Blur Instructions

For each screenshot, blur using Photoshop/Figma/Canva:
1. Buyer column: blur all buyer names
2. Source column: blur all source names  
3. Caller column: blur phone numbers (can keep area code visible like 702-XXX-XXXX)
4. Sidebar: can blur or crop out the left nav if preferred
5. Top right: blur "Usman" username

Keep visible for impact:
- KPI numbers (pings, accept rate, bid value, latency)
- Status badges (Won, Rej, Dup)
- Offer names (HVAC, Pest, Roofing)
- State codes (CA, NY, TX)
- Revenue/Payout/Margin values
- Millisecond latency values
