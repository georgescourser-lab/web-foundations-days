-- Enable foreign key constraints in SQLite
PRAGMA foreign_keys = ON;

-- Clean up existing tables if re-running script
DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;

-- ============================================================================
-- 1. TABLE DEFINITIONS
-- ============================================================================

-- Students Table
CREATE TABLE students (
    student_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

-- Courses Table
CREATE TABLE courses (
    course_id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_code TEXT NOT NULL UNIQUE,
    course_name TEXT NOT NULL
);

-- Enrolments Table (Junction / Join Table)
CREATE TABLE enrolments (
    enrolment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade TEXT,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    -- Rule preventing the same student from enrolling on the same course twice
    UNIQUE (student_id, course_id)
);

-- ============================================================================
-- 2. INSERT SAMPLE DATA
-- ============================================================================

-- Insert at least 3 students (4 added, including one with no enrolments)
INSERT INTO students (name, email) VALUES
('Alice Johnson', 'alice.johnson@example.com'),
('Bob Smith', 'bob.smith@example.com'),
('Charlie Brown', 'charlie.brown@example.com'),
('Diana Prince', 'diana.prince@example.com');

-- Insert at least 3 courses (4 added)
INSERT INTO courses (course_code, course_name) VALUES
('CS101', 'Introduction to Computer Science'),
('WEB201', 'Web Development Foundations'),
('DB301', 'Database Systems'),
('MATH105', 'Discrete Mathematics');

-- Insert at least 5 enrolments (6 added across various students and courses)
INSERT INTO enrolments (student_id, course_id, grade) VALUES
(1, 1, 'A'),   -- Alice in CS101
(1, 2, 'B+'),  -- Alice in WEB201
(2, 1, 'B'),   -- Bob in CS101
(2, 3, 'A-'),  -- Bob in DB301
(3, 1, 'C+'),  -- Charlie in CS101
(3, 2, 'B');   -- Charlie in WEB201

-- ============================================================================
-- 3. QUERIES
-- ============================================================================

-- Query 1: All courses for one student (by name)
SELECT
    s.name AS student_name,
    c.course_code,
    c.course_name,
    e.grade
FROM students s
JOIN enrolments e ON s.student_id = e.student_id
JOIN courses c ON e.course_id = c.course_id
WHERE s.name = 'Alice Johnson';

-- Query 2: All students on one course
SELECT
    c.course_name,
    s.name AS student_name,
    s.email AS student_email,
    e.grade
FROM courses c
JOIN enrolments e ON c.course_id = e.course_id
JOIN students s ON e.student_id = s.student_id
WHERE c.course_name = 'Introduction to Computer Science';

-- Query 3: The number of students per course
SELECT
    c.course_id,
    c.course_code,
    c.course_name,
    COUNT(e.student_id) AS student_count
FROM courses c
LEFT JOIN enrolments e ON c.course_id = e.course_id
GROUP BY c.course_id, c.course_code, c.course_name;

-- Query 4: Students who have no enrolments
SELECT
    s.student_id,
    s.name AS student_name,
    s.email AS student_email
FROM students s
LEFT JOIN enrolments e ON s.student_id = e.student_id
WHERE e.enrolment_id IS NULL;

-- Query 5: An update of one enrolment's grade
UPDATE enrolments
SET grade = 'A+'
WHERE student_id = (SELECT student_id FROM students WHERE name = 'Bob Smith')
  AND course_id = (SELECT course_id FROM courses WHERE course_code = 'CS101');

-- Verification query displaying the updated grade
SELECT
    s.name AS student_name,
    c.course_code,
    c.course_name,
    e.grade
FROM enrolments e
JOIN students s ON e.student_id = s.student_id
JOIN courses c ON e.course_id = c.course_id
WHERE s.name = 'Bob Smith' AND c.course_code = 'CS101';
