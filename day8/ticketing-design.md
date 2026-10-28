# TicketHub: System Design & Scaling Architecture

## 1. Requirements

### Functional Requirements
- **Browse & Search Events:** Users can browse, search, and filter upcoming events (concerts, sports, festivals) by genre, location, artist, and date.
- **Interactive Seat Map:** Users can view real-time seating availability and pricing tiers for an event.
- **Seat Reservation (Hold):** Users can temporarily reserve/hold one or more seats for up to 10 minutes while proceeding through checkout.
- **Secure Payment & Checkout:** Users can purchase held seats via a payment gateway integration.
- **View & Retrieve Tickets:** Users can view confirmed orders, access digital tickets with scannable QR/barcodes, and receive confirmation emails.

### Non-Functional Requirements
- **Correctness & Zero Double-Booking (Critical):** The system must guarantee with 100% mathematical certainty that no two users can ever purchase or reserve the same seat for the same event (strict serializability / ACID guarantees on seat state).
- **Fairness & Queue Management:** Ticket allocation must follow a strict first-come, first-served policy during high-demand sales. Bot prevention (CAPTCHA/rate limiting) and a virtual waiting room must protect human buyers.
- **High Availability & Fault Tolerance:** The platform must remain responsive with 99.99% uptime, even when traffic surges exponentially during flash sales.
- **Speed & Low Latency:**
  - Event browsing and seat map read latency under 50ms (served via edge CDN and memory caches).
  - Seat reservation write confirmation under 200ms.
- **Data Durability:** Confirmed orders and financial transactions must be persisted with zero data loss using transactional write-ahead logs (WAL).

---

## 2. Traffic & Capacity Estimates

### Baseline Facts
- **Registered Users:** 2,000,000 (2 million)
- **Normal Day:**
  - 50,000 unique visitors/day
  - 10 page views per visitor = 500,000 page views/day
  - 5,000 tickets sold/day
  - Standard time window: 24 hours = 86,400 seconds
- **"Big Sale" Peak (Flash Sale):**
  - 200,000 concurrent buyers competing for 20,000 available seats
  - All activity concentrated in the **first 10 minutes (600 seconds)**
  - Each user refreshes the seat map and event page an average of 6 times during the frenzy = 1,200,000 page views in 10 minutes
  - 200,000 reservation attempts in 600 seconds

---

### A. Normal Day Calculations
- **Reads (Page Views Per Second):**
  $$\text{Normal Reads/sec} = \frac{500,000 \text{ views}}{86,400 \text{ sec}} \approx 5.79 \text{ req/sec} \ (\approx 6 \text{ req/sec})$$
- **Writes (Ticket Sales Per Second):**
  $$\text{Normal Writes/sec} = \frac{5,000 \text{ sales}}{86,400 \text{ sec}} \approx 0.058 \text{ writes/sec} \ (\approx 1 \text{ sale every 17 seconds})$$

---

### B. "Big Sale" Peak Calculations (10-Minute Window)
- **Reads (Page Views / Seat Map Refreshes Per Second):**
  $$\text{Peak Reads/sec} = \frac{1,200,000 \text{ views}}{600 \text{ sec}} = 2,000 \text{ req/sec}$$
  *(With momentary surges reaching 4,000–5,000 req/sec during the initial 60 seconds).*
- **Writes (Reservation & Purchase Attempts Per Second):**
  $$\text{Peak Reservation Attempts/sec} = \frac{200,000 \text{ attempts}}{600 \text{ sec}} \approx 333.33 \text{ attempts/sec}$$
  *(Surges reaching 1,000+ reservation write attempts/sec when the sale opens).*
- **Seat Competition Ratio:**
  $$\text{Contention Ratio} = \frac{200,000 \text{ buyers}}{20,000 \text{ available seats}} = 10 \text{ users per seat}$$

---

### C. Traffic Comparison: Normal vs. Big Sale Peak

| Metric | Normal Day | Big Sale Peak (10-Min Flash Sale) | Surge Factor |
| :--- | :--- | :--- | :--- |
| **Active Users** | 50,000 / day | 200,000 concurrent in 10 min | **~4× total users in 1/144th the time** |
| **Read Throughput** | ~5.8 reads/sec | ~2,000 – 4,000 reads/sec | **~345× to 690× increase** |
| **Write Throughput** | ~0.06 writes/sec | ~333 – 1,000 attempts/sec | **~5,500× to 16,000× increase** |
| **Contention Level** | Negligible (seats readily available) | Extreme (10 buyers per seat) | **High lock contention & cache volatility** |

---

## 3. API Specification

The TicketHub backend exposes five primary RESTful endpoints:

### 1. `GET /api/v1/events`
- **Description:** Browses and searches available events with pagination and genre/date filters.
- **Success Status:** `200 OK`
- **Response Example:**
```json
{
  "events": [
    {
      "id": 101,
      "title": "Coldplay: Music of the Spheres Tour",
      "venue": "Wembley Stadium, London",
      "event_date": "2026-11-15T19:30:00Z",
      "status": "ON_SALE",
      "starting_price": 75.00
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 45 }
}
```

### 2. `GET /api/v1/events/{id}/seats`
- **Description:** Retrieves the seat layout, availability status (`AVAILABLE`, `HELD`, `SOLD`), and pricing for a specific event.
- **Success Status:** `200 OK`
- **Response Example:**
```json
{
  "event_id": 101,
  "seats": [
    { "seat_id": 401, "section": "A", "row": "12", "number": "14", "price": 120.00, "status": "AVAILABLE" },
    { "seat_id": 402, "section": "A", "row": "12", "number": "15", "price": 120.00, "status": "HELD" }
  ]
}
```

### 3. `POST /api/v1/events/{id}/hold`
- **Description:** Requests a temporary 10-minute hold on one or more selected seats.
- **Success Status:** `200 OK` (or `409 Conflict` if already held/sold)
- **Request Body:**
```json
{
  "seat_ids": [401],
  "hold_duration_seconds": 600
}
```
- **Response Example:**
```json
{
  "reservation_token": "res_8f3b2a9c-7d1e",
  "seat_ids": [401],
  "expires_at": "2026-10-28T07:54:10Z",
  "total_price": 120.00,
  "status": "HELD"
}
```

### 4. `POST /api/v1/checkout/pay`
- **Description:** Submits payment for previously held seats and converts the reservation into a confirmed order.
- **Success Status:** `201 Created` (or `410 Gone` if hold expired)
- **Request Body:**
```json
{
  "reservation_token": "res_8f3b2a9c-7d1e",
  "payment_method_nonce": "pm_tok_visa_4242",
  "billing_name": "Alice Johnson"
}
```
- **Response Example:**
```json
{
  "order_id": 9051,
  "status": "CONFIRMED",
  "total_paid": 120.00,
  "seat_ids": [401],
  "created_at": "2026-10-28T07:48:00Z"
}
```

### 5. `GET /api/v1/users/me/tickets`
- **Description:** Retrieves all confirmed tickets and orders for the authenticated user, complete with digital barcodes.
- **Success Status:** `200 OK`
- **Response Example:**
```json
{
  "tickets": [
    {
      "ticket_id": 8801,
      "order_id": 9051,
      "event_title": "Coldplay: Music of the Spheres Tour",
      "venue": "Wembley Stadium, London",
      "event_date": "2026-11-15T19:30:00Z",
      "section": "A",
      "row": "12",
      "seat_number": "14",
      "qr_code_url": "https://cdn.tickethub.com/qr/8801.png"
    }
  ]
}
```

---

## 4. Data Model

The schema uses four core relational tables optimized for ACID transactions, integrity, and concurrency control.

```
       +------------------+                   +------------------+
       |      users       |                   |      events      |
       +------------------+                   +------------------+
       | user_id (PK)     |                   | event_id (PK)    |
       | email (UNIQUE)   |                   | title            |
       | name             |                   | venue            |
       | created_at       |                   | event_date       |
       +--------+---------+                   +--------+---------+
                |                                      |
                | 1:N                                  | 1:N
                v                                      v
       +------------------+                   +------------------+
       |      orders      |                   |      seats       |
       +------------------+                   +------------------+
       | order_id (PK)    |                   | seat_id (PK)     |
       | user_id (FK)     |                   | event_id (FK)    |
       | total_amount     |                   | section, row, num|
       | payment_status   |                   | status (ENUM)    |
       | created_at       |                   | held_by (FK)     |
       +--------+---------+                   | held_until       |
                |                             | order_id (FK)    |
                | 1:N                         | version (LOCK)   |
                +---------------------------->+------------------+
```

### Table Definitions (DDL)

```sql
-- 1. Users Table
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Events Table
CREATE TABLE events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(150) NOT NULL,
    venue VARCHAR(150) NOT NULL,
    event_date TIMESTAMP NOT NULL,
    total_seats INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Seats Table
CREATE TABLE seats (
    seat_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    section VARCHAR(20) NOT NULL,
    row_num VARCHAR(10) NOT NULL,
    seat_num VARCHAR(10) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'HELD', 'SOLD'
    held_by_user_id INTEGER,
    held_until TIMESTAMP,
    order_id INTEGER,
    version INTEGER NOT NULL DEFAULT 1, -- Optimistic concurrency control counter
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (held_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL,
    UNIQUE (event_id, section, row_num, seat_num)
);

-- 4. Orders Table
CREATE TABLE orders (
    order_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_status VARCHAR(30) NOT NULL, -- 'PENDING', 'CONFIRMED', 'FAILED'
    transaction_ref VARCHAR(100) UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
);
```

### Relational Dynamics:
- **`users` $\to$ `orders` (1:N):** A user can place multiple orders; each order belongs to one user.
- **`events` $\to$ `seats` (1:N):** An event has many seats; each physical seat belongs to one event.
- **`orders` $\to$ `seats` (1:N):** A completed order references one or more assigned seats.
- **Uniqueness Constraint:** `UNIQUE (event_id, section, row_num, seat_num)` ensures no physical seat can be defined twice for the same concert.

---

## 5. Double-Booking Prevention: Concurrency & Transactions

The central engineering challenge of TicketHub is guaranteeing that **two people can never purchase or hold the same seat**, even when 10 users click "Reserve Seat A12" at the exact same millisecond.

Double-booking is eliminated through a **three-tier defense-in-depth model**:

### Tier 1: In-Memory Distributed Lock (Redis Atomic Reservation)
Before any database query executes, the application server requests an atomic hold in Redis using a key composed of `seat:{event_id}:{seat_id}`:
```redis
SET seat:101:401 "user_482" NX EX 600
```
- The `NX` flag ensures the key is set **only if it does not already exist**.
- The `EX 600` flag enforces an exact **10-minute Time-To-Live (TTL)**.
- If 10 requests arrive simultaneously, the Redis single-threaded execution model guarantees that exactly one request succeeds (`OK`); the other 9 receive `nil` and are rejected immediately with `HTTP 409 Conflict` in under 2ms without ever touching the database.

### Tier 2: Relational Database Atomic Transaction with Pessimistic / Optimistic Locking
To prevent split-brain anomalies between the cache and persistent storage, the hold is recorded in the PostgreSQL database using an atomic transaction with row-level locking:

```sql
BEGIN TRANSACTION;

-- Lock the specific seat row against concurrent transactions
SELECT seat_id, status, held_until 
FROM seats 
WHERE seat_id = 401 
FOR UPDATE;

-- Verify the seat is genuinely unreserved or previous hold expired
UPDATE seats
SET status = 'HELD',
    held_by_user_id = 482,
    held_until = NOW() + INTERVAL '10 minutes',
    version = version + 1
WHERE seat_id = 401
  AND (status = 'AVAILABLE' OR (status = 'HELD' AND held_until < NOW()));

COMMIT;
```
If another transaction was concurrent, `FOR UPDATE` blocks until the first transaction commits. The second transaction then sees `status = 'HELD'` and zero rows are updated, triggering an immediate rollback.

### Tier 3: Final Purchase Commit & Database Constraints
When the user submits payment, the order checkout executes in a strict transaction:
```sql
BEGIN TRANSACTION;

UPDATE seats
SET status = 'SOLD',
    order_id = 9051,
    held_by_user_id = NULL,
    held_until = NULL
WHERE seat_id = 401
  AND held_by_user_id = 482
  AND status = 'HELD'
  AND held_until >= NOW();

-- If row count == 0, the hold expired or belonged to another user: ROLLBACK
INSERT INTO orders (order_id, user_id, event_id, total_amount, payment_status, transaction_ref)
VALUES (9051, 482, 101, 120.00, 'CONFIRMED', 'txn_braintree_789');

COMMIT;
```
A database constraint `CHECK (status IN ('AVAILABLE', 'HELD', 'SOLD'))` and foreign key linkages guarantee mathematical finality. Once set to `'SOLD'`, the seat can never be held or purchased again.

---

## 6. Architecture Diagram & Surviving the Big Sale

```
                                  +-----------------------+
                                  |      Client App       |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  | Virtual Waiting Room  | <--- Absorbs 200,000 users,
                                  |  (Cloudflare Queue)   |      meters 500 req/sec into app
                                  +-----------+-----------+
                                              |
                        +---------------------+---------------------+
                        | (Static Event Pages)                      | (API / Transactions)
                        v                                           v
              +-------------------+                       +-------------------+
              |    Edge CDN       |                       |   Load Balancer   |
              | (Cached Seat Maps)|                       |   (AWS ALB/NGINX) |
              +-------------------+                       +---------+---------+
                                                                    |
                                                 +------------------+------------------+
                                                 |                                     |
                                                 v                                     v
                                       +-------------------+                 +-------------------+
                                       |   App Server 1    |                 |   App Server 2    |
                                       +----+---------+----+                 +----+---------+----+
                                            |         |                           |         |
                                            |         +-------------+-------------+         |
                                            v                       v                       v
                                  +-------------------+   +-------------------+   +-------------------+
                                  |    Redis Cluster  |   |   Message Queue   |   |   Database Tier   |
                                  | (Holds & Locks:   |   |   (RabbitMQ/SQS)  |   |                   |
                                  |  SET ... NX EX)   |   +---------+---------+   | +---------------+ |
                                  +-------------------+             |             | |  Primary DB   | |
                                                                    v             | | (Serial Writes| |
                                                          +-------------------+   | |  & Payment)   | |
                                                          |  Expiry Worker /  |   | +-------+-------+ |
                                                          |  Payment Async    |   |         | Replic. |
                                                          +-------------------+   |         v         |
                                                                                  | +---------------+ |
                                                                                  | | Read Replica  | |
                                                                                  | | (Seat Maps)   | |
                                                                                  | +---------------+ |
                                                                                  +-------------------+
```

### Component Explanations
- **Virtual Waiting Room (Edge Queue):** Acts as the surge barrier during flash sales, intercepting 200,000 simultaneous users at the edge and admitting them in orderly batches (e.g., 500 users/second) with cryptographically signed tokens.
- **Edge CDN:** Serves static event details, venue layouts, and cached seat map snapshots to absorb over 90% of read traffic without hitting application servers.
- **Load Balancer:** Distributes API traffic evenly across stateless application server nodes using round-robin and health-check monitoring.
- **App Servers:** Executes reservation business logic, coordinates distributed locks with Redis, and manages database transactions.
- **Redis Cluster:** Manages atomic seat holds via `SET NX EX` in RAM with 10-minute automatic TTL expiration, deflecting seat contention before it reaches the database.
- **Primary Database (PostgreSQL):** Authoritative transactional engine handling row-level locked reservations and final purchase orders with strict ACID compliance.
- **Read Replica:** Serves high-throughput seat availability queries for browsing users, protecting the primary database from read contention.
- **Message Queue & Expiry Worker:** Cleans up unpurchased reservations when holds expire, reconciles payment gateway webhooks, and dispatches digital ticket emails.

### How the Architecture Survives the Big Sale
1. **Traffic Leveling via Waiting Room:** Instead of 200,000 buyers slamming the database simultaneously, the Waiting Room buffers the surge at the network edge and admits users at a metered rate matching backend capacity (~500 req/sec).
2. **Read/Write Offloading:** Event details and initial seat maps are cached on the CDN and Redis. 95% of reads never touch the primary SQL database.
3. **Lock Containment in Memory:** Contention for seats is resolved in Redis memory at microsecond speeds. Only the 20,000 winning reservation requests ever proceed to execute SQL `UPDATE` operations on the Primary DB.

---

## 7. Architectural Trade-Offs

### Trade-Off 1: Virtual Waiting Room vs. Open Horizontal Scaling
- **Decision:** **Implement a Virtual Waiting Room at the Edge.**
- **Analysis:**
  - *Alternative:* Massively scale app servers and database shards to absorb all 200,000 concurrent requests simultaneously.
  - *Trade-off:* While open scaling sounds appealing, it is mathematically ineffective for ticketing because 200,000 buyers are contending for the exact same 20,000 rows. Throwing more servers at row-level database locks creates catastrophic lock contention, query queueing, and connection pool exhaustion.
  - *Verdict:* The Waiting Room provides superior user fairness, prevents crashes, and reduces infrastructure costs by 80%.

### Trade-Off 2: Redis In-Memory Hold vs. Direct SQL Database Hold
- **Decision:** **Hybrid Two-Tier Hold (Redis `SET NX` followed by async/sync SQL persistence).**
- **Analysis:**
  - *Alternative:* Handle all holds directly in PostgreSQL using `SELECT ... FOR UPDATE`.
  - *Trade-off:* Direct SQL locking guarantees immediate ACID persistence, but cannot withstand 1,000+ contending write locks per second on a single event's seat table without spiking database CPU to 100%.
  - *Verdict:* Redis absorbs the initial blast of conflicting clicks in sub-millisecond memory; only legitimate winning holds touch the relational database, trading minor distributed state complexity for massive scalability and zero downtime.
