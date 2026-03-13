## Plan: Backend Delivery in Small Testable Slices

Deliver the NestJS backend through short, independently verifiable slices. Each slice must produce working behavior, automated tests, and a clear validation command set before moving forward.

**Execution Rules**
1. No slice is complete without API tests and at least one failure-path test.
2. Each slice must run against local dockerized PostgreSQL.
3. Every endpoint added in a slice must enforce tenant scoping and authentication unless explicitly public.
4. Every write endpoint must set createdById and updatedById from auth context, not request body.
5. Keep migrations additive and reversible.

**Definition of Done (Global)**
1. Lint passes.
2. Unit and integration tests for changed module pass.
3. OpenAPI docs updated for new endpoints.
4. Postman folder for slice updated.
5. Negative security tests included.

**Slice 0 - Project Skeleton and Local Runtime** - DONE
1. Goal: Create runnable backend service with health endpoint and PostgreSQL connectivity.
2. Scope:
1. Initialize NestJS app structure with modular folders.
2. Add docker-compose for api and postgres.
3. Add env validation on startup.
4. Add health endpoint and readiness endpoint.
3. Tests:
1. Health endpoint returns healthy when DB is reachable.
2. Readiness fails when DB is unavailable.
4. Validation:
1. docker-compose up boots services.
2. Local curl to health and readiness succeeds.
3. Migration command can run without error.
5. Exit criteria: Team can start and test backend locally in one command.

**Slice 1 - Prisma Integration and Baseline Data Access** - DONE
1. Goal: Connect NestJS to Prisma with clean lifecycle handling.
2. Scope:
1. Prisma module and service with graceful shutdown.
2. Seed command scaffolding.
3. Base repository helpers for pagination and filtering.
3. Tests:
1. Prisma service connection and disconnection test.
2. Simple smoke query test.
4. Validation:
1. API start logs successful DB connection.
2. Seed command inserts baseline records.
5. Exit criteria: App can query database reliably in tests and local runtime.

**Slice 2 - Tenant Resolution and Request Context**
1. Goal: Resolve tenant per request and block unknown tenants.
2. Scope:
1. Tenant model CRUD minimal endpoints.
2. Middleware to resolve tenant from X-Tenant-Slug header.
3. Request context provider exposing tenantId.
4. Inactive tenant rejection path.
3. Tests:
1. Missing tenant header returns validation error.
2. Unknown tenant slug returns not found.
3. Inactive tenant returns forbidden.
4. Validation:
1. Requests with valid tenant header pass.
2. Requests without valid tenant are blocked globally.
5. Exit criteria: Tenant context is mandatory and stable.

**Slice 3 - Authentication Login and Session Creation** - DONE
1. Goal: Implement login with JWT access token and DB refresh session.
2. Scope:
1. Auth login endpoint.
2. Password hash verification.
3. Access token issuance.
4. Refresh session row creation with hashed refresh token.
3. Tests:
1. Valid credentials issue tokens.
2. Invalid password rejects.
3. Login for inactive user rejects.
4. Tenant mismatch rejects.
4. Validation:
1. Postman login request returns user profile and access token.
2. Refresh session appears in DB.
5. Exit criteria: Secure login works for tenant-scoped users.

**Slice 4 - Token Refresh Rotation and Logout**
1. Goal: Implement robust session lifecycle.
2. Scope:
1. Refresh endpoint with token rotation.
2. Revoke old refresh token after rotation.
3. Logout endpoint revoking current session.
4. Session expiration checks.
3. Tests:
1. Refresh returns new token pair.
2. Reusing old refresh token fails.
3. Revoked token fails.
4. Expired refresh token fails.
4. Validation:
1. Full login to refresh to logout path works in Postman.
2. Replay attempts are blocked.
5. Exit criteria: Session security baseline complete.

**Slice 5 - Auth Guard, Tenant Guard, Role Guard**
1. Goal: Protect private routes.
2. Scope:
1. JWT auth guard.
2. Tenant guard consistency check between token and request context.
3. Role-based decorator and guard for ADMIN, MANAGER, STAFF.
3. Tests:
1. Missing token rejected.
2. Wrong tenant token rejected.
3. Insufficient role rejected.
4. Validation:
1. Protected route matrix tested by role.
2. Security negative tests pass.
5. Exit criteria: Access control enforced across modules.

**Slice 6 - Users Module (Tenant-Scoped User Management)**
1. Goal: Manage users and roles safely.
2. Scope:
1. Create, list, update users in tenant.
2. Enforce unique username and email per tenant.
3. Role assignment and activation toggles.
4. Safe response shape excluding sensitive hashes.
3. Tests:
1. Duplicate username in same tenant fails.
2. Same username in different tenant succeeds.
3. Sensitive fields never returned.
4. Validation:
1. Admin can create manager and staff.
2. Manager and staff permission restrictions respected.
5. Exit criteria: Role hierarchy can be administered per tenant.

**Slice 7 - Audit Field Automation (createdBy and updatedBy)**
1. Goal: Guarantee audit integrity for all writes.
2. Scope:
1. Shared write helper or interceptor to inject actor IDs.
2. Prevent spoofing createdById and updatedById from request body.
3. Add update timestamp consistency checks.
3. Tests:
1. Create sets createdById and updatedById.
2. Update modifies updatedById only.
3. Body-injected audit IDs are ignored or rejected.
4. Validation:
1. DB rows show correct audit user IDs after writes.
2. Cross-user edits reflect latest editor.
5. Exit criteria: Audit trail trustworthy across modules.

**Slice 8 - Stations Module**
1. Goal: Deliver first business CRUD module.
2. Scope:
1. Station create, list, detail, update, delete.
2. Optional active flag behavior.
3. Tenant-scoped querying.
3. Tests:
1. Cross-tenant station access denied.
2. Validation errors for invalid payload.
3. Delete restriction when referenced by line or reservation.
4. Validation:
1. Frontend stations flow works against real API.
2. Postman folder for stations passes.
5. Exit criteria: Station management production-ready.

**Slice 9 - Lines Core Module**
1. Goal: Implement line CRUD and route integrity.
2. Scope:
1. Create and update lines with departure and arrival stations.
2. Validate departure differs from arrival.
3. Support direction mode and paired line metadata.
3. Tests:
1. Invalid station references fail.
2. Invalid direction mode logic fails.
3. Cross-tenant station-line binding blocked.
4. Validation:
1. Line create and update tested with real station data.
2. Frontend lines list and edit flows pass.
5. Exit criteria: Lines can be managed safely.

**Slice 10 - Line Stops and Reverse Line Operations**
1. Goal: Complete line routing behavior.
2. Scope:
1. Manage intermediate stops order.
2. Enforce unique station and order per line.
3. Reverse line creation endpoint.
4. Tests:
1. Duplicate order index fails.
2. Duplicate station in same line fails.
3. Reverse line idempotency or duplicate prevention test.
4. Validation:
1. Frontend intermediate station UI operations pass.
2. Reverse line workflow is stable.
5. Exit criteria: Route modeling complete.

**Slice 11 - Passengers Module with Search**
1. Goal: Passenger CRUD and lookup performance.
2. Scope:
1. Passenger create, list, update, delete.
2. Search endpoint by name, phone, email.
3. Optional passenger history endpoint.
3. Tests:
1. Search returns expected partial matches.
2. Inactive passenger handling behaves as expected.
3. Tenant isolation on search results.
4. Validation:
1. Frontend passenger page and search modal pass.
2. Postman search scenarios pass.
5. Exit criteria: Reservation flow can reliably find passengers.

**Slice 12 - Rides Template Module**
1. Goal: Model schedule templates for recurring and one-time rides.
2. Scope:
1. Ride CRUD with type, status, capacity.
2. Ride day-times endpoints.
3. Ride exception endpoints for skip and additional.
3. Tests:
1. Recurring ride requires day-times.
2. One-time ride requires date and times.
3. Invalid exception combinations rejected.
4. Validation:
1. Frontend schedule create and edit flow pass.
2. Status transitions behave correctly.
5. Exit criteria: Ride templates fully manageable.

**Slice 13 - Ride Instances Query and Materialization**
1. Goal: Serve date-based ride instances for reservation screen.
2. Scope:
1. Date query endpoint for ride instances.
2. Materialize from templates plus exceptions.
3. Include reservation count and availability summary.
3. Tests:
1. Date boundary and timezone edge tests.
2. Skip exception removes instance.
3. Additional exception creates instance.
4. Validation:
1. Frontend reservations date picker and ride list pass.
2. Instance counts align with reservations.
5. Exit criteria: Reservation entry screen has reliable data.

**Slice 14 - Reservations Single Booking**
1. Goal: Create and manage individual reservations.
2. Scope:
1. Create reservation endpoint with seat and station validation.
2. Update reservation endpoint.
3. Cancel reservation endpoint with status changes.
3. Tests:
1. Seat already booked fails.
2. Invalid departure or arrival path fails.
3. Cancellation updates state correctly.
4. Validation:
1. Seat map interactions pass for single reservation lifecycle.
2. Reservation list reflects latest state.
5. Exit criteria: Core booking works safely.

**Slice 15 - Reservations Batch Booking and Concurrency Safety**
1. Goal: Handle multi-seat booking and race conditions.
2. Scope:
1. Batch reservation endpoint.
2. Transactional locking strategy for seat allocation.
3. Capacity checks and overlap conflict checks.
3. Tests:
1. Concurrent booking race test for same seat.
2. Partial batch failure handling test.
3. Capacity exhaustion test.
4. Validation:
1. Stress test confirms no duplicate seat assignments.
2. Batch booking workflow works from frontend.
5. Exit criteria: Reservation engine safe under load.

**Slice 16 - Payment and Pricing Rules in Reservation Domain**
1. Goal: Stabilize financial fields and status transitions.
2. Scope:
1. Base price, discount, final price validation.
2. Payment status update rules.
3. Optional refund and void transitions.
3. Tests:
1. Discount greater than base price fails.
2. Invalid payment transition fails.
3. Cancelled reservation payment transition behavior tested.
4. Validation:
1. Financial fields consistent across create and update.
2. Postman negative scenarios pass.
5. Exit criteria: Payment semantics safe and predictable.

**Slice 17 - Reporting Essentials and Audit Query Endpoints**
1. Goal: Provide operational visibility for dashboard and support.
2. Scope:
1. Lightweight metrics endpoints for dashboard cards.
2. Audit query endpoint for entity change metadata.
3. Basic occupancy stats by line and date.
3. Tests:
1. Metrics are tenant-scoped.
2. Audit endpoint role restrictions.
4. Validation:
1. Dashboard can switch from mock data to API.
2. Audit checks usable for support workflows.
5. Exit criteria: Basic analytics available.

**Slice 18 - OpenAPI Completion and Contract Freeze**
1. Goal: Freeze API contract for frontend integration.
2. Scope:
1. Complete DTO docs and examples.
2. Document error codes and auth requirements.
3. Mark deprecated or optional fields clearly.
3. Tests:
1. OpenAPI schema lint passes.
2. Contract tests for critical endpoints pass.
4. Validation:
1. Frontend team can integrate without ambiguity.
2. Breaking changes require version bump policy.
5. Exit criteria: Stable API contract published.

**Slice 19 - Postman Collection and Scenario Runner**
1. Goal: End-to-end executable API scenarios.
2. Scope:
1. Collection folders per module.
2. Pre-request scripts for login, token refresh, tenant header.
3. Environment files for local and staging.
3. Tests:
1. Full collection runner passes on clean DB seed.
2. Negative scenario folder demonstrates expected failures.
4. Validation:
1. New developer can validate backend behavior from Postman only.
2. CI optional Newman run passes.
5. Exit criteria: Manual and CI API verification standardized.

**Slice 20 - CI Pipeline and Quality Gates**
1. Goal: Prevent regressions.
2. Scope:
1. CI jobs for lint, unit, integration, and e2e subsets.
2. Migration drift checks.
3. Coverage thresholds by module.
3. Tests:
1. Intentional failing test blocks pipeline.
2. Schema drift failure path tested.
4. Validation:
1. Pull requests require green checks.
2. Quality gates are documented and enforced.
5. Exit criteria: Sustainable delivery process established.

**Slice 21 - Staging Readiness and Launch Checklist**
1. Goal: Prepare first stable backend release.
2. Scope:
1. Staging docker deployment guide.
2. Seed strategy for demo tenants.
3. Security checklist and operational runbook.
3. Tests:
1. Smoke tests against staging environment.
2. Tenant isolation regression suite against staging.
4. Validation:
1. All critical flows pass end-to-end from frontend.
2. Release notes and rollback plan completed.
5. Exit criteria: Backend ready for controlled rollout.

**Dependency Map**
1. Must complete first: slices 0 to 5.
2. Foundation for business modules: slice 7.
3. Business sequence:
1. Stations before Lines.
2. Lines before Rides.
3. Rides before Ride Instances.
4. Passengers before full Reservation flow.
4. Hard blocker for production confidence: slices 15, 19, 20.

**Per-Slice Validation Template**
1. Run migration and seed.
2. Run unit and integration tests for affected modules.
3. Execute Postman folder for the slice.
4. Verify one positive and one negative path manually.
5. Record evidence in changelog with request and response samples.

**Risk Controls**
1. Concurrency risk in reservations handled early with dedicated stress tests.
2. Tenant leakage risk controlled by mandatory tenant guard and isolation tests in every slice.
3. Auth regression risk reduced by token replay and revocation tests.
4. Contract drift risk controlled by OpenAPI freeze and Postman regression runner.

**Out of Scope for Initial Iteration**
1. Event-driven architecture and async queues.
2. Advanced billing engine.
3. Full observability stack beyond structured logs and health checks.
4. Multi-region deployment.

**Recommended Cadence**
1. Week 1: slices 0 to 5.
2. Week 2: slices 6 to 11.
3. Week 3: slices 12 to 15.
4. Week 4: slices 16 to 21.

**Success Criteria**
1. All frontend flows run without mock APIs.
2. No cross-tenant data exposure in automated tests.
3. Reservation concurrency tests show zero duplicate seat allocation.
4. New developer can run system and validate behavior with docker-compose and Postman in under 30 minutes.
