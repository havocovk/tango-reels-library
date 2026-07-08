// tangoUI.js - YENİ: Sadece re-export (modüler hale getirildi)
import { updateInterfaceLanguage, updateSmartFilenameAssistant } from './ui/language.js';
import { switchView } from './ui/viewRouter.js';

// Aynı isimlerle dışa aktar (eski kodlar hiç değişmeden çalışmaya devam eder)
export { updateInterfaceLanguage, updateSmartFilenameAssistant, switchView };