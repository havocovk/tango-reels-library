import { dbFetchInstructors, dbSaveInstructor, dbDeleteInstructor } from './tangoVeritabani.js';
import { showCustomAlert, showCustomConfirm } from './tangoModals.js';
import { translations } from './config.js';
import { updateSmartFilenameAssistant } from './tangoUI.js';

let currentLang = 'tr';
let editInstructorId = null;
let globalInstructors = [];
let fetchVideosCallback = null;
let applyFiltersAndSearchCallback = null;

export function initInstructorHandlers(lang, editId, instructors, callbacks) {
    currentLang = lang;
    editInstructorId = editId;
    globalInstructors = instructors;
    fetchVideosCallback = callbacks.fetchVideos;
    applyFiltersAndSearchCallback = callbacks.applyFiltersAndSearch;
}

export function setInstructorHandlersLanguage(lang) {
    currentLang = lang;
}

export async function fetchInstructors() {
    try {
        const instructors = await dbFetchInstructors();
        globalInstructors = instructors;
        const select = document.getElementById('form-instructor-select');
        if (select) {
            select.innerHTML = '';
            instructors.forEach(ins => {
                const opt = document.createElement('option');
                opt.value = ins.id;
                opt.innerText = ins.name;
                select.appendChild(opt);
            });
        }
        updateSmartFilenameAssistant(currentLang, []); // formTagsArray boş, dışarıdan set edilmeli; ancak şimdilik böyle
        // Not: formTagsArray aslında app.js'de, burada erişemiyoruz, sonra düzeltilebilir.
    } catch (err) { console.error(err); }
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
        await fetchInstructors();
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
        await fetchInstructors();
        if (fetchVideosCallback) await fetchVideosCallback();
    } catch (err) { console.error(err); }
}