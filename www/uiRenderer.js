// uiRenderer.js - YENİ: Sadece re-export (modüler hale getirildi)
import { renderChips } from './ui/chips.js';
import { setupAutocomplete } from './ui/autocomplete.js';
import { renderVideoCards } from './ui/videoCardRenderer.js';

// Aynı isimlerle dışa aktar (eski kodlar hiç değişmeden çalışmaya devam eder)
export { renderChips, setupAutocomplete, renderVideoCards };