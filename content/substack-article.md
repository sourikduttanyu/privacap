# I built a Chrome extension that caps ad frequency without knowing who you are

**The idea behind Veil, explained without jargon**

---

I built Veil because I was annoyed by a specific thing, not advertising in general.

I do not have a principled objection to ads. They fund most of the internet I use. What bothers me is the experience of being followed. Seeing the same ad twenty times. Knowing that somewhere, a system has built a detailed enough model of my behavior to know that I am still "in market" for the thing I searched for once, three weeks ago.

Frequency capping is supposed to prevent that. Show each person an ad at most N times. Simple rule. The problem is that enforcing it has always required the system to know who you are. You cannot count how many times "this user" has seen an ad without tracking "this user."

That felt like a false constraint to me. So I built something to test whether it was.

---

**The core idea: let the browser do the math**

Here is the insight Veil is built on. You do not need to know someone's true ad count to enforce a frequency limit. You need to know approximately whether they are near or over that limit. "Approximately" is doing a lot of work in that sentence, but it turns out there is a whole branch of mathematics dedicated to making "approximately" precise and provable.

It is called Local Differential Privacy, and the intuition behind it is something like this.

Imagine you want to know the average height of everyone in a room, but no one wants to reveal their actual height. So you try a different approach. You ask each person to add a random number, somewhere between negative five and positive five, to their real height before writing it on a card. You collect all the cards and compute the average.

The average of the cards will be close to the true average height. The random noise mostly cancels out across a large group. But no single card tells you anything reliable about the person who wrote it. Their card says 5'11" but their real height could be anywhere from 5'6" to 6'4". You cannot tell.

Veil works the same way. When your browser has seen an ad five times, it adds calibrated random noise to that number before reporting anything to the server. The server might receive a 3. It might receive a 7. Over many users, the aggregate picture is accurate enough to be useful. For any individual user, the true count is mathematically obscured.

Your real ad count never leaves your browser.

---

**The part that surprised me while building it**

I expected the hard part to be the math. It was not. The diffprivlib library implements the noise mechanisms cleanly. The epsilon parameter, which controls how much noise to add, has well-understood properties from the academic literature.

The hard part was the "fail-closed" design decision.

Every user gets a small epsilon budget per ad campaign. Every time the extension reports a noisy count, it spends a little of that budget. When the budget runs out, the extension blocks the ad. Not because there is a policy that says "block it." Because there is no longer a mathematically valid way to report frequency data without exceeding the privacy guarantee.

The question I had to answer was: what should happen when the math runs out of room? The easy answer was to fail open, to show the ad anyway and reset the budget. That is what most systems would do. I went the other direction. When the budget is exhausted, the ad is suppressed. Privacy wins in the edge case.

That felt like the right choice. It also felt like the choice that most commercial ad tech would never make, because it trades availability for user protection.

---

**Why this matters now specifically**

Third-party cookies are gone. The infrastructure that made identity-based frequency capping easy has been deprecated across all major browsers. The ad industry has spent years in a kind of denial about this, building replacement identity mechanisms that preserve the surveillance model in different technical clothing.

There is a cleaner path. Apple and Google have been using Local Differential Privacy internally for years, for things like understanding what emoji people type or what websites are popular in aggregate. The math works. It just has not been applied to open-web advertising in a way anyone could use.

Veil is an attempt to build that bridge. It is a Chrome extension with a Go backend and no user_id column anywhere in the database. That last part is structural. A future developer could not accidentally add user tracking without writing a migration. The privacy guarantee is baked into the schema, not just the policy.

---

**What is next**

The extension works. The code is open at https://github.com/sourikduttanyu/Veil. What I want to build next is publisher-side tooling: a way for a website to declare its frequency cap preferences in a standard format that Veil can read, so the extension does not have to guess what the right limit is for a given campaign.

The longer-term question is whether this model can get real adoption. Publishers would need to trust that LDP-reported counts are accurate enough to be useful. Advertisers would need to accept slightly noisier delivery data in exchange for a system users do not try to circumvent. Both of those require the industry to internalize something it has resisted: that surveillance was never a feature, it was a cost imposed on users that users are now, finally, in a position to refuse.

Veil is a bet that the cost was never necessary in the first place.

If that argument interests you, the code is there to look at and break and improve.
