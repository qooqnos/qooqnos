# Phoenix Vertical Workflow UI Contract

## Shared workflow
Business Workspace uses one shared workflow canvas. A vertical changes stage order, module composition, role emphasis, and canonical domain links; it does not create a second dashboard application.

## Canonical stages

### Clinic
Understand service → schedule availability → booking → follow-up.

### Retail
Create product → publish supply → inspect inventory → order.

### Restaurant
Manage menu → reservation/table capacity → order → fulfillment/delivery.

### Salon
Define service → provider context → availability → booking.

## UI invariants
- UI composition never grants authorization.
- Domain state remains in canonical backend modules.
- Local UI state is limited to presentation controls.
- Semantic module URLs use stable slugs and do not depend on localized labels.
- Every module exposes a shared layout: command, calendar, catalog, people, commerce, operations, or communication.
- Every workflow stage has a previous/next handoff inside the shared canvas.
