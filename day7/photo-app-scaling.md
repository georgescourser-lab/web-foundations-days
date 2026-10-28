# SnapShare: System Scaling & Architecture Plan

## 1. Assumptions and Daily Active Users (DAU)

### Baseline Facts
- **Registered Users:** 10,000,000 (10 million)
- **Active Percentage:** 10% of registered users are active on any given day
- **Upload Rate:** Each active user uploads 1 photo per day
- **Feed Consumption:** Each active user views 50 feed pages per day
- **Original Photo Size:** 2 MB on average
- **Thumbnail Photo Size:** 50 KB on average
- **Peak Traffic Multiplier:** 5× average traffic
- **Time Baseline:** 1 day = 24 hours = 1,440 minutes = 86,400 seconds

### Daily Active Users (DAU) Calculation
$$\text{DAU} = 10,000,000 \times 10\% = 1,000,000 \text{ active users/day}$$

---

## 2. Traffic and Storage Estimates

### A. Uploads Per Second (Writes)
- **Daily Uploads:**
  $$\text{Daily Uploads} = 1,000,000 \text{ DAU} \times 1 \text{ upload/day} = 1,000,000 \text{ photos/day}$$
- **Average Uploads Per Second:**
  $$\text{Avg Uploads/sec} = \frac{1,000,000 \text{ uploads}}{86,400 \text{ seconds}} \approx 11.57 \text{ uploads/sec} \ (\approx 12 \text{ uploads/sec})$$
- **Peak Uploads Per Second (5× Multiplier):**
  $$\text{Peak Uploads/sec} = 11.57 \times 5 \approx 57.87 \text{ uploads/sec} \ (\approx 58 \text{ uploads/sec})$$

---

### B. Feed Views Per Second (Reads)
- **Daily Feed Page Views:**
  $$\text{Daily Feed Views} = 1,000,000 \text{ DAU} \times 50 \text{ views/day} = 50,000,000 \text{ feed views/day}$$
- **Average Feed Views Per Second:**
  $$\text{Avg Feed Views/sec} = \frac{50,000,000 \text{ views}}{86,400 \text{ seconds}} \approx 578.70 \text{ views/sec} \ (\approx 579 \text{ views/sec})$$
- **Peak Feed Views Per Second (5× Multiplier):**
  $$\text{Peak Feed Views/sec} = 578.70 \times 5 \approx 2,893.52 \text{ views/sec} \ (\approx 2,894 \text{ views/sec})$$

---

### C. Photo Storage Per Year
- **Storage Per Upload:**
  - Original Photo: $2\text{ MB} = 2,000\text{ KB}$
  - Thumbnail: $50\text{ KB} = 0.05\text{ MB}$
  - Total Storage per Photo: $2\text{ MB} + 0.05\text{ MB} = 2.05\text{ MB}$

- **Daily Storage Consumption:**
  $$\text{Daily Storage} = 1,000,000 \text{ photos} \times 2.05 \text{ MB} = 2,050,000 \text{ MB} = 2,050 \text{ GB} = 2.05 \text{ TB/day}$$

- **Annual Storage Consumption (365 days):**
  $$\text{Annual Storage} = 2.05 \text{ TB/day} \times 365 \text{ days} = 748.25 \text{ TB/year}$$
  - Breakdown:
    - Original Photos: $1,000,000 \times 2\text{ MB} \times 365 = 730\text{ TB/year}$
    - Thumbnails: $1,000,000 \times 0.05\text{ MB} \times 365 = 18.25\text{ TB/year}$
    - Total: **748.25 TB/year** *(or ~713.5 TiB/year using binary $1024^2$ multiplier)*

---

## 3. Read-Heavy vs. Write-Heavy Analysis

### System Classification
SnapShare is overwhelmingly a **read-heavy** system.

- **Read vs. Write Ratio:**
  $$\text{Ratio} = \frac{50,000,000 \text{ feed views}}{1,000,000 \text{ photo uploads}} = 50:1$$
  For every single photo uploaded to the platform, users view 50 feed pages (an average of 579 reads/sec vs. 12 writes/sec, reaching 2,894 peak reads/sec).

### Architectural Implications
1. **Aggressive Multi-Tier Caching:** Feed generation and metadata queries cannot touch the primary relational database on every request. Frequently accessed user feeds, active social graphs, and photo metadata must be cached in in-memory stores (e.g., Redis).
2. **Read/Write Database Segregation:** The database tier must employ read replicas. All queries for feed browsing and user profile views are routed to read replicas, preserving the primary database's I/O exclusively for writes (uploads, new followers, comments).
3. **Edge Media Offloading via CDN:** With over 50 million feed loads per day, media requests would saturate the storage layer without a Content Delivery Network (CDN) caching thumbnails and images close to the user.
4. **Asynchronous Write Decoupling:** Because writes represent a smaller volume (~12 to 58 writes/sec), the write pipeline can afford asynchronous task offloading (queues and background workers) without degrading perceived upload speed.

---

## 4. Why Photos Should Not Be Stored in the Database

Photos should **never** be stored as binary large objects (`BLOB`) directly inside a relational or transactional database for the following reasons:

1. **Catastrophic Database Bloat:** Storing ~748 TB of raw binary data per year would rapidly exhaust database storage limits, leading to massive indexes and memory-inefficient buffer pool thrashing where large binary objects displace critical index pages and relational tables.
2. **Degraded Performance & High Latency:** Databases are optimized for structured queries, row indexing, transactions, and relational joins. Reading and writing megabyte-sized binary payloads consumes enormous network I/O and CPU memory buffers, bottlenecking concurrent database transactions.
3. **Operational Bottlenecks (Backups & Replication):** Database backups, point-in-time restores, failovers, and replica synchronizations become slow and error-prone when managing hundreds of terabytes of binary data instead of gigabytes of structured rows.
4. **Extreme Financial Cost:** Database storage (high-IOPS SSDs and provisioned database storage) is significantly more expensive than commodity cloud storage.

### Where They Should Go Instead
Raw photo files and thumbnails must be stored in **Cloud Object Storage** (such as Amazon S3, Google Cloud Storage, or Azure Blob Storage):
- **Purpose-Built for Unstructured Media:** Object storage is built for high-throughput, horizontally scalable storage of arbitrary file sizes with 99.999999999% (11 9's) durability.
- **Cost-Effective:** Drastically cheaper per gigabyte than provisioned relational database storage.
- **Native CDN Integration & Direct Presigned URLs:** Integrates directly with CDNs for edge distribution and supports presigned URLs, allowing clients to stream photos directly to and from object storage without traversing application servers.
- **Metadata Separation:** The relational database stores only lightweight metadata: `photo_id`, `user_id`, `timestamp`, `caption`, and the `storage_url` / object key pointing to the file in object storage.

---

## 5. Architecture Diagram

```
                              +--------------------+
                              |    Client App /    |
                              |   Mobile Device    |
                              +---------+----------+
                                        |
               +------------------------+------------------------+
               | (Reads: Feed / Images)                          | (Writes: API Requests)
               v                                                 v
     +-------------------+                             +-------------------+
     |        CDN        |                             |   Load Balancer   |
     | (Edge Caching for |                             |   (Traffic Dist.) |
     | Photos/Thumbnails)|                             +---------+---------+
     +---------+---------+                                       |
               |                                       +---------+---------+
               | Cache Miss                            |                   |
               v                                       v                   v
     +-------------------+                   +-------------------+ +-------------------+
     |   Object Storage  |<------------------+    App Server 1   | |    App Server 2   |
     | (Original Photos  |   Store Photo     |   (Business Logic)| |  (Business Logic) |
     |  & Thumbnails)    |                   +----+---------+----+ +----+---------+----+
     +---------^---------+                        |         |           |         |
               |                                  |         +-----+-----+         |
               | Upload Thumbnail                 |               |               |
               |                                  v               v               v
     +---------+---------+               +-------------+ +-----------------------------+
     |   Worker Node     |               |    Cache    | |        Database Tier        |
     | (Thumbnail Gen.)  |               |   (Redis)   | |                             |
     +---------^---------+               | (Feeds/Hot) | |  +-----------------------+  |
               |                         +-------------+ |  |      Primary DB       |  |
               | Dequeue Job                             |  |   (Transactional/     |  |
     +---------+---------+                               |  |    Metadata Writes)   |  |
     |   Queue Broker    |<------------------------------+  +-----------+-----------+  |
     | (Asynchronous SQS/|       Enqueue Job                            | Replication  |
     |  RabbitMQ/Kafka)  |                                              v              |
     +-------------------+                                  +-----------------------+  |
                                                            |     Read Replica      |  |
                                                            |   (Feed/User Reads)   |  |
                                                            +-----------------------+  |
                                                         +-----------------------------+
```

---

## 6. Component Explanations (One Sentence Each)

- **CDN (Content Delivery Network):** Caches photos and thumbnails at geographically distributed edge locations near users to reduce latency and offload media bandwidth from origin object storage.
- **Load Balancer:** Distributes incoming HTTP/HTTPS traffic evenly across multiple application server instances to prevent single-point bottlenecks, ensure high availability, and seamlessly absorb traffic spikes.
- **App Servers:** Executes core application business logic, handles authentication, coordinates database transactions, serves API responses, and dispatches background tasks.
- **Cache (In-Memory / Redis):** Stores precomputed user feeds, active social graph relationships, and hot metadata in RAM to deliver sub-millisecond read responses and protect the database from query overload.
- **Database (Primary):** Serves as the authoritative single source of truth for transactional data (user profiles, follower relationships, photo metadata) and replicates updates to read replicas.
- **Database (Read Replica):** Processes read-only queries for user feeds, historical posts, and profile lookups, scaling read throughput horizontally and preventing reads from competing with write operations.
- **Object Storage:** Stores raw original photo files and generated thumbnails cost-effectively with practically unlimited capacity and 11 9's of durability.
- **Queue (Message Broker):** Decouples photo uploads from resource-intensive image processing by holding asynchronous thumbnail creation jobs in a resilient queue.
- **Worker:** Consumes image processing tasks from the message queue in the background to resize uploaded photos into 50 KB thumbnails and save them back to object storage.

---

## 7. Step-by-Step Flow of Uploading a Photo

```
User App               App Server             Object Storage          Message Queue           Worker Node          Primary DB
   |                       |                         |                      |                      |                    |
   | 1. POST /photos/upload|                         |                      |                      |                    |
   |---------------------->|                         |                      |                      |                    |
   |                       | 2. Save 2 MB Photo      |                      |                      |                    |
   |                       |------------------------>|                      |                      |                    |
   |                       | 3. Insert Photo Metadata|                      |                      |                    |
   |                       |------------------------------------------------------------------------------------------->|
   |                       | 4. Enqueue Thumbnail Job|                      |                      |                    |
   |                       |----------------------------------------------->|                      |                    |
   | 5. HTTP 201 Created   |                         |                      |                      |                    |
   |<----------------------|                         |                      |                      |                    |
   |                       |                         |                      | 6. Pull Job          |                    |
   |                       |                         |                      |<---------------------|                    |
   |                       |                         | 7. Fetch Original    |                      |                    |
   |                       |                         |<--------------------------------------------|                    |
   |                       |                         |                      |                      | 8. Resize to 50 KB |
   |                       |                         | 9. Save Thumbnail    |                      |--------------------+
   |                       |                         |<--------------------------------------------|                    |
   |                       |                         |                      |                      | 10. Update DB URL  |
   |                       |                         |----------------------------------------------------------------->|
```

1. **Upload Initiation:** The client application initiates an upload request (`POST /api/v1/photos`) with the raw photo file (average 2 MB) and accompanying metadata (caption, location tags, user authorization token) to the Load Balancer, which forwards it to an available App Server.
2. **Binary Media Storage:** The App Server validates the request, generates a globally unique identifier (`photo_id`), and streams the 2 MB raw image file directly to Object Storage under a structured key (e.g., `/photos/originals/{photo_id}.jpg`).
3. **Metadata Persistence:** The App Server writes the photo record to the Primary Database, inserting `photo_id`, `user_id`, `created_at`, `status = 'processing'`, and the storage URI of the original photo.
4. **Thumbnail Job Dispatch:** The App Server publishes an asynchronous event message containing `{photo_id, original_photo_url}` to the Message Queue.
5. **Immediate Client Response:** The App Server immediately returns a success response (`HTTP 201 Created`) with the new `photo_id` to the client app so the user does not experience latency while the thumbnail is generated.
6. **Worker Job Consumption:** A background Worker node listening to the Message Queue claims and dequeues the thumbnail generation job.
7. **Image Retrieval & Processing:** The Worker node downloads the 2 MB original photo from Object Storage, processes the image using an image manipulation library, and downsamples it into a 50 KB thumbnail.
8. **Thumbnail Storage:** The Worker node uploads the generated 50 KB thumbnail into Object Storage under a dedicated thumbnail path (e.g., `/photos/thumbnails/{photo_id}.jpg`).
9. **Database & Cache Update:** The Worker updates the photo's record in the Primary Database with the `thumbnail_url` and marks `status = 'ready'`; it then updates or invalidates any corresponding precomputed feed caches in Redis so followers can see the new post with its thumbnail instantly.

---

## 8. Architectural Trade-Offs

### Trade-Off 1: Asynchronous vs. Synchronous Thumbnail Generation
- **Chosen Approach:** Asynchronous processing via a message queue and background worker pool.
- **Advantages:**
  - Dramatically improves user experience: the client receives an upload confirmation in ~100–200 ms instead of waiting several seconds for image compression and resizing.
  - Shields API app servers from CPU spikes caused by image decoding and resizing, allowing app servers to remain lean and handle more concurrent web traffic.
- **Disadvantages:**
  - Introduces eventual consistency: there is a slight window (typically 1–3 seconds) where the photo is uploaded but its thumbnail is not yet rendered, requiring the frontend to handle fallback placeholders or loading spinners.
  - Adds architectural complexity with additional infrastructure components (message broker, worker fleet, dead-letter queues, and retry policies).

### Trade-Off 2: Feed Generation Strategy — Fan-Out-on-Write (Push) vs. Fan-Out-on-Read (Pull)
- **Chosen Approach:** Hybrid approach favoring **Fan-Out-on-Write** for standard users, backed by **Fan-Out-on-Read** for high-follower celebrity accounts ("VIPs").
- **Analysis:**
  - *Fan-Out-on-Write (Push):* When a user uploads a photo, the system pushes the photo ID directly into each follower's precomputed feed cache in Redis.
    - *Advantage:* Feed reads are blazing fast ($O(1)$ lookup from cache), which perfectly satisfies our 50:1 read-heavy profile (579–2,894 views/sec).
    - *Disadvantage:* If a user has millions of followers (e.g., a celebrity), pushing 1 upload to 1 million cache lists consumes enormous write bandwidth and storage.
  - *Trade-off Balance:* Standard users have their posts pushed directly to follower feed caches, while accounts with >50,000 followers have their posts merged dynamically at read time (Pull), preventing system-wide write storms while keeping the vast majority of feed reads instant.

### Trade-Off 3: Direct Object Storage Uploads (Presigned URLs) vs. Server-Proxied Uploads
- **Consideration:**
  - *Server-Proxied (Current baseline):* Client streams the 2 MB photo to the App Server, which relays it to Object Storage. This simplifies authorization and validation on a single gateway, but consumes significant app server network bandwidth and RAM.
  - *Presigned URLs (Alternative Optimization):* The client asks the App Server for a signed S3 upload URL and uploads the 2 MB file directly from the mobile device to Object Storage, bypassing the app server fleet entirely.
  - *Trade-off:* Presigned uploads conserve immense server bandwidth and lower operational costs, but require a webhook/event-driven mechanism (e.g., S3 Event Notifications to SNS/SQS) to notify the backend when an upload finishes, making error recovery and validation slightly more complex.
