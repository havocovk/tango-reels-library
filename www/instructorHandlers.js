// instructorHandlers.js - 8. adım (editInstructorId store'da)
import { dbSaveInstructor, dbDeleteInstructor } from './tangoVeritabani.js';
import { showCustomAlert, showCustomConfirm } from './tangoModals.js';
import { translations } from './i18n.js';
import { store } from './store.js';

let currentLang = 'tr';
let fetchInstructorsCallback = null;
let fetchVideosCallback = null;

export function setInstructorHandlersGlobalData(lang) {
    currentLang = lang;
}

export function initInstructorHandlers(fetchInstructorsFn, fetchVideosFn) {
    fetchInstructorsCallback = fetchInstructorsFn;
    fetchVideosCallback = fetchVideosFn;
}

export async function handleInstructorSubmit() {
    const input = document.getElementById('form-new-instructor-input');
    const name = input.value.trim();
    const lang = translations[currentLang];
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
    const editInstructorId = store.get('editInstructorId');
    
    if (!name) return showCustomAlert(lang.insAlert, okText);
    try {
        await dbSaveInstructor(editInstructorId, name);
        await showCustomAlert(editInstructorId ? lang.insUpdateSuccess : lang.insSuccess, okText);
        input.value = '';
        store.set('editInstructorId', null);
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