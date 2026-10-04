let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

function searchNotes(word) {
  const lowerWord = word.toLowerCase();
  return notes.filter(note => note.text.toLowerCase().includes(lowerWord));
}

function longestNote() {
  if (notes.length === 0) return null;
  
  let longest = notes[0];
  for (let i = 1; i < notes.length; i++) {
    if (notes[i].text.length > longest.text.length) {
      longest = notes[i];
    }
  }
  return longest;
}

function countByCategory() {
  const counts = {};
  for (let note of notes) {
    counts[note.category] = (counts[note.category] || 0) + 1;
  }
  return counts;
}

function getSummary() {
  const counts = countByCategory();
  const total = notes.length;
  const word = total === 1 ? "note" : "notes";
  
  const categoryParts = [];
  for (let category in counts) {
    categoryParts.push(`${counts[category]} ${category}`);
  }
  
  return `${total} ${word}: ${categoryParts.join(", ")}.`;
}

function isDuplicate(text) {
  const cleanText = text.trim().toLowerCase();
  return notes.some(note => note.text.trim().toLowerCase() === cleanText);
}

function addNote(text, category) {
  const cleanText = text.trim();
  
  if (cleanText.length < 1 || cleanText.length > 200) {
    console.log("Failed to add note: Length must be between 1 and 200 characters.");
    return false;
  }
  
  if (!["personal", "work", "study"].includes(category)) {
    console.log("Failed to add note: Category must be one of personal, work, or study.");
    return false;
  }
  
  if (isDuplicate(text)) {
    console.log("Failed to add note: A note with this text already exists.");
    return false;
  }
  
  // Find highest current ID or default to 1
  const newId = notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
  
  notes.push({ id: newId, text: cleanText, category });
  return true;
}

// --- TESTS ---

console.log("=== searchNotes ===");
console.log(searchNotes("day")); // Expected: [{ id: 2, text: "Finish the Day 3 assignment", category: "study" }]
console.log(searchNotes("xylophone")); // Expected: [] (Edge case: no match)

console.log("=== longestNote ===");
console.log(longestNote()); // Expected: { id: 3, text: "Email the project report to Grace", category: "work" }
// Edge case: Empty array
let originalNotes = [...notes];
notes = [];
console.log(longestNote()); // Expected: null
notes = [...originalNotes]; // Restore array

console.log("=== countByCategory ===");
console.log(countByCategory()); // Expected: { personal: 2, study: 2, work: 1 }
notes = [];
console.log(countByCategory()); // Expected: {} (Edge case: no notes)
notes = [...originalNotes];

console.log("=== getSummary ===");
console.log(getSummary()); // Expected: "5 notes: 2 personal, 2 study, 1 work."
// Edge case: exactly one note
notes = [{ id: 1, text: "Just one note", category: "personal" }];
console.log(getSummary()); // Expected: "1 note: 1 personal."
notes = [...originalNotes];

console.log("=== isDuplicate ===");
console.log(isDuplicate("buy milk AND bread")); // Expected: true (Edge case: different casing)
console.log(isDuplicate("Buy some apples")); // Expected: false

console.log("=== addNote ===");
console.log(addNote("Learn CSS Grid", "study")); // Expected: true (Note added)
console.log(addNote("  ", "work")); // Expected: false, logs "Length must be between..." (Edge case: empty string after trim)
console.log(addNote("Learn CSS Grid", "study")); // Expected: false, logs "A note with this text already exists."
console.log(addNote("Meditate", "health")); // Expected: false, logs "Category must be one of..."
