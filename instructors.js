// instructors.js
import * as api from './api.js';
import { translations } from './config.js';

export async function handleInstructorSubmit(state) {
    const lang = translations[state.currentLang];
    const input = document.getElementById('form-new-instructor-input');
    const select = document.getElementById('form-instructor-select');
    
    if (!input || !select) return;
    const name = input.value.trim();

    if (!name) {
        alert(lang.insAlert);
        return;
    }

    const isEditMode = document.getElementById('form-save-instructor').innerText === lang.btnUpdateIns;

    try {
        if (isEditMode) {
            const instructorId = select.value;
            await api.updateInstructor(instructorId, name);
            alert(lang.insUpdateSuccess);
        } else {
            await api.insertInstructor(name);
            alert(lang.insSuccess);
        }

        input.value = '';
        document.getElementById('new-instructor-container').classList.add('d-none');
        if (state.onRefreshUI) state.onRefreshUI();
    } catch (err) {
        console.error(err);
        alert("Eğitmen işlemi sırasında hata meydana geldi!");
    }
}

export async function deleteInstructorFlow(state) {
    const lang = translations[state.currentLang];
    const select = document.getElementById('form-instructor-select');
    if (!select || !select.value) {
        alert(lang.assistantAlert);
        return;
    }

    if (!confirm(lang.deleteConfirm)) return;

    try {
        await api.deleteInstructor(select.value);
        alert(lang.insDeleteSuccess);
        if (state.onRefreshUI) state.onRefreshUI();
    } catch (err) {
        console.error(err);
        alert("Eğitmen silinirken bir hata meydana geldi!");
    }
}