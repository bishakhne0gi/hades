<!-- Author: Bishakh -->

# Day 2 Blog — LinkedIn-ready (plain text, under 3,000 chars, paste as-is)

> LinkedIn strips markdown and caps posts at 3,000 characters. The block below is
> plain text under that limit. Everything between the lines is the post.

------------------------------------------------------------------------------------

I built a live World Cup 2026 hub. Then I cleared the diagram and asked one thing of every box: why are you here?

Not what each box is. Why it exists, and what we chose not to do instead.

Most system diagrams are tours. This is a CDN. This is a load balancer. This is a database. That is an executor naming components. An architect starts with the human, then makes every box defend itself against the option they turned down.

THE FAN
Everything exists to serve one person watching a goal go in. If a box cannot make their experience faster or more reliable, it gets cut.

THE SCREEN
The page looks like one app. It is five, stitched at runtime, each panel owned by a different team. One big single-page app means one deploy for the whole UI, and one team becomes everyone's bottleneck.

THE PUBLIC EDGE
A thin edge layer is the only thing exposed publicly. It does TLS, auth, and rate-limiting, and serves cached assets close to the fan. Do that at the origin instead, and abusers have already reached your core before you say no.

THE PRIVATE NETWORK
Two boxes get confused constantly. The load balancer spreads traffic across healthy copies. The API gateway is the single guarded door for routing and policy. Different jobs, different boxes.

THE DATA
A live hub is mostly reads. So every write goes to one primary, and reads fan out to replicas. The cost we take on purpose: a read right after a write can be briefly stale.

THE REAL DATA
The match data isn't ours. The browser never calls the third-party APIs, the server does. Calling them from the browser leaks your keys, fights CORS, and cannot be cached.

THE HEARTBEAT
A goal is published once to a message bus. Three panels receive it three ways: WebSocket for the scoreboard, server-sent events for commentary, polling for standings. No single transport is right for everything.

One honest note. I had AI draft this diagram from a paragraph. It got the shape right, then tried to call the external APIs from the browser. I caught it and moved that server-side. That is the job now. AI drafts, you review. The value is knowing why the generated one is wrong.

Every box answers a question a junior would not have asked. Why isn't this one app? Why isn't one database doing both? Why can't the browser just call the API? Ask the question before you draw the box. That is the difference between executing and architecting.

Day 2 of a build series. 28 boxes to go.

What is one box in your stack you have never actually justified?

#SoftwareArchitecture #SystemDesign #Frontend #WebDevelopment #BuildInPublic

------------------------------------------------------------------------------------
