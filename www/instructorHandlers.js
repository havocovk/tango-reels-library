import { dbSaveInstructor, dbDeleteInstructor } from './tangoVeritabani.js';
import { showCustomAlert, showCustomConfirm } from './tangoModals.js';
import { translations } from './config.js';

let currentLang = 'tr';
let editInstructorId = null;
let fetchInstructorsCallback = null;
let fetchVideosCallback = null;

export function setInstructorHandlersGlobalData(lang, editId) {
    currentLang = lang;
    editInstructorId = editId;
}

export function initInstructorHandlers(editId, fetchInstructorsFn, fetchVideosFn) {
    editInstructorId = editId;
    fetchInstructorsCallback = fetchInstructorsFn;
    fetchVideosCallback = fetchVideosFn;
}

export async function handleInstructorSubmit() {
    const input = document.getElementById('form-new-instructor-input');
    const name = input.value.trim();
    const lang = translations[currentLang];
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
    if (!name) return showCustomAlert(lang.insAlert, okText);
    try {
        await dbSaveInstructor(editInstructorId, name);
        await showCustomAlert(editInstructorId ? lang.insUpdateSuccess : lang.insSuccess, okText);
        input.value = '';
        editInstructorId = null;
        document.getElementById('btn-save-instructor').innerText = lang.btnAddIns;
        document.getElementById('new-instructor-container').classList.add('d-none');
        if (fetchInstructorsCallback) await fetchInstructorsCallback();
        if (fetchVideosCallback) await fetchVideosCallback();
    } catch (err) { console.error(err); }
}

export async function deleteInstructor() {
    const select = document.getElementById('form-instructor-select');
    if (!select.value) return;
    const lang = translations[currentLang];
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelText = currentLang === 'tr' ? 'İptal' : 'Cancel';
    if (!await showCustomConfirm(lang.deleteConfirm, okText, cancelText)) return;
    try {
        await dbDeleteInstructor(select.value);
        await showCustomAlert(lang.insDeleteSuccess, okText);
        if (fetchInstructorsCallback) await fetchInstructorsCallback();
        if (fetchVideosCallback) await fetchVideosCallback();
    } catch (err) { console.error(err); }
}