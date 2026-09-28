/* =========================================================
   MediSafe — Smart Medicine & Patient Safety
   Complete Frontend JavaScript
   ========================================================= */

const API_URL = "http://127.0.0.1:8000/api";

let currentUser = null;
let patients = [];
let medications = [];
let selectedPatientId = null;
let todaySchedule = [];
let scheduleRefreshTimer = null;

/* =========================================================
   DOM HELPERS
========================================================= */

const $ = (id) => document.getElementById(id);

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getToken() {
    return (
        localStorage.getItem("medisafe_token") ||
        localStorage.getItem("token") ||
        ""
    );
}

function saveToken(token) {
    if (token) {
        localStorage.setItem("medisafe_token", token);
        localStorage.setItem("token", token);
    }
}

function clearSession() {
    localStorage.removeItem("medisafe_token");
    localStorage.removeItem("token");
    localStorage.removeItem("medisafe_user");
}

function showMessage(element, message, type = "error") {
    if (!element) return;

    element.textContent = message || "";
    element.className = `message ${type}`;

    if (!message) {
        element.className = "message";
    }
}

function showToast(message, type = "success") {
    const toast = $("toast");

    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
        toast.className = "toast";
    }, 3500);
}

/* =========================================================
   API
========================================================= */

async function parseResponse(response) {
    const contentType =
        response.headers.get("content-type") || "";

    let data;

    try {
        data = contentType.includes("application/json")
            ? await response.json()
            : await response.text();
    } catch {
        data = null;
    }

    if (!response.ok) {
        let message = "Something went wrong.";

        if (data && typeof data === "object") {
            if (Array.isArray(data.detail)) {
                message = data.detail
                    .map(item => item.msg || "Invalid input")
                    .join(", ");
            } else if (data.detail) {
                message = data.detail;
            } else if (data.message) {
                message = data.message;
            }
        } else if (
            typeof data === "string" &&
            data.trim()
        ) {
            message = data;
        }

        throw new Error(message);
    }

    return data;
}

async function apiFetch(path, options = {}) {
    const headers =
        new Headers(options.headers || {});

    if (
        options.body &&
        typeof options.body === "string" &&
        !headers.has("Content-Type")
    ) {
        headers.set(
            "Content-Type",
            "application/json"
        );
    }

    const token = getToken();

    if (token) {
        headers.set(
            "Authorization",
            `Bearer ${token}`
        );
    }

    const response = await fetch(
        `${API_URL}${path}`,
        {
            ...options,
            headers
        }
    );

    return parseResponse(response);
}

/* =========================================================
   AUTHENTICATION
========================================================= */

function showAuthScreen(screen) {
    const authScreen =
        $("authScreen");

    const registerScreen =
        $("registerScreen");

    const application =
        $("application");

    authScreen?.classList.add("hidden");
    registerScreen?.classList.add("hidden");
    application?.classList.add("hidden");

    if (screen === "login") {
        authScreen?.classList.remove("hidden");
    }

    if (screen === "register") {
        registerScreen?.classList.remove("hidden");
    }

    if (screen === "application") {
        application?.classList.remove("hidden");
    }
}

function updateUserUI() {
    if (!currentUser) return;

    const name =
        currentUser.name ||
        currentUser.full_name ||
        currentUser.username ||
        "User";

    const role =
        currentUser.role ||
        currentUser.account_type ||
        "Patient";

    if ($("userName")) {
        $("userName").textContent = name;
    }

    if ($("userRole")) {
        $("userRole").textContent =
            formatRole(role);
    }

    const avatar =
        document.querySelector(".user-avatar");

    if (avatar) {
        avatar.textContent =
            name
                .trim()
                .charAt(0)
                .toUpperCase() || "U";
    }
}

function formatRole(role) {
    return String(role || "patient")
        .replace(/_/g, " ")
        .replace(
            /\b\w/g,
            char => char.toUpperCase()
        );
}

async function login(email, password) {
    const message =
        $("authMessage");

    showMessage(message, "");

    try {
        const data =
            await apiFetch("/login", {
                method: "POST",

                body: JSON.stringify({
                    email,
                    password
                })
            });

        const token =
            data.access_token ||
            data.token ||
            data.jwt;

        if (token) {
            saveToken(token);
        }

        currentUser =
            data.user ||
            data.user_data ||
            data;

        localStorage.setItem(
            "medisafe_user",
            JSON.stringify(currentUser)
        );

        updateUserUI();

        showAuthScreen(
            "application"
        );

        await initializeApplication();

        showToast(
            "Welcome back."
        );

    } catch (error) {

        showMessage(
            message,
            error.message,
            "error"
        );
    }
}

async function register(
    name,
    email,
    password,
    role
) {
    const message =
        $("registerMessage");

    showMessage(message, "");

    if (password.length < 8) {

        showMessage(
            message,
            "Password must be at least 8 characters.",
            "error"
        );

        return;
    }

    try {

        const data =
            await apiFetch("/register", {
                method: "POST",

                body: JSON.stringify({
                    name,
                    full_name: name,
                    email,
                    password,
                    role
                })
            });

        const token =
            data.access_token ||
            data.token ||
            data.jwt;

        if (token) {

            saveToken(token);

            currentUser =
                data.user ||
                data;

            localStorage.setItem(
                "medisafe_user",
                JSON.stringify(currentUser)
            );

            updateUserUI();

            showAuthScreen(
                "application"
            );

            await initializeApplication();

            showToast(
                "Account created successfully."
            );

        } else {

            showMessage(
                message,
                "Account created. Please sign in.",
                "success"
            );

            $("registerForm")?.reset();

            setTimeout(() => {
                showAuthScreen("login");
            }, 1000);
        }

    } catch (error) {

        showMessage(
            message,
            error.message,
            "error"
        );
    }
}

function logout() {

    currentUser = null;
    patients = [];
    medications = [];
    todaySchedule = [];
    selectedPatientId = null;

    clearSession();

    if (scheduleRefreshTimer) {
        clearInterval(
            scheduleRefreshTimer
        );

        scheduleRefreshTimer = null;
    }

    showAuthScreen("login");

    showToast(
        "You have been signed out."
    );
}

/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

    document
        .querySelectorAll(".nav-item")
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    const section =
                        button.dataset.section;

                    document
                        .querySelectorAll(".nav-item")
                        .forEach(item =>
                            item.classList.remove(
                                "active"
                            )
                        );

                    button.classList.add(
                        "active"
                    );

                    document
                        .querySelectorAll(".section")
                        .forEach(item =>
                            item.classList.add(
                                "hidden"
                            )
                        );

                    const target =
                        $(`${section}Section`);

                    target?.classList.remove(
                        "hidden"
                    );

                    const titles = {
                        dashboard: "Dashboard",
                        patients: "Patients",
                        medications: "Medications",
                        history: "Medication History"
                    };

                    if ($("pageTitle")) {
                        $("pageTitle").textContent =
                            titles[section] ||
                            "Dashboard";
                    }

                    if (
                        section ===
                        "dashboard"
                    ) {
                        await refreshDashboard();
                    }

                    if (
                        section ===
                        "patients"
                    ) {
                        await loadPatients();
                    }

                    if (
                        section ===
                        "medications"
                    ) {
                        await loadPatients();

                        renderMedicationSection();
                    }

                    if (
                        section ===
                        "history"
                    ) {
                        await loadMedicationHistory();
                    }
                }
            );
        });
}

/* =========================================================
   PATIENTS
========================================================= */

async function loadPatients() {

    try {

        const data =
            await apiFetch(
                "/patients"
            );

        patients =
            Array.isArray(data)
                ? data
                : data.patients ||
                  data.items ||
                  [];

        if (
            selectedPatientId &&
            !patients.some(
                p =>
                    Number(p.id) ===
                    Number(selectedPatientId)
            )
        ) {
            selectedPatientId = null;
        }

        if (
            !selectedPatientId &&
            patients.length
        ) {
            selectedPatientId =
                patients[0].id;
        }

        updatePatientCount();

        renderPatients();

        renderDashboardPatients();

        populateMedicationPatients();

        return patients;

    } catch (error) {

        console.error(
            "Patient loading error:",
            error
        );

        if (
            error.message
                .toLowerCase()
                .includes("unauthorized")
        ) {
            logout();
        }

        return [];
    }
}

function updatePatientCount() {

    if ($("patientCount")) {

        $("patientCount").textContent =
            patients.length;
    }
}

function renderPatients() {

    const grid =
        $("patientsGrid");

    if (!grid) return;

    if (!patients.length) {

        grid.innerHTML = `
            <div class="panel">

                <div class="empty-state">

                    <div class="empty-icon">
                        ♙
                    </div>

                    <h4>
                        No patients yet
                    </h4>

                    <p>
                        Add your first patient
                        to start managing medication.
                    </p>

                </div>

            </div>
        `;

        return;
    }

    grid.innerHTML =
        patients.map(patient => {

            const name =
                patient.name ||
                patient.full_name ||
                "Unnamed patient";

            return `
                <div class="patient-card">

                    <div class="patient-avatar">

                        ${escapeHTML(
                            name
                                .charAt(0)
                                .toUpperCase()
                        )}

                    </div>

                    <div class="patient-card-info">

                        <h3>
                            ${escapeHTML(name)}
                        </h3>

                        <p>
                            ${
                                patient.date_of_birth
                                    ? `DOB: ${escapeHTML(
                                        patient.date_of_birth
                                    )}`
                                    : "Date of birth not provided"
                            }
                        </p>

                        <p>
                            ${
                                patient.phone
                                    ? escapeHTML(
                                        patient.phone
                                    )
                                    : "No phone number"
                            }
                        </p>

                    </div>

                    <button
                        class="small-button"
                        onclick="selectPatient(${Number(
                            patient.id
                        )})"
                    >
                        View medications
                    </button>

                </div>
            `;
        }).join("");
}

function renderDashboardPatients() {

    const list =
        $("dashboardPatients");

    if (!list) return;

    if (!patients.length) {

        list.innerHTML = `
            <div class="empty-state compact-empty">

                <div class="empty-icon">
                    ♙
                </div>

                <h4>
                    No patients yet
                </h4>

                <p>
                    Add a patient to begin.
                </p>

            </div>
        `;

        return;
    }

    list.innerHTML =
        patients
            .slice(0, 5)
            .map(patient => {

                const name =
                    patient.name ||
                    patient.full_name ||
                    "Unnamed patient";

                return `
                    <button
                        class="patient-row"
                        onclick="selectPatient(${Number(
                            patient.id
                        )})"
                    >

                        <span
                            class="patient-avatar small"
                        >
                            ${escapeHTML(
                                name
                                    .charAt(0)
                                    .toUpperCase()
                            )}
                        </span>

                        <span>

                            <strong>
                                ${escapeHTML(name)}
                            </strong>

                            <small>
                                ${
                                    patient.phone
                                        ? escapeHTML(
                                            patient.phone
                                        )
                                        : "No phone number"
                                }
                            </small>

                        </span>

                        <span class="row-arrow">
                            ›
                        </span>

                    </button>
                `;
            })
            .join("");
}

function selectPatient(id) {

    selectedPatientId =
        Number(id);

    const medicationNav =
        document.querySelector(
            '.nav-item[data-section="medications"]'
        );

    medicationNav?.click();

    loadMedications(
        selectedPatientId
    );

    loadTodaySchedule();
}

async function savePatient(formData) {

    try {

        await apiFetch(
            "/patients",
            {
                method: "POST",

                body: JSON.stringify({
                    name: formData.name,
                    full_name: formData.name,
                    date_of_birth:
                        formData.date_of_birth ||
                        null,
                    phone:
                        formData.phone ||
                        null,
                    emergency_contact:
                        formData.emergency_contact ||
                        null,
                    emergency_phone:
                        formData.emergency_phone ||
                        null
                })
            }
        );

        closeModal(
            "patientModal"
        );

        $("patientForm")?.reset();

        await loadPatients();

        await loadTodaySchedule();

        showToast(
            "Patient added successfully."
        );

    } catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}

/* =========================================================
   MEDICATIONS
========================================================= */

async function loadMedications(
    patientId = selectedPatientId
) {

    if (!patientId) return [];

    try {

        const data =
            await apiFetch(
                `/medications/${patientId}`
            );

        medications =
            Array.isArray(data)
                ? data
                : data.medications ||
                  data.items ||
                  [];

        updateMedicationCount();

        renderMedicationSection();

        return medications;

    } catch (error) {

        console.error(
            "Medication loading error:",
            error
        );

        medications = [];

        updateMedicationCount();

        return [];
    }
}

function updateMedicationCount() {

    if ($("medicationCount")) {

        $("medicationCount").textContent =
            medications.length;
    }
}

function populateMedicationPatients() {

    const select =
        $("medicationPatient");

    if (!select) return;

    const previous =
        selectedPatientId;

    select.innerHTML =
        patients
            .map(patient => {

                const name =
                    patient.name ||
                    patient.full_name ||
                    `Patient ${patient.id}`;

                return `
                    <option
                        value="${Number(
                            patient.id
                        )}"
                        ${
                            Number(patient.id) ===
                            Number(previous)
                                ? "selected"
                                : ""
                        }
                    >
                        ${escapeHTML(name)}
                    </option>
                `;
            })
            .join("");

    if (!patients.length) {

        select.innerHTML = `
            <option value="">
                Add a patient first
            </option>
        `;
    }
}

function renderMedicationSection() {

    const container =
        $("medicationContent");

    if (!container) return;

    if (!patients.length) {

        container.innerHTML = `
            <div class="panel">

                <div class="empty-state">

                    <div class="empty-icon">
                        ♙
                    </div>

                    <h4>
                        Select or add a patient
                    </h4>

                    <p>
                        Add a patient before
                        creating medications.
                    </p>

                </div>

            </div>
        `;

        return;
    }

    const patient =
        patients.find(
            p =>
                Number(p.id) ===
                Number(selectedPatientId)
        ) || patients[0];

    selectedPatientId =
        patient.id;

    if (!medications.length) {

        container.innerHTML = `
            <div class="panel">

                <div class="panel-header">

                    <div>

                        <span class="eyebrow">
                            ${escapeHTML(
                                patient.name ||
                                patient.full_name ||
                                "PATIENT"
                            )}
                        </span>

                        <h3>
                            Medications
                        </h3>

                    </div>

                </div>

                <div class="empty-state">

                    <div class="empty-icon">
                        💊
                    </div>

                    <h4>
                        No medications yet
                    </h4>

                    <p>
                        Add a medication and
                        create its daily schedule.
                    </p>

                </div>

            </div>
        `;

        return;
    }

    container.innerHTML = `
        <div class="panel">

            <div class="panel-header">

                <div>

                    <span class="eyebrow">
                        PATIENT MEDICATIONS
                    </span>

                    <h3>
                        ${escapeHTML(
                            patient.name ||
                            patient.full_name ||
                            "Patient"
                        )}
                    </h3>

                </div>

                <button
                    class="small-button"
                    onclick="openModal('medicationModal')"
                >
                    + Add medication
                </button>

            </div>

            <div class="medication-list">

                ${medications.map(med => `

                    <div class="medication-card">

                        <div class="medication-card-icon">
                            💊
                        </div>

                        <div class="medication-card-info">

                            <h4>
                                ${escapeHTML(
                                    med.name ||
                                    med.medication_name ||
                                    "Medication"
                                )}
                            </h4>

                            <p>
                                ${escapeHTML(
                                    med.dosage || ""
                                )}
                            </p>

                            <small>
                                ${escapeHTML(
                                    med.frequency ||
                                    "Schedule not specified"
                                )}
                            </small>

                        </div>

                        <div class="medication-card-meta">

                            <span>
                                Quantity:
                                ${escapeHTML(
                                    med.quantity ?? 0
                                )}
                            </span>

                            <span>
                                ${escapeHTML(
                                    med.instructions ||
                                    "No instructions"
                                )}
                            </span>

                        </div>

                    </div>

                `).join("")}

            </div>

        </div>
    `;
}

async function saveMedication(
    formData
) {

    try {

        const medication =
            await apiFetch(
                "/medications",
                {
                    method: "POST",

                    body: JSON.stringify({
                        patient_id:
                            Number(
                                formData.patient_id
                            ),

                        name:
                            formData.name,

                        dosage:
                            formData.dosage,

                        frequency:
                            formData.frequency,

                        quantity:
                            Number(
                                formData.quantity ||
                                0
                            ),

                        instructions:
                            formData.instructions ||
                            ""
                    })
                }
            );

        const medicationId =
            medication.id ||
            medication.medication_id;

        if (
            medicationId &&
            formData.times.length
        ) {

            for (
                const time of formData.times
            ) {

                await apiFetch(
                    "/schedules",
                    {
                        method: "POST",

                        body: JSON.stringify({
                            medication_id:
                                Number(
                                    medicationId
                                ),

                            time,

                            dosage:
                                formData.dosage
                        })
                    }
                );
            }
        }

        closeModal(
            "medicationModal"
        );

        $("medicationForm")?.reset();

        resetScheduleTimeInputs();

        selectedPatientId =
            Number(
                formData.patient_id
            );

        await loadMedications(
            selectedPatientId
        );

        await loadTodaySchedule();

        showToast(
            formData.times.length
                ? "Medication and schedule saved."
                : "Medication saved."
        );

    } catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}

/* =========================================================
   MEDICATION SCHEDULE
========================================================= */

function ensureScheduleUI() {

    const medicationForm =
        $("medicationForm");

    if (!medicationForm) return;

    if (!$("scheduleTimeInputs")) {

        const quantityInput =
            $("medicationQuantity");

        const quantityLabel =
            quantityInput?.previousElementSibling;

        const wrapper =
            document.createElement(
                "div"
            );

        wrapper.innerHTML = `
            <label>
                Schedule times
            </label>

            <div
                class="schedule-time-inputs"
                id="scheduleTimeInputs"
            >

                <div class="schedule-time-row">

                    <input
                        type="time"
                        class="medication-time"
                        value="08:00"
                    >

                    <button
                        type="button"
                        class="remove-time-button"
                        onclick="removeScheduleTime(this)"
                        aria-label="Remove time"
                    >
                        ×
                    </button>

                </div>

            </div>

            <button
                type="button"
                class="secondary-button add-time-button"
                id="addScheduleTime"
            >
                + Add another time
            </button>

            <small class="form-hint">
                Add every time the medication
                should be taken.
            </small>
        `;

        if (quantityLabel) {

            medicationForm.insertBefore(
                wrapper,
                quantityLabel
            );

        } else {

            medicationForm.appendChild(
                wrapper
            );
        }
    }

    bindScheduleTimeButton();
}

function bindScheduleTimeButton() {

    const button =
        $("addScheduleTime");

    if (
        !button ||
        button.dataset.bound === "true"
    ) {
        return;
    }

    button.dataset.bound =
        "true";

    button.addEventListener(
        "click",
        () => {
            addScheduleTimeInput();
        }
    );
}

function addScheduleTimeInput(
    value = ""
) {

    const container =
        $("scheduleTimeInputs");

    if (!container) return;

    const row =
        document.createElement(
            "div"
        );

    row.className =
        "schedule-time-row";

    row.innerHTML = `
        <input
            type="time"
            class="medication-time"
            value="${escapeHTML(value)}"
        >

        <button
            type="button"
            class="remove-time-button"
            onclick="removeScheduleTime(this)"
            aria-label="Remove time"
        >
            ×
        </button>
    `;

    container.appendChild(row);
}

function removeScheduleTime(
    button
) {

    const container =
        $("scheduleTimeInputs");

    if (!container) return;

    const rows =
        container.querySelectorAll(
            ".schedule-time-row"
        );

    if (rows.length <= 1) {

        rows[0]
            ?.querySelector("input")
            ?.focus();

        return;
    }

    button
        .closest(
            ".schedule-time-row"
        )
        ?.remove();
}

function resetScheduleTimeInputs() {

    const container =
        $("scheduleTimeInputs");

    if (!container) return;

    container.innerHTML = `
        <div class="schedule-time-row">

            <input
                type="time"
                class="medication-time"
                value="08:00"
            >

            <button
                type="button"
                class="remove-time-button"
                onclick="removeScheduleTime(this)"
                aria-label="Remove time"
            >
                ×
            </button>

        </div>
    `;

    bindScheduleTimeButton();
}

function getScheduleTimes() {

    return [
        ...document.querySelectorAll(
            ".medication-time"
        )
    ]
        .map(
            input => input.value
        )
        .filter(Boolean)
        .filter(
            (value, index, array) =>
                array.indexOf(value) ===
                index
        )
        .sort();
}

async function loadTodaySchedule() {

    if (!$("todaySchedule")) {
        createScheduleDashboardSection();
    }

    const container =
        $("todaySchedule");

    if (!container) return;

    updateTodayDate();

    if (!patients.length) {

        renderTodaySchedule([]);

        return;
    }

    const patient =
        patients.find(
            p =>
                Number(p.id) ===
                Number(selectedPatientId)
        ) || patients[0];

    if (!patient) return;

    selectedPatientId =
        patient.id;

    try {

        const data =
            await apiFetch(
                `/schedules/${patient.id}`
            );

        todaySchedule =
            Array.isArray(data)
                ? data
                : data.schedules ||
                  data.items ||
                  [];

        renderTodaySchedule(
            todaySchedule
        );

    } catch (error) {

        console.error(
            "Schedule loading error:",
            error
        );

        renderTodayScheduleError(
            error.message
        );
    }
}

function createScheduleDashboardSection() {

    const dashboard =
        $("dashboardSection");

    if (
        !dashboard ||
        $("todaySchedule")
    ) {
        return;
    }

    const contentGrid =
        dashboard.querySelector(
            ".content-grid"
        );

    if (!contentGrid) return;

    const section =
        document.createElement(
            "div"
        );

    section.className =
        "schedule-section";

    section.innerHTML = `
        <div class="section-heading schedule-heading">

            <div>

                <p class="eyebrow">
                    TODAY'S MEDICATIONS
                </p>

                <h2>
                    Medication Schedule
                </h2>

            </div>

            <div
                class="today-date"
                id="todayDate"
            ></div>

        </div>

        <div
            id="todaySchedule"
            class="schedule-list"
        ></div>
    `;

    dashboard.insertBefore(
        section,
        contentGrid
    );
}

function updateTodayDate() {

    const element =
        $("todayDate");

    if (!element) return;

    element.textContent =
        new Date().toLocaleDateString(
            undefined,
            {
                weekday: "long",
                month: "long",
                day: "numeric"
            }
        );
}

function parseTime(time) {

    if (!time) return null;

    const parts =
        String(time).split(":");

    if (parts.length < 2) {
        return null;
    }

    const hours =
        Number(parts[0]);

    const minutes =
        Number(parts[1]);

    if (
        Number.isNaN(hours) ||
        Number.isNaN(minutes)
    ) {
        return null;
    }

    const date =
        new Date();

    date.setHours(
        hours,
        minutes,
        0,
        0
    );

    return date;
}

function formatScheduleTime(time) {

    const date =
        parseTime(time);

    if (!date) {
        return escapeHTML(time);
    }

    return date.toLocaleTimeString(
        undefined,
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}

function calculateScheduleStatus(
    item
) {

    const recorded =
        String(
            item.status ||
            "pending"
        ).toLowerCase();

    if (recorded === "taken") {

        return {
            label: "✓ TAKEN",
            className: "status-taken"
        };
    }

    if (recorded === "missed") {

        return {
            label: "MISSED",
            className: "status-missed"
        };
    }

    const scheduled =
        parseTime(item.time);

    if (!scheduled) {

        return {
            label: "UPCOMING",
            className: "status-upcoming"
        };
    }

    const now =
        new Date();

    const difference =
        (
            scheduled.getTime() -
            now.getTime()
        ) / 60000;

    if (
        difference <= 30 &&
        difference >= -60
    ) {

        return {
            label: "TAKE NOW",
            className: "status-now"
        };
    }

    return {
        label: "UPCOMING",
        className: "status-upcoming"
    };
}

/* =========================================================
   PART 2 CONTINUES BELOW
========================================================= */

/* =========================================================
   RENDER TODAY'S MEDICATION SCHEDULE
========================================================= */

function renderTodaySchedule(schedule) {
    const container = $("todaySchedule");

    if (!container) return;

    if (!schedule || !schedule.length) {
        container.innerHTML = `
            <div class="schedule-empty">

                <div class="empty-icon">
                    💊
                </div>

                <h4>
                    No medication scheduled
                </h4>

                <p>
                    Add medication schedules to see
                    today's doses here.
                </p>

            </div>
        `;

        return;
    }

    const sorted = [...schedule].sort((a, b) => {

        const aTime =
            parseTime(a.time)?.getTime() || 0;

        const bTime =
            parseTime(b.time)?.getTime() || 0;

        return aTime - bTime;
    });

    container.innerHTML = sorted
        .map(item => {

            const status =
                calculateScheduleStatus(item);

            const medicationName =
                item.medication_name ||
                item.name ||
                item.medication?.name ||
                "Medication";

            const dosage =
                item.medication_dosage ||
                item.dosage ||
                item.medication?.dosage ||
                "";

            const scheduleId =
                item.schedule_id ||
                item.id;

            const currentStatus =
                String(
                    item.status ||
                    "pending"
                ).toLowerCase();

            const pending =
                currentStatus !== "taken" &&
                currentStatus !== "missed";

            return `
                <div class="schedule-card">

                    <!-- TIME -->
                    <div class="schedule-time">
                        ${formatScheduleTime(item.time)}
                    </div>

                    <!-- MEDICATION -->
                    <div class="schedule-medication">

                        <div class="schedule-medication-icon">
                            💊
                        </div>

                        <div>

                            <h4>
                                ${escapeHTML(
                                    medicationName
                                )}
                            </h4>

                            <p>
                                ${escapeHTML(
                                    dosage
                                )}
                            </p>

                        </div>

                    </div>

                    <!-- STATUS + ACTIONS -->
                    <div class="schedule-status">

                        <span
                            class="
                                schedule-status-badge
                                ${status.className}
                            "
                        >
                            ${status.label}
                        </span>

                        ${
                            pending && scheduleId
                                ? `
                                    <div class="schedule-actions">

                                        <button
                                            type="button"
                                            class="dose-button taken-button"
                                            onclick="recordDose(
                                                ${Number(scheduleId)},
                                                'taken'
                                            )"
                                        >
                                            TAKEN
                                        </button>

                                        <button
                                            type="button"
                                            class="dose-button missed-button"
                                            onclick="recordDose(
                                                ${Number(scheduleId)},
                                                'missed'
                                            )"
                                        >
                                            MISSED
                                        </button>

                                    </div>
                                `
                                : ""
                        }

                    </div>

                </div>
            `;
        })
        .join("");
}

function renderTodayScheduleError(message) {

    const container =
        $("todaySchedule");

    if (!container) return;

    container.innerHTML = `
        <div class="schedule-empty">

            <div class="empty-icon">
                ⚠
            </div>

            <h4>
                Unable to load schedule
            </h4>

            <p>
                ${escapeHTML(message)}
            </p>

        </div>
    `;
}

/* =========================================================
   RECORD DOSE
========================================================= */

async function recordDose(
    scheduleId,
    status
) {

    const today =
        getLocalDateString();

    try {

        await apiFetch(
            "/doses",
            {
                method: "POST",

                body: JSON.stringify({
                    schedule_id:
                        Number(scheduleId),

                    dose_date:
                        today,

                    status:
                        status
                })
            }
        );

        if (status === "taken") {

            showToast(
                "Dose marked as TAKEN.",
                "success"
            );

        } else {

            showToast(
                "Dose marked as MISSED.",
                "warning"
            );
        }

        await loadTodaySchedule();

        await loadMedicationHistory();

    } catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}

/* =========================================================
   DATE HELPERS
========================================================= */

function getLocalDateString() {

    const date =
        new Date();

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

/* =========================================================
   MEDICATION HISTORY
========================================================= */

async function loadMedicationHistory() {

    const section =
        $("historySection");

    if (!section) return;

    try {

        const data =
            await apiFetch(
                "/doses/history"
            );

        const records =
            Array.isArray(data)
                ? data
                : data.records ||
                  data.history ||
                  data.items ||
                  [];

        renderMedicationHistory(
            records
        );

    } catch (error) {

        console.warn(
            "History endpoint unavailable:",
            error.message
        );
    }
}

function renderMedicationHistory(
    records
) {

    const panel =
        $("historySection")
            ?.querySelector(
                ".panel"
            );

    if (!panel) return;

    if (!records.length) {

        panel.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    ◷
                </div>

                <h4>
                    No medication history yet
                </h4>

                <p>
                    Dose records will appear here
                    once medication tracking is used.
                </p>

            </div>
        `;

        return;
    }

    panel.innerHTML = `
        <div class="history-list">

            ${records.map(record => {

                const status =
                    String(
                        record.status || ""
                    ).toLowerCase();

                const statusClass =
                    status === "taken"
                        ? "status-taken"
                        : "status-missed";

                const medication =
                    record.medication_name ||
                    record.name ||
                    "Medication";

                const date =
                    record.dose_date ||
                    record.date ||
                    "";

                return `
                    <div class="history-row">

                        <div>

                            <strong>
                                ${escapeHTML(
                                    medication
                                )}
                            </strong>

                            <small>
                                ${escapeHTML(
                                    date
                                )}
                            </small>

                        </div>

                        <span
                            class="
                                schedule-status-badge
                                ${statusClass}
                            "
                        >
                            ${escapeHTML(
                                status.toUpperCase()
                            )}
                        </span>

                    </div>
                `;
            }).join("")}

        </div>
    `;
}

/* =========================================================
   MODALS
========================================================= */

function openModal(id) {

    const modal =
        $(id);

    if (!modal) return;

    modal.classList.remove(
        "hidden"
    );

    if (
        id ===
        "medicationModal"
    ) {

        populateMedicationPatients();

        ensureScheduleUI();
    }
}

function closeModal(id) {

    $(id)?.classList.add(
        "hidden"
    );
}

/* =========================================================
   DASHBOARD
========================================================= */

async function refreshDashboard() {

    await loadPatients();

    if (selectedPatientId) {

        await loadMedications(
            selectedPatientId
        );
    }

    await loadTodaySchedule();
}

/* =========================================================
   APPLICATION INITIALIZATION
========================================================= */

async function initializeApplication() {

    showAuthScreen(
        "application"
    );

    updateUserUI();

    setupNavigation();

    ensureScheduleUI();

    await loadPatients();

    if (selectedPatientId) {

        await loadMedications(
            selectedPatientId
        );
    }

    createScheduleDashboardSection();

    await loadTodaySchedule();

    if (scheduleRefreshTimer) {

        clearInterval(
            scheduleRefreshTimer
        );
    }

    /*
     * Refresh the medication schedule
     * every 60 seconds.
     */
    scheduleRefreshTimer =
        setInterval(
            () => {
                loadTodaySchedule();
            },
            60000
        );
}

/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEventListeners() {

    /* -----------------------------------------
       SHOW REGISTER
    ----------------------------------------- */

    $("showRegister")
        ?.addEventListener(
            "click",
            () => {
                showAuthScreen(
                    "register"
                );
            }
        );

    /* -----------------------------------------
       SHOW LOGIN
    ----------------------------------------- */

    $("showLogin")
        ?.addEventListener(
            "click",
            () => {
                showAuthScreen(
                    "login"
                );
            }
        );

    /* -----------------------------------------
       LOGIN
    ----------------------------------------- */

    $("loginForm")
        ?.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                const email =
                    $("loginEmail")
                        ?.value
                        .trim();

                const password =
                    $("loginPassword")
                        ?.value;

                if (!email || !password) {

                    showMessage(
                        $("authMessage"),
                        "Please enter your email and password.",
                        "error"
                    );

                    return;
                }

                await login(
                    email,
                    password
                );
            }
        );

    /* -----------------------------------------
       REGISTER
    ----------------------------------------- */

    $("registerForm")
        ?.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                const name =
                    $("registerName")
                        ?.value
                        .trim();

                const email =
                    $("registerEmail")
                        ?.value
                        .trim();

                const password =
                    $("registerPassword")
                        ?.value;

                const role =
                    $("registerRole")
                        ?.value;

                if (
                    !name ||
                    !email ||
                    !password
                ) {

                    showMessage(
                        $("registerMessage"),
                        "Please complete all required fields.",
                        "error"
                    );

                    return;
                }

                await register(
                    name,
                    email,
                    password,
                    role
                );
            }
        );

    /* -----------------------------------------
       LOGOUT
    ----------------------------------------- */

    $("logoutButton")
        ?.addEventListener(
            "click",
            logout
        );

    /* -----------------------------------------
       ADD PATIENT
    ----------------------------------------- */

    $("addPatientButton")
        ?.addEventListener(
            "click",
            () => {
                openModal(
                    "patientModal"
                );
            }
        );

    $("dashboardAddPatient")
        ?.addEventListener(
            "click",
            () => {
                openModal(
                    "patientModal"
                );
            }
        );

    /* -----------------------------------------
       ADD MEDICATION
    ----------------------------------------- */

    $("addMedicationButton")
        ?.addEventListener(
            "click",
            () => {
                openModal(
                    "medicationModal"
                );
            }
        );

    /* -----------------------------------------
       CLOSE PATIENT MODAL
    ----------------------------------------- */

    $("closePatientModal")
        ?.addEventListener(
            "click",
            () => {
                closeModal(
                    "patientModal"
                );
            }
        );

    $("cancelPatient")
        ?.addEventListener(
            "click",
            () => {
                closeModal(
                    "patientModal"
                );
            }
        );

    /* -----------------------------------------
       CLOSE MEDICATION MODAL
    ----------------------------------------- */

    $("closeMedicationModal")
        ?.addEventListener(
            "click",
            () => {
                closeModal(
                    "medicationModal"
                );
            }
        );

    $("cancelMedication")
        ?.addEventListener(
            "click",
            () => {
                closeModal(
                    "medicationModal"
                );
            }
        );

    /* -----------------------------------------
       CLICK OUTSIDE PATIENT MODAL
    ----------------------------------------- */

    $("patientModal")
        ?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    $("patientModal")
                ) {

                    closeModal(
                        "patientModal"
                    );
                }
            }
        );

    /* -----------------------------------------
       CLICK OUTSIDE MEDICATION MODAL
    ----------------------------------------- */

    $("medicationModal")
        ?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    $("medicationModal")
                ) {

                    closeModal(
                        "medicationModal"
                    );
                }
            }
        );

    /* -----------------------------------------
       PATIENT FORM
    ----------------------------------------- */

    $("patientForm")
        ?.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                await savePatient({

                    name:
                        $("patientName")
                            ?.value
                            .trim(),

                    date_of_birth:
                        $("patientDOB")
                            ?.value,

                    phone:
                        $("patientPhone")
                            ?.value
                            .trim(),

                    emergency_contact:
                        $("emergencyContact")
                            ?.value
                            .trim(),

                    emergency_phone:
                        $("emergencyPhone")
                            ?.value
                            .trim()
                });
            }
        );

    /* -----------------------------------------
       MEDICATION FORM
    ----------------------------------------- */

    $("medicationForm")
        ?.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                ensureScheduleUI();

                const times =
                    getScheduleTimes();

                if (!times.length) {

                    showToast(
                        "Add at least one medication time.",
                        "error"
                    );

                    return;
                }

                const patientId =
                    $("medicationPatient")
                        ?.value;

                const name =
                    $("medicationName")
                        ?.value
                        .trim();

                const dosage =
                    $("medicationDosage")
                        ?.value
                        .trim();

                if (
                    !patientId ||
                    !name ||
                    !dosage
                ) {

                    showToast(
                        "Please enter the patient, medication name, and dosage.",
                        "error"
                    );

                    return;
                }

                await saveMedication({

                    patient_id:
                        patientId,

                    name:
                        name,

                    dosage:
                        dosage,

                    frequency:
                        $("medicationFrequency")
                            ?.value
                            .trim(),

                    quantity:
                        $("medicationQuantity")
                            ?.value,

                    instructions:
                        $("medicationInstructions")
                            ?.value
                            .trim(),

                    times:
                        times
                });
            }
        );

    /* -----------------------------------------
       MEDICATION PATIENT CHANGE
    ----------------------------------------- */

    $("medicationPatient")
        ?.addEventListener(
            "change",
            async event => {

                selectedPatientId =
                    Number(
                        event.target.value
                    );

                await loadMedications(
                    selectedPatientId
                );

                await loadTodaySchedule();
            }
        );

    /* -----------------------------------------
       ESCAPE KEY
    ----------------------------------------- */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !==
                "Escape"
            ) {
                return;
            }

            closeModal(
                "patientModal"
            );

            closeModal(
                "medicationModal"
            );
        }
    );
}

/* =========================================================
   APPLICATION STARTUP
========================================================= */

async function startApplication() {

    setupEventListeners();

    ensureScheduleUI();

    const savedUser =
        localStorage.getItem(
            "medisafe_user"
        );

    const token =
        getToken();

    /*
     * No saved login.
     */
    if (!token) {

        showAuthScreen(
            "login"
        );

        return;
    }

    /*
     * Restore saved user.
     */
    if (savedUser) {

        try {

            currentUser =
                JSON.parse(
                    savedUser
                );

        } catch {

            currentUser = null;
        }
    }

    try {

        /*
         * Check whether the backend
         * still considers the token valid.
         */
        const me =
            await apiFetch(
                "/me"
            );

        currentUser =
            me.user ||
            me;

        localStorage.setItem(
            "medisafe_user",
            JSON.stringify(
                currentUser
            )
        );

        updateUserUI();

        await initializeApplication();

    } catch (error) {

        console.warn(
            "Could not verify session:",
            error.message
        );

        /*
         * If a saved user exists,
         * allow the application to open.
         */
        if (currentUser) {

            updateUserUI();

            await initializeApplication();

        } else {

            clearSession();

            showAuthScreen(
                "login"
            );
        }
    }
}

/* =========================================================
   DOM READY
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    startApplication
);

/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

window.openModal =
    openModal;

window.closeModal =
    closeModal;

window.selectPatient =
    selectPatient;

window.recordDose =
    recordDose;

window.removeScheduleTime =
    removeScheduleTime;

window.addScheduleTimeInput =
    addScheduleTimeInput;

window.loadTodaySchedule =
    loadTodaySchedule;

window.showToast =
    showToast;