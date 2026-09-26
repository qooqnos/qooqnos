# Phoenix Social Commerce UI Product Contract

## Purpose

Phoenix's authenticated/customer-facing product experience should evolve toward a social-commerce network whose interaction model is familiar, visual, and continuous, while remaining fundamentally different from a generic social network.

The UI may take inspiration from Instagram's social interaction model:

- Follow people and businesses
- Feed
- Explore
- Create/Post
- Activity
- Profile

But Phoenix content is primarily **products and services**, and every interaction should strengthen the Phoenix loop:

`Understand Demand → Understand Supply → Decide → Match → Connect → Act → Learn`

The goal is not to copy Instagram. The goal is to make discovery, decision-making and commerce feel native to a social product.

## Core Experience

The primary authenticated experience is a Social Commerce Feed.

### Feed

The Feed can contain:

- Posts from followed users
- Posts from followed businesses/sellers
- Product posts
- Service posts
- Relevant Phoenix recommendations

A product/service post can expose context-aware actions such as:

- Like
- Comment
- Save
- Share
- Follow
- Ask Price
- View
- Compare
- Instant Buy
- Book
- Request Service

The action set must depend on the canonical supply type and available capabilities.

## Explore

Explore is Phoenix's intelligent discovery surface.

It should eventually use explicit and implicit behavioral signals, including:

- Searches
- Viewed content
- Time spent on a post
- Likes
- Comments
- Saves
- Shares
- Follows
- Product opens
- Price questions
- Purchases
- Bookings
- Repeated skips/dismissals

These signals are inputs to preference and intent understanding.

The product must not fabricate live intelligence when the corresponding backend capability does not exist. Until canonical recommendation/personalization capabilities are available, UI states must be clearly demonstrative or use real existing Discovery capabilities.

Explore should evolve from content recommendation toward intent-aware matching.

## Following

Users can follow:

- Other users
- Businesses
- Sellers/brands

Following should become a first-class signal for Feed ranking and discovery.

## Create / Post

Every Phoenix user can create a post.

A Phoenix post is not merely a social text/image post. It is a supply-oriented social object.

Examples:

- Product post
- Service post
- Product/service introduction
- Offer/request that maps to a supported supply model

The seller/user may provide minimal raw information. Existing Seller AI capabilities may enrich that input into marketplace-ready structured supply, subject to the canonical seller AI contract and acceptance workflow.

## Product Post

Product posts should make commerce actions visible without turning the Feed into an ERP.

Typical actions:

- Compare
- Ask Price
- Save
- Share
- Instant Buy

### Instant Buy

For products that support direct purchase, the primary commerce action is **Instant Buy**.

The experience should minimize unnecessary navigation:

`Product Post → Options → Delivery → Payment → Confirmation`

When the user's required information is already available, the flow may be optimized further.

No new checkout source of truth should be created. Reuse the canonical Commerce/Checkout capabilities.

## Compare

Every comparable product post should expose a **Compare** action.

### Selection behavior

When the user selects one product for comparison:

- The product is added to a comparison selection.
- The Compare UI remains available while the user continues browsing.

When two or more products are selected:

- A visible/sticky Compare button appears.
- The button shows the number of selected products.
- The user can open the comparison surface without losing the current browsing context.

Example:

`⚖ مقایسه ۲ محصول`

The selection should survive navigation within the social-commerce experience where technically appropriate.

### Comparison surface

The comparison surface should align canonical product attributes across products.

Potential fields include:

- Price
- Brand
- Category
- Relevant attributes
- Availability
- Shipping
- Warranty
- Rating/reviews when canonical Trust data exists

Phoenix may normalize semantically equivalent attributes for comparison, but must not invent missing facts.

A future Ask Phoenix layer may explain differences and answer questions such as:

- «تفاوت اصلی این سه محصول چیست؟»
- «برای نیاز من کدام مشخصات مهم‌تر است؟»

Any recommendation must be grounded in available canonical product facts and the user's explicit need/context.

## Smart Intent / Intent Board

Phoenix should be able to turn an expressed need into a persistent buying intent.

Example:

> «برای اتاقم یک میز کار تا ۱۵ میلیون می‌خواهم.»

The intent can remain active while Phoenix:

- Finds matching products
- Finds new matching products
- Tracks relevant price changes
- Tracks availability
- Supports comparison
- Leads to purchase

This is a future capability and must not be represented as live production intelligence until its canonical backend exists.

## Seller / Business Profile

A seller/business profile is a social supply surface containing:

- Profile identity
- Follow action
- Products
- Services
- Social content
- Trust/reputation evidence when available
- Relevant business information

Operational management remains in dedicated business/admin routes.

## Navigation Model

The customer-facing social shell should converge toward:

- Home / Feed
- Explore
- Create
- Activity
- Profile

Desktop layouts may use a wider shell; mobile layouts should use a bottom navigation pattern.

Operational routes such as business management, billing, CRM, SEO and administration must not become the dominant social shell.

## Recommendation and Ranking Boundary

The UI may collect and represent interaction events, but recommendation/ranking ownership belongs to canonical backend capabilities.

Do not create a second recommendation engine inside the web application.

Do not use fabricated scores, fake personalization or invented behavioral signals as production truth.

## Design Principles

- Visual and media-first
- Fast scanning
- Familiar social interaction patterns
- Commerce actions close to the content
- Minimal navigation friction
- Clear distinction between content, supply and action
- RTL-first for Persian
- Responsive
- Accessible
- Calm, premium and intelligent rather than dashboard-like

## Implementation Gate

Before changing the Social Commerce UI:

1. Read this contract.
2. Read `docs/PHOENIX_PRODUCT_NORTH_STAR.md`.
3. Read `docs/CAPABILITY_DECISION_RULES.md`.
4. Read `docs/IMPLEMENTATION_LEDGER.md`.
5. Inspect existing Discovery, Commerce, Checkout, Catalog, Trust, Seller AI and Design System capabilities.
6. Reuse canonical capabilities.
7. Do not create parallel domain models or fake intelligence.
8. Keep UI-only demo states explicitly distinguishable from live production data.

## Initial Implementation Slice

The first UI slice should establish:

- Social Commerce shell
- Feed / Following / Explore navigation
- Product/service post cards
- Follow and social actions
- Compare action
- Persistent comparison tray
- Visible Compare button once two or more products are selected
- Instant Buy action where the canonical checkout route is available
- Create/Post entry point
- Responsive mobile navigation

The first slice may use clearly labelled existing/demo data for visual development, while all production actions must route through existing canonical boundaries.
