// State storage for fetched users
let users = [];

// DOM Elements
const loadUsersBtn = document.getElementById("load-users");
const filterInput = document.getElementById("filter-input");
const statusEl = document.getElementById("status");
const usersList = document.getElementById("users-list");

/**
 * Updates status message and styling
 * @param {string} message - Text content to display
 * @param {'loading' | 'success' | 'error' | ''} type - Status type modifier
 */
function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = "status-message" + (message ? ` visible ${type}` : "");
}

/**
 * Renders an array of user objects into the users list DOM.
 * Uses createElement and textContent exclusively.
 * @param {Array} list - Array of user objects to render
 */
function renderUsers(list) {
  // Clear previous list content
  usersList.textContent = "";

  // If no users match or list is empty
  if (list.length === 0) {
    const emptyLi = document.createElement("li");
    emptyLi.className = "user-empty";
    emptyLi.textContent = "No users match your filter.";
    usersList.appendChild(emptyLi);
    return;
  }

  // Render each user card
  list.forEach((user) => {
    const li = document.createElement("li");
    li.className = "user-item";

    // User Name
    const nameEl = document.createElement("h2");
    nameEl.className = "user-name";
    nameEl.textContent = user.name;
    li.appendChild(nameEl);

    // User Email
    const emailEl = document.createElement("p");
    emailEl.className = "user-detail";
    const emailLabel = document.createElement("strong");
    emailLabel.textContent = "Email: ";
    const emailValue = document.createElement("span");
    emailValue.textContent = user.email || "N/A";
    emailEl.appendChild(emailLabel);
    emailEl.appendChild(emailValue);
    li.appendChild(emailEl);

    // User City
    const cityEl = document.createElement("p");
    cityEl.className = "user-detail";
    const cityLabel = document.createElement("strong");
    cityLabel.textContent = "City: ";
    const cityValue = document.createElement("span");
    const cityName =
      user.address && user.address.city
        ? user.address.city
        : user.city || "N/A";
    cityValue.textContent = cityName;
    cityEl.appendChild(cityLabel);
    cityEl.appendChild(cityValue);
    li.appendChild(cityEl);

    // User Company Name
    const companyEl = document.createElement("p");
    companyEl.className = "user-detail";
    const companyLabel = document.createElement("strong");
    companyLabel.textContent = "Company: ";
    const companyValue = document.createElement("span");
    const companyName =
      user.company && user.company.name
        ? user.company.name
        : user.company || "N/A";
    companyValue.textContent = companyName;
    companyEl.appendChild(companyLabel);
    companyEl.appendChild(companyValue);
    li.appendChild(companyEl);

    usersList.appendChild(li);
  });
}

/**
 * Asynchronously fetches user data from the REST API endpoint.
 * Handles loading states, button disabled states, error reporting, and parsing.
 */
async function loadUsers() {
  loadUsersBtn.disabled = true;
  setStatus("Loading users...", "loading");

  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/users");

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    users = data;

    // Reset filter input on fresh data load
    filterInput.value = "";
    renderUsers(users);
    setStatus(`Successfully loaded ${users.length} users.`, "success");
  } catch (error) {
    usersList.textContent = "";
    setStatus(`Failed to load users: ${error.message}`, "error");
  } finally {
    loadUsersBtn.disabled = false;
  }
}

// Event Listeners
loadUsersBtn.addEventListener("click", loadUsers);

// Filter input listener (case-insensitive without making a new network request)
filterInput.addEventListener("input", (event) => {
  const query = event.target.value.toLowerCase().trim();
  const filtered = users.filter((user) =>
    user.name.toLowerCase().includes(query)
  );
  renderUsers(filtered);
});
