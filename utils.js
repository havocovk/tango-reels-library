// utils.js
import { translations } from './config.js';

export function convertDriveUrlToEmbed(url) {
    if (!url) return '';
    const regExp = /\/file\/d\/([^/]+)/;
    const matches = url.match(regExp);
    if (matches && matches[1]) {
        return `https://drive.google.com/file/d/${matches[1]}/preview`;
    }
    return url;
}

export function updateSmartFilenameAssistant(currentLang, formTagsArray) {
    const lang = translations[currentLang];
    const select = document.getElementById('form-instructor-select');
    const outputDiv = document.getElementById('assistant-filename-output');

    if (!select || !outputDiv) return;

    if (!select.value || select.selectedIndex === -1) {
        outputDiv.innerText = lang.assistantAlert;
        return;
    }

    let instructorName = select.options[select.selectedIndex].text;
    let cleanName = instructorName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

    let cleanTags = formTagsArray
        .map(t => t.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, ''))
        .filter(t => t !== '')
        .join('_');

    let finalFilename = cleanName;
    if (cleanTags) {
        finalFilename += '_' + cleanTags;
    }
    finalFilename += '.mp4';

    outputDiv.innerText = finalFilename;
}