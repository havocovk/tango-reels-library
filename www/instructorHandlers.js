// www/instructorHandlers.js
import { dbSaveInstructor, dbDeleteInstructor } from './tangoVeritabani.js';
import { showCustomAlert, showCustomConfirm } from './tangoModals.js';
import { translations } from './config.js';
import { store } from './store.js';

let fetchInstructorsCallback = null;
let fetchVideosCallback = null;

export function setInstructorHandlersGlobalData(lang, editId) {
    // store kullanıldığı için boş
}

export function initInstructorHandlers(editId, fetchInstructorsFn, fetchVideosFn) {
    fetchInstructorsCallback = fetchInstructorsFn;
    fetchVideosCallback = fetchVideosFn;
}

export async function handleInstructorSubmit() {
    const input = document.getElementById('form-new-instructor-input');
    const name = input.value.trim();
    const lang = translations[store.get('currentLang')];
    const okText = store.get('currentLang') === 'tr' ? 'Tamam' : 'OK';
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
    const lang = translations[store.get('currentLang')];
    const okText = store.get('currentLang') === 'tr' ? 'Tamam' : 'OK';
    const cancelText = store.get('currentLang') === 'tr' ? 'İptal' : 'Cancel';
    if (!await showCustomConfirm(lang.deleteConfirm, okText, cancelText)) return;
    try {
        await dbDeleteInstructor(select.value);
        await showCustomAlert(lang.insDeleteSuccess, okText);
        if (fetchInstructorsCallback) await fetchInstructorsCallback();
        if (fetchVideosCallback) await fetchVideosCallback();
    } catch (err) { console.error(err); }
}