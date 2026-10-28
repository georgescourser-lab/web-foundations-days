# School Database Design

## 1. Table Explanations

The database schema models an academic management system using three normalized tables:

- **`students`**: Represents individual students registered in the institution.
  - `student_id` (INTEGER, Primary Key): Unique identifier for each student (auto-incremented).
  - `name` (TEXT, NOT NULL): The full name of the student.
  - `email` (TEXT, NOT NULL, UNIQUE): The student's email address, constrained to ensure no two students share the same email.

- **`courses`**: Represents courses offered by the institution.
  - `course_id` (INTEGER, Primary Key): Unique identifier for each course (auto-incremented).
  - `course_code` (TEXT, NOT NULL, UNIQUE): Institutional course code (e.g., `CS101`, `WEB201`).
  - `course_name` (TEXT, NOT NULL): Full title of the course.

- **`enrolments`**: The junction (associative) table that links students to the courses they take.
  - `enrolment_id` (INTEGER, Primary Key): Unique identifier for each enrolment record.
  - `student_id` (INTEGER, NOT NULL): Foreign key referencing `students(student_id)` with `ON DELETE CASCADE`.
  - `course_id` (INTEGER, NOT NULL): Foreign key referencing `courses(course_id)` with `ON DELETE CASCADE`.
  - `grade` (TEXT): The grade awarded to the student for the course (e.g., `'A'`, `'B+'`).
  - `UNIQUE(student_id, course_id)`: Composite unique constraint preventing a student from enrolling in the same course more than once.

---

## 2. Relationships

### One-to-Many Relationships
- **`students` to `enrolments` (1:N)**: A single student can have zero, one, or many course enrolments. Each individual enrolment record belongs to exactly one student.
- **`courses` to `enrolments` (1:N)**: A single course can have zero, one, or many enrolled students. Each enrolment record references exactly one course.

### Many-to-Many Relationship
- **`students` to `courses` (M:N)**: Students can take multiple courses, and courses can be attended by multiple students.

### Why a Join Table is Needed
In relational databases, many-to-many relationships cannot be modeled directly between two tables without violating normalization principles (First Normal Form - 1NF):
1. **Prevents Data Duplication and Redundancy**: If course information were stored directly inside the `students` table, student details (name, email) would have to be duplicated for every course taken, leading to update, insert, and deletion anomalies.
2. **Avoids Non-Atomic Fields**: Storing comma-separated lists of course IDs in a single column violates 1NF, prevents database-level foreign key enforcement, and makes querying or indexing individual courses inefficient.
3. **Captures Relationship-Specific Attributes**: The grade does not belong exclusively to the student or to the course—it only exists for a specific student *in* a specific course. A join table (`enrolments`) provides the proper entity to store relationship attributes like `grade` and enrolment timestamps.
4. **Enforces Integrity**: The join table decomposes the M:N relationship into two clean 1:N relationships, allowing foreign keys to enforce referential integrity and a composite `UNIQUE` constraint to prevent duplicate enrollments.

---

## 3. Recommended Index and Justification

**Proposed Index:**
```sql
CREATE INDEX idx_enrolments_student_id ON enrolments(student_id);
```

**Reason:**  
In relational databases including SQLite, primary key columns automatically receive a unique index, but foreign key columns on child tables do not. In a school system, queries that filter or join by student (such as retrieving all courses and grades for a given student, or verifying a student's active status) frequently query `enrolments.student_id`. Adding an index on `enrolments(student_id)` replaces full-table sequential scans with B-tree index seeks, reducing search complexity from $O(N)$ to $O(\log N)$ as the number of enrollments scales to thousands or millions of records.

*(Note: In workloads frequently searching courses by code/title or looking up all students in a course, an index on `enrolments(course_id)` or `students(name)` would provide similar performance benefits for those query patterns).*

---

## 4. SQL vs. NoSQL for this System

For this school management system, a **relational SQL database** (such as SQLite or PostgreSQL) is the superior architectural choice over a NoSQL database. School administration data is inherently structured and relational, demanding strict schema constraints, foreign key referential integrity, and ACID guarantees to ensure that registrations, course capacities, and grade modifications are recorded consistently without corruption or race conditions. Relational engines natively excel at executing multi-table joins and complex aggregate queries (e.g., calculating class averages, student enrollments, or identifying unenrolled students via outer joins) without duplicating data. In contrast, a NoSQL document or key-value store would require embedding course details inside student documents (or vice versa), which causes severe data redundancy and risks update anomalies whenever course titles or student details change; alternatively, resolving relationships across unnormalized collections in NoSQL shifts foreign key integrity and join logic to the application layer, introducing unnecessary complexity and potential inconsistencies into a domain where data correctness is critical.
