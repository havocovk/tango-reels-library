// instructors.js
import { AppState } from './state.js';
import { translations } from './config.js';
import * as api from './api.js';

export async function handleInstructorSubmit() {
    const lang = translations[AppState.currentLang];
    const input = document.getElementById('form-new-instructor-input');
    const select = document.getElementById('form-instructor-select');
    if (!input || !select) return;
    
    const name = input.value.trim();
    if (!name) return alert(lang.insAlert);

    const isEditMode = document.getElementById('form-save-instructor').innerText === lang.btnUpdateIns;
    try {
        if (isEditMode) {
            await api.updateInstructor(select.value, name);
            alert(lang.insUpdateSuccess);
        } else {
            await api.insertInstructor(name);
            alert(lang.insSuccess);
        }
        input.value = '';
        document.getElementById('new-instructor-container').classList.add('d-none');
        if (AppState.onRefreshUI) await AppState.onRefreshUI();
    } catch (err) {
        console.error(err);
    }
}

export async function deleteInstructorFlow() {
    const lang = translations[AppState.currentLang];
    const select = document.getElementById('form-instructor-select');
    if (!select || !select.value) return alert(lang.assistantAlert);
    if (!confirm(lang.deleteConfirm)) return;

    try {
        await api.deleteInstructor(select.value);
        alert(lang.insDeleteSuccess);
        if (AppState.onRefreshUI) await AppState.onRefreshUI();
    } catch (err) {
        console.error(err);
    }
}