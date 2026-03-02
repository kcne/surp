# Bus Ticket Reservation System - Implementation Plan

## Project Overview
Internal ticket reservation web application for bus agency management. Focus on UI-first approach to gather requirements, then design backend and database accordingly.

---

## Requirements Gathering - Questions & Clarifications

### 1. Authentication & User Management
**Questions:**
- [ ] What user roles are needed? (Admin, Staff, Manager, etc.)
- Admin, Staff (no complex roles needed)
- [ ] What permissions should each role have? (the same)
- [ ] Should there be user management (CRUD operations for users)? (We can have that)
- [ ] Password requirements? (min length, complexity) (classic standards)
- [ ] Session timeout duration? (can be long - this is internal)
- [ ] Should login sessions persist across browser restarts? (yes)

**Confirmed Requirements:**
- Two roles: Admin and Staff (same permissions)
- User management CRUD operations included
- Classic password standards (min length, complexity)
- Long session timeout (internal use)
- Sessions persist across browser restarts
- Registration feature deferred to later phase

---

### 2. Stations Management
**Current Requirements:**
- Station Name
- Station Address
- Additional Notes

**Questions:**
- [ ] Should stations have unique codes/IDs for reference?(if it makes sense)
- [ ] Do we need to track station capacity or facilities? (no)
- [ ] Should stations be soft-deletable (archived) or hard-deleted?(soft delete)
- [ ] Any validation rules? (e.g., name required, address format) (only required for address and name)
- [ ] Should we support station categories/types?(We can add basic support)
- [ ] Do we need geographic coordinates for mapping?(Later)

**Confirmed Requirements:**
- Station Name and Address are required
- Notes are optional
- Soft delete (archived, not hard-deleted)
- Basic station category/type support
- Unique codes/IDs if it makes sense (auto-generated)
- Geographic coordinates deferred to later

---

### 3. Lines Management
**Current Requirements:**
- Name
- Departure Station
- Intermediate Stations (multiple)
- Arrival Station
- Lines should be reversible

**Questions:**
- [ ] How should intermediate stations be ordered? (drag-and-drop, numbered list, or just multi-select?) (Should be draggable since the order is important, should follow good ux practices)
- [ ] When creating a reverse line, should it auto-generate from the original line? (yes, jjust reverse button or some similar mechanism)
- [ ] Can a line have the same station as departure and arrival? (circular routes- not yet)
- [ ] Should lines have additional metadata? (distance, estimated duration, base fare - we can add it but to be optional)
- [ ] Can intermediate stations be in any order, or must they follow geographic logic?(right now yes, the staff will manage it)
- [ ] Should we prevent duplicate lines (same stations in same order)?(yes)
- [ ] Do lines need status (active/inactive)?(Yes we can add that)

**Confirmed Requirements:**
- Intermediate stations ordered via drag-and-drop (good UX)
- Reverse line button/mechanism to auto-generate reverse line
- Prevent duplicate lines (same stations in same order)
- Lines have active/inactive status
- Optional metadata: distance, estimated duration, base fare
- No circular routes (departure ≠ arrival) for now
- Staff manages station order (no geographic validation)

---

### 4. Ride Schedule Management
**Current Requirements:**
- Ride Name (format: dep-arr)
- Line selection (from existing lines)
- Bus Capacity (optional, default: 38)
- Recurring vs One-time rides
- For recurring: day of week + departure/arrival times
- For one-time: specific date + departure/arrival times

**Questions:**
- [ ] Can multiple rides use the same line on the same day?(yes)
- [ ] Should ride names be auto-generated or manual? (yes)
- [ ] For recurring rides, how far in advance should they be generated? (e.g., 3 months, 6 months)(3 months)
- [ ] Can recurring rides have exceptions? (e.g., skip holidays, add extra rides) (yes, we need to add support for that)
- [ ] Should we support different bus capacities per ride? (yes, but default is 38)
- [ ] Can rides be edited after reservations are made? (what happens to existing reservations?) (yes, the reservation should be updated automatically)
- [ ] Should rides have status? (scheduled, completed, cancelled)(yes)
- [ ] Do we need to track actual vs scheduled times?(no)
- [ ] Timezone handling - single timezone or multiple?(not yet)
- [ ] Can a ride be cancelled? What happens to reservations?(yes, reservations should be cancelled to)
- [ ] Should we support ride templates or bulk creation?(this should come later)

**Confirmed Requirements:**
- Ride names auto-generated (format: dep-arr)
- Multiple rides can use same line on same day
- Recurring rides generate instances 3 months in advance
- Recurring rides support exceptions (skip holidays, add extra rides)
- Bus capacity per ride (default: 38, optional)
- Rides can be edited (reservations auto-update)
- Rides have status: scheduled, completed, cancelled
- Cancelled rides → reservations also cancelled
- No actual vs scheduled time tracking
- Single timezone (no multi-timezone support yet)
- Ride templates/bulk creation deferred

---

### 5. Reservation Flow
**Current Requirements:**
- Interactive calendar showing rides per day
- Click day → shows available rides on right
- Click ride → opens reservation page with bus seat map
- Seat map shows:
  - Reserved seats: passenger name, surname, phone
  - Empty seats: available
- Click empty seat → reservation modal
- Modal includes:
  - Pre-selected ride info
  - Passenger search bar
  - Add new passenger option (Name, Surname, Phone, Notes)
  - Select departure and arrival stations
- Save reservation → auto-update seat map

**Questions:**
- [ ] What is the bus seat layout? (2-2, 2-1, single aisle, double aisle?)(2-2)
- [ ] How many seats total? (default 38, but can vary per ride)
- [ ] Should seats be numbered? (1,2,3,4,5, etc.)
- [ ] Can passengers reserve multiple seats in one transaction?(only staff reserves seats-> that would add complexity now maybe we can add it later)
- [ ] Can passengers reserve seats for other passengers in one go? (only staff will be using this again)
- [ ] Should we show seat preferences? (window, aisle, front, back)(no)
- [ ] Can reservations be edited? (change seat, change passenger, change stations) (yes)
- [ ] Can reservations be cancelled? (soft delete or hard delete?)(yes)
- [ ] Should we track reservation status? (pending, confirmed, cancelled)(yes)
- [ ] Do we need reservation history/audit trail?(not now)
- [ ] Should passengers be able to reserve from intermediate stations?(staff yes)
- [ ] What if a passenger wants to get on at an intermediate station but seat is already taken by someone getting off earlier?(staff-> should be managed by station if its empty for a ride of station that they selected should be free(auto updated))
- [ ] Should we prevent double-booking of the same seat?(of course:)
- [ ] Real-time updates if multiple users are booking simultaneously?(no need)
- [ ] Should calendar show availability indicators? (e.g., fully booked, few seats left)(yes)
- [ ] Do we need filters on calendar? (by line, by time, by availability)(yes)
- [ ] Should we support waitlists for fully booked rides?(later)
- [ ] Can reservations be transferred to different rides/dates?(no)
- [ ] Do we need to track payment status? (for future integration)(no payments)
- [ ] Should we send confirmation notifications? (email, SMS, print ticket?)(no)

**Confirmed Requirements:**
- 2-2 seat layout (2 seats left, aisle, 2 seats right)
- Seats numbered sequentially: 1, 2, 3, 4, 5... (up to capacity)
- One reservation = one seat = one passenger (multiple seats per transaction deferred)
- Reservations can be edited (seat, passenger, stations)
- Reservations can be cancelled (soft delete)
- Reservation status: pending, confirmed, cancelled
- Staff can reserve from intermediate stations
- **Seat conflict logic**: If seat is empty for a station segment, it should be free (auto-updated). Example: If passenger reserves seat 5 from Station 1→3, and another passenger wants Station 2→4, the system checks if seat 5 is free for Station 2 segment (it's not, so conflict). If passenger reserves Station 1→2, seat 5 is free for Station 3→4.
- Prevent double-booking (database constraints)
- No real-time updates needed (2-3 concurrent users)
- Calendar shows availability indicators (available, limited, full)
- Calendar filters: by line, by time, by availability
- No waitlists, transfers, or payment tracking
- No notifications (email/SMS/print)

---

### 6. Passenger Management
**Current Requirements:**
- Search existing passengers
- Add new passenger: Name, Surname, Phone Number, Notes
- Passengers saved to database

**Questions:**
- [ ] Should phone numbers be unique? (prevent duplicates) -> no need
- [ ] Should we validate phone number format?yes
- [ ] Do we need additional passenger fields? (Email, ID number, Date of birth, Address)-> Optional
- [ ] Can passengers be edited after creation?Yes
- [ ] Should we track passenger history? (all their reservations) Yes
- [ ] Do we need passenger preferences? (preferred seat, preferred stations) No
- [ ] Should we support passenger groups/families? No
- [ ] Can passengers be merged if duplicates are found? (later)

**Confirmed Requirements:**
- Phone numbers not unique (can have duplicates)
- Phone number format validation required
- Optional fields: Email, ID number, Date of birth, Address
- Passengers can be edited
- Track passenger history (all reservations)
- No passenger preferences or groups
- Passenger merge functionality deferred

---

### 7. Technical & Non-Functional Requirements

THIS IS MVP SOFTWARE MAX 2-3 concurent users
**Questions:**
- [ ] What is the expected number of concurrent users? 
- [ ] How many stations, lines, rides, reservations are expected?
- [ ] What browsers/devices need to be supported? web, mobile and desktop
- [ ] Do we need offline capability? no
- [ ] Performance requirements? (page load time, search response time)
- [ ] Do we need data export? (CSV, PDF reports) -> We need support to export list of passengers for a ride
- [ ] Should we support printing tickets/receipts?-> no
- [ ] Do we need audit logging? (who created/edited/deleted what)-> yes
- [ ] Backup and recovery requirements? no
- [ ] Should we support multiple languages? no
- [ ] Do we need responsive design (mobile/tablet support)? yes
- [ ] Should we support dark mode? -> no

**Confirmed Requirements:**
- **MVP for 2-3 concurrent users maximum**
- Support: Web, Mobile, Desktop (responsive design required)
- No offline capability
- Export: List of passengers for a ride (CSV/PDF)
- No printing tickets/receipts
- Audit logging: who created/edited/deleted what
- No backup/recovery requirements
- Single language (English)
- No dark mode

---

### 8. Future Features (Deferred)
- [ ] User registration yes
- [ ] Payment integration no
- [ ] Email/SMS notifications no
- [ ] Reporting and analytics dashboard not yet
- [ ] Mobile app no
- [ ] API for third-party integrations not yet
- [ ] Multi-language support not yet

---

## UI/UX Design Considerations

### Layout Structure
```
┌─────────────────────────────────────────┐
│  Header (Logo, User Info, Logout)      │
├──────────┬──────────────────────────────┤
│          │                              │
│ Sidebar  │  Main Content Area           │
│          │                              │
│ - Login  │  - Stations                  │
│ - Stations│ - Lines                     │
│ - Lines  │ - Ride Schedule              │
│ - Schedule│ - Reservations               │
│ - Reservations│                          │
│          │                              │
└──────────┴──────────────────────────────┘
```

### Key UI Components

1. **Interactive Calendar**
   - Month view with clickable dates
   - Visual indicators for days with rides
   - Availability badges (available, limited, full)
   - Click date → right panel shows rides for that day

2. **Bus Seat Map**
   - Visual representation of bus interior
   - 2-2 layout: 2 seats left, aisle, 2 seats right
   - Seats numbered sequentially: 1, 2, 3, 4, 5... (up to bus capacity)
   - Grid layout showing seat arrangement
   - Color coding: 
     - Available (green/white)
     - Reserved (red/gray with passenger info)
     - Selected (blue highlight)
   - Hover shows passenger info for reserved seats (name, surname, phone, stations)
   - Click available seat → opens reservation modal
   - Responsive: adapts to different screen sizes
   - Example layout for 38-seat bus:
     ```
     [1] [2]    AISLE    [3] [4]
     [5] [6]    AISLE    [7] [8]
     ...
     [37][38]   AISLE    [39][40] (if capacity > 38)
     ```

3. **Reservation Modal**
   - Ride information display (read-only)
   - Passenger search with autocomplete
   - "Add New Passenger" button/form
   - Station selection (departure/arrival dropdowns)
   - Save/Cancel buttons

4. **Form Components**
   - Consistent styling across all forms
   - Validation feedback (inline errors)
   - Loading states for async operations
   - Success/error notifications

---

## Database Schema (Finalized)

### Core Entities

1. **Users**
   - id (PK), username (unique), password_hash, role (enum: 'admin', 'staff'), created_at, updated_at, created_by (FK to Users, nullable)

2. **Stations**
   - id (PK), name (unique, required), address (required), notes (text, nullable), category (string, nullable), code (string, unique, nullable, auto-generated), deleted_at (nullable, soft delete), created_at, updated_at, created_by (FK to Users)

3. **Lines**
   - id (PK), name (required), departure_station_id (FK to Stations), arrival_station_id (FK to Stations), distance (decimal, nullable), estimated_duration (integer minutes, nullable), base_fare (decimal, nullable), status (enum: 'active', 'inactive'), created_at, updated_at, created_by (FK to Users)
   - Constraint: departure_station_id ≠ arrival_station_id (no circular routes)
   - Constraint: Prevent duplicate lines (same stations in same order)

4. **Line_Stations** (Intermediate stations with order)
   - id (PK), line_id (FK to Lines), station_id (FK to Stations), order_index (integer, required), created_at
   - Unique constraint: (line_id, order_index)
   - Unique constraint: (line_id, station_id) - no duplicate stations in same line

5. **Rides**
   - id (PK), name (auto-generated: dep-arr), line_id (FK to Lines), bus_capacity (integer, default: 38), is_recurring (boolean), recurrence_days (JSON array: [0,1,2,3,4,5,6] for Sun-Sat), departure_time (time), arrival_time (time), start_date (date, for recurring), end_date (date, for recurring, nullable), specific_date (date, for one-time, nullable), status (enum: 'scheduled', 'completed', 'cancelled'), created_at, updated_at, created_by (FK to Users)
   - Constraint: Either (is_recurring=true with start_date) OR (is_recurring=false with specific_date)

6. **Ride_Exceptions** (For recurring ride exceptions)
   - id (PK), ride_id (FK to Rides), exception_date (date), exception_type (enum: 'skip', 'extra'), created_at, created_by (FK to Users)
   - Unique constraint: (ride_id, exception_date, exception_type)

7. **Ride_Instances** (Generated from recurring rides + one-time rides)
   - id (PK), ride_id (FK to Rides, nullable for one-time), scheduled_date (date), departure_time (time), arrival_time (time), status (enum: 'scheduled', 'completed', 'cancelled'), created_at, updated_at
   - Index: (scheduled_date, status) for calendar queries
   - Note: One-time rides create single instance, recurring rides generate instances 3 months ahead

8. **Passengers**
   - id (PK), name (required), surname (required), phone (required, validated format), email (nullable), id_number (string, nullable), date_of_birth (date, nullable), address (text, nullable), notes (text, nullable), created_at, updated_at, created_by (FK to Users)
   - Index: (phone) for search
   - Index: (name, surname) for search

9. **Reservations**
   - id (PK), ride_instance_id (FK to Ride_Instances), passenger_id (FK to Passengers), seat_number (integer, required), departure_station_id (FK to Stations), arrival_station_id (FK to Stations), status (enum: 'pending', 'confirmed', 'cancelled'), created_at, updated_at, created_by (FK to Users), cancelled_at (nullable), cancelled_by (FK to Users, nullable)
   - Unique constraint: (ride_instance_id, seat_number) WHERE status != 'cancelled' - prevents double booking
   - Constraint: departure_station_id ≠ arrival_station_id
   - Constraint: Both stations must be on the ride's line (departure, intermediate, or arrival)
   - Index: (ride_instance_id, status) for seat map queries
   - Index: (passenger_id) for passenger history

10. **Audit_Logs** (Track all changes)
    - id (PK), table_name (string), record_id (integer), action (enum: 'create', 'update', 'delete'), old_values (JSON, nullable), new_values (JSON, nullable), user_id (FK to Users), created_at
    - Index: (table_name, record_id, created_at)
    - Index: (user_id, created_at)

### Key Relationships
- Users → created_by (self-referential for audit)
- Stations → Lines (departure/arrival, many-to-one)
- Lines → Line_Stations → Stations (many-to-many with order)
- Lines → Rides (one-to-many)
- Rides → Ride_Instances (one-to-many, generated)
- Rides → Ride_Exceptions (one-to-many)
- Ride_Instances → Reservations (one-to-many)
- Passengers → Reservations (one-to-many, for history)
- Stations → Reservations (departure/arrival, many-to-many)

---

## Technology Stack Recommendations

### Frontend
- **Framework:** React (with TypeScript) or Next.js
- **UI Library:** Material-UI, Ant Design, or Tailwind CSS + Headless UI
- **State Management:** React Query + Zustand/Redux
- **Form Handling:** React Hook Form + Zod validation
- **Calendar Component:** FullCalendar or custom with date-fns
- **HTTP Client:** Axios or Fetch API

### Backend
- **Framework:** Node.js (Express/Fastify) or Python (FastAPI/Django)
- **Database:** PostgreSQL (recommended) or MySQL
- **ORM:** Prisma, TypeORM, or Sequelize (Node) / SQLAlchemy (Python)
- **Authentication:** JWT tokens or session-based
- **API:** RESTful API (GraphQL optional for future)

### Development Tools
- **Version Control:** Git
- **Package Manager:** npm/yarn (Node) or pip/poetry (Python)
- **Testing:** Jest, React Testing Library (frontend), pytest (Python backend)
- **Linting:** ESLint, Prettier

---

## Implementation Phases

### Phase 1: Foundation & Authentication
1. Project setup (repo, dependencies, folder structure)
2. Database setup and migrations (all tables with constraints)
3. Authentication system (login with persistent sessions)
4. Basic layout (sidebar + main content, responsive)
5. User management CRUD (Admin and Staff roles)
6. Audit logging system

### Phase 2: Core Data Management
1. Stations CRUD (with soft delete, category support)
2. Lines CRUD (with drag-and-drop intermediate stations)
3. Line reversal functionality
4. Line duplicate prevention
5. Basic validation and error handling

### Phase 3: Ride Scheduling
1. Ride creation (one-time)
2. Recurring ride creation (with day selection)
3. Recurring ride exceptions (skip holidays, add extra rides)
4. Ride instance generation (3 months ahead, with exception handling)
5. Ride listing and management
6. Ride editing (with reservation auto-update)
7. Ride cancellation (with reservation cancellation)

### Phase 4: Reservation System
1. Calendar component with availability indicators
2. Ride listing by date with filters (line, time, availability)
3. Bus seat map component (2-2 layout, numbered seats)
4. Reservation modal with passenger search
5. Passenger search and creation (with optional fields)
6. Reservation CRUD operations (create, edit, cancel)
7. Seat conflict detection and validation
8. Export passengers list for a ride (CSV/PDF)

### Phase 5: Polish & Enhancement
1. UI/UX improvements (drag-and-drop for stations, calendar UX)
2. Error handling and validation (all forms, seat conflicts)
3. Loading states and feedback
4. Responsive design (mobile, tablet, desktop)
5. Passenger history view
6. Testing (critical paths: reservations, seat conflicts)
7. Documentation

---

## Next Steps

1. **Review and answer questions** in this document
2. **Confirm assumptions** or provide corrections
3. **Prioritize features** if not all can be built initially
4. **Choose technology stack** based on team expertise
5. **Create detailed wireframes/mockups** for key screens
6. **Finalize database schema** based on confirmed requirements
7. **Set up development environment** and begin Phase 1

---

## Key Business Logic Rules

### Seat Conflict Detection
When creating/editing a reservation:
1. Get all reservations for the ride_instance where status != 'cancelled'
2. For each existing reservation on the same seat:
   - Check if station segments overlap
   - Station order: departure → intermediate stations → arrival
   - If new reservation's departure_station comes before existing reservation's arrival_station AND new reservation's arrival_station comes after existing reservation's departure_station → CONFLICT
3. Example: 
   - Existing: Seat 5, Station 1 → Station 3
   - New: Seat 5, Station 2 → Station 4 → CONFLICT (overlap)
   - New: Seat 5, Station 1 → Station 2 → OK (no overlap, seat free after Station 2)
   - New: Seat 5, Station 3 → Station 4 → OK (no overlap, seat free before Station 3)

### Recurring Ride Instance Generation
- Generate instances 3 months in advance from start_date
- For each day in recurrence_days (0=Sunday, 6=Saturday):
  - Check Ride_Exceptions for that date
  - If exception_type = 'skip', don't create instance
  - If exception_type = 'extra', create instance even if not in recurrence_days
- When ride is edited, regenerate instances (may need to update existing reservations)
- When ride is cancelled, cancel all future instances and their reservations

### Line Reversal
- Create new line with:
  - Name: Original name + " (Reverse)" or similar
  - Departure = Original arrival
  - Arrival = Original departure
  - Intermediate stations in reverse order
- Copy optional metadata (distance, duration, fare) if applicable

### Reservation Status Flow
- New reservation: status = 'confirmed' (immediate confirmation)
- Edit reservation: Update fields, keep status
- Cancel reservation: status = 'cancelled', set cancelled_at and cancelled_by
- When ride cancelled: All reservations → status = 'cancelled'

---

## Bus Seat Layout Details

### 2-2 Layout Structure
- **Left side**: 2 seats per row (window + middle)
- **Aisle**: Center walkway
- **Right side**: 2 seats per row (middle + window)
- **Numbering**: Sequential from front to back, left to right
  - Row 1: Seats 1 (left window), 2 (left middle), 3 (right middle), 4 (right window)
  - Row 2: Seats 5, 6, 7, 8
  - And so on...

### Seat Map Visualization
- Display as grid with visual aisle separator
- Each seat is a clickable card/button
- Show seat number clearly
- For reserved seats: Show passenger name, surname, phone, and station route (dep → arr)
- Visual feedback: hover effects, click states, loading states
- Mobile: May need to stack or use different layout for smaller screens

---

## Notes

- This plan is a living document and should be updated as requirements are clarified
- UI mockups/wireframes should be created before backend implementation
- Database schema is finalized based on confirmed requirements
- MVP scope: 2-3 concurrent users, focus on core functionality
- Consider creating a prototype/demo for key flows (especially reservation flow) before full implementation

