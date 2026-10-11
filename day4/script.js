// Select all required DOM elements
const noteText = document.getElementById("note-text");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");
const clearBtn = document.getElementById("clear-btn");
const themeToggle = document.getElementById("theme-toggle");

// Updates both counters and the warning/over classes
function updateCounts() {
  const text = noteText.value;
  const length = text.length;

  // Calculate word count
  const trimmed = text.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;

  // Update counter text
  charCount.textContent = `${length} / 200 characters`;
  wordCount.textContent = `${words} words`;

  // Warning class when over 180 characters
  if (length > 180) {
    charCount.classList.add("warning");
  } else {
    charCount.classList.remove("warning");
  }

  // Over class when over 200 characters
  if (length > 200) {
    charCount.classList.add("over");
  } else {
    charCount.classList.remove("over");
  }
}

// Clear textarea, reset counters, and remove saved draft
function clearAll() {
  noteText.value = "";
  localStorage.removeItem("noteDraft");
  updateCounts();
}

// Call updateCounts() and save the draft on every input event
noteText.addEventListener("input", () => {
  updateCounts();
  localStorage.setItem("noteDraft", noteText.value);
});

// Clear everything when Clear button is clicked
clearBtn.addEventListener("click", clearAll);

// Clear everything when Escape key is pressed inside the textarea
noteText.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearAll();
  }
});

// Theme button toggles dark mode and remembers choice in localStorage
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
  localStorage.setItem("theme", isDark ? "dark" : "light");
});

// When the page loads: restore any saved draft and theme, then call updateCounts()
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.body.classList.add("dark");
  themeToggle.textContent = "Light mode";
} else {
  document.body.classList.remove("dark");
  themeToggle.textContent = "Dark mode";
}

const savedDraft = localStorage.getItem("noteDraft");
if (savedDraft !== null) {
  noteText.value = savedDraft;
}

updateCounts();
