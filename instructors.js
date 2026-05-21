// instructors.js
import * as api from './api.js';
import { translations } from './config.js';
import { updateSmartFilenameAssistant } from './utils.js';

export async function fetchInstructors(state) {
    try {
        const instructors = await api.getAllInstructors();
        const select = document.getElementById('form-instructor-select');
        if (!select) return;
        select.innerHTML = '';
        instructors.forEach(ins => {
            const opt = document.createElement('option');
            opt.value = ins.id;
            opt.innerText = ins.name;
            select.appendChild(opt);
        });
        updateSmartFilenameAssistant(state.currentLang, state.formTagsArray);
    } catch (err) {
        console.error(err);
    }
}

export async function handleInstructorSubmit(state) {
    const input = document.getElementById('form-new-instructor-input');
    const name = input.value.trim();
    const lang = translations[state.currentLang];

    if (!name) {
        alert(lang.insAlert);
        return;
    }

    try {
        await api.saveInstructor({ id: state.editInstructorId, name });
        alert(state.editInstructorId ? lang.insUpdateSuccess : lang.insSuccess);
        
        input.value = '';
        state.editInstructorId = null;
        document.getElementById('btn-save-instructor').innerText = lang.btnAddIns;
        document.getElementById('new-instructor-container').classList.add('d-none');
        
        await fetchInstructors(state);
        if (state.onRefreshUI) state.onRefreshUI();
    } catch (err) {
        console.error(err);
    }
}

export async function deleteInstructorFlow(state) {
    const select = document.getElementById('form-instructor-select');
    if (!select || !select.value) return;

    const lang = translations[state.currentLang];
    if (!confirm(lang.deleteConfirm)) return;

    try {
        await api.deleteInstructor(select.value);
        alert(lang.insDeleteSuccess);
        await fetchInstructors(state);
        if (state.onRefreshUI) state.onRefreshUI();
    } catch (err) {
        console.error(err);
    }
}