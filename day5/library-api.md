# Library Books REST API Design

A RESTful API specification for managing a library's books collection.

---

## Base URL
`/api/books`

---

## Endpoints

### 1. List All Books
* **Method:** `GET`
* **Path:** `/api/books`
* **Description:** Retrieves a complete list of all books available in the library collection.
* **Request Body:** None
* **Success Status Code:** `200 OK`

### 2. Get a Single Book by ID
* **Method:** `GET`
* **Path:** `/api/books/:id`
* **Description:** Retrieves detailed information for a single book identified by its unique ID.
* **Request Body:** None
* **Success Status Code:** `200 OK`

### 3. Create a New Book
* **Method:** `POST`
* **Path:** `/api/books`
* **Description:** Adds a new book record to the library catalog.
* **Request Body:**
```json
{
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "isbn": "9780132350884",
  "publishedYear": 2008,
  "genre": "Software Engineering",
  "availableCopies": 4
}
```
* **Success Status Code:** `201 Created`

### 4. Update an Existing Book
* **Method:** `PUT`
* **Path:** `/api/books/:id`
* **Description:** Updates all details of an existing book identified by its unique ID.
* **Request Body:**
```json
{
  "title": "Clean Code: A Handbook of Agile Software Craftsmanship",
  "author": "Robert C. Martin",
  "isbn": "9780132350884",
  "publishedYear": 2008,
  "genre": "Software Engineering",
  "availableCopies": 5
}
```
* **Success Status Code:** `200 OK`

### 5. Delete a Book
* **Method:** `DELETE`
* **Path:** `/api/books/:id`
* **Description:** Removes a book record from the library catalog using its unique ID.
* **Request Body:** None
* **Success Status Code:** `204 No Content`

### 6. Filter Books by Author (Query Parameter)
* **Method:** `GET`
* **Path:** `/api/books?author={authorName}`
* **Description:** Retrieves all books written by a specific author matching the query parameter string.
* **Request Body:** None
* **Success Status Code:** `200 OK`

---

## HTTP Error Codes

### 400 Bad Request
* **Status Code:** `400 Bad Request`
* **Explanation:** Occurs when the client sends a malformed request or fails data validation requirements.
* **Example Scenario:** When attempting to create or update a book via `POST /api/books` or `PUT /api/books/123`, but required fields such as `title` or `author` are missing, or `publishedYear` contains invalid non-numeric characters:
```json
// Example of request causing 400 Bad Request:
{
  "author": "George Orwell",
  "publishedYear": "not-a-year"
}
// Error response:
{
  "error": "Bad Request",
  "message": "Field 'title' is required and 'publishedYear' must be an integer."
}
```

### 404 Not Found
* **Status Code:** `404 Not Found`
* **Explanation:** Occurs when the server cannot find a book resource matching the requested identifier.
* **Example Scenario:** When attempting to fetch, update, or delete a book with an ID that does not exist in the database, such as sending `GET /api/books/99999`:
```json
// Error response:
{
  "error": "Not Found",
  "message": "Book with ID 99999 could not be found."
}
```
